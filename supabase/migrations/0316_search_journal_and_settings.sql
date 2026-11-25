-- =============================================================================
-- 0316_search_journal_and_settings
-- -----------------------------------------------------------------------------
-- Lot 3 / L3E, commit 03 (jalons/l3e/03.md; l3e-fiche.md invariants 8, 9, 11, 15, 16;
-- jalons/l3e/modele.md §7, §9, §11, which PREVAILS for every name; 04 §5.5; 10 RG2, RG11 to RG14,
-- RG41, RG57, RG59, RG63, RG66, RG88; EC-L3E-1: the search journal and its settings in ONE
-- migration). The tables of the anonymous creator search, without any door: the doors come with
-- 0319 (search) and 0320 (order, reasons); the blocks with 0317; the export and the erasure with
-- 0318. Signalled I-4 (03): a new definer role, a SECURITY DEFINER pair, GRANTs, policies, a write
-- of audit.* (search.settings_changed, loaded by 0303).
--
-- 1. influx_search_admin_definer: NOLOGIN NOINHERIT, no member (modele §9, D81 (5)), added to the
--    closed list of 03 P7. Owner of the two writers of an administrator and of their caller check.
-- 2. search.explanation_reasons (04 §5.5 + modele §7): the closed list of the « Proposé car »
--    reasons and of the vigilance notes, `kind` reason or vigilance, the tier a reason comes from,
--    the keys of its parameters (param_keys, EC-L3E-03-2); 13 reasons and 4 notes, no label (R8).
-- 3. The settings as data (04 §5.5, 10 RG2, RG11): search.facet_settings (the 24 codes of RG12 to
--    RG14, the base open but F12, CHECK open => base, F12 closed while D78 holds),
--    search.search_settings (eight keys, closed by CHECK, a shape per key, NO alert_thresholds:
--    modele §10), search.facet_config_versions (version 1 loaded here; append-only),
--    search.facet_config_snapshot() (the facets, k and the cold quota) and
--    search.result_count_band() (5_9, 10_24, 25_49, 50_plus; RG59, modele §4).
-- 4. The journal (04 §5.5, modele §9; 10 RG66, CA47, CA48): search.search_queries (outcome, sort,
--    version of the facets, exact count never served, page, k block, request), indexed by account
--    and instant, whole and outside rate_limited; search.search_impressions (rank, cold quota,
--    vigilance, opened once); search.impression_reasons (2 to 4 per card, reason_params: strings
--    only, never a number, <= 500 bytes, its keys those of the reason); search.creator_exposures
--    (first page 1 of a creator). Append-only outside the erasure (guard_search_journal_write) and
--    the opening of an impression (L3F).
-- 5. The brand's shortlists (search.shortlists, shortlist_items): RLS forced, NO member right (the
--    brand never holds a creator_account_id; its doors by alias come with L3F).
-- 6. search.supply_counters (04 §5.5, D38): the table only; the daily task comes with L3G.
-- 7. Rights: RLS enabled and forced on the ten tables, nothing to anon, authenticated,
--    service_role nor any execution role; a RESTRICTIVE policy refuses every row to
--    influx_advertiser and influx_creator on each (fiche invariant 1; the second line of « no
--    member right »). The owner reads its caller (account, roles, agent profile: its own rows), reads
--    and updates the settings and the facets, inserts a version, executes audit.append().
-- 8. search.write_search_setting(key, value) and search.write_facet_setting(code, is_open,
--    display_order, note): SECURITY DEFINER, empty search_path, EXECUTE for influx_admin ONLY
--    (aal2, active account and agent profile checked inside, 42501 otherwise); one transaction lock
--    for both; a value unchanged writes nothing; a change writes search.settings_changed (before,
--    after) LAST, a version on every facet change and on a change of k or of the cold quota. The
--    control by a peer (D84) comes with the route of L3G (modele -7).
--
-- RIGHTS (03 I-4, signalled): a new role; USAGE on search to it and to influx_admin; column GRANTs
-- with their policies to the owner on identity.accounts, account_roles, agent_profiles,
-- search.search_settings, facet_settings, facet_config_versions; EXECUTE on audit.append() and on
-- search.facet_config_snapshot() to the owner; two writers executable by influx_admin.
--
-- Not here: the doors of the search (0319, 0320), party_blocks (0317), privacy.* (0318), the
-- settings screen and its route (L3G), the daily counters (L3G), AL21 (0321), the purge (Lot 6).
--
-- EC-L3E-03 (micro-gaps, the safest choice):
--   EC-L3E-03-1  upper bounds of the settings (modele §9 gives the values only): page_size and
--                max_pages 1 to 50 (the page of the contract, modele §10), k and the region
--                threshold 5 to 50 (modele §4), rate_limits perHour 1 to 1 000 <= perDay 1 to
--                20 000, profileOpensPerDay 1 to 1 000, cold quota slots 0 to 50 and recentDays 1
--                to 365, critical mass 1 to 100 000.
--   EC-L3E-03-2  explanation_reasons.param_keys (modele §7 « clés ci-dessus »): a trigger holds the
--                keys of reason_params to those of the reason, and a vigilance code to its kind;
--                tier NULL for a note and for the two fallbacks (primary_topic, main_audience).
--   EC-L3E-03-3  a reason_params value matches ^[A-Za-z0-9_]{1,64}$ and is never all digits: a
--                band (50_80) passes, 72 never does, in a string or not.
--   EC-L3E-03-4  F12 stays closed by a CHECK while D78 holds (fiche invariant 3), beside « open =>
--                base »; the subject of search.settings_changed is md5('search.search_settings:'
--                || key)::uuid or md5('search.facet_settings:' || code)::uuid (pattern 0145).
--   EC-L3E-03-5  a write that changes nothing writes nothing and journals nothing (pattern 0145);
--                both writers return the facet configuration version in force after the call.
--   EC-L3E-03-6  journal cascades: impression_reasons <- search_impressions <- search_queries,
--                shortlist_items <- shortlists (an erasure of 0318 deletes the parent).
--   EC-L3E-03-7  facet_config_snapshot() and result_count_band() are owned by the migration role,
--                SECURITY INVOKER; the first is executed by the owner of the writers only, the
--                second by nobody until 0319.
--
-- ROLLBACK (before any search is journaled): drop the two writers and require_search_admin();
-- drop tables search.shortlist_items, shortlists, supply_counters, impression_reasons,
-- search_impressions, creator_exposures, search_queries, facet_config_versions, search_settings,
-- facet_settings, explanation_reasons; drop the five functions of §3, §4; drop the policies
-- *_search_admin_definer_* on identity.* and revoke their grants; revoke usage on schema search
-- from influx_admin; revoke execute on audit.append() from the owner; drop role
-- influx_search_admin_definer.
-- =============================================================================

