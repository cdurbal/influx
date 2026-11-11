// Database access of the decision views of queues 2 and 3 (docs/mvp/07 RG9, RG93, RG94; 15 C1, C2,
// RG35; jalons/l2g/modele.md §1 points 1, 2, 6, 9, 10; migrations 0216 to 0218, 0242, 0243), under
// influx_agent or influx_admin in aal2. Parameterised queries only (S-1).
// - Read AFTER the opening (acts.ts), in the same transaction: the opening locked the storefront (queue
//   2) or every visual of the account (queue 3) before it rendered the token, so what the agent sees is
//   never older than the version the token stands for; a write that slipped in between makes the
//   decision stale (55000), never blind (l2c/file.md A3).
// - The layer I of the lines (handle, link, exact figures) is here because the agent moderates it; the
//   layer N (names, address, contact, birth) is NEVER read: no decision needs it (07 RG16). The bytes of
//   a visual are not read here either: a journaled door gives them, one visual at a time (acts.ts).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";
import { ISO_UTC } from "../../sql-formats.ts";

type Instant = string | null;
export type NamedRef = { accountId: string; displayName: string | null };

function refOf(id: string | null, name: string | null): NamedRef | null {
  return id === null ? null : { accountId: id, displayName: name };
}

/** The lock and the decision common to the two queues, as the repositories read them. */
type ClaimState = {
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
};

type ClaimColumns = {
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
};

function claimOf(row: ClaimColumns): ClaimState {
  return {
    held: row.held,
    holder: row.held ? refOf(row.claimed_by, row.holder_name) : null,
    claimedAt: row.held ? row.claimed_at : null,
    claimExpiresAt: row.held ? row.claim_expires_at : null,
    forcedRelease:
      row.forced_release_at === null || row.forced_reason === null
        ? null
        : {
            releasedAt: row.forced_release_at,
            releasedBy: refOf(row.forced_by, row.forced_by_name),
            holder: refOf(row.forced_holder, row.forced_holder_name),
            reasonCode: row.forced_reason,
          },
  };
}

// ---------------------------------------------------------------------------------------------
// Queue 2: the entry, its account, the storefront, the lines, the visuals, the revisions
// ---------------------------------------------------------------------------------------------

export type CreatorEntryView = {
  asOf: string;
  entry: ClaimState & {
    id: string;
    accountId: string;
    kind: "submission" | "revision";
    state: "open" | "published" | "rejected" | "withdrawn";
    createdAt: string;
    slaDueAt: string;
    escalateAt: Instant;
    overdue: boolean;
    decision: {
      decidedAt: string;
      decidedBy: NamedRef | null;
      late: boolean;
      rejectionReasonCode: string | null;
      memberMessage: string | null;
      internalComment: string | null;
    } | null;
  };
  account: {
    countryCode: string;
    preferredLanguage: "fr" | "en";
    owner: NamedRef | null;
  };
  profile: {
    alias: string;
    status: string;
    firstPublishedAt: Instant;
    completenessPercent: number | null;
    headline: string | null;
    bio: string | null;
    primaryTopic: string | null;
    residenceRegion: string | null;
    travelScope: string | null;
    collaborationExperience: string | null;
    deliveryLead: string | null;
    maxExclusivity: string | null;
    acceptsNonMonetary: boolean;
    availability: string | null;
    lists: {
      secondaryTopics: string[];
      tones: string[];
      publicationLanguages: string[];
      formats: string[];
      usageRights: { code: string; inclusion: string }[];
      refusedSectors: string[];
    };
  };
};

type CreatorEntryViewRow = ClaimColumns & {
  as_of: string;
  id: string;
  account_id: string;
  kind: CreatorEntryView["entry"]["kind"];
  state: CreatorEntryView["entry"]["state"];
  created_at: string;
  sla_due_at: string;
  escalate_at: Instant;
  overdue: boolean;
  decided_at: Instant;
  decided_by: string | null;
  decided_by_name: string | null;
  sla_breached: boolean;
  rejection_reason_code: string | null;
  member_message: string | null;
  internal_comment: string | null;
  country_code: string;
  preferred_language: "fr" | "en";
  owner_id: string | null;
  owner_name: string | null;
  alias: string;
  status: string;
  published_at: Instant;
  headline: string | null;
  bio: string | null;
  primary_topic_code: string | null;
  residence_region_code: string | null;
  travel_scope: string | null;
  collaboration_experience_band: string | null;
  delivery_lead_band: string | null;
  max_exclusivity_band: string | null;
  accepts_non_monetary: boolean;
  availability_band: string | null;
  completeness_percent: number | null;
  secondary_topics: string[];
  tones: string[];
  publication_languages: string[];
  formats: string[];
  usage_rights: { code: string; inclusion: string }[];
  refused_sectors: string[];
};

