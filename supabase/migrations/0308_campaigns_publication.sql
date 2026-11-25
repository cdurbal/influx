-- =============================================================================
-- 0308_campaigns_publication
-- -----------------------------------------------------------------------------
-- Lot 3 / L3C, commit 03 (jalons/l3c/03.md; fiche invariants 1 to 6, 8, 10; jalons/l3c/modele.md §2
-- to §4, §8, which PREVAIL for every name; 09 RG5, RG15, RG85, RG89, RG90, RG92, CA5, CA48, CA56,
-- CA57, CA59, CA69; 04 §5.4 « revue renforcée », « campaign_published_snapshots »; 17b §3.8).
-- The decisions of queue 7: the published snapshot, the enhanced review in two examinations, the
-- publication and the typed refusal, the decision e-mail and the lead queued in the transaction of
-- the decision. No state of the cycle (0309), no correction nor creation by an agent (0309), nothing
-- of privacy.* (0310), no route. Signalled I-4 (03): SECURITY DEFINER functions, GRANTs, policies,
-- audit codes.
--
-- 1. Two codes: campaign.first_reviewed (register, excluded_third_party: the act of an agent, never
--    the brand's, modele §8, fiche invariant 5) and campaign.decision (the queue only, 0244 pattern).
-- 2. campaigns.campaigns: owner_agent_id (internal FK, pattern 0008), current_snapshot_id (composite
--    FK, the same campaign), first_published_at (RG103); campaigns_published_needs_review (published,
--    paused => current_snapshot_id; modele §2, invariant 1).
-- 3. campaigns.campaign_published_snapshots (modele §2): the payload IS campaign_creator_view() at
--    the decision (TM5.6, D78), its version per campaign, its SHA-256, the publisher and the first
--    reviewer (two persons), the entry; CHECK campaign_published_snapshots_no_internal_keys; immutable
--    outside the erasure and the migration role.
-- 4. campaigns.assert_enhanced_review() (04 §5.4, modele §3): BEFORE UPDATE when current_snapshot_id
--    changes; a sensitive sector (join, never copied, RG84) asks the first reviewer and the
--    declaration, otherwise 23514 enhanced_review. The only non declarative publication rule.
-- 5. Agent and admin (aal2) read the campaign (never the suspended range), its nine lists, its
--    snapshots and the refusal reasons; never their own account (modele §9).
-- 6. influx_campaign_review_definer: what the decisions read and write; EXECUTE of
--    campaign_creator_view() and of assert_live_campaign_cap() (RG15 read again at the publication).
-- 7. first_review_campaign_entry, publish_campaign_review_entry, reject_campaign_review_entry
--    (SECURITY DEFINER, EXECUTE for agent and admin): the caller's live claim, the version token,
--    lock_held_campaign_review_entry() (0307) for the claim and the stale token.
--
-- Refusals (modele §3, §4; the MESSAGE is the code, the DETAIL its precision): 42501 forbidden (an
-- unknown entry, the caller's own account, an open entry of an account he holds, the first reviewer
-- at the second examination, outside an active agent or admin in aal2: one answer, T14); 55P03
-- no_live_claim; 55000 entry_closed, campaign_state, stale_token, not_enhanced_review,
-- first_review_given, enhanced_review_required (CA57), brand_not_publishable, calendar_passed (CA48),
-- live_campaign_cap (RG15, DETAIL the campaigns to close); 22023 opinion, owner_agent, reason,
-- member_message, internal_comment; 23514 enhanced_review (the trigger, a second line).
--
-- EC-L3C-03 (micro-gaps, the safest choice):
--   EC-L3C-03-1  The payload is bounded by pg_column_size <= 32 000 (04 §5.4, as the outbox and the
--                register measure theirs), not by the text length: the stored size is what is kept.
--   EC-L3C-03-2  The refusal runs none of the publication controls but the claim and the token: a
--                passed calendar (CA48) and a brand no longer publishable are refused WITH a reason.
--   EC-L3C-03-3  The first review releases the claim (modele §3 « verrou rendu ») without a
--                queue.claim_released line: campaign.first_reviewed {entry_id} carries the act.
--   EC-L3C-03-4  Agent and admin read the nine lists of a campaign (modele §9 « lisent tout »): the
--                record of 17b §3.8 shows the deliverables and the audience.
--   EC-L3C-03-5  campaign.decision is classified exported (the default rule of 0302): it is never
--                written to the register, the queue only (0244 pattern).
--   EC-L3C-03-6  The update policy of the owner on a campaign admits published and rejected only;
--                0309 recreates it for the passages of the cycle.
--
-- ROLLBACK (before any campaign is published or rejected by 0308): drop the three functions of
-- section 8 and the helper check_campaign_review_text(); drop trigger campaigns_enhanced_review and
-- function campaigns.assert_enhanced_review(); alter table campaigns.campaigns drop constraint
-- campaigns_published_needs_review, campaigns_current_snapshot_fk, campaigns_owner_agent_is_internal_fk,
-- drop columns owner_agent_id, owner_agent_is_internal, current_snapshot_id, first_published_at; drop
-- table campaigns.campaign_published_snapshots and function campaigns.guard_campaign_snapshot_write();
-- alter table campaigns.campaign_review_entries drop constraint campaign_review_entries_id_campaign;
-- drop the policies *_internal_select and *_campaign_review_definer_* created below and revoke their
-- grants; revoke execute on campaigns.campaign_creator_view(uuid), campaigns.assert_live_campaign_cap
-- (uuid) from influx_campaign_review_definer; revoke usage on schema profiles, leads from
-- influx_campaign_review_definer; delete the two event types of section 1 (while no line references
-- them).
-- =============================================================================

-- 1. The codes of the register and of the queue (modele §8) -----------------------------------------

insert into audit.event_types (code, domain, subject_type, severity, export_class) values
  -- 09 RG85, modele §3: the reasoned favourable opinion of the first reviewer; the act of an agent,
  -- never served to the brand (fiche invariant 5): its occurrence is a third party's act (F3)
  ('campaign.first_reviewed', 'campaigns', 'campaign',    'sensitive', 'excluded_third_party'),
  -- the queue only (never a register line): the decision e-mail of 09 RG93 (L3C commit 06)
  ('campaign.decision',       'campaigns', 'queue_entry', 'info',      'exported')
on conflict (code) do nothing;

-- 2. The campaign: its commercial owner, its current snapshot, its first publication ---------------

alter table campaigns.campaigns
  add column if not exists owner_agent_id          uuid,
  add column if not exists owner_agent_is_internal boolean not null generated always as (true) stored,
  add column if not exists current_snapshot_id     uuid,
  add column if not exists first_published_at      timestamptz;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'campaigns_owner_agent_is_internal_fk'
                    and conrelid = 'campaigns.campaigns'::regclass) then
    -- pattern 0008: the owner is always an internal account (agent or admin), declaratively
    alter table campaigns.campaigns
      add constraint campaigns_owner_agent_is_internal_fk
      foreign key (owner_agent_id, owner_agent_is_internal)
      references identity.account_roles (account_id, is_internal);
  end if;
  -- the composite key of an entry, for the snapshot that names it
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'campaign_review_entries_id_campaign'
                    and conrelid = 'campaigns.campaign_review_entries'::regclass) then
    alter table campaigns.campaign_review_entries
      add constraint campaign_review_entries_id_campaign unique (id, campaign_id);
  end if;
