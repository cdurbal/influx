// What a published brand profile holds besides its validated values: the changes waiting for review
// and the last refusal, read for the brand itself (docs/mvp/06 RG9, RG10, RG66, CA15, CA20;
// jalons/l2c/file.md A2 to A4, A6; commit 13). Every statement runs in the member's transaction as
// influx_advertiser: the account is the one of the transaction context, and the policies of 0207
// bind each read to it. The member reads neither the lock, the agent nor the internal comment of an
// entry (column rights of 0207): none is selected here, and none could be.
// The doors that write (`profiles.submit_own_advertiser_revision`,
// `profiles.record_own_advertiser_profile_change`, 0209) are SQL functions of the database.
import type {
  BrandRefusal,
  PendingChange,
  PendingChangeField,
} from "@influx/contracts/brand-profile";
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** The code of `profiles.moderated_fields` (04 §5.2) of each field the contract names. */
export const MODERATED_CODE_OF_FIELD: Readonly<
  Record<PendingChangeField, string>
> = {
  companyName: "advertiser.brand_name",
  logo: "advertiser.logo",
  presentation: "advertiser.presentation",
  website: "advertiser.website_domain",
  contactRole: "advertiser.contact_role",
  primarySector: "advertiser.primary_sector",
};

const FIELD_OF_MODERATED_CODE: ReadonlyMap<string, PendingChangeField> =
  new Map(
    (
      Object.entries(MODERATED_CODE_OF_FIELD) as [PendingChangeField, string][]
    ).map(([field, code]) => [code, field]),
  );

/** The contract field of a moderated code, null for a code the contract does not name. */
export function fieldOfModeratedCode(code: string): PendingChangeField | null {
  return FIELD_OF_MODERATED_CODE.get(code) ?? null;
}

/**
 * Proposes a value for a moderated field of the PUBLISHED profile of the session's account
 * (`profiles.submit_own_advertiser_revision`, 0209): the live row keeps the validated value, the
 * pending revision of the field is replaced, a return to the validated value withdraws it. `null`
 * (JSON null) proposes to empty the field. Returns the revision status, null when nothing changed.
 * 23514 (required field emptied), 22023 (wrong type), 55000 (not published), 42501 are the refusals.
 */
export async function proposeRevision(
  tx: Transaction,
  field: Exclude<PendingChangeField, "logo">,
  value: string | null,
): Promise<string | null> {
  const rows = await tx.execute<{ revision_status: string | null }>(
    sql`select revision_status::text as revision_status
          from profiles.submit_own_advertiser_revision(
                 ${MODERATED_CODE_OF_FIELD[field]}::text, ${JSON.stringify(value)}::jsonb)`,
  );
  return rows[0]?.revision_status ?? null;
}

/**
 * The lead.updated of a change with immediate effect on a published profile
 * (`profiles.record_own_advertiser_profile_change`, 0209; 06 RG78): ONE per save, in this
 * transaction. False when the profile is not published.
 */
export async function recordImmediateChange(tx: Transaction): Promise<boolean> {
  const rows = await tx.execute<{ recorded: boolean }>(
    sql`select profiles.record_own_advertiser_profile_change() as recorded`,
  );
  return rows[0]?.recorded === true;
}

/** The changes waiting for review, by field of the contract, in the order they were proposed. */
export async function readPendingChanges(
  tx: Transaction,
): Promise<PendingChange[]> {
  const rows = await tx.execute<{
    field_code: string;
    value: string | null;
    logo_set: boolean | null;
    submitted_at: string;
  }>(
    sql`select r.field_code,
               r.proposed_value #>> '{}' as value,
               (r.proposed_value ->> 'logo_object_id') is not null as logo_set,
               to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at
          from profiles.profile_field_revisions r
         where r.account_id = (select influx.current_account_id())
           and r.status = 'pending_review'
         order by r.submitted_at, r.field_code`,
  );
  const changes: PendingChange[] = [];
  for (const row of rows) {
    const field = fieldOfModeratedCode(row.field_code);
    if (field === null) {
      continue;
    }
    if (field === "logo") {
      // the object stays unnamed: the brand reads it by GET .../logo
      changes.push({
        field,
        change: row.logo_set === true ? "set" : "clear",
        value: null,
        submittedAt: row.submitted_at,
      });
    } else {
      changes.push({
        field,
        change: row.value === null ? "clear" : "set",
        value: row.value,
        submittedAt: row.submitted_at,
      });
    }
  }
  return changes;
}

/** A refusal as stored, before its message is read from the translation files of the account. */
export type StoredRefusal = Omit<BrandRefusal, "message" | "reasonCode"> & {
  reasonCode: string;
};

/**
 * The last decision of INFLUX when it is a refusal and nothing newer is under examination (06
 * RG10: the brand corrects and submits again; the refusal then gives way to the open entry). The
 * member text is the agent's own (`other` only); the internal comment is not readable by the brand.
 */
export async function readLastRefusal(
  tx: Transaction,
): Promise<StoredRefusal | null> {
  const rows = await tx.execute<{
    kind: "submission" | "revision";
    state: string;
    reason_code: string | null;
    member_message: string | null;
    decided_at: string | null;
    fields: string[];
  }>(
    sql`select e.kind::text as kind, e.state::text as state,
               e.rejection_reason_code as reason_code, e.member_message,
               to_char(e.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
               coalesce((select jsonb_agg(r.field_code order by r.field_code)
                           from profiles.profile_field_revisions r
                          where r.advertiser_review_entry_id = e.id
                            and r.status = 'rejected'), '[]'::jsonb) as fields
          from profiles.advertiser_review_entries e
         where e.account_id = (select influx.current_account_id())
           and e.state in ('published', 'rejected')
           and not exists (select 1 from profiles.advertiser_review_entries o
                            where o.account_id = e.account_id and o.state = 'open')
         order by e.decided_at desc nulls last, e.created_at desc
         limit 1`,
  );
  const row = rows[0];
  if (
    row === undefined ||
    row.state !== "rejected" ||
    row.reason_code === null ||
    row.decided_at === null
  ) {
    return null;
  }
  const fields: PendingChangeField[] = [];
  for (const code of row.fields) {
    const field = fieldOfModeratedCode(code);
    if (field !== null) {
      fields.push(field);
    }
  }
  return {
    kind: row.kind,
    reasonCode: row.reason_code,
    memberMessage: row.member_message,
    fields,
    decidedAt: row.decided_at,
  };
}
