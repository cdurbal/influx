// Database access of the identity domain for the member authentication, under the elevated role
// influx_auth (E-1, E-2; 03 P7). Parameterised queries only (S-1): every value is a bound
// parameter of drizzle's `sql` template; the enum types are cast in the text, never built.
// influx_auth has no table right on the counters: they are reached through the three SECURITY
// DEFINER functions of 0014 (EC-53 (2)).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../db/index.ts";
import type { SendPriority } from "../../platform/email-switch.ts";

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
  | "backoffice_reauth_session"
  | "delivery_report_email"
  | "delivery_report_ip"
  | "delivery_report_unknown_ip";

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
export type P0SendFailure =
  "undeliverable_address" | "provider_unavailable" | "rate_limited";

/**
 * Step 8 of 02 §18.10: the outcome of the single attempt, on a P0 line still `queued` (the
 * sign-in code, an alert of EC-44). The instant is written by the database (0015). Returns false
 * when no line was updated.
 */
export async function closeP0Send(
  tx: Transaction,
  reference: string,
  outcome:
    | { status: "sent"; messageId: string }
    | { status: "failed"; failureCode: P0SendFailure },
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

/** A recipient of internal.critical_alert (EC-44): an active admin, never the break-glass account. */
export type CriticalAlertRecipient = { accountId: string; email: string };

export async function criticalAlertRecipients(
  tx: Transaction,
): Promise<CriticalAlertRecipient[]> {
  const rows = await tx.execute<{ id: string; email: string }>(
    sql`select a.id::text as id, a.email
          from identity.accounts a
          join identity.account_roles r on r.account_id = a.id and r.role = 'admin'
          join identity.agent_profiles p on p.account_id = a.id
         where a.status = 'active' and p.is_active and not p.is_break_glass
         order by a.id`,
  );
  return rows.map((row) => ({ accountId: row.id, email: row.email }));
}

/**
 * EC-44 (0114): the P0 line of one alert to one admin, status `queued`, with its account (never
 * an address in clear), no queue event. The body is bilingual; the line names French, its first
 * language (D36 open). Returns the reference that closes it.
 */
export async function insertCriticalAlertSend(
  tx: Transaction,
  accountId: string,
  templateVersion: number,
): Promise<string> {
  const rows = await tx.execute<{ reference: string }>(
    sql`insert into leads.transactional_sends
          (email_code, priority, account_id, locale, template_ref, template_version)
        values ('internal.critical_alert', 'p0', ${accountId}::uuid, 'fr',
                'internal.critical_alert', ${templateVersion})
        returning reference::text as reference`,
  );
  const reference = rows[0]?.reference;
  if (reference === undefined) {
    throw new Error("journal line not inserted");
  }
  return reference;
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

/**
 * 05 RG141, RG142 (0126): on the member session this transaction just opened, queues the e-mail
 * auth.new_device unless the browser is known or the session is the account's first; true when a
 * line was queued (at most one per account, summary and UTC day).
 */
export async function signalNewBrowser(
  tx: Transaction,
  sessionId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ queued: boolean }>(
    sql`select identity.signal_new_browser(${sessionId}::uuid) as queued`,
  );
  return rows[0]?.queued === true;
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

/**
 * Revocation by the holder (EC-29 point 3; 0012): `logout` for the session of the request,
 * `revoked_by_holder` from "mes sessions" (05 RG56). False for an unknown, closed or foreign
 * session: the function cannot tell them apart, nor can the caller (18 T14).
 */
export async function revokeOwnSession(
  tx: Transaction,
  sessionId: string,
  reason: "logout" | "revoked_by_holder" = "logout",
): Promise<boolean> {
  const rows = await tx.execute<{ revoked: boolean }>(
    sql`select identity.revoke_own_session(${sessionId}::uuid,
                 ${reason}::identity.session_revocation_reason) as revoked`,
  );
  return rows[0]?.revoked === true;
}

/** ISO 8601 in UTC with milliseconds, as the contracts expect (z.iso.datetime()). */
const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

export type OwnProfile = {
  email: string;
  preferredLanguage: string;
  countryCode: string;
  declaredStatus: string;
  /** The advertiser's company name (0106); null for a creator, who reads nothing of it. */
  companyName: string | null;
};

/**
 * "Mes informations" (05 RG71): the caller's own row (RLS: own account only). The company name is
 * read for an advertiser only; GET /v1/bo/me passes no member role.
 */
export async function ownProfile(
  tx: Transaction,
  role: "advertiser" | "creator" | null = null,
): Promise<OwnProfile | null> {
  const rows = await tx.execute<{
    email: string;
    preferred_language: string;
    country_code: string;
    declared_status: string;
  }>(
    sql`select email, preferred_language::text as preferred_language,
               country_code::text as country_code, declared_status::text as declared_status
          from identity.accounts where id = (select influx.current_account_id())`,
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  let companyName: string | null = null;
  if (role === "advertiser") {
    const profiles = await tx.execute<{ legal_name: string }>(
      sql`select legal_name from profiles.advertiser_profiles
           where account_id = (select influx.current_account_id())`,
    );
    companyName = profiles[0]?.legal_name ?? null;
  }
  return {
    email: row.email,
    preferredLanguage: row.preferred_language,
    countryCode: row.country_code,
    declaredStatus: row.declared_status,
    companyName,
  };
}

export type OwnAccountChanges = {
  countryCode?: string | undefined;
  preferredLanguage?: string | undefined;
  declaredStatus?: string | undefined;
  companyName?: string | undefined;
};

/**
 * PATCH /v1/me through identity.update_own_account() (0122): the columns and ONE lead.updated in
 * this transaction (05 RG15, RG73). True when something changed.
 */
export async function updateOwnAccount(
  tx: Transaction,
  changes: OwnAccountChanges,
): Promise<boolean> {
  const rows = await tx.execute<{ changed: boolean }>(
    sql`select identity.update_own_account(
          ${changes.countryCode ?? null}::text,
          ${changes.preferredLanguage ?? null}::text,
          ${changes.declaredStatus ?? null}::identity.declared_status,
          ${changes.companyName ?? null}::text) as changed`,
  );
  return rows[0]?.changed === true;
}

export type TermsToAcceptRow = {
  versionId: string;
  versionLabel: string;
  locale: string;
  effectiveFrom: string;
};

/** The terms of service in force not accepted yet by the member (0122; 05 RG28), or null. */
export async function ownTermsToAccept(
  tx: Transaction,
): Promise<TermsToAcceptRow | null> {
  const rows = await tx.execute<{
    id: string;
    version_label: string;
    locale: string;
    effective_from: string;
  }>(
    sql`select id::text as id, version_label, locale::text as locale,
               to_char(effective_from at time zone 'UTC', ${ISO_UTC}) as effective_from
          from identity.own_terms_to_accept()`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        versionId: row.id,
        versionLabel: row.version_label,
        locale: row.locale,
        effectiveFrom: row.effective_from,
      };
}

/**
 * The re-acceptance (05 RG28): written by the member under his own role (0005 §5.2: channel
 * re_acceptance, own account only); the hash and the instant are copied by
 * identity.prepare_terms_acceptance(), which refuses any version not in force.
 */
export async function insertReacceptance(
  tx: Transaction,
  version: { versionId: string; locale: string },
): Promise<void> {
  await tx.execute(
    sql`insert into identity.terms_acceptances
          (account_id, terms_version_id, nature, channel, locale)
        values ((select influx.current_account_id()), ${version.versionId}::uuid,
                'acceptance', 're_acceptance', ${version.locale})`,
  );
}

export type ConsentPurpose = "marketing_email" | "commercial_prospection";

/** One checkbox at sign-up, two purposes (05 RG33): both are always changed together. */
export const CONSENT_PURPOSES: readonly ConsentPurpose[] = [
  "marketing_email",
  "commercial_prospection",
];

export type ConsentState = {
  purpose: ConsentPurpose;
  granted: boolean;
  source: string;
  occurredAt: string;
};

/** The consent in force per purpose (RG37: the latest event; a refusal wins a tie). */
export async function ownConsentStates(
  tx: Transaction,
): Promise<ConsentState[]> {
  const rows = await tx.execute<{
    purpose: ConsentPurpose;
    granted: boolean;
    source: string;
    occurred_at: string;
  }>(
    sql`select distinct on (c.purpose) c.purpose::text as purpose, c.granted,
               c.source::text as source,
               to_char(c.occurred_at at time zone 'UTC', ${ISO_UTC}) as occurred_at
          from identity.consent_events c
         where c.account_id = (select influx.current_account_id())
         order by c.purpose, c.occurred_at desc, c.granted`,
  );
  return rows.map((row) => ({
    purpose: row.purpose,
    granted: row.granted,
    source: row.source,
    occurredAt: row.occurred_at,
  }));
}

/**
 * Through identity.set_marketing_consent() (0119), the only door: the event (source
 * account_settings) and consent.revoked (priority 0) or consent.granted in this transaction
 * (05 RG73, RG78, RG92). False when the value in force is already the asked one.
 */
export async function setMarketingConsent(
  tx: Transaction,
  purpose: ConsentPurpose,
  granted: boolean,
  evidence: Readonly<Record<string, string>>,
): Promise<boolean> {
  const rows = await tx.execute<{ changed: boolean }>(
    sql`select identity.set_marketing_consent(${purpose}::identity.consent_purpose, ${granted},
                 ${JSON.stringify(evidence)}::text::jsonb) as changed`,
  );
  return rows[0]?.changed === true;
}

export type OwnSessionRow = {
  id: string;
  createdAt: string;
  lastActivityAt: string;
  userAgentSummary: string | null;
};

/** The member's open sessions (05 RG56, RG143), the most recent activity first. */
export async function ownOpenSessions(
  tx: Transaction,
): Promise<OwnSessionRow[]> {
  const rows = await tx.execute<{
    id: string;
    created_at: string;
    last_activity_at: string;
    user_agent_summary: string | null;
  }>(
    sql`select id::text as id,
               to_char(created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
               to_char(last_activity_at at time zone 'UTC', ${ISO_UTC}) as last_activity_at,
               user_agent_summary
          from identity.sessions
         where account_id = (select influx.current_account_id())
           and surface = 'member'
           and revoked_at is null
           and idle_expires_at > now()
           and absolute_expires_at > now()
         order by last_activity_at desc, created_at desc`,
  );
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    userAgentSummary: row.user_agent_summary,
  }));
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
): Promise<{ remaining: number; auditSeq: string } | null> {
  const rows = await tx.execute<{
    remaining: number | null;
    audit_seq: string | null;
  }>(
    sql`select remaining, audit_seq::text as audit_seq
          from identity.consume_recovery_code(${accountId}::uuid, ${codeHash})`,
  );
  const row = rows[0];
  if (row === undefined || row.remaining === null || row.audit_seq === null) {
    return null;
  }
  return { remaining: row.remaining, auditSeq: row.audit_seq };
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

/** Returns the seq of the audit line (0011): the identifier of an alert of EC-44. */
export async function appendAuthEvent(
  tx: Transaction,
  event: AuthSecurityEvent,
  accountId: string,
): Promise<string> {
  const rows = await tx.execute<{ seq: string }>(
    sql`select audit.append_auth_event(${event}::text, ${accountId}::uuid)::text as seq`,
  );
  const seq = rows[0]?.seq;
  if (seq === undefined) {
    throw new Error("audit line not written");
  }
  return seq;
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

/** The SQLSTATE of a database error (src/db/sql-state.ts), kept here for the identity domain. */
export { sqlStateOf } from "../../db/sql-state.ts";

/**
 * The constraint named by a database error (postgres.js `constraint_name`), through the wrapping
 * of drizzle; null when the error names none (an exception raised by a function).
 */
export function constraintNameOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const name: unknown = (current as Error & { constraint_name?: unknown })
      .constraint_name;
    if (typeof name === "string" && name !== "") {
      return name;
    }
    current = current.cause;
  }
  return null;
}

