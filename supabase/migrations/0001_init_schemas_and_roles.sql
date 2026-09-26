-- =============================================================================
-- 0001_init_schemas_and_roles
-- -----------------------------------------------------------------------------
-- Lot 0 / J2. Domain schemas, the CLOSED list of Postgres roles of
-- docs/mvp/03 §4 P7 ("Les rôles Postgres — liste fermée", EC-1 and EC-20 settled
-- by expert-cybersecurite on 2026-09-26), and the default privileges that keep
-- PUBLIC, anon, authenticated and service_role away from our data (03 P6, P7
-- rules 3 and 4).
--
-- Rules applied (03 P7, "Règles d'écriture de 0001"):
--   1. idempotent creation, attributes re-imposed after creation;
--   2. exact memberships, WITH INHERIT FALSE, SET TRUE (PostgreSQL >= 16);
--   3. REVOKE ALL on our schemas from PUBLIC, anon, authenticated, service_role,
--      with consistent ALTER DEFAULT PRIVILEGES;
--   4. global revoke of the default EXECUTE granted to PUBLIC on functions;
--   5. NO password here: set per environment, by script, as a SCRAM verifier;
--   6. bounds on login roles (connection limit, statement and idle timeouts).
--
-- Never created here: influx_service (does not exist, 03 P7). Created later,
-- with their migration: influx_ops(+_login) at J4, influx_intro_owner at Lot 4,
-- influx_privacy(+_login) at Lot 5.
--
-- Owner of every schema, table, type and sequence: the migration role
-- (current_user, i.e. `postgres` of the Supabase project, reached through
-- DIRECT_DATABASE_URL from CI only). No SECURITY DEFINER function may belong to
-- it (03 P7 rule 5): each one is handed to a dedicated member-less owner.
--
-- ROLLBACK (only on a database holding no real data): drop the schemas created
-- here (`drop schema <name> cascade` for each), then drop the roles in reverse
-- dependency order (login roles first). Roles are cluster objects: dropping them
-- also requires `drop owned by` / `reassign owned by` in every database of the
-- cluster. Never on production without the founder's written confirmation
-- (04 §11.4).
-- =============================================================================

-- 0. Preconditions ------------------------------------------------------------

do $$
begin
  -- `WITH INHERIT FALSE, SET TRUE` on role grants exists from PostgreSQL 16.
  if current_setting('server_version_num')::int < 160000 then
    raise exception 'INFLUX requires PostgreSQL >= 16 (found %)',
      current_setting('server_version');
  end if;
end
$$;

-- A non-superuser holding CREATEROLE (the `postgres` role on Supabase) is
-- automatically granted every role it creates, WITH ADMIN OPTION. Make sure this
-- implicit grant carries neither INHERIT nor SET (03 P7, 18 T4.3 and C-9).
set createrole_self_grant = '';

-- 1. Roles ----------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- connection roles (one per variable, one variable per Railway service)
      ('influx_app',              true),   -- DATABASE_URL, api, withUserTransaction
      ('influx_auth_login',       true),   -- AUTH_DATABASE_URL, api, E-1 / E-2
      ('influx_worker_login',     true),   -- WORKER_DATABASE_URL, worker, E-3 / E-4
      -- business roles, taken by SET LOCAL ROLE only
      ('influx_advertiser',       false),
      ('influx_creator',          false),
      ('influx_agent',            false),
      ('influx_admin',            false),
      -- elevated roles, taken by SET LOCAL ROLE from their own login role only
      ('influx_auth',             false),
      ('influx_worker',           false),
      -- owners of SECURITY DEFINER functions: no login, NO member
      ('influx_audit_writer',     false),  -- audit.append()
      ('influx_session_resolver', false),  -- identity.resolve_session()
      ('influx_identity_definer', false)   -- identity.grant_role() and later identity definers
    ) as t(name, can_login)
  loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = r.name) then
      execute format('create role %I with %s noinherit',
                     r.name, case when r.can_login then 'login' else 'nologin' end);
    end if;

    -- Re-impose the attributes on a pre-existing role instead of inheriting them.
    -- Note (PostgreSQL >= 16): a non-superuser may not even mention SUPERUSER in
    -- ALTER ROLE, and may only change CREATEDB, REPLICATION or BYPASSRLS if it holds
    -- them itself. Those attributes are therefore corrected only when wrong, and the
    -- end state is asserted in section 4 below.
    execute format('alter role %I with %s noinherit',
                   r.name, case when r.can_login then 'login' else 'nologin' end);
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolsuper) then
      raise exception 'role % is SUPERUSER: refuse to continue (03 P7)', r.name;
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolbypassrls) then
      execute format('alter role %I with nobypassrls', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolreplication) then
      execute format('alter role %I with noreplication', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolcreatedb) then
      execute format('alter role %I with nocreatedb', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolcreaterole) then
      execute format('alter role %I with nocreaterole', r.name);
    end if;
  end loop;
