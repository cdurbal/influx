// Database access of queue 5, "contestations", of the backoffice (docs/mvp/08 RG77, CA52, CA53; 15 RG26
// to RG28, RG33, RG34, RG36, C1 to C8; jalons/l2f/modele.md §3 "0232", §5; 0232; l2f commit 14), under
// influx_agent or influx_admin in aal2 (03 §1.3). Parameterised queries only (S-1). What queue 5 shares
// with queue 6 (counters, claim doors, the lock view) is in verification-queues/claimed/repository.ts.
// - The list carries NO handle and NO text of the creator: the alias, the reason code, the level.
// - The text of the creator, the handle and the pieces' metadata come from `read_dispute_dossier()`, behind
//   the live claim, with the review token of the very snapshot (EC-L2F-07-9: every piece, its state, never
//   a key). The key of a piece comes from `read_dispute_evidence()`, which writes its register line.
// - The writes are the doors of 0232: the claim, the token, the persons (modele point 10) and every rule
//   live there, once. A refusal of a door is a database error, said by its SQLSTATE, MESSAGE (the code)
//   and DETAIL (the precision): verification-queues/refusals.ts reads it.
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

export type DisputeFilters = ClaimedFilters & {
  level?: string;
  /** `refusal` (a request refused) or `revocation` (a badge withdrawn). */
  kind?: string;
};

export type ListedDispute = {
  id: string;
  accountId: string;
  kind: "refusal" | "revocation";
  level: string;
  networkCode: string;
  displayName: string | null;
  countryCode: string;
  reasonCode: string;
  submittedAt: string;
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
 * The open contests, in the order of `sort` (08 RG62, as queue 4): by default the oldest submission first.
 * At most `limit` lines. No handle, no text: the alias of the creator names the line.
 */
export async function listDisputes(
  tx: Transaction,
  caller: string,
  sort: VerificationQueueSort,
  filters: DisputeFilters,
  limit: number,
): Promise<ListedDispute[]> {
  const conditions = claimedConditions("disputes", filters, caller, sort);
  if (filters.level !== undefined) {
    conditions.push(sql`e.level = ${filters.level}::verification.badge_level`);
  }
  if (filters.kind === "refusal") {
    conditions.push(sql`e.request_id is not null`);
  } else if (filters.kind === "revocation") {
    conditions.push(sql`e.badge_id is not null`);
  }
  const rows = await tx.execute<{
    id: string;
    account_id: string;
    is_refusal: boolean;
    level: string;
    network_code: string;
    display_name: string | null;
    country_code: string;
    reason_code: string;
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
    cursor_primary: string;
    cursor_submitted: string;
  }>(sql`
    select e.id::text as id, e.account_id::text as account_id, (e.request_id is not null) as is_refusal,
           e.level::text as level, e.network_code, cp.alias as display_name,
           a.country_code::text as country_code, e.reason_code,
           to_char(e.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           to_char(e.sla_due_at at time zone 'UTC', ${ISO_UTC}) as sla_due_at,
           to_char(e.escalate_at at time zone 'UTC', ${ISO_UTC}) as escalate_at,
           (e.sla_due_at < now()) as overdue,
           a.owner_agent_id::text as owner_id, o.display_name as owner_name,
           (e.claimed_by_account_id is not null and e.claim_expires_at > now()) as held,
           e.claimed_by_account_id::text as holder_id, h.display_name as holder_name,
           to_char(e.claimed_at at time zone 'UTC', ${ISO_UTC}) as claimed_at,
           to_char(e.claim_expires_at at time zone 'UTC', ${ISO_UTC}) as claim_expires_at,
           ${primaryKeyOf("disputes", sort)} as cursor_primary,
           ${datedKey("disputes")} as cursor_submitted
      from verification.disputes e
      join identity.accounts a on a.id = e.account_id
      left join identity.accounts o on o.id = a.owner_agent_id
      left join identity.accounts h on h.id = e.claimed_by_account_id
      left join profiles.creator_public_profiles cp on cp.account_id = e.account_id
     where ${sql.join(conditions, sql` and `)}
     order by ${primaryKeyOf("disputes", sort)}, ${datedKey("disputes")}, e.id
     limit ${limit}`);
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    kind: row.is_refusal ? "refusal" : "revocation",
    level: row.level,
    networkCode: row.network_code,
    displayName: row.display_name,
    countryCode: row.country_code,
    reasonCode: row.reason_code,
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
    cursor: {
      primary: row.cursor_primary,
      submittedAt: row.cursor_submitted,
      id: row.id,
    },
  }));
}

