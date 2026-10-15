-- =============================================================================
-- 0132_identity_leads_account_actions
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 3. The actions of the backoffice v0 on an account and on the queue,
-- each one a SECURITY DEFINER function with a typed reason (closed list), journaled
-- nominatively in the transaction of the fact:
--
--   identity.correct_member_account()  05 RG108, 15 RG44: an agent or an admin corrects
--         the declared status, the country and the language of a MEMBER account, never his
--         own (03 C(3)); register line per field (old and new value), ONE lead.updated per
--         call to Brevo and Apollo (RG73). business -> individual: the lead.updated to
--         apollo_contact is what lets the worker take the contact out of the Apollo scope
--         (RG81, out_of_apollo_scope_individual; no sequence is ever enrolled, J6).
--         identity.set_declared_status() keeps its 0104 contract but refuses a reason outside
--         the closed list to an internal caller.
--   identity.change_member_role()      05 RG108 "un administrateur peut en outre changer le
--         rôle", 03 §3.1 "attribuer ou retirer un rôle" admin · J · 2V · R · C(3): creator ->
--         advertiser only (EC-J8-17), under a dual control identity.change_member_role
--         executed by its confirmer with a fresh second factor; the open sessions of the
--         account are revoked (03 A-9, role_changed).
--   identity.correct_email()           REWRITTEN with R in the database (constat cyber of
--         commit 2; 05 RG62 asks a re-authentication, not a dual control: EC-J8-18) and a
--         closed list of reasons naming the out-of-band identity check (05 Q8, 15 RG102).
--   leads.replay_outbox_lines()        05 RG101 to RG103, CA60, CA61, 15 RG30: unit or batch
--         replay (1 to 200 lines) of FAILED contact lines, the SAME line put back in the queue
--         (same idempotency key, no new event), one winner under concurrency (row lock), a
--         line skipped for lack of consent always refused (EC-J8-4), no nominative lock; the
--         replay is journaled as an object (leads.replay_requested).
--   backoffice.read_subject_history()  EC-31, 03 C(38): the history of ONE object (subject
--         type + id), for agent (his operating perimeter) and admin, the consultation itself
--         journaled (history.<subject>_read).
--
-- EC-J8 (micro-gaps, the safest choice; detail where they apply):
--   EC-J8-17  member role change: creator -> advertiser only. advertiser -> creator is refused
--             in base: the adult attestation (D15, RG19) cannot be given by a third party, and
--             05 Q9 (Lot 2) recommends a second account. The company name is typed by the
--             admin (03 C(7) allows an internal role to write a brand profile); the declared
--             status becomes business (RG22);
--   EC-J8-18  correct_email(): R only (RG62), no 2V; the reason names the out-of-band check
--             (identity_checked_by_phone | identity_checked_by_video) while Q8 stays open;
--   EC-J8-19  batch replay WITHOUT 2V: 03 §3.5 writes "rejouer un lot ✔ · J · 2V" but 05 RG101,
--             15 RG29/RG30 and 17b §3.11 give it to the agent, and the 2V of 0130 is admin-only:
--             applying it would take the right away from the agent. The replay is idempotent and
--             the consent is re-read at consumption. To arbitrate at the grouped cyber review;
--   EC-J8-20  replay of contact lines only (brevo_contact, apollo_contact): a failed
--             transactional e-mail belongs to the queue email_send_failures (16 §K, Lot 5);
--   EC-J8-21  the history read gives an agent the member accounts, the member invitations and
--             the data subject requests (his perimeter, C(38)); the admin everything listed;
--             previous_email is stripped from the payloads an agent reads;
--   EC-J8-22  the member is not notified of a correction yet (15 RG44): no template before the
--             e-mails of commit 6 / Lot 5.
--
-- ROLLBACK (before any real use): recreate identity.correct_email(uuid, text, text, text) as in
-- 0104 §4 (and its grant), drop the new signature; restore the 0104 body of
-- identity.set_declared_status() and the 0111 body of leads.guard_outbox_event_update(); restore
-- the 0131 body of backoffice.canonical_dual_control_payload() and the constraint
-- dual_control_action_code_closed of 0131; drop the four new functions; revoke the grants of
-- section 8; delete the codes of section 1 (possible only while no line references them).
-- =============================================================================

-- 1. The register codes ---------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 05 RG108, 15 RG44: a correction of the country or the language, old and new value
  ('account.corrected',                    'identity',   'account',              'sensitive'),
  -- 05 RG102: a replay, journaled as an object (who, when, which lines, how many)
  ('leads.replay_requested',               'leads',      'outbox_replay',        'sensitive'),
  -- EC-31, 03 C(38): the consultation of the history of one object (a privileged read)
  ('history.account_read',                 'backoffice', 'account',              'sensitive'),
  ('history.member_invitation_read',       'backoffice', 'member_invitation',    'sensitive'),
  ('history.internal_invitation_read',     'backoffice', 'internal_invitation',  'sensitive'),
  ('history.dual_control_request_read',    'backoffice', 'dual_control_request', 'sensitive'),
  ('history.data_subject_request_read',    'backoffice', 'data_subject_request', 'sensitive')
on conflict (code) do nothing;

-- 2. The 2V action identity.change_member_role (closed list extended) ----------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity, backoffice to influx_identity_definer;

set role influx_identity_definer;

