-- =============================================================================
-- 0323_search_creator_profile_door
-- -----------------------------------------------------------------------------
-- Lot 3 / L3F, commit 03 (jalons/l3f/03.md; l3f-fiche.md invariants 1 to 5, 8 to 10, 15;
-- jalons/l3f/modele.md §2 to §4, which PREVAILS for every name; 10 RG15, RG47, RG48, RG50, RG63 to
-- RG66, CA6, CA14, CA15, CA48 to CA50, CA59; 07 RG37, RG84, RG85). The anonymous profile a brand
-- opens by alias, the object of its approved visuals, the region of its residence. Signalled I-4
-- (03): two SECURITY DEFINER doors, a new table and its policies, GRANTs to their owner, EXECUTE to
-- influx_advertiser.
--
-- 1. search.profile_openings (modele §2): one line per opening served or refused, the bucket of
--    profileOpensPerDay; append-only (the guard of 0316), RLS forced, NO member right, the
--    restrictive policy of 0316; never exported (like the impressions, modele -7), erased by 0325.
-- 2. What influx_creator_search_definer reads and writes beyond 0322: the region of a storefront
--    (residence_region_code, modele §4); the object of an APPROVED visual of a visible storefront
--    (object_key, width, height: read, never served, modele §3 and -1, the pattern of the logo of
--    L3D); the key region_display_threshold; the filters and the campaign of its own searches, the
--    impressions of its own searches (read, opened once); its own openings (counted, inserted).
-- 3. The helpers, SECURITY INVOKER, executed by their owner only:
--      search.displayed_region(creator)  the region of residence when at least
--            region_display_threshold storefronts E1 to E4 share (country, region), NULL otherwise
--            (modele §4: the same answer for every brand, neither E5 nor E6).
--      search.creator_open_retry_after(account)  the bucket of the openings (modele §2): a
--            transaction lock per account, the served lines of 24 h, a reopening included, against
--            profileOpensPerDay; (NULL, false) within it, otherwise the seconds and whether to
--            journal the refusal (one rate_limited line per 24 h, L3DS-1).
-- 4. The doors, SECURITY DEFINER, empty search_path, EXECUTE for influx_advertiser ONLY:
--      search.open_creator_profile(alias) → jsonb  (modele §2): in order the caller (42501), RG1
--            {state: brand_not_published}, D38 {state: closed} (nothing written), the bucket
--            {state: rate_limited, retryAfterSeconds}, the alias a member of the engine with the
--            campaign of origin (RG4), otherwise P0002 DETAIL creator: unknown, excluded or
--            malformed alike, nothing written nor counted (CA49). Then, in the transaction that
--            serves: one line served of profile_openings, the impression of origin opened once
--            (CA48); a write refused, nothing served. {state: profile, creator (the card),
--            residenceRegion, reasons, vigilance}.
--      search.read_creator_visual(alias, visual) → (object_key, width, height)  (modele §3),
--            STABLE: no row for a refused caller, a brand not published, the switch false, an
--            alias not visible (without campaign), a visual unknown, not approved or of another
--            creator. Neither journal nor bucket of account (the rate per address is the route's).
--
-- RIGHTS (03 I-4, signalled): a new table, its restrictive policy and the policies of the owner;
-- column GRANTs to influx_creator_search_definer on profiles.creator_public_profiles
-- (residence_region_code), profiles.portfolio_items (object_key, width, height),
-- search.search_queries (filters, campaign_id), search.search_impressions (read; was_opened,
-- opened_at updated), search.profile_openings; its policy on search.search_settings recreated with
-- region_display_threshold; EXECUTE on the two doors to influx_advertiser. Never layer I, Storage,
-- a coordinate, a band nor a budget; no new role.
--
-- Not here: the routes and the relay of the bytes (07), the shortlists (0324), the request and the
-- erasure of the openings (0325), the alerts (0326), privacy.* (modele §2 asks nothing of it).
--
-- EC-L3F-03 (micro-gaps, the safest choice):
--   EC-L3F-03-1  read_creator_visual() answers no row to a refused caller by catching the 42501 of
--                search.require_creator_searcher() (one caller check, modele §3 « aucune ligne »).
--   EC-L3F-03-2  region_display_threshold missing: no region is shown (the country alone), never
--                55000: the safe side of RG15, the profile still served.
--   EC-L3F-03-3  the campaign of the search of origin, no longer admitted by
--                search.is_admitted_campaign() (rejected since), is read as no campaign: neither
--                its sector (E6) nor its deliverables (the reasons), as a shortlist keeps its link
--                but ignores its sector (modele §1).
--   EC-L3F-03-4  the reasons and the note come from search.creator_order() with the sort default
--                (a sort orders, it never changes a reason) and the filters of the search of origin
--                as journaled; without an origin, '{}' and no campaign (modele §2).
--   EC-L3F-03-5  residenceRegion sits beside the card, always present, NULL below the threshold
--                (no message nor count, CA15): the card itself is unchanged (modele §4, -2).
--   EC-L3F-03-6  two searches of the same instant (one transaction): the origin is the later by
--                instant, then by the greater id (a stable choice, never served).
--   EC-L3F-03-7  profile_openings is held append-only by search.guard_search_journal_write() of
--                0316, unchanged: its DELETE by influx_privacy_definer (the erasure) comes with 0325,
--                which extends the guard's list.
--   EC-L3F-03-8  the expectations that follow the doors, for expert-cybersecurite: L3E-T6 (the
--                functions of the owner +4, residence_region_code, the writes +profile_openings,
--                object_key now read), L3E-T3 (the brand executes 3 functions of search, 13 tables
--                in search.ts), T9.6 L2G (+3 columns, + read_creator_visual names portfolio_items),
--                T1-R (the couples of the two doors, none on layer I), T2.7 and T4.4.
--
-- ROLLBACK (before any profile is opened once 0323 is applied): drop the two doors and the two
-- helpers; drop table search.profile_openings; drop the policies
-- search_impressions_creator_search_definer_select, _update and revoke their grants; revoke select
-- (filters, campaign_id) on search.search_queries, (residence_region_code) on
-- profiles.creator_public_profiles, (object_key, width, height) on profiles.portfolio_items from
-- influx_creator_search_definer; recreate search_settings_creator_search_definer_select with the
-- six keys of 0320.
-- =============================================================================

-- 1. The openings of a profile (modele §2; 10 RG63, RG66; 18 T15.2) --------------------------------

create table if not exists search.profile_openings (
  id                  uuid        not null default gen_random_uuid() primary key,
  account_id          uuid        not null references identity.accounts (id),
  outcome             text        not null,
  creator_account_id  uuid        references identity.accounts (id),
  search_query_id     uuid        references search.search_queries (id) on delete cascade,
  request_id          text,
  created_at          timestamptz not null default now(),

  constraint profile_openings_outcome check (outcome in ('served', 'rate_limited')),
  -- modele §2: a creator served, none refused; a refusal names no search of origin
  constraint profile_openings_outcome_coherent check (
    (outcome = 'served') = (creator_account_id is not null)
    and (outcome = 'served' or search_query_id is null)),
  constraint profile_openings_request_id
    check (request_id is null or char_length(request_id) between 1 and 100)
);

-- the bucket and the refusal of an account, the date (purge, AL21), the creator (erasure)
create index if not exists profile_openings_bucket_idx
  on search.profile_openings (account_id, created_at desc);
create index if not exists profile_openings_created_idx
  on search.profile_openings (created_at);
create index if not exists profile_openings_creator_idx
  on search.profile_openings (creator_account_id)
  where creator_account_id is not null;

comment on table search.profile_openings is
  'One line per opening of an anonymous creator profile by a brand (l3f/modele.md §2; 10 RG63, '
  'RG66, CA48; 18 T15.2): served (the creator, the search of origin when one served it within 24 h) '
  'or rate_limited (one per account and 24 h, no creator nor search, L3DS-1). Written by '
  'search.open_creator_profile() in the transaction that serves; counted against '
  'rate_limits.profileOpensPerDay. Append-only (guard_search_journal_write); never served nor '
  'exported (like the impressions); erased by 0325. RLS forced, NO member right. Kept 12 months.';

alter table search.profile_openings enable row level security;
alter table search.profile_openings force row level security;
revoke all on search.profile_openings from public, anon, authenticated, service_role,
  influx_advertiser, influx_creator, influx_agent, influx_admin;

-- the second line of « no member right » (0316 §7): even a grant written by mistake sees no row
drop policy if exists profile_openings_no_member_access on search.profile_openings;
create policy profile_openings_no_member_access on search.profile_openings
  as restrictive for all to influx_advertiser, influx_creator
  using (false) with check (false);

drop trigger if exists profile_openings_immutable on search.profile_openings;
create trigger profile_openings_immutable
  before update or delete on search.profile_openings
  for each row execute function search.guard_search_journal_write();

-- 2. What influx_creator_search_definer reads and writes beyond 0322 (modele §2 to §4) -------------

-- 2.1 The region of a published and searchable storefront (its policy of 0319 unchanged)
grant select (residence_region_code)
   on profiles.creator_public_profiles to influx_creator_search_definer;

-- 2.2 The object of an APPROVED visual of a published and searchable storefront (modele §3, -1:
-- read by the door of the visual, relayed by apps/api, never served; its policy of 0319 unchanged)
grant select (object_key, width, height)
   on profiles.portfolio_items to influx_creator_search_definer;

-- 2.3 The settings it reads: the threshold of the region beside the six keys of 0320
drop policy if exists search_settings_creator_search_definer_select on search.search_settings;
create policy search_settings_creator_search_definer_select on search.search_settings
  for select to influx_creator_search_definer
  using (key in ('is_open_to_advertisers', 'k_anonymity_threshold', 'page_size', 'max_pages',
                 'rate_limits', 'cold_profile_quota', 'region_display_threshold'));

-- 2.4 The origin of an opening: the filters and the campaign of its own searches, the impressions of
-- its own searches, read and opened once (the guard of 0316 holds « once, nothing else »)
grant select (filters, campaign_id) on search.search_queries to influx_creator_search_definer;
grant select (search_query_id, creator_account_id, was_opened),
      update (was_opened, opened_at)
   on search.search_impressions to influx_creator_search_definer;

drop policy if exists search_impressions_creator_search_definer_select on search.search_impressions;
create policy search_impressions_creator_search_definer_select on search.search_impressions
  for select to influx_creator_search_definer
  using (exists (select 1 from search.search_queries q
                  where q.id = search_impressions.search_query_id
                    and q.account_id = (select influx.current_account_id())));
drop policy if exists search_impressions_creator_search_definer_update on search.search_impressions;
create policy search_impressions_creator_search_definer_update on search.search_impressions
  for update to influx_creator_search_definer
  using (exists (select 1 from search.search_queries q
                  where q.id = search_impressions.search_query_id
                    and q.account_id = (select influx.current_account_id())))
  with check (exists (select 1 from search.search_queries q
                       where q.id = search_impressions.search_query_id
                         and q.account_id = (select influx.current_account_id())));

-- 2.5 Its own openings: counted by the bucket, inserted by the door
grant select (id, account_id, outcome, created_at),
      insert (account_id, outcome, creator_account_id, search_query_id, request_id)
   on search.profile_openings to influx_creator_search_definer;

drop policy if exists profile_openings_creator_search_definer_select on search.profile_openings;
create policy profile_openings_creator_search_definer_select on search.profile_openings
  for select to influx_creator_search_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists profile_openings_creator_search_definer_insert on search.profile_openings;
create policy profile_openings_creator_search_definer_insert on search.profile_openings
  for insert to influx_creator_search_definer
  with check (account_id = (select influx.current_account_id())
              and (search_query_id is null
                   or exists (select 1 from search.search_queries q
                               where q.id = profile_openings.search_query_id
                                 and q.account_id = (select influx.current_account_id()))));

-- 3. The helpers and the doors, as influx_creator_search_definer (03 P7 rule 5) --------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_search_definer', current_user);
end
$$;
grant create on schema search to influx_creator_search_definer;
set role influx_creator_search_definer;

-- 3.1 The region shown on a profile (modele §4; 10 RG15, CA15; 07 RG37)
create or replace function search.displayed_region(p_creator_account_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  -- the threshold in table; missing, no region (EC-L3F-03-2)
  select p.residence_region_code
    from profiles.creator_public_profiles p
   where p.account_id = p_creator_account_id
     and p.residence_region_code is not null
     and (select pg_catalog.count(*)
            from profiles.creator_public_profiles o
            join identity.accounts a on a.id = o.account_id
           -- E1 to E4: published, searchable, account active, majority attested
           where o.status = 'published'
             and o.is_searchable
             and a.status = 'active'
             and a.is_adult_attested
             and o.residence_country_code = p.residence_country_code
             and o.residence_region_code = p.residence_region_code)
         >= (select (s.value)::integer from search.search_settings s
              where s.key = 'region_display_threshold');
$$;

comment on function search.displayed_region(uuid) is
  'l3f/modele.md §4 (0323, EC-L3F-6; 10 RG15, CA15; 07 RG37): the region of residence of the '
  'creator p_creator_account_id when at least region_display_threshold storefronts E1 to E4 '
  '(published, searchable, account active, majority attested) share its (country, region); NULL '
  'below, without a region, or without the threshold in table (EC-L3F-03-2). The same answer for '
  'every brand (neither E5 nor E6); never a count. SECURITY INVOKER owned by '
  'influx_creator_search_definer, executed by its owner only.';

-- 3.2 The bucket of the openings of an account (modele §2; 10 RG63, RG64; 18 T15.2; L3DS-1)
create or replace function search.creator_open_retry_after(
  p_account_id             uuid,
  out retry_after_seconds  integer,
  out journal_refusal      boolean)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_per_day  integer;
  v_day      integer;
  v_exit     timestamptz;
begin
  journal_refusal := false;
  select (s.value ->> 'profileOpensPerDay')::integer into v_per_day
    from search.search_settings s
   where s.key = 'rate_limits';
  if v_per_day is null then
    raise exception 'creator_search_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'creator_search_settings';
  end if;

  -- one opening at a time per account: the count, the check and the line the door adds are one step
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.profile_openings:' || p_account_id::text, 0));

  -- served by profile_openings_bucket_idx: every opening served, a reopening included
  select (count(*))::integer into v_day
    from search.profile_openings o
   where o.account_id = p_account_id
     and o.outcome = 'served'
     and o.created_at > pg_catalog.now() - interval '24 hours';
  if v_day < v_per_day then
    return;
  end if;

  -- the exit of the line that leaves the count of the window below its limit (EC-L3D-02-3)
  select o.created_at + interval '24 hours' into v_exit
    from search.profile_openings o
   where o.account_id = p_account_id
     and o.outcome = 'served'
     and o.created_at > pg_catalog.now() - interval '24 hours'
   order by o.created_at
  offset v_day - v_per_day
   limit 1;
  retry_after_seconds :=
    greatest((pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer, 1);

  -- L3DS-1: one rate_limited line per account and 24 h, so the refusals never grow without bound
  journal_refusal := not exists (
    select 1
      from search.profile_openings o
     where o.account_id = p_account_id
       and o.outcome = 'rate_limited'
       and o.created_at > pg_catalog.now() - interval '24 hours');
end
$$;

comment on function search.creator_open_retry_after(uuid) is
  'l3f/modele.md §2 (0323; 10 RG63, RG64; 18 T15.2; pattern 0319): under a transaction lock per '
  'account, counts the openings served to p_account_id on 24 h sliding (a reopening included), '
  'against rate_limits.profileOpensPerDay of search.search_settings (55000 creator_search_settings '
  'when missing). Within it: (NULL, false). Otherwise retry_after_seconds, the whole seconds, at '
  'least 1, before the count falls below the limit, and journal_refusal, true when no rate_limited '
  'line of the account lies in the last 24 h (L3DS-1). Writes nothing. SECURITY INVOKER owned by '
  'influx_creator_search_definer, executed by its owner only.';

-- 3.3 THE door of the anonymous profile (modele §2; 10 RG4, RG47, RG48, RG50, RG63 to RG66; CA6,
-- CA15, CA48, CA49, CA59)
create or replace function search.open_creator_profile(p_alias text)
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
  v_retry      integer;
  v_journal    boolean;
  v_creator    uuid;
  v_origin     uuid;
  v_filters    jsonb;
  v_was        uuid;
  v_campaign   uuid;
  v_layer      jsonb;
  v_reasons    jsonb;
  v_vigilance  text;
begin
  v_caller := search.require_creator_searcher();

  -- RG1: a brand profile not published opens nothing; nothing written
  if not exists (select 1 from profiles.advertiser_profiles a
                  where a.account_id = v_caller and a.status = 'published') then
    return pg_catalog.jsonb_build_object('state', 'brand_not_published');
  end if;

  -- D38, CA59: closed, no profile; nothing written nor counted (missing is closed)
  select s.value into v_open from search.search_settings s where s.key = 'is_open_to_advertisers';
  if v_open is distinct from 'true'::jsonb then
    return pg_catalog.jsonb_build_object('state', 'closed');
  end if;

  -- RG63, RG64, T15.2: the bucket of the account full, nothing served, the refusal journaled once
  -- per 24 h, without a creator nor a search (L3DS-1)
  select r.retry_after_seconds, r.journal_refusal into v_retry, v_journal
    from search.creator_open_retry_after(v_caller) r;
  if v_retry is not null then
    if v_journal then
      insert into search.profile_openings (account_id, outcome, request_id)
      values (v_caller, 'rate_limited', v_request);
    end if;
    return pg_catalog.jsonb_build_object('state', 'rate_limited', 'retryAfterSeconds', v_retry);
  end if;

  -- the alias of a published and searchable storefront (the policy of the owner holds E1, E2)
  select p.account_id into v_creator
    from profiles.creator_public_profiles p
   where p.alias = p_alias;

  if v_creator is not null then
    -- the origin (-3): the latest impression of this creator in a search of the caller served
    -- within 24 h (EC-L3F-03-6); never an identifier served
    select q.id, q.filters, q.campaign_id into v_origin, v_filters, v_was
      from search.search_impressions i
      join search.search_queries q on q.id = i.search_query_id
     where i.creator_account_id = v_creator
       and q.account_id = v_caller
       and q.outcome = 'served'
       and q.created_at > pg_catalog.now() - interval '24 hours'
     order by q.created_at desc, q.id desc
     limit 1;
    -- its campaign while admitted, otherwise none (EC-L3F-03-3)
    if v_was is not null and search.is_admitted_campaign(v_caller, v_was) then
      v_campaign := v_was;
    end if;

    -- RG4: a member of THE engine with the campaign of origin, E1 to E6 silent
    if not exists (select 1
                     from search.creator_candidates('advertiser_anonymous', v_caller, '{}'::jsonb,
                                                    v_campaign) c
                    where c.creator_account_id = v_creator) then
      v_creator := null;
    end if;
  end if;

  -- CA49: unknown, excluded or malformed, ONE answer, nothing written nor counted
  if v_creator is null then
    raise exception 'creator_not_found' using errcode = 'no_data_found', detail = 'creator';
  end if;

  -- RG66, CA48: the opening, then the impression of origin opened once, in the transaction that
  -- serves (a write refused, nothing served)
  insert into search.profile_openings
    (account_id, outcome, creator_account_id, search_query_id, request_id)
  values (v_caller, 'served', v_creator, v_origin, v_request);
  if v_origin is not null then
    update search.search_impressions i
       set was_opened = true, opened_at = pg_catalog.now()
     where i.search_query_id = v_origin
       and i.creator_account_id = v_creator
       and not i.was_opened;
  end if;

  -- RG41, RG42: the reasons and the note of this creator with the filters and the campaign of
  -- origin (EC-L3F-03-4)
  select o.reasons, o.vigilance into v_reasons, v_vigilance
    from search.creator_order(array[v_creator], coalesce(v_filters, '{}'::jsonb), 'default',
                              v_campaign, 1, 1, v_day) o;

  -- CA6, RG50: the card from its one source, without its status nor the key of a line, and the
  -- region beside it (RG15, EC-L3F-03-5)
  v_layer := profiles.creator_layer_a(v_creator);
  return pg_catalog.jsonb_build_object(
    'state',           'profile',
    'creator',         (v_layer - 'status' - 'lines')
                       || pg_catalog.jsonb_build_object(
                            'lines',
                            coalesce((select pg_catalog.jsonb_agg(x.line - 'lineKey' order by x.ord)
                                        from pg_catalog.jsonb_array_elements(v_layer -> 'lines')
                                             with ordinality x (line, ord)),
                                     '[]'::jsonb)),
    'residenceRegion', search.displayed_region(v_creator),
    'reasons',         coalesce(v_reasons, '[]'::jsonb),
    'vigilance',       v_vigilance);
end
$$;

comment on function search.open_creator_profile(text) is
  'l3f/modele.md §2 (0323; 10 RG1, RG2, RG4, RG15, RG47, RG48, RG50, RG63 to RG66; CA6, CA15, CA48, '
  'CA49, CA59; 18 T15.2): the anonymous profile of the creator of alias p_alias for the calling '
  'brand (search.require_creator_searcher: 42501 otherwise). In order: a brand profile not '
  'published {state: brand_not_published}; the switch false {state: closed} (nothing written nor '
  'counted); the bucket of profileOpensPerDay full {state: rate_limited, retryAfterSeconds} (a '
  'line per 24 h); the alias not a member of search.creator_candidates() with the campaign of '
  'origin (unknown, excluded by E1 to E6, malformed): P0002 DETAIL creator, one answer, nothing '
  'written nor counted. Otherwise, in the transaction that serves, a line served of '
  'search.profile_openings and the impression of origin (the latest of this creator in a search of '
  'the caller served within 24 h) opened once; {state: profile, creator (the card: '
  'profiles.creator_layer_a without status nor lineKey), residenceRegion '
  '(search.displayed_region, NULL below the threshold), reasons [{code, params}], vigilance} with '
  'the filters and the admitted campaign of origin. SECURITY DEFINER owned by '
  'influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

-- 3.4 THE door of a visual, relayed by apps/api (modele §3; D82 (7), EC-L2G-16; 10 CA50; 07 RG85)
create or replace function search.read_creator_visual(p_alias text, p_visual_id uuid)
returns table (
  object_key  text,
  width       integer,
  height      integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller   uuid;
  v_open     jsonb;
  v_creator  uuid;
begin
  -- a refused caller reads no row (EC-L3F-03-1)
  begin
    v_caller := search.require_creator_searcher();
  exception
    when insufficient_privilege then
      return;
  end;
  if p_alias is null or p_visual_id is null then
    return;
  end if;

  -- RG1 and D38: a brand profile not published, or the switch false, reads no visual
  if not exists (select 1 from profiles.advertiser_profiles a
                  where a.account_id = v_caller and a.status = 'published') then
    return;
  end if;
  select s.value into v_open from search.search_settings s where s.key = 'is_open_to_advertisers';
  if v_open is distinct from 'true'::jsonb then
    return;
  end if;

  -- RG4: the alias of a storefront the engine lists for the caller, without campaign
  select p.account_id into v_creator
    from profiles.creator_public_profiles p
   where p.alias = p_alias;
  if v_creator is null
     or not exists (select 1
                      from search.creator_candidates('advertiser_anonymous', v_caller, '{}'::jsonb,
                                                     null) c
                     where c.creator_account_id = v_creator) then
    return;
  end if;

  -- CA50, RG85: an APPROVED visual of this creator, its object read here and relayed, never served
  return query
    select v.object_key, v.width, v.height
      from profiles.portfolio_items v
     where v.id = p_visual_id
       and v.account_id = v_creator
       and v.state = 'approved';
end
$$;

comment on function search.read_creator_visual(text, uuid) is
  'l3f/modele.md §3 (0323, EC-L3F-1; D82 (7), EC-L2G-16; 10 CA50; 07 RG85): the object (key, width, '
  'height) of the APPROVED visual p_visual_id of the creator of alias p_alias, for apps/api which '
  'relays its bytes; the key never leaves apps/api. No row for a refused caller (EC-L3F-03-1), a '
  'brand profile not published, the switch false, an alias the engine does not list for the caller '
  'without campaign, a visual unknown, not approved or of another creator. Neither journal nor '
  'bucket of account. SECURITY DEFINER owned by influx_creator_search_definer, empty search_path; '
  'EXECUTE for influx_advertiser only.';

-- 4. Rights on the functions (03 P7 rule 5), then the owner given back -------------------------------

revoke all on function search.displayed_region(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.creator_open_retry_after(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.open_creator_profile(text)
  from public, anon, authenticated, service_role;
revoke all on function search.read_creator_visual(text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function search.open_creator_profile(text) to influx_advertiser;
grant execute on function search.read_creator_visual(text, uuid) to influx_advertiser;

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
  c_region   constant text := 'search.displayed_region(uuid)';
  c_bucket   constant text := 'search.creator_open_retry_after(uuid)';
  c_profile  constant text := 'search.open_creator_profile(text)';
  c_visual   constant text := 'search.read_creator_visual(text, uuid)';
  c_search   constant text := 'search.search_creators(jsonb, text, integer, uuid)';
  c_layer_i  constant text :=
    'creator_identities|creator_social_accounts|creator_audience_ages|creator_audience_countries'
    '|creator_audience_genders|creator_network_metrics_history';
  v_def      record;
  v_bad      text;
begin
  -- the helpers and the doors: owner, mode, empty search_path
  for v_def in
    select * from (values (c_region, false), (c_bucket, false), (c_profile, true),
                          (c_visual, true)) as d (fn, definer)
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

  -- EXECUTE: the two doors to influx_advertiser, the helpers to nobody
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in (c_region::regprocedure, c_bucket::regprocedure, c_profile::regprocedure,
                   c_visual::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (p.oid in (c_profile::regprocedure, c_visual::regprocedure)
              and a.grantee = 'influx_advertiser'::regrole);
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

  -- modele §1: the profile reads a campaign of origin through is_admitted_campaign() alone; the
  -- visual never reads a campaign
  if (select p.prosrc from pg_catalog.pg_proc p where p.oid = c_profile::regprocedure)
       !~ 'search\.is_admitted_campaign\(v_caller, v_was\)'
     or (select p.prosrc from pg_catalog.pg_proc p where p.oid = c_profile::regprocedure)
       ~ 'campaigns\.campaigns'
     or (select p.prosrc from pg_catalog.pg_proc p where p.oid = c_visual::regprocedure)
       ~ 'campaigns\.' then
    raise exception 'L3ES-1: the profile or the visual reads a campaign outside is_admitted_campaign()';
  end if;

  -- of a visual, the six columns of the card (0319) and its object (modele §3), nothing else
  select string_agg(at.attname, ', ' order by at.attname) into v_bad
    from pg_catalog.pg_attribute at
   where at.attrelid = 'profiles.portfolio_items'::regclass
     and at.attnum > 0 and not at.attisdropped
     and pg_catalog.has_column_privilege(c_owner, at.attrelid, at.attnum, 'SELECT')
     and at.attname not in ('id', 'account_id', 'state', 'caption', 'display_order', 'created_at',
                            'object_key', 'width', 'height');
  if v_bad is not null then
    raise exception 'influx_creator_search_definer reads a column of a visual it must not: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege(c_owner, 'storage', 'USAGE') then
    raise exception 'influx_creator_search_definer must never reach Storage (D82 (7))';
  end if;

  -- of a storefront, never public_ref; the region now (modele §4)
  if pg_catalog.has_column_privilege(c_owner, 'profiles.creator_public_profiles', 'public_ref',
                                     'SELECT')
     or not pg_catalog.has_column_privilege(c_owner, 'profiles.creator_public_profiles',
                                            'residence_region_code', 'SELECT') then
    raise exception 'influx_creator_search_definer: public_ref never, the region of residence read';
  end if;

  -- the openings: RLS forced, the restrictive policy, no right to an execution role
  if not (select c.relrowsecurity and c.relforcerowsecurity from pg_catalog.pg_class c
           where c.oid = 'search.profile_openings'::regclass)
     or not exists (select 1 from pg_catalog.pg_policy p
                     where p.polrelid = 'search.profile_openings'::regclass
                       and p.polname = 'profile_openings_no_member_access'
                       and not p.polpermissive) then
    raise exception 'search.profile_openings must force RLS with its restrictive member policy';
  end if;
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                       'influx_privacy', 'anon', 'authenticated', 'service_role')
     and (pg_catalog.has_table_privilege(r.oid, 'search.profile_openings',
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(r.oid, 'search.profile_openings',
                                                 'SELECT, INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'search.profile_openings reached by an execution role: %', v_bad;
  end if;

  -- fiche invariant 4: the brand executes the three doors of search, nothing else there
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'search'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
     and p.oid not in (c_search::regprocedure, c_profile::regprocedure, c_visual::regprocedure);
  if v_bad is not null then
    raise exception 'influx_advertiser executes a search function beyond its doors: %', v_bad;
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE') then
    raise exception 'influx_creator_search_definer left with a member or CREATE';
  end if;
end
$$;
