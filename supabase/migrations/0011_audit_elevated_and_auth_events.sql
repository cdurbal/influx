-- =============================================================================
-- 0011_audit_elevated_and_auth_events
-- -----------------------------------------------------------------------------
-- Lot 0 / J3, commit 6 (first of the ex-0108 series, numbered by EC-37). The
-- register entries of the elevated operations and of the authentication security
-- events, with the conditions of the security review of 0009 (21 §4, J2):
--
--   V1  audit.append(): the "any other session_user" branch refuses every
--       influx_% connection role that is not one of the three known ones, and
--       records the session_user in the payload of a system line (payload is in
--       the canonical form: no hash_version 2).
--   V5  the end-of-migration controls also check the empty search_path and that
--       PUBLIC, anon, authenticated and service_role cannot execute.
--   V6  audit.append_elevated() CALLS audit.append(): one derivation of the actor.
--   EC-36 (security review of the end of J2, point 4): code elevated.<operation>,
--       one per operation, subject type fixed per operation in audit.event_types,
--       subject id supplied by the caller (never gen_random_uuid()), payload
--       {operation} only; no EXECUTE on append() for influx_auth.
--   EC-44, G-1: the security events of the backoffice sign-in, written by
--       influx_auth through audit.append_auth_event() (closed list, empty payload)
--       or by the identity functions of 0013 (which own their audit lines).
--
-- The five elevated codes are the motifs of E-1 and E-2 used at J3 (03 P7,
-- revision EC-5); identity.complete_signup and support.report_delivery_issue
-- arrive at J5 with their callers. Subject types (21 §3 EC-52, settled by
-- expert-cybersecurite on 2026-09-28, C6-1): request_code -> 'login_request', the
-- random reference of the journal line of leads.transactional_sends (an address
-- may have no account); every other motif, verify_code included -> 'account', so
-- that the permanent register still answers "which elevated passages touched this
-- account?" once the journal (13 months) and the session (90 days) are purged. A
-- verification that touches no account writes no elevated line (C-7 as settled).
--
-- ROLLBACK: before any real line only. Re-create the 0009 body of audit.append()
-- through the same window; drop audit.append_elevated(text, uuid) and
-- audit.append_auth_event(text, uuid); revoke usage on schema audit from
-- influx_auth; delete the codes inserted here from audit.event_types (possible
-- only while no line references them). After the first real line: the codes stay.
-- =============================================================================

-- 1. The closed list of codes ----------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- EC-36: one code per elevated operation (03 P7 E-1, E-2)
  ('elevated.identity.request_code',             'identity', 'login_request', 'sensitive'),
  ('elevated.identity.verify_code',              'identity', 'account',       'sensitive'),
  ('elevated.identity.backoffice_sign_in',       'identity', 'account',       'sensitive'),
  ('elevated.identity.backoffice_enroll_totp',   'identity', 'account',       'sensitive'),
  ('elevated.identity.backoffice_reauthenticate','identity', 'account',       'sensitive'),
  -- EC-44, EC-17 (J3-C rule 9): recovery codes (agent.break_glass_login exists since 0006)
  ('agent.recovery_codes_generated',             'identity', 'account',       'critical'),
  ('agent.recovery_code_consumed',               'identity', 'account',       'critical'),
  -- G-1: the pinned factor, and any other verified factor listed by GoTrue
  ('agent.mfa_enrolled',                         'identity', 'account',       'critical'),
  ('agent.unexpected_mfa_factor',                'identity', 'account',       'critical'),
  -- EC-40 point 5: five failed re-authentications on one session revoke it
  ('agent.reauthentication_failed',              'identity', 'account',       'critical'),
  -- EC-47: ten failed backoffice sign-ins in an hour on a KNOWN address (no blocking)
  ('security.backoffice_login_failures',         'identity', 'account',       'critical')
on conflict (code) do nothing;

-- The writer reads the catalogue to find the subject type of a code.
grant select (code, subject_type, is_active) on audit.event_types to influx_audit_writer;

drop policy if exists event_types_writer_select on audit.event_types;
create policy event_types_writer_select on audit.event_types
  for select to influx_audit_writer
  using (true);

-- 2. The three functions, created by their owner (same window as 0006 §9) --------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
grant create on schema audit to influx_audit_writer;

set role influx_audit_writer;

-- 2.1 audit.append(), V1 ------------------------------------------------------------

