// The acts on an entry of queue 7 and on a campaign, as database calls (docs/mvp/09 RG5, RG8, RG9, RG85, RG89,
// RG90, RG93, RG94; 15 RG27 C1 to C4, C6, C8, RG35; jalons/l3c/modele.md §1, §3 to §6; migrations 0307 to
// 0309), under influx_agent or influx_admin in aal2. Parameterised queries only (S-1).
// - Every write is a database function (SECURITY DEFINER, owned by influx_campaign_review_definer): open
//   (= claim), release, extend, force release, first review, publish, reject (queue 7), and pause, resume,
//   close, create for a brand, correct a field, open the record (the campaign). Each locks what it decides,
//   checks the live claim of the caller, the token and the rules, and writes the decision, the register,
//   the e-mail and the leads events in ONE transaction. Nothing here updates a table (RG5: only a human
//   decision publishes).
// - A jsonb parameter goes as text, then cast (`$n::text::jsonb`): the driver types nothing.
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";
import { ISO_UTC } from "../../sql-formats.ts";

export type Decided = { decidedAt: string; late: boolean };

export type CampaignOpeningRow = {
  outcome: "claimed" | "held" | "read_only" | "closed";
  reviewToken: string | null;
  /** The opinion of the first examiner: given by the database to the holder of a live claim only. */
  firstOpinion: string | null;
};

/**
 * 15 C1, C2: opening is taking. The database decides in one conditional UPDATE and journals the opening
 * (`queue.entry_opened`, with the queue code). 42501 for an unknown entry, one of the caller's own
 * account, an open one of an account he holds, or one whose first examination he gave.
 */
export async function openCampaignEntry(
  tx: Transaction,
  entryId: string,
): Promise<CampaignOpeningRow> {
  const rows = await tx.execute<{
    outcome: CampaignOpeningRow["outcome"];
    review_token: string | null;
    first_review_opinion: string | null;
  }>(sql`
    select outcome, review_token, first_review_opinion
      from campaigns.open_campaign_review_entry(${entryId}::uuid)`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("the opening of the campaign queue returned no row");
  }
  return {
    outcome: row.outcome,
    reviewToken: row.review_token,
    firstOpinion: row.first_review_opinion,
  };
}

/** 15 C3: the holder gives the entry back to the queue. */
export async function releaseCampaignEntry(
  tx: Transaction,
  entryId: string,
): Promise<void> {
  await tx.execute(
    sql`select campaigns.release_campaign_review_entry(${entryId}::uuid)`,
  );
}

/** File.md A9: the holder of a live claim takes the delay again; the new expiry. */
export async function extendCampaignClaim(
  tx: Transaction,
  entryId: string,
): Promise<string> {
  const rows = await tx.execute<{ expires_at: string }>(sql`
    select to_char(campaigns.extend_campaign_review_claim(${entryId}::uuid)
                     at time zone 'UTC', ${ISO_UTC}) as expires_at`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("the extension of the campaign queue returned no row");
  }
  return row.expires_at;
}

/** 15 C4, an administrator: lifts a live claim with a typed reason; returns the dispossessed holder. */
export async function forceReleaseCampaignClaim(
  tx: Transaction,
  entryId: string,
  reasonCode: string,
): Promise<string | null> {
  const rows = await tx.execute<{ holder: string | null }>(sql`
    select campaigns.force_release_campaign_review_claim(
             ${entryId}::uuid, ${reasonCode})::text as holder`);
  return rows[0]?.holder ?? null;
}

/** 09 RG85, modele §3: the first examination of an enhanced review, a reasoned favourable opinion. */
export async function firstReviewCampaignEntry(
  tx: Transaction,
  entryId: string,
  reviewToken: string,
  opinion: string,
): Promise<{ firstReviewedAt: string }> {
  const rows = await tx.execute<{ first_reviewed_at: string }>(sql`
    select to_char(campaigns.first_review_campaign_entry(
                     ${entryId}::uuid, ${reviewToken}, ${opinion}) at time zone 'UTC',
                   ${ISO_UTC}) as first_reviewed_at`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("campaigns.first_review_campaign_entry() returned no row");
  }
  return { firstReviewedAt: row.first_reviewed_at };
}

type DecidedRow = { decided_at: string; sla_breached: boolean };

