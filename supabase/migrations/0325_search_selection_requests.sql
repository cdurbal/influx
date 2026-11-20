-- =============================================================================
-- 0325_search_selection_requests
-- -----------------------------------------------------------------------------
-- Lot 3 / L3F, commit 05 (jalons/l3f/05.md; l3f-fiche.md invariants 4, 6, 10, 11, 15;
-- jalons/l3f/modele.md §1, §6, which PREVAILS for every name; 10 RG61, CA39, CA64; 15 queue 9;
-- D45, D46). The brand asks the INFLUX team for a selection: one line in the back office with every
-- criterion entered, the campaign of origin and the brand's language, born with its deadline. No
-- introduction, no conversation, nothing to a creator, to leads.outbox_events nor to an e-mail.
-- Signalled I-4 (03): a new table and its policies, a SECURITY DEFINER door, a register code, GRANTs
-- to two owners, the guard of the journal and E-5 recreated.
--
-- 1. The register code search.selection_requested (domain search, subject selection_request, info,
--    exported: the brand's own act, its code and date in its activity_log).
-- 2. Queue 9 team_selection (EC-L3F-4, the pattern of 0206): agent and admin, a lock, no bulk action;
--    its policy PROVISIONAL (15 Q3, 04 §5.10): decision 480 business minutes, claim 240, escalation
--    the default. Its claim, closure, screen and AL23 come with L3G.
-- 3. search.selection_requests (modele §6): id, advertiser_account_id, campaign_id (NULL allowed),
--    filters (the shape of p_filters), language (preferred_language at the deposit), message (NULL
--    or 1 to 1 000), state (open; closed comes with L3G), sla_due_at, created_at; RLS forced, NO
--    member right, the restrictive member policy of 0316.
-- 4. search.guard_search_journal_write() recreated at the same signature: the DELETE of
--    influx_privacy_definer reaches profile_openings too (the erasure, EC-L3F-03-7).
-- 5. What influx_creator_search_definer reads and writes beyond 0324: the language of its caller
--    (identity.accounts.preferred_language), the policy of queue 9 and backoffice.business_deadline(),
--    its own requests (read for the bucket, inserted), audit.append().
-- 6. What influx_privacy_definer reads and deletes beyond 0318: search.profile_openings and
--    search.selection_requests, each right with its policy.
-- 7. The door, SECURITY DEFINER, empty search_path, EXECUTE for influx_advertiser ONLY:
--      search.request_team_selection(filters, campaign, message) → jsonb  in order: the caller
--            (42501); RG1 {state: brand_not_published}; the switch IGNORED (RG61: permanent, CA59),
--            the threshold too; requestsPerDay on 24 h {state: rate_limited, retryAfterSeconds},
--            nothing written; the filters (search.check_creator_search_filters, 22023 filters); the
--            campaign admitted (search.is_admitted_campaign, otherwise P0002 campaign); the message
--            (22023 message); the line and search.selection_requested; {state: requested, answerBy}
--            (= sla_due_at).
-- 8. E-5 recreated by its owner FROM ITS 0318 VERSIONS, at the same signatures, every other step
--    unchanged: the export carries advertiser_profile.selection_requests (instant, filters, title of
--    the campaign, language, message, state); the erasure deletes the openings of a profile (as the
--    brand that opened or the creator opened) and the requests of a brand (04 §9). Categories
--    unchanged (15).
--
-- RIGHTS (03 I-4, signalled): a new table, its restrictive policy, two policies to its writer and two
-- to the erasure; column GRANTs to influx_creator_search_definer on identity.accounts
-- (preferred_language), backoffice.sla_policies (with its policy bounded to team_selection),
-- search.selection_requests; USAGE on backoffice and audit and EXECUTE on business_deadline() and
-- audit.append() to it; SELECT and DELETE on search.profile_openings and search.selection_requests to
-- influx_privacy_definer; EXECUTE on the door to influx_advertiser. Never layer I, Storage, leads,
-- matching (beyond the engine's E5), a coordinate, a band nor a budget; no new role.
--
-- Not here: the screen, the claim and the closure of queue 9, AL23 (L3G); the routes (08); the
-- alerts (0326); the purge at 12 months after closure (Lot 6, 04 §9).
--
-- EC-L3F-05 (micro-gaps, the safest choice):
--   EC-L3F-05-1  the message is trimmed, several lines admitted; a blank one is 22023 message like an
--                empty one (EC-L3F-04-2); NULL is no message.
--   EC-L3F-05-2  state admits open alone: the check widens with the closure of L3G, never a closed
--                request without its reason.
--   EC-L3F-05-3  the bucket counts every request of the account on 24 h sliding under a transaction
--                lock per account; a refusal writes no line (modele §6 « rien écrit »), so it needs no
--                bound of its own; retryAfterSeconds is the exit of the request that frees a place.
--   EC-L3F-05-4  the owner reads preferred_language of the accounts its policy of 0319 shows (the
--                caller and the creators): only the door names it, for its caller (L3F-T5 holds it).
--   EC-L3F-05-5  the export restitutes neither the id, the deadline nor the request id of a line, as
--                the campaigns (EC-L3B-06-2) and the searches (0318).
--   EC-L3F-05-6  the audit payload carries the identifiers only: {campaign_id} (NULL without one);
--                never the filters, the language nor the message (D46: read by the agents alone).
--   EC-L3F-05-7  the expectations that follow the door, for expert-cybersecurite: L3E-T6 (the
--                functions of the owner +1, the tables it writes +1), L3E-T3 (the brand executes 12
--                functions of search, 15 tables in search.ts), T1-R, T2 (a new table), TM3 (queue 9).
--
-- ROLLBACK (before any request is written once 0325 is applied): recreate privacy.export_document()
-- and privacy.execute_request() as in 0318 (as influx_privacy_definer); recreate
-- search.guard_search_journal_write() as in 0316; drop function search.request_team_selection(jsonb,
-- uuid, text); drop table search.selection_requests; drop the policies
-- profile_openings_privacy_definer_select, _erase and revoke their grants; revoke select
-- (preferred_language) on identity.accounts, select on backoffice.sla_policies (and drop
-- sla_policies_creator_search_definer_select), execute on backoffice.business_deadline(), usage on
-- backoffice and audit from influx_creator_search_definer; revoke execute on audit.append() from it
-- (as influx_audit_writer); delete from backoffice.sla_policies and backoffice.queues where code =
-- 'team_selection' (one transaction); delete the code search.selection_requested.
-- =============================================================================

-- 1. The register code of the request (04 §4.3; F3, 0302) ----------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity, export_class) values
  -- 10 RG61, CA39: the brand asks the INFLUX team for a selection (its own act, exported)
  ('search.selection_requested', 'search', 'selection_request', 'info', 'exported')
on conflict (code) do nothing;

-- 2. Queue 9 and its provisional policy (15 RG29, Q3; 04 §5.10; EC-L3F-4) ------------------------------
-- ON CONFLICT DO NOTHING: re-running the migration never overwrites a value changed since.

insert into backoffice.queues
  (code, label_key, spec_document, handled_by_roles, allows_bulk_action, has_lock)
values
  ('team_selection', 'queue.team_selection', '10 RG61, RG84', '{agent,admin}', false, true)
on conflict (code) do nothing;

insert into backoffice.sla_policies
  (queue_code, target_claim_minutes, target_decision_minutes, business_hours,
   escalate_after_minutes, is_provisional)
values
  -- 1 business day, claim within 4 business hours: proposal 15 Q3, not validated
  ('team_selection', 240, 480, default, default, true)
on conflict (queue_code) do nothing;

-- the deferred key is checked now: a pending trigger event would block any later ALTER TABLE
set constraints backoffice.queues_sla_policy_fk immediate;

-- 3. The requests for a selection by the team (modele §6; 10 RG61, CA39) ---------------------------

create table if not exists search.selection_requests (
  id                     uuid        not null default gen_random_uuid() primary key,
  advertiser_account_id  uuid        not null references profiles.advertiser_profiles (account_id),
  campaign_id            uuid        references campaigns.campaigns (id),
  filters                jsonb       not null default '{}'::jsonb,
  language               char(2)     not null references reference.languages (code),
  message                text,
  state                  text        not null default 'open',
  sla_due_at             timestamptz not null,
  created_at             timestamptz not null default now(),

  constraint selection_requests_filters check (jsonb_typeof(filters) = 'object'),
  constraint selection_requests_message
    check (message is null or char_length(message) between 1 and 1000),
  -- EC-L3F-05-2: the closure comes with L3G
  constraint selection_requests_state check (state in ('open')),
  constraint selection_requests_deadline check (sla_due_at >= created_at)
);

-- the bucket of an account and the erasure, the queue by its deadline (L3G)
create index if not exists selection_requests_advertiser_idx
  on search.selection_requests (advertiser_account_id, created_at desc);
create index if not exists selection_requests_queue_idx
  on search.selection_requests (sla_due_at)
  where state = 'open';

comment on table search.selection_requests is
  'The requests of a brand for a selection by the INFLUX team (l3f/modele.md §6; 10 RG61, CA39; '
  'queue 9 team_selection): every criterion entered (filters, the shape of p_filters), the campaign '
  'of origin (admitted at the deposit) or none, the brand''s language at the deposit, its message '
  '(read by the agents alone, D46), the deadline frozen at the deposit (business_deadline of queue 9). '
  'Written by search.request_team_selection() only; no introduction, no creator, no outbox (D45, '
  'CA64). RLS forced, NO member right. Exported to the brand, erased with it; kept 12 months after '
  'its closure (04 §9).';

alter table search.selection_requests enable row level security;
alter table search.selection_requests force row level security;
revoke all on search.selection_requests from public, anon, authenticated, service_role,
  influx_advertiser, influx_creator, influx_agent, influx_admin;

-- the second line of « no member right » (0316 §7): even a grant written by mistake sees no row
drop policy if exists selection_requests_no_member_access on search.selection_requests;
create policy selection_requests_no_member_access on search.selection_requests
  as restrictive for all to influx_advertiser, influx_creator
  using (false) with check (false);

-- 4. Append-only outside the erasure, the openings erased too (0316 §4.2, EC-L3F-03-7) ---------------
create or replace function search.guard_search_journal_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- free: the migration role and every role outside influx_% (the cascades of a deleted parent run
  -- as the owner of the table)
  if current_user not like 'influx\_%' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  -- the erasure (0318, 0325) deletes the journal of an account; never a version
  if tg_op = 'DELETE' and current_user = 'influx_privacy_definer'
     and tg_table_name in ('search_queries', 'search_impressions', 'impression_reasons',
                           'creator_exposures', 'profile_openings') then
    return old;
  end if;
  -- the opening of an impression (L3F), once, nothing else changed
  if tg_op = 'UPDATE' and tg_table_name = 'search_impressions' then
    if not old.was_opened and new.was_opened and new.opened_at is not null
       and new.search_query_id = old.search_query_id
       and new.creator_account_id = old.creator_account_id
       and new.rank = old.rank
       and new.cold_quota = old.cold_quota
       and new.vigilance_code is not distinct from old.vigilance_code then
      return new;
    end if;
  end if;
  raise exception 'search_journal_immutable'
    using errcode = 'object_not_in_prerequisite_state', detail = 'search_journal_immutable';
end
$$;

comment on function search.guard_search_journal_write() is
  'l3e/modele.md §9 (0316; 0325): BEFORE UPDATE OR DELETE on search.search_queries, '
  'search_impressions, impression_reasons, creator_exposures, facet_config_versions and '
  'profile_openings; 55000 search_journal_immutable for every influx_% role but the DELETE of '
  'influx_privacy_definer on the journal and the openings (the erasure) and the opening of an '
  'impression once (was_opened false -> true with opened_at, nothing else). SECURITY INVOKER, reads '
  'nothing.';

revoke all on function search.guard_search_journal_write() from public, anon, authenticated, service_role;

-- 5. What influx_creator_search_definer reads and writes beyond 0324 (modele §6) -----------------------

grant usage on schema backoffice, audit to influx_creator_search_definer;

-- 5.1 The language of its caller at the deposit (EC-L3F-05-4: the policy of 0319 bounds the rows)
grant select (preferred_language) on identity.accounts to influx_creator_search_definer;

-- 5.2 The deadline of queue 9, read from the table, computed once (04 §5.6)
grant select (queue_code, target_decision_minutes, business_hours, is_active)
   on backoffice.sla_policies to influx_creator_search_definer;
drop policy if exists sla_policies_creator_search_definer_select on backoffice.sla_policies;
create policy sla_policies_creator_search_definer_select on backoffice.sla_policies
  for select to influx_creator_search_definer
  using (queue_code = 'team_selection');
grant execute on function backoffice.business_deadline(text, timestamptz, integer)
   to influx_creator_search_definer;

-- 5.3 Its caller's requests: counted by the bucket, inserted by the door
grant select (id, advertiser_account_id, sla_due_at, created_at),
      insert (advertiser_account_id, campaign_id, filters, language, message, sla_due_at)
   on search.selection_requests to influx_creator_search_definer;
drop policy if exists selection_requests_creator_search_definer_select on search.selection_requests;
create policy selection_requests_creator_search_definer_select on search.selection_requests
  for select to influx_creator_search_definer
  using (advertiser_account_id = (select influx.current_account_id()));
drop policy if exists selection_requests_creator_search_definer_insert on search.selection_requests;
create policy selection_requests_creator_search_definer_insert on search.selection_requests
  for insert to influx_creator_search_definer
  with check (advertiser_account_id = (select influx.current_account_id()));

-- 5.4 The register, through audit.append(), granted by its owner (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_creator_search_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 6. What influx_privacy_definer reads and deletes beyond 0318 (04 §9) ----------------------------------
-- identity.accounts (id, status) read since 0137: each erase policy names an account already deleted

-- 6.1 The openings of a profile: never exported (like the impressions, modele -7); deleted with the
-- brand that opened or the creator opened
grant select (account_id, creator_account_id), delete
   on search.profile_openings to influx_privacy_definer;
drop policy if exists profile_openings_privacy_definer_select on search.profile_openings;
create policy profile_openings_privacy_definer_select on search.profile_openings
  for select to influx_privacy_definer
  using (true);
drop policy if exists profile_openings_privacy_definer_erase on search.profile_openings;
create policy profile_openings_privacy_definer_erase on search.profile_openings
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id in (profile_openings.account_id, profile_openings.creator_account_id)
                    and a.status = 'deleted'));

