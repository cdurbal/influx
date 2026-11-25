-- =============================================================================
-- 0327_search_doors_hide_an_exclusion
-- -----------------------------------------------------------------------------
-- Lot 3 / L3G, commit 01 (jalons/l3g/01.md; l3g-fiche.md invariants 2, 3; D85; debts L3FS-1, L3FS-2
-- and the SQL side of L3FS-3, archives/jalons/l3f/annexe.md § Revue). The doors of the profile, of a
-- visual and of the shortlists answer an excluded creator in the time of an unknown one, and no door
-- of search waits more than a second for the lock of an account. Signalled I-4 (03): SECURITY DEFINER
-- doors recreated at equal signature by their owner (owner, mode, search_path and EXECUTE kept by
-- CREATE OR REPLACE); no GRANT, policy, table nor role added or removed.
--
-- 1. L3FS-1: search.open_creator_profile() and search.read_creator_visual() run THE engine
--    (search.creator_candidates) and, for the profile, the search of the impression of origin, whether
--    the alias names a storefront or not: an alias that names none is looked up as a stand-in
--    identifier that names nobody (the nil uuid), never short-circuited (0323 l. 369, l. 496), so an
--    unknown alias and an excluded one take the same path to the one P0002 creator.
-- 2. L3FS-2: search.remove_from_shortlist() removes the creator search.shortlist_creator() resolves
--    with the campaign of the list, as set_shortlist_note() (0324 l. 683): a creator hidden from the
--    caller is no longer removed through its alias (EC-L3G-1 of D85, « masqué non retirable »); the
--    answer stays {state: removed} in every case. The bound itemsPerList still counts every row (D85).
-- 3. L3FS-3, D85 (1): every SQL door that takes an advisory lock per account waits for it 1 s at most
--    (lock_timeout set for the lock alone, the caller's value given back once it is held): 55P03
--    otherwise, which apps/api answers 429 rate_limited (L3G-03). The seven helpers and doors:
--      search.campaign_read_retry_after(uuid)          (0314, 0315: the creator's feed)
--      search.creator_search_retry_after(uuid)         (0319: the creator search)
--      search.creator_open_retry_after(uuid)           (0323: the openings of a profile)
--      search.create_shortlist, update_shortlist, delete_shortlist, add_to_shortlist,
--        set_shortlist_note, remove_from_shortlist     (0324)
--      search.request_team_selection(jsonb, uuid, text) (0325)
--    search.write_search_setting() and write_facet_setting() (0316) take a global lock of the admins,
--    not a lock per account: line 08 of L3G recreates them.
-- 4. L3FS-3, D85 (2): THE engine out of the lock of the account. open_creator_profile() reads the
--    bucket first without the lock (full or its setting missing: the bucket under its lock answers, as
--    before, and the engine never runs), then the alias, the impression of origin, the engine and the
--    reasons, then the bucket under its lock counted again, then the opening. add_to_shortlist(),
--    set_shortlist_note() and remove_from_shortlist() read the list and run the engine before the lock,
--    read the list again under it, and run the engine again when its campaign changed meanwhile.
--
-- Not here: the routes, the contracts and apps/api/src/platform/member-rate.ts (L3G-03: the rate per
-- address of the six writes, 55P03 → 429); the tests at two committed connections (L3G-02).
--
-- EC-L3G-01 (micro-gaps, the safest choice):
--   EC-L3G-01-1  lock_timeout is set for the wait of the lock only, through set_config(.., true), and
--                the caller's value is set back once the lock is held: neither a SET clause (the
--                catalogue tests read proconfig = {search_path=""}) nor a SET LOCAL left to the end of
--                the transaction, where it would bound the waits of the statements that follow.
--   EC-L3G-01-2  the stand-in of an alias that names no storefront is the nil uuid: no account bears
--                it (gen_random_uuid), and an equality with a NULL parameter could be folded by the
--                planner into « no row » without running the engine.
--   EC-L3G-01-3  search.search_creators() keeps its engine under the lock of its bucket: the search is
--                the engine, and D85 (2) (relecture et recompte) names the profile and the shortlists
--                only (lot3-plan 00b); update_shortlist() keeps its summary (the engine once) under
--                the lock, the summary of the list as it now stands.
--   EC-L3G-01-4  open_creator_profile() asks for the reasons of the creator (search.creator_order) before
--                the lock too, with the origin read before it; the card, the opening and the impression
--                stay in the step that serves.
--   EC-L3G-01-5  read_creator_visual() loses its early return on a NULL alias or visual: the engine
--                runs, the answer stays no row.
--
-- ROLLBACK: recreate the eleven functions as in 0315 §2.1 (influx_campaign_feed_definer), 0319 §4.2,
-- 0323 §3.2 to §3.4, 0324 §3.7 and 0325 §7 (influx_creator_search_definer), each by its owner. No data
-- to restore.
-- =============================================================================

-- 1. The feed of a creator: its bucket waits 1 s at most (D85 (1)) ----------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_feed_definer', current_user);
end
$$;
grant create on schema search to influx_campaign_feed_definer;
set role influx_campaign_feed_definer;

create or replace function search.campaign_read_retry_after(
  p_creator_account_id     uuid,
  out retry_after_seconds  integer,
  out journal_refusal      boolean)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_per_minute  integer;
  v_per_day     integer;
  v_minute      integer;
  v_day         integer;
  v_exit        timestamptz;
  v_retry       integer;
  v_wait        text := pg_catalog.current_setting('lock_timeout');
begin
  journal_refusal := false;
  select (s.value)::integer into v_per_minute
    from backoffice.operational_settings s
   where s.key = 'creator_campaign_reads_per_minute';
  select (s.value)::integer into v_per_day
    from backoffice.operational_settings s
   where s.key = 'creator_campaign_reads_per_day';
  if v_per_minute is null or v_per_day is null then
    raise exception 'campaign_feed_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_feed_settings';
  end if;

  -- one read at a time per account: the count, the check and the line the door adds are one step;
  -- D85 (1): 1 s at most for the lock (55P03), the caller's lock_timeout given back once held
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.creator_campaign_reads:' || p_creator_account_id::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);

  -- served by creator_campaign_reads_bucket_idx (0315): a refused read is counted, a rate_limited never
  select (count(*) filter (where r.read_at > pg_catalog.now() - interval '60 seconds'))::integer,
         (count(*))::integer
    into v_minute, v_day
    from search.creator_campaign_reads r
   where r.creator_account_id = p_creator_account_id
     and r.outcome <> 'rate_limited'
     and r.read_at > pg_catalog.now() - interval '24 hours';

  -- EC-L3D-02-3: the exit of the line that leaves the count of the window below its limit
  if v_minute >= v_per_minute then
    select r.read_at + interval '60 seconds' into v_exit
      from search.creator_campaign_reads r
     where r.creator_account_id = p_creator_account_id
       and r.outcome <> 'rate_limited'
       and r.read_at > pg_catalog.now() - interval '60 seconds'
     order by r.read_at
     offset v_minute - v_per_minute
     limit 1;
    v_retry := (pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer;
  end if;
  if v_day >= v_per_day then
    select r.read_at + interval '24 hours' into v_exit
      from search.creator_campaign_reads r
     where r.creator_account_id = p_creator_account_id
       and r.outcome <> 'rate_limited'
       and r.read_at > pg_catalog.now() - interval '24 hours'
     order by r.read_at
     offset v_day - v_per_day
     limit 1;
    v_retry := greatest(coalesce(v_retry, 0),
                        (pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer);
  end if;
  if v_retry is null then
    return;
  end if;
  retry_after_seconds := greatest(v_retry, 1);

  -- L3DS-1: one rate_limited line per account in the window that refuses (24 h when the day is
  -- full, 60 s otherwise; EC-L3E-01-1, -2); at most one per 60 s, so this walk stays bounded
  journal_refusal := not exists (
    select 1
      from search.creator_campaign_reads r
     where r.creator_account_id = p_creator_account_id
       and r.outcome = 'rate_limited'
       and r.read_at > pg_catalog.now()
                       - case when v_day >= v_per_day then interval '24 hours'
                              else interval '60 seconds' end);
end
$$;

comment on function search.campaign_read_retry_after(uuid) is
  'l3d/modele.md §5 (0314, EC-L3D-02-2, -3; 0315, L3DS-1, EC-L3E-01; 0327, D85): under a transaction '
  'lock per account, waited 1 s at most (55P03 lock_not_available otherwise), counts the reads of the '
  'feed and of the records of p_creator_account_id but rate_limited ones on 60 s and 24 h sliding '
  '(creator_campaign_reads_bucket_idx), against creator_campaign_reads_per_minute and '
  'creator_campaign_reads_per_day (55000 campaign_feed_settings when one is missing). Within both '
  'limits: (NULL, false). Otherwise retry_after_seconds, the whole seconds, at least 1, before the '
  'count of every full window falls below its limit, and journal_refusal, true when no rate_limited '
  'line of the account lies in the window that refuses (24 h when the day is full, 60 s otherwise). '
  'Writes nothing: the door writes the line. SECURITY INVOKER owned by influx_campaign_feed_definer, '
  'executed by its owner only.';

reset role;
revoke create on schema search from influx_campaign_feed_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_feed_definer', current_user);
end
$$;

-- 2. The doors of the creator search's owner ------------------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_search_definer', current_user);
end
$$;
grant create on schema search to influx_creator_search_definer;
set role influx_creator_search_definer;

-- 2.1 The bucket of the creator search (0319 §4.2): 1 s at most for its lock (D85 (1))
create or replace function search.creator_search_retry_after(
  p_account_id             uuid,
  out retry_after_seconds  integer,
  out journal_refusal      boolean)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_per_hour  integer;
  v_per_day   integer;
  v_hour      integer;
  v_day       integer;
  v_exit      timestamptz;
  v_retry     integer;
  v_wait      text := pg_catalog.current_setting('lock_timeout');
begin
  journal_refusal := false;
  select (s.value ->> 'perHour')::integer, (s.value ->> 'perDay')::integer
    into v_per_hour, v_per_day
    from search.search_settings s
   where s.key = 'rate_limits';
  if v_per_hour is null or v_per_day is null then
    raise exception 'creator_search_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'creator_search_settings';
  end if;

  -- one search at a time per account: the count, the check and the line the door adds are one step;
  -- D85 (1): 1 s at most for the lock (55P03), the caller's lock_timeout given back once held
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.search_queries:' || p_account_id::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);

  -- served by search_queries_bucket_idx (0316): a page is a search (served, page_cap), a
  -- rate_limited line never counts
  select (count(*) filter (where q.created_at > pg_catalog.now() - interval '1 hour'))::integer,
         (count(*))::integer
    into v_hour, v_day
    from search.search_queries q
   where q.account_id = p_account_id
     and q.outcome <> 'rate_limited'
     and q.created_at > pg_catalog.now() - interval '24 hours';

  -- the exit of the line that leaves the count of a full window below its limit (EC-L3D-02-3)
  if v_hour >= v_per_hour then
    select q.created_at + interval '1 hour' into v_exit
      from search.search_queries q
     where q.account_id = p_account_id
       and q.outcome <> 'rate_limited'
       and q.created_at > pg_catalog.now() - interval '1 hour'
     order by q.created_at
     offset v_hour - v_per_hour
     limit 1;
    v_retry := (pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer;
  end if;
  if v_day >= v_per_day then
    select q.created_at + interval '24 hours' into v_exit
      from search.search_queries q
     where q.account_id = p_account_id
       and q.outcome <> 'rate_limited'
       and q.created_at > pg_catalog.now() - interval '24 hours'
     order by q.created_at
     offset v_day - v_per_day
     limit 1;
    v_retry := greatest(coalesce(v_retry, 0),
                        (pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer);
  end if;
  if v_retry is null then
    return;
  end if;
  retry_after_seconds := greatest(v_retry, 1);

  -- L3DS-1: one rate_limited line per account in the window that refuses (24 h when the day is
  -- full, 1 h otherwise), so the refusals never grow without bound
  journal_refusal := not exists (
    select 1
      from search.search_queries q
     where q.account_id = p_account_id
       and q.outcome = 'rate_limited'
       and q.created_at > pg_catalog.now()
                          - case when v_day >= v_per_day then interval '24 hours'
                                 else interval '1 hour' end);
end
$$;

comment on function search.creator_search_retry_after(uuid) is
  'l3e/modele.md §8 (0319; 10 RG63, RG64; 18 T15.2, T15.5; pattern 0315; 0327, D85): under a '
  'transaction lock per account, waited 1 s at most (55P03 lock_not_available otherwise), counts the '
  'searches of p_account_id but rate_limited ones (a page is a search) on 1 h and 24 h sliding '
  '(search_queries_bucket_idx), against rate_limits perHour and perDay of search.search_settings '
  '(55000 creator_search_settings when missing). Within both: (NULL, false). Otherwise '
  'retry_after_seconds, the whole seconds, at least 1, before the count of every full window falls '
  'below its limit, and journal_refusal, true when no rate_limited line of the account lies in the '
  'window that refuses (24 h when the day is full, 1 h otherwise). Writes nothing. SECURITY INVOKER '
  'owned by influx_creator_search_definer, executed by its owner only.';

-- 2.2 The bucket of the openings (0323 §3.2): 1 s at most for its lock (D85 (1))
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
  v_wait     text := pg_catalog.current_setting('lock_timeout');
begin
  journal_refusal := false;
  select (s.value ->> 'profileOpensPerDay')::integer into v_per_day
    from search.search_settings s
   where s.key = 'rate_limits';
  if v_per_day is null then
    raise exception 'creator_search_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'creator_search_settings';
  end if;

  -- one opening at a time per account: the count, the check and the line the door adds are one step;
  -- D85 (1): 1 s at most for the lock (55P03), the caller's lock_timeout given back once held
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.profile_openings:' || p_account_id::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);

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
  'l3f/modele.md §2 (0323; 10 RG63, RG64; 18 T15.2; pattern 0319; 0327, D85): under a transaction '
  'lock per account, waited 1 s at most (55P03 lock_not_available otherwise), counts the openings '
  'served to p_account_id on 24 h sliding (a reopening included), against '
  'rate_limits.profileOpensPerDay of search.search_settings (55000 creator_search_settings when '
  'missing). Within it: (NULL, false). Otherwise retry_after_seconds, the whole seconds, at least 1, '
  'before the count falls below the limit, and journal_refusal, true when no rate_limited line of the '
  'account lies in the last 24 h (L3DS-1). Writes nothing. SECURITY INVOKER owned by '
  'influx_creator_search_definer, executed by its owner only.';

-- 2.3 THE door of the anonymous profile (0323 §3.3): one path for an unknown alias and an excluded one
-- (L3FS-1), the engine out of the lock (D85 (2))
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
  v_per_day    integer;
  v_retry      integer;
  v_journal    boolean;
  v_found      uuid;
  v_probe      uuid;
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

  -- RG63, RG64, T15.2, D85 (2): the bucket read first without the lock; full, or its setting missing
  -- (55000 below), the bucket under its lock answers before any alias is looked at
  select (s.value ->> 'profileOpensPerDay')::integer into v_per_day
    from search.search_settings s
   where s.key = 'rate_limits';
  if v_per_day is null
     or (select (count(*))::integer
           from search.profile_openings o
          where o.account_id = v_caller
            and o.outcome = 'served'
            and o.created_at > pg_catalog.now() - interval '24 hours') >= v_per_day then
    select r.retry_after_seconds, r.journal_refusal into v_retry, v_journal
      from search.creator_open_retry_after(v_caller) r;
  end if;

  if v_retry is null then
    -- the alias of a published and searchable storefront (the policy of the owner holds E1, E2);
    -- L3FS-1: one that names none is looked up as a stand-in that names nobody (EC-L3G-01-2), so the
    -- origin and THE engine run for an unknown alias as for an excluded one
    select p.account_id into v_found
      from profiles.creator_public_profiles p
     where p.alias = p_alias;
    v_probe := coalesce(v_found, '00000000-0000-0000-0000-000000000000'::uuid);

    -- the origin (-3): the latest impression of this creator in a search of the caller served
    -- within 24 h (EC-L3F-03-6); never an identifier served
    select q.id, q.filters, q.campaign_id into v_origin, v_filters, v_was
      from search.search_impressions i
      join search.search_queries q on q.id = i.search_query_id
     where i.creator_account_id = v_probe
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
    if exists (select 1
                 from search.creator_candidates('advertiser_anonymous', v_caller, '{}'::jsonb,
                                                v_campaign) c
                where c.creator_account_id = v_probe) then
      v_creator := v_found;
    end if;

    -- RG41, RG42: the reasons and the note of this creator with the filters and the campaign of
    -- origin (EC-L3F-03-4), out of the lock too (EC-L3G-01-4)
    if v_creator is not null then
      select o.reasons, o.vigilance into v_reasons, v_vigilance
        from search.creator_order(array[v_creator], coalesce(v_filters, '{}'::jsonb), 'default',
                                  v_campaign, 1, 1, v_day) o;
    end if;

    -- D85: the bucket under its lock, counted again, for an alias found or not
    select r.retry_after_seconds, r.journal_refusal into v_retry, v_journal
      from search.creator_open_retry_after(v_caller) r;
  end if;

  -- the bucket of the account full, nothing served, the refusal journaled once per 24 h, without a
  -- creator nor a search (L3DS-1)
  if v_retry is not null then
    if v_journal then
      insert into search.profile_openings (account_id, outcome, request_id)
      values (v_caller, 'rate_limited', v_request);
    end if;
    return pg_catalog.jsonb_build_object('state', 'rate_limited', 'retryAfterSeconds', v_retry);
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
  'l3f/modele.md §2 (0323; 0327, L3FS-1, D85; 10 RG1, RG2, RG4, RG15, RG47, RG48, RG50, RG63 to RG66; '
  'CA6, CA15, CA48, CA49, CA59; 18 T15.2): the anonymous profile of the creator of alias p_alias for '
  'the calling brand (search.require_creator_searcher: 42501 otherwise). In order: a brand profile '
  'not published {state: brand_not_published}; the switch false {state: closed} (nothing written nor '
  'counted); the bucket of profileOpensPerDay full {state: rate_limited, retryAfterSeconds} (a line '
  'per 24 h), read first without the lock, then counted again under it (1 s at most, 55P03); the '
  'alias not a member of search.creator_candidates() with the campaign of origin (unknown, excluded '
  'by E1 to E6, malformed): P0002 DETAIL creator, one answer, nothing written nor counted. The origin '
  'and the engine run for an alias found or not (a stand-in that names nobody), out of the lock. '
  'Otherwise, in the transaction that serves, a line served of search.profile_openings and the '
  'impression of origin (the latest of this creator in a search of the caller served within 24 h) '
  'opened once; {state: profile, creator (the card: profiles.creator_layer_a without status nor '
  'lineKey), residenceRegion (search.displayed_region, NULL below the threshold), reasons [{code, '
  'params}], vigilance} with the filters and the admitted campaign of origin. SECURITY DEFINER owned '
  'by influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

-- 2.4 THE door of a visual (0323 §3.4): the engine runs whether the alias names a storefront or not
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
  v_found    uuid;
  v_probe    uuid;
begin
  -- a refused caller reads no row (EC-L3F-03-1)
  begin
    v_caller := search.require_creator_searcher();
  exception
    when insufficient_privilege then
      return;
  end;

  -- RG1 and D38: a brand profile not published, or the switch false, reads no visual
  if not exists (select 1 from profiles.advertiser_profiles a
                  where a.account_id = v_caller and a.status = 'published') then
    return;
  end if;
  select s.value into v_open from search.search_settings s where s.key = 'is_open_to_advertisers';
  if v_open is distinct from 'true'::jsonb then
    return;
  end if;

  -- RG4: the alias of a storefront the engine lists for the caller, without campaign; L3FS-1: one
  -- that names none, or none given, is looked up as a stand-in that names nobody (EC-L3G-01-2, -5)
  select p.account_id into v_found
    from profiles.creator_public_profiles p
   where p.alias = p_alias;
  v_probe := coalesce(v_found, '00000000-0000-0000-0000-000000000000'::uuid);
  if not exists (select 1
                   from search.creator_candidates('advertiser_anonymous', v_caller, '{}'::jsonb,
                                                  null) c
                  where c.creator_account_id = v_probe) then
    return;
  end if;

  -- CA50, RG85: an APPROVED visual of this creator, its object read here and relayed, never served
  return query
    select v.object_key, v.width, v.height
      from profiles.portfolio_items v
     where v.id = p_visual_id
       and v.account_id = v_found
       and v.state = 'approved';
end
$$;

comment on function search.read_creator_visual(text, uuid) is
  'l3f/modele.md §3 (0323, EC-L3F-1; 0327, L3FS-1; D82 (7), EC-L2G-16; 10 CA50; 07 RG85): the object '
  '(key, width, height) of the APPROVED visual p_visual_id of the creator of alias p_alias, for '
  'apps/api which relays its bytes; the key never leaves apps/api. No row for a refused caller '
  '(EC-L3F-03-1), a brand profile not published, the switch false, an alias the engine does not list '
  'for the caller without campaign (the engine runs for an alias found or not), a visual unknown, not '
  'approved or of another creator. Neither journal nor bucket of account. SECURITY DEFINER owned by '
  'influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

-- 2.5 The writes of the shortlists (0324 §3.7): 1 s at most for the lock of the account (D85 (1)); the
-- engine before it for the creators (D85 (2)); the removal through the engine (L3FS-2)
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
  v_wait    text := pg_catalog.current_setting('lock_timeout');
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

  -- EC-L3F-04-7: one write of a shortlist at a time per account; D85 (1): 1 s at most (55P03)
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);
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
  v_wait     text := pg_catalog.current_setting('lock_timeout');
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  -- D85 (1): 1 s at most for the lock of the account (55P03)
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);
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
  -- EC-L3G-01-3: the summary of the list as it now stands, under the lock
  return pg_catalog.jsonb_build_object(
    'state', 'shortlist', 'shortlist', search.shortlist_summaries(v_caller, p_shortlist_id) -> 0);
end
$$;

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
  v_wait    text := pg_catalog.current_setting('lock_timeout');
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  -- D85 (1): 1 s at most for the lock of the account (55P03)
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);
  -- its items go with it (on delete cascade, 0316)
  delete from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  return pg_catalog.jsonb_build_object('state', 'deleted');
end
$$;

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
  v_now       uuid;
  v_items     integer;
  v_creator   uuid;
  v_wait      text := pg_catalog.current_setting('lock_timeout');
begin
  select g.caller, g.state into v_caller, v_state from search.shortlist_gate() g;
  if v_state is not null then
    return pg_catalog.jsonb_build_object('state', v_state);
  end if;
  v_items := search.selection_limit('itemsPerList');

  -- D85 (2): the list and THE engine with its campaign, before the lock of the account
  select s.campaign_id into v_campaign
    from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  v_creator := search.shortlist_creator(v_caller, p_alias, v_campaign);

  -- D85 (1): 1 s at most for the lock (55P03); the list read again under it, the engine again when
  -- its campaign changed meanwhile (update_shortlist holds the same lock: it cannot change again)
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);
  select s.campaign_id into v_now
    from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  if v_now is distinct from v_campaign then
    v_creator := search.shortlist_creator(v_caller, p_alias, v_now);
  end if;

  -- RG4, CA49: listed by THE engine with the campaign of the list, and already served to the caller
  -- (an impression of its searches or an opening, modele -5, EC-L3F-04-1); otherwise one answer
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
  -- the bound counts every row, the hidden ones included (modele §5, D85)
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
  'l3f/modele.md §5 (0324; 0327, D85; 10 RG4, RG51, CA49, CA52; D45): adds the creator of alias p_alias '
  'to the caller''s shortlist p_shortlist_id (P0002 shortlist when unknown or of another brand), '
  'idempotent. The alias must be listed by search.creator_candidates() with the campaign of the list '
  '(admitted, otherwise none) AND already served to the caller (an impression or an opening, '
  'EC-L3F-04-1): otherwise P0002 creator, unknown, malformed, excluded or never served alike. The '
  'engine runs before the lock of the account (1 s at most, 55P03), again under it when the campaign '
  'of the list changed meanwhile. selection_limits.itemsPerList counts every row (54000 '
  'shortlist_full). Behind search.shortlist_gate(). {state: added}. Nothing to the creator, the outbox '
  'nor matching. SECURITY DEFINER owned by influx_creator_search_definer, empty search_path; EXECUTE '
  'for influx_advertiser only.';

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
  v_now       uuid;
  v_note      text := pg_catalog.btrim(p_note);
  v_creator   uuid;
  v_wait      text := pg_catalog.current_setting('lock_timeout');
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
  -- EC-L3F-04-2: NULL clears; otherwise 1 to 500 characters once trimmed
  if p_note is not null and pg_catalog.char_length(v_note) not between 1 and 500 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'note';
  end if;

  -- D85 (2): THE engine with the campaign of the list, before the lock of the account
  v_creator := search.shortlist_creator(v_caller, p_alias, v_campaign);

  -- D85 (1): 1 s at most for the lock (55P03); the list read again under it, the engine again when
  -- its campaign changed meanwhile
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);
  select s.campaign_id into v_now
    from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  if v_now is distinct from v_campaign then
    v_creator := search.shortlist_creator(v_caller, p_alias, v_now);
  end if;

  -- a creator hidden or absent from the list: one answer
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
  'l3f/modele.md §5 (0324, EC-L3F-04-2; 0327, D85): the caller''s note on the creator of alias '
  'p_alias in its shortlist p_shortlist_id (P0002 shortlist when unknown or of another brand): 1 to '
  '500 characters once trimmed (22023 note), NULL clears; a creator hidden (the engine with the '
  'campaign of the list, before the lock of the account, again under it when that campaign changed) '
  'or absent from the list P0002 creator. Lock of the account 1 s at most (55P03). Behind '
  'search.shortlist_gate(). {state: noted}. SECURITY DEFINER owned by influx_creator_search_definer, '
  'empty search_path; EXECUTE for influx_advertiser only.';

