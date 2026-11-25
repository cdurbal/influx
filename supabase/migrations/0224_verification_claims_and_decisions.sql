-- =============================================================================
-- 0224_verification_claims_and_decisions
-- -----------------------------------------------------------------------------
-- Lot 2 / L2E, commit 08 (jalons/l2e/08.md; l2e/modele.md §1 point 3, §3, §4 "Agent", "Erreurs",
-- "Registre", "Outbox", §5; l2c/file.md A1 to A9; fiche invariants 2, 5, 6, 9 to 11, 17; 08 RG12,
-- RG25, RG36 to RG38bis, RG43 to RG54, RG56, RG57, RG59, RG61 to RG67, edge cases l. 785-811;
-- 06 RG51, RG52). Queue 4 seen from the backoffice: the claim, the dossier, the comparison, the
-- three grants, the refusal, "to re-examine", the journalled read of an evidence, the registry
-- sources of an administrator. No public band (0225), no export nor erasure (0226), no route.
--
--   influx_verification_definer   NOLOGIN NOINHERIT, no member (modele §1 point 3): owns every
--         function below; reads the requests, codes, evidence rows (the key included, D82 (5)),
--         badges, lines and brand blocks of OTHER accounts than the caller's (C(3)), column by
--         column; writes the claim and the decision of a pending request, the finding of a code,
--         a badge (inserted active, or replaced), a registry source. Never an evidence row, never
--         Storage, never a member door.
--   Helpers (SECURITY INVOKER, no EXECUTE): verification.require_agent(admin_only),
--         lock_held_request(request, caller), request_review_token(request), check_internal_comment,
--         check_observed_figures, check_observed_period, queue_decision.
--   Agent and admin (SECURITY DEFINER, EXECUTE influx_agent and influx_admin, aal2, active agent
--         profile): open_request, release_request, extend_request_claim,
--         force_release_request_claim (admin), read_request_dossier, compare_request_figures,
--         reexamine_request, grant_account_verified, grant_audience_verified, grant_brand_verified,
--         reject_request, read_evidence, set_registry_source (admin).
--
-- Refusals (modele §4 "Erreurs"; the MESSAGE is the code, the DETAIL its precision):
--   42501 forbidden          outside an active agent or admin in aal2; an unknown or draft request,
--                            one of the caller's own account, an open one of an account he holds
--                            (identity.accounts.owner_agent_id, 08 RG53; apps/api journals
--                            queue.conflict_of_interest through backoffice.record_refused_action);
--                            an evidence unknown, of another request, not active.
--   55P03 no_live_claim      DETAIL the live holder, or none (RG64: never a decision without it).
--   55000 entry_closed, stale_token, ownership_prerequisite, missing_evidence, no_registry_source,
--         account_unavailable.
--   22023 level, code_mismatch, period_invalid (DETAIL period_missing, period_order, period_future,
--         period_too_old), figures_invalid (DETAIL the field), reason, member_message,
--         internal_comment, observed_handle, observed_platform_account_ref, observed_domain,
--         observed_channel, checked_on.
--   23514 website_domain_required, internal_details_required, declared_figures_required.
--
-- EC-L2E-08 (micro-gaps, the safest choice):
--   EC-L2E-08-1   0224 is the next free number (ls supabase/migrations).
--   EC-L2E-08-2   handle_already_verified (edge case l. 800) is an OUTCOME of grant_account_verified,
--                 not a raise: a raise would roll back the refusal and the two escalations the edge
--                 case requires. The finding is written, the request rejected ownership_not_proven
--                 by the agent who read the code, both requests escalated (escalated_at, line
--                 verification.escalated); no badge.
--   EC-L2E-08-3   the dossier never returns the generated code: the agent types what he reads on
--                 line, the base compares (RG45, CA13, CA14).
--   EC-L2E-08-4   the code compared is the live (non revoked) code of the request, even past its
--                 expires_at: the submission required it live (EC-L2E-06-3); the agent's delay never
--                 voids the creator's proof.
--   EC-L2E-08-5   a grant on an account that is not active: 55000 account_unavailable; the agent
--                 closes the request with the reason account_unavailable (status closed), never the
--                 base on its own (08 edge case l. 811).
--   EC-L2E-08-6   `minor` needs the live claim but not the review token (RG54: at any step); the
--                 other requests of the account are left to the administrator (D15; the escalation
--                 screen is Lot 5, -17).
--   EC-L2E-08-7   a member message only for a reason that requires it (other, terms_breach), as
--                 0215; the internal comment, 1 000 characters, never in the register nor the queue.
--   EC-L2E-08-8   the period on the UTC date: end <= today, today - end < evidence_freshness_days
--                 (RG36: "moins de 30 jours", CA18); figures whole and >= 0, engagement 0 to 10 000
--                 basis points, optional (EC-L2E-12).
--   EC-L2E-08-9   brand: the observed domain is the website domain of the profile or one of its
--                 subdomains (22023 observed_domain); the registry source is active and of the
--                 country of registration, or GLEIF (55000 no_registry_source).
--   EC-L2E-08-10  a draft request is not an entry of the queue: 42501, as an unknown one. Release
--                 and forced release stay open on an account the caller holds (0215).
--   EC-L2E-08-11  an audience grant needs the declared posts and comments of the line (04 l. 6391:
--                 required on the badge): 23514 declared_figures_required.
--   EC-L2E-08-12  "to re-examine" releases the claim (RG50: the entry returns to the queue) and writes
--                 queue.claim_released besides verification.to_reexamine; the age runs on (the
--                 deadlines are frozen, 0221).
--   EC-L2E-08-13  the dossier returns the review token computed in ITS snapshot: a decision is taken
--                 on the version shown (the ABA of L2CS-1, without locking the line).
--   EC-L2E-08-14  a decision closes the request (closed_at = decided_at, constraint of 0221) and keeps
--                 the claim columns as they were (the trace of who held it).
--   EC-L2E-08-15  set_registry_source updates an existing source; a second active source for one
--                 country is refused by the index of 0221 (23505): deactivate first.
--   EC-L2E-08-16  the observed handle is compared without case nor leading `@`; the stable
--                 reference of the account too when both are known.
--
-- ROLLBACK (before any decision is written): drop the twenty functions of sections 4 to 6; drop the
-- policies *_verification_definer_* named below and revoke their grants; drop role
-- influx_verification_definer.
-- =============================================================================

-- 1. The owner of the decisions (03 P7 rule 5; rules 1 and 2 of 0001; modele §1 point 3) ----------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_verification_definer') then
    create role influx_verification_definer with nologin noinherit;
  end if;
  alter role influx_verification_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_verification_definer' and rolsuper) then
    raise exception 'role influx_verification_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_verification_definer' and rolbypassrls) then
    alter role influx_verification_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_verification_definer' and rolreplication) then
    alter role influx_verification_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_verification_definer' and rolcreatedb) then
    alter role influx_verification_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_verification_definer' and rolcreaterole) then
    alter role influx_verification_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. What influx_verification_definer reads and writes ------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner. The
-- functions check the caller themselves (agent or admin, aal2, active); the policies keep the rows
-- of the caller's own account out (C(3), 15 RG36) as a second line.

grant usage on schema verification, profiles, identity, backoffice, leads, audit, influx
   to influx_verification_definer;
grant execute on function influx.current_account_id(),
                          influx.current_account_role(),
                          influx.current_aal(),
                          influx.has_aal2()
   to influx_verification_definer;

-- 2.1 The caller (an active internal account) and the target (its status, its responsible agent)
grant select (id, status, owner_agent_id) on identity.accounts to influx_verification_definer;
grant select (account_id, role) on identity.account_roles to influx_verification_definer;
grant select (account_id, is_active) on identity.agent_profiles to influx_verification_definer;

drop policy if exists accounts_verification_definer_select on identity.accounts;
create policy accounts_verification_definer_select on identity.accounts
  for select to influx_verification_definer
  using (true);
drop policy if exists account_roles_verification_definer_select on identity.account_roles;
create policy account_roles_verification_definer_select on identity.account_roles
  for select to influx_verification_definer
  using (true);
drop policy if exists agent_profiles_verification_definer_select on identity.agent_profiles;
create policy agent_profiles_verification_definer_select on identity.agent_profiles
  for select to influx_verification_definer
  using (true);

-- 2.2 The requests: the claim, the forced release, the decision, the re-examination, the escalation
grant select (id, account_id, social_account_id, network_code, level, population, status,
              created_at, submitted_at, sla_due_at, escalate_at, claimed_by_account_id, claimed_at,
              claim_expires_at, decided_at, rejection_reason_code, reexamine_reason_code,
              reexamined_at, escalated_at, sla_breached)
   on verification.verification_requests to influx_verification_definer;
grant update (claimed_by_account_id, claimed_at, claim_expires_at, forced_release_at,
              forced_release_by_account_id, forced_release_holder_account_id,
              forced_release_reason_code, status, decided_by_account_id, decided_at,
              rejection_reason_code, member_message, internal_comment, reexamine_reason_code,
              reexamined_at, escalated_at, closed_at)
   on verification.verification_requests to influx_verification_definer;

