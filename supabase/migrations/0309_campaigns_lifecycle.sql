-- =============================================================================
-- 0309_campaigns_lifecycle
-- -----------------------------------------------------------------------------
-- Lot 3 / L3C, commit 04 (jalons/l3c/04.md; fiche invariants 1, 6, 7, 10, 11; jalons/l3c/modele.md §5,
-- §6, §8, which PREVAIL for every name; 09 RG1, RG8, RG9, RG93, RG94, CA8, CA9, CA60, CA61; 03 C(7)).
-- The life of a published campaign and the interventions of an agent: the brand pauses, resumes and
-- closes; an agent or an admin pauses with authority, resumes and closes, with a reason; the worker
-- closes at the end of the period + campaign_auto_close_days; an agent creates a draft for a brand
-- and corrects a field. No publication (0308), nothing of privacy.* (0310), no worker code (06), no
-- route. Signalled I-4 (04): SECURITY DEFINER functions, GRANTs, policies, audit codes.
--
-- 1. Codes: campaign.resumed, campaign.corrected, campaign.created_for_brand, campaign.record_read
--    (modele §8); ops.periodic_task + campaign_closure (daily, modele §5).
-- 2. campaigns.campaigns + paused_at, pause_origin (brand, influx), closed_at, stamped by the trigger
--    campaigns.stamp_campaign_cycle() (BEFORE INSERT OR UPDATE OF status, whoever writes; modele §5,
--    arbitration A): paused_at and the origin on entering paused (the origin is the writer's role),
--    emptied on leaving it, closed_at on entering closed; leaving closed refused to every influx_%
--    role (RG9). CHECK campaigns_cycle_stamped once the closed (erased) campaigns are taken back.
-- 3. campaigns.agent_interventions (modele §6): immutable, one line per act of an agent (created,
--    corrected, paused, resumed, closed), old and new value, typed reason, internal comment, agent.
-- 4. The freeze recreated (modele §7): the brand's door leaves draft and rejected for pending_review
--    only (a member door never writes published but by the resumption of a paused campaign).
-- 5. The brand (influx_campaign_definer, EXECUTE influx_advertiser): pause_own_campaign,
--    resume_own_campaign (pause_origin brand only), close_own_campaign -> (status, changed); no e-mail.
-- 6. INFLUX (influx_campaign_review_definer, EXECUTE agent and admin, aal2): pause_campaign,
--    resume_campaign, close_campaign -> (status, intervention_id), a held account admitted;
--    create_campaign_for_brand -> (campaign_id, intervention_id); correct_campaign_field ->
--    (intervention_id, review_token) in draft, rejected, or pending_review under the caller's live
--    claim without an opinion; open_campaign_record (campaign.record_read, then the agent reads). Each
--    intervention: its line, campaign.decision to brevo_transactional, its register line.
-- 7. The system (influx_maintenance_definer, EXECUTE influx_worker): ops.close_ended_campaigns(run,
--    attempt) -> integer, inside the open campaign_closure run of the attempt, 500 per call, UTC day
--    >= ends_on + campaign_auto_close_days; campaign.closed {origin system} without actor, e-mail
--    closed_automatically (key campaign.decision:<campaign>).
--
-- Refusals (the MESSAGE is the code, the DETAIL its precision): 42501 forbidden (an unknown campaign,
-- the caller's own account, the campaign of another brand, an unknown brand, outside an active agent or
-- admin in aal2: one answer, T14); 55000 campaign_not_pausable, campaign_not_resumable (DETAIL
-- paused_by_influx or the state), campaign_not_closable, campaign_not_correctable (DETAIL the state),
-- first_review_given, brand_not_active, campaign_closed (the trigger); 55P03 no_live_claim (a pending
-- campaign corrected without the live claim); 22023 reason, internal_comment, field_code, value,
-- unchanged, title, campaign_type.
--
-- EC-L3C-04 (micro-gaps, the safest choice):
--   EC-L3C-04-1  stamp_campaign_cycle() also fires BEFORE INSERT (modele §5 names an UPDATE trigger):
--                the tests insert a closed campaign directly; the CHECK would refuse it otherwise.
--   EC-L3C-04-2  pause_origin is derived from the writer's role by the trigger (influx_campaign_definer
--                brand, influx_campaign_review_definer influx, any other writer its own value or
--                influx): no function can forge it, and a fixture paused directly reads as INFLUX's.
--   EC-L3C-04-3  A brand's passage already done answers changed false (as the submission); an agent's
--                passage already done is refused (55000): an intervention is never written for nothing.
--   EC-L3C-04-4  A correction that changes nothing is refused (22023 unchanged): the brand is never
--                told of a correction that did not happen (RG94).
--   EC-L3C-04-5  A correction keeps the value as the field reads it (campaign_field_value()): currency
--                {currency, productValueBand, budgetBand} (the bands emptied with it), the territory
--                {scope, countries}, a list as an array, a scalar as itself, an empty field as null.
--   EC-L3C-04-6  The review token is returned for a pending_review campaign only (null otherwise): it is
--                the token the holder decides with.
--   EC-L3C-04-7  create_campaign_for_brand: an unknown or non advertiser account is 42501 (T14), an
--                advertiser account not active 55000 brand_not_active; the type an active one (22023).
--   EC-L3C-04-8  The other reason (modele §6) asks the comment in the functions only: the CHECK would
--                forbid the erasure (0310) to empty it.
--   EC-L3C-04-9  The correction of a pending campaign locks the entry, then the campaign (the order of
--                the decisions of 0308): never a deadlock with a publication.
--   EC-L3C-04-10 The brand reads paused_at, pause_origin and closed_at of its campaigns, agent and
--                admin too (the record, 17b §3.8; the brand's screen, L3C commit 10).
--
-- ROLLBACK (before any campaign is paused, closed or corrected through 0309): drop the functions of
-- sections 5 to 7 and their helpers; recreate campaigns.guard_campaign_member_write() as in 0307 and
-- the policies campaigns_campaign_definer_update (0305) and campaigns_campaign_review_definer_update
-- (0308); drop table campaigns.agent_interventions and function campaigns.guard_agent_intervention_write();
-- drop trigger campaigns_stamp_cycle and function campaigns.stamp_campaign_cycle(); alter table
-- campaigns.campaigns drop constraint campaigns_cycle_stamped, campaigns_pause_origin, drop columns
-- paused_at, pause_origin, closed_at; drop the policies *_maintenance_definer_*campaign*,
-- *_campaign_review_definer_* and *_campaign_definer_* created below and revoke their grants; delete
-- the four event types of section 1 (while no line references them). The value campaign_closure of
-- ops.periodic_task stays.
-- =============================================================================

-- 1. The codes of the register and the periodic task (modele §5, §8) --------------------------------

insert into audit.event_types (code, domain, subject_type, severity, export_class) values
  -- 09 RG8: the resumption of a paused campaign, by the brand or by INFLUX
  ('campaign.resumed',           'campaigns', 'campaign', 'info',      'exported'),
  -- 09 RG94, CA60: a field corrected by an agent (ids and codes only, the values in the line)
  ('campaign.corrected',         'campaigns', 'campaign', 'sensitive', 'exported'),
  -- 09 RG94, CA61: a draft created by an agent for a brand that called him
  ('campaign.created_for_brand', 'campaigns', 'campaign', 'sensitive', 'exported'),
  -- 15, 02 §5 rule 5: the privileged read of the record of a campaign
  ('campaign.record_read',       'campaigns', 'campaign', 'sensitive', 'exported')
on conflict (code) do nothing;

alter type ops.periodic_task add value if not exists 'campaign_closure';

comment on type ops.periodic_task is
  'E-4 tasks of maintenance.run_periodic (0117): brevo_reconciliation (daily), auth_orphan_purge '
  '(hourly), brevo_inbound_purge (daily), data_export_purge (hourly, 0136 and 0137), ops_retention '
  '(daily, 0147), storage_purge (hourly, 0205, 0223: the objects of Storage of the purging rows), '
  'verification_expiry (hourly, 0223: the draft requests whose code expired), badge_lifecycle '
  '(daily, 0230: the reminder, the expiry of the badges and the retention of their findings), '
  'campaign_closure (daily, 0309: the campaigns closed at the end of their period + '
  'campaign_auto_close_days, 09 RG9). A new task is a migration.';

-- 2. The cycle of a campaign, stamped by its trigger (modele §2, §5) -------------------------------

alter table campaigns.campaigns
  add column if not exists paused_at     timestamptz,
  add column if not exists pause_origin  text,
  add column if not exists closed_at     timestamptz;

alter table campaigns.campaigns drop constraint if exists campaigns_pause_origin;
alter table campaigns.campaigns
  add constraint campaigns_pause_origin check (pause_origin in ('brand', 'influx'));

-- the campaigns already closed (the erasure of 0306) or paused (none could be before 0308) take their
-- instant back before the CHECK (modele §5 « après reprise des closed effacées »)
update campaigns.campaigns
   set closed_at = coalesce(erased_at, updated_at)
 where status = 'closed' and closed_at is null;
update campaigns.campaigns
   set paused_at = updated_at, pause_origin = 'influx'
 where status = 'paused' and paused_at is null;

alter table campaigns.campaigns drop constraint if exists campaigns_cycle_stamped;
alter table campaigns.campaigns
  add constraint campaigns_cycle_stamped
  check ((status = 'paused') = (paused_at is not null)
         and (paused_at is null) = (pause_origin is null)
         and (status = 'closed') = (closed_at is not null));

comment on column campaigns.campaigns.paused_at is
  'Entry into the paused state (09 RG8, modele §5): written by campaigns.stamp_campaign_cycle(), '
  'emptied on leaving it. Nobody holds a right to write it.';
comment on column campaigns.campaigns.pause_origin is
  'Who paused (modele §5): brand (influx_campaign_definer) or influx (influx_campaign_review_definer), '
  'derived from the writer''s role by campaigns.stamp_campaign_cycle() (EC-L3C-04-2). The brand '
  'resumes a pause of its own only.';
comment on column campaigns.campaigns.closed_at is
  'Closure (09 RG9, irreversible): written by campaigns.stamp_campaign_cycle() on entering closed, '
  'whoever closes (the brand, INFLUX, the worker, the erasure). Nobody holds a right to write it.';

create or replace function campaigns.stamp_campaign_cycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 09 RG9: a closure is irreversible (a new campaign is duplicated, never reopened)
  if tg_op = 'UPDATE' and old.status = 'closed' and new.status <> 'closed'
     and current_user like 'influx\_%' then
    raise exception 'campaign_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_closed';
  end if;

  if new.status = 'paused' then
    if tg_op = 'INSERT' or old.status <> 'paused' then
      new.paused_at := pg_catalog.now();
      -- EC-L3C-04-2: the origin is the writer's, never a value a function chose
      new.pause_origin := case current_user
                            when 'influx_campaign_definer' then 'brand'
                            when 'influx_campaign_review_definer' then 'influx'
                            else coalesce(new.pause_origin, 'influx')
                          end;
    end if;
  else
    new.paused_at := null;
    new.pause_origin := null;
  end if;

  if new.status = 'closed' then
    if tg_op = 'INSERT' then
      new.closed_at := coalesce(new.closed_at, pg_catalog.now());
    elsif old.status <> 'closed' then
      new.closed_at := pg_catalog.now();
    end if;
  else
    new.closed_at := null;
  end if;
  return new;
end
$$;

comment on function campaigns.stamp_campaign_cycle() is
  'modele §5 (0309, EC-L3C-04-1, -2): BEFORE INSERT OR UPDATE OF status on campaigns.campaigns, '
  'whoever writes: paused_at and pause_origin (the writer''s role) on entering paused, emptied on '
  'leaving it; closed_at on entering closed; 55000 campaign_closed when an influx_% role leaves '
  'closed (RG9). SECURITY INVOKER, reads nothing, executed by nobody.';

revoke all on function campaigns.stamp_campaign_cycle()
  from public, anon, authenticated, service_role;

drop trigger if exists campaigns_stamp_cycle on campaigns.campaigns;
create trigger campaigns_stamp_cycle
  before insert or update of status on campaigns.campaigns
  for each row execute function campaigns.stamp_campaign_cycle();

-- the brand, agent and admin read the cycle (EC-L3C-04-10)
grant select (paused_at, pause_origin, closed_at)
   on campaigns.campaigns to influx_advertiser, influx_agent, influx_admin;

-- 3. campaigns.agent_interventions (modele §6; 09 RG94; 03 C(7)) ------------------------------------

create table if not exists campaigns.agent_interventions (
  id                     uuid        not null primary key default gen_random_uuid(),
  campaign_id            uuid        not null,
  advertiser_account_id  uuid        not null,
  kind                   text        not null,
  field_code             text,
  old_value              jsonb,
  new_value              jsonb,
  reason_code            text        not null,
  internal_comment       text,
  agent_account_id       uuid        not null,
  agent_is_internal      boolean     not null generated always as (true) stored,
  review_entry_id        uuid,
  created_at             timestamptz not null default now(),

  -- the campaign of ITS brand
  constraint agent_interventions_campaign_fk
    foreign key (campaign_id, advertiser_account_id)
    references campaigns.campaigns (id, advertiser_account_id),
  -- pattern 0008: the author is always an internal account (agent or admin)
  constraint agent_interventions_agent_is_internal_fk
    foreign key (agent_account_id, agent_is_internal)
    references identity.account_roles (account_id, is_internal),
  -- the entry of queue 7 under which a pending campaign was corrected
  constraint agent_interventions_entry_fk
    foreign key (review_entry_id, campaign_id)
    references campaigns.campaign_review_entries (id, campaign_id),
  constraint agent_interventions_kind
    check (kind in ('created', 'corrected', 'paused', 'resumed', 'closed')),
  constraint agent_interventions_reason
    check (reason_code in ('brand_request', 'entry_error', 'non_compliant_content', 'other')),
  -- modele -4: a creation answers the brand's request
  constraint agent_interventions_created_reason
    check (kind <> 'created' or reason_code = 'brand_request'),
  -- a correction names its field, nothing else does
  constraint agent_interventions_field_of_correction
    check ((kind = 'corrected') = (field_code is not null)),
  constraint agent_interventions_field_code
    check (field_code in (
      'title', 'campaign_type', 'public_summary', 'brief', 'internal_reference',
      'product_description', 'product_sector', 'restrictions', 'key_messages', 'product_is_sent',
      'product_value_band', 'creator_keeps_product', 'shipping_costs_borne_by', 'deliverables',
      'usage_rights', 'usage_rights_duration', 'usage_rights_territory', 'exclusivity',
      'content_review_delay', 'audience_countries', 'audience_languages', 'audience_bands',
      'audience_age_bands', 'audience_gender', 'audience_topics', 'currency', 'remuneration_kind',
      'budget_band', 'creators_wanted', 'total_budget', 'applications_close_on', 'content_due_on',
      'starts_on', 'ends_on', 'max_applications', 'requested_items')),
  -- a passage carries no value; a value is bounded as the snapshot is
  constraint agent_interventions_no_value_for_passages
    check (kind not in ('paused', 'resumed', 'closed') or num_nonnulls(old_value, new_value) = 0),
  constraint agent_interventions_values_size
    check (coalesce(pg_column_size(old_value), 0) + coalesce(pg_column_size(new_value), 0) <= 32000),
  constraint agent_interventions_comment_length
    check (char_length(internal_comment) between 1 and 1000),
  constraint agent_interventions_entry_of_correction
    check (review_entry_id is null or kind = 'corrected')
);

create index if not exists agent_interventions_campaign_idx
  on campaigns.agent_interventions (campaign_id, created_at);
create index if not exists agent_interventions_advertiser_idx
  on campaigns.agent_interventions (advertiser_account_id);

comment on table campaigns.agent_interventions is
  '09 RG94, 03 C(7), modele §6 (0309): one line per act of an agent on a campaign (created, '
  'corrected, paused, resumed, closed): the old and the new value of a corrected field, the typed '
  'reason, the internal comment (never served, never registered), the author (an internal account, '
  'pattern 0008). Immutable outside the erasure (0310). Written by the functions of '
  'influx_campaign_review_definer only; agent and admin read it in aal2 without the comment.';
comment on column campaigns.agent_interventions.old_value is
  'The field as campaign_field_value() reads it before the correction (EC-L3C-04-5): a scalar, a '
  'list as an array, the territory {scope, countries}, the currency {currency, productValueBand, '
  'budgetBand}; JSON null for an empty field.';
comment on column campaigns.agent_interventions.internal_comment is
  'Internal comment of the agent (1 to 1 000 characters; required for the reason other, in the '
  'functions, EC-L3C-04-8): never to the brand, Brevo, the register nor the export.';

-- 3.1 Immutable outside the erasure (the pattern of the snapshots, 0308)
create or replace function campaigns.guard_agent_intervention_write()
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
  raise exception 'intervention_immutable'
    using errcode = 'object_not_in_prerequisite_state', detail = 'intervention_immutable';
end
$$;

comment on function campaigns.guard_agent_intervention_write() is
  'modele §6 (0309): BEFORE UPDATE OR DELETE on campaigns.agent_interventions; 55000 '
  'intervention_immutable for every influx_% role but influx_privacy_definer (the erasure, 0310). '
  'SECURITY INVOKER, reads nothing.';

revoke all on function campaigns.guard_agent_intervention_write()
  from public, anon, authenticated, service_role;

drop trigger if exists agent_interventions_immutable on campaigns.agent_interventions;
create trigger agent_interventions_immutable
  before update or delete on campaigns.agent_interventions
  for each row execute function campaigns.guard_agent_intervention_write();

-- 3.2 Row level security: agent and admin (aal2) read every line but the comment, never of their own
-- account (modele §9); the brand learns of an intervention by its e-mail (RG93), its export in 0310
alter table campaigns.agent_interventions enable row level security;
alter table campaigns.agent_interventions force row level security;
revoke all on campaigns.agent_interventions
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;

grant select (id, campaign_id, advertiser_account_id, kind, field_code, old_value, new_value,
              reason_code, agent_account_id, agent_is_internal, review_entry_id, created_at)
   on campaigns.agent_interventions to influx_agent, influx_admin;

drop policy if exists agent_interventions_internal_select on campaigns.agent_interventions;
create policy agent_interventions_internal_select on campaigns.agent_interventions
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and advertiser_account_id is distinct from (select influx.current_account_id()));

