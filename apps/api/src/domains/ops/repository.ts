// Writes of the ops schema (migration 0016), under influx_ops inside an E-6 transaction
// (src/domains/ops/recorder.ts). Values are already cleaned by scrub.ts; nothing is read back
// but the upsert of a group (02 §20.5). Last versions are bound, never read from `excluded`.
import { sql } from "drizzle-orm";
import type { Transaction } from "../../db/index.ts";

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

export type TelemetryBatch = {
  version: string;
  instance: string;
  occurrences: readonly Occurrence[];
  extras: readonly { fingerprint: Buffer; count: number }[];
  minutes: readonly { minute: number; cells: readonly RequestCell[] }[];
  processSample: ProcessSample | null;
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
