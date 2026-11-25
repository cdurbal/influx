-- =============================================================================
-- 0331_search_supply_counters_and_alerts
-- -----------------------------------------------------------------------------
-- Lot 3 / L3G, commit 07 (jalons/l3g/07.md; l3g-fiche.md invariants 9, 3, 8, 12, 15; jalons/l3g/
-- modele.md §6, which PREVAILS for every name; 10 RG2, RG3, RG86, CA60; 15 RG64, RG68, AL22, AL65;
-- D38 Q2). The daily counters of critical mass and the two state alerts that read them: the system
-- PROPOSES the opening of the search, never flips it (RG2: a human decision). Signalled I-4 (03): a
-- SECURITY DEFINER function of the worker and two of the admins, column GRANTs and policies to
-- influx_maintenance_definer and influx_search_admin_definer, two catalogue rows, a periodic task.
--
-- 1. ops.periodic_task + supply_counters (daily, from 00:00 UTC; the pattern of campaign_closure).
-- 2. backoffice.alert_definitions: AL65, the critical mass (CA60, the new code of modele §6), etat,
--    {admin}, {"staleAfterHours": 26}; AL22, the brand searches blocked by k (RG86), etat, {admin}
--    (chef-de-projet is no role), {"blockedShareBp": 2000, "windowDays": 7, "minSearches": 20}
--    (staging hypothesis, modele -7). The thresholds of the opening stay those of
--    search_settings.critical_mass_thresholds (D38 Q2), never copied here.
-- 3. ops.compute_supply_counters(run, attempt), owned by influx_maintenance_definer, EXECUTE for
--    influx_worker only: inside the open supply_counters run of the attempt (55000 otherwise), REPLACES
--    the rows of the UTC day (a replay of the day is idempotent; the other days are never touched):
--    global '*', topic (the main topic), country (the main audience country); published = E1, E3, E4
--    (a published storefront, an active account, the majority attested); searchable = published and
--    E2 (is_searchable). Reads layer A and the account only: never layer I, never search_settings
--    (fiche invariant 9). A failure rolls the call back: the day before stays, and AL65 says so.
-- 4. The readers of the admins, owned by influx_search_admin_definer, EXECUTE for influx_admin only
--    (an active admin in aal2, 42501 otherwise), STABLE, nothing stored (RG64):
--      search.critical_mass_alerts() → (code, cause, observed, threshold, since_at)
--        AL65 counters_stale       no snapshot, or the last one older than staleAfterHours;
--        AL65 thresholds_reached   the search closed, the last global searchable count >=
--                                  publishedProfiles and one topic >= perTopic (CA60);
--        AL65 below_while_open     the search open and the same test failing (10 edge case « passe
--                                  sous le seuil … pendant que la recherche est ouverte »);
--        AL22 k_blocked_share      over windowDays, at least minSearches page-1 searches of the brand
--                                  view served, and more than blockedShareBp of them blocked by k.
--      search.read_supply_counters() → the rows of the last snapshot, and the global row of the 29
--        days before it (the curve, 04 §5.5).
--
-- RIGHTS (03 I-4, signalled): to influx_maintenance_definer, USAGE on search; SELECT (snapshot_on),
-- INSERT of every column and DELETE on search.supply_counters bounded to the UTC day; SELECT
-- (account_id, status, is_searchable, primary_topic_code, main_audience_country) of
-- profiles.creator_public_profiles bounded to the published storefronts; SELECT (is_adult_attested)
-- of identity.accounts (its policy of 0117). To influx_search_admin_definer, SELECT of every column of
-- search.supply_counters and a policy on backoffice.alert_definitions for AL22 and AL65. EXECUTE on
-- the worker's function to influx_worker, on the two readers to influx_admin. NOTHING to a member,
-- to an agent, nor to the owners of the brand or agent doors; nobody writes is_open_to_advertisers
-- here.
--
-- Not here: the route and its contract (L3G-10: GET /v1/bo/alerts, GET /v1/bo/settings/search), the
-- screen (L3G-13), the writers of the settings under a peer's control (0332), AL21 of the internal
-- accounts (Lot 5), the purge of the counters (Lot 6).
--
-- EC-L3G-07 (micro-gaps, the safest choice):
--   EC-L3G-07-1  « global >= publishedProfiles et une thématique >= perTopic » (modele §6) is read on
--                the SEARCHABLE counts: « publiés et visibles » (10 RG2) is what a brand would see;
--                searchable <= published, so the alert never proposes more than the search serves.
--   EC-L3G-07-2  a profile without a main topic or a main audience country counts in global only.
--   EC-L3G-07-3  a threshold absent, not a whole number >= 1 (minSearches, windowDays,
--                staleAfterHours, the two of critical_mass_thresholds) or a share outside 0..10000
--                silences its cause, never an error on a read (EC-L3E-10-3); an inactive row answers
--                nothing for its code.
--   EC-L3G-07-4  « > 20 % » (15 AL22) is strict; the observed share is in basis points, rounded down.
--   EC-L3G-07-5  counters_stale: observed = the whole hours since the last computation (NULL when
--                there is none), threshold = staleAfterHours, since_at = that computation.
--   EC-L3G-07-6  the counters land in ops.periodic_runs.counts as written (the rows of the day);
--                no register line of their own: the elevated line of the run carries the effect.
--
-- ROLLBACK (the counters are derived, nothing to migrate): drop function ops.compute_supply_counters,
-- search.critical_mass_alerts, search.read_supply_counters; drop the policies
-- supply_counters_maintenance_definer_*, creator_public_profiles_maintenance_definer_select,
-- supply_counters_search_admin_definer_select, alert_definitions_search_admin_definer_mass_select and
-- revoke their grants; revoke usage on schema search from influx_maintenance_definer; delete AL22 and
-- AL65 from backoffice.alert_definitions. The value supply_counters of ops.periodic_task stays.
-- =============================================================================

