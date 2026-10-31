// Database access of the member accounts list and record (influx_agent or influx_admin, aal2;
// 03 §1.3, §3.1). Parameterised queries only (S-1).
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import type { RawSyncState } from "../sync-causes.ts";
import { ISO_UTC } from "../sql-formats.ts";

// ---------------------------------------------------------------------------------------------
// Member accounts: the read API of the backoffice v0 (05 RG97 to RG100, RG105; 15 RG40, RG49,
// RG50; 03 §3.1, §3.5 C(33); J8 commit 5), under influx_agent or influx_admin in aal2 (policies of
// 0004, 0005, 0008, 0101, 0106).
// - Member accounts only (advertiser, creator): an internal account is not found here (T14.3).
// - What is read for the screen is codes and identifiers: never the provider's message
//   (last_error_message), never the contact id at a provider, never an Apollo datum (RG107).
// - The writes are the two journal functions of the database: 0133 reserve_account_search()
//   (RG98) and 0132 read_subject_history() (EC-31, RG40).
// ---------------------------------------------------------------------------------------------

/** The cursor keeps the microseconds: two sign-ups in the same millisecond stay apart. */
const ISO_UTC_MICRO = 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';

export type SyncStateFilter =
  "synced" | "pending" | "not_attempted" | "skipped" | "failed";

export type AccountFilters = {
  role?: "advertiser" | "creator";
  country?: string;
  language?: string;
  declaredStatus?: "individual" | "business";
  syncDestination?: "brevo" | "apollo";
  syncState?: SyncStateFilter;
  consent?: "granted" | "withdrawn";
  from?: string;
  to?: string;
  /** Exact address, already normalised (RG98). */
  email?: string;
  /** Fragment of an address, already normalised and reserved (RG98). */
  fragment?: string;
  /** The last line of the previous page. */
  after?: { createdAt: string; id: string };
};

export type MemberAccountRow = {
  id: string;
  createdAt: string;
  cursorAt: string;
  role: "advertiser" | "creator";
  status: "active" | "suspended" | "deleted";
  countryCode: string;
  preferredLanguage: string;
  declaredStatus: "individual" | "business";
  viaInvitation: boolean;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  referrerDomain: string | null;
  heardFrom: string | null;
  consent: { granted: boolean; occurredAt: string; source: string } | null;
  brevo: RawSyncState;
  apollo: RawSyncState;
  owner: { accountId: string; displayName: string | null } | null;
  lastSeenAt: string | null;
};

export type MemberAccountDetail = MemberAccountRow & {
  email: string;
  emailStatus: "unknown" | "deliverable" | "undeliverable";
  companyName: string | null;
  suspendedAt: string | null;
  deletedAt: string | null;
};

type RawRow = {
  id: string;
  created_at: string;
  cursor_at: string;
  role: "advertiser" | "creator";
  status: "active" | "suspended" | "deleted";
  country_code: string;
  preferred_language: string;
  declared_status: "individual" | "business";
  via_invitation: boolean;
  signup_utm_source: string | null;
  signup_utm_medium: string | null;
  signup_utm_campaign: string | null;
  signup_referrer_domain: string | null;
  signup_heard_from: string | null;
  consent_granted: boolean | null;
  consent_at: string | null;
  consent_source: string | null;
  owner_id: string | null;
  owner_name: string | null;
  last_seen_at: string | null;
  b_live_status: "pending" | "processing" | null;
  b_live_attempts: number | null;
  b_live_available_at: string | null;
  b_last_status: string | null;
  b_last_code: string | null;
  b_last_attempt_at: string | null;
  a_live_status: "pending" | "processing" | null;
  a_live_attempts: number | null;
  a_live_available_at: string | null;
  a_last_status: string | null;
  a_last_code: string | null;
  a_last_attempt_at: string | null;
  email?: string;
  email_status?: "unknown" | "deliverable" | "undeliverable";
  company_name?: string | null;
  suspended_at?: string | null;
  deleted_at?: string | null;
};

/** The state of one destination as SQL, the same rule as syncStateOf() (sync-causes.ts). */
const BREVO_STATE = sql`case when b_live_status is not null then 'pending'
                             when b_last_status is null then 'not_attempted'
                             when b_last_status = 'succeeded' then 'synced'
                             when b_last_status = 'skipped' then 'skipped'
                             when b_last_status = 'failed' then 'failed'
                             else 'pending' end`;
const APOLLO_STATE = sql`case when a_live_status is not null then 'pending'
                              when a_last_status is null then 'not_attempted'
                              when a_last_status = 'succeeded' then 'synced'
                              when a_last_status = 'skipped' then 'skipped'
                              when a_last_status = 'failed' then 'failed'
                              else 'pending' end`;

/**
 * Each destination of the contact: its live line (0111 outbox_events_subject_live_idx, the same
 * predicate) and its last state (0101 contact_sync_states). Written once per destination.
 */
