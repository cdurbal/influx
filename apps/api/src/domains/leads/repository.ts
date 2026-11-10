// Database access of the leads domain for the worker, under the elevated role influx_worker (E-3
// `leads.drain_outbox`; 03 P7; migration 0111). Parameterised queries only (S-1): every value is a
// bound parameter of drizzle's `sql` template; the enum types are cast in the text, never built.
// influx_worker has no table right: each function calls one SECURITY DEFINER function of
// influx_leads_definer. The database refuses with 55000 a line no longer in processing for this
// worker (taken back, or by another instance).
import { sql } from "drizzle-orm";
import type { BusinessRole, Transaction } from "../../db/index.ts";

export type OutboxDestination =
  "brevo_contact" | "apollo_contact" | "brevo_transactional";

/** A line taken by this worker: identifiers and codes only (05 RG74). */
export type ClaimedLine = {
  /** bigint of leads.outbox_events, kept as text: never narrowed to a number. */
  id: string;
  eventId: string;
  eventType: string;
  destination: OutboxDestination;
  subjectKey: string;
  priority: number;
  payload: Readonly<Record<string, unknown>>;
  idempotencyKey: string;
};

/** The account of a subject, read at the start of the attempt. */
export type SubjectAccount = {
  id: string;
  status: "active" | "suspended" | "deleted";
  role: BusinessRole | null;
  declaredStatus: "individual" | "business";
  countryCode: string;
  preferredLanguage: string;
  emailVerified: boolean;
  /** The consent in force is its latest event; none recorded is no consent (05 RG36). */
  marketingEmailConsent: boolean;
  commercialProspectionConsent: boolean;
};

export type AttemptState = {
  /** 1 to 10 (05 RG79). */
  attempt: number;
  /** null: the subject is not an account, or the account does not exist. */
  account: SubjectAccount | null;
  /** The worker keys of leads.sync_settings (EC-8), read at every consumption (05 RG81). */
  settings: Readonly<Record<string, unknown>>;
};

/** The outcome of an attempt; dryRun is explicit for every outcome (no side table when true). */
export type AttemptOutcome =
  | {
      status: "succeeded";
      dryRun: boolean;
      /** Live, contact line: the contact id at the provider. */
      providerContactId?: string;
      /** Live, transactional line: the messageId (16 RG94), the language, the template version. */
      providerMessageId?: string;
      locale?: string;
      templateVersion?: number;
    }
  | { status: "skipped"; dryRun: boolean; reason: string }
  | {
      status: "pending";
      dryRun: boolean;
      errorCode: string;
      errorMessage?: string;
      retryInSeconds: number;
    }
  | {
      status: "failed";
      dryRun: boolean;
      errorCode: string;
      errorMessage?: string;
    };

export type WrittenStatus = "succeeded" | "skipped" | "pending" | "failed";

export type RecordedOutcome = {
  /** A pending outcome at the tenth attempt is written failed (05 RG79). */
  writtenStatus: WrittenStatus;
  /** A journal line of leads.transactional_sends was inserted (a welcome e-mail that left). */
  journalInserted: boolean;
  /** The account of the subject, or null. */
  accountId: string | null;
};

/**
 * A line the take-back returned to the queue (0146): an orphan of a stopped worker (TM1.10), or a
 * configuration failure whose setting was corrected (05 RG161), with the code it failed with.
 */
export type RecoveredLine = {
  id: string;
  writtenStatus: "pending" | "failed";
  reason: "worker_interrupted" | "configuration_restored";
  /** The code of the configuration failure re-queued; null for an orphan. */
  errorCode: string | null;
};

/** The start step of the worker (0146): D68, then what 05 RG162 checks. */
export type WorkerStart = {
  /** The keys the environment changed (D68). */
  changedKeys: string[];
  /** The worker keys of leads.sync_settings in force after the step, read now (RG81). */
  settings: Readonly<Record<string, unknown>>;
  /** The start, by the database clock (ISO 8601, microseconds): 05 RG161, credentials_missing. */
  startedAt: string;
};