// --- Sign-up (E-2 identity.complete_signup; 21 EC-5, EC-30) ------------------------------------

/** What identity.provision_account() receives (0106, recreated by 0109). */
export type ProvisionRequest = {
  /** From the signed sign-up token, never from the body. */
  authUserId: string;
  email: string;
  role: "advertiser" | "creator";
  countryCode: string;
  preferredLanguage: string;
  /** null for an advertiser: the function imposes `business` (05 RG22). */
  declaredStatus: "individual" | "business" | null;
  adultAttested: boolean;
  /** The company name of an advertiser; null for a creator. */
  legalName: string | null;
  termsVersionId: string;
  marketingConsent: boolean;
  consentWordingKey: string;
  consentWording: string;
  displayLocale: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerDomain: string | null;
  heardFrom: string | null;
};

export type ProvisionOutcome =
  | { outcome: "created" | "existing"; accountId: string }
  | { outcome: "country_blocked" };

/**
 * The one transaction of the sign-up (05 RG7, EC-30): account, role, advertiser profile, terms
 * acceptance, two consent events, three queue lines (EC-10) — or nothing. Raises 22023 on a value
 * the function refuses, 23503 on a terms version unknown or not in force.
 */
export async function provisionAccount(
  tx: Transaction,
  request: ProvisionRequest,
): Promise<ProvisionOutcome> {
  const rows = await tx.execute<{
    provisioned_account_id: string | null;
    outcome: string;
  }>(
    sql`select provisioned_account_id::text as provisioned_account_id, outcome
          from identity.provision_account(
                 ${request.authUserId}::uuid, ${request.email},
                 ${request.role}::identity.account_role, ${request.countryCode},
                 ${request.preferredLanguage},
                 ${request.declaredStatus}::identity.declared_status,
                 ${request.adultAttested}, ${request.legalName},
                 ${request.termsVersionId}::uuid, ${request.marketingConsent},
                 ${request.consentWordingKey}, ${request.consentWording},
                 ${request.displayLocale}, ${request.utmSource}, ${request.utmMedium},
                 ${request.utmCampaign}, ${request.referrerDomain},
                 ${request.heardFrom}::identity.heard_from)`,
  );
  const row = rows[0];
  if (row?.outcome === "country_blocked") {
    return { outcome: "country_blocked" };
  }
  if (
    (row?.outcome === "created" || row?.outcome === "existing") &&
    row.provisioned_account_id !== null
  ) {
    return { outcome: row.outcome, accountId: row.provisioned_account_id };
  }
  throw new Error("unexpected answer of identity.provision_account()");
}

