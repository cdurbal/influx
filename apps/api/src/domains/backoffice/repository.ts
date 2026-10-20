// Database access of the backoffice domain, under the business role of the session (influx_admin
// for the dual control; influx_agent or influx_admin for the member accounts; 03 §1.3, §3.1).
// Parameterised queries only (S-1). The rules of the dual control are the database's (0130 to
// 0132): this module calls its functions and reads what influx_admin may read in aal2. Every
// refusal of those functions is 42501 `forbidden`.
import { sql, type SQL } from "drizzle-orm";
import type { BusinessRole, Transaction } from "../../db/index.ts";
import type {
  INTERNAL_INVITATION_REASONS,
  INVITATION_REVOKE_REASONS,
} from "@influx/contracts/backoffice-invitations";
import type { StoredApolloSetting } from "./apollo-settings.ts";
import type { RawSyncState } from "./sync-causes.ts";

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** The closed list of 2V actions (0131, 0132, 0134, 0136 backoffice.canonical_dual_control_payload()). */
export const DUAL_CONTROL_ACTION_CODES = [
  "identity.grant_role",
  "identity.change_member_role",
  "identity.invite_admin",
  "leads.change_apollo_setting",
  "privacy.approve_data_request",
] as const;
export type DualControlActionCode = (typeof DUAL_CONTROL_ACTION_CODES)[number];

export type DualControlState =
  "pending" | "confirmed" | "degraded" | "cancelled" | "expired";

/** PD5: how a request was confirmed, as the register line of its action carries it. */
export type DualControlMode = "peer" | "degraded_single_operator";

/** The canonical payload of 0131, 0132, 0134: identifiers, codes and the confirmed values. */
export type DualControlPayload =
  | { account_id: string; role: BusinessRole }
  | { account_id: string; role: "advertiser"; legal_name: string }
  | { invitation_id: string }
  | StoredApolloSetting
  | { request_id: string; request_type: "access" | "erasure" };

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

/** 0134 (RG81): backoffice.change_apollo_setting(), by the confirmer; the accounts re-evaluated. */
export async function changeApolloSetting(
  tx: Transaction,
  sessionId: string,
  requestId: string,
  call: { setting: StoredApolloSetting; reasonCode: string },
): Promise<number> {
  const rows = await tx.execute<{ reevaluated: number }>(
    sql`select backoffice.change_apollo_setting(${sessionId}::uuid, ${requestId}::uuid,
                                                ${call.setting.key},
                                                ${JSON.stringify(call.setting.value)}::jsonb,
                                                ${call.reasonCode}) as reevaluated`,
  );
  return rows[0]?.reevaluated ?? 0;
}

/**
 * 0136 (15 RG75 step 6, RG76): backoffice.approve_data_request_execution(), by the confirmer. It
 * approves; the worker executes (E-5, 03 P7 "déclenché par une tâche").
 */
