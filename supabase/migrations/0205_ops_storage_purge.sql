-- =============================================================================
-- 0205_ops_storage_purge
-- -----------------------------------------------------------------------------
-- Lot 2 / L2B, commit 09. The hourly task storage_purge of E-4 `maintenance.run_periodic`
-- (jalons/l2b/stockage.md §7; 04 §5.11 rule 3; model: auth_orphan_purge of 0117 and the purge of the
-- exports of 0137). 0204 wrote the rows of the logo and left the task to this commit: an object of
-- Supabase Storage can only be removed through its API (a SQL DELETE on storage.objects is refused by
-- protect_objects_delete), so the worker removes the object and the database forgets the row.
--
--   ops.claim_storage_purges(run, attempt, limit)     the stale pending rows (over 15 minutes) pass
--                                                     to purging; then at most `limit` purging rows
--                                                     not tried in the last 30 minutes are taken
--                                                     (SKIP LOCKED), purge_attempts + 1 and
--                                                     last_purge_attempt_at = now(); returns their
--                                                     (logo_id, object_key)
--   ops.complete_storage_purges(run, attempt, ids)    the rows whose object is removed are deleted;
--                                                     retention.purged {brand_logo_objects, count}
--   ops.purge_storage_usage(run, attempt)             the daily usage older than 7 days deleted;
--                                                     retention.purged {storage_daily_usage, count}
--
-- A row whose removal failed stays purging, its attempts counted: the next hour tries again (a
-- failed removal closes the run `failed`, apps/api/src/domains/maintenance/storage-purge.ts).
-- Owner influx_maintenance_definer (0117), inside the open storage_purge run of the attempt only
-- (55000 otherwise); EXECUTE for influx_worker ONLY. The task is HOURLY: ops.claim_periodic_run()
-- and the CHECK periodic_runs_period_format recreated with it.
--
-- EC-L2B-09 (micro-gaps, the safest choice):
--   EC-L2B-09-1  L2B takes 0205 (EC-L2B-1 gave it 0202 to 0204): 0204 is applied on staging and is
--                never edited; the rights of the task are a migration of their own.
--   EC-L2B-09-2  the enum value is compared as text in the CHECK (a new value of an enum cannot be
--                used in the transaction that adds it).
--   EC-L2B-09-3  a stale pending row passes to purging BEFORE its object is removed: a late
--                activation of it is refused (55000, the upload answered 503), never activated after
--                its object is gone.
--
-- ROLLBACK (no data to keep): drop the three functions; recreate ops.claim_periodic_run() and the
-- CHECK periodic_runs_period_format as in 0137; revoke the rights of section 2 from
-- influx_maintenance_definer and drop its policies on profiles.brand_logo_objects and
-- profiles.storage_daily_usage. The value storage_purge of ops.periodic_task stays (an enum value is
-- not dropped).
-- =============================================================================

-- 1. The task, hourly (EC-L2B-09-2) --------------------------------------------------------------

alter type ops.periodic_task add value if not exists 'storage_purge';

comment on type ops.periodic_task is
  'E-4 tasks of maintenance.run_periodic (0117): brevo_reconciliation (daily), auth_orphan_purge '
  '(hourly), brevo_inbound_purge (daily), data_export_purge (hourly, 0136 and 0137), ops_retention '
  '(daily, 0147), storage_purge (hourly, 0205: the objects of Storage of the purging rows). A new '
  'task is a migration.';

