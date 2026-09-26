-- =============================================================================
-- 0002_influx_helpers
-- -----------------------------------------------------------------------------
-- Lot 0 / J2. Context functions read by the RLS policies, and two generic
-- trigger functions (04 §4.1, corrected on 2026-09-26 for EC-1).
--
-- The four context functions are SECURITY INVOKER, STABLE, `search_path = ''`,
-- and read ONLY transaction settings posed by apps/api after
-- identity.resolve_session() (03 P2, P3):
--   influx.account -> current_account_id()
--   influx.role    -> current_account_role()
--   influx.aal     -> current_aal(), has_aal2()
-- They touch no table and never the `auth` schema. A missing setting yields NULL,
-- so every comparison refuses (03 P4). In a policy they are ALWAYS called wrapped
-- in a scalar sub-query, e.g. `(select influx.current_account_id())` (04 §4.1).
--
-- identity.account_role is created here because current_account_role() returns
-- it; the identity tables arrive in 0004.
--
-- ROLLBACK: drop the six functions, then `drop type identity.account_role`
-- (only before 0004, which depends on it).
-- =============================================================================

do $$
begin
  create type identity.account_role as enum ('advertiser', 'creator', 'agent', 'admin');
exception
  when duplicate_object then null;
end
$$;

comment on type identity.account_role is
  'Business role of an account (D41: exactly one per account at the MVP, see identity.account_roles). '
  'Each value maps to one Postgres role taken by SET LOCAL ROLE: influx_advertiser, influx_creator, '
  'influx_agent, influx_admin (03 P7). The mapping lives in a constant table of apps/api, never in '
  'an interpolated value (03 P7, withUserTransaction rule 4).';

-- 1. Context functions ------------------------------------------------------------

create or replace function influx.current_account_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  -- '' once the setting has existed on this connection: brought back to NULL (03 P4).
  -- A malformed value raises: the transaction fails closed.
  select nullif(pg_catalog.current_setting('influx.account', true), '')::uuid
$$;

create or replace function influx.current_account_role()
returns identity.account_role
language sql
stable
security invoker
set search_path = ''
as $$
  select nullif(pg_catalog.current_setting('influx.role', true), '')::identity.account_role
$$;

create or replace function influx.current_aal()
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  -- Only the two known levels come out; anything else is NULL, hence a refusal.
  select case nullif(pg_catalog.current_setting('influx.aal', true), '')
           when 'aal1' then 'aal1'
           when 'aal2' then 'aal2'
         end
$$;

create or replace function influx.has_aal2()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(influx.current_aal() = 'aal2', false)
$$;

comment on function influx.current_account_id() is
  'Account of the session holder, read from the transaction setting influx.account posed by '
  'apps/api after identity.resolve_session() (03 P2, P3). SECURITY INVOKER, no table, no auth schema. '
  'NULL outside a user transaction: every policy then refuses (03 P4).';
comment on function influx.current_account_role() is
  'Business role read ONCE per transaction from the database by identity.resolve_session(), posed in '
  'influx.role; never taken from a token (D37, 03 P3). NULL when absent.';
comment on function influx.current_aal() is
  'Authentication assurance level of the session (aal1 or aal2), computed by apps/api from the '
  'session row (03 §6.2) and posed in influx.aal. Any other value, or none, gives NULL.';
comment on function influx.has_aal2() is
  'Boolean wrapper of current_aal(): true only when the session is aal2. Used by backoffice policies.';

-- 2. Generic trigger functions -------------------------------------------------------
-- SECURITY INVOKER: they read nothing and write nothing, so they need no owner
-- privilege (18 D-4, T4.4). A trigger function needs no EXECUTE grant to fire.

create or replace function influx.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

create or replace function influx.assert_append_only()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Fires BEFORE UPDATE OR DELETE (row) and BEFORE TRUNCATE (statement), for every
  -- role, the table owner included (03 P8 layer 2, 18 T3.2).
  raise exception '%.% is append-only (attempted %)', tg_table_schema, tg_table_name, tg_op
    using errcode = 'insufficient_privilege';
end
$$;

comment on function influx.touch_updated_at() is
  'Generic BEFORE UPDATE trigger: maintains updated_at (04 §3).';
comment on function influx.assert_append_only() is
  'Generic append-only guard: BEFORE UPDATE OR DELETE (for each row) and BEFORE TRUNCATE (for each '
  'statement). Raises 42501 for every role, owner included (03 P8, 18 T3.2). SECURITY INVOKER on '
  'purpose: it only raises (replaces the security definer audit.deny_mutation() of 03 P8, 18 D-4).';

-- 3. Privileges -------------------------------------------------------------------------

revoke all on function influx.current_account_id()   from public;
revoke all on function influx.current_account_role() from public;
revoke all on function influx.current_aal()          from public;
revoke all on function influx.has_aal2()             from public;
revoke all on function influx.touch_updated_at()     from public;
revoke all on function influx.assert_append_only()   from public;

-- Policies are evaluated with the privileges of the querying role: the four
-- business roles need USAGE on `influx` and EXECUTE on the context functions
-- (has_aal2() calls current_aal(), both are needed).
grant usage on schema influx to influx_advertiser, influx_creator, influx_agent, influx_admin;
grant execute on function influx.current_account_id(),
                          influx.current_account_role(),
                          influx.current_aal(),
                          influx.has_aal2()
   to influx_advertiser, influx_creator, influx_agent, influx_admin;
