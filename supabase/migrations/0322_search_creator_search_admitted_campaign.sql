-- =============================================================================
-- 0322_search_creator_search_admitted_campaign
-- -----------------------------------------------------------------------------
-- Lot 3 / L3F, commit 02 (jalons/l3f/02.md; l3f-fiche.md invariants 4, 15; jalons/l3f/modele.md §1,
-- which PREVAILS for every name; L3ES-1 of archives/jalons/l3e/annexe.md; 10 RG31, CA33). Only a
-- campaign out of draft anchors a creator search: a draft or rejected campaign of origin answers as an
-- unknown one. Signalled I-4 (03): the door and the engine are recreated (EXECUTE kept), a new invoker
-- helper, a column GRANT to their owner.
--
-- L3ES-1: in draft (and after a rejection) the brand writes its campaign (the guard of 0303 and
-- 0307), so it could change the sector of a draft and search from it again, its count telling which
-- creators refuse that sector (RG31, art. 9 GDPR). From 0322 a campaign of origin is admitted when it
-- is the caller's, not erased, and pending_review, published, paused or closed (the states where its
-- sector is frozen); draft and rejected answer P0002 DETAIL campaign, like an unknown campaign,
-- nothing written nor counted.
--
-- 1. search.is_admitted_campaign(advertiser, campaign) (modele §1): THE source of the admission,
--    SECURITY INVOKER, STABLE, owned by influx_creator_search_definer, executed by its owner only;
--    false for a NULL campaign. Read by the door and the engine here, by the profile, the shortlists
--    and the request of L3F next.
-- 2. search.creator_candidates() recreated at equal signature: E6 reads the sector of an admitted
--    campaign only (the brand's own sectors unchanged).
-- 3. search.search_creators() recreated at equal signature from 0320: the campaign of origin checked
--    by 1; nothing else changes (the order, the reasons, the journal, the bucket, the pages).
-- 4. The owner reads status of campaigns.campaigns (its policy unchanged: the caller's own rows).
--
-- RIGHTS (03 I-4, signalled): SELECT (status) on campaigns.campaigns to influx_creator_search_definer;
-- a new function of the owner, executed by nobody. Nothing new to influx_advertiser.
--
-- Not here: the route, the contract, the order, the reasons, the screens (jalons/l3f/02.md); the
-- shortlists and the request (0324, 0325), which read the same helper.
--
-- EC-L3F-02 (micro-gaps, the safest choice):
--   EC-L3F-02-1  two pinned lists of L3E-T6 grow by one entry, none altered: the invoker helpers of the
--                owner (is_admitted_campaign, a sixth) and the columns of a campaign it reads (status,
--                a fifth), as modele §1 orders; for expert-cybersecurite.
--   EC-L3F-02-2  the fixtures of L3E-T6 and L3E-T7 create their campaigns of origin pending_review
--                (the first admitted state), their expectations unchanged.
--
-- ROLLBACK (before any search is journaled once 0322 is applied): re-run the engine of 0319 and the
-- door of 0320; drop function search.is_admitted_campaign(uuid, uuid); revoke select (status) on
-- campaigns.campaigns from influx_creator_search_definer.
-- =============================================================================

-- 1. What the owner reads beyond 0319 and 0320 (modele §1) -------------------------------------------

-- the state of the caller's own campaigns (its policy campaigns_creator_search_definer_select, 0319)
grant select (status) on campaigns.campaigns to influx_creator_search_definer;

-- 2. The helper, the engine and the door, as influx_creator_search_definer (03 P7 rule 5) ------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_search_definer', current_user);
end
$$;
grant create on schema search to influx_creator_search_definer;
set role influx_creator_search_definer;

-- 2.1 THE admission of a campaign of origin (modele §1; L3ES-1)
create or replace function search.is_admitted_campaign(
  p_advertiser_account_id  uuid,
  p_campaign_id            uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select p_advertiser_account_id is not null and p_campaign_id is not null
         and exists (select 1 from campaigns.campaigns c
                      where c.id = p_campaign_id
                        and c.advertiser_account_id = p_advertiser_account_id
                        and c.erased_at is null
                        and c.status in ('pending_review', 'published', 'paused', 'closed'));
$$;

comment on function search.is_admitted_campaign(uuid, uuid) is
  'l3f/modele.md §1 (0322, L3ES-1; 10 RG31): whether p_campaign_id is a campaign of origin admitted '
  'for the brand p_advertiser_account_id: its own, not erased, pending_review, published, paused or '
  'closed (its sector frozen). Draft and rejected (the brand writes them) are not, nor an unknown '
  'campaign, another brand''s or NULL: the callers answer them alike. THE one source of the door, the '
  'engine (E6), the profile, the shortlists and the request. SECURITY INVOKER owned by '
  'influx_creator_search_definer, executed by its owner only.';

-- 2.2 THE engine, at equal signature (10 RG4, RG17, RG26 to RG31; E6 from an admitted campaign only)
create or replace function search.creator_candidates(
  p_mode                   text,
  p_advertiser_account_id  uuid,
  p_filters                jsonb,
  p_campaign_id            uuid)
returns table (
  creator_account_id  uuid,
  published_at        timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_f1          text;
  v_f3          text[];
  v_f4          text[];
  v_f6_country  text;
  v_f6_shares   text[];
  v_f8          text[];
  v_f11         text[];
  v_f17         text[];
  v_sectors     text[];
begin
  -- one engine, two modes (RG4): the identified view comes with its own door at L3G
  if p_mode = 'agent_identified' then
    raise exception 'identified_view_not_available'
      using errcode = 'feature_not_supported', detail = 'agent_identified';
  end if;
  if p_mode is distinct from 'advertiser_anonymous' or p_advertiser_account_id is null
     or p_filters is null then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'mode';
  end if;

  v_f1 := p_filters ->> 'F1';
  v_f6_country := p_filters #>> '{F6,country}';
  if p_filters ? 'F3' then
    v_f3 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'F3') x);
  end if;
  if p_filters ? 'F4' then
    v_f4 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'F4') x);
  end if;
  if p_filters -> 'F6' ? 'shareBands' then
    v_f6_shares := array(select x from pg_catalog.jsonb_array_elements_text(
                                         p_filters #> '{F6,shareBands}') x);
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

  -- E6: the main sector of the brand, its secondary ones, the sector of its campaign of origin when
  -- that campaign is admitted (0322, L3ES-1: a draft's sector, which the brand writes, never counts)
  v_sectors := array(
    select a.primary_sector_code from profiles.advertiser_profiles a
     where a.account_id = p_advertiser_account_id and a.primary_sector_code is not null
    union
    select s.sector_code from profiles.advertiser_secondary_sectors s
     where s.account_id = p_advertiser_account_id
    union
    select c.sector_code from campaigns.campaigns c
     where search.is_admitted_campaign(p_advertiser_account_id, p_campaign_id)
       and c.id = p_campaign_id and c.advertiser_account_id = p_advertiser_account_id
       and c.sector_code is not null);

  return query
  select p.account_id, p.published_at
    from profiles.creator_public_profiles p
    join identity.accounts a on a.id = p.account_id
   -- E1, E2 (07 RG3, RG8)
   where p.status = 'published'
     and p.is_searchable
     -- E3 (07 RG11, L2GS-8), E4 (D15)
     and a.status = 'active'
     and a.is_adult_attested
     -- E5 (RG28): an active block of the pair, whoever posed it, silently (RG29, RG30)
     and not exists (select 1 from matching.party_blocks b
                       where b.advertiser_account_id = p_advertiser_account_id
                         and b.creator_account_id = p.account_id
                         and b.lifted_at is null)
     -- E6 (07 RG75, RG31): a sector of the brand or of its campaign the creator refuses, silently
     and not exists (select 1 from profiles.creator_refused_sectors r
                       where r.account_id = p.account_id
                         and r.sector_code = any (v_sectors))
     -- F1: the main topic
     and (v_f1 is null or p.primary_topic_code = v_f1)
     -- F6: the main country of the audience AND its share, together (RG17)
     and (v_f6_country is null
          or (p.main_audience_country::text = v_f6_country
              and (v_f6_shares is null or p.main_audience_share_band = any (v_f6_shares))))
     -- F3 and F4 on ONE listed line (RG17, CA9)
     and ((v_f3 is null and v_f4 is null)
          or exists (select 1 from profiles.creator_public_networks n
                      where n.account_id = p.account_id
                        and n.listed_at is not null
                        and (v_f3 is null or n.network_code = any (v_f3))
                        and (v_f4 is null or n.audience_band = any (v_f4))))
     -- F8: a language of publication
     and (v_f8 is null
          or exists (select 1 from profiles.creator_publication_languages l
                      where l.account_id = p.account_id and l.language_code::text = any (v_f8)))
     -- F11: a format offered
     and (v_f11 is null
          or exists (select 1 from profiles.creator_formats f
                      where f.account_id = p.account_id and f.format_code = any (v_f11)))
     -- F17: a holding badge of a listed line (EC-L3E-06-5)
     and (v_f17 is null
          or exists (select 1 from profiles.creator_public_networks n
                       join verification.badges g
                         on g.account_id = n.account_id and g.social_account_id = n.social_account_id
                      where n.account_id = p.account_id
                        and n.listed_at is not null
                        and g.level::text = any (v_f17)
                        and g.state in ('active', 'to_refresh')));
end
$$;

comment on function search.creator_candidates(text, uuid, jsonb, uuid) is
  'l3e/modele.md §1, §3 (0319, 0322; 10 RG4, RG17, RG26 to RG31): THE engine of the creator search, '
  'its mode advertiser_anonymous (agent_identified: 0A000 until L3G). The storefronts that pass E1 to '
  'E6 (published, searchable, account active, majority attested, no active block of the pair in '
  'either direction, no sector of the brand nor of its campaign of origin refused, that campaign '
  'counted only when search.is_admitted_campaign() admits it) and the filters already checked by '
  'search.check_creator_search_filters(): OR inside a facet, AND between them, F3 and F4 on one '
  'listed line, F6 country and share together, F17 a holding badge of a listed line. An exclusion '
  'is silent: absent, never counted, its motive neither served nor journaled. Returns the account '
  'and published_at (the order of 0320). SECURITY INVOKER owned by influx_creator_search_definer, '
  'executed by its owner only.';

-- 2.3 The door, at equal signature (the door of 0320, its campaign of origin admitted by 2.1)
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

  -- the closed entry (22023), the campaign of origin: unknown, of another brand, erased, in draft or
  -- rejected (0322, L3ES-1), one answer, nothing written nor counted
  perform search.check_creator_search_filters(p_filters);
  if p_campaign_id is not null and not search.is_admitted_campaign(v_caller, p_campaign_id) then
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
  '10 RG1, RG2, RG4, RG17, RG26 to RG31, RG35 to RG46, RG57 to RG59, RG63 to RG66 (0319, 0320, 0322; '
  'l3e/modele.md §1 to §8, l3f/modele.md §1): a page of the anonymous creator search of the calling '
  'brand (search.require_creator_searcher: 42501 otherwise). p_sort default, audience, '
  'verified_first, new_profiles and p_page 1 to 50 (22023 DETAIL sort or page, nothing written). '
  'Then: a brand profile not published {state: brand_not_published}; the switch false {state: '
  'closed} (nothing written nor counted); the bucket full {state: rate_limited, retryAfterSeconds} '
  '(a line per window); the filters (search.check_creator_search_filters, 22023 DETAIL filters) and '
  'the campaign of origin (not admitted by search.is_admitted_campaign: unknown, of another brand, '
  'erased, in draft or rejected, P0002 DETAIL campaign, nothing written nor counted); a page beyond '
  'max_pages {state: page_cap}; the count after the exclusions below k {state: too_narrow}, nothing '
  'else; otherwise {state: results, countBand, page, nextPage, capReached, cards: [{creator '
  '(profiles.creator_layer_a without status nor lineKey), reasons [{code, params}], vigilance}]}, '
  'page_size cards in the order of search.creator_order() for the UTC day. Every outcome but closed, '
  'brand_not_published and an error writes its line of search.search_queries (exact count, never '
  'served), a served page its impressions (rank, cold_quota, note), their reasons and on page 1 its '
  'exposures, in the transaction that serves. SECURITY DEFINER owned by '
  'influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

-- 3. Rights on the functions (03 P7 rule 5), then the owner given back -------------------------------

revoke all on function search.is_admitted_campaign(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.creator_candidates(text, uuid, jsonb, uuid)
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

-- 4. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner   constant text := 'influx_creator_search_definer';
  c_helper  constant text := 'search.is_admitted_campaign(uuid, uuid)';
  c_engine  constant text := 'search.creator_candidates(text, uuid, jsonb, uuid)';
  c_door    constant text := 'search.search_creators(jsonb, text, integer, uuid)';
  v_def     record;
  v_bad     text;
begin
  -- the helper, the engine and the door: owner, mode, empty search_path
  for v_def in
    select * from (values (c_helper, false), (c_engine, false), (c_door, true)) as d (fn, definer)
  loop
    if (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
         where p.oid = v_def.fn::regprocedure) <> c_owner
       or (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_def.fn::regprocedure)
            is distinct from v_def.definer
       or (select p.proconfig from pg_catalog.pg_proc p where p.oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by %, SECURITY %, empty search_path',
        v_def.fn, c_owner, case when v_def.definer then 'DEFINER' else 'INVOKER' end;
    end if;
  end loop;

  -- EXECUTE: the door to influx_advertiser, the helper and the engine to nobody
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in (c_helper::regprocedure, c_engine::regprocedure, c_door::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (p.oid = c_door::regprocedure and a.grantee = 'influx_advertiser'::regrole);
  if v_bad is not null then
    raise exception 'executable beyond their callers: %', v_bad;
  end if;

  -- 03 P7, fiche invariant 4: no dynamic SQL in a function of the owner
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'a function of the creator search runs dynamic SQL: %', v_bad;
  end if;

  -- the door and the engine read the campaign of origin through the helper alone
  if (select p.prosrc from pg_catalog.pg_proc p where p.oid = c_door::regprocedure)
       !~ 'search\.is_admitted_campaign\(v_caller, p_campaign_id\)'
     or (select p.prosrc from pg_catalog.pg_proc p where p.oid = c_door::regprocedure)
       ~ 'campaigns\.campaigns'
     or (select p.prosrc from pg_catalog.pg_proc p where p.oid = c_engine::regprocedure)
       !~ 'search\.is_admitted_campaign\(p_advertiser_account_id, p_campaign_id\)' then
    raise exception 'L3ES-1: the door or the engine reads a campaign of origin outside is_admitted_campaign()';
  end if;

  -- of a campaign, the five columns of the origin only (0319 and status, modele §1)
  select string_agg(at.attname, ', ' order by at.attname) into v_bad
    from pg_catalog.pg_attribute at
   where at.attrelid = 'campaigns.campaigns'::regclass
     and at.attnum > 0 and not at.attisdropped
     and pg_catalog.has_column_privilege(c_owner, at.attrelid, at.attnum, 'SELECT')
     and at.attname not in ('id', 'advertiser_account_id', 'sector_code', 'erased_at', 'status');
  if v_bad is not null then
    raise exception 'influx_creator_search_definer reads a column of a campaign it must not: %', v_bad;
  end if;
  if not pg_catalog.has_column_privilege(c_owner, 'campaigns.campaigns', 'status', 'SELECT') then
    raise exception 'influx_creator_search_definer must read the status of a campaign (L3ES-1)';
  end if;

  -- fiche invariant 4: the brand gains nothing, it still executes the door alone in search
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'search'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
     and p.oid <> c_door::regprocedure;
  if v_bad is not null then
    raise exception 'influx_advertiser executes a search function beyond its door: %', v_bad;
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE') then
    raise exception 'influx_creator_search_definer left with a member or CREATE';
  end if;
end
$$;
