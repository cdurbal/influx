// Database access of queue 4, "vérifications", of the backoffice (docs/mvp/08 RG43 to RG67, RG84;
// 15 RG26 to RG28, RG33, RG34, RG36, C1 to C8; jalons/l2e/modele.md §3, §4, §6; 0221, 0224; l2e commit
// 14), under influx_agent or influx_admin in aal2 (03 §1.3). Parameterised queries only (S-1).
// - Reads go through the policies of 0221: a request of the caller's own account is not there (15
//   RG36, C(3)); the accounts the caller HOLDS (identity.accounts.owner_agent_id, 08 RG53) are left
//   out of every read below, the database does not hide them from a SELECT.
// - NO declared figure is read here (RG47, modele -19): the list and the dossier carry the line's
//   handle, pseudonym and address, the pieces as metadata, the history, and nothing the creator
//   typed as a number. No code either (EC-L2E-08-3), no key (the key of a piece comes from
//   verification.read_evidence(), which writes its register line in the same transaction).
// - The writes are the doors of 0224 (`verification.open_request()`, `release_request()`, …): the
//   claim, the token, the verrou and every rule live there, once. A refusal of a door is a database
//   error, said by its SQLSTATE, MESSAGE (the code) and DETAIL (the precision): refusals.ts reads it.
import type {
  VerificationQueueSort,
  VerificationQueueView,
} from "@influx/contracts/verification";
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { ISO_UTC } from "../sql-formats.ts";

/** The cursor keeps the microseconds: two entries of the same millisecond stay apart. */
const ISO_UTC_MICRO = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

type Instant = string | null;

/** A view of the queue is a population of the one table (D81). */
export const POPULATION_OF: Readonly<
  Record<VerificationQueueView, "creator" | "brand">
> = { creators: "creator", brands: "brand" };

export type Person = { accountId: string; displayName: string | null };

export type EntryFilters = {
  level?: string;
  network?: string;
  overdue?: boolean;
  /** `free`, `me`, or the account id of a named agent. */
  holder?: string;
  /** `none`, or the account id of the responsible salesperson. */
  owner?: string;
  from?: string;
  to?: string;
  alert?: boolean;
  reexamine?: boolean;
  after?: { primary: string; submittedAt: string; id: string };
};

// ---------------------------------------------------------------------------------------------
// Counters (15 RG28, RG32)
// ---------------------------------------------------------------------------------------------

export type CountersRow = {
  asOf: string;
  pending: number;
  oldestSubmittedAt: Instant;
  overdue: number;
  unclaimed: number;
  lastDecidedAt: Instant;
  decisionMinutes: number;
  claimTargetMinutes: number | null;
  escalateAfterMinutes: number | null;
  businessHours: boolean;
};