end
$$;

comment on column campaigns.campaigns.owner_agent_id is
  'The INFLUX salesperson responsible for the campaign (17b §3.8 « Commercial responsable », AL20), '
  'an internal account (campaigns_owner_agent_is_internal_fk, pattern 0008); written by the '
  'publication (0308). Never served to a creator.';
comment on column campaigns.campaigns.owner_agent_is_internal is
  'Always true. Only exists to carry the composite key that restricts owner_agent_id to an agent or '
  'admin account (0008).';
comment on column campaigns.campaigns.first_published_at is
  'First publication (09 RG103, modele §2): written once by the publication (0308), never cleared.';

-- 3. campaigns.campaign_published_snapshots (modele §2; 04 §5.4) --------------------------------------

create table if not exists campaigns.campaign_published_snapshots (
  id                            uuid        not null primary key default gen_random_uuid(),
  campaign_id                   uuid        not null references campaigns.campaigns (id),
  version                       smallint    not null,
  payload                       jsonb       not null,
  content_hash                  bytea       not null,
  published_at                  timestamptz not null,
  published_by_account_id       uuid        not null references identity.accounts (id),
  first_reviewed_by_account_id  uuid        references identity.accounts (id),
  review_entry_id               uuid        not null,

  constraint campaign_published_snapshots_entry_fk
    foreign key (review_entry_id, campaign_id)
    references campaigns.campaign_review_entries (id, campaign_id),
  constraint campaign_published_snapshots_version_unique unique (campaign_id, version),
  constraint campaign_published_snapshots_entry_unique unique (review_entry_id),
  constraint campaign_published_snapshots_id_campaign unique (id, campaign_id),
  constraint campaign_published_snapshots_version_positive check (version > 0),
  constraint campaign_published_snapshots_payload_object check (jsonb_typeof(payload) = 'object'),
  -- EC-L3C-03-1
  constraint campaign_published_snapshots_payload_size check (pg_column_size(payload) <= 32000),
  constraint campaign_published_snapshots_content_hash_sha256 check (octet_length(content_hash) = 32),
  -- 09 RG85, CA57: the publisher is never the first reviewer
  constraint campaign_published_snapshots_two_persons
    check (published_by_account_id <> first_reviewed_by_account_id),
  -- TM5.6, D78 (modele §2, doubled in the base): what a creator reads never holds the currency, a
  -- band, a budget, the internal reference, a note, the declaration, the sensitivity nor the state
  constraint campaign_published_snapshots_no_internal_keys
    check (not (payload ?| array[
      'currency', 'productValueBand', 'productValueBandCode', 'product_value_band_code',
      'perCreatorBudgetBand', 'perCreatorBudgetBandCode', 'per_creator_budget_band_code',
      'perCreatorAmountMinMinor', 'perCreatorAmountMaxMinor', 'per_creator_amount_min_minor',
      'per_creator_amount_max_minor', 'totalBudget', 'totalBudgetMinor', 'total_budget_minor',
      'internalReference', 'internal_reference', 'internalNote', 'internal_note',
      'authorizationsDeclaration', 'authorizationsDeclaredAt', 'authorizationsDeclaredByAccountId',
      'authorizationsDeclarationLocale', 'authorizationsDeclarationHash',
      'authorizations_declared_at', 'authorizations_declared_by_account_id',
      'authorizations_declaration_locale', 'authorizations_declaration_hash',
      'sectorIsSensitive', 'is_sensitive', 'status', 'maxApplications', 'max_applications']))
);

create index if not exists campaign_published_snapshots_campaign_idx
  on campaigns.campaign_published_snapshots (campaign_id, version);

comment on table campaigns.campaign_published_snapshots is
  'What a creator reads of a published campaign (04 §5.4, modele §2; 09 RG7, RG65, D78): the output '
  'of campaigns.campaign_creator_view() at the decision, version n+1 per campaign, its SHA-256, the '
  'publisher and the first reviewer of an enhanced review, the entry of queue 7. A dated copy of what '
  'was shown, never a source of truth; immutable outside the erasure. Written by '
  'publish_campaign_review_entry() only; read by agent and admin (aal2); NEVER by influx_creator '
  'directly (the read comes with L3D).';
