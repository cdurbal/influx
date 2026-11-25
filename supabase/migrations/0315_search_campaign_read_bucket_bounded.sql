-- =============================================================================
-- 0315_search_campaign_read_bucket_bounded
-- -----------------------------------------------------------------------------
-- Lot 3 / L3E, commit 01 (jalons/l3e/01.md; fiche invariants 10, 15, 16; debt L3DS-1, 21 §8;
-- archives/jalons/l3d/annexe.md § Revue, constats S). The creator's read bucket of 0314 stays
-- bounded under refusals: before it, every rate_limited answer wrote its line, and the bucket walked
-- them all under the lock of the account (an account behind 10 addresses wrote ~1.7 M lines in 24 h,
-- each call scanning them, the pool of 10 connections exhausted). Signalled I-4 (03): two SECURITY
-- DEFINER doors recreated (their EXECUTE kept), one helper dropped and recreated by its owner.
--
-- 1. search.creator_campaign_reads_bucket_idx (creator_account_id, read_at desc) WHERE outcome <>
--    'rate_limited': the bucket counts on it only. creator_campaign_reads_account_idx of 0314 stays,
--    for the export and the erasure (every line of an account).
-- 2. search.campaign_read_retry_after(creator) dropped and recreated by influx_campaign_feed_definer
--    with the same input (uuid: the rights of 18 T2 name it unchanged) and two OUT columns:
--    retry_after_seconds (NULL within both limits, otherwise as in 0314, EC-L3D-02-3) and
--    journal_refusal (true when no rate_limited line of the account lies in the window that refuses:
--    24 h when the day is full, 60 s otherwise). The count, the Retry-After and the lock unchanged.
-- 3. search.read_open_campaigns(text, integer) and search.read_open_campaign(uuid) recreated at the
--    same signature by their owner (EXECUTE for influx_creator kept by CREATE OR REPLACE): a refusal
--    writes its rate_limited line only when journal_refusal; the answer is the same either way
--    ({outcome: rate_limited, retryAfterSeconds}). Every other outcome and line unchanged.
-- 4. The end-state assertions of 0314 on the seven functions replayed, plus the two indexes.
--
-- THE LOCK (01.md: unchanged or pg_try_advisory_xact_lock then 429, the choice argued here): KEPT
-- (pg_advisory_xact_lock, blocking). The scan under it is now bounded by the partial index (the
-- counted lines of 24 h, at most creator_campaign_reads_per_day) and the check of a rate_limited line
-- by the window (at most one per 60 s, 1 441 in 24 h), so a waiter waits for a short step; a try-lock
-- would answer 429 to two legitimate parallel reads of one account (the feed and a record opened
-- together), a refusal whose Retry-After would mean nothing.
--
-- RIGHTS (03 I-4, signalled): no GRANT nor policy added or removed. The helper recreated keeps its
-- owner, its mode, its empty search_path and no EXECUTE but its owner's; the two doors keep their
-- ACL (EXECUTE influx_creator); influx_campaign_feed_definer reads the same three columns of the
-- journal (creator_account_id, outcome, read_at) and still only inserts.
--
-- Not here: the routes, platform/member-rate.ts, the codes of the answers (01.md), the purge of the
-- journal (L3DS-2, Lot 6), the logo outside the bucket (L3DS-4).
--
-- EC-L3E-01 (micro-gaps, the safest choice):
--   EC-L3E-01-1  "one rate_limited line per account and window" is the account's, kinds together:
--                a refusal of the record within the window of a refusal of the feed writes nothing.
--                Two expectations of 0314's tests follow (L3D-T2 CA18, L3D-T5 T15.5: every refusal
--                journaled before); their answers and Retry-After unchanged, T15.5 (18: the overrun
--                journaled with the account) holds by the first line of each window.
--   EC-L3E-01-2  the journal has no column naming the window of a refusal: when the day is full, a
--                rate_limited line of a minute's refusal within the 24 h stands for it.
--   EC-L3E-01-3  the helper keeps its name (18 T2 names functions by their input): OUT columns over
--                a second helper, which would add a function to the rights of T2.
--
-- ROLLBACK: drop index search.creator_campaign_reads_bucket_idx; recreate the helper (drop, then as
-- in 0314 §6.2 with its owner and its revoke) and the two doors as in 0314 §7.1, §7.2 (as
-- influx_campaign_feed_definer). No data to restore: fewer rate_limited lines were written.
-- =============================================================================

-- 1. The index of the bucket (L3DS-1) -------------------------------------------------------------------

