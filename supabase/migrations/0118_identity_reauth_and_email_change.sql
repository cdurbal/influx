-- =============================================================================
-- 0118_identity_reauth_and_email_change
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 2. Decisions 4 and 5 of the J7 start (architect, 2026-10-09).
--
-- Decision 4 — the re-authentication of a member (05 RG57, RG41; 03 A-10):
--   identity.sessions.reauthenticated_at + reauth_purpose   the PROOF: a marker tied to
--         one purpose (email_change, data_export, account_deletion), member sessions
--         only, written now() in base by influx_auth alone (E-2
--         identity.member_reauthenticate), valid 300 seconds, single use: the
--         sensitive action checks it and clears it in its own transaction.
--   identity.mark_member_reauthenticated()      E-2, influx_auth: sets the marker.
--   identity.consume_member_reauthentication()  the check-and-clear, shared by the
--         sensitive actions of the identity owner (no grant: owner only). 300 s is
--         written HERE ONLY on the database side (REAUTHENTICATION_FRESHNESS_SECONDS
--         of apps/api, provisional, "5 min" open with expert-cybersecurite).
--
-- Decision 5 — the change of address (05 RG58, 03 A-11, RG74):
--   identity.email_change_requests   a request of 24 hours, confirmed by TWO six-digit
--         codes typed in the member space (old and new address; never a link), kept as
--         HMAC digests peppered by apps/api, 5 attempts per side, one open request per
--         account; the digests are cleared when the request closes.
--   identity.request_email_change()   member, needs the marker email_change.
--   identity.confirm_email_change()   member, one side and one code; says when both are
--         confirmed (ready) and gives the GoTrue user id to update.
--   identity.complete_email_change()  member, AFTER admin.updateUserById succeeded: the
--         address, its proof, the revocation of the OTHER sessions (email_changed),
--         email.changed to Brevo and Apollo (normal priority, RG73), the two notices
--         auth.email_changed_notice (priority 0, previous and current address; payload
--         = ids only, the request id among them, RG74) and the register line
--         email.changed {request_id}, all in one transaction.
--   identity.cancel_email_change()    member, his own open request.
--   EC-8: brevo_template_ids gets the key auth.email_changed_notice (NULL: not
--   configured, the consumer skips with template_not_configured).
--
-- A taken address gets the same answers as a free one (decision 5): nothing here looks
-- at it before complete_email_change(), which closes the request as address_unavailable.
--
-- Not here: the routes, the sends of auth.email_change_confirm_old/new and their
-- journal lines (commit 7), the connector variant updating the Brevo contact by id
-- (commit 4), the read of the previous address by the worker for the notice
-- (commit 7, through leads.read_brevo_subject or its successor).
--
-- ROLLBACK (before any real request): drop the six functions; drop table
-- identity.email_change_requests; drop function identity.prepare_email_change_request(),
-- identity.guard_email_change_request_update(); drop type
-- identity.email_change_side, identity.email_change_cancel_reason; re-create the 0012
-- body of identity.guard_session_update(); alter table identity.sessions drop
-- constraint sessions_reauth_marker, drop columns reauthenticated_at, reauth_purpose;
-- drop type identity.reauth_purpose; restore the 0104 policy
-- outbox_events_identity_definer_insert; remove the key auth.email_changed_notice from
-- brevo_template_ids; revoke the grants listed in §7.
-- =============================================================================

-- 1. Types --------------------------------------------------------------------------------

do $$
begin
  create type identity.reauth_purpose as enum ('email_change', 'data_export', 'account_deletion');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.email_change_side as enum ('old', 'new');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.email_change_cancel_reason as enum (
    'cancelled_by_holder', 'superseded', 'expired', 'too_many_attempts', 'address_unavailable');
exception when duplicate_object then null;
end
$$;

comment on type identity.reauth_purpose is
  'The three actions of 05 RG57 / 03 A-10 that need a fresh code: change the address, export one''s '
  'data, delete one''s account (a request at J7). A marker serves one purpose only.';
comment on type identity.email_change_side is
  'old: the code sent to the current address; new: the code sent to the requested address (A-11).';
comment on type identity.email_change_cancel_reason is
  'Why an address change request closed without effect: cancelled_by_holder, superseded (a new '
  'request, or the address changed meanwhile), expired (24 hours), too_many_attempts (5 on one '
  'side), address_unavailable (used by another account at completion; same answer as success '
  'towards the requester, decision 5).';

-- 2. The re-authentication marker on the session (decision 4) ---------------------------------

alter table identity.sessions add column if not exists reauthenticated_at timestamptz;
alter table identity.sessions add column if not exists reauth_purpose identity.reauth_purpose;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'sessions_reauth_marker'
                    and conrelid = 'identity.sessions'::regclass) then
    -- the pair goes together, on a member session only (a backoffice session has R, EC-40)
    alter table identity.sessions add constraint sessions_reauth_marker check (
      (reauthenticated_at is null) = (reauth_purpose is null)
      and (reauthenticated_at is null
           or (surface = 'member' and reauthenticated_at >= created_at)));
  end if;
end
$$;

