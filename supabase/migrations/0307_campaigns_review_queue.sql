-- =============================================================================
-- 0307_campaigns_review_queue
-- -----------------------------------------------------------------------------
-- Lot 3 / L3C, commit 02 (jalons/l3c/02.md; fiche invariants 4, 9 to 11; jalons/l3c/modele.md §1, §7,
-- §9, which PREVAIL for every name; 09 RG6, RG15, RG87, RG88, RG95; 15 RG26 to RG29, RG36, RG37).
-- Queue 7 (`campaigns`): the entry opened by the submission door, its deadlines, the claim, the
-- release, the extension and the forced release; the freeze recreated as a closed list of roles
-- (L3BS-2). No decision (0308), no state of the cycle (0309), nothing of privacy.* (0310), no route.
-- Signalled I-4 (03): a new definer role, SECURITY DEFINER functions, GRANTs, policies, audit.
--
-- 1. influx_campaign_review_definer (NOLOGIN NOINHERIT, no member; modele §4, D81 (5); 03 P7): owner
--    of the functions of queue 7 (from 0308, 0309: decisions, interventions, record), EXECUTE for
--    influx_agent and influx_admin (aal2 inside); never reached from a member door.
-- 2. Queue 7 and its policy (claim 240, decision 480, escalation 960; 15 RG29, RG37); settings
--    campaign_enhanced_review_minutes 960, campaign_live_cap 10 (RG15), campaign_auto_close_days 30.
-- 3. campaigns.campaign_review_entries (modele §1): one open entry per campaign at most, the lock,
--    the deadlines frozen by an invoker trigger (1 business day, 2 for a sensitive sector; escalation
--    at 3 business days of age, RG6), the columns of the first review and of the decision (0308).
-- 4. campaigns.normalized_title() (RG95) and campaigns.assert_live_campaign_cap() (RG15, advisory
--    lock of the brand), invoker, EXECUTE for influx_campaign_definer.
-- 5. open_ (= claim), release_, extend_, force_release_ (admin) campaign_review_entry/claim; codes
--    queue.*, queue_code `campaigns`; 42501 for an unknown entry, the caller's own account, an open
--    entry of an account he holds (15 RG36) or of which he gave the first review.
-- 6. The freeze recreated as a closed list of roles (modele §7, L3BS-2).
-- 7. The submission door recreated at the same signature: RG15, then the entry (RG95 alert).
-- 8. One open entry for every campaign already pending_review (modele -1).
--
-- EC-L3C-02 (micro-gaps, the safest choice):
--   EC-L3C-02-1  The entries opened for the campaigns already pending_review take created_at = now():
--                their deadline runs from the opening of queue 7, never an unavoidable breach.
--   EC-L3C-02-2  The token reads the entry columns, lists, declaration and sensitivity directly (a
--                superset of campaign_input(), which stays executed by its owner only).
--   EC-L3C-02-3  The opening locks the entry, not the campaign: a pending_review campaign is frozen
--                for its brand and corrected by the holder of the claim only (0309).
--   EC-L3C-02-4  Bounds: campaign_enhanced_review_minutes 1 to 525600 (as 0129), campaign_live_cap 1
--                to 1000, campaign_auto_close_days 1 to 365; they only refuse an absurd value.
--   EC-L3C-02-5  normalized_title() collapses a run of non-alphanumerics into ONE space and trims.
--   EC-L3C-02-6  live_campaign_cap and the duplicate order the campaigns by submitted_at, then id.
--   EC-L3C-02-7  The read policy hides an open entry from its first reviewer (modele §3); the entries of
--                a held account are refused by the functions and filtered by the route, as queue 2.
--   EC-L3C-02-8  Agent and admin read the entries only; the campaigns and the reasons come with 0308.
--
-- ROLLBACK (before any campaign is submitted after 0307): recreate campaigns.submit_own_campaign()
-- and campaigns.guard_campaign_member_write() as in 0305 and 0303; drop the functions of sections 4,
-- 5 and 7.1; drop table campaigns.campaign_review_entries; drop type campaigns.review_entry_state;
-- alter table campaigns.campaigns drop constraint campaigns_id_advertiser; delete the three keys and
-- recreate operational_settings_key_closed as in 0242; delete from backoffice.sla_policies and
-- backoffice.queues where code = 'campaigns' (one transaction); drop the policies
-- *_campaign_review_definer_* and *_campaign_definer_* named below and revoke their grants; revoke
-- execute on audit.append from influx_campaign_review_definer (as influx_audit_writer); revoke usage
-- on schema campaigns from influx_agent, influx_admin; drop role influx_campaign_review_definer.
-- =============================================================================

-- 1. The owner of queue 7 (03 P7 rule 5; rules 1 and 2 of 0001; modele §4) ---------------------------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_campaign_review_definer') then
    create role influx_campaign_review_definer with nologin noinherit;
  end if;
  alter role influx_campaign_review_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_review_definer' and rolsuper) then
    raise exception 'role influx_campaign_review_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_review_definer' and rolbypassrls) then
    alter role influx_campaign_review_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_review_definer' and rolreplication) then
    alter role influx_campaign_review_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_review_definer' and rolcreatedb) then
    alter role influx_campaign_review_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_review_definer' and rolcreaterole) then
    alter role influx_campaign_review_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. Queue 7, its delay and the settings of the campaigns (15 RG29, RG37, RG38; modele §1, §9) ------
-- ON CONFLICT DO NOTHING: re-running the migration never overwrites a value changed since.

insert into backoffice.queues
  (code, label_key, spec_document, handled_by_roles, allows_bulk_action, has_lock)
values
  ('campaigns', 'queue.campaigns', '09 RG87-RG97', '{agent,admin}', false, true)
on conflict (code) do nothing;

insert into backoffice.sla_policies
  (queue_code, target_claim_minutes, target_decision_minutes, business_hours,
   escalate_after_minutes, is_provisional)
values
  -- 1 business day (2 in enhanced review, campaign_enhanced_review_minutes), claim within 4
  -- business hours, escalation at 3 business days of age (09 RG6)
  ('campaigns', 240, 480, default, 960, false)
on conflict (queue_code) do nothing;

-- the deferred key is checked now: a pending trigger event would block any later ALTER TABLE
set constraints backoffice.queues_sla_policy_fk immediate;

alter table backoffice.operational_settings
  drop constraint if exists operational_settings_key_closed;
alter table backoffice.operational_settings
  add constraint operational_settings_key_closed check (key in (
    'claim_expiry_minutes',
    'verification_code_validity_days', 'evidence_freshness_days', 'audience_badge_validity_days',
    'badge_grace_days', 'brand_badge_validity_months', 'request_retry_hours',
    'rejection_cap_count', 'rejection_cap_window_days', 'figures_gap_alert_percent',
    'audience_drop_alert_percent', 'dispute_window_days', 'evidence_retention_days',
    'findings_retention_days', 'evidence_max_files_per_request', 'evidence_max_upload_bytes',
    'badge_reminder_days', 'dispute_reflection_hours', 'portfolio_retention_days',
    'campaign_enhanced_review_minutes', 'campaign_live_cap', 'campaign_auto_close_days'));

-- EC-L3C-02-4: a whole JSON number in its range; CASE keeps the cast behind the type test
do $$
declare
  k record;
