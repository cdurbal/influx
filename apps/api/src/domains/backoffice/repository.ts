// Database access of the backoffice domain, under the business role of the session (influx_admin
// for the dual control; 03 §1.3, §3.1). Parameterised queries only (S-1). The rules of the dual
// control are the database's (0130 to 0132): this module calls its functions and reads what
// influx_admin may read in aal2. Every refusal of those functions is 42501 `forbidden`.
import { sql } from "drizzle-orm";
import type { BusinessRole, Transaction } from "../../db/index.ts";

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
