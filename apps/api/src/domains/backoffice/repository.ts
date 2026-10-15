// Database access of the backoffice domain, under the business role of the session (influx_admin
// for the dual control; influx_agent or influx_admin for the member accounts; 03 §1.3, §3.1).
// Parameterised queries only (S-1). The rules of the dual control are the database's (0130 to
// 0132): this module calls its functions and reads what influx_admin may read in aal2. Every
// refusal of those functions is 42501 `forbidden`.
import { sql, type SQL } from "drizzle-orm";
import type { BusinessRole, Transaction } from "../../db/index.ts";
import type { RawSyncState } from "./sync-causes.ts";

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** The closed list of 2V actions (0131, 0132 backoffice.canonical_dual_control_payload()). */
export const DUAL_CONTROL_ACTION_CODES = [
  "identity.grant_role",
  "identity.change_member_role",
  "identity.invite_admin",
] as const;
export type DualControlActionCode = (typeof DUAL_CONTROL_ACTION_CODES)[number];

export type DualControlState =
  "pending" | "confirmed" | "degraded" | "cancelled" | "expired";

/** PD5: how a request was confirmed, as the register line of its action carries it. */
export type DualControlMode = "peer" | "degraded_single_operator";

/** The canonical payload of 0131 / 0132: identifiers and codes only. */
export type DualControlPayload =
  { account_id: string; role: BusinessRole } | { invitation_id: string };

// --- Writes: the three functions of 0130 / 0131 (EXECUTE for influx_admin only) ------------------

/** PD4: requests a 2V action; the database checks the caller, the list and the payload. */
export async function requestDualControl(
  tx: Transaction,
  request: {
    actionCode: DualControlActionCode;
    payload: DualControlPayload;
    reasonCode: string;
    reasonNote: string | null;
  },
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`select backoffice.request_dual_control(${request.actionCode},
                                               ${JSON.stringify(request.payload)}::jsonb,
                                               ${request.reasonCode}, ${request.reasonNote})::text
               as id`,
  );
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error("backoffice.request_dual_control returned no id");
  }
  return id;
}

/** PD2, PD3, PD7: confirms with R on `sessionId`; the database chooses peer or degraded. */
export async function confirmDualControl(
  tx: Transaction,
  sessionId: string,
  requestId: string,
  degradedJustification: string | null,
): Promise<DualControlMode> {
  const rows = await tx.execute<{ mode: string }>(
    sql`select backoffice.confirm_dual_control(${sessionId}::uuid, ${requestId}::uuid,
                                               ${degradedJustification}) as mode`,
  );
  const mode = rows[0]?.mode;
  if (mode !== "peer" && mode !== "degraded_single_operator") {
    throw new Error("backoffice.confirm_dual_control returned no mode");
  }
  return mode;
}

/** 17b §3.13.c "Abandonner" / "Refuser la demande". */
export async function cancelDualControl(
  tx: Transaction,
  requestId: string,
): Promise<void> {
  await tx.execute(
    sql`select backoffice.cancel_dual_control(${requestId}::uuid)`,
  );
}

// --- The actions under 2V: each consumes its request once, with R in its transaction ----------

/** 0130: identity.grant_role(), by the confirmer. */
export async function grantRole(
  tx: Transaction,
  sessionId: string,
  requestId: string,
  call: { accountId: string; role: BusinessRole; reasonCode: string },
): Promise<void> {
  await tx.execute(
    sql`select identity.grant_role(${sessionId}::uuid, ${requestId}::uuid,
                                   ${call.accountId}::uuid, ${call.role}::identity.account_role,
                                   ${call.reasonCode})`,
  );
}

/** 0131 (EC-J8-12): identity.approve_admin_invitation(), by the confirmer. */
export async function approveAdminInvitation(
  tx: Transaction,
  sessionId: string,
  requestId: string,
  call: { invitationId: string; reasonCode: string },
): Promise<void> {
  await tx.execute(
    sql`select identity.approve_admin_invitation(${sessionId}::uuid, ${requestId}::uuid,
                                                 ${call.invitationId}::uuid, ${call.reasonCode})`,
  );
}

