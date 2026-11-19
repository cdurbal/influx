-- =============================================================================
-- 0318_privacy_search_and_blocks
-- -----------------------------------------------------------------------------
-- Lot 3 / L3E, commit 05 (jalons/l3e/05.md; l3e-fiche.md invariants 1, 4, 16; jalons/l3e/modele.md
-- §9, which PREVAILS for every name; 04 §9; 10 RG8, RG30; jalons/l3a/f3.md, the rule of the
-- export). The rights of the data subject over the creator search (0316) and the blocks between
-- parties (0317): privacy.export_document() and privacy.execute_request() recreated by their owner
-- FROM THEIR 0314 VERSIONS, at the same signatures, every other step unchanged. Signalled I-4 (03):
-- GRANTs and policies to influx_privacy_definer, two SECURITY functions of E-5 recreated.
--
-- 1. influx_privacy_definer: USAGE on matching; on search.search_queries, search_impressions,
--    impression_reasons, creator_exposures, shortlists, shortlist_items and matching.party_blocks,
--    the columns the export restitutes or the erasure names, and DELETE, each right with its policy
--    (SELECT: true, as 0314; DELETE: a line naming an account already `deleted`, as 0314); EXECUTE on
--    search.result_count_band(), the one source of the band (RG59). No INSERT nor UPDATE anywhere.
-- 2. The export (modele §9; 15 categories unchanged):
--      advertiser_profile.creator_searches  each search of the brand: instant, filters, sort, page,
--            outcome, the band of its count (served above k) or NULL, the k block, the title of
--            its campaign; never the exact count, an impression, a reason, an exposure, a creator
--            served nor the id of a line;
--      advertiser_profile.shortlists  name, title of the campaign, date, and its creators by ALIAS
--            (date, note): the only aliases of a creator the brand's export carries;
--      advertiser_profile.blocks, creator_profile.blocks  the blocks POSED BY THE MEMBER (its side,
--            its account): the other party (the creator's alias, the brand's legal name), reason,
--            comment, dates; never a block posed against the member, by INFLUX, its reason nor who
--            lifted it (RG30). block.created, block.lifted stay out of activity_log
--            (excluded_third_party since 0303, L3A-T5).
-- 3. The erasure (step 3 decies; modele §9: deleted, no pseudonymous survival): a brand, its
--    searches with their impressions and reasons, its shortlists with their creators; a creator,
--    its impressions and reasons in any brand's search, its place in any shortlist, its exposure;
--    either, every block of a pair it belongs to, whoever posed it. The guards of 0316 and 0317 let
--    influx_privacy_definer alone delete; children first (the cascades of EC-L3E-03-6 stay a
--    second line).
--
-- RIGHTS (03 I-4, signalled): USAGE on matching, column SELECT and DELETE on seven tables, their
-- fourteen policies, EXECUTE on search.result_count_band(integer), all to influx_privacy_definer;
-- the two functions of E-5 recreated by their owner.
--
-- Not here: the purge at 12 months (Lot 6, with L3DS-2), the doors of the search (0319, 0320),
-- the gesture of a block (Lot 4), the shortlist doors (L3F).
--
-- EC-L3E-05 (micro-gaps, the safest choice):
--   EC-L3E-05-1  the campaign of a search or a shortlist is exported by its title (campaign_title):
--                a campaign is exported without its id (EC-L3B-06-2); a campaign of another brand
--                (refused by the door, never written) would read NULL.
--   EC-L3E-05-2  the export keys are snake_case as the rest of the file: count_band for the
--                countBand of modele §9, served only for a line `served` without the k block.
--   EC-L3E-05-3  the erasure deletes every block of the pair, the one posed against the erased
--                account and by INFLUX included: the account no longer exists, a block naming it
--                would be an identifying survival; the other party's export loses it with it.
--   EC-L3E-05-4  the order of the lists: instant then id (searches, shortlists, blocks), date then
--                account for the creators of a shortlist; an erased creator leaves no line.
--
-- ROLLBACK (before any search is journaled, any shortlist or block written, and any account erased
-- once 0318 is applied): recreate privacy.export_document() and privacy.execute_request() as in 0314
-- (as influx_privacy_definer); drop the policies *_privacy_definer_select and *_privacy_definer_erase
-- of §1 and revoke their grants; revoke execute on search.result_count_band(integer) and usage on
-- schema matching from influx_privacy_definer.
-- =============================================================================

-- 1. What influx_privacy_definer reads and deletes (modele §9; 04 §9) ------------------------------
-- identity.accounts (id, status) read since 0137: each erase policy names an account already deleted

grant usage on schema matching to influx_privacy_definer;

-- 1.1 The searches of a brand: what the export restitutes (never served: result_count, read for its
-- band only), and the lines the erasure deletes
grant select (id, account_id, campaign_id, outcome, filters, sort_code, result_count, page_reached,
              blocked_by_k_anonymity, created_at),
      delete
   on search.search_queries to influx_privacy_definer;
drop policy if exists search_queries_privacy_definer_select on search.search_queries;
create policy search_queries_privacy_definer_select on search.search_queries
  for select to influx_privacy_definer
  using (true);
drop policy if exists search_queries_privacy_definer_erase on search.search_queries;
create policy search_queries_privacy_definer_erase on search.search_queries
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = search_queries.account_id and a.status = 'deleted'));

-- 1.2 The impressions and their reasons: never exported; deleted with an erased creator or with the
-- search of an erased brand
grant select (search_query_id, creator_account_id), delete
   on search.search_impressions to influx_privacy_definer;
drop policy if exists search_impressions_privacy_definer_select on search.search_impressions;
create policy search_impressions_privacy_definer_select on search.search_impressions
  for select to influx_privacy_definer
  using (true);
drop policy if exists search_impressions_privacy_definer_erase on search.search_impressions;
create policy search_impressions_privacy_definer_erase on search.search_impressions
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = search_impressions.creator_account_id and a.status = 'deleted')
         or exists (select 1 from search.search_queries q
                      join identity.accounts a on a.id = q.account_id
                     where q.id = search_impressions.search_query_id and a.status = 'deleted'));

grant select (search_query_id, creator_account_id), delete
   on search.impression_reasons to influx_privacy_definer;
drop policy if exists impression_reasons_privacy_definer_select on search.impression_reasons;
create policy impression_reasons_privacy_definer_select on search.impression_reasons
  for select to influx_privacy_definer
  using (true);
drop policy if exists impression_reasons_privacy_definer_erase on search.impression_reasons;
create policy impression_reasons_privacy_definer_erase on search.impression_reasons
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = impression_reasons.creator_account_id and a.status = 'deleted')
         or exists (select 1 from search.search_queries q
                      join identity.accounts a on a.id = q.account_id
                     where q.id = impression_reasons.search_query_id and a.status = 'deleted'));

-- 1.3 The exposure of a creator: never exported; deleted with the erased creator
grant select (creator_account_id), delete
   on search.creator_exposures to influx_privacy_definer;
drop policy if exists creator_exposures_privacy_definer_select on search.creator_exposures;
create policy creator_exposures_privacy_definer_select on search.creator_exposures
  for select to influx_privacy_definer
  using (true);
drop policy if exists creator_exposures_privacy_definer_erase on search.creator_exposures;
create policy creator_exposures_privacy_definer_erase on search.creator_exposures
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = creator_exposures.creator_account_id and a.status = 'deleted'));

-- 1.4 The shortlists of a brand and their creators: exported to the brand, deleted with the brand;
-- the place of an erased creator deleted from any shortlist
grant select (id, advertiser_account_id, name, campaign_id, created_at), delete
   on search.shortlists to influx_privacy_definer;
drop policy if exists shortlists_privacy_definer_select on search.shortlists;
create policy shortlists_privacy_definer_select on search.shortlists
  for select to influx_privacy_definer
  using (true);
drop policy if exists shortlists_privacy_definer_erase on search.shortlists;
create policy shortlists_privacy_definer_erase on search.shortlists
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = shortlists.advertiser_account_id and a.status = 'deleted'));

grant select (shortlist_id, creator_account_id, added_at, note), delete
   on search.shortlist_items to influx_privacy_definer;
drop policy if exists shortlist_items_privacy_definer_select on search.shortlist_items;
create policy shortlist_items_privacy_definer_select on search.shortlist_items
  for select to influx_privacy_definer
  using (true);
drop policy if exists shortlist_items_privacy_definer_erase on search.shortlist_items;
create policy shortlist_items_privacy_definer_erase on search.shortlist_items
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = shortlist_items.creator_account_id and a.status = 'deleted')
         or exists (select 1 from search.shortlists s
                      join identity.accounts a on a.id = s.advertiser_account_id
                     where s.id = shortlist_items.shortlist_id and a.status = 'deleted'));

-- 1.5 The blocks: the export reads those the member posed (never who lifted, nor the lift reason);
-- the erasure deletes every block of a pair naming an erased account (EC-L3E-05-3)
grant select (id, advertiser_account_id, creator_account_id, blocked_by_side, reason_code, comment,
              created_at, lifted_at),
      delete
   on matching.party_blocks to influx_privacy_definer;
drop policy if exists party_blocks_privacy_definer_select on matching.party_blocks;
create policy party_blocks_privacy_definer_select on matching.party_blocks
  for select to influx_privacy_definer
  using (true);
drop policy if exists party_blocks_privacy_definer_erase on matching.party_blocks;
create policy party_blocks_privacy_definer_erase on matching.party_blocks
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id in (party_blocks.advertiser_account_id, party_blocks.creator_account_id)
                    and a.status = 'deleted'));

-- 1.6 The band of a count (0316, RG59): one source for the door (0319) and the export
grant execute on function search.result_count_band(integer) to influx_privacy_definer;

