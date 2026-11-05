// Database access of queue 1, "profils marque à valider" (docs/mvp/06 RG63 to RG70; 15 RG26 to
// RG28, RG33, RG34, RG36, C1 to C8; jalons/l2c/file.md A1 to A10; 0206, 0207, 0210), under
// influx_agent or influx_admin in aal2 (03 §1.3). Parameterised queries only (S-1).
// - Reads go through the policies of 0207: an entry of the caller's own account is not there
//   (15 RG36, C(3)). The accounts the caller HOLDS (identity.accounts.owner_agent_id) are left out
//   of every read below too (RG36, 13 RG35); the database does not hide them, so the filter is here.
// - The one write is the opening, which is the claim (15 C1): the database function
//   profiles.open_advertiser_review_entry(), whose atomic conditional UPDATE is the lock (file.md
//   A1, 04 l. 2465-2480). Never a SELECT then an UPDATE from here.
// - Nothing here reads an e-mail address of an account: the contact person of the brand is read in
//   the decision view only (L2BS-7), after the opening that the database journals.
import type {
  ModeratedFieldCode,
  RevisionValue,
} from "@influx/contracts/backoffice-queues";
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { ISO_UTC } from "../sql-formats.ts";

/**
 * The eight lists of a brand profile (0202), by the name the contract gives them. A domain never
 * imports the repository of another (02 §4 rule 2), so the map is kept here, read-only: a list that
 * the profile adds is refused by the closed schema of the answer until it is added here too.
 */
const LISTS = {
  secondarySectors: {
    table: "advertiser_secondary_sectors",
    column: "sector_code",
    slotted: true,
  },
  targetMarkets: {
    table: "advertiser_target_markets",
    column: "country_code",
    slotted: true,
  },
  workingLanguages: {
    table: "advertiser_working_languages",
    column: "language_code",
    slotted: false,
  },
  topics: { table: "advertiser_topics", column: "topic_code", slotted: true },
  networks: {
    table: "advertiser_networks",
    column: "network_code",
    slotted: false,
  },
  formats: {
    table: "advertiser_formats",
    column: "format_code",
    slotted: false,
  },
  audienceCountries: {
    table: "advertiser_audience_countries",
    column: "country_code",
    slotted: true,
  },
  usageRights: {
    table: "advertiser_usage_rights",
    column: "usage_right_code",
    slotted: false,
  },
} as const;

type ListName = keyof typeof LISTS;

/**
 * One list of the profile `p`, aggregated in slot order where it has one. As JSON: the pool does
 * not fetch array types (db/pool.ts), a Postgres array would come back as text.
 */
function listColumn(name: ListName): SQL {
  const list = LISTS[name];
  const table = sql`${sql.identifier("profiles")}.${sql.identifier(list.table)}`;
  const order = sql.identifier(list.slotted ? "slot" : list.column);
  return sql`coalesce((select jsonb_agg(${sql.identifier(list.column)}::text order by ${order})
                         from ${table} l
                        where l.account_id = p.account_id), '[]'::jsonb)`;
}

/** The cursor keeps the microseconds: two entries of the same millisecond stay apart. */
const ISO_UTC_MICRO = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';

/** Past this many lines read for one page with the alert filter, the page stops short (RG34). */
export const ALERT_SCAN_LIMIT = 2000;
const ALERT_SCAN_BATCH = 100;

export type EntryFilters = {
  kind?: "submission" | "revision";
  country?: string;
  overdue?: boolean;
  /** `free`, `me`, or the account id of a named agent. */
  holder?: string;
  /** `none`, or the account id of the responsible salesperson. */
  owner?: string;
  from?: string;
  to?: string;
  after?: { dueAt: string; createdAt: string; id: string };
};

type Instant = string | null;

// ---------------------------------------------------------------------------------------------
// Counters (15 RG28, RG32)
// ---------------------------------------------------------------------------------------------

