-- =============================================================================
-- 0142_backoffice_session_bound_r_and_admin_grants
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, commit 1. The J8 debt the database owes before Lot 1 (j9-fiche, tickets
-- J8S-3, J8S-5, J8S-4 data read, F4):
--
--   influx.current_session_id()   J8S-3: the backoffice/member session of the REQUEST, read
--         from the claim session_id of request.jwt.claims posed by apps/api
--         (withUserTransaction, after identity.resolve_session()). NULL when the claim is
--         missing or not a uuid. SECURITY INVOKER, empty search_path, no table; EXECUTE for
--         influx_identity_definer only (the owner of R and of its callers).
--   identity.assert_fresh_second_factor(uuid)   J8S-3: R now refuses (42501 forbidden)
--         unless p_session_id IS the session of the request. Before 0142, any open fresh
--         backoffice session of the same account passed. Same signature, same owner, still
--         no grant: no caller changes (0130, 0131, 0132, 0134, 0137, 0141).
--   backoffice.member_invitations   J8S-5: the policy member_invitations_internal_select
--         (0131 §7.1: any agent or admin in aal2 reads every invitation; EC-J8-31 restricted
--         the agent in apps/api only) becomes two: influx_admin reads every invitation,
--         influx_agent only those it created; aal2 for both. The policies of the function
--         owners (0131 §7.2, 0137) are untouched.
--   backoffice.admin_role_grants(integer)   J8S-4: the account.role_granted lines granting
--         the role admin in the last p_days days (1 to 30), shaped like
--         backoffice.new_browser_sign_ins() (0138): the account, its first name, who granted
--         (payload granted_by_account_id of an accepted invitation, else the actor), his first
--         name, the instant. An active admin in aal2 only.
--   audit.audit_events_actor_idx   F4: (actor_account_id, occurred_at desc), lines with an
--         actor only: the per-actor reads of the backoffice (what an internal account did,
--         newest first; the "executed, not closed for 24 h" alert) and the ON DELETE RESTRICT
--         check of identity.accounts, which scanned the whole register.
--
-- ROLLBACK (before any real use): restate identity.assert_fresh_second_factor() as in 0130
-- §4.2 (as influx_identity_definer), then drop function influx.current_session_id(); drop
-- function backoffice.admin_role_grants(integer); drop policies member_invitations_admin_select
-- and member_invitations_agent_select and recreate member_invitations_internal_select as in
-- 0131 §7.1; drop index audit.audit_events_actor_idx.
-- =============================================================================

-- 1. The session of the request ------------------------------------------------------------------

create or replace function influx.current_session_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  -- request.jwt.claims is posed by apps/api, local to the transaction (03 P2): {sub, role, aal,
  -- session_id}. '' once the setting has existed on this connection: brought back to NULL.
  v_claims  text := nullif(pg_catalog.current_setting('request.jwt.claims', true), '');
  v_value   text;
begin
  -- A missing or malformed claim is NULL, never an error: every comparison then refuses (03 P4),
  -- and R answers its one refusal (42501 forbidden), no oracle.
  if v_claims is null or not pg_catalog.pg_input_is_valid(v_claims, 'jsonb') then
    return null;
  end if;
  if pg_catalog.jsonb_typeof(v_claims::jsonb) <> 'object' then
    return null;
  end if;
  v_value := v_claims::jsonb ->> 'session_id';
  if v_value is null or not pg_catalog.pg_input_is_valid(v_value, 'uuid') then
    return null;
  end if;
  return v_value::uuid;
end
$$;

comment on function influx.current_session_id() is
  'J8S-3: the session of the request, read from the claim session_id of request.jwt.claims posed by '
  'apps/api after identity.resolve_session() (withUserTransaction, 03 P2). NULL when the setting, the '
  'claim or a valid uuid is missing: every comparison then refuses. SECURITY INVOKER, no table; '
  'EXECUTE for influx_identity_definer only (R and its callers).';

revoke all on function influx.current_session_id() from public, anon, authenticated, service_role;
grant execute on function influx.current_session_id() to influx_identity_definer;

-- 2. R bound to the session of the request (J8S-3), as influx_identity_definer ---------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity, backoffice to influx_identity_definer;
set role influx_identity_definer;

create or replace function identity.assert_fresh_second_factor(p_session_id uuid)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  -- J8S-3: the session named by the caller must be the session of THIS request (the claim posed
  -- by apps/api), never another open session of the same account. Missing claim: refused.
  if p_session_id is null or p_session_id is distinct from influx.current_session_id() then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- 300 seconds: REAUTHENTICATION_FRESHNESS_SECONDS of apps/api (EC-40 point 2, 03 PD3), read on
  -- the row of 0012 (mfa_verified_at), never the member marker of 0118. A recovery code never
  -- satisfies R (EC-17 point 4).
  perform 1
     from identity.sessions s
    where s.id = p_session_id
      and s.account_id = influx.current_account_id()
      and s.surface = 'backoffice'
      and s.revoked_at is null
      and s.idle_expires_at     > pg_catalog.now()
      and s.absolute_expires_at > pg_catalog.now()
      and s.mfa_method = 'totp'
      and s.mfa_verified_at >= pg_catalog.now() - interval '300 seconds';
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
end
$$;

