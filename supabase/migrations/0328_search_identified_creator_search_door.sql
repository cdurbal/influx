-- =============================================================================
-- 0328_search_identified_creator_search_door
-- -----------------------------------------------------------------------------
-- Lot 3 / L3G, commit 04 (jalons/l3g/04.md; l3g-fiche.md invariants 1 to 4, 6 to 8; jalons/l3g/modele.md
-- §1 to §3, which PREVAILS for every name; 10 RG4, RG62, RG71, RG72, RG78; 03 l. 329-331; 18 TM12.5).
-- The identified creator search of an INFLUX agent: the mode agent_identified of the one engine,
-- behind a door of its own owner. Signalled I-4 (03): a new definer role, a SECURITY DEFINER door,
-- column GRANTs and their policies, EXECUTE on four invoker helpers of the brand's owner, a new key
-- of search.search_settings, the AL21 function recreated.
--
-- 1. influx_agent_search_definer: NOLOGIN NOINHERIT, no member (modele preamble), added to the closed
--    list of 03 P7. Owner of the door and of its three invoker helpers; distinct from the brand's owner
--    (influx_creator_search_definer), from influx_creator_profile_definer (L2GS-5) and from
--    influx_search_admin_definer. Layer I is read by it alone (fiche invariant 3).
-- 2. search.search_settings gains its tenth key, identified_view {pageSize: 20, maxPages: 10} (CHECK
--    10 to 50 and 1 to 20; the hypothesis of staging), read at every call (modele §1).
-- 3. search.creator_candidates() recreated at equal signature, as its owner (modele §1): the brand's
--    query UNCHANGED; agent_identified is a SECOND query, run only under influx_agent_search_definer
--    (42501 otherwise), so the brand's owner never plans a query that names a column of G and is never
--    granted one (modele -1). E1 lifted (G2 filters the state), E2, E3, E4 kept, E5 never excludes (the
--    door flags the pair), E6 when a brand is known (the brand of the campaign; without a campaign,
--    neither E5 nor E6); the facets of the base exactly as the brand's (RG71: the same facets, the same
--    bounds), plus G1, G2, G8, G9, G10. EXECUTE on the engine, the order, the closed entry of the base
--    and the admission of a campaign granted to influx_agent_search_definer (one engine, RG4).
-- 4. The helpers of the agent's owner, SECURITY INVOKER, executed by their owner only:
--      search.require_identified_searcher()  the caller: an active account holding the role agent or
--            admin of its session, an active internal profile, aal2; 42501 otherwise.
--      search.check_identified_search_filters(filters)  the base by search.check_creator_search_filters()
--            (what is not G), then G1, G2, G8, G9, G10 (lists of 1 to 20, closed values); 22023.
--      search.identified_creator_row(account, brand)  the row of modele §1: identity, states, residence,
--            agent in charge, refused sectors, the pair blocked, every network line with its EXACT
--            figures (the rule of the creator record, account-creator/repository.ts, in SQL) and the
--            exact share of the main audience. Never a contact detail nor an address (D46), a rate nor
--            a budget (D78).
-- 5. search.search_creators_identified(filters, sort, page, campaign, prefill) (modele §1): SECURITY
--    DEFINER, empty search_path, EXECUTE for influx_agent and influx_admin ONLY, no dynamic SQL. In
--    order: the caller (42501), sort and page (22023), the filters (22023), the campaign (admitted by
--    search.is_admitted_campaign(its brand, id), P0002 campaign), the prefill (0A000 prefill until
--    0329), the page beyond maxPages {state: page_cap} (journaled), the engine, the exact count, the
--    order of search.creator_order() as it is (cold quota included), the page, the journal. No switch,
--    no k, no bucket, no lock (CA61, RG62); search.creator_exposures never written (RG87). Answer
--    {state: results, total, page, nextPage, capReached, rows: [row || {reasons, vigilance}]}.
-- 6. The journal (modele §3; RG78, CA58), in the transaction that serves: a served call or a page_cap
--    writes its line of search.search_queries (actor_role agent or admin, view_mode agent_identified,
--    campaign, filters, sort, version, EXACT count); a served page one impression per row (rank,
--    cold_quota, note) and its reasons (codes and bands). Never an exact value written. A write
--    refused, nothing served. Neither outbox, matching.* nor notification (D45, RG8).
-- 7. AL21 (search.creator_search_volume_alerts(), modele §1, EC-L3G-5) recreated at equal signature
--    and owner: it counts the brand view (advertiser_anonymous) alone; the internal accounts get their
--    own thresholds at Lot 5 (l3e/modele.md §10). Its owner reads view_mode of the journal.
--
-- RIGHTS (03 I-4, signalled): a new role; USAGE on search, profiles, identity, influx, campaigns,
-- matching and verification to it; column GRANTs and their policies to it on identity.accounts,
-- account_roles, agent_profiles, profiles.advertiser_profiles, advertiser_secondary_sectors,
-- campaigns.campaigns, campaign_deliverables, campaign_audience_countries,
-- profiles.creator_public_profiles, creator_public_networks, creator_publication_languages,
-- creator_formats, creator_refused_sectors, creator_identities (names and city only),
-- creator_social_accounts, creator_audience_countries, verification.badges, matching.party_blocks,
-- search.search_settings, facet_settings, facet_config_versions, explanation_reasons,
-- creator_exposures (read), search_queries, search_impressions, impression_reasons (insert); EXECUTE
-- on influx.current_account_id(), current_account_role(), current_aal(), has_aal2() and on
-- search.creator_candidates(), creator_order(), check_creator_search_filters(), is_admitted_campaign()
-- to it; EXECUTE on the door to influx_agent and influx_admin, USAGE on search to influx_agent
-- (influx_admin holds it since 0316); SELECT (view_mode) on
-- search.search_queries to influx_search_admin_definer. NOTHING new to influx_advertiser nor
-- influx_creator; nothing new to influx_creator_search_definer but the engine recreated.
--
-- Not here: the prefill (0329), queue 9 (0330), the counters (0331), the settings under a peer's
-- control (0332), the routes and contracts of the view (L3G-09), the screens (L3G-12), the selection
-- and « Proposer » (Lot 4), G3 to G7 (Lot 4), AL21 of the internal accounts (Lot 5).
--
-- EC-L3G-04 (micro-gaps, the safest choice):
--   EC-L3G-04-1  the page is checked 1 to 50 (22023 page), as the brand's: the journal holds no page
--                beyond 50 (CHECK search_queries_page_reached); beyond maxPages, page_cap.
--   EC-L3G-04-2  F3, F4 and F17 hold on a LISTED line in both modes (RG71: the same facets): a profile
--                never published has no listed line, so these facets never select it.
--   EC-L3G-04-3  the brand's owner running the engine in agent_identified gets 42501 agent_identified
--                (0A000 until now): the expectation of L3E-T6 (TM12.5) follows, with the door now held
--                by influx_agent; four helpers of the brand's owner gain one caller each (L3E-T6).
--   EC-L3G-04-4  the badge of a line: its best holding badge {level, state} (audience_verified before
--                account_verified, active before to_refresh, the latest), null without one.
--   EC-L3G-04-5  legalName: the legal first and last names joined by a space, null without either;
--                city of layer N (D79); never the address, the postal code, the e-mail nor the phone.
--   EC-L3G-04-6  networks: every line of the creator, listed or not (the identities, RG71), in the
--                order of the creator record (primary first, network, line); never the key of a line.
--   EC-L3G-04-7  mainAudience: the main country of the storefront and the exact share of slot 0 of the
--                primary line (null while undeclared); null without a main country.
--   EC-L3G-04-8  AL21 counts the brand view alone (EC-L3G-5): the expectation of L3E-T10 « counts the
--                agents as the brands » follows (search-volume-alert.test.ts).
--   EC-L3G-04-9  identified_view is the tenth key of the zod schemas of packages/contracts
--                (search-settings.ts), the CHECK and the schema kept equal (L3E-T3 follows).
--   EC-L3G-04-10 G8 a list of lowercase uuids; G9 {country, regions?}, a region of the shape of
--                reference.regions prefixed by its country; G1, G2 closed lists; G10 sector codes.
--   EC-L3G-04-11 creator_order() unchanged leaves the cold mark of a profile never published (no
--                published_at) unknown once it was exposed: its impression is written cold_quota false.
--
-- ROLLBACK (before any identified search is journaled once 0328 is applied): drop the door and its
-- three helpers; re-run the engine of 0322 (as influx_creator_search_definer) and revoke EXECUTE on
-- the engine, the order, the closed entry and the admission from influx_agent_search_definer;
-- re-run AL21 of 0326 and revoke select (view_mode) on search.search_queries from
-- influx_search_admin_definer; drop the policies *_agent_search_definer_* and revoke their grants;
-- delete the key identified_view and recreate the two CHECKs of 0324; drop role
-- influx_agent_search_definer.
-- =============================================================================

