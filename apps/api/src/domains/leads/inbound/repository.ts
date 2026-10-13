// Database access of what Brevo reports back (decision 2 of the J7 start; migration 0116): the
// write of the api under influx_auth (E-1 `leads.receive_brevo_event`), and the processing of the
// worker under influx_worker (E-3 `leads.drain_outbox`, commit 4, through processing.ts). One
// SECURITY DEFINER function of influx_leads_definer each, every value a bound parameter (S-1).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { sqlStateOf } from "../../../db/sql-state.ts";

/** The raw line, as leads.record_brevo_event() takes it: no body, header, IP, subject nor link. */
export type BrevoRawLine = {
  event: string;
  /** ISO 8601, UTC. */
  occurredAt: string;
  messageId: string | null;
  email: string | null;
  campaignId: number | null;
  templateId: number | null;
  reason: string | null;
};

/**
 * Writes the line (origin webhook). The id of the new line; null when the same event was already
 * recorded (RG146-5, nothing written). 22023 — a value the database refuses — is thrown.
 */
export async function recordBrevoEvent(
  tx: Transaction,
  line: BrevoRawLine,
): Promise<string | null> {
  const rows = await tx.execute<{ id: string | null }>(
    sql`select leads.record_brevo_event(
          ${line.event}, ${line.occurredAt}::timestamptz, ${line.messageId}, ${line.email},
          ${line.campaignId}::bigint, ${line.templateId}::bigint, ${line.reason})::text as id`,
  );
  return rows[0]?.id ?? null;
}

const INVALID_PARAMETER_VALUE = "22023";

/** A value the database refused (22023): the event is invalid, never retried. */
export function isRefusedValue(error: unknown): boolean {
  return sqlStateOf(error) === INVALID_PARAMETER_VALUE;
}

/** The closed list of leads.brevo_inbound_outcome (0116). */
export const BREVO_INBOUND_OUTCOMES = [
  "rights_withdrawn",
  "no_change",
  "address_mismatch",
  "unmatched",
  "informative",
  "unknown_event",
] as const;
export type BrevoInboundOutcome = (typeof BREVO_INBOUND_OUTCOMES)[number];

export type ProcessedInboundLine = {
  inboundEventId: string;
  outcome: BrevoInboundOutcome;
  /** The account an effect was written on (the register subject), else null. */
  auditSubject: string | null;
};

/** The oldest raw line without an outcome, processed; null when none waits. */
export async function processInboundLine(
  tx: Transaction,
): Promise<ProcessedInboundLine | null> {
  const rows = await tx.execute<{
    inbound_event_id: string;
    outcome: BrevoInboundOutcome;
    audit_subject: string | null;
  }>(
    sql`select inbound_event_id::text as inbound_event_id, outcome::text as outcome,
               audit_subject::text as audit_subject
          from leads.process_brevo_inbound_event()`,
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    inboundEventId: row.inbound_event_id,
    outcome: row.outcome,
    auditSubject: row.audit_subject,
  };
}