drop policy if exists verification_requests_verification_definer_select
  on verification.verification_requests;
create policy verification_requests_verification_definer_select
  on verification.verification_requests
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));
-- USING without a status: FOR UPDATE of an ended request still finds it (55000, not 42501); the
-- trigger of 0221 moves the status forward only, WITH CHECK keeps the four a decision writes (an
-- escalation touches an approved request, EC-L2E-08-2)
drop policy if exists verification_requests_verification_definer_update
  on verification.verification_requests;
create policy verification_requests_verification_definer_update
  on verification.verification_requests
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (account_id is distinct from (select influx.current_account_id())
              and status in ('pending', 'approved', 'rejected', 'closed'));

-- 2.3 The codes: compared, and their finding written once (RG25, CA13)
grant select (id, request_id, account_id, kind, code, expires_at, revoked_at, observed_at)
   on verification.ownership_codes to influx_verification_definer;
grant update (observed_by_account_id, observed_at, observed_handle, observed_platform_account_ref,
              observed_domain, observed_channel)
   on verification.ownership_codes to influx_verification_definer;

drop policy if exists ownership_codes_verification_definer_select on verification.ownership_codes;
create policy ownership_codes_verification_definer_select on verification.ownership_codes
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists ownership_codes_verification_definer_update on verification.ownership_codes;
create policy ownership_codes_verification_definer_update on verification.ownership_codes
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id())
         and revoked_at is null and observed_at is null)
  with check (account_id is distinct from (select influx.current_account_id())
              and observed_at is not null);

-- 2.4 The evidence: read only, the key for the journalled read (D82 (5), EC-L2E-07-6)
grant select (id, request_id, account_id, object_key, state, byte_size, width, height, checksum,
              activated_at)
   on verification.evidence_files to influx_verification_definer;

drop policy if exists evidence_files_verification_definer_select on verification.evidence_files;
create policy evidence_files_verification_definer_select on verification.evidence_files
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));

-- 2.5 The badges: inserted active by the named agent, a holding one replaced (EC-L2E-14)
grant select (id, account_id, social_account_id, network_code, request_id, level, granted_at,
              expires_at, state, observed_handle_at_decision, observed_platform_account_ref)
   on verification.badges to influx_verification_definer;
grant insert (account_id, social_account_id, network_code, request_id, level,
              granted_by_account_id, granted_at, evidence_source, registry_source_id,
              observed_followers, observed_posts_last_30_days, observed_avg_comments,
              observed_engagement_bp, observed_period_start, observed_period_end,
              declared_followers_at_decision, declared_posts_at_decision,
              declared_comments_at_decision, declared_engagement_bp_at_decision,
              observed_handle_at_decision, observed_platform_account_ref, expires_at)
   on verification.badges to influx_verification_definer;
grant update (state) on verification.badges to influx_verification_definer;

drop policy if exists badges_verification_definer_select on verification.badges;
create policy badges_verification_definer_select on verification.badges
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists badges_verification_definer_insert on verification.badges;
create policy badges_verification_definer_insert on verification.badges
  for insert to influx_verification_definer
  with check (account_id is distinct from (select influx.current_account_id())
              and granted_by_account_id = (select influx.current_account_id())
              and state = 'active');
drop policy if exists badges_verification_definer_update on verification.badges;
create policy badges_verification_definer_update on verification.badges
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id())
         and state in ('active', 'to_refresh', 'to_reconfirm'))
  with check (state = 'replaced');

-- 2.6 The catalogues: the refusal reasons, the registry sources (written by an admin), the claim
-- release reasons, the parameters of the decisions
grant select (population, code, requires_member_message, escalates_to_admin, is_active)
   on verification.rejection_reasons to influx_verification_definer;
drop policy if exists rejection_reasons_verification_definer_select on verification.rejection_reasons;
create policy rejection_reasons_verification_definer_select on verification.rejection_reasons
  for select to influx_verification_definer
  using (true);

grant select (id, country_code, source_type, name, url, checked_on, is_active, updated_at)
   on verification.registry_sources to influx_verification_definer;
grant update (name, url, checked_on, is_active, updated_by_account_id)
   on verification.registry_sources to influx_verification_definer;
drop policy if exists registry_sources_verification_definer_select on verification.registry_sources;
create policy registry_sources_verification_definer_select on verification.registry_sources
  for select to influx_verification_definer
  using (true);
drop policy if exists registry_sources_verification_definer_update on verification.registry_sources;
create policy registry_sources_verification_definer_update on verification.registry_sources
  for update to influx_verification_definer
  using (true)
  with check (updated_by_account_id = (select influx.current_account_id()));

grant select (code, is_active) on backoffice.claim_release_reasons to influx_verification_definer;
drop policy if exists claim_release_reasons_verification_definer_select
  on backoffice.claim_release_reasons;
create policy claim_release_reasons_verification_definer_select on backoffice.claim_release_reasons
  for select to influx_verification_definer
  using (true);

grant select (key, value) on backoffice.operational_settings to influx_verification_definer;
drop policy if exists operational_settings_verification_definer_select
  on backoffice.operational_settings;
create policy operational_settings_verification_definer_select on backoffice.operational_settings
  for select to influx_verification_definer
  using (key in ('claim_expiry_minutes', 'evidence_freshness_days', 'audience_badge_validity_days',
                 'brand_badge_validity_months', 'figures_gap_alert_percent',
                 'rejection_cap_window_days'));

-- 2.7 The declared side: the network line (its handle, URL and figures, read for the token, the
-- comparison and the decision; never written), the brand profile and its internal block
grant select (id, account_id, network_code, handle, pseudonym, profile_url, followers_count,
              posts_last_30_days, avg_comments_per_post, engagement_rate_bp)
   on profiles.creator_social_accounts to influx_verification_definer;
drop policy if exists creator_social_accounts_verification_definer_select
  on profiles.creator_social_accounts;
create policy creator_social_accounts_verification_definer_select
  on profiles.creator_social_accounts
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));

grant select (account_id, legal_name, website_domain)
   on profiles.advertiser_profiles to influx_verification_definer;
drop policy if exists advertiser_profiles_verification_definer_select on profiles.advertiser_profiles;
create policy advertiser_profiles_verification_definer_select on profiles.advertiser_profiles
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));

grant select (account_id, legal_name, registration_country_code, registration_number)
   on profiles.advertiser_internal_details to influx_verification_definer;
drop policy if exists advertiser_internal_details_verification_definer_select
  on profiles.advertiser_internal_details;
create policy advertiser_internal_details_verification_definer_select
  on profiles.advertiser_internal_details
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));

-- 2.8 The queue: the decision e-mail and the badge attribute, ids only (05 RG74, modele "Outbox")
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_verification_definer;

drop policy if exists outbox_events_verification_definer_insert on leads.outbox_events;
create policy outbox_events_verification_definer_insert on leads.outbox_events
  for insert to influx_verification_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((event_type = 'verification.decision' and destination = 'brevo_transactional')
                   or (event_type = 'lead.updated' and destination = 'brevo_contact')));

-- 2.9 The register, through audit.append() (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_verification_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 3. The helpers (SECURITY INVOKER: they run with the rights of the decision that calls them) -----

-- 3.1 The caller: an active agent or admin in aal2 (the model of profiles.require_review_agent)
create or replace function verification.require_agent(p_admin_only boolean)
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

comment on function verification.require_agent(boolean) is
  'Returns the caller when he is an active account with the agent or admin role (admin only when '
  'asked), an active agent profile, in an aal2 transaction; 42501 forbidden otherwise (0224). '
  'SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

-- 3.2 The gate of every act on a held entry: locked, another's, not held by the caller's portfolio,
-- pending, under the caller's live claim (RG43, RG53, RG64)
create or replace function verification.lock_held_request(p_request_id uuid, p_caller uuid)
returns table (
  account_id         uuid,
  social_account_id  uuid,
  network_code       text,
  level              verification.badge_level,
  population         text,
  claimed_at         timestamptz
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
  -- the request row first, locked: every act on an entry is serial on it
  select r.account_id, r.social_account_id, r.network_code, r.level, r.population,
         r.status::text as status, r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
    into v_entry
    from verification.verification_requests r
   where r.id = p_request_id
     for update;
  -- unknown, a draft (no entry of the queue), the caller's own account (the policy hides it), an
  -- account he holds (08 RG53): one answer
  if not found or v_entry.account_id = p_caller or v_entry.status = 'draft'
     or exists (select 1 from identity.accounts a
                 where a.id = v_entry.account_id and a.owner_agent_id = p_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.status <> 'pending' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- RG64, invariant 5: no examination nor decision without the caller's live claim
  if v_entry.claimed_by_account_id is distinct from p_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  return query select v_entry.account_id, v_entry.social_account_id, v_entry.network_code,
                      v_entry.level, v_entry.population, v_entry.claimed_at;
end
$$;

comment on function verification.lock_held_request(uuid, uuid) is
  'The gate of the acts on a held entry of queue 4 (0224): locks the request FOR UPDATE; 42501 for an '
  'unknown or draft request, one of the caller''s own account or of an account he holds (08 RG53); '
  '55000 entry_closed once it left pending; 55P03 no_live_claim (DETAIL the live holder or none) '
  'without the caller''s live claim (RG64). Returns its account, line, network, level, population and '
  'claim instant. SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

-- 3.3 The version token (modele §4: never stored, rendered at the opening and the dossier,
-- recomputed at the decision). STABLE: called inside a query, it reads the snapshot of that query.
create or replace function verification.request_review_token(p_request_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
           'request', pg_catalog.jsonb_build_array(r.id, r.status, r.level, r.social_account_id),
           'line', (select pg_catalog.jsonb_build_array(l.handle, l.pseudonym, l.profile_url,
                                                       l.followers_count, l.posts_last_30_days,
                                                       l.avg_comments_per_post, l.engagement_rate_bp)
                      from profiles.creator_social_accounts l
                     where l.id = r.social_account_id and l.account_id = r.account_id),
           'evidence', (select pg_catalog.jsonb_agg(
                                 pg_catalog.jsonb_build_array(e.id, pg_catalog.encode(e.checksum, 'hex'))
                                 order by e.id)
                          from verification.evidence_files e
                         where e.request_id = r.id and e.state = 'active'),
           'code', (select pg_catalog.jsonb_build_array(c.id, c.code, c.expires_at)
                      from verification.ownership_codes c
                     where c.request_id = r.id and c.revoked_at is null),
           'domain', (select p.website_domain
                        from profiles.advertiser_profiles p
                       where p.account_id = r.account_id and r.population = 'brand'),
           'internal', (select pg_catalog.jsonb_build_array(d.legal_name, d.registration_country_code,
                                                           d.registration_number)
                          from profiles.advertiser_internal_details d
                         where d.account_id = r.account_id and r.population = 'brand')
         )::text, 'UTF8')), 'hex')
    from verification.verification_requests r
   where r.id = p_request_id
