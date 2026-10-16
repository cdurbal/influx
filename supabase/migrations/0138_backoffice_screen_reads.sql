-- =============================================================================
-- 0138_backoffice_screen_reads
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 9. What the screens of the backoffice v0 read that no role
-- could read yet (17b §3.13, §3.14.a, §3.14.e; 05 RG141, RG144, RG145; 03 B-7;
-- 21 J3S-6, EC-43):
--
--   identity.backoffice_session_state()   J3S-6: the second factor that opened the
--         CALLER's own backoffice session, and how many recovery codes are left when
--         it was a recovery code. The banner of 17b §3.14.a is derived from it at
--         every page, never from the `?secours=N` of the address bar. agent, admin.
--   agent.new_browser + identity.signal_new_backoffice_browser()   B-7 (RG145):
--         the "new browser" signal of RG141 on the backoffice sessions of an internal
--         account. E-2 identity.backoffice_sign_in, influx_auth ONLY, in the
--         transaction that opened the session: the first backoffice session of the
--         account never signals; another backoffice session with the same summary
--         active in the last 30 days makes the browser known; otherwise ONE register
--         line agent.new_browser {session_id, browser} on the account. An alert to
--         the admins, never a suspension (RG145), never a country (EC-43).
--   backoffice.new_browser_sign_ins()   the admins read the signals of the last
--         p_days days (1 to 30), newest first, with the first name of the person
--         (17b §3.14.e `bo.alert.newBrowser.body`). admin in aal2 only.
--
-- ROLLBACK (before any real line): drop the three functions; delete the code
-- agent.new_browser from audit.event_types (possible only while no line references
-- it); revoke select (first_name) on identity.agent_profiles from
-- influx_identity_definer.
-- =============================================================================

-- 1. The code -----------------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  ('agent.new_browser', 'identity', 'account', 'sensitive')
on conflict (code) do nothing;

-- 2. Rights of the owner of the three functions (influx_identity_definer) --------------------------
-- identity.sessions: id, account_id, surface, created_at, last_activity_at, revoked_at (0012,
-- 0118), user_agent_summary (0126), mfa_method (0130); identity.mfa_recovery_codes (0013);
-- agent_profiles: account_id, is_active (0004). The first name is the only new column.

grant select (first_name) on identity.agent_profiles to influx_identity_definer;

-- 3. J3S-6: the state of the caller's own session ---------------------------------------------------

