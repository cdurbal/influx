// What the "Santé technique" screen reads (docs/mvp/02 §20.5, "Écran « Santé technique »"; 15 RG165;
// 21 §J9 point 9, EC-J9-5; migration 0148). The five functions of backoffice.ops_* answer jsonb of
// codes, counts, instants and cleaned texts (./health/repository.ts hands them over as they came); this
// module reads each answer THROUGH A SCHEMA (an
// unexpected shape is an error, never a guess) and shapes it for the contract of
// @influx/contracts/backoffice-ops. The only computations are the ones the database cannot keep:
//   - the p95, from the histograms ADDED UP over every instance (02 §20.5: two p95 do not add up,
//     two histograms do): the upper bound of the bucket that holds it, never a stored value;
//   - the state of the worker, with the very rule of AL50 (technical-alerts.ts), so that the screen
//     and the alert never disagree;
//   - the buckets of time, filled with zeros where nothing was measured, and the calls per minute.
// Nothing is written and nothing is journaled: a read of the technical state (0148). Instants leave
// in milliseconds, whatever the database gives (microseconds), for every browser.
import type {
  OpsErrorDetailResponse,
  OpsErrorFilter,
  OpsErrorGroup,
  OpsErrorsResponse,
  OpsProcessesResponse,
  OpsStatusResponse,
  OpsTrafficPoint,
  OpsTrafficResponse,
  OpsTrafficSummary,
  OpsTrafficWindow,
} from "@influx/contracts/backoffice-ops";
import {
  OPS_ERROR_LIST_CAP,
  OPS_ERROR_SOURCES,
  OPS_ERROR_STATUSES,
  OPS_PERIODIC_TASKS,
  OPS_PROBE_FAILURES,
  OPS_PROBE_TARGETS,
  OPS_SERVICES,
  OPS_TRAFFIC_ROUTE_CAP,
} from "@influx/contracts/backoffice-ops";
import * as z from "zod";
import type { Transaction } from "../../db/index.ts";
import { DURATION_BUCKETS_MS, p95UpperBoundMs } from "../ops/buckets.ts";
import * as database from "./health/repository.ts";
import {
  thresholdNumber,
  workerStoppedCondition,
} from "../ops/technical-alerts.ts";

const instant = z.string().min(1);
const count = z.number().int().nonnegative();
const nullableInstant = instant.nullable();

/** An instant of the database (microseconds) as the browsers read it (milliseconds). */
function ms(value: string): string {
  return new Date(value).toISOString();
}

function msOrNull(value: string | null): string | null {
  return value === null ? null : ms(value);
}

function secondsBetween(later: string, earlier: string): number {
  return Math.max(
    0,
    Math.floor((Date.parse(later) - Date.parse(earlier)) / 1000),
  );
}

// ---------------------------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------------------------

const windowSchema = z.object({ checks: count, failures: count });

const statusRowSchema = z.object({
  now: instant,
  probes: z.array(
    z.object({
      target: z.enum(OPS_PROBE_TARGETS),
      last: z
        .object({
          checked_at: instant,
          outcome: z.enum(["up", "down"]),
          status_code: z.number().int().nullable(),
          failure_code: z.enum(OPS_PROBE_FAILURES).nullable(),
          duration_ms: count,
        })
        .nullable(),
      day: windowSchema,
      week: windowSchema,
      month: windowSchema,
    }),
  ),
  workers: z.array(
    z.object({
      instance: z.string(),
      version: z.string(),
      started_at: instant,
      beat_at: instant,
      loop_turn_at: instant,
    }),
  ),
  worker_definition: z
    .object({
      threshold: z.record(z.string(), z.unknown()),
      is_active: z.boolean(),
    })
    .nullable(),
  periodic: z.array(
    z.object({
      task: z.enum(OPS_PERIODIC_TASKS),
      period: z.string(),
      started_at: instant,
      finished_at: nullableInstant,
      outcome: z.string().nullable(),
    }),
  ),
  alerts: z.array(
    z.object({
      code: z.string(),
      subject: z.string(),
      opened_at: instant,
      last_notified_at: nullableInstant,
      notified_count: count,
      value: z.record(
        z.string(),
        z.union([z.string(), z.number(), z.null()]),
      ),
    }),
  ),
});