comment on column identity.sessions.reauthenticated_at is
  'Decision 4 of J7 (05 RG57, 03 A-10): instant of the last re-authentication by a fresh code on THIS '
  'member session, written now() by identity.mark_member_reauthenticated() (influx_auth, E-2). Valid '
  '300 seconds, for reauth_purpose only, consumed (set back to NULL) by the sensitive action in its '
  'own transaction. Never on a backoffice session.';
comment on column identity.sessions.reauth_purpose is
  'The single action the marker allows: email_change, data_export or account_deletion.';

-- identity.guard_session_update() of 0012, plus the marker: set to now() with a purpose on a member
-- session, or cleared; nothing else.
create or replace function identity.guard_session_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- EC-29 point 4: a revoked session is frozen; it never comes back.
  if old.revoked_at is not null then
    raise exception 'a revoked session cannot be modified' using errcode = 'insufficient_privilege';
  end if;
  if new.id                  is distinct from old.id
     or new.token_hash          is distinct from old.token_hash
     or new.account_id          is distinct from old.account_id
     or new.surface             is distinct from old.surface
     or new.aal                 is distinct from old.aal
     or new.created_at          is distinct from old.created_at
     or new.absolute_expires_at is distinct from old.absolute_expires_at
     or new.user_agent_summary  is distinct from old.user_agent_summary
     or new.country_code        is distinct from old.country_code then
    raise exception 'immutable session column' using errcode = 'insufficient_privilege';
  end if;
  -- Activity only moves forward (renewal computes it in base, identity.touch_session()).
  if new.last_activity_at < old.last_activity_at then
    raise exception 'session activity cannot go back' using errcode = 'insufficient_privilege';
  end if;
  -- EC-40 point 2: a new proof of the second factor is always "now, by TOTP".
  if new.mfa_verified_at is distinct from old.mfa_verified_at
     or new.mfa_method is distinct from old.mfa_method then
    if old.surface <> 'backoffice'
       or new.mfa_verified_at is distinct from pg_catalog.now()
       or new.mfa_method is distinct from 'totp' then
      raise exception 'the second-factor freshness is only renewed now, by TOTP'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  -- Decision 4 of J7: the re-authentication marker is set to now() with a purpose on a member
  -- session, or cleared; never back-dated, never on a backoffice session.
  if new.reauthenticated_at is distinct from old.reauthenticated_at
     or new.reauth_purpose is distinct from old.reauth_purpose then
    if not (   (new.reauthenticated_at is null and new.reauth_purpose is null)
            or (old.surface = 'member' and new.reauth_purpose is not null
                and new.reauthenticated_at = pg_catalog.now())) then
      raise exception 'the re-authentication marker is set now, with a purpose, or cleared'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  if new.revoked_at is not null then
    -- the revocation instant is the transaction time, never a supplied value
    new.revoked_at := pg_catalog.now();
    -- influx_auth revokes only after failed re-authentications (EC-40 point 5)
    if current_user = 'influx_auth'
       and new.revocation_reason::text is distinct from 'reauthentication_failed' then
      raise exception 'revocation reason not allowed' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end
$$;

comment on function identity.guard_session_update() is
  'BEFORE UPDATE on identity.sessions (EC-29 point 4, EC-40, decision 4 of J7): a revoked row is '
  'frozen; the identity of the session, its absolute expiry and its browser summary never change; '
  'activity only moves forward; a new second-factor proof is always now() by TOTP on a backoffice '
  'session; the re-authentication marker is set to now() with a purpose on a member session, or '
  'cleared; the revocation instant is now(); influx_auth revokes with reauthentication_failed only. '
  'SECURITY INVOKER: it reads nothing but current_user.';

-- 3. identity.email_change_requests (decision 5) ---------------------------------------------------

create table if not exists identity.email_change_requests (
  id                uuid        not null default gen_random_uuid() primary key,
  account_id        uuid        not null references identity.accounts (id),
  old_email         text        not null,
  new_email         text        not null,
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  old_code_hash     bytea,
  new_code_hash     bytea,
  old_attempts      smallint    not null default 0,
  new_attempts      smallint    not null default 0,
  old_confirmed_at  timestamptz,
  new_confirmed_at  timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  cancel_reason     identity.email_change_cancel_reason,
  updated_at        timestamptz not null default now(),

  constraint email_change_requests_emails_normalized check (
    old_email = lower(old_email) and position('@' in old_email) > 1 and length(old_email) <= 320
    and new_email = lower(new_email) and position('@' in new_email) > 1 and length(new_email) <= 320),
  constraint email_change_requests_new_differs check (new_email <> old_email),
  -- 05 RG58: 24 hours, in hours so that the arithmetic does not depend on the time zone
  constraint email_change_requests_lifetime check (expires_at = created_at + interval '24 hours'),
  constraint email_change_requests_hash_pair check ((old_code_hash is null) = (new_code_hash is null)),
  constraint email_change_requests_hash_sha256
    check (octet_length(old_code_hash) = 32 and octet_length(new_code_hash) = 32
           and old_code_hash <> new_code_hash),
  -- the digests live while the request is open, and only then
  constraint email_change_requests_hash_while_open
    check ((old_code_hash is not null) = (completed_at is null and cancelled_at is null)),
  constraint email_change_requests_attempts_range
    check (old_attempts between 0 and 5 and new_attempts between 0 and 5),
  constraint email_change_requests_confirmations_order
    check (coalesce(old_confirmed_at, created_at) >= created_at
           and coalesce(new_confirmed_at, created_at) >= created_at),
  constraint email_change_requests_completion_confirmed
    check (completed_at is null
           or (old_confirmed_at is not null and new_confirmed_at is not null
               and completed_at >= greatest(old_confirmed_at, new_confirmed_at))),
  constraint email_change_requests_single_end
    check (completed_at is null or cancelled_at is null),
  constraint email_change_requests_cancel_pair
    check ((cancelled_at is null) = (cancel_reason is null))
);