begin
  for k in select * from (values ('campaign_enhanced_review_minutes', 525600),
                                 ('campaign_live_cap', 1000),
                                 ('campaign_auto_close_days', 365)) as v (key, upper_bound)
  loop
    execute format('alter table backoffice.operational_settings drop constraint if exists %I',
                   'operational_settings_' || k.key);
    execute format('alter table backoffice.operational_settings add constraint %I check (key <> %L '
                   'or case when jsonb_typeof(value) = ''number'' then (value)::numeric = '
                   'trunc((value)::numeric) and (value)::numeric between 1 and %s else false end)',
                   'operational_settings_' || k.key, k.key, k.upper_bound);
  end loop;
end
$$;

insert into backoffice.operational_settings (key, value)
values ('campaign_enhanced_review_minutes', '960'::jsonb),
       ('campaign_live_cap', '10'::jsonb),
       ('campaign_auto_close_days', '30'::jsonb)
on conflict (key) do nothing;

comment on column backoffice.operational_settings.key is
  'Closed list (operational_settings_key_closed), each key a whole number in the range of its own '
  'CHECK operational_settings_<key>, its meaning commented by the migration that added it (0206, '
  '0221, 0230, 0232, 0242). From 0307: campaign_enhanced_review_minutes (1 to 525600, the delay of '
  'queue 7 in enhanced review, 15 RG37), campaign_live_cap (1 to 1000, 09 RG15) and '
  'campaign_auto_close_days (1 to 365, 09 RG9).';

-- 3. campaigns.campaign_review_entries: queue 7 (modele §1; 0243 §4; 15 RG26, RG27) ------------------

do $$
begin
  create type campaigns.review_entry_state as enum ('open', 'published', 'rejected', 'withdrawn');
exception
  when duplicate_object then null;
end
$$;

comment on type campaigns.review_entry_state is
  'State of an entry of queue 7 (modele §1): open, published or rejected (0308), withdrawn (0310).';

-- the composite key of an entry: an entry belongs to a campaign OF ITS brand
do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'campaigns_id_advertiser'
                    and conrelid = 'campaigns.campaigns'::regclass) then
    alter table campaigns.campaigns
      add constraint campaigns_id_advertiser unique (id, advertiser_account_id);
  end if;
end
$$;