create index if not exists creator_campaign_reads_bucket_idx
  on search.creator_campaign_reads (creator_account_id, read_at desc)
  where outcome <> 'rate_limited';

comment on index search.creator_campaign_reads_bucket_idx is
  'The bucket of search.campaign_read_retry_after() (0315, L3DS-1): the counted lines of an account '
  '(every outcome but rate_limited) on 60 s and 24 h. creator_campaign_reads_account_idx (0314) '
  'serves the export and the erasure.';

comment on column search.creator_campaign_reads.outcome is
  'served (something was served), refused (a record not open to the caller: one answer, T14), '
  'page_cap (a page beyond campaign_feed_max_pages, CA18), rate_limited (the bucket of the account '
  'full, T15.5: nothing served, never counted in the bucket; at most one line per account in the '
  'window that refuses, 60 s or 24 h, 0315).';

-- 2. The helper and the two counted doors, recreated by their owner ------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_feed_definer', current_user);
end
$$;
grant create on schema search to influx_campaign_feed_definer;
set role influx_campaign_feed_definer;

-- 2.1 The bucket of an account (l3d/modele.md §5; 11 RG21, CA18; 18 T15.3 to T15.5; L3DS-1)
drop function search.campaign_read_retry_after(uuid);

create function search.campaign_read_retry_after(
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

  -- one read at a time per account: the count, the check and the line the door adds are one step
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.creator_campaign_reads:' || p_creator_account_id::text, 0));

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
  'l3d/modele.md §5 (0314, EC-L3D-02-2, -3; 0315, L3DS-1, EC-L3E-01): under a transaction lock per '
  'account, counts the reads of the feed and of the records of p_creator_account_id but rate_limited '
  'ones on 60 s and 24 h sliding (creator_campaign_reads_bucket_idx), against '
  'creator_campaign_reads_per_minute and creator_campaign_reads_per_day (55000 '
  'campaign_feed_settings when one is missing). Within both limits: (NULL, false). Otherwise '
  'retry_after_seconds, the whole seconds, at least 1, before the count of every full window falls '
  'below its limit, and journal_refusal, true when no rate_limited line of the account lies in the '
  'window that refuses (24 h when the day is full, 60 s otherwise). Writes nothing: the door writes '
  'the line. SECURITY INVOKER owned by influx_campaign_feed_definer, executed by its owner only.';

revoke all on function search.campaign_read_retry_after(uuid)
  from public, anon, authenticated, service_role;

-- 2.2 The feed (11 RG21, RG33, RG35, RG36, CA15 to CA18): 0314 §7.1, the refusal journaled once
create or replace function search.read_open_campaigns(p_sort text, p_page integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid;
  v_page_size  integer;
  v_max_pages  integer;
  v_retry      integer;
  v_journal    boolean;
  v_total      integer;
  v_items      jsonb;
begin
  v_caller := search.require_campaign_reader();
  -- EC-L3D-02-4: the domain of the contract, refused before anything is written
  if p_sort is null or p_sort not in ('recent', 'deadline') then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'sort';
  end if;
  if p_page is null or p_page not between 1 and 50 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'page';
  end if;
  select (s.value)::integer into v_page_size
    from backoffice.operational_settings s
   where s.key = 'campaign_feed_page_size';
  select (s.value)::integer into v_max_pages
    from backoffice.operational_settings s
   where s.key = 'campaign_feed_max_pages';
  if v_page_size is null or v_max_pages is null then
    raise exception 'campaign_feed_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_feed_settings';
  end if;

  -- CA18, T15.5: the bucket full, nothing served, the refusal journaled with the account once in the
  -- window that refuses (L3DS-1)
  select b.retry_after_seconds, b.journal_refusal into v_retry, v_journal
    from search.campaign_read_retry_after(v_caller) b;
  if v_retry is not null then
    if v_journal then
      insert into search.creator_campaign_reads
        (creator_account_id, kind, feed_sort, feed_page, outcome)
      values (v_caller, 'feed', p_sort, p_page, 'rate_limited');
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'rate_limited', 'retryAfterSeconds', v_retry);
  end if;

  -- RG21, CA18: the cap of pages, held by the base, journaled
  if p_page > v_max_pages then
    insert into search.creator_campaign_reads
      (creator_account_id, kind, feed_sort, feed_page, outcome)
    values (v_caller, 'feed', p_sort, p_page, 'page_cap');
    return pg_catalog.jsonb_build_object('outcome', 'page_cap', 'maxPages', v_max_pages);
  end if;

  -- RG35: the count before the list, greyed campaigns included
  select (count(*))::integer into v_total from search.visible_campaigns(v_caller);

  -- RG33, CA15 to CA17: two sorts, the identifier last (stable from page to page); the rank, not a
  -- cursor (modele §4); the snapshot whole and the brand row whole, picked by apps/api (§3)
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id',                 f.campaign_id,
           'publishedOn',        pg_catalog.timezone('UTC', f.first_published_at)::date,
           'applicationsClosed', f.applications_closed,
           'campaign',           s.payload,
           'brand',              search.brand_public_row(f.advertiser_account_id))
         order by f.rank), '[]'::jsonb)
    into v_items
    from (select v.campaign_id, v.advertiser_account_id, v.snapshot_id, v.first_published_at,
                 v.applications_closed,
                 pg_catalog.row_number() over (
                   order by case when p_sort = 'deadline' then v.applications_closed end,
                            case when p_sort = 'deadline' then v.applications_close_on end
                              nulls last,
                            case when p_sort = 'recent' then v.first_published_at end desc,
                            v.campaign_id) as rank
            from search.visible_campaigns(v_caller) v) f
    join campaigns.campaign_published_snapshots s on s.id = f.snapshot_id
   where f.rank > (p_page - 1) * v_page_size
     and f.rank <= p_page * v_page_size;

  insert into search.creator_campaign_reads
    (creator_account_id, kind, feed_sort, feed_page, outcome)
  values (v_caller, 'feed', p_sort, p_page, 'served');

  return pg_catalog.jsonb_build_object(
    'outcome',    'served',
    'total',      v_total,
    'page',       p_page,
    'nextPage',   case when v_total > p_page * v_page_size and p_page < v_max_pages
                       then p_page + 1 end,
    'capReached', p_page = v_max_pages and v_total > p_page * v_page_size,
    'items',      v_items);
