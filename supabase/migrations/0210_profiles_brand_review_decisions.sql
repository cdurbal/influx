-- =============================================================================
-- 0210_profiles_brand_review_decisions
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 07 (jalons/l2c/file.md A3, A5, A7 to A9, "Fonctions", "Codes", D81; 04 §5.2,
-- l. 2465-2480; 06 RG6, RG9, RG10, RG63 to RG69, RG78; 15 RG27 C1 to C8, RG35, RG36). An agent or an
-- admin opens an entry of queue 1 (opening = claiming), releases or extends his claim, an admin lifts
-- an orphan claim, and the holder publishes or refuses with a typed reason. No route (11, 12), no
-- connector (09, 10), no screen.
--
--   influx_moderation_definer   NOLOGIN NOINHERIT, no member (file.md A5): owns the six decision
--         functions below, EXECUTE to influx_agent and influx_admin. It writes the state and the
--         moderated fields of somebody else's profile, which influx_identity_definer (bound to the
--         caller's row) never does: kept apart, a member door can never reach a publication (RG6).
--         The member guard of 0209 does not stop it (current_user is not a member role).
--   backoffice.claim_release_reasons   the closed list of a forced release (file.md A8): the
--         foreign key of advertiser_review_entries.forced_release_reason_code (EC-L2C-05-2).
--   profiles.advertiser_profiles.first_published_at   the first publication, written once: the one
--         profile.completed of 06 RG78.
--   profiles.open_advertiser_review_entry(entry)   15 C1, C2: a free entry, or one whose claim has
--         expired, is claimed by an atomic conditional UPDATE (04 l. 2465-2480: the condition IS the
--         lock, the row count the answer); the caller's own live claim is `held`; somebody else's
--         `read_only` with the holder; a closed entry `closed`. The version token rendered with a
--         claim. An expired claim taken over writes queue.claim_expired first (file.md A9).
--   release_ / extend_advertiser_review_claim, force_release_advertiser_review_claim (admin, typed
--         reason, 15 C3, C4).
--   publish_ / reject_advertiser_review_entry   the holder of a live claim, the token unchanged, the
--         profile row locked FOR UPDATE BEFORE the token is computed (a member write waits or is
--         seen); publish applies the revisions in the transaction (RG9: in_review logo -> active,
--         the previous active -> purging), recontrols the required fields, publishes; reject closes
--         the revisions `rejected`, purges the in_review logo, and gives a submission back to the
--         brand (`rejected`, RG10); a revision refused leaves the profile published (file.md A2).
--         In the same transaction: the register line, profile.decision (brevo_transactional) and,
--         on a publication, profile.completed the first time, lead.updated afterwards (RG78).
--   profiles.normalized_brand_name(text), advertiser_duplicate_candidates(...)   RG25, RG70 in SQL
--         only (file.md A7): computed at the read, nothing stored; agent and admin.
--   backoffice.record_refused_action()   recreated by its owner as in 0148 with one more code,
--         queue.force_release_claim: an agent's attempt at a forced release (file.md "Codes").
--
-- Refusals (file.md "Fonctions"): 42501 unknown entry, own account (C(3)), role, aal; 55P03 no live
-- claim of the caller (DETAIL: the live holder, or `none`); 55000 DETAIL `entry_closed`,
-- `stale_token` or `profile_state`; 23514 a required field missing (DETAIL its code) or a column
-- constraint of an approved value; 22023 DETAIL `reason`, `member_message` or `internal_comment`.
--
-- EC-L2C-07 (micro-gaps, the safest choice):
--   EC-L2C-07-1  0210 is the next free number (ls supabase/migrations).
--   EC-L2C-07-2  business_deadline() is NOT granted to influx_moderation_definer: no decision function
--                creates an entry (the deadlines are written by the trigger of the insert, by the
--                member doors). Least privilege (03 P7); tm3 keeps its single caller.
--   EC-L2C-07-3  open on a closed entry answers `closed` and is journalled like any opening (the
--                decision view shows the contact person, L2BS-7); no token, no holder.
--   EC-L2C-07-4  the holder re-opening his live claim gets `held`, the expiry unchanged: extending is
--                its own journalled act (A9).
--   EC-L2C-07-5  an admin may lift his own live claim (reason required, traced): harmless, and
--                refusing it would add a code.
--   EC-L2C-07-6  a submission is decided on a `pending_review` profile, a revision on a `published`
--                one; anything else (a suspension of Lot 5) is 55000 `profile_state`.
--   EC-L2C-07-7  an internal comment is 1 to 1 000 printable characters, refused otherwise (22023),
--                never trimmed; a member message given for a reason that does not ask for one is
--                refused (22023), file.md A6 "pour other seul".
--   EC-L2C-07-8  a withdrawal by the member door (0209) of an entry whose claim has expired writes no
--                queue.claim_expired: the door belongs to influx_identity_definer, which writes no
--                queue code; the next opening of another entry is not concerned.
--   EC-L2C-07-9  first_published_at carries no CHECK against `published`: the fixtures of earlier
--                tests set the status directly; the decision is its only writer.
--
-- ROLLBACK (before any decision is written): drop the six functions of section 7 and
-- profiles.require_review_agent(boolean); drop function profiles.advertiser_duplicate_candidates(uuid,
-- text, text), profiles.normalized_brand_name(text); recreate backoffice.record_refused_action() as
-- in 0148 (as influx_identity_definer); drop the policies *_moderation_definer_* and revoke the
-- grants of section 5; revoke execute on profiles.advertiser_review_token(uuid) and
-- profiles.advertiser_missing_required_fields(jsonb) from influx_moderation_definer; drop constraint
-- advertiser_review_entries_forced_release_reason_fk; drop table backoffice.claim_release_reasons;
-- alter table profiles.advertiser_profiles drop column first_published_at; delete the codes of
-- section 4 (possible only while no line references them); then drop owned by
-- influx_moderation_definer; drop role influx_moderation_definer.
-- =============================================================================

