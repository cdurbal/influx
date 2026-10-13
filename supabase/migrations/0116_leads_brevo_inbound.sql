-- =============================================================================
-- 0116_leads_brevo_inbound
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 2. Decision 2 of the J7 start (architect, 2026-10-09): what
-- comes back from Brevo (16 §I RG105 to RG108, RG146, RG147; 05 §J RG89 to RG93;
-- EC-12; M6-6; D60). The route writes a raw, minimal, stateless line and answers;
-- the worker processes it later (E-3); the daily reconciliation (E-4, 0117 and
-- commit 5) writes its findings in the SAME table, through the same processing.
--
--   leads.brevo_inbound_events     raw lines, APPEND-ONLY but for one update: the
--                                  address is set to NULL when the outcome is
--                                  written (arbitration "au plus sûr" of the veto of
--                                  decision 1). Never a body, a header, an IP, a
--                                  subject nor a link. Deleted 30 days after the
--                                  outcome only, never before (trigger), by the E-4
--                                  purge of 0117.
--   leads.brevo_inbound_outcomes   one outcome per raw line, closed list; the account
--                                  only for the events that withdraw a right
--                                  (RG108), never for an open or a click (RG107).
--   leads.record_brevo_event()     E-1 leads.receive_brevo_event, influx_auth ONLY:
--                                  writes a webhook line; returns its id (the subject
--                                  of elevated.leads.receive_brevo_event), or NULL for
--                                  a duplicate (RG146-5: ignored, silently).
--   leads.record_brevo_reconciliation_event()
--                                  E-4 maintenance.run_periodic, influx_worker ONLY:
--                                  the same line with origin = reconciliation and the
--                                  INFLUX_ACCOUNT_ID attribute read at Brevo.
--   leads.process_brevo_inbound_event()
--                                  E-3 (motif leads.drain_outbox), influx_worker ONLY:
--                                  the oldest line without an outcome, all its effects
--                                  and its outcome in ONE transaction.
--   identity.record_transactional_hard_bounce()
--                                  owned by influx_identity_definer, EXECUTE for
--                                  influx_leads_definer ONLY: the incident and
--                                  email_status = undeliverable stay written by the
--                                  identity owner alone (0104 §7).
--
-- The rules of the processing (decision 2):
--   family     RG106: withdraws a right = unsubscribed (unsubscribe, the marketing
--              spelling), spam, hard_bounce, invalid_email, blocked; informs = sent,
--              request, delivered, opened, unique_opened, proxy_open, clicked, click,
--              soft_bounce, deferred, error and the contact events; anything else is
--              unknown: journaled and ignored (RG105). Only the first family has an
--              effect; the other two never name an account (RG107, RG114).
--   channel    transactional when provider_message_id is in leads.transactional_sends,
--              marketing otherwise.
--   account    by message-id (the journal line's account), then by the INFLUX_ACCOUNT_ID
--              of a reconciliation line, then by the EXACT current address. No account:
--              unmatched.
--   address    an effect needs the event's address to be the account's CURRENT address
--              (decision 2 "seulement sur l'adresse courante", applied to every effect
--              as the safest reading: an old address, or the new one of a pending
--              change, never revokes nor closes anything): address_mismatch otherwise.
--   effects    consent_events (marketing_email, false, brevo_webhook) when the consent
--              in force is granted, with consent.revoked priority 0 to Brevo and Apollo
--              (RG89, RG78); leads.contact_sync_states (brevo_contact): unsubscribed_at
--              set once, suppressed_reason = spam_complaint on spam (RG93); a
--              TRANSACTIONAL hard_bounce adds the incident and undeliverable (D37).
--   outcome    rights_withdrawn (an effect was written: the account is the subject of
--              elevated.leads.drain_outbox), no_change, address_mismatch, unmatched,
--              informative, unknown_event. The address of the raw line is then NULL.
--
-- Not here: the route, the whitelist of event names and the ±15 min window (commit 3,
-- the database keeps a ±20 min belt); the subscription to the five "withdraws a right"
-- events only (commit 4); the delivery acknowledgement of a journal line and the proof
-- of RG106 (delivered on intro.reveal_confirmation, Lot 4).
--
-- ROLLBACK (before any real line): drop the five functions; drop the policies
-- *_leads_definer_* and *_identity_definer_* added here and revoke the matching column
-- grants (listed in §6); drop table leads.brevo_inbound_outcomes,
-- leads.brevo_inbound_events; drop function leads.guard_brevo_inbound_event(),
-- leads.guard_brevo_inbound_outcome(); drop type leads.brevo_inbound_outcome,
-- leads.brevo_inbound_origin.
-- =============================================================================

-- 1. Types ------------------------------------------------------------------------------

do $$
begin
  create type leads.brevo_inbound_origin as enum ('webhook', 'reconciliation');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type leads.brevo_inbound_outcome as enum (
    'rights_withdrawn', 'no_change', 'address_mismatch', 'unmatched', 'informative', 'unknown_event');
exception when duplicate_object then null;
end
$$;

comment on type leads.brevo_inbound_origin is
  'webhook: received by the route of apps/api (E-1, decision 1 of J7); reconciliation: found by the '
  'daily reconciliation of the last 48 hours (E-4, 05 RG91, 16 RG113).';
comment on type leads.brevo_inbound_outcome is
  'Closed list of the outcomes of a raw Brevo line (decision 2 of J7). rights_withdrawn: at least '
  'one effect written (consent, contact state, incident); no_change: already applied; '
  'address_mismatch: an account was found but the event''s address is not its current one, nothing '
  'applied; unmatched: no account; informative: an event that informs (16 RG106), never nominative '
  '(RG107); unknown_event: unknown to RG105, journaled and ignored.';

-- 2. leads.brevo_inbound_events ----------------------------------------------------------------

create table if not exists leads.brevo_inbound_events (
  id                   uuid        not null default gen_random_uuid() primary key,
  received_at          timestamptz not null default now(),
  origin               leads.brevo_inbound_origin not null,
  dedup_key            bytea       not null,
  event                text        not null,
  occurred_at          timestamptz not null,
  provider_message_id  text,
  email                text,
  campaign_id          bigint,
  template_id          bigint,
  reason               text,
  account_ref          uuid,

  constraint brevo_inbound_events_dedup_key_key unique (dedup_key),
  constraint brevo_inbound_events_dedup_sha256 check (octet_length(dedup_key) = 32),
  constraint brevo_inbound_events_event_format check (event ~ '^[a-z][a-z0-9_]{0,39}$'),
  constraint brevo_inbound_events_message_id_format
    check (provider_message_id ~ '^[\x21-\x7E]{1,200}$'),
  constraint brevo_inbound_events_email_normalized
    check (email = lower(email) and position('@' in email) > 1 and length(email) <= 320),
  constraint brevo_inbound_events_campaign_positive check (campaign_id >= 1),
  constraint brevo_inbound_events_template_positive check (template_id >= 1),
  constraint brevo_inbound_events_reason_bounded
    check (length(reason) between 1 and 200 and reason !~ '[[:cntrl:]]'),
  constraint brevo_inbound_events_account_ref_reconciliation
    check (account_ref is null or origin = 'reconciliation'),
  -- belt of RG146-4 (the route refuses beyond ±15 minutes); a reconciliation looks back 48 h
  constraint brevo_inbound_events_occurred_window check (
    occurred_at <= received_at + interval '20 minutes'
    and (origin <> 'webhook' or occurred_at >= received_at - interval '20 minutes')
    and occurred_at >= received_at - interval '168 hours')
);

comment on table leads.brevo_inbound_events is
  'Raw events returned by Brevo (decision 2 of J7, 16 RG147): written by the webhook route (E-1, '
  'leads.record_brevo_event) or by the daily reconciliation (E-4), processed later by the worker '
  '(E-3, leads.process_brevo_inbound_event). APPEND-ONLY: the only update is the address set to NULL '
  'once the outcome exists; a line is deleted only 30 days after its outcome (trigger), never '
  'before. *** NEVER a body, a header, an IP address, a subject nor a link (D60) ***. Unsigned '
  'source (16 RG146): nothing irreversible and no proof rests on this content alone (M6-6).';
comment on column leads.brevo_inbound_events.received_at is
  'Reception instant in INFLUX (the transaction time, never supplied).';
comment on column leads.brevo_inbound_events.dedup_key is
  'SHA-256 of (message-id, event, epoch of occurred_at, address), separated by the unit separator, '
  'computed by the database in leads.insert_brevo_inbound_event(): idempotence of RG146-5, an '
  'event already seen is ignored silently. Also serves as provider_event_id of an incident.';
comment on column leads.brevo_inbound_events.event is
  'Name of the Brevo event, normalised by the route (lower case, snake_case, at most 40 characters). '
  'Any value is accepted (RG105: an unknown event is journaled and ignored).';
comment on column leads.brevo_inbound_events.occurred_at is
  'Instant of the event at Brevo (ts_event of a webhook; modifiedAt or event date of a '
  'reconciliation). Bounded around received_at by a constraint.';
comment on column leads.brevo_inbound_events.provider_message_id is
  'message-id of the e-mail concerned: the first key of attachment, through '
  'leads.transactional_sends.provider_message_id (transactional channel).';
comment on column leads.brevo_inbound_events.email is
  'Address of the event, lower case: the last key of attachment (exact current address of an '
  'account). Set to NULL when the outcome is written (decision 2): an address of the raw table '
  'never outlives its processing.';
comment on column leads.brevo_inbound_events.reason is
  'Short reason given by Brevo (bounce, block), cut to 200 characters, control characters and any '
  'address replaced by the database before insertion.';
comment on column leads.brevo_inbound_events.account_ref is
  'Reconciliation only: the INFLUX_ACCOUNT_ID attribute of the Brevo contact (decision 3), the '
  'second key of attachment. No foreign key: an id unknown to INFLUX is an unmatched line, not an '
  'error of the reconciliation.';

-- 3. leads.brevo_inbound_outcomes ----------------------------------------------------------------

create table if not exists leads.brevo_inbound_outcomes (
  event_id      uuid        not null primary key
                            references leads.brevo_inbound_events (id) on delete cascade,
  account_id    uuid        references identity.accounts (id),
  outcome       leads.brevo_inbound_outcome not null,
  processed_at  timestamptz not null default now(),

  -- RG107, RG108: only an event that withdraws a right is nominative
  constraint brevo_inbound_outcomes_account_when_attached
    check ((account_id is not null) = (outcome in ('rights_withdrawn', 'no_change', 'address_mismatch')))
);

comment on table leads.brevo_inbound_outcomes is
  'Outcome of the processing of a raw Brevo line (decision 2 of J7): written once by '
  'leads.process_brevo_inbound_event(), in the same transaction as the effects. APPEND-ONLY; deleted '
  'with its raw line by the purge (30 days after processed_at). An open or a click is never tied to '
  'an account (16 RG107).';
comment on column leads.brevo_inbound_outcomes.account_id is
  'Account the event was attached to, only for an event that withdraws a right (16 RG108): '
  'rights_withdrawn, no_change, address_mismatch. NULL otherwise, by constraint.';

create index if not exists brevo_inbound_outcomes_purge_idx
  on leads.brevo_inbound_outcomes (processed_at);
comment on index leads.brevo_inbound_outcomes_purge_idx is
  'The daily E-4 purge: raw lines whose outcome is older than 30 days (decision 2).';

-- 4. Guards: append-only, one update, deletion after 30 days ----------------------------------

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
  if new.email is null and old.email is not null
     and not exists (select 1 from leads.brevo_inbound_outcomes o where o.event_id = old.id) then
    raise exception 'the address of a raw Brevo line is cleared with its outcome only'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function leads.guard_brevo_inbound_event() is
  'BEFORE UPDATE OR DELETE (row) and BEFORE TRUNCATE (statement) on leads.brevo_inbound_events: the '
  'only update is the address set to NULL once the outcome exists; a delete needs an outcome older '
  'than 30 days; never a truncate. SECURITY INVOKER: the writer reads the outcomes with its own '
  'rights (influx_leads_definer, influx_maintenance_definer).';

create or replace function leads.guard_brevo_inbound_outcome()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.processed_at < pg_catalog.now() - interval '720 hours' then
    return old;   -- the cascade of the purge of its raw line (decision 2)
  end if;
  raise exception 'leads.brevo_inbound_outcomes is append-only (attempted %)', tg_op
    using errcode = 'insufficient_privilege';
end
$$;

comment on function leads.guard_brevo_inbound_outcome() is
  'BEFORE UPDATE OR DELETE (row) and BEFORE TRUNCATE (statement) on leads.brevo_inbound_outcomes: '
  'never updated; deleted only 30 days after processed_at (the cascade of the purge of its raw '
  'line). SECURITY INVOKER, reads nothing.';

revoke all on function leads.guard_brevo_inbound_event()   from public;
revoke all on function leads.guard_brevo_inbound_outcome() from public;

drop trigger if exists brevo_inbound_events_guard on leads.brevo_inbound_events;
create trigger brevo_inbound_events_guard
  before update or delete on leads.brevo_inbound_events
  for each row execute function leads.guard_brevo_inbound_event();

drop trigger if exists brevo_inbound_events_no_truncate on leads.brevo_inbound_events;
create trigger brevo_inbound_events_no_truncate
  before truncate on leads.brevo_inbound_events
  for each statement execute function leads.guard_brevo_inbound_event();

drop trigger if exists brevo_inbound_outcomes_guard on leads.brevo_inbound_outcomes;
create trigger brevo_inbound_outcomes_guard
  before update or delete on leads.brevo_inbound_outcomes
  for each row execute function leads.guard_brevo_inbound_outcome();

drop trigger if exists brevo_inbound_outcomes_no_truncate on leads.brevo_inbound_outcomes;
create trigger brevo_inbound_outcomes_no_truncate
  before truncate on leads.brevo_inbound_outcomes
  for each statement execute function leads.guard_brevo_inbound_outcome();

alter table leads.brevo_inbound_events   enable row level security;
alter table leads.brevo_inbound_events   force  row level security;
alter table leads.brevo_inbound_outcomes enable row level security;
alter table leads.brevo_inbound_outcomes force  row level security;
revoke all on leads.brevo_inbound_events, leads.brevo_inbound_outcomes
  from public, anon, authenticated, service_role;

-- 5. The functions ---------------------------------------------------------------------------------

-- 5.1 The insertion, shared by the webhook and the reconciliation (no grant: its owner only) -------

create or replace function leads.insert_brevo_inbound_event(
  p_origin               leads.brevo_inbound_origin,
  p_event                text,
  p_occurred_at          timestamptz,
  p_provider_message_id  text,
  p_email                text,
  p_campaign_id          bigint,
  p_template_id          bigint,
  p_reason               text,
  p_account_ref          uuid
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_message  text := nullif(pg_catalog.btrim(p_provider_message_id), '');
  v_email    text := nullif(pg_catalog.lower(pg_catalog.btrim(p_email)), '');
  v_reason   text;
  v_id       uuid;
begin
  if p_origin is null then
    raise exception 'the origin is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_event is null or p_event !~ '^[a-z][a-z0-9_]{0,39}$' then
    raise exception 'the event is a normalised name of 1 to 40 characters'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_occurred_at is null
     or p_occurred_at > pg_catalog.now() + interval '20 minutes'
     or (p_origin = 'webhook' and p_occurred_at < pg_catalog.now() - interval '20 minutes')
     or p_occurred_at < pg_catalog.now() - interval '168 hours' then
    raise exception 'the event instant is outside its window' using errcode = 'invalid_parameter_value';
  end if;
  if v_message is not null and v_message !~ '^[\x21-\x7E]{1,200}$' then
    raise exception 'malformed message-id' using errcode = 'invalid_parameter_value';
  end if;
  if v_email is not null
     and (pg_catalog.strpos(v_email, '@') <= 1 or pg_catalog.length(v_email) > 320
          or v_email ~ '[[:space:][:cntrl:]]') then
    raise exception 'malformed address' using errcode = 'invalid_parameter_value';
  end if;
  if p_campaign_id < 1 or p_template_id < 1 then
    raise exception 'a Brevo id is a positive integer' using errcode = 'invalid_parameter_value';
  end if;
  if p_account_ref is not null and p_origin <> 'reconciliation' then
    raise exception 'an account reference comes from the reconciliation only'
      using errcode = 'invalid_parameter_value';
  end if;

  -- D60: a reason is one short line, never an address (an SMTP reason often quotes it).
  if p_reason is not null then
    v_reason := pg_catalog.regexp_replace(p_reason, '[[:cntrl:]]+', ' ', 'g');
    v_reason := pg_catalog.regexp_replace(
      v_reason, '[^[:space:]@<>(),;:"'']+@[^[:space:]@<>(),;:"'']+', '[address]', 'g');
    v_reason := nullif(pg_catalog.left(pg_catalog.btrim(v_reason), 200), '');
  end if;

  -- RG146-5: (message-id, event, instant, address); an event already seen is ignored.
  insert into leads.brevo_inbound_events
    (origin, dedup_key, event, occurred_at, provider_message_id, email, campaign_id, template_id,
     reason, account_ref)
  values
    (p_origin,
     pg_catalog.sha256(pg_catalog.convert_to(
       pg_catalog.concat_ws(pg_catalog.chr(31), coalesce(v_message, ''), p_event,
                            pg_catalog.date_part('epoch', p_occurred_at)::text,
                            coalesce(v_email, '')),
       'UTF8')),
     p_event, p_occurred_at, v_message, v_email, p_campaign_id, p_template_id, v_reason,
     p_account_ref)
  on conflict (dedup_key) do nothing
  returning id into v_id;
  return v_id;
end
$$;

comment on function leads.insert_brevo_inbound_event(leads.brevo_inbound_origin, text, timestamptz,
    text, text, bigint, bigint, text, uuid) is
  'The single insertion of a raw Brevo line, shared by leads.record_brevo_event() (webhook) and '
  'leads.record_brevo_reconciliation_event() (reconciliation): validates (22023), normalises the '
  'address, cleans the reason (one line, 200 characters, addresses replaced), computes the dedup key '
  'and returns the new id, or NULL for a duplicate. SECURITY INVOKER owned by influx_leads_definer, '
  'NO grant: reachable from the two SECURITY DEFINER functions of its owner only.';

-- 5.2 E-1: the webhook (influx_auth) --------------------------------------------------------------

create or replace function leads.record_brevo_event(
  p_event                text,
  p_occurred_at          timestamptz,
  p_provider_message_id  text,
  p_email                text,
  p_campaign_id          bigint,
  p_template_id          bigint,
  p_reason               text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return leads.insert_brevo_inbound_event('webhook', p_event, p_occurred_at, p_provider_message_id,
                                          p_email, p_campaign_id, p_template_id, p_reason, null);
end
$$;

comment on function leads.record_brevo_event(text, timestamptz, text, text, bigint, bigint, text) is
  'E-1 leads.receive_brevo_event (decision 2 of J7, 16 RG147): writes the raw line of a webhook event '
  '(origin webhook) and nothing else - no state, no effect. Returns its id, the subject of '
  'elevated.leads.receive_brevo_event, or NULL for a duplicate (RG146-5: no line, no register line). '
  '22023 for a malformed value or an instant beyond ±20 minutes. SECURITY DEFINER owned by '
  'influx_leads_definer, empty search_path; EXECUTE for influx_auth ONLY.';

-- 5.3 E-4: the reconciliation (influx_worker) -------------------------------------------------------

create or replace function leads.record_brevo_reconciliation_event(
  p_event                text,
  p_occurred_at          timestamptz,
  p_provider_message_id  text,
  p_email                text,
  p_account_ref          uuid,
  p_campaign_id          bigint,
  p_template_id          bigint,
  p_reason               text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return leads.insert_brevo_inbound_event('reconciliation', p_event, p_occurred_at,
                                          p_provider_message_id, p_email, p_campaign_id,
                                          p_template_id, p_reason, p_account_ref);
end
$$;

comment on function leads.record_brevo_reconciliation_event(text, timestamptz, text, text, uuid,
    bigint, bigint, text) is
  'E-4 maintenance.run_periodic (decision 3 of J7, 05 RG91, 16 RG113): writes a finding of the daily '
  'reconciliation as a raw line (origin reconciliation), processed by the same E-3 path as a webhook. '
  'p_account_ref = INFLUX_ACCOUNT_ID of the Brevo contact. Returns the new id, or NULL when the event '
  'is already known (the gap of the reconciliation is the count of non-NULL returns). Instant within '
  'the last 168 hours. SECURITY DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

-- 5.4 The transactional hard bounce, written by the identity owner ----------------------------------

create or replace function identity.record_transactional_hard_bounce(
  p_account_id         uuid,
  p_email              text,
  p_provider_event_id  text,
  p_occurred_at        timestamptz,
  p_reason             text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_current  text;
  v_status   identity.email_status;
  v_wrote    boolean := false;
begin
  if p_account_id is null or p_email is null or p_occurred_at is null
     or p_provider_event_id is null or pg_catalog.length(p_provider_event_id) not between 1 and 200
     or pg_catalog.length(p_reason) > 200 then
    raise exception 'invalid hard bounce' using errcode = 'invalid_parameter_value';
  end if;

  select a.email, a.email_status
    into v_current, v_status
    from identity.accounts a
   where a.id = p_account_id
     for update;
  -- decision 2: only the CURRENT address of the account; anything else changes nothing
  if not found or v_current is distinct from p_email then
    return false;
  end if;

  -- 04 §12.1 point 3: a bounce notified twice counts once (unique provider_event_id)
  insert into identity.email_delivery_incidents
    (account_id, email_address, channel, incident_type, provider, provider_event_id, occurred_at,
     payload)
  values
    (p_account_id, p_email, 'transactional', 'hard_bounce', 'brevo', p_provider_event_id,
     least(p_occurred_at, pg_catalog.now()),
     case when p_reason is null then '{}'::jsonb
          else pg_catalog.jsonb_build_object('reason', p_reason) end)
  on conflict (provider_event_id) do nothing;
  v_wrote := found;

  -- D37: the address IS the authentication factor; a transactional hard bounce closes it
  if v_status is distinct from 'undeliverable' then
    update identity.accounts
       set email_status = 'undeliverable',
           email_undeliverable_at = pg_catalog.now()
     where id = p_account_id;
    v_wrote := true;
  end if;
  return v_wrote;
end
$$;

comment on function identity.record_transactional_hard_bounce(uuid, text, text, timestamptz, text) is
  'Decision 2 of J7 (04 §5.1, D37): a hard bounce of the TRANSACTIONAL channel on the CURRENT address '
  'of an account writes the incident (identity.email_delivery_incidents, idempotent on '
  'provider_event_id) and sets email_status = undeliverable; any other address changes nothing. '
  'Returns true when it wrote. SECURITY DEFINER owned by influx_identity_definer (the only writer of '
  'email_status, 0104 §7), empty search_path; EXECUTE for influx_leads_definer ONLY (called by '
  'leads.process_brevo_inbound_event()).';

-- 5.5 E-3: the processing of one raw line (influx_worker) -------------------------------------------

create or replace function leads.process_brevo_inbound_event()
returns table (
  inbound_event_id  uuid,
  outcome           leads.brevo_inbound_outcome,
  audit_subject     uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_event    record;
  v_family   text;
  v_journal  boolean := false;
  v_channel  identity.email_channel;
  v_account  uuid;
  v_current  text;
  v_granted  boolean;
  v_state    record;
  v_fact     uuid;
  v_effect   boolean := false;
  v_outcome  leads.brevo_inbound_outcome;
begin
  -- 1. The oldest raw line without an outcome, locked. Re-checked after the lock in a fresh
  -- snapshot: a line processed meanwhile by another worker is left (the primary key of the
  -- outcomes is the last belt).
  loop
    select e.id, e.origin, e.dedup_key, e.event, e.occurred_at, e.provider_message_id, e.email,
           e.reason, e.account_ref
      into v_event
      from leads.brevo_inbound_events e
     where not exists (select 1 from leads.brevo_inbound_outcomes o where o.event_id = e.id)
     order by e.received_at, e.id
     limit 1
       for update of e skip locked;
    if not found then
      return;
    end if;
    exit when not exists (select 1 from leads.brevo_inbound_outcomes o where o.event_id = v_event.id);
  end loop;

  -- 2. The family (16 RG106). Only "withdraws a right" has an effect; the others never name an
  -- account (RG107) and never stand for a consent (RG114).
  v_family := case
    when v_event.event in ('unsubscribed', 'unsubscribe', 'spam', 'hard_bounce', 'invalid_email',
                           'blocked') then 'withdraws'
    when v_event.event in ('sent', 'request', 'delivered', 'opened', 'unique_opened', 'proxy_open',
                           'clicked', 'click', 'soft_bounce', 'deferred', 'error', 'list_addition',
                           'contact_updated', 'contact_deleted') then 'informs'
    else 'unknown'
  end;

  if v_family = 'informs' then
    v_outcome := 'informative';
  elsif v_family = 'unknown' then
    v_outcome := 'unknown_event';
  else
    -- 3. Channel and account: message-id, then INFLUX_ACCOUNT_ID, then the exact address.
    if v_event.provider_message_id is not null then
      select t.account_id
        into v_account
        from leads.transactional_sends t
       where t.provider_message_id = v_event.provider_message_id;
      v_journal := found;
    end if;
    v_channel := case when v_journal then 'transactional' else 'marketing' end;
    if v_account is null and v_event.account_ref is not null then
      select a.id into v_account from identity.accounts a where a.id = v_event.account_ref;
    end if;
    if v_account is null and v_event.email is not null then
      select a.id into v_account from identity.accounts a where a.email = v_event.email;
    end if;

    if v_account is null then
      v_outcome := 'unmatched';
    else
      select a.email into v_current from identity.accounts a where a.id = v_account;
      if v_event.email is null or v_event.email is distinct from v_current then
        v_outcome := 'address_mismatch';
      else
        -- 4a. RG89: the consent in force, withdrawn if granted (a refusal wins a tie, RG37).
        select c.granted
          into v_granted
          from identity.consent_events c
         where c.account_id = v_account and c.purpose = 'marketing_email'
         order by c.occurred_at desc, c.granted
         limit 1;
        if v_granted then
          insert into identity.consent_events (account_id, purpose, granted, source, evidence)
          values (v_account, 'marketing_email', false, 'brevo_webhook',
                  pg_catalog.jsonb_build_object('inbound_event_id', v_event.id,
                                                'event', v_event.event,
                                                'origin', v_event.origin));
          -- RG78, RG73: consent.revoked passes ahead of the whole queue, to both contacts
          v_fact := pg_catalog.gen_random_uuid();
          insert into leads.outbox_events
            (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
          select v_fact, 'consent.revoked', d.destination, 'account:' || v_account::text, 0,
                 pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account,
                                               'purpose', 'marketing_email'),
                 'consent.revoked:' || v_fact::text
            from (values ('brevo_contact'::leads.outbox_destination),
                         ('apollo_contact'::leads.outbox_destination)) d (destination);
          v_effect := true;
        end if;

        -- 4b. RG89, RG93: the state of the Brevo contact; a complaint is a definitive suppression.
        select s.unsubscribed_at, s.suppressed_reason
          into v_state
          from leads.contact_sync_states s
         where s.account_id = v_account and s.destination = 'brevo_contact'
           for update;
        if not found then
          insert into leads.contact_sync_states
            (account_id, destination, unsubscribed_at, suppressed_reason)
          values
            (v_account, 'brevo_contact', least(v_event.occurred_at, pg_catalog.now()),
             case when v_event.event = 'spam' then 'spam_complaint' end);
          v_effect := true;
        elsif v_state.unsubscribed_at is null
              or (v_event.event = 'spam' and v_state.suppressed_reason is null) then
          update leads.contact_sync_states s
             set unsubscribed_at   = coalesce(s.unsubscribed_at,
                                              least(v_event.occurred_at, pg_catalog.now())),
                 suppressed_reason = case when v_event.event = 'spam'
                                          then coalesce(s.suppressed_reason, 'spam_complaint')
                                          else s.suppressed_reason end
           where s.account_id = v_account and s.destination = 'brevo_contact';
          v_effect := true;
        end if;

        -- 4c. D37: a transactional hard bounce closes the address (identity owner only).
        if v_channel = 'transactional' and v_event.event = 'hard_bounce' then
          if identity.record_transactional_hard_bounce(v_account, v_event.email,
                                                       pg_catalog.encode(v_event.dedup_key, 'hex'),
                                                       v_event.occurred_at, v_event.reason) then
            v_effect := true;
          end if;
        end if;

        v_outcome := case when v_effect then 'rights_withdrawn'::leads.brevo_inbound_outcome
                          else 'no_change'::leads.brevo_inbound_outcome end;
      end if;
    end if;
  end if;

  -- 5. The outcome, then the address of the raw line cleared (decision 2).
  insert into leads.brevo_inbound_outcomes (event_id, account_id, outcome)
  values (v_event.id,
          case when v_outcome in ('rights_withdrawn', 'no_change', 'address_mismatch')
               then v_account end,
          v_outcome);
  if v_event.email is not null then
    update leads.brevo_inbound_events set email = null where id = v_event.id;
  end if;

  return query select v_event.id, v_outcome, case when v_effect then v_account end;
end
$$;

comment on function leads.process_brevo_inbound_event() is
  'E-3 (motif leads.drain_outbox, decision 2 of J7): processes the OLDEST raw Brevo line without an '
  'outcome (FOR UPDATE SKIP LOCKED), all its effects and its outcome in one transaction, then clears '
  'its address. Withdraws a right (unsubscribed, unsubscribe, spam, hard_bounce, invalid_email, '
  'blocked) on the CURRENT address of the attached account (message-id, INFLUX_ACCOUNT_ID, exact '
  'address): marketing_email consent withdrawn (source brevo_webhook) with consent.revoked priority 0 '
  'to Brevo and Apollo if it was granted; contact state brevo_contact (unsubscribed_at once, '
  'suppressed_reason spam_complaint on spam); transactional hard_bounce => incident + undeliverable. '
  'Informative and unknown events: outcome only, no account. Returns (line id, outcome, audit '
  'subject = the account when an effect was written, else NULL); no row when nothing is waiting. '
  'SECURITY DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 5.6 Publication ------------------------------------------------------------------------------------

revoke all on function leads.insert_brevo_inbound_event(leads.brevo_inbound_origin, text, timestamptz,
    text, text, bigint, bigint, text, uuid) from public, anon, authenticated, service_role;
revoke all on function leads.record_brevo_event(text, timestamptz, text, text, bigint, bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function leads.record_brevo_reconciliation_event(text, timestamptz, text, text, uuid,
    bigint, bigint, text) from public, anon, authenticated, service_role;
revoke all on function leads.process_brevo_inbound_event()
  from public, anon, authenticated, service_role;
revoke all on function identity.record_transactional_hard_bounce(uuid, text, text, timestamptz, text)
  from public, anon, authenticated, service_role;

grant execute on function leads.record_brevo_event(text, timestamptz, text, text, bigint, bigint, text)
   to influx_auth;
grant execute on function leads.record_brevo_reconciliation_event(text, timestamptz, text, text, uuid,
    bigint, bigint, text) to influx_worker;
grant execute on function leads.process_brevo_inbound_event() to influx_worker;
grant execute on function identity.record_transactional_hard_bounce(uuid, text, text, timestamptz, text)
   to influx_leads_definer;

-- 6. Rights of the owners: what the functions read and write, nothing more -------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner.

-- 6.1 influx_leads_definer ---------------------------------------------------------------------------

-- the raw lines: insertion of the described columns, the full read, the address cleared
grant select (id, received_at, origin, dedup_key, event, occurred_at, provider_message_id, email,
              campaign_id, template_id, reason, account_ref)
   on leads.brevo_inbound_events to influx_leads_definer;
grant insert (origin, dedup_key, event, occurred_at, provider_message_id, email, campaign_id,
              template_id, reason, account_ref)
   on leads.brevo_inbound_events to influx_leads_definer;
grant update (email) on leads.brevo_inbound_events to influx_leads_definer;

drop policy if exists brevo_inbound_events_leads_definer_select on leads.brevo_inbound_events;
create policy brevo_inbound_events_leads_definer_select on leads.brevo_inbound_events
  for select to influx_leads_definer
  using (true);

drop policy if exists brevo_inbound_events_leads_definer_insert on leads.brevo_inbound_events;
create policy brevo_inbound_events_leads_definer_insert on leads.brevo_inbound_events
  for insert to influx_leads_definer
  with check (received_at = now());

drop policy if exists brevo_inbound_events_leads_definer_update on leads.brevo_inbound_events;
create policy brevo_inbound_events_leads_definer_update on leads.brevo_inbound_events
  for update to influx_leads_definer
  using (true)
  with check (email is null);

-- the outcomes: written once, read for the "no outcome yet" test and by the guard
grant select (event_id) on leads.brevo_inbound_outcomes to influx_leads_definer;
grant insert (event_id, account_id, outcome) on leads.brevo_inbound_outcomes to influx_leads_definer;

drop policy if exists brevo_inbound_outcomes_leads_definer_select on leads.brevo_inbound_outcomes;
create policy brevo_inbound_outcomes_leads_definer_select on leads.brevo_inbound_outcomes
  for select to influx_leads_definer
  using (true);

drop policy if exists brevo_inbound_outcomes_leads_definer_insert on leads.brevo_inbound_outcomes;
create policy brevo_inbound_outcomes_leads_definer_insert on leads.brevo_inbound_outcomes
  for insert to influx_leads_definer
  with check (processed_at = now());

-- the journal: the account of a message-id, whatever the priority (the sign-in code is P0)
grant select (provider_message_id) on leads.transactional_sends to influx_leads_definer;

drop policy if exists transactional_sends_leads_definer_select_message on leads.transactional_sends;
create policy transactional_sends_leads_definer_select_message on leads.transactional_sends
  for select to influx_leads_definer
  using (provider_message_id is not null);

-- the consent withdrawn by Brevo (05 RG89): marketing_email, false, brevo_webhook, nothing else
grant insert (account_id, purpose, granted, source, evidence)
   on identity.consent_events to influx_leads_definer;

drop policy if exists consent_events_leads_definer_insert on identity.consent_events;
create policy consent_events_leads_definer_insert on identity.consent_events
  for insert to influx_leads_definer
  with check (source = 'brevo_webhook' and purpose = 'marketing_email' and not granted
              and recorded_by_account_id is null and occurred_at = now());

-- the queue: consent.revoked, priority 0, to the two contacts only (RG78)
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_leads_definer;

drop policy if exists outbox_events_leads_definer_insert on leads.outbox_events;
create policy outbox_events_leads_definer_insert on leads.outbox_events
  for insert to influx_leads_definer
  with check (status = 'pending' and attempts = 0 and not dry_run
              and event_type = 'consent.revoked' and priority = 0
              and destination in ('brevo_contact', 'apollo_contact'));

-- the contact state: unsubscription and suppression (0111 left them to their J7 writer)
grant select (unsubscribed_at, suppressed_reason)
   on leads.contact_sync_states to influx_leads_definer;
grant insert (unsubscribed_at, suppressed_reason)
   on leads.contact_sync_states to influx_leads_definer;
grant update (unsubscribed_at, suppressed_reason)
   on leads.contact_sync_states to influx_leads_definer;

-- 6.2 influx_identity_definer: the transactional hard bounce -----------------------------------------

grant select (email_status) on identity.accounts to influx_identity_definer;

grant insert (account_id, email_address, channel, incident_type, provider, provider_event_id,
              occurred_at, payload)
   on identity.email_delivery_incidents to influx_identity_definer;

-- ON CONFLICT (provider_event_id) needs SELECT on its arbiter column, and nothing more
grant select (provider_event_id) on identity.email_delivery_incidents to influx_identity_definer;

drop policy if exists email_delivery_incidents_identity_definer_select on identity.email_delivery_incidents;
create policy email_delivery_incidents_identity_definer_select on identity.email_delivery_incidents
  for select to influx_identity_definer
  using (true);

drop policy if exists email_delivery_incidents_identity_definer_insert on identity.email_delivery_incidents;
create policy email_delivery_incidents_identity_definer_insert on identity.email_delivery_incidents
  for insert to influx_identity_definer
  with check (channel = 'transactional' and incident_type = 'hard_bounce' and provider = 'brevo');

-- 7. Hand the functions to their owners (03 P7 rule 5, window of 0004 §9) ----------------------------
-- The EXECUTE grants above were made by the migration role while it owned the functions:
-- PostgreSQL transfers them to the new owner as grantor.

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
grant create on schema identity to influx_identity_definer;

alter function leads.insert_brevo_inbound_event(leads.brevo_inbound_origin, text, timestamptz, text,
    text, bigint, bigint, text, uuid) owner to influx_leads_definer;
alter function leads.record_brevo_event(text, timestamptz, text, text, bigint, bigint, text)
  owner to influx_leads_definer;
alter function leads.record_brevo_reconciliation_event(text, timestamptz, text, text, uuid, bigint,
    bigint, text) owner to influx_leads_definer;
alter function leads.process_brevo_inbound_event() owner to influx_leads_definer;
alter function identity.record_transactional_hard_bounce(uuid, text, text, timestamptz, text)
  owner to influx_identity_definer;

revoke create on schema leads from influx_leads_definer;
revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 8. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_fn   text;
  v_bad  text;
  v_def  record;
begin
  for v_def in
    select * from (values
      ('leads.record_brevo_event(text, timestamptz, text, text, bigint, bigint, text)',
       'influx_leads_definer', 'influx_auth'),
      ('leads.record_brevo_reconciliation_event(text, timestamptz, text, text, uuid, bigint, bigint, text)',
       'influx_leads_definer', 'influx_worker'),
      ('leads.process_brevo_inbound_event()', 'influx_leads_definer', 'influx_worker'),
      ('identity.record_transactional_hard_bounce(uuid, text, text, timestamptz, text)',
       'influx_identity_definer', 'influx_leads_definer')
    ) as t (fn, owner, caller)
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
       and (a.grantee = 0 or a.grantee::regrole::text <> v_def.caller);
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- the shared insertion: owner only, invoker
  v_fn := 'leads.insert_brevo_inbound_event(leads.brevo_inbound_origin, text, timestamptz, text, '
          'text, bigint, bigint, text, uuid)';
  if (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
     or (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
          where oid = v_fn::regprocedure) <> 'influx_leads_definer' then
    raise exception '% must be SECURITY INVOKER, owned by influx_leads_definer', v_fn;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = v_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner;
  if v_bad is not null then
    raise exception '% executable by: %', v_fn, v_bad;
  end if;

  -- no execution role holds a right on the two raw tables: E-1, E-3 and E-4 go through functions
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['leads.brevo_inbound_events', 'leads.brevo_inbound_outcomes']) t
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_leads_definer', 'influx_maintenance_definer')
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'SELECT, INSERT, UPDATE, REFERENCES')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'unexpected right(s) on the raw Brevo tables: %', v_bad;
  end if;
  if pg_catalog.has_table_privilege('influx_leads_definer', 'leads.brevo_inbound_events', 'DELETE')
     or pg_catalog.has_table_privilege('influx_leads_definer', 'leads.brevo_inbound_outcomes', 'DELETE')
     or pg_catalog.has_any_column_privilege('influx_leads_definer', 'leads.brevo_inbound_outcomes', 'UPDATE') then
    raise exception 'influx_leads_definer may neither delete a raw line nor change an outcome';
  end if;

  -- 0104 §7 still holds: nobody but the identity owner writes email_status
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'email_status', 'UPDATE');
  if v_bad is not null then
    raise exception 'role(s) may write email_status directly: %', v_bad;
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_leads_definer', 'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'function owner left with CREATE on its schema';
  end if;
end
$$;