/**
 * The entry, its account and the live storefront, read in ONE statement (one snapshot). The names of
 * the person (layer N) are never selected.
 */
export async function readCreatorEntryView(
  tx: Transaction,
  entryId: string,
): Promise<CreatorEntryView | null> {
  const rows = await tx.execute<CreatorEntryViewRow>(sql`
    select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of,
           e.id::text as id, e.account_id::text as account_id, e.kind::text as kind,
           e.state::text as state,
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
           e.sla_breached, e.rejection_reason_code, e.member_message, e.internal_comment,
           a.country_code::text as country_code, a.preferred_language::text as preferred_language,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           p.alias, p.status::text as status,
           to_char(p.published_at at time zone 'UTC', ${ISO_UTC}) as published_at,
           p.headline, p.bio, p.primary_topic_code, p.residence_region_code, p.travel_scope,
           p.collaboration_experience_band, p.delivery_lead_band, p.max_exclusivity_band,
           p.accepts_non_monetary, p.availability_band, i.completeness_percent::int as completeness_percent,
           coalesce((select jsonb_agg(t.topic_code::text order by t.slot)
                       from profiles.creator_topics t where t.account_id = p.account_id),
                    '[]'::jsonb) as secondary_topics,
           coalesce((select jsonb_agg(t.tone_code::text order by t.slot)
                       from profiles.creator_tones t where t.account_id = p.account_id),
                    '[]'::jsonb) as tones,
           coalesce((select jsonb_agg(l.language_code::text order by l.slot)
                       from profiles.creator_publication_languages l
                      where l.account_id = p.account_id), '[]'::jsonb) as publication_languages,
           coalesce((select jsonb_agg(f.format_code::text order by f.format_code)
                       from profiles.creator_formats f where f.account_id = p.account_id),
                    '[]'::jsonb) as formats,
           coalesce((select jsonb_agg(jsonb_build_object('code', u.usage_right_code::text,
                                                         'inclusion', u.inclusion)
                                      order by u.usage_right_code)
                       from profiles.creator_usage_rights u where u.account_id = p.account_id),
                    '[]'::jsonb) as usage_rights,
           coalesce((select jsonb_agg(s.sector_code::text order by s.sector_code)
                       from profiles.creator_refused_sectors s where s.account_id = p.account_id),
                    '[]'::jsonb) as refused_sectors
      from profiles.creator_review_entries e
      join profiles.creator_public_profiles p on p.account_id = e.account_id
      join identity.accounts a on a.id = e.account_id
      left join profiles.creator_identities i on i.account_id = e.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
      left join identity.accounts fb on fb.id = e.forced_release_by_account_id
      left join identity.accounts fh on fh.id = e.forced_release_holder_account_id
      left join identity.accounts db on db.id = e.decided_by_account_id
     where e.id = ${entryId}::uuid`);
  const r = rows[0];
  if (r === undefined) {
    return null;
  }
  const claim = claimOf(r);
  return {
    asOf: r.as_of,
    entry: {
      ...claim,
      id: r.id,
      accountId: r.account_id,
      kind: r.kind,
      state: r.state,
      createdAt: r.created_at,
      slaDueAt: r.sla_due_at,
      escalateAt: r.escalate_at,
      overdue: r.overdue,
      decision:
        r.decided_at === null
          ? null
          : {
              decidedAt: r.decided_at,
              decidedBy: refOf(r.decided_by, r.decided_by_name),
              late: r.sla_breached,
              rejectionReasonCode: r.rejection_reason_code,
              memberMessage: r.member_message,
              internalComment: r.internal_comment,
            },
    },
    account: {
      countryCode: r.country_code,
      preferredLanguage: r.preferred_language,
      owner: refOf(r.owner_id, r.owner_name),
    },
    profile: {
      alias: r.alias,
      status: r.status,
      firstPublishedAt: r.published_at,
      completenessPercent: r.completeness_percent,
      headline: r.headline,
      bio: r.bio,
      primaryTopic: r.primary_topic_code,
      residenceRegion: r.residence_region_code,
      travelScope: r.travel_scope,
      collaborationExperience: r.collaboration_experience_band,
      deliveryLead: r.delivery_lead_band,
      maxExclusivity: r.max_exclusivity_band,
      acceptsNonMonetary: r.accepts_non_monetary,
      availability: r.availability_band,
      lists: {
        secondaryTopics: r.secondary_topics,
        tones: r.tones,
        publicationLanguages: r.publication_languages,
        formats: r.formats,
        usageRights: r.usage_rights,
        refusedSectors: r.refused_sectors,
      },
    },
  };
}