export async function approveDataRequestExecution(
  tx: Transaction,
  sessionId: string,
  requestId: string,
  call: {
    dataRequestId: string;
    requestType: "access" | "erasure";
    reasonCode: string;
  },
): Promise<void> {
  await tx.execute(
    sql`select backoffice.approve_data_request_execution(
                 ${sessionId}::uuid, ${requestId}::uuid, ${call.dataRequestId}::uuid,
                 ${call.requestType}::backoffice.data_request_type, ${call.reasonCode})`,
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

export type AccountDataRequestRow = {
  id: string;
  requestType: string;
  receivedAt: string;
  dueAt: string;
  status: string;
  completedAt: string | null;
  outcomeCode: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  executedAt: string | null;
  authUserDeletedAt: string | null;
  exportPublishedAt: string | null;
  exportExpiresAt: string | null;
  exportDownloads: number | null;
  exportPurgedAt: string | null;
};

/**
 * 15 §G (J8 commit 8): the "mes données" requests of a member account, the most recent first, with
 * their execution (0136) and the metadata of their export, NEVER its content (agent and admin in
 * aal2; the columns granted by 0136 only).
 */
export async function dataRequestsOf(
  tx: Transaction,
  accountId: string,
): Promise<AccountDataRequestRow[]> {
  const rows = await tx.execute<{
    id: string;
    request_type: string;
    received_at: string;
    due_at: string;
    status: string;
    completed_at: string | null;
    outcome_code: string | null;
    approved_at: string | null;
    approved_by: string | null;
    executed_at: string | null;
    auth_user_deleted_at: string | null;
    export_published_at: string | null;
    export_expires_at: string | null;
    export_downloads: number | null;
    export_purged_at: string | null;
  }>(sql`
    select r.id::text as id, r.request_type::text as request_type,
           to_char(r.received_at at time zone 'UTC', ${ISO_UTC}) as received_at,
           to_char(r.due_at at time zone 'UTC', ${ISO_UTC}) as due_at,
           r.status::text as status,
           to_char(r.completed_at at time zone 'UTC', ${ISO_UTC}) as completed_at,
           r.outcome_code::text as outcome_code,
           to_char(e.approved_at at time zone 'UTC', ${ISO_UTC}) as approved_at,
           e.approved_by_account_id::text as approved_by,
           to_char(e.executed_at at time zone 'UTC', ${ISO_UTC}) as executed_at,
           to_char(e.auth_user_deleted_at at time zone 'UTC', ${ISO_UTC}) as auth_user_deleted_at,
           to_char(x.published_at at time zone 'UTC', ${ISO_UTC}) as export_published_at,
           to_char(x.expires_at at time zone 'UTC', ${ISO_UTC}) as export_expires_at,
           x.downloads_count as export_downloads,
           to_char(x.purged_at at time zone 'UTC', ${ISO_UTC}) as export_purged_at
      from backoffice.data_subject_requests r
      left join privacy.request_executions e on e.request_id = r.id
      left join privacy.data_exports x on x.request_id = r.id
     where r.requester_account_id = ${accountId}::uuid
     order by r.received_at desc, r.id`);
  return rows.map((row) => ({
    id: row.id,
    requestType: row.request_type,
    receivedAt: row.received_at,
    dueAt: row.due_at,
    status: row.status,
    completedAt: row.completed_at,
    outcomeCode: row.outcome_code,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    executedAt: row.executed_at,
    authUserDeletedAt: row.auth_user_deleted_at,
    exportPublishedAt: row.export_published_at,
    exportExpiresAt: row.export_expires_at,
    exportDownloads:
      row.export_downloads === null ? null : Number(row.export_downloads),
    exportPurgedAt: row.export_purged_at,
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

// ---------------------------------------------------------------------------------------------
// The action API of the backoffice v0 (05 RG81, RG93, RG101 to RG104, RG108; 15 §F; J8 commit 6),
// under influx_agent or influx_admin in aal2. The rules are the database's: the replay (0132
// leads.replay_outbox_lines), the corrections (0132 identity.correct_member_account), the Apollo
// keys and the suppression lift (0134, admin, R), the trace of a refused attempt (0134). The alert
// reads are plain reads of what agent and admin may read in aal2 (0101, 0129, 0130), and the last
// reconciliation through its function (0134, admin).
// ---------------------------------------------------------------------------------------------

/**
 * A Postgres array literal, every element quoted: drizzle expands a JS array into a list of
 * parameters, not into one array parameter.
 */
function arrayLiteral(values: readonly (string | number)[]): string {
  return `{${values
    .map((value) => `"${String(value).replace(/["\\]/g, "\\$&")}"`)
    .join(",")}}`;
}

/** The two contact destinations of the queue (0101). */
export type ContactDestination = "brevo_contact" | "apollo_contact";

// ---------------------------------------------------------------------------------------------
// Replay (05 RG101 to RG103)
// ---------------------------------------------------------------------------------------------

/** What the replay needs to know of one (account, destination) pair, read before the call. */
export type ReplayCandidate = {
  accountId: string;
  destination: ContactDestination;
  /** The failed lines of the pair, oldest first (0101 internal ids, never exposed). */
  failedIds: number[];
  /** A line of the pair waits or is in processing. */
  live: boolean;
  lastStatus: string | null;
  lastCode: string | null;
};

/**
 * The pairs of MEMBER accounts among `pairs` (an internal or unknown account is absent: the route
 * reports it as nothing to replay, like any pair without a failed line).
 */
export async function replayCandidates(
  tx: Transaction,
  pairs: readonly { accountId: string; destination: ContactDestination }[],
): Promise<ReplayCandidate[]> {
  const rows = await tx.execute<{
    account_id: string;
    destination: ContactDestination;
    failed_ids: number[];
    live: boolean;
    last_status: string | null;
    last_code: string | null;
  }>(sql`
    select p.account_id::text as account_id, p.destination,
           (select coalesce(jsonb_agg(o.id order by o.id), '[]'::jsonb)
              from leads.outbox_events o
             where o.subject_key = 'account:' || p.account_id::text
               and o.destination = p.destination::leads.outbox_destination
               and o.status = 'failed') as failed_ids,
           exists (select 1
                     from leads.outbox_events o
                    where o.subject_key = 'account:' || p.account_id::text
                      and o.destination = p.destination::leads.outbox_destination
                      and o.status in ('pending', 'processing')) as live,
           s.last_status::text as last_status, s.last_error_code as last_code
      from unnest(${arrayLiteral(pairs.map((pair) => pair.accountId))}::uuid[],
                  ${arrayLiteral(pairs.map((pair) => pair.destination))}::text[])
           as p (account_id, destination)
      join identity.account_roles r
        on r.account_id = p.account_id and r.role in ('advertiser', 'creator')
      left join leads.contact_sync_states s
        on s.account_id = p.account_id
       and s.destination = p.destination::leads.outbox_destination`);
  return rows.map((row) => ({
    accountId: row.account_id,
    destination: row.destination,
    failedIds: row.failed_ids.map(Number),
    live: row.live,
    lastStatus: row.last_status,
    lastCode: row.last_code,
  }));
}

export type ReplayLineOutcome = {
  replayId: string;
  outboxId: number;
  outcome: "requeued" | "ignored" | "refused";
  detail: string | null;
};

/** 0132: the replay of 1 to 200 lines, one winner per line (CA61), journaled as one object. */
export async function replayOutboxLines(
  tx: Transaction,
  outboxIds: readonly number[],
  reasonCode: string,
): Promise<ReplayLineOutcome[]> {
  const rows = await tx.execute<{
    replay_id: string;
    outbox_id: string;
    outcome: ReplayLineOutcome["outcome"];
    detail: string | null;
  }>(
    sql`select replay_id::text as replay_id, outbox_id::text as outbox_id, outcome, detail
          from leads.replay_outbox_lines(${arrayLiteral(outboxIds)}::bigint[], ${reasonCode})`,
  );
  return rows.map((row) => ({
    replayId: row.replay_id,
    outboxId: Number(row.outbox_id),
    outcome: row.outcome,
    detail: row.detail,
  }));
}

// ---------------------------------------------------------------------------------------------
// Corrections (05 RG108) and the suppression lift (05 RG93)
// ---------------------------------------------------------------------------------------------

/** 0132: false when nothing changes. 22023, 23514, 23503 or 42501 otherwise (see the route). */
export async function correctMemberAccount(
  tx: Transaction,
  accountId: string,
  correction: {
    reasonCode: string;
    declaredStatus: "individual" | "business" | null;
    countryCode: string | null;
    preferredLanguage: string | null;
    comment: string | null;
  },
): Promise<boolean> {
  const rows = await tx.execute<{ changed: boolean }>(
    sql`select identity.correct_member_account(
                 ${accountId}::uuid, ${correction.reasonCode},
                 ${correction.declaredStatus}::identity.declared_status,
                 ${correction.countryCode}, ${correction.preferredLanguage},
                 ${correction.comment}) as changed`,
  );
  return rows[0]?.changed === true;
}

/** 0134: with R on `sessionId`; true when a consent is sent again to Brevo (EC-J8-27). */
export async function liftBrevoSuppression(
  tx: Transaction,
  sessionId: string,
  accountId: string,
  call: { reasonCode: string; comment: string | null },
): Promise<boolean> {
  const rows = await tx.execute<{ resync: boolean }>(
    sql`select backoffice.lift_brevo_suppression(${sessionId}::uuid, ${accountId}::uuid,
                                                 ${call.reasonCode}, ${call.comment}) as resync`,
  );
  return rows[0]?.resync === true;
}

/** The admin actions an agent may attempt, and whose refusal is journaled (0134, CA63). */
export type RefusedActionCode =
  | "leads.change_apollo_setting"
  | "leads.read_apollo_settings"
  | "leads.lift_brevo_suppression"
  | "backoffice.dual_control"
  | "identity.change_member_role"
  | "identity.internal_invitation";

/** 0134: backoffice.action_refused on the agent's own account (influx_agent only). */
export async function recordRefusedAction(
  tx: Transaction,
  actionCode: RefusedActionCode,
): Promise<void> {
  await tx.execute(sql`select backoffice.record_refused_action(${actionCode})`);
}

// ---------------------------------------------------------------------------------------------
// Apollo settings (05 RG81)
// ---------------------------------------------------------------------------------------------

export type ApolloSettingRow = {
  key: string;
  value: unknown;
  updatedAt: string;
  updatedBy: string | null;
};

/** 0134: the three Apollo keys (admin). */
export async function readApolloSettings(
  tx: Transaction,
): Promise<ApolloSettingRow[]> {
  const rows = await tx.execute<{
    key: string;
    value: unknown;
    updated_at: string;
    updated_by: string | null;
  }>(sql`
    select s.key, s.value, to_char(s.updated_at at time zone 'UTC', ${ISO_UTC}) as updated_at,
           s.updated_by_account_id::text as updated_by
      from backoffice.read_apollo_settings() s`);
  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));
}

// ---------------------------------------------------------------------------------------------
// Alerts (05 RG104; 15 §F AL24 to AL27)
// ---------------------------------------------------------------------------------------------

export type AlertDefinitionRow = {
  code: string;
  threshold: Record<string, unknown>;
  recipients: string[];
};

/** The active definitions of the codes asked (0130, 0134), thresholds as data. */
export async function alertDefinitions(
  tx: Transaction,
  codes: readonly string[],
): Promise<AlertDefinitionRow[]> {
  const rows = await tx.execute<{
    code: string;
    threshold_value: Record<string, unknown>;
    recipient_roles: string[];
  }>(sql`
    select d.code, d.threshold_value, d.recipient_roles
      from backoffice.alert_definitions d
     where d.code = any(${arrayLiteral(codes)}::text[]) and d.is_active`);
  return rows.map((row) => ({
    code: row.code,
    threshold: row.threshold_value,
    recipients: row.recipient_roles,
  }));
}

export type QueuePolicyRow = {
  targetDecisionMinutes: number;
  businessHours: Record<string, unknown> | null;
};

/** 0129: the delay of a queue and its business hours (null: calendar time). */
export async function queuePolicy(
  tx: Transaction,
  queueCode: string,
): Promise<QueuePolicyRow | null> {
  const [row] = await tx.execute<{
    target_decision_minutes: number;
    business_hours: Record<string, unknown> | null;
  }>(sql`
    select p.target_decision_minutes, p.business_hours
      from backoffice.sla_policies p
     where p.queue_code = ${queueCode} and p.is_active`);
  return row === undefined
    ? null
    : {
        targetDecisionMinutes: row.target_decision_minutes,
        businessHours: row.business_hours,
      };
}

/** The database clock: every alert is evaluated against it, never another one. */
export async function databaseNow(tx: Transaction): Promise<string> {
  const [row] = await tx.execute<{ now: string }>(
    sql`select to_char(now() at time zone 'UTC', ${ISO_UTC}) as now`,
  );
  if (row === undefined) {
    throw new Error("the database clock returned no row");
  }
  return row.now;
}

export type FailuresPastDelayRow = {
  destination: ContactDestination;
  count: number;
  oldestAt: string;
};

/**
 * AL24: the failed contact lines whose failure is older than `cutoff`, per destination; for an
 * agent (`ownerAgentId`), those of the accounts he is responsible for (owner_agent).
 */
export async function failuresPastDelay(
  tx: Transaction,
  cutoff: string,
  ownerAgentId: string | null,
): Promise<FailuresPastDelayRow[]> {
  const owner =
    ownerAgentId === null
      ? sql`true`
      : sql`exists (select 1 from identity.accounts a
                     where 'account:' || a.id::text = o.subject_key
                       and a.owner_agent_id = ${ownerAgentId}::uuid)`;
  const rows = await tx.execute<{
    destination: ContactDestination;
    count: number;
    oldest_at: string;
  }>(sql`
    select o.destination::text as destination, count(*)::integer as count,
           to_char(min(o.completed_at) at time zone 'UTC', ${ISO_UTC}) as oldest_at
      from leads.outbox_events o
     where o.status = 'failed'
       and o.destination in ('brevo_contact', 'apollo_contact')
       and o.completed_at <= ${cutoff}::timestamptz
       and ${owner}
     group by o.destination
     order by o.destination`);
  return rows.map((row) => ({
    destination: row.destination,
    count: row.count,
    oldestAt: row.oldest_at,
  }));
}

/** AL25: the health of one contact destination, as the queue tells it. */
export type DestinationHealthRow = {
  destination: ContactDestination;
  /** Lines pending or in processing (CA62 "le nombre de lignes en attente"). */
  waiting: number;
  /** Waiting lines that already failed at least once, created before the window. */
  retryingOld: number;
  oldestRetryingAt: string | null;
  /** Retrying lines whose last error is a quota code. */
  quotaErrors: number;
  /** Unhandled lines (waiting or failed) whose last error is a refused key. */
  keyRefused: number;
  oldestKeyRefusedAt: string | null;
  /** A line of this destination succeeded within the window. */
  recentSuccess: boolean;
};

export async function destinationHealth(
  tx: Transaction,
  options: {
    windowMinutes: number;
    immediateCodes: readonly string[];
    quotaCodes: readonly string[];
  },
): Promise<DestinationHealthRow[]> {
  const window = sql`now() - make_interval(mins => ${options.windowMinutes}::integer)`;
  const rows = await tx.execute<{
    destination: ContactDestination;
    waiting: number;
    retrying_old: number;
    oldest_retrying_at: string | null;
    quota_errors: number;
    key_refused: number;
    oldest_key_refused_at: string | null;
    recent_success: boolean;
  }>(sql`
    select d.destination,
           (select count(*)::integer from leads.outbox_events o
             where o.destination = d.destination::leads.outbox_destination
               and o.status in ('pending', 'processing')) as waiting,
           (select count(*)::integer from leads.outbox_events o
             where o.destination = d.destination::leads.outbox_destination
               and o.status in ('pending', 'processing') and o.attempts > 0
               and o.last_error_code is not null and o.created_at <= ${window}) as retrying_old,
           (select to_char(min(o.created_at) at time zone 'UTC', ${ISO_UTC})
              from leads.outbox_events o
             where o.destination = d.destination::leads.outbox_destination
               and o.status in ('pending', 'processing') and o.attempts > 0
               and o.last_error_code is not null) as oldest_retrying_at,
           (select count(*)::integer from leads.outbox_events o
             where o.destination = d.destination::leads.outbox_destination
               and o.status in ('pending', 'processing') and o.attempts > 0
               and o.last_error_code = any(${arrayLiteral(options.quotaCodes)}::text[])) as quota_errors,
           (select count(*)::integer from leads.outbox_events o
             where o.destination = d.destination::leads.outbox_destination
               and o.status in ('pending', 'processing', 'failed')
               and o.last_error_code = any(${arrayLiteral(options.immediateCodes)}::text[])) as key_refused,
           (select to_char(min(o.updated_at) at time zone 'UTC', ${ISO_UTC})
              from leads.outbox_events o
             where o.destination = d.destination::leads.outbox_destination
               and o.status in ('pending', 'processing', 'failed')
               and o.last_error_code = any(${arrayLiteral(options.immediateCodes)}::text[]))
             as oldest_key_refused_at,
           exists (select 1 from leads.outbox_events o
                    where o.destination = d.destination::leads.outbox_destination
                      and o.status = 'succeeded' and o.completed_at > ${window}) as recent_success
      from (values ('brevo_contact'), ('apollo_contact')) as d (destination)
     order by d.destination`);
  return rows.map((row) => ({
    destination: row.destination,
    waiting: row.waiting,
    retryingOld: row.retrying_old,
    oldestRetryingAt: row.oldest_retrying_at,
    quotaErrors: row.quota_errors,
    keyRefused: row.key_refused,
    oldestKeyRefusedAt: row.oldest_key_refused_at,
    recentSuccess: row.recent_success,
  }));
}

/** AL26: the contact lines past their objective (RG79), over one sliding day of lines. */
export type QueueDelayRow = {
  destination: ContactDestination;
  /** Lines created between `objective + 24 h` and `objective` ago, not skipped. */
  eligible: number;
  /** Of them, completed within the objective (a dry run counts: the worker processed it). */
  inTime: number;
  oldestLateAt: string | null;
};

export async function queueDelays(
  tx: Transaction,
  objectives: Readonly<Record<ContactDestination, number>>,
): Promise<QueueDelayRow[]> {
  const rows = await tx.execute<{
    destination: ContactDestination;
    eligible: number;
    in_time: number;
    oldest_late_at: string | null;
  }>(sql`
    with objective as (
      select d.destination, make_interval(mins => d.minutes) as delay
        from (values ('brevo_contact', ${objectives.brevo_contact}::integer),
                     ('apollo_contact', ${objectives.apollo_contact}::integer))
             as d (destination, minutes)
    ), lines as (
      select j.destination, o.created_at, o.completed_at, o.status, j.delay
        from objective j
        join leads.outbox_events o
          on o.destination = j.destination::leads.outbox_destination
         and o.created_at <= now() - j.delay
         and o.created_at >  now() - j.delay - interval '24 hours'
         and o.status <> 'skipped'
    )
    select j.destination,
           (select count(*)::integer from lines l where l.destination = j.destination) as eligible,
           (select count(*)::integer from lines l
             where l.destination = j.destination and l.status = 'succeeded'
               and l.completed_at <= l.created_at + l.delay) as in_time,
           (select to_char(min(l.created_at) at time zone 'UTC', ${ISO_UTC}) from lines l
             where l.destination = j.destination
               and not (l.status = 'succeeded' and l.completed_at <= l.created_at + l.delay))
             as oldest_late_at
      from objective j
     order by j.destination`);
  return rows.map((row) => ({
    destination: row.destination,
    eligible: row.eligible,
    inTime: row.in_time,
    oldestLateAt: row.oldest_late_at,
  }));
}

export type ReconciliationRow = {
  periodKey: string;
  finishedAt: string;
  outcome: "succeeded" | "failed";
  gap: number;
};

/** AL27 (0134, admin): the last finished Brevo reconciliation, or null before the first one. */
export async function lastBrevoReconciliation(
  tx: Transaction,
): Promise<ReconciliationRow | null> {
  const [row] = await tx.execute<{
    period_key: string;
    finished_at: string;
    outcome: "succeeded" | "failed";
    gap: number;
  }>(sql`
    select r.period_key, to_char(r.finished_at at time zone 'UTC', ${ISO_UTC}) as finished_at,
           r.outcome, r.gap
      from backoffice.last_brevo_reconciliation() r`);
  return row === undefined
    ? null
    : {
        periodKey: row.period_key,
        finishedAt: row.finished_at,
        outcome: row.outcome,
        gap: row.gap,
      };
}

// ---------------------------------------------------------------------------------------------
// Invitations (0131; 15 RG99, 05 RG116 to RG119): two objects never merged (EC-J8-2). The digests
// are never read back; the lists are what the business role may read in aal2.
// ---------------------------------------------------------------------------------------------

/** 15 RG99 (admin, R on `sessionId`): an internal invitation of 72 hours. */
export async function createInternalInvitation(
  tx: Transaction,
  sessionId: string,
  invitation: {
    email: string;
    role: "agent" | "admin";
    tokenHash: Buffer;
    reasonCode: string;
  },
): Promise<{
  invitationId: string;
  expiresAt: string;
  requiresDualControl: boolean;
}> {
  const [row] = await tx.execute<{
    invitation_id: string;
    expires_at: string;
    requires_dual_control: boolean;
  }>(sql`
    select i.invitation_id::text,
           to_char(i.expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at,
           i.requires_dual_control
      from identity.create_internal_invitation(${sessionId}::uuid, ${invitation.email},
                                               ${invitation.role}::identity.account_role,
                                               ${invitation.tokenHash},
                                               ${invitation.reasonCode}) i`);
  if (row === undefined) {
    throw new Error("identity.create_internal_invitation returned no row");
  }
  return {
    invitationId: row.invitation_id,
    expiresAt: row.expires_at,
    requiresDualControl: row.requires_dual_control,
  };
}

/** 15 RG99 (admin): revokes an unused internal invitation. */
export async function revokeInternalInvitation(
  tx: Transaction,
  invitationId: string,
  reasonCode: string,
): Promise<void> {
  await tx.execute(
    sql`select identity.revoke_internal_invitation(${invitationId}::uuid, ${reasonCode})`,
  );
}

/** The closed lists of 0131 (the CHECK of the functions): read as they are written. */
type InternalInvitationReason = (typeof INTERNAL_INVITATION_REASONS)[number];
type InvitationRevokeReason = (typeof INVITATION_REVOKE_REASONS)[number];

export type InternalInvitationRow = {
  id: string;
  email: string;
  role: "agent" | "admin";
  reasonCode: InternalInvitationReason;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  state:
    "awaiting_dual_control" | "pending" | "accepted" | "revoked" | "expired";
  dualControlRequestId: string | null;
  accountId: string | null;
  revokeReasonCode: InvitationRevokeReason | null;
};

/** The newest internal invitations (admin, aal2: policy internal_invitations_admin_select). */
export async function internalInvitations(
  tx: Transaction,
  limit: number,
): Promise<InternalInvitationRow[]> {
  const rows = await tx.execute<{
    id: string;
    email: string;
    role: "agent" | "admin";
    reason_code: InternalInvitationReason;
    created_by: string;
    created_at: string;
    expires_at: string;
    state: InternalInvitationRow["state"];
    dual_control_request_id: string | null;
    account_id: string | null;
    revoke_reason_code: InvitationRevokeReason | null;
  }>(sql`
    select i.id::text, i.email, i.proposed_role::text as role, i.reason_code,
           i.created_by_account_id::text as created_by,
           to_char(i.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(i.expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at,
           case when i.accepted_at is not null then 'accepted'
                when i.revoked_at is not null then 'revoked'
                when i.expires_at <= now() then 'expired'
                when i.requires_dual_control and i.confirmed_at is null
                  then 'awaiting_dual_control'
                else 'pending' end as state,
           i.dual_control_request_id::text as dual_control_request_id,
           i.account_id::text as account_id, i.revoke_reason_code
      from identity.internal_invitations i
     order by i.created_at desc, i.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    reasonCode: row.reason_code,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    state: row.state,
    dualControlRequestId: row.dual_control_request_id,
    accountId: row.account_id,
    revokeReasonCode: row.revoke_reason_code,
  }));
}

/** 05 RG116 (agent, admin): a member invitation; 23505 for an address taken (EC-J8-15). */
export async function createMemberInvitation(
  tx: Transaction,
  invitation: {
    email: string;
    proposedRole: "advertiser" | "creator";
    preferredLanguage: string;
    codeHash: Buffer;
  },
): Promise<{ invitationId: string; expiresAt: string }> {
  const [row] = await tx.execute<{
    invitation_id: string;
    expires_at: string;
  }>(sql`
    select i.invitation_id::text,
           to_char(i.expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at
      from backoffice.create_member_invitation(${invitation.email},
                                               ${invitation.proposedRole}::identity.account_role,
                                               ${invitation.preferredLanguage},
                                               ${invitation.codeHash}) i`);
  if (row === undefined) {
    throw new Error("backoffice.create_member_invitation returned no row");
  }
  return { invitationId: row.invitation_id, expiresAt: row.expires_at };
}

/** 05 RG116: its author, or an admin, revokes an unredeemed member invitation. */
export async function revokeMemberInvitation(
  tx: Transaction,
  invitationId: string,
  reasonCode: string,
): Promise<void> {
  await tx.execute(
    sql`select backoffice.revoke_member_invitation(${invitationId}::uuid, ${reasonCode})`,
  );
}

export type MemberInvitationRow = {
  id: string;
  email: string;
  proposedRole: "advertiser" | "creator";
  preferredLanguage: "fr" | "en";
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  state: "pending" | "redeemed" | "revoked" | "expired";
  accountId: string | null;
};

/**
 * The newest member invitations: an agent's own (EC-J8-31), every one for an admin (policies
 * member_invitations_agent_select and member_invitations_admin_select, aal2; 0142 J8S-5: the
 * agent filter is enforced by the base too).
 */
export async function memberInvitations(
  tx: Transaction,
  authorId: string | null,
  limit: number,
): Promise<MemberInvitationRow[]> {
  const rows = await tx.execute<{
    id: string;
    email: string;
    proposed_role: "advertiser" | "creator";
    preferred_language: "fr" | "en";
    created_by: string;
    created_at: string;
    expires_at: string;
    state: MemberInvitationRow["state"];
    account_id: string | null;
  }>(sql`
    select i.id::text, i.email, i.proposed_role::text as proposed_role,
           i.preferred_language::text as preferred_language,
           i.created_by_account_id::text as created_by,
           to_char(i.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(i.expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at,
           case when i.redeemed_at is not null then 'redeemed'
                when i.revoked_at is not null then 'revoked'
                when i.expires_at <= now() then 'expired'
                else 'pending' end as state,
           i.account_id::text as account_id
      from backoffice.member_invitations i
     where ${authorId}::uuid is null or i.created_by_account_id = ${authorId}::uuid
     order by i.created_at desc, i.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    proposedRole: row.proposed_role,
    preferredLanguage: row.preferred_language,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    state: row.state,
    accountId: row.account_id,
  }));
}

// --- Screens of J8 commit 9 (17b §3.13, §3.14.e; 0138) ----------------------------------------------

export type InternalAccountRow = {
  id: string;
  firstName: string | null;
  email: string;
  role: "agent" | "admin";
  secondFactorActive: boolean;
  active: boolean;
  breakGlass: boolean;
  absence: { from: string; to: string } | null;
  ownedAccounts: number;
};

/**
 * 17b §3.13.a: the internal accounts — the active ones first, admins before agents, then by first
 * name — capped (admin, aal2). A deactivated account stays listed: its past actions keep its name.
 */
export async function internalAccounts(
  tx: Transaction,
  limit: number,
): Promise<InternalAccountRow[]> {
  const rows = await tx.execute<{
    id: string;
    first_name: string | null;
    email: string;
    role: "agent" | "admin";
    second_factor: boolean;
    active: boolean;
    break_glass: boolean;
    absence_from: string | null;
    absence_to: string | null;
    owned: number;
  }>(sql`
    select a.id::text, p.first_name, a.email::text as email, r.role::text as role,
           p.mfa_factor_id is not null as second_factor,
           a.status = 'active' and p.is_active as active,
           p.is_break_glass as break_glass,
           to_char(p.absence_from, 'YYYY-MM-DD') as absence_from,
           to_char(p.absence_to, 'YYYY-MM-DD') as absence_to,
           (select count(*)::int from identity.accounts m where m.owner_agent_id = a.id) as owned
      from identity.accounts a
      join identity.account_roles r  on r.account_id = a.id and r.role in ('agent', 'admin')
      join identity.agent_profiles p on p.account_id = a.id
     order by (a.status = 'active' and p.is_active) desc, (r.role = 'admin') desc,
              p.first_name nulls last, a.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    firstName: row.first_name,
    email: row.email,
    role: row.role,
    secondFactorActive: row.second_factor,
    active: row.active,
    breakGlass: row.break_glass,
    absence:
      row.absence_from !== null && row.absence_to !== null
        ? { from: row.absence_from, to: row.absence_to }
        : null,
    ownedAccounts: row.owned,
  }));
}

