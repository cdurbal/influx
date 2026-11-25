-- =============================================================================
-- 0222_verification_member_doors
-- -----------------------------------------------------------------------------
-- Lot 2 / L2E, commit 06 (jalons/l2e/06.md; l2e/modele.md §1 point 3, §3, §4 "Créateur", "Marque",
-- "Erreurs", "Registre", "Outbox"; fiche invariants 7, 11, 15, 17; 08 RG12, RG14, RG21 to RG23,
-- RG44 point 1, RG60; 06 RG46, RG47, RG51, CA26, CA27). The member doors of the verification: a
-- creator opens, submits and cancels a request per network line and level and renews its code; a
-- brand does the same for its single brand request, after its internal block. No deposit (0223), no
-- claim nor decision (0224), no screen.
--
--   influx_creator_verification_definer   NOLOGIN NOINHERIT, no member (modele §1 point 3): owns the
--         four creator doors, the code generator and the shared helpers; reads and writes the
--         caller's own creator rows only (RLS on influx.current_account_id(), population creator).
--   verification.new_ownership_code()     INFLUX- and 8 signs out of 31 (23456789 and the capitals
--         but I, L, O), drawn from strong random bytes, a byte >= 248 rejected (248 = 8 x 31: no
--         bias). Takes NO input: derived from nothing (RG21, invariant 7). SECURITY INVOKER.
--   verification.open_request_of(), issue_ownership_code(), submit_request_of(), cancel_request_of()
--         SECURITY INVOKER helpers of both families of doors (one copy of RG14, RG60, RG23): they run
--         with the rights and the policies of the door that calls them. EXECUTE for
--         influx_identity_definer (the brand doors); never for a business role.
--   verification.open_own_request(social_account_id, level), renew_own_code(request_id),
--         submit_own_request(request_id), cancel_own_request(request_id)   SECURITY DEFINER, owner
--         influx_creator_verification_definer, EXECUTE for influx_creator only.
--   verification.cancel_open_requests_of_line()   AFTER DELETE on profiles.creator_social_accounts
--         (modele -16): the open requests of a deleted line are cancelled, their code revoked; never
--         on the erasure (influx_privacy_definer, 0226 owns it).
--   profiles.advertiser_internal_details  the internal block of a brand (06 RG46, RG47): legal name,
--         country and number of registration. Asked at the badge request, never at the creation of
--         the profile; never read by a creator, Brevo, Apollo nor influx_leads_definer (RG48); read
--         by agent and admin in aal2, written by the brand door only.
--   profiles.open_own_brand_verification(), save_own_brand_internal_details(...),
--         renew_own_brand_verification_code(), submit_own_brand_verification(),
--         cancel_own_brand_verification(), read_own_brand_verification()   SECURITY DEFINER, owner
--         influx_identity_definer (modele §1 point 3: no right on the evidence, EC-L2E-18), EXECUTE
--         for influx_advertiser only, who still holds NOTHING on the schema verification.
--
-- Refusals (modele §4 "Erreurs"; the API reads the MESSAGE, which is the code itself):
--   42501 forbidden          not an active member of the role, an unknown or another's line or
--                            request (one answer, T14).
--   22023 level              a creator asks brand_verified, or a code for an audience request;
--         internal_details_invalid  DETAIL legal_name, registration_country_code, registration_number.
--   23514 website_domain_required (CA26), internal_details_required (RG47).
--   55000 duplicate_request  DETAIL the submission instant, ISO 8601 UTC (RG14: « demande déjà en
--                            cours depuis le {date} »);
--         retry_after        DETAIL the seconds left (RG60, 24 h after a refusal);
--         rejection_cap      3 refusals on the triplet within 30 days (RG60);
--         already_verified   an active account badge on the line;
--         request_not_draft, entry_closed, ownership_prerequisite (RG12, at the submission),
--         missing_evidence (-13), code_expired (EC-L2E-06-3): DETAIL the same code.
--
-- EC-L2E-06 (micro-gaps, the safest choice):
--   EC-L2E-06-1  the random bytes come from pg_catalog.gen_random_uuid() (version and variant bytes
--                left out), the source of profiles.new_creator_alias() (0216), not from
--                extensions.gen_random_bytes(): both draw from pg_strong_random(), and EC-35 (3)
--                forbids any influx_% role a right on the schema extensions (t2-rls-matrix).
--   EC-L2E-06-2  the code is issued at the opening of an account request as of a brand request
--                (-15, 06 CA27); renew_own_code() replaces it. An audience request has no code.
--   EC-L2E-06-3  a draft whose live code has expired is not submitted (55000 code_expired): the
--                agent would read a dead code; the member renews it (RG22), or the task of 0223
--                moves the request to expired.
--   EC-L2E-06-4  RG60 counts the refusals (`rejected`) of the triplet; missing_evidence leaves no
--                delay (08 edge case 1 « rejouable sans délai ») but counts in the cap. The lift of
--                the cap « after an agent's intervention » has no door yet (Lot 5): the window
--                slides. The same rule holds for a brand request (06 is silent, the safest).
--   EC-L2E-06-5  an open draft asked again returns as it is (created false: the double click of
--                08 edge case 3); an open pending request answers duplicate_request. An account
--                request with an active account badge answers already_verified; an audience or a
--                brand request with a holding badge opens (a refresh, 08 edge case 3).
--   EC-L2E-06-6  a member door refuses an account that is not active (RG44 point 1: suspended or
--                deleted; a member erasure revokes every session at once, 0150).
--   EC-L2E-06-7  the internal block may be saved at any time; a change during the examination is
--                caught by the review token (0224). No register line (no code in modele §4, and
--                fiche invariant 17 keeps the legal name out of it).
--   EC-L2E-06-8  the cancellation leaves the evidence rows as they are: their passage to purging
--                comes with their life (0223, modele -16, invariant 4); no evidence row can be
--                active before 0223.
--
-- ROLLBACK (before any request is written by a door): drop trigger
-- creator_social_accounts_cancel_open_verification_requests on profiles.creator_social_accounts;
-- drop the ten doors, the four helpers, verification.new_ownership_code() and
-- verification.cancel_open_requests_of_line(); drop table profiles.advertiser_internal_details;
-- drop the policies *_creator_verification_definer_* and *_identity_definer_*_verification named
-- below; revoke the grants of sections 3 and 4; drop role influx_creator_verification_definer.
-- =============================================================================

-- 1. The owner of the creator doors (03 P7 rule 5; rules 1 and 2 of 0001; modele §1 point 3) -------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_creator_verification_definer') then
    create role influx_creator_verification_definer with nologin noinherit;
  end if;
  alter role influx_creator_verification_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_verification_definer' and rolsuper) then
    raise exception 'role influx_creator_verification_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_verification_definer' and rolbypassrls) then
    alter role influx_creator_verification_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_verification_definer' and rolreplication) then
    alter role influx_creator_verification_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_verification_definer' and rolcreatedb) then
    alter role influx_creator_verification_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_verification_definer' and rolcreaterole) then
    alter role influx_creator_verification_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. profiles.advertiser_internal_details (06 RG46 to RG48; modele §1 point 5, §3) ------------------