comment on table identity.email_change_requests is
  'Requests to change the address of a member account (decision 5 of J7, 05 RG58, 03 A-11): 24 '
  'hours, two six-digit codes typed in the member space (never a link), 5 attempts per side, one open '
  'request per account. The address of the account changes only at completion, after GoTrue '
  '(admin.updateUserById, email_confirm). Written by the identity functions only. Personal data: '
  'both addresses. APPEND-ONLY but for the life of the request (trigger); retention to be fixed with '
  'expert-conformite-rgpd (Lot 6).';
comment on column identity.email_change_requests.id is
  'Random uuid generated by apps/api before the call, so that the HMAC of each code can bind the '
  'request and the side; also the id carried by the payloads of email.changed (RG74).';
comment on column identity.email_change_requests.old_email is
  'The address of the account when the request was made: the recipient of the "old" code and of '
  'the "previous" notice. A completion is refused if the account no longer has it.';
comment on column identity.email_change_requests.new_email is
  'The requested address, lower case. Whether another account uses it is looked at only at '
  'completion: the answers to the requester never depend on it (decision 5).';
comment on column identity.email_change_requests.old_code_hash is
  'HMAC-SHA-256 of the "old" code, peppered by apps/api. Never the code. Cleared when the request '
  'closes.';
comment on column identity.email_change_requests.new_code_hash is
  'HMAC-SHA-256 of the "new" code, peppered by apps/api. Never the code. Cleared when the request '
  'closes.';
comment on column identity.email_change_requests.old_attempts is
  'Wrong codes typed for the old side; the fifth closes the request (too_many_attempts).';

create unique index if not exists email_change_requests_open_idx
  on identity.email_change_requests (account_id)
  where completed_at is null and cancelled_at is null;
comment on index identity.email_change_requests_open_idx is
  'Decision 5: one open request per account (constraint), and the "address pending" screen of the '
  'member space.';

create or replace function identity.prepare_email_change_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- every date and counter is computed here: no caller chooses them
  new.created_at       := pg_catalog.now();
  new.updated_at       := pg_catalog.now();
  new.expires_at       := pg_catalog.now() + interval '24 hours';
  new.old_attempts     := 0;
  new.new_attempts     := 0;
  new.old_confirmed_at := null;
  new.new_confirmed_at := null;
  new.completed_at     := null;
  new.cancelled_at     := null;
  new.cancel_reason    := null;
  return new;
end
$$;

comment on function identity.prepare_email_change_request() is
  'BEFORE INSERT on identity.email_change_requests: created_at = now(), expires_at = now() + 24 hours, '
  'no attempt, no confirmation, open. SECURITY INVOKER, reads nothing.';

create or replace function identity.guard_email_change_request_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.completed_at is not null or old.cancelled_at is not null then
    raise exception 'a closed address change request is frozen' using errcode = 'insufficient_privilege';
  end if;
  if new.id is distinct from old.id
     or new.account_id is distinct from old.account_id
     or new.old_email  is distinct from old.old_email
     or new.new_email  is distinct from old.new_email
     or new.created_at is distinct from old.created_at
     or new.expires_at is distinct from old.expires_at then
    raise exception 'immutable address change column' using errcode = 'insufficient_privilege';
  end if;
  if new.old_attempts not in (old.old_attempts, old.old_attempts + 1)
     or new.new_attempts not in (old.new_attempts, old.new_attempts + 1) then
    raise exception 'an attempt counter moves forward by one' using errcode = 'insufficient_privilege';
  end if;
  if (old.old_confirmed_at is not null and new.old_confirmed_at is distinct from old.old_confirmed_at)
     or (old.new_confirmed_at is not null and new.new_confirmed_at is distinct from old.new_confirmed_at) then
    raise exception 'a confirmation is written once' using errcode = 'insufficient_privilege';
  end if;
  if old.old_confirmed_at is null and new.old_confirmed_at is not null then
    new.old_confirmed_at := pg_catalog.now();
  end if;
  if old.new_confirmed_at is null and new.new_confirmed_at is not null then
    new.new_confirmed_at := pg_catalog.now();
  end if;
  if new.completed_at is not null then
    new.completed_at := pg_catalog.now();
  end if;
  if new.cancelled_at is not null then
    new.cancelled_at := pg_catalog.now();
  end if;
  -- the digests change only to be cleared, at the closing of the request
  if (new.old_code_hash is distinct from old.old_code_hash
      or new.new_code_hash is distinct from old.new_code_hash)
     and not (new.old_code_hash is null and new.new_code_hash is null
              and (new.completed_at is not null or new.cancelled_at is not null)) then
    raise exception 'the code digests are only cleared, when the request closes'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function identity.guard_email_change_request_update() is
  'BEFORE UPDATE on identity.email_change_requests: a closed request is frozen; account, addresses, '
  'creation and expiry never change; attempts move forward by one; each confirmation, the '
  'completion and the cancellation are written once, at now(); the digests are only cleared, when '
  'the request closes. SECURITY INVOKER, reads nothing.';