-- 1. The owner of the writers (03 P7 rule 5; rules 1 and 2 of 0001; modele §9) ---------------------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_search_admin_definer') then
    create role influx_search_admin_definer with nologin noinherit;
  end if;
  alter role influx_search_admin_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_search_admin_definer' and rolsuper) then
    raise exception 'role influx_search_admin_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_search_admin_definer' and rolbypassrls) then
    alter role influx_search_admin_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_search_admin_definer' and rolreplication) then
    alter role influx_search_admin_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_search_admin_definer' and rolcreatedb) then
    alter role influx_search_admin_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_search_admin_definer' and rolcreaterole) then
    alter role influx_search_admin_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. The reasons and the vigilance notes (modele §7; 10 RG41, RG42) --------------------------------

create table if not exists search.explanation_reasons (
  code        text     not null primary key,
  kind        text     not null,
  label_key   text     not null unique,
  tier        smallint,
  param_keys  text[]   not null,
  is_active   boolean  not null default true,

  constraint explanation_reasons_code check (code ~ '^[a-z][a-z_]{1,62}$'),
  constraint explanation_reasons_kind check (kind in ('reason', 'vigilance')),
  constraint explanation_reasons_tier check (tier between 1 and 8),
  constraint explanation_reasons_note_without_tier check (kind = 'reason' or tier is null),
  constraint explanation_reasons_label_key
    check (label_key = 'creatorSearch.' || kind || '.' || code),
  constraint explanation_reasons_param_keys check (
    pg_catalog.cardinality(param_keys) <= 3
    and (kind = 'vigilance' or pg_catalog.cardinality(param_keys) >= 1))
);

comment on table search.explanation_reasons is
  'The closed list of the « Proposé car » reasons (kind reason, 10 RG41) and of the vigilance notes '
  '(kind vigilance, RG42) a card may carry (l3e/modele.md §7, 0316). tier: the step of the order a '
  'reason comes from (NULL for a note and for the two fallbacks primary_topic, main_audience); '
  'param_keys: the exact keys of its reason_params (EC-L3E-03-2). No label in base (04 R8): the '
  'label_key names the ICU fragment of next-intl. Read by the doors of 0320.';

insert into search.explanation_reasons (code, kind, label_key, tier, param_keys) values
  ('topic_match',               'reason',    'creatorSearch.reason.topic_match',               1, array['topic']),
  ('network_match',             'reason',    'creatorSearch.reason.network_match',             1, array['network', 'audienceBand']),
  ('audience_country_match',    'reason',    'creatorSearch.reason.audience_country_match',    1, array['country', 'shareBand']),
  ('language_match',            'reason',    'creatorSearch.reason.language_match',            1, array['language']),
  ('format_match',              'reason',    'creatorSearch.reason.format_match',              1, array['format']),
  ('campaign_format',           'reason',    'creatorSearch.reason.campaign_format',           2, array['network', 'format']),
  ('campaign_audience_country', 'reason',    'creatorSearch.reason.campaign_audience_country', 2, array['country', 'shareBand']),
  ('audience_verified',         'reason',    'creatorSearch.reason.audience_verified',         3, array['network']),
  ('account_verified',          'reason',    'creatorSearch.reason.account_verified',          3, array['network']),
  ('figures_fresh',             'reason',    'creatorSearch.reason.figures_fresh',             4, array['network']),
  ('available',                 'reason',    'creatorSearch.reason.available',                 6, array['availability']),
  ('primary_topic',             'reason',    'creatorSearch.reason.primary_topic',             null, array['topic']),
  ('main_audience',             'reason',    'creatorSearch.reason.main_audience',             null, array['country', 'shareBand']),
  ('stale_figures',             'vigilance', 'creatorSearch.vigilance.stale_figures',          null, array[]::text[]),
  ('recent_profile',            'vigilance', 'creatorSearch.vigilance.recent_profile',         null, array[]::text[]),
  ('audience_badge_to_renew',   'vigilance', 'creatorSearch.vigilance.audience_badge_to_renew', null, array[]::text[]),
  ('declared_full',             'vigilance', 'creatorSearch.vigilance.declared_full',          null, array[]::text[])
on conflict (code) do nothing;

-- 3. The settings as data (04 §5.5; 10 RG2, RG11 to RG14, RG57, RG63, RG88) -------------------------

create table if not exists search.facet_settings (
  facet_code             text        not null primary key,
  wave                   smallint    not null,
  is_open                boolean     not null,
  display_order          smallint    not null,
  updated_by_account_id  uuid        references identity.accounts (id),
  updated_at             timestamptz not null default now(),

  constraint facet_settings_code check (facet_code in (
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14', 'F15',
    'F16', 'F17', 'F18', 'F19', 'F20', 'F22', 'F23', 'F24', 'F25')),
  -- RG12 the base, RG13 the second wave, RG14 the third (data born at Lot 4)
  constraint facet_settings_wave check (wave = case
    when facet_code in ('F1', 'F3', 'F4', 'F6', 'F8', 'F11', 'F12', 'F17') then 1
    when facet_code = 'F19' then 3
    else 2 end),
  -- modele §9: an open facet belongs to the base (the doors of 0319 filter the base only)
  constraint facet_settings_open_is_base check (not is_open or wave = 1),
  -- D78 (fiche invariant 3, EC-L3E-03-4): no price band is entered, F12 stays closed
  constraint facet_settings_price_closed_d78 check (not (facet_code = 'F12' and is_open)),
  constraint facet_settings_display_order check (display_order between 1 and 99)
);

comment on table search.facet_settings is
  'The opening of each facet of the creator search, as data (10 RG11; 04 §5.5): its wave (RG12 base, '
  'RG13 second, RG14 third), open or not, its display order. The base is open from the first day but '
  'F12 (D78: 7 facets at the pilot); an open facet belongs to the base (modele §9). Written by '
  'search.write_facet_setting() only (influx_admin, aal2), every change a version of '
  'search.facet_config_versions (RG88) and a line search.settings_changed. Read at every search.';

