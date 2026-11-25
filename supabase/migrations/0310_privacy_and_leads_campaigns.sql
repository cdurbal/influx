-- =============================================================================
-- 0310_privacy_and_leads_campaigns
-- -----------------------------------------------------------------------------
-- Lot 3 / L3C, commit 05 (jalons/l3c/05.md; fiche invariants 3, 5, 8; jalons/l3c/modele.md §8, §9,
-- which PREVAIL for every name; archives/jalons/l3b/modele.md §7 « L3C étend à l'instantané »;
-- archives/jalons/l3b/annexe.md L3BS-5; 09 RG103 to RG106; 04 §9.2 « Toute table personnelle ajoutée
-- plus tard étend cette exécution »). The rights of the data subject over the data of L3C (0307 to
-- 0309), and the worker's own reads of the campaign attributes of a contact and of the facts of each
-- decision e-mail. No connector, no rendering, no TypeScript of the worker (line 06).
--
-- 1. campaigns.campaign_review_entries + texts_erased_at (the pattern of 0231 to 0233): the erasure
--    empties the opinion of a first review and keeps its author and instant (the trace of the two
--    persons, RG85); campaign_review_entries_first_review_together recreated to admit it then only.
-- 2. influx_privacy_definer, column by column (03 P7, as 0245 and 0306): reads the cycle of a campaign
--    (first publication, pause, closure; never owner_agent_id nor current_snapshot_id), its entries of
--    queue 7 (state, dates, reason, message to the brand; never an agent, the lock, the deadlines, the
--    first review, the duplicate alert nor the comment), its snapshots (version, instant, payload,
--    hash; never the publisher nor the first reviewer) and its interventions (kind, field, old and new
--    value, reason, instant; never the agent, the entry nor the comment); on an erased account only:
--    withdraws an open entry, clears its lock and empties its three texts, empties the free texts of
--    every snapshot payload, empties the values and the comment of every intervention. Every write
--    policy names an account already `deleted`; each UPDATE policy accepts the emptied row only.
-- 3. privacy.export_document() recreated FROM ITS 0306 VERSION: each campaign of advertiser_profile
--    also carries first_published_at, paused_at, pause_origin, closed_at, reviews, snapshots and
--    interventions; activity_log also serves the exported codes whose subject is a campaign of the
--    account (L3BS-5), an internal or system actor shown as INFLUX, no payload. The 15 categories are
--    unchanged; campaign.first_reviewed (excluded_third_party) stays out by the filter of F3.
-- 4. privacy.execute_request() recreated FROM ITS 0306 VERSION: the erasure also withdraws the open
--    entry of queue 7 and empties the texts of every entry (texts_erased_at), empties the free texts
--    of every snapshot (title, publicSummary, brief, productDescription, restrictions: null;
--    keyMessages: []), empties old_value, new_value and internal_comment of every intervention. Every
--    other step is unchanged; no register line (03 P8).
-- 5. Two reads of the worker (E-3), SECURITY DEFINER owned by influx_leads_definer, EXECUTE for
--    influx_worker ONLY, modelled on 0212 and 0245, on a line in processing for THIS worker:
--      leads.read_campaign_attributes(outbox, worker)   a brevo_contact or apollo_contact line:
--            (has_published, campaigns_published, last_published_at, last_sector_code,
--            last_currency, last_countries, last_networks) of the advertiser the line names; RG104
--            and RG105 only: codes, dates, a counter, a boolean; on an apollo_contact line, the
--            boolean and the date ONLY (RG105, CA70). NEVER a text, a band, a budget nor a note.
--      leads.read_brevo_campaign_decision(outbox, worker)   a campaign.decision line:
--            (email_code, campaign_type_code, occurred_on, reason_code, member_message, field_code,
--            preferred_language) of the entry, the intervention or the automatic closure the payload
--            names (modele §8); never a title, a text of the campaign, a value, an amount, the
--            internal comment, the opinion nor an agent.
--    influx_leads_definer reads the columns those reads return, each policy limited to an account
--    not erased (and to a decided entry).
--
-- RIGHTS (03 I-4, signalled): USAGE on campaigns to influx_leads_definer; column GRANTs and their
-- policies on campaigns.campaigns, campaign_review_entries, campaign_published_snapshots,
-- agent_interventions, campaign_audience_countries, campaign_deliverables; two functions of E-5
-- recreated by their owner, two functions of E-3 created; owners, search_path and grants checked again
-- (03 P7). No audit.* object touched: no register line is written nor changed by the erasure (03 P8).
--
-- Not here: the doors of 0307 to 0309 (untouched: their guards already let influx_privacy_definer
-- through), any connector or e-mail rendering (line 06), any route; the notice of the export
-- (apps/api locales).
--
-- EC-L3C-05 (micro-gaps, the safest choice):
--   EC-L3C-05-1  the data of L3C nests in each campaign of advertiser_profile (as EC-L3B-06-1): the 15
--                categories, the notice keys and the file format stay; the exact attendus of L3B-T7
--                are extended with the seven new keys, never weakened.
--   EC-L3C-05-2  an entry is exported without its first review (not even its instant: the act of an
--                agent, excluded_third_party like campaign.first_reviewed), its deadlines, its lock,
--                its breach flag nor the duplicate alert; a snapshot without the publisher nor the
--                first reviewer; an intervention without the agent, the entry nor the comment.
--   EC-L3C-05-3  the erasure keeps content_hash of a snapshot (the fingerprint of what was shown, as
--                the hash of the declaration of RG85 is kept, 0306); it no longer matches the emptied
--                payload, whose campaign says why (erased_at).
--   EC-L3C-05-4  the erasure keeps the decider and the first reviewer of an entry (internal accounts,
--                the trace of a human decision, as 0207 and 0245), and the kind, field, reason, agent
--                and instant of an intervention.
--   EC-L3C-05-5  read_campaign_attributes counts the campaigns ever published (first_published_at),
--                closed ones included; the « last » campaign is the latest first publication (then
--                id): a published campaign cannot be revalidated at L3C (Q1). Countries are the
--                audience countries in slot order, networks the codes of the deliverables in the order
--                of their first slot (RG35), comma-separated, empty when none, NULL without a
--                published campaign. A row for an advertiser with a brand profile only.
--   EC-L3C-05-6  read_brevo_campaign_decision serves the message of a refusal to the brand (RG90:
--                « Message dédié selon le cas », « Message rédigé par l'agent »; 20 to 500 characters,
--                the pattern of 0211 and 0245): it is a message TO the brand, not a text of the
--                campaign; never to Brevo contacts nor Apollo. The reason of an intervention is its
--                typed code (RG94: the brand is told why); its values never.
--   EC-L3C-05-7  an e-mail code that does not match its entry or intervention (or an unknown code)
--                gives no row, as a payload naming another account does.
--
-- ROLLBACK (before any account is erased and any campaign attribute or decision e-mail is sent once
-- 0310 is applied): recreate privacy.export_document() and privacy.execute_request() as in 0306 (as
-- influx_privacy_definer); drop the two functions of §5; drop the policies *_privacy_definer_* and
-- *_leads_definer_* created below and revoke their grants; revoke usage on schema campaigns from
-- influx_leads_definer; recreate campaign_review_entries_first_review_together as in 0307 and drop
-- column texts_erased_at (while it is null everywhere).
-- =============================================================================

