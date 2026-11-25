// SQL of the opening of a verification by an agent (docs/mvp/06 RG51; jalons/l2f/modele.md §6, D83 A;
// 0234; l2f commit 15). Runs as influx_agent or influx_admin in aal2:
// - `verification.open_request_for_member()` is the one door: it opens the verification of an ACTIVE
//   member (« Compte vérifié » of one of his lines, or « Marque vérifiée »), or takes over the request he
//   already has open, never doubling it, and says whether it created one. Pending at once, the code drawn
//   for a creator, the internal block of a brand written when it was missing, one e-mail to the member
//   (no code in it), the origin and the reason written once on the request.
// The rules are the database's. The refusal of the door is a database error (refusals.ts reads it).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

export type OpenedVerification = {
  requestId: string;
  status: string;
  created: boolean;
};

export type OpeningInput = {
  accountId: string;
  /** The line of a creator's « Compte vérifié »; null for a brand's « Marque vérifiée ». */
  socialAccountId: string | null;
  level: "account_verified" | "brand_verified";
  reasonCode: string;
  comment: string | null;
  /** The internal block of a brand that holds none: all three, or none. */
  legalName: string | null;
  registrationCountryCode: string | null;
  registrationNumber: string | null;
};

/** 0234 open_request_for_member(): one row, the request now waiting in queue 4. */
export async function openVerificationForMember(
  tx: Transaction,
  input: OpeningInput,
): Promise<OpenedVerification> {
  const rows = await tx.execute<{
    request_id: string;
    status: string;
    created: boolean;
  }>(
    sql`select request_id::text as request_id, status, created
          from verification.open_request_for_member(
                 ${input.accountId}::uuid, ${input.socialAccountId}::uuid,
                 ${input.level}::verification.badge_level, ${input.reasonCode}::text,
                 ${input.comment}::text, ${input.legalName}::text,
                 ${input.registrationCountryCode}::text, ${input.registrationNumber}::text)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.open_request_for_member returned no row");
  }
  return {
    requestId: row.request_id,
    status: row.status,
    created: row.created,
  };
}

/** A row of what the opening offers on an account (0239). */
export type AccountOpeningRow = {
  socialAccountId: string | null;
  networkCode: string | null;
  level: string;
  requestId: string | null;
  requestStatus: string | null;
  openedBy: string | null;
  hasWebsiteDomain: boolean | null;
  hasInternalDetails: boolean | null;
};

/** 0239 read_account_openings(): 42501 for the caller's own account and an unknown one. */
export async function readAccountOpenings(
  tx: Transaction,
  accountId: string,
): Promise<AccountOpeningRow[]> {
  const rows = await tx.execute<{
    social_account_id: string | null;
    network_code: string | null;
    level: string;
    request_id: string | null;
    request_status: string | null;
    opened_by: string | null;
    has_website_domain: boolean | null;
    has_internal_details: boolean | null;
  }>(
    sql`select o.social_account_id::text as social_account_id, o.network_code, o.level::text as level,
               o.request_id::text as request_id, o.request_status, o.opened_by,
               o.has_website_domain, o.has_internal_details
          from verification.read_account_openings(${accountId}::uuid) o`,
  );
  return rows.map((row) => ({
    socialAccountId: row.social_account_id,
    networkCode: row.network_code,
    level: row.level,
    requestId: row.request_id,
    requestStatus: row.request_status,
    openedBy: row.opened_by,
    hasWebsiteDomain: row.has_website_domain,
    hasInternalDetails: row.has_internal_details,
  }));
}