$$;

comment on function verification.request_review_token(uuid) is
  'modele §4 (0224): SHA-256 hex of the version examined: the request (status, level, line), the '
  'line (handle, pseudonym, URL, declared figures), the active evidence (id, checksum), the live code '
  '(id, code, expiry), and for a brand its website domain and internal block. Never stored; '
  'different at the decision: 55000 stale_token. STABLE (the snapshot of the calling query). '
  'SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

-- 3.4 The texts and figures the agent types (invariant 6, cas limite 2; EC-L2E-08-7, -8)
create or replace function verification.check_internal_comment(p_comment text)
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

comment on function verification.check_internal_comment(text) is
  'The internal comment of a decision: NULL, or 1 to 1 000 printable characters; 22023 '
  'internal_comment otherwise (0224). SECURITY INVOKER owned by influx_verification_definer, no '
  'EXECUTE for anyone.';

create or replace function verification.check_observed_figures(
  p_followers           bigint,
  p_posts_last_30_days  integer,
  p_avg_comments        bigint,
  p_engagement_bp       integer)
returns void
language plpgsql
immutable
security invoker
set search_path = ''
as $$
begin
  -- RG38, RG38bis: three figures required, whole, zero accepted, never negative (cas limite 2)
  if p_followers is null or p_followers < 0 then
    raise exception 'figures_invalid' using errcode = 'invalid_parameter_value', detail = 'followers';
  end if;
  if p_posts_last_30_days is null or p_posts_last_30_days < 0 then
    raise exception 'figures_invalid'
      using errcode = 'invalid_parameter_value', detail = 'posts_last_30_days';
  end if;
  if p_avg_comments is null or p_avg_comments < 0 then
    raise exception 'figures_invalid' using errcode = 'invalid_parameter_value', detail = 'avg_comments';
  end if;
  -- EC-L2E-12: the engagement optional, 0 to 100 % (350 % refused, cas limite 2)
  if p_engagement_bp is not null and p_engagement_bp not between 0 and 10000 then
    raise exception 'figures_invalid' using errcode = 'invalid_parameter_value', detail = 'engagement_bp';
  end if;
end
$$;

comment on function verification.check_observed_figures(bigint, integer, bigint, integer) is
  '08 RG38, RG38bis, cas limite 2 (0224): followers, posts of the last 30 days and average comments '
  'required, >= 0; engagement NULL or 0 to 10 000 basis points; 22023 figures_invalid DETAIL the '
  'field otherwise. SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

create or replace function verification.check_observed_period(p_start date, p_end date)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_days   integer;
  v_today  date := (pg_catalog.now() at time zone 'UTC')::date;
begin
  select (s.value)::integer into v_days
    from backoffice.operational_settings s where s.key = 'evidence_freshness_days';
  if v_days is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  -- RG37, CA27: the period is required
  if p_start is null or p_end is null then
    raise exception 'period_invalid' using errcode = 'invalid_parameter_value', detail = 'period_missing';
  end if;
  if p_start > p_end then
    raise exception 'period_invalid' using errcode = 'invalid_parameter_value', detail = 'period_order';
  end if;
  -- cas limite 2: one never observes the future
  if p_end > v_today then
    raise exception 'period_invalid' using errcode = 'invalid_parameter_value', detail = 'period_future';
  end if;
  -- RG36, CA18: the period ends less than evidence_freshness_days ago
  if v_today - p_end >= v_days then
    raise exception 'period_invalid' using errcode = 'invalid_parameter_value', detail = 'period_too_old';
  end if;
end
$$;

comment on function verification.check_observed_period(date, date) is
  '08 RG36, RG37, CA18, CA27, cas limite 2 (0224): the period typed by the agent, both ends '
  'required, start <= end, end not after today (UTC), today - end < evidence_freshness_days; 22023 '
  'period_invalid DETAIL period_missing, period_order, period_future or period_too_old otherwise. '
  'SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

-- 3.5 The queue of a decision: the e-mail (one per request), and the badge attribute of Brevo
create or replace function verification.queue_decision(
  p_request_id     uuid,
  p_account_id     uuid,
  p_badge_changed  boolean)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  -- 08 RG52: the decision e-mail, written by the worker from email.json (D69); ids only
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'verification.decision', 'brevo_transactional',
          'account:' || p_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', p_account_id,
                                        'request_id', p_request_id),
          'verification.decision:' || p_request_id::text);
  -- modele "Outbox": VERIFIED_LEVEL follows every change of badge, Brevo only (never Apollo)
  if p_badge_changed then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (v_lead, 'lead.updated', 'brevo_contact', 'account:' || p_account_id::text, 100,
            pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', p_account_id),
            'lead.updated:' || v_lead::text);
  end if;
end
$$;

comment on function verification.queue_decision(uuid, uuid, boolean) is
  'modele "Outbox" (0224): verification.decision to brevo_transactional, key '
  'verification.decision:<request_id>, payload {event_id, account_id, request_id}; and, when a badge '
  'changed, lead.updated to brevo_contact only, payload {event_id, account_id}. Never a handle, a '
  'figure, a name nor a reason. SECURITY INVOKER owned by influx_verification_definer, no EXECUTE '
  'for anyone.';

-- 4. The claim (15 RG27 C1 to C4; file.md A8, A9; 08 RG43, RG64) -----------------------------------

create or replace function verification.open_request(p_request_id uuid)
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
  v_caller   uuid := verification.require_agent(false);
  v_entry    record;
  v_minutes  integer;
  v_outcome  text;
  v_holder   uuid;
  v_claimed  timestamptz;
  v_expires  timestamptz;
  v_token    text;