-- 1. The periodic task (modele §6) ----------------------------------------------------------------

alter type ops.periodic_task add value if not exists 'supply_counters';

comment on type ops.periodic_task is
  'E-4 tasks of maintenance.run_periodic (0117): brevo_reconciliation (daily), auth_orphan_purge '
  '(hourly), brevo_inbound_purge (daily), data_export_purge (hourly, 0136 and 0137), ops_retention '
  '(daily, 0147), storage_purge (hourly, 0205, 0223: the objects of Storage of the purging rows), '
  'verification_expiry (hourly, 0223: the draft requests whose code expired), badge_lifecycle '
  '(daily, 0230: the reminder, the expiry of the badges and the retention of their findings), '
  'campaign_closure (daily, 0309: the campaigns closed at the end of their period + '
  'campaign_auto_close_days, 09 RG9), supply_counters (daily, 0331: the counters of critical mass, '
  '10 RG2, D38). A new task is a migration.';

-- 2. The catalogue (15 RG68; modele §6) -------------------------------------------------------------

insert into backoffice.alert_definitions
  (code, label_key, nature, threshold_value, recipient_roles, source_document)
values
  ('AL22', 'alert.AL22', 'etat',
   '{"blockedShareBp": 2000, "windowDays": 7, "minSearches": 20}',
   '{admin}', '10 RG86; 15 AL22; D38'),
  ('AL65', 'alert.AL65', 'etat',
   '{"staleAfterHours": 26}',
   '{admin}', '10 RG2, CA60; 15 AL65; D38 Q2')
on conflict (code) do nothing;

-- 3. The daily counters, as influx_maintenance_definer (modele §6; 10 RG2) ---------------------------

-- 3.1 Its rights: today's rows of the counters; the published storefronts (layer A) and their account
grant usage on schema search to influx_maintenance_definer;

grant select (snapshot_on),
      insert (snapshot_on, dimension, dimension_value, published_profiles_count,
              searchable_profiles_count, computed_at),
      delete
   on search.supply_counters to influx_maintenance_definer;

drop policy if exists supply_counters_maintenance_definer_select on search.supply_counters;
create policy supply_counters_maintenance_definer_select on search.supply_counters
  for select to influx_maintenance_definer
  using (snapshot_on = (pg_catalog.timezone('UTC', pg_catalog.now()))::date);
drop policy if exists supply_counters_maintenance_definer_insert on search.supply_counters;
create policy supply_counters_maintenance_definer_insert on search.supply_counters
  for insert to influx_maintenance_definer
  with check (snapshot_on = (pg_catalog.timezone('UTC', pg_catalog.now()))::date);