create or replace function backoffice.canonical_dual_control_payload(
  p_action_code  text,
  p_payload      jsonb,
  p_caller       uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  c_uuid      constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_target    uuid;
  v_role      identity.account_role;
  v_invite    uuid;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_action_code in ('identity.grant_role', 'identity.change_member_role') then
    -- exactly {"account_id": uuid, "role": account_role}, never the caller (C(3)), an active
    -- target (R5)
    if (p_payload - 'account_id' - 'role') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'account_id') is distinct from 'string'
       or pg_catalog.jsonb_typeof(p_payload -> 'role') is distinct from 'string'
       or (p_payload ->> 'account_id') !~* c_uuid
       or not ((p_payload ->> 'role')
                 = any (pg_catalog.enum_range(null::identity.account_role)::text[])) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_target := (p_payload ->> 'account_id')::uuid;
    v_role   := (p_payload ->> 'role')::identity.account_role;
    if v_target = p_caller
       or not exists (select 1 from identity.accounts a
                       where a.id = v_target and a.status = 'active') then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    -- EC-J8-17: a member role change is creator -> advertiser, on a creator account
    if p_action_code = 'identity.change_member_role'
       and (v_role <> 'advertiser'
            or not exists (select 1 from identity.account_roles r
                            where r.account_id = v_target and r.role = 'creator')) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('account_id', v_target, 'role', v_role);
  end if;

  if p_action_code = 'identity.invite_admin' then
    -- EC-J8-12 (0131): exactly {"invitation_id": uuid}, a live admin invitation, not yet confirmed
    if (p_payload - 'invitation_id') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'invitation_id') is distinct from 'string'
       or (p_payload ->> 'invitation_id') !~* c_uuid then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_invite := (p_payload ->> 'invitation_id')::uuid;
    if not exists (select 1 from identity.internal_invitations i
                    where i.id = v_invite
                      and i.proposed_role = 'admin'
                      and i.confirmed_at is null
                      and i.accepted_at is null
                      and i.revoked_at is null
                      and i.expires_at > pg_catalog.now()) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('invitation_id', v_invite);
  end if;

  raise exception 'forbidden' using errcode = 'insufficient_privilege';
end
$$;

comment on function backoffice.canonical_dual_control_payload(text, jsonb, uuid) is
  'The closed list of 2V actions and the exact shape of each payload (03 PD4; identifiers only, C(33) '
  'spirit): identity.grant_role and identity.change_member_role {"account_id", "role"} (never the '
  'caller, an active target; change_member_role: role advertiser on a creator account, EC-J8-17, '
  '0132); identity.invite_admin {"invitation_id"} (a live invitation proposing admin, not yet '
  'confirmed, EC-J8-12, 0131). Returns the canonical payload, compared whole by the action function; '
  '42501 forbidden otherwise. SECURITY INVOKER owned by influx_identity_definer, NO grant.';

-- 3. identity.set_declared_status(): the closed list of reasons for an internal caller ----------------

create or replace function identity.set_declared_status(
  p_account_id  uuid,
  p_status      identity.declared_status,
  p_reason_code text,
  p_comment     text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := influx.current_account_id();
  v_role     identity.account_role := influx.current_account_role();
  v_target   identity.account_role;
  v_previous identity.declared_status;
  v_event    uuid := pg_catalog.gen_random_uuid();
  v_payload  jsonb;
begin
  if v_caller is null or v_role is null then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_role in ('agent', 'admin') then
    if not influx.has_aal2()
       or not exists (
            select 1
              from identity.accounts a
              join identity.account_roles r  on r.account_id = a.id and r.role = v_role
              join identity.agent_profiles p on p.account_id = a.id and p.is_active
             where a.id = v_caller and a.status = 'active')
       or p_account_id is not distinct from v_caller then              -- C(3)
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    -- 05 RG108, 0132: an internal correction carries a reason of the closed list
    if p_reason_code is null
       or p_reason_code not in ('member_request', 'signup_error', 'document_check', 'data_quality') then
      raise exception 'a reason of the closed list is required' using errcode = 'invalid_parameter_value';
    end if;
  elsif v_role = 'creator' then
    if p_account_id is distinct from v_caller then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
  else
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_status is null then
    raise exception 'a declared status is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,62}$' then
    raise exception 'a typed reason code is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_comment is not null and (pg_catalog.length(p_comment) > 500 or p_comment ~ '[[:cntrl:]]') then
    raise exception 'comment too long or not printable' using errcode = 'invalid_parameter_value';
  end if;

  -- The target: an active MEMBER account. Same error as an unknown target (03 T14).
  select a.declared_status, r.role
    into v_previous, v_target
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id
   where a.id = p_account_id
     and a.status = 'active'
     and r.role in ('advertiser', 'creator')
     for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_target = 'advertiser' and p_status <> 'business' then
    raise exception 'an advertiser account is business by construction (RG22)'
      using errcode = 'check_violation';
  end if;
  if p_status = v_previous then
    return false;
  end if;

  update identity.accounts set declared_status = p_status where id = p_account_id;

  -- A change of declared status is a change of prospection scope (04 §5.1): both
  -- destinations are updated, in the same transaction as the fact.
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_event, 'lead.updated', d.destination, 'account:' || p_account_id::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id),
         'lead.updated:' || v_event::text
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  v_payload := pg_catalog.jsonb_build_object('from', v_previous, 'to', p_status,
                                             'reason_code', p_reason_code);
  if p_comment is not null then
    v_payload := v_payload || pg_catalog.jsonb_build_object('comment', p_comment);
  end if;
  -- last: the chain lock is held until COMMIT (04 §7.2)
  perform audit.append('account.declared_status_changed', 'account', p_account_id, v_payload);
  return true;
