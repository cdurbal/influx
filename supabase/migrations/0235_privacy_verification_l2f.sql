-- =============================================================================
-- 0235_privacy_verification_l2f
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 10 (jalons/l2f/10.md; l2f/modele.md §1 point 3, §2, §3 "0235", §4 "retention.purged",
-- which prevails for every name; l2f-fiche.md invariants 12, 13, 14; 04 §9.1 "Badges et décisions" 3
-- years, §9.2 « Toute table personnelle ajoutée plus tard étend cette exécution »; 08 §8 « Le compte
-- est supprimé », Q2). The rights of the data subject over the data of L2F (0231 to 0234): the
-- withdrawal message, the contests, the entries of queue 6 and the origin of a request (D83) enter
-- the export, the erasure and the retention.
--
-- 1. influx_privacy_definer, column by column (03 P7 clause « L2E », as 0226): reads what the export
--    restitutes (the origin of a request, never its author nor its comment; the message of a
--    withdrawal; the contests, never the deciders, the lock, the deadlines, review_mode nor the
--    internal comment; the entries of queue 6, never the previous handle, the handle the agent read,
--    an agent, the lock nor the internal comment); on an erased account only: empties the opening
--    comment of a request, the message of a withdrawal, the three texts of a contest and the four of
--    an entry of queue 6, withdraws an open contest or entry (account_erased). Every write policy
--    names an account already `deleted`; each UPDATE policy accepts the emptied row only.
-- 2. privacy.export_document() recreated FROM ITS 0226 VERSION: every request carries opened_by and
--    opening_reason (D83: who opened it, why; never the agent nor his comment); every badge carries
--    revocation_message (the message to the member of its withdrawal under 2V, 0231);
--    creator_profile.verification carries disputes (target, network, level, reason, text, dates,
--    state, outcome reason and message, cause of a withdrawal) and identifier_changes (network, the
--    handle the creator declared, count, dates, state, cause of a withdrawal). The 15 categories are
--    unchanged.
-- 3. privacy.execute_request() recreated FROM ITS 0226 VERSION: the erasure, in the same transaction,
--    also empties the opening comment of every request, the message of every withdrawal request, the
--    texts of every contest and entry of queue 6 (texts_erased_at written), withdraws the open ones
--    (account_erased) and clears their lock. The contests, the entries and the withdrawal requests are
--    kept, pseudonymous, with the decisions (04 §9.1, 08 Q2).
-- 4. ops.purge_verification_findings() recreated FROM ITS 0230 VERSION (modele §3 "0235"): at
--    findings_retention_days, also the opening comment of a closed request (with its other texts), the
--    texts of a contest and of an entry of queue 6 closed for that long, the message of a withdrawal
--    request executed (or requested) for that long; retention.purged {category
--    verification_dispute_texts | verification_identifier_texts | verification_revocation_texts,
--    count}. influx_maintenance_definer empties them without reading them.
--
-- Not here: any route (the notice of the export describes the new content, apps/api locales); the
-- amendment of 04 §9 (closure of the jalon).
--
-- EC-L2F-10 (micro-gaps, the safest choice):
--   EC-L2F-10-1  the new data nests in the key verification of the two profile categories (as
--                EC-L2E-10-1): the 15 categories, the notice keys and the file format stay; the
--                exact attendus of L2E-D23 are extended with the new fields (opened_by,
--                opening_reason, revocation_message), never weakened.
--   EC-L2F-10-2  an entry of queue 6 exports new_handle (the handle the creator declared himself),
--                never previous_handle (taken from a finding: the handle observed at a decision or
--                confirmed) nor observed_handle (the agent's finding), as 0226 keeps the observed
--                handle out (fiche « sans agent ni identifiant constaté »).
--   EC-L2F-10-3  the message of a withdrawal is exported on the badge it withdrew (the named badge
--                of an executed 2V: badge_revocation_requests.badge_id = the badge); a request not
--                executed names no withdrawal the member was told of, and the audience carried along
--                has no message of its own (0231, EC-L2F-06-4).
--   EC-L2F-10-4  no register line for a contest or an entry withdrawn by the erasure (as
--                EC-L2E-10-6): account.anonymized covers it; a pending 2V of withdrawal is left to
--                expire (the badge is revoked account_closed, revoke_badge answers badge_not_holding).
--   EC-L2F-10-5  the retention of a withdrawal request starts at executed_at, else requested_at (a
--                2V never confirmed expires within 24 hours); every row past the delay is stamped
--                texts_erased_at, a text or not (counted by row, at most 500 per call with the rest).
--
-- ROLLBACK (before any account is erased): recreate privacy.export_document() and
-- privacy.execute_request() as in 0226 (as influx_privacy_definer) and ops.purge_verification_findings()
-- as in 0230 (as influx_maintenance_definer); recreate the policies
-- verification_requests_privacy_definer_erase (0226) and
-- verification_requests_maintenance_definer_erase_texts (0230); drop the policies
-- *_privacy_definer_* and *_maintenance_definer_* of verification.badge_revocation_requests,
-- disputes and identifier_change_reviews; revoke the grants of §1 and §4.1.
-- =============================================================================

-- 1. influx_privacy_definer: what the export reads and the erasure writes (04 §9.2) -----------------

-- 1.1 The requests: their origin read (never the agent nor his comment); the opening comment emptied
-- on an erased account, with the other texts (one statement, the policy checks them together)
grant select (opened_by, opening_reason_code),
      update (opening_comment)
   on verification.verification_requests to influx_privacy_definer;

drop policy if exists verification_requests_privacy_definer_erase on verification.verification_requests;
create policy verification_requests_privacy_definer_erase on verification.verification_requests
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = verification_requests.account_id and a.status = 'deleted'))
  with check (status not in ('draft', 'pending') and member_message is null
              and internal_comment is null and opening_comment is null
              and claimed_by_account_id is null);