-- 4. The freeze, recreated from 0307 (modele §7; L3BS-2) ---------------------------------------------
-- One change: the brand's door leaves draft and rejected for pending_review only (the submission);
-- every other line as in 0307.

create or replace function campaigns.guard_campaign_member_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role      text := current_user;
  v_campaign  uuid;
  v_status    text;
  v_next      text;
  v_allowed   boolean;
begin
  -- free: the erasure (0306) and the migration role (every role outside influx_%)
  if v_role = 'influx_privacy_definer' or v_role not like 'influx\_%' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_table_name = 'campaigns' then
    -- a BEFORE ROW trigger sees the latest version of the row it updates: its FORMER state
    v_status := old.status::text;
    v_next   := new.status::text;
  else
    if tg_op = 'DELETE' then
      v_campaign := old.campaign_id;
    else
      v_campaign := new.campaign_id;
    end if;
    -- FOR SHARE: a decision waits for this write, or this write waits for the decision. No row
    -- (a campaign not seen): the policy of the table refuses it.
    select c.status::text into v_status
      from campaigns.campaigns c
     where c.id = v_campaign
       for share of c;
    v_next := v_status;  -- a list row moves no state
  end if;

  if v_status is null and v_role in ('influx_advertiser', 'influx_campaign_definer',
                                     'influx_campaign_review_definer') then
    v_allowed := true;  -- the policy decides (0303)
  else
    v_allowed := case v_role
      -- the brand writes its draft or its rejected campaign (RG7, Q1)
      when 'influx_advertiser' then
        v_status in ('draft', 'rejected')
      -- the brand's doors: the submission (0305) and the brand's passages (0309); from draft or
      -- rejected, pending_review only (a member door never writes published but by a resumption)
      when 'influx_campaign_definer' then
        (v_status in ('draft', 'rejected') and v_next in (v_status, 'pending_review'))
        or (tg_table_name = 'campaigns'
            and ((v_status, v_next) in (('published', 'paused'), ('paused', 'published'),
                                        ('published', 'closed'), ('paused', 'closed'))))
      -- INFLUX: the decisions (0308), the agent's passages and corrections (0309)
      when 'influx_campaign_review_definer' then
        (v_next = v_status and v_status in ('draft', 'rejected', 'pending_review'))
        or (tg_table_name = 'campaigns'
            and ((v_status, v_next) in (('pending_review', 'published'),
                                        ('pending_review', 'rejected'),
                                        ('published', 'paused'), ('paused', 'published'),
                                        ('published', 'closed'), ('paused', 'closed'))))
      -- the automatic closure (RG9, 0309)
      when 'influx_maintenance_definer' then
        tg_table_name = 'campaigns' and v_next = 'closed' and v_status in ('published', 'paused')
      else false
    end;
  end if;

  if not coalesce(v_allowed, false) then
    raise exception 'campaign_not_editable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_not_editable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

