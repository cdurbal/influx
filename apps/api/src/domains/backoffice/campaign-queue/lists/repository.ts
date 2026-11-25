// Database access of the list and the counters of queue 7 of the backoffice, « campagnes à valider »
// (`campaigns`) (docs/mvp/09 RG87; 15 RG26 to RG28, RG33, RG34, RG36, C5; 17b §3.8; jalons/l3c/modele.md
// §1; migrations 0307, 0312), under influx_agent or influx_admin in aal2 (03 §1.3). Parameterised queries only (S-1).
// - The policy of 0307, corrected by 0312, hides the entries of the caller's own account and the OPEN entries whose first
//   examination he gave (modele §3); the accounts the caller HOLDS (identity.accounts.owner_agent_id) are
//   left out of every read below too (15 RG36, 13 RG35): the database does not hide them, so the filter is
//   here, as for queues 1 to 3.
// - The list carries no text of the campaign and no band: the texts the alerts examine are read and handed
//   to `alerts.ts`, which keeps the kind of signal and forgets the text (fiche invariant 12).
// - Nothing here writes: the opening is a database function of 0307 (acts/repository.ts).
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";
import {
  pageOf,
  type Cursor,
  type ListFilters,
} from "../../creator-queues/lists/repository.ts";
import { ISO_UTC } from "../../sql-formats.ts";
import type { ExaminedCampaign } from "../alerts.ts";

export { pageOf, type Cursor, type ListFilters };

/** The cursor keeps the microseconds: two entries of the same millisecond stay apart. */
const ISO_UTC_MICRO = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';

type Instant = string | null;
type NamedRef = { accountId: string; displayName: string | null };

function refOf(id: string | null, name: string | null): NamedRef | null {
  return id === null ? null : { accountId: id, displayName: name };
}

/** The code of the queue in `backoffice.sla_policies` (0307). */
const QUEUE_CODE = "campaigns";

// ---------------------------------------------------------------------------------------------
// Counters (15 RG28, RG32)
// ---------------------------------------------------------------------------------------------

export type CampaignCountersRow = {
  asOf: string;
  pending: number;
  oldestCreatedAt: Instant;
  overdue: number;
  unclaimed: number;
  lastDecidedAt: Instant;
  decisionMinutes: number;
  claimTargetMinutes: number | null;
  escalateAfterMinutes: number | null;
  businessHours: boolean;
};

/** The permanent counters of queue 7, as the caller sees it (RG36), with its delay (RG38). */
export async function readCampaignCounters(
  tx: Transaction,
  caller: string,
): Promise<CampaignCountersRow | null> {
  const visible = sql`e.state = 'open' and a.owner_agent_id is distinct from ${caller}::uuid`;
  const rows = await tx.execute<{
    as_of: string;
    pending: number;
    oldest: Instant;
    overdue: number;
    unclaimed: number;
    last_decided: Instant;
    decision_minutes: number;
    claim_target_minutes: number | null;
    escalate_after_minutes: number | null;
    business_hours: boolean;
  }>(sql`
    select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of,
           (select count(*)::int from campaigns.campaign_review_entries e
              join identity.accounts a on a.id = e.advertiser_account_id
             where ${visible}) as pending,
           (select to_char(min(e.created_at) at time zone 'UTC', ${ISO_UTC})
              from campaigns.campaign_review_entries e
              join identity.accounts a on a.id = e.advertiser_account_id
             where ${visible}) as oldest,
           (select count(*)::int from campaigns.campaign_review_entries e
              join identity.accounts a on a.id = e.advertiser_account_id
             where ${visible} and e.sla_due_at < now()) as overdue,
           (select count(*)::int from campaigns.campaign_review_entries e
              join identity.accounts a on a.id = e.advertiser_account_id
             where ${visible}
               and (e.claimed_by_account_id is null or e.claim_expires_at <= now())) as unclaimed,
           (select to_char(max(e.decided_at) at time zone 'UTC', ${ISO_UTC})
              from campaigns.campaign_review_entries e
              join identity.accounts a on a.id = e.advertiser_account_id
             where e.state in ('published', 'rejected')
               and a.owner_agent_id is distinct from ${caller}::uuid) as last_decided,
           p.target_decision_minutes as decision_minutes,
           p.target_claim_minutes as claim_target_minutes,
           p.escalate_after_minutes,
           (p.business_hours is not null) as business_hours
      from backoffice.sla_policies p
     where p.queue_code = ${QUEUE_CODE} and p.is_active`);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    asOf: row.as_of,
    pending: row.pending,
    oldestCreatedAt: row.oldest,
    overdue: row.overdue,
    unclaimed: row.unclaimed,
    lastDecidedAt: row.last_decided,
    decisionMinutes: row.decision_minutes,
    claimTargetMinutes: row.claim_target_minutes,
    escalateAfterMinutes: row.escalate_after_minutes,
    businessHours: row.business_hours,
  };
}

// ---------------------------------------------------------------------------------------------
// The conditions of the list (15 RG26, RG27 C5, RG33)
// ---------------------------------------------------------------------------------------------

