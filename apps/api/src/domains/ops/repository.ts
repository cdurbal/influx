// Database access of the ops schema (migrations 0016, 0147). Two parts, never one transaction:
// - the writes of the collection, under influx_ops inside an E-6 transaction (recorder.ts). Values
//   are already cleaned by scrub.ts; nothing is read back but the upsert of a group (02 §20.5).
//   Last versions are bound, never read from `excluded`;
// - the active monitoring of D60 (02 §11.3, §20.5; 15 RG165): the functions of ops that the worker
//   calls under E-4 (worker-monitor.ts) and the api under E-6 (worker-watch.ts). The caller holds
//   the elevated transaction and names its operation: this module names none (18 T6.3). The jsonb
//   answers are read through a schema: an unexpected shape is an error, never a guess. No address
//   is ever written (02 §20.8); the admin addresses are only read back.
// Every value is a bound parameter (S-1).
import { sql } from "drizzle-orm";
import * as z from "zod";
import type { Transaction } from "../../db/index.ts";
import type {
  AlertDefinition,
  AlertSnapshot,
  ProbeResult,
  StoredAlertState,
  WorkerLiveness,
} from "./technical-alerts.ts";

export type Occurrence = {
  fingerprint: Buffer;
  source: "server" | "browser";
  service: "api" | "web" | "backoffice";
  errorType: string;
  groupMessage: string;
  message: string;
  route: string | null;
  stack: string | null;
  requestId: string | null;
  accountId: string | null;
  userAgentSummary: string | null;
};

export type RequestCell = {
  method: string;
  route: string;
  count: number;
  serverErrors: number;
  throttled: number;
  buckets: number[];
};

export type ProcessSample = {
  minute: number;
  p99: number;
  max: number;
  rss: number;
  heap: number;
  cpu: number;
};

/**
 * The signals of the api counted per minute for the technical alerts (ops.signal, 0147; 15 RG165,
 * AL61 and AL62): the authenticated calls of the Brevo webhook, those that wrote nothing, and those
 * with a valid token from outside Brevo's ranges.
 */
export const OPS_SIGNALS = [
  "webhook_brevo_authenticated",
  "webhook_brevo_ignored",
  "webhook_brevo_ip_drift",
] as const;
export type OpsSignal = (typeof OPS_SIGNALS)[number];

export type TelemetryBatch = {
  version: string;
  instance: string;
  occurrences: readonly Occurrence[];
  extras: readonly { fingerprint: Buffer; count: number }[];
  minutes: readonly { minute: number; cells: readonly RequestCell[] }[];
  processSample: ProcessSample | null;
  signals: readonly {
    minute: number;
    counts: readonly { signal: OpsSignal; count: number }[];
  }[];
};

