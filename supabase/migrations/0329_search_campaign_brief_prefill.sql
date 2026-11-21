-- =============================================================================
-- 0329_search_campaign_brief_prefill
-- -----------------------------------------------------------------------------
-- Lot 3 / L3G, commit 05 (jalons/l3g/05.md; l3g-fiche.md invariants 5, 12, 2, 3, 8, 14; jalons/l3g/
-- modele.md §4, which PREVAILS for every name; 10 RG9, RG73, CA56; D78).
-- « Compatible creators »: the facets of the base drawn from the brief of an admitted campaign, the
-- prefill proposed journaled, then what the agent keeps, removes and adds, read from the searches that
-- name it. Signalled I-4 (03): a new table, a SECURITY DEFINER door, the identified door recreated,
-- column GRANTs and their policies to influx_agent_search_definer.
--
-- 1. search.campaign_prefills (id, account_id, campaign_id, proposed, created_at): one line per
--    prefill proposed to an agent, the filters drawn from the brief, CODES only (keys F1, F3, F4, F6,
--    F8, F11 by CHECK: never F12, F17, G, a band nor a budget, D78). RLS forced, the restrictive member
--    policy, no right for any execution role; append-only (search.guard_search_journal_write() of
--    0316); neither exported nor erased (modele §4: codes only, an internal author); 12 months (Lot 6).
-- 2. search.search_queries gains prefill_id (-> search.campaign_prefills): NULL outside the identified
--    view and without a campaign (CHECK search_queries_prefill_identified).
-- 3. search.prefill_campaign_filters(campaign) (modele §4): SECURITY DEFINER, empty search_path,
--    EXECUTE for influx_agent and influx_admin ONLY. The caller of the identified door
--    (search.require_identified_searcher(), 42501); the campaign admitted for its own brand, any brand
--    (search.is_admitted_campaign(), otherwise P0002 campaign: unknown, erased, draft, rejected alike,
--    nothing written); then, each facet OPEN in table and present in the brief (10 RG9):
--      F1  the topic of rank 1 (campaign_topics, lowest slot)
--      F3  the networks of the deliverables          F11  the formats of the deliverables
--      F4  the audience bands aimed at               F6   {country}: the audience country of rank 1
--      F8  the audience languages
--    a closed facet or an empty field omitted; never F17, the usage rights, the exclusivity, the age
--    bands, the gender, a band nor a budget (D78, modele -3). The filters pass the closed entry of the
--    base (search.check_creator_search_filters(), the form of p_filters). The proposed line written,
--    it answers {prefillId, campaign: {id, title}, filters}.
-- 4. search.search_creators_identified() recreated at equal signature, owner and EXECUTE: the 0A000 of
--    p_prefill_id becomes the check of modele §4 (after the campaign): a prefill of the caller, of the
--    campaign of the call, younger than 24 h, otherwise P0002 prefill, nothing written; a served call
--    or a page_cap journals prefill_id (« Vider », the filters emptied, keeps the link).
-- 5. search.prefill_diff(proposed, filters) (modele §4): IMMUTABLE, SECURITY INVOKER, reads no table,
--    executed by its owner only (no right). {retained, removed, added}: a list facet by its values, an
--    object facet (F6, G9) key by key, any other value whole.
--
-- RIGHTS (03 I-4, signalled), all to influx_agent_search_definer: SELECT (title) on campaigns.campaigns
-- (its policy of 0328: the admitted campaigns); SELECT (slot) on campaigns.campaign_audience_countries;
-- SELECT on campaigns.campaign_topics (campaign_id, slot, topic_code), campaign_audience_bands
-- (campaign_id, audience_band_code), campaign_audience_languages (campaign_id, language_code), each with
-- its policy (the campaigns it reads); SELECT (id, account_id, campaign_id, proposed, created_at) and
-- INSERT (account_id, campaign_id, proposed) on search.campaign_prefills with their policies (the
-- caller's own lines, an admitted campaign); INSERT (prefill_id) on search.search_queries, its insert
-- policy recreated (a prefill of the caller, of the same campaign). EXECUTE on the new door to
-- influx_agent and influx_admin. NOTHING new to influx_advertiser, influx_creator nor
-- influx_creator_search_definer.
--
-- Not here: the routes and contracts (L3G-09: POST /v1/bo/campaigns/:id/creator-prefill, 60/min per
-- address), the screen (L3G-12), the prefill offered to the brand (RG75, US7), the journal screen
-- (Lot 5), the purge at 12 months (Lot 6).
--
-- EC-L3G-05 (micro-gaps, the safest choice):
--   EC-L3G-05-1  the lists are in code order (collate "C"), each value once; the order carries no
--                meaning (OR inside a facet, RG17) and prefill_diff compares them as sets.
--   EC-L3G-05-2  F8: the campaign's audience languages are not bounded in table; the first 20 in code
--                order are proposed (the bound of a list, RG17), never a refusal of the brief.
--   EC-L3G-05-3  the topic and the audience country « of rank 1 » are those of the lowest slot.
--   EC-L3G-05-4  a prefill whose brief yields no open facet answers filters {} and is journaled all
--                the same (the agent searched from that campaign).
--   EC-L3G-05-5  a prefill without a campaign in the call, of another agent, of another campaign or
--                older than 24 h are refused alike (P0002 prefill), after the campaign (P0002
--                campaign first); « younger than 24 h » is created_at > now() - 24 h.
--   EC-L3G-05-6  prefill_diff of two objects (F6, G9) diffs them key by key (F6 {country} kept and
--                shareBands added read retained {F6: {country}}, added {F6: {shareBands}}); its
--                arguments must be objects (22023 filters otherwise).
--
-- ROLLBACK (before any prefill is proposed once 0329 is applied): recreate the door of 0328 (as
-- influx_agent_search_definer); drop search.prefill_campaign_filters() and search.prefill_diff();
-- recreate the insert policy of search_queries of 0328 and revoke insert (prefill_id); drop the column
-- search_queries.prefill_id and its CHECK; drop table search.campaign_prefills; drop the policies
-- *_agent_search_definer_select of campaign_topics, campaign_audience_bands, campaign_audience_languages
-- and revoke their grants, revoke select (title) on campaigns.campaigns and select (slot) on
-- campaigns.campaign_audience_countries.
-- =============================================================================

-- 1. The prefills proposed (modele §4) ------------------------------------------------------------

create table if not exists search.campaign_prefills (
  id           uuid        not null default gen_random_uuid() primary key,
  account_id   uuid        not null references identity.accounts (id),
  campaign_id  uuid        not null references campaigns.campaigns (id),
  proposed     jsonb       not null,
  created_at   timestamptz not null default now(),

  -- codes only, the facets of the base a brief can fill (modele §4, -3; D78): never F12, F17 nor G
  constraint campaign_prefills_proposed check (
    jsonb_typeof(proposed) = 'object'
    and pg_column_size(proposed) <= 2000
    and (proposed - 'F1' - 'F3' - 'F4' - 'F6' - 'F8' - 'F11') = '{}'::jsonb
    and (not (proposed ? 'F6')
         or (jsonb_typeof(proposed -> 'F6') = 'object'
             and ((proposed -> 'F6') - 'country') = '{}'::jsonb)))
);

-- the check of the door (the caller's prefill, 24 h)
create index if not exists campaign_prefills_account_idx
  on search.campaign_prefills (account_id, created_at desc);

comment on table search.campaign_prefills is
  'The prefills of « Compatible creators » (l3g/modele.md §4; 10 RG73, CA56): one line per prefill '
  'proposed to an agent, the filters drawn from the brief of an admitted campaign (codes of F1, F3, F4, '
  'F6 country, F8, F11 only: never F12, F17, G, a band nor a budget, D78). Written by '
  'search.prefill_campaign_filters() only; the identified searches that start from it name it '
  '(search_queries.prefill_id), what was kept, removed and added is search.prefill_diff(proposed, '
  'filters). RLS forced, no member nor execution right; append-only; neither exported nor erased '
  '(codes only, an internal author); kept 12 months (purge at Lot 6).';

alter table search.campaign_prefills enable row level security;
alter table search.campaign_prefills force row level security;
revoke all on search.campaign_prefills
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;
drop policy if exists campaign_prefills_no_member_access on search.campaign_prefills;
create policy campaign_prefills_no_member_access on search.campaign_prefills
  as restrictive for all to influx_advertiser, influx_creator using (false) with check (false);

drop trigger if exists campaign_prefills_immutable on search.campaign_prefills;
create trigger campaign_prefills_immutable
  before update or delete on search.campaign_prefills
  for each row execute function search.guard_search_journal_write();

-- 2. The link of a search to its prefill (modele §4) ----------------------------------------------

alter table search.search_queries
  add column if not exists prefill_id uuid references search.campaign_prefills (id);

alter table search.search_queries drop constraint if exists search_queries_prefill_identified;
alter table search.search_queries add constraint search_queries_prefill_identified
  check (prefill_id is null or (view_mode = 'agent_identified' and campaign_id is not null));

create index if not exists search_queries_prefill_idx
  on search.search_queries (prefill_id) where prefill_id is not null;

comment on column search.search_queries.prefill_id is
  'The prefill of « Compatible creators » the identified search starts from (0329, l3g/modele.md §4): '
  'NULL outside agent_identified and without a campaign; the filters of the line against its proposed '
  'filters read what the agent kept, removed and added (search.prefill_diff). « Vider » keeps it.';

-- 3. What influx_agent_search_definer reads and writes for the prefill (modele §4) ----------------

-- the title of an admitted campaign (its policy of 0328), the rank of an audience country
grant select (title) on campaigns.campaigns to influx_agent_search_definer;
grant select (slot) on campaigns.campaign_audience_countries to influx_agent_search_definer;

-- the topics, the audience bands and languages of the admitted campaigns
grant select (campaign_id, slot, topic_code)
   on campaigns.campaign_topics to influx_agent_search_definer;
grant select (campaign_id, audience_band_code)
   on campaigns.campaign_audience_bands to influx_agent_search_definer;
grant select (campaign_id, language_code)
   on campaigns.campaign_audience_languages to influx_agent_search_definer;

drop policy if exists campaign_topics_agent_search_definer_select on campaigns.campaign_topics;
create policy campaign_topics_agent_search_definer_select on campaigns.campaign_topics
  for select to influx_agent_search_definer
  using (exists (select 1 from campaigns.campaigns c where c.id = campaign_topics.campaign_id));

drop policy if exists campaign_audience_bands_agent_search_definer_select
  on campaigns.campaign_audience_bands;
create policy campaign_audience_bands_agent_search_definer_select
  on campaigns.campaign_audience_bands
  for select to influx_agent_search_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.id = campaign_audience_bands.campaign_id));