-- 2. E-5 recreated by its owner from its 0314 versions (export and execution) -----------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 2.1 The export (0137 ... 0310, 0314): the searches, the shortlists and the blocks posed -----------
create or replace function privacy.export_document(
  p_account_id  uuid,
  p_addresses   text[],
  p_notice      jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_account   jsonb;
  v_language  text;
  v_zone      text;
  v_data      jsonb;
begin
  -- Compte (runbook §4): the account, its role, the referent agent's first name only
  select pg_catalog.jsonb_build_object(
           'id', a.id,
           'role', r.role,
           'email', a.email,
           'email_verified_at', privacy.iso_utc(a.email_verified_at),
           'email_status', a.email_status,
           'email_undeliverable_at', privacy.iso_utc(a.email_undeliverable_at),
           'country_code', a.country_code,
           'preferred_language', a.preferred_language,
           'time_zone', a.timezone,
           'display_name', a.display_name,
           'status', a.status,
           'adult_attested', a.is_adult_attested,
           'adult_attested_at', privacy.iso_utc(a.adult_attested_at),
           'declared_status', a.declared_status,
           'signup_source', pg_catalog.jsonb_build_object(
              'utm_source', a.signup_utm_source,
              'utm_medium', a.signup_utm_medium,
              'utm_campaign', a.signup_utm_campaign,
              'referrer_domain', a.signup_referrer_domain,
              'heard_from', a.signup_heard_from,
              'via_invitation', a.signup_invitation_id is not null),
           'created_at', privacy.iso_utc(a.created_at),
           'last_seen_at', privacy.iso_utc(a.last_seen_at),
           'role_granted_at', privacy.iso_utc(r.granted_at),
           'referent_first_name', p.first_name),
         a.preferred_language::text,
         a.timezone
    into v_account, v_language, v_zone
    from identity.accounts a
    left join identity.account_roles r on r.account_id = a.id
    left join identity.agent_profiles p on p.account_id = a.owner_agent_id
   where a.id = p_account_id;
  if not found then
    raise exception 'unknown account' using errcode = 'no_data_found';
  end if;

  v_data := pg_catalog.jsonb_build_object(
    'account', v_account,

    -- Profil de marque (0202): the profile of an advertiser as entered, its lists in the order
    -- chosen, its contact person (first name and coordinates); codes of the closed lists, as stored
    'advertiser_profile', (
      select pg_catalog.jsonb_build_object(
               'legal_name', p.legal_name,
               'status', p.status,
               'primary_sector', p.primary_sector_code,
               'secondary_sectors', coalesce((
                  select pg_catalog.jsonb_agg(s.sector_code order by s.slot)
                    from profiles.advertiser_secondary_sectors s
                   where s.account_id = p.account_id), '[]'::jsonb),
               'company_size', p.company_size_band,
               'target_markets', coalesce((
                  select pg_catalog.jsonb_agg(m.country_code order by m.slot)
                    from profiles.advertiser_target_markets m
                   where m.account_id = p.account_id), '[]'::jsonb),
               'working_languages', coalesce((
                  select pg_catalog.jsonb_agg(w.language_code order by w.language_code)
                    from profiles.advertiser_working_languages w
                   where w.account_id = p.account_id), '[]'::jsonb),
               'website_domain', p.website_domain,
               'presentation', p.presentation,
               'topics', coalesce((
                  select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                    from profiles.advertiser_topics t
                   where t.account_id = p.account_id), '[]'::jsonb),
               'networks', coalesce((
                  select pg_catalog.jsonb_agg(n.network_code order by n.network_code)
                    from profiles.advertiser_networks n
                   where n.account_id = p.account_id), '[]'::jsonb),
               'formats', coalesce((
                  select pg_catalog.jsonb_agg(f.format_code order by f.format_code)
                    from profiles.advertiser_formats f
                   where f.account_id = p.account_id), '[]'::jsonb),
               'audience_countries', coalesce((
                  select pg_catalog.jsonb_agg(c.country_code order by c.slot)
                    from profiles.advertiser_audience_countries c
                   where c.account_id = p.account_id), '[]'::jsonb),
               'usage_rights', coalesce((
                  select pg_catalog.jsonb_agg(u.usage_right_code order by u.usage_right_code)
                    from profiles.advertiser_usage_rights u
                   where u.account_id = p.account_id), '[]'::jsonb),
               'exclusivity', p.exclusivity_band,
               'collaboration_rhythm', p.collaboration_rhythm,
               'offers_non_monetary', p.offers_non_monetary,
               'contact_role', p.contact_role,
               'contact', (
                  select pg_catalog.jsonb_build_object(
                           'first_name', d.contact_first_name, 'email', d.contact_email,
                           'phone', d.contact_phone, 'page_url', d.contact_url,
                           'updated_at', privacy.iso_utc(d.updated_at))
                    from profiles.advertiser_contact_details d
                   where d.account_id = p.account_id),
               'completeness_percent', p.completeness_percent,
               -- 0204 (stockage.md §7): the metadata of each logo file, never its bytes nor its key
               'logo_files', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'state', l.state, 'byte_size', l.byte_size, 'width', l.width,
                           'height', l.height, 'created_at', privacy.iso_utc(l.created_at),
                           'activated_at', privacy.iso_utc(l.activated_at))
                         order by l.created_at, l.id)
                    from profiles.brand_logo_objects l
                   where l.account_id = p.account_id), '[]'::jsonb),
               -- 0207 (file.md A1): each examination of the profile, never the internal comment,
               -- an agent nor the lock
               'review_entries', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'kind', e.kind, 'state', e.state,
                           'created_at', privacy.iso_utc(e.created_at),
                           'decided_at', privacy.iso_utc(e.decided_at),
                           'rejection_reason', e.rejection_reason_code,
                           'member_message', e.member_message,
                           'closed_at', privacy.iso_utc(e.closed_at))
                         order by e.created_at, e.id)
                    from profiles.advertiser_review_entries e
                   where e.account_id = p.account_id), '[]'::jsonb),
               -- 0207 (04 §5.2): each value submitted for a moderated field
               'field_revisions', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'field', r.field_code, 'row_key', r.row_key,
                           'proposed_value', r.proposed_value, 'status', r.status,
                           'submitted_at', privacy.iso_utc(r.submitted_at),
                           'closed_at', privacy.iso_utc(r.closed_at))
                         order by r.submitted_at, r.field_code, r.row_key)
                    from profiles.profile_field_revisions r
                   where r.account_id = p.account_id), '[]'::jsonb),
               -- 0226 (06 RG46 to RG52; fiche invariant 16): the internal block as entered, each
               -- brand request (status, dates, reason, message to the brand) and each brand badge
               -- (state, date, source, expiry, withdrawal); never a code, the domain observed, the
               -- registry consulted, an agent, the lock nor the internal comment; 0235: the origin
               -- of each request (D83: member or agent, the agent's reason; never the agent nor his
               -- comment) and the message of a withdrawal on the badge it withdrew
               'verification', pg_catalog.jsonb_build_object(
                  'internal_details', (
                     select pg_catalog.jsonb_build_object(
                              'legal_name', d.legal_name,
                              'registration_country_code', d.registration_country_code,
                              'registration_number', d.registration_number,
                              'created_at', privacy.iso_utc(d.created_at),
                              'updated_at', privacy.iso_utc(d.updated_at))
                       from profiles.advertiser_internal_details d
                      where d.account_id = p.account_id),
                  'requests', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'level', r.level, 'status', r.status,
                              'created_at', privacy.iso_utc(r.created_at),
                              'submitted_at', privacy.iso_utc(r.submitted_at),
                              'decided_at', privacy.iso_utc(r.decided_at),
                              'rejection_reason', r.rejection_reason_code,
                              'member_message', r.member_message,
                              'cancelled_at', privacy.iso_utc(r.cancelled_at),
                              'closed_at', privacy.iso_utc(r.closed_at),
                              'opened_by', r.opened_by,
                              'opening_reason', r.opening_reason_code)
                            order by r.created_at, r.id)
                       from verification.verification_requests r
                      where r.account_id = p.account_id and r.population = 'brand'), '[]'::jsonb),
                  'badges', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'level', b.level, 'state', b.state,
                              'granted_at', privacy.iso_utc(b.granted_at),
                              'source', b.evidence_source,
                              'expires_at', privacy.iso_utc(b.expires_at),
                              'revoked_at', privacy.iso_utc(b.revoked_at),
                              'revocation_reason', b.revocation_reason_code,
                              'revocation_message', (
                                 select q.member_message
                                   from verification.badge_revocation_requests q
                                  where q.dual_control_request_id = b.revocation_request_id
                                    and q.badge_id = b.id and q.executed_at is not null))
                            order by b.granted_at, b.id)
                       from verification.badges b
                      where b.account_id = p.account_id and b.level = 'brand_verified'),
                     '[]'::jsonb)),
               -- 0306 (l3b/modele.md §7; fiche invariant 10): each campaign as the brand entered it
               -- (its internal reference, total budget and budget band included), its state, its
               -- dates, its lists in their order and its declaration of RG85 (instant, locale, hex
               -- hash); never its id, the author of the declaration (the account itself), the
               -- suspended exact range nor erased_at; 0310 (l3c/modele.md §9; EC-L3C-05-1, -2): its
               -- cycle (first publication, pause and its origin, closure), each examination of queue 7
               -- (state, dates, reason, message to the brand), each snapshot (version, instant,
               -- payload, hex hash) and each intervention of INFLUX (kind, field, old and new value,
               -- reason, instant); never an agent, the commercial owner, a lock, a deadline, the first
               -- review, the duplicate alert nor an internal comment
               'campaigns', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'status', c.status,
                           'title', c.title,
                           'campaign_type', c.campaign_type_code,
                           'public_summary', c.public_summary,
                           'brief', c.brief,
                           'internal_reference', c.internal_reference,
                           'product_description', c.product_description,
                           'sector', c.sector_code,
                           'restrictions', c.restrictions,
                           'product_is_sent', c.product_is_sent,
                           'product_value_band', c.product_value_band_code,
                           'creator_keeps_product', c.creator_keeps_product,
                           'shipping_costs_borne_by', c.shipping_costs_borne_by,
                           'key_messages', coalesce((
                              select pg_catalog.jsonb_agg(k.body order by k.position)
                                from campaigns.campaign_key_messages k
                               where k.campaign_id = c.id), '[]'::jsonb),
                           'deliverables', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'network', d.network_code, 'format', d.format_code,
                                       'quantity', d.quantity)
                                     order by d.slot)
                                from campaigns.campaign_deliverables d
                               where d.campaign_id = c.id), '[]'::jsonb),
                           'usage_rights', c.usage_rights_code,
                           'usage_rights_duration', c.usage_rights_duration_band,
                           'usage_rights_territory_scope', c.usage_rights_territory_scope,
                           'usage_territories', coalesce((
                              select pg_catalog.jsonb_agg(u.country_code order by u.slot)
                                from campaigns.campaign_usage_territories u
                               where u.campaign_id = c.id), '[]'::jsonb),
                           'exclusivity', c.exclusivity_band,
                           'content_review_delay', c.content_review_delay,
                           'audience_gender', c.audience_gender_code,
                           'audience_countries', coalesce((
                              select pg_catalog.jsonb_agg(a.country_code order by a.slot)
                                from campaigns.campaign_audience_countries a
                               where a.campaign_id = c.id), '[]'::jsonb),
                           'audience_languages', coalesce((
                              select pg_catalog.jsonb_agg(l.language_code order by l.language_code)
                                from campaigns.campaign_audience_languages l
                               where l.campaign_id = c.id), '[]'::jsonb),
                           'audience_bands', coalesce((
                              select pg_catalog.jsonb_agg(b.audience_band_code
                                                          order by b.audience_band_code)
                                from campaigns.campaign_audience_bands b
                               where b.campaign_id = c.id), '[]'::jsonb),
                           'audience_age_bands', coalesce((
                              select pg_catalog.jsonb_agg(g.age_band_code order by g.age_band_code)
                                from campaigns.campaign_audience_age_bands g
                               where g.campaign_id = c.id), '[]'::jsonb),
                           'topics', coalesce((
                              select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                                from campaigns.campaign_topics t
                               where t.campaign_id = c.id), '[]'::jsonb),
                           'currency', c.currency,
                           'remuneration_kind', c.remuneration_kind,
                           'budget_band', c.per_creator_budget_band_code,
                           'creators_wanted', c.creators_wanted,
                           'total_budget_minor', c.total_budget_minor,
                           'applications_close_on', c.applications_close_on,
                           'content_due_on', c.content_due_on,
                           'starts_on', c.starts_on,
                           'ends_on', c.ends_on,
                           'max_applications', c.max_applications,
                           'requested_items', coalesce((
                              select pg_catalog.jsonb_agg(r.item_code order by r.slot)
                                from campaigns.campaign_requested_items r
                               where r.campaign_id = c.id), '[]'::jsonb),
                           'authorizations_declaration',
                              case when c.authorizations_declared_at is not null then
                                pg_catalog.jsonb_build_object(
                                  'declared_at', privacy.iso_utc(c.authorizations_declared_at),
                                  'locale', c.authorizations_declaration_locale,
                                  'sha256', pg_catalog.encode(c.authorizations_declaration_hash,
                                                              'hex'))
                              end,
                           'submitted_at', privacy.iso_utc(c.submitted_at),
                           'first_published_at', privacy.iso_utc(c.first_published_at),
                           'paused_at', privacy.iso_utc(c.paused_at),
                           'pause_origin', c.pause_origin,
                           'closed_at', privacy.iso_utc(c.closed_at),
                           'reviews', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'state', e.state,
                                       'created_at', privacy.iso_utc(e.created_at),
                                       'decided_at', privacy.iso_utc(e.decided_at),
                                       'rejection_reason', e.rejection_reason_code,
                                       'member_message', e.member_message,
                                       'closed_at', privacy.iso_utc(e.closed_at))
                                     order by e.created_at, e.id)
                                from campaigns.campaign_review_entries e
                               where e.campaign_id = c.id
                                 and e.advertiser_account_id = c.advertiser_account_id),
                              '[]'::jsonb),
                           'snapshots', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'version', s.version,
                                       'published_at', privacy.iso_utc(s.published_at),
                                       'content', s.payload,
                                       'sha256', pg_catalog.encode(s.content_hash, 'hex'))
                                     order by s.version)
                                from campaigns.campaign_published_snapshots s
                               where s.campaign_id = c.id), '[]'::jsonb),
                           'interventions', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'kind', i.kind,
                                       'field', i.field_code,
                                       'old_value', i.old_value,
                                       'new_value', i.new_value,
                                       'reason', i.reason_code,
                                       'created_at', privacy.iso_utc(i.created_at))
                                     order by i.created_at, i.id)
                                from campaigns.agent_interventions i
                               where i.campaign_id = c.id
                                 and i.advertiser_account_id = c.advertiser_account_id),
                              '[]'::jsonb),
                           'created_at', privacy.iso_utc(c.created_at),
                           'updated_at', privacy.iso_utc(c.updated_at))
                         order by c.created_at, c.id)
                    from campaigns.campaigns c
                   where c.advertiser_account_id = p.account_id), '[]'::jsonb),
               -- 0318 (l3e/modele.md §9; EC-L3E-05-1, -2): each search of creators (instant,
               -- filters, sort, page, outcome, the band of its count served above k or NULL, the k
               -- block, the title of its campaign); never the exact count, an impression, a reason,
               -- an exposure, a creator served nor the id of a line
               'creator_searches', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'searched_at', privacy.iso_utc(q.created_at),
                           'filters', q.filters,
                           'sort', q.sort_code,
                           'page', q.page_reached,
                           'outcome', q.outcome,
                           'count_band',
                              case when q.outcome = 'served' and not q.blocked_by_k_anonymity
                                   then search.result_count_band(q.result_count) end,
                           'blocked_by_k_anonymity', q.blocked_by_k_anonymity,
                           'campaign_title', (
                              select c.title from campaigns.campaigns c
                               where c.id = q.campaign_id
                                 and c.advertiser_account_id = q.account_id))
                         order by q.created_at, q.id)
                    from search.search_queries q
                   where q.account_id = p.account_id), '[]'::jsonb),
               -- 0318 (modele §9; EC-L3E-05-1, -4): each shortlist (name, title of its campaign,
               -- date) and its creators by alias (date, note): the only aliases this export carries
               'shortlists', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'name', s.name,
                           'campaign_title', (
                              select c.title from campaigns.campaigns c
                               where c.id = s.campaign_id
                                 and c.advertiser_account_id = s.advertiser_account_id),
                           'created_at', privacy.iso_utc(s.created_at),
                           'creators', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'alias', v.alias,
                                       'added_at', privacy.iso_utc(i.added_at),
                                       'note', i.note)
                                     order by i.added_at, i.creator_account_id)
                                from search.shortlist_items i
                                join profiles.creator_public_profiles v
                                  on v.account_id = i.creator_account_id
                               where i.shortlist_id = s.id), '[]'::jsonb))
                         order by s.created_at, s.id)
                    from search.shortlists s
                   where s.advertiser_account_id = p.account_id), '[]'::jsonb),
               -- 0318 (modele §9; 10 RG30): the blocks the brand posed (the creator's alias,
               -- reason, comment, dates); never a block posed against it nor by INFLUX
               'blocks', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'creator_alias', v.alias,
                           'reason', b.reason_code,
                           'comment', b.comment,
                           'created_at', privacy.iso_utc(b.created_at),
                           'lifted_at', privacy.iso_utc(b.lifted_at))
                         order by b.created_at, b.id)
                    from matching.party_blocks b
                    left join profiles.creator_public_profiles v
                      on v.account_id = b.creator_account_id
                   where b.advertiser_account_id = p.account_id
                     and b.blocked_by_side = 'advertiser'), '[]'::jsonb),
               'created_at', privacy.iso_utc(p.created_at),
               'updated_at', privacy.iso_utc(p.updated_at))
        from profiles.advertiser_profiles p
       where p.account_id = p_account_id),

    -- Profil créateur (0216 to 0218, L2D; 0219): the storefront as entered and derived, its lists
    -- in the order chosen, its identity (layer N), its network lines with their exact figures,
    -- their bands and their exact audience, the refused sectors and the history of the metrics
    -- (art. 15: the creator receives what concerns him); never public_ref nor the id of a line or
    -- of a history row (EC-L2D-06-1); an agent author of a history row shown as INFLUX
    'creator_profile', (
      select pg_catalog.jsonb_build_object(
               'alias', p.alias,
               'status', p.status,
               'is_searchable', p.is_searchable,
               'published_at', privacy.iso_utc(p.published_at),
               'headline', p.headline,
               'bio', p.bio,
               'primary_topic', p.primary_topic_code,
               'secondary_topics', coalesce((
                  select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                    from profiles.creator_topics t
                   where t.account_id = p.account_id), '[]'::jsonb),
               'publication_languages', coalesce((
                  select pg_catalog.jsonb_agg(l.language_code order by l.slot)
                    from profiles.creator_publication_languages l
                   where l.account_id = p.account_id), '[]'::jsonb),
               'tones', coalesce((
                  select pg_catalog.jsonb_agg(t.tone_code order by t.slot)
                    from profiles.creator_tones t
                   where t.account_id = p.account_id), '[]'::jsonb),
               'formats', coalesce((
                  select pg_catalog.jsonb_agg(f.format_code order by f.format_code)
                    from profiles.creator_formats f
                   where f.account_id = p.account_id), '[]'::jsonb),
               'usage_rights', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'usage_right', u.usage_right_code, 'inclusion', u.inclusion)
                         order by u.usage_right_code)
                    from profiles.creator_usage_rights u
                   where u.account_id = p.account_id), '[]'::jsonb),
               'residence_country', p.residence_country_code,
               'residence_region', p.residence_region_code,
               'travel_scope', p.travel_scope,
               'collaboration_experience', p.collaboration_experience_band,
               'delivery_lead', p.delivery_lead_band,
               'max_exclusivity', p.max_exclusivity_band,
               'accepts_non_monetary', p.accepts_non_monetary,
               'availability', p.availability_band,
               'availability_declared_at', privacy.iso_utc(p.availability_declared_at),
               'main_audience_country', p.main_audience_country,
               'main_audience_share_band', p.main_audience_share_band,
               'audience_gender_band', p.audience_gender_band,
               'audience_share_bands', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'dimension', a.dimension, 'bucket', a.bucket,
                           'share_band', a.share_band)
                         order by a.dimension, a.bucket)
                    from profiles.creator_public_audience a
                   where a.account_id = p.account_id), '[]'::jsonb),
               'identity', (
                  select pg_catalog.jsonb_build_object(
                           'legal_first_name', i.legal_first_name,
                           'legal_last_name', i.legal_last_name,
                           'contact_email', i.contact_email, 'contact_phone', i.contact_phone,
                           'address_line', i.address_line, 'postal_code', i.postal_code,
                           'city', i.city, 'country_code', i.country_code,
                           'completeness_percent', i.completeness_percent,
                           'updated_at', privacy.iso_utc(i.updated_at))
                    from profiles.creator_identities i
                   where i.account_id = p.account_id),
               'refused_sectors', coalesce((
                  select pg_catalog.jsonb_agg(r.sector_code order by r.sector_code)
                    from profiles.creator_refused_sectors r
                   where r.account_id = p.account_id), '[]'::jsonb),
               'networks', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'network', s.network_code,
                           'is_primary', s.is_primary,
                           'handle', s.handle,
                           'pseudonym', s.pseudonym,
                           'profile_url', s.profile_url,
                           'followers_count', s.followers_count,
                           'posts_last_30_days', s.posts_last_30_days,
                           'avg_comments_per_post', s.avg_comments_per_post,
                           'avg_reach_per_post', s.avg_reach_per_post,
                           'engagement_rate_bp', s.engagement_rate_bp,
                           'figures_source', s.figures_source,
                           'figures_measured_at', privacy.iso_utc(s.figures_measured_at),
                           'bands', (
                              select pg_catalog.jsonb_build_object(
                                       'audience', n.audience_band, 'reach', n.reach_band,
                                       'publication_frequency', n.publication_frequency_code,
                                       'comments', n.comment_band,
                                       'engagement', n.engagement_band)
                                from profiles.creator_public_networks n
                               where n.social_account_id = s.id),
                           'audience', pg_catalog.jsonb_build_object(
                              'countries', coalesce((
                                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                          'slot', c.slot, 'country_code', c.country_code,
                                          'share_percent', c.share_percent)
                                        order by c.slot)
                                   from profiles.creator_audience_countries c
                                  where c.social_account_id = s.id), '[]'::jsonb),
                              'ages', coalesce((
                                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                          'age_band', g.age_band_code,
                                          'share_percent', g.share_percent)
                                        order by g.age_band_code)
                                   from profiles.creator_audience_ages g
                                  where g.social_account_id = s.id), '[]'::jsonb),
                              'genders', coalesce((
                                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                          'gender', g.gender_code,
                                          'share_percent', g.share_percent)
                                        order by g.gender_code)
                                   from profiles.creator_audience_genders g
                                  where g.social_account_id = s.id), '[]'::jsonb)),
                           'created_at', privacy.iso_utc(s.created_at),
                           'updated_at', privacy.iso_utc(s.updated_at))
                         order by s.created_at, s.id)
                    from profiles.creator_social_accounts s
                   where s.account_id = p.account_id), '[]'::jsonb),
               'metrics_history', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'network', h.network_code,
                           'followers_count', h.followers_count,
                           'posts_last_30_days', h.posts_last_30_days,
                           'avg_comments_per_post', h.avg_comments_per_post,
                           'figures_source', h.figures_source,
                           'confirmed', h.confirmed,
                           'recorded_at', privacy.iso_utc(h.recorded_at),
                           'recorded_by', case when h.recorded_by_account_id = p.account_id
                                               then 'self' else 'INFLUX' end)
                         order by h.recorded_at, h.id)
                    from profiles.creator_network_metrics_history h
                   where h.account_id = p.account_id), '[]'::jsonb),
               -- 0226 (08 RG4, RG10; fiche invariant 16): each creator request (network, level,
               -- status, dates, reason, message to the creator) and each network badge (network,
               -- level, state, date, source, period, observed figures, expiry, withdrawal); never an
               -- evidence, a code, the observed handle, the platform reference, an agent, the lock,
               -- the internal comment nor the declared values at the decision (the gap, RG41).
               -- 0235 (fiche invariants 13, 14): the origin of each request (D83), the message of a
               -- withdrawal on its badge, each contest (target, network, level, reason, text, dates,
               -- state, outcome reason and message, cause of a withdrawal; never the deciders, the
               -- lock, the deadlines, review_mode nor the internal comment) and each entry of queue 6
               -- (network, the handle declared, count, dates, state, cause of a withdrawal; never the
               -- previous handle, the handle the agent read, an agent nor the internal comment)
               'verification', pg_catalog.jsonb_build_object(
                  'requests', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'network', r.network_code, 'level', r.level, 'status', r.status,
                              'created_at', privacy.iso_utc(r.created_at),
                              'submitted_at', privacy.iso_utc(r.submitted_at),
                              'decided_at', privacy.iso_utc(r.decided_at),
                              'rejection_reason', r.rejection_reason_code,
                              'member_message', r.member_message,
                              'cancelled_at', privacy.iso_utc(r.cancelled_at),
                              'closed_at', privacy.iso_utc(r.closed_at),
                              'opened_by', r.opened_by,
                              'opening_reason', r.opening_reason_code)
                            order by r.created_at, r.id)
                       from verification.verification_requests r
                      where r.account_id = p.account_id and r.population = 'creator'),
                     '[]'::jsonb),
                  'badges', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'network', b.network_code, 'level', b.level, 'state', b.state,
                              'granted_at', privacy.iso_utc(b.granted_at),
                              'source', b.evidence_source,
                              'period_start', b.observed_period_start,
                              'period_end', b.observed_period_end,
                              'observed_followers', b.observed_followers,
                              'observed_posts_last_30_days', b.observed_posts_last_30_days,
                              'observed_avg_comments', b.observed_avg_comments,
                              'observed_engagement_bp', b.observed_engagement_bp,
                              'expires_at', privacy.iso_utc(b.expires_at),
                              'revoked_at', privacy.iso_utc(b.revoked_at),
                              'revocation_reason', b.revocation_reason_code,
                              'revocation_message', (
                                 select q.member_message
                                   from verification.badge_revocation_requests q
                                  where q.dual_control_request_id = b.revocation_request_id
                                    and q.badge_id = b.id and q.executed_at is not null))
                            order by b.granted_at, b.id)
                       from verification.badges b
                      where b.account_id = p.account_id and b.level <> 'brand_verified'),
                     '[]'::jsonb),
                  'disputes', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'target', case when d.request_id is not null then 'refusal'
                                             else 'withdrawal' end,
                              'network', d.network_code, 'level', d.level,
                              'reason', d.reason_code,
                              'text', d.text,
                              'submitted_at', privacy.iso_utc(d.submitted_at),
                              'state', d.state,
                              'outcome_reason', d.outcome_reason_code,
                              'member_message', d.member_message,
                              'decided_at', privacy.iso_utc(d.decided_at),
                              'withdrawn_cause', d.withdrawn_cause,
                              'closed_at', privacy.iso_utc(d.closed_at))
                            order by d.submitted_at, d.id)
                       from verification.disputes d
                      where d.account_id = p.account_id), '[]'::jsonb),
                  'identifier_changes', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'network', i.network_code,
                              'new_handle', i.new_handle,
                              'change_count', i.change_count,
                              'created_at', privacy.iso_utc(i.created_at),
                              'last_changed_at', privacy.iso_utc(i.last_changed_at),
                              'state', i.state,
                              'decided_at', privacy.iso_utc(i.decided_at),
                              'withdrawn_cause', i.withdrawn_cause,
                              'closed_at', privacy.iso_utc(i.closed_at))
                            order by i.created_at, i.id)
                       from verification.identifier_change_reviews i
                      where i.account_id = p.account_id), '[]'::jsonb)),
               -- 0245 (fiche invariant 15; modele -14): each visual (state, place, replacement,
               -- size, sides, caption, dates, refusal reason) with its statements of RG83 (caption
               -- declared, key of the text, instant); never the bytes, the key, the checksum, an
               -- agent, the lock, the deadlines, the internal comment nor the retention (EC-L2G-05-3)
               'portfolio', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'state', v.state,
                           'display_order', v.display_order,
                           'replacement', v.replaces_item_id is not null,
                           'byte_size', v.byte_size, 'width', v.width, 'height', v.height,
                           'caption', v.caption,
                           'created_at', privacy.iso_utc(v.created_at),
                           'stored_at', privacy.iso_utc(v.stored_at),
                           'decided_at', privacy.iso_utc(v.decided_at),
                           'rejection_reason', v.rejection_reason_code,
                           'withdrawn_at', privacy.iso_utc(v.withdrawn_at),
                           'purged_at', privacy.iso_utc(v.purged_at),
                           'brand_declarations', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'caption', d.caption,
                                       'statement_key', d.statement_key,
                                       'declared_at', privacy.iso_utc(d.declared_at))
                                     order by d.declared_at, d.id)
                                from profiles.portfolio_brand_declarations d
                               where d.portfolio_item_id = v.id
                                 and d.account_id = v.account_id), '[]'::jsonb))
                         order by v.created_at, v.id)
                    from profiles.portfolio_items v
                   where v.account_id = p.account_id), '[]'::jsonb),
               -- 0245: each examination of queue 2 (kind, state, dates, reason, message to the
               -- creator); never the internal comment, an agent, the lock nor the deadlines
               'review_entries', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'kind', e.kind, 'state', e.state,
                           'created_at', privacy.iso_utc(e.created_at),
                           'decided_at', privacy.iso_utc(e.decided_at),
                           'rejection_reason', e.rejection_reason_code,
                           'member_message', e.member_message,
                           'closed_at', privacy.iso_utc(e.closed_at))
                         order by e.created_at, e.id)
                    from profiles.creator_review_entries e
                   where e.account_id = p.account_id), '[]'::jsonb),
               -- 0245 (04 §5.2): each value submitted for a moderated creator field, without its row
               -- key nor the id of a statement (EC-L2G-05-2)
               'field_revisions', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'field', r.field_code,
                           'proposed_value',
                              case when pg_catalog.jsonb_typeof(r.proposed_value) = 'object'
                                   then r.proposed_value - 'brand_declaration_id'
                                   else r.proposed_value end,
                           'status', r.status,
                           'submitted_at', privacy.iso_utc(r.submitted_at),
                           'closed_at', privacy.iso_utc(r.closed_at))
                         order by r.submitted_at, r.field_code)
                    from profiles.creator_field_revisions r
                   where r.account_id = p.account_id), '[]'::jsonb),
               -- 0314 (l3d/modele.md §6; 11 RG22): each read of the feed of the open campaigns or
               -- of a campaign record (kind, campaign asked, sort, page, outcome, instant); never
               -- the id of a line (EC-L3D-02-1)
               'campaign_reads', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'kind', r.kind,
                           'campaign_id', r.campaign_id,
                           'feed_sort', r.feed_sort,
                           'feed_page', r.feed_page,
                           'outcome', r.outcome,
                           'read_at', privacy.iso_utc(r.read_at))
                         order by r.read_at, r.id)
                    from search.creator_campaign_reads r
                   where r.creator_account_id = p.account_id), '[]'::jsonb),
               -- 0318 (modele §9; 10 RG30): the blocks the creator posed (the brand's legal name,
               -- reason, comment, dates); never a block posed against it nor by INFLUX; never an
               -- impression, a reason nor an exposure (RG8)
               'blocks', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'brand', a.legal_name,
                           'reason', b.reason_code,
                           'comment', b.comment,
                           'created_at', privacy.iso_utc(b.created_at),
                           'lifted_at', privacy.iso_utc(b.lifted_at))
                         order by b.created_at, b.id)
                    from matching.party_blocks b
                    left join profiles.advertiser_profiles a
                      on a.account_id = b.advertiser_account_id
                   where b.creator_account_id = p.account_id
                     and b.blocked_by_side = 'creator'), '[]'::jsonb),
               'created_at', privacy.iso_utc(p.created_at),
               'updated_at', privacy.iso_utc(p.updated_at))
        from profiles.creator_public_profiles p
       where p.account_id = p_account_id),

    -- Consentements: purpose, value, date, origin, evidence
    'consents', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'purpose', c.purpose, 'granted', c.granted, 'source', c.source,
               'occurred_at', privacy.iso_utc(c.occurred_at), 'evidence', c.evidence)
             order by c.occurred_at, c.id)
        from identity.consent_events c
       where c.account_id = p_account_id), '[]'::jsonb),

    -- Conditions acceptées: version, date, nature, channel, language, IP address and browser
    'terms_acceptances', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'document_kind', v.document_kind, 'version_label', v.version_label,
               'version_locale', v.locale, 'accepted_at', privacy.iso_utc(t.accepted_at),
               'nature', t.nature, 'channel', t.channel, 'locale', t.locale,
               'ip_address', pg_catalog.host(t.ip_address), 'user_agent', t.user_agent)
             order by t.accepted_at, t.id)
        from identity.terms_acceptances t
        join identity.terms_versions v on v.id = t.terms_version_id
       where t.account_id = p_account_id), '[]'::jsonb),

    -- Sessions: creation, last activity, browser, country; never the token digest
    'sessions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'created_at', privacy.iso_utc(s.created_at),
               'last_activity_at', privacy.iso_utc(s.last_activity_at),
               'surface', s.surface, 'browser', s.user_agent_summary,
               'country_code', s.country_code, 'revoked_at', privacy.iso_utc(s.revoked_at),
               'revocation_reason', s.revocation_reason)
             order by s.created_at, s.id)
        from identity.sessions s
       where s.account_id = p_account_id), '[]'::jsonb),

    -- E-mails transactionnels: code, date, language, status; never the content of a code
    'transactional_emails', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'email_code', t.email_code, 'priority', t.priority, 'locale', t.locale,
               'status', t.status, 'created_at', privacy.iso_utc(t.created_at),
               'sent_at', privacy.iso_utc(t.sent_at),
               'delivered_at', privacy.iso_utc(t.delivered_at),
               'failed_at', privacy.iso_utc(t.failed_at))
             order by t.created_at, t.id)
        from leads.transactional_sends t
       where t.account_id = p_account_id
          -- by address only when the line names no account (EC-J8-55)
          or (t.account_id is null and t.recipient_email = any (p_addresses))), '[]'::jsonb),

    -- Changements d'adresse: old and new addresses, dates; never the digests
    'email_changes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'old_email', r.old_email, 'new_email', r.new_email,
               'created_at', privacy.iso_utc(r.created_at),
               'completed_at', privacy.iso_utc(r.completed_at),
               'cancelled_at', privacy.iso_utc(r.cancelled_at),
               'cancel_reason', r.cancel_reason)
             order by r.created_at, r.id)
        from identity.email_change_requests r
       where r.account_id = p_account_id), '[]'::jsonb),

    -- Incidents de délivrance: type, date, address concerned
    'email_delivery_incidents', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'incident_type', i.incident_type, 'channel', i.channel,
               'occurred_at', privacy.iso_utc(i.occurred_at), 'email_address', i.email_address)
             order by i.occurred_at, i.id)
        from identity.email_delivery_incidents i
       where i.account_id = p_account_id), '[]'::jsonb),

    -- Signalements de secours naming a current or former address of the account
    'delivery_reports', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'received_at', privacy.iso_utc(d.received_at), 'login_email', d.login_email,
               'contact_email', d.contact_email, 'message', d.message, 'status', d.status)
             order by d.received_at, d.id)
        from backoffice.code_delivery_reports d
       where d.login_email = any (p_addresses)
          or d.contact_email = any (p_addresses)), '[]'::jsonb),

    -- Événements reçus de Brevo rattachés au compte (30 days window by purge)
    'brevo_events', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'event', e.event, 'occurred_at', privacy.iso_utc(e.occurred_at),
               'outcome', o.outcome, 'processed_at', privacy.iso_utc(o.processed_at))
             order by o.processed_at, o.event_id)
        from leads.brevo_inbound_outcomes o
        join leads.brevo_inbound_events e on e.id = o.event_id
       where o.account_id = p_account_id), '[]'::jsonb),

    -- Journal d'activité: code and date, an internal actor shown as INFLUX, no payload, no hash;
    -- 0302 (F3, jalons/l3a/f3.md): the codes classified exported only; 0310 (L3BS-5): the lines whose
    -- subject is a campaign of the account (the decisions and interventions of INFLUX, the system
    -- closure), an agent or the system shown as INFLUX, never named
    'activity_log', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', e.event_type, 'occurred_at', privacy.iso_utc(e.occurred_at),
               'actor', case when e.actor_account_id = p_account_id then 'self' else 'INFLUX' end)
             order by e.seq)
        from audit.audit_events e
        join audit.event_types t on t.code = e.event_type and t.export_class = 'exported'
       where e.actor_account_id = p_account_id
          or (e.subject_type = 'account' and e.subject_id = p_account_id)
          or (e.subject_type = 'campaign'
              and e.subject_id in (select c.id from campaigns.campaigns c
                                    where c.advertiser_account_id = p_account_id))
          or (e.subject_type = 'data_subject_request'
              and e.subject_id in (select d.id from backoffice.data_subject_requests d
                                    where d.requester_account_id = p_account_id))), '[]'::jsonb),

    -- Rapports d'erreur of the account: date, route, service; the message and the browser of a
    -- BROWSER report only (a server message is a technical trace, EC-J8-56); never the stack
    'error_reports', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'occurred_at', privacy.iso_utc(x.occurred_at), 'route', x.route,
               'service', x.service,
               'message', case when x.service in ('web', 'backoffice') then x.message end,
               'browser', case when x.service in ('web', 'backoffice')
                               then x.user_agent_summary end)
             order by x.occurred_at, x.id)
        from ops.error_occurrences x
       where x.account_id = p_account_id), '[]'::jsonb),

    -- Demandes « mes données » of the requester
    'data_requests', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', d.id, 'request_type', d.request_type, 'channel', d.channel,
               'received_at', privacy.iso_utc(d.received_at), 'due_at', privacy.iso_utc(d.due_at),
               'status', d.status, 'completed_at', privacy.iso_utc(d.completed_at),
               'outcome', d.outcome_code)
             order by d.received_at, d.id)
        from backoffice.data_subject_requests d
       where d.requester_account_id = p_account_id), '[]'::jsonb),

    -- Destinataires: external id, last state, unsubscription
    'recipients', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'destination', s.destination, 'external_contact_id', s.external_contact_id,
               'last_status', s.last_status,
               'last_attempt_at', privacy.iso_utc(s.last_attempt_at),
               'last_success_at', privacy.iso_utc(s.last_success_at),
               'unsubscribed_at', privacy.iso_utc(s.unsubscribed_at),
               'suppressed_reason', s.suppressed_reason)
             order by s.destination)
        from leads.contact_sync_states s
       where s.account_id = p_account_id), '[]'::jsonb));

  return pg_catalog.jsonb_build_object(
    'format', 'influx.data_export',
    'version', 1,
    'generated_at', privacy.iso_utc(pg_catalog.now()),
    'account_id', p_account_id,
    'language', v_language,
    'time_zone', v_zone,
    'notice', p_notice,
    'categories', pg_catalog.to_jsonb(privacy.export_categories()),
    'data', v_data);
