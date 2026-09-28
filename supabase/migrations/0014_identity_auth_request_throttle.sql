-- =============================================================================
-- 0014_identity_auth_request_throttle
-- -----------------------------------------------------------------------------
-- Lot 0 / J3, commit 6. The rate-limit counters of authentication (04 §5.8, 05 RG44),
-- with the scopes of EC-3 (five attempts per code, tried BEFORE GoTrue is called)
-- and EC-47 (backoffice sign-in), and the re-authentication failures of EC-40
-- point 5, settled by expert-cybersecurite on 2026-09-27.
--
-- A counter is a row (scope, key digest, window). The key is ALWAYS an HMAC-SHA-256
-- computed by apps/api with AUTH_THROTTLE_PEPPER (address, IP /32 or /64, random
-- reference of a login request, session id...): no address, no IP, no identifier in
-- clear (04 §5.8). The thresholds are constants of apps/api (J3-C rule 6), passed as
-- parameters; the atomicity is the database's:
--   identity.reserve_auth_attempt()  reserves ONE attempt before any call to GoTrue:
--                                     true while below the limit, false (and
--                                     denied_count + 1) beyond. Row lock: twenty
--                                     parallel requests never make twenty attempts.
--   identity.record_auth_failure()   counts a failure, returns the count of the window.
--   identity.auth_failure_count()    reads it, to refuse before calling (RG44, EC-47).
-- A fixed window restarts at the first use after its end. A successful sign-in
-- resets nothing (EC-47). No execution role has a table right: influx_auth goes
-- through the three functions (owner influx_identity_definer), and cannot reset a
-- counter.
--
-- Retention: 30 days after the last use (expires_at), purged by the worker (E-4, J6).
--
-- ROLLBACK: drop the three functions, drop table identity.auth_request_throttle,
-- drop type identity.throttle_scope, identity.throttle_window. Counters only:
-- nothing to keep.
-- =============================================================================

