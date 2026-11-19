-- =============================================================================
-- 0321_search_creator_search_volume_alert
-- -----------------------------------------------------------------------------
-- Lot 3 / L3E, commit 10 (jalons/l3e/10.md; l3e-fiche.md invariants 9, 10, 12, 15, 16;
-- jalons/l3e/modele.md §10, which PREVAILS for every name; 03 I-9; 10 RG68, CA44; 15 AL21).
-- AL21, « volume anormal de profils servis » (I-9): the alert catalogue row and the function the
-- backoffice reads at every GET /v1/bo/alerts. A STATE alert (15 RG64): derived from the journal at
-- each read, never stored, never classified, no sanction (RG65), nothing to Brevo nor Apollo (RG70).
-- Signalled I-4 (03): GRANTs and policies to influx_search_admin_definer, one SECURITY DEFINER
-- function, one catalogue row.
--
-- 1. backoffice.alert_definitions: AL21, nature etat (derived until 0406, modele §10), recipients
--    {admin}, threshold {"distinct_profiles_served_24h": 150, "rate_cap_share_bp": 8000} (the
--    starting values of staging, to be set by the founder before production: modele §10 hypothesis).
-- 2. search.creator_search_volume_alerts() (modele §10): STABLE SECURITY DEFINER, empty search_path,
--    owned by influx_search_admin_definer, EXECUTE for influx_admin only (an active admin in aal2 is
--    checked inside, 42501 otherwise). It reads its thresholds in the table (AL21, active) and the
--    caps of rate_limits (perHour, perDay) and answers one row per account and cause over the
--    journal (RG50: the accounts of the agents and of the admins count as the brands'):
--      distinct_profiles_served  more than the threshold of DISTINCT creators served over 24 sliding
--                                hours (observed = their number, since = the oldest line);
--      rate_cap_share_hour       the searches of the last hour reach rate_cap_share_bp of perHour;
--      rate_cap_share_day        the same over 24 hours against perDay (RG68 « 80 % d'un plafond »);
--      rate_limited              a refusal (429) is journalled in the last 24 hours.
--    Never a filter, never a creator: the account, the cause, a count and the date of the oldest
--    line behind it. The alert falls by itself when the window leaves the lines behind (RG64).
--
-- RIGHTS (03 I-4, signalled): to influx_search_admin_definer, column GRANTs and their policies on
-- search.search_queries (id, account_id, outcome, created_at), search.search_impressions
-- (search_query_id, creator_account_id), backoffice.alert_definitions (code, threshold_value,
-- is_active; the row AL21 only), USAGE on schema backoffice; a partial CREATE on schema search for
-- the time of the function only. EXECUTE on the function for influx_admin alone. No write, nothing
-- to a member, an agent nor the Data API roles.
--
-- Not here: the route and its contract (apps/api), the internal alerts of the Lot 5 (AL22, AL23, the
-- other alerts of RG68: aspiration, refinement, systematic pagination: they read the opening and the
-- selections of L3F), the purge (Lot 6).
--
-- EC-L3E-10 (micro-gaps, the safest choice):
--   EC-L3E-10-1  « rate_cap_share » of modele §10 is split by window into two causes of the contract
--                (rate_cap_share_hour, rate_cap_share_day): the alert words the window without a
--                second column; « atteint 80 % » (fiche) is read >=, and at least one search.
--   EC-L3E-10-2  an index on search_queries (created_at): the 24-hour window is read without an
--                account (every account), the existing indexes lead with the account.
--   EC-L3E-10-3  a threshold that is absent, not a number or negative silences its cause (never an
--                error on a read of the home screen); no AL21 row, or inactive, answers nothing.
--
-- ROLLBACK (the alert is derived, nothing to migrate): drop function
-- search.creator_search_volume_alerts(); drop the policies *_search_admin_definer_alert_* and
-- revoke their grants; revoke usage on schema backoffice from influx_search_admin_definer; drop index
-- search_queries_created_idx; delete the row AL21 of backoffice.alert_definitions.
-- =============================================================================

-- 1. The catalogue -----------------------------------------------------------------------------------

insert into backoffice.alert_definitions
  (code, label_key, nature, threshold_value, recipient_roles, source_document)
values
  ('AL21', 'alert.AL21', 'etat',
   '{"distinct_profiles_served_24h": 150, "rate_cap_share_bp": 8000}',
   '{admin}', '10 RG68, CA44; 15 AL21; 03 I-9')
on conflict (code) do nothing;

-- 2. What the owner reads (each right with its policy) -------------------------------------------------

create index if not exists search_queries_created_idx on search.search_queries (created_at);

grant usage on schema backoffice to influx_search_admin_definer;

grant select (code, threshold_value, is_active)
   on backoffice.alert_definitions to influx_search_admin_definer;
drop policy if exists alert_definitions_search_admin_definer_alert_select
  on backoffice.alert_definitions;
create policy alert_definitions_search_admin_definer_alert_select on backoffice.alert_definitions
  for select to influx_search_admin_definer using (code = 'AL21');

grant select (id, account_id, outcome, created_at) on search.search_queries
   to influx_search_admin_definer;
drop policy if exists search_queries_search_admin_definer_alert_select on search.search_queries;
create policy search_queries_search_admin_definer_alert_select on search.search_queries
  for select to influx_search_admin_definer using (true);

grant select (search_query_id, creator_account_id) on search.search_impressions
   to influx_search_admin_definer;
drop policy if exists search_impressions_search_admin_definer_alert_select
  on search.search_impressions;
create policy search_impressions_search_admin_definer_alert_select on search.search_impressions
  for select to influx_search_admin_definer using (true);

-- 3. The function, as influx_search_admin_definer (03 P7 rule 5) -----------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_search_admin_definer', current_user);
end
$$;
grant create on schema search to influx_search_admin_definer;
set role influx_search_admin_definer;

create or replace function search.creator_search_volume_alerts()
returns table (
  subject_account_id  uuid,
  cause               text,
  observed            integer,
  since_at            timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_max_distinct  numeric;
  v_share_bp      numeric;
  v_per_hour      numeric;
  v_per_day       numeric;
begin
  perform search.require_search_admin();

  -- the threshold in table (AL21, active); a value that is not a non-negative number is silent
  select case when pg_catalog.jsonb_typeof(d.threshold_value -> 'distinct_profiles_served_24h') = 'number'
               and (d.threshold_value ->> 'distinct_profiles_served_24h')::numeric >= 0
              then (d.threshold_value ->> 'distinct_profiles_served_24h')::numeric end,
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'rate_cap_share_bp') = 'number'
               and (d.threshold_value ->> 'rate_cap_share_bp')::numeric >= 0
              then (d.threshold_value ->> 'rate_cap_share_bp')::numeric end
    into v_max_distinct, v_share_bp
    from backoffice.alert_definitions d
   where d.code = 'AL21' and d.is_active;
  if not found then
    return;
  end if;

  -- the caps of the search (modele §8), whose share the alert watches
  select case when pg_catalog.jsonb_typeof(s.value -> 'perHour') = 'number'
              then (s.value ->> 'perHour')::numeric end,
         case when pg_catalog.jsonb_typeof(s.value -> 'perDay') = 'number'
              then (s.value ->> 'perDay')::numeric end
    into v_per_hour, v_per_day
    from search.search_settings s
   where s.key = 'rate_limits';

  return query
  with lines as (
    select q.id, q.account_id, q.outcome, q.created_at
      from search.search_queries q
     where q.created_at > pg_catalog.now() - interval '24 hours'
  ), counted as (
    -- the lines a cap counts (a page is a search; a refusal never counts, modele §8)
    select l.account_id,
           (count(*) filter (where l.created_at > pg_catalog.now() - interval '1 hour'))::integer
             as in_hour,
           (count(*))::integer as in_day,
           min(l.created_at) filter (where l.created_at > pg_catalog.now() - interval '1 hour')
             as hour_since,
           min(l.created_at) as day_since
      from lines l
     where l.outcome <> 'rate_limited'
     group by l.account_id
  ), distinct_served as (
    select l.account_id,
           (count(distinct i.creator_account_id))::integer as profiles,
           min(l.created_at) as since_at
      from lines l
      join search.search_impressions i on i.search_query_id = l.id
     group by l.account_id
  ), refused as (
    select l.account_id, (count(*))::integer as refusals, min(l.created_at) as since_at
      from lines l
     where l.outcome = 'rate_limited'
     group by l.account_id
  )
  select d.account_id, 'distinct_profiles_served'::text, d.profiles, d.since_at
    from distinct_served d
   where v_max_distinct is not null and d.profiles > v_max_distinct
  union all
  select c.account_id, 'rate_cap_share_hour'::text, c.in_hour, c.hour_since
    from counted c
   where v_share_bp is not null and v_per_hour is not null and v_per_hour > 0
     and c.in_hour >= 1 and c.in_hour * 10000 >= v_share_bp * v_per_hour
  union all
  select c.account_id, 'rate_cap_share_day'::text, c.in_day, c.day_since
    from counted c
   where v_share_bp is not null and v_per_day is not null and v_per_day > 0
     and c.in_day >= 1 and c.in_day * 10000 >= v_share_bp * v_per_day
  union all
  select r.account_id, 'rate_limited'::text, r.refusals, r.since_at
    from refused r
  order by 1, 2;
end
$$;

comment on function search.creator_search_volume_alerts() is
  '15 AL21 (I-9; 10 RG68; l3e/modele.md §10; 0321): the accounts whose creators served over 24 '
  'sliding hours exceed distinct_profiles_served_24h (AL21 threshold, in table), whose searches of '
  'the last hour or day reach rate_cap_share_bp of perHour or perDay (search_settings.rate_limits), '
  'or who were refused in the last 24 hours: one row per account and cause (distinct_profiles_served, '
  'rate_cap_share_hour, rate_cap_share_day, rate_limited), a count and the oldest line. Never a '
  'filter nor a creator. STABLE SECURITY DEFINER owned by influx_search_admin_definer, EXECUTE for '
  'influx_admin only; 42501 outside an active admin in aal2. A state alert: nothing stored.';

revoke all on function search.creator_search_volume_alerts()
  from public, anon, authenticated, service_role;
grant execute on function search.creator_search_volume_alerts() to influx_admin;

reset role;
revoke create on schema search from influx_search_admin_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_search_admin_definer', current_user);
end
$$;

-- 4. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  c_owner  constant text := 'influx_search_admin_definer';
  c_fn     constant regprocedure := 'search.creator_search_volume_alerts()'::regprocedure;
  v_bad    text;
begin
  if (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p where p.oid = c_fn)
       is distinct from c_owner
     or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = c_fn)
     or (select p.provolatile from pg_catalog.pg_proc p where p.oid = c_fn) <> 's'
     or (select p.proconfig from pg_catalog.pg_proc p where p.oid = c_fn)
          is distinct from array['search_path=""'] then
    raise exception 'creator_search_volume_alerts() must be STABLE SECURITY DEFINER, owned by %, empty search_path', c_owner;
  end if;
  if (select p.prosrc ~* '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml|ts_stat|ts_rewrite|dblink'
        from pg_catalog.pg_proc p where p.oid = c_fn) then
    raise exception 'L2DS-5: dynamic SQL in creator_search_volume_alerts()';
  end if;

  -- EXECUTE: the owner and influx_admin, nobody else (not PUBLIC)
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_admin');
  if v_bad is not null then
    raise exception 'creator_search_volume_alerts() executable by: %', v_bad;
  end if;
  if not pg_catalog.has_function_privilege('influx_admin', c_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_agent', c_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_advertiser', c_fn, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_creator', c_fn, 'EXECUTE') then
    raise exception 'creator_search_volume_alerts() is executed by influx_admin alone';
  end if;

  -- the owner reads the journal and the alert row, writes nothing it did not write before
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p') and c.oid in ('search.search_queries'::regclass,
                                               'search.search_impressions'::regclass,
                                               'backoffice.alert_definitions'::regclass)
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'influx_search_admin_definer writes a table of AL21: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE')
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option)) then
    raise exception 'influx_search_admin_definer left with a member or CREATE';
  end if;

  -- no member right on a table of search (03 I-4), no search function to the agent nor the members
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'search'::regnamespace
     and pg_catalog.has_function_privilege('influx_admin', p.oid, 'EXECUTE')
     and p.oid not in ('search.write_search_setting(text, jsonb)'::regprocedure,
                       'search.write_facet_setting(text, boolean, integer, text)'::regprocedure,
                       c_fn);
  if v_bad is not null then
    raise exception 'influx_admin executes a function of search beyond its three: %', v_bad;
  end if;
  if not exists (select 1 from backoffice.alert_definitions
                  where code = 'AL21' and nature = 'etat' and recipient_roles = array['admin']) then
    raise exception 'AL21 is missing from the alert catalogue';
  end if;
end
$$;
