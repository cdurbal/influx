// Database access of queue 9 of the backoffice, « sélection par l'équipe INFLUX » (`team_selection`): the list,
// the counters, the request and the four doors of the claim (docs/mvp/10 RG61, RG84; 15 RG26 to RG28, RG33,
// RG34, RG36, C1 to C3, C5, AL23; 17b §2, I13; jalons/l3g/modele.md §5, §8; migrations 0325, 0330), under
// influx_agent or influx_admin in aal2 (03 §1.3). Parameterised queries only (S-1).
// - The reads are direct: `search.selection_requests` has a SELECT of columns for the agents and the
//   administrators and a policy in aal2 (0330 §4). No other right is taken: the brand (`legal_name`), the
//   campaign (`title`) and the accounts are read with the rights the other queues use.
// - A request of a brand the caller HOLDS (`identity.accounts.owner_agent_id`) is left out of every read here,
//   the list, the counters, the next one and AL23 (15 RG36, EC-L3G-06-5): the database does not hide it from
//   the list, and refuses its opening (42501).
// - The writes are the four doors of 0330 (SECURITY DEFINER, owned by influx_agent_search_definer): they
//   lock what they decide, check the live claim of the caller and write the register in ONE transaction.
//   Nothing here updates a table, writes to the outbox, to `matching.*` nor to a creator (D45, RG8).
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import {
  pageOf,
  type Cursor,
  type ListFilters,
} from "../creator-queues/lists/repository.ts";
import { ISO_UTC } from "../sql-formats.ts";

export { pageOf, type Cursor, type ListFilters };

/** The cursor keeps the microseconds: two requests of the same millisecond stay apart. */
const ISO_UTC_MICRO = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';

type Instant = string | null;
type NamedRef = { accountId: string; displayName: string | null };

function refOf(id: string | null, name: string | null): NamedRef | null {
  return id === null ? null : { accountId: id, displayName: name };
}

/** The code of the queue in `backoffice.sla_policies` (0325). */
const QUEUE_CODE = "team_selection";

// ---------------------------------------------------------------------------------------------
// Counters (15 RG28, RG32)
// ---------------------------------------------------------------------------------------------

