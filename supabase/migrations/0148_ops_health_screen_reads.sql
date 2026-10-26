-- =============================================================================
-- 0148_ops_health_screen_reads
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, commit 9 ("Santé technique" screen, D60; 02 §20.5, "Écran « Santé technique »";
-- 15 RG165; 21 §J9 point 9; EC-J9-5). The database half of a READ-ONLY screen of the backoffice,
-- reserved to the administrators: the availability measured by the probe, the error groups and
-- their occurrences, the calls, the durations and the errors per route, the health of the
-- processes, the connections of the base and the state of the worker (02 §11.3: read from the
-- base, so that it stays right while the worker is down).
--
--   backoffice.ops_health_status()          the probe (last check and availability over 24 hours,
--                                           7 days and 30 days), the worker processes and the
--                                           definition of AL50, the last run of each periodic
--                                           task, the open technical alerts (RG165: each one is
--                                           shown on this screen AND sent by e-mail);
--   backoffice.ops_error_groups(text,text,integer)
--                                           the groups of one state, the counts of every state;
--   backoffice.ops_error_group(uuid)        one group and its kept occurrences (null: unknown);
--   backoffice.ops_traffic(text)            calls, 5xx, 429 and the HISTOGRAM of the nine fixed
--                                           buckets per route and per time bucket, all instances
--                                           ADDED UP: the p95 is computed by apps/api at read
--                                           time, never stored, never one per instance (02 §20.5);
--   backoffice.ops_processes()              the last sample and the last hour of each process, the
--                                           connections of the base (last hour, peak of 24 hours).
--
-- Every function is SECURITY DEFINER owned by influx_maintenance_definer (0117), STABLE, empty
-- search_path, EXECUTE for influx_admin ONLY (the precedent of backoffice.last_brevo_reconciliation(),
-- 0134: the role is taken from the session of an admin in aal2 and from nothing else). They return
-- codes, counts, instants, normalised messages and cleaned stacks (02 §20.8); never a person: the
-- account of an occurrence is a uuid. They write nothing and are not journaled: a read of the
-- technical state, not of a person (the same reasoning as backoffice.read_apollo_settings(), 0134).
-- An agent's attempt is refused by the route and journaled as backoffice.action_refused
-- {action_code: ops.read_health} (05 CA63): backoffice.record_refused_action() knows the new code.
--
-- Rights added to influx_maintenance_definer (every table is FORCE ROW LEVEL SECURITY: its select
-- policy of 0147 already covers the owner), COLUMNS only:
--   ops.error_groups       service, message, occurrence_count, regression_count, first_version,
--                          last_version (the description of the group, never the other tables);
--   ops.error_occurrences  service, version, route, request_id, account_id, message, stack,
--                          user_agent_summary: what 02 §20.5 says an occurrence carries. 0147 kept
--                          the owner away from them (AL51 reads the instants only): THE SCREEN
--                          WIDENS IT, for these functions, to read what the scrubber already cleaned;
--   ops.probe_results      status_code, failure_code;
--   ops.probe_results_hourly  checks, failures.
--
-- EC-J9 (micro-gaps, the safest choice):
--   EC-J9-5a  the 30-day availability takes the minute table for the last 14 days (the retention)
--             and the hourly roll-up before: a hour is never counted twice.
--   EC-J9-5b  the traffic of a window is read from the per-minute table (14 days): hour = 12 buckets
--             of 5 minutes, day = 24 of 1 hour, week = 28 of 6 hours; the last bucket is still
--             open ("in progress"): apps/api divides it by the minutes elapsed. 100 routes at most
--             (the busiest), plus the totals of every route.
--   EC-J9-5c  a "regression" is a group of regression_count > 0 still open (new or acknowledged);
--             the state itself stays new / acknowledged / fixed / ignored (0016).
--   EC-J9-5d  §11.3 lists the age of the oldest pending event, the failed events and the last chain
--             check as worker signals: the queue is read by no owner of the ops schema and the
--             failures by the existing screens (counters of the home, list of the accounts), so this
--             screen shows the beat, the loop turns and the periodic tasks; the age of the queue
--             is left to the leads screens (not a right widened here).
--
-- ROLLBACK (before any real use): drop the five functions below; recreate
-- backoffice.record_refused_action() as in 0137; revoke the column grants of section 2 and nothing
-- else (the policies are those of 0147).
-- =============================================================================