begin
  select r.account_id, r.status::text as status, r.claimed_by_account_id, r.claimed_at,
         r.claim_expires_at
    into v_entry
    from verification.verification_requests r
   where r.id = p_request_id
     for update;
  -- unknown, a draft, the caller's own account: one answer (EC-L2E-08-10)
  if not found or v_entry.account_id = v_caller or v_entry.status = 'draft' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- 08 RG53, CA31: an open entry of an account the caller HOLDS is not his to examine; a closed one
  -- answers `closed` as to anybody (0215)
  if v_entry.status = 'pending'
     and exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_entry.status <> 'pending' then
    v_outcome := 'closed';
  elsif v_entry.claimed_by_account_id = v_caller and v_entry.claim_expires_at > pg_catalog.now() then
    v_outcome := 'held';
    v_holder  := v_caller;
    v_claimed := v_entry.claimed_at;
    v_expires := v_entry.claim_expires_at;
  else
    select (s.value)::integer into v_minutes
      from backoffice.operational_settings s where s.key = 'claim_expiry_minutes';
    if v_minutes is null then
      raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
    end if;

    -- 04 l. 2465-2480: the condition IS the lock, the row count the answer
    update verification.verification_requests r
       set claimed_by_account_id = v_caller,
           claimed_at            = pg_catalog.now(),
           claim_expires_at      = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
     where r.id = p_request_id
       and r.status = 'pending'
       and (r.claimed_by_account_id is null or r.claim_expires_at <= pg_catalog.now())
    returning r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
      into v_holder, v_claimed, v_expires;

    if found then
      v_outcome := 'claimed';
      -- file.md A9: an expired claim taken over is written first, its holder and its real expiry
      if v_entry.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_request_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'verification',
                               'holder_account_id', v_entry.claimed_by_account_id,
                               'claimed_at', v_entry.claimed_at,
                               'expired_at', v_entry.claim_expires_at));
      end if;
    else
      -- RG64, 15 C2: « En cours — {prénom} », read only, never an error
      v_outcome := 'read_only';
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  end if;

  if v_outcome in ('claimed', 'held') then
    v_token := verification.request_review_token(p_request_id);
  end if;

  perform audit.append('queue.entry_opened', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires, v_token;
end
$$;

comment on function verification.open_request(uuid) is
  '08 RG43, RG53, RG64; 15 RG27 C1 to C3, RG35; file.md A9 (0224): an agent or an admin opens an entry '
  'of queue 4. Free, or its claim expired: claimed by an atomic conditional UPDATE, claim_expires_at '
  '= now() + claim_expiry_minutes (an expired claim taken over writes queue.claim_expired first). '
  'Returns (outcome, holder, claimed_at, claim_expires_at, review_token): claimed or held with the '
  'version token, read_only with the live holder, closed with nothing. Every opening writes '
  'queue.entry_opened {queue_code: verification, outcome}. 42501 for an unknown or draft request, the '
  'caller''s own account, a pending request of an account he holds, outside an active agent or admin '
  'in aal2. SECURITY DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and '
  'influx_admin.';

create or replace function verification.release_request(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := verification.require_agent(false);
  v_entry   record;
begin
  select r.account_id, r.status::text as status, r.claimed_by_account_id, r.claimed_at,
         r.claim_expires_at
    into v_entry
    from verification.verification_requests r
   where r.id = p_request_id
     for update;
  if not found or v_entry.account_id = v_caller or v_entry.status = 'draft' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.status <> 'pending' then
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

  update verification.verification_requests r
     set claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
   where r.id = p_request_id;

  perform audit.append('queue.claim_released', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at));
end
$$;

comment on function verification.release_request(uuid) is
  '15 RG27 C3, file.md A9 (0224): the holder of a live claim gives the entry back to queue 4; line '
  'queue.claim_released {queue_code, holder_account_id, claimed_at}, no comment. 55P03 no_live_claim '
  '(DETAIL the live holder or none), 55000 entry_closed, 42501 for an unknown or draft request or the '
  'caller''s own account. SECURITY DEFINER owned by influx_verification_definer; EXECUTE for '
  'influx_agent and influx_admin.';

create or replace function verification.extend_request_claim(p_request_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := verification.require_agent(false);
  v_entry    record;
  v_minutes  integer;
  v_expires  timestamptz;
begin
  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);

  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update verification.verification_requests r
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where r.id = p_request_id
  returning r.claim_expires_at into v_expires;

  perform audit.append('queue.claim_extended', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function verification.extend_request_claim(uuid) is
  'file.md A9 (0224): the holder of a live claim extends it to now() + claim_expiry_minutes; line '
  'queue.claim_extended {queue_code, holder_account_id, claimed_at, claim_expires_at}; returns the new '
  'expiry. The refusals of verification.lock_held_request() (an account the caller holds included). '
  'SECURITY DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

create or replace function verification.force_release_request_claim(
  p_request_id   uuid,
  p_reason_code  text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := verification.require_agent(true);
  v_entry   record;
begin
  perform 1 from backoffice.claim_release_reasons r where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;

  select r.account_id, r.status::text as status, r.claimed_by_account_id, r.claim_expires_at
    into v_entry
    from verification.verification_requests r
   where r.id = p_request_id
     for update;
  if not found or v_entry.account_id = v_caller or v_entry.status = 'draft' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.status <> 'pending' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is null or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim' using errcode = 'lock_not_available', detail = 'none';
  end if;

  update verification.verification_requests r
     set claimed_by_account_id            = null,
         claimed_at                       = null,
         claim_expires_at                 = null,
         forced_release_at                = pg_catalog.now(),
         forced_release_by_account_id     = v_caller,
         forced_release_holder_account_id = v_entry.claimed_by_account_id,
         forced_release_reason_code       = p_reason_code
   where r.id = p_request_id;

  perform audit.append('queue.claim_forced_release', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification',
                                                     'holder_account_id', v_entry.claimed_by_account_id,
                                                     'reason_code', p_reason_code));
  return v_entry.claimed_by_account_id;
end
$$;

comment on function verification.force_release_request_claim(uuid, text) is
  '08 RG64, 15 RG27 C4, file.md A8 (0224): an administrator lifts a live claim before its expiry, with '
  'a typed reason of backoffice.claim_release_reasons; the request keeps the last forced release; line '
  'queue.claim_forced_release {queue_code, holder_account_id, reason_code}; returns the holder. 22023 '
  'reason, 55P03 none, 55000 entry_closed, 42501 outside an active admin in aal2 (an agent''s attempt '
  'is journalled by apps/api, queue.force_release_claim). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin (the function refuses the '
  'agent).';

-- 5. The examination (08 RG44 to RG48, RG55; modele -19) ---------------------------------------------

create or replace function verification.read_request_dossier(p_request_id uuid)
returns table (
  request_id                 uuid,
  account_id                 uuid,
  population                 text,
  level                      text,
  network_code               text,
  submitted_at               timestamptz,
  sla_due_at                 timestamptz,
  escalate_at                timestamptz,
  reexamine_reason_code      text,
  reexamined_at              timestamptz,
  escalated_at               timestamptz,
  social_account_id          uuid,
  handle                     text,
  pseudonym                  text,
  profile_url                text,
  code_expires_at            timestamptz,
  trade_name                 text,
  website_domain             text,
  legal_name                 text,
  registration_country_code  text,
  registration_number        text,
  evidence                   jsonb,
  history                    jsonb,
  badges                     jsonb,
  recent_rejections          integer,
  same_handle_accounts       integer,
  handle_verified_elsewhere  boolean,
  review_token               text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := verification.require_agent(false);
  v_entry   record;
  v_window  integer;
  v_nil     constant uuid := '00000000-0000-0000-0000-000000000000';
begin
  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  select (s.value)::integer into v_window
    from backoffice.operational_settings s where s.key = 'rejection_cap_window_days';

  -- one query, one snapshot: the token is the token of the view shown (EC-L2E-08-13)
  return query
    select r.id, r.account_id, r.population, r.level::text, r.network_code, r.submitted_at,
           r.sla_due_at, r.escalate_at, r.reexamine_reason_code, r.reexamined_at, r.escalated_at,
           r.social_account_id, l.handle, l.pseudonym, l.profile_url,
           -- EC-L2E-08-3: the expiry of the live code, never the code itself
           (select c.expires_at from verification.ownership_codes c
             where c.request_id = r.id and c.revoked_at is null),
           p.legal_name, p.website_domain, d.legal_name, d.registration_country_code::text,
           d.registration_number,
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'id', e.id, 'byte_size', e.byte_size, 'width', e.width,
                              'height', e.height, 'activated_at', e.activated_at)
                              order by e.activated_at, e.id)
                       from verification.evidence_files e
                      where e.request_id = r.id and e.state = 'active'), '[]'::jsonb),
           -- RG55, RG60: the history of the triplet, refusals included
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'id', h.id, 'level', h.level, 'status', h.status,
                              'submitted_at', h.submitted_at, 'decided_at', h.decided_at,
                              'rejection_reason_code', h.rejection_reason_code)
                              order by h.created_at desc, h.id)
                       from verification.verification_requests h
                      where h.account_id = r.account_id and h.id <> r.id
                        and coalesce(h.social_account_id, v_nil) = coalesce(r.social_account_id, v_nil)),
                    '[]'::jsonb),
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'id', b.id, 'level', b.level, 'state', b.state,
                              'granted_at', b.granted_at, 'expires_at', b.expires_at)
                              order by b.granted_at desc, b.id)
                       from verification.badges b
                      where b.account_id = r.account_id
                        and coalesce(b.social_account_id, v_nil) = coalesce(r.social_account_id, v_nil)),
                    '[]'::jsonb),
           (select pg_catalog.count(*)::integer
              from verification.verification_requests x
             where x.account_id = r.account_id
               and coalesce(x.social_account_id, v_nil) = coalesce(r.social_account_id, v_nil)
               and x.level = r.level and x.status = 'rejected'
               and x.decided_at > pg_catalog.now() - pg_catalog.make_interval(days => coalesce(v_window, 30))),
           -- edge case l. 800: other accounts declaring the same handle on the same network
           (select pg_catalog.count(distinct o.account_id)::integer
              from profiles.creator_social_accounts o
             where l.handle is not null and o.account_id <> r.account_id
               and o.network_code = r.network_code
               and pg_catalog.lower(pg_catalog.ltrim(o.handle, '@'))
                   = pg_catalog.lower(pg_catalog.ltrim(l.handle, '@'))),
           exists (select 1 from verification.badges w
                    where l.handle is not null and w.account_id <> r.account_id
                      and w.network_code = r.network_code and w.level = 'account_verified'
                      and w.state in ('active', 'to_refresh', 'to_reconfirm')
                      and pg_catalog.lower(pg_catalog.ltrim(w.observed_handle_at_decision, '@'))
                          = pg_catalog.lower(pg_catalog.ltrim(l.handle, '@'))),
           verification.request_review_token(r.id)
      from verification.verification_requests r
      left join profiles.creator_social_accounts l
             on l.id = r.social_account_id and l.account_id = r.account_id
      left join profiles.advertiser_profiles p
             on p.account_id = r.account_id and r.population = 'brand'
      left join profiles.advertiser_internal_details d
             on d.account_id = r.account_id and r.population = 'brand'
     where r.id = p_request_id;
