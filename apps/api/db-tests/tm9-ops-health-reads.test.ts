// TM9 (J9, commit 9) — the reads of the "Santé technique" screen, the database half (migration 0148;
// 02 §20.5, §20.8; 15 RG165; EC-J9-5): backoffice.ops_health_status(), ops_error_groups(),
// ops_error_group(), ops_traffic() and ops_processes(). Who may call them (influx_admin ONLY, in an
// aal2 transaction), what they add up (the histograms of every instance, never one p95 per
// instance), what they leave out, and the code that an agent's attempt is journaled under.
// The route half (the guard, the schemas, the 403 of an agent, the 404) is t14-backoffice-ops-route.
//
// Each case runs in ONE rolled-back transaction of the local superuser. Fixtures dated in the past
// are written by the superuser (the policies of the owner refuse them, by design). Measures that
// other files may have fed with committed lines are read as DIFFERENCES inside the same transaction,
// and a route, a message or an instance of this run carries RUN.
import { inRolledBackTransaction, type DataSet } from "@influx/test-kit/db";
import { createHash, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";

const RUN = randomUUID().replace(/-/g, "").slice(0, 12);
const INSTANCE_A = `tm9h-a-${RUN}`;
const INSTANCE_B = `tm9h-b-${RUN}`;
const ROUTE = `/v1/tm9h/${RUN}`;

const STATUS = "select backoffice.ops_health_status() as r";
const GROUPS =
  "select backoffice.ops_error_groups($1::text, $2::text, $3::integer) as r";
const GROUP = "select backoffice.ops_error_group($1::uuid) as r";
const TRAFFIC = "select backoffice.ops_traffic($1::text) as r";
const PROCESSES = "select backoffice.ops_processes() as r";

let dataSet: DataSet;
let admin: string;
let agent: string;

beforeAll(async () => {
  dataSet = await testDataSet();
  admin = dataSet.accounts.admin.a.id;
  agent = dataSet.accounts.agent.a.id;
});

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt<T = Record<string, unknown>> =
  | { outcome: "answer"; value: T }
  | { outcome: "error"; code: string };

/** One statement in a savepoint: its first column `r` (a jsonb) or the SQLSTATE. */
async function attempt<T = Record<string, unknown>>(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Attempt<T>> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "answer", value: (rows[0]?.r ?? null) as T };
  } catch (error) {
    return { outcome: "error", code: (error as { code?: string }).code ?? "" };
  }
}

function asAdmin<T>(tx: postgres.TransactionSql, fn: () => Promise<T>) {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: admin, role: "admin", aal: "aal2" },
    fn,
  );
}

function asAgent<T>(tx: postgres.TransactionSql, fn: () => Promise<T>) {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: agent, role: "agent", aal: "aal2" },
    fn,
  );
}

function answerOf<T>(result: Attempt<T>): T {
  if (result.outcome !== "answer") {
    throw new Error(`refused: ${result.code}`);
  }
  return result.value;
}

type Status = {
  now: string;
  probes: {
    target: string;
    last: { outcome: string; failure_code: string | null } | null;
    day: { checks: number; failures: number };
    week: { checks: number; failures: number };
    month: { checks: number; failures: number };
  }[];
  workers: { instance: string; beat_at: string }[];
  worker_definition: { threshold: Record<string, unknown> } | null;
  periodic: { task: string }[];
  alerts: { code: string; subject: string; value: Record<string, unknown> }[];
};

type Groups = {
  counts: Record<string, number>;
  groups: { message: string; status: string; id: string }[];
};

type Traffic = {
  bucket_seconds: number;
  routes: {
    method: string;
    route: string;
    cells: { count: number; server_errors: number; buckets: number[] }[];
  }[];
  totals: { count: number; buckets: number[] }[];
};

type Processes = {
  processes: {
    instance: string;
    event_loop_delay_p99_ms: number;
    hour: { samples: number; event_loop_delay_max_ms: number };
  }[];
  database: {
    last: { connections: number } | null;
    peak_24h: number | null;
    samples: { connections: number }[];
  };
};

