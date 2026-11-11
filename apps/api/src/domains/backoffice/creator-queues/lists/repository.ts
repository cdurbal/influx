// Database access of the lists and the counters of queues 2 and 3 of the backoffice, « profils créateur à
// valider » (`profiles_creator`) and « visuels de portfolio à modérer » (`portfolio_moderation`) (docs/mvp/
// 07 RG93, RG94; 15 RG26 to RG28, RG33, RG34, RG36, C5; 17b §2.7; jalons/l2g/modele.md §1 points 1, 2,
// §2; migrations 0242, 0243, 0244), under influx_agent or influx_admin in aal2 (03 §1.3). Parameterised
// queries only (S-1).
// - The policies of 0242 and 0243 hide the entries and the visuals of the caller's own account; the
//   accounts the caller HOLDS (identity.accounts.owner_agent_id) are left out of every read below too
//   (15 RG36, 13 RG35): the database does not hide them, so the filter is here, as for queue 1.
// - The list carries no coordinate, no handle, no link, no figure and no caption: the texts that the
//   alerts examine are read (a proposal replaces the live text) and handed to `alerts.ts`, which keeps
//   the kind of signal and forgets the text. NO thumbnail in queue 3 (D82 (7)).
// - Nothing here writes: the opening is a database function of 0244 (acts.ts).
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";
import { ISO_UTC } from "../../sql-formats.ts";
import type { ExaminedTexts } from "../alerts.ts";

export type CreatorQueue = "profiles_creator" | "portfolio_moderation";

/** The cursor keeps the microseconds: two entries of the same millisecond stay apart. */
const ISO_UTC_MICRO = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';

/** Past this many lines read for one page with the alert filter, the page stops short (RG34). */
export const ALERT_SCAN_LIMIT = 2000;
const ALERT_SCAN_BATCH = 100;

type Instant = string | null;
type NamedRef = { accountId: string; displayName: string | null };

export type Cursor = { dueAt: string; createdAt: string; id: string };

export type ListFilters = {
  /** Queue 2: `submission` or `revision`; queue 3: `deposit` or `replacement`. */
  kind?: string;
  country?: string;
  network?: string;
  badge?: "with" | "without";
  account?: string;
  overdue?: boolean;
  /** `free`, `me`, or the account id of a named agent. */
  holder?: string;
  /** `none`, or the account id of the responsible salesperson. */
  owner?: string;
  from?: string;
  to?: string;
  after?: Cursor;
};

/** What differs between the two queues, as fragments of SQL over the alias `e` (the entry). */
const SPECS = {
  profiles_creator: {
    entries: sql`profiles.creator_review_entries e`,
    open: sql`e.state = 'open'`,
    queuedAt: sql`e.created_at`,
    decided: sql`e.state in ('published', 'rejected')`,
  },
  portfolio_moderation: {
    // the entry IS the visual (modele point 2): it waits while it is pending
    entries: sql`profiles.portfolio_items e`,
    open: sql`e.state = 'pending'`,
    queuedAt: sql`e.stored_at`,
    decided: sql`e.decided_at is not null`,
  },
} as const;

function refOf(id: string | null, name: string | null): NamedRef | null {
  return id === null ? null : { accountId: id, displayName: name };
}

// ---------------------------------------------------------------------------------------------
// The opaque cursor (the twin of queue 1's, kept here to leave its routes untouched)
// ---------------------------------------------------------------------------------------------

