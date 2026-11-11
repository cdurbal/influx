// The acts on an entry of queues 2 and 3 as database calls (docs/mvp/07 RG5, RG10, RG78, RG94 to RG99;
// 15 RG27 C1 to C4, C6, C8, RG35; jalons/l2g/modele.md §3 "0244"), under influx_agent or influx_admin in
// aal2. Parameterised queries only (S-1).
// - Every write is a database function of 0244 (SECURITY DEFINER, owned by influx_moderation_definer):
//   open (= claim), release, extend, force release, publish, reject (queue 2) and approve, reject
//   (queue 3). Each locks what it decides, checks the live claim of the caller, the version token and
//   the rules, writes the decision, the register and the leads events in ONE transaction. Nothing here
//   updates a table (RG5: only a human decision publishes).
// - The two reads of a visual are journaled doors too (`queue.portfolio_read`, in the transaction that
//   hands the key over): the key goes to the relay of Storage, never to a response nor a log.
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";
import { ISO_UTC } from "../../sql-formats.ts";
import type { CreatorQueue } from "../lists/repository.ts";

export type Decided = { decidedAt: string; late: boolean };

export type OpeningRow = {
  outcome: "claimed" | "held" | "read_only" | "closed";
  reviewToken: string | null;
};

/**
 * 15 C1, C2: opening is taking. The database decides in one conditional UPDATE and journals the opening
 * (`queue.entry_opened`, with the queue code). 42501 for an unknown entry, one of the caller's own
 * account, or an open one of an account he holds.
 */
export async function openEntry(
  tx: Transaction,
  queue: CreatorQueue,
  entryId: string,
): Promise<OpeningRow> {
  const rows = await tx.execute<{
    outcome: OpeningRow["outcome"];
    review_token: string | null;
  }>(
    queue === "profiles_creator"
      ? sql`select outcome, review_token
              from profiles.open_creator_review_entry(${entryId}::uuid)`
      : sql`select outcome, review_token
              from profiles.open_portfolio_item(${entryId}::uuid)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`the opening of ${queue} returned no row`);
  }
  return { outcome: row.outcome, reviewToken: row.review_token };
}

/** 15 C3: the holder gives the entry back to the queue. */
export async function releaseEntry(
  tx: Transaction,
  queue: CreatorQueue,
  entryId: string,
): Promise<void> {
  await tx.execute(
    queue === "profiles_creator"
      ? sql`select profiles.release_creator_review_entry(${entryId}::uuid)`
      : sql`select profiles.release_portfolio_item(${entryId}::uuid)`,
  );
}

/** File.md A9: the holder of a live claim takes the delay again; the new expiry. */
export async function extendClaim(
  tx: Transaction,
  queue: CreatorQueue,
  entryId: string,
): Promise<string> {
  const rows = await tx.execute<{ expires_at: string }>(
    queue === "profiles_creator"
      ? sql`select to_char(profiles.extend_creator_review_claim(${entryId}::uuid)
                             at time zone 'UTC', ${ISO_UTC}) as expires_at`
      : sql`select to_char(profiles.extend_portfolio_item_claim(${entryId}::uuid)
                             at time zone 'UTC', ${ISO_UTC}) as expires_at`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`the extension of ${queue} returned no row`);
  }
  return row.expires_at;
}

/** 15 C4, an administrator: lifts a live claim with a typed reason; returns the dispossessed holder. */
export async function forceRelease(
  tx: Transaction,
  queue: CreatorQueue,
  entryId: string,
  reasonCode: string,
): Promise<string | null> {
  const rows = await tx.execute<{ holder: string | null }>(
    queue === "profiles_creator"
      ? sql`select profiles.force_release_creator_review_claim(
                     ${entryId}::uuid, ${reasonCode})::text as holder`
      : sql`select profiles.force_release_portfolio_item_claim(
                     ${entryId}::uuid, ${reasonCode})::text as holder`,
  );
  return rows[0]?.holder ?? null;
}

type DecidedRow = { decided_at: string; sla_breached: boolean };

function decidedOf(rows: readonly DecidedRow[], door: string): Decided {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${door}() returned no row`);
  }
  return { decidedAt: row.decided_at, late: row.sla_breached };
}