comment on function identity.assert_fresh_second_factor(uuid) is
  'R in the transaction of the action (03 PD3, J3S-4, J8S-3): p_session_id is the session of the '
  'REQUEST (influx.current_session_id(), claim session_id of request.jwt.claims), an open, unexpired '
  'backoffice session of the CALLER whose last proof is a TOTP code at most 300 seconds old (0012 '
  'mfa_verified_at); 42501 forbidden otherwise, a missing claim included. SECURITY INVOKER owned by '
  'influx_identity_definer, NO grant.';

-- 3. J8S-4: the admin role grants of the last days, for the admins' home ---------------------------

create or replace function backoffice.admin_role_grants(
  p_days  integer default 7
)
returns table (
  account_id             uuid,
  first_name             text,
  granted_by_account_id  uuid,
  granted_by_first_name  text,
  occurred_at            timestamptz
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

  -- Who granted: the author of the internal invitation (0131 accept_internal_invitation, written
  -- by the auth service, payload granted_by_account_id), else the actor of the line (0130
  -- grant_role: the confirming admin). Identifiers and first names only (as 0138), never an
  -- address nor a reason text.
  return query
  select g.subject_id, p.first_name, g.granted_by, b.first_name, g.occurred_at
    from (select e.subject_id, e.occurred_at, e.seq,
                 coalesce(case when pg_catalog.pg_input_is_valid(e.payload ->> 'granted_by_account_id',
                                                                 'uuid')
                               then (e.payload ->> 'granted_by_account_id')::uuid
                          end,
                          e.actor_account_id) as granted_by
            from audit.audit_events e
           where e.event_type = 'account.role_granted'
             and e.subject_type = 'account'
             and e.payload ->> 'role' = 'admin'
             and e.occurred_at >= pg_catalog.now() - pg_catalog.make_interval(days => p_days)) g
    left join identity.agent_profiles p on p.account_id = g.subject_id
    left join identity.agent_profiles b on b.account_id = g.granted_by
   order by g.occurred_at desc, g.seq desc
   limit 50;
end
$$;

comment on function backoffice.admin_role_grants(integer) is
  'J8S-4 (15 RG101; 17b §3.14.e): the account.role_granted lines granting the role admin in the last '
  'p_days days (1 to 30, 7 by default; 22023 otherwise), newest first, 50 at most: the account, its '
  'first name, who granted (payload granted_by_account_id, else the actor) and his first name, the '
  'instant. An active admin in aal2 only (42501 forbidden otherwise). SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_admin.';

revoke all on function backoffice.admin_role_grants(integer)
  from public, anon, authenticated, service_role;
grant execute on function backoffice.admin_role_grants(integer) to influx_admin;

reset role;
revoke create on schema identity, backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 4. J8S-5: an agent reads its own member invitations, an admin every one --------------------------
-- Same columns as 0131 §7.1 (never the code digest); aal2 for both roles.

drop policy if exists member_invitations_internal_select on backoffice.member_invitations;

drop policy if exists member_invitations_admin_select on backoffice.member_invitations;
create policy member_invitations_admin_select on backoffice.member_invitations
  for select to influx_admin
  using ((select influx.has_aal2()));

drop policy if exists member_invitations_agent_select on backoffice.member_invitations;
create policy member_invitations_agent_select on backoffice.member_invitations
  for select to influx_agent
  using ((select influx.has_aal2())
         and created_by_account_id = (select influx.current_account_id()));

-- 5. F4: the register read by actor ---------------------------------------------------------------

create index if not exists audit_events_actor_idx
  on audit.audit_events (actor_account_id, occurred_at desc)
  where actor_account_id is not null;
comment on index audit.audit_events_actor_idx is
  'F4: what one internal account did, newest first (per-actor reads and alerts of the backoffice), '
  'and the ON DELETE RESTRICT check of identity.accounts. System lines (no actor) left out.';

-- 6. End-state assertions --------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  -- the function inventory of 0142: owner, SECURITY DEFINER or not, empty search_path, callers
  for v_def in
    select * from (values
      ('identity.assert_fresh_second_factor(uuid)', 'influx_identity_definer', false,
       array[]::text[]),
      ('backoffice.admin_role_grants(integer)',     'influx_identity_definer', true,
       array['influx_admin']),
      ('influx.current_session_id()',               current_user::text,        false,
       array['influx_identity_definer'])
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

  -- R reads the session of the request (J8S-3)
  if position('influx.current_session_id()' in pg_catalog.pg_get_functiondef(
       'identity.assert_fresh_second_factor(uuid)'::regprocedure)) = 0 then
    raise exception 'identity.assert_fresh_second_factor() does not read the session of the request';
  end if;

  -- J8S-5: no policy lets an agent read every member invitation any more
  if exists (select 1 from pg_catalog.pg_policies
              where schemaname = 'backoffice' and tablename = 'member_invitations'
                and cmd = 'SELECT' and 'influx_agent' = any (roles)
                and policyname <> 'member_invitations_agent_select') then
    raise exception 'backoffice.member_invitations keeps another SELECT policy for influx_agent';
  end if;

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
