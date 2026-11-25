// What queues 5 (the contests, 0232) and 6 (the identifiers changed, 0233) share (docs/mvp/15 RG26 to
// RG28, RG33, RG34, RG36, RG27 C1 to C8, RG29; 08 RG77, RG78; jalons/l2f/modele.md §3, §4, §5; l2f
// commit 14): both are entries with a lock (a claim of `claim_expiry_minutes`), deadlines frozen at their
// creation, an agent's decision and the same exits, in a table of their own. This file holds what does not
// depend on the table's columns of its own — the counters, the conditions of the list, the lock view, the
// claim doors and the entry to open next — once, by table. Parameterised queries only (S-1); the
// identifiers of table and function below are constants of this file, never a value of a request.
// - A request of the caller's own account is not there (the policy of 0232, 0233: 15 RG36, C(3)); the
//   accounts the caller HOLDS (identity.accounts.owner_agent_id, 08 RG53) are left out of every read below,
//   the database does not hide them from a SELECT.
// - Nothing typed by a creator (the text of a contest, a handle) is read here: the queue-specific reads
//   of the two repositories do, behind the live claim.
import type { VerificationQueueSort } from "@influx/contracts/verification";
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../../../db/index.ts";
import { ISO_UTC } from "../../sql-formats.ts";
import type { CountersRow, Person } from "../repository.ts";

/** The cursor keeps the microseconds: two entries of the same millisecond stay apart. */
const ISO_UTC_MICRO = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';

type Instant = string | null;

export type ClaimedQueueKind = "disputes" | "identifier_changes";

type QueueDefinition = {
  /** The code of the queue's delay in `backoffice.sla_policies`. */
  slaCode: string;
  table: SQL;
  /** The column the entry is dated by (its submission, its creation). */
  dated: SQL;
  /** The sort key of `level`: the contest has one, an identifier change does not. */
  levelKey: SQL;
  open: SQL;
  release: SQL;
  extend: SQL;
  forceRelease: SQL;
};

export const QUEUE_DEFINITION: Readonly<
  Record<ClaimedQueueKind, QueueDefinition>
> = {
  disputes: {
    slaCode: "verification_disputes",
    table: sql`verification.disputes`,
    dated: sql`e.submitted_at`,
    levelKey: sql`e.level::text`,
    open: sql`verification.open_dispute`,
    release: sql`verification.release_dispute`,
    extend: sql`verification.extend_dispute_claim`,
    forceRelease: sql`verification.force_release_dispute_claim`,
  },
  identifier_changes: {
    slaCode: "identity_change_review",
    table: sql`verification.identifier_change_reviews`,
    dated: sql`e.created_at`,
    levelKey: sql`''::text`,
    open: sql`verification.open_identifier_change`,
    release: sql`verification.release_identifier_change`,
    extend: sql`verification.extend_identifier_change_claim`,
    forceRelease: sql`verification.force_release_identifier_change_claim`,
  },
};

/** The filters the two lists share (15 RG33); each queue adds its own. */
export type ClaimedFilters = {
  network?: string;
  overdue?: boolean;
  /** `free`, `me`, or the account id of a named agent. */
  holder?: string;
  /** `none`, or the account id of the responsible salesperson. */
  owner?: string;
  from?: string;
  to?: string;
  after?: { primary: string; submittedAt: string; id: string };
};

export function datedKey(kind: ClaimedQueueKind): SQL {
  return sql`to_char(${QUEUE_DEFINITION[kind].dated} at time zone 'UTC', ${ISO_UTC_MICRO})`;
}

/** The text each sort orders by first (the second key is always the date of the entry, then the id). */
export function primaryKeyOf(
  kind: ClaimedQueueKind,
  sort: VerificationQueueSort,
): SQL {
  switch (sort) {
    case "age":
      return datedKey(kind);
    case "sla":
      return sql`to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC_MICRO})`;
    case "level":
      return QUEUE_DEFINITION[kind].levelKey;
    case "network":
      return sql`coalesce(e.network_code, '')`;
  }
}

/** The lock is live: a holder whose claim has not expired (file.md A9). */
export const LIVE_CLAIM = sql`e.claimed_by_account_id is not null and e.claim_expires_at > now()`;

/**
 * The conditions of a list of one queue (15 RG33, RG36): open entries only, never an account the
 * caller holds, then the filters. `account` is the joined `identity.accounts` row of the entry.
 */
