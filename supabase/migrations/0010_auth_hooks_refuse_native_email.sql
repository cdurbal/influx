-- =============================================================================
-- 0010_auth_hooks_refuse_native_email
-- -----------------------------------------------------------------------------
-- Lot 0 / J3, commit 5. The "sink" send-e-mail hook of Supabase Auth (GoTrue):
-- EC-16 and EC-41 of docs/mvp/21 §3, settled and hardened by expert-cybersecurite
-- on 2026-09-27 (21 §4, J3, "Arbitrages de sécurité du J3", EC-16 and EC-41).
--
-- Why. /otp, /recover, /resend and /magiclink of GoTrue stay reachable with the
-- publishable key, which is not a secret, and send an e-mail to an EXISTING user
-- whether public sign-up is closed or not. Configuring no SMTP is not enough: on a
-- hosted project the built-in sender of Supabase takes over. With a send-e-mail
-- hook declared, GoTrue hands every native e-mail to the hook instead of sending
-- it; this hook refuses them all. INFLUX sends its own codes through apps/api and
-- Brevo (D43); admin generateLink and createUser send nothing and do not call it.
-- This is NOT the HTTP hook ruled out by 02 §18.7: it is a Postgres function,
-- called by GoTrue on its own database connection.
--
-- Hardening (EC-16/EC-41 point 2):
--   * SECURITY INVOKER, search_path = '', writes nothing;
--   * it never reads nor copies its argument: the event carries a one-time code and
--     a token hash, so no RAISE and no message derived from it; the error answer is
--     a constant;
--   * EXECUTE on the function and USAGE on the schema to supabase_auth_admin ONLY
--     (the role GoTrue connects as), revoked from PUBLIC, anon, authenticated,
--     service_role; the schema holds no table.
-- Declared in supabase/config.toml, [auth.hook.send_email], as
-- pg-functions://postgres/auth_hooks/refuse_native_email.
--
-- The schema auth_hooks is ours (owned by the migration role, like the domain
-- schemas of 0001): 18 T2.2 lists it among OUR_SCHEMAS, so T2.4, T2.7 and T2.8
-- cover it. It is not exposed by the Data API ([api].schemas).
--
-- ROLLBACK: remove [auth.hook.send_email] from supabase/config.toml FIRST (and push
-- the settings to the hosted projects), otherwise every native e-mail request of
-- GoTrue fails on a missing function; then `drop schema auth_hooks cascade`.
-- Reversible at any time: the function holds no data.
-- =============================================================================

-- 0. Precondition: the role GoTrue connects as exists on every Supabase project.
do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_auth_admin') then
    raise exception 'role supabase_auth_admin not found: is this a Supabase database?';
  end if;
end
$$;

-- 1. Schema, with the same default privileges as the domain schemas of 0001 -----

create schema if not exists auth_hooks;

comment on schema auth_hooks is
  'INFLUX: Postgres functions called by Supabase Auth hooks. No table. Every function here is '
  'executable by supabase_auth_admin only (EC-41).';

revoke all on schema auth_hooks from public, anon, authenticated, service_role;

do $$
begin
  execute format('alter default privileges for role %I in schema auth_hooks
                    revoke all on tables    from public, anon, authenticated, service_role',
                 current_user);
  execute format('alter default privileges for role %I in schema auth_hooks
                    revoke all on sequences from public, anon, authenticated, service_role',
                 current_user);
  execute format('alter default privileges for role %I in schema auth_hooks
                    revoke all on functions from public, anon, authenticated, service_role',
                 current_user);
end
$$;

-- 2. The sink --------------------------------------------------------------------

create or replace function auth_hooks.refuse_native_email(event jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  -- The argument is deliberately never read: it carries a one-time code (EC-41).
  select '{"error": {"http_code": 403, "message": "Native e-mails are disabled."}}'::jsonb
$$;

comment on function auth_hooks.refuse_native_email(jsonb) is
  'Send-e-mail hook of Supabase Auth (EC-41): refuses every native e-mail with a constant error and '
  'writes nothing. Never reads its argument (it carries a one-time code). SECURITY INVOKER, empty '
  'search_path; EXECUTE for supabase_auth_admin only. INFLUX sends its codes through apps/api and '
  'Brevo (D43). Declared in supabase/config.toml, [auth.hook.send_email].';

revoke all on function auth_hooks.refuse_native_email(jsonb)
  from public, anon, authenticated, service_role;

grant usage   on schema auth_hooks to supabase_auth_admin;
grant execute on function auth_hooks.refuse_native_email(jsonb) to supabase_auth_admin;

-- 3. End-state assertions ------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- no table, view or sequence in the schema
  if exists (select 1 from pg_catalog.pg_class c
               join pg_catalog.pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'auth_hooks') then
    raise exception 'auth_hooks must hold no relation';
  end if;

  -- the function: invoker, empty search_path, not owned by an influx_% role
  if exists (select 1 from pg_catalog.pg_proc
              where oid = 'auth_hooks.refuse_native_email(jsonb)'::regprocedure
                and (prosecdef or proconfig is distinct from array['search_path=""'])) then
    raise exception 'auth_hooks.refuse_native_email must be SECURITY INVOKER with an empty search_path';
  end if;

  -- EXECUTE: owner and supabase_auth_admin, nobody else (PUBLIC included)
  select string_agg(coalesce(nullif(a.grantee::regrole::text, '-'), 'PUBLIC'), ', ') into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = 'auth_hooks.refuse_native_email(jsonb)'::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'supabase_auth_admin');
  if v_bad is not null then
    raise exception 'auth_hooks.refuse_native_email executable by: %', v_bad;
  end if;

  -- USAGE on the schema: owner and supabase_auth_admin only
  select string_agg(coalesce(nullif(a.grantee::regrole::text, '-'), 'PUBLIC'), ', ') into v_bad
    from pg_catalog.pg_namespace n,
         pg_catalog.aclexplode(coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) a
   where n.nspname = 'auth_hooks'
     and a.grantee <> n.nspowner
     and (a.grantee = 0
          or a.grantee::regrole::text <> 'supabase_auth_admin'
          or a.privilege_type <> 'USAGE');
  if v_bad is not null then
    raise exception 'schema auth_hooks usable by: %', v_bad;
  end if;
end
$$;
