-- =============================================================================
-- 0330_search_team_selection_queue
-- -----------------------------------------------------------------------------
-- Lot 3 / L3G, commit 06 (jalons/l3g/06.md; l3g-fiche.md invariants 8, 11, 2, 3, 12, 14; jalons/l3g/
-- modele.md §5, which PREVAILS for every name; 10 RG61, RG84; 15 queue 9, RG27, RG35, RG36, AL23;
-- 17b I13). Queue 9 team_selection: the agents read the requests of the brands, claim one under a lock,
-- give it back, extend it and close it with a reason of a closed list. Nothing to the brand (its e-mail
-- comes with Lot 5), nothing to a creator, to leads.outbox_events nor to matching.* (D45, RG8).
-- Signalled I-4 (03): new columns and their checks, a SELECT of columns and its policy to agent and
-- admin, SECURITY DEFINER doors, a register code, AL23, column GRANTs and policies to
-- influx_agent_search_definer, EXECUTE on audit.append() to it.
--
-- 1. The register code search.selection_request_closed (domain search, subject selection_request,
--    info, exported; payload {reason_code}). The claim writes the codes queue.* of 0210 with
--    queue_code team_selection.
-- 2. search.selection_requests gains claimed_by_account_id, claimed_at, claim_expires_at (a claim is
--    whole), closed_at, closed_by_account_id, close_reason_code, close_note: closed <=> date, agent and
--    reason; the reasons the subset of list A (13 RG83) of modele §5: off_brief, motive_insufficient,
--    contact_details_in_text, campaign_closed, duplicate, other; the note 10 to 500 printable
--    characters iff other.
-- 3. AL23 (15 §F): etat, {agent, admin}, the deadline of a request (sla_due_at, frozen at the deposit);
--    derived by the API from the open requests past it.
-- 4. Agent and admin in aal2 read every column of the requests (the pattern of 0307): the criteria, the
--    campaign, the language, the message as text (D46: the agents alone), the deadline, the claim and
--    the closure. No write: the doors below write.
-- 5. The doors, owned by influx_agent_search_definer (modele header), SECURITY DEFINER, empty
--    search_path, EXECUTE for influx_agent and influx_admin ONLY; the caller is
--    search.require_identified_searcher() (agent or admin, active account and internal profile, aal2;
--    42501):
--      search.open_team_selection_request(id) → (outcome, holder, claimed_at, claim_expires_at)
--            claimed (free or expired, by an atomic conditional UPDATE for claim_expiry_minutes;
--            queue.claim_expired first for an expired one), held, read_only (the live holder) or
--            closed; queue.entry_opened {queue_code, outcome}.
--      search.release_team_selection_request(id)  the holder gives it back; queue.claim_released.
--      search.extend_team_selection_claim(id) → timestamptz  the holder extends it;
--            queue.claim_extended.
--      search.close_team_selection_request(id, reason, note) → timestamptz  22023 reason, note; the
--            holder's live claim (55P03 no_live_claim); state closed, the claim given back;
--            search.selection_request_closed {reason_code}.
--    An unknown request is 42501 (T14), as an open request of a brand the caller holds (15 RG36, 13
--    RG35); a closed one 55000 entry_closed (release, extend, close). No forced release (modele -4).
--
-- RIGHTS (03 I-4, signalled): SELECT of the sixteen columns of search.selection_requests to influx_agent
-- and influx_admin with its policy (aal2); to influx_agent_search_definer: USAGE on backoffice and
-- audit, SELECT (key, value) of backoffice.operational_settings bounded to claim_expiry_minutes,
-- SELECT (id, advertiser_account_id, state, claimed_by_account_id, claimed_at, claim_expires_at) and
-- UPDATE of the claim and closure columns of search.selection_requests with their policies, a second
-- policy on identity.accounts (the brand of a request: its owner_agent_id, 15 RG36), EXECUTE on
-- audit.append(); EXECUTE on the four doors to influx_agent and influx_admin. NOTHING new to
-- influx_advertiser, influx_creator nor influx_creator_search_definer; neither layer I, leads, matching,
-- a band nor a budget.
--
-- Not here: the routes (L3G-10), the screen (L3G-13), the e-mail to the brand at the closure (Lot 5),
-- « Proposer » (Lot 4), the purge at 12 months after the closure (Lot 6), the shortlist joined to a
-- request (10 RG61.1 to RG61.4).
--
-- EC-L3G-06 (micro-gaps, the safest choice):
--   EC-L3G-06-1  « durée de sla_policies » (modele §5) is read as the lock of 15 RG29 (30 min):
--                claim_expiry_minutes, the setting of every locked queue (0307); target_claim_minutes
--                (240) is the objective to claim, never the length of a lock.
--   EC-L3G-06-2  15 RG36 and 13 RG35 apply: an open request of a brand the caller holds
--                (owner_agent_id) is refused to its opening, extension and closure (42501, one answer
--                with the unknown); the release stays (he gives a claim back), as 0307.
--   EC-L3G-06-3  the closure gives the claim back (claim columns emptied); the closer is
--                closed_by_account_id.
--   EC-L3G-06-4  the note is trimmed; with a reason other than other, a note is refused (22023 note),
--                never silently dropped; printable as the messages of 0307 (no control character).
--   EC-L3G-06-5  the read policy hides no request of a held brand: the route filters it, as queue 7
--                (EC-L3C-02-7).
--
-- ROLLBACK (before any request is claimed once 0330 is applied): drop the four doors and
-- search.lock_held_team_selection_request(); drop the policies selection_requests_internal_select,
-- selection_requests_agent_search_definer_select, _update, accounts_agent_search_definer_requester_select,
-- operational_settings_agent_search_definer_select and revoke their grants; revoke execute on
-- audit.append from influx_agent_search_definer (as influx_audit_writer) and usage on backoffice, audit;
-- drop the new columns and checks, recreate selection_requests_state as check (state in ('open'));
-- delete AL23 and the code search.selection_request_closed.
-- =============================================================================

