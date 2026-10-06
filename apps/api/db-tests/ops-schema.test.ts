// The ops schema of D60 under influx_ops (docs/mvp/02 §20.5, 21 §4 J4 point 3; migration 0016):
// the upsert of an error group as apps/api writes it, the regression of a fixed group, the bounds
// of the metric minutes, and a role that writes without reading. Rights per table are in T2;
// this file checks the behaviour that T2's probes do not reach.
import { inRolledBackTransaction, probe, takeRole } from "@influx/test-kit/db";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";

/** The upsert of src/domains/ops/repository.ts, with its values bound (no `excluded.*` read). */
const UPSERT_GROUP = `
  insert into ops.error_groups
    (fingerprint, source, service, error_type, message, route, first_version, last_version)
  values (sha256(convert_to($1::text, 'UTF8')), 'server', 'api', 'TypeError', 'ops test',
          '/v1/status', $2, $2)
  on conflict (fingerprint) do update
     set occurrence_count = ops.error_groups.occurrence_count + 1, last_version = $2`;

const METRIC = (minute: string) => `
  insert into ops.request_metrics
    (minute, service, instance, method, route, request_count, server_error_count,
     throttled_count, duration_buckets)
  values (${minute}, 'api', 'ops-test', 'GET', '/v1/status', 2, 0, 0, '{2,0,0,0,0,0,0,0,0}')`;

let migration: postgres.Sql;
/** Keys of the groups written (committed) by this file: removed after the run. */
const RUN = `ops-test-${Date.now()}`;

beforeAll(async () => {
  migration = migrationRole();
  await testDataSet();
});

afterAll(async () => {
  await migration`delete from ops.error_groups where message = 'ops test'
                   and fingerprint in (select sha256(convert_to(k, 'UTF8'))
                                         from unnest(${[`${RUN}-count`, `${RUN}-regression`]}::text[]) k)`;
});

/** Runs `statements` as influx_ops, committed, as apps/api does (E-6). */
async function asOps(
  statements: readonly [string, readonly string[]][],
): Promise<void> {
  await loginRole("influx_ops_login").begin(async (tx) => {
    await takeRole(tx, "influx_ops");
    for (const [statement, parameters] of statements) {
      await tx.unsafe(statement, parameters as string[]);
    }
  });
}

type GroupRow = {
  status: string;
  occurrence_count: string;
  regression_count: number;
  last_version: string;
  regressed: boolean;
};

/** Read back by the migration role: influx_ops itself reads two columns only. */
async function groupOf(key: string): Promise<GroupRow | undefined> {
  const [row] = await migration<GroupRow[]>`
    select status::text, occurrence_count::text, regression_count, last_version,
           last_regressed_at is not null as regressed
      from ops.error_groups where fingerprint = sha256(convert_to(${key}::text, 'UTF8'))`;
  return row;
}

describe("error groups under influx_ops (02 §20.5)", () => {
  it("creates a group, then counts its occurrences and keeps the last version", async () => {
    const key = `${RUN}-count`;
    await asOps([
      [UPSERT_GROUP, [key, "v1"]],
      [UPSERT_GROUP, [key, "v2"]],
      [UPSERT_GROUP, [key, "v3"]],
    ]);
    expect(await groupOf(key)).toEqual({
      status: "new",
      occurrence_count: "3",
      regression_count: 0,
      last_version: "v3",
      regressed: false,
    });
  });

  it("reopens a fixed group as a regression on its next occurrence", async () => {
    const key = `${RUN}-regression`;
    await asOps([[UPSERT_GROUP, [key, "v1"]]]);
    await migration`update ops.error_groups set status = 'fixed'
                     where fingerprint = sha256(convert_to(${key}::text, 'UTF8'))`;
    await asOps([[UPSERT_GROUP, [key, "v2"]]]);
    expect(await groupOf(key)).toMatchObject({
      status: "new",
      occurrence_count: "2",
      regression_count: 1,
      last_version: "v2",
      regressed: true,
    });
  });

  it("never lets the count decrease nor the description change", async () => {
    const results = await inRolledBackTransaction(
      loginRole("influx_ops_login"),
      async (tx) => {
        await takeRole(tx, "influx_ops");
        await tx.unsafe(UPSERT_GROUP, ["ops-guard", "v1"]);
        return [
          await probe(
            tx,
            `update ops.error_groups set occurrence_count = 0
              where fingerprint = sha256(convert_to('ops-guard', 'UTF8'))`,
          ),
          await probe(tx, `update ops.error_groups set message = 'changed'`),
          await probe(tx, `update ops.error_groups set status = 'ignored'`),
        ];
      },
    );
    expect(results).toEqual([
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    ]);
  });
});