insert into search.facet_settings (facet_code, wave, is_open, display_order) values
  ('F1', 1, true, 1), ('F3', 1, true, 2), ('F4', 1, true, 3), ('F6', 1, true, 4),
  ('F8', 1, true, 5), ('F11', 1, true, 6), ('F12', 1, false, 7), ('F17', 1, true, 8),
  ('F2', 2, false, 9), ('F5', 2, false, 10), ('F7', 2, false, 11), ('F9', 2, false, 12),
  ('F10', 2, false, 13), ('F13', 2, false, 14), ('F14', 2, false, 15), ('F15', 2, false, 16),
  ('F16', 2, false, 17), ('F18', 2, false, 18), ('F20', 2, false, 19), ('F22', 2, false, 20),
  ('F23', 2, false, 21), ('F24', 2, false, 22), ('F25', 2, false, 23), ('F19', 3, false, 24)
on conflict (facet_code) do nothing;

create table if not exists search.search_settings (
  key                    text        not null primary key,
  value                  jsonb       not null,
  updated_by_account_id  uuid        references identity.accounts (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- modele §9: no alert_thresholds (AL21 keeps its thresholds in backoffice.alert_definitions, §10)
  constraint search_settings_key_closed_list check (key in (
    'is_open_to_advertisers', 'k_anonymity_threshold', 'page_size', 'max_pages', 'rate_limits',
    'cold_profile_quota', 'critical_mass_thresholds', 'region_display_threshold')),
  constraint search_settings_value_size check (pg_column_size(value) <= 2000),
  constraint search_settings_value_shape check (case key
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
    else false
  end)
);

comment on table search.search_settings is
  'The settings of the creator search, as data (04 §5.5; 10 RG2, RG57, RG63; l3e/modele.md §9): a '
  'closed list of eight keys, the shape of each value checked in base (EC-L3E-03-1) and by its zod '
  'schema (packages/contracts, search-settings.ts). is_open_to_advertisers FALSE: closed, no list '
  '(D38, CA59). Read at EVERY search, never at start. Written by search.write_search_setting() only '
  '(influx_admin, aal2), every change a line search.settings_changed (before, after), a change of '
  'k or of the cold quota a version of search.facet_config_versions.';

insert into search.search_settings (key, value) values
  ('is_open_to_advertisers',   'false'),
  ('k_anonymity_threshold',    '5'),
  ('page_size',                '12'),
  ('max_pages',                '5'),
  ('rate_limits',              '{"perHour": 30, "perDay": 200, "profileOpensPerDay": 60}'),
  ('cold_profile_quota',       '{"slots": 2, "recentDays": 30}'),
  ('critical_mass_thresholds', '{"publishedProfiles": 30, "perTopic": 5}'),
  ('region_display_threshold', '5')
on conflict (key) do nothing;

create table if not exists search.facet_config_versions (
  version                bigint      not null generated always as identity primary key,
  changed_at             timestamptz not null default now(),
  changed_by_account_id  uuid        references identity.accounts (id),
  snapshot               jsonb       not null,
  note                   text,

  constraint facet_config_versions_snapshot check (
    jsonb_typeof(snapshot) = 'object'
    and snapshot ?& array['facets', 'k_anonymity_threshold', 'cold_profile_quota']
    and jsonb_typeof(snapshot -> 'facets') = 'array'
    and pg_column_size(snapshot) <= 8000),
  constraint facet_config_versions_note check (note is null or char_length(note) between 1 and 500)
);

comment on table search.facet_config_versions is
  'One row per change of the configuration the search journal must name (04 §5.5; 10 RG88): the '
  'facets (code, wave, open, order), k and the cold quota at that instant (modele §9). Version 1 is '
  'the configuration loaded by 0316 (no author). Append-only: no role updates nor deletes a row.';

-- 3.1 The snapshot of a version (EC-L3E-03-7)
create or replace function search.facet_config_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'facets', (select pg_catalog.jsonb_agg(
                        pg_catalog.jsonb_build_object('code', f.facet_code, 'wave', f.wave,
                                                      'is_open', f.is_open,
                                                      'display_order', f.display_order)
                        order by f.display_order, f.facet_code)
                 from search.facet_settings f),
    'k_anonymity_threshold', (select s.value from search.search_settings s
                               where s.key = 'k_anonymity_threshold'),
    'cold_profile_quota', (select s.value from search.search_settings s
                            where s.key = 'cold_profile_quota'))
$$;

comment on function search.facet_config_snapshot() is
  'l3e/modele.md §9 (0316): the snapshot a version of search.facet_config_versions holds: the facets '
  '(code, wave, is_open, display_order, in display order), k_anonymity_threshold and '
  'cold_profile_quota as stored. SECURITY INVOKER owned by the migration role; EXECUTE for '
  'influx_search_admin_definer only.';

revoke all on function search.facet_config_snapshot() from public, anon, authenticated, service_role;

insert into search.facet_config_versions (snapshot)
select search.facet_config_snapshot()
 where not exists (select 1 from search.facet_config_versions);

-- 3.2 The band of a count served (10 RG59; modele §4)
create or replace function search.result_count_band(p_count integer)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
           when p_count is null or p_count < 5 then null
           when p_count < 10 then '5_9'
           when p_count < 25 then '10_24'
           when p_count < 50 then '25_49'
           else '50_plus'
         end
$$;

comment on function search.result_count_band(integer) is
  '10 RG59, l3e/modele.md §4 (0316): the band of a count of results above k, the only count a brand '
  'ever reads: 5_9, 10_24, 25_49, 50_plus; NULL below 5 or for NULL (never served: k is 5 at '
  'least). SECURITY INVOKER owned by the migration role; EXECUTE for nobody until 0319.';

revoke all on function search.result_count_band(integer) from public, anon, authenticated, service_role;

-- 4. The journal (04 §5.5; modele §9; 10 RG66, CA47, CA48) -----------------------------------------