/** What the Brevo connectors read of a subject, besides the account state of the attempt (0112). */
export type BrevoSubject = {
  email: string;
  /** ISO 8601, the creation of the account. */
  signedUpAt: string;
  /** The company name of an advertiser profile; never sent for a creator (16 RG142). */
  company: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerDomain: string | null;
  heardFrom: string | null;
  /** The account was created through a member invitation (05 RG120, RG122; 0135). */
  viaInvitation: boolean;
  /** The marketing_email consent in force: its instant (ISO 8601) and source; null if refused. */
  consentAt: string | null;
  consentSource: string | null;
  /** The welcome e-mail of the line's code already journaled for the account (16 RG90). */
  welcomeSent: boolean;
  /** An email.changed line: the old address of its completed request (05 RG58, 0121); else null. */
  previousEmail: string | null;
  /** The Brevo contact id already known (contact_sync_states), or null. */
  externalContactId: string | null;
  /** A suppression is recorded on the Brevo contact (05 RG93, a complaint): never resynchronised. */
  suppressed: boolean;
  /** An auth.new_device line: the opening of its session (ISO 8601, 0126); else null. */
  signedInAt: string | null;
  /** An auth.new_device line: the browser summary of its session (05 RG141); else null. */
  browser: string | null;
  /** The account's time zone (IANA name, 'UTC' by default; 16 RG157, RG160). */
  timeZone: string;
  /**
   * A privacy.request_received or privacy.export_ready line: its request, of the line's account
   * (0128, 0136); else null.
   */
  dataRequest: {
    type: string;
    /** ISO 8601. */
    receivedAt: string;
    /** ISO 8601. */
    dueAt: string;
    closed: boolean;
  } | null;
  /** A privacy.export_ready line: the end of its export's availability (ISO 8601, 0136); else null. */
  exportExpiresAt: string | null;
};

/**
 * What the Brevo contact connector reads of an erased account (operation 2, account.deleted; 0136):
 * the contact id known at Brevo, and the address held by the request only until Brevo confirms.
 */
export type BrevoErasureSubject = {
  externalContactId: string | null;
  email: string | null;
};

/**
 * What the worker reads of a profile.decision line (0211): the decision of the entry, its reason, the
 * message of the agent to the brand (reason `other` only) and the account's language. Never the
 * internal comment (06 RG68).
 */
export type BrevoProfileDecision = {
  decision: string;
  reasonCode: string | null;
  memberMessage: string | null;
  preferredLanguage: string;
};

/**
 * What the worker reads of a verification e-mail line (0227; 08 RG94; modele §4 "Outbox"): the
 * request the line names and the facts of its e-mail. Never the code, the handle, a figure, the
 * period, the agent nor the internal comment. `memberMessage` is the text written by the agent
 * (a refusal for `other` or `terms_breach`); the text of any other reason comes from the
 * translation files by the reason code.
 */
export type BrevoVerificationEmail = {
  /** account_verified, audience_verified or brand_verified. */
  level: string;
  /** The network line (reference.networks), null for a brand. */
  networkCode: string | null;
  /** draft, pending, approved, rejected, cancelled, expired or closed. */
  requestStatus: string;
  reasonCode: string | null;
  memberMessage: string | null;
  /** A decision that granted a badge: its date (ISO 8601) and expiry (null: none). */
  grantedAt: string | null;
  badgeExpiresAt: string | null;
  /** A code_issued line: the kind (network or domain), expiry (ISO 8601) and revocation of ITS code. */
  codeKind: string | null;
  codeExpiresAt: string | null;
  codeRevoked: boolean;
  /** 0236: the days an appeal stays open (a refusal of a creator says it), null if unset. */
  disputeWindowDays: number | null;
  preferredLanguage: string;
};

/**
 * What the worker reads of an e-mail of the life of the badge (0236; 08 RG94; modele §4 "Outbox"):
 * the object the line names (a badge, a request, a dispute or a review) and the facts of its e-mail.
 * Never a figure, a handle, the text of a dispute, the agent nor an internal comment.
 */
export type BrevoBadgeEmail = {
  /** account_verified, audience_verified or brand_verified. */
  level: string;
  /** The network line (reference.networks), null for a brand. */
  networkCode: string | null;
  /** The state of the object: a badge, a request, a dispute or a review. */
  objectState: string;
  /** A dispute outcome: which decision it contested, `refusal` or `revocation`. */
  contestedDecision: string | null;
  /** ISO 8601: the badge's expiry, and the end of its grace period (expires_at + grace). */
  badgeExpiresAt: string | null;
  graceEndsAt: string | null;
  /** The reason of the withdrawal, or of the decision a dispute contested. */
  reasonCode: string | null;
  /** The text written for the member by an agent (a withdrawal, an outcome). */
  memberMessage: string | null;
  outcomeReasonCode: string | null;
  /** ISO 8601: the grant date of the badge a successful dispute handed back. */
  restoredAt: string | null;
  disputeWindowDays: number | null;
  preferredLanguage: string;
};