create or replace function identity.backoffice_session_state(
  p_session_id  uuid
)
returns table (
  mfa_method           text,
  recovery_codes_left  integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := influx.current_account_id();
  v_method  text;
begin
  if v_caller is null or influx.current_account_role() not in ('agent', 'admin')
     or not influx.has_aal2() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The caller's own open backoffice session only: same refusal for any other id.
  select s.mfa_method::text
    into v_method
    from identity.sessions s
   where s.id = p_session_id
     and s.account_id = v_caller
     and s.surface = 'backoffice'
     and s.revoked_at is null;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  return query
  select v_method,
         case when v_method = 'recovery_code'
              then (select pg_catalog.count(*)::integer
                      from identity.mfa_recovery_codes c
                     where c.account_id = v_caller
                       and c.consumed_at is null
                       and c.revoked_at is null)
         end;
end
$$;

comment on function identity.backoffice_session_state(uuid) is
  'J3S-6 (17b §3.14.a): the second factor (totp | recovery_code) of the CALLER''s own open backoffice '
  'session p_session_id, and the recovery codes left when it was opened by one (null otherwise). '
  '42501 forbidden for any other session, a member or a session below aal2. Never a code nor a '
  'digest. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_agent, influx_admin.';

revoke all on function identity.backoffice_session_state(uuid)
  from public, anon, authenticated, service_role;
grant execute on function identity.backoffice_session_state(uuid) to influx_agent, influx_admin;

-- 4. B-7: the signal on a backoffice sign-in ----------------------------------------------------------

create or replace function identity.signal_new_backoffice_browser(
  p_session_id  uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session  record;
  v_summary  text;
begin
  -- Only the backoffice session this very transaction opened: never replayed later, nor raised
  -- on a session of somebody else's choosing.
  select s.id, s.account_id, s.user_agent_summary
    into v_session
    from identity.sessions s
   where s.id = p_session_id
     and s.surface = 'backoffice'
     and s.revoked_at is null
     and s.created_at = pg_catalog.now();
  if not found then
    raise exception 'a backoffice session opened by this transaction only'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  v_summary := coalesce(v_session.user_agent_summary, 'unidentified.unidentified');

  -- RG141: the first backoffice session of an account never signals.
  if not exists (select 1
                   from identity.sessions o
                  where o.account_id = v_session.account_id
                    and o.surface = 'backoffice'
                    and o.id <> v_session.id) then
    return false;
  end if;

  -- RG141: known when another backoffice session of the account with the same summary had
  -- activity in the last 30 days (720 hours), closed or not. "unidentified" is a value like any.
  if exists (select 1
               from identity.sessions o
              where o.account_id = v_session.account_id
                and o.surface = 'backoffice'
                and o.id <> v_session.id
                and coalesce(o.user_agent_summary, 'unidentified.unidentified') = v_summary
                and o.last_activity_at >= pg_catalog.now() - interval '720 hours') then
    return false;
  end if;

  -- RG145: an alert to the admins, as a register line on the account (ids and the summary only).
  perform audit.append('agent.new_browser', 'account', v_session.account_id,
                       pg_catalog.jsonb_build_object('session_id', v_session.id,
                                                     'browser', v_summary));
  return true;
end
$$;

comment on function identity.signal_new_backoffice_browser(uuid) is
  'E-2 identity.backoffice_sign_in (05 RG141, RG145; 03 B-7; 21 EC-43): on the backoffice session '
  'opened by the calling transaction (55000 otherwise), writes agent.new_browser {session_id, '
  'browser} on the account unless it is the first backoffice session of the account, or another '
  'backoffice session with the same summary had activity in the last 30 days. Returns true when a '
  'line was written. Never blocks nor suspends, never a country. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_auth ONLY.';

revoke all on function identity.signal_new_backoffice_browser(uuid)
  from public, anon, authenticated, service_role;
grant execute on function identity.signal_new_backoffice_browser(uuid) to influx_auth;

-- 5. B-7: what the admins read --------------------------------------------------------------------

create or replace function backoffice.new_browser_sign_ins(
  p_days  integer default 7
)
returns table (
  account_id   uuid,
  first_name   text,
  occurred_at  timestamptz,
  browser      text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := influx.current_account_id();
begin
  if v_caller is null or influx.current_account_role() <> 'admin'
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'admin'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_days is null or p_days not between 1 and 30 then
    raise exception 'p_days outside 1 to 30' using errcode = 'invalid_parameter_value';
  end if;

  return query
  select e.subject_id, p.first_name, e.occurred_at, e.payload ->> 'browser'
    from audit.audit_events e
    left join identity.agent_profiles p on p.account_id = e.subject_id
   where e.event_type = 'agent.new_browser'
     and e.subject_type = 'account'
     and e.occurred_at >= pg_catalog.now() - pg_catalog.make_interval(days => p_days)
   order by e.occurred_at desc, e.seq desc
   limit 50;
end
$$;

comment on function backoffice.new_browser_sign_ins(integer) is
  'B-7 (05 RG145; 17b §3.14.e): the agent.new_browser lines of the last p_days days (1 to 30, 7 by '
  'default; 22023 otherwise), newest first, 50 at most: the internal account, its first name, the '
  'instant and the browser summary. An active admin in aal2 only (42501 forbidden otherwise). '
  'SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_admin.';

revoke all on function backoffice.new_browser_sign_ins(integer)
  from public, anon, authenticated, service_role;
grant execute on function backoffice.new_browser_sign_ins(integer) to influx_admin;

-- 6. Hand the functions to their owner (03 P7 rule 5, window of 0004 §9) ------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;
grant create on schema backoffice to influx_identity_definer;
alter function identity.backoffice_session_state(uuid) owner to influx_identity_definer;
alter function identity.signal_new_backoffice_browser(uuid) owner to influx_identity_definer;
alter function backoffice.new_browser_sign_ins(integer) owner to influx_identity_definer;
revoke create on schema identity from influx_identity_definer;
revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 7. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('identity.backoffice_session_state(uuid)', array['influx_agent', 'influx_admin']),
      ('identity.signal_new_backoffice_browser(uuid)', array['influx_auth']),
      ('backoffice.new_browser_sign_ins(integer)', array['influx_admin'])
    ) as t (fn, callers)
  loop
    v_fn := v_def.fn;
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
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- no usable member left on the owner (C-9: the ADMIN-only migration role)
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_identity_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'influx_identity_definer kept CREATE on a schema';
  end if;
end
$$;