const HISTOGRAM = (...counts: number[]): string =>
  `{${[...counts, ...Array(9 - counts.length).fill(0)].join(",")}}`;

function fingerprint(label: string): Buffer {
  return createHash("sha256").update(`tm9h:${RUN}:${label}`).digest();
}

/** One error group with the status the case wants (the trigger of 0016 guards later updates). */
async function group(
  tx: postgres.TransactionSql,
  label: string,
  options: {
    status?: "new" | "acknowledged" | "fixed" | "ignored";
    regressions?: number;
    source?: "server" | "browser";
    service?: "api" | "worker" | "web" | "backoffice";
    lastSeenHoursAgo?: number;
  } = {},
): Promise<string> {
  const source = options.source ?? "server";
  const service = options.service ?? (source === "server" ? "api" : "web");
  const [row] = await tx<{ id: string }[]>`
    insert into ops.error_groups
      (fingerprint, source, service, error_type, message, route, status, regression_count,
       first_seen_at, last_seen_at, first_version, last_version)
    values (${fingerprint(label)}, ${source}::ops.error_source, ${service}::ops.service_name,
            'TypeError', ${`tm9h ${RUN} ${label}`}, ${ROUTE},
            ${options.status ?? "new"}::ops.error_status, ${options.regressions ?? 0},
            now() - interval '30 days', now() - ${`${options.lastSeenHoursAgo ?? 0} hours`}::interval,
            'abc123', 'abc123')
    returning id::text`;
  return row?.id ?? "";
}

describe("who calls the reads of the screen (0148)", () => {
  it("influx_admin only: an agent, a member, the worker, the ops pool and a bare influx_app are refused", async () => {
    const calls: [string, readonly postgres.ParameterOrJSON<never>[]][] = [
      [STATUS, []],
      [GROUPS, ["open", null, 5]],
      [GROUP, [randomUUID()]],
      [TRAFFIC, ["hour"]],
      [PROCESSES, []],
    ];
    const outcome = await scenario(async (tx) => {
      const refused: Record<string, string[]> = {
        admin: [],
        agent: [],
        creator: [],
        worker: [],
        ops: [],
      };
      for (const [statement, parameters] of calls) {
        refused.admin?.push(
          (await asAdmin(tx, () => attempt(tx, statement, parameters)))
            .outcome,
        );
        refused.agent?.push(
          JSON.stringify(
            await asAgent(tx, () => attempt(tx, statement, parameters)),
          ),
        );
        refused.creator?.push(
          JSON.stringify(
            await actAsMember(
              tx,
              "influx_creator",
              {
                accountId: dataSet.accounts.creator.a.id,
                role: "creator",
                aal: "aal1",
              },
              () => attempt(tx, statement, parameters),
            ),
          ),
        );
        refused.worker?.push(
          JSON.stringify(
            await actAs(tx, "worker", () =>
              attempt(tx, statement, parameters),
            ),
          ),
        );
        refused.ops?.push(
          JSON.stringify(
            await actAs(tx, "ops", () => attempt(tx, statement, parameters)),
          ),
        );
      }
      return refused;
    });
    expect(outcome.admin).toEqual(Array(calls.length).fill("answer"));
    const denied = JSON.stringify({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    });
    for (const role of ["agent", "creator", "worker", "ops"]) {
      expect(outcome[role], role).toEqual(Array(calls.length).fill(denied));
    }
  });

  it("no execution role reads the ops tables itself: the owner of the functions alone does", async () => {
    const rows = await scenario((tx) =>
      tx<{ rolname: string; relation: string }[]>`
        select r.rolname, t.relation
          from pg_catalog.pg_roles r,
               unnest(array['ops.error_groups', 'ops.error_occurrences', 'ops.probe_results',
                            'ops.probe_results_hourly', 'ops.request_metrics', 'ops.process_metrics',
                            'ops.database_samples', 'ops.worker_heartbeats',
                            'ops.alert_states']) as t(relation)
         where r.rolname in ('influx_agent', 'influx_admin', 'influx_advertiser', 'influx_creator',
                             'influx_app', 'influx_auth', 'influx_worker', 'influx_ops')
           and pg_catalog.has_any_column_privilege(r.oid, t.relation, 'SELECT')
           -- the two reads that 0016 and 0147 gave their writers, and nobody else
           and not (r.rolname = 'influx_ops' and t.relation = 'ops.error_groups')`,
    );
    expect(rows).toEqual([]);
  });

  it("an agent's attempt is journaled under ops.read_health, and any other code stays refused (22023)", async () => {
    const result = await scenario(async (tx) => {
      const before = await tx<{ n: string }[]>`
        select count(*)::text as n from audit.audit_events
         where event_type = 'backoffice.action_refused' and subject_id = ${agent}::uuid`;
      const known = await asAgent(tx, () =>
        attempt(tx, "select backoffice.record_refused_action($1::text) as r", [
          "ops.read_health",
        ]),
      );
      const unknown = await asAgent(tx, () =>
        attempt(tx, "select backoffice.record_refused_action($1::text) as r", [
          "ops.read_everything",
        ]),
      );
      const after = await tx<{ n: string; code: string | null }[]>`
        select count(*)::text as n, max(payload ->> 'action_code') as code from audit.audit_events
         where event_type = 'backoffice.action_refused' and subject_id = ${agent}::uuid
           and payload ->> 'action_code' = 'ops.read_health'`;
      return { before: before[0]?.n, known, unknown, after: after[0] };
    });
    expect(result.known.outcome).toBe("answer");
    expect(result.unknown).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    expect(Number(result.after?.n)).toBeGreaterThanOrEqual(1);
    expect(result.after?.code).toBe("ops.read_health");
  });
});

