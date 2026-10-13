-- =============================================================================
-- 0120_backoffice_data_requests_and_delivery_reports
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 2. Decision 6 of the J7 start (architect, 2026-10-09): EC-14,
-- 05 RG57, RG65; 15 RG75 to RG77; 04 §5 (backoffice.data_subject_requests, which 0502
-- completes at Lot 5).
--
--   backoffice.data_subject_requests   MINIMAL: id, request_type (six values, only
--         access and erasure exposed at J7), requester_account_id, channel
--         (self_service only for now), received_at, due_at (received + 30 days,
--         computed), status, completed_at, outcome_code (15 RG77). One open request
--         per (account, type). Execution is manual, by an admin, along a written
--         procedure (EC-14); "delete my account" is a REQUEST at J7.
--   backoffice.submit_data_subject_request()   member, needs the marker of decision 4
--         (access => data_export, erasure => account_deletion), consumed here; queues the
--         acknowledgement privacy.request_received (P1, payload = ids, EC-8: NULL
--         template => skipped template_not_configured) and writes the register line
--         privacy.request_received.
--   backoffice.code_delivery_reports   the rescue channel without sign-in (05 RG65):
--         "I do not receive my code". Never a code, never a session, never an e-mail
--         from here; the answer of the route is identical whatever the addresses.
--   backoffice.record_code_delivery_report()   E-1 support.report_delivery_issue,
--         influx_auth ONLY; returns the report id, the subject of
--         elevated.support.report_delivery_issue. Rate limited by apps/api on the
--         delivery_report_* counters of identity.auth_request_throttle (0115).
--
-- due_at is not a GENERATED column: PostgreSQL refuses timestamptz arithmetic there (not
-- immutable). It is computed by a BEFORE INSERT trigger and held by a CHECK, which gives
-- the same guarantee: no writer chooses it.
--
-- Not here: the admin write path of a request (status, outcome, 0502 at Lot 5), the
-- handling of a report by an agent (Lot 5), their retention (expert-conformite-rgpd,
-- Lot 6), the route and the template (commit 8).
--
-- ROLLBACK (before any real request or report): drop the two functions; drop table
-- backoffice.code_delivery_reports, backoffice.data_subject_requests; drop the four
-- trigger functions backoffice.prepare_data_subject_request(),
-- backoffice.guard_data_subject_request_update(),
-- backoffice.prepare_code_delivery_report(), backoffice.guard_code_delivery_report_update();
-- drop the five types created here; revoke usage on schema backoffice from
-- influx_advertiser, influx_creator, influx_auth, influx_identity_definer; restore the
-- 0119 policy outbox_events_identity_definer_insert; remove the key
-- privacy.request_received from brevo_template_ids.
-- =============================================================================

-- 1. Types ----------------------------------------------------------------------------------

do $$
begin
  create type backoffice.data_request_type as enum (
    'access', 'rectification', 'erasure', 'portability', 'objection', 'restriction');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type backoffice.data_request_channel as enum ('self_service');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type backoffice.data_request_status as enum ('received', 'in_progress', 'closed');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type backoffice.data_request_outcome as enum (
    'satisfaite', 'satisfaite_partiellement', 'refusee', 'sans_objet', 'retiree_par_le_demandeur');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type backoffice.code_delivery_report_status as enum ('received', 'handled');
exception when duplicate_object then null;
end
$$;

comment on type backoffice.data_request_type is
  'The six rights of a data subject (04 §5). Only access and erasure can be deposited from the '
  'member space at J7 (decision 6); the others arrive with 0502 (other channels).';
comment on type backoffice.data_request_channel is
  'self_service only at J7 (deposit from the member space); 0502 adds email and oral_consigne.';
comment on type backoffice.data_request_status is
  'received (deposited), in_progress (being instructed), closed (with an outcome, 15 RG77).';
comment on type backoffice.data_request_outcome is
  'Closed list of 15 RG77: satisfaite, satisfaite_partiellement (with what is not satisfied and why), '
  'refusee, sans_objet (data not held), retiree_par_le_demandeur.';
comment on type backoffice.code_delivery_report_status is
  'received, then handled by the support (Lot 5 screen).';