comment on column campaigns.campaign_published_snapshots.payload is
  'campaigns.campaign_creator_view() at the decision (TM5.6): an allow-list, never the currency, a '
  'band, the total budget, the internal reference, the declaration nor the sensitivity (CHECK '
  'campaign_published_snapshots_no_internal_keys). pg_column_size <= 32 000 (EC-L3C-03-1).';
comment on column campaigns.campaign_published_snapshots.content_hash is
  'SHA-256 of payload::text in UTF-8: the fingerprint of what was shown to the creators.';

-- the current snapshot of a campaign is one of ITS snapshots
do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'campaigns_current_snapshot_fk'
                    and conrelid = 'campaigns.campaigns'::regclass) then
    alter table campaigns.campaigns
      add constraint campaigns_current_snapshot_fk
      foreign key (current_snapshot_id, id)
      references campaigns.campaign_published_snapshots (id, campaign_id);
  end if;
end
$$;

-- invariant 1 (RG5, CA5): no campaign is visible without a human publication. Before 0308 nothing
-- could publish: a published or paused campaign without its snapshot is a defect to settle by hand.
do $$
begin
  if exists (select 1 from campaigns.campaigns
              where status in ('published', 'paused') and current_snapshot_id is null) then
    raise exception 'a published or paused campaign has no snapshot: settle it before 0308';
  end if;
end
$$;

alter table campaigns.campaigns drop constraint if exists campaigns_published_needs_review;
alter table campaigns.campaigns
  add constraint campaigns_published_needs_review
  check (status not in ('published', 'paused') or current_snapshot_id is not null);

comment on column campaigns.campaigns.current_snapshot_id is
  'The snapshot served to the creators (04 §5.4, modele §2): written by the publication only (0308); '
  'campaigns_published_needs_review: published and paused campaigns carry one (RG5, invariant 1).';

-- 3.1 Immutable outside the erasure (modele §2): the owner of the decisions holds no UPDATE nor
-- DELETE either; this trigger is the second line
create or replace function campaigns.guard_campaign_snapshot_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- free: the erasure (0310) and the migration role (every role outside influx_%)
  if current_user = 'influx_privacy_definer' or current_user not like 'influx\_%' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception 'snapshot_immutable'
    using errcode = 'object_not_in_prerequisite_state', detail = 'snapshot_immutable';
end
$$;

comment on function campaigns.guard_campaign_snapshot_write() is
  'modele §2 (0308): BEFORE UPDATE OR DELETE on campaigns.campaign_published_snapshots; 55000 '
  'snapshot_immutable for every influx_% role but influx_privacy_definer (the erasure, 0310). '
  'SECURITY INVOKER, reads nothing.';

revoke all on function campaigns.guard_campaign_snapshot_write()
  from public, anon, authenticated, service_role;

drop trigger if exists campaign_published_snapshots_immutable
  on campaigns.campaign_published_snapshots;
create trigger campaign_published_snapshots_immutable
  before update or delete on campaigns.campaign_published_snapshots
  for each row execute function campaigns.guard_campaign_snapshot_write();

-- 4. The enhanced review, the one non declarative rule of publication (04 §5.4; modele §3) ----------

create or replace function campaigns.assert_enhanced_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sensitive  boolean;
  v_first      uuid;
begin
  -- RG84: the sensitivity of the CURRENT sector, read by join, never copied on the campaign
  select s.is_sensitive into v_sensitive
    from reference.sectors s
   where s.code = new.sector_code;
  if coalesce(v_sensitive, false) then
    select p.first_reviewed_by_account_id into v_first
      from campaigns.campaign_published_snapshots p
     where p.id = new.current_snapshot_id;
    if v_first is null or new.authorizations_declaration_hash is null then
      raise exception 'enhanced_review'
        using errcode = 'check_violation', detail = 'enhanced_review';
    end if;
  end if;
  return new;
end
$$;

comment on function campaigns.assert_enhanced_review() is
  '04 §5.4, 09 RG85, modele §3 (0308): BEFORE UPDATE on campaigns.campaigns when current_snapshot_id '
  'changes to a snapshot: a sensitive sector (reference.sectors, join) asks the first reviewer on the '
  'snapshot and the declaration on the campaign; 23514 enhanced_review otherwise. SECURITY INVOKER '
  '(the writer reads with its own rights), executed by nobody.';

revoke all on function campaigns.assert_enhanced_review()
  from public, anon, authenticated, service_role;

drop trigger if exists campaigns_enhanced_review on campaigns.campaigns;
create trigger campaigns_enhanced_review
  before update on campaigns.campaigns
  for each row
  when (new.current_snapshot_id is not null
        and new.current_snapshot_id is distinct from old.current_snapshot_id)
  execute function campaigns.assert_enhanced_review();

-- 5. Row level security and the reads of agent and admin (modele §9) --------------------------------

alter table campaigns.campaign_published_snapshots enable row level security;
alter table campaigns.campaign_published_snapshots force row level security;
revoke all on campaigns.campaign_published_snapshots
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;

-- 5.1 The campaign: every column but the suspended range (D78), never their own account
grant select (id, advertiser_account_id, status, title, campaign_type_code, public_summary, brief,
              internal_reference, product_description, sector_code, restrictions, product_is_sent,
              product_value_band_code, creator_keeps_product, shipping_costs_borne_by,
              usage_rights_code, usage_rights_duration_band, usage_rights_territory_scope,
              exclusivity_band, content_review_delay, audience_gender_code, currency,
              remuneration_kind, per_creator_budget_band_code, creators_wanted, total_budget_minor,
              applications_close_on, content_due_on, starts_on, ends_on, max_applications,
              authorizations_declared_at, authorizations_declared_by_account_id,
              authorizations_declaration_locale, authorizations_declaration_hash, submitted_at,
              erased_at, created_at, updated_at, owner_agent_id, owner_agent_is_internal,
              current_snapshot_id, first_published_at)
   on campaigns.campaigns to influx_agent, influx_admin;