-- 1. The owner of the door (03 P7 rule 5; rules 1 and 2 of 0001; modele preamble) -----------------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_agent_search_definer') then
    create role influx_agent_search_definer with nologin noinherit;
  end if;
  alter role influx_agent_search_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_agent_search_definer' and rolsuper) then
    raise exception 'role influx_agent_search_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_agent_search_definer' and rolbypassrls) then
    alter role influx_agent_search_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_agent_search_definer' and rolreplication) then
    alter role influx_agent_search_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_agent_search_definer' and rolcreatedb) then
    alter role influx_agent_search_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_agent_search_definer' and rolcreaterole) then
    alter role influx_agent_search_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. The tenth key of the settings (modele §1) ------------------------------------------------------

alter table search.search_settings drop constraint if exists search_settings_key_closed_list;
alter table search.search_settings add constraint search_settings_key_closed_list check (key in (
    'is_open_to_advertisers', 'k_anonymity_threshold', 'page_size', 'max_pages', 'rate_limits',
    'cold_profile_quota', 'critical_mass_thresholds', 'region_display_threshold',
    'selection_limits', 'identified_view'));

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
    -- 0324 (l3f/modele §5): the bounds of the shortlists and of the request to the team
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
    -- 0328 (l3g/modele §1): the pages of the identified view, read at every call
    when 'identified_view' then
      jsonb_typeof(value) = 'object'
      and value ?& array['pageSize', 'maxPages']
      and (value - 'pageSize' - 'maxPages') = '{}'::jsonb
      and jsonb_path_exists(value,
            '$ ? (@.pageSize.type() == "number" && @.pageSize >= 10 && @.pageSize <= 50
                  && @.pageSize.floor() == @.pageSize
                  && @.maxPages.type() == "number" && @.maxPages >= 1 && @.maxPages <= 20
                  && @.maxPages.floor() == @.maxPages)')
    else false
  end);

comment on table search.search_settings is
  'The settings of the creator search, as data (04 §5.5; 10 RG2, RG57, RG63; l3e/modele.md §9; '
  'l3f/modele.md §5; l3g/modele.md §1): a closed list of ten keys, the shape of each value checked in '
  'base (EC-L3E-03-1) and by its zod schema (packages/contracts, search-settings.ts). '
  'is_open_to_advertisers FALSE: closed, no list (D38, CA59). identified_view: the pages of the '
  'identified view of the agents (0328). Read at EVERY search, never at start. Written by '
  'search.write_search_setting() only (influx_admin, aal2), every change a line '
  'search.settings_changed (before, after), a change of k or of the cold quota a version of '
  'search.facet_config_versions.';

insert into search.search_settings (key, value) values
  ('identified_view', '{"pageSize": 20, "maxPages": 10}')
on conflict (key) do nothing;

-- 3. What influx_agent_search_definer reads and writes (modele §1, §3) ------------------------------
-- Every table below is under ROW LEVEL SECURITY: each right comes with its policy TO the owner,
-- bounded to what the door needs (its caller, the searchable storefronts, the admitted campaigns).

grant usage on schema search, profiles, identity, influx, campaigns, matching, verification
   to influx_agent_search_definer;
grant execute on function influx.current_account_id(), influx.current_account_role(),
                          influx.current_aal(), influx.has_aal2()
   to influx_agent_search_definer;

-- 3.1 The caller (its account, its role, its internal profile), the creator accounts (E3, E4, G1,
-- G8) and the first name of an agent in charge (G8)
grant select (id, status, is_adult_attested, declared_status, owner_agent_id)
   on identity.accounts to influx_agent_search_definer;
grant select (account_id, role) on identity.account_roles to influx_agent_search_definer;
grant select (account_id, first_name, is_active)
   on identity.agent_profiles to influx_agent_search_definer;

drop policy if exists accounts_agent_search_definer_select on identity.accounts;
create policy accounts_agent_search_definer_select on identity.accounts
  for select to influx_agent_search_definer
  using (id = (select influx.current_account_id())
         or exists (select 1 from identity.account_roles r
                     where r.account_id = accounts.id and r.role = 'creator'));