comment on function campaigns.guard_campaign_member_write() is
  'modele §7, L3BS-2 (0307, recreated by 0309): BEFORE trigger on a campaign and its nine lists, a '
  'CLOSED list of roles: influx_advertiser (draft, rejected), influx_campaign_definer (the same, '
  'leaving them for pending_review only, and the brand''s passages), influx_campaign_review_definer '
  '(the agent''s passages; a write in draft, rejected, pending_review), influx_maintenance_definer '
  '(-> closed); influx_privacy_definer and the migration role free; anything else 55000 '
  'campaign_not_editable. SECURITY INVOKER.';

revoke all on function campaigns.guard_campaign_member_write()
  from public, anon, authenticated, service_role;

-- 5. The brand's passages (modele §5), as influx_campaign_definer ------------------------------------

-- 5.1 Its rights: the origin of a pause read; the state written, its policy recreated (0305 admitted
-- pending_review only)
grant select (pause_origin) on campaigns.campaigns to influx_campaign_definer;

drop policy if exists campaigns_campaign_definer_update on campaigns.campaigns;
create policy campaigns_campaign_definer_update on campaigns.campaigns
  for update to influx_campaign_definer
  using (advertiser_account_id = (select influx.current_account_id()))
  with check (advertiser_account_id = (select influx.current_account_id())
              and status in ('pending_review', 'published', 'paused', 'closed'));

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_definer', current_user);
end
$$;
grant create on schema campaigns to influx_campaign_definer;
set role influx_campaign_definer;