describe("the closed lists of the contract are the database's own", () => {
  it("probe targets, error states, services and periodic tasks: the enums of ops, in order", async () => {
    const { OPS_ERROR_STATUSES, OPS_PERIODIC_TASKS, OPS_PROBE_TARGETS, OPS_SERVICES } =
      await import("@influx/contracts/backoffice-ops");
    const rows = await scenario((tx) =>
      tx<{ name: string; labels: string[] }[]>`
        select t.typname as name, array_agg(e.enumlabel order by e.enumsortorder) as labels
          from pg_catalog.pg_type t
          join pg_catalog.pg_enum e on e.enumtypid = t.oid
          join pg_catalog.pg_namespace n on n.oid = t.typnamespace
         where n.nspname = 'ops'
           and t.typname in ('probe_target', 'error_status', 'service_name', 'periodic_task')
         group by t.typname`,
    );
    const labels = Object.fromEntries(rows.map((row) => [row.name, row.labels]));
    expect(labels.probe_target).toEqual([...OPS_PROBE_TARGETS]);
    expect(labels.error_status).toEqual([...OPS_ERROR_STATUSES]);
    expect(labels.service_name).toEqual([...OPS_SERVICES]);
    expect([...(labels.periodic_task ?? [])].sort()).toEqual([...OPS_PERIODIC_TASKS].sort());
  });
});

