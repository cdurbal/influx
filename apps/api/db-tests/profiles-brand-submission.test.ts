// L2B commit 06 — the submission of a brand profile, guarded by the database (0203; docs/mvp/06
// RG3 to RG6, RG61, edge cases 3 and 5; 04 §4.3): the five states, the only member transition,
// the code of the first missing field, the idempotent second submission, the register line, and
// the PARITY of the required fields between the base (profiles.advertiser_missing_required_fields)
// and packages/domain (BRAND_PROFILE_REQUIRED_FIELDS, missingRequiredFields): both copies answer
// the same inputs, the domain codes in camelCase, the base's in snake_case. Each case runs in a
// rolled-back transaction of the local superuser, which acts as apps/api does (support.ts).
import {
  BRAND_PROFILE_REQUIRED_FIELDS,
  missingRequiredFields,
  type BrandProfileRequiredInput,
} from "@influx/domain/brand-profile";
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAsInternal, actAsMember, localSuperuser } from "./support.ts";

const CHECK_VIOLATION = "23514";
const OBJECT_NOT_IN_PREREQUISITE_STATE = "55000";
const INSUFFICIENT_PRIVILEGE = "42501";

type Tx = postgres.TransactionSql;

const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");

/** A domain code (camelCase) as the base names it (snake_case). */
function snake(code: string): string {
  return code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** A domain input with the keys of the base. */
function snakeKeys(input: BrandProfileRequiredInput): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [snake(key), value]),
  );
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function asBrand<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: account, role: "advertiser", aal: "aal1" },
    fn,
  );
}

type Submission =
  | { outcome: "submitted"; status: string; changed: boolean; at: Date }
  | { outcome: "error"; code: string; detail: string | undefined };

/** profiles.submit_own_advertiser_profile() in a savepoint: its row, or its SQLSTATE and DETAIL. */
async function submit(tx: Tx): Promise<Submission> {
  try {
    const [row] = await tx.savepoint(
      (savepoint) =>
        savepoint<
          { status: string; submitted_at: Date; changed: boolean }[]
        >`select status, submitted_at, changed from profiles.submit_own_advertiser_profile()`,
    );
    if (row === undefined) {
      throw new Error("the submission returned no row");
    }
    return {
      outcome: "submitted",
      status: row.status,
      changed: row.changed,
      at: row.submitted_at,
    };
  } catch (error) {
    const found = error as { code?: string; detail?: string };
    if (found.code === undefined) {
      throw error;
    }
    return { outcome: "error", code: found.code, detail: found.detail };
  }
}

/** A refusal of SQLSTATE `code`, with the DETAIL when one is given. */
function refused(code: string, detail?: string): unknown {
  return detail === undefined
    ? expect.objectContaining({ outcome: "error", code })
    : { outcome: "error", code, detail };
}

const PRESENTATION = "We design durable outdoor gear. ".repeat(4).trim(); // 127 characters

/**
 * Completes brand A's profile as the superuser: the data set already holds one row in each list,
 * the four columns are filled here; the profile stays draft.
 */
async function completeBrandA(tx: Tx): Promise<void> {
  await tx`
    update profiles.advertiser_profiles
       set primary_sector_code = 'sports_leisure', company_size_band = '11_50',
           presentation = ${PRESENTATION}, contact_role = 'marketing'
     where account_id = ${brandA}`;
}

async function stateOf(
  tx: Tx,
  account: string,
): Promise<{ status: string; submitted: boolean }> {
  const [row] = await tx<{ status: string; submitted: boolean }[]>`
    select status::text as status, submitted_at is not null as submitted
      from profiles.advertiser_profiles where account_id = ${account}`;
  if (row === undefined) {
    throw new Error(`no profile for ${account}`);
  }
  return row;
}

type RegisterLine = {
  actor_type: string;
  actor_account_id: string | null;
  subject_type: string;
  subject_id: string;
  payload: unknown;
};