create table if not exists profiles.advertiser_internal_details (
  account_id                 uuid        not null primary key
                                         references profiles.advertiser_profiles (account_id),
  legal_name                 text        not null,
  registration_country_code  char(2)     not null references reference.countries (code),
  registration_number        text        not null,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  -- RG46: text of 160 characters at most; a number of 40, no format by country at the MVP
  constraint advertiser_internal_details_legal_name
    check (char_length(legal_name) between 1 and 160 and legal_name ~ '[^[:space:]]'
           and legal_name !~ '[[:cntrl:]]'),
  constraint advertiser_internal_details_registration_number
    check (char_length(registration_number) between 1 and 40
           and registration_number ~ '[^[:space:]]' and registration_number !~ '[[:cntrl:]]')
);

comment on table profiles.advertiser_internal_details is
  'The internal block of a brand (06 RG46, RG47; l2e/modele.md §3): legal name, country and number '
  'of registration, checked by an agent in a free public register (RG52). Asked at the badge '
  'request (RG47), never at the creation of the profile; NEVER read by a creator (even after a '
  'reveal), Brevo, Apollo nor influx_leads_definer (RG48); never written to the register nor to a '
  'log (fiche invariant 17). Written by profiles.save_own_brand_internal_details() only (0222), '
  'read by the brand through profiles.read_own_brand_verification() and by agent and admin in '
  'aal2. The commercial notes of RG46 are not here (Lot 5).';
comment on column profiles.advertiser_internal_details.legal_name is
  'Raison sociale as registered (RG46), distinct from profiles.advertiser_profiles.legal_name, '
  'which is the trading name (modele §1 point 5).';

drop trigger if exists advertiser_internal_details_touch_updated_at
  on profiles.advertiser_internal_details;
create trigger advertiser_internal_details_touch_updated_at
  before update on profiles.advertiser_internal_details
  for each row execute function influx.touch_updated_at();

alter table profiles.advertiser_internal_details enable row level security;
alter table profiles.advertiser_internal_details force row level security;
revoke all on profiles.advertiser_internal_details
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator;

-- agent and admin read it in aal2 to check the register (RG52), never on their own account
grant select on profiles.advertiser_internal_details to influx_agent, influx_admin;

drop policy if exists advertiser_internal_details_internal_select on profiles.advertiser_internal_details;
create policy advertiser_internal_details_internal_select on profiles.advertiser_internal_details
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 3. What influx_creator_verification_definer reads and writes ---------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner,
-- bound to the caller's own account (influx.current_account_id()) and to the creator population.

grant usage on schema verification, profiles, identity, backoffice, leads, audit, influx
   to influx_creator_verification_definer;
grant execute on function influx.current_account_id(), influx.current_account_role()
   to influx_creator_verification_definer;

-- 3.1 The caller: an active creator account
grant select (id, status) on identity.accounts to influx_creator_verification_definer;
grant select (account_id, role) on identity.account_roles to influx_creator_verification_definer;

drop policy if exists accounts_creator_verification_definer_select on identity.accounts;
create policy accounts_creator_verification_definer_select on identity.accounts
  for select to influx_creator_verification_definer
  using (id = (select influx.current_account_id()));
drop policy if exists account_roles_creator_verification_definer_select on identity.account_roles;
create policy account_roles_creator_verification_definer_select on identity.account_roles
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()));

-- 3.2 The network lines of the caller (the target of a request; the deleted line of -16)
grant select (id, account_id, network_code) on profiles.creator_social_accounts
   to influx_creator_verification_definer;

drop policy if exists creator_social_accounts_creator_verification_definer_select
  on profiles.creator_social_accounts;
create policy creator_social_accounts_creator_verification_definer_select
  on profiles.creator_social_accounts
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()));

-- 3.3 The requests: open a draft, submit it, cancel it (the deadlines by the trigger, EC-L2E-05-3)
grant select (id, account_id, social_account_id, network_code, level, population, status,
              created_at, submitted_at, decided_at, rejection_reason_code, cancelled_at, closed_at)
   on verification.verification_requests to influx_creator_verification_definer;
grant insert (account_id, social_account_id, network_code, level)
   on verification.verification_requests to influx_creator_verification_definer;
grant update (status, cancelled_at, closed_at)
   on verification.verification_requests to influx_creator_verification_definer;

drop policy if exists verification_requests_creator_verification_definer_select
  on verification.verification_requests;
create policy verification_requests_creator_verification_definer_select
  on verification.verification_requests
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and population = 'creator');
drop policy if exists verification_requests_creator_verification_definer_insert
  on verification.verification_requests;
create policy verification_requests_creator_verification_definer_insert
  on verification.verification_requests
  for insert to influx_creator_verification_definer
  with check (account_id = (select influx.current_account_id()) and population = 'creator'
              and status = 'draft');
-- USING without a status: the row lock of a door (FOR UPDATE) must see an ended request to answer
-- request_not_draft; the trigger moves the status forward only, WITH CHECK keeps the two a door writes
drop policy if exists verification_requests_creator_verification_definer_update
  on verification.verification_requests;
create policy verification_requests_creator_verification_definer_update
  on verification.verification_requests
  for update to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and population = 'creator')
  with check (account_id = (select influx.current_account_id()) and population = 'creator'
              and status in ('pending', 'cancelled'));

-- 3.4 The codes of the caller's network requests: issue, revoke
grant select (id, request_id, account_id, kind, code, created_at, expires_at, revoked_at)
   on verification.ownership_codes to influx_creator_verification_definer;
grant insert (request_id, account_id, kind, code, expires_at)
   on verification.ownership_codes to influx_creator_verification_definer;
grant update (revoked_at) on verification.ownership_codes to influx_creator_verification_definer;

drop policy if exists ownership_codes_creator_verification_definer_select
  on verification.ownership_codes;
create policy ownership_codes_creator_verification_definer_select on verification.ownership_codes
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and kind = 'network');
drop policy if exists ownership_codes_creator_verification_definer_insert
  on verification.ownership_codes;
create policy ownership_codes_creator_verification_definer_insert on verification.ownership_codes
  for insert to influx_creator_verification_definer
  with check (account_id = (select influx.current_account_id()) and kind = 'network'
              and revoked_at is null and observed_at is null);
drop policy if exists ownership_codes_creator_verification_definer_update
  on verification.ownership_codes;
create policy ownership_codes_creator_verification_definer_update on verification.ownership_codes
  for update to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and kind = 'network'
         and revoked_at is null)
  with check (account_id = (select influx.current_account_id()) and kind = 'network'
              and revoked_at is not null);

-- 3.5 The badges of the caller (RG12, already_verified) and the state of his evidence (-13)
grant select (account_id, social_account_id, level, state)
   on verification.badges to influx_creator_verification_definer;
grant select (request_id, account_id, state)
   on verification.evidence_files to influx_creator_verification_definer;

drop policy if exists badges_creator_verification_definer_select on verification.badges;
create policy badges_creator_verification_definer_select on verification.badges
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and level <> 'brand_verified');
drop policy if exists evidence_files_creator_verification_definer_select
  on verification.evidence_files;