create table if not exists campaigns.campaign_review_entries (
  id                                uuid        not null primary key default gen_random_uuid(),
  campaign_id                       uuid        not null,
  advertiser_account_id             uuid        not null,
  state                             campaigns.review_entry_state not null default 'open',
  created_at                        timestamptz not null default now(),
  sla_due_at                        timestamptz not null,
  escalate_at                       timestamptz,
  claimed_by_account_id             uuid        references identity.accounts (id),
  claimed_at                        timestamptz,
  claim_expires_at                  timestamptz,
  forced_release_at                 timestamptz,
  forced_release_by_account_id      uuid        references identity.accounts (id),
  forced_release_holder_account_id  uuid        references identity.accounts (id),
  forced_release_reason_code        text        references backoffice.claim_release_reasons (code),
  -- the first review of an enhanced review (09 RG85, modele §3; written by 0308)
  first_reviewed_by_account_id      uuid        references identity.accounts (id),
  first_reviewed_at                 timestamptz,
  first_review_opinion              text,
  decided_by_account_id             uuid        references identity.accounts (id),
  decided_at                        timestamptz,
  rejection_reason_code             text        references campaigns.rejection_reasons (code),
  member_message                    text,
  internal_comment                  text,
  -- RG95: written once by the submission door, never recomputed (modele -2)
  duplicate_of_campaign_id          uuid        references campaigns.campaigns (id),
  closed_at                         timestamptz,
  -- 15 C8: a late decision is possible, marked
  sla_breached                      boolean     not null
                                                generated always as
                                                  (decided_at is not null and decided_at > sla_due_at)
                                                stored,
  updated_at                        timestamptz not null default now(),

  constraint campaign_review_entries_campaign_fk
    foreign key (campaign_id, advertiser_account_id)
    references campaigns.campaigns (id, advertiser_account_id),
  constraint campaign_review_entries_closed check ((state = 'open') = (closed_at is null)),
  constraint campaign_review_entries_closed_after check (closed_at >= created_at),
  -- published and rejected, and only they, carry a human decision, whole
  constraint campaign_review_entries_decided
    check ((state in ('published', 'rejected')) = (decided_by_account_id is not null)),
  constraint campaign_review_entries_decided_together
    check ((decided_by_account_id is null) = (decided_at is null)),
  constraint campaign_review_entries_decided_after check (decided_at >= created_at),
  constraint campaign_review_entries_rejection_reason
    check ((state = 'rejected') = (rejection_reason_code is not null)),
  -- 09 RG90: the message to the brand, on a refusal only, 20 to 500 printable characters
  constraint campaign_review_entries_member_message_rejected
    check (member_message is null or state = 'rejected'),
  constraint campaign_review_entries_member_message_length
    check (char_length(member_message) between 20 and 500),
  constraint campaign_review_entries_member_message_text
    check (member_message ~ '[^[:space:]]'
           and member_message !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- the internal comment, never sent to the brand, 1 000 printable characters at most
  constraint campaign_review_entries_internal_comment_length
    check (char_length(internal_comment) between 1 and 1000),
  constraint campaign_review_entries_internal_comment_text
    check (internal_comment ~ '[^[:space:]]'
           and internal_comment !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- modele §3: the first review is whole, its opinion a reasoned text of 20 to 1 000 characters
  constraint campaign_review_entries_first_review_together
    check (pg_catalog.num_nulls(first_reviewed_by_account_id, first_reviewed_at,
                                first_review_opinion) in (0, 3)),
  constraint campaign_review_entries_first_review_after check (first_reviewed_at >= created_at),
  constraint campaign_review_entries_first_review_opinion_length
    check (char_length(first_review_opinion) between 20 and 1000),
  constraint campaign_review_entries_first_review_opinion_text
    check (first_review_opinion ~ '[^[:space:]]'
           and first_review_opinion !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- 09 RG85, CA57: the decider is never the first reviewer
  constraint campaign_review_entries_two_persons
    check (decided_by_account_id <> first_reviewed_by_account_id),
  constraint campaign_review_entries_duplicate_other check (duplicate_of_campaign_id <> campaign_id),
  -- 15 RG27 C1 to C3: a claim is whole, its expiry after it
  constraint campaign_review_entries_claim_together
    check ((claimed_by_account_id is null) = (claimed_at is null)
           and (claimed_at is null) = (claim_expires_at is null)),
  constraint campaign_review_entries_claim_expiry check (claim_expires_at > claimed_at),
  -- 15 C4: the last forced release is whole
  constraint campaign_review_entries_forced_release_together
    check (pg_catalog.num_nulls(forced_release_at, forced_release_by_account_id,
                                forced_release_holder_account_id, forced_release_reason_code)
           in (0, 4)),
  constraint campaign_review_entries_sla_after check (sla_due_at >= created_at),
  constraint campaign_review_entries_escalate_after check (escalate_at >= sla_due_at)
);

-- D81 (1): at most one open entry per campaign
create unique index if not exists campaign_review_entries_one_open
  on campaigns.campaign_review_entries (campaign_id) where state = 'open';
-- queue 7 (15 RG26 C5: oldest deadline first, then creation)
create index if not exists campaign_review_entries_queue_idx
  on campaigns.campaign_review_entries (sla_due_at, created_at) where state = 'open';
-- the history of a campaign and of a brand
create index if not exists campaign_review_entries_campaign_idx
  on campaigns.campaign_review_entries (campaign_id, created_at);
create index if not exists campaign_review_entries_advertiser_idx
  on campaigns.campaign_review_entries (advertiser_account_id, created_at);

comment on table campaigns.campaign_review_entries is
  'Queue 7 (15 RG29 campaigns; 09 RG87 to RG97; l3c/modele.md §1): one entry per examination of a '
  'submitted campaign, at most one open (open <=> pending_review); the lock, the deadlines frozen at '
  'the entry, the first review, the decision (09 RG90), the duplicate alert (RG95). Opened by the '
  'submission door, claimed by 0307, decided by 0308. Read by the brand (its own: state, dates, '
  'reason, message) and by agent and admin in aal2 (never the opinion nor the comment).';
comment on column campaigns.campaign_review_entries.sla_due_at is
  'Decision deadline frozen at the entry: business_deadline(campaigns, created_at, 480, or '
  'campaign_enhanced_review_minutes for a sensitive sector; 15 RG37). Never recomputed.';
comment on column campaigns.campaign_review_entries.escalate_at is
  'Escalation frozen at the entry: greatest(delay, 480 + 960) business minutes of age (09 RG6).';
comment on column campaigns.campaign_review_entries.first_review_opinion is
  'Reasoned opinion of the first reviewer (09 RG85, 20 to 1 000): never to the brand, an e-mail, '
  'Brevo, the register nor the export; served to the holder of the second review only.';
comment on column campaigns.campaign_review_entries.internal_comment is
  'Comment of the agent (09 RG92): never shown to the brand, sent, written to the register nor exported.';
comment on column campaigns.campaign_review_entries.duplicate_of_campaign_id is
  '09 RG95 (modele -2): the alert written once by the submission door, never a refusal, never recomputed.';

drop trigger if exists campaign_review_entries_touch_updated_at on campaigns.campaign_review_entries;
create trigger campaign_review_entries_touch_updated_at
  before update on campaigns.campaign_review_entries
  for each row execute function influx.touch_updated_at();

create or replace function campaigns.prepare_campaign_review_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision   integer;
  v_escalate   integer;
  v_delay      integer;
  v_sensitive  boolean;
begin
  select p.target_decision_minutes, p.escalate_after_minutes
    into v_decision, v_escalate
    from backoffice.sla_policies p
   where p.queue_code = 'campaigns' and p.is_active;
  if not found then
    raise exception 'queue campaigns has no active delay policy'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- 15 RG37: two delays; the sensitivity of the sector read by join, never copied (RG84)
  select coalesce(s.is_sensitive, false) into v_sensitive
    from campaigns.campaigns c
    left join reference.sectors s on s.code = c.sector_code
   where c.id = new.campaign_id;
  if coalesce(v_sensitive, false) then
    select (o.value)::integer into v_delay
      from backoffice.operational_settings o
     where o.key = 'campaign_enhanced_review_minutes';
    if v_delay is null then
      raise exception 'campaign_enhanced_review_minutes is not set'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
  else
    v_delay := v_decision;
  end if;

  new.created_at  := pg_catalog.now();
  new.updated_at  := pg_catalog.now();
  new.sla_due_at  := backoffice.business_deadline('campaigns', new.created_at, v_delay);
  new.escalate_at := case when v_escalate is not null
                          then backoffice.business_deadline('campaigns', new.created_at,
                                                            greatest(v_delay, v_decision + v_escalate))
                     end;
  return new;
end
$$;

comment on function campaigns.prepare_campaign_review_entry() is
  'BEFORE INSERT on campaigns.campaign_review_entries (0307, modele §1): created_at = now(), '
  'sla_due_at and escalate_at computed ONCE from the policy of campaigns and, for a sensitive sector, '
  'campaign_enhanced_review_minutes (04 §5.6). 55000 without them. SECURITY INVOKER: the writer reads '
  'them with its own rights.';

revoke all on function campaigns.prepare_campaign_review_entry()
  from public, anon, authenticated, service_role;

drop trigger if exists campaign_review_entries_prepare on campaigns.campaign_review_entries;
create trigger campaign_review_entries_prepare
  before insert on campaigns.campaign_review_entries
  for each row execute function campaigns.prepare_campaign_review_entry();

-- 4. The two rules of the door (RG15, RG95; created by the migration role) ----------------------------

create or replace function campaigns.normalized_title(p_title text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.lower(p_title), '[^[:alnum:]]+', ' ',
                                                    'g'))
$$;

comment on function campaigns.normalized_title(text) is
  '09 RG95, modele §1 (0307, EC-L3C-02-5): the title compared by the duplicate alert, in lower case, '
  'every run of non-alphanumeric characters one space, the margins trimmed. IMMUTABLE, SECURITY '
  'INVOKER; EXECUTE for influx_campaign_definer.';

create or replace function campaigns.assert_live_campaign_cap(p_account_id uuid)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_cap   integer;
  v_live  text[];
begin
  -- one brand at a time: two submissions (or a submission and a publication, 0308) of the same
  -- brand count the live campaigns one after the other, until COMMIT
  perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended('campaigns.live_campaign_cap:' || p_account_id::text, 0));

  select (s.value)::integer into v_cap
    from backoffice.operational_settings s
   where s.key = 'campaign_live_cap';
  if v_cap is null then
    raise exception 'campaign_live_cap is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;

  select pg_catalog.array_agg(c.id::text order by c.submitted_at, c.id) into v_live
    from campaigns.campaigns c
   where c.advertiser_account_id = p_account_id
     and c.status in ('published', 'paused');
  if coalesce(pg_catalog.cardinality(v_live), 0) >= v_cap then
    raise exception 'live_campaign_cap'
      using errcode = 'object_not_in_prerequisite_state',
            detail = pg_catalog.array_to_string(v_live, ',');
  end if;
end
$$;

comment on function campaigns.assert_live_campaign_cap(uuid) is
  '09 RG15, CA10 (0307): the transaction advisory lock of the brand, then 55000 live_campaign_cap '
  '(DETAIL its published and paused campaigns, comma separated) once they reach campaign_live_cap. '
  'SECURITY INVOKER; EXECUTE for influx_campaign_definer (0308 adds the publication).';

revoke all on function campaigns.normalized_title(text)
  from public, anon, authenticated, service_role;
revoke all on function campaigns.assert_live_campaign_cap(uuid)
  from public, anon, authenticated, service_role;
grant execute on function campaigns.normalized_title(text),
                          campaigns.assert_live_campaign_cap(uuid)
   to influx_campaign_definer;

-- 5. Row level security and the rights of the business roles (modele §9) ----------------------------

alter table campaigns.campaign_review_entries enable row level security;
alter table campaigns.campaign_review_entries force row level security;
revoke all on campaigns.campaign_review_entries
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;

-- 5.1 The brand: its own entries, without the lock, the agents, the deadlines, the first review, the
-- duplicate alert nor the comment
grant select (id, campaign_id, advertiser_account_id, state, created_at, decided_at,
              rejection_reason_code, member_message, closed_at, updated_at)
   on campaigns.campaign_review_entries to influx_advertiser;

drop policy if exists campaign_review_entries_member_select_own on campaigns.campaign_review_entries;
create policy campaign_review_entries_member_select_own on campaigns.campaign_review_entries
  for select to influx_advertiser
  using (advertiser_account_id = (select influx.current_account_id()));

-- 5.2 Agent and admin in aal2: every column but the opinion and the internal comment (modele §9);
-- never an entry of their own account (15 RG36, C(3)); an open entry is hidden from its first
-- reviewer (modele §3, EC-L3C-02-7)
grant usage on schema campaigns to influx_agent, influx_admin;
grant select (id, campaign_id, advertiser_account_id, state, created_at, sla_due_at, escalate_at,
              claimed_by_account_id, claimed_at, claim_expires_at, forced_release_at,
              forced_release_by_account_id, forced_release_holder_account_id,
              forced_release_reason_code, first_reviewed_by_account_id, first_reviewed_at,
              decided_by_account_id, decided_at, rejection_reason_code, member_message,
              duplicate_of_campaign_id, closed_at, sla_breached, updated_at)
   on campaigns.campaign_review_entries to influx_agent, influx_admin;

drop policy if exists campaign_review_entries_internal_select on campaigns.campaign_review_entries;
create policy campaign_review_entries_internal_select on campaigns.campaign_review_entries
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and advertiser_account_id is distinct from (select influx.current_account_id())
         and not (state = 'open'
                  and first_reviewed_by_account_id = (select influx.current_account_id())));

