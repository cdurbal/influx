-- =============================================================================
-- 0144_identity_session_bound_reauth_and_orphan_checks
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, commit 3. What the database owes before Lot 1 and before production on the member
-- identity (j9-fiche, tickets J7S-1, J7S-2, C5.c):
--
--   identity.consume_member_reauthentication(uuid, identity.reauth_purpose)   J7S-1: the
--         check-and-clear of the member marker (0118 §4.2) now also refuses (55000, same message,
--         nothing written) unless p_session_id IS the session of the request
--         (influx.current_session_id(), 0142: the claim session_id of request.jwt.claims posed by
--         apps/api; a missing claim is NULL, hence refused). Before 0144, the marker of any open
--         member session of the same account passed. Same signature, still SECURITY INVOKER
--         owned by influx_identity_definer, still NO grant; 300 seconds still written once. Its
--         three callers, identity.request_email_change() (0118),
--         backoffice.submit_data_subject_request() (0120) and privacy.download_own_export()
--         (0137), are SECURITY DEFINER owned by influx_identity_definer, which holds EXECUTE on
--         influx.current_session_id() (0142): none changes.
--   identity.email_change_holder_is_orphan(uuid, uuid)   C5.c: GoTrue refused the new address of a
--         fully confirmed change as taken (email_exists); apps/api looked up the GoTrue user
--         holding it and asks whether that user may be deleted (then tries the move again). TRUE
--         only for the caller's own open, unexpired request with both sides confirmed, and a
--         holder id that no identity.accounts.auth_user_id references (on the id, never on an
--         address, as ops.filter_auth_orphans()). A read: writes nothing. SECURITY DEFINER owned
--         by influx_identity_definer; EXECUTE for influx_advertiser and influx_creator.
--   ops.filter_auth_orphans(uuid, smallint, uuid[])   J7S-2, the database half of the breaker of
--         the GoTrue purge (0117 §4.3): after its checks (22023 parameters, 55000 run), 55000
--         again when identity.accounts reads EMPTY to its owner (a policy or a connection gone
--         wrong would make every GoTrue user an orphan). apps/api maps it to
--         breaker.filter_refused; its own breaker (a page of more than 20 users, more than half
--         orphans) is in the worker. Same signature, owner influx_maintenance_definer, EXECUTE
--         for influx_worker only.
--
-- ROLLBACK (before any real use): drop function identity.email_change_holder_is_orphan(uuid,
-- uuid); restate identity.consume_member_reauthentication() as in 0118 §4.2 (as
-- influx_identity_definer) and ops.filter_auth_orphans() as in 0117 §4.3 (as
-- influx_maintenance_definer), with their comments; their grants are kept by CREATE OR REPLACE.
-- =============================================================================

-- 1. The member marker bound to the session of the request (J7S-1), as influx_identity_definer ----

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;
set role influx_identity_definer;

create or replace function identity.consume_member_reauthentication(
  p_session_id  uuid,
  p_purpose     identity.reauth_purpose
)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
begin
  -- J7S-1: the session named by the caller must be the session of THIS request (the claim posed
  -- by apps/api), never another open session of the same account. Missing claim: refused, with
  -- the one answer below (no oracle), nothing written.
  if p_session_id is null or p_session_id is distinct from influx.current_session_id() then
    raise exception 'a fresh re-authentication for this action is required'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- 300 seconds: REAUTHENTICATION_FRESHNESS_SECONDS (provisional, decision 4). The session is
  -- one of the CALLER's (influx.account), open and unexpired; the marker serves once.
  update identity.sessions s
     set reauthenticated_at = null,
         reauth_purpose     = null
   where s.id = p_session_id
     and s.account_id = influx.current_account_id()
     and s.surface = 'member'
     and s.revoked_at is null
     and s.idle_expires_at     > pg_catalog.now()
     and s.absolute_expires_at > pg_catalog.now()
     and s.reauth_purpose = p_purpose
     and s.reauthenticated_at >= pg_catalog.now() - interval '300 seconds';
  if not found then
    raise exception 'a fresh re-authentication for this action is required'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
end
$$;

