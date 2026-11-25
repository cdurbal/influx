-- =============================================================================
-- 0302_audit_export_allowlist
-- -----------------------------------------------------------------------------
-- Lot 3 / L3A, commit 07 (jalons/l3a/07.md; fiche invariants 6 and 9; jalons/l3a/f3.md, which
-- prevails for every code and every class). F3 (J8 review, commit 8): the activity_log of the
-- « mes données » export served every audit code of the account, unfiltered.
--
-- 1. audit.event_types.export_class text NOT NULL, WITHOUT DEFAULT, CHECK in ('exported',
--    'excluded_security', 'excluded_third_party'): added nullable, every existing code classified
--    (exported by default, art. 15; the five codes of f3.md excluded_security), then SET NOT NULL.
--    A later migration that inserts a code without naming export_class fails, even under
--    `on conflict do nothing` (NOT NULL is checked before the conflict arbitration).
-- 2. privacy.export_document() recreated FROM ITS 0245 VERSION by its owner: only activity_log
--    changes, joined to audit.event_types on export_class = 'exported'; its actor-or-subject scope
--    and every other section are unchanged, byte for byte.
-- 3. influx_privacy_definer reads (code, export_class) of audit.event_types, with its policy FOR
--    SELECT (the table is FORCE ROW LEVEL SECURITY, 0006 §8; no right before this file).
--
-- RIGHTS (03 I-4, signalled): one audit.* object touched (audit.event_types: a column, a column
-- grant, a policy); one GRANT (SELECT (code, export_class) to influx_privacy_definer). One function
-- recreated SECURITY INVOKER, owner, search_path, no grant restated and checked again (03 P7).
-- audit.audit_events and audit.append() are untouched.
--
-- No line served today changes (f3.md « Portée »): the four first excluded codes have an internal
-- account for subject, the fifth a verification request whose agent is the actor. The filter closes
-- the door to the codes to come and to any widening of the scope. The notice is unchanged.
--
-- ROLLBACK (no personal data written by this file): recreate privacy.export_document() as in 0245
-- (as influx_privacy_definer); drop the policy event_types_privacy_definer_select and revoke the
-- column grant; alter table audit.event_types drop column export_class.
-- =============================================================================

-- 1. The classification (f3.md « Stockage », « Codes exclus ») --------------------------------------

alter table audit.event_types add column if not exists export_class text;

update audit.event_types
   set export_class = case
         when code in ('security.backoffice_login_failures',  -- detection: login failure threshold
                       'agent.unexpected_mfa_factor',         -- detection: unexpected MFA factor
                       'agent.reauthentication_failed',       -- guard: session revoked after 5 failures
                       'backoffice.action_refused',           -- guard: agent action refused
                       'verification.escalated')              -- signal raised to an administrator
           then 'excluded_security'
         else 'exported'
       end
 where export_class is null;

alter table audit.event_types alter column export_class set not null;

alter table audit.event_types drop constraint if exists event_types_export_class;
alter table audit.event_types add constraint event_types_export_class
  check (export_class in ('exported', 'excluded_security', 'excluded_third_party'));

comment on column audit.event_types.export_class is
  'F3 (0302, jalons/l3a/f3.md): whether privacy.export_document() serves the lines of this code in '
  'activity_log. exported (default rule, art. 15: code and date only); excluded_security (its '
  'occurrence reveals an internal security measure: detection, fraud signal, guard triggered); '
  'excluded_third_party (the act or data of a third party, art. 15(4)). NO DEFAULT: a migration '
  'adding a code names it; an exclusion is listed in f3.md with its reason, a reclassification is '
  'an update reviewed by expert-cybersecurite.';

-- 2. What the export reads of the catalogue (03 P7: column by column, with its policy) ------------

grant select (code, export_class) on audit.event_types to influx_privacy_definer;

drop policy if exists event_types_privacy_definer_select on audit.event_types;
create policy event_types_privacy_definer_select on audit.event_types
  for select to influx_privacy_definer
  using (true);