end
$$;

comment on function privacy.export_document(uuid, text[], jsonb) is
  'The export of an access request (runbook §4; 15 RG81: the requester''s data only, never a third '
  'party''s, never a digest of a token, a code, a throttle or the chain): {format: influx.data_export, '
  'version: 1, generated_at, account_id, language, time_zone, notice, categories, data} with the 15 '
  'categories of privacy.export_categories() (EC-J8-48); advertiser_profile carries the whole brand '
  'profile of 0202, its lists and its contact person (04 §9.2), and logo_files, the metadata of '
  'its logo objects (0204: state, size, sides, dates; never the bytes nor the key), review_entries '
  '(0207: kind, state, dates, reason, message to the brand; never the internal comment, an agent '
  'nor the lock), field_revisions (0207: field, row, value, status, dates) and verification (0226: '
  'the internal block, the brand requests and badges) and campaigns (0306: each campaign as entered, '
  'its internal reference, total budget and budget band included, its state, dates and lists in '
  'their order, its declaration of RG85: instant, locale, hex hash; never its id, the author of '
  'the declaration, the suspended range nor erased_at; 0310: its cycle first_published_at, '
  'paused_at, pause_origin, closed_at, its reviews of queue 7 (state, dates, reason, message to the '
  'brand), its snapshots (version, instant, content, hex hash) and the interventions of INFLUX '
  '(kind, field, old and new value, reason, instant); never an agent, the commercial owner, a lock, '
  'a deadline, the first review, the duplicate alert nor an internal comment), creator_searches '
  '(0318: instant, filters, sort, page, outcome, count_band of a search served above k or NULL, k '
  'block, campaign_title; never the exact count, an impression, a reason, an exposure nor a creator '
  'served), shortlists (0318: name, campaign_title, date, creators by alias with date and note) and '
  'blocks (0318: those the brand posed, creator_alias, reason, comment, dates); creator_profile '
  '(0219) carries the creator '
  'storefront of 0216 and 0218, its five lists, its identity, its network lines with their exact '
  'figures, bands and exact audience, the refused sectors, the history of the metrics (an agent '
  'author shown as INFLUX) and verification (0226: the creator requests and the network badges with '
  'their observed figures and period; 0235: disputes, identifier_changes), portfolio (0245: each '
  'visual, its state, place, replacement, size, sides, caption, dates and refusal reason, with its '
  'statements of RG83; never the bytes, the key nor the checksum), review_entries (0245: kind, '
  'state, dates, reason, message to the creator), field_revisions (0245: field, value, status, '
  'dates; never the row key) and campaign_reads (0314: kind, campaign asked, sort, page, outcome, '
  'instant of each read of the feed or of a campaign record; never the id of a line) and blocks '
  '(0318: those the creator posed, brand legal name, reason, comment, dates; never a block posed '
  'against the member nor by INFLUX, never who lifted it, never an impression); every '
  'request carries '
  'opened_by and opening_reason, every badge revocation_message (0235); never public_ref nor the id '
  'of a line or a history row, never an evidence, a code, an observed or previous handle, an agent, '
  'a decider, a lock, an internal or opening comment nor a declared value at a decision; NULL '
  'without a storefront; activity_log serves the codes whose export_class is exported only '
  '(0302, F3), the lines of the account, about the account and, since 0310 (L3BS-5), about its '
  'campaigns, an internal or system actor shown as INFLUX. p_addresses: privacy.account_addresses(). SECURITY INVOKER owned by '
  'influx_privacy_definer, NO grant.';

