-- =============================================================================
-- 0320_search_creator_order_and_reasons
-- -----------------------------------------------------------------------------
-- Lot 3 / L3E, commit 07 (jalons/l3e/07.md; l3e-fiche.md invariants 2, 5, 7, 8, 9, 16;
-- jalons/l3e/modele.md §6, §7, which PREVAILS for every name; 10 RG35 to RG46, RG41 rule 4, RG47,
-- RG88; 04 §5.5). The explainable order of the brand's creator search, its cold quota and the
-- « Proposé car » reasons written at the impression. Signalled I-4 (03): the door is recreated
-- (EXECUTE kept), a new invoker helper, GRANTs and policies to its owner.
--
-- 1. search.creator_order(candidates, filters, sort, campaign, page size, page, day) (modele §1,
--    §6, §7): SECURITY INVOKER, owned by influx_creator_search_definer, executed by nobody. The
--    candidates of the engine ranked by the keys of an ORDER BY, never added into a score, written
--    nor served (D11): tier 1 the OR values satisfied (F3 on the lines of F4, F8, F11, F17), tier 2
--    the deliverables of the campaign satisfied plus its targeted main country (neutral without a
--    campaign, RG37), tier 3 audience_verified > account_verified > none, tier 4 fresh before stale
--    (the primary listed line over 90 days, or an audience badge to_refresh), tier 5 neutral
--    (completeness is layer I, modele -5), tier 6 lt_2w > lt_1m > undeclared > full, tier 7 neutral
--    (RG38), tier 8 md5(day || ':' || account) then the account. The sorts of the pilot: default;
--    audience (the best band of the lines of F3, F4, otherwise of every listed line, then 3 to 8);
--    verified_first (3, 1, 2, 4 to 8); new_profiles (published less than recentDays days ago, then
--    1 to 8); no sort by rate (D78). The cold quota (default sort): a creator published less than
--    recentDays days ago or absent from search.creator_exposures before the UTC day is cold; when
--    page 1 holds fewer than `slots` of them, the best-ranked colds beyond it take its last places
--    and the lowest non-colds of page 1 open page 2 (the order of every page stays one order);
--    never a result outside the candidates. For the rows of the page asked: 2 to 4 reasons, codes
--    and bands only, in the order of the tiers then of the facets, and one vigilance note at most.
-- 2. search.search_creators() recreated at equal signature: the order of 1 instead of tier 8 alone;
--    an impression carries its cold_quota and its note, its reasons are written in
--    search.impression_reasons in the transaction that serves; the card serves {code, params} and
--    the note. Filters, exclusions, k, the bucket, the pages and the journal line unchanged (06).
-- 3. The owner reads cold_profile_quota (its policy on search_settings now six keys), first_page_at
--    of the exposures, the deliverables (network, format, slot) and the audience countries of the
--    caller's own campaigns; it inserts the reasons of its impressions.
-- 4. A version of search.facet_config_versions (RG88): the order of the tiers changes.
--
-- RIGHTS (03 I-4, signalled): column GRANTs and their policies to influx_creator_search_definer on
-- campaigns.campaign_deliverables, campaign_audience_countries, search.creator_exposures
-- (first_page_at), search.impression_reasons (INSERT); its policy on search.search_settings
-- recreated with cold_profile_quota. Nothing new to influx_advertiser.
--
-- Not here: the route and its contract (L3E-08), the labels of the reasons (next-intl, L3F), the
-- region (L3F), the identified view (L3G), AL21 (0321).
--
-- EC-L3E-07 (micro-gaps, the safest choice):
--   EC-L3E-07-1  the door still names the engine and hands its candidates to the order helper (one
--                engine, RG4); the helper ranks every candidate and builds the reasons of the page
--                asked only.
--   EC-L3E-07-2  tier 1 counts the values satisfied, F4 alone counting none (« F3 sur les lignes de
--                F4 »); tier 2 counts the deliverables whose network is listed and whose format is
--                offered, plus one for a targeted main country.
--   EC-L3E-07-3  every day is the UTC day of the door (the day passed to the helper): 90 days, the
--                recentDays of the quota, of new_profiles and of the note recent_profile, and the
--                exposures before that day, so an order holds the whole day (RG36, RG45).
--   EC-L3E-07-4  figures without a date are not fresh (tier 4) and carry no stale_figures note (no
--                age to tell); an undeclared availability sits between lt_1m and full (RG45 rule 1).
--   EC-L3E-07-5  the order of the audience bands is a static list of the bands of 0201, checked
--                against reference.audience_bands at the end of this migration (no right on
--                reference for the owner).
--   EC-L3E-07-6  a fallback reason never repeats a fact already given: primary_topic after
--                topic_match, main_audience after audience_country_match or
--                campaign_audience_country; a reason whose parameter is missing is not written.
--   EC-L3E-07-7  one note at most, in the order of modele §7: stale_figures, recent_profile,
--                audience_badge_to_renew, declared_full; recent_profile reads recentDays (30).
--   EC-L3E-07-8  three expectations of L3E-T6 follow 0320: the helpers of the owner (five), its
--                writes (impression_reasons) and the reasons of the card.
--
-- ROLLBACK (before any search is journaled once 0320 is applied): re-run the door of 0319; drop
-- function search.creator_order(uuid[], jsonb, text, uuid, integer, integer, date); drop the
-- policies *_creator_search_definer_* of campaign_deliverables, campaign_audience_countries and
-- impression_reasons and revoke their grants; revoke select (first_page_at) on
-- search.creator_exposures; recreate search_settings_creator_search_definer_select with five keys.
-- The version inserted stays (append-only).
-- =============================================================================