-- 2. backoffice.data_subject_requests -----------------------------------------------------------

create table if not exists backoffice.data_subject_requests (
  id                    uuid        not null default gen_random_uuid() primary key,
  request_type          backoffice.data_request_type not null,
  requester_account_id  uuid        references identity.accounts (id),
  channel               backoffice.data_request_channel not null default 'self_service',
  received_at           timestamptz not null default now(),
  due_at                timestamptz not null,
  status                backoffice.data_request_status not null default 'received',
  completed_at          timestamptz,
  outcome_code          backoffice.data_request_outcome,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- the legal deadline of one month, written as 30 days in hours (time-zone independent)
  constraint data_subject_requests_due check (due_at = received_at + interval '720 hours'),
  constraint data_subject_requests_self_service_member
    check (channel <> 'self_service' or requester_account_id is not null),
  constraint data_subject_requests_closed_pair
    check ((status = 'closed') = (completed_at is not null)
           and (status = 'closed') = (outcome_code is not null)),
  constraint data_subject_requests_completion_order
    check (completed_at is null or completed_at >= received_at)
);

comment on table backoffice.data_subject_requests is
  'Data subject requests (decision 6 of J7, EC-14; 15 RG75 to RG80). MINIMAL at J7, completed by '
  '0502 (requester address, identity check, scope, refusal reason, response). Deposited from the '
  'member space by backoffice.submit_data_subject_request() only; executed by hand by an admin '
  'along a written procedure. Never deleted (trigger).';
comment on column backoffice.data_subject_requests.requester_account_id is
  'The member who deposited it. Nullable for 0502 (a requester is not always a member); required '
  'for self_service by constraint.';
comment on column backoffice.data_subject_requests.due_at is
  'received_at + 30 days (720 hours), computed by the BEFORE INSERT trigger and held by a CHECK '
  '(a GENERATED column cannot hold timestamptz arithmetic).';

create unique index if not exists data_subject_requests_open_idx
  on backoffice.data_subject_requests (requester_account_id, request_type)
  where status <> 'closed';
comment on index backoffice.data_subject_requests_open_idx is
  'One open request per (member, type): a second deposit returns the open one (no second '
  'acknowledgement). Also the lookup of the deposit function.';

create or replace function backoffice.prepare_data_subject_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.received_at  := pg_catalog.now();
  new.due_at       := pg_catalog.now() + interval '720 hours';
  new.created_at   := pg_catalog.now();
  new.updated_at   := pg_catalog.now();
  new.status       := 'received';
  new.completed_at := null;
  new.outcome_code := null;
  return new;
end
$$;

comment on function backoffice.prepare_data_subject_request() is
  'BEFORE INSERT on backoffice.data_subject_requests: received_at = now(), due_at = now() + 30 days, '
  'status received. SECURITY INVOKER, reads nothing.';

create or replace function backoffice.guard_data_subject_request_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.status = 'closed' then
    raise exception 'a closed data subject request is frozen' using errcode = 'insufficient_privilege';
  end if;
  if new.id is distinct from old.id
     or new.request_type         is distinct from old.request_type
     or new.requester_account_id is distinct from old.requester_account_id
     or new.channel              is distinct from old.channel
     or new.received_at          is distinct from old.received_at
     or new.due_at               is distinct from old.due_at
     or new.created_at           is distinct from old.created_at then
    raise exception 'immutable data subject request column' using errcode = 'insufficient_privilege';
  end if;
  if new.status = 'closed' then
    new.completed_at := pg_catalog.now();
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function backoffice.guard_data_subject_request_update() is
  'BEFORE UPDATE on backoffice.data_subject_requests: a closed request is frozen; type, requester, '
  'channel and dates never change; completed_at = now() at closing. No writer at J7 (0502). '
  'SECURITY INVOKER, reads nothing.';

revoke all on function backoffice.prepare_data_subject_request()      from public;
revoke all on function backoffice.guard_data_subject_request_update() from public;

drop trigger if exists data_subject_requests_prepare on backoffice.data_subject_requests;
create trigger data_subject_requests_prepare
  before insert on backoffice.data_subject_requests
  for each row execute function backoffice.prepare_data_subject_request();

