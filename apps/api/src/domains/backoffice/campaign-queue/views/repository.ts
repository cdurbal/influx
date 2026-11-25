// Database access of the decision view of queue 7 and of the record of a campaign (docs/mvp/09 RG1 to RG9,
// RG85, RG87, RG90, RG94, RG95; 15 C1, C2, RG35; 17b §3.8; jalons/l3c/modele.md §1, §2, §6, §9; migrations
// 0307 to 0309), under influx_agent or influx_admin in aal2. Parameterised queries only (S-1).
// - Read AFTER the opening (acts/repository.ts), in the same transaction: the opening computed the token
//   from the campaign as it stood, so what the agent sees is never older than the version the token stands
//   for; a write that slipped in between makes the decision stale (55000), never blind.
// - What the agent reads is what the grants of 0307 to 0309 give him: never the opinion nor the internal
//   comment of an entry, never the comment of an intervention (no right on those columns), never the
//   suspended range (D78). On top, THIS file serves the budget as the KEY of its band label and never the
//   total, the product value nor the currency (fiche invariant 12), and the old and new value of a
//   correction of those fields never (CAMPAIGN_UNSERVED_VALUE_FIELDS).
import {
  CAMPAIGN_UNSERVED_VALUE_FIELDS,
  type CampaignFields,
  type CampaignRejectionReasonCode,
  type CampaignRecordResponse,
} from "@influx/contracts/campaign-review";
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";
import { arrayLiteral, ISO_UTC } from "../../sql-formats.ts";

type Instant = string | null;
export type NamedRef = { accountId: string; displayName: string | null };

function refOf(id: string | null, name: string | null): NamedRef | null {
  return id === null ? null : { accountId: id, displayName: name };
}

const CIVIL_DATE = "YYYY-MM-DD";

// ---------------------------------------------------------------------------------------------
// The entry of queue 7: its lock, its deadlines, its decision, its review state
// ---------------------------------------------------------------------------------------------

export type CampaignEntryView = {
  asOf: string;
  id: string;
  campaignId: string;
  advertiserAccountId: string;
  state: "open" | "published" | "rejected" | "withdrawn";
  createdAt: string;
  slaDueAt: string;
  escalateAt: Instant;
  overdue: boolean;
  held: boolean;
  holder: NamedRef | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
  forcedRelease: {
    releasedAt: string;
    releasedBy: NamedRef | null;
    holder: NamedRef | null;
    reasonCode: string;
  } | null;
  decision: {
    decidedAt: string;
    decidedBy: NamedRef | null;
    late: boolean;
    rejectionReasonCode: CampaignRejectionReasonCode | null;
    memberMessage: string | null;
  } | null;
  enhancedReview: boolean;
  firstReviewer: NamedRef | null;
  firstReviewedAt: Instant;
  duplicateOfCampaignId: string | null;
};

type EntryViewRow = {
  as_of: string;
  id: string;
  campaign_id: string;
  advertiser_account_id: string;
  state: CampaignEntryView["state"];
  created_at: string;
  sla_due_at: string;
  escalate_at: Instant;
  overdue: boolean;
  held: boolean;
  claimed_by: string | null;
  holder_name: string | null;
  claimed_at: Instant;
  claim_expires_at: Instant;
  forced_release_at: Instant;
  forced_by: string | null;
  forced_by_name: string | null;
  forced_holder: string | null;
  forced_holder_name: string | null;
  forced_reason: string | null;
  decided_at: Instant;
  decided_by: string | null;
  decided_by_name: string | null;
  sla_breached: boolean;
  rejection_reason_code: CampaignRejectionReasonCode | null;
  member_message: string | null;
  enhanced: boolean;
  first_by: string | null;
  first_by_name: string | null;
  first_at: Instant;
  duplicate_of: string | null;
};

