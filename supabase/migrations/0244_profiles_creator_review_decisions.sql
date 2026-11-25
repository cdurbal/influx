-- =============================================================================
-- 0244_profiles_creator_review_decisions
-- -----------------------------------------------------------------------------
-- Lot 2 / L2G, commit 04 (jalons/l2g/04.md; l2g/modele.md §1 points 1 to 3, 6, 10, §3 "0244", §4,
-- which prevails for every name; fiche invariants 5, 7, 8, 10, 11, 13; 07 RG4 to RG10, RG77 to RG83,
-- RG93 to RG99; 15 RG27 C1 to C8, RG35, RG36). Queues 2 (profiles_creator) and 3
-- (portfolio_moderation) seen from the backoffice: the claim, the release, the extension, the forced
-- release of an administrator, the decisions and the journalled read of a visual. No route (11), no
-- connector nor e-mail rendering (10), no export nor erasure of the new rows (0245), no screen.
--
--   influx_moderation_definer (0210)   owns every function of this file, EXECUTE for influx_agent
--         and influx_admin (aal2 checked inside). It writes the state and the moderated fields of
--         somebody else's creator profile, which influx_creator_profile_definer (bound to the caller's
--         row) never does: a member door never reaches a publication (RG5, invariant 7). The member
--         guard of 0243 lets it pass (current_user is not a member role).
--   profiles.creator_review_token(account), portfolio_item_review_token(visual)   (invoker, no
--         EXECUTE) the version examined (l2c/file.md A3): the storefront's entered columns, the five
--         lists and the refused sectors, the lines and their figures with their listing, the exact
--         audiences, the pending and approved visuals (checksum, caption, declaration, place) and the
--         pending revisions; never the status, a date of the profile, the score nor layer N. A
--         visual: its object, its caption and its declaration.
--   Queue 2: open_ (= claim), release_, extend_, force_release_ (admin) creator_review_entry;
--         publish_creator_review_entry (each pending revision applied, the required fields
--         recontrolled on a submission, the lines listed, published_at written once,
--         profile.completed at the first publication, lead.updated afterwards, the decision e-mail);
--         reject_creator_review_entry (a reason of RG96, the message for `other` only; a submission
--         back to rejected, a revision leaves the profile published);
--         read_creator_review_portfolio_item (the holder of the live claim, a pending or approved
--         visual of the account, queue.portfolio_read).
--   Queue 3 (the entry IS the visual, modele point 2): open_, release_, extend_, force_release_
--         portfolio_item(_claim); approve_portfolio_item (exif_stripped required by the CHECK of 0242;
--         a replacement takes the place of its original, which becomes withdrawn, kept 30 days);
--         reject_portfolio_item (a reason of the grid of RG79; the trigger of 0242 dates its purge,
--         30 days; a refused replacement leaves the original served); read_portfolio_item_for_review.
--   Each decision stores the score (RG86, modele §3 "Complétude stockée à chaque décision").
--
-- Refusals (modele §3 "Erreurs"; the MESSAGE is the code, the DETAIL its precision): 42501 an unknown
-- entry or visual, an uploading one, of the caller's own account, an open one of an account he holds
-- (15 RG36: apps/api journals queue.conflict_of_interest, 0215), outside an active agent or admin in
-- aal2; 55P03 no live claim of the caller (DETAIL the live holder or none); 55000 entry_closed,
-- stale_token, profile_state, not_replaceable; 23514 a required field missing at a submission's
-- publication (DETAIL its code) or a column constraint of an applied value; 22023 reason,
-- member_message, internal_comment.
--
-- EC-L2G-04 (micro-gaps, the safest choice):
--   EC-L2G-04-1  The token of queue 2 hashes the SET of the pending and approved visuals, not their
--                state: an approval in queue 3 while queue 2 is open does not stale it; a deposit, a
--                refusal, a withdrawal, a caption or a new place does.
--   EC-L2G-04-2  Queue 3 locks every visual of the account FOR UPDATE (as the doors of 0242 do), never
--                the storefront: the token of a visual covers the visual alone; the deposit and
--                removal doors take the same locks in the same order.
--   EC-L2G-04-3  The required fields are recontrolled at the publication of a SUBMISSION only
--                (modele §3: « Soumission publiée : liste recontrôlée »); a revision is held by its door
--                (23514 when emptied) and by the constraints at its application.
--   EC-L2G-04-4  A pending caption revision of a visual no longer approved (withdrawn meanwhile) is
--                closed `withdrawn` at the publication, nothing applied (no false approval).
--   EC-L2G-04-5  A pending handle revision on a line that has since received an active « Compte
--                vérifié » is not applied: 55000 verified_handle (DETAIL creator.network_handle); that
--                handle is immediate and controlled by queue 6 alone (modele point 6); the agent
--                refuses the revision.
--   EC-L2G-04-6  The original of an approved replacement becomes withdrawn without a
--                portfolio.withdrawn line (its causes are removed and former_creator): the line
--                portfolio.approved names it (replaces_item_id).
--   EC-L2G-04-7  A visual decision that changes the stored score of a PUBLISHED profile (a refused
--                visual leaves the deposits) emits one lead.updated to brevo_contact and
--                apollo_contact, as record_own_creator_profile_change() of 0243.
--   EC-L2G-04-8  No grant of backoffice.business_deadline() nor of the delay policies: no function of
--                this file moves a visual to pending nor creates an entry (least privilege, as
--                EC-L2C-07-2); the trigger of 0242 reads portfolio_retention_days only (policy below).
--   EC-L2G-04-9  The decisions keep the claim columns, as queue 1 (0210); a visual sent back to
--                pending by the defence of 0242 loses it there.
--   EC-L2G-04-10 Return of the visual decisions: (decided_at, sla_breached), as the refusal of queue 1.
--
-- ROLLBACK (before any decision of queue 2 or 3 is written): drop the fourteen functions of section
-- 3 and the six helpers of 3.1; recreate the policy outbox_events_moderation_definer_insert as in 0210; drop
-- the policies *_moderation_definer_* created in section 2 and revoke their grants; revoke usage on
-- schema verification, reference from influx_moderation_definer; delete the seven event types of
-- section 1 (possible only while no line references them).
-- =============================================================================

-- 1. The codes of the register and of the queue (modele §4) -----------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 07 RG99: a decision of queue 2, nominative; payload entry_id, kind, fields or reason_code, late
  ('creator_profile.published', 'profiles',   'creator_profile', 'sensitive'),
  ('creator_profile.rejected',  'profiles',   'creator_profile', 'sensitive'),
  -- 07 RG99: a decision of queue 3; payload replaces_item_id (and reason_code), late
  ('portfolio.approved',        'profiles',   'portfolio_item',  'sensitive'),
  ('portfolio.rejected',        'profiles',   'portfolio_item',  'sensitive'),
  -- 15 RG35, modele point 10: the read of a visual by the holder of a claim
  ('queue.portfolio_read',      'backoffice', 'queue_entry',     'sensitive'),
  -- the queue only (never a register line): the decision e-mails (line 10)
  ('creator_profile.decision',  'profiles',   'queue_entry',     'info'),
  ('portfolio.decision',        'profiles',   'queue_entry',     'info')
on conflict (code) do nothing;

-- 2. What the owner of the decisions reads and writes ---------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner. The
-- functions check the caller themselves (agent or admin, aal2, active); the policies keep the rows
-- of the caller's own account out (15 RG36, C(3)) as a second line.

grant usage on schema verification, reference to influx_moderation_definer;

-- 2.1 The storefront: what the token hashes, what the rules read, the moderated texts, the state
grant select (account_id, status, published_at, headline, bio, primary_topic_code,
              residence_country_code, residence_region_code, travel_scope,
              collaboration_experience_band, delivery_lead_band, max_exclusivity_band,
              accepts_non_monetary, availability_band)
   on profiles.creator_public_profiles to influx_moderation_definer;
grant update (status, published_at, headline, bio)
   on profiles.creator_public_profiles to influx_moderation_definer;

drop policy if exists creator_public_profiles_moderation_definer_select
  on profiles.creator_public_profiles;
create policy creator_public_profiles_moderation_definer_select on profiles.creator_public_profiles
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));
-- USING without the state: the row is locked FOR UPDATE before its state is read
drop policy if exists creator_public_profiles_moderation_definer_update
  on profiles.creator_public_profiles;
create policy creator_public_profiles_moderation_definer_update on profiles.creator_public_profiles
  for update to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (status in ('published', 'rejected'));

-- 2.2 The lists, the lines and the audiences: what the token hashes and the rules read
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
      ('creator_refused_sectors',       'account_id, sector_code'),
      ('creator_audience_countries',    'social_account_id, account_id, slot, country_code, '
                                        'share_percent'),
      ('creator_audience_ages',         'social_account_id, account_id, age_band_code, share_percent'),
      ('creator_audience_genders',      'social_account_id, account_id, gender_code, share_percent')
    ) as v (name, columns)
  loop
    execute format('grant select (%s) on profiles.%I to influx_moderation_definer', l.columns, l.name);
    execute format('drop policy if exists %I on profiles.%I',
                   l.name || '_moderation_definer_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_moderation_definer '
                   'using (account_id is distinct from (select influx.current_account_id()))',
                   l.name || '_moderation_definer_select', l.name);
  end loop;
