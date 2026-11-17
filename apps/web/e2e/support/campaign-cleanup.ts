// The campaigns the journeys of L3C wrote leave the local stack after their file (jalons/l3c annexe § Revue,
// L3CT-1): otherwise every run adds its campaigns and their open entries of queue 7 to the shared stack, which
// the lists and the sweeps of later runs then read. Written after apps/api's own kit
// (db-tests/campaign-routes-kit.ts, close()): one transaction of the migration role (loopback only,
// @influx/test-kit/db), no trigger disabled (theirs let a role outside `influx_%` through), the register
// (`audit.*`) untouched, the accounts and the agents kept. The scope is the brands a journey of this run created
// and recorded here, never a pattern: no statement without its list of identifiers.
import { connectAsMigrationRole } from "@influx/test-kit/db";

/** The brands created by the journeys of this worker, whose campaigns `removeOwnCampaigns` deletes. */
const brands = new Set<string>();

/** A brand a journey just created: its campaigns, entries and lines go after the file. */
export function ownBrand(accountId: string): void {
  brands.add(accountId);
}

/** The nine child tables of a campaign (0303). */
const CHILD_TABLES = [
  "campaign_key_messages",
  "campaign_deliverables",
  "campaign_usage_territories",
  "campaign_audience_countries",
  "campaign_audience_languages",
  "campaign_audience_bands",
  "campaign_audience_age_bands",
  "campaign_topics",
  "campaign_requested_items",
] as const;

/**
 * After the journeys of a file: the campaigns of its brands, then their outbox lines (decisions, leads). The
 * order is the foreign keys': child rows, the snapshot pointer (the campaign back to draft, as the kit does),
 * the snapshots, the agent interventions, the entries of queue 7, the campaigns, the outbox lines no send
 * refers to.
 */
export async function removeOwnCampaigns(): Promise<void> {
  const ids = [...brands];
  if (ids.length === 0) {
    return;
  }
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    await sql.begin(async (tx) => {
      for (const table of CHILD_TABLES) {
        await tx`
          delete from campaigns.${tx(table)}
           where campaign_id in (select id from campaigns.campaigns
                                  where advertiser_account_id = any(${ids}::uuid[]))`;
      }
      await tx`
        update campaigns.campaigns set status = 'draft', current_snapshot_id = null
         where advertiser_account_id = any(${ids}::uuid[]) and current_snapshot_id is not null`;
      await tx`
        delete from campaigns.campaign_published_snapshots
         where campaign_id in (select id from campaigns.campaigns
                                where advertiser_account_id = any(${ids}::uuid[]))`;
      await tx`
        delete from campaigns.agent_interventions
         where advertiser_account_id = any(${ids}::uuid[])`;
      await tx`
        delete from campaigns.campaign_review_entries
         where advertiser_account_id = any(${ids}::uuid[])`;
      await tx`
        delete from campaigns.campaigns
         where advertiser_account_id = any(${ids}::uuid[])`;
      await tx`
        delete from leads.outbox_events o
         where o.subject_key = any(${ids.map((id) => `account:${id}`)}::text[])
           and not exists (select 1 from leads.transactional_sends s
                            where s.outbox_event_id = o.id)`;
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
  brands.clear();
}