export async function readOpsStatus(
  tx: Transaction,
): Promise<OpsStatusResponse> {
  const status = statusRowSchema.parse(await database.healthStatus(tx));

  const latestBeat = status.workers[0] ?? null;
  const definition = status.worker_definition;
  const maxBeatAge =
    definition === null
      ? null
      : thresholdNumber(definition.threshold, "heartbeat_max_age_seconds");
  // the very rule of AL50: no beat ever is a stopped worker; no threshold, nothing evaluated
  const condition = workerStoppedCondition({
    now: status.now,
    lastBeatAt: latestBeat === null ? null : latestBeat.beat_at,
    lastLoopTurnAt: latestBeat === null ? null : latestBeat.loop_turn_at,
    definition:
      definition === null
        ? null
        : {
            nature: "etat",
            threshold: definition.threshold,
            recipientRoles: [],
            isActive: definition.is_active,
          },
  });

  return {
    now: ms(status.now),
    probes: status.probes.map((probe) => ({
      target: probe.target,
      last:
        probe.last === null
          ? null
          : {
              checkedAt: ms(probe.last.checked_at),
              outcome: probe.last.outcome,
              statusCode: probe.last.status_code,
              failureCode: probe.last.failure_code,
              durationMs: probe.last.duration_ms,
            },
      availability: { day: probe.day, week: probe.week, month: probe.month },
    })),
    worker: {
      state:
        condition === null
          ? "unknown"
          : condition.active
            ? "silent"
            : "running",
      maxBeatAgeSeconds: maxBeatAge,
      processes: status.workers.map((worker) => {
        const beatAge = secondsBetween(status.now, worker.beat_at);
        return {
          instance: worker.instance,
          version: worker.version,
          startedAt: ms(worker.started_at),
          beatAt: ms(worker.beat_at),
          loopTurnAt: ms(worker.loop_turn_at),
          beatAgeSeconds: beatAge,
          loopTurnAgeSeconds: secondsBetween(status.now, worker.loop_turn_at),
          silent: maxBeatAge === null ? null : beatAge > maxBeatAge,
        };
      }),
    },
    periodic: status.periodic.map((run) => ({
      task: run.task,
      period: run.period,
      startedAt: ms(run.started_at),
      finishedAt: msOrNull(run.finished_at),
      outcome: run.outcome,
    })),
    alerts: status.alerts.map((alert) => ({
      code: alert.code,
      subject: alert.subject,
      openedAt: ms(alert.opened_at),
      lastNotifiedAt: msOrNull(alert.last_notified_at),
      notifiedCount: alert.notified_count,
      value: Object.entries(alert.value)
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
        .map(([key, value]) => ({ key, value })),
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Error groups
// ---------------------------------------------------------------------------------------------

const groupRowSchema = z.object({
  id: z.uuid(),
  source: z.enum(OPS_ERROR_SOURCES),
  service: z.enum(OPS_SERVICES),
  error_type: z.string(),
  message: z.string(),
  route: z.string().nullable(),
  status: z.enum(OPS_ERROR_STATUSES),
  occurrence_count: count,
  regression_count: count,
  first_seen_at: instant,
  last_seen_at: instant,
  last_regressed_at: nullableInstant,
  first_version: z.string(),
  last_version: z.string(),
});

function groupOf(row: z.infer<typeof groupRowSchema>): OpsErrorGroup {
  return {
    id: row.id,
    source: row.source,
    service: row.service,
    errorType: row.error_type,
    message: row.message,
    route: row.route,
    status: row.status,
    occurrenceCount: row.occurrence_count,
    regressionCount: row.regression_count,
    firstSeenAt: ms(row.first_seen_at),
    lastSeenAt: ms(row.last_seen_at),
    lastRegressedAt: msOrNull(row.last_regressed_at),
    firstVersion: row.first_version,
    lastVersion: row.last_version,
    regression:
      row.regression_count > 0 &&
      (row.status === "new" || row.status === "acknowledged"),
  };
}

const errorsRowSchema = z.object({
  counts: z.object({
    new: count,
    acknowledged: count,
    fixed: count,
    ignored: count,
    regression: count,
  }),
  groups: z.array(groupRowSchema),
});

export async function readErrorGroups(
  tx: Transaction,
  state: OpsErrorFilter,
  source: (typeof OPS_ERROR_SOURCES)[number] | null,
): Promise<OpsErrorsResponse> {
  // one more than the cap: the screen says when the list is cut
  const answer = errorsRowSchema.parse(
    await database.errorGroups(tx, state, source, OPS_ERROR_LIST_CAP + 1),
  );
  return {
    state,
    source,
    counts: answer.counts,
    groups: answer.groups.slice(0, OPS_ERROR_LIST_CAP).map(groupOf),
    truncated: answer.groups.length > OPS_ERROR_LIST_CAP,
  };
}

const detailRowSchema = z
  .object({
    group: groupRowSchema,
    occurrences: z.array(
      z.object({
        occurred_at: instant,
        service: z.enum(OPS_SERVICES),
        version: z.string(),
        route: z.string().nullable(),
        request_id: z.uuid().nullable(),
        account_id: z.uuid().nullable(),
        message: z.string(),
        stack: z.string().nullable(),
        user_agent_summary: z.string().nullable(),
      }),
    ),
  })
  .nullable();

/** One group and its kept occurrences; null for an unknown group (the route answers 404). */
export async function readErrorGroup(
  tx: Transaction,
  groupId: string,
): Promise<OpsErrorDetailResponse | null> {
  const detail = detailRowSchema.parse(
    (await database.errorGroup(tx, groupId)) ?? null,
  );
  if (detail === null) {
    return null;
  }
  return {
    group: groupOf(detail.group),
    occurrences: detail.occurrences.map((occurrence) => ({
      occurredAt: ms(occurrence.occurred_at),
      service: occurrence.service,
      version: occurrence.version,
      route: occurrence.route,
      requestId: occurrence.request_id,
      accountId: occurrence.account_id,
      message: occurrence.message,
      stack: occurrence.stack,
      userAgentSummary: occurrence.user_agent_summary,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Traffic
// ---------------------------------------------------------------------------------------------

const cellSchema = z.object({
  at: instant,
  count,
  server_errors: count,
  throttled: count,
  buckets: z.array(count).length(DURATION_BUCKETS_MS.length + 1),
});
type Cell = z.infer<typeof cellSchema>;

const trafficRowSchema = z.object({
  now: instant,
  from: instant,
  bucket_seconds: z.number().int().positive(),
  routes: z.array(
    z.object({
      method: z.enum(["GET", "POST", "PATCH", "PUT", "DELETE"]),
      route: z.string(),
      cells: z.array(cellSchema).nullable(),
    }),
  ),
  totals: z.array(cellSchema),
});

const MINUTE_MS = 60_000;

/** The p95 of a histogram: the upper bound of its bucket, 5 s and `beyond` for the last one. */
function p95Of(buckets: readonly number[]): {
  p95Ms: number | null;
  p95Beyond: boolean;
} {
  const bound = p95UpperBoundMs(buckets);
  if (bound === null) {
    return { p95Ms: null, p95Beyond: false };
  }
  return Number.isFinite(bound)
    ? { p95Ms: bound, p95Beyond: false }
    : {
        p95Ms: DURATION_BUCKETS_MS[DURATION_BUCKETS_MS.length - 1] ?? 0,
        p95Beyond: true,
      };
}

function addUp(cells: readonly Cell[]): {
  calls: number;
  serverErrors: number;
  throttled: number;
  buckets: number[];
} {
  const buckets: number[] = Array.from(
    { length: DURATION_BUCKETS_MS.length + 1 },
    () => 0,
  );
  let calls = 0;
  let serverErrors = 0;
  let throttled = 0;
  for (const cell of cells) {
    calls += cell.count;
    serverErrors += cell.server_errors;
    throttled += cell.throttled;
    for (const [index, value] of cell.buckets.entries()) {
      buckets[index] = (buckets[index] ?? 0) + value;
    }
  }
  return { calls, serverErrors, throttled, buckets };
}

function summaryOf(
  cells: readonly Cell[],
  minutes: number,
): OpsTrafficSummary {
  const sum = addUp(cells);
  return {
    calls: sum.calls,
    callsPerMinute: sum.calls / Math.max(1, minutes),
    serverErrors: sum.serverErrors,
    throttled: sum.throttled,
    ...p95Of(sum.buckets),
  };
}

/**
 * Every bucket of the window, in order, zeros where nothing was measured. The last one is still in
 * progress: its minutes are the ones elapsed (a minute is written once it ends), at least one.
 */
function pointsOf(
  cells: readonly Cell[],
  fromMs: number,
  nowMs: number,
  stepMs: number,
): OpsTrafficPoint[] {
  const byInstant = new Map(
    cells.map((cell) => [Date.parse(cell.at), cell] as const),
  );
  const points: OpsTrafficPoint[] = [];
  for (let at = fromMs; at <= nowMs; at += stepMs) {
    const open = nowMs < at + stepMs;
    const minutes = open
      ? Math.min(stepMs / MINUTE_MS, Math.floor((nowMs - at) / MINUTE_MS))
      : stepMs / MINUTE_MS;
    const cell = byInstant.get(at);
    const sum = addUp(cell === undefined ? [] : [cell]);
    points.push({
      at: new Date(at).toISOString(),
      calls: sum.calls,
      callsPerMinute: sum.calls / Math.max(1, minutes),
      serverErrors: sum.serverErrors,
      throttled: sum.throttled,
      ...p95Of(sum.buckets),
      open,
    });
  }
  return points;
}

export async function readTraffic(
  tx: Transaction,
  window: OpsTrafficWindow,
): Promise<OpsTrafficResponse> {
  const traffic = trafficRowSchema.parse(await database.traffic(tx, window));
  const fromMs = Date.parse(traffic.from);
  const nowMs = Date.parse(traffic.now);
  const stepMs = traffic.bucket_seconds * 1000;
  // the minutes written so far in the window: the current minute is written once it has ended
  const windowMinutes = Math.floor((nowMs - fromMs) / MINUTE_MS);

  return {
    window,
    now: ms(traffic.now),
    from: ms(traffic.from),
    bucketSeconds: traffic.bucket_seconds,
    total: {
      summary: summaryOf(traffic.totals, windowMinutes),
      points: pointsOf(traffic.totals, fromMs, nowMs, stepMs),
    },
    routes: traffic.routes.slice(0, OPS_TRAFFIC_ROUTE_CAP).map((route) => {
      const cells = route.cells ?? [];
      return {
        method: route.method,
        route: route.route,
        summary: summaryOf(cells, windowMinutes),
        points: pointsOf(cells, fromMs, nowMs, stepMs),
      };
    }),
  };
}

// ---------------------------------------------------------------------------------------------
// Processes and database
// ---------------------------------------------------------------------------------------------

const sampleSchema = z.object({
  minute: instant,
  connections: count,
  max_connections: z.number().int().positive(),
});

const processesRowSchema = z.object({
  now: instant,
  processes: z.array(
    z.object({
      service: z.enum(["api", "worker"]),
      instance: z.string(),
      last_minute: instant,
      event_loop_delay_p99_ms: z.number().nonnegative(),
      event_loop_delay_max_ms: z.number().nonnegative(),
      rss_bytes: count,
      heap_used_bytes: count,
      cpu_percent: z.number().nonnegative(),
      hour: z.object({
        samples: count,
        event_loop_delay_p99_avg_ms: z.number().nonnegative().nullable(),
        event_loop_delay_max_ms: z.number().nonnegative().nullable(),
        rss_max_bytes: count.nullable(),
        cpu_max_percent: z.number().nonnegative().nullable(),
      }),
    }),
  ),
  database: z.object({
    last: sampleSchema.nullable(),
    peak_24h: count.nullable(),
    samples: z.array(sampleSchema),
  }),
});

export async function readProcesses(
  tx: Transaction,
): Promise<OpsProcessesResponse> {
  const answer = processesRowSchema.parse(await database.processes(tx));
  const sampleOf = (sample: z.infer<typeof sampleSchema>) => ({
    minute: ms(sample.minute),
    connections: sample.connections,
    maxConnections: sample.max_connections,
  });
  return {
    now: ms(answer.now),
    processes: answer.processes.map((process) => ({
      service: process.service,
      instance: process.instance,
      lastMinute: ms(process.last_minute),
      ageSeconds: secondsBetween(answer.now, process.last_minute),
      eventLoopDelayP99Ms: process.event_loop_delay_p99_ms,
      eventLoopDelayMaxMs: process.event_loop_delay_max_ms,
      rssBytes: process.rss_bytes,
      heapUsedBytes: process.heap_used_bytes,
      cpuPercent: process.cpu_percent,
      hour: {
        samples: process.hour.samples,
        eventLoopDelayP99AvgMs: process.hour.event_loop_delay_p99_avg_ms,
        eventLoopDelayMaxMs: process.hour.event_loop_delay_max_ms,
        rssMaxBytes: process.hour.rss_max_bytes,
        cpuMaxPercent: process.hour.cpu_max_percent,
      },
    })),
    database: {
      last: answer.database.last === null ? null : sampleOf(answer.database.last),
      lastAgeSeconds:
        answer.database.last === null
          ? null
          : secondsBetween(answer.now, answer.database.last.minute),
      peak24h: answer.database.peak_24h,
      samples: answer.database.samples.map(sampleOf),
    },
  };
}