-- 1. The code of an agent's refused attempt ---------------------------------------------------------
-- backoffice.record_refused_action(), recreated by its owner as in 0137 with one more code.

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;

set role influx_identity_definer;

create or replace function backoffice.record_refused_action(p_action_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller uuid := influx.current_account_id();
begin
  if v_caller is null
     or influx.current_account_role() is distinct from 'agent'
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'agent'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_action_code is null
     or p_action_code not in ('leads.change_apollo_setting', 'leads.read_apollo_settings',
                              'leads.lift_brevo_suppression', 'backoffice.dual_control',
                              'identity.change_member_role', 'identity.internal_invitation',
                              'privacy.approve_data_request', 'ops.read_health') then
    raise exception 'unknown action code' using errcode = 'invalid_parameter_value';
  end if;
  -- the trace of the attempt, on the caller's own account (AL39 counts them per account)
  perform audit.append('backoffice.action_refused', 'account', v_caller,
                       pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                     'required_role', 'admin'));
end
$$;

comment on function backoffice.record_refused_action(text) is
  '05 CA63, 15 RG110 (AL39): an active agent in aal2 who attempted an admin action leaves its trace: '
  'backoffice.action_refused {action_code, required_role: admin} on his own account. Closed list: '
  'leads.change_apollo_setting, leads.read_apollo_settings, leads.lift_brevo_suppression, '
  'backoffice.dual_control, identity.change_member_role, identity.internal_invitation (0135), '
  'privacy.approve_data_request (0137, EC-J8-49), ops.read_health (0148: the "Santé technique" screen; '
  '22023 otherwise). apps/api calls it before answering 403, in a transaction that commits. SECURITY '
  'DEFINER owned by influx_identity_definer; EXECUTE for influx_agent ONLY.';

reset role;

revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 2. What the owner reads, COLUMNS only -----------------------------------------------------------------

grant select (service, message, occurrence_count, regression_count, first_version, last_version)
   on ops.error_groups to influx_maintenance_definer;
grant select (service, version, route, request_id, account_id, message, stack, user_agent_summary)
   on ops.error_occurrences to influx_maintenance_definer;
grant select (status_code, failure_code) on ops.probe_results to influx_maintenance_definer;
grant select (checks, failures) on ops.probe_results_hourly to influx_maintenance_definer;

-- 3. The functions (created by the migration role, published, then handed to their owner) -------------

-- 3.1 The probe, the worker, the periodic tasks and the open alerts -----------------------------------

create or replace function backoffice.ops_health_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now      timestamptz := pg_catalog.now();
  -- the first hour of the minute table: before it, the hourly roll-up is the only record (EC-J9-5a)
  v_cut      timestamptz := pg_catalog.date_trunc('hour', pg_catalog.now() - interval '336 hours', 'UTC')
                            + interval '1 hour';
