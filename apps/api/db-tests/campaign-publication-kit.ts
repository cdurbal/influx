// A campaign put in the published (or paused) state as INFLUX would, for the fixtures of the campaign
// tests (0308, L3C-03). From 0308 a published or paused campaign carries its snapshot
// (campaigns_published_needs_review): this writes, as the connection given (the migration role or the
// local superuser, outside the freeze), a published entry of queue 7, a snapshot naming it and the
// state, in ONE statement. The real publication is publish_campaign_review_entry() (L3C-T3).
import { accountIdOf } from "@influx/test-kit/db";
import type postgres from "postgres";

/** The agent named as publisher of the fixtures (never the first reviewer: there is none). */
const FIXTURE_PUBLISHER = accountIdOf("agent", "b");

export async function publishAsInflux(
  sql: postgres.Sql | postgres.TransactionSql,
  campaignId: string,
  status: "published" | "paused" = "published",
): Promise<void> {
  const rows = await sql<{ id: string }[]>`
    with entry as (
      insert into campaigns.campaign_review_entries
        (campaign_id, advertiser_account_id, state, decided_by_account_id, decided_at, closed_at)
      select c.id, c.advertiser_account_id, 'published', ${FIXTURE_PUBLISHER}::uuid, now(), now()
        from campaigns.campaigns c
       where c.id = ${campaignId}::uuid
      returning id, campaign_id),
    snapshot as (
      insert into campaigns.campaign_published_snapshots
        (campaign_id, version, payload, content_hash, published_at, published_by_account_id,
         review_entry_id)
      select e.campaign_id,
             coalesce((select max(s.version) from campaigns.campaign_published_snapshots s
                        where s.campaign_id = e.campaign_id), 0) + 1,
             '{}'::jsonb, sha256(convert_to('{}', 'UTF8')), now(), ${FIXTURE_PUBLISHER}::uuid, e.id
        from entry e
      returning id, campaign_id)
    update campaigns.campaigns c
       set status = ${status}::campaigns.campaign_status,
           current_snapshot_id = s.id,
           first_published_at = coalesce(c.first_published_at, now())
      from snapshot s
     where c.id = s.campaign_id
    returning c.id::text as id`;
  if (rows.length !== 1)
    throw new Error(`campaign ${campaignId} not published`);
}
