-- =============================================================================
-- 0012_identity_session_writes
-- -----------------------------------------------------------------------------
-- Lot 0 / J3, commit 6. Who writes a session (EC-29, settled by expert-cybersecurite
-- on 2026-09-27), the second-factor freshness on the session row (EC-40), the
-- pinned TOTP factor of an internal account (G-1 point 1) and the closed format of
-- the browser summary (05 Q14, security review of J3 commits 1 to 4, point 3).
--
--   Creation     INSERT of named columns by influx_auth (E-2), policy WITH CHECK on
--                an active account whose role matches the surface; a backoffice
--                session also needs an active profile with a PINNED factor (G-1
--                point 1, C6-2 of the security review of J3 commits 5 and 6). Every date, the
--                aal and the first freshness are COMPUTED by a trigger: no caller
--                supplies them (EC-29 point 1).
--   Renewal      identity.touch_session(): SECURITY DEFINER, dates computed in base,
--                at most one write per hour (member) or per minute (backoffice)
--                (EC-29 point 2, J3-C rule 12).
--   Revocation   identity.revoke_own_session(): reasons logout and revoked_by_holder
--                only (EC-29 point 3). influx_auth revokes with
--                reauthentication_failed only (EC-40 point 5).
--   Irreversible a trigger: a revoked row is frozen, and token_hash, account_id,
--                surface, aal, created_at, absolute_expires_at, the browser summary
--                and the country never change (EC-29 point 4).
--   Freshness    mfa_verified_at / mfa_method written by influx_auth only; a change
--                is always "now, by TOTP" (EC-40 point 2); surface <=> aal <=>
--                freshness by a check constraint (EC-40 point 1).
-- No business role holds UPDATE or DELETE on the table; they keep reading their own
-- rows (0004), without the freshness columns.
--
-- ROLLBACK (before any real session): drop the two functions and the two
-- triggers; alter table identity.sessions drop the constraints and the columns
-- mfa_verified_at, mfa_method; alter table identity.agent_profiles drop column
-- mfa_factor_id; revoke the grants of influx_auth and influx_identity_definer
-- listed below; drop type identity.mfa_method. The enum value
-- reauthentication_failed cannot be removed from identity.session_revocation_reason
-- (PostgreSQL): harmless.
-- =============================================================================

-- 1. Types --------------------------------------------------------------------------

do $$
begin
  create type identity.mfa_method as enum ('totp', 'recovery_code');
exception when duplicate_object then null;
end
$$;

comment on type identity.mfa_method is
  'How the second factor of a backoffice session was last proven: totp, or a recovery code '
  '(which never satisfies a fresh re-authentication R, EC-17 point 4).';

-- EC-40 point 5. Never used literally in this file: a new enum value is usable only
-- once its transaction has committed.
alter type identity.session_revocation_reason add value if not exists 'reauthentication_failed';

-- 2. Columns and constraints ----------------------------------------------------------

alter table identity.sessions add column if not exists mfa_verified_at timestamptz;
alter table identity.sessions add column if not exists mfa_method identity.mfa_method;

comment on column identity.sessions.mfa_verified_at is
  'Last proof of the second factor on THIS session (EC-40): set at creation of a backoffice session, '
  'then only by a re-authentication R (password + TOTP). Written by influx_auth only, always to now(). '
  'R holds only if mfa_method = totp and now() - mfa_verified_at <= 5 minutes, read on the row.';
comment on column identity.sessions.mfa_method is
  'totp or recovery_code: how mfa_verified_at was obtained. NULL for a member session.';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'sessions_surface_assurance'
                    and conrelid = 'identity.sessions'::regclass) then
    -- EC-40 point 1: no backoffice session below aal2, and a member session never
    -- carries a second-factor proof (until the D37 caducity clause).
    alter table identity.sessions add constraint sessions_surface_assurance check (
         (surface = 'backoffice' and aal = 'aal2'
          and mfa_verified_at is not null and mfa_method is not null)
      or (surface = 'member' and aal = 'aal1'
          and mfa_verified_at is null and mfa_method is null));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'sessions_mfa_after_creation'
                    and conrelid = 'identity.sessions'::regclass) then
    alter table identity.sessions add constraint sessions_mfa_after_creation
      check (mfa_verified_at is null or mfa_verified_at >= created_at);
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'sessions_user_agent_summary_format'
                    and conrelid = 'identity.sessions'::regclass) then
    -- 05 Q14 (security review of J3 commits 1 to 4, point 3): a key of the closed list
    -- "family.system", so that a raw user agent can never be stored by mistake.
    alter table identity.sessions add constraint sessions_user_agent_summary_format
      check (user_agent_summary ~ '^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,31}$');
  end if;