-- 1. The entries of queue 7: the opinion emptied by the erasure, its author kept ----------------------

alter table campaigns.campaign_review_entries
  add column if not exists texts_erased_at timestamptz;

alter table campaigns.campaign_review_entries
  drop constraint if exists campaign_review_entries_first_review_together;
alter table campaigns.campaign_review_entries
  add constraint campaign_review_entries_first_review_together
  check ((first_reviewed_by_account_id is null) = (first_reviewed_at is null)
         and (first_review_opinion is null or first_reviewed_at is not null)
         -- the opinion goes with its author, but after the erasure (0310)
         and (first_review_opinion is not null or first_reviewed_at is null
              or texts_erased_at is not null));

alter table campaigns.campaign_review_entries
  drop constraint if exists campaign_review_entries_texts_erased;
alter table campaigns.campaign_review_entries
  add constraint campaign_review_entries_texts_erased
  check (texts_erased_at is null
         or (member_message is null and internal_comment is null and first_review_opinion is null
             and state <> 'open'));

comment on column campaigns.campaign_review_entries.texts_erased_at is
  'The erasure of the account (0310, 04 §9.2): the message, the internal comment and the opinion '
  'emptied, the entry closed (an open one withdrawn), its decider and first reviewer kept '
  '(EC-L3C-05-4). Written by privacy.execute_request() only.';

