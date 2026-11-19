-- =============================================================================
-- 0319_search_creator_search_door
-- -----------------------------------------------------------------------------
-- Lot 3 / L3E, commit 06 (jalons/l3e/06.md; l3e-fiche.md invariants 1 to 6, 9 to 16;
-- jalons/l3e/modele.md §1 to §5, §8, §9, which PREVAILS for every name; 10 RG1, RG2, RG4, RG12,
-- RG17, RG26 to RG31, RG57 to RG59, RG63 to RG66; 18 TM12.1, TM12.2, TM12.4, T15.2). The brand's
-- anonymous search of creators: ONE door of the schema search, its engine and the source of its
-- card. Signalled I-4 (03): a new definer role, a SECURITY DEFINER door, GRANTs, policies, a function
-- of profiles executable by influx_creator.
--
-- 1. influx_creator_search_definer: NOLOGIN NOINHERIT, no member (modele §1, D81 (5)), added to the
--    closed list of 03 P7. Owner of the door and of its four invoker helpers; distinct from
--    influx_creator_profile_definer (L2GS-5), from influx_campaign_feed_definer and from
--    influx_search_admin_definer (a member door never reaches a setting it could write).
-- 2. profiles.creator_layer_a(account) (modele §2): THE source of layer A, the SQL of
--    readProjectionLayerA() moved as it is (projection/repository.ts calls it, the preview
--    unchanged); SECURITY INVOKER, STABLE, owned by the migration role, EXECUTE for influx_creator
--    and the owner of the door. It still returns the status and the key of each line: the door
--    serves the card without them.
-- 3. What the owner reads and writes, column by column, each right with its own policy: its caller
--    (account, role) and the creator accounts (status, majority); its brand profile (status, main
--    sector) and secondary sectors; its campaigns (id, sector, erasure); layer A of the PUBLISHED and
--    SEARCHABLE storefronts (the storefront, its lists, its listed lines, its audience bands, its
--    approved visuals by reference, the holding badges of its lines); their refused sectors (E6,
--    never served); the pair and lifted_at of the active blocks of the caller (E5, its own policy,
--    distinct from party_blocks_privacy_definer_*); five keys of search.search_settings, the open
--    facets, the latest version, the reasons; its own lines of the journal (the bucket, and their
--    insertion), the impressions of its lines, the exposures of the storefronts it serves (their
--    key read, INSERT only). EXECUTE on search.result_count_band() and profiles.creator_layer_a().
--    NEVER layer I (the
--    identity, the lines, the exact audience, the history), public_ref, the region (RG37), leads.*,
--    a band or a budget of a campaign, a coordinate nor an internal block.
-- 4. The helpers, SECURITY INVOKER, executed by their owner only:
--      search.require_creator_searcher()  the caller: the role advertiser, an active account holding
--            it; 42501 otherwise.
--      search.creator_search_retry_after(account)  the bucket (modele §8, pattern 0315): a
--            transaction lock per account, the lines but rate_limited counted on 1 h and 24 h
--            sliding against rate_limits; (NULL, false) within both, otherwise the seconds and
--            whether to journal the refusal (no rate_limited line in the window that refuses).
--      search.check_creator_search_filters(filters)  the closed entry of modele §3: a key per open
--            facet of the base, its shape; 22023 filters otherwise.
--      search.creator_candidates(mode, advertiser, filters, campaign)  THE engine (RG4): the
--            storefronts that pass E1 to E6 and the filters of RG17, in SQL, before any count;
--            agent_identified 0A000 until L3G.
-- 5. search.search_creators(filters, sort, page, campaign) (modele §1, §4, §5): SECURITY DEFINER,
--    empty search_path, EXECUTE for influx_advertiser ONLY, no dynamic SQL. In order: the caller
--    (42501), the domain of sort and page (22023), RG1 {state: brand_not_published}, D38 {state:
--    closed} (nothing written nor counted), the bucket {state: rate_limited, retryAfterSeconds}, the
--    filters (22023) and the campaign (P0002), the cap {state: page_cap}, the count after the
--    exclusions: below k {state: too_narrow} and nothing else, otherwise {state: results, countBand,
--    page, nextPage, capReached, cards: [{creator, reasons, vigilance}]}. Every outcome but closed
--    and brand_not_published writes its line of search.search_queries in the transaction that
--    serves, and a served page its impressions and, on page 1, its exposures (CA47, CA48): a write
--    refused, nothing served. The order is the provisional tier 8 alone (0320 completes it).
-- 6. influx_advertiser: USAGE on search and EXECUTE on the door; nothing else on search, nothing on
--    profiles.creator_*, matching nor verification.
--
-- RIGHTS (03 I-4, signalled): a new role; USAGE on search, profiles, identity, influx, campaigns,
-- matching and verification to it; column GRANTs and their policies to it on identity.accounts,
-- account_roles, profiles.advertiser_profiles, advertiser_secondary_sectors, campaigns.campaigns,
-- profiles.creator_public_profiles, creator_public_networks, creator_topics, creator_tones,
-- creator_publication_languages, creator_formats, creator_usage_rights, creator_public_audience,
-- creator_refused_sectors, portfolio_items, verification.badges, matching.party_blocks,
-- search.search_settings, facet_settings, facet_config_versions, explanation_reasons,
-- search_queries, search_impressions, creator_exposures; EXECUTE on influx.current_account_id(),
-- current_account_role(), search.result_count_band() and profiles.creator_layer_a() to it;
-- profiles.creator_layer_a() to influx_creator; USAGE on search and the door to influx_advertiser.
--
-- Not here: the route, the contract, the rate per address (L3E-08), the order of tiers 1 to 7, the
-- cold quota, the reasons and the vigilance (0320), the image of a visual, the shortlists, the
-- opening of a profile (L3F), the identified view (L3G), AL21 (0321), the purge (Lot 6).
--
-- EC-L3E-06 (micro-gaps, the safest choice):
--   EC-L3E-06-1  the domain of sort and page (the contract) is checked first, as 0314 (EC-L3D-02-4):
--                a rate_limited line names them; the filters and the campaign come after the
--                bucket, as modele §4 orders them.
--   EC-L3E-06-2  three helpers more than modele §1 names (require_creator_searcher,
--                creator_search_retry_after, check_creator_search_filters), invoker and executed by
--                nobody: one caller check, one bucket, one closed entry for the door of L3G too.
--   EC-L3E-06-3  the switch missing reads as closed (the safe side, nothing listed); a setting of
--                the page, of k or of the bucket missing is 55000 creator_search_settings.
--   EC-L3E-06-4  a value of a filter is a code by its shape (^[A-Za-z0-9_]{1,64}$, the country of F6
--                ^[A-Z]{2}$), F17 and the shares of F6 closed lists, a list of 1 to 20 values
--                without duplicate; a code absent from the reference matches nothing (the door
--                reads no reference list); filters over 2 000 bytes: 22023 (the CHECK of the journal).
--   EC-L3E-06-5  F17 holds on any listed line (modele §3, « d'une ligne listée »), not on the line of
--                F3; a badge holds while active or to_refresh.
--   EC-L3E-06-6  a rate_limited line keeps no campaign, as it keeps no filter (modele §9): the
--                campaign is checked after the bucket.
--   EC-L3E-06-7  until 0320, a card carries reasons [] and vigilance null, and every sort serves the
--                order of tier 8 alone (md5 of the UTC day and the account, then the account).
--   EC-L3E-06-8  the owner reads the APPROVED visuals by reference (id, order, caption; modele §2,
--                image at L3F): the one right of a role the advertiser reaches on an L2G table, named
--                as such in T9.6 (t9-evidence-unreachable).
--   EC-L3E-06-9  the rank of an impression is its place in the whole order ((page - 1) x page_size +
--                position); a page beyond the results is served with no card and no impression.
--   EC-L3E-06-10 the owner reads the key of search.creator_exposures (creator_account_id, bounded
--                to the storefronts it may serve): ON CONFLICT DO NOTHING reads the key of its
--                arbiter; first_page_at stays unread until 0320.
--   EC-L3E-06-11 three expectations of earlier files follow the door: T1-R (NEVER_EXCEPTED reduced
--                to layer I, its ten couples declared; modele EC-L3E-A-1), L3E-T3 (the brand
--                executes search.search_creators()) and T9.6 L2G (EC-L3E-06-8); for expert-cybersecurite.
--                The pinned lists of T2, T4 and L3B-T3 (USAGE on campaigns) gain the new owner.
--
-- ROLLBACK (before any search is journaled once 0319 is applied): drop the door and its four
-- helpers; drop function profiles.creator_layer_a(uuid) (projection/repository.ts back to its 0318
-- SQL); drop the policies *_creator_search_definer_* and revoke their grants; revoke usage on schema
-- search and execute on the door from influx_advertiser; revoke execute on
-- search.result_count_band(integer) from the owner; drop role influx_creator_search_definer.
-- =============================================================================

-- 1. The owner of the door (03 P7 rule 5; rules 1 and 2 of 0001; modele §1) -------------------------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_creator_search_definer') then
    create role influx_creator_search_definer with nologin noinherit;
  end if;
  alter role influx_creator_search_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_search_definer' and rolsuper) then
    raise exception 'role influx_creator_search_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_search_definer' and rolbypassrls) then
    alter role influx_creator_search_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_search_definer' and rolreplication) then
    alter role influx_creator_search_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_search_definer' and rolcreatedb) then
    alter role influx_creator_search_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_search_definer' and rolcreaterole) then
    alter role influx_creator_search_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. THE source of layer A (modele §2; fiche invariant 2; 07 RG102, RG104) ----------------------------