-- 6.2 The requests of a brand: exported to it, deleted with it
grant select (id, advertiser_account_id, campaign_id, filters, language, message, state, created_at),
      delete
   on search.selection_requests to influx_privacy_definer;
drop policy if exists selection_requests_privacy_definer_select on search.selection_requests;
create policy selection_requests_privacy_definer_select on search.selection_requests
  for select to influx_privacy_definer
  using (true);
drop policy if exists selection_requests_privacy_definer_erase on search.selection_requests;
create policy selection_requests_privacy_definer_erase on search.selection_requests
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = selection_requests.advertiser_account_id and a.status = 'deleted'));

-- 7. The door, as influx_creator_search_definer (03 P7 rule 5) ---------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_search_definer', current_user);
end
$$;
grant create on schema search to influx_creator_search_definer;
set role influx_creator_search_definer;

create or replace function search.request_team_selection(
  p_filters      jsonb,
  p_campaign_id  uuid,
  p_message      text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller    uuid;
  v_per_day   integer;
  v_count     integer;
  v_exit      timestamptz;
  v_message   text := pg_catalog.btrim(p_message);
  v_language  char(2);
  v_minutes   integer;
  v_due       timestamptz;
  v_id        uuid;
begin
  -- the caller (42501), then RG1; the switch and the threshold ignored (RG61: the button is permanent)
  v_caller := search.require_creator_searcher();
  if not exists (select 1 from profiles.advertiser_profiles a
                  where a.account_id = v_caller and a.status = 'published') then
    return pg_catalog.jsonb_build_object('state', 'brand_not_published');
  end if;

  -- the bucket (EC-L3F-05-3): one request at a time per account, nothing written when refused
  v_per_day := search.selection_limit('requestsPerDay');
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.selection_requests:' || v_caller::text, 0));
  select (pg_catalog.count(*))::integer into v_count
    from search.selection_requests r
   where r.advertiser_account_id = v_caller
     and r.created_at > pg_catalog.now() - interval '24 hours';
  if v_count >= v_per_day then
    select r.created_at + interval '24 hours' into v_exit
      from search.selection_requests r
     where r.advertiser_account_id = v_caller
       and r.created_at > pg_catalog.now() - interval '24 hours'
     order by r.created_at
     offset v_count - v_per_day
     limit 1;
    return pg_catalog.jsonb_build_object(
      'state', 'rate_limited',
      'retryAfterSeconds',
      greatest((pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer, 1));
  end if;

  -- CA39: every criterion entered, the closed entry of the search (22023 filters)
  perform search.check_creator_search_filters(p_filters);
  -- modele §1: an admitted campaign of the caller, or none
  if p_campaign_id is not null and not search.is_admitted_campaign(v_caller, p_campaign_id) then
    raise exception 'campaign_not_found' using errcode = 'no_data_found', detail = 'campaign';
  end if;
  -- EC-L3F-05-1: NULL is no message; otherwise 1 to 1 000 characters once trimmed
  if p_message is not null and pg_catalog.char_length(v_message) not between 1 and 1000 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'message';
  end if;

  -- CA39: the brand's language at the deposit; the deadline of queue 9, frozen once (04 §5.6)
  select a.preferred_language into v_language from identity.accounts a where a.id = v_caller;
  select p.target_decision_minutes into v_minutes
    from backoffice.sla_policies p
   where p.queue_code = 'team_selection' and p.is_active;
  if v_minutes is null then
    raise exception 'team_selection_policy'
      using errcode = 'object_not_in_prerequisite_state', detail = 'team_selection_policy';
  end if;
  v_due := backoffice.business_deadline('team_selection', pg_catalog.now(), v_minutes);

  insert into search.selection_requests
    (advertiser_account_id, campaign_id, filters, language, message, sla_due_at)
  values (v_caller, p_campaign_id, p_filters, v_language, v_message, v_due)
  returning id into v_id;

  -- last: the chain lock is the last lock of the transaction (04 §7.2); the identifiers only
  -- (EC-L3F-05-6)
  perform audit.append('search.selection_requested', 'selection_request', v_id,
                       pg_catalog.jsonb_build_object('campaign_id', p_campaign_id));
  return pg_catalog.jsonb_build_object(
    'state', 'requested',
    'answerBy', pg_catalog.to_char(pg_catalog.timezone('UTC', v_due),
                                   'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
end
$$;

comment on function search.request_team_selection(jsonb, uuid, text) is
  'l3f/modele.md §6 (0325; 10 RG61, CA39, CA64; D45, D46): the calling brand asks the INFLUX team '
  'for a selection. 42501 outside a brand session (search.require_creator_searcher); {state: '
  'brand_not_published} (RG1); the switch and the threshold ignored (RG61); '
  'selection_limits.requestsPerDay on 24 h sliding: {state: rate_limited, retryAfterSeconds}, '
  'nothing written; p_filters by search.check_creator_search_filters (22023 filters); p_campaign_id '
  'admitted (search.is_admitted_campaign) or NULL, P0002 campaign otherwise; p_message NULL or 1 to '
  '1 000 characters once trimmed (22023 message). One line of search.selection_requests (the '
  'language of the account, sla_due_at by backoffice.business_deadline of team_selection) and '
  'search.selection_requested {campaign_id}. {state: requested, answerBy}. Nothing to a creator, '
  'leads.outbox_events, matching nor messaging. SECURITY DEFINER owned by '
  'influx_creator_search_definer, empty search_path; EXECUTE for influx_advertiser only.';

revoke all on function search.request_team_selection(jsonb, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function search.request_team_selection(jsonb, uuid, text) to influx_advertiser;

reset role;
revoke create on schema search from influx_creator_search_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_search_definer', current_user);
end
$$;

-- 8. E-5 recreated by its owner from its 0318 versions (export and execution) -----------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 8.1 The export (0137 ... 0314, 0318): the requests for a selection beside the shortlists ---------
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
               -- 0318 (l3e/modele.md §9; EC-L3E-05-1, -2): each search of creators (instant,
               -- filters, sort, page, outcome, the band of its count served above k or NULL, the k
               -- block, the title of its campaign); never the exact count, an impression, a reason,
               -- an exposure, a creator served nor the id of a line
               'creator_searches', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'searched_at', privacy.iso_utc(q.created_at),
                           'filters', q.filters,
                           'sort', q.sort_code,
                           'page', q.page_reached,
                           'outcome', q.outcome,
                           'count_band',
                              case when q.outcome = 'served' and not q.blocked_by_k_anonymity
                                   then search.result_count_band(q.result_count) end,
                           'blocked_by_k_anonymity', q.blocked_by_k_anonymity,
                           'campaign_title', (
                              select c.title from campaigns.campaigns c
                               where c.id = q.campaign_id
                                 and c.advertiser_account_id = q.account_id))
                         order by q.created_at, q.id)
                    from search.search_queries q
                   where q.account_id = p.account_id), '[]'::jsonb),
               -- 0318 (modele §9; EC-L3E-05-1, -4): each shortlist (name, title of its campaign,
               -- date) and its creators by alias (date, note): the only aliases this export carries
               'shortlists', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'name', s.name,
                           'campaign_title', (
                              select c.title from campaigns.campaigns c
                               where c.id = s.campaign_id
                                 and c.advertiser_account_id = s.advertiser_account_id),
                           'created_at', privacy.iso_utc(s.created_at),
                           'creators', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'alias', v.alias,
                                       'added_at', privacy.iso_utc(i.added_at),
                                       'note', i.note)
                                     order by i.added_at, i.creator_account_id)
                                from search.shortlist_items i
                                join profiles.creator_public_profiles v
                                  on v.account_id = i.creator_account_id
                               where i.shortlist_id = s.id), '[]'::jsonb))
                         order by s.created_at, s.id)
                    from search.shortlists s
                   where s.advertiser_account_id = p.account_id), '[]'::jsonb),
               -- 0325 (l3f/modele.md §6; 10 RG61, CA39; EC-L3F-05-5): each request for a selection
               -- by the INFLUX team (instant, filters, title of its campaign, language, message,
               -- state); never its id, its deadline nor an agent
               'selection_requests', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'requested_at', privacy.iso_utc(r.created_at),
                           'filters', r.filters,
                           'campaign_title', (
                              select c.title from campaigns.campaigns c
                               where c.id = r.campaign_id
                                 and c.advertiser_account_id = r.advertiser_account_id),
                           'language', r.language,
                           'message', r.message,
                           'state', r.state)
                         order by r.created_at, r.id)
                    from search.selection_requests r
                   where r.advertiser_account_id = p.account_id), '[]'::jsonb),
               -- 0318 (modele §9; 10 RG30): the blocks the brand posed (the creator's alias,
               -- reason, comment, dates); never a block posed against it nor by INFLUX
               'blocks', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'creator_alias', v.alias,
                           'reason', b.reason_code,
                           'comment', b.comment,
                           'created_at', privacy.iso_utc(b.created_at),
                           'lifted_at', privacy.iso_utc(b.lifted_at))
                         order by b.created_at, b.id)
                    from matching.party_blocks b
                    left join profiles.creator_public_profiles v
                      on v.account_id = b.creator_account_id
                   where b.advertiser_account_id = p.account_id
                     and b.blocked_by_side = 'advertiser'), '[]'::jsonb),
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
               -- 0314 (l3d/modele.md §6; 11 RG22): each read of the feed of the open campaigns or
               -- of a campaign record (kind, campaign asked, sort, page, outcome, instant); never
               -- the id of a line (EC-L3D-02-1)
               'campaign_reads', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'kind', r.kind,
                           'campaign_id', r.campaign_id,
                           'feed_sort', r.feed_sort,
                           'feed_page', r.feed_page,
                           'outcome', r.outcome,
                           'read_at', privacy.iso_utc(r.read_at))
                         order by r.read_at, r.id)
                    from search.creator_campaign_reads r
                   where r.creator_account_id = p.account_id), '[]'::jsonb),
               -- 0318 (modele §9; 10 RG30): the blocks the creator posed (the brand's legal name,
               -- reason, comment, dates); never a block posed against it nor by INFLUX; never an
               -- impression, a reason nor an exposure (RG8)
               'blocks', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'brand', a.legal_name,
                           'reason', b.reason_code,
                           'comment', b.comment,
                           'created_at', privacy.iso_utc(b.created_at),
                           'lifted_at', privacy.iso_utc(b.lifted_at))
                         order by b.created_at, b.id)
                    from matching.party_blocks b
                    left join profiles.advertiser_profiles a
                      on a.account_id = b.advertiser_account_id
                   where b.creator_account_id = p.account_id
                     and b.blocked_by_side = 'creator'), '[]'::jsonb),
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
  'a deadline, the first review, the duplicate alert nor an internal comment), creator_searches '
  '(0318: instant, filters, sort, page, outcome, count_band of a search served above k or NULL, k '
  'block, campaign_title; never the exact count, an impression, a reason, an exposure nor a creator '
  'served), shortlists (0318: name, campaign_title, date, creators by alias with date and note), '
  'selection_requests (0325: instant, filters, campaign_title, language, message, state; never its '
  'id nor its deadline) and '
  'blocks (0318: those the brand posed, creator_alias, reason, comment, dates); creator_profile '
  '(0219) carries the creator '
  'storefront of 0216 and 0218, its five lists, its identity, its network lines with their exact '
  'figures, bands and exact audience, the refused sectors, the history of the metrics (an agent '
  'author shown as INFLUX) and verification (0226: the creator requests and the network badges with '
  'their observed figures and period; 0235: disputes, identifier_changes), portfolio (0245: each '
  'visual, its state, place, replacement, size, sides, caption, dates and refusal reason, with its '
  'statements of RG83; never the bytes, the key nor the checksum), review_entries (0245: kind, '
  'state, dates, reason, message to the creator), field_revisions (0245: field, value, status, '
  'dates; never the row key) and campaign_reads (0314: kind, campaign asked, sort, page, outcome, '
  'instant of each read of the feed or of a campaign record; never the id of a line) and blocks '
  '(0318: those the creator posed, brand legal name, reason, comment, dates; never a block posed '
  'against the member nor by INFLUX, never who lifted it, never an impression); every '
  'request carries '
  'opened_by and opening_reason, every badge revocation_message (0235); never public_ref nor the id '
  'of a line or a history row, never an evidence, a code, an observed or previous handle, an agent, '
  'a decider, a lock, an internal or opening comment nor a declared value at a decision; NULL '
  'without a storefront; activity_log serves the codes whose export_class is exported only '
  '(0302, F3), the lines of the account, about the account and, since 0310 (L3BS-5), about its '
  'campaigns, an internal or system actor shown as INFLUX. p_addresses: privacy.account_addresses(). SECURITY INVOKER owned by '
  'influx_privacy_definer, NO grant.';