end
$$;

comment on function identity.set_declared_status(uuid, identity.declared_status, text, text) is
  'The only door to identity.accounts.declared_status after sign-up (04 §5.1). Callers: a creator '
  'for his own account; an active agent or administrator in aal2 for a member account other than his '
  'own (05 RG108, 03 C(3)), with a reason of the closed list member_request | signup_error | '
  'document_check | data_quality (0132; 22023 otherwise). Refuses individual for an advertiser '
  '(RG22). In the same transaction: the column, lead.updated queued to Brevo and Apollo, and the '
  'chained register line account.declared_status_changed {from, to, reason_code[, comment]}. Returns '
  'false (nothing written) when the status does not change. SECURITY DEFINER owned by '
  'influx_identity_definer.';

reset role;

revoke create on schema identity, backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

alter table backoffice.dual_control_requests drop constraint if exists dual_control_action_code_closed;
alter table backoffice.dual_control_requests add constraint dual_control_action_code_closed
  check (action_code in ('identity.grant_role', 'identity.invite_admin', 'identity.change_member_role'));

comment on column backoffice.dual_control_requests.action_code is
  'Closed list (CHECK): identity.grant_role (0130), identity.invite_admin (0131), '
  'identity.change_member_role (0132). An action enters it with its consuming function.';

-- 4. The queue: a failed line goes back to pending only as a replay ---------------------------------------

create or replace function leads.guard_outbox_event_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id               is distinct from old.id
     or new.event_id        is distinct from old.event_id
     or new.event_type      is distinct from old.event_type
     or new.destination     is distinct from old.destination
     or new.subject_key     is distinct from old.subject_key
     or new.payload         is distinct from old.payload
     or new.idempotency_key is distinct from old.idempotency_key
     or new.created_at      is distinct from old.created_at then
    raise exception 'the description of a queue line is immutable' using errcode = 'insufficient_privilege';
  end if;
  -- 0132, 05 RG102: a failed line leaves failed only as a replay: back to pending, a new series of
  -- attempts, unlocked, not completed
  if old.status = 'failed' and new.status is distinct from 'failed'
     and (new.status is distinct from 'pending' or new.attempts <> 0 or new.locked_by is not null
          or new.completed_at is not null) then
    raise exception 'a failed queue line only goes back to pending, by a replay'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function leads.guard_outbox_event_update() is
  'BEFORE UPDATE on leads.outbox_events: the fact, its destination, its ordering key, its payload '
  'and its idempotency key never change; only the processing columns move (status, attempts, '
  'available_at, errors, provider ids, lock). A failed line leaves failed only as a replay (0132): '
  'pending, attempts 0, unlocked, not completed. SECURITY INVOKER, reads nothing.';

-- 5. identity.correct_member_account() (agent, admin) ------------------------------------------------------

create or replace function identity.correct_member_account(
  p_account_id          uuid,
  p_reason_code         text,
  p_declared_status     identity.declared_status default null,
  p_country_code        text default null,
  p_preferred_language  text default null,
  p_comment             text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid := influx.current_account_id();
  v_role       identity.account_role := influx.current_account_role();
  v_country    char(2);
  v_language   char(2);
  v_extra      jsonb := '{}'::jsonb;
  v_changed    boolean := false;
  v_status_set boolean := false;
  v_event      uuid := pg_catalog.gen_random_uuid();
begin
  -- 05 RG108: an active agent or admin in aal2, never on his own account (C(3))
  if v_caller is null or v_role is null or v_role not in ('agent', 'admin')
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active')
     or p_account_id is not distinct from v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_reason_code is null
     or p_reason_code not in ('member_request', 'signup_error', 'document_check', 'data_quality') then
    raise exception 'a reason of the closed list is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_comment is not null and (pg_catalog.length(p_comment) > 500 or p_comment ~ '[[:cntrl:]]') then
    raise exception 'comment too long or not printable' using errcode = 'invalid_parameter_value';
  end if;
  if p_declared_status is null and p_country_code is null and p_preferred_language is null then
    raise exception 'nothing to correct' using errcode = 'invalid_parameter_value';
  end if;
  if p_comment is not null then
    v_extra := pg_catalog.jsonb_build_object('comment', p_comment);
  end if;

  -- The target: an active MEMBER account, locked. Same error as an unknown target (03 T14).
  select a.country_code, a.preferred_language
    into v_country, v_language
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id and r.role in ('advertiser', 'creator')
   where a.id = p_account_id and a.status = 'active'
     for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_country_code is not null and p_country_code is distinct from v_country then
    if p_country_code !~ '^[A-Z]{2}$' then
      raise exception 'the country is an ISO 3166-1 alpha-2 code' using errcode = 'invalid_parameter_value';
    end if;
    -- RG8: a blocked country is not reached by a correction either (23503 if unknown)
    if exists (select 1 from leads.sync_settings s
                where s.key = 'signup_blocked_countries' and s.value ? p_country_code) then
      raise exception 'country not available' using errcode = 'check_violation';
    end if;
    update identity.accounts set country_code = p_country_code where id = p_account_id;
    perform audit.append('account.corrected', 'account', p_account_id,
                         pg_catalog.jsonb_build_object('field', 'country_code', 'from', v_country,
                                                       'to', p_country_code,
                                                       'reason_code', p_reason_code) || v_extra);
    v_changed := true;
  end if;

  if p_preferred_language is not null and p_preferred_language is distinct from v_language then
    -- the composite key of 0004 refuses a language the product is not translated into (23503)
    update identity.accounts set preferred_language = p_preferred_language where id = p_account_id;
    perform audit.append('account.corrected', 'account', p_account_id,
                         pg_catalog.jsonb_build_object('field', 'preferred_language', 'from', v_language,
                                                       'to', p_preferred_language,
                                                       'reason_code', p_reason_code) || v_extra);
    v_changed := true;
  end if;

  if p_declared_status is not null then
    -- its own lead.updated (Brevo AND Apollo: the Apollo scope follows, RG81) and register line
    v_status_set := identity.set_declared_status(p_account_id, p_declared_status, p_reason_code,
                                                 p_comment);
  end if;

  -- RG73: ONE lead.updated per call, in the transaction of the fact
  if v_changed and not v_status_set then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select v_event, 'lead.updated', d.destination, 'account:' || p_account_id::text, 100,
           pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id),
           'lead.updated:' || v_event::text
      from (values ('brevo_contact'::leads.outbox_destination),
                   ('apollo_contact'::leads.outbox_destination)) d (destination);
  end if;
  return v_changed or v_status_set;