/** 0132 (EC-J8-17): identity.change_member_role(), creator to advertiser, by the confirmer. */
export async function changeMemberRole(
  tx: Transaction,
  sessionId: string,
  requestId: string,
  call: { accountId: string; reasonCode: string; legalName: string },
): Promise<void> {
  await tx.execute(
    sql`select identity.change_member_role(${sessionId}::uuid, ${requestId}::uuid,
                                           ${call.accountId}::uuid, 'advertiser',
                                           ${call.reasonCode}, ${call.legalName})`,
  );
}

// --- Reads (influx_admin, aal2: policies of 0004 and 0130) -----------------------------------------

export type DualControlRequestRow = {
  id: string;
  actionCode: string;
  payload: Record<string, unknown>;
  reasonCode: string;
  reasonNote: string | null;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  state: DualControlState;
  confirmedBy: string | null;
  confirmedAt: string | null;
  degradedConfirmedAt: string | null;
  cancelledBy: string | null;
  cancelledAt: string | null;
  consumedAt: string | null;
  /** The database clock of this read: the PD2 countdown never trusts another clock. */
  now: string;
};

export async function dualControlRequestOf(
  tx: Transaction,
  requestId: string,
): Promise<DualControlRequestRow | null> {
  const rows = await tx.execute<{
    id: string;
    action_code: string;
    payload: Record<string, unknown>;
    reason_code: string;
    reason_note: string | null;
    requested_by: string;
    requested_at: string;
    expires_at: string;
    state: DualControlState;
    confirmed_by: string | null;
    confirmed_at: string | null;
    degraded_confirmed_at: string | null;
    cancelled_by: string | null;
    cancelled_at: string | null;
    consumed_at: string | null;
    now: string;
  }>(
    sql`select r.id::text as id, r.action_code, r.payload, r.reason_code, r.reason_note,
               r.requested_by_account_id::text as requested_by,
               to_char(r.requested_at at time zone 'UTC', ${ISO_UTC}) as requested_at,
               to_char(r.expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at,
               r.state::text as state,
               r.confirmed_by_account_id::text as confirmed_by,
               to_char(r.confirmed_at at time zone 'UTC', ${ISO_UTC}) as confirmed_at,
               to_char(r.degraded_confirmed_at at time zone 'UTC', ${ISO_UTC})
                 as degraded_confirmed_at,
               r.cancelled_by_account_id::text as cancelled_by,
               to_char(r.cancelled_at at time zone 'UTC', ${ISO_UTC}) as cancelled_at,
               to_char(r.consumed_at at time zone 'UTC', ${ISO_UTC}) as consumed_at,
               to_char(now() at time zone 'UTC', ${ISO_UTC}) as now
          from backoffice.dual_control_requests r
         where r.id = ${requestId}::uuid`,
  );
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    id: row.id,
    actionCode: row.action_code,
    payload: row.payload,
    reasonCode: row.reason_code,
    reasonNote: row.reason_note,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    expiresAt: row.expires_at,
    state: row.state,
    confirmedBy: row.confirmed_by,
    confirmedAt: row.confirmed_at,
    degradedConfirmedAt: row.degraded_confirmed_at,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    consumedAt: row.consumed_at,
    now: row.now,
  };
}

/**
 * PD7, for the screen only: whether an admin other than `accountId` could confirm (active account
 * and profile, a pinned TOTP factor, not the break-glass account). The SAME condition as 0130
 * backoffice.has_peer_admin(), which decides at every confirmation; t8-dual-control-service ties
 * the two. Read at every call: no flag, no setting.
 */
export async function peerAdminExists(
  tx: Transaction,
  accountId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ peer: boolean }>(
    sql`select exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'admin'
            join identity.agent_profiles p on p.account_id = a.id
           where a.id <> ${accountId}::uuid
             and a.status = 'active'
             and p.is_active
             and not p.is_break_glass
             and p.mfa_factor_id is not null) as peer`,
  );
  return rows[0]?.peer === true;
}

