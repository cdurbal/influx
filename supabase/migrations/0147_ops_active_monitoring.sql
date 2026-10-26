-- =============================================================================
-- 0147_ops_active_monitoring
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, commit 8 ("Surveillance active", D60). The active half of the
-- internal monitoring announced by 0016: the heartbeat of the worker (02 §11.3),
-- the probe (02 §20.5, "Sonde interne"), the connections of the base, the signals
-- of the api, the states of the technical alerts (15 RG165: rise, reminder at most
-- every 30 minutes, "resolved"), the reads of their evaluator, the hourly roll-up
-- and the purges of the ops schema (02 §20.5, §20.8).
--
--   backoffice.alert_definitions  + on_call (the "astreinte" of RG165: the addresses
--         of OPS_ALERT_RECIPIENTS, NEVER an address in base); AL50 = {on_call}, not
--         modifiable (CHECK); AL49 to AL63 loaded (EC-J9-4); AL48 gets its window.
--   ops.worker_heartbeats      one line per worker process (AL50, read by the api).
--   ops.probe_results          one line per check of a target (never a URL).
--   ops.database_samples       connections of the cluster, one line per minute (AL58).
--   ops.signal_counts          the Brevo webhook signals of the api per minute
--                              (AL61, AL62), written by influx_ops like request_metrics.
--   ops.alert_states           one line per (scope, alert, subject): the deduplication.
--   ops.request_metrics_hourly, ops.process_metrics_hourly, ops.probe_results_hourly
--                              the roll-up kept 13 months (02 §20.5, "Conservation").
--   identity.code_failure_tallies  failed sign-in codes per address digest and UTC
--                              hour (AL59, J3S-8): the only per-address failure count
--                              that can be summed over a sliding 24 hours.
--
-- Functions (SECURITY DEFINER, empty search_path):
--   worker (E-4 maintenance.run_periodic, influx_worker, no audit line):
--     ops.record_worker_heartbeat(text, text, text, timestamptz, boolean)
--     ops.record_probe_results(text, jsonb) -> integer
--     ops.record_database_sample()
--     ops.technical_alert_snapshot(timestamptz) -> jsonb
--     ops.admin_alert_recipients() -> (account_id, email): the ONLY path of the worker
--                                    to these addresses; read, never stored
--     ops.run_ops_retention(uuid, smallint) -> jsonb (task ops_retention, daily)
--   api (E-6 ops.record_telemetry, influx_ops, no business read: what it needs is
--        handed by a function of ops):
--     ops.worker_liveness() -> jsonb
--   both, each for its own scope only (session_user, 42501 otherwise):
--     ops.begin_alert_round(text) -> jsonb (null: the lock is held elsewhere)
--     ops.save_alert_states(text, jsonb) -> integer (the lock of the scope required)
--   sign-in (E-2, influx_auth):
--     identity.record_code_failure(bytea) -> integer
-- Owners: influx_maintenance_definer (0117) for ops, influx_identity_definer for
-- identity. Helpers ops.iso_utc() and ops.threshold_int() are SECURITY INVOKER, owned
-- by influx_maintenance_definer, published to nobody.
--
-- *** NEVER IN THESE TABLES (02 §20.8) ***: an address, an IP, a full URL, a body, a
-- message, a name. Every text column is a closed list or a bounded pattern without
-- '@'; last_value is a flat object of codes, counts and instants, without '@'.
--
-- EC-J9 (micro-gaps, the safest choice):
--   * AL48 window: the login codes requested in the 60 minutes that END
--     no_sign_in_within_minutes (10) ago, so that each one has had its ten minutes;
--     written in its threshold (window_minutes: 60), the other keys unchanged. The
--     share without sign-in counts the codes of an existing MEMBER account only (a
--     member session opened within the ten minutes): a first code of a sign-up has
--     no stored success.
--   * AL51: new groups and regressions in (since - 10 s, now - 10 s]: a group written
--     by a transaction still open at the snapshot is seen at the next round (the
--     window of the ops pool is 2 s + 2 s), never twice. The watermark is a line of
--     alert_states (worker, AL51, 'watermark', open, last_value {"seenUntil": ...}),
--     returned by begin_alert_round like every open state, with its last_value.
--   * AL57: the last window_minutes MEASURED minutes of each service, looked for in
--     the last window_minutes + 2 minutes (a minute is written after it ends).
--   * AL58: the last consecutive_samples samples of the last consecutive_samples + 2
--     minutes (a stopped sampler leaves no stale saturation).
--   * AL59 needs a per-address count: identity.code_failure_tallies, written by
--     identity.record_code_failure(emailThrottleKey) in transaction B of a failed code
--     (apps/api, verify-code.ts). Its key is the HMAC already used by the
--     code_request_email counters; the snapshot gives its first 8 bytes in hex.
--   * connections (AL58): backends attached to a database in pg_stat_activity (the
--     backend type is hidden to a role without pg_read_all_stats; the few background
--     workers attached to a database are counted: conservative).
--   * the roll-up of an hour waits two hours after its start (a minute is accepted up
--     to one hour after it ends, 0016); a minute is purged only once its hour is
--     rolled up; 48 hours and 5000 rows per table at most per call ("more": 1).
--
-- ROLLBACK (before any real line): drop the twelve functions of this migration; drop
-- tables ops.worker_heartbeats, ops.probe_results, ops.database_samples,
-- ops.signal_counts, ops.alert_states, ops.request_metrics_hourly,
-- ops.process_metrics_hourly, ops.probe_results_hourly, identity.code_failure_tallies;
-- drop function ops.guard_worker_heartbeat_update(); drop type ops.probe_target,
-- ops.signal; delete AL49 to AL63 from backoffice.alert_definitions, restore the AL48
-- threshold of 0130 and the constraint alert_definitions_recipients_closed of 0130,
-- drop alert_definitions_al50_on_call_only; revoke the grants of section 8 and drop
-- their policies. The value ops_retention of ops.periodic_task stays (an enum value is
-- not dropped; unused, it is harmless).
-- =============================================================================

-- 1. Types and closed-list values ---------------------------------------------------------------

do $$
begin
  create type ops.probe_target as enum ('web_home_fr', 'web_home_en', 'backoffice_sign_in', 'api_health');
exception when duplicate_object then null;
end
$$;

comment on type ops.probe_target is
  'The four targets of the probe (02 §20.5): the home pages FR and EN by their public origin, the '
  'sign-in page of the backoffice, the /health of the api on the private network. A NAME, never a URL '
  '(02 §20.8).';

do $$
begin
  create type ops.signal as enum ('webhook_brevo_authenticated', 'webhook_brevo_ignored',
                                  'webhook_brevo_ip_drift');
exception when duplicate_object then null;
end
$$;

comment on type ops.signal is
  'Signals of the api counted per minute (15 RG165): webhook_brevo_authenticated (a call with a valid '
  'token), webhook_brevo_ignored (one that wrote nothing: invalid_payload, outside_window, duplicate; '
  'AL61), webhook_brevo_ip_drift (a valid token from outside the published ranges; AL62).';

-- E-4: the daily retention of the ops schema. Used by plpgsql bodies only (never in this
-- transaction: a value added to an existing enum is unusable before COMMIT).
alter type ops.periodic_task add value if not exists 'ops_retention';

comment on type ops.periodic_task is
  'Closed list of the E-4 tasks (decision 3 of J7): brevo_reconciliation (daily, after 03:00 UTC, '
  '05 RG91, 16 RG113), auth_orphan_purge (hourly, 04 §9), brevo_inbound_purge (daily, decision 2), '
  'data_export_purge (hourly, 0136 and 0137), ops_retention (daily, 0147: hourly roll-up and purges of '
  'the ops schema). A new task is a new value, added with its first caller.';

-- 2. The catalogue of alerts (15 RG165, EC-J9-4) --------------------------------------------------

alter table backoffice.alert_definitions drop constraint if exists alert_definitions_recipients_closed;
alter table backoffice.alert_definitions add constraint alert_definitions_recipients_closed
  check (cardinality(recipient_roles) between 1 and 4
         and array_position(recipient_roles, null) is null
         and recipient_roles <@ array['agent', 'owner_agent', 'admin', 'founder', 'on_call']::text[]);

-- RG165: "AL50 Worker arrêté — astreinte seule, non modifiable"
alter table backoffice.alert_definitions drop constraint if exists alert_definitions_al50_on_call_only;
alter table backoffice.alert_definitions add constraint alert_definitions_al50_on_call_only
  check (code <> 'AL50' or recipient_roles = array['on_call']::text[]);

comment on column backoffice.alert_definitions.recipient_roles is
  'Never empty (CHECK). agent = every agent; owner_agent = the responsible agent of the object; admin = '
  'every active admin, the break-glass account excluded; founder = the founder; on_call = the '
  '"astreinte" of 15 RG165, the addresses of the variable OPS_ALERT_RECIPIENTS (0147). Each is resolved '
  'by the alerting code, NEVER an address in base. AL50 is {on_call} and cannot change (CHECK '
  'alert_definitions_al50_on_call_only). 04 §5.10 named it recipient_role; plural because 15 §F names '
  'up to two recipients (EC-J8).';
comment on constraint alert_definitions_al50_on_call_only on backoffice.alert_definitions is
  '15 RG165: the alert "worker stopped" goes to the on-call addresses only, and this cannot be changed.';

-- AL48 (16 RG98): its window, written in its threshold like every other one (EC-J9, header).
update backoffice.alert_definitions
   set threshold_value = threshold_value || '{"window_minutes": 60}'::jsonb
 where code = 'AL48' and threshold_value -> 'window_minutes' is null;

-- AL49 to AL63 (15 RG165): thresholds EXACTLY as the evaluator reads them (apps/api,
-- domains/ops/technical-alerts.ts). A null member is a threshold not set: not evaluated.
insert into backoffice.alert_definitions
  (code, label_key, nature, threshold_value, recipient_roles, source_document)
values
  ('AL49', 'alert.AL49', 'etat',
   '{"consecutive_failures": 2, "probe_interval_seconds": 60}',
   '{on_call}', '02 §20.5, §20.6; 15 RG165'),
  ('AL50', 'alert.AL50', 'etat',
   '{"heartbeat_max_age_seconds": 60}',
   '{on_call}', '02 §11.3, §20.6; 15 RG165'),
  ('AL51', 'alert.AL51', 'evenement',
   '{"burn_in_until": null, "digest_hour_utc": 7, "digest_window_hours": 24}',
   '{on_call}', '02 §20.6, §20.7; J4S-6; 15 RG165'),
  ('AL52', 'alert.AL52', 'etat',
   '{"window_minutes": 5, "max_share_bp": 100}',
   '{on_call}', '02 §20.6; 15 RG165'),
  ('AL53', 'alert.AL53', 'etat',
   '{"window_minutes": 10, "p95_max_ms": 1000, "excluded_routes": ["POST /v1/auth/request-code"], "request_code_p95_max_ms": null}',
   '{on_call}', '02 §20.6; D43; 15 RG165'),
  ('AL54', 'alert.AL54', 'etat',
   '{"page_max_ms": 2000, "consecutive_probes": 3}',
   '{on_call}', '02 §20.6; 15 RG165'),
  ('AL55', 'alert.AL55', 'etat',
   '{"window_minutes": 5, "usual_multiplier": 3, "history_days": 14, "fixed_calls_per_minute": 300}',
   '{on_call}', '02 §20.6; 15 RG165'),
  ('AL56', 'alert.AL56', 'etat',
   '{"window_minutes": 15, "max_share_bp": 200, "min_count": 20}',
   '{on_call}', '02 §20.6; 03 A-3; 15 RG165'),
  ('AL57', 'alert.AL57', 'etat',
   '{"window_minutes": 5, "event_loop_delay_max_ms": 200, "memory_max_share_bp": 8500, "memory_limit_bytes": null}',
   '{on_call}', '02 §20.6; 15 RG165'),
  ('AL58', 'alert.AL58', 'etat',
   '{"connections_max_share_bp": 8000, "consecutive_samples": 3, "frequent_query_p95_multiplier": null}',
   '{on_call}', '02 §20.6; 04 §7.3; 15 RG165'),
  ('AL59', 'alert.AL59', 'evenement',
   '{"window_hours": 24, "min_failures": 25}',
   '{on_call,admin}', 'J3S-8; 03 A-4; 15 RG165'),
  ('AL60', 'alert.AL60', 'evenement',
   '{"realign_failed_min": 1, "breaker_counts": ["breaker_orphan_ratio", "breaker_filter_refused"]}',
   '{on_call}', 'J7S-8, J7S-2; 15 RG165'),
  ('AL61', 'alert.AL61', 'etat',
   '{"window_hours": 24, "max_share_bp": 1000, "min_ignored": 10}',
   '{on_call}', 'J7S-8; 15 RG165'),
  ('AL62', 'alert.AL62', 'evenement',
   '{"window_hours": 24, "min_occurrences": 1}',
   '{on_call}', 'J7S-8; 15 RG165'),
  ('AL63', 'alert.AL63', 'etat',
   '{"open_after_hours": 24}',
   '{admin,on_call}', 'F4; 15 RG75, RG165')
on conflict (code) do nothing;

comment on table backoffice.alert_definitions is
  'Catalogue of the backoffice alerts (15 §F RG63 to RG68, AL1 to AL48 with 15 RG126, AL49 to AL63 '
  'with 15 RG165): a code, a threshold written in table, named recipients. Loaded lot by lot: an alert '
  'arrives when the objects its condition reads exist (0130: Lot 1; 0147: the technical alerts of '
  'D60). NO ALERT TRIGGERS AN AUTOMATIC SANCTION (15 RG65) and NO ALERT LEAVES FOR BREVO CONTACTS, '
  'LISTS OR APOLLO (15 RG70): the technical alerts are transactional e-mails written by INFLUX.';