async function submittedLines(
  tx: Tx,
  account: string,
): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select actor_type::text as actor_type, actor_account_id::text as actor_account_id,
           subject_type, subject_id::text as subject_id, payload
      from audit.audit_events
     where event_type = 'profile.submitted' and subject_id = ${account}
     order by seq`;
}

// ---------------------------------------------------------------------------------------------
// Parity of the required fields: the base and packages/domain
// ---------------------------------------------------------------------------------------------

/** The database copy of the rule, on the input of the domain copy (keys in snake_case). */
async function missingInBase(
  input: BrandProfileRequiredInput,
): Promise<string[]> {
  const [row] = await localSuperuser()<{ missing: string[] }[]>`
    select profiles.advertiser_missing_required_fields(
             ${JSON.stringify(snakeKeys(input))}::text::jsonb) as missing`;
  if (row === undefined) {
    throw new Error("no answer");
  }
  return row.missing;
}

const COMPLETE: Required<BrandProfileRequiredInput> = {
  legalName: "Nord Gear",
  primarySector: "sports_leisure",
  companySize: "11_50",
  country: "FR",
  targetMarkets: ["FR", "BE"],
  workingLanguages: ["fr"],
  presentation: PRESENTATION,
  topics: ["sport_fitness"],
  networks: ["instagram"],
  formats: ["instagram_reel"],
  audienceCountries: ["FR"],
  contactRole: "marketing",
};

const SPACES = "\t\n\u000b\f\r         　﻿";

const PARITY_CASES: readonly [string, BrandProfileRequiredInput][] = [
  ["nothing entered", {}],
  [
    "every field null",
    Object.fromEntries(Object.keys(COMPLETE).map((key) => [key, null])),
  ],
  ["a complete profile", COMPLETE],
  ...BRAND_PROFILE_REQUIRED_FIELDS.map(
    (field): [string, BrandProfileRequiredInput] => [
      `${field} absent`,
      Object.fromEntries(
        Object.entries(COMPLETE).filter(([key]) => key !== field),
      ),
    ],
  ),
  ...BRAND_PROFILE_REQUIRED_FIELDS.map(
    (field): [string, BrandProfileRequiredInput] => [
      `${field} empty`,
      {
        ...COMPLETE,
        [field]: Array.isArray(COMPLETE[field]) ? [] : "",
      },
    ],
  ),
  ["a name of one character", { ...COMPLETE, legalName: "N" }],
  ["a name of two characters", { ...COMPLETE, legalName: "NG" }],
  [
    "a name of one character between margins",
    { ...COMPLETE, legalName: `${SPACES}N${SPACES}` },
  ],
  [
    "a name of two characters between margins",
    { ...COMPLETE, legalName: `${SPACES}N G${SPACES}` },
  ],
  ["a name of spaces only", { ...COMPLETE, legalName: SPACES }],
  [
    "a presentation of 119 characters",
    { ...COMPLETE, presentation: "a".repeat(119) },
  ],
  [
    "a presentation of 120 characters",
    { ...COMPLETE, presentation: "a".repeat(120) },
  ],
  [
    "a presentation of 119 characters between margins",
    { ...COMPLETE, presentation: `${SPACES}${"a".repeat(119)}${SPACES}` },
  ],
  [
    "a presentation of 120 characters outside the BMP",
    { ...COMPLETE, presentation: "\u{1f332}".repeat(120) },
  ],
  [
    "a presentation of 119 characters outside the BMP",
    { ...COMPLETE, presentation: "\u{1f332}".repeat(119) },
  ],
  ["a sector of a space", { ...COMPLETE, primarySector: " " }],
  ["a role of a no-break space", { ...COMPLETE, contactRole: " " }],
];

describe("06 RG5, RG61: the required fields of the base equal those of packages/domain", () => {
  it("names the twelve codes of BRAND_PROFILE_REQUIRED_FIELDS, in their order, for an empty profile", async () => {
    expect(await missingInBase({})).toEqual(
      BRAND_PROFILE_REQUIRED_FIELDS.map(snake),
    );
  });

  it.each(PARITY_CASES)(
    "answers as missingRequiredFields() for %s",
    async (_label, input) => {
      expect(await missingInBase(input)).toEqual(
        missingRequiredFields(input).map(snake),
      );
    },
  );

  it("is pure and closed: IMMUTABLE, SECURITY INVOKER, owned by its definer, executed by no role", async () => {
    const rows = await localSuperuser()<
      {
        volatility: string;
        definer: boolean;
        owner: string;
        config: string[] | null;
        grantees: string[];
      }[]
    >`
      select p.provolatile::text as volatility, p.prosecdef as definer,
             pg_catalog.pg_get_userbyid(p.proowner) as owner, p.proconfig as config,
             coalesce((select pg_catalog.array_agg(distinct pg_catalog.pg_get_userbyid(a.grantee)::text
                                                    order by pg_catalog.pg_get_userbyid(a.grantee)::text)
                         from pg_catalog.aclexplode(p.proacl) a
                        where a.grantee <> p.proowner), '{}') as grantees
        from pg_catalog.pg_proc p
       where p.oid = 'profiles.advertiser_missing_required_fields(jsonb)'::regprocedure`;
    expect(rows).toEqual([
      {
        volatility: "i",
        definer: false,
        owner: "influx_identity_definer",
        config: ['search_path=""'],
        grantees: [],
      },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// The five states (06 RG3) and the only member transition (RG5, RG6)
// ---------------------------------------------------------------------------------------------

describe("06 RG3: the five states of a brand profile", () => {
  it("holds draft, pending_review, published, rejected and suspended, in that order", async () => {
    const [row] = await localSuperuser()<{ states: string[] }[]>`
      select pg_catalog.enum_range(null::profiles.advertiser_profile_status)::text[] as states`;
    expect(row?.states).toEqual([
      "draft",
      "pending_review",
      "published",
      "rejected",
      "suspended",
    ]);
  });
});

describe("06 RG5: the brand submits a complete profile, journaled in the same transaction", () => {
  it("moves draft to pending_review, dates it and writes profile.submitted", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      const submission = await asBrand(tx, brandA, () => submit(tx));
      return {
        submission,
        state: await stateOf(tx, brandA),
        lines: await submittedLines(tx, brandA),
        other: await stateOf(tx, brandB),
      };
    });
    expect(outcome).toEqual({
      submission: {
        outcome: "submitted",
        status: "pending_review",
        changed: true,
        at: expect.any(Date),
      },
      state: { status: "pending_review", submitted: true },
      lines: [
        {
          actor_type: "member",
          actor_account_id: brandA,
          subject_type: "advertiser_profile",
          subject_id: brandA,
          payload: { from_status: "draft" },
        },
      ],
      other: { status: "draft", submitted: false },
    });
  });

  it("moves rejected to pending_review (RG5: corrected after a refusal)", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      await tx`
        update profiles.advertiser_profiles set status = 'rejected', submitted_at = now()
         where account_id = ${brandA}`;
      const submission = await asBrand(tx, brandA, () => submit(tx));
      return {
        changed: submission.outcome === "submitted" && submission.changed,
        state: await stateOf(tx, brandA),
        payloads: (await submittedLines(tx, brandA)).map(
          (line) => line.payload,
        ),
      };
    });
    expect(outcome).toEqual({
      changed: true,
      state: { status: "pending_review", submitted: true },
      payloads: [{ from_status: "rejected" }],
    });
  });

  it("refuses an incomplete profile with the code of the first missing field, writing nothing (23514)", async () => {
    // the data set's brand A holds its lists, not the four columns: primary_sector comes first
    const outcome = await scenario(async (tx) => ({
      submission: await asBrand(tx, brandA, () => submit(tx)),
      state: await stateOf(tx, brandA),
      lines: await submittedLines(tx, brandA),
    }));
    expect(outcome).toEqual({
      submission: refused(CHECK_VIOLATION, "primary_sector"),
      state: { status: "draft", submitted: false },
      lines: [],
    });
  });

  it.each([
    [
      "primary_sector",
      "update profiles.advertiser_profiles set primary_sector_code = null where account_id = $1",
    ],
    [
      "company_size",
      "update profiles.advertiser_profiles set company_size_band = null where account_id = $1",
    ],
    [
      "target_markets",
      "delete from profiles.advertiser_target_markets where account_id = $1",
    ],
    [
      "working_languages",
      "delete from profiles.advertiser_working_languages where account_id = $1",
    ],
    [
      "presentation",
      `update profiles.advertiser_profiles set presentation = '  ${"a".repeat(119)}  '
        where account_id = $1`,
    ],
    ["topics", "delete from profiles.advertiser_topics where account_id = $1"],
    [
      "networks",
      "delete from profiles.advertiser_networks where account_id = $1",
    ],
    [
      "formats",
      "delete from profiles.advertiser_formats where account_id = $1",
    ],
    [
      "audience_countries",
      "delete from profiles.advertiser_audience_countries where account_id = $1",
    ],
    [
      "contact_role",
      "update profiles.advertiser_profiles set contact_role = null where account_id = $1",
    ],
  ])(
    "refuses a profile without %s, named in the error (23514)",
    async (code, removal) => {
      const outcome = await scenario(async (tx) => {
        await completeBrandA(tx);
        await tx.unsafe(removal, [brandA]);
        return {
          submission: await asBrand(tx, brandA, () => submit(tx)),
          state: await stateOf(tx, brandA),
        };
      });
      expect(outcome).toEqual({
        submission: refused(CHECK_VIOLATION, code),
        state: { status: "draft", submitted: false },
      });
    },
  );

  it("ignores a list that is not required: no usage right and no secondary sector still submit", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      await tx`delete from profiles.advertiser_usage_rights where account_id = ${brandA}`;
      await tx`delete from profiles.advertiser_secondary_sectors where account_id = ${brandA}`;
      return asBrand(tx, brandA, () => submit(tx));
    });
    expect(outcome).toEqual(
      expect.objectContaining({ outcome: "submitted", changed: true }),
    );
  });
});

describe("06 edge case 3: a second submission has no effect", () => {
  it("returns pending_review unchanged, with the instant of the first one, and one register line", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      const first = await asBrand(tx, brandA, () => submit(tx));
      const second = await asBrand(tx, brandA, () => submit(tx));
      return {
        first,
        second,
        lines: (await submittedLines(tx, brandA)).length,
      };
    });
    if (outcome.first.outcome !== "submitted") {
      throw new Error("the first submission failed");
    }
    expect(outcome.second).toEqual({
      outcome: "submitted",
      status: "pending_review",
      changed: false,
      at: outcome.first.at,
    });
    expect(outcome.lines).toBe(1);
  });
});

describe("06 edge case 5, RG6: no member writes published, rejected nor suspended", () => {
  it.each(["published", "suspended"])(
    "refuses to submit a %s profile, which stays as it is (55000)",
    async (status) => {
      const outcome = await scenario(async (tx) => {
        await completeBrandA(tx);
        await tx.unsafe(
          `update profiles.advertiser_profiles set status = $1::profiles.advertiser_profile_status,
                  submitted_at = now()
            where account_id = $2`,
          [status, brandA],
        );
        return {
          submission: await asBrand(tx, brandA, () => submit(tx)),
          state: (await stateOf(tx, brandA)).status,
          lines: (await submittedLines(tx, brandA)).length,
        };
      });
      expect(outcome).toEqual({
        submission: refused(OBJECT_NOT_IN_PREREQUISITE_STATE),
        state: status,
        lines: 0,
      });
    },
  );

  it.each(["pending_review", "published", "rejected", "suspended"])(
    "refuses the brand a direct write of %s (42501: no right on status)",
    async (status) => {
      const outcome = await scenario(async (tx) => {
        await completeBrandA(tx);
        return asBrand(tx, brandA, async () => {
          try {
            await tx.savepoint((savepoint) =>
              savepoint.unsafe(
                `update profiles.advertiser_profiles
                    set status = $1::profiles.advertiser_profile_status
                  where account_id = $2`,
                [status, brandA],
              ),
            );
            return "written";
          } catch (error) {
            return (error as { code?: string }).code;
          }
        });
      });
      expect(outcome).toBe(INSUFFICIENT_PRIVILEGE);
    },
  );

  it("lets neither a creator nor an agent nor an admin submit (42501: EXECUTE for influx_advertiser only)", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      const creator = await actAsMember(
        tx,
        "influx_creator",
        {
          accountId: accountIdOf("creator", "a"),
          role: "creator",
          aal: "aal1",
        },
        () => submit(tx),
      );
      const agent = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: accountIdOf("agent", "a"), role: "agent", aal: "aal2" },
        () => submit(tx),
      );
      const admin = await actAsInternal(
        tx,
        "influx_admin",
        { accountId: accountIdOf("admin", "a"), role: "admin", aal: "aal2" },
        () => submit(tx),
      );
      return {
        creator,
        agent,
        admin,
        state: (await stateOf(tx, brandA)).status,
      };
    });
    expect(outcome).toEqual({
      creator: refused(INSUFFICIENT_PRIVILEGE),
      agent: refused(INSUFFICIENT_PRIVILEGE),
      admin: refused(INSUFFICIENT_PRIVILEGE),
      state: "draft",
    });
  });

  it("submits the caller's own profile only: brand B's call leaves brand A draft", async () => {
    const outcome = await scenario(async (tx) => {
      await completeBrandA(tx);
      const submission = await asBrand(tx, brandB, () => submit(tx));
      return { submission, a: await stateOf(tx, brandA) };
    });
    // brand B's own profile misses its four columns
    expect(outcome).toEqual({
      submission: refused(CHECK_VIOLATION, "primary_sector"),
      a: { status: "draft", submitted: false },
    });
  });
});