-- The query of readProjectionLayerA() (0244, l2g/modele point 9) as it was, keys and order unchanged:
-- the preview of the creator reads it under its own rights, the door under those of its owner.

create or replace function profiles.creator_layer_a(p_account_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
           'status',                   p.status::text,
           'alias',                    p.alias,
           'headline',                 p.headline,
           'bio',                      p.bio,
           'primary_topic',            p.primary_topic_code,
           'residence_country',        p.residence_country_code::text,
           'travel_scope',             p.travel_scope,
           'collaboration_experience', p.collaboration_experience_band,
           'main_audience_country',    p.main_audience_country::text,
           'main_audience_share_band', p.main_audience_share_band,
           'audience_gender_band',     p.audience_gender_band,
           'delivery_lead',            p.delivery_lead_band,
           'max_exclusivity',          p.max_exclusivity_band,
           'accepts_non_monetary',     p.accepts_non_monetary,
           'availability',             p.availability_band,
           'secondary_topics',
             coalesce((select pg_catalog.jsonb_agg(t.topic_code::text order by t.slot)
                         from profiles.creator_topics t where t.account_id = p.account_id),
                      '[]'::jsonb),
           'tones',
             coalesce((select pg_catalog.jsonb_agg(t.tone_code::text order by t.slot)
                         from profiles.creator_tones t where t.account_id = p.account_id),
                      '[]'::jsonb),
           'publication_languages',
             coalesce((select pg_catalog.jsonb_agg(l.language_code::text order by l.slot)
                         from profiles.creator_publication_languages l
                        where l.account_id = p.account_id), '[]'::jsonb),
           'formats',
             coalesce((select pg_catalog.jsonb_agg(f.format_code::text order by f.format_code)
                         from profiles.creator_formats f where f.account_id = p.account_id),
                      '[]'::jsonb),
           'usage_rights',
             coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                'code', u.usage_right_code::text, 'inclusion', u.inclusion)
                              order by u.usage_right_code)
                         from profiles.creator_usage_rights u where u.account_id = p.account_id),
                      '[]'::jsonb),
           'audience_bands',
             coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                'dimension', a.dimension, 'code', a.bucket,
                                'shareBand', a.share_band)
                              order by a.dimension, a.bucket)
                         from profiles.creator_public_audience a where a.account_id = p.account_id),
                      '[]'::jsonb),
           'lines',
             coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                'lineKey', c.social_account_id::text,
                                'networkCode', c.network_code::text,
                                'isPrimary', c.is_primary,
                                'audienceBand', c.audience_band,
                                'reachBand', c.reach_band,
                                'publicationFrequency', c.publication_frequency_code,
                                'commentBand', c.comment_band,
                                'engagementBand', c.engagement_band,
                                'figuresSource', c.figures_source,
                                'figuresMeasuredAt',
                                  pg_catalog.to_char(pg_catalog.timezone('UTC', c.figures_measured_at),
                                                     'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
                                'badges',
                                  coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                                     'level', b.level::text,
                                                     'since', pg_catalog.to_char(
                                                                pg_catalog.timezone('UTC', b.granted_at),
                                                                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
                                                   order by b.level, b.granted_at)
                                              from verification.badges b
                                             where b.account_id = c.account_id
                                               and b.social_account_id = c.social_account_id
                                               and b.level in ('account_verified', 'audience_verified')
                                               and b.state in ('active', 'to_refresh')),
                                           '[]'::jsonb))
                              order by c.is_primary desc, c.created_at, c.social_account_id)
                         from profiles.creator_public_networks c
                        where c.account_id = p.account_id
                          and (c.listed_at is not null or p.published_at is null)),
                      '[]'::jsonb),
           'visuals',
             coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                'id', v.id::text, 'caption', v.caption)
                              order by v.display_order nulls last, v.created_at, v.id)
                         from profiles.portfolio_items v
                        where v.account_id = p.account_id and v.state = 'approved'),
                      '[]'::jsonb))
    from profiles.creator_public_profiles p
   where p.account_id = p_account_id