revoke all on function identity.prepare_email_change_request()        from public;
revoke all on function identity.guard_email_change_request_update()   from public;

drop trigger if exists email_change_requests_prepare on identity.email_change_requests;
create trigger email_change_requests_prepare
  before insert on identity.email_change_requests
  for each row execute function identity.prepare_email_change_request();

drop trigger if exists email_change_requests_guard_update on identity.email_change_requests;
create trigger email_change_requests_guard_update
  before update on identity.email_change_requests
  for each row execute function identity.guard_email_change_request_update();

drop trigger if exists email_change_requests_no_delete on identity.email_change_requests;
create trigger email_change_requests_no_delete
  before delete on identity.email_change_requests
  for each row execute function influx.assert_append_only();

drop trigger if exists email_change_requests_no_truncate on identity.email_change_requests;
create trigger email_change_requests_no_truncate
  before truncate on identity.email_change_requests
  for each statement execute function influx.assert_append_only();

alter table identity.email_change_requests enable row level security;
alter table identity.email_change_requests force  row level security;
revoke all on identity.email_change_requests from public, anon, authenticated, service_role;

-- 4. The re-authentication functions (decision 4) -----------------------------------------------------

-- 4.1 E-2: the marker (influx_auth) ---------------------------------------------------------------------

create or replace function identity.mark_member_reauthenticated(
  p_session_id  uuid,
  p_purpose     identity.reauth_purpose
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid;
begin
  if p_purpose is null then
    raise exception 'a purpose is required' using errcode = 'invalid_parameter_value';
  end if;
  -- an open, unexpired member session of an active member account
  update identity.sessions s
     set reauthenticated_at = pg_catalog.now(),
         reauth_purpose     = p_purpose
   where s.id = p_session_id
     and s.surface = 'member'
     and s.revoked_at is null
     and s.idle_expires_at     > pg_catalog.now()
     and s.absolute_expires_at > pg_catalog.now()
     and exists (select 1
                   from identity.accounts a
                   join identity.account_roles r on r.account_id = a.id
                  where a.id = s.account_id
                    and a.status = 'active'
                    and r.role in ('advertiser', 'creator'))
  returning s.account_id into v_account;
  return v_account;
end
$$;

comment on function identity.mark_member_reauthenticated(uuid, identity.reauth_purpose) is
  'E-2 identity.member_reauthenticate (decision 4 of J7): after apps/api has verified a fresh code '
  'sent to the address of the session, sets reauthenticated_at = now() and the purpose on that '
  'session (open, unexpired, member, active member account). Returns the account, the subject of '
  'elevated.identity.member_reauthenticate; NULL when the session does not qualify (nothing written). '
  'A new marker replaces the previous one. SECURITY DEFINER owned by influx_identity_definer, empty '
  'search_path; EXECUTE for influx_auth ONLY.';

-- 4.2 The check-and-clear (owner only) -------------------------------------------------------------------

create or replace function identity.consume_member_reauthentication(
  p_session_id  uuid,
  p_purpose     identity.reauth_purpose
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  -- 300 seconds: REAUTHENTICATION_FRESHNESS_SECONDS (provisional, decision 4). The session is
  -- one of the CALLER's (influx.account), open and unexpired; the marker serves once.
  update identity.sessions s
     set reauthenticated_at = null,
         reauth_purpose     = null
   where s.id = p_session_id
     and s.account_id = influx.current_account_id()
     and s.surface = 'member'
     and s.revoked_at is null
     and s.idle_expires_at     > pg_catalog.now()
     and s.absolute_expires_at > pg_catalog.now()
     and s.reauth_purpose = p_purpose
     and s.reauthenticated_at >= pg_catalog.now() - interval '300 seconds';
  if not found then
    raise exception 'a fresh re-authentication for this action is required'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
end
$$;

comment on function identity.consume_member_reauthentication(uuid, identity.reauth_purpose) is
  'Decision 4 of J7: checks that the given session of the CALLER carries a re-authentication marker '
  'for p_purpose younger than 300 seconds, and clears it (single use), in the transaction of the '
  'sensitive action; 55000 otherwise (nothing written: the whole action fails). SECURITY INVOKER '
  'owned by influx_identity_definer, NO grant: called by the identity functions only.';

-- 5. The address change functions (decision 5) --------------------------------------------------------

-- 5.1 The request ----------------------------------------------------------------------------------------

create or replace function identity.request_email_change(
  p_session_id     uuid,
  p_request_id     uuid,
  p_new_email      text,
  p_old_code_hash  bytea,
  p_new_code_hash  bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_new      text := pg_catalog.lower(pg_catalog.btrim(p_new_email));
  v_current  text;
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_request_id is null then
    raise exception 'the request id is required' using errcode = 'invalid_parameter_value';
  end if;
  if v_new is null or pg_catalog.strpos(v_new, '@') <= 1 or pg_catalog.length(v_new) > 320
     or v_new ~ '[[:space:][:cntrl:]]' then
    raise exception 'malformed address' using errcode = 'invalid_parameter_value';
  end if;
  if p_old_code_hash is null or p_new_code_hash is null
     or pg_catalog.octet_length(p_old_code_hash) <> 32
     or pg_catalog.octet_length(p_new_code_hash) <> 32
     or p_old_code_hash = p_new_code_hash then
    raise exception 'two distinct 32-byte code digests are required'
      using errcode = 'invalid_parameter_value';
  end if;

  select a.email
    into v_current
    from identity.accounts a
   where a.id = v_account and a.status = 'active'
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_new = v_current then
    raise exception 'the new address equals the current one' using errcode = 'invalid_parameter_value';
  end if;

  -- RG57, A-10: a fresh code for THIS action, consumed here.
  perform identity.consume_member_reauthentication(p_session_id, 'email_change');

  -- One open request per account: the previous one closes.
  update identity.email_change_requests r
     set cancelled_at  = pg_catalog.now(),
         cancel_reason = case when r.expires_at <= pg_catalog.now()
                              then 'expired'::identity.email_change_cancel_reason
                              else 'superseded'::identity.email_change_cancel_reason end,
         old_code_hash = null,
         new_code_hash = null
   where r.account_id = v_account
     and r.completed_at is null
     and r.cancelled_at is null;

  insert into identity.email_change_requests
    (id, account_id, old_email, new_email, old_code_hash, new_code_hash)
  values
    (p_request_id, v_account, v_current, v_new, p_old_code_hash, p_new_code_hash);
  return p_request_id;
end
$$;

comment on function identity.request_email_change(uuid, uuid, text, bytea, bytea) is
  'Decision 5 of J7 (05 RG58, 03 A-11): an advertiser or creator asks to change his address. Needs '
  'the marker email_change on p_session_id, consumed here (55000 without it). Closes his open '
  'request (superseded, or expired), then writes the new one: p_request_id (random, from apps/api), '
  'the current address as old_email, the normalised new address, the two HMAC digests (32 bytes, '
  'distinct). Whether the new address is used by another account is NOT looked at (same answer, '
  'decision 5). 22023 for a malformed value or the same address; 42501 outside an active member '
  'account. Returns the request id. SECURITY DEFINER owned by influx_identity_definer, empty '
  'search_path; EXECUTE for influx_advertiser and influx_creator.';

-- 5.2 One code ------------------------------------------------------------------------------------------

create or replace function identity.confirm_email_change(
  p_request_id  uuid,
  p_side        identity.email_change_side,
  p_code_hash   bytea
)
returns table (
  outcome       text,
  ready         boolean,
  auth_user_id  uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_req      record;
  v_match    boolean;
  v_ready    boolean;
  v_user     uuid;
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator')
     or not exists (select 1 from identity.accounts a where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_side is null or p_code_hash is null or pg_catalog.octet_length(p_code_hash) <> 32 then
    raise exception 'a side and a 32-byte code digest are required'
      using errcode = 'invalid_parameter_value';
  end if;

  select r.id, r.expires_at, r.old_code_hash, r.new_code_hash, r.old_attempts, r.new_attempts,
         r.old_confirmed_at, r.new_confirmed_at
    into v_req
    from identity.email_change_requests r
   where r.id = p_request_id
     and r.account_id = v_account
     and r.completed_at is null
     and r.cancelled_at is null
     for update;
  if not found then
    return query select 'not_found'::text, false, null::uuid;
    return;
  end if;
  if v_req.expires_at <= pg_catalog.now() then
    update identity.email_change_requests
       set cancelled_at = pg_catalog.now(), cancel_reason = 'expired',
           old_code_hash = null, new_code_hash = null
     where id = v_req.id;
    return query select 'expired'::text, false, null::uuid;
    return;
  end if;

  if (p_side = 'old' and v_req.old_confirmed_at is not null)
     or (p_side = 'new' and v_req.new_confirmed_at is not null) then
    v_ready := v_req.old_confirmed_at is not null and v_req.new_confirmed_at is not null;
  else
    v_match := case p_side when 'old' then p_code_hash = v_req.old_code_hash
                           else p_code_hash = v_req.new_code_hash end;
    if not v_match then
      -- 5 attempts per side: the fifth wrong code closes the request
      if (case p_side when 'old' then v_req.old_attempts else v_req.new_attempts end) + 1 >= 5 then
        update identity.email_change_requests
           set old_attempts = old_attempts + case when p_side = 'old' then 1 else 0 end,
               new_attempts = new_attempts + case when p_side = 'new' then 1 else 0 end,
               cancelled_at = pg_catalog.now(), cancel_reason = 'too_many_attempts',
               old_code_hash = null, new_code_hash = null
         where id = v_req.id;
        return query select 'attempts_exhausted'::text, false, null::uuid;
        return;
      end if;
      update identity.email_change_requests
         set old_attempts = old_attempts + case when p_side = 'old' then 1 else 0 end,
             new_attempts = new_attempts + case when p_side = 'new' then 1 else 0 end
       where id = v_req.id;
      return query select 'invalid_code'::text, false, null::uuid;
      return;
    end if;
    update identity.email_change_requests
       set old_confirmed_at = case when p_side = 'old' then pg_catalog.now() else old_confirmed_at end,
           new_confirmed_at = case when p_side = 'new' then pg_catalog.now() else new_confirmed_at end
     where id = v_req.id;
    v_ready := (p_side = 'old' or v_req.old_confirmed_at is not null)
               and (p_side = 'new' or v_req.new_confirmed_at is not null);
  end if;

  if v_ready then
    select a.auth_user_id into v_user from identity.accounts a where a.id = v_account;
  end if;
  return query
  select case when v_match is null then 'already_confirmed' else 'confirmed' end, v_ready, v_user;
end
$$;

comment on function identity.confirm_email_change(uuid, identity.email_change_side, bytea) is
  'Decision 5 of J7: one code of one side of the caller''s OPEN request. Returns (outcome, ready, '
  'auth_user_id): confirmed | already_confirmed (ready = both sides confirmed, then the GoTrue user '
  'id to update with admin.updateUserById) | invalid_code (attempt counted) | attempts_exhausted '
  '(fifth wrong code of the side: request closed, too_many_attempts) | expired (closed) | not_found '
  '(unknown, closed or another account''s). Never raises on a wrong code: the counter must be '
  'committed. 22023 for a malformed digest, 42501 outside an active member account. SECURITY DEFINER '
  'owned by influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and '
  'influx_creator.';

-- 5.3 The completion ------------------------------------------------------------------------------------

create or replace function identity.complete_email_change(
  p_request_id  uuid,
  p_session_id  uuid
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_req      record;
  v_current  text;
  v_fact     uuid := pg_catalog.gen_random_uuid();
  v_subject  text;
  v_revoked  integer;
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the caller's own open member session: it is kept, every other one is revoked
  if p_session_id is null
     or not exists (select 1 from identity.sessions s
                     where s.id = p_session_id and s.account_id = v_account
                       and s.surface = 'member' and s.revoked_at is null
                       and s.idle_expires_at > pg_catalog.now()
                       and s.absolute_expires_at > pg_catalog.now()) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  select a.email
    into v_current
    from identity.accounts a
   where a.id = v_account and a.status = 'active'
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  select r.id, r.old_email, r.new_email, r.expires_at, r.old_confirmed_at, r.new_confirmed_at
    into v_req
    from identity.email_change_requests r
   where r.id = p_request_id
     and r.account_id = v_account
     and r.completed_at is null
     and r.cancelled_at is null
     for update;
  if not found then
    return 'not_found';
  end if;
  if v_req.old_confirmed_at is null or v_req.new_confirmed_at is null then
    return 'not_ready';
  end if;
  if v_req.expires_at <= pg_catalog.now() then
    update identity.email_change_requests
       set cancelled_at = pg_catalog.now(), cancel_reason = 'expired',
           old_code_hash = null, new_code_hash = null
     where id = v_req.id;
    return 'expired';
  end if;
  -- the address changed meanwhile (an administrator's correction): this request is void
  if v_current is distinct from v_req.old_email then
    update identity.email_change_requests
       set cancelled_at = pg_catalog.now(), cancel_reason = 'superseded',
           old_code_hash = null, new_code_hash = null
     where id = v_req.id;
    return 'superseded';
  end if;
  -- decision 5: a taken address closes the request; apps/api answers as for a success
  if exists (select 1 from identity.accounts a where a.email = v_req.new_email and a.id <> v_account) then
    update identity.email_change_requests
       set cancelled_at = pg_catalog.now(), cancel_reason = 'address_unavailable',
           old_code_hash = null, new_code_hash = null
     where id = v_req.id;
    return 'address_unavailable';
  end if;

  -- The address and its proof: both codes were typed, the new address is proven now. Its health
  -- starts again (no signal yet on this address, as in identity.correct_email()).
  update identity.accounts
     set email                  = v_req.new_email,
         email_verified_at      = pg_catalog.now(),
         email_status           = 'unknown',
         email_undeliverable_at = null
   where id = v_account;

  update identity.email_change_requests
     set completed_at = pg_catalog.now(), old_code_hash = null, new_code_hash = null
   where id = v_req.id;

  -- Decision 5: every OTHER open session of the account is revoked.
  update identity.sessions
     set revoked_at = pg_catalog.now(),
         revocation_reason = 'email_changed'
   where account_id = v_account
     and id <> p_session_id
     and revoked_at is null;
  get diagnostics v_revoked = row_count;

  -- RG58, RG73: email.changed to both contacts (normal priority, the contact is updated by its
  -- id, never recreated); the two notices, urgent, to the previous and the current address.
  -- RG74: identifiers only; the consumer reads the addresses from the request.
  v_subject := 'account:' || v_account::text;
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_fact, 'email.changed', n.destination, v_subject, n.priority,
         pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account,
                                       'request_id', v_req.id) || n.extra,
         n.idempotency_key
    from (values
      ('brevo_contact'::leads.outbox_destination, 100::smallint, '{}'::jsonb,
       'email.changed:' || v_req.id::text),
      ('apollo_contact'::leads.outbox_destination, 100::smallint, '{}'::jsonb,
       'email.changed:' || v_req.id::text),
      ('brevo_transactional'::leads.outbox_destination, 0::smallint,
       pg_catalog.jsonb_build_object('email_code', 'auth.email_changed_notice', 'recipient', 'previous'),
       'auth.email_changed_notice:' || v_req.id::text || ':previous'),
      ('brevo_transactional'::leads.outbox_destination, 0::smallint,
       pg_catalog.jsonb_build_object('email_code', 'auth.email_changed_notice', 'recipient', 'current'),
       'auth.email_changed_notice:' || v_req.id::text || ':current')
    ) n (destination, priority, extra, idempotency_key);

  -- last: the chain lock is held until COMMIT (04 §7.2)
  perform audit.append('email.changed', 'account', v_account,
                       pg_catalog.jsonb_build_object('request_id', v_req.id,
                                                     'sessions_revoked', v_revoked));
  return 'completed';
end
$$;

comment on function identity.complete_email_change(uuid, uuid) is
  'Decision 5 of J7 (05 RG58): called by apps/api AFTER admin.updateUserById (email_confirm) '
  'succeeded, on the caller''s open request with both sides confirmed. In one transaction: the '
  'address, email_verified_at = now(), email_status reset to unknown; the request completed (digests '
  'cleared); every other open session revoked (email_changed), p_session_id kept; email.changed to '
  'brevo_contact and apollo_contact (priority 100) and two auth.email_changed_notice (priority 0, '
  'previous and current), payload = ids (request id included); the register line email.changed '
  '{request_id, sessions_revoked}. Returns completed | not_found | not_ready | expired | superseded '
  '(the account address changed meanwhile) | address_unavailable (another account holds it): the '
  'last four close nothing but the request, and apps/api then sets GoTrue back to the old address. '
  '42501 outside an active member account or its open session. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and influx_creator.';

-- 5.4 The cancellation by the holder -------------------------------------------------------------------

create or replace function identity.cancel_email_change(p_request_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  update identity.email_change_requests r
     set cancelled_at = pg_catalog.now(), cancel_reason = 'cancelled_by_holder',
         old_code_hash = null, new_code_hash = null
   where r.id = p_request_id
     and r.account_id = v_account
     and r.completed_at is null
     and r.cancelled_at is null;
  return found;
end
$$;

comment on function identity.cancel_email_change(uuid) is
  'Decision 5 of J7: the holder cancels his open address change request (cancelled_by_holder, digests '
  'cleared). Returns false for an unknown, closed or foreign request (nothing written). SECURITY '
  'DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and '
  'influx_creator.';

-- 6. Publication -------------------------------------------------------------------------------------

revoke all on function identity.mark_member_reauthenticated(uuid, identity.reauth_purpose)
  from public, anon, authenticated, service_role;
revoke all on function identity.consume_member_reauthentication(uuid, identity.reauth_purpose)
  from public, anon, authenticated, service_role;
revoke all on function identity.request_email_change(uuid, uuid, text, bytea, bytea)
  from public, anon, authenticated, service_role;
revoke all on function identity.confirm_email_change(uuid, identity.email_change_side, bytea)
  from public, anon, authenticated, service_role;
revoke all on function identity.complete_email_change(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function identity.cancel_email_change(uuid)
  from public, anon, authenticated, service_role;

grant execute on function identity.mark_member_reauthenticated(uuid, identity.reauth_purpose)
   to influx_auth;
grant execute on function identity.request_email_change(uuid, uuid, text, bytea, bytea)
   to influx_advertiser, influx_creator;
grant execute on function identity.confirm_email_change(uuid, identity.email_change_side, bytea)
   to influx_advertiser, influx_creator;
grant execute on function identity.complete_email_change(uuid, uuid)
   to influx_advertiser, influx_creator;
grant execute on function identity.cancel_email_change(uuid)
   to influx_advertiser, influx_creator;

-- 7. Rights --------------------------------------------------------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy.

-- 7.1 The owner of the functions ------------------------------------------------------------------------

-- sessions: the marker read and written, the creation instant (constraint); revocation since 0012
grant select (reauthenticated_at, reauth_purpose, created_at)
   on identity.sessions to influx_identity_definer;
grant update (reauthenticated_at, reauth_purpose) on identity.sessions to influx_identity_definer;

-- the requests
grant select (id, account_id, old_email, new_email, expires_at, old_code_hash, new_code_hash,
              old_attempts, new_attempts, old_confirmed_at, new_confirmed_at, completed_at,
              cancelled_at)
   on identity.email_change_requests to influx_identity_definer;
grant insert (id, account_id, old_email, new_email, old_code_hash, new_code_hash)
   on identity.email_change_requests to influx_identity_definer;
grant update (old_code_hash, new_code_hash, old_attempts, new_attempts, old_confirmed_at,
              new_confirmed_at, completed_at, cancelled_at, cancel_reason)
   on identity.email_change_requests to influx_identity_definer;

drop policy if exists email_change_requests_identity_definer_select on identity.email_change_requests;
create policy email_change_requests_identity_definer_select on identity.email_change_requests
  for select to influx_identity_definer
  using (true);

drop policy if exists email_change_requests_identity_definer_insert on identity.email_change_requests;
create policy email_change_requests_identity_definer_insert on identity.email_change_requests
  for insert to influx_identity_definer
  with check (account_id = (select influx.current_account_id()));

drop policy if exists email_change_requests_identity_definer_update on identity.email_change_requests;
create policy email_change_requests_identity_definer_update on identity.email_change_requests
  for update to influx_identity_definer
  using (completed_at is null and cancelled_at is null)
  with check (true);

-- the queue: the facts of the identity functions (0104), plus email.changed (RG58)
drop policy if exists outbox_events_identity_definer_insert on leads.outbox_events;
create policy outbox_events_identity_definer_insert on leads.outbox_events
  for insert to influx_identity_definer
  with check (status = 'pending' and attempts = 0
              and event_type in ('lead.created', 'lead.updated', 'account.email_corrected',
                                 'email.changed'));

-- 7.2 Members: their own requests, never the digests -----------------------------------------------------

-- account_id: their own id, on their own rows only (the owner column of the T2 probes)
grant select (id, account_id, new_email, created_at, expires_at, old_attempts, new_attempts,
              old_confirmed_at, new_confirmed_at, completed_at, cancelled_at, cancel_reason)
   on identity.email_change_requests to influx_advertiser, influx_creator;

drop policy if exists email_change_requests_member_select_own on identity.email_change_requests;
create policy email_change_requests_member_select_own on identity.email_change_requests
  for select to influx_advertiser, influx_creator
  using (account_id = (select influx.current_account_id()));

-- The marker itself stays unreadable by the members (column grants of 0004 unchanged): apps/api
-- knows what it has just verified, and the action checks the row.

-- 7.3 Agent and admin: the requests of every account, in aal2, never the digests (03 §3.1 L) -----------

grant select (id, account_id, old_email, new_email, created_at, expires_at, old_attempts,
              new_attempts, old_confirmed_at, new_confirmed_at, completed_at, cancelled_at,
              cancel_reason, updated_at)
   on identity.email_change_requests to influx_agent, influx_admin;

drop policy if exists email_change_requests_internal_select on identity.email_change_requests;
create policy email_change_requests_internal_select on identity.email_change_requests
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 7.4 EC-8: the template of the notice, not configured (the consumer skips, never guesses) -------------

update leads.sync_settings
   set value = pg_catalog.jsonb_build_object('auth.email_changed_notice', null) || value
 where key = 'brevo_template_ids'
   and not (value ? 'auth.email_changed_notice');

-- 8. Hand the functions to influx_identity_definer (03 P7 rule 5, window of 0004 §9) ----------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.mark_member_reauthenticated(uuid, identity.reauth_purpose)
  owner to influx_identity_definer;
alter function identity.consume_member_reauthentication(uuid, identity.reauth_purpose)
  owner to influx_identity_definer;
alter function identity.request_email_change(uuid, uuid, text, bytea, bytea)
  owner to influx_identity_definer;
alter function identity.confirm_email_change(uuid, identity.email_change_side, bytea)
  owner to influx_identity_definer;
alter function identity.complete_email_change(uuid, uuid) owner to influx_identity_definer;
alter function identity.cancel_email_change(uuid) owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 9. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('identity.mark_member_reauthenticated(uuid, identity.reauth_purpose)',
       array['influx_auth']),
      ('identity.request_email_change(uuid, uuid, text, bytea, bytea)',
       array['influx_advertiser', 'influx_creator']),
      ('identity.confirm_email_change(uuid, identity.email_change_side, bytea)',
       array['influx_advertiser', 'influx_creator']),
      ('identity.complete_email_change(uuid, uuid)',
       array['influx_advertiser', 'influx_creator']),
      ('identity.cancel_email_change(uuid)',
       array['influx_advertiser', 'influx_creator'])
    ) as t (fn, callers)
  loop
    v_fn := v_def.fn;
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_identity_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_identity_definer, empty search_path', v_fn;
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

  v_fn := 'identity.consume_member_reauthentication(uuid, identity.reauth_purpose)';
  if (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
     or (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
          where oid = v_fn::regprocedure) <> 'influx_identity_definer'
     or exists (select 1
                  from pg_catalog.pg_proc p,
                       pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
                 where p.oid = v_fn::regprocedure
                   and a.privilege_type = 'EXECUTE'
                   and a.grantee <> p.proowner) then
    raise exception '% must be SECURITY INVOKER, owned by influx_identity_definer, without grant', v_fn;
  end if;

  -- nobody writes the marker nor a request directly: the identity functions only
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_column_privilege(r.oid, 'identity.sessions', 'reauthenticated_at', 'UPDATE')
          or pg_catalog.has_column_privilege(r.oid, 'identity.sessions', 'reauth_purpose', 'UPDATE')
          or pg_catalog.has_any_column_privilege(r.oid, 'identity.email_change_requests', 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'identity.email_change_requests', 'DELETE, TRUNCATE')
          or pg_catalog.has_column_privilege(r.oid, 'identity.email_change_requests', 'old_code_hash', 'SELECT')
          or pg_catalog.has_column_privilege(r.oid, 'identity.email_change_requests', 'new_code_hash', 'SELECT'));
  if v_bad is not null then
    raise exception 'role(s) may write the marker or a request, or read a digest: %', v_bad;
  end if;

  -- 0104 §7 still holds: nobody but the identity owner writes the address
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'email', 'UPDATE')
          or pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'email_status', 'UPDATE'));
  if v_bad is not null then
    raise exception 'role(s) may write the address directly: %', v_bad;
  end if;

  if not exists (select 1 from leads.sync_settings
                  where key = 'brevo_template_ids' and value ? 'auth.email_changed_notice') then
    raise exception 'brevo_template_ids lacks auth.email_changed_notice (EC-8)';
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_identity_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_identity_definer left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema identity';
  end if;
end
$$;