end
$$;

comment on function verification.read_request_dossier(uuid) is
  '08 RG55, RG63 (0224): the holder of a live claim reads the dossier of the entry, one row: the '
  'request and its deadlines, the line (handle, pseudonym, URL; NEVER a declared figure, -19), the '
  'expiry of the live code (never the code, EC-L2E-08-3), for a brand its trade name, domain and '
  'internal block; the active evidence (metadata, never the key), the history of the triplet and its '
  'badges; the alerts: refusals of the triplet in rejection_cap_window_days, other accounts '
  'declaring the same handle, a holding account badge of another account on that handle (edge case '
  'l. 800); the review token of this snapshot. The refusals of verification.lock_held_request(). '
  'SECURITY DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

create or replace function verification.compare_request_figures(
  p_request_id          uuid,
  p_review_token        text,
  p_followers           bigint,
  p_posts_last_30_days  integer,
  p_avg_comments        bigint,
  p_engagement_bp       integer)
returns table (
  declared_followers           bigint,
  declared_posts_last_30_days  integer,
  declared_avg_comments        bigint,
  declared_engagement_bp       integer,
  gap_alert_percent            integer
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := verification.require_agent(false);
  v_entry   record;
  v_line    record;
  v_alert   integer;
begin
  perform verification.check_observed_figures(p_followers, p_posts_last_30_days, p_avg_comments,
                                              p_engagement_bp);
  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'audience_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;

  select l.followers_count, l.posts_last_30_days, l.avg_comments_per_post, l.engagement_rate_bp,
         verification.request_review_token(p_request_id) as token
    into v_line
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if not found or p_review_token is null or p_review_token is distinct from v_line.token then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  select (s.value)::integer into v_alert
    from backoffice.operational_settings s where s.key = 'figures_gap_alert_percent';

  return query select v_line.followers_count, v_line.posts_last_30_days,
                      v_line.avg_comments_per_post, v_line.engagement_rate_bp, v_alert;
end
$$;

comment on function verification.compare_request_figures(uuid, text, bigint, integer, bigint, integer) is
  '08 RG40 to RG42, RG48, CA25, CA28; modele -19 (0224): AFTER the agent typed his figures (checked '
  'as at the grant), the holder of a live claim on an audience request receives the declared figures '
  'of the line and the alert threshold (figures_gap_alert_percent): the gap is computed at the read, '
  'never stored, published nor refused on. Writes nothing. 22023 figures_invalid or level, 55000 '
  'stale_token, then the refusals of verification.lock_held_request(). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 5.1 The journalled read of an evidence (D82 (5), C(14), RG46, T9.7) -------------------------------
create or replace function verification.read_evidence(p_evidence_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := verification.require_agent(false);
  v_request  uuid;
  v_entry    record;
  v_key      text;
begin
  select e.request_id into v_request
    from verification.evidence_files e
   where e.id = p_evidence_id;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select * into v_entry from verification.lock_held_request(v_request, v_caller);

  select e.object_key into v_key
    from verification.evidence_files e
   where e.id = p_evidence_id and e.request_id = v_request and e.state = 'active';
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- invariant 2: one nominative line per opening, in the transaction that hands the key over
  perform audit.append('verification.evidence_viewed', 'verification_request', v_request,
                       pg_catalog.jsonb_build_object('evidence_id', p_evidence_id,
                                                     'level', v_entry.level));
  return v_key;
end
$$;

comment on function verification.read_evidence(uuid) is
  'D82 (5), 08 RG46, C(14), fiche invariant 2 (0224): the holder of a live claim on the request of an '
  'ACTIVE evidence receives its object_key, for apps/api to relay the bytes (never a signed URL); '
  'writes verification.evidence_viewed {evidence_id, level} (agent, request, evidence) in the same '
  'transaction. 42501 for an unknown evidence, one not active or of another request, then the '
  'refusals of verification.lock_held_request(). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 6. The decisions (08 RG47, RG49 to RG54, RG56, RG57, RG59; 06 RG51, RG52) -------------------------

-- 6.1 To re-examine: an internal reason, the entry kept, its age running (RG50, CA29) -------------
create or replace function verification.reexamine_request(
  p_request_id    uuid,
  p_review_token  text,
  p_reason_code   text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := verification.require_agent(false);
  v_entry   record;
  v_at      timestamptz;
begin
  if p_reason_code is null
     or p_reason_code not in ('network_unreachable', 'evidence_technical', 'registry_unavailable',
                              'storage_unavailable') then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if p_review_token is null
     or p_review_token is distinct from verification.request_review_token(p_request_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;

  -- RG50: never a closure; the entry returns to the queue, the frozen deadlines run on
  update verification.verification_requests r
     set reexamine_reason_code = p_reason_code,
         reexamined_at         = pg_catalog.now(),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null
   where r.id = p_request_id
  returning r.reexamined_at into v_at;

  perform audit.append('queue.claim_released', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at));
  perform audit.append('verification.to_reexamine', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level,
                                                     'reason_code', p_reason_code));
  return v_at;
end
$$;

comment on function verification.reexamine_request(uuid, text, text) is
  '08 RG50, RG67, CA29 (0224): the holder of a live claim marks the entry « à réexaminer » with an '
  'internal reason (network_unreachable, evidence_technical, registry_unavailable, '
  'storage_unavailable), no comment: the request stays pending, its deadlines run on, the claim is '
  'released (queue.claim_released) and verification.to_reexamine {level, reason_code} written; '
  'returns reexamined_at. 22023 reason, 55000 stale_token, then the refusals of '
  'verification.lock_held_request(). SECURITY DEFINER owned by influx_verification_definer; EXECUTE '
  'for influx_agent and influx_admin.';

-- 6.2 Grant « Compte vérifié »: the code read on line, the handle typed (RG25, RG45, CA13, CA14) ---
create or replace function verification.grant_account_verified(
  p_request_id                     uuid,
  p_review_token                   text,
  p_observed_code                  text,
  p_observed_handle                text,
  p_observed_platform_account_ref  text,
  p_internal_comment               text)
returns table (
  outcome       text,
  badge_id      uuid,
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
  v_caller   uuid := verification.require_agent(false);
  v_handle   text := pg_catalog.btrim(p_observed_handle);
  v_ref      text := nullif(pg_catalog.btrim(p_observed_platform_account_ref), '');
  v_entry    record;
  v_code     record;
  v_winner   record;
  v_badge    uuid;
  v_decided  timestamptz;
  v_late     boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if v_handle is null or pg_catalog.char_length(v_handle) not between 1 and 100
     or v_handle ~ '[[:cntrl:]]' then
    raise exception 'observed_handle' using errcode = 'invalid_parameter_value', detail = 'observed_handle';
  end if;
  if v_ref is not null and (pg_catalog.char_length(v_ref) > 100 or v_ref ~ '[[:cntrl:]]') then
    raise exception 'observed_platform_account_ref'
      using errcode = 'invalid_parameter_value', detail = 'observed_platform_account_ref';
  end if;

  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'account_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  if p_review_token is null
     or p_review_token is distinct from verification.request_review_token(p_request_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  -- EC-L2E-08-5, edge case l. 811: a suspended account is closed by the agent, never granted
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;

  -- RG25, CA13: the code typed by the agent, compared with the live code (EC-L2E-08-4)
  select c.id, c.code into v_code
    from verification.ownership_codes c
   where c.request_id = p_request_id and c.kind = 'network' and c.revoked_at is null;
  if not found or pg_catalog.upper(pg_catalog.btrim(p_observed_code)) is distinct from v_code.code then
    raise exception 'code_mismatch' using errcode = 'invalid_parameter_value', detail = 'code_mismatch';
  end if;
  update verification.ownership_codes c
     set observed_by_account_id        = v_caller,
         observed_at                   = pg_catalog.now(),
         observed_handle               = v_handle,
         observed_platform_account_ref = v_ref
   where c.id = v_code.id;

  -- edge case l. 800 (EC-L2E-08-2, -16): the first finding wins; the second is refused, both escalated
  select b.request_id, b.account_id into v_winner
    from verification.badges b
   where b.account_id <> v_entry.account_id
     and b.network_code = v_entry.network_code
     and b.level = 'account_verified'
     and b.state in ('active', 'to_refresh', 'to_reconfirm')
     and (pg_catalog.lower(pg_catalog.ltrim(b.observed_handle_at_decision, '@'))
            = pg_catalog.lower(pg_catalog.ltrim(v_handle, '@'))
          or (v_ref is not null and b.observed_platform_account_ref = v_ref))
   order by b.granted_at, b.id
   limit 1;
  if found then
    update verification.verification_requests r
       set status                = 'rejected',
           decided_by_account_id = v_caller,
           decided_at            = pg_catalog.now(),
           closed_at             = pg_catalog.now(),
           rejection_reason_code = 'ownership_not_proven',
           internal_comment      = p_internal_comment,
           escalated_at          = pg_catalog.now()
     where r.id = p_request_id
    returning r.decided_at, r.sla_breached into v_decided, v_late;
    update verification.verification_requests r
       set escalated_at = coalesce(r.escalated_at, pg_catalog.now())
     where r.id = v_winner.request_id;

    perform verification.queue_decision(p_request_id, v_entry.account_id, false);
    perform audit.append('verification.rejected', 'verification_request', p_request_id,
                         pg_catalog.jsonb_build_object('level', v_entry.level,
                                                       'reason_code', 'ownership_not_proven',
                                                       'late', v_late));
    perform audit.append('verification.escalated', 'verification_request', p_request_id,
                         pg_catalog.jsonb_build_object('level', v_entry.level,
                                                       'reason_code', 'ownership_not_proven',
                                                       'cause', 'handle_already_verified'));
    perform audit.append('verification.escalated', 'verification_request', v_winner.request_id,
                         pg_catalog.jsonb_build_object('level', 'account_verified',
                                                       'cause', 'handle_already_verified'));
    return query select 'handle_already_verified'::text, null::uuid, v_decided, v_late;
    return;
  end if;

  -- EC-L2E-14: a holding badge of the line (to_reconfirm) is replaced, never doubled
  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
     and b.level = 'account_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  update verification.verification_requests r
     set status                = 'approved',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  -- RG30, EC-L2E-05-8: the ownership of an account has no expiry
  insert into verification.badges
    (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
     granted_at, evidence_source, observed_handle_at_decision, observed_platform_account_ref)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, p_request_id,
          'account_verified', v_caller, v_decided, 'public_profile', v_handle, v_ref)
  returning id into v_badge;

  perform verification.queue_decision(p_request_id, v_entry.account_id, true);
  perform audit.append('verification.granted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level, 'badge_id', v_badge,
                                                     'late', v_late));
  return query select 'granted'::text, v_badge, v_decided, v_late;
end
$$;

comment on function verification.grant_account_verified(uuid, text, text, text, text, text) is
  '08 RG25, RG30, RG45, RG47, RG51, CA13, CA14, edge case l. 800 (0224): the holder of a live claim '
  'grants « Compte vérifié »: the code he read on line compared with the live code of the request '
  '(case and spaces ignored), the handle he typed (and the stable reference when shown) recorded '
  'with his identity and the instant on the code. A holding account badge of ANOTHER account on that '
  'handle: the request rejected ownership_not_proven, both requests escalated, outcome '
  'handle_already_verified (EC-L2E-08-2). Otherwise the request approved, a badge active without '
  'expiry (a holding one replaced), verification.decision and lead.updated queued, '
  'verification.granted {level, badge_id, late}. Returns (outcome, badge_id, decided_at, '
  'sla_breached). 22023 observed_handle, observed_platform_account_ref, internal_comment, level or '
  'code_mismatch; 55000 stale_token or account_unavailable; then the refusals of '
  'verification.lock_held_request(). SECURITY DEFINER owned by influx_verification_definer; EXECUTE '
  'for influx_agent and influx_admin.';

-- 6.3 Grant « Audience vérifiée »: the figures and the period typed by the agent (RG36 to RG38bis) --
create or replace function verification.grant_audience_verified(
  p_request_id          uuid,
  p_review_token        text,
  p_followers           bigint,
  p_posts_last_30_days  integer,
  p_avg_comments        bigint,
  p_engagement_bp       integer,
  p_period_start        date,
  p_period_end          date,
  p_observed_handle     text,
  p_internal_comment    text)
returns table (
  outcome       text,
  badge_id      uuid,
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
  v_caller   uuid := verification.require_agent(false);
  v_handle   text := pg_catalog.btrim(p_observed_handle);
  v_entry    record;
  v_line     record;
  v_days     integer;
  v_badge    uuid;
  v_decided  timestamptz;
  v_late     boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if v_handle is null or pg_catalog.char_length(v_handle) not between 1 and 100
     or v_handle ~ '[[:cntrl:]]' then
    raise exception 'observed_handle' using errcode = 'invalid_parameter_value', detail = 'observed_handle';
  end if;
  perform verification.check_observed_figures(p_followers, p_posts_last_30_days, p_avg_comments,
                                              p_engagement_bp);
  perform verification.check_observed_period(p_period_start, p_period_end);

  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'audience_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  -- the declared figures kept at the decision and the token, in ONE snapshot (RG40, CA26)
  select l.followers_count, l.posts_last_30_days, l.avg_comments_per_post, l.engagement_rate_bp,
         verification.request_review_token(p_request_id) as token
    into v_line
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if not found or p_review_token is null or p_review_token is distinct from v_line.token then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;
  -- RG12: the audience of an account whose ownership is not established is never granted
  if not exists (select 1 from verification.badges b
                  where b.account_id = v_entry.account_id
                    and b.social_account_id = v_entry.social_account_id
                    and b.level = 'account_verified' and b.state = 'active') then
    raise exception 'ownership_prerequisite'
      using errcode = 'object_not_in_prerequisite_state', detail = 'ownership_prerequisite';
  end if;
  -- -13: at least one active evidence was examined
  if not exists (select 1 from verification.evidence_files e
                  where e.request_id = p_request_id and e.state = 'active') then
    raise exception 'missing_evidence'
      using errcode = 'object_not_in_prerequisite_state', detail = 'missing_evidence';
  end if;
  -- EC-L2E-08-11: 04 l. 6391 keeps the declared posts and comments on the badge
  if v_line.posts_last_30_days is null or v_line.avg_comments_per_post is null then
    raise exception 'declared_figures_required'
      using errcode = 'check_violation', detail = 'declared_figures_required';
  end if;
  select (s.value)::integer into v_days
    from backoffice.operational_settings s where s.key = 'audience_badge_validity_days';
  if v_days is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- EC-L2E-14, 08 edge case l. 801: a refresh replaces the holding badge, its date and expiry anew
  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
     and b.level = 'audience_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  update verification.verification_requests r
     set status                = 'approved',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  -- RG69, EC-L2E-1: 90 days (the parameter) from the decision
  insert into verification.badges
    (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
     granted_at, evidence_source, observed_followers, observed_posts_last_30_days,
     observed_avg_comments, observed_engagement_bp, observed_period_start, observed_period_end,
     declared_followers_at_decision, declared_posts_at_decision, declared_comments_at_decision,
     declared_engagement_bp_at_decision, observed_handle_at_decision, expires_at)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, p_request_id,
          'audience_verified', v_caller, v_decided, 'native_dashboard', p_followers,
          p_posts_last_30_days, p_avg_comments, p_engagement_bp, p_period_start, p_period_end,
          v_line.followers_count, v_line.posts_last_30_days, v_line.avg_comments_per_post,
          v_line.engagement_rate_bp, v_handle,
          v_decided + pg_catalog.make_interval(days => v_days))
  returning id into v_badge;

  perform verification.queue_decision(p_request_id, v_entry.account_id, true);
  perform audit.append('verification.granted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level, 'badge_id', v_badge,
                                                     'late', v_late));
  return query select 'granted'::text, v_badge, v_decided, v_late;
end
$$;

comment on function verification.grant_audience_verified(uuid, text, bigint, integer, bigint, integer, date, date, text, text) is
  '08 RG12, RG36 to RG38bis, RG40, RG47, RG69, CA26, CA27, cas limite 2 (0224): the holder of a live '
  'claim grants « Audience vérifiée » with the figures he TYPED (followers, posts of the last 30 '
  'days, average comments; engagement optional), the period of the capture and the handle read '
  'again (RG30). Requires an active « Compte vérifié » on the line (55000 ownership_prerequisite), '
  'an active evidence (55000 missing_evidence), an active account. The request approved; a badge '
  'active until decision + audience_badge_validity_days, carrying the declared figures of the line '
  'at the decision beside the observed ones (never overwritten), a holding one replaced; the '
  'retention of the evidence recomputed by the trigger of 0223; verification.decision and '
  'lead.updated queued; verification.granted {level, badge_id, late}. Returns (granted, badge_id, '
  'decided_at, sla_breached). 22023 figures_invalid, period_invalid, observed_handle, '
  'internal_comment or level; 55000 stale_token or account_unavailable; 23514 '
  'declared_figures_required; then the refusals of verification.lock_held_request(). SECURITY '
  'DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 6.4 Grant « Marque vérifiée »: the domain code and the register (06 RG51, RG52) -------------------
create or replace function verification.grant_brand_verified(
  p_request_id          uuid,
  p_review_token        text,
  p_observed_code       text,
  p_observed_domain     text,
  p_observed_channel    text,
  p_registry_source_id  uuid,
  p_internal_comment    text)
returns table (
  outcome       text,
  badge_id      uuid,
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
  v_caller   uuid := verification.require_agent(false);
  v_domain   text := pg_catalog.lower(pg_catalog.rtrim(pg_catalog.btrim(p_observed_domain), '.'));
  v_entry    record;
  v_brand    record;
  v_code     record;
  v_months   integer;
  v_badge    uuid;
  v_decided  timestamptz;
  v_late     boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if p_observed_channel is null or p_observed_channel not in ('dns_txt', 'web_page') then
    raise exception 'observed_channel' using errcode = 'invalid_parameter_value', detail = 'observed_channel';
  end if;
  if v_domain is null or pg_catalog.char_length(v_domain) > 100
     or v_domain !~ '^([[:alnum:]]([[:alnum:]-]{0,61}[[:alnum:]])?\.)+[[:alnum:]][[:alnum:]-]{0,61}[[:alnum:]]$' then
    raise exception 'observed_domain' using errcode = 'invalid_parameter_value', detail = 'observed_domain';
  end if;

  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'brand_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  select p.website_domain, d.registration_country_code, d.account_id is not null as has_details,
         verification.request_review_token(p_request_id) as token
    into v_brand
    from profiles.advertiser_profiles p
    left join profiles.advertiser_internal_details d on d.account_id = p.account_id
   where p.account_id = v_entry.account_id;
  if not found or p_review_token is null or p_review_token is distinct from v_brand.token then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;
  if v_brand.website_domain is null then
    raise exception 'website_domain_required'
      using errcode = 'check_violation', detail = 'website_domain_required';
  end if;
  if not v_brand.has_details then
    raise exception 'internal_details_required'
      using errcode = 'check_violation', detail = 'internal_details_required';
  end if;
  -- EC-L2E-08-9: the code is found on the brand's own domain, or one of its subdomains
  if v_domain <> v_brand.website_domain
     and pg_catalog.right(v_domain, pg_catalog.char_length(v_brand.website_domain) + 1)
         <> '.' || v_brand.website_domain then
    raise exception 'observed_domain' using errcode = 'invalid_parameter_value', detail = 'observed_domain';
  end if;
  -- RG52, D79 (12): an active free register of the country of registration, or GLEIF
  if not exists (select 1 from verification.registry_sources s
                  where s.id = p_registry_source_id and s.is_active
                    and (s.source_type = 'gleif'
                         or s.country_code = v_brand.registration_country_code)) then
    raise exception 'no_registry_source'
      using errcode = 'object_not_in_prerequisite_state', detail = 'no_registry_source';
  end if;

  select c.id, c.code into v_code
    from verification.ownership_codes c
   where c.request_id = p_request_id and c.kind = 'domain' and c.revoked_at is null;
  if not found or pg_catalog.upper(pg_catalog.btrim(p_observed_code)) is distinct from v_code.code then
    raise exception 'code_mismatch' using errcode = 'invalid_parameter_value', detail = 'code_mismatch';
  end if;
  update verification.ownership_codes c
     set observed_by_account_id = v_caller,
         observed_at            = pg_catalog.now(),
         observed_domain        = v_domain,
         observed_channel       = p_observed_channel
   where c.id = v_code.id;

  select (s.value)::integer into v_months
    from backoffice.operational_settings s where s.key = 'brand_badge_validity_months';
  if v_months is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id is null
     and b.level = 'brand_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  update verification.verification_requests r
     set status                = 'approved',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  insert into verification.badges
    (account_id, request_id, level, granted_by_account_id, granted_at, evidence_source,
     registry_source_id, expires_at)
  values (v_entry.account_id, p_request_id, 'brand_verified', v_caller, v_decided,
          'domain_and_registry', p_registry_source_id,
          v_decided + pg_catalog.make_interval(months => v_months))
  returning id into v_badge;

  perform verification.queue_decision(p_request_id, v_entry.account_id, true);
  perform audit.append('verification.granted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level, 'badge_id', v_badge,
                                                     'late', v_late));
  return query select 'granted'::text, v_badge, v_decided, v_late;
end
$$;

comment on function verification.grant_brand_verified(uuid, text, text, text, text, uuid, text) is
  '06 RG51, RG52; D79 (12) (0224): the holder of a live claim grants « Marque vérifiée »: the domain '
  'code he read (DNS TXT or web page) compared with the live code, on the website domain of the '
  'profile or one of its subdomains, and the register consulted (an active source of the country of '
  'registration, or GLEIF). The finding on the code; the request approved; a badge active for '
  'brand_badge_validity_months (a holding one replaced); verification.decision and lead.updated '
  'queued; verification.granted {level, badge_id, late}. Returns (granted, badge_id, decided_at, '
  'sla_breached). 22023 observed_channel, observed_domain, internal_comment, level or code_mismatch; '
  '23514 website_domain_required or internal_details_required; 55000 stale_token, '
  'account_unavailable or no_registry_source; then the refusals of verification.lock_held_request(). '
  'SECURITY DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 6.5 Refuse, or close for an unavailable account (RG54, RG56, RG57, RG59; CA32, CA33) ---------------
create or replace function verification.reject_request(
  p_request_id        uuid,
  p_review_token      text,
  p_reason_code       text,
  p_member_message    text,
  p_internal_comment  text)
returns table (
  status        text,
  decided_at    timestamptz,
  sla_breached  boolean,
  escalated     boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := verification.require_agent(false);
  v_entry     record;
  v_reason    record;
  v_status    text;
  v_decided   timestamptz;
  v_late      boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);

  -- RG56, CA33: a typed reason of the closed list of THIS population (RG57, EC-L2E-11)
  select r.requires_member_message, r.escalates_to_admin into v_reason
    from verification.rejection_reasons r
   where r.population = v_entry.population and r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  -- EC-L2E-08-7: the message to the member for a reason that requires it only (other, terms_breach)
  if v_reason.requires_member_message then
    if p_member_message is null
       or pg_catalog.char_length(p_member_message) not between 20 and 500
       or p_member_message !~ '[^[:space:]]'
       or p_member_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'member_message' using errcode = 'invalid_parameter_value', detail = 'member_message';
    end if;
  elsif p_member_message is not null then
    raise exception 'member_message' using errcode = 'invalid_parameter_value', detail = 'member_message';
  end if;
  -- RG54, EC-L2E-08-6: `minor` stops everything at any step, whatever the version examined
  if p_reason_code <> 'minor'
     and (p_review_token is null
          or p_review_token is distinct from verification.request_review_token(p_request_id)) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;

  -- RG57: account_unavailable closes (closed), every other reason refuses (rejected)
  v_status := case when p_reason_code = 'account_unavailable' then 'closed' else 'rejected' end;
  update verification.verification_requests r
     set status                = v_status::verification.request_status,
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         rejection_reason_code = p_reason_code,
         member_message        = p_member_message,
         internal_comment      = p_internal_comment,
         escalated_at          = case when v_reason.escalates_to_admin then pg_catalog.now()
                                      else r.escalated_at end
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  perform verification.queue_decision(p_request_id, v_entry.account_id, false);
  perform audit.append(case when v_status = 'closed' then 'verification.closed'
                            else 'verification.rejected' end,
                       'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level,
                                                     'reason_code', p_reason_code,
                                                     'late', v_late));
  -- RG59, CA32, -17: a signal on the account, escalated to an administrator
  if v_reason.escalates_to_admin then
    perform audit.append('verification.escalated', 'verification_request', p_request_id,
                         pg_catalog.jsonb_build_object('level', v_entry.level,
                                                       'reason_code', p_reason_code));
  end if;
  return query select v_status, v_decided, v_late, v_reason.escalates_to_admin;