-- 1. The register code of the closure (04 §4.3; F3, 0302) ---------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity, export_class) values
  -- modele §5: an agent closes a request of queue 9 with a reason (codes only)
  ('search.selection_request_closed', 'search', 'selection_request', 'info', 'exported')
on conflict (code) do nothing;

-- 2. The claim and the closure of a request (modele §5; 15 RG27 C1 to C3) ------------------------------

alter table search.selection_requests
  add column if not exists claimed_by_account_id  uuid references identity.accounts (id),
  add column if not exists claimed_at             timestamptz,
  add column if not exists claim_expires_at       timestamptz,
  add column if not exists closed_at              timestamptz,
  add column if not exists closed_by_account_id   uuid references identity.accounts (id),
  add column if not exists close_reason_code      text,
  add column if not exists close_note             text;

-- EC-L3F-05-2: the check widens with the closure, never a closed request without its reason
alter table search.selection_requests drop constraint if exists selection_requests_state;
alter table search.selection_requests add constraint selection_requests_state
  check (state in ('open', 'closed'));

alter table search.selection_requests drop constraint if exists selection_requests_closed;
alter table search.selection_requests add constraint selection_requests_closed
  check ((state = 'closed') = (closed_at is not null)
         and (state = 'closed') = (closed_by_account_id is not null)
         and (state = 'closed') = (close_reason_code is not null));
alter table search.selection_requests drop constraint if exists selection_requests_closed_after;
alter table search.selection_requests add constraint selection_requests_closed_after
  check (closed_at >= created_at);

-- modele §5: the subset of list A (13 RG83) that names no creator
alter table search.selection_requests drop constraint if exists selection_requests_close_reason;
alter table search.selection_requests add constraint selection_requests_close_reason
  check (close_reason_code in ('off_brief', 'motive_insufficient', 'contact_details_in_text',
                               'campaign_closed', 'duplicate', 'other'));

-- the note, 10 to 500 printable characters, iff other (EC-L3G-06-4)
alter table search.selection_requests drop constraint if exists selection_requests_close_note;
alter table search.selection_requests add constraint selection_requests_close_note
  check ((close_note is not null) = (close_reason_code is not distinct from 'other')
         and char_length(close_note) between 10 and 500
         and close_note ~ '[^[:space:]]'
         and close_note !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]');

-- 15 RG27 C1 to C3: a claim is whole, its expiry after it
alter table search.selection_requests drop constraint if exists selection_requests_claim_together;
alter table search.selection_requests add constraint selection_requests_claim_together
  check ((claimed_by_account_id is null) = (claimed_at is null)
         and (claimed_at is null) = (claim_expires_at is null));