-- 6. What influx_campaign_definer adds: the entry, RG15, RG95 (the caller's own rows) ---------------

grant usage on schema backoffice to influx_campaign_definer;

-- 6.1 The entry of its own campaign, opened only
grant select (id, campaign_id, advertiser_account_id, state),
      insert (campaign_id, advertiser_account_id, duplicate_of_campaign_id)
   on campaigns.campaign_review_entries to influx_campaign_definer;

drop policy if exists campaign_review_entries_campaign_definer_select
  on campaigns.campaign_review_entries;
create policy campaign_review_entries_campaign_definer_select on campaigns.campaign_review_entries
  for select to influx_campaign_definer
  using (advertiser_account_id = (select influx.current_account_id()));
drop policy if exists campaign_review_entries_campaign_definer_insert
  on campaigns.campaign_review_entries;
create policy campaign_review_entries_campaign_definer_insert on campaigns.campaign_review_entries
  for insert to influx_campaign_definer
  with check (advertiser_account_id = (select influx.current_account_id()) and state = 'open');

-- 6.2 What the trigger of the entry reads (invoker): the policy of queue 7, the enhanced delay, the
-- function of the deadline
grant select (queue_code, target_decision_minutes, escalate_after_minutes, business_hours, is_active)
   on backoffice.sla_policies to influx_campaign_definer;
drop policy if exists sla_policies_campaign_definer_select on backoffice.sla_policies;
create policy sla_policies_campaign_definer_select on backoffice.sla_policies
  for select to influx_campaign_definer
  using (queue_code = 'campaigns');

grant select (key, value) on backoffice.operational_settings to influx_campaign_definer;
drop policy if exists operational_settings_campaign_definer_select on backoffice.operational_settings;
create policy operational_settings_campaign_definer_select on backoffice.operational_settings
  for select to influx_campaign_definer
  using (key in ('campaign_enhanced_review_minutes', 'campaign_live_cap'));

grant execute on function backoffice.business_deadline(text, timestamptz, integer)
   to influx_campaign_definer;

-- 7. What influx_campaign_review_definer reads and writes (the queue) --------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner. The
-- functions check the caller themselves (agent or admin, aal2, active); the policies keep the rows
-- of the caller's own account out (15 RG36, C(3)) as a second line.

grant usage on schema campaigns, identity, backoffice, reference, audit, influx
   to influx_campaign_review_definer;
grant execute on function influx.current_account_id(),
                          influx.current_account_role(),
                          influx.current_aal(),
                          influx.has_aal2()
   to influx_campaign_review_definer;

-- 7.1 The caller (an active internal account) and the holder of the brand (15 RG36)
grant select (id, status, owner_agent_id) on identity.accounts to influx_campaign_review_definer;
grant select (account_id, role) on identity.account_roles to influx_campaign_review_definer;
grant select (account_id, is_active) on identity.agent_profiles to influx_campaign_review_definer;

drop policy if exists accounts_campaign_review_definer_select on identity.accounts;
create policy accounts_campaign_review_definer_select on identity.accounts
  for select to influx_campaign_review_definer
  using (true);
drop policy if exists account_roles_campaign_review_definer_select on identity.account_roles;
create policy account_roles_campaign_review_definer_select on identity.account_roles
  for select to influx_campaign_review_definer
  using (true);
drop policy if exists agent_profiles_campaign_review_definer_select on identity.agent_profiles;
create policy agent_profiles_campaign_review_definer_select on identity.agent_profiles
  for select to influx_campaign_review_definer
  using (true);

-- 7.2 The entries: the claim, the forced release, the first review read by the opening
grant select (id, campaign_id, advertiser_account_id, state, claimed_by_account_id, claimed_at,
              claim_expires_at, first_reviewed_by_account_id, first_reviewed_at,
              first_review_opinion)
   on campaigns.campaign_review_entries to influx_campaign_review_definer;
grant update (claimed_by_account_id, claimed_at, claim_expires_at, forced_release_at,
              forced_release_by_account_id, forced_release_holder_account_id,
              forced_release_reason_code)
   on campaigns.campaign_review_entries to influx_campaign_review_definer;

drop policy if exists campaign_review_entries_campaign_review_definer_select
  on campaigns.campaign_review_entries;
create policy campaign_review_entries_campaign_review_definer_select
  on campaigns.campaign_review_entries
  for select to influx_campaign_review_definer
  using (advertiser_account_id is distinct from (select influx.current_account_id()));
-- USING without the state: FOR UPDATE of a closed entry still finds it (55000, not 42501)
drop policy if exists campaign_review_entries_campaign_review_definer_update
  on campaigns.campaign_review_entries;
create policy campaign_review_entries_campaign_review_definer_update
  on campaigns.campaign_review_entries
  for update to influx_campaign_review_definer
  using (advertiser_account_id is distinct from (select influx.current_account_id()))
  with check (advertiser_account_id is distinct from (select influx.current_account_id()));

grant select (code, is_active) on backoffice.claim_release_reasons to influx_campaign_review_definer;
drop policy if exists claim_release_reasons_campaign_review_definer_select
  on backoffice.claim_release_reasons;
create policy claim_release_reasons_campaign_review_definer_select
  on backoffice.claim_release_reasons
  for select to influx_campaign_review_definer
  using (true);

grant select (key, value) on backoffice.operational_settings to influx_campaign_review_definer;
drop policy if exists operational_settings_campaign_review_definer_select
  on backoffice.operational_settings;
create policy operational_settings_campaign_review_definer_select
  on backoffice.operational_settings
  for select to influx_campaign_review_definer
  using (key = 'claim_expiry_minutes');

-- 7.3 What the version token hashes (EC-L3C-02-2): the entry columns of the campaign, the
-- declaration of RG85, the sensitivity of the sector and the nine lists; never the suspended range
grant select (id, advertiser_account_id, title, campaign_type_code, public_summary, brief,
              internal_reference, product_description, sector_code, restrictions, product_is_sent,
              product_value_band_code, creator_keeps_product, shipping_costs_borne_by,
              usage_rights_code, usage_rights_duration_band, usage_rights_territory_scope,
              exclusivity_band, content_review_delay, audience_gender_code, currency,
              remuneration_kind, per_creator_budget_band_code, creators_wanted, total_budget_minor,
              applications_close_on, content_due_on, starts_on, ends_on, max_applications,
              authorizations_declaration_locale, authorizations_declaration_hash)
   on campaigns.campaigns to influx_campaign_review_definer;

drop policy if exists campaigns_campaign_review_definer_select on campaigns.campaigns;
create policy campaigns_campaign_review_definer_select on campaigns.campaigns
  for select to influx_campaign_review_definer
  using (advertiser_account_id is distinct from (select influx.current_account_id()));

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
    execute format('grant select (%s) on campaigns.%I to influx_campaign_review_definer',
                   l.columns, l.name);
    execute format('drop policy if exists %I on campaigns.%I',
                   l.name || '_campaign_review_definer_select', l.name);
    execute format('create policy %I on campaigns.%I for select to influx_campaign_review_definer '
                   'using (exists (select 1 from campaigns.campaigns c '
                   'where c.id = %I.campaign_id '
                   'and c.advertiser_account_id is distinct from (select influx.current_account_id())))',
                   l.name || '_campaign_review_definer_select', l.name, l.name);
  end loop;
end
$$;

grant select (code, is_sensitive) on reference.sectors to influx_campaign_review_definer;
drop policy if exists sectors_campaign_review_definer_select on reference.sectors;
create policy sectors_campaign_review_definer_select on reference.sectors
  for select to influx_campaign_review_definer
  using (true);

-- 7.4 The register, through audit.append(), granted by its owner (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_campaign_review_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 8. The functions of queue 7, as influx_campaign_review_definer (03 P7 rule 5) ----------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_review_definer', current_user);
end
$$;
grant create on schema campaigns to influx_campaign_review_definer;
set role influx_campaign_review_definer;

-- 8.1 The helpers (SECURITY INVOKER: they run with the rights of the function that calls them) ----

-- The caller: an active agent or admin (admin only when asked), active agent profile, aal2
create or replace function campaigns.require_campaign_agent(p_admin_only boolean)
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
     or (p_admin_only and v_role <> 'admin')
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

comment on function campaigns.require_campaign_agent(boolean) is
  'Returns the caller when he is an active account with the agent or admin role (admin only when '
  'asked), an active agent profile, in an aal2 transaction; 42501 forbidden otherwise (0307, the '
  'rule of profiles.require_review_agent). SECURITY INVOKER owned by influx_campaign_review_definer, '
  'NO grant: called by the functions of queue 7 only.';

-- The version token of queue 7 (modele §1, EC-L3C-02-2). STABLE: called inside a query, it reads the
-- snapshot of that query.
create or replace function campaigns.campaign_review_token(p_campaign_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'campaign', pg_catalog.jsonb_build_array(
                  c.title, c.campaign_type_code, c.public_summary, c.brief, c.internal_reference,
                  c.product_description, c.sector_code, c.restrictions, c.product_is_sent,
                  c.product_value_band_code, c.creator_keeps_product, c.shipping_costs_borne_by,
                  c.usage_rights_code, c.usage_rights_duration_band, c.usage_rights_territory_scope,
                  c.exclusivity_band, c.content_review_delay, c.audience_gender_code, c.currency,
                  c.remuneration_kind, c.per_creator_budget_band_code, c.creators_wanted,
                  c.total_budget_minor, c.applications_close_on, c.content_due_on, c.starts_on,
                  c.ends_on, c.max_applications),
    -- RG85: the declaration kept and the sensitivity of the sector, read by join
    'declaration', pg_catalog.jsonb_build_array(
                     c.authorizations_declaration_locale,
                     pg_catalog.encode(c.authorizations_declaration_hash, 'hex'),
                     (select s.is_sensitive from reference.sectors s where s.code = c.sector_code)),
    'key_messages', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(m.position, m.body)
                                                 order by m.position)
                       from campaigns.campaign_key_messages m where m.campaign_id = c.id),
    'deliverables', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                                                   d.slot, d.network_code, d.format_code, d.quantity)
                                                 order by d.slot)
                       from campaigns.campaign_deliverables d where d.campaign_id = c.id),
    'usage_territories', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(u.slot,
                                                                                   u.country_code)
                                                      order by u.slot)
                            from campaigns.campaign_usage_territories u where u.campaign_id = c.id),
    'audience_countries', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(a.slot,
                                                                                    a.country_code)
                                                       order by a.slot)
                             from campaigns.campaign_audience_countries a where a.campaign_id = c.id),
    'audience_languages', (select pg_catalog.jsonb_agg(l.language_code order by l.language_code)
                             from campaigns.campaign_audience_languages l where l.campaign_id = c.id),
    'audience_bands', (select pg_catalog.jsonb_agg(b.audience_band_code order by b.audience_band_code)
                         from campaigns.campaign_audience_bands b where b.campaign_id = c.id),
    'audience_age_bands', (select pg_catalog.jsonb_agg(g.age_band_code order by g.age_band_code)
                             from campaigns.campaign_audience_age_bands g where g.campaign_id = c.id),
    'topics', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(t.slot, t.topic_code)
                                           order by t.slot)
                 from campaigns.campaign_topics t where t.campaign_id = c.id),
    'requested_items', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(r.slot, r.item_code)
                                                    order by r.slot)
                          from campaigns.campaign_requested_items r where r.campaign_id = c.id)
  )::text, 'UTF8')), 'hex')
    from campaigns.campaigns c
   where c.id = p_campaign_id