end
$$;

comment on function verification.reject_request(uuid, text, text, text, text) is
  '08 RG49, RG54, RG56, RG57, RG59, CA29, CA32, CA33; 06 RG51, RG52 (0224): the holder of a live claim '
  'refuses a request with a typed reason of verification.rejection_reasons of its population; the '
  'message to the member (20 to 500 printable characters) for a reason that requires it only; an '
  'internal comment of 1 000 characters at most, never sent. account_unavailable closes (closed), '
  'any other reason refuses (rejected); a reason that escalates (RG59, minor included) sets '
  'escalated_at and writes verification.escalated; evidence_too_wide purges the evidence at once '
  '(trigger of 0223). verification.decision queued; verification.rejected or verification.closed '
  '{level, reason_code, late}. `minor` needs no review token (RG54). Returns (status, decided_at, '
  'sla_breached, escalated). 22023 reason, member_message or internal_comment, 55000 stale_token, '
  'then the refusals of verification.lock_held_request(). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 6.6 The registry sources of an administrator (06 RG52, RG101; D79 (12)) ---------------------------
create or replace function verification.set_registry_source(
  p_source_id   uuid,
  p_name        text,
  p_url         text,
  p_checked_on  date,
  p_is_active   boolean)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := verification.require_agent(true);
  v_before  record;
  v_at      timestamptz;
