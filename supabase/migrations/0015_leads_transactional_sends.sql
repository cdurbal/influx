-- =============================================================================
-- 0015_leads_transactional_sends
-- -----------------------------------------------------------------------------
-- Lot 0 / J3, commit 6 (ex-0108 of 04 §11.2, renumbered by EC-37). The journal of
-- transactional e-mails outside introductions (04 §5.8, 16 RG94, D43), first used
-- by the sign-in code (P0), sent synchronously by apps/api (02 §18.10).
--
-- *** A JOURNAL, NEVER A QUEUE (D43, 02 §18.8) ***: no index on status, no
-- SELECT ... FOR UPDATE, no loop that reads it to decide a send, no retry from it.
-- *** NEVER THE BODY, THE SUBJECT, NOR THE CODE ***.
--
-- Corrections of 04 §5.8 applied here:
--   EC-6  template_ref is a text code (closed union of packages/contracts, 16 RG85)
--         WITHOUT foreign key until backoffice.email_templates exists (Lot 5, 0503).
--   EC-7  outbox_event_id is a bigint (outbox_events.id is a bigint), WITHOUT foreign
--         key until leads.outbox_events exists (0101, which adds it: EC-37). A P0
--         line always has it NULL (D43).
--   EC-3  reference: a random uuid (v4), carried by the login cookie and hashed into
--         the login_request throttle key; never a sequential id, which would reveal
--         the volume of sign-ins. It is also the subject of the elevated.identity.*
--         register lines of the code (21 §3 EC-52, proposal).
--   The status type is leads.email_send_status (04 named matching.email_status, a
--   schema of Lot 4); 0402c's introduction_emails reuses it.
--
-- Rights: influx_auth writes the P0 lines only (E-1, identity.request_code): insert of
-- named columns, then the outcome of the single attempt (sent or failed). The
-- delivery acknowledgement (delivered, failed after a bounce) comes from the Brevo
-- webhook through the worker (J7), with its own grant. Nobody else at J3.
--
-- Retention (RG-J3-6, 21 "Avis de conformité du J3"): a line WITH an account, 13
-- months after created_at; a line WITHOUT an account (first code of a sign-up, or an
-- address that never became an account), whose recipient_email is in clear: the
-- WHOLE LINE is deleted 30 days after created_at. Purge by the worker (E-4, J6/Lot 1).
--
-- ROLLBACK (before any real line): drop table leads.transactional_sends; drop function
-- leads.guard_transactional_send_update(); drop type leads.email_send_status,
-- leads.send_priority.
-- =============================================================================

do $$
begin
  create type leads.send_priority as enum ('p0', 'p1', 'p2');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type leads.email_send_status as enum ('queued', 'sent', 'delivered', 'failed');
exception when duplicate_object then null;
end
$$;

comment on type leads.send_priority is
  'p0 = the sign-in code and critical internal alerts: NEVER cut by the emergency switch (16 RG122). '
  'p1 and p2: service e-mails, held (never lost) when the switch is at all_paused.';
comment on type leads.email_send_status is
  'queued = attempt engaged, OUTCOME UNKNOWN (D43: nobody will pick the line up); sent = accepted by '
  'Brevo; delivered = acknowledged later by the webhook; failed = refused, timed out, circuit open, '
  'or bounced after sending.';