end
$$;

-- the lines: the token, the rules, and the handle and the URL of an approved revision (the guard of
-- 0220, invoker, holds the host of the URL to its network)
grant select (id, account_id, network_code, is_primary, handle, pseudonym, profile_url,
              followers_count, posts_last_30_days, avg_comments_per_post, avg_reach_per_post,
              engagement_rate_bp, figures_measured_at, created_at)
   on profiles.creator_social_accounts to influx_moderation_definer;
grant update (handle, profile_url) on profiles.creator_social_accounts to influx_moderation_definer;

drop policy if exists creator_social_accounts_moderation_definer_select
  on profiles.creator_social_accounts;
create policy creator_social_accounts_moderation_definer_select on profiles.creator_social_accounts
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists creator_social_accounts_moderation_definer_update
  on profiles.creator_social_accounts;
create policy creator_social_accounts_moderation_definer_update on profiles.creator_social_accounts
  for update to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (account_id is distinct from (select influx.current_account_id()));

-- the listing of a line (modele point 6): a publication lists every line, a network_line one
grant select (social_account_id, account_id, listed_at), update (listed_at)
   on profiles.creator_public_networks to influx_moderation_definer;

drop policy if exists creator_public_networks_moderation_definer_select
  on profiles.creator_public_networks;
create policy creator_public_networks_moderation_definer_select on profiles.creator_public_networks
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists creator_public_networks_moderation_definer_update
  on profiles.creator_public_networks;
create policy creator_public_networks_moderation_definer_update on profiles.creator_public_networks
  for update to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (account_id is distinct from (select influx.current_account_id()));

-- the reference lists the guard of the URL reads (0220, EC-L2D-04-6)
grant select (code) on reference.networks to influx_moderation_definer;
grant select (network_code, host) on reference.network_url_hosts to influx_moderation_definer;

drop policy if exists networks_moderation_definer_select on reference.networks;
create policy networks_moderation_definer_select on reference.networks
  for select to influx_moderation_definer
  using (true);
drop policy if exists network_url_hosts_moderation_definer_select on reference.network_url_hosts;
create policy network_url_hosts_moderation_definer_select on reference.network_url_hosts
  for select to influx_moderation_definer
  using (true);

-- 2.3 The stored score (RG86), stored at each decision
grant select (account_id, completeness_percent), update (completeness_percent)
   on profiles.creator_identities to influx_moderation_definer;

drop policy if exists creator_identities_moderation_definer_select on profiles.creator_identities;
create policy creator_identities_moderation_definer_select on profiles.creator_identities
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists creator_identities_moderation_definer_update on profiles.creator_identities;
create policy creator_identities_moderation_definer_update on profiles.creator_identities
  for update to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (account_id is distinct from (select influx.current_account_id()));

-- 2.4 The request filed (RG88) and the « Compte vérifié » (08 RG16, EC-L2G-04-5), read only
grant select (account_id, population, submitted_at, status)
   on verification.verification_requests to influx_moderation_definer;
grant select (account_id, social_account_id, level, state)
   on verification.badges to influx_moderation_definer;

drop policy if exists verification_requests_moderation_definer_select
  on verification.verification_requests;
create policy verification_requests_moderation_definer_select on verification.verification_requests
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists badges_moderation_definer_select on verification.badges;
create policy badges_moderation_definer_select on verification.badges
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id())
         and level <> 'brand_verified');

-- 2.5 Queue 2: the claim, the forced release, the decision
grant select (id, account_id, kind, state, claimed_by_account_id, claimed_at, claim_expires_at,
              decided_at, sla_breached)
   on profiles.creator_review_entries to influx_moderation_definer;
grant update (claimed_by_account_id, claimed_at, claim_expires_at, forced_release_at,
              forced_release_by_account_id, forced_release_holder_account_id,
              forced_release_reason_code, state, decided_by_account_id, decided_at,
              rejection_reason_code, member_message, internal_comment, closed_at)
   on profiles.creator_review_entries to influx_moderation_definer;

drop policy if exists creator_review_entries_moderation_definer_select
  on profiles.creator_review_entries;
create policy creator_review_entries_moderation_definer_select on profiles.creator_review_entries
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));
-- USING without the state: FOR UPDATE of a closed entry still finds it (55000, not 42501)
drop policy if exists creator_review_entries_moderation_definer_update
  on profiles.creator_review_entries;
create policy creator_review_entries_moderation_definer_update on profiles.creator_review_entries
  for update to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (account_id is distinct from (select influx.current_account_id()));

-- the revisions: applied, refused, or closed for a visual gone (EC-L2G-04-4), never anything else
grant select (id, account_id, field_code, row_key, proposed_value, status, creator_review_entry_id),
      update (status, closed_at)
   on profiles.creator_field_revisions to influx_moderation_definer;

drop policy if exists creator_field_revisions_moderation_definer_select
  on profiles.creator_field_revisions;
create policy creator_field_revisions_moderation_definer_select on profiles.creator_field_revisions
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists creator_field_revisions_moderation_definer_update
  on profiles.creator_field_revisions;
create policy creator_field_revisions_moderation_definer_update on profiles.creator_field_revisions
  for update to influx_moderation_definer
  using (status = 'pending_review'
         and account_id is distinct from (select influx.current_account_id()))
  with check (status in ('approved', 'rejected', 'withdrawn'));

grant select (code, requires_member_message, is_active)
   on profiles.creator_rejection_reasons to influx_moderation_definer;
drop policy if exists creator_rejection_reasons_moderation_definer_select
  on profiles.creator_rejection_reasons;
create policy creator_rejection_reasons_moderation_definer_select
  on profiles.creator_rejection_reasons
  for select to influx_moderation_definer
  using (true);

-- 2.6 Queue 3: the visual, its claim, its decision, its caption (a revision applied), its place;
-- the key for the journalled read (modele point 10), never written
grant select (id, account_id, object_key, state, replaces_item_id, display_order, byte_size, width,
              height, checksum, exif_stripped, caption, brand_declaration_id, claimed_by_account_id,
              claimed_at, claim_expires_at, decided_at, sla_breached)
   on profiles.portfolio_items to influx_moderation_definer;
grant update (state, display_order, caption, brand_declaration_id, claimed_by_account_id,
              claimed_at, claim_expires_at, forced_release_at, forced_release_by_account_id,
              forced_release_holder_account_id, forced_release_reason_code, decided_by_account_id,
              decided_at, rejection_reason_code, internal_comment)
   on profiles.portfolio_items to influx_moderation_definer;

drop policy if exists portfolio_items_moderation_definer_select on profiles.portfolio_items;
create policy portfolio_items_moderation_definer_select on profiles.portfolio_items
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));
-- a pending visual is claimed and decided; an approved one gets its caption, or is withdrawn by the
-- approval of its replacement. Never a purge, never back to pending
drop policy if exists portfolio_items_moderation_definer_update on profiles.portfolio_items;
create policy portfolio_items_moderation_definer_update on profiles.portfolio_items
  for update to influx_moderation_definer
  using (state in ('pending', 'approved')
         and account_id is distinct from (select influx.current_account_id()))
  with check (state in ('pending', 'approved', 'rejected', 'withdrawn'));

grant select (code, is_active) on profiles.portfolio_rejection_reasons to influx_moderation_definer;
drop policy if exists portfolio_rejection_reasons_moderation_definer_select
  on profiles.portfolio_rejection_reasons;
create policy portfolio_rejection_reasons_moderation_definer_select
  on profiles.portfolio_rejection_reasons
  for select to influx_moderation_definer
  using (true);

-- the trigger of 0242 (invoker) dates the purge of a refused or withdrawn visual (EC-L2G-04-8)
drop policy if exists operational_settings_moderation_definer_select_portfolio
  on backoffice.operational_settings;
create policy operational_settings_moderation_definer_select_portfolio
  on backoffice.operational_settings
  for select to influx_moderation_definer
  using (key = 'portfolio_retention_days');

-- 2.7 The queue: the two decision e-mails and the lead, in the transaction of the fact (05 RG73)
drop policy if exists outbox_events_moderation_definer_insert on leads.outbox_events;
create policy outbox_events_moderation_definer_insert on leads.outbox_events
  for insert to influx_moderation_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((event_type in ('profile.decision', 'creator_profile.decision',
                                   'portfolio.decision')
                    and destination = 'brevo_transactional')
                   or (event_type in ('profile.completed', 'lead.updated')
                       and destination in ('brevo_contact', 'apollo_contact'))));

-- 2.8 The rules of 0242 and 0243 (invoker, owned by the migration role): the owner runs them with
-- the rights above
grant execute on function
  profiles.trimmed_char_length(text),
  profiles.creator_missing_required_fields(jsonb),
  profiles.creator_completeness_percent(jsonb),
  profiles.creator_profile_input(uuid),
  profiles.deposited_portfolio_count(uuid)
  to influx_moderation_definer;

-- 3. The functions, as influx_moderation_definer (03 P7 rule 5) -------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_moderation_definer', current_user);
end
$$;
grant create on schema profiles to influx_moderation_definer;
set role influx_moderation_definer;