drop policy if exists account_roles_agent_search_definer_select on identity.account_roles;
create policy account_roles_agent_search_definer_select on identity.account_roles
  for select to influx_agent_search_definer
  using (account_id = (select influx.current_account_id()) or role = 'creator');

drop policy if exists agent_profiles_agent_search_definer_select on identity.agent_profiles;
create policy agent_profiles_agent_search_definer_select on identity.agent_profiles
  for select to influx_agent_search_definer
  using (true);

-- 3.2 The admitted campaigns of every brand (the anchor, E6, tier 2) and the sectors of their brand
grant select (id, advertiser_account_id, sector_code, erased_at, status)
   on campaigns.campaigns to influx_agent_search_definer;
grant select (campaign_id, slot, network_code, format_code)
   on campaigns.campaign_deliverables to influx_agent_search_definer;
grant select (campaign_id, country_code)
   on campaigns.campaign_audience_countries to influx_agent_search_definer;
grant select (account_id, primary_sector_code)
   on profiles.advertiser_profiles to influx_agent_search_definer;
grant select (account_id, sector_code)
   on profiles.advertiser_secondary_sectors to influx_agent_search_definer;

drop policy if exists campaigns_agent_search_definer_select on campaigns.campaigns;
create policy campaigns_agent_search_definer_select on campaigns.campaigns
  for select to influx_agent_search_definer
  using (erased_at is null and status in ('pending_review', 'published', 'paused', 'closed'));

drop policy if exists campaign_deliverables_agent_search_definer_select
  on campaigns.campaign_deliverables;
create policy campaign_deliverables_agent_search_definer_select on campaigns.campaign_deliverables
  for select to influx_agent_search_definer
  using (exists (select 1 from campaigns.campaigns c where c.id = campaign_deliverables.campaign_id));

drop policy if exists campaign_audience_countries_agent_search_definer_select
  on campaigns.campaign_audience_countries;
create policy campaign_audience_countries_agent_search_definer_select
  on campaigns.campaign_audience_countries
  for select to influx_agent_search_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.id = campaign_audience_countries.campaign_id));

drop policy if exists advertiser_profiles_agent_search_definer_select on profiles.advertiser_profiles;
create policy advertiser_profiles_agent_search_definer_select on profiles.advertiser_profiles
  for select to influx_agent_search_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.advertiser_account_id = advertiser_profiles.account_id));

drop policy if exists advertiser_secondary_sectors_agent_search_definer_select
  on profiles.advertiser_secondary_sectors;
create policy advertiser_secondary_sectors_agent_search_definer_select
  on profiles.advertiser_secondary_sectors
  for select to influx_agent_search_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.advertiser_account_id = advertiser_secondary_sectors.account_id));

-- 3.3 The SEARCHABLE storefronts, whatever their state (E2 kept, E1 lifted: RG71), the residence of
-- G9; never public_ref, the texts nor the bands the row does not serve
grant select (account_id, alias, status, is_searchable, published_at, primary_topic_code,
              residence_country_code, residence_region_code, main_audience_country,
              main_audience_share_band, availability_band)
   on profiles.creator_public_profiles to influx_agent_search_definer;

drop policy if exists creator_public_profiles_agent_search_definer_select
  on profiles.creator_public_profiles;
create policy creator_public_profiles_agent_search_definer_select
  on profiles.creator_public_profiles
  for select to influx_agent_search_definer
  using (is_searchable);

-- their lists, their projected lines, their refused sectors (E6, G10, served to the agent), their
-- identity (names and city: layer N, never a contact detail nor the address), their network lines
-- (layer I: handle, pseudonym, URL, exact figures) and the exact audience by country of a line
do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('creator_publication_languages', 'account_id, slot, language_code'),
      ('creator_formats',               'account_id, format_code'),
      ('creator_refused_sectors',       'account_id, sector_code'),
      ('creator_public_networks',       'social_account_id, account_id, network_code, is_primary, '
                                        'audience_band, figures_measured_at, created_at, listed_at'),
      ('creator_identities',            'account_id, legal_first_name, legal_last_name, city'),
      ('creator_social_accounts',       'id, account_id, network_code, is_primary, handle, pseudonym, '
                                        'profile_url, followers_count, posts_last_30_days, '
                                        'avg_comments_per_post, engagement_rate_bp, figures_measured_at'),
      ('creator_audience_countries',    'social_account_id, account_id, slot, country_code, share_percent')
    ) as v (name, columns)
  loop
    execute format('grant select (%s) on profiles.%I to influx_agent_search_definer',
                   l.columns, l.name);
    execute format('drop policy if exists %I on profiles.%I',
                   l.name || '_agent_search_definer_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_agent_search_definer '
                   'using (exists (select 1 from profiles.creator_public_profiles p '
                   'where p.account_id = %I.account_id and p.is_searchable))',
                   l.name || '_agent_search_definer_select', l.name, l.name);
  end loop;
end
$$;

-- the holding badges of their lines, with what an agent observed (the exact figures of the record)
grant select (account_id, social_account_id, level, state, granted_at, observed_followers,
              observed_posts_last_30_days, observed_avg_comments, observed_engagement_bp)
   on verification.badges to influx_agent_search_definer;

drop policy if exists badges_agent_search_definer_select on verification.badges;
create policy badges_agent_search_definer_select on verification.badges
  for select to influx_agent_search_definer
  using (level in ('account_verified', 'audience_verified')
         and state in ('active', 'to_refresh')
         and exists (select 1 from profiles.creator_public_profiles p
                      where p.account_id = badges.account_id and p.is_searchable));

-- 3.4 The pair of the ACTIVE blocks, shown, never the reason, the comment nor who blocked (RG71)
grant select (advertiser_account_id, creator_account_id, lifted_at)
   on matching.party_blocks to influx_agent_search_definer;

drop policy if exists party_blocks_agent_search_definer_select on matching.party_blocks;
create policy party_blocks_agent_search_definer_select on matching.party_blocks
  for select to influx_agent_search_definer
  using (lifted_at is null);

-- 3.5 The settings read at every call (identified_view, the cold quota of the order), the facets of
-- the base, the version in force, the reasons (the triggers of the impressions read them as the writer)
grant select (key, value) on search.search_settings to influx_agent_search_definer;
grant select (facet_code, wave, is_open) on search.facet_settings to influx_agent_search_definer;
grant select (version) on search.facet_config_versions to influx_agent_search_definer;
grant select (code, kind, param_keys, is_active)
   on search.explanation_reasons to influx_agent_search_definer;
grant select (creator_account_id, first_page_at)
   on search.creator_exposures to influx_agent_search_definer;