/** The permanent counters of one view, as the caller sees the queue (RG36), with its delay (RG65). */
export async function readCounters(
  tx: Transaction,
  caller: string,
  view: VerificationQueueView,
): Promise<CountersRow | null> {
  const population = POPULATION_OF[view];
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
           (select count(*)::int from verification.verification_requests r
              join identity.accounts a on a.id = r.account_id
             where r.status = 'pending' and r.population = ${population}
               and (a.owner_agent_id is distinct from ${caller}::uuid
                    or r.opened_by = 'agent')) as pending,
           (select to_char(min(r.submitted_at) at time zone 'UTC', ${ISO_UTC})
              from verification.verification_requests r
              join identity.accounts a on a.id = r.account_id
             where r.status = 'pending' and r.population = ${population}
               and (a.owner_agent_id is distinct from ${caller}::uuid
                    or r.opened_by = 'agent')) as oldest,
           (select count(*)::int from verification.verification_requests r
              join identity.accounts a on a.id = r.account_id
             where r.status = 'pending' and r.population = ${population}
               and r.sla_due_at < now()
               and (a.owner_agent_id is distinct from ${caller}::uuid
                    or r.opened_by = 'agent')) as overdue,
           (select count(*)::int from verification.verification_requests r
              join identity.accounts a on a.id = r.account_id
             where r.status = 'pending' and r.population = ${population}
               and (r.claimed_by_account_id is null or r.claim_expires_at <= now())
               and (a.owner_agent_id is distinct from ${caller}::uuid
                    or r.opened_by = 'agent')) as unclaimed,
           (select to_char(max(r.decided_at) at time zone 'UTC', ${ISO_UTC})
              from verification.verification_requests r
              join identity.accounts a on a.id = r.account_id
             where r.status in ('approved', 'rejected', 'closed')
               and r.population = ${population}
               and (a.owner_agent_id is distinct from ${caller}::uuid
                    or r.opened_by = 'agent')) as last_decided,
           p.target_decision_minutes as decision_minutes,
           p.target_claim_minutes as claim_target_minutes,
           p.escalate_after_minutes,
           (p.business_hours is not null) as business_hours
      from backoffice.sla_policies p
     where p.queue_code = 'verification' and p.is_active`);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    asOf: row.as_of,
    pending: row.pending,
    oldestSubmittedAt: row.oldest,
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
// The list (08 RG62, RG63; 15 RG26, RG27 C5, RG33, RG34)
// ---------------------------------------------------------------------------------------------

export type ListedEntry = {
  id: string;
  accountId: string;
  level: string;
  networkCode: string | null;
  displayName: string | null;
  countryCode: string;
  submittedAt: string;
  slaDueAt: string;
  escalateAt: string;
  overdue: boolean;
  owner: Person | null;
  held: boolean;
  holder: Person | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
  reexamine: { reasonCode: string; reexaminedAt: string } | null;
  priorRejections: boolean;
  sameHandleElsewhere: boolean;
  handleVerifiedElsewhere: boolean;
  /** Who opened the request (D83 A): `member` or `agent`. */
  openedBy: string;
  /** The sort key, for the cursor: the primary text, the submission to the microsecond, the id. */
  cursor: { primary: string; submittedAt: string; id: string };
};

type ListRow = {
  id: string;
  account_id: string;
  level: string;
  network_code: string | null;
  display_name: string | null;
  country_code: string;
  submitted_at: string;
  sla_due_at: string;
  escalate_at: string;
  overdue: boolean;
  owner_id: string | null;
  owner_name: string | null;
  held: boolean;
  holder_id: string | null;
  holder_name: string | null;
  claimed_at: Instant;
  claim_expires_at: Instant;
  reexamine_reason_code: string | null;
  reexamined_at: Instant;
  prior_rejections: boolean;
  same_handle: boolean;
  verified_elsewhere: boolean;
  opened_by: string;
  cursor_primary: string;
  cursor_submitted: string;
};

/** The text each sort orders by first (the second key is always the submission, then the id). */
function primaryKeyOf(sort: VerificationQueueSort): SQL {
  switch (sort) {
    case "age":
      return sql`to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC_MICRO})`;
    case "sla":
      return sql`to_char(r.sla_due_at at time zone 'UTC', ${ISO_UTC_MICRO})`;
    case "level":
      return sql`r.level::text`;
    case "network":
      return sql`coalesce(r.network_code, '')`;
  }
}

const SUBMITTED_KEY = sql`to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC_MICRO})`;

/** The same refusals of the same triplet inside the window of the cap (08 RG55, RG60). */
const PRIOR_REJECTIONS = sql`exists (
  select 1 from verification.verification_requests x
   where x.account_id = r.account_id and x.id <> r.id
     and coalesce(x.social_account_id, ${NIL_UUID}::uuid)
         = coalesce(r.social_account_id, ${NIL_UUID}::uuid)
     and x.level = r.level and x.status = 'rejected'
     and x.decided_at > now() - make_interval(days => coalesce(
           (select (s.value)::integer from backoffice.operational_settings s
             where s.key = 'rejection_cap_window_days'), 30)))`;

/** Edge case l. 800: another account declares the same handle on the same network. */
const SAME_HANDLE_ELSEWHERE = sql`(l.handle is not null and exists (
  select 1 from profiles.creator_social_accounts o2
   where o2.account_id <> r.account_id and o2.network_code = r.network_code
     and lower(ltrim(o2.handle, '@')) = lower(ltrim(l.handle, '@'))))`;

/** Edge case l. 800: a holding « Compte vérifié » of another account on that very handle. */
const HANDLE_VERIFIED_ELSEWHERE = sql`(l.handle is not null and exists (
  select 1 from verification.badges w
   where w.account_id <> r.account_id and w.network_code = r.network_code
     and w.level = 'account_verified' and w.state in ('active', 'to_refresh', 'to_reconfirm')
     and lower(ltrim(w.observed_handle_at_decision, '@')) = lower(ltrim(l.handle, '@'))))`;

function conditionsOf(
  filters: EntryFilters,
  caller: string,
  view: VerificationQueueView,
  sort: VerificationQueueSort,
): SQL[] {
  const live = sql`r.claimed_by_account_id is not null and r.claim_expires_at > now()`;
  const conditions: SQL[] = [
    sql`r.status = 'pending'`,
    sql`r.population = ${POPULATION_OF[view]}`,
    // 15 RG36, 08 RG53: a request of an account the caller holds is masked from him, but for one an
    // agent opened (D83 Q4: the responsible agent may validate his own client)
    sql`(a.owner_agent_id is distinct from ${caller}::uuid or r.opened_by = 'agent')`,
  ];
  if (filters.level !== undefined) {
    conditions.push(sql`r.level = ${filters.level}::verification.badge_level`);
  }
  if (filters.network !== undefined) {
    conditions.push(sql`r.network_code = ${filters.network}`);
  }
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
  if (filters.owner === "none") {
    conditions.push(sql`a.owner_agent_id is null`);
  } else if (filters.owner !== undefined) {
    conditions.push(sql`a.owner_agent_id = ${filters.owner}::uuid`);
  }
  if (filters.from !== undefined) {
    conditions.push(sql`r.submitted_at >= ${filters.from}::timestamptz`);
  }
  if (filters.to !== undefined) {
    conditions.push(sql`r.submitted_at <= ${filters.to}::timestamptz`);
  }
  if (filters.reexamine === true) {
    conditions.push(sql`r.reexamine_reason_code is not null`);
  }
  if (filters.alert === true) {
    conditions.push(
      sql`(al.prior_rejections or al.same_handle or al.verified_elsewhere)`,
    );
  }
  if (filters.after !== undefined) {
    conditions.push(
      sql`(${primaryKeyOf(sort)}, ${SUBMITTED_KEY}, r.id) >
          (${filters.after.primary}::text, ${filters.after.submittedAt}::text,
           ${filters.after.id}::uuid)`,
    );
  }
  return conditions;
}

/**
 * The entries of one view, in the order of `sort` (RG62): by default the oldest submission first.
 * At most `limit` lines. Nothing the creator declared as a figure, no handle: the alias of a
 * creator or the trading name of a brand names the line.
 */
export async function listEntries(
  tx: Transaction,
  caller: string,
  view: VerificationQueueView,
  sort: VerificationQueueSort,
  filters: EntryFilters,
  limit: number,
): Promise<ListedEntry[]> {
  const rows = await tx.execute<ListRow>(sql`
    select r.id::text as id, r.account_id::text as account_id, r.level::text as level,
           r.network_code,
           case when r.population = 'creator' then cp.alias else ap.legal_name end as display_name,
           a.country_code::text as country_code,
           to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           to_char(r.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(r.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (r.sla_due_at < now()) as overdue,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           (r.claimed_by_account_id is not null and r.claim_expires_at > now()) as held,
           r.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(r.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(r.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           r.reexamine_reason_code,
           to_char(r.reexamined_at at time zone 'UTC', ${ISO_UTC}) as reexamined_at,
           al.prior_rejections, al.same_handle, al.verified_elsewhere, r.opened_by,
           ${primaryKeyOf(sort)} as cursor_primary, ${SUBMITTED_KEY} as cursor_submitted
      from verification.verification_requests r
      join identity.accounts a on a.id = r.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = r.claimed_by_account_id
      left join profiles.creator_public_profiles cp
             on cp.account_id = r.account_id and r.population = 'creator'
      left join profiles.advertiser_profiles ap
             on ap.account_id = r.account_id and r.population = 'brand'
      left join profiles.creator_social_accounts l
             on l.id = r.social_account_id and l.account_id = r.account_id
      cross join lateral (
        select ${PRIOR_REJECTIONS} as prior_rejections,
               ${SAME_HANDLE_ELSEWHERE} as same_handle,
               ${HANDLE_VERIFIED_ELSEWHERE} as verified_elsewhere
      ) al
     where ${sql.join(conditionsOf(filters, caller, view, sort), sql` and `)}
     order by ${primaryKeyOf(sort)}, ${SUBMITTED_KEY}, r.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    level: row.level,
    networkCode: row.network_code,
    displayName: row.display_name,
    countryCode: row.country_code,
    submittedAt: row.submitted_at,
    slaDueAt: row.sla_due_at,
    escalateAt: row.escalate_at,
    overdue: row.overdue,
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
    reexamine:
      row.reexamine_reason_code !== null && row.reexamined_at !== null
        ? {
            reasonCode: row.reexamine_reason_code,
            reexaminedAt: row.reexamined_at,
          }
        : null,
    priorRejections: row.prior_rejections,
    sameHandleElsewhere: row.same_handle,
    handleVerifiedElsewhere: row.verified_elsewhere,
    openedBy: row.opened_by,
    cursor: {
      primary: row.cursor_primary,
      submittedAt: row.cursor_submitted,
      id: row.id,
    },
  }));
}