-- 1. What the owner reads and writes beyond 0319 (modele §1, §6, §7) ---------------------------------

-- 1.1 The cold quota among the settings it reads
drop policy if exists search_settings_creator_search_definer_select on search.search_settings;
create policy search_settings_creator_search_definer_select on search.search_settings
  for select to influx_creator_search_definer
  using (key in ('is_open_to_advertisers', 'k_anonymity_threshold', 'page_size', 'max_pages',
                 'rate_limits', 'cold_profile_quota'));

-- 1.2 The first page 1 of a creator, before the UTC day (cold, RG45)
grant select (first_page_at) on search.creator_exposures to influx_creator_search_definer;

-- 1.3 Tier 2: the deliverables and the targeted countries of the caller's own campaigns (RG37)
grant select (campaign_id, slot, network_code, format_code)
   on campaigns.campaign_deliverables to influx_creator_search_definer;
grant select (campaign_id, country_code)
   on campaigns.campaign_audience_countries to influx_creator_search_definer;

drop policy if exists campaign_deliverables_creator_search_definer_select
  on campaigns.campaign_deliverables;
create policy campaign_deliverables_creator_search_definer_select
  on campaigns.campaign_deliverables
  for select to influx_creator_search_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.id = campaign_deliverables.campaign_id
                    and c.advertiser_account_id = (select influx.current_account_id())));

drop policy if exists campaign_audience_countries_creator_search_definer_select
  on campaigns.campaign_audience_countries;
create policy campaign_audience_countries_creator_search_definer_select
  on campaigns.campaign_audience_countries
  for select to influx_creator_search_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.id = campaign_audience_countries.campaign_id
                    and c.advertiser_account_id = (select influx.current_account_id())));

-- 1.4 The reasons of its own impressions, INSERT only (RG66, CA47)
grant insert (search_query_id, creator_account_id, reason_code, position, reason_params)
   on search.impression_reasons to influx_creator_search_definer;

drop policy if exists impression_reasons_creator_search_definer_insert on search.impression_reasons;
create policy impression_reasons_creator_search_definer_insert on search.impression_reasons
  for insert to influx_creator_search_definer
  with check (exists (select 1 from search.search_queries q
                       where q.id = impression_reasons.search_query_id
                         and q.account_id = (select influx.current_account_id())));

-- 2. The order and the door, as influx_creator_search_definer (03 P7 rule 5) -------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_search_definer', current_user);
end
$$;
grant create on schema search to influx_creator_search_definer;
set role influx_creator_search_definer;

-- 2.1 The explainable order (10 RG35 to RG46; modele §6, §7; fiche invariants 7, 8)
create or replace function search.creator_order(
  p_candidates   uuid[],
  p_filters      jsonb,
  p_sort         text,
  p_campaign_id  uuid,
  p_page_size    integer,
  p_page         integer,
  p_day          date)