create or replace function search.remove_from_shortlist(p_shortlist_id uuid, p_alias text)
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
  v_now       uuid;
  v_creator   uuid;
  v_wait      text := pg_catalog.current_setting('lock_timeout');
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

  -- L3FS-2: the creator THE engine lists with the campaign of the list, as set_shortlist_note(), never
  -- the storefront of the alias; D85 (2): before the lock of the account
  v_creator := search.shortlist_creator(v_caller, p_alias, v_campaign);

  -- D85 (1): 1 s at most for the lock (55P03); the list read again under it, the engine again when
  -- its campaign changed meanwhile
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.shortlists:' || v_caller::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);
  select s.campaign_id into v_now
    from search.shortlists s
   where s.id = p_shortlist_id and s.advertiser_account_id = v_caller;
  if not found then
    raise exception 'shortlist_not_found' using errcode = 'no_data_found', detail = 'shortlist';
  end if;
  if v_now is distinct from v_campaign then
    v_creator := search.shortlist_creator(v_caller, p_alias, v_now);
  end if;

  -- present, absent, unknown or hidden (left in place, EC-L3G-1 of D85): the same answer
  delete from search.shortlist_items i
   where i.shortlist_id = p_shortlist_id
     and i.creator_account_id = v_creator;
  return pg_catalog.jsonb_build_object('state', 'removed');