/** The columns of the lock view that are the contest's own (read with `readClaimView`). */
export const DISPUTE_EXTRA = sql`
  (e.request_id is not null) as x_is_refusal, e.level::text as x_level,
  e.reason_code as x_reason_code, e.outcome_reason_code as x_outcome_reason_code,
  e.review_mode as x_review_mode, e.member_message as x_member_message`;

export type DisputeDossierRow = {
  reviewToken: string;
  kind: "refusal" | "revocation";
  reasonCode: string;
  text: string | null;
  submittedAt: string;
  originalDeciderIds: string[];
  reviewMode: "independent" | "delayed";
  reflectionUntil: Instant;
  handle: string | null;
  pseudonym: string | null;
  profileUrl: string | null;
  requestId: string | null;
  refusalReasonCode: string | null;
  refusalMemberMessage: string | null;
  refusalDecidedAt: Instant;
  codeExpiresAt: Instant;
  evidence: unknown;
  badgeId: string | null;
  badgeGrantedAt: Instant;
  badgeExpiresAt: Instant;
  revokedAt: Instant;
  revocationReasonCode: string | null;
  revocationMemberMessage: string | null;
  cascadeBadgeIds: string[];
};

/**
 * 08 RG77: the dossier of the contest the caller HOLDS, one row, with the review token of its own
 * snapshot. 55P03 without the live claim: an agent who does not hold it reads nothing.
 */
export async function readDisputeDossier(
  tx: Transaction,
  disputeId: string,
): Promise<DisputeDossierRow> {
  const rows = await tx.execute<{
    review_token: string;
    kind: "refusal" | "revocation";
    reason_code: string;
    dispute_text: string | null;
    submitted_at: string;
    original_decider_ids: string[];
    review_mode: "independent" | "delayed";
    reflection_until: Instant;
    handle: string | null;
    pseudonym: string | null;
    profile_url: string | null;
    request_id: string | null;
    rejection_reason_code: string | null;
    refusal_member_message: string | null;
    refusal_decided_at: Instant;
    code_expires_at: Instant;
    evidence: unknown;
    badge_id: string | null;
    badge_granted_at: Instant;
    badge_expires_at: Instant;
    revoked_at: Instant;
    revocation_reason_code: string | null;
    revocation_member_message: string | null;
    cascade_badge_ids: string[];
  }>(sql`
    select review_token, kind, reason_code, dispute_text,
           to_char(submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           pg_catalog.to_jsonb(original_decider_ids) as original_decider_ids, review_mode,
           to_char(reflection_until at time zone 'UTC', ${ISO_UTC}) as reflection_until,
           handle, pseudonym, profile_url, request_id::text as request_id, rejection_reason_code,
           refusal_member_message,
           to_char(refusal_decided_at at time zone 'UTC', ${ISO_UTC}) as refusal_decided_at,
           to_char(code_expires_at at time zone 'UTC', ${ISO_UTC}) as code_expires_at,
           evidence, badge_id::text as badge_id,
           to_char(badge_granted_at at time zone 'UTC', ${ISO_UTC}) as badge_granted_at,
           to_char(badge_expires_at at time zone 'UTC', ${ISO_UTC}) as badge_expires_at,
           to_char(revoked_at at time zone 'UTC', ${ISO_UTC}) as revoked_at,
           revocation_reason_code, revocation_member_message,
           pg_catalog.to_jsonb(cascade_badge_ids) as cascade_badge_ids
      from verification.read_dispute_dossier(${disputeId}::uuid)`);
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.read_dispute_dossier() returned no row");
  }
  return {
    reviewToken: row.review_token,
    kind: row.kind,
    reasonCode: row.reason_code,
    text: row.dispute_text,
    submittedAt: row.submitted_at,
    originalDeciderIds: row.original_decider_ids,
    reviewMode: row.review_mode,
    reflectionUntil: row.reflection_until,
    handle: row.handle,
    pseudonym: row.pseudonym,
    profileUrl: row.profile_url,
    requestId: row.request_id,
    refusalReasonCode: row.rejection_reason_code,
    refusalMemberMessage: row.refusal_member_message,
    refusalDecidedAt: row.refusal_decided_at,
    codeExpiresAt: row.code_expires_at,
    evidence: row.evidence,
    badgeId: row.badge_id,
    badgeGrantedAt: row.badge_granted_at,
    badgeExpiresAt: row.badge_expires_at,
    revokedAt: row.revoked_at,
    revocationReasonCode: row.revocation_reason_code,
    revocationMemberMessage: row.revocation_member_message,
    cascadeBadgeIds: row.cascade_badge_ids,
  };
}