alter table search.selection_requests drop constraint if exists selection_requests_claim_expiry;
alter table search.selection_requests add constraint selection_requests_claim_expiry
  check (claim_expires_at > claimed_at);

comment on column search.selection_requests.state is
  'open, then closed by search.close_team_selection_request() (0330): closed <=> closed_at, '
  'closed_by_account_id and close_reason_code.';
comment on column search.selection_requests.close_reason_code is
  'modele §5 (0330): off_brief, motive_insufficient, contact_details_in_text, campaign_closed, '
  'duplicate, other (the subset of list A, 13 RG83, that names no creator; 17b I13).';
comment on column search.selection_requests.close_note is
  'The note of the agent, 10 to 500 printable characters, iff the reason is other (0330). Never sent '
  'to the brand at Lot 3 (its e-mail comes with Lot 5), never written to the register.';

-- 3. AL23 (15 §F; modele §5) ----------------------------------------------------------------------------

insert into backoffice.alert_definitions
  (code, label_key, nature, threshold_value, recipient_roles, source_document)
values
  ('AL23', 'alert.AL23', 'etat',
   '{"basis": "selection_requests.sla_due_at"}',
   '{agent,admin}', '15 §F AL23; 10 RG84')
on conflict (code) do nothing;

-- 4. Agent and admin read queue 9 (the pattern of 0307 §5.2; modele §5) ----------------------------

grant select (id, advertiser_account_id, campaign_id, filters, language, message, state, sla_due_at,
              created_at, claimed_by_account_id, claimed_at, claim_expires_at, closed_at,
              closed_by_account_id, close_reason_code, close_note)
   on search.selection_requests to influx_agent, influx_admin;

drop policy if exists selection_requests_internal_select on search.selection_requests;
create policy selection_requests_internal_select on search.selection_requests
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 5. What influx_agent_search_definer reads and writes for queue 9 (modele §5) ----------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner.

grant usage on schema backoffice, audit to influx_agent_search_definer;

-- 5.1 The length of a lock (EC-L3G-06-1)
grant select (key, value) on backoffice.operational_settings to influx_agent_search_definer;
drop policy if exists operational_settings_agent_search_definer_select
  on backoffice.operational_settings;
create policy operational_settings_agent_search_definer_select on backoffice.operational_settings
  for select to influx_agent_search_definer
  using (key = 'claim_expiry_minutes');

-- 5.2 The requests: the claim and the closure
grant select (id, advertiser_account_id, state, claimed_by_account_id, claimed_at, claim_expires_at),
      update (claimed_by_account_id, claimed_at, claim_expires_at, state, closed_at,
              closed_by_account_id, close_reason_code, close_note)
   on search.selection_requests to influx_agent_search_definer;

drop policy if exists selection_requests_agent_search_definer_select on search.selection_requests;
create policy selection_requests_agent_search_definer_select on search.selection_requests
  for select to influx_agent_search_definer
  using (true);
drop policy if exists selection_requests_agent_search_definer_update on search.selection_requests;
create policy selection_requests_agent_search_definer_update on search.selection_requests
  for update to influx_agent_search_definer
  using (true)
  with check (true);

-- 5.3 The brand of a request: who holds it (15 RG36, EC-L3G-06-2); the columns of 0328 only
drop policy if exists accounts_agent_search_definer_requester_select on identity.accounts;
create policy accounts_agent_search_definer_requester_select on identity.accounts
  for select to influx_agent_search_definer
  using (exists (select 1 from search.selection_requests r
                  where r.advertiser_account_id = accounts.id));