describe("influx_ops writes, and reads nothing it does not need", () => {
  it("records an occurrence it can never read back, delete, nor date itself", async () => {
    const results = await inRolledBackTransaction(
      loginRole("influx_ops_login"),
      async (tx) => {
        await takeRole(tx, "influx_ops");
        await tx.unsafe(UPSERT_GROUP, ["ops-occurrence", "v1"]);
        return [
          await probe(
            tx,
            `insert into ops.error_occurrences (group_fingerprint, service, version, message)
             values (sha256(convert_to('ops-occurrence', 'UTF8')), 'api', 'v1', 'ops test')`,
          ),
          await probe(tx, "select message from ops.error_occurrences"),
          await probe(tx, "delete from ops.error_occurrences"),
          await probe(
            tx,
            `insert into ops.error_occurrences
               (group_fingerprint, service, version, message, occurred_at)
             values (sha256(convert_to('ops-occurrence', 'UTF8')), 'api', 'v1', 'x',
                     now() - interval '1 day')`,
          ),
          await probe(tx, "select id from identity.accounts"),
          await probe(tx, "select id from audit.audit_events"),
        ];
      },
    );
    expect(results).toEqual([
      { outcome: "rows", count: 1 },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    ]);
  });

  it("refuses a browser user agent on a server occurrence", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_ops_login"),
      async (tx) => {
        await takeRole(tx, "influx_ops");
        await tx.unsafe(UPSERT_GROUP, ["ops-agent", "v1"]);
        return probe(
          tx,
          `insert into ops.error_occurrences
             (group_fingerprint, service, version, message, user_agent_summary)
           values (sha256(convert_to('ops-agent', 'UTF8')), 'api', 'v1', 'x', 'firefox.linux')`,
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });
});

describe("metric minutes (02 §20.5)", () => {
  it.each([
    [
      "the minute that just ended",
      "date_trunc('minute', now()) - interval '1 minute'",
      "rows",
    ],
    [
      "a minute of the last hour",
      "date_trunc('minute', now()) - interval '59 minutes'",
      "rows",
    ],
    [
      "the current, unfinished minute",
      "date_trunc('minute', now())",
      "refused",
    ],
    [
      "a future minute",
      "date_trunc('minute', now()) + interval '5 minutes'",
      "refused",
    ],
    [
      "a minute older than one hour",
      "date_trunc('minute', now()) - interval '2 hours'",
      "refused",
    ],
  ])("handles %s", async (_label, minute, expected) => {
    const result = await inRolledBackTransaction(
      loginRole("influx_ops_login"),
      async (tx) => {
        await takeRole(tx, "influx_ops");
        return probe(tx, METRIC(minute));
      },
    );
    expect(result).toEqual(
      expected === "rows"
        ? { outcome: "rows", count: 1 }
        : { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    );
  });

  it("refuses a histogram that does not add up to the request count", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_ops_login"),
      async (tx) => {
        await takeRole(tx, "influx_ops");
        return probe(
          tx,
          `insert into ops.request_metrics
             (minute, service, instance, method, route, request_count, server_error_count,
              throttled_count, duration_buckets)
           values (date_trunc('minute', now()) - interval '1 minute', 'api', 'ops-test', 'GET',
                   '/v1/status', 3, 0, 0, '{1,1,0,0,0,0,0,0,0}')`,
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });

  it("refuses an unaligned minute and a full URL as a route", async () => {
    const results = await inRolledBackTransaction(
      loginRole("influx_ops_login"),
      async (tx) => {
        await takeRole(tx, "influx_ops");
        return [
          await probe(
            tx,
            METRIC("date_trunc('minute', now()) - interval '90 seconds'"),
          ),
          await probe(
            tx,
            `insert into ops.request_metrics
               (minute, service, instance, method, route, request_count, server_error_count,
                throttled_count, duration_buckets)
             values (date_trunc('minute', now()) - interval '1 minute', 'api', 'ops-test', 'GET',
                     '/v1/status?email=a@example.test', 1, 0, 0, '{1,0,0,0,0,0,0,0,0}')`,
          ),
        ];
      },
    );
    expect(results).toEqual([
      { outcome: "error", code: CHECK_VIOLATION },
      { outcome: "error", code: CHECK_VIOLATION },
    ]);
  });
});