const INSTANT_MICRO = "\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{6}Z";
const CURSOR_PATTERN = new RegExp(
  `^(${INSTANT_MICRO})\\|(${INSTANT_MICRO})\\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,
);

/** The opaque cursor: the sort key of the last line (deadline, entry into the queue, id), microseconds kept. */
export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(
    `${cursor.dueAt}|${cursor.createdAt}|${cursor.id}`,
    "utf8",
  ).toString("base64url");
}

export function decodeCursor(cursor: string): Cursor | null {
  const match = CURSOR_PATTERN.exec(
    Buffer.from(cursor, "base64url").toString("utf8"),
  );
  if (
    match === null ||
    match[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined
  ) {
    return null;
  }
  return { dueAt: match[1], createdAt: match[2], id: match[3] };
}

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

/** The permanent counters of a queue, as the caller sees it (RG36), with its delay (RG38). */
export async function readCounters(
  tx: Transaction,
  queue: CreatorQueue,
  caller: string,
): Promise<CountersRow | null> {
  const spec = SPECS[queue];
  const visible = sql`${spec.open} and a.owner_agent_id is distinct from ${caller}::uuid`;
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
           (select count(*)::int from ${spec.entries}
              join identity.accounts a on a.id = e.account_id
             where ${visible}) as pending,
           (select to_char(min(${spec.queuedAt}) at time zone 'UTC', ${ISO_UTC})
              from ${spec.entries}
              join identity.accounts a on a.id = e.account_id
             where ${visible}) as oldest,
           (select count(*)::int from ${spec.entries}
              join identity.accounts a on a.id = e.account_id
             where ${visible} and e.sla_due_at < now()) as overdue,
           (select count(*)::int from ${spec.entries}
              join identity.accounts a on a.id = e.account_id
             where ${visible}
               and (e.claimed_by_account_id is null or e.claim_expires_at <= now())) as unclaimed,
           (select to_char(max(e.decided_at) at time zone 'UTC', ${ISO_UTC})
              from ${spec.entries}
              join identity.accounts a on a.id = e.account_id
             where ${spec.decided}
               and a.owner_agent_id is distinct from ${caller}::uuid) as last_decided,
           p.target_decision_minutes as decision_minutes,
           p.target_claim_minutes as claim_target_minutes,
           p.escalate_after_minutes,
           (p.business_hours is not null) as business_hours
      from backoffice.sla_policies p
     where p.queue_code = ${queue} and p.is_active`);
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
// The conditions of a list (15 RG26, RG27 C5, RG33)
// ---------------------------------------------------------------------------------------------

/**
 * The entries a list reads, oldest deadline first (C5), for the caller: waiting, never of an account he
 * holds (RG36), and the filters of 15 RG33 and 17b §2.7. A filter that makes no sense for a queue is
 * left out by its contract (kind, network, badge: queue 2; account: queue 3).
 */
export function conditionsOf(
  queue: CreatorQueue,
  filters: ListFilters,
  caller: string,
): SQL[] {
  const spec = SPECS[queue];
  const live = sql`e.claimed_by_account_id is not null and e.claim_expires_at > now()`;
  const conditions: SQL[] = [
    spec.open,
    // 15 RG36, 13 RG35: an entry of an account the caller holds is masked from him
    sql`a.owner_agent_id is distinct from ${caller}::uuid`,
  ];
  if (filters.kind !== undefined) {
    conditions.push(
      queue === "profiles_creator"
        ? sql`e.kind = ${filters.kind}::profiles.review_entry_kind`
        : filters.kind === "deposit"
          ? sql`e.replaces_item_id is null`
          : sql`e.replaces_item_id is not null`,
    );
  }
  if (filters.country !== undefined) {
    conditions.push(sql`a.country_code = ${filters.country}`);
  }
  if (filters.network !== undefined) {
    conditions.push(
      sql`exists (select 1 from profiles.creator_social_accounts n
                   where n.account_id = e.account_id and n.network_code = ${filters.network})`,
    );
  }
  if (filters.badge !== undefined) {
    const badged = sql`exists (select 1 from verification.badges b
                                where b.account_id = e.account_id
                                  and b.state in ('active', 'to_refresh')
                                  and b.level <> 'brand_verified')`;
    conditions.push(filters.badge === "with" ? badged : sql`not ${badged}`);
  }
  if (filters.account !== undefined) {
    conditions.push(sql`e.account_id = ${filters.account}::uuid`);
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
    conditions.push(sql`${spec.queuedAt} >= ${filters.from}::timestamptz`);
  }
  if (filters.to !== undefined) {
    conditions.push(sql`${spec.queuedAt} <= ${filters.to}::timestamptz`);
  }
  if (filters.after !== undefined) {
    conditions.push(
      sql`(e.sla_due_at, ${spec.queuedAt}, e.id) >
          (${filters.after.dueAt}::timestamptz, ${filters.after.createdAt}::timestamptz,
           ${filters.after.id}::uuid)`,
    );
  }
  return conditions;
}

// ---------------------------------------------------------------------------------------------
// Queue 2: the entries (17b §2.7 line 2)
// ---------------------------------------------------------------------------------------------