returns table (
  creator_account_id  uuid,
  place               integer,
  cold_quota          boolean,
  reasons             jsonb,
  vigilance           text
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- the audience bands of 0201 from the smallest (EC-L3E-07-5)
  c_bands      constant text[] := array['nano', 'micro', 'mid', 'macro', 'mega'];
  v_slots      integer;
  v_recent     integer;
  v_f1         text;
  v_f3         text[];
  v_f4         text[];
  v_f6         text;
  v_f8         text[];
  v_f11        text[];
  v_f17        text[];
  v_day_start  timestamptz;
  v_from       integer;
  v_to         integer;
begin
  if p_candidates is null or p_filters is null
     or p_sort is null or p_sort not in ('default', 'audience', 'verified_first', 'new_profiles')
     or p_page_size is null or p_page_size < 1 or p_page is null or p_page < 1
     or p_day is null then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'order';
  end if;

  -- RG46: the quota in table, read at every search (EC-L3E-06-3: missing is 55000)
  select (s.value ->> 'slots')::integer, (s.value ->> 'recentDays')::integer
    into v_slots, v_recent
    from search.search_settings s
   where s.key = 'cold_profile_quota';
  if v_slots is null or v_recent is null then
    raise exception 'creator_search_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'creator_search_settings';
  end if;

  -- the filters, already checked by the door (search.check_creator_search_filters)
  v_f1 := p_filters ->> 'F1';
  v_f6 := p_filters #>> '{F6,country}';
  if p_filters ? 'F3' then
    v_f3 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'F3') x);
  end if;
  if p_filters ? 'F4' then
    v_f4 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'F4') x);
  end if;
  if p_filters ? 'F8' then
    v_f8 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'F8') x);
  end if;
  if p_filters ? 'F11' then
    v_f11 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'F11') x);
  end if;
  if p_filters ? 'F17' then
    v_f17 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'F17') x);
  end if;

  v_day_start := pg_catalog.timezone('UTC', p_day::timestamp);
  v_from := (p_page - 1) * p_page_size + 1;
  v_to := p_page * p_page_size;

  return query
  with fact as (
    select p.account_id as id,
           p.primary_topic_code as topic,
           p.main_audience_country::text as country,
           p.main_audience_share_band as share,
           p.availability_band as availability,
           pl.network_code as primary_network,
           pl.measured as primary_measured,
           -- RG43, RG45: published less than recentDays UTC days ago
           pg_catalog.timezone('UTC', p.published_at)::date > p_day - v_recent as recent,
           -- RG45 rule 3: recent, or never on a page 1 before the day
           (pg_catalog.timezone('UTC', p.published_at)::date > p_day - v_recent
            or not exists (select 1 from search.creator_exposures e
                            where e.creator_account_id = p.account_id
                              and e.first_page_at < v_day_start)) as cold,
           -- tier 1: the OR values satisfied (F3 on the lines of F4, F8, F11, F17)
           ((case when v_f3 is null then 0 else
               (select count(distinct n.network_code)
                  from profiles.creator_public_networks n
                 where n.account_id = p.account_id and n.listed_at is not null
                   and n.network_code = any (v_f3)
                   and (v_f4 is null or n.audience_band = any (v_f4))) end)
            + (case when v_f8 is null then 0 else
                 (select count(*) from profiles.creator_publication_languages l
                   where l.account_id = p.account_id and l.language_code::text = any (v_f8)) end)
            + (case when v_f11 is null then 0 else
                 (select count(*) from profiles.creator_formats f
                   where f.account_id = p.account_id and f.format_code = any (v_f11)) end)
            + (case when v_f17 is null then 0 else
                 (select count(distinct g.level)
                    from profiles.creator_public_networks n
                    join verification.badges g
                      on g.account_id = n.account_id and g.social_account_id = n.social_account_id
                   where n.account_id = p.account_id and n.listed_at is not null
                     and g.level::text = any (v_f17) and g.state in ('active', 'to_refresh')) end)
           )::integer as tier1,
           -- tier 2 (RG37): neutral without a campaign
           (case when p_campaign_id is null then 0 else
              (select count(*)
                 from campaigns.campaign_deliverables d
                where d.campaign_id = p_campaign_id
                  and exists (select 1 from profiles.creator_public_networks n
                               where n.account_id = p.account_id and n.listed_at is not null
                                 and n.network_code = d.network_code)
                  and exists (select 1 from profiles.creator_formats f
                               where f.account_id = p.account_id
                                 and f.format_code = d.format_code))
              + (case when exists (select 1 from campaigns.campaign_audience_countries a
                                    where a.campaign_id = p_campaign_id
                                      and a.country_code::text = p.main_audience_country::text)
                      then 1 else 0 end) end)::integer as tier2,
           -- tier 3: the best holding badge of a listed line
           coalesce((select max(case when g.level::text = 'audience_verified' then 2 else 1 end)
                       from profiles.creator_public_networks n
                       join verification.badges g
                         on g.account_id = n.account_id and g.social_account_id = n.social_account_id
                      where n.account_id = p.account_id and n.listed_at is not null
                        and g.level in ('account_verified', 'audience_verified')
                        and g.state in ('active', 'to_refresh')), 0) as tier3,
           exists (select 1
                     from profiles.creator_public_networks n
                     join verification.badges g
                       on g.account_id = n.account_id and g.social_account_id = n.social_account_id
                    where n.account_id = p.account_id and n.listed_at is not null
                      and g.level = 'audience_verified' and g.state = 'to_refresh')
             as audience_to_refresh,
           -- tier 6: lt_2w > lt_1m > undeclared > full (EC-L3E-07-4)
           (case p.availability_band when 'lt_2w' then 3 when 'lt_1m' then 2 when 'full' then 0
                 else 1 end) as tier6,
           -- the audience sort: the best band of the lines of F3, F4, otherwise of every line
           coalesce((select max(pg_catalog.array_position(c_bands, n.audience_band))
                       from profiles.creator_public_networks n
                      where n.account_id = p.account_id and n.listed_at is not null
                        and (v_f3 is null or n.network_code = any (v_f3))
                        and (v_f4 is null or n.audience_band = any (v_f4))), 0) as band,
           -- tier 8: the daily rotation, stable in the day (RG36)
           pg_catalog.md5(p_day::text || ':' || p.account_id::text) as tier8
      from pg_catalog.unnest(p_candidates) k (id)
      join profiles.creator_public_profiles p on p.account_id = k.id
      left join lateral (
        select n.network_code,
               pg_catalog.timezone('UTC', n.figures_measured_at)::date as measured
          from profiles.creator_public_networks n
         where n.account_id = p.account_id and n.listed_at is not null and n.is_primary
         order by n.created_at, n.social_account_id
         limit 1) pl on true
  ),
  -- tier 4 (RG39): fresh figures of the primary line, no audience badge to renew
  judged as (
    select f.*,
           (f.primary_measured is not null and f.primary_measured >= p_day - 90
            and not f.audience_to_refresh) as fresh
      from fact f
  ),
  ranked as (
    select j.*,
           pg_catalog.row_number() over (
             order by case when p_sort = 'new_profiles' then j.recent end desc nulls last,
                      case when p_sort = 'audience' then j.band end desc nulls last,
                      case when p_sort = 'verified_first' then j.tier3 end desc nulls last,
                      case when p_sort <> 'audience' then j.tier1 end desc nulls last,
                      case when p_sort <> 'audience' then j.tier2 end desc nulls last,
                      j.tier3 desc, j.fresh desc, j.tier6 desc, j.tier8, j.id) as r
      from judged j
  ),
  -- RG45 rule 3, modele §6: the colds the default sort adds to page 1, never more than exist
  quota as (
    select case when p_sort = 'default'
                then greatest(0, least(
                       v_slots - count(*) filter (where q.cold and q.r <= p_page_size),
                       count(*) filter (where q.cold and q.r > p_page_size),
                       count(*) filter (where not q.cold and q.r <= p_page_size)))
                else 0 end as m
      from ranked q
  ),
  marked as (
    select q.*,
           (q.cold and q.r > p_page_size
            and pg_catalog.row_number() over (partition by (q.cold and q.r > p_page_size)
                                              order by q.r) <= u.m) as promoted,
           (not q.cold and q.r <= p_page_size
            and pg_catalog.row_number() over (partition by (not q.cold and q.r <= p_page_size)
                                              order by q.r desc) <= u.m) as displaced
      from ranked q cross join quota u
  ),
  placed as (
    select m.*,
           pg_catalog.row_number() over (
             order by case when m.promoted or (m.r <= p_page_size and not m.displaced) then 0
                           else 1 end,
                      m.r)::integer as final_place
      from marked m
  )
  select pd.id,
         pd.final_place,
         pd.promoted,
         -- RG41: 2 to 4 reasons, in the order of the tiers then of the facets, codes and bands only
         case when pd.final_place between v_from and v_to then (
           with main as (
             select v.ord, v.reason
               from (values
                 (1, case when v_f1 is not null and pd.topic is not null then
                       pg_catalog.jsonb_build_object('code', 'topic_match', 'params',
                         pg_catalog.jsonb_build_object('topic', pd.topic)) end),
                 (2, case when v_f3 is not null or v_f4 is not null then
                       (select pg_catalog.jsonb_build_object('code', 'network_match', 'params',
                                 pg_catalog.jsonb_build_object('network', n.network_code,
                                                               'audienceBand', n.audience_band))
                          from profiles.creator_public_networks n
                         where n.account_id = pd.id and n.listed_at is not null
                           and n.audience_band is not null
                           and (v_f3 is null or n.network_code = any (v_f3))
                           and (v_f4 is null or n.audience_band = any (v_f4))
                         order by n.is_primary desc, n.created_at, n.social_account_id
                         limit 1) end),
                 (3, case when v_f6 is not null and pd.country is not null
                            and pd.share is not null then
                       pg_catalog.jsonb_build_object('code', 'audience_country_match', 'params',
                         pg_catalog.jsonb_build_object('country', pd.country,
                                                       'shareBand', pd.share)) end),
                 (4, case when v_f8 is not null then
                       (select pg_catalog.jsonb_build_object('code', 'language_match', 'params',
                                 pg_catalog.jsonb_build_object('language', l.language_code::text))
                          from profiles.creator_publication_languages l
                         where l.account_id = pd.id and l.language_code::text = any (v_f8)
                         order by l.slot
                         limit 1) end),
                 (5, case when v_f11 is not null then
                       (select pg_catalog.jsonb_build_object('code', 'format_match', 'params',
                                 pg_catalog.jsonb_build_object('format', f.format_code))
                          from profiles.creator_formats f
                         where f.account_id = pd.id and f.format_code = any (v_f11)
                         order by f.format_code
                         limit 1) end),
                 (6, case when p_campaign_id is not null then
                       (select pg_catalog.jsonb_build_object('code', 'campaign_format', 'params',
                                 pg_catalog.jsonb_build_object('network', d.network_code,
                                                               'format', d.format_code))
                          from campaigns.campaign_deliverables d
                         where d.campaign_id = p_campaign_id
                           and exists (select 1 from profiles.creator_public_networks n
                                        where n.account_id = pd.id and n.listed_at is not null
                                          and n.network_code = d.network_code)
                           and exists (select 1 from profiles.creator_formats f
                                        where f.account_id = pd.id
                                          and f.format_code = d.format_code)
                         order by d.slot
                         limit 1) end),
                 (7, case when p_campaign_id is not null and pd.share is not null
                            and exists (select 1 from campaigns.campaign_audience_countries a
                                         where a.campaign_id = p_campaign_id
                                           and a.country_code::text = pd.country) then
                       pg_catalog.jsonb_build_object('code', 'campaign_audience_country', 'params',
                         pg_catalog.jsonb_build_object('country', pd.country,
                                                       'shareBand', pd.share)) end),
                 (8, (select pg_catalog.jsonb_build_object('code', g.level::text, 'params',
                               pg_catalog.jsonb_build_object('network', n.network_code))
                        from profiles.creator_public_networks n
                        join verification.badges g
                          on g.account_id = n.account_id
                         and g.social_account_id = n.social_account_id
                       where n.account_id = pd.id and n.listed_at is not null
                         and g.level in ('account_verified', 'audience_verified')
                         and g.state in ('active', 'to_refresh')
                       order by (g.level::text = 'audience_verified') desc,
                                (g.state::text = 'active') desc,
                                n.is_primary desc, n.created_at, n.social_account_id
                       limit 1)),
                 (9, case when pd.fresh and pd.primary_network is not null then
                       pg_catalog.jsonb_build_object('code', 'figures_fresh', 'params',
                         pg_catalog.jsonb_build_object('network', pd.primary_network)) end),
                 (10, case when pd.availability in ('lt_2w', 'lt_1m') then
                        pg_catalog.jsonb_build_object('code', 'available', 'params',
                          pg_catalog.jsonb_build_object('availability', pd.availability)) end)
               ) v (ord, reason)
              where v.reason is not null
              order by v.ord
              limit 4
           ),
           -- under two, the facts required to publish, never one already given (EC-L3E-07-6)
           fallback as (
             select v.ord, v.reason
               from (values
                 (11, case when pd.topic is not null
                            and not exists (select 1 from main
                                             where main.reason ->> 'code' = 'topic_match') then
                        pg_catalog.jsonb_build_object('code', 'primary_topic', 'params',
                          pg_catalog.jsonb_build_object('topic', pd.topic)) end),
                 (12, case when pd.country is not null and pd.share is not null
                            and not exists (select 1 from main
                                             where main.reason ->> 'code'
                                                   in ('audience_country_match',
                                                       'campaign_audience_country')) then
                        pg_catalog.jsonb_build_object('code', 'main_audience', 'params',
                          pg_catalog.jsonb_build_object('country', pd.country,
                                                        'shareBand', pd.share)) end)
               ) v (ord, reason)
              where v.reason is not null
           )
           select coalesce(pg_catalog.jsonb_agg(x.reason order by x.ord), '[]'::jsonb)
             from (select main.ord, main.reason from main
                   union all
                   select b.ord, b.reason from fallback b
                    where (select count(*) from main)
                          + (select count(*) from fallback c where c.ord <= b.ord) <= 2) x
         ) end,
         -- RG42: one note at most (EC-L3E-07-7)
         case when pd.final_place between v_from and v_to then
           case when pd.primary_measured is not null and pd.primary_measured < p_day - 90
                  then 'stale_figures'
                when pd.recent then 'recent_profile'
                when pd.audience_to_refresh then 'audience_badge_to_renew'
                when pd.availability = 'full' then 'declared_full'
           end
         end
    from placed pd
   order by pd.final_place;