do $$
begin
  create type identity.throttle_scope as enum (
    -- member code request (05 RG44, D43)
    'code_request_email',          -- per address: 3 / 15 min, 10 / h
    'code_request_ip',             -- per IP: 20 / h
    'code_request_unknown_ip',     -- global ceiling when the IP is absent or invalid (EC-21)
    -- member code verification (EC-3)
    'login_request',               -- per login request (random reference of the journal line): 5
    'code_verify_ip',              -- failed verifications per IP: 20 / h
    'code_verify_platform',        -- platform-wide failures and attempts (A-3 surveillance)
    -- backoffice sign-in (EC-47)
    'backoffice_login_email_ip',   -- couple (address, IP): 5 / 15 min
    'backoffice_login_ip',         -- per IP: 20 / h
    'backoffice_login_unknown_ip', -- IP absent or invalid, all addresses: 10 / h
    'backoffice_login_email',      -- failures per address: 10 / h => alert, never a block (A-4)
    'backoffice_login_platform',   -- failures of the platform: 30 / h => alert
    -- re-authentication R (EC-40 point 5)
    'backoffice_reauth_session'    -- failures per session: 5 / 15 min => session revoked
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.throttle_window as enum ('15m', '1h');
exception when duplicate_object then null;
end
$$;

comment on type identity.throttle_scope is
  'What a counter limits (05 RG44, EC-3, EC-21, EC-40, EC-47). Thresholds live in apps/api.';
comment on type identity.throttle_window is
  'Length of a fixed counting window.';

create table if not exists identity.auth_request_throttle (
  scope              identity.throttle_scope  not null,
  scope_key_hash     bytea                    not null,
  window_code        identity.throttle_window not null,
  window_started_at  timestamptz not null default now(),
  request_count      integer     not null default 0,
  denied_count       integer     not null default 0,
  failure_count      integer     not null default 0,
  last_request_at    timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '30 days',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint auth_request_throttle_pkey primary key (scope, scope_key_hash, window_code),
  constraint auth_request_throttle_key_hmac  check (octet_length(scope_key_hash) = 32),
  constraint auth_request_throttle_counts
    check (request_count >= 0 and denied_count >= 0 and failure_count >= 0),
  constraint auth_request_throttle_expiry    check (expires_at > last_request_at)
);

comment on table identity.auth_request_throttle is
  'Rate-limit counters of authentication (05 RG44, EC-3, EC-47, EC-40 point 5). WHY A TABLE: a '
  'request refused at the ceiling writes nothing in leads.transactional_sends (no e-mail left), and '
  'a verification refused before calling GoTrue neither: denied_count is the only numbered trace of '
  'an abuse. NO ADDRESS, NO IP IN CLEAR: scope_key_hash is an HMAC-SHA-256 with a server pepper '
  '(every address ever tried passes here, 02 §18.5 R1). Read and written the same way for a known '
  'and an unknown address (03 A-5). A ceiling never invalidates the current code nor blocks an '
  'account (05 RG45, A-4). No execution role has a table right: identity.reserve_auth_attempt(), '
  'record_auth_failure() and auth_failure_count() only. Retention: 30 days (expires_at).';
comment on column identity.auth_request_throttle.request_count is
  'Attempts reserved in the current window (a reservation is made BEFORE the call to GoTrue).';
comment on column identity.auth_request_throttle.denied_count is
  'Attempts refused at the ceiling in the current window: the trace of an abuse.';
comment on column identity.auth_request_throttle.failure_count is
  'Failures recorded in the current window (verification, sign-in, re-authentication).';
comment on column identity.auth_request_throttle.expires_at is
  'Purge date: last use + 30 days (RG-J3-10: digests kept 30 days).';

create index if not exists auth_request_throttle_expiry_idx
  on identity.auth_request_throttle (expires_at);
comment on index identity.auth_request_throttle_expiry_idx is
  'Daily purge of the expired counters by the worker (E-4, J6; 04 §9.3), bounded by limit 1000.';

drop trigger if exists auth_request_throttle_touch_updated_at on identity.auth_request_throttle;
create trigger auth_request_throttle_touch_updated_at
  before update on identity.auth_request_throttle
  for each row execute function influx.touch_updated_at();

alter table identity.auth_request_throttle enable row level security;
alter table identity.auth_request_throttle force  row level security;
revoke all on identity.auth_request_throttle from public, anon, authenticated, service_role;

grant select (scope, scope_key_hash, window_code, window_started_at, request_count, denied_count,
              failure_count),
      insert (scope, scope_key_hash, window_code),
      update (window_started_at, request_count, denied_count, failure_count, last_request_at,
              expires_at)
   on identity.auth_request_throttle to influx_identity_definer;

drop policy if exists auth_request_throttle_definer_all on identity.auth_request_throttle;
create policy auth_request_throttle_definer_all on identity.auth_request_throttle
  for all to influx_identity_definer using (true) with check (true);

-- The functions -------------------------------------------------------------------------

create or replace function identity.reserve_auth_attempt(
  p_scope     identity.throttle_scope,
  p_key_hash  bytea,
  p_window    identity.throttle_window,
  p_limit     integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_length  interval;
  v_row     record;
  v_allowed boolean;
begin
  if p_scope is null or p_window is null or p_key_hash is null
     or pg_catalog.octet_length(p_key_hash) <> 32
     or p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid throttle reservation' using errcode = 'invalid_parameter_value';
  end if;
  v_length := case p_window when '15m' then interval '15 minutes' else interval '1 hour' end;

  insert into identity.auth_request_throttle (scope, scope_key_hash, window_code)
  values (p_scope, p_key_hash, p_window)
  on conflict (scope, scope_key_hash, window_code) do nothing;

  -- The row lock serialises concurrent reservations on the same key (EC-3 point 2).
  select t.window_started_at, t.request_count
    into v_row
    from identity.auth_request_throttle t
   where t.scope = p_scope and t.scope_key_hash = p_key_hash and t.window_code = p_window
   for update;

  if v_row.window_started_at + v_length <= pg_catalog.now() then
    update identity.auth_request_throttle
       set window_started_at = pg_catalog.now(), request_count = 1, denied_count = 0,
           failure_count = 0, last_request_at = pg_catalog.now(),
           expires_at = pg_catalog.now() + interval '30 days'
     where scope = p_scope and scope_key_hash = p_key_hash and window_code = p_window;
    return true;
  end if;

  v_allowed := v_row.request_count < p_limit;
  update identity.auth_request_throttle
     set request_count = request_count + case when v_allowed then 1 else 0 end,
         denied_count  = denied_count  + case when v_allowed then 0 else 1 end,
         last_request_at = pg_catalog.now(),
         expires_at = pg_catalog.now() + interval '30 days'
   where scope = p_scope and scope_key_hash = p_key_hash and window_code = p_window;
  return v_allowed;
end
$$;

comment on function identity.reserve_auth_attempt(identity.throttle_scope, bytea, identity.throttle_window, integer) is
  'Reserves one attempt on a counter (EC-3 point 2, EC-47): true while the window holds fewer than '
  'p_limit attempts (then counted), false beyond (denied_count + 1). Atomic under concurrency (row '
  'lock). Called in an E-1 / E-2 transaction committed BEFORE any call to GoTrue (G4). SECURITY '
  'DEFINER owned by influx_identity_definer; EXECUTE for influx_auth.';

create or replace function identity.record_auth_failure(
  p_scope     identity.throttle_scope,
  p_key_hash  bytea,
  p_window    identity.throttle_window
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_length interval;
  v_count  integer;
begin
  if p_scope is null or p_window is null or p_key_hash is null
     or pg_catalog.octet_length(p_key_hash) <> 32 then
    raise exception 'invalid throttle failure' using errcode = 'invalid_parameter_value';
  end if;
  v_length := case p_window when '15m' then interval '15 minutes' else interval '1 hour' end;

  insert into identity.auth_request_throttle (scope, scope_key_hash, window_code)
  values (p_scope, p_key_hash, p_window)
  on conflict (scope, scope_key_hash, window_code) do nothing;

  update identity.auth_request_throttle
     set window_started_at = case when window_started_at + v_length <= pg_catalog.now()
                                  then pg_catalog.now() else window_started_at end,
         request_count = case when window_started_at + v_length <= pg_catalog.now()
                              then 0 else request_count end,
         denied_count  = case when window_started_at + v_length <= pg_catalog.now()
                              then 0 else denied_count end,
         failure_count = case when window_started_at + v_length <= pg_catalog.now()
                              then 1 else failure_count + 1 end,
         last_request_at = pg_catalog.now(),
         expires_at = pg_catalog.now() + interval '30 days'
   where scope = p_scope and scope_key_hash = p_key_hash and window_code = p_window
  returning failure_count into v_count;
  return v_count;
end
$$;

comment on function identity.record_auth_failure(identity.throttle_scope, bytea, identity.throttle_window) is
  'Counts one failure (verification, sign-in, re-authentication) and returns the number of failures '
  'of the current window; apps/api compares it with its threshold (alert, revocation). SECURITY '
  'DEFINER owned by influx_identity_definer; EXECUTE for influx_auth.';

create or replace function identity.auth_failure_count(
  p_scope     identity.throttle_scope,
  p_key_hash  bytea,
  p_window    identity.throttle_window
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select t.failure_count
      from identity.auth_request_throttle t
     where t.scope = p_scope and t.scope_key_hash = p_key_hash and t.window_code = p_window
       and t.window_started_at + case p_window when '15m' then interval '15 minutes'
                                               else interval '1 hour' end > pg_catalog.now()), 0)
$$;

comment on function identity.auth_failure_count(identity.throttle_scope, bytea, identity.throttle_window) is
  'Failures of the current window of a counter (0 when none or expired): read BEFORE calling GoTrue '
  'to refuse an IP over its failure ceiling (05 RG44, EC-3 point 5). SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_auth.';

revoke all on function identity.reserve_auth_attempt(identity.throttle_scope, bytea, identity.throttle_window, integer) from public;
revoke all on function identity.record_auth_failure(identity.throttle_scope, bytea, identity.throttle_window) from public;
revoke all on function identity.auth_failure_count(identity.throttle_scope, bytea, identity.throttle_window) from public;
grant execute on function
  identity.reserve_auth_attempt(identity.throttle_scope, bytea, identity.throttle_window, integer),
  identity.record_auth_failure(identity.throttle_scope, bytea, identity.throttle_window),
  identity.auth_failure_count(identity.throttle_scope, bytea, identity.throttle_window)
  to influx_auth;

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.reserve_auth_attempt(identity.throttle_scope, bytea, identity.throttle_window, integer)
  owner to influx_identity_definer;
alter function identity.record_auth_failure(identity.throttle_scope, bytea, identity.throttle_window)
  owner to influx_identity_definer;
alter function identity.auth_failure_count(identity.throttle_scope, bytea, identity.throttle_window)
  owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

do $$
declare
  v_bad text;
  v_fn  text;
begin
  foreach v_fn in array array[
    'identity.reserve_auth_attempt(identity.throttle_scope, bytea, identity.throttle_window, integer)',
    'identity.record_auth_failure(identity.throttle_scope, bytea, identity.throttle_window)',
    'identity.auth_failure_count(identity.throttle_scope, bytea, identity.throttle_window)'] loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_identity_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_identity_definer, empty search_path', v_fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_auth');
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_any_column_privilege(r.oid, 'identity.auth_request_throttle', 'SELECT')
          or pg_catalog.has_any_column_privilege(r.oid, 'identity.auth_request_throttle', 'INSERT')
          or pg_catalog.has_any_column_privilege(r.oid, 'identity.auth_request_throttle', 'UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'identity.auth_request_throttle', 'DELETE'));
  if v_bad is not null then
    raise exception 'execution role(s) with a right on identity.auth_request_throttle: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema identity';
  end if;
end
$$;
