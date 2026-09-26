-- =============================================================================
-- 0007_billing_commission_rates_empty
-- -----------------------------------------------------------------------------
-- Lot 0 / J2. billing.commission_rates: CREATED AND EMPTY (CLAUDE.md §3, MVP
-- transitional regime; A1; 03 C(32); 04 §5.9; 18 T16).
--
-- At the MVP there is NO rate and NO commission computation anywhere: the
-- salesperson enters the negotiated amount and the agreed commission, the
-- application records them and never derives one from a rate. The table exists
-- from Lot 0 as a GUARD: the V2 developer must read the two rates (advertiser
-- share, creator share) here, historised on each contract, instead of writing a
-- constant in the code.
--
-- No execution role may write it (03 C(32), 18 T16.4): not the business roles,
-- not the elevated roles, not the connection roles, not the Data API roles.
-- Filling it will require a reviewed migration run by the migration role.
-- This migration inserts NO row (18 T16.3).
--
-- ROLLBACK: drop table billing.commission_rates; drop type billing.rate_scope;
-- (harmless: the table is empty by construction).
-- =============================================================================

do $$
begin
  create type billing.rate_scope as enum ('platform_default', 'account');
exception when duplicate_object then null;
end
$$;

comment on type billing.rate_scope is
  'platform_default: the platform scale; account: a derogatory rate for one account (partnerships, '
  'launch offers). V2 only.';

create table if not exists billing.commission_rates (
  id                     uuid        not null default gen_random_uuid() primary key,
  scope                  billing.rate_scope not null,
  account_id             uuid        references identity.accounts (id),
  advertiser_rate_bp     integer     not null,
  creator_rate_bp        integer     not null,
  effective_from         timestamptz not null,
  effective_to           timestamptz,
  note                   text,
  created_by_account_id  uuid        not null references identity.accounts (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint commission_rates_scope_account check ((scope = 'account') = (account_id is not null)),
  -- integer basis points only (10000 = the whole amount), never a fraction nor a float (04 §3)
  constraint commission_rates_advertiser_bp check (advertiser_rate_bp between 0 and 10000),
  constraint commission_rates_creator_bp    check (creator_rate_bp between 0 and 10000),
  constraint commission_rates_total_bp      check (advertiser_rate_bp + creator_rate_bp <= 10000),
  constraint commission_rates_period        check (effective_to is null or effective_to > effective_from),
  constraint commission_rates_note_length   check (length(note) <= 500)
);

comment on table billing.commission_rates is
  'Platform commission rates, two shares, in integer basis points (10000 = the whole amount). THIS TABLE IS '
  'EMPTY ON PURPOSE AT THE MVP (arbitration A1, 2026-09-18; CLAUDE.md §3). No rate and no commission '
  'computation exist in the MVP code: the salesperson enters the negotiated amount and the agreed '
  'commission; the application records and cross-checks them, it never computes them. It exists from '
  'Lot 0 as a GUARD so that V2 reads both rates here (and freezes them on each contract at signature) '
  'instead of hard-coding them (CLAUDE.md §6, one single place). NO EXECUTION ROLE MAY WRITE IT: '
  'filling it requires a reviewed migration.';
comment on column billing.commission_rates.advertiser_rate_bp is
  'Advertiser share of the commission, in basis points. V2.';
comment on column billing.commission_rates.creator_rate_bp is
  'Creator share of the commission, in basis points. V2.';
comment on column billing.commission_rates.account_id is
  'Set only for a derogatory rate (scope = account).';

-- One rate in force per scope target (V2 integrity, costless on an empty table).
create unique index if not exists commission_rates_current_platform_idx
  on billing.commission_rates (scope)
  where scope = 'platform_default' and effective_to is null;
comment on index billing.commission_rates_current_platform_idx is
  'At most one platform default rate in force. Constraint, not optimisation.';

create unique index if not exists commission_rates_current_account_idx
  on billing.commission_rates (account_id)
  where scope = 'account' and effective_to is null;
comment on index billing.commission_rates_current_account_idx is
  'At most one derogatory rate in force per account. Constraint, not optimisation.';

drop trigger if exists commission_rates_touch_updated_at on billing.commission_rates;
create trigger commission_rates_touch_updated_at
  before update on billing.commission_rates
  for each row execute function influx.touch_updated_at();

-- Row level security and privileges -------------------------------------------------

alter table billing.commission_rates enable row level security;
alter table billing.commission_rates force  row level security;

revoke all on billing.commission_rates from public, anon, authenticated, service_role;
revoke insert, update, delete, truncate, references, trigger on billing.commission_rates
  from influx_app, influx_auth_login, influx_worker_login,
       influx_advertiser, influx_creator, influx_agent, influx_admin,
       influx_auth, influx_worker,
       influx_audit_writer, influx_session_resolver, influx_identity_definer;

-- 03 §3.5: read by the administrator only (the agent has no right on it).
grant usage  on schema billing to influx_admin;
grant select on billing.commission_rates to influx_admin;

drop policy if exists commission_rates_admin_select on billing.commission_rates;
create policy commission_rates_admin_select on billing.commission_rates
  for select to influx_admin
  using ((select influx.has_aal2()));

do $$
begin
  if exists (select 1 from billing.commission_rates) then
    raise exception 'billing.commission_rates must stay EMPTY at the MVP (CLAUDE.md §3, 18 T16.3)';
  end if;
end
$$;