drop policy if exists campaign_audience_languages_agent_search_definer_select
  on campaigns.campaign_audience_languages;
create policy campaign_audience_languages_agent_search_definer_select
  on campaigns.campaign_audience_languages
  for select to influx_agent_search_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.id = campaign_audience_languages.campaign_id));

-- its own prefills: inserted for an admitted campaign, read back for the check of the door
grant select (id, account_id, campaign_id, proposed, created_at),
      insert (account_id, campaign_id, proposed)
   on search.campaign_prefills to influx_agent_search_definer;

drop policy if exists campaign_prefills_agent_search_definer_select on search.campaign_prefills;
create policy campaign_prefills_agent_search_definer_select on search.campaign_prefills
  for select to influx_agent_search_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists campaign_prefills_agent_search_definer_insert on search.campaign_prefills;
create policy campaign_prefills_agent_search_definer_insert on search.campaign_prefills
  for insert to influx_agent_search_definer
  with check (account_id = (select influx.current_account_id())
              and exists (select 1 from campaigns.campaigns c
                           where c.id = campaign_prefills.campaign_id));

-- the link written by the door: a prefill of the caller, of the campaign of the line
grant insert (prefill_id) on search.search_queries to influx_agent_search_definer;

drop policy if exists search_queries_agent_search_definer_insert on search.search_queries;
create policy search_queries_agent_search_definer_insert on search.search_queries
  for insert to influx_agent_search_definer
  with check (account_id = (select influx.current_account_id())
              and actor_role in ('agent', 'admin')
              and actor_role = (select influx.current_account_role())::text
              and view_mode = 'agent_identified'
              and (prefill_id is null
                   or exists (select 1 from search.campaign_prefills p
                               where p.id = search_queries.prefill_id
                                 and p.account_id = search_queries.account_id
                                 and p.campaign_id = search_queries.campaign_id)));

