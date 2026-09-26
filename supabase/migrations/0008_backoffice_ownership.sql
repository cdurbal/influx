-- =============================================================================
-- 0008_backoffice_ownership
-- -----------------------------------------------------------------------------
-- Lot 0 / J2. backoffice.ownership_assignments: history of the successive
-- responsible salespersons (commercial responsable) of an account, and later of
-- an introduction or a deal (04 §5.10; backoffice-ops rule 18: the history is
-- kept, never overwritten; D50, D54).
--
-- At Lot 0 only accounts exist: introduction_id and deal_id receive their foreign
-- keys with their tables (0401, 0402a). The current owner of an account also
-- stays on identity.accounts.owner_agent_id (the column every screen reads); the
-- functions that reassign (ownership.reassigned, Lot 1 with 0107) write both in
-- one transaction.
--
-- Rows are never deleted; the only update allowed is closing an assignment, once
-- (unassigned_at from NULL to a value). Reads: agent and admin (aal2). Writes:
-- through the reassignment functions only (none at Lot 0).
--
-- ROLLBACK (only while no real assignment exists):
--   drop table backoffice.ownership_assignments;
--   drop function backoffice.assert_ownership_assignment_update();
-- =============================================================================

create table if not exists backoffice.ownership_assignments (
  id                      uuid        not null default gen_random_uuid() primary key,
  account_id              uuid        references identity.accounts (id),
  introduction_id         uuid,
  deal_id                 uuid,
  agent_account_id        uuid        not null,
  agent_is_internal       boolean     not null generated always as (true) stored,
  assigned_at             timestamptz not null default now(),
  unassigned_at           timestamptz,
  assigned_by_account_id  uuid        references identity.accounts (id),
  reason_code             text        not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- exactly one subject per line
  constraint ownership_assignments_one_subject
    check (num_nonnulls(account_id, introduction_id, deal_id) = 1),
  -- the owner is always an internal account (agent or admin), declaratively
  constraint ownership_assignments_agent_is_internal_fk
    foreign key (agent_account_id, agent_is_internal)
    references identity.account_roles (account_id, is_internal),
  constraint ownership_assignments_period
    check (unassigned_at is null or unassigned_at >= assigned_at),
  constraint ownership_assignments_reason_format
    check (reason_code ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint ownership_assignments_not_own_account
    check (account_id is null or account_id <> agent_account_id)
);

comment on table backoffice.ownership_assignments is
  'History of the responsible salespersons of an account (Lot 0), an introduction or a deal (Lot 4). '
  'Kept, never overwritten (backoffice-ops rule 18): an assignment is closed, then a new one opens. '
  'Answers "who was responsible for this account on 14 March?".';
comment on column backoffice.ownership_assignments.agent_is_internal is
  'Always true. Only exists to carry the composite key that restricts agent_account_id to an agent '
  'or admin account.';
comment on column backoffice.ownership_assignments.introduction_id is
  'Foreign key to matching.introductions added with that table (0401).';
comment on column backoffice.ownership_assignments.deal_id is
  'Foreign key to billing.deals added with that table (0402a).';
comment on column backoffice.ownership_assignments.assigned_by_account_id is
  'Who assigned: an agent or admin, or NULL when the assignment is automatic (invitation accepted, '
  'D54).';
comment on column backoffice.ownership_assignments.reason_code is
  'Typed reason (backoffice-ops rule 18). Free code format until the reason list of the reassignment '
  'function exists (Lot 1); never free text.';

-- One open assignment per subject: constraints, not optimisations.
create unique index if not exists ownership_assignments_open_account_idx
  on backoffice.ownership_assignments (account_id)
  where unassigned_at is null and account_id is not null;
create unique index if not exists ownership_assignments_open_introduction_idx
  on backoffice.ownership_assignments (introduction_id)
  where unassigned_at is null and introduction_id is not null;
create unique index if not exists ownership_assignments_open_deal_idx
  on backoffice.ownership_assignments (deal_id)
  where unassigned_at is null and deal_id is not null;
comment on index backoffice.ownership_assignments_open_account_idx is
  'One current responsible salesperson per account; also the lookup of the account page.';

create or replace function backoffice.assert_ownership_assignment_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'backoffice.ownership_assignments is history: never deleted (attempted %)', tg_op
      using errcode = 'insufficient_privilege';
  end if;
  -- UPDATE: only closing an open assignment, once
  if old.unassigned_at is not null
     or new.unassigned_at is null
     or new.id                     is distinct from old.id
     or new.account_id             is distinct from old.account_id
     or new.introduction_id        is distinct from old.introduction_id
     or new.deal_id                is distinct from old.deal_id
     or new.agent_account_id       is distinct from old.agent_account_id
     or new.assigned_at            is distinct from old.assigned_at
     or new.assigned_by_account_id is distinct from old.assigned_by_account_id
     or new.reason_code            is distinct from old.reason_code
     or new.created_at             is distinct from old.created_at
  then
    raise exception 'an ownership assignment can only be closed, once'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function backoffice.assert_ownership_assignment_update() is
  'Guards the ownership history: no delete, no truncate, and the only update is closing an open '
  'assignment once. SECURITY INVOKER, reads nothing.';

revoke all on function backoffice.assert_ownership_assignment_update() from public;

drop trigger if exists ownership_assignments_guard on backoffice.ownership_assignments;
create trigger ownership_assignments_guard
  before update or delete on backoffice.ownership_assignments
  for each row execute function backoffice.assert_ownership_assignment_update();

drop trigger if exists ownership_assignments_no_truncate on backoffice.ownership_assignments;
create trigger ownership_assignments_no_truncate
  before truncate on backoffice.ownership_assignments
  for each statement execute function backoffice.assert_ownership_assignment_update();

-- Row level security and privileges ---------------------------------------------------

alter table backoffice.ownership_assignments enable row level security;
alter table backoffice.ownership_assignments force  row level security;

revoke all on backoffice.ownership_assignments from public, anon, authenticated, service_role;

grant usage  on schema backoffice to influx_agent, influx_admin;
grant select on backoffice.ownership_assignments to influx_agent, influx_admin;

drop policy if exists ownership_assignments_internal_select on backoffice.ownership_assignments;
create policy ownership_assignments_internal_select on backoffice.ownership_assignments
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));