function decidedOf(rows: readonly DecidedRow[], door: string): Decided {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${door}() returned no row`);
  }
  return { decidedAt: row.decided_at, late: row.sla_breached };
}

/** 09 RG5: the publication of a campaign, a responsible named (RG6). `firstPublication`: `campaign.published` (RG103). */
export async function publishCampaignEntry(
  tx: Transaction,
  entryId: string,
  reviewToken: string,
  ownerAgentId: string,
  internalComment: string | null,
): Promise<Decided & { snapshotVersion: number; firstPublication: boolean }> {
  const rows = await tx.execute<
    DecidedRow & { snapshot_version: number; first_publication: boolean }
  >(sql`
    select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           sla_breached, snapshot_version, first_publication
      from campaigns.publish_campaign_review_entry(
             ${entryId}::uuid, ${reviewToken}, ${ownerAgentId}::uuid, ${internalComment})`);
  const decided = decidedOf(rows, "campaigns.publish_campaign_review_entry");
  const row = rows[0];
  return {
    ...decided,
    snapshotVersion: row?.snapshot_version ?? 0,
    firstPublication: row?.first_publication === true,
  };
}

/** 09 RG90: the refusal of a campaign, with its typed reason; the message of `illicit_content` and `other` is the agent's own. */
export async function rejectCampaignEntry(
  tx: Transaction,
  entryId: string,
  reviewToken: string,
  reasonCode: string,
  memberMessage: string | null,
  internalComment: string | null,
): Promise<Decided> {
  const rows = await tx.execute<DecidedRow>(sql`
    select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from campaigns.reject_campaign_review_entry(
             ${entryId}::uuid, ${reviewToken}, ${reasonCode}, ${memberMessage},
             ${internalComment})`);
  return decidedOf(rows, "campaigns.reject_campaign_review_entry");
}

// ---------------------------------------------------------------------------------------------
// The campaign: record, passages, creation, correction (modele §5, §6)
// ---------------------------------------------------------------------------------------------

/** modele §6: the record of a campaign is opened by this door, which journals the read (`campaign.record_read`). */
export async function openCampaignRecord(
  tx: Transaction,
  campaignId: string,
): Promise<void> {
  await tx.execute(
    sql`select campaigns.open_campaign_record(${campaignId}::uuid)`,
  );
}

export type PassageRow = { status: string; interventionId: string };

/** The three passages an agent makes with authority: each answers `(status, intervention_id)`. */
export async function passCampaign(
  tx: Transaction,
  passage: "pause" | "resume" | "close",
  campaignId: string,
  reasonCode: string,
  internalComment: string | null,
): Promise<PassageRow> {
  const call = {
    pause: sql`campaigns.pause_campaign`,
    resume: sql`campaigns.resume_campaign`,
    close: sql`campaigns.close_campaign`,
  }[passage];
  const rows = await tx.execute<{
    status: string;
    intervention_id: string;
  }>(sql`
    select status, intervention_id::text as intervention_id
      from ${call}(${campaignId}::uuid, ${reasonCode}, ${internalComment})`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`the ${passage} of a campaign returned no row`);
  }
  return { status: row.status, interventionId: row.intervention_id };
}

/** 09 RG1, RG94: a draft opened for a brand that called; the brand completes and submits it. */
export async function createCampaignForBrand(
  tx: Transaction,
  advertiserAccountId: string,
  title: string,
  campaignType: string,
): Promise<{ campaignId: string; interventionId: string }> {
  const rows = await tx.execute<{
    campaign_id: string;
    intervention_id: string;
  }>(sql`
    select campaign_id::text as campaign_id, intervention_id::text as intervention_id
      from campaigns.create_campaign_for_brand(
             ${advertiserAccountId}::uuid, ${title}, ${campaignType})`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("campaigns.create_campaign_for_brand() returned no row");
  }
  return { campaignId: row.campaign_id, interventionId: row.intervention_id };
}

/** 09 RG94: the correction of ONE field, ancienne and nouvelle valeur kept by the database. */
export async function correctCampaignField(
  tx: Transaction,
  campaignId: string,
  fieldCode: string,
  value: unknown,
  reasonCode: string,
  internalComment: string | null,
): Promise<{ interventionId: string; reviewToken: string | null }> {
  const rows = await tx.execute<{
    intervention_id: string;
    review_token: string | null;
  }>(sql`
    select intervention_id::text as intervention_id, review_token
      from campaigns.correct_campaign_field(
             ${campaignId}::uuid, ${fieldCode}, ${JSON.stringify(value)}::text::jsonb,
             ${reasonCode}, ${internalComment})`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("campaigns.correct_campaign_field() returned no row");
  }
  return { interventionId: row.intervention_id, reviewToken: row.review_token };
}