-- 2. influx_privacy_definer: what the export reads and the erasure writes (04 §9.2) -----------------
-- The four tables are FORCE ROW LEVEL SECURITY (0303, 0307 to 0309): each right comes with its policy
-- TO the owner. USAGE on campaigns and the policies on campaigns.campaigns since 0306; identity.
-- accounts (id, status) read since 0137.

-- 2.1 The cycle of a campaign (0308, 0309): read; never owner_agent_id nor current_snapshot_id
grant select (first_published_at, paused_at, pause_origin, closed_at)
   on campaigns.campaigns to influx_privacy_definer;

-- 2.2 The entries of queue 7: read without an agent, the lock, the deadlines, the first review, the
-- duplicate alert nor the comment; on an erased account, an open one withdrawn, its lock cleared, its
-- three texts emptied (one statement, the policy checks them together)
grant select (id, campaign_id, advertiser_account_id, state, created_at, decided_at,
              rejection_reason_code, member_message, closed_at, texts_erased_at),
      update (state, closed_at, claimed_by_account_id, claimed_at, claim_expires_at, member_message,
              internal_comment, first_review_opinion, texts_erased_at)
   on campaigns.campaign_review_entries to influx_privacy_definer;

drop policy if exists campaign_review_entries_privacy_definer_select
  on campaigns.campaign_review_entries;
create policy campaign_review_entries_privacy_definer_select on campaigns.campaign_review_entries
  for select to influx_privacy_definer
  using (true);

drop policy if exists campaign_review_entries_privacy_definer_erase
  on campaigns.campaign_review_entries;
create policy campaign_review_entries_privacy_definer_erase on campaigns.campaign_review_entries
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = campaign_review_entries.advertiser_account_id
                    and a.status = 'deleted'))
  with check (state <> 'open' and closed_at is not null and texts_erased_at is not null
              and claimed_by_account_id is null and claimed_at is null and claim_expires_at is null
              and member_message is null and internal_comment is null
              and first_review_opinion is null);

-- 2.3 The snapshots: read without the publisher nor the first reviewer; on an erased account, the five
-- free texts of the payload null and its key messages [] (the policy checks them together)
grant select (id, campaign_id, version, payload, content_hash, published_at),
      update (payload)
   on campaigns.campaign_published_snapshots to influx_privacy_definer;

drop policy if exists campaign_published_snapshots_privacy_definer_select
  on campaigns.campaign_published_snapshots;
create policy campaign_published_snapshots_privacy_definer_select
  on campaigns.campaign_published_snapshots
  for select to influx_privacy_definer
  using (true);

drop policy if exists campaign_published_snapshots_privacy_definer_erase
  on campaigns.campaign_published_snapshots;
create policy campaign_published_snapshots_privacy_definer_erase
  on campaigns.campaign_published_snapshots
  for update to influx_privacy_definer
  using (exists (select 1 from campaigns.campaigns c
                   join identity.accounts a on a.id = c.advertiser_account_id
                  where c.id = campaign_published_snapshots.campaign_id and a.status = 'deleted'))
  with check (payload -> 'title' = 'null'::jsonb
              and payload -> 'publicSummary' = 'null'::jsonb
              and payload -> 'brief' = 'null'::jsonb
              and payload -> 'productDescription' = 'null'::jsonb
              and payload -> 'restrictions' = 'null'::jsonb
              and payload -> 'keyMessages' = '[]'::jsonb);

-- 2.4 The interventions of an agent: read without the agent, the entry nor the comment; on an erased
-- account, both values and the comment emptied (the policy checks them together)
grant select (id, campaign_id, advertiser_account_id, kind, field_code, old_value, new_value,
              reason_code, created_at),
      update (old_value, new_value, internal_comment)
   on campaigns.agent_interventions to influx_privacy_definer;

drop policy if exists agent_interventions_privacy_definer_select on campaigns.agent_interventions;
create policy agent_interventions_privacy_definer_select on campaigns.agent_interventions
  for select to influx_privacy_definer
  using (true);