-- 1.2 The withdrawal requests: the message to the member read (the export), reached from the badge
-- it withdrew; emptied on an erased account; never the requester nor the executor
grant select (revocation_request_id) on verification.badges to influx_privacy_definer;
grant select (dual_control_request_id, badge_id, account_id, member_message, executed_at,
              texts_erased_at),
      update (member_message, texts_erased_at)
   on verification.badge_revocation_requests to influx_privacy_definer;

drop policy if exists badge_revocation_requests_privacy_definer_select
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_privacy_definer_select
  on verification.badge_revocation_requests
  for select to influx_privacy_definer
  using (true);

drop policy if exists badge_revocation_requests_privacy_definer_erase
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_privacy_definer_erase
  on verification.badge_revocation_requests
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = badge_revocation_requests.account_id and a.status = 'deleted'))
  with check (member_message is null and texts_erased_at is not null);

-- 1.3 The contests: read without the deciders, the lock, the deadlines, review_mode nor the internal
-- comment; on an erased account, an open one withdrawn (account_erased), the three texts emptied
grant select (id, account_id, request_id, badge_id, level, network_code, reason_code, text,
              submitted_at, state, outcome_reason_code, member_message, decided_at,
              withdrawn_cause, closed_at, texts_erased_at),
      update (state, withdrawn_cause, closed_at, claimed_by_account_id, claimed_at,
              claim_expires_at, text, member_message, internal_comment, texts_erased_at)
   on verification.disputes to influx_privacy_definer;

drop policy if exists disputes_privacy_definer_select on verification.disputes;
create policy disputes_privacy_definer_select on verification.disputes
  for select to influx_privacy_definer
  using (true);

drop policy if exists disputes_privacy_definer_erase on verification.disputes;
create policy disputes_privacy_definer_erase on verification.disputes
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = disputes.account_id and a.status = 'deleted'))
  with check (state <> 'open' and text is null and member_message is null
              and internal_comment is null and claimed_by_account_id is null
              and texts_erased_at is not null);

-- 1.4 The entries of queue 6: read without the previous handle, the handle the agent read, an agent,
-- the lock nor the internal comment (EC-L2F-10-2); on an erased account, an open one withdrawn
-- (account_erased), the four texts emptied
grant select (id, account_id, network_code, new_handle, change_count, created_at, last_changed_at,
              state, decided_at, withdrawn_cause, closed_at, texts_erased_at),
      update (state, withdrawn_cause, closed_at, claimed_by_account_id, claimed_at,
              claim_expires_at, previous_handle, new_handle, observed_handle, internal_comment,
              texts_erased_at)
   on verification.identifier_change_reviews to influx_privacy_definer;

drop policy if exists identifier_change_reviews_privacy_definer_select
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_privacy_definer_select
  on verification.identifier_change_reviews
  for select to influx_privacy_definer
  using (true);