describe("ops_health_status(): the probe, the worker, the periodic tasks, the alerts", () => {
  it("counts the checks and the failures over 24 hours, 7 days and 30 days, the roll-up beyond the minute table", async () => {
    const [before, after] = await scenario(async (tx) => {
      const read = async () =>
        answerOf(
          await asAdmin(tx, () => attempt<Status>(tx, STATUS)),
        ).probes.find((probe) => probe.target === "web_home_fr");
      const first = await read();
      // 3 checks in the last day (1 down), 1 down 3 days ago, 1 up 10 days ago
      await tx`
        insert into ops.probe_results
          (checked_at, instance, target, outcome, status_code, failure_code, duration_ms)
        values (now() - interval '5 minutes', ${INSTANCE_A}, 'web_home_fr', 'up', 200, null, 80),
               (now() - interval '3 hours', ${INSTANCE_A}, 'web_home_fr', 'up', 200, null, 90),
               (now() - interval '6 hours', ${INSTANCE_A}, 'web_home_fr', 'down', null, 'timeout', 5000),
               (now() - interval '3 days', ${INSTANCE_A}, 'web_home_fr', 'down', 503, 'status', 40),
               (now() - interval '10 days', ${INSTANCE_A}, 'web_home_fr', 'up', 200, null, 70)`;
      // the roll-up of an old hour: 60 checks, 6 failures, 20 days ago (beyond the minute table)
      await tx`
        delete from ops.probe_results_hourly
         where target = 'web_home_fr'
           and hour = date_trunc('hour', now() - interval '20 days', 'UTC')`;
      await tx`
        insert into ops.probe_results_hourly (hour, target, checks, failures, duration_buckets)
        values (date_trunc('hour', now() - interval '20 days', 'UTC'), 'web_home_fr', 60, 6,
                '{60,0,0,0,0,0,0,0,0}')`;
      return [first, await read()] as const;
    });
    const delta = (key: "day" | "week" | "month", field: "checks" | "failures") =>
      (after?.[key][field] ?? 0) - (before?.[key][field] ?? 0);
    expect([delta("day", "checks"), delta("day", "failures")]).toEqual([3, 1]);
    expect([delta("week", "checks"), delta("week", "failures")]).toEqual([4, 2]);
    // 30 days: the 5 minute lines, the 10-day line (still in the minute table) and the old hour
    expect([delta("month", "checks"), delta("month", "failures")]).toEqual([
      65, 8,
    ]);
  });

  it("answers the four targets even before any check, and the last check of a target", async () => {
    const status = await scenario(async (tx) => {
      await tx`
        insert into ops.probe_results
          (checked_at, instance, target, outcome, status_code, failure_code, duration_ms)
        values (now() + interval '30 seconds', ${INSTANCE_A}, 'api_health', 'down', 503, 'status', 12)`;
      return answerOf(await asAdmin(tx, () => attempt<Status>(tx, STATUS)));
    });
    expect(status.probes.map((probe) => probe.target)).toEqual([
      "api_health",
      "backoffice_sign_in",
      "web_home_en",
      "web_home_fr",
    ]);
    expect(
      status.probes.find((probe) => probe.target === "api_health")?.last,
    ).toMatchObject({ outcome: "down", failure_code: "status" });
  });

  it("lists the worker processes (latest beat first) with the threshold of AL50, and the last run of a periodic task", async () => {
    const status = await scenario(async (tx) => {
      await tx`
        insert into ops.worker_heartbeats (worker_id, instance, version, started_at, beat_at, loop_turn_at)
        values (${`worker-${INSTANCE_A}`}, ${INSTANCE_A}, 'abc123', now() - interval '2 hours',
                now() - interval '1 second', now() - interval '2 seconds'),
               (${`worker-${INSTANCE_B}`}, ${INSTANCE_B}, 'abc123', now() - interval '3 hours',
                now() - interval '10 minutes', now() - interval '10 minutes')`;
      await tx`
        insert into ops.periodic_runs (task_code, period_key, started_at, finished_at, outcome)
        values ('brevo_inbound_purge', '2020-01-01', now() - interval '1 hour',
                now() - interval '59 minutes', 'succeeded')
        on conflict (task_code, period_key) do nothing`;
      return answerOf(await asAdmin(tx, () => attempt<Status>(tx, STATUS)));
    });
    const mine = status.workers.filter((worker) =>
      [INSTANCE_A, INSTANCE_B].includes(worker.instance),
    );
    expect(mine.map((worker) => worker.instance)).toEqual([INSTANCE_A, INSTANCE_B]);
    expect(status.worker_definition?.threshold).toMatchObject({
      heartbeat_max_age_seconds: 60,
    });
    expect(status.periodic.map((run) => run.task)).toContain(
      "brevo_inbound_purge",
    );
  });

  it("shows the open technical alerts with their flat value, never the bookkeeping lines of AL51 nor a resolved alert", async () => {
    const status = await scenario(async (tx) => {
      await tx`
        insert into ops.alert_states (scope, code, subject_key, state, opened_at, last_notified_at,
                                      notified_count, last_value)
        values ('worker', 'AL52', ${`tm9h${RUN}`}, 'open', now() - interval '20 minutes',
                now() - interval '5 minutes', 2, '{"share_bp": 130, "threshold_bp": 100}'),
               ('worker', 'AL51', 'watermark', 'open', now() - interval '1 hour', null, 0,
                '{"seenUntil": "2026-10-26T10:00:00.000Z"}')
        on conflict (scope, code, subject_key) do nothing`;
      await tx`
        insert into ops.alert_states (scope, code, subject_key, state, opened_at, resolved_at,
                                      last_notified_at, notified_count)
        values ('worker', 'AL53', ${`tm9h${RUN}`}, 'resolved', now() - interval '2 hours',
                now() - interval '1 hour', now() - interval '2 hours', 1)
        on conflict (scope, code, subject_key) do nothing`;
      return answerOf(await asAdmin(tx, () => attempt<Status>(tx, STATUS)));
    });
    const mine = status.alerts.filter((alert) => alert.subject === `tm9h${RUN}`);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      code: "AL52",
      value: { share_bp: 130, threshold_bp: 100 },
    });
    expect(status.alerts.some((alert) => alert.subject === "watermark")).toBe(false);
  });
});

