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
  | "code_verify_platform"
  | "backoffice_login_email_ip"
  | "backoffice_login_ip"
  | "backoffice_login_unknown_ip"
  | "backoffice_login_email"
  | "backoffice_login_platform"
  | "backoffice_reauth_session";

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

// --- Backoffice sign-in, under influx_auth (E-2; 21 §4, J3 commit 10) ---------------------------
// influx_auth has no right on the secret tables of 0013: recovery codes, enrollment tokens and the
// TOTP anti-replay are reached through the SECURITY DEFINER functions of 0013, which write their
// own audit lines. No code, token or TOTP code ever reaches the database: only their digests.

/** The account of a GoTrue user, with what the sign-in checks (J3-C rule 3, G-1, EC-55). */
export type SignInAccount = {
  id: string;
  email: string;
  status: string;
  role: string;
  /** Null for a member account, which has no internal profile. */
  profileIsActive: boolean | null;
  isBreakGlass: boolean;
  /** G-1 point 1: the only factor INFLUX challenges; null until the enrollment. */
  mfaFactorId: string | null;
};

export async function signInAccountOf(
  tx: Transaction,
  authUserId: string,
): Promise<SignInAccount | null> {
  const rows = await tx.execute<{
    id: string;
    email: string;
    status: string;
    role: string;
    profile_is_active: boolean | null;
    is_break_glass: boolean | null;
    mfa_factor_id: string | null;
  }>(
    sql`select a.id::text as id, a.email, a.status::text as status, r.role::text as role,
               p.is_active as profile_is_active, p.is_break_glass,
               p.mfa_factor_id::text as mfa_factor_id
          from identity.accounts a
          join identity.account_roles r on r.account_id = a.id
          left join identity.agent_profiles p on p.account_id = a.id
         where a.auth_user_id = ${authUserId}::uuid`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        id: row.id,
        email: row.email,
        status: row.status,
        role: row.role,
        profileIsActive: row.profile_is_active,
        isBreakGlass: row.is_break_glass === true,
        mfaFactorId: row.mfa_factor_id,
      };
}

/**
 * The internal account an address belongs to, for the alerts of EC-47 (failures on a KNOWN
 * address, break-glass account at the first failure). Members are not looked for.
 */
