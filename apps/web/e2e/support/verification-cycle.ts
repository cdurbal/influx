// The cycle of a badge, as the worker and the doors of L2F would leave it (docs/mvp/08 RG70, RG73, RG77;
// jalons/l2f, commit 17): a badge to refresh, to reconfirm or withdrawn, a refusal, a contest decided, written
// straight into the local stack by the migration role, so that a case reaches a state by the database and
// never by the doors (the task of the worker, the 2V of the backoffice) it does not test. One connection
// serves a whole seed (`withSql`), as every call of a case costs a connection otherwise. Nothing here is an
// amount, a rate or a price.
import { withSql, type Sql } from "./verification";

export { withSql, type Sql };

const PROFILE_URLS: Readonly<Record<string, (handle: string) => string>> = {
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  youtube: (handle) => `https://www.youtube.com/@${handle}`,
};

/** A line of a network, with its handle and link: the creator's own, as the profile autosave leaves it. */
export async function seedNetworkLine(
  sql: Sql,
  accountId: string,
  networkCode: string,
  handle: string,
): Promise<void> {
  await sql`
    insert into profiles.creator_social_accounts
      (account_id, network_code, is_primary, handle, profile_url)
    values (${accountId}, ${networkCode}, false, ${handle},
            ${PROFILE_URLS[networkCode]?.(handle) ?? null})`;
}

async function lineIdOf(
  sql: Sql,
  accountId: string,
  networkCode: string,
): Promise<string | null> {
  const [line] = await sql<{ id: string }[]>`
    select id::text from profiles.creator_social_accounts
     where account_id = ${accountId} and network_code = ${networkCode}`;
  return line?.id ?? null;
}

/**
 * A badge of a creator's line in a given state, from an approved request: `to_refresh` is an audience past
 * its 90 days (granted 100 days ago, expired 10 days ago, in its grace), `to_reconfirm` an account whose
 * handle changed, `active` a badge granted a day ago.
 */
export async function seedBadge(
  sql: Sql,
  accountId: string,
  agentId: string,
  options: {
    networkCode: string;
    level: "account_verified" | "audience_verified";
    state: "active" | "to_refresh" | "to_reconfirm";
  },
): Promise<void> {
  const { networkCode, level, state } = options;
  const age = state === "to_refresh" ? "100 days" : "1 day";
  const lineId = await lineIdOf(sql, accountId, networkCode);
  const [request] = await sql<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
       sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
    values (${accountId}, ${lineId}, ${networkCode}, ${level}, 'approved',
            now() - ${age}::interval, now() - ${age}::interval, now() - ${age}::interval,
            now() - ${age}::interval, ${agentId}, now() - ${age}::interval,
            now() - ${age}::interval)
    returning id::text`;
  if (level === "account_verified") {
    await sql`
      insert into verification.badges
        (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
         granted_at, evidence_source, observed_handle_at_decision, state)
      values (${accountId}, ${lineId}, ${networkCode}, ${request?.id ?? null},
              'account_verified', ${agentId}, now() - ${age}::interval, 'public_profile',
              ${`handle_${accountId.slice(0, 8)}`}, ${state})`;
    return;
  }
  const aged = state === "to_refresh";
  await sql`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_followers, observed_posts_last_30_days,
       observed_avg_comments, observed_period_start, observed_period_end,
       declared_posts_at_decision, declared_comments_at_decision, observed_handle_at_decision,
       expires_at, state)
    values (${accountId}, ${lineId}, ${networkCode}, ${request?.id ?? null},
            'audience_verified', ${agentId}, now() - ${age}::interval,
            'native_dashboard', 47300, 12, 85,
            current_date - ${aged ? 130 : 31}::integer, current_date - ${aged ? 102 : 3}::integer,
            12, 85, ${`handle_${accountId.slice(0, 8)}`},
            now() + ${aged ? "-10 days" : "89 days"}::interval, ${state})`;
}

/** The refusal of an account request an agent decided two days ago: contestable for the rest of the window (08 RG77). */
export async function seedRefusal(
  sql: Sql,
  accountId: string,
  agentId: string,
  networkCode: string,
  reason: string,
): Promise<string> {
  const lineId = await lineIdOf(sql, accountId, networkCode);
  const [request] = await sql<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
       sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
       rejection_reason_code)
    values (${accountId}, ${lineId}, ${networkCode}, 'account_verified', 'rejected',
            now() - interval '3 days', now() - interval '3 days', now() - interval '2 days',
            now() - interval '2 days', ${agentId}, now() - interval '2 days',
            now() - interval '2 days', ${reason})
    returning id::text`;
  return request?.id ?? "";
}