-- 1. The owner of the decisions (03 P7 rule 5; rules 1 and 2 of 0001; file.md A5) ---------------------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_moderation_definer') then
    create role influx_moderation_definer with nologin noinherit;
  end if;
  alter role influx_moderation_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_moderation_definer' and rolsuper) then
    raise exception 'role influx_moderation_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_moderation_definer' and rolbypassrls) then
    alter role influx_moderation_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_moderation_definer' and rolreplication) then
    alter role influx_moderation_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_moderation_definer' and rolcreatedb) then
    alter role influx_moderation_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_moderation_definer' and rolcreaterole) then
    alter role influx_moderation_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. The first publication (06 RG78) ------------------------------------------------------------------

alter table profiles.advertiser_profiles
  add column if not exists first_published_at timestamptz;

comment on column profiles.advertiser_profiles.first_published_at is
  'Instant of the FIRST publication by an agent or an admin (06 RG6, RG78), written once by '
  'profiles.publish_advertiser_review_entry() (0210): its absence makes the publication emit '
  'profile.completed, its presence lead.updated. NULL while never published (EC-L2C-07-9).';

-- 3. backoffice.claim_release_reasons (file.md A8; 15 C4) ---------------------------------------------

create table if not exists backoffice.claim_release_reasons (
  code       text    not null primary key,
  label_key  text    not null,
  is_active  boolean not null default true,

  constraint claim_release_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint claim_release_reasons_label_key check (label_key = 'reason.claim_release.' || code)
);

comment on table backoffice.claim_release_reasons is
  'The closed list of the reasons of a forced release of a claim by an administrator (15 RG27 C4, '
  'file.md A8): holder_absent, overdue_entry, wrong_claim. Common to the queues with a lock. Read by '
  'agent and admin in aal2; written by the migrations.';
comment on column backoffice.claim_release_reasons.label_key is
  'Translation key of the reason in the backoffice: reason.claim_release.<code>.';

insert into backoffice.claim_release_reasons (code, label_key) values
  ('holder_absent', 'reason.claim_release.holder_absent'),
  ('overdue_entry', 'reason.claim_release.overdue_entry'),
  ('wrong_claim',   'reason.claim_release.wrong_claim')
on conflict (code) do nothing;

alter table backoffice.claim_release_reasons enable row level security;
alter table backoffice.claim_release_reasons force  row level security;
revoke all on backoffice.claim_release_reasons from public, anon, authenticated, service_role;

grant select on backoffice.claim_release_reasons to influx_agent, influx_admin;

drop policy if exists claim_release_reasons_internal_select on backoffice.claim_release_reasons;
create policy claim_release_reasons_internal_select on backoffice.claim_release_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- EC-L2C-05-2: the key 0207 could not carry yet
alter table profiles.advertiser_review_entries
  drop constraint if exists advertiser_review_entries_forced_release_reason_fk,
  add constraint advertiser_review_entries_forced_release_reason_fk
    foreign key (forced_release_reason_code) references backoffice.claim_release_reasons (code);

-- 4. The codes of the register and of the queue (file.md "Codes") -------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 06 RG69: a decision, nominative; payload entry_id, kind, fields or reason_code, late
  ('profile.published',          'profiles',   'advertiser_profile', 'sensitive'),
  ('profile.rejected',           'profiles',   'advertiser_profile', 'sensitive'),
  -- 15 RG35, L2BS-7: the opening shows the contact person; payload queue_code, outcome
  ('queue.entry_opened',         'backoffice', 'queue_entry',        'sensitive'),
  -- 15 C4, 04 §4.3 (brought forward from Lot 4): payload queue_code, holder_account_id, reason_code
  ('queue.claim_forced_release', 'backoffice', 'queue_entry',        'sensitive'),
  -- 15 C3, file.md A9: payload queue_code, holder_account_id, claimed_at (and expired_at, or the
  -- new claim_expires_at)
  ('queue.claim_released',       'backoffice', 'queue_entry',        'info'),
  ('queue.claim_extended',       'backoffice', 'queue_entry',        'info'),
  ('queue.claim_expired',        'backoffice', 'queue_entry',        'info'),
  -- the queue only (never a register line): the lead of 06 RG78 and the decision e-mail (09)
  ('profile.completed',          'leads',      'account',            'info'),
  ('profile.decision',           'profiles',   'queue_entry',        'info')
on conflict (code) do nothing;

-- 5. What the owner of the decisions reads and writes ---------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner. The
-- functions check the caller themselves (agent or admin, aal2, active); the policies keep the rows
-- of the caller's own account out (15 RG36, C(3)) as a second line.

grant usage on schema profiles, identity, backoffice, leads, audit, influx
   to influx_moderation_definer;
grant execute on function influx.current_account_id(),
                          influx.current_account_role(),
                          influx.current_aal(),
                          influx.has_aal2()
   to influx_moderation_definer;

-- 5.1 The caller: an active internal account (identity, 0004)
grant select (id, status, country_code) on identity.accounts to influx_moderation_definer;
grant select (account_id, role) on identity.account_roles to influx_moderation_definer;
grant select (account_id, is_active) on identity.agent_profiles to influx_moderation_definer;

drop policy if exists accounts_moderation_definer_select on identity.accounts;
create policy accounts_moderation_definer_select on identity.accounts
  for select to influx_moderation_definer
  using (true);
drop policy if exists account_roles_moderation_definer_select on identity.account_roles;
create policy account_roles_moderation_definer_select on identity.account_roles
  for select to influx_moderation_definer
  using (true);
drop policy if exists agent_profiles_moderation_definer_select on identity.agent_profiles;
create policy agent_profiles_moderation_definer_select on identity.agent_profiles
  for select to influx_moderation_definer
  using (true);