describe("ops_error_groups() and ops_error_group()", () => {
  it("lists one state at a time, the latest sighting first, with the counts of every state", async () => {
    const result = await scenario(async (tx) => {
      const before = answerOf(
        await asAdmin(tx, () => attempt<Groups>(tx, GROUPS, ["all", null, 200])),
      );
      await group(tx, "new-now", { status: "new", lastSeenHoursAgo: 0 });
      await group(tx, "ack", { status: "acknowledged", lastSeenHoursAgo: 2 });
      await group(tx, "regression", {
        status: "new",
        regressions: 1,
        lastSeenHoursAgo: 1,
      });
      await group(tx, "fixed", { status: "fixed", lastSeenHoursAgo: 5 });
      await group(tx, "ignored", { status: "ignored", lastSeenHoursAgo: 6 });
      await group(tx, "browser", {
        status: "new",
        source: "browser",
        service: "backoffice",
        lastSeenHoursAgo: 3,
      });
      const read = async (state: string, source: string | null) =>
        answerOf(
          await asAdmin(tx, () =>
            attempt<Groups>(tx, GROUPS, [state, source, 200]),
          ),
        );
      const mine = (answer: Groups) =>
        answer.groups
          .filter((g) => g.message.startsWith(`tm9h ${RUN} `))
          .map((g) => g.message.slice(`tm9h ${RUN} `.length));
      return {
        before,
        open: await read("open", null),
        regression: await read("regression", null),
        fixed: await read("fixed", null),
        ignoredBrowser: await read("ignored", "browser"),
        server: await read("open", "server"),
        browser: await read("open", "browser"),
        all: await read("all", null),
        mine,
      };
    });
    const { mine } = result;
    // the latest sighting first: new-now (0 h), regression (1 h), ack (2 h), browser (3 h)
    expect(mine(result.open)).toEqual(["new-now", "regression", "ack", "browser"]);
    expect(mine(result.regression)).toEqual(["regression"]);
    expect(mine(result.fixed)).toEqual(["fixed"]);
    expect(mine(result.ignoredBrowser)).toEqual([]);
    expect(mine(result.server)).toEqual(["new-now", "regression", "ack"]);
    expect(mine(result.browser)).toEqual(["browser"]);
    expect(mine(result.all)).toHaveLength(6);
    // the counts are the whole base's, whatever the list: 3 new (new-now, regression, browser)...
    const grew = (key: string) =>
      (result.all.counts[key] ?? 0) - (result.before.counts[key] ?? 0);
    expect(grew("new")).toBe(3);
    expect(grew("acknowledged")).toBe(1);
    expect(grew("fixed")).toBe(1);
    expect(grew("ignored")).toBe(1);
    expect(grew("regression")).toBe(1);
  });

  it("refuses another filter, another source or another size (22023)", async () => {
    const outcomes = await scenario(async (tx) => {
      const run = (parameters: readonly postgres.ParameterOrJSON<never>[]) =>
        asAdmin(tx, () => attempt(tx, GROUPS, parameters));
      return [
        await run(["everything", null, 5]),
        await run([null, null, 5]),
        await run(["open", "worker", 5]),
        await run(["open", null, 0]),
        await run(["open", null, 201]),
        await run(["open", null, null]),
      ];
    });
    for (const outcome of outcomes) {
      expect(outcome).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    }
  });

  it("gives one group with its occurrences, the latest first, and null for an unknown group", async () => {
    const result = await scenario(async (tx) => {
      const id = await group(tx, "detail", { status: "acknowledged" });
      const requestId = randomUUID();
      const accountId = randomUUID();
      await tx`
        insert into ops.error_occurrences
          (group_fingerprint, occurred_at, service, version, route, request_id, account_id,
           message, stack)
        values (${fingerprint("detail")}, now() - interval '2 hours', 'api', 'abc123', ${ROUTE},
                null, null, 'older', null),
               (${fingerprint("detail")}, now() - interval '1 minute', 'api', 'abc123', ${ROUTE},
                ${requestId}, ${accountId}, 'newer', 'TypeError: x\n    at handler (src/x.ts:1:1)')`;
      return {
        requestId,
        accountId,
        detail: answerOf(
          await asAdmin(tx, () =>
            attempt<{
              group: { id: string; status: string; occurrence_count: number };
              occurrences: {
                message: string;
                request_id: string | null;
                account_id: string | null;
                stack: string | null;
              }[];
            }>(tx, GROUP, [id]),
          ),
        ),
        id,
        unknown: await asAdmin(tx, () => attempt(tx, GROUP, [randomUUID()])),
      };
    });
    expect(result.detail.group).toMatchObject({
      id: result.id,
      status: "acknowledged",
    });
    expect(result.detail.occurrences.map((o) => o.message)).toEqual([
      "newer",
      "older",
    ]);
    expect(result.detail.occurrences[0]).toMatchObject({
      request_id: result.requestId,
      account_id: result.accountId,
      stack: "TypeError: x\n    at handler (src/x.ts:1:1)",
    });
    expect(result.unknown).toEqual({ outcome: "answer", value: null });
  });
});

