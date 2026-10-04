// Database access of the identity domain for the member authentication, under the elevated role
// influx_auth (E-1, E-2; 03 P7). Parameterised queries only (S-1): every value is a bound
// parameter of drizzle's `sql` template; the enum types are cast in the text, never built.
// influx_auth has no table right on the counters: they are reached through the three SECURITY
// DEFINER functions of 0014 (EC-53 (2)).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../db/index.ts";

export type ThrottleScope =
  | "code_request_email"
  | "code_request_ip"
  | "code_request_unknown_ip"
  | "login_request"
  | "code_verify_ip"
  | "code_verify_platform";

export type ThrottleWindow = "15m" | "1h";

/** Reserves one attempt (0014): true while below the limit, false beyond. */
export async function reserveAuthAttempt(
  tx: Transaction,
  scope: ThrottleScope,
  key: Buffer,
  window: ThrottleWindow,
  limit: number,
): Promise<boolean> {
  const rows = await tx.execute<{ allowed: boolean }>(
    sql`select identity.reserve_auth_attempt(${scope}::identity.throttle_scope, ${key},
                                             ${window}::identity.throttle_window, ${limit})
               as allowed`,
  );
  return rows[0]?.allowed === true;
}

/**
 * The account an address belongs to, for the journal line (02 §18.10 step 3 d). A deleted
 * account is treated as unknown (05 RG70).
 */
export async function accountIdOfEmail(
  tx: Transaction,
  email: string,
): Promise<string | null> {
  const rows = await tx.execute<{ id: string }>(
    sql`select id from identity.accounts where email = ${email} and status <> 'deleted'`,
  );
  return rows[0]?.id ?? null;
}

export type LoginCodeSendLine = {
  /** Sequential id: the Idempotency-Key of Brevo only, never shown to a client. */
  id: string;
  /** Random reference (EC-3): the login cookie, the throttle key, the audit subject. */
  reference: string;
};

/**
 * Step 3 e of 02 §18.10: the P0 line, status `queued`, account xor address, no queue event.
 * The template version is COPIED (04 R7).
 */
export async function insertLoginCodeSend(
  tx: Transaction,
  line: {
    accountId: string | null;
    email: string;
    locale: string;
    templateVersion: number;
  },
): Promise<LoginCodeSendLine> {
  const recipientEmail = line.accountId === null ? line.email : null;
  const rows = await tx.execute<{ id: string; reference: string }>(
    sql`insert into leads.transactional_sends
          (email_code, priority, account_id, recipient_email, locale, template_ref,
           template_version)
        values ('auth.login_code', 'p0', ${line.accountId}, ${recipientEmail}, ${line.locale},
                'auth.login_code', ${line.templateVersion})
        returning id::text as id, reference::text as reference`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("journal line not inserted");
  }
  return row;
}

/** The three failure codes of a P0 line (0015, 05 RG60). */
export type LoginCodeFailure =
  "undeliverable_address" | "provider_unavailable" | "rate_limited";

/**
 * Step 8 of 02 §18.10: the outcome of the single attempt, on a line still `queued`. The instant
 * is written by the database (0015). Returns false when no line was updated.
 */
export async function closeLoginCodeSend(
  tx: Transaction,
  reference: string,
  outcome:
    | { status: "sent"; messageId: string }
    | { status: "failed"; failureCode: LoginCodeFailure },
): Promise<boolean> {
  const rows =
    outcome.status === "sent"
      ? await tx.execute<{ id: string }>(
          sql`update leads.transactional_sends
                 set status = 'sent', provider_message_id = ${outcome.messageId}
               where reference = ${reference} and status = 'queued'
           returning id::text as id`,
        )
      : await tx.execute<{ id: string }>(
          sql`update leads.transactional_sends
                 set status = 'failed', failure_code = ${outcome.failureCode}
               where reference = ${reference} and status = 'queued'
           returning id::text as id`,
        );
  return rows.length === 1;
}

