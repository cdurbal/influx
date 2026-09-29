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
