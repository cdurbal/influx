-- =============================================================================
-- 0117_ops_periodic_runs
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 2. Decision 3 of the J7 start (architect, 2026-10-09): E-4
-- `maintenance.run_periodic` (03 P7) runs in the loop of the worker, guarded by ONE
-- line per (task, period); 05 RG91, 16 RG113, RG150, 04 §9.
--
--   ops.periodic_runs                 one line per (task_code, period_key): who runs
--                                     it, since when, how it ended, and its counts
--                                     (the gap of the reconciliation, the number
--                                     purged). A run not finished after one hour is
--                                     taken back (attempt + 1, fencing token).
--   ops.claim_periodic_run()          claims the CURRENT period of a task: a new run
--                                     (attempt 1), a stale one taken back, or nothing.
--   ops.finish_periodic_run()         closes the run of THIS attempt (outcome, counts).
--   ops.filter_auth_orphans()         04 §9 (D43): which GoTrue user ids have no line
--                                     identity.accounts.auth_user_id. Matching on
--                                     auth_user_id only, NEVER on an address; called
--                                     again for each user before admin.deleteUser.
--   ops.record_retention_purge()      the register line retention.purged of the purge
--                                     GoTrue does for us (category auth_orphan_users,
--                                     count), on the run.
--   ops.purge_brevo_inbound_events()  decision 2: raw Brevo lines 30 days after their
--                                     outcome, never one without; its own
--                                     retention.purged line.
--
-- Owner: a DEDICATED role, influx_maintenance_definer, created here by the rules of
-- 0001 (no login, no inheritance, member of nothing, no member). E-4 needs DELETE
-- rights across domains and the register (retention.purged); neither the identity
-- owner nor the leads owner should hold them, nor lend theirs to the maintenance.
--
-- influx_worker receives USAGE on ops and EXECUTE on the five functions; no table right
-- (03 P7: E-4 goes through functions). The 0016 statement "influx_ops is the only role
-- of ours with USAGE on ops" no longer holds: ops now also carries the E-4 bookkeeping.
--
-- Periods (UTC): brevo_reconciliation and brevo_inbound_purge are daily ('YYYY-MM-DD');
-- auth_orphan_purge is hourly ('YYYY-MM-DDTHH'). Only the CURRENT period can be claimed.
-- The 03:00 UTC start of the reconciliation is the scheduler's (commit 5).
--
-- ROLLBACK (before any real run): drop the five functions; revoke usage on schema ops
-- from influx_worker; drop table ops.periodic_runs; drop function
-- ops.guard_periodic_run_update(); drop type ops.periodic_run_outcome, ops.periodic_task;
-- revoke the grants of influx_maintenance_definer listed in §5, EXECUTE on
-- audit.append() through the window of 0006 §9, drop its policies; then, in every
-- database of the cluster, drop owned by influx_maintenance_definer; drop role
-- influx_maintenance_definer.
-- =============================================================================

-- 1. The owner of the E-4 functions (03 P7 rule 5; rules 1 and 2 of 0001) ----------------------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_maintenance_definer') then
    create role influx_maintenance_definer with nologin noinherit;
  end if;
  alter role influx_maintenance_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_maintenance_definer' and rolsuper) then
    raise exception 'role influx_maintenance_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_maintenance_definer' and rolbypassrls) then
    alter role influx_maintenance_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_maintenance_definer' and rolreplication) then
    alter role influx_maintenance_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_maintenance_definer' and rolcreatedb) then
    alter role influx_maintenance_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_maintenance_definer' and rolcreaterole) then
    alter role influx_maintenance_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. Types --------------------------------------------------------------------------------------

do $$
begin
  create type ops.periodic_task as enum ('brevo_reconciliation', 'auth_orphan_purge', 'brevo_inbound_purge');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type ops.periodic_run_outcome as enum ('succeeded', 'failed');
exception when duplicate_object then null;
end
$$;