/** The pending, unexpired 2V requests, newest first (admin, aal2). */
export async function pendingDualControlIds(
  tx: Transaction,
  limit: number,
): Promise<string[]> {
  const rows = await tx.execute<{ id: string }>(
    sql`select r.id::text as id
          from backoffice.dual_control_requests r
         where r.state = 'pending' and r.expires_at > now()
         order by r.requested_at desc, r.id
         limit ${limit}`,
  );
  return rows.map((row) => row.id);
}

export type NewBrowserSignInRow = {
  accountId: string;
  firstName: string | null;
  signedInAt: string;
  browser: string;
};

/** B-7 (0138 backoffice.new_browser_sign_ins, admin only): the signals of the last `days` days. */
export async function newBrowserSignIns(
  tx: Transaction,
  days: number,
): Promise<NewBrowserSignInRow[]> {
  const rows = await tx.execute<{
    account_id: string;
    first_name: string | null;
    signed_in_at: string;
    browser: string;
  }>(
    sql`select s.account_id::text as account_id, s.first_name,
               to_char(s.occurred_at at time zone 'UTC', ${ISO_UTC}) as signed_in_at, s.browser
          from backoffice.new_browser_sign_ins(${days}) s`,
  );
  return rows.map((row) => ({
    accountId: row.account_id,
    firstName: row.first_name,
    signedInAt: row.signed_in_at,
    browser: row.browser,
  }));
}
