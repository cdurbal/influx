// TM9 (J9, commit 8) — the active monitoring of D60, the database half (migration 0147; 02 §11.3,
// §20.5, §20.8; 15 RG165): the heartbeat of the worker and what the api reads of it, the probe, the
// samples of the base, the states of the alerts under the lock of their scope, the catalogue
// AL49 to AL63, the snapshot of the evaluator, the admin recipients, the hourly roll-up and the
// purges of ops_retention, and the bounds of E-6 and 02 §20.8.
//
// Each case runs in ONE rolled-back transaction of the local superuser, the functions under the
// session_user / current_user pair of apps/api (actAs, support.ts). Fixtures dated in the past are
// written by the superuser (the policies of the owner refuse them, by design). Measures that other
// files may have fed with committed lines are read as differences inside the same transaction.
import {
  DUAL_CONTROL_REQUEST_ID,
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type ProbeResult,
} from "@influx/test-kit/db";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  localSuperuser,
  loginRole,
  migrationRole,
  testDataSet,
  type Actor,
} from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const CHECK_VIOLATION = "23514";
const NOT_IN_PREREQUISITE_STATE = "55000";

/** Letters and digits: an instance, a route and a subject key of this run. */
const RUN = randomUUID().replace(/-/g, "").slice(0, 12);
const INSTANCE = `tm9-${RUN}`;

let dataSet: DataSet;

