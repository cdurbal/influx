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