/**
 * What the Brevo contact connector reads of the badges of an account (0227; 16 §M4, 08 RG92): the
 * level it holds (none, n1 account or brand, n2 audience) and the date of the badge that fixes it.
 */
export type VerifiedBadge = {
  level: "none" | "n1" | "n2";
  /** ISO 8601; null for none. */
  at: string | null;
};

/**
 * What the contact connectors read of a brand profile (0212; 06 RG79 to RG81): the live row of the
 * profile, never its legal name, presentation, contact person, registration number nor a note. A
 * field the brand has not filled is null (sent empty, RG81), never a guess.
 */
export type BrandProfileAttributes = {
  /** The state as stored: draft, pending_review, published, rejected or suspended. */
  status: string;
  /** The stored completeness (06 RG83), 0 to 100; null when never computed. */
  completenessPercent: number | null;
  /** Code of reference.sectors. */
  primarySector: string | null;
  /** 1_10, 11_50, 51_250, 251_1000 or 1001_plus: a band, never a headcount (06 RG22). */
  companySizeBand: string | null;
  /** A domain only, lower case (06 RG17). */
  websiteDomain: string | null;
  /** The first topic (slot 1), a code of reference.topics. */
  mainTopic: string | null;
  /** ISO 3166-1 alpha-2, in the order of the brand's slots. */
  targetMarkets: readonly string[];
  /** The profile was published once at least (first_published_at): the funnel stage. */
  everPublished: boolean;
};

/** What the Apollo connector reads of a subject, besides the account state of the attempt (0113). */
export type ApolloSubject = {
  email: string;
  /** The company name of an advertiser profile (05 RG82); never sent for a creator. */
  company: string | null;
  /** A refusal of prospection recorded after the sign-up: excludes for good (05 RG83). */
  prospectionOpposed: boolean;
  /** The Apollo contact id already known (contact_sync_states): an update, never a duplicate. */
  externalContactId: string | null;
};

/** SQLSTATE of a line no longer in processing for this worker (begin and complete, 0111). */
const NOT_IN_PROCESSING = "55000";