drop policy if exists campaigns_internal_select on campaigns.campaigns;
create policy campaigns_internal_select on campaigns.campaigns
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and advertiser_account_id is distinct from (select influx.current_account_id()));

-- 5.2 The nine lists (EC-L3C-03-4) and the snapshots: the rows of a campaign they see
do $$
declare
  t text;
begin
  foreach t in array array[
    'campaign_key_messages', 'campaign_deliverables', 'campaign_usage_territories',
    'campaign_audience_countries', 'campaign_audience_languages', 'campaign_audience_bands',
    'campaign_audience_age_bands', 'campaign_topics', 'campaign_requested_items',
    'campaign_published_snapshots']
  loop
    execute format('grant select on campaigns.%I to influx_agent, influx_admin', t);
    execute format('drop policy if exists %I on campaigns.%I', t || '_internal_select', t);
    execute format('create policy %I on campaigns.%I for select to influx_agent, influx_admin '
                   'using ((select influx.has_aal2()) and exists (select 1 from campaigns.campaigns c '
                   'where c.id = %I.campaign_id '
                   'and c.advertiser_account_id is distinct from (select influx.current_account_id())))',
                   t || '_internal_select', t, t);
  end loop;
end
$$;

-- 5.3 The refusal reasons of queue 7 (the policy is 0303's, EC-L3B-02-1)
grant select on campaigns.rejection_reasons to influx_agent, influx_admin;

-- 6. What influx_campaign_review_definer adds: the decisions (modele §4) ----------------------------

grant usage on schema profiles, leads to influx_campaign_review_definer;

-- 6.1 The campaign: its state, its cycle columns, what RG15 reads; the publication writes the state,
-- the snapshot, the first publication and the owner
grant select (status, submitted_at, owner_agent_id, current_snapshot_id, first_published_at)
   on campaigns.campaigns to influx_campaign_review_definer;
grant update (status, owner_agent_id, current_snapshot_id, first_published_at)
   on campaigns.campaigns to influx_campaign_review_definer;

drop policy if exists campaigns_campaign_review_definer_update on campaigns.campaigns;
create policy campaigns_campaign_review_definer_update on campaigns.campaigns
  for update to influx_campaign_review_definer
  using (advertiser_account_id is distinct from (select influx.current_account_id()))
  with check (advertiser_account_id is distinct from (select influx.current_account_id())
              and status in ('published', 'rejected'));

-- 6.2 The entry: the first review and the decision
grant select (decided_at, sla_breached)
   on campaigns.campaign_review_entries to influx_campaign_review_definer;
grant update (state, first_reviewed_by_account_id, first_reviewed_at, first_review_opinion,
              decided_by_account_id, decided_at, rejection_reason_code, member_message,
              internal_comment, closed_at)
   on campaigns.campaign_review_entries to influx_campaign_review_definer;

-- 6.3 The snapshot: written by the publication; read by the trigger of the enhanced review
grant select (id, campaign_id, version, first_reviewed_by_account_id),
      insert (campaign_id, version, payload, content_hash, published_at, published_by_account_id,
              first_reviewed_by_account_id, review_entry_id)
   on campaigns.campaign_published_snapshots to influx_campaign_review_definer;

drop policy if exists campaign_published_snapshots_campaign_review_definer_select
  on campaigns.campaign_published_snapshots;
create policy campaign_published_snapshots_campaign_review_definer_select
  on campaigns.campaign_published_snapshots
  for select to influx_campaign_review_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.id = campaign_published_snapshots.campaign_id
                    and c.advertiser_account_id is distinct from (select influx.current_account_id())));
drop policy if exists campaign_published_snapshots_campaign_review_definer_insert
  on campaigns.campaign_published_snapshots;
create policy campaign_published_snapshots_campaign_review_definer_insert
  on campaigns.campaign_published_snapshots
  for insert to influx_campaign_review_definer
  with check (published_by_account_id = (select influx.current_account_id())
              and exists (select 1 from campaigns.campaigns c
                           where c.id = campaign_published_snapshots.campaign_id
                             and c.advertiser_account_id
                                   is distinct from (select influx.current_account_id())));

-- 6.4 The refusal reasons of RG90
grant select (code, requires_member_message, is_active)
   on campaigns.rejection_reasons to influx_campaign_review_definer;
drop policy if exists rejection_reasons_campaign_review_definer_select on campaigns.rejection_reasons;
create policy rejection_reasons_campaign_review_definer_select on campaigns.rejection_reasons
  for select to influx_campaign_review_definer
  using (true);