end
$$;

comment on function search.read_open_campaigns(text, integer) is
  '11 RG21, RG33, RG35, RG36, CA15 to CA18 (0314, l3d/modele.md §3, §4; 0315): a page of the feed of '
  'the open campaigns of the calling creator (search.require_campaign_reader: 42501 otherwise, '
  'nothing journaled). p_sort recent (first_published_at desc, id) or deadline (open first, '
  'applications_close_on asc nulls last, id), p_page 1 to 50 (22023 otherwise, DETAIL sort or page, '
  'nothing journaled). Under the bucket of the account (search.campaign_read_retry_after): '
  '{outcome: rate_limited, retryAfterSeconds}, its line written once per account in the window that '
  'refuses (L3DS-1); beyond campaign_feed_max_pages: {outcome: page_cap, maxPages}; otherwise '
  '{outcome: served, total (greyed included), page, nextPage (null at the end or at the cap), '
  'capReached, items: [{id, publishedOn (UTC day of first_published_at), applicationsClosed, '
  'campaign (the current snapshot whole), brand (search.brand_public_row)}]}, '
  'campaign_feed_page_size cards. Every other outcome writes its line of '
  'search.creator_campaign_reads (kind feed, sort, page). SECURITY DEFINER owned by '
  'influx_campaign_feed_definer, empty search_path; EXECUTE for influx_creator only.';

-- 2.3 The record (11 RG16, RG22, RG24; 09 RG100; T14): 0314 §7.2, the refusal journaled once
create or replace function search.read_open_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid;
  v_retry    integer;
  v_journal  boolean;
  v_record   jsonb;
begin
  v_caller := search.require_campaign_reader();
  if p_campaign_id is null then
    raise exception 'invalid_parameter'
      using errcode = 'invalid_parameter_value', detail = 'campaign';
  end if;

  select b.retry_after_seconds, b.journal_refusal into v_retry, v_journal
    from search.campaign_read_retry_after(v_caller) b;
  if v_retry is not null then
    if v_journal then
      insert into search.creator_campaign_reads (creator_account_id, kind, campaign_id, outcome)
      values (v_caller, 'record', p_campaign_id, 'rate_limited');
    end if;
    return pg_catalog.jsonb_build_object('outcome', 'rate_limited', 'retryAfterSeconds', v_retry);
  end if;

  -- an OPEN campaign only (modele §2): a greyed one has no record (RG26, CA9)
  select pg_catalog.jsonb_build_object(
           'outcome',     'served',
           'id',          v.campaign_id,
           'publishedOn', pg_catalog.timezone('UTC', v.first_published_at)::date,
           'campaign',    s.payload,
           'brand',       b.brand)
    into v_record
    from search.visible_campaigns(v_caller) v
    join campaigns.campaign_published_snapshots s on s.id = v.snapshot_id
    cross join lateral (select search.brand_public_row(v.advertiser_account_id) as brand) b
   where v.campaign_id = p_campaign_id
     and not v.applications_closed
     and b.brand is not null;

  -- RG24, RG100, T14: unknown, greyed, paused, closed, draft, to review, refused, of a brand
  -- suspended or unpublished, of a refused sector: one answer, journaled with the id asked
  if v_record is null then
    insert into search.creator_campaign_reads (creator_account_id, kind, campaign_id, outcome)
    values (v_caller, 'record', p_campaign_id, 'refused');
    return pg_catalog.jsonb_build_object('outcome', 'refused');
  end if;

  -- RG22: the account, the campaign, the instant; never served nor notified to the brand (RG101)
  insert into search.creator_campaign_reads (creator_account_id, kind, campaign_id, outcome)
  values (v_caller, 'record', p_campaign_id, 'served');
  return v_record;