-- 3. E-5 recreated by its owner from its 0245 version ---------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 3.1 The export (0137 ... 0245): activity_log serves the codes classified exported only (F3) -----
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
    -- 0302 (F3, jalons/l3a/f3.md): the codes classified exported only
    'activity_log', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', e.event_type, 'occurred_at', privacy.iso_utc(e.occurred_at),
               'actor', case when e.actor_account_id = p_account_id then 'self' else 'INFLUX' end)
             order by e.seq)
        from audit.audit_events e
        join audit.event_types t on t.code = e.event_type and t.export_class = 'exported'
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
  'their observed figures and period; 0235: disputes, identifier_changes), portfolio (0245: each '
  'visual, its state, place, replacement, size, sides, caption, dates and refusal reason, with its '
  'statements of RG83; never the bytes, the key nor the checksum), review_entries (0245: kind, '
  'state, dates, reason, message to the creator) and field_revisions (0245: field, value, status, '
  'dates; never the row key); every request carries '
  'opened_by and opening_reason, every badge revocation_message (0235); never public_ref nor the id '
  'of a line or a history row, never an evidence, a code, an observed or previous handle, an agent, '
  'a decider, a lock, an internal or opening comment nor a declared value at a decision; NULL '
  'without a storefront; activity_log serves the codes whose export_class is exported only '
  '(0302, F3). p_addresses: privacy.account_addresses(). SECURITY INVOKER owned by '
  'influx_privacy_definer, NO grant.';

reset role;
revoke create on schema privacy from influx_privacy_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_privacy_definer', current_user);
end
$$;

-- 4. End-state assertions --------------------------------------------------------------------------

do $$
declare
  c_fn        constant regprocedure := 'privacy.export_document(uuid, text[], jsonb)'::regprocedure;
  c_excluded  constant text[] := array['agent.reauthentication_failed', 'agent.unexpected_mfa_factor',
                                       'backoffice.action_refused',
                                       'security.backoffice_login_failures',
                                       'verification.escalated'];
  v_bad       text;
begin
  -- §1: NOT NULL, no default, closed list; 135 codes = 5 excluded_security + 130 exported (f3.md)
  if not exists (select 1 from pg_catalog.pg_attribute
                  where attrelid = 'audit.event_types'::regclass and attname = 'export_class'
                    and attnotnull and not atthasdef and not attisdropped) then
    raise exception 'audit.event_types.export_class must be NOT NULL without default';
  end if;
  if (select count(*) from audit.event_types) <> 135
     or (select count(*) from audit.event_types where export_class = 'exported') <> 130
     or (select pg_catalog.array_agg(code order by code) from audit.event_types
          where export_class <> 'exported') is distinct from c_excluded
     or exists (select 1 from audit.event_types
                 where code = any (c_excluded) and export_class <> 'excluded_security') then
    raise exception 'the classification of f3.md does not hold: 135 codes, 5 excluded, 130 exported';
  end if;

  -- §2: influx_privacy_definer reads code and export_class of the catalogue, nothing else
  select string_agg(c.attname || ' ' || p.priv, ', ') into v_bad
    from pg_catalog.pg_attribute c
    cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('REFERENCES')) as p (priv)
   where c.attrelid = 'audit.event_types'::regclass and c.attnum > 0 and not c.attisdropped
     and pg_catalog.has_column_privilege('influx_privacy_definer', c.attrelid, c.attname, p.priv)
     and not (p.priv = 'SELECT' and c.attname in ('code', 'export_class'));
  if v_bad is not null
     or pg_catalog.has_table_privilege('influx_privacy_definer', 'audit.event_types',
                                       'DELETE, TRUNCATE')
     or not pg_catalog.has_column_privilege('influx_privacy_definer', 'audit.event_types',
                                            'export_class', 'SELECT') then
    raise exception 'influx_privacy_definer on audit.event_types: %', coalesce(v_bad, 'the grant');
  end if;

  -- §3: E-5 unchanged in its form (0137, 0245); activity_log joined to the classification
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid = c_fn)
       <> 'influx_privacy_definer'
     or (select prosecdef from pg_catalog.pg_proc where oid = c_fn)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn)
          is distinct from array['search_path=""'] then
    raise exception '% lost its owner, its security or its search_path', c_fn;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner;
  if v_bad is not null then
    raise exception '% executable by: %', c_fn, v_bad;
  end if;
  if pg_catalog.strpos((select prosrc from pg_catalog.pg_proc where oid = c_fn),
                       'join audit.event_types t on t.code = e.event_type and t.export_class = ''exported''')
     = 0 then
    raise exception '% does not filter activity_log on export_class', c_fn;
  end if;
  if (select count(*) from pg_catalog.pg_proc p
       where p.proowner = 'influx_privacy_definer'::regrole) <> 10 then
    raise exception 'influx_privacy_definer must own exactly the ten functions of E-5';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_privacy_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE') then
    raise exception 'influx_privacy_definer left with CREATE on privacy';
  end if;
end
$$;
