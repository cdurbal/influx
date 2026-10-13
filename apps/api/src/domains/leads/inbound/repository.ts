// Database access of what Brevo reports back, for the api, under influx_auth (E-1
// `leads.receive_brevo_event`; decision 2 of the J7 start; migration 0116). One SECURITY DEFINER
// function of influx_leads_definer, every value a bound parameter (S-1). The worker's processing
// of the same lines is not here (E-3, commit 4): this module is reachable from the api only.
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