/** The entry, read in ONE statement (one snapshot). Never the opinion nor the internal comment (no grant). */
export async function readCampaignEntryView(
  tx: Transaction,
  entryId: string,
): Promise<CampaignEntryView | null> {
  const rows = await tx.execute<EntryViewRow>(sql`
    select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of,
           e.id::text as id, e.campaign_id::text as campaign_id,
           e.advertiser_account_id::text as advertiser_account_id, e.state::text as state,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.state = 'open' and e.sla_due_at < now()) as overdue,
           (e.state = 'open' and e.claimed_by_account_id is not null
              and e.claim_expires_at > now()) as held,
           e.claimed_by_account_id::text as claimed_by, h.display_name as holder_name,
           to_char(e.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(e.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           to_char(e.forced_release_at at time zone 'UTC', ${ISO_UTC}) as forced_release_at,
           e.forced_release_by_account_id::text as forced_by, fb.display_name as forced_by_name,
           e.forced_release_holder_account_id::text as forced_holder,
           fh.display_name as forced_holder_name, e.forced_release_reason_code as forced_reason,
           to_char(e.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           e.decided_by_account_id::text as decided_by, db.display_name as decided_by_name,
           e.sla_breached, e.rejection_reason_code, e.member_message,
           coalesce(s.is_sensitive, false) as enhanced,
           e.first_reviewed_by_account_id::text as first_by, fr.display_name as first_by_name,
           to_char(e.first_reviewed_at at time zone 'UTC', ${ISO_UTC}) as first_at,
           e.duplicate_of_campaign_id::text as duplicate_of
      from campaigns.campaign_review_entries e
      join campaigns.campaigns c on c.id = e.campaign_id
      left join reference.sectors s on s.code = c.sector_code
      left join identity.accounts h on h.id = e.claimed_by_account_id
      left join identity.accounts fb on fb.id = e.forced_release_by_account_id
      left join identity.accounts fh on fh.id = e.forced_release_holder_account_id
      left join identity.accounts db on db.id = e.decided_by_account_id
      left join identity.accounts fr on fr.id = e.first_reviewed_by_account_id
     where e.id = ${entryId}::uuid`);
  const r = rows[0];
  if (r === undefined) {
    return null;
  }
  return {
    asOf: r.as_of,
    id: r.id,
    campaignId: r.campaign_id,
    advertiserAccountId: r.advertiser_account_id,
    state: r.state,
    createdAt: r.created_at,
    slaDueAt: r.sla_due_at,
    escalateAt: r.escalate_at,
    overdue: r.overdue,
    held: r.held,
    holder: r.held ? refOf(r.claimed_by, r.holder_name) : null,
    claimedAt: r.held ? r.claimed_at : null,
    claimExpiresAt: r.held ? r.claim_expires_at : null,
    forcedRelease:
      r.forced_release_at === null || r.forced_reason === null
        ? null
        : {
            releasedAt: r.forced_release_at,
            releasedBy: refOf(r.forced_by, r.forced_by_name),
            holder: refOf(r.forced_holder, r.forced_holder_name),
            reasonCode: r.forced_reason,
          },
    decision:
      r.decided_at === null
        ? null
        : {
            decidedAt: r.decided_at,
            decidedBy: refOf(r.decided_by, r.decided_by_name),
            late: r.sla_breached,
            rejectionReasonCode: r.rejection_reason_code,
            memberMessage: r.member_message,
          },
    enhancedReview: r.enhanced,
    firstReviewer: refOf(r.first_by, r.first_by_name),
    firstReviewedAt: r.first_at,
    duplicateOfCampaignId: r.duplicate_of,
  };
}

// ---------------------------------------------------------------------------------------------
// The campaign: its fields, its cycle
// ---------------------------------------------------------------------------------------------

export type CampaignView = {
  fields: CampaignFields;
  status: CampaignRecordResponse["cycle"]["status"];
  cycle: CampaignRecordResponse["cycle"];
  advertiserAccountId: string;
};