$$;

comment on function campaigns.campaign_review_token(uuid) is
  'modele §1 (0307, EC-L3C-02-2): SHA-256 hex of the version of a campaign examined in queue 7: its '
  'entry columns, the declaration of RG85, the sensitivity of its sector, its nine lists. Never the '
  'state, the cycle nor the suspended range. 55000 stale_token at a decision when it changed (0308). '
  'SECURITY INVOKER owned by influx_campaign_review_definer, no EXECUTE.';

-- The gate of every act on a held entry of queue 7 (extension here; decisions in 0308)
create or replace function campaigns.lock_held_campaign_review_entry(p_entry_id uuid, p_caller uuid)
returns table (
  campaign_id            uuid,
  advertiser_account_id  uuid,
  claimed_at             timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry  record;
begin
  select e.campaign_id, e.advertiser_account_id, e.state::text as state, e.claimed_by_account_id,
         e.claimed_at, e.claim_expires_at, e.first_reviewed_by_account_id
    into v_entry
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id
     for update;
  -- unknown, the caller's own account (the policy hides it), an account he HOLDS (15 RG36), the
  -- first reviewer at the second review (modele §1): one answer (T14)
  if not found or v_entry.advertiser_account_id = p_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_entry.advertiser_account_id and a.owner_agent_id = p_caller)
     or v_entry.first_reviewed_by_account_id = p_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- 09 RG88, 15 C2: no examination nor decision without the caller's live claim
  if v_entry.claimed_by_account_id is distinct from p_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  return query select v_entry.campaign_id, v_entry.advertiser_account_id, v_entry.claimed_at;
end
$$;

comment on function campaigns.lock_held_campaign_review_entry(uuid, uuid) is
  'The gate of the acts on a held entry of queue 7 (0307): the entry FOR UPDATE; 42501 (unknown, own '
  'account, held account, first reviewer), 55000 entry_closed, 55P03 no_live_claim (DETAIL the live '
  'holder or none). SECURITY INVOKER owned by influx_campaign_review_definer, no EXECUTE.';