// ---------------------------------------------------------------------------------------------
// The target of an act, the opening (08 RG43, RG64) and the decision view
// ---------------------------------------------------------------------------------------------

export type RequestTarget = {
  accountId: string;
  /** The salesperson who holds the account (08 RG53): 0215 refuses him the examination. */
  ownerAgentId: string | null;
  population: "creator" | "brand";
  status: string;
  /** Who opened the request (D83 A): D83 Q4 lifts the refusal of a held account for `agent` only. */
  openedBy: string;
};

/**
 * The request an act names, and who holds its account: null for an unknown one, the caller's own
 * account (hidden by the policy, C(3)) and a draft, which is no entry of the queue (EC-L2E-08-10).
 */
export async function requestTargetOf(
  tx: Transaction,
  requestId: string,
): Promise<RequestTarget | null> {
  const rows = await tx.execute<{
    account_id: string;
    owner_agent_id: string | null;
    population: "creator" | "brand";
    status: string;
    opened_by: string;
  }>(sql`
    select r.account_id::text as account_id, a.owner_agent_id::text as owner_agent_id,
           r.population, r.status::text as status, r.opened_by
      from verification.verification_requests r
      join identity.accounts a on a.id = r.account_id
     where r.id = ${requestId}::uuid and r.status <> 'draft'`);
  const row = rows[0];
  return row === undefined
    ? null
    : {
        accountId: row.account_id,
        ownerAgentId: row.owner_agent_id,
        population: row.population,
        status: row.status,
        openedBy: row.opened_by,
      };
}