alter table ops.periodic_runs drop constraint if exists periodic_runs_period_format;
alter table ops.periodic_runs add constraint periodic_runs_period_format check (
  (task_code::text in ('auth_orphan_purge', 'data_export_purge', 'storage_purge')
   and period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$')
  or (task_code::text not in ('auth_orphan_purge', 'data_export_purge', 'storage_purge')
      and period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'));

-- 2. What influx_maintenance_definer reaches: the rows to purge, never an active logo ---------------

grant usage on schema profiles to influx_maintenance_definer;

grant select (id, object_key, state, created_at, purge_requested_at, purge_attempts,
              last_purge_attempt_at),
      update (state, purge_requested_at, purge_attempts, last_purge_attempt_at)
   on profiles.brand_logo_objects to influx_maintenance_definer;
grant delete on profiles.brand_logo_objects to influx_maintenance_definer;

drop policy if exists brand_logo_objects_maintenance_definer_select on profiles.brand_logo_objects;
create policy brand_logo_objects_maintenance_definer_select on profiles.brand_logo_objects
  for select to influx_maintenance_definer
  using (state <> 'active');

-- a pending row goes to purging, a purging row counts its attempts; nothing becomes active
drop policy if exists brand_logo_objects_maintenance_definer_update on profiles.brand_logo_objects;
create policy brand_logo_objects_maintenance_definer_update on profiles.brand_logo_objects
  for update to influx_maintenance_definer
  using (state <> 'active')
  with check (state = 'purging' and purge_requested_at is not null);

drop policy if exists brand_logo_objects_maintenance_definer_delete on profiles.brand_logo_objects;
create policy brand_logo_objects_maintenance_definer_delete on profiles.brand_logo_objects
  for delete to influx_maintenance_definer
  using (state = 'purging');

grant select (usage_day) on profiles.storage_daily_usage to influx_maintenance_definer;
grant delete on profiles.storage_daily_usage to influx_maintenance_definer;

drop policy if exists storage_daily_usage_maintenance_definer_select on profiles.storage_daily_usage;
create policy storage_daily_usage_maintenance_definer_select on profiles.storage_daily_usage
  for select to influx_maintenance_definer
  using (true);

-- stockage.md §7: the usage of more than 7 days, and nothing more recent
drop policy if exists storage_daily_usage_maintenance_definer_delete on profiles.storage_daily_usage;
create policy storage_daily_usage_maintenance_definer_delete on profiles.storage_daily_usage
  for delete to influx_maintenance_definer
  using (usage_day < (pg_catalog.now() at time zone 'UTC')::date - 7);

-- 3. The claim and the three functions, as influx_maintenance_definer (03 P7 rule 5) --------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;

set role influx_maintenance_definer;

-- 3.1 The claim of 0137, storage_purge hourly -------------------------------------------------------
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
  -- hourly: the GoTrue pass (04 §9), the purge of the exports (0137) and of Storage (0205)
  v_current := pg_catalog.to_char(pg_catalog.now() at time zone 'UTC',
                                  case when p_task::text in ('auth_orphan_purge', 'data_export_purge',
                                                             'storage_purge')
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
  'E-4 claim (decision 3 of J7): for the CURRENT UTC period of the task only (22023 otherwise): '
  'hourly YYYY-MM-DDTHH for auth_orphan_purge, data_export_purge (0137) and storage_purge (0205), '
  'daily YYYY-MM-DD for the others; creates the run (attempt 1), or takes back a run left unfinished '
  'for one hour (attempt + 1, started_at = now(), counts reset). No row: the period is finished or '
  'running elsewhere. Returns (run id, attempt): the run id is the subject of '
  'elevated.maintenance.run_periodic, the attempt the fencing token of the other functions. '
  'SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

-- 3.2 The rows whose object is to remove ------------------------------------------------------------
create or replace function ops.claim_storage_purges(
  p_run_id   uuid,
  p_attempt  smallint,
  p_limit    integer default 100
)
returns table (
  logo_id     uuid,
  object_key  text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'the batch size is between 1 and 1000' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'storage_purge') then
    raise exception 'no open storage_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- stockage.md §7: an upload left pending for 15 minutes is abandoned (its object may exist);
  -- purging first, so that a late activation is refused (EC-L2B-09-3)
  update profiles.brand_logo_objects l
     set state = 'purging', purge_requested_at = pg_catalog.now()
   where l.state = 'pending'
     and l.created_at < pg_catalog.now() - interval '15 minutes';

  -- a row tried in the last 30 minutes waits for the next hour (no loop inside one run)
  return query
    with picked as (
      select l.id
        from profiles.brand_logo_objects l
       where l.state = 'purging'
         and (l.last_purge_attempt_at is null
              or l.last_purge_attempt_at < pg_catalog.now() - interval '30 minutes')
       order by l.purge_requested_at, l.id
       limit p_limit
         for update skip locked
    )
    update profiles.brand_logo_objects l
       set purge_attempts = least(l.purge_attempts + 1, 32767)::smallint,
           last_purge_attempt_at = pg_catalog.now()
      from picked
     where l.id = picked.id
    returning l.id, l.object_key;
end
$$;

comment on function ops.claim_storage_purges(uuid, smallint, integer) is
  'E-4 storage_purge (stockage.md §7): the pending logo rows older than 15 minutes pass to purging; '
  'then at most p_limit (1 to 1000, 100 by default) purging rows not tried in the last 30 minutes are '
  'taken (SKIP LOCKED), purge_attempts + 1 and last_purge_attempt_at = now(), and their (logo_id, '
  'object_key) returned for the removal through the API of Storage. Inside the open storage_purge '
  'run of this attempt only (55000 otherwise). Never an active row. SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 3.3 The rows whose object is removed ----------------------------------------------------------------
create or replace function ops.complete_storage_purges(
  p_run_id    uuid,
  p_attempt   smallint,
  p_logo_ids  uuid[]
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
  if p_logo_ids is null or pg_catalog.cardinality(p_logo_ids) not between 1 and 1000 then
    raise exception 'between 1 and 1000 logo ids' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'storage_purge') then
    raise exception 'no open storage_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  delete from profiles.brand_logo_objects l
   where l.id = any (p_logo_ids) and l.state = 'purging';
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'brand_logo_objects',
                                                       'count', v_count));
  end if;
  return v_count;
end
$$;

comment on function ops.complete_storage_purges(uuid, smallint, uuid[]) is
  'E-4 storage_purge (stockage.md §7): the purging logo rows of p_logo_ids (1 to 1000), whose object '
  'the worker removed from Storage, are deleted (purged = row deleted, 0204). Writes retention.purged '
  '{category brand_logo_objects, count} on the run when it deleted something. Inside the open '
  'storage_purge run of this attempt only (55000 otherwise). Returns the count. SECURITY DEFINER '
  'owned by influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 3.4 The daily usage after 7 days --------------------------------------------------------------------
create or replace function ops.purge_storage_usage(
  p_run_id   uuid,
  p_attempt  smallint
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
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'storage_purge') then
    raise exception 'no open storage_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  delete from profiles.storage_daily_usage u
   where u.usage_day < (pg_catalog.now() at time zone 'UTC')::date - 7;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'storage_daily_usage',
                                                       'count', v_count));
  end if;
  return v_count;