end
$$;

comment on function identity.correct_member_account(uuid, text, identity.declared_status, text, text, text) is
  '05 RG108, 15 RG44: an active agent or admin in aal2 corrects the declared status, the country and '
  'the language of a MEMBER account other than his own (C(3)); NULL = unchanged, all NULL = 22023. '
  'Reason (closed list): member_request | signup_error | document_check | data_quality; optional '
  'comment (500, printable). One register line per field: account.corrected {field, from, to, '
  'reason_code[, comment]} for the country and the language, account.declared_status_changed through '
  'identity.set_declared_status() for the status. ONE lead.updated per call to brevo_contact and '
  'apollo_contact (business -> individual: the worker takes the contact out of the Apollo scope). '
  'Returns false when nothing changes. 22023 malformed, 23514 blocked country or individual for an '
  'advertiser, 23503 unknown country or untranslated language, 42501 caller or target refused. '
  'SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_agent, influx_admin.';

-- 6. identity.change_member_role() (admin, 2V + R) -----------------------------------------------------------

create or replace function identity.change_member_role(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_account_id               uuid,
  p_role                     identity.account_role,
  p_reason_code              text,
  p_legal_name               text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller      uuid;
  v_mode        text;
  v_status_set  boolean;
  v_event       uuid := pg_catalog.gen_random_uuid();
begin
  v_caller := identity.require_active_admin();

  -- C(3), EC-J8-17: never one's own account; creator -> advertiser only, on an active creator
  if p_account_id is null or p_account_id = v_caller
     or p_role is distinct from 'advertiser'
     or p_reason_code is null or p_reason_code not in ('member_request', 'signup_error')
     or p_legal_name is null or pg_catalog.char_length(pg_catalog.btrim(p_legal_name)) < 2
     or pg_catalog.char_length(p_legal_name) > 120 or p_legal_name ~ '[[:cntrl:]]' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform 1
     from identity.accounts a
     join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
    where a.id = p_account_id and a.status = 'active'
      for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- R in THIS transaction, then the 2V consumed once, by its confirmer
  perform identity.assert_fresh_second_factor(p_session_id);
  v_mode := backoffice.consume_dual_control(
              p_dual_control_request_id,
              'identity.change_member_role',
              pg_catalog.jsonb_build_object('account_id', p_account_id, 'role', p_role),
              p_reason_code);

  -- D41: the single role replaced (a revoked role is deleted, 0004), the brand profile created
  delete from identity.account_roles where account_id = p_account_id and role = 'creator';
  insert into identity.account_roles (account_id, role, granted_by_account_id)
  values (p_account_id, 'advertiser', v_caller);
  insert into profiles.advertiser_profiles (account_id, legal_name) values (p_account_id, p_legal_name);

  -- 03 A-9: a role change revokes every open session of the account
  update identity.sessions
     set revoked_at = pg_catalog.now(), revocation_reason = 'role_changed'
   where account_id = p_account_id and revoked_at is null;

  -- RG22: an advertiser is business; its own lead.updated when the status changes
  v_status_set := identity.set_declared_status(p_account_id, 'business', p_reason_code);
  if not v_status_set then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select v_event, 'lead.updated', d.destination, 'account:' || p_account_id::text, 100,
           pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id),
           'lead.updated:' || v_event::text
      from (values ('brevo_contact'::leads.outbox_destination),
                   ('apollo_contact'::leads.outbox_destination)) d (destination);
  end if;

  -- last: the chain lock is held until COMMIT. PD5: the mode of the control.
  perform audit.append('account.role_revoked', 'account', p_account_id,
                       pg_catalog.jsonb_build_object('role', 'creator',
                                                     'reason_code', p_reason_code,
                                                     'dual_control_request_id', p_dual_control_request_id,
                                                     'dual_control', v_mode));
  perform audit.append('account.role_granted', 'account', p_account_id,
                       pg_catalog.jsonb_build_object('role', 'advertiser',
                                                     'reason_code', p_reason_code,
                                                     'dual_control_request_id', p_dual_control_request_id,
                                                     'dual_control', v_mode));
