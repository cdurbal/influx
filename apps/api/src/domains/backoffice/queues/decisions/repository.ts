// Database access of the decisions on an entry of queue 1 (docs/mvp/06 RG6, RG65, RG66, RG69;
// 15 RG27 C3, C4, C8; jalons/l2c/file.md A3, A6, A8, A9, "Fonctions"; migration 0210), under
// influx_agent or influx_admin in aal2. Parameterised queries only (S-1).
// - Every write is a database function of 0210 (SECURITY DEFINER, owned by influx_moderation_definer):
//   publish, reject, release, extend, force release. Each locks the entry row, checks the claim, the
//   version token and the required fields, writes the decision, the register lines and the leads
//   events in ONE transaction. Nothing here updates a table (RG6: only a human decision publishes).
// - The reads of this file serve the refusals and the chaining only; none reads a coordinate.
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";
import { ISO_UTC } from "../../sql-formats.ts";
import { conditionsOf } from "../repository.ts";

export type Decided = { decidedAt: string; late: boolean };

/** 06 RG6, RG65: the publication. `firstPublication`: the one `profile.completed` of RG78. */
export async function publishEntry(
  tx: Transaction,
  entryId: string,
  reviewToken: string,
  internalComment: string | null,
): Promise<Decided & { firstPublication: boolean }> {
  const rows = await tx.execute<{
    decided_at: string;
    sla_breached: boolean;
    first_publication: boolean;
  }>(sql`
    select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           sla_breached, first_publication
      from profiles.publish_advertiser_review_entry(
             ${entryId}::uuid, ${reviewToken}, ${internalComment})`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error(
      "profiles.publish_advertiser_review_entry() returned no row",
    );
  }
  return {
    decidedAt: row.decided_at,
    late: row.sla_breached,
    firstPublication: row.first_publication,
  };
}

/** 06 RG65, RG66: the refusal, with its typed reason; the message of `other` is the agent's own. */
export async function rejectEntry(
  tx: Transaction,
  entryId: string,
  reviewToken: string,
  reasonCode: string,
  memberMessage: string | null,
  internalComment: string | null,
): Promise<Decided> {
  const rows = await tx.execute<{
    decided_at: string;
    sla_breached: boolean;
  }>(sql`
    select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from profiles.reject_advertiser_review_entry(
             ${entryId}::uuid, ${reviewToken}, ${reasonCode}, ${memberMessage},
             ${internalComment})`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error(
      "profiles.reject_advertiser_review_entry() returned no row",
    );
  }
  return { decidedAt: row.decided_at, late: row.sla_breached };
}

/** 15 C3: the holder gives the entry back to the queue. */
export async function releaseEntry(
  tx: Transaction,
  entryId: string,
): Promise<void> {
  await tx.execute(
    sql`select profiles.release_advertiser_review_entry(${entryId}::uuid)`,
  );
}

/** File.md A9: the holder of a live claim takes the delay again; the new expiry. */
export async function extendClaim(
  tx: Transaction,
  entryId: string,
): Promise<string> {
  const rows = await tx.execute<{ expires_at: string }>(sql`
    select to_char(profiles.extend_advertiser_review_claim(${entryId}::uuid)
                     at time zone 'UTC', ${ISO_UTC}) as expires_at`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error(
      "profiles.extend_advertiser_review_claim() returned no row",
    );
  }
  return row.expires_at;
}

/** 15 C4, an administrator: lifts a live claim with a typed reason; returns the dispossessed holder. */
export async function forceRelease(
  tx: Transaction,
  entryId: string,
  reasonCode: string,
): Promise<string | null> {
  const rows = await tx.execute<{ holder: string | null }>(sql`
    select profiles.force_release_advertiser_review_claim(
             ${entryId}::uuid, ${reasonCode})::text as holder`);
  return rows[0]?.holder ?? null;
}

/** The name of an account (an agent's display name), for the refusal that names a holder (C2). */
export async function displayNameOf(
  tx: Transaction,
  accountId: string,
): Promise<string | null> {
  const rows = await tx.execute<{ display_name: string | null }>(sql`
    select display_name from identity.accounts where id = ${accountId}::uuid`);
  return rows[0]?.display_name ?? null;
}

/** Whether the last forced release of the entry dispossessed this agent (file.md A8). */
export async function wasDispossessed(
  tx: Transaction,
  entryId: string,
  accountId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ dispossessed: boolean }>(sql`
    select (forced_release_holder_account_id = ${accountId}::uuid) as dispossessed
      from profiles.advertiser_review_entries
     where id = ${entryId}::uuid and forced_release_at is not null`);
  return rows[0]?.dispossessed === true;
}

/**
 * 17b §2.6: the entry to open after a decision: oldest deadline first, ties by creation, among the
 * open ones nobody holds, never the caller's own account nor one he holds (RG36). Null when none.
 */
export async function nextEntryId(
  tx: Transaction,
  caller: string,
): Promise<string | null> {
  const rows = await tx.execute<{ id: string }>(sql`
    select e.id::text as id
      from profiles.advertiser_review_entries e
      join identity.accounts a on a.id = e.account_id
     where ${sql.join(conditionsOf({ holder: "free" }, caller), sql` and `)}
     order by e.sla_due_at, e.created_at, e.id
     limit 1`);
  return rows[0]?.id ?? null;
}