$$;

comment on function profiles.creator_layer_a(uuid) is
  'l3e/modele.md §2 (0319; 07 RG102, RG104; fiche L3E invariant 2): THE source of layer A of the '
  'creator p_account_id, the query of readProjectionLayerA() moved as it was: the storefront, its '
  'lists, its projected lines (listed, or every line of a profile never published) with the holding '
  'badges, its audience bands and its approved visuals (id, caption), plus its status and the key of '
  'each line (lineKey), which never leave apps/api nor the door; NULL without a storefront the '
  'caller may read. Never the identity, a handle, a URL, an exact figure, public_ref nor the region. '
  'SECURITY INVOKER (the rights of the caller decide what it reads) owned by the migration role; '
  'EXECUTE for influx_creator (the preview) and influx_creator_search_definer (the card of the door).';

revoke all on function profiles.creator_layer_a(uuid) from public, anon, authenticated, service_role;
grant execute on function profiles.creator_layer_a(uuid)
   to influx_creator, influx_creator_search_definer;

-- 3. What influx_creator_search_definer reads and writes (modele §1) -----------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner,
-- bounded to what the door needs (the caller's own rows, a published and searchable storefront).

grant usage on schema search, profiles, identity, influx, campaigns, matching, verification
   to influx_creator_search_definer;
grant execute on function influx.current_account_id(), influx.current_account_role()
   to influx_creator_search_definer;
grant execute on function search.result_count_band(integer) to influx_creator_search_definer;

-- 3.1 The caller (its role, its account) and the creator accounts: status and majority (E3, E4)
grant select (id, status, is_adult_attested) on identity.accounts to influx_creator_search_definer;
grant select (account_id, role) on identity.account_roles to influx_creator_search_definer;

drop policy if exists account_roles_creator_search_definer_select on identity.account_roles;
create policy account_roles_creator_search_definer_select on identity.account_roles
  for select to influx_creator_search_definer
  using (account_id = (select influx.current_account_id()) or role = 'creator');

drop policy if exists accounts_creator_search_definer_select on identity.accounts;
create policy accounts_creator_search_definer_select on identity.accounts
  for select to influx_creator_search_definer
  using (id = (select influx.current_account_id())
         or exists (select 1 from identity.account_roles r
                     where r.account_id = accounts.id and r.role = 'creator'));

-- 3.2 The caller's brand profile (RG1) and its sectors (E6), its own campaigns (the origin, its sector)
grant select (account_id, status, primary_sector_code)
   on profiles.advertiser_profiles to influx_creator_search_definer;
grant select (account_id, sector_code)
   on profiles.advertiser_secondary_sectors to influx_creator_search_definer;
grant select (id, advertiser_account_id, sector_code, erased_at)
   on campaigns.campaigns to influx_creator_search_definer;

drop policy if exists advertiser_profiles_creator_search_definer_select on profiles.advertiser_profiles;
create policy advertiser_profiles_creator_search_definer_select on profiles.advertiser_profiles
  for select to influx_creator_search_definer
  using (account_id = (select influx.current_account_id()));

drop policy if exists advertiser_secondary_sectors_creator_search_definer_select
  on profiles.advertiser_secondary_sectors;
create policy advertiser_secondary_sectors_creator_search_definer_select
  on profiles.advertiser_secondary_sectors
  for select to influx_creator_search_definer
  using (account_id = (select influx.current_account_id()));

drop policy if exists campaigns_creator_search_definer_select on campaigns.campaigns;
create policy campaigns_creator_search_definer_select on campaigns.campaigns
  for select to influx_creator_search_definer
  using (advertiser_account_id = (select influx.current_account_id()));

-- 3.3 Layer A of a published and searchable storefront (E1, E2 held by the policy too): never
-- public_ref, the region (RG37), the dates of availability nor of the row
grant select (account_id, alias, status, is_searchable, published_at, headline, bio,
              primary_topic_code, residence_country_code, travel_scope,
              collaboration_experience_band, main_audience_country, main_audience_share_band,
              audience_gender_band, delivery_lead_band, max_exclusivity_band,
              accepts_non_monetary, availability_band)
   on profiles.creator_public_profiles to influx_creator_search_definer;

drop policy if exists creator_public_profiles_creator_search_definer_select
  on profiles.creator_public_profiles;
create policy creator_public_profiles_creator_search_definer_select
  on profiles.creator_public_profiles
  for select to influx_creator_search_definer
  using (status = 'published' and is_searchable);

-- its lists, its audience bands and its refused sectors (E6: a predicate, never served)
do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('creator_topics',                'account_id, slot, topic_code'),
      ('creator_tones',                 'account_id, slot, tone_code'),
      ('creator_publication_languages', 'account_id, slot, language_code'),
      ('creator_formats',               'account_id, format_code'),
      ('creator_usage_rights',          'account_id, usage_right_code, inclusion'),
      ('creator_public_audience',       'account_id, dimension, bucket, share_band'),
      ('creator_refused_sectors',       'account_id, sector_code')
    ) as v (name, columns)
  loop
    execute format('grant select (%s) on profiles.%I to influx_creator_search_definer',
                   l.columns, l.name);
    execute format('drop policy if exists %I on profiles.%I',
                   l.name || '_creator_search_definer_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_creator_search_definer '
                   'using (exists (select 1 from profiles.creator_public_profiles p '
                   'where p.account_id = %I.account_id and p.status = ''published'' '
                   'and p.is_searchable))',
                   l.name || '_creator_search_definer_select', l.name, l.name);
  end loop;