export type OpeningRow = {
  outcome: "claimed" | "held" | "read_only" | "closed";
  reviewToken: string | null;
};

/**
 * 08 RG43, RG64: opening is taking. The database decides in one conditional UPDATE and journals the
 * opening (`queue.entry_opened`). 42501 for an unknown request, a draft, the caller's own account or
 * an open request of an account he holds.
 */
export async function openRequest(
  tx: Transaction,
  requestId: string,
): Promise<OpeningRow> {
  const rows = await tx.execute<{
    outcome: OpeningRow["outcome"];
    review_token: string | null;
  }>(sql`
    select outcome, review_token from verification.open_request(${requestId}::uuid)`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.open_request() returned no row");
  }
  return { outcome: row.outcome, reviewToken: row.review_token };
}

export type EntryView = {
  asOf: string;
  entry: {
    id: string;
    level: string;
    networkCode: string | null;
    status: string;
    submittedAt: string;
    slaDueAt: string;
    escalateAt: string;
    overdue: boolean;
    held: boolean;
    holder: Person | null;
    claimedAt: Instant;
    claimExpiresAt: Instant;
    forcedRelease: {
      releasedAt: string;
      releasedBy: Person | null;
      holder: Person | null;
      reasonCode: string;
    } | null;
    reexamine: { reasonCode: string; reexaminedAt: string } | null;
    decision: {
      decidedAt: string;
      decidedBy: Person | null;
      late: boolean;
      status: string;
      reasonCode: string | null;
      memberMessage: string | null;
      internalComment: string | null;
    } | null;
  };
  account: {
    countryCode: string;
    preferredLanguage: "fr" | "en";
    owner: Person | null;
  };
};

type ViewRow = {
  as_of: string;
  id: string;
  level: string;
  network_code: string | null;
  status: string;
  submitted_at: string;
  sla_due_at: string;
  escalate_at: string;
  overdue: boolean;
  held: boolean;
  holder_id: string | null;
  holder_name: string | null;
  claimed_at: Instant;
  claim_expires_at: Instant;
  forced_at: Instant;
  forced_by_id: string | null;
  forced_by_name: string | null;
  forced_holder_id: string | null;
  forced_holder_name: string | null;
  forced_reason: string | null;
  reexamine_reason_code: string | null;
  reexamined_at: Instant;
  decided_at: Instant;
  decided_by_id: string | null;
  decided_by_name: string | null;
  sla_breached: boolean | null;
  rejection_reason_code: string | null;
  member_message: string | null;
  internal_comment: string | null;
  country_code: string;
  preferred_language: "fr" | "en";
  owner_id: string | null;
  owner_name: string | null;
};

function personOf(id: string | null, name: string | null): Person | null {
  return id === null ? null : { accountId: id, displayName: name };
}

/**
 * The entry as the database holds it NOW: read after the opening, so that it is no older than the
 * token of the opening. A request that is not an entry (unknown, draft, own account) gives null.
 */