/**
 * The entries a list reads, oldest deadline first (C5), for the caller: open, never of an account he
 * holds (RG36), and the filters common to every queue (RG33). No filter is added without the project
 * manager.
 */
export function campaignConditionsOf(
  filters: ListFilters,
  caller: string,
): SQL[] {
  const live = sql`e.claimed_by_account_id is not null and e.claim_expires_at > now()`;
  const conditions: SQL[] = [
    sql`e.state = 'open'`,
    // 15 RG36, 13 RG35: an entry of an account the caller holds is masked from him
    sql`a.owner_agent_id is distinct from ${caller}::uuid`,
  ];
  if (filters.overdue === true) {
    conditions.push(sql`e.sla_due_at < now()`);
  }
  if (filters.holder === "free") {
    conditions.push(sql`not (${live})`);
  } else if (filters.holder !== undefined) {
    const holder = filters.holder === "me" ? caller : filters.holder;
    conditions.push(
      sql`(${live}) and e.claimed_by_account_id = ${holder}::uuid`,
    );
  }
  if (filters.owner === "none") {
    conditions.push(sql`a.owner_agent_id is null`);
  } else if (filters.owner !== undefined) {
    conditions.push(sql`a.owner_agent_id = ${filters.owner}::uuid`);
  }
  if (filters.from !== undefined) {
    conditions.push(sql`e.created_at >= ${filters.from}::timestamptz`);
  }
  if (filters.to !== undefined) {
    conditions.push(sql`e.created_at <= ${filters.to}::timestamptz`);
  }
  if (filters.after !== undefined) {
    conditions.push(
      sql`(e.sla_due_at, e.created_at, e.id) >
          (${filters.after.dueAt}::timestamptz, ${filters.after.createdAt}::timestamptz,
           ${filters.after.id}::uuid)`,
    );
  }
  return conditions;
}

// ---------------------------------------------------------------------------------------------
// The entries (09 RG87)
// ---------------------------------------------------------------------------------------------

export type ListedCampaignEntry = {
  id: string;
  campaignId: string;
  advertiserAccountId: string;
  brandName: string | null;
  title: string | null;
  campaignType: string | null;
  sectorCode: string | null;
  enhancedReview: boolean;
  firstReviewer: NamedRef | null;
  createdAt: string;
  slaDueAt: string;
  escalateAt: Instant;
  overdue: boolean;
  owner: NamedRef | null;
  held: boolean;
  holder: NamedRef | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
  duplicate: boolean;
  /** The texts the detection examines; never served. */
  examined: ExaminedCampaign;
  cursor: Cursor;
};

type ListRow = {
  id: string;
  campaign_id: string;
  advertiser_account_id: string;
  brand_name: string | null;
  title: string | null;
  campaign_type_code: string | null;
  sector_code: string | null;
  enhanced: boolean;
  first_by: string | null;
  first_by_name: string | null;
  created_at: string;
  sla_due_at: string;
  escalate_at: Instant;
  overdue: boolean;
  cursor_due: string;
  cursor_created: string;
  owner_id: string | null;
  owner_name: string | null;
  held: boolean;
  holder_id: string | null;
  holder_name: string | null;
  claimed_at: Instant;
  claim_expires_at: Instant;
  duplicate: boolean;
  public_summary: string | null;
  brief: string | null;
  product_description: string | null;
  restrictions: string | null;
  key_messages: string[];
};