begin
  return pg_catalog.jsonb_build_object(
    'now', ops.iso_utc(v_now),
    'probes', (
      select coalesce(pg_catalog.jsonb_agg(p.row order by p.target), '[]'::jsonb)
        from (
          select t.target::text as target,
                 pg_catalog.jsonb_build_object(
                   'target', t.target::text,
                   'last', (select pg_catalog.jsonb_build_object(
                                     'checked_at', ops.iso_utc(l.checked_at),
                                     'outcome', l.outcome,
                                     'status_code', l.status_code,
                                     'failure_code', l.failure_code,
                                     'duration_ms', l.duration_ms)
                              from ops.probe_results l
                             where l.target = t.target
                             order by l.checked_at desc, l.instance
                             limit 1),
                   'day',   (select pg_catalog.jsonb_build_object(
                                      'checks', coalesce(sum(s.checks), 0),
                                      'failures', coalesce(sum(s.failures), 0))
                               from (select 1 as checks, (r.outcome = 'down')::int as failures, r.checked_at as at
                                       from ops.probe_results r
                                      where r.target = t.target and r.checked_at >= v_now - interval '24 hours') s),
                   'week',  (select pg_catalog.jsonb_build_object(
                                      'checks', coalesce(sum(s.checks), 0),
                                      'failures', coalesce(sum(s.failures), 0))
                               from (select 1 as checks, (r.outcome = 'down')::int as failures, r.checked_at as at
                                       from ops.probe_results r
                                      where r.target = t.target and r.checked_at >= v_now - interval '7 days') s),
                   'month', (select pg_catalog.jsonb_build_object(
                                      'checks', coalesce(sum(s.checks), 0),
                                      'failures', coalesce(sum(s.failures), 0))
                               from (select 1 as checks, (r.outcome = 'down')::int as failures
                                       from ops.probe_results r
                                      where r.target = t.target and r.checked_at >= v_cut
                                        and r.checked_at >= v_now - interval '30 days'
                                     union all
                                     select h.checks, h.failures
                                       from ops.probe_results_hourly h
                                      where h.target = t.target and h.hour < v_cut
                                        and h.hour >= v_now - interval '30 days') s)
                 ) as row
            from unnest(pg_catalog.enum_range(null::ops.probe_target)) as t(target)
        ) p
    ),
    'workers', (
      select coalesce(pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'instance', h.instance,
                 'version', h.version,
                 'started_at', ops.iso_utc(h.started_at),
                 'beat_at', ops.iso_utc(h.beat_at),
                 'loop_turn_at', ops.iso_utc(h.loop_turn_at))
               order by h.beat_at desc, h.worker_id), '[]'::jsonb)
        from (select * from ops.worker_heartbeats
               order by beat_at desc, worker_id
               limit 20) h
    ),
    'worker_definition', (
      select pg_catalog.jsonb_build_object(
               'threshold', d.threshold_value,
               'is_active', d.is_active)
        from backoffice.alert_definitions d
       where d.code = 'AL50'
    ),
    'periodic', (
      select coalesce(pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'task', r.task_code::text,
                 'period', r.period_key,
                 'started_at', ops.iso_utc(r.started_at),
                 'finished_at', ops.iso_utc(r.finished_at),
                 'outcome', r.outcome::text)
               order by r.task_code), '[]'::jsonb)
        from (select distinct on (task_code) task_code, period_key, started_at, finished_at, outcome
                from ops.periodic_runs
               order by task_code, started_at desc) r
    ),
    'alerts', (
      select coalesce(pg_catalog.jsonb_agg(
               pg_catalog.jsonb_build_object(
                 'code', s.code,
                 'subject', s.subject_key,
                 'opened_at', ops.iso_utc(s.opened_at),
                 'last_notified_at', ops.iso_utc(s.last_notified_at),
                 'notified_count', s.notified_count,
                 'value', s.last_value)
               order by s.opened_at desc, s.code, s.subject_key), '[]'::jsonb)
        from (select code, subject_key, opened_at, last_notified_at, notified_count, last_value
                from ops.alert_states
               -- AL51's two bookkeeping lines are not alerts (0147)
               where state = 'open' and subject_key not in ('watermark', 'digest')
               order by opened_at desc, code, subject_key
               limit 100) s
    )
  );
end
$$;

comment on function backoffice.ops_health_status() is
  '02 §20.5, 15 RG165 (EC-J9-5): {now, probes: [{target, last: {checked_at, outcome, status_code, '
  'failure_code, duration_ms} | null, day | week | month: {checks, failures}}] (the four targets, the '
  'minute table for 14 days and the hourly roll-up before, EC-J9-5a), workers: [{instance, version, '
  'started_at, beat_at, loop_turn_at}] (20 at most, the latest beat first), worker_definition: {threshold, '
  'is_active} of AL50, periodic: the last run of each task, alerts: the open technical alerts (100 at '
  'most, the bookkeeping lines of AL51 left out) with their flat last_value}. Instants ISO 8601 UTC with '
  'microseconds. Codes, counts and instants only (02 §20.8). SECURITY DEFINER owned by '
  'influx_maintenance_definer; EXECUTE for influx_admin ONLY.';

-- 3.2 The error groups ---------------------------------------------------------------------------------