end
$$;

comment on function search.remove_from_shortlist(uuid, text) is
  'l3f/modele.md §5 (0324; 0327, L3FS-2, D85): removes from the caller''s shortlist p_shortlist_id '
  '(P0002 shortlist when unknown or of another brand) the creator of alias p_alias that '
  'search.creator_candidates() lists with the campaign of the list (search.shortlist_creator, before '
  'the lock of the account, again under it when that campaign changed); a creator hidden from the '
  'caller stays in the list (EC-L3G-1). Idempotent, {state: removed} in every case. Lock of the '
  'account 1 s at most (55P03). Behind search.shortlist_gate(). SECURITY DEFINER owned by '
  'influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

-- 2.6 The request to the team (0325 §7): 1 s at most for the lock of its bucket (D85 (1))
create or replace function search.request_team_selection(
  p_filters      jsonb,
  p_campaign_id  uuid,
  p_message      text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller    uuid;
  v_per_day   integer;
  v_count     integer;
  v_exit      timestamptz;
  v_message   text := pg_catalog.btrim(p_message);
  v_language  char(2);
  v_minutes   integer;
  v_due       timestamptz;
  v_id        uuid;
  v_wait      text := pg_catalog.current_setting('lock_timeout');
begin
  -- the caller (42501), then RG1; the switch and the threshold ignored (RG61: the button is permanent)
  v_caller := search.require_creator_searcher();
  if not exists (select 1 from profiles.advertiser_profiles a
                  where a.account_id = v_caller and a.status = 'published') then
    return pg_catalog.jsonb_build_object('state', 'brand_not_published');
  end if;

  -- the bucket (EC-L3F-05-3): one request at a time per account, nothing written when refused;
  -- D85 (1): 1 s at most for the lock (55P03), the caller's lock_timeout given back once held
  v_per_day := search.selection_limit('requestsPerDay');
  perform pg_catalog.set_config('lock_timeout', '1s', true);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.selection_requests:' || v_caller::text, 0));
  perform pg_catalog.set_config('lock_timeout', v_wait, true);
  select (pg_catalog.count(*))::integer into v_count
    from search.selection_requests r
   where r.advertiser_account_id = v_caller
     and r.created_at > pg_catalog.now() - interval '24 hours';
  if v_count >= v_per_day then
    select r.created_at + interval '24 hours' into v_exit
      from search.selection_requests r
     where r.advertiser_account_id = v_caller
       and r.created_at > pg_catalog.now() - interval '24 hours'
     order by r.created_at
     offset v_count - v_per_day
     limit 1;
    return pg_catalog.jsonb_build_object(
      'state', 'rate_limited',
      'retryAfterSeconds',
      greatest((pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer, 1));
  end if;

  -- CA39: every criterion entered, the closed entry of the search (22023 filters)
  perform search.check_creator_search_filters(p_filters);
  -- modele §1: an admitted campaign of the caller, or none
  if p_campaign_id is not null and not search.is_admitted_campaign(v_caller, p_campaign_id) then
    raise exception 'campaign_not_found' using errcode = 'no_data_found', detail = 'campaign';
  end if;
  -- EC-L3F-05-1: NULL is no message; otherwise 1 to 1 000 characters once trimmed
  if p_message is not null and pg_catalog.char_length(v_message) not between 1 and 1000 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'message';
  end if;

  -- CA39: the brand's language at the deposit; the deadline of queue 9, frozen once (04 §5.6)
  select a.preferred_language into v_language from identity.accounts a where a.id = v_caller;
  select p.target_decision_minutes into v_minutes
    from backoffice.sla_policies p
   where p.queue_code = 'team_selection' and p.is_active;
  if v_minutes is null then
    raise exception 'team_selection_policy'
      using errcode = 'object_not_in_prerequisite_state', detail = 'team_selection_policy';
  end if;
  v_due := backoffice.business_deadline('team_selection', pg_catalog.now(), v_minutes);

  insert into search.selection_requests
    (advertiser_account_id, campaign_id, filters, language, message, sla_due_at)
  values (v_caller, p_campaign_id, p_filters, v_language, v_message, v_due)
  returning id into v_id;

  -- last: the chain lock is the last lock of the transaction (04 §7.2); the identifiers only
  -- (EC-L3F-05-6)
  perform audit.append('search.selection_requested', 'selection_request', v_id,
                       pg_catalog.jsonb_build_object('campaign_id', p_campaign_id));
  return pg_catalog.jsonb_build_object(
    'state', 'requested',
    'answerBy', pg_catalog.to_char(pg_catalog.timezone('UTC', v_due),
                                   'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end
$$;

reset role;
revoke create on schema search from influx_creator_search_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_search_definer', current_user);
end
$$;

-- 3. End-state assertions -------------------------------------------------------------------------

do $$
declare
  c_dynamic  constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  -- (function, owner, definer, its callers beyond its owner)
  c_doors    constant text[][] := array[
    ['search.campaign_read_retry_after(uuid)', 'influx_campaign_feed_definer', 'f', ''],
    ['search.creator_search_retry_after(uuid)', 'influx_creator_search_definer', 'f', ''],
    ['search.creator_open_retry_after(uuid)', 'influx_creator_search_definer', 'f', ''],
    ['search.open_creator_profile(text)', 'influx_creator_search_definer', 't', 'influx_advertiser'],
    ['search.read_creator_visual(text, uuid)', 'influx_creator_search_definer', 't',
     'influx_advertiser'],
    ['search.create_shortlist(text, uuid)', 'influx_creator_search_definer', 't',
     'influx_advertiser'],
    ['search.update_shortlist(uuid, text, uuid)', 'influx_creator_search_definer', 't',
     'influx_advertiser'],
    ['search.delete_shortlist(uuid)', 'influx_creator_search_definer', 't', 'influx_advertiser'],
    ['search.add_to_shortlist(uuid, text)', 'influx_creator_search_definer', 't',
     'influx_advertiser'],
    ['search.set_shortlist_note(uuid, text, text)', 'influx_creator_search_definer', 't',
     'influx_advertiser'],
    ['search.remove_from_shortlist(uuid, text)', 'influx_creator_search_definer', 't',
     'influx_advertiser'],
    ['search.request_team_selection(jsonb, uuid, text)', 'influx_creator_search_definer', 't',
     'influx_advertiser']];
  v_row      text[];
  v_proc     pg_catalog.pg_proc%rowtype;
  v_callers  text;
  v_bad      text;
begin
  -- owner, mode, empty search_path and EXECUTE unchanged (fiche invariant 2)
  foreach v_row slice 1 in array c_doors loop
    select * into v_proc from pg_catalog.pg_proc p where p.oid = v_row[1]::regprocedure;
    select coalesce(string_agg(a.grantee::regrole::text, ',' order by a.grantee::regrole::text), '')
      into v_callers
      from pg_catalog.aclexplode(coalesce(v_proc.proacl,
                                          pg_catalog.acldefault('f', v_proc.proowner))) a
     where a.privilege_type = 'EXECUTE' and a.grantee <> v_proc.proowner;
    if pg_catalog.pg_get_userbyid(v_proc.proowner) <> v_row[2]
       or v_proc.prosecdef <> (v_row[3] = 't')
       or v_proc.proconfig is distinct from array['search_path=""']
       or v_callers <> v_row[4] then
      raise exception '% must stay owned by %, SECURITY %, empty search_path, callers {%}: {%}',
        v_row[1], v_row[2], case when v_row[3] = 't' then 'DEFINER' else 'INVOKER' end, v_row[4],
        v_callers;
    end if;
  end loop;

  -- D85 (1): every function of search that takes a lock per account bounds its wait to 1 s first
  -- (the global lock of the settings, 0316, is line 08's)
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'search'::regnamespace
     and pg_catalog.regexp_replace(
           p.prosrc,
           'set_config\(''lock_timeout'', ''1s'', true\);\s*perform pg_catalog\.pg_advisory_xact_lock'
           '|pg_advisory_xact_lock\(pg_catalog\.hashtextextended\(''search\.settings''',
           '', 'g') ~ 'pg_advisory_xact_lock';
  if v_bad is not null then
    raise exception 'D85: a lock per account waited without its 1 s bound: %', v_bad;
  end if;

  -- D85 (2): THE engine before the lock of the account in the profile and three writes of a list
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('search.add_to_shortlist(uuid, text)'::regprocedure,
                   'search.set_shortlist_note(uuid, text, text)'::regprocedure,
                   'search.remove_from_shortlist(uuid, text)'::regprocedure)
     and p.prosrc !~ 'search\.shortlist_creator\(.*pg_advisory_xact_lock';
  if v_bad is not null then
    raise exception 'D85: the engine runs under the lock of the account in %', v_bad;
  end if;
  if (select p.prosrc !~ 'search\.creator_candidates\(.*search\.creator_open_retry_after\('
        from pg_catalog.pg_proc p where p.oid = 'search.open_creator_profile(text)'::regprocedure)
  then
    raise exception 'D85: the profile runs its engine after the lock of its bucket';
  end if;

  -- L3FS-1, L3FS-2: no short-circuit before the engine, no removal by the storefront of an alias
  if (select p.prosrc ~ 'v_creator is null\s+or not exists'
           from pg_catalog.pg_proc p
          where p.oid = 'search.read_creator_visual(text, uuid)'::regprocedure)
     or (select p.prosrc ~ 'using profiles\.creator_public_profiles'
           from pg_catalog.pg_proc p
          where p.oid = 'search.remove_from_shortlist(uuid, text)'::regprocedure) then
    raise exception 'L3FS-1, L3FS-2: a door short-circuits the engine or removes by the storefront';
  end if;

  -- 03 P7: still no dynamic SQL in a function of the two owners
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner in ('influx_creator_search_definer'::regrole,
                        'influx_campaign_feed_definer'::regrole)
     and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'a function of the search owners runs dynamic SQL: %', v_bad;
  end if;

  -- the owners left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid in ('influx_creator_search_definer'::regrole,
                                 'influx_campaign_feed_definer'::regrole)
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege('influx_creator_search_definer', 'search', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_campaign_feed_definer', 'search', 'CREATE') then
    raise exception 'a search owner left with a member or CREATE';
  end if;
end
$$;
