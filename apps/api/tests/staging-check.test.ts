// D70 commit 3 (docs/mvp/archives/jalons/d70-plan.md): the pure part of `staging:check`, without network —
// the closed list of the runbook, the names of `railway variables --json`, their comparison, the
// modes, leads.sync_settings (05 RG162), and the rule that no verdict ever carries a value.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CLOSED_LIST_BEGIN,
  CLOSED_LIST_END,
  closedListsOf,
  compareNames,
  envLocalIssues,
  EXPECTED_MODES,
  namesVerdict,
  RAILWAY_SERVICES,
  railwayVariablesOf,
  syncSettingsIssues,
  verdictLine,
  wrongModes,
} from "../scripts/staging-check-rules.ts";

const RUNBOOK = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../docs/mvp/runbooks/staging.md",
  ),
  "utf8",
);

function table(rows: string[]): string {
  return [
    CLOSED_LIST_BEGIN,
    "| Service | Exigées | Facultatives |",
    "|---|---|---|",
    ...rows,
    CLOSED_LIST_END,
  ].join("\n");
}

const FOUR_ROWS = [
  "| `api` | `INFLUX_ENV`, `PORT` | `BREVO_WEBHOOK_SECRET_PREVIOUS` (rotation) |",
  "| `worker` | `INFLUX_ENV`, `SYNC_MODE` | — |",
  "| `web` | `INFLUX_ENV` | — |",
  "| `backoffice` | `INFLUX_ENV` | — |",
];

describe("closedListsOf: the table of the runbook", () => {
  it("reads the required and optional names of each service", () => {
    const lists = closedListsOf(
      `intro \`NOT_IN_TABLE\`\n${table(FOUR_ROWS)}\nafter`,
    );
    expect(lists.api).toEqual({
      required: ["INFLUX_ENV", "PORT"],
      optional: ["BREVO_WEBHOOK_SECRET_PREVIOUS"],
    });
    expect(lists.worker.optional).toEqual([]);
  });

  it("refuses a runbook without the markers", () => {
    expect(() => closedListsOf(FOUR_ROWS.join("\n"))).toThrow(/no closed list/);
  });

  it("refuses a missing service", () => {
    expect(() => closedListsOf(table(FOUR_ROWS.slice(0, 3)))).toThrow(
      /no row for backoffice/,
    );
  });

  it("refuses a service listed twice", () => {
    expect(() =>
      closedListsOf(table([...FOUR_ROWS, FOUR_ROWS[0] ?? ""])),
    ).toThrow(/names api twice/);
  });

  it("refuses a name listed twice for one service", () => {
    const rows = [...FOUR_ROWS];
    rows[2] = "| `web` | `INFLUX_ENV` | `INFLUX_ENV` |";
    expect(() => closedListsOf(table(rows))).toThrow(
      /web names a variable twice/,
    );
  });

  it("refuses an unknown service", () => {
    expect(() =>
      closedListsOf(table([...FOUR_ROWS, "| `cron` | `INFLUX_ENV` | — |"])),
    ).toThrow(/unknown service: cron/);
  });
});

describe("the closed list of docs/mvp/runbooks/staging.md (D70)", () => {
  const lists = closedListsOf(RUNBOOK);

  it("has the four services, each with INFLUX_ENV", () => {
    for (const service of RAILWAY_SERVICES) {
      expect(lists[service].required, service).toContain("INFLUX_ENV");
    }
  });

  it("never lists a development list, nor the migration role (02 §12.4 point 2, CI-5)", () => {
    for (const service of RAILWAY_SERVICES) {
      const names = [...lists[service].required, ...lists[service].optional];
      for (const refused of [
        "BREVO_TEST_RECIPIENTS",
        "NON_PRODUCTION_RECIPIENT_ALLOWLIST",
        "DIRECT_DATABASE_URL",
        "INFLUX_STAGING_MIGRATION_URL",
      ]) {
        expect(names, `${service} ${refused}`).not.toContain(refused);
      }
    }
  });

  it("keeps each database variable on its one service (EC-20) and the webhook on api", () => {
    const api = lists.api.required;
    const worker = lists.worker.required;
    expect(api).toEqual(
      expect.arrayContaining([
        "DATABASE_URL",
        "AUTH_DATABASE_URL",
        "OPS_DATABASE_URL",
      ]),
    );
    expect(api).not.toContain("WORKER_DATABASE_URL");
    expect(worker).toEqual(
      expect.arrayContaining([
        "WORKER_DATABASE_URL",
        "PRIVACY_DATABASE_URL",
        "APOLLO_API_KEY",
      ]),
    );
    expect(worker).not.toContain("DATABASE_URL");
    expect(worker.some((name) => name.startsWith("BREVO_WEBHOOK_"))).toBe(
      false,
    );
    expect(api).toContain("BREVO_WEBHOOK_SECRET_CURRENT");
  });
});

describe("railwayVariablesOf: names, never values", () => {
  const json = JSON.stringify({
    SUPABASE_SECRET_KEY: "sb_secret_never_shown",
    INFLUX_ENV: "staging",
    BREVO_MODE: "redirect",
    RAILWAY_ENVIRONMENT_NAME: "staging",
    RAILWAY_GIT_COMMIT_SHA: "abc",
    RAILPACK_NODE_VERSION: "24",
  });

  it("keeps the sorted names, without the variables Railway adds", () => {
    expect(railwayVariablesOf(json).names).toEqual([
      "BREVO_MODE",
      "INFLUX_ENV",
      "RAILPACK_NODE_VERSION",
      "SUPABASE_SECRET_KEY",
    ]);
  });

  it("keeps the values of the three mode variables only", () => {
    expect(railwayVariablesOf(json).modes).toEqual({
      INFLUX_ENV: "staging",
      BREVO_MODE: "redirect",
    });
    expect(JSON.stringify(railwayVariablesOf(json))).not.toContain(
      "never_shown",
    );
  });

  it("does not quote the text when it is not JSON", () => {
    expect(() => railwayVariablesOf("SECRET=sb_secret_never_shown")).toThrow(
      /^the output of railway variables is not JSON$/,
    );
  });

  it("refuses JSON that is not an object", () => {
    expect(() => railwayVariablesOf('["INFLUX_ENV"]')).toThrow(
      /not a JSON object/,
    );
    expect(() => railwayVariablesOf("null")).toThrow(/not a JSON object/);
  });
});

