// Database access of E-4 `maintenance.run_periodic` (decision 3 of the J7 start; migrations 0116 and
// 0117): the functions of influx_maintenance_definer and leads.record_brevo_reconciliation_event(),
// all executable by influx_worker only. Every value is a bound parameter (S-1); the caller holds
// the elevated transaction (periodic.ts).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../db/index.ts";

/**
 * The closed list of ops.periodic_task (0117; data_export_purge: 0136, J8 commit 8; ops_retention:
 * 0147, J9 commit 8).
 */
export const PERIODIC_TASKS = [
  "brevo_reconciliation",
  "auth_orphan_purge",
  "brevo_inbound_purge",
  "data_export_purge",
  "ops_retention",
] as const;
export type PeriodicTask = (typeof PERIODIC_TASKS)[number];

/** A claimed run: its id (the register subject) and its attempt (the fencing token). */
export type PeriodicRun = {
  runId: string;
  attempt: number;
};

/** Counts of a run: non-negative integers keyed by snake_case names (0117). */
export type PeriodicCounts = Record<string, number>;

/** Claims the current period of a task; null when it is finished or running elsewhere. */
export async function claimPeriodicRun(
  tx: Transaction,
  task: PeriodicTask,
  periodKey: string,
): Promise<PeriodicRun | null> {
  const rows = await tx.execute<{ run_id: string; attempt: number }>(
    sql`select run_id::text as run_id, attempt
          from ops.claim_periodic_run(${task}::ops.periodic_task, ${periodKey})`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { runId: row.run_id, attempt: Number(row.attempt) };
}

/** Closes the run of this attempt; false when it was taken back meanwhile (nothing written). */
export async function finishPeriodicRun(
  tx: Transaction,
  run: PeriodicRun,
  outcome: "succeeded" | "failed",
  counts: PeriodicCounts,
): Promise<boolean> {
  const rows = await tx.execute<{ done: boolean }>(
    sql`select ops.finish_periodic_run(${run.runId}::uuid, ${run.attempt}::smallint,
                 ${outcome}::ops.periodic_run_outcome, ${JSON.stringify(counts)}::text::jsonb)
                 as done`,
  );
  return rows[0]?.done === true;
}

/** A finding of the reconciliation, written as a raw line (origin reconciliation). */
export type ReconciliationFinding = {
  event: "unsubscribed" | "spam";
  /** ISO 8601, UTC, whole seconds. */
  occurredAt: string;
  messageId: string | null;
  email: string;
  /** INFLUX_ACCOUNT_ID of the Brevo contact, when it holds a valid one. */
  accountRef: string | null;
};

/** The new raw line's id; null when the event is already known (RG146-5). 22023 is thrown. */
export async function recordReconciliationEvent(
  tx: Transaction,
  finding: ReconciliationFinding,
): Promise<string | null> {
  const rows = await tx.execute<{ id: string | null }>(
    sql`select leads.record_brevo_reconciliation_event(
          ${finding.event}, ${finding.occurredAt}::timestamptz, ${finding.messageId},
          ${finding.email}, ${finding.accountRef}::uuid, null::bigint, null::bigint,
          null::text)::text as id`,
  );
  return rows[0]?.id ?? null;
}

/** 04 §9: those of the GoTrue ids (at most 1000) no account references, on auth_user_id only. */
export async function filterAuthOrphans(
  tx: Transaction,
  run: PeriodicRun,
  authUserIds: readonly string[],
): Promise<string[]> {
  const rows = await tx.execute<{ auth_user_id: string }>(
    sql`select auth_user_id::text as auth_user_id
          from ops.filter_auth_orphans(${run.runId}::uuid, ${run.attempt}::smallint,
                 ${`{${authUserIds.join(",")}}`}::uuid[])`,
  );
  return rows.map((row) => row.auth_user_id);
}

/** The register line retention.purged of the GoTrue purge (category auth_orphan_users). */
export async function recordAuthOrphanPurge(
  tx: Transaction,
  run: PeriodicRun,
  count: number,
): Promise<void> {
  await tx.execute(
    sql`select ops.record_retention_purge(${run.runId}::uuid, ${run.attempt}::smallint,
                 'auth_orphan_users', ${count}::integer)`,
  );
}

/** Decision 2: raw Brevo lines 30 days after their outcome, at most `limit`; the count deleted. */
export async function purgeBrevoInboundEvents(
  tx: Transaction,
  run: PeriodicRun,
  limit: number,
): Promise<number> {
  const rows = await tx.execute<{ count: number }>(
    sql`select ops.purge_brevo_inbound_events(${run.runId}::uuid, ${run.attempt}::smallint,
                 ${limit}::integer) as count`,
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * Runbook demandes-rgpd §4 (0136): the content of the exports expired or downloaded three times is
 * erased, their digest kept; at most `limit` per call. retention.purged written by the database.
 */
export async function purgeDataExports(
  tx: Transaction,
  run: PeriodicRun,
  limit: number,
): Promise<number> {
  const rows = await tx.execute<{ count: number }>(
    sql`select ops.purge_data_exports(${run.runId}::uuid, ${run.attempt}::smallint,
                 ${limit}::integer) as count`,
  );
  return Number(rows[0]?.count ?? 0);
}

/**
 * 0147 (02 §20.5, §20.8): one bounded step of the retention of ops — the closed hours rolled up,
 * the minutes after 14 days, the occurrences after 30 days, the hours after 13 months… Its counts,
 * with `more` = 1 when a bound was reached (call again, in a new transaction). retention.purged is
 * written by the database.
 */
export async function runOpsRetention(
  tx: Transaction,
  run: PeriodicRun,
): Promise<PeriodicCounts> {
  const rows = await tx.execute<{ counts: unknown }>(
    sql`select ops.run_ops_retention(${run.runId}::uuid, ${run.attempt}::smallint) as counts`,
  );
  const counts = rows[0]?.counts;
  if (typeof counts !== "object" || counts === null || Array.isArray(counts)) {
    throw new Error("ops.run_ops_retention answered no counts");
  }
  const result: PeriodicCounts = {};
  for (const [name, value] of Object.entries(counts)) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
      result[name] = value;
    }
  }
  return result;
}

/** C5.b (0125): an account to realign at GoTrue, with its address in force (never logged). */
export type RealignmentCandidate = {
  accountId: string;
  authUserId: string;
  email: string;
};

/**
 * The accounts whose GoTrue user may not hold the address in force (an address change confirmed in
 * the last 72 hours, none in the last 15 minutes); all of them, or the one named, read again just
 * before a write.
 */
export async function gotrueRealignmentCandidates(
  tx: Transaction,
  run: PeriodicRun,
  accountId: string | null,
): Promise<RealignmentCandidate[]> {
  const rows = await tx.execute<{
    account_id: string;
    auth_user_id: string;
    email: string;
  }>(
    sql`select account_id::text as account_id, auth_user_id::text as auth_user_id, email
          from ops.gotrue_realignment_candidates(${run.runId}::uuid, ${run.attempt}::smallint,
                 ${accountId}::uuid)`,
  );
  return rows.map((row) => ({
    accountId: row.account_id,
    authUserId: row.auth_user_id,
    email: row.email,
  }));
}