-- 5.2 The entries: the claim, the forced release, the decision
grant select (id, account_id, kind, state, claimed_by_account_id, claimed_at, claim_expires_at,
              decided_at, sla_breached)
   on profiles.advertiser_review_entries to influx_moderation_definer;
grant update (claimed_by_account_id, claimed_at, claim_expires_at, forced_release_at,
              forced_release_by_account_id, forced_release_holder_account_id,
              forced_release_reason_code, state, decided_by_account_id, decided_at,
              rejection_reason_code, member_message, internal_comment, closed_at)
   on profiles.advertiser_review_entries to influx_moderation_definer;

drop policy if exists advertiser_review_entries_moderation_definer_select
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_moderation_definer_select
  on profiles.advertiser_review_entries
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));

-- USING without the state: FOR UPDATE of a closed entry still finds it (55000, not 42501)
drop policy if exists advertiser_review_entries_moderation_definer_update
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_moderation_definer_update
  on profiles.advertiser_review_entries
  for update to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (account_id is distinct from (select influx.current_account_id()));

-- 5.3 The revisions: applied or refused, never anything else
grant select (id, account_id, field_code, row_key, proposed_value, status,
              advertiser_review_entry_id)
   on profiles.profile_field_revisions to influx_moderation_definer;
grant update (status, closed_at) on profiles.profile_field_revisions to influx_moderation_definer;

drop policy if exists profile_field_revisions_moderation_definer_select
  on profiles.profile_field_revisions;
create policy profile_field_revisions_moderation_definer_select on profiles.profile_field_revisions
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));

drop policy if exists profile_field_revisions_moderation_definer_update
  on profiles.profile_field_revisions;
create policy profile_field_revisions_moderation_definer_update on profiles.profile_field_revisions
  for update to influx_moderation_definer
  using (status = 'pending_review'
         and account_id is distinct from (select influx.current_account_id()))
  with check (status in ('approved', 'rejected'));

-- 5.4 The profile: what the token hashes, the moderated columns, the state
grant select (account_id, status, first_published_at, legal_name, primary_sector_code,
              company_size_band, website_domain, presentation, exclusivity_band,
              collaboration_rhythm, offers_non_monetary, contact_role)
   on profiles.advertiser_profiles to influx_moderation_definer;
grant update (status, first_published_at, legal_name, presentation, website_domain, contact_role,
              primary_sector_code)
   on profiles.advertiser_profiles to influx_moderation_definer;

drop policy if exists advertiser_profiles_moderation_definer_select on profiles.advertiser_profiles;
create policy advertiser_profiles_moderation_definer_select on profiles.advertiser_profiles
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));

-- USING without the state: the row is locked FOR UPDATE before its state is read
drop policy if exists advertiser_profiles_moderation_definer_update on profiles.advertiser_profiles;
create policy advertiser_profiles_moderation_definer_update on profiles.advertiser_profiles
  for update to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (status in ('published', 'rejected'));

-- 5.5 The eight lists and the contact person: what the token hashes, read only
do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('advertiser_secondary_sectors',  'account_id, slot, sector_code'),
      ('advertiser_target_markets',     'account_id, slot, country_code'),
      ('advertiser_working_languages',  'account_id, language_code'),
      ('advertiser_topics',             'account_id, slot, topic_code'),
      ('advertiser_networks',           'account_id, network_code'),
      ('advertiser_formats',            'account_id, format_code'),
      ('advertiser_audience_countries', 'account_id, slot, country_code'),
      ('advertiser_usage_rights',       'account_id, usage_right_code'),
      ('advertiser_contact_details',
       'account_id, contact_first_name, contact_email, contact_phone, contact_url')
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

-- 5.6 The logos: the in_review one becomes active, the previous active one goes to purge
grant select (id, account_id, state) on profiles.brand_logo_objects to influx_moderation_definer;
grant update (state, activated_at, purge_requested_at)
   on profiles.brand_logo_objects to influx_moderation_definer;

drop policy if exists brand_logo_objects_moderation_definer_select on profiles.brand_logo_objects;
create policy brand_logo_objects_moderation_definer_select on profiles.brand_logo_objects
  for select to influx_moderation_definer
  using (account_id is distinct from (select influx.current_account_id()));

drop policy if exists brand_logo_objects_moderation_definer_update on profiles.brand_logo_objects;
create policy brand_logo_objects_moderation_definer_update on profiles.brand_logo_objects
  for update to influx_moderation_definer
  using (state in ('active', 'in_review')
         and account_id is distinct from (select influx.current_account_id()))
  with check (state in ('active', 'purging'));

-- 5.7 The catalogues and the claim expiry
grant select (code, requires_member_message, is_active)
   on profiles.advertiser_rejection_reasons to influx_moderation_definer;
drop policy if exists advertiser_rejection_reasons_moderation_definer_select
  on profiles.advertiser_rejection_reasons;
create policy advertiser_rejection_reasons_moderation_definer_select
  on profiles.advertiser_rejection_reasons
  for select to influx_moderation_definer
  using (true);

grant select (code, is_active) on backoffice.claim_release_reasons to influx_moderation_definer;
drop policy if exists claim_release_reasons_moderation_definer_select
  on backoffice.claim_release_reasons;
create policy claim_release_reasons_moderation_definer_select on backoffice.claim_release_reasons
  for select to influx_moderation_definer
  using (true);

grant select (key, value) on backoffice.operational_settings to influx_moderation_definer;
drop policy if exists operational_settings_moderation_definer_select
  on backoffice.operational_settings;
create policy operational_settings_moderation_definer_select on backoffice.operational_settings
  for select to influx_moderation_definer
  using (key = 'claim_expiry_minutes');

-- 5.8 The queue: the decision e-mail and the lead, in the transaction of the fact (05 RG73)
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_moderation_definer;