drop policy if exists agent_interventions_privacy_definer_erase on campaigns.agent_interventions;
create policy agent_interventions_privacy_definer_erase on campaigns.agent_interventions
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = agent_interventions.advertiser_account_id and a.status = 'deleted'))
  with check (old_value is null and new_value is null and internal_comment is null);

-- 3. E-5 recreated by its owner from its 0306 versions (export and execution) ------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 3.1 The export (0137 ... 0302, 0306): the data of L3C in each campaign, its decisions in the log ---
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
  'a deadline, the first review, the duplicate alert nor an internal comment); creator_profile '
  '(0219) carries the creator '
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
  '(0302, F3), the lines of the account, about the account and, since 0310 (L3BS-5), about its '
  'campaigns, an internal or system actor shown as INFLUX. p_addresses: privacy.account_addresses(). SECURITY INVOKER owned by '
  'influx_privacy_definer, NO grant.';

-- 3.2 The execution (0150 ... 0306): the erasure empties the entries, snapshots and interventions ----
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
  -- and their entries, snapshots and interventions of L3C (0310), in ONE transaction.
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
  '(0310); addresses replaced by the marker in email_change_requests (open ones cancelled account_deleted), '
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

-- 4. The reads of the worker (E-3; 09 RG93, RG103 to RG106; modele §8) ------------------------------

-- 4.1 What they read (03 P7: column by column, with its policy). The six tables are FORCE ROW LEVEL
-- SECURITY: the right comes with its policy TO the owner. identity.accounts (id, status,
-- preferred_language, timezone) since 0111, 0128; profiles.advertiser_profiles (account_id) since 0112.

grant usage on schema campaigns to influx_leads_definer;

-- the campaign: its type, sector and currency codes, its first publication and its closure; never a
-- text, the reference, a band, the budget, the declaration, an agent nor a date of its calendar
grant select (id, advertiser_account_id, campaign_type_code, sector_code, currency, first_published_at,
              closed_at)
   on campaigns.campaigns to influx_leads_definer;

drop policy if exists campaigns_leads_definer_select on campaigns.campaigns;
create policy campaigns_leads_definer_select on campaigns.campaigns
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = campaigns.advertiser_account_id and a.status <> 'deleted'));

-- RG104 « pays visés », « réseaux visés »: the codes of two lists, in their order
grant select (campaign_id, slot, country_code)
   on campaigns.campaign_audience_countries to influx_leads_definer;
grant select (campaign_id, slot, network_code)
   on campaigns.campaign_deliverables to influx_leads_definer;

drop policy if exists campaign_audience_countries_leads_definer_select
  on campaigns.campaign_audience_countries;
create policy campaign_audience_countries_leads_definer_select
  on campaigns.campaign_audience_countries
  for select to influx_leads_definer
  using (exists (select 1 from campaigns.campaigns c
                   join identity.accounts a on a.id = c.advertiser_account_id
                  where c.id = campaign_audience_countries.campaign_id and a.status <> 'deleted'));

drop policy if exists campaign_deliverables_leads_definer_select on campaigns.campaign_deliverables;
create policy campaign_deliverables_leads_definer_select on campaigns.campaign_deliverables
  for select to influx_leads_definer
  using (exists (select 1 from campaigns.campaigns c
                   join identity.accounts a on a.id = c.advertiser_account_id
                  where c.id = campaign_deliverables.campaign_id and a.status <> 'deleted'));

-- the decided entries of queue 7: their decision, instant, reason and message to the brand; never an
-- agent, the lock, the deadlines, the first review nor the internal comment
grant select (id, campaign_id, advertiser_account_id, state, decided_at, rejection_reason_code,
              member_message)
   on campaigns.campaign_review_entries to influx_leads_definer;

drop policy if exists campaign_review_entries_leads_definer_select
  on campaigns.campaign_review_entries;
create policy campaign_review_entries_leads_definer_select on campaigns.campaign_review_entries
  for select to influx_leads_definer
  using (state in ('published', 'rejected')
         and exists (select 1 from identity.accounts a
                      where a.id = campaign_review_entries.advertiser_account_id
                        and a.status <> 'deleted'));

-- the interventions: their kind, field code, reason code and instant; never a value, the agent nor
-- the internal comment
grant select (id, campaign_id, advertiser_account_id, kind, field_code, reason_code, created_at)
   on campaigns.agent_interventions to influx_leads_definer;

