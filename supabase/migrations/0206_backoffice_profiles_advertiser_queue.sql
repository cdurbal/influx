-- =============================================================================
-- 0206_backoffice_profiles_advertiser_queue
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 04 (jalons/l2c/file.md, D81; 15 RG26 to RG29, RG38; 06 RG7; 04 §5.10).
-- Queue 1 of 15 RG29, its delay, the claim expiry, and the one function that turns a delay into a
-- deadline. No entry exists yet: profiles.advertiser_review_entries arrives with 0207 (L2C-05),
-- which reads this function once, at the creation of an entry (04 §5.6: the deadline is frozen).
--
--   backoffice.queues / sla_policies  profiles_advertiser: 06 RG63-RG72, agent and admin, no bulk
--         action, a lock (15 RG29). Decision 480 business minutes (1 business day, D39, 06 RG7),
--         claim objective 240 (4 business hours), escalation 960 minutes AFTER the decision
--         deadline: 480 + 960 = 3 business days of age (06 RG7; file.md "Fonctions et échéance"
--         prevails over the 1440 of the prompt). Not provisional: 15 RG29 and 06 RG7 decide it.
--   backoffice.operational_settings   the closed key/value table of 04 §5.10, brought forward from
--         0306 (EC-L2C-2) with its only key needed at L2C: claim_expiry_minutes = 30 (15 RG27 C3,
--         file.md A9). Read by agent and admin in aal2; written by the migrations only until the
--         admin function of Lot 5 (journalled, 15 RG38). Later keys widen its CHECK, one migration
--         each (0306, 0503 no longer create the table).
--   backoffice.business_deadline(queue, from, minutes)  deterministic (STABLE, no now()): the
--         instant at which `minutes` minutes counted in the business hours of the queue have
--         elapsed from `from`; calendar minutes when business_hours is NULL. sla_due_at =
--         business_deadline(q, created_at, target_decision_minutes); escalate_at =
--         business_deadline(q, sla_due_at, escalate_after_minutes). SECURITY INVOKER: its caller
--         reads backoffice.sla_policies; EXECUTE granted to its first caller (0207), nobody here.
--
-- The business hours carry no public holidays: neither 15 nor D39 defines a calendar of them
-- (shape of 0129, a closed jsonb). The minutes are counted on the WALL CLOCK of the time zone of
-- the policy (UTC, a waiting value of 0129): a daylight saving change outside the opening hours
-- does not move a deadline.
--
-- EC-L2C-04 (micro-gaps, the safest choice):
--   EC-L2C-04-1  0206 is the next free number (ls supabase/migrations; 04 §11 planned 0206 for
--                verification_core: the planned numbers take the next free ones, EC-L2B-1).
--   EC-L2C-04-2  claim_expiry_minutes is bounded 1 to 1440 (a whole number of minutes, at most one
--                day); 15 RG27 fixes 30, the bound only refuses an absurd value.
--   EC-L2C-04-3  negative minutes are refused (22023); NULL minutes return NULL (no escalation);
--                zero minutes return `from` unchanged.
--   EC-L2C-04-4  an unknown or inactive queue is refused (22023): a deadline never falls back on a
--                default delay.
--
-- ROLLBACK (no entry references the queue before 0207): delete from backoffice.sla_policies and
-- backoffice.queues where code = 'profiles_advertiser' (one transaction); drop function
-- backoffice.business_deadline(text, timestamptz, integer); drop table
-- backoffice.operational_settings.
-- =============================================================================

-- 1. Queue 1 and its delay (15 RG29, 06 RG7) -------------------------------------------------------
-- ON CONFLICT DO NOTHING: re-running the migration never overwrites a value changed since.

insert into backoffice.queues
  (code, label_key, spec_document, handled_by_roles, allows_bulk_action, has_lock)
values
  ('profiles_advertiser', 'queue.profiles_advertiser', '06 RG63-RG72',
   '{agent,admin}', false, true)
on conflict (code) do nothing;

insert into backoffice.sla_policies
  (queue_code, target_claim_minutes, target_decision_minutes, business_hours,
   escalate_after_minutes, is_provisional)
values
  -- 1 business day, claim within 4 business hours, escalation at 3 business days of age
  ('profiles_advertiser', 240, 480, default, 960, false)
on conflict (queue_code) do nothing;

-- the deferred key is checked now: a pending trigger event would block any later ALTER TABLE
set constraints backoffice.queues_sla_policy_fk immediate;

