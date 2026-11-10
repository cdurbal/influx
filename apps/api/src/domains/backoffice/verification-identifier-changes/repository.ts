// Database access of queue 6, "identifiants modifiés", of the backoffice (docs/mvp/08 RG78, CA54; 15 RG26 to
// RG28, RG33, RG34, RG36, C1 to C8; jalons/l2f/modele.md §3 "0233", §5; 0233; l2f commit 14), under
// influx_agent or influx_admin in aal2 (03 §1.3). Parameterised queries only (S-1). What queue 6 shares
// with queue 5 (counters, claim doors, the lock view) is in verification-queues/claimed/repository.ts.
// - The list carries NO identifier: not the former one, not the new one, not the declared one (fiche
//   invariants 7, 12): the alias of the creator, the network, how often the identifier changed.
// - The former and the new identifier come from `read_identifier_change_dossier()`, behind the live claim,
//   with the review token of the very snapshot (invariant 7, 13).
// - The writes are the doors of 0233: the claim, the token and every rule live there, once. A refusal of a
//   door is a database error: verification-queues/refusals.ts reads it.
import type { VerificationQueueSort } from "@influx/contracts/verification";
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { ISO_UTC } from "../sql-formats.ts";
import {
  claimedConditions,
  datedKey,
  primaryKeyOf,
  type ClaimedFilters,
} from "../verification-queues/claimed/repository.ts";
import type { Person } from "../verification-queues/repository.ts";

type Instant = string | null;

export type IdentifierChangeFilters = ClaimedFilters;

export type ListedIdentifierChange = {
  id: string;
  accountId: string;
  networkCode: string;
  displayName: string | null;
  countryCode: string;
  changeCount: number;
  createdAt: string;
  lastChangedAt: string;
  slaDueAt: string;
  escalateAt: string;
  overdue: boolean;
  owner: Person | null;
  held: boolean;
  holder: Person | null;
  claimedAt: Instant;
  claimExpiresAt: Instant;
  cursor: { primary: string; submittedAt: string; id: string };
};

/**
 * The open entries, in the order of `sort`: by default the oldest first. At most `limit` lines. No
 * identifier: the alias of the creator names the line.
 */