-- 8.2 Opening = claiming (15 C1, C2; 09 RG88) --------------------------------------------------------
create or replace function campaigns.open_campaign_review_entry(p_entry_id uuid)
returns table (
  outcome                       text,
  holder_account_id             uuid,
  claimed_at                    timestamptz,
  claim_expires_at              timestamptz,
  review_token                  text,
  first_reviewed_by_account_id  uuid,
  first_reviewed_at             timestamptz,
  first_review_opinion          text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := campaigns.require_campaign_agent(false);
  v_entry     record;
  v_minutes   integer;
  v_outcome   text;
  v_holder    uuid;
  v_claimed   timestamptz;
  v_expires   timestamptz;
  v_token     text;
  v_opinion   text;
begin
  -- EC-L3C-02-3: the entry alone is locked, the campaign is frozen meanwhile
  select e.campaign_id, e.advertiser_account_id, e.state::text as state, e.claimed_by_account_id,
         e.claimed_at, e.claim_expires_at, e.first_reviewed_by_account_id, e.first_reviewed_at,
         e.first_review_opinion
    into v_entry
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id
     for update;
  -- unknown, or of the caller's own account (the policy hides it): 42501, one answer
  if not found or v_entry.advertiser_account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- 15 RG36: an open entry of an account the caller HOLDS is not his to examine; modele §3: an open
  -- entry is hidden from its first reviewer. A closed one answers `closed` as to anybody
  if v_entry.state = 'open'
     and (exists (select 1 from identity.accounts a
                   where a.id = v_entry.advertiser_account_id and a.owner_agent_id = v_caller)
          or v_entry.first_reviewed_by_account_id = v_caller) then
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
    update campaigns.campaign_review_entries e
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
                               'queue_code', 'campaigns',
                               'holder_account_id', v_entry.claimed_by_account_id,
                               'claimed_at', v_entry.claimed_at,
                               'expired_at', v_entry.claim_expires_at));
      end if;
    else
      -- 09 RG88, 15 C2: « déjà prise en charge par … », read only, never an error
      v_outcome := 'read_only';
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  end if;

  -- the version token and the opinion of the first review: to the holder only
  if v_outcome in ('claimed', 'held') then
    v_token   := campaigns.campaign_review_token(v_entry.campaign_id);
    v_opinion := v_entry.first_review_opinion;
  end if;

  -- 15 RG35: the opening is an act; last
  perform audit.append('queue.entry_opened', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'campaigns',
                                                     'outcome', v_outcome));
  return query
    select v_outcome, v_holder, v_claimed, v_expires, v_token,
           case when v_outcome <> 'closed' then v_entry.first_reviewed_by_account_id end,
           case when v_outcome <> 'closed' then v_entry.first_reviewed_at end,
           v_opinion;
end
$$;

comment on function campaigns.open_campaign_review_entry(uuid) is
  '09 RG88; 15 RG27 C1 to C3, RG35, RG36; modele §1 (0307): an agent or an admin opens an entry of '
  'queue 7: free or expired, claimed by an atomic conditional UPDATE for claim_expiry_minutes '
  '(queue.claim_expired first for an expired one); outcome claimed or held (with the token and the '
  'opinion), read_only (the live holder, 15 C2) or closed; queue.entry_opened {queue_code, outcome}. '
  '42501 for an unknown entry, the caller''s own account, an open entry of an account he holds or of '
  'which he gave the first review. SECURITY DEFINER; EXECUTE for influx_agent and influx_admin.';

-- 8.3 Release (15 C3, no comment) --------------------------------------------------------------------
create or replace function campaigns.release_campaign_review_entry(p_entry_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := campaigns.require_campaign_agent(false);
  v_entry   record;
begin
  select e.advertiser_account_id, e.state::text as state, e.claimed_by_account_id, e.claimed_at,
         e.claim_expires_at
    into v_entry
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id
     for update;
  -- an account the caller holds: he gives a claim back, never decides (0215)
  if not found or v_entry.advertiser_account_id = v_caller then
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

  update campaigns.campaign_review_entries e
     set claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
   where e.id = p_entry_id;

  perform audit.append('queue.claim_released', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'campaigns',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at));
end
$$;

comment on function campaigns.release_campaign_review_entry(uuid) is
  '15 RG27 C3 (0307): the holder of a live claim gives the entry back; queue.claim_released, no '
  'comment. 55P03 no_live_claim, 55000 entry_closed, 42501. SECURITY DEFINER; EXECUTE for '
  'influx_agent and influx_admin.';

