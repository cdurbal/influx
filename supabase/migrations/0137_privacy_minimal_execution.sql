-- =============================================================================
-- 0137_privacy_minimal_execution
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 8 (second of two, after 0136). The minimal execution of the
-- "mes données" requests (E-5, production gate): 21 §J8 point 6; 03 P7 (E-5,
-- influx_privacy, "Non : déclenché par une tâche, après validation 2V + R par un
-- admin"); 15 RG75 to RG85; 04 §9.1 and §9.2; runbook demandes-rgpd §4 to §6.
-- Restricted to the tables of Lot 1; the other types and the tables of Lots 2 to 4
-- come at Lot 5 (0502).
--
--   privacy.request_executions   one row per approved request (access | erasure): the
--         2V that approved it, the instants of the execution, of the GoTrue deletion
--         and of the closure, the address held for the Brevo deletion until the
--         closure, the Brevo messageId of the "export ready" e-mail (15 RG85).
--   privacy.data_exports         the export of an access request: the exact JSON
--         delivered, its SHA-256 and size, 7 days and 3 downloads at most, purged by
--         E-4 (runbook §4). No right for any member role: read through functions.
--
--   2V   backoffice.canonical_dual_control_payload() + privacy.approve_data_request
--        {request_id, request_type}; backoffice.approve_data_request_execution()
--        (admin ONLY, 2V + R, reason request_instructed): records the approval, sets the
--        request in_progress, writes privacy.execution_approved. Executes NOTHING.
--   E-5  (influx_privacy ONLY, owner influx_privacy_definer) privacy.pending_work(),
--        privacy.execute_request() (access: export built FROM THE BASE, P1 e-mail
--        privacy.export_ready; erasure: anonymisation of 04 §9.2 on the tables of Lot 1,
--        account.deleted P0 to Brevo and Apollo, account.anonymized), privacy.
--        record_auth_user_deleted(), privacy.complete_request() (15 RG77, RG79).
--   E-3  (influx_worker) leads.read_brevo_erasure_subject() (Brevo operation 2);
--        leads.read_brevo_subject() recreated with export_expires_at.
--   E-4  (influx_worker) ops.purge_data_exports().
--   member (advertiser, creator) privacy.read_own_export(), privacy.download_own_export()
--        (a fresh code data_export consumed at each download).
--   backoffice  agent and admin read both tables in aal2, never the address, the
--        messageId, the content nor the digest.
--
-- The anonymising exception of the append-only guards. The guards of
-- identity.email_delivery_incidents (0105), identity.email_change_requests (0118),
-- backoffice.code_delivery_reports (0120), leads.brevo_inbound_events (0116),
-- leads.transactional_sends (0015) and backoffice.member_invitations (0131) let ONE role
-- make ONE change: current_user = influx_privacy_definer (a NOLOGIN role without member:
-- current_user can only be it inside its own SECURITY DEFINER functions), writing the
-- MARKER of an account already marked deleted (deleted+<account id>@invalid, the
-- address of that account since 04 §9.2), or clearing a column. Every other column stays
-- frozen, every other role is refused as before (same errors, same messages).
--
-- EC-J8 (micro-gaps, the safest choice; 0136 holds EC-J8-35 and EC-J8-41):
--   EC-J8-36  owners: the E-5 functions and leads.read_brevo_erasure_subject() belong
--             to influx_privacy_definer (the held address is readable by that owner
--             only); the approval and the member's export functions belong to
--             influx_identity_definer, the only owner that may call the 2V helpers and
--             identity.consume_member_reauthentication() (0118), with the narrowest
--             rights on the two tables (its policies bind the export to the session's
--             own account).
--   EC-J8-37  the sessions of an erased account are DELETED (04 §9.1 "toutes supprimées
--             à l'anonymisation du compte"), not only revoked (21 §J8): no foreign key
--             and no append-only rule holds them; the re-authentication markers live on
--             them and go with them.
--   EC-J8-38  display_name := NULL (nullable; the screens derive "Compte supprimé" from
--             the status); profiles.advertiser_profiles.legal_name := '[deleted]' (NOT
--             NULL and CHECK of 2 characters at least: no NULL possible).
--   EC-J8-39  leads.transactional_sends.recipient_email (not in the J8 list): the
--             address is replaced by the account's marker, the journal line is kept
--             (13 months, 16 RG94).
--   EC-J8-40  backoffice.member_invitations.email (not in the J8 list, found by
--             expert-database): the invitation redeemed by the account, its sign-up
--             invitation, and any invitation addressed to one of its addresses, get the
--             marker. The redemption is by code digest: nothing breaks.
--   EC-J8-42  the addresses of an account, for the export and the erasure: the current
--             one, every old_email of its address changes, and the new_email of the
--             COMPLETED ones only (an address requested but never confirmed may be a
--             third party's, mistyped).
--   EC-J8-43  closure of an erasure (15 RG79): Brevo = the account.deleted line
--             succeeded, not dry_run (the connector maps a Brevo 404 to succeeded);
--             Apollo = the line succeeded live (deletion confirmed), or skipped while
--             Apollo never held the contact (contact_sync_states.last_success_at NULL);
--             skipped after Apollo held it = not closable, manual follow-up.
--   EC-J8-44  identity.email_delivery_incidents: its payload (SMTP code and reason, already
--             scrubbed at the source) is emptied to {} when it holds an '@'; the
--             append-only trigger of 0105 is split in two (DELETE: unchanged function;
--             UPDATE: a guard with the exception, same message otherwise).
--   EC-J8-45  an approved request whose account is no longer active is left out of
--             privacy.pending_work() (execute_request would refuse it, 42501): it waits,
--             visible on the account sheet (executed_at NULL), for a manual decision.
--   EC-J8-46  the address of an erasure is held until the closure: a Brevo line failed
--             for good keeps it until the manual follow-up (RG79), never longer.
--   EC-J8-47  the register lines written by E-5 carry actor_type system (service if the
--             worker ever sets influx.account): audit.append() lists influx_privacy_login
--             with the two other elevated login roles (0136, V1 of 0011 otherwise refuses).
--   EC-J8-48  the export file: jsonb_pretty of one jsonb document (keys in jsonb order);
--             dates ISO 8601 UTC with milliseconds and Z; the activity log gives the code,
--             the date and the actor ("self" or "INFLUX"), never a payload (15 RG81:
--             internal reasons); the 14 categories are always present (empty array or
--             null). error_reports: date, route, message, browser summary, never the
--             stack.
--   EC-J8-49  backoffice.record_refused_action() also knows privacy.approve_data_request (an
--             agent's attempt at the approval, 15 RG76).
--   EC-J8-50  leads.read_brevo_erasure_subject() answers NO ROW for any line that is not
--             an account.deleted brevo_contact line in processing for p_worker (it never
--             tells another instance's line from another kind of line).
--   EC-J8-55  (review F1) an address reused by another account (A moved from x@ to y@, B
--             signed up with x@) is ambiguous: privacy.account_addresses() drops any
--             address another account holds or held, and a row that names an account
--             (transactional_sends.account_id, member_invitations.account_id,
--             brevo_inbound_events.account_ref and its outcome) is matched by address only
--             when it names THIS account or none, in the export, the erasure, the definer's
--             policies and the guards.
--   EC-J8-56  (review F2) error_reports carries the service; the message and the browser
--             summary of a BROWSER report only (a server message is a technical trace).
--   EC-J8-57  (review F6) data_export_purge is HOURLY: period YYYY-MM-DDTHH in the CHECK
--             periodic_runs_period_format and in ops.claim_periodic_run(), recreated by its
--             owner (0117 contract otherwise unchanged).
--
-- ROLLBACK (before any real request executed): drop the eleven functions created here
-- (privacy.*, backoffice.approve_data_request_execution, leads.read_brevo_erasure_subject,
-- ops.purge_data_exports) and recreate leads.read_brevo_subject() as in 0135,
-- backoffice.canonical_dual_control_payload() as in 0134, backoffice.record_refused_action()
-- as in 0135 and the six guards as in their migrations (0015, 0105 trigger, 0116, 0118,
-- 0120, 0131), ops.claim_periodic_run() and the CHECK periodic_runs_period_format as in
-- 0117; restore the constraint dual_control_action_code_closed of 0134; drop the
-- constraint data_subject_requests_execution_target; drop tables privacy.data_exports and
-- privacy.request_executions with their trigger functions; revoke the grants of sections 9
-- to 11 and drop their policies.
-- =============================================================================

-- 1. The tables -------------------------------------------------------------------------------------

-- The execution names the request by its id, type AND requester: the composite key makes an
-- execution of another type or for another account than the request impossible.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'data_subject_requests_execution_target'
                    and conrelid = 'backoffice.data_subject_requests'::regclass) then
    alter table backoffice.data_subject_requests
      add constraint data_subject_requests_execution_target
      unique (id, request_type, requester_account_id);
  end if;
end
$$;
comment on constraint data_subject_requests_execution_target on backoffice.data_subject_requests is
  'Target of the composite foreign key of privacy.request_executions (0137): an execution is of the '
  'type and for the requester of its request.';

create table if not exists privacy.request_executions (
  request_id               uuid        not null primary key,
  request_type             backoffice.data_request_type not null,
  account_id               uuid        not null references identity.accounts (id),
  dual_control_request_id  uuid        not null references backoffice.dual_control_requests (id),
  approved_by_account_id   uuid        not null references identity.accounts (id),
  approved_at              timestamptz not null default now(),
  executed_at              timestamptz,
  propagation_email        text,
  auth_user_deleted_at     timestamptz,
  notification_message_id  text,
  completed_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint request_executions_request_fk
    foreign key (request_id, request_type, account_id)
    references backoffice.data_subject_requests (id, request_type, requester_account_id),
  constraint request_executions_dual_control_key unique (dual_control_request_id),
  constraint request_executions_export_target unique (request_id, request_type, account_id),
  -- J8: the two types deposited from the member space; the others at Lot 5 (0502)
  constraint request_executions_type_executable check (request_type in ('access', 'erasure')),
  -- 15 RG36, 03 C(3): never on one's own account
  constraint request_executions_approver_not_subject check (approved_by_account_id <> account_id),
  constraint request_executions_chronology check (
    (executed_at is null or executed_at >= approved_at)
    and (auth_user_deleted_at is null
         or (executed_at is not null and auth_user_deleted_at >= executed_at))
    and (completed_at is null or (executed_at is not null and completed_at >= executed_at))),
  constraint request_executions_erasure_columns
    check (request_type = 'erasure' or (propagation_email is null and auth_user_deleted_at is null)),
  constraint request_executions_access_columns
    check (request_type = 'access' or notification_message_id is null),
  -- RG79: an erasure closes once GoTrue no longer knows the person; RG85: an access closes with
  -- the provider id of its notification
  constraint request_executions_erasure_completion
    check (request_type <> 'erasure' or completed_at is null or auth_user_deleted_at is not null),
  constraint request_executions_access_completion
    check (request_type <> 'access' or completed_at is null or notification_message_id is not null),
  -- the held address: set at the execution, gone at the closure
  constraint request_executions_propagation_window
    check (propagation_email is null or (executed_at is not null and completed_at is null)),
  constraint request_executions_propagation_email_normalized
    check (propagation_email = lower(propagation_email) and position('@' in propagation_email) > 1
           and length(propagation_email) <= 320),
  constraint request_executions_message_id_length
    check (length(notification_message_id) between 1 and 200)
);

comment on table privacy.request_executions is
  'One row per data subject request approved for execution (15 RG75 step 6, RG76; 03 P7 E-5): '
  'written by backoffice.approve_data_request_execution() (admin, 2V + R), then by the E-5 functions '
  'of the worker (execution, GoTrue deletion, closure). 15 RG85: with the request, the proof of the '
  'treatment (executor, the two instants of the 2V through dual_control_request_id, messageId). '
  'Never deleted (trigger); FORCE RLS.';
comment on column privacy.request_executions.account_id is
  'The requester (composite foreign key: the account of the request, of its type).';
comment on column privacy.request_executions.dual_control_request_id is
  'The 2V request privacy.approve_data_request {request_id, request_type} consumed by the approval '
  '(its two instants: requested_at, confirmed_at or degraded_confirmed_at).';
comment on column privacy.request_executions.approved_by_account_id is
  'The admin who consumed the 2V (the confirmer: the peer, or the requester alone in degraded mode).';
comment on column privacy.request_executions.executed_at is
  'Execution by E-5 (privacy.execute_request): the export published, or the account anonymised.';
comment on column privacy.request_executions.propagation_email is
  'ERASURE ONLY. The address of the account copied just before its anonymisation, read by the Brevo '
  'connector when Brevo knows no contact id (leads.read_brevo_erasure_subject), and set to NULL at the '
  'closure (EC-J8-46). Readable by influx_privacy_definer only.';
comment on column privacy.request_executions.auth_user_deleted_at is
  'ERASURE ONLY. Instant the worker recorded the deletion of the GoTrue user (after the commit of the '
  'anonymisation, by the GoTrue admin API).';
comment on column privacy.request_executions.notification_message_id is
  'ACCESS ONLY. Brevo messageId of the e-mail privacy.export_ready, copied at the closure (15 RG85). '
  'Never shown in the backoffice, never in the register.';
comment on column privacy.request_executions.completed_at is
  'Closure (15 RG77): the request is closed satisfaite in the same transaction. A closed row is frozen.';

create table if not exists privacy.data_exports (
  id                  uuid        not null default gen_random_uuid() primary key,
  request_id          uuid        not null,
  request_type        backoffice.data_request_type not null
                        generated always as ('access'::backoffice.data_request_type) stored,
  account_id          uuid        not null,
  content             text,
  sha256              bytea       not null,
  size_bytes          integer     not null,
  categories          text[]      not null,
  published_at        timestamptz not null default now(),
  expires_at          timestamptz not null,
  downloads_count     smallint    not null default 0,
  last_downloaded_at  timestamptz,
  purged_at           timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint data_exports_request_key unique (request_id),
  -- an export belongs to an ACCESS execution, of the same account
  constraint data_exports_execution_fk
    foreign key (request_id, request_type, account_id)
    references privacy.request_executions (request_id, request_type, account_id),
  constraint data_exports_sha256_length check (octet_length(sha256) = 32),
  constraint data_exports_size_positive check (size_bytes > 0),
  -- the digest and the size are those of the exact bytes delivered
  constraint data_exports_content_digest check (
    content is null
    or (sha256 = sha256(convert_to(content, 'UTF8'))
        and size_bytes = octet_length(convert_to(content, 'UTF8')))),
  constraint data_exports_categories_shape
    check (cardinality(categories) between 1 and 50 and array_position(categories, null) is null),
  -- runbook §4: 7 days at most, 3 downloads at most
  constraint data_exports_expiry check (expires_at = published_at + interval '7 days'),
  constraint data_exports_downloads_range check (downloads_count between 0 and 3),
  constraint data_exports_download_pair check ((downloads_count = 0) = (last_downloaded_at is null)),
  constraint data_exports_download_order
    check (last_downloaded_at is null or last_downloaded_at >= published_at),
  constraint data_exports_purge_pair check ((purged_at is null) = (content is not null)),
  constraint data_exports_purge_order check (purged_at is null or purged_at >= published_at)
);

comment on table privacy.data_exports is
  'The export of an access request (runbook §4, expert-cybersecurite 2026-10-14): produced FROM THE '
  'BASE by privacy.execute_request() (E-5), kept here, read by the member only through '
  'privacy.download_own_export() after a fresh code data_export, 3 times and 7 days at most; then '
  'E-4 erases the content and keeps the digest. No right for any member role; FORCE RLS; never '
  'deleted (trigger).';
comment on column privacy.data_exports.request_type is
  'Always access: carries the composite foreign key towards the ACCESS executions only.';
comment on column privacy.data_exports.content is
  'The exact JSON bytes delivered (UTF-8 text): {format, version, generated_at, account_id, '
  'language, time_zone, notice, categories, data}. NULL once purged (E-4, or the erasure of the '
  'account). Never in a log nor in the register.';
comment on column privacy.data_exports.sha256 is
  'SHA-256 of convert_to(content, ''UTF8''), kept after the purge (the proof of what was delivered).';
comment on column privacy.data_exports.categories is
  'The keys of the categories of the file, in the order of the notice (EC-J8-48).';
comment on column privacy.data_exports.expires_at is
  'published_at + 7 days (CHECK). Past it, or after 3 downloads, the content is no longer delivered '
  'and E-4 purges it.';

create index if not exists request_executions_pending_idx
  on privacy.request_executions (approved_at, request_id)
  where completed_at is null;
comment on index privacy.request_executions_pending_idx is
  'privacy.pending_work(), polled by the worker: the open executions, oldest approval first.';

create index if not exists request_executions_account_idx
  on privacy.request_executions (account_id);
comment on index privacy.request_executions_account_idx is
  'Account sheet of the backoffice (executions of an account) and the foreign key to the accounts.';

create index if not exists data_exports_account_idx
  on privacy.data_exports (account_id, published_at desc);
comment on index privacy.data_exports_account_idx is
  'privacy.read_own_export(): the latest export of the session''s account.';

create index if not exists data_exports_purge_idx
  on privacy.data_exports (expires_at)
  where purged_at is null;
comment on index privacy.data_exports_purge_idx is
  'ops.purge_data_exports() (E-4): the exports still holding a content.';

-- 1.1 The guards of privacy.request_executions -----------------------------------------------------

create or replace function privacy.prepare_request_execution()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
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
  'BEFORE INSERT on privacy.request_executions: approved_at = now(), every later column empty. '
  'SECURITY INVOKER, reads nothing.';

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
  'BEFORE UPDATE on privacy.request_executions: a closed row is frozen; the approval never changes; '
  'executed_at, auth_user_deleted_at, notification_message_id are written once (instants = now()); '
  'propagation_email is written with the execution, then only cleared. SECURITY INVOKER, reads nothing.';

revoke all on function privacy.prepare_request_execution()      from public;
revoke all on function privacy.guard_request_execution_update() from public;

drop trigger if exists request_executions_prepare on privacy.request_executions;
create trigger request_executions_prepare
  before insert on privacy.request_executions
  for each row execute function privacy.prepare_request_execution();

drop trigger if exists request_executions_guard_update on privacy.request_executions;
create trigger request_executions_guard_update
  before update on privacy.request_executions
  for each row execute function privacy.guard_request_execution_update();

drop trigger if exists request_executions_no_delete on privacy.request_executions;
create trigger request_executions_no_delete
  before delete on privacy.request_executions
  for each row execute function influx.assert_append_only();

drop trigger if exists request_executions_no_truncate on privacy.request_executions;
create trigger request_executions_no_truncate
  before truncate on privacy.request_executions
  for each statement execute function influx.assert_append_only();

-- 1.2 The guards of privacy.data_exports ------------------------------------------------------------

create or replace function privacy.prepare_data_export()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.published_at       := pg_catalog.now();
  new.expires_at         := pg_catalog.now() + interval '7 days';
  new.downloads_count    := 0;
  new.last_downloaded_at := null;
  new.purged_at          := null;
  new.created_at         := pg_catalog.now();
  new.updated_at         := pg_catalog.now();
  return new;
end
$$;

comment on function privacy.prepare_data_export() is
  'BEFORE INSERT on privacy.data_exports: published_at = now(), expires_at = now() + 7 days, no '
  'download, not purged. SECURITY INVOKER, reads nothing.';

create or replace function privacy.guard_data_export_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.purged_at is not null then
    raise exception 'a purged export is frozen' using errcode = 'insufficient_privilege';
  end if;
  if new.id               is distinct from old.id
     or new.request_id    is distinct from old.request_id
     or new.account_id    is distinct from old.account_id
     or new.sha256        is distinct from old.sha256
     or new.size_bytes    is distinct from old.size_bytes
     or new.categories    is distinct from old.categories
     or new.published_at  is distinct from old.published_at
     or new.expires_at    is distinct from old.expires_at
     or new.created_at    is distinct from old.created_at then
    raise exception 'immutable export column' using errcode = 'insufficient_privilege';
  end if;
  -- the content is never rewritten: it stays, or it is purged (purged_at = now())
  if new.content is distinct from old.content and new.content is not null then
    raise exception 'the content of an export is only purged' using errcode = 'insufficient_privilege';
  end if;
  if new.content is null then
    new.purged_at := pg_catalog.now();
  elsif new.purged_at is not null then
    raise exception 'purged_at goes with the purge of the content' using errcode = 'insufficient_privilege';
  end if;
  -- a download counts one, at the transaction time
  if new.downloads_count is distinct from old.downloads_count then
    if new.downloads_count <> old.downloads_count + 1 or new.content is null then
      raise exception 'a download counts one, on an available export'
        using errcode = 'insufficient_privilege';
    end if;
    new.last_downloaded_at := pg_catalog.now();
  elsif new.last_downloaded_at is distinct from old.last_downloaded_at then
    raise exception 'last_downloaded_at moves with a download only' using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function privacy.guard_data_export_update() is
  'BEFORE UPDATE on privacy.data_exports: a purged export is frozen; the description never changes; '
  'the content is only purged (purged_at = now()); a download adds one (last_downloaded_at = now()). '
  'SECURITY INVOKER, reads nothing.';

revoke all on function privacy.prepare_data_export()      from public;
revoke all on function privacy.guard_data_export_update() from public;

drop trigger if exists data_exports_prepare on privacy.data_exports;
create trigger data_exports_prepare
  before insert on privacy.data_exports
  for each row execute function privacy.prepare_data_export();

drop trigger if exists data_exports_guard_update on privacy.data_exports;
create trigger data_exports_guard_update
  before update on privacy.data_exports
  for each row execute function privacy.guard_data_export_update();

drop trigger if exists data_exports_no_delete on privacy.data_exports;
create trigger data_exports_no_delete
  before delete on privacy.data_exports
  for each row execute function influx.assert_append_only();

drop trigger if exists data_exports_no_truncate on privacy.data_exports;
create trigger data_exports_no_truncate
  before truncate on privacy.data_exports
  for each statement execute function influx.assert_append_only();

alter table privacy.request_executions enable row level security;
alter table privacy.request_executions force  row level security;
alter table privacy.data_exports       enable row level security;
alter table privacy.data_exports       force  row level security;
revoke all on privacy.request_executions, privacy.data_exports
  from public, anon, authenticated, service_role;

-- 2. The closed list of 2V actions ----------------------------------------------------------------

alter table backoffice.dual_control_requests drop constraint if exists dual_control_action_code_closed;
alter table backoffice.dual_control_requests add constraint dual_control_action_code_closed
  check (action_code in ('identity.grant_role', 'identity.invite_admin', 'identity.change_member_role',
                         'leads.change_apollo_setting', 'privacy.approve_data_request'));

comment on column backoffice.dual_control_requests.action_code is
  'Closed list (CHECK): identity.grant_role (0130), identity.invite_admin (0131), '
  'identity.change_member_role (0132), leads.change_apollo_setting (0134), privacy.approve_data_request '
  '(0137). An action enters it with its consuming function.';

-- 3. The anonymising exception of the append-only guards ------------------------------------------
-- Each branch: current_user = influx_privacy_definer (only reachable inside its own functions), the
-- MARKER of an account already marked deleted, or a column cleared; nothing else moves. The other
-- roles keep the behaviour and the messages of the original guard.

-- 3.1 identity.email_delivery_incidents (0105): the UPDATE part of the append-only trigger becomes a
-- guard; DELETE and TRUNCATE keep influx.assert_append_only().
create or replace function identity.guard_email_delivery_incident_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'influx_privacy_definer' then
    if new.id                    is not distinct from old.id
       and new.account_id        is not distinct from old.account_id
       and new.channel           is not distinct from old.channel
       and new.incident_type     is not distinct from old.incident_type
       and new.provider          is not distinct from old.provider
       and new.provider_event_id is not distinct from old.provider_event_id
       and new.occurred_at       is not distinct from old.occurred_at
       and new.created_at        is not distinct from old.created_at
       and new.email_address = 'deleted+' || old.account_id::text || '@invalid'
       and (new.payload = old.payload or new.payload = '{}'::jsonb) then
      if exists (select 1 from identity.accounts a
                  where a.id = old.account_id and a.status = 'deleted') then
        return new;
      end if;
    end if;
  end if;
  raise exception '%.% is append-only (attempted %)', tg_table_schema, tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end
$$;

comment on function identity.guard_email_delivery_incident_update() is
  'BEFORE UPDATE on identity.email_delivery_incidents (0137): append-only for every role (the 0105 '
  'message), with ONE exception: influx_privacy_definer replaces the address by the marker '
  'deleted+<account id>@invalid of an account already deleted, and may empty the payload (EC-J8-44); '
  'nothing else moves. SECURITY INVOKER.';

revoke all on function identity.guard_email_delivery_incident_update() from public;

drop trigger if exists email_delivery_incidents_append_only on identity.email_delivery_incidents;
drop trigger if exists email_delivery_incidents_no_delete on identity.email_delivery_incidents;
create trigger email_delivery_incidents_no_delete
  before delete on identity.email_delivery_incidents
  for each row execute function influx.assert_append_only();
drop trigger if exists email_delivery_incidents_guard_update on identity.email_delivery_incidents;
create trigger email_delivery_incidents_guard_update
  before update on identity.email_delivery_incidents
  for each row execute function identity.guard_email_delivery_incident_update();

-- 3.2 identity.email_change_requests (0118) ---------------------------------------------------------
create or replace function identity.guard_email_change_request_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 0137 (EC-J8-41): the erasure of the account. The two addresses get the markers; a request still
  -- open is cancelled for that reason, its digests cleared; nothing else moves.
  if current_user = 'influx_privacy_definer' then
    if new.id                   is not distinct from old.id
       and new.account_id       is not distinct from old.account_id
       and new.created_at       is not distinct from old.created_at
       and new.expires_at       is not distinct from old.expires_at
       and new.old_attempts     is not distinct from old.old_attempts
       and new.new_attempts     is not distinct from old.new_attempts
       and new.old_confirmed_at is not distinct from old.old_confirmed_at
       and new.new_confirmed_at is not distinct from old.new_confirmed_at
       and new.completed_at     is not distinct from old.completed_at
       and new.old_email = 'deleted+' || old.account_id::text || '@invalid'
       and new.new_email = 'deleted+' || old.account_id::text || '.new@invalid'
       and (   ((old.completed_at is not null or old.cancelled_at is not null)
                and new.cancelled_at  is not distinct from old.cancelled_at
                and new.cancel_reason is not distinct from old.cancel_reason
                and new.old_code_hash is not distinct from old.old_code_hash
                and new.new_code_hash is not distinct from old.new_code_hash)
            or (old.completed_at is null and old.cancelled_at is null
                and new.cancelled_at is not null and new.cancel_reason = 'account_deleted'
                and new.old_code_hash is null and new.new_code_hash is null)) then
      if exists (select 1 from identity.accounts a
                  where a.id = old.account_id and a.status = 'deleted') then
        if old.cancelled_at is null and new.cancelled_at is not null then
          new.cancelled_at := pg_catalog.now();
        end if;
        new.updated_at := pg_catalog.now();
        return new;
      end if;
    end if;
    raise exception 'an address change request is only pseudonymised, on an erased account'
      using errcode = 'insufficient_privilege';
  end if;

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
  'BEFORE UPDATE on identity.email_change_requests (0118, 0137): a closed request is frozen; '
  'addresses, account and dates never change; counters move forward by one; confirmations are '
  'written once; digests are only cleared, at the closing. 0137 exception (EC-J8-41): '
  'influx_privacy_definer, on an account already deleted, sets the markers deleted+<id>@invalid '
  '(old) and deleted+<id>.new@invalid (new), and cancels an open request (account_deleted, digests '
  'cleared). SECURITY INVOKER.';

-- 3.3 backoffice.code_delivery_reports (0120) ---------------------------------------------------------
create or replace function backoffice.guard_code_delivery_report_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 0137: the erasure of the account whose current or former address the report names. Both
  -- addresses get the account's marker, the free message is cleared; nothing else moves.
  if current_user = 'influx_privacy_definer' then
    if new.id                is not distinct from old.id
       and new.received_at   is not distinct from old.received_at
       and new.locale        is not distinct from old.locale
       and new.status        is not distinct from old.status
       and new.handled_at    is not distinct from old.handled_at
       and new.message is null
       and new.login_email = new.contact_email
       and new.login_email ~ '^deleted\+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@invalid$' then
      if exists (select 1 from identity.accounts a
                  where a.email = new.login_email and a.status = 'deleted') then
        return new;
      end if;
    end if;
    raise exception 'a delivery report is append-only' using errcode = 'insufficient_privilege';
  end if;

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
  'BEFORE UPDATE on backoffice.code_delivery_reports (0120, 0137): the report never changes; the '
  'status goes from received to handled once, handled_at = now(). 0137 exception: '
  'influx_privacy_definer replaces both addresses by the marker of an account already deleted and '
  'clears the message; nothing else moves. SECURITY INVOKER.';

-- 3.4 leads.brevo_inbound_events (0116) ---------------------------------------------------------------
create or replace function leads.guard_brevo_inbound_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'leads.brevo_inbound_events is never truncated' using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'DELETE' then
    -- decision 2: 30 days after the outcome, never a line without one
    if not exists (select 1
                     from leads.brevo_inbound_outcomes o
                    where o.event_id = old.id
                      and o.processed_at < pg_catalog.now() - interval '720 hours') then
      raise exception 'a raw Brevo line is deleted only 30 days after its outcome'
        using errcode = 'insufficient_privilege';
    end if;
    return old;
  end if;
  if new.id                  is distinct from old.id
     or new.received_at         is distinct from old.received_at
     or new.origin              is distinct from old.origin
     or new.dedup_key           is distinct from old.dedup_key
     or new.event               is distinct from old.event
     or new.occurred_at         is distinct from old.occurred_at
     or new.provider_message_id is distinct from old.provider_message_id
     or new.campaign_id         is distinct from old.campaign_id
     or new.template_id         is distinct from old.template_id
     or new.reason              is distinct from old.reason
     or new.account_ref         is distinct from old.account_ref
     or new.email is not null and new.email is distinct from old.email then
    raise exception 'a raw Brevo line is append-only: only its address may be cleared'
      using errcode = 'insufficient_privilege';
  end if;
  -- 0137: the erasure of an account clears the address of its raw lines, outcome or not
  if new.email is null and old.email is not null
     and current_user <> 'influx_privacy_definer'
     and not exists (select 1 from leads.brevo_inbound_outcomes o where o.event_id = old.id) then
    raise exception 'the address of a raw Brevo line is cleared with its outcome only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function leads.guard_brevo_inbound_event() is
  'BEFORE UPDATE OR DELETE / TRUNCATE on leads.brevo_inbound_events (0116, 0137): append-only but its '
  'address, which may only be cleared, with its outcome; deleted 30 days after the outcome only; '
  'never truncated. 0137 exception: influx_privacy_definer clears the address without an outcome '
  '(the erasure of the account). SECURITY INVOKER.';

-- 3.5 leads.transactional_sends (0015) ---------------------------------------------------------------
create or replace function leads.guard_transactional_send_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 0137 (EC-J8-39): the erasure of the account whose address received this P0/P1 line. The address
  -- becomes the account's marker; nothing else of the line moves.
  if current_user = 'influx_privacy_definer'
     and new.recipient_email is distinct from old.recipient_email then
    if row(new.id, new.reference, new.email_code, new.priority, new.account_id, new.locale,
           new.template_ref, new.template_version, new.outbox_event_id, new.provider_message_id,
           new.status, new.sent_at, new.delivered_at, new.failed_at, new.failure_code, new.created_at)
       is not distinct from
       row(old.id, old.reference, old.email_code, old.priority, old.account_id, old.locale,
           old.template_ref, old.template_version, old.outbox_event_id, old.provider_message_id,
           old.status, old.sent_at, old.delivered_at, old.failed_at, old.failure_code, old.created_at)
       and old.account_id is null
       and new.recipient_email ~ '^deleted\+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@invalid$' then
      if exists (select 1 from identity.accounts a
                  where a.email = new.recipient_email and a.status = 'deleted') then
        return new;
      end if;
    end if;
    raise exception 'the description of a send is append-only' using errcode = 'insufficient_privilege';
  end if;

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
  'BEFORE UPDATE on leads.transactional_sends (0015, 0137): the description of a send is append-only; '
  'the status moves queued -> sent | failed, sent -> delivered | failed, with its instant = now(). 0137 '
  'exception (EC-J8-39): influx_privacy_definer replaces recipient_email by the marker of an account '
  'already deleted, on a line that names no account (EC-J8-55); nothing else moves. SECURITY '
  'INVOKER.';

-- 3.6 backoffice.member_invitations (0131) -----------------------------------------------------------
create or replace function backoffice.guard_member_invitation_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 0137 (EC-J8-40): the erasure of the invited account. The address becomes the account's marker,
  -- whatever the state of the invitation; nothing else moves.
  if current_user = 'influx_privacy_definer' then
    if row(new.id, new.code_hash, new.proposed_role, new.preferred_language,
           new.created_by_account_id, new.created_at, new.expires_at, new.redeemed_at,
           new.account_id, new.revoked_at, new.revoked_by_account_id, new.revoke_reason_code)
       is not distinct from
       row(old.id, old.code_hash, old.proposed_role, old.preferred_language,
           old.created_by_account_id, old.created_at, old.expires_at, old.redeemed_at,
           old.account_id, old.revoked_at, old.revoked_by_account_id, old.revoke_reason_code)
       and new.email ~ '^deleted\+[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}@invalid$' then
      if exists (select 1 from identity.accounts a
                  where a.email = new.email and a.status = 'deleted'
                    and (old.account_id is null or old.account_id = a.id)) then
        new.updated_at := pg_catalog.now();
        return new;
      end if;
    end if;
    raise exception 'immutable invitation column' using errcode = 'insufficient_privilege';
  end if;

  if new.id                       is distinct from old.id
     or new.code_hash             is distinct from old.code_hash
     or new.email                 is distinct from old.email
     or new.proposed_role         is distinct from old.proposed_role
     or new.preferred_language    is distinct from old.preferred_language
     or new.created_by_account_id is distinct from old.created_by_account_id
     or new.created_at            is distinct from old.created_at
     or new.expires_at            is distinct from old.expires_at then
    raise exception 'immutable invitation column' using errcode = 'insufficient_privilege';
  end if;
  if old.redeemed_at is not null or old.revoked_at is not null then
    raise exception 'a redeemed or revoked invitation is frozen' using errcode = 'insufficient_privilege';
  end if;
  if new.redeemed_at is distinct from old.redeemed_at then
    if pg_catalog.now() >= old.expires_at then
      raise exception 'the invitation has expired' using errcode = 'insufficient_privilege';
    end if;
    new.redeemed_at := pg_catalog.now();
  end if;
  if new.revoked_at is distinct from old.revoked_at then
    new.revoked_at := pg_catalog.now();
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function backoffice.guard_member_invitation_update() is
  'BEFORE UPDATE on backoffice.member_invitations (0131, 0137): the invitation itself never changes; '
  'a redeemed or revoked invitation is frozen; redemption before expiry, instants = now(). 0137 '
  'exception (EC-J8-40): influx_privacy_definer replaces the address by the marker of an account '
  'already deleted - the invited account itself when the invitation was redeemed (EC-J8-55) - '
  'whatever the state; nothing else moves. SECURITY INVOKER.';

-- 4. Helpers of E-5 (SECURITY INVOKER, owned by influx_privacy_definer, NO grant) -------------------

create or replace function privacy.iso_utc(p_instant timestamptz)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.to_char(p_instant at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

comment on function privacy.iso_utc(timestamptz) is
  'An instant in ISO 8601 UTC with milliseconds and Z, whatever the session time zone (runbook §4). '
  'NULL for NULL. SECURITY INVOKER owned by influx_privacy_definer, NO grant.';

create or replace function privacy.export_categories()
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select array['account', 'advertiser_profile', 'consents', 'terms_acceptances', 'sessions',
               'transactional_emails', 'email_changes', 'email_delivery_incidents',
               'delivery_reports', 'brevo_events', 'activity_log', 'error_reports',
               'data_requests', 'recipients']::text[]
$$;

comment on function privacy.export_categories() is
  'The 14 category keys of the export, in the order of the notice (runbook §4, EC-J8-48): always '
  'present in the file, empty when nothing is held. SECURITY INVOKER owned by influx_privacy_definer, '
  'NO grant.';

create or replace function privacy.account_addresses(p_account_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.array_agg(distinct x.address order by x.address), '{}'::text[])
    from (select a.email as address
            from identity.accounts a
           where a.id = p_account_id
          union all
          select r.old_email
            from identity.email_change_requests r
           where r.account_id = p_account_id
          union all
          select r.new_email
            from identity.email_change_requests r
           where r.account_id = p_account_id and r.completed_at is not null) x
   where x.address is not null
     -- EC-J8-55 (F1 of the review): an address another account holds, or held, is ambiguous (A
     -- moved from x@ to y@, then B signed up with x@): it never matches a row by address
     and not exists (select 1 from identity.accounts o
                      where o.email = x.address and o.id <> p_account_id)
     and not exists (select 1 from identity.email_change_requests o
                      where o.account_id <> p_account_id
                        and (o.old_email = x.address
                             or (o.completed_at is not null and o.new_email = x.address)))
$$;

comment on function privacy.account_addresses(uuid) is
  'EC-J8-42, EC-J8-55: the current and former addresses of an account (its address, every '
  'old_email, the new_email of the COMPLETED changes), read BEFORE an anonymisation, WITHOUT any '
  'address another account holds or held (its current address, an old_email, a completed '
  'new_email): an ambiguous address never matches a row by address. SECURITY INVOKER owned by '
  'influx_privacy_definer, NO grant.';

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

    -- Profil de marque: the legal name of an advertiser
    'advertiser_profile', (
      select pg_catalog.jsonb_build_object('legal_name', p.legal_name,
                                           'created_at', privacy.iso_utc(p.created_at))
        from profiles.advertiser_profiles p
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

    -- Journal d'activité: code and date, an internal actor shown as INFLUX, no payload, no hash
    'activity_log', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', e.event_type, 'occurred_at', privacy.iso_utc(e.occurred_at),
               'actor', case when e.actor_account_id = p_account_id then 'self' else 'INFLUX' end)
             order by e.seq)
        from audit.audit_events e
       where e.actor_account_id = p_account_id
          or (e.subject_type = 'account' and e.subject_id = p_account_id)
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
  'version: 1, generated_at, account_id, language, time_zone, notice, categories, data} with the 14 '
  'categories of privacy.export_categories() (EC-J8-48). p_addresses: privacy.account_addresses(). '
  'SECURITY INVOKER owned by influx_privacy_definer, NO grant.';

-- 5. E-5 (SECURITY DEFINER, influx_privacy_definer, EXECUTE for influx_privacy ONLY) ---------------

-- 5.1 The work of the worker ------------------------------------------------------------------------
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
   where e.completed_at is null
     -- EC-J8-45: an approved request whose account is no longer active waits, never retried
     and (e.executed_at is not null or a.status = 'active')
   order by e.approved_at, e.request_id
   limit p_limit;
end
$$;

comment on function privacy.pending_work(integer) is
  'E-5, the loop of the worker (03 P7): up to p_limit (1 to 100) open executions, oldest approval '
  'first, without lock, each with its step: execute (approved, not executed; with the UI language of '
  'the account, for the notice), delete_auth_user (erasure executed, GoTrue user not yet deleted; '
  'with its auth_user_id, on this step only), complete (executed, not closed; an erasure once its '
  'GoTrue user is deleted). An approved request whose account is no longer active is left out '
  '(EC-J8-45). 22023 for another size. SECURITY DEFINER owned by influx_privacy_definer, empty '
  'search_path; EXECUTE for influx_privacy ONLY.';

-- 5.2 The execution ------------------------------------------------------------------------------------
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
begin
  -- The approved, not yet executed row; another worker holding it, or nothing to do: no row.
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

  -- the address the Brevo deletion may need, held until the closure (EC-J8-46)
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

  -- 5. any export of the account still holding a content: purged (purged_at by the guard)
  update privacy.data_exports set content = null
   where account_id = v_account.id and purged_at is null;

  -- 6. 04 §9.2 point 4, 15 RG79: the propagation, P0, ids only (RG74), once per account by nature
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_fact, 'account.deleted', d.destination, 'account:' || v_account.id::text, 0,
         pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account.id,
                                       'request_id', p_request_id),
         'account.deleted:' || v_account.id::text
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  -- last: the chain lock is held until COMMIT (04 §7.2)
  perform audit.append('account.anonymized', 'account', v_account.id,
                       pg_catalog.jsonb_build_object('request_id', p_request_id));

  -- the GoTrue user is deleted by the worker AFTER the commit (admin API), then recorded
  return query select 'erasure'::text, v_account.auth_user_id;
end
$$;

comment on function privacy.execute_request(uuid, jsonb) is
  'E-5 privacy.execute_request (03 P7; 15 RG75 step 6; 04 §9.2; 21 §J8 point 6). Locks the approved, '
  'not executed row FOR UPDATE SKIP LOCKED (none: no row). 42501 when the request is closed or the '
  'requester is no longer active. ACCESS: p_notice required (JSON object, 64 KiB at most, 22023 '
  'otherwise), stored under "notice"; the export built from the base (privacy.export_document), '
  'serialised once (jsonb_pretty), stored with its SHA-256, size and 14 categories, 7 days; '
  'privacy.export_ready to brevo_transactional (P1, ids, idempotency privacy.export_ready:<request>); '
  'privacy.export_published {sha256 hex, size_bytes, categories}; returns (access, NULL). ERASURE: '
  'p_notice NULL (22023 otherwise); the address held in propagation_email; account deleted, '
  'anonymised, deleted+<id>@invalid, display name NULL; its sessions DELETED (EC-J8-37); legal name '
  '[deleted]; addresses replaced by the marker in email_change_requests (open ones cancelled '
  'account_deleted), email_delivery_incidents, code_delivery_reports (message cleared), '
  'transactional_sends, member_invitations; cleared in brevo_inbound_events; exports purged; '
  'account.deleted to brevo_contact and apollo_contact (P0, ids, account.deleted:<account>); '
  'account.anonymized {request_id}; returns (erasure, auth_user_id) for the GoTrue deletion after '
  'the commit. SECURITY DEFINER owned by influx_privacy_definer, empty search_path; EXECUTE for '
  'influx_privacy ONLY.';

-- 5.3 The GoTrue deletion, recorded -----------------------------------------------------------------
create or replace function privacy.record_auth_user_deleted(p_request_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update privacy.request_executions e
     set auth_user_deleted_at = pg_catalog.now()
   where e.request_id = p_request_id
     and e.request_type = 'erasure'
     and e.executed_at is not null
     and e.auth_user_deleted_at is null
     and e.completed_at is null;
  return found;
end
$$;

comment on function privacy.record_auth_user_deleted(uuid) is
  'E-5: records that the worker deleted the GoTrue user of an executed erasure (after the commit of '
  'the anonymisation): auth_user_deleted_at = now(), true; false when there is nothing to record '
  '(not an erasure, not executed, already recorded, closed). SECURITY DEFINER owned by '
  'influx_privacy_definer, empty search_path; EXECUTE for influx_privacy ONLY.';

-- 5.4 The closure ------------------------------------------------------------------------------------
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
  'E-5, the closure (15 RG75 step 7, RG77, RG79, RG85): on an executed, open row (FOR UPDATE SKIP '
  'LOCKED). ERASURE: GoTrue user deleted, the account.deleted line to brevo_contact succeeded and not '
  'dry_run, the one to apollo_contact succeeded live or skipped while Apollo never held the contact '
  '(EC-J8-43). ACCESS: the privacy.export_ready line succeeded, not dry_run, with its messageId, '
  'copied to notification_message_id. Then the request closed satisfaite, completed_at, the held '
  'address cleared, privacy.request_completed {request_type, outcome_code[, brevo {status, '
  'skip_reason}, apollo {status, skip_reason, ever_synced}]}; returns satisfaite. NULL when not '
  'closable yet (or nothing to close). SECURITY DEFINER owned by influx_privacy_definer, empty '
  'search_path; EXECUTE for influx_privacy ONLY.';

-- 6. E-3: the Brevo deletion reads its subject (influx_worker; owner influx_privacy_definer) -------

create or replace function leads.read_brevo_erasure_subject(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  external_contact_id  text,
  email                text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line     record;
  v_account  uuid;
  v_request  uuid;
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only an account.deleted line to brevo_contact, in processing for THIS worker (EC-J8-50).
  select o.subject_key, o.payload
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.event_type = 'account.deleted'
     and o.destination = 'brevo_contact'
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found or pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or (v_line.payload ->> 'request_id') !~ c_uuid then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;
  v_request := (v_line.payload ->> 'request_id')::uuid;

  -- the erasure named by the payload must be the line's account's
  return query
  select s.external_contact_id, e.propagation_email
    from privacy.request_executions e
    left join leads.contact_sync_states s
           on s.account_id = e.account_id and s.destination = 'brevo_contact'
   where e.request_id = v_request
     and e.account_id = v_account
     and e.request_type = 'erasure';
end
$$;

comment on function leads.read_brevo_erasure_subject(bigint, text) is
  'E-3, Brevo operation 2 (the deletion of the contact, 15 RG79): on an account.deleted line to '
  'brevo_contact in processing for p_worker only, whose payload names an erasure of the line''s own '
  'account: the Brevo contact id (contact_sync_states) and the address held until the closure '
  '(privacy.request_executions.propagation_email, NULL once closed). No row for any other line '
  '(EC-J8-50); 22023 for a malformed worker. The connector uses the contact id when known, else the '
  'address. SECURITY DEFINER owned by influx_privacy_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

-- 7. ops.purge_data_exports() (E-4, influx_maintenance_definer, EXECUTE for influx_worker) ----------

-- 7.0 EC-J8-57: data_export_purge is HOURLY, like auth_orphan_purge (the scheduler of apps/api, the
-- runbook): its period is YYYY-MM-DDTHH, in the CHECK of 0117 and in the claim, recreated by its
-- owner with the same contract.
alter table ops.periodic_runs drop constraint if exists periodic_runs_period_format;
alter table ops.periodic_runs add constraint periodic_runs_period_format check (
  (task_code in ('auth_orphan_purge', 'data_export_purge')
   and period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$')
  or (task_code not in ('auth_orphan_purge', 'data_export_purge')
      and period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'));

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;

set role influx_maintenance_definer;

create or replace function ops.claim_periodic_run(
  p_task        ops.periodic_task,
  p_period_key  text
)
returns table (
  run_id   uuid,
  attempt  smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_current  text;
  v_id       uuid;
  v_run      record;
begin
  if p_task is null then
    raise exception 'a task is required' using errcode = 'invalid_parameter_value';
  end if;
  -- hourly: the GoTrue pass (04 §9) and the purge of the exports (0137); daily: the others
  v_current := pg_catalog.to_char(pg_catalog.now() at time zone 'UTC',
                                  case when p_task in ('auth_orphan_purge', 'data_export_purge')
                                       then 'YYYY-MM-DD"T"HH24' else 'YYYY-MM-DD' end);
  -- Only the current period: no scheduling error replays a past one nor reserves a future one.
  if p_period_key is distinct from v_current then
    raise exception 'only the current period (%) can be claimed', v_current
      using errcode = 'invalid_parameter_value';
  end if;

  insert into ops.periodic_runs (task_code, period_key)
  values (p_task, p_period_key)
  on conflict (task_code, period_key) do nothing
  returning id into v_id;
  if v_id is not null then
    return query select v_id, 1::smallint;
    return;
  end if;

  -- The period exists: finished, running elsewhere, or left unfinished for an hour.
  select r.id, r.attempt, r.started_at, r.finished_at
    into v_run
    from ops.periodic_runs r
   where r.task_code = p_task and r.period_key = p_period_key
     for update;
  -- FOR UPDATE reads through the UPDATE policy (finished_at is null): a finished run is not
  -- found here. Nothing to take back, never a row of NULLs.
  if not found then
    return;
  end if;
  if v_run.finished_at is not null
     or v_run.started_at > pg_catalog.now() - interval '1 hour'
     or v_run.attempt >= 100 then
    return;
  end if;
  update ops.periodic_runs r
     set attempt = r.attempt + 1,
         counts  = '{}'::jsonb
   where r.id = v_run.id;
  return query select v_run.id, (v_run.attempt + 1)::smallint;
end
$$;

comment on function ops.claim_periodic_run(ops.periodic_task, text) is
  'E-4 claim (decision 3 of J7): for the CURRENT UTC period of the task only (22023 otherwise): '
  'hourly YYYY-MM-DDTHH for auth_orphan_purge and data_export_purge (0137), daily YYYY-MM-DD for '
  'the others; creates the run (attempt 1), or takes back a run left unfinished for one hour '
  '(attempt + 1, started_at = now(), counts reset). No row: the period is finished or running '
  'elsewhere. Returns (run id, attempt): the run id is the subject of '
  'elevated.maintenance.run_periodic, the attempt the fencing token of the other functions. '
  'SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

reset role;

revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 7.1 The purge ------------------------------------------------------------------------------------

create or replace function ops.purge_data_exports(
  p_run_id   uuid,
  p_attempt  smallint,
  p_limit    integer default 1000
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count  integer;
begin
  if p_limit is null or p_limit not between 1 and 10000 then
    raise exception 'the batch size is between 1 and 10000' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'data_export_purge') then
    raise exception 'no open data_export_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- runbook §4: at the first deadline (7 days, or the third download) the content is erased, the
  -- digest kept (purged_at by the guard)
  with doomed as (
    select x.id
      from privacy.data_exports x
     where x.purged_at is null
       and (x.expires_at <= pg_catalog.now() or x.downloads_count >= 3)
     order by x.expires_at
     limit p_limit
       for update skip locked
  )
  update privacy.data_exports x
     set content = null
    from doomed
   where x.id = doomed.id;
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'data_exports', 'count', v_count));
  end if;
  return v_count;
end
$$;

comment on function ops.purge_data_exports(uuid, smallint, integer) is
  'E-4 purge (runbook §4): erases the content of at most p_limit exports (1 to 10000, 1000 by '
  'default) past their 7 days or their third download, keeping the digest (purged_at = now()). Inside '
  'the open data_export_purge run of this attempt only (55000 otherwise). Writes retention.purged '
  '{category data_exports, count} on the run when it purged something. Returns the count (call again '
  'while it equals p_limit). SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; '
  'EXECUTE for influx_worker ONLY.';

-- 8. leads.read_brevo_subject() recreated: + export_expires_at (0135 otherwise unchanged) ---------

drop function if exists leads.read_brevo_subject(bigint, text);

create function leads.read_brevo_subject(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  email                text,
  signed_up_at         timestamptz,
  company              text,
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  referrer_domain      text,
  heard_from           text,
  via_invitation       boolean,
  consent_at           timestamptz,
  consent_source       text,
  welcome_sent         boolean,
  previous_email       text,
  external_contact_id  text,
  suppressed           boolean,
  signed_in_at         timestamptz,
  browser              text,
  time_zone            text,
  request_type         text,
  request_received_at  timestamptz,
  request_due_at       timestamptz,
  request_closed       boolean,
  export_expires_at    timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line          record;
  v_account       uuid;
  v_request       uuid;
  v_session       uuid;
  v_data_request  uuid;
  v_export        uuid;
  c_uuid          constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker: the address is read for the call about to be
  -- made, never for a line of another instance or one taken back.
  select o.destination, o.event_type, o.subject_key, o.payload
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_line.destination not in ('brevo_contact', 'brevo_transactional') then
    raise exception 'a Brevo line only: Apollo reads what it needs by its own function'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The account comes from the line, never from the caller; another kind of subject, or an
  -- unknown account, returns no row.
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account' then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;

  -- RG58: the request of an email.changed line, by the id of its payload (never an address).
  if v_line.event_type = 'email.changed' and (v_line.payload ->> 'request_id') ~ c_uuid then
    v_request := (v_line.payload ->> 'request_id')::uuid;
  end if;
  -- RG142: the session of an auth.new_device line, by the id of its payload.
  if v_line.event_type = 'auth.new_device' and (v_line.payload ->> 'session_id') ~ c_uuid then
    v_session := (v_line.payload ->> 'session_id')::uuid;
  end if;
  -- RG160: the data subject request of a privacy.request_received line, by the id of its payload;
  -- 0137: the same for a privacy.export_ready line, and the export it announces.
  if v_line.event_type in ('privacy.request_received', 'privacy.export_ready')
     and (v_line.payload ->> 'request_id') ~ c_uuid then
    v_data_request := (v_line.payload ->> 'request_id')::uuid;
  end if;
  if v_line.event_type = 'privacy.export_ready' and (v_line.payload ->> 'export_id') ~ c_uuid then
    v_export := (v_line.payload ->> 'export_id')::uuid;
  end if;

  return query
  select a.email::text,
         a.created_at,
         p.legal_name,
         a.signup_utm_source,
         a.signup_utm_medium,
         a.signup_utm_campaign,
         a.signup_referrer_domain,
         a.signup_heard_from::text,
         -- RG120, RG122: the person came through an invitation (whatever its state, 0131 EC-J8-16)
         a.signup_invitation_id is not null,
         case when c.granted then c.occurred_at end,
         case when c.granted then c.source::text end,
         (v_line.payload ->> 'email_code') is not null
           and exists (select 1
                         from leads.transactional_sends t
                        where t.account_id = a.id
                          and t.email_code = (v_line.payload ->> 'email_code')),
         (select r.old_email
            from identity.email_change_requests r
           where r.id = v_request
             and r.account_id = a.id
             and r.completed_at is not null),
         s.external_contact_id,
         coalesce(s.suppressed_reason is not null, false),
         n.created_at,
         n.user_agent_summary,
         a.timezone,
         d.request_type::text,
         d.received_at,
         d.due_at,
         case when d.id is not null then d.status = 'closed' end,
         x.expires_at
    from identity.accounts a
    left join profiles.advertiser_profiles p on p.account_id = a.id
    left join leads.contact_sync_states s
           on s.account_id = a.id and s.destination = 'brevo_contact'
    left join identity.sessions n
           on n.id = v_session and n.account_id = a.id and n.surface = 'member'
    -- the joins, not the policies, keep the reads to the line's own account
    left join backoffice.data_subject_requests d
           on d.id = v_data_request and d.requester_account_id = a.id
    left join privacy.data_exports x
           on x.id = v_export and x.account_id = a.id
    left join lateral (
          -- RG37: the consent in force, its latest event; a refusal wins a tie
          select e.granted, e.occurred_at, e.source
            from identity.consent_events e
           where e.account_id = a.id and e.purpose = 'marketing_email'
           order by e.occurred_at desc, e.granted
           limit 1) c on true
   where a.id = v_account;
end
$$;

comment on function leads.read_brevo_subject(bigint, text) is
  'E-3 read of the Brevo connectors (16 §M4, EC-11; 05 RG86, RG58, RG93, RG120, RG122, RG142; 16 '
  'RG160), on a brevo_contact or brevo_transactional line in processing for p_worker only (55000 '
  'otherwise; 22023 for another destination): the address, sign-up instant, company name of an '
  'advertiser profile, acquisition source and whether the account came through a member invitation '
  '(0135, never the invitation itself), instant and source of the marketing_email consent in force '
  '(null when refused), whether the welcome e-mail of the line''s code is already journaled (16 '
  'RG90), the old address of the completed request of an email.changed line (0121), the Brevo '
  'contact id, whether a suppression is recorded on the Brevo contact (0121), on an auth.new_device '
  'line the opening instant and the browser summary of the member session named by the payload '
  '(0126), the account''s time zone, on a privacy.request_received or privacy.export_ready line the '
  'type, receipt, deadline and closure of the data subject request named by the payload (0128, '
  '0137), and on a privacy.export_ready line the expiry of the export named by the payload (0137), '
  'of the line''s account only. No row for a subject that is not an existing account. SECURITY '
  'DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 9. The functions of influx_identity_definer (2V, approval, member export) -----------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice, privacy to influx_identity_definer;

-- the rights the canonical payload needs at once (the execution of a request)
grant usage on schema privacy to influx_identity_definer;
grant select (request_id) on privacy.request_executions to influx_identity_definer;
grant select (channel) on backoffice.data_subject_requests to influx_identity_definer;

drop policy if exists request_executions_identity_definer_select on privacy.request_executions;
create policy request_executions_identity_definer_select on privacy.request_executions
  for select to influx_identity_definer
  using (true);

set role influx_identity_definer;

-- 9.1 The canonical payload, extended ------------------------------------------------------------
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
  v_legal     text;
  v_key       text;
  v_value     jsonb;
  v_codes     text[];
  v_request   uuid;
  v_type      backoffice.data_request_type;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_action_code = 'identity.grant_role' then
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
    return pg_catalog.jsonb_build_object('account_id', v_target, 'role', v_role);
  end if;

  if p_action_code = 'identity.change_member_role' then
    -- EC-J8-23 (0134): exactly {"account_id", "role": "advertiser", "legal_name"} on an active
    -- creator account other than the caller's; the name of the brand is covered by the 2V
    if (p_payload - 'account_id' - 'role' - 'legal_name') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'account_id') is distinct from 'string'
       or pg_catalog.jsonb_typeof(p_payload -> 'legal_name') is distinct from 'string'
       or (p_payload ->> 'account_id') !~* c_uuid
       or (p_payload ->> 'role') is distinct from 'advertiser' then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_target := (p_payload ->> 'account_id')::uuid;
    v_legal  := p_payload ->> 'legal_name';
    if v_target = p_caller
       or pg_catalog.char_length(pg_catalog.btrim(v_legal)) < 2
       or pg_catalog.char_length(v_legal) > 120 or v_legal ~ '[[:cntrl:]]'
       or not exists (select 1
                        from identity.accounts a
                        join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
                       where a.id = v_target and a.status = 'active') then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('account_id', v_target, 'role', 'advertiser',
                                         'legal_name', v_legal);
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

  if p_action_code = 'leads.change_apollo_setting' then
    -- 05 RG81, RG83, RG84: exactly {"key", "value"}, one of the three Apollo keys, a value of the
    -- shape of 0103; a country list is sorted, its codes known (the CHECK of 0103 decides last)
    if (p_payload - 'key' - 'value') <> '{}'::jsonb
       or not (p_payload ? 'value')
       or pg_catalog.jsonb_typeof(p_payload -> 'key') is distinct from 'string' then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_key   := p_payload ->> 'key';
    v_value := p_payload -> 'value';
    if v_key = 'apollo_scope' then
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'string'
         or (v_value #>> '{}') not in ('annonceurs_seuls', 'annonceurs_et_createurs_pro',
                                       'tous_les_inscrits') then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
    elsif v_key = 'apollo_prospecting_countries' then
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'array'
         or pg_catalog.jsonb_array_length(v_value) > 300
         or pg_catalog.jsonb_path_exists(v_value,
              '$[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z]{2}$"))') then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
      select pg_catalog.array_agg(distinct e order by e) into v_codes
        from pg_catalog.jsonb_array_elements_text(v_value) e;
      if exists (select 1 from pg_catalog.unnest(v_codes) c
                  where not exists (select 1 from reference.countries r where r.code = c)) then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
      v_value := coalesce(pg_catalog.to_jsonb(v_codes), '[]'::jsonb);
    elsif v_key = 'apollo_legal_basis' then
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'object'
         or not (v_value ?& array['default', 'by_country'])
         or (v_value - 'default' - 'by_country') <> '{}'::jsonb
         or (v_value ->> 'default') is null
         or (v_value ->> 'default') not in ('consentement_requis', 'interet_legitime_avec_opposition')
         or pg_catalog.jsonb_typeof(v_value -> 'by_country') is distinct from 'object'
         or pg_catalog.jsonb_path_exists(v_value -> 'by_country',
              '$.keyvalue() ? (!(@.key like_regex "^[A-Z]{2}$")
                               || (@.value != "consentement_requis"
                                   && @.value != "interet_legitime_avec_opposition"))')
         or exists (select 1 from pg_catalog.jsonb_object_keys(v_value -> 'by_country') k
                     where not exists (select 1 from reference.countries r where r.code = k)) then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
    else
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('key', v_key, 'value', v_value);
  end if;

  if p_action_code = 'privacy.approve_data_request' then
    -- 0137 (15 RG75 step 6, RG76): exactly {"request_id": uuid, "request_type": access | erasure},
    -- a request of that type deposited from the member space, open, by an active account other
    -- than the caller's (C(3)), never approved yet
    if (p_payload - 'request_id' - 'request_type') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'request_id') is distinct from 'string'
       or pg_catalog.jsonb_typeof(p_payload -> 'request_type') is distinct from 'string'
       or (p_payload ->> 'request_id') !~* c_uuid
       or (p_payload ->> 'request_type') not in ('access', 'erasure') then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_request := (p_payload ->> 'request_id')::uuid;
    v_type    := (p_payload ->> 'request_type')::backoffice.data_request_type;
    if not exists (select 1
                     from backoffice.data_subject_requests d
                     join identity.accounts a on a.id = d.requester_account_id
                    where d.id = v_request
                      and d.request_type = v_type
                      and d.channel = 'self_service'
                      and d.requester_account_id <> p_caller
                      and d.status <> 'closed'
                      and a.status = 'active')
       or exists (select 1 from privacy.request_executions e where e.request_id = v_request) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('request_id', v_request, 'request_type', v_type);
  end if;

  raise exception 'forbidden' using errcode = 'insufficient_privilege';
end
$$;

comment on function backoffice.canonical_dual_control_payload(text, jsonb, uuid) is
  'The closed list of 2V actions and the exact shape of each payload (03 PD4; identifiers and codes, '
  'C(33) spirit): identity.grant_role {"account_id", "role"} (never the caller, an active target); '
  'identity.change_member_role {"account_id", "role": "advertiser", "legal_name"} (an active creator, '
  'never the caller, a name of 2 to 120 printable characters: EC-J8-23, 0134); identity.invite_admin '
  '{"invitation_id"} (a live invitation proposing admin, not yet confirmed, EC-J8-12, 0131); '
  'leads.change_apollo_setting {"key", "value"} (apollo_scope, apollo_prospecting_countries sorted '
  'and known, apollo_legal_basis: the shapes of 0103, 0134); privacy.approve_data_request {"request_id", '
  '"request_type": access | erasure} (a self-service request of that type, open, by an active account '
  'other than the caller, never approved: 0137). Returns the canonical payload, compared whole by the '
  'action function; 42501 forbidden otherwise. SECURITY INVOKER owned by influx_identity_definer, NO '
  'grant.';

-- 9.2 backoffice.record_refused_action(): + privacy.approve_data_request (EC-J8-49) ----------------------
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
                              'privacy.approve_data_request') then
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
  'privacy.approve_data_request (0137, EC-J8-49; 22023 otherwise). apps/api calls it before answering 403, '
  'in a transaction that commits. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for '
  'influx_agent ONLY.';

reset role;

revoke create on schema backoffice, privacy from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- The new functions of influx_identity_definer are created by the migration role, published, then
-- handed to their owner (section 12, 03 P7 rule 5).

-- 9.3 The approval (admin ONLY, 2V + R) ---------------------------------------------------------------
create or replace function backoffice.approve_data_request_execution(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_request_id               uuid,
  p_request_type             backoffice.data_request_type,
  p_reason_code              text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid;
  v_payload  jsonb;
  v_account  uuid;
  v_mode     text;
begin
  -- 15 RG76: an admin only, active, in aal2
  v_caller := identity.require_active_admin();

  -- PD4: a typed reason of the closed list
  if p_reason_code is distinct from 'request_instructed' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the same canonical form as the request: type, channel, open, active requester other than the
  -- caller (C(3)), never approved
  v_payload := backoffice.canonical_dual_control_payload(
                 'privacy.approve_data_request',
                 pg_catalog.jsonb_build_object('request_id', p_request_id,
                                               'request_type', p_request_type),
                 v_caller);

  select d.requester_account_id
    into v_account
    from backoffice.data_subject_requests d
   where d.id = p_request_id and d.status <> 'closed'
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- R in THIS transaction, then the 2V consumed once, by its confirmer (03 PD3 to PD7)
  perform identity.assert_fresh_second_factor(p_session_id);
  v_mode := backoffice.consume_dual_control(p_dual_control_request_id, 'privacy.approve_data_request',
                                            v_payload, p_reason_code);

  insert into privacy.request_executions
    (request_id, request_type, account_id, dual_control_request_id, approved_by_account_id)
  values (p_request_id, p_request_type, v_account, p_dual_control_request_id, v_caller);

  update backoffice.data_subject_requests set status = 'in_progress' where id = p_request_id;

  -- last: the chain lock is held until COMMIT. PD5: the mode of the control.
  perform audit.append('privacy.execution_approved', 'data_subject_request', p_request_id,
                       pg_catalog.jsonb_build_object('request_type', p_request_type,
                                                     'reason_code', p_reason_code,
                                                     'dual_control_request_id', p_dual_control_request_id,
                                                     'dual_control', v_mode));
end
$$;

comment on function backoffice.approve_data_request_execution(uuid, uuid, uuid,
    backoffice.data_request_type, text) is
  '15 RG75 step 6, RG76; 03 P7 E-5, §1.3 (J · 2V · R · C(3)): an active admin in aal2 approves the '
  'execution of a self-service request (access | erasure) of an active member other than himself, '
  'with R on p_session_id in this transaction, consuming the confirmed 2V request '
  'privacy.approve_data_request {request_id, request_type} with the reason request_instructed, by its '
  'confirmer. Writes privacy.request_executions (approved), the request in_progress, '
  'privacy.execution_approved {request_type, reason_code, dual_control_request_id, dual_control}. '
  'Executes NOTHING: E-5 is a task of the worker. Any refusal: 42501 forbidden. SECURITY DEFINER '
  'owned by influx_identity_definer, empty search_path; EXECUTE for influx_admin ONLY.';

-- 9.4 The member's export: read and download (advertiser, creator) ----------------------------------
create or replace function privacy.read_own_export()
returns table (
  export_id       uuid,
  request_id      uuid,
  published_at    timestamptz,
  expires_at      timestamptz,
  downloads_left  smallint,
  available       boolean
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
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator')
     or not exists (select 1 from identity.accounts a where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  return query
  select x.id, x.request_id, x.published_at, x.expires_at,
         (3 - x.downloads_count)::smallint,
         (x.purged_at is null and x.expires_at > pg_catalog.now() and x.downloads_count < 3)
    from privacy.data_exports x
   where x.account_id = v_account
   order by x.published_at desc, x.id
   limit 1;
end
$$;

comment on function privacy.read_own_export() is
  'Runbook §4 (the "Mes données" screen): the most recent export of the session''s account, at most '
  'one row: id, request, publication, expiry, downloads left, available (not purged, not expired, '
  'downloads left). Never the content nor the digest. 42501 outside an active member account. '
  'SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for influx_advertiser '
  'and influx_creator.';

create or replace function privacy.download_own_export(
  p_session_id  uuid,
  p_export_id   uuid
)
returns table (
  content         text,
  sha256          bytea,
  size_bytes      integer,
  downloads_left  smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_export   record;
  v_count    smallint;
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator')
     or not exists (select 1 from identity.accounts a where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- the session's own export only (another's, or none: no row), locked
  select x.id, x.request_id, x.content, x.sha256, x.size_bytes, x.expires_at, x.downloads_count,
         x.purged_at
    into v_export
    from privacy.data_exports x
   where x.id = p_export_id and x.account_id = v_account
     for update;
  if not found then
    return;
  end if;
  -- runbook §4: 7 days and 3 downloads at most, never after the purge
  if v_export.purged_at is not null or v_export.expires_at <= pg_catalog.now()
     or v_export.downloads_count >= 3 then
    raise exception 'the export is no longer available' using errcode = 'no_data_found';
  end if;

  -- RG57, A-10: a fresh code data_export for EACH download, consumed here (55000 without it)
  perform identity.consume_member_reauthentication(p_session_id, 'data_export');

  update privacy.data_exports x
     set downloads_count = x.downloads_count + 1
   where x.id = v_export.id
  returning x.downloads_count into v_count;

  -- last: the chain lock is held until COMMIT; never the content
  perform audit.append('privacy.export_downloaded', 'data_subject_request', v_export.request_id,
                       pg_catalog.jsonb_build_object('export_id', v_export.id,
                                                     'download_number', v_count,
                                                     'session_id', p_session_id));
  return query select v_export.content, v_export.sha256, v_export.size_bytes, (3 - v_count)::smallint;
end
$$;

comment on function privacy.download_own_export(uuid, uuid) is
  'Runbook §4: the member downloads the export p_export_id of the session''s account (another''s or '
  'none: no row), locked; purged, expired or downloaded 3 times: P0002; then the marker data_export '
  'of p_session_id is consumed (55000 without a fresh one: a fresh code at EACH download), the '
  'download counted, privacy.export_downloaded {export_id, download_number, session_id}; returns the '
  'exact content, its SHA-256, size and the downloads left. 42501 outside an active member account. '
  'SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for influx_advertiser '
  'and influx_creator.';

-- 10. Publication -----------------------------------------------------------------------------------

revoke all on function privacy.iso_utc(timestamptz) from public, anon, authenticated, service_role;
revoke all on function privacy.export_categories() from public, anon, authenticated, service_role;
revoke all on function privacy.account_addresses(uuid) from public, anon, authenticated, service_role;
revoke all on function privacy.export_document(uuid, text[], jsonb)
  from public, anon, authenticated, service_role;
revoke all on function privacy.pending_work(integer) from public, anon, authenticated, service_role;
revoke all on function privacy.execute_request(uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function privacy.record_auth_user_deleted(uuid)
  from public, anon, authenticated, service_role;
revoke all on function privacy.complete_request(uuid) from public, anon, authenticated, service_role;
revoke all on function leads.read_brevo_erasure_subject(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function ops.purge_data_exports(uuid, smallint, integer)
  from public, anon, authenticated, service_role;
revoke all on function leads.read_brevo_subject(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.approve_data_request_execution(uuid, uuid, uuid,
    backoffice.data_request_type, text)
  from public, anon, authenticated, service_role;
revoke all on function privacy.read_own_export() from public, anon, authenticated, service_role;
revoke all on function privacy.download_own_export(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute on function privacy.pending_work(integer) to influx_privacy;
grant execute on function privacy.execute_request(uuid, jsonb) to influx_privacy;
grant execute on function privacy.record_auth_user_deleted(uuid) to influx_privacy;
grant execute on function privacy.complete_request(uuid) to influx_privacy;
grant execute on function leads.read_brevo_erasure_subject(bigint, text) to influx_worker;
grant execute on function ops.purge_data_exports(uuid, smallint, integer) to influx_worker;
grant execute on function leads.read_brevo_subject(bigint, text) to influx_worker;
grant execute on function backoffice.approve_data_request_execution(uuid, uuid, uuid,
    backoffice.data_request_type, text) to influx_admin;
grant execute on function privacy.read_own_export() to influx_advertiser, influx_creator;
grant execute on function privacy.download_own_export(uuid, uuid) to influx_advertiser, influx_creator;

-- the schema of the functions: E-5, the members' two functions, the backoffice reads
grant usage on schema privacy to influx_privacy, influx_advertiser, influx_creator, influx_agent,
  influx_admin;

-- 11. Rights of the owners: what the functions read and write, nothing more --------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner.

-- 11.1 influx_privacy_definer (E-5 and the Brevo erasure read) ---------------------------------------

grant usage on schema privacy, identity, profiles, leads, backoffice, audit, ops
   to influx_privacy_definer;

-- privacy.request_executions: read; the execution, GoTrue, closure columns written
grant select (request_id, request_type, account_id, dual_control_request_id, approved_by_account_id,
              approved_at, executed_at, propagation_email, auth_user_deleted_at,
              notification_message_id, completed_at)
   on privacy.request_executions to influx_privacy_definer;
grant update (executed_at, propagation_email, auth_user_deleted_at, notification_message_id,
              completed_at)
   on privacy.request_executions to influx_privacy_definer;

drop policy if exists request_executions_privacy_definer_select on privacy.request_executions;
create policy request_executions_privacy_definer_select on privacy.request_executions
  for select to influx_privacy_definer
  using (true);

drop policy if exists request_executions_privacy_definer_update on privacy.request_executions;
create policy request_executions_privacy_definer_update on privacy.request_executions
  for update to influx_privacy_definer
  using (completed_at is null)
  with check (true);

-- privacy.data_exports: the export written; its content purged at the erasure
grant select (id, request_id, account_id, expires_at, purged_at)
   on privacy.data_exports to influx_privacy_definer;
grant insert (request_id, account_id, content, sha256, size_bytes, categories)
   on privacy.data_exports to influx_privacy_definer;
grant update (content) on privacy.data_exports to influx_privacy_definer;

drop policy if exists data_exports_privacy_definer_select on privacy.data_exports;
create policy data_exports_privacy_definer_select on privacy.data_exports
  for select to influx_privacy_definer
  using (true);

drop policy if exists data_exports_privacy_definer_insert on privacy.data_exports;
create policy data_exports_privacy_definer_insert on privacy.data_exports
  for insert to influx_privacy_definer
  with check (content is not null and purged_at is null and downloads_count = 0);

drop policy if exists data_exports_privacy_definer_purge on privacy.data_exports;
create policy data_exports_privacy_definer_purge on privacy.data_exports
  for update to influx_privacy_definer
  using (purged_at is null
         and exists (select 1 from identity.accounts a
                      where a.id = data_exports.account_id and a.status = 'deleted'))
  with check (content is null);

-- the request: read; closed satisfaite at the closure
grant select (id, request_type, requester_account_id, channel, received_at, due_at, status,
              completed_at, outcome_code)
   on backoffice.data_subject_requests to influx_privacy_definer;
grant update (status, outcome_code) on backoffice.data_subject_requests to influx_privacy_definer;

drop policy if exists data_subject_requests_privacy_definer_select on backoffice.data_subject_requests;
create policy data_subject_requests_privacy_definer_select on backoffice.data_subject_requests
  for select to influx_privacy_definer
  using (requester_account_id is not null);

drop policy if exists data_subject_requests_privacy_definer_update on backoffice.data_subject_requests;
create policy data_subject_requests_privacy_definer_update on backoffice.data_subject_requests
  for update to influx_privacy_definer
  using (status <> 'closed'
         and exists (select 1 from privacy.request_executions e
                      where e.request_id = data_subject_requests.id))
  with check (status <> 'closed' or outcome_code = 'satisfaite');

-- the account: everything the export restitutes; the anonymisation of 04 §9.2
grant select (id, auth_user_id, email, email_verified_at, email_status, email_undeliverable_at,
              country_code, preferred_language, timezone, display_name, status, owner_agent_id,
              is_adult_attested, adult_attested_at, declared_status, signup_utm_source,
              signup_utm_medium, signup_utm_campaign, signup_referrer_domain, signup_heard_from,
              signup_invitation_id, created_at, last_seen_at)
   on identity.accounts to influx_privacy_definer;
grant update (status, deleted_at, anonymized_at, email, display_name)
   on identity.accounts to influx_privacy_definer;

drop policy if exists accounts_privacy_definer_select on identity.accounts;
create policy accounts_privacy_definer_select on identity.accounts
  for select to influx_privacy_definer
  using (true);

drop policy if exists accounts_privacy_definer_erase on identity.accounts;
create policy accounts_privacy_definer_erase on identity.accounts
  for update to influx_privacy_definer
  using (status = 'active')
  with check (status = 'deleted' and deleted_at is not null and anonymized_at is not null
              and email = 'deleted+' || id::text || '@invalid' and display_name is null);

grant select (account_id, role, granted_at) on identity.account_roles to influx_privacy_definer;

drop policy if exists account_roles_privacy_definer_select on identity.account_roles;
create policy account_roles_privacy_definer_select on identity.account_roles
  for select to influx_privacy_definer
  using (true);

-- the referent agent: his first name only
grant select (account_id, first_name) on identity.agent_profiles to influx_privacy_definer;

drop policy if exists agent_profiles_privacy_definer_select on identity.agent_profiles;
create policy agent_profiles_privacy_definer_select on identity.agent_profiles
  for select to influx_privacy_definer
  using (true);

-- the sessions: read for the export (never the token digest nor the markers); deleted at the
-- erasure, those of an account already deleted only (EC-J8-37)
grant select (id, account_id, surface, created_at, last_activity_at, revoked_at, revocation_reason,
              user_agent_summary, country_code)
   on identity.sessions to influx_privacy_definer;
grant delete on identity.sessions to influx_privacy_definer;

drop policy if exists sessions_privacy_definer_select on identity.sessions;
create policy sessions_privacy_definer_select on identity.sessions
  for select to influx_privacy_definer
  using (true);

drop policy if exists sessions_privacy_definer_delete on identity.sessions;
create policy sessions_privacy_definer_delete on identity.sessions
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = sessions.account_id and a.status = 'deleted'));

grant select (id, account_id, purpose, granted, source, occurred_at, evidence)
   on identity.consent_events to influx_privacy_definer;

drop policy if exists consent_events_privacy_definer_select on identity.consent_events;
create policy consent_events_privacy_definer_select on identity.consent_events
  for select to influx_privacy_definer
  using (true);

grant select (id, account_id, terms_version_id, accepted_at, nature, channel, locale, ip_address,
              user_agent)
   on identity.terms_acceptances to influx_privacy_definer;
grant select (id, document_kind, version_label, locale) on identity.terms_versions
   to influx_privacy_definer;

drop policy if exists terms_acceptances_privacy_definer_select on identity.terms_acceptances;
create policy terms_acceptances_privacy_definer_select on identity.terms_acceptances
  for select to influx_privacy_definer
  using (true);

drop policy if exists terms_versions_privacy_definer_select on identity.terms_versions;
create policy terms_versions_privacy_definer_select on identity.terms_versions
  for select to influx_privacy_definer
  using (true);

-- the address changes: addresses and dates (never the digests); pseudonymised at the erasure
grant select (id, account_id, old_email, new_email, created_at, completed_at, cancelled_at,
              cancel_reason)
   on identity.email_change_requests to influx_privacy_definer;
grant update (old_email, new_email, cancelled_at, cancel_reason, old_code_hash, new_code_hash)
   on identity.email_change_requests to influx_privacy_definer;

drop policy if exists email_change_requests_privacy_definer_select on identity.email_change_requests;
create policy email_change_requests_privacy_definer_select on identity.email_change_requests
  for select to influx_privacy_definer
  using (true);

drop policy if exists email_change_requests_privacy_definer_erase on identity.email_change_requests;
create policy email_change_requests_privacy_definer_erase on identity.email_change_requests
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = email_change_requests.account_id and a.status = 'deleted'))
  with check (true);

grant select (id, account_id, email_address, channel, incident_type, occurred_at, payload)
   on identity.email_delivery_incidents to influx_privacy_definer;
grant update (email_address, payload) on identity.email_delivery_incidents to influx_privacy_definer;

drop policy if exists email_delivery_incidents_privacy_definer_select on identity.email_delivery_incidents;
create policy email_delivery_incidents_privacy_definer_select on identity.email_delivery_incidents
  for select to influx_privacy_definer
  using (true);

drop policy if exists email_delivery_incidents_privacy_definer_erase on identity.email_delivery_incidents;
create policy email_delivery_incidents_privacy_definer_erase on identity.email_delivery_incidents
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = email_delivery_incidents.account_id and a.status = 'deleted'))
  with check (true);

grant select (account_id, legal_name, created_at) on profiles.advertiser_profiles
   to influx_privacy_definer;
grant update (legal_name) on profiles.advertiser_profiles to influx_privacy_definer;

drop policy if exists advertiser_profiles_privacy_definer_select on profiles.advertiser_profiles;
create policy advertiser_profiles_privacy_definer_select on profiles.advertiser_profiles
  for select to influx_privacy_definer
  using (true);

drop policy if exists advertiser_profiles_privacy_definer_erase on profiles.advertiser_profiles;
create policy advertiser_profiles_privacy_definer_erase on profiles.advertiser_profiles
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = advertiser_profiles.account_id and a.status = 'deleted'))
  with check (legal_name = '[deleted]');

-- the journal of the transactional e-mails: read (never the provider id); the address pseudonymised
grant select (id, email_code, priority, account_id, recipient_email, locale, status, created_at,
              sent_at, delivered_at, failed_at)
   on leads.transactional_sends to influx_privacy_definer;
grant update (recipient_email) on leads.transactional_sends to influx_privacy_definer;

drop policy if exists transactional_sends_privacy_definer_select on leads.transactional_sends;
create policy transactional_sends_privacy_definer_select on leads.transactional_sends
  for select to influx_privacy_definer
  using (true);

drop policy if exists transactional_sends_privacy_definer_erase on leads.transactional_sends;
create policy transactional_sends_privacy_definer_erase on leads.transactional_sends
  for update to influx_privacy_definer
  using (recipient_email is not null and account_id is null)
  with check (account_id is null
              and exists (select 1 from identity.accounts a
                           where a.email = transactional_sends.recipient_email
                             and a.status = 'deleted'));

-- the raw Brevo lines and their outcomes: read; the address cleared at the erasure
grant select (id, email, account_ref, event, occurred_at) on leads.brevo_inbound_events
   to influx_privacy_definer;
grant update (email) on leads.brevo_inbound_events to influx_privacy_definer;
grant select (event_id, account_id, outcome, processed_at) on leads.brevo_inbound_outcomes
   to influx_privacy_definer;

drop policy if exists brevo_inbound_events_privacy_definer_select on leads.brevo_inbound_events;
create policy brevo_inbound_events_privacy_definer_select on leads.brevo_inbound_events
  for select to influx_privacy_definer
  using (true);

drop policy if exists brevo_inbound_events_privacy_definer_erase on leads.brevo_inbound_events;
create policy brevo_inbound_events_privacy_definer_erase on leads.brevo_inbound_events
  for update to influx_privacy_definer
  using (email is not null
         and (account_ref is null
              or exists (select 1 from identity.accounts a
                          where a.id = brevo_inbound_events.account_ref and a.status = 'deleted')))
  with check (email is null);

drop policy if exists brevo_inbound_outcomes_privacy_definer_select on leads.brevo_inbound_outcomes;
create policy brevo_inbound_outcomes_privacy_definer_select on leads.brevo_inbound_outcomes
  for select to influx_privacy_definer
  using (true);

-- the contact states: read (export, Brevo erasure read, Apollo closure)
grant select (account_id, destination, external_contact_id, last_status, last_attempt_at,
              last_success_at, unsubscribed_at, suppressed_reason)
   on leads.contact_sync_states to influx_privacy_definer;

drop policy if exists contact_sync_states_privacy_definer_select on leads.contact_sync_states;
create policy contact_sync_states_privacy_definer_select on leads.contact_sync_states
  for select to influx_privacy_definer
  using (true);

-- the queue: its own two facts only, inserted and read back (closure, Brevo erasure read)
grant select (id, event_type, destination, subject_key, payload, status, locked_by, skip_reason,
              dry_run, provider_message_id, created_at)
   on leads.outbox_events to influx_privacy_definer;
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_privacy_definer;

drop policy if exists outbox_events_privacy_definer_select on leads.outbox_events;
create policy outbox_events_privacy_definer_select on leads.outbox_events
  for select to influx_privacy_definer
  using (event_type in ('account.deleted', 'privacy.export_ready'));

drop policy if exists outbox_events_privacy_definer_insert on leads.outbox_events;
create policy outbox_events_privacy_definer_insert on leads.outbox_events
  for insert to influx_privacy_definer
  with check (status = 'pending' and attempts = 0 and not dry_run
              and ((event_type = 'account.deleted' and priority = 0
                    and destination in ('brevo_contact', 'apollo_contact'))
                   or (event_type = 'privacy.export_ready' and priority = 100
                       and destination = 'brevo_transactional')));

-- the rescue reports naming an address of the account: read; pseudonymised at the erasure
grant select (id, received_at, login_email, contact_email, message, status)
   on backoffice.code_delivery_reports to influx_privacy_definer;
grant update (login_email, contact_email, message) on backoffice.code_delivery_reports
   to influx_privacy_definer;

drop policy if exists code_delivery_reports_privacy_definer_select on backoffice.code_delivery_reports;
create policy code_delivery_reports_privacy_definer_select on backoffice.code_delivery_reports
  for select to influx_privacy_definer
  using (true);

drop policy if exists code_delivery_reports_privacy_definer_erase on backoffice.code_delivery_reports;
create policy code_delivery_reports_privacy_definer_erase on backoffice.code_delivery_reports
  for update to influx_privacy_definer
  using (true)
  with check (exists (select 1 from identity.accounts a
                       where a.email = code_delivery_reports.login_email and a.status = 'deleted'));

-- the member invitations of the account: pseudonymised at the erasure (EC-J8-40)
grant select (id, email, account_id) on backoffice.member_invitations to influx_privacy_definer;
grant update (email) on backoffice.member_invitations to influx_privacy_definer;

drop policy if exists member_invitations_privacy_definer_select on backoffice.member_invitations;
create policy member_invitations_privacy_definer_select on backoffice.member_invitations
  for select to influx_privacy_definer
  using (true);

drop policy if exists member_invitations_privacy_definer_erase on backoffice.member_invitations;
create policy member_invitations_privacy_definer_erase on backoffice.member_invitations
  for update to influx_privacy_definer
  using (true)
  with check (exists (select 1 from identity.accounts a
                       where a.email = member_invitations.email and a.status = 'deleted'
                         and (member_invitations.account_id is null
                              or member_invitations.account_id = a.id)));

-- the register: the journal of activity of the export (codes, dates, actors; never the payload nor
-- the hashes)
grant select (seq, occurred_at, event_type, actor_type, actor_account_id, subject_type, subject_id)
   on audit.audit_events to influx_privacy_definer;

drop policy if exists audit_events_privacy_definer_select on audit.audit_events;
create policy audit_events_privacy_definer_select on audit.audit_events
  for select to influx_privacy_definer
  using (true);

-- the error reports of an account (D60: no address, no body; never the stack)
grant select (id, occurred_at, service, route, message, user_agent_summary, account_id)
   on ops.error_occurrences to influx_privacy_definer;

drop policy if exists error_occurrences_privacy_definer_select on ops.error_occurrences;
create policy error_occurrences_privacy_definer_select on ops.error_occurrences
  for select to influx_privacy_definer
  using (account_id is not null);

-- the register lines of E-5, through audit.append() (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_privacy_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 11.2 influx_identity_definer (the approval, the member's export) ----------------------------------

grant insert (request_id, request_type, account_id, dual_control_request_id, approved_by_account_id)
   on privacy.request_executions to influx_identity_definer;

drop policy if exists request_executions_identity_definer_insert on privacy.request_executions;
create policy request_executions_identity_definer_insert on privacy.request_executions
  for insert to influx_identity_definer
  with check (approved_by_account_id = (select influx.current_account_id())
              and executed_at is null and completed_at is null);

grant update (status) on backoffice.data_subject_requests to influx_identity_definer;

drop policy if exists data_subject_requests_identity_definer_update on backoffice.data_subject_requests;
create policy data_subject_requests_identity_definer_update on backoffice.data_subject_requests
  for update to influx_identity_definer
  using (status <> 'closed')
  with check (status = 'in_progress');

-- the export of the session's own account only: read with its content, a download counted
grant select (id, request_id, account_id, content, sha256, size_bytes, published_at, expires_at,
              downloads_count, purged_at)
   on privacy.data_exports to influx_identity_definer;
grant update (downloads_count) on privacy.data_exports to influx_identity_definer;

drop policy if exists data_exports_identity_definer_select_own on privacy.data_exports;
create policy data_exports_identity_definer_select_own on privacy.data_exports
  for select to influx_identity_definer
  using (account_id = (select influx.current_account_id()));

drop policy if exists data_exports_identity_definer_download on privacy.data_exports;
create policy data_exports_identity_definer_download on privacy.data_exports
  for update to influx_identity_definer
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()) and purged_at is null
              and downloads_count <= 3);

-- 11.3 influx_leads_definer (read_brevo_subject: the expiry of the export announced) -----------------

grant usage on schema privacy to influx_leads_definer;
grant select (id, account_id, expires_at) on privacy.data_exports to influx_leads_definer;

drop policy if exists data_exports_leads_definer_select on privacy.data_exports;
create policy data_exports_leads_definer_select on privacy.data_exports
  for select to influx_leads_definer
  using (true);

-- 11.4 influx_maintenance_definer (the E-4 purge) ---------------------------------------------------

grant usage on schema privacy to influx_maintenance_definer;
grant select (id, expires_at, downloads_count, purged_at) on privacy.data_exports
   to influx_maintenance_definer;
grant update (content) on privacy.data_exports to influx_maintenance_definer;

drop policy if exists data_exports_maintenance_definer_select on privacy.data_exports;
create policy data_exports_maintenance_definer_select on privacy.data_exports
  for select to influx_maintenance_definer
  using (true);

drop policy if exists data_exports_maintenance_definer_purge on privacy.data_exports;
create policy data_exports_maintenance_definer_purge on privacy.data_exports
  for update to influx_maintenance_definer
  using (purged_at is null and (expires_at <= now() or downloads_count >= 3))
  with check (content is null);

-- 11.5 Agent and admin: the account sheet, in aal2; never the address, the messageId, the content
-- nor the digest

grant select (request_id, request_type, account_id, approved_at, approved_by_account_id, executed_at,
              auth_user_deleted_at, completed_at)
   on privacy.request_executions to influx_agent, influx_admin;
grant select (id, request_id, account_id, published_at, expires_at, downloads_count, purged_at)
   on privacy.data_exports to influx_agent, influx_admin;

drop policy if exists request_executions_internal_select on privacy.request_executions;
create policy request_executions_internal_select on privacy.request_executions
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists data_exports_internal_select on privacy.data_exports;
create policy data_exports_internal_select on privacy.data_exports
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 12. Hand the functions to their owners (03 P7 rule 5, window of 0004 §9) ---------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer, influx_identity_definer;
grant create on schema leads to influx_privacy_definer, influx_leads_definer;
grant create on schema backoffice to influx_identity_definer;
grant create on schema ops to influx_maintenance_definer;

alter function privacy.iso_utc(timestamptz) owner to influx_privacy_definer;
alter function privacy.export_categories() owner to influx_privacy_definer;
alter function privacy.account_addresses(uuid) owner to influx_privacy_definer;
alter function privacy.export_document(uuid, text[], jsonb) owner to influx_privacy_definer;
alter function privacy.pending_work(integer) owner to influx_privacy_definer;
alter function privacy.execute_request(uuid, jsonb) owner to influx_privacy_definer;
alter function privacy.record_auth_user_deleted(uuid) owner to influx_privacy_definer;
alter function privacy.complete_request(uuid) owner to influx_privacy_definer;
alter function leads.read_brevo_erasure_subject(bigint, text) owner to influx_privacy_definer;
alter function leads.read_brevo_subject(bigint, text) owner to influx_leads_definer;
alter function ops.purge_data_exports(uuid, smallint, integer) owner to influx_maintenance_definer;
alter function backoffice.approve_data_request_execution(uuid, uuid, uuid,
    backoffice.data_request_type, text) owner to influx_identity_definer;
alter function privacy.read_own_export() owner to influx_identity_definer;
alter function privacy.download_own_export(uuid, uuid) owner to influx_identity_definer;

revoke create on schema privacy from influx_privacy_definer, influx_identity_definer;
revoke create on schema leads from influx_privacy_definer, influx_leads_definer;
revoke create on schema backoffice from influx_identity_definer;
revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_privacy_definer', current_user);
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 13. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('privacy.pending_work(integer)', 'influx_privacy_definer', array['influx_privacy']),
      ('privacy.execute_request(uuid, jsonb)', 'influx_privacy_definer', array['influx_privacy']),
      ('privacy.record_auth_user_deleted(uuid)', 'influx_privacy_definer', array['influx_privacy']),
      ('privacy.complete_request(uuid)', 'influx_privacy_definer', array['influx_privacy']),
      ('leads.read_brevo_erasure_subject(bigint, text)', 'influx_privacy_definer',
        array['influx_worker']),
      ('leads.read_brevo_subject(bigint, text)', 'influx_leads_definer', array['influx_worker']),
      ('ops.purge_data_exports(uuid, smallint, integer)', 'influx_maintenance_definer',
        array['influx_worker']),
      ('backoffice.approve_data_request_execution(uuid, uuid, uuid, backoffice.data_request_type, text)',
        'influx_identity_definer', array['influx_admin']),
      ('privacy.read_own_export()', 'influx_identity_definer',
        array['influx_advertiser', 'influx_creator']),
      ('privacy.download_own_export(uuid, uuid)', 'influx_identity_definer',
        array['influx_advertiser', 'influx_creator']),
      ('backoffice.record_refused_action(text)', 'influx_identity_definer', array['influx_agent']),
      ('ops.claim_periodic_run(ops.periodic_task, text)', 'influx_maintenance_definer',
        array['influx_worker'])
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

  -- the helpers: SECURITY INVOKER, owned by their definer, published to nobody
  foreach v_fn in array array['privacy.iso_utc(timestamptz)', 'privacy.export_categories()',
                              'privacy.account_addresses(uuid)',
                              'privacy.export_document(uuid, text[], jsonb)',
                              'backoffice.canonical_dual_control_payload(text, jsonb, uuid)'] loop
    if (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or exists (select 1
                    from pg_catalog.pg_proc p,
                         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
                   where p.oid = v_fn::regprocedure
                     and a.privilege_type = 'EXECUTE'
                     and a.grantee <> p.proowner) then
      raise exception '% must be SECURITY INVOKER, without grant', v_fn;
    end if;
  end loop;

  -- F7 of the review: influx_privacy_definer owns EXACTLY the closed list of E-5 (its five SECURITY
  -- DEFINER functions and its four SECURITY INVOKER helpers), nothing else
  if not ((select coalesce(pg_catalog.array_agg(p.oid::regprocedure::text), '{}')
                from pg_catalog.pg_proc p
               where p.proowner = 'influx_privacy_definer'::regrole)
             operator(pg_catalog.@>)
             array['privacy.pending_work(integer)', 'privacy.execute_request(uuid,jsonb)',
                   'privacy.record_auth_user_deleted(uuid)', 'privacy.complete_request(uuid)',
                   'leads.read_brevo_erasure_subject(bigint,text)',
                   'privacy.iso_utc(timestamp with time zone)', 'privacy.export_categories()',
                   'privacy.account_addresses(uuid)',
                   'privacy.export_document(uuid,text[],jsonb)']::text[])
     or (select count(*) from pg_catalog.pg_proc p
          where p.proowner = 'influx_privacy_definer'::regrole) <> 9 then
    raise exception 'influx_privacy_definer must own exactly the nine functions of E-5';
  end if;
  -- F7: among the functions of influx_identity_definer, only the member's two read the exports
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = 'influx_identity_definer'::regrole
     and p.prosrc like '%privacy.data_exports%'
     and p.oid not in ('privacy.read_own_export()'::regprocedure,
                       'privacy.download_own_export(uuid, uuid)'::regprocedure);
  if v_bad is not null then
    raise exception 'identity functions reaching privacy.data_exports: %', v_bad;
  end if;

  -- 03 P7: influx_privacy holds NO table right, anywhere; only EXECUTE on its four functions
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('influx', 'reference', 'identity', 'audit', 'billing', 'backoffice', 'leads',
                       'profiles', 'verification', 'campaigns', 'search', 'matching', 'messaging',
                       'ops', 'privacy')
     and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
     and (pg_catalog.has_table_privilege('influx_privacy', c.oid, 'SELECT, INSERT, UPDATE, DELETE, '
                                         'TRUNCATE, REFERENCES, TRIGGER')
          or (c.relkind <> 'S'
              and pg_catalog.has_any_column_privilege('influx_privacy', c.oid,
                                                      'SELECT, INSERT, UPDATE, REFERENCES')));
  if v_bad is not null then
    raise exception 'influx_privacy holds a table right: %', v_bad;
  end if;

  -- no member role reads the two tables; nobody but their writers writes them
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['privacy.request_executions', 'privacy.data_exports']) t
   where r.rolname in ('influx_advertiser', 'influx_creator', 'influx_app', 'influx_auth',
                       'influx_worker', 'influx_ops', 'influx_privacy')
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'SELECT, INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'unexpected right(s) on the privacy tables: %', v_bad;
  end if;

  -- the held address, the messageId, the content and the digest: never for agent nor admin; the
  -- address for its owner only
  if pg_catalog.has_column_privilege('influx_agent', 'privacy.request_executions', 'propagation_email', 'SELECT')
     or pg_catalog.has_column_privilege('influx_admin', 'privacy.request_executions', 'propagation_email', 'SELECT')
     or pg_catalog.has_column_privilege('influx_agent', 'privacy.request_executions', 'notification_message_id', 'SELECT')
     or pg_catalog.has_column_privilege('influx_admin', 'privacy.request_executions', 'notification_message_id', 'SELECT')
     or pg_catalog.has_column_privilege('influx_agent', 'privacy.data_exports', 'content', 'SELECT')
     or pg_catalog.has_column_privilege('influx_admin', 'privacy.data_exports', 'content', 'SELECT')
     or pg_catalog.has_column_privilege('influx_agent', 'privacy.data_exports', 'sha256', 'SELECT')
     or pg_catalog.has_column_privilege('influx_admin', 'privacy.data_exports', 'sha256', 'SELECT') then
    raise exception 'agent or admin reads a protected column of the privacy tables';
  end if;
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_privacy_definer'
     and pg_catalog.has_column_privilege(r.oid, 'privacy.request_executions', 'propagation_email', 'SELECT');
  if v_bad is not null then
    raise exception 'propagation_email readable by: %', v_bad;
  end if;

  -- audit.append(): the identity, maintenance, leads and privacy owners, nobody else of ours
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_identity_definer', 'influx_maintenance_definer',
                           'influx_leads_definer', 'influx_privacy_definer', 'influx_audit_writer')
     and pg_catalog.has_function_privilege(r.oid, 'audit.append(text, text, uuid, jsonb)', 'EXECUTE');
  if v_bad is not null then
    raise exception 'audit.append() executable by: %', v_bad;
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

  -- the owners: no usable member left (C-9: the ADMIN-only migration role), no CREATE kept
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_privacy_definer'
                and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb
                     or rolcreaterole or rolreplication)) then
    raise exception 'influx_privacy_definer must be NOLOGIN NOINHERIT, with no dangerous attribute';
  end if;
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_privacy_definer', 'influx_identity_definer', 'influx_leads_definer',
                         'influx_maintenance_definer', 'influx_audit_writer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if exists (select 1
               from pg_catalog.pg_roles r
               cross join (values ('privacy'), ('leads'), ('backoffice'), ('ops'), ('identity')) s (nsp)
              where r.rolname in ('influx_privacy_definer', 'influx_identity_definer',
                                  'influx_leads_definer', 'influx_maintenance_definer')
                and pg_catalog.has_schema_privilege(r.oid, s.nsp, 'CREATE')) then
    raise exception 'a function owner kept CREATE on a schema';
  end if;
end
$$;