drop policy if exists supply_counters_maintenance_definer_delete on search.supply_counters;
create policy supply_counters_maintenance_definer_delete on search.supply_counters
  for delete to influx_maintenance_definer
  using (snapshot_on = (pg_catalog.timezone('UTC', pg_catalog.now()))::date);

grant select (account_id, status, is_searchable, primary_topic_code, main_audience_country)
   on profiles.creator_public_profiles to influx_maintenance_definer;
drop policy if exists creator_public_profiles_maintenance_definer_select
  on profiles.creator_public_profiles;
create policy creator_public_profiles_maintenance_definer_select on profiles.creator_public_profiles
  for select to influx_maintenance_definer
  using (status = 'published');

-- E4: the attestation of the account (its rows already read under accounts_maintenance_definer_select)
grant select (is_adult_attested) on identity.accounts to influx_maintenance_definer;

-- 3.2 The function
do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;
set role influx_maintenance_definer;

create or replace function ops.compute_supply_counters(
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
  v_today  date := (pg_catalog.timezone('UTC', pg_catalog.now()))::date;
  v_count  integer;
begin
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code::text = 'supply_counters') then
    raise exception 'no open supply_counters run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- a replay of the day replaces the day; the days before are never touched (the curve, 04 §5.5)
  delete from search.supply_counters c where c.snapshot_on = v_today;

  with published as (
    -- E1 published, E3 an active account, E4 the majority attested; searchable adds E2 (modele §6)
    select p.primary_topic_code as topic,
           p.main_audience_country::text as country,
           p.is_searchable as searchable
      from profiles.creator_public_profiles p
      join identity.accounts a on a.id = p.account_id
     where p.status = 'published'
       and a.status = 'active'
       and a.is_adult_attested
  ), counted as (
    select 'global'::text as dimension, '*'::text as dimension_value,
           (count(*))::integer as published_count,
           (count(*) filter (where u.searchable))::integer as searchable_count
      from published u
    union all
    select 'topic', u.topic, (count(*))::integer,
           (count(*) filter (where u.searchable))::integer
      from published u
     where u.topic is not null
     group by u.topic
    union all
    select 'country', u.country, (count(*))::integer,
           (count(*) filter (where u.searchable))::integer
      from published u
     where u.country is not null
     group by u.country
  )
  insert into search.supply_counters
    (snapshot_on, dimension, dimension_value, published_profiles_count, searchable_profiles_count,
     computed_at)
  select v_today, c.dimension, c.dimension_value, c.published_count, c.searchable_count,
         pg_catalog.now()
    from counted c;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

comment on function ops.compute_supply_counters(uuid, smallint) is
  '10 RG2, D38; l3g/modele.md §6 (0331): inside the open supply_counters run of the attempt (55000 '
  'otherwise), replaces the rows of the UTC day of search.supply_counters: global *, topic (the main '
  'topic), country (the main audience country); published = a published storefront of an active, '
  'majority-attested account (E1, E3, E4); searchable = published and is_searchable (E2). The days '
  'before are never touched; a failure leaves the day before. Never search_settings nor layer I: it '
  'proposes, a human opens (RG2). Returns the rows written. SECURITY DEFINER owned by '
  'influx_maintenance_definer; EXECUTE for influx_worker only.';

