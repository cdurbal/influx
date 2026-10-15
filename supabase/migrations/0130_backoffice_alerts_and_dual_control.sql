-- =============================================================================
-- 0130_backoffice_alerts_and_dual_control
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 2. The content planned as 0107 in 04 §11.2, renumbered 0130
-- (EC-37). Closes the open point of 0004 §8 and of the J2 security review (accepted
-- point (a)): the dual control (2V) and the fresh re-authentication (R) of
-- identity.grant_role() are now enforced BY THE DATABASE, not by apps/api.
--
--   codes   dual_control.requested, .confirmed, .confirmed_degraded (PD5), .cancelled,
--           .expired (04 §4.3, 15 gap 12; subject dual_control_request); settings.changed
--           (subject setting); ownership.reassigned (subject account).
--   backoffice.alert_definitions   the catalogue of 15 §F, loaded with the alerts of
--           Lot 1 only (section 2): thresholds are DATA.
--   backoffice.dual_control_requests   03 PD4, 15 RG31, queue 15: the four constraints
--           of 04 §5.10, a closed list of actions, a typed reason, the degraded mode of
--           03 §1.3 (PD2: 60 seconds; PD5: its own state and code), single use.
--   functions (influx_identity_definer, EXECUTE for influx_admin only):
--           backoffice.request_dual_control(), backoffice.confirm_dual_control(),
--           backoffice.cancel_dual_control(), and identity.grant_role() REWRITTEN:
--           new signature (p_session_id, p_dual_control_request_id, p_account_id, p_role,
--           p_reason_code); the 0004 signature is dropped (it had no caller, t6-static).
--   helpers (SECURITY INVOKER, owned by influx_identity_definer, NO grant: called by
--           the identity functions only, like identity.consume_member_reauthentication):
--           identity.require_active_admin(), identity.assert_fresh_second_factor(),
--           backoffice.has_peer_admin(), backoffice.consume_dual_control().
--
-- The flow (17b §3.13.c). An admin REQUESTS (pending, expires after the delay of the
-- queue dual_control_pending, 24 calendar hours, read in backoffice.sla_policies). An
-- admin distinct from the requester CONFIRMS with a fresh second factor (peer). While no
-- other active admin exists (PD7, computed at every call: no flag, no code change when a
-- second admin arrives), the requester confirms ALONE, at least 60 seconds after the
-- request (PD2), with a fresh second factor (PD3) and a written justification of 20
-- characters or more (state degraded, code dual_control.confirmed_degraded, PD5). The
-- action function is then called by the CONFIRMER (the requester in degraded mode),
-- with a fresh second factor in ITS transaction, and consumes the request once: same
-- action, same payload, same reason, not expired. Its register line carries
-- dual_control 'peer' or 'degraded_single_operator' (PD5) and the request id.
--
-- Every refusal of the 2V functions and of grant_role() is the same: 42501 'forbidden'
-- (no oracle). The only other error left on purpose is D41: a second role violates
-- account_roles_single_role_mvp (23505), after the checks, and rolls the consumption back.
--
-- EC-J8 (micro-gaps, the safest choice; detail in the comments below):
--   * a degraded confirmation is recorded in degraded_confirmed_at, never in
--     confirmed_by/confirmed_at: the four constraints of 04 §5.10 are kept verbatim
--     (confirmed_by is never the requester), PD4 keeps its two instants;
--   * "an active admin" for PD7 excludes the break-glass account and an admin without a
--     pinned factor (15 RG103: break-glass is never the daily second pair of eyes), and
--     the break-glass account never confirms as a peer (it would be recorded as one);
--   * the closed list of actions holds identity.grant_role only: an action enters it
--     with the function that consumes it (like an elevated operation enters U, 18 T6);
--   * the expiry writer (state expired, dual_control.expired, the requester informed,
--     15 RG31) is not here: until it exists, a pending request past expires_at is
--     treated as expired by every function (nothing can be confirmed nor executed);
--   * recipient_roles (plural) instead of recipient_role: 15 §F names up to two
--     recipients per alert.
--
-- ROLLBACK (before any real request): drop the four new functions, the four helpers and
-- recreate identity.grant_role(uuid, identity.account_role, text) as in 0004 §8 through
-- the same window; drop table backoffice.dual_control_requests,
-- backoffice.alert_definitions; drop the two trigger functions
-- backoffice.prepare_dual_control_request(), backoffice.guard_dual_control_request_update();
-- drop type backoffice.dual_control_state, backoffice.alert_nature; revoke from
-- influx_identity_definer the column grants of section 6.2; delete the seven codes from
-- audit.event_types (possible only while no line references them).
-- =============================================================================

-- 1. The register codes ---------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 03 PD4, 15 RG31: the four-eyes control from end to end
  ('dual_control.requested',          'backoffice', 'dual_control_request', 'critical'),
  ('dual_control.confirmed',          'backoffice', 'dual_control_request', 'critical'),
  -- 03 PD5: a confirmation by the requester alone, isolated by its code in one query
  ('dual_control.confirmed_degraded', 'backoffice', 'dual_control_request', 'critical'),
  ('dual_control.cancelled',          'backoffice', 'dual_control_request', 'critical'),
  ('dual_control.expired',            'backoffice', 'dual_control_request', 'critical'),
  -- 15 RG38: a change of an operating setting, a cap or a delay, nominatively
  ('settings.changed',                'backoffice', 'setting',              'sensitive'),
  -- 04 §4.3: a change of the responsible agent of an account, typed reason
  ('ownership.reassigned',            'backoffice', 'account',              'sensitive')
on conflict (code) do nothing;

-- 2. backoffice.alert_definitions ---------------------------------------------------------------

do $$
begin
  create type backoffice.alert_nature as enum ('etat', 'evenement');
exception when duplicate_object then null;
end
$$;

comment on type backoffice.alert_nature is
  '15 RG64: etat (derived from a condition, rises and falls by itself, no row) or evenement (created '
  'once by a fact, classified by a human: backoffice.alert_instances, Lot 4).';