/**
 * Whether terms of service are in force with their text, in this language or in English (05
 * RG25), through the function of 0108/0109 only. The text is computed but never transferred.
 */
export async function termsOfServiceArePublished(
  tx: Transaction,
  locale: string,
): Promise<boolean> {
  const rows = await tx.execute<{ published: boolean }>(
    sql`select exists (
          select 1 from identity.terms_in_force('terms_of_service'::identity.document_kind,
                                                ${locale})
        ) as published`,
  );
  return rows[0]?.published === true;
}

// --- Re-authentication and change of address (J7 decisions 4 and 5, commit 7) ------------------
// The marker is written by influx_auth (E-2 identity.member_reauthenticate, 0118); the journal lines
// of the two codes by influx_auth (E-1 identity.member_email_change, 0123); the request itself by
// the member, through the identity functions of 0118 and 0123 only.

/** A reason of 0118 for a fresh code: one action, once. */
export type ReauthPurpose = "email_change" | "data_export" | "account_deletion";

/**
 * E-2 (0118): the marker of `purpose` on this member session, at now(). Returns the account, or null
 * when the session no longer qualifies (closed, expired, not a member's, account not active).
 */
export async function markMemberReauthenticated(
  tx: Transaction,
  sessionId: string,
  purpose: ReauthPurpose,
): Promise<string | null> {
  const rows = await tx.execute<{ account: string | null }>(
    sql`select identity.mark_member_reauthenticated(${sessionId}::uuid,
                                                    ${purpose}::identity.reauth_purpose)::text
               as account`,
  );
  return rows[0]?.account ?? null;
}