export type TeamSelectionCountersRow = {
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

/** The permanent counters of queue 9, as the caller sees it (RG36), with its delay (RG38). */
export async function readTeamSelectionCounters(
  tx: Transaction,
  caller: string,
): Promise<TeamSelectionCountersRow | null> {
  const visible = sql`r.state = 'open' and a.owner_agent_id is distinct from ${caller}::uuid`;
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
           (select count(*)::int from search.selection_requests r
              join identity.accounts a on a.id = r.advertiser_account_id
             where ${visible}) as pending,
           (select to_char(min(r.created_at) at time zone 'UTC', ${ISO_UTC})
              from search.selection_requests r
              join identity.accounts a on a.id = r.advertiser_account_id
             where ${visible}) as oldest,
           (select count(*)::int from search.selection_requests r
              join identity.accounts a on a.id = r.advertiser_account_id
             where ${visible} and r.sla_due_at < now()) as overdue,
           (select count(*)::int from search.selection_requests r
              join identity.accounts a on a.id = r.advertiser_account_id
             where ${visible}
               and (r.claimed_by_account_id is null or r.claim_expires_at <= now())) as unclaimed,
           (select to_char(max(r.closed_at) at time zone 'UTC', ${ISO_UTC})
              from search.selection_requests r
              join identity.accounts a on a.id = r.advertiser_account_id
             where r.state = 'closed'
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
 * The requests a list reads, oldest deadline first (C5), for the caller: open, never of a brand he holds
 * (RG36), and the filters of RG33 queue 9 applies. No filter is added without the project manager.
 */
export function teamSelectionConditionsOf(
  filters: ListFilters,
  caller: string,
): SQL[] {
  const live = sql`r.claimed_by_account_id is not null and r.claim_expires_at > now()`;
  const conditions: SQL[] = [
    sql`r.state = 'open'`,
    // 15 RG36, 13 RG35: a request of a brand the caller holds is masked from him
    sql`a.owner_agent_id is distinct from ${caller}::uuid`,
  ];
  if (filters.overdue === true) {
    conditions.push(sql`r.sla_due_at < now()`);
  }
  if (filters.holder === "free") {
    conditions.push(sql`not (${live})`);
  } else if (filters.holder !== undefined) {
    const holder = filters.holder === "me" ? caller : filters.holder;
    conditions.push(
      sql`(${live}) and r.claimed_by_account_id = ${holder}::uuid`,
    );
  }
  if (filters.from !== undefined) {
    conditions.push(sql`r.created_at >= ${filters.from}::timestamptz`);
  }
  if (filters.to !== undefined) {
    conditions.push(sql`r.created_at <= ${filters.to}::timestamptz`);
  }
  if (filters.after !== undefined) {
    conditions.push(
      sql`(r.sla_due_at, r.created_at, r.id) >
          (${filters.after.dueAt}::timestamptz, ${filters.after.createdAt}::timestamptz,
           ${filters.after.id}::uuid)`,
    );
  }
  return conditions;
}

// ---------------------------------------------------------------------------------------------
// The requests
// ---------------------------------------------------------------------------------------------

export type ListedTeamSelectionRequest = {
  id: string;
  advertiserAccountId: string;
  brandName: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  language: string;
  createdAt: string;
  slaDueAt: string;
  overdue: boolean;
  owner: NamedRef | null;
  held: boolean;
  holder: NamedRef | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
  cursor: Cursor;
};

type ListRow = {
  id: string;
  advertiser_account_id: string;
  brand_name: string | null;
  campaign_id: string | null;
  campaign_title: string | null;
  language: string;
  created_at: string;
  sla_due_at: string;
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
};

async function listTeamSelectionRequests(
  tx: Transaction,
  caller: string,
  filters: ListFilters,
  limit: number,
): Promise<ListedTeamSelectionRequest[]> {
  const rows = await tx.execute<ListRow>(sql`
    select r.id::text as id, r.advertiser_account_id::text as advertiser_account_id,
           p.legal_name as brand_name, r.campaign_id::text as campaign_id, c.title as campaign_title,
           r.language::text as language,
           to_char(r.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(r.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           (r.sla_due_at < now()) as overdue,
           to_char(r.sla_due_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_due,
           to_char(r.created_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_created,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           (r.claimed_by_account_id is not null and r.claim_expires_at > now()) as held,
           r.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(r.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(r.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at
      from search.selection_requests r
      join identity.accounts a on a.id = r.advertiser_account_id
      left join profiles.advertiser_profiles p on p.account_id = r.advertiser_account_id
      left join campaigns.campaigns c on c.id = r.campaign_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = r.claimed_by_account_id
     where ${sql.join(teamSelectionConditionsOf(filters, caller), sql` and `)}
     order by r.sla_due_at, r.created_at, r.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    advertiserAccountId: row.advertiser_account_id,
    brandName: row.brand_name,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title,
    language: row.language,
    createdAt: row.created_at,
    slaDueAt: row.sla_due_at,
    overdue: row.overdue,
    owner: refOf(row.owner_id, row.owner_name),
    held: row.held,
    holder: row.held ? refOf(row.holder_id, row.holder_name) : null,
    claimedAt: row.held ? row.claimed_at : null,
    claimExpiresAt: row.held ? row.claim_expires_at : null,
    cursor: {
      dueAt: row.cursor_due,
      createdAt: row.cursor_created,
      id: row.id,
    },
  }));
}

/** The page of the list (15 RG34): the page logic of queues 2, 3 and 7, without an alert filter. */
export function listTeamSelectionRequestsPage(
  tx: Transaction,
  caller: string,
  filters: ListFilters,
  limit: number,
) {
  return pageOf(
    (page, size) => listTeamSelectionRequests(tx, caller, page, size),
    filters,
    limit,
    null,
  );
}

/**
 * 17b §2.6: the request to open after a closure: oldest deadline first, ties by entry into the queue, among
 * the open ones nobody holds, never one of a brand the caller holds (RG36). Null when none.
 */
export async function nextTeamSelectionRequestId(
  tx: Transaction,
  caller: string,
): Promise<string | null> {
  const rows = await tx.execute<{ id: string }>(sql`
    select r.id::text as id
      from search.selection_requests r
      join identity.accounts a on a.id = r.advertiser_account_id
     where ${sql.join(teamSelectionConditionsOf({ holder: "free" }, caller), sql` and `)}
     order by r.sla_due_at, r.created_at, r.id
     limit 1`);
  return rows[0]?.id ?? null;
}

/**
 * The brand behind a request, and who holds it: null for an unknown request. `heldBy` is the live claim's
 * holder, null when free or expired. The doors decide the refusals; this only lets the route answer a
 * release the way the other doors answer (T14: unknown, or a brand the caller holds, one answer).
 */
export async function teamSelectionTargetOf(
  tx: Transaction,
  requestId: string,
): Promise<{
  ownerAgentId: string | null;
  heldBy: string | null;
} | null> {
  const rows = await tx.execute<{
    owner_agent_id: string | null;
    held_by: string | null;
  }>(sql`
    select a.owner_agent_id::text as owner_agent_id,
           case when r.claim_expires_at > now() then r.claimed_by_account_id::text end as held_by
      from search.selection_requests r
      join identity.accounts a on a.id = r.advertiser_account_id
     where r.id = ${requestId}::uuid`);
  const row = rows[0];
  return row === undefined
    ? null
    : { ownerAgentId: row.owner_agent_id, heldBy: row.held_by };
}

export type TeamSelectionRequestRow = {
  asOf: string;
  id: string;
  advertiserAccountId: string;
  brandName: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  language: string;
  filters: unknown;
  message: string | null;
  state: "open" | "closed";
  createdAt: string;
  slaDueAt: string;
  overdue: boolean;
  closedAt: Instant;
  closedBy: NamedRef | null;
  closeReasonCode: string | null;
  closeNote: string | null;
};

/** The request as the agent reads it once opened; null when it cannot be read (never for an opened one). */
export async function readTeamSelectionRequest(
  tx: Transaction,
  requestId: string,
): Promise<TeamSelectionRequestRow | null> {
  const rows = await tx.execute<{
    as_of: string;
    id: string;
    advertiser_account_id: string;
    brand_name: string | null;
    campaign_id: string | null;
    campaign_title: string | null;
    language: string;
    filters: unknown;
    message: string | null;
    state: "open" | "closed";
    created_at: string;
    sla_due_at: string;
    overdue: boolean;
    closed_at: Instant;
    closed_by: string | null;
    closed_by_name: string | null;
    close_reason_code: string | null;
    close_note: string | null;
  }>(sql`
    select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of,
           r.id::text as id, r.advertiser_account_id::text as advertiser_account_id,
           p.legal_name as brand_name, r.campaign_id::text as campaign_id, c.title as campaign_title,
           r.language::text as language, r.filters, r.message, r.state,
           to_char(r.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(r.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           (r.state = 'open' and r.sla_due_at < now()) as overdue,
           to_char(r.closed_at at time zone 'UTC', ${ISO_UTC}) as closed_at,
           r.closed_by_account_id::text as closed_by, cb.display_name as closed_by_name,
           r.close_reason_code, r.close_note
      from search.selection_requests r
      left join profiles.advertiser_profiles p on p.account_id = r.advertiser_account_id
      left join campaigns.campaigns c on c.id = r.campaign_id
      left join identity.accounts cb on cb.id = r.closed_by_account_id
     where r.id = ${requestId}::uuid`);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    asOf: row.as_of,
    id: row.id,
    advertiserAccountId: row.advertiser_account_id,
    brandName: row.brand_name,
    campaignId: row.campaign_id,
    campaignTitle: row.campaign_title,
    language: row.language,
    filters: row.filters,
    message: row.message,
    state: row.state,
    createdAt: row.created_at,
    slaDueAt: row.sla_due_at,
    overdue: row.overdue,
    closedAt: row.closed_at,
    closedBy: refOf(row.closed_by, row.closed_by_name),
    closeReasonCode: row.close_reason_code,
    closeNote: row.close_note,
  };
}

/** AL23 (15 §F): the open requests of the caller's view left past their deadline, and the oldest deadline. */
export async function readOverdueTeamSelection(
  tx: Transaction,
  caller: string,
): Promise<{ count: number; since: string | null }> {
  const [row] = await tx.execute<{ count: number; since: string | null }>(sql`
    select count(*)::int as count,
           to_char(min(r.sla_due_at) at time zone 'UTC', ${ISO_UTC}) as since
      from search.selection_requests r
      join identity.accounts a on a.id = r.advertiser_account_id
     where r.state = 'open' and r.sla_due_at < now()
       and a.owner_agent_id is distinct from ${caller}::uuid`);
  return { count: row?.count ?? 0, since: row?.since ?? null };
}

// ---------------------------------------------------------------------------------------------
// The doors of the claim (0330)
// ---------------------------------------------------------------------------------------------

export type TeamSelectionOpeningRow = {
  outcome: "claimed" | "held" | "read_only" | "closed";
  holderAccountId: string | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
};

/**
 * 15 C1, C2: opening is taking. The database decides in one conditional UPDATE and journals the opening
 * (`queue.entry_opened`, with the queue code). 42501 for an unknown request or an open one of a brand the
 * caller holds.
 */
export async function openTeamSelectionRequest(
  tx: Transaction,
  requestId: string,
): Promise<TeamSelectionOpeningRow> {
  const rows = await tx.execute<{
    outcome: TeamSelectionOpeningRow["outcome"];
    holder_account_id: string | null;
    claimed_at: Instant;
    claim_expires_at: Instant;
  }>(sql`
    select o.outcome, o.holder_account_id::text as holder_account_id,
           to_char(o.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(o.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at
      from search.open_team_selection_request(${requestId}::uuid) o`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("the opening of queue 9 returned no row");
  }
  return {
    outcome: row.outcome,
    holderAccountId: row.holder_account_id,
    claimedAt: row.claimed_at,
    claimExpiresAt: row.claim_expires_at,
  };
}

/** 15 C3: the holder gives the request back to the queue. */
export async function releaseTeamSelectionRequest(
  tx: Transaction,
  requestId: string,
): Promise<void> {
  await tx.execute(
    sql`select search.release_team_selection_request(${requestId}::uuid)`,
  );
}

/** file.md A9: the holder takes the delay again; the new expiry. */
export async function extendTeamSelectionClaim(
  tx: Transaction,
  requestId: string,
): Promise<string> {
  const rows = await tx.execute<{ expires: string }>(sql`
    select to_char(search.extend_team_selection_claim(${requestId}::uuid) at time zone 'UTC',
                   ${ISO_UTC}) as expires`);
  const expires = rows[0]?.expires;
  if (expires === undefined) {
    throw new Error("the extension of queue 9 returned no instant");
  }
  return expires;
}

/** 17b I13: the closure with a reason of the closed list; the note for `other` alone. Returns the instant. */
export async function closeTeamSelectionRequest(
  tx: Transaction,
  requestId: string,
  reasonCode: string,
  note: string | null,
): Promise<string> {
  const rows = await tx.execute<{ closed_at: string }>(sql`
    select to_char(search.close_team_selection_request(${requestId}::uuid, ${reasonCode}::text,
                                                       ${note}::text) at time zone 'UTC',
                   ${ISO_UTC}) as closed_at`);
  const closedAt = rows[0]?.closed_at;
  if (closedAt === undefined) {
    throw new Error("the closure of queue 9 returned no instant");
  }
  return closedAt;
}
