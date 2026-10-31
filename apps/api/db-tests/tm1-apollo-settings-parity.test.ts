// J9S-9 (PL-04): parity between the CHECK `sync_settings_value_shape` of leads.sync_settings
// (migration 0141) and the parse of the worker, `unreadableApolloKeys` (qualification.ts). Both
// say what an Apollo setting may hold; they live in two languages (SQL jsonpath, zod) and could
// drift apart. The risk is one-way: a value the base accepts that the worker cannot read would
// fail every Apollo line, an incident (05 RG160) and a worker that refuses to start (RG162). So
// every value the CHECK accepts must pass the parse; equivalently, every value the parse refuses
// must be refused by the CHECK. The reverse is allowed to be lax (the parse may accept what the base
// could never hold) but is pinned case by case, so that a change of either side shows up here.
//
// ONE table of cases feeds both sides. Each case runs the real UPDATE in one rolled-back
// transaction of the local superuser (a refusal is SQLSTATE 23514), and the same value goes through
// `unreadableApolloKeys` on a baseline of valid settings.
import { inRolledBackTransaction, probe } from "@influx/test-kit/db";
import { describe, expect, it } from "vitest";
import {
  APOLLO_SETTING_KEYS,
  unreadableApolloKeys,
  type ApolloSettingKey,
} from "../src/domains/leads/connectors/apollo/qualification.ts";
import { localSuperuser } from "./support.ts";

/**
 * The ways the write path refuses a value: the CHECK itself (23514), the trigger that reads the
 * shape first (22023, "cannot extract elements from a scalar") and the one that checks the country
 * codes against reference.countries (23503). Any other error is not a refusal of the value.
 */
const REFUSALS: ReadonlySet<string> = new Set(["22023", "23503", "23514"]);

type Case = {
  key: ApolloSettingKey;
  label: string;
  value: unknown;
  /** The CHECK of the base lets the value in. */
  base: boolean;
  /** The parse of the worker reads the value. */
  worker: boolean;
};

const VALID_BASIS = { default: "consentement_requis", by_country: {} };

/** `base` and `worker` are the verdicts; they differ only where the parse is the laxer one. */
const CASES: readonly Case[] = [
  // apollo_scope: a string of the closed list.
  ...(
    [
      "annonceurs_seuls",
      "annonceurs_et_createurs_pro",
      "tous_les_inscrits",
    ] as const
  ).map((scope): Case => ({
    key: "apollo_scope",
    label: `the scope ${scope}`,
    value: scope,
    base: true,
    worker: true,
  })),
  ...[
    ["an unknown scope", "all"],
    ["an empty string", ""],
    ["a capitalised scope", "Annonceurs_seuls"],
    ["a number", 1],
    ["a boolean", true],
    ["a JSON null", null],
    ["a list holding a scope", ["annonceurs_seuls"]],
    ["an object", { scope: "annonceurs_seuls" }],
  ].map(([label, value]): Case => ({
    key: "apollo_scope",
    label: String(label),
    value,
    base: false,
    worker: false,
  })),

  // apollo_legal_basis: { default, by_country }, bases of the closed list.
  {
    key: "apollo_legal_basis",
    label: "the default basis and no country",
    value: VALID_BASIS,
    base: true,
    worker: true,
  },
  {
    key: "apollo_legal_basis",
    label: "the other default basis",
    value: { default: "interet_legitime_avec_opposition", by_country: {} },
    base: true,
    worker: true,
  },
  {
    key: "apollo_legal_basis",
    label: "two countries with their own basis",
    value: {
      default: "consentement_requis",
      by_country: {
        FR: "consentement_requis",
        GB: "interet_legitime_avec_opposition",
      },
    },
    base: true,
    worker: true,
  },
  ...[
    ["no default", { by_country: {} }],
    ["no by_country", { default: "consentement_requis" }],
    ["an unknown default basis", { default: "none", by_country: {} }],
    ["a default that is not a string", { default: 1, by_country: {} }],
    [
      "an unknown basis for a country",
      { default: "consentement_requis", by_country: { FR: "none" } },
    ],
    [
      "a basis for a country that is not a string",
      { default: "consentement_requis", by_country: { FR: 1 } },
    ],
    [
      "a null basis for a country",
      { default: "consentement_requis", by_country: { FR: null } },
    ],
    [
      "by_country as a list",
      { default: "consentement_requis", by_country: ["FR"] },
    ],
    [
      "by_country as a string",
      { default: "consentement_requis", by_country: "FR" },
    ],
    ["a bare string", "consentement_requis"],
    ["a JSON null", null],
    ["an empty object", {}],
  ].map(([label, value]): Case => ({
    key: "apollo_legal_basis",
    label: String(label),
    value,
    base: false,
    worker: false,
  })),
  // The parse is the laxer one: the base can never hold these, so the worker never reads them.
  {
    key: "apollo_legal_basis",
    label:
      "a country code in lower case (the base refuses, the parse does not)",
    value: {
      default: "consentement_requis",
      by_country: { fr: "consentement_requis" },
    },
    base: false,
    worker: true,
  },
  {
    key: "apollo_legal_basis",
    label:
      "a country code of three letters (the base refuses, the parse does not)",
    value: {
      default: "consentement_requis",
      by_country: { FRA: "consentement_requis" },
    },
    base: false,
    worker: true,
  },
  {
    key: "apollo_legal_basis",
    label: "an extra key (the base refuses, the parse drops it)",
    value: { ...VALID_BASIS, note: "x" },
    base: false,
    worker: true,
  },

  // apollo_excluded_countries: a list of ISO 3166-1 alpha-2 codes in capitals.
  ...[
    ["an empty list", []],
    ["one country", ["FR"]],
    ["two countries", ["DE", "FR"]],
    ["countries out of order (neither side enforces the order)", ["FR", "DE"]],
  ].map(([label, value]): Case => ({
    key: "apollo_excluded_countries",
    label: String(label),
    value,
    base: true,
    worker: true,
  })),
  {
    key: "apollo_excluded_countries",
    label: "a country twice (the base refuses, the parse does not)",
    value: ["FR", "FR"],
    base: false,
    worker: true,
  },
  ...[
    ["a code in lower case", ["fr"]],
    ["a code of three letters", ["FRA"]],
    ["a code of one letter", ["F"]],
    ["a code with a trailing space", ["FR "]],
    ["a code with a digit", ["F1"]],
    ["a number in the list", [33]],
    ["a null in the list", [null]],
    ["a valid code then a number", ["FR", 33]],
    ["a list in the list", [["FR"]]],
    ["a string", "FR"],
    ["an object", { FR: true }],
    ["a JSON null", null],
    ["a boolean", false],
  ].map(([label, value]): Case => ({
    key: "apollo_excluded_countries",
    label: String(label),
    value,
    base: false,
    worker: false,
  })),
];