end
$$;

-- its LISTED lines (bands, codes, the date of the figures; the key ties the badges, never served)
grant select (social_account_id, account_id, network_code, is_primary, audience_band, reach_band,
              publication_frequency_code, comment_band, engagement_band, figures_source,
              figures_measured_at, created_at, listed_at)
   on profiles.creator_public_networks to influx_creator_search_definer;

drop policy if exists creator_public_networks_creator_search_definer_select
  on profiles.creator_public_networks;
create policy creator_public_networks_creator_search_definer_select
  on profiles.creator_public_networks
  for select to influx_creator_search_definer
  using (listed_at is not null
         and exists (select 1 from profiles.creator_public_profiles p
                      where p.account_id = creator_public_networks.account_id
                        and p.status = 'published' and p.is_searchable));

-- its APPROVED visuals, by reference (EC-L3E-06-8: never the object key, the bytes, the lock, the
-- decision nor the declaration)
grant select (id, account_id, state, caption, display_order, created_at)
   on profiles.portfolio_items to influx_creator_search_definer;

drop policy if exists portfolio_items_creator_search_definer_select on profiles.portfolio_items;
create policy portfolio_items_creator_search_definer_select on profiles.portfolio_items
  for select to influx_creator_search_definer
  using (state = 'approved'
         and exists (select 1 from profiles.creator_public_profiles p
                      where p.account_id = portfolio_items.account_id
                        and p.status = 'published' and p.is_searchable));

-- the holding badges « Compte vérifié » and « Audience vérifiée » of its lines (F17, the card)
grant select (account_id, social_account_id, level, state, granted_at)
   on verification.badges to influx_creator_search_definer;

drop policy if exists badges_creator_search_definer_select on verification.badges;
create policy badges_creator_search_definer_select on verification.badges
  for select to influx_creator_search_definer
  using (level in ('account_verified', 'audience_verified')
         and state in ('active', 'to_refresh')
         and exists (select 1 from profiles.creator_public_profiles p
                      where p.account_id = badges.account_id
                        and p.status = 'published' and p.is_searchable));

-- 3.4 E5: the pair and lifted_at of the caller's ACTIVE blocks, whoever posed them (10 RG28 to RG30:
-- never the reason, the comment nor who blocked); its own policy, beside the privacy definer's
grant select (advertiser_account_id, creator_account_id, lifted_at)
   on matching.party_blocks to influx_creator_search_definer;

drop policy if exists party_blocks_creator_search_definer_select on matching.party_blocks;
create policy party_blocks_creator_search_definer_select on matching.party_blocks
  for select to influx_creator_search_definer
  using (advertiser_account_id = (select influx.current_account_id()) and lifted_at is null);

-- 3.5 The settings read at every search: five keys, the facets, the version in force, the reasons
grant select (key, value) on search.search_settings to influx_creator_search_definer;
grant select (facet_code, wave, is_open) on search.facet_settings to influx_creator_search_definer;
grant select (version) on search.facet_config_versions to influx_creator_search_definer;
grant select (code, kind, tier, param_keys, is_active)
   on search.explanation_reasons to influx_creator_search_definer;