create or replace function audit.append(
  p_event_type    text,
  p_subject_type  text,
  p_subject_id    uuid,
  p_payload       jsonb       default '{}'::jsonb
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_chain    constant text := 'global';
  -- the actor comes from the connection role and the transaction context, never from a parameter
  v_session  text := session_user;
  v_account  uuid := nullif(pg_catalog.current_setting('influx.account', true), '')::uuid;
  v_role     text := nullif(pg_catalog.current_setting('influx.role', true), '');
  v_actor    audit.actor_type;
  v_payload  jsonb := p_payload;
  -- security review M1: no caller chooses the date of a fact; the transaction
  -- time is the fact time, clock_timestamp() the write time
  v_occurred timestamptz := pg_catalog.now();
  v_recorded timestamptz := pg_catalog.clock_timestamp();
  v_request  text := left(nullif(pg_catalog.current_setting('influx.request_id', true), ''), 100);
  v_prev_seq  bigint;
  v_prev_hash bytea;
  v_seq       bigint;
  v_hash      bytea;
begin
  if p_event_type is null or p_subject_type is null or p_subject_id is null then
    raise exception 'event type, subject type and subject id are required'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'payload must be a JSON object' using errcode = 'invalid_parameter_value';
  end if;

  -- Security review M2: the actor type is bound to session_user.
  if v_session = 'influx_app' then
    if v_account is null or v_role is null
       or v_role not in ('advertiser', 'creator', 'agent', 'admin') then
      raise exception 'a member or internal act needs an account and one of the four business roles'
        using errcode = 'insufficient_privilege';
    end if;
    v_actor := case
                 when v_role in ('advertiser', 'creator') then 'member'
                 when v_role = 'agent'                    then 'agent'
                 else 'admin'
               end;
  elsif v_session in ('influx_auth_login', 'influx_worker_login') then
    v_actor := case when v_account is null then 'system' else 'service' end;
  elsif v_session like 'influx\_%' then
    -- V1 (a): a connection role of ours that is not in the closed list above (a future
    -- tool, a second worker, a pooler-suffixed name) is refused, never recorded as system.
    raise exception 'connection role % may not write the register', v_session
      using errcode = 'insufficient_privilege';
  else
    -- Neither the api nor the worker (the migration role, a maintenance session): no
    -- account is attributed (system <=> no account), and V1 (b): the session_user is
    -- kept in the payload, which is part of the canonical form.
    v_actor   := 'system';
    v_account := null;
    v_payload := p_payload || pg_catalog.jsonb_build_object('db_session_user', v_session);
  end if;

  -- Serialise the chain: TRANSACTION lock (session locks do not survive the
  -- transaction-mode pooler, 02 §5). Take it LAST in the business transaction
  -- (04 §7.2, rules 1 and 3). A waiting writer reads the link its predecessor
  -- has just committed; a rolled-back writer leaves no hole.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('audit.chain:' || c_chain, 0));

  select e.seq, e.row_hash
    into v_prev_seq, v_prev_hash
    from audit.audit_events e
   where e.chain_key = c_chain
   order by e.seq desc
   limit 1;
  if not found then
    raise exception 'audit chain % has no genesis line', c_chain
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  v_seq  := v_prev_seq + 1;
  v_hash := audit.payload_hash(c_chain, v_seq, v_occurred, v_recorded, p_event_type, v_actor,
                               v_account, p_subject_type, p_subject_id, v_payload, v_request);

  -- Unknown event type, or wrong subject type for it: refused by the composite key.
  insert into audit.audit_events
    (chain_key, seq, occurred_at, recorded_at, event_type, actor_type, actor_account_id,
     subject_type, subject_id, payload, request_id, payload_hash, prev_hash, row_hash)
  values
    (c_chain, v_seq, v_occurred, v_recorded, p_event_type, v_actor, v_account,
     p_subject_type, p_subject_id, v_payload, v_request,
     v_hash, v_prev_hash, pg_catalog.sha256(v_prev_hash || v_hash));

  return v_seq;
end
$$;

comment on function audit.append(text, text, uuid, jsonb) is
  'The ONLY way to write the register (03 C(37)). SECURITY DEFINER owned by influx_audit_writer '
  '(no login, no member). Called from the business functions and elevated operations, in the same '
  'transaction as the fact it records, as LATE as possible (the chain lock is held until COMMIT). '
  'The actor type is bound to session_user (M2, V1): influx_app => from influx.role, one of the four '
  'business roles, else refused; influx_auth_login / influx_worker_login => service (system without '
  'an account); any other influx_% role => refused; anything else => system, no account, and the '
  'session_user in the payload. Never call it with a network call pending in the same transaction '
  '(04 §7.2 rule 2). Returns the seq.';

-- 2.2 audit.append_elevated(), EC-36 and V6 -------------------------------------------