create or replace function backoffice.ops_error_groups(
  p_state   text,
  p_source  text,
  p_limit   integer
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_state is null
     or p_state not in ('open', 'regression', 'new', 'acknowledged', 'fixed', 'ignored', 'all')
     or (p_source is not null and p_source not in ('server', 'browser'))
     or p_limit is null or p_limit not between 1 and 200 then
    raise exception 'invalid filter' using errcode = 'invalid_parameter_value';
  end if;

  return pg_catalog.jsonb_build_object(
    'counts', (
      select pg_catalog.jsonb_build_object(
               'new', count(*) filter (where g.status = 'new'),
               'acknowledged', count(*) filter (where g.status = 'acknowledged'),
               'fixed', count(*) filter (where g.status = 'fixed'),
               'ignored', count(*) filter (where g.status = 'ignored'),
               'regression', count(*) filter (where g.status in ('new', 'acknowledged')
                                                and g.regression_count > 0))
        from ops.error_groups g
       where p_source is null or g.source::text = p_source
    ),
    'groups', (
      select coalesce(pg_catalog.jsonb_agg(x.row order by x.last_seen_at desc, x.id), '[]'::jsonb)
        from (
          select g.last_seen_at, g.id,
                 pg_catalog.jsonb_build_object(
                   'id', g.id,
                   'source', g.source::text,
                   'service', g.service::text,
                   'error_type', g.error_type,
                   'message', g.message,
                   'route', g.route,
                   'status', g.status::text,
                   'occurrence_count', g.occurrence_count,
                   'regression_count', g.regression_count,
                   'first_seen_at', ops.iso_utc(g.first_seen_at),
                   'last_seen_at', ops.iso_utc(g.last_seen_at),
                   'last_regressed_at', ops.iso_utc(g.last_regressed_at),
                   'first_version', g.first_version,
                   'last_version', g.last_version) as row
            from ops.error_groups g
           where (p_source is null or g.source::text = p_source)
             and case p_state
                   when 'open' then g.status in ('new', 'acknowledged')
                   when 'regression' then g.status in ('new', 'acknowledged') and g.regression_count > 0
                   when 'all' then true
                   else g.status::text = p_state
                 end
           order by g.last_seen_at desc, g.id
           limit p_limit
        ) x
    )
  );
end
$$;

comment on function backoffice.ops_error_groups(text, text, integer) is
  '02 §20.5, EC-J9-5c: {counts: {new, acknowledged, fixed, ignored, regression}, groups: [...]} for one '
  'state (open = new + acknowledged | regression | new | acknowledged | fixed | ignored | all), one source '
  '(server | browser | null) and at most p_limit (1 to 200) groups, the latest sighting first. The message '
  'is the NORMALISED one of the group (02 §20.8). 22023 for another filter. SECURITY DEFINER owned by '
  'influx_maintenance_definer; EXECUTE for influx_admin ONLY.';

create or replace function backoffice.ops_error_group(p_group uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_group  record;
begin
  select g.id, g.fingerprint, g.source::text as source, g.service::text as service, g.error_type,
         g.message, g.route, g.status::text as status, g.occurrence_count, g.regression_count,
         g.first_seen_at, g.last_seen_at, g.last_regressed_at, g.first_version, g.last_version
    into v_group
    from ops.error_groups g
   where g.id = p_group;
  if not found then
    return null;
  end if;

  return pg_catalog.jsonb_build_object(
    'group', pg_catalog.jsonb_build_object(
               'id', v_group.id,
               'source', v_group.source,
               'service', v_group.service,
               'error_type', v_group.error_type,
               'message', v_group.message,
               'route', v_group.route,
               'status', v_group.status,
               'occurrence_count', v_group.occurrence_count,
               'regression_count', v_group.regression_count,
               'first_seen_at', ops.iso_utc(v_group.first_seen_at),
               'last_seen_at', ops.iso_utc(v_group.last_seen_at),
               'last_regressed_at', ops.iso_utc(v_group.last_regressed_at),
               'first_version', v_group.first_version,
               'last_version', v_group.last_version),
    'occurrences', (
      select coalesce(pg_catalog.jsonb_agg(x.row order by x.occurred_at desc, x.id), '[]'::jsonb)
        from (
          select o.occurred_at, o.id,
                 pg_catalog.jsonb_build_object(
                   'occurred_at', ops.iso_utc(o.occurred_at),
                   'service', o.service::text,
                   'version', o.version,
                   'route', o.route,
                   'request_id', o.request_id,
                   'account_id', o.account_id,
                   'message', o.message,
                   'stack', o.stack,
                   'user_agent_summary', o.user_agent_summary) as row
            from ops.error_occurrences o
           where o.group_fingerprint = v_group.fingerprint
           order by o.occurred_at desc, o.id desc
           limit 50
        ) x
    )
  );
end
$$;

comment on function backoffice.ops_error_group(uuid) is
  '02 §20.5: {group, occurrences} of one error group, the 50 latest occurrences kept (30 days): date, '
  'service, version, route model, request identifier (the way to the Railway logs), account uuid when '
  'there is one, the cleaned message and stack (02 §20.8: never an address, a code, a token, a URL). NULL '
  'for an unknown group (the route answers 404). SECURITY DEFINER owned by influx_maintenance_definer; '
  'EXECUTE for influx_admin ONLY.';

-- 3.3 Calls, durations and errors per route ------------------------------------------------------------

create or replace function backoffice.ops_traffic(p_window text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now     timestamptz := pg_catalog.now();
  v_step    integer;
  v_points  integer;
  v_from    timestamptz;
begin
  -- EC-J9-5b: hour = 12 x 5 min, day = 24 x 1 h, week = 28 x 6 h
  if p_window = 'hour' then
    v_step := 300;   v_points := 12;
  elsif p_window = 'day' then
    v_step := 3600;  v_points := 24;
  elsif p_window = 'week' then
    v_step := 21600; v_points := 28;
  else
    raise exception 'invalid window' using errcode = 'invalid_parameter_value';
  end if;
  v_from := pg_catalog.to_timestamp(
              pg_catalog.floor(extract(epoch from v_now) / v_step) * v_step
              - (v_points - 1) * v_step);

  return pg_catalog.jsonb_build_object(
    'now', ops.iso_utc(v_now),
    'from', ops.iso_utc(v_from),
    'bucket_seconds', v_step,
    'routes', (
      select coalesce(pg_catalog.jsonb_agg(x.row order by x.calls desc, x.method, x.route), '[]'::jsonb)
        from (
          select a.method, a.route, a.calls, pg_catalog.jsonb_build_object(
                   'method', a.method,
                   'route', a.route,
                   'cells', (
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'at', ops.iso_utc(c.at),
                              'count', c.calls, 'server_errors', c.errors, 'throttled', c.throttled,
                              'buckets', pg_catalog.jsonb_build_array(c.b1, c.b2, c.b3, c.b4, c.b5, c.b6,
                                                                       c.b7, c.b8, c.b9))
                              order by c.at)
                       from (
                         select pg_catalog.to_timestamp(
                                  pg_catalog.floor(extract(epoch from m.minute) / v_step) * v_step) as at,
                                sum(m.request_count)::bigint as calls,
                                sum(m.server_error_count)::bigint as errors,
                                sum(m.throttled_count)::bigint as throttled,
                                sum(m.duration_buckets[1])::bigint as b1, sum(m.duration_buckets[2])::bigint as b2,
                                sum(m.duration_buckets[3])::bigint as b3, sum(m.duration_buckets[4])::bigint as b4,
                                sum(m.duration_buckets[5])::bigint as b5, sum(m.duration_buckets[6])::bigint as b6,
                                sum(m.duration_buckets[7])::bigint as b7, sum(m.duration_buckets[8])::bigint as b8,
                                sum(m.duration_buckets[9])::bigint as b9
                           from ops.request_metrics m
                          where m.service = 'api' and m.minute >= v_from
                            and m.method = a.method and m.route = a.route
                          group by 1) c)) as row
            from (
              -- the 100 busiest routes of the window
              select m.method, m.route, sum(m.request_count)::bigint as calls
                from ops.request_metrics m
               where m.service = 'api' and m.minute >= v_from
               group by m.method, m.route
               order by sum(m.request_count) desc, m.method, m.route
               limit 100
            ) a
        ) x
    ),
    'totals', (
      select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'at', ops.iso_utc(c.at),
               'count', c.calls, 'server_errors', c.errors, 'throttled', c.throttled,
               'buckets', pg_catalog.jsonb_build_array(c.b1, c.b2, c.b3, c.b4, c.b5, c.b6, c.b7, c.b8, c.b9))
               order by c.at), '[]'::jsonb)
        from (
          select pg_catalog.to_timestamp(
                   pg_catalog.floor(extract(epoch from m.minute) / v_step) * v_step) as at,
                 sum(m.request_count)::bigint as calls,
                 sum(m.server_error_count)::bigint as errors,
                 sum(m.throttled_count)::bigint as throttled,
                 sum(m.duration_buckets[1])::bigint as b1, sum(m.duration_buckets[2])::bigint as b2,
                 sum(m.duration_buckets[3])::bigint as b3, sum(m.duration_buckets[4])::bigint as b4,
                 sum(m.duration_buckets[5])::bigint as b5, sum(m.duration_buckets[6])::bigint as b6,
                 sum(m.duration_buckets[7])::bigint as b7, sum(m.duration_buckets[8])::bigint as b8,
                 sum(m.duration_buckets[9])::bigint as b9
            from ops.request_metrics m
           where m.service = 'api' and m.minute >= v_from
           group by 1) c
    )
  );
