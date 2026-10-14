-- =============================================================================
-- 0124_identity_email_change_not_sent
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 7 follow-up (architecte and expert-cybersecurite, 2026-10-14):
--
--   point 2   identity.email_change_cancel_reason + not_sent, and
--             identity.close_unsent_email_change() (member): a request whose two codes
--             did not both leave closes with its own reason, never as if the holder
--             had cancelled it (the support and the backoffice read the reason);
--             identity.cancel_email_change() stays the holder's own DELETE.
--   A1        identity.confirm_email_change() recreated: the code of a side ALREADY
--             confirmed is checked too (and a wrong one counted), so that a retry of
--             the completion after an outage needs the code again: any session of the
--             account could otherwise finish the change and keep itself while the
--             others are revoked.
--   point 5   the address taken is now told to the requester (address_unavailable),
--             once both codes are typed: comments of complete_email_change() and
--             refuse_email_change_address() rewritten.
--
-- The new value is used only inside the plpgsql body, resolved at execution: never
-- in this file's transaction (a new enum value is usable once committed).
--
-- ROLLBACK (before any real request): drop function
-- identity.close_unsent_email_change(uuid); re-create the 0118 body and comment of
-- identity.confirm_email_change() and the comments of 0118 and 0123. The enum value
-- cannot be removed (PostgreSQL): harmless while unused.
-- =============================================================================

-- 1. The reason -------------------------------------------------------------------------------

alter type identity.email_change_cancel_reason add value if not exists 'not_sent';

comment on type identity.email_change_cancel_reason is
  'Why an address change request closed without effect: cancelled_by_holder, superseded (a new '
  'request, or the address changed meanwhile), expired (24 hours), too_many_attempts (5 on one '
  'side), address_unavailable (the new address is held by another account or GoTrue user, known '
  'only once its code was typed, decision 5), not_sent (0124: a code of the request did not leave).';

-- 2. identity.close_unsent_email_change() ------------------------------------------------------

create or replace function identity.close_unsent_email_change(p_request_id uuid)
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
  -- an open request not yet fully confirmed: a code that did not leave cannot have been typed
  update identity.email_change_requests r
     set cancelled_at = pg_catalog.now(), cancel_reason = 'not_sent',
         old_code_hash = null, new_code_hash = null
   where r.id = p_request_id
     and r.account_id = v_account
     and r.completed_at is null
     and r.cancelled_at is null
     and (r.old_confirmed_at is null or r.new_confirmed_at is null);
  return found;
end
$$;

comment on function identity.close_unsent_email_change(uuid) is
  'Decision 5 of J7, 0124: a code of POST /v1/me/email-change did not leave: the caller''s open '
  'request, not fully confirmed, closes as not_sent (digests cleared). Returns false for an '
  'unknown, closed, foreign or fully confirmed request (nothing written). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and influx_creator.';

revoke all on function identity.close_unsent_email_change(uuid)
  from public, anon, authenticated, service_role;
grant execute on function identity.close_unsent_email_change(uuid)
   to influx_advertiser, influx_creator;

-- 3. Hand the function to influx_identity_definer, and replace confirm_email_change() as its owner
--    (03 P7 rule 5, window of 0004 §9) ------------------------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.close_unsent_email_change(uuid) owner to influx_identity_definer;