end
$$;

comment on function search.creator_order(uuid[], jsonb, text, uuid, integer, integer, date) is
  'l3e/modele.md §6, §7 (0320; 10 RG35 to RG46, D11): the order of the candidates p_candidates of '
  'the engine for the sort p_sort on the UTC day p_day, every candidate with its place (1..n), '
  'whether the cold quota placed it, and for the rows of page p_page (p_page_size) its reasons '
  '([{code, params}], 2 to 4, codes and bands only) and its vigilance note (one at most). Keys of '
  'an ORDER BY, never a score: tiers 1 to 8 of RG35 (5 and 7 neutral, 2 neutral without '
  'p_campaign_id); sorts default, audience, verified_first, new_profiles; the quota of '
  'cold_profile_quota on page 1 of the default sort. 22023 DETAIL order on a bad argument, 55000 '
  'creator_search_settings without the quota. SECURITY INVOKER owned by '
  'influx_creator_search_definer, executed by its owner only.';

-- 2.2 The door, at equal signature (modele §1, §4 to §7; 10 RG41, RG42, RG45, RG46, RG66; CA47, CA48)
create or replace function search.search_creators(
  p_filters      jsonb,
  p_sort         text,
  p_page         integer,
  p_campaign_id  uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid;
  v_request    text := left(nullif(pg_catalog.current_setting('influx.request_id', true), ''), 100);
  v_day        date := pg_catalog.timezone('UTC', pg_catalog.now())::date;
  v_open       jsonb;
  v_version    bigint;
  v_retry      integer;
  v_journal    boolean;
  v_k          integer;
  v_page_size  integer;
  v_max_pages  integer;
  v_ids        uuid[];
  v_count      integer;
  v_from       integer;
  v_to         integer;
  v_query      uuid;
  v_page       jsonb;
  v_cards      jsonb;
begin
  v_caller := search.require_creator_searcher();
  -- EC-L3E-06-1: the domain of the contract, refused before anything is written
  if p_sort is null or p_sort not in ('default', 'audience', 'verified_first', 'new_profiles') then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'sort';
  end if;
  if p_page is null or p_page not between 1 and 50 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'page';
  end if;

  -- RG1: a brand profile not published sees the criteria, never a list; nothing written
  if not exists (select 1 from profiles.advertiser_profiles a
                  where a.account_id = v_caller and a.status = 'published') then
    return pg_catalog.jsonb_build_object('state', 'brand_not_published');
  end if;

  -- D38, RG2, CA59: closed, no list; nothing written nor counted (EC-L3E-06-3: missing is closed)
  select s.value into v_open from search.search_settings s where s.key = 'is_open_to_advertisers';
  if v_open is distinct from 'true'::jsonb then
    return pg_catalog.jsonb_build_object('state', 'closed');
  end if;

  select max(v.version) into v_version from search.facet_config_versions v;

  -- RG63, RG64, T15.2: the bucket of the account full, nothing served, the refusal journaled once
  -- per window, without its filters nor its campaign (EC-L3E-06-6)
  select r.retry_after_seconds, r.journal_refusal into v_retry, v_journal
    from search.creator_search_retry_after(v_caller) r;
  if v_retry is not null then
    if v_journal then
      insert into search.search_queries
        (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
         facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
      values (v_caller, 'advertiser', 'advertiser_anonymous', null, 'rate_limited', '{}'::jsonb,
              p_sort, v_version, 0, p_page, false, v_request);
    end if;
    return pg_catalog.jsonb_build_object('state', 'rate_limited', 'retryAfterSeconds', v_retry);
  end if;

  -- the closed entry (22023), the campaign of origin: unknown, of another brand or erased, one answer
  perform search.check_creator_search_filters(p_filters);
  if p_campaign_id is not null
     and not exists (select 1 from campaigns.campaigns c
                      where c.id = p_campaign_id and c.advertiser_account_id = v_caller
                        and c.erased_at is null) then
    raise exception 'campaign_not_found' using errcode = 'no_data_found', detail = 'campaign';
  end if;

  select (s.value)::integer into v_k
    from search.search_settings s where s.key = 'k_anonymity_threshold';
  select (s.value)::integer into v_page_size from search.search_settings s where s.key = 'page_size';
  select (s.value)::integer into v_max_pages from search.search_settings s where s.key = 'max_pages';
  if v_k is null or v_page_size is null or v_max_pages is null then
    raise exception 'creator_search_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'creator_search_settings';
  end if;

  -- RG63, CA41, CA42: the cap of pages held by the base, the attempt journaled
  if p_page > v_max_pages then
    insert into search.search_queries
      (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
       facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
    values (v_caller, 'advertiser', 'advertiser_anonymous', p_campaign_id, 'page_cap', p_filters,
            p_sort, v_version, 0, p_page, false, v_request);
    return pg_catalog.jsonb_build_object('state', 'page_cap');
  end if;

  -- RG26, RG57: the candidates after the exclusions, from the one engine (RG4)
  select coalesce(pg_catalog.array_agg(c.creator_account_id), '{}'::uuid[])
    into v_ids
    from search.creator_candidates('advertiser_anonymous', v_caller, p_filters, p_campaign_id) c;
  v_count := pg_catalog.cardinality(v_ids);

  -- RG57, RG58, CA34, CA35: below k, ONE answer whatever the count (0 or 4), journaled with it
  if v_count < v_k then
    insert into search.search_queries
      (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
       facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
    values (v_caller, 'advertiser', 'advertiser_anonymous', p_campaign_id, 'served', p_filters,
            p_sort, v_version, v_count, p_page, true, v_request);
    return pg_catalog.jsonb_build_object('state', 'too_narrow');
  end if;

  -- RG66, CA47: the search, then its impressions and their reasons, in the transaction that serves
  insert into search.search_queries
    (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
     facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
  values (v_caller, 'advertiser', 'advertiser_anonymous', p_campaign_id, 'served', p_filters,
          p_sort, v_version, v_count, p_page, false, v_request)
  returning id into v_query;

  -- RG63: the rank, never a cursor (EC-L3E-06-9); beyond the results, no card
  v_from := (p_page - 1) * v_page_size + 1;
  v_to := p_page * v_page_size;

  -- modele §6, §7: the page in the explainable order of the UTC day, its reasons and notes
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', o.creator_account_id, 'rank', o.place, 'cold', o.cold_quota,
           'reasons', o.reasons, 'vigilance', o.vigilance) order by o.place), '[]'::jsonb)
    into v_page
    from search.creator_order(v_ids, p_filters, p_sort, p_campaign_id, v_page_size, p_page,
                              v_day) o
   where o.place between v_from and v_to;

  -- CA48: one impression per card served, its rank, whether the quota placed it, its note
  insert into search.search_impressions
    (search_query_id, creator_account_id, rank, cold_quota, vigilance_code)
  select v_query, (e ->> 'id')::uuid, (e ->> 'rank')::smallint, (e ->> 'cold')::boolean,
         e ->> 'vigilance'
    from pg_catalog.jsonb_array_elements(v_page) e;

  -- RG41, 04 §5.5: the reasons as they are shown, their position, codes and bands only
  insert into search.impression_reasons
    (search_query_id, creator_account_id, reason_code, position, reason_params)
  select v_query, (e ->> 'id')::uuid, x.reason ->> 'code', x.ord::smallint, x.reason -> 'params'
    from pg_catalog.jsonb_array_elements(v_page) e
    cross join lateral pg_catalog.jsonb_array_elements(e -> 'reasons') with ordinality x (reason, ord);

  -- modele §6, §9: the first page 1 of a creator, kept once
  if p_page = 1 then
    insert into search.creator_exposures (creator_account_id, first_page_at)
    select (e ->> 'id')::uuid, pg_catalog.now()
      from pg_catalog.jsonb_array_elements(v_page) e
    on conflict (creator_account_id) do nothing;
  end if;

  -- modele §2: layer A of each card from its one source, without its status nor the key of a line,
  -- referenced by its alias; its reasons {code, params} and its note
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'creator',   (l.layer - 'status' - 'lines')
                        || pg_catalog.jsonb_build_object(
                             'lines',
                             coalesce((select pg_catalog.jsonb_agg(x.line - 'lineKey' order by x.ord)
                                         from pg_catalog.jsonb_array_elements(l.layer -> 'lines')
                                              with ordinality x (line, ord)),
                                      '[]'::jsonb)),
           'reasons',   s.card -> 'reasons',
           'vigilance', s.card -> 'vigilance')
         order by s.ord), '[]'::jsonb)
    into v_cards
    from pg_catalog.jsonb_array_elements(v_page) with ordinality s (card, ord)
    cross join lateral (select profiles.creator_layer_a((s.card ->> 'id')::uuid) as layer) l;

  -- RG59, CA36: the count in a band only, never exact
  return pg_catalog.jsonb_build_object(
    'state',      'results',
    'countBand',  search.result_count_band(v_count),
    'page',       p_page,
    'nextPage',   case when v_count > p_page * v_page_size and p_page < v_max_pages
                       then p_page + 1 end,
    'capReached', p_page = v_max_pages and v_count > p_page * v_page_size,
    'cards',      v_cards);