export async function listIdentifierChanges(
  tx: Transaction,
  caller: string,
  sort: VerificationQueueSort,
  filters: IdentifierChangeFilters,
  limit: number,
): Promise<ListedIdentifierChange[]> {
  const conditions = claimedConditions(
    "identifier_changes",
    filters,
    caller,
    sort,
  );
  const rows = await tx.execute<{
    id: string;
    account_id: string;
    network_code: string;
    display_name: string | null;
    country_code: string;
    change_count: number;
    created_at: string;
    last_changed_at: string;
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
    cursor_primary: string;
    cursor_submitted: string;
  }>(sql`
    select e.id::text as id, e.account_id::text as account_id, e.network_code,
           cp.alias as display_name, a.country_code::text as country_code, e.change_count,
           to_char(e.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(e.last_changed_at at time zone 'UTC', ${ISO_UTC}) as last_changed_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.sla_due_at < now()) as overdue,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           (e.claimed_by_account_id is not null and e.claim_expires_at > now()) as held,
           e.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(e.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(e.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           ${primaryKeyOf("identifier_changes", sort)} as cursor_primary,
           ${datedKey("identifier_changes")} as cursor_submitted
      from verification.identifier_change_reviews e
      join identity.accounts a on a.id = e.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
      left join profiles.creator_public_profiles cp on cp.account_id = e.account_id
     where ${sql.join(conditions, sql` and `)}
     order by ${primaryKeyOf("identifier_changes", sort)}, ${datedKey("identifier_changes")}, e.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    networkCode: row.network_code,
    displayName: row.display_name,
    countryCode: row.country_code,
    changeCount: row.change_count,
    createdAt: row.created_at,
    lastChangedAt: row.last_changed_at,
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
    cursor: {
      primary: row.cursor_primary,
      submittedAt: row.cursor_submitted,
      id: row.id,
    },
  }));
}

/** The columns of the lock view that are the entry's own (read with `readClaimView`). */
export const IDENTIFIER_CHANGE_EXTRA = sql`
  e.observed_handle as x_observed_handle`;

export type IdentifierChangeDossierRow = {
  reviewToken: string;
  networkCode: string;
  previousHandle: string | null;
  newHandle: string | null;
  changeCount: number;
  createdAt: string;
  lastChangedAt: string;
  handle: string | null;
  pseudonym: string | null;
  profileUrl: string | null;
  badgeId: string | null;
  badgeState: string | null;
  badgeGrantedAt: Instant;
  audienceBadgeId: string | null;
  audienceState: string | null;
  audienceExpiresAt: Instant;
};

/**
 * 08 RG78: the dossier of the entry the caller HOLDS, one row, with the review token of its own snapshot.
 * 55P03 without the live claim: an agent who does not hold it reads nothing.
 */
export async function readIdentifierChangeDossier(
  tx: Transaction,
  reviewId: string,
): Promise<IdentifierChangeDossierRow> {
  const rows = await tx.execute<{
    review_token: string;
    network_code: string;
    previous_handle: string | null;
    new_handle: string | null;
    change_count: number;
    created_at: string;
    last_changed_at: string;
    handle: string | null;
    pseudonym: string | null;
    profile_url: string | null;
    badge_id: string | null;
    badge_state: string | null;
    badge_granted_at: Instant;
    audience_badge_id: string | null;
    audience_state: string | null;
    audience_expires_at: Instant;
  }>(sql`
    select review_token, network_code, previous_handle, new_handle, change_count,
           to_char(created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
           to_char(last_changed_at at time zone 'UTC', ${ISO_UTC}) as last_changed_at,
           handle, pseudonym, profile_url, badge_id::text as badge_id, badge_state,
           to_char(badge_granted_at at time zone 'UTC', ${ISO_UTC}) as badge_granted_at,
           audience_badge_id::text as audience_badge_id, audience_state,
           to_char(audience_expires_at at time zone 'UTC', ${ISO_UTC}) as audience_expires_at
      from verification.read_identifier_change_dossier(${reviewId}::uuid)`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error(
      "verification.read_identifier_change_dossier() returned no row",
    );
  }
  return {
    reviewToken: row.review_token,
    networkCode: row.network_code,
    previousHandle: row.previous_handle,
    newHandle: row.new_handle,
    changeCount: row.change_count,
    createdAt: row.created_at,
    lastChangedAt: row.last_changed_at,
    handle: row.handle,
    pseudonym: row.pseudonym,
    profileUrl: row.profile_url,
    badgeId: row.badge_id,
    badgeState: row.badge_state,
    badgeGrantedAt: row.badge_granted_at,
    audienceBadgeId: row.audience_badge_id,
    audienceState: row.audience_state,
    audienceExpiresAt: row.audience_expires_at,
  };
}

// ---------------------------------------------------------------------------------------------
// The decisions (0233)
// ---------------------------------------------------------------------------------------------

/**
 * « Même compte » (EC-L2F-13): the handle typed must be the one declared (22023 `observed_handle_mismatch`);
 * the badge is never rewritten, nothing is sent.
 */
export async function confirmIdentifierChange(
  tx: Transaction,
  reviewId: string,
  reviewToken: string,
  input: { observedHandle: string; internalComment: string | null },
): Promise<{ decidedAt: string; late: boolean }> {
  const rows = await tx.execute<{ decided_at: string; sla_breached: boolean }>(
    sql`select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached
          from verification.confirm_identifier_change(
                 ${reviewId}::uuid, ${reviewToken}, ${input.observedHandle},
                 ${input.internalComment})`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.confirm_identifier_change() returned no row");
  }
  return { decidedAt: row.decided_at, late: row.sla_breached };
}

/**
 * « À reconfirmer »: « Compte vérifié » and the audience tenue of the line go to `to_reconfirm`, the public
 * line goes back to the declared one, the proof is asked again from the member's space.
 */
export async function requireIdentifierProof(
  tx: Transaction,
  reviewId: string,
  reviewToken: string,
  input: { internalComment: string | null },
): Promise<{
  decidedAt: string;
  late: boolean;
  badgeId: string | null;
  audienceBadgeIds: string[];
}> {
  const rows = await tx.execute<{
    decided_at: string;
    sla_breached: boolean;
    badge_id: string | null;
    audience_badge_ids: string[] | null;
  }>(
    sql`select to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached,
               badge_id::text as badge_id, pg_catalog.to_jsonb(audience_badge_ids) as audience_badge_ids
          from verification.require_identifier_proof(
                 ${reviewId}::uuid, ${reviewToken}, ${input.internalComment})`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.require_identifier_proof() returned no row");
  }
  return {
    decidedAt: row.decided_at,
    late: row.sla_breached,
    badgeId: row.badge_id,
    audienceBadgeIds: row.audience_badge_ids ?? [],
  };
}