-- 8.2 The execution (0150 ... 0314, 0318): the erasure deletes the openings and the requests --------
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
  -- and their entries, snapshots and interventions of L3C (0310), the reads of the open campaigns of
  -- L3D (0314), the creator search and the blocks of L3E (0318), the openings and the requests for a
  -- selection of L3F (0325), in ONE transaction.
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

  -- 3 nonies. the reads of the open campaigns of L3D (0314; l3d/modele.md §6; 04 §9): every line of
  -- the account deleted, none kept pseudonymous; the account is deleted above, the only state the
  -- policy and the guard of the journal let the owner of the erasure delete in
  delete from search.creator_campaign_reads where creator_account_id = v_account.id;

  -- 3 decies. the creator search and the blocks of L3E (0316, 0317; l3e/modele.md §9; 04 §9;
  -- EC-L3E-05-3): deleted, none kept pseudonymous. A brand: its searches with their impressions and
  -- reasons, its shortlists with their creators; a creator: its impressions and reasons in any
  -- search, its place in any shortlist, its exposure; either: every block of a pair it belongs to,
  -- whoever posed it. Children first; the account is deleted above, the only state the policies and
  -- the guards of 0316 and 0317 let the owner of the erasure delete in. 0325 (l3f/modele.md §2,
  -- §6): the openings of a profile, by the brand that opened or of the creator opened, before the
  -- searches they name; the requests of a brand for a selection by the team
  delete from search.profile_openings o
   where o.account_id = v_account.id or o.creator_account_id = v_account.id;
  delete from search.selection_requests where advertiser_account_id = v_account.id;
  delete from search.impression_reasons r
   where r.creator_account_id = v_account.id
      or r.search_query_id in (select q.id from search.search_queries q
                                where q.account_id = v_account.id);
  delete from search.search_impressions i
   where i.creator_account_id = v_account.id
      or i.search_query_id in (select q.id from search.search_queries q
                                where q.account_id = v_account.id);
  delete from search.search_queries where account_id = v_account.id;
  delete from search.creator_exposures where creator_account_id = v_account.id;
  delete from search.shortlist_items i
   where i.creator_account_id = v_account.id
      or i.shortlist_id in (select s.id from search.shortlists s
                             where s.advertiser_account_id = v_account.id);
  delete from search.shortlists where advertiser_account_id = v_account.id;
  delete from matching.party_blocks
   where advertiser_account_id = v_account.id or creator_account_id = v_account.id;

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
  '(0310); its reads of the open campaigns deleted (0314); its searches, impressions and their '
  'reasons, its exposure, its shortlists and its place in any shortlist, every block of a pair it '
  'belongs to deleted (0318); its openings of a profile, as a brand or as the creator opened, and '
  'its requests for a selection deleted (0325); addresses replaced by the marker in '
  'email_change_requests (open ones cancelled account_deleted), '
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