create table if not exists leads.transactional_sends (
  id                   bigint      generated always as identity primary key,
  reference            uuid        not null default gen_random_uuid(),
  email_code           text        not null,
  priority             leads.send_priority not null,
  account_id           uuid        references identity.accounts (id),
  recipient_email      text,
  locale               char(2)     not null references reference.languages (code),
  template_ref         text,
  template_version     integer,
  outbox_event_id      bigint,
  provider_message_id  text,
  status               leads.email_send_status not null default 'queued',
  sent_at              timestamptz,
  delivered_at         timestamptz,
  failed_at            timestamptz,
  failure_code         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint transactional_sends_reference_key          unique (reference),
  constraint transactional_sends_provider_message_id_key unique (provider_message_id),
  constraint transactional_sends_email_code_format
    check (email_code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and length(email_code) <= 80),
  constraint transactional_sends_template_ref_format
    check (template_ref ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$' and length(template_ref) <= 80),
  constraint transactional_sends_template_version_positive
    check (template_version >= 1),
  constraint transactional_sends_template_pair
    check ((template_ref is null) = (template_version is null)),
  -- same doctrine as email_send_recipients: the address is copied only when no account
  constraint transactional_sends_recipient_xor
    check ((recipient_email is not null) = (account_id is null)),
  constraint transactional_sends_recipient_normalized
    check (recipient_email = lower(recipient_email) and position('@' in recipient_email) > 1
           and length(recipient_email) <= 320),
  constraint transactional_sends_p0_no_outbox
    check (priority <> 'p0' or outbox_event_id is null),
  constraint transactional_sends_sent_needs_message_id
    check (status in ('queued', 'failed') or provider_message_id is not null),
  constraint transactional_sends_status_dates check (
         (status = 'queued'    and sent_at is null     and delivered_at is null and failed_at is null)
      or (status = 'sent'      and sent_at is not null and delivered_at is null and failed_at is null)
      or (status = 'delivered' and sent_at is not null and delivered_at is not null and failed_at is null)
      or (status = 'failed'    and delivered_at is null and failed_at is not null)),
  constraint transactional_sends_failure_pair
    check ((status = 'failed') = (failure_code is not null)),
  constraint transactional_sends_failure_code_format
    check (failure_code ~ '^[a-z][a-z0-9_]{1,62}$'),
  -- 05 RG60: three causes and three only for a P0, the three distinct messages shown
  constraint transactional_sends_p0_failure_codes
    check (priority <> 'p0' or failure_code is null
           or failure_code in ('undeliverable_address', 'provider_unavailable', 'rate_limited')),
  constraint transactional_sends_chronology
    check (coalesce(sent_at, created_at) >= created_at
           and coalesce(delivered_at, 'infinity') >= coalesce(sent_at, '-infinity')
           and coalesce(failed_at, created_at) >= created_at)
);

comment on table leads.transactional_sends is
  'Journal of the transactional e-mails OUTSIDE introductions (16 RG94). *** NOT A QUEUE (D43, 02 '
  '§18.8) ***: forbidden on this table: SELECT ... FOR UPDATE, SKIP LOCKED, advisory locks, any index '
  'on status, any worker loop that reads it to decide a send, any retry from it, any "replay" button '
  'on a P0 line. *** NEVER THE BODY, THE SUBJECT, NOR THE SIX-DIGIT CODE *** (03 Secrets). It says '
  'THAT an e-mail left, WHEN, TO WHOM, IN WHICH LANGUAGE, and what the provider did with it: the '
  'answer to "I did not receive my code" (D37). Retention: 13 months with an account; the whole line '
  'deleted after 30 days without an account (RG-J3-6).';
comment on column leads.transactional_sends.reference is
  'Random uuid of the line (EC-3): carried by the signed login cookie, hashed into the login_request '
  'throttle key, subject of the elevated.identity.* register lines. Never the sequential id outside.';
comment on column leads.transactional_sends.email_code is
  'Code of the e-mail (auth.login_code, auth.new_device, ...). Closed union in packages/contracts.';
comment on column leads.transactional_sends.recipient_email is
  'Normalised address, ONLY when no account exists (xor). Such a line is deleted after 30 days '
  '(RG-J3-6): an address typed by mistake or by a third party does not survive a year.';
comment on column leads.transactional_sends.template_ref is
  'Template code (16 RG85). No foreign key until backoffice.email_templates exists (0503, EC-6).';
comment on column leads.transactional_sends.template_version is
  'COPIED version of the template sent (04 R7), not the current one.';
comment on column leads.transactional_sends.outbox_event_id is
  'Queue event of a P1 / P2 e-mail; always NULL for a P0 (D43). bigint (EC-7); the foreign key to '
  'leads.outbox_events(id) is added by 0101, which creates that table (EC-37).';
comment on column leads.transactional_sends.provider_message_id is
  'messageId returned by Brevo (16 RG94); unique: the local belt of the acknowledgement (16 RG90).';
comment on column leads.transactional_sends.status is
  'SEMANTICS DIFFER FROM A QUEUE LINE (D43, 02 §18.8). queued = ATTEMPT ENGAGED, OUTCOME UNKNOWN, not '
  '"waiting": nobody consumes it; a P0 line queued for more than a few minutes signals a process '
  'interrupted in the middle of a request (an operating indicator, never a retry trigger). '
  'sent = accepted by Brevo. failed = refused, timed out or circuit open (failure_code). '
  'delivered = written LATER by the Brevo webhook through the worker, the only asynchronous write.';
comment on constraint transactional_sends_p0_failure_codes on leads.transactional_sends is
  'Three causes, and three only, matching 05 RG60 EXACTLY: the three distinct messages shown to the '
  'person. All are properties of the ADDRESS, the REQUESTER or the PROVIDER, never of the existence, '
  'role, state or history of an account (02 §18.5, 03 A-5). A fourth value added here without '
  're-reading 05 RG60 would be one more oracle.';

-- Read indexes only; NONE on status (an index that picks work is a queue that ignores itself).
create index if not exists transactional_sends_login_code_idx
  on leads.transactional_sends (created_at desc)
  where priority = 'p0';
comment on index leads.transactional_sends_login_code_idx is
  'AL48, deliverability of the sign-in code (16 RG98), and the daily purge of the lines without an '
  'account after 30 days (RG-J3-6).';

create index if not exists transactional_sends_by_account_idx
  on leads.transactional_sends (account_id, created_at desc)
  where account_id is not null;
comment on index leads.transactional_sends_by_account_idx is
  '"I did not receive my code": the support question, indexed as asked (04 §5.8).';

-- Append-only on everything that describes the send; the outcome moves forward only.
create or replace function leads.guard_transactional_send_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id               is distinct from old.id
     or new.reference        is distinct from old.reference
     or new.email_code       is distinct from old.email_code
     or new.priority         is distinct from old.priority
     or new.account_id       is distinct from old.account_id
     or new.recipient_email  is distinct from old.recipient_email
     or new.locale           is distinct from old.locale
     or new.template_ref     is distinct from old.template_ref
     or new.template_version is distinct from old.template_version
     or new.outbox_event_id  is distinct from old.outbox_event_id
     or new.created_at       is distinct from old.created_at
     or (old.provider_message_id is not null
         and new.provider_message_id is distinct from old.provider_message_id) then
    raise exception 'the description of a send is append-only' using errcode = 'insufficient_privilege';
  end if;
  if new.status is distinct from old.status then
    if not (   (old.status = 'queued' and new.status in ('sent', 'failed'))
            or (old.status = 'sent'   and new.status in ('delivered', 'failed'))) then
      raise exception 'status % cannot follow %', new.status, old.status
        using errcode = 'insufficient_privilege';
    end if;
    -- the instants of the outcome are the transaction time, never supplied
    if new.status = 'sent'      then new.sent_at      := pg_catalog.now(); end if;
    if new.status = 'delivered' then new.delivered_at := pg_catalog.now(); end if;
    if new.status = 'failed'    then new.failed_at    := pg_catalog.now(); end if;
  elsif new.sent_at      is distinct from old.sent_at
     or new.delivered_at is distinct from old.delivered_at
     or new.failed_at    is distinct from old.failed_at
     or new.failure_code is distinct from old.failure_code then
    raise exception 'the outcome of a send changes with its status only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function leads.guard_transactional_send_update() is
  'BEFORE UPDATE on leads.transactional_sends: the description of a send never changes, the '
  'provider message id is written once, the status moves forward only (queued -> sent | failed, '
  'sent -> delivered | failed) and its instant is now(). SECURITY INVOKER, reads nothing.';

revoke all on function leads.guard_transactional_send_update() from public;

drop trigger if exists transactional_sends_guard on leads.transactional_sends;
create trigger transactional_sends_guard
  before update on leads.transactional_sends
  for each row execute function leads.guard_transactional_send_update();

drop trigger if exists transactional_sends_touch_updated_at on leads.transactional_sends;
create trigger transactional_sends_touch_updated_at
  before update on leads.transactional_sends
  for each row execute function influx.touch_updated_at();

alter table leads.transactional_sends enable row level security;
alter table leads.transactional_sends force  row level security;
revoke all on leads.transactional_sends from public, anon, authenticated, service_role;

-- influx_auth (E-1): the P0 lines, the single attempt and its outcome. It reads back
-- only what it needs to address its own line (id, reference, status).
grant usage on schema leads to influx_auth;
grant insert (email_code, priority, account_id, recipient_email, locale, template_ref,
              template_version)
   on leads.transactional_sends to influx_auth;
grant select (id, reference, status) on leads.transactional_sends to influx_auth;
grant update (status, provider_message_id, failure_code)
   on leads.transactional_sends to influx_auth;

drop policy if exists transactional_sends_auth_insert on leads.transactional_sends;
create policy transactional_sends_auth_insert on leads.transactional_sends
  for insert to influx_auth
  with check (priority = 'p0' and email_code like 'auth.%' and outbox_event_id is null);

drop policy if exists transactional_sends_auth_select on leads.transactional_sends;
create policy transactional_sends_auth_select on leads.transactional_sends
  for select to influx_auth
  using (priority = 'p0');

drop policy if exists transactional_sends_auth_update on leads.transactional_sends;
create policy transactional_sends_auth_update on leads.transactional_sends
  for update to influx_auth
  using (priority = 'p0' and status = 'queued')
  with check (priority = 'p0' and status in ('queued', 'sent', 'failed'));

do $$
declare
  v_bad text;
begin
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_auth'
     and (pg_catalog.has_any_column_privilege(r.oid, 'leads.transactional_sends', 'SELECT')
          or pg_catalog.has_any_column_privilege(r.oid, 'leads.transactional_sends', 'INSERT')
          or pg_catalog.has_any_column_privilege(r.oid, 'leads.transactional_sends', 'UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'leads.transactional_sends', 'DELETE'));
  if v_bad is not null then
    raise exception 'unexpected right(s) on leads.transactional_sends: %', v_bad;
  end if;
  if pg_catalog.has_table_privilege('influx_auth', 'leads.transactional_sends', 'DELETE') then
    raise exception 'influx_auth may not delete a journal line';
  end if;
end
$$;