-- 8.4 Extend (file.md A9) ------------------------------------------------------------------------------
create or replace function campaigns.extend_campaign_review_claim(p_entry_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := campaigns.require_campaign_agent(false);
  v_entry    record;
  v_minutes  integer;
  v_expires  timestamptz;
begin
  select * into v_entry from campaigns.lock_held_campaign_review_entry(p_entry_id, v_caller);

  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s
   where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update campaigns.campaign_review_entries e
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where e.id = p_entry_id
  returning e.claim_expires_at into v_expires;

  perform audit.append('queue.claim_extended', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'campaigns',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function campaigns.extend_campaign_review_claim(uuid) is
  'file.md A9 (0307): the holder of a live claim extends it to now() + claim_expiry_minutes; '
  'queue.claim_extended; returns the new expiry; the refusals of lock_held_campaign_review_entry(). '
  'SECURITY DEFINER; EXECUTE for influx_agent and influx_admin.';

-- 8.5 Forced release by an administrator (15 C4, file.md A8) -------------------------------------------
create or replace function campaigns.force_release_campaign_review_claim(
  p_entry_id     uuid,
  p_reason_code  text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := campaigns.require_campaign_agent(true);
  v_entry   record;
begin
  perform 1 from backoffice.claim_release_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;

  select e.advertiser_account_id, e.state::text as state, e.claimed_by_account_id,
         e.claim_expires_at
    into v_entry
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id
     for update;
  if not found or v_entry.advertiser_account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is null or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim' using errcode = 'lock_not_available', detail = 'none';
  end if;

  update campaigns.campaign_review_entries e
     set claimed_by_account_id            = null,
         claimed_at                       = null,
         claim_expires_at                 = null,
         forced_release_at                = pg_catalog.now(),
         forced_release_by_account_id     = v_caller,
         forced_release_holder_account_id = v_entry.claimed_by_account_id,
         forced_release_reason_code       = p_reason_code
   where e.id = p_entry_id;

  perform audit.append('queue.claim_forced_release', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'campaigns',
                                                     'holder_account_id', v_entry.claimed_by_account_id,
                                                     'reason_code', p_reason_code));
  return v_entry.claimed_by_account_id;
end
$$;

comment on function campaigns.force_release_campaign_review_claim(uuid, text) is
  '15 RG27 C4, file.md A8 (0307): an administrator lifts a live claim with a reason of '
  'backoffice.claim_release_reasons; queue.claim_forced_release; returns the holder. 22023 reason, '
  '55P03, 55000 entry_closed, 42501 outside an active admin in aal2. SECURITY DEFINER; EXECUTE for '
  'influx_agent and influx_admin (the function refuses the agent).';

do $$
declare
  f text;
begin
  foreach f in array array[
    'campaigns.require_campaign_agent(boolean)',
    'campaigns.campaign_review_token(uuid)',
    'campaigns.lock_held_campaign_review_entry(uuid, uuid)',
    'campaigns.open_campaign_review_entry(uuid)',
    'campaigns.release_campaign_review_entry(uuid)',
    'campaigns.extend_campaign_review_claim(uuid)',
    'campaigns.force_release_campaign_review_claim(uuid, text)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end
$$;

grant execute on function
  campaigns.open_campaign_review_entry(uuid),
  campaigns.release_campaign_review_entry(uuid),
  campaigns.extend_campaign_review_claim(uuid),
  campaigns.force_release_campaign_review_claim(uuid, text)
  to influx_agent, influx_admin;

reset role;
revoke create on schema campaigns from influx_campaign_review_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_review_definer', current_user);
end
$$;

-- 9. The freeze, a closed list of roles (modele §7; L3BS-2; pattern 0209) ---------------------------

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
      -- the brand's doors: the submission (0305) and the brand's passages (0309)
      when 'influx_campaign_definer' then
        v_status in ('draft', 'rejected')
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
  'modele §7, L3BS-2 (0307, recreated from 0303): BEFORE trigger on a campaign and its nine lists, a '
  'CLOSED list of roles: influx_advertiser (draft, rejected), influx_campaign_definer (the same, and '
  'the brand''s passages), influx_campaign_review_definer (the agent''s passages; a write in draft, '
  'rejected, pending_review), influx_maintenance_definer (-> closed); influx_privacy_definer and the '
  'migration role free; anything else 55000 campaign_not_editable. SECURITY INVOKER.';

revoke all on function campaigns.guard_campaign_member_write()
  from public, anon, authenticated, service_role;

-- 10. The submission door, recreated at the same signature (modele §7; 09 RG15, RG95) ---------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_definer', current_user);
end
$$;
grant create on schema campaigns to influx_campaign_definer;
set role influx_campaign_definer;

create or replace function campaigns.submit_own_campaign(
  p_campaign_id         uuid,
  p_declaration_locale  text default null
)
returns table (
  status        text,
  submitted_at  timestamptz,
  changed       boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- the account comes from the transaction context (03 P2), never a parameter
  v_account    uuid := influx.current_account_id();
  v_status     text;
  v_at         timestamptz;
  v_sector     text;
  v_title      text;
  v_starts     date;
  v_ends       date;
  v_profile    text;
  v_missing    text[];
  v_sensitive  boolean;
  v_hash       bytea;
  v_payload    jsonb;
  v_duplicate  uuid;
begin
  -- (1) an active advertiser, his own campaign; an unknown one answers the same (T14)
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'
     or not exists (select 1 from identity.accounts a
                     where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- (2) the row lock serialises two submissions (double click, second tab) and the brand's writes
  -- (the freeze reads the campaign FOR SHARE): the second one reads what the first one committed
  select c.status::text, c.submitted_at, c.sector_code, c.title, c.starts_on, c.ends_on
    into v_status, v_at, v_sector, v_title, v_starts, v_ends
    from campaigns.campaigns c
   where c.id = p_campaign_id and c.advertiser_account_id = v_account
     for update of c;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- submitted again while waiting: nothing written
  if v_status = 'pending_review' then
    return query select v_status, v_at, false;
    return;
  end if;
  -- RG5: published, paused and closed are left by INFLUX only
  if v_status not in ('draft', 'rejected') then
    raise exception 'campaign_not_submittable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_status;
  end if;

  -- (3) CA2: the brand profile is published
  select p.status::text into v_profile
    from profiles.advertiser_profiles p
   where p.account_id = v_account;
  if v_profile is distinct from 'published' then
    raise exception 'profile_not_published'
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_not_published';
  end if;

  -- (4) RG4, CA3: every missing field named, in the order of the form
  v_missing := campaigns.campaign_missing_required_fields(campaigns.campaign_input(p_campaign_id));
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'required_fields_missing'
      using errcode = 'check_violation', detail = pg_catalog.array_to_string(v_missing, ',');
  end if;

  -- (5) RG84, RG85: a sensitive sector, read by join, asks the declaration ticked in fr or en; the
  -- hash of the exact text shown is kept with its locale, its author and its instant
  select s.is_sensitive into v_sensitive
    from reference.sectors s
   where s.code = v_sector;
  v_sensitive := coalesce(v_sensitive, false);
  if v_sensitive then
    select t.body_sha256 into v_hash
      from campaigns.authorization_declaration_texts t
     where t.locale = p_declaration_locale;
    if v_hash is null then
      raise exception 'authorizations_declaration'
        using errcode = 'check_violation', detail = 'authorizations_declaration';
    end if;
  end if;

  -- (6) RG15, CA10: the brand's advisory lock, then its published and paused campaigns counted
  -- (55000 live_campaign_cap, DETAIL the campaigns to close)
  perform campaigns.assert_live_campaign_cap(v_account);

  -- (7) RG95, CA62: the last published or paused campaign of the brand with the same normalized
  -- title and an overlapping period; an alert carried by the entry, never a refusal
  select c.id into v_duplicate
    from campaigns.campaigns c
   where c.advertiser_account_id = v_account
     and c.id <> p_campaign_id
     and c.status in ('published', 'paused')
     and campaigns.normalized_title(c.title) = campaigns.normalized_title(v_title)
     and c.starts_on <= v_ends
     and c.ends_on >= v_starts
   order by c.submitted_at desc nulls last, c.id desc
   limit 1;

  -- (8) the state, the instant and the declaration (emptied for a sector that is not sensitive)
  update campaigns.campaigns c
     set status = 'pending_review',
         submitted_at = pg_catalog.now(),
         authorizations_declared_at = case when v_sensitive then pg_catalog.now() end,
         authorizations_declared_by_account_id = case when v_sensitive then v_account end,
         authorizations_declaration_locale = case when v_sensitive then p_declaration_locale end,
         authorizations_declaration_hash = v_hash
   where c.id = p_campaign_id
  returning c.submitted_at into v_at;

  -- (9) queue 7: a new open entry (a rejected campaign submitted again gets a new one); its
  -- deadlines are frozen by its trigger (1 business day, 2 in enhanced review)
  insert into campaigns.campaign_review_entries
    (campaign_id, advertiser_account_id, duplicate_of_campaign_id)
  values (p_campaign_id, v_account, v_duplicate);

  v_payload := pg_catalog.jsonb_build_object('from_status', v_status);
  if v_sensitive then
    v_payload := v_payload || pg_catalog.jsonb_build_object(
                   'declaration_locale', p_declaration_locale,
                   'declaration_hash', pg_catalog.encode(v_hash, 'hex'));
  end if;
  -- The register, in the transaction of the fact; last: the chain lock is held until COMMIT
  -- (04 §7.2).
  perform audit.append('campaign.submitted', 'campaign', p_campaign_id, v_payload);
  return query select 'pending_review'::text, v_at, true;
end
$$;

comment on function campaigns.submit_own_campaign(uuid, text) is
  '09 RG4, RG5, RG15, RG84, RG85, RG95, CA2, CA3, CA10, CA62 (0305, recreated by 0307 at the same '
  'signature): the brand submits its draft or rejected campaign. The refusals of 0305 (42501 '
  'forbidden, 55000 campaign_not_submittable, profile_not_published, 23514 required_fields_missing, '
  'authorizations_declaration), then 55000 live_campaign_cap (DETAIL the campaigns to close) under '
  'the brand''s advisory lock; in ONE transaction, the declaration, pending_review, submitted_at, a '
  'new open entry of queue 7 (duplicate_of_campaign_id, RG95) and campaign.submitted. Already '
  'pending_review: nothing written, changed false. SECURITY DEFINER owned by '
  'influx_campaign_definer; EXECUTE for influx_advertiser only.';

reset role;
revoke create on schema campaigns from influx_campaign_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_definer', current_user);
end
$$;

-- 11. One open entry for every campaign already pending_review (modele -1, EC-L3C-02-1) -------------

insert into campaigns.campaign_review_entries (campaign_id, advertiser_account_id)
select c.id, c.advertiser_account_id
  from campaigns.campaigns c
 where c.status = 'pending_review'
   and not exists (select 1 from campaigns.campaign_review_entries e
                    where e.campaign_id = c.id and e.state = 'open');

-- 12. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  v_def  record;
  v_bad  text;
begin
  -- 03 P7: NOLOGIN NOINHERIT, no member, member of nothing, no attribute (C-9 tolerated)
  if not exists (select 1 from pg_catalog.pg_roles
                  where rolname = 'influx_campaign_review_definer' and not rolcanlogin
                    and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb
                    and not rolcreaterole and not rolreplication)
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.member = 'influx_campaign_review_definer'::regrole
                    or (m.roleid = 'influx_campaign_review_definer'::regrole
                        and (m.inherit_option or m.set_option))) then
    raise exception 'influx_campaign_review_definer must be NOLOGIN NOINHERIT, without member nor membership';
  end if;

  -- the functions of queue 7: SECURITY DEFINER, their owner, empty search_path, EXECUTE for agent
  -- and admin only; the three helpers: SECURITY INVOKER, EXECUTE for nobody
  for v_def in
    select * from (values
      ('campaigns.open_campaign_review_entry(uuid)', true),
      ('campaigns.release_campaign_review_entry(uuid)', true),
      ('campaigns.extend_campaign_review_claim(uuid)', true),
      ('campaigns.force_release_campaign_review_claim(uuid, text)', true),
      ('campaigns.require_campaign_agent(boolean)', false),
      ('campaigns.campaign_review_token(uuid)', false),
      ('campaigns.lock_held_campaign_review_entry(uuid, uuid)', false)
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

  -- the door: unchanged owner, mode and grant (0305)
  if (select p.proowner <> 'influx_campaign_definer'::regrole or not p.prosecdef
             or p.proconfig is distinct from array['search_path=""']
        from pg_catalog.pg_proc p
       where p.oid = 'campaigns.submit_own_campaign(uuid, text)'::regprocedure) then
    raise exception 'campaigns.submit_own_campaign() with a wrong owner or mode';
  end if;
  -- the rules of the door and the trigger: SECURITY INVOKER, empty search_path, executed by the
  -- owner of the door only (the trigger by nobody)
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('campaigns.normalized_title(text)'::regprocedure,
                   'campaigns.assert_live_campaign_cap(uuid)'::regprocedure,
                   'campaigns.prepare_campaign_review_entry()'::regprocedure,
                   'campaigns.guard_campaign_member_write()'::regprocedure)
     and (p.prosecdef or p.proconfig is distinct from array['search_path=""']
          or exists (select 1
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                                                           pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                        and (a.grantee = 0
                             or a.grantee <> 'influx_campaign_definer'::regrole
                             or p.oid in ('campaigns.prepare_campaign_review_entry()'::regprocedure,
                                          'campaigns.guard_campaign_member_write()'::regprocedure))));
  if v_bad is not null then
    raise exception 'rules of queue 7 with a wrong mode or grant: %', v_bad;
  end if;

  -- L2DS-5 extended (modele §4, fiche invariant 10): no dynamic SQL in a function owned by the owner
  -- of the door or of the queue
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner in ('influx_campaign_definer'::regrole,
                        'influx_campaign_review_definer'::regrole)
     and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic SQL in a function of a campaign owner: %', v_bad;
  end if;

  -- invariant 1 (RG5): neither the brand, its door owner nor the creator executes a function of queue
  -- 7; the owner of the queue writes no campaign nor list here
  select string_agg(r || ' on ' || p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p,
         unnest(array['influx_advertiser', 'influx_campaign_definer', 'influx_creator',
                      'influx_identity_definer']) r
   where p.proowner = 'influx_campaign_review_definer'::regrole
     and pg_catalog.has_function_privilege(r, p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'EXECUTE on a function of queue 7: %', v_bad;
  end if;
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'campaigns' and c.relkind in ('r', 'p')
     and c.relname <> 'campaign_review_entries'
     and (pg_catalog.has_table_privilege('influx_campaign_review_definer', c.oid,
                                         'INSERT, UPDATE, DELETE')
          or pg_catalog.has_any_column_privilege('influx_campaign_review_definer', c.oid,
                                                 'INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'influx_campaign_review_definer writes a campaign or a list before 0308: %', v_bad;
  end if;

  -- fiche invariant 4 (« colonnes d'agent sans droit membre »): the brand reads neither the lock,
  -- the agents, the deadlines, the first review, the duplicate alert nor the comment, and writes
  -- nothing; the creator holds nothing on the schema
  select string_agg(at.attname, ', ') into v_bad
    from pg_catalog.pg_attribute at
   where at.attrelid = 'campaigns.campaign_review_entries'::regclass and at.attnum > 0
     and not at.attisdropped
     and pg_catalog.has_column_privilege('influx_advertiser', at.attrelid, at.attnum, 'SELECT')
     and at.attname not in ('id', 'campaign_id', 'advertiser_account_id', 'state', 'created_at',
                            'decided_at', 'rejection_reason_code', 'member_message', 'closed_at',
                            'updated_at');
  if v_bad is not null
     or pg_catalog.has_any_column_privilege('influx_advertiser', 'campaigns.campaign_review_entries',
                                            'INSERT, UPDATE')
     or pg_catalog.has_table_privilege('influx_advertiser', 'campaigns.campaign_review_entries',
                                       'DELETE') then
    raise exception 'influx_advertiser reaches an agent column of queue 7: %', v_bad;
  end if;
  if exists (select 1 from unnest(array['influx_agent', 'influx_admin']) r,
                          unnest(array['first_review_opinion', 'internal_comment']) c
              where pg_catalog.has_column_privilege(r, 'campaigns.campaign_review_entries', c,
                                                    'SELECT')) then
    raise exception 'agent or admin reads the opinion or the internal comment of queue 7';
  end if;
  if pg_catalog.has_schema_privilege('influx_creator', 'campaigns', 'USAGE')
     or pg_catalog.has_any_column_privilege('influx_creator', 'campaigns.campaign_review_entries',
                                            'SELECT, INSERT, UPDATE') then
    raise exception 'influx_creator reaches the schema campaigns (TM5.6)';
  end if;

  -- the new table: RLS enabled and forced (T2.4 checks the Data API roles)
  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'campaigns.campaign_review_entries'::regclass) then
    raise exception 'campaigns.campaign_review_entries is not protected';
  end if;

  -- 15 RG26: queue 7 and exactly one active policy; the three settings
  if not exists (select 1 from backoffice.queues q
                   join backoffice.sla_policies p on p.queue_code = q.code and p.is_active
                  where q.code = 'campaigns')
     or (select count(*) from backoffice.operational_settings
          where key in ('campaign_enhanced_review_minutes', 'campaign_live_cap',
                        'campaign_auto_close_days')) <> 3 then
    raise exception 'queue 7, its policy or the settings of the campaigns are missing';
  end if;

  -- modele -1: every pending_review campaign has its open entry, and only they
  if exists (select 1 from campaigns.campaigns c
              where (c.status = 'pending_review')
                    <> exists (select 1 from campaigns.campaign_review_entries e
                                where e.campaign_id = c.id and e.state = 'open')) then
    raise exception 'an open entry of queue 7 does not match a pending_review campaign';
  end if;

  -- the owner left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid in ('influx_campaign_review_definer'::regrole,
                                 'influx_campaign_definer'::regrole)
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege('influx_campaign_review_definer', 'campaigns', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_campaign_definer', 'campaigns', 'CREATE') then
    raise exception 'a campaign owner left with a member or CREATE on campaigns';
  end if;
end
$$;