/** The database refused a line taken back meanwhile, or by another instance (55000). */
export function isLineNotInProcessing(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    if ((current as Error & { code?: unknown }).code === NOT_IN_PROCESSING) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

/** Up to 20 lines (the default of the function) set to processing for this worker (0111). */
export async function claimLines(
  tx: Transaction,
  worker: string,
): Promise<ClaimedLine[]> {
  const rows = await tx.execute<{
    id: string;
    event_id: string;
    event_type: string;
    destination: OutboxDestination;
    subject_key: string;
    priority: number;
    payload: Record<string, unknown>;
    idempotency_key: string;
  }>(
    sql`select outbox_id::text as id, event_id::text as event_id, event_type,
               destination::text as destination, subject_key, priority, payload, idempotency_key
          from leads.claim_outbox_batch(${worker}::text)`,
  );
  return Array.from(rows, (row) => ({
    id: row.id,
    eventId: row.event_id,
    eventType: row.event_type,
    destination: row.destination,
    subjectKey: row.subject_key,
    priority: row.priority,
    payload: row.payload,
    idempotencyKey: row.idempotency_key,
  }));
}

/** Counts the attempt and reads the state at consumption (05 RG37); never an address. */
export async function beginAttempt(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<AttemptState> {
  const rows = await tx.execute<{
    attempt: number;
    account_id: string | null;
    account_status: SubjectAccount["status"] | null;
    account_role: BusinessRole | null;
    declared_status: SubjectAccount["declaredStatus"] | null;
    country_code: string | null;
    preferred_language: string | null;
    email_verified: boolean | null;
    marketing_email_consent: boolean | null;
    commercial_prospection_consent: boolean | null;
    settings: Record<string, unknown>;
  }>(
    sql`select attempt, account_id::text as account_id, account_status, account_role,
               declared_status, country_code, preferred_language, email_verified,
               marketing_email_consent, commercial_prospection_consent, settings
          from leads.begin_outbox_attempt(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("unexpected answer of leads.begin_outbox_attempt()");
  }
  const account =
    row.account_id === null ||
    row.account_status === null ||
    row.declared_status === null ||
    row.country_code === null ||
    row.preferred_language === null
      ? null
      : {
          id: row.account_id,
          status: row.account_status,
          role: row.account_role,
          declaredStatus: row.declared_status,
          countryCode: row.country_code,
          preferredLanguage: row.preferred_language,
          emailVerified: row.email_verified === true,
          marketingEmailConsent: row.marketing_email_consent === true,
          commercialProspectionConsent:
            row.commercial_prospection_consent === true,
        };
  return { attempt: row.attempt, account, settings: row.settings };
}

/** Writes the outcome of an attempt, the contact state or the journal line in live (0111). */
export async function completeAttempt(
  tx: Transaction,
  lineId: string,
  worker: string,
  outcome: AttemptOutcome,
): Promise<RecordedOutcome> {
  const success = outcome.status === "succeeded" ? outcome : undefined;
  const cause =
    outcome.status === "pending" || outcome.status === "failed"
      ? outcome
      : undefined;
  const rows = await tx.execute<{
    written_status: WrittenStatus;
    journal_inserted: boolean;
    account_id: string | null;
  }>(
    sql`select written_status::text as written_status, journal_inserted,
               account_id::text as account_id
          from leads.complete_outbox_attempt(
                 p_outbox_id => ${lineId}::bigint,
                 p_worker => ${worker}::text,
                 p_status => ${outcome.status}::leads.outbox_status,
                 p_dry_run => ${outcome.dryRun}::boolean,
                 p_skip_reason => ${outcome.status === "skipped" ? outcome.reason : null}::text,
                 p_error_code => ${cause?.errorCode ?? null}::text,
                 p_error_message => ${cause?.errorMessage ?? null}::text,
                 p_retry_in_seconds => ${outcome.status === "pending" ? outcome.retryInSeconds : null}::integer,
                 p_provider_message_id => ${success?.providerMessageId ?? null}::text,
                 p_provider_contact_id => ${success?.providerContactId ?? null}::text,
                 p_locale => ${success?.locale ?? null}::text,
                 p_template_version => ${success?.templateVersion ?? null}::integer)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("unexpected answer of leads.complete_outbox_attempt()");
  }
  return {
    writtenStatus: row.written_status,
    journalInserted: row.journal_inserted,
    accountId: row.account_id,
  };
}

/**
 * Takes back the lines left in processing for more than 600 s (TM1.10) and re-queues the
 * configuration failures whose setting was corrected (05 RG161, 0146). The start of this process
 * is handed for this call only (influx.worker_started_at, transaction-local): a credentials_missing
 * line whose attempt began before it goes back to the queue.
 */
export async function recoverStaleLines(
  tx: Transaction,
  startedAt: string,
): Promise<RecoveredLine[]> {
  await tx.execute(
    sql`select pg_catalog.set_config('influx.worker_started_at', ${startedAt}::text, true)`,
  );
  const rows = await tx.execute<{
    id: string;
    written_status: RecoveredLine["writtenStatus"];
    reason: RecoveredLine["reason"];
    error_code: string | null;
  }>(
    sql`select outbox_id::text as id, written_status::text as written_status, reason, error_code
          from leads.recover_stale_outbox_lines()`,
  );
  return Array.from(rows, (row) => ({
    id: row.id,
    writtenStatus: row.written_status,
    reason: row.reason,
    errorCode: row.error_code,
  }));
}

/**
 * The subject of a Brevo line in processing for this worker (0112): its address and the fields of
 * the mapping (16 §M4, EC-11). null: the subject is not an existing account.
 */
export async function readBrevoSubject(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<BrevoSubject | null> {
  const rows = await tx.execute<{
    email: string;
    signed_up_at: string;
    company: string | null;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    referrer_domain: string | null;
    heard_from: string | null;
    via_invitation: boolean;
    consent_at: string | null;
    consent_source: string | null;
    welcome_sent: boolean;
    previous_email: string | null;
    external_contact_id: string | null;
    suppressed: boolean;
    signed_in_at: string | null;
    browser: string | null;
    time_zone: string;
    request_type: string | null;
    request_received_at: string | null;
    request_due_at: string | null;
    request_closed: boolean | null;
    export_expires_at: string | null;
  }>(
    sql`select email,
               to_char(signed_up_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as signed_up_at,
               company, utm_source, utm_medium, utm_campaign, referrer_domain, heard_from,
               via_invitation,
               to_char(consent_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as consent_at,
               consent_source, welcome_sent, previous_email, external_contact_id, suppressed,
               to_char(signed_in_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as signed_in_at,
               browser, time_zone, request_type,
               to_char(request_received_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as request_received_at,
               to_char(request_due_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as request_due_at,
               request_closed,
               to_char(export_expires_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as export_expires_at
          from leads.read_brevo_subject(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    email: row.email,
    signedUpAt: row.signed_up_at,
    company: row.company,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    referrerDomain: row.referrer_domain,
    heardFrom: row.heard_from,
    viaInvitation: row.via_invitation,
    consentAt: row.consent_at,
    consentSource: row.consent_source,
    welcomeSent: row.welcome_sent,
    previousEmail: row.previous_email,
    externalContactId: row.external_contact_id,
    suppressed: row.suppressed,
    signedInAt: row.signed_in_at,
    browser: row.browser,
    timeZone: row.time_zone,
    dataRequest:
      row.request_type === null ||
      row.request_received_at === null ||
      row.request_due_at === null
        ? null
        : {
            type: row.request_type,
            receivedAt: row.request_received_at,
            dueAt: row.request_due_at,
            closed: row.request_closed === true,
          },
    exportExpiresAt: row.export_expires_at,
  };
}

/**
 * The subject of an account.deleted line to brevo_contact in processing for this worker (0136): the
 * Brevo contact id and the address held until Brevo confirms. null: no such line, or the request
 * named by the line is not of its account.
 */
export async function readBrevoErasureSubject(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<BrevoErasureSubject | null> {
  const rows = await tx.execute<{
    external_contact_id: string | null;
    email: string | null;
  }>(
    sql`select external_contact_id, email
          from leads.read_brevo_erasure_subject(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { externalContactId: row.external_contact_id, email: row.email };
}

/**
 * The decision of a profile.decision line to brevo_transactional in processing for this worker
 * (0211): published or rejected, the reason code, the message of the agent (`other` only) and the
 * account's language. null: no decided entry of the line's account, or the account is erased.
 */
export async function readBrevoProfileDecision(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<BrevoProfileDecision | null> {
  const rows = await tx.execute<{
    decision: string;
    reason_code: string | null;
    member_message: string | null;
    preferred_language: string;
  }>(
    sql`select decision, reason_code, member_message, preferred_language
          from leads.read_brevo_profile_decision(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        decision: row.decision,
        reasonCode: row.reason_code,
        memberMessage: row.member_message,
        preferredLanguage: row.preferred_language,
      };
}

/**
 * The facts of a verification e-mail line to brevo_transactional in processing for this worker
 * (0227): null when the request is not the line's account's, the code not the request's, or the
 * account is erased.
 */
export async function readBrevoVerificationEmail(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<BrevoVerificationEmail | null> {
  const rows = await tx.execute<{
    level: string;
    network_code: string | null;
    request_status: string;
    reason_code: string | null;
    member_message: string | null;
    granted_at: string | null;
    badge_expires_at: string | null;
    code_kind: string | null;
    code_expires_at: string | null;
    code_revoked: boolean;
    preferred_language: string;
    dispute_window_days: number | null;
  }>(
    sql`select level, network_code, request_status, reason_code, member_message,
               to_char(granted_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as granted_at,
               to_char(badge_expires_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as badge_expires_at,
               code_kind,
               to_char(code_expires_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as code_expires_at,
               code_revoked, preferred_language, dispute_window_days
          from leads.read_brevo_verification_email(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        level: row.level,
        networkCode: row.network_code,
        requestStatus: row.request_status,
        reasonCode: row.reason_code,
        memberMessage: row.member_message,
        grantedAt: row.granted_at,
        badgeExpiresAt: row.badge_expires_at,
        codeKind: row.code_kind,
        codeExpiresAt: row.code_expires_at,
        codeRevoked: row.code_revoked,
        disputeWindowDays:
          row.dispute_window_days === null
            ? null
            : Number(row.dispute_window_days),
        preferredLanguage: row.preferred_language,
      };
}

/**
 * The facts of an e-mail of the life of the badge, on a line to brevo_transactional in processing
 * for this worker (0236): null when the object is not the line's account's or the account is erased.
 */
export async function readBrevoBadgeEmail(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<BrevoBadgeEmail | null> {
  const rows = await tx.execute<{
    level: string;
    network_code: string | null;
    object_state: string;
    contested_decision: string | null;
    badge_expires_at: string | null;
    grace_ends_at: string | null;
    reason_code: string | null;
    member_message: string | null;
    outcome_reason_code: string | null;
    restored_at: string | null;
    dispute_window_days: number | null;
    preferred_language: string;
  }>(
    sql`select level, network_code, object_state, contested_decision,
               to_char(badge_expires_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as badge_expires_at,
               to_char(grace_ends_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as grace_ends_at,
               reason_code, member_message, outcome_reason_code,
               to_char(restored_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as restored_at,
               dispute_window_days, preferred_language
          from leads.read_brevo_badge_email(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        level: row.level,
        networkCode: row.network_code,
        objectState: row.object_state,
        contestedDecision: row.contested_decision,
        badgeExpiresAt: row.badge_expires_at,
        graceEndsAt: row.grace_ends_at,
        reasonCode: row.reason_code,
        memberMessage: row.member_message,
        outcomeReasonCode: row.outcome_reason_code,
        restoredAt: row.restored_at,
        disputeWindowDays:
          row.dispute_window_days === null
            ? null
            : Number(row.dispute_window_days),
        preferredLanguage: row.preferred_language,
      };
}

/**
 * The badge level of a Brevo contact line in processing for this worker (0227): never Apollo.
 * null: no such account (unknown or erased).
 */
export async function readVerifiedBadge(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<VerifiedBadge | null> {
  const rows = await tx.execute<{
    verified_level: string;
    verified_at: string | null;
  }>(
    sql`select verified_level,
               to_char(verified_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as verified_at
          from leads.read_verified_badge(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    level:
      row.verified_level === "n1" || row.verified_level === "n2"
        ? row.verified_level
        : "none",
    at: row.verified_at,
  };
}

/**
 * The brand attributes of a Brevo or Apollo contact line in processing for this worker (0212): the
 * live profile of the line's account. null: no brand profile (a creator, an account without one, or
 * an erased account).
 */
export async function readBrandProfileAttributes(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<BrandProfileAttributes | null> {
  const rows = await tx.execute<{
    profile_status: string;
    completeness_percent: number | null;
    primary_sector_code: string | null;
    company_size_band: string | null;
    website_domain: string | null;
    main_topic_code: string | null;
    target_markets: string;
    ever_published: boolean;
  }>(
    sql`select profile_status, completeness_percent, primary_sector_code, company_size_band,
                website_domain, main_topic_code, target_markets, ever_published
          from leads.read_brand_profile_attributes(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        status: row.profile_status,
        completenessPercent: row.completeness_percent,
        primarySector: row.primary_sector_code,
        companySizeBand: row.company_size_band,
        websiteDomain: row.website_domain,
        mainTopic: row.main_topic_code,
        targetMarkets:
          row.target_markets === "" ? [] : row.target_markets.split(","),
        everPublished: row.ever_published,
      };
}

/**
 * The subject of an Apollo line in processing for this worker (0113): its address, the company name
 * of an advertiser, the opposition to prospection and the known Apollo contact id. null: the subject
 * is not an existing account.
 */
export async function readApolloSubject(
  tx: Transaction,
  lineId: string,
  worker: string,
): Promise<ApolloSubject | null> {
  const rows = await tx.execute<{
    email: string;
    company: string | null;
    prospection_opposed: boolean;
    external_contact_id: string | null;
  }>(
    sql`select email, company, prospection_opposed, external_contact_id
          from leads.read_apollo_subject(${lineId}::bigint, ${worker}::text)`,
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    email: row.email,
    company: row.company,
    prospectionOpposed: row.prospection_opposed,
    externalContactId: row.external_contact_id,
  };
}

/**
 * The start step (D68, D69; 0146): writes the Brevo list ids of the worker's environment into
 * leads.sync_settings, only the sub-keys given (none: nothing written), journaled by the trigger of
 * the table (0145); then returns the keys changed, the worker keys in force and the start instant.
 */
export async function startWorkerStep(
  tx: Transaction,
  listIds: Readonly<Record<string, number>>,
): Promise<WorkerStart> {
  const rows = await tx.execute<{
    changed_keys: string[];
    settings: Record<string, unknown>;
    started_at: string;
  }>(
    sql`select changed_keys, settings,
               to_char(started_at at time zone 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as started_at
          from leads.apply_brevo_ids_from_environment(${JSON.stringify(listIds)}::text::jsonb)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error(
      "unexpected answer of leads.apply_brevo_ids_from_environment()",
    );
  }
  return {
    changedKeys: row.changed_keys,
    settings: row.settings,
    startedAt: row.started_at,
  };
}
