-- =============================================================================
-- 0114_identity_critical_alert
-- -----------------------------------------------------------------------------
-- Lot 1 / J6, commit 6. EC-44 (21 §3), J6 start decision 1: the e-mail
-- internal.critical_alert (16 §H, P0) on agent.break_glass_login (MFA-10) and
-- agent.recovery_code_consumed (MFA-4), sent by apps/api on its synchronous path
-- (16 RG86, D43), NEVER through leads.outbox_events. Two changes, both for the
-- backoffice sign-in (E-2, influx_auth):
--
--   1  identity.consume_recovery_code() also returns the seq of the audit line it
--      writes: the alert identifier (16 §H: idempotence = alert id + recipient).
--      agent.break_glass_login needs nothing: audit.append_auth_event() already
--      returns its seq (0011). Same body, same rights, same owner; a new return
--      type is a drop and a create (out parameters: always one row, both NULL
--      when the code is unknown, consumed or revoked).
--   2  influx_auth may insert the P0 journal line of the alert: one line per
--      recipient, ALWAYS with an account (the recipients are admin accounts read
--      in the database), never an address in clear, never a queue event.
--      No new column right: the insert columns of 0015 suffice. The recipients
--      are read with the column rights influx_auth already holds (accounts id,
--      email, status; account_roles; agent_profiles is_active, is_break_glass).
--
-- ROLLBACK (before any real alert): restore the policy of 0015; drop function
-- identity.consume_recovery_code(uuid, bytea) and re-run its section of 0013.
-- =============================================================================

-- 1. identity.consume_recovery_code(): the seq of its audit line -------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;

set role influx_identity_definer;
drop function if exists identity.consume_recovery_code(uuid, bytea);
reset role;

create function identity.consume_recovery_code(
  p_account_id uuid,
  p_code_hash  bytea,
  out remaining integer,
  out audit_seq bigint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_account_id is null or p_code_hash is null or pg_catalog.octet_length(p_code_hash) <> 32 then
    return;
  end if;
  -- EC-17 point 3: single use under concurrency.
  update identity.mfa_recovery_codes
     set consumed_at = pg_catalog.now()
   where account_id = p_account_id
     and code_hash = p_code_hash
     and consumed_at is null and revoked_at is null
  returning id into v_id;
  if v_id is null then
    return;
  end if;
  select count(*)::integer into remaining
    from identity.mfa_recovery_codes
   where account_id = p_account_id and consumed_at is null and revoked_at is null;
  audit_seq := audit.append('agent.recovery_code_consumed', 'account', p_account_id,
                            pg_catalog.jsonb_build_object('remaining', remaining));
end
$$;

comment on function identity.consume_recovery_code(uuid, bytea) is
  'EC-17 point 3, EC-44 (1): consumes one usable recovery code (SHA-256) of the account, in the '
  'transaction that creates the session; returns the number of codes left and the seq of the audit '
  'line, or two NULLs when the code is unknown, consumed or revoked (nothing written). Writes '
  'agent.recovery_code_consumed with the number left, never the code; the seq identifies the '
  'internal.critical_alert of EC-44 (0114). SECURITY DEFINER owned by influx_identity_definer; '
  'EXECUTE for influx_auth.';

revoke all on function identity.consume_recovery_code(uuid, bytea) from public;
grant execute on function identity.consume_recovery_code(uuid, bytea) to influx_auth;

grant create on schema identity to influx_identity_definer;
alter function identity.consume_recovery_code(uuid, bytea) owner to influx_identity_definer;
revoke create on schema identity from influx_identity_definer;

do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 2. The P0 journal line of internal.critical_alert ----------------------------------------

drop policy if exists transactional_sends_auth_insert on leads.transactional_sends;
create policy transactional_sends_auth_insert on leads.transactional_sends
  for insert to influx_auth
  with check (priority = 'p0' and outbox_event_id is null
              and (email_code like 'auth.%'
                   or (email_code = 'internal.critical_alert' and account_id is not null)));

comment on policy transactional_sends_auth_insert on leads.transactional_sends is
  'E-1 and E-2 (influx_auth): the P0 lines only, never a queue event (D43). auth.* (the sign-in '
  'code, 0015) and, since 0114, internal.critical_alert (EC-44): one line per admin recipient, '
  'always with its account, never an address in clear.';

-- 3. End-state assertions ---------------------------------------------------------------------

do $$
declare
  c_fn  constant text := 'identity.consume_recovery_code(uuid, bytea)';
  v_bad text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = c_fn::regprocedure) <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_identity_definer, empty search_path', c_fn;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_auth');
  if v_bad is not null then
    raise exception '% executable by: %', c_fn, v_bad;
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