begin
  if p_checked_on is null or p_checked_on > (pg_catalog.now() at time zone 'UTC')::date
     or p_is_active is null then
    raise exception 'checked_on' using errcode = 'invalid_parameter_value', detail = 'checked_on';
  end if;
  select s.name, s.url, s.checked_on, s.is_active into v_before
    from verification.registry_sources s
   where s.id = p_source_id
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- the shapes of name and URL are the constraints of 0221 (23514); one active per country (23505)
  update verification.registry_sources s
     set name                  = pg_catalog.btrim(p_name),
         url                   = pg_catalog.btrim(p_url),
         checked_on            = p_checked_on,
         is_active             = p_is_active,
         updated_by_account_id = v_caller
   where s.id = p_source_id
  returning s.updated_at into v_at;

  perform audit.append('verification.registry_source_changed', 'registry_source', p_source_id,
                       pg_catalog.jsonb_build_object(
                         'before', pg_catalog.jsonb_build_object(
                                     'name', v_before.name, 'url', v_before.url,
                                     'checked_on', v_before.checked_on,
                                     'is_active', v_before.is_active),
                         'after', pg_catalog.jsonb_build_object(
                                     'name', pg_catalog.btrim(p_name), 'url', pg_catalog.btrim(p_url),
                                     'checked_on', p_checked_on, 'is_active', p_is_active)));
  return v_at;