/** The names of the persons who took the decision contested (they open it read-only, modele point 10). */
export async function readDeciders(
  tx: Transaction,
  accountIds: readonly string[],
): Promise<Person[]> {
  const people: Person[] = [];
  for (const accountId of accountIds) {
    const rows = await tx.execute<{ display_name: string | null }>(sql`
      select a.display_name from identity.accounts a where a.id = ${accountId}::uuid`);
    people.push({ accountId, displayName: rows[0]?.display_name ?? null });
  }
  return people;
}

export type OutcomeReasonRow = {
  code: string;
  outcome: "upheld" | "overturned";
  position: number;
  requiresMemberMessage: boolean;
};

/** The closed list of the outcomes of a contest, active ones, in order (08 RG77; the table of 0232). */
export async function readOutcomeReasons(
  tx: Transaction,
): Promise<OutcomeReasonRow[]> {
  const rows = await tx.execute<{
    code: string;
    outcome: "upheld" | "overturned";
    position: number;
    requires_member_message: boolean;
  }>(sql`
    select code, outcome::text as outcome, position, requires_member_message
      from verification.dispute_outcome_reasons
     where is_active
     order by position, code`);
  return rows.map((row) => ({
    code: row.code,
    outcome: row.outcome,
    position: row.position,
    requiresMemberMessage: row.requires_member_message,
  }));
}

// ---------------------------------------------------------------------------------------------
// The decisions (0232)
// ---------------------------------------------------------------------------------------------

export type DecidedDispute = {
  outcome: "upheld" | "overturned";
  badgeId: string | null;
  decidedAt: string;
  late: boolean;
  reviewMode: "independent" | "delayed";
};

type DecisionSqlRow = {
  outcome: "upheld" | "overturned";
  badge_id?: string | null;
  decided_at: string;
  sla_breached: boolean;
  review_mode: "independent" | "delayed";
};

function decidedOf(
  rows: readonly DecisionSqlRow[],
  door: string,
): DecidedDispute {
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`${door}() returned no row`);
  }
  return {
    outcome: row.outcome,
    badgeId: row.badge_id ?? null,
    decidedAt: row.decided_at,
    late: row.sla_breached,
    reviewMode: row.review_mode,
  };
}

/** 15 C6: the decision stands, with a motive of the upheld ones; the team's own text for `other`. */
export async function upholdDispute(
  tx: Transaction,
  disputeId: string,
  reviewToken: string,
  input: {
    outcomeReasonCode: string;
    memberMessage: string | null;
    internalComment: string | null;
  },
): Promise<DecidedDispute> {
  const rows = await tx.execute<DecisionSqlRow>(sql`
    select outcome, to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
           sla_breached, review_mode
      from verification.uphold_dispute(
             ${disputeId}::uuid, ${reviewToken}, ${input.outcomeReasonCode},
             ${input.memberMessage}, ${input.internalComment})`);
  return decidedOf(rows, "verification.uphold_dispute");
}