describe("ops_traffic(): the histograms of every instance, added up", () => {
  /** Two instances, same minutes: the figures the screen shows must be the sum, not either one. */
  it("adds the instances up per route and per bucket of time, and the totals of every route", async () => {
    const result = await scenario(async (tx) => {
      // two completed minutes of the last hour, aligned (the table refuses another instant)
      await tx`
        insert into ops.request_metrics
          (minute, service, instance, method, route, request_count, server_error_count,
           throttled_count, duration_buckets)
        values (date_trunc('minute', now() - interval '2 minutes'), 'api', ${INSTANCE_A}, 'GET', ${ROUTE},
                10, 1, 0, ${HISTOGRAM(8, 2)}::integer[]),
               (date_trunc('minute', now() - interval '2 minutes'), 'api', ${INSTANCE_B}, 'GET', ${ROUTE},
                10, 0, 2, ${HISTOGRAM(0, 0, 0, 0, 0, 10)}::integer[]),
               (date_trunc('minute', now() - interval '1 minutes'), 'api', ${INSTANCE_A}, 'POST', ${ROUTE},
                4, 4, 0, ${HISTOGRAM(0, 0, 0, 0, 0, 0, 0, 0, 4)}::integer[])`;
      return answerOf(
        await asAdmin(tx, () => attempt<Traffic>(tx, TRAFFIC, ["hour"])),
      );
    });
    expect(result.bucket_seconds).toBe(300);
    const get = result.routes.find(
      (route) => route.method === "GET" && route.route === ROUTE,
    );
    const post = result.routes.find(
      (route) => route.method === "POST" && route.route === ROUTE,
    );
    // GET: 20 calls in at most two 5-minute buckets (a boundary can split the two minutes)
    const sum = (cells: { count: number; server_errors: number; buckets: number[] }[]) => ({
      count: cells.reduce((total, cell) => total + cell.count, 0),
      errors: cells.reduce((total, cell) => total + cell.server_errors, 0),
      buckets: Array.from({ length: 9 }, (_, index) =>
        cells.reduce((total, cell) => total + (cell.buckets[index] ?? 0), 0),
      ),
    });
    expect(sum(get?.cells ?? [])).toEqual({
      count: 20,
      errors: 1,
      buckets: [8, 2, 0, 0, 0, 10, 0, 0, 0],
    });
    expect(sum(post?.cells ?? [])).toEqual({
      count: 4,
      errors: 4,
      buckets: [0, 0, 0, 0, 0, 0, 0, 0, 4],
    });
    // the totals hold at least these 24 calls, in the same nine buckets
    expect(
      result.totals.reduce((total, cell) => total + cell.count, 0),
    ).toBeGreaterThanOrEqual(24);
  });

  it("keeps the busiest 100 routes, and refuses another window (22023)", async () => {
    const outcomes = await scenario(async (tx) => {
      const day = answerOf(
        await asAdmin(tx, () => attempt<Traffic>(tx, TRAFFIC, ["day"])),
      );
      const week = answerOf(
        await asAdmin(tx, () => attempt<Traffic>(tx, TRAFFIC, ["week"])),
      );
      return {
        day: day.bucket_seconds,
        week: week.bucket_seconds,
        routes: day.routes.length,
        bad: [
          await asAdmin(tx, () => attempt(tx, TRAFFIC, ["month"])),
          await asAdmin(tx, () => attempt(tx, TRAFFIC, [null])),
        ],
      };
    });
    expect(outcomes.day).toBe(3600);
    expect(outcomes.week).toBe(21600);
    expect(outcomes.routes).toBeLessThanOrEqual(100);
    for (const outcome of outcomes.bad) {
      expect(outcome).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    }
  });
});