describe("compareNames and namesVerdict", () => {
  const list = { required: ["A", "B"], optional: ["C"] };

  it("is OK when every required name is present, an optional one allowed", () => {
    expect(compareNames(list, ["A", "B", "C"])).toEqual({
      missing: [],
      unexpected: [],
    });
    expect(compareNames(list, ["A", "B"])).toEqual({
      missing: [],
      unexpected: [],
    });
  });

  it("names the missing and the unexpected names", () => {
    const comparison = compareNames(list, ["Z", "A", "D"]);
    expect(comparison).toEqual({ missing: ["B"], unexpected: ["D", "Z"] });
    expect(verdictLine(namesVerdict("worker", comparison))).toBe(
      "KO  railway worker: variable names equal the closed list of the runbook: missing B; unexpected D, Z",
    );
  });

  it("never prints a value, end to end", () => {
    const variables = railwayVariablesOf(
      JSON.stringify({
        A: "value-of-a",
        BREVO_TEST_RECIPIENTS: "tester@example.test",
      }),
    );
    const line = verdictLine(
      namesVerdict("api", compareNames(list, variables.names)),
    );
    expect(line).toContain("BREVO_TEST_RECIPIENTS");
    expect(line).not.toMatch(/value-of-a|tester@example\.test/);
  });

  it("prints OK alone when equal", () => {
    expect(
      verdictLine(namesVerdict("web", { missing: [], unexpected: [] })),
    ).toBe(
      "OK  railway web: variable names equal the closed list of the runbook",
    );
  });
});

describe("modes of D70", () => {
  it("names a mode variable absent or wrong, never its value", () => {
    expect(
      wrongModes(EXPECTED_MODES.worker, {
        INFLUX_ENV: "staging",
        BREVO_MODE: "live",
      }),
    ).toEqual(["SYNC_MODE"]);
    expect(
      wrongModes(EXPECTED_MODES.api, {
        INFLUX_ENV: "production",
        BREVO_MODE: "redirect",
      }),
    ).toEqual(["INFLUX_ENV", "BREVO_MODE"]);
    expect(
      wrongModes(EXPECTED_MODES.web, {
        INFLUX_ENV: "staging",
        SYNC_MODE: "dry_run",
      }),
    ).toEqual([]);
  });

  it(".env.local: staging, live, without the development lists", () => {
    const live = {
      INFLUX_ENV: "staging",
      BREVO_MODE: "live",
      SYNC_MODE: "live",
    };
    expect(envLocalIssues(live)).toEqual([]);
    expect(
      envLocalIssues({
        ...live,
        SYNC_MODE: "dry_run",
        BREVO_TEST_RECIPIENTS: "a@example.test",
        NON_PRODUCTION_RECIPIENT_ALLOWLIST: "",
      }),
    ).toEqual(["SYNC_MODE", "BREVO_TEST_RECIPIENTS"]);
    expect(envLocalIssues({})).toEqual([
      "INFLUX_ENV",
      "BREVO_MODE",
      "SYNC_MODE",
    ]);
  });
});

describe("syncSettingsIssues (05 RG162, D69)", () => {
  // The seed of 0103, the two list ids set.
  const complete = {
    apollo_scope: "annonceurs_et_createurs_pro",
    apollo_legal_basis: { default: "consentement_requis", by_country: {} },
    apollo_excluded_countries: [],
    retry_schedule: [0, 60, 300, 900, 3600, 10800, 21600, 43200, 86400, 86400],
    rate_limits: {
      brevo_contact_per_minute: 60,
      brevo_transactional_per_minute: 60,
      apollo_contact_per_minute: 20,
    },
    brevo_list_ids: { advertisers: 3, creators: 4 },
    brevo_template_ids: {},
  };

  it("is complete with the seed and the two lists, an empty country list valid (RG84)", () => {
    expect(syncSettingsIssues(complete, true)).toEqual([]);
  });

  it("names the lists of the seed, still null", () => {
    expect(
      syncSettingsIssues(
        { ...complete, brevo_list_ids: { advertisers: null, creators: 4 } },
        true,
      ),
    ).toEqual(["brevo_list_ids"]);
    expect(
      syncSettingsIssues({ ...complete, brevo_list_ids: undefined }, false),
    ).toEqual(["brevo_list_ids"]);
  });

  it("names an unreadable retry schedule and a missing rate limit", () => {
    expect(
      syncSettingsIssues(
        {
          ...complete,
          retry_schedule: [],
          rate_limits: { brevo_contact_per_minute: 60 },
        },
        false,
      ),
    ).toEqual(["retry_schedule", "rate_limits"]);
  });

  it("requires the Apollo rate and keys only when the worker has an Apollo key", () => {
    const withoutApollo = {
      ...complete,
      apollo_scope: "unknown",
      rate_limits: {
        brevo_contact_per_minute: 60,
        brevo_transactional_per_minute: 60,
      },
    };
    expect(syncSettingsIssues(withoutApollo, false)).toEqual([]);
    expect(syncSettingsIssues(withoutApollo, true)).toEqual([
      "rate_limits",
      "apollo_scope",
    ]);
  });
});