/** CA53: a refused « Compte vérifié » overturned: the code read and the handle typed again (0228). */
export async function overturnRefusalAccount(
  tx: Transaction,
  disputeId: string,
  reviewToken: string,
  input: {
    observedCode: string;
    observedHandle: string;
    observedPlatformAccountRef: string | null;
    internalComment: string | null;
  },
): Promise<DecidedDispute> {
  const rows = await tx.execute<DecisionSqlRow>(sql`
    select outcome, badge_id::text as badge_id,
           to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached,
           review_mode
      from verification.overturn_refusal_account(
             ${disputeId}::uuid, ${reviewToken}, ${input.observedCode}, ${input.observedHandle},
             ${input.observedPlatformAccountRef}, ${input.internalComment})`);
  return decidedOf(rows, "verification.overturn_refusal_account");
}

/** CA53: a refused « Audience vérifiée » overturned: the figures and the period typed, the handle again. */
export async function overturnRefusalAudience(
  tx: Transaction,
  disputeId: string,
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
): Promise<DecidedDispute> {
  const rows = await tx.execute<DecisionSqlRow>(sql`
    select outcome, badge_id::text as badge_id,
           to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached,
           review_mode
      from verification.overturn_refusal_audience(
             ${disputeId}::uuid, ${reviewToken}, ${input.followers}::bigint,
             ${input.postsLast30Days}::integer, ${input.avgComments}::bigint,
             ${input.engagementBp}::integer, ${input.periodStart}::date,
             ${input.periodEnd}::date, ${input.observedHandle}, ${input.internalComment})`);
  return decidedOf(rows, "verification.overturn_refusal_audience");
}

/** CA53: a withdrawn badge handed back (new date of decision, the original expiry): the handle read again. */
export async function overturnRevocation(
  tx: Transaction,
  disputeId: string,
  reviewToken: string,
  input: { observedHandle: string; internalComment: string | null },
): Promise<DecidedDispute> {
  const rows = await tx.execute<DecisionSqlRow>(sql`
    select outcome, badge_id::text as badge_id,
           to_char(decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at, sla_breached,
           review_mode
      from verification.overturn_revocation(
             ${disputeId}::uuid, ${reviewToken}, ${input.observedHandle},
             ${input.internalComment})`);
  return decidedOf(rows, "verification.overturn_revocation");
}

// ---------------------------------------------------------------------------------------------
// The piece of the refused request (D82 (5), 08 RG84)
// ---------------------------------------------------------------------------------------------

/**
 * `verification.read_dispute_evidence()`: the key of an ACTIVE piece of the refused request to the holder
 * of the live claim, and the register line `verification.evidence_viewed` in this very transaction. The
 * key goes to the relay of Storage and nowhere else.
 */
export async function readDisputeEvidenceKey(
  tx: Transaction,
  disputeId: string,
  evidenceId: string,
): Promise<string> {
  const rows = await tx.execute<{ object_key: string }>(
    sql`select verification.read_dispute_evidence(${disputeId}::uuid, ${evidenceId}::uuid)
               as object_key`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("verification.read_dispute_evidence() returned no row");
  }
  return row.object_key;
}

/** What an active piece of the contested request weighs and measures: never the key. */
export async function readDisputeEvidenceDescription(
  tx: Transaction,
  disputeId: string,
  evidenceId: string,
): Promise<{ width: number; height: number; byteSize: number } | null> {
  const rows = await tx.execute<{
    width: number | null;
    height: number | null;
    byte_size: string | number | null;
  }>(sql`
    select f.width, f.height, f.byte_size
      from verification.evidence_files f
      join verification.disputes d on d.request_id = f.request_id
     where d.id = ${disputeId}::uuid and f.id = ${evidenceId}::uuid and f.state = 'active'`);
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