export async function internalAccountOfEmail(
  tx: Transaction,
  email: string,
): Promise<{ id: string; isBreakGlass: boolean } | null> {
  const rows = await tx.execute<{ id: string; is_break_glass: boolean }>(
    sql`select a.id::text as id, p.is_break_glass
          from identity.accounts a
          join identity.account_roles r on r.account_id = a.id
          join identity.agent_profiles p on p.account_id = a.id
         where a.email = ${email} and a.status <> 'deleted'
           and r.role in ('agent', 'admin')`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { id: row.id, isBreakGlass: row.is_break_glass };
}

/** G-1 point 2, first enrollment request (0013): reads only. */
export async function enrollmentTokenIsValid(
  tx: Transaction,
  accountId: string,
  tokenHash: Buffer,
): Promise<boolean> {
  const rows = await tx.execute<{ valid: boolean }>(
    sql`select identity.enrollment_token_is_valid(${accountId}::uuid, ${tokenHash}) as valid`,
  );
  return rows[0]?.valid === true;
}

/** EC-39 (0013): false when the same code was accepted less than 120 s ago for this account. */
export async function acceptTotpCode(
  tx: Transaction,
  accountId: string,
  codeDigest: Buffer,
): Promise<boolean> {
  const rows = await tx.execute<{ accepted: boolean }>(
    sql`select identity.accept_totp_code(${accountId}::uuid, ${codeDigest}) as accepted`,
  );
  return rows[0]?.accepted === true;
}

/** EC-17 point 3 (0013): the codes left, or null when the code is not usable. */
export async function consumeRecoveryCode(
  tx: Transaction,
  accountId: string,
  codeHash: Buffer,
): Promise<number | null> {
  const rows = await tx.execute<{ remaining: number | null }>(
    sql`select identity.consume_recovery_code(${accountId}::uuid, ${codeHash}) as remaining`,
  );
  return rows[0]?.remaining ?? null;
}

/**
 * G-1 points 1 and 2, EC-17 (0013): consumes the token, pins the factor, stores the ten digests.
 * Raises 42501 when the token, the account or the profile refuses (one uniform refusal).
 */
export async function pinMfaFactor(
  tx: Transaction,
  pin: {
    accountId: string;
    factorId: string;
    enrollmentTokenHash: Buffer;
    recoveryCodeHashes: readonly Buffer[];
  },
): Promise<void> {
  const hashes = sql.join(
    pin.recoveryCodeHashes.map((hash) => sql`${hash}`),
    sql`, `,
  );
  await tx.execute(
    sql`select identity.pin_mfa_factor(${pin.accountId}::uuid, ${pin.factorId}::uuid,
                                       ${pin.enrollmentTokenHash},
                                       array[${hashes}]::bytea[])`,
  );
}

/**
 * A backoffice session (EC-29 point 1, EC-40): named columns only; the aal2, the dates and the
 * first freshness are computed by identity.prepare_session() (0012). The policy refuses it unless
 * the account is active, internal, with an active profile and a pinned factor (C6-2).
 */
export async function insertBackofficeSession(
  tx: Transaction,
  session: {
    tokenHash: Buffer;
    accountId: string;
    mfaMethod: "totp" | "recovery_code";
    userAgentSummary: string;
  },
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`insert into identity.sessions
          (token_hash, account_id, surface, mfa_method, user_agent_summary)
        values (${session.tokenHash}, ${session.accountId}::uuid, 'backoffice',
                ${session.mfaMethod}::identity.mfa_method, ${session.userAgentSummary})
        returning id::text as id`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("session not inserted");
  }
  return row.id;
}

/** The four security events of 0011, payload always empty (EC-44 (1), G-1). */
export type AuthSecurityEvent =
  | "agent.break_glass_login"
  | "agent.unexpected_mfa_factor"
  | "agent.reauthentication_failed"
  | "security.backoffice_login_failures";

export async function appendAuthEvent(
  tx: Transaction,
  event: AuthSecurityEvent,
  accountId: string,
): Promise<void> {
  await tx.execute(
    sql`select audit.append_auth_event(${event}::text, ${accountId}::uuid)`,
  );
}

/** What R needs of an open backoffice session (EC-40). */
export type ReauthenticationSession = {
  accountId: string;
  authUserId: string;
  email: string;
  mfaMethod: "totp" | "recovery_code";
  mfaFactorId: string;
};

export async function reauthenticationSessionOf(
  tx: Transaction,
  sessionId: string,
): Promise<ReauthenticationSession | null> {
  const rows = await tx.execute<{
    account_id: string;
    auth_user_id: string;
    email: string;
    mfa_method: string;
    mfa_factor_id: string;
  }>(
    sql`select s.account_id::text as account_id, a.auth_user_id::text as auth_user_id, a.email,
               s.mfa_method::text as mfa_method, p.mfa_factor_id::text as mfa_factor_id
          from identity.sessions s
          join identity.accounts a on a.id = s.account_id and a.status = 'active'
          join identity.agent_profiles p on p.account_id = s.account_id and p.is_active
         where s.id = ${sessionId}::uuid
           and s.surface = 'backoffice'
           and s.revoked_at is null
           and s.idle_expires_at > now()
           and s.absolute_expires_at > now()
           and a.auth_user_id is not null
           and p.mfa_factor_id is not null`,
  );
  const row = rows[0];
  if (
    row === undefined ||
    (row.mfa_method !== "totp" && row.mfa_method !== "recovery_code")
  ) {
    return null;
  }
  return {
    accountId: row.account_id,
    authUserId: row.auth_user_id,
    email: row.email,
    mfaMethod: row.mfa_method,
    mfaFactorId: row.mfa_factor_id,
  };
}