end
$$;

comment on function search.search_creators(jsonb, text, integer, uuid) is
  '10 RG1, RG2, RG4, RG17, RG26 to RG31, RG35 to RG46, RG57 to RG59, RG63 to RG66 (0319, 0320; '
  'l3e/modele.md §1 to §8): a page of the anonymous creator search of the calling brand '
  '(search.require_creator_searcher: 42501 otherwise). p_sort default, audience, verified_first, '
  'new_profiles and p_page 1 to 50 (22023 DETAIL sort or page, nothing written). Then: a brand '
  'profile not published {state: brand_not_published}; the switch false {state: closed} (nothing '
  'written nor counted); the bucket full {state: rate_limited, retryAfterSeconds} (a line per '
  'window); the filters (search.check_creator_search_filters, 22023 DETAIL filters) and the '
  'campaign of origin (unknown, of another brand or erased: P0002 DETAIL campaign); a page beyond '
  'max_pages {state: page_cap}; the count after the exclusions below k {state: too_narrow}, nothing '
  'else; otherwise {state: results, countBand, page, nextPage, capReached, cards: [{creator '
  '(profiles.creator_layer_a without status nor lineKey), reasons [{code, params}], vigilance}]}, '
  'page_size cards in the order of search.creator_order() for the UTC day. Every outcome but closed '
  'and brand_not_published writes its line of search.search_queries (exact count, never served), a '
  'served page its impressions (rank, cold_quota, note), their reasons and on page 1 its exposures, '
  'in the transaction that serves. SECURITY DEFINER owned by influx_creator_search_definer, empty '
  'search_path; EXECUTE for influx_advertiser only.';

