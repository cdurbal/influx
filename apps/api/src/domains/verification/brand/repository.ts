// SQL of the brand's own verification request (docs/mvp/06 RG46, RG47, RG49, RG51; jalons/l2e/modele.md
// §3, §4 "Marque"; 0222; jalons/l2e commit 15). Every statement runs in the advertiser's transaction,
// as influx_advertiser, who holds NOTHING on the schema `verification` (EC-L2E-18, T9.6): each of them
// is one of the six doors of 0222 in the schema `profiles`, owned by influx_identity_definer and bound
// to the account of the transaction context (`influx.current_account_id()`), never a parameter.
// - The read door returns the latest brand request, its live code while it is open, the domain, the
//   internal block and the holding badge: never the agent, the internal comment, the lock, nor what the
//   agent observed.
// - A refusal of a door is a database error, said by its SQLSTATE, message and DETAIL (brand-service.ts
//   reads it). Nothing is logged here: the legal name, the number and the code are never in a trace
//   (fiche invariant 17).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** What `profiles.read_own_brand_verification()` answers, its instants as ISO text. */
export type OwnBrandVerificationRow = {
  requestId: string | null;
  requestStatus: string | null;
  requestedAt: string | null;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReasonCode: string | null;
  memberMessage: string | null;
  code: string | null;
  codeExpiresAt: string | null;
  websiteDomain: string | null;
  legalName: string | null;
  registrationCountryCode: string | null;
  registrationNumber: string | null;
  badgeState: string | null;
  badgeGrantedAt: string | null;
  badgeExpiresAt: string | null;
};

/** The database's instant, the one the code is judged by (the same as the creator's answer). */
export async function readBrandVerificationInstant(
  tx: Transaction,
): Promise<string> {
  const rows = await tx.execute<{ as_of: string }>(
    sql`select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("the database answered no instant");
  }
  return row.as_of;
}

/** `profiles.read_own_brand_verification()`: one row; 42501 outside an active advertiser with a profile. */
export async function readOwnBrandVerification(
  tx: Transaction,
): Promise<OwnBrandVerificationRow> {
  const rows = await tx.execute<{
    request_id: string | null;
    request_status: string | null;
    requested_at: string | null;
    submitted_at: string | null;
    decided_at: string | null;
    rejection_reason_code: string | null;
    member_message: string | null;
    code: string | null;
    code_expires_at: string | null;
    website_domain: string | null;
    legal_name: string | null;
    registration_country_code: string | null;
    registration_number: string | null;
    badge_state: string | null;
    badge_granted_at: string | null;
    badge_expires_at: string | null;
  }>(
    sql`select r.request_id::text as request_id, r.request_status,
               to_char(r.requested_at at time zone 'UTC', ${ISO_UTC}) as requested_at,
               to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
               to_char(r.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
               r.rejection_reason_code, r.member_message, r.code,
               to_char(r.code_expires_at at time zone 'UTC', ${ISO_UTC}) as code_expires_at,
               r.website_domain, r.legal_name, r.registration_country_code,
               r.registration_number, r.badge_state,
               to_char(r.badge_granted_at at time zone 'UTC', ${ISO_UTC}) as badge_granted_at,
               to_char(r.badge_expires_at at time zone 'UTC', ${ISO_UTC}) as badge_expires_at
          from profiles.read_own_brand_verification() r`,
  );
  const row = rows[0];
  if (row === undefined) {
    // the door answers one row for an active advertiser holding a profile, and refuses anyone else
    throw new Error("read_own_brand_verification answered no row");
  }
  return {
    requestId: row.request_id,
    requestStatus: row.request_status,
    requestedAt: row.requested_at,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    rejectionReasonCode: row.rejection_reason_code,
    memberMessage: row.member_message,
    code: row.code,
    codeExpiresAt: row.code_expires_at,
    websiteDomain: row.website_domain,
    legalName: row.legal_name,
    registrationCountryCode: row.registration_country_code,
    registrationNumber: row.registration_number,
    badgeState: row.badge_state,
    badgeGrantedAt: row.badge_granted_at,
    badgeExpiresAt: row.badge_expires_at,
  };
}

/** `profiles.open_own_brand_verification()`: the draft, created with its domain code or as it was. */
export async function openOwnBrandRequest(
  tx: Transaction,
): Promise<{ requestId: string; created: boolean }> {
  const rows = await tx.execute<{ request_id: string; created: boolean }>(
    sql`select request_id::text as request_id, created
          from profiles.open_own_brand_verification()`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("open_own_brand_verification answered no row");
  }
  return { requestId: row.request_id, created: row.created };
}

/** `profiles.save_own_brand_internal_details()`: the three fields, trimmed by the door. */
export async function saveOwnBrandInternalDetails(
  tx: Transaction,
  details: {
    legalName: string;
    registrationCountryCode: string;
    registrationNumber: string;
  },
): Promise<void> {
  await tx.execute(
    sql`select profiles.save_own_brand_internal_details(
          ${details.legalName}, ${details.registrationCountryCode}, ${details.registrationNumber})`,
  );
}

/** `profiles.renew_own_brand_verification_code()`: a new domain code on the draft, the former revoked. */
export async function renewOwnBrandCode(tx: Transaction): Promise<void> {
  await tx.execute(
    sql`select code_id from profiles.renew_own_brand_verification_code()`,
  );
}

/** `profiles.submit_own_brand_verification()`: draft to pending; already pending, nothing is written. */
export async function submitOwnBrandRequest(tx: Transaction): Promise<void> {
  await tx.execute(
    sql`select status from profiles.submit_own_brand_verification()`,
  );
}

/** `profiles.cancel_own_brand_verification()`: draft or pending to cancelled; already cancelled, nothing. */
export async function cancelOwnBrandRequest(tx: Transaction): Promise<void> {
  await tx.execute(
    sql`select status from profiles.cancel_own_brand_verification()`,
  );
}