-- A1: same signature, owner and grants as 0118; the code is checked on a confirmed side too.
set role influx_identity_definer;
create or replace function identity.confirm_email_change(
  p_request_id  uuid,
  p_side        identity.email_change_side,
  p_code_hash   bytea
)
returns table (
  outcome       text,
  ready         boolean,
  auth_user_id  uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_req      record;
  v_already  boolean;
  v_ready    boolean;
  v_user     uuid;
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator')
     or not exists (select 1 from identity.accounts a where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_side is null or p_code_hash is null or pg_catalog.octet_length(p_code_hash) <> 32 then
    raise exception 'a side and a 32-byte code digest are required'
      using errcode = 'invalid_parameter_value';
  end if;

  select r.id, r.expires_at, r.old_code_hash, r.new_code_hash, r.old_attempts, r.new_attempts,
         r.old_confirmed_at, r.new_confirmed_at
    into v_req
    from identity.email_change_requests r
   where r.id = p_request_id
     and r.account_id = v_account
     and r.completed_at is null
     and r.cancelled_at is null
     for update;
  if not found then
    return query select 'not_found'::text, false, null::uuid;
    return;
  end if;
  if v_req.expires_at <= pg_catalog.now() then
    update identity.email_change_requests
       set cancelled_at = pg_catalog.now(), cancel_reason = 'expired',
           old_code_hash = null, new_code_hash = null
     where id = v_req.id;
    return query select 'expired'::text, false, null::uuid;
    return;
  end if;

  -- A1: the code of the side, confirmed or not: the digests live until the request closes.
  if (case p_side when 'old' then p_code_hash = v_req.old_code_hash
                  else p_code_hash = v_req.new_code_hash end) is not true then
    -- 5 attempts per side: the fifth wrong code closes the request
    if (case p_side when 'old' then v_req.old_attempts else v_req.new_attempts end) + 1 >= 5 then
      update identity.email_change_requests
         set old_attempts = old_attempts + case when p_side = 'old' then 1 else 0 end,
             new_attempts = new_attempts + case when p_side = 'new' then 1 else 0 end,
             cancelled_at = pg_catalog.now(), cancel_reason = 'too_many_attempts',
             old_code_hash = null, new_code_hash = null
       where id = v_req.id;
      return query select 'attempts_exhausted'::text, false, null::uuid;
      return;
    end if;
    update identity.email_change_requests
       set old_attempts = old_attempts + case when p_side = 'old' then 1 else 0 end,
           new_attempts = new_attempts + case when p_side = 'new' then 1 else 0 end
     where id = v_req.id;
    return query select 'invalid_code'::text, false, null::uuid;
    return;
  end if;

  v_already := (p_side = 'old' and v_req.old_confirmed_at is not null)
               or (p_side = 'new' and v_req.new_confirmed_at is not null);
  if not v_already then
    update identity.email_change_requests
       set old_confirmed_at = case when p_side = 'old' then pg_catalog.now() else old_confirmed_at end,
           new_confirmed_at = case when p_side = 'new' then pg_catalog.now() else new_confirmed_at end
     where id = v_req.id;
  end if;
  v_ready := (p_side = 'old' or v_req.old_confirmed_at is not null)
             and (p_side = 'new' or v_req.new_confirmed_at is not null);

  if v_ready then
    select a.auth_user_id into v_user from identity.accounts a where a.id = v_account;
  end if;
  return query
  select case when v_already then 'already_confirmed' else 'confirmed' end, v_ready, v_user;
end
$$;

-- the comments too, as the owner
comment on function identity.confirm_email_change(uuid, identity.email_change_side, bytea) is
  'Decision 5 of J7 (A1 of 0124): one code of one side of the caller''s OPEN request, checked even '
  'when the side is already confirmed. Returns (outcome, ready, auth_user_id): confirmed | '
  'already_confirmed (the right code again; ready = both sides confirmed, then the GoTrue user id '
  'to update with admin.updateUserById) | invalid_code (attempt counted, on a confirmed side too) | '
  'attempts_exhausted (fifth wrong code of the side: request closed, too_many_attempts) | expired '
  '(closed) | not_found (unknown, closed or another account''s). Never raises on a wrong code: the '
  'counter must be committed. 22023 for a malformed digest, 42501 outside an active member account. '
  'SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for '
  'influx_advertiser and influx_creator.';

comment on function identity.complete_email_change(uuid, uuid) is
  'Decision 5 of J7 (05 RG58): called by apps/api AFTER admin.updateUserById (email_confirm) '
  'succeeded, on the caller''s open request with both sides confirmed. In one transaction: the '
  'address, email_verified_at = now(), email_status reset to unknown; the request completed (digests '
  'cleared); every other open session revoked (email_changed), p_session_id kept; email.changed to '
  'brevo_contact and apollo_contact (priority 100) and two auth.email_changed_notice (queue order 0, '
  'class P1 of 16 §H; previous and current), payload = ids (request id included); the register line '
  'email.changed {request_id, sessions_revoked}. Returns completed | not_found | not_ready | expired '
  '| superseded (the account address changed meanwhile) | address_unavailable (another account '
  'holds it; told to the requester as such since 0124): the last four close nothing but the '
  'request, and apps/api then sets GoTrue back to the address in force. 42501 outside an active '
  'member account or its open session. SECURITY DEFINER owned by influx_identity_definer, empty '
  'search_path; EXECUTE for influx_advertiser and influx_creator.';

comment on function identity.refuse_email_change_address(uuid) is
  'Decision 5 of J7 (0123, 0124): GoTrue refused the new address as taken (email_exists): the '
  'caller''s open request with both sides confirmed closes as address_unavailable (digests '
  'cleared); the account is untouched and apps/api answers address_unavailable, the same answer '
  'whoever holds the address. Returns false for an unknown, closed, foreign or not fully confirmed '
  'request (nothing written). SECURITY DEFINER owned by influx_identity_definer, empty search_path; '
  'EXECUTE for influx_advertiser and influx_creator.';
reset role;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 4. End-state assertions ------------------------------------------------------------------------

do $$
declare
  v_fn   text;
  v_bad  text;
begin
  foreach v_fn in array array['identity.close_unsent_email_change(uuid)',
                              'identity.confirm_email_change(uuid, identity.email_change_side, bytea)']
  loop
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
  end loop;

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
