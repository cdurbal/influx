// Database access of the Apollo settings, the alert reads and the new-browser signals of the
// backoffice (influx_agent or influx_admin, aal2; 03 §1.3). Parameterised queries only (S-1).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import type { ContactDestination } from "../sync-replay/repository.ts";
import type { SyncSetting } from "@influx/contracts/backoffice-accounts";
import { arrayLiteral, ISO_UTC } from "../sql-formats.ts";

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

/** AL25 (05 RG160): the failed configuration lines of one destination, by the setting at fault. */
export type ConfigurationFailureRow = {
  destination: ContactDestination;
  setting: SyncSetting;
  count: number;
  oldestAt: string | null;
};

/**
 * The contact lines in failure of configuration (list_not_configured, apollo_settings_invalid,
 * credentials_missing; no template is read since D69), grouped by the setting they name. A Brevo list is
 * that of the role of the account of the line. Only names leave: never a value (RG160 point 4).
 */
export async function configurationFailures(
  tx: Transaction,
): Promise<ConfigurationFailureRow[]> {
  const rows = await tx.execute<{
    destination: ContactDestination;
    setting: SyncSetting;
    count: number;
    oldest_at: string | null;
  }>(sql`
    select destination, setting, count(*)::integer as count,
           to_char(min(updated_at) at time zone 'UTC', ${ISO_UTC}) as oldest_at
      from (select o.destination::text as destination, o.updated_at,
                   case o.last_error_code
                     when 'list_not_configured' then
                       case when r.role = 'advertiser' then 'brevo_list_advertisers'
                            else 'brevo_list_creators' end
                     when 'apollo_settings_invalid' then 'apollo_settings'
                     else 'apollo_credentials' end as setting
              from leads.outbox_events o
              left join identity.account_roles r
                on o.subject_key ~ '^account:[0-9a-f-]{36}$'
               and r.account_id = substring(o.subject_key from 9)::uuid
               and r.role in ('advertiser', 'creator')
             where o.status = 'failed'
               and o.destination in ('brevo_contact', 'apollo_contact')
               and o.last_error_code in ('list_not_configured', 'apollo_settings_invalid',
                                         'credentials_missing')) f
     group by destination, setting
     order by destination, setting`);
  return rows.map((row) => ({
    destination: row.destination,
    setting: row.setting,
    count: row.count,
    oldestAt: row.oldest_at,
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