end
$$;

comment on function identity.change_member_role(uuid, uuid, uuid, identity.account_role, text, text) is
  '05 RG108, 03 §3.1 (J · 2V · R · C(3)): an active admin in aal2 changes the role of a member account '
  'other than his own, creator -> advertiser ONLY (EC-J8-17: advertiser -> creator refused, D15 and '
  '05 Q9). R on p_session_id in this transaction; consumes the dual control request '
  'identity.change_member_role {account_id, role: advertiser} with this reason (member_request | '
  'signup_error), by its confirmer. Replaces the role (granted by the caller), creates the advertiser '
  'profile with p_legal_name (2 to 120 characters), revokes the open sessions (role_changed), sets the '
  'declared status to business (RG22) and queues ONE lead.updated to Brevo and Apollo; writes '
  'account.role_revoked and account.role_granted {role, reason_code, dual_control_request_id, '
  'dual_control}. Any refusal: 42501 forbidden. SECURITY DEFINER owned by influx_identity_definer; '
  'EXECUTE for influx_admin ONLY.';

-- 7. identity.correct_email(), rewritten with R (constat cyber of commit 2) -----------------------------------

drop function if exists identity.correct_email(uuid, text, text, text);

create or replace function identity.correct_email(
  p_session_id  uuid,
  p_account_id  uuid,
  p_new_email   text,
  p_reason_code text,
  p_comment     text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid;
  v_new      text := pg_catalog.lower(pg_catalog.btrim(p_new_email));
  v_previous text;
  v_event    uuid := pg_catalog.gen_random_uuid();
  v_seq      bigint;
  v_payload  jsonb;
begin
  -- the caller: active admin, active profile, aal2; never his own account (C(3))
  v_caller := identity.require_active_admin();
  if p_account_id is null or p_account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- 05 RG62: a re-authentication, in THIS transaction (EC-J8-18: R, not 2V)
  perform identity.assert_fresh_second_factor(p_session_id);

  -- 05 Q8 open: the reason names the out-of-band identity check (15 RG102 spirit)
  if p_reason_code is null
     or p_reason_code not in ('identity_checked_by_phone', 'identity_checked_by_video') then
    raise exception 'a reason of the closed list is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_comment is not null and (pg_catalog.length(p_comment) > 500 or p_comment ~ '[[:cntrl:]]') then
    raise exception 'comment too long or not printable' using errcode = 'invalid_parameter_value';
  end if;
  if v_new is null or v_new = '' then
    raise exception 'the new address is required' using errcode = 'invalid_parameter_value';
  end if;

  -- The target: an active member account. Same error as an unknown target (03 T14).
  select a.email
    into v_previous
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id
   where a.id = p_account_id
     and a.status = 'active'
     and r.role in ('advertiser', 'creator')
     for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_new = v_previous then
    raise exception 'the new address equals the current one' using errcode = 'invalid_parameter_value';
  end if;

  -- RG62 held in base: the next successful sign-in is the new proof of address. An address
  -- already used by another account fails on accounts_email_key (23505).
  update identity.accounts
     set email                  = v_new,
         email_status           = 'unknown',
         email_undeliverable_at = null,
         email_verified_at      = null
   where id = p_account_id;

  v_payload := pg_catalog.jsonb_build_object('previous_email', v_previous, 'reason_code', p_reason_code);
  if p_comment is not null then
    v_payload := v_payload || pg_catalog.jsonb_build_object('comment', p_comment);
  end if;
  v_seq := audit.append('account.email_corrected', 'account', p_account_id, v_payload);

  -- The notice to BOTH addresses (04 §5.1), urgent, through the queue; the payload holds
  -- identifiers only (RG74): the previous address is read back by the consumer from the
  -- register line (audit_seq). The contacts at Brevo and Apollo follow (lead.updated).
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_event, n.event_type, n.destination, 'account:' || p_account_id::text, n.priority,
         pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id) || n.extra,
         n.event_type || ':' || v_event::text || n.suffix
    from (values
      ('account.email_corrected', 'brevo_transactional'::leads.outbox_destination, 0::smallint,
       pg_catalog.jsonb_build_object('email_code', 'account.email_corrected', 'recipient', 'previous',
                                     'audit_seq', v_seq), ':previous'),
      ('account.email_corrected', 'brevo_transactional'::leads.outbox_destination, 0::smallint,
       pg_catalog.jsonb_build_object('email_code', 'account.email_corrected', 'recipient', 'current',
                                     'audit_seq', v_seq), ':current'),
      ('lead.updated', 'brevo_contact'::leads.outbox_destination, 100::smallint, '{}'::jsonb, ''),
      ('lead.updated', 'apollo_contact'::leads.outbox_destination, 100::smallint, '{}'::jsonb, '')
    ) n (event_type, destination, priority, extra, suffix);
end
$$;

comment on function identity.correct_email(uuid, uuid, text, text, text) is
  'Correction of the address of a MEMBER account by an administrator (04 §5.1, RG62): a take-over '
  'primitive since D37. Caller: active admin, active profile, aal2, never on his own account (C(3)); '
  'R on p_session_id (TOTP within 300 s) in this transaction (0132, EC-J8-18). Reason (closed list, '
  'Q8 open): identity_checked_by_phone | identity_checked_by_video. In the same transaction: the '
  'address (normalised; 23505 if used by another account), email_status reset to unknown and '
  'email_verified_at cleared, the critical register line account.email_corrected keeping the PREVIOUS '
  'address, two urgent notices (brevo_transactional, previous and current address) and lead.updated '
  'to Brevo and Apollo. The GoTrue user is updated by apps/api. 42501 forbidden for the caller, R or '
  'the target; 22023 malformed. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for '
  'influx_admin only.';