export async function writeTelemetry(
  tx: Transaction,
  batch: TelemetryBatch,
): Promise<void> {
  for (const occurrence of batch.occurrences) {
    await tx.execute(sql`
        insert into ops.error_groups
          (fingerprint, source, service, error_type, message, route, first_version,
           last_version)
        values (${occurrence.fingerprint}, ${occurrence.source}::ops.error_source,
                ${occurrence.service}::ops.service_name, ${occurrence.errorType},
                ${occurrence.groupMessage}, ${occurrence.route}, ${batch.version},
                ${batch.version})
        on conflict (fingerprint) do update
           set occurrence_count = ops.error_groups.occurrence_count + 1,
               last_version = ${batch.version}`);
    await tx.execute(sql`
        insert into ops.error_occurrences
          (group_fingerprint, service, version, route, request_id, account_id, message,
           stack, user_agent_summary)
        values (${occurrence.fingerprint}, ${occurrence.service}::ops.service_name,
                ${batch.version}, ${occurrence.route}, ${occurrence.requestId}::uuid,
                ${occurrence.accountId}::uuid, ${occurrence.message}, ${occurrence.stack},
                ${occurrence.userAgentSummary})`);
  }
  for (const extra of batch.extras) {
    // A fingerprint over the cap whose group may not exist yet (dropped first occurrence):
    // nothing to add to, the count is lost rather than a group invented.
    await tx.execute(sql`
        update ops.error_groups
           set occurrence_count = occurrence_count + ${extra.count}
         where fingerprint = ${extra.fingerprint}`);
  }
  for (const { minute, cells } of batch.minutes) {
    for (const cell of cells) {
      await tx.execute(sql`
          insert into ops.request_metrics
            (minute, service, instance, method, route, request_count, server_error_count,
             throttled_count, duration_buckets)
          values (${new Date(minute).toISOString()}::timestamptz, 'api', ${batch.instance},
                  ${cell.method}, ${cell.route}, ${cell.count}, ${cell.serverErrors},
                  ${cell.throttled}, ${`{${cell.buckets.join(",")}}`}::integer[])
          on conflict do nothing`);
    }
  }
  for (const { minute, counts } of batch.signals) {
    for (const { signal, count } of counts) {
      await tx.execute(sql`
          insert into ops.signal_counts (minute, service, instance, signal, count)
          values (${new Date(minute).toISOString()}::timestamptz, 'api', ${batch.instance},
                  ${signal}::ops.signal, ${count})
          on conflict do nothing`);
    }
  }
  if (batch.processSample !== null) {
    await tx.execute(sql`
        insert into ops.process_metrics
          (minute, service, instance, event_loop_delay_p99_ms, event_loop_delay_max_ms,
           rss_bytes, heap_used_bytes, cpu_percent)
        values (${new Date(batch.processSample.minute).toISOString()}::timestamptz, 'api',
                ${batch.instance}, ${batch.processSample.p99}, ${batch.processSample.max},
                ${batch.processSample.rss}, ${batch.processSample.heap}, ${batch.processSample.cpu})
        on conflict do nothing`);
  }
}

// ---------------------------------------------------------------------------------------------
// The active monitoring (0147)
// ---------------------------------------------------------------------------------------------

/** The scopes of ops.alert_states: the worker's alerts, and AL50 of the api. */
export type AlertScope = "worker" | "api";

export type HeartbeatInput = {
  workerId: string;
  instance: string;
  version: string;
  /** The start of the process by the database clock (its start step). */
  startedAt: string;
  loopTurned: boolean;
};

export async function recordWorkerHeartbeat(
  tx: Transaction,
  beat: HeartbeatInput,
): Promise<void> {
  await tx.execute(
    sql`select ops.record_worker_heartbeat(${beat.workerId}, ${beat.instance}, ${beat.version},
                                           ${beat.startedAt}::timestamptz, ${beat.loopTurned})`,
  );
}

/** Writes the results of the probe; returns the number written. */
export async function recordProbeResults(
  tx: Transaction,
  instance: string,
  results: readonly ProbeResult[],
): Promise<number> {
  const payload = JSON.stringify(
    results.map((result) => ({
      target: result.target,
      checked_at: result.checkedAt,
      outcome: result.outcome,
      status_code: result.statusCode,
      failure_code: result.failureCode,
      duration_ms: result.durationMs,
    })),
  );
  const rows = await tx.execute<{ written: number }>(
    sql`select ops.record_probe_results(${instance}, ${payload}::jsonb)::int as written`,
  );
  return rows[0]?.written ?? 0;
}

export async function recordDatabaseSample(tx: Transaction): Promise<void> {
  await tx.execute(sql`select ops.record_database_sample()`);
}

/** The active admin accounts, the break-glass account excluded: addresses read, never written. */
export async function adminAlertRecipients(tx: Transaction): Promise<string[]> {
  const rows = await tx.execute<{ email: string }>(
    sql`select email from ops.admin_alert_recipients() order by account_id`,
  );
  return rows.map((row) => row.email);
}