/**
 * E-1 (0123): the P1 journal line of one code of an address change, status `queued`: the old side
 * with its account, the new side with its address (not the account's yet, 0015 recipient_xor).
 * The template version is COPIED (04 R7). Returns the reference that closes it (closeP0Send).
 */
export async function insertEmailChangeCodeSend(
  tx: Transaction,
  line: {
    side: "old" | "new";
    accountId: string;
    newEmail: string;
    locale: string;
    templateVersion: number;
    /** The class the emergency switch reads (EMAIL_CHANGE_CODE_PRIORITY). */
    priority: SendPriority;
  },
): Promise<string> {
  const code = `auth.email_change_confirm_${line.side}`;
  const rows = await tx.execute<{ reference: string }>(
    sql`insert into leads.transactional_sends
          (email_code, priority, account_id, recipient_email, locale, template_ref,
           template_version)
        values (${code}, ${line.priority}::leads.send_priority,
                ${line.side === "old" ? line.accountId : null}::uuid,
                ${line.side === "new" ? line.newEmail : null}, ${line.locale}, ${code},
                ${line.templateVersion})
        returning reference::text as reference`,
  );
  const reference = rows[0]?.reference;
  if (reference === undefined) {
    throw new Error("journal line not inserted");
  }
  return reference;
}

