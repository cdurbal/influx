-- =============================================================================
-- 0129_backoffice_queues_and_sla
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 2. The content planned as 0102 in 04 §11.2, renumbered 0129
-- (EC-37: the CLI refuses a number lower than the last one applied, 0128).
--
--   backoffice.queues        the CLOSED catalogue of the backoffice queues (15 RG26,
--         RG29): "a queue absent from the catalogue does not exist". Key: code.
--   backoffice.sla_policies  one delay policy per queue (D39, 15 RG29, RG38): the
--         delays are DATA, changed by a row update, never a constant in code.
--
-- Both directions are declarative: sla_policies.queue_code -> queues.code (a delay
-- without a queue is impossible) and queues.code -> sla_policies.queue_code,
-- DEFERRABLE INITIALLY DEFERRED (a queue without a delay is impossible at COMMIT).
-- 04 §5.10 claimed the first key alone made both impossible; it does not.
--
-- Which queues: "a queue arrives with the lot that fills it" (04 §5.10). J8 feeds
-- four of the sixteen, and only these are loaded:
--   12 lead_sync_failures        failed lines of leads.outbox_events (05 RG99 to RG104,
--                                the replay of J8 commit 6)
--   13 email_delivery_incidents  identity.email_delivery_incidents and the rescue
--                                reports of backoffice.code_delivery_reports (05 RG65)
--   14 data_subject_requests     backoffice.data_subject_requests (E-5 brought forward
--                                to J8, 21 §J8 point 6)
--   15 dual_control_pending      backoffice.dual_control_requests (0130)
-- The eleven others (profiles, portfolio, verification, campaigns, introductions,
-- team selection, reports, documents, identity changes, email_send_failures) arrive
-- with Lots 2 to 5, each with its policy.
--
-- D39 (decision within ONE business day): the column defaults ARE the starting value
-- of 04 §5.10 (target_decision_minutes 480 = one business day of 8 hours,
-- escalate_after_minutes 480, business_hours Monday to Friday), so that every queue
-- loaded later without a delay of its own inherits it. None of the four J8 queues has
-- the common delay (15 RG29): two are PROPOSALS not validated (15 Q4), marked
-- is_provisional so that a proposal never becomes a rule by the passing of time
-- (04 §12.7); the delay of data subject requests is the internal objective of 10
-- business days (the LEGAL month is held by data_subject_requests.due_at, 0127, and
-- is not an SLA: 15 RG37); the dual control expires after 24 calendar hours (15 RG31).
--
-- EC-J8 (micro-gaps, the safest choice): the key of queues is `code` (as every
-- catalogue of ours: reference.countries, audit.event_types), the foreign key
-- `queue_code`, as the SQL of 04 §5.10 writes it (its table row says `queue_code PK`).
-- The time zone of the business hours is not decided: UTC waits (as the time zone of an
-- account without one, 05 RG-dates), a row update when the founder decides.
--
-- Readers: agent and admin in aal2 (03 §3.5 "Tableau de bord, indicateurs agrégés" L;
-- 15 RG28 counters). Writers: the migrations only. The admin write path (15 RG38,
-- settings.changed) arrives with its first caller. influx_identity_definer reads the
-- delay of dual_control_pending from 0130.
--
-- ROLLBACK (no business row references these tables): alter table backoffice.queues
-- drop constraint queues_sla_policy_fk; drop table backoffice.sla_policies,
-- backoffice.queues; drop function backoffice.assert_sla_policy().
-- =============================================================================

-- 1. backoffice.queues ------------------------------------------------------------------------

