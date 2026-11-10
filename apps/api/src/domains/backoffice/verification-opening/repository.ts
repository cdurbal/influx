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