-- 2. backoffice.operational_settings (04 §5.10, EC-L2C-2) ---------------------------------------------

create table if not exists backoffice.operational_settings (
  key                    text        not null primary key,
  value                  jsonb       not null,
  updated_by_account_id  uuid        references identity.accounts (id),
  updated_at             timestamptz not null default now(),

  -- the closed list: a key is added by a migration, with its own CHECK below
  constraint operational_settings_key_closed check (key in ('claim_expiry_minutes')),
  -- CASE keeps the cast behind the type test (EC-L2C-04-2)
  constraint operational_settings_claim_expiry_minutes check (
    key <> 'claim_expiry_minutes'
    or case when jsonb_typeof(value) = 'number'
            then (value)::numeric = trunc((value)::numeric)
                 and (value)::numeric between 1 and 1440
            else false
       end)
);

comment on table backoffice.operational_settings is
  'Operating caps and delays that are neither SLA (backoffice.sla_policies) nor search settings '
  '(04 §5.10, 15 RG38): a CLOSED key/value list, each key with its own CHECK, the same regime as '
  'leads.sync_settings. Created at L2C (0206, EC-L2C-2) with claim_expiry_minutes; the other keys '
  'of 04 §5.10 arrive with their lots. Read by agent and admin in aal2; written by the migrations '
  'only until the admin function of Lot 5, every change then journalled nominatively.';
comment on column backoffice.operational_settings.key is
  'Closed list (operational_settings_key_closed). claim_expiry_minutes: duration of a claim on a '
  'queue entry with a lock (15 RG27 C3, file.md A9), whole minutes, 1 to 1440.';
comment on column backoffice.operational_settings.value is
  'JSON value of the key, its shape checked per key. claim_expiry_minutes: a JSON number (30).';
comment on column backoffice.operational_settings.updated_by_account_id is
  'Administrator who last changed the value; NULL for a value loaded by a migration.';

drop trigger if exists operational_settings_touch_updated_at on backoffice.operational_settings;
create trigger operational_settings_touch_updated_at
  before update on backoffice.operational_settings
  for each row execute function influx.touch_updated_at();

alter table backoffice.operational_settings enable row level security;
alter table backoffice.operational_settings force  row level security;
revoke all on backoffice.operational_settings from public, anon, authenticated, service_role;

grant select on backoffice.operational_settings to influx_agent, influx_admin;

drop policy if exists operational_settings_internal_select on backoffice.operational_settings;
create policy operational_settings_internal_select on backoffice.operational_settings
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

insert into backoffice.operational_settings (key, value)
values ('claim_expiry_minutes', '30'::jsonb)
on conflict (key) do nothing;

-- 3. backoffice.business_deadline (04 §5.6 "une seule fois, par une fonction déterministe") ---------