-- 4. The functions, as influx_agent_search_definer (03 P7 rule 5) ---------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_agent_search_definer', current_user);
end
$$;
grant create on schema search to influx_agent_search_definer;
set role influx_agent_search_definer;

-- 4.1 The prefill of a campaign (modele §4; 10 RG9, RG73; fiche invariants 5, 12)
create or replace function search.prefill_campaign_filters(p_campaign_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid;
  v_brand    uuid;
  v_title    text;
  v_open     text[];
  v_filters  jsonb := '{}'::jsonb;
  v_list     jsonb;
  v_value    text;
  v_prefill  uuid;
begin
  v_caller := search.require_identified_searcher();

  -- an admitted campaign of any brand (0322); unknown, erased, draft and rejected alike (T14)
  select c.advertiser_account_id, c.title into v_brand, v_title
    from campaigns.campaigns c where c.id = p_campaign_id;
  if not search.is_admitted_campaign(v_brand, p_campaign_id) then
    raise exception 'campaign_not_found' using errcode = 'no_data_found', detail = 'campaign';
  end if;

  -- the facets of the base open in table (RG11, RG12): a closed one is omitted, never required
  select coalesce(pg_catalog.array_agg(f.facet_code), '{}'::text[]) into v_open
    from search.facet_settings f
   where f.is_open and f.wave = 1 and f.facet_code in ('F1', 'F3', 'F4', 'F6', 'F8', 'F11');

  -- F1: the topic of rank 1 (EC-L3G-05-3)
  if 'F1' = any (v_open) then
    select t.topic_code into v_value
      from campaigns.campaign_topics t
     where t.campaign_id = p_campaign_id
     order by t.slot limit 1;
    if v_value is not null then
      v_filters := v_filters || pg_catalog.jsonb_build_object('F1', v_value);
    end if;
  end if;

  -- F3: the networks of the deliverables (EC-L3G-05-1)
  if 'F3' = any (v_open) then
    select pg_catalog.jsonb_agg(n.code order by n.code collate "C") into v_list
      from (select distinct d.network_code as code
              from campaigns.campaign_deliverables d where d.campaign_id = p_campaign_id) n;
    if v_list is not null then
      v_filters := v_filters || pg_catalog.jsonb_build_object('F3', v_list);
    end if;
  end if;

  -- F4: the audience bands aimed at
  if 'F4' = any (v_open) then
    select pg_catalog.jsonb_agg(b.audience_band_code order by b.audience_band_code collate "C")
      into v_list
      from campaigns.campaign_audience_bands b where b.campaign_id = p_campaign_id;
    if v_list is not null then
      v_filters := v_filters || pg_catalog.jsonb_build_object('F4', v_list);
    end if;
  end if;

  -- F6: the audience country of rank 1, without a share (the brief names none)
  if 'F6' = any (v_open) then
    v_value := null;
    select a.country_code into v_value
      from campaigns.campaign_audience_countries a
     where a.campaign_id = p_campaign_id
     order by a.slot limit 1;
    if v_value is not null then
      v_filters := v_filters
                   || pg_catalog.jsonb_build_object('F6', pg_catalog.jsonb_build_object('country',
                                                                                         v_value));
    end if;
  end if;

  -- F8: the audience languages, 20 at most (EC-L3G-05-2)
  if 'F8' = any (v_open) then
    select pg_catalog.jsonb_agg(l.code order by l.code collate "C") into v_list
      from (select x.language_code::text as code
              from campaigns.campaign_audience_languages x
             where x.campaign_id = p_campaign_id
             order by x.language_code collate "C" limit 20) l;
    if v_list is not null then
      v_filters := v_filters || pg_catalog.jsonb_build_object('F8', v_list);
    end if;
  end if;

  -- F11: the formats of the deliverables
  if 'F11' = any (v_open) then
    select pg_catalog.jsonb_agg(f.code order by f.code collate "C") into v_list
      from (select distinct d.format_code as code
              from campaigns.campaign_deliverables d where d.campaign_id = p_campaign_id) f;
    if v_list is not null then
      v_filters := v_filters || pg_catalog.jsonb_build_object('F11', v_list);
    end if;
  end if;

  -- the form of p_filters, by the closed entry of the base (one engine, RG4)
  perform search.check_creator_search_filters(v_filters);

  -- CA56: the proposed filters journaled, in the transaction that serves
  insert into search.campaign_prefills (account_id, campaign_id, proposed)
  values (v_caller, p_campaign_id, v_filters)
  returning id into v_prefill;

  return pg_catalog.jsonb_build_object(
    'prefillId', v_prefill,
    'campaign',  pg_catalog.jsonb_build_object('id', p_campaign_id, 'title', v_title),
    'filters',   v_filters);
end
$$;

comment on function search.prefill_campaign_filters(uuid) is
  '10 RG9, RG73, CA56 (0329; l3g/modele.md §4; D78): the facets of the base drawn from the brief of '
  'an admitted campaign for « Compatible creators ». The caller of the identified view '
  '(search.require_identified_searcher: agent or admin, active account and internal profile, aal2; '
  '42501 otherwise); the campaign admitted for its own brand, any brand (search.is_admitted_campaign; '
  'unknown, erased, draft, rejected: P0002 DETAIL campaign, nothing written). Each facet OPEN in table '
  'with a field in the brief: F1 the topic of rank 1, F3 and F11 the networks and formats of the '
  'deliverables, F4 the audience bands, F6 {country} of rank 1, F8 the languages (20 at most); never '
  'F17, rights, exclusivity, ages, a band nor a budget. Checked by search.check_creator_search_filters, '
  'written in search.campaign_prefills; answers {prefillId, campaign: {id, title}, filters}. SECURITY '
  'DEFINER owned by influx_agent_search_definer, empty search_path; EXECUTE for influx_agent and '
  'influx_admin only.';

-- 4.2 What the agent kept, removed and added (modele §4; 10 RG73)
create or replace function search.prefill_diff(p_proposed jsonb, p_filters jsonb)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_key       text;
  v_p         jsonb;
  v_f         jsonb;
  v_part      jsonb;
  v_sub       jsonb;
  v_retained  jsonb := '{}'::jsonb;
  v_removed   jsonb := '{}'::jsonb;
  v_added     jsonb := '{}'::jsonb;
begin
  if p_proposed is null or pg_catalog.jsonb_typeof(p_proposed) is distinct from 'object'
     or p_filters is null or pg_catalog.jsonb_typeof(p_filters) is distinct from 'object' then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'filters';
  end if;
  for v_key in
    select k.key
      from (select pg_catalog.jsonb_object_keys(p_proposed) as key
            union
            select pg_catalog.jsonb_object_keys(p_filters)) k
     order by k.key collate "C"
  loop
    v_p := p_proposed -> v_key;
    v_f := p_filters -> v_key;
    if pg_catalog.jsonb_typeof(v_p) = 'array' and pg_catalog.jsonb_typeof(v_f) = 'array' then
      -- a list: its values (OR inside a facet, RG17)
      select pg_catalog.jsonb_agg(e.x order by e.ord) into v_part
        from pg_catalog.jsonb_array_elements(v_p) with ordinality e (x, ord)
       where v_f @> pg_catalog.jsonb_build_array(e.x);
      if v_part is not null then
        v_retained := v_retained || pg_catalog.jsonb_build_object(v_key, v_part);
      end if;
      select pg_catalog.jsonb_agg(e.x order by e.ord) into v_part
        from pg_catalog.jsonb_array_elements(v_p) with ordinality e (x, ord)
       where not (v_f @> pg_catalog.jsonb_build_array(e.x));
      if v_part is not null then
        v_removed := v_removed || pg_catalog.jsonb_build_object(v_key, v_part);
      end if;
      select pg_catalog.jsonb_agg(e.x order by e.ord) into v_part
        from pg_catalog.jsonb_array_elements(v_f) with ordinality e (x, ord)
       where not (v_p @> pg_catalog.jsonb_build_array(e.x));
      if v_part is not null then
        v_added := v_added || pg_catalog.jsonb_build_object(v_key, v_part);
      end if;
    elsif pg_catalog.jsonb_typeof(v_p) = 'object' and pg_catalog.jsonb_typeof(v_f) = 'object' then
      -- an object (F6, G9): key by key (EC-L3G-05-6)
      v_sub := search.prefill_diff(v_p, v_f);
      if v_sub -> 'retained' <> '{}'::jsonb then
        v_retained := v_retained || pg_catalog.jsonb_build_object(v_key, v_sub -> 'retained');
      end if;
      if v_sub -> 'removed' <> '{}'::jsonb then
        v_removed := v_removed || pg_catalog.jsonb_build_object(v_key, v_sub -> 'removed');
      end if;
      if v_sub -> 'added' <> '{}'::jsonb then
        v_added := v_added || pg_catalog.jsonb_build_object(v_key, v_sub -> 'added');
      end if;
    elsif v_p is not null and v_f is not null and v_p = v_f then
      v_retained := v_retained || pg_catalog.jsonb_build_object(v_key, v_p);
    else
      if v_p is not null then
        v_removed := v_removed || pg_catalog.jsonb_build_object(v_key, v_p);
      end if;
      if v_f is not null then
        v_added := v_added || pg_catalog.jsonb_build_object(v_key, v_f);
      end if;
    end if;
  end loop;
  return pg_catalog.jsonb_build_object('retained', v_retained, 'removed', v_removed,
                                       'added', v_added);
end
$$;

comment on function search.prefill_diff(jsonb, jsonb) is
  'l3g/modele.md §4 (0329; 10 RG73, CA56): what an agent kept, removed and added of a prefill: '
  '{retained, removed, added}, each an object of facets. A list by its values (in their order), an '
  'object (F6, G9) key by key, any other value whole (equal: retained; otherwise removed and added). '
  'Its arguments objects, 22023 DETAIL filters otherwise. IMMUTABLE, reads no table; SECURITY INVOKER '
  'owned by influx_agent_search_definer, executed by its owner only.';

-- 4.3 The door, at equal signature: the prefill checked and journaled (modele §1, §4)
create or replace function search.search_creators_identified(
  p_filters      jsonb,
  p_sort         text,
  p_page         integer,
  p_campaign_id  uuid,
  p_prefill_id   uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid;
  v_role       text;
  v_request    text := left(nullif(pg_catalog.current_setting('influx.request_id', true), ''), 100);
  v_day        date := pg_catalog.timezone('UTC', pg_catalog.now())::date;
  v_brand      uuid;
  v_version    bigint;
  v_page_size  integer;
  v_max_pages  integer;
  v_ids        uuid[];
  v_count      integer;
  v_from       integer;
  v_to         integer;
  v_query      uuid;
  v_page       jsonb;
  v_rows       jsonb;
begin
  v_caller := search.require_identified_searcher();
  v_role := influx.current_account_role()::text;

  -- the domain of the contract, refused before anything is written (EC-L3G-04-1)
  if p_sort is null or p_sort not in ('default', 'audience', 'verified_first', 'new_profiles') then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'sort';
  end if;
  if p_page is null or p_page not between 1 and 50 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'page';
  end if;
  perform search.check_identified_search_filters(p_filters);

  -- the campaign: admitted for its own brand (any brand, 0322), unknown, erased, in draft or
  -- rejected alike (P0002 campaign, T14), nothing written
  if p_campaign_id is not null then
    select c.advertiser_account_id into v_brand
      from campaigns.campaigns c where c.id = p_campaign_id;
    if not search.is_admitted_campaign(v_brand, p_campaign_id) then
      raise exception 'campaign_not_found' using errcode = 'no_data_found', detail = 'campaign';
    end if;
  end if;

  -- the prefill (modele §4, EC-L3G-05-5): the caller's, of the campaign of the call, younger than
  -- 24 h; otherwise P0002 prefill, nothing written
  if p_prefill_id is not null
     and (p_campaign_id is null
          or not exists (select 1 from search.campaign_prefills p
                          where p.id = p_prefill_id
                            and p.account_id = v_caller
                            and p.campaign_id = p_campaign_id
                            and p.created_at > pg_catalog.now() - interval '24 hours')) then
    raise exception 'prefill_not_found' using errcode = 'no_data_found', detail = 'prefill';
  end if;

  -- the pages of the identified view, read at every call (EC-L3E-06-3: missing is 55000)
  select (s.value ->> 'pageSize')::integer, (s.value ->> 'maxPages')::integer
    into v_page_size, v_max_pages
    from search.search_settings s where s.key = 'identified_view';
  if v_page_size is null or v_max_pages is null then
    raise exception 'creator_search_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'creator_search_settings';
  end if;

  select max(v.version) into v_version from search.facet_config_versions v;

  -- RG76, TM12.3: the cap of pages held by the base, the attempt journaled
  if p_page > v_max_pages then
    insert into search.search_queries
      (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
       facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id,
       prefill_id)
    values (v_caller, v_role, 'agent_identified', p_campaign_id, 'page_cap', p_filters, p_sort,
            v_version, 0, p_page, false, v_request, p_prefill_id);
    return pg_catalog.jsonb_build_object('state', 'page_cap');
  end if;

  -- RG4, RG71: the candidates of the one engine, its identified mode; no k (RG62), no switch (CA61)
  select coalesce(pg_catalog.array_agg(c.creator_account_id), '{}'::uuid[])
    into v_ids
    from search.creator_candidates('agent_identified', v_brand, p_filters, p_campaign_id) c;
  v_count := pg_catalog.cardinality(v_ids);

  -- RG78, CA58: the search, nominative, then its impressions and their reasons, in the transaction
  -- that serves; the exact count kept; RG73, CA56: the prefill it starts from
  insert into search.search_queries
    (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
     facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id,
     prefill_id)
  values (v_caller, v_role, 'agent_identified', p_campaign_id, 'served', p_filters, p_sort,
          v_version, v_count, p_page, false, v_request, p_prefill_id)
  returning id into v_query;

  v_from := (p_page - 1) * v_page_size + 1;
  v_to := p_page * v_page_size;

  -- the order of the brand's view as it is (cold quota included), its reasons and notes (RG77)
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id', o.creator_account_id, 'rank', o.place, 'cold', o.cold_quota,
           'reasons', o.reasons, 'vigilance', o.vigilance) order by o.place), '[]'::jsonb)
    into v_page
    from search.creator_order(v_ids, p_filters, p_sort, p_campaign_id, v_page_size, p_page,
                              v_day) o
   where o.place between v_from and v_to;

  -- EC-L3G-04-11: a profile never published has no date of publication, so the quota may leave its
  -- mark unknown; an impression is placed by the quota only when it says so
  insert into search.search_impressions
    (search_query_id, creator_account_id, rank, cold_quota, vigilance_code)
  select v_query, (e ->> 'id')::uuid, (e ->> 'rank')::smallint,
         coalesce((e ->> 'cold')::boolean, false), e ->> 'vigilance'
    from pg_catalog.jsonb_array_elements(v_page) e;

  insert into search.impression_reasons
    (search_query_id, creator_account_id, reason_code, position, reason_params)
  select v_query, (e ->> 'id')::uuid, x.reason ->> 'code', x.ord::smallint, x.reason -> 'params'
    from pg_catalog.jsonb_array_elements(v_page) e
    cross join lateral pg_catalog.jsonb_array_elements(e -> 'reasons') with ordinality x (reason, ord);

  -- RG87: the identified view never writes search.creator_exposures

  select coalesce(pg_catalog.jsonb_agg(
           search.identified_creator_row((s.card ->> 'id')::uuid, v_brand)
           || pg_catalog.jsonb_build_object('reasons', s.card -> 'reasons',
                                            'vigilance', s.card -> 'vigilance')
           order by s.ord), '[]'::jsonb)
    into v_rows
    from pg_catalog.jsonb_array_elements(v_page) with ordinality s (card, ord);

  -- 17b §3.3: the count is exact
  return pg_catalog.jsonb_build_object(
    'state',      'results',
    'total',      v_count,
    'page',       p_page,
    'nextPage',   case when v_count > p_page * v_page_size and p_page < v_max_pages
                       then p_page + 1 end,
    'capReached', p_page = v_max_pages and v_count > p_page * v_page_size,
    'rows',       v_rows);
