-- =============================================================================
-- 0326_search_abuse_alerts
-- -----------------------------------------------------------------------------
-- Lot 3 / L3F, commit 06 (jalons/l3f/06.md; l3f-fiche.md invariants 4, 9; jalons/l3f/modele.md §7,
-- which PREVAILS for every name; 10 RG63, RG68, CA45, CA46; 15 RG68, AL21; 03 I-9). The refinement
-- (CA45) and the scraping (CA46) of the anonymous directory become two causes of AL21, and the
-- openings of a profile (0323) count in its volume. Still a STATE alert (15 RG64): derived from the
-- journal at each read, never stored, never classified, no sanction (RG65), nothing to Brevo nor
-- Apollo (RG70). Signalled I-4 (03): GRANTs and policies to influx_search_admin_definer, one SECURITY
-- DEFINER function recreated, the catalogue row AL21 completed.
--
-- 1. backoffice.alert_definitions AL21: three thresholds ADDED, never overwriting a value already
--    there (an existing key wins): refinement_searches 6, refinement_blocked 2,
--    aspiration_profiles_24h 150 (the hypotheses of staging, annexe; to be set by the founder before
--    production with L3ES-3).
-- 2. search.creator_search_volume_alerts() recreated at the same signature and owner (modele §7):
--      distinct_profiles_served  the DISTINCT creators served over 24 h, by an impression OR an opening;
--      rate_cap_share_hour/day   unchanged (the searches against perHour, perDay);
--      open_cap_share_day        the openings served over 24 h reach rate_cap_share_bp of
--                                profileOpensPerDay (RG63 « alerte interne à 80 % du plafond »);
--      rate_limited              a refusal of a search OR of an opening in the last 24 h;
--      refinement (CA45)         the refinement_searches last NEW searches of the account (served,
--                                page 1, 24 h), each successive pair differing by ONE facet exactly
--                                (the sort and the campaign ignored), at least refinement_blocked of
--                                them below k: observed = their number, since = the first of them;
--      aspiration (CA46, L3ES-3) the accounts that opened profiles over 24 h without adding a creator
--                                to a shortlist nor asking for a selection over 24 h: when the DISTINCT
--                                creators they opened, all together, reach aspiration_profiles_24h,
--                                one row per such account (observed = that number, since = the
--                                oldest opening of the account). One account alone is capped at
--                                profileOpensPerDay: open_cap_share_day covers it (modele -6).
--    Never a filter, an alias nor a creator: the account, the cause, a count and a date.
--
-- RIGHTS (03 I-4, signalled): to influx_search_admin_definer, column GRANTs with their policies on
-- search.search_queries (+ filters, page_reached, blocked_by_k_anonymity: read inside, never served),
-- search.profile_openings (account_id, outcome, creator_account_id, created_at), search.shortlists
-- (id, advertiser_account_id), search.shortlist_items (shortlist_id, added_at),
-- search.selection_requests (advertiser_account_id, created_at); a partial CREATE on schema search for
-- the time of the function only. EXECUTE unchanged (influx_admin alone). No write, nothing to a
-- member, an agent nor the Data API roles; never a note, a name, a message nor a campaign.
--
-- Not here: AL22, AL23 (L3G), the systematic pagination of RG68 (not in modele §7), the doors of the
-- search and of the profile (unchanged), the purge (Lot 6).
--
-- EC-L3F-06 (micro-gaps, the safest choice):
--   EC-L3F-06-1  « dépassent » (modele §7) against CA46 « ayant ouvert 150 profils … alors levée »:
--                the aspiration raises when the threshold is REACHED (>=), the acceptance criterion
--                kept, as open_cap_share_day (>=).
--   EC-L3F-06-2  a pair of identical searches differs by no facet: it breaks the series (« ne variant
--                que d'un filtre » is exactly one); a facet is a top-level key of the filters, a change
--                inside its value (F6 country or share) is one facet.
--   EC-L3F-06-3  refinement_searches not an integer >= 2, refinement_blocked or
--                aspiration_profiles_24h not a non-negative number, or absent: the cause is silent
--                (EC-L3E-10-3, never an error on a read of the home screen).
--   EC-L3F-06-4  « ajout à une sélection » reads the items present (added_at within 24 h): an item
--                added then removed leaves no trace (the table keeps the present only, 0316).
--   EC-L3F-06-5  the openings count in distinct_profiles_served and rate_limited themselves (one
--                creator served by a search and opened is one); the contract keeps its causes, three
--                are added (open_cap_share_day, refinement, aspiration).
--
-- ROLLBACK (the alert is derived, nothing to migrate): recreate search.creator_search_volume_alerts()
-- as in 0321 (as influx_search_admin_definer); drop the policies *_search_admin_definer_alert_select of
-- profile_openings, shortlists, shortlist_items and selection_requests and revoke their grants; revoke
-- select (filters, page_reached, blocked_by_k_anonymity) on search.search_queries from
-- influx_search_admin_definer; remove the three keys from the threshold of AL21.
-- =============================================================================

-- 1. The thresholds, added without overwriting (an existing key wins: the right side of ||) ---------

update backoffice.alert_definitions
   set threshold_value =
         '{"refinement_searches": 6, "refinement_blocked": 2, "aspiration_profiles_24h": 150}'::jsonb
         || threshold_value,
       source_document = '10 RG68, CA44, CA45, CA46; 15 AL21; 03 I-9'
 where code = 'AL21';

-- 2. What the owner reads (each right with its policy) -------------------------------------------------

-- the refinement: the filters, the page and the k block of every search (read inside, never served)
grant select (filters, page_reached, blocked_by_k_anonymity) on search.search_queries
   to influx_search_admin_definer;

grant select (account_id, outcome, creator_account_id, created_at) on search.profile_openings
   to influx_search_admin_definer;
drop policy if exists profile_openings_search_admin_definer_alert_select on search.profile_openings;
create policy profile_openings_search_admin_definer_alert_select on search.profile_openings
  for select to influx_search_admin_definer using (true);

-- the scraping: whether an account added a creator to one of its lists, or asked the team, lately
grant select (id, advertiser_account_id) on search.shortlists to influx_search_admin_definer;
drop policy if exists shortlists_search_admin_definer_alert_select on search.shortlists;
create policy shortlists_search_admin_definer_alert_select on search.shortlists
  for select to influx_search_admin_definer using (true);

grant select (shortlist_id, added_at) on search.shortlist_items to influx_search_admin_definer;
drop policy if exists shortlist_items_search_admin_definer_alert_select on search.shortlist_items;
create policy shortlist_items_search_admin_definer_alert_select on search.shortlist_items
  for select to influx_search_admin_definer using (true);

grant select (advertiser_account_id, created_at) on search.selection_requests
   to influx_search_admin_definer;
drop policy if exists selection_requests_search_admin_definer_alert_select
  on search.selection_requests;
create policy selection_requests_search_admin_definer_alert_select on search.selection_requests
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
  v_max_distinct    numeric;
  v_share_bp        numeric;
  v_ref_searches    numeric;
  v_ref_blocked     numeric;
  v_aspiration      numeric;
  v_per_hour        numeric;
  v_per_day         numeric;
  v_opens_per_day   numeric;
begin
  perform search.require_search_admin();

  -- the thresholds in table (AL21, active); a value that is not a non-negative number is silent
  select case when pg_catalog.jsonb_typeof(d.threshold_value -> 'distinct_profiles_served_24h') = 'number'
               and (d.threshold_value ->> 'distinct_profiles_served_24h')::numeric >= 0
              then (d.threshold_value ->> 'distinct_profiles_served_24h')::numeric end,
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'rate_cap_share_bp') = 'number'
               and (d.threshold_value ->> 'rate_cap_share_bp')::numeric >= 0
              then (d.threshold_value ->> 'rate_cap_share_bp')::numeric end,
         -- EC-L3F-06-3: a series needs two searches at least, counted whole
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'refinement_searches') = 'number'
               and (d.threshold_value ->> 'refinement_searches')::numeric >= 2
               and (d.threshold_value ->> 'refinement_searches')::numeric
                   = pg_catalog.trunc((d.threshold_value ->> 'refinement_searches')::numeric)
              then (d.threshold_value ->> 'refinement_searches')::numeric end,
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'refinement_blocked') = 'number'
               and (d.threshold_value ->> 'refinement_blocked')::numeric >= 0
              then (d.threshold_value ->> 'refinement_blocked')::numeric end,
         case when pg_catalog.jsonb_typeof(d.threshold_value -> 'aspiration_profiles_24h') = 'number'
               and (d.threshold_value ->> 'aspiration_profiles_24h')::numeric >= 0
              then (d.threshold_value ->> 'aspiration_profiles_24h')::numeric end
    into v_max_distinct, v_share_bp, v_ref_searches, v_ref_blocked, v_aspiration
    from backoffice.alert_definitions d
   where d.code = 'AL21' and d.is_active;
  if not found then
    return;
  end if;

  -- the caps of the search and of the openings (l3e modele §8, l3f modele §2), whose share is watched
  select case when pg_catalog.jsonb_typeof(s.value -> 'perHour') = 'number'
              then (s.value ->> 'perHour')::numeric end,
         case when pg_catalog.jsonb_typeof(s.value -> 'perDay') = 'number'
              then (s.value ->> 'perDay')::numeric end,
         case when pg_catalog.jsonb_typeof(s.value -> 'profileOpensPerDay') = 'number'
              then (s.value ->> 'profileOpensPerDay')::numeric end
    into v_per_hour, v_per_day, v_opens_per_day
    from search.search_settings s
   where s.key = 'rate_limits';

  return query
  with lines as (
    select q.id, q.account_id, q.outcome, q.created_at
      from search.search_queries q
     where q.created_at > pg_catalog.now() - interval '24 hours'
  ), openings as (
    select o.account_id, o.outcome, o.creator_account_id, o.created_at
      from search.profile_openings o
     where o.created_at > pg_catalog.now() - interval '24 hours'
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
  ), served as (
    -- a creator served to an account: listed by a search, or opened (EC-L3F-06-5)
    select l.account_id, i.creator_account_id, l.created_at
      from lines l
      join search.search_impressions i on i.search_query_id = l.id
    union all
    select o.account_id, o.creator_account_id, o.created_at
      from openings o
     where o.outcome = 'served'
  ), distinct_served as (
    select s.account_id,
           (count(distinct s.creator_account_id))::integer as profiles,
           min(s.created_at) as since_at
      from served s
     group by s.account_id
  ), opened as (
    select o.account_id, (count(*))::integer as opens, min(o.created_at) as since_at
      from openings o
     where o.outcome = 'served'
     group by o.account_id
  ), refused as (
    select r.account_id, (count(*))::integer as refusals, min(r.created_at) as since_at
      from (select l.account_id, l.created_at from lines l where l.outcome = 'rate_limited'
            union all
            select o.account_id, o.created_at from openings o where o.outcome = 'rate_limited') r
     group by r.account_id
  ), new_searches as (
    -- CA45: the last new searches of each account (served, page 1), the most recent first
    select q.account_id, q.filters, q.blocked_by_k_anonymity, q.created_at,
           pg_catalog.row_number() over (partition by q.account_id
                                         order by q.created_at desc, q.id desc) as n
      from search.search_queries q
     where v_ref_searches is not null
       and q.created_at > pg_catalog.now() - interval '24 hours'
       and q.outcome = 'served'
       and q.page_reached = 1
  ), series as (
    select w.account_id, w.filters, w.blocked_by_k_anonymity, w.created_at,
           pg_catalog.lag(w.filters) over (partition by w.account_id order by w.n) as newer_filters
      from new_searches w
     where w.n <= v_ref_searches
  ), refinement as (
    select s.account_id,
           (count(*))::integer as searches,
           (count(*) filter (where s.blocked_by_k_anonymity))::integer as blocked,
           -- EC-L3F-06-2: each pair differs by exactly one facet (a top-level key of the filters)
           (count(*) filter (
              where s.newer_filters is not null
                and (select count(*)
                       from (select pg_catalog.jsonb_object_keys(s.filters)
                             union
                             select pg_catalog.jsonb_object_keys(s.newer_filters)) k (facet)
                      where (s.filters -> k.facet) is distinct from (s.newer_filters -> k.facet))
                    <> 1))::integer as broken,
           min(s.created_at) as since_at
      from series s
     group by s.account_id
  ), quiet as (
    -- CA46: the accounts that opened without adding to a shortlist nor asking for a selection
    select o.account_id, min(o.created_at) as since_at
      from openings o
     where v_aspiration is not null
       and o.outcome = 'served'
       and not exists (select 1
                         from search.shortlists sl
                         join search.shortlist_items si on si.shortlist_id = sl.id
                        where sl.advertiser_account_id = o.account_id
                          and si.added_at > pg_catalog.now() - interval '24 hours')
       and not exists (select 1
                         from search.selection_requests sr
                        where sr.advertiser_account_id = o.account_id
                          and sr.created_at > pg_catalog.now() - interval '24 hours')
     group by o.account_id
  ), aspired as (
    -- L3ES-3: the distinct creators those accounts opened, all together
    select (count(distinct o.creator_account_id))::integer as profiles
      from openings o
      join quiet q on q.account_id = o.account_id
     where o.outcome = 'served'
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
  select p.account_id, 'open_cap_share_day'::text, p.opens, p.since_at
    from opened p
   where v_share_bp is not null and v_opens_per_day is not null and v_opens_per_day > 0
     and p.opens >= 1 and p.opens * 10000 >= v_share_bp * v_opens_per_day
  union all
  select r.account_id, 'rate_limited'::text, r.refusals, r.since_at
    from refused r
  union all
  select f.account_id, 'refinement'::text, f.searches, f.since_at
    from refinement f
   where f.searches = v_ref_searches and f.broken = 0
     and v_ref_blocked is not null and f.blocked >= v_ref_blocked
  union all
  -- EC-L3F-06-1: the threshold reached raises (CA46)
  select q.account_id, 'aspiration'::text, a.profiles, q.since_at
    from quiet q, aspired a
   where a.profiles >= v_aspiration
  order by 1, 2;
end
$$;

comment on function search.creator_search_volume_alerts() is
  '15 AL21 (I-9; 10 RG68, CA45, CA46; l3e/modele.md §10, l3f/modele.md §7; 0321, 0326): one row per '
  'account and cause over the journal of 24 sliding hours. distinct_profiles_served: the creators '
  'served (impressions and openings) exceed distinct_profiles_served_24h; rate_cap_share_hour, '
  'rate_cap_share_day: the searches reach rate_cap_share_bp of perHour or perDay; open_cap_share_day: '
  'the openings reach it of profileOpensPerDay; rate_limited: a refusal of a search or an opening; '
  'refinement: the refinement_searches last new searches vary by one facet each, refinement_blocked '
  'of them below k; aspiration: the accounts opening without adding to a shortlist nor asking for a '
  'selection opened, together, aspiration_profiles_24h distinct creators. A count and the oldest '
  'line; never a filter, an alias nor a creator. STABLE SECURITY DEFINER owned by '
  'influx_search_admin_definer, EXECUTE for influx_admin only; 42501 outside an active admin in aal2. '
  'A state alert: nothing stored.';

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

  -- the owner reads the journal, the lists, the requests and the alert row: it writes none of them
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.relkind in ('r', 'p') and c.oid in ('search.search_queries'::regclass,
                                               'search.search_impressions'::regclass,
                                               'search.profile_openings'::regclass,
                                               'search.shortlists'::regclass,
                                               'search.shortlist_items'::regclass,
                                               'search.selection_requests'::regclass,
                                               'backoffice.alert_definitions'::regclass)
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'influx_search_admin_definer writes a table of AL21: %', v_bad;
  end if;
  -- never a note, a name, a message, a campaign nor a creator of a list
  if pg_catalog.has_column_privilege(c_owner, 'search.shortlists', 'name', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'search.shortlists', 'campaign_id', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'search.shortlist_items', 'note', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'search.shortlist_items', 'creator_account_id', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'search.selection_requests', 'message', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'search.selection_requests', 'filters', 'SELECT') then
    raise exception 'influx_search_admin_definer reads more of a list or a request than AL21 needs';
  end if;
  if pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE')
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option)) then
    raise exception 'influx_search_admin_definer left with a member or CREATE';
  end if;

  if not exists (select 1 from backoffice.alert_definitions
                  where code = 'AL21' and nature = 'etat' and recipient_roles = array['admin']
                    and threshold_value ?& array['distinct_profiles_served_24h', 'rate_cap_share_bp',
                                                 'refinement_searches', 'refinement_blocked',
                                                 'aspiration_profiles_24h']) then
    raise exception 'AL21 lacks a threshold of its causes';
  end if;
end
$$;