export type CountersRow = {
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

/** The permanent counters of the queue, as the caller sees the queue (RG36), with its delay (RG38). */
export async function readCounters(
  tx: Transaction,
  caller: string,
): Promise<CountersRow | null> {
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
           (select count(*)::int from profiles.advertiser_review_entries e
              join identity.accounts a on a.id = e.account_id
             where e.state = 'open' and a.owner_agent_id is distinct from ${caller}::uuid) as pending,
           (select to_char(min(e.created_at) at time zone 'UTC', ${ISO_UTC})
              from profiles.advertiser_review_entries e
              join identity.accounts a on a.id = e.account_id
             where e.state = 'open' and a.owner_agent_id is distinct from ${caller}::uuid) as oldest,
           (select count(*)::int from profiles.advertiser_review_entries e
              join identity.accounts a on a.id = e.account_id
             where e.state = 'open' and e.sla_due_at < now()
               and a.owner_agent_id is distinct from ${caller}::uuid) as overdue,
           (select count(*)::int from profiles.advertiser_review_entries e
              join identity.accounts a on a.id = e.account_id
             where e.state = 'open'
               and (e.claimed_by_account_id is null or e.claim_expires_at <= now())
               and a.owner_agent_id is distinct from ${caller}::uuid) as unclaimed,
           (select to_char(max(e.decided_at) at time zone 'UTC', ${ISO_UTC})
              from profiles.advertiser_review_entries e
              join identity.accounts a on a.id = e.account_id
             where e.state in ('published', 'rejected')
               and a.owner_agent_id is distinct from ${caller}::uuid) as last_decided,
           p.target_decision_minutes as decision_minutes,
           p.target_claim_minutes as claim_target_minutes,
           p.escalate_after_minutes,
           (p.business_hours is not null) as business_hours
      from backoffice.sla_policies p
     where p.queue_code = 'profiles_advertiser' and p.is_active`);
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
// The list (15 RG26, RG27 C5, RG33, RG34)
// ---------------------------------------------------------------------------------------------

export type ListedEntry = {
  id: string;
  accountId: string;
  kind: "submission" | "revision";
  createdAt: string;
  slaDueAt: string;
  escalateAt: Instant;
  overdue: boolean;
  brandName: string;
  countryCode: string;
  completenessPercent: number | null;
  modifiedFields: ModeratedFieldCode[];
  owner: { accountId: string; displayName: string | null } | null;
  held: boolean;
  holder: { accountId: string; displayName: string | null } | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
  /** The values the moderator examines (a pending proposal replaces the live value). */
  examined: {
    brandName: string;
    presentation: string | null;
    websiteDomain: string | null;
  };
  duplicateBrand: boolean;
  duplicateDomain: boolean;
  /** The sort key, for the cursor. */
  cursor: { dueAt: string; createdAt: string; id: string };
};

type ListRow = {
  id: string;
  account_id: string;
  kind: "submission" | "revision";
  created_at: string;
  sla_due_at: string;
  escalate_at: Instant;
  overdue: boolean;
  cursor_due: string;
  cursor_created: string;
  brand_name: string;
  country_code: string;
  completeness_percent: number | null;
  modified_fields: ModeratedFieldCode[] | null;
  owner_id: string | null;
  owner_name: string | null;
  held: boolean;
  holder_id: string | null;
  holder_name: string | null;
  claimed_at: Instant;
  claim_expires_at: Instant;
  examined_brand_name: string;
  examined_presentation: string | null;
  examined_website_domain: string | null;
  duplicate_brand: boolean;
  duplicate_domain: boolean;
};

export function conditionsOf(filters: EntryFilters, caller: string): SQL[] {
  const live = sql`e.claimed_by_account_id is not null and e.claim_expires_at > now()`;
  const conditions: SQL[] = [
    sql`e.state = 'open'`,
    // 15 RG36, 13 RG35: an entry of an account the caller holds is masked from him
    sql`a.owner_agent_id is distinct from ${caller}::uuid`,
  ];
  if (filters.kind !== undefined) {
    conditions.push(sql`e.kind = ${filters.kind}::profiles.review_entry_kind`);
  }
  if (filters.country !== undefined) {
    conditions.push(sql`a.country_code = ${filters.country}`);
  }
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

/**
 * The entries of the queue, oldest deadline first, ties by creation (15 C5): the ones past their
 * deadline come first by that very order. At most `limit` lines; no coordinate is read.
 */
export async function listEntries(
  tx: Transaction,
  caller: string,
  filters: EntryFilters,
  limit: number,
): Promise<ListedEntry[]> {
  const rows = await tx.execute<ListRow>(sql`
    select e.id::text as id, e.account_id::text as account_id, e.kind::text as kind,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.sla_due_at < now()) as overdue,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_due,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_created,
           p.legal_name as brand_name, a.country_code::text as country_code,
           p.completeness_percent,
           coalesce(x.modified_fields, '[]'::jsonb) as modified_fields,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           (e.claimed_by_account_id is not null and e.claim_expires_at > now()) as held,
           e.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(e.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(e.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           x.brand_name as examined_brand_name, x.presentation as examined_presentation,
           x.website_domain as examined_website_domain,
           d.duplicate_brand, d.duplicate_domain
      from profiles.advertiser_review_entries e
      join profiles.advertiser_profiles p on p.account_id = e.account_id
      join identity.accounts a on a.id = e.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
      cross join lateral (
        -- 06 RG9: a pending proposal replaces the live value for the examination; one without
        -- a pending proposal leaves it (bool_or is null without a line)
        select jsonb_agg(r.field_code order by r.field_code)
                 filter (where r.field_code is not null) as modified_fields,
               case when bool_or(r.field_code = 'advertiser.brand_name')
                    then max(r.proposed_value #>> '{}')
                           filter (where r.field_code = 'advertiser.brand_name')
                    else p.legal_name end as brand_name,
               case when bool_or(r.field_code = 'advertiser.presentation')
                    then max(r.proposed_value #>> '{}')
                           filter (where r.field_code = 'advertiser.presentation')
                    else p.presentation end as presentation,
               case when bool_or(r.field_code = 'advertiser.website_domain')
                    then max(r.proposed_value #>> '{}')
                           filter (where r.field_code = 'advertiser.website_domain')
                    else p.website_domain end as website_domain
          from profiles.profile_field_revisions r
         where r.advertiser_review_entry_id = e.id and r.status = 'pending_review'
      ) x
      cross join lateral (
        select coalesce(bool_or(c.matched_on = 'brand_name'), false) as duplicate_brand,
               coalesce(bool_or(c.matched_on = 'domain'), false) as duplicate_domain
          from profiles.advertiser_duplicate_candidates(e.account_id, x.brand_name,
                                                        x.website_domain) c
      ) d
     where ${sql.join(conditionsOf(filters, caller), sql` and `)}
     order by e.sla_due_at, e.created_at, e.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    kind: row.kind,
    createdAt: row.created_at,
    slaDueAt: row.sla_due_at,
    escalateAt: row.escalate_at,
    overdue: row.overdue,
    brandName: row.brand_name,
    countryCode: row.country_code,
    completenessPercent: row.completeness_percent,
    modifiedFields: row.modified_fields ?? [],
    owner:
      row.owner_id === null
        ? null
        : { accountId: row.owner_id, displayName: row.owner_name },
    held: row.held,
    holder:
      row.held && row.holder_id !== null
        ? { accountId: row.holder_id, displayName: row.holder_name }
        : null,
    claimedAt: row.held ? row.claimed_at : null,
    claimExpiresAt: row.held ? row.claim_expires_at : null,
    examined: {
      brandName: row.examined_brand_name,
      presentation: row.examined_presentation,
      websiteDomain: row.examined_website_domain,
    },
    duplicateBrand: row.duplicate_brand,
    duplicateDomain: row.duplicate_domain,
    cursor: {
      dueAt: row.cursor_due,
      createdAt: row.cursor_created,
      id: row.id,
    },
  }));
}

/**
 * The page of the list, with the alert filter when asked (15 RG33): the alerts are computed in
 * code (packages/domain), so the lines are read in batches and kept when they carry one, until the
 * page and one more are found, the queue is exhausted, or ALERT_SCAN_LIMIT lines were read. Without
 * the filter, one read of `limit + 1`. `resumeAfter` is where the next page starts, null at the end.
 */
export async function listEntriesPage(
  tx: Transaction,
  caller: string,
  filters: EntryFilters,
  limit: number,
  hasAlert: ((entry: ListedEntry) => boolean) | null,
): Promise<{
  items: ListedEntry[];
  resumeAfter: ListedEntry["cursor"] | null;
}> {
  if (hasAlert === null) {
    const rows = await listEntries(tx, caller, filters, limit + 1);
    const items = rows.slice(0, limit);
    return {
      items,
      resumeAfter: rows.length > limit ? (items.at(-1)?.cursor ?? null) : null,
    };
  }
  const kept: ListedEntry[] = [];
  let scanned = 0;
  let after = filters.after;
  while (scanned < ALERT_SCAN_LIMIT) {
    const batch = await listEntries(
      tx,
      caller,
      after === undefined ? filters : { ...filters, after },
      ALERT_SCAN_BATCH,
    );
    scanned += batch.length;
    for (const entry of batch) {
      if (hasAlert(entry)) kept.push(entry);
    }
    const last = batch.at(-1);
    const items = kept.slice(0, limit);
    if (kept.length > limit) {
      return { items, resumeAfter: items.at(-1)?.cursor ?? null };
    }
    if (last === undefined || batch.length < ALERT_SCAN_BATCH) {
      return { items, resumeAfter: null };
    }
    after = last.cursor;
  }
  // Stopped by the cap: the page is what was found, the next one starts after the last line READ.
  return { items: kept, resumeAfter: after ?? null };
}

// ---------------------------------------------------------------------------------------------
// The opening (15 C1, C2) and the decision view
// ---------------------------------------------------------------------------------------------

/** The account behind an entry, and who holds it: null for an unknown entry or the caller's own. */
export async function entryAccountOf(
  tx: Transaction,
  entryId: string,
): Promise<{ accountId: string; ownerAgentId: string | null } | null> {
  const rows = await tx.execute<{
    account_id: string;
    owner_agent_id: string | null;
  }>(sql`
    select e.account_id::text as account_id, a.owner_agent_id::text as owner_agent_id
      from profiles.advertiser_review_entries e
      join identity.accounts a on a.id = e.account_id
     where e.id = ${entryId}::uuid`);
  const row = rows[0];
  return row === undefined
    ? null
    : { accountId: row.account_id, ownerAgentId: row.owner_agent_id };
}

export type OpeningRow = {
  outcome: "claimed" | "held" | "read_only" | "closed";
  reviewToken: string | null;
};

/**
 * 15 C1, C2: opening is taking. The database decides in one conditional UPDATE and journals the
 * opening (`queue.entry_opened`, L2BS-7). 42501 for an unknown entry or the caller's own account.
 */
export async function openEntry(
  tx: Transaction,
  entryId: string,
): Promise<OpeningRow> {
  const rows = await tx.execute<{
    outcome: OpeningRow["outcome"];
    review_token: string | null;
  }>(sql`
    select outcome, review_token
      from profiles.open_advertiser_review_entry(${entryId}::uuid)`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("profiles.open_advertiser_review_entry() returned no row");
  }
  return { outcome: row.outcome, reviewToken: row.review_token };
}

export type EntryView = {
  asOf: string;
  entry: {
    id: string;
    accountId: string;
    kind: "submission" | "revision";
    state: "open" | "published" | "rejected" | "withdrawn";
    createdAt: string;
    slaDueAt: string;
    escalateAt: Instant;
    overdue: boolean;
    held: boolean;
    holder: { accountId: string; displayName: string | null } | null;
    claimedAt: Instant;
    claimExpiresAt: Instant;
    forcedRelease: {
      releasedAt: string;
      releasedBy: { accountId: string; displayName: string | null } | null;
      holder: { accountId: string; displayName: string | null } | null;
      reasonCode: string;
    } | null;
    decision: {
      decidedAt: string;
      decidedBy: { accountId: string; displayName: string | null } | null;
      late: boolean;
      rejectionReasonCode: string | null;
      memberMessage: string | null;
      internalComment: string | null;
    } | null;
  };
  account: {
    countryCode: string;
    preferredLanguage: "fr" | "en";
    owner: { accountId: string; displayName: string | null } | null;
  };
  profile: {
    status: string;
    submittedAt: Instant;
    firstPublishedAt: Instant;
    completenessPercent: number | null;
    brandName: string;
    primarySector: string | null;
    companySize: string | null;
    websiteDomain: string | null;
    presentation: string | null;
    exclusivityBand: string | null;
    collaborationRhythm: string | null;
    offersNonMonetary: boolean | null;
    contactRole: string | null;
    lists: Record<ListName, string[]>;
    contact: {
      firstName: string | null;
      email: string | null;
      phone: string | null;
      url: string | null;
    };
  };
};

type NamedRef = { accountId: string; displayName: string | null } | null;

function refOf(id: string | null, name: string | null): NamedRef {
  return id === null ? null : { accountId: id, displayName: name };
}

type ViewRow = {
  as_of: string;
  id: string;
  account_id: string;
  kind: EntryView["entry"]["kind"];
  state: EntryView["entry"]["state"];
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
  rejection_reason_code: string | null;
  member_message: string | null;
  internal_comment: string | null;
  country_code: string;
  preferred_language: "fr" | "en";
  owner_id: string | null;
  owner_name: string | null;
  status: string;
  submitted_at: Instant;
  first_published_at: Instant;
  completeness_percent: number | null;
  legal_name: string;
  primary_sector_code: string | null;
  company_size_band: string | null;
  website_domain: string | null;
  presentation: string | null;
  exclusivity_band: string | null;
  collaboration_rhythm: string | null;
  offers_non_monetary: boolean | null;
  contact_role: string | null;
  contact_first_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_url: string | null;
} & Record<ListName, string[]>;

/**
 * The entry, its account and the live profile, read in ONE statement (one snapshot) AFTER the
 * opening that rendered the token: what the agent sees is never older than the version the token
 * stands for, so a write that slipped in between makes the decision stale (55000), never blind
 * (L2BS-1). The contact person is read here only (L2BS-7).
 */
export async function readEntryView(
  tx: Transaction,
  entryId: string,
): Promise<EntryView | null> {
  const rows = await tx.execute<ViewRow>(sql`
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
           p.status::text as status,
           to_char(p.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           to_char(p.first_published_at at time zone 'UTC', ${ISO_UTC}) as first_published_at,
           p.completeness_percent, p.legal_name, p.primary_sector_code, p.company_size_band,
           p.website_domain, p.presentation, p.exclusivity_band, p.collaboration_rhythm,
           p.offers_non_monetary, p.contact_role,
           c.contact_first_name, c.contact_email, c.contact_phone, c.contact_url,
           ${listColumn("secondarySectors")} as "secondarySectors",
           ${listColumn("targetMarkets")} as "targetMarkets",
           ${listColumn("workingLanguages")} as "workingLanguages",
           ${listColumn("topics")} as "topics",
           ${listColumn("networks")} as "networks",
           ${listColumn("formats")} as "formats",
           ${listColumn("audienceCountries")} as "audienceCountries",
           ${listColumn("usageRights")} as "usageRights"
      from profiles.advertiser_review_entries e
      join profiles.advertiser_profiles p on p.account_id = e.account_id
      join identity.accounts a on a.id = e.account_id
      left join profiles.advertiser_contact_details c on c.account_id = e.account_id
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
  return {
    asOf: r.as_of,
    entry: {
      id: r.id,
      accountId: r.account_id,
      kind: r.kind,
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
              internalComment: r.internal_comment,
            },
    },
    account: {
      countryCode: r.country_code,
      preferredLanguage: r.preferred_language,
      owner: refOf(r.owner_id, r.owner_name),
    },
    profile: {
      status: r.status,
      submittedAt: r.submitted_at,
      firstPublishedAt: r.first_published_at,
      completenessPercent: r.completeness_percent,
      brandName: r.legal_name,
      primarySector: r.primary_sector_code,
      companySize: r.company_size_band,
      websiteDomain: r.website_domain,
      presentation: r.presentation,
      exclusivityBand: r.exclusivity_band,
      collaborationRhythm: r.collaboration_rhythm,
      offersNonMonetary: r.offers_non_monetary,
      contactRole: r.contact_role,
      lists: {
        secondarySectors: r.secondarySectors,
        targetMarkets: r.targetMarkets,
        workingLanguages: r.workingLanguages,
        topics: r.topics,
        networks: r.networks,
        formats: r.formats,
        audienceCountries: r.audienceCountries,
        usageRights: r.usageRights,
      },
      contact: {
        firstName: r.contact_first_name,
        email: r.contact_email,
        phone: r.contact_phone,
        url: r.contact_url,
      },
    },
  };
}

export type LogoRow = {
  id: string;
  state: "active" | "in_review";
  byteSize: number | null;
  width: number | null;
  height: number | null;
  activatedAt: Instant;
};

/** The logos the agent examines: the active one, and the one waiting for the decision (0208). */
export async function readLogos(
  tx: Transaction,
  accountId: string,
): Promise<LogoRow[]> {
  const rows = await tx.execute<{
    id: string;
    state: "active" | "in_review";
    byte_size: number | null;
    width: number | null;
    height: number | null;
    activated_at: Instant;
  }>(sql`
    select l.id::text as id, l.state::text as state, l.byte_size, l.width, l.height,
           to_char(l.activated_at at time zone 'UTC', ${ISO_UTC}) as activated_at
      from profiles.brand_logo_objects l
     where l.account_id = ${accountId}::uuid and l.state in ('active', 'in_review')`);
  return rows.map((row) => ({
    id: row.id,
    state: row.state,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    activatedAt: row.activated_at,
  }));
}

export type PendingRevision = {
  id: string;
  fieldCode: ModeratedFieldCode;
  submittedAt: string;
  proposed: RevisionValue;
};

/**
 * The revisions waiting for the decision of the entry (06 RG9): a text (or its removal), or the
 * logo the revision points to. A closed entry has none waiting.
 */
export async function readPendingRevisions(
  tx: Transaction,
  entryId: string,
): Promise<PendingRevision[]> {
  const rows = await tx.execute<{
    id: string;
    field_code: ModeratedFieldCode;
    submitted_at: string;
    proposed_value: unknown;
  }>(sql`
    select r.id::text as id, r.field_code,
           to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           r.proposed_value
      from profiles.profile_field_revisions r
     where r.advertiser_review_entry_id = ${entryId}::uuid and r.status = 'pending_review'
     order by r.field_code`);
  return rows.map((row) => {
    const value = row.proposed_value;
    const proposed: RevisionValue =
      row.field_code === "advertiser.logo"
        ? {
            kind: "logo",
            logoObjectId:
              typeof value === "object" &&
              value !== null &&
              "logo_object_id" in value &&
              typeof value.logo_object_id === "string"
                ? value.logo_object_id
                : null,
          }
        : { kind: "text", text: typeof value === "string" ? value : null };
    return {
      id: row.id,
      fieldCode: row.field_code,
      submittedAt: row.submitted_at,
      proposed,
    };
  });
}

/** 06 RG25, RG70: the published brands of OTHER accounts that the examined name or domain matches. */
export async function readDuplicates(
  tx: Transaction,
  accountId: string,
  brandName: string,
  websiteDomain: string | null,
): Promise<{ accountId: string; brandName: string; matchedOn: string }[]> {
  const rows = await tx.execute<{
    account_id: string;
    brand_name: string;
    matched_on: string;
  }>(sql`
    select c.account_id::text as account_id, p.legal_name as brand_name, c.matched_on
      from profiles.advertiser_duplicate_candidates(
             ${accountId}::uuid, ${brandName}, ${websiteDomain}) c
      join profiles.advertiser_profiles p on p.account_id = c.account_id`);
  return rows.map((row) => ({
    accountId: row.account_id,
    brandName: row.brand_name,
    matchedOn: row.matched_on,
  }));
}

/** The refusal reasons in force, in the order of the screen (06 RG66, 17b §4.3). */
export async function readRejectionReasons(
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
      from profiles.advertiser_rejection_reasons r
     where r.is_active
     order by r.position`);
  return rows.map((row) => ({
    code: row.code,
    position: row.position,
    requiresMemberMessage: row.requires_member_message,
  }));
}

/** What the journaled read of a logo gives apps/api to relay the object (0213). Never sent as is. */
export type ReviewLogoObject = {
  state: "active" | "in_review";
  /** The key in Storage: relayed from here to the store, never written to a response or a log. */
  objectKey: string;
  byteSize: number | null;
  width: number | null;
  height: number | null;
  updatedAt: string;
};

/**
 * The logo of an entry, by the journaled door of 0213: profiles.read_advertiser_review_logo() writes
 * one `queue.logo_read` line {queue_code, logo_id, state} in this transaction and returns the key of
 * the object to relay. 42501, one answer, for an unknown entry, the caller's own account, a logo that
 * is not an `active` or `in_review` one of the account of the entry; no line is written then.
 */
export async function readReviewLogo(
  tx: Transaction,
  entryId: string,
  logoId: string,
): Promise<ReviewLogoObject | null> {
  const rows = await tx.execute<{
    state: "active" | "in_review";
    object_key: string;
    byte_size: number | null;
    width: number | null;
    height: number | null;
    updated_at: string;
  }>(sql`
    select r.state, r.object_key, r.byte_size, r.width::integer as width,
           r.height::integer as height,
           to_char(r.updated_at at time zone 'UTC', ${ISO_UTC}) as updated_at
      from profiles.read_advertiser_review_logo(${entryId}::uuid, ${logoId}::uuid) r`);
  const row = rows[0];
  return row === undefined
    ? null
    : {
        state: row.state,
        objectKey: row.object_key,
        byteSize: row.byte_size,
        width: row.width,
        height: row.height,
        updatedAt: row.updated_at,
      };
}