end
$$;

comment on function verification.set_registry_source(uuid, text, text, date, boolean) is
  '06 RG52, RG101; D79 (12) (0224): an administrator updates a registry source (name, https URL, '
  'day of the check, active), after checking its gratuity by hand; writes '
  'verification.registry_source_changed {before, after}; returns updated_at. 22023 checked_on (none, '
  'in the future, or no active flag); 23514 a shape of 0221; 23505 a second active source for the '
  'country (EC-L2E-08-15); 42501 an unknown source, outside an active admin in aal2. SECURITY '
  'DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin (the '
  'function refuses the agent).';

-- 7. Rights on the functions, then to their owner (03 P7 rule 5) ------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.require_agent(boolean)',
    'verification.lock_held_request(uuid, uuid)',
    'verification.request_review_token(uuid)',
    'verification.check_internal_comment(text)',
    'verification.check_observed_figures(bigint, integer, bigint, integer)',
    'verification.check_observed_period(date, date)',
    'verification.queue_decision(uuid, uuid, boolean)',
    'verification.open_request(uuid)',
    'verification.release_request(uuid)',
    'verification.extend_request_claim(uuid)',
    'verification.force_release_request_claim(uuid, text)',
    'verification.read_request_dossier(uuid)',
    'verification.compare_request_figures(uuid, text, bigint, integer, bigint, integer)',
    'verification.read_evidence(uuid)',
    'verification.reexamine_request(uuid, text, text)',
    'verification.grant_account_verified(uuid, text, text, text, text, text)',
    'verification.grant_audience_verified(uuid, text, bigint, integer, bigint, integer, date, date, text, text)',
    'verification.grant_brand_verified(uuid, text, text, text, text, uuid, text)',
    'verification.reject_request(uuid, text, text, text, text)',
    'verification.set_registry_source(uuid, text, text, date, boolean)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', f);
  end loop;
end
$$;

grant execute on function
  verification.open_request(uuid),
  verification.release_request(uuid),
  verification.extend_request_claim(uuid),
  verification.force_release_request_claim(uuid, text),
  verification.read_request_dossier(uuid),
  verification.compare_request_figures(uuid, text, bigint, integer, bigint, integer),
  verification.read_evidence(uuid),
  verification.reexamine_request(uuid, text, text),
  verification.grant_account_verified(uuid, text, text, text, text, text),
  verification.grant_audience_verified(uuid, text, bigint, integer, bigint, integer, date, date, text, text),
  verification.grant_brand_verified(uuid, text, text, text, text, uuid, text),
  verification.reject_request(uuid, text, text, text, text),
  verification.set_registry_source(uuid, text, text, date, boolean)
  to influx_agent, influx_admin;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.require_agent(boolean)',
    'verification.lock_held_request(uuid, uuid)',
    'verification.request_review_token(uuid)',
    'verification.check_internal_comment(text)',
    'verification.check_observed_figures(bigint, integer, bigint, integer)',
    'verification.check_observed_period(date, date)',
    'verification.queue_decision(uuid, uuid, boolean)',
    'verification.open_request(uuid)',
    'verification.release_request(uuid)',
    'verification.extend_request_claim(uuid)',
    'verification.force_release_request_claim(uuid, text)',
    'verification.read_request_dossier(uuid)',
    'verification.compare_request_figures(uuid, text, bigint, integer, bigint, integer)',
    'verification.read_evidence(uuid)',
    'verification.reexamine_request(uuid, text, text)',
    'verification.grant_account_verified(uuid, text, text, text, text, text)',
    'verification.grant_audience_verified(uuid, text, bigint, integer, bigint, integer, date, date, text, text)',
    'verification.grant_brand_verified(uuid, text, text, text, text, uuid, text)',
    'verification.reject_request(uuid, text, text, text, text)',
    'verification.set_registry_source(uuid, text, text, date, boolean)']
  loop
    execute format('alter function %s owner to influx_verification_definer', f);
  end loop;
end
$$;

revoke create on schema verification from influx_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
end
$$;

-- 8. End-state assertions -------------------------------------------------------------------------

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

  -- D82 (5), EC-L2E-07-6: the key of an evidence, to the owner of the doors, the purge and the
  -- journalled read only (the third role of 0223's list)
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_creator_verification_definer', 'influx_maintenance_definer',
                           'influx_verification_definer')
     and pg_catalog.has_column_privilege(r.oid, 'verification.evidence_files', 'object_key', 'SELECT');
  if v_bad is not null then
    raise exception 'the object key is readable by: %', v_bad;
  end if;

  -- the owner of the decisions never writes an evidence row nor a catalogue, never reaches Storage
  if pg_catalog.has_any_column_privilege('influx_verification_definer', 'verification.evidence_files',
                                         'INSERT, UPDATE')
     or pg_catalog.has_table_privilege('influx_verification_definer', 'verification.evidence_files',
                                       'DELETE, TRUNCATE')
     or pg_catalog.has_any_column_privilege('influx_verification_definer',
                                            'verification.rejection_reasons', 'INSERT, UPDATE')
     or pg_catalog.has_table_privilege('influx_verification_definer', 'verification.badges',
                                       'DELETE, TRUNCATE')
     or pg_catalog.has_table_privilege('influx_verification_definer', 'verification.verification_requests',
                                       'INSERT, DELETE, TRUNCATE')
     or pg_catalog.has_any_column_privilege('influx_verification_definer',
                                            'profiles.creator_social_accounts', 'INSERT, UPDATE')
     or pg_catalog.has_schema_privilege('influx_verification_definer', 'storage', 'USAGE, CREATE') then
    raise exception 'influx_verification_definer reaches beyond the decisions';
  end if;

  -- still no execution role writing the schema verification directly
  select string_agg(r.rolname || ' ' || c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_roles r, pg_catalog.pg_class c
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and c.relkind in ('r', 'p')
     and c.relnamespace = 'verification'::regnamespace
     and (pg_catalog.has_any_column_privilege(r.oid, c.oid, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'execution role(s) writing a verification table: %', v_bad;
  end if;

  -- the twenty functions: owner, security, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('verification.require_agent(boolean)', false, false),
      ('verification.lock_held_request(uuid,uuid)', false, false),
      ('verification.request_review_token(uuid)', false, false),
      ('verification.check_internal_comment(text)', false, false),
      ('verification.check_observed_figures(bigint,integer,bigint,integer)', false, false),
      ('verification.check_observed_period(date,date)', false, false),
      ('verification.queue_decision(uuid,uuid,boolean)', false, false),
      ('verification.open_request(uuid)', true, true),
      ('verification.release_request(uuid)', true, true),
      ('verification.extend_request_claim(uuid)', true, true),
      ('verification.force_release_request_claim(uuid,text)', true, true),
      ('verification.read_request_dossier(uuid)', true, true),
      ('verification.compare_request_figures(uuid,text,bigint,integer,bigint,integer)', true, true),
      ('verification.read_evidence(uuid)', true, true),
      ('verification.reexamine_request(uuid,text,text)', true, true),
      ('verification.grant_account_verified(uuid,text,text,text,text,text)', true, true),
      ('verification.grant_audience_verified(uuid,text,bigint,integer,bigint,integer,date,date,text,text)',
       true, true),
      ('verification.grant_brand_verified(uuid,text,text,text,text,uuid,text)', true, true),
      ('verification.reject_request(uuid,text,text,text,text)', true, true),
      ('verification.set_registry_source(uuid,text,text,date,boolean)', true, true)
    ) as f (sig, definer, internal)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> 'influx_verification_definer'
      or p.prosecdef <> f.definer
      or p.proconfig is distinct from array['search_path=""']
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0 or not f.internal
                         or a.grantee::regrole::text not in ('influx_agent', 'influx_admin')));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, search_path or callers: %', v_bad;
  end if;

  -- no definer role left usable nor with CREATE on a schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_verification_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE') then
    raise exception 'influx_verification_definer left with CREATE on the schema verification';
  end if;
end
$$;