create table if not exists search.search_queries (
  id                         uuid        not null default gen_random_uuid() primary key,
  account_id                 uuid        not null references identity.accounts (id),
  actor_role                 text        not null,
  view_mode                  text        not null,
  campaign_id                uuid        references campaigns.campaigns (id),
  outcome                    text        not null,
  filters                    jsonb       not null default '{}'::jsonb,
  sort_code                  text        not null,
  facet_config_version       bigint      not null references search.facet_config_versions (version),
  result_count               integer     not null,
  page_reached               smallint    not null,
  blocked_by_k_anonymity     boolean     not null default false,
  request_id                 text,
  created_at                 timestamptz not null default now(),

  constraint search_queries_actor_role check (actor_role in ('advertiser', 'agent', 'admin')),
  constraint search_queries_view_mode
    check (view_mode in ('advertiser_anonymous', 'agent_identified')),
  constraint search_queries_brand_view
    check (actor_role <> 'advertiser' or view_mode = 'advertiser_anonymous'),
  constraint search_queries_outcome check (outcome in ('served', 'page_cap', 'rate_limited')),
  constraint search_queries_sort_code
    check (sort_code in ('default', 'audience', 'verified_first', 'new_profiles')),
  constraint search_queries_filters
    check (jsonb_typeof(filters) = 'object' and pg_column_size(filters) <= 2000),
  constraint search_queries_result_count check (result_count >= 0),
  constraint search_queries_page_reached check (page_reached between 1 and 50),
  -- modele §9: outside served, a count of 0 and no k block; rate_limited keeps no filter
  constraint search_queries_outcome_coherent check (
    (outcome = 'served' or (result_count = 0 and not blocked_by_k_anonymity))
    and (outcome <> 'rate_limited' or filters = '{}'::jsonb)),
  constraint search_queries_request_id
    check (request_id is null or char_length(request_id) between 1 and 100)
);

-- the export and the erasure of an account; the bucket of 0319 (the lines but rate_limited, 0315)
create index if not exists search_queries_account_idx
  on search.search_queries (account_id, created_at desc);
create index if not exists search_queries_bucket_idx
  on search.search_queries (account_id, created_at desc)
  where outcome <> 'rate_limited';

comment on table search.search_queries is
  'Every search of creators, by whom, with which filters, sort and facet configuration, and what it '
  'returned (04 §5.5; 10 RG66, CA47; l3e/modele.md §9): written by the transaction that serves '
  '(0319). outcome served, page_cap (a page beyond max_pages, CA42) or rate_limited (filters {}); '
  'result_count EXACT, never served nor exported (the brand reads a band, RG59); '
  'blocked_by_k_anonymity: served below k, nothing listed (CA34). Append-only outside the erasure '
  '(0318). No member right. Kept 12 months (purge at Lot 6).';
comment on column search.search_queries.result_count is
  'The exact count after the exclusions (RG26, RG27): NEVER served, never exported (modele §9).';

create table if not exists search.search_impressions (
  search_query_id     uuid        not null references search.search_queries (id) on delete cascade,
  creator_account_id  uuid        not null references identity.accounts (id),
  rank                smallint    not null,
  cold_quota          boolean     not null default false,
  vigilance_code      text        references search.explanation_reasons (code),
  was_opened          boolean     not null default false,
  opened_at           timestamptz,

  constraint search_impressions_pkey primary key (search_query_id, creator_account_id),
  constraint search_impressions_rank_once unique (search_query_id, rank),
  constraint search_impressions_rank check (rank between 1 and 2500),
  constraint search_impressions_opened check (was_opened = (opened_at is not null))
);

create index if not exists search_impressions_creator_idx
  on search.search_impressions (creator_account_id);

comment on table search.search_impressions is
  'One row per creator served by a search, with its rank (04 §5.5; 10 RG66, CA48): placed by the '
  'cold quota or not, its vigilance note (one at most, RG42), opened once (L3F). Append-only but '
  'was_opened false -> true with opened_at; deleted with the search or by the erasure (0318). No '
  'member right.';