drop trigger if exists data_subject_requests_guard_update on backoffice.data_subject_requests;
create trigger data_subject_requests_guard_update
  before update on backoffice.data_subject_requests
  for each row execute function backoffice.guard_data_subject_request_update();

drop trigger if exists data_subject_requests_no_delete on backoffice.data_subject_requests;
create trigger data_subject_requests_no_delete
  before delete on backoffice.data_subject_requests
  for each row execute function influx.assert_append_only();

drop trigger if exists data_subject_requests_no_truncate on backoffice.data_subject_requests;
create trigger data_subject_requests_no_truncate
  before truncate on backoffice.data_subject_requests
  for each statement execute function influx.assert_append_only();

-- 3. backoffice.code_delivery_reports ----------------------------------------------------------------

create table if not exists backoffice.code_delivery_reports (
  id             uuid        not null default gen_random_uuid() primary key,
  received_at    timestamptz not null default now(),
  login_email    text        not null,
  contact_email  text        not null,
  message        text,
  locale         char(2)     not null,
  locale_is_ui   boolean     not null generated always as (true) stored,
  status         backoffice.code_delivery_report_status not null default 'received',
  handled_at     timestamptz,

  constraint code_delivery_reports_emails_normalized check (
    login_email = lower(login_email) and position('@' in login_email) > 1
    and length(login_email) <= 320
    and contact_email = lower(contact_email) and position('@' in contact_email) > 1
    and length(contact_email) <= 320),
  -- one text of at most 500 characters; line feeds allowed, no other control character
  constraint code_delivery_reports_message_bounded
    check (length(message) between 1 and 500 and message !~ '[\x01-\x09\x0b-\x1f\x7f]'),
  constraint code_delivery_reports_locale_ui_fk
    foreign key (locale, locale_is_ui) references reference.languages (code, is_ui_language),
  constraint code_delivery_reports_handled_pair
    check ((status = 'handled') = (handled_at is not null)),
  constraint code_delivery_reports_handled_order
    check (handled_at is null or handled_at >= received_at)
);

comment on table backoffice.code_delivery_reports is
  'The rescue channel without sign-in (05 RG65, decision 6 of J7): "I do not receive my sign-in '
  'code", from another address. Feeds a backoffice queue. It NEVER gives a code nor a session, NEVER '
  'sends an e-mail by itself, NEVER puts two members in touch; the route answers the same whatever '
  'the addresses (floor of 1000 ms). Written by backoffice.record_code_delivery_report() only. '
  'Personal data: two addresses and a free text; retention to be fixed (Lot 6).';
comment on column backoffice.code_delivery_reports.login_email is
  'The address the person signs in with, lower case. Never looked up at writing: the report says '
  'nothing about whether an account exists.';
comment on column backoffice.code_delivery_reports.contact_email is
  'The address the support may answer to, lower case.';
comment on column backoffice.code_delivery_reports.message is
  'Optional free text, 1 to 500 characters, control characters (but line feeds) replaced.';
comment on column backoffice.code_delivery_reports.locale is
  'Language of the form, a UI language (composite foreign key, as identity.accounts).';
comment on column backoffice.code_delivery_reports.locale_is_ui is
  'Always true. Only exists to carry the composite foreign key towards the UI languages.';

create or replace function backoffice.guard_code_delivery_report_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.received_at   is distinct from old.received_at
     or new.login_email   is distinct from old.login_email
     or new.contact_email is distinct from old.contact_email
     or new.message       is distinct from old.message
     or new.locale        is distinct from old.locale then
    raise exception 'a delivery report is append-only' using errcode = 'insufficient_privilege';
  end if;
  if old.status = 'handled' and new.status is distinct from old.status then
    raise exception 'a handled report stays handled' using errcode = 'insufficient_privilege';
  end if;
  if new.status = 'handled' and old.status <> 'handled' then
    new.handled_at := pg_catalog.now();
  elsif new.handled_at is distinct from old.handled_at then
    raise exception 'handled_at moves with the status only' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function backoffice.guard_code_delivery_report_update() is
  'BEFORE UPDATE on backoffice.code_delivery_reports: the report never changes; the status goes '
  'from received to handled once, handled_at = now(). No writer at J7 (Lot 5). SECURITY INVOKER, '
  'reads nothing.';