/** 15 RG103: the break-glass account is never the second pair of eyes (0130 confirm refuses it). */
export async function isBreakGlassAccount(
  tx: Transaction,
  accountId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ break_glass: boolean }>(
    sql`select exists (select 1 from identity.agent_profiles
                        where account_id = ${accountId}::uuid and is_break_glass) as break_glass`,
  );
  return rows[0]?.break_glass === true;
}

export type DegradedConfirmationRow = {
  /** ISO week of the confirmation, UTC: `2026-W42`. */
  week: string;
  id: string;
  actionCode: string;
  reasonCode: string;
  requestedBy: string;
  requestedAt: string;
  degradedConfirmedAt: string;
  consumedAt: string | null;
};

/** PD6: the confirmations made alone over the last `weeks` ISO weeks, the most recent first. */
export async function degradedConfirmations(
  tx: Transaction,
  weeks: number,
): Promise<DegradedConfirmationRow[]> {
  const rows = await tx.execute<{
    week: string;
    id: string;
    action_code: string;
    reason_code: string;
    requested_by: string;
    requested_at: string;
    degraded_confirmed_at: string;
    consumed_at: string | null;
  }>(
    sql`select to_char(r.degraded_confirmed_at at time zone 'UTC', 'IYYY-"W"IW') as week,
               r.id::text as id, r.action_code, r.reason_code,
               r.requested_by_account_id::text as requested_by,
               to_char(r.requested_at at time zone 'UTC', ${ISO_UTC}) as requested_at,
               to_char(r.degraded_confirmed_at at time zone 'UTC', ${ISO_UTC})
                 as degraded_confirmed_at,
               to_char(r.consumed_at at time zone 'UTC', ${ISO_UTC}) as consumed_at
          from backoffice.dual_control_requests r
         where r.state = 'degraded'
           and r.degraded_confirmed_at
               >= date_trunc('week', now() at time zone 'UTC') at time zone 'UTC'
                  - make_interval(weeks => ${weeks - 1}::integer)
         order by r.degraded_confirmed_at desc, r.id`,
  );
  return rows.map((row) => ({
    week: row.week,
    id: row.id,
    actionCode: row.action_code,
    reasonCode: row.reason_code,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    degradedConfirmedAt: row.degraded_confirmed_at,
    consumedAt: row.consumed_at,
  }));
}

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

export type HistoryRow = {
  seq: number;
  occurredAt: string;
  eventType: string;
  actorType: "member" | "agent" | "admin" | "system" | "service";
  actorAccountId: string | null;
  payload: Record<string, unknown>;
};

/**
 * EC-31 (0132): `limit` lines of the register on the account, before `beforeSeq`; the database
 * journals the consultation (history.account_read), which is also the journal of the opening of
 * the record (RG40, EC-J8-24).
 */
export async function accountHistory(
  tx: Transaction,
  accountId: string,
  limit: number,
  beforeSeq: number | null,
): Promise<HistoryRow[]> {
  const rows = await tx.execute<{
    seq: string;
    occurred_at: string;
    event_type: string;
    actor_type: HistoryRow["actorType"];
    actor_account_id: string | null;
    payload: Record<string, unknown>;
  }>(sql`
    select h.seq::text as seq,
           to_char(h.occurred_at at time zone 'UTC', ${ISO_UTC}) as occurred_at,
           h.event_type, h.actor_type, h.actor_account_id::text as actor_account_id, h.payload
      from backoffice.read_subject_history('account', ${accountId}::uuid, ${limit}::integer,
                                           ${beforeSeq}::bigint) h`);
  return rows.map((row) => ({
    seq: Number(row.seq),
    occurredAt: row.occurred_at,
    eventType: row.event_type,
    actorType: row.actor_type,
    actorAccountId: row.actor_account_id,
    payload: row.payload,
  }));
}