drop policy if exists search_settings_agent_search_definer_select on search.search_settings;
create policy search_settings_agent_search_definer_select on search.search_settings
  for select to influx_agent_search_definer
  using (key in ('identified_view', 'cold_profile_quota'));
drop policy if exists facet_settings_agent_search_definer_select on search.facet_settings;
create policy facet_settings_agent_search_definer_select on search.facet_settings
  for select to influx_agent_search_definer using (true);
drop policy if exists facet_config_versions_agent_search_definer_select
  on search.facet_config_versions;
create policy facet_config_versions_agent_search_definer_select on search.facet_config_versions
  for select to influx_agent_search_definer using (true);
drop policy if exists explanation_reasons_agent_search_definer_select on search.explanation_reasons;
create policy explanation_reasons_agent_search_definer_select on search.explanation_reasons
  for select to influx_agent_search_definer using (true);
-- the cold quota of the order (RG45): read, NEVER written by the identified view (RG87)
drop policy if exists creator_exposures_agent_search_definer_select on search.creator_exposures;
create policy creator_exposures_agent_search_definer_select on search.creator_exposures
  for select to influx_agent_search_definer using (true);

-- 3.6 The journal (modele §3): the caller's own identified lines, their impressions and reasons.
-- INSERT only (its id read back).
grant select (id, account_id, view_mode),
      insert (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
              facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
   on search.search_queries to influx_agent_search_definer;
grant insert (search_query_id, creator_account_id, rank, cold_quota, vigilance_code)
   on search.search_impressions to influx_agent_search_definer;
grant insert (search_query_id, creator_account_id, reason_code, position, reason_params)
   on search.impression_reasons to influx_agent_search_definer;

drop policy if exists search_queries_agent_search_definer_select on search.search_queries;
create policy search_queries_agent_search_definer_select on search.search_queries
  for select to influx_agent_search_definer
  using (account_id = (select influx.current_account_id()) and view_mode = 'agent_identified');
drop policy if exists search_queries_agent_search_definer_insert on search.search_queries;
create policy search_queries_agent_search_definer_insert on search.search_queries
  for insert to influx_agent_search_definer
  with check (account_id = (select influx.current_account_id())
              and actor_role in ('agent', 'admin')
              and actor_role = (select influx.current_account_role())::text
              and view_mode = 'agent_identified');

drop policy if exists search_impressions_agent_search_definer_insert on search.search_impressions;
create policy search_impressions_agent_search_definer_insert on search.search_impressions
  for insert to influx_agent_search_definer
  with check (exists (select 1 from search.search_queries q
                       where q.id = search_impressions.search_query_id
                         and q.account_id = (select influx.current_account_id())
                         and q.view_mode = 'agent_identified'));

drop policy if exists impression_reasons_agent_search_definer_insert on search.impression_reasons;
create policy impression_reasons_agent_search_definer_insert on search.impression_reasons
  for insert to influx_agent_search_definer
  with check (exists (select 1 from search.search_queries q
                       where q.id = impression_reasons.search_query_id
                         and q.account_id = (select influx.current_account_id())
                         and q.view_mode = 'agent_identified'));

-- 4. THE engine, as its owner: the brand's query unchanged, the identified one beside it -----------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_search_definer', current_user);
end
$$;
grant create on schema search to influx_creator_search_definer;
set role influx_creator_search_definer;

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
  v_g1          text[];
  v_g2          text[];
  v_g8          uuid[];
  v_g9_country  text;
  v_g9_regions  text[];
  v_g10         text[];
  v_sectors     text[];