-- 2.2 The execution (0150 ... 0310, 0314): the erasure deletes the search and the blocks ------------
create or replace function privacy.execute_request(
  p_request_id  uuid,
  p_notice      jsonb
)
returns table (
  request_type  text,
  auth_user_id  uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_exec       record;
  v_account    record;
  v_addresses  text[];
  v_marker     text;
  v_document   jsonb;
  v_content    text;
  v_bytes      bytea;
  v_digest     bytea;
  v_export     uuid;
  v_fact       uuid := pg_catalog.gen_random_uuid();
  v_mail       uuid := pg_catalog.gen_random_uuid();
  v_withdrawn  uuid[];
  v_access     uuid;
begin
  -- The authorised, not yet executed row; another worker holding it, or nothing to do: no row.
  select e.request_id, e.request_type, e.account_id
    into v_exec
    from privacy.request_executions e
   where e.request_id = p_request_id
     and e.executed_at is null
     for update skip locked;
  if not found then
    return;
  end if;

  -- The request is still open; the requester is still an active account (locked).
  perform 1 from backoffice.data_subject_requests d
   where d.id = p_request_id and d.status <> 'closed'
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select a.id, a.email, a.auth_user_id
    into v_account
    from identity.accounts a
   where a.id = v_exec.account_id and a.status = 'active'
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- EC-J8-42: the current and former addresses, read before anything changes
  v_addresses := privacy.account_addresses(v_account.id);

  if v_exec.request_type = 'access' then
    -- The notice of art. 15(1) a-h and 15(2), rendered by apps/api in the account's language
    -- (runbook §4), stored verbatim in the file.
    if p_notice is null or pg_catalog.jsonb_typeof(p_notice) <> 'object'
       or pg_catalog.octet_length(p_notice::text) > 65536 then
      raise exception 'the notice is a JSON object of at most 64 KiB'
        using errcode = 'invalid_parameter_value';
    end if;

    update privacy.request_executions set executed_at = pg_catalog.now()
     where request_id = p_request_id;

    -- Built FROM THE BASE, serialised ONCE: the stored text is the file delivered.
    v_document := privacy.export_document(v_account.id, v_addresses, p_notice);
    v_content  := pg_catalog.jsonb_pretty(v_document);
    v_bytes    := pg_catalog.convert_to(v_content, 'UTF8');
    v_digest   := pg_catalog.sha256(v_bytes);

    insert into privacy.data_exports (request_id, account_id, content, sha256, size_bytes, categories)
    values (p_request_id, v_account.id, v_content, v_digest, pg_catalog.octet_length(v_bytes),
            privacy.export_categories())
    returning id into v_export;

    -- runbook §4: the e-mail "export available until ...", P1, ids only, once per request
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values
      (v_fact, 'privacy.export_ready', 'brevo_transactional', 'account:' || v_account.id::text, 100,
       pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account.id,
                                     'request_id', p_request_id, 'export_id', v_export,
                                     'email_code', 'privacy.export_ready'),
       'privacy.export_ready:' || p_request_id::text);

    -- last: the chain lock is held until COMMIT (04 §7.2); never the content
    perform audit.append('privacy.export_published', 'data_subject_request', p_request_id,
                         pg_catalog.jsonb_build_object(
                           'sha256', pg_catalog.encode(v_digest, 'hex'),
                           'size_bytes', pg_catalog.octet_length(v_bytes),
                           'categories', pg_catalog.to_jsonb(privacy.export_categories())));
    return query select 'access'::text, null::uuid;
    return;
  end if;

  -- Erasure (04 §9.2, 21 §J8 point 6): the tables of Lot 1, the brand profile of L2B (0202), its
  -- logo (0204), its examinations (0207), the creator profile of L2D (0219), the verification of
  -- L2E (0226), of L2F (0235), the portfolio and queue 2 of L2G (0245), the campaigns of L3B (0306)
  -- and their entries, snapshots and interventions of L3C (0310), the reads of the open campaigns of
  -- L3D (0314), the creator search and the blocks of L3E (0318), in ONE transaction.
  if p_notice is not null then
    raise exception 'an erasure takes no notice' using errcode = 'invalid_parameter_value';
  end if;
  v_marker := 'deleted+' || v_account.id::text || '@invalid';

  -- the address the Brevo deletion and the confirmation e-mail need, held until the closure
  -- (EC-J8-46, D72)
  update privacy.request_executions
     set executed_at = pg_catalog.now(), propagation_email = v_account.email
   where request_id = p_request_id;

  -- 1. the account: deleted, access closed, directly identifying data replaced (EC-J8-38)
  update identity.accounts
     set status        = 'deleted',
         deleted_at    = pg_catalog.now(),
         anonymized_at = pg_catalog.now(),
         email         = v_marker,
         display_name  = null
   where id = v_account.id;

  -- 2. the sessions, deleted with their re-authentication markers (04 §9.1, EC-J8-37)
  delete from identity.sessions where account_id = v_account.id;

  -- 3. the advertiser profile: the legal name (NOT NULL: a neutral label, EC-J8-38) and every
  -- column the brand entered (0202, EC-L2B-05-6), in ONE statement (the policy of the owner checks
  -- them together); its lists deleted; its contact person emptied, the row kept (04 §9.2)
  update profiles.advertiser_profiles
     set legal_name           = '[deleted]',
         primary_sector_code  = null,
         company_size_band    = null,
         website_domain       = null,
         presentation         = null,
         exclusivity_band     = null,
         collaboration_rhythm = null,
         offers_non_monetary  = null,
         contact_role         = null,
         completeness_percent = null
   where account_id = v_account.id;
  delete from profiles.advertiser_secondary_sectors where account_id = v_account.id;
  delete from profiles.advertiser_target_markets where account_id = v_account.id;
  delete from profiles.advertiser_working_languages where account_id = v_account.id;
  delete from profiles.advertiser_topics where account_id = v_account.id;
  delete from profiles.advertiser_networks where account_id = v_account.id;
  delete from profiles.advertiser_formats where account_id = v_account.id;
  delete from profiles.advertiser_audience_countries where account_id = v_account.id;
  delete from profiles.advertiser_usage_rights where account_id = v_account.id;
  update profiles.advertiser_contact_details
     set contact_first_name = null,
         contact_email      = null,
         contact_phone      = null,
         contact_url        = null
   where account_id = v_account.id;

  -- 3 bis. the logo (0204, stockage.md §7): every object of the account to purge, unreachable at
  -- once, removed from Storage by the task storage_purge; its daily usage deleted
  update profiles.brand_logo_objects
     set state              = 'purging',
         purge_requested_at = pg_catalog.now()
   where account_id = v_account.id and state <> 'purging';
  delete from profiles.storage_daily_usage where account_id = v_account.id;

  -- 3 ter. the examinations (0207, file.md A1): the submitted values deleted; the entries kept,
  -- pseudonymous (the trace of a human decision, 06 RG6), their texts emptied, an open one
  -- withdrawn now
  delete from profiles.profile_field_revisions where account_id = v_account.id;
  update profiles.advertiser_review_entries
     set state            = case when state = 'open' then 'withdrawn'::profiles.review_entry_state
                                 else state end,
         closed_at        = coalesce(closed_at, pg_catalog.now()),
         member_message   = null,
         internal_comment = null
   where account_id = v_account.id;

  -- 3 quater. the creator profile (0216 to 0218; modele.md §0219; Q18): the storefront kept (its
  -- keys, its alias, its country), suspended, out of every search, every other column emptied in
  -- ONE statement (the policy checks them together; EC-L2D-06-2); its lists, its derived rows, its
  -- exact audience, its refused sectors and the history of its metrics deleted; its identity
  -- emptied, the row kept (04 §9.2, EC-L2D-06-3); its network lines kept for L2E, their handle,
  -- pseudonym, URL, figures and date emptied (EC-L2D-06-4). Nothing is derived again: every trigger
  -- of 0218 and the history guard of 0217 skip influx_privacy_definer.
  update profiles.creator_public_profiles
     set status                         = 'suspended',
         is_searchable                  = false,
         published_at                   = null,
         headline                       = null,
         bio                            = null,
         primary_topic_code             = null,
         residence_region_code          = null,
         travel_scope                   = null,
         collaboration_experience_band  = null,
         main_audience_country          = null,
         main_audience_share_band       = null,
         audience_gender_band           = null,
         delivery_lead_band             = null,
         max_exclusivity_band           = null,
         accepts_non_monetary           = false,
         availability_band              = null,
         availability_declared_at       = null
   where account_id = v_account.id;
  delete from profiles.creator_topics where account_id = v_account.id;
  delete from profiles.creator_publication_languages where account_id = v_account.id;
  delete from profiles.creator_tones where account_id = v_account.id;
  delete from profiles.creator_formats where account_id = v_account.id;
  delete from profiles.creator_usage_rights where account_id = v_account.id;
  delete from profiles.creator_public_audience where account_id = v_account.id;
  delete from profiles.creator_public_networks where account_id = v_account.id;
  delete from profiles.creator_audience_countries where account_id = v_account.id;
  delete from profiles.creator_audience_ages where account_id = v_account.id;
  delete from profiles.creator_audience_genders where account_id = v_account.id;
  delete from profiles.creator_refused_sectors where account_id = v_account.id;
  delete from profiles.creator_network_metrics_history where account_id = v_account.id;
  update profiles.creator_identities
     set legal_first_name      = null,
         legal_last_name       = null,
         contact_email         = null,
         contact_phone         = null,
         address_line          = null,
         postal_code           = null,
         city                  = null,
         country_code          = null,
         completeness_percent  = 0
   where account_id = v_account.id;
  update profiles.creator_social_accounts
     set handle                 = null,
         pseudonym              = null,
         profile_url            = null,
         followers_count        = null,
         posts_last_30_days     = null,
         avg_comments_per_post  = null,
         avg_reach_per_post     = null,
         engagement_rate_bp     = null,
         figures_measured_at    = null
   where account_id = v_account.id;

  -- 3 quinquies. the verification (0221 to 0225; 08 §8 « Le compte est supprimé »; 04 §9.1): the
  -- decisions and the badges kept 3 years, pseudonymous (08 Q2), everything that names the person
  -- removed. The open requests withdrawn (cancelled: the trigger of 0223 puts their evidence to
  -- purging) and, for every request, the message, the internal comment and the lock emptied in ONE
  -- statement (the policy checks them together; EC-L2E-10-6); the codes deleted with the agent's
  -- finding (handle, platform reference, domain); the holding badges revoked account_closed and
  -- every badge without its handle ('[deleted]', EC-L2E-10-3) nor its platform reference
  -- (EC-L2E-10-4); every remaining evidence to purging, removed from Storage by the task
  -- storage_purge, its row and checksum kept (08 RG86); the internal block of a brand deleted
  -- (EC-L2E-10-5). The history rows agent_observed of 0225 went with the history above.
  update verification.verification_requests
     set status                = case when status in ('draft', 'pending')
                                      then 'cancelled'::verification.request_status
                                      else status end,
         cancelled_at          = case when status in ('draft', 'pending') then pg_catalog.now()
                                      else cancelled_at end,
         closed_at             = coalesce(closed_at, pg_catalog.now()),
         member_message        = null,
         internal_comment      = null,
         opening_comment       = null,
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null
   where account_id = v_account.id;
  delete from verification.ownership_codes where account_id = v_account.id;
  update verification.badges
     set state                         = case when state in ('active', 'to_refresh', 'to_reconfirm')
                                              then 'revoked'::verification.badge_state
                                              else state end,
         revoked_at                    = case when state in ('active', 'to_refresh', 'to_reconfirm')
                                              then pg_catalog.now() else revoked_at end,
         revocation_reason_code        = case when state in ('active', 'to_refresh', 'to_reconfirm')
                                              then 'account_closed' else revocation_reason_code end,
         observed_handle_at_decision   = case when level = 'brand_verified' then null
                                              else '[deleted]' end,
         observed_platform_account_ref = null
   where account_id = v_account.id;
  update verification.evidence_files
     set state              = 'purging',
         purge_requested_at = pg_catalog.now()
   where account_id = v_account.id and state in ('pending', 'active');
  delete from profiles.advertiser_internal_details where account_id = v_account.id;

  -- 3 sexies. the data of L2F (0231 to 0234; l2f-fiche invariant 14; 04 §9.1): the withdrawal
  -- requests, the contests and the entries of queue 6 kept 3 years with the decisions, pseudonymous;
  -- every text emptied (texts_erased_at written), an open contest or entry withdrawn account_erased
  -- and its lock cleared, in ONE statement each (the policies check them together); no register line
  -- (EC-L2F-10-4). The opening comment of a request went with its other texts above.
  update verification.badge_revocation_requests
     set member_message  = null,
         texts_erased_at = coalesce(texts_erased_at, pg_catalog.now())
   where account_id = v_account.id;
  update verification.disputes
     set state                 = case when state = 'open'
                                      then 'withdrawn'::verification.dispute_state else state end,
         withdrawn_cause       = case when state = 'open' then 'account_erased'
                                      else withdrawn_cause end,
         closed_at             = coalesce(closed_at, pg_catalog.now()),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null,
         text                  = null,
         member_message        = null,
         internal_comment      = null,
         texts_erased_at       = coalesce(texts_erased_at, pg_catalog.now())
   where account_id = v_account.id;
  update verification.identifier_change_reviews
     set state                 = case when state = 'open'
                                      then 'withdrawn'::verification.identifier_review_state
                                      else state end,
         withdrawn_cause       = case when state = 'open' then 'account_erased'
                                      else withdrawn_cause end,
         closed_at             = coalesce(closed_at, pg_catalog.now()),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null,
         previous_handle       = null,
         new_handle            = null,
         observed_handle       = null,
         internal_comment      = null,
         texts_erased_at       = coalesce(texts_erased_at, pg_catalog.now())
   where account_id = v_account.id;

  -- 3 septies. the data of L2G (0242 to 0244; l2g/modele -14; fiche invariant 15): every visual to
  -- purging at once (the erasure prevails over the 30 days of retention), removed from Storage by the
  -- task storage_purge, its row and its decision kept, pseudonymous; its caption, its internal comment
  -- and the link to its statement emptied in ONE statement (the policy checks them together); the
  -- statements of RG83 and the creator revisions deleted; the entries of queue 2 kept, pseudonymous
  -- (the trace of a human decision, as 0207), their texts emptied, an open one withdrawn now. The
  -- triggers of 0242 and 0243 that act for a member or a former creator skip influx_privacy_definer;
  -- the daily Storage usage went with 3 bis.
  update profiles.portfolio_items
     set state                = case when state in ('purging', 'purged') then state
                                     else 'purging'::profiles.portfolio_item_state end,
         caption              = null,
         internal_comment     = null,
         brand_declaration_id = null
   where account_id = v_account.id;
  delete from profiles.portfolio_brand_declarations where account_id = v_account.id;
  delete from profiles.creator_field_revisions where account_id = v_account.id;
  update profiles.creator_review_entries
     set state            = case when state = 'open' then 'withdrawn'::profiles.review_entry_state
                                 else state end,
         closed_at        = coalesce(closed_at, pg_catalog.now()),
         member_message   = null,
         internal_comment = null
   where account_id = v_account.id;

  -- 3 octies. the campaigns of L3B (0303 to 0305; l3b/modele.md §7; 09 l. 993; fiche invariant
  -- 10): nothing deleted (the connections of Lot 4 will point at them); every campaign closed and
  -- marked erased, its free texts, its internal reference and its total budget emptied in ONE
  -- statement (the policy checks them together); its key messages (free texts) deleted; its codes,
  -- dates, budget band and declaration of RG85 kept, pseudonymous. The freeze of 0303 does not act
  -- for influx_privacy_definer; no register line (03 P8). 0310 (l3c/modele.md §9; EC-L3C-05-3, -4):
  -- the entries of queue 7 kept, pseudonymous (the trace of a human decision, as 0207), an open one
  -- withdrawn and its lock cleared, their message, comment and opinion emptied (texts_erased_at);
  -- the free texts of every snapshot emptied, its codes, version, instant and hash kept; the values
  -- and the comment of every intervention emptied, its kind, field, reason and author kept. The
  -- guards of 0308 and 0309 let influx_privacy_definer alone through. Entries first: a withdrawn
  -- entry no longer waits on the campaign it closes.
  update campaigns.campaign_review_entries
     set state                 = case when state = 'open'
                                      then 'withdrawn'::campaigns.review_entry_state else state end,
         closed_at             = coalesce(closed_at, pg_catalog.now()),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null,
         member_message        = null,
         internal_comment      = null,
         first_review_opinion  = null,
         texts_erased_at       = coalesce(texts_erased_at, pg_catalog.now())
   where advertiser_account_id = v_account.id;
  update campaigns.campaign_published_snapshots s
     set payload = s.payload || pg_catalog.jsonb_build_object(
                                  'title', null, 'publicSummary', null, 'brief', null,
                                  'productDescription', null, 'restrictions', null,
                                  'keyMessages', '[]'::jsonb)
   where s.campaign_id in (select c.id from campaigns.campaigns c
                            where c.advertiser_account_id = v_account.id);
  update campaigns.agent_interventions
     set old_value        = null,
         new_value        = null,
         internal_comment = null
   where advertiser_account_id = v_account.id;
  delete from campaigns.campaign_key_messages m
   where m.campaign_id in (select c.id from campaigns.campaigns c
                            where c.advertiser_account_id = v_account.id);
  update campaigns.campaigns
     set status              = 'closed'::campaigns.campaign_status,
         erased_at           = pg_catalog.now(),
         title               = null,
         public_summary      = null,
         brief               = null,
         internal_reference  = null,
         product_description = null,
         restrictions        = null,
         total_budget_minor  = null
   where advertiser_account_id = v_account.id;

  -- 3 nonies. the reads of the open campaigns of L3D (0314; l3d/modele.md §6; 04 §9): every line of
  -- the account deleted, none kept pseudonymous; the account is deleted above, the only state the
  -- policy and the guard of the journal let the owner of the erasure delete in
  delete from search.creator_campaign_reads where creator_account_id = v_account.id;

  -- 3 decies. the creator search and the blocks of L3E (0316, 0317; l3e/modele.md §9; 04 §9;
  -- EC-L3E-05-3): deleted, none kept pseudonymous. A brand: its searches with their impressions and
  -- reasons, its shortlists with their creators; a creator: its impressions and reasons in any
  -- search, its place in any shortlist, its exposure; either: every block of a pair it belongs to,
  -- whoever posed it. Children first; the account is deleted above, the only state the policies and
  -- the guards of 0316 and 0317 let the owner of the erasure delete in
  delete from search.impression_reasons r
   where r.creator_account_id = v_account.id
      or r.search_query_id in (select q.id from search.search_queries q
                                where q.account_id = v_account.id);
  delete from search.search_impressions i
   where i.creator_account_id = v_account.id
      or i.search_query_id in (select q.id from search.search_queries q
                                where q.account_id = v_account.id);
  delete from search.search_queries where account_id = v_account.id;
  delete from search.creator_exposures where creator_account_id = v_account.id;
  delete from search.shortlist_items i
   where i.creator_account_id = v_account.id
      or i.shortlist_id in (select s.id from search.shortlists s
                             where s.advertiser_account_id = v_account.id);
  delete from search.shortlists where advertiser_account_id = v_account.id;
  delete from matching.party_blocks
   where advertiser_account_id = v_account.id or creator_account_id = v_account.id;

  -- 4. the plain addresses of the Lot 1 tables (21 §J8; EC-J8-39, EC-J8-40, EC-J8-41, EC-J8-44)
  -- the closed address changes: their two addresses only; the open one (at most one): cancelled
  -- account_deleted, its digests cleared (never read: the owner has no right on them)
  update identity.email_change_requests
     set old_email = v_marker,
         new_email = 'deleted+' || v_account.id::text || '.new@invalid'
   where account_id = v_account.id
     and (completed_at is not null or cancelled_at is not null);
  update identity.email_change_requests
     set old_email     = v_marker,
         new_email     = 'deleted+' || v_account.id::text || '.new@invalid',
         cancelled_at  = pg_catalog.now(),
         cancel_reason = 'account_deleted',
         old_code_hash = null,
         new_code_hash = null
   where account_id = v_account.id
     and completed_at is null and cancelled_at is null;

  update identity.email_delivery_incidents
     set email_address = v_marker,
         payload       = case when pg_catalog.strpos(payload::text, '@') > 0
                              then '{}'::jsonb else payload end
   where account_id = v_account.id;

  -- EC-J8-55: v_addresses holds no address another account holds or held, and a row that names
  -- an account is matched by address only when it names THIS one (or none)
  update backoffice.code_delivery_reports
     set login_email = v_marker, contact_email = v_marker, message = null
   where login_email = any (v_addresses) or contact_email = any (v_addresses);

  update leads.brevo_inbound_events e
     set email = null
   where e.email is not null
     and (e.account_ref = v_account.id
          or exists (select 1 from leads.brevo_inbound_outcomes o
                      where o.event_id = e.id and o.account_id = v_account.id)
          or (e.email = any (v_addresses)
              and (e.account_ref is null or e.account_ref = v_account.id)
              and not exists (select 1 from leads.brevo_inbound_outcomes o
                               where o.event_id = e.id and o.account_id <> v_account.id)));

  update leads.transactional_sends
     set recipient_email = v_marker
   where account_id is null and recipient_email = any (v_addresses);

  update backoffice.member_invitations i
     set email = v_marker
   where i.email <> v_marker
     and (i.account_id is null or i.account_id = v_account.id)
     and (i.account_id = v_account.id
          or i.email = any (v_addresses)
          or i.id = (select a.signup_invitation_id from identity.accounts a where a.id = v_account.id));

  -- 5. any export of the account still holding a content: purged (purged_at by the guard); the
  -- member can no longer sign in to download it (D72)
  update privacy.data_exports set content = null
   where account_id = v_account.id and purged_at is null;

  -- 5 bis. D72, EC-DZ-3: an access request of the account still open is withdrawn (at most one,
  -- index data_subject_requests_open_idx); its execution, if any, is left out of E-5 from now on
  with withdrawn as (
    update backoffice.data_subject_requests d
       set status = 'closed', outcome_code = 'retiree_par_le_demandeur'
     where d.requester_account_id = v_account.id
       and d.request_type = 'access'
       and d.status <> 'closed'
    returning d.id
  )
  select pg_catalog.array_agg(w.id) into v_withdrawn from withdrawn w;

  -- 6. 04 §9.2 point 4, 15 RG79: the propagation, P0, ids only (RG74), once per account by nature
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_fact, 'account.deleted', d.destination, 'account:' || v_account.id::text, 0,
         pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account.id,
                                       'request_id', p_request_id),
         'account.deleted:' || v_account.id::text
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  -- 7. D72 §2.2: the e-mail "your account is deleted" (the answer of art. 12(3)), P1, ids only,
  -- once per request, to the held address (privacy.read_erasure_notification_subject)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values
    (v_mail, 'privacy.erasure_completed', 'brevo_transactional', 'account:' || v_account.id::text,
     100,
     pg_catalog.jsonb_build_object('event_id', v_mail, 'account_id', v_account.id,
                                   'request_id', p_request_id,
                                   'email_code', 'privacy.erasure_completed'),
     'privacy.erasure_completed:' || p_request_id::text);

  -- last: the chain lock is held until COMMIT (04 §7.2)
  if v_withdrawn is not null then
    foreach v_access in array v_withdrawn loop
      perform audit.append('privacy.request_completed', 'data_subject_request', v_access,
                           pg_catalog.jsonb_build_object('request_type', 'access',
                                                         'outcome_code', 'retiree_par_le_demandeur'));
    end loop;
  end if;
  perform audit.append('account.anonymized', 'account', v_account.id,
                       pg_catalog.jsonb_build_object('request_id', p_request_id));

  -- the GoTrue user is deleted by the worker AFTER the commit (admin API), then recorded
  return query select 'erasure'::text, v_account.auth_user_id;