-- 6.5 The brand: its profile published (its account status is read through 0307's grant)
grant select (account_id, status) on profiles.advertiser_profiles to influx_campaign_review_definer;
drop policy if exists advertiser_profiles_campaign_review_definer_select
  on profiles.advertiser_profiles;
create policy advertiser_profiles_campaign_review_definer_select on profiles.advertiser_profiles
  for select to influx_campaign_review_definer
  using (account_id is distinct from (select influx.current_account_id()));

-- 6.6 RG15 read again at the publication (0307's rule, invoker): the cap
grant execute on function campaigns.assert_live_campaign_cap(uuid) to influx_campaign_review_definer;
drop policy if exists operational_settings_campaign_review_definer_select_cap
  on backoffice.operational_settings;
create policy operational_settings_campaign_review_definer_select_cap
  on backoffice.operational_settings
  for select to influx_campaign_review_definer
  using (key = 'campaign_live_cap');

-- 6.7 The creator view (0305, invoker): the snapshot is its output, read with the rights of 0307 §7.3
grant execute on function campaigns.campaign_creator_view(uuid) to influx_campaign_review_definer;

-- 6.8 The queue: the decision e-mail and the lead, in the transaction of the decision (05 RG73)
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_campaign_review_definer;
drop policy if exists outbox_events_campaign_review_definer_insert on leads.outbox_events;
create policy outbox_events_campaign_review_definer_insert on leads.outbox_events
  for insert to influx_campaign_review_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((event_type = 'campaign.decision' and destination = 'brevo_transactional')
                   or (event_type = 'campaign.published'
                       and destination in ('brevo_contact', 'apollo_contact'))));

-- 7. The functions, as influx_campaign_review_definer (03 P7 rule 5) --------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_review_definer', current_user);
end
$$;
grant create on schema campaigns to influx_campaign_review_definer;
set role influx_campaign_review_definer;

-- 7.1 The helper (SECURITY INVOKER: it runs with the rights of the decision that calls it) --------

-- A text of a decision: NULL when allowed, or p_min to p_max printable characters; 22023 p_code
create or replace function campaigns.check_campaign_review_text(
  p_value     text,
  p_min       integer,
  p_max       integer,
  p_required  boolean,
  p_code      text)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if (p_value is null and p_required)
     or (p_value is not null
         and (pg_catalog.char_length(p_value) not between p_min and p_max
              or p_value !~ '[^[:space:]]'
              or p_value ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]')) then
    raise exception '%', p_code using errcode = 'invalid_parameter_value', detail = p_code;
  end if;
end
$$;

comment on function campaigns.check_campaign_review_text(text, integer, integer, boolean, text) is
  'A text of a decision of queue 7 (0308): NULL when not required, or p_min to p_max printable '
  'characters; 22023 with MESSAGE and DETAIL p_code otherwise (opinion, member_message, '
  'internal_comment). SECURITY INVOKER owned by influx_campaign_review_definer, no EXECUTE.';

-- 7.2 Enhanced review, first examination (09 RG85, CA56; 17b §3.8 « Transmettre au 2e examinateur »)
create or replace function campaigns.first_review_campaign_entry(
  p_entry_id      uuid,
  p_review_token  text,
  p_opinion       text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid := campaigns.require_campaign_agent(false);
  v_entry      record;
  v_status     text;
  v_sensitive  boolean;
  v_first      uuid;
  v_at         timestamptz;
begin
  -- modele §3: a reasoned favourable opinion, 20 to 1 000 characters (an unfavourable one is a refusal)
  perform campaigns.check_campaign_review_text(p_opinion, 20, 1000, true, 'opinion');
  -- the entry locked, the caller's live claim; the first reviewer is refused there (42501)
  select * into v_entry from campaigns.lock_held_campaign_review_entry(p_entry_id, v_caller);

  select c.status::text, coalesce(s.is_sensitive, false)
    into v_status, v_sensitive
    from campaigns.campaigns c
    left join reference.sectors s on s.code = c.sector_code
   where c.id = v_entry.campaign_id
     for update of c;
  if v_status is distinct from 'pending_review' then
    raise exception 'campaign_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_state';
  end if;
  if p_review_token is null
     or p_review_token is distinct from campaigns.campaign_review_token(v_entry.campaign_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not v_sensitive then
    raise exception 'not_enhanced_review'
      using errcode = 'object_not_in_prerequisite_state', detail = 'not_enhanced_review';
  end if;
  select e.first_reviewed_by_account_id into v_first
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id;
  if v_first is not null then
    raise exception 'first_review_given'
      using errcode = 'object_not_in_prerequisite_state', detail = 'first_review_given';
  end if;

  -- the opinion kept, the claim given back (EC-L3C-03-3): the entry returns to queue 7, hidden from
  -- its first reviewer (policy of 0307, lock_held_campaign_review_entry)
  update campaigns.campaign_review_entries e
     set first_reviewed_by_account_id = v_caller,
         first_reviewed_at            = pg_catalog.now(),
         first_review_opinion         = p_opinion,
         claimed_by_account_id        = null,
         claimed_at                   = null,
         claim_expires_at             = null
   where e.id = p_entry_id;
  v_at := pg_catalog.now();

  -- the register, codes and ids only (never the opinion); last (04 §7.2)
  perform audit.append('campaign.first_reviewed', 'campaign', v_entry.campaign_id,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id));
  return v_at;
end
$$;

comment on function campaigns.first_review_campaign_entry(uuid, text, text) is
  '09 RG85, CA56; 17b §3.8; modele §3 (0308): the holder of a live claim gives the first examination '
  'of an enhanced review: a reasoned favourable opinion (20 to 1 000 characters, never sent nor '
  'registered), the claim given back, the entry hidden from him; campaign.first_reviewed {entry_id}. '
  'Returns the instant. 22023 opinion; 55000 campaign_state, stale_token, not_enhanced_review (a '
  'sector that is not sensitive), first_review_given; then the refusals of '
  'lock_held_campaign_review_entry(). SECURITY DEFINER; EXECUTE for influx_agent and influx_admin.';

-- 7.3 Publication (09 RG5, RG15, RG85, RG89, CA48, CA57, CA69; modele §4) ---------------------------
create or replace function campaigns.publish_campaign_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_owner_agent_id    uuid,
  p_internal_comment  text)
returns table (
  decided_at         timestamptz,
  sla_breached       boolean,
  snapshot_version   integer,
  first_publication  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller     uuid := campaigns.require_campaign_agent(false);
  v_entry      record;
  v_campaign   record;
  v_first      uuid;
  v_version    smallint;
  v_payload    jsonb;
  v_snapshot   uuid;
  v_decided    timestamptz;
  v_late       boolean;
  v_decision   uuid := pg_catalog.gen_random_uuid();
  v_lead       uuid := pg_catalog.gen_random_uuid();
begin
  perform campaigns.check_campaign_review_text(p_internal_comment, 1, 1000, false,
                                               'internal_comment');
  -- (1) the entry locked, the caller's live claim (fiche « Arrêt si »), neither his own account nor a
  -- held one, not the first reviewer (42501, T14)
  select * into v_entry from campaigns.lock_held_campaign_review_entry(p_entry_id, v_caller);

  -- (2) the campaign locked: the brand's writes are frozen meanwhile (0307)
  select c.status::text as status, c.applications_close_on, c.first_published_at,
         coalesce(s.is_sensitive, false) as sensitive
    into v_campaign
    from campaigns.campaigns c
    left join reference.sectors s on s.code = c.sector_code
   where c.id = v_entry.campaign_id
     for update of c;
  if v_campaign.status is distinct from 'pending_review' then
    raise exception 'campaign_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_state';
  end if;

  -- (3) the version examined (modele §1)
  if p_review_token is null
     or p_review_token is distinct from campaigns.campaign_review_token(v_entry.campaign_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;

  -- (4) RG85, CA57: a sensitive sector is published after a first examination, by another person,
  -- an admin included (EC-L3C-4); no degraded way (15 C8)
  select e.first_reviewed_by_account_id into v_first
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id;
  if v_campaign.sensitive and v_first is null then
    raise exception 'enhanced_review_required'
      using errcode = 'object_not_in_prerequisite_state', detail = 'enhanced_review_required';
  end if;

  -- (5) 17b §3.8: the responsible salesperson, an active internal account
  if p_owner_agent_id is null
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role::text in ('agent', 'admin')
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = p_owner_agent_id
             and a.status = 'active') then
    raise exception 'owner_agent' using errcode = 'invalid_parameter_value', detail = 'owner_agent';
  end if;

  -- (6) the brand: its profile published, its account active (17b §3.8 « marque suspendue »)
  if not exists (select 1
                   from identity.accounts a
                   join profiles.advertiser_profiles p on p.account_id = a.id
                  where a.id = v_entry.advertiser_account_id
                    and a.status = 'active'
                    and p.status = 'published') then
    raise exception 'brand_not_publishable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'brand_not_publishable';
  end if;

  -- (7) CA48: the application deadline not passed, in UTC days
  if v_campaign.applications_close_on < (pg_catalog.timezone('UTC', pg_catalog.now()))::date then
    raise exception 'calendar_passed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'calendar_passed';
  end if;

  -- (8) RG15 read again under the brand's advisory lock (0307): 55000 live_campaign_cap
  perform campaigns.assert_live_campaign_cap(v_entry.advertiser_account_id);

  -- (9) the snapshot, version n+1: the output of the creator view, nothing else (TM5.6, D78)
  v_payload := campaigns.campaign_creator_view(v_entry.campaign_id);
  select (coalesce(pg_catalog.max(p.version), 0) + 1)::smallint into v_version
    from campaigns.campaign_published_snapshots p
   where p.campaign_id = v_entry.campaign_id;
  insert into campaigns.campaign_published_snapshots
    (campaign_id, version, payload, content_hash, published_at, published_by_account_id,
     first_reviewed_by_account_id, review_entry_id)
  values (v_entry.campaign_id, v_version, v_payload,
          pg_catalog.sha256(pg_catalog.convert_to(v_payload::text, 'UTF8')), pg_catalog.now(),
          v_caller, v_first, p_entry_id)
  returning id into v_snapshot;

  -- (10) the state (the trigger of the enhanced review checks it again, 23514)
  update campaigns.campaigns c
     set status              = 'published',
         current_snapshot_id = v_snapshot,
         first_published_at  = coalesce(c.first_published_at, pg_catalog.now()),
         owner_agent_id      = p_owner_agent_id
   where c.id = v_entry.campaign_id;

  update campaigns.campaign_review_entries e
     set state = 'published', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- (11) 09 RG93: the decision e-mail, written by the worker; ids and its code only (modele §8)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'campaign.decision', 'brevo_transactional',
          'account:' || v_entry.advertiser_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision,
                                        'account_id', v_entry.advertiser_account_id,
                                        'campaign_id', v_entry.campaign_id,
                                        'email_code', 'published',
                                        'entry_id', p_entry_id),
          'campaign.decision:' || p_entry_id::text);
  -- 09 RG103, CA69: the first publication only, to Brevo and Apollo; ids only (05 RG74), the
  -- consent read again by the consumer (RG105)
  if v_campaign.first_published_at is null then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select v_lead, 'campaign.published', d.destination,
           'account:' || v_entry.advertiser_account_id::text, 100,
           pg_catalog.jsonb_build_object('event_id', v_lead,
                                         'account_id', v_entry.advertiser_account_id,
                                         'campaign_id', v_entry.campaign_id),
           'campaign.published:' || v_entry.campaign_id::text
      from (values ('brevo_contact'::leads.outbox_destination),
                   ('apollo_contact'::leads.outbox_destination)) d (destination);
  end if;

  -- (12) the register, nominative (the caller is the actor), codes and ids only (D60); last
  perform audit.append('campaign.published', 'campaign', v_entry.campaign_id,
                       pg_catalog.jsonb_build_object(
                         'entry_id', p_entry_id,
                         'snapshot_version', v_version,
                         'first_publication', v_campaign.first_published_at is null,
                         'owner_agent_id', p_owner_agent_id,
                         'enhanced_review', v_campaign.sensitive,
                         'first_reviewed_by_account_id', v_first,
                         'late', v_late));
  return query select v_decided, v_late, v_version::integer, v_campaign.first_published_at is null;
end
$$;

comment on function campaigns.publish_campaign_review_entry(uuid, text, uuid, text) is
  '09 RG5, RG15, RG85, RG89, RG93, RG103, CA48, CA57, CA69; 15 C6, C8; modele §2 to §4, §8 (0308): '
  'the holder of a live claim publishes an entry of queue 7. The entry then the campaign locked; the '
  'version token compared; a sensitive sector asks the first examination of another person '
  '(enhanced_review_required); the responsible salesperson an active internal account (22023 '
  'owner_agent); the brand profile published and its account active (brand_not_publishable); '
  'applications_close_on >= the UTC day (calendar_passed); RG15 read again (live_campaign_cap). In '
  'ONE transaction: snapshot n+1 = campaign_creator_view(), its SHA-256, publisher and first '
  'reviewer; the campaign published (current_snapshot_id, first_published_at once, owner_agent_id); '
  'the entry published (decider, instant, internal comment); campaign.decision to '
  'brevo_transactional (key campaign.decision:<entry>, payload {event_id, account_id, campaign_id, '
  'email_code published, entry_id}); at the first publication campaign.published to brevo_contact and '
  'apollo_contact (key campaign.published:<campaign>, ids only); the line campaign.published '
  '{entry_id, snapshot_version, first_publication, owner_agent_id, enhanced_review, '
  'first_reviewed_by_account_id, late}. Returns (decided_at, sla_breached, snapshot_version, '
  'first_publication). SECURITY DEFINER; EXECUTE for influx_agent and influx_admin.';

-- 7.4 Refusal (09 RG10, RG89, RG90, RG92, CA48, CA59) ------------------------------------------------
create or replace function campaigns.reject_campaign_review_entry(
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
  v_caller    uuid := campaigns.require_campaign_agent(false);
  v_requires  boolean;
  v_entry     record;
  v_status    text;
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
begin
  -- RG90: a typed reason of the closed list, never a refusal without one (RG89)
  select r.requires_member_message into v_requires
    from campaigns.rejection_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  -- RG90, modele §4: the message to the brand for illicit_content and other only, 20 to 500
  if v_requires then
    perform campaigns.check_campaign_review_text(p_member_message, 20, 500, true, 'member_message');
  elsif p_member_message is not null then
    raise exception 'member_message'
      using errcode = 'invalid_parameter_value', detail = 'member_message';
  end if;
  -- RG92: a comment in addition to a reason, never instead; never sent
  perform campaigns.check_campaign_review_text(p_internal_comment, 1, 1000, false,
                                               'internal_comment');

  select * into v_entry from campaigns.lock_held_campaign_review_entry(p_entry_id, v_caller);
  select c.status::text into v_status
    from campaigns.campaigns c
   where c.id = v_entry.campaign_id
     for update of c;
  if v_status is distinct from 'pending_review' then
    raise exception 'campaign_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_state';
  end if;
  if p_review_token is null
     or p_review_token is distinct from campaigns.campaign_review_token(v_entry.campaign_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;

  -- RG10, CA59: back to the brand, editable and submitted again (EC-L3C-03-2: no other control)
  update campaigns.campaigns c
     set status = 'rejected'
   where c.id = v_entry.campaign_id;

  update campaigns.campaign_review_entries e
     set state = 'rejected', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         rejection_reason_code = p_reason_code, member_message = p_member_message,
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'campaign.decision', 'brevo_transactional',
          'account:' || v_entry.advertiser_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision,
                                        'account_id', v_entry.advertiser_account_id,
                                        'campaign_id', v_entry.campaign_id,
                                        'email_code', 'rejected',
                                        'entry_id', p_entry_id),
          'campaign.decision:' || p_entry_id::text);

  perform audit.append('campaign.rejected', 'campaign', v_entry.campaign_id,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'reason_code', p_reason_code,
                                                     'late', v_late));
  return query select v_decided, v_late;