/** A baseline of valid settings, one key replaced: the other two keys never decide the verdict. */
function workerReads(key: ApolloSettingKey, value: unknown): boolean {
  const settings: Record<string, unknown> = {
    apollo_scope: "annonceurs_seuls",
    apollo_legal_basis: VALID_BASIS,
    apollo_excluded_countries: [],
    [key]: value,
  };
  return !unreadableApolloKeys(settings).includes(key);
}

/** The real UPDATE of the key, in a transaction that is always rolled back. */
function baseAccepts(key: string, value: unknown): Promise<boolean> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    const result = await probe(
      tx,
      `update leads.sync_settings set value = $1::text::jsonb where key = $2`,
      [JSON.stringify(value), key],
    );
    if (result.outcome === "error") {
      expect(REFUSALS.has(result.code), result.code).toBe(true);
      return false;
    }
    expect(result.count).toBe(1);
    return true;
  });
}

describe("J9S-9: the CHECK sync_settings_value_shape and unreadableApolloKeys agree", () => {
  it("the table holds accepted and refused values for each of the three Apollo keys", () => {
    for (const key of APOLLO_SETTING_KEYS) {
      const own = CASES.filter((entry) => entry.key === key);
      expect(own.some((entry) => entry.base && entry.worker)).toBe(true);
      expect(own.some((entry) => !entry.base && !entry.worker)).toBe(true);
    }
  });

  it("no case says the base accepts what the worker cannot read (table sanity)", () => {
    expect(CASES.filter((entry) => entry.base && !entry.worker)).toEqual([]);
  });

  describe.each(APOLLO_SETTING_KEYS)("%s", (key) => {
    it.each(CASES.filter((entry) => entry.key === key))(
      "J9S-9 $label: base $base, worker $worker",
      async ({ value, base, worker }) => {
        const baseVerdict = await baseAccepts(key, value);
        const workerVerdict = workerReads(key, value);
        expect({ base: baseVerdict, worker: workerVerdict }).toEqual({
          base,
          worker,
        });
        // The invariant itself: whatever the base lets in, the worker reads.
        if (baseVerdict) {
          expect(workerVerdict).toBe(true);
        }
      },
    );
  });
});