const DESTINATIONS = sql`
    left join lateral (
      select live.status::text as b_live_status, live.attempts::integer as b_live_attempts,
             to_char(live.available_at at time zone 'UTC', ${ISO_UTC}) as b_live_available_at
        from leads.outbox_events live
       where live.subject_key = 'account:' || a.id::text
         and live.destination = 'brevo_contact'
         and live.status in ('pending', 'processing')
       order by live.id
       limit 1
    ) b_live on true
    left join lateral (
      select s.last_status::text as b_last_status, s.last_error_code as b_last_code,
             to_char(s.last_attempt_at at time zone 'UTC', ${ISO_UTC}) as b_last_attempt_at
        from leads.contact_sync_states s
       where s.account_id = a.id and s.destination = 'brevo_contact'
    ) b_state on true
    left join lateral (
      select live.status::text as a_live_status, live.attempts::integer as a_live_attempts,
             to_char(live.available_at at time zone 'UTC', ${ISO_UTC}) as a_live_available_at
        from leads.outbox_events live
       where live.subject_key = 'account:' || a.id::text
         and live.destination = 'apollo_contact'
         and live.status in ('pending', 'processing')
       order by live.id
       limit 1
    ) a_live on true
    left join lateral (
      select s.last_status::text as a_last_status, s.last_error_code as a_last_code,
             to_char(s.last_attempt_at at time zone 'UTC', ${ISO_UTC}) as a_last_attempt_at
        from leads.contact_sync_states s
       where s.account_id = a.id and s.destination = 'apollo_contact'
    ) a_state on true`;

function whereOf(filters: AccountFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.role !== undefined) {
    conditions.push(sql`role = ${filters.role}`);
  }
  if (filters.country !== undefined) {
    conditions.push(sql`country_code = ${filters.country}`);
  }
  if (filters.language !== undefined) {
    conditions.push(sql`preferred_language = ${filters.language}`);
  }
  if (filters.declaredStatus !== undefined) {
    conditions.push(sql`declared_status = ${filters.declaredStatus}`);
  }
  if (filters.consent !== undefined) {
    conditions.push(
      sql`consent_granted is not distinct from ${filters.consent === "granted"}`,
    );
  }
  if (filters.from !== undefined) {
    conditions.push(sql`created_at_ts >= ${filters.from}::timestamptz`);
  }
  if (filters.to !== undefined) {
    conditions.push(sql`created_at_ts <= ${filters.to}::timestamptz`);
  }
  if (filters.syncState !== undefined) {
    const brevo = sql`${BREVO_STATE} = ${filters.syncState}`;
    const apollo = sql`${APOLLO_STATE} = ${filters.syncState}`;
    conditions.push(
      filters.syncDestination === "brevo"
        ? brevo
        : filters.syncDestination === "apollo"
          ? apollo
          : sql`(${brevo} or ${apollo})`,
    );
  }
  if (filters.after !== undefined) {
    conditions.push(
      sql`(created_at_ts, account_uuid) < (${filters.after.createdAt}::timestamptz, ${filters.after.id}::uuid)`,
    );
  }
  return conditions;
}

/** The member accounts with everything a line shows; `detail` adds the record's own columns. */
async function memberAccounts(
  tx: Transaction,
  options: {
    accountFilter: SQL;
    filters: AccountFilters;
    limit: number;
    detail: boolean;
  },
): Promise<RawRow[]> {
  const conditions = whereOf(options.filters);
  const where =
    conditions.length === 0
      ? sql``
      : sql`where ${sql.join(conditions, sql` and `)}`;
  const detailColumns = options.detail
    ? sql`, a.email, a.email_status::text as email_status, ap.legal_name as company_name,
           to_char(a.suspended_at at time zone 'UTC', ${ISO_UTC}) as suspended_at,
           to_char(a.deleted_at at time zone 'UTC', ${ISO_UTC}) as deleted_at`
    : sql``;
  const detailJoin = options.detail
    ? sql`left join profiles.advertiser_profiles ap on ap.account_id = a.id`
    : sql``;
  return tx.execute<RawRow>(sql`
    select * from (
      select a.id::text as id, a.id as account_uuid, a.created_at as created_at_ts,
             to_char(a.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
             to_char(a.created_at at time zone 'UTC', ${ISO_UTC_MICRO}) as cursor_at,
             r.role::text as role, a.status::text as status, a.country_code::text as country_code,
             a.preferred_language::text as preferred_language,
             a.declared_status::text as declared_status,
             a.signup_invitation_id is not null as via_invitation,
             a.signup_utm_source, a.signup_utm_medium, a.signup_utm_campaign,
             a.signup_referrer_domain, a.signup_heard_from::text as signup_heard_from,
             c.granted as consent_granted,
             to_char(c.occurred_at at time zone 'UTC', ${ISO_UTC}) as consent_at,
             c.source::text as consent_source,
             o.id::text as owner_id, o.display_name as owner_name,
             to_char(a.last_seen_at at time zone 'UTC', ${ISO_UTC}) as last_seen_at,
             b_live_status, b_live_attempts, b_live_available_at,
             b_last_status, b_last_code, b_last_attempt_at,
             a_live_status, a_live_attempts, a_live_available_at,
             a_last_status, a_last_code, a_last_attempt_at
             ${detailColumns}
        from identity.accounts a
        join identity.account_roles r
          on r.account_id = a.id and r.role in ('advertiser', 'creator')
        left join identity.accounts o on o.id = a.owner_agent_id
        ${detailJoin}
        left join lateral (
          select ce.granted, ce.occurred_at, ce.source
            from identity.consent_events ce
           where ce.account_id = a.id and ce.purpose = 'marketing_email'
           order by ce.occurred_at desc, ce.created_at desc
           limit 1
        ) c on true
        ${DESTINATIONS}
       where ${options.accountFilter}
    ) line
    ${where}
    order by created_at_ts desc, account_uuid desc
    limit ${options.limit}`);
}