create or replace function backoffice.prepare_code_delivery_report()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.received_at := pg_catalog.now();
  new.status      := 'received';
  new.handled_at  := null;
  return new;
end
$$;

comment on function backoffice.prepare_code_delivery_report() is
  'BEFORE INSERT on backoffice.code_delivery_reports: received_at = now(), status received. '
  'SECURITY INVOKER, reads nothing.';

revoke all on function backoffice.guard_code_delivery_report_update() from public;
revoke all on function backoffice.prepare_code_delivery_report()      from public;

drop trigger if exists code_delivery_reports_prepare on backoffice.code_delivery_reports;
create trigger code_delivery_reports_prepare
  before insert on backoffice.code_delivery_reports
  for each row execute function backoffice.prepare_code_delivery_report();

drop trigger if exists code_delivery_reports_guard_update on backoffice.code_delivery_reports;
create trigger code_delivery_reports_guard_update
  before update on backoffice.code_delivery_reports
  for each row execute function backoffice.guard_code_delivery_report_update();

drop trigger if exists code_delivery_reports_no_delete on backoffice.code_delivery_reports;
create trigger code_delivery_reports_no_delete
  before delete on backoffice.code_delivery_reports
  for each row execute function influx.assert_append_only();

drop trigger if exists code_delivery_reports_no_truncate on backoffice.code_delivery_reports;
create trigger code_delivery_reports_no_truncate
  before truncate on backoffice.code_delivery_reports
  for each statement execute function influx.assert_append_only();

alter table backoffice.data_subject_requests enable row level security;
alter table backoffice.data_subject_requests force  row level security;
alter table backoffice.code_delivery_reports enable row level security;
alter table backoffice.code_delivery_reports force  row level security;
revoke all on backoffice.data_subject_requests, backoffice.code_delivery_reports
  from public, anon, authenticated, service_role;

-- 4. The functions ------------------------------------------------------------------------------------

-- 4.1 The deposit from the member space -----------------------------------------------------------------

create or replace function backoffice.submit_data_subject_request(
  p_session_id    uuid,
  p_request_type  backoffice.data_request_type
)
returns table (
  request_id  uuid,
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
  v_id       uuid;
  v_fact     uuid := pg_catalog.gen_random_uuid();
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- decision 6: only these two are exposed at J7
  if p_request_type is null or p_request_type not in ('access', 'erasure') then
    raise exception 'access or erasure only' using errcode = 'invalid_parameter_value';
  end if;
  perform 1 from identity.accounts a where a.id = v_account and a.status = 'active' for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- RG57, A-10: a fresh code for THIS action (export, or deletion), consumed here.
  perform identity.consume_member_reauthentication(
    p_session_id,
    case p_request_type when 'access' then 'data_export'::identity.reauth_purpose
                        else 'account_deletion'::identity.reauth_purpose end);

  -- One open request per (member, type): a second deposit returns it, without a second e-mail.
  select r.id
    into v_id
    from backoffice.data_subject_requests r
   where r.requester_account_id = v_account
     and r.request_type = p_request_type
     and r.status <> 'closed';
  if found then
    return query select v_id, false;
    return;
  end if;

  insert into backoffice.data_subject_requests (request_type, requester_account_id)
  values (p_request_type, v_account)
  returning id into v_id;

  -- The acknowledgement, P1 through the queue; RG74: ids only; once per request by nature.
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values
    (v_fact, 'privacy.request_received', 'brevo_transactional', 'account:' || v_account::text, 100,
     pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account, 'request_id', v_id,
                                   'email_code', 'privacy.request_received'),
     'privacy.request_received:' || v_id::text);

  -- last: the chain lock is held until COMMIT (04 §7.2)
  perform audit.append('privacy.request_received', 'data_subject_request', v_id,
                       pg_catalog.jsonb_build_object('request_type', p_request_type));
  return query select v_id, true;
end
$$;

