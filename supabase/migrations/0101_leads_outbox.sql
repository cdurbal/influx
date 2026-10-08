-- =============================================================================
-- 0101_leads_outbox
-- -----------------------------------------------------------------------------
-- Lot 1 / J5, commit 2. The synchronisation queue towards Brevo and Apollo
-- (04 §5.8, 02 §6 decision A, D18) and the per-destination state of a contact:
--
--   leads.outbox_events        one line per (business fact, destination), inserted
--                              IN THE SAME TRANSACTION as the fact (05 RG73);
--                              payload = identifiers only (05 RG74); the RG35
--                              constraint; the three indexes of 04 §7.4;
--   leads.contact_sync_states  one line per (account, destination), written by the
--                              worker (J6), read by the backoffice (04 §10.7, dn 2);
--   the foreign key leads.transactional_sends.outbox_event_id -> outbox_events(id)
--                              that 0015 left out on purpose (EC-7, EC-37).
--
-- Event codes of the queue: event_type references audit.event_types(code) (04 §5.8).
-- The two lead.* codes emitted at J5 are loaded here; consent.*, email.changed and
-- account.deleted arrive with their emitters (J7).
--
-- Rights at this stage: agent and admin READ the queue and the states (04 §6, "L";
-- the replay is a J8 function). The writers receive their rights with their first
-- caller: influx_identity_definer in 0104 / 0106 (the identity functions emit their
-- events, 04 §5.1), influx_worker at J6. Nobody deletes a line (purge: J6 / 0601).
--
-- ROLLBACK (before any real line): alter table leads.transactional_sends drop
-- constraint transactional_sends_outbox_event_fk; drop index
-- leads.transactional_sends_outbox_event_idx; drop table leads.contact_sync_states,
-- leads.outbox_events; drop function leads.guard_outbox_event_update(); drop type
-- leads.outbox_status, leads.outbox_destination; delete from audit.event_types
-- where code in ('lead.created', 'lead.updated') (possible only while no line uses them).
-- =============================================================================

-- 1. Types and event codes ------------------------------------------------------------

do $$
begin
  create type leads.outbox_destination as enum ('brevo_contact', 'apollo_contact', 'brevo_transactional');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type leads.outbox_status as enum ('pending', 'processing', 'succeeded', 'skipped', 'failed');
exception when duplicate_object then null;
end
$$;

comment on type leads.outbox_destination is
  'brevo_contact and apollo_contact: the contact record at each provider; brevo_transactional: a '
  'service e-mail (P1 / P2) sent through the queue. The sign-in code (P0) NEVER goes through the '
  'queue (D43): it is sent synchronously and journaled in leads.transactional_sends.';
comment on type leads.outbox_status is
  'pending (waiting or waiting for a retry, see available_at), processing (taken by the worker), '
  'succeeded, skipped (a normal case with its reason, never an error: 05 RG36, RG80), failed '
  '(definitive after the retries, cause in clear, replayable from the backoffice: 05 RG79, RG101).';

insert into audit.event_types (code, domain, subject_type, severity) values
  ('lead.created', 'leads', 'account', 'info'),
  ('lead.updated', 'leads', 'account', 'info')
on conflict (code) do nothing;

-- 2. leads.outbox_events ----------------------------------------------------------------