-- 5.2 The helper (SECURITY INVOKER, no EXECUTE): the caller's own campaign, locked
create or replace function campaigns.lock_own_campaign(p_campaign_id uuid)
returns table (
  status        text,
  pause_origin  text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- the account comes from the transaction context (03 P2), never a parameter
  v_account  uuid := influx.current_account_id();
  v_row      record;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'
     or not exists (select 1 from identity.accounts a
                     where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select c.status::text as status, c.pause_origin
    into v_row
    from campaigns.campaigns c
   where c.id = p_campaign_id and c.advertiser_account_id = v_account
     for update of c;
  -- unknown or another brand's: one answer (T14)
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query select v_row.status, v_row.pause_origin;
end
$$;

comment on function campaigns.lock_own_campaign(uuid) is
  'The gate of the brand''s passages (0309): an active advertiser of the context, his own campaign '
  'FOR UPDATE; 42501 forbidden otherwise (T14). SECURITY INVOKER owned by influx_campaign_definer, '
  'no EXECUTE.';

-- 5.3 Pause (09 RG8, CA8): published -> paused
create or replace function campaigns.pause_own_campaign(p_campaign_id uuid)
returns table (
  status   text,
  changed  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row  record;
begin
  select * into v_row from campaigns.lock_own_campaign(p_campaign_id);
  if v_row.status = 'paused' then
    return query select 'paused'::text, false;
    return;
  end if;
  if v_row.status <> 'published' then
    raise exception 'campaign_not_pausable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_row.status;
  end if;
  update campaigns.campaigns c set status = 'paused' where c.id = p_campaign_id;
  perform audit.append('campaign.paused', 'campaign', p_campaign_id,
                       pg_catalog.jsonb_build_object('origin', 'brand'));
  return query select 'paused'::text, true;
end
$$;

comment on function campaigns.pause_own_campaign(uuid) is
  '09 RG8, CA8; modele §5 (0309): the brand pauses its published campaign (paused_at and pause_origin '
  'brand by the trigger); already paused: nothing written, changed false (EC-L3C-04-3). 42501 '
  'forbidden; 55000 campaign_not_pausable (DETAIL the state). campaign.paused {origin brand}; no '
  'e-mail. SECURITY DEFINER owned by influx_campaign_definer; EXECUTE for influx_advertiser only.';

-- 5.4 Resumption (09 RG8): paused -> published, a pause of its own only; not a publication (RG5,
-- modele §5 « Reprise et invariant 1 »): the campaign keeps its snapshot
create or replace function campaigns.resume_own_campaign(p_campaign_id uuid)
returns table (
  status   text,
  changed  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row  record;
begin
  select * into v_row from campaigns.lock_own_campaign(p_campaign_id);
  if v_row.status = 'published' then
    return query select 'published'::text, false;
    return;
  end if;
  if v_row.status <> 'paused' then
    raise exception 'campaign_not_resumable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_row.status;
  end if;
  if v_row.pause_origin is distinct from 'brand' then
    raise exception 'campaign_not_resumable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'paused_by_influx';
  end if;
  update campaigns.campaigns c set status = 'published' where c.id = p_campaign_id;
  perform audit.append('campaign.resumed', 'campaign', p_campaign_id,
                       pg_catalog.jsonb_build_object('origin', 'brand'));
  return query select 'published'::text, true;
end
$$;

comment on function campaigns.resume_own_campaign(uuid) is
  '09 RG8; modele §5 (0309): the brand resumes a campaign IT paused (pause_origin brand); the '
  'snapshot is kept, no validation again (RG8), not a publication (RG5). Already published: nothing '
  'written, changed false. 42501 forbidden; 55000 campaign_not_resumable (DETAIL paused_by_influx, '
  'or the state). campaign.resumed {origin brand}; no e-mail. SECURITY DEFINER owned by '
  'influx_campaign_definer; EXECUTE for influx_advertiser only.';

-- 5.5 Closure (09 RG9, CA9): published or paused -> closed, irreversible
create or replace function campaigns.close_own_campaign(p_campaign_id uuid)
returns table (
  status   text,
  changed  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row  record;
begin
  select * into v_row from campaigns.lock_own_campaign(p_campaign_id);
  if v_row.status = 'closed' then
    return query select 'closed'::text, false;
    return;
  end if;
  if v_row.status not in ('published', 'paused') then
    raise exception 'campaign_not_closable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_row.status;
  end if;
  update campaigns.campaigns c set status = 'closed' where c.id = p_campaign_id;
  perform audit.append('campaign.closed', 'campaign', p_campaign_id,
                       pg_catalog.jsonb_build_object('origin', 'brand'));
  return query select 'closed'::text, true;
end
$$;

comment on function campaigns.close_own_campaign(uuid) is
  '09 RG9, CA9; modele §5 (0309): the brand closes its published or paused campaign, irreversibly, '
  'nothing erased (closed_at by the trigger). Already closed: nothing written, changed false. 42501 '
  'forbidden; 55000 campaign_not_closable (DETAIL the state). campaign.closed {origin brand}; no '
  'e-mail. SECURITY DEFINER owned by influx_campaign_definer; EXECUTE for influx_advertiser only.';

do $$
declare
  f text;
begin
  foreach f in array array[
    'campaigns.lock_own_campaign(uuid)',
    'campaigns.pause_own_campaign(uuid)',
    'campaigns.resume_own_campaign(uuid)',
    'campaigns.close_own_campaign(uuid)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end
$$;

grant execute on function
  campaigns.pause_own_campaign(uuid),
  campaigns.resume_own_campaign(uuid),
  campaigns.close_own_campaign(uuid)
  to influx_advertiser;

reset role;
revoke create on schema campaigns from influx_campaign_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_definer', current_user);
end
$$;

-- 6. INFLUX's interventions (modele §5, §6), as influx_campaign_review_definer -----------------------

-- 6.1 The campaign: the entry columns written (a correction), a draft inserted (a creation); the
-- update policy recreated: the passages are the freeze's closed list (0308 admitted published and
-- rejected only, EC-L3C-03-6)
grant update (title, campaign_type_code, public_summary, brief, internal_reference,
              product_description, sector_code, restrictions, product_is_sent,
              product_value_band_code, creator_keeps_product, shipping_costs_borne_by,
              usage_rights_code, usage_rights_duration_band, usage_rights_territory_scope,
              exclusivity_band, content_review_delay, audience_gender_code, currency,
              remuneration_kind, per_creator_budget_band_code, creators_wanted, total_budget_minor,
              applications_close_on, content_due_on, starts_on, ends_on, max_applications)
   on campaigns.campaigns to influx_campaign_review_definer;
grant insert (advertiser_account_id, title, campaign_type_code)
   on campaigns.campaigns to influx_campaign_review_definer;

drop policy if exists campaigns_campaign_review_definer_update on campaigns.campaigns;
create policy campaigns_campaign_review_definer_update on campaigns.campaigns
  for update to influx_campaign_review_definer
  using (advertiser_account_id is distinct from (select influx.current_account_id()))
  with check (advertiser_account_id is distinct from (select influx.current_account_id()));

drop policy if exists campaigns_campaign_review_definer_insert on campaigns.campaigns;
create policy campaigns_campaign_review_definer_insert on campaigns.campaigns
  for insert to influx_campaign_review_definer
  with check (status = 'draft'
              and advertiser_account_id is distinct from (select influx.current_account_id()));

-- 6.2 The nine lists: replaced in a block by a correction (their columns are read since 0307)
do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('campaign_key_messages',       'campaign_id, position, body'),
      ('campaign_deliverables',       'campaign_id, slot, network_code, format_code, quantity'),
      ('campaign_usage_territories',  'campaign_id, slot, country_code'),
      ('campaign_audience_countries', 'campaign_id, slot, country_code'),
      ('campaign_audience_languages', 'campaign_id, language_code'),
      ('campaign_audience_bands',     'campaign_id, audience_band_code'),
      ('campaign_audience_age_bands', 'campaign_id, age_band_code'),
      ('campaign_topics',             'campaign_id, slot, topic_code'),
      ('campaign_requested_items',    'campaign_id, slot, item_code')
    ) as v (name, columns)
  loop
    execute format('grant insert (%s), delete on campaigns.%I to influx_campaign_review_definer',
                   l.columns, l.name);
    execute format('drop policy if exists %I on campaigns.%I',
                   l.name || '_campaign_review_definer_insert', l.name);
    execute format('create policy %I on campaigns.%I for insert to influx_campaign_review_definer '
                   'with check (exists (select 1 from campaigns.campaigns c '
                   'where c.id = %I.campaign_id '
                   'and c.advertiser_account_id is distinct from (select influx.current_account_id())))',
                   l.name || '_campaign_review_definer_insert', l.name, l.name);
    execute format('drop policy if exists %I on campaigns.%I',
                   l.name || '_campaign_review_definer_delete', l.name);
    execute format('create policy %I on campaigns.%I for delete to influx_campaign_review_definer '
                   'using (exists (select 1 from campaigns.campaigns c '
                   'where c.id = %I.campaign_id '
                   'and c.advertiser_account_id is distinct from (select influx.current_account_id())))',
                   l.name || '_campaign_review_definer_delete', l.name, l.name);
  end loop;
end
$$;

-- 6.3 What the triggers of the lists read (invoker) and the type of a creation
grant select (code, network_code) on reference.formats to influx_campaign_review_definer;
drop policy if exists formats_campaign_review_definer_select on reference.formats;
create policy formats_campaign_review_definer_select on reference.formats
  for select to influx_campaign_review_definer
  using (true);

grant select (code, is_active) on campaigns.requested_items to influx_campaign_review_definer;
drop policy if exists requested_items_campaign_review_definer_select on campaigns.requested_items;
create policy requested_items_campaign_review_definer_select on campaigns.requested_items
  for select to influx_campaign_review_definer
  using (true);

grant select (code, retired_at) on reference.campaign_types to influx_campaign_review_definer;
drop policy if exists campaign_types_campaign_review_definer_select on reference.campaign_types;
create policy campaign_types_campaign_review_definer_select on reference.campaign_types
  for select to influx_campaign_review_definer
  using (true);

-- 6.4 The interventions: inserted by their author, read back for the id
grant select (id),
      insert (campaign_id, advertiser_account_id, kind, field_code, old_value, new_value,
              reason_code, internal_comment, agent_account_id, review_entry_id)
   on campaigns.agent_interventions to influx_campaign_review_definer;

drop policy if exists agent_interventions_campaign_review_definer_select
  on campaigns.agent_interventions;
create policy agent_interventions_campaign_review_definer_select on campaigns.agent_interventions
  for select to influx_campaign_review_definer
  using (advertiser_account_id is distinct from (select influx.current_account_id()));
drop policy if exists agent_interventions_campaign_review_definer_insert
  on campaigns.agent_interventions;
create policy agent_interventions_campaign_review_definer_insert on campaigns.agent_interventions
  for insert to influx_campaign_review_definer
  with check (agent_account_id = (select influx.current_account_id())
              and advertiser_account_id is distinct from (select influx.current_account_id()));

-- (the decision e-mail campaign.decision is admitted by the queue policy of 0308 §6.8)

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_review_definer', current_user);
end
$$;
grant create on schema campaigns to influx_campaign_review_definer;
set role influx_campaign_review_definer;

-- 6.5 The helpers (SECURITY INVOKER: they run with the rights of the function that calls them) ------

-- The reason and the comment of an intervention (modele §6): the closed list; other asks a comment
create or replace function campaigns.check_intervention_reason(p_reason_code text, p_comment text)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_reason_code is null
     or p_reason_code not in ('brand_request', 'entry_error', 'non_compliant_content', 'other') then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  perform campaigns.check_campaign_review_text(p_comment, 1, 1000, p_reason_code = 'other',
                                               'internal_comment');
end
$$;

comment on function campaigns.check_intervention_reason(text, text) is
  'modele §6 (0309): the reason of an intervention, brand_request, entry_error, '
  'non_compliant_content, other (22023 reason); the internal comment 1 to 1 000 printable '
  'characters, required for other (22023 internal_comment). SECURITY INVOKER owned by '
  'influx_campaign_review_definer, no EXECUTE.';

-- A campaign of another account than the caller's, locked (unknown or own: 42501, T14)
create or replace function campaigns.lock_campaign_for_agent(p_campaign_id uuid, p_caller uuid)
returns table (
  status                 text,
  advertiser_account_id  uuid
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_row  record;
begin
  select c.status::text as status, c.advertiser_account_id
    into v_row
    from campaigns.campaigns c
   where c.id = p_campaign_id
     and c.advertiser_account_id is distinct from p_caller
     for update of c;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query select v_row.status, v_row.advertiser_account_id;
end
$$;

comment on function campaigns.lock_campaign_for_agent(uuid, uuid) is
  'The gate of the agent''s passages (0309): the campaign FOR UPDATE, never of the caller''s own '
  'account (a held account admitted, modele §5); 42501 forbidden otherwise (T14). SECURITY INVOKER '
  'owned by influx_campaign_review_definer, no EXECUTE.';

-- What one intervention writes besides the campaign: its line, the e-mail of RG93, its register line
create or replace function campaigns.record_campaign_intervention(
  p_campaign_id      uuid,
  p_advertiser_id    uuid,
  p_kind             text,
  p_field_code       text,
  p_old_value        jsonb,
  p_new_value        jsonb,
  p_reason_code      text,
  p_internal_comment text,
  p_review_entry_id  uuid,
  p_email_code       text,
  p_event_type       text,
  p_register         jsonb)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_id     uuid;
  v_event  uuid := pg_catalog.gen_random_uuid();
begin
  insert into campaigns.agent_interventions
    (campaign_id, advertiser_account_id, kind, field_code, old_value, new_value, reason_code,
     internal_comment, agent_account_id, review_entry_id)
  values (p_campaign_id, p_advertiser_id, p_kind, p_field_code, p_old_value, p_new_value,
          p_reason_code, p_internal_comment, influx.current_account_id(), p_review_entry_id)
  returning id into v_id;

  -- 09 RG93, RG94: the brand is told, in its language, by the worker; ids and its code only (modele §8)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'campaign.decision', 'brevo_transactional',
          'account:' || p_advertiser_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event,
                                        'account_id', p_advertiser_id,
                                        'campaign_id', p_campaign_id,
                                        'email_code', p_email_code,
                                        'intervention_id', v_id),
          'campaign.decision:' || v_id::text);

  -- the register, nominative (the caller is the actor), codes and ids only (D81 (4)); last
  perform audit.append(p_event_type, 'campaign', p_campaign_id,
                       pg_catalog.jsonb_build_object('intervention_id', v_id,
                                                     'reason_code', p_reason_code)
                       || coalesce(p_register, '{}'::jsonb));
  return v_id;
end
$$;

comment on function campaigns.record_campaign_intervention(uuid, uuid, text, text, jsonb, jsonb, text,
                                                          text, uuid, text, text, jsonb) is
  '09 RG93, RG94; modele §6, §8 (0309): the line of campaigns.agent_interventions (the caller its '
  'author), campaign.decision to brevo_transactional (key campaign.decision:<intervention>, payload '
  '{event_id, account_id, campaign_id, email_code, intervention_id}), the register line p_event_type '
  '{intervention_id, reason_code} || p_register. Returns the intervention. SECURITY INVOKER owned by '
  'influx_campaign_review_definer, no EXECUTE.';

-- A field of a campaign as a correction keeps it (EC-L3C-04-5). STABLE: it reads the snapshot of the
-- statement that calls it, so a call after the write reads the new value.
create or replace function campaigns.campaign_field_value(p_campaign_id uuid, p_field_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case p_field_code
    when 'title'                   then coalesce(pg_catalog.to_jsonb(c.title), 'null')
    when 'campaign_type'           then coalesce(pg_catalog.to_jsonb(c.campaign_type_code), 'null')
    when 'public_summary'          then coalesce(pg_catalog.to_jsonb(c.public_summary), 'null')
    when 'brief'                   then coalesce(pg_catalog.to_jsonb(c.brief), 'null')
    when 'internal_reference'      then coalesce(pg_catalog.to_jsonb(c.internal_reference), 'null')
    when 'product_description'     then coalesce(pg_catalog.to_jsonb(c.product_description), 'null')
    when 'product_sector'          then coalesce(pg_catalog.to_jsonb(c.sector_code), 'null')
    when 'restrictions'            then coalesce(pg_catalog.to_jsonb(c.restrictions), 'null')
    when 'product_is_sent'         then coalesce(pg_catalog.to_jsonb(c.product_is_sent), 'null')
    when 'product_value_band'      then coalesce(pg_catalog.to_jsonb(c.product_value_band_code), 'null')
    when 'creator_keeps_product'   then coalesce(pg_catalog.to_jsonb(c.creator_keeps_product), 'null')
    when 'shipping_costs_borne_by' then coalesce(pg_catalog.to_jsonb(c.shipping_costs_borne_by), 'null')
    when 'usage_rights'            then coalesce(pg_catalog.to_jsonb(c.usage_rights_code), 'null')
    when 'usage_rights_duration'   then coalesce(pg_catalog.to_jsonb(c.usage_rights_duration_band),
                                                 'null')
    when 'exclusivity'             then coalesce(pg_catalog.to_jsonb(c.exclusivity_band), 'null')
    when 'content_review_delay'    then coalesce(pg_catalog.to_jsonb(c.content_review_delay), 'null')
    when 'audience_gender'         then coalesce(pg_catalog.to_jsonb(c.audience_gender_code), 'null')
    when 'remuneration_kind'       then coalesce(pg_catalog.to_jsonb(c.remuneration_kind), 'null')
    when 'budget_band'             then coalesce(pg_catalog.to_jsonb(c.per_creator_budget_band_code),
                                                 'null')
    when 'creators_wanted'         then coalesce(pg_catalog.to_jsonb(c.creators_wanted), 'null')
    when 'total_budget'            then coalesce(pg_catalog.to_jsonb(c.total_budget_minor), 'null')
    when 'max_applications'        then coalesce(pg_catalog.to_jsonb(c.max_applications), 'null')
    when 'applications_close_on'   then coalesce(pg_catalog.to_jsonb(c.applications_close_on), 'null')
    when 'content_due_on'          then coalesce(pg_catalog.to_jsonb(c.content_due_on), 'null')
    when 'starts_on'               then coalesce(pg_catalog.to_jsonb(c.starts_on), 'null')
    when 'ends_on'                 then coalesce(pg_catalog.to_jsonb(c.ends_on), 'null')
    when 'currency' then pg_catalog.jsonb_build_object(
                           'currency', c.currency,
                           'productValueBand', c.product_value_band_code,
                           'budgetBand', c.per_creator_budget_band_code)
    when 'usage_rights_territory' then pg_catalog.jsonb_build_object(
                           'scope', c.usage_rights_territory_scope,
                           'countries', coalesce((select pg_catalog.jsonb_agg(u.country_code
                                                                              order by u.slot)
                                                    from campaigns.campaign_usage_territories u
                                                   where u.campaign_id = c.id), '[]'))
    when 'key_messages' then coalesce((select pg_catalog.jsonb_agg(m.body order by m.position)
                                         from campaigns.campaign_key_messages m
                                        where m.campaign_id = c.id), '[]')
    when 'deliverables' then coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                                'networkCode', d.network_code,
                                                'formatCode', d.format_code,
                                                'quantity', d.quantity) order by d.slot)
                                         from campaigns.campaign_deliverables d
                                        where d.campaign_id = c.id), '[]')
    when 'audience_countries' then coalesce((select pg_catalog.jsonb_agg(a.country_code
                                                                         order by a.slot)
                                               from campaigns.campaign_audience_countries a
                                              where a.campaign_id = c.id), '[]')
    when 'audience_languages' then coalesce((select pg_catalog.jsonb_agg(l.language_code
                                                                         order by l.language_code)
                                               from campaigns.campaign_audience_languages l
                                              where l.campaign_id = c.id), '[]')
    when 'audience_bands' then coalesce((select pg_catalog.jsonb_agg(b.audience_band_code
                                                                     order by b.audience_band_code)
                                           from campaigns.campaign_audience_bands b
                                          where b.campaign_id = c.id), '[]')
    when 'audience_age_bands' then coalesce((select pg_catalog.jsonb_agg(g.age_band_code
                                                                         order by g.age_band_code)
                                               from campaigns.campaign_audience_age_bands g
                                              where g.campaign_id = c.id), '[]')
    when 'audience_topics' then coalesce((select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                                            from campaigns.campaign_topics t
                                           where t.campaign_id = c.id), '[]')
    when 'requested_items' then coalesce((select pg_catalog.jsonb_agg(r.item_code order by r.slot)
                                            from campaigns.campaign_requested_items r
                                           where r.campaign_id = c.id), '[]')
  end
    from campaigns.campaigns c
   where c.id = p_campaign_id