create table if not exists backoffice.alert_definitions (
  code             text        not null primary key,
  label_key        text        not null,
  nature           backoffice.alert_nature not null,
  threshold_value  jsonb       not null,
  recipient_roles  text[]      not null,
  source_document  text        not null,
  is_active        boolean     not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint alert_definitions_code_format check (code ~ '^AL[1-9][0-9]{0,2}$'),
  constraint alert_definitions_label_key   check (label_key = 'alert.' || code),
  constraint alert_definitions_threshold_object
    check (jsonb_typeof(threshold_value) = 'object' and pg_column_size(threshold_value) <= 2000),
  -- closed vocabulary, extended with the alerts that need more (lock holder, author...)
  constraint alert_definitions_recipients_closed
    check (cardinality(recipient_roles) between 1 and 4
           and recipient_roles <@ array['agent', 'owner_agent', 'admin', 'founder']::text[]),
  constraint alert_definitions_source_document
    check (length(btrim(source_document)) between 2 and 200)
);

comment on table backoffice.alert_definitions is
  'Catalogue of the backoffice alerts (15 §F RG63 to RG68, AL1 to AL48 with 15 RG126): a code, a '
  'threshold written in table, named recipients. Loaded lot by lot: an alert arrives when the objects '
  'its condition reads exist. 0130 loads the alerts of Lot 1 only. NO ALERT TRIGGERS AN AUTOMATIC '
  'SANCTION (15 RG65) and NO ALERT LEAVES FOR BREVO OR APOLLO (15 RG70).';
comment on column backoffice.alert_definitions.threshold_value is
  'The starting threshold of 15 §F, as data (shares in basis points, durations in named units). '
  'A null member is a threshold NOT YET SET by its document (AL25: 05 RG104 gives no count nor window).';
comment on column backoffice.alert_definitions.recipient_roles is
  'agent = every agent; owner_agent = the responsible agent of the object; admin = every admin; '
  'founder = the founder (resolved by the alerting code, never an address in base). 04 §5.10 named '
  'it recipient_role; plural because 15 §F names up to two recipients (EC-J8).';
comment on column backoffice.alert_definitions.source_document is
  'The rule that defines the condition and the expected action.';

drop trigger if exists alert_definitions_touch_updated_at on backoffice.alert_definitions;
create trigger alert_definitions_touch_updated_at
  before update on backoffice.alert_definitions
  for each row execute function influx.touch_updated_at();

-- The alerts of Lot 1: those whose condition reads objects that exist at J8.
--   AL2, AL5     SLA breach and growing queue, on the four queues of 0129
--   AL24 to AL27 leads (05 RG104): unhandled failure, destination down or key refused,
--                late queue (RG79), Brevo unsubscribe gap (ops.periodic_runs.counts)
--   AL33 to AL37 break-glass sign-in, recovery code consumed, unknown browser (EC-43),
--                register chain broken, weekly list of degraded confirmations (PD6)
--   AL40, AL41   data subject request near its deadline, responsibilities of an absent or
--                deactivated agent
--   AL48         deliverability of the sign-in code (16 RG98)
-- Not loaded: AL1 and AL3 (no claim nor lock is stored before Lot 4), AL4 (no queue of J8
-- is habitually fed: they are exception queues), AL38 (no typed list with "other" before
-- Lot 2), AL39 (no journal of refused attempts), AL6 to AL23 and AL28 to AL32 (Lots 2 to 5),
-- AL42 to AL47 (Lot 5, sending from the backoffice).
insert into backoffice.alert_definitions
  (code, label_key, nature, threshold_value, recipient_roles, source_document)
values
  ('AL2',  'alert.AL2',  'etat',
   '{"basis": "sla_policies.target_decision_minutes"}',
   '{agent,admin}', '15 §F (13 A2)'),
  ('AL5',  'alert.AL5',  'etat',
   '{"basis": "sla_policies.target_decision_minutes", "oldest_entry_age_multiplier": 2}',
   '{agent,admin}', '15 §F (backoffice-ops 27)'),
  ('AL24', 'alert.AL24', 'etat',
   '{"queue_code": "lead_sync_failures", "basis": "sla_policies.target_decision_minutes"}',
   '{owner_agent,admin}', '05 RG104'),
  ('AL25', 'alert.AL25', 'evenement',
   '{"immediate_error_codes": ["brevo.unauthorized", "apollo.unauthorized"], "consecutive_failures": null, "window_minutes": null}',
   '{admin}', '05 RG104'),
  ('AL26', 'alert.AL26', 'etat',
   '{"brevo_contact_max_minutes": 60, "apollo_contact_max_minutes": 1440, "min_share_bp": 9900}',
   '{admin}', '05 RG79, RG104'),
  ('AL27', 'alert.AL27', 'etat',
   '{"reconciliation_window_hours": 24, "max_unsubscribe_gap": 0}',
   '{admin}', '05 RG90, RG91, RG104'),
  ('AL33', 'alert.AL33', 'evenement',
   '{"min_occurrences": 1}',
   '{founder,admin}', '03 MFA-10; 15 RG103'),
  ('AL34', 'alert.AL34', 'evenement',
   '{"min_occurrences": 1}',
   '{admin}', '03 MFA-4; 15 RG100'),
  ('AL35', 'alert.AL35', 'evenement',
   '{"basis": "user_agent_summary", "unseen_for_days": 30}',
   '{admin}', '03 B-7, BO-6; EC-43'),
  ('AL36', 'alert.AL36', 'evenement',
   '{"chain_check_statuses": ["broken", "gap"]}',
   '{founder,admin}', '04 §7.2 chain_checks (13 A9)'),
  ('AL37', 'alert.AL37', 'evenement',
   '{"period_days": 7}',
   '{admin,founder}', '03 PD6; 15 RG22'),
  ('AL40', 'alert.AL40', 'etat',
   '{"days_before_due": 7}',
   '{admin}', '15 §G'),
  ('AL41', 'alert.AL41', 'etat',
   '{"on": ["declared_absence", "deactivated"]}',
   '{admin}', '15 RG60, RG62'),
  ('AL48', 'alert.AL48', 'etat',
   '{"median_delivery_seconds_max": 60, "p90_delivery_seconds_max": 180, "no_sign_in_within_minutes": 10, "no_sign_in_share_max_bp": 1500, "delivered_share_min_bp": 9700}',
   '{admin}', '16 RG98, RG99; 15 RG126')