comment on type ops.periodic_task is
  'Closed list of the E-4 tasks (decision 3 of J7): brevo_reconciliation (daily, after 03:00 UTC, '
  '05 RG91, 16 RG113), auth_orphan_purge (hourly, 04 §9), brevo_inbound_purge (daily, decision 2). '
  'A new task is a new value, added with its first caller.';
comment on type ops.periodic_run_outcome is
  'succeeded or failed (the cause goes to pino as a code, D60); NULL while the run is open.';

-- 3. ops.periodic_runs -----------------------------------------------------------------------------

create table if not exists ops.periodic_runs (
  id           uuid        not null default gen_random_uuid() primary key,
  task_code    ops.periodic_task not null,
  period_key   text        not null,
  attempt      smallint    not null default 1,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  outcome      ops.periodic_run_outcome,
  counts       jsonb       not null default '{}'::jsonb,

  constraint periodic_runs_task_period_key unique (task_code, period_key),
  constraint periodic_runs_period_format check (
    (task_code = 'auth_orphan_purge' and period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$')
    or (task_code <> 'auth_orphan_purge' and period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')),
  constraint periodic_runs_attempt_range check (attempt between 1 and 100),
  constraint periodic_runs_finish_pair check ((finished_at is null) = (outcome is null)),
  constraint periodic_runs_chronology check (finished_at is null or finished_at >= started_at),
  constraint periodic_runs_counts_shape check (
    jsonb_typeof(counts) = 'object'
    and pg_column_size(counts) <= 2000
    and not jsonb_path_exists(counts,
          '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]{0,62}$")
                           || @.value.type() != "number" || @.value < 0
                           || @.value.floor() != @.value)'))
);

comment on table ops.periodic_runs is
  'One line per (E-4 task, period) (decision 3 of J7): the guard that makes a periodic task run once '
  'per period whatever the number of worker instances, and the record of how it ended. Written by '
  'ops.claim_periodic_run() and ops.finish_periodic_run() only. No personal data: codes and counts.';
comment on column ops.periodic_runs.period_key is
  'UTC period of the run: YYYY-MM-DD for a daily task, YYYY-MM-DDTHH for an hourly one. Only the '
  'current period can be claimed.';
comment on column ops.periodic_runs.attempt is
  'Fencing token: 1 at the claim, + 1 at each take-back of a run left unfinished for one hour. The '
  'purges and the finish of a run require the attempt that holds it: a worker whose run was taken '
  'back writes nothing more.';
comment on column ops.periodic_runs.started_at is
  'Claim, or last take-back (the transaction time, never supplied).';
comment on column ops.periodic_runs.counts is
  'Counts of the run, non-negative integers keyed by snake_case names (the gap of the '
  'reconciliation, the lines purged, the users deleted). Never an identifier of a person.';

create or replace function ops.guard_periodic_run_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.task_code  is distinct from old.task_code
     or new.period_key is distinct from old.period_key then
    raise exception 'the identity of a periodic run never changes' using errcode = 'insufficient_privilege';
  end if;
  if old.finished_at is not null then
    raise exception 'a finished periodic run is frozen' using errcode = 'insufficient_privilege';
  end if;
  if new.attempt < old.attempt or new.attempt > old.attempt + 1 then
    raise exception 'the attempt of a run only moves forward by one' using errcode = 'insufficient_privilege';
  end if;
  if new.attempt = old.attempt + 1 then
    new.started_at := pg_catalog.now();
  elsif new.started_at is distinct from old.started_at then
    raise exception 'started_at moves with a take-back only' using errcode = 'insufficient_privilege';
  end if;
  if new.finished_at is not null then
    new.finished_at := pg_catalog.now();
  end if;
  return new;
end
$$;

comment on function ops.guard_periodic_run_update() is
  'BEFORE UPDATE on ops.periodic_runs: task and period immutable; a finished run is frozen; attempt '
  'moves forward by one at a take-back, with started_at = now(); finished_at is now(). SECURITY '
  'INVOKER, reads nothing.';

revoke all on function ops.guard_periodic_run_update() from public;

drop trigger if exists periodic_runs_guard on ops.periodic_runs;
create trigger periodic_runs_guard
  before update on ops.periodic_runs
  for each row execute function ops.guard_periodic_run_update();

drop trigger if exists periodic_runs_no_delete on ops.periodic_runs;
create trigger periodic_runs_no_delete
  before delete on ops.periodic_runs
  for each row execute function influx.assert_append_only();

drop trigger if exists periodic_runs_no_truncate on ops.periodic_runs;
create trigger periodic_runs_no_truncate
  before truncate on ops.periodic_runs
  for each statement execute function influx.assert_append_only();

alter table ops.periodic_runs enable row level security;
alter table ops.periodic_runs force  row level security;
revoke all on ops.periodic_runs from public, anon, authenticated, service_role;

-- 4. The functions ---------------------------------------------------------------------------------

-- 4.1 The claim -------------------------------------------------------------------------------------

create or replace function ops.claim_periodic_run(
  p_task        ops.periodic_task,
  p_period_key  text
)
returns table (
  run_id   uuid,
  attempt  smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_current  text;
  v_id       uuid;
  v_run      record;
begin
  if p_task is null then
    raise exception 'a task is required' using errcode = 'invalid_parameter_value';
  end if;
  v_current := pg_catalog.to_char(pg_catalog.now() at time zone 'UTC',
                                  case when p_task = 'auth_orphan_purge'
                                       then 'YYYY-MM-DD"T"HH24' else 'YYYY-MM-DD' end);
  -- Only the current period: no scheduling error replays a past one nor reserves a future one.
  if p_period_key is distinct from v_current then
    raise exception 'only the current period (%) can be claimed', v_current
      using errcode = 'invalid_parameter_value';
  end if;

  insert into ops.periodic_runs (task_code, period_key)
  values (p_task, p_period_key)
  on conflict (task_code, period_key) do nothing
  returning id into v_id;
  if v_id is not null then
    return query select v_id, 1::smallint;
    return;
  end if;

  -- The period exists: finished, running elsewhere, or left unfinished for an hour.
  select r.id, r.attempt, r.started_at, r.finished_at
    into v_run
    from ops.periodic_runs r
   where r.task_code = p_task and r.period_key = p_period_key
     for update;
  -- FOR UPDATE reads through the UPDATE policy (finished_at is null): a finished run is not
  -- found here. Nothing to take back, never a row of NULLs.
  if not found then
    return;
  end if;
  if v_run.finished_at is not null
     or v_run.started_at > pg_catalog.now() - interval '1 hour'
     or v_run.attempt >= 100 then
    return;
  end if;
  update ops.periodic_runs r
     set attempt = r.attempt + 1,
         counts  = '{}'::jsonb
   where r.id = v_run.id;
  return query select v_run.id, (v_run.attempt + 1)::smallint;
end
$$;

comment on function ops.claim_periodic_run(ops.periodic_task, text) is
  'E-4 claim (decision 3 of J7): for the CURRENT UTC period of the task only (22023 otherwise), '
  'creates the run (attempt 1), or takes back a run left unfinished for one hour (attempt + 1, '
  'started_at = now(), counts reset). No row: the period is finished or running elsewhere. Returns '
  '(run id, attempt): the run id is the subject of elevated.maintenance.run_periodic, the attempt '
  'the fencing token of the other functions. SECURITY DEFINER owned by influx_maintenance_definer, '
  'empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.2 The finish ------------------------------------------------------------------------------------

create or replace function ops.finish_periodic_run(
  p_run_id   uuid,
  p_attempt  smallint,
  p_outcome  ops.periodic_run_outcome,
  p_counts   jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_run_id is null or p_attempt is null or p_outcome is null then
    raise exception 'run, attempt and outcome are required' using errcode = 'invalid_parameter_value';
  end if;
  if p_counts is null or pg_catalog.jsonb_typeof(p_counts) <> 'object'
     or pg_catalog.pg_column_size(p_counts) > 2000
     or pg_catalog.jsonb_path_exists(p_counts,
          '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]{0,62}$")
                           || @.value.type() != "number" || @.value < 0
                           || @.value.floor() != @.value)') then
    raise exception 'counts are non-negative integers keyed by snake_case names'
      using errcode = 'invalid_parameter_value';
  end if;
  update ops.periodic_runs r
     set finished_at = pg_catalog.now(),
         outcome     = p_outcome,
         counts      = p_counts
   where r.id = p_run_id
     and r.attempt = p_attempt
     and r.finished_at is null;
  return found;
end
$$;

comment on function ops.finish_periodic_run(uuid, smallint, ops.periodic_run_outcome, jsonb) is
  'E-4 finish (decision 3 of J7): closes the open run held by THIS attempt with its outcome and its '
  'counts (22023 for a malformed one). Returns false when the run is finished or was taken back '
  '(another attempt holds it): nothing written. SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.3 The orphans of GoTrue (04 §9) ----------------------------------------------------------------

create or replace function ops.filter_auth_orphans(
  p_run_id         uuid,
  p_attempt        smallint,
  p_auth_user_ids  uuid[]
)
returns table (auth_user_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_auth_user_ids is null or pg_catalog.cardinality(p_auth_user_ids) > 1000
     or pg_catalog.array_position(p_auth_user_ids, null) is not null then
    raise exception 'between 0 and 1000 ids, none NULL' using errcode = 'invalid_parameter_value';
  end if;
  -- Only inside the open run of the purge, held by this attempt.
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'auth_orphan_purge') then
    raise exception 'no open auth_orphan_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- 04 §9: the match is on auth_user_id, NEVER on an address; a deleted account keeps its
  -- line, hence its GoTrue user.
  return query
  select distinct u.id
    from pg_catalog.unnest(p_auth_user_ids) as u (id)
   where not exists (select 1 from identity.accounts a where a.auth_user_id = u.id)
   order by u.id;
end
$$;

comment on function ops.filter_auth_orphans(uuid, smallint, uuid[]) is
  'E-4, purge of the GoTrue users without an account (04 §9, D43): returns those of the given ids '
  '(at most 1000) that no identity.accounts.auth_user_id references. Matching on auth_user_id only, '
  'never on an address. Called once per page of admin.listUsers, then again with the single id '
  'before each admin.deleteUser (decision 3). Inside the open auth_orphan_purge run of this attempt '
  'only (55000 otherwise). The age filter (created_at, updated_at, last_sign_in_at all older than '
  '24 h) is applied by the worker on the GoTrue data. SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.4 The register line of a purge made through an API ---------------------------------------------

create or replace function ops.record_retention_purge(
  p_run_id    uuid,
  p_attempt   smallint,
  p_category  text,
  p_count     integer
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Closed list: the purges done outside our tables. A purge of our own tables writes its
  -- line itself, in the transaction of its deletes (ops.purge_brevo_inbound_events()).
  if p_category is null or p_category not in ('auth_orphan_users') then
    raise exception 'unknown purge category' using errcode = 'invalid_parameter_value';
  end if;
  if p_count is null or p_count < 1 then
    raise exception 'a purge line names at least one deletion: nothing purged, no line'
      using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'auth_orphan_purge') then
    raise exception 'no open auth_orphan_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  return audit.append('retention.purged', 'periodic_run', p_run_id,
                      pg_catalog.jsonb_build_object('category', p_category, 'count', p_count));
end
$$;

comment on function ops.record_retention_purge(uuid, smallint, text, integer) is
  'E-4 (04 §9): the register line retention.purged {category, count} of a purge done through an API '
  '(auth_orphan_users only), on the open auth_orphan_purge run of this attempt (55000 otherwise). '
  'count >= 1: a purge without effect writes no line (22023). Returns the seq. SECURITY DEFINER owned '
  'by influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.5 The purge of the raw Brevo lines (decision 2) -----------------------------------------------

create or replace function ops.purge_brevo_inbound_events(
  p_run_id   uuid,
  p_attempt  smallint,
  p_limit    integer default 1000
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count  integer;
begin
  if p_limit is null or p_limit not between 1 and 10000 then
    raise exception 'the batch size is between 1 and 10000' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'brevo_inbound_purge') then
    raise exception 'no open brevo_inbound_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- 30 days after the outcome, never a line without one (also refused by the trigger of 0116);
  -- the outcome goes with its line (on delete cascade).
  with doomed as (
    select o.event_id
      from leads.brevo_inbound_outcomes o
     where o.processed_at < pg_catalog.now() - interval '720 hours'
     order by o.processed_at
     limit p_limit
  )
  delete from leads.brevo_inbound_events e
   using doomed
   where e.id = doomed.event_id;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'brevo_inbound_events',
                                                       'count', v_count));
  end if;
  return v_count;
end
$$;

comment on function ops.purge_brevo_inbound_events(uuid, smallint, integer) is
  'E-4 purge (decision 2 of J7, provisional 30 days): deletes at most p_limit raw Brevo lines (1 to '
  '10000, 1000 by default) whose outcome is older than 30 days, with their outcome; never a line '
  'without an outcome. Inside the open brevo_inbound_purge run of this attempt only (55000 '
  'otherwise). Writes retention.purged {category brevo_inbound_events, count} on the run when it '
  'deleted something. Returns the count (call again while it equals p_limit). SECURITY DEFINER owned '
  'by influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.6 Publication: influx_worker only (E-4) ---------------------------------------------------------

revoke all on function ops.claim_periodic_run(ops.periodic_task, text)
  from public, anon, authenticated, service_role;
revoke all on function ops.finish_periodic_run(uuid, smallint, ops.periodic_run_outcome, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function ops.filter_auth_orphans(uuid, smallint, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function ops.record_retention_purge(uuid, smallint, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function ops.purge_brevo_inbound_events(uuid, smallint, integer)
  from public, anon, authenticated, service_role;

grant execute on function ops.claim_periodic_run(ops.periodic_task, text) to influx_worker;
grant execute on function ops.finish_periodic_run(uuid, smallint, ops.periodic_run_outcome, jsonb)
   to influx_worker;
grant execute on function ops.filter_auth_orphans(uuid, smallint, uuid[]) to influx_worker;
grant execute on function ops.record_retention_purge(uuid, smallint, text, integer) to influx_worker;
grant execute on function ops.purge_brevo_inbound_events(uuid, smallint, integer) to influx_worker;

grant usage on schema ops to influx_worker;

-- 5. Rights of the owner: what the functions read and write, nothing more ----------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner.

grant usage on schema ops, identity, leads to influx_maintenance_definer;

grant select (id, task_code, period_key, attempt, started_at, finished_at)
   on ops.periodic_runs to influx_maintenance_definer;
grant insert (task_code, period_key) on ops.periodic_runs to influx_maintenance_definer;
grant update (attempt, counts, finished_at, outcome) on ops.periodic_runs to influx_maintenance_definer;

drop policy if exists periodic_runs_maintenance_definer_select on ops.periodic_runs;
create policy periodic_runs_maintenance_definer_select on ops.periodic_runs
  for select to influx_maintenance_definer
  using (true);

drop policy if exists periodic_runs_maintenance_definer_insert on ops.periodic_runs;
create policy periodic_runs_maintenance_definer_insert on ops.periodic_runs
  for insert to influx_maintenance_definer
  with check (attempt = 1 and finished_at is null and outcome is null and started_at = now());

drop policy if exists periodic_runs_maintenance_definer_update on ops.periodic_runs;
create policy periodic_runs_maintenance_definer_update on ops.periodic_runs
  for update to influx_maintenance_definer
  using (finished_at is null)
  with check (true);

-- 04 §9: the GoTrue user id of the accounts, nothing else of them
grant select (auth_user_id) on identity.accounts to influx_maintenance_definer;

drop policy if exists accounts_maintenance_definer_select on identity.accounts;
create policy accounts_maintenance_definer_select on identity.accounts
  for select to influx_maintenance_definer
  using (true);

-- the raw Brevo lines: their id and their deletion, the age of their outcome
grant select (id) on leads.brevo_inbound_events to influx_maintenance_definer;
grant delete on leads.brevo_inbound_events to influx_maintenance_definer;
grant select (event_id, processed_at) on leads.brevo_inbound_outcomes to influx_maintenance_definer;

drop policy if exists brevo_inbound_events_maintenance_definer_select on leads.brevo_inbound_events;
create policy brevo_inbound_events_maintenance_definer_select on leads.brevo_inbound_events
  for select to influx_maintenance_definer
  using (true);

drop policy if exists brevo_inbound_events_maintenance_definer_delete on leads.brevo_inbound_events;
create policy brevo_inbound_events_maintenance_definer_delete on leads.brevo_inbound_events
  for delete to influx_maintenance_definer
  using (true);

drop policy if exists brevo_inbound_outcomes_maintenance_definer_select on leads.brevo_inbound_outcomes;
create policy brevo_inbound_outcomes_maintenance_definer_select on leads.brevo_inbound_outcomes
  for select to influx_maintenance_definer
  using (true);

-- the register: retention.purged, through audit.append() like the identity owner (0006 §9 window)
grant usage on schema audit to influx_maintenance_definer;

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_maintenance_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 6. Hand the five functions to influx_maintenance_definer (03 P7 rule 5, window of 0004 §9) ---------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;

alter function ops.claim_periodic_run(ops.periodic_task, text) owner to influx_maintenance_definer;
alter function ops.finish_periodic_run(uuid, smallint, ops.periodic_run_outcome, jsonb)
  owner to influx_maintenance_definer;
alter function ops.filter_auth_orphans(uuid, smallint, uuid[]) owner to influx_maintenance_definer;
alter function ops.record_retention_purge(uuid, smallint, text, integer)
  owner to influx_maintenance_definer;
alter function ops.purge_brevo_inbound_events(uuid, smallint, integer)
  owner to influx_maintenance_definer;

revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 7. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  c_fns constant text[] := array[
    'ops.claim_periodic_run(ops.periodic_task, text)',
    'ops.finish_periodic_run(uuid, smallint, ops.periodic_run_outcome, jsonb)',
    'ops.filter_auth_orphans(uuid, smallint, uuid[])',
    'ops.record_retention_purge(uuid, smallint, text, integer)',
    'ops.purge_brevo_inbound_events(uuid, smallint, integer)'];
  v_fn   text;
  v_bad  text;
begin
  -- the owner: no login, no inheritance, nothing dangerous, member of nothing, no usable member
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_maintenance_definer'
                and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb
                     or rolcreaterole or rolreplication)) then
    raise exception 'influx_maintenance_definer must be NOLOGIN NOINHERIT, with no dangerous attribute';
  end if;
  if exists (select 1 from pg_catalog.pg_auth_members m
               join pg_catalog.pg_roles r on r.oid = m.member
              where r.rolname = 'influx_maintenance_definer') then
    raise exception 'influx_maintenance_definer is a member of another role';
  end if;

  foreach v_fn in array c_fns loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_maintenance_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_maintenance_definer, empty search_path', v_fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_worker');
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- no execution role holds a table right on ops.periodic_runs (E-4 goes through functions)
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_maintenance_definer'
     and (pg_catalog.has_any_column_privilege(r.oid, 'ops.periodic_runs', 'SELECT, INSERT, UPDATE, REFERENCES')
          or pg_catalog.has_table_privilege(r.oid, 'ops.periodic_runs', 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'unexpected right(s) on ops.periodic_runs: %', v_bad;
  end if;

  -- audit.append(): the identity owner (0004) and the maintenance owner, nobody else of ours
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_identity_definer', 'influx_maintenance_definer', 'influx_audit_writer')
     and pg_catalog.has_function_privilege(r.oid, 'audit.append(text, text, uuid, jsonb)', 'EXECUTE');
  if v_bad is not null then
    raise exception 'audit.append() executable by: %', v_bad;
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_maintenance_definer', 'influx_audit_writer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE') then
    raise exception 'influx_maintenance_definer left with CREATE on schema ops';
  end if;
end
$$;