/** 0133, RG98: reserves one partial search (journaled either way); false beyond the limit. */
export async function reserveAccountSearch(
  tx: Transaction,
  termLength: number,
): Promise<boolean> {
  const rows = await tx.execute<{ allowed: boolean }>(
    sql`select backoffice.reserve_account_search(${termLength}::integer) as allowed`,
  );
  return rows[0]?.allowed === true;
}

export type DayCounters = {
  day: string;
  total: number;
  advertiser: number;
  creator: number;
  countries: { countryCode: string; count: number }[];
  brevoSynced: number;
  brevoEligible: number;
  apolloSynced: number;
  apolloEligible: number;
  brevoFailures: number;
  apolloFailures: number;
};

/**
 * 05 RG105, for the current UTC day: the sign-ups of member accounts, their countries, and the
 * share of their lead.created line delivered in time (a line skipped is a normal case and out of
 * the base, RG100; a dry run delivered nothing). The failures to handle are every failed contact
 * line, whatever its day (0101 failed_idx).
 */
export async function dayCounters(tx: Transaction): Promise<DayCounters> {
  const [totals] = await tx.execute<{
    day: string;
    total: number;
    advertiser: number;
    creator: number;
    brevo_synced: number;
    brevo_eligible: number;
    apollo_synced: number;
    apollo_eligible: number;
    brevo_failures: number;
    apollo_failures: number;
  }>(sql`
    with day as (
      select date_trunc('day', now() at time zone 'UTC') as start_utc
    ), signups as (
      select a.id, r.role
        from identity.accounts a
        join identity.account_roles r
          on r.account_id = a.id and r.role in ('advertiser', 'creator')
       where a.created_at >= (select start_utc from day) at time zone 'UTC'
    ), created_lines as (
      select o.destination, o.status, o.dry_run, o.created_at, o.completed_at
        from leads.outbox_events o
        join signups s on o.subject_key = 'account:' || s.id::text
       where o.event_type = 'lead.created'
         and o.destination in ('brevo_contact', 'apollo_contact')
    )
    select to_char((select start_utc from day), 'YYYY-MM-DD') as day,
           (select count(*)::integer from signups) as total,
           (select count(*)::integer from signups where role = 'advertiser') as advertiser,
           (select count(*)::integer from signups where role = 'creator') as creator,
           (select count(*)::integer from created_lines
             where destination = 'brevo_contact' and status = 'succeeded' and not dry_run
               and completed_at <= created_at + interval '1 hour') as brevo_synced,
           (select count(*)::integer from created_lines
             where destination = 'brevo_contact' and status <> 'skipped') as brevo_eligible,
           (select count(*)::integer from created_lines
             where destination = 'apollo_contact' and status = 'succeeded' and not dry_run
               and completed_at <= created_at + interval '24 hours') as apollo_synced,
           (select count(*)::integer from created_lines
             where destination = 'apollo_contact' and status <> 'skipped') as apollo_eligible,
           (select count(*)::integer from leads.outbox_events
             where status = 'failed' and destination = 'brevo_contact') as brevo_failures,
           (select count(*)::integer from leads.outbox_events
             where status = 'failed' and destination = 'apollo_contact') as apollo_failures`);
  if (totals === undefined) {
    throw new Error("the counters of the day returned no row");
  }
  const countries = await tx.execute<{ country_code: string; count: number }>(
    sql`
    select a.country_code::text as country_code, count(*)::integer as count
      from identity.accounts a
      join identity.account_roles r
        on r.account_id = a.id and r.role in ('advertiser', 'creator')
     where a.created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'
     group by a.country_code
     order by count(*) desc, a.country_code`,
  );
  return {
    day: totals.day,
    total: totals.total,
    advertiser: totals.advertiser,
    creator: totals.creator,
    countries: countries.map((row) => ({
      countryCode: row.country_code,
      count: row.count,
    })),
    brevoSynced: totals.brevo_synced,
    brevoEligible: totals.brevo_eligible,
    apolloSynced: totals.apollo_synced,
    apolloEligible: totals.apollo_eligible,
    brevoFailures: totals.brevo_failures,
    apolloFailures: totals.apollo_failures,
  };
}
