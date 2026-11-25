// SQL of the creator's read of the open campaigns (0314; jalons/l3d/modele.md §1, §7). Every statement
// runs in the member's transaction, as influx_creator, which holds NOTHING on `campaigns` nor on
// `profiles.advertiser_*` (TM5.6): it calls the three doors of the schema `search` and reads what
// they return, never a table. The doors check the caller (42501 `forbidden`), the visibility, the
// bucket of the account and write the journal line of every outcome (RG22, CA18): the answer is the
// door's, committed with its line, and apps/api refuses AFTER the COMMIT (modele §7).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** search.read_open_campaigns(sort, page): the JSON answer of the door, as it is. */
export async function callOpenCampaignsDoor(
  tx: Transaction,
  sort: string,
  page: number,
): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(
    sql`select search.read_open_campaigns(${sort}::text, ${page}::integer) as answer`,
  );
  return rows[0]?.answer ?? null;
}

/** search.read_open_campaign(id): the JSON answer of the door, as it is. */
export async function callOpenCampaignDoor(
  tx: Transaction,
  campaignId: string,
): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(
    sql`select search.read_open_campaign(${campaignId}::uuid) as answer`,
  );
  return rows[0]?.answer ?? null;
}

/** The row of search.read_open_campaign_brand_logo(id): the key never leaves this process. */
export type OpenCampaignLogoRow = {
  visible: boolean;
  objectKey: string | null;
  width: number | null;
  height: number | null;
  activatedAt: string | null;
};

export async function callOpenCampaignLogoDoor(
  tx: Transaction,
  campaignId: string,
): Promise<OpenCampaignLogoRow> {
  const rows = await tx.execute<{
    visible: boolean;
    object_key: string | null;
    width: number | null;
    height: number | null;
    activated_at: string | null;
  }>(
    sql`select l.visible, l.object_key, l.width, l.height,
               to_char(l.activated_at at time zone 'UTC', ${ISO_UTC}) as activated_at
          from search.read_open_campaign_brand_logo(${campaignId}::uuid) l`,
  );
  const row = rows[0];
  if (row === undefined) {
    // the door returns one row in every case: none is a fault of the base, not an invisible campaign
    throw new Error("search.read_open_campaign_brand_logo returned no row");
  }
  return {
    visible: row.visible === true,
    objectKey: row.object_key,
    width: row.width === null ? null : Number(row.width),
    height: row.height === null ? null : Number(row.height),
    activatedAt: row.activated_at,
  };
}