drop policy if exists identifier_change_reviews_privacy_definer_erase
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_privacy_definer_erase
  on verification.identifier_change_reviews
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = identifier_change_reviews.account_id and a.status = 'deleted'))
  with check (state <> 'open' and previous_handle is null and new_handle is null
              and observed_handle is null and internal_comment is null
              and claimed_by_account_id is null and texts_erased_at is not null);

-- 2. E-5 recreated by its owner from its 0226 version ---------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 2.1 The export (0137, 0202, 0204, 0207, 0219, 0226): the data of L2F in the key verification ----
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
  'nor the lock), field_revisions (0207: field, row, value, status, dates) and verification (0226: '
  'the internal block, the brand requests and badges); creator_profile (0219) carries the creator '
  'storefront of 0216 and 0218, its five lists, its identity, its network lines with their exact '
  'figures, bands and exact audience, the refused sectors, the history of the metrics (an agent '
  'author shown as INFLUX) and verification (0226: the creator requests and the network badges with '
  'their observed figures and period; 0235: disputes, identifier_changes); every request carries '
  'opened_by and opening_reason, every badge revocation_message (0235); never public_ref nor the id '
  'of a line or a history row, never an evidence, a code, an observed or previous handle, an agent, '
  'a decider, a lock, an internal or opening comment nor a declared value at a decision; NULL '
  'without a storefront. p_addresses: privacy.account_addresses(). SECURITY INVOKER owned by '
  'influx_privacy_definer, NO grant.';

-- 2.2 The execution (0150, 0202, 0204, 0207, 0219, 0226): the erasure also clears the data of L2F --
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
  -- L2E (0226) and of L2F (0235), in ONE transaction.
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
  'account_erased and its lock cleared, no register line (0235); addresses replaced by the marker in email_change_requests (open ones cancelled account_deleted), '
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

-- 4. The retention of the new texts (modele point 3, §3 "0235") -------------------------------------

-- 4.1 What influx_maintenance_definer reaches: the closure and the erasure stamp of a row, never a
-- text (it empties them without reading them)
grant update (opening_comment) on verification.verification_requests to influx_maintenance_definer;

drop policy if exists verification_requests_maintenance_definer_erase_texts
  on verification.verification_requests;
create policy verification_requests_maintenance_definer_erase_texts
  on verification.verification_requests
  for update to influx_maintenance_definer
  using (closed_at is not null
         and (member_message is not null or internal_comment is not null
              or opening_comment is not null))
  with check (closed_at is not null and member_message is null and internal_comment is null
              and opening_comment is null);

grant select (id, closed_at, texts_erased_at),
      update (text, member_message, internal_comment, texts_erased_at)
   on verification.disputes to influx_maintenance_definer;

-- the SELECT policy also checks the emptied row of the UPDATE (its WHERE reads): closed rows, erased
-- or not
drop policy if exists disputes_maintenance_definer_select on verification.disputes;
create policy disputes_maintenance_definer_select on verification.disputes
  for select to influx_maintenance_definer
  using (closed_at is not null);

drop policy if exists disputes_maintenance_definer_erase_texts on verification.disputes;
create policy disputes_maintenance_definer_erase_texts on verification.disputes
  for update to influx_maintenance_definer
  using (closed_at is not null and texts_erased_at is null)
  with check (closed_at is not null and texts_erased_at is not null and text is null
              and member_message is null and internal_comment is null);

grant select (id, closed_at, texts_erased_at),
      update (previous_handle, new_handle, observed_handle, internal_comment, texts_erased_at)
   on verification.identifier_change_reviews to influx_maintenance_definer;

drop policy if exists identifier_change_reviews_maintenance_definer_select
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_maintenance_definer_select
  on verification.identifier_change_reviews
  for select to influx_maintenance_definer
  using (closed_at is not null);

drop policy if exists identifier_change_reviews_maintenance_definer_erase_texts
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_maintenance_definer_erase_texts
  on verification.identifier_change_reviews
  for update to influx_maintenance_definer
  using (closed_at is not null and texts_erased_at is null)
  with check (closed_at is not null and texts_erased_at is not null and previous_handle is null
              and new_handle is null and observed_handle is null and internal_comment is null);

grant select (dual_control_request_id, requested_at, executed_at, texts_erased_at),
      update (member_message, texts_erased_at)
   on verification.badge_revocation_requests to influx_maintenance_definer;

