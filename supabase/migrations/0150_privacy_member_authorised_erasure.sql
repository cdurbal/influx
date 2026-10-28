-- =============================================================================
-- 0150_privacy_member_authorised_erasure
-- -----------------------------------------------------------------------------
-- D72 (founder, validated by architecte on 2026-10-27): the erasure deposited from the member
-- space with a fresh code account_deletion is AUTHORISED BY THE MEMBER, without an admin 2V
-- (docs/mvp/jalons/zone-de-danger-fiche.md §2.1, §2.2, §2.4). The member double check (the
-- fresh code, RG57) is kept; E-5 executes it at its next turn (<= 1 min), unchanged in principle.
--
--   privacy.request_executions   + authorised_by text NOT NULL in {admin_dual_control,
--         member_fresh_code} (existing rows: admin_dual_control); dual_control_request_id and
--         approved_by_account_id become NULLABLE, CHECK request_executions_authorisation:
--         admin_dual_control => both set (RG36 kept by request_executions_approver_not_subject),
--         member_fresh_code => both NULL and request_type = 'erasure'; the channel self_service
--         of the request is checked by the BEFORE INSERT trigger (a CHECK cannot read another
--         table, EC-DZ-1). request_executions_access_columns widened (notification_message_id
--         for erasure too); request_executions_erasure_completion also requires the messageId of
--         the e-mail privacy.erasure_completed. authorised_by is immutable (update guard).
--         No member role receives any right on the table: only the function below writes.
--   identity.submit_member_erasure()   (owner influx_identity_definer, EXECUTE for
--         influx_advertiser and influx_creator; account and session from the transaction context,
--         never a parameter) in ONE transaction: the fresh code consumed, the erasure request
--         (self_service) in_progress, its execution member_fresh_code, EVERY session of the
--         account revoked (revoked_by_holder), the register lines privacy.request_received and
--         privacy.execution_authorised_by_member. No acknowledgement e-mail. An open erasure is
--         returned as it is (created = false), nothing else written.
--   privacy.pending_work()       recreated by its owner: an execution whose request is closed is
--         left out (EC-DZ-3).
--   privacy.execute_request()    recreated by its owner: the erasure also closes an open access
--         request of the account (retiree_par_le_demandeur, privacy.request_completed), purges
--         its exports as before, and queues the e-mail privacy.erasure_completed (P1, ids only) to
--         the held address.
--   privacy.complete_request()   recreated by its owner: an erasure closes only once the e-mail
--         privacy.erasure_completed succeeded live with its messageId (copied to
--         notification_message_id); NULL for a request already closed.
--   privacy.read_erasure_notification_subject(uuid)   (DZ-3, validated by architecte) owner
--         influx_privacy_definer, EXECUTE for influx_privacy ONLY: the held address, the
--         language and the time zone of the account, and the instant of the erasure, of an
--         executed, open erasure whose address is still held; no row otherwise.
--   audit.event_types            privacy.execution_authorised_by_member (critical) and the queue
--         fact privacy.erasure_completed (info: the queue references audit.event_types, 0101).
--
-- EC-DZ (micro-gaps, the safest choice):
--   EC-DZ-1  the channel self_service of a member authorisation is checked by
--            privacy.prepare_request_execution() (23514), the only writer being
--            identity.submit_member_erasure(); the enum holds self_service only until 0502.
--   EC-DZ-2  authorised_by keeps the DEFAULT admin_dual_control: the approval function of 0137 is
--            left untouched, and a member authorisation must name itself (the CHECK refuses a
--            row without 2V otherwise).
--   EC-DZ-3  an access request withdrawn by the erasure may hold an execution (approved, or
--            executed and waiting for its e-mail): it can no longer close (its request is
--            closed, request_executions_access_completion needs a messageId), so pending_work()
--            leaves it out and complete_request() answers NULL for it.
--   EC-DZ-4  the closure of the withdrawn access request is journaled privacy.request_completed
--            {request_type access, outcome_code retiree_par_le_demandeur} (15 RG77: every closure
--            carries its typed outcome in the register).
--   EC-DZ-5  read_erasure_notification_subject() also returns erased_at (executed_at): the e-mail
--            states the date and time of the deletion (§2.3); nothing else.
--   EC-DZ-6  request_executions_erasure_completion is added NOT VALID and validated at once when
--            no closed erasure lacks a messageId (an erasure closed before 0150 never had one).
--
-- ROLLBACK (before any member-authorised erasure exists): drop function
-- identity.submit_member_erasure() and privacy.read_erasure_notification_subject(uuid); restate
-- privacy.pending_work(), privacy.execute_request(), privacy.complete_request() as in 0137 (as
-- influx_privacy_definer), privacy.prepare_request_execution() and
-- privacy.guard_request_execution_update() as in 0137; restate the policies
-- request_executions_identity_definer_insert, data_subject_requests_privacy_definer_update,
-- outbox_events_privacy_definer_select and outbox_events_privacy_definer_insert as in 0137;
-- revoke the column grants on authorised_by; restore the two constraints of 0137, drop
-- request_executions_authorisation, set dual_control_request_id and approved_by_account_id NOT
-- NULL, drop column authorised_by; delete the two codes from audit.event_types (possible only
-- while no line references them).
-- =============================================================================