drop policy if exists outbox_events_moderation_definer_insert on leads.outbox_events;
create policy outbox_events_moderation_definer_insert on leads.outbox_events
  for insert to influx_moderation_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((event_type = 'profile.decision' and destination = 'brevo_transactional')
                   or (event_type in ('profile.completed', 'lead.updated')
                       and destination in ('brevo_contact', 'apollo_contact'))));

-- 5.9 The token (0207, invoker): the owner computes it with the rights above
grant execute on function profiles.advertiser_review_token(uuid) to influx_moderation_definer;

-- 5.10 The required fields (0203, invoker, owned by influx_identity_definer): granted by its owner
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
set role influx_identity_definer;
grant execute on function profiles.advertiser_missing_required_fields(jsonb)
   to influx_moderation_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5.11 The register, through audit.append() (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_moderation_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 6. RG25, RG70: duplicate brands, computed at the read (file.md A7) -----------------------------

create or replace function profiles.normalized_brand_name(p_name text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case when pg_catalog.char_length(s.n) >= 2 then s.n end
    from (select pg_catalog.regexp_replace(
                   pg_catalog.regexp_replace(
                     pg_catalog.normalize(pg_catalog.lower(p_name), 'NFKD'),
                     '[̀-ͯ]', '', 'g'),
                   '[[:space:][:punct:]]', '', 'g') as n) s
$$;

comment on function profiles.normalized_brand_name(text) is
  '06 RG25, file.md A7: the comparison form of a brand name: lower case, NFKD, without the combining '
  'marks U+0300 to U+036F, the spaces nor the punctuation; NULL below two characters (or for NULL). '
  'IMMUTABLE, SECURITY INVOKER; EXECUTE for influx_agent and influx_admin.';

revoke all on function profiles.normalized_brand_name(text)
  from public, anon, authenticated, service_role;
grant execute on function profiles.normalized_brand_name(text) to influx_agent, influx_admin;

create or replace function profiles.advertiser_duplicate_candidates(
  p_account_id      uuid,
  p_brand_name      text,
  p_website_domain  text
)
returns table (
  account_id  uuid,
  matched_on  text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.account_id, c.matched_on
    from (select p.account_id, 'brand_name'::text as matched_on
            from profiles.advertiser_profiles p
           where p.status = 'published'
             and p.account_id is distinct from p_account_id
             and profiles.normalized_brand_name(p_brand_name) is not null
             and profiles.normalized_brand_name(p.legal_name)
                 = profiles.normalized_brand_name(p_brand_name)
          union
          select p.account_id, 'domain'::text
            from profiles.advertiser_profiles p
           where p.status = 'published'
             and p.account_id is distinct from p_account_id
             and pg_catalog.btrim(coalesce(p_website_domain, '')) <> ''
             and pg_catalog.lower(p.website_domain) = pg_catalog.lower(pg_catalog.btrim(p_website_domain))
         ) c
   order by c.matched_on, c.account_id
   limit 5
$$;

comment on function profiles.advertiser_duplicate_candidates(uuid, text, text) is
  '06 RG25, RG70, file.md A7: the PUBLISHED brand profiles of other accounts whose normalised name '
  '(profiles.normalized_brand_name) or website domain (case aside) equal those given: (account_id, '
  'matched_on brand_name | domain), five at most. An alert for the agent, never a refusal; nothing '
  'is stored. SECURITY INVOKER: the caller reads the profiles with his own rights (agent, admin in '
  'aal2); EXECUTE for influx_agent and influx_admin.';

revoke all on function profiles.advertiser_duplicate_candidates(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function profiles.advertiser_duplicate_candidates(uuid, text, text)
   to influx_agent, influx_admin;

-- 7. The decisions, as influx_moderation_definer (03 P7 rule 5) ----------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_moderation_definer', current_user);
end
$$;
grant create on schema profiles to influx_moderation_definer;
set role influx_moderation_definer;

-- 7.1 The caller: an active agent or admin in aal2 --------------------------------------------------
create or replace function profiles.require_review_agent(p_admin_only boolean)
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

comment on function profiles.require_review_agent(boolean) is
  'Returns the caller when he is an active account with the agent or admin role (admin only when '
  'asked), an active agent profile, in an aal2 transaction; 42501 forbidden otherwise. SECURITY '
  'INVOKER owned by influx_moderation_definer, NO grant: called by the decision functions only.';

revoke all on function profiles.require_review_agent(boolean)
  from public, anon, authenticated, service_role;

-- 7.2 Opening = claiming (15 C1, C2, file.md A9) ---------------------------------------------------
create or replace function profiles.open_advertiser_review_entry(p_entry_id uuid)
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
  v_entry     record;
  v_minutes   integer;
  v_outcome   text;
  v_holder    uuid;
  v_claimed   timestamptz;
  v_expires   timestamptz;
  v_token     text;
begin
  -- The entry row first, locked: every act on an entry (open, release, extend, force, decide) is
  -- serial on it. Unknown, or of the caller's own account (the policy hides it): 42501, one answer.
  select e.account_id, e.state::text as state, e.claimed_by_account_id, e.claimed_at,
         e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_entry.state <> 'open' then
    v_outcome := 'closed';
  elsif v_entry.claimed_by_account_id = v_caller and v_entry.claim_expires_at > pg_catalog.now() then
    -- EC-L2C-07-4: the caller's own live claim, unchanged
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
    update profiles.advertiser_review_entries e
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
      -- file.md A9: the claim taken over had expired; its abandonment is written first, with its
      -- holder and its real expiry (15 C3: the holder and the duration)
      if v_entry.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_entry_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'profiles_advertiser',
                               'holder_account_id', v_entry.claimed_by_account_id,
                               'claimed_at', v_entry.claimed_at,
                               'expired_at', v_entry.claim_expires_at));
      end if;
    else
      -- 15 C2: somebody else holds it, read only, never an error
      v_outcome := 'read_only';
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  end if;

  if v_outcome in ('claimed', 'held') then
    v_token := profiles.advertiser_review_token(v_entry.account_id);
  end if;

  -- 15 RG35, L2BS-7: the opening is an act (the decision view shows the contact person); last
  perform audit.append('queue.entry_opened', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_advertiser',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires, v_token;
end
$$;

comment on function profiles.open_advertiser_review_entry(uuid) is
  '15 RG27 C1, C2, C3, RG35; file.md A3, A9: an agent or an admin opens an entry of queue 1. Free, or '
  'its claim expired: claimed by an atomic conditional UPDATE (04 l. 2465-2480), claim_expires_at = '
  'now() + claim_expiry_minutes; an expired claim taken over writes queue.claim_expired {queue_code, '
  'holder_account_id, claimed_at, expired_at} first. Returns (outcome, holder, claimed_at, '
  'claim_expires_at, review_token): claimed or held (the caller''s live claim, unchanged) with the '
  'version token; read_only with the live holder (15 C2); closed with nothing. Every opening writes '
  'queue.entry_opened {queue_code, outcome}. 42501 for an unknown entry, an entry of the caller''s own '
  'account (C(3)), outside an active agent or admin in aal2. SECURITY DEFINER owned by '
  'influx_moderation_definer, empty search_path; EXECUTE for influx_agent and influx_admin.';

-- 7.3 Release (15 C3, no comment: the register holds no free text) --------------------------------
create or replace function profiles.release_advertiser_review_entry(p_entry_id uuid)
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
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;

  update profiles.advertiser_review_entries e
     set claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
   where e.id = p_entry_id;

  perform audit.append('queue.claim_released', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_advertiser',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at));
end
$$;

comment on function profiles.release_advertiser_review_entry(uuid) is
  '15 RG27 C3, file.md A9: the holder of a live claim gives the entry back to the queue ("je rends la '
  'main"); line queue.claim_released {queue_code, holder_account_id, claimed_at}, no comment. 55P03 '
  'when the caller holds no live claim (DETAIL the live holder or none), 55000 entry_closed, 42501 as '
  'the opening. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and '
  'influx_admin.';

-- 7.4 Extend (file.md A9) ------------------------------------------------------------------------------
create or replace function profiles.extend_advertiser_review_claim(p_entry_id uuid)
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
  select e.account_id, e.state::text as state, e.claimed_by_account_id, e.claimed_at,
         e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;

  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s
   where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update profiles.advertiser_review_entries e
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where e.id = p_entry_id
  returning e.claim_expires_at into v_expires;

  perform audit.append('queue.claim_extended', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_advertiser',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function profiles.extend_advertiser_review_claim(uuid) is
  'file.md A9: the holder of a live claim extends it to now() + claim_expiry_minutes; line '
  'queue.claim_extended {queue_code, holder_account_id, claimed_at, claim_expires_at}; returns the new '
  'expiry. 55P03, 55000 entry_closed, 42501 as the release. SECURITY DEFINER owned by '
  'influx_moderation_definer; EXECUTE for influx_agent and influx_admin.';

-- 7.5 Forced release by an administrator (15 C4, file.md A8) ---------------------------------------
create or replace function profiles.force_release_advertiser_review_claim(
  p_entry_id     uuid,
  p_reason_code  text
)
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
    raise exception 'a typed reason of backoffice.claim_release_reasons is required'
      using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;

  select e.account_id, e.state::text as state, e.claimed_by_account_id, e.claimed_at,
         e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is null or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no live claim to lift' using errcode = 'lock_not_available', detail = 'none';
  end if;

  update profiles.advertiser_review_entries e
     set claimed_by_account_id            = null,
         claimed_at                       = null,
         claim_expires_at                 = null,
         forced_release_at                = pg_catalog.now(),
         forced_release_by_account_id     = v_caller,
         forced_release_holder_account_id = v_entry.claimed_by_account_id,
         forced_release_reason_code       = p_reason_code
   where e.id = p_entry_id;

  perform audit.append('queue.claim_forced_release', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_advertiser',
                                                     'holder_account_id', v_entry.claimed_by_account_id,
                                                     'reason_code', p_reason_code));
  return v_entry.claimed_by_account_id;
end
$$;

comment on function profiles.force_release_advertiser_review_claim(uuid, text) is
  '15 RG27 C4, file.md A8: an administrator lifts a live claim before its expiry, with a typed reason '
  'of backoffice.claim_release_reasons; the entry keeps the last forced release (instant, admin, '
  'dispossessed holder, reason) for the notice shown to the holder at his next opening or action; '
  'line queue.claim_forced_release {queue_code, holder_account_id, reason_code}; returns the holder. '
  '22023 reason, 55P03 none (no live claim), 55000 entry_closed, 42501 outside an active admin in '
  'aal2 (an agent''s attempt is journalled by apps/api through backoffice.record_refused_action, '
  'queue.force_release_claim). SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for '
  'influx_agent and influx_admin (the function refuses the agent).';

-- 7.6 Publish (06 RG6, RG9, RG65, RG69, RG78) ------------------------------------------------------
create or replace function profiles.publish_advertiser_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_internal_comment  text
)
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
  v_account   uuid;
  v_status    text;
  v_first     boolean;
  v_entry     record;
  v_rev       record;
  v_logo      uuid;
  v_text      text;
  v_fields    text[] := '{}';
  v_values    jsonb;
  v_missing   text[];
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  if p_internal_comment is not null
     and (pg_catalog.char_length(p_internal_comment) not between 1 and 1000
          or p_internal_comment !~ '[^[:space:]]'
          or p_internal_comment ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]') then
    raise exception 'the internal comment is 1 to 1 000 printable characters'
      using errcode = 'invalid_parameter_value', detail = 'internal_comment';
  end if;

  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  if not found or v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The profile row FIRST, as every member door of the account (0209), then the entry: a member
  -- write waits for this decision, or this decision reads it (file.md A3).
  select p.status::text, p.first_published_at is null
    into v_status, v_first
    from profiles.advertiser_profiles p
   where p.account_id = v_account
     for update of p;

  select e.kind::text as kind, e.state::text as state, e.claimed_by_account_id, e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- 06 CA18: no decision without a live claim of the caller
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  -- file.md A3, L2BS-1: the version examined
  if p_review_token is null
     or p_review_token is distinct from profiles.advertiser_review_token(v_account) then
    raise exception 'the profile changed since it was opened'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  -- EC-L2C-07-6
  if not ((v_entry.kind = 'submission' and v_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_status = 'published')) then
    raise exception 'a % entry is not decided on a % profile', v_entry.kind, v_status
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  -- RG9: every pending value applied, its revision approved, in this transaction; the constraints of
  -- the column apply now (file.md A4)
  for v_rev in
    select r.id, r.field_code, r.proposed_value
      from profiles.profile_field_revisions r
     where r.advertiser_review_entry_id = p_entry_id and r.status = 'pending_review'
     order by r.field_code
  loop
    if v_rev.field_code = 'advertiser.logo' then
      v_logo := (v_rev.proposed_value ->> 'logo_object_id')::uuid;
      if v_logo is not null then
        perform 1 from profiles.brand_logo_objects l
         where l.id = v_logo and l.account_id = v_account and l.state = 'in_review';
        if not found then
          raise exception 'the proposed logo is no longer under review'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      end if;
      -- one active logo per brand: the previous one leaves first
      update profiles.brand_logo_objects l
         set state = 'purging', purge_requested_at = pg_catalog.now()
       where l.account_id = v_account and l.state = 'active';
      if v_logo is not null then
        update profiles.brand_logo_objects l
           set state = 'active', activated_at = pg_catalog.now()
         where l.id = v_logo;
      end if;
    else
      v_text := v_rev.proposed_value #>> '{}';
      case v_rev.field_code
        when 'advertiser.brand_name' then
          update profiles.advertiser_profiles p set legal_name = v_text where p.account_id = v_account;
        when 'advertiser.presentation' then
          update profiles.advertiser_profiles p set presentation = v_text where p.account_id = v_account;
        when 'advertiser.website_domain' then
          update profiles.advertiser_profiles p set website_domain = v_text where p.account_id = v_account;
        when 'advertiser.contact_role' then
          update profiles.advertiser_profiles p set contact_role = v_text where p.account_id = v_account;
        when 'advertiser.primary_sector' then
          update profiles.advertiser_profiles p set primary_sector_code = v_text
           where p.account_id = v_account;
        else
          raise exception 'no application for the field %', v_rev.field_code
            using errcode = 'invalid_parameter_value';
      end case;
    end if;
    update profiles.profile_field_revisions r
       set status = 'approved', closed_at = pg_catalog.now()
     where r.id = v_rev.id;
    v_fields := v_fields || v_rev.field_code;
  end loop;

  -- 06 RG5, L2BS-1: the required fields of the version published (0203)
  select pg_catalog.jsonb_build_object(
           'legal_name',         p.legal_name,
           'primary_sector',     p.primary_sector_code,
           'company_size',       p.company_size_band,
           'country',            a.country_code,
           'target_markets',     (select pg_catalog.jsonb_agg(m.country_code)
                                    from profiles.advertiser_target_markets m
                                   where m.account_id = p.account_id),
           'working_languages',  (select pg_catalog.jsonb_agg(w.language_code)
                                    from profiles.advertiser_working_languages w
                                   where w.account_id = p.account_id),
           'presentation',       p.presentation,
           'topics',             (select pg_catalog.jsonb_agg(t.topic_code)
                                    from profiles.advertiser_topics t
                                   where t.account_id = p.account_id),
           'networks',           (select pg_catalog.jsonb_agg(n.network_code)
                                    from profiles.advertiser_networks n
                                   where n.account_id = p.account_id),
           'formats',            (select pg_catalog.jsonb_agg(f.format_code)
                                    from profiles.advertiser_formats f
                                   where f.account_id = p.account_id),
           'audience_countries', (select pg_catalog.jsonb_agg(c.country_code)
                                    from profiles.advertiser_audience_countries c
                                   where c.account_id = p.account_id),
           'contact_role',       p.contact_role)
    into v_values
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.account_id = v_account;
  v_missing := profiles.advertiser_missing_required_fields(v_values);
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'required field missing: %', v_missing[1]
      using errcode = 'check_violation', detail = v_missing[1];
  end if;

  update profiles.advertiser_profiles p
     set status = 'published',
         first_published_at = coalesce(p.first_published_at, pg_catalog.now())
   where p.account_id = v_account;

  update profiles.advertiser_review_entries e
     set state = 'published', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- 06 RG69: the decision e-mail, in the brand's language, rendered by the worker (09, D69)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'profile.decision', 'brevo_transactional', 'account:' || v_account::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_account,
                                        'entry_id', p_entry_id),
          'profile.decision:' || p_entry_id::text);
  -- 06 RG78: profile.completed once per account, lead.updated afterwards; ids only (05 RG74)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_lead, case when v_first then 'profile.completed' else 'lead.updated' end, d.destination,
         'account:' || v_account::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', v_account),
         case when v_first then 'profile.completed:' || v_account::text
              else 'lead.updated:' || v_lead::text end
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  -- The register, in the transaction of the fact; last (04 §7.2)
  perform audit.append('profile.published', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'fields', pg_catalog.to_jsonb(v_fields),
                                                     'late', v_late));
  return query select v_decided, v_late, v_first;
