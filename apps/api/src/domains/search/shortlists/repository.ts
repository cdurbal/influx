// SQL of the brand's shortlists (0324; jalons/l3f/modele.md §5). The statements run in the member's
// transaction, as influx_advertiser, which holds NOTHING on `search.*` nor `profiles.*` but EXECUTE on
// the eight doors: each one is called by name and its JSON answer is read as it is, never a table. A
// door checks the caller (42501 `forbidden`), the brand's profile (RG1) and the switch (D38) first, then
// the list (P0002 shortlist), the name or the note (22023), the campaign (P0002 campaign), the creator
// (P0002 creator) and the bounds (54000), and writes nothing to a creator, the outbox nor matching
// (D45, CA52, CA64).
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

async function answerOf(tx: Transaction, statement: SQL): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(statement);
  return rows[0]?.answer ?? null;
}

/** search.list_shortlists(). */
export function callListShortlists(tx: Transaction): Promise<unknown> {
  return answerOf(tx, sql`select search.list_shortlists() as answer`);
}

/** search.read_shortlist(id). */
export function callReadShortlist(
  tx: Transaction,
  shortlistId: string,
): Promise<unknown> {
  return answerOf(
    tx,
    sql`select search.read_shortlist(${shortlistId}::uuid) as answer`,
  );
}

/** search.create_shortlist(name, campaign). */
export function callCreateShortlist(
  tx: Transaction,
  name: string,
  campaignId: string | null,
): Promise<unknown> {
  return answerOf(
    tx,
    sql`select search.create_shortlist(${name}::text, ${campaignId}::uuid) as answer`,
  );
}

/** search.update_shortlist(id, name, campaign): a replacement. */
export function callUpdateShortlist(
  tx: Transaction,
  shortlistId: string,
  name: string,
  campaignId: string | null,
): Promise<unknown> {
  return answerOf(
    tx,
    sql`select search.update_shortlist(${shortlistId}::uuid, ${name}::text,
                                       ${campaignId}::uuid) as answer`,
  );
}

/** search.delete_shortlist(id). */
export function callDeleteShortlist(
  tx: Transaction,
  shortlistId: string,
): Promise<unknown> {
  return answerOf(
    tx,
    sql`select search.delete_shortlist(${shortlistId}::uuid) as answer`,
  );
}

/** search.add_to_shortlist(id, alias). */
export function callAddToShortlist(
  tx: Transaction,
  shortlistId: string,
  alias: string,
): Promise<unknown> {
  return answerOf(
    tx,
    sql`select search.add_to_shortlist(${shortlistId}::uuid, ${alias}::text) as answer`,
  );
}

/** search.set_shortlist_note(id, alias, note): a null note clears it. */
export function callSetShortlistNote(
  tx: Transaction,
  shortlistId: string,
  alias: string,
  note: string | null,
): Promise<unknown> {
  return answerOf(
    tx,
    sql`select search.set_shortlist_note(${shortlistId}::uuid, ${alias}::text,
                                         ${note}::text) as answer`,
  );
}

/** search.remove_from_shortlist(id, alias). */
export function callRemoveFromShortlist(
  tx: Transaction,
  shortlistId: string,
  alias: string,
): Promise<unknown> {
  return answerOf(
    tx,
    sql`select search.remove_from_shortlist(${shortlistId}::uuid, ${alias}::text) as answer`,
  );
}