end
$$;

comment on function privacy.execute_request(uuid, jsonb) is
  'E-5 privacy.execute_request (03 P7; 15 RG75 step 6; 04 §9.2; 21 §J8 point 6; D72). Locks the '
  'authorised, not executed row FOR UPDATE SKIP LOCKED (none: no row). 42501 when the request is '
  'closed or the requester is no longer active. ACCESS: p_notice required (JSON object, 64 KiB at '
  'most, 22023 otherwise), stored under "notice"; the export built from the base '
  '(privacy.export_document), serialised once (jsonb_pretty), stored with its SHA-256, size and 15 '
  'categories, 7 days; privacy.export_ready to brevo_transactional (P1, ids, idempotency '
  'privacy.export_ready:<request>); privacy.export_published {sha256 hex, size_bytes, categories}; '
  'returns (access, NULL). ERASURE (admin 2V or member fresh code alike): p_notice NULL (22023 '
  'otherwise); the address held in propagation_email; account deleted, anonymised, '
  'deleted+<id>@invalid, display name NULL; its sessions DELETED (EC-J8-37); legal name [deleted] '
  'and the other brand profile columns NULL, its list rows deleted, its contact details NULL (0202); '
  'its logo objects to purging and its daily Storage usage deleted (0204); its field revisions '
  'deleted, the texts of its review entries emptied and an open entry withdrawn (0207); its '
  'creator storefront kept (keys, alias, country), suspended, not searchable, the rest emptied, its '
  'lists, derived rows, exact audience, refused sectors and metrics history deleted, its identity '
  'emptied, its network lines kept with handle, pseudonym, URL, figures and date emptied, nothing '
  'derived again (0219); its verification requests kept, open ones cancelled (their evidence to '
  'purging by the trigger of 0223), message, internal comment and lock emptied, its ownership codes '
  'deleted, its holding badges revoked account_closed and every badge without handle (''[deleted]'') '
  'nor platform reference, its remaining evidence to purging, its internal block deleted (0226); '
  'the opening comment of its requests, the message of its withdrawal requests, the texts of its '
  'contests and entries of queue 6 emptied (texts_erased_at), an open contest or entry withdrawn '
  'account_erased and its lock cleared, no register line (0235); its visuals to purging at once, '
  'their caption, internal comment and statement link emptied, its statements of RG83 and its '
  'creator revisions deleted, the texts of its entries of queue 2 emptied and an open one withdrawn '
  '(0245); its campaigns kept, closed, erased_at written, their free texts, internal reference and '
  'total budget emptied, their key messages deleted, codes, dates, band and declaration kept, no '
  'register line (0306); its entries of queue 7 kept, an open one withdrawn, their lock cleared, '
  'their message, comment and opinion emptied (texts_erased_at), the free texts of its snapshots '
  'emptied (null, keyMessages []), hash kept, the values and comment of its interventions emptied '
  '(0310); its reads of the open campaigns deleted (0314); its searches, impressions and their '
  'reasons, its exposure, its shortlists and its place in any shortlist, every block of a pair it '
  'belongs to deleted (0318); addresses replaced by the marker in '
  'email_change_requests (open ones cancelled account_deleted), '
  'email_delivery_incidents, code_delivery_reports (message cleared), transactional_sends, '
  'member_invitations; cleared in brevo_inbound_events; exports purged; an open access request '
  'closed retiree_par_le_demandeur with privacy.request_completed (EC-DZ-4); account.deleted to '
  'brevo_contact and apollo_contact (P0, ids, account.deleted:<account>); privacy.erasure_completed '
  'to brevo_transactional (P1, ids, privacy.erasure_completed:<request>); account.anonymized '
  '{request_id}; returns (erasure, auth_user_id) for the GoTrue deletion after the commit. SECURITY '
  'DEFINER owned by influx_privacy_definer, empty search_path; EXECUTE for influx_privacy ONLY.';