-- 1. The codes ---------------------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- D72: the member authorised the erasure of his own account with a fresh code (no 2V)
  ('privacy.execution_authorised_by_member', 'privacy', 'data_subject_request', 'critical'),
  -- D72: the queue fact of the e-mail "your account is deleted" (P1, no link)
  ('privacy.erasure_completed',              'privacy', 'data_subject_request', 'info')
on conflict (code) do nothing;

-- 2. privacy.request_executions ---------------------------------------------------------------------

alter table privacy.request_executions
  add column if not exists authorised_by text not null default 'admin_dual_control';
alter table privacy.request_executions alter column dual_control_request_id drop not null;
alter table privacy.request_executions alter column approved_by_account_id drop not null;

alter table privacy.request_executions drop constraint if exists request_executions_authorisation;
alter table privacy.request_executions add constraint request_executions_authorisation check (
  (authorised_by = 'admin_dual_control'
   and dual_control_request_id is not null and approved_by_account_id is not null)
  or (authorised_by = 'member_fresh_code'
      and dual_control_request_id is null and approved_by_account_id is null
      and request_type = 'erasure'));

alter table privacy.request_executions drop constraint if exists request_executions_access_columns;
alter table privacy.request_executions add constraint request_executions_access_columns
  check (request_type in ('access', 'erasure') or notification_message_id is null);

-- RG79 and D72: an erasure closes once GoTrue no longer knows the person AND its confirmation
-- e-mail left with its messageId (EC-DZ-6)
alter table privacy.request_executions drop constraint if exists request_executions_erasure_completion;
alter table privacy.request_executions add constraint request_executions_erasure_completion
  check (request_type <> 'erasure' or completed_at is null
         or (auth_user_deleted_at is not null and notification_message_id is not null))
  not valid;
do $$
begin
  if not exists (select 1 from privacy.request_executions e
                  where e.request_type = 'erasure' and e.completed_at is not null
                    and e.notification_message_id is null) then
    alter table privacy.request_executions validate constraint request_executions_erasure_completion;
  end if;
end
$$;

comment on table privacy.request_executions is
  'One row per data subject request authorised for execution (15 RG75 step 6, RG76; 03 P7 E-5; '
  'D72): written by backoffice.approve_data_request_execution() (admin, 2V + R, admin_dual_control) '
  'or by identity.submit_member_erasure() (the member, fresh code, member_fresh_code, erasure only), '
  'then by the E-5 functions of the worker (execution, GoTrue deletion, closure). 15 RG85: with the '
  'request, the proof of the treatment (who authorised it, the instants, messageId). Never deleted '
  '(trigger); FORCE RLS.';
comment on column privacy.request_executions.authorised_by is
  'D72, immutable: admin_dual_control (an admin under 2V + R: dual_control_request_id and '
  'approved_by_account_id set) or member_fresh_code (the member, fresh code account_deletion, on a '
  'self-service erasure: both NULL). Rows before 0150: admin_dual_control.';
comment on column privacy.request_executions.dual_control_request_id is
  'admin_dual_control only: the 2V request privacy.approve_data_request {request_id, request_type} '
  'consumed by the approval (its two instants). NULL for member_fresh_code.';