end
$$;

comment on function profiles.publish_advertiser_review_entry(uuid, text, text) is
  '06 RG6, RG9, RG65, RG69, RG78; 15 C6, C8; file.md A2, A3: the holder of a live claim publishes an '
  'entry of queue 1. The profile row locked first, then the entry; the version token recomputed and '
  'compared; in ONE transaction: each pending revision applied to its column (logo: the in_review '
  'object active, the previous active one purging) and approved, the required fields recontrolled, '
  'status published, first_published_at written once, the entry published (decider, instant, '
  'internal comment), profile.decision to brevo_transactional (key profile.decision:<entry>), '
  'profile.completed to brevo_contact and apollo_contact at the first publication (key '
  'profile.completed:<account>), lead.updated otherwise, the line profile.published {entry_id, kind, '
  'fields, late}. Returns (decided_at, sla_breached, first_publication). 55P03 no live claim of the '
  'caller (DETAIL holder or none), 55000 entry_closed, stale_token or profile_state, 23514 a required '
  'field missing (DETAIL its code) or a column constraint, 22023 internal_comment, 42501 as the '
  'opening. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and '
  'influx_admin.';

-- 7.7 Reject (06 RG10, RG65, RG66, RG68, RG69) -----------------------------------------------------
create or replace function profiles.reject_advertiser_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_reason_code       text,
  p_member_message    text,
  p_internal_comment  text
)
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
  v_account   uuid;
  v_status    text;
  v_entry     record;
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
begin
  -- RG65, RG66: a typed reason of the closed list, never a refusal without one
  select r.requires_member_message into v_requires
    from profiles.advertiser_rejection_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'a typed reason of profiles.advertiser_rejection_reasons is required'
      using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  -- file.md A6: the message to the brand for `other` only, 20 to 500 printable characters
  if v_requires then
    if p_member_message is null
       or pg_catalog.char_length(p_member_message) not between 20 and 500
       or p_member_message !~ '[^[:space:]]'
       or p_member_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'this reason requires a message of 20 to 500 printable characters'
        using errcode = 'invalid_parameter_value', detail = 'member_message';
    end if;
  elsif p_member_message is not null then
    raise exception 'this reason takes no message' using errcode = 'invalid_parameter_value',
      detail = 'member_message';
  end if;
  if p_internal_comment is not null
     and (pg_catalog.char_length(p_internal_comment) not between 1 and 1000
          or p_internal_comment !~ '[^[:space:]]'
          or p_internal_comment ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]') then
    raise exception 'the internal comment is 1 to 1 000 printable characters'
      using errcode = 'invalid_parameter_value', detail = 'internal_comment';
  end if;

  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  if not found or v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The profile row first, then the entry (same order as the publication and the member doors)
  select p.status::text into v_status
    from profiles.advertiser_profiles p
   where p.account_id = v_account
     for update of p;

  select e.kind::text as kind, e.state::text as state, e.claimed_by_account_id, e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  if p_review_token is null
     or p_review_token is distinct from profiles.advertiser_review_token(v_account) then
    raise exception 'the profile changed since it was opened'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not ((v_entry.kind = 'submission' and v_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_status = 'published')) then
    raise exception 'a % entry is not decided on a % profile', v_entry.kind, v_status
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  update profiles.profile_field_revisions r
     set status = 'rejected', closed_at = pg_catalog.now()
   where r.advertiser_review_entry_id = p_entry_id and r.status = 'pending_review';
  -- the logo proposed goes to purge, the active one stays served
  update profiles.brand_logo_objects l
     set state = 'purging', purge_requested_at = pg_catalog.now()
   where l.account_id = v_account and l.state = 'in_review';
  -- RG10: a refused submission goes back to the brand; a refused revision leaves it published (A2)
  if v_entry.kind = 'submission' then
    update profiles.advertiser_profiles p set status = 'rejected' where p.account_id = v_account;
  end if;

  update profiles.advertiser_review_entries e
     set state = 'rejected', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         rejection_reason_code = p_reason_code, member_message = p_member_message,
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'profile.decision', 'brevo_transactional', 'account:' || v_account::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_account,
                                        'entry_id', p_entry_id),
          'profile.decision:' || p_entry_id::text);

  perform audit.append('profile.rejected', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'reason_code', p_reason_code,
                                                     'late', v_late));
  return query select v_decided, v_late;