create or replace function backoffice.business_deadline(
  p_queue_code text,
  p_from       timestamptz,
  p_minutes    integer
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_found   boolean;
  v_hours   jsonb;
  v_tz      text;
  v_days    integer[];
  v_opens   time;
  v_closes  time;
  v_weekly  numeric;    -- business seconds in any seven consecutive local days
  v_left    numeric;    -- business seconds still to count
  v_weeks   integer;
  v_cursor  timestamp;  -- wall clock of v_tz
  v_day     date;
  v_start   timestamp;
  v_close   timestamp;
  v_avail   numeric;
  v_steps   integer := 0;
begin
  if p_queue_code is null or p_from is null then
    raise exception 'business_deadline: queue and start are required'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_minutes is null then
    return null;  -- no delay (an escalation the policy does not have)
  end if;
  if p_minutes < 0 then
    raise exception 'business_deadline: negative minutes' using errcode = 'invalid_parameter_value';
  end if;

  select true, p.business_hours into v_found, v_hours
    from backoffice.sla_policies p
   where p.queue_code = p_queue_code and p.is_active;
  if v_found is null then
    raise exception 'business_deadline: no active delay policy for this queue'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_hours is null or p_minutes = 0 then
    return p_from + make_interval(mins => p_minutes);  -- calendar time
  end if;

  v_tz     := v_hours ->> 'time_zone';
  v_days   := array(select d::integer
                      from pg_catalog.jsonb_array_elements_text(v_hours -> 'days') d);
  v_opens  := (v_hours ->> 'opens')::time;
  v_closes := (v_hours ->> 'closes')::time;
  v_weekly := extract(epoch from (v_closes - v_opens)) * cardinality(v_days);
  v_left   := p_minutes * 60;
  v_cursor := p_from at time zone v_tz;

  -- whole weeks first: the calendar repeats every seven local days, so any seven of them hold
  -- exactly v_weekly business seconds; what is left is in (0, v_weekly]
  v_weeks  := floor((v_left - 1) / v_weekly)::integer;
  v_cursor := v_cursor + make_interval(days => 7 * v_weeks);
  v_left   := v_left - v_weeks * v_weekly;
  v_day    := v_cursor::date;

  loop
    v_steps := v_steps + 1;
    if v_steps > 16 then  -- at most eight days are needed; never loop on a malformed calendar
      raise exception 'business_deadline: no deadline found' using errcode = 'data_exception';
    end if;
    if extract(isodow from v_day)::integer = any (v_days) then
      v_start := greatest(v_cursor, v_day + v_opens);
      v_close := v_day + v_closes;
      if v_start < v_close then
        v_avail := extract(epoch from (v_close - v_start));
        if v_avail >= v_left then
          return (v_start + make_interval(secs => v_left::double precision)) at time zone v_tz;
        end if;
        v_left := v_left - v_avail;
      end if;
    end if;
    v_day    := v_day + 1;
    v_cursor := v_day::timestamp;
  end loop;
end
$$;

comment on function backoffice.business_deadline(text, timestamptz, integer) is
  'The instant at which p_minutes minutes counted in the business hours of the queue (backoffice.'
  'sla_policies.business_hours: ISO days, opens, closes, wall clock of time_zone, no holidays) have '
  'elapsed from p_from; calendar minutes when business_hours is NULL. Deterministic (no now()): '
  'called ONCE per entry, at its creation (sla_due_at from target_decision_minutes, escalate_at from '
  'sla_due_at and escalate_after_minutes; 04 §5.6, 15 RG38). NULL minutes: NULL. Negative minutes, '
  'unknown or inactive queue: 22023. SECURITY INVOKER: the caller reads sla_policies.';

revoke all on function backoffice.business_deadline(text, timestamptz, integer) from public;

-- 4. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  if not exists (select 1 from backoffice.queues
                  where code = 'profiles_advertiser' and label_key = 'queue.profiles_advertiser'
                    and handled_by_roles = '{agent,admin}'::identity.account_role[]
                    and not allows_bulk_action and has_lock and is_active)
     or not exists (select 1 from backoffice.sla_policies
                     where queue_code = 'profiles_advertiser' and target_claim_minutes = 240
                       and target_decision_minutes = 480 and escalate_after_minutes = 960
                       and business_hours is not null and not is_provisional and is_active) then
    raise exception 'queue profiles_advertiser or its delay is not as 15 RG29 and 06 RG7 say';
  end if;

  if (select count(*) from backoffice.queues)
     <> (select count(*) from backoffice.sla_policies) then
    raise exception 'every queue must have exactly one delay';
  end if;

  if (select value from backoffice.operational_settings where key = 'claim_expiry_minutes')
     is distinct from '30'::jsonb then
    raise exception 'claim_expiry_minutes must start at 30 (15 RG27)';
  end if;

  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'backoffice.operational_settings'::regclass) then
    raise exception 'row level security must be enabled and forced on operational_settings';
  end if;

  -- read by agent and admin only, written by nobody; the function executed by nobody yet
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_any_column_privilege(r.oid, 'backoffice.operational_settings',
                                              'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'backoffice.operational_settings',
                                            'DELETE, TRUNCATE')
          or (r.rolname not in ('influx_agent', 'influx_admin')
              and pg_catalog.has_any_column_privilege(r.oid, 'backoffice.operational_settings',
                                                      'SELECT'))
          or pg_catalog.has_function_privilege(
               r.oid, 'backoffice.business_deadline(text, timestamptz, integer)', 'EXECUTE'));
  if v_bad is not null then
    raise exception 'unexpected right(s) for: %', v_bad;
  end if;

  -- the function itself: Friday 16:00 UTC + 1 business day = Monday 16:00 UTC
  if backoffice.business_deadline('profiles_advertiser', '2026-11-06 16:00:00+00', 480)
     <> '2026-11-09 16:00:00+00'::timestamptz then
    raise exception 'business_deadline does not count the business hours';
  end if;
end
$$;