/** R (EC-40 point 2): the new proof, "now, by TOTP" — the trigger of 0012 refuses anything else. */
export async function renewSecondFactorProof(
  tx: Transaction,
  sessionId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ id: string }>(
    sql`update identity.sessions
           set mfa_verified_at = now(), mfa_method = 'totp'
         where id = ${sessionId}::uuid and surface = 'backoffice' and revoked_at is null
     returning id::text as id`,
  );
  return rows.length === 1;
}

/** EC-40 point 5: the only revocation influx_auth may write (trigger of 0012). */
export async function revokeAfterFailedReauthentication(
  tx: Transaction,
  sessionId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ id: string }>(
    sql`update identity.sessions
           set revoked_at = now(), revocation_reason = 'reauthentication_failed'
         where id = ${sessionId}::uuid and surface = 'backoffice' and revoked_at is null
     returning id::text as id`,
  );
  return rows.length === 1;
}

/**
 * EC-40 point 2: R holds only when the last proof of THIS session is a TOTP code at most
 * `freshnessSeconds` old, read on the row by the database clock — never a recovery code.
 */
export async function hasFreshSecondFactorProof(
  tx: Transaction,
  sessionId: string,
  freshnessSeconds: number,
): Promise<boolean> {
  const rows = await tx.execute<{ fresh: boolean }>(
    sql`select exists (
          select 1 from identity.sessions
           where id = ${sessionId}::uuid and surface = 'backoffice' and revoked_at is null
             and mfa_method = 'totp'
             and mfa_verified_at >= now() - make_interval(secs => ${freshnessSeconds}::double precision)
        ) as fresh`,
  );
  return rows[0]?.fresh === true;
}

// --- Public documents (E-1 identity.read_published_terms, 21 EC-62) ---------------------------

/** The version in force of a public document, as identity.terms_in_force() returns it (0108). */
export type TermsVersionRow = {
  id: string;
  documentKind: string;
  /** The language actually served: the one asked, or English (05 RG25). */
  locale: string;
  versionLabel: string;
  contentUri: string;
  /** SHA-256 of the published bytes, lower-case hexadecimal. */
  contentSha256: string;
  requiresAcceptance: boolean;
  /** ISO 8601, UTC. */
  effectiveFrom: string;
  /** The exact text (0109): never NULL, the function ignores a row without text. */
  content: string;
};

/**
 * Through the SECURITY DEFINER function only: influx_auth holds no right on
 * identity.terms_versions (0108). Zero or one row, with its text (0109).
 */
export async function termsInForce(
  tx: Transaction,
  document: string,
  locale: string,
): Promise<TermsVersionRow | null> {
  const rows = await tx.execute<{
    id: string;
    document_kind: string;
    locale: string;
    version_label: string;
    content_uri: string;
    content_sha256: string;
    requires_acceptance: boolean;
    effective_from: string;
    content: string;
  }>(
    sql`select id::text as id, document_kind::text as document_kind, locale::text as locale,
               version_label, content_uri, encode(content_hash, 'hex') as content_sha256,
               requires_acceptance,
               to_char(effective_from at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                 as effective_from,
               content
          from identity.terms_in_force(${document}::identity.document_kind, ${locale})`,
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    documentKind: row.document_kind,
    locale: row.locale,
    versionLabel: row.version_label,
    contentUri: row.content_uri,
    contentSha256: row.content_sha256,
    requiresAcceptance: row.requires_acceptance,
    effectiveFrom: row.effective_from,
    content: row.content,
  };
}

/** The SQLSTATE of a database error, through the wrapping of drizzle (`cause`). */
export function sqlStateOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const code: unknown = (current as Error & { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return code;
    }
    current = current.cause;
  }
  return null;
}
