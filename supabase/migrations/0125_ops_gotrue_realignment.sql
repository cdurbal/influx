-- =============================================================================
-- 0125_ops_gotrue_realignment
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 7 follow-up (expert-cybersecurite C5.b, architecte point 5,
-- 2026-10-14). The address of a GoTrue user follows identity.accounts.email: when
-- the end of an address change failed AFTER GoTrue took the new address (the
-- database refused or did not answer, and apps/api could not set GoTrue back),
-- the account cannot sign in until GoTrue is realigned. The hourly GoTrue pass of
-- E-4 (auth_orphan_purge, 0117) does it, durable and replayable:
--
--   ops.gotrue_realignment_candidates()   the accounts that had an address change
--         request with both sides confirmed in the last 72 hours, none of them in
--         the last 15 minutes (a completion may be in flight: it calls GoTrue right
--         after the second code), with their GoTrue user id and their address in
--         force. Read again for one account just before each GoTrue write. The
--         worker compares with GoTrue and writes the database's address there; it
--         never logs one (D60).
--
-- Owner influx_maintenance_definer (0117), inside the open auth_orphan_purge run of
-- the caller's attempt only; EXECUTE for influx_worker only. New rights of the owner:
-- the address and the state of the accounts, and the confirmation instants of the
-- requests (never their addresses nor their digests).
--
-- ROLLBACK: drop function ops.gotrue_realignment_candidates(uuid, smallint, uuid); revoke
-- select (id, email, status) on identity.accounts and select (account_id,
-- old_confirmed_at, new_confirmed_at) on identity.email_change_requests from
-- influx_maintenance_definer; drop policy email_change_requests_maintenance_definer_select.
-- =============================================================================

-- 1. The rights of the owner --------------------------------------------------------------------

-- identity.accounts: the select policy of 0117 (using true) already covers the owner
grant select (id, email, status) on identity.accounts to influx_maintenance_definer;

grant select (account_id, old_confirmed_at, new_confirmed_at)
   on identity.email_change_requests to influx_maintenance_definer;

drop policy if exists email_change_requests_maintenance_definer_select on identity.email_change_requests;
create policy email_change_requests_maintenance_definer_select on identity.email_change_requests
  for select to influx_maintenance_definer
  using (old_confirmed_at is not null and new_confirmed_at is not null);

-- 2. ops.gotrue_realignment_candidates() ----------------------------------------------------------

create or replace function ops.gotrue_realignment_candidates(
  p_run_id      uuid,
  p_attempt     smallint,
  p_account_id  uuid
)
returns table (account_id uuid, auth_user_id uuid, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- Only inside the open run of the hourly GoTrue pass, held by this attempt.
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'auth_orphan_purge') then
    raise exception 'no open auth_orphan_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  return query
  select a.id, a.auth_user_id, a.email::text
    from identity.accounts a
   where a.status <> 'deleted'
     and a.auth_user_id is not null
     and (p_account_id is null or a.id = p_account_id)
     and exists (select 1 from identity.email_change_requests r
                  where r.account_id = a.id
                    and greatest(r.old_confirmed_at, r.new_confirmed_at)
                        > pg_catalog.now() - interval '72 hours')
     and not exists (select 1 from identity.email_change_requests r
                      where r.account_id = a.id
                        and greatest(r.old_confirmed_at, r.new_confirmed_at)
                            > pg_catalog.now() - interval '15 minutes')
   -- the most recent first: the likeliest to be locking a member out right now
   order by (select pg_catalog.max(greatest(r.old_confirmed_at, r.new_confirmed_at))
               from identity.email_change_requests r
              where r.account_id = a.id) desc, a.id
   limit 200;
end
$$;

comment on function ops.gotrue_realignment_candidates(uuid, smallint, uuid) is
  'E-4, hourly GoTrue pass (C5.b of the J7 commit 7 review): the accounts (all, or p_account_id) '
  'with an address change request whose both sides were confirmed in the last 72 hours, none in '
  'the last 15 minutes (a completion may be in flight), 200 at most, the most recent first: account, GoTrue user id and '
  'address in force, which the worker writes to GoTrue when they differ (the database is the '
  'source of truth). Personal data: the address, kept in memory, never logged. Inside the open '
  'auth_orphan_purge run of this attempt only (55000 otherwise). SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

revoke all on function ops.gotrue_realignment_candidates(uuid, smallint, uuid)
  from public, anon, authenticated, service_role;
grant execute on function ops.gotrue_realignment_candidates(uuid, smallint, uuid) to influx_worker;

-- 3. Hand the function to influx_maintenance_definer (03 P7 rule 5, window of 0004 §9) -------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;

alter function ops.gotrue_realignment_candidates(uuid, smallint, uuid)
  owner to influx_maintenance_definer;

revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 4. End-state assertions ------------------------------------------------------------------------

do $$
declare
  v_fn   text := 'ops.gotrue_realignment_candidates(uuid, smallint, uuid)';
  v_bad  text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = v_fn::regprocedure) <> 'influx_maintenance_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_maintenance_definer, empty search_path', v_fn;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = v_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_worker');
  if v_bad is not null then
    raise exception '% executable by: %', v_fn, v_bad;
  end if;

  -- the owner never reads the addresses of a request nor its digests
  if pg_catalog.has_column_privilege('influx_maintenance_definer', 'identity.email_change_requests',
                                     'old_email', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'identity.email_change_requests',
                                        'new_email', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'identity.email_change_requests',
                                        'old_code_hash', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer', 'identity.email_change_requests',
                                        'new_code_hash', 'SELECT') then
    raise exception 'influx_maintenance_definer may read an address or a digest of a request';
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_maintenance_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_maintenance_definer left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE') then
    raise exception 'influx_maintenance_definer left with CREATE on schema ops';
  end if;
end
$$;