$$;

comment on function campaigns.campaign_field_value(uuid, text) is
  'modele §6 (0309, EC-L3C-04-5): the field p_field_code of a campaign as a correction keeps it '
  '(old and new value): a scalar, a list as an array in its rank, usage_rights_territory {scope, '
  'countries}, currency {currency, productValueBand, budgetBand}; JSON null for an empty field. '
  'SECURITY INVOKER owned by influx_campaign_review_definer, no EXECUTE.';

-- A JSON array of strings (a list of codes), or 22023 value; NULL and JSON null are the empty list
create or replace function campaigns.json_code_list(p_value jsonb)
returns text[]
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  if p_value is null or pg_catalog.jsonb_typeof(p_value) = 'null' then
    return array[]::text[];
  end if;
  if pg_catalog.jsonb_typeof(p_value) <> 'array'
     or pg_catalog.jsonb_array_length(p_value) > 50
     or exists (select 1 from pg_catalog.jsonb_array_elements(p_value) t (e)
                 where pg_catalog.jsonb_typeof(t.e) <> 'string') then
    raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
  end if;
  return array(select e from pg_catalog.jsonb_array_elements_text(p_value) with ordinality t (e, o)
                order by o);
end
$$;

comment on function campaigns.json_code_list(jsonb) is
  'A correction of a list (0309): a JSON array of at most 50 strings as text[] in its order; NULL '
  'or JSON null the empty list; 22023 value otherwise. SECURITY INVOKER owned by '
  'influx_campaign_review_definer, no EXECUTE.';

-- 6.6 The agent's passages (modele §5; 09 RG8, RG9, RG93) -----------------------------------------

create or replace function campaigns.pause_campaign(
  p_campaign_id       uuid,
  p_reason_code       text,
  p_internal_comment  text)
