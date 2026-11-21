// SQL of the identified creator search of the INFLUX agents (0328, 0329; jalons/l3g/modele.md §1, §4).
// The statements run in the backoffice session's transaction, as influx_agent or influx_admin, which
// hold NOTHING on `search.*`, `profiles.*` nor `campaigns.*` here but EXECUTE on the two doors: the
// route calls them and reads what they return, never a table. Each door checks the caller (42501
// `forbidden`: an agent or an administrator in aal2, active), the filters (22023), the campaign
// (P0002 `campaign`) and the prefill (P0002 `prefill`); the identified door journals what it serves
// or refuses in the same transaction (RG78, CA58) and the prefill door the line it proposes (CA56).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

/** search.search_creators_identified(filters, sort, page, campaign, prefill): the JSON answer, as it is. */
export async function callIdentifiedSearchDoor(
  tx: Transaction,
  filters: unknown,
  sort: string,
  page: number,
  campaignId: string | null,
  prefillId: string | null,
): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(
    sql`select search.search_creators_identified(${JSON.stringify(filters)}::text::jsonb, ${sort}::text,
                                                 ${page}::integer, ${campaignId}::uuid,
                                                 ${prefillId}::uuid) as answer`,
  );
  return rows[0]?.answer ?? null;
}

/** search.prefill_campaign_filters(campaign): the JSON answer of the door, as it is. */
export async function callCampaignPrefillDoor(
  tx: Transaction,
  campaignId: string,
): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(
    sql`select search.prefill_campaign_filters(${campaignId}::uuid) as answer`,
  );
  return rows[0]?.answer ?? null;
}