-- 9. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  c_dynamic  constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner    constant text := 'influx_creator_search_definer';
  c_door     constant regprocedure := 'search.request_team_selection(jsonb, uuid, text)'::regprocedure;
  v_bad      text;
begin
  -- the door: owner, definer, empty search_path, EXECUTE for influx_advertiser alone
  if (select pg_catalog.pg_get_userbyid(p.proowner) <> c_owner or not p.prosecdef
             or p.proconfig is distinct from array['search_path=""']
        from pg_catalog.pg_proc p where p.oid = c_door) then
    raise exception 'request_team_selection must be a definer of %, empty search_path', c_owner;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_door
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and a.grantee <> 'influx_advertiser'::regrole;
  if v_bad is not null then
    raise exception 'request_team_selection executable beyond the brand: %', v_bad;
  end if;

  -- 03 P7, fiche invariants 4 and 6 (D45, CA64): no dynamic SQL in a function of the owner; the door
  -- names neither layer I, Storage, the outbox, matching, messaging nor a campaign table
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'a function of the creator search runs dynamic SQL: %', v_bad;
  end if;
  if (select p.prosrc ~* ('\m(creator_identities|creator_social_accounts|creator_audience_\w+'
                          '|creator_network_metrics_history)\M')
             or p.prosrc ~* '\m"?storage"?\s*\.'
             or p.prosrc ~* '\m(leads|matching|messaging|campaigns)\s*\.|outbox|notification'
        from pg_catalog.pg_proc p where p.oid = c_door) then
    raise exception 'request_team_selection names layer I, Storage, the outbox, matching or a campaign';
  end if;
  -- EC-L3F-05-4: the door alone names the language of an account among the owner's functions
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole and p.prosrc ~* '\mpreferred_language\M'
     and p.oid <> c_door;
  if v_bad is not null then
    raise exception 'a function of the creator search reads the language of an account: %', v_bad;
  end if;

  -- fiche invariant 4: the table forces RLS with its restrictive member policy, no execution role
  if not exists (select 1 from pg_catalog.pg_class c
                  where c.oid = 'search.selection_requests'::regclass
                    and c.relrowsecurity and c.relforcerowsecurity)
     or not exists (select 1 from pg_catalog.pg_policy p
                     where p.polrelid = 'search.selection_requests'::regclass
                       and p.polname = 'selection_requests_no_member_access'
                       and not p.polpermissive) then
    raise exception 'search.selection_requests must force RLS with its restrictive member policy';
  end if;
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                       'influx_privacy', 'anon', 'authenticated', 'service_role')
     and (pg_catalog.has_table_privilege(r.oid, 'search.selection_requests',
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(r.oid, 'search.selection_requests',
                                                 'SELECT, INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'search.selection_requests reached by an execution role: %', v_bad;
  end if;

  -- the writer never updates nor deletes a request, never reads its message, filters nor language
  if pg_catalog.has_table_privilege(c_owner, 'search.selection_requests', 'UPDATE, DELETE, TRUNCATE')
     or pg_catalog.has_any_column_privilege(c_owner, 'search.selection_requests', 'UPDATE')
     or pg_catalog.has_column_privilege(c_owner, 'search.selection_requests', 'message', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'search.selection_requests', 'filters', 'SELECT')
     or pg_catalog.has_column_privilege(c_owner, 'search.selection_requests', 'language', 'SELECT') then
    raise exception '% writes or reads a request beyond its deposit', c_owner;
  end if;

  -- §6: on the two tables, influx_privacy_definer reads and deletes, never inserts nor updates
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid in ('search.profile_openings'::regclass, 'search.selection_requests'::regclass)
     and (pg_catalog.has_table_privilege('influx_privacy_definer', c.oid, 'INSERT, UPDATE, TRUNCATE')
          or pg_catalog.has_any_column_privilege('influx_privacy_definer', c.oid, 'INSERT, UPDATE')
          or not pg_catalog.has_table_privilege('influx_privacy_definer', c.oid, 'DELETE')
          or not exists (select 1 from pg_catalog.pg_policy p
                          where p.polrelid = c.oid and p.polcmd = 'd'
                            and p.polroles = array['influx_privacy_definer'::regrole::oid]));
  if v_bad is not null then
    raise exception 'influx_privacy_definer: a write beyond the erasure, or a delete without its policy: %',
      v_bad;
  end if;

  -- E-5: export_document() invoker, execute_request() definer, both of influx_privacy_definer, an
  -- empty search_path
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'privacy.export_document(uuid, text[], jsonb)'::regprocedure)
       <> 'influx_privacy_definer'
     or (select prosecdef from pg_catalog.pg_proc
          where oid = 'privacy.export_document(uuid, text[], jsonb)'::regprocedure)
     or (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
          where oid = 'privacy.execute_request(uuid, jsonb)'::regprocedure)
          <> 'influx_privacy_definer'
     or not (select prosecdef from pg_catalog.pg_proc
              where oid = 'privacy.execute_request(uuid, jsonb)'::regprocedure)
     or exists (select 1 from pg_catalog.pg_proc
                 where oid in ('privacy.export_document(uuid, text[], jsonb)'::regprocedure,
                               'privacy.execute_request(uuid, jsonb)'::regprocedure)
                   and proconfig is distinct from array['search_path=""']) then
    raise exception 'E-5 recreated with a wrong owner or mode';
  end if;

  -- queue 9: one provisional policy; the code exported
  if not exists (select 1 from backoffice.queues q
                   join backoffice.sla_policies p on p.queue_code = q.code
                  where q.code = 'team_selection' and p.is_provisional
                    and p.target_decision_minutes = 480 and p.target_claim_minutes = 240) then
    raise exception 'queue team_selection must hold its provisional policy (480, claim 240)';
  end if;
  if not exists (select 1 from audit.event_types
                  where code = 'search.selection_requested' and subject_type = 'selection_request'
                    and export_class = 'exported') then
    raise exception 'the code search.selection_requested is not loaded with its export_class';
  end if;

  -- the owners left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid in (c_owner::regrole, 'influx_privacy_definer'::regrole,
                                 'influx_audit_writer'::regrole)
                and (m.inherit_option or m.set_option)
                and pg_catalog.pg_get_userbyid(m.member) = current_user)
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE') then
    raise exception 'an owner left with a member or CREATE';
  end if;
end
$$;