export type ReviewedLineRow = {
  id: string;
  networkCode: string;
  isPrimary: boolean;
  listed: boolean;
  handle: string | null;
  pseudonym: string | null;
  profileUrl: string | null;
  followers: number | null;
  postsLast30Days: number | null;
  avgComments: number | null;
  avgReach: number | null;
  engagementRateBp: number | null;
  figuresSource: "declared" | "agent_observed";
  figuresMeasuredAt: Instant;
  badge: string | null;
};

/** The lines of the account (layer I), the main one first, with the badge in force on each. */
export async function readReviewedLines(
  tx: Transaction,
  accountId: string,
): Promise<ReviewedLineRow[]> {
  const rows = await tx.execute<{
    id: string;
    network_code: string;
    is_primary: boolean;
    listed: boolean;
    handle: string | null;
    pseudonym: string | null;
    profile_url: string | null;
    followers: number | null;
    posts: number | null;
    comments: number | null;
    reach: number | null;
    engagement: number | null;
    figures_source: "declared" | "agent_observed";
    figures_measured_at: Instant;
    badge: string | null;
  }>(sql`
    select n.id::text as id, n.network_code::text as network_code, n.is_primary,
           (c.listed_at is not null) as listed, n.handle, n.pseudonym, n.profile_url,
           n.followers_count::float8 as followers, n.posts_last_30_days::float8 as posts,
           n.avg_comments_per_post::float8 as comments, n.avg_reach_per_post::float8 as reach,
           n.engagement_rate_bp::float8 as engagement, n.figures_source,
           to_char(n.figures_measured_at at time zone 'UTC', ${ISO_UTC}) as figures_measured_at,
           (select b.level::text
              from verification.badges b
             where b.account_id = n.account_id and b.social_account_id = n.id
               and b.state in ('active', 'to_refresh') and b.level <> 'brand_verified'
             order by b.level desc
             limit 1) as badge
      from profiles.creator_social_accounts n
      left join profiles.creator_public_networks c on c.social_account_id = n.id
     where n.account_id = ${accountId}::uuid
     order by n.is_primary desc, n.network_code, n.id`);
  return rows.map((row) => ({
    id: row.id,
    networkCode: row.network_code,
    isPrimary: row.is_primary,
    listed: row.listed,
    handle: row.handle,
    pseudonym: row.pseudonym,
    profileUrl: row.profile_url,
    followers: row.followers,
    postsLast30Days: row.posts,
    avgComments: row.comments,
    avgReach: row.reach,
    engagementRateBp: row.engagement,
    figuresSource: row.figures_source,
    figuresMeasuredAt: row.figures_measured_at,
    badge: row.badge,
  }));
}

export type ReviewedVisualRow = {
  id: string;
  state: "pending" | "approved";
  displayOrder: number | null;
  caption: string | null;
  brandDeclared: boolean;
  replacesItemId: string | null;
  width: number;
  height: number;
  byteSize: number;
  createdAt: string;
};