comment on column privacy.request_executions.approved_by_account_id is
  'admin_dual_control only: the admin who consumed the 2V (never the subject, RG36). NULL for '
  'member_fresh_code (the subject authorised it himself).';
comment on column privacy.request_executions.approved_at is
  'The authorisation instant: the 2V consumed, or the member''s fresh code consumed (D72).';
comment on column privacy.request_executions.notification_message_id is
  'Brevo messageId of the e-mail that answers the request, copied at the closure: privacy.export_ready '
  '(access, 15 RG85) or privacy.erasure_completed (erasure, D72, art. 12(3)). Never shown in the '
  'backoffice, never in the register.';

-- 2.1 The guards (SECURITY INVOKER, owned by the migration role as in 0137) -------------------------

create or replace function privacy.prepare_request_execution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- D72, EC-DZ-1: a member authorises only a request he deposited from the member space
  if new.authorised_by = 'member_fresh_code'
     and not exists (select 1 from backoffice.data_subject_requests d
                      where d.id = new.request_id and d.channel = 'self_service') then
    raise exception 'a member authorises a self-service request only' using errcode = 'check_violation';
  end if;
  new.approved_at             := pg_catalog.now();
  new.executed_at             := null;
  new.propagation_email       := null;
  new.auth_user_deleted_at    := null;
  new.notification_message_id := null;
  new.completed_at            := null;
  new.created_at              := pg_catalog.now();
  new.updated_at              := pg_catalog.now();
  return new;
end
$$;

comment on function privacy.prepare_request_execution() is
  'BEFORE INSERT on privacy.request_executions: approved_at = now(), every later column empty; a '
  'member_fresh_code row needs a self_service request (23514, EC-DZ-1, read as the inserting role). '
  'SECURITY INVOKER.';

create or replace function privacy.guard_request_execution_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.completed_at is not null then
    raise exception 'a closed execution is frozen' using errcode = 'insufficient_privilege';
  end if;
  if new.request_id                 is distinct from old.request_id
     or new.request_type            is distinct from old.request_type
     or new.account_id              is distinct from old.account_id
     or new.authorised_by           is distinct from old.authorised_by
     or new.dual_control_request_id is distinct from old.dual_control_request_id
     or new.approved_by_account_id  is distinct from old.approved_by_account_id
     or new.approved_at             is distinct from old.approved_at
     or new.created_at              is distinct from old.created_at then
    raise exception 'immutable execution column' using errcode = 'insufficient_privilege';
  end if;
  -- write-once instants, stamped with the transaction time
  if old.executed_at is not null and new.executed_at is distinct from old.executed_at
     or old.auth_user_deleted_at is not null
        and new.auth_user_deleted_at is distinct from old.auth_user_deleted_at
     or old.notification_message_id is not null
        and new.notification_message_id is distinct from old.notification_message_id then
    raise exception 'an execution instant is written once' using errcode = 'insufficient_privilege';
  end if;
  if old.executed_at is null and new.executed_at is not null then
    new.executed_at := pg_catalog.now();
  end if;
  if old.auth_user_deleted_at is null and new.auth_user_deleted_at is not null then
    new.auth_user_deleted_at := pg_catalog.now();
  end if;
  if new.completed_at is not null then
    new.completed_at := pg_catalog.now();
  end if;
  -- the held address: written with the execution only, then only cleared
  if new.propagation_email is distinct from old.propagation_email
     and not (new.propagation_email is null
              or (old.propagation_email is null and old.executed_at is null
                  and new.executed_at is not null)) then
    raise exception 'the held address is written with the execution, then only cleared'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function privacy.guard_request_execution_update() is
  'BEFORE UPDATE on privacy.request_executions: a closed row is frozen; the authorisation (who, 2V, '
  'approver, instant) never changes; executed_at, auth_user_deleted_at, notification_message_id are '
  'written once (instants = now()); propagation_email is written with the execution, then only '
  'cleared. SECURITY INVOKER, reads nothing.';

revoke all on function privacy.prepare_request_execution()      from public;
revoke all on function privacy.guard_request_execution_update() from public;

-- 3. Rights --------------------------------------------------------------------------------------------
-- FORCE ROW LEVEL SECURITY on every table below: each right comes with its policy.

