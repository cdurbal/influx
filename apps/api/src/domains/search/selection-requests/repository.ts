// SQL of the brand's request for a selection by the INFLUX team (0325; jalons/l3f/modele.md §6). The
// statement runs in the member's transaction, as influx_advertiser, which holds NOTHING on `search.*`
// but EXECUTE on the door: it calls search.request_team_selection() and reads what it returns, never a
// table. The door checks the caller (42501 `forbidden`), the brand's profile (RG1), then the bucket of
// the account (nothing written when full), the filters (22023), the campaign (P0002) and the message
// (22023), and writes the request and its line of the register in the same transaction; the switch and
// the threshold are ignored (RG61). Nothing goes to a creator, the outbox nor matching (D45, CA64).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

/** search.request_team_selection(filters, campaign, message): the JSON answer of the door, as it is. */
export async function callRequestTeamSelection(
  tx: Transaction,
  filters: unknown,
  campaignId: string | null,
  message: string | null,
): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(
    sql`select search.request_team_selection(${JSON.stringify(filters)}::text::jsonb,
                                             ${campaignId}::uuid, ${message}::text) as answer`,
  );
  return rows[0]?.answer ?? null;
}