end
$$;

comment on function search.search_creators_identified(jsonb, text, integer, uuid, uuid) is
  '10 RG4, RG62, RG71, RG72, RG73, RG76, RG78 (0328, 0329; l3g/modele.md §1 to §4; CA56, CA58, CA61; '
  '18 TM12.5): a page of the identified creator search of an INFLUX agent '
  '(search.require_identified_searcher: agent or admin, active account and internal profile, aal2; '
  '42501 otherwise). p_sort default, audience, verified_first, new_profiles and p_page 1 to 50 (22023 '
  'DETAIL sort or page); the filters (search.check_identified_search_filters, 22023 DETAIL filters); '
  'the campaign (admitted for its brand by search.is_admitted_campaign, otherwise P0002 DETAIL '
  'campaign); p_prefill_id a prefill of the caller for that campaign younger than 24 h '
  '(search.campaign_prefills), otherwise P0002 DETAIL prefill; identified_view missing 55000. Nothing '
  'written by an error. A page beyond maxPages {state: page_cap}; otherwise {state: results, total '
  '(exact), page, nextPage, capReached, rows: [search.identified_creator_row() || {reasons, '
  'vigilance}]}, pageSize rows in the order of search.creator_order() for the UTC day, from '
  'search.creator_candidates(agent_identified). Neither switch, k, bucket nor lock. Every outcome but '
  'an error writes its line of search.search_queries (actor_role agent or admin, view_mode '
  'agent_identified, exact count, prefill_id), a served page its impressions and their reasons, in the '
  'transaction that serves; never search.creator_exposures. SECURITY DEFINER owned by '
  'influx_agent_search_definer, empty search_path; EXECUTE for influx_agent and influx_admin only.';