comment on function identity.consume_member_reauthentication(uuid, identity.reauth_purpose) is
  'Decision 4 of J7, J7S-1 (0144): checks that p_session_id is the session of the REQUEST '
  '(influx.current_session_id(), claim session_id of request.jwt.claims), an open, unexpired member '
  'session of the CALLER carrying a re-authentication marker for p_purpose younger than 300 '
  'seconds, and clears it (single use), in the transaction of the sensitive action; 55000 otherwise, '
  'a missing claim included (nothing written: the whole action fails). SECURITY INVOKER owned by '
  'influx_identity_definer, NO grant: called by the identity functions only.';

-- 2. C5.c: may the GoTrue user holding the new address be deleted --------------------------------

create or replace function identity.email_change_holder_is_orphan(
  p_request_id  uuid,
  p_holder      uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_holder is null then
    return false;
  end if;

  -- the caller's own open request, both codes typed, unexpired: the only state in which apps/api
  -- asked GoTrue for the new address (as identity.refuse_email_change_address(), 0123)
  perform 1
     from identity.email_change_requests r
    where r.id = p_request_id
      and r.account_id = v_account
      and r.completed_at is null
      and r.cancelled_at is null
      and r.old_confirmed_at is not null
      and r.new_confirmed_at is not null
      and r.expires_at > pg_catalog.now();
  if not found then
    return false;
  end if;

  -- 04 §9, as ops.filter_auth_orphans(): the match is on auth_user_id, NEVER on an address; a
  -- deleted account keeps its line, hence its GoTrue user (the caller's own user included).
  return not exists (select 1 from identity.accounts a where a.auth_user_id = p_holder);
end
$$;

comment on function identity.email_change_holder_is_orphan(uuid, uuid) is
  'C5.c (J9 commit 3): GoTrue refused the new address of a fully confirmed change as taken '
  '(email_exists) and apps/api looked up the GoTrue user holding it: TRUE when that user may be '
  'deleted (then the move is tried again), i.e. p_holder is given, p_request_id is the caller''s own '
  'request, open (neither completed nor cancelled), unexpired, with both sides confirmed, and no '
  'identity.accounts line has auth_user_id = p_holder (on the id only, never on an address: a '
  'deleted account keeps its line, hence its user; same rule as ops.filter_auth_orphans()). FALSE '
  'otherwise; writes nothing. 42501 outside a member context. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and influx_creator.';

revoke all on function identity.email_change_holder_is_orphan(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function identity.email_change_holder_is_orphan(uuid, uuid)
   to influx_advertiser, influx_creator;

reset role;
revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 3. J7S-2: the purge names no orphan while identity.accounts reads empty, as the maintenance owner -

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;
set role influx_maintenance_definer;

create or replace function ops.filter_auth_orphans(
  p_run_id         uuid,
  p_attempt        smallint,
  p_auth_user_ids  uuid[]
)
returns table (auth_user_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_auth_user_ids is null or pg_catalog.cardinality(p_auth_user_ids) > 1000
     or pg_catalog.array_position(p_auth_user_ids, null) is not null then
    raise exception 'between 0 and 1000 ids, none NULL' using errcode = 'invalid_parameter_value';
  end if;
  -- Only inside the open run of the purge, held by this attempt.
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'auth_orphan_purge') then
    raise exception 'no open auth_orphan_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  -- J7S-2, the breaker of the database: read under the owner's own policies, an empty table means
  -- a policy or a connection gone wrong, never a platform without accounts. Naming every GoTrue
  -- user an orphan would delete the users of real accounts: refuse, name none.
  if not exists (select 1 from identity.accounts) then
    raise exception 'identity.accounts reads empty: no orphan is named'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- 04 §9: the match is on auth_user_id, NEVER on an address; a deleted account keeps its
  -- line, hence its GoTrue user.
  return query
  select distinct u.id
    from pg_catalog.unnest(p_auth_user_ids) as u (id)
   where not exists (select 1 from identity.accounts a where a.auth_user_id = u.id)
   order by u.id;
end
$$;

comment on function ops.filter_auth_orphans(uuid, smallint, uuid[]) is
  'E-4, purge of the GoTrue users without an account (04 §9, D43): returns those of the given ids '
  '(at most 1000, none NULL; 22023 otherwise) that no identity.accounts.auth_user_id references. '
  'Matching on auth_user_id only, never on an address. Called once per page of admin.listUsers, then '
  'again with the single id before each admin.deleteUser (decision 3). Inside the open '
  'auth_orphan_purge run of this attempt only (55000 otherwise). J7S-2 (0144): 55000 as well while '
  'identity.accounts reads empty to the owner (a policy or a connection gone wrong would make every '
  'GoTrue user an orphan): apps/api maps it to breaker.filter_refused. The age filter (created_at, '
  'updated_at, last_sign_in_at all older than 24 h) and the ratio breaker of a page are applied by '
  'the worker on the GoTrue data. SECURITY DEFINER owned by influx_maintenance_definer, empty '
  'search_path; EXECUTE for influx_worker ONLY.';

reset role;
revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 4. End-state assertions --------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  -- the function inventory of 0144: owner, SECURITY DEFINER or not, empty search_path, callers
  for v_def in
    select * from (values
      ('identity.consume_member_reauthentication(uuid, identity.reauth_purpose)',
       'influx_identity_definer',    false, array[]::text[]),
      ('identity.email_change_holder_is_orphan(uuid, uuid)',
       'influx_identity_definer',    true,  array['influx_advertiser', 'influx_creator']),
      ('ops.filter_auth_orphans(uuid, smallint, uuid[])',
       'influx_maintenance_definer', true,  array['influx_worker'])
    ) as t (fn, owner, definer, callers)
  loop
    v_fn := v_def.fn;
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> v_def.owner
       or (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure) <> v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by % (SECURITY DEFINER: %), empty search_path',
        v_fn, v_def.owner, v_def.definer;
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

  -- the read of C5.c writes nothing
  if (select provolatile from pg_catalog.pg_proc
       where oid = 'identity.email_change_holder_is_orphan(uuid, uuid)'::regprocedure) <> 's' then
    raise exception 'identity.email_change_holder_is_orphan() must be STABLE';
  end if;

  -- J7S-1: the marker reads the session of the request, and keeps its one freshness bound (J7S-7)
  v_fn := pg_catalog.pg_get_functiondef(
            'identity.consume_member_reauthentication(uuid, identity.reauth_purpose)'::regprocedure);
  if position('influx.current_session_id()' in v_fn) = 0 then
    raise exception 'identity.consume_member_reauthentication() does not read the session of the request';
  end if;
  if (select count(*) from pg_catalog.regexp_matches(v_fn, 'interval ''(\d+) seconds''', 'g') m)
       <> 1
     or position('interval ''300 seconds''' in v_fn) = 0 then
    raise exception 'identity.consume_member_reauthentication() must hold one bound, 300 seconds';
  end if;

  -- the callers of the marker: owned by influx_identity_definer, which reads the claim (0142)
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('identity.request_email_change(uuid, uuid, text, bytea, bytea)'::regprocedure,
                   'backoffice.submit_data_subject_request(uuid, backoffice.data_request_type)'::regprocedure,
                   'privacy.download_own_export(uuid, uuid)'::regprocedure)
     and (pg_catalog.pg_get_userbyid(p.proowner) <> 'influx_identity_definer' or not p.prosecdef);
  if v_bad is not null then
    raise exception 'caller(s) of the marker not SECURITY DEFINER owned by influx_identity_definer: %',
      v_bad;
  end if;
  if not pg_catalog.has_function_privilege('influx_identity_definer', 'influx.current_session_id()',
                                           'EXECUTE') then
    raise exception 'influx_identity_definer cannot read the session of the request';
  end if;

  -- J7S-2: the purge refuses an empty identity.accounts
  if position('from identity.accounts)' in pg_catalog.pg_get_functiondef(
       'ops.filter_auth_orphans(uuid, smallint, uuid[])'::regprocedure)) = 0 then
    raise exception 'ops.filter_auth_orphans() lacks the breaker of an empty identity.accounts';
  end if;

  -- no usable member left on the owners (C-9: the ADMIN-only migration role), no CREATE kept
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_identity_definer', 'influx_maintenance_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE') then
    raise exception 'a function owner kept CREATE on a schema';
  end if;
end
$$;
