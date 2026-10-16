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

export type RecoveredLine = { id: string; writtenStatus: "pending" | "failed" };

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
  /** A privacy.request_received line: its request, of the line's account (0128); else all null. */
  dataRequest: {
    type: string;
    /** ISO 8601. */
    receivedAt: string;
    /** ISO 8601. */
    dueAt: string;
    closed: boolean;
  } | null;
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

/** Takes back the lines left in processing for more than 600 s (TM1.10). */
export async function recoverStaleLines(
  tx: Transaction,
): Promise<RecoveredLine[]> {
  const rows = await tx.execute<{
    id: string;
    written_status: RecoveredLine["writtenStatus"];
  }>(
    sql`select outbox_id::text as id, written_status::text as written_status
          from leads.recover_stale_outbox_lines()`,
  );
  return Array.from(rows, (row) => ({
    id: row.id,
    writtenStatus: row.written_status,
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
               request_closed
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