begin
  -- one engine, two modes (RG4, RG71): the identified view runs under the owner of its door only,
  -- whose rights alone reach the columns of G (0328, modele -1)
  if p_mode = 'agent_identified' and current_user is distinct from 'influx_agent_search_definer' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege', detail = 'agent_identified';
  end if;
  if p_mode is null or p_mode not in ('advertiser_anonymous', 'agent_identified')
     or (p_mode = 'advertiser_anonymous' and p_advertiser_account_id is null)
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
  -- that campaign is admitted (0322, L3ES-1: a draft's sector, which the brand writes, never counts);
  -- in the identified view the brand of the campaign, none without a campaign (modele §1)
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

  if p_mode = 'agent_identified' then
    -- the facets of G (modele §2), already checked by search.check_identified_search_filters()
    if p_filters ? 'G1' then
      v_g1 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'G1') x);
    end if;
    if p_filters ? 'G2' then
      v_g2 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'G2') x);
    end if;
    if p_filters ? 'G8' then
      v_g8 := array(select x::uuid from pg_catalog.jsonb_array_elements_text(p_filters -> 'G8') x);
    end if;
    v_g9_country := p_filters #>> '{G9,country}';
    if p_filters -> 'G9' ? 'regions' then
      v_g9_regions := array(select x from pg_catalog.jsonb_array_elements_text(
                                            p_filters #> '{G9,regions}') x);
    end if;
    if p_filters ? 'G10' then
      v_g10 := array(select x from pg_catalog.jsonb_array_elements_text(p_filters -> 'G10') x);
    end if;

    -- the SECOND query (modele §1): five differences with the brand's, and they alone (RG71)
    return query
    select p.account_id, p.published_at
      from profiles.creator_public_profiles p
      join identity.accounts a on a.id = p.account_id
     -- E1 lifted (G2 filters the state); E2 (07 RG8), E3 (07 RG11, L2GS-8), E4 (D15) kept
     where p.is_searchable
       and a.status = 'active'
       and a.is_adult_attested
       -- E5 never excludes: the door flags the pair (RG71). E6 when a brand is known (v_sectors is
       -- empty without a campaign)
       and not exists (select 1 from profiles.creator_refused_sectors r
                         where r.account_id = p.account_id
                           and r.sector_code = any (v_sectors))
       -- G1 the declared status, G2 the state of the profile, G8 the agent in charge
       and (v_g1 is null or a.declared_status::text = any (v_g1))
       and (v_g2 is null or p.status::text = any (v_g2))
       and (v_g8 is null or a.owner_agent_id = any (v_g8))
       -- G9 the country of residence, and its regions when given
       and (v_g9_country is null
            or (p.residence_country_code::text = v_g9_country
                and (v_g9_regions is null or p.residence_region_code = any (v_g9_regions))))
       -- G10 the creator refuses at least one of these sectors
       and (v_g10 is null
            or exists (select 1 from profiles.creator_refused_sectors r
                        where r.account_id = p.account_id and r.sector_code = any (v_g10)))
       -- the facets of the base, exactly as the brand's (RG71: the same facets, the same bounds)
       and (v_f1 is null or p.primary_topic_code = v_f1)
       and (v_f6_country is null
            or (p.main_audience_country::text = v_f6_country
                and (v_f6_shares is null or p.main_audience_share_band = any (v_f6_shares))))
       and ((v_f3 is null and v_f4 is null)
            or exists (select 1 from profiles.creator_public_networks n
                        where n.account_id = p.account_id
                          and n.listed_at is not null
                          and (v_f3 is null or n.network_code = any (v_f3))
                          and (v_f4 is null or n.audience_band = any (v_f4))))
       and (v_f8 is null
            or exists (select 1 from profiles.creator_publication_languages l
                        where l.account_id = p.account_id and l.language_code::text = any (v_f8)))
       and (v_f11 is null
            or exists (select 1 from profiles.creator_formats f
                        where f.account_id = p.account_id and f.format_code = any (v_f11)))
       and (v_f17 is null
            or exists (select 1 from profiles.creator_public_networks n
                         join verification.badges g
                           on g.account_id = n.account_id and g.social_account_id = n.social_account_id
                        where n.account_id = p.account_id
                          and n.listed_at is not null
                          and g.level::text = any (v_f17)
                          and g.state in ('active', 'to_refresh')));
    return;
  end if;

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
  'l3e/modele.md §1, §3, l3g/modele.md §1 (0319, 0322, 0328; 10 RG4, RG17, RG26 to RG31, RG71): THE '
  'engine of the creator search. advertiser_anonymous: the storefronts that pass E1 to E6 (published, '
  'searchable, account active, majority attested, no active block of the pair in either direction, '
  'no sector of the brand nor of its campaign of origin refused, that campaign counted only when '
  'search.is_admitted_campaign() admits it) and the filters already checked by '
  'search.check_creator_search_filters(): OR inside a facet, AND between them, F3 and F4 on one '
  'listed line, F6 country and share together, F17 a holding badge of a listed line. An exclusion '
  'is silent: absent, never counted, its motive neither served nor journaled. agent_identified (a '
  'second query, run under influx_agent_search_definer only, 42501 agent_identified otherwise): E1 '
  'lifted, E2 to E4 kept, E5 never excludes, E6 for the brand of the campaign (none without one), the '
  'same facets of the base plus G1, G2, G8, G9, G10 checked by search.check_identified_search_filters(). '
  'Returns the account and published_at (the order of 0320). SECURITY INVOKER owned by '
  'influx_creator_search_definer, executed by its owner and influx_agent_search_definer only.';

revoke all on function search.creator_candidates(text, uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;

-- one engine (RG4): the order, the closed entry of the base and the admission run for the identified
-- door too, under the rights of its owner
grant execute on function search.creator_candidates(text, uuid, jsonb, uuid),
                          search.creator_order(uuid[], jsonb, text, uuid, integer, integer, date),
                          search.check_creator_search_filters(jsonb),
                          search.is_admitted_campaign(uuid, uuid)
   to influx_agent_search_definer;

reset role;
revoke create on schema search from influx_creator_search_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_search_definer', current_user);
end
$$;

-- 5. The helpers and the door of the agent, as influx_agent_search_definer (03 P7 rule 5) ---------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_agent_search_definer', current_user);
end
$$;
grant create on schema search to influx_agent_search_definer;
set role influx_agent_search_definer;

-- 5.1 The caller (modele §1; the rule of campaigns.require_campaign_agent)
create or replace function search.require_identified_searcher()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_caller  uuid := influx.current_account_id();
  v_role    text := influx.current_account_role()::text;
begin
  if v_caller is null
     or not influx.has_aal2()
     or v_role is null
     or v_role not in ('agent', 'admin')
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role::text = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller
             and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return v_caller;
end
$$;

comment on function search.require_identified_searcher() is
  'l3g/modele.md §1 (0328; fiche L3G invariant 2, TM12.5): the account of a session that may search '
  'the creators in the identified view: an active account holding the role agent or admin of its '
  'session, an active internal profile, aal2; 42501 forbidden otherwise. SECURITY INVOKER owned by '
  'influx_agent_search_definer, executed by its owner only.';

-- 5.2 The closed entry of the filters (modele §2; 10 RG16, RG17, RG72)
create or replace function search.check_identified_search_filters(p_filters jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  c_g      constant text[] := array['G1', 'G2', 'G8', 'G9', 'G10'];
  v_key    text;
  v_value  jsonb;
  v_ok     boolean;
begin
  if p_filters is null or pg_catalog.jsonb_typeof(p_filters) is distinct from 'object'
     or pg_catalog.pg_column_size(p_filters) > 2000 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'filters';
  end if;
  -- the base, by the brand's closed entry (one engine, the same facets: RG71)
  perform search.check_creator_search_filters(p_filters - c_g);

  for v_key, v_value in
    select e.key, e.value from pg_catalog.jsonb_each(p_filters) e where e.key = any (c_g)
  loop
    v_ok := true;
    if v_key = 'G9' then
      -- the residence: a country, and regions of that country (EC-L3G-04-10)
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'object'
         or not (v_value ? 'country')
         or exists (select 1 from pg_catalog.jsonb_object_keys(v_value) k
                     where k not in ('country', 'regions'))
         or pg_catalog.jsonb_typeof(v_value -> 'country') is distinct from 'string'
         or not ((v_value ->> 'country') ~ '^[A-Z]{2}$') then
        v_ok := false;
      elsif v_value ? 'regions' then
        if pg_catalog.jsonb_typeof(v_value -> 'regions') is distinct from 'array'
           or pg_catalog.jsonb_array_length(v_value -> 'regions') not between 1 and 20 then
          v_ok := false;
        elsif exists (select 1 from pg_catalog.jsonb_array_elements(v_value -> 'regions') x
                       where pg_catalog.jsonb_typeof(x) is distinct from 'string') then
          v_ok := false;
        elsif exists (select 1 from pg_catalog.jsonb_array_elements_text(v_value -> 'regions') x
                       where not (x ~ '^[A-Z]{2}-[A-Z0-9]{1,8}$')
                          or pg_catalog.left(x, 3) <> (v_value ->> 'country') || '-')
              or (select count(distinct x)
                    from pg_catalog.jsonb_array_elements_text(v_value -> 'regions') x)
                 <> pg_catalog.jsonb_array_length(v_value -> 'regions') then
          v_ok := false;
        end if;
      end if;
    else
      -- G1, G2, G8, G10: a list of 1 to 20 values without duplicate (OR inside, RG17)
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'array'
         or pg_catalog.jsonb_array_length(v_value) not between 1 and 20 then
        v_ok := false;
      elsif exists (select 1 from pg_catalog.jsonb_array_elements(v_value) x
                     where pg_catalog.jsonb_typeof(x) is distinct from 'string') then
        v_ok := false;
      elsif exists (select 1 from pg_catalog.jsonb_array_elements_text(v_value) x
                     where case v_key
                             when 'G1' then x not in ('individual', 'business')
                             when 'G2' then x not in ('draft', 'pending_review', 'published',
                                                      'rejected', 'suspended')
                             when 'G8' then
                               not (x ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
                             else not (x ~ '^[A-Za-z0-9_]{1,64}$')
                           end)
            or (select count(distinct x) from pg_catalog.jsonb_array_elements_text(v_value) x)
               <> pg_catalog.jsonb_array_length(v_value) then
        v_ok := false;
      end if;
    end if;
    if not coalesce(v_ok, false) then
      raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'filters';
    end if;
  end loop;
end
$$;

comment on function search.check_identified_search_filters(jsonb) is
  'l3g/modele.md §2 (0328; 10 RG16, RG17, RG72): the closed entry of the filters of the identified '
  'view. An object of 2 000 bytes at most; its keys but G checked by '
  'search.check_creator_search_filters() (the base, open in table); G1 individual, business; G2 '
  'draft, pending_review, published, rejected, suspended; G8 lowercase uuids; G10 sector codes; '
  'lists of 1 to 20 without duplicate; G9 {country, regions?} (two capitals; 1 to 20 regions of that '
  'country). G is never in facet_settings nor versioned. 22023 DETAIL filters otherwise. SECURITY '
  'INVOKER owned by influx_agent_search_definer, executed by its owner only.';

-- 5.3 The row of a creator (modele §1; 10 RG71; fiche invariants 6, 12)
create or replace function search.identified_creator_row(
  p_account_id             uuid,
  p_advertiser_account_id  uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
           'accountId',      p.account_id::text,
           'alias',          p.alias,
           'status',         p.status::text,
           'declaredStatus', a.declared_status::text,
           'legalName',      nullif(pg_catalog.concat_ws(' ', i.legal_first_name, i.legal_last_name), ''),
           'city',           i.city,
           'residence',      pg_catalog.jsonb_build_object(
                               'country', p.residence_country_code::text,
                               'region',  p.residence_region_code),
           'ownerAgent',
             case when a.owner_agent_id is not null then
               pg_catalog.jsonb_build_object(
                 'accountId', a.owner_agent_id::text,
                 'firstName', (select g.first_name from identity.agent_profiles g
                                where g.account_id = a.owner_agent_id))
             end,
           'refusedSectors',
             coalesce((select pg_catalog.jsonb_agg(r.sector_code order by r.sector_code)
                         from profiles.creator_refused_sectors r
                        where r.account_id = p.account_id), '[]'::jsonb),
           -- RG71, 17b l. 869: the pair blocked with the brand of the campaign, never its motive nor
           -- its author; false without a campaign
           'blocked',
             coalesce(p_advertiser_account_id is not null
                      and exists (select 1 from matching.party_blocks b
                                   where b.advertiser_account_id = p_advertiser_account_id
                                     and b.creator_account_id = p.account_id
                                     and b.lifted_at is null), false),
           -- every line, its exact figures by the rule of the creator record (account-creator/
           -- repository.ts, EXACT_FIGURES_JOINS): observed by the holding audience badge, dated by
           -- its grant, else declared, dated by their measure
           'networks',
             coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                'network',         n.network_code::text,
                                'isPrimary',       n.is_primary,
                                'pseudonym',       n.pseudonym,
                                'handle',          n.handle,
                                'profileUrl',      n.profile_url,
                                'followers',       f.followers,
                                'postsLast30Days', f.posts,
                                'avgComments',     f.comments,
                                'engagementBp',    f.engagement,
                                'measuredAt',
                                  pg_catalog.to_char(pg_catalog.timezone('UTC', f.measured_at),
                                                     'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                                'source',          f.source,
                                'badge',
                                  (select pg_catalog.jsonb_build_object('level', b.level::text,
                                                                        'state', b.state::text)
                                     from verification.badges b
                                    where b.account_id = n.account_id
                                      and b.social_account_id = n.id
                                      and b.level in ('account_verified', 'audience_verified')
                                      and b.state in ('active', 'to_refresh')
                                    order by (b.level::text = 'audience_verified') desc,
                                             (b.state::text = 'active') desc, b.granted_at desc
                                    limit 1))
                              order by n.is_primary desc, n.network_code, n.id)
                         from profiles.creator_social_accounts n
                         left join lateral (
                           select o.granted_at, o.observed_followers, o.observed_posts_last_30_days,
                                  o.observed_avg_comments, o.observed_engagement_bp
                             from verification.badges o
                            where o.account_id = n.account_id and o.social_account_id = n.id
                              and o.level = 'audience_verified' and o.state in ('active', 'to_refresh')
                            order by o.granted_at desc
                            limit 1) h on true
                         cross join lateral (
                           select case when h.granted_at is null then n.followers_count
                                       else h.observed_followers end as followers,
                                  case when h.granted_at is null then n.posts_last_30_days
                                       else h.observed_posts_last_30_days end as posts,
                                  case when h.granted_at is null then n.avg_comments_per_post
                                       else h.observed_avg_comments end as comments,
                                  case when h.granted_at is null then n.engagement_rate_bp
                                       else h.observed_engagement_bp end as engagement,
                                  case when h.granted_at is null then n.figures_measured_at
                                       else h.granted_at end as measured_at,
                                  case when h.granted_at is null then 'declared'
                                       else 'agent_observed' end as source) f
                        where n.account_id = p.account_id), '[]'::jsonb),
           -- the main country of the audience and the exact share of slot 0 of the primary line
           'mainAudience',
             case when p.main_audience_country is not null then
               pg_catalog.jsonb_build_object(
                 'country',      p.main_audience_country::text,
                 'sharePercent', (select c.share_percent
                                    from profiles.creator_social_accounts n
                                    join profiles.creator_audience_countries c
                                      on c.social_account_id = n.id and c.account_id = n.account_id
                                   where n.account_id = p.account_id and n.is_primary and c.slot = 0))
             end)
    from profiles.creator_public_profiles p
    join identity.accounts a on a.id = p.account_id
    left join profiles.creator_identities i on i.account_id = p.account_id
   where p.account_id = p_account_id
$$;

comment on function search.identified_creator_row(uuid, uuid) is
  'l3g/modele.md §1 (0328; 10 RG71; D46, D78): the row of the identified view for the creator '
  'p_account_id: accountId, alias, status (G2), declaredStatus (G1), legalName, city (layer N, D79), '
  'residence {country, region} (G9), ownerAgent {accountId, firstName} (G8), refusedSectors (G10), '
  'blocked (an active block of the pair with p_advertiser_account_id, false without one; never its '
  'motive nor its author), networks [{network, isPrimary, pseudonym, handle, profileUrl, followers, '
  'postsLast30Days, avgComments, engagementBp, measuredAt, source, badge}] (every line, the exact '
  'figures of the creator record: observed by the holding audience badge, else declared), '
  'mainAudience {country, sharePercent}. Never a contact detail nor an address, a rate nor a budget. '
  'SECURITY INVOKER owned by influx_agent_search_definer, executed by its owner only.';

-- 5.4 The door (modele §1, §3; 10 RG4, RG62, RG71, RG72, RG78; CA58, CA61; TM12.5)
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

  -- the prefill of a campaign comes with 0329 (modele §4)
  if p_prefill_id is not null then
    raise exception 'prefill_not_available' using errcode = 'feature_not_supported', detail = 'prefill';
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
       facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
    values (v_caller, v_role, 'agent_identified', p_campaign_id, 'page_cap', p_filters, p_sort,
            v_version, 0, p_page, false, v_request);
    return pg_catalog.jsonb_build_object('state', 'page_cap');
  end if;

  -- RG4, RG71: the candidates of the one engine, its identified mode; no k (RG62), no switch (CA61)
  select coalesce(pg_catalog.array_agg(c.creator_account_id), '{}'::uuid[])
    into v_ids
    from search.creator_candidates('agent_identified', v_brand, p_filters, p_campaign_id) c;
  v_count := pg_catalog.cardinality(v_ids);

  -- RG78, CA58: the search, nominative, then its impressions and their reasons, in the transaction
  -- that serves; the exact count kept
  insert into search.search_queries
    (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
     facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
  values (v_caller, v_role, 'agent_identified', p_campaign_id, 'served', p_filters, p_sort,
          v_version, v_count, p_page, false, v_request)
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
  '10 RG4, RG62, RG71, RG72, RG76, RG78 (0328; l3g/modele.md §1 to §3; CA58, CA61; 18 TM12.5): a page '
  'of the identified creator search of an INFLUX agent (search.require_identified_searcher: agent or '
  'admin, active account and internal profile, aal2; 42501 otherwise). p_sort default, audience, '
  'verified_first, new_profiles and p_page 1 to 50 (22023 DETAIL sort or page); the filters '
  '(search.check_identified_search_filters, 22023 DETAIL filters); the campaign (admitted for its '
  'brand by search.is_admitted_campaign, otherwise P0002 DETAIL campaign); p_prefill_id not NULL '
  '0A000 DETAIL prefill until 0329; identified_view missing 55000. Nothing written by an error. A '
  'page beyond maxPages {state: page_cap}; otherwise {state: results, total (exact), page, nextPage, '
  'capReached, rows: [search.identified_creator_row() || {reasons, vigilance}]}, pageSize rows in the '
  'order of search.creator_order() for the UTC day, from search.creator_candidates(agent_identified). '
  'Neither switch, k, bucket nor lock. Every outcome but an error writes its line of '
  'search.search_queries (actor_role agent or admin, view_mode agent_identified, exact count), a '
  'served page its impressions and their reasons, in the transaction that serves; never '
  'search.creator_exposures. SECURITY DEFINER owned by influx_agent_search_definer, empty '
  'search_path; EXECUTE for influx_agent and influx_admin only.';

-- 5.5 Rights on the functions (03 P7 rule 5), then the owner given back
revoke all on function search.require_identified_searcher()
  from public, anon, authenticated, service_role;
revoke all on function search.check_identified_search_filters(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function search.identified_creator_row(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.search_creators_identified(jsonb, text, integer, uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function search.search_creators_identified(jsonb, text, integer, uuid, uuid)
   to influx_agent, influx_admin;

reset role;
revoke create on schema search from influx_agent_search_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_agent_search_definer', current_user);
end
$$;

-- the agent reaches the schema search for the door (USAGE, nothing else in it; influx_admin holds it
-- since 0316)
grant usage on schema search to influx_agent;

-- 6. AL21 counts the brand view alone (modele §1, EC-L3G-5) -----------------------------------------

grant select (view_mode) on search.search_queries to influx_search_admin_definer;

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
    -- 0328 (EC-L3G-5): the brand view alone; the identified view of the agents waits for its own
    -- thresholds (Lot 5, l3e/modele.md §10)
    select q.id, q.account_id, q.outcome, q.created_at
      from search.search_queries q
     where q.created_at > pg_catalog.now() - interval '24 hours'
       and q.view_mode = 'advertiser_anonymous'
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
       and q.view_mode = 'advertiser_anonymous'
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
  '15 AL21 (I-9; 10 RG68, CA45, CA46; l3e/modele.md §10, l3f/modele.md §7, l3g/modele.md §1; 0321, '
  '0326, 0328): one row per account and cause over the journal of the BRAND view '
  '(advertiser_anonymous; the identified view of the agents waits for its thresholds, Lot 5) of 24 '
  'sliding hours. distinct_profiles_served: the creators served (impressions and openings) exceed '
  'distinct_profiles_served_24h; rate_cap_share_hour, rate_cap_share_day: the searches reach '
  'rate_cap_share_bp of perHour or perDay; open_cap_share_day: the openings reach it of '
  'profileOpensPerDay; rate_limited: a refusal of a search or an opening; refinement: the '
  'refinement_searches last new searches vary by one facet each, refinement_blocked of them below k; '
  'aspiration: the accounts opening without adding to a shortlist nor asking for a selection opened, '
  'together, aspiration_profiles_24h distinct creators. A count and the oldest line; never a filter, '
  'an alias nor a creator. STABLE SECURITY DEFINER owned by influx_search_admin_definer, EXECUTE for '
  'influx_admin only; 42501 outside an active admin in aal2. A state alert: nothing stored.';

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

-- 7. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  c_dynamic  constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner    constant text := 'influx_agent_search_definer';
  c_brand    constant text := 'influx_creator_search_definer';
  c_door     constant text := 'search.search_creators_identified(jsonb, text, integer, uuid, uuid)';
  c_engine   constant text := 'search.creator_candidates(text, uuid, jsonb, uuid)';
  v_def      record;
  v_bad      text;
begin
  -- the role: no login, no inheritance, no member, no CREATE left
  if exists (select 1 from pg_catalog.pg_roles r
              where r.rolname = c_owner
                and (r.rolcanlogin or r.rolinherit or r.rolsuper or r.rolbypassrls))
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE')
     or pg_catalog.has_schema_privilege(c_brand, 'search', 'CREATE')
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid = c_brand::regrole and (m.inherit_option or m.set_option)) then
    raise exception '% must be NOLOGIN NOINHERIT, without member nor CREATE (03 P7)', c_owner;
  end if;

  -- the door and its helpers: owner, mode, empty search_path
  for v_def in
    select * from (values
      ('search.require_identified_searcher()', false),
      ('search.check_identified_search_filters(jsonb)', false),
      ('search.identified_creator_row(uuid, uuid)', false),
      (c_door, true)) as d (fn, definer)
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
  if (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
       where p.oid = c_engine::regprocedure) <> c_brand
     or (select p.prosecdef from pg_catalog.pg_proc p where p.oid = c_engine::regprocedure) then
    raise exception 'the engine stays an invoker helper of %', c_brand;
  end if;

  -- EXECUTE (TM12.5, fiche invariant 2): the door to influx_agent and influx_admin, the helpers of
  -- the agent's owner to nobody, the four helpers of the brand's owner to the agent's owner alone
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.proowner in (c_owner::regrole, c_brand::regrole)
     and p.oid not in (select q.oid from pg_catalog.pg_proc q
                        where q.proowner = c_brand::regrole and q.prosecdef)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (p.oid = c_door::regprocedure
              and a.grantee in ('influx_agent'::regrole, 'influx_admin'::regrole))
     and not (a.grantee = c_owner::regrole
              and p.oid in (c_engine::regprocedure,
                            'search.creator_order(uuid[], jsonb, text, uuid, integer, integer, date)'
                              ::regprocedure,
                            'search.check_creator_search_filters(jsonb)'::regprocedure,
                            'search.is_admitted_campaign(uuid, uuid)'::regprocedure));
  if v_bad is not null then
    raise exception 'executable beyond their callers: %', v_bad;
  end if;
  if pg_catalog.has_function_privilege('influx_advertiser', c_door, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_creator', c_door, 'EXECUTE')
     or not pg_catalog.has_function_privilege('influx_agent', c_door, 'EXECUTE')
     or not pg_catalog.has_function_privilege('influx_admin', c_door, 'EXECUTE') then
    raise exception 'TM12.5: the identified door is executed by influx_agent and influx_admin alone';
  end if;

  -- 03 P7, fiche invariant 3: no dynamic SQL in a function of either owner
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner in (c_owner::regrole, c_brand::regrole) and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'a function of the creator search runs dynamic SQL: %', v_bad;
  end if;

  -- T1-R (fiche invariant 3; modele -1): the engine, reached by the brand, names no relation of
  -- layer I; the brand's owner holds no column of G nor of layer I
  if (select p.prosrc from pg_catalog.pg_proc p where p.oid = c_engine::regprocedure)
       ~* 'creator_identities|creator_social_accounts|creator_audience_|creator_network_metrics|agent_profiles' then
    raise exception 'T1-R: the engine names a relation of layer I';
  end if;
  if pg_catalog.has_column_privilege(c_brand, 'identity.accounts', 'declared_status', 'SELECT')
     or pg_catalog.has_column_privilege(c_brand, 'identity.accounts', 'owner_agent_id', 'SELECT')
     or pg_catalog.has_any_column_privilege(c_brand, 'identity.agent_profiles', 'SELECT')
     or pg_catalog.has_any_column_privilege(c_brand, 'profiles.creator_identities', 'SELECT')
     or pg_catalog.has_any_column_privilege(c_brand, 'profiles.creator_social_accounts', 'SELECT')
     or pg_catalog.has_any_column_privilege(c_brand, 'profiles.creator_audience_countries', 'SELECT') then
    raise exception 'modele -1: the brand''s owner holds a column of G or of layer I';
  end if;

  -- D46, D78: the agent's owner never reads a contact detail, an address, a reach nor leads.*
  select string_agg(at.attrelid::regclass::text || '.' || at.attname, ', ') into v_bad
    from pg_catalog.pg_attribute at
   where at.attnum > 0 and not at.attisdropped
     and pg_catalog.has_column_privilege(c_owner, at.attrelid, at.attnum, 'SELECT')
     and ((at.attrelid = 'profiles.creator_identities'::regclass
           and at.attname in ('contact_email', 'contact_phone', 'address_line', 'postal_code',
                              'country_code', 'completeness_percent'))
          or (at.attrelid = 'profiles.creator_public_profiles'::regclass
              and at.attname = 'public_ref')
          or at.attrelid in (select c.oid from pg_catalog.pg_class c
                              where c.relnamespace = 'leads'::regnamespace)
          or at.attrelid in ('profiles.advertiser_contact_details'::regclass,
                             'profiles.advertiser_internal_details'::regclass,
                             'profiles.creator_network_metrics_history'::regclass));
  if v_bad is not null then
    raise exception 'influx_agent_search_definer reads what the view never serves: %', v_bad;
  end if;

  -- the agent's owner writes its journal only, never the exposures (RG87), outbox nor matching.*
  select string_agg(c.oid::regclass::text, ', ' order by c.oid::regclass::text) into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema')
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'INSERT, UPDATE'))
     and c.oid not in ('search.search_queries'::regclass, 'search.search_impressions'::regclass,
                       'search.impression_reasons'::regclass);
  if v_bad is not null then
    raise exception 'influx_agent_search_definer writes beyond its journal: %', v_bad;
  end if;

  -- the setting of the pages
  if not exists (select 1 from search.search_settings where key = 'identified_view') then
    raise exception 'search.search_settings must hold identified_view';
  end if;

  -- AL21: its owner reads the view of a line, and counts the brand view alone
  if not pg_catalog.has_column_privilege('influx_search_admin_definer', 'search.search_queries',
                                         'view_mode', 'SELECT')
     or (select p.prosrc from pg_catalog.pg_proc p
          where p.oid = 'search.creator_search_volume_alerts()'::regprocedure)
        !~ 'q\.view_mode = ''advertiser_anonymous''' then
    raise exception 'EC-L3G-5: AL21 must count the brand view alone';
  end if;
end
$$;