beforeAll(async () => {
  dataSet = await testDataSet();
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function as(
  tx: postgres.TransactionSql,
  actor: Actor,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<ProbeResult> {
  return actAs(tx, actor, () => probe(tx, statement, parameters));
}

async function dbNow(tx: postgres.TransactionSql): Promise<Date> {
  const [row] = await tx<{ now: Date }[]>`select now() as now`;
  if (row === undefined) {
    throw new Error("no clock");
  }
  return row.now;
}

function iso(date: Date, offsetMs = 0): string {
  return new Date(date.getTime() + offsetMs).toISOString();
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// ---------------------------------------------------------------------------------------------
// The snapshot of the evaluator
// ---------------------------------------------------------------------------------------------

type Snapshot = {
  now: string;
  definitions: Record<
    string,
    {
      nature: string;
      threshold: Record<string, unknown>;
      recipient_roles: string[];
      is_active: boolean;
    }
  >;
  measures: Record<string, Record<string, unknown>>;
};

async function snapshot(
  tx: postgres.TransactionSql,
  since = "now() - interval '1 minute'",
): Promise<Snapshot> {
  return actAs(tx, "worker", async () => {
    const [row] = await tx.unsafe<{ s: Snapshot }[]>(
      `select ops.technical_alert_snapshot(${since}) as s`,
    );
    if (row === undefined) {
      throw new Error("no snapshot");
    }
    return row.s;
  });
}

function measureOf<T>(s: Snapshot, code: string): T {
  return s.measures[code] as T;
}

// ---------------------------------------------------------------------------------------------

describe("the heartbeat of the worker (02 §11.3)", () => {
  it("inserts a process with its beat and its last turn at the transaction time", async () => {
    const row = await scenario(async (tx) => {
      const started = iso(await dbNow(tx), -HOUR);
      await actAs(
        tx,
        "worker",
        () =>
          tx`select ops.record_worker_heartbeat(${`worker-${RUN}`}, ${INSTANCE}, 'local',
                      ${started}::timestamptz, false)`,
      );
      const [line] = await tx<
        { beat_now: boolean; turn_now: boolean; started_kept: boolean }[]
      >`
        select beat_at = now() as beat_now, loop_turn_at = now() as turn_now,
               started_at = ${started}::timestamptz as started_kept
          from ops.worker_heartbeats where worker_id = ${`worker-${RUN}`}`;
      return line;
    });
    expect(row).toEqual({ beat_now: true, turn_now: true, started_kept: true });
  });

  it("moves the beat at each call, the last turn only when the loop turned", async () => {
    const result = await scenario(async (tx) => {
      const worker = `worker-${RUN}-b`;
      await tx`
        insert into ops.worker_heartbeats
          (worker_id, instance, version, started_at, beat_at, loop_turn_at)
        values (${worker}, ${INSTANCE}, 'local', now() - interval '1 hour',
                now() - interval '30 seconds', now() - interval '30 seconds')`;
      const read = async () => {
        const [line] = await tx<{ beat_now: boolean; turn_now: boolean }[]>`
          select beat_at = now() as beat_now, loop_turn_at = now() as turn_now
            from ops.worker_heartbeats where worker_id = ${worker}`;
        return line;
      };
      // read by the superuser: influx_worker has no right on the table, only on the function
      const [process] = await tx<{ started: string }[]>`
        select to_char(started_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as started
          from ops.worker_heartbeats where worker_id = ${worker}`;
      const beat = (turned: boolean) =>
        actAs(
          tx,
          "worker",
          () =>
            tx`select ops.record_worker_heartbeat(${worker}, ${INSTANCE}, 'local',
                        ${process?.started ?? ""}::text::timestamptz, ${turned})`,
        );
      await beat(false);
      const during = await read();
      await beat(true);
      return { during, after: await read() };
    });
    expect(result.during).toEqual({ beat_now: true, turn_now: false });
    expect(result.after).toEqual({ beat_now: true, turn_now: true });
  });

  it.each([
    [
      "another process under the same id",
      `select ops.record_worker_heartbeat('worker-${RUN}-c', '${INSTANCE}', 'other-version', now(), true)`,
    ],
    [
      "a malformed worker id",
      `select ops.record_worker_heartbeat('-worker@x', '${INSTANCE}', 'local', now(), true)`,
    ],
    [
      "a start in the future",
      `select ops.record_worker_heartbeat('worker-${RUN}-d', '${INSTANCE}', 'local', now() + interval '1 hour', true)`,
    ],
  ])("refuses %s (22023)", async (_label, statement) => {
    const result = await scenario(async (tx) => {
      await tx`
        insert into ops.worker_heartbeats (worker_id, instance, version, started_at)
        values (${`worker-${RUN}-c`}, ${INSTANCE}, 'local', now() - interval '1 hour')`;
      return as(tx, "worker", statement);
    });
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("gives the api the last beat and AL50, and nothing to the worker", async () => {
    const result = await scenario(async (tx) => {
      await actAs(
        tx,
        "worker",
        () =>
          tx`select ops.record_worker_heartbeat(${`worker-${RUN}-e`}, ${INSTANCE}, 'local',
                      now() - interval '1 minute', true)`,
      );
      const liveness = await actAs(tx, "ops", async () => {
        const [row] = await tx<{ l: Record<string, unknown> }[]>`
          select ops.worker_liveness() as l`;
        return row?.l;
      });
      const [clock] = await tx<{ now: string }[]>`
        select to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as now`;
      return {
        liveness,
        now: clock?.now,
        byWorker: await as(tx, "worker", "select ops.worker_liveness()"),
      };
    });
    expect(result.liveness).toEqual({
      now: result.now,
      last_beat_at: result.now,
      last_loop_turn_at: result.now,
      definition: {
        nature: "etat",
        threshold: { heartbeat_max_age_seconds: 60 },
        recipient_roles: ["on_call"],
        is_active: true,
      },
    });
    expect(result.byWorker).toEqual({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe("the results of the probe (02 §20.5)", () => {
  function result(
    now: Date,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      target: "web_home_fr",
      checked_at: iso(now, -5_000),
      outcome: "up",
      status_code: 200,
      failure_code: null,
      duration_ms: 180,
      ...overrides,
    };
  }

  async function record(
    tx: postgres.TransactionSql,
    results: unknown,
  ): Promise<ProbeResult> {
    return as(
      tx,
      "worker",
      "select ops.record_probe_results($1, $2::text::jsonb)",
      [INSTANCE, JSON.stringify(results)],
    );
  }

  it("writes the results of the last hour, once, and returns how many it wrote", async () => {
    const outcome = await scenario(async (tx) => {
      const now = await dbNow(tx);
      const batch = [
        result(now),
        result(now, {
          target: "api_health",
          outcome: "down",
          status_code: null,
          failure_code: "timeout",
          duration_ms: 10_000,
        }),
        result(now, {
          target: "backoffice_sign_in",
          checked_at: iso(now, -50 * MINUTE),
          outcome: "down",
          status_code: 302,
          failure_code: "redirect",
        }),
      ];
      const written = async () =>
        actAs(tx, "worker", async () => {
          const [row] = await tx<{ n: number }[]>`
            select ops.record_probe_results(${INSTANCE}, ${JSON.stringify(batch)}::text::jsonb)::int as n`;
          return row?.n;
        });
      const first = await written();
      const again = await written();
      const [stored] = await tx<{ n: number }[]>`
        select count(*)::int as n from ops.probe_results where instance = ${INSTANCE}`;
      return { first, again, stored: stored?.n };
    });
    expect(outcome).toEqual({ first: 3, again: 0, stored: 3 });
  });

  it.each([
    ["a result older than an hour", { checked_at: "-61m" }],
    ["a result in the future", { checked_at: "+2m" }],
    ["an unknown target", { target: "https://influx.example/fr" }],
    ["an up result with a failure code", { failure_code: "status" }],
    ["a down result without a failure code", { outcome: "down" }],
    ["an unknown key", { url: "https://influx.example/fr" }],
    ["a negative duration", { duration_ms: -1 }],
  ] as const)(
    "refuses %s, and writes none of the batch (22023)",
    async (_label, change) => {
      const outcome = await scenario(async (tx) => {
        const now = await dbNow(tx);
        const overrides: Record<string, unknown> = { ...change };
        if ("checked_at" in change) {
          overrides.checked_at = iso(
            now,
            change.checked_at === "-61m" ? -61 * MINUTE : 2 * MINUTE,
          );
        }
        const attempt = await record(tx, [
          result(now, { target: "web_home_en" }),
          result(now, overrides),
        ]);
        const [stored] = await tx<{ n: number }[]>`
        select count(*)::int as n from ops.probe_results where instance = ${INSTANCE}`;
        return { attempt, stored: stored?.n };
      });
      expect(outcome).toEqual({
        attempt: { outcome: "error", code: INVALID_PARAMETER },
        stored: 0,
      });
    },
  );

  it("refuses more than 500 results in one call (22023)", async () => {
    const attempt = await scenario(async (tx) => {
      const now = await dbNow(tx);
      return record(
        tx,
        Array.from({ length: 501 }, (_, index) =>
          result(now, { checked_at: iso(now, -index * 1_000) }),
        ),
      );
    });
    expect(attempt).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });
});

// ---------------------------------------------------------------------------------------------

describe("the samples of the base (AL58)", () => {
  it("writes one line for the current minute, read by the function itself", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`delete from ops.database_samples where minute = date_trunc('minute', now(), 'UTC')`;
      for (let index = 0; index < 2; index += 1) {
        await actAs(
          tx,
          "worker",
          () => tx`select ops.record_database_sample()`,
        );
      }
      return tx<{ connections: number; max_connections: number }[]>`
        select connections, max_connections from ops.database_samples
         where minute = date_trunc('minute', now(), 'UTC')`;
    });
    expect(outcome).toHaveLength(1);
    const [line] = outcome;
    expect(line?.connections).toBeGreaterThanOrEqual(1);
    expect(line?.max_connections).toBeGreaterThanOrEqual(
      line?.connections ?? 0,
    );
  });
});

// ---------------------------------------------------------------------------------------------

describe("the states of the alerts, under the lock of their scope (15 RG165)", () => {
  function state(
    now: Date,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      code: "AL52",
      subject_key: "",
      state: "open",
      opened_at: iso(now, -10 * MINUTE),
      last_notified_at: iso(now, -10 * MINUTE),
      notified_count: 1,
      resolved_at: null,
      last_value: { requests: 120, shareBp: 250 },
      ...overrides,
    };
  }

  it("gives the round to one transaction at a time: null to a concurrent one", async () => {
    const outcome = await scenario(async (tx) => {
      const first = await actAs(tx, "worker", async () => {
        const [row] = await tx<
          { s: unknown }[]
        >`select ops.begin_alert_round('worker') as s`;
        return row?.s;
      });
      const second = await inRolledBackTransaction(
        loginRole("influx_worker_login"),
        async (other) => {
          await takeRole(other, "influx_worker");
          const [row] = await other<{ s: unknown }[]>`
            select ops.begin_alert_round('worker') as s`;
          return row?.s;
        },
      );
      // the scope api is another lock: free
      const api = await inRolledBackTransaction(
        loginRole("influx_ops_login"),
        async (other) => {
          await takeRole(other, "influx_ops");
          const [row] = await other<{ s: unknown }[]>`
            select ops.begin_alert_round('api') as s`;
          return row?.s;
        },
      );
      return { first, second, api };
    });
    expect(Array.isArray(outcome.first)).toBe(true);
    expect(outcome.second).toBeNull();
    expect(Array.isArray(outcome.api)).toBe(true);
  });

  it("refuses to save without the round of the scope open in the transaction (55000)", async () => {
    const outcome = await scenario((tx) =>
      as(tx, "worker", "select ops.save_alert_states('worker', '[]'::jsonb)"),
    );
    expect(outcome).toEqual({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
    });
  });

  it.each([
    ["the worker", "worker", "select ops.begin_alert_round('api')"],
    [
      "the worker",
      "worker",
      "select ops.save_alert_states('api', '[]'::jsonb)",
    ],
    ["the api", "ops", "select ops.begin_alert_round('worker')"],
    ["the api", "ops", "select ops.save_alert_states('worker', '[]'::jsonb)"],
    ["influx_auth", "auth", "select ops.begin_alert_round('api')"],
  ] as const)(
    "refuses %s the scope of another (%s: 42501)",
    async (_label, actor, statement) => {
      const outcome = await scenario((tx) => as(tx, actor, statement));
      expect(outcome).toEqual({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    },
  );

  it("keeps the states it is given and gives back the open ones and those resolved within 24 hours", async () => {
    const outcome = await scenario(async (tx) => {
      const now = await dbNow(tx);
      const seenUntil = "2026-10-21T10:00:00.123456Z";
      const states = [
        state(now, {
          code: "AL51",
          subject_key: "watermark",
          last_notified_at: null,
          notified_count: 0,
          last_value: { seenUntil },
        }),
        state(now, {
          subject_key: `tm9-${RUN}`,
          state: "resolved",
          resolved_at: iso(now, -HOUR),
        }),
        state(now, {
          code: "AL53",
          subject_key: `tm9-${RUN}`,
          opened_at: iso(now, -2 * DAY),
          last_notified_at: iso(now, -2 * DAY),
          state: "resolved",
          resolved_at: iso(now, -25 * HOUR),
        }),
      ];
      return actAs(tx, "worker", async () => {
        await tx`select ops.begin_alert_round('worker')`;
        const [saved] = await tx<{ n: number }[]>`
          select ops.save_alert_states('worker', ${JSON.stringify(states)}::text::jsonb) as n`;
        const [round] = await tx<{ s: Record<string, unknown>[] }[]>`
          select ops.begin_alert_round('worker') as s`;
        return { saved: saved?.n, round: round?.s ?? [], seenUntil };
      });
    });
    expect(outcome.saved).toBe(3);
    const mine = outcome.round.filter(
      (item) =>
        item.subject_key === "watermark" || item.subject_key === `tm9-${RUN}`,
    );
    expect(
      mine.map((item) => `${String(item.code)}:${String(item.state)}`),
    ).toEqual(["AL51:open", "AL52:resolved"]);
    expect(mine[0]).toMatchObject({
      code: "AL51",
      subject_key: "watermark",
      notified_count: 0,
      last_notified_at: null,
      resolved_at: null,
      last_value: { seenUntil: outcome.seenUntil },
    });
    expect(String(mine[1]?.resolved_at)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/,
    );
  });

  it.each([
    ["AL50 outside the scope api", { code: "AL50" }],
    ["an unknown code", { code: "AL999" }],
    ["an address as a subject", { subject_key: "anne@example.test" }],
    ["an address in the value", { last_value: { to: "anne@example.test" } }],
    ["a nested value", { last_value: { detail: { requests: 1 } } }],
    [
      "free text in the value",
      { last_value: { message: "Cannot read properties" } },
    ],
    ["a notification count without its instant", { last_notified_at: null }],
    ["an instant an hour ahead", { opened_at: "+1h" }],
    ["an unknown key", { url: "/v1/status" }],
  ] as const)(
    "refuses %s, and keeps none of the batch (22023)",
    async (_label, change) => {
      const outcome = await scenario(async (tx) => {
        const now = await dbNow(tx);
        const overrides: Record<string, unknown> = { ...change };
        if ("opened_at" in change) {
          overrides.opened_at = iso(now, HOUR);
        }
        const states = [
          state(now, { subject_key: `tm9-${RUN}-ok` }),
          state(now, { subject_key: `tm9-${RUN}`, ...overrides }),
        ];
        const attempt = await actAs(tx, "worker", async () => {
          await tx`select ops.begin_alert_round('worker')`;
          return probe(
            tx,
            "select ops.save_alert_states('worker', $1::text::jsonb)",
            [JSON.stringify(states)],
          );
        });
        const [kept] = await tx<{ n: number }[]>`
        select count(*)::int as n from ops.alert_states where subject_key like ${`tm9-${RUN}%`}`;
        return { attempt, kept: kept?.n };
      });
      expect(outcome).toEqual({
        attempt: { outcome: "error", code: INVALID_PARAMETER },
        kept: 0,
      });
    },
  );

  it("lets the api keep AL50 in its own scope", async () => {
    const outcome = await scenario(async (tx) => {
      const now = await dbNow(tx);
      return actAs(tx, "ops", async () => {
        await tx`select ops.begin_alert_round('api')`;
        const [saved] = await tx<{ n: number }[]>`
          select ops.save_alert_states('api', ${JSON.stringify([
            state(now, {
              code: "AL50",
              last_value: {
                lastBeatAt: iso(now, -2 * MINUTE),
                ageSeconds: 120,
              },
            }),
          ])}::text::jsonb) as n`;
        return saved?.n;
      });
    });
    expect(outcome).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------

describe("the catalogue of the technical alerts (15 RG165, EC-J9-4)", () => {
  it("loads AL49 to AL63 with their thresholds, natures and recipients", async () => {
    const rows = await migrationRole()<
      {
        code: string;
        nature: string;
        threshold_value: Record<string, unknown>;
        recipient_roles: string[];
      }[]
    >`
      select code, nature::text, threshold_value, recipient_roles
        from backoffice.alert_definitions
       where code in ('AL48', 'AL49', 'AL50', 'AL51', 'AL53', 'AL59', 'AL60', 'AL62', 'AL63')
       order by code`;
    const byCode = Object.fromEntries(rows.map((row) => [row.code, row]));
    expect(Object.keys(byCode)).toHaveLength(9);
    expect(byCode.AL48?.threshold_value).toMatchObject({
      window_minutes: 60,
      median_delivery_seconds_max: 60,
    });
    expect(byCode.AL49).toMatchObject({
      nature: "etat",
      threshold_value: { consecutive_failures: 2, probe_interval_seconds: 60 },
      recipient_roles: ["on_call"],
    });
    expect(byCode.AL50?.recipient_roles).toEqual(["on_call"]);
    expect(byCode.AL51).toMatchObject({
      nature: "evenement",
      threshold_value: {
        burn_in_until: null,
        digest_hour_utc: 7,
        digest_window_hours: 24,
      },
    });
    expect(byCode.AL53?.threshold_value).toEqual({
      window_minutes: 10,
      p95_max_ms: 1000,
      excluded_routes: ["POST /v1/auth/request-code"],
      request_code_p95_max_ms: null,
    });
    expect(byCode.AL59?.recipient_roles).toEqual(["on_call", "admin"]);
    expect(byCode.AL60?.threshold_value).toEqual({
      realign_failed_min: 1,
      breaker_counts: ["breaker_orphan_ratio", "breaker_filter_refused"],
    });
    expect(byCode.AL62?.nature).toBe("evenement");
    expect(byCode.AL63?.recipient_roles).toEqual(["admin", "on_call"]);
  });

  it.each([
    [
      "AL50 sent to the admins too",
      "update backoffice.alert_definitions set recipient_roles = '{on_call,admin}' where code = 'AL50'",
    ],
    [
      "AL50 sent to the admins instead",
      "update backoffice.alert_definitions set recipient_roles = '{admin}' where code = 'AL50'",
    ],
    [
      "an alert without recipient",
      "update backoffice.alert_definitions set recipient_roles = '{}' where code = 'AL52'",
    ],
    [
      "an unknown recipient",
      "update backoffice.alert_definitions set recipient_roles = '{on_call,pager}' where code = 'AL52'",
    ],
  ])("refuses %s, even to the superuser (23514)", async (_label, statement) => {
    expect(await scenario((tx) => probe(tx, statement))).toEqual({
      outcome: "error",
      code: CHECK_VIOLATION,
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe("ops.technical_alert_snapshot() (15 RG165): measures, no comparison, no address", () => {
  it("lists the new server groups and the regressions of the window, never a browser group", async () => {
    const outcome = await scenario(async (tx) => {
      const group = async (
        label: string,
        source: "server" | "browser",
        firstSeen: string,
        regressed: string | null,
      ) => {
        const [row] = await tx<{ id: string }[]>`
          insert into ops.error_groups
            (fingerprint, source, service, error_type, message, route, first_version,
             last_version, first_seen_at, last_seen_at, last_regressed_at, regression_count)
          values (sha256(convert_to(${`${RUN}-${label}`}, 'UTF8')), ${source}::ops.error_source,
                  ${source === "server" ? "api" : "web"}::ops.service_name, 'TypeError',
                  'tm9 group', ${source === "server" ? `/v1/tm9/${label}` : `/fr/tm9/${label}`},
                  'local', 'local', now() - ${firstSeen}::interval,
                  greatest(now() - ${firstSeen}::interval, now() - interval '30 seconds'),
                  now() - ${regressed}::interval,
                  case when ${regressed}::text is null then 0 else 1 end)
          returning id::text`;
        return row?.id ?? "";
      };
      const ids = {
        fresh: await group("fresh", "server", "30 seconds", null),
        browser: await group("browser", "browser", "30 seconds", null),
        old: await group("old", "server", "5 minutes", null),
        unsettled: await group("unsettled", "server", "2 seconds", null),
        regressed: await group("regressed", "server", "2 days", "30 seconds"),
      };
      const s = await snapshot(tx);
      return {
        ids,
        al51: measureOf<{
          new_groups: {
            id: string;
            error_type: string;
            route: string | null;
            first_seen_at: string;
          }[];
          regressions: { id: string; last_regressed_at: string }[];
        }>(s, "AL51"),
      };
    });
    const newIds = outcome.al51.new_groups.map((group) => group.id);
    expect(newIds).toContain(outcome.ids.fresh);
    expect(newIds).not.toContain(outcome.ids.browser);
    expect(newIds).not.toContain(outcome.ids.old);
    // written less than 10 seconds ago: the next round sees it (a transaction may still be open)
    expect(newIds).not.toContain(outcome.ids.unsettled);
    expect(newIds).not.toContain(outcome.ids.regressed);
    expect(
      outcome.al51.new_groups.find((group) => group.id === outcome.ids.fresh),
    ).toMatchObject({
      error_type: "TypeError",
      route: "/v1/tm9/fresh",
    });
    expect(outcome.al51.regressions.map((group) => group.id)).toContain(
      outcome.ids.regressed,
    );
  });

  it("adds up the minutes of the api in each window, the excluded route out of the histogram (AL52, AL53, AL55, AL56)", async () => {
    const outcome = await scenario(async (tx) => {
      const before = await snapshot(tx);
      const metric = (
        minutesAgo: number,
        service: "api" | "worker",
        method: string,
        route: string,
        counts: [number, number, number],
        buckets: number[],
      ) => tx`
        insert into ops.request_metrics
          (minute, service, instance, method, route, request_count, server_error_count,
           throttled_count, duration_buckets)
        values (date_trunc('minute', now(), 'UTC') - make_interval(mins => ${minutesAgo}),
                ${service}::ops.service_name, ${INSTANCE}, ${method}, ${route}, ${counts[0]},
                ${counts[1]}, ${counts[2]}, ${`{${buckets.join(",")}}`}::integer[])`;
      await metric(
        2,
        "api",
        "GET",
        "/v1/status",
        [100, 3, 4],
        [90, 5, 5, 0, 0, 0, 0, 0, 0],
      );
      await metric(
        2,
        "api",
        "POST",
        "/v1/auth/request-code",
        [10, 0, 0],
        [0, 0, 0, 0, 0, 10, 0, 0, 0],
      );
      await metric(
        2,
        "worker",
        "GET",
        "/v1/status",
        [50, 50, 0],
        [50, 0, 0, 0, 0, 0, 0, 0, 0],
      );
      await metric(
        30,
        "api",
        "GET",
        "/v1/status",
        [1000, 1000, 1000],
        [0, 0, 0, 0, 0, 0, 0, 0, 1000],
      );
      const after = await snapshot(tx);
      return { before, after };
    });
    const delta = (code: string, key: string) =>
      Number(outcome.after.measures[code]?.[key]) -
      Number(outcome.before.measures[code]?.[key]);
    expect(delta("AL52", "requests")).toBe(110);
    expect(delta("AL52", "server_errors")).toBe(3);
    expect(delta("AL56", "requests")).toBe(110);
    expect(delta("AL56", "throttled")).toBe(4);
    expect(delta("AL55", "calls_per_minute")).toBeCloseTo(22, 2);
    const buckets = (s: Snapshot) =>
      measureOf<{ buckets: number[] }>(s, "AL53").buckets;
    expect(
      buckets(outcome.after).map(
        (count, index) => count - (buckets(outcome.before)[index] ?? 0),
      ),
    ).toEqual([90, 5, 5, 0, 0, 0, 0, 0, 0]);
  });

  // 02 §20.12 (testeur, J9 commit 10): two instances of the api on the same minute and route
  // (Railway replicas) — the evaluator judges their sum, never one instance's histogram.
  it("adds the histograms of two instances on the same minute and route, never one of them (AL52, AL53)", async () => {
    const outcome = await scenario(async (tx) => {
      const before = await snapshot(tx);
      for (const [instance, counts, buckets] of [
        [`${INSTANCE}a`, [40, 1, 0], [0, 0, 0, 0, 40, 0, 0, 0, 0]],
        [`${INSTANCE}b`, [60, 0, 2], [0, 0, 0, 0, 0, 0, 60, 0, 0]],
      ] as const) {
        await tx`
          insert into ops.request_metrics
            (minute, service, instance, method, route, request_count, server_error_count,
             throttled_count, duration_buckets)
          values (date_trunc('minute', now(), 'UTC') - interval '2 minutes', 'api', ${instance},
                  'GET', ${`/v1/tm9/${RUN}`}, ${counts[0]}, ${counts[1]}, ${counts[2]},
                  ${`{${buckets.join(",")}}`}::integer[])`;
      }
      const after = await snapshot(tx);
      return { before, after };
    });
    const delta = (code: string, key: string) =>
      Number(outcome.after.measures[code]?.[key]) -
      Number(outcome.before.measures[code]?.[key]);
    expect(delta("AL52", "requests")).toBe(100);
    expect(delta("AL52", "server_errors")).toBe(1);
    expect(delta("AL56", "throttled")).toBe(2);
    const buckets = (s: Snapshot) =>
      measureOf<{ buckets: number[] }>(s, "AL53").buckets;
    expect(
      buckets(outcome.after).map(
        (count, index) => count - (buckets(outcome.before)[index] ?? 0),
      ),
    ).toEqual([0, 0, 0, 0, 40, 0, 60, 0, 0]);
  });

  it("names the targeted addresses by an opaque key, never the address (AL59)", async () => {
    const outcome = await scenario(async (tx) => {
      const targeted = createHash("sha256").update(`tm9-a-${RUN}`).digest();
      const below = createHash("sha256").update(`tm9-b-${RUN}`).digest();
      const tally = (key: Buffer, hoursAgo: number, failures: number) => tx`
        insert into identity.code_failure_tallies (key_hash, hour, failure_count)
        values (${key}, date_trunc('hour', now(), 'UTC') - make_interval(hours => ${hoursAgo}),
                ${failures})`;
      await tally(targeted, 0, 20);
      await tally(targeted, 3, 10);
      await tally(targeted, 30, 100);
      await tally(below, 0, 24);
      return {
        targeted: targeted.subarray(0, 8).toString("hex"),
        below: below.subarray(0, 8).toString("hex"),
        s: await snapshot(tx),
      };
    });
    const targets = measureOf<{ targets: { key: string; failures: number }[] }>(
      outcome.s,
      "AL59",
    ).targets;
    expect(targets).toContainEqual({ key: outcome.targeted, failures: 30 });
    expect(targets.map((target) => target.key)).not.toContain(outcome.below);
    for (const target of targets) {
      expect(target.key).toMatch(/^[0-9a-f]{16}$/);
    }
    expect(JSON.stringify(outcome.s.measures)).not.toContain("@");
  });

  it("lists the executed requests left open past their delay (AL63)", async () => {
    const outcome = await scenario(async (tx) => {
      const advertiser = dataSet.accounts.advertiser.a.id;
      const [request] = await tx<{ id: string }[]>`
        select id::text from backoffice.data_subject_requests
         where requester_account_id = ${advertiser} and request_type = 'access'
         order by received_at limit 1`;
      if (request === undefined) {
        throw new Error("no access request of advertiser A in the data set");
      }
      // The guards of 0137 date the approval and the execution themselves: off in this
      // rolled-back transaction, so that an execution can be two days old.
      await tx`alter table privacy.request_executions disable trigger request_executions_prepare`;
      await tx`alter table privacy.request_executions disable trigger request_executions_guard_update`;
      await tx`
        insert into privacy.request_executions
          (request_id, request_type, account_id, dual_control_request_id, approved_by_account_id,
           approved_at, executed_at)
        values (${request.id}, 'access', ${advertiser}, ${DUAL_CONTROL_REQUEST_ID},
                ${dataSet.accounts.admin.a.id}, now() - interval '3 hours',
                now() - interval '2 hours')`;
      const recent = await snapshot(tx);
      await tx`
        update privacy.request_executions
           set approved_at = now() - interval '3 days', executed_at = now() - interval '2 days'
         where request_id = ${request.id}`;
      return { id: request.id, recent, old: await snapshot(tx) };
    });
    const ids = (s: Snapshot) =>
      measureOf<{ executions: { id: string; executed_at: string }[] }>(
        s,
        "AL63",
      ).executions.map((execution) => execution.id);
    expect(ids(outcome.recent)).not.toContain(outcome.id);
    expect(ids(outcome.old)).toContain(outcome.id);
  });

  it("lists the GoTrue passes of the last 24 hours with a realignment failure or a breaker (AL60)", async () => {
    const outcome = await scenario(async (tx) => {
      const run = async (hoursAgo: number, counts: Record<string, number>) => {
        const [row] = await tx<{ id: string }[]>`
          insert into ops.periodic_runs
            (task_code, period_key, started_at, finished_at, outcome, counts)
          values ('auth_orphan_purge',
                  to_char((now() - make_interval(hours => ${hoursAgo})) at time zone 'UTC',
                          'YYYY-MM-DD"T"HH24'),
                  now() - make_interval(hours => ${hoursAgo}),
                  now() - make_interval(hours => ${hoursAgo}), 'failed', ${JSON.stringify(counts)}::text::jsonb)
          on conflict (task_code, period_key) do nothing
          returning id::text`;
        return row?.id ?? "";
      };
      const ids = {
        realign: await run(5, { realign_checked: 3, gotrue_realign_failed: 2 }),
        breaker: await run(6, { breaker_orphan_ratio: 1 }),
        clean: await run(7, { realign_checked: 3, gotrue_realigned: 3 }),
        old: await run(30, { gotrue_realign_failed: 1 }),
      };
      return { ids, s: await snapshot(tx) };
    });
    const runs = measureOf<{
      runs: {
        run_id: string;
        realign_failed: number;
        breaker: string | null;
      }[];
    }>(outcome.s, "AL60").runs;
    expect(runs).toContainEqual(
      expect.objectContaining({
        run_id: outcome.ids.realign,
        realign_failed: 2,
        breaker: null,
      }),
    );
    expect(runs).toContainEqual(
      expect.objectContaining({
        run_id: outcome.ids.breaker,
        realign_failed: 0,
        breaker: "breaker_orphan_ratio",
      }),
    );
    const listed = runs.map((item) => item.run_id);
    expect(listed).not.toContain(outcome.ids.clean);
    expect(listed).not.toContain(outcome.ids.old);
  });

  it("counts the signals of the Brevo webhook (AL61, AL62)", async () => {
    const outcome = await scenario(async (tx) => {
      const before = await snapshot(tx);
      for (const [signal, count] of [
        ["webhook_brevo_authenticated", 40],
        ["webhook_brevo_ignored", 7],
        ["webhook_brevo_ip_drift", 2],
      ] as const) {
        await tx`
          insert into ops.signal_counts (minute, service, instance, signal, count)
          values (date_trunc('minute', now(), 'UTC') - interval '2 minutes', 'api', ${INSTANCE},
                  ${signal}::ops.signal, ${count})`;
      }
      return { before, after: await snapshot(tx) };
    });
    const delta = (code: string, key: string) =>
      Number(outcome.after.measures[code]?.[key]) -
      Number(outcome.before.measures[code]?.[key]);
    expect(delta("AL61", "authenticated")).toBe(40);
    expect(delta("AL61", "ignored")).toBe(7);
    expect(delta("AL62", "occurrences")).toBe(2);
    expect(outcome.after.measures.AL62?.last_at).toMatch(/Z$/);
  });

  it("measures the delivery of the login codes of its window, and the sign-ins that followed (AL48)", async () => {
    const outcome = await scenario(async (tx) => {
      const references = [randomUUID(), randomUUID(), randomUUID()];
      const session = randomUUID();
      const advertiser = dataSet.accounts.advertiser.a.id;
      // three codes of the window: a member delivered in 4 s, a member never delivered, a first
      // code of a sign-up (no account) delivered in 10 s
      await tx`
        insert into leads.transactional_sends
          (reference, email_code, priority, account_id, recipient_email, locale, status, sent_at,
           delivered_at, provider_message_id, created_at)
        values
          (${references[0] ?? ""}, 'auth.login_code', 'p0', ${advertiser}, null, 'fr', 'delivered',
           now() - interval '30 minutes' + interval '1 second',
           now() - interval '30 minutes' + interval '4 seconds', ${`tm9-${RUN}-0`},
           now() - interval '30 minutes'),
          (${references[1] ?? ""}, 'auth.login_code', 'p0', ${dataSet.accounts.creator.a.id}, null,
           'fr', 'sent', now() - interval '30 minutes' + interval '1 second', null,
           ${`tm9-${RUN}-1`}, now() - interval '30 minutes'),
          (${references[2] ?? ""}, 'auth.login_code', 'p0', null, ${`tm9-${RUN}@example.test`},
           'fr', 'delivered', now() - interval '30 minutes' + interval '1 second',
           now() - interval '30 minutes' + interval '10 seconds', ${`tm9-${RUN}-2`},
           now() - interval '30 minutes')`;
      // advertiser A signed in 2 minutes after its code (the session trigger dates it now: off here)
      await tx`alter table identity.sessions disable trigger sessions_prepare`;
      await tx`
        insert into identity.sessions
          (id, token_hash, account_id, surface, aal, created_at, updated_at, last_activity_at,
           idle_expires_at, absolute_expires_at)
        values (${session}, ${randomBytes(32)}, ${advertiser}, 'member', 'aal1',
                now() - interval '28 minutes', now() - interval '28 minutes',
                now() - interval '28 minutes', now() + interval '1 day', now() + interval '2 days')`;
      // only the lines and the session of this case are seen (committed ones of other files
      // would blur the shares): the policies of the owner narrowed, rolled back with the rest
      await tx.unsafe(
        `alter policy transactional_sends_maintenance_definer_select on leads.transactional_sends
           using (priority = 'p0' and email_code = 'auth.login_code'
                  and reference = any ('{${references.join(",")}}'::uuid[]))`,
      );
      await tx.unsafe(
        `alter policy sessions_maintenance_definer_select on identity.sessions
           using (surface = 'member' and id = '${session}'::uuid)`,
      );
      return snapshot(tx);
    });
    expect(measureOf<Record<string, unknown>>(outcome, "AL48")).toEqual({
      sends: 3,
      median_delivery_seconds: 7,
      p90_delivery_seconds: 9.4,
      no_sign_in_share_bp: 5000,
      delivered_share_bp: 6666,
    });
  });

  it("is executable by the worker only, like the admin recipients (42501)", async () => {
    const outcome = await scenario(async (tx) => [
      await as(tx, "ops", "select ops.technical_alert_snapshot(now())"),
      await as(tx, "ops", "select * from ops.admin_alert_recipients()"),
      await as(tx, "auth", "select ops.technical_alert_snapshot(now())"),
    ]);
    expect(outcome).toEqual([
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    ]);
  });
});

describe("ops.admin_alert_recipients() (RG165 admin)", () => {
  it("gives the active admins, never an agent nor the break-glass account", async () => {
    const outcome = await scenario(async (tx) => {
      const adminB = dataSet.accounts.admin.b.id;
      // admin B made the break-glass account for this case (rolled back)
      await tx`update identity.agent_profiles set is_break_glass = false where is_break_glass`;
      await tx`update identity.agent_profiles set is_break_glass = true where account_id = ${adminB}`;
      const rows = await actAs(
        tx,
        "worker",
        () => tx<{ account_id: string; email: string }[]>`
          select account_id::text, email from ops.admin_alert_recipients() order by account_id`,
      );
      return rows.map((row) => row.account_id);
    });
    expect(outcome).toContain(dataSet.accounts.admin.a.id);
    expect(outcome).not.toContain(dataSet.accounts.admin.b.id);
    expect(outcome).not.toContain(dataSet.accounts.agent.a.id);
  });
});

// ---------------------------------------------------------------------------------------------

describe("ops.run_ops_retention() (02 §20.5, §20.8): hourly roll-up, then bounded purges", () => {
  type Counts = Record<string, number>;

  async function claimRetention(
    tx: postgres.TransactionSql,
  ): Promise<{ run_id: string; attempt: number }> {
    return actAs(tx, "worker", async () => {
      const [row] = await tx<{ run_id: string; attempt: number }[]>`
        select run_id::text, attempt from ops.claim_periodic_run('ops_retention',
                 to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))`;
      if (row === undefined) {
        throw new Error("ops_retention could not be claimed");
      }
      return row;
    });
  }

  /**
   * Calls until nothing is left (more = 0), at most 50 times, as the worker does call after call;
   * returns the summed counts (more: that of the last call) and the run.
   */
  async function retainAll(
    tx: postgres.TransactionSql,
  ): Promise<{ counts: Counts; runId: string }> {
    const run = await claimRetention(tx);
    const total: Counts = {};
    for (let call = 0; call < 50; call += 1) {
      const counts = await actAs(tx, "worker", async () => {
        const [row] = await tx<{ c: Counts }[]>`
          select ops.run_ops_retention(${run.run_id}::uuid, ${run.attempt}::smallint) as c`;
        return row?.c ?? {};
      });
      for (const [key, value] of Object.entries(counts)) {
        total[key] = (total[key] ?? 0) + value;
      }
      if (counts.more === 0) {
        total.more = 0;
        return { counts: total, runId: run.run_id };
      }
    }
    throw new Error("ops_retention never ran out of work");
  }

  it("rolls the closed hours up, then purges their minutes after 14 days only", async () => {
    const outcome = await scenario(async (tx) => {
      const route = `/v1/tm9/${RUN}`;
      const at = "date_trunc('hour', now() - interval '20 days', 'UTC')";
      const recent = "date_trunc('hour', now() - interval '3 hours', 'UTC')";
      await tx.unsafe(
        `insert into ops.request_metrics
           (minute, service, instance, method, route, request_count, server_error_count,
            throttled_count, duration_buckets)
         values (${at}, 'api', '${INSTANCE}-a', 'GET', '${route}', 3, 1, 0, '{1,2,0,0,0,0,0,0,0}'),
                (${at} + interval '5 minutes', 'api', '${INSTANCE}-b', 'GET', '${route}', 4, 0, 1,
                 '{0,0,4,0,0,0,0,0,0}'),
                (${recent} + interval '10 minutes', 'api', '${INSTANCE}-a', 'GET', '${route}', 2, 0,
                 0, '{2,0,0,0,0,0,0,0,0}'),
                (date_trunc('minute', now(), 'UTC') - interval '1 minute', 'api', '${INSTANCE}-a',
                 'GET', '${route}', 5, 0, 0, '{5,0,0,0,0,0,0,0,0}')`,
      );
      await tx.unsafe(
        `insert into ops.process_metrics
           (minute, service, instance, event_loop_delay_p99_ms, event_loop_delay_max_ms, rss_bytes,
            heap_used_bytes, cpu_percent)
         values (${at}, 'worker', '${INSTANCE}', 10, 30, 1000, 500, 2),
                (${at} + interval '1 minute', 'worker', '${INSTANCE}', 20, 40, 3000, 700, 4)`,
      );
      await tx.unsafe(
        `insert into ops.probe_results
           (checked_at, instance, target, outcome, status_code, failure_code, duration_ms)
         values (${at} + interval '30 seconds', '${INSTANCE}', 'web_home_en', 'up', 200, null, 120),
                (${at} + interval '90 seconds', '${INSTANCE}', 'web_home_en', 'down', null,
                 'timeout', 10000)`,
      );
      const { counts } = await retainAll(tx);
      const hourly = await tx.unsafe<
        {
          recent: boolean;
          request_count: string;
          server_error_count: string;
          throttled_count: string;
          duration_buckets: string[];
        }[]
      >(
        `select hour = ${recent} as recent, request_count::text, server_error_count::text,
                throttled_count::text, duration_buckets::text[]
           from ops.request_metrics_hourly where route = '${route}' order by hour`,
      );
      const minutes = await tx.unsafe<{ n: number }[]>(
        `select count(*)::int as n from ops.request_metrics where route = '${route}'`,
      );
      const process = await tx.unsafe<Record<string, unknown>[]>(
        `select minutes, event_loop_delay_p99_avg_ms::float8 as p99, event_loop_delay_max_ms::float8 as max,
                rss_avg_bytes::int as rss_avg, rss_max_bytes::int as rss_max
           from ops.process_metrics_hourly where instance = '${INSTANCE}'`,
      );
      const probes = await tx.unsafe<Record<string, unknown>[]>(
        `select checks, failures, duration_buckets
           from ops.probe_results_hourly where hour = ${at} and target = 'web_home_en'`,
      );
      const left = await tx.unsafe<{ process: number; probe: number }[]>(
        `select (select count(*)::int from ops.process_metrics where instance = '${INSTANCE}') as process,
                (select count(*)::int from ops.probe_results where instance = '${INSTANCE}') as probe`,
      );
      return {
        counts,
        hourly,
        minutes: minutes[0]?.n,
        process,
        probes,
        left: left[0],
      };
    });
    expect(outcome.hourly).toEqual([
      {
        recent: false,
        request_count: "7",
        server_error_count: "1",
        throttled_count: "1",
        duration_buckets: ["1", "2", "4", "0", "0", "0", "0", "0", "0"],
      },
      {
        recent: true,
        request_count: "2",
        server_error_count: "0",
        throttled_count: "0",
        duration_buckets: ["2", "0", "0", "0", "0", "0", "0", "0", "0"],
      },
    ]);
    // the 20-day-old minutes are gone; the recent hour and the last minute stay
    expect(outcome.minutes).toBe(2);
    expect(outcome.process).toEqual([
      { minutes: 2, p99: 15, max: 40, rss_avg: 2000, rss_max: 3000 },
    ]);
    expect(outcome.probes).toEqual([
      { checks: 2, failures: 1, duration_buckets: [0, 0, 0, 1, 0, 0, 0, 0, 1] },
    ]);
    expect(outcome.left).toEqual({ process: 0, probe: 0 });
    expect(outcome.counts.request_hours_rolled).toBeGreaterThanOrEqual(2);
    expect(outcome.counts.request_metrics_purged).toBeGreaterThanOrEqual(2);
    expect(outcome.counts.more).toBe(0);
  });

  it("purges occurrences after 30 days with retention.purged, and the other lines past their time", async () => {
    const outcome = await scenario(async (tx) => {
      const group = (label: string, status: string, lastSeen: string) =>
        tx.unsafe(
          `insert into ops.error_groups
           (fingerprint, source, service, error_type, message, route, first_version, last_version,
            status, first_seen_at, last_seen_at)
         values (sha256(convert_to('${RUN}-${label}', 'UTF8')), 'server', 'api', 'TypeError',
                 'tm9 retention', '/v1/tm9', 'local', 'local', '${status}',
                 now() - interval '${lastSeen}' - interval '1 day', now() - interval '${lastSeen}')`,
        );
      await group("kept", "new", "31 days");
      await group("fixed", "fixed", "14 months");
      await group("new-old", "new", "14 months");
      await tx.unsafe(
        `insert into ops.error_occurrences (group_fingerprint, service, version, route, message, occurred_at)
         values (sha256(convert_to('${RUN}-kept', 'UTF8')), 'api', 'local', '/v1/tm9', 'tm9 old', now() - interval '31 days'),
                (sha256(convert_to('${RUN}-kept', 'UTF8')), 'api', 'local', '/v1/tm9', 'tm9 recent', now() - interval '29 days')`,
      );
      await tx.unsafe(
        `insert into ops.worker_heartbeats (worker_id, instance, version, started_at, beat_at, loop_turn_at)
         values ('worker-${RUN}-gone', '${INSTANCE}', 'local', now() - interval '9 days',
                 now() - interval '8 days', now() - interval '8 days'),
                ('worker-${RUN}-alive', '${INSTANCE}', 'local', now() - interval '2 days',
                 now() - interval '1 day', now() - interval '1 day')`,
      );
      await tx.unsafe(
        `insert into ops.alert_states
           (scope, code, subject_key, state, opened_at, last_notified_at, notified_count, resolved_at)
         values ('worker', 'AL52', 'tm9-${RUN}-old', 'resolved', now() - interval '15 months',
                 now() - interval '15 months', 1, now() - interval '14 months'),
                ('worker', 'AL52', 'tm9-${RUN}-month', 'resolved', now() - interval '2 months',
                 now() - interval '2 months', 1, now() - interval '1 month')`,
      );
      await tx.unsafe(
        `insert into ops.probe_results_hourly (hour, target, checks, failures, duration_buckets)
         values (date_trunc('hour', now() - interval '14 months', 'UTC'), 'web_home_fr', 1, 0,
                 '{1,0,0,0,0,0,0,0,0}')
         on conflict do nothing`,
      );
      await tx.unsafe(
        `insert into identity.code_failure_tallies (key_hash, hour, failure_count)
         values (sha256(convert_to('${RUN}-old', 'UTF8')), date_trunc('hour', now() - interval '3 days', 'UTC'), 4),
                (sha256(convert_to('${RUN}-now', 'UTF8')), date_trunc('hour', now(), 'UTC'), 1)`,
      );
      const { counts, runId } = await retainAll(tx);
      const left = await tx.unsafe<Record<string, unknown>[]>(
        `select
           (select array_agg(message order by message) from ops.error_occurrences
             where group_fingerprint = sha256(convert_to('${RUN}-kept', 'UTF8'))) as occurrences,
           (select array_agg(status::text || ':' || route order by status) from ops.error_groups
             where message = 'tm9 retention') as groups,
           (select array_agg(worker_id) from ops.worker_heartbeats where instance = '${INSTANCE}') as beats,
           (select array_agg(subject_key) from ops.alert_states where subject_key like 'tm9-${RUN}%') as states,
           (select count(*)::int from ops.probe_results_hourly
             where hour < now() - interval '13 months') as old_hours,
           (select count(*)::int from identity.code_failure_tallies
             where key_hash in (sha256(convert_to('${RUN}-old', 'UTF8')), sha256(convert_to('${RUN}-now', 'UTF8')))) as tallies`,
      );
      const run = await tx<{ payload: Record<string, unknown> }[]>`
        select payload from audit.audit_events
         where event_type = 'retention.purged' and subject_type = 'periodic_run'
           and subject_id = ${runId}
         order by seq`;
      return { counts, left: left[0], purged: run.map((row) => row.payload) };
    });
    expect(outcome.left).toEqual({
      occurrences: ["tm9 recent"],
      groups: ["new:/v1/tm9", "new:/v1/tm9"],
      beats: [`worker-${RUN}-alive`],
      states: [`tm9-${RUN}-month`],
      old_hours: 0,
      tallies: 1,
    });
    const categories = outcome.purged.map((payload) => payload.category);
    expect(categories).toContain("error_occurrences");
    expect(categories).toContain("code_failure_tallies");
    for (const payload of outcome.purged) {
      expect(Number(payload.count)).toBeGreaterThanOrEqual(1);
    }
    expect(outcome.counts.error_groups_purged).toBeGreaterThanOrEqual(1);
    expect(outcome.counts.worker_heartbeats_purged).toBeGreaterThanOrEqual(1);
    expect(outcome.counts.alert_states_purged).toBeGreaterThanOrEqual(1);
  });

  it("returns non-negative integer counts in snake_case, ready for ops.finish_periodic_run()", async () => {
    const outcome = await scenario(async (tx) => {
      const run = await claimRetention(tx);
      return actAs(tx, "worker", async () => {
        const [row] = await tx<{ c: Record<string, number> }[]>`
          select ops.run_ops_retention(${run.run_id}::uuid, ${run.attempt}::smallint) as c`;
        const counts = row?.c ?? {};
        const [finished] = await tx<{ done: boolean }[]>`
          select ops.finish_periodic_run(${run.run_id}::uuid, ${run.attempt}::smallint,
                   'succeeded', ${JSON.stringify(counts)}::text::jsonb) as done`;
        return { keys: Object.keys(counts).sort(), done: finished?.done };
      });
    });
    expect(outcome.done).toBe(true);
    expect(outcome.keys).toEqual(
      [
        "alert_states_purged",
        "code_failure_tallies_purged",
        "database_samples_purged",
        "error_groups_purged",
        "error_occurrences_purged",
        "more",
        "probe_hours_rolled",
        "probe_results_hourly_purged",
        "probe_results_purged",
        "process_hours_rolled",
        "process_metrics_hourly_purged",
        "process_metrics_purged",
        "request_hours_rolled",
        "request_metrics_hourly_purged",
        "request_metrics_purged",
        "signal_counts_purged",
        "worker_heartbeats_purged",
      ].sort(),
    );
  });

  it.each([
    ["an attempt that was taken back", "attempt"],
    ["the run of another task", "task"],
  ] as const)("refuses %s (55000)", async (_label, kind) => {
    const outcome = await scenario(async (tx) => {
      if (kind === "attempt") {
        const run = await claimRetention(tx);
        return as(
          tx,
          "worker",
          "select ops.run_ops_retention($1::uuid, 2::smallint)",
          [run.run_id],
        );
      }
      const other = await actAs(tx, "worker", async () => {
        const [row] = await tx<{ run_id: string; attempt: number }[]>`
          select run_id::text, attempt from ops.claim_periodic_run('brevo_inbound_purge',
                   to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))`;
        return row;
      });
      return as(
        tx,
        "worker",
        "select ops.run_ops_retention($1::uuid, $2::smallint)",
        [other?.run_id ?? "", other?.attempt ?? 1],
      );
    });
    expect(outcome).toEqual({
      outcome: "error",
      code: NOT_IN_PREREQUISITE_STATE,
    });
  });
});

// ---------------------------------------------------------------------------------------------

describe("the failed codes of an address (AL59): a digest, never the address", () => {
  it("counts per digest and hour for influx_auth, and returns the last 24 hours", async () => {
    const outcome = await scenario(async (tx) => {
      const digest = createHash("sha256").update(`tm9-tally-${RUN}`).digest();
      await tx`
        insert into identity.code_failure_tallies (key_hash, hour, failure_count)
        values (${digest}, date_trunc('hour', now(), 'UTC') - interval '5 hours', 3),
               (${digest}, date_trunc('hour', now(), 'UTC') - interval '26 hours', 50)`;
      return actAs(tx, "auth", async () => {
        const first = await tx<
          { n: number }[]
        >`select identity.record_code_failure(${digest}) as n`;
        const second = await tx<
          { n: number }[]
        >`select identity.record_code_failure(${digest}) as n`;
        return [first[0]?.n, second[0]?.n];
      });
    });
    expect(outcome).toEqual([4, 5]);
  });

  it.each([
    ["a digest of 31 bytes", "auth", INVALID_PARAMETER],
    ["the worker", "worker", INSUFFICIENT_PRIVILEGE],
    ["the api's ops role", "ops", INSUFFICIENT_PRIVILEGE],
  ] as const)("refuses %s", async (label, actor, code) => {
    const outcome = await scenario((tx) =>
      as(tx, actor, "select identity.record_code_failure($1)", [
        randomBytes(label === "a digest of 31 bytes" ? 31 : 32),
      ]),
    );
    expect(outcome).toEqual({ outcome: "error", code });
  });
});

// ---------------------------------------------------------------------------------------------

describe("E-6 and 02 §20.8 hold", () => {
  it("leaves influx_ops without any read of identity, backoffice or its own signals", async () => {
    const outcome = await scenario(async (tx) => ({
      accounts: await as(tx, "ops", "select id from identity.accounts limit 1"),
      definitions: await as(
        tx,
        "ops",
        "select code from backoffice.alert_definitions limit 1",
      ),
      signals: await as(
        tx,
        "ops",
        "select instance from ops.signal_counts limit 1",
      ),
      states: await as(tx, "ops", "select code from ops.alert_states limit 1"),
      retention: await as(
        tx,
        "ops",
        "select ops.run_ops_retention(gen_random_uuid(), 1::smallint)",
      ),
    }));
    const refused = { outcome: "error", code: INSUFFICIENT_PRIVILEGE };
    expect(outcome).toEqual({
      accounts: refused,
      definitions: refused,
      signals: refused,
      states: refused,
      retention: refused,
    });
    const [schemas] = await migrationRole()<
      { identity: boolean; backoffice: boolean }[]
    >`
      select has_schema_privilege('influx_ops', 'identity', 'USAGE') as identity,
             has_schema_privilege('influx_ops', 'backoffice', 'USAGE') as backoffice`;
    expect(schemas).toEqual({ identity: false, backoffice: false });
  });

  it("writes the signals of the api for an ended minute of the last hour only", async () => {
    const outcome = await scenario(async (tx) => {
      const insert = (minute: string) =>
        as(
          tx,
          "ops",
          `insert into ops.signal_counts (minute, service, instance, signal, count)
           values (${minute}, 'api', '${INSTANCE}', 'webhook_brevo_ignored', 1)`,
        );
      return [
        await insert(
          "date_trunc('minute', now(), 'UTC') - interval '1 minute'",
        ),
        await insert("date_trunc('minute', now(), 'UTC')"),
        await insert("date_trunc('minute', now(), 'UTC') - interval '2 hours'"),
      ];
    });
    expect(outcome).toEqual([
      { outcome: "rows", count: 1 },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
    ]);
  });

  it("bounds every text and jsonb column of the new tables by a CHECK", async () => {
    const unbounded = await migrationRole()<{ col: string }[]>`
      select n.nspname || '.' || c.relname || '.' || a.attname as col
        from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid = a.attrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname || '.' || c.relname in (
               'ops.worker_heartbeats', 'ops.probe_results', 'ops.database_samples',
               'ops.signal_counts', 'ops.alert_states', 'ops.request_metrics_hourly',
               'ops.process_metrics_hourly', 'ops.probe_results_hourly',
               'identity.code_failure_tallies')
         and a.attnum > 0 and not a.attisdropped
         and a.atttypid in ('text'::regtype, 'jsonb'::regtype, 'json'::regtype,
                            'character varying'::regtype, 'bytea'::regtype)
         and not exists (select 1 from pg_catalog.pg_constraint k
                          where k.conrelid = c.oid and k.contype = 'c'
                            and a.attnum = any (k.conkey))
       order by 1`;
    expect(unbounded).toEqual([]);
  });

  it.each([
    [
      "an address as a worker id",
      "insert into ops.worker_heartbeats (worker_id, instance, version, started_at) values ('anne@example.test', 't2', 'local', now())",
    ],
    [
      "an address as an instance",
      "insert into ops.signal_counts (minute, service, instance, signal, count) values (date_trunc('minute', now(), 'UTC') - interval '1 minute', 'api', 'anne@example.test', 'webhook_brevo_ignored', 1)",
    ],
    [
      "an address as a subject",
      "insert into ops.alert_states (scope, code, subject_key, state, opened_at) values ('worker', 'AL52', 'anne@example.test', 'open', now())",
    ],
    [
      "an address in a value",
      `insert into ops.alert_states (scope, code, subject_key, state, opened_at, last_value) values ('worker', 'AL52', 'tm9', 'open', now(), '{"to": "anne@example.test"}')`,
    ],
    [
      "a URL as a route of the roll-up",
      "insert into ops.request_metrics_hourly (hour, service, method, route, request_count, server_error_count, throttled_count, duration_buckets) values (date_trunc('hour', now(), 'UTC'), 'api', 'GET', 'https://influx.example/v1?email=anne@example.test', 1, 0, 0, '{1,0,0,0,0,0,0,0,0}')",
    ],
  ])("refuses %s, even to the superuser (23514)", async (_label, statement) => {
    expect(await scenario((tx) => probe(tx, statement))).toEqual({
      outcome: "error",
      code: CHECK_VIOLATION,
    });
  });
});
