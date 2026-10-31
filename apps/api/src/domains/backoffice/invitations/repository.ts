// Database access of the internal and member invitations and of the internal accounts list
// (influx_admin or influx_agent, aal2; 03 §1.3). Parameterised queries only (S-1).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import type {
  INTERNAL_INVITATION_REASONS,
  INVITATION_REVOKE_REASONS,
} from "@influx/contracts/backoffice-invitations";
import { ISO_UTC } from "../sql-formats.ts";

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