export function claimedConditions(
  kind: ClaimedQueueKind,
  filters: ClaimedFilters,
  caller: string,
  sort: VerificationQueueSort,
): SQL[] {
  const conditions: SQL[] = [
    sql`e.state = 'open'`,
    // 15 RG36, 08 RG53: an entry of an account the caller holds is masked from him
    sql`a.owner_agent_id is distinct from ${caller}::uuid`,
  ];
  if (filters.network !== undefined) {
    conditions.push(sql`e.network_code = ${filters.network}`);
  }
  if (filters.overdue === true) {
    conditions.push(sql`e.sla_due_at < now()`);
  }
  if (filters.holder === "free") {
    conditions.push(sql`not (${LIVE_CLAIM})`);
  } else if (filters.holder !== undefined) {
    const holder = filters.holder === "me" ? caller : filters.holder;
    conditions.push(
      sql`(${LIVE_CLAIM}) and e.claimed_by_account_id = ${holder}::uuid`,
    );
  }
  if (filters.owner === "none") {
    conditions.push(sql`a.owner_agent_id is null`);
  } else if (filters.owner !== undefined) {
    conditions.push(sql`a.owner_agent_id = ${filters.owner}::uuid`);
  }
  const dated = QUEUE_DEFINITION[kind].dated;
  if (filters.from !== undefined) {
    conditions.push(sql`${dated} >= ${filters.from}::timestamptz`);
  }
  if (filters.to !== undefined) {
    conditions.push(sql`${dated} <= ${filters.to}::timestamptz`);
  }
  if (filters.after !== undefined) {
    conditions.push(
      sql`(${primaryKeyOf(kind, sort)}, ${datedKey(kind)}, e.id) >
          (${filters.after.primary}::text, ${filters.after.submittedAt}::text,
           ${filters.after.id}::uuid)`,
    );
  }
  return conditions;
}

// ---------------------------------------------------------------------------------------------
// Counters (15 RG28, RG32)
// ---------------------------------------------------------------------------------------------

