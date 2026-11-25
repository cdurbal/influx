// Database access of blocks 2 and 3 of a brand record (docs/mvp/15 RG41; 17b §3.5; jalons/l2c/
// file.md A1, A4; L2C-18), under influx_agent or influx_admin in aal2 (policies of 0202, 0207).
// - The contact person (block 2) is read here and in the decision view only (D45, D46, L2BS-7). No
//   line of the register is written by this read: the record is opened through
//   backoffice.read_subject_history() (0132), which writes `history.account_read` once for the
//   whole record, contact included (15 RG40). The caller reads this BEFORE the history, in the same
//   transaction: the opening is never journaled without the read, nor the read without it.
// - Block 3 reads the live profile (the last validated version, 06 RG9), the moderated fields that
//   wait for a decision, and the closed decisions of queue 1. Never the message sent to the brand
//   nor the internal comment of a decision.
// Parameterised queries only (S-1).
import { ACCOUNT_BRAND_DECISIONS_MAX } from "@influx/contracts/backoffice-accounts";
import type {
  BrandProfileStatus,
  ModeratedFieldCode,
  RejectionReasonCode,
} from "@influx/contracts/brand-profile";
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { ISO_UTC } from "../sql-formats.ts";

export type BrandRecord = {
  contact: {
    firstName: string | null;
    role: string | null;
    email: string | null;
    phone: string | null;
    url: string | null;
  };
  profile: {
    status: BrandProfileStatus;
    completenessPercent: number | null;
    changedFields: ModeratedFieldCode[];
    decisions: {
      outcome: "published" | "rejected";
      decidedAt: string;
      decidedBy: { accountId: string; displayName: string | null } | null;
      late: boolean;
      reasonCode: RejectionReasonCode | null;
    }[];
    hasMoreDecisions: boolean;
  };
};

/** The brand blocks of an advertiser account; null when it has no profile row. */
export async function brandRecordOf(
  tx: Transaction,
  accountId: string,
): Promise<BrandRecord | null> {
  const [profile] = await tx.execute<{
    status: BrandProfileStatus;
    completeness_percent: number | null;
    contact_role: string | null;
    contact_first_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    contact_url: string | null;
  }>(sql`
    select p.status::text as status, p.completeness_percent, p.contact_role,
           c.contact_first_name, c.contact_email, c.contact_phone, c.contact_url
      from profiles.advertiser_profiles p
      left join profiles.advertiser_contact_details c on c.account_id = p.account_id
     where p.account_id = ${accountId}::uuid`);
  if (profile === undefined) {
    return null;
  }
  const changed = await tx.execute<{ field_code: ModeratedFieldCode }>(sql`
    select distinct r.field_code
      from profiles.profile_field_revisions r
     where r.account_id = ${accountId}::uuid and r.status = 'pending_review'
     order by r.field_code`);
  const decided = await tx.execute<{
    outcome: "published" | "rejected";
    decided_at: string;
    decided_by: string | null;
    decided_by_name: string | null;
    late: boolean;
    reason_code: RejectionReasonCode | null;
  }>(sql`
    select e.state::text as outcome,
           to_char(e.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           e.decided_by_account_id::text as decided_by, d.display_name as decided_by_name,
           e.sla_breached as late, e.rejection_reason_code as reason_code
      from profiles.advertiser_review_entries e
      left join identity.accounts d on d.id = e.decided_by_account_id
     where e.account_id = ${accountId}::uuid and e.state in ('published', 'rejected')
     order by e.decided_at desc, e.id
     limit ${ACCOUNT_BRAND_DECISIONS_MAX + 1}::integer`);
  return {
    contact: {
      firstName: profile.contact_first_name,
      role: profile.contact_role,
      email: profile.contact_email,
      phone: profile.contact_phone,
      url: profile.contact_url,
    },
    profile: {
      status: profile.status,
      completenessPercent: profile.completeness_percent,
      changedFields: changed.map((row) => row.field_code),
      decisions: decided.slice(0, ACCOUNT_BRAND_DECISIONS_MAX).map((row) => ({
        outcome: row.outcome,
        decidedAt: row.decided_at,
        decidedBy:
          row.decided_by === null
            ? null
            : { accountId: row.decided_by, displayName: row.decided_by_name },
        late: row.late,
        reasonCode: row.reason_code,
      })),
      hasMoreDecisions: decided.length > ACCOUNT_BRAND_DECISIONS_MAX,
    },
  };
}