create policy evidence_files_creator_verification_definer_select on verification.evidence_files
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()));

-- 3.6 The parameters of RG22 and RG60, the delay of queue 4 (the trigger, invoker, reads it)
grant select (key, value) on backoffice.operational_settings to influx_creator_verification_definer;
grant select (queue_code, is_active, target_decision_minutes, escalate_after_minutes, business_hours)
   on backoffice.sla_policies to influx_creator_verification_definer;
grant execute on function backoffice.business_deadline(text, timestamptz, integer)
   to influx_creator_verification_definer;

drop policy if exists operational_settings_creator_verification_definer_select
  on backoffice.operational_settings;
create policy operational_settings_creator_verification_definer_select
  on backoffice.operational_settings
  for select to influx_creator_verification_definer
  using (key in ('verification_code_validity_days', 'request_retry_hours', 'rejection_cap_count',
                 'rejection_cap_window_days'));
drop policy if exists sla_policies_creator_verification_definer_select on backoffice.sla_policies;
create policy sla_policies_creator_verification_definer_select on backoffice.sla_policies
  for select to influx_creator_verification_definer
  using (queue_code = 'verification');

-- 3.7 The queue (received, code issued; ids only, 05 RG74) and the register
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_creator_verification_definer;

drop policy if exists outbox_events_creator_verification_definer_insert on leads.outbox_events;
create policy outbox_events_creator_verification_definer_insert on leads.outbox_events
  for insert to influx_creator_verification_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and destination = 'brevo_transactional'
              and event_type in ('verification.received', 'verification.code_issued'));

-- the register, through audit.append(), granted by its owner (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_creator_verification_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 4. What influx_identity_definer reads and writes for the brand doors (never the evidence) ----------

grant usage on schema verification to influx_identity_definer;

grant select (id, account_id, social_account_id, network_code, level, population, status,
              created_at, submitted_at, decided_at, rejection_reason_code, member_message,
              cancelled_at, closed_at)
   on verification.verification_requests to influx_identity_definer;
grant insert (account_id, social_account_id, network_code, level)
   on verification.verification_requests to influx_identity_definer;
grant update (status, cancelled_at, closed_at)
   on verification.verification_requests to influx_identity_definer;

drop policy if exists verification_requests_identity_definer_select_verification
  on verification.verification_requests;
create policy verification_requests_identity_definer_select_verification
  on verification.verification_requests
  for select to influx_identity_definer
  using (account_id = (select influx.current_account_id()) and population = 'brand');
drop policy if exists verification_requests_identity_definer_insert_verification
  on verification.verification_requests;
create policy verification_requests_identity_definer_insert_verification
  on verification.verification_requests
  for insert to influx_identity_definer
  with check (account_id = (select influx.current_account_id()) and population = 'brand'
              and status = 'draft');
drop policy if exists verification_requests_identity_definer_update_verification
  on verification.verification_requests;
create policy verification_requests_identity_definer_update_verification
  on verification.verification_requests
  for update to influx_identity_definer
  using (account_id = (select influx.current_account_id()) and population = 'brand')
  with check (account_id = (select influx.current_account_id()) and population = 'brand'
              and status in ('pending', 'cancelled'));

grant select (id, request_id, account_id, kind, code, created_at, expires_at, revoked_at)
   on verification.ownership_codes to influx_identity_definer;
grant insert (request_id, account_id, kind, code, expires_at)
   on verification.ownership_codes to influx_identity_definer;
grant update (revoked_at) on verification.ownership_codes to influx_identity_definer;

drop policy if exists ownership_codes_identity_definer_select_verification
  on verification.ownership_codes;
create policy ownership_codes_identity_definer_select_verification on verification.ownership_codes
  for select to influx_identity_definer
  using (account_id = (select influx.current_account_id()) and kind = 'domain');
drop policy if exists ownership_codes_identity_definer_insert_verification
  on verification.ownership_codes;
create policy ownership_codes_identity_definer_insert_verification on verification.ownership_codes
  for insert to influx_identity_definer
  with check (account_id = (select influx.current_account_id()) and kind = 'domain'
              and revoked_at is null and observed_at is null);
drop policy if exists ownership_codes_identity_definer_update_verification
  on verification.ownership_codes;
create policy ownership_codes_identity_definer_update_verification on verification.ownership_codes
  for update to influx_identity_definer
  using (account_id = (select influx.current_account_id()) and kind = 'domain'
         and revoked_at is null)
  with check (account_id = (select influx.current_account_id()) and kind = 'domain'
              and revoked_at is not null);

grant select (account_id, social_account_id, level, state, granted_at, expires_at)
   on verification.badges to influx_identity_definer;

drop policy if exists badges_identity_definer_select_verification on verification.badges;
create policy badges_identity_definer_select_verification on verification.badges
  for select to influx_identity_definer
  using (account_id = (select influx.current_account_id()) and level = 'brand_verified');

-- the internal block: the brand's own row
grant select (account_id, legal_name, registration_country_code, registration_number, created_at,
              updated_at)
   on profiles.advertiser_internal_details to influx_identity_definer;
grant insert (account_id, legal_name, registration_country_code, registration_number)
   on profiles.advertiser_internal_details to influx_identity_definer;
grant update (legal_name, registration_country_code, registration_number)
   on profiles.advertiser_internal_details to influx_identity_definer;

drop policy if exists advertiser_internal_details_identity_definer_select
  on profiles.advertiser_internal_details;
create policy advertiser_internal_details_identity_definer_select
  on profiles.advertiser_internal_details
  for select to influx_identity_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists advertiser_internal_details_identity_definer_insert
  on profiles.advertiser_internal_details;
create policy advertiser_internal_details_identity_definer_insert
  on profiles.advertiser_internal_details
  for insert to influx_identity_definer
  with check (account_id = (select influx.current_account_id()));
drop policy if exists advertiser_internal_details_identity_definer_update
  on profiles.advertiser_internal_details;
create policy advertiser_internal_details_identity_definer_update
  on profiles.advertiser_internal_details
  for update to influx_identity_definer
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()));

-- the parameters, the delay of queue 4 (column grants of sla_policies already held, 0130, 0207)
grant select (key, value) on backoffice.operational_settings to influx_identity_definer;

drop policy if exists operational_settings_identity_definer_select on backoffice.operational_settings;
create policy operational_settings_identity_definer_select on backoffice.operational_settings
  for select to influx_identity_definer
  using (key in ('verification_code_validity_days', 'request_retry_hours', 'rejection_cap_count',
                 'rejection_cap_window_days'));
drop policy if exists sla_policies_identity_definer_select_verification on backoffice.sla_policies;
create policy sla_policies_identity_definer_select_verification on backoffice.sla_policies
  for select to influx_identity_definer
  using (queue_code = 'verification');

-- the queue (its insert columns already held, 0104)
drop policy if exists outbox_events_identity_definer_insert_verification on leads.outbox_events;
create policy outbox_events_identity_definer_insert_verification on leads.outbox_events
  for insert to influx_identity_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and destination = 'brevo_transactional'
              and event_type in ('verification.received', 'verification.code_issued'));

-- 5. The code generator and the shared helpers (SECURITY INVOKER) -----------------------------------