export async function readEntryView(
  tx: Transaction,
  requestId: string,
): Promise<EntryView | null> {
  const rows = await tx.execute<ViewRow>(sql`
    select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of,
           r.id::text as id, r.level::text as level, r.network_code, r.status::text as status,
           to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           to_char(r.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(r.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (r.status = 'pending' and r.sla_due_at < now()) as overdue,
           (r.claimed_by_account_id is not null and r.claim_expires_at > now()) as held,
           r.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(r.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(r.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           to_char(r.forced_release_at at time zone 'UTC', ${ISO_UTC}) as forced_at,
           r.forced_release_by_account_id::text as forced_by_id, fb.display_name as forced_by_name,
           r.forced_release_holder_account_id::text as forced_holder_id,
           fh.display_name as forced_holder_name,
           r.forced_release_reason_code as forced_reason,
           r.reexamine_reason_code,
           to_char(r.reexamined_at at time zone 'UTC', ${ISO_UTC}) as reexamined_at,
           to_char(r.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           r.decided_by_account_id::text as decided_by_id, d.display_name as decided_by_name,
           r.sla_breached, r.rejection_reason_code, r.member_message, r.internal_comment,
           a.country_code::text as country_code, a.preferred_language::text as preferred_language,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name
      from verification.verification_requests r
      join identity.accounts a on a.id = r.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = r.claimed_by_account_id
      left join identity.accounts fb on fb.id = r.forced_release_by_account_id
      left join identity.accounts fh on fh.id = r.forced_release_holder_account_id
      left join identity.accounts d on d.id = r.decided_by_account_id
     where r.id = ${requestId}::uuid and r.status <> 'draft'`);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    asOf: row.as_of,
    entry: {
      id: row.id,
      level: row.level,
      networkCode: row.network_code,
      status: row.status,
      submittedAt: row.submitted_at,
      slaDueAt: row.sla_due_at,
      escalateAt: row.escalate_at,
      overdue: row.overdue,
      held: row.held,
      holder: personOf(row.holder_id, row.holder_name),
      claimedAt: row.held ? row.claimed_at : null,
      claimExpiresAt: row.held ? row.claim_expires_at : null,
      forcedRelease:
        row.forced_at === null || row.forced_reason === null
          ? null
          : {
              releasedAt: row.forced_at,
              releasedBy: personOf(row.forced_by_id, row.forced_by_name),
              holder: personOf(row.forced_holder_id, row.forced_holder_name),
              reasonCode: row.forced_reason,
            },
      reexamine:
        row.reexamine_reason_code !== null && row.reexamined_at !== null
          ? {
              reasonCode: row.reexamine_reason_code,
              reexaminedAt: row.reexamined_at,
            }
          : null,
      decision:
        row.decided_at === null
          ? null
          : {
              decidedAt: row.decided_at,
              decidedBy: personOf(row.decided_by_id, row.decided_by_name),
              late: row.sla_breached === true,
              status: row.status,
              reasonCode: row.rejection_reason_code,
              memberMessage: row.member_message,
              internalComment: row.internal_comment,
            },
    },
    account: {
      countryCode: row.country_code,
      preferredLanguage: row.preferred_language,
      owner: personOf(row.owner_id, row.owner_name),
    },
  };
}

export type DossierRow = {
  reviewToken: string;
  codeExpiresAt: Instant;
  handle: string | null;
  pseudonym: string | null;
  profileUrl: string | null;
  tradeName: string | null;
  websiteDomain: string | null;
  legalName: string | null;
  registrationCountryCode: string | null;
  registrationNumber: string | null;
  evidence: unknown;
  history: unknown;
  badges: unknown;
  recentRejections: number;
  sameHandleAccounts: number;
  handleVerifiedElsewhere: boolean;
  openedBy: string;
  openingReasonCode: string | null;
  openingComment: string | null;
  /** A-bis: null for a creator's request. */
  loginAddressEligible: boolean | null;
};

/**
 * 08 RG55: the dossier of the entry the caller HOLDS, one row, with the review token of its own
 * snapshot (EC-L2E-08-13). 55P03 without the live claim: an agent who does not hold it reads nothing.
 */
export async function readDossier(
  tx: Transaction,
  requestId: string,
): Promise<DossierRow> {
  const rows = await tx.execute<{
    review_token: string;
    code_expires_at: Instant;
    handle: string | null;
    pseudonym: string | null;
    profile_url: string | null;
    trade_name: string | null;
    website_domain: string | null;
    legal_name: string | null;
    registration_country_code: string | null;
    registration_number: string | null;
    evidence: unknown;
    history: unknown;
    badges: unknown;
    recent_rejections: number;
    same_handle_accounts: number;
    handle_verified_elsewhere: boolean;
    opened_by: string;
    opening_reason_code: string | null;
    opening_comment: string | null;
    login_address_eligible: boolean | null;
  }>(sql`
    select review_token,
           to_char(code_expires_at at time zone 'UTC', ${ISO_UTC}) as code_expires_at,
           handle, pseudonym, profile_url, trade_name, website_domain, legal_name,
           registration_country_code, registration_number, evidence, history, badges,
           recent_rejections, same_handle_accounts, handle_verified_elsewhere,
           opened_by, opening_reason_code, opening_comment, login_address_eligible
      from verification.read_request_dossier(${requestId}::uuid)`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.read_request_dossier() returned no row");
  }
  return {
    reviewToken: row.review_token,
    codeExpiresAt: row.code_expires_at,
    handle: row.handle,
    pseudonym: row.pseudonym,
    profileUrl: row.profile_url,
    tradeName: row.trade_name,
    websiteDomain: row.website_domain,
    legalName: row.legal_name,
    registrationCountryCode: row.registration_country_code,
    registrationNumber: row.registration_number,
    evidence: row.evidence,
    history: row.history,
    badges: row.badges,
    recentRejections: row.recent_rejections,
    sameHandleAccounts: row.same_handle_accounts,
    handleVerifiedElsewhere: row.handle_verified_elsewhere,
    openedBy: row.opened_by,
    openingReasonCode: row.opening_reason_code,
    openingComment: row.opening_comment,
    loginAddressEligible: row.login_address_eligible,
  };
}