-- 8. leads.replay_outbox_lines() (agent, admin; owner influx_leads_definer) ---------------------------------

create or replace function leads.replay_outbox_lines(
  p_outbox_ids   bigint[],
  p_reason_code  text
)
returns table (replay_id uuid, outbox_id bigint, outcome text, detail text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := influx.current_account_id();
  v_role      identity.account_role := influx.current_account_role();
  v_ids       bigint[];
  v_replay    uuid := pg_catalog.gen_random_uuid();
  v_line      record;
  v_outcome   text;
  v_detail    text;
  v_requeued  bigint[] := '{}';
  v_ignored   jsonb := '{}'::jsonb;
  v_refused   jsonb := '{}'::jsonb;
  v_result    jsonb := '[]'::jsonb;
begin
  -- 05 RG101, 03 §3.5: an active agent or admin in aal2 (EC-J8-19: no 2V; 15 RG30: no lock)
  if v_caller is null or v_role is null or v_role not in ('agent', 'admin')
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_reason_code is null
     or p_reason_code not in ('provider_recovered', 'configuration_fixed', 'data_corrected',
                              'quota_restored', 'transient_failure') then
    raise exception 'a reason of the closed list is required' using errcode = 'invalid_parameter_value';
  end if;
  -- RG101: 1 to 200 distinct lines per operation
  select pg_catalog.array_agg(distinct i order by i) into v_ids
    from pg_catalog.unnest(p_outbox_ids) i;
  if p_outbox_ids is null or array_position(p_outbox_ids, null) is not null
     or v_ids is null or pg_catalog.cardinality(v_ids) not between 1 and 200 then
    raise exception 'between 1 and 200 distinct lines per replay' using errcode = 'invalid_parameter_value';
  end if;

  -- CA61: the lines are locked in id order (no deadlock between two replays); a concurrent replay
  -- waits here, then finds the line pending and ignores it: one winner
  perform 1 from leads.outbox_events o where o.id = any (v_ids) order by o.id for update;

  for v_line in
    select k.id as requested_id, o.id, o.destination, o.status, o.skip_reason
      from pg_catalog.unnest(v_ids) k (id)
      left join leads.outbox_events o on o.id = k.id
     order by k.id
  loop
    v_detail := null;
    if v_line.id is null then
      v_outcome := 'refused';  v_detail := 'unknown_line';
    elsif v_line.destination not in ('brevo_contact', 'apollo_contact') then
      -- EC-J8-20: a transactional e-mail is replayed from its own queue (16 §K, Lot 5)
      v_outcome := 'refused';  v_detail := 'not_a_contact_line';
    elsif v_line.status = 'skipped' and v_line.skip_reason = 'no_consent' then
      -- RG103, CA60, EC-J8-4: never replayable; a new consent.granted produces the synchronisation
      v_outcome := 'refused';  v_detail := 'no_consent';
    elsif v_line.status = 'skipped' then
      -- RG100: a normal case is not a failure
      v_outcome := 'refused';  v_detail := 'normal_case';
    elsif v_line.status = 'succeeded' then
      v_outcome := 'ignored';  v_detail := 'already_succeeded';
    elsif v_line.status in ('pending', 'processing') then
      v_outcome := 'ignored';  v_detail := 'already_queued';
    else
      -- RG102: the SAME line, same idempotency key, a new series of attempts (RG79)
      update leads.outbox_events o
         set status       = 'pending',
             attempts     = 0,
             available_at = pg_catalog.now(),
             completed_at = null
       where o.id = v_line.id and o.status = 'failed';
      v_outcome  := 'requeued';
      v_requeued := v_requeued || v_line.id;
    end if;

    if v_outcome = 'ignored' then
      v_ignored := v_ignored || pg_catalog.jsonb_build_object(
                     v_detail, coalesce((v_ignored ->> v_detail)::integer, 0) + 1);
    elsif v_outcome = 'refused' then
      v_refused := v_refused || pg_catalog.jsonb_build_object(
                     v_detail, coalesce((v_refused ->> v_detail)::integer, 0) + 1);
    end if;
    v_result := v_result || pg_catalog.jsonb_build_array(
                  pg_catalog.jsonb_build_object('id', v_line.requested_id, 'outcome', v_outcome,
                                                'detail', v_detail));
  end loop;

  -- RG102, backoffice-ops rule 11: the operation journaled as an object (who, when, which lines,
  -- how many); last, the chain lock is held until COMMIT
  perform audit.append('leads.replay_requested', 'outbox_replay', v_replay,
                       pg_catalog.jsonb_build_object(
                         'reason_code', p_reason_code,
                         'requested', pg_catalog.cardinality(v_ids),
                         'requeued', pg_catalog.cardinality(v_requeued),
                         'requeued_ids', pg_catalog.to_jsonb(v_requeued),
                         'ignored', v_ignored,
                         'refused', v_refused));

  return query
  select v_replay, (r ->> 'id')::bigint, r ->> 'outcome', r ->> 'detail'
    from pg_catalog.jsonb_array_elements(v_result) r;
end
$$;

comment on function leads.replay_outbox_lines(bigint[], text) is
  '05 RG101 to RG103, CA60, CA61; 15 RG30: an active agent or admin in aal2 replays 1 to 200 distinct '
  'queue lines (22023 otherwise) with a reason (closed list): provider_recovered | configuration_fixed '
  '| data_corrected | quota_restored | transient_failure. A FAILED contact line (brevo_contact, '
  'apollo_contact) goes back to pending, attempts 0, available now: the SAME line and idempotency key, '
  'no new event, no duplicate at the provider. Outcome per line: requeued; ignored (already_queued, '
  'already_succeeded); refused (unknown_line, not_a_contact_line EC-J8-20, no_consent EC-J8-4, '
  'normal_case). Lines locked in id order: of two concurrent replays, one requeues, the other ignores. '
  'No 2V (EC-J8-19), no nominative lock. One register line leads.replay_requested {reason_code, '
  'requested, requeued, requeued_ids, ignored, refused} on the replay id, returned with every row. '
  'SECURITY DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for influx_agent, '
  'influx_admin.';

-- 9. backoffice.read_subject_history() (EC-31; agent, admin) ------------------------------------------------

create or replace function backoffice.read_subject_history(
  p_subject_type  text,
  p_subject_id    uuid,
  p_limit         integer default 50,
  p_before_seq    bigint  default null
)
returns table (
  seq               bigint,
  occurred_at       timestamptz,
  event_type        text,
  actor_type        text,
  actor_account_id  uuid,
  payload           jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := influx.current_account_id();
  v_role    identity.account_role := influx.current_account_role();
begin
  if v_caller is null or v_role is null or v_role not in ('agent', 'admin')
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_subject_type is null
     or p_subject_type not in ('account', 'member_invitation', 'internal_invitation',
                               'dual_control_request', 'data_subject_request')
     or p_subject_id is null
     or p_limit is null or p_limit not between 1 and 200
     or p_before_seq < 1 then
    raise exception 'unknown subject type, or limit outside 1 to 200' using errcode = 'invalid_parameter_value';
  end if;

  -- EC-J8-21, 03 C(38): the operating perimeter of an agent - the member accounts, the member
  -- invitations, the data subject requests he instructs. Same refusal for an unknown subject.
  if v_role = 'agent'
     and not (p_subject_type in ('member_invitation', 'data_subject_request')
              or (p_subject_type = 'account'
                  and exists (select 1 from identity.account_roles r
                               where r.account_id = p_subject_id
                                 and r.role in ('advertiser', 'creator')))) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  return query
  select e.seq, e.occurred_at, e.event_type, e.actor_type::text, e.actor_account_id,
         case when v_role = 'agent' then e.payload - 'previous_email' else e.payload end
    from audit.audit_events e
   where e.subject_type = p_subject_type
     and e.subject_id = p_subject_id
     and (p_before_seq is null or e.seq < p_before_seq)
   order by e.occurred_at desc, e.seq desc
   limit p_limit;

  -- 03 C(38), P8: the consultation is itself journaled, last (chain lock until COMMIT)
  perform audit.append('history.' || p_subject_type || '_read', p_subject_type, p_subject_id,
                       pg_catalog.jsonb_build_object('limit', p_limit, 'before_seq', p_before_seq));
end
$$;

comment on function backoffice.read_subject_history(text, uuid, integer, bigint) is
  'EC-31, 03 C(38): the history of ONE object of the register, newest first, p_limit rows (1 to 200, '
  '50 by default), before p_before_seq for the next page. Subject types: account, member_invitation, '
  'internal_invitation, dual_control_request, data_subject_request (22023 otherwise). An active admin '
  'in aal2 reads them all; an active agent reads the member accounts, the member invitations and the '
  'data subject requests (EC-J8-21; 42501 otherwise), with previous_email stripped from the payloads. '
  'The register holds identifiers and codes only: never a sign-in code, a password, an e-mail content '
  'nor an Apollo datum (05 RG107). The consultation writes history.<subject_type>_read {limit, '
  'before_seq} on the object. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for '
  'influx_agent, influx_admin.';

-- 10. Publication -------------------------------------------------------------------------------------------

revoke all on function identity.correct_member_account(uuid, text, identity.declared_status, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function identity.change_member_role(uuid, uuid, uuid, identity.account_role, text, text)
  from public, anon, authenticated, service_role;
revoke all on function identity.correct_email(uuid, uuid, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function leads.replay_outbox_lines(bigint[], text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.read_subject_history(text, uuid, integer, bigint)
  from public, anon, authenticated, service_role;

grant execute on function identity.correct_member_account(uuid, text, identity.declared_status, text, text, text)
   to influx_agent, influx_admin;
grant execute on function identity.change_member_role(uuid, uuid, uuid, identity.account_role, text, text)
   to influx_admin;
grant execute on function identity.correct_email(uuid, uuid, text, text, text) to influx_admin;
grant execute on function leads.replay_outbox_lines(bigint[], text) to influx_agent, influx_admin;
grant execute on function backoffice.read_subject_history(text, uuid, integer, bigint)
   to influx_agent, influx_admin;

-- 11. Rights of the owners --------------------------------------------------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy.

-- 11.1 influx_identity_definer: the role change (delete the creator role only) and the history read

grant delete on identity.account_roles to influx_identity_definer;

drop policy if exists account_roles_identity_definer_delete on identity.account_roles;
create policy account_roles_identity_definer_delete on identity.account_roles
  for delete to influx_identity_definer
  using (role = 'creator');

grant select (seq, occurred_at, event_type, actor_type, actor_account_id, subject_type, subject_id,
              payload)
   on audit.audit_events to influx_identity_definer;

drop policy if exists audit_events_identity_definer_select on audit.audit_events;
create policy audit_events_identity_definer_select on audit.audit_events
  for select to influx_identity_definer
  using (true);

-- 11.2 influx_leads_definer: the replay

grant usage on schema influx to influx_leads_definer;
grant execute on function influx.current_account_id(),
                          influx.current_account_role(),
                          influx.current_aal(),
                          influx.has_aal2()
   to influx_leads_definer;

grant select (skip_reason) on leads.outbox_events to influx_leads_definer;

-- a failed contact line, and only it, goes back to pending (with the guard of section 4)
drop policy if exists outbox_events_leads_definer_replay on leads.outbox_events;
create policy outbox_events_leads_definer_replay on leads.outbox_events
  for update to influx_leads_definer
  using (status = 'failed' and destination in ('brevo_contact', 'apollo_contact'))
  with check (status = 'pending' and attempts = 0 and locked_by is null and completed_at is null);

-- the caller check: an active internal profile (0004 columns)
grant select (account_id, is_active) on identity.agent_profiles to influx_leads_definer;

drop policy if exists agent_profiles_leads_definer_select on identity.agent_profiles;
create policy agent_profiles_leads_definer_select on identity.agent_profiles
  for select to influx_leads_definer
  using (true);

-- the register line of the replay: EXECUTE on audit.append(), granted by its owner (0006 §9 window)
grant usage on schema audit to influx_leads_definer;

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_leads_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 12. Hand the functions to their owners (03 P7 rule 5, window of 0004 §9) ----------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema identity, backoffice to influx_identity_definer;
grant create on schema leads to influx_leads_definer;

alter function identity.correct_member_account(uuid, text, identity.declared_status, text, text, text)
  owner to influx_identity_definer;
alter function identity.change_member_role(uuid, uuid, uuid, identity.account_role, text, text)
  owner to influx_identity_definer;
alter function identity.correct_email(uuid, uuid, text, text, text) owner to influx_identity_definer;
alter function backoffice.read_subject_history(text, uuid, integer, bigint) owner to influx_identity_definer;
alter function leads.replay_outbox_lines(bigint[], text) owner to influx_leads_definer;

revoke create on schema identity, backoffice from influx_identity_definer;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 13. End-state assertions ------------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  if to_regprocedure('identity.correct_email(uuid, text, text, text)') is not null then
    raise exception 'the 0104 signature of identity.correct_email() is still there';
  end if;

  for v_def in
    select * from (values
      ('identity.correct_member_account(uuid, text, identity.declared_status, text, text, text)',
        'influx_identity_definer', array['influx_agent', 'influx_admin']),
      ('identity.change_member_role(uuid, uuid, uuid, identity.account_role, text, text)',
        'influx_identity_definer', array['influx_admin']),
      ('identity.correct_email(uuid, uuid, text, text, text)',
        'influx_identity_definer', array['influx_admin']),
      ('identity.set_declared_status(uuid, identity.declared_status, text, text)',
        'influx_identity_definer', array['influx_creator', 'influx_agent', 'influx_admin']),
      ('backoffice.read_subject_history(text, uuid, integer, bigint)',
        'influx_identity_definer', array['influx_agent', 'influx_admin']),
      ('leads.replay_outbox_lines(bigint[], text)',
        'influx_leads_definer', array['influx_agent', 'influx_admin'])
    ) as t (fn, owner, callers)
  loop
    v_fn := v_def.fn;
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> v_def.owner
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by %, empty search_path', v_fn, v_def.owner;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- the canonical payload helper stays SECURITY INVOKER, published to nobody
  if (select prosecdef from pg_catalog.pg_proc
       where oid = 'backoffice.canonical_dual_control_payload(text, jsonb, uuid)'::regprocedure) then
    raise exception 'backoffice.canonical_dual_control_payload() must stay SECURITY INVOKER';
  end if;

  -- nobody but the leads definer writes the processing state of the queue (0111 assertion kept)
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_leads_definer'
     and pg_catalog.has_any_column_privilege(r.oid, 'leads.outbox_events', 'UPDATE');
  if v_bad is not null then
    raise exception 'unexpected write right(s) on the queue state: %', v_bad;
  end if;
  -- the register: still no write right but the writer's insert (03 P8 layer 1)
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_table_privilege(r.oid, 'audit.audit_events', 'UPDATE, DELETE, TRUNCATE')
          or (r.rolname <> 'influx_audit_writer'
              and pg_catalog.has_table_privilege(r.oid, 'audit.audit_events', 'INSERT')));
  if v_bad is not null then
    raise exception 'unexpected write right(s) on the register: %', v_bad;
  end if;

  if (select count(*) from audit.event_types
       where code in ('account.corrected', 'leads.replay_requested', 'history.account_read',
                      'history.member_invitation_read', 'history.internal_invitation_read',
                      'history.dual_control_request_read', 'history.data_subject_request_read')) <> 7 then
    raise exception 'the seven codes of 0132 are not all in audit.event_types';
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_identity_definer', 'influx_leads_definer', 'influx_audit_writer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE') then
    raise exception 'a function owner kept CREATE on a schema';
  end if;
end
$$;