end
$$;

comment on column identity.sessions.user_agent_summary is
  'Key of the closed list of browser summaries, "family.system" (e.g. firefox.android, '
  'unknown.unknown), computed by apps/api (src/platform/user-agent.ts, 05 Q14). Never the raw user '
  'agent, never a version nor a device model (RG-J3-5). Format enforced by a check constraint.';

-- G-1 point 1: the TOTP factor INFLUX accepts for an internal account.
alter table identity.agent_profiles add column if not exists mfa_factor_id uuid;

comment on column identity.agent_profiles.mfa_factor_id is
  'Id of the GoTrue TOTP factor verified at enrollment (G-1 point 1). The sign-in challenges this '
  'factor only; any other verified factor listed by GoTrue is refused (agent.unexpected_mfa_factor). '
  'Set once by identity.pin_mfa_factor() (0013); cleared by the MFA reset of an administrator (J8).';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'agent_profiles_factor_enrolled'
                    and conrelid = 'identity.agent_profiles'::regclass) then
    alter table identity.agent_profiles add constraint agent_profiles_factor_enrolled
      check (mfa_factor_id is null or mfa_enrolled_at is not null);
  end if;
end
$$;

-- 3. Triggers: dates computed at creation, irreversibility afterwards ----------------

create or replace function identity.prepare_session()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.revoked_at is not null or new.revocation_reason is not null then
    raise exception 'a session is created open' using errcode = 'check_violation';
  end if;
  -- 03 §6.1: member 30 days sliding / 180 days absolute; backoffice 30 minutes / 8 hours.
  new.created_at       := pg_catalog.now();
  new.updated_at       := pg_catalog.now();
  new.last_activity_at := pg_catalog.now();
  if new.surface = 'backoffice' then
    new.aal                 := 'aal2';
    new.absolute_expires_at := pg_catalog.now() + interval '8 hours';
    new.idle_expires_at     := pg_catalog.now() + interval '30 minutes';
    -- the session is born in aal2 from the sign-in that proved the factor (EC-40)
    new.mfa_verified_at     := pg_catalog.now();
  else
    new.aal                 := 'aal1';
    new.absolute_expires_at := pg_catalog.now() + interval '4320 hours';
    new.idle_expires_at     := pg_catalog.now() + interval '720 hours';
  end if;
  return new;
end
$$;

comment on function identity.prepare_session() is
  'BEFORE INSERT on identity.sessions: computes created_at, last_activity_at, aal, both expiries and '
  'the first freshness of a backoffice session from the surface (EC-29 point 1, 03 §6.1); a session '
  'is always created open. SECURITY INVOKER, reads nothing.';

create or replace function identity.guard_session_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- EC-29 point 4: a revoked session is frozen; it never comes back.
  if old.revoked_at is not null then
    raise exception 'a revoked session cannot be modified' using errcode = 'insufficient_privilege';
  end if;
  if new.id                  is distinct from old.id
     or new.token_hash          is distinct from old.token_hash
     or new.account_id          is distinct from old.account_id
     or new.surface             is distinct from old.surface
     or new.aal                 is distinct from old.aal
     or new.created_at          is distinct from old.created_at
     or new.absolute_expires_at is distinct from old.absolute_expires_at
     or new.user_agent_summary  is distinct from old.user_agent_summary
     or new.country_code        is distinct from old.country_code then
    raise exception 'immutable session column' using errcode = 'insufficient_privilege';
  end if;
  -- Activity only moves forward (renewal computes it in base, identity.touch_session()).
  if new.last_activity_at < old.last_activity_at then
    raise exception 'session activity cannot go back' using errcode = 'insufficient_privilege';
  end if;
  -- EC-40 point 2: a new proof of the second factor is always "now, by TOTP".
  if new.mfa_verified_at is distinct from old.mfa_verified_at
     or new.mfa_method is distinct from old.mfa_method then
    if old.surface <> 'backoffice'
       or new.mfa_verified_at is distinct from pg_catalog.now()
       or new.mfa_method is distinct from 'totp' then
      raise exception 'the second-factor freshness is only renewed now, by TOTP'
        using errcode = 'insufficient_privilege';
    end if;
  end if;
  if new.revoked_at is not null then
    -- the revocation instant is the transaction time, never a supplied value
    new.revoked_at := pg_catalog.now();
    -- influx_auth revokes only after failed re-authentications (EC-40 point 5)
    if current_user = 'influx_auth'
       and new.revocation_reason::text is distinct from 'reauthentication_failed' then
      raise exception 'revocation reason not allowed' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end
$$;