end
$$;

comment on function profiles.reject_advertiser_review_entry(uuid, text, text, text, text) is
  '06 RG10, RG65, RG66, RG68, RG69; 15 C6, C8; file.md A2, A3, A6: the holder of a live claim refuses '
  'an entry of queue 1 with a typed reason of profiles.advertiser_rejection_reasons; the message to '
  'the brand (20 to 500 characters) for a reason that requires it only (other); an internal comment '
  'of 1 000 characters at most, never sent. Same locks and token as the publication; in ONE '
  'transaction: the pending revisions rejected, the in_review logo purging, a submission back to '
  'rejected (a revision leaves the profile published), the entry rejected, profile.decision to '
  'brevo_transactional, the line profile.rejected {entry_id, kind, reason_code, late}. Returns '
  '(decided_at, sla_breached). 22023 reason, member_message or internal_comment, then the refusals '
  'of the publication. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent '
  'and influx_admin.';

do $$
declare
  f text;
begin
  foreach f in array array[
    'profiles.open_advertiser_review_entry(uuid)',
    'profiles.release_advertiser_review_entry(uuid)',
    'profiles.extend_advertiser_review_claim(uuid)',
    'profiles.force_release_advertiser_review_claim(uuid, text)',
    'profiles.publish_advertiser_review_entry(uuid, text, text)',
    'profiles.reject_advertiser_review_entry(uuid, text, text, text, text)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to influx_agent, influx_admin', f);
  end loop;