/**
 * The withdrawal of an account badge, executed two days ago: what `verification.revoke_badge()` leaves
 * (0231), so that the creator reads it among his contestable decisions. The 2V request that names it is
 * written pending and the colleague stands for both sides: no case reads the 2V, only the withdrawal.
 */
export async function seedRevokedBadge(
  sql: Sql,
  accountId: string,
  agentId: string,
  options: {
    networkCode: string;
    reason: string;
    memberMessage: string | null;
  },
): Promise<string> {
  const { networkCode, reason, memberMessage } = options;
  const lineId = await lineIdOf(sql, accountId, networkCode);
  return sql.begin(async (tx) => {
    const [request] = await tx<{ id: string }[]>`
      insert into verification.verification_requests
        (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
         sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
      values (${accountId}, ${lineId}, ${networkCode}, 'account_verified', 'approved',
              now() - interval '10 days', now() - interval '10 days', now() - interval '10 days',
              now() - interval '10 days', ${agentId}, now() - interval '10 days',
              now() - interval '10 days')
      returning id::text`;
    const [badge] = await tx<{ id: string }[]>`
      insert into verification.badges
        (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
         granted_at, evidence_source, observed_handle_at_decision, state)
      values (${accountId}, ${lineId}, ${networkCode}, ${request?.id ?? null},
              'account_verified', ${agentId}, now() - interval '10 days', 'public_profile',
              ${`handle_${accountId.slice(0, 8)}`}, 'active')
      returning id::text`;
    const badgeId = badge?.id ?? "";
    const payload = tx.json({
      account_id: accountId,
      badge_id: badgeId,
      reason_code: reason,
    });
    const [control] = await tx<{ id: string }[]>`
      insert into backoffice.dual_control_requests
        (action_code, payload, reason_code, requested_by_account_id, requested_at, expires_at)
      values ('verification.revoke_badge', ${payload}, ${reason}, ${agentId},
              now() - interval '2 days', now() - interval '1 day')
      returning id::text`;
    const controlId = control?.id ?? "";
    await tx`
      insert into verification.badge_revocation_requests
        (dual_control_request_id, badge_id, account_id, reason_code, member_message,
         requested_by_account_id, requested_at, executed_by_account_id, executed_at)
      values (${controlId}, ${badgeId}, ${accountId}, ${reason}, ${memberMessage},
              ${agentId}, now() - interval '2 days', ${agentId}, now() - interval '2 days')`;
    await tx`
      update verification.badges
         set state = 'revoked', revoked_at = now() - interval '2 days',
             revocation_reason_code = ${reason}, revocation_request_id = ${controlId}
       where id = ${badgeId}`;
    return badgeId;
  });
}

/** The contests of an account as the database holds them: what a contest filed on screen left. */
export async function disputesOf(
  accountId: string,
): Promise<
  { state: string; reason: string; text: string | null; kind: string }[]
> {
  return withSql(
    (sql) => sql`
      select state::text as state, reason_code as reason, text,
             case when request_id is not null then 'refusal' else 'revocation' end as kind
        from verification.disputes
       where account_id = ${accountId}
       order by submitted_at`,
  );
}

/** What a colleague's decision leaves on a contest: upheld with the motive « nouvelle demande », told to the creator by the screen. */
export async function upholdDispute(
  accountId: string,
  agentId: string,
): Promise<void> {
  await withSql(
    (sql) => sql`
      update verification.disputes
         set state = 'upheld', decided_by_account_id = ${agentId}, decided_at = now(),
             outcome_reason_code = 'new_request_needed', review_mode = 'independent',
             closed_at = now()
       where account_id = ${accountId} and state = 'open'`,
  );
}

/** The day the grace of an audience badge ends, as the screen writes it: its `expires_at` and the days of the setting. */
export async function graceEndOf(sql: Sql, accountId: string): Promise<Date> {
  const [row] = await sql<{ ends: Date }[]>`
    select b.expires_at + make_interval(days => (
             select (s.value #>> '{}')::integer from backoffice.operational_settings s
              where s.key = 'badge_grace_days')) as ends
      from verification.badges b
     where b.account_id = ${accountId} and b.level = 'audience_verified'
       and b.state = 'to_refresh'`;
  return row?.ends ?? new Date(Number.NaN);
}