on conflict (code) do nothing;

-- 3. backoffice.dual_control_requests ---------------------------------------------------------------

do $$
begin
  create type backoffice.dual_control_state as enum (
    'pending', 'confirmed', 'degraded', 'cancelled', 'expired');
exception when duplicate_object then null;
end
$$;

comment on type backoffice.dual_control_state is
  'pending (requested), confirmed (by an admin distinct from the requester), degraded (confirmed by '
  'the requester alone, 03 PD1 to PD7), cancelled (abandoned by the requester or refused by an '
  'admin), expired (15 RG31). Execution is consumed_at, not a state: a request serves once.';

create table if not exists backoffice.dual_control_requests (
  id                       uuid        not null default gen_random_uuid() primary key,
  action_code              text        not null,
  payload                  jsonb       not null,
  reason_code              text        not null,
  reason_note              text,
  requested_by_account_id  uuid        not null references identity.accounts (id),
  requested_at             timestamptz not null default now(),
  expires_at               timestamptz not null,
  state                    backoffice.dual_control_state not null default 'pending',
  confirmed_by_account_id  uuid        references identity.accounts (id),
  confirmed_at             timestamptz,
  degraded_confirmed_at    timestamptz,
  degraded_justification   text,
  cancelled_by_account_id  uuid        references identity.accounts (id),
  cancelled_at             timestamptz,
  consumed_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- the closed list: an action enters it with the function that consumes it
  constraint dual_control_action_code_closed check (action_code in ('identity.grant_role')),
  constraint dual_control_payload_object
    check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 2000),
  -- PD4: a typed reason, a free note optional
  constraint dual_control_reason_code_format check (reason_code ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint dual_control_reason_note_bounded
    check (reason_note is null
           or (length(reason_note) between 1 and 500 and reason_note !~ '[\x01-\x09\x0b-\x1f\x7f]')),

  -- 04 §5.10, verbatim: 15 RG31 (expiry in table), backoffice-ops ban 46 (never one's own
  -- second validation), a confirmation is complete, the degraded mode needs a justification
  constraint dual_control_expiry_after_request check (expires_at > requested_at),
  constraint dual_control_second_pair_of_eyes
    check (confirmed_by_account_id is null or confirmed_by_account_id <> requested_by_account_id),
  constraint dual_control_confirmed_is_complete
    check ((state = 'confirmed') = (num_nonnulls(confirmed_by_account_id, confirmed_at) = 2)),
  constraint dual_control_degraded_needs_justification
    check (state <> 'degraded' or length(btrim(coalesce(degraded_justification, ''))) >= 20),

  -- completions of 0130
  constraint dual_control_confirmed_pair
    check (num_nonnulls(confirmed_by_account_id, confirmed_at) in (0, 2)),
  constraint dual_control_degraded_is_complete
    check ((state = 'degraded') = (degraded_confirmed_at is not null)),
  constraint dual_control_justification_only_degraded
    check (degraded_justification is null or state = 'degraded'),
  constraint dual_control_justification_bounded
    check (degraded_justification is null
           or (length(degraded_justification) <= 1000
               and degraded_justification !~ '[\x01-\x09\x0b-\x1f\x7f]')),
  -- 03 PD2: the requester confirms alone 60 seconds after the request at the earliest
  constraint dual_control_degraded_delay
    check (degraded_confirmed_at is null or degraded_confirmed_at >= requested_at + interval '60 seconds'),
  constraint dual_control_cancelled_is_complete
    check ((state = 'cancelled') = (num_nonnulls(cancelled_by_account_id, cancelled_at) = 2)),
  constraint dual_control_cancelled_pair
    check (num_nonnulls(cancelled_by_account_id, cancelled_at) in (0, 2)),
  constraint dual_control_decided_before_expiry
    check (coalesce(confirmed_at, degraded_confirmed_at, cancelled_at) is null
           or (coalesce(confirmed_at, degraded_confirmed_at, cancelled_at) >= requested_at
               and coalesce(confirmed_at, degraded_confirmed_at, cancelled_at) < expires_at)),
  -- single use, of a confirmed request, before its expiry
  constraint dual_control_consumed_once_confirmed
    check (consumed_at is null
           or (state in ('confirmed', 'degraded')
               and consumed_at >= coalesce(confirmed_at, degraded_confirmed_at)
               and consumed_at < expires_at))
);

comment on table backoffice.dual_control_requests is
  'The requests of dual control (03 §1.3 PD1 to PD7, PD4; 15 RG9, RG31; queue 15 dual_control_pending). '
  'Written by the backoffice functions only (request, confirm, cancel) and consumed by the action '
  'function (identity.grant_role() at J8). The decision instants are the transaction time, stamped by '
  'trigger; a decision is taken once, on a pending request, before expires_at. Never deleted.';
comment on column backoffice.dual_control_requests.action_code is
  'Closed list (CHECK): identity.grant_role at J8. An action enters it with its consuming function.';
comment on column backoffice.dual_control_requests.payload is
  'The exact parameters of the action, canonical, identifiers and codes only (C(33) spirit): for '
  'identity.grant_role {"account_id": uuid, "role": account_role}. The action function compares it '
  'whole: a confirmation serves this action, on this object, nothing else.';
comment on column backoffice.dual_control_requests.reason_code is
  'PD4 typed reason, ^[a-z][a-z0-9_]{1,62}$; the action function must be called with the same one.';
comment on column backoffice.dual_control_requests.reason_note is
  'PD4 optional free note, 1 to 500 characters, control characters but line feeds refused. Never '
  'copied to the register (identifiers and codes only).';
comment on column backoffice.dual_control_requests.expires_at is
  'requested_at + target_decision_minutes of the queue dual_control_pending (24 calendar hours, '
  '15 RG31), computed by the BEFORE INSERT trigger: no writer chooses it.';