end
$$;

reset role;
revoke create on schema profiles from influx_moderation_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_moderation_definer', current_user);
end
$$;

-- 8. An agent's attempt at a forced release (file.md "Codes"; 05 CA63) -----------------------------
-- backoffice.record_refused_action(), recreated by its owner as in 0148 with one more code.

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;

set role influx_identity_definer;

create or replace function backoffice.record_refused_action(p_action_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller uuid := influx.current_account_id();
begin
  if v_caller is null
     or influx.current_account_role() is distinct from 'agent'
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'agent'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_action_code is null
     or p_action_code not in ('leads.change_apollo_setting', 'leads.read_apollo_settings',
                              'leads.lift_brevo_suppression', 'backoffice.dual_control',
                              'identity.change_member_role', 'identity.internal_invitation',
                              'privacy.approve_data_request', 'ops.read_health',
                              'queue.force_release_claim') then
    raise exception 'unknown action code' using errcode = 'invalid_parameter_value';
  end if;
  -- the trace of the attempt, on the caller's own account (AL39 counts them per account)
  perform audit.append('backoffice.action_refused', 'account', v_caller,
                       pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                     'required_role', 'admin'));
end
$$;

comment on function backoffice.record_refused_action(text) is
  '05 CA63, 15 RG110 (AL39): an active agent in aal2 who attempted an admin action leaves its trace: '
  'backoffice.action_refused {action_code, required_role: admin} on his own account. Closed list: '
  'leads.change_apollo_setting, leads.read_apollo_settings, leads.lift_brevo_suppression, '
  'backoffice.dual_control, identity.change_member_role, identity.internal_invitation (0135), '
  'privacy.approve_data_request (0137, EC-J8-49), ops.read_health (0148: the "Santé technique" screen), '
  'queue.force_release_claim (0210: the forced release of a claim, 15 C4); 22023 otherwise. apps/api '
  'calls it before answering 403, in a transaction that commits. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_agent ONLY.';