-- 4.4 Rights on the functions (03 P7 rule 5), then the owner given back
revoke all on function search.prefill_campaign_filters(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.prefill_diff(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function search.prefill_campaign_filters(uuid) to influx_agent, influx_admin;

reset role;
revoke create on schema search from influx_agent_search_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_agent_search_definer', current_user);
end
$$;

-- 5. End-state assertions -------------------------------------------------------------------------

do $$
declare
  c_dynamic  constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner    constant text := 'influx_agent_search_definer';
  c_door     constant text := 'search.search_creators_identified(jsonb, text, integer, uuid, uuid)';
  c_prefill  constant text := 'search.prefill_campaign_filters(uuid)';
  c_diff     constant text := 'search.prefill_diff(jsonb, jsonb)';
  v_def      record;
  v_bad      text;
begin
  -- the owner keeps no CREATE nor member
  if pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE')
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option)) then
    raise exception '% must stay without member nor CREATE (03 P7)', c_owner;
  end if;

  -- the functions: owner, mode, volatility, empty search_path
  for v_def in
    select * from (values (c_door, true, 'v'), (c_prefill, true, 'v'), (c_diff, false, 'i'))
      as d (fn, definer, volatility)
  loop
    if (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
         where p.oid = v_def.fn::regprocedure) <> c_owner
       or (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_def.fn::regprocedure)
            is distinct from v_def.definer
       or (select p.provolatile::text from pg_catalog.pg_proc p
            where p.oid = v_def.fn::regprocedure) <> v_def.volatility
       or (select p.proconfig from pg_catalog.pg_proc p where p.oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by %, SECURITY %, empty search_path',
        v_def.fn, c_owner, case when v_def.definer then 'DEFINER' else 'INVOKER' end;
    end if;
  end loop;

  -- EXECUTE (TM12.5, fiche invariant 2): the two doors to influx_agent and influx_admin alone, the
  -- diff to nobody
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in (c_door::regprocedure, c_prefill::regprocedure, c_diff::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (p.oid in (c_door::regprocedure, c_prefill::regprocedure)
              and a.grantee in ('influx_agent'::regrole, 'influx_admin'::regrole));
  if v_bad is not null then
    raise exception 'executable beyond their callers: %', v_bad;
  end if;

  -- 03 P7, fiche invariant 3: no dynamic SQL in a function of the agent's owner
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'a function of the identified search runs dynamic SQL: %', v_bad;
  end if;

  -- D78, modele -3: the owner never reads a band, a budget, the rights, the exclusivity nor the ages
  select string_agg(at.attrelid::regclass::text || '.' || at.attname, ', ') into v_bad
    from pg_catalog.pg_attribute at
   where at.attnum > 0 and not at.attisdropped
     and pg_catalog.has_column_privilege(c_owner, at.attrelid, at.attnum, 'SELECT')
     and ((at.attrelid = 'campaigns.campaigns'::regclass
           and at.attname not in ('id', 'advertiser_account_id', 'sector_code', 'erased_at', 'status',
                                  'title'))
          or at.attrelid in ('campaigns.campaign_audience_age_bands'::regclass,
                             'campaigns.campaign_usage_territories'::regclass));
  if v_bad is not null then
    raise exception 'influx_agent_search_definer reads what the prefill never proposes: %', v_bad;
  end if;

  -- the agent's owner writes its journal and its prefills only
  select string_agg(c.oid::regclass::text, ', ' order by c.oid::regclass::text) into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema')
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'INSERT, UPDATE'))
     and c.oid not in ('search.search_queries'::regclass, 'search.search_impressions'::regclass,
                       'search.impression_reasons'::regclass, 'search.campaign_prefills'::regclass);
  if v_bad is not null then
    raise exception 'influx_agent_search_definer writes beyond its journal: %', v_bad;
  end if;

  -- the new table: RLS forced, the restrictive member policy, no right for an execution role,
  -- append-only
  if not (select c.relrowsecurity and c.relforcerowsecurity from pg_catalog.pg_class c
           where c.oid = 'search.campaign_prefills'::regclass)
     or not exists (select 1 from pg_catalog.pg_policy p
                     where p.polrelid = 'search.campaign_prefills'::regclass
                       and p.polname = 'campaign_prefills_no_member_access'
                       and not p.polpermissive)
     or not exists (select 1 from pg_catalog.pg_trigger t
                     where t.tgrelid = 'search.campaign_prefills'::regclass
                       and t.tgname = 'campaign_prefills_immutable')
     or exists (select 1 from unnest(array['influx_advertiser', 'influx_creator', 'influx_agent',
                                           'influx_admin', 'influx_app']) r
                 where pg_catalog.has_any_column_privilege(r, 'search.campaign_prefills',
                                                           'SELECT, INSERT, UPDATE, REFERENCES')
                    or pg_catalog.has_table_privilege(r, 'search.campaign_prefills',
                                                      'DELETE, TRUNCATE, TRIGGER')) then
    raise exception 'search.campaign_prefills: RLS forced, no execution right, append-only';
  end if;
  if pg_catalog.has_function_privilege('influx_advertiser', c_prefill, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_creator', c_prefill, 'EXECUTE') then
    raise exception 'TM12.5: the prefill is executed by influx_agent and influx_admin alone';
  end if;
end
$$;
