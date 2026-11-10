// SQL of the badges of an account and of the request of their withdrawal (docs/mvp/08 RG73 to RG76;
// 06 RG55; jalons/l2f/modele.md §3 "0231", §5; l2f commit 13). Every statement runs as influx_agent or
// influx_admin in aal2:
// - `verification.read_account_badges()` serves every badge of an account, whatever its state, with no
//   figure, no handle and no agent: the level, the network line, the state, the dates, the reason of a
//   withdrawal, the live request of one (with the effective state of its 2V) and the contest of the
//   decision that ended the badge.
// - `verification.request_badge_revocation()` is the one door that asks for a withdrawal: it opens the
//   2V `verification.revoke_badge` (the charge is the account, the badge and the reason; the message to
//   the member stays in the request table, never in the charge) and writes the line of the register.
// The rules are the database's (0231). The refusal of a door is a database error (refusals.ts reads it).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { ISO_UTC } from "../sql-formats.ts";

/** A badge of the account as the database serves it (0231, 0232). */
export type AccountBadgeRow = {
  id: string;
  level: string;
  networkCode: string | null;
  state: string;
  grantedAt: string;
  expiresAt: string | null;
  endedAt: string | null;
  revokedAt: string | null;
  revocationReasonCode: string | null;
  pendingRevocationId: string | null;
  pendingRevocationState: string | null;
  disputeId: string | null;
  disputeState: string | null;
};

/**
 * Whether the account is a MEMBER's (an advertiser or a creator): an unknown account and an internal
 * one answer the same (T14.3, T14.4); the caller's own account is hidden by the database.
 */
export async function isMemberAccount(
  tx: Transaction,
  accountId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ member: boolean }>(
    sql`select exists (
          select 1
            from identity.accounts a
            join identity.account_roles r
              on r.account_id = a.id and r.role in ('advertiser', 'creator')
           where a.id = ${accountId}::uuid) as member`,
  );
  return rows[0]?.member === true;
}

/** 0231 read_account_badges(): 42501 for the caller's own account and an unknown one. */
export async function readAccountBadges(
  tx: Transaction,
  accountId: string,
): Promise<AccountBadgeRow[]> {
  const rows = await tx.execute<{
    badge_id: string;
    level: string;
    network_code: string | null;
    state: string;
    granted_at: string;
    expires_at: string | null;
    ended_at: string | null;
    revoked_at: string | null;
    revocation_reason_code: string | null;
    pending_revocation_id: string | null;
    pending_revocation_state: string | null;
    dispute_id: string | null;
    dispute_state: string | null;
  }>(
    sql`select b.badge_id::text as badge_id, b.level::text as level, b.network_code, b.state,
               to_char(b.granted_at at time zone 'UTC', ${ISO_UTC}) as granted_at,
               to_char(b.expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at,
               to_char(b.ended_at at time zone 'UTC', ${ISO_UTC}) as ended_at,
               to_char(b.revoked_at at time zone 'UTC', ${ISO_UTC}) as revoked_at,
               b.revocation_reason_code,
               b.pending_revocation_id::text as pending_revocation_id,
               b.pending_revocation_state,
               b.dispute_id::text as dispute_id, b.dispute_state
          from verification.read_account_badges(${accountId}::uuid) b`,
  );
  return rows.map((row) => ({
    id: row.badge_id,
    level: row.level,
    networkCode: row.network_code,
    state: row.state,
    grantedAt: row.granted_at,
    expiresAt: row.expires_at,
    endedAt: row.ended_at,
    revokedAt: row.revoked_at,
    revocationReasonCode: row.revocation_reason_code,
    pendingRevocationId: row.pending_revocation_id,
    pendingRevocationState: row.pending_revocation_state,
    disputeId: row.dispute_id,
    disputeState: row.dispute_state,
  }));
}

/** The badge a request names, in the account the route names, and who holds that account. */
export type BadgeTarget = {
  level: string;
  ownerAgentId: string | null;
};

/**
 * The badge `badgeId` OF the account `accountId`, or null: an unknown badge, a badge of another
 * account and the caller's own account (hidden by the policy, C(3)) are one and the same answer.
 */
export async function badgeTargetOf(
  tx: Transaction,
  accountId: string,
  badgeId: string,
): Promise<BadgeTarget | null> {
  const rows = await tx.execute<{
    level: string;
    owner_agent_id: string | null;
  }>(
    sql`select b.level::text as level, a.owner_agent_id::text as owner_agent_id
          from verification.badges b
          join identity.accounts a on a.id = b.account_id
         where b.id = ${badgeId}::uuid and b.account_id = ${accountId}::uuid`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { level: row.level, ownerAgentId: row.owner_agent_id };
}

/** 0231 request_badge_revocation(): opens the 2V; returns its id. */
export async function requestBadgeRevocation(
  tx: Transaction,
  badgeId: string,
  reasonCode: string,
  memberMessage: string | null,
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`select verification.request_badge_revocation(${badgeId}::uuid, ${reasonCode},
                                                    ${memberMessage})::text as id`,
  );
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error("verification.request_badge_revocation returned no id");
  }
  return id;
}