create table if not exists backoffice.queues (
  code                text        not null primary key,
  label_key           text        not null,
  spec_document       text        not null,
  handled_by_roles    identity.account_role[] not null,
  allows_bulk_action  boolean     not null,
  has_lock            boolean     not null,
  is_active           boolean     not null default true,
  introduced_at       timestamptz not null default now(),
  retired_at          timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint queues_code_format      check (code ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint queues_label_key        check (label_key = 'queue.' || code),
  constraint queues_spec_document    check (length(btrim(spec_document)) between 2 and 200),
  -- internal roles only: a member never handles a queue
  constraint queues_handled_by_internal
    check (cardinality(handled_by_roles) between 1 and 2
           and handled_by_roles <@ array['agent', 'admin']::identity.account_role[]),
  constraint queues_retired_inactive
    check (retired_at is null or (not is_active and retired_at >= introduced_at))
);

comment on table backoffice.queues is
  'Closed catalogue of the backoffice queues (15 RG26, RG29, RG125): a queue absent from it does not '
  'exist. Loaded by migration, lot by lot: a queue arrives with the lot that fills it (0129: the four '
  'queues of J8). spec_document names the document that has authority on the CONTENT of the queue; '
  '15 has authority on delay, claim objective, lock, roles and bulk action. Every queue has exactly '
  'one row in backoffice.sla_policies (two foreign keys). EXPECTED CONTROL (18): every queue served by '
  'apps/backoffice has a row here.';
comment on column backoffice.queues.code is
  'queue_code of 15 RG29. Referenced as queue_code by backoffice.sla_policies.';
comment on column backoffice.queues.label_key is
  'Translation key of the queue name, always queue.<code> (no French or English label in base, R8).';
comment on column backoffice.queues.spec_document is
  'Document and rules that specify what enters the queue, its reasons and messages (15 RG29).';
comment on column backoffice.queues.handled_by_roles is
  'Roles that handle the queue (15 RG29 "Qui traite"); the finer rules (an admin distinct from the '
  'requester, execution by admin) belong to spec_document and to the functions.';
comment on column backoffice.queues.allows_bulk_action is
  '15 RG29 "Action de masse": true for lead_sync_failures only at J8 (replay of at most 200).';
comment on column backoffice.queues.has_lock is
  '15 RG27 C2/C3: nominal lock of 30 minutes. False for lead_sync_failures (RG30: the replay is '
  'idempotent) and dual_control_pending.';
comment on column backoffice.queues.retired_at is
  'A queue is retired, never deleted: its past entries and their delays stay readable.';

-- 2. backoffice.sla_policies ----------------------------------------------------------------------

create table if not exists backoffice.sla_policies (
  queue_code               text        not null primary key,
  target_claim_minutes     integer,
  target_decision_minutes  integer     not null default 480,
  business_hours           jsonb
    default '{"time_zone": "UTC", "days": [1, 2, 3, 4, 5], "opens": "09:00", "closes": "17:00"}'::jsonb,
  escalate_after_minutes   integer     default 480,
  is_provisional           boolean     not null default false,
  is_active                boolean     not null default true,
  updated_by_account_id    uuid        references identity.accounts (id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  -- a delay without a queue is impossible
  constraint sla_policies_queue_fk
    foreign key (queue_code) references backoffice.queues (code),
  constraint sla_policies_claim_range
    check (target_claim_minutes is null or target_claim_minutes between 1 and 525600),
  constraint sla_policies_decision_range
    check (target_decision_minutes between 1 and 525600),
  constraint sla_policies_claim_before_decision
    check (target_claim_minutes is null or target_claim_minutes <= target_decision_minutes),
  constraint sla_policies_escalation_range
    check (escalate_after_minutes is null or escalate_after_minutes between 0 and 525600),
  -- NULL: calendar time (24/7). Otherwise a closed shape, the time zone checked by trigger.
  constraint sla_policies_business_hours_shape check (
    business_hours is null
    or (jsonb_typeof(business_hours) = 'object'
        and business_hours ?& array['time_zone', 'days', 'opens', 'closes']
        and (business_hours - 'time_zone' - 'days' - 'opens' - 'closes') = '{}'::jsonb
        and jsonb_typeof(business_hours -> 'time_zone') = 'string'
        and length(business_hours ->> 'time_zone') between 1 and 64
        and jsonb_typeof(business_hours -> 'days') = 'array'
        and jsonb_array_length(business_hours -> 'days') between 1 and 7
        and not jsonb_path_exists(business_hours -> 'days',
              '$[*] ? (@.type() != "number" || @ < 1 || @ > 7 || @.floor() != @)')
        and jsonb_typeof(business_hours -> 'opens') = 'string'
        and jsonb_typeof(business_hours -> 'closes') = 'string'
        and (business_hours ->> 'opens')  ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (business_hours ->> 'closes') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        and (business_hours ->> 'opens') < (business_hours ->> 'closes')))
);

comment on table backoffice.sla_policies is
  'One delay policy per queue (15 RG26, RG29, RG38; D39 decided: decision within one business day). '
  'The delays are DATA: tightening one is a row update, never a deployment; every change is reserved '
  'to admin and journalled nominatively (settings.changed, with its first writer). A policy is read '
  'once, when an entry is created (its deadline is frozen then, 04 §5.6 rule R7).';
comment on column backoffice.sla_policies.target_claim_minutes is
  'Internal objective of claim (15 RG29), in minutes counted in business_hours. NULL where 15 writes '
  '"—" (lead_sync_failures, dual_control_pending).';
comment on column backoffice.sla_policies.target_decision_minutes is
  'Decision delay, in minutes counted in business_hours (in calendar minutes when business_hours is '
  'NULL). Default 480: one business day of 8 hours (D39).';
comment on column backoffice.sla_policies.business_hours is
  'Calendar of the counted minutes: {"time_zone": IANA name, "days": ISO days 1 (Monday) to 7, '
  '"opens": "HH:MM", "closes": "HH:MM"}; NULL = calendar time 24/7 (the 24 hours of a dual control). '
  'Default Monday to Friday, 09:00 to 17:00 (D39); time zone UTC is a WAITING value (not decided).';
comment on column backoffice.sla_policies.escalate_after_minutes is
  'Minutes after the decision deadline before an administrator is alerted (D39 "escalade au-delà"; '
  '13 RG99: J+1 on introductions). NULL: no escalation, the entry expires instead '
  '(dual_control_pending, 15 RG31).';
comment on column backoffice.sla_policies.is_provisional is
  'True on a delay PROPOSED and not validated (15 Q2 to Q4): a proposal never becomes a rule by the '
  'passing of time (04 §12.7). Cleared by the founder''s decision, a row update.';
comment on column backoffice.sla_policies.updated_by_account_id is
  'Administrator who last changed the policy; NULL for a value loaded by a migration.';

-- a queue without a delay is impossible: checked at COMMIT, so that a queue and its policy are
-- inserted (or retired) in one transaction
do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'queues_sla_policy_fk'
                    and conrelid = 'backoffice.queues'::regclass) then
    alter table backoffice.queues add constraint queues_sla_policy_fk
      foreign key (code) references backoffice.sla_policies (queue_code)
      deferrable initially deferred;
  end if;
end
$$;

comment on constraint queues_sla_policy_fk on backoffice.queues is
  'With sla_policies_queue_fk, the two halves of 15 RG26: no queue without a delay (checked at '
  'COMMIT), no delay without a queue.';

-- What a CHECK cannot read: the time zone (pg_timezone_names) and duplicate days.
create or replace function backoffice.assert_sla_policy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.business_hours is not null then
    if not exists (select 1 from pg_catalog.pg_timezone_names z
                    where z.name = new.business_hours ->> 'time_zone') then
      raise exception 'unknown time zone in business_hours' using errcode = 'check_violation';
    end if;
    if (select count(distinct d) from pg_catalog.jsonb_array_elements(new.business_hours -> 'days') d)
         <> pg_catalog.jsonb_array_length(new.business_hours -> 'days') then
      raise exception 'business_hours lists a day twice' using errcode = 'check_violation';
    end if;
  end if;
  return new;
end
$$;

comment on function backoffice.assert_sla_policy() is
  'BEFORE INSERT OR UPDATE on backoffice.sla_policies: the time zone of business_hours exists '
  '(pg_timezone_names) and no day appears twice. SECURITY INVOKER.';

revoke all on function backoffice.assert_sla_policy() from public;

drop trigger if exists sla_policies_assert on backoffice.sla_policies;
create trigger sla_policies_assert
  before insert or update on backoffice.sla_policies
  for each row execute function backoffice.assert_sla_policy();

drop trigger if exists sla_policies_touch_updated_at on backoffice.sla_policies;
create trigger sla_policies_touch_updated_at
  before update on backoffice.sla_policies
  for each row execute function influx.touch_updated_at();

drop trigger if exists queues_touch_updated_at on backoffice.queues;
create trigger queues_touch_updated_at
  before update on backoffice.queues
  for each row execute function influx.touch_updated_at();

-- 3. Rights -----------------------------------------------------------------------------------------
-- FORCE ROW LEVEL SECURITY: each right comes with its policy. No write right for any role.

alter table backoffice.queues       enable row level security;
alter table backoffice.queues       force  row level security;
alter table backoffice.sla_policies enable row level security;
alter table backoffice.sla_policies force  row level security;
revoke all on backoffice.queues, backoffice.sla_policies
  from public, anon, authenticated, service_role;

grant select on backoffice.queues, backoffice.sla_policies to influx_agent, influx_admin;

drop policy if exists queues_internal_select on backoffice.queues;
create policy queues_internal_select on backoffice.queues
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists sla_policies_internal_select on backoffice.sla_policies;
create policy sla_policies_internal_select on backoffice.sla_policies
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 4. The four queues of J8 and their policies (15 RG29) ---------------------------------------------
-- ON CONFLICT DO NOTHING: re-running the migration never overwrites a value changed since.

insert into backoffice.queues
  (code, label_key, spec_document, handled_by_roles, allows_bulk_action, has_lock)
values
  ('lead_sync_failures',       'queue.lead_sync_failures',       '05 RG99-RG104',
   '{agent,admin}', true,  false),
  ('email_delivery_incidents', 'queue.email_delivery_incidents', '05 code by e-mail, RG65',
   '{agent,admin}', false, true),
  ('data_subject_requests',    'queue.data_subject_requests',    '15 §G',
   '{agent,admin}', false, true),
  ('dual_control_pending',     'queue.dual_control_pending',     '15 §E, §J; 03 PD1-PD7',
   '{admin}',       false, false)
on conflict (code) do nothing;

insert into backoffice.sla_policies
  (queue_code, target_claim_minutes, target_decision_minutes, business_hours,
   escalate_after_minutes, is_provisional)
values
  -- 2 business days, no claim objective, no lock (15 RG30): proposal Q4
  ('lead_sync_failures',       null, 960,  default, default, true),
  -- 2 business days, claim within 4 business hours: proposal Q4
  ('email_delivery_incidents', 240,  960,  default, default, true),
  -- internal objective 10 business days, claim within 1 business day; the legal month is due_at
  ('data_subject_requests',    480,  4800, default, default, false),
  -- 24 calendar hours, then expiry (15 RG31): decided by 15
  ('dual_control_pending',     null, 1440, null,    null,    false)
on conflict (queue_code) do nothing;

-- the deferred key is checked now: a pending trigger event would block any later ALTER TABLE
set constraints backoffice.queues_sla_policy_fk immediate;

-- 5. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- the four queues of J8, each with exactly one policy, each policy with its queue
  if (select count(*) from backoffice.queues) <> 4
     or (select count(*) from backoffice.sla_policies) <> 4
     or exists (select 1 from backoffice.queues q
                 where not exists (select 1 from backoffice.sla_policies p where p.queue_code = q.code)) then
    raise exception 'the catalogue does not hold the four queues of J8 with their policies';
  end if;

  -- the proposals of 15 Q4, and only them, are provisional
  select string_agg(queue_code, ', ' order by queue_code) into v_bad
    from backoffice.sla_policies where is_provisional;
  if v_bad is distinct from 'email_delivery_incidents, lead_sync_failures' then
    raise exception 'unexpected provisional delays: %', v_bad;
  end if;

  -- the dual control expires in calendar time
  if not exists (select 1 from backoffice.sla_policies
                  where queue_code = 'dual_control_pending' and business_hours is null
                    and target_decision_minutes = 1440 and is_active) then
    raise exception 'dual_control_pending must expire after 24 calendar hours';
  end if;

  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'backoffice.queues'::regclass)
     or not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'backoffice.sla_policies'::regclass) then
    raise exception 'row level security must be enabled and forced on both tables';
  end if;

  -- read by agent and admin only, written by nobody
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['backoffice.queues', 'backoffice.sla_policies']) t
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE, TRUNCATE')
          or (r.rolname not in ('influx_agent', 'influx_admin')
              and pg_catalog.has_any_column_privilege(r.oid, t, 'SELECT')));
  if v_bad is not null then
    raise exception 'unexpected right(s): %', v_bad;
  end if;
end
$$;