/** identity.request_email_change() (0118): consumes the marker; 55000 without it. */
export async function requestEmailChange(
  tx: Transaction,
  request: {
    sessionId: string;
    requestId: string;
    newEmail: string;
    oldCodeHash: Buffer;
    newCodeHash: Buffer;
  },
): Promise<void> {
  await tx.execute(
    sql`select identity.request_email_change(${request.sessionId}::uuid,
             ${request.requestId}::uuid, ${request.newEmail}, ${request.oldCodeHash},
             ${request.newCodeHash})`,
  );
}

export type EmailChangeConfirmation = {
  outcome:
    | "confirmed"
    | "already_confirmed"
    | "invalid_code"
    | "attempts_exhausted"
    | "expired"
    | "not_found";
  /** Both sides confirmed: GoTrue may now take the new address. */
  ready: boolean;
  /** The GoTrue user to update, when ready. */
  authUserId: string | null;
};

/** identity.confirm_email_change() (0118): one code of one side; never raises on a wrong code. */
export async function confirmEmailChange(
  tx: Transaction,
  requestId: string,
  side: "old" | "new",
  codeHash: Buffer,
): Promise<EmailChangeConfirmation> {
  const rows = await tx.execute<{
    outcome: EmailChangeConfirmation["outcome"];
    ready: boolean;
    auth_user_id: string | null;
  }>(
    sql`select outcome, ready, auth_user_id::text as auth_user_id
          from identity.confirm_email_change(${requestId}::uuid,
                                             ${side}::identity.email_change_side, ${codeHash})`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("identity.confirm_email_change() returned no row");
  }
  return {
    outcome: row.outcome,
    ready: row.ready,
    authUserId: row.auth_user_id,
  };
}

export type EmailChangeCompletion =
  | "completed"
  | "not_found"
  | "not_ready"
  | "expired"
  | "superseded"
  | "address_unavailable";

/** identity.complete_email_change() (0118): AFTER GoTrue took the new address. */
export async function completeEmailChange(
  tx: Transaction,
  requestId: string,
  sessionId: string,
): Promise<EmailChangeCompletion> {
  const rows = await tx.execute<{ outcome: EmailChangeCompletion }>(
    sql`select identity.complete_email_change(${requestId}::uuid, ${sessionId}::uuid)
               as outcome`,
  );
  const outcome = rows[0]?.outcome;
  if (outcome === undefined) {
    throw new Error("identity.complete_email_change() returned nothing");
  }
  return outcome;
}

/** identity.cancel_email_change() (0118): the holder's own open request; false otherwise. */
export async function cancelEmailChange(
  tx: Transaction,
  requestId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ cancelled: boolean }>(
    sql`select identity.cancel_email_change(${requestId}::uuid) as cancelled`,
  );
  return rows[0]?.cancelled === true;
}

/** identity.close_unsent_email_change() (0124): a code of the request did not leave (not_sent). */
export async function closeUnsentEmailChange(
  tx: Transaction,
  requestId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ closed: boolean }>(
    sql`select identity.close_unsent_email_change(${requestId}::uuid) as closed`,
  );
  return rows[0]?.closed === true;
}

/** identity.refuse_email_change_address() (0123): GoTrue refused the new address as taken. */
export async function refuseEmailChangeAddress(
  tx: Transaction,
  requestId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ refused: boolean }>(
    sql`select identity.refuse_email_change_address(${requestId}::uuid) as refused`,
  );
  return rows[0]?.refused === true;
}