-- 3.1 The helpers (SECURITY INVOKER: they run with the rights of the decision that calls them) ----

-- The internal comment of a decision, never sent: NULL, or 1 to 1 000 printable characters
create or replace function profiles.check_review_internal_comment(p_comment text)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_comment is not null
     and (pg_catalog.char_length(p_comment) not between 1 and 1000
          or p_comment !~ '[^[:space:]]'
          or p_comment ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]') then
    raise exception 'internal_comment'
      using errcode = 'invalid_parameter_value', detail = 'internal_comment';
  end if;
end
$$;

comment on function profiles.check_review_internal_comment(text) is
  'The internal comment of a decision of queue 2 or 3: NULL, or 1 to 1 000 printable characters; '
  '22023 internal_comment otherwise (0244, EC-L2C-07-7). SECURITY INVOKER owned by '
  'influx_moderation_definer, no EXECUTE for anyone.';

-- The version token of queue 2 (l2c/file.md A3; modele §3 "0244"; EC-L2G-04-1). STABLE: called
-- inside a query, it reads the snapshot of that query.
create or replace function profiles.creator_review_token(p_account_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'profile', pg_catalog.jsonb_build_array(
                 p.headline, p.bio, p.primary_topic_code, p.residence_country_code,
                 p.residence_region_code, p.travel_scope, p.collaboration_experience_band,
                 p.delivery_lead_band, p.max_exclusivity_band, p.accepts_non_monetary,
                 p.availability_band),
    'topics', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(t.slot, t.topic_code)
                                           order by t.slot)
                 from profiles.creator_topics t where t.account_id = p.account_id),
    'tones', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(t.slot, t.tone_code)
                                          order by t.slot)
                from profiles.creator_tones t where t.account_id = p.account_id),
    'languages', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(l.slot, l.language_code)
                                              order by l.slot)
                    from profiles.creator_publication_languages l where l.account_id = p.account_id),
    'formats', (select pg_catalog.jsonb_agg(f.format_code order by f.format_code)
                  from profiles.creator_formats f where f.account_id = p.account_id),
    'usage_rights', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(u.usage_right_code,
                                                                              u.inclusion)
                                                 order by u.usage_right_code)
                       from profiles.creator_usage_rights u where u.account_id = p.account_id),
    'refused_sectors', (select pg_catalog.jsonb_agg(s.sector_code order by s.sector_code)
                          from profiles.creator_refused_sectors s where s.account_id = p.account_id),
    'lines', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                       n.id, n.network_code, n.is_primary, n.handle, n.pseudonym, n.profile_url,
                       n.followers_count, n.posts_last_30_days, n.avg_comments_per_post,
                       n.avg_reach_per_post, n.engagement_rate_bp, n.figures_measured_at,
                       (select c.listed_at from profiles.creator_public_networks c
                         where c.social_account_id = n.id and c.account_id = n.account_id))
                     order by n.id)
                from profiles.creator_social_accounts n where n.account_id = p.account_id),
    'audience_countries', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                                    c.social_account_id, c.slot, c.country_code, c.share_percent)
                                  order by c.social_account_id, c.slot)
                             from profiles.creator_audience_countries c
                            where c.account_id = p.account_id),
    'audience_ages', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                               g.social_account_id, g.age_band_code, g.share_percent)
                             order by g.social_account_id, g.age_band_code)
                        from profiles.creator_audience_ages g where g.account_id = p.account_id),
    'audience_genders', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                                  x.social_account_id, x.gender_code, x.share_percent)
                                order by x.social_account_id, x.gender_code)
                           from profiles.creator_audience_genders x where x.account_id = p.account_id),
    -- EC-L2G-04-1: the set of the visuals shown, never their state
    'visuals', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                         i.id, i.checksum, i.caption, i.brand_declaration_id, i.display_order,
                         i.replaces_item_id)
                       order by i.id)
                  from profiles.portfolio_items i
                 where i.account_id = p.account_id and i.state in ('pending', 'approved')),
    'revisions', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                           r.id, r.field_code, r.row_key, r.proposed_value)
                         order by r.id)
                    from profiles.creator_field_revisions r
                   where r.account_id = p.account_id and r.status = 'pending_review')
  )::text, 'UTF8')), 'hex')
    from profiles.creator_public_profiles p
   where p.account_id = p_account_id
$$;

comment on function profiles.creator_review_token(uuid) is
  'l2c/file.md A3, l2g/modele §3 "0244" (0244): SHA-256 hex of the version of a creator profile '
  'examined in queue 2: the entered columns of the storefront, the five lists and the refused '
  'sectors, the lines (handle, pseudonym, URL, figures, listing), the exact audiences, the pending '
  'and approved visuals (id, checksum, caption, declaration, place, original; never their state, '
  'EC-L2G-04-1) and the pending revisions. Never the status, a date of the profile, the score nor '
  'layer N. NULL without a storefront. Never stored; different at the decision: 55000 stale_token. '
  'SECURITY INVOKER owned by influx_moderation_definer, no EXECUTE for anyone.';

-- The version token of queue 3: the visual alone
create or replace function profiles.portfolio_item_review_token(p_item_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_array(
           i.id, i.account_id, i.state, i.checksum, i.byte_size, i.width, i.height,
           i.exif_stripped, i.caption, i.brand_declaration_id, i.replaces_item_id
         )::text, 'UTF8')), 'hex')
    from profiles.portfolio_items i
   where i.id = p_item_id
$$;

comment on function profiles.portfolio_item_review_token(uuid) is
  'l2c/file.md A3, l2g/modele §3 "0244" (0244): SHA-256 hex of the version of a visual examined in '
  'queue 3: its object (checksum, size, sides, metadata removed), its caption, its declaration of '
  'RG83 and the visual it replaces. Never stored; different at the decision: 55000 stale_token. '
  'SECURITY INVOKER owned by influx_moderation_definer, no EXECUTE for anyone.';