comment on function backoffice.submit_data_subject_request(uuid, backoffice.data_request_type) is
  'Decision 6 of J7, EC-14: an advertiser or creator deposits a request of access (needs the marker '
  'data_export) or erasure (needs account_deletion) on p_session_id; the marker is consumed (55000 '
  'without it). If a request of that type is open, returns it (created = false: no line, no '
  'e-mail). Otherwise, in one transaction: the request (self_service, due in 30 days), the '
  'acknowledgement privacy.request_received to brevo_transactional (priority 100, payload = ids), '
  'the register line privacy.request_received {request_type}. Returns (request id, created). 22023 '
  'for another type; 42501 outside an active member account. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and influx_creator.';

-- 4.2 E-1: the rescue channel (influx_auth) ----------------------------------------------------------------

create or replace function backoffice.record_code_delivery_report(
  p_login_email    text,
  p_contact_email  text,
  p_message        text,
  p_locale         text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_login    text := pg_catalog.lower(pg_catalog.btrim(p_login_email));
  v_contact  text := pg_catalog.lower(pg_catalog.btrim(p_contact_email));
  v_message  text;
  v_id       uuid;
begin
  if v_login is null or pg_catalog.strpos(v_login, '@') <= 1 or pg_catalog.length(v_login) > 320
     or v_login ~ '[[:space:][:cntrl:]]'
     or v_contact is null or pg_catalog.strpos(v_contact, '@') <= 1
     or pg_catalog.length(v_contact) > 320 or v_contact ~ '[[:space:][:cntrl:]]' then
    raise exception 'malformed address' using errcode = 'invalid_parameter_value';
  end if;
  if p_locale is null or p_locale !~ '^[a-z]{2}$' then
    raise exception 'malformed locale' using errcode = 'invalid_parameter_value';
  end if;
  if p_message is not null then
    v_message := pg_catalog.regexp_replace(p_message, '[\x01-\x09\x0b-\x1f\x7f]+', ' ', 'g');
    v_message := nullif(pg_catalog.btrim(v_message), '');
    if pg_catalog.length(v_message) > 500 then
      raise exception 'the message holds at most 500 characters' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  -- RG65: written, never looked up against the accounts, nothing sent from here.
  insert into backoffice.code_delivery_reports (login_email, contact_email, message, locale)
  values (v_login, v_contact, v_message, p_locale)
  returning id into v_id;
  return v_id;
end
$$;

comment on function backoffice.record_code_delivery_report(text, text, text, text) is
  'E-1 support.report_delivery_issue (decision 6 of J7, 05 RG65): writes one rescue report (both '
  'addresses normalised, message cleaned, at most 500 characters, UI locale) and nothing else - no '
  'account lookup, no code, no session, no e-mail. Returns the report id, the subject of '
  'elevated.support.report_delivery_issue. 22023 for a malformed value; 23503 for a locale that is '
  'not a UI language. The rate limit (delivery_report_* scopes) and the 1000 ms floor are apps/api''s. '
  'SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for influx_auth ONLY.';

revoke all on function backoffice.submit_data_subject_request(uuid, backoffice.data_request_type)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.record_code_delivery_report(text, text, text, text)
  from public, anon, authenticated, service_role;

grant execute on function backoffice.submit_data_subject_request(uuid, backoffice.data_request_type)
   to influx_advertiser, influx_creator;
grant execute on function backoffice.record_code_delivery_report(text, text, text, text)
   to influx_auth;

-- 5. Rights --------------------------------------------------------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy.

grant usage on schema backoffice
   to influx_advertiser, influx_creator, influx_auth, influx_identity_definer;

-- 5.1 The owner of the two functions ---------------------------------------------------------------------

grant select (id, request_type, requester_account_id, status)
   on backoffice.data_subject_requests to influx_identity_definer;
grant insert (request_type, requester_account_id)
   on backoffice.data_subject_requests to influx_identity_definer;

drop policy if exists data_subject_requests_identity_definer_select on backoffice.data_subject_requests;
create policy data_subject_requests_identity_definer_select on backoffice.data_subject_requests
  for select to influx_identity_definer
  using (true);

drop policy if exists data_subject_requests_identity_definer_insert on backoffice.data_subject_requests;
create policy data_subject_requests_identity_definer_insert on backoffice.data_subject_requests
  for insert to influx_identity_definer
  with check (channel = 'self_service' and request_type in ('access', 'erasure')
              and requester_account_id = (select influx.current_account_id()));

grant select (id) on backoffice.code_delivery_reports to influx_identity_definer;
grant insert (login_email, contact_email, message, locale)
   on backoffice.code_delivery_reports to influx_identity_definer;

drop policy if exists code_delivery_reports_identity_definer_select on backoffice.code_delivery_reports;
create policy code_delivery_reports_identity_definer_select on backoffice.code_delivery_reports
  for select to influx_identity_definer
  using (true);

drop policy if exists code_delivery_reports_identity_definer_insert on backoffice.code_delivery_reports;
create policy code_delivery_reports_identity_definer_insert on backoffice.code_delivery_reports
  for insert to influx_identity_definer
  with check (status = 'received' and handled_at is null);

drop policy if exists outbox_events_identity_definer_insert on leads.outbox_events;
create policy outbox_events_identity_definer_insert on leads.outbox_events
  for insert to influx_identity_definer
  with check (status = 'pending' and attempts = 0
              and event_type in ('lead.created', 'lead.updated', 'account.email_corrected',
                                 'email.changed', 'consent.granted', 'consent.revoked',
                                 'privacy.request_received'));

-- 5.2 Members: their own requests (the "my data" screen) -------------------------------------------------

-- requester_account_id: their own id, on their own rows only (the owner column of the T2 probes)
grant select (id, request_type, requester_account_id, channel, received_at, due_at, status,
              completed_at, outcome_code)
   on backoffice.data_subject_requests to influx_advertiser, influx_creator;

drop policy if exists data_subject_requests_member_select_own on backoffice.data_subject_requests;
create policy data_subject_requests_member_select_own on backoffice.data_subject_requests
  for select to influx_advertiser, influx_creator
  using (requester_account_id = (select influx.current_account_id()));

-- 5.3 Agent and admin: both queues, read only, in aal2 (writes: Lot 5) ------------------------------------

grant select on backoffice.data_subject_requests, backoffice.code_delivery_reports
   to influx_agent, influx_admin;

drop policy if exists data_subject_requests_internal_select on backoffice.data_subject_requests;
create policy data_subject_requests_internal_select on backoffice.data_subject_requests
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists code_delivery_reports_internal_select on backoffice.code_delivery_reports;
create policy code_delivery_reports_internal_select on backoffice.code_delivery_reports
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 5.4 EC-8: the template of the acknowledgement, not configured ----------------------------------------

update leads.sync_settings
   set value = pg_catalog.jsonb_build_object('privacy.request_received', null) || value
 where key = 'brevo_template_ids'
   and not (value ? 'privacy.request_received');

-- 6. Hand the two functions to influx_identity_definer (03 P7 rule 5, window of 0004 §9) ---------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;

alter function backoffice.submit_data_subject_request(uuid, backoffice.data_request_type)
  owner to influx_identity_definer;
alter function backoffice.record_code_delivery_report(text, text, text, text)
  owner to influx_identity_definer;

revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 7. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('backoffice.submit_data_subject_request(uuid, backoffice.data_request_type)',
       array['influx_advertiser', 'influx_creator']),
      ('backoffice.record_code_delivery_report(text, text, text, text)', array['influx_auth'])
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

  -- nobody writes the two tables directly: the functions only (writes of agent/admin: Lot 5)
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['backoffice.data_subject_requests', 'backoffice.code_delivery_reports']) t
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'unexpected write right(s): %', v_bad;
  end if;
  -- the rescue reports are never read by a member nor by influx_auth
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_agent', 'influx_admin', 'influx_identity_definer')
     and pg_catalog.has_any_column_privilege(r.oid, 'backoffice.code_delivery_reports', 'SELECT');
  if v_bad is not null then
    raise exception 'unexpected reader(s) of backoffice.code_delivery_reports: %', v_bad;
  end if;

  if not exists (select 1 from leads.sync_settings
                  where key = 'brevo_template_ids' and value ? 'privacy.request_received') then
    raise exception 'brevo_template_ids lacks privacy.request_received (EC-8)';
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
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema backoffice';
  end if;
end
$$;