comment on column backoffice.dual_control_requests.confirmed_by_account_id is
  'The PEER who confirmed: never the requester (dual_control_second_pair_of_eyes). A confirmation by '
  'the requester alone is the degraded state, recorded in degraded_confirmed_at (EC-J8).';
comment on column backoffice.dual_control_requests.degraded_confirmed_at is
  'PD4 second instant of a degraded confirmation, by the requester himself (the confirmer is the '
  'requester by construction). PD2: at least 60 seconds after requested_at (CHECK).';
comment on column backoffice.dual_control_requests.degraded_justification is
  'Written justification of a degraded confirmation, 20 to 1000 characters (04 §5.10).';
comment on column backoffice.dual_control_requests.cancelled_by_account_id is
  'The requester who abandoned, or the admin who refused (17b §3.13.c).';
comment on column backoffice.dual_control_requests.consumed_at is
  'Instant the action was executed under this request, in the same transaction as its register line. '
  'Single use: a consumed request is frozen.';

create or replace function backoffice.prepare_dual_control_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_minutes integer;
begin
  -- 15 RG31: "parametre en table". The expiry runs in calendar time: a policy counted in
  -- business hours is refused rather than misread.
  select p.target_decision_minutes
    into v_minutes
    from backoffice.sla_policies p
   where p.queue_code = 'dual_control_pending'
     and p.is_active
     and p.business_hours is null;
  if v_minutes is null then
    raise exception 'dual_control_pending has no active calendar delay'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  new.requested_at            := pg_catalog.now();
  new.expires_at              := pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes);
  new.state                   := 'pending';
  new.confirmed_by_account_id := null;
  new.confirmed_at            := null;
  new.degraded_confirmed_at   := null;
  new.degraded_justification  := null;
  new.cancelled_by_account_id := null;
  new.cancelled_at            := null;
  new.consumed_at             := null;
  new.created_at              := pg_catalog.now();
  new.updated_at              := pg_catalog.now();
  return new;
end
$$;

comment on function backoffice.prepare_dual_control_request() is
  'BEFORE INSERT on backoffice.dual_control_requests: requested_at = now(), expires_at = now() + the '
  'calendar delay of dual_control_pending (backoffice.sla_policies), state pending, every decision '
  'column empty. SECURITY INVOKER: the writer reads the policy with its own rights.';

create or replace function backoffice.guard_dual_control_request_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id                      is distinct from old.id
     or new.action_code             is distinct from old.action_code
     or new.payload                 is distinct from old.payload
     or new.reason_code             is distinct from old.reason_code
     or new.reason_note             is distinct from old.reason_note
     or new.requested_by_account_id is distinct from old.requested_by_account_id
     or new.requested_at            is distinct from old.requested_at
     or new.expires_at              is distinct from old.expires_at
     or new.created_at              is distinct from old.created_at then
    raise exception 'immutable dual control request column' using errcode = 'insufficient_privilege';
  end if;
  if old.state in ('cancelled', 'expired') or old.consumed_at is not null then
    raise exception 'a closed dual control request is frozen' using errcode = 'insufficient_privilege';
  end if;

  if new.state is distinct from old.state then
    -- a decision is taken once, on a pending request; expiry only once the delay is over
    if old.state <> 'pending' or new.consumed_at is not null then
      raise exception 'dual control transition not allowed' using errcode = 'insufficient_privilege';
    end if;
    if new.state = 'expired' then
      if pg_catalog.now() < old.expires_at then
        raise exception 'the dual control request has not expired yet'
          using errcode = 'insufficient_privilege';
      end if;
    elsif pg_catalog.now() >= old.expires_at then
      raise exception 'the dual control request has expired' using errcode = 'insufficient_privilege';
    end if;
    -- the decision instant is the transaction time, never a supplied value
    new.confirmed_at          := case when new.state = 'confirmed' then pg_catalog.now() end;
    new.degraded_confirmed_at := case when new.state = 'degraded'  then pg_catalog.now() end;
    new.cancelled_at          := case when new.state = 'cancelled' then pg_catalog.now() end;
  else
    if new.confirmed_by_account_id    is distinct from old.confirmed_by_account_id
       or new.confirmed_at            is distinct from old.confirmed_at
       or new.degraded_confirmed_at   is distinct from old.degraded_confirmed_at
       or new.degraded_justification  is distinct from old.degraded_justification
       or new.cancelled_by_account_id is distinct from old.cancelled_by_account_id
       or new.cancelled_at            is distinct from old.cancelled_at then
      raise exception 'a decision is a transition of state' using errcode = 'insufficient_privilege';
    end if;
    if new.consumed_at is distinct from old.consumed_at then
      -- consumption: once, of a confirmed request, before its expiry
      if old.state not in ('confirmed', 'degraded') or new.consumed_at is null
         or pg_catalog.now() >= old.expires_at then
        raise exception 'dual control consumption not allowed' using errcode = 'insufficient_privilege';
      end if;
      new.consumed_at := pg_catalog.now();
    end if;
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function backoffice.guard_dual_control_request_update() is
  'BEFORE UPDATE on backoffice.dual_control_requests: the request itself never changes; a cancelled, '
  'expired or consumed request is frozen; a decision (confirmed, degraded, cancelled) is a transition '
  'from pending before expires_at, stamped now(); expired only from expires_at on; consumption once, '
  'of a confirmed or degraded request, before expires_at, stamped now(). SECURITY INVOKER.';

revoke all on function backoffice.prepare_dual_control_request()      from public;
revoke all on function backoffice.guard_dual_control_request_update() from public;

drop trigger if exists dual_control_requests_prepare on backoffice.dual_control_requests;
create trigger dual_control_requests_prepare
  before insert on backoffice.dual_control_requests
  for each row execute function backoffice.prepare_dual_control_request();

drop trigger if exists dual_control_requests_guard_update on backoffice.dual_control_requests;
create trigger dual_control_requests_guard_update
  before update on backoffice.dual_control_requests
  for each row execute function backoffice.guard_dual_control_request_update();