end
$$;

comment on function search.read_open_campaign(uuid) is
  '11 RG16, RG22, RG24, 09 RG100, RG101, 18 T14 (0314, l3d/modele.md §2, §3; 0315): the record of '
  'the OPEN campaign p_campaign_id for the calling creator (42501 otherwise, nothing journaled; '
  '22023 for a NULL id). Under the bucket: {outcome: rate_limited, retryAfterSeconds}, its line '
  'written once per account in the window that refuses (L3DS-1); an open campaign of '
  'search.visible_campaigns: {outcome: served, id, publishedOn, campaign (the current snapshot '
  'whole), brand (search.brand_public_row, never null)}; any other campaign, known or not: {outcome: '
  'refused}, one body. Every other outcome writes its line of search.creator_campaign_reads (kind '
  'record, the id asked). SECURITY DEFINER owned by influx_campaign_feed_definer, empty '
  'search_path; EXECUTE for influx_creator only.';

reset role;
revoke create on schema search from influx_campaign_feed_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_feed_definer', current_user);
end
$$;

-- 3. End-state assertions (0314 §10 on the functions, replayed) ---------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner   constant text := 'influx_campaign_feed_definer';
  v_def     record;
  v_bad     text;
begin
  -- the seven functions: their owner, their mode, empty search_path, EXECUTE for their callers only
  -- (the helpers: nobody)
  for v_def in
    select * from (values
      ('search.require_campaign_reader()', false, ''),
      ('search.campaign_read_retry_after(uuid)', false, ''),
      ('search.visible_campaigns(uuid)', false, ''),
      ('search.brand_public_row(uuid)', false, ''),
      ('search.read_open_campaigns(text, integer)', true, 'influx_creator'),
      ('search.read_open_campaign(uuid)', true, 'influx_creator'),
      ('search.read_open_campaign_brand_logo(uuid)', true, 'influx_creator')
    ) as d (fn, definer, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> c_owner
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by %, SECURITY %, empty search_path',
        v_def.fn, c_owner, case when v_def.definer then 'DEFINER' else 'INVOKER' end;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text is distinct from nullif(v_def.callers, ''));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- the creator still executes its three doors
  if not pg_catalog.has_function_privilege('influx_creator',
           'search.read_open_campaigns(text, integer)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('influx_creator',
           'search.read_open_campaign(uuid)', 'EXECUTE')
     or not pg_catalog.has_function_privilege('influx_creator',
           'search.read_open_campaign_brand_logo(uuid)', 'EXECUTE') then
    raise exception 'influx_creator lost EXECUTE on a door of the open campaigns';
  end if;

  -- L2DS-5 extended: no dynamic SQL in a function of the owner of the doors
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole
     and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic SQL in a function of influx_campaign_feed_definer: %', v_bad;
  end if;

  -- the two indexes: the bucket's, partial, and the export's, whole (L3DS-1)
  if not exists (select 1 from pg_catalog.pg_indexes
                  where schemaname = 'search' and indexname = 'creator_campaign_reads_bucket_idx'
                    and indexdef like '%WHERE (outcome <> ''rate_limited''::text)%')
     or not exists (select 1 from pg_catalog.pg_indexes
                     where schemaname = 'search'
                       and indexname = 'creator_campaign_reads_account_idx') then
    raise exception 'the indexes of search.creator_campaign_reads are not those of 0315';
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE') then
    raise exception 'influx_campaign_feed_definer left with a member or CREATE by 0315';
  end if;
end
$$;