/** Failures of the current window of a counter (0014), read before calling GoTrue. */
export async function failureCount(
  tx: Transaction,
  scope: ThrottleScope,
  key: Buffer,
  window: ThrottleWindow,
): Promise<number> {
  const rows = await tx.execute<{ count: number }>(
    sql`select identity.auth_failure_count(${scope}::identity.throttle_scope, ${key},
                                           ${window}::identity.throttle_window)::int
               as count`,
  );
  return rows[0]?.count ?? 0;
}

/** Counts one failure (0014); returns the failures of the current window. */
export async function recordAuthFailure(
  tx: Transaction,
  scope: ThrottleScope,
  key: Buffer,
  window: ThrottleWindow,
): Promise<number> {
  const rows = await tx.execute<{ count: number }>(
    sql`select identity.record_auth_failure(${scope}::identity.throttle_scope, ${key},
                                            ${window}::identity.throttle_window)::int
               as count`,
  );
  return rows[0]?.count ?? 0;
}

export type AuthenticatedAccount = {
  id: string;
  email: string;
  status: string;
  role: string;
};

/**
 * The account of a GoTrue user, looked up by `auth_user_id`, never by the address alone (21 J3-C
 * rule 3). One role per account at the MVP (D41).
 */
export async function accountOfAuthUser(
  tx: Transaction,
  authUserId: string,
): Promise<AuthenticatedAccount | null> {
  const rows = await tx.execute<AuthenticatedAccount>(
    sql`select a.id::text as id, a.email, a.status::text as status, r.role::text as role
          from identity.accounts a
          join identity.account_roles r on r.account_id = a.id
         where a.auth_user_id = ${authUserId}::uuid`,
  );
  return rows[0] ?? null;
}

/** Whether any account holds this address, whatever its state (EC-4 point 1). */
export async function emailIsTaken(
  tx: Transaction,
  email: string,
): Promise<boolean> {
  const rows = await tx.execute<{ id: string }>(
    sql`select id::text as id from identity.accounts where email = ${email}`,
  );
  return rows.length > 0;
}

/**
 * A member session (EC-29 point 1): the named columns of influx_auth only; dates, aal and
 * expiries are computed by identity.prepare_session() (0012).
 */
export async function insertMemberSession(
  tx: Transaction,
  session: { tokenHash: Buffer; accountId: string; userAgentSummary: string },
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`insert into identity.sessions
          (token_hash, account_id, surface, mfa_method, user_agent_summary)
        values (${session.tokenHash}, ${session.accountId}::uuid, 'member', null,
                ${session.userAgentSummary})
        returning id::text as id`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("session not inserted");
  }
  return row.id;
}

// --- Under the member's own role (withUserTransaction) -----------------------------------------

/** Sliding renewal (EC-29 point 2): true when the database wrote a new expiry. */
export async function touchSession(
  tx: Transaction,
  sessionId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ touched: boolean }>(
    sql`select identity.touch_session(${sessionId}::uuid) as touched`,
  );
  return rows[0]?.touched === true;
}

/** The sliding expiry of the member's own session. */
export async function idleExpiryOf(
  tx: Transaction,
  sessionId: string,
): Promise<Date | null> {
  const rows = await tx.execute<{ expires: string }>(
    sql`select idle_expires_at::text as expires from identity.sessions
         where id = ${sessionId}::uuid`,
  );
  const expires = rows[0]?.expires;
  return expires === undefined ? null : new Date(expires);
}

/** Revocation by the holder (EC-29 point 3). */
export async function revokeOwnSession(
  tx: Transaction,
  sessionId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ revoked: boolean }>(
    sql`select identity.revoke_own_session(${sessionId}::uuid, 'logout') as revoked`,
  );
  return rows[0]?.revoked === true;
}

/** GET /v1/me, minimal: the member's own row (RLS: own account only). */
export async function ownProfile(
  tx: Transaction,
): Promise<{ email: string; preferredLanguage: string } | null> {
  const rows = await tx.execute<{ email: string; preferred_language: string }>(
    sql`select email, preferred_language::text as preferred_language
          from identity.accounts where id = (select influx.current_account_id())`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { email: row.email, preferredLanguage: row.preferred_language };
}