-- 3. Rights on the functions (03 P7 rule 5), then the owner given back -------------------------------

revoke all on function search.creator_order(uuid[], jsonb, text, uuid, integer, integer, date)
  from public, anon, authenticated, service_role;
revoke all on function search.search_creators(jsonb, text, integer, uuid)
  from public, anon, authenticated, service_role;
grant execute on function search.search_creators(jsonb, text, integer, uuid) to influx_advertiser;

reset role;
revoke create on schema search from influx_creator_search_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_search_definer', current_user);
end
$$;

-- 4. A version of the configuration (10 RG88): the order of the tiers changes ------------------------

insert into search.facet_config_versions (snapshot, note)
select search.facet_config_snapshot(),
       'L3E 0320: the explainable order of tiers 1 to 8 (10 RG35), the sorts of the pilot, the cold '
       'quota on page 1 and the reasons written at the impression'
 where not exists (select 1 from search.facet_config_versions v
                    where v.note like 'L3E 0320:%');

-- 5. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner   constant text := 'influx_creator_search_definer';
  c_order   constant text := 'search.creator_order(uuid[], jsonb, text, uuid, integer, integer, date)';
  c_door    constant text := 'search.search_creators(jsonb, text, integer, uuid)';
  c_layer_i constant text[] := array[
    'creator_identities', 'creator_social_accounts', 'creator_audience_ages',
    'creator_audience_countries', 'creator_audience_genders', 'creator_network_metrics_history'];
  v_bad     text;