end
$$;

comment on function backoffice.ops_traffic(text) is
  '02 §20.5, EC-J9-5b: {now, from, bucket_seconds, routes: [{method, route, cells: [{at, count, '
  'server_errors, throttled, buckets: [9]}]}] (the 100 busiest route models of the window, ALL INSTANCES '
  'ADDED UP: histograms add up, the p95 is computed by apps/api, never stored and never one per instance), '
  'totals: the same cells for every route}. p_window = hour (12 x 5 min) | day (24 x 1 h) | week (28 x 6 h); '
  '22023 otherwise. A route MODEL, never a real URL (02 §20.8). SECURITY DEFINER owned by '
  'influx_maintenance_definer; EXECUTE for influx_admin ONLY.';

-- 3.4 The processes and the connections -----------------------------------------------------------------

create or replace function backoffice.ops_processes()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_now  timestamptz := pg_catalog.now();
begin
  return pg_catalog.jsonb_build_object(
    'now', ops.iso_utc(v_now),
    'processes', (
      select coalesce(pg_catalog.jsonb_agg(x.row order by x.service, x.instance), '[]'::jsonb)
        from (
          select l.service::text as service, l.instance,
                 pg_catalog.jsonb_build_object(
                   'service', l.service::text,
                   'instance', l.instance,
                   'last_minute', ops.iso_utc(l.minute),
                   'event_loop_delay_p99_ms', l.event_loop_delay_p99_ms,
                   'event_loop_delay_max_ms', l.event_loop_delay_max_ms,
                   'rss_bytes', l.rss_bytes,
                   'heap_used_bytes', l.heap_used_bytes,
                   'cpu_percent', l.cpu_percent,
                   'hour', (select pg_catalog.jsonb_build_object(
                                     'samples', count(*),
                                     'event_loop_delay_p99_avg_ms', round(avg(h.event_loop_delay_p99_ms), 2),
                                     'event_loop_delay_max_ms', max(h.event_loop_delay_max_ms),
                                     'rss_max_bytes', max(h.rss_bytes),
                                     'cpu_max_percent', max(h.cpu_percent))
                              from ops.process_metrics h
                             where h.service = l.service and h.instance = l.instance
                               and h.minute >= v_now - interval '1 hour')) as row
            from (select distinct on (service, instance) *
                    from ops.process_metrics
                   -- a process silent for more than a day is no longer listed
                   where minute >= v_now - interval '24 hours'
                   order by service, instance, minute desc) l
        ) x
    ),
    'database', (
      select pg_catalog.jsonb_build_object(
               'last', (select pg_catalog.jsonb_build_object(
                                 'minute', ops.iso_utc(d.minute),
                                 'connections', d.connections,
                                 'max_connections', d.max_connections)
                          from ops.database_samples d
                         order by d.minute desc
                         limit 1),
               'peak_24h', (select max(d.connections)
                              from ops.database_samples d
                             where d.minute >= v_now - interval '24 hours'),
               'samples', (select coalesce(pg_catalog.jsonb_agg(
                                     pg_catalog.jsonb_build_object(
                                       'minute', ops.iso_utc(s.minute),
                                       'connections', s.connections,
                                       'max_connections', s.max_connections)
                                     order by s.minute), '[]'::jsonb)
                             from (select * from ops.database_samples d
                                    where d.minute >= v_now - interval '1 hour'
                                    order by d.minute desc
                                    limit 60) s))
    )
  );