drop policy if exists agent_interventions_leads_definer_select on campaigns.agent_interventions;
create policy agent_interventions_leads_definer_select on campaigns.agent_interventions
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = agent_interventions.advertiser_account_id and a.status <> 'deleted'));

-- 4.2 The campaign attributes of a contact (09 RG104, RG105, CA69, CA70; EC-L3C-05-5) ----------------
drop function if exists leads.read_campaign_attributes(bigint, text);

create function leads.read_campaign_attributes(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  has_published        boolean,
  campaigns_published  integer,
  last_published_at    timestamptz,
  last_sector_code     text,
  last_currency        text,
  last_countries       text,
  last_networks        text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line     record;
  v_account  uuid;
  v_apollo   boolean;
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker: the attributes are read for the call about to be
  -- made, never for a line of another instance or one taken back.
  select o.destination, o.subject_key
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_line.destination not in ('brevo_contact', 'apollo_contact') then
    raise exception 'a contact line of Brevo or Apollo only'
      using errcode = 'invalid_parameter_value';
  end if;
  -- RG105, CA70: Apollo receives « a publié une campagne » and its date, nothing else
  v_apollo := v_line.destination = 'apollo_contact';

  -- The account comes from the line, never from the caller
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or pg_catalog.split_part(v_line.subject_key, ':', 2) !~ c_uuid then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;

  return query
  with published as (
    select c.id, c.sector_code, c.currency, c.first_published_at
      from campaigns.campaigns c
     where c.advertiser_account_id = v_account
       and c.first_published_at is not null
  ),
  last_one as (
    select l.id, l.sector_code, l.currency, l.first_published_at
      from published l
     order by l.first_published_at desc, l.id desc
     limit 1
  )
  select (select count(*) from published) > 0,
         case when v_apollo then null
              else (select count(*) from published)::integer end,
         (select l.first_published_at from last_one l),
         case when v_apollo then null else (select l.sector_code from last_one l) end,
         case when v_apollo then null else (select l.currency::text from last_one l) end,
         case when v_apollo then null
              else (select coalesce((select pg_catalog.string_agg(k.country_code::text, ','
                                                                  order by k.slot)
                                       from campaigns.campaign_audience_countries k
                                      where k.campaign_id = l.id), '')
                      from last_one l) end,
         case when v_apollo then null
              else (select coalesce((select pg_catalog.string_agg(n.network_code, ','
                                                                  order by n.first_slot)
                                       from (select d.network_code,
                                                    pg_catalog.min(d.slot) as first_slot
                                               from campaigns.campaign_deliverables d
                                              where d.campaign_id = l.id
                                              group by d.network_code) n), '')
                      from last_one l) end
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.account_id = v_account
     and a.status <> 'deleted';
end
$$;

comment on function leads.read_campaign_attributes(bigint, text) is
  'E-3 read of the campaign attributes of a Brevo or Apollo contact (09 RG104, RG105, CA69, CA70; '
  'modele §8; 0310), on a line of brevo_contact or apollo_contact in processing for p_worker only '
  '(55000 otherwise; 22023 for another destination): whether the advertiser ever published a '
  'campaign, how many (first_published_at, closed ones included), the latest first publication and, '
  'of that campaign, its sector code, its currency, its audience countries (slot order) and the '
  'network codes of its deliverables (order of their first slot, RG35), comma-separated, empty when '
  'none, NULL without a published campaign (EC-L3C-05-5). On an apollo_contact line, the boolean '
  'and the date ONLY (RG105). Codes, dates, a counter and a boolean: never a text, the reference, a '
  'band, the budget, the declaration nor a note (RG106, D78). No row for an account without a brand '
  'profile or an erased account. SECURITY DEFINER owned by influx_leads_definer, empty search_path; '
  'EXECUTE for influx_worker ONLY.';

-- 4.3 The facts of a decision e-mail (09 RG93, RG94; modele §8; EC-L3C-05-6, -7) ---------------------
drop function if exists leads.read_brevo_campaign_decision(bigint, text);

create function leads.read_brevo_campaign_decision(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  email_code          text,
  campaign_type_code  text,
  occurred_on         date,
  reason_code         text,
  member_message      text,
  field_code          text,
  preferred_language  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line      record;
  v_account   uuid;
  v_campaign  uuid;
  v_code      text;
  v_kind      text;
  c_uuid      constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker: the decision is read for the e-mail about to be
  -- sent, never for a line of another instance or one taken back.
  select o.destination, o.event_type, o.subject_key, o.payload
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_line.destination <> 'brevo_transactional' or v_line.event_type <> 'campaign.decision' then
    raise exception 'a campaign.decision line of brevo_transactional only'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The account comes from the line, the campaign and its act from the payload, never from the caller
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or pg_catalog.split_part(v_line.subject_key, ':', 2) !~ c_uuid
     or coalesce(v_line.payload ->> 'campaign_id', '') !~ c_uuid then
    return;
  end if;
  v_account  := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;
  v_campaign := (v_line.payload ->> 'campaign_id')::uuid;
  v_code     := v_line.payload ->> 'email_code';

  -- 0308: a decision of queue 7, named by its entry
  if v_code in ('published', 'rejected') then
    if coalesce(v_line.payload ->> 'entry_id', '') !~ c_uuid then
      return;
    end if;
    return query
    select v_code,
           c.campaign_type_code,
           (e.decided_at at time zone coalesce(a.timezone, 'UTC'))::date,
           e.rejection_reason_code,
           e.member_message,
           null::text,
           a.preferred_language::text
      from campaigns.campaign_review_entries e
      join campaigns.campaigns c
        on c.id = e.campaign_id and c.advertiser_account_id = e.advertiser_account_id
      join identity.accounts a on a.id = e.advertiser_account_id
     where e.id = (v_line.payload ->> 'entry_id')::uuid
       and e.campaign_id = v_campaign
       and e.advertiser_account_id = v_account
       and e.state::text = v_code
       and a.status <> 'deleted';
    return;
  end if;

  -- 0309: an intervention of INFLUX, named by its line
  v_kind := case v_code
              when 'paused_by_influx'  then 'paused'
              when 'resumed_by_influx' then 'resumed'
              when 'closed_by_influx'  then 'closed'
              when 'corrected'         then 'corrected'
              when 'created_for_brand' then 'created'
            end;
  if v_kind is not null then
    if coalesce(v_line.payload ->> 'intervention_id', '') !~ c_uuid then
      return;
    end if;
    return query
    select v_code,
           c.campaign_type_code,
           (i.created_at at time zone coalesce(a.timezone, 'UTC'))::date,
           i.reason_code,
           null::text,
           i.field_code,
           a.preferred_language::text
      from campaigns.agent_interventions i
      join campaigns.campaigns c
        on c.id = i.campaign_id and c.advertiser_account_id = i.advertiser_account_id
      join identity.accounts a on a.id = i.advertiser_account_id
     where i.id = (v_line.payload ->> 'intervention_id')::uuid
       and i.campaign_id = v_campaign
       and i.advertiser_account_id = v_account
       and i.kind = v_kind
       and a.status <> 'deleted';
    return;
  end if;

  -- 0309: the automatic closure (RG9), named by its campaign
  if v_code = 'closed_automatically' then
    return query
    select v_code,
           c.campaign_type_code,
           (c.closed_at at time zone coalesce(a.timezone, 'UTC'))::date,
           null::text,
           null::text,
           null::text,
           a.preferred_language::text
      from campaigns.campaigns c
      join identity.accounts a on a.id = c.advertiser_account_id
     where c.id = v_campaign
       and c.advertiser_account_id = v_account
       and c.closed_at is not null
       and a.status <> 'deleted';
  end if;
  -- any other code: no row (EC-L3C-05-7)
end
$$;

comment on function leads.read_brevo_campaign_decision(bigint, text) is
  'E-3 read of a campaign decision e-mail (09 RG93, RG94; modele §8; 0310), on a campaign.decision '
  'line of brevo_transactional in processing for p_worker only (55000 otherwise; 22023 for another '
  'event type or destination): the email_code of the payload, the type code of the campaign, the '
  'date of the act in the account''s time zone, its reason code (of RG90 for a refusal, of RG94 for '
  'an intervention), the message of a refusal to the brand (EC-L3C-05-6), the field code of a '
  'correction and the account''s UI language. published and rejected read the decided entry named '
  'by entry_id; paused_by_influx, resumed_by_influx, closed_by_influx, corrected and '
  'created_for_brand the intervention named by intervention_id; closed_automatically the closure of '
  'the campaign. Never a title, a text of the campaign, a value, an amount, a band, the internal '
  'comment, the opinion nor an agent. No row for a code that does not match its act, an act that is '
  'not the line''s account''s nor its campaign''s, or an erased account (EC-L3C-05-7). SECURITY '
  'DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_campaign_attributes(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function leads.read_brevo_campaign_decision(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_campaign_attributes(bigint, text) to influx_worker;
grant execute on function leads.read_brevo_campaign_decision(bigint, text) to influx_worker;

-- Hand the functions to influx_leads_definer (03 P7 rule 5, window of 0004 §9)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;

alter function leads.read_campaign_attributes(bigint, text) owner to influx_leads_definer;
alter function leads.read_brevo_campaign_decision(bigint, text) owner to influx_leads_definer;

revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 5. End-state assertions --------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  -- E-5 unchanged in its form (0137, 0306); the two reads of the worker
  for v_def in
    select * from (values
      ('privacy.execute_request(uuid, jsonb)', 'influx_privacy_definer', true,
       array['influx_privacy']),
      ('privacy.export_document(uuid, text[], jsonb)', 'influx_privacy_definer', false,
       array[]::text[]),
      ('leads.read_campaign_attributes(bigint, text)', 'influx_leads_definer', true,
       array['influx_worker']),
      ('leads.read_brevo_campaign_decision(bigint, text)', 'influx_leads_definer', true,
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
  if pg_catalog.strpos((select prosrc from pg_catalog.pg_proc
                         where oid = 'privacy.export_document(uuid, text[], jsonb)'::regprocedure),
                       'join audit.event_types t on t.code = e.event_type and t.export_class = ''exported''')
       = 0 then
    raise exception 'privacy.export_document lost the filter of F3';
  end if;

  -- §2: influx_privacy_definer inserts nor deletes nothing in the three tables of L3C, never reads an
  -- agent, a lock, a deadline, the first review, the opinion nor a comment, never writes a key, a
  -- decision, a code nor an author
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid in ('campaigns.campaign_review_entries'::regclass,
                   'campaigns.campaign_published_snapshots'::regclass,
                   'campaigns.agent_interventions'::regclass)
     and (pg_catalog.has_table_privilege('influx_privacy_definer', c.oid, 'INSERT, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege('influx_privacy_definer', c.oid, 'INSERT'));
  if v_bad is not null then
    raise exception 'influx_privacy_definer may insert into or delete from: %', v_bad;
  end if;
  select string_agg(t.tab || '.' || t.col || ' ' || t.priv, ', ') into v_bad
    from (values ('campaigns.campaigns', 'owner_agent_id', 'SELECT'),
                 ('campaigns.campaigns', 'current_snapshot_id', 'SELECT'),
                 ('campaigns.campaigns', 'first_published_at', 'UPDATE'),
                 ('campaigns.campaigns', 'closed_at', 'UPDATE'),
                 ('campaigns.campaign_review_entries', 'decided_by_account_id', 'SELECT'),
                 ('campaigns.campaign_review_entries', 'first_reviewed_by_account_id', 'SELECT'),
                 ('campaigns.campaign_review_entries', 'first_reviewed_at', 'SELECT'),
                 ('campaigns.campaign_review_entries', 'first_review_opinion', 'SELECT'),
                 ('campaigns.campaign_review_entries', 'internal_comment', 'SELECT'),
                 ('campaigns.campaign_review_entries', 'claimed_by_account_id', 'SELECT'),
                 ('campaigns.campaign_review_entries', 'sla_due_at', 'SELECT'),
                 ('campaigns.campaign_review_entries', 'duplicate_of_campaign_id', 'SELECT'),
                 ('campaigns.campaign_review_entries', 'decided_by_account_id', 'UPDATE'),
                 ('campaigns.campaign_review_entries', 'first_reviewed_by_account_id', 'UPDATE'),
                 ('campaigns.campaign_review_entries', 'rejection_reason_code', 'UPDATE'),
                 ('campaigns.campaign_review_entries', 'advertiser_account_id', 'UPDATE'),
                 ('campaigns.campaign_published_snapshots', 'published_by_account_id', 'SELECT'),
                 ('campaigns.campaign_published_snapshots', 'first_reviewed_by_account_id', 'SELECT'),
                 ('campaigns.campaign_published_snapshots', 'content_hash', 'UPDATE'),
                 ('campaigns.campaign_published_snapshots', 'version', 'UPDATE'),
                 ('campaigns.agent_interventions', 'agent_account_id', 'SELECT'),
                 ('campaigns.agent_interventions', 'internal_comment', 'SELECT'),
                 ('campaigns.agent_interventions', 'review_entry_id', 'SELECT'),
                 ('campaigns.agent_interventions', 'agent_account_id', 'UPDATE'),
                 ('campaigns.agent_interventions', 'kind', 'UPDATE'),
                 ('campaigns.agent_interventions', 'reason_code', 'UPDATE'))
           as t (tab, col, priv)
   where pg_catalog.has_column_privilege('influx_privacy_definer', t.tab, t.col, t.priv);
  if v_bad is not null then
    raise exception 'influx_privacy_definer holds: %', v_bad;
  end if;

  -- every write policy of influx_privacy_definer on the three tables is bound to an erased account
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
    from pg_catalog.pg_policies
   where schemaname = 'campaigns'
     and tablename in ('campaign_review_entries', 'campaign_published_snapshots',
                       'agent_interventions')
     and 'influx_privacy_definer' = any (roles)
     and cmd <> 'SELECT'
     and (qual is null or pg_catalog.strpos(qual, '''deleted''') = 0);
  if v_bad is not null then
    raise exception 'a write policy of influx_privacy_definer not bound to an erased account: %', v_bad;
  end if;

  -- §4: influx_leads_definer reads the listed columns only, writes nothing (RG106: never a text, the
  -- reference, a band, the budget, the declaration, a value, an agent nor an internal text)
  select string_agg(t.tab || '.' || c.attname, ', ') into v_bad
    from (values ('campaigns.campaigns',
                  array['id', 'advertiser_account_id', 'campaign_type_code', 'sector_code', 'currency',
                        'first_published_at', 'closed_at']),
                 ('campaigns.campaign_audience_countries',
                  array['campaign_id', 'slot', 'country_code']),
                 ('campaigns.campaign_deliverables', array['campaign_id', 'slot', 'network_code']),
                 ('campaigns.campaign_review_entries',
                  array['id', 'campaign_id', 'advertiser_account_id', 'state', 'decided_at',
                        'rejection_reason_code', 'member_message']),
                 ('campaigns.agent_interventions',
                  array['id', 'campaign_id', 'advertiser_account_id', 'kind', 'field_code',
                        'reason_code', 'created_at']))
           as t (tab, allowed)
    join pg_catalog.pg_attribute c on c.attrelid = t.tab::regclass
   where c.attnum > 0 and not c.attisdropped
     and c.attname <> all (t.allowed)
     and pg_catalog.has_column_privilege('influx_leads_definer', c.attrelid, c.attname,
                                         'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'influx_leads_definer reaches %', v_bad;
  end if;
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'campaigns' and c.relkind in ('r', 'p')
     and (pg_catalog.has_any_column_privilege('influx_leads_definer', c.oid, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege('influx_leads_definer', c.oid, 'DELETE, TRUNCATE')
          or (c.oid not in ('campaigns.campaigns'::regclass,
                            'campaigns.campaign_audience_countries'::regclass,
                            'campaigns.campaign_deliverables'::regclass,
                            'campaigns.campaign_review_entries'::regclass,
                            'campaigns.agent_interventions'::regclass)
              and pg_catalog.has_any_column_privilege('influx_leads_definer', c.oid,
                                                      'SELECT, REFERENCES')));
  if v_bad is not null then
    raise exception 'influx_leads_definer writes or reaches %', v_bad;
  end if;

  -- influx_worker still holds no right on the schema campaigns: the reads go through the functions
  if pg_catalog.has_schema_privilege('influx_worker', 'campaigns', 'USAGE') then
    raise exception 'influx_worker holds USAGE on the schema campaigns';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_privacy_definer', 'influx_leads_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_privacy_definer', 'campaigns', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_leads_definer', 'campaigns', 'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