async function listCampaignEntries(
  tx: Transaction,
  caller: string,
  filters: ListFilters,
  limit: number,
): Promise<ListedCampaignEntry[]> {
  const rows = await tx.execute<ListRow>(sql`
    select e.id::text as id, e.campaign_id::text as campaign_id,
           e.advertiser_account_id::text as advertiser_account_id,
           p.legal_name as brand_name, c.title, c.campaign_type_code, c.sector_code,
           coalesce(s.is_sensitive, false) as enhanced,
           e.first_reviewed_by_account_id::text as first_by, fr.display_name as first_by_name,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.sla_due_at < now()) as overdue,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_due,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_created,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           (e.claimed_by_account_id is not null and e.claim_expires_at > now()) as held,
           e.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(e.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(e.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           (e.duplicate_of_campaign_id is not null) as duplicate,
           c.public_summary, c.brief, c.product_description, c.restrictions,
           coalesce((select jsonb_agg(m.body order by m.position)
                       from campaigns.campaign_key_messages m where m.campaign_id = c.id),
                    '[]'::jsonb) as key_messages
      from campaigns.campaign_review_entries e
      join campaigns.campaigns c on c.id = e.campaign_id
      join profiles.advertiser_profiles p on p.account_id = e.advertiser_account_id
      join identity.accounts a on a.id = e.advertiser_account_id
      left join reference.sectors s on s.code = c.sector_code
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
      left join identity.accounts fr on fr.id = e.first_reviewed_by_account_id
     where ${sql.join(campaignConditionsOf(filters, caller), sql` and `)}
     order by e.sla_due_at, e.created_at, e.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    campaignId: row.campaign_id,
    advertiserAccountId: row.advertiser_account_id,
    brandName: row.brand_name,
    title: row.title,
    campaignType: row.campaign_type_code,
    sectorCode: row.sector_code,
    enhancedReview: row.enhanced,
    firstReviewer: refOf(row.first_by, row.first_by_name),
    createdAt: row.created_at,
    slaDueAt: row.sla_due_at,
    escalateAt: row.escalate_at,
    overdue: row.overdue,
    owner: refOf(row.owner_id, row.owner_name),
    held: row.held,
    holder: row.held ? refOf(row.holder_id, row.holder_name) : null,
    claimedAt: row.held ? row.claimed_at : null,
    claimExpiresAt: row.held ? row.claim_expires_at : null,
    duplicate: row.duplicate,
    examined: {
      title: row.title,
      publicSummary: row.public_summary,
      brief: row.brief,
      productDescription: row.product_description,
      restrictions: row.restrictions,
      keyMessages: row.key_messages,
    },
    cursor: {
      dueAt: row.cursor_due,
      createdAt: row.cursor_created,
      id: row.id,
    },
  }));
}

/** The page of the list (15 RG34), with the alert filter when asked (15 RG33): the page logic of queues 2 and 3. */
export function listCampaignEntriesPage(
  tx: Transaction,
  caller: string,
  filters: ListFilters,
  limit: number,
  hasAlert: ((entry: ListedCampaignEntry) => boolean) | null,
) {
  return pageOf(
    (page, size) => listCampaignEntries(tx, caller, page, size),
    filters,
    limit,
    hasAlert,
  );
}

/**
 * 17b §2.6: the entry to open after a decision: oldest deadline first, ties by entry into the queue,
 * among the open ones nobody holds, never the caller's own account nor one he holds (RG36). The policy
 * is read as everywhere else; `except` leaves out the entry just given back (D84). Null when none.
 */
export async function nextCampaignEntryId(
  tx: Transaction,
  caller: string,
  except: string | null = null,
): Promise<string | null> {
  const rows = await tx.execute<{ id: string }>(sql`
    select e.id::text as id
      from campaigns.campaign_review_entries e
      join identity.accounts a on a.id = e.advertiser_account_id
     where ${sql.join(campaignConditionsOf({ holder: "free" }, caller), sql` and `)}
       and (${except}::uuid is null or e.id <> ${except}::uuid)
     order by e.sla_due_at, e.created_at, e.id
     limit 1`);
  return rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------------------------
// The target of an act, and the last forced release
// ---------------------------------------------------------------------------------------------

/**
 * The brand behind an entry of queue 7, and who holds it: null for an unknown entry, the caller's own
 * account (hidden by the policy of 0307, 0313: the requester of a second opinion reads his entry again, D84).
 */
export async function campaignEntryTargetOf(
  tx: Transaction,
  entryId: string,
): Promise<{
  campaignId: string;
  advertiserAccountId: string;
  ownerAgentId: string | null;
} | null> {
  const rows = await tx.execute<{
    campaign_id: string;
    advertiser_account_id: string;
    owner_agent_id: string | null;
  }>(sql`
    select e.campaign_id::text as campaign_id,
           e.advertiser_account_id::text as advertiser_account_id,
           a.owner_agent_id::text as owner_agent_id
      from campaigns.campaign_review_entries e
      join identity.accounts a on a.id = e.advertiser_account_id
     where e.id = ${entryId}::uuid`);
  const row = rows[0];
  return row === undefined
    ? null
    : {
        campaignId: row.campaign_id,
        advertiserAccountId: row.advertiser_account_id,
        ownerAgentId: row.owner_agent_id,
      };
}

/**
 * The brand behind a campaign, who holds it, and its state: null for an unknown campaign or the one of
 * the caller's own account (hidden by the policy of 0308).
 */
export async function campaignTargetOf(
  tx: Transaction,
  campaignId: string,
): Promise<{
  advertiserAccountId: string;
  ownerAgentId: string | null;
  status: string;
} | null> {
  const rows = await tx.execute<{
    advertiser_account_id: string;
    owner_agent_id: string | null;
    status: string;
  }>(sql`
    select c.advertiser_account_id::text as advertiser_account_id,
           a.owner_agent_id::text as owner_agent_id, c.status::text as status
      from campaigns.campaigns c
      join identity.accounts a on a.id = c.advertiser_account_id
     where c.id = ${campaignId}::uuid`);
  const row = rows[0];
  return row === undefined
    ? null
    : {
        advertiserAccountId: row.advertiser_account_id,
        ownerAgentId: row.owner_agent_id,
        status: row.status,
      };
}

/** Whether the last forced release of the entry dispossessed this agent (file.md A8). */
export async function campaignWasDispossessed(
  tx: Transaction,
  entryId: string,
  accountId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ dispossessed: boolean }>(sql`
    select (forced_release_holder_account_id = ${accountId}::uuid) as dispossessed
      from campaigns.campaign_review_entries
     where id = ${entryId}::uuid and forced_release_at is not null`);
  return rows[0]?.dispossessed === true;
}