end
$$;

-- Bounds on the three connection roles (03 P7 rule 6).
-- PROVISIONAL VALUES, to be fixed by `architecte` (03 P7: "valeurs : architecte").
-- 18 T4.2 checks their presence now and their values once fixed.
alter role influx_app          with connection limit 60;
alter role influx_auth_login   with connection limit 20;
alter role influx_worker_login with connection limit 10;

alter role influx_app          set statement_timeout = '15s';
alter role influx_app          set idle_in_transaction_session_timeout = '15s';
alter role influx_auth_login   set statement_timeout = '5s';
alter role influx_auth_login   set idle_in_transaction_session_timeout = '5s';
alter role influx_worker_login set statement_timeout = '60s';
alter role influx_worker_login set idle_in_transaction_session_timeout = '60s';

-- 2. Memberships (exact, 03 P7 rule 2) ------------------------------------------

grant influx_advertiser, influx_creator, influx_agent, influx_admin
   to influx_app          with inherit false, set true;
grant influx_auth
   to influx_auth_login   with inherit false, set true;
grant influx_worker
   to influx_worker_login with inherit false, set true;

-- 3. Schemas -----------------------------------------------------------------------
-- One schema per domain (04 §2.1, 03 P6). All MVP domain schemas are created now,
-- empty, so that their default privileges exist before the first table: a schema
-- created later by a distracted migration would miss them. `ops` comes at J4 with
-- its own roles; `contracts` does not exist at the MVP (04 §2.3).

do $$
declare
  s text;
  domain_schemas constant text[] := array[
    'influx', 'reference', 'identity', 'audit', 'billing', 'backoffice', 'leads',
    'profiles', 'verification', 'campaigns', 'search', 'matching', 'messaging'
  ];
