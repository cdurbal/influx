// Database access of the replay, the corrections and the suppression lift of the backoffice
// (influx_agent or influx_admin, aal2; 03 §1.3). Parameterised queries only (S-1).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { arrayLiteral } from "../sql-formats.ts";

// ---------------------------------------------------------------------------------------------
// The action API of the backoffice v0 (05 RG81, RG93, RG101 to RG104, RG108; 15 §F; J8 commit 6),
// under influx_agent or influx_admin in aal2. The rules are the database's: the replay (0132
// leads.replay_outbox_lines), the corrections (0132 identity.correct_member_account), the Apollo
// keys and the suppression lift (0134, admin, R), the trace of a refused attempt (0134). The alert
// reads are plain reads of what agent and admin may read in aal2 (0101, 0129, 0130), and the last
// reconciliation through its function (0134, admin).
// ---------------------------------------------------------------------------------------------

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
  | "identity.internal_invitation"
  | "ops.read_health"
  | "queue.force_release_claim"
  // 0229 (L2ES-3): the write of a registry source, an administrator's (06 RG101)
  | "verification.set_registry_source"
  | "verification.add_registry_source"
  // 0215: not an admin action, the act of an internal on an entry of an account he holds (15 RG36,
  // CA19); since 0229 an administrator journals it too (EC-L2C-fix-2-2)
  | "queue.conflict_of_interest";

/** 0134: backoffice.action_refused on the caller's own account (an admin: conflict of interest only, 0229). */
export async function recordRefusedAction(
  tx: Transaction,
  actionCode: RefusedActionCode,
): Promise<void> {
  await tx.execute(sql`select backoffice.record_refused_action(${actionCode})`);
}