function rawStateOf(row: RawRow, prefix: "b" | "a"): RawSyncState {
  return prefix === "b"
    ? {
        liveStatus: row.b_live_status,
        liveAttempts: row.b_live_attempts,
        liveAvailableAt: row.b_live_available_at,
        lastStatus: row.b_last_status,
        lastCode: row.b_last_code,
        lastAttemptAt: row.b_last_attempt_at,
      }
    : {
        liveStatus: row.a_live_status,
        liveAttempts: row.a_live_attempts,
        liveAvailableAt: row.a_live_available_at,
        lastStatus: row.a_last_status,
        lastCode: row.a_last_code,
        lastAttemptAt: row.a_last_attempt_at,
      };
}

function rowOf(row: RawRow): MemberAccountRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    cursorAt: row.cursor_at,
    role: row.role,
    status: row.status,
    countryCode: row.country_code,
    preferredLanguage: row.preferred_language,
    declaredStatus: row.declared_status,
    viaInvitation: row.via_invitation,
    utmSource: row.signup_utm_source,
    utmMedium: row.signup_utm_medium,
    utmCampaign: row.signup_utm_campaign,
    referrerDomain: row.signup_referrer_domain,
    heardFrom: row.signup_heard_from,
    consent:
      row.consent_granted === null ||
      row.consent_at === null ||
      row.consent_source === null
        ? null
        : {
            granted: row.consent_granted,
            occurredAt: row.consent_at,
            source: row.consent_source,
          },
    brevo: rawStateOf(row, "b"),
    apollo: rawStateOf(row, "a"),
    owner:
      row.owner_id === null
        ? null
        : { accountId: row.owner_id, displayName: row.owner_name },
    lastSeenAt: row.last_seen_at,
  };
}

/** 05 RG97, RG98: one page of the list, newest first; `limit` lines at most. */
export async function listMemberAccounts(
  tx: Transaction,
  filters: AccountFilters,
  limit: number,
): Promise<MemberAccountRow[]> {
  const accountFilter =
    filters.email !== undefined
      ? sql`a.email = ${filters.email}`
      : filters.fragment !== undefined
        ? sql`strpos(a.email, ${filters.fragment}) > 0`
        : sql`true`;
  const rows = await memberAccounts(tx, {
    accountFilter,
    filters,
    limit,
    detail: false,
  });
  return rows.map(rowOf);
}

/** The record of one member account, or null: unknown and internal answer the same (T14.3). */
export async function memberAccountDetail(
  tx: Transaction,
  accountId: string,
): Promise<MemberAccountDetail | null> {
  const [row] = await memberAccounts(tx, {
    accountFilter: sql`a.id = ${accountId}::uuid`,
    filters: {},
    limit: 1,
    detail: true,
  });
  if (row === undefined) {
    return null;
  }
  return {
    ...rowOf(row),
    email: row.email ?? "",
    emailStatus: row.email_status ?? "unknown",
    companyName: row.company_name ?? null,
    suspendedAt: row.suspended_at ?? null,
    deletedAt: row.deleted_at ?? null,
  };
}

export type OwnershipEntry = {
  agentAccountId: string;
  agentDisplayName: string | null;
  assignedAt: string;
  unassignedAt: string | null;
  reasonCode: string;
};

/** 15 RG49: every responsible salesperson of the account, the most recent first. */
export async function ownershipOf(
  tx: Transaction,
  accountId: string,
): Promise<OwnershipEntry[]> {
  const rows = await tx.execute<{
    agent_id: string;
    agent_name: string | null;
    assigned_at: string;
    unassigned_at: string | null;
    reason_code: string;
  }>(sql`
    select o.agent_account_id::text as agent_id, g.display_name as agent_name,
           to_char(o.assigned_at at time zone 'UTC', ${ISO_UTC}) as assigned_at,
           to_char(o.unassigned_at at time zone 'UTC', ${ISO_UTC}) as unassigned_at,
           o.reason_code
      from backoffice.ownership_assignments o
      left join identity.accounts g on g.id = o.agent_account_id
     where o.account_id = ${accountId}::uuid
     order by o.assigned_at desc, o.id`);
  return rows.map((row) => ({
    agentAccountId: row.agent_id,
    agentDisplayName: row.agent_name,
    assignedAt: row.assigned_at,
    unassignedAt: row.unassigned_at,
    reasonCode: row.reason_code,
  }));
}