// ---------------------------------------------------------------------------------------------
// Shapes of the jsonb answers
// ---------------------------------------------------------------------------------------------

const instant = z.string().min(1);
const count = z.number().int().nonnegative();
const measure = z.number().finite().nullable();

const definitionSchema = z
  .object({
    nature: z.enum(["etat", "evenement"]),
    threshold: z.record(z.string(), z.unknown()),
    recipient_roles: z.array(z.string()),
    is_active: z.boolean(),
  })
  .transform((row): AlertDefinition => ({
    nature: row.nature,
    threshold: row.threshold,
    recipientRoles: row.recipient_roles,
    isActive: row.is_active,
  }));

const newGroupSchema = z
  .object({
    id: z.string(),
    error_type: z.string(),
    route: z.string().nullable(),
    first_seen_at: instant,
  })
  .transform((row) => ({
    id: row.id,
    errorType: row.error_type,
    route: row.route,
    at: row.first_seen_at,
  }));

const regressionSchema = z
  .object({
    id: z.string(),
    error_type: z.string(),
    route: z.string().nullable(),
    last_regressed_at: instant,
  })
  .transform((row) => ({
    id: row.id,
    errorType: row.error_type,
    route: row.route,
    at: row.last_regressed_at,
  }));

const measuresSchema = z
  .object({
    AL48: z
      .object({
        sends: count,
        median_delivery_seconds: measure,
        p90_delivery_seconds: measure,
        no_sign_in_share_bp: measure,
        delivered_share_bp: measure,
      })
      .transform((m) => ({
        sends: m.sends,
        medianDeliverySeconds: m.median_delivery_seconds,
        p90DeliverySeconds: m.p90_delivery_seconds,
        noSignInShareBp: m.no_sign_in_share_bp,
        deliveredShareBp: m.delivered_share_bp,
      })),
    AL51: z
      .object({
        new_groups: z.array(newGroupSchema),
        regressions: z.array(regressionSchema),
      })
      .transform((m) => ({
        newGroups: m.new_groups,
        regressions: m.regressions,
      })),
    AL52: z
      .object({ requests: count, server_errors: count })
      .transform((m) => ({
        requests: m.requests,
        serverErrors: m.server_errors,
      })),
    AL53: z.object({ buckets: z.array(count).length(9) }),
    AL55: z
      .object({
        calls_per_minute: z.number().finite().nonnegative(),
        usual_calls_per_minute: measure,
        history_days: z.number().finite().nonnegative(),
      })
      .transform((m) => ({
        callsPerMinute: m.calls_per_minute,
        usualCallsPerMinute: m.usual_calls_per_minute,
        historyDays: m.history_days,
      })),
    AL56: z.object({ requests: count, throttled: count }),
    AL57: z.object({
      services: z.array(
        z
          .object({
            service: z.string(),
            minutes: count,
            avg_event_loop_delay_ms: z.number().finite().nonnegative(),
            avg_rss_bytes: z.number().finite().nonnegative(),
          })
          .transform((s) => ({
            service: s.service,
            minutes: s.minutes,
            avgEventLoopDelayMs: s.avg_event_loop_delay_ms,
            avgRssBytes: s.avg_rss_bytes,
          })),
      ),
    }),
    AL58: z.object({
      samples: z.array(
        z
          .object({
            minute: instant,
            connections: count,
            max_connections: count,
          })
          .transform((s) => ({
            minute: s.minute,
            connections: s.connections,
            maxConnections: s.max_connections,
          })),
      ),
    }),
    AL59: z.object({
      targets: z.array(z.object({ key: z.string(), failures: count })),
    }),
    AL60: z.object({
      runs: z.array(
        z
          .object({
            run_id: z.string(),
            finished_at: instant,
            realign_failed: count,
            breaker: z.string().nullable(),
          })
          .transform((r) => ({
            runId: r.run_id,
            finishedAt: r.finished_at,
            realignFailed: r.realign_failed,
            breaker: r.breaker,
          })),
      ),
    }),
    AL61: z.object({ authenticated: count, ignored: count }),
    AL62: z
      .object({ occurrences: count, last_at: instant.nullable() })
      .transform((m) => ({ occurrences: m.occurrences, lastAt: m.last_at })),
    AL63: z.object({
      executions: z.array(
        z
          .object({ id: z.string(), executed_at: instant })
          .transform((e) => ({ id: e.id, executedAt: e.executed_at })),
      ),
    }),
  })
  .partial();

