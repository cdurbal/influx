-- =============================================================================
-- 0009_audit_append_actor_from_session_user
-- -----------------------------------------------------------------------------
-- Lot 0 / J3. Security review of the J2 migrations, M2 (21 §4, "Exigées avant
-- le J3"): the actor type of a register line is bound to session_user, the
-- connection role, and no longer to the influx.* settings alone. Those settings
-- are set by the application: without this binding, an elevated operation of
-- influx_auth or influx_worker that sets influx.role = 'admin' would write an
-- administrator's act into the proof register.
--
--   session_user = influx_app            actor from influx.role, which must be one
--                                        of the four business roles, with an
--                                        account; anything else is refused
--   session_user = influx_auth_login     'service' with an account, 'system'
--   or influx_worker_login               without, whatever influx.role says
--   any other session_user               'system', and no account (the migration
--                                        role, a maintenance session)
--
-- session_user is not changed by SECURITY DEFINER nor by SET ROLE: it is the
-- role the connection logged in as. Must run before any EXECUTE on
-- audit.append() is granted to influx_auth or influx_worker (M2, EC-36).
--
-- Only the body of audit.append() changes: same signature, same owner
-- (influx_audit_writer), same grants, canonical form unchanged (hash_version 1).
-- The owner replaces it, through the same short window as 0006 §9.
--
-- ROLLBACK: re-create the 0006 body of audit.append() through the same window.
-- Lines written in between keep their actor type: a rollback never rewrites them.
-- =============================================================================

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
grant create on schema audit to influx_audit_writer;

set role influx_audit_writer;

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
  else
    -- Neither the api nor the worker: no account is attributed (check constraint:
    -- system <=> no account).
    v_actor   := 'system';
    v_account := null;
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
                               v_account, p_subject_type, p_subject_id, p_payload, v_request);

  -- Unknown event type, or wrong subject type for it: refused by the composite key.
  insert into audit.audit_events
    (chain_key, seq, occurred_at, recorded_at, event_type, actor_type, actor_account_id,
     subject_type, subject_id, payload, request_id, payload_hash, prev_hash, row_hash)
  values
    (c_chain, v_seq, v_occurred, v_recorded, p_event_type, v_actor, v_account,
     p_subject_type, p_subject_id, p_payload, v_request,
     v_hash, v_prev_hash, pg_catalog.sha256(v_prev_hash || v_hash));

  return v_seq;
end
$$;

comment on function audit.append(text, text, uuid, jsonb) is
  'The ONLY way to write the register (03 C(37)). SECURITY DEFINER owned by influx_audit_writer '
  '(no login, no member, SELECT + INSERT on audit_events only). Called from the business functions '
  'and elevated operations, in the same transaction as the fact it records, as LATE as possible '
  '(the chain lock is held until COMMIT). The actor type is bound to session_user (security review '
  'M2): influx_app => from influx.role, one of the four business roles, else refused; '
  'influx_auth_login / influx_worker_login => service (system without an account); any other => '
  'system. Never call it with a network call pending in the same transaction (04 §7.2 rule 2). '
  'Returns the seq.';

reset role;

revoke create on schema audit from influx_audit_writer;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

do $$
declare
  v_bad text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'audit.append(text, text, uuid, jsonb)'::regprocedure)
       <> 'influx_audit_writer' then
    raise exception 'audit.append() must belong to influx_audit_writer';
  end if;

  if not (select prosecdef from pg_catalog.pg_proc
           where oid = 'audit.append(text, text, uuid, jsonb)'::regprocedure) then
    raise exception 'audit.append() must stay SECURITY DEFINER';
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

  -- The grants of 0006 are unchanged: EXECUTE for influx_identity_definer only.
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_identity_definer', 'influx_audit_writer')
     and pg_catalog.has_function_privilege(r.oid, 'audit.append(text, text, uuid, jsonb)', 'EXECUTE');
  if v_bad is not null then
    raise exception 'audit.append() executable by: %', v_bad;
  end if;
end
$$;
