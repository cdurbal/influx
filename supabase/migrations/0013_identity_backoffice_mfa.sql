-- =============================================================================
-- 0013_identity_backoffice_mfa
-- -----------------------------------------------------------------------------
-- Lot 0 / J3, commit 6. The second factor of internal accounts beyond what GoTrue
-- provides (21 §4, J3, "Arbitrages de sécurité du J3"):
--
--   identity.mfa_recovery_codes      EC-17: ten codes, SHA-256 only, single use,
--                                     a new batch revokes the previous one, never
--                                     deleted by an application role.
--   identity.mfa_enrollment_tokens   G-1 point 2: single-use enrollment token
--                                     (>= 128 random bits, SHA-256 only, 72 hours,
--                                     bound to the account), required by every TOTP
--                                     enrollment on top of the password.
--   identity.totp_replay_guards      EC-39: the same TOTP code is refused for 120 s,
--                                     keyed by (account, HMAC of factor and code) —
--                                     see 21 §3 EC-53 for the difference with "one
--                                     row per account".
--
-- No execution role holds any right on these tables. influx_auth (E-2) goes through
-- four SECURITY DEFINER functions owned by influx_identity_definer, which check their
-- inputs and write their own audit lines:
--   identity.enrollment_token_is_valid()  first enrollment request (read only);
--   identity.pin_mfa_factor()             second enrollment request: consumes the
--                                         token, pins the factor, generates the ten
--                                         recovery codes (no free regeneration: EC-17
--                                         point 5), audit agent.mfa_enrolled and
--                                         agent.recovery_codes_generated;
--   identity.consume_recovery_code()      single use under concurrency (EC-17 point 3),
--                                         audit agent.recovery_code_consumed with the
--                                         number of codes left (EC-44 (1));
--   identity.accept_totp_code()           conditional write, one winner (EC-39).
-- The raw code, token and TOTP code never reach the database: apps/api sends
-- SHA-256 (codes, token) or HMAC-SHA-256 (TOTP, key AUTH_THROTTLE_PEPPER, label
-- totp-replay:) digests.
--
-- ROLLBACK (before any real internal account): drop the four functions, then
-- drop table identity.totp_replay_guards, identity.mfa_enrollment_tokens,
-- identity.mfa_recovery_codes; drop function identity.guard_mfa_secret_update().
-- =============================================================================

-- 1. identity.mfa_recovery_codes ------------------------------------------------------

create table if not exists identity.mfa_recovery_codes (
  id           uuid        not null default gen_random_uuid() primary key,
  account_id   uuid        not null,
  is_internal  boolean     not null generated always as (true) stored,
  batch_id     uuid        not null,
  code_hash    bytea       not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  consumed_at  timestamptz,
  revoked_at   timestamptz,

  constraint mfa_recovery_codes_internal_fk
    foreign key (account_id, is_internal)
    references identity.account_roles (account_id, is_internal),
  constraint mfa_recovery_codes_hash_sha256   check (octet_length(code_hash) = 32),
  constraint mfa_recovery_codes_account_hash  unique (account_id, code_hash),
  constraint mfa_recovery_codes_single_end
    check (consumed_at is null or revoked_at is null),
  constraint mfa_recovery_codes_end_after_creation
    check (coalesce(consumed_at, revoked_at, created_at) >= created_at)
);

comment on table identity.mfa_recovery_codes is
  'Recovery codes of the second factor of internal accounts (EC-17, MFA-3; GoTrue has none). Ten '
  'per batch, 80 random bits each, stored as SHA-256 only. Single use; a new batch revokes the '
  'previous one (never deleted by an application role). A session opened with a recovery code '
  'never satisfies a fresh re-authentication R. No right for any execution role: written and read '
  'through identity.pin_mfa_factor() and identity.consume_recovery_code() only. Retention: '
  '12 months after consumption or revocation (04 §9.1, proposal).';
comment on column identity.mfa_recovery_codes.batch_id is
  'Generation the code belongs to (one per enrollment).';