const snapshotSchema = z.object({
  now: instant,
  definitions: z.record(z.string(), definitionSchema),
  measures: measuresSchema,
});

/** What the evaluator of the worker reads (new error groups after `newErrorsSince`). */
export async function technicalAlertSnapshot(
  tx: Transaction,
  newErrorsSince: string,
): Promise<AlertSnapshot> {
  const rows = await tx.execute<{ snapshot: unknown }>(
    sql`select ops.technical_alert_snapshot(${newErrorsSince}::timestamptz) as snapshot`,
  );
  return snapshotSchema.parse(rows[0]?.snapshot);
}

const livenessSchema = z
  .object({
    now: instant,
    last_beat_at: instant.nullable(),
    last_loop_turn_at: instant.nullable(),
    definition: definitionSchema.nullable(),
  })
  .transform((row): WorkerLiveness => ({
    now: row.now,
    lastBeatAt: row.last_beat_at,
    lastLoopTurnAt: row.last_loop_turn_at,
    definition: row.definition,
  }));

export async function workerLiveness(tx: Transaction): Promise<WorkerLiveness> {
  const rows = await tx.execute<{ liveness: unknown }>(
    sql`select ops.worker_liveness() as liveness`,
  );
  return livenessSchema.parse(rows[0]?.liveness);
}

// ---------------------------------------------------------------------------------------------
// States of the alerts (15 RG165: deduplication), under the lock of their scope
// ---------------------------------------------------------------------------------------------

const valueSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.null()]),
);

const stateSchema = z
  .object({
    code: z.string(),
    subject_key: z.string(),
    state: z.enum(["open", "resolved"]),
    opened_at: instant,
    last_notified_at: instant.nullable(),
    notified_count: count,
    resolved_at: instant.nullable(),
    last_value: valueSchema.nullable().optional(),
  })
  .transform((row): StoredAlertState => ({
    code: row.code,
    subjectKey: row.subject_key,
    state: row.state,
    openedAt: row.opened_at,
    lastNotifiedAt: row.last_notified_at,
    notifiedCount: row.notified_count,
    resolvedAt: row.resolved_at,
    lastValue: row.last_value ?? undefined,
  }));

/**
 * Takes the lock of the scope for this transaction and reads its states; null when another
 * instance holds it (it does the round).
 */
export async function beginAlertRound(
  tx: Transaction,
  scope: AlertScope,
): Promise<StoredAlertState[] | null> {
  const rows = await tx.execute<{ states: unknown }>(
    sql`select ops.begin_alert_round(${scope}) as states`,
  );
  const states = rows[0]?.states;
  return states === null || states === undefined
    ? null
    : z.array(stateSchema).parse(states);
}

export async function saveAlertStates(
  tx: Transaction,
  scope: AlertScope,
  states: readonly StoredAlertState[],
): Promise<void> {
  if (states.length === 0) {
    return;
  }
  const payload = JSON.stringify(
    states.map((state) => ({
      code: state.code,
      subject_key: state.subjectKey,
      state: state.state,
      opened_at: state.openedAt,
      last_notified_at: state.lastNotifiedAt,
      notified_count: state.notifiedCount,
      resolved_at: state.resolvedAt,
      last_value: state.lastValue ?? {},
    })),
  );
  await tx.execute(
    sql`select ops.save_alert_states(${scope}, ${payload}::jsonb)`,
  );
}