returns table (
  status           text,
  intervention_id  uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := campaigns.require_campaign_agent(false);
  v_row     record;
  v_id      uuid;
begin
  perform campaigns.check_intervention_reason(p_reason_code, p_internal_comment);
  select * into v_row from campaigns.lock_campaign_for_agent(p_campaign_id, v_caller);
  if v_row.status <> 'published' then
    raise exception 'campaign_not_pausable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_row.status;
  end if;
  -- pause_origin influx by the trigger (the writer is this function's owner)
  update campaigns.campaigns c set status = 'paused' where c.id = p_campaign_id;
  v_id := campaigns.record_campaign_intervention(
            p_campaign_id, v_row.advertiser_account_id, 'paused', null, null, null, p_reason_code,
            p_internal_comment, null, 'paused_by_influx', 'campaign.paused',
            pg_catalog.jsonb_build_object('origin', 'influx'));
  return query select 'paused'::text, v_id;
end
$$;

comment on function campaigns.pause_campaign(uuid, text, text) is
  '09 RG8, RG93; modele §5 (0309): an agent or an admin pauses a published campaign with authority '
  '(pause_origin influx: the brand cannot resume it), with a reason (and a comment for other); a held '
  'account admitted. The intervention, campaign.decision (paused_by_influx), campaign.paused {origin '
  'influx, reason_code, intervention_id}. Returns (status, intervention_id). 42501 forbidden; 22023 '
  'reason, internal_comment; 55000 campaign_not_pausable (DETAIL the state). SECURITY DEFINER; '
  'EXECUTE for influx_agent and influx_admin.';

create or replace function campaigns.resume_campaign(
  p_campaign_id       uuid,
  p_reason_code       text,
  p_internal_comment  text)
returns table (
  status           text,
  intervention_id  uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := campaigns.require_campaign_agent(false);
  v_row     record;
  v_id      uuid;
begin
  perform campaigns.check_intervention_reason(p_reason_code, p_internal_comment);
  select * into v_row from campaigns.lock_campaign_for_agent(p_campaign_id, v_caller);
  if v_row.status <> 'paused' then
    raise exception 'campaign_not_resumable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_row.status;
  end if;
  -- RG8: no validation again; the snapshot is kept (modele §5, not a publication)
  update campaigns.campaigns c set status = 'published' where c.id = p_campaign_id;
  v_id := campaigns.record_campaign_intervention(
            p_campaign_id, v_row.advertiser_account_id, 'resumed', null, null, null, p_reason_code,
            p_internal_comment, null, 'resumed_by_influx', 'campaign.resumed',
            pg_catalog.jsonb_build_object('origin', 'influx'));
  return query select 'published'::text, v_id;
end
$$;

comment on function campaigns.resume_campaign(uuid, text, text) is
  '09 RG8, RG93; modele §5 (0309): an agent or an admin resumes a paused campaign, whatever its '
  'origin, with a reason; the snapshot kept (not a publication, RG5). The intervention, '
  'campaign.decision (resumed_by_influx), campaign.resumed {origin influx, reason_code, '
  'intervention_id}. Returns (status, intervention_id). 42501 forbidden; 22023 reason, '
  'internal_comment; 55000 campaign_not_resumable (DETAIL the state). SECURITY DEFINER; EXECUTE for '
  'influx_agent and influx_admin.';

create or replace function campaigns.close_campaign(
  p_campaign_id       uuid,
  p_reason_code       text,
  p_internal_comment  text)
returns table (
  status           text,
  intervention_id  uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := campaigns.require_campaign_agent(false);
  v_row     record;
  v_id      uuid;
begin
  perform campaigns.check_intervention_reason(p_reason_code, p_internal_comment);
  select * into v_row from campaigns.lock_campaign_for_agent(p_campaign_id, v_caller);
  if v_row.status not in ('published', 'paused') then
    raise exception 'campaign_not_closable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_row.status;
  end if;
  update campaigns.campaigns c set status = 'closed' where c.id = p_campaign_id;
  v_id := campaigns.record_campaign_intervention(
            p_campaign_id, v_row.advertiser_account_id, 'closed', null, null, null, p_reason_code,
            p_internal_comment, null, 'closed_by_influx', 'campaign.closed',
            pg_catalog.jsonb_build_object('origin', 'influx'));
  return query select 'closed'::text, v_id;
end
$$;

comment on function campaigns.close_campaign(uuid, text, text) is
  '09 RG9, RG93; modele §5 (0309): an agent or an admin closes a published or paused campaign, '
  'irreversibly, nothing erased, with a reason. The intervention, campaign.decision '
  '(closed_by_influx), campaign.closed {origin influx, reason_code, intervention_id}. Returns '
  '(status, intervention_id). 42501 forbidden; 22023 reason, internal_comment; 55000 '
  'campaign_not_closable (DETAIL the state). SECURITY DEFINER; EXECUTE for influx_agent and '
  'influx_admin.';

-- 6.7 A draft for a brand that called (09 RG1, RG94, CA61; Q2) -------------------------------------

create or replace function campaigns.create_campaign_for_brand(
  p_advertiser_account_id  uuid,
  p_title                  text,
  p_campaign_type_code     text)
returns table (
  campaign_id      uuid,
  intervention_id  uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := campaigns.require_campaign_agent(false);
  v_active    boolean;
  v_campaign  uuid;
  v_id        uuid;
begin
  perform campaigns.check_campaign_review_text(p_title, 1, 140, true, 'title');
  -- an advertiser account with its brand profile, in any state of the profile (EC-L3C-04-7)
  select a.status = 'active' into v_active
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id and r.role::text = 'advertiser'
    join profiles.advertiser_profiles p on p.account_id = a.id
   where a.id = p_advertiser_account_id
     and a.id is distinct from v_caller;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if not v_active then
    raise exception 'brand_not_active'
      using errcode = 'object_not_in_prerequisite_state', detail = 'brand_not_active';
  end if;
  if p_campaign_type_code is null
     or not exists (select 1 from reference.campaign_types t
                     where t.code = p_campaign_type_code and t.retired_at is null) then
    raise exception 'campaign_type'
      using errcode = 'invalid_parameter_value', detail = 'campaign_type';
  end if;

  -- a draft of the brand: the brand completes and submits it (Q2), never INFLUX
  insert into campaigns.campaigns (advertiser_account_id, title, campaign_type_code)
  values (p_advertiser_account_id, p_title, p_campaign_type_code)
  returning id into v_campaign;

  v_id := campaigns.record_campaign_intervention(
            v_campaign, p_advertiser_account_id, 'created', null, null,
            pg_catalog.jsonb_build_object('title', p_title, 'campaignType', p_campaign_type_code),
            'brand_request', null, null, 'created_for_brand', 'campaign.created_for_brand', null);
  return query select v_campaign, v_id;
end
$$;

comment on function campaigns.create_campaign_for_brand(uuid, text, text) is
  '09 RG1, RG94, CA61; modele §6 (0309): an agent or an admin creates a draft for an active advertiser '
  '(brand profile in any state), its title (1 to 140) and an active type; the brand submits it (Q2). '
  'The intervention (created, brand_request, new value {title, campaignType}), campaign.decision '
  '(created_for_brand), campaign.created_for_brand {intervention_id, reason_code}. Returns '
  '(campaign_id, intervention_id). 42501 forbidden (unknown, not an advertiser, T14); 55000 '
  'brand_not_active; 22023 title, campaign_type. SECURITY DEFINER; EXECUTE for influx_agent and '
  'influx_admin.';

-- 6.8 The correction of a field (09 RG94, CA60; 03 C(7); modele §6) ---------------------------------

create or replace function campaigns.correct_campaign_field(
  p_campaign_id       uuid,
  p_field_code        text,
  p_value             jsonb,
  p_reason_code       text,
  p_internal_comment  text)
returns table (
  intervention_id  uuid,
  review_token     text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c_scalar_text  constant text[] := array[
    'title', 'campaign_type', 'public_summary', 'brief', 'internal_reference',
    'product_description', 'product_sector', 'restrictions', 'product_value_band',
    'shipping_costs_borne_by', 'usage_rights', 'usage_rights_duration', 'exclusivity',
    'content_review_delay', 'audience_gender', 'currency', 'remuneration_kind', 'budget_band'];
  c_scalar_bool  constant text[] := array['product_is_sent', 'creator_keeps_product'];
  c_scalar_int   constant text[] := array['creators_wanted', 'total_budget', 'max_applications'];
  c_scalar_date  constant text[] := array[
    'applications_close_on', 'content_due_on', 'starts_on', 'ends_on'];
  c_lists        constant text[] := array[
    'key_messages', 'deliverables', 'usage_rights_territory', 'audience_countries',
    'audience_languages', 'audience_bands', 'audience_age_bands', 'audience_topics',
    'requested_items'];
  v_caller   uuid := campaigns.require_campaign_agent(false);
  v_status   text;
  v_entry    uuid;
  v_first    uuid;
  v_row      record;
  v_type     text := pg_catalog.jsonb_typeof(p_value);
  v_text     text;
  v_bool     boolean;
  v_int      bigint;
  v_date     date;
  v_codes    text[];
  v_old      jsonb;
  v_new      jsonb;
  v_id       uuid;
begin
  perform campaigns.check_intervention_reason(p_reason_code, p_internal_comment);
  -- never the state, the declaration nor the account (modele §6): the closed list of fields
  if p_field_code is null
     or not (p_field_code = any (c_scalar_text || c_scalar_bool || c_scalar_int || c_scalar_date
                                 || c_lists)) then
    raise exception 'field_code' using errcode = 'invalid_parameter_value', detail = 'field_code';
  end if;

  -- (1) the value, typed before anything is locked (22023 value)
  if p_field_code <> all (c_lists) and v_type is not null and v_type <> 'null' then
    if p_field_code = any (c_scalar_text) and v_type = 'string' then
      v_text := p_value #>> '{}';
    elsif p_field_code = any (c_scalar_bool) and v_type = 'boolean' then
      v_bool := (p_value #>> '{}') = 'true';
    elsif p_field_code = any (c_scalar_int) and v_type = 'number'
          and (p_value #>> '{}') ~ '^-?[0-9]{1,15}$' then
      v_int := (p_value #>> '{}')::bigint;
    elsif p_field_code = any (c_scalar_date) and v_type = 'string'
          and (p_value #>> '{}') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      -- a calendar date that does not exist (2026-02-30) is a value refused, not a crash
      begin
        v_date := (p_value #>> '{}')::date;
      exception when data_exception then
        raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
      end;
    else
      raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
    end if;
    if p_field_code = 'remuneration_kind'
       and v_text not in ('cash', 'cash_and_gift', 'gift_only', 'affiliate') then
      raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
    end if;
    if p_field_code in ('creators_wanted', 'max_applications') and v_int not between 0 and 32767 then
      raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
    end if;
  end if;

  -- (2) the state, then the locks in the order of the decisions (EC-L3C-04-9): the entry of a
  -- pending campaign first (the caller's live claim, no opinion yet), then the campaign
  select c.status::text into v_status
    from campaigns.campaigns c
   where c.id = p_campaign_id and c.advertiser_account_id is distinct from v_caller;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_status = 'pending_review' then
    select e.id into v_entry
      from campaigns.campaign_review_entries e
     where e.campaign_id = p_campaign_id and e.state = 'open';
    if v_entry is null then
      raise exception 'campaign_not_correctable'
        using errcode = 'object_not_in_prerequisite_state', detail = v_status;
    end if;
    -- 42501 a held account or the first reviewer, 55P03 without the caller's live claim
    perform campaigns.lock_held_campaign_review_entry(v_entry, v_caller);
    select e.first_reviewed_by_account_id into v_first
      from campaigns.campaign_review_entries e
     where e.id = v_entry;
    -- modele §3: the second examination bears on the version seen
    if v_first is not null then
      raise exception 'first_review_given'
        using errcode = 'object_not_in_prerequisite_state', detail = 'first_review_given';
    end if;
  end if;
  select * into v_row from campaigns.lock_campaign_for_agent(p_campaign_id, v_caller);
  -- Q1: draft, rejected, or the pending campaign whose entry the caller holds
  if v_row.status is distinct from v_status
     or v_row.status not in ('draft', 'rejected', 'pending_review') then
    raise exception 'campaign_not_correctable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_row.status;
  end if;

  v_old := campaigns.campaign_field_value(p_campaign_id, p_field_code);

  -- (3) the write: one column, or the list replaced in a block (a constraint refuses with its own
  -- code, 23514 or 23503, as for the brand)
  case p_field_code
    when 'title' then
      update campaigns.campaigns c set title = v_text where c.id = p_campaign_id;
    when 'campaign_type' then
      update campaigns.campaigns c set campaign_type_code = v_text where c.id = p_campaign_id;
    when 'public_summary' then
      update campaigns.campaigns c set public_summary = v_text where c.id = p_campaign_id;
    when 'brief' then
      update campaigns.campaigns c set brief = v_text where c.id = p_campaign_id;
    when 'internal_reference' then
      update campaigns.campaigns c set internal_reference = v_text where c.id = p_campaign_id;
    when 'product_description' then
      update campaigns.campaigns c set product_description = v_text where c.id = p_campaign_id;
    when 'product_sector' then
      update campaigns.campaigns c set sector_code = v_text where c.id = p_campaign_id;
    when 'restrictions' then
      update campaigns.campaigns c set restrictions = v_text where c.id = p_campaign_id;
    when 'product_value_band' then
      update campaigns.campaigns c set product_value_band_code = v_text where c.id = p_campaign_id;
    when 'shipping_costs_borne_by' then
      update campaigns.campaigns c set shipping_costs_borne_by = v_text where c.id = p_campaign_id;
    when 'usage_rights' then
      update campaigns.campaigns c set usage_rights_code = v_text where c.id = p_campaign_id;
    when 'usage_rights_duration' then
      update campaigns.campaigns c set usage_rights_duration_band = v_text
       where c.id = p_campaign_id;
    when 'exclusivity' then
      update campaigns.campaigns c set exclusivity_band = v_text where c.id = p_campaign_id;
    when 'content_review_delay' then
      update campaigns.campaigns c set content_review_delay = v_text where c.id = p_campaign_id;
    when 'audience_gender' then
      update campaigns.campaigns c set audience_gender_code = v_text where c.id = p_campaign_id;
    when 'currency' then
      -- l3b/modele §1: changing the currency empties both bands in the same write
      update campaigns.campaigns c
         set currency = v_text, product_value_band_code = null, per_creator_budget_band_code = null
       where c.id = p_campaign_id;
    when 'remuneration_kind' then
      update campaigns.campaigns c set remuneration_kind = v_text::campaigns.remuneration_kind
       where c.id = p_campaign_id;
    when 'budget_band' then
      update campaigns.campaigns c set per_creator_budget_band_code = v_text
       where c.id = p_campaign_id;
    when 'product_is_sent' then
      update campaigns.campaigns c set product_is_sent = v_bool where c.id = p_campaign_id;
    when 'creator_keeps_product' then
      update campaigns.campaigns c set creator_keeps_product = v_bool where c.id = p_campaign_id;
    when 'creators_wanted' then
      update campaigns.campaigns c set creators_wanted = v_int::smallint where c.id = p_campaign_id;
    when 'total_budget' then
      update campaigns.campaigns c set total_budget_minor = v_int where c.id = p_campaign_id;
    when 'max_applications' then
      update campaigns.campaigns c set max_applications = v_int::smallint where c.id = p_campaign_id;
    when 'applications_close_on' then
      update campaigns.campaigns c set applications_close_on = v_date where c.id = p_campaign_id;
    when 'content_due_on' then
      update campaigns.campaigns c set content_due_on = v_date where c.id = p_campaign_id;
    when 'starts_on' then
      update campaigns.campaigns c set starts_on = v_date where c.id = p_campaign_id;
    when 'ends_on' then
      update campaigns.campaigns c set ends_on = v_date where c.id = p_campaign_id;
    when 'key_messages' then
      v_codes := campaigns.json_code_list(p_value);
      delete from campaigns.campaign_key_messages m where m.campaign_id = p_campaign_id;
      insert into campaigns.campaign_key_messages (campaign_id, position, body)
      select p_campaign_id, t.o::smallint, t.e from unnest(v_codes) with ordinality t (e, o);
    when 'deliverables' then
      if v_type is not null and v_type <> 'null'
         and (v_type <> 'array' or pg_catalog.jsonb_array_length(p_value) > 50
              or exists (select 1 from pg_catalog.jsonb_array_elements(p_value) t (e)
                          where pg_catalog.jsonb_typeof(t.e) <> 'object'
                             or pg_catalog.jsonb_typeof(t.e -> 'networkCode')
                                  is distinct from 'string'
                             or pg_catalog.jsonb_typeof(t.e -> 'formatCode')
                                  is distinct from 'string'
                             or pg_catalog.jsonb_typeof(t.e -> 'quantity')
                                  is distinct from 'number'
                             or coalesce((t.e ->> 'quantity') !~ '^[0-9]{1,4}$', true))) then
        raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
      end if;
      delete from campaigns.campaign_deliverables d where d.campaign_id = p_campaign_id;
      if v_type = 'array' then
        insert into campaigns.campaign_deliverables
          (campaign_id, slot, network_code, format_code, quantity)
        select p_campaign_id, t.o::smallint, t.e ->> 'networkCode', t.e ->> 'formatCode',
               (t.e ->> 'quantity')::smallint
          from pg_catalog.jsonb_array_elements(p_value) with ordinality t (e, o);
      end if;
    when 'usage_rights_territory' then
      if v_type is distinct from 'object'
         or pg_catalog.jsonb_typeof(p_value -> 'scope') not in ('string', 'null')
         or (p_value ? 'scope') is not true then
        raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
      end if;
      v_codes := campaigns.json_code_list(p_value -> 'countries');
      update campaigns.campaigns c set usage_rights_territory_scope = p_value ->> 'scope'
       where c.id = p_campaign_id;
      delete from campaigns.campaign_usage_territories u where u.campaign_id = p_campaign_id;
      insert into campaigns.campaign_usage_territories (campaign_id, slot, country_code)
      select p_campaign_id, t.o::smallint, t.e from unnest(v_codes) with ordinality t (e, o);
    when 'audience_countries' then
      v_codes := campaigns.json_code_list(p_value);
      delete from campaigns.campaign_audience_countries a where a.campaign_id = p_campaign_id;
      insert into campaigns.campaign_audience_countries (campaign_id, slot, country_code)
      select p_campaign_id, t.o::smallint, t.e from unnest(v_codes) with ordinality t (e, o);
    when 'audience_languages' then
      v_codes := campaigns.json_code_list(p_value);
      delete from campaigns.campaign_audience_languages l where l.campaign_id = p_campaign_id;
      insert into campaigns.campaign_audience_languages (campaign_id, language_code)
      select p_campaign_id, t.e from unnest(v_codes) t (e);
    when 'audience_bands' then
      v_codes := campaigns.json_code_list(p_value);
      delete from campaigns.campaign_audience_bands b where b.campaign_id = p_campaign_id;
      insert into campaigns.campaign_audience_bands (campaign_id, audience_band_code)
      select p_campaign_id, t.e from unnest(v_codes) t (e);
    when 'audience_age_bands' then
      v_codes := campaigns.json_code_list(p_value);
      delete from campaigns.campaign_audience_age_bands g where g.campaign_id = p_campaign_id;
      insert into campaigns.campaign_audience_age_bands (campaign_id, age_band_code)
      select p_campaign_id, t.e from unnest(v_codes) t (e);
    when 'audience_topics' then
      v_codes := campaigns.json_code_list(p_value);
      delete from campaigns.campaign_topics t where t.campaign_id = p_campaign_id;
      insert into campaigns.campaign_topics (campaign_id, slot, topic_code)
      select p_campaign_id, t.o::smallint, t.e from unnest(v_codes) with ordinality t (e, o);
    when 'requested_items' then
      v_codes := campaigns.json_code_list(p_value);
      delete from campaigns.campaign_requested_items r where r.campaign_id = p_campaign_id;
      insert into campaigns.campaign_requested_items (campaign_id, slot, item_code)
      select p_campaign_id, t.o::smallint, t.e from unnest(v_codes) with ordinality t (e, o);
  end case;

  v_new := campaigns.campaign_field_value(p_campaign_id, p_field_code);
  -- EC-L3C-04-4: never an intervention (nor an e-mail) for nothing
  if v_new = v_old then
    raise exception 'unchanged' using errcode = 'invalid_parameter_value', detail = 'unchanged';
  end if;

  -- (4) the line (old and new value, reason, comment, author), the e-mail, the register
  v_id := campaigns.record_campaign_intervention(
            p_campaign_id, v_row.advertiser_account_id, 'corrected', p_field_code, v_old, v_new,
            p_reason_code, p_internal_comment, v_entry, 'corrected', 'campaign.corrected',
            pg_catalog.jsonb_build_object('field_code', p_field_code));
  return query
    select v_id,
           case when v_status = 'pending_review'
                then campaigns.campaign_review_token(p_campaign_id) end;
end
$$;

comment on function campaigns.correct_campaign_field(uuid, text, jsonb, text, text) is
  '09 RG94, CA60; 03 C(7); modele §6 (0309): an agent or an admin corrects ONE field of a draft or '
  'rejected campaign (a held account admitted), or of a pending_review campaign whose entry he holds '
  '(live claim, no opinion yet; the entry locked before the campaign, EC-L3C-04-9). The closed list '
  'of fields (never the state, the declaration nor the account), a list replaced in a block, the '
  'currency emptying both bands; old and new value as campaign_field_value() reads them. The '
  'intervention (corrected, field, values, reason, comment, entry), campaign.decision (corrected), '
  'campaign.corrected {intervention_id, field_code, reason_code}. Returns (intervention_id, '
  'review_token: the new token of a pending campaign, else null). 42501 forbidden (unknown, own, a '
  'pending campaign of a held account or of which the caller gave the first review); 55P03 '
  'no_live_claim; 55000 campaign_not_correctable (DETAIL the state), first_review_given, '
  'entry_closed; 22023 reason, internal_comment, field_code, value, unchanged; a constraint of the '
  'campaign with its own code. SECURITY DEFINER; EXECUTE for influx_agent and influx_admin.';

-- 6.9 The record of a campaign (modele §6; 02 §5 rule 5) --------------------------------------------

create or replace function campaigns.open_campaign_record(p_campaign_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := campaigns.require_campaign_agent(false);
begin
  if not exists (select 1 from campaigns.campaigns c
                  where c.id = p_campaign_id
                    and c.advertiser_account_id is distinct from v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform audit.append('campaign.record_read', 'campaign', p_campaign_id, '{}'::jsonb);
end
$$;

comment on function campaigns.open_campaign_record(uuid) is
  'modele §6 (0309): an agent or an admin opens the record of a campaign: campaign.record_read in '
  'the transaction, then the agent reads with his own grants (0308). 42501 forbidden (unknown, own '
  'account, T14). SECURITY DEFINER; EXECUTE for influx_agent and influx_admin.';

do $$
declare
  f text;
begin
  foreach f in array array[
    'campaigns.check_intervention_reason(text, text)',
    'campaigns.lock_campaign_for_agent(uuid, uuid)',
    'campaigns.record_campaign_intervention(uuid, uuid, text, text, jsonb, jsonb, text, text, uuid, text, text, jsonb)',
    'campaigns.campaign_field_value(uuid, text)',
    'campaigns.json_code_list(jsonb)',
    'campaigns.pause_campaign(uuid, text, text)',
    'campaigns.resume_campaign(uuid, text, text)',
    'campaigns.close_campaign(uuid, text, text)',
    'campaigns.create_campaign_for_brand(uuid, text, text)',
    'campaigns.correct_campaign_field(uuid, text, jsonb, text, text)',
    'campaigns.open_campaign_record(uuid)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end
$$;

grant execute on function
  campaigns.pause_campaign(uuid, text, text),
  campaigns.resume_campaign(uuid, text, text),
  campaigns.close_campaign(uuid, text, text),
  campaigns.create_campaign_for_brand(uuid, text, text),
  campaigns.correct_campaign_field(uuid, text, jsonb, text, text),
  campaigns.open_campaign_record(uuid)
  to influx_agent, influx_admin;

reset role;
revoke create on schema campaigns from influx_campaign_review_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_review_definer', current_user);
end
$$;

-- 7. The automatic closure (09 RG9; modele §5), as influx_maintenance_definer ------------------------

-- 7.1 Its rights: the published and paused campaigns (id, brand, end), their state written; the
-- parameter of RG9; the e-mail closed_automatically. Never a text, a band nor a list.
grant usage on schema campaigns to influx_maintenance_definer;
grant select (id, advertiser_account_id, status, ends_on), update (status)
   on campaigns.campaigns to influx_maintenance_definer;

drop policy if exists campaigns_maintenance_definer_select on campaigns.campaigns;
create policy campaigns_maintenance_definer_select on campaigns.campaigns
  for select to influx_maintenance_definer
  using (status in ('published', 'paused', 'closed'));
drop policy if exists campaigns_maintenance_definer_update on campaigns.campaigns;
create policy campaigns_maintenance_definer_update on campaigns.campaigns
  for update to influx_maintenance_definer
  using (status in ('published', 'paused'))
  with check (status = 'closed');

drop policy if exists operational_settings_maintenance_definer_select_campaign
  on backoffice.operational_settings;
create policy operational_settings_maintenance_definer_select_campaign
  on backoffice.operational_settings
  for select to influx_maintenance_definer
  using (key = 'campaign_auto_close_days');

drop policy if exists outbox_events_maintenance_definer_insert_campaign on leads.outbox_events;
create policy outbox_events_maintenance_definer_insert_campaign on leads.outbox_events
  for insert to influx_maintenance_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and destination = 'brevo_transactional' and event_type = 'campaign.decision'
              and payload ->> 'email_code' = 'closed_automatically');

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;
set role influx_maintenance_definer;

create or replace function ops.close_ended_campaigns(
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
  v_days   integer;
  v_today  date := (pg_catalog.timezone('UTC', pg_catalog.now()))::date;
  v_count  integer := 0;
  v_row    record;
  v_event  uuid;
begin
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code::text = 'campaign_closure') then
    raise exception 'no open campaign_closure run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  select (s.value)::integer into v_days
    from backoffice.operational_settings s where s.key = 'campaign_auto_close_days';
  if v_days is null then
    raise exception 'campaign parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- RG9: the UTC day reached ends_on + campaign_auto_close_days; the oldest end first, 500 at most
  -- (500: call again); a campaign another transaction holds waits for the next call
  for v_row in
    select c.id, c.advertiser_account_id
      from campaigns.campaigns c
     where c.status in ('published', 'paused')
       and c.ends_on + v_days <= v_today
     order by c.ends_on, c.id
     limit 500
       for update of c skip locked
  loop
    update campaigns.campaigns c set status = 'closed'
     where c.id = v_row.id and c.status in ('published', 'paused');
    if found then
      -- 09 RG93: the brand is told; ids and its code only, key campaign.decision:<campaign>
      v_event := pg_catalog.gen_random_uuid();
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (v_event, 'campaign.decision', 'brevo_transactional',
              'account:' || v_row.advertiser_account_id::text, 100,
              pg_catalog.jsonb_build_object('event_id', v_event,
                                            'account_id', v_row.advertiser_account_id,
                                            'campaign_id', v_row.id,
                                            'email_code', 'closed_automatically'),
              'campaign.decision:' || v_row.id::text);
      -- a system event: the worker's transaction carries no account (03 C(15))
      perform audit.append('campaign.closed', 'campaign', v_row.id,
                           pg_catalog.jsonb_build_object('origin', 'system'));
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end
$$;

comment on function ops.close_ended_campaigns(uuid, smallint) is
  '09 RG9, RG93; modele §5 (0309): inside the open campaign_closure run of the attempt (55000 '
  'otherwise), closes at most 500 published or paused campaigns whose UTC day reached ends_on + '
  'campaign_auto_close_days (oldest end first, SKIP LOCKED): closed_at by the trigger, nothing '
  'erased; campaign.decision to brevo_transactional (email_code closed_automatically, key '
  'campaign.decision:<campaign>), campaign.closed {origin system} without actor. Returns the count '
  '(500: call again). The application deadline passed writes nothing (CA49). SECURITY DEFINER owned '
  'by influx_maintenance_definer; EXECUTE for influx_worker only.';

revoke all on function ops.close_ended_campaigns(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function ops.close_ended_campaigns(uuid, smallint) to influx_worker;

reset role;
revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
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
  -- the functions of 0309: their owner, their mode, empty search_path, EXECUTE for their callers
  -- only (the helpers: nobody)
  for v_def in
    select * from (values
      ('campaigns.lock_own_campaign(uuid)', 'influx_campaign_definer', false, ''),
      ('campaigns.pause_own_campaign(uuid)', 'influx_campaign_definer', true, 'influx_advertiser'),
      ('campaigns.resume_own_campaign(uuid)', 'influx_campaign_definer', true, 'influx_advertiser'),
      ('campaigns.close_own_campaign(uuid)', 'influx_campaign_definer', true, 'influx_advertiser'),
      ('campaigns.check_intervention_reason(text, text)', 'influx_campaign_review_definer', false, ''),
      ('campaigns.lock_campaign_for_agent(uuid, uuid)', 'influx_campaign_review_definer', false, ''),
      ('campaigns.record_campaign_intervention(uuid, uuid, text, text, jsonb, jsonb, text, text, uuid, text, text, jsonb)',
       'influx_campaign_review_definer', false, ''),
      ('campaigns.campaign_field_value(uuid, text)', 'influx_campaign_review_definer', false, ''),
      ('campaigns.json_code_list(jsonb)', 'influx_campaign_review_definer', false, ''),
      ('campaigns.pause_campaign(uuid, text, text)', 'influx_campaign_review_definer', true,
       'influx_agent,influx_admin'),
      ('campaigns.resume_campaign(uuid, text, text)', 'influx_campaign_review_definer', true,
       'influx_agent,influx_admin'),
      ('campaigns.close_campaign(uuid, text, text)', 'influx_campaign_review_definer', true,
       'influx_agent,influx_admin'),
      ('campaigns.create_campaign_for_brand(uuid, text, text)', 'influx_campaign_review_definer',
       true, 'influx_agent,influx_admin'),
      ('campaigns.correct_campaign_field(uuid, text, jsonb, text, text)',
       'influx_campaign_review_definer', true, 'influx_agent,influx_admin'),
      ('campaigns.open_campaign_record(uuid)', 'influx_campaign_review_definer', true,
       'influx_agent,influx_admin'),
      ('ops.close_ended_campaigns(uuid, smallint)', 'influx_maintenance_definer', true,
       'influx_worker')
    ) as d (fn, owner, definer, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> v_def.owner
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
            or not (a.grantee::regrole::text = any (pg_catalog.string_to_array(v_def.callers, ','))));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- the three triggers: SECURITY INVOKER, empty search_path, executed by nobody
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('campaigns.stamp_campaign_cycle()'::regprocedure,
                   'campaigns.guard_agent_intervention_write()'::regprocedure,
                   'campaigns.guard_campaign_member_write()'::regprocedure)
     and (p.prosecdef or p.proconfig is distinct from array['search_path=""']
          or exists (select 1
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                                                           pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner));
  if v_bad is not null then
    raise exception 'triggers of 0309 with a wrong mode or grant: %', v_bad;
  end if;

  -- L2DS-5 extended (fiche invariant 10): no dynamic SQL in a function of a campaign owner, nor in
  -- the closure of the worker
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where (p.proowner in ('influx_campaign_definer'::regrole,
                         'influx_campaign_review_definer'::regrole)
          or p.oid = 'ops.close_ended_campaigns(uuid, smallint)'::regprocedure)
     and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic SQL in a function of a campaign owner: %', v_bad;
  end if;

  -- invariant 1 (RG5, CA5): the publication columns still written by the owner of the decisions
  -- only; the state by the doors, the decisions and the closure of the worker
  select string_agg(r || ' ' || c, ', ') into v_bad
    from unnest(array['influx_advertiser', 'influx_campaign_definer', 'influx_agent',
                      'influx_admin', 'influx_creator', 'influx_maintenance_definer',
                      'influx_worker']) r,
         unnest(array['status', 'current_snapshot_id', 'first_published_at', 'owner_agent_id',
                      'paused_at', 'pause_origin', 'closed_at']) c
   where pg_catalog.has_column_privilege(r, 'campaigns.campaigns', c, 'UPDATE')
     and not (r in ('influx_campaign_definer', 'influx_maintenance_definer') and c = 'status');
  if v_bad is not null then
    raise exception 'a role beyond its passages writes the cycle of a campaign: %', v_bad;
  end if;
  if exists (select 1 from pg_catalog.pg_roles ro
              where ro.rolname like 'influx\_%'
                and (pg_catalog.has_column_privilege(ro.oid, 'campaigns.campaigns', 'paused_at', 'UPDATE')
                     or pg_catalog.has_column_privilege(ro.oid, 'campaigns.campaigns', 'pause_origin',
                                                        'UPDATE')
                     or pg_catalog.has_column_privilege(ro.oid, 'campaigns.campaigns', 'closed_at',
                                                        'UPDATE'))) then
    raise exception 'a role writes paused_at, pause_origin or closed_at (the trigger''s only)';
  end if;

  -- the interventions: RLS enabled and forced, nothing to the Data API roles nor to a member;
  -- written by the owner of the interventions only, never updated nor deleted by it; agent and admin
  -- never read the internal comment
  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'campaigns.agent_interventions'::regclass)
     or exists (select 1 from unnest(array['anon', 'authenticated', 'service_role',
                                           'influx_advertiser', 'influx_creator']) r
                 where pg_catalog.has_table_privilege(r, 'campaigns.agent_interventions',
                                                      'SELECT, INSERT, UPDATE, DELETE')
                    or pg_catalog.has_any_column_privilege(r, 'campaigns.agent_interventions',
                                                           'SELECT, INSERT, UPDATE')) then
    raise exception 'campaigns.agent_interventions is not protected';
  end if;
  select string_agg(ro.rolname, ', ') into v_bad
    from pg_catalog.pg_roles ro
   where ro.rolname like 'influx\_%'
     and (pg_catalog.has_table_privilege(ro.oid, 'campaigns.agent_interventions',
                                         'UPDATE, DELETE')
          or pg_catalog.has_any_column_privilege(ro.oid, 'campaigns.agent_interventions', 'UPDATE')
          or (ro.rolname <> 'influx_campaign_review_definer'
              and (pg_catalog.has_table_privilege(ro.oid, 'campaigns.agent_interventions', 'INSERT')
                   or pg_catalog.has_any_column_privilege(ro.oid, 'campaigns.agent_interventions',
                                                          'INSERT'))));
  if v_bad is not null then
    raise exception 'a role writes an intervention beyond its owner, or changes one: %', v_bad;
  end if;
  if exists (select 1 from unnest(array['influx_agent', 'influx_admin']) r
              where pg_catalog.has_column_privilege(r, 'campaigns.agent_interventions',
                                                    'internal_comment', 'SELECT')) then
    raise exception 'agent or admin reads the internal comment of an intervention';
  end if;

  -- TM5.6: the creator still reaches nothing of the schema campaigns
  if pg_catalog.has_schema_privilege('influx_creator', 'campaigns', 'USAGE') then
    raise exception 'influx_creator reaches the schema campaigns (TM5.6)';
  end if;

  -- the four codes, the task, the constraint and the trigger of the cycle
  if (select count(*) from audit.event_types
       where code in ('campaign.resumed', 'campaign.corrected', 'campaign.created_for_brand',
                      'campaign.record_read')
         and export_class = 'exported') <> 4 then
    raise exception 'the four codes of 0309 are not loaded with their export_class';
  end if;
  if not exists (select 1 from pg_catalog.pg_enum
                  where enumtypid = 'ops.periodic_task'::regtype
                    and enumlabel = 'campaign_closure') then
    raise exception 'ops.periodic_task lacks campaign_closure';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conrelid = 'campaigns.campaigns'::regclass
                    and conname = 'campaigns_cycle_stamped')
     or not exists (select 1 from pg_catalog.pg_trigger
                     where tgrelid = 'campaigns.campaigns'::regclass
                       and tgname = 'campaigns_stamp_cycle' and not tgisinternal) then
    raise exception 'the cycle of a campaign is not stamped';
  end if;

  -- the owners left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid in ('influx_campaign_definer'::regrole,
                                 'influx_campaign_review_definer'::regrole,
                                 'influx_maintenance_definer'::regrole)
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege('influx_campaign_definer', 'campaigns', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_campaign_review_definer', 'campaigns', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE') then
    raise exception 'an owner of 0309 left with a member or CREATE';
  end if;
end
$$;
