-- =============================================================================
-- 0324_search_brand_shortlists
-- -----------------------------------------------------------------------------
-- Lot 3 / L3F, commit 04 (jalons/l3f/04.md; l3f-fiche.md invariants 2, 4, 6, 7, 10, 15;
-- jalons/l3f/modele.md §1, §5, which PREVAILS for every name; 10 RG8, RG51, RG63, CA52, CA64; D45).
-- The brand's private shortlists, through the alias only: the brand never holds a
-- creator_account_id (l3e/modele.md §9). Signalled I-4 (03): eight SECURITY DEFINER doors, GRANTs and
-- policies to their owner, a setting key, EXECUTE to influx_advertiser.
--
-- 1. search.search_settings gains its ninth key, selection_limits {listsPerAccount: 10,
--    itemsPerList: 25, requestsPerDay: 5} (modele §5: CHECK 1-100, 1-100, 1-50, its zod schema in
--    packages/contracts search-settings.ts; staging hypothesis, the founder fixes it before
--    production). requestsPerDay is read by 0325.
-- 2. What influx_creator_search_definer reads and writes beyond 0323: the caller's shortlists and
--    their items (read, insert, update of the name, the campaign and the note, delete), each right
--    with its policy bounded to the caller's own lists; the creator of its own openings (the « already
--    served » of an addition, modele -5); the key selection_limits.
-- 3. The helpers, SECURITY INVOKER, executed by their owner only:
--      search.shortlist_gate()  the caller (42501), then RG1 brand_not_published, then D38 closed
--            (missing is closed): one gate for the eight doors (modele §5, -8).
--      search.selection_limit(key)  a bound of selection_limits; 55000 creator_search_settings when
--            missing.
--      search.check_shortlist_name(name)  the name trimmed, 1 to 80 characters, one line; 22023 name.
--      search.shortlist_creator(caller, alias, campaign)  the creator of the alias when THE engine
--            lists it for the caller with the campaign of the list (admitted, otherwise none); NULL
--            otherwise. The engine runs whether the alias resolves or not.
--      search.anonymous_card(creator)  the card, from its one source (creator_layer_a() without its
--            status nor the key of a line), as the search and the profile serve it.
--      search.shortlist_summaries(caller, shortlist)  {id, name, campaignId, count, createdAt} of the
--            caller's lists (one, or all, newest first), count = the creators the engine lists with
--            the campaign of the list (the hidden ones neither shown nor counted).
-- 4. The doors, SECURITY DEFINER, empty search_path, EXECUTE for influx_advertiser ONLY, each
--    behind the gate (42501, {state: brand_not_published}, {state: closed}: nothing written nor
--    served):
--      create_shortlist(name, campaign)       name 22023; campaign not admitted P0002 campaign;
--                                             listsPerAccount reached 54000 shortlist_limit.
--      update_shortlist(id, name, campaign)   a replacement (NULL = no campaign); the campaign kept
--                                             as it is passes even if no longer admitted.
--      delete_shortlist(id)                   its items with it.
--      add_to_shortlist(id, alias)            idempotent; the alias listed by the engine with the
--                                             campaign of the list AND already served to the caller
--                                             (an impression or an opening), otherwise P0002 creator,
--                                             unknown, excluded, malformed or never served alike;
--                                             itemsPerList (every row) reached 54000 shortlist_full.
--      set_shortlist_note(id, alias, note)    1 to 500 characters (22023 note), NULL clears; a creator
--                                             hidden or absent from the list P0002 creator.
--      remove_from_shortlist(id, alias)       idempotent, the same answer in every case.
--      list_shortlists()                      the summaries.
--      read_shortlist(id)                     the summary and the visible items {creator, note,
--                                             addedAt}, newest first, at most itemsPerList.
--    A list of another brand or unknown: P0002 shortlist, everywhere. Nothing to the creator, to
--    leads.outbox_events, to matching.* nor to messaging (D45, RG8, CA52, CA64): the end-state
--    assertions hold it.
--
-- RIGHTS (03 I-4, signalled): column GRANTs and policies to influx_creator_search_definer on
-- search.shortlists, search.shortlist_items, search.profile_openings (creator_account_id, read); its
-- policy on search.search_settings recreated with selection_limits; EXECUTE on the eight doors to
-- influx_advertiser. Never layer I, Storage, leads, matching (beyond the engine's E5), a coordinate,
-- a band nor a budget; no new role; the tables keep NO member right (C(40)).
--
-- Not here: the routes (08), the request and the erasure of the openings (0325), the alerts (0326),
-- the export of the shortlists (0318, unchanged: the brand's lists, their creators by alias).
--
-- EC-L3F-04 (micro-gaps, the safest choice):
--   EC-L3F-04-1  « already served » has no window: an impression of any of the caller's searches or
--                an opening served to it, ever (both kept 12 months, 04 §9).
--   EC-L3F-04-2  the name is trimmed and one line (no control character); the note trimmed, 1 to 500,
--                several lines admitted; a blank one is 22023 like an empty one.
--   EC-L3F-04-3  update_shortlist() keeps a campaign no longer admitted when it is passed unchanged
--                (modele §1: the link kept, its sector ignored); any other campaign must be admitted.
--   EC-L3F-04-4  remove_from_shortlist() resolves the alias by the storefront alone (published and
--                searchable), not by the engine: a hidden creator can be removed, one answer always.
--   EC-L3F-04-5  the order of the checks: the gate, the list (P0002 shortlist), the name or the note
--                (22023), the campaign (P0002 campaign), the creator (P0002 creator), the bound (54000).
--   EC-L3F-04-6  the lists are listed newest first, then by id; read_shortlist() serves at most
--                itemsPerList items (the bound of the model, even after a lowering).
--   EC-L3F-04-7  one transaction lock per account for every write of a shortlist: the count, the check
--                and the line are one step (listsPerAccount, itemsPerList).
--   EC-L3F-04-8  the expectations that follow the doors, for expert-cybersecurite: L3E-T6 (the
--                functions of the owner +14, the tables it writes +2, the columns of the openings),
--                L3E-T3 (nine keys; the brand executes 11 functions of search), T1-R (the couples of
--                the eight doors, none on layer I), L3F-T3 (the creator of an opening read), T4.4.
--
-- ROLLBACK (before any shortlist is written through a door): drop the eight doors and the six
-- helpers; drop the policies shortlists_creator_search_definer_all, shortlist_items_creator_search_
-- definer_all and revoke their grants; revoke select (creator_account_id) on search.profile_openings
-- from influx_creator_search_definer; recreate search_settings_creator_search_definer_select with the
-- seven keys of 0323; delete the key selection_limits and recreate the two CHECKs of 0316.
-- =============================================================================

-- 1. The ninth key of the settings (modele §5) -----------------------------------------------------

alter table search.search_settings drop constraint if exists search_settings_key_closed_list;
alter table search.search_settings add constraint search_settings_key_closed_list check (key in (
    'is_open_to_advertisers', 'k_anonymity_threshold', 'page_size', 'max_pages', 'rate_limits',
    'cold_profile_quota', 'critical_mass_thresholds', 'region_display_threshold',
    'selection_limits'));

alter table search.search_settings drop constraint if exists search_settings_value_shape;
alter table search.search_settings add constraint search_settings_value_shape check (case key
    when 'is_open_to_advertisers' then
      jsonb_typeof(value) = 'boolean'
    when 'k_anonymity_threshold' then
      jsonb_path_exists(value, '$ ? (@.type() == "number" && @ >= 5 && @ <= 50 && @.floor() == @)')
    when 'page_size' then
      jsonb_path_exists(value, '$ ? (@.type() == "number" && @ >= 1 && @ <= 50 && @.floor() == @)')
    when 'max_pages' then
      jsonb_path_exists(value, '$ ? (@.type() == "number" && @ >= 1 && @ <= 50 && @.floor() == @)')
    when 'rate_limits' then
      jsonb_typeof(value) = 'object'
      and value ?& array['perHour', 'perDay', 'profileOpensPerDay']
      and (value - 'perHour' - 'perDay' - 'profileOpensPerDay') = '{}'::jsonb
      and jsonb_path_exists(value,
            '$ ? (@.perHour.type() == "number" && @.perHour >= 1 && @.perHour <= 1000
                  && @.perHour.floor() == @.perHour
                  && @.perDay.type() == "number" && @.perDay >= 1 && @.perDay <= 20000
                  && @.perDay.floor() == @.perDay
                  && @.profileOpensPerDay.type() == "number" && @.profileOpensPerDay >= 1
                  && @.profileOpensPerDay <= 1000
                  && @.profileOpensPerDay.floor() == @.profileOpensPerDay
                  && @.perHour <= @.perDay)')
    when 'cold_profile_quota' then
      jsonb_typeof(value) = 'object'
      and value ?& array['slots', 'recentDays']
      and (value - 'slots' - 'recentDays') = '{}'::jsonb
      and jsonb_path_exists(value,
            '$ ? (@.slots.type() == "number" && @.slots >= 0 && @.slots <= 50
                  && @.slots.floor() == @.slots
                  && @.recentDays.type() == "number" && @.recentDays >= 1 && @.recentDays <= 365
                  && @.recentDays.floor() == @.recentDays)')
    when 'critical_mass_thresholds' then
      jsonb_typeof(value) = 'object'
      and value ?& array['publishedProfiles', 'perTopic']
      and (value - 'publishedProfiles' - 'perTopic') = '{}'::jsonb
      and jsonb_path_exists(value,
            '$ ? (@.publishedProfiles.type() == "number" && @.publishedProfiles >= 1
                  && @.publishedProfiles <= 100000
                  && @.publishedProfiles.floor() == @.publishedProfiles
                  && @.perTopic.type() == "number" && @.perTopic >= 1 && @.perTopic <= 100000
                  && @.perTopic.floor() == @.perTopic)')
    when 'region_display_threshold' then
      jsonb_path_exists(value, '$ ? (@.type() == "number" && @ >= 5 && @ <= 50 && @.floor() == @)')
    -- 0324 (modele §5): the bounds of the shortlists and of the request to the team
    when 'selection_limits' then
      jsonb_typeof(value) = 'object'
      and value ?& array['listsPerAccount', 'itemsPerList', 'requestsPerDay']
      and (value - 'listsPerAccount' - 'itemsPerList' - 'requestsPerDay') = '{}'::jsonb
      and jsonb_path_exists(value,
            '$ ? (@.listsPerAccount.type() == "number" && @.listsPerAccount >= 1
                  && @.listsPerAccount <= 100
                  && @.listsPerAccount.floor() == @.listsPerAccount
                  && @.itemsPerList.type() == "number" && @.itemsPerList >= 1
                  && @.itemsPerList <= 100
                  && @.itemsPerList.floor() == @.itemsPerList
                  && @.requestsPerDay.type() == "number" && @.requestsPerDay >= 1
                  && @.requestsPerDay <= 50
                  && @.requestsPerDay.floor() == @.requestsPerDay)')
    else false
  end);

comment on table search.search_settings is
  'The settings of the creator search, as data (04 §5.5; 10 RG2, RG57, RG63; l3e/modele.md §9; '
  'l3f/modele.md §5): a closed list of nine keys, the shape of each value checked in base '
  '(EC-L3E-03-1) and by its zod schema (packages/contracts, search-settings.ts). '
  'is_open_to_advertisers FALSE: closed, no list (D38, CA59). Read at EVERY search, never at start. '
  'Written by search.write_search_setting() only (influx_admin, aal2), every change a line '
  'search.settings_changed (before, after), a change of k or of the cold quota a version of '
  'search.facet_config_versions.';

insert into search.search_settings (key, value) values
  ('selection_limits', '{"listsPerAccount": 10, "itemsPerList": 25, "requestsPerDay": 5}')
on conflict (key) do nothing;

-- 2. What influx_creator_search_definer reads and writes beyond 0323 (modele §5) -------------------

-- 2.1 The settings it reads: selection_limits beside the seven keys of 0323
drop policy if exists search_settings_creator_search_definer_select on search.search_settings;
create policy search_settings_creator_search_definer_select on search.search_settings
  for select to influx_creator_search_definer
  using (key in ('is_open_to_advertisers', 'k_anonymity_threshold', 'page_size', 'max_pages',
                 'rate_limits', 'cold_profile_quota', 'region_display_threshold',
                 'selection_limits'));

-- 2.2 The caller's own shortlists: read, created, renamed or re-attached, deleted (its items go with
-- it, 0316 EC-L3E-03-6)
grant select (id, advertiser_account_id, name, campaign_id, created_at),
      insert (advertiser_account_id, name, campaign_id),
      update (name, campaign_id),
      delete
   on search.shortlists to influx_creator_search_definer;

drop policy if exists shortlists_creator_search_definer_all on search.shortlists;
create policy shortlists_creator_search_definer_all on search.shortlists
  for all to influx_creator_search_definer
  using (advertiser_account_id = (select influx.current_account_id()))
  with check (advertiser_account_id = (select influx.current_account_id()));

-- 2.3 The items of the caller's own shortlists: read, added, noted, removed
grant select (shortlist_id, creator_account_id, added_at, note),
      insert (shortlist_id, creator_account_id),
      update (note),
      delete
   on search.shortlist_items to influx_creator_search_definer;

drop policy if exists shortlist_items_creator_search_definer_all on search.shortlist_items;
create policy shortlist_items_creator_search_definer_all on search.shortlist_items
  for all to influx_creator_search_definer
  using (exists (select 1 from search.shortlists s
                  where s.id = shortlist_items.shortlist_id
                    and s.advertiser_account_id = (select influx.current_account_id())))
  with check (exists (select 1 from search.shortlists s
                       where s.id = shortlist_items.shortlist_id
                         and s.advertiser_account_id = (select influx.current_account_id())));

-- 2.4 The creator of its own openings (modele -5: an alias already served to the caller; the policy
-- of 0323 bounds the rows to the caller's)
grant select (creator_account_id) on search.profile_openings to influx_creator_search_definer;

-- 3. The helpers and the doors, as influx_creator_search_definer (03 P7 rule 5) --------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_search_definer', current_user);
end
$$;
grant create on schema search to influx_creator_search_definer;
set role influx_creator_search_definer;

-- 3.1 The gate of the eight doors (10 RG1, D38, CA59; modele §5, -8)
create or replace function search.shortlist_gate(
  out caller  uuid,
  out state   text)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_open  jsonb;
begin
  caller := search.require_creator_searcher();
  if not exists (select 1 from profiles.advertiser_profiles a
                  where a.account_id = caller and a.status = 'published') then
    state := 'brand_not_published';
    return;
  end if;
  -- missing is closed
  select s.value into v_open from search.search_settings s where s.key = 'is_open_to_advertisers';
  if v_open is distinct from 'true'::jsonb then
    state := 'closed';
  end if;
end
$$;

comment on function search.shortlist_gate() is
  'l3f/modele.md §5 (0324; 10 RG1, D38, CA59): the caller of a door of the shortlists '
  '(search.require_creator_searcher: 42501 otherwise), and state brand_not_published (RG1), closed '
  '(the switch false or missing) or NULL. SECURITY INVOKER owned by influx_creator_search_definer, '
  'executed by its owner only.';

-- 3.2 A bound of the shortlists or of the request (modele §5)
create or replace function search.selection_limit(p_key text)
returns integer
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_limit  integer;
begin
  select (s.value ->> p_key)::integer into v_limit
    from search.search_settings s
   where s.key = 'selection_limits';
  if v_limit is null then
    raise exception 'creator_search_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'creator_search_settings';
  end if;
  return v_limit;
end
$$;

comment on function search.selection_limit(text) is
  'l3f/modele.md §5 (0324): the bound p_key (listsPerAccount, itemsPerList, requestsPerDay) of '
  'search.search_settings.selection_limits; 55000 creator_search_settings when missing. SECURITY '
  'INVOKER owned by influx_creator_search_definer, executed by its owner only.';

-- 3.3 The name of a shortlist (modele §5; EC-L3F-04-2)
create or replace function search.check_shortlist_name(p_name text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_name  text := pg_catalog.btrim(p_name);
begin
  if v_name is null or pg_catalog.char_length(v_name) not between 1 and 80
     or v_name ~ '[[:cntrl:]]' then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'name';
  end if;
  return v_name;
end
$$;

comment on function search.check_shortlist_name(text) is
  'l3f/modele.md §5 (0324, EC-L3F-04-2): p_name trimmed, 1 to 80 characters on one line (no control '
  'character); 22023 name otherwise. SECURITY INVOKER owned by influx_creator_search_definer, '
  'executed by its owner only.';

-- 3.4 The creator of an alias the engine lists for the caller with the campaign of a list (RG4)
create or replace function search.shortlist_creator(
  p_caller       uuid,
  p_alias        text,
  p_campaign_id  uuid)
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_creator   uuid;
  v_campaign  uuid;
begin
  -- the campaign of the list while admitted, otherwise none (modele §1)
  if search.is_admitted_campaign(p_caller, p_campaign_id) then
    v_campaign := p_campaign_id;
  end if;
  -- the alias of a published and searchable storefront (the policy of the owner holds E1, E2)
  select p.account_id into v_creator
    from profiles.creator_public_profiles p
   where p.alias = p_alias;
  -- THE engine, E1 to E6 silent; it runs whether the alias resolves or not
  if not exists (select 1
                   from search.creator_candidates('advertiser_anonymous', p_caller, '{}'::jsonb,
                                                  v_campaign) c
                  where c.creator_account_id = v_creator) then
    return null;
  end if;
  return v_creator;
end
$$;

comment on function search.shortlist_creator(uuid, text, uuid) is
  'l3f/modele.md §5 (0324; 10 RG4, CA49): the creator of alias p_alias when search.creator_candidates() '
  'lists it for p_caller with p_campaign_id while admitted (search.is_admitted_campaign), without '
  'campaign otherwise; NULL for an alias unknown, malformed or excluded by E1 to E6 alike. The engine '
  'runs in every case. SECURITY INVOKER owned by influx_creator_search_definer, executed by its owner '
  'only.';

-- 3.5 The anonymous card, from its one source (fiche invariant 1; 10 RG48, RG50, CA6)
create or replace function search.anonymous_card(p_creator_account_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_layer  jsonb := profiles.creator_layer_a(p_creator_account_id);
begin
  if v_layer is null then
    return null;
  end if;
  return (v_layer - 'status' - 'lines')
         || pg_catalog.jsonb_build_object(
              'lines',
              coalesce((select pg_catalog.jsonb_agg(x.line - 'lineKey' order by x.ord)
                          from pg_catalog.jsonb_array_elements(v_layer -> 'lines')
                               with ordinality x (line, ord)),
                       '[]'::jsonb));
end
$$;

comment on function search.anonymous_card(uuid) is
  'l3f/modele.md §5 (0324; fiche invariant 1; 10 RG48, RG50, CA6): the card of the creator '
  'p_creator_account_id as the search and the profile serve it: profiles.creator_layer_a() without '
  'its status nor the key of a line; NULL without a storefront the owner may read. SECURITY INVOKER '
  'owned by influx_creator_search_definer, executed by its owner only.';

-- 3.6 The summaries of the caller's lists (modele §5, §8)
create or replace function search.shortlist_summaries(
  p_caller        uuid,
  p_shortlist_id  uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with lists as (
    select s.id, s.name, s.campaign_id, s.created_at,
           -- the campaign that anchors the engine: the list's while admitted, otherwise none
           case when search.is_admitted_campaign(p_caller, s.campaign_id) then s.campaign_id end
             as anchor
      from search.shortlists s
     where s.advertiser_account_id = p_caller
       and (p_shortlist_id is null or s.id = p_shortlist_id)
  ),
  anchors as (
    select distinct l.anchor from lists l
  ),
  -- THE engine once per anchor: the hidden creators neither shown nor counted
  visible as (
    select a.anchor, c.creator_account_id
      from anchors a
      cross join lateral search.creator_candidates('advertiser_anonymous', p_caller, '{}'::jsonb,
                                                   a.anchor) c
  )
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id',         l.id::text,
           'name',       l.name,
           'campaignId', l.campaign_id::text,
           'count',      (select (pg_catalog.count(*))::integer
                            from search.shortlist_items i
                           where i.shortlist_id = l.id
                             and exists (select 1 from visible v
                                          where v.anchor is not distinct from l.anchor
                                            and v.creator_account_id = i.creator_account_id)),
           'createdAt',  pg_catalog.to_char(pg_catalog.timezone('UTC', l.created_at),
                                            'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
         order by l.created_at desc, l.id), '[]'::jsonb)
    from lists l;
$$;

comment on function search.shortlist_summaries(uuid, uuid) is
  'l3f/modele.md §5, §8 (0324, EC-L3F-04-6): [{id, name, campaignId, count, createdAt}] of the lists of '
  'p_caller (the one p_shortlist_id, or all when NULL), newest first then by id; count = its creators '
  'that search.creator_candidates() lists with the campaign of the list while admitted (a hidden one '
  'neither shown nor counted). SECURITY INVOKER owned by influx_creator_search_definer, executed by '
  'its owner only.';

-- 3.7 THE doors (modele §5; 10 RG8, RG51, RG63, CA52; D45)

create or replace function search.create_shortlist(p_name text, p_campaign_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid;
  v_state   text;
  v_name    text;
  v_lists   integer;
  v_id      uuid;
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  v_name := search.check_shortlist_name(p_name);
  -- modele §1: an admitted campaign of the caller, or none
  if p_campaign_id is not null and not search.is_admitted_campaign(v_caller, p_campaign_id) then
    raise exception 'campaign_not_found' using errcode = 'no_data_found', detail = 'campaign';
  end if;
  v_lists := search.selection_limit('listsPerAccount');

  -- EC-L3F-04-7: one write of a shortlist at a time per account
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  if (select pg_catalog.count(*) from search.shortlists s
       where s.advertiser_account_id = v_caller) >= v_lists then
    raise exception 'shortlist_limit'
      using errcode = 'program_limit_exceeded', detail = 'shortlist_limit';
  end if;

  insert into search.shortlists (advertiser_account_id, name, campaign_id)
  values (v_caller, v_name, p_campaign_id)
  returning id into v_id;
  return pg_catalog.jsonb_build_object(
    'state', 'shortlist', 'shortlist', search.shortlist_summaries(v_caller, v_id) -> 0);
end
$$;

comment on function search.create_shortlist(text, uuid) is
  'l3f/modele.md §5 (0324; 10 RG51, RG63): a new private shortlist of the calling brand, named p_name '
  '(trimmed, 1 to 80, one line: 22023 name), attached to p_campaign_id when admitted (P0002 campaign '
  'otherwise), within selection_limits.listsPerAccount (54000 shortlist_limit). Behind '
  'search.shortlist_gate() (42501, {state: brand_not_published}, {state: closed}). {state: '
  'shortlist, shortlist: {id, name, campaignId, count, createdAt}}. Nothing to the creator, the '
  'outbox nor matching. SECURITY DEFINER owned by influx_creator_search_definer, empty search_path; '
  'EXECUTE for influx_advertiser only.';

create or replace function search.update_shortlist(
  p_shortlist_id  uuid,
  p_name          text,
  p_campaign_id   uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid;
  v_state    text;
  v_name     text;
  v_current  uuid;
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  select s.campaign_id into v_current
    from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  v_name := search.check_shortlist_name(p_name);
  -- EC-L3F-04-3: the campaign kept as it is passes; any other must be admitted
  if p_campaign_id is not null and p_campaign_id is distinct from v_current
     and not search.is_admitted_campaign(v_caller, p_campaign_id) then
    raise exception 'campaign_not_found' using errcode = 'no_data_found', detail = 'campaign';
  end if;

  update search.shortlists s
     set name = v_name, campaign_id = p_campaign_id
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  return pg_catalog.jsonb_build_object(
    'state', 'shortlist', 'shortlist', search.shortlist_summaries(v_caller, p_shortlist_id) -> 0);
end
$$;

comment on function search.update_shortlist(uuid, text, uuid) is
  'l3f/modele.md §5 (0324, EC-L3F-04-3): replaces the name and the campaign of the caller''s shortlist '
  'p_shortlist_id (P0002 shortlist when unknown or of another brand); name as create_shortlist(); '
  'p_campaign_id NULL detaches, the campaign kept unchanged passes, another must be admitted (P0002 '
  'campaign). Behind search.shortlist_gate(). {state: shortlist, shortlist: summary}. SECURITY '
  'DEFINER owned by influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser '
  'only.';

create or replace function search.delete_shortlist(p_shortlist_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid;
  v_state   text;
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  -- its items go with it (on delete cascade, 0316)
  delete from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  return pg_catalog.jsonb_build_object('state', 'deleted');
end
$$;

comment on function search.delete_shortlist(uuid) is
  'l3f/modele.md §5 (0324): deletes the caller''s shortlist p_shortlist_id and its items (P0002 '
  'shortlist when unknown or of another brand). Behind search.shortlist_gate(). {state: deleted}. '
  'SECURITY DEFINER owned by influx_creator_search_definer, empty search_path; EXECUTE for '
  'influx_advertiser only.';

create or replace function search.add_to_shortlist(p_shortlist_id uuid, p_alias text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller    uuid;
  v_state     text;
  v_campaign  uuid;
  v_items     integer;
  v_creator   uuid;
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  v_items := search.selection_limit('itemsPerList');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  select s.campaign_id into v_campaign
    from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;

  -- RG4, CA49: listed by THE engine with the campaign of the list, and already served to the caller
  -- (an impression of its searches or an opening, modele -5, EC-L3F-04-1); otherwise one answer
  v_creator := search.shortlist_creator(v_caller, p_alias, v_campaign);
  if v_creator is not null
     and not exists (select 1
                       from search.search_queries q
                       join search.search_impressions i on i.search_query_id = q.id
                      where q.account_id = v_caller
                        and i.creator_account_id = v_creator)
     and not exists (select 1
                       from search.profile_openings o
                      where o.account_id = v_caller
                        and o.creator_account_id = v_creator) then
    v_creator := null;
  end if;
  if v_creator is null then
    raise exception 'creator_not_found' using errcode = 'no_data_found', detail = 'creator';
  end if;

  -- idempotent: already there, nothing changes (its date kept)
  if exists (select 1 from search.shortlist_items i
              where i.shortlist_id = p_shortlist_id and i.creator_account_id = v_creator) then
    return pg_catalog.jsonb_build_object('state', 'added');
  end if;
  -- the bound counts every row, the hidden ones included (modele §5)
  if (select pg_catalog.count(*) from search.shortlist_items i
       where i.shortlist_id = p_shortlist_id) >= v_items then
    raise exception 'shortlist_full'
      using errcode = 'program_limit_exceeded', detail = 'shortlist_full';
  end if;
  insert into search.shortlist_items (shortlist_id, creator_account_id)
  values (p_shortlist_id, v_creator);
  return pg_catalog.jsonb_build_object('state', 'added');
end
$$;

comment on function search.add_to_shortlist(uuid, text) is
  'l3f/modele.md §5 (0324; 10 RG4, RG51, CA49, CA52; D45): adds the creator of alias p_alias to the '
  'caller''s shortlist p_shortlist_id (P0002 shortlist when unknown or of another brand), idempotent. '
  'The alias must be listed by search.creator_candidates() with the campaign of the list (admitted, '
  'otherwise none) AND already served to the caller (an impression or an opening, EC-L3F-04-1): '
  'otherwise P0002 creator, unknown, malformed, excluded or never served alike. '
  'selection_limits.itemsPerList counts every row (54000 shortlist_full). Behind '
  'search.shortlist_gate(). {state: added}. Nothing to the creator, the outbox nor matching. '
  'SECURITY DEFINER owned by influx_creator_search_definer, empty search_path; EXECUTE for '
  'influx_advertiser only.';

create or replace function search.set_shortlist_note(
  p_shortlist_id  uuid,
  p_alias         text,
  p_note          text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller    uuid;
  v_state     text;
  v_campaign  uuid;
  v_note      text := pg_catalog.btrim(p_note);
  v_creator   uuid;
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  select s.campaign_id into v_campaign
    from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  -- EC-L3F-04-2: NULL clears; otherwise 1 to 500 characters once trimmed
  if p_note is not null and pg_catalog.char_length(v_note) not between 1 and 500 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'note';
  end if;

  -- a creator hidden or absent from the list: one answer
  v_creator := search.shortlist_creator(v_caller, p_alias, v_campaign);
  update search.shortlist_items i
     set note = v_note
   where i.shortlist_id = p_shortlist_id
     and i.creator_account_id = v_creator;
  if not found then
    raise exception 'creator_not_found' using errcode = 'no_data_found', detail = 'creator';
  end if;
  return pg_catalog.jsonb_build_object('state', 'noted');
end
$$;

comment on function search.set_shortlist_note(uuid, text, text) is
  'l3f/modele.md §5 (0324, EC-L3F-04-2): the caller''s note on the creator of alias p_alias in its '
  'shortlist p_shortlist_id (P0002 shortlist when unknown or of another brand): 1 to 500 characters '
  'once trimmed (22023 note), NULL clears; a creator hidden (the engine with the campaign of the list) '
  'or absent from the list P0002 creator. Behind search.shortlist_gate(). {state: noted}. SECURITY '
  'DEFINER owned by influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser '
  'only.';

create or replace function search.remove_from_shortlist(p_shortlist_id uuid, p_alias text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid;
  v_state   text;
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  if not exists (select 1 from search.shortlists s
                  where s.id = p_shortlist_id and s.advertiser_account_id = v_caller) then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  -- EC-L3F-04-4: by the storefront of the alias; there or not, the same answer
  delete from search.shortlist_items i
   using profiles.creator_public_profiles p
   where p.alias = p_alias
     and i.creator_account_id = p.account_id
     and i.shortlist_id = p_shortlist_id;
  return pg_catalog.jsonb_build_object('state', 'removed');
end
$$;

comment on function search.remove_from_shortlist(uuid, text) is
  'l3f/modele.md §5 (0324, EC-L3F-04-4): removes the creator of alias p_alias from the caller''s '
  'shortlist p_shortlist_id (P0002 shortlist when unknown or of another brand); idempotent, {state: '
  'removed} in every case. Behind search.shortlist_gate(). SECURITY DEFINER owned by '
  'influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

create or replace function search.list_shortlists()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller  uuid;
  v_state   text;
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  return pg_catalog.jsonb_build_object(
    'state', 'shortlists', 'shortlists', search.shortlist_summaries(v_caller, null));
end
$$;

comment on function search.list_shortlists() is
  'l3f/modele.md §5, §8 (0324): {state: shortlists, shortlists: [{id, name, campaignId, count, '
  'createdAt}]} of the calling brand, newest first (search.shortlist_summaries). Behind '
  'search.shortlist_gate(). Neither journal nor bucket. SECURITY DEFINER owned by '
  'influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

create or replace function search.read_shortlist(p_shortlist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller    uuid;
  v_state     text;
  v_campaign  uuid;
  v_anchor    uuid;
  v_items     integer;
  v_list      jsonb;
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  select s.campaign_id into v_campaign
    from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  if search.is_admitted_campaign(v_caller, v_campaign) then
    v_anchor := v_campaign;
  end if;
  v_items := search.selection_limit('itemsPerList');

  -- the visible items (THE engine with the campaign of the list), newest first, at most
  -- itemsPerList (EC-L3F-04-6); a hidden one leaves no trace
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'creator', search.anonymous_card(v.creator_account_id),
           'note',    v.note,
           'addedAt', pg_catalog.to_char(pg_catalog.timezone('UTC', v.added_at),
                                         'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
         order by v.added_at desc, v.creator_account_id), '[]'::jsonb)
    into v_list
    from (select i.creator_account_id, i.note, i.added_at
            from search.shortlist_items i
           where i.shortlist_id = p_shortlist_id
             and i.creator_account_id in (
                   select c.creator_account_id
                     from search.creator_candidates('advertiser_anonymous', v_caller, '{}'::jsonb,
                                                    v_anchor) c)
           order by i.added_at desc, i.creator_account_id
           limit v_items) v;

  return pg_catalog.jsonb_build_object(
    'state',     'shortlist',
    'shortlist', search.shortlist_summaries(v_caller, p_shortlist_id) -> 0,
    'items',     v_list);
end
$$;

comment on function search.read_shortlist(uuid) is
  'l3f/modele.md §5 (0324; fiche invariant 1; 10 RG48, RG50, CA6): the caller''s shortlist '
  'p_shortlist_id (P0002 shortlist when unknown or of another brand): {state: shortlist, shortlist: '
  'summary, items: [{creator (the card, search.anonymous_card), note, addedAt}]}, the creators '
  'search.creator_candidates() lists with the campaign of the list while admitted, newest first, at '
  'most selection_limits.itemsPerList; a hidden one neither shown nor counted, back when visible '
  'again. Behind search.shortlist_gate(). Neither journal nor bucket. SECURITY DEFINER owned by '
  'influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

-- 4. Rights on the functions (03 P7 rule 5), then the owner given back -------------------------------

revoke all on function search.shortlist_gate() from public, anon, authenticated, service_role;
revoke all on function search.selection_limit(text) from public, anon, authenticated, service_role;
revoke all on function search.check_shortlist_name(text)
  from public, anon, authenticated, service_role;
revoke all on function search.shortlist_creator(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.anonymous_card(uuid) from public, anon, authenticated, service_role;
revoke all on function search.shortlist_summaries(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.create_shortlist(text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.update_shortlist(uuid, text, uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.delete_shortlist(uuid) from public, anon, authenticated, service_role;
revoke all on function search.add_to_shortlist(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function search.set_shortlist_note(uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function search.remove_from_shortlist(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function search.list_shortlists() from public, anon, authenticated, service_role;
revoke all on function search.read_shortlist(uuid) from public, anon, authenticated, service_role;

grant execute on function search.create_shortlist(text, uuid),
                          search.update_shortlist(uuid, text, uuid),
                          search.delete_shortlist(uuid),
                          search.add_to_shortlist(uuid, text),
                          search.set_shortlist_note(uuid, text, text),
                          search.remove_from_shortlist(uuid, text),
                          search.list_shortlists(),
                          search.read_shortlist(uuid)
   to influx_advertiser;

reset role;
revoke create on schema search from influx_creator_search_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_search_definer', current_user);
end
$$;

-- 5. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  c_dynamic  constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner    constant text := 'influx_creator_search_definer';
  c_layer_i  constant text :=
    'creator_identities|creator_social_accounts|creator_audience_ages|creator_audience_countries'
    '|creator_audience_genders|creator_network_metrics_history';
  c_doors    constant regprocedure[] := array[
    'search.create_shortlist(text, uuid)'::regprocedure,
    'search.update_shortlist(uuid, text, uuid)'::regprocedure,
    'search.delete_shortlist(uuid)'::regprocedure,
    'search.add_to_shortlist(uuid, text)'::regprocedure,
    'search.set_shortlist_note(uuid, text, text)'::regprocedure,
    'search.remove_from_shortlist(uuid, text)'::regprocedure,
    'search.list_shortlists()'::regprocedure,
    'search.read_shortlist(uuid)'::regprocedure];
  c_helpers  constant regprocedure[] := array[
    'search.shortlist_gate()'::regprocedure,
    'search.selection_limit(text)'::regprocedure,
    'search.check_shortlist_name(text)'::regprocedure,
    'search.shortlist_creator(uuid, text, uuid)'::regprocedure,
    'search.anonymous_card(uuid)'::regprocedure,
    'search.shortlist_summaries(uuid, uuid)'::regprocedure];
  v_bad      text;
begin
  -- the doors and the helpers: owner, mode, empty search_path
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid = any (c_doors || c_helpers)
     and (pg_catalog.pg_get_userbyid(p.proowner) <> c_owner
          or p.prosecdef is distinct from (p.oid = any (c_doors))
          or p.proconfig is distinct from array['search_path=""']);
  if v_bad is not null then
    raise exception 'must be owned by %, definer for the doors alone, empty search_path: %',
      c_owner, v_bad;
  end if;

  -- EXECUTE: the doors to influx_advertiser, the helpers to nobody
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = any (c_doors || c_helpers)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (p.oid = any (c_doors) and a.grantee = 'influx_advertiser'::regrole);
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

  -- fiche invariant 4: no function of the owner names layer I nor Storage
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole
     and (p.prosrc ~* ('\m(' || c_layer_i || ')\M') or p.prosrc ~* '\m"?storage"?\s*\.');
  if v_bad is not null then
    raise exception 'a function of the creator search names layer I or Storage: %', v_bad;
  end if;

  -- fiche invariant 6 (D45, RG8, CA52, CA64): the shortlists write nothing to the creator, the outbox,
  -- matching nor messaging; a campaign is read through is_admitted_campaign() alone (modele §1)
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid = any (c_doors || c_helpers)
     and p.prosrc ~* '\m(leads|matching|messaging|campaigns|audit)\s*\.|outbox|notification';
  if v_bad is not null then
    raise exception 'a door of the shortlists names the outbox, matching, messaging or a campaign: %',
      v_bad;
  end if;

  -- fiche invariant 4: the tables of the shortlists keep RLS forced, the restrictive member policy,
  -- and no right to an execution role
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid in ('search.shortlists'::regclass, 'search.shortlist_items'::regclass)
     and (not (c.relrowsecurity and c.relforcerowsecurity)
          or not exists (select 1 from pg_catalog.pg_policy p
                          where p.polrelid = c.oid
                            and p.polname = c.relname || '_no_member_access'
                            and not p.polpermissive));
  if v_bad is not null then
    raise exception 'the shortlists must force RLS with their restrictive member policy: %', v_bad;
  end if;
  select string_agg(r.rolname || ' ' || t.name, ', ') into v_bad
    from pg_catalog.pg_roles r,
         (values ('search.shortlists'), ('search.shortlist_items')) as t (name)
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                       'influx_privacy', 'anon', 'authenticated', 'service_role')
     and (pg_catalog.has_table_privilege(r.oid, t.name, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(r.oid, t.name, 'SELECT, INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'the shortlists reached by an execution role: %', v_bad;
  end if;

  -- the brand executes the eleven doors of search, nothing else there
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'search'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
     and not (p.oid = any (c_doors))
     and p.oid not in ('search.search_creators(jsonb, text, integer, uuid)'::regprocedure,
                       'search.open_creator_profile(text)'::regprocedure,
                       'search.read_creator_visual(text, uuid)'::regprocedure);
  if v_bad is not null then
    raise exception 'influx_advertiser executes a search function beyond its doors: %', v_bad;
  end if;

  -- the key in table
  if not exists (select 1 from search.search_settings where key = 'selection_limits') then
    raise exception 'search.search_settings must hold selection_limits';
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE') then
    raise exception 'influx_creator_search_definer left with a member or CREATE';
  end if;
end
$$;