revoke all on function ops.compute_supply_counters(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function ops.compute_supply_counters(uuid, smallint) to influx_worker;

reset role;
revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 4. The readers of the admins, as influx_search_admin_definer (modele §6) ---------------------------

-- 4.1 Its rights: the counters, the rows AL22 and AL65 (the columns of 0321); the journal, the
-- settings and the caller are already read (0316, 0321, 0326, 0328)
grant select (snapshot_on, dimension, dimension_value, published_profiles_count,
              searchable_profiles_count, computed_at)
   on search.supply_counters to influx_search_admin_definer;
drop policy if exists supply_counters_search_admin_definer_select on search.supply_counters;
create policy supply_counters_search_admin_definer_select on search.supply_counters
  for select to influx_search_admin_definer using (true);

drop policy if exists alert_definitions_search_admin_definer_mass_select
  on backoffice.alert_definitions;
create policy alert_definitions_search_admin_definer_mass_select on backoffice.alert_definitions
  for select to influx_search_admin_definer using (code in ('AL22', 'AL65'));

-- 4.2 The functions
do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_search_admin_definer', current_user);
end
$$;
grant create on schema search to influx_search_admin_definer;
set role influx_search_admin_definer;

create or replace function search.critical_mass_alerts()
returns table (
  code       text,
  cause      text,
  observed   integer,
  threshold  integer,
  since_at   timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_al65          boolean := false;
  v_stale_hours   numeric;
  v_al22          boolean := false;
  v_share_bp      numeric;
  v_window_days   numeric;
  v_min_searches  numeric;
  v_open          boolean;
  v_min_global    numeric;
  v_per_topic     numeric;
  v_day           date;
  v_global        integer;
  v_computed      timestamptz;
  v_topics        integer;
  v_reached       boolean;
  v_total         integer;
  v_blocked       integer;
  v_since         timestamptz;
begin
  perform search.require_search_admin();

  -- the thresholds in table; a value that is not a whole number >= 1 silences its cause (EC-L3G-07-3)
  select true,
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'staleAfterHours') = 'number'
               and (d.threshold_value ->> 'staleAfterHours')::numeric >= 1
               and (d.threshold_value ->> 'staleAfterHours')::numeric
                     = pg_catalog.floor((d.threshold_value ->> 'staleAfterHours')::numeric)
              then (d.threshold_value ->> 'staleAfterHours')::numeric end
    into v_al65, v_stale_hours
    from backoffice.alert_definitions d
   where d.code = 'AL65' and d.is_active;

  select true,
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'blockedShareBp') = 'number'
               and (d.threshold_value ->> 'blockedShareBp')::numeric between 0 and 10000
              then (d.threshold_value ->> 'blockedShareBp')::numeric end,
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'windowDays') = 'number'
               and (d.threshold_value ->> 'windowDays')::numeric between 1 and 366
               and (d.threshold_value ->> 'windowDays')::numeric
                     = pg_catalog.floor((d.threshold_value ->> 'windowDays')::numeric)
              then (d.threshold_value ->> 'windowDays')::numeric end,
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'minSearches') = 'number'
               and (d.threshold_value ->> 'minSearches')::numeric >= 1
               and (d.threshold_value ->> 'minSearches')::numeric
                     = pg_catalog.floor((d.threshold_value ->> 'minSearches')::numeric)
              then (d.threshold_value ->> 'minSearches')::numeric end
    into v_al22, v_share_bp, v_window_days, v_min_searches
    from backoffice.alert_definitions d
   where d.code = 'AL22' and d.is_active;

  if coalesce(v_al65, false) then
    -- the switch and the thresholds of the opening: search_settings alone (D38 Q2)
    select case when pg_catalog.jsonb_typeof(s.value) = 'boolean' then (s.value)::text::boolean end
      into v_open
      from search.search_settings s where s.key = 'is_open_to_advertisers';
    select case when pg_catalog.jsonb_typeof(s.value -> 'publishedProfiles') = 'number'
                 and (s.value ->> 'publishedProfiles')::numeric >= 1
                then (s.value ->> 'publishedProfiles')::numeric end,
           case when pg_catalog.jsonb_typeof(s.value -> 'perTopic') = 'number'
                 and (s.value ->> 'perTopic')::numeric >= 1
                then (s.value ->> 'perTopic')::numeric end
      into v_min_global, v_per_topic
      from search.search_settings s where s.key = 'critical_mass_thresholds';

    -- the last snapshot: a failed day leaves the one before, read and said stale
    select c.snapshot_on, c.searchable_profiles_count, c.computed_at
      into v_day, v_global, v_computed
      from search.supply_counters c
     where c.dimension = 'global'
     order by c.snapshot_on desc
     limit 1;

    if v_stale_hours is not null
       and (v_computed is null
            or v_computed < pg_catalog.now() - v_stale_hours * interval '1 hour') then
      code := 'AL65';
      cause := 'counters_stale';
      observed := case when v_computed is not null
                       then pg_catalog.floor(extract(epoch from pg_catalog.now() - v_computed)
                                             / 3600)::integer end;
      threshold := v_stale_hours::integer;
      since_at := v_computed;
      return next;
    end if;

    if v_day is not null and v_open is not null and v_min_global is not null
       and v_per_topic is not null then
      select (count(*))::integer into v_topics
        from search.supply_counters c
       where c.snapshot_on = v_day
         and c.dimension = 'topic'
         and c.searchable_profiles_count >= v_per_topic;
      v_reached := v_global >= v_min_global and v_topics >= 1;
      if v_reached and not v_open then
        code := 'AL65';
        cause := 'thresholds_reached';
        observed := v_global;
        threshold := v_min_global::integer;
        since_at := v_computed;
        return next;
      elsif v_open and not v_reached then
        code := 'AL65';
        cause := 'below_while_open';
        observed := v_global;
        threshold := v_min_global::integer;
        since_at := v_computed;
        return next;
      end if;
    end if;
  end if;

  if coalesce(v_al22, false) and v_share_bp is not null and v_window_days is not null
     and v_min_searches is not null then
    -- the brand view, page 1, served: a k block is only ever served there (0316 outcome_coherent)
    select (count(*))::integer,
           (count(*) filter (where q.blocked_by_k_anonymity))::integer,
           min(q.created_at)
      into v_total, v_blocked, v_since
      from search.search_queries q
     where q.created_at > pg_catalog.now() - v_window_days * interval '1 day'
       and q.view_mode = 'advertiser_anonymous'
       and q.outcome = 'served'
       and q.page_reached = 1;
    if v_total >= v_min_searches and v_blocked::numeric * 10000 > v_share_bp * v_total then
      code := 'AL22';
      cause := 'k_blocked_share';
      observed := ((v_blocked::bigint * 10000) / v_total)::integer;
      threshold := v_share_bp::integer;
      since_at := v_since;
      return next;
    end if;
  end if;
