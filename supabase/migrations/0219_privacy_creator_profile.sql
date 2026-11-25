-- =============================================================================
-- 0219_privacy_creator_profile
-- -----------------------------------------------------------------------------
-- Lot 2 / L2D, commit 06 (jalons/l2d/06.md; l2d/modele.md §0219, which prevails for every name;
-- fiche invariant 9; 04 §9.2; 15 RG81). The rights of the data subject over the creator profile of
-- 0216 to 0218: every creator object enters the export and the erasure, in this milestone.
--
-- 1. influx_privacy_definer, column by column (modele.md « Droits », 03 P7 clause « L2D »): reads
--    what the export restitutes on every creator table (never public_ref); deletes the five lists,
--    the two derived tables, the three exact audience tables, the refused sectors and the history;
--    empties the storefront, the identity and the network lines. Its SELECT policies read every
--    row (as 0202, 0207); every DELETE and UPDATE policy is bound to an account already `deleted`,
--    and each UPDATE policy accepts the emptied row only (EC-L2B-05-6). Its writes fire no
--    derivation: every trigger of 0218 and the history guard of 0217 skip influx_privacy_definer.
-- 2. privacy.export_categories() recreated: `creator_profile` after `advertiser_profile`, 15
--    categories (the notice of apps/api, src/locales/*/data-export.json, follows).
-- 3. privacy.export_document() recreated FROM ITS 0207 VERSION: the category creator_profile
--    carries the storefront as entered and derived, its five lists in their order, its identity
--    (layer N), its network lines with their exact figures, bands and exact audience, the refused
--    sectors and the history of the metrics (art. 15: the creator receives what concerns him); an
--    agent author of a history row appears as INFLUX. NULL for an account without a storefront.
-- 4. privacy.execute_request() recreated FROM ITS 0207 VERSION: the erasure, in the same
--    transaction, keeps the storefront (account, public_ref, alias, country of residence),
--    `suspended`, out of every search, every other column emptied; deletes its lists, its derived
--    rows, its exact audience, its refused sectors and the history of its metrics (Q18); empties
--    its identity (row kept, 04 §9.2); keeps its network lines (L2E), their handle, pseudonym, URL,
--    figures and date emptied. Nothing in audit.* beyond the line account.anonymized of 0137.
--
-- Not here: any route (08, 09), the portfolio and the proofs of L2E and L2G (their own erasure
-- comes with them), the behaviour of a brand account (unchanged).
--
-- EC-L2D-06 (micro-gaps, the safest choice):
--   EC-L2D-06-1  the export carries neither public_ref nor the id of a line or of a history row
--                (keys [K], never served, as the ids of the brand's review entries in 0207); the
--                network of a history row names its line.
--   EC-L2D-06-2  published_at is emptied with the rest of the storefront (modele.md: « reste
--                vidé »); accepts_non_monetary, NOT NULL, goes back to its default false.
--   EC-L2D-06-3  completeness_percent of the identity, NOT NULL, goes back to its default 0.
--   EC-L2D-06-4  the network lines keep network_code, is_primary and figures_source (a code, a
--                boolean, a code: nothing identifying) for L2E; their derived rows are deleted
--                with the other public rows (« publics supprimés »), nothing derives them again.
--   EC-L2D-06-5  an account turned advertiser by identity.change_member_role() (0134) keeps its
--                storefront (modele.md point 6): the export and the erasure cover it whatever the
--                current role.
--
-- ROLLBACK (before any creator is erased): recreate privacy.export_categories() as in 0137,
-- privacy.export_document() and privacy.execute_request() as in 0207 (as influx_privacy_definer);
-- drop the policies *_privacy_definer_select and *_privacy_definer_erase of the fifteen creator
-- tables; revoke from influx_privacy_definer the grants of §1.
-- =============================================================================

-- 1. influx_privacy_definer: what the export reads and the erasure writes (04 §9.2) -----------------

-- 1.1 The storefront: read but public_ref; emptied, kept, suspended and out of every search
grant select (account_id, alias, status, is_searchable, published_at, headline, bio,
              primary_topic_code, residence_country_code, residence_region_code, travel_scope,
              collaboration_experience_band, main_audience_country, main_audience_share_band,
              audience_gender_band, delivery_lead_band, max_exclusivity_band, accepts_non_monetary,
              availability_band, availability_declared_at, created_at, updated_at)
   on profiles.creator_public_profiles to influx_privacy_definer;
grant update (status, is_searchable, published_at, headline, bio, primary_topic_code,
              residence_region_code, travel_scope, collaboration_experience_band,
              main_audience_country, main_audience_share_band, audience_gender_band,
              delivery_lead_band, max_exclusivity_band, accepts_non_monetary, availability_band,
              availability_declared_at)
   on profiles.creator_public_profiles to influx_privacy_definer;

drop policy if exists creator_public_profiles_privacy_definer_select on profiles.creator_public_profiles;
create policy creator_public_profiles_privacy_definer_select on profiles.creator_public_profiles
  for select to influx_privacy_definer
  using (true);

drop policy if exists creator_public_profiles_privacy_definer_erase on profiles.creator_public_profiles;
create policy creator_public_profiles_privacy_definer_erase on profiles.creator_public_profiles
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = creator_public_profiles.account_id and a.status = 'deleted'))
  with check (status = 'suspended' and not is_searchable and published_at is null
              and headline is null and bio is null and primary_topic_code is null
              and residence_region_code is null and travel_scope is null
              and collaboration_experience_band is null and main_audience_country is null
              and main_audience_share_band is null and audience_gender_band is null
              and delivery_lead_band is null and max_exclusivity_band is null
              and not accepts_non_monetary and availability_band is null
              and availability_declared_at is null);

-- 1.2 The tables deleted whole (Q18): the five lists, the two derived tables, the exact audience,
-- the refused sectors and the history; read for the export, deleted for an erased account only
do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('creator_topics',                   'account_id, slot, topic_code'),
      ('creator_publication_languages',    'account_id, slot, language_code'),
      ('creator_tones',                    'account_id, slot, tone_code'),
      ('creator_formats',                  'account_id, format_code'),
      ('creator_usage_rights',             'account_id, usage_right_code, inclusion'),
      ('creator_public_networks',          'social_account_id, account_id, audience_band, '
                                           'reach_band, publication_frequency_code, comment_band, '
                                           'engagement_band'),
      ('creator_public_audience',          'account_id, dimension, bucket, share_band'),
      ('creator_audience_countries',       'social_account_id, account_id, slot, country_code, '
                                           'share_percent'),
      ('creator_audience_ages',            'social_account_id, account_id, age_band_code, '
                                           'share_percent'),
      ('creator_audience_genders',         'social_account_id, account_id, gender_code, '
                                           'share_percent'),
      ('creator_refused_sectors',          'account_id, sector_code'),
      ('creator_network_metrics_history',  'id, account_id, network_code, followers_count, '
                                           'posts_last_30_days, avg_comments_per_post, '
                                           'figures_source, confirmed, recorded_at, '
                                           'recorded_by_account_id')
    ) as v (name, columns)
  loop
    execute format('grant select (%s) on profiles.%I to influx_privacy_definer', l.columns, l.name);
    execute format('grant delete on profiles.%I to influx_privacy_definer', l.name);

    execute format('drop policy if exists %I on profiles.%I', l.name || '_privacy_definer_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_privacy_definer '
                   'using (true)',
                   l.name || '_privacy_definer_select', l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_privacy_definer_erase', l.name);
    execute format('create policy %I on profiles.%I for delete to influx_privacy_definer '
                   'using (exists (select 1 from identity.accounts a '
                   'where a.id = %I.account_id and a.status = ''deleted''))',
                   l.name || '_privacy_definer_erase', l.name, l.name);
  end loop;
end
$$;

-- 1.3 The identity (layer N): read; emptied, the row kept (04 §9.2)
grant select (account_id, legal_first_name, legal_last_name, contact_email, contact_phone,
              address_line, postal_code, city, country_code, completeness_percent, updated_at)
   on profiles.creator_identities to influx_privacy_definer;
grant update (legal_first_name, legal_last_name, contact_email, contact_phone, address_line,
              postal_code, city, country_code, completeness_percent)
   on profiles.creator_identities to influx_privacy_definer;

drop policy if exists creator_identities_privacy_definer_select on profiles.creator_identities;
create policy creator_identities_privacy_definer_select on profiles.creator_identities
  for select to influx_privacy_definer
  using (true);

drop policy if exists creator_identities_privacy_definer_erase on profiles.creator_identities;
create policy creator_identities_privacy_definer_erase on profiles.creator_identities
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = creator_identities.account_id and a.status = 'deleted'))
  with check (legal_first_name is null and legal_last_name is null and contact_email is null
              and contact_phone is null and address_line is null and postal_code is null
              and city is null and country_code is null and completeness_percent = 0);

-- 1.4 The network lines (layer I): read; kept for L2E (EC-L2D-06-4), handle, pseudonym, URL,
-- figures and date emptied; never the network, the primary flag nor the source
grant select (id, account_id, network_code, is_primary, handle, pseudonym, profile_url,
              followers_count, posts_last_30_days, avg_comments_per_post, avg_reach_per_post,
              engagement_rate_bp, figures_source, figures_measured_at, created_at, updated_at)
   on profiles.creator_social_accounts to influx_privacy_definer;
grant update (handle, pseudonym, profile_url, followers_count, posts_last_30_days,
              avg_comments_per_post, avg_reach_per_post, engagement_rate_bp, figures_measured_at)
   on profiles.creator_social_accounts to influx_privacy_definer;

drop policy if exists creator_social_accounts_privacy_definer_select on profiles.creator_social_accounts;
create policy creator_social_accounts_privacy_definer_select on profiles.creator_social_accounts
  for select to influx_privacy_definer
  using (true);

drop policy if exists creator_social_accounts_privacy_definer_erase on profiles.creator_social_accounts;
create policy creator_social_accounts_privacy_definer_erase on profiles.creator_social_accounts
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = creator_social_accounts.account_id and a.status = 'deleted'))
  with check (handle is null and pseudonym is null and profile_url is null
              and followers_count is null and posts_last_30_days is null
              and avg_comments_per_post is null and avg_reach_per_post is null
              and engagement_rate_bp is null and figures_measured_at is null);

-- 2. E-5 recreated by its owner from its 0207 version ---------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 2.1 The categories: creator_profile after advertiser_profile (modele.md §0219) ------------------
create or replace function privacy.export_categories()
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select array['account', 'advertiser_profile', 'creator_profile', 'consents', 'terms_acceptances',
               'sessions', 'transactional_emails', 'email_changes', 'email_delivery_incidents',
               'delivery_reports', 'brevo_events', 'activity_log', 'error_reports',
               'data_requests', 'recipients']::text[]
$$;

comment on function privacy.export_categories() is
  'The 15 category keys of the export, in the order of the notice (runbook §4, EC-J8-48; 0219: '
  'creator_profile after advertiser_profile): always present in the file, empty when nothing is '
  'held. SECURITY INVOKER owned by influx_privacy_definer, NO grant.';

-- 2.2 The export (0137, 0202, 0204, 0207): the category creator_profile ---------------------------
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

    -- Journal d'activité: code and date, an internal actor shown as INFLUX, no payload, no hash
    'activity_log', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', e.event_type, 'occurred_at', privacy.iso_utc(e.occurred_at),
               'actor', case when e.actor_account_id = p_account_id then 'self' else 'INFLUX' end)
             order by e.seq)
        from audit.audit_events e
       where e.actor_account_id = p_account_id
          or (e.subject_type = 'account' and e.subject_id = p_account_id)
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
  'nor the lock) and field_revisions (0207: field, row, value, status, dates); creator_profile '
  '(0219) carries the creator storefront of 0216 and 0218, its five lists, its identity, its '
  'network lines with their exact figures, bands and exact audience, the refused sectors and the '
  'history of the metrics (an agent author shown as INFLUX); never public_ref nor the id of a line '
  'or a history row; NULL without a storefront. p_addresses: privacy.account_addresses(). SECURITY '
  'INVOKER owned by influx_privacy_definer, NO grant.';

-- 2.3 The execution (0150, 0202, 0204, 0207): the erasure also clears the creator profile -------
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
  -- logo (0204), its examinations (0207) and the creator profile of L2D (0219), in ONE transaction.
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
  'derived again (0219); addresses replaced by the marker in email_change_requests (open ones cancelled account_deleted), '
  'email_delivery_incidents, code_delivery_reports (message cleared), transactional_sends, '
  'member_invitations; cleared in brevo_inbound_events; exports purged; an open access request '
  'closed retiree_par_le_demandeur with privacy.request_completed (EC-DZ-4); account.deleted to '
  'brevo_contact and apollo_contact (P0, ids, account.deleted:<account>); privacy.erasure_completed '
  'to brevo_transactional (P1, ids, privacy.erasure_completed:<request>); account.anonymized '
  '{request_id}; returns (erasure, auth_user_id) for the GoTrue deletion after the commit. SECURITY '
  'DEFINER owned by influx_privacy_definer, empty search_path; EXECUTE for influx_privacy ONLY.';

-- the fifteen categories, creator_profile after advertiser_profile (checked by the owner: nobody
-- else executes the helper)
do $$
begin
  if privacy.export_categories() is distinct from array[
       'account', 'advertiser_profile', 'creator_profile', 'consents', 'terms_acceptances',
       'sessions', 'transactional_emails', 'email_changes', 'email_delivery_incidents',
       'delivery_reports', 'brevo_events', 'activity_log', 'error_reports', 'data_requests',
       'recipients']::text[] then
    raise exception 'privacy.export_categories() is not the list of the fifteen categories';
  end if;
end
$$;

reset role;
revoke create on schema privacy from influx_privacy_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_privacy_definer', current_user);
end
$$;

-- 3. End-state assertions --------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  -- E-5 unchanged in its form (0137, 0150, 0202, 0204, 0207)
  for v_def in
    select * from (values
      ('privacy.execute_request(uuid, jsonb)', true, array['influx_privacy']),
      ('privacy.export_document(uuid, text[], jsonb)', false, array[]::text[]),
      ('privacy.export_categories()', false, array[]::text[])
    ) as d (fn, definer, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> 'influx_privacy_definer'
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            <> v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% lost its owner, its security or its search_path', v_def.fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_proc p
       where p.proowner = 'influx_privacy_definer'::regrole) <> 10 then
    raise exception 'influx_privacy_definer must own exactly the ten functions of E-5';
  end if;

  -- §1: influx_privacy_definer inserts nothing on a creator object, never writes a key, the
  -- alias, the country of residence, the network, the primary flag nor the source of a line
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'profiles'
     and c.relname like 'creator\_%'
     and c.relkind in ('r', 'p')
     and (pg_catalog.has_table_privilege('influx_privacy_definer', c.oid, 'INSERT, TRUNCATE')
          or pg_catalog.has_any_column_privilege('influx_privacy_definer', c.oid, 'INSERT'));
  if v_bad is not null then
    raise exception 'influx_privacy_definer may insert into: %', v_bad;
  end if;
  select string_agg(t.tab || '.' || t.col, ', ') into v_bad
    from (values ('creator_public_profiles', 'account_id'),
                 ('creator_public_profiles', 'public_ref'),
                 ('creator_public_profiles', 'alias'),
                 ('creator_public_profiles', 'residence_country_code'),
                 ('creator_identities', 'account_id'),
                 ('creator_social_accounts', 'id'),
                 ('creator_social_accounts', 'account_id'),
                 ('creator_social_accounts', 'network_code'),
                 ('creator_social_accounts', 'is_primary'),
                 ('creator_social_accounts', 'figures_source')) as t (tab, col)
   where pg_catalog.has_column_privilege('influx_privacy_definer', 'profiles.' || t.tab, t.col,
                                         'UPDATE');
  if v_bad is not null then
    raise exception 'influx_privacy_definer may update: %', v_bad;
  end if;
  if pg_catalog.has_column_privilege('influx_privacy_definer', 'profiles.creator_public_profiles',
                                     'public_ref', 'SELECT') then
    raise exception 'influx_privacy_definer reads public_ref (EC-L2D-06-1)';
  end if;
  -- every write policy of influx_privacy_definer on a creator object names an erased account
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
    from pg_catalog.pg_policies
   where schemaname = 'profiles' and tablename like 'creator\_%'
     and 'influx_privacy_definer' = any (roles)
     and cmd <> 'SELECT'
     and (qual is null or pg_catalog.strpos(qual, '''deleted''') = 0);
  if v_bad is not null then
    raise exception 'a write policy of influx_privacy_definer not bound to an erased account: %', v_bad;
  end if;
  -- the fifteen creator tables are each covered (read and erased)
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'profiles'
     and c.relname like 'creator\_%'
     and c.relkind in ('r', 'p')
     and not (exists (select 1 from pg_catalog.pg_policies p
                       where p.schemaname = 'profiles' and p.tablename = c.relname
                         and 'influx_privacy_definer' = any (p.roles) and p.cmd = 'SELECT')
              and exists (select 1 from pg_catalog.pg_policies p
                           where p.schemaname = 'profiles' and p.tablename = c.relname
                             and 'influx_privacy_definer' = any (p.roles)
                             and p.cmd in ('UPDATE', 'DELETE')));
  if v_bad is not null then
    raise exception 'creator table(s) out of the export or the erasure: %', v_bad;
  end if;

  -- NON REVERSIBLE (04 §11.3, P5, EC-L2D-1): still no right of influx_advertiser on any creator
  -- object, guarded by name
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'profiles'
     and c.relname like 'creator\_%'
     and ((c.relkind in ('r', 'p', 'v', 'm')
           and (pg_catalog.has_table_privilege('influx_advertiser', c.oid,
                                               'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                or pg_catalog.has_any_column_privilege('influx_advertiser', c.oid,
                                                       'SELECT, INSERT, UPDATE, REFERENCES')))
          or (c.relkind = 'S'
              and pg_catalog.has_sequence_privilege('influx_advertiser', c.oid, 'USAGE, SELECT, UPDATE')));
  if v_bad is not null then
    raise exception 'influx_advertiser holds a right on: %', v_bad;
  end if;
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
    from pg_catalog.pg_policies
   where schemaname = 'profiles' and tablename like 'creator\_%'
     and (roles && array['influx_advertiser', 'public']::name[]);
  if v_bad is not null then
    raise exception 'a policy of a creator object names influx_advertiser or public: %', v_bad;
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_privacy_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_privacy_definer left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE') then
    raise exception 'influx_privacy_definer left with CREATE on schema privacy';
  end if;
end
$$;