export type ListedCreatorEntry = {
  id: string;
  accountId: string;
  kind: "submission" | "revision";
  createdAt: string;
  slaDueAt: string;
  escalateAt: Instant;
  overdue: boolean;
  alias: string;
  countryCode: string;
  networks: string[];
  badges: { networkCode: string; level: string }[];
  completenessPercent: number | null;
  modifiedFields: string[];
  owner: NamedRef | null;
  held: boolean;
  holder: NamedRef | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
  /** The texts the moderator examines (a proposal replaces the live text); never served. */
  examined: ExaminedTexts;
  cursor: Cursor;
};

type CreatorListRow = {
  id: string;
  account_id: string;
  kind: "submission" | "revision";
  created_at: string;
  sla_due_at: string;
  escalate_at: Instant;
  overdue: boolean;
  cursor_due: string;
  cursor_created: string;
  alias: string;
  country_code: string;
  networks: string[];
  badges: { networkCode: string; level: string }[];
  completeness_percent: number | null;
  modified_fields: string[];
  owner_id: string | null;
  owner_name: string | null;
  held: boolean;
  holder_id: string | null;
  holder_name: string | null;
  claimed_at: Instant;
  claim_expires_at: Instant;
  examined_headline: string | null;
  examined_bio: string | null;
  examined_captions: (string | null)[];
};