export type ReasonRow = {
  code: string;
  position: number;
  requiresMemberMessage: boolean;
  escalatesToAdmin: boolean;
  purgesEvidence: boolean;
};

/** The closed list of refusals of one population, active ones, in order (08 RG56, RG57). */
export async function readReasons(
  tx: Transaction,
  population: "creator" | "brand",
): Promise<ReasonRow[]> {
  const rows = await tx.execute<{
    code: string;
    position: number;
    requires_member_message: boolean;
    escalates_to_admin: boolean;
    purges_evidence: boolean;
  }>(sql`
    select code, position, requires_member_message, escalates_to_admin, purges_evidence
      from verification.rejection_reasons
     where population = ${population} and is_active
     order by position, code`);
  return rows.map((row) => ({
    code: row.code,
    position: row.position,
    requiresMemberMessage: row.requires_member_message,
    escalatesToAdmin: row.escalates_to_admin,
    purgesEvidence: row.purges_evidence,
  }));
}

export type RegistrySourceRow = {
  id: string;
  sourceType: string;
  countryCode: string | null;
  subdivisionCode: string | null;
  name: string;
  url: string;
  checkedOn: string;
};

/**
 * The active registers a brand of this country may be checked against: its own, the registers of its
 * States after it (0229, L2E-US), or GLEIF last (06 RG52).
 */
export async function readRegistrySources(
  tx: Transaction,
  countryCode: string,
): Promise<RegistrySourceRow[]> {
  const rows = await tx.execute<{
    id: string;
    source_type: string;
    country_code: string | null;
    subdivision_code: string | null;
    name: string;
    url: string;
    checked_on: string;
  }>(sql`
    select id::text as id, source_type::text as source_type, country_code::text as country_code,
           subdivision_code, name, url, to_char(checked_on, 'YYYY-MM-DD') as checked_on
      from verification.registry_sources
     where is_active and (source_type = 'gleif' or country_code = ${countryCode})
     order by (country_code is null), (subdivision_code is not null), subdivision_code, name, id`);
  return rows.map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    countryCode: row.country_code,
    subdivisionCode: row.subdivision_code,
    name: row.name,
    url: row.url,
    checkedOn: row.checked_on,
  }));
}

// ---------------------------------------------------------------------------------------------
// The acts (0224)
// ---------------------------------------------------------------------------------------------

/** 15 C3: the holder gives the entry back to the queue. */
export async function releaseRequest(
  tx: Transaction,
  requestId: string,
): Promise<void> {
  await tx.execute(
    sql`select verification.release_request(${requestId}::uuid)`,
  );
}

/** File.md A9: the holder of a live claim takes the delay again; the new expiry. */
export async function extendClaim(
  tx: Transaction,
  requestId: string,
): Promise<string> {
  const rows = await tx.execute<{ expires_at: string }>(sql`
    select to_char(verification.extend_request_claim(${requestId}::uuid)
                     at time zone 'UTC', ${ISO_UTC}) as expires_at`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.extend_request_claim() returned no row");
  }
  return row.expires_at;
}

/** 15 C4, an administrator: lifts a live claim with a typed reason; returns the dispossessed holder. */
export async function forceRelease(
  tx: Transaction,
  requestId: string,
  reasonCode: string,
): Promise<string | null> {
  const rows = await tx.execute<{ holder: string | null }>(sql`
    select verification.force_release_request_claim(
             ${requestId}::uuid, ${reasonCode})::text as holder`);
  return rows[0]?.holder ?? null;
}