end
$$;

comment on function campaigns.reject_campaign_review_entry(uuid, text, text, text, text) is
  '09 RG10, RG89, RG90, RG92, RG93, CA48, CA59; 15 C6, C8; modele §4, §8 (0308): the holder of a live '
  'claim refuses an entry of queue 7 with a reason of campaigns.rejection_reasons; the message to the '
  'brand (20 to 500 characters) for a reason that requires it only (illicit_content, other); an '
  'internal comment of 1 000 characters at most, never sent nor registered. The entry then the '
  'campaign locked, the token compared (EC-L3C-03-2: no other control); in ONE transaction: the '
  'campaign rejected (RG10: editable, submitted again), the entry rejected, campaign.decision to '
  'brevo_transactional (email_code rejected), the line campaign.rejected {entry_id, reason_code, '
  'late}. Returns (decided_at, sla_breached). 22023 reason, member_message, internal_comment; 55000 '
  'campaign_state, stale_token; then the refusals of lock_held_campaign_review_entry(). SECURITY '
  'DEFINER; EXECUTE for influx_agent and influx_admin.';

do $$
declare
  f text;
begin
  foreach f in array array[
    'campaigns.check_campaign_review_text(text, integer, integer, boolean, text)',
    'campaigns.first_review_campaign_entry(uuid, text, text)',
    'campaigns.publish_campaign_review_entry(uuid, text, uuid, text)',
    'campaigns.reject_campaign_review_entry(uuid, text, text, text, text)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end
$$;

grant execute on function
  campaigns.first_review_campaign_entry(uuid, text, text),
  campaigns.publish_campaign_review_entry(uuid, text, uuid, text),
  campaigns.reject_campaign_review_entry(uuid, text, text, text, text)
  to influx_agent, influx_admin;

reset role;
revoke create on schema campaigns from influx_campaign_review_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_review_definer', current_user);
end
$$;

-- 8. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  v_def  record;
  v_bad  text;
begin
  -- the functions of 0308: their owner, their mode, empty search_path, EXECUTE for agent and admin
  -- (the helper: nobody)
  for v_def in
    select * from (values
      ('campaigns.first_review_campaign_entry(uuid, text, text)', true),
      ('campaigns.publish_campaign_review_entry(uuid, text, uuid, text)', true),
      ('campaigns.reject_campaign_review_entry(uuid, text, text, text, text)', true),
      ('campaigns.check_campaign_review_text(text, integer, integer, boolean, text)', false)
    ) as d (fn, definer)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> 'influx_campaign_review_definer'
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by influx_campaign_review_definer, SECURITY %, empty search_path',
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

  -- the two triggers: SECURITY INVOKER, empty search_path, executed by nobody
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('campaigns.assert_enhanced_review()'::regprocedure,
                   'campaigns.guard_campaign_snapshot_write()'::regprocedure)
     and (p.prosecdef or p.proconfig is distinct from array['search_path=""']
          or exists (select 1
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                                                           pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner));
  if v_bad is not null then
    raise exception 'triggers of 0308 with a wrong mode or grant: %', v_bad;
  end if;

  -- the creator view and the cap: executed by the brand / the door and by the owner of the decisions
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in ('campaigns.campaign_creator_view(uuid)'::regprocedure,
                   'campaigns.assert_live_campaign_cap(uuid)'::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (a.grantee = 'influx_campaign_review_definer'::regrole
              or (a.grantee = 'influx_advertiser'::regrole
                  and p.oid = 'campaigns.campaign_creator_view(uuid)'::regprocedure)
              or (a.grantee = 'influx_campaign_definer'::regrole
                  and p.oid = 'campaigns.assert_live_campaign_cap(uuid)'::regprocedure));
  if v_bad is not null then
    raise exception 'EXECUTE beyond their callers on the view or the cap: %', v_bad;
  end if;

  -- L2DS-5 extended (fiche invariant 10): no dynamic SQL in a function of a campaign owner
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner in ('influx_campaign_definer'::regrole,
                        'influx_campaign_review_definer'::regrole)
     and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic SQL in a function of a campaign owner: %', v_bad;
  end if;

  -- invariant 1 (RG5, CA5): only the owner of the decisions writes published; neither the brand,
  -- its door owner, agent, admin nor the creator writes the state or the snapshot
  select string_agg(r || ' ' || c, ', ') into v_bad
    from unnest(array['influx_advertiser', 'influx_campaign_definer', 'influx_agent',
                      'influx_admin', 'influx_creator']) r,
         unnest(array['status', 'current_snapshot_id', 'first_published_at', 'owner_agent_id']) c
   where pg_catalog.has_column_privilege(r, 'campaigns.campaigns', c, 'UPDATE')
     and not (r = 'influx_campaign_definer' and c = 'status');
  if v_bad is not null then
    raise exception 'a role beyond the decisions writes the publication of a campaign: %', v_bad;
  end if;
  select string_agg(r, ', ') into v_bad
    from pg_catalog.pg_roles ro, unnest(array[ro.rolname]) r
   where ro.rolname like 'influx\_%' and ro.rolname <> 'influx_campaign_review_definer'
     and (pg_catalog.has_table_privilege(ro.oid, 'campaigns.campaign_published_snapshots',
                                         'INSERT, UPDATE, DELETE')
          or pg_catalog.has_any_column_privilege(ro.oid, 'campaigns.campaign_published_snapshots',
                                                 'INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'a role beyond the decisions writes a snapshot: %', v_bad;
  end if;
  if pg_catalog.has_table_privilege('influx_campaign_review_definer',
                                    'campaigns.campaign_published_snapshots', 'UPDATE, DELETE')
     or pg_catalog.has_any_column_privilege('influx_campaign_review_definer',
                                            'campaigns.campaign_published_snapshots', 'UPDATE') then
    raise exception 'the owner of the decisions may change a snapshot (immutable, modele §2)';
  end if;

  -- D78 (fiche invariant 3, 12): nobody reads the suspended range; the creator holds nothing
  select string_agg(r, ', ') into v_bad
    from unnest(array['influx_agent', 'influx_admin', 'influx_campaign_review_definer',
                      'influx_advertiser', 'influx_creator']) r
   where pg_catalog.has_column_privilege(r, 'campaigns.campaigns', 'per_creator_amount_min_minor',
                                         'SELECT')
      or pg_catalog.has_column_privilege(r, 'campaigns.campaigns', 'per_creator_amount_max_minor',
                                         'SELECT');
  if v_bad is not null then
    raise exception 'the suspended range of D78 is readable by: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_creator', 'campaigns', 'USAGE')
     or pg_catalog.has_table_privilege('influx_creator', 'campaigns.campaign_published_snapshots',
                                       'SELECT') then
    raise exception 'influx_creator reaches the schema campaigns (TM5.6)';
  end if;

  -- fiche invariant 5: agent and admin still read neither the opinion nor the internal comment
  if exists (select 1 from unnest(array['influx_agent', 'influx_admin']) r,
                          unnest(array['first_review_opinion', 'internal_comment']) c
              where pg_catalog.has_column_privilege(r, 'campaigns.campaign_review_entries', c,
                                                    'SELECT')) then
    raise exception 'agent or admin reads the opinion or the internal comment of queue 7';
  end if;

  -- the new table: RLS enabled and forced, nothing to the Data API roles
  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'campaigns.campaign_published_snapshots'::regclass)
     or exists (select 1 from unnest(array['anon', 'authenticated', 'service_role']) r
                 where pg_catalog.has_table_privilege(r, 'campaigns.campaign_published_snapshots',
                                                      'SELECT, INSERT, UPDATE, DELETE')) then
    raise exception 'campaigns.campaign_published_snapshots is not protected';
  end if;

  -- the two codes, with their class
  if (select array_agg(code || '=' || export_class order by code) from audit.event_types
       where code in ('campaign.first_reviewed', 'campaign.decision'))
     is distinct from array['campaign.decision=exported',
                            'campaign.first_reviewed=excluded_third_party'] then
    raise exception 'the two codes of 0308 are not loaded with their export_class';
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = 'influx_campaign_review_definer'::regrole
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege('influx_campaign_review_definer', 'campaigns', 'CREATE') then
    raise exception 'influx_campaign_review_definer left with a member or CREATE on campaigns';
  end if;
end
$$;