end
$$;

comment on function ops.purge_storage_usage(uuid, smallint) is
  'E-4 storage_purge (stockage.md §7): deletes the daily usage of the buckets older than 7 days (UTC '
  'day). Writes retention.purged {category storage_daily_usage, count} on the run when it deleted '
  'something. Inside the open storage_purge run of this attempt only (55000 otherwise). Returns the '
  'count. SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

revoke all on function ops.claim_storage_purges(uuid, smallint, integer)
  from public, anon, authenticated, service_role;
revoke all on function ops.complete_storage_purges(uuid, smallint, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function ops.purge_storage_usage(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function ops.claim_storage_purges(uuid, smallint, integer) to influx_worker;
grant execute on function ops.complete_storage_purges(uuid, smallint, uuid[]) to influx_worker;
grant execute on function ops.purge_storage_usage(uuid, smallint) to influx_worker;

reset role;

revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 4. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('ops.claim_periodic_run(ops.periodic_task, text)'),
      ('ops.claim_storage_purges(uuid, smallint, integer)'),
      ('ops.complete_storage_purges(uuid, smallint, uuid[])'),
      ('ops.purge_storage_usage(uuid, smallint)')
    ) as d (fn)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> 'influx_maintenance_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_maintenance_definer, empty search_path',
        v_def.fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_worker');
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- the owner of the task never reads an account, a size or a side of a logo, nor writes its key
  if pg_catalog.has_column_privilege('influx_maintenance_definer', 'profiles.brand_logo_objects',
                                     'account_id', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'profiles.brand_logo_objects',
                                        'byte_size', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'profiles.brand_logo_objects',
                                        'activated_at', 'UPDATE')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'profiles.storage_daily_usage',
                                        'account_id', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_maintenance_definer', 'profiles.brand_logo_objects',
                                            'INSERT')
     or pg_catalog.has_any_column_privilege('influx_maintenance_definer',
                                            'profiles.advertiser_profiles', 'SELECT') then
    raise exception 'influx_maintenance_definer reaches beyond the rows it purges';
  end if;

  -- no execution role gained a right on the tables of the logo
  select string_agg(r || ' ' || p || ' ' || t, ', ') into v_bad
    from unnest(array['profiles.brand_logo_objects', 'profiles.storage_quotas',
                      'profiles.storage_daily_usage']) t,
         unnest(array['influx_worker', 'influx_ops', 'influx_privacy', 'influx_auth']) r,
         unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
   where pg_catalog.has_table_privilege(r, t, p)
      or (p <> 'DELETE' and pg_catalog.has_any_column_privilege(r, t, p));
  if v_bad is not null then
    raise exception 'execution role(s) reaching a table of the logo: %', v_bad;
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_maintenance_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_maintenance_definer left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE') then
    raise exception 'influx_maintenance_definer left with CREATE on schema ops';
  end if;
end
$$;