/** The visuals that count for the decision (modele point 10): pending or approved, in the creator's order. */
export async function readReviewedVisuals(
  tx: Transaction,
  accountId: string,
): Promise<ReviewedVisualRow[]> {
  const rows = await tx.execute<{
    id: string;
    state: "pending" | "approved";
    display_order: number | null;
    caption: string | null;
    brand_declared: boolean;
    replaces_item_id: string | null;
    width: number;
    height: number;
    byte_size: number;
    created_at: string;
  }>(sql`
    select v.id::text as id, v.state::text as state, v.display_order::int as display_order,
           v.caption, (v.brand_declaration_id is not null) as brand_declared,
           v.replaces_item_id::text as replaces_item_id, v.width, v.height, v.byte_size,
           to_char(coalesce(v.stored_at, v.created_at) at time zone 'UTC', ${ISO_UTC}) as created_at
      from profiles.portfolio_items v
     where v.account_id = ${accountId}::uuid and v.state in ('pending', 'approved')
     order by v.display_order nulls last, v.created_at, v.id`);
  return rows.map((row) => ({
    id: row.id,
    state: row.state,
    displayOrder: row.display_order,
    caption: row.caption,
    brandDeclared: row.brand_declared,
    replacesItemId: row.replaces_item_id,
    width: row.width,
    height: row.height,
    byteSize: row.byte_size,
    createdAt: row.created_at,
  }));
}

export type PendingRevisionRow = {
  id: string;
  fieldCode: string;
  rowKey: string | null;
  submittedAt: string;
  proposed: unknown;
};

/**
 * The revisions waiting for the decision of the entry (07 RG9, CA48): a text, a line, or a caption with
 * its statement. A closed entry has none waiting. The value is read here and shaped by the route.
 */
export async function readPendingRevisions(
  tx: Transaction,
  entryId: string,
): Promise<PendingRevisionRow[]> {
  const rows = await tx.execute<{
    id: string;
    field_code: string;
    row_key: string | null;
    submitted_at: string;
    proposed_value: unknown;
  }>(sql`
    select r.id::text as id, r.field_code, r.row_key,
           to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           r.proposed_value
      from profiles.creator_field_revisions r
     where r.creator_review_entry_id = ${entryId}::uuid and r.status = 'pending_review'
     order by r.field_code, r.row_key nulls first, r.id`);
  return rows.map((row) => ({
    id: row.id,
    fieldCode: row.field_code,
    rowKey: row.row_key,
    submittedAt: row.submitted_at,
    proposed: row.proposed_value,
  }));
}

/** The refusal reasons in force, in the order of the screen (07 RG96). */
export async function readCreatorRejectionReasons(
  tx: Transaction,
): Promise<
  { code: string; position: number; requiresMemberMessage: boolean }[]
> {
  const rows = await tx.execute<{
    code: string;
    position: number;
    requires_member_message: boolean;
  }>(sql`
    select r.code, r.position::int as position, r.requires_member_message
      from profiles.creator_rejection_reasons r
     where r.is_active
     order by r.position`);
  return rows.map((row) => ({
    code: row.code,
    position: row.position,
    requiresMemberMessage: row.requires_member_message,
  }));
}

// ---------------------------------------------------------------------------------------------
// Queue 3: the visual
// ---------------------------------------------------------------------------------------------

export type PortfolioItemView = {
  asOf: string;
  item: ClaimState & {
    id: string;
    accountId: string;
    kind: "deposit" | "replacement";
    state:
      "pending" | "approved" | "rejected" | "withdrawn" | "purging" | "purged";
    createdAt: string;
    slaDueAt: string;
    escalateAt: Instant;
    overdue: boolean;
    decision: {
      decidedAt: string;
      decidedBy: NamedRef | null;
      late: boolean;
      rejectionReasonCode: string | null;
      internalComment: string | null;
    } | null;
    width: number;
    height: number;
    byteSize: number;
    caption: string | null;
    brandDeclared: boolean;
    replaces: {
      id: string;
      displayOrder: number | null;
      caption: string | null;
    } | null;
  };
  account: {
    alias: string;
    countryCode: string;
    preferredLanguage: "fr" | "en";
    owner: NamedRef | null;
  };
};