drop trigger if exists dual_control_requests_no_delete on backoffice.dual_control_requests;
create trigger dual_control_requests_no_delete
  before delete on backoffice.dual_control_requests
  for each row execute function influx.assert_append_only();

drop trigger if exists dual_control_requests_no_truncate on backoffice.dual_control_requests;
create trigger dual_control_requests_no_truncate
  before truncate on backoffice.dual_control_requests
  for each statement execute function influx.assert_append_only();

-- No index besides the key: a handful of rows (one per 2V action), read by id or as a
-- whole by queue 15. An index arrives with a measured query (R10).

-- 4. Helpers: SECURITY INVOKER, owned by influx_identity_definer, no grant -------------------------------

-- 4.1 The caller is an active admin in aal2 (the guard of 0004 §8, shared)
create or replace function identity.require_active_admin()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_caller uuid := influx.current_account_id();
begin
  if v_caller is null
     or not influx.has_aal2()
     or influx.current_account_role() is distinct from 'admin'
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'admin'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller
             and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return v_caller;
end
$$;

comment on function identity.require_active_admin() is
  'Returns the caller when he is an active account with the admin role, an active agent profile, in '
  'an aal2 transaction; 42501 forbidden otherwise. SECURITY INVOKER owned by influx_identity_definer, '
  'NO grant: called by the identity and backoffice functions of that owner only.';

-- 4.2 R: the caller's backoffice session proved its TOTP factor within 300 seconds
create or replace function identity.assert_fresh_second_factor(p_session_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  -- 300 seconds: REAUTHENTICATION_FRESHNESS_SECONDS of apps/api (EC-40 point 2, 03 PD3), read on
  -- the row of 0012 (mfa_verified_at), never the member marker of 0118. A recovery code never
  -- satisfies R (EC-17 point 4).
  perform 1
     from identity.sessions s
    where s.id = p_session_id
      and s.account_id = influx.current_account_id()
      and s.surface = 'backoffice'
      and s.revoked_at is null
      and s.idle_expires_at     > pg_catalog.now()
      and s.absolute_expires_at > pg_catalog.now()
      and s.mfa_method = 'totp'
      and s.mfa_verified_at >= pg_catalog.now() - interval '300 seconds';
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
end
$$;

comment on function identity.assert_fresh_second_factor(uuid) is
  'R in the transaction of the action (03 PD3, J3S-4): p_session_id is an open, unexpired backoffice '
  'session of the CALLER whose last proof is a TOTP code at most 300 seconds old (0012 '
  'mfa_verified_at); 42501 forbidden otherwise. SECURITY INVOKER owned by influx_identity_definer, NO '
  'grant.';

-- 4.3 PD7: is there an active admin other than this account?
create or replace function backoffice.has_peer_admin(p_account_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  -- an admin who can actually confirm: active account and profile, a pinned TOTP factor, and not
  -- the break-glass account (15 RG103: never the daily second pair of eyes)
  select exists (
    select 1
      from identity.accounts a
      join identity.account_roles r  on r.account_id = a.id and r.role = 'admin'
      join identity.agent_profiles p on p.account_id = a.id
     where a.id <> p_account_id
       and a.status = 'active'
       and p.is_active
       and not p.is_break_glass
       and p.mfa_factor_id is not null)
$$;

comment on function backoffice.has_peer_admin(uuid) is
  '03 PD7: true when an admin other than p_account_id can confirm (active account and profile, pinned '
  'TOTP factor, not break-glass). Read at every call: the degraded mode falls by itself when a second '
  'admin arrives. SECURITY INVOKER owned by influx_identity_definer, NO grant.';

-- 4.4 The consumption of a confirmed request, by the action function
create or replace function backoffice.consume_dual_control(
  p_request_id   uuid,
  p_action_code  text,
  p_payload      jsonb,
  p_reason_code  text
)
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_caller        uuid := influx.current_account_id();
  v_state         backoffice.dual_control_state;
  v_requested_by  uuid;
  v_confirmed_by  uuid;
  v_mode          text;
begin
  -- exactly this action, this payload and this reason; confirmed, not expired, never consumed
  select r.state, r.requested_by_account_id, r.confirmed_by_account_id
    into v_state, v_requested_by, v_confirmed_by
    from backoffice.dual_control_requests r
   where r.id = p_request_id
     and r.action_code = p_action_code
     and r.payload = p_payload
     and r.reason_code = p_reason_code
     and r.state in ('confirmed', 'degraded')
     and r.consumed_at is null
     and r.expires_at > pg_catalog.now()
     for update;
  if not found or v_caller is null then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- the confirmer executes: the peer, or the requester alone while no peer exists (PD7)
  if v_state = 'confirmed' and v_confirmed_by = v_caller and v_requested_by <> v_caller then
    v_mode := 'peer';
  elsif v_state = 'degraded' and v_requested_by = v_caller
        and not backoffice.has_peer_admin(v_caller) then
    v_mode := 'degraded_single_operator';
  else
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  update backoffice.dual_control_requests
     set consumed_at = pg_catalog.now()
   where id = p_request_id;
  return v_mode;
end
$$;

comment on function backoffice.consume_dual_control(uuid, text, jsonb, text) is
  '2V of an action (03 PD4 to PD7): locks the request p_request_id and requires it confirmed for '
  'exactly p_action_code, p_payload (compared whole) and p_reason_code, not expired, never consumed, '
  'and the caller its confirmer (the peer; or the requester in degraded mode, while no peer admin '
  'exists, re-read here). Marks it consumed (single use) and returns peer or '
  'degraded_single_operator, for the register line of the action (PD5). 42501 forbidden otherwise. '
  'SECURITY INVOKER owned by influx_identity_definer, NO grant.';

-- 5. The dual control functions (SECURITY DEFINER, influx_identity_definer, EXECUTE for influx_admin) ----

-- 5.1 Request
create or replace function backoffice.request_dual_control(
  p_action_code  text,
  p_payload      jsonb,
  p_reason_code  text,
  p_reason_note  text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid;
  v_target   uuid;
  v_role     identity.account_role;
  v_payload  jsonb;
  v_note     text;
  v_id       uuid;
begin
  v_caller := identity.require_active_admin();

  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,62}$' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_reason_note is not null then
    v_note := nullif(pg_catalog.btrim(
                pg_catalog.regexp_replace(p_reason_note, '[\x01-\x09\x0b-\x1f\x7f]+', ' ', 'g')), '');
    if pg_catalog.length(v_note) > 500 then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- the closed list (with the CHECK of the table), and the exact shape of each payload
  if p_action_code is distinct from 'identity.grant_role'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or (p_payload - 'account_id' - 'role') <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'account_id') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'role') is distinct from 'string'
     or (p_payload ->> 'account_id')
          !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or not ((p_payload ->> 'role')
               = any (pg_catalog.enum_range(null::identity.account_role)::text[])) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  v_target := (p_payload ->> 'account_id')::uuid;
  v_role   := (p_payload ->> 'role')::identity.account_role;

  -- C(3): never on one's own account; R5: an active target, neither suspended nor deleted
  if v_target = v_caller
     or not exists (select 1 from identity.accounts a
                     where a.id = v_target and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- canonical form: the action function rebuilds it the same way and compares it whole
  v_payload := pg_catalog.jsonb_build_object('account_id', v_target, 'role', v_role);

  insert into backoffice.dual_control_requests
    (action_code, payload, reason_code, reason_note, requested_by_account_id)
  values (p_action_code, v_payload, p_reason_code, v_note, v_caller)
  returning id into v_id;

  -- last: the chain lock is held until COMMIT (04 §7.2); never the free note
  perform audit.append('dual_control.requested', 'dual_control_request', v_id,
                       pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                     'reason_code', p_reason_code,
                                                     'action_payload', v_payload));
  return v_id;