-- 3.1 influx_identity_definer: the member's authorisation (never UPDATE nor DELETE)
grant insert (authorised_by) on privacy.request_executions to influx_identity_definer;

drop policy if exists request_executions_identity_definer_insert on privacy.request_executions;
create policy request_executions_identity_definer_insert on privacy.request_executions
  for insert to influx_identity_definer
  with check (executed_at is null and completed_at is null
              and ((authorised_by = 'admin_dual_control'
                    and approved_by_account_id = (select influx.current_account_id()))
                   or (authorised_by = 'member_fresh_code'
                       and request_type = 'erasure'
                       and account_id = (select influx.current_account_id())
                       and approved_by_account_id is null
                       and dual_control_request_id is null)));

-- 3.2 Agent and admin: who authorised it, on the account sheet (§2.5), in aal2
grant select (authorised_by) on privacy.request_executions to influx_agent, influx_admin;

-- 3.3 influx_privacy_definer: the withdrawn access request (EC-DZ-4), the e-mail of the erasure
drop policy if exists data_subject_requests_privacy_definer_update on backoffice.data_subject_requests;
create policy data_subject_requests_privacy_definer_update on backoffice.data_subject_requests
  for update to influx_privacy_definer
  using (status <> 'closed'
         and (exists (select 1 from privacy.request_executions e
                       where e.request_id = data_subject_requests.id)
              or (request_type = 'access'
                  and exists (select 1 from identity.accounts a
                               where a.id = data_subject_requests.requester_account_id
                                 and a.status = 'deleted'))))
  with check ((exists (select 1 from privacy.request_executions e
                        where e.request_id = data_subject_requests.id)
               and (status <> 'closed' or outcome_code = 'satisfaite'))
              or (request_type = 'access' and status = 'closed'
                  and outcome_code = 'retiree_par_le_demandeur'
                  and exists (select 1 from identity.accounts a
                               where a.id = data_subject_requests.requester_account_id
                                 and a.status = 'deleted')));

drop policy if exists outbox_events_privacy_definer_select on leads.outbox_events;
create policy outbox_events_privacy_definer_select on leads.outbox_events
  for select to influx_privacy_definer
  using (event_type in ('account.deleted', 'privacy.export_ready', 'privacy.erasure_completed'));

drop policy if exists outbox_events_privacy_definer_insert on leads.outbox_events;
create policy outbox_events_privacy_definer_insert on leads.outbox_events
  for insert to influx_privacy_definer
  with check (status = 'pending' and attempts = 0 and not dry_run
              and ((event_type = 'account.deleted' and priority = 0
                    and destination in ('brevo_contact', 'apollo_contact'))
                   or (event_type in ('privacy.export_ready', 'privacy.erasure_completed')
                       and priority = 100 and destination = 'brevo_transactional')));

-- 4. identity.submit_member_erasure(), as influx_identity_definer ------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;
set role influx_identity_definer;

create or replace function identity.submit_member_erasure()
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
  -- the account and the session come from the transaction context (03 P2), never a parameter
  v_account  uuid := influx.current_account_id();
  v_session  uuid := influx.current_session_id();
  v_id       uuid;
  v_status   text;
  v_revoked  integer;
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from identity.accounts a where a.id = v_account and a.status = 'active' for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- 1. RG57: the fresh code account_deletion of THIS session, consumed here (55000 otherwise:
  -- the whole transaction fails, nothing is written)
  perform identity.consume_member_reauthentication(v_session, 'account_deletion');

  -- An open erasure of the account: returned as it is (one open request per member and type).
  select r.id, r.status::text
    into v_id, v_status
    from backoffice.data_subject_requests r
   where r.requester_account_id = v_account
     and r.request_type = 'erasure'
     and r.status <> 'closed';
  if found then
    return query select v_id, v_status, false;
    return;
  end if;

  -- 2. the request, self_service (policy of 0120), in_progress, due_at unchanged (RG73)
  insert into backoffice.data_subject_requests (request_type, requester_account_id)
  values ('erasure', v_account)
  returning id into v_id;
  update backoffice.data_subject_requests set status = 'in_progress' where id = v_id;

  -- 3. the authorisation by the member: no 2V, no approver (D72)
  insert into privacy.request_executions (request_id, request_type, account_id, authorised_by)
  values (v_id, 'erasure', v_account, 'member_fresh_code');

  -- 4. every session of the account closed, as "close all sessions" (03 A-12)
  update identity.sessions s
     set revoked_at = pg_catalog.now(), revocation_reason = 'revoked_by_holder'
   where s.account_id = v_account
     and s.revoked_at is null;
  get diagnostics v_revoked = row_count;

  -- 5. the register, never an address; no acknowledgement e-mail for an erasure (§2.1 point 6).
  -- Last: the chain lock is held until COMMIT (04 §7.2).
  perform audit.append('privacy.request_received', 'data_subject_request', v_id,
                       pg_catalog.jsonb_build_object('request_type', 'erasure'));
  perform audit.append('privacy.execution_authorised_by_member', 'data_subject_request', v_id,
                       pg_catalog.jsonb_build_object('request_type', 'erasure',
                                                     'sessions_revoked', v_revoked));
  return query select v_id, 'in_progress'::text, true;