-- The gate of every act on a held entry of queue 2: the storefront locked first, then the entry
create or replace function profiles.lock_held_creator_review_entry(p_entry_id uuid, p_caller uuid)
returns table (
  account_id      uuid,
  kind            text,
  profile_status  text,
  claimed_at      timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid;
  v_status   text;
  v_entry    record;
begin
  select e.account_id into v_account
    from profiles.creator_review_entries e
   where e.id = p_entry_id;
  -- unknown, the caller's own account (the policy hides it), an account he HOLDS (15 RG36): one
  -- answer (T14)
  if not found or v_account = p_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_account and a.owner_agent_id = p_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The storefront FIRST, as every member door of the account (the guard of 0243 holds it FOR
  -- SHARE): a member write waits for this act, or this act reads it (file.md A3, L2CS-1).
  select p.status::text into v_status
    from profiles.creator_public_profiles p
   where p.account_id = v_account
     for update of p;

  select e.state::text as state, e.kind::text as kind, e.claimed_by_account_id, e.claimed_at,
         e.claim_expires_at
    into v_entry
    from profiles.creator_review_entries e
   where e.id = p_entry_id
     for update;
  if v_entry.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- 07 RG94, 15 C2: no examination nor decision without the caller's live claim
  if v_entry.claimed_by_account_id is distinct from p_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  return query select v_account, v_entry.kind, v_status, v_entry.claimed_at;
end
$$;

comment on function profiles.lock_held_creator_review_entry(uuid, uuid) is
  'The gate of the acts on a held entry of queue 2 (0244): 42501 for an unknown entry, one of the '
  'caller''s own account or of an account he holds (15 RG36); the storefront locked FOR UPDATE, then '
  'the entry; 55000 entry_closed once it left open; 55P03 no_live_claim (DETAIL the live holder or '
  'none) without the caller''s live claim (07 RG94). Returns its account, kind, profile status and '
  'claim instant. SECURITY INVOKER owned by influx_moderation_definer, no EXECUTE for anyone.';

-- The gate of every act on a held visual of queue 3 (EC-L2G-04-2)
create or replace function profiles.lock_held_portfolio_item(p_item_id uuid, p_caller uuid)
returns table (
  account_id        uuid,
  replaces_item_id  uuid,
  claimed_at        timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid;
  v_item     record;
begin
  select i.account_id into v_account
    from profiles.portfolio_items i
   where i.id = p_item_id and i.state <> 'uploading';
  if not found or v_account = p_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_account and a.owner_agent_id = p_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- every visual of the account locked, as the deposit and removal doors of 0242 do
  perform 1 from profiles.portfolio_items i where i.account_id = v_account for update;

  select i.state::text as state, i.replaces_item_id, i.claimed_by_account_id, i.claimed_at,
         i.claim_expires_at
    into v_item
    from profiles.portfolio_items i
   where i.id = p_item_id;
  if v_item.state <> 'pending' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_item.claimed_by_account_id is distinct from p_caller
     or v_item.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_item.claim_expires_at > pg_catalog.now()
                          then v_item.claimed_by_account_id::text else 'none' end;
  end if;
  return query select v_account, v_item.replaces_item_id, v_item.claimed_at;
end
$$;

comment on function profiles.lock_held_portfolio_item(uuid, uuid) is
  'The gate of the acts on a held visual of queue 3 (0244, EC-L2G-04-2): 42501 for an unknown or '
  'uploading visual, one of the caller''s own account or of an account he holds (15 RG36); every '
  'visual of the account locked FOR UPDATE; 55000 entry_closed once it left pending; 55P03 '
  'no_live_claim (DETAIL the live holder or none) without the caller''s live claim. Returns its '
  'account, the visual it replaces and the claim instant. SECURITY INVOKER owned by '
  'influx_moderation_definer, no EXECUTE for anyone.';

-- The score stored after a decision (RG86): true when it changed
create or replace function profiles.store_creator_completeness(p_account_id uuid)
returns boolean
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_score  smallint := profiles.creator_completeness_percent(
                         profiles.creator_profile_input(p_account_id));
begin
  update profiles.creator_identities i
     set completeness_percent = v_score
   where i.account_id = p_account_id and i.completeness_percent is distinct from v_score;
  return found;
end
$$;

comment on function profiles.store_creator_completeness(uuid) is
  '07 RG86, modele §3 "0244" (0244): the score of the creator p_account_id recomputed by the base '
  '(creator_completeness_percent of creator_profile_input) and stored in profiles.creator_identities; '
  'true when it changed. SECURITY INVOKER owned by influx_moderation_definer, no EXECUTE for anyone.';

-- 3.2 Queue 2: opening = claiming (15 C1, C2, file.md A9) -----------------------------------------
create or replace function profiles.open_creator_review_entry(p_entry_id uuid)
returns table (
  outcome            text,
  holder_account_id  uuid,
  claimed_at         timestamptz,
  claim_expires_at   timestamptz,
  review_token       text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_account   uuid;
  v_entry     record;
  v_minutes   integer;
  v_outcome   text;
  v_holder    uuid;
  v_claimed   timestamptz;
  v_expires   timestamptz;
  v_token     text;
begin
  -- Unknown, or of the caller's own account (the policy hides it): 42501, one answer
  select e.account_id into v_account
    from profiles.creator_review_entries e
   where e.id = p_entry_id;
  if not found or v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- the storefront FIRST, then the entry (L2CS-1): the token below is the version read after it
  perform 1
     from profiles.creator_public_profiles p
    where p.account_id = v_account
      for update of p;

  select e.state::text as state, e.claimed_by_account_id, e.claimed_at, e.claim_expires_at
    into v_entry
    from profiles.creator_review_entries e
   where e.id = p_entry_id
     for update;

  -- 15 RG36: an open entry of an account the caller HOLDS is not his to examine; a closed one
  -- answers `closed` as to anybody
  if v_entry.state = 'open'
     and exists (select 1 from identity.accounts a
                  where a.id = v_account and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_entry.state <> 'open' then
    v_outcome := 'closed';
  elsif v_entry.claimed_by_account_id = v_caller and v_entry.claim_expires_at > pg_catalog.now() then
    v_outcome := 'held';
    v_holder  := v_caller;
    v_claimed := v_entry.claimed_at;
    v_expires := v_entry.claim_expires_at;
  else
    select (s.value)::integer into v_minutes
      from backoffice.operational_settings s
     where s.key = 'claim_expiry_minutes';
    if v_minutes is null then
      raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
    end if;

    -- 04 l. 2465-2480: the condition IS the lock, the row count the answer
    update profiles.creator_review_entries e
       set claimed_by_account_id = v_caller,
           claimed_at            = pg_catalog.now(),
           claim_expires_at      = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
     where e.id = p_entry_id
       and e.state = 'open'
       and (e.claimed_by_account_id is null or e.claim_expires_at <= pg_catalog.now())
    returning e.claimed_by_account_id, e.claimed_at, e.claim_expires_at
      into v_holder, v_claimed, v_expires;

    if found then
      v_outcome := 'claimed';
      -- file.md A9: an expired claim taken over is written first, its holder and its real expiry
      if v_entry.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_entry_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'profiles_creator',
                               'holder_account_id', v_entry.claimed_by_account_id,
                               'claimed_at', v_entry.claimed_at,
                               'expired_at', v_entry.claim_expires_at));
      end if;
    else
      -- 07 RG94, 15 C2: « déjà prise en charge par … », read only, never an error
      v_outcome := 'read_only';
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  end if;

  if v_outcome in ('claimed', 'held') then
    v_token := profiles.creator_review_token(v_account);
  end if;

  -- 15 RG35: the opening is an act; last
  perform audit.append('queue.entry_opened', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_creator',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires, v_token;
end
$$;

comment on function profiles.open_creator_review_entry(uuid) is
  '07 RG94; 15 RG27 C1 to C3, RG35, RG36; file.md A3, A9 (0244): an agent or an admin opens an entry '
  'of queue 2. The storefront locked FOR UPDATE first, then the entry. Free, or its claim expired: '
  'claimed by an atomic conditional UPDATE, claim_expires_at = now() + claim_expiry_minutes (an '
  'expired claim taken over writes queue.claim_expired first). Returns (outcome, holder, claimed_at, '
  'claim_expires_at, review_token): claimed or held (the caller''s live claim, unchanged) with the '
  'version token; read_only with the live holder (15 C2); closed with nothing. Every opening writes '
  'queue.entry_opened {queue_code: profiles_creator, outcome}. 42501 for an unknown entry, one of the '
  'caller''s own account, an open one of an account he holds, outside an active agent or admin in '
  'aal2. SECURITY DEFINER owned by influx_moderation_definer, empty search_path; EXECUTE for '
  'influx_agent and influx_admin.';

-- 3.3 Queue 2: release (15 C3, no comment) --------------------------------------------------------
create or replace function profiles.release_creator_review_entry(p_entry_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := profiles.require_review_agent(false);
  v_entry   record;
begin
  select e.account_id, e.state::text as state, e.claimed_by_account_id, e.claimed_at,
         e.claim_expires_at
    into v_entry
    from profiles.creator_review_entries e
   where e.id = p_entry_id
     for update;
  -- an account the caller holds: he gives a claim back, never decides (0215)
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;

  update profiles.creator_review_entries e
     set claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
   where e.id = p_entry_id;

  perform audit.append('queue.claim_released', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_creator',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at));
end
$$;

comment on function profiles.release_creator_review_entry(uuid) is
  '15 RG27 C3, file.md A9 (0244): the holder of a live claim gives the entry of queue 2 back; line '
  'queue.claim_released {queue_code, holder_account_id, claimed_at}, no comment. 55P03 no_live_claim '
  '(DETAIL the live holder or none), 55000 entry_closed, 42501 for an unknown entry or the caller''s '
  'own account. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and '
  'influx_admin.';

-- 3.4 Queue 2: extend (file.md A9) ------------------------------------------------------------------
create or replace function profiles.extend_creator_review_claim(p_entry_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := profiles.require_review_agent(false);
  v_entry    record;
  v_minutes  integer;
  v_expires  timestamptz;
begin
  select * into v_entry from profiles.lock_held_creator_review_entry(p_entry_id, v_caller);

  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s
   where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update profiles.creator_review_entries e
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where e.id = p_entry_id
  returning e.claim_expires_at into v_expires;

  perform audit.append('queue.claim_extended', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_creator',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function profiles.extend_creator_review_claim(uuid) is
  'file.md A9 (0244): the holder of a live claim on an entry of queue 2 extends it to now() + '
  'claim_expiry_minutes; line queue.claim_extended {queue_code, holder_account_id, claimed_at, '
  'claim_expires_at}; returns the new expiry. The refusals of lock_held_creator_review_entry() (an '
  'account the caller holds included). SECURITY DEFINER owned by influx_moderation_definer; EXECUTE '
  'for influx_agent and influx_admin.';

-- 3.5 Queue 2: forced release by an administrator (15 C4, file.md A8) -------------------------------
create or replace function profiles.force_release_creator_review_claim(
  p_entry_id     uuid,
  p_reason_code  text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := profiles.require_review_agent(true);
  v_entry   record;
begin
  perform 1 from backoffice.claim_release_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;

  select e.account_id, e.state::text as state, e.claimed_by_account_id, e.claim_expires_at
    into v_entry
    from profiles.creator_review_entries e
   where e.id = p_entry_id
     for update;
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is null or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim' using errcode = 'lock_not_available', detail = 'none';
  end if;

  update profiles.creator_review_entries e
     set claimed_by_account_id            = null,
         claimed_at                       = null,
         claim_expires_at                 = null,
         forced_release_at                = pg_catalog.now(),
         forced_release_by_account_id     = v_caller,
         forced_release_holder_account_id = v_entry.claimed_by_account_id,
         forced_release_reason_code       = p_reason_code
   where e.id = p_entry_id;

  perform audit.append('queue.claim_forced_release', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_creator',
                                                     'holder_account_id', v_entry.claimed_by_account_id,
                                                     'reason_code', p_reason_code));
  return v_entry.claimed_by_account_id;
end
$$;

comment on function profiles.force_release_creator_review_claim(uuid, text) is
  '15 RG27 C4, file.md A8 (0244): an administrator lifts a live claim on an entry of queue 2 before '
  'its expiry, with a typed reason of backoffice.claim_release_reasons; the entry keeps the last '
  'forced release; line queue.claim_forced_release {queue_code, holder_account_id, reason_code}; '
  'returns the holder. 22023 reason, 55P03 none, 55000 entry_closed, 42501 outside an active admin '
  'in aal2 (an agent''s attempt is journalled by apps/api, queue.force_release_claim). SECURITY '
  'DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and influx_admin (the '
  'function refuses the agent).';

-- 3.6 Queue 2: publish (07 RG5, RG9, RG99, RG106; modele §3 "0244") ---------------------------------
create or replace function profiles.publish_creator_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_internal_comment  text)
returns table (
  decided_at         timestamptz,
  sla_breached       boolean,
  first_publication  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_entry     record;
  v_first     boolean;
  v_rev       record;
  v_row       uuid;
  v_fields    text[] := '{}';
  v_missing   text[];
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  perform profiles.check_review_internal_comment(p_internal_comment);
  -- the storefront and the entry locked, the caller's live claim (07 RG94; fiche « Arrêt si »)
  select * into v_entry from profiles.lock_held_creator_review_entry(p_entry_id, v_caller);

  -- file.md A3: the version examined
  if p_review_token is null
     or p_review_token is distinct from profiles.creator_review_token(v_entry.account_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  -- EC-L2C-07-6: a submission on a pending_review profile, a revision on a published one
  if not ((v_entry.kind = 'submission' and v_entry.profile_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_entry.profile_status = 'published')) then
    raise exception 'profile_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  select p.published_at is null into v_first
    from profiles.creator_public_profiles p
   where p.account_id = v_entry.account_id;

  -- 07 RG9: every pending value applied, its revision approved, in this transaction; the constraints
  -- of the column and the guard of the URL apply now (modele §3)
  for v_rev in
    select r.id, r.field_code, r.row_key, r.proposed_value
      from profiles.creator_field_revisions r
     where r.creator_review_entry_id = p_entry_id and r.status = 'pending_review'
     order by r.field_code, r.row_key
  loop
    v_row := case when v_rev.row_key is null then null else v_rev.row_key::uuid end;
    case v_rev.field_code
      when 'creator.headline' then
        update profiles.creator_public_profiles p
           set headline = v_rev.proposed_value #>> '{}'
         where p.account_id = v_entry.account_id;
      when 'creator.bio' then
        update profiles.creator_public_profiles p
           set bio = v_rev.proposed_value #>> '{}'
         where p.account_id = v_entry.account_id;
      when 'creator.network_line' then
        -- modele point 6: the line added to a published profile is listed
        update profiles.creator_public_networks c
           set listed_at = coalesce(c.listed_at, pg_catalog.now())
         where c.social_account_id = v_row and c.account_id = v_entry.account_id;
        if not found then
          raise exception 'stale_token'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      when 'creator.network_handle' then
        -- EC-L2G-04-5: a handle under an active « Compte vérifié » belongs to queue 6
        if exists (select 1 from verification.badges b
                    where b.account_id = v_entry.account_id and b.social_account_id = v_row
                      and b.level = 'account_verified' and b.state = 'active') then
          raise exception 'verified_handle'
            using errcode = 'object_not_in_prerequisite_state', detail = 'creator.network_handle';
        end if;
        update profiles.creator_social_accounts n
           set handle = v_rev.proposed_value #>> '{}'
         where n.id = v_row and n.account_id = v_entry.account_id;
        if not found then
          raise exception 'stale_token'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      when 'creator.network_url' then
        update profiles.creator_social_accounts n
           set profile_url = v_rev.proposed_value #>> '{}'
         where n.id = v_row and n.account_id = v_entry.account_id;
        if not found then
          raise exception 'stale_token'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      when 'creator.portfolio_caption' then
        update profiles.portfolio_items i
           set caption              = v_rev.proposed_value ->> 'caption',
               brand_declaration_id = (v_rev.proposed_value ->> 'brand_declaration_id')::uuid
         where i.id = v_row and i.account_id = v_entry.account_id and i.state = 'approved';
        if not found then
          -- EC-L2G-04-4: the visual left meanwhile, nothing to approve
          update profiles.creator_field_revisions r
             set status = 'withdrawn', closed_at = pg_catalog.now()
           where r.id = v_rev.id;
          continue;
        end if;
      else
        raise exception 'no application for the field %', v_rev.field_code
          using errcode = 'invalid_parameter_value';
    end case;
    update profiles.creator_field_revisions r
       set status = 'approved', closed_at = pg_catalog.now()
     where r.id = v_rev.id;
    v_fields := v_fields || v_rev.field_code;
  end loop;

  if v_entry.kind = 'submission' then
    -- 07 RG4, RG16, 08 RG16 (EC-L2G-04-3): the required fields of the version published;
    -- portfolio_insufficient covers a portfolio fallen under 3 (modele §3)
    v_missing := profiles.creator_missing_required_fields(
                   profiles.creator_profile_input(v_entry.account_id));
    if pg_catalog.cardinality(v_missing) > 0 then
      raise exception 'required field missing: %', v_missing[1]
        using errcode = 'check_violation', detail = v_missing[1];
    end if;
    -- modele point 6: the lines of the profile published are listed (layer A)
    update profiles.creator_public_networks c
       set listed_at = pg_catalog.now()
     where c.account_id = v_entry.account_id and c.listed_at is null;
  end if;

  update profiles.creator_public_profiles p
     set status = 'published',
         published_at = coalesce(p.published_at, pg_catalog.now())
   where p.account_id = v_entry.account_id;

  update profiles.creator_review_entries e
     set state = 'published', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- RG86: the score of the version published
  perform profiles.store_creator_completeness(v_entry.account_id);

  -- 07 RG99: the decision e-mail, written by the worker (D69); its code in the payload (0211)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'creator_profile.decision', 'brevo_transactional',
          'account:' || v_entry.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_entry.account_id,
                                        'entry_id', p_entry_id,
                                        'email_code', 'creator_profile.decision'),
          'creator_profile.decision:' || p_entry_id::text);
  -- 07 RG106: profile.completed once per account, lead.updated afterwards; ids only (05 RG74)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_lead, case when v_first then 'profile.completed' else 'lead.updated' end, d.destination,
         'account:' || v_entry.account_id::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', v_entry.account_id),
         case when v_first then 'profile.completed:' || v_entry.account_id::text
              else 'lead.updated:' || v_lead::text end
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  -- The register, in the transaction of the fact; last (04 §7.2). Codes and ids only (D60)
  perform audit.append('creator_profile.published', 'creator_profile', v_entry.account_id,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'fields', pg_catalog.to_jsonb(v_fields),
                                                     'late', v_late));
  return query select v_decided, v_late, v_first;
end
$$;

comment on function profiles.publish_creator_review_entry(uuid, text, text) is
  '07 RG4, RG5, RG9, RG95, RG99, RG106; 15 C6, C8; file.md A2, A3; modele §3 "0244" (0244): the '
  'holder of a live claim publishes an entry of queue 2. The storefront locked first, then the '
  'entry; the version token recomputed and compared; in ONE transaction: each pending revision '
  'applied (headline, bio, the handle and the URL of a line with their constraints and the guard of '
  'the URL, a line listed, the caption of an approved visual) and approved; for a submission the '
  'required fields recontrolled (23514, DETAIL the first code missing) and every line listed; status '
  'published, published_at written once; the entry published (decider, instant, internal comment); '
  'the score stored; creator_profile.decision to brevo_transactional (key '
  'creator_profile.decision:<entry>, payload {event_id, account_id, entry_id, email_code}); '
  'profile.completed to brevo_contact and apollo_contact at the first publication (key '
  'profile.completed:<account>), lead.updated otherwise; the line creator_profile.published '
  '{entry_id, kind, fields, late}. Returns (decided_at, sla_breached, first_publication). 22023 '
  'internal_comment; 55000 stale_token, profile_state, verified_handle (EC-L2G-04-5); then the '
  'refusals of lock_held_creator_review_entry(). SECURITY DEFINER owned by '
  'influx_moderation_definer; EXECUTE for influx_agent and influx_admin.';

-- 3.7 Queue 2: reject (07 RG10, RG95, RG96, RG98, RG99) ---------------------------------------------
create or replace function profiles.reject_creator_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_reason_code       text,
  p_member_message    text,
  p_internal_comment  text)
returns table (
  decided_at    timestamptz,
  sla_breached  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_requires  boolean;
  v_entry     record;
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
begin
  -- RG96: a typed reason of the closed list, never a refusal without one (RG10)
  select r.requires_member_message into v_requires
    from profiles.creator_rejection_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  -- RG96, RG98: the message to the creator for `other` only, 20 to 500 printable characters
  if v_requires then
    if p_member_message is null
       or pg_catalog.char_length(p_member_message) not between 20 and 500
       or p_member_message !~ '[^[:space:]]'
       or p_member_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'member_message'
        using errcode = 'invalid_parameter_value', detail = 'member_message';
    end if;
  elsif p_member_message is not null then
    raise exception 'member_message'
      using errcode = 'invalid_parameter_value', detail = 'member_message';
  end if;
  perform profiles.check_review_internal_comment(p_internal_comment);

  select * into v_entry from profiles.lock_held_creator_review_entry(p_entry_id, v_caller);
  if p_review_token is null
     or p_review_token is distinct from profiles.creator_review_token(v_entry.account_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not ((v_entry.kind = 'submission' and v_entry.profile_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_entry.profile_status = 'published')) then
    raise exception 'profile_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  update profiles.creator_field_revisions r
     set status = 'rejected', closed_at = pg_catalog.now()
   where r.creator_review_entry_id = p_entry_id and r.status = 'pending_review';
  -- RG10: a refused submission goes back to the creator, editable and submitted again at once; a
  -- refused revision leaves the profile published, the validated version served (CA48)
  if v_entry.kind = 'submission' then
    update profiles.creator_public_profiles p
       set status = 'rejected'
     where p.account_id = v_entry.account_id;
  end if;

  update profiles.creator_review_entries e
     set state = 'rejected', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         rejection_reason_code = p_reason_code, member_message = p_member_message,
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  perform profiles.store_creator_completeness(v_entry.account_id);

  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'creator_profile.decision', 'brevo_transactional',
          'account:' || v_entry.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_entry.account_id,
                                        'entry_id', p_entry_id,
                                        'email_code', 'creator_profile.decision'),
          'creator_profile.decision:' || p_entry_id::text);

  perform audit.append('creator_profile.rejected', 'creator_profile', v_entry.account_id,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'reason_code', p_reason_code,
                                                     'late', v_late));
  return query select v_decided, v_late;
end
$$;

comment on function profiles.reject_creator_review_entry(uuid, text, text, text, text) is
  '07 RG10, RG95, RG96, RG98, RG99; 15 C6, C8; file.md A2, A3 (0244): the holder of a live claim '
  'refuses an entry of queue 2 with a typed reason of profiles.creator_rejection_reasons; the message '
  'to the creator (20 to 500 characters) for a reason that requires it only (other); an internal '
  'comment of 1 000 characters at most, never sent. Same locks and token as the publication; in ONE '
  'transaction: the pending revisions rejected, a submission back to rejected (a revision leaves the '
  'profile published), the entry rejected, the score stored, creator_profile.decision to '
  'brevo_transactional, the line creator_profile.rejected {entry_id, kind, reason_code, late}. '
  'Returns (decided_at, sla_breached). 22023 reason, member_message or internal_comment, then the '
  'refusals of the publication. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for '
  'influx_agent and influx_admin.';

-- 3.8 Queue 2: the journalled read of a visual (modele point 10; D82 (7); 15 RG35) ------------------
create or replace function profiles.read_creator_review_portfolio_item(
  p_entry_id  uuid,
  p_item_id   uuid)
returns table (
  state       text,
  object_key  text,
  byte_size   integer,
  width       integer,
  height      integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := profiles.require_review_agent(false);
  v_entry   record;
  v_item    record;
begin
  -- the holder of a live claim only (modele point 10)
  select * into v_entry from profiles.lock_held_creator_review_entry(p_entry_id, v_caller);

  select i.state::text as state, i.object_key, i.byte_size, i.width, i.height
    into v_item
    from profiles.portfolio_items i
   where i.id = p_item_id
     and i.account_id = v_entry.account_id
     and i.state in ('pending', 'approved');
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- one nominative line per read, in the transaction that hands the key over; never the key
  perform audit.append('queue.portfolio_read', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_creator',
                                                     'item_id', p_item_id,
                                                     'state', v_item.state));
  return query select v_item.state, v_item.object_key, v_item.byte_size, v_item.width, v_item.height;
end
$$;

comment on function profiles.read_creator_review_portfolio_item(uuid, uuid) is
  'l2g/modele point 10, D82 (7), 15 RG35 (0244): the holder of a live claim on an entry of queue 2 '
  'asks for a pending or approved visual of its account: writes queue.portfolio_read {queue_code, '
  'item_id, state} on the entry and returns (state, object_key, byte_size, width, height) for '
  'apps/api to relay the bytes (never an URL). 42501 for a visual unknown, of another account, '
  'uploading or ended, then the refusals of lock_held_creator_review_entry(). SECURITY DEFINER owned '
  'by influx_moderation_definer; EXECUTE for influx_agent and influx_admin.';

-- 3.9 Queue 3: opening = claiming (15 C1, C2; modele point 2) ---------------------------------------
create or replace function profiles.open_portfolio_item(p_item_id uuid)
returns table (
  outcome            text,
  holder_account_id  uuid,
  claimed_at         timestamptz,
  claim_expires_at   timestamptz,
  review_token       text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_account   uuid;
  v_item      record;
  v_minutes   integer;
  v_outcome   text;
  v_holder    uuid;
  v_claimed   timestamptz;
  v_expires   timestamptz;
  v_token     text;
begin
  -- unknown, an upload (no entry of the queue), the caller's own account: one answer
  select i.account_id into v_account
    from profiles.portfolio_items i
   where i.id = p_item_id and i.state <> 'uploading';
  if not found or v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- EC-L2G-04-2: every visual of the account locked, as the doors of 0242
  perform 1 from profiles.portfolio_items i where i.account_id = v_account for update;

  select i.state::text as state, i.claimed_by_account_id, i.claimed_at, i.claim_expires_at
    into v_item
    from profiles.portfolio_items i
   where i.id = p_item_id;

  if v_item.state = 'pending'
     and exists (select 1 from identity.accounts a
                  where a.id = v_account and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_item.state <> 'pending' then
    v_outcome := 'closed';
  elsif v_item.claimed_by_account_id = v_caller and v_item.claim_expires_at > pg_catalog.now() then
    v_outcome := 'held';
    v_holder  := v_caller;
    v_claimed := v_item.claimed_at;
    v_expires := v_item.claim_expires_at;
  else
    select (s.value)::integer into v_minutes
      from backoffice.operational_settings s
     where s.key = 'claim_expiry_minutes';
    if v_minutes is null then
      raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
    end if;

    update profiles.portfolio_items i
       set claimed_by_account_id = v_caller,
           claimed_at            = pg_catalog.now(),
           claim_expires_at      = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
     where i.id = p_item_id
       and i.state = 'pending'
       and (i.claimed_by_account_id is null or i.claim_expires_at <= pg_catalog.now())
    returning i.claimed_by_account_id, i.claimed_at, i.claim_expires_at
      into v_holder, v_claimed, v_expires;

    if found then
      v_outcome := 'claimed';
      if v_item.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_item_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'portfolio_moderation',
                               'holder_account_id', v_item.claimed_by_account_id,
                               'claimed_at', v_item.claimed_at,
                               'expired_at', v_item.claim_expires_at));
      end if;
    else
      v_outcome := 'read_only';
      v_holder  := v_item.claimed_by_account_id;
      v_claimed := v_item.claimed_at;
      v_expires := v_item.claim_expires_at;
    end if;
  end if;

  if v_outcome in ('claimed', 'held') then
    v_token := profiles.portfolio_item_review_token(p_item_id);
  end if;

  perform audit.append('queue.entry_opened', 'queue_entry', p_item_id,
                       pg_catalog.jsonb_build_object('queue_code', 'portfolio_moderation',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires, v_token;
end
$$;

comment on function profiles.open_portfolio_item(uuid) is
  '07 RG78, RG94; 15 RG27 C1 to C3, RG35, RG36; l2g/modele point 2 (0244): an agent or an admin '
  'opens a visual of queue 3 (the entry IS the visual). Every visual of the account locked FOR '
  'UPDATE (EC-L2G-04-2). Pending and free, or its claim expired: claimed by an atomic conditional '
  'UPDATE (an expired claim taken over writes queue.claim_expired first). Returns (outcome, holder, '
  'claimed_at, claim_expires_at, review_token): claimed or held with the version token, read_only '
  'with the live holder, closed with nothing once it left pending. Every opening writes '
  'queue.entry_opened {queue_code: portfolio_moderation, outcome}. 42501 for an unknown or uploading '
  'visual, one of the caller''s own account, a pending one of an account he holds, outside an active '
  'agent or admin in aal2. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for '
  'influx_agent and influx_admin.';

-- 3.10 Queue 3: release ---------------------------------------------------------------------------
create or replace function profiles.release_portfolio_item(p_item_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := profiles.require_review_agent(false);
  v_item    record;
begin
  select i.account_id, i.state::text as state, i.claimed_by_account_id, i.claimed_at,
         i.claim_expires_at
    into v_item
    from profiles.portfolio_items i
   where i.id = p_item_id and i.state <> 'uploading'
     for update;
  if not found or v_item.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_item.state <> 'pending' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_item.claimed_by_account_id is distinct from v_caller
     or v_item.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_item.claim_expires_at > pg_catalog.now()
                          then v_item.claimed_by_account_id::text else 'none' end;
  end if;

  update profiles.portfolio_items i
     set claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
   where i.id = p_item_id;

  perform audit.append('queue.claim_released', 'queue_entry', p_item_id,
                       pg_catalog.jsonb_build_object('queue_code', 'portfolio_moderation',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_item.claimed_at));
end
$$;

comment on function profiles.release_portfolio_item(uuid) is
  '15 RG27 C3 (0244): the holder of a live claim gives the visual back to queue 3; line '
  'queue.claim_released {queue_code, holder_account_id, claimed_at}, no comment. 55P03 no_live_claim, '
  '55000 entry_closed, 42501 for an unknown or uploading visual or the caller''s own account. '
  'SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and influx_admin.';

-- 3.11 Queue 3: extend ----------------------------------------------------------------------------
create or replace function profiles.extend_portfolio_item_claim(p_item_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := profiles.require_review_agent(false);
  v_item     record;
  v_minutes  integer;
  v_expires  timestamptz;
begin
  select * into v_item from profiles.lock_held_portfolio_item(p_item_id, v_caller);

  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s
   where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update profiles.portfolio_items i
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where i.id = p_item_id
  returning i.claim_expires_at into v_expires;

  perform audit.append('queue.claim_extended', 'queue_entry', p_item_id,
                       pg_catalog.jsonb_build_object('queue_code', 'portfolio_moderation',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_item.claimed_at,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function profiles.extend_portfolio_item_claim(uuid) is
  'file.md A9 (0244): the holder of a live claim on a visual of queue 3 extends it to now() + '
  'claim_expiry_minutes; line queue.claim_extended; returns the new expiry. The refusals of '
  'lock_held_portfolio_item(). SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for '
  'influx_agent and influx_admin.';

-- 3.12 Queue 3: forced release by an administrator ---------------------------------------------------
create or replace function profiles.force_release_portfolio_item_claim(
  p_item_id      uuid,
  p_reason_code  text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := profiles.require_review_agent(true);
  v_item    record;
begin
  perform 1 from backoffice.claim_release_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;

  select i.account_id, i.state::text as state, i.claimed_by_account_id, i.claim_expires_at
    into v_item
    from profiles.portfolio_items i
   where i.id = p_item_id and i.state <> 'uploading'
     for update;
  if not found or v_item.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_item.state <> 'pending' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_item.claimed_by_account_id is null or v_item.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim' using errcode = 'lock_not_available', detail = 'none';
  end if;

  update profiles.portfolio_items i
     set claimed_by_account_id            = null,
         claimed_at                       = null,
         claim_expires_at                 = null,
         forced_release_at                = pg_catalog.now(),
         forced_release_by_account_id     = v_caller,
         forced_release_holder_account_id = v_item.claimed_by_account_id,
         forced_release_reason_code       = p_reason_code
   where i.id = p_item_id;

  perform audit.append('queue.claim_forced_release', 'queue_entry', p_item_id,
                       pg_catalog.jsonb_build_object('queue_code', 'portfolio_moderation',
                                                     'holder_account_id', v_item.claimed_by_account_id,
                                                     'reason_code', p_reason_code));
  return v_item.claimed_by_account_id;
end
$$;

comment on function profiles.force_release_portfolio_item_claim(uuid, text) is
  '15 RG27 C4 (0244): an administrator lifts a live claim on a visual of queue 3 with a typed reason '
  'of backoffice.claim_release_reasons; the visual keeps the last forced release; line '
  'queue.claim_forced_release; returns the holder. 22023 reason, 55P03 none, 55000 entry_closed, '
  '42501 outside an active admin in aal2. SECURITY DEFINER owned by influx_moderation_definer; '
  'EXECUTE for influx_agent and influx_admin (the function refuses the agent).';

-- 3.13 Queue 3: approve (07 RG78, RG80, RG81, RG95, RG99; modele point 3) ---------------------------
create or replace function profiles.approve_portfolio_item(
  p_item_id           uuid,
  p_review_token      text,
  p_internal_comment  text)
returns table (
  decided_at    timestamptz,
  sla_breached  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_item      record;
  v_order     smallint;
  v_status    text;
  v_changed   boolean;
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  perform profiles.check_review_internal_comment(p_internal_comment);
  select * into v_item from profiles.lock_held_portfolio_item(p_item_id, v_caller);
  if p_review_token is null
     or p_review_token is distinct from profiles.portfolio_item_review_token(p_item_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;

  -- RG81, modele point 3: a replacement takes the place of its approved original, which leaves
  -- (withdrawn, its object kept portfolio_retention_days by the trigger of 0242, EC-L2G-04-6)
  if v_item.replaces_item_id is not null then
    select o.display_order into v_order
      from profiles.portfolio_items o
     where o.id = v_item.replaces_item_id and o.account_id = v_item.account_id
       and o.state = 'approved';
    if not found then
      raise exception 'not_replaceable'
        using errcode = 'object_not_in_prerequisite_state', detail = 'not_replaceable';
    end if;
    update profiles.portfolio_items o
       set state = 'withdrawn'
     where o.id = v_item.replaces_item_id;
  end if;

  -- RG80, T9.10: the CHECK of 0242 refuses an approval without exif_stripped (23514)
  update profiles.portfolio_items i
     set state                 = 'approved',
         display_order         = coalesce(v_order, i.display_order),
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where i.id = p_item_id
  returning i.decided_at, i.sla_breached into v_decided, v_late;

  v_changed := profiles.store_creator_completeness(v_item.account_id);

  -- 07 RG99: one decision, one e-mail (modele point 8); ids only
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'portfolio.decision', 'brevo_transactional',
          'account:' || v_item.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_item.account_id,
                                        'item_id', p_item_id, 'email_code', 'portfolio.decision'),
          'portfolio.decision:' || p_item_id::text);
  -- EC-L2G-04-7: the score of a published profile changed
  select p.status::text into v_status
    from profiles.creator_public_profiles p where p.account_id = v_item.account_id;
  if v_changed and v_status = 'published' then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select v_lead, 'lead.updated', d.destination, 'account:' || v_item.account_id::text, 100,
           pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', v_item.account_id),
           'lead.updated:' || v_lead::text
      from (values ('brevo_contact'::leads.outbox_destination),
                   ('apollo_contact'::leads.outbox_destination)) d (destination);
  end if;

  perform audit.append('portfolio.approved', 'portfolio_item', p_item_id,
                       pg_catalog.jsonb_build_object('replaces_item_id', v_item.replaces_item_id,
                                                     'late', v_late));
  return query select v_decided, v_late;
end
$$;

comment on function profiles.approve_portfolio_item(uuid, text, text) is
  '07 RG78, RG80, RG81, RG95, RG99; 15 C6, C8; l2g/modele point 3 (0244): the holder of a live claim '
  'approves a pending visual of queue 3, its caption with it. The visuals of the account locked; the '
  'version token recomputed and compared; in ONE transaction: a replacement takes the place of its '
  'approved original, which becomes withdrawn (kept portfolio_retention_days, 55000 not_replaceable '
  'when it no longer is approved); the visual approved (decider, instant, internal comment; the '
  'CHECK of 0242 refuses it without exif_stripped, 23514); the score stored; portfolio.decision to '
  'brevo_transactional (key portfolio.decision:<visual>, payload {event_id, account_id, item_id, '
  'email_code}); lead.updated when the score of a published profile changed (EC-L2G-04-7); the line '
  'portfolio.approved {replaces_item_id, late}. Returns (decided_at, sla_breached). 22023 '
  'internal_comment, 55000 stale_token, then the refusals of lock_held_portfolio_item(). SECURITY '
  'DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and influx_admin.';

-- 3.14 Queue 3: reject (07 RG78, RG79, RG82, RG83, RG95, RG97, RG99; D79 (8)) ------------------------
create or replace function profiles.reject_portfolio_item(
  p_item_id           uuid,
  p_review_token      text,
  p_reason_code       text,
  p_internal_comment  text)
returns table (
  decided_at    timestamptz,
  sla_breached  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_item      record;
  v_status    text;
  v_changed   boolean;
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  -- RG79, RG97: a reason of the closed grid, never `other`, never a message to the member
  perform 1 from profiles.portfolio_rejection_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  perform profiles.check_review_internal_comment(p_internal_comment);

  select * into v_item from profiles.lock_held_portfolio_item(p_item_id, v_caller);
  if p_review_token is null
     or p_review_token is distinct from profiles.portfolio_item_review_token(p_item_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;

  -- D79 (8), 07 Q9: the trigger of 0242 frees the place and dates the purge (30 days); a refused
  -- replacement leaves its original served (RG81)
  update profiles.portfolio_items i
     set state                 = 'rejected',
         rejection_reason_code = p_reason_code,
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where i.id = p_item_id
  returning i.decided_at, i.sla_breached into v_decided, v_late;

  v_changed := profiles.store_creator_completeness(v_item.account_id);

  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'portfolio.decision', 'brevo_transactional',
          'account:' || v_item.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_item.account_id,
                                        'item_id', p_item_id, 'email_code', 'portfolio.decision'),
          'portfolio.decision:' || p_item_id::text);
  select p.status::text into v_status
    from profiles.creator_public_profiles p where p.account_id = v_item.account_id;
  if v_changed and v_status = 'published' then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select v_lead, 'lead.updated', d.destination, 'account:' || v_item.account_id::text, 100,
           pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', v_item.account_id),
           'lead.updated:' || v_lead::text
      from (values ('brevo_contact'::leads.outbox_destination),
                   ('apollo_contact'::leads.outbox_destination)) d (destination);
  end if;

  perform audit.append('portfolio.rejected', 'portfolio_item', p_item_id,
                       pg_catalog.jsonb_build_object('reason_code', p_reason_code,
                                                     'replaces_item_id', v_item.replaces_item_id,
                                                     'late', v_late));
  return query select v_decided, v_late;
end
$$;

comment on function profiles.reject_portfolio_item(uuid, text, text, text) is
  '07 RG78, RG79, RG82, RG83, RG95, RG97, RG99; 15 C6, C8; D79 (8) (0244): the holder of a live '
  'claim refuses a pending visual of queue 3 with a reason of profiles.portfolio_rejection_reasons '
  '(the grid of RG79 and the two caption reasons; never `other`, no message to the member), an '
  'internal comment of 1 000 characters at most. Same locks and token as the approval; in ONE '
  'transaction: the visual rejected (its place freed, its object removed 30 days later by the task '
  'storage_purge; a refused replacement leaves its original served), the score stored, '
  'portfolio.decision to brevo_transactional, lead.updated when the score of a published profile '
  'changed (EC-L2G-04-7), the line portfolio.rejected {reason_code, replaces_item_id, late}. Returns '
  '(decided_at, sla_breached). 22023 reason or internal_comment, then the refusals of the approval. '
  'SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and influx_admin.';

-- 3.15 Queue 3: the journalled read of the visual (modele point 10; D82 (7)) ------------------------
create or replace function profiles.read_portfolio_item_for_review(p_item_id uuid)
returns table (
  state       text,
  object_key  text,
  byte_size   integer,
  width       integer,
  height      integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := profiles.require_review_agent(false);
  v_entry   record;
  v_item    record;
begin
  select * into v_entry from profiles.lock_held_portfolio_item(p_item_id, v_caller);

  select i.state::text as state, i.object_key, i.byte_size, i.width, i.height
    into v_item
    from profiles.portfolio_items i
   where i.id = p_item_id;

  perform audit.append('queue.portfolio_read', 'queue_entry', p_item_id,
                       pg_catalog.jsonb_build_object('queue_code', 'portfolio_moderation',
                                                     'item_id', p_item_id,
                                                     'state', v_item.state));
  return query select v_item.state, v_item.object_key, v_item.byte_size, v_item.width, v_item.height;
end
$$;

comment on function profiles.read_portfolio_item_for_review(uuid) is
  'l2g/modele point 10, D82 (7), 15 RG35 (0244): the holder of a live claim on a visual of queue 3 '
  'asks for its bytes: writes queue.portfolio_read {queue_code, item_id, state} on the visual and '
  'returns (state, object_key, byte_size, width, height) for apps/api to relay them (never an URL). '
  'The refusals of lock_held_portfolio_item(). SECURITY DEFINER owned by influx_moderation_definer; '
  'EXECUTE for influx_agent and influx_admin.';

-- 4. Rights on the functions (03 P7 rule 5) -----------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'profiles.check_review_internal_comment(text)',
    'profiles.creator_review_token(uuid)',
    'profiles.portfolio_item_review_token(uuid)',
    'profiles.lock_held_creator_review_entry(uuid, uuid)',
    'profiles.lock_held_portfolio_item(uuid, uuid)',
    'profiles.store_creator_completeness(uuid)',
    'profiles.open_creator_review_entry(uuid)',
    'profiles.release_creator_review_entry(uuid)',
    'profiles.extend_creator_review_claim(uuid)',
    'profiles.force_release_creator_review_claim(uuid, text)',
    'profiles.publish_creator_review_entry(uuid, text, text)',
    'profiles.reject_creator_review_entry(uuid, text, text, text, text)',
    'profiles.read_creator_review_portfolio_item(uuid, uuid)',
    'profiles.open_portfolio_item(uuid)',
    'profiles.release_portfolio_item(uuid)',
    'profiles.extend_portfolio_item_claim(uuid)',
    'profiles.force_release_portfolio_item_claim(uuid, text)',
    'profiles.approve_portfolio_item(uuid, text, text)',
    'profiles.reject_portfolio_item(uuid, text, text, text)',
    'profiles.read_portfolio_item_for_review(uuid)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end
$$;

grant execute on function
  profiles.open_creator_review_entry(uuid),
  profiles.release_creator_review_entry(uuid),
  profiles.extend_creator_review_claim(uuid),
  profiles.force_release_creator_review_claim(uuid, text),
  profiles.publish_creator_review_entry(uuid, text, text),
  profiles.reject_creator_review_entry(uuid, text, text, text, text),
  profiles.read_creator_review_portfolio_item(uuid, uuid),
  profiles.open_portfolio_item(uuid),
  profiles.release_portfolio_item(uuid),
  profiles.extend_portfolio_item_claim(uuid),
  profiles.force_release_portfolio_item_claim(uuid, text),
  profiles.approve_portfolio_item(uuid, text, text),
  profiles.reject_portfolio_item(uuid, text, text, text),
  profiles.read_portfolio_item_for_review(uuid)
  to influx_agent, influx_admin;

reset role;
revoke create on schema profiles from influx_moderation_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_moderation_definer', current_user);
end
$$;

-- 5. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  -- the fourteen functions of queues 2 and 3: SECURITY DEFINER, their owner, empty search_path,
  -- EXECUTE for agent and admin only; the six helpers: SECURITY INVOKER, EXECUTE for nobody
  for v_def in
    select * from (values
      ('profiles.open_creator_review_entry(uuid)', true),
      ('profiles.release_creator_review_entry(uuid)', true),
      ('profiles.extend_creator_review_claim(uuid)', true),
      ('profiles.force_release_creator_review_claim(uuid, text)', true),
      ('profiles.publish_creator_review_entry(uuid, text, text)', true),
      ('profiles.reject_creator_review_entry(uuid, text, text, text, text)', true),
      ('profiles.read_creator_review_portfolio_item(uuid, uuid)', true),
      ('profiles.open_portfolio_item(uuid)', true),
      ('profiles.release_portfolio_item(uuid)', true),
      ('profiles.extend_portfolio_item_claim(uuid)', true),
      ('profiles.force_release_portfolio_item_claim(uuid, text)', true),
      ('profiles.approve_portfolio_item(uuid, text, text)', true),
      ('profiles.reject_portfolio_item(uuid, text, text, text)', true),
      ('profiles.read_portfolio_item_for_review(uuid)', true),
      ('profiles.check_review_internal_comment(text)', false),
      ('profiles.creator_review_token(uuid)', false),
      ('profiles.portfolio_item_review_token(uuid)', false),
      ('profiles.lock_held_creator_review_entry(uuid, uuid)', false),
      ('profiles.lock_held_portfolio_item(uuid, uuid)', false),
      ('profiles.store_creator_completeness(uuid)', false)
    ) as d (fn, definer)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> 'influx_moderation_definer'
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by influx_moderation_definer, SECURITY % , empty search_path',
        v_def.fn, case when v_def.definer then 'DEFINER' else 'INVOKER' end;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or not v_def.definer
            or a.grantee::regrole::text not in ('influx_agent', 'influx_admin'));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- NON REVERSIBLE (fiche invariants 1, 16; modele -4): neither the advertiser nor the owner of the
  -- brand doors executes a function of this file
  select string_agg(r || ' on ' || p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p,
         unnest(array['influx_advertiser', 'influx_identity_definer', 'influx_creator',
                      'influx_creator_profile_definer']) r
   where p.pronamespace = 'profiles'::regnamespace
     and p.proowner = 'influx_moderation_definer'::regrole
     and (p.proname like '%portfolio%' or p.proname like '%creator%')
     and pg_catalog.has_function_privilege(r, p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'EXECUTE on a decision of queue 2 or 3: %', v_bad;
  end if;

  -- the owner of the decisions writes no key, no checksum, no purge, no object of Storage
  if pg_catalog.has_any_column_privilege('influx_moderation_definer', 'profiles.portfolio_items',
                                         'INSERT')
     or pg_catalog.has_table_privilege('influx_moderation_definer', 'profiles.portfolio_items',
                                       'DELETE')
     or pg_catalog.has_column_privilege('influx_moderation_definer', 'profiles.portfolio_items',
                                        'checksum', 'UPDATE')
     or pg_catalog.has_column_privilege('influx_moderation_definer', 'profiles.portfolio_items',
                                        'exif_stripped', 'UPDATE')
     or pg_catalog.has_schema_privilege('influx_moderation_definer', 'storage', 'USAGE') then
    raise exception 'influx_moderation_definer writes a visual beyond its decision';
  end if;
  -- EC-L2G-04-8: no delay computed here
  if pg_catalog.has_function_privilege('influx_moderation_definer',
                                       'backoffice.business_deadline(text, timestamptz, integer)',
                                       'EXECUTE') then
    raise exception 'influx_moderation_definer executes backoffice.business_deadline()';
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = 'influx_moderation_definer'::regrole
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege('influx_moderation_definer', 'profiles', 'CREATE') then
    raise exception 'influx_moderation_definer left with a member or CREATE on profiles';
  end if;
end
$$;
