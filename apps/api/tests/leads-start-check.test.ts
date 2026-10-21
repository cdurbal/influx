// 05 RG162 (D67, amended by D69): the settings every sign-up needs, judged by the worker at start
// (src/domains/leads/start-check.ts). A deployed environment refuses to start (CA85): the verdict
// names the settings and the rule, never a value (18 T17.9); in development the worker starts and
// names them (leads.settings.missing_at_start, the counter-test of CA85). The process half: worker.ts
// exits non-zero before its first turn when the verdict is false (TM1.13); a deployed configuration
// refuses the local database (D70 S1), so the refusal is proved here and on the start step of the
// local base (db-tests/tm1-configuration-failures). The same verdict is drawn by staging:check.
import { captureLogStream, valuesFoundIn } from "@influx/test-kit/logs";
import { beforeEach, describe, expect, it } from "vitest";
import type { OutboxDestination } from "../src/domains/leads/repository.ts";
import {
  checkSettingsAtStart,
  startSettingsIssues,
} from "../src/domains/leads/start-check.ts";
import { createLogger } from "../src/platform/logger.ts";

const LIST_ADVERTISERS = 731_904;
const LIST_CREATORS = 731_905;

/** The seed of 0103 with both lists set, the excluded countries of 0141 empty (RG84). */
const COMPLETE: Record<string, unknown> = {
  apollo_scope: "annonceurs_et_createurs_pro",
  apollo_legal_basis: { default: "consentement_requis", by_country: {} },
  apollo_excluded_countries: [],
  retry_schedule: [0, 60, 300, 900, 3600, 10800, 21600, 43200, 86400, 86400],
  rate_limits: {
    brevo_contact_per_minute: 60,
    brevo_transactional_per_minute: 60,
    apollo_contact_per_minute: 20,
  },
  brevo_list_ids: { advertisers: LIST_ADVERTISERS, creators: LIST_CREATORS },
  brevo_template_ids: {},
};

const BREVO: OutboxDestination[] = ["brevo_contact", "brevo_transactional"];
const ALL: OutboxDestination[] = [...BREVO, "apollo_contact"];

let capture: ReturnType<typeof captureLogStream>;

beforeEach(() => {
  capture = captureLogStream();
});

function logger() {
  return createLogger(
    { service: "worker", environment: "staging", version: "test" },
    capture.destination,
  );
}

type LogLine = Record<string, unknown> & { msg: string; level: string };

function logLines(): LogLine[] {
  return capture.lines().map((line) => JSON.parse(line) as LogLine);
}

describe("05 RG162: the settings every sign-up needs", () => {
  it("is complete with the seed and the two lists; an empty list of excluded countries is valid (RG84)", () => {
    expect(startSettingsIssues(COMPLETE, ALL)).toEqual([]);
  });

  it("names each list of a role by its path, a null as an absent key or row (CA85)", () => {
    expect(
      startSettingsIssues(
        {
          ...COMPLETE,
          brevo_list_ids: { advertisers: LIST_ADVERTISERS, creators: null },
        },
        BREVO,
      ),
    ).toEqual(["brevo_list_ids.creators"]);
    expect(
      startSettingsIssues({ ...COMPLETE, brevo_list_ids: {} }, BREVO),
    ).toEqual(["brevo_list_ids.advertisers", "brevo_list_ids.creators"]);
    expect(
      startSettingsIssues({ ...COMPLETE, brevo_list_ids: undefined }, BREVO),
    ).toEqual(["brevo_list_ids.advertisers", "brevo_list_ids.creators"]);
    // never a value read as an id: zero, a decimal, a text
    expect(
      startSettingsIssues(
        { ...COMPLETE, brevo_list_ids: { advertisers: 0, creators: "4" } },
        BREVO,
      ),
    ).toEqual(["brevo_list_ids.advertisers", "brevo_list_ids.creators"]);
  });

  it("D69: no template is required, the empty brevo_template_ids is complete", () => {
    expect(
      startSettingsIssues({ ...COMPLETE, brevo_template_ids: {} }, ALL),
    ).toEqual([]);
    expect(
      startSettingsIssues({ ...COMPLETE, brevo_template_ids: undefined }, ALL),
    ).toEqual([]);
  });

  it("requires a readable retry_schedule, and a rate limit for each destination with a key", () => {
    expect(
      startSettingsIssues(
        {
          ...COMPLETE,
          retry_schedule: [],
          rate_limits: { brevo_contact_per_minute: 60 },
        },
        ALL,
      ),
    ).toEqual([
      "retry_schedule",
      "rate_limits.brevo_transactional_per_minute",
      "rate_limits.apollo_contact_per_minute",
    ]);
    // without a key, a destination needs no rate limit
    expect(
      startSettingsIssues(
        { ...COMPLETE, rate_limits: { brevo_contact_per_minute: 60 } },
        ["brevo_contact"],
      ),
    ).toEqual([]);
  });

  it("checks the three Apollo keys only when the worker holds an Apollo key (TM1.13)", () => {
    const unreadable = {
      ...COMPLETE,
      apollo_scope: "everyone",
      apollo_legal_basis: { default: "unknown", by_country: {} },
      apollo_excluded_countries: ["fr"],
    };
    expect(startSettingsIssues(unreadable, BREVO)).toEqual([]);
    expect(startSettingsIssues(unreadable, ALL)).toEqual([
      "apollo_scope",
      "apollo_legal_basis",
      "apollo_excluded_countries",
    ]);
  });
});

describe("05 RG162, CA85: the verdict at start", () => {
  const missing = {
    ...COMPLETE,
    brevo_list_ids: { advertisers: LIST_ADVERTISERS, creators: null },
  };

  it("deployed: refuses, a fatal line naming the setting and the rule, never a value", () => {
    expect(checkSettingsAtStart(missing, ALL, true, logger())).toBe(false);
    const [line] = logLines();
    expect(line).toMatchObject({
      level: "fatal",
      settings: ["brevo_list_ids.creators"],
      rule: "05 RG162",
    });
    expect(line?.msg).toContain("refusing to start");
    expect(line?.msg).toContain("brevo_list_ids.creators");
    expect(valuesFoundIn(capture.text(), [String(LIST_ADVERTISERS)])).toEqual(
      [],
    );
  });

  it("development: starts, with the line leads.settings.missing_at_start naming the settings (counter-test)", () => {
    expect(checkSettingsAtStart(missing, ALL, false, logger())).toBe(true);
    expect(logLines()).toEqual([
      expect.objectContaining({
        level: "error",
        msg: "leads.settings.missing_at_start",
        settings: ["brevo_list_ids.creators"],
      }),
    ]);
  });

  it("complete: starts, and logs nothing", () => {
    expect(checkSettingsAtStart(COMPLETE, ALL, true, logger())).toBe(true);
    expect(logLines()).toEqual([]);
  });
});