create or replace function verification.new_ownership_code()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  c_alphabet  constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_signs     text := '';
  v_bytes     bytea;
  v_byte      integer;
begin
  while pg_catalog.char_length(v_signs) < 8 loop
    -- strong random bytes (pg_strong_random), EC-L2E-06-1
    v_bytes := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    for i in 0 .. 15 loop
      -- bytes 6 and 8 carry the version and the variant of the UUID: not random
      continue when i = 6 or i = 8;
      v_byte := pg_catalog.get_byte(v_bytes, i);
      -- 248 = 8 x 31: rejecting the last eight values keeps every sign equally likely
      continue when v_byte >= 248;
      v_signs := v_signs || pg_catalog.substr(c_alphabet, v_byte % 31 + 1, 1);
      exit when pg_catalog.char_length(v_signs) = 8;
    end loop;
  end loop;
  return 'INFLUX-' || v_signs;
end
$$;

comment on function verification.new_ownership_code() is
  '08 RG21, RG22, invariant 7 (0222): a fresh code INFLUX- and 8 signs out of 31 (2-9 and the '
  'capitals but I, L, O), drawn from gen_random_uuid() bytes (version and variant bytes left out, '
  'bytes >= 248 rejected: no bias), about 2^39.6 values. Takes no input: linked to no account, '
  'request, handle nor rank. Uniqueness is the caller''s (verification.issue_ownership_code() draws '
  'again on a collision). SECURITY INVOKER, empty search_path, owned by '
  'influx_creator_verification_definer; EXECUTE for influx_identity_definer.';

create or replace function verification.open_request_of(
  p_account_id         uuid,
  p_social_account_id  uuid,
  p_network_code       text,
  p_level              verification.badge_level)
returns table (
  request_id  uuid,
  status      text,
  created     boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_nil      constant uuid := '00000000-0000-0000-0000-000000000000';
  v_open     record;
  v_retry    integer;
  v_cap      integer;
  v_window   integer;
  v_last     timestamptz;
  v_count    integer;
  v_id       uuid;
begin
  select (s.value)::integer into v_retry
    from backoffice.operational_settings s where s.key = 'request_retry_hours';
  select (s.value)::integer into v_cap
    from backoffice.operational_settings s where s.key = 'rejection_cap_count';
  select (s.value)::integer into v_window
    from backoffice.operational_settings s where s.key = 'rejection_cap_window_days';
  if v_retry is null or v_cap is null or v_window is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  for attempt in 1 .. 2 loop
    -- RG14: one open request per triplet; a draft comes back as it is (EC-L2E-06-5)
    select r.id, r.status::text as status, r.submitted_at into v_open
      from verification.verification_requests r
     where r.account_id = p_account_id
       and coalesce(r.social_account_id, v_nil) = coalesce(p_social_account_id, v_nil)
       and r.level = p_level and r.status in ('draft', 'pending');
    if found then
      if v_open.status = 'pending' then
        raise exception 'duplicate_request' using
          errcode = 'object_not_in_prerequisite_state',
          detail = pg_catalog.to_char(v_open.submitted_at at time zone 'UTC',
                                      'YYYY-MM-DD"T"HH24:MI:SS"Z"');
      end if;
      return query select v_open.id, 'draft'::text, false;
      return;
    end if;

    if attempt = 1 then
      -- the ownership of an account does not expire: proven once, never asked again (RG30)
      if p_level = 'account_verified' and exists (
           select 1 from verification.badges b
            where b.account_id = p_account_id and b.social_account_id = p_social_account_id
              and b.level = 'account_verified' and b.state = 'active') then
        raise exception 'already_verified' using
          errcode = 'object_not_in_prerequisite_state', detail = 'already_verified';
      end if;

      -- RG60: 3 refusals in 30 days need an agent; 24 hours after a refusal (EC-L2E-06-4)
      select pg_catalog.count(*) into v_count
        from verification.verification_requests r
       where r.account_id = p_account_id
         and coalesce(r.social_account_id, v_nil) = coalesce(p_social_account_id, v_nil)
         and r.level = p_level and r.status = 'rejected'
         and r.decided_at > pg_catalog.now() - pg_catalog.make_interval(days => v_window);
      if v_count >= v_cap then
        raise exception 'rejection_cap' using
          errcode = 'object_not_in_prerequisite_state', detail = 'rejection_cap';
      end if;
      select pg_catalog.max(r.decided_at) into v_last
        from verification.verification_requests r
       where r.account_id = p_account_id
         and coalesce(r.social_account_id, v_nil) = coalesce(p_social_account_id, v_nil)
         and r.level = p_level and r.status = 'rejected'
         and r.rejection_reason_code is distinct from 'missing_evidence';
      if v_last + pg_catalog.make_interval(hours => v_retry) > pg_catalog.now() then
        raise exception 'retry_after' using
          errcode = 'object_not_in_prerequisite_state',
          detail = pg_catalog.ceil(extract(epoch from
                     v_last + pg_catalog.make_interval(hours => v_retry) - pg_catalog.now()))::bigint::text;
      end if;
    end if;

    -- a concurrent opening of the same triplet (double click) wins the index: read it again
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level)
    values (p_account_id, p_social_account_id, p_network_code, p_level)
    on conflict do nothing
    returning id into v_id;
    exit when v_id is not null;
  end loop;
  if v_id is null then
    raise exception 'duplicate_request' using errcode = 'object_not_in_prerequisite_state';
  end if;

  perform audit.append('verification.requested', 'verification_request', v_id,
                       pg_catalog.jsonb_build_object('level', p_level));
  return query select v_id, 'draft'::text, true;
end
$$;

comment on function verification.open_request_of(uuid, uuid, text, verification.badge_level) is
  'Helper of the member doors (0222): opens the draft request of (account, line, level), line NULL '
  'for a brand. An open draft comes back as it is (created false); an open pending request 55000 '
  'duplicate_request DETAIL its submission instant (RG14); an active account badge 55000 '
  'already_verified; 3 refusals of the triplet within rejection_cap_window_days 55000 rejection_cap, '
  'a refusal (but missing_evidence) less than request_retry_hours ago 55000 retry_after DETAIL the '
  'seconds left (RG60). Register line verification.requested {level}. SECURITY INVOKER: the rights '
  'and policies of the calling door; owned by influx_creator_verification_definer, EXECUTE for '
  'influx_identity_definer.';

create or replace function verification.issue_ownership_code(
  p_request_id  uuid,
  p_account_id  uuid,
  p_kind        text)