end
$$;

comment on function backoffice.request_dual_control(text, jsonb, text, text) is
  '03 PD4, 15 RG31: an active admin in aal2 requests a 2V action. Closed list: identity.grant_role, '
  'payload exactly {"account_id": uuid, "role": account_role}, never on his own account (C(3)), on an '
  'active account (R5); typed reason, optional note of at most 500 characters. Writes the request '
  '(pending, expires after the calendar delay of dual_control_pending) and dual_control.requested '
  '{action_code, reason_code, action_payload}. Returns the request id. Any refusal: 42501 forbidden. '
  'SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for influx_admin ONLY.';

-- 5.2 Confirm
create or replace function backoffice.confirm_dual_control(
  p_session_id              uuid,
  p_request_id              uuid,
  p_degraded_justification  text default null
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller         uuid;
  v_action         text;
  v_payload        jsonb;
  v_requested_by   uuid;
  v_requested_at   timestamptz;
  v_justification  text;
  v_mode           text;
begin
  v_caller := identity.require_active_admin();
  -- PD3, 17b §3.13.c: a fresh second factor, peer and degraded alike
  perform identity.assert_fresh_second_factor(p_session_id);

  select r.action_code, r.payload, r.requested_by_account_id, r.requested_at
    into v_action, v_payload, v_requested_by, v_requested_at
    from backoffice.dual_control_requests r
   where r.id = p_request_id
     and r.state = 'pending'
     and r.expires_at > pg_catalog.now()
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- C(3), 15 RG36: never a decision on an action that targets one's own account
  if (v_payload ->> 'account_id') = v_caller::text then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_requested_by <> v_caller then
    -- the break-glass account is never the second pair of eyes (15 RG103): it is not counted
    -- by PD7 either, and its confirmation would be recorded as a peer's
    if exists (select 1 from identity.agent_profiles p
                where p.account_id = v_caller and p.is_break_glass) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    update backoffice.dual_control_requests
       set state = 'confirmed', confirmed_by_account_id = v_caller
     where id = p_request_id;
    v_mode := 'peer';
    perform audit.append('dual_control.confirmed', 'dual_control_request', p_request_id,
                         pg_catalog.jsonb_build_object('action_code', v_action, 'dual_control', v_mode));
    return v_mode;
  end if;

  -- 03 §1.3: the requester confirms alone only while no other active admin exists (PD7),
  -- 60 seconds after the request at the earliest (PD2), with a written justification
  v_justification := nullif(pg_catalog.btrim(pg_catalog.regexp_replace(
                       coalesce(p_degraded_justification, ''), '[\x01-\x09\x0b-\x1f\x7f]+', ' ', 'g')), '');
  if backoffice.has_peer_admin(v_caller)
     or pg_catalog.now() < v_requested_at + interval '60 seconds'
     or v_justification is null
     or pg_catalog.length(v_justification) not between 20 and 1000 then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  update backoffice.dual_control_requests
     set state = 'degraded', degraded_justification = v_justification
   where id = p_request_id;
  v_mode := 'degraded_single_operator';
  perform audit.append('dual_control.confirmed_degraded', 'dual_control_request', p_request_id,
                       pg_catalog.jsonb_build_object('action_code', v_action, 'dual_control', v_mode));
  return v_mode;
end
$$;

comment on function backoffice.confirm_dual_control(uuid, uuid, text) is
  '03 PD1 to PD7, 17b §3.13.c: an active admin in aal2, with R on p_session_id (TOTP within 300 s), '
  'confirms a pending, unexpired request that does not target his own account. Another admin than the '
  'requester, never the break-glass account (15 RG103): state confirmed, dual_control.confirmed, '
  'returns peer. The requester himself: only while '
  'no other active admin exists (PD7), at least 60 seconds after the request (PD2), with a '
  'justification of 20 to 1000 characters: state degraded, dual_control.confirmed_degraded, returns '
  'degraded_single_operator (PD5). Any refusal: 42501 forbidden. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_admin ONLY.';

-- 5.3 Cancel (abandon by the requester, or refusal by another admin)
create or replace function backoffice.cancel_dual_control(p_request_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller        uuid;
  v_action        text;
  v_payload       jsonb;
  v_requested_by  uuid;
begin
  v_caller := identity.require_active_admin();

  select r.action_code, r.payload, r.requested_by_account_id
    into v_action, v_payload, v_requested_by
    from backoffice.dual_control_requests r
   where r.id = p_request_id
     and r.state = 'pending'
     and r.expires_at > pg_catalog.now()
     for update;
  if not found or (v_payload ->> 'account_id') = v_caller::text then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  update backoffice.dual_control_requests
     set state = 'cancelled', cancelled_by_account_id = v_caller
   where id = p_request_id;
  perform audit.append('dual_control.cancelled', 'dual_control_request', p_request_id,
                       pg_catalog.jsonb_build_object(
                         'action_code', v_action,
                         'by', case when v_requested_by = v_caller then 'requester' else 'peer' end));
end
$$;

comment on function backoffice.cancel_dual_control(uuid) is
  '17b §3.13.c "Abandonner" / "Refuser la demande": an active admin in aal2 cancels a pending, '
  'unexpired request that does not target his own account; nothing is executed. Writes '
  'dual_control.cancelled {action_code, by: requester | peer}. Any refusal: 42501 forbidden. SECURITY '
  'DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for influx_admin ONLY.';

-- 5.4 identity.grant_role(), rewritten with 2V and R (03 §3.1: J, 2V, R, C(3)) ----------------------

drop function if exists identity.grant_role(uuid, identity.account_role, text);

create or replace function identity.grant_role(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_account_id               uuid,
  p_role                     identity.account_role,
  p_reason_code              text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid;
  v_mode    text;
begin
  -- the caller: active admin, active profile, aal2 (0004 §8)
  v_caller := identity.require_active_admin();

  -- C(3): never on one's own account; R5: the target is active, neither suspended nor deleted
  if p_account_id is null
     or p_role is null
     or p_account_id = v_caller
     or not exists (select 1 from identity.accounts
                     where id = p_account_id and status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- R, in THIS transaction (03 PD3, J3S-4): the caller's TOTP proof is at most 300 seconds old
  perform identity.assert_fresh_second_factor(p_session_id);

  -- 2V (03 §3.1, PD4 to PD7): a request confirmed for exactly this action, consumed here once
  v_mode := backoffice.consume_dual_control(
              p_dual_control_request_id,
              'identity.grant_role',
              pg_catalog.jsonb_build_object('account_id', p_account_id, 'role', p_role),
              p_reason_code);

  -- D41: a second role violates account_roles_single_role_mvp (23505), on purpose; the
  -- consumption rolls back with it.
  insert into identity.account_roles (account_id, role, granted_by_account_id)
  values (p_account_id, p_role, v_caller);

  -- last: the chain lock is held until COMMIT (04 §7.2). PD5: the mode of the control.
  perform audit.append(
    'account.role_granted',
    'account',
    p_account_id,
    pg_catalog.jsonb_build_object('role', p_role,
                                  'reason_code', p_reason_code,
                                  'dual_control_request_id', p_dual_control_request_id,
                                  'dual_control', v_mode));
end
$$;

comment on function identity.grant_role(uuid, uuid, uuid, identity.account_role, text) is
  'Grants a role to an account (03 §3.1: J, 2V, R, C(3)). Checks itself the caller (active admin, '
  'active profile, aal2), never his own account (C(3)), an active target (R5); R on p_session_id (TOTP '
  'within 300 s, in this transaction); consumes the dual control request p_dual_control_request_id, '
  'confirmed for identity.grant_role {account_id, role} with this reason, by the caller (peer, or the '
  'requester alone in degraded mode). Writes the role and account.role_granted {role, reason_code, '
  'dual_control_request_id, dual_control: peer | degraded_single_operator} in the same transaction. '
  'Any refusal: 42501 forbidden; 23505 for a second role (D41). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_admin ONLY.';

-- 6. Rights ------------------------------------------------------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy.

alter table backoffice.alert_definitions     enable row level security;
alter table backoffice.alert_definitions     force  row level security;
alter table backoffice.dual_control_requests enable row level security;
alter table backoffice.dual_control_requests force  row level security;
revoke all on backoffice.alert_definitions, backoffice.dual_control_requests
  from public, anon, authenticated, service_role;

-- 6.1 Readers: the catalogue of alerts for agent and admin; the requests for admin (queue 15)

grant select on backoffice.alert_definitions to influx_agent, influx_admin;

drop policy if exists alert_definitions_internal_select on backoffice.alert_definitions;
create policy alert_definitions_internal_select on backoffice.alert_definitions
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

grant select on backoffice.dual_control_requests to influx_admin;

drop policy if exists dual_control_requests_admin_select on backoffice.dual_control_requests;
create policy dual_control_requests_admin_select on backoffice.dual_control_requests
  for select to influx_admin
  using ((select influx.has_aal2()));

-- 6.2 The owner of the functions, column by column

grant select (id, action_code, payload, reason_code, requested_by_account_id, requested_at,
              expires_at, state, confirmed_by_account_id, cancelled_by_account_id, consumed_at)
   on backoffice.dual_control_requests to influx_identity_definer;
grant insert (action_code, payload, reason_code, reason_note, requested_by_account_id)
   on backoffice.dual_control_requests to influx_identity_definer;
grant update (state, confirmed_by_account_id, degraded_justification, cancelled_by_account_id,
              consumed_at)
   on backoffice.dual_control_requests to influx_identity_definer;

drop policy if exists dual_control_requests_identity_definer_select on backoffice.dual_control_requests;
create policy dual_control_requests_identity_definer_select on backoffice.dual_control_requests
  for select to influx_identity_definer
  using (true);

drop policy if exists dual_control_requests_identity_definer_insert on backoffice.dual_control_requests;
create policy dual_control_requests_identity_definer_insert on backoffice.dual_control_requests
  for insert to influx_identity_definer
  with check (state = 'pending'
              and requested_by_account_id = (select influx.current_account_id()));

-- the actor of a decision is the caller, restated under the guard trigger
drop policy if exists dual_control_requests_identity_definer_update on backoffice.dual_control_requests;
create policy dual_control_requests_identity_definer_update on backoffice.dual_control_requests
  for update to influx_identity_definer
  using (state in ('pending', 'confirmed', 'degraded') and consumed_at is null)
  with check ((state <> 'confirmed'
               or confirmed_by_account_id = (select influx.current_account_id()))
              and (state <> 'degraded'
                   or requested_by_account_id = (select influx.current_account_id()))
              and (state <> 'cancelled'
                   or cancelled_by_account_id = (select influx.current_account_id())));

-- the delay of the dual control, read by the BEFORE INSERT trigger (15 RG31, in table)
grant select (queue_code, target_decision_minutes, business_hours, is_active)
   on backoffice.sla_policies to influx_identity_definer;

drop policy if exists sla_policies_identity_definer_select on backoffice.sla_policies;
create policy sla_policies_identity_definer_select on backoffice.sla_policies
  for select to influx_identity_definer
  using (queue_code = 'dual_control_pending');

-- R (0012 columns, policy sessions_identity_definer_select of 0012) and PD7 (break-glass,
-- policy agent_profiles_identity_definer_select of 0004)
grant select (mfa_verified_at, mfa_method) on identity.sessions to influx_identity_definer;
grant select (is_break_glass) on identity.agent_profiles to influx_identity_definer;

-- 6.3 Publication: influx_admin only; the helpers are published to nobody

revoke all on function backoffice.request_dual_control(text, jsonb, text, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.confirm_dual_control(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.cancel_dual_control(uuid)
  from public, anon, authenticated, service_role;
revoke all on function identity.grant_role(uuid, uuid, uuid, identity.account_role, text)
  from public, anon, authenticated, service_role;
revoke all on function identity.require_active_admin()
  from public, anon, authenticated, service_role;
revoke all on function identity.assert_fresh_second_factor(uuid)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.has_peer_admin(uuid)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.consume_dual_control(uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;

grant execute on function backoffice.request_dual_control(text, jsonb, text, text) to influx_admin;
grant execute on function backoffice.confirm_dual_control(uuid, uuid, text)        to influx_admin;
grant execute on function backoffice.cancel_dual_control(uuid)                     to influx_admin;
grant execute on function identity.grant_role(uuid, uuid, uuid, identity.account_role, text)
   to influx_admin;

-- 7. Hand the eight functions to influx_identity_definer (03 P7 rule 5, window of 0004 §9) ---------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity, backoffice to influx_identity_definer;

alter function backoffice.request_dual_control(text, jsonb, text, text) owner to influx_identity_definer;
alter function backoffice.confirm_dual_control(uuid, uuid, text)        owner to influx_identity_definer;
alter function backoffice.cancel_dual_control(uuid)                     owner to influx_identity_definer;
alter function identity.grant_role(uuid, uuid, uuid, identity.account_role, text)
  owner to influx_identity_definer;
alter function identity.require_active_admin()                       owner to influx_identity_definer;
alter function identity.assert_fresh_second_factor(uuid)             owner to influx_identity_definer;
alter function backoffice.has_peer_admin(uuid)                       owner to influx_identity_definer;
alter function backoffice.consume_dual_control(uuid, text, jsonb, text) owner to influx_identity_definer;

revoke create on schema identity, backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 8. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  if to_regprocedure('identity.grant_role(uuid, identity.account_role, text)') is not null then
    raise exception 'the 0004 signature of identity.grant_role() is still there';
  end if;

  -- the four definers: owner, SECURITY DEFINER, empty search_path, influx_admin only;
  -- the four helpers: owner, SECURITY INVOKER, empty search_path, nobody but the owner
  for v_def in
    select * from (values
      ('backoffice.request_dual_control(text, jsonb, text, text)', true,  array['influx_admin']),
      ('backoffice.confirm_dual_control(uuid, uuid, text)',        true,  array['influx_admin']),
      ('backoffice.cancel_dual_control(uuid)',                     true,  array['influx_admin']),
      ('identity.grant_role(uuid, uuid, uuid, identity.account_role, text)',
                                                                   true,  array['influx_admin']),
      ('identity.require_active_admin()',                          false, array[]::text[]),
      ('identity.assert_fresh_second_factor(uuid)',                false, array[]::text[]),
      ('backoffice.has_peer_admin(uuid)',                          false, array[]::text[]),
      ('backoffice.consume_dual_control(uuid, text, jsonb, text)', false, array[]::text[])
    ) as t (fn, definer, callers)
  loop
    v_fn := v_def.fn;
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_identity_definer'
       or (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure) <> v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by influx_identity_definer (SECURITY DEFINER: %), empty search_path',
        v_fn, v_def.definer;
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

  -- nobody writes the two tables directly: the functions' owner only, on the requests
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['backoffice.alert_definitions', 'backoffice.dual_control_requests']) t
   where r.rolname like 'influx\_%'
     and not (r.rolname = 'influx_identity_definer' and t = 'backoffice.dual_control_requests')
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'unexpected write right(s): %', v_bad;
  end if;
  if pg_catalog.has_table_privilege('influx_identity_definer', 'backoffice.dual_control_requests',
                                    'DELETE, TRUNCATE') then
    raise exception 'influx_identity_definer must never delete a dual control request';
  end if;
  -- the requests are read by admin and by the functions' owner, nobody else
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_admin', 'influx_identity_definer')
     and pg_catalog.has_any_column_privilege(r.oid, 'backoffice.dual_control_requests', 'SELECT');
  if v_bad is not null then
    raise exception 'unexpected reader(s) of backoffice.dual_control_requests: %', v_bad;
  end if;

  if (select count(*) from audit.event_types
       where code in ('dual_control.requested', 'dual_control.confirmed',
                      'dual_control.confirmed_degraded', 'dual_control.cancelled',
                      'dual_control.expired', 'settings.changed', 'ownership.reassigned')) <> 7 then
    raise exception 'the seven J8 codes are not all in audit.event_types';
  end if;
  if (select count(*) from backoffice.alert_definitions) <> 14 then
    raise exception 'backoffice.alert_definitions does not hold the fourteen alerts of Lot 1';
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
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema identity or backoffice';
  end if;
end
$$;