type CampaignRow = {
  advertiser_account_id: string;
  status: CampaignView["status"];
  title: string | null;
  campaign_type_code: string | null;
  public_summary: string | null;
  brief: string | null;
  internal_reference: string | null;
  product_description: string | null;
  sector_code: string | null;
  sector_is_sensitive: boolean;
  restrictions: string | null;
  product_is_sent: boolean | null;
  creator_keeps_product: boolean | null;
  shipping_costs_borne_by: string | null;
  usage_rights_code: string | null;
  usage_rights_duration_band: string | null;
  usage_rights_territory_scope: string | null;
  exclusivity_band: string | null;
  content_review_delay: string | null;
  content_due_on: string | null;
  audience_gender_code: string | null;
  remuneration_kind: string | null;
  budget_band_label_key: string | null;
  creators_wanted: number | null;
  applications_close_on: string | null;
  starts_on: string | null;
  ends_on: string | null;
  max_applications: number | null;
  submitted_at: Instant;
  created_at: string;
  updated_at: string;
  first_published_at: Instant;
  paused_at: Instant;
  pause_origin: "brand" | "influx" | null;
  closed_at: Instant;
  owner_id: string | null;
  owner_name: string | null;
  snapshot_version: number | null;
  key_messages: string[];
  deliverables: CampaignFields["deliverables"];
  usage_territories: string[];
  audience_countries: string[];
  audience_languages: string[];
  audience_bands: string[];
  audience_age_bands: string[];
  audience_topics: string[];
  requested_items: string[];
};

/** A list of one child table as JSON, in its order: the pool fetches no array type. */
function listOf(table: string, column: string, order: string) {
  return sql`coalesce((select jsonb_agg(l.${sql.identifier(column)}::text order by l.${sql.identifier(order)})
                         from campaigns.${sql.identifier(table)} l
                        where l.campaign_id = c.id), '[]'::jsonb)`;
}

/**
 * The campaign as the agent reads it: the fields of the nine blocks, the cycle, the responsible, the
 * version of the snapshot. Null for an unknown campaign or the one of the caller's own account (hidden by
 * the policy of 0308).
 */