-- 3. ops.worker_heartbeats (02 §11.3) -------------------------------------------------------------

create table if not exists ops.worker_heartbeats (
  worker_id     text        not null primary key,
  instance      text        not null,
  version       text        not null,
  started_at    timestamptz not null,
  beat_at       timestamptz not null default now(),
  loop_turn_at  timestamptz not null default now(),

  constraint worker_heartbeats_worker_id_format
    check (worker_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'),
  constraint worker_heartbeats_instance_format check (instance ~ '^[A-Za-z0-9._:-]{1,64}$'),
  constraint worker_heartbeats_version_format check (version ~ '^[A-Za-z0-9._-]{1,64}$'),
  constraint worker_heartbeats_chronology
    check (loop_turn_at <= beat_at and started_at <= beat_at + interval '5 minutes')
);

comment on table ops.worker_heartbeats is
  'One line per worker PROCESS (02 §11.3): the api reads the last beat through ops.worker_liveness() '
  '(AL50, "aucun battement depuis 60 s"); the backoffice reads it from the base, so that it stays right '
  'while the worker is down. Written by ops.record_worker_heartbeat() only; purged 7 days after the '
  'last beat. Codes and instants, nothing of a person.';
comment on column ops.worker_heartbeats.worker_id is
  'workerIdentifier of the process (apps/api, drain.ts: worker-<replica>-<random>), new per process.';
comment on column ops.worker_heartbeats.instance is 'Replica of the service (RAILWAY_REPLICA_ID).';
comment on column ops.worker_heartbeats.version is 'Version of the code (commit), as in 0016.';
comment on column ops.worker_heartbeats.started_at is 'Start of the process, by the database clock.';
comment on column ops.worker_heartbeats.beat_at is 'Last beat: the transaction time, never supplied.';
comment on column ops.worker_heartbeats.loop_turn_at is
  'Last COMPLETED turn of the loop (a beat during a long step leaves it unchanged): a worker that beats '
  'without turning is stuck, not stopped.';

create or replace function ops.guard_worker_heartbeat_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.worker_id is distinct from old.worker_id
     or new.instance is distinct from old.instance
     or new.version is distinct from old.version
     or new.started_at is distinct from old.started_at then
    raise exception 'the description of a worker process never changes'
      using errcode = 'insufficient_privilege';
  end if;
  if new.beat_at < old.beat_at or new.loop_turn_at < old.loop_turn_at then
    raise exception 'a heartbeat never goes back' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function ops.guard_worker_heartbeat_update() is
  'BEFORE UPDATE on ops.worker_heartbeats: the description of a process never changes, its beat and its '
  'last turn never go back. SECURITY INVOKER, reads nothing.';

revoke all on function ops.guard_worker_heartbeat_update() from public, anon, authenticated, service_role;

drop trigger if exists worker_heartbeats_guard on ops.worker_heartbeats;
create trigger worker_heartbeats_guard
  before update on ops.worker_heartbeats
  for each row execute function ops.guard_worker_heartbeat_update();

-- 4. ops.probe_results (02 §20.5, "Sonde interne") ------------------------------------------------

create table if not exists ops.probe_results (
  checked_at    timestamptz not null,
  instance      text        not null,
  target        ops.probe_target not null,
  outcome       text        not null,
  status_code   smallint,
  failure_code  text,
  duration_ms   integer     not null,

  constraint probe_results_pkey primary key (target, checked_at, instance),
  constraint probe_results_instance_format check (instance ~ '^[A-Za-z0-9._:-]{1,64}$'),
  constraint probe_results_outcome check (outcome in ('up', 'down')),
  constraint probe_results_status_code check (status_code between 100 and 599),
  constraint probe_results_failure_code
    check (failure_code in ('timeout', 'connection', 'status', 'redirect', 'body')),
  constraint probe_results_failure_pair check ((outcome = 'up') = (failure_code is null)),
  constraint probe_results_up_answered check (outcome <> 'up' or status_code is not null),
  constraint probe_results_failure_status check (
    (failure_code not in ('status', 'redirect', 'body') or status_code is not null)
    and (failure_code <> 'connection' or status_code is null)
    and (failure_code <> 'redirect' or status_code between 300 and 399)),
  constraint probe_results_duration check (duration_ms between 0 and 600000)
);

comment on table ops.probe_results is
  'One line per check of a target by the worker, every minute (02 §20.5): outcome, status, closed '
  'failure code, duration. NEVER a URL, a body nor a header (02 §20.8): the target is a name. Written by '
  'ops.record_probe_results() only (a late flush within the hour is admitted, a fabricated history '
  'not); kept 14 days, then rolled up by hour (ops.probe_results_hourly).';
comment on column ops.probe_results.status_code is 'HTTP status of the answer; NULL when none came.';
comment on column ops.probe_results.failure_code is
  'NULL when up. timeout, connection (no answer), status (not 200), redirect (3xx: the page is '
  'elsewhere), body (the answer did not arrive whole).';

create index if not exists probe_results_checked_idx on ops.probe_results (checked_at);
comment on index ops.probe_results_checked_idx is
  'Hourly roll-up and purge after 14 days (ops.run_ops_retention()).';

-- 5. ops.database_samples (02 §20.5, AL58) --------------------------------------------------------

create table if not exists ops.database_samples (
  minute           timestamptz not null primary key,
  connections      integer     not null,
  max_connections  integer     not null,

  constraint database_samples_minute_aligned check (minute = date_trunc('minute', minute, 'UTC')),
  constraint database_samples_counts check (connections >= 0 and max_connections >= 1)
);

comment on table ops.database_samples is
  'Connections of the cluster, one line per minute, read by the worker itself '
  '(ops.record_database_sample(), 02 §20.5 "Base"): AL58. Kept 14 days.';
comment on column ops.database_samples.connections is
  'Backends attached to a database (pg_stat_activity.datid not null): the client sessions, and the few '
  'background workers attached to a database (conservative).';
comment on column ops.database_samples.max_connections is 'The setting max_connections at that minute.';

-- 6. ops.signal_counts (AL61, AL62) ---------------------------------------------------------------

create table if not exists ops.signal_counts (
  minute    timestamptz not null,
  service   ops.service_name not null,
  instance  text        not null,
  signal    ops.signal  not null,
  count     integer     not null,

  constraint signal_counts_pkey primary key (minute, service, instance, signal),
  constraint signal_counts_minute_aligned check (minute = date_trunc('minute', minute, 'UTC')),
  constraint signal_counts_api_only check (service = 'api'),
  constraint signal_counts_instance_format check (instance ~ '^[A-Za-z0-9._:-]{1,64}$'),
  constraint signal_counts_count check (count between 1 and 1000000)
);

comment on table ops.signal_counts is
  'Signals of the api per (minute, instance) (15 RG165, AL61 and AL62): written once, after the minute '
  'ends, by influx_ops in the flush of the telemetry (E-6, like ops.request_metrics); never read by '
  'it. A count, never what was received. Kept 14 days.';

-- 7. ops.alert_states (15 RG165, deduplication) ---------------------------------------------------

create table if not exists ops.alert_states (
  scope             text        not null,
  code              text        not null references backoffice.alert_definitions (code),
  subject_key       text        not null default '',
  state             text        not null,
  opened_at         timestamptz not null,
  last_notified_at  timestamptz,
  notified_count    integer     not null default 0,
  resolved_at       timestamptz,
  last_value        jsonb       not null default '{}'::jsonb,
  updated_at        timestamptz not null default now(),

  constraint alert_states_pkey primary key (scope, code, subject_key),
  constraint alert_states_scope check (scope in ('worker', 'api')),
  -- 15 RG165 "Qui envoie": AL50 from the api, every other one from the worker
  constraint alert_states_scope_of_code check ((code = 'AL50') = (scope = 'api')),
  constraint alert_states_subject_key_format check (subject_key ~ '^[A-Za-z0-9._:-]{0,100}$'),
  constraint alert_states_state check (state in ('open', 'resolved')),
  constraint alert_states_resolution_pair check ((state = 'resolved') = (resolved_at is not null)),
  constraint alert_states_notification_pair
    check ((notified_count = 0) = (last_notified_at is null)),
  constraint alert_states_notified_count check (notified_count between 0 and 1000000),
  constraint alert_states_last_value_flat check (
    jsonb_typeof(last_value) = 'object'
    and pg_column_size(last_value) <= 2000
    and strpos(last_value::text, '@') = 0
    and not jsonb_path_exists(last_value,
          '$.keyvalue() ? (!(@.key like_regex "^[A-Za-z][A-Za-z0-9_]{0,62}$")
                           || (@.value.type() != "string" && @.value.type() != "number"
                               && @.value.type() != "null")
                           || (@.value.type() == "string"
                               && !(@.value like_regex "^[A-Za-z0-9._:+-]{0,100}$")))'))
);

comment on table ops.alert_states is
  'One line per (scope, alert code, subject) of the technical alerts (15 RG165): when it opened, when '
  'and how often it was notified, when it ended. The transitions are decided by apps/api '
  '(domains/ops/technical-alerts.ts); the base keeps the state and serialises the instances of a scope '
  '(ops.begin_alert_round(), ops.save_alert_states()). Codes, counts and instants only. Resolved lines '
  'are purged after 13 months.';
comment on column ops.alert_states.scope is
  'worker: every technical alert but AL50 (written under influx_worker); api: AL50 (influx_ops).';
comment on column ops.alert_states.subject_key is
  'What the alert is about, opaque and bounded: '''' (the alert alone), a probe target, a service, an '
  'error group, a run or an execution id, the 16-hex key of AL59. Two lines of AL51 are not alerts but '
  'its bookkeeping, always open: ''watermark'' (last_value.seenUntil: the new groups seen until then) '
  'and ''digest'' (last_value.lastDigestDay). Never an address (pattern without ''@'').';
comment on column ops.alert_states.last_value is
  'The last measured value and its threshold, as shown in the e-mail: a FLAT object of codes, counts and '
  'instants (strings of [A-Za-z0-9._:+-], numbers, null), 2000 bytes at most, never an ''@'': no '
  'personal data can be written here.';
comment on column ops.alert_states.notified_count is
  'Notifications sent for this opening (0 with last_notified_at NULL: not notified yet, or the e-mail '
  'reached nobody and is sent again at the next round).';

drop trigger if exists alert_states_touch_updated_at on ops.alert_states;
create trigger alert_states_touch_updated_at
  before update on ops.alert_states
  for each row execute function influx.touch_updated_at();

-- 8. The hourly roll-up (02 §20.5, "Conservation": 14 days by minute, then 13 months by hour) ----

create table if not exists ops.request_metrics_hourly (
  hour                 timestamptz not null,
  service              ops.service_name not null,
  method               text        not null,
  route                text        not null,
  request_count        bigint      not null,
  server_error_count   bigint      not null,
  throttled_count      bigint      not null,
  duration_buckets     bigint[]    not null,

  constraint request_metrics_hourly_pkey primary key (hour, service, method, route),
  constraint request_metrics_hourly_hour_aligned check (hour = date_trunc('hour', hour, 'UTC')),
  constraint request_metrics_hourly_server_side check (service in ('api', 'worker')),
  constraint request_metrics_hourly_method check (method in ('GET', 'POST', 'PATCH', 'PUT', 'DELETE')),
  constraint request_metrics_hourly_route_model
    check (route ~ '^/[A-Za-z0-9/_:.*\[\]-]{0,199}$' or route = 'unmatched'),
  constraint request_metrics_hourly_counts
    check (request_count >= 1
           and server_error_count between 0 and request_count
           and throttled_count between 0 and request_count),
  constraint request_metrics_hourly_buckets
    check (array_ndims(duration_buckets) = 1
           and array_length(duration_buckets, 1) = 9
           and array_lower(duration_buckets, 1) = 1
           and 0 <= all (duration_buckets)
           and duration_buckets[1] + duration_buckets[2] + duration_buckets[3]
             + duration_buckets[4] + duration_buckets[5] + duration_buckets[6]
             + duration_buckets[7] + duration_buckets[8] + duration_buckets[9] = request_count)
);

comment on table ops.request_metrics_hourly is
  'ops.request_metrics rolled up by UTC hour, ALL INSTANCES TOGETHER (02 §20.5: histograms add up, the '
  'p95 is computed at read time). Written by ops.run_ops_retention() once per hour, two hours after its '
  'start (a minute is accepted up to an hour after it ends); kept 13 months. Feeds the usual volume of '
  'AL55.';

create table if not exists ops.process_metrics_hourly (
  hour                          timestamptz not null,
  service                       ops.service_name not null,
  instance                      text        not null,
  minutes                       smallint    not null,
  event_loop_delay_p99_avg_ms   numeric(10, 2) not null,
  event_loop_delay_max_ms       numeric(10, 2) not null,
  rss_avg_bytes                 bigint      not null,
  rss_max_bytes                 bigint      not null,
  heap_used_avg_bytes           bigint      not null,
  cpu_avg_percent               numeric(7, 2) not null,
  cpu_max_percent               numeric(7, 2) not null,

  constraint process_metrics_hourly_pkey primary key (hour, service, instance),
  constraint process_metrics_hourly_hour_aligned check (hour = date_trunc('hour', hour, 'UTC')),
  constraint process_metrics_hourly_server_side check (service in ('api', 'worker')),
  constraint process_metrics_hourly_instance_format check (instance ~ '^[A-Za-z0-9._:-]{1,64}$'),
  constraint process_metrics_hourly_values
    check (minutes between 1 and 60
           and event_loop_delay_p99_avg_ms >= 0
           and event_loop_delay_max_ms >= 0
           and rss_avg_bytes >= 0 and rss_max_bytes >= rss_avg_bytes
           and heap_used_avg_bytes >= 0
           and cpu_avg_percent between 0 and 6400
           and cpu_max_percent between cpu_avg_percent and 6400)
);

comment on table ops.process_metrics_hourly is
  'ops.process_metrics rolled up by UTC hour and instance: minutes measured, mean of the per-minute p99 '
  'of the event loop delay and its maximum, mean and maximum memory, mean heap, mean and maximum '
  'processor. Written by ops.run_ops_retention(); kept 13 months.';

create table if not exists ops.probe_results_hourly (
  hour              timestamptz not null,
  target            ops.probe_target not null,
  checks            integer     not null,
  failures          integer     not null,
  duration_buckets  integer[]   not null,

  constraint probe_results_hourly_pkey primary key (hour, target),
  constraint probe_results_hourly_hour_aligned check (hour = date_trunc('hour', hour, 'UTC')),
  constraint probe_results_hourly_counts check (checks >= 1 and failures between 0 and checks),
  constraint probe_results_hourly_buckets
    check (array_ndims(duration_buckets) = 1
           and array_length(duration_buckets, 1) = 9
           and array_lower(duration_buckets, 1) = 1
           and 0 <= all (duration_buckets)
           and duration_buckets[1] + duration_buckets[2] + duration_buckets[3]
             + duration_buckets[4] + duration_buckets[5] + duration_buckets[6]
             + duration_buckets[7] + duration_buckets[8] + duration_buckets[9] = checks)
);

comment on table ops.probe_results_hourly is
  'ops.probe_results rolled up by UTC hour and target, all instances together: checks, failures '
  '(outcome down), durations in the 9 buckets of 0016 (<= 25, 50, 100, 250, 500 ms, 1, 2.5, 5 s, '
  'beyond). The measured availability over 13 months (02 §20.5). Written by ops.run_ops_retention().';

-- 9. identity.code_failure_tallies (AL59, J3S-8) -------------------------------------------------

create table if not exists identity.code_failure_tallies (
  key_hash       bytea       not null,
  hour           timestamptz not null,
  failure_count  integer     not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint code_failure_tallies_pkey primary key (key_hash, hour),
  constraint code_failure_tallies_key_hmac check (octet_length(key_hash) = 32),
  constraint code_failure_tallies_hour_aligned check (hour = date_trunc('hour', hour, 'UTC')),
  constraint code_failure_tallies_count check (failure_count between 1 and 1000000)
);

comment on table identity.code_failure_tallies is
  'Failed member sign-in codes per ADDRESS DIGEST and UTC hour (AL59, J3S-8: >= 25 failures over a '
  'sliding 24 hours for one address => security.member_code_targeted, NEVER a block, 03 A-4). The '
  'throttle counters of 0014 count per code request (login_request) and reset at each window: they '
  'cannot be summed per address. NO ADDRESS: key_hash is emailThrottleKey (HMAC-SHA-256 with '
  'AUTH_THROTTLE_PEPPER, the key of the code_request_email counters). Written by '
  'identity.record_code_failure() (influx_auth, E-2); read and purged after 48 hours by E-4.';
comment on column identity.code_failure_tallies.key_hash is
  'HMAC-SHA-256 of the normalised address (apps/api, emailThrottleKey): never the address.';

create index if not exists code_failure_tallies_hour_idx on identity.code_failure_tallies (hour);
comment on index identity.code_failure_tallies_hour_idx is
  'AL59 (the buckets of the last 24 hours, every minute) and the purge after 48 hours.';

drop trigger if exists code_failure_tallies_touch_updated_at on identity.code_failure_tallies;
create trigger code_failure_tallies_touch_updated_at
  before update on identity.code_failure_tallies
  for each row execute function influx.touch_updated_at();

-- 10. RLS on every new table ----------------------------------------------------------------------

alter table ops.worker_heartbeats          enable row level security;
alter table ops.worker_heartbeats          force  row level security;
alter table ops.probe_results              enable row level security;
alter table ops.probe_results              force  row level security;
alter table ops.database_samples           enable row level security;
alter table ops.database_samples           force  row level security;
alter table ops.signal_counts              enable row level security;
alter table ops.signal_counts              force  row level security;
alter table ops.alert_states               enable row level security;
alter table ops.alert_states               force  row level security;
alter table ops.request_metrics_hourly     enable row level security;
alter table ops.request_metrics_hourly     force  row level security;
alter table ops.process_metrics_hourly     enable row level security;
alter table ops.process_metrics_hourly     force  row level security;
alter table ops.probe_results_hourly       enable row level security;
alter table ops.probe_results_hourly       force  row level security;
alter table identity.code_failure_tallies  enable row level security;
alter table identity.code_failure_tallies  force  row level security;

revoke all on ops.worker_heartbeats, ops.probe_results, ops.database_samples, ops.signal_counts,
              ops.alert_states, ops.request_metrics_hourly, ops.process_metrics_hourly,
              ops.probe_results_hourly, identity.code_failure_tallies
  from public, anon, authenticated, service_role;

-- 11. The helpers (SECURITY INVOKER, owned by influx_maintenance_definer, no grant) ---------------

create or replace function ops.iso_utc(p_instant timestamptz)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.to_char(p_instant at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

comment on function ops.iso_utc(timestamptz) is
  'An instant in ISO 8601 UTC with MICROSECONDS and Z, whatever the session time zone: an instant given '
  'back unchanged (the AL51 watermark) compares exactly. NULL for NULL. SECURITY INVOKER owned by '
  'influx_maintenance_definer, NO grant.';

create or replace function ops.threshold_int(
  p_threshold  jsonb,
  p_key        text,
  p_default    integer,
  p_min        integer,
  p_max        integer
)
returns integer
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_value numeric;
begin
  if p_threshold is null or pg_catalog.jsonb_typeof(p_threshold -> p_key) is distinct from 'number' then
    return p_default;
  end if;
  v_value := pg_catalog.floor((p_threshold -> p_key)::numeric);
  return greatest(p_min, least(p_max, v_value))::integer;
end
$$;

comment on function ops.threshold_int(jsonb, text, integer, integer, integer) is
  'A window of a threshold (minutes, hours, days, samples) as an integer, bounded to [p_min, p_max] so '
  'that a mistyped threshold never makes the snapshot read months; p_default when absent, null or not a '
  'number. SECURITY INVOKER owned by influx_maintenance_definer, NO grant.';

-- 12. The worker's writes (E-4) -------------------------------------------------------------------

-- 12.1 The heartbeat
create or replace function ops.record_worker_heartbeat(
  p_worker_id    text,
  p_instance     text,
  p_version      text,
  p_started_at   timestamptz,
  p_loop_turned  boolean
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_worker_id is null or p_worker_id !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$'
     or p_instance is null or p_instance !~ '^[A-Za-z0-9._:-]{1,64}$'
     or p_version is null or p_version !~ '^[A-Za-z0-9._-]{1,64}$'
     or p_started_at is null or p_started_at > pg_catalog.now() + interval '5 minutes'
     or p_loop_turned is null then
    raise exception 'malformed heartbeat' using errcode = 'invalid_parameter_value';
  end if;

  insert into ops.worker_heartbeats as h (worker_id, instance, version, started_at)
  values (p_worker_id, p_instance, p_version, p_started_at)
  on conflict (worker_id) do update
     set beat_at      = pg_catalog.now(),
         loop_turn_at = case when p_loop_turned then pg_catalog.now() else h.loop_turn_at end
   where h.instance = excluded.instance
     and h.version = excluded.version
     and h.started_at = excluded.started_at;
  if not found then
    raise exception 'a worker id names one process: its instance, version and start never change'
      using errcode = 'invalid_parameter_value';
  end if;
end
$$;

comment on function ops.record_worker_heartbeat(text, text, text, timestamptz, boolean) is
  'E-4, 02 §11.3: the beat of one worker process. Inserts its line (beat and last turn = now()), or '
  'moves its beat to now(), and its last turn too when p_loop_turned. 22023 for a malformed value or a '
  'worker id already used by another process (other instance, version or start). SECURITY DEFINER owned '
  'by influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 12.2 The results of the probe
create or replace function ops.record_probe_results(
  p_instance  text,
  p_results   jsonb
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_keys constant text[] := array['target', 'checked_at', 'outcome', 'status_code', 'failure_code',
                                  'duration_ms'];
  v_item     jsonb;
  v_at       timestamptz;
  v_outcome  text;
  v_status   numeric;
  v_failure  text;
  v_duration numeric;
  v_count    integer;
begin
  if p_instance is null or p_instance !~ '^[A-Za-z0-9._:-]{1,64}$'
     or p_results is null or pg_catalog.jsonb_typeof(p_results) <> 'array'
     or pg_catalog.jsonb_array_length(p_results) > 500 then
    raise exception 'an instance and an array of at most 500 results' using errcode = 'invalid_parameter_value';
  end if;

  -- Every element checked before anything is written; any data error is 22023.
  begin
    for v_item in select e.value from pg_catalog.jsonb_array_elements(p_results) e loop
      if pg_catalog.jsonb_typeof(v_item) <> 'object'
         or exists (select 1 from pg_catalog.jsonb_object_keys(v_item) k where k <> all (c_keys)) then
        raise exception 'malformed probe result' using errcode = 'invalid_parameter_value';
      end if;
      if pg_catalog.jsonb_typeof(v_item -> 'target') is distinct from 'string'
         or pg_catalog.jsonb_typeof(v_item -> 'checked_at') is distinct from 'string'
         or pg_catalog.jsonb_typeof(v_item -> 'outcome') is distinct from 'string'
         or pg_catalog.jsonb_typeof(v_item -> 'duration_ms') is distinct from 'number'
         or coalesce(pg_catalog.jsonb_typeof(v_item -> 'status_code'), 'null') not in ('null', 'number')
         or coalesce(pg_catalog.jsonb_typeof(v_item -> 'failure_code'), 'null') not in ('null', 'string') then
        raise exception 'malformed probe result' using errcode = 'invalid_parameter_value';
      end if;
      if (v_item ->> 'target') <> all (pg_catalog.enum_range(null::ops.probe_target)::text[]) then
        raise exception 'unknown probe target' using errcode = 'invalid_parameter_value';
      end if;
      v_at       := (v_item ->> 'checked_at')::timestamptz;
      v_outcome  := v_item ->> 'outcome';
      v_duration := (v_item -> 'duration_ms')::numeric;
      v_status   := case when pg_catalog.jsonb_typeof(v_item -> 'status_code') = 'number'
                         then (v_item -> 'status_code')::numeric end;
      v_failure  := case when pg_catalog.jsonb_typeof(v_item -> 'failure_code') = 'string'
                         then v_item ->> 'failure_code' end;
      -- a late flush after an outage of the base is admitted, a fabricated history is not
      if v_at < pg_catalog.now() - interval '1 hour' or v_at > pg_catalog.now() + interval '1 minute' then
        raise exception 'a probe result is of the last hour' using errcode = 'invalid_parameter_value';
      end if;
      if v_outcome not in ('up', 'down')
         or v_duration < 0 or v_duration > 600000 or v_duration <> pg_catalog.floor(v_duration)
         or (v_status is not null
             and (v_status < 100 or v_status > 599 or v_status <> pg_catalog.floor(v_status)))
         or (v_failure is not null
             and v_failure not in ('timeout', 'connection', 'status', 'redirect', 'body'))
         or (v_outcome = 'up') <> (v_failure is null)
         or (v_outcome = 'up' and v_status is null)
         or (v_failure in ('status', 'redirect', 'body') and v_status is null)
         or (v_failure = 'connection' and v_status is not null)
         or (v_failure = 'redirect' and (v_status < 300 or v_status > 399)) then
        raise exception 'malformed probe result' using errcode = 'invalid_parameter_value';
      end if;
    end loop;
  exception when data_exception then
    raise exception 'malformed probe result' using errcode = 'invalid_parameter_value';
  end;

  insert into ops.probe_results
    (checked_at, instance, target, outcome, status_code, failure_code, duration_ms)
  select (e ->> 'checked_at')::timestamptz, p_instance, (e ->> 'target')::ops.probe_target,
         e ->> 'outcome',
         case when pg_catalog.jsonb_typeof(e -> 'status_code') = 'number'
              then (e -> 'status_code')::numeric::smallint end,
         case when pg_catalog.jsonb_typeof(e -> 'failure_code') = 'string'
              then e ->> 'failure_code' end,
         (e -> 'duration_ms')::numeric::integer
    from pg_catalog.jsonb_array_elements(p_results) e
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

comment on function ops.record_probe_results(text, jsonb) is
  'E-4, 02 §20.5: writes the results of the probe of one instance, an array of at most 500 '
  '{target, checked_at, outcome, status_code, failure_code, duration_ms}. 22023 for an element of '
  'another shape, an unknown target, an incoherent outcome, or a checked_at outside [now - 1 hour, now '
  '+ 1 minute] (a late flush is admitted, a fabricated history is not): nothing is written then. A '
  'result already written is skipped. Returns the number of lines written. SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 12.3 The connections of the base
create or replace function ops.record_database_sample()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into ops.database_samples (minute, connections, max_connections)
  select pg_catalog.date_trunc('minute', pg_catalog.now(), 'UTC'),
         (select pg_catalog.count(*)::integer from pg_catalog.pg_stat_activity a
           where a.datid is not null),
         pg_catalog.current_setting('max_connections')::integer
  on conflict (minute) do nothing
$$;

comment on function ops.record_database_sample() is
  'E-4, 02 §20.5 "Base", AL58: the connections of the cluster for the CURRENT minute, read by the '
  'function itself (backends attached to a database in pg_stat_activity; max_connections); one line '
  'per minute whatever the number of worker instances. SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 13. The states of the alerts, under the lock of their scope --------------------------------------
-- Lock: pg_try_advisory_xact_lock(2026147, 1) for worker, (2026147, 2) for api (two-key form,
-- objsubid 2 in pg_locks: never the key space of the one-key locks of 0006, 0131, 0133).

create or replace function ops.begin_alert_round(p_scope text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_states jsonb;
begin
  if p_scope is null or p_scope not in ('worker', 'api') then
    raise exception 'scope is worker or api' using errcode = 'invalid_parameter_value';
  end if;
  -- session_user is the proof (0115): a login role takes its own elevated role only (0001)
  if (p_scope = 'worker') <> (session_user::text = 'influx_worker_login')
     or (p_scope = 'api') <> (session_user::text = 'influx_ops_login') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if not pg_catalog.pg_try_advisory_xact_lock(2026147, case when p_scope = 'worker' then 1 else 2 end) then
    return null;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'code', s.code,
             'subject_key', s.subject_key,
             'state', s.state,
             'opened_at', ops.iso_utc(s.opened_at),
             'last_notified_at', ops.iso_utc(s.last_notified_at),
             'notified_count', s.notified_count,
             'resolved_at', ops.iso_utc(s.resolved_at),
             'last_value', s.last_value)
           order by s.code, s.subject_key), '[]'::jsonb)
    into v_states
    from ops.alert_states s
   where s.scope = p_scope
     and (s.state = 'open' or s.resolved_at > pg_catalog.now() - interval '24 hours');
  return v_states;
end
$$;

comment on function ops.begin_alert_round(text) is
  '15 RG165: opens the round of a scope. Takes the transaction advisory lock of the scope, without '
  'waiting: NULL when another instance holds it (it does the round). Otherwise the states of the scope, '
  'open or resolved less than 24 hours ago: [{code, subject_key, state, opened_at, last_notified_at, '
  'notified_count, resolved_at, last_value}], instants in ISO 8601 UTC with microseconds. The scope '
  'worker for influx_worker_login, api for influx_ops_login (session_user; 42501 otherwise; 22023 for '
  'another scope). SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for '
  'influx_worker and influx_ops ONLY.';

create or replace function ops.save_alert_states(p_scope text, p_states jsonb)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_keys constant text[] := array['code', 'subject_key', 'state', 'opened_at', 'last_notified_at',
                                  'notified_count', 'resolved_at', 'last_value'];
  v_item      jsonb;
  v_opened    timestamptz;
  v_notified  timestamptz;
  v_resolved  timestamptz;
  v_count     numeric;
  v_written   integer := 0;
begin
  if p_scope is null or p_scope not in ('worker', 'api') then
    raise exception 'scope is worker or api' using errcode = 'invalid_parameter_value';
  end if;
  if (p_scope = 'worker') <> (session_user::text = 'influx_worker_login')
     or (p_scope = 'api') <> (session_user::text = 'influx_ops_login') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if not exists (select 1 from pg_catalog.pg_locks l
                  where l.locktype = 'advisory' and l.pid = pg_catalog.pg_backend_pid() and l.granted
                    and l.classid = 2026147::oid
                    and l.objid = (case when p_scope = 'worker' then 1 else 2 end)::oid
                    and l.objsubid = 2) then
    raise exception 'the round of this scope is not open in this transaction (ops.begin_alert_round)'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_states is null or pg_catalog.jsonb_typeof(p_states) <> 'array'
     or pg_catalog.jsonb_array_length(p_states) > 1000 then
    raise exception 'an array of at most 1000 states' using errcode = 'invalid_parameter_value';
  end if;

  -- All or nothing: any malformed element, refused value or constraint is 22023.
  begin
    for v_item in select e.value from pg_catalog.jsonb_array_elements(p_states) e loop
      if pg_catalog.jsonb_typeof(v_item) <> 'object'
         or exists (select 1 from pg_catalog.jsonb_object_keys(v_item) k where k <> all (c_keys)) then
        raise exception 'malformed alert state' using errcode = 'invalid_parameter_value';
      end if;
      if pg_catalog.jsonb_typeof(v_item -> 'code') is distinct from 'string'
         or pg_catalog.jsonb_typeof(v_item -> 'state') is distinct from 'string'
         or pg_catalog.jsonb_typeof(v_item -> 'opened_at') is distinct from 'string'
         or pg_catalog.jsonb_typeof(v_item -> 'notified_count') is distinct from 'number'
         or coalesce(pg_catalog.jsonb_typeof(v_item -> 'subject_key'), 'string') <> 'string'
         or coalesce(pg_catalog.jsonb_typeof(v_item -> 'last_notified_at'), 'null') not in ('null', 'string')
         or coalesce(pg_catalog.jsonb_typeof(v_item -> 'resolved_at'), 'null') not in ('null', 'string')
         or coalesce(pg_catalog.jsonb_typeof(v_item -> 'last_value'), 'null') not in ('null', 'object') then
        raise exception 'malformed alert state' using errcode = 'invalid_parameter_value';
      end if;
      v_opened   := (v_item ->> 'opened_at')::timestamptz;
      v_notified := case when pg_catalog.jsonb_typeof(v_item -> 'last_notified_at') = 'string'
                         then (v_item ->> 'last_notified_at')::timestamptz end;
      v_resolved := case when pg_catalog.jsonb_typeof(v_item -> 'resolved_at') = 'string'
                         then (v_item ->> 'resolved_at')::timestamptz end;
      v_count    := (v_item -> 'notified_count')::numeric;
      if v_count <> pg_catalog.floor(v_count)
         or greatest(v_opened, v_notified, v_resolved) > pg_catalog.now() + interval '5 minutes' then
        raise exception 'malformed alert state' using errcode = 'invalid_parameter_value';
      end if;

      insert into ops.alert_states as s
        (scope, code, subject_key, state, opened_at, last_notified_at, notified_count, resolved_at,
         last_value)
      values (p_scope, v_item ->> 'code', coalesce(v_item ->> 'subject_key', ''), v_item ->> 'state',
              v_opened, v_notified, v_count::integer, v_resolved,
              case when pg_catalog.jsonb_typeof(v_item -> 'last_value') = 'object'
                   then v_item -> 'last_value' else '{}'::jsonb end)
      on conflict (scope, code, subject_key) do update
         set state            = excluded.state,
             opened_at        = excluded.opened_at,
             last_notified_at = excluded.last_notified_at,
             notified_count   = excluded.notified_count,
             resolved_at      = excluded.resolved_at,
             last_value       = excluded.last_value;
      v_written := v_written + 1;
    end loop;
  exception when data_exception or integrity_constraint_violation then
    raise exception 'malformed alert state' using errcode = 'invalid_parameter_value';
  end;
  return v_written;
end
$$;

comment on function ops.save_alert_states(text, jsonb) is
  '15 RG165: upserts the given states of a scope ([{code, subject_key, state, opened_at, '
  'last_notified_at, notified_count, resolved_at, last_value}], 1000 at most), all or nothing. Requires '
  'the lock of the scope taken by ops.begin_alert_round() in this transaction (55000 otherwise); same '
  'scope rules (42501); 22023 for a malformed element, an unknown code, AL50 outside the scope api (or '
  'another code in it), an instant more than 5 minutes ahead, or a last_value that is not a flat object '
  'of codes, counts and instants. Returns the number of states written. SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_worker and influx_ops ONLY.';

-- 14. What the api reads (E-6): the last beat of the workers and AL50 ----------------------------

create or replace function ops.worker_liveness()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'now', ops.iso_utc(pg_catalog.now()),
    'last_beat_at', (select ops.iso_utc(max(h.beat_at)) from ops.worker_heartbeats h),
    'last_loop_turn_at', (select ops.iso_utc(max(h.loop_turn_at)) from ops.worker_heartbeats h),
    'definition', (select pg_catalog.jsonb_build_object(
                            'nature', d.nature,
                            'threshold', d.threshold_value,
                            'recipient_roles', pg_catalog.to_jsonb(d.recipient_roles),
                            'is_active', d.is_active)
                     from backoffice.alert_definitions d
                    where d.code = 'AL50'))
$$;

comment on function ops.worker_liveness() is
  'E-6, 02 §11.3 and §20.5 ("l''API surveille le worker"): {now, last_beat_at, last_loop_turn_at, '
  'definition: {nature, threshold, recipient_roles, is_active} of AL50}, the instants the latest of '
  'every worker process (null before any beat). The only read of influx_ops beyond its own writes: '
  'handed by this function, never a right on backoffice. SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_ops ONLY.';

-- 15. What the evaluator of the worker reads (E-4) -----------------------------------------------

create or replace function ops.technical_alert_snapshot(p_new_errors_since timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  -- AL51: a group is seen once it has been written for 10 s (the ops pool commits within 4 s)
  c_settle    constant interval := interval '10 seconds';
  v_now       timestamptz := pg_catalog.now();
  v_minute    timestamptz := pg_catalog.date_trunc('minute', pg_catalog.now(), 'UTC');
  v_defs      jsonb;
  v_t         jsonb;
  v_m         jsonb := '{}'::jsonb;
  v_window    integer;
  v_wait      integer;
  v_days      integer;
  v_since     timestamptz;
  v_first     timestamptz;
  v_history   integer;
  v_calls     bigint;
  v_usual     numeric;
  v_excluded  text[];
  v_breakers  text[];
  v_part      jsonb;
begin
  select coalesce(pg_catalog.jsonb_object_agg(d.code, pg_catalog.jsonb_build_object(
                    'nature', d.nature,
                    'threshold', d.threshold_value,
                    'recipient_roles', pg_catalog.to_jsonb(d.recipient_roles),
                    'is_active', d.is_active)), '{}'::jsonb),
         coalesce(pg_catalog.jsonb_object_agg(d.code, d.threshold_value), '{}'::jsonb)
    into v_defs, v_t
    from backoffice.alert_definitions d
   where d.code in ('AL48', 'AL49', 'AL51', 'AL52', 'AL53', 'AL54', 'AL55', 'AL56', 'AL57', 'AL58',
                    'AL59', 'AL60', 'AL61', 'AL62', 'AL63');

  -- AL48 (16 RG98): the login codes of the window that ENDS no_sign_in_within_minutes ago
  v_window := ops.threshold_int(v_t -> 'AL48', 'window_minutes', 60, 5, 1440);
  v_wait   := ops.threshold_int(v_t -> 'AL48', 'no_sign_in_within_minutes', 10, 1, 120);
  select pg_catalog.jsonb_build_object(
           'sends', pg_catalog.count(*),
           'median_delivery_seconds',
             round((percentile_cont(0.5) within group (order by x.delivery_seconds)
                      filter (where x.delivery_seconds is not null))::numeric, 3),
           'p90_delivery_seconds',
             round((percentile_cont(0.9) within group (order by x.delivery_seconds)
                      filter (where x.delivery_seconds is not null))::numeric, 3),
           'no_sign_in_share_bp',
             case when pg_catalog.count(*) filter (where x.member) = 0 then null
                  else pg_catalog.floor(10000.0 * pg_catalog.count(*) filter (where x.member and not x.signed_in)
                                        / pg_catalog.count(*) filter (where x.member))::integer end,
           'delivered_share_bp',
             case when pg_catalog.count(*) = 0 then null
                  else pg_catalog.floor(10000.0 * pg_catalog.count(*) filter (where x.delivered)
                                        / pg_catalog.count(*))::integer end)
    into v_part
    from (select (extract(epoch from (t.delivered_at - t.created_at)))::double precision as delivery_seconds,
                 t.status = 'delivered' as delivered,
                 (t.account_id is not null
                  and exists (select 1 from identity.account_roles r
                               where r.account_id = t.account_id
                                 and r.role in ('advertiser', 'creator'))) as member,
                 exists (select 1 from identity.sessions s
                          where s.account_id = t.account_id and s.surface = 'member'
                            and s.created_at >= t.created_at
                            and s.created_at < t.created_at + pg_catalog.make_interval(mins => v_wait))
                   as signed_in
            from leads.transactional_sends t
           where t.priority = 'p0' and t.email_code = 'auth.login_code'
             and t.created_at >= v_now - pg_catalog.make_interval(mins => v_window + v_wait)
             and t.created_at <  v_now - pg_catalog.make_interval(mins => v_wait)) x;
  v_m := v_m || pg_catalog.jsonb_build_object('AL48', v_part);

  -- AL51 (02 §20.6, §20.7): server groups only, in (since - 10 s, now - 10 s], 20 at most each
  v_since := coalesce(p_new_errors_since,
                      v_now - pg_catalog.make_interval(
                                hours => ops.threshold_int(v_t -> 'AL51', 'digest_window_hours', 24, 1, 168)));
  v_m := v_m || pg_catalog.jsonb_build_object('AL51', pg_catalog.jsonb_build_object(
    'new_groups',
      (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'id', g.id, 'error_type', g.error_type, 'route', g.route,
                'first_seen_at', ops.iso_utc(g.first_seen_at)) order by g.first_seen_at, g.id), '[]'::jsonb)
         from (select g.id, g.error_type, g.route, g.first_seen_at
                 from ops.error_groups g
                where g.source = 'server'
                  and g.first_seen_at > v_since - c_settle
                  and g.first_seen_at <= v_now - c_settle
                order by g.first_seen_at, g.id
                limit 20) g),
    'regressions',
      (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'id', g.id, 'error_type', g.error_type, 'route', g.route,
                'last_regressed_at', ops.iso_utc(g.last_regressed_at)) order by g.last_regressed_at, g.id),
                '[]'::jsonb)
         from (select g.id, g.error_type, g.route, g.last_regressed_at
                 from ops.error_groups g
                where g.source = 'server'
                  and g.last_regressed_at > v_since - c_settle
                  and g.last_regressed_at <= v_now - c_settle
                order by g.last_regressed_at, g.id
                limit 20) g)));

  -- AL52 (02 §20.6): the api, the last window_minutes whole minutes
  v_window := ops.threshold_int(v_t -> 'AL52', 'window_minutes', 5, 1, 1440);
  select pg_catalog.jsonb_build_object(
           'requests', coalesce(sum(m.request_count), 0),
           'server_errors', coalesce(sum(m.server_error_count), 0))
    into v_part
    from ops.request_metrics m
   where m.service = 'api'
     and m.minute >= v_minute - pg_catalog.make_interval(mins => v_window) and m.minute < v_minute;
  v_m := v_m || pg_catalog.jsonb_build_object('AL52', v_part);

  -- AL53 (02 §20.6): the histograms of the api added up, excluded routes left out
  v_window := ops.threshold_int(v_t -> 'AL53', 'window_minutes', 10, 1, 1440);
  v_excluded := array(select pg_catalog.jsonb_array_elements_text(
                               case when pg_catalog.jsonb_typeof(v_t -> 'AL53' -> 'excluded_routes') = 'array'
                                    then v_t -> 'AL53' -> 'excluded_routes' else '[]'::jsonb end));
  select pg_catalog.jsonb_build_object('buckets', pg_catalog.to_jsonb(array[
           coalesce(sum(m.duration_buckets[1]), 0), coalesce(sum(m.duration_buckets[2]), 0),
           coalesce(sum(m.duration_buckets[3]), 0), coalesce(sum(m.duration_buckets[4]), 0),
           coalesce(sum(m.duration_buckets[5]), 0), coalesce(sum(m.duration_buckets[6]), 0),
           coalesce(sum(m.duration_buckets[7]), 0), coalesce(sum(m.duration_buckets[8]), 0),
           coalesce(sum(m.duration_buckets[9]), 0)]::bigint[]))
    into v_part
    from ops.request_metrics m
   where m.service = 'api'
     and m.minute >= v_minute - pg_catalog.make_interval(mins => v_window) and m.minute < v_minute
     and (m.method || ' ' || m.route) <> all (v_excluded);
  v_m := v_m || pg_catalog.jsonb_build_object('AL53', v_part);

  -- AL55 (02 §20.6): calls per minute now, and at the same UTC hour of the previous days (the hourly
  -- roll-up, or the minutes of an hour not rolled up yet)
  v_window := ops.threshold_int(v_t -> 'AL55', 'window_minutes', 5, 1, 60);
  v_days   := ops.threshold_int(v_t -> 'AL55', 'history_days', 14, 1, 28);
  select coalesce(sum(m.request_count), 0) into v_calls
    from ops.request_metrics m
   where m.service = 'api'
     and m.minute >= v_minute - pg_catalog.make_interval(mins => v_window) and m.minute < v_minute;
  v_first := least((select min(m.minute) from ops.request_metrics m where m.service = 'api'),
                   (select min(h.hour) from ops.request_metrics_hourly h where h.service = 'api'));
  v_history := case when v_first is null then 0
                    else least(v_days, pg_catalog.floor(extract(epoch from (v_now - v_first)) / 86400))::integer
               end;
  if v_history > 0 then
    select sum(coalesce(
             (select sum(h.request_count) from ops.request_metrics_hourly h
               where h.service = 'api' and h.hour = s.slot),
             (select sum(m.request_count) from ops.request_metrics m
               where m.service = 'api' and m.minute >= s.slot and m.minute < s.slot + interval '1 hour'),
             0))::numeric / (60 * v_history)
      into v_usual
      from (select pg_catalog.date_trunc('hour', v_now, 'UTC') - pg_catalog.make_interval(hours => 24 * k)
                     as slot
              from pg_catalog.generate_series(1, v_history) k) s;
  else
    v_usual := null;
  end if;
  v_m := v_m || pg_catalog.jsonb_build_object('AL55', pg_catalog.jsonb_build_object(
    'calls_per_minute', round(v_calls::numeric / v_window, 2),
    'usual_calls_per_minute', round(v_usual, 2),
    'history_days', v_history));

  -- AL56 (02 §20.6, 03 A-3): the 429 of the api
  v_window := ops.threshold_int(v_t -> 'AL56', 'window_minutes', 15, 1, 1440);
  select pg_catalog.jsonb_build_object(
           'requests', coalesce(sum(m.request_count), 0),
           'throttled', coalesce(sum(m.throttled_count), 0))
    into v_part
    from ops.request_metrics m
   where m.service = 'api'
     and m.minute >= v_minute - pg_catalog.make_interval(mins => v_window) and m.minute < v_minute;
  v_m := v_m || pg_catalog.jsonb_build_object('AL56', v_part);

  -- AL57 (02 §20.6): per service, the last window_minutes measured minutes
  v_window := ops.threshold_int(v_t -> 'AL57', 'window_minutes', 5, 1, 60);
  select pg_catalog.jsonb_build_object('services', coalesce(pg_catalog.jsonb_agg(x.line order by x.service), '[]'::jsonb))
    into v_part
    from (select r.service,
                 pg_catalog.jsonb_build_object(
                   'service', r.service,
                   'minutes', pg_catalog.count(distinct r.minute),
                   'avg_event_loop_delay_ms', round(avg(r.event_loop_delay_p99_ms), 2),
                   'avg_rss_bytes', round(avg(r.rss_bytes))) as line
            from (select p.service, p.minute, p.event_loop_delay_p99_ms, p.rss_bytes,
                         pg_catalog.dense_rank() over (partition by p.service order by p.minute desc) as rank
                    from ops.process_metrics p
                   where p.minute >= v_minute - pg_catalog.make_interval(mins => v_window + 2)) r
           where r.rank <= v_window
           group by r.service) x;
  v_m := v_m || pg_catalog.jsonb_build_object('AL57', v_part);

  -- AL58 (02 §20.6): the last consecutive_samples samples, oldest first
  v_window := ops.threshold_int(v_t -> 'AL58', 'consecutive_samples', 3, 1, 60);
  select pg_catalog.jsonb_build_object('samples', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'minute', ops.iso_utc(s.minute), 'connections', s.connections,
           'max_connections', s.max_connections) order by s.minute), '[]'::jsonb))
    into v_part
    from (select d.minute, d.connections, d.max_connections
            from ops.database_samples d
           where d.minute >= v_minute - pg_catalog.make_interval(mins => v_window + 2)
           order by d.minute desc
           limit v_window) s;
  v_m := v_m || pg_catalog.jsonb_build_object('AL58', v_part);

  -- AL59 (J3S-8): the address digests with at least min_failures failed codes over window_hours,
  -- as an OPAQUE key (the first 8 bytes of the HMAC, hex): never the address
  v_window := ops.threshold_int(v_t -> 'AL59', 'window_hours', 24, 1, 168);
  v_wait   := ops.threshold_int(v_t -> 'AL59', 'min_failures', 25, 1, 1000000);
  select pg_catalog.jsonb_build_object('targets', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'key', f.key, 'failures', f.failures) order by f.failures desc, f.key), '[]'::jsonb))
    into v_part
    from (select pg_catalog.encode(pg_catalog.substr(t.key_hash, 1, 8), 'hex') as key,
                 sum(t.failure_count)::integer as failures
            from identity.code_failure_tallies t
           where t.hour > v_now - pg_catalog.make_interval(hours => v_window + 1)
           group by t.key_hash
          having sum(t.failure_count) >= v_wait
           order by 2 desc, 1
           limit 50) f;
  v_m := v_m || pg_catalog.jsonb_build_object('AL59', v_part);

  -- AL60 (J7S-8, J7S-2): the GoTrue passes finished in the last 24 hours with a realignment
  -- failure or a breaker count
  v_breakers := array(select b
                        from pg_catalog.jsonb_array_elements_text(
                               case when pg_catalog.jsonb_typeof(v_t -> 'AL60' -> 'breaker_counts') = 'array'
                                    then v_t -> 'AL60' -> 'breaker_counts' else '[]'::jsonb end) b
                       where b ~ '^[a-z][a-z0-9_]{0,62}$');
  select pg_catalog.jsonb_build_object('runs', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'run_id', r.id,
           'finished_at', ops.iso_utc(r.finished_at),
           'realign_failed', r.realign_failed,
           'breaker', r.breaker) order by r.finished_at, r.id), '[]'::jsonb))
    into v_part
    from (select x.id, x.finished_at,
                 coalesce((x.counts ->> 'gotrue_realign_failed')::numeric, 0)::bigint as realign_failed,
                 (select u.b from pg_catalog.unnest(v_breakers) with ordinality u (b, o)
                   where coalesce((x.counts ->> u.b)::numeric, 0) > 0
                   order by u.o limit 1) as breaker
            from ops.periodic_runs x
           where x.task_code = 'auth_orphan_purge'
             and x.period_key >= pg_catalog.to_char((v_now - interval '25 hours') at time zone 'UTC',
                                                    'YYYY-MM-DD"T"HH24')
             and x.finished_at > v_now - interval '24 hours'
           order by x.finished_at, x.id) r
   where r.realign_failed > 0 or r.breaker is not null;
  v_m := v_m || pg_catalog.jsonb_build_object('AL60', v_part);

  -- AL61, AL62 (J7S-8): the signals of the Brevo webhook over window_hours
  v_window := ops.threshold_int(v_t -> 'AL61', 'window_hours', 24, 1, 168);
  select pg_catalog.jsonb_build_object(
           'authenticated', coalesce(sum(c.count) filter (where c.signal = 'webhook_brevo_authenticated'), 0),
           'ignored', coalesce(sum(c.count) filter (where c.signal = 'webhook_brevo_ignored'), 0))
    into v_part
    from ops.signal_counts c
   where c.minute >= v_minute - pg_catalog.make_interval(hours => v_window)
     and c.signal in ('webhook_brevo_authenticated', 'webhook_brevo_ignored');
  v_m := v_m || pg_catalog.jsonb_build_object('AL61', v_part);

  v_window := ops.threshold_int(v_t -> 'AL62', 'window_hours', 24, 1, 168);
  select pg_catalog.jsonb_build_object(
           'occurrences', coalesce(sum(c.count), 0),
           'last_at', ops.iso_utc(max(c.minute)))
    into v_part
    from ops.signal_counts c
   where c.minute >= v_minute - pg_catalog.make_interval(hours => v_window)
     and c.signal = 'webhook_brevo_ip_drift';
  v_m := v_m || pg_catalog.jsonb_build_object('AL62', v_part);

  -- AL63 (F4): executed requests not closed open_after_hours after their execution
  v_window := ops.threshold_int(v_t -> 'AL63', 'open_after_hours', 24, 1, 720);
  select pg_catalog.jsonb_build_object('executions', coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', e.request_id, 'executed_at', ops.iso_utc(e.executed_at))
           order by e.executed_at, e.request_id), '[]'::jsonb))
    into v_part
    from (select x.request_id, x.executed_at
            from privacy.request_executions x
           where x.executed_at is not null and x.completed_at is null
             and x.executed_at <= v_now - pg_catalog.make_interval(hours => v_window)
           order by x.executed_at, x.request_id
           limit 50) e;
  v_m := v_m || pg_catalog.jsonb_build_object('AL63', v_part);

  return pg_catalog.jsonb_build_object('now', ops.iso_utc(v_now), 'definitions', v_defs, 'measures', v_m);
end
$$;

comment on function ops.technical_alert_snapshot(timestamptz) is
  'E-4, 15 RG165: what the evaluator of the worker reads, in one call: {now, definitions (AL48, AL49, '
  'AL51 to AL63: nature, threshold, recipient_roles, is_active), measures}. Computes each measure with '
  'the window written in its threshold (bounded by ops.threshold_int), compares NOTHING (apps/api does). '
  'AL48 the login codes of the window_minutes ending no_sign_in_within_minutes ago; AL51 the server '
  'groups first seen (and the regressions) in (p_new_errors_since - 10 s, now - 10 s], 20 each, '
  'p_new_errors_since NULL = digest_window_hours; AL52, AL53, AL55, AL56 the api over the last whole '
  'minutes; AL57 the last measured minutes per service; AL58 the last samples; AL59 opaque keys, never '
  'an address; AL60 the GoTrue passes of 24 h; AL61, AL62 the webhook signals; AL63 the executions left '
  'open. Instants ISO 8601 UTC with microseconds. Codes, counts, durations: no personal data leaves. '
  'SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for influx_worker '
  'ONLY.';

-- 16. The admin addresses for the alerts (RG165 "admin"), read by the worker, never stored --------

create or replace function ops.admin_alert_recipients()
returns table (account_id uuid, email text)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.email::text
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id and r.role = 'admin'
    join identity.agent_profiles p on p.account_id = a.id
   where a.status = 'active' and p.is_active and not p.is_break_glass
   order by a.id
$$;

comment on function ops.admin_alert_recipients() is
  '15 RG165 "admin = les comptes admin actifs, hors compte de secours": the account and address of each '
  'active admin with an active internal profile, the break-glass account excluded (the query of '
  'criticalAlertRecipients, apps/api identity/repository.ts). The ONLY path of the worker to these '
  'addresses: kept in memory for one sending, never written to ops nor logged (02 §20.8). SECURITY '
  'DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 17. The daily retention of the ops schema (E-4, task ops_retention) ----------------------------

create or replace function ops.run_ops_retention(
  p_run_id   uuid,
  p_attempt  smallint
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_hours   constant integer := 48;
  c_batch   constant integer := 5000;
  v_now               timestamptz := pg_catalog.now();
  -- an hour H is closed when H + 2 hours has passed (0016: a minute is accepted up to an hour
  -- after it ends; ops.record_probe_results() likewise)
  v_closed_until      timestamptz := pg_catalog.date_trunc('hour', pg_catalog.now() - interval '2 hours', 'UTC')
                                     + interval '1 hour';
  v_minutes_before    timestamptz := pg_catalog.now() - interval '336 hours';   -- 14 days
  v_occurrences_before timestamptz := pg_catalog.now() - interval '720 hours';  -- 30 days
  v_beats_before      timestamptz := pg_catalog.now() - interval '168 hours';   -- 7 days
  v_tallies_before    timestamptz := pg_catalog.now() - interval '48 hours';
  v_months_before     timestamptz := ((pg_catalog.now() at time zone 'UTC') - interval '13 months')
                                     at time zone 'UTC';
  v_hours   timestamptz[];
  v_more    boolean := false;
  v_counts  jsonb := '{}'::jsonb;
  v_n       integer;
begin
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'ops_retention') then
    raise exception 'no open ops_retention run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- 1. Roll-up, oldest closed hours first, 48 per source at most --------------------------------

  -- 1.1 requests: all instances together
  select coalesce(pg_catalog.array_agg(h.hour order by h.hour), '{}') into v_hours
    from (select distinct pg_catalog.date_trunc('hour', m.minute, 'UTC') as hour
            from ops.request_metrics m
           where m.minute < v_closed_until
             and not exists (select 1 from ops.request_metrics_hourly x
                              where x.hour = pg_catalog.date_trunc('hour', m.minute, 'UTC'))
           order by 1
           limit c_hours + 1) h;
  if pg_catalog.cardinality(v_hours) > c_hours then
    v_more := true;
    v_hours := v_hours[1:c_hours];
  end if;
  if pg_catalog.cardinality(v_hours) > 0 then
    insert into ops.request_metrics_hourly
      (hour, service, method, route, request_count, server_error_count, throttled_count,
       duration_buckets)
    select pg_catalog.date_trunc('hour', m.minute, 'UTC'), m.service, m.method, m.route,
           sum(m.request_count), sum(m.server_error_count), sum(m.throttled_count),
           array[sum(m.duration_buckets[1]), sum(m.duration_buckets[2]), sum(m.duration_buckets[3]),
                 sum(m.duration_buckets[4]), sum(m.duration_buckets[5]), sum(m.duration_buckets[6]),
                 sum(m.duration_buckets[7]), sum(m.duration_buckets[8]), sum(m.duration_buckets[9])]::bigint[]
      from ops.request_metrics m
     where m.minute >= v_hours[1]
       and m.minute < v_hours[pg_catalog.cardinality(v_hours)] + interval '1 hour'
       and pg_catalog.date_trunc('hour', m.minute, 'UTC') = any (v_hours)
     group by 1, 2, 3, 4;
  end if;
  v_counts := v_counts || pg_catalog.jsonb_build_object('request_hours_rolled',
                                                        pg_catalog.cardinality(v_hours));

  -- 1.2 process health: per instance
  select coalesce(pg_catalog.array_agg(h.hour order by h.hour), '{}') into v_hours
    from (select distinct pg_catalog.date_trunc('hour', p.minute, 'UTC') as hour
            from ops.process_metrics p
           where p.minute < v_closed_until
             and not exists (select 1 from ops.process_metrics_hourly x
                              where x.hour = pg_catalog.date_trunc('hour', p.minute, 'UTC'))
           order by 1
           limit c_hours + 1) h;
  if pg_catalog.cardinality(v_hours) > c_hours then
    v_more := true;
    v_hours := v_hours[1:c_hours];
  end if;
  if pg_catalog.cardinality(v_hours) > 0 then
    insert into ops.process_metrics_hourly
      (hour, service, instance, minutes, event_loop_delay_p99_avg_ms, event_loop_delay_max_ms,
       rss_avg_bytes, rss_max_bytes, heap_used_avg_bytes, cpu_avg_percent, cpu_max_percent)
    select pg_catalog.date_trunc('hour', p.minute, 'UTC'), p.service, p.instance,
           pg_catalog.count(*)::smallint,
           round(avg(p.event_loop_delay_p99_ms), 2), max(p.event_loop_delay_max_ms),
           round(avg(p.rss_bytes))::bigint, max(p.rss_bytes),
           round(avg(p.heap_used_bytes))::bigint,
           round(avg(p.cpu_percent), 2), max(p.cpu_percent)
      from ops.process_metrics p
     where p.minute >= v_hours[1]
       and p.minute < v_hours[pg_catalog.cardinality(v_hours)] + interval '1 hour'
       and pg_catalog.date_trunc('hour', p.minute, 'UTC') = any (v_hours)
     group by 1, 2, 3;
  end if;
  v_counts := v_counts || pg_catalog.jsonb_build_object('process_hours_rolled',
                                                        pg_catalog.cardinality(v_hours));

  -- 1.3 probe: all instances together, the durations in the buckets of 0016
  select coalesce(pg_catalog.array_agg(h.hour order by h.hour), '{}') into v_hours
    from (select distinct pg_catalog.date_trunc('hour', r.checked_at, 'UTC') as hour
            from ops.probe_results r
           where r.checked_at < v_closed_until
             and not exists (select 1 from ops.probe_results_hourly x
                              where x.hour = pg_catalog.date_trunc('hour', r.checked_at, 'UTC'))
           order by 1
           limit c_hours + 1) h;
  if pg_catalog.cardinality(v_hours) > c_hours then
    v_more := true;
    v_hours := v_hours[1:c_hours];
  end if;
  if pg_catalog.cardinality(v_hours) > 0 then
    insert into ops.probe_results_hourly (hour, target, checks, failures, duration_buckets)
    select pg_catalog.date_trunc('hour', r.checked_at, 'UTC'), r.target,
           pg_catalog.count(*)::integer,
           (pg_catalog.count(*) filter (where r.outcome = 'down'))::integer,
           array[pg_catalog.count(*) filter (where r.duration_ms <= 25),
                 pg_catalog.count(*) filter (where r.duration_ms > 25 and r.duration_ms <= 50),
                 pg_catalog.count(*) filter (where r.duration_ms > 50 and r.duration_ms <= 100),
                 pg_catalog.count(*) filter (where r.duration_ms > 100 and r.duration_ms <= 250),
                 pg_catalog.count(*) filter (where r.duration_ms > 250 and r.duration_ms <= 500),
                 pg_catalog.count(*) filter (where r.duration_ms > 500 and r.duration_ms <= 1000),
                 pg_catalog.count(*) filter (where r.duration_ms > 1000 and r.duration_ms <= 2500),
                 pg_catalog.count(*) filter (where r.duration_ms > 2500 and r.duration_ms <= 5000),
                 pg_catalog.count(*) filter (where r.duration_ms > 5000)]::integer[]
      from ops.probe_results r
     where r.checked_at >= v_hours[1]
       and r.checked_at < v_hours[pg_catalog.cardinality(v_hours)] + interval '1 hour'
       and pg_catalog.date_trunc('hour', r.checked_at, 'UTC') = any (v_hours)
     group by 1, 2;
  end if;
  v_counts := v_counts || pg_catalog.jsonb_build_object('probe_hours_rolled',
                                                        pg_catalog.cardinality(v_hours));

  -- 2. Purges, 5000 lines per table at most --------------------------------------------------------

  -- 2.1 minutes after 14 days, once their hour is rolled up
  with doomed as (
    select m.minute, m.service, m.instance, m.method, m.route
      from ops.request_metrics m
     where m.minute < v_minutes_before
       and exists (select 1 from ops.request_metrics_hourly x
                    where x.hour = pg_catalog.date_trunc('hour', m.minute, 'UTC'))
     order by m.minute
     limit c_batch)
  delete from ops.request_metrics m
   using doomed d
   where m.minute = d.minute and m.service = d.service and m.instance = d.instance
     and m.method = d.method and m.route = d.route;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('request_metrics_purged', v_n);

  with doomed as (
    select p.minute, p.service, p.instance
      from ops.process_metrics p
     where p.minute < v_minutes_before
       and exists (select 1 from ops.process_metrics_hourly x
                    where x.hour = pg_catalog.date_trunc('hour', p.minute, 'UTC'))
     order by p.minute
     limit c_batch)
  delete from ops.process_metrics p
   using doomed d
   where p.minute = d.minute and p.service = d.service and p.instance = d.instance;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('process_metrics_purged', v_n);

  with doomed as (
    select r.target, r.checked_at, r.instance
      from ops.probe_results r
     where r.checked_at < v_minutes_before
       and exists (select 1 from ops.probe_results_hourly x
                    where x.hour = pg_catalog.date_trunc('hour', r.checked_at, 'UTC'))
     order by r.checked_at
     limit c_batch)
  delete from ops.probe_results r
   using doomed d
   where r.target = d.target and r.checked_at = d.checked_at and r.instance = d.instance;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('probe_results_purged', v_n);

  with doomed as (
    select c.minute, c.service, c.instance, c.signal
      from ops.signal_counts c
     where c.minute < v_minutes_before
     order by c.minute
     limit c_batch)
  delete from ops.signal_counts c
   using doomed d
   where c.minute = d.minute and c.service = d.service and c.instance = d.instance
     and c.signal = d.signal;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('signal_counts_purged', v_n);

  with doomed as (
    select s.minute from ops.database_samples s
     where s.minute < v_minutes_before
     order by s.minute
     limit c_batch)
  delete from ops.database_samples s
   using doomed d
   where s.minute = d.minute;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('database_samples_purged', v_n);

  -- 2.2 occurrences after 30 days (they may carry an account id: retention.purged)
  with doomed as (
    select o.id from ops.error_occurrences o
     where o.occurred_at < v_occurrences_before
     order by o.occurred_at
     limit c_batch)
  delete from ops.error_occurrences o
   using doomed d
   where o.id = d.id;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('error_occurrences_purged', v_n);
  if v_n > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'error_occurrences', 'count', v_n));
  end if;

  -- 2.3 groups fixed or ignored, last seen over 13 months ago, without an occurrence left
  with doomed as (
    select g.id from ops.error_groups g
     where g.status in ('fixed', 'ignored')
       and g.last_seen_at < v_months_before
       and not exists (select 1 from ops.error_occurrences o where o.group_fingerprint = g.fingerprint)
     order by g.last_seen_at
     limit c_batch)
  delete from ops.error_groups g
   using doomed d
   where g.id = d.id;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('error_groups_purged', v_n);

  -- 2.4 the hourly lines after 13 months
  with doomed as (
    select h.hour, h.service, h.method, h.route from ops.request_metrics_hourly h
     where h.hour < v_months_before
     order by h.hour
     limit c_batch)
  delete from ops.request_metrics_hourly h
   using doomed d
   where h.hour = d.hour and h.service = d.service and h.method = d.method and h.route = d.route;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('request_metrics_hourly_purged', v_n);

  with doomed as (
    select h.hour, h.service, h.instance from ops.process_metrics_hourly h
     where h.hour < v_months_before
     order by h.hour
     limit c_batch)
  delete from ops.process_metrics_hourly h
   using doomed d
   where h.hour = d.hour and h.service = d.service and h.instance = d.instance;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('process_metrics_hourly_purged', v_n);

  with doomed as (
    select h.hour, h.target from ops.probe_results_hourly h
     where h.hour < v_months_before
     order by h.hour
     limit c_batch)
  delete from ops.probe_results_hourly h
   using doomed d
   where h.hour = d.hour and h.target = d.target;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('probe_results_hourly_purged', v_n);

  -- 2.5 the processes gone for 7 days, the alerts resolved over 13 months ago
  with doomed as (
    select w.worker_id from ops.worker_heartbeats w
     where w.beat_at < v_beats_before
     order by w.beat_at
     limit c_batch)
  delete from ops.worker_heartbeats w
   using doomed d
   where w.worker_id = d.worker_id;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('worker_heartbeats_purged', v_n);

  with doomed as (
    select s.scope, s.code, s.subject_key from ops.alert_states s
     where s.state = 'resolved' and s.resolved_at < v_months_before
     order by s.resolved_at
     limit c_batch)
  delete from ops.alert_states s
   using doomed d
   where s.scope = d.scope and s.code = d.code and s.subject_key = d.subject_key;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('alert_states_purged', v_n);

  -- 2.6 the address digests of AL59 after 48 hours (pseudonymous: retention.purged)
  with doomed as (
    select t.key_hash, t.hour from identity.code_failure_tallies t
     where t.hour < v_tallies_before
     order by t.hour
     limit c_batch)
  delete from identity.code_failure_tallies t
   using doomed d
   where t.key_hash = d.key_hash and t.hour = d.hour;
  get diagnostics v_n = row_count;
  v_more := v_more or v_n = c_batch;
  v_counts := v_counts || pg_catalog.jsonb_build_object('code_failure_tallies_purged', v_n);
  if v_n > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'code_failure_tallies', 'count', v_n));
  end if;

  return v_counts || pg_catalog.jsonb_build_object('more', case when v_more then 1 else 0 end);
end
$$;

comment on function ops.run_ops_retention(uuid, smallint) is
  'E-4, task ops_retention (daily), 02 §20.5 and §20.8: rolls up by UTC hour the closed hours not rolled '
  'up yet (48 per source at most: request_metrics all instances together, process_metrics per '
  'instance, probe_results with the 9 duration buckets), then purges at most 5000 lines per table: '
  'minutes of request_metrics, process_metrics, probe_results after 14 days once their hour is rolled '
  'up; signal_counts, database_samples after 14 days; error_occurrences after 30 days '
  '(retention.purged {error_occurrences, count}); error_groups fixed or ignored, last seen over 13 '
  'months ago, without occurrence; hourly lines after 13 months; worker_heartbeats 7 days after their '
  'last beat; alert_states resolved over 13 months ago; identity.code_failure_tallies after 48 hours '
  '(retention.purged {code_failure_tallies, count}). Returns the counts, non-negative integers in '
  'snake_case (ready for ops.finish_periodic_run), and more = 1 when a limit was reached: call again, '
  'in a new transaction, until 0. Inside the open ops_retention run of this attempt only (55000 '
  'otherwise). SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

-- 18. The failed codes of an address (AL59), influx_auth (E-2) ----------------------------------

create or replace function identity.record_code_failure(p_key_hash bytea)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_total integer;
begin
  if p_key_hash is null or pg_catalog.octet_length(p_key_hash) <> 32 then
    raise exception 'a 32-byte address digest is required' using errcode = 'invalid_parameter_value';
  end if;
  insert into identity.code_failure_tallies as t (key_hash, hour)
  values (p_key_hash, pg_catalog.date_trunc('hour', pg_catalog.now(), 'UTC'))
  on conflict (key_hash, hour) do update
     set failure_count = least(t.failure_count + 1, 1000000);
  select sum(t.failure_count)::integer into v_total
    from identity.code_failure_tallies t
   where t.key_hash = p_key_hash and t.hour > pg_catalog.now() - interval '25 hours';
  return v_total;
end
$$;

comment on function identity.record_code_failure(bytea) is
  'AL59 (J3S-8): counts one failed member code for an address DIGEST (emailThrottleKey, HMAC-SHA-256 '
  'with AUTH_THROTTLE_PEPPER: never the address) in its UTC hour, and returns the failures of the '
  'buckets of the last 24 hours. Called by apps/api in transaction B of a wrong code (verify-code.ts, '
  'E-2, no audit line). Never blocks anything (03 A-4). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_auth ONLY.';

-- 19. Publication -----------------------------------------------------------------------------------

revoke all on function ops.iso_utc(timestamptz) from public, anon, authenticated, service_role;
revoke all on function ops.threshold_int(jsonb, text, integer, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function ops.record_worker_heartbeat(text, text, text, timestamptz, boolean)
  from public, anon, authenticated, service_role;
revoke all on function ops.record_probe_results(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function ops.record_database_sample() from public, anon, authenticated, service_role;
revoke all on function ops.begin_alert_round(text) from public, anon, authenticated, service_role;
revoke all on function ops.save_alert_states(text, jsonb) from public, anon, authenticated, service_role;
revoke all on function ops.worker_liveness() from public, anon, authenticated, service_role;
revoke all on function ops.technical_alert_snapshot(timestamptz) from public, anon, authenticated, service_role;
revoke all on function ops.admin_alert_recipients() from public, anon, authenticated, service_role;
revoke all on function ops.run_ops_retention(uuid, smallint) from public, anon, authenticated, service_role;
revoke all on function identity.record_code_failure(bytea) from public, anon, authenticated, service_role;

grant execute on function ops.record_worker_heartbeat(text, text, text, timestamptz, boolean) to influx_worker;
grant execute on function ops.record_probe_results(text, jsonb) to influx_worker;
grant execute on function ops.record_database_sample() to influx_worker;
grant execute on function ops.begin_alert_round(text) to influx_worker, influx_ops;
grant execute on function ops.save_alert_states(text, jsonb) to influx_worker, influx_ops;
grant execute on function ops.worker_liveness() to influx_ops;
grant execute on function ops.technical_alert_snapshot(timestamptz) to influx_worker;
grant execute on function ops.admin_alert_recipients() to influx_worker;
grant execute on function ops.run_ops_retention(uuid, smallint) to influx_worker;
grant execute on function identity.record_code_failure(bytea) to influx_auth;

-- influx_ops (E-6): the signals, like the request metrics of 0016 -- INSERT only, for a minute that
-- has ended within the last hour, never read back.
grant insert on ops.signal_counts to influx_ops;

drop policy if exists signal_counts_ops_insert on ops.signal_counts;
create policy signal_counts_ops_insert on ops.signal_counts
  for insert to influx_ops
  with check (minute + interval '1 minute' <= now() and minute >= now() - interval '1 hour');

-- 20. Rights of the owners: what the functions read and write, nothing more -----------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner. A
-- delete policy restates the retention: the owner can never delete a line before its time.

grant usage on schema backoffice to influx_maintenance_definer;

-- 20.1 ops.worker_heartbeats
grant select (worker_id, instance, version, started_at, beat_at, loop_turn_at),
      insert (worker_id, instance, version, started_at),
      update (beat_at, loop_turn_at),
      delete
   on ops.worker_heartbeats to influx_maintenance_definer;

drop policy if exists worker_heartbeats_maintenance_definer_select on ops.worker_heartbeats;
create policy worker_heartbeats_maintenance_definer_select on ops.worker_heartbeats
  for select to influx_maintenance_definer using (true);
drop policy if exists worker_heartbeats_maintenance_definer_insert on ops.worker_heartbeats;
create policy worker_heartbeats_maintenance_definer_insert on ops.worker_heartbeats
  for insert to influx_maintenance_definer
  with check (beat_at = now() and loop_turn_at = now());
drop policy if exists worker_heartbeats_maintenance_definer_update on ops.worker_heartbeats;
create policy worker_heartbeats_maintenance_definer_update on ops.worker_heartbeats
  for update to influx_maintenance_definer
  using (true) with check (beat_at = now());
drop policy if exists worker_heartbeats_maintenance_definer_delete on ops.worker_heartbeats;
create policy worker_heartbeats_maintenance_definer_delete on ops.worker_heartbeats
  for delete to influx_maintenance_definer
  using (beat_at < now() - interval '168 hours');

-- 20.2 ops.probe_results
grant select (checked_at, instance, target, outcome, duration_ms),
      insert (checked_at, instance, target, outcome, status_code, failure_code, duration_ms),
      delete
   on ops.probe_results to influx_maintenance_definer;

drop policy if exists probe_results_maintenance_definer_select on ops.probe_results;
create policy probe_results_maintenance_definer_select on ops.probe_results
  for select to influx_maintenance_definer using (true);
drop policy if exists probe_results_maintenance_definer_insert on ops.probe_results;
create policy probe_results_maintenance_definer_insert on ops.probe_results
  for insert to influx_maintenance_definer
  with check (checked_at >= now() - interval '1 hour' and checked_at <= now() + interval '1 minute');
drop policy if exists probe_results_maintenance_definer_delete on ops.probe_results;
create policy probe_results_maintenance_definer_delete on ops.probe_results
  for delete to influx_maintenance_definer
  using (checked_at < now() - interval '336 hours');

-- 20.3 ops.database_samples
grant select (minute, connections, max_connections),
      insert (minute, connections, max_connections),
      delete
   on ops.database_samples to influx_maintenance_definer;

drop policy if exists database_samples_maintenance_definer_select on ops.database_samples;
create policy database_samples_maintenance_definer_select on ops.database_samples
  for select to influx_maintenance_definer using (true);
drop policy if exists database_samples_maintenance_definer_insert on ops.database_samples;
create policy database_samples_maintenance_definer_insert on ops.database_samples
  for insert to influx_maintenance_definer
  with check (minute = date_trunc('minute', now(), 'UTC'));
drop policy if exists database_samples_maintenance_definer_delete on ops.database_samples;
create policy database_samples_maintenance_definer_delete on ops.database_samples
  for delete to influx_maintenance_definer
  using (minute < now() - interval '336 hours');

-- 20.4 ops.signal_counts: read by the snapshot, purged
grant select (minute, service, instance, signal, count), delete
   on ops.signal_counts to influx_maintenance_definer;

drop policy if exists signal_counts_maintenance_definer_select on ops.signal_counts;
create policy signal_counts_maintenance_definer_select on ops.signal_counts
  for select to influx_maintenance_definer using (true);
drop policy if exists signal_counts_maintenance_definer_delete on ops.signal_counts;
create policy signal_counts_maintenance_definer_delete on ops.signal_counts
  for delete to influx_maintenance_definer
  using (minute < now() - interval '336 hours');

-- 20.5 ops.alert_states
grant select (scope, code, subject_key, state, opened_at, last_notified_at, notified_count,
              resolved_at, last_value),
      insert (scope, code, subject_key, state, opened_at, last_notified_at, notified_count,
              resolved_at, last_value),
      update (state, opened_at, last_notified_at, notified_count, resolved_at, last_value),
      delete
   on ops.alert_states to influx_maintenance_definer;

drop policy if exists alert_states_maintenance_definer_select on ops.alert_states;
create policy alert_states_maintenance_definer_select on ops.alert_states
  for select to influx_maintenance_definer using (true);
drop policy if exists alert_states_maintenance_definer_insert on ops.alert_states;
create policy alert_states_maintenance_definer_insert on ops.alert_states
  for insert to influx_maintenance_definer with check (true);
drop policy if exists alert_states_maintenance_definer_update on ops.alert_states;
create policy alert_states_maintenance_definer_update on ops.alert_states
  for update to influx_maintenance_definer using (true) with check (true);
drop policy if exists alert_states_maintenance_definer_delete on ops.alert_states;
create policy alert_states_maintenance_definer_delete on ops.alert_states
  for delete to influx_maintenance_definer
  using (state = 'resolved'
         and resolved_at < ((now() at time zone 'UTC') - interval '13 months') at time zone 'UTC');

-- 20.6 the hourly tables
grant select (hour, service, method, route, request_count),
      insert (hour, service, method, route, request_count, server_error_count, throttled_count,
              duration_buckets),
      delete
   on ops.request_metrics_hourly to influx_maintenance_definer;
grant select (hour, service, instance),
      insert (hour, service, instance, minutes, event_loop_delay_p99_avg_ms, event_loop_delay_max_ms,
              rss_avg_bytes, rss_max_bytes, heap_used_avg_bytes, cpu_avg_percent, cpu_max_percent),
      delete
   on ops.process_metrics_hourly to influx_maintenance_definer;
grant select (hour, target),
      insert (hour, target, checks, failures, duration_buckets),
      delete
   on ops.probe_results_hourly to influx_maintenance_definer;

drop policy if exists request_metrics_hourly_maintenance_definer_select on ops.request_metrics_hourly;
create policy request_metrics_hourly_maintenance_definer_select on ops.request_metrics_hourly
  for select to influx_maintenance_definer using (true);
drop policy if exists request_metrics_hourly_maintenance_definer_insert on ops.request_metrics_hourly;
create policy request_metrics_hourly_maintenance_definer_insert on ops.request_metrics_hourly
  for insert to influx_maintenance_definer
  with check (hour + interval '2 hours' <= now());
drop policy if exists request_metrics_hourly_maintenance_definer_delete on ops.request_metrics_hourly;
create policy request_metrics_hourly_maintenance_definer_delete on ops.request_metrics_hourly
  for delete to influx_maintenance_definer
  using (hour < ((now() at time zone 'UTC') - interval '13 months') at time zone 'UTC');

drop policy if exists process_metrics_hourly_maintenance_definer_select on ops.process_metrics_hourly;
create policy process_metrics_hourly_maintenance_definer_select on ops.process_metrics_hourly
  for select to influx_maintenance_definer using (true);
drop policy if exists process_metrics_hourly_maintenance_definer_insert on ops.process_metrics_hourly;
create policy process_metrics_hourly_maintenance_definer_insert on ops.process_metrics_hourly
  for insert to influx_maintenance_definer
  with check (hour + interval '2 hours' <= now());
drop policy if exists process_metrics_hourly_maintenance_definer_delete on ops.process_metrics_hourly;
create policy process_metrics_hourly_maintenance_definer_delete on ops.process_metrics_hourly
  for delete to influx_maintenance_definer
  using (hour < ((now() at time zone 'UTC') - interval '13 months') at time zone 'UTC');

drop policy if exists probe_results_hourly_maintenance_definer_select on ops.probe_results_hourly;
create policy probe_results_hourly_maintenance_definer_select on ops.probe_results_hourly
  for select to influx_maintenance_definer using (true);
drop policy if exists probe_results_hourly_maintenance_definer_insert on ops.probe_results_hourly;
create policy probe_results_hourly_maintenance_definer_insert on ops.probe_results_hourly
  for insert to influx_maintenance_definer
  with check (hour + interval '2 hours' <= now());
drop policy if exists probe_results_hourly_maintenance_definer_delete on ops.probe_results_hourly;
create policy probe_results_hourly_maintenance_definer_delete on ops.probe_results_hourly
  for delete to influx_maintenance_definer
  using (hour < ((now() at time zone 'UTC') - interval '13 months') at time zone 'UTC');

-- 20.7 the minute tables of 0016: read for the snapshot and the roll-up, purged after 14 days
grant select (minute, service, instance, method, route, request_count, server_error_count,
              throttled_count, duration_buckets),
      delete
   on ops.request_metrics to influx_maintenance_definer;
grant select (minute, service, instance, event_loop_delay_p99_ms, event_loop_delay_max_ms,
              rss_bytes, heap_used_bytes, cpu_percent),
      delete
   on ops.process_metrics to influx_maintenance_definer;

drop policy if exists request_metrics_maintenance_definer_select on ops.request_metrics;
create policy request_metrics_maintenance_definer_select on ops.request_metrics
  for select to influx_maintenance_definer using (true);
drop policy if exists request_metrics_maintenance_definer_delete on ops.request_metrics;
create policy request_metrics_maintenance_definer_delete on ops.request_metrics
  for delete to influx_maintenance_definer
  using (minute < now() - interval '336 hours');

drop policy if exists process_metrics_maintenance_definer_select on ops.process_metrics;
create policy process_metrics_maintenance_definer_select on ops.process_metrics
  for select to influx_maintenance_definer using (true);
drop policy if exists process_metrics_maintenance_definer_delete on ops.process_metrics;
create policy process_metrics_maintenance_definer_delete on ops.process_metrics
  for delete to influx_maintenance_definer
  using (minute < now() - interval '336 hours');

-- 20.8 the error groups and occurrences of 0016: AL51 and the purges (never the message, the stack,
-- the request nor the account of an occurrence)
grant select (id, fingerprint, source, error_type, route, status, first_seen_at, last_seen_at,
              last_regressed_at),
      delete
   on ops.error_groups to influx_maintenance_definer;
grant select (id, group_fingerprint, occurred_at), delete
   on ops.error_occurrences to influx_maintenance_definer;

drop policy if exists error_groups_maintenance_definer_select on ops.error_groups;
create policy error_groups_maintenance_definer_select on ops.error_groups
  for select to influx_maintenance_definer using (true);
drop policy if exists error_groups_maintenance_definer_delete on ops.error_groups;
create policy error_groups_maintenance_definer_delete on ops.error_groups
  for delete to influx_maintenance_definer
  using (status in ('fixed', 'ignored')
         and last_seen_at < ((now() at time zone 'UTC') - interval '13 months') at time zone 'UTC');

drop policy if exists error_occurrences_maintenance_definer_select on ops.error_occurrences;
create policy error_occurrences_maintenance_definer_select on ops.error_occurrences
  for select to influx_maintenance_definer using (true);
drop policy if exists error_occurrences_maintenance_definer_delete on ops.error_occurrences;
create policy error_occurrences_maintenance_definer_delete on ops.error_occurrences
  for delete to influx_maintenance_definer
  using (occurred_at < now() - interval '720 hours');

-- 20.9 ops.periodic_runs (AL60): the counts of the runs (policy periodic_runs_maintenance_definer_select
-- of 0117 already covers the owner)
grant select (counts) on ops.periodic_runs to influx_maintenance_definer;

-- 20.10 the catalogue of alerts
grant select (code, nature, threshold_value, recipient_roles, is_active)
   on backoffice.alert_definitions to influx_maintenance_definer;

drop policy if exists alert_definitions_maintenance_definer_select on backoffice.alert_definitions;
create policy alert_definitions_maintenance_definer_select on backoffice.alert_definitions
  for select to influx_maintenance_definer using (true);

-- 20.11 identity: the admin recipients (accounts already readable by 0117 and 0125: id, email,
-- status), the member role and the member sessions of AL48, the digests of AL59
grant select (account_id, role) on identity.account_roles to influx_maintenance_definer;
grant select (account_id, is_active, is_break_glass) on identity.agent_profiles to influx_maintenance_definer;
grant select (account_id, surface, created_at) on identity.sessions to influx_maintenance_definer;
grant select (key_hash, hour, failure_count), delete
   on identity.code_failure_tallies to influx_maintenance_definer;

drop policy if exists account_roles_maintenance_definer_select on identity.account_roles;
create policy account_roles_maintenance_definer_select on identity.account_roles
  for select to influx_maintenance_definer using (true);
drop policy if exists agent_profiles_maintenance_definer_select on identity.agent_profiles;
create policy agent_profiles_maintenance_definer_select on identity.agent_profiles
  for select to influx_maintenance_definer using (true);
drop policy if exists sessions_maintenance_definer_select on identity.sessions;
create policy sessions_maintenance_definer_select on identity.sessions
  for select to influx_maintenance_definer using (surface = 'member');
drop policy if exists code_failure_tallies_maintenance_definer_select on identity.code_failure_tallies;
create policy code_failure_tallies_maintenance_definer_select on identity.code_failure_tallies
  for select to influx_maintenance_definer using (true);
drop policy if exists code_failure_tallies_maintenance_definer_delete on identity.code_failure_tallies;
create policy code_failure_tallies_maintenance_definer_delete on identity.code_failure_tallies
  for delete to influx_maintenance_definer
  using (hour < now() - interval '48 hours');

-- 20.12 leads.transactional_sends (AL48): the login codes only, never the recipient nor the provider id
grant select (email_code, priority, account_id, status, created_at, delivered_at)
   on leads.transactional_sends to influx_maintenance_definer;

drop policy if exists transactional_sends_maintenance_definer_select on leads.transactional_sends;
create policy transactional_sends_maintenance_definer_select on leads.transactional_sends
  for select to influx_maintenance_definer
  using (priority = 'p0' and email_code = 'auth.login_code');

-- 20.13 privacy.request_executions (AL63): the executed requests left open, never the held address
grant select (request_id, executed_at, completed_at)
   on privacy.request_executions to influx_maintenance_definer;

drop policy if exists request_executions_maintenance_definer_select on privacy.request_executions;
create policy request_executions_maintenance_definer_select on privacy.request_executions
  for select to influx_maintenance_definer
  using (executed_at is not null and completed_at is null);

-- 20.14 influx_identity_definer: the tallies it writes
grant select (key_hash, hour, failure_count),
      insert (key_hash, hour),
      update (failure_count)
   on identity.code_failure_tallies to influx_identity_definer;

drop policy if exists code_failure_tallies_identity_definer_select on identity.code_failure_tallies;
create policy code_failure_tallies_identity_definer_select on identity.code_failure_tallies
  for select to influx_identity_definer using (true);
drop policy if exists code_failure_tallies_identity_definer_insert on identity.code_failure_tallies;
create policy code_failure_tallies_identity_definer_insert on identity.code_failure_tallies
  for insert to influx_identity_definer
  with check (hour = date_trunc('hour', now(), 'UTC') and failure_count = 1);
drop policy if exists code_failure_tallies_identity_definer_update on identity.code_failure_tallies;
create policy code_failure_tallies_identity_definer_update on identity.code_failure_tallies
  for update to influx_identity_definer
  using (hour = date_trunc('hour', now(), 'UTC'))
  with check (hour = date_trunc('hour', now(), 'UTC'));

-- 21. Hand the functions to their owners (03 P7 rule 5, window of 0004 §9) -----------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;
grant create on schema identity to influx_identity_definer;

alter function ops.iso_utc(timestamptz) owner to influx_maintenance_definer;
alter function ops.threshold_int(jsonb, text, integer, integer, integer) owner to influx_maintenance_definer;
alter function ops.record_worker_heartbeat(text, text, text, timestamptz, boolean)
  owner to influx_maintenance_definer;
alter function ops.record_probe_results(text, jsonb) owner to influx_maintenance_definer;
alter function ops.record_database_sample() owner to influx_maintenance_definer;
alter function ops.begin_alert_round(text) owner to influx_maintenance_definer;
alter function ops.save_alert_states(text, jsonb) owner to influx_maintenance_definer;
alter function ops.worker_liveness() owner to influx_maintenance_definer;
alter function ops.technical_alert_snapshot(timestamptz) owner to influx_maintenance_definer;
alter function ops.admin_alert_recipients() owner to influx_maintenance_definer;
alter function ops.run_ops_retention(uuid, smallint) owner to influx_maintenance_definer;
alter function identity.record_code_failure(bytea) owner to influx_identity_definer;

revoke create on schema ops from influx_maintenance_definer;
revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 22. End-state assertions -----------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  -- the functions: owner, SECURITY DEFINER or INVOKER, empty search_path, and their callers only
  for v_def in
    select * from (values
      ('ops.iso_utc(timestamptz)', 'influx_maintenance_definer', false, array[]::text[]),
      ('ops.threshold_int(jsonb, text, integer, integer, integer)', 'influx_maintenance_definer', false,
       array[]::text[]),
      ('ops.record_worker_heartbeat(text, text, text, timestamptz, boolean)', 'influx_maintenance_definer',
       true, array['influx_worker']),
      ('ops.record_probe_results(text, jsonb)', 'influx_maintenance_definer', true, array['influx_worker']),
      ('ops.record_database_sample()', 'influx_maintenance_definer', true, array['influx_worker']),
      ('ops.begin_alert_round(text)', 'influx_maintenance_definer', true,
       array['influx_worker', 'influx_ops']),
      ('ops.save_alert_states(text, jsonb)', 'influx_maintenance_definer', true,
       array['influx_worker', 'influx_ops']),
      ('ops.worker_liveness()', 'influx_maintenance_definer', true, array['influx_ops']),
      ('ops.technical_alert_snapshot(timestamptz)', 'influx_maintenance_definer', true,
       array['influx_worker']),
      ('ops.admin_alert_recipients()', 'influx_maintenance_definer', true, array['influx_worker']),
      ('ops.run_ops_retention(uuid, smallint)', 'influx_maintenance_definer', true, array['influx_worker']),
      ('identity.record_code_failure(bytea)', 'influx_identity_definer', true, array['influx_auth'])
    ) as t (fn, owner, definer, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> v_def.owner
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure) <> v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by % (SECURITY DEFINER: %), empty search_path',
        v_def.fn, v_def.owner, v_def.definer;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- no execution role holds a table right on the new tables, but influx_ops' INSERT on the signals
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['ops.worker_heartbeats', 'ops.probe_results', 'ops.database_samples',
                      'ops.signal_counts', 'ops.alert_states', 'ops.request_metrics_hourly',
                      'ops.process_metrics_hourly', 'ops.probe_results_hourly',
                      'identity.code_failure_tallies']) t
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_maintenance_definer', 'influx_identity_definer')
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'SELECT, UPDATE, REFERENCES')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE, TRUNCATE')
          or (pg_catalog.has_any_column_privilege(r.oid, t, 'INSERT')
              and not (r.rolname = 'influx_ops' and t = 'ops.signal_counts')));
  if v_bad is not null then
    raise exception 'unexpected table right(s): %', v_bad;
  end if;
  if pg_catalog.has_table_privilege('influx_identity_definer', 'identity.code_failure_tallies', 'DELETE')
     or pg_catalog.has_any_column_privilege('influx_identity_definer', 'ops.alert_states', 'SELECT') then
    raise exception 'influx_identity_definer reaches beyond the tallies it writes';
  end if;

  -- E-6 stays without a business read
  select string_agg(n.nspname, ', ') into v_bad
    from pg_catalog.pg_namespace n
   where n.nspname in ('identity', 'audit', 'billing', 'backoffice', 'leads', 'reference',
                       'influx', 'profiles', 'verification', 'campaigns', 'search', 'matching',
                       'messaging', 'auth_hooks', 'privacy')
     and pg_catalog.has_schema_privilege('influx_ops', n.oid, 'USAGE');
  if v_bad is not null then
    raise exception 'influx_ops reaches business schema(s): %', v_bad;
  end if;

  -- the owner of the E-4 functions reads no secret of the tables it now reaches
  if pg_catalog.has_column_privilege('influx_maintenance_definer', 'identity.sessions', 'token_hash', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'leads.transactional_sends',
                                        'recipient_email', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'privacy.request_executions',
                                        'propagation_email', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'ops.error_occurrences',
                                        'account_id', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'ops.error_occurrences',
                                        'stack', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'ops.error_groups',
                                        'message', 'SELECT') then
    raise exception 'influx_maintenance_definer may read a secret, an address or a message';
  end if;

  -- the catalogue: AL48 to AL63, AL50 on call alone
  if (select count(*) from backoffice.alert_definitions
       where code in ('AL48', 'AL49', 'AL50', 'AL51', 'AL52', 'AL53', 'AL54', 'AL55', 'AL56', 'AL57',
                      'AL58', 'AL59', 'AL60', 'AL61', 'AL62', 'AL63')) <> 16 then
    raise exception 'backoffice.alert_definitions does not hold AL48 to AL63';
  end if;
  if (select recipient_roles from backoffice.alert_definitions where code = 'AL50')
       is distinct from array['on_call']::text[] then
    raise exception 'AL50 must go to on_call alone';
  end if;

  -- the two owners: no usable member left, no CREATE left
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_maintenance_definer', 'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if exists (select 1 from pg_catalog.pg_auth_members m
               join pg_catalog.pg_roles r on r.oid = m.member
              where r.rolname in ('influx_maintenance_definer', 'influx_identity_definer')) then
    raise exception 'a function owner is a member of another role';
  end if;
  if pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'a function owner left with CREATE on its schema';
  end if;
end
$$;