create index if not exists mfa_recovery_codes_usable_idx
  on identity.mfa_recovery_codes (account_id)
  where consumed_at is null and revoked_at is null;
comment on index identity.mfa_recovery_codes_usable_idx is
  'identity.consume_recovery_code(): the usable codes of one account, and how many are left.';

-- 2. identity.mfa_enrollment_tokens ---------------------------------------------------

create table if not exists identity.mfa_enrollment_tokens (
  id                     uuid        not null default gen_random_uuid() primary key,
  account_id             uuid        not null,
  is_internal            boolean     not null generated always as (true) stored,
  token_hash             bytea       not null,
  created_by_account_id  uuid        references identity.accounts (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  expires_at             timestamptz not null,
  consumed_at            timestamptz,

  constraint mfa_enrollment_tokens_internal_fk
    foreign key (account_id, is_internal)
    references identity.account_roles (account_id, is_internal),
  constraint mfa_enrollment_tokens_hash_sha256 check (octet_length(token_hash) = 32),
  constraint mfa_enrollment_tokens_hash_key    unique (token_hash),
  constraint mfa_enrollment_tokens_lifetime
    check (expires_at > created_at and expires_at <= created_at + interval '72 hours'),
  constraint mfa_enrollment_tokens_consumed_after_creation
    check (consumed_at is null or consumed_at >= created_at),
  constraint mfa_enrollment_tokens_not_self
    check (created_by_account_id is null or created_by_account_id <> account_id)
);

comment on table identity.mfa_enrollment_tokens is
  'Single-use enrollment tokens of the TOTP (G-1 point 2, B-8, MFA-1): at least 128 random bits, '
  'SHA-256 only, 72 hours at most, bound to one internal account. Required, on top of the password, '
  'by every enrollment (first one, or after an MFA reset). Issued by the demo script at J3 (migration '
  'role), by the invitation of an administrator at J8. No right for any execution role. Retention: '
  '30 days after expiry or consumption (04 §9.1, proposal).';
comment on column identity.mfa_enrollment_tokens.created_by_account_id is
  'Administrator who issued the invitation; NULL for the bootstrap script (EC-45).';

-- 3. identity.totp_replay_guards --------------------------------------------------------

create table if not exists identity.totp_replay_guards (
  account_id   uuid        not null,
  is_internal  boolean     not null generated always as (true) stored,
  code_hmac    bytea       not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint totp_replay_guards_pkey primary key (account_id, code_hmac),
  constraint totp_replay_guards_internal_fk
    foreign key (account_id, is_internal)
    references identity.account_roles (account_id, is_internal),
  constraint totp_replay_guards_hmac_length check (octet_length(code_hmac) = 32)
);

comment on table identity.totp_replay_guards is
  'Anti-replay of the TOTP (EC-39, B-3): one row per ACCEPTED code of an account, HMAC-SHA-256 of '
  '(factor, code) with AUTH_THROTTLE_PEPPER and the label totp-replay:, never the code. The same '
  'code is refused for 120 seconds (90 s of validity at GoTrue plus clock drift). Keyed by code and '
  'not "one row per account", so that an older code replayed after a newer one is refused too '
  '(21 §3 EC-53). Rows older than 120 s are deleted by identity.accept_totp_code() itself. No right '
  'for any execution role.';
comment on column identity.totp_replay_guards.created_at is
  'Acceptance instant of the code.';

-- 4. Guard of the two secret tables: only the end of a code or token is written, once ------

create or replace function identity.guard_mfa_secret_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_table_name = 'mfa_recovery_codes' then
    if old.consumed_at is not null or old.revoked_at is not null
       or new.id is distinct from old.id
       or new.account_id is distinct from old.account_id
       or new.batch_id   is distinct from old.batch_id
       or new.code_hash  is distinct from old.code_hash
       or new.created_at is distinct from old.created_at
       or (new.consumed_at is null and new.revoked_at is null) then
      raise exception 'a recovery code can only be consumed or revoked, once'
        using errcode = 'insufficient_privilege';
    end if;
    new.consumed_at := case when new.consumed_at is null then null else pg_catalog.now() end;
    new.revoked_at  := case when new.revoked_at  is null then null else pg_catalog.now() end;
  else
    if old.consumed_at is not null or new.consumed_at is null
       or new.id                    is distinct from old.id
       or new.account_id            is distinct from old.account_id
       or new.token_hash            is distinct from old.token_hash
       or new.created_by_account_id is distinct from old.created_by_account_id
       or new.created_at            is distinct from old.created_at
       or new.expires_at            is distinct from old.expires_at then
      raise exception 'an enrollment token can only be consumed, once'
        using errcode = 'insufficient_privilege';
    end if;
    new.consumed_at := pg_catalog.now();
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function identity.guard_mfa_secret_update() is
  'BEFORE UPDATE on identity.mfa_recovery_codes and identity.mfa_enrollment_tokens: the only update '
  'is the end of a code (consumed or revoked) or of a token (consumed), once, at now(). SECURITY '
  'INVOKER, reads nothing.';

revoke all on function identity.guard_mfa_secret_update() from public;

drop trigger if exists mfa_recovery_codes_guard on identity.mfa_recovery_codes;
create trigger mfa_recovery_codes_guard
  before update on identity.mfa_recovery_codes
  for each row execute function identity.guard_mfa_secret_update();

drop trigger if exists mfa_enrollment_tokens_guard on identity.mfa_enrollment_tokens;
create trigger mfa_enrollment_tokens_guard
  before update on identity.mfa_enrollment_tokens
  for each row execute function identity.guard_mfa_secret_update();

-- 5. Row level security: refusal by default, the definer only -------------------------------

alter table identity.mfa_recovery_codes    enable row level security;
alter table identity.mfa_recovery_codes    force  row level security;
alter table identity.mfa_enrollment_tokens enable row level security;
alter table identity.mfa_enrollment_tokens force  row level security;
alter table identity.totp_replay_guards    enable row level security;
alter table identity.totp_replay_guards    force  row level security;

revoke all on identity.mfa_recovery_codes, identity.mfa_enrollment_tokens,
              identity.totp_replay_guards
  from public, anon, authenticated, service_role;

grant select (id, account_id, code_hash, consumed_at, revoked_at),
      insert (account_id, batch_id, code_hash),
      update (consumed_at, revoked_at)
   on identity.mfa_recovery_codes to influx_identity_definer;
grant select (id, account_id, token_hash, expires_at, consumed_at),
      update (consumed_at)
   on identity.mfa_enrollment_tokens to influx_identity_definer;
grant select (account_id, code_hmac, created_at),
      insert (account_id, code_hmac),
      delete
   on identity.totp_replay_guards to influx_identity_definer;
grant select (mfa_factor_id), update (mfa_factor_id, mfa_enrolled_at)
   on identity.agent_profiles to influx_identity_definer;

drop policy if exists mfa_recovery_codes_definer_all on identity.mfa_recovery_codes;
create policy mfa_recovery_codes_definer_all on identity.mfa_recovery_codes
  for all to influx_identity_definer using (true) with check (true);

drop policy if exists mfa_enrollment_tokens_definer_all on identity.mfa_enrollment_tokens;
create policy mfa_enrollment_tokens_definer_all on identity.mfa_enrollment_tokens
  for all to influx_identity_definer using (true) with check (true);

drop policy if exists totp_replay_guards_definer_all on identity.totp_replay_guards;
create policy totp_replay_guards_definer_all on identity.totp_replay_guards
  for all to influx_identity_definer using (true) with check (true);

drop policy if exists agent_profiles_identity_definer_update on identity.agent_profiles;
create policy agent_profiles_identity_definer_update on identity.agent_profiles
  for update to influx_identity_definer
  using (is_active) with check (is_active);

-- 6. The four functions -----------------------------------------------------------------------

create or replace function identity.enrollment_token_is_valid(
  p_account_id  uuid,
  p_token_hash  bytea
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from identity.mfa_enrollment_tokens t
      join identity.accounts a        on a.id = t.account_id and a.status = 'active'
      join identity.agent_profiles p  on p.account_id = t.account_id and p.is_active
     where t.account_id = p_account_id
       and t.token_hash = p_token_hash
       and pg_catalog.octet_length(p_token_hash) = 32
       and t.consumed_at is null
       and t.expires_at > pg_catalog.now()
       and p.mfa_factor_id is null)
$$;

comment on function identity.enrollment_token_is_valid(uuid, bytea) is
  'G-1 point 2, first enrollment request: true when the token (SHA-256) is the unconsumed, unexpired '
  'token of this active internal account, and no factor is pinned yet. Reads only. SECURITY DEFINER '
  'owned by influx_identity_definer; EXECUTE for influx_auth.';

create or replace function identity.pin_mfa_factor(
  p_account_id            uuid,
  p_factor_id             uuid,
  p_enrollment_token_hash bytea,
  p_recovery_code_hashes  bytea[]
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_batch uuid := gen_random_uuid();
  v_token uuid;
begin
  -- Ten distinct SHA-256 digests (J3-C rule 9).
  if p_factor_id is null
     or p_recovery_code_hashes is null
     or pg_catalog.cardinality(p_recovery_code_hashes) <> 10
     or (select count(distinct h) from unnest(p_recovery_code_hashes) h
          where pg_catalog.octet_length(h) = 32) <> 10 then
    raise exception 'invalid enrollment' using errcode = 'invalid_parameter_value';
  end if;

  -- One uniform refusal whatever fails: account, profile, pinned factor, token.
  update identity.mfa_enrollment_tokens t
     set consumed_at = pg_catalog.now()
    from identity.accounts a, identity.agent_profiles p
   where t.account_id = p_account_id
     and t.token_hash = p_enrollment_token_hash
     and t.consumed_at is null
     and t.expires_at > pg_catalog.now()
     and a.id = t.account_id and a.status = 'active'
     and p.account_id = t.account_id and p.is_active and p.mfa_factor_id is null
  returning t.id into v_token;
  if v_token is null then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  update identity.agent_profiles
     set mfa_factor_id = p_factor_id,
         mfa_enrolled_at = pg_catalog.now()
   where account_id = p_account_id
     and mfa_factor_id is null;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- A previous batch (enrollment after an MFA reset) is revoked, never deleted.
  update identity.mfa_recovery_codes
     set revoked_at = pg_catalog.now()
   where account_id = p_account_id
     and consumed_at is null and revoked_at is null;

  insert into identity.mfa_recovery_codes (account_id, batch_id, code_hash)
  select p_account_id, v_batch, h from unnest(p_recovery_code_hashes) h;

  perform audit.append('agent.mfa_enrolled', 'account', p_account_id, '{}'::jsonb);
  perform audit.append('agent.recovery_codes_generated', 'account', p_account_id,
                       pg_catalog.jsonb_build_object('count', 10));
  return v_batch;
end
$$;

comment on function identity.pin_mfa_factor(uuid, uuid, bytea, bytea[]) is
  'G-1 points 1 and 2, EC-17: second enrollment request, after the first TOTP code was verified by '
  'GoTrue and accepted by identity.accept_totp_code(). Consumes the enrollment token, pins the '
  'factor (only when none is pinned), revokes any previous batch and stores the ten new recovery '
  'code digests; audit agent.mfa_enrolled and agent.recovery_codes_generated (count only). Any '
  'failure: one uniform 42501. Returns the batch id. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_auth.';

create or replace function identity.consume_recovery_code(
  p_account_id uuid,
  p_code_hash  bytea
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_left integer;
begin
  if p_account_id is null or p_code_hash is null or pg_catalog.octet_length(p_code_hash) <> 32 then
    return null;
  end if;
  -- EC-17 point 3: single use under concurrency.
  update identity.mfa_recovery_codes
     set consumed_at = pg_catalog.now()
   where account_id = p_account_id
     and code_hash = p_code_hash
     and consumed_at is null and revoked_at is null
  returning id into v_id;
  if v_id is null then
    return null;
  end if;
  select count(*)::integer into v_left
    from identity.mfa_recovery_codes
   where account_id = p_account_id and consumed_at is null and revoked_at is null;
  perform audit.append('agent.recovery_code_consumed', 'account', p_account_id,
                       pg_catalog.jsonb_build_object('remaining', v_left));
  return v_left;
end
$$;

comment on function identity.consume_recovery_code(uuid, bytea) is
  'EC-17 point 3, EC-44 (1): consumes one usable recovery code (SHA-256) of the account, in the '
  'transaction that creates the session; returns the number of codes left, or NULL when the code is '
  'unknown, consumed or revoked (nothing written). Writes agent.recovery_code_consumed with the '
  'number left, never the code. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for '
  'influx_auth.';

create or replace function identity.accept_totp_code(
  p_account_id uuid,
  p_code_hmac  bytea
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_accepted boolean;
begin
  if p_account_id is null or p_code_hmac is null or pg_catalog.octet_length(p_code_hmac) <> 32 then
    return false;
  end if;
  delete from identity.totp_replay_guards
   where account_id = p_account_id
     and created_at < pg_catalog.now() - interval '120 seconds';
  -- EC-39: a conditional write; of two concurrent transactions with the same code, the
  -- second waits on the key, then finds the row and is refused.
  insert into identity.totp_replay_guards (account_id, code_hmac)
  values (p_account_id, p_code_hmac)
  on conflict (account_id, code_hmac) do nothing
  returning true into v_accepted;
  return coalesce(v_accepted, false);
end
$$;

comment on function identity.accept_totp_code(uuid, bytea) is
  'EC-39: records a TOTP code accepted by GoTrue (HMAC of factor and code), in the transaction that '
  'creates the session or records R. Returns false when the same code was accepted less than 120 s '
  'ago for this account (replay), true otherwise. Applies to the sign-in, the first code of the '
  'enrollment and R. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_auth.';

revoke all on function identity.enrollment_token_is_valid(uuid, bytea)           from public;
revoke all on function identity.pin_mfa_factor(uuid, uuid, bytea, bytea[])       from public;
revoke all on function identity.consume_recovery_code(uuid, bytea)               from public;
revoke all on function identity.accept_totp_code(uuid, bytea)                    from public;
grant execute on function identity.enrollment_token_is_valid(uuid, bytea),
                          identity.pin_mfa_factor(uuid, uuid, bytea, bytea[]),
                          identity.consume_recovery_code(uuid, bytea),
                          identity.accept_totp_code(uuid, bytea)
   to influx_auth;

-- 7. Hand the four functions to influx_identity_definer (window of 0004 §9) ----------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.enrollment_token_is_valid(uuid, bytea)     owner to influx_identity_definer;
alter function identity.pin_mfa_factor(uuid, uuid, bytea, bytea[]) owner to influx_identity_definer;
alter function identity.consume_recovery_code(uuid, bytea)         owner to influx_identity_definer;
alter function identity.accept_totp_code(uuid, bytea)              owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 8. End-state assertions ---------------------------------------------------------------------

do $$
declare
  v_bad text;
  v_fn  text;
begin
  foreach v_fn in array array[
    'identity.enrollment_token_is_valid(uuid, bytea)',
    'identity.pin_mfa_factor(uuid, uuid, bytea, bytea[])',
    'identity.consume_recovery_code(uuid, bytea)',
    'identity.accept_totp_code(uuid, bytea)'] loop
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

  -- no execution role holds a right on the three secret tables
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['identity.mfa_recovery_codes', 'identity.mfa_enrollment_tokens',
                      'identity.totp_replay_guards']) t
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'SELECT')
          or pg_catalog.has_any_column_privilege(r.oid, t, 'INSERT')
          or pg_catalog.has_any_column_privilege(r.oid, t, 'UPDATE')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE'));
  if v_bad is not null then
    raise exception 'execution role(s) with a right on a secret table: %', v_bad;
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
end
$$;
