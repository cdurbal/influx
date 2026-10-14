-- =============================================================================
-- 0123_identity_email_change_sends
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 7. What the routes of decisions 4 and 5 of the J7 start
-- need beyond 0118 (05 RG57, RG58; 03 A-10, A-11; 16 §H):
--
--   the motif   elevated.identity.member_email_change (E-1, influx_auth): the
--         journal lines of the two codes of an address change and their outcomes,
--         written by apps/api around its synchronous sends (decision 5). One motif
--         per point of use (EC-5): neither the sign-in code's nor the
--         re-authentication's. Subject: the account (the request id rides on the
--         journal's Idempotency-Key, not in the register).
--   the journal  auth.email_change_confirm_old / _new are P1 (16 §H) although sent
--         synchronously by apps/api (decision 5, D43): influx_auth may write, read
--         back and close a P1 line of these two codes only, never through the queue;
--         the old side with its account, the new side with its address only (the
--         recipient is not the account's address yet, 0015 recipient_xor).
--   identity.refuse_email_change_address()  member: closes his open request with
--         both sides confirmed as address_unavailable, when GoTrue refuses the new
--         address as taken (email_exists): the requester gets the same answer as a
--         success (decision 5), nothing of the account changes.
--
-- ROLLBACK (before any real request): drop function
-- identity.refuse_email_change_address(uuid); re-create the 0114 policy
-- transactional_sends_auth_insert and the 0015 policies transactional_sends_auth_select
-- and transactional_sends_auth_update; delete the code
-- elevated.identity.member_email_change from audit.event_types (possible only while
-- no line references it).
-- =============================================================================

-- 1. The motif of the code sends (EC-36: one code per elevated motif) -----------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  ('elevated.identity.member_email_change', 'identity', 'account', 'sensitive')
on conflict (code) do nothing;

-- 2. The journal of the two codes (16 §H: P1; decision 5: synchronous, never queued) -----------

drop policy if exists transactional_sends_auth_insert on leads.transactional_sends;
create policy transactional_sends_auth_insert on leads.transactional_sends
  for insert to influx_auth
  with check (outbox_event_id is null
              and ((priority = 'p0'
                    and (email_code like 'auth.%'
                         or (email_code = 'internal.critical_alert' and account_id is not null)))
                   or (priority = 'p1'
                       and ((email_code = 'auth.email_change_confirm_old' and account_id is not null)
                            or (email_code = 'auth.email_change_confirm_new'
                                and recipient_email is not null)))));

comment on policy transactional_sends_auth_insert on leads.transactional_sends is
  'E-1 and E-2 (influx_auth), never a queue event (D43). P0: auth.* (the sign-in code, 0015) and '
  'internal.critical_alert (EC-44, 0114), always with its account. P1 (0123, decision 5 of J7): the '
  'two codes of an address change, sent synchronously: the old side with its account, the new side '
  'with its address (not the account''s yet).';

drop policy if exists transactional_sends_auth_select on leads.transactional_sends;
create policy transactional_sends_auth_select on leads.transactional_sends
  for select to influx_auth
  using (priority = 'p0'
         or (priority = 'p1'
             and email_code in ('auth.email_change_confirm_old', 'auth.email_change_confirm_new')));

drop policy if exists transactional_sends_auth_update on leads.transactional_sends;
create policy transactional_sends_auth_update on leads.transactional_sends
  for update to influx_auth
  using ((priority = 'p0'
          or (priority = 'p1'
              and email_code in ('auth.email_change_confirm_old', 'auth.email_change_confirm_new')))
         and status = 'queued')
  with check ((priority = 'p0'
               or (priority = 'p1'
                   and email_code in ('auth.email_change_confirm_old', 'auth.email_change_confirm_new')))
              and status in ('queued', 'sent', 'failed'));

-- 3. identity.refuse_email_change_address() ---------------------------------------------------

create or replace function identity.refuse_email_change_address(p_request_id uuid)
returns boolean
language plpgsql
volatile
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
  -- both codes typed: the only state in which apps/api asked GoTrue for the new address
  update identity.email_change_requests r
     set cancelled_at = pg_catalog.now(), cancel_reason = 'address_unavailable',
         old_code_hash = null, new_code_hash = null
   where r.id = p_request_id
     and r.account_id = v_account
     and r.completed_at is null
     and r.cancelled_at is null
     and r.old_confirmed_at is not null
     and r.new_confirmed_at is not null;
  return found;
end
$$;

comment on function identity.refuse_email_change_address(uuid) is
  'Decision 5 of J7: GoTrue refused the new address as taken (email_exists): the caller''s open '
  'request with both sides confirmed closes as address_unavailable (digests cleared); the account '
  'is untouched and apps/api answers as for a success. Returns false for an unknown, closed, '
  'foreign or not fully confirmed request (nothing written). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and influx_creator.';

revoke all on function identity.refuse_email_change_address(uuid)
  from public, anon, authenticated, service_role;
grant execute on function identity.refuse_email_change_address(uuid)
   to influx_advertiser, influx_creator;

-- 4. Hand the function to influx_identity_definer (03 P7 rule 5, window of 0004 §9) ----------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.refuse_email_change_address(uuid) owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5. End-state assertions ------------------------------------------------------------------------

do $$
declare
  v_fn   text := 'identity.refuse_email_change_address(uuid)';
  v_bad  text;
begin
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
     and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_advertiser', 'influx_creator'));
  if v_bad is not null then
    raise exception '% executable by: %', v_fn, v_bad;
  end if;

  if not exists (select 1 from audit.event_types
                  where code = 'elevated.identity.member_email_change'
                    and domain = 'identity' and subject_type = 'account') then
    raise exception 'elevated.identity.member_email_change is missing (EC-36)';
  end if;

  -- 0015 still holds: influx_auth alone writes the journal of apps/api, and never deletes it
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_auth', 'influx_leads_definer')
     and (pg_catalog.has_any_column_privilege(r.oid, 'leads.transactional_sends', 'INSERT')
          or pg_catalog.has_any_column_privilege(r.oid, 'leads.transactional_sends', 'UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'leads.transactional_sends', 'DELETE'));
  if v_bad is not null then
    raise exception 'unexpected writer(s) of leads.transactional_sends: %', v_bad;
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