/** Modele -19: the typed figures checked, then the declared ones of the line and the threshold. */
export async function compareFigures(
  tx: Transaction,
  requestId: string,
  reviewToken: string,
  figures: {
    followers: number;
    postsLast30Days: number;
    avgComments: number;
    engagementBp: number | null;
  },
): Promise<{
  followers: number | null;
  postsLast30Days: number | null;
  avgComments: number | null;
  engagementBp: number | null;
  gapAlertPercent: number;
}> {
  const rows = await tx.execute<{
    declared_followers: string | number | null;
    declared_posts_last_30_days: number | null;
    declared_avg_comments: string | number | null;
    declared_engagement_bp: number | null;
    gap_alert_percent: number;
  }>(sql`
    select declared_followers, declared_posts_last_30_days, declared_avg_comments,
           declared_engagement_bp, gap_alert_percent
      from verification.compare_request_figures(
             ${requestId}::uuid, ${reviewToken}, ${figures.followers}::bigint,
             ${figures.postsLast30Days}::integer, ${figures.avgComments}::bigint,
             ${figures.engagementBp}::integer)`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.compare_request_figures() returned no row");
  }
  const count = (value: string | number | null): number | null =>
    value === null ? null : Number(value);
  return {
    followers: count(row.declared_followers),
    postsLast30Days: row.declared_posts_last_30_days,
    avgComments: count(row.declared_avg_comments),
    engagementBp: row.declared_engagement_bp,
    gapAlertPercent: row.gap_alert_percent,
  };
}

export type GrantedRow = {
  outcome: "granted" | "handle_already_verified";
  badgeId: string | null;
  decidedAt: string;
  late: boolean;
};

type GrantSqlRow = {
  outcome: "granted" | "handle_already_verified";
  badge_id: string | null;
  decided_at: string;
  sla_breached: boolean;
};