reset role;

revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 9. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  -- the owner: no login, no inheritance, no dangerous attribute
  if not exists (select 1 from pg_catalog.pg_roles
                  where rolname = 'influx_moderation_definer' and not rolcanlogin
                    and not rolinherit and not rolsuper and not rolbypassrls
                    and not rolcreaterole and not rolcreatedb and not rolreplication) then
    raise exception 'influx_moderation_definer must be NOLOGIN NOINHERIT without attribute (03 P7)';
  end if;

  -- the six decisions: SECURITY DEFINER, their owner, empty search_path, agent and admin only
  for v_def in
    select * from (values
      ('profiles.open_advertiser_review_entry(uuid)'),
      ('profiles.release_advertiser_review_entry(uuid)'),
      ('profiles.extend_advertiser_review_claim(uuid)'),
      ('profiles.force_release_advertiser_review_claim(uuid, text)'),
      ('profiles.publish_advertiser_review_entry(uuid, text, text)'),
      ('profiles.reject_advertiser_review_entry(uuid, text, text, text, text)')
    ) as d (fn)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> 'influx_moderation_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_moderation_definer, empty search_path',
        v_def.fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_agent', 'influx_admin'));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- the helper and the invoker functions: SECURITY INVOKER, empty search_path, their callers
  for v_def in
    select * from (values
      ('profiles.require_review_agent(boolean)', array[]::text[]),
      ('profiles.normalized_brand_name(text)', array['influx_agent', 'influx_admin']),
      ('profiles.advertiser_duplicate_candidates(uuid, text, text)',
       array['influx_agent', 'influx_admin']),
      ('profiles.advertiser_review_token(uuid)', array['influx_moderation_definer'])
    ) as d (fn, callers)
  loop
    if (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY INVOKER with an empty search_path', v_def.fn;
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

  -- the codes of the decisions and of the queue
  if (select count(*) from audit.event_types
       where code in ('profile.published', 'profile.rejected', 'queue.entry_opened',
                      'queue.claim_forced_release', 'queue.claim_released', 'queue.claim_extended',
                      'queue.claim_expired', 'profile.completed', 'profile.decision')
         and is_active) <> 9 then
    raise exception 'the nine codes of file.md "Codes" are not all active';
  end if;

  -- the forced release reasons: the closed list of file.md A8, the key of the entries
  if (select pg_catalog.array_agg(code order by code) from backoffice.claim_release_reasons)
     is distinct from array['holder_absent', 'overdue_entry', 'wrong_claim'] then
    raise exception 'backoffice.claim_release_reasons is not the list of file.md A8';
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'advertiser_review_entries_forced_release_reason_fk'
                    and conrelid = 'profiles.advertiser_review_entries'::regclass) then
    raise exception 'forced_release_reason_code has no foreign key (EC-L2C-05-2)';
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'backoffice.claim_release_reasons'::regclass) then
    raise exception 'row level security must be enabled and forced on claim_release_reasons';
  end if;

  -- still no execution role writing the tables of queue 1 directly (0207, 0209)
  select string_agg(r || ' ' || p || ' ' || t, ', ') into v_bad
    from unnest(array['profiles.moderated_fields', 'profiles.advertiser_rejection_reasons',
                      'profiles.advertiser_review_entries', 'profiles.profile_field_revisions',
                      'backoffice.claim_release_reasons']) t,
         unnest(array['influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin',
                      'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy']) r,
         unnest(array['INSERT', 'UPDATE', 'DELETE']) p
   where pg_catalog.has_table_privilege(r, t, p)
      or (p <> 'DELETE' and pg_catalog.has_any_column_privilege(r, t, p));
  if v_bad is not null then
    raise exception 'execution role(s) writing a table of queue 1: %', v_bad;
  end if;

  -- no definer role left usable nor with CREATE on its schemas
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_moderation_definer', 'influx_identity_definer', 'influx_audit_writer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_moderation_definer', 'profiles', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'a definer role left with CREATE on a schema';
  end if;

  -- the function itself: an accent, a space and punctuation do not make another brand
  if profiles.normalized_brand_name('Café  du-Monde!') is distinct from
     profiles.normalized_brand_name('cafe du monde')
     or profiles.normalized_brand_name('é') is not null then
    raise exception 'normalized_brand_name does not normalise as file.md A7 says';
  end if;
end
$$;