comment on function identity.guard_session_update() is
  'BEFORE UPDATE on identity.sessions (EC-29 point 4, EC-40): a revoked row is frozen; the identity '
  'of the session, its absolute expiry and its browser summary never change; activity only moves '
  'forward; a new second-factor proof is always now() by TOTP on a backoffice session; the '
  'revocation instant is now(); influx_auth revokes with reauthentication_failed only. SECURITY '
  'INVOKER: it reads nothing but current_user.';

revoke all on function identity.prepare_session()       from public;
revoke all on function identity.guard_session_update()  from public;

drop trigger if exists sessions_prepare on identity.sessions;
create trigger sessions_prepare
  before insert on identity.sessions
  for each row execute function identity.prepare_session();

drop trigger if exists sessions_guard_update on identity.sessions;
create trigger sessions_guard_update
  before update on identity.sessions
  for each row execute function identity.guard_session_update();

-- 4. Renewal and revocation by the holder (EC-29 points 2 and 3) -----------------------

create or replace function identity.touch_session(p_session_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_role     identity.account_role := influx.current_account_role();
  v_surface  identity.session_surface;
  v_idle     interval;
  v_quiet    interval;
  v_row      record;
begin
  if v_account is null or v_role is null or p_session_id is null then
    return false;
  end if;
  -- 03 §6.1 and J3-C rule 12: sliding idle expiry, and at most one write per hour
  -- (member) or per minute (backoffice), carried by the database.
  if v_role in ('advertiser', 'creator') then
    v_surface := 'member';
    v_idle    := interval '720 hours';
    v_quiet   := interval '1 hour';
  else
    if not influx.has_aal2() then
      return false;
    end if;
    v_surface := 'backoffice';
    v_idle    := interval '30 minutes';
    v_quiet   := interval '1 minute';
  end if;

  select s.id, s.last_activity_at, s.absolute_expires_at
    into v_row
    from identity.sessions s
   where s.id = p_session_id
     and s.account_id = v_account
     and s.surface = v_surface
     and s.revoked_at is null
     and s.idle_expires_at     > pg_catalog.now()
     and s.absolute_expires_at > pg_catalog.now()
   for update;
  if not found then
    return false;
  end if;
  if v_row.last_activity_at > pg_catalog.now() - v_quiet then
    return false;
  end if;

  update identity.sessions
     set last_activity_at = pg_catalog.now(),
         idle_expires_at  = least(pg_catalog.now() + v_idle, v_row.absolute_expires_at)
   where id = v_row.id;
  return true;
end
$$;

comment on function identity.touch_session(uuid) is
  'Sliding renewal of the CALLER''s session (EC-29 point 2): session of the current account, open, '
  'not expired, surface matching the role (backoffice needs aal2). Dates computed in base: '
  'last_activity_at = now(), idle_expires_at = least(now() + 30 days or 30 minutes, absolute '
  'expiry). No write if the last one is less than one hour (member) or one minute (backoffice) old. '
  'Returns true when it wrote. Unknown, foreign or closed session: false, nothing written. SECURITY '
  'DEFINER owned by influx_identity_definer; EXECUTE for the four business roles.';

create or replace function identity.revoke_own_session(
  p_session_id uuid,
  p_reason     identity.session_revocation_reason
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account uuid := influx.current_account_id();
begin
  if p_reason is null or p_reason not in ('logout', 'revoked_by_holder') then
    raise exception 'revocation reason not allowed' using errcode = 'invalid_parameter_value';
  end if;
  if v_account is null or p_session_id is null then
    return false;
  end if;
  update identity.sessions
     set revoked_at = pg_catalog.now(),
         revocation_reason = p_reason
   where id = p_session_id
     and account_id = v_account
     and revoked_at is null;
  return found;
end
$$;

comment on function identity.revoke_own_session(uuid, identity.session_revocation_reason) is
  'Revocation by the holder (EC-29 point 3, 03 A-12): logout or revoked_by_holder only, on a session '
  'of the current account. Returns true when it revoked; foreign, unknown or already revoked: false. '
  'Irreversible (identity.guard_session_update()). SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for the four business roles. Third-party revocation and '
  'suspension: J8.';

revoke all on function identity.touch_session(uuid) from public;
revoke all on function identity.revoke_own_session(uuid, identity.session_revocation_reason) from public;
grant execute on function identity.touch_session(uuid)
   to influx_advertiser, influx_creator, influx_agent, influx_admin;
grant execute on function identity.revoke_own_session(uuid, identity.session_revocation_reason)
   to influx_advertiser, influx_creator, influx_agent, influx_admin;

-- 5. Rights of the owner of the two functions ------------------------------------------

grant select (id, account_id, surface, last_activity_at, idle_expires_at, absolute_expires_at,
              revoked_at)
   on identity.sessions to influx_identity_definer;
grant update (last_activity_at, idle_expires_at, revoked_at, revocation_reason)
   on identity.sessions to influx_identity_definer;

drop policy if exists sessions_identity_definer_select on identity.sessions;
create policy sessions_identity_definer_select on identity.sessions
  for select to influx_identity_definer
  using (true);

drop policy if exists sessions_identity_definer_update on identity.sessions;
create policy sessions_identity_definer_update on identity.sessions
  for update to influx_identity_definer
  using (revoked_at is null)
  with check (true);

-- 6. Rights of influx_auth (E-2), column by column (03 P7, EC-5) -------------------------

grant usage on schema identity to influx_auth;

-- Reads of the sign-in: the account by GoTrue user id or address, its role, the internal
-- profile (active, break-glass, pinned factor). Nothing else of the account.
grant select (id, auth_user_id, email, status) on identity.accounts       to influx_auth;
grant select (account_id, role)                on identity.account_roles  to influx_auth;
grant select (account_id, is_active, is_break_glass, mfa_factor_id)
   on identity.agent_profiles to influx_auth;

drop policy if exists accounts_auth_select on identity.accounts;
create policy accounts_auth_select on identity.accounts
  for select to influx_auth using (true);

drop policy if exists account_roles_auth_select on identity.account_roles;
create policy account_roles_auth_select on identity.account_roles
  for select to influx_auth using (true);

drop policy if exists agent_profiles_auth_select on identity.agent_profiles;
create policy agent_profiles_auth_select on identity.agent_profiles
  for select to influx_auth using (true);

-- Sessions: creation (named columns; every date and the aal are computed), the
-- freshness of R, and the revocation after failed re-authentications.
grant insert (token_hash, account_id, surface, mfa_method, user_agent_summary)
   on identity.sessions to influx_auth;
grant select (id, account_id, surface, aal, idle_expires_at, absolute_expires_at, revoked_at,
              mfa_verified_at, mfa_method)
   on identity.sessions to influx_auth;
grant update (mfa_verified_at, mfa_method, revoked_at, revocation_reason)
   on identity.sessions to influx_auth;

drop policy if exists sessions_auth_select on identity.sessions;
create policy sessions_auth_select on identity.sessions
  for select to influx_auth using (true);

drop policy if exists sessions_auth_insert on identity.sessions;
create policy sessions_auth_insert on identity.sessions
  for insert to influx_auth
  with check (
    exists (
      select 1
        from identity.accounts a
        join identity.account_roles r on r.account_id = a.id
        left join identity.agent_profiles p on p.account_id = a.id
       where a.id = sessions.account_id
         and a.status = 'active'
         and (   (r.role in ('advertiser', 'creator') and sessions.surface = 'member')
              or (r.role in ('agent', 'admin') and sessions.surface = 'backoffice'
                  -- G-1 point 1, C6-2: no backoffice session before the factor is pinned
                  and p.is_active is true and p.mfa_factor_id is not null))));

drop policy if exists sessions_auth_update on identity.sessions;
create policy sessions_auth_update on identity.sessions
  for update to influx_auth
  using (revoked_at is null and surface = 'backoffice')
  with check (surface = 'backoffice');

-- 7. Hand the two functions to influx_identity_definer (03 P7 rule 5, window of 0004 §9)

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.touch_session(uuid) owner to influx_identity_definer;
alter function identity.revoke_own_session(uuid, identity.session_revocation_reason)
  owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 8. End-state assertions ----------------------------------------------------------------

do $$
declare
  v_bad text;
  v_fn  text;
begin
  foreach v_fn in array array[
    'identity.touch_session(uuid)',
    'identity.revoke_own_session(uuid, identity.session_revocation_reason)'] loop
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
       and (a.grantee = 0
            or a.grantee::regrole::text not in
               ('influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin'));
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- no business role writes or deletes a session directly (EC-29 point 4)
  select string_agg(r.rolname || ' ' || p.priv, ', ') into v_bad
    from pg_catalog.pg_roles r,
         (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE')) p (priv)
   where r.rolname in ('influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin',
                       'influx_app')
     and (pg_catalog.has_table_privilege(r.oid, 'identity.sessions', p.priv)
          or (p.priv in ('INSERT', 'UPDATE')
              and pg_catalog.has_any_column_privilege(r.oid, 'identity.sessions', p.priv)));
  if v_bad is not null then
    raise exception 'business role(s) may write identity.sessions: %', v_bad;
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
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema identity';
  end if;
end
$$;
