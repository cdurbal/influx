// The calls of E-5 `privacy.execute_request` (docs/mvp/03 P7; 15 RG75 to RG79; 04 §9.2; 21 §J8
// point 6; migration 0136). Each is one statement in the elevated transaction of execution.ts, on
// the pool of influx_privacy_login (never influx_worker_login). The functions check everything
// themselves: an approval under 2V + R (an admin, from the account sheet), the requester's account,
// the closing conditions (Brevo confirmed, 15 RG79).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../db/index.ts";

/** The two types the minimal execution covers (21 §J8 point 6); any other is never executed. */
export type ExecutableRequestType = "access" | "erasure";

/**
 * What remains to do on an approved request (privacy.pending_work, 0136):
 *   execute           approved, not executed yet: the export or the anonymisation
 *   delete_auth_user  an erasure executed, its Supabase Auth user still to delete
 *   complete          executed: closed once its propagation is confirmed (15 RG79)
 */
export type PendingStep = "execute" | "delete_auth_user" | "complete";

export type PendingWork = {
  requestId: string;
  requestType: ExecutableRequestType;
  step: PendingStep;
  accountId: string;
  /** `execute` only: the account's language, for the notice of an export. */
  preferredLanguage: string | null;
  /** `delete_auth_user` only. */
  authUserId: string | null;
};

const STEPS: readonly string[] = ["execute", "delete_auth_user", "complete"];
const TYPES: readonly string[] = ["access", "erasure"];

export async function pendingWork(
  tx: Transaction,
  limit: number,
): Promise<PendingWork[]> {
  const rows = await tx.execute<{
    request_id: string;
    request_type: string;
    step: string;
    account_id: string;
    preferred_language: string | null;
    auth_user_id: string | null;
  }>(
    sql`select request_id::text as request_id, request_type, step, account_id::text as account_id,
               preferred_language, auth_user_id::text as auth_user_id
          from privacy.pending_work(${limit}::integer)`,
  );
  return rows.flatMap((row) =>
    // A value outside the closed lists is never acted on (the database's, read again here).
    STEPS.includes(row.step) && TYPES.includes(row.request_type)
      ? [
          {
            requestId: row.request_id,
            requestType: row.request_type as ExecutableRequestType,
            step: row.step as PendingStep,
            accountId: row.account_id,
            preferredLanguage: row.preferred_language,
            authUserId: row.auth_user_id,
          },
        ]
      : [],
  );
}

export type ExecutedRequest = {
  requestType: ExecutableRequestType;
  /** Erasure: the Supabase Auth user to delete once committed; null for an export. */
  authUserId: string | null;
};

/**
 * The execution (0136): an export (with its notice, stored in the file) or an anonymisation, the
 * queue facts and the register lines, in this transaction. null: not approved, already executed, or
 * locked by another instance (`skip locked`): nothing was written.
 */
export async function executeRequest(
  tx: Transaction,
  requestId: string,
  notice: Readonly<Record<string, unknown>> | null,
): Promise<ExecutedRequest | null> {
  const rows = await tx.execute<{
    request_type: string;
    auth_user_id: string | null;
  }>(
    sql`select request_type, auth_user_id::text as auth_user_id
          from privacy.execute_request(${requestId}::uuid,
                 ${notice === null ? null : JSON.stringify(notice)}::jsonb)`,
  );
  const row = rows[0];
  if (row === undefined || !TYPES.includes(row.request_type)) {
    return null;
  }
  return {
    requestType: row.request_type as ExecutableRequestType,
    authUserId: row.auth_user_id,
  };
}

/** The Supabase Auth user of an erasure deleted: true when this call recorded it. */
export async function recordAuthUserDeleted(
  tx: Transaction,
  requestId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ recorded: boolean }>(
    sql`select privacy.record_auth_user_deleted(${requestId}::uuid) as recorded`,
  );
  return rows[0]?.recorded === true;
}

/** The closing (15 RG77, RG79): the outcome when it closed now, null while Brevo has not confirmed. */
export async function completeRequest(
  tx: Transaction,
  requestId: string,
): Promise<string | null> {
  const rows = await tx.execute<{ outcome: string | null }>(
    sql`select privacy.complete_request(${requestId}::uuid) as outcome`,
  );
  return rows[0]?.outcome ?? null;
}