/** The permanent counters of one queue, as the caller sees it (RG36), with its delay (RG65). */
export async function readClaimedCounters(
  tx: Transaction,
  caller: string,
  kind: ClaimedQueueKind,
): Promise<CountersRow | null> {
  const { table, slaCode, dated } = QUEUE_DEFINITION[kind];
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
           (select count(*)::int from ${table} e
              join identity.accounts a on a.id = e.account_id
             where e.state = 'open'
               and a.owner_agent_id is distinct from ${caller}::uuid) as pending,
           (select to_char(min(${dated}) at time zone 'UTC', ${ISO_UTC})
              from ${table} e
              join identity.accounts a on a.id = e.account_id
             where e.state = 'open'
               and a.owner_agent_id is distinct from ${caller}::uuid) as oldest,
           (select count(*)::int from ${table} e
              join identity.accounts a on a.id = e.account_id
             where e.state = 'open' and e.sla_due_at < now()
               and a.owner_agent_id is distinct from ${caller}::uuid) as overdue,
           (select count(*)::int from ${table} e
              join identity.accounts a on a.id = e.account_id
             where e.state = 'open'
               and (e.claimed_by_account_id is null or e.claim_expires_at <= now())
               and a.owner_agent_id is distinct from ${caller}::uuid) as unclaimed,
           (select to_char(max(e.decided_at) at time zone 'UTC', ${ISO_UTC})
              from ${table} e
              join identity.accounts a on a.id = e.account_id
             where e.decided_at is not null
               and a.owner_agent_id is distinct from ${caller}::uuid) as last_decided,
           p.target_decision_minutes as decision_minutes,
           p.target_claim_minutes as claim_target_minutes,
           p.escalate_after_minutes,
           (p.business_hours is not null) as business_hours
      from backoffice.sla_policies p
     where p.queue_code = ${slaCode} and p.is_active`);
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
// The target of an act, the lock view
// ---------------------------------------------------------------------------------------------

export type ClaimedTarget = {
  accountId: string;
  /** The salesperson who holds the account (08 RG53): the doors refuse him the entry. */
  ownerAgentId: string | null;
  state: string;
};

/**
 * The entry an act names, and who holds its account: null for an unknown one and the caller's own
 * account (hidden by the policy, C(3)). An entry is read whatever its state: a closed one answers
 * `closed` as to anybody.
 */
export async function claimedTargetOf(
  tx: Transaction,
  kind: ClaimedQueueKind,
  entryId: string,
): Promise<ClaimedTarget | null> {
  const { table } = QUEUE_DEFINITION[kind];
  const rows = await tx.execute<{
    account_id: string;
    owner_agent_id: string | null;
    state: string;
  }>(sql`
    select e.account_id::text as account_id, a.owner_agent_id::text as owner_agent_id,
           e.state::text as state
      from ${table} e
      join identity.accounts a on a.id = e.account_id
     where e.id = ${entryId}::uuid`);
  const row = rows[0];
  return row === undefined
    ? null
    : {
        accountId: row.account_id,
        ownerAgentId: row.owner_agent_id,
        state: row.state,
      };
}

export type ClaimView = {
  asOf: string;
  id: string;
  accountId: string;
  networkCode: string;
  state: string;
  datedAt: string;
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
  decidedAt: Instant;
  closedAt: Instant;
  decidedBy: Person | null;
  late: boolean;
  withdrawnCause: string | null;
  internalComment: string | null;
  account: {
    countryCode: string;
    preferredLanguage: "fr" | "en";
    owner: Person | null;
  };
};

function personOf(id: string | null, name: string | null): Person | null {
  return id === null ? null : { accountId: id, displayName: name };
}

/**
 * The entry as the database holds it NOW: read after the opening, so that it is no older than the token
 * of the opening. `extra` names the columns of the queue's own (aliased `x_<name>`); they come back by
 * name in `specific`. An entry that is not one (unknown, own account) gives null.
 */
export async function readClaimView(
  tx: Transaction,
  kind: ClaimedQueueKind,
  entryId: string,
  extra: SQL,
): Promise<{ view: ClaimView; specific: Record<string, unknown> } | null> {
  const { table, dated } = QUEUE_DEFINITION[kind];
  const rows = await tx.execute<Record<string, unknown>>(sql`
    select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of,
           e.id::text as id, e.account_id::text as account_id, e.network_code,
           e.state::text as state,
           to_char(${dated} at time zone 'UTC', ${ISO_UTC}) as dated_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.state = 'open' and e.sla_due_at < now()) as overdue,
           (e.claimed_by_account_id is not null and e.claim_expires_at > now()) as held,
           e.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(e.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(e.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           to_char(e.forced_release_at at time zone 'UTC', ${ISO_UTC}) as forced_at,
           e.forced_release_by_account_id::text as forced_by_id, fb.display_name as forced_by_name,
           e.forced_release_holder_account_id::text as forced_holder_id,
           fh.display_name as forced_holder_name,
           e.forced_release_reason_code as forced_reason,
           to_char(e.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           to_char(e.closed_at at time zone 'UTC', ${ISO_UTC}) as closed_at,
           e.decided_by_account_id::text as decided_by_id, d.display_name as decided_by_name,
           e.sla_breached, e.withdrawn_cause, e.internal_comment,
           a.country_code::text as country_code, a.preferred_language::text as preferred_language,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           ${extra}
      from ${table} e
      join identity.accounts a on a.id = e.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
      left join identity.accounts fb on fb.id = e.forced_release_by_account_id
      left join identity.accounts fh on fh.id = e.forced_release_holder_account_id
      left join identity.accounts d on d.id = e.decided_by_account_id
     where e.id = ${entryId}::uuid`);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  const text = (name: string): string => String(row[name]);
  const maybe = (name: string): string | null =>
    typeof row[name] === "string" ? row[name] : null;
  const held = row.held === true;
  const specific: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key.startsWith("x_")) {
      specific[key.slice(2)] = value;
    }
  }
  return {
    view: {
      asOf: text("as_of"),
      id: text("id"),
      accountId: text("account_id"),
      networkCode: text("network_code"),
      state: text("state"),
      datedAt: text("dated_at"),
      slaDueAt: text("sla_due_at"),
      escalateAt: text("escalate_at"),
      overdue: row.overdue === true,
      held,
      holder: personOf(maybe("holder_id"), maybe("holder_name")),
      claimedAt: held ? maybe("claimed_at") : null,
      claimExpiresAt: held ? maybe("claim_expires_at") : null,
      forcedRelease:
        maybe("forced_at") === null || maybe("forced_reason") === null
          ? null
          : {
              releasedAt: text("forced_at"),
              releasedBy: personOf(
                maybe("forced_by_id"),
                maybe("forced_by_name"),
              ),
              holder: personOf(
                maybe("forced_holder_id"),
                maybe("forced_holder_name"),
              ),
              reasonCode: text("forced_reason"),
            },
      decidedAt: maybe("decided_at"),
      closedAt: maybe("closed_at"),
      decidedBy: personOf(maybe("decided_by_id"), maybe("decided_by_name")),
      late: row.sla_breached === true,
      withdrawnCause: maybe("withdrawn_cause"),
      internalComment: maybe("internal_comment"),
      account: {
        countryCode: text("country_code"),
        preferredLanguage: row.preferred_language === "en" ? "en" : "fr",
        owner: personOf(maybe("owner_id"), maybe("owner_name")),
      },
    },
    specific,
  };
}

// ---------------------------------------------------------------------------------------------
// The claim doors (15 C1 to C4; file.md A8, A9)
// ---------------------------------------------------------------------------------------------

export type ClaimOpening = {
  outcome: "claimed" | "held" | "read_only" | "closed";
  reviewToken: string | null;
};

/**
 * 15 RG27 C1 to C3: opening is taking. The database decides in one conditional UPDATE and journals the
 * opening (`queue.entry_opened`). 42501 for an unknown entry, the caller's own account or an open entry
 * of an account he holds.
 */
export async function openClaimedEntry(
  tx: Transaction,
  kind: ClaimedQueueKind,
  entryId: string,
): Promise<ClaimOpening> {
  const rows = await tx.execute<{
    outcome: ClaimOpening["outcome"];
    review_token: string | null;
  }>(sql`
    select outcome, review_token from ${QUEUE_DEFINITION[kind].open}(${entryId}::uuid)`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("the opening door returned no row");
  }
  return { outcome: row.outcome, reviewToken: row.review_token };
}

/** 15 C3: the holder gives the entry back to the queue. */
export async function releaseClaimedEntry(
  tx: Transaction,
  kind: ClaimedQueueKind,
  entryId: string,
): Promise<void> {
  await tx.execute(
    sql`select ${QUEUE_DEFINITION[kind].release}(${entryId}::uuid)`,
  );
}

/** File.md A9: the holder of a live claim takes the delay again; the new expiry. */
export async function extendClaimedEntry(
  tx: Transaction,
  kind: ClaimedQueueKind,
  entryId: string,
): Promise<string> {
  const rows = await tx.execute<{ expires_at: string }>(sql`
    select to_char(${QUEUE_DEFINITION[kind].extend}(${entryId}::uuid)
                     at time zone 'UTC', ${ISO_UTC}) as expires_at`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("the extension door returned no row");
  }
  return row.expires_at;
}

/** 15 C4, an administrator: lifts a live claim with a typed reason; returns the dispossessed holder. */
export async function forceReleaseClaimedEntry(
  tx: Transaction,
  kind: ClaimedQueueKind,
  entryId: string,
  reasonCode: string,
): Promise<string | null> {
  const rows = await tx.execute<{ holder: string | null }>(sql`
    select ${QUEUE_DEFINITION[kind].forceRelease}(${entryId}::uuid, ${reasonCode})::text as holder`);
  return rows[0]?.holder ?? null;
}

/** Whether the last forced release of the entry dispossessed this agent (file.md A8). */
export async function wasDispossessedOfEntry(
  tx: Transaction,
  kind: ClaimedQueueKind,
  entryId: string,
  accountId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ dispossessed: boolean }>(sql`
    select (e.forced_release_holder_account_id = ${accountId}::uuid) as dispossessed
      from ${QUEUE_DEFINITION[kind].table} e
     where e.id = ${entryId}::uuid and e.forced_release_at is not null`);
  return rows[0]?.dispossessed === true;
}

/**
 * 17b §2.6: the entry to open after a decision: the oldest one that nobody holds, never the caller's own
 * account nor one he holds (RG36, RG53). Null when none.
 */
export async function nextClaimedEntryId(
  tx: Transaction,
  caller: string,
  kind: ClaimedQueueKind,
): Promise<string | null> {
  const { table, dated } = QUEUE_DEFINITION[kind];
  const rows = await tx.execute<{ id: string }>(sql`
    select e.id::text as id
      from ${table} e
      join identity.accounts a on a.id = e.account_id
     where ${sql.join(claimedConditions(kind, { holder: "free" }, caller, "age"), sql` and `)}
     order by ${dated}, e.id
     limit 1`);
  return rows[0]?.id ?? null;
}

/** The decision of a closed or withdrawn entry has no `decided_at` when withdrawn: the closure dates it. */
export function closedAtOf(view: ClaimView): string | null {
  return view.decidedAt ?? view.closedAt;
}