-- 5.4 The register, through audit.append(), granted by its owner (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_agent_search_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 6. The doors of queue 9, as influx_agent_search_definer (03 P7 rule 5) ----------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_agent_search_definer', current_user);
end
$$;
grant create on schema search to influx_agent_search_definer;
set role influx_agent_search_definer;

-- 6.1 The gate of every act on a held request (extension, closure). SECURITY INVOKER: it runs with the
-- rights of the door that calls it.
create or replace function search.lock_held_team_selection_request(p_request_id uuid, p_caller uuid)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_request  record;
begin
  select r.advertiser_account_id, r.state, r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
    into v_request
    from search.selection_requests r
   where r.id = p_request_id
     for update;
  -- unknown, or an open request of a brand the caller HOLDS (15 RG36): one answer (T14)
  if not found
     or (v_request.state = 'open'
         and exists (select 1 from identity.accounts a
                      where a.id = v_request.advertiser_account_id
                        and a.owner_agent_id = p_caller)) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_request.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- 15 C2: no act without the caller's live claim
  if v_request.claimed_by_account_id is distinct from p_caller
     or v_request.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_request.claim_expires_at > pg_catalog.now()
                          then v_request.claimed_by_account_id::text else 'none' end;
  end if;
  return v_request.claimed_at;
end
$$;

comment on function search.lock_held_team_selection_request(uuid, uuid) is
  'The gate of the acts on a held request of queue 9 (0330): the request FOR UPDATE; 42501 (unknown, '
  'an open request of a brand the caller holds, 15 RG36), 55000 entry_closed, 55P03 no_live_claim '
  '(DETAIL the live holder or none); returns claimed_at. SECURITY INVOKER owned by '
  'influx_agent_search_definer, executed by its owner only.';

-- 6.2 Opening = claiming (15 RG27 C1, C2, RG35)
create or replace function search.open_team_selection_request(p_request_id uuid)
returns table (
  outcome            text,
  holder_account_id  uuid,
  claimed_at         timestamptz,
  claim_expires_at   timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller   uuid := search.require_identified_searcher();
  v_request  record;
  v_minutes  integer;
  v_outcome  text;
  v_holder   uuid;
  v_claimed  timestamptz;
  v_expires  timestamptz;
begin
  select r.advertiser_account_id, r.state, r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
    into v_request
    from search.selection_requests r
   where r.id = p_request_id
     for update;
  -- unknown, or an open request of a brand the caller HOLDS (15 RG36, EC-L3G-06-2): one answer
  if not found
     or (v_request.state = 'open'
         and exists (select 1 from identity.accounts a
                      where a.id = v_request.advertiser_account_id
                        and a.owner_agent_id = v_caller)) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_request.state <> 'open' then
    v_outcome := 'closed';
  elsif v_request.claimed_by_account_id = v_caller
        and v_request.claim_expires_at > pg_catalog.now() then
    v_outcome := 'held';
    v_holder  := v_caller;
    v_claimed := v_request.claimed_at;
    v_expires := v_request.claim_expires_at;
  else
    -- EC-L3G-06-1: the lock of 15 RG29
    select (s.value)::integer into v_minutes
      from backoffice.operational_settings s
     where s.key = 'claim_expiry_minutes';
    if v_minutes is null then
      raise exception 'claim_expiry_minutes is not set'
        using errcode = 'object_not_in_prerequisite_state';
    end if;

    -- 04 l. 2465-2480: the condition IS the lock, the row count the answer
    update search.selection_requests r
       set claimed_by_account_id = v_caller,
           claimed_at            = pg_catalog.now(),
           claim_expires_at      = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
     where r.id = p_request_id
       and r.state = 'open'
       and (r.claimed_by_account_id is null or r.claim_expires_at <= pg_catalog.now())
    returning r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
      into v_holder, v_claimed, v_expires;

    if found then
      v_outcome := 'claimed';
      -- file.md A9: an expired claim taken over is written first, its holder and its real expiry
      if v_request.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_request_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'team_selection',
                               'holder_account_id', v_request.claimed_by_account_id,
                               'claimed_at', v_request.claimed_at,
                               'expired_at', v_request.claim_expires_at));
      end if;
    else
      -- 15 C2: « déjà prise en charge par … », read only, never an error
      v_outcome := 'read_only';
      v_holder  := v_request.claimed_by_account_id;
      v_claimed := v_request.claimed_at;
      v_expires := v_request.claim_expires_at;
    end if;
  end if;

  -- 15 RG35: the opening is an act; last
  perform audit.append('queue.entry_opened', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'team_selection',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires;
end
$$;

comment on function search.open_team_selection_request(uuid) is
  'modele §5; 15 RG27 C1 to C3, RG35, RG36 (0330): an agent or an admin opens a request of queue 9: '
  'free or expired, claimed by an atomic conditional UPDATE for claim_expiry_minutes '
  '(queue.claim_expired first for an expired one); outcome claimed, held, read_only (the live holder, '
  '15 C2) or closed; queue.entry_opened {queue_code team_selection, outcome}. 42501 outside '
  'search.require_identified_searcher(), for an unknown request or an open request of a brand the '
  'caller holds. SECURITY DEFINER owned by influx_agent_search_definer, empty search_path; EXECUTE for '
  'influx_agent and influx_admin only.';

-- 6.3 Release (15 C3, no comment)
create or replace function search.release_team_selection_request(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := search.require_identified_searcher();
  v_request  record;
begin
  select r.state, r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
    into v_request
    from search.selection_requests r
   where r.id = p_request_id
     for update;
  -- a brand the caller holds: he gives a claim back, never closes (EC-L3G-06-2)
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_request.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_request.claimed_by_account_id is distinct from v_caller
     or v_request.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_request.claim_expires_at > pg_catalog.now()
                          then v_request.claimed_by_account_id::text else 'none' end;
  end if;

  update search.selection_requests r
     set claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
   where r.id = p_request_id;

  perform audit.append('queue.claim_released', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'team_selection',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_request.claimed_at));
end
$$;

comment on function search.release_team_selection_request(uuid) is
  '15 RG27 C3 (0330): the holder of a live claim gives the request back; queue.claim_released, no '
  'comment. 55P03 no_live_claim, 55000 entry_closed, 42501. SECURITY DEFINER owned by '
  'influx_agent_search_definer, empty search_path; EXECUTE for influx_agent and influx_admin only.';

-- 6.4 Extend (file.md A9)
create or replace function search.extend_team_selection_claim(p_request_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := search.require_identified_searcher();
  v_claimed  timestamptz;
  v_minutes  integer;
  v_expires  timestamptz;
begin
  v_claimed := search.lock_held_team_selection_request(p_request_id, v_caller);

  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s
   where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  update search.selection_requests r
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where r.id = p_request_id
  returning r.claim_expires_at into v_expires;

  perform audit.append('queue.claim_extended', 'queue_entry', p_request_id,
                       pg_catalog.jsonb_build_object('queue_code', 'team_selection',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_claimed,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function search.extend_team_selection_claim(uuid) is
  'file.md A9 (0330): the holder of a live claim extends it to now() + claim_expiry_minutes; '
  'queue.claim_extended; returns the new expiry; the refusals of lock_held_team_selection_request(). '
  'SECURITY DEFINER owned by influx_agent_search_definer, empty search_path; EXECUTE for influx_agent '
  'and influx_admin only.';

-- 6.5 Close with a reason (modele §5; 15 RG7; 17b I13)
create or replace function search.close_team_selection_request(
  p_request_id   uuid,
  p_reason_code  text,
  p_note         text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := search.require_identified_searcher();
  v_note    text := pg_catalog.btrim(p_note);
  v_at      timestamptz;
begin
  -- the closed list of modele §5 (22023 reason)
  if p_reason_code is null
     or p_reason_code not in ('off_brief', 'motive_insufficient', 'contact_details_in_text',
                              'campaign_closed', 'duplicate', 'other') then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  -- the note iff other, 10 to 500 printable characters once trimmed (EC-L3G-06-4; 22023 note)
  if p_reason_code = 'other' then
    if v_note is null
       or pg_catalog.char_length(v_note) not between 10 and 500
       or v_note ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'note';
    end if;
  elsif p_note is not null then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'note';
  end if;

  -- the caller's live claim (55P03), an open request (55000), not a held brand (42501)
  perform search.lock_held_team_selection_request(p_request_id, v_caller);

  v_at := pg_catalog.now();
  update search.selection_requests r
     set state                 = 'closed',
         closed_at             = v_at,
         closed_by_account_id  = v_caller,
         close_reason_code     = p_reason_code,
         close_note            = case when p_reason_code = 'other' then v_note end,
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null
   where r.id = p_request_id;

  -- the register, the reason code only (never the note); last (04 §7.2)
  perform audit.append('search.selection_request_closed', 'selection_request', p_request_id,
                       pg_catalog.jsonb_build_object('reason_code', p_reason_code));
  return v_at;
end
$$;

comment on function search.close_team_selection_request(uuid, text, text) is
  'modele §5; 15 RG7; 17b I13 (0330): the holder of a live claim closes a request of queue 9 with a '
  'reason of the closed list (off_brief, motive_insufficient, contact_details_in_text, '
  'campaign_closed, duplicate, other; 22023 reason) and, for other only, a note of 10 to 500 '
  'printable characters (22023 note); then the refusals of lock_held_team_selection_request(). State '
  'closed, closed_at, closed_by_account_id, the claim given back; '
  'search.selection_request_closed {reason_code}. Returns the instant. Nothing to the brand, a '
  'creator, the outbox nor matching (D45). SECURITY DEFINER owned by influx_agent_search_definer, '
  'empty search_path; EXECUTE for influx_agent and influx_admin only.';

revoke all on function search.lock_held_team_selection_request(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.open_team_selection_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.release_team_selection_request(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.extend_team_selection_claim(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.close_team_selection_request(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function
  search.open_team_selection_request(uuid),
  search.release_team_selection_request(uuid),
  search.extend_team_selection_claim(uuid),
  search.close_team_selection_request(uuid, text, text)
  to influx_agent, influx_admin;

reset role;
revoke create on schema search from influx_agent_search_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_agent_search_definer', current_user);
end
$$;

-- 7. The guards of the migration (03 P7; fiche invariants 2, 3, 8) ----------------------------------

do $$
declare
  c_owner  constant text := 'influx_agent_search_definer';
  c_doors  constant regprocedure[] := array[
    'search.open_team_selection_request(uuid)'::regprocedure,
    'search.release_team_selection_request(uuid)'::regprocedure,
    'search.extend_team_selection_claim(uuid)'::regprocedure,
    'search.close_team_selection_request(uuid, text, text)'::regprocedure];
  c_helper constant regprocedure :=
    'search.lock_held_team_selection_request(uuid, uuid)'::regprocedure;
  v_bad    text;
begin
  -- the owner keeps no CREATE nor member
  if pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE')
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid = c_owner::regrole and (m.inherit_option or m.set_option)) then
    raise exception '% must stay without member nor CREATE (03 P7)', c_owner;
  end if;

  -- owner, mode, empty search_path, no dynamic SQL
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid = any (c_doors || c_helper)
     and (p.proowner <> c_owner::regrole
          or p.prosecdef is distinct from (p.oid <> c_helper)
          or p.proconfig is distinct from array['search_path=""']
          or p.prosrc ~* '\mexecute\M|query_to_xml|dblink');
  if v_bad is not null then
    raise exception 'queue 9 functions must be owned by %, empty search_path, static: %', c_owner, v_bad;
  end if;

  -- TM12.5: the doors to influx_agent and influx_admin alone, the helper to nobody
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = any (c_doors || c_helper)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (p.oid = any (c_doors)
              and a.grantee in ('influx_agent'::regrole, 'influx_admin'::regrole));
  if v_bad is not null then
    raise exception 'queue 9 executable beyond agent and admin: %', v_bad;
  end if;

  -- D45, RG8: the doors name neither the outbox, matching nor a creator table
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid = any (c_doors || c_helper)
     and p.prosrc ~* 'leads\s*\.|matching\s*\.|profiles\s*\.\s*creator_';
  if v_bad is not null then
    raise exception 'queue 9 reaches the outbox, matching or a creator: %', v_bad;
  end if;

  -- no member right on the requests (0325), still
  if exists (select 1 from unnest(array['influx_advertiser', 'influx_creator']) r
              where pg_catalog.has_any_column_privilege(r, 'search.selection_requests',
                                                        'SELECT, INSERT, UPDATE, REFERENCES')
                 or pg_catalog.has_table_privilege(r, 'search.selection_requests',
                                                   'DELETE, TRUNCATE, TRIGGER')) then
    raise exception 'search.selection_requests: no member right (0325)';
  end if;

  if not exists (select 1 from backoffice.alert_definitions
                  where code = 'AL23' and recipient_roles = '{agent,admin}'::text[]) then
    raise exception 'AL23 must be loaded for agent and admin';
  end if;
  if not exists (select 1 from audit.event_types
                  where code = 'search.selection_request_closed' and export_class = 'exported') then
    raise exception 'the code search.selection_request_closed is not loaded with its export_class';
  end if;
end
$$;