drop policy if exists search_settings_creator_search_definer_select on search.search_settings;
create policy search_settings_creator_search_definer_select on search.search_settings
  for select to influx_creator_search_definer
  using (key in ('is_open_to_advertisers', 'k_anonymity_threshold', 'page_size', 'max_pages',
                 'rate_limits'));
drop policy if exists facet_settings_creator_search_definer_select on search.facet_settings;
create policy facet_settings_creator_search_definer_select on search.facet_settings
  for select to influx_creator_search_definer using (true);
drop policy if exists facet_config_versions_creator_search_definer_select
  on search.facet_config_versions;
create policy facet_config_versions_creator_search_definer_select on search.facet_config_versions
  for select to influx_creator_search_definer using (true);
drop policy if exists explanation_reasons_creator_search_definer_select on search.explanation_reasons;
create policy explanation_reasons_creator_search_definer_select on search.explanation_reasons
  for select to influx_creator_search_definer using (true);

-- 3.6 The journal: the caller's own lines (the bucket counts them; a line is inserted, its id read
-- back), the impressions of its lines, the exposures of the storefronts it serves. INSERT only.
grant select (id, account_id, outcome, created_at),
      insert (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
              facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
   on search.search_queries to influx_creator_search_definer;
grant insert (search_query_id, creator_account_id, rank, cold_quota, vigilance_code)
   on search.search_impressions to influx_creator_search_definer;
-- EC-L3E-06-10: ON CONFLICT (creator_account_id) DO NOTHING reads the key of its arbiter
grant select (creator_account_id), insert (creator_account_id, first_page_at)
   on search.creator_exposures to influx_creator_search_definer;

drop policy if exists search_queries_creator_search_definer_select on search.search_queries;
create policy search_queries_creator_search_definer_select on search.search_queries
  for select to influx_creator_search_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists search_queries_creator_search_definer_insert on search.search_queries;
create policy search_queries_creator_search_definer_insert on search.search_queries
  for insert to influx_creator_search_definer
  with check (account_id = (select influx.current_account_id())
              and actor_role = 'advertiser' and view_mode = 'advertiser_anonymous');

drop policy if exists search_impressions_creator_search_definer_insert on search.search_impressions;
create policy search_impressions_creator_search_definer_insert on search.search_impressions
  for insert to influx_creator_search_definer
  with check (exists (select 1 from search.search_queries q
                       where q.id = search_impressions.search_query_id
                         and q.account_id = (select influx.current_account_id())));

drop policy if exists creator_exposures_creator_search_definer_select on search.creator_exposures;
create policy creator_exposures_creator_search_definer_select on search.creator_exposures
  for select to influx_creator_search_definer
  using (exists (select 1 from profiles.creator_public_profiles p
                  where p.account_id = creator_exposures.creator_account_id
                    and p.status = 'published' and p.is_searchable));
drop policy if exists creator_exposures_creator_search_definer_insert on search.creator_exposures;
create policy creator_exposures_creator_search_definer_insert on search.creator_exposures
  for insert to influx_creator_search_definer
  with check (exists (select 1 from profiles.creator_public_profiles p
                       where p.account_id = creator_exposures.creator_account_id
                         and p.status = 'published' and p.is_searchable));

-- 4. The helpers and the door, as influx_creator_search_definer (03 P7 rule 5) ---------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_search_definer', current_user);
end
$$;
grant create on schema search to influx_creator_search_definer;
set role influx_creator_search_definer;

-- 4.1 The caller (10 RG1; modele §1)
create or replace function search.require_creator_searcher()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_caller  uuid := influx.current_account_id();
begin
  -- a brand session on an active account holding the role (its profile is RG1, read by the door)
  if v_caller is null
     or influx.current_account_role() is distinct from 'advertiser'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'advertiser'
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return v_caller;
end
$$;

comment on function search.require_creator_searcher() is
  '10 RG1 (0319, l3e/modele.md §1, EC-L3E-06-2): the account of a brand session that may search the '
  'creators (the role advertiser, an active account holding it); 42501 forbidden otherwise. SECURITY '
  'INVOKER owned by influx_creator_search_definer, executed by its owner only.';

-- 4.2 The bucket of an account (modele §8; 10 RG63, RG64; 18 T15.2, T15.5; the lesson of L3DS-1)
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

  -- one search at a time per account: the count, the check and the line the door adds are one step
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.search_queries:' || p_account_id::text, 0));

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
  'l3e/modele.md §8 (0319; 10 RG63, RG64; 18 T15.2, T15.5; pattern 0315): under a transaction lock '
  'per account, counts the searches of p_account_id but rate_limited ones (a page is a search) on '
  '1 h and 24 h sliding (search_queries_bucket_idx), against rate_limits perHour and perDay of '
  'search.search_settings (55000 creator_search_settings when missing). Within both: (NULL, false). '
  'Otherwise retry_after_seconds, the whole seconds, at least 1, before the count of every full '
  'window falls below its limit, and journal_refusal, true when no rate_limited line of the account '
  'lies in the window that refuses (24 h when the day is full, 1 h otherwise). Writes nothing. '
  'SECURITY INVOKER owned by influx_creator_search_definer, executed by its owner only.';

-- 4.3 The closed entry of the filters (modele §3; 10 RG6, RG12, RG17; fiche invariant 3)
create or replace function search.check_creator_search_filters(p_filters jsonb)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  c_code   constant text := '^[A-Za-z0-9_]{1,64}$';
  v_key    text;
  v_value  jsonb;
  v_ok     boolean;
begin
  if p_filters is null or pg_catalog.jsonb_typeof(p_filters) is distinct from 'object'
     or pg_catalog.pg_column_size(p_filters) > 2000 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'filters';
  end if;
  for v_key, v_value in select e.key, e.value from pg_catalog.jsonb_each(p_filters) e loop
    -- the base of the pilot, each facet open in table (RG11, RG12): an unknown code, a closed facet
    -- (F12 while D78 holds, a second wave) or one outside the base is refused, nothing written
    if v_key not in ('F1', 'F3', 'F4', 'F6', 'F8', 'F11', 'F17')
       or not exists (select 1 from search.facet_settings f
                       where f.facet_code = v_key and f.is_open and f.wave = 1) then
      raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'filters';
    end if;
    v_ok := true;
    if v_key = 'F1' then
      -- the main topic: one code
      v_ok := pg_catalog.jsonb_typeof(v_value) = 'string' and (v_value #>> '{}') ~ c_code;
    elsif v_key = 'F6' then
      -- the main country of the audience and its share, together (RG17)
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'object'
         or not (v_value ? 'country')
         or exists (select 1 from pg_catalog.jsonb_object_keys(v_value) k
                     where k not in ('country', 'shareBands'))
         or pg_catalog.jsonb_typeof(v_value -> 'country') is distinct from 'string'
         or not ((v_value ->> 'country') ~ '^[A-Z]{2}$') then
        v_ok := false;
      elsif v_value ? 'shareBands' then
        if pg_catalog.jsonb_typeof(v_value -> 'shareBands') is distinct from 'array'
           or pg_catalog.jsonb_array_length(v_value -> 'shareBands') not between 1 and 3 then
          v_ok := false;
        elsif exists (select 1 from pg_catalog.jsonb_array_elements(v_value -> 'shareBands') x
                       where pg_catalog.jsonb_typeof(x) is distinct from 'string') then
          v_ok := false;
        elsif exists (select 1 from pg_catalog.jsonb_array_elements_text(v_value -> 'shareBands') x
                       where x not in ('ge_80', '50_80', 'lt_50'))
              or (select count(distinct x)
                    from pg_catalog.jsonb_array_elements_text(v_value -> 'shareBands') x)
                 <> pg_catalog.jsonb_array_length(v_value -> 'shareBands') then
          v_ok := false;
        end if;
      end if;
    else
      -- F3, F4, F8, F11, F17: a list of 1 to 20 codes, without duplicate (OR inside, RG17)
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'array'
         or pg_catalog.jsonb_array_length(v_value) not between 1 and 20 then
        v_ok := false;
      elsif exists (select 1 from pg_catalog.jsonb_array_elements(v_value) x
                     where pg_catalog.jsonb_typeof(x) is distinct from 'string') then
        v_ok := false;
      elsif exists (select 1 from pg_catalog.jsonb_array_elements_text(v_value) x
                     where not (x ~ c_code)
                        or (v_key = 'F17' and x not in ('account_verified', 'audience_verified')))
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

comment on function search.check_creator_search_filters(jsonb) is
  'l3e/modele.md §3 (0319, EC-L3E-06-2, -4): the closed entry of the filters of a search. An object '
  'of 2 000 bytes at most whose keys are facets of the base OPEN in search.facet_settings (F1, F3, '
  'F4, F6, F8, F11, F17; F12 stays closed, D78): F1 one code; F6 {country, shareBands?} (a country '
  'of two capitals, 1 to 3 of ge_80, 50_80, lt_50); F3, F4, F8, F11, F17 lists of 1 to 20 codes '
  'without duplicate (F17: account_verified, audience_verified). 22023 DETAIL filters otherwise. '
  'SECURITY INVOKER owned by influx_creator_search_definer, executed by its owner only.';

-- 4.4 THE engine (10 RG4, RG17, RG26 to RG31; modele §1, §3; fiche invariant 4)
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

  -- E6: the main sector of the brand, its secondary ones, the sector of its campaign of origin
  v_sectors := array(
    select a.primary_sector_code from profiles.advertiser_profiles a
     where a.account_id = p_advertiser_account_id and a.primary_sector_code is not null
    union
    select s.sector_code from profiles.advertiser_secondary_sectors s
     where s.account_id = p_advertiser_account_id
    union
    select c.sector_code from campaigns.campaigns c
     where c.id = p_campaign_id and c.advertiser_account_id = p_advertiser_account_id
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
  'l3e/modele.md §1, §3 (0319; 10 RG4, RG17, RG26 to RG31): THE engine of the creator search, its '
  'mode advertiser_anonymous (agent_identified: 0A000 until L3G). The storefronts that pass E1 to E6 '
  '(published, searchable, account active, majority attested, no active block of the pair in either '
  'direction, no sector of the brand nor of its campaign refused) and the filters already checked by '
  'search.check_creator_search_filters(): OR inside a facet, AND between them, F3 and F4 on one '
  'listed line, F6 country and share together, F17 a holding badge of a listed line. An exclusion '
  'is silent: absent, never counted, its motive neither served nor journaled. Returns the account '
  'and published_at (the order of 0320). SECURITY INVOKER owned by influx_creator_search_definer, '
  'executed by its owner only.';

-- 5. The door (modele §1, §4, §5; 10 RG1, RG2, RG57 to RG59, RG63 to RG66; CA34 to CA36, CA41, CA42,
-- CA47, CA48, CA59) -------------------------------------------------------------------------------------

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

  -- RG26, RG57: the candidates after the exclusions, ranked ONCE (EC-L3E-06-7: tier 8 alone, the
  -- same order for every brand the same UTC day)
  select coalesce(pg_catalog.array_agg(c.creator_account_id
                                       order by pg_catalog.md5(v_day::text || ':'
                                                               || c.creator_account_id::text),
                                                c.creator_account_id),
                  '{}'::uuid[])
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

  -- RG66, CA47: the search, then its impressions, in the transaction that serves
  insert into search.search_queries
    (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
     facet_config_version, result_count, page_reached, blocked_by_k_anonymity, request_id)
  values (v_caller, 'advertiser', 'advertiser_anonymous', p_campaign_id, 'served', p_filters,
          p_sort, v_version, v_count, p_page, false, v_request)
  returning id into v_query;

  -- RG63: the rank, never a cursor (EC-L3E-06-9); beyond the results, no card
  v_from := (p_page - 1) * v_page_size + 1;
  v_to := p_page * v_page_size;

  -- CA48: one impression per card served, with its rank
  insert into search.search_impressions (search_query_id, creator_account_id, rank)
  select v_query, s.creator_account_id, (v_from - 1 + s.ord)::smallint
    from pg_catalog.unnest(v_ids[v_from:v_to]) with ordinality s (creator_account_id, ord);

  -- modele §6, §9: the first page 1 of a creator, kept once
  if p_page = 1 then
    insert into search.creator_exposures (creator_account_id, first_page_at)
    select s.creator_account_id, pg_catalog.now()
      from pg_catalog.unnest(v_ids[v_from:v_to]) s (creator_account_id)
    on conflict (creator_account_id) do nothing;
  end if;

  -- modele §2: layer A of each card from its one source, without its status nor the key of a line,
  -- referenced by its alias; reasons and vigilance until 0320 (EC-L3E-06-7)
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'creator',   (l.layer - 'status' - 'lines')
                        || pg_catalog.jsonb_build_object(
                             'lines',
                             coalesce((select pg_catalog.jsonb_agg(x.line - 'lineKey' order by x.ord)
                                         from pg_catalog.jsonb_array_elements(l.layer -> 'lines')
                                              with ordinality x (line, ord)),
                                      '[]'::jsonb)),
           'reasons',   '[]'::jsonb,
           'vigilance', null::text)
         order by s.ord), '[]'::jsonb)
    into v_cards
    from pg_catalog.unnest(v_ids[v_from:v_to]) with ordinality s (creator_account_id, ord)
    cross join lateral (select profiles.creator_layer_a(s.creator_account_id) as layer) l;

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
  '10 RG1, RG2, RG4, RG17, RG26 to RG31, RG57 to RG59, RG63 to RG66 (0319, l3e/modele.md §1 to §5, '
  '§8): a page of the anonymous creator search of the calling brand (search.require_creator_searcher: '
  '42501 otherwise). p_sort default, audience, verified_first, new_profiles and p_page 1 to 50 '
  '(22023 DETAIL sort or page, nothing written). Then: a brand profile not published {state: '
  'brand_not_published}; the switch false {state: closed} (nothing written nor counted); the bucket '
  'full {state: rate_limited, retryAfterSeconds} (a line per window); the filters '
  '(search.check_creator_search_filters, 22023 DETAIL filters) and the campaign of origin (unknown, '
  'of another brand or erased: P0002 DETAIL campaign); a page beyond max_pages {state: page_cap}; '
  'the count after the exclusions below k {state: too_narrow}, nothing else; otherwise {state: '
  'results, countBand, page, nextPage, capReached, cards: [{creator (profiles.creator_layer_a without '
  'status nor lineKey), reasons, vigilance}]}, page_size cards in the order of tier 8 until 0320. '
  'Every outcome but closed and brand_not_published writes its line of search.search_queries (exact '
  'count, never served), a served page its impressions and on page 1 its exposures, in the '
  'transaction that serves. SECURITY DEFINER owned by influx_creator_search_definer, empty '
  'search_path; EXECUTE for influx_advertiser only.';

