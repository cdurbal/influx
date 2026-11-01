// Database access of the account history, the data requests, the account search journal and the
// day counters of the backoffice (influx_agent or influx_admin, aal2; 03 §1.3, §3.1).
// Parameterised queries only (S-1).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { ISO_UTC } from "../sql-formats.ts";

export type AccountDataRequestRow = {
  id: string;
  requestType: string;
  receivedAt: string;
  dueAt: string;
  status: string;
  completedAt: string | null;
  outcomeCode: string | null;
  authorisedBy: string | null;
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
    authorised_by: string | null;
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
           e.authorised_by as authorised_by,
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
    authorisedBy: row.authorised_by,
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