returns table (
  code_id     uuid,
  code        text,
  expires_at  timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_days     integer;
  v_id       uuid;
  v_code     text;
  v_expires  timestamptz;
  v_event    uuid := pg_catalog.gen_random_uuid();
begin
  select (s.value)::integer into v_days
    from backoffice.operational_settings s where s.key = 'verification_code_validity_days';
  if v_days is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- RG23: one valid code per request, the former one invalidated in the same transaction
  update verification.ownership_codes c
     set revoked_at = pg_catalog.now()
   where c.request_id = p_request_id and c.revoked_at is null;

  v_expires := pg_catalog.now() + pg_catalog.make_interval(days => v_days);
  for attempt in 1 .. 5 loop
    begin
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (p_request_id, p_account_id, p_kind, verification.new_ownership_code(), v_expires)
      returning id, code into v_id, v_code;
      exit;
    exception when unique_violation then
      -- the request row is locked by the door: only a collision of codes lands here
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;

  -- the e-mail « code generated » (EC-L2E-3), never the code itself
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'verification.code_issued', 'brevo_transactional',
          'account:' || p_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id,
                                        'request_id', p_request_id),
          'verification.code_issued:' || v_id::text);

  perform audit.append('verification.code_generated', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('code_id', v_id, 'kind', p_kind));
  return query select v_id, v_code, v_expires;
end
$$;

comment on function verification.issue_ownership_code(uuid, uuid, text) is
  'Helper of the member doors (0222): revokes the live code of the request and issues a new one '
  '(verification.new_ownership_code(), drawn again on a collision, 5 draws at most), valid '
  'verification_code_validity_days days (RG22, RG23); queues verification.code_issued (ids only, '
  'never the code) and writes verification.code_generated {code_id, kind}. The caller holds the '
  'request row locked. SECURITY INVOKER; owned by influx_creator_verification_definer, EXECUTE for '
  'influx_identity_definer.';

create or replace function verification.submit_request_of(
  p_request_id  uuid,
  p_account_id  uuid)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_at     timestamptz;
  v_level  verification.badge_level;
  v_event  uuid := pg_catalog.gen_random_uuid();
begin
  -- the deadlines are written by the trigger verification_requests_prepare (EC-L2E-05-3)
  update verification.verification_requests r
     set status = 'pending'
   where r.id = p_request_id and r.account_id = p_account_id and r.status = 'draft'
  returning r.submitted_at, r.level into v_at, v_level;
  if v_at is null then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;

  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'verification.received', 'brevo_transactional',
          'account:' || p_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id,
                                        'request_id', p_request_id),
          'verification.received:' || p_request_id::text);

  perform audit.append('verification.submitted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_level));
  return v_at;
end
$$;

comment on function verification.submit_request_of(uuid, uuid) is
  'Helper of the member doors (0222): a draft becomes pending (queue 4; submitted_at, sla_due_at, '
  'escalate_at frozen by the trigger), verification.received queued (ids only), register line '
  'verification.submitted {level}; returns submitted_at. 55000 request_not_draft otherwise. The '
  'caller checked the preconditions with the row locked. SECURITY INVOKER; owned by '
  'influx_creator_verification_definer, EXECUTE for influx_identity_definer.';

create or replace function verification.cancel_request_of(
  p_request_id  uuid,
  p_account_id  uuid,
  p_cause       text)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_at     timestamptz;
  v_level  verification.badge_level;
begin
  update verification.verification_requests r
     set status = 'cancelled', cancelled_at = pg_catalog.now(), closed_at = pg_catalog.now()
   where r.id = p_request_id and r.account_id = p_account_id and r.status in ('draft', 'pending')
  returning r.cancelled_at, r.level into v_at, v_level;
  if v_at is null then
    raise exception 'entry_closed' using
      errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;

  update verification.ownership_codes c
     set revoked_at = pg_catalog.now()
   where c.request_id = p_request_id and c.revoked_at is null;

  perform audit.append('verification.cancelled', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_level, 'cause', p_cause));
  return v_at;
end
$$;

comment on function verification.cancel_request_of(uuid, uuid, text) is
  'Helper of the member doors (0222): a draft or pending request, without any decision, becomes '
  'cancelled (cancelled_at, closed_at), its live code revoked; register line verification.cancelled '
  '{level, cause: member | line_deleted}; returns cancelled_at. 55000 entry_closed otherwise. The '
  'evidence rows go to purging with 0223 (EC-L2E-06-8). SECURITY INVOKER; owned by '
  'influx_creator_verification_definer, EXECUTE for influx_identity_definer.';

-- 6. The creator doors (SECURITY DEFINER, influx_creator_verification_definer) ----------------------

create or replace function verification.open_own_request(
  p_social_account_id  uuid,
  p_level              verification.badge_level)