function grantedOf(rows: readonly GrantSqlRow[], door: string): GrantedRow {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${door}() returned no row`);
  }
  return {
    outcome: row.outcome,
    badgeId: row.badge_id,
    decidedAt: row.decided_at,
    late: row.sla_breached,
  };
}

/** 08 RG25: « Compte vérifié »; a second finding of one handle is an OUTCOME, not an error (EC-L2E-08-2). */
export async function grantAccountVerified(
  tx: Transaction,
  requestId: string,
  reviewToken: string,
  input: {
    observedCode: string;
    observedHandle: string;
    observedPlatformAccountRef: string | null;
    internalComment: string | null;
  },
): Promise<GrantedRow> {
  const rows = await tx.execute<GrantSqlRow>(sql`
    select outcome, badge_id::text as badge_id,
           to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from verification.grant_account_verified(
             ${requestId}::uuid, ${reviewToken}, ${input.observedCode},
             ${input.observedHandle}, ${input.observedPlatformAccountRef},
             ${input.internalComment})`);
  return grantedOf(rows, "verification.grant_account_verified");
}

/** 08 RG36 to RG38bis: « Audience vérifiée », the figures and the period the agent typed. */
export async function grantAudienceVerified(
  tx: Transaction,
  requestId: string,
  reviewToken: string,
  input: {
    followers: number;
    postsLast30Days: number;
    avgComments: number;
    engagementBp: number | null;
    periodStart: string;
    periodEnd: string;
    observedHandle: string;
    internalComment: string | null;
  },
): Promise<GrantedRow> {
  const rows = await tx.execute<GrantSqlRow>(sql`
    select outcome, badge_id::text as badge_id,
           to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from verification.grant_audience_verified(
             ${requestId}::uuid, ${reviewToken}, ${input.followers}::bigint,
             ${input.postsLast30Days}::integer, ${input.avgComments}::bigint,
             ${input.engagementBp}::integer, ${input.periodStart}::date,
             ${input.periodEnd}::date, ${input.observedHandle}, ${input.internalComment})`);
  return grantedOf(rows, "verification.grant_audience_verified");
}

/** 06 RG51, RG52: « Marque vérifiée », the domain code found and the register consulted. */
export async function grantBrandVerified(
  tx: Transaction,
  requestId: string,
  reviewToken: string,
  input: {
    observedCode: string;
    observedDomain: string;
    observedChannel: string;
    registrySourceId: string;
    internalComment: string | null;
  },
): Promise<GrantedRow> {
  const rows = await tx.execute<GrantSqlRow>(sql`
    select outcome, badge_id::text as badge_id,
           to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from verification.grant_brand_verified(
             ${requestId}::uuid, ${reviewToken}, ${input.observedCode},
             ${input.observedDomain}, ${input.observedChannel},
             ${input.registrySourceId}::uuid, ${input.internalComment})`);
  return grantedOf(rows, "verification.grant_brand_verified");
}

/**
 * D83 A-bis, 06 RG51: « Marque vérifiée » on the verified login address of the account (the database
 * reads it, never says it): no code, no channel and no domain typed; the register is still consulted.
 */
export async function grantBrandVerifiedByLogin(
  tx: Transaction,
  requestId: string,
  reviewToken: string,
  input: { registrySourceId: string; internalComment: string | null },
): Promise<GrantedRow> {
  const rows = await tx.execute<GrantSqlRow>(sql`
    select outcome, badge_id::text as badge_id,
           to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
      from verification.grant_brand_verified_by_login(
             ${requestId}::uuid, ${reviewToken}, ${input.registrySourceId}::uuid,
             ${input.internalComment})`);
  return grantedOf(rows, "verification.grant_brand_verified_by_login");
}

/** 08 RG56, RG57, RG59: the refusal (or the closure of an unavailable account) with a typed reason. */
export async function rejectRequest(
  tx: Transaction,
  requestId: string,
  reviewToken: string,
  reasonCode: string,
  memberMessage: string | null,
  internalComment: string | null,
): Promise<{
  status: "rejected" | "closed";
  decidedAt: string;
  late: boolean;
  escalated: boolean;
}> {
  const rows = await tx.execute<{
    status: "rejected" | "closed";
    decided_at: string;
    sla_breached: boolean;
    escalated: boolean;
  }>(sql`
    select status, to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           sla_breached, escalated
      from verification.reject_request(
             ${requestId}::uuid, ${reviewToken}, ${reasonCode}, ${memberMessage},
             ${internalComment})`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.reject_request() returned no row");
  }
  return {
    status: row.status,
    decidedAt: row.decided_at,
    late: row.sla_breached,
    escalated: row.escalated,
  };
}

/** 08 RG50, CA29: « à réexaminer », an internal reason; the entry stays in the queue. */
export async function reexamineRequest(
  tx: Transaction,
  requestId: string,
  reviewToken: string,
  reasonCode: string,
): Promise<string> {
  const rows = await tx.execute<{ at: string }>(sql`
    select to_char(verification.reexamine_request(
                     ${requestId}::uuid, ${reviewToken}, ${reasonCode})
                     at time zone 'UTC', ${ISO_UTC}) as at`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.reexamine_request() returned no row");
  }
  return row.at;
}

// ---------------------------------------------------------------------------------------------
// The piece (D82 (5), 08 RG84)
// ---------------------------------------------------------------------------------------------

/**
 * `verification.read_evidence()`: the key of an ACTIVE piece to the holder of the live claim, and
 * the register line `verification.evidence_viewed` in this very transaction. The key goes to the
 * relay of Storage and nowhere else: never to a response, never to a log.
 */
export async function readEvidenceKey(
  tx: Transaction,
  evidenceId: string,
): Promise<string> {
  const rows = await tx.execute<{ object_key: string }>(
    sql`select verification.read_evidence(${evidenceId}::uuid) as object_key`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.read_evidence() returned no row");
  }
  return row.object_key;
}

/** What an active piece weighs and measures: the columns an agent is granted, never the key. */
export async function readEvidenceDescription(
  tx: Transaction,
  requestId: string,
  evidenceId: string,
): Promise<{ width: number; height: number; byteSize: number } | null> {
  const rows = await tx.execute<{
    width: number | null;
    height: number | null;
    byte_size: string | number | null;
  }>(sql`
    select width, height, byte_size from verification.evidence_files
     where id = ${evidenceId}::uuid and request_id = ${requestId}::uuid and state = 'active'`);
  const row = rows[0];
  if (
    row === undefined ||
    row.width === null ||
    row.height === null ||
    row.byte_size === null
  ) {
    return null;
  }
  return {
    width: row.width,
    height: row.height,
    byteSize: Number(row.byte_size),
  };
}

// ---------------------------------------------------------------------------------------------
// Small reads for the refusals and the next entry
// ---------------------------------------------------------------------------------------------

/** The name of an account (an agent's display name), for the refusal that names a holder (C2). */
export async function displayNameOf(
  tx: Transaction,
  accountId: string,
): Promise<string | null> {
  const rows = await tx.execute<{ display_name: string | null }>(sql`
    select display_name from identity.accounts where id = ${accountId}::uuid`);
  return rows[0]?.display_name ?? null;
}

/** Whether the last forced release of the request dispossessed this agent (file.md A8). */
export async function wasDispossessed(
  tx: Transaction,
  requestId: string,
  accountId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ dispossessed: boolean }>(sql`
    select (forced_release_holder_account_id = ${accountId}::uuid) as dispossessed
      from verification.verification_requests
     where id = ${requestId}::uuid and forced_release_at is not null`);
  return rows[0]?.dispossessed === true;
}

/**
 * 17b §2.6: the entry to open after a decision: the oldest submission of the view that nobody holds,
 * never the caller's own account nor one he holds (RG36, RG53). Null when none.
 */
export async function nextRequestId(
  tx: Transaction,
  caller: string,
  view: VerificationQueueView,
): Promise<string | null> {
  const rows = await tx.execute<{ id: string }>(sql`
    select r.id::text as id
      from verification.verification_requests r
      join identity.accounts a on a.id = r.account_id
     where ${sql.join(
       conditionsOf({ holder: "free" }, caller, view, "age"),
       sql` and `,
     )}
     order by r.submitted_at, r.id
     limit 1`);
  return rows[0]?.id ?? null;
}