/** 07 RG5: the publication of a profile. `firstPublication`: the one `profile.completed` of RG106. */
export async function publishEntry(
  tx: Transaction,
  entryId: string,
  reviewToken: string,
  internalComment: string | null,
): Promise<Decided & { firstPublication: boolean }> {
  const rows = await tx.execute<
    DecidedRow & { first_publication: boolean }
  >(sql`
    select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           sla_breached, first_publication
      from profiles.publish_creator_review_entry(
             ${entryId}::uuid, ${reviewToken}, ${internalComment})`);
  const decided = decidedOf(rows, "profiles.publish_creator_review_entry");
  return { ...decided, firstPublication: rows[0]?.first_publication === true };
}

/** 07 RG10, RG96: the refusal of a profile, with its typed reason; the message of `other` is the agent's own. */
export async function rejectEntry(
  tx: Transaction,
  entryId: string,
  reviewToken: string,
  reasonCode: string,
  memberMessage: string | null,
  internalComment: string | null,
): Promise<Decided> {
  const rows = await tx.execute<DecidedRow>(sql`
    select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from profiles.reject_creator_review_entry(
             ${entryId}::uuid, ${reviewToken}, ${reasonCode}, ${memberMessage},
             ${internalComment})`);
  return decidedOf(rows, "profiles.reject_creator_review_entry");
}

/** 07 RG78, RG95: one visual approved (a replacement takes the place of its original, RG81). */
export async function approveItem(
  tx: Transaction,
  itemId: string,
  reviewToken: string,
  internalComment: string | null,
): Promise<Decided> {
  const rows = await tx.execute<DecidedRow>(sql`
    select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from profiles.approve_portfolio_item(
             ${itemId}::uuid, ${reviewToken}, ${internalComment})`);
  return decidedOf(rows, "profiles.approve_portfolio_item");
}

/** 07 RG79, RG97: one visual refused with a reason of the grid; no message to the member. */
export async function rejectItem(
  tx: Transaction,
  itemId: string,
  reviewToken: string,
  reasonCode: string,
  internalComment: string | null,
): Promise<Decided> {
  const rows = await tx.execute<DecidedRow>(sql`
    select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from profiles.reject_portfolio_item(
             ${itemId}::uuid, ${reviewToken}, ${reasonCode}, ${internalComment})`);
  return decidedOf(rows, "profiles.reject_portfolio_item");
}

/** What the journaled read of a visual gives apps/api to relay the object. Never sent as is. */
export type ReviewedObject = {
  state: "pending" | "approved";
  /** The key in Storage: relayed from here to the store, never written to a response or a log. */
  objectKey: string;
  byteSize: number;
  width: number;
  height: number;
};

type ObjectRow = {
  state: "pending" | "approved";
  object_key: string;
  byte_size: number;
  width: number;
  height: number;
};

function objectOf(rows: readonly ObjectRow[]): ReviewedObject | null {
  const row = rows[0];
  return row === undefined
    ? null
    : {
        state: row.state,
        objectKey: row.object_key,
        byteSize: row.byte_size,
        width: row.width,
        height: row.height,
      };
}

/**
 * D82 (7), modele point 10: a visual of an entry of queue 2, by the journaled door of 0244: the holder
 * of a live claim only, a pending or approved visual of the account of the entry; one
 * `queue.portfolio_read` line {queue_code, item_id, state} in this transaction.
 */
export async function readCreatorEntryItem(
  tx: Transaction,
  entryId: string,
  itemId: string,
): Promise<ReviewedObject | null> {
  return objectOf(
    await tx.execute<ObjectRow>(sql`
      select r.state, r.object_key, r.byte_size, r.width, r.height
        from profiles.read_creator_review_portfolio_item(
               ${entryId}::uuid, ${itemId}::uuid) r`),
  );
}

/** The visual of queue 3, by the journaled door of 0244: its holder only. */
export async function readPortfolioItem(
  tx: Transaction,
  itemId: string,
): Promise<ReviewedObject | null> {
  return objectOf(
    await tx.execute<ObjectRow>(sql`
      select r.state, r.object_key, r.byte_size, r.width, r.height
        from profiles.read_portfolio_item_for_review(${itemId}::uuid) r`),
  );
}