drop policy if exists badge_revocation_requests_maintenance_definer_select
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_maintenance_definer_select
  on verification.badge_revocation_requests
  for select to influx_maintenance_definer
  using (true);

drop policy if exists badge_revocation_requests_maintenance_definer_erase_texts
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_maintenance_definer_erase_texts
  on verification.badge_revocation_requests
  for update to influx_maintenance_definer
  using (texts_erased_at is null)
  with check (texts_erased_at is not null and member_message is null);

-- 4.2 The purge recreated by its owner from its 0230 version
do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;
set role influx_maintenance_definer;

create or replace function ops.purge_verification_findings(
  p_run_id   uuid,
  p_attempt  smallint
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_days         integer;
  v_cutoff       timestamptz;
  v_left         integer := 500;
  v_evidence     integer;
  v_codes        integer;
  v_texts        integer;
  v_badges       integer;
  v_disputes     integer;
  v_identifiers  integer;
  v_revocations  integer;
begin
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code::text = 'badge_lifecycle') then
    raise exception 'no open badge_lifecycle run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  select (s.value)::integer into v_days
    from backoffice.operational_settings s where s.key = 'findings_retention_days';
  if v_days is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  v_cutoff := pg_catalog.now() - pg_catalog.make_interval(days => v_days);

  -- the rows of the evidence whose object is gone, of a request closed for the retention
  delete from verification.evidence_files e
   where e.id in (select x.id
                    from verification.evidence_files x
                    join verification.verification_requests r on r.id = x.request_id
                   where x.state = 'purged' and r.closed_at <= v_cutoff
                   order by x.id
                   limit v_left);
  get diagnostics v_evidence = row_count;
  v_left := v_left - v_evidence;

  -- the codes of such a request, with what the agent read
  delete from verification.ownership_codes c
   where c.id in (select x.id
                    from verification.ownership_codes x
                    join verification.verification_requests r on r.id = x.request_id
                   where r.closed_at <= v_cutoff
                   order by x.id
                   limit v_left);
  get diagnostics v_codes = row_count;
  v_left := v_left - v_codes;

  -- its message, internal comment and opening comment (0235; EC-L2F-05-5: the policy keeps the
  -- rows that carry one)
  update verification.verification_requests r
     set member_message = null, internal_comment = null, opening_comment = null
   where r.closed_at <= v_cutoff;
  get diagnostics v_texts = row_count;

  -- the findings of a badge ended for the retention; the row stays for the register
  update verification.badges b
     set observed_followers                 = null,
         observed_posts_last_30_days        = null,
         observed_avg_comments              = null,
         observed_engagement_bp             = null,
         observed_period_start              = null,
         observed_period_end                = null,
         declared_followers_at_decision     = null,
         declared_posts_at_decision         = null,
         declared_comments_at_decision      = null,
         declared_engagement_bp_at_decision = null,
         observed_platform_account_ref      = null,
         observed_handle_at_decision        = case when b.level = 'brand_verified' then null
                                                   else '[deleted]' end,
         findings_erased_at                 = pg_catalog.now()
   where b.id in (select x.id
                    from verification.badges x
                   where x.ended_at <= v_cutoff and x.findings_erased_at is null
                   order by x.ended_at, x.id
                   limit v_left
                     for update of x skip locked);
  get diagnostics v_badges = row_count;
  v_left := v_left - v_badges;

  -- 0235: the texts of a contest closed for the retention; the row stays for the register
  update verification.disputes d
     set text = null, member_message = null, internal_comment = null,
         texts_erased_at = pg_catalog.now()
   where d.id in (select x.id
                    from verification.disputes x
                   where x.closed_at <= v_cutoff and x.texts_erased_at is null
                   order by x.closed_at, x.id
                   limit greatest(v_left, 0)
                     for update of x skip locked);
  get diagnostics v_disputes = row_count;
  v_left := v_left - v_disputes;

  -- 0235: the four texts of an entry of queue 6 closed for the retention
  update verification.identifier_change_reviews i
     set previous_handle = null, new_handle = null, observed_handle = null,
         internal_comment = null, texts_erased_at = pg_catalog.now()
   where i.id in (select x.id
                    from verification.identifier_change_reviews x
                   where x.closed_at <= v_cutoff and x.texts_erased_at is null
                   order by x.closed_at, x.id
                   limit greatest(v_left, 0)
                     for update of x skip locked);
  get diagnostics v_identifiers = row_count;
  v_left := v_left - v_identifiers;

  -- 0235 (EC-L2F-10-5): the message of a withdrawal executed (or requested) for the retention
  update verification.badge_revocation_requests q
     set member_message = null, texts_erased_at = pg_catalog.now()
   where q.dual_control_request_id in (
           select x.dual_control_request_id
             from verification.badge_revocation_requests x
            where coalesce(x.executed_at, x.requested_at) <= v_cutoff
              and x.texts_erased_at is null
            order by coalesce(x.executed_at, x.requested_at), x.dual_control_request_id
            limit greatest(v_left, 0)
              for update of x skip locked);
  get diagnostics v_revocations = row_count;

  if v_evidence > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_evidence_rows',
                                                       'count', v_evidence));
  end if;
  if v_codes > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_codes',
                                                       'count', v_codes));
  end if;
  if v_texts > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_request_texts',
                                                       'count', v_texts));
  end if;
  if v_badges > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_badge_findings',
                                                       'count', v_badges));
  end if;
  if v_disputes > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_dispute_texts',
                                                       'count', v_disputes));
  end if;
  if v_identifiers > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_identifier_texts',
                                                       'count', v_identifiers));
  end if;
  if v_revocations > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_revocation_texts',
                                                       'count', v_revocations));
  end if;
  return v_evidence + v_codes + v_texts + v_badges + v_disputes + v_identifiers + v_revocations;