type PortfolioItemViewRow = ClaimColumns & {
  as_of: string;
  id: string;
  account_id: string;
  kind: "deposit" | "replacement";
  state: PortfolioItemView["item"]["state"];
  created_at: string;
  sla_due_at: string;
  escalate_at: Instant;
  overdue: boolean;
  decided_at: Instant;
  decided_by: string | null;
  decided_by_name: string | null;
  sla_breached: boolean;
  rejection_reason_code: string | null;
  internal_comment: string | null;
  width: number;
  height: number;
  byte_size: number;
  caption: string | null;
  brand_declared: boolean;
  replaces_id: string | null;
  replaces_order: number | null;
  replaces_caption: string | null;
  alias: string;
  country_code: string;
  preferred_language: "fr" | "en";
  owner_id: string | null;
  owner_name: string | null;
};

/** The visual, its account (alias, country, language) and what it replaces, in ONE statement (one snapshot). */
export async function readPortfolioItemView(
  tx: Transaction,
  itemId: string,
): Promise<PortfolioItemView | null> {
  const rows = await tx.execute<PortfolioItemViewRow>(sql`
    select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of,
           e.id::text as id, e.account_id::text as account_id,
           case when e.replaces_item_id is null then 'deposit' else 'replacement' end as kind,
           e.state::text as state,
           to_char(e.stored_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.state = 'pending' and e.sla_due_at < now()) as overdue,
           (e.state = 'pending' and e.claimed_by_account_id is not null
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
           e.sla_breached, e.rejection_reason_code, e.internal_comment,
           e.width, e.height, e.byte_size, e.caption,
           (e.brand_declaration_id is not null) as brand_declared,
           r.id::text as replaces_id, r.display_order::int as replaces_order,
           r.caption as replaces_caption,
           p.alias, a.country_code::text as country_code,
           a.preferred_language::text as preferred_language,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name
      from profiles.portfolio_items e
      join profiles.creator_public_profiles p on p.account_id = e.account_id
      join identity.accounts a on a.id = e.account_id
      left join profiles.portfolio_items r
             on r.id = e.replaces_item_id and r.account_id = e.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
      left join identity.accounts fb on fb.id = e.forced_release_by_account_id
      left join identity.accounts fh on fh.id = e.forced_release_holder_account_id
      left join identity.accounts db on db.id = e.decided_by_account_id
     where e.id = ${itemId}::uuid and e.state <> 'uploading'`);
  const r = rows[0];
  if (r === undefined) {
    return null;
  }
  const claim = claimOf(r);
  return {
    asOf: r.as_of,
    item: {
      ...claim,
      id: r.id,
      accountId: r.account_id,
      kind: r.kind,
      state: r.state,
      createdAt: r.created_at,
      slaDueAt: r.sla_due_at,
      escalateAt: r.escalate_at,
      overdue: r.overdue,
      decision:
        r.decided_at === null
          ? null
          : {
              decidedAt: r.decided_at,
              decidedBy: refOf(r.decided_by, r.decided_by_name),
              late: r.sla_breached,
              rejectionReasonCode: r.rejection_reason_code,
              internalComment: r.internal_comment,
            },
      width: r.width,
      height: r.height,
      byteSize: r.byte_size,
      caption: r.caption,
      brandDeclared: r.brand_declared,
      replaces:
        r.replaces_id === null
          ? null
          : {
              id: r.replaces_id,
              displayOrder: r.replaces_order,
              caption: r.replaces_caption,
            },
    },
    account: {
      alias: r.alias,
      countryCode: r.country_code,
      preferredLanguage: r.preferred_language,
      owner: refOf(r.owner_id, r.owner_name),
    },
  };
}

/** The grid of RG79, RG82, RG83 in force, in the order of the screen (07 RG97). */
export async function readPortfolioRejectionReasons(
  tx: Transaction,
): Promise<{ code: string; position: number; gridControl: number | null }[]> {
  const rows = await tx.execute<{
    code: string;
    position: number;
    grid_control: number | null;
  }>(sql`
    select r.code, r.position::int as position, r.grid_control::int as grid_control
      from profiles.portfolio_rejection_reasons r
     where r.is_active
     order by r.position`);
  return rows.map((row) => ({
    code: row.code,
    position: row.position,
    gridControl: row.grid_control,
  }));
}