create table if not exists search.impression_reasons (
  search_query_id     uuid     not null,
  creator_account_id  uuid     not null,
  reason_code         text     not null references search.explanation_reasons (code),
  position            smallint not null,
  reason_params       jsonb    not null default '{}'::jsonb,

  constraint impression_reasons_pkey primary key (search_query_id, creator_account_id, reason_code),
  constraint impression_reasons_impression
    foreign key (search_query_id, creator_account_id)
    references search.search_impressions (search_query_id, creator_account_id) on delete cascade,
  constraint impression_reasons_position_once unique (search_query_id, creator_account_id, position),
  constraint impression_reasons_position check (position between 1 and 4),
  -- 10 RG41 rule 4, modele §7 (EC-L3E-03-3): strings only, codes and bands, never a number
  constraint impression_reasons_params check (
    jsonb_typeof(reason_params) = 'object'
    and pg_column_size(reason_params) <= 500
    and not jsonb_path_exists(reason_params,
          '$.keyvalue() ? (!(@.key like_regex "^[a-z][A-Za-z]{0,31}$")
                           || @.value.type() != "string"
                           || !(@.value like_regex "^[A-Za-z0-9_]{1,64}$")
                           || @.value like_regex "^[0-9]+$")'))
);

comment on table search.impression_reasons is
  'The 2 to 4 reasons shown on a card, as they were shown (04 §5.5; 10 RG41; l3e/modele.md §7): a '
  'code of search.explanation_reasons of kind reason, its position, its parameters — codes and '
  'bands only, never a number, never a label, the exact keys of the reason (EC-L3E-03-2). Written '
  'by 0320 at the impression; append-only, deleted with the impression.';

create table if not exists search.creator_exposures (
  creator_account_id  uuid        not null primary key references identity.accounts (id),
  first_page_at       timestamptz not null
);

comment on table search.creator_exposures is
  'The first page 1 of a search that served a creator (l3e/modele.md §6, §9): a creator absent '
  'before the UTC day is cold for the quota (RG45). Inserted once by 0319 (never updated), deleted '
  'by the erasure (0318). No member right.';

-- 4.1 What a CHECK cannot read: the kind of a code, the keys of a reason (EC-L3E-03-2)
create or replace function search.check_impression_vigilance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- the trigger fires on a note only (WHEN clause): a line without one reads nothing
  if new.vigilance_code is not null then
    if not exists (select 1 from search.explanation_reasons r
                    where r.code = new.vigilance_code and r.kind = 'vigilance' and r.is_active) then
      raise exception 'impression_vigilance_code'
        using errcode = 'check_violation', detail = 'impression_vigilance_code';
    end if;
  end if;
  return new;
end
$$;

create or replace function search.check_impression_reason()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kind    text;
  v_active  boolean;
  v_keys    text[];
begin
  select r.kind, r.is_active, r.param_keys into v_kind, v_active, v_keys
    from search.explanation_reasons r
   where r.code = new.reason_code;
  if v_kind is distinct from 'reason' or not v_active then
    raise exception 'impression_reason_code'
      using errcode = 'check_violation', detail = 'impression_reason_code';
  end if;
  -- the shape itself is the CHECK's; a scalar has no keys to compare
  if pg_catalog.jsonb_typeof(new.reason_params) is distinct from 'object' then
    raise exception 'impression_reason_params'
      using errcode = 'check_violation', detail = 'impression_reason_params';
  end if;
  if (select coalesce(pg_catalog.array_agg(k order by k), array[]::text[])
        from pg_catalog.jsonb_object_keys(new.reason_params) k)
     is distinct from
     (select coalesce(pg_catalog.array_agg(k order by k), array[]::text[])
        from pg_catalog.unnest(v_keys) k) then
    raise exception 'impression_reason_params'
      using errcode = 'check_violation', detail = 'impression_reason_params';
  end if;
  return new;
end
$$;

comment on function search.check_impression_vigilance() is
  'l3e/modele.md §7 (0316): BEFORE INSERT OR UPDATE OF vigilance_code on search.search_impressions, '
  'WHEN a note is written; 23514 impression_vigilance_code unless the note is an active code of kind '
  'vigilance. SECURITY INVOKER: the writer reads search.explanation_reasons with its own rights.';
comment on function search.check_impression_reason() is
  'l3e/modele.md §7 (0316, EC-L3E-03-2): BEFORE INSERT OR UPDATE on search.impression_reasons; 23514 '
  'impression_reason_code unless an active code of kind reason, impression_reason_params unless '
  'the keys of reason_params are exactly its param_keys. SECURITY INVOKER.';

revoke all on function search.check_impression_vigilance() from public, anon, authenticated, service_role;
revoke all on function search.check_impression_reason() from public, anon, authenticated, service_role;

drop trigger if exists search_impressions_check_vigilance on search.search_impressions;
create trigger search_impressions_check_vigilance
  before insert or update of vigilance_code on search.search_impressions
  for each row
  when (new.vigilance_code is not null)
  execute function search.check_impression_vigilance();
drop trigger if exists impression_reasons_check_reason on search.impression_reasons;
create trigger impression_reasons_check_reason
  before insert or update on search.impression_reasons
  for each row execute function search.check_impression_reason();

-- 4.2 Append-only outside the erasure (04 §5.5 « Append-only »; modele §9)
create or replace function search.guard_search_journal_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- free: the migration role and every role outside influx_% (the cascades of a deleted parent run
  -- as the owner of the table)
  if current_user not like 'influx\_%' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  -- the erasure (0318) deletes the journal of an account; never a version
  if tg_op = 'DELETE' and current_user = 'influx_privacy_definer'
     and tg_table_name in ('search_queries', 'search_impressions', 'impression_reasons',
                           'creator_exposures') then
    return old;
  end if;
  -- the opening of an impression (L3F), once, nothing else changed
  if tg_op = 'UPDATE' and tg_table_name = 'search_impressions' then
    if not old.was_opened and new.was_opened and new.opened_at is not null
       and new.search_query_id = old.search_query_id
       and new.creator_account_id = old.creator_account_id
       and new.rank = old.rank
       and new.cold_quota = old.cold_quota
       and new.vigilance_code is not distinct from old.vigilance_code then
      return new;
    end if;
  end if;
  raise exception 'search_journal_immutable'
    using errcode = 'object_not_in_prerequisite_state', detail = 'search_journal_immutable';
end
$$;

comment on function search.guard_search_journal_write() is
  'l3e/modele.md §9 (0316): BEFORE UPDATE OR DELETE on search.search_queries, search_impressions, '
  'impression_reasons, creator_exposures and facet_config_versions; 55000 search_journal_immutable '
  'for every influx_% role but the DELETE of influx_privacy_definer on the journal (the erasure) and '
  'the opening of an impression once (was_opened false -> true with opened_at, nothing else). '
  'SECURITY INVOKER, reads nothing.';

revoke all on function search.guard_search_journal_write() from public, anon, authenticated, service_role;

do $$
declare
  v_table text;
begin
  foreach v_table in array array['search_queries', 'search_impressions', 'impression_reasons',
                                 'creator_exposures', 'facet_config_versions'] loop
    execute format('drop trigger if exists %I on search.%I', v_table || '_immutable', v_table);
    execute format('create trigger %I before update or delete on search.%I '
                   'for each row execute function search.guard_search_journal_write()',
                   v_table || '_immutable', v_table);
  end loop;
end
$$;

-- 5. The brand's shortlists (04 §5.5; modele §9: no member right, doors by alias at L3F) ------------

create table if not exists search.shortlists (
  id                     uuid        not null default gen_random_uuid() primary key,
  advertiser_account_id  uuid        not null references profiles.advertiser_profiles (account_id),
  name                   text        not null,
  campaign_id            uuid        references campaigns.campaigns (id),
  created_at             timestamptz not null default now(),

  constraint shortlists_name check (char_length(name) between 1 and 80)
);

create index if not exists shortlists_advertiser_idx on search.shortlists (advertiser_account_id);

create table if not exists search.shortlist_items (
  shortlist_id        uuid        not null references search.shortlists (id) on delete cascade,
  creator_account_id  uuid        not null references identity.accounts (id),
  added_at            timestamptz not null default now(),
  note                text,

  constraint shortlist_items_pkey primary key (shortlist_id, creator_account_id),
  constraint shortlist_items_note check (note is null or char_length(note) between 1 and 500)
);

create index if not exists shortlist_items_creator_idx on search.shortlist_items (creator_account_id);

comment on table search.shortlists is
  'The private shortlists of a brand (04 §5.5): its name, its campaign. No notification to the '
  'creator (RG8, CA64). RLS forced, NO member right (l3e/modele.md §9: the brand never holds a '
  'creator_account_id); its doors, by alias, come with L3F.';
comment on table search.shortlist_items is
  'The creators of a shortlist, their date and the brand''s note (04 §5.5). No member right; deleted '
  'with the shortlist.';

-- 6. The counters of critical mass (04 §5.5, D38; the daily task at L3G) ---------------------------

create table if not exists search.supply_counters (
  snapshot_on                date        not null,
  dimension                  text        not null,
  dimension_value            text        not null default '*',
  published_profiles_count   integer     not null,
  searchable_profiles_count  integer     not null,
  computed_at                timestamptz not null,

  constraint supply_counters_pkey primary key (snapshot_on, dimension, dimension_value),
  constraint supply_counters_dimension check (dimension in ('global', 'topic', 'country')),
  constraint supply_counters_dimension_value check (
    (dimension = 'global' and dimension_value = '*')
    or (dimension <> 'global' and dimension_value ~ '^[A-Za-z0-9_]{1,64}$')),
  constraint supply_counters_counts check (
    published_profiles_count >= 0 and searchable_profiles_count >= 0
    and searchable_profiles_count <= published_profiles_count)
);

comment on table search.supply_counters is
  'One row per day and per value of the published and searchable creator profiles (04 §5.5; 10 RG2, '
  'D38): it PROPOSES the opening of the search, never flips is_open_to_advertisers (a human '
  'decision). Written by the daily task of L3G; no right today.';

-- 7. Rights: RLS forced, nothing by default, nothing to a member (fiche invariant 1) ---------------

do $$
declare
  v_table text;
begin
  foreach v_table in array array['explanation_reasons', 'facet_settings', 'search_settings',
                                 'facet_config_versions', 'search_queries', 'search_impressions',
                                 'impression_reasons', 'creator_exposures', 'shortlists',
                                 'shortlist_items', 'supply_counters'] loop
    execute format('alter table search.%I enable row level security', v_table);
    execute format('alter table search.%I force row level security', v_table);
    execute format('revoke all on search.%I from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', v_table);
    -- the second line of « no member right »: even a grant written by mistake sees no row
    execute format('drop policy if exists %I on search.%I', v_table || '_no_member_access', v_table);
    execute format('create policy %I on search.%I as restrictive for all '
                   'to influx_advertiser, influx_creator using (false) with check (false)',
                   v_table || '_no_member_access', v_table);
  end loop;
end
$$;

-- 7.1 What the owner of the writers reads and writes (modele §9), each right with its policy
grant usage on schema search, identity, influx, audit to influx_search_admin_definer;
grant execute on function influx.current_account_id(), influx.current_account_role(),
                          influx.current_aal(), influx.has_aal2()
   to influx_search_admin_definer;
grant execute on function search.facet_config_snapshot() to influx_search_admin_definer;

-- the caller only: an active account, its admin role, its active agent profile
grant select (id, status) on identity.accounts to influx_search_admin_definer;
grant select (account_id, role) on identity.account_roles to influx_search_admin_definer;
grant select (account_id, is_active) on identity.agent_profiles to influx_search_admin_definer;

drop policy if exists accounts_search_admin_definer_select on identity.accounts;
create policy accounts_search_admin_definer_select on identity.accounts
  for select to influx_search_admin_definer
  using (id = (select influx.current_account_id()));
drop policy if exists account_roles_search_admin_definer_select on identity.account_roles;
create policy account_roles_search_admin_definer_select on identity.account_roles
  for select to influx_search_admin_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists agent_profiles_search_admin_definer_select on identity.agent_profiles;
create policy agent_profiles_search_admin_definer_select on identity.agent_profiles
  for select to influx_search_admin_definer
  using (account_id = (select influx.current_account_id()));

-- the settings and the facets: read, updated with the caller as author
grant select (key, value), update (value, updated_by_account_id, updated_at)
   on search.search_settings to influx_search_admin_definer;
grant select (facet_code, wave, is_open, display_order),
      update (is_open, display_order, updated_by_account_id, updated_at)
   on search.facet_settings to influx_search_admin_definer;

drop policy if exists search_settings_search_admin_definer_select on search.search_settings;
create policy search_settings_search_admin_definer_select on search.search_settings
  for select to influx_search_admin_definer using (true);
drop policy if exists search_settings_search_admin_definer_update on search.search_settings;
create policy search_settings_search_admin_definer_update on search.search_settings
  for update to influx_search_admin_definer
  using (true)
  with check (updated_by_account_id = (select influx.current_account_id()));
drop policy if exists facet_settings_search_admin_definer_select on search.facet_settings;
create policy facet_settings_search_admin_definer_select on search.facet_settings
  for select to influx_search_admin_definer using (true);
drop policy if exists facet_settings_search_admin_definer_update on search.facet_settings;
create policy facet_settings_search_admin_definer_update on search.facet_settings
  for update to influx_search_admin_definer
  using (true)
  with check (updated_by_account_id = (select influx.current_account_id()));

-- a version: inserted with the caller as author, its number read back
grant select (version), insert (changed_by_account_id, snapshot, note)
   on search.facet_config_versions to influx_search_admin_definer;
drop policy if exists facet_config_versions_search_admin_definer_select on search.facet_config_versions;
create policy facet_config_versions_search_admin_definer_select on search.facet_config_versions
  for select to influx_search_admin_definer using (true);
drop policy if exists facet_config_versions_search_admin_definer_insert on search.facet_config_versions;
create policy facet_config_versions_search_admin_definer_insert on search.facet_config_versions
  for insert to influx_search_admin_definer
  with check (changed_by_account_id = (select influx.current_account_id()));

-- 7.2 The register, through audit.append(), granted by its owner (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_search_admin_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 8. The writers of an administrator, as influx_search_admin_definer (03 P7 rule 5) ---------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_search_admin_definer', current_user);
end
$$;
grant create on schema search to influx_search_admin_definer;
set role influx_search_admin_definer;

-- 8.1 The caller: an active admin, active agent profile, aal2 (the rule of identity.require_active_admin)
create or replace function search.require_search_admin()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_caller uuid := influx.current_account_id();
begin
  if v_caller is null
     or not influx.has_aal2()
     or influx.current_account_role() is distinct from 'admin'
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'admin'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller
             and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return v_caller;
end
$$;

comment on function search.require_search_admin() is
  'Returns the caller when he is an active account with the admin role, an active agent profile, in '
  'an aal2 transaction; 42501 forbidden otherwise (0316). SECURITY INVOKER owned by '
  'influx_search_admin_definer, NO grant: called by its two writers only.';

-- 8.2 A search setting (10 RG2, RG57, RG63; modele §9)
create or replace function search.write_search_setting(p_key text, p_value jsonb)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := search.require_search_admin();
  v_before   jsonb;
  v_version  bigint;
begin
  if p_key is null then
    raise exception 'key' using errcode = 'invalid_parameter_value', detail = 'key';
  end if;
  if p_value is null then
    raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
  end if;
  -- one writer of the configuration at a time: a version always reads the state it follows
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('search.settings', 0));

  select s.value into v_before from search.search_settings s where s.key = p_key for update;
  if not found then
    raise exception 'key' using errcode = 'invalid_parameter_value', detail = 'key';
  end if;
  if v_before = p_value then
    select max(v.version) into v_version from search.facet_config_versions v;
    return v_version;
  end if;

  begin
    update search.search_settings
       set value = p_value, updated_by_account_id = v_caller, updated_at = pg_catalog.now()
     where key = p_key;
  exception
    when check_violation then
      raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
  end;

  -- RG88: k and the cold quota change what a search serves, so they open a version too
  if p_key in ('k_anonymity_threshold', 'cold_profile_quota') then
    insert into search.facet_config_versions (changed_by_account_id, snapshot)
    values (v_caller, search.facet_config_snapshot())
    returning version into v_version;
  else
    select max(v.version) into v_version from search.facet_config_versions v;
  end if;

  -- last: the chain lock is the last lock of the transaction (04 §7.2)
  perform audit.append('search.settings_changed', 'search_setting',
                       pg_catalog.md5('search.search_settings:' || p_key)::uuid,
                       pg_catalog.jsonb_build_object(
                         'table', 'search_settings', 'key', p_key,
                         'before', v_before, 'after', p_value,
                         'facet_config_version', v_version));
  return v_version;
end
$$;

comment on function search.write_search_setting(text, jsonb) is
  '10 RG2, RG57, RG63; l3e/modele.md §9 (0316): an administrator changes a search setting. 22023 key '
  '(NULL or outside the eight), value (NULL or a shape refused by the CHECK); 42501 outside an active '
  'admin in aal2. A value unchanged writes nothing. A change writes search.settings_changed '
  '{table, key, before, after, facet_config_version} on md5(''search.search_settings:'' || '
  'key)::uuid, and a version when the key is k_anonymity_threshold or cold_profile_quota (RG88). '
  'Returns the facet configuration version in force. SECURITY DEFINER owned by '
  'influx_search_admin_definer; EXECUTE for influx_admin only.';

-- 8.3 A facet (10 RG11, RG88; modele §9)
create or replace function search.write_facet_setting(
  p_code           text,
  p_is_open        boolean,
  p_display_order  integer,
  p_note           text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller       uuid := search.require_search_admin();
  v_note         text := nullif(pg_catalog.btrim(p_note), '');
  v_before_open  boolean;
  v_before_order smallint;
  v_version      bigint;
begin
  if p_is_open is null then
    raise exception 'is_open' using errcode = 'invalid_parameter_value', detail = 'is_open';
  end if;
  if p_display_order is null or p_display_order not between 1 and 99 then
    raise exception 'display_order' using errcode = 'invalid_parameter_value', detail = 'display_order';
  end if;
  if v_note is not null and pg_catalog.char_length(v_note) > 500 then
    raise exception 'note' using errcode = 'invalid_parameter_value', detail = 'note';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('search.settings', 0));

  select f.is_open, f.display_order into v_before_open, v_before_order
    from search.facet_settings f
   where f.facet_code = p_code
     for update;
  if not found then
    raise exception 'facet_code' using errcode = 'invalid_parameter_value', detail = 'facet_code';
  end if;
  if v_before_open = p_is_open and v_before_order = p_display_order then
    select max(v.version) into v_version from search.facet_config_versions v;
    return v_version;
  end if;

  begin
    update search.facet_settings
       set is_open = p_is_open, display_order = p_display_order,
           updated_by_account_id = v_caller, updated_at = pg_catalog.now()
     where facet_code = p_code;
  exception
    when check_violation then
      -- outside the base, or F12 while D78 holds
      raise exception 'facet_not_openable'
        using errcode = 'invalid_parameter_value', detail = 'facet_not_openable';
  end;

  insert into search.facet_config_versions (changed_by_account_id, snapshot, note)
  values (v_caller, search.facet_config_snapshot(), v_note)
  returning version into v_version;

  perform audit.append('search.settings_changed', 'search_setting',
                       pg_catalog.md5('search.facet_settings:' || p_code)::uuid,
                       pg_catalog.jsonb_build_object(
                         'table', 'facet_settings', 'key', p_code,
                         'before', pg_catalog.jsonb_build_object('is_open', v_before_open,
                                                                 'display_order', v_before_order),
                         'after', pg_catalog.jsonb_build_object('is_open', p_is_open,
                                                                'display_order', p_display_order),
                         'facet_config_version', v_version));
  return v_version;
end
$$;

comment on function search.write_facet_setting(text, boolean, integer, text) is
  '10 RG11, RG88; l3e/modele.md §9 (0316): an administrator opens, closes or orders a facet. 22023 '
  'facet_code (unknown), is_open (NULL), display_order (outside 1 to 99), note (over 500 characters, '
  'trimmed), facet_not_openable (outside the base, or F12 while D78 holds); 42501 outside an active '
  'admin in aal2. Unchanged: nothing written. A change inserts a version (its note) and writes '
  'search.settings_changed {table, key, before, after, facet_config_version} on '
  'md5(''search.facet_settings:'' || code)::uuid; returns the version. SECURITY DEFINER owned by '
  'influx_search_admin_definer; EXECUTE for influx_admin only.';

revoke all on function search.require_search_admin() from public, anon, authenticated, service_role;
revoke all on function search.write_search_setting(text, jsonb)
  from public, anon, authenticated, service_role;
revoke all on function search.write_facet_setting(text, boolean, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function search.write_search_setting(text, jsonb) to influx_admin;
grant execute on function search.write_facet_setting(text, boolean, integer, text) to influx_admin;

reset role;
revoke create on schema search from influx_search_admin_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_search_admin_definer', current_user);
end
$$;

-- 8.4 The administrator reaches the schema for the two writers, nothing else in it
grant usage on schema search to influx_admin;

-- 9. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner   constant text := 'influx_search_admin_definer';
  c_tables  constant text[] := array[
    'search.explanation_reasons', 'search.facet_settings', 'search.search_settings',
    'search.facet_config_versions', 'search.search_queries', 'search.search_impressions',
    'search.impression_reasons', 'search.creator_exposures', 'search.shortlists',
    'search.shortlist_items', 'search.supply_counters'];
  v_def     record;
  v_bad     text;
begin
  -- 03 P7: NOLOGIN NOINHERIT, no member, member of nothing, no attribute (C-9 tolerated)
  if not exists (select 1 from pg_catalog.pg_roles
                  where rolname = c_owner and not rolcanlogin and not rolinherit and not rolsuper
                    and not rolbypassrls and not rolcreatedb and not rolcreaterole
                    and not rolreplication)
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.member = c_owner::regrole
                    or (m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))) then
    raise exception 'influx_search_admin_definer must be NOLOGIN NOINHERIT, without member nor membership';
  end if;

  -- the functions: owner, mode, empty search_path, EXECUTE for their callers only
  for v_def in
    select * from (values
      ('search.require_search_admin()', c_owner, false, ''),
      ('search.write_search_setting(text, jsonb)', c_owner, true, 'influx_admin'),
      ('search.write_facet_setting(text, boolean, integer, text)', c_owner, true, 'influx_admin'),
      ('search.facet_config_snapshot()', 'postgres', false, c_owner),
      ('search.result_count_band(integer)', 'postgres', false, ''),
      ('search.check_impression_vigilance()', 'postgres', false, ''),
      ('search.check_impression_reason()', 'postgres', false, ''),
      ('search.guard_search_journal_write()', 'postgres', false, '')
    ) as d (fn, owner, definer, callers)
  loop
    if (v_def.owner <> 'postgres'
        and (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
              where oid = v_def.fn::regprocedure) <> v_def.owner)
       or (v_def.owner = 'postgres'
           and (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
                 where oid = v_def.fn::regprocedure) like 'influx\_%')
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by %, SECURITY %, empty search_path',
        v_def.fn, v_def.owner, case when v_def.definer then 'DEFINER' else 'INVOKER' end;
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

  -- L2DS-5 extended: no dynamic SQL in a function of the owner
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic SQL in a function of influx_search_admin_definer: %', v_bad;
  end if;

  -- fiche invariant 1, 03.md « Arrêt si »: no member, agent nor admin right on a table of search
  -- (the admin executes the two writers only); nothing to the Data API roles
  select string_agg(ro.rolname || ' ' || c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace,
         pg_catalog.pg_roles ro
   where n.nspname = 'search' and c.relkind in ('r', 'p', 'v', 'm')
     and ro.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                        'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                        'influx_privacy', 'anon', 'authenticated', 'service_role')
     and (pg_catalog.has_table_privilege(ro.oid, c.oid,
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          or pg_catalog.has_any_column_privilege(ro.oid, c.oid, 'SELECT, INSERT, UPDATE, REFERENCES'));
  if v_bad is not null then
    raise exception 'an execution role holds a right on a table of search: %', v_bad;
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'search'::regnamespace
     and pg_catalog.has_function_privilege('influx_admin', p.oid, 'EXECUTE')
     and p.oid not in ('search.write_search_setting(text, jsonb)'::regprocedure,
                       'search.write_facet_setting(text, boolean, integer, text)'::regprocedure);
  if v_bad is not null then
    raise exception 'influx_admin executes a function of search beyond its two writers: %', v_bad;
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'search'::regnamespace
     and (pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('influx_agent', p.oid, 'EXECUTE'));
  if v_bad is not null then
    raise exception 'influx_advertiser or influx_agent executes a function of search: %', v_bad;
  end if;

  -- the owner: its caller's three identity columns sets, the settings, the facets, a version;
  -- nothing of the journal, the shortlists nor the counters
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p')
     and n.nspname in ('influx', 'reference', 'identity', 'audit', 'billing', 'backoffice', 'leads',
                       'profiles', 'verification', 'campaigns', 'search', 'matching', 'messaging',
                       'ops', 'privacy')
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'SELECT, INSERT, UPDATE'))
     and c.oid not in ('identity.accounts'::regclass, 'identity.account_roles'::regclass,
                       'identity.agent_profiles'::regclass, 'search.search_settings'::regclass,
                       'search.facet_settings'::regclass, 'search.facet_config_versions'::regclass);
  if v_bad is not null then
    raise exception 'influx_search_admin_definer reaches beyond its six tables: %', v_bad;
  end if;
  if pg_catalog.has_table_privilege(c_owner, 'search.facet_config_versions', 'UPDATE, DELETE')
     or pg_catalog.has_any_column_privilege(c_owner, 'search.facet_config_versions', 'UPDATE')
     or pg_catalog.has_any_column_privilege(c_owner, 'identity.accounts', 'INSERT, UPDATE')
     or pg_catalog.has_table_privilege(c_owner, 'search.search_settings', 'INSERT, DELETE')
     or pg_catalog.has_table_privilege(c_owner, 'search.facet_settings', 'INSERT, DELETE') then
    raise exception 'influx_search_admin_definer writes beyond the settings, the facets and a version';
  end if;

  -- RLS enabled and forced, the restrictive member policy on each table
  select string_agg(t, ', ') into v_bad
    from pg_catalog.unnest(c_tables) t
   where not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
               where oid = t::regclass)
      or not exists (select 1 from pg_catalog.pg_policy po
                      where po.polrelid = t::regclass and not po.polpermissive
                        and po.polname = split_part(t, '.', 2) || '_no_member_access');
  if v_bad is not null then
    raise exception 'RLS not forced, or no restrictive member policy, on: %', v_bad;
  end if;

  -- the guards and the checks on their tables
  select string_agg(t, ', ') into v_bad
    from pg_catalog.unnest(array['search_queries', 'search_impressions', 'impression_reasons',
                                 'creator_exposures', 'facet_config_versions']) t
   where not exists (select 1 from pg_catalog.pg_trigger
                      where tgrelid = ('search.' || t)::regclass
                        and tgname = t || '_immutable' and not tgisinternal);
  if v_bad is not null then
    raise exception 'the journal guard is missing on: %', v_bad;
  end if;

  -- the loaded data: 17 codes, 24 facets (7 open: the base but F12), 8 keys, closed, version 1
  if (select count(*) from search.explanation_reasons where kind = 'reason') <> 13
     or (select count(*) from search.explanation_reasons where kind = 'vigilance') <> 4
     or (select count(*) from search.facet_settings) <> 24
     or (select array_agg(facet_code order by display_order) from search.facet_settings where is_open)
          is distinct from array['F1', 'F3', 'F4', 'F6', 'F8', 'F11', 'F17']
     or (select count(*) from search.search_settings) <> 8
     or (select value from search.search_settings where key = 'is_open_to_advertisers')
          is distinct from 'false'::jsonb
     or not exists (select 1 from search.facet_config_versions where version = 1
                       and snapshot = search.facet_config_snapshot()) then
    raise exception 'the data of 0316 are not loaded as modele §7 and §9 say';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  if exists (select 1 from pg_catalog.pg_auth_members m
               join pg_catalog.pg_roles mem on mem.oid = m.member
              where m.roleid in ('influx_search_admin_definer'::regrole, 'influx_audit_writer'::regrole)
                and (mem.rolname <> current_user or m.set_option or m.inherit_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE') then
    raise exception 'a definer role left usable, or with CREATE on search';
  end if;
end
$$;