end
$$;

comment on function ops.purge_verification_findings(uuid, smallint) is
  'E-4 badge_lifecycle (0230, 0235; 08 RG100; l2f/modele.md point 3): findings_retention_days after '
  'the closure of a request, its purged evidence rows and its codes deleted, its member message, '
  'internal comment and opening comment emptied; findings_retention_days after the end of a badge '
  '(ended_at), its figures, declared values, period and platform reference set to NULL, its handle to '
  '''[deleted]'' (a network badge), findings_erased_at = now(); findings_retention_days after the '
  'closure of a contest or of an entry of queue 6, its texts emptied (texts_erased_at); after the '
  'execution (else the request) of a withdrawal, its message to the member emptied (texts_erased_at). '
  'The rows stay for the register. At most 500 rows deleted or erased per call (the request texts '
  'besides, EC-L2F-05-5). retention.purged {category verification_evidence_rows | verification_codes '
  '| verification_request_texts | verification_badge_findings | verification_dispute_texts | '
  'verification_identifier_texts | verification_revocation_texts, count} on the run for each that '
  'changed. Inside the open badge_lifecycle run of this attempt only (55000 otherwise). Returns the '
  'count (500 or more: call again). SECURITY DEFINER owned by influx_maintenance_definer, empty '
  'search_path; EXECUTE for influx_worker ONLY.';

revoke all on function ops.purge_verification_findings(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function ops.purge_verification_findings(uuid, smallint) to influx_worker;

reset role;
revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 5. End-state assertions --------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  -- E-5 and the purge unchanged in their form (0137, 0150, 0226, 0230)
  for v_def in
    select * from (values
      ('privacy.execute_request(uuid, jsonb)', 'influx_privacy_definer', true,
       array['influx_privacy']),
      ('privacy.export_document(uuid, text[], jsonb)', 'influx_privacy_definer', false,
       array[]::text[]),
      ('ops.purge_verification_findings(uuid, smallint)', 'influx_maintenance_definer', true,
       array['influx_worker'])
    ) as d (fn, owner, definer, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> v_def.owner
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

  -- §1: influx_privacy_definer inserts nothing in the new tables, never writes a key, an account, a
  -- decision nor a decider, never reads an agent, a lock, a deadline, an internal or opening comment,
  -- a previous handle nor the handle an agent read
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid in ('verification.badge_revocation_requests'::regclass,
                   'verification.disputes'::regclass,
                   'verification.identifier_change_reviews'::regclass)
     and (pg_catalog.has_table_privilege('influx_privacy_definer', c.oid, 'INSERT, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege('influx_privacy_definer', c.oid, 'INSERT'));
  if v_bad is not null then
    raise exception 'influx_privacy_definer may insert into or delete from: %', v_bad;
  end if;
  select string_agg(t.tab || '.' || t.col || ' ' || t.priv, ', ') into v_bad
    from (values ('verification.verification_requests', 'opened_by_account_id', 'SELECT'),
                 ('verification.verification_requests', 'opening_comment', 'SELECT'),
                 ('verification.verification_requests', 'opened_by', 'UPDATE'),
                 ('verification.verification_requests', 'opening_reason_code', 'UPDATE'),
                 ('verification.badge_revocation_requests', 'requested_by_account_id', 'SELECT'),
                 ('verification.badge_revocation_requests', 'executed_by_account_id', 'SELECT'),
                 ('verification.badge_revocation_requests', 'reason_code', 'UPDATE'),
                 ('verification.disputes', 'original_decider_ids', 'SELECT'),
                 ('verification.disputes', 'decided_by_account_id', 'SELECT'),
                 ('verification.disputes', 'claimed_by_account_id', 'SELECT'),
                 ('verification.disputes', 'internal_comment', 'SELECT'),
                 ('verification.disputes', 'review_mode', 'SELECT'),
                 ('verification.disputes', 'sla_due_at', 'SELECT'),
                 ('verification.disputes', 'outcome_reason_code', 'UPDATE'),
                 ('verification.disputes', 'decided_by_account_id', 'UPDATE'),
                 ('verification.disputes', 'account_id', 'UPDATE'),
                 ('verification.identifier_change_reviews', 'previous_handle', 'SELECT'),
                 ('verification.identifier_change_reviews', 'observed_handle', 'SELECT'),
                 ('verification.identifier_change_reviews', 'internal_comment', 'SELECT'),
                 ('verification.identifier_change_reviews', 'decided_by_account_id', 'SELECT'),
                 ('verification.identifier_change_reviews', 'claimed_by_account_id', 'SELECT'),
                 ('verification.identifier_change_reviews', 'badge_id', 'UPDATE'),
                 ('verification.identifier_change_reviews', 'account_id', 'UPDATE'))
           as t (tab, col, priv)
   where pg_catalog.has_column_privilege('influx_privacy_definer', t.tab, t.col, t.priv);
  if v_bad is not null then
    raise exception 'influx_privacy_definer holds: %', v_bad;
  end if;

  -- §4.1: influx_maintenance_definer reads no text of the new tables nor of a request
  select string_agg(t.tab || '.' || t.col, ', ') into v_bad
    from (values ('verification.verification_requests', 'opening_comment'),
                 ('verification.disputes', 'text'),
                 ('verification.disputes', 'member_message'),
                 ('verification.disputes', 'internal_comment'),
                 ('verification.identifier_change_reviews', 'previous_handle'),
                 ('verification.identifier_change_reviews', 'new_handle'),
                 ('verification.identifier_change_reviews', 'observed_handle'),
                 ('verification.identifier_change_reviews', 'internal_comment'),
                 ('verification.badge_revocation_requests', 'member_message'))
           as t (tab, col)
   where pg_catalog.has_column_privilege('influx_maintenance_definer', t.tab, t.col, 'SELECT');
  if v_bad is not null then
    raise exception 'influx_maintenance_definer reads: %', v_bad;
  end if;

  -- every write policy of the two definers on the new tables is bound: an erased account (privacy),
  -- a closed or stamped row (maintenance)
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
    from pg_catalog.pg_policies
   where schemaname = 'verification'
     and tablename in ('verification_requests', 'badge_revocation_requests', 'disputes',
                       'identifier_change_reviews')
     and 'influx_privacy_definer' = any (roles)
     and cmd <> 'SELECT'
     and (qual is null or pg_catalog.strpos(qual, '''deleted''') = 0);
  if v_bad is not null then
    raise exception 'a write policy of influx_privacy_definer not bound to an erased account: %', v_bad;
  end if;
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
    from pg_catalog.pg_policies
   where schemaname = 'verification'
     and tablename in ('badge_revocation_requests', 'disputes', 'identifier_change_reviews')
     and 'influx_maintenance_definer' = any (roles)
     and cmd <> 'SELECT'
     and (qual is null or pg_catalog.strpos(qual, 'texts_erased_at IS NULL') = 0
          or with_check is null or pg_catalog.strpos(with_check, 'texts_erased_at IS NOT NULL') = 0);
  if v_bad is not null then
    raise exception 'a write policy of influx_maintenance_definer not bound to an unstamped row: %', v_bad;
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_privacy_definer', 'influx_maintenance_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