end
$$;

comment on function backoffice.ops_processes() is
  '02 §20.5: {now, processes: [{service, instance, last_minute, event_loop_delay_p99_ms, '
  'event_loop_delay_max_ms, rss_bytes, heap_used_bytes, cpu_percent, hour: {samples, '
  'event_loop_delay_p99_avg_ms, event_loop_delay_max_ms, rss_max_bytes, cpu_max_percent}}] (the processes '
  'that wrote within 24 hours), database: {last, peak_24h, samples: the 60 latest minutes}}. The instance '
  'is the replica identifier, never an address. SECURITY DEFINER owned by influx_maintenance_definer; '
  'EXECUTE for influx_admin ONLY.';

-- 4. Publication ---------------------------------------------------------------------------------------------

revoke all on function backoffice.ops_health_status()
  from public, anon, authenticated, service_role;
revoke all on function backoffice.ops_error_groups(text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.ops_error_group(uuid)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.ops_traffic(text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.ops_processes()
  from public, anon, authenticated, service_role;

grant execute on function backoffice.ops_health_status() to influx_admin;
grant execute on function backoffice.ops_error_groups(text, text, integer) to influx_admin;
grant execute on function backoffice.ops_error_group(uuid) to influx_admin;
grant execute on function backoffice.ops_traffic(text) to influx_admin;
grant execute on function backoffice.ops_processes() to influx_admin;

-- 5. Hand the functions to their owner (03 P7 rule 5, window of 0004 §9) --------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema backoffice to influx_maintenance_definer;

alter function backoffice.ops_health_status() owner to influx_maintenance_definer;
alter function backoffice.ops_error_groups(text, text, integer) owner to influx_maintenance_definer;
alter function backoffice.ops_error_group(uuid) owner to influx_maintenance_definer;
alter function backoffice.ops_traffic(text) owner to influx_maintenance_definer;
alter function backoffice.ops_processes() owner to influx_maintenance_definer;

revoke create on schema backoffice from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 6. End-state assertions ------------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('backoffice.ops_health_status()',                   'influx_maintenance_definer', array['influx_admin']),
      ('backoffice.ops_error_groups(text, text, integer)', 'influx_maintenance_definer', array['influx_admin']),
      ('backoffice.ops_error_group(uuid)',                 'influx_maintenance_definer', array['influx_admin']),
      ('backoffice.ops_traffic(text)',                     'influx_maintenance_definer', array['influx_admin']),
      ('backoffice.ops_processes()',                       'influx_maintenance_definer', array['influx_admin']),
      ('backoffice.record_refused_action(text)',           'influx_identity_definer',    array['influx_agent'])
    ) as t (fn, owner, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> v_def.owner
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by %, empty search_path', v_def.fn, v_def.owner;
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

  -- no execution role reads the ops tables directly: the owner of the functions alone does
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['ops.error_groups', 'ops.error_occurrences', 'ops.probe_results',
                      'ops.probe_results_hourly', 'ops.request_metrics', 'ops.process_metrics',
                      'ops.database_samples', 'ops.worker_heartbeats', 'ops.alert_states']) t
   where r.rolname in ('influx_agent', 'influx_admin', 'influx_advertiser', 'influx_creator',
                       'influx_app', 'influx_auth', 'influx_auth_login')
     and pg_catalog.has_any_column_privilege(r.oid, t, 'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'unexpected table right(s) on ops: %', v_bad;
  end if;
end
$$;