async function listCreatorEntries(
  tx: Transaction,
  caller: string,
  filters: ListFilters,
  limit: number,
): Promise<ListedCreatorEntry[]> {
  const rows = await tx.execute<CreatorListRow>(sql`
    select e.id::text as id, e.account_id::text as account_id, e.kind::text as kind,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.sla_due_at < now()) as overdue,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_due,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_created,
           p.alias, a.country_code::text as country_code,
           coalesce((select jsonb_agg(n.network_code::text order by n.is_primary desc, n.network_code)
                       from profiles.creator_social_accounts n
                      where n.account_id = e.account_id), '[]'::jsonb) as networks,
           coalesce((select jsonb_agg(jsonb_build_object('networkCode', b.network_code::text,
                                                         'level', b.level::text)
                                      order by b.network_code, b.level::text)
                       from verification.badges b
                      where b.account_id = e.account_id and b.state in ('active', 'to_refresh')
                        and b.level <> 'brand_verified'), '[]'::jsonb) as badges,
           i.completeness_percent::int as completeness_percent,
           coalesce((select jsonb_agg(substr(r.field_code, 9) order by r.field_code)
                       from profiles.creator_field_revisions r
                      where r.creator_review_entry_id = e.id and r.status = 'pending_review'),
                    '[]'::jsonb) as modified_fields,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           (e.claimed_by_account_id is not null and e.claim_expires_at > now()) as held,
           e.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(e.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(e.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           x.headline as examined_headline, x.bio as examined_bio,
           x.captions as examined_captions
      from profiles.creator_review_entries e
      join profiles.creator_public_profiles p on p.account_id = e.account_id
      join identity.accounts a on a.id = e.account_id
      left join profiles.creator_identities i on i.account_id = e.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
      cross join lateral (
        -- 07 RG9: a pending proposal replaces the live text for the examination
        select coalesce((select r.proposed_value #>> '{}'
                           from profiles.creator_field_revisions r
                          where r.creator_review_entry_id = e.id and r.status = 'pending_review'
                            and r.field_code = 'creator.headline'), p.headline) as headline,
               coalesce((select r.proposed_value #>> '{}'
                           from profiles.creator_field_revisions r
                          where r.creator_review_entry_id = e.id and r.status = 'pending_review'
                            and r.field_code = 'creator.bio'), p.bio) as bio,
               coalesce((select jsonb_agg(
                                  coalesce((select r.proposed_value ->> 'caption'
                                              from profiles.creator_field_revisions r
                                             where r.creator_review_entry_id = e.id
                                               and r.status = 'pending_review'
                                               and r.field_code = 'creator.portfolio_caption'
                                               and r.row_key = v.id::text), v.caption))
                          from profiles.portfolio_items v
                         where v.account_id = e.account_id and v.state in ('pending', 'approved')),
                        '[]'::jsonb) as captions
      ) x
     where ${sql.join(conditionsOf("profiles_creator", filters, caller), sql` and `)}
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
    alias: row.alias,
    countryCode: row.country_code,
    networks: row.networks,
    badges: row.badges,
    completenessPercent: row.completeness_percent,
    modifiedFields: row.modified_fields,
    owner: refOf(row.owner_id, row.owner_name),
    held: row.held,
    holder: row.held ? refOf(row.holder_id, row.holder_name) : null,
    claimedAt: row.held ? row.claimed_at : null,
    claimExpiresAt: row.held ? row.claim_expires_at : null,
    examined: {
      headline: row.examined_headline,
      bio: row.examined_bio,
      captions: row.examined_captions,
    },
    cursor: {
      dueAt: row.cursor_due,
      createdAt: row.cursor_created,
      id: row.id,
    },
  }));
}

// ---------------------------------------------------------------------------------------------
// Queue 3: the visuals (17b §2.7 line 3), no thumbnail
// ---------------------------------------------------------------------------------------------

export type ListedPortfolioEntry = {
  id: string;
  accountId: string;
  alias: string;
  kind: "deposit" | "replacement";
  createdAt: string;
  slaDueAt: string;
  escalateAt: Instant;
  overdue: boolean;
  visualCount: number;
  owner: NamedRef | null;
  held: boolean;
  holder: NamedRef | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
  /** The caption the moderator examines; never served. */
  examined: ExaminedTexts;
  cursor: Cursor;
};

type PortfolioListRow = {
  id: string;
  account_id: string;
  alias: string;
  kind: "deposit" | "replacement";
  created_at: string;
  sla_due_at: string;
  escalate_at: Instant;
  overdue: boolean;
  cursor_due: string;
  cursor_created: string;
  visual_count: number;
  owner_id: string | null;
  owner_name: string | null;
  held: boolean;
  holder_id: string | null;
  holder_name: string | null;
  claimed_at: Instant;
  claim_expires_at: Instant;
  caption: string | null;
};

async function listPortfolioEntries(
  tx: Transaction,
  caller: string,
  filters: ListFilters,
  limit: number,
): Promise<ListedPortfolioEntry[]> {
  const rows = await tx.execute<PortfolioListRow>(sql`
    select e.id::text as id, e.account_id::text as account_id, p.alias,
           case when e.replaces_item_id is null then 'deposit' else 'replacement' end as kind,
           to_char(e.stored_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.sla_due_at < now()) as overdue,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_due,
           to_char(e.stored_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_created,
           -- 07 RG4, RG88: the visuals that count as deposited (a pending replacement shares the
           -- place of its approved original)
           (select count(*)::int from profiles.portfolio_items v
             where v.account_id = e.account_id and v.state in ('pending', 'approved')
               and not (v.state = 'pending'
                        and exists (select 1 from profiles.portfolio_items o
                                     where o.id = v.replaces_item_id and o.state = 'approved'))
           ) as visual_count,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           (e.claimed_by_account_id is not null and e.claim_expires_at > now()) as held,
           e.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(e.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(e.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           e.caption
      from profiles.portfolio_items e
      join profiles.creator_public_profiles p on p.account_id = e.account_id
      join identity.accounts a on a.id = e.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
     where ${sql.join(conditionsOf("portfolio_moderation", filters, caller), sql` and `)}
     order by e.sla_due_at, e.stored_at, e.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    alias: row.alias,
    kind: row.kind,
    createdAt: row.created_at,
    slaDueAt: row.sla_due_at,
    escalateAt: row.escalate_at,
    overdue: row.overdue,
    visualCount: row.visual_count,
    owner: refOf(row.owner_id, row.owner_name),
    held: row.held,
    holder: row.held ? refOf(row.holder_id, row.holder_name) : null,
    claimedAt: row.held ? row.claimed_at : null,
    claimExpiresAt: row.held ? row.claim_expires_at : null,
    examined: { headline: null, bio: null, captions: [row.caption] },
    cursor: {
      dueAt: row.cursor_due,
      createdAt: row.cursor_created,
      id: row.id,
    },
  }));
}

// ---------------------------------------------------------------------------------------------
// The page (15 RG34), with the alert filter when asked (15 RG33)
// ---------------------------------------------------------------------------------------------

/**
 * The page of a list. The alerts are computed in code (packages/domain), so with the alert filter the
 * lines are read in batches and kept when they carry one, until the page and one more are found, the
 * queue is exhausted, or ALERT_SCAN_LIMIT lines were read. Without it, one read of `limit + 1`.
 * `resumeAfter` is where the next page starts, null at the end.
 */
async function pageOf<T extends { cursor: Cursor }>(
  fetch: (filters: ListFilters, limit: number) => Promise<T[]>,
  filters: ListFilters,
  limit: number,
  hasAlert: ((entry: T) => boolean) | null,
): Promise<{ items: T[]; resumeAfter: Cursor | null }> {
  if (hasAlert === null) {
    const rows = await fetch(filters, limit + 1);
    const items = rows.slice(0, limit);
    return {
      items,
      resumeAfter: rows.length > limit ? (items.at(-1)?.cursor ?? null) : null,
    };
  }
  const kept: T[] = [];
  let scanned = 0;
  let after = filters.after;
  while (scanned < ALERT_SCAN_LIMIT) {
    const batch = await fetch(
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

export function listCreatorEntriesPage(
  tx: Transaction,
  caller: string,
  filters: ListFilters,
  limit: number,
  hasAlert: ((entry: ListedCreatorEntry) => boolean) | null,
) {
  return pageOf(
    (page, size) => listCreatorEntries(tx, caller, page, size),
    filters,
    limit,
    hasAlert,
  );
}

export function listPortfolioEntriesPage(
  tx: Transaction,
  caller: string,
  filters: ListFilters,
  limit: number,
  hasAlert: ((entry: ListedPortfolioEntry) => boolean) | null,
) {
  return pageOf(
    (page, size) => listPortfolioEntries(tx, caller, page, size),
    filters,
    limit,
    hasAlert,
  );
}

/**
 * 17b §2.6: the entry to open after a decision: oldest deadline first, ties by entry into the queue,
 * among the waiting ones nobody holds, never the caller's own account nor one he holds (RG36). Null
 * when none.
 */
export async function nextEntryId(
  tx: Transaction,
  queue: CreatorQueue,
  caller: string,
): Promise<string | null> {
  const spec = SPECS[queue];
  const rows = await tx.execute<{ id: string }>(sql`
    select e.id::text as id
      from ${spec.entries}
      join identity.accounts a on a.id = e.account_id
     where ${sql.join(conditionsOf(queue, { holder: "free" }, caller), sql` and `)}
     order by e.sla_due_at, ${spec.queuedAt}, e.id
     limit 1`);
  return rows[0]?.id ?? null;
}

// ---------------------------------------------------------------------------------------------
// The target of an act, and the last forced release
// ---------------------------------------------------------------------------------------------

/**
 * The account behind an entry of a queue, and who holds it: null for an unknown entry, a visual still
 * uploading (no entry of queue 3) or the caller's own account (hidden by the policies of 0242, 0243).
 */
export async function entryAccountOf(
  tx: Transaction,
  queue: CreatorQueue,
  entryId: string,
): Promise<{ accountId: string; ownerAgentId: string | null } | null> {
  const rows = await tx.execute<{
    account_id: string;
    owner_agent_id: string | null;
  }>(
    queue === "profiles_creator"
      ? sql`
          select e.account_id::text as account_id, a.owner_agent_id::text as owner_agent_id
            from profiles.creator_review_entries e
            join identity.accounts a on a.id = e.account_id
           where e.id = ${entryId}::uuid`
      : sql`
          select e.account_id::text as account_id, a.owner_agent_id::text as owner_agent_id
            from profiles.portfolio_items e
            join identity.accounts a on a.id = e.account_id
           where e.id = ${entryId}::uuid and e.state <> 'uploading'`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { accountId: row.account_id, ownerAgentId: row.owner_agent_id };
}

/** Whether the last forced release of the entry dispossessed this agent (file.md A8). */
export async function wasDispossessed(
  tx: Transaction,
  queue: CreatorQueue,
  entryId: string,
  accountId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ dispossessed: boolean }>(
    queue === "profiles_creator"
      ? sql`
          select (forced_release_holder_account_id = ${accountId}::uuid) as dispossessed
            from profiles.creator_review_entries
           where id = ${entryId}::uuid and forced_release_at is not null`
      : sql`
          select (forced_release_holder_account_id = ${accountId}::uuid) as dispossessed
            from profiles.portfolio_items
           where id = ${entryId}::uuid and forced_release_at is not null`,
  );
  return rows[0]?.dispossessed === true;
}