export async function readCampaignView(
  tx: Transaction,
  campaignId: string,
): Promise<CampaignView | null> {
  const rows = await tx.execute<CampaignRow>(sql`
    select c.advertiser_account_id::text as advertiser_account_id, c.status::text as status,
           c.title, c.campaign_type_code, c.public_summary, c.brief, c.internal_reference,
           c.product_description, c.sector_code,
           coalesce((select s.is_sensitive from reference.sectors s
                      where s.code = c.sector_code), false) as sector_is_sensitive,
           c.restrictions, c.product_is_sent, c.creator_keeps_product, c.shipping_costs_borne_by,
           c.usage_rights_code, c.usage_rights_duration_band, c.usage_rights_territory_scope,
           c.exclusivity_band, c.content_review_delay,
           to_char(c.content_due_on, ${CIVIL_DATE}) as content_due_on,
           c.audience_gender_code, c.remuneration_kind::text as remuneration_kind,
           case when c.per_creator_budget_band_code is null then null
                else 'price_band.' || c.per_creator_budget_band_code end as budget_band_label_key,
           c.creators_wanted,
           to_char(c.applications_close_on, ${CIVIL_DATE}) as applications_close_on,
           to_char(c.starts_on, ${CIVIL_DATE}) as starts_on,
           to_char(c.ends_on, ${CIVIL_DATE}) as ends_on,
           c.max_applications,
           to_char(c.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           to_char(c.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(c.updated_at at time zone 'UTC', ${ISO_UTC}) as updated_at,
           to_char(c.first_published_at at time zone 'UTC', ${ISO_UTC}) as first_published_at,
           to_char(c.paused_at at time zone 'UTC', ${ISO_UTC}) as paused_at,
           c.pause_origin::text as pause_origin,
           to_char(c.closed_at at time zone 'UTC', ${ISO_UTC}) as closed_at,
           c.owner_agent_id::text as owner_id, ow.display_name as owner_name,
           (select v.version from campaigns.campaign_published_snapshots v
             where v.id = c.current_snapshot_id) as snapshot_version,
           ${listOf("campaign_key_messages", "body", "position")} as key_messages,
           coalesce((select jsonb_agg(jsonb_build_object(
                              'networkCode', d.network_code, 'formatCode', d.format_code,
                              'quantity', d.quantity) order by d.slot)
                       from campaigns.campaign_deliverables d
                      where d.campaign_id = c.id), '[]'::jsonb) as deliverables,
           ${listOf("campaign_usage_territories", "country_code", "slot")} as usage_territories,
           ${listOf("campaign_audience_countries", "country_code", "slot")} as audience_countries,
           ${listOf("campaign_audience_languages", "language_code", "language_code")} as audience_languages,
           ${listOf("campaign_audience_bands", "audience_band_code", "audience_band_code")} as audience_bands,
           ${listOf("campaign_audience_age_bands", "age_band_code", "age_band_code")} as audience_age_bands,
           ${listOf("campaign_topics", "topic_code", "slot")} as audience_topics,
           ${listOf("campaign_requested_items", "item_code", "slot")} as requested_items
      from campaigns.campaigns c
      left join identity.accounts ow on ow.id = c.owner_agent_id
     where c.id = ${campaignId}::uuid`);
  const r = rows[0];
  if (r === undefined) {
    return null;
  }
  return {
    advertiserAccountId: r.advertiser_account_id,
    status: r.status,
    cycle: {
      status: r.status,
      submittedAt: r.submitted_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      firstPublishedAt: r.first_published_at,
      pausedAt: r.paused_at,
      pauseOrigin: r.pause_origin,
      closedAt: r.closed_at,
      owner: refOf(r.owner_id, r.owner_name),
      snapshotVersion: r.snapshot_version,
    },
    fields: {
      title: r.title,
      campaignType: r.campaign_type_code,
      publicSummary: r.public_summary,
      brief: r.brief,
      internalReference: r.internal_reference,
      productDescription: r.product_description,
      productSector: r.sector_code,
      sectorIsSensitive: r.sector_is_sensitive === true,
      restrictions: r.restrictions,
      keyMessages: r.key_messages,
      productIsSent: r.product_is_sent,
      creatorKeepsProduct: r.creator_keeps_product,
      shippingCostsBorneBy:
        r.shipping_costs_borne_by as CampaignFields["shippingCostsBorneBy"],
      deliverables: r.deliverables,
      usageRights: r.usage_rights_code,
      usageRightsDuration:
        r.usage_rights_duration_band as CampaignFields["usageRightsDuration"],
      usageRightsTerritoryScope:
        r.usage_rights_territory_scope as CampaignFields["usageRightsTerritoryScope"],
      usageRightsTerritories:
        r.usage_territories as CampaignFields["usageRightsTerritories"],
      exclusivity: r.exclusivity_band as CampaignFields["exclusivity"],
      contentReviewDelay:
        r.content_review_delay as CampaignFields["contentReviewDelay"],
      contentDueOn: r.content_due_on,
      audienceGender: r.audience_gender_code,
      audienceCountries:
        r.audience_countries as CampaignFields["audienceCountries"],
      audienceLanguages: r.audience_languages,
      audienceBands: r.audience_bands,
      audienceAgeBands: r.audience_age_bands,
      audienceTopics: r.audience_topics,
      remunerationKind:
        r.remuneration_kind as CampaignFields["remunerationKind"],
      budgetBandLabelKey: r.budget_band_label_key,
      creatorsWanted: r.creators_wanted,
      applicationsCloseOn: r.applications_close_on,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      maxApplications: r.max_applications,
      requestedItems: r.requested_items,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The brand, the duplicate, the reasons, the responsibles
// ---------------------------------------------------------------------------------------------

export type CampaignBrandRow = {
  accountId: string;
  name: string | null;
  countryCode: string;
  preferredLanguage: "fr" | "en";
  owner: NamedRef | null;
  verified: boolean;
  publishedCount: number;
};

/** The brand of a campaign: its public name, its holder, its badge, how many campaigns it published (17b §3.8). */
export async function readCampaignBrand(
  tx: Transaction,
  accountId: string,
): Promise<CampaignBrandRow | null> {
  const rows = await tx.execute<{
    name: string | null;
    country_code: string;
    preferred_language: "fr" | "en";
    owner_id: string | null;
    owner_name: string | null;
    verified: boolean;
    published_count: number;
  }>(sql`
    select p.legal_name as name, a.country_code::text as country_code,
           a.preferred_language::text as preferred_language,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           exists (select 1 from verification.badges b
                    where b.account_id = a.id and b.state in ('active', 'to_refresh')
                      and b.level = 'brand_verified') as verified,
           (select count(*)::int from campaigns.campaigns c
             where c.advertiser_account_id = a.id
               and c.first_published_at is not null) as published_count
      from identity.accounts a
      join profiles.advertiser_profiles p on p.account_id = a.id
      left join identity.accounts o on o.id = a.owner_agent_id
     where a.id = ${accountId}::uuid`);
  const r = rows[0];
  return r === undefined
    ? null
    : {
        accountId,
        name: r.name,
        countryCode: r.country_code,
        preferredLanguage: r.preferred_language,
        owner: refOf(r.owner_id, r.owner_name),
        verified: r.verified,
        publishedCount: r.published_count,
      };
}

/** RG95: the campaign a duplicate alert points at, written once by the door of the submission. */
export async function readDuplicateOf(
  tx: Transaction,
  duplicateCampaignId: string,
): Promise<{
  campaignId: string;
  title: string | null;
  status: string;
} | null> {
  const rows = await tx.execute<{
    title: string | null;
    status: string;
  }>(sql`
    select c.title, c.status::text as status
      from campaigns.campaigns c where c.id = ${duplicateCampaignId}::uuid`);
  const r = rows[0];
  return r === undefined
    ? null
    : { campaignId: duplicateCampaignId, title: r.title, status: r.status };
}

/** The duplicate alert of a campaign: the latest entry that wrote one (never recomputed, modele -2). */
export async function readLatestDuplicateId(
  tx: Transaction,
  campaignId: string,
): Promise<string | null> {
  const rows = await tx.execute<{ duplicate_of: string | null }>(sql`
    select e.duplicate_of_campaign_id::text as duplicate_of
      from campaigns.campaign_review_entries e
     where e.campaign_id = ${campaignId}::uuid
     order by e.created_at desc, e.id desc
     limit 1`);
  return rows[0]?.duplicate_of ?? null;
}

export type RejectionReasonRow = {
  code: string;
  position: number;
  requiresMemberMessage: boolean;
};

/** The active refusal reasons of RG90, in their order. */
export async function readCampaignRejectionReasons(
  tx: Transaction,
): Promise<RejectionReasonRow[]> {
  const rows = await tx.execute<{
    code: string;
    position: number;
    requires_member_message: boolean;
  }>(sql`
    select code, position::int as position, requires_member_message
      from campaigns.rejection_reasons
     where is_active
     order by position`);
  return rows.map((row) => ({
    code: row.code,
    position: row.position,
    requiresMemberMessage: row.requires_member_message,
  }));
}

/** The internal accounts a campaign may be given to at its publication (RG6, CA63): active agents and admins. */
export async function readResponsibles(tx: Transaction): Promise<NamedRef[]> {
  const rows = await tx.execute<{
    id: string;
    display_name: string | null;
  }>(sql`
    select a.id::text as id, a.display_name
      from identity.accounts a
     where a.status = 'active'
       and exists (select 1 from identity.agent_profiles p
                    where p.account_id = a.id and p.is_active)
       and exists (select 1 from identity.account_roles r
                    where r.account_id = a.id and r.role::text in ('agent', 'admin'))
     order by a.display_name nulls last, a.id`);
  return rows.map((row) => ({
    accountId: row.id,
    displayName: row.display_name,
  }));
}

// ---------------------------------------------------------------------------------------------
// The history of the record: the entries and the interventions
// ---------------------------------------------------------------------------------------------

export type EntryHistoryRow = {
  id: string;
  state: "open" | "published" | "rejected" | "withdrawn";
  createdAt: string;
  closedAt: Instant;
  decision: CampaignEntryView["decision"];
  firstReviewedBy: NamedRef | null;
  firstReviewedAt: Instant;
};

/** The examinations of a campaign, the latest first (the record of 17b): no opinion, no comment (no grant). */
export async function readCampaignEntryHistory(
  tx: Transaction,
  campaignId: string,
): Promise<EntryHistoryRow[]> {
  const rows = await tx.execute<{
    id: string;
    state: EntryHistoryRow["state"];
    created_at: string;
    closed_at: Instant;
    decided_at: Instant;
    decided_by: string | null;
    decided_by_name: string | null;
    sla_breached: boolean;
    rejection_reason_code: CampaignRejectionReasonCode | null;
    member_message: string | null;
    first_by: string | null;
    first_by_name: string | null;
    first_at: Instant;
  }>(sql`
    select e.id::text as id, e.state::text as state,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(e.closed_at at time zone 'UTC', ${ISO_UTC}) as closed_at,
           to_char(e.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           e.decided_by_account_id::text as decided_by, db.display_name as decided_by_name,
           e.sla_breached, e.rejection_reason_code, e.member_message,
           e.first_reviewed_by_account_id::text as first_by, fr.display_name as first_by_name,
           to_char(e.first_reviewed_at at time zone 'UTC', ${ISO_UTC}) as first_at
      from campaigns.campaign_review_entries e
      left join identity.accounts db on db.id = e.decided_by_account_id
      left join identity.accounts fr on fr.id = e.first_reviewed_by_account_id
     where e.campaign_id = ${campaignId}::uuid
     order by e.created_at desc, e.id desc
     limit 50`);
  return rows.map((r) => ({
    id: r.id,
    state: r.state,
    createdAt: r.created_at,
    closedAt: r.closed_at,
    decision:
      r.decided_at === null
        ? null
        : {
            decidedAt: r.decided_at,
            decidedBy: refOf(r.decided_by, r.decided_by_name),
            late: r.sla_breached,
            rejectionReasonCode: r.rejection_reason_code,
            memberMessage: r.member_message,
          },
    firstReviewedBy: refOf(r.first_by, r.first_by_name),
    firstReviewedAt: r.first_at,
  }));
}

export type InterventionRow = CampaignRecordResponse["interventions"][number];

/**
 * The acts of the agents on a campaign, the latest first (RG94). The comment is not read (no grant); the
 * values of a figure, a band or the currency are never read either (`CAMPAIGN_UNSERVED_VALUE_FIELDS`).
 */
export async function readCampaignInterventions(
  tx: Transaction,
  campaignId: string,
): Promise<InterventionRow[]> {
  const unserved = arrayLiteral(CAMPAIGN_UNSERVED_VALUE_FIELDS);
  const rows = await tx.execute<{
    id: string;
    kind: InterventionRow["kind"];
    field_code: InterventionRow["fieldCode"];
    old_value: string | null;
    new_value: string | null;
    reason_code: InterventionRow["reasonCode"];
    agent_id: string | null;
    agent_name: string | null;
    created_at: string;
  }>(sql`
    select i.id::text as id, i.kind::text as kind, i.field_code,
           case when i.field_code = any(${unserved}::text[]) then null
                else i.old_value::text end as old_value,
           case when i.field_code = any(${unserved}::text[]) then null
                else i.new_value::text end as new_value,
           i.reason_code, i.agent_account_id::text as agent_id, a.display_name as agent_name,
           to_char(i.created_at at time zone 'UTC', ${ISO_UTC}) as created_at
      from campaigns.agent_interventions i
      left join identity.accounts a on a.id = i.agent_account_id
     where i.campaign_id = ${campaignId}::uuid
     order by i.created_at desc, i.id desc
     limit 100`);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    fieldCode: r.field_code,
    oldValueJson: r.old_value,
    newValueJson: r.new_value,
    reasonCode: r.reason_code,
    agent: refOf(r.agent_id, r.agent_name),
    createdAt: r.created_at,
  }));
}