reset role;
revoke create on schema privacy from influx_privacy_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_privacy_definer', current_user);
end
$$;

-- 3. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  -- E-5: export_document() invoker, execute_request() definer, both of influx_privacy_definer, an
  -- empty search_path
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'privacy.export_document(uuid, text[], jsonb)'::regprocedure)
       <> 'influx_privacy_definer'
     or (select prosecdef from pg_catalog.pg_proc
          where oid = 'privacy.export_document(uuid, text[], jsonb)'::regprocedure)
     or (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
          where oid = 'privacy.execute_request(uuid, jsonb)'::regprocedure)
          <> 'influx_privacy_definer'
     or not (select prosecdef from pg_catalog.pg_proc
              where oid = 'privacy.execute_request(uuid, jsonb)'::regprocedure)
     or exists (select 1 from pg_catalog.pg_proc
                 where oid in ('privacy.export_document(uuid, text[], jsonb)'::regprocedure,
                               'privacy.execute_request(uuid, jsonb)'::regprocedure)
                   and proconfig is distinct from array['search_path=""']) then
    raise exception 'E-5 recreated with a wrong owner or mode';
  end if;

  -- §1: on the seven tables, influx_privacy_definer reads and deletes, never inserts nor updates
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid in ('search.search_queries'::regclass, 'search.search_impressions'::regclass,
                   'search.impression_reasons'::regclass, 'search.creator_exposures'::regclass,
                   'search.shortlists'::regclass, 'search.shortlist_items'::regclass,
                   'matching.party_blocks'::regclass)
     and (pg_catalog.has_table_privilege('influx_privacy_definer', c.oid, 'INSERT, UPDATE, TRUNCATE')
          or pg_catalog.has_any_column_privilege('influx_privacy_definer', c.oid, 'INSERT, UPDATE')
          or not pg_catalog.has_table_privilege('influx_privacy_definer', c.oid, 'DELETE')
          or not exists (select 1 from pg_catalog.pg_policy p
                          where p.polrelid = c.oid and p.polcmd = 'd'
                            and p.polroles = array['influx_privacy_definer'::regrole::oid]));
  if v_bad is not null then
    raise exception 'influx_privacy_definer: a write beyond the erasure, or a delete without its policy: %',
      v_bad;
  end if;

  -- RG30: never who lifted a block nor the reason of its lift; never the rank, the quota nor the
  -- reasons of an impression; nothing of the settings, the versions, the reasons nor the counters
  if pg_catalog.has_column_privilege('influx_privacy_definer', 'matching.party_blocks',
                                     'lifted_by_account_id', 'SELECT')
     or pg_catalog.has_column_privilege('influx_privacy_definer', 'matching.party_blocks',
                                        'lift_reason_code', 'SELECT')
     or pg_catalog.has_column_privilege('influx_privacy_definer', 'matching.party_blocks',
                                        'blocked_by_account_id', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_privacy_definer', 'matching.block_reasons',
                                            'SELECT, INSERT, UPDATE')
     or pg_catalog.has_column_privilege('influx_privacy_definer', 'search.search_impressions',
                                        'rank', 'SELECT')
     or pg_catalog.has_column_privilege('influx_privacy_definer', 'search.impression_reasons',
                                        'reason_params', 'SELECT') then
    raise exception 'influx_privacy_definer reads a column of a block or an impression it must not';
  end if;
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid in ('search.explanation_reasons'::regclass, 'search.facet_settings'::regclass,
                   'search.search_settings'::regclass, 'search.facet_config_versions'::regclass,
                   'search.supply_counters'::regclass)
     and (pg_catalog.has_table_privilege('influx_privacy_definer', c.oid,
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege('influx_privacy_definer', c.oid,
                                                 'SELECT, INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'influx_privacy_definer reaches a table of search outside the journal: %', v_bad;
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = 'influx_privacy_definer'::regrole
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE') then
    raise exception 'influx_privacy_definer left with a member or CREATE';
  end if;
end
$$;