begin
  foreach s in array domain_schemas loop
    execute format('create schema if not exists %I', s);

    -- Nothing for anybody by default: not PUBLIC, not the Data API roles.
    execute format('revoke all on schema %I from public, anon, authenticated, service_role', s);
    execute format('revoke all on all tables    in schema %I from public, anon, authenticated, service_role', s);
    execute format('revoke all on all sequences in schema %I from public, anon, authenticated, service_role', s);
    execute format('revoke all on all functions in schema %I from public, anon, authenticated, service_role', s);

    -- Future objects created by the migration role in this schema.
    execute format('alter default privileges for role %I in schema %I
                      revoke all on tables    from public, anon, authenticated, service_role',
                   current_user, s);
    execute format('alter default privileges for role %I in schema %I
                      revoke all on sequences from public, anon, authenticated, service_role',
                   current_user, s);
    execute format('alter default privileges for role %I in schema %I
                      revoke all on functions from public, anon, authenticated, service_role',
                   current_user, s);
  end loop;

  -- 03 P7 rule 4: an IN SCHEMA default privilege cannot remove a GLOBAL default.
  -- PostgreSQL grants EXECUTE to PUBLIC on every new function: remove it globally
  -- for the migration role. Every CREATE FUNCTION below is also followed by an
  -- explicit REVOKE ... FROM PUBLIC (belt and braces).
  execute format('alter default privileges for role %I revoke execute on functions from public',
                 current_user);
  -- Same belt for any global default that would target the Data API roles.
  execute format('alter default privileges for role %I
                    revoke all on tables    from anon, authenticated, service_role', current_user);
  execute format('alter default privileges for role %I
                    revoke all on sequences from anon, authenticated, service_role', current_user);
  execute format('alter default privileges for role %I
                    revoke all on functions from anon, authenticated, service_role', current_user);
end
$$;

comment on schema influx       is 'INFLUX: context and trigger helper functions. No table.';
comment on schema reference    is 'INFLUX: shared closed lists (countries, currencies, languages...). Codes only, labels live in translation files (04 R8).';
comment on schema identity     is 'INFLUX: accounts, roles, sessions, terms versions and acceptances, marketing consent.';
comment on schema audit        is 'INFLUX: append-only hash-chained register (03 P8, 04 §4.3).';
comment on schema billing      is 'INFLUX: commission rates (EMPTY at the MVP) and, from Lot 4, deals.';
comment on schema backoffice   is 'INFLUX: internal operations (ownership history, queues, alerts...).';
comment on schema leads        is 'INFLUX: outbox and Brevo / Apollo synchronisation (Lot 1).';
comment on schema profiles     is 'INFLUX: advertiser and creator profiles (Lots 1 and 2).';
comment on schema verification is 'INFLUX: audience and ownership evidence, badges (Lot 2).';
comment on schema campaigns    is 'INFLUX: campaigns and their blocks (Lot 3).';
comment on schema search       is 'INFLUX: search journal and shortlists (Lot 3).';
comment on schema matching     is 'INFLUX: introductions, the pivot object (Lots 3 and 4).';
comment on schema messaging    is 'INFLUX: three-party conversations (Lot 4).';

-- The migration role must NOT keep the Supabase `public` schema as a place for
-- business objects (03 P6). Nothing is created there by INFLUX; 18 T2.2 fails
-- the build if a table, view or function of ours ever appears in it.

-- 4. End-state assertions (fail the migration rather than ship a wrong role) ----

do $$
declare
  v_bad text;
begin
  -- 4.1 attributes
  select string_agg(rolname, ', ') into v_bad
    from pg_catalog.pg_roles
   where rolname like 'influx\_%'
     and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication
          or rolinherit);
  if v_bad is not null then
    raise exception 'forbidden attribute on role(s): %', v_bad;
  end if;

  select string_agg(rolname, ', ') into v_bad
    from pg_catalog.pg_roles
   where rolname like 'influx\_%'
     and rolcanlogin <> (rolname in ('influx_app', 'influx_auth_login', 'influx_worker_login'));
  if v_bad is not null then
    raise exception 'unexpected LOGIN attribute on role(s): %', v_bad;
  end if;

  -- 4.2 memberships held BY our roles: exactly the expected ones, INHERIT FALSE,
  -- SET TRUE, no ADMIN. Our NOLOGIN roles are members of nothing, so the direct set
  -- is also the transitive set.
  select string_agg(format('%s -> %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where mem.rolname like 'influx\_%'
     and not (
           (mem.rolname = 'influx_app'
              and grp.rolname in ('influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin'))
        or (mem.rolname = 'influx_auth_login'   and grp.rolname = 'influx_auth')
        or (mem.rolname = 'influx_worker_login' and grp.rolname = 'influx_worker')
     );
  if v_bad is not null then
    raise exception 'unexpected membership(s): %', v_bad;
  end if;

  select string_agg(format('%s -> %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where mem.rolname like 'influx\_%'
     and (m.inherit_option or not m.set_option or m.admin_option);
  if v_bad is not null then
    raise exception 'membership option(s) not INHERIT FALSE, SET TRUE, ADMIN FALSE: %', v_bad;
  end if;

  if (select count(*) from pg_catalog.pg_auth_members m
        join pg_catalog.pg_roles mem on mem.oid = m.member
       where mem.rolname in ('influx_app', 'influx_auth_login', 'influx_worker_login')) <> 6 then
    raise exception 'connection roles do not hold exactly the 6 expected memberships';
  end if;

  -- 4.3 members OF our roles: only the expected connection role, plus the implicit
  -- ADMIN-only grant to the creating (migration) role, never with INHERIT or SET.
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname like 'influx\_%'
     and not (
           (mem.rolname = 'influx_app'
              and grp.rolname in ('influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin'))
        or (mem.rolname = 'influx_auth_login'   and grp.rolname = 'influx_auth')
        or (mem.rolname = 'influx_worker_login' and grp.rolname = 'influx_worker')
        or (mem.rolname = current_user and not m.inherit_option and not m.set_option)
     );
  if v_bad is not null then
    raise exception 'unexpected member(s) of INFLUX roles: %', v_bad;
  end if;
end
$$;

reset createrole_self_grant;