export type OwnEmailChangeRow = {
  id: string;
  newEmail: string;
  expiresAt: string;
  oldConfirmed: boolean;
  newConfirmed: boolean;
  oldAttempts: number;
  newAttempts: number;
};

/**
 * The member's open request (RLS: own rows only, never the digests, 0118 §7.2), or the one named,
 * open or not: null when absent. An expired request still open is shown until a code closes it.
 */
export async function ownEmailChange(
  tx: Transaction,
  requestId: string | null = null,
): Promise<OwnEmailChangeRow | null> {
  const rows = await tx.execute<{
    id: string;
    new_email: string;
    expires_at: string;
    old_confirmed: boolean;
    new_confirmed: boolean;
    old_attempts: number;
    new_attempts: number;
  }>(
    sql`select id::text as id, new_email,
               to_char(expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at,
               old_confirmed_at is not null as old_confirmed,
               new_confirmed_at is not null as new_confirmed,
               old_attempts, new_attempts
          from identity.email_change_requests
         where account_id = (select influx.current_account_id())
           and (${requestId}::uuid is null and completed_at is null and cancelled_at is null
                or id = ${requestId}::uuid)`,
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    newEmail: row.new_email,
    expiresAt: row.expires_at,
    oldConfirmed: row.old_confirmed,
    newConfirmed: row.new_confirmed,
    oldAttempts: row.old_attempts,
    newAttempts: row.new_attempts,
  };
}

// --- "Mes données", under the member's own role (EC-14; J7 decision 6, 0120) -----------------------

export type OwnDataRequestRow = {
  id: string;
  requestType: string;
  receivedAt: string;
  dueAt: string;
  status: string;
  completedAt: string | null;
  outcomeCode: string | null;
};

/** The member's own requests of the two types exposed at J7, the most recent first (0120 policy). */
export async function ownDataRequests(
  tx: Transaction,
): Promise<OwnDataRequestRow[]> {
  const rows = await tx.execute<{
    id: string;
    request_type: string;
    received_at: string;
    due_at: string;
    status: string;
    completed_at: string | null;
    outcome_code: string | null;
  }>(
    sql`select id::text as id, request_type::text as request_type,
               to_char(received_at at time zone 'UTC', ${ISO_UTC}) as received_at,
               to_char(due_at at time zone 'UTC', ${ISO_UTC}) as due_at,
               status::text as status,
               to_char(completed_at at time zone 'UTC', ${ISO_UTC}) as completed_at,
               outcome_code::text as outcome_code
          from backoffice.data_subject_requests
         where requester_account_id = (select influx.current_account_id())
           and request_type in ('access', 'erasure')
         order by received_at desc, id`,
  );
  return rows.map((row) => ({
    id: row.id,
    requestType: row.request_type,
    receivedAt: row.received_at,
    dueAt: row.due_at,
    status: row.status,
    completedAt: row.completed_at,
    outcomeCode: row.outcome_code,
  }));
}

/**
 * Deposits a request (0120 backoffice.submit_data_subject_request): consumes the fresh code of its
 * purpose on this session (55000 without it), queues the acknowledgement. `created` is false when
 * a request of this type was already open (nothing written, nothing sent).
 */
export async function submitDataRequest(
  tx: Transaction,
  sessionId: string,
  requestType: "access" | "erasure",
): Promise<{ requestId: string; created: boolean }> {
  const rows = await tx.execute<{ request_id: string; created: boolean }>(
    sql`select request_id::text as request_id, created
          from backoffice.submit_data_subject_request(
                 ${sessionId}::uuid, ${requestType}::backoffice.data_request_type)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("data subject request not deposited");
  }
  return { requestId: row.request_id, created: row.created };
}

// --- The rescue channel, under influx_auth (E-1 support.report_delivery_issue; 05 RG65, 0120) --------

/** Writes one report and nothing else (no lookup, no code, no session, no e-mail); its id. */
export async function recordCodeDeliveryReport(
  tx: Transaction,
  report: {
    loginEmail: string;
    contactEmail: string;
    message: string | null;
    locale: string;
  },
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`select backoffice.record_code_delivery_report(
                 ${report.loginEmail}::text, ${report.contactEmail}::text,
                 ${report.message}::text, ${report.locale}::text)::text as id`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("delivery report not recorded");
  }
  return row.id;
}
