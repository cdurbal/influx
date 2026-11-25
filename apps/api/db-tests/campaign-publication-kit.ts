// A campaign put in the published (or paused) state as INFLUX would, for the fixtures of the campaign
// tests (0308, L3C-03). From 0308 a published or paused campaign carries its snapshot
// (campaigns_published_needs_review): this writes, as the connection given (the migration role or the
// local superuser, outside the freeze), a published entry of queue 7, a snapshot naming it and the
// state, in ONE statement. The snapshot holds the real creator view, campaign_creator_view(), and its
// SHA-256 as publish_campaign_review_entry() writes them (0308), never an empty object: the creator's
// feed (L3D) reads every published campaign through a strict contract. The real publication is
// publish_campaign_review_entry() (L3C-T3).
import { accountIdOf } from "@influx/test-kit/db";
import type postgres from "postgres";
import { campaignCalendar } from "./campaign-dates-kit.ts";

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
    shown as (
      select e.id, e.campaign_id, campaigns.campaign_creator_view(e.campaign_id) as payload
        from entry e),
    snapshot as (
      insert into campaigns.campaign_published_snapshots
        (campaign_id, version, payload, content_hash, published_at, published_by_account_id,
         review_entry_id)
      select e.campaign_id,
             coalesce((select max(s.version) from campaigns.campaign_published_snapshots s
                        where s.campaign_id = e.campaign_id), 0) + 1,
             e.payload, sha256(convert_to(e.payload::text, 'UTF8')), now(), ${FIXTURE_PUBLISHER}::uuid,
             e.id
        from shown e
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

/** The states of a campaign, from its creation in draft. */
export type CampaignState =
  "draft" | "pending_review" | "published" | "paused" | "closed" | "rejected";

/**
 * Puts a campaign created in draft in `state`, as the connection given (the local superuser or the
 * migration role, outside the guards): the fields a submission requires filled where empty (its sector
 * kept), then the state; published and paused through publishAsInflux(), closed after a publication.
 * The creator search admits a campaign of origin out of draft and rejected only (0322, L3ES-1).
 */
export async function putCampaignInState(
  sql: postgres.Sql | postgres.TransactionSql,
  campaignId: string,
  state: CampaignState,
): Promise<void> {
  if (state === "draft") return;
  const calendar = campaignCalendar();
  await sql`
    update campaigns.campaigns
       set title = coalesce(title, 'L3F campaign of origin'),
           campaign_type_code = coalesce(campaign_type_code, 'product_placement'),
           public_summary = coalesce(public_summary, ${"s".repeat(130)}),
           brief = coalesce(brief, ${"b".repeat(310)}),
           product_description = coalesce(product_description, 'L3F product description'),
           sector_code = coalesce(sector_code, 'sports_leisure'),
           product_is_sent = coalesce(product_is_sent, false),
           usage_rights_code = coalesce(usage_rights_code, 'organic_repost'),
           usage_rights_duration_band = coalesce(usage_rights_duration_band, '3m'),
           usage_rights_territory_scope = coalesce(usage_rights_territory_scope, 'worldwide'),
           exclusivity_band = coalesce(exclusivity_band, 'none'),
           content_review_delay = coalesce(content_review_delay, '5bd'),
           currency = coalesce(currency, 'EUR'),
           remuneration_kind = coalesce(remuneration_kind, 'cash'),
           per_creator_budget_band_code = coalesce(per_creator_budget_band_code, '500_1000'),
           creators_wanted = coalesce(creators_wanted, 3),
           applications_close_on = coalesce(applications_close_on,
                                            ${calendar.applicationsCloseOn}::date),
           content_due_on = coalesce(content_due_on, ${calendar.contentDueOn}::date),
           starts_on = coalesce(starts_on, ${calendar.startsOn}::date),
           ends_on = coalesce(ends_on, ${calendar.endsOn}::date),
           submitted_at = coalesce(submitted_at, now()),
           status = ${state === "rejected" ? "rejected" : "pending_review"}::campaigns.campaign_status
     where id = ${campaignId}::uuid`;
  if (state === "published" || state === "paused" || state === "closed") {
    await publishAsInflux(
      sql,
      campaignId,
      state === "paused" ? "paused" : "published",
    );
  }
  if (state === "closed") {
    await sql`update campaigns.campaigns set status = 'closed' where id = ${campaignId}::uuid`;
  }
}