-- 6. Rights on the functions (03 P7 rule 5), then the owner given back -------------------------------

revoke all on function search.require_creator_searcher()
  from public, anon, authenticated, service_role;
revoke all on function search.creator_search_retry_after(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.check_creator_search_filters(jsonb)
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

-- 7. The brand: the schema search and its door, nothing else (modele §1; fiche invariant 1) ---------

grant usage on schema search to influx_advertiser;

-- 8. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner   constant text := 'influx_creator_search_definer';
  c_door    constant text := 'search.search_creators(jsonb, text, integer, uuid)';
  -- layer I of the creator (fiche invariant 1): never reached by the owner nor named by its functions
  c_layer_i constant text[] := array[
    'profiles.creator_identities', 'profiles.creator_social_accounts',
    'profiles.creator_audience_ages', 'profiles.creator_audience_countries',
    'profiles.creator_audience_genders', 'profiles.creator_network_metrics_history'];
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
    raise exception 'influx_creator_search_definer must be NOLOGIN NOINHERIT, without member nor membership';
  end if;

  -- the functions: owner, mode, empty search_path, EXECUTE for their callers only
  for v_def in
    select * from (values
      ('search.require_creator_searcher()', c_owner, false, ''),
      ('search.creator_search_retry_after(uuid)', c_owner, false, ''),
      ('search.check_creator_search_filters(jsonb)', c_owner, false, ''),
      ('search.creator_candidates(text, uuid, jsonb, uuid)', c_owner, false, ''),
      (c_door, c_owner, true, 'influx_advertiser'),
      ('profiles.creator_layer_a(uuid)', 'postgres', false, 'influx_creator,' || c_owner)
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
       and (a.grantee = 0
            or a.grantee::regrole::text <> all (pg_catalog.string_to_array(v_def.callers, ',')));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- 03 P7, fiche invariant 15: no dynamic SQL in a function of the owner, nor in the card
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where (p.proowner = c_owner::regrole or p.oid = 'profiles.creator_layer_a(uuid)'::regprocedure)
     and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic SQL in a function of the creator search: %', v_bad;
  end if;

  -- fiche invariant 1: the owner holds nothing on layer I, and none of its functions nor the card
  -- names it
  select string_agg(t, ', ') into v_bad
    from pg_catalog.unnest(c_layer_i) t
   where pg_catalog.has_table_privilege(c_owner, t, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
      or pg_catalog.has_any_column_privilege(c_owner, t, 'SELECT, INSERT, UPDATE');
  if v_bad is not null then
    raise exception 'influx_creator_search_definer reaches layer I: %', v_bad;
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where (p.proowner = c_owner::regrole or p.oid = 'profiles.creator_layer_a(uuid)'::regprocedure)
     and p.prosrc ~* ('\m(' || pg_catalog.array_to_string(
                       array(select pg_catalog.split_part(t, '.', 2)
                               from pg_catalog.unnest(c_layer_i) t), '|') || ')\M');
  if v_bad is not null then
    raise exception 'a function of the creator search names layer I: %', v_bad;
  end if;

  -- never leads.*, a coordinate, the internal block of a brand, public_ref nor the region; of a
  -- campaign its four columns only; of party_blocks the pair and lifted_at only (RG30)
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p')
     and (n.nspname = 'leads'
          or c.oid in ('profiles.advertiser_contact_details'::regclass,
                       'profiles.advertiser_internal_details'::regclass,
                       'matching.block_reasons'::regclass))
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'SELECT, INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'influx_creator_search_definer reaches leads.*, a coordinate or an internal block: %',
      v_bad;
  end if;
  if pg_catalog.has_column_privilege(c_owner, 'profiles.creator_public_profiles', 'public_ref', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'profiles.creator_public_profiles',
                                        'residence_region_code', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'profiles.portfolio_items', 'object_key', 'SELECT') then
    raise exception 'influx_creator_search_definer reads public_ref, the region or an object key';
  end if;
  select string_agg(at.attrelid::regclass::text || '.' || at.attname, ', ' order by 1) into v_bad
    from pg_catalog.pg_attribute at
   where at.attrelid in ('campaigns.campaigns'::regclass, 'matching.party_blocks'::regclass)
     and at.attnum > 0 and not at.attisdropped
     and pg_catalog.has_column_privilege(c_owner, at.attrelid, at.attnum, 'SELECT')
     and not (at.attrelid = 'campaigns.campaigns'::regclass
              and at.attname in ('id', 'advertiser_account_id', 'sector_code', 'erased_at'))
     and not (at.attrelid = 'matching.party_blocks'::regclass
              and at.attname in ('advertiser_account_id', 'creator_account_id', 'lifted_at'));
  if v_bad is not null then
    raise exception 'influx_creator_search_definer reads a column of a campaign or a block it must not: %',
      v_bad;
  end if;

  -- its one write: the insertion of its journal lines, their impressions and the exposures
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('influx', 'reference', 'identity', 'audit', 'billing', 'backoffice', 'leads',
                       'profiles', 'verification', 'campaigns', 'search', 'matching', 'messaging',
                       'ops', 'privacy')
     and c.relkind in ('r', 'p')
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'UPDATE')
          or (c.oid not in ('search.search_queries'::regclass, 'search.search_impressions'::regclass,
                            'search.creator_exposures'::regclass)
              and (pg_catalog.has_table_privilege(c_owner, c.oid, 'INSERT')
                   or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'INSERT'))));
  if v_bad is not null then
    raise exception 'influx_creator_search_definer writes beyond its journal lines: %', v_bad;
  end if;

  -- fiche invariant 1: the brand holds nothing on a table of search, matching, verification nor
  -- profiles.creator_*; of search it executes the door alone; it executes no creator function
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p', 'v', 'm')
     and (n.nspname in ('search', 'matching', 'verification')
          or (n.nspname = 'profiles' and c.relname like 'creator\_%'))
     and (pg_catalog.has_table_privilege('influx_advertiser', c.oid,
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          or pg_catalog.has_any_column_privilege('influx_advertiser', c.oid,
                                                 'SELECT, INSERT, UPDATE, REFERENCES'));
  if v_bad is not null then
    raise exception 'influx_advertiser holds a right on search, matching, verification or a creator relation: %',
      v_bad;
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
     and ((n.nspname = 'search' and p.oid <> c_door::regprocedure)
          or (n.nspname = 'profiles' and p.proname like '%creator%'));
  if v_bad is not null then
    raise exception 'influx_advertiser executes a search or creator function beyond its door: %', v_bad;
  end if;
  if not pg_catalog.has_schema_privilege('influx_advertiser', 'search', 'USAGE')
     or pg_catalog.has_schema_privilege('influx_advertiser', 'matching', 'USAGE')
     or pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE') then
    raise exception 'influx_advertiser: no USAGE on search, or USAGE on matching or verification';
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE') then
    raise exception 'influx_creator_search_definer left with a member or CREATE';
  end if;
end
$$;