create or replace function audit.append_elevated(
  p_operation   text,
  p_subject_id  uuid
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_code         text;
  v_subject_type text;
begin
  -- The operation is a motif of the closed union of packages/contracts (03 P7, EC-5):
  -- domain.name, lower case. Its code must exist in the catalogue.
  if p_operation is null or p_operation !~ '^[a-z][a-z0-9_]{0,31}\.[a-z][a-z0-9_]{0,62}$' then
    raise exception 'unknown elevated operation' using errcode = 'invalid_parameter_value';
  end if;
  if p_subject_id is null then
    raise exception 'an elevated operation names its subject' using errcode = 'invalid_parameter_value';
  end if;

  v_code := 'elevated.' || p_operation;
  select t.subject_type into v_subject_type
    from audit.event_types t
   where t.code = v_code and t.is_active;
  if not found then
    raise exception 'unknown elevated operation' using errcode = 'invalid_parameter_value';
  end if;

  -- V6: one derivation of the actor, in append() only.
  return audit.append(v_code, v_subject_type, p_subject_id,
                      pg_catalog.jsonb_build_object('operation', p_operation));
end
$$;

comment on function audit.append_elevated(text, uuid) is
  'EC-36: the register line of an elevated transaction that wrote (C-7). Accepts only a code '
  'elevated.<operation> of the catalogue; its subject type comes from the catalogue, its subject id '
  'from the caller (the business object touched, never a random id); payload {operation} only. '
  'Calls audit.append(), which derives the actor from session_user (V6). SECURITY DEFINER owned by '
  'influx_audit_writer; EXECUTE for influx_auth (J3), influx_worker with its first operation (J6).';

-- 2.3 audit.append_auth_event(), EC-44 and G-1 ----------------------------------------

create or replace function audit.append_auth_event(
  p_event_type  text,
  p_subject_id  uuid
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Closed list: the security events of the backoffice sign-in that are not the
  -- effect of an identity function (those write their own lines, 0013).
  if p_event_type is null
     or p_event_type not in ('agent.break_glass_login',
                             'agent.unexpected_mfa_factor',
                             'agent.reauthentication_failed',
                             'security.backoffice_login_failures') then
    raise exception 'event type not allowed here' using errcode = 'insufficient_privilege';
  end if;
  if p_subject_id is null then
    raise exception 'the account is required' using errcode = 'invalid_parameter_value';
  end if;
  -- Empty payload by construction: no code, no address, no IP can be passed (EC-44 (1)).
  return audit.append(p_event_type, 'account', p_subject_id, '{}'::jsonb);
end
$$;

comment on function audit.append_auth_event(text, uuid) is
  'EC-44, G-1: writes one of four security events of the backoffice sign-in (break-glass sign-in, '
  'unexpected verified factor, failed re-authentications, failed sign-ins on a known address), '
  'subject = the account, payload always empty. SECURITY DEFINER owned by influx_audit_writer; '
  'EXECUTE for influx_auth only. The alerts themselves (e-mail) come with the queue at J6.';

-- Revokes and grants are made by the owner, inside the window: a function created by
-- influx_audit_writer receives the default EXECUTE for PUBLIC (the global revoke of 0001
-- covers the migration role only), and only the owner can take it back.
revoke all on function audit.append(text, text, uuid, jsonb)   from public, anon, authenticated, service_role;
revoke all on function audit.append_elevated(text, uuid)       from public, anon, authenticated, service_role;
revoke all on function audit.append_auth_event(text, uuid)     from public, anon, authenticated, service_role;
grant execute on function audit.append_elevated(text, uuid)   to influx_auth;
grant execute on function audit.append_auth_event(text, uuid) to influx_auth;
reset role;

revoke create on schema audit from influx_audit_writer;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- influx_auth reaches the two functions through the schema; no table right on audit.
grant usage on schema audit to influx_auth;

-- 3. End-state assertions (V5: search_path and publication checked too) ------------

do $$
declare
  v_bad  text;
  v_fn   text;
  c_fns  constant text[] := array[
    'audit.append(text, text, uuid, jsonb)',
    'audit.append_elevated(text, uuid)',
    'audit.append_auth_event(text, uuid)'];
begin
  foreach v_fn in array c_fns loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_audit_writer' then
      raise exception '% must belong to influx_audit_writer', v_fn;
    end if;
    if not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure) then
      raise exception '% must be SECURITY DEFINER', v_fn;
    end if;
    if (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
         is distinct from array['search_path=""'] then
      raise exception '% must fix an empty search_path', v_fn;
    end if;
    -- nobody among PUBLIC and the Data API roles
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and (a.grantee = 0
            or a.grantee in (select oid from pg_catalog.pg_roles
                              where rolname in ('anon', 'authenticated', 'service_role')));
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- append(): unchanged grants (influx_identity_definer only, besides its owner)
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_identity_definer', 'influx_audit_writer')
     and pg_catalog.has_function_privilege(r.oid, 'audit.append(text, text, uuid, jsonb)', 'EXECUTE');
  if v_bad is not null then
    raise exception 'audit.append() executable by: %', v_bad;
  end if;

  -- the two narrow functions: influx_auth only
  select string_agg(r.rolname || ' on ' || f, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['audit.append_elevated(text, uuid)', 'audit.append_auth_event(text, uuid)']) f
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_auth', 'influx_audit_writer')
     and pg_catalog.has_function_privilege(r.oid, f::regprocedure, 'EXECUTE');
  if v_bad is not null then
    raise exception 'narrow audit functions executable by: %', v_bad;
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_audit_writer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_audit_writer left with a usable member: %', v_bad;
  end if;

  if pg_catalog.has_schema_privilege('influx_audit_writer', 'audit', 'CREATE') then
    raise exception 'influx_audit_writer left with CREATE on schema audit';
  end if;
end
$$;