end
$$;

comment on function identity.submit_member_erasure() is
  'D72 (zone-de-danger-fiche §2.1): an active advertiser or creator, on the session of the request '
  '(influx.current_session_id()), authorises the erasure of his own account with a fresh code '
  'account_deletion (RG57, consumed; 55000 without it, nothing written). If an erasure is open, '
  'returns it (created = false, nothing else written). Otherwise, in ONE transaction: the request '
  '(self_service, due in 30 days) in_progress; privacy.request_executions member_fresh_code (no 2V, '
  'no approver); every open session of the account revoked revoked_by_holder; the register lines '
  'privacy.request_received {request_type} and privacy.execution_authorised_by_member {request_type, '
  'sessions_revoked}; no e-mail. Returns (request id, status, created). 42501 outside an active '
  'member account. SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for '
  'influx_advertiser and influx_creator.';

revoke all on function identity.submit_member_erasure() from public, anon, authenticated, service_role;
grant execute on function identity.submit_member_erasure() to influx_advertiser, influx_creator;

reset role;
revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5. E-5 recreated by its owner, and the read of the address (DZ-3), as influx_privacy_definer --------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 5.1 The work of the worker (0137, + EC-DZ-3) ------------------------------------------------------
create or replace function privacy.pending_work(p_limit integer)
returns table (
  request_id          uuid,
  request_type        text,
  step                text,
  account_id          uuid,
  preferred_language  text,
  auth_user_id        uuid
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_limit is null or p_limit not between 1 and 100 then
    raise exception 'the batch size is between 1 and 100' using errcode = 'invalid_parameter_value';
  end if;

  return query
  select e.request_id,
         e.request_type::text,
         case when e.executed_at is null then 'execute'
              when e.request_type = 'erasure' and e.auth_user_deleted_at is null then 'delete_auth_user'
              else 'complete' end,
         e.account_id,
         case when e.executed_at is null then a.preferred_language::text end,
         case when e.executed_at is not null and e.request_type = 'erasure'
                   and e.auth_user_deleted_at is null then a.auth_user_id end
    from privacy.request_executions e
    join identity.accounts a on a.id = e.account_id
    -- EC-DZ-3: a request closed meanwhile (an access withdrawn by the erasure) has nothing left
    join backoffice.data_subject_requests d on d.id = e.request_id and d.status <> 'closed'
   where e.completed_at is null
     -- EC-J8-45: an approved request whose account is no longer active waits, never retried
     and (e.executed_at is not null or a.status = 'active')
   order by e.approved_at, e.request_id
   limit p_limit;
end
$$;

comment on function privacy.pending_work(integer) is
  'E-5, the loop of the worker (03 P7): up to p_limit (1 to 100) open executions, oldest '
  'authorisation first (an admin 2V or the member''s fresh code, D72), without lock, each with its '
  'step: execute (authorised, not executed; with the UI language of the account, for the notice), '
  'delete_auth_user (erasure executed, GoTrue user not yet deleted; with its auth_user_id, on this '
  'step only), complete (executed, not closed; an erasure once its GoTrue user is deleted). An '
  'authorised request whose account is no longer active (EC-J8-45), or whose request is closed '
  '(EC-DZ-3), is left out. 22023 for another size. SECURITY DEFINER owned by influx_privacy_definer, '
  'empty search_path; EXECUTE for influx_privacy ONLY.';

-- 5.2 The execution (0137, + the withdrawn access and the e-mail of the erasure) ----------------------
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

  -- Erasure (04 §9.2, 21 §J8 point 6), restricted to the tables of Lot 1, in ONE transaction.
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

  -- 3. the legal name of an advertiser profile (NOT NULL: a neutral label, EC-J8-38)
  update profiles.advertiser_profiles set legal_name = '[deleted]' where account_id = v_account.id;

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
  '(privacy.export_document), serialised once (jsonb_pretty), stored with its SHA-256, size and 14 '
  'categories, 7 days; privacy.export_ready to brevo_transactional (P1, ids, idempotency '
  'privacy.export_ready:<request>); privacy.export_published {sha256 hex, size_bytes, categories}; '
  'returns (access, NULL). ERASURE (admin 2V or member fresh code alike): p_notice NULL (22023 '
  'otherwise); the address held in propagation_email; account deleted, anonymised, '
  'deleted+<id>@invalid, display name NULL; its sessions DELETED (EC-J8-37); legal name [deleted]; '
  'addresses replaced by the marker in email_change_requests (open ones cancelled account_deleted), '
  'email_delivery_incidents, code_delivery_reports (message cleared), transactional_sends, '
  'member_invitations; cleared in brevo_inbound_events; exports purged; an open access request '
  'closed retiree_par_le_demandeur with privacy.request_completed (EC-DZ-4); account.deleted to '
  'brevo_contact and apollo_contact (P0, ids, account.deleted:<account>); privacy.erasure_completed '
  'to brevo_transactional (P1, ids, privacy.erasure_completed:<request>); account.anonymized '
  '{request_id}; returns (erasure, auth_user_id) for the GoTrue deletion after the commit. SECURITY '
  'DEFINER owned by influx_privacy_definer, empty search_path; EXECUTE for influx_privacy ONLY.';

-- 5.3 The closure (0137, + the e-mail of the erasure, + a closed request) ------------------------------
create or replace function privacy.complete_request(p_request_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_exec        record;
  v_line        record;
  v_brevo       jsonb;
  v_apollo      jsonb;
  v_ever        boolean;
  v_success_at  timestamptz;
  v_message_id  text;
  v_payload     jsonb;
begin
  select e.request_id, e.request_type, e.account_id, e.auth_user_deleted_at
    into v_exec
    from privacy.request_executions e
   where e.request_id = p_request_id
     and e.executed_at is not null
     and e.completed_at is null
     for update skip locked;
  if not found then
    return null;
  end if;

  -- EC-DZ-3: a request closed meanwhile (an access withdrawn by the erasure) is never closed again
  perform 1 from backoffice.data_subject_requests d
   where d.id = p_request_id and d.status <> 'closed'
     for update;
  if not found then
    return null;
  end if;

  if v_exec.request_type = 'erasure' then
    -- RG79: GoTrue no longer knows the person, Brevo confirmed, Apollo confirmed or never held it
    if v_exec.auth_user_deleted_at is null then
      return null;
    end if;

    select o.status, o.dry_run, o.skip_reason
      into v_line
      from leads.outbox_events o
     where o.event_type = 'account.deleted'
       and o.destination = 'brevo_contact'
       and o.subject_key = 'account:' || v_exec.account_id::text
       and o.payload ->> 'request_id' = p_request_id::text
     order by o.id desc
     limit 1;
    if not found or v_line.status <> 'succeeded' or v_line.dry_run then
      return null;
    end if;
    v_brevo := pg_catalog.jsonb_build_object('status', v_line.status, 'skip_reason', v_line.skip_reason);

    select o.status, o.dry_run, o.skip_reason, o.created_at
      into v_line
      from leads.outbox_events o
     where o.event_type = 'account.deleted'
       and o.destination = 'apollo_contact'
       and o.subject_key = 'account:' || v_exec.account_id::text
       and o.payload ->> 'request_id' = p_request_id::text
     order by o.id desc
     limit 1;
    if not found then
      return null;
    end if;
    select s.last_success_at into v_success_at
      from leads.contact_sync_states s
     where s.account_id = v_exec.account_id and s.destination = 'apollo_contact';
    -- held before the erasure: a success that is not the deletion's own
    v_ever := v_success_at is not null
              and (v_line.status <> 'succeeded' or v_line.dry_run or v_success_at < v_line.created_at);
    -- EC-J8-43: a live success is a confirmed deletion; a skip closes only if Apollo never held
    -- the contact (contact_sync_states.last_success_at NULL); otherwise a manual follow-up
    if not ((v_line.status = 'succeeded' and not v_line.dry_run)
            or (v_line.status = 'skipped' and v_success_at is null)) then
      return null;
    end if;
    v_apollo := pg_catalog.jsonb_build_object('status', v_line.status, 'skip_reason', v_line.skip_reason,
                                              'ever_synced', v_ever);

    -- D72: the e-mail privacy.erasure_completed left live, with its provider id (art. 12(3))
    select o.provider_message_id
      into v_message_id
      from leads.outbox_events o
     where o.event_type = 'privacy.erasure_completed'
       and o.destination = 'brevo_transactional'
       and o.subject_key = 'account:' || v_exec.account_id::text
       and o.payload ->> 'request_id' = p_request_id::text
       and o.status = 'succeeded'
       and not o.dry_run
       and o.provider_message_id is not null
     order by o.id desc
     limit 1;
    if not found then
      return null;
    end if;
    v_payload := pg_catalog.jsonb_build_object('request_type', 'erasure', 'outcome_code', 'satisfaite',
                                               'brevo', v_brevo, 'apollo', v_apollo);
  else
    -- RG85: the e-mail "export ready" left, with its provider id
    select o.provider_message_id
      into v_message_id
      from leads.outbox_events o
     where o.event_type = 'privacy.export_ready'
       and o.destination = 'brevo_transactional'
       and o.subject_key = 'account:' || v_exec.account_id::text
       and o.payload ->> 'request_id' = p_request_id::text
       and o.status = 'succeeded'
       and not o.dry_run
       and o.provider_message_id is not null
     order by o.id desc
     limit 1;
    if not found then
      return null;
    end if;
    v_payload := pg_catalog.jsonb_build_object('request_type', 'access', 'outcome_code', 'satisfaite');
  end if;

  -- 15 RG77: closed satisfaite (completed_at by the trigger of 0120)
  update backoffice.data_subject_requests
     set status = 'closed', outcome_code = 'satisfaite'
   where id = p_request_id;

  update privacy.request_executions
     set completed_at            = pg_catalog.now(),
         propagation_email       = null,
         notification_message_id = coalesce(v_message_id, notification_message_id)
   where request_id = p_request_id;

  -- last: the chain lock is held until COMMIT; never the message id, never an address
  perform audit.append('privacy.request_completed', 'data_subject_request', p_request_id, v_payload);
  return 'satisfaite';
end
$$;

comment on function privacy.complete_request(uuid) is
  'E-5, the closure (15 RG75 step 7, RG77, RG79, RG85; D72): on an executed, open row (FOR UPDATE '
  'SKIP LOCKED) of a request still open (EC-DZ-3). ERASURE: GoTrue user deleted, the account.deleted '
  'line to brevo_contact succeeded and not dry_run, the one to apollo_contact succeeded live or '
  'skipped while Apollo never held the contact (EC-J8-43), and the privacy.erasure_completed line '
  'succeeded, not dry_run, with its messageId. ACCESS: the privacy.export_ready line succeeded, not '
  'dry_run, with its messageId. The messageId copied to notification_message_id; then the request '
  'closed satisfaite, completed_at, the held address cleared, privacy.request_completed '
  '{request_type, outcome_code[, brevo {status, skip_reason}, apollo {status, skip_reason, '
  'ever_synced}]}; returns satisfaite. NULL when not closable yet (or nothing to close). SECURITY '
  'DEFINER owned by influx_privacy_definer, empty search_path; EXECUTE for influx_privacy ONLY.';

-- 5.4 DZ-3: the address of the confirmation e-mail -----------------------------------------------------
create or replace function privacy.read_erasure_notification_subject(p_request_id uuid)
returns table (
  email               text,
  preferred_language  text,
  time_zone           text,
  erased_at           timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- only while the address is held: an executed erasure, not closed (EC-J8-46)
  return query
  select e.propagation_email, a.preferred_language::text, a.timezone, e.executed_at
    from privacy.request_executions e
    join identity.accounts a on a.id = e.account_id
   where e.request_id = p_request_id
     and e.request_type = 'erasure'
     and e.executed_at is not null
     and e.completed_at is null
     and e.propagation_email is not null;
end
$$;

comment on function privacy.read_erasure_notification_subject(uuid) is
  'DZ-3 (D72, validated by architecte on 2026-10-27), modelled on leads.read_brevo_erasure_subject(): '
  'for the e-mail privacy.erasure_completed of an erasure, the address held since its execution '
  '(privacy.request_executions.propagation_email), the UI language and the time zone of the account, '
  'and the instant of the erasure (executed_at, EC-DZ-5). One row only if the execution exists, is an '
  'erasure, is executed, not closed and still holds the address; no row otherwise. Never a direct '
  'SELECT on the column. SECURITY DEFINER owned by influx_privacy_definer, empty search_path; EXECUTE '
  'for influx_privacy ONLY.';

revoke all on function privacy.read_erasure_notification_subject(uuid)
  from public, anon, authenticated, service_role;
grant execute on function privacy.read_erasure_notification_subject(uuid) to influx_privacy;

reset role;
revoke create on schema privacy from influx_privacy_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_privacy_definer', current_user);
end
$$;

-- 6. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('identity.submit_member_erasure()', 'influx_identity_definer',
        array['influx_advertiser', 'influx_creator']),
      ('privacy.pending_work(integer)', 'influx_privacy_definer', array['influx_privacy']),
      ('privacy.execute_request(uuid, jsonb)', 'influx_privacy_definer', array['influx_privacy']),
      ('privacy.complete_request(uuid)', 'influx_privacy_definer', array['influx_privacy']),
      ('privacy.read_erasure_notification_subject(uuid)', 'influx_privacy_definer',
        array['influx_privacy'])
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

  -- F7 of the J8 review: influx_privacy_definer owns exactly the E-5 list, now ten functions
  if (select count(*) from pg_catalog.pg_proc p
       where p.proowner = 'influx_privacy_definer'::regrole) <> 10 then
    raise exception 'influx_privacy_definer must own exactly the ten functions of E-5';
  end if;

  -- §2.4: no member role writes privacy.request_executions, in any way
  select string_agg(r.rolname || ' ' || priv, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['INSERT', 'UPDATE', 'DELETE']) as priv
   where r.rolname in ('influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin',
                       'influx_privacy', 'influx_worker', 'influx_auth')
     and (pg_catalog.has_table_privilege(r.oid, 'privacy.request_executions', priv)
          or (priv <> 'DELETE'
              and pg_catalog.has_any_column_privilege(r.oid, 'privacy.request_executions', priv)));
  if v_bad is not null then
    raise exception 'privacy.request_executions writable by: %', v_bad;
  end if;

  -- architecte (a): the identity owner inserts, never updates nor deletes the executions
  if pg_catalog.has_any_column_privilege('influx_identity_definer', 'privacy.request_executions',
                                         'UPDATE')
     or pg_catalog.has_table_privilege('influx_identity_definer', 'privacy.request_executions',
                                       'DELETE')
     or not pg_catalog.has_column_privilege('influx_identity_definer', 'privacy.request_executions',
                                            'authorised_by', 'INSERT') then
    raise exception 'influx_identity_definer: INSERT (authorised_by) only on privacy.request_executions';
  end if;

  -- the held address stays readable by its owner only
  if pg_catalog.has_column_privilege('influx_admin', 'privacy.request_executions', 'propagation_email',
                                     'SELECT')
     or pg_catalog.has_column_privilege('influx_agent', 'privacy.request_executions',
                                        'propagation_email', 'SELECT')
     or pg_catalog.has_column_privilege('influx_privacy', 'privacy.request_executions',
                                        'propagation_email', 'SELECT') then
    raise exception 'the held address is readable beyond influx_privacy_definer';
  end if;

  if (select count(*) from audit.event_types
       where code in ('privacy.execution_authorised_by_member', 'privacy.erasure_completed')) <> 2 then
    raise exception 'the two codes of 0150 are not all in audit.event_types';
  end if;
end
$$;
