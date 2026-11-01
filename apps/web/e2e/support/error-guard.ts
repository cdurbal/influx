// End-of-run guard (PLT-3): a run that leaves new rows in ops.error_occurrences fails, so that a
// server error nobody looks at (the 500 of PLT-1 stayed invisible for 33 rows) cannot pass.
// Counted from a mark taken by globalSetup, never in absolute: the rows of earlier runs stay.
// Rows are named by source, service, type, route, time and request id, nothing else (02 §20.8).
// The last flush of the recorder (every 10 s, apps/api/src/domains/ops/recorder.ts) stays out of
// reach: nothing waits for it here.
import type { connectAsMigrationRole } from "@influx/test-kit/db";

type Sql = ReturnType<typeof connectAsMigrationRole>;

/**
 * One entry per deliberate case, never a pattern: a row is excluded only when its service, type
 * and route all equal an entry. Empty at the survey (PL-fix-2): J8T-4 stubs
 * `/api/v1/bo/ops/errors*` in the browser, no case calls the collector.
 */
export interface ErrorExclusion {
  readonly service: string;
  readonly errorType: string;
  readonly route: string;
  readonly reason: string;
}
export const ERROR_EXCLUSIONS: readonly ErrorExclusion[] = [];

export interface ErrorOccurrenceRow {
  id: string;
  source: string;
  service: string;
  error_type: string;
  route: string | null;
  occurred_at: string;
  request_id: string | null;
}

/** The highest occurrence id now, the mark counted from (0 when the table is empty). */
export async function readErrorMark(sql: Sql): Promise<string> {
  const rows = await sql<{ mark: string }[]>`
    select coalesce(max(id), 0)::text as mark from ops.error_occurrences`;
  return rows[0]?.mark ?? "0";
}

/** The occurrences recorded after the mark and not excluded, oldest first. */
export async function readNewErrors(
  sql: Sql,
  mark: string,
  exclusions: readonly ErrorExclusion[] = ERROR_EXCLUSIONS,
): Promise<ErrorOccurrenceRow[]> {
  const rows = await sql<ErrorOccurrenceRow[]>`
    select o.id::text as id, g.source::text as source, o.service::text as service,
           g.error_type, o.route, o.occurred_at::text as occurred_at, o.request_id::text as request_id
      from ops.error_occurrences o
      join ops.error_groups g on g.fingerprint = o.group_fingerprint
     where o.id > ${mark}::bigint
     order by o.id`;
  return rows.filter(
    (row) =>
      !exclusions.some(
        (exclusion) =>
          exclusion.service === row.service &&
          exclusion.errorType === row.error_type &&
          exclusion.route === row.route,
      ),
  );
}

/** Throws, naming every new occurrence, when the run left any. */
export async function assertNoNewErrors(
  sql: Sql,
  mark: string,
  exclusions: readonly ErrorExclusion[] = ERROR_EXCLUSIONS,
): Promise<void> {
  const rows = await readNewErrors(sql, mark, exclusions);
  if (rows.length === 0) return;
  const lines = rows.map(
    (row) =>
      `  #${row.id} ${row.source}/${row.service} ${row.error_type} ${row.route ?? "-"} ` +
      `at ${row.occurred_at} request ${row.request_id ?? "-"}`,
  );
  throw new Error(
    `${rows.length} server error occurrence(s) recorded in ops.error_occurrences during the run ` +
      `(PLT-3); fix the cause or add a named entry to ERROR_EXCLUSIONS:\n${lines.join("\n")}`,
  );
}
