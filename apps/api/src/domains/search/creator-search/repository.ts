// SQL of the brand's anonymous creator search (0319, 0320; jalons/l3e/modele.md §1, §10). The statement
// runs in the member's transaction, as influx_advertiser, which holds NOTHING on `profiles.*`,
// `campaigns.*` nor `search.*` but EXECUTE on the door: it calls search.search_creators() and reads
// what it returns, never a table. The door checks the caller (42501 `forbidden`), the brand's profile
// (RG1), the switch (D38), the bucket of the account, the filters (22023), the campaign of origin
// (P0002), the cap of pages and k, and writes the journal of every outcome it serves or refuses in the
// same transaction (CA47): apps/api refuses AFTER the COMMIT.
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

/** search.search_creators(filters, sort, page, campaign): the JSON answer of the door, as it is. */
export async function callCreatorSearchDoor(
  tx: Transaction,
  filters: unknown,
  sort: string,
  page: number,
  campaignId: string | null,
): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(
    sql`select search.search_creators(${JSON.stringify(filters)}::text::jsonb, ${sort}::text,
                                      ${page}::integer, ${campaignId}::uuid) as answer`,
  );
  return rows[0]?.answer ?? null;
}