end
$$;

comment on function search.critical_mass_alerts() is
  '15 AL65, AL22 (10 RG2, RG86, CA60; l3g/modele.md §6; 0331): the state alerts of the critical mass, '
  'one row per code and cause: AL65 counters_stale (no snapshot, or the last older than '
  'staleAfterHours), thresholds_reached (the search closed, the last global searchable count >= '
  'critical_mass_thresholds.publishedProfiles and one topic >= perTopic), below_while_open (the '
  'search open and that test failing); AL22 k_blocked_share (over windowDays, at least minSearches '
  'page-1 searches of the brand view served, more than blockedShareBp of them blocked by k). '
  'observed, threshold, since_at; never an account, a filter nor a creator. It proposes, never opens '
  '(RG2). STABLE SECURITY DEFINER owned by influx_search_admin_definer, EXECUTE for influx_admin '
  'only; 42501 outside an active admin in aal2. Nothing stored.';

revoke all on function search.critical_mass_alerts()
  from public, anon, authenticated, service_role;
grant execute on function search.critical_mass_alerts() to influx_admin;

create or replace function search.read_supply_counters()
returns table (
  snapshot_on                date,
  dimension                  text,
  dimension_value            text,
  published_profiles_count   integer,
  searchable_profiles_count  integer,
  computed_at                timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day  date;
begin
  perform search.require_search_admin();

  select max(c.snapshot_on) into v_day from search.supply_counters c;
  if v_day is null then
    return;
  end if;

  -- the last snapshot whole, and the global curve of the 29 days before it
  return query
  select c.snapshot_on, c.dimension, c.dimension_value, c.published_profiles_count,
         c.searchable_profiles_count, c.computed_at
    from search.supply_counters c
   where c.snapshot_on = v_day
      or (c.dimension = 'global' and c.snapshot_on >= v_day - 29 and c.snapshot_on < v_day)
   order by c.snapshot_on desc, c.dimension, c.dimension_value;
end
$$;

comment on function search.read_supply_counters() is
  '04 §5.5, 10 RG2 (l3g/modele.md §6; 0331): the counters of critical mass for the settings screen: '
  'every row of the last snapshot (global, topic, country) and the global row of the 29 days before '
  'it, newest first. STABLE SECURITY DEFINER owned by influx_search_admin_definer, EXECUTE for '
  'influx_admin only; 42501 outside an active admin in aal2.';

revoke all on function search.read_supply_counters()
  from public, anon, authenticated, service_role;
grant execute on function search.read_supply_counters() to influx_admin;

reset role;
revoke create on schema search from influx_search_admin_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_search_admin_definer', current_user);
end
$$;

-- 5. End-state assertions (03 P7; fiche invariants 3, 9) ------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  v_def  record;
  v_bad  text;
begin
  -- owner, mode, volatility, empty search_path, static SQL, EXECUTE for their callers only
  for v_def in
    select * from (values
      ('ops.compute_supply_counters(uuid, smallint)', 'influx_maintenance_definer', 'v',
       'influx_worker'),
      ('search.critical_mass_alerts()', 'influx_search_admin_definer', 's', 'influx_admin'),
      ('search.read_supply_counters()', 'influx_search_admin_definer', 's', 'influx_admin')
    ) as d (fn, owner, volatility, caller)
  loop
    if (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
         where p.oid = v_def.fn::regprocedure) <> v_def.owner
       or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_def.fn::regprocedure)
       or (select p.provolatile::text from pg_catalog.pg_proc p
            where p.oid = v_def.fn::regprocedure) <> v_def.volatility
       or (select p.proconfig from pg_catalog.pg_proc p where p.oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""']
       or (select p.prosrc ~* c_dynamic from pg_catalog.pg_proc p
            where p.oid = v_def.fn::regprocedure) then
      raise exception '% must be SECURITY DEFINER, owned by %, empty search_path, static',
        v_def.fn, v_def.owner;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> v_def.caller);
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
    if not pg_catalog.has_function_privilege(v_def.caller, v_def.fn::regprocedure, 'EXECUTE') then
      raise exception '% is not executable by %', v_def.fn, v_def.caller;
    end if;
  end loop;

  -- fiche invariant 9 and the stop of 07.md: the counters read neither layer I nor the settings
  if (select p.prosrc ~* 'search_settings|creator_identities|creator_social_accounts|creator_audience|leads\s*\.|matching\s*\.'
        from pg_catalog.pg_proc p
       where p.oid = 'ops.compute_supply_counters(uuid, smallint)'::regprocedure) then
    raise exception 'ops.compute_supply_counters() reads beyond layer A and the account';
  end if;

  -- RG2: is_open_to_advertisers stays a human decision; nobody of 0331 writes the settings
  select string_agg(r, ', ') into v_bad
    from unnest(array['influx_maintenance_definer', 'influx_worker']) r
   where pg_catalog.has_table_privilege(r, 'search.search_settings', 'INSERT, UPDATE, DELETE, TRUNCATE')
      or pg_catalog.has_any_column_privilege(r, 'search.search_settings', 'SELECT, INSERT, UPDATE');
  if v_bad is not null then
    raise exception 'search.search_settings reached by: %', v_bad;
  end if;

  -- the readers write nothing of the counters; no member right on them (0316)
  if pg_catalog.has_table_privilege('influx_search_admin_definer', 'search.supply_counters',
                                    'INSERT, UPDATE, DELETE, TRUNCATE')
     or pg_catalog.has_any_column_privilege('influx_search_admin_definer', 'search.supply_counters',
                                            'INSERT, UPDATE') then
    raise exception 'influx_search_admin_definer writes search.supply_counters';
  end if;
  if exists (select 1
               from unnest(array['influx_advertiser', 'influx_creator', 'influx_agent',
                                 'influx_admin', 'influx_worker']) r
              where pg_catalog.has_any_column_privilege(r, 'search.supply_counters',
                                                        'SELECT, INSERT, UPDATE, REFERENCES')
                 or pg_catalog.has_table_privilege(r, 'search.supply_counters',
                                                   'DELETE, TRUNCATE, TRIGGER')) then
    raise exception 'search.supply_counters: no right to an execution role (0316)';
  end if;

  -- the owners keep no CREATE nor member
  if pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_search_admin_definer', 'search', 'CREATE')
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid in ('influx_maintenance_definer'::regrole,
                                    'influx_search_admin_definer'::regrole)
                   and (m.inherit_option or m.set_option)) then
    raise exception 'an owner of 0331 left with a member or CREATE (03 P7)';
  end if;

  if not exists (select 1 from pg_catalog.pg_enum
                  where enumtypid = 'ops.periodic_task'::regtype
                    and enumlabel = 'supply_counters') then
    raise exception 'ops.periodic_task lacks supply_counters';
  end if;
  if (select count(*) from backoffice.alert_definitions
       where code in ('AL22', 'AL65') and nature = 'etat' and recipient_roles = '{admin}'::text[])
       <> 2 then
    raise exception 'AL22 and AL65 must be loaded as state alerts for the admins';
  end if;
end
$$;