begin
  -- the helper and the door: owner, mode, empty search_path, EXECUTE for their callers only
  if (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
       where p.oid = c_order::regprocedure) <> c_owner
     or (select p.prosecdef from pg_catalog.pg_proc p where p.oid = c_order::regprocedure)
     or (select p.proconfig from pg_catalog.pg_proc p where p.oid = c_order::regprocedure)
          is distinct from array['search_path=""']
     or (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
          where p.oid = c_door::regprocedure) <> c_owner
     or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = c_door::regprocedure)
     or (select p.proconfig from pg_catalog.pg_proc p where p.oid = c_door::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception 'the order helper and the door must be owned by %, invoker and definer, empty search_path',
      c_owner;
  end if;
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in (c_order::regprocedure, c_door::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (p.oid = c_door::regprocedure and a.grantee = 'influx_advertiser'::regrole);
  if v_bad is not null then
    raise exception 'executable beyond their callers: %', v_bad;
  end if;

  -- 03 P7, fiche invariant 15: no dynamic SQL, never layer I named
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole
     and (p.prosrc ~* c_dynamic
          or p.prosrc ~* ('\m(' || pg_catalog.array_to_string(c_layer_i, '|') || ')\M'));
  if v_bad is not null then
    raise exception 'a function of the creator search runs dynamic SQL or names layer I: %', v_bad;
  end if;

  -- D11, fiche invariant 7: no score column in the schema search
  select string_agg(at.attrelid::regclass::text || '.' || at.attname, ', ') into v_bad
    from pg_catalog.pg_attribute at
    join pg_catalog.pg_class c on c.oid = at.attrelid
   where c.relnamespace = 'search'::regnamespace and c.relkind in ('r', 'p', 'v', 'm')
     and at.attnum > 0 and not at.attisdropped and at.attname ~* 'score';
  if v_bad is not null then
    raise exception 'D11: a score column in the schema search: %', v_bad;
  end if;

  -- its writes: the journal lines, their impressions, their reasons and the exposures, INSERT only
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname not in ('pg_catalog', 'information_schema')
     and c.relkind in ('r', 'p')
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'UPDATE')
          or (c.oid not in ('search.search_queries'::regclass, 'search.search_impressions'::regclass,
                            'search.impression_reasons'::regclass,
                            'search.creator_exposures'::regclass)
              and (pg_catalog.has_table_privilege(c_owner, c.oid, 'INSERT')
                   or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'INSERT'))));
  if v_bad is not null then
    raise exception 'influx_creator_search_definer writes beyond its journal: %', v_bad;
  end if;

  -- of a deliverable and an audience country, the columns of tier 2 only
  select string_agg(at.attrelid::regclass::text || '.' || at.attname, ', ' order by 1) into v_bad
    from pg_catalog.pg_attribute at
   where at.attrelid in ('campaigns.campaign_deliverables'::regclass,
                         'campaigns.campaign_audience_countries'::regclass)
     and at.attnum > 0 and not at.attisdropped
     and pg_catalog.has_column_privilege(c_owner, at.attrelid, at.attnum, 'SELECT')
     and not (at.attrelid = 'campaigns.campaign_deliverables'::regclass
              and at.attname in ('campaign_id', 'slot', 'network_code', 'format_code'))
     and not (at.attrelid = 'campaigns.campaign_audience_countries'::regclass
              and at.attname in ('campaign_id', 'country_code'));
  if v_bad is not null then
    raise exception 'influx_creator_search_definer reads a column of a campaign it must not: %', v_bad;
  end if;

  -- fiche invariant 1: the brand still executes the door alone in search
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'search'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
     and p.oid <> c_door::regprocedure;
  if v_bad is not null then
    raise exception 'influx_advertiser executes a search function beyond its door: %', v_bad;
  end if;

  -- EC-L3E-07-5: the static order of the bands is the order of the reference
  if (select pg_catalog.array_agg(b.code order by b.min_followers)
        from reference.audience_bands b where b.retired_at is null)
     is distinct from array['nano', 'micro', 'mid', 'macro', 'mega'] then
    raise exception 'EC-L3E-07-5: reference.audience_bands no longer matches the order of 0320';
  end if;

  -- RG88: the version of 0320, the latest
  if not exists (select 1 from search.facet_config_versions v
                  where v.note like 'L3E 0320:%'
                    and v.version = (select max(w.version) from search.facet_config_versions w)) then
    raise exception 'RG88: the version of 0320 is missing or not the latest';
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE') then
    raise exception 'influx_creator_search_definer left with a member or CREATE';
  end if;
end
$$;