describe("ops_processes(): the processes and the connections of the base", () => {
  it("gives each process its last sample and its last hour, and the connections of the base", async () => {
    const result = await scenario(async (tx) => {
      await tx`
        insert into ops.process_metrics
          (minute, service, instance, event_loop_delay_p99_ms, event_loop_delay_max_ms, rss_bytes,
           heap_used_bytes, cpu_percent)
        values (date_trunc('minute', now() - interval '3 minutes'), 'api', ${INSTANCE_A}, 10, 40,
                200000000, 80000000, 12.5),
               (date_trunc('minute', now() - interval '2 minutes'), 'api', ${INSTANCE_A}, 30, 90,
                210000000, 82000000, 20),
               (date_trunc('minute', now() - interval '3 hours'), 'api', ${INSTANCE_A}, 500, 900,
                300000000, 90000000, 90)`;
      await tx`
        insert into ops.database_samples (minute, connections, max_connections)
        values (date_trunc('minute', now() + interval '1 minute', 'UTC'), 7777, 9999)
        on conflict (minute) do nothing`;
      return answerOf(await asAdmin(tx, () => attempt<Processes>(tx, PROCESSES)));
    });
    const mine = result.processes.find((p) => p.instance === INSTANCE_A);
    // the last sample, the two samples of the last hour (the one of 3 hours ago is not in it)
    expect(mine).toMatchObject({
      event_loop_delay_p99_ms: 30,
      hour: { samples: 2, event_loop_delay_max_ms: 90 },
    });
    expect(result.database.last).toMatchObject({ connections: 7777 });
    expect(result.database.peak_24h).toBeGreaterThanOrEqual(7777);
    expect(result.database.samples.length).toBeLessThanOrEqual(60);
  });
});