returns table (
  request_id  uuid,
  status      text,
  created     boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- the account comes from the transaction context (03 P2), never a parameter
  v_account  uuid := influx.current_account_id();
  v_network  text;
  v_open     record;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_level is null or p_level not in ('account_verified', 'audience_verified') then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  -- another creator's line answers as an unknown one (T14, L2E-D9)
  select l.network_code into v_network
    from profiles.creator_social_accounts l
   where l.id = p_social_account_id and l.account_id = v_account;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  select o.request_id, o.status, o.created into v_open
    from verification.open_request_of(v_account, p_social_account_id, v_network, p_level) o;
  -- EC-L2E-06-2: the code of an account request comes with its opening
  if v_open.created and p_level = 'account_verified' then
    perform 1 from verification.verification_requests r where r.id = v_open.request_id for update;
    perform verification.issue_ownership_code(v_open.request_id, v_account, 'network');
  end if;
  return query select v_open.request_id, v_open.status, v_open.created;
end
$$;

comment on function verification.open_own_request(uuid, verification.badge_level) is
  '08 RG14, RG21, RG60 (0222): an active creator opens a request on one of his network lines, '
  'level account_verified or audience_verified; returns (request_id, draft, created). The code of '
  'an account request is issued with it (EC-L2E-06-2). Refusals: verification.open_request_of(); '
  '22023 level; 42501 outside an active creator account, and for another''s line as for an '
  'unknown one. SECURITY DEFINER owned by influx_creator_verification_definer, empty search_path; '
  'EXECUTE for influx_creator only.';

create or replace function verification.renew_own_code(p_request_id uuid)
returns table (
  code_id     uuid,
  code        text,
  expires_at  timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_request  record;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select r.id, r.level, r.status::text as status into v_request
    from verification.verification_requests r
   where r.id = p_request_id and r.account_id = v_account
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_request.level <> 'account_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  if v_request.status <> 'draft' then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;
  return query select i.code_id, i.code, i.expires_at
                 from verification.issue_ownership_code(p_request_id, v_account, 'network') i;
end
$$;

comment on function verification.renew_own_code(uuid) is
  '08 RG22, RG23 (0222): on his own draft account request, an active creator gets a new code, the '
  'former one revoked in the same transaction; returns (code_id, code, expires_at). 22023 level '
  'for an audience request; 55000 request_not_draft once submitted or ended; 42501 outside an '
  'active creator account, and for another''s request as for an unknown one. SECURITY DEFINER '
  'owned by influx_creator_verification_definer, empty search_path; EXECUTE for influx_creator only.';

create or replace function verification.submit_own_request(p_request_id uuid)
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
  v_account  uuid := influx.current_account_id();
  v_request  record;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the row lock serialises two submissions (double click): the second reads the first's state
  select r.id, r.level, r.status::text as status, r.social_account_id, r.submitted_at
    into v_request
    from verification.verification_requests r
   where r.id = p_request_id and r.account_id = v_account
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- 08 edge case 3: submitted again, nothing is written
  if v_request.status = 'pending' then
    return query select 'pending'::text, v_request.submitted_at, false;
    return;
  end if;
  if v_request.status <> 'draft' then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;

  if v_request.level = 'account_verified' then
    -- EC-L2E-06-3: the agent reads a live code, never a dead one
    if not exists (select 1 from verification.ownership_codes c
                    where c.request_id = p_request_id and c.revoked_at is null
                      and c.expires_at > pg_catalog.now()) then
      raise exception 'code_expired' using
        errcode = 'object_not_in_prerequisite_state', detail = 'code_expired';
    end if;
  else
    -- RG12: the audience of an account whose ownership is not established is not examined
    if not exists (select 1 from verification.badges b
                    where b.account_id = v_account
                      and b.social_account_id = v_request.social_account_id
                      and b.level = 'account_verified' and b.state = 'active') then
      raise exception 'ownership_prerequisite' using
        errcode = 'object_not_in_prerequisite_state', detail = 'ownership_prerequisite';
    end if;
    -- -13: an audience request is submitted with one active evidence at least
    if not exists (select 1 from verification.evidence_files e
                    where e.request_id = p_request_id and e.account_id = v_account
                      and e.state = 'active') then
      raise exception 'missing_evidence' using
        errcode = 'object_not_in_prerequisite_state', detail = 'missing_evidence';
    end if;
  end if;

  return query select 'pending'::text, verification.submit_request_of(p_request_id, v_account), true;
end
$$;

comment on function verification.submit_own_request(uuid) is
  '08 RG12, RG14, RG44 point 1, edge case 3 (0222): an active creator submits his own draft '
  'request to queue 4 (verification.submit_request_of()); returns (pending, submitted_at, true). '
  'Already pending: nothing written, (pending, its instant, false). 55000 code_expired for an '
  'account request without a live code (EC-L2E-06-3), ownership_prerequisite for an audience '
  'request without an active account badge on the line (RG12), missing_evidence without an active '
  'evidence (-13), request_not_draft once ended; 42501 outside an active creator account, and for '
  'another''s request as for an unknown one. SECURITY DEFINER owned by '
  'influx_creator_verification_definer, empty search_path; EXECUTE for influx_creator only.';

create or replace function verification.cancel_own_request(p_request_id uuid)
returns table (
  status        text,
  cancelled_at  timestamptz,
  changed       boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_request  record;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select r.id, r.status::text as status, r.cancelled_at into v_request
    from verification.verification_requests r
   where r.id = p_request_id and r.account_id = v_account
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_request.status = 'cancelled' then
    return query select 'cancelled'::text, v_request.cancelled_at, false;
    return;
  end if;
  return query select 'cancelled'::text,
                      verification.cancel_request_of(p_request_id, v_account, 'member'), true;
end
$$;

comment on function verification.cancel_own_request(uuid) is
  '08 RG14 (0222): an active creator cancels his own draft or pending request, before any decision '
  '(verification.cancel_request_of(), cause member); returns (cancelled, cancelled_at, true); '
  'already cancelled: (cancelled, its instant, false). 55000 entry_closed once decided, expired or '
  'closed; 42501 outside an active creator account, and for another''s request as for an unknown '
  'one. SECURITY DEFINER owned by influx_creator_verification_definer, empty search_path; EXECUTE '
  'for influx_creator only.';

create or replace function verification.cancel_open_requests_of_line()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row  record;
begin
  for v_row in
    select r.id from verification.verification_requests r
     where r.account_id = old.account_id and r.social_account_id = old.id
       and r.status in ('draft', 'pending')
     order by r.id
       for update
  loop
    perform verification.cancel_request_of(v_row.id, old.account_id, 'line_deleted');
  end loop;
  return old;
end
$$;

comment on function verification.cancel_open_requests_of_line() is
  'AFTER DELETE on profiles.creator_social_accounts (modele -16, 0222): the draft and pending '
  'requests of the deleted line are cancelled (cause line_deleted), their code revoked; the badge '
  'is left to L2F. The caller''s own rows only (policies of the owner). Never on the erasure '
  '(WHEN current_user <> influx_privacy_definer). SECURITY DEFINER owned by '
  'influx_creator_verification_definer, empty search_path; no EXECUTE for anyone.';

drop trigger if exists creator_social_accounts_cancel_open_verification_requests
  on profiles.creator_social_accounts;
create trigger creator_social_accounts_cancel_open_verification_requests
  after delete on profiles.creator_social_accounts
  for each row when (current_user <> 'influx_privacy_definer')
  execute function verification.cancel_open_requests_of_line();

-- 7. The brand doors (SECURITY DEFINER, influx_identity_definer) ------------------------------------

create or replace function profiles.open_own_brand_verification()
returns table (
  request_id  uuid,
  status      text,
  created     boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_domain   text;
  v_open     record;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'advertiser'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select p.website_domain into v_domain
    from profiles.advertiser_profiles p where p.account_id = v_account;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- 06 CA26: the domain is indispensable to the badge
  if v_domain is null then
    raise exception 'website_domain_required' using
      errcode = 'check_violation', detail = 'website_domain_required';
  end if;

  select o.request_id, o.status, o.created into v_open
    from verification.open_request_of(v_account, null, null, 'brand_verified') o;
  -- -15, 06 CA27: the code of the domain comes with the opening
  if v_open.created then
    perform 1 from verification.verification_requests r where r.id = v_open.request_id for update;
    perform verification.issue_ownership_code(v_open.request_id, v_account, 'domain');
  end if;
  return query select v_open.request_id, v_open.status, v_open.created;
end
$$;

comment on function profiles.open_own_brand_verification() is
  '06 RG51, CA26, CA27 (0222): an active advertiser opens the request of the badge « Marque '
  'vérifiée », its domain code issued with it (-15); returns (request_id, draft, created). 23514 '
  'website_domain_required without a domain (CA26); the refusals of verification.open_request_of(); '
  '42501 outside an active advertiser account holding a profile. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser only.';

create or replace function profiles.save_own_brand_internal_details(
  p_legal_name                 text,
  p_registration_country_code  text,
  p_registration_number        text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_name     text := pg_catalog.btrim(p_legal_name);
  v_country  text := pg_catalog.upper(pg_catalog.btrim(p_registration_country_code));
  v_number   text := pg_catalog.btrim(p_registration_number);
  v_at       timestamptz;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'advertiser'
            join profiles.advertiser_profiles p on p.account_id = a.id
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- RG46: three required fields, each named in DETAIL
  if v_name is null or pg_catalog.char_length(v_name) not between 1 and 160
     or v_name ~ '[[:cntrl:]]' then
    raise exception 'internal_details_invalid' using
      errcode = 'invalid_parameter_value', detail = 'legal_name';
  end if;
  if v_country is null or not exists (select 1 from reference.countries c where c.code = v_country) then
    raise exception 'internal_details_invalid' using
      errcode = 'invalid_parameter_value', detail = 'registration_country_code';
  end if;
  if v_number is null or pg_catalog.char_length(v_number) not between 1 and 40
     or v_number ~ '[[:cntrl:]]' then
    raise exception 'internal_details_invalid' using
      errcode = 'invalid_parameter_value', detail = 'registration_number';
  end if;

  insert into profiles.advertiser_internal_details
    (account_id, legal_name, registration_country_code, registration_number)
  values (v_account, v_name, v_country, v_number)
  on conflict (account_id) do update
     set legal_name                = excluded.legal_name,
         registration_country_code = excluded.registration_country_code,
         registration_number       = excluded.registration_number
  returning updated_at into v_at;
  return v_at;
end
$$;

comment on function profiles.save_own_brand_internal_details(text, text, text) is
  '06 RG46, RG47 (0222): an active advertiser writes his internal block (legal name <= 160, country '
  'of registration of reference.countries, number <= 40, no format by country), trimmed; returns '
  'updated_at. 22023 internal_details_invalid DETAIL the field; 42501 outside an active advertiser '
  'account holding a profile. No register line (EC-L2E-06-7). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser only.';

create or replace function profiles.renew_own_brand_verification_code()
returns table (
  code_id     uuid,
  code        text,
  expires_at  timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_request  uuid;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'advertiser'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select r.id into v_request
    from verification.verification_requests r
   where r.account_id = v_account and r.level = 'brand_verified' and r.status = 'draft'
     for update;
  if v_request is null then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;
  return query select i.code_id, i.code, i.expires_at
                 from verification.issue_ownership_code(v_request, v_account, 'domain') i;
end
$$;

comment on function profiles.renew_own_brand_verification_code() is
  '06 RG51 (0222): on his draft brand request, an active advertiser gets a new domain code, the '
  'former one revoked; returns (code_id, code, expires_at). 55000 request_not_draft without a '
  'draft; 42501 outside an active advertiser account. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser only.';

create or replace function profiles.submit_own_brand_verification()
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
  v_account  uuid := influx.current_account_id();
  v_request  record;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'advertiser'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select r.id, r.status::text as status, r.submitted_at into v_request
    from verification.verification_requests r
   where r.account_id = v_account and r.level = 'brand_verified'
     and r.status in ('draft', 'pending')
     for update;
  if not found then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;
  if v_request.status = 'pending' then
    return query select 'pending'::text, v_request.submitted_at, false;
    return;
  end if;
  -- CA26: the domain is still there
  if not exists (select 1 from profiles.advertiser_profiles p
                  where p.account_id = v_account and p.website_domain is not null) then
    raise exception 'website_domain_required' using
      errcode = 'check_violation', detail = 'website_domain_required';
  end if;
  -- RG47: the internal block is asked at the badge request
  if not exists (select 1 from profiles.advertiser_internal_details d
                  where d.account_id = v_account) then
    raise exception 'internal_details_required' using
      errcode = 'check_violation', detail = 'internal_details_required';
  end if;
  if not exists (select 1 from verification.ownership_codes c
                  where c.request_id = v_request.id and c.revoked_at is null
                    and c.expires_at > pg_catalog.now()) then
    raise exception 'code_expired' using
      errcode = 'object_not_in_prerequisite_state', detail = 'code_expired';
  end if;

  return query select 'pending'::text, verification.submit_request_of(v_request.id, v_account), true;
end
$$;

comment on function profiles.submit_own_brand_verification() is
  '06 RG47, RG51, CA26 (0222): an active advertiser submits his draft brand request to queue 4; '
  'returns (pending, submitted_at, true); already pending: (pending, its instant, false). 23514 '
  'website_domain_required, internal_details_required; 55000 code_expired (EC-L2E-06-3), '
  'request_not_draft without an open request; 42501 outside an active advertiser account. SECURITY '
  'DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for influx_advertiser only.';

create or replace function profiles.cancel_own_brand_verification()
returns table (
  status        text,
  cancelled_at  timestamptz,
  changed       boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_request  record;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'advertiser'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the latest brand request (the open one, if any: at most one, RG14)
  select r.id, r.status::text as status, r.cancelled_at into v_request
    from verification.verification_requests r
   where r.account_id = v_account and r.level = 'brand_verified'
   order by (r.status in ('draft', 'pending')) desc, r.created_at desc
   limit 1
     for update;
  if not found then
    raise exception 'entry_closed' using
      errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_request.status = 'cancelled' then
    return query select 'cancelled'::text, v_request.cancelled_at, false;
    return;
  end if;
  return query select 'cancelled'::text,
                      verification.cancel_request_of(v_request.id, v_account, 'member'), true;
end
$$;

comment on function profiles.cancel_own_brand_verification() is
  '06 RG51 (0222): an active advertiser cancels his open brand request, before any decision; '
  'returns (cancelled, cancelled_at, true); the latest already cancelled: (cancelled, its instant, '
  'false). 55000 entry_closed without a request or once decided; 42501 outside an active advertiser '
  'account. SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for '
  'influx_advertiser only.';

create or replace function profiles.read_own_brand_verification()
returns table (
  request_id                 uuid,
  request_status             text,
  requested_at               timestamptz,
  submitted_at               timestamptz,
  decided_at                 timestamptz,
  rejection_reason_code      text,
  member_message             text,
  code                       text,
  code_expires_at            timestamptz,
  website_domain             text,
  legal_name                 text,
  registration_country_code  text,
  registration_number        text,
  badge_state                text,
  badge_granted_at           timestamptz,
  badge_expires_at           timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'advertiser'
            join profiles.advertiser_profiles p on p.account_id = a.id
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query
    select q.id, q.status::text, q.created_at, q.submitted_at, q.decided_at,
           q.rejection_reason_code, q.member_message, c.code, c.expires_at,
           p.website_domain, d.legal_name, d.registration_country_code::text,
           d.registration_number, b.state::text, b.granted_at, b.expires_at
      from profiles.advertiser_profiles p
      left join profiles.advertiser_internal_details d on d.account_id = p.account_id
      left join lateral (
             select r.id, r.status, r.created_at, r.submitted_at, r.decided_at,
                    r.rejection_reason_code, r.member_message
               from verification.verification_requests r
              where r.account_id = p.account_id and r.level = 'brand_verified'
              order by r.created_at desc, r.id
              limit 1) q on true
      -- the live code of an open request only (RG23)
      left join verification.ownership_codes c
             on c.request_id = q.id and c.revoked_at is null and q.status in ('draft', 'pending')
      left join lateral (
             select x.state, x.granted_at, x.expires_at
               from verification.badges x
              where x.account_id = p.account_id and x.level = 'brand_verified'
                and x.state in ('active', 'to_refresh')
              order by x.granted_at desc
              limit 1) b on true
     where p.account_id = v_account;
end
$$;

comment on function profiles.read_own_brand_verification() is
  '06 RG46, RG49, RG51 (0222): what an active advertiser sees of his badge « Marque vérifiée »: '
  'his latest request (status, dates, reason and message of a refusal), its live code while open, '
  'his domain, his internal block, and his holding badge (state, dates). Never the agent, the '
  'internal comment, the lock nor what the agent observed. One row; 42501 outside an active '
  'advertiser account holding a profile. SECURITY DEFINER owned by influx_identity_definer, empty '
  'search_path; EXECUTE for influx_advertiser only.';

-- 8. Rights on the functions, then to their owners (03 P7 rule 5) -----------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.new_ownership_code()',
    'verification.open_request_of(uuid, uuid, text, verification.badge_level)',
    'verification.issue_ownership_code(uuid, uuid, text)',
    'verification.submit_request_of(uuid, uuid)',
    'verification.cancel_request_of(uuid, uuid, text)',
    'verification.open_own_request(uuid, verification.badge_level)',
    'verification.renew_own_code(uuid)',
    'verification.submit_own_request(uuid)',
    'verification.cancel_own_request(uuid)',
    'verification.cancel_open_requests_of_line()',
    'profiles.open_own_brand_verification()',
    'profiles.save_own_brand_internal_details(text, text, text)',
    'profiles.renew_own_brand_verification_code()',
    'profiles.submit_own_brand_verification()',
    'profiles.cancel_own_brand_verification()',
    'profiles.read_own_brand_verification()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', f);
  end loop;
end
$$;

grant execute on function
  verification.new_ownership_code(),
  verification.open_request_of(uuid, uuid, text, verification.badge_level),
  verification.issue_ownership_code(uuid, uuid, text),
  verification.submit_request_of(uuid, uuid),
  verification.cancel_request_of(uuid, uuid, text)
  to influx_identity_definer;
grant execute on function
  verification.open_own_request(uuid, verification.badge_level),
  verification.renew_own_code(uuid),
  verification.submit_own_request(uuid),
  verification.cancel_own_request(uuid)
  to influx_creator;
grant execute on function
  profiles.open_own_brand_verification(),
  profiles.save_own_brand_internal_details(text, text, text),
  profiles.renew_own_brand_verification_code(),
  profiles.submit_own_brand_verification(),
  profiles.cancel_own_brand_verification(),
  profiles.read_own_brand_verification()
  to influx_advertiser;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_verification_definer', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema verification to influx_creator_verification_definer;
grant create on schema profiles to influx_identity_definer;

alter function verification.new_ownership_code() owner to influx_creator_verification_definer;
alter function verification.open_request_of(uuid, uuid, text, verification.badge_level)
  owner to influx_creator_verification_definer;
alter function verification.issue_ownership_code(uuid, uuid, text)
  owner to influx_creator_verification_definer;
alter function verification.submit_request_of(uuid, uuid) owner to influx_creator_verification_definer;
alter function verification.cancel_request_of(uuid, uuid, text)
  owner to influx_creator_verification_definer;
alter function verification.open_own_request(uuid, verification.badge_level)
  owner to influx_creator_verification_definer;
alter function verification.renew_own_code(uuid) owner to influx_creator_verification_definer;
alter function verification.submit_own_request(uuid) owner to influx_creator_verification_definer;
alter function verification.cancel_own_request(uuid) owner to influx_creator_verification_definer;
alter function verification.cancel_open_requests_of_line()
  owner to influx_creator_verification_definer;
alter function profiles.open_own_brand_verification() owner to influx_identity_definer;
alter function profiles.save_own_brand_internal_details(text, text, text)
  owner to influx_identity_definer;
alter function profiles.renew_own_brand_verification_code() owner to influx_identity_definer;
alter function profiles.submit_own_brand_verification() owner to influx_identity_definer;
alter function profiles.cancel_own_brand_verification() owner to influx_identity_definer;
alter function profiles.read_own_brand_verification() owner to influx_identity_definer;

revoke create on schema verification from influx_creator_verification_definer;
revoke create on schema profiles from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_verification_definer', current_user);
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 9. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- NON REVERSIBLE (fiche invariant 1, EC-L2E-18): still nothing for influx_advertiser on the schema
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'verification'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'influx_advertiser may execute: %', v_bad;
  end if;
  -- the owner of the brand doors holds no right on the evidence (EC-L2E-18)
  if pg_catalog.has_table_privilege('influx_identity_definer', 'verification.evidence_files',
                                    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or pg_catalog.has_any_column_privilege('influx_identity_definer', 'verification.evidence_files',
                                            'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_identity_definer holds a right on verification.evidence_files';
  end if;

  -- still no execution role writing the schema nor the internal block directly
  select string_agg(r.rolname || ' ' || c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_roles r, pg_catalog.pg_class c
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and c.relkind in ('r', 'p')
     and (c.relnamespace = 'verification'::regnamespace
          or c.oid = 'profiles.advertiser_internal_details'::regclass)
     and (pg_catalog.has_any_column_privilege(r.oid, c.oid, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'execution role(s) writing a verification table: %', v_bad;
  end if;

  -- RG48: the internal block reaches neither a creator, Brevo, Apollo nor their definer
  select string_agg(r, ', ') into v_bad
    from unnest(array['influx_creator', 'influx_advertiser', 'influx_leads_definer',
                      'influx_worker', 'influx_creator_verification_definer']) r
   where pg_catalog.has_any_column_privilege(r, 'profiles.advertiser_internal_details',
                                             'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'the internal block is readable by: %', v_bad;
  end if;
  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'profiles.advertiser_internal_details'::regclass) then
    raise exception 'row level security must be enabled and forced on advertiser_internal_details';
  end if;

  -- the sixteen functions: owner, SECURITY DEFINER or INVOKER, empty search_path
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('verification.new_ownership_code()', 'influx_creator_verification_definer', false),
      ('verification.open_request_of(uuid,uuid,text,verification.badge_level)',
       'influx_creator_verification_definer', false),
      ('verification.issue_ownership_code(uuid,uuid,text)', 'influx_creator_verification_definer', false),
      ('verification.submit_request_of(uuid,uuid)', 'influx_creator_verification_definer', false),
      ('verification.cancel_request_of(uuid,uuid,text)', 'influx_creator_verification_definer', false),
      ('verification.open_own_request(uuid,verification.badge_level)',
       'influx_creator_verification_definer', true),
      ('verification.renew_own_code(uuid)', 'influx_creator_verification_definer', true),
      ('verification.submit_own_request(uuid)', 'influx_creator_verification_definer', true),
      ('verification.cancel_own_request(uuid)', 'influx_creator_verification_definer', true),
      ('verification.cancel_open_requests_of_line()', 'influx_creator_verification_definer', true),
      ('profiles.open_own_brand_verification()', 'influx_identity_definer', true),
      ('profiles.save_own_brand_internal_details(text,text,text)', 'influx_identity_definer', true),
      ('profiles.renew_own_brand_verification_code()', 'influx_identity_definer', true),
      ('profiles.submit_own_brand_verification()', 'influx_identity_definer', true),
      ('profiles.cancel_own_brand_verification()', 'influx_identity_definer', true),
      ('profiles.read_own_brand_verification()', 'influx_identity_definer', true)
    ) as f (sig, owner, definer)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> f.owner
      or p.prosecdef <> f.definer
      or p.proconfig is distinct from array['search_path=""'];
  if v_bad is not null then
    raise exception 'function(s) without their owner, security or search_path: %', v_bad;
  end if;

  -- no definer role left usable nor with CREATE on its schemas
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_creator_verification_definer', 'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_creator_verification_definer', 'verification', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'profiles', 'CREATE') then
    raise exception 'a definer role left with CREATE on a schema';
  end if;
end
$$;