create table if not exists leads.outbox_events (
  id                   bigint      generated always as identity primary key,
  event_id             uuid        not null,
  event_type           text        not null references audit.event_types (code),
  destination          leads.outbox_destination not null,
  subject_key          text        not null,
  priority             smallint    not null default 100,
  payload              jsonb       not null default '{}'::jsonb,
  idempotency_key      text        not null,
  status               leads.outbox_status not null default 'pending',
  skip_reason          text,
  attempts             smallint    not null default 0,
  available_at         timestamptz not null default now(),
  last_error_code      text,
  last_error_message   text,
  provider_message_id  text,
  provider_contact_id  text,
  locked_by            text,
  locked_at            timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  completed_at         timestamptz,

  constraint outbox_events_subject_key_format
    check (subject_key ~ '^[a-z][a-z_]{0,31}:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  constraint outbox_events_priority_range    check (priority between 0 and 1000),
  constraint outbox_events_payload_object    check (jsonb_typeof(payload) = 'object'),
  constraint outbox_events_payload_size      check (pg_column_size(payload) <= 4000),
  -- 05 RG74, 18 TM1.9: identifiers only. An address in a payload is refused outright.
  constraint outbox_events_payload_no_address check (position('@' in payload::text) = 0),
  constraint outbox_events_idempotency_key_format
    check (idempotency_key ~ '^[a-z0-9][a-z0-9._:-]{0,199}$'),
  constraint outbox_events_attempts_range    check (attempts between 0 and 10),
  constraint outbox_events_skip_pair         check ((status = 'skipped') = (skip_reason is not null)),
  constraint outbox_events_skip_reason_format check (skip_reason ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint outbox_events_failed_has_cause  check (status <> 'failed' or last_error_code is not null),
  constraint outbox_events_error_code_format check (last_error_code ~ '^[a-z][a-z0-9_.]{1,62}$'),
  constraint outbox_events_error_message_length check (length(last_error_message) <= 1000),
  constraint outbox_events_provider_ids_length
    check (length(provider_message_id) <= 200 and length(provider_contact_id) <= 200),
  constraint outbox_events_lock_pair         check ((locked_by is null) = (locked_at is null)),
  constraint outbox_events_processing_locked check (status <> 'processing' or locked_at is not null),
  constraint outbox_events_locked_by_length  check (length(locked_by) <= 100),
  constraint outbox_events_completion_pair
    check ((status in ('succeeded', 'skipped', 'failed')) = (completed_at is not null)),
  constraint outbox_events_completion_order  check (completed_at is null or completed_at >= created_at),
  -- RG35, §5.1: the transactional channel never depends on marketing consent.
  constraint outbox_transactional_never_needs_consent
    check (destination <> 'brevo_transactional' or skip_reason is distinct from 'no_consent')
);

comment on table leads.outbox_events is
  'The synchronisation queue (02 §6 decision A, D18): one line per (business fact, destination), '
  'inserted in the SAME transaction as the fact, so that there is neither a fact without its event '
  'nor an event without its fact (05 RG73). Taken by the worker with FOR UPDATE SKIP LOCKED (J6). '
  'Payload = identifiers only: the consumer reads the database again when it acts (05 RG37, RG74). '
  'Purge (04 §8): succeeded after 30 days, failed kept until handled.';
comment on column leads.outbox_events.id is
  'Internal, never exposed. bigint: leads.transactional_sends.outbox_event_id points here (EC-7).';
comment on column leads.outbox_events.event_id is
  'Groups the lines of one fact (one per destination), for the backoffice display (02 §6).';
comment on column leads.outbox_events.event_type is
  'Code of the fact, named in the past tense (lead.created, lead.updated...). Closed list of '
  'audit.event_types; the line itself is NOT a register line.';
comment on column leads.outbox_events.subject_key is
  'Ordering key "<type>:<uuid>" (account:..., introduction:...): the events of one subject are '
  'processed in emission order (05 RG77), under a transaction advisory lock (02 §6).';
comment on column leads.outbox_events.priority is
  '0 = urgent (consent.revoked, account.deleted, security notices: 05 RG78), 100 = normal.';
comment on column leads.outbox_events.payload is
  'Identifiers and codes only (05 RG74, 18 TM1.9): never an address, a name or a content. A payload '
  'containing "@" is refused by a constraint.';
comment on column leads.outbox_events.idempotency_key is
  'Stable key, transmitted to the provider (05 RG76): includes the event id for a contact update, '
  'NOT for an e-mail that is unique by nature (welcome: once per account, replay included).';
comment on column leads.outbox_events.skip_reason is
  'Why the line was skipped (no_consent, out_of_apollo_scope, country_not_validated, '
  'skipped_non_production...): a normal case, never shown among the failures (05 RG36, RG80).';
comment on column leads.outbox_events.last_error_message is
  'Cause IN CLEAR, readable in the backoffice (05 RG99). Never a provider payload, never an address.';
comment on column leads.outbox_events.provider_message_id is
  'messageId returned by Brevo for a transactional line: the link between our records and the proof '
  'held by a third party (01 M2).';
comment on column leads.outbox_events.locked_by is
  'Worker instance that took the line: observability only, the lock itself is FOR UPDATE SKIP LOCKED.';
comment on constraint outbox_transactional_never_needs_consent on leads.outbox_events is
  'RG35: a transactional e-mail (the sign-in code first of all, D37) can NEVER be skipped for lack '
  'of marketing consent. A consent withdrawal that would leave a member unable to sign in would be '
  'a blocking defect: the database makes it impossible.';

-- 04 §7.4: three indexes, not one more, each backed by a real query (04 §10.4).
create index if not exists outbox_events_claim_idx
  on leads.outbox_events (priority, available_at, id)
  where status = 'pending';
comment on index leads.outbox_events_claim_idx is
  'The worker loop, every 2 seconds: where status = pending and available_at <= now() order by '
  'priority, available_at, id limit 20 for update skip locked. Column order = the ORDER BY.';

create index if not exists outbox_events_failed_idx
  on leads.outbox_events (updated_at desc)
  where status = 'failed';
comment on index leads.outbox_events_failed_idx is
  'Backoffice screen "synchronisation failures", sorted by age (05 RG99, RG101).';

create unique index if not exists outbox_events_idempotency_idx
  on leads.outbox_events (destination, idempotency_key);
comment on index leads.outbox_events_idempotency_idx is
  'Idempotence of a replay (05 RG76, 18 TM1.3): a replay asked twice creates no duplicate at the '
  'provider. Functional guarantee, not optimisation.';

-- The description of a line never changes; only its processing state moves.
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
  return new;
end
$$;

comment on function leads.guard_outbox_event_update() is
  'BEFORE UPDATE on leads.outbox_events: the fact, its destination, its ordering key, its payload '
  'and its idempotency key never change; only the processing columns move (status, attempts, '
  'available_at, errors, provider ids, lock). SECURITY INVOKER, reads nothing.';

revoke all on function leads.guard_outbox_event_update() from public;

drop trigger if exists outbox_events_guard on leads.outbox_events;
create trigger outbox_events_guard
  before update on leads.outbox_events
  for each row execute function leads.guard_outbox_event_update();

drop trigger if exists outbox_events_touch_updated_at on leads.outbox_events;
create trigger outbox_events_touch_updated_at
  before update on leads.outbox_events
  for each row execute function influx.touch_updated_at();

-- 3. leads.contact_sync_states ------------------------------------------------------------

create table if not exists leads.contact_sync_states (
  account_id              uuid        not null references identity.accounts (id),
  destination             leads.outbox_destination not null,
  external_contact_id     text,
  last_attempt_at         timestamptz,
  last_success_at         timestamptz,
  last_status             leads.outbox_status not null default 'pending',
  last_error_code         text,
  unsubscribed_at         timestamptz,
  suppressed_reason       text,
  last_marketing_sent_at  timestamptz,
  marketing_sends_30d     smallint    not null default 0,
  marketing_counters_at   timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint contact_sync_states_pkey primary key (account_id, destination),
  -- 04 §5.8: the channel that carries the sign-in code has no unsubscription state; its
  -- health lives in identity (email_status, email_delivery_incidents).
  constraint contact_sync_states_no_transactional check (destination <> 'brevo_transactional'),
  constraint contact_sync_states_external_id_length check (length(external_contact_id) <= 200),
  constraint contact_sync_states_error_code_format  check (last_error_code ~ '^[a-z][a-z0-9_.]{1,62}$'),
  constraint contact_sync_states_suppressed_format  check (suppressed_reason ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint contact_sync_states_sends_positive     check (marketing_sends_30d >= 0),
  constraint contact_sync_states_success_after_attempt
    check (last_success_at is null or (last_attempt_at is not null and last_success_at <= last_attempt_at))
);

comment on table leads.contact_sync_states is
  'State of a contact per destination (Brevo, Apollo), written by the worker at the end of each '
  'processing (J6). Assumed denormalisation n°2 (04 §10.7): the "sign-ups and synchronisation state" '
  'screen would otherwise need a DISTINCT ON over the whole queue at every display. A Brevo '
  'unsubscription writes identity.consent_events AND sets unsubscribed_at here: the truth of consent '
  'stays in one place (identity).';
comment on column leads.contact_sync_states.external_contact_id is
  'Id of the contact at the provider (Brevo contact id, Apollo contact id). Never an enriched datum '
  '(05 RG85).';
comment on column leads.contact_sync_states.last_error_code is
  'Cause of the last skip or failure, a code translated in clear by the backoffice (05 RG99).';
comment on column leads.contact_sync_states.marketing_sends_30d is
  'Cadence counter over 30 sliding days (16 RG80), pushed to the Brevo attribute MARKETING_SENDS_30D '
  'by the usual queue. HERE rather than in a table of its own: it is a synchronisation state per '
  '(account, destination), written by the worker that already writes this row. NOT A VIEW: a view '
  'would scan the queue at every send, and the counter must be pushed, hence materialised. '
  'marketing_counters_at says WHEN the window was recomputed.';
comment on column leads.contact_sync_states.last_marketing_sent_at is
  'Last SUCCESSFUL marketing transmission, whatever the source (16 RG80). A contact out of cadence is '
  'set aside automatically, a normal case, never a failure (16 RG81, RG83).';

create index if not exists contact_sync_states_status_idx
  on leads.contact_sync_states (last_status);
comment on index leads.contact_sync_states_status_idx is
  'Backoffice list "sign-ups not synchronised", filtered by state (04 §10.4).';

drop trigger if exists contact_sync_states_touch_updated_at on leads.contact_sync_states;
create trigger contact_sync_states_touch_updated_at
  before update on leads.contact_sync_states
  for each row execute function influx.touch_updated_at();

-- 4. The foreign key of leads.transactional_sends (EC-7, EC-37) ---------------------------

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'transactional_sends_outbox_event_fk'
                    and conrelid = 'leads.transactional_sends'::regclass) then
    alter table leads.transactional_sends
      add constraint transactional_sends_outbox_event_fk
      foreign key (outbox_event_id) references leads.outbox_events (id);
  end if;
end
$$;

comment on column leads.transactional_sends.outbox_event_id is
  'Queue event of a P1 / P2 e-mail; always NULL for a P0 (D43). bigint (EC-7); foreign key to '
  'leads.outbox_events(id) since 0101 (EC-37). NO ACTION on delete: the purge of the queue (30 days '
  'after success) must not take away a line still referenced by this 13-month journal.';

create index if not exists transactional_sends_outbox_event_idx
  on leads.transactional_sends (outbox_event_id)
  where outbox_event_id is not null;
comment on index leads.transactional_sends_outbox_event_idx is
  'Serves the foreign key check run on every delete of a queue line (the purge of 04 §8); without '
  'it, each deleted line scans the journal.';

-- 5. Row level security and privileges ------------------------------------------------------

alter table leads.outbox_events       enable row level security;
alter table leads.outbox_events       force  row level security;
alter table leads.contact_sync_states enable row level security;
alter table leads.contact_sync_states force  row level security;

revoke all on leads.outbox_events, leads.contact_sync_states
  from public, anon, authenticated, service_role;

-- 04 §6: agent and admin READ the queue and the states (backoffice, 05 RG97 to RG101),
-- in aal2; the replay is a named function at J8. Members never see the queue.
grant usage on schema leads to influx_agent, influx_admin;
grant select on leads.outbox_events, leads.contact_sync_states to influx_agent, influx_admin;

drop policy if exists outbox_events_internal_select on leads.outbox_events;
create policy outbox_events_internal_select on leads.outbox_events
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists contact_sync_states_internal_select on leads.contact_sync_states;
create policy contact_sync_states_internal_select on leads.contact_sync_states
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 6. End-state assertions ---------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['leads.outbox_events', 'leads.contact_sync_states']) t
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'INSERT')
          or pg_catalog.has_any_column_privilege(r.oid, t, 'UPDATE')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE')
          or pg_catalog.has_table_privilege(r.oid, t, 'TRUNCATE')
          or (pg_catalog.has_any_column_privilege(r.oid, t, 'SELECT')
              and r.rolname not in ('influx_agent', 'influx_admin')));
  if v_bad is not null then
    raise exception 'unexpected right(s) on the queue tables: %', v_bad;
  end if;
end
$$;
