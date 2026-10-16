-- =============================================================================
-- 0136_privacy_roles_and_codes
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 8 (first of two: 0136 then 0137_privacy_minimal_execution).
-- The minimal execution of the "mes données" requests (E-5, 21 §J8 point 6,
-- production gate; 03 P7; 15 RG75 to RG85; 04 §9.2; runbook demandes-rgpd §4 to §6).
-- This file holds what 0137 relies on and what must be COMMITTED before 0137 uses
-- it (a new enum value is usable once its transaction has committed, as 0115):
--
--   roles     03 P7 "Créés plus tard, déjà nommés": influx_privacy (NOLOGIN, E-5)
--             and influx_privacy_login (LOGIN NOINHERIT, member of influx_privacy
--             ONLY, WITH INHERIT FALSE, SET TRUE; PRIVACY_DATABASE_URL, service
--             `worker`). NEVER granted to or from influx_worker_login nor
--             influx_worker (asserted below, tested by T4.3). And
--             influx_privacy_definer (NOLOGIN NOINHERIT, member of nothing, no
--             member): the owner of the E-5 SECURITY DEFINER functions of 0137,
--             rights column by column, same model as influx_leads_definer (0111).
--             influx_privacy keeps NO table right: EXECUTE on its functions only.
--   schema    privacy, owned by the migration role, the default privileges of 0001.
--   codes     account.anonymized, account.deleted (queue fact), privacy.execution_
--             approved, privacy.export_published, privacy.export_ready (queue fact
--             of the e-mail), privacy.export_downloaded, privacy.request_completed,
--             elevated.privacy.execute_request (EC-36).
--   enums     ops.periodic_task + data_export_purge (E-4 purge of the exports);
--             identity.email_change_cancel_reason + account_deleted (EC-J8-41).
--             identity.session_revocation_reason already holds account_deleted
--             (0004): nothing to add.
--   J6S-2     audit.append_elevated() binds the family privacy.* to the sessions of
--             influx_privacy_login ONLY (the other bindings of 0115 are unchanged);
--             EXECUTE for influx_privacy (with influx_auth and influx_worker).
--   V1        audit.append() (0011) refuses any connection role of ours outside its
--             closed list: influx_privacy_login joins influx_auth_login and
--             influx_worker_login (actor service with influx.account, system without,
--             EC-J8-47). Nothing else of the function changes (canonical form, hash
--             version, owner, grants).
--
-- Bounds of influx_privacy_login (03 P7 rule 6, EC-J8-35): connection limit 5 (one
-- worker process holds a pool of 2, PRIVACY_POOL_MAX of apps/api, plus a deploy
-- overlap), statement_timeout 30 s and idle_in_transaction_session_timeout 30 s (the
-- export of one account is a handful of indexed reads; the GoTrue call is made
-- AFTER the commit, never inside a transaction). Values for `architecte` to confirm,
-- like those of 0001 and 0016.
--
-- Passwords: none here (rule 5 of 0001); set per environment by
-- packages/test-kit/scripts/staging-role-passwords.ts (PRIVACY_DATABASE_URL, worker).
--
-- ROLLBACK (before any real request executed): re-create the 0115 body of
-- audit.append_elevated() and the 0011 body of audit.append() through the same window,
-- and revoke the EXECUTE of the former from influx_privacy; delete the eight codes below from audit.event_types (possible only
-- while no line references them); drop schema privacy (after 0137 is rolled back);
-- then, in every database of the cluster, drop owned by influx_privacy_login,
-- influx_privacy, influx_privacy_definer; drop role influx_privacy_login; drop role
-- influx_privacy; drop role influx_privacy_definer. The two enum values cannot be
-- removed (PostgreSQL): harmless while unused.
-- =============================================================================

-- 1. Roles (rules 1 and 2 of 0001: idempotent creation, attributes re-imposed) --------------

set createrole_self_grant = '';

do $$
declare
  r record;
begin
  for r in
    select * from (values ('influx_privacy_login', true),
                          ('influx_privacy', false),
                          ('influx_privacy_definer', false)) as t(name, can_login)
  loop
    if not exists (select 1 from pg_catalog.pg_roles where rolname = r.name) then
      execute format('create role %I with %s noinherit',
                     r.name, case when r.can_login then 'login' else 'nologin' end);
    end if;
    execute format('alter role %I with %s noinherit',
                   r.name, case when r.can_login then 'login' else 'nologin' end);
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolsuper) then
      raise exception 'role % is SUPERUSER: refuse to continue (03 P7)', r.name;
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolbypassrls) then
      execute format('alter role %I with nobypassrls', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolreplication) then
      execute format('alter role %I with noreplication', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolcreatedb) then
      execute format('alter role %I with nocreatedb', r.name);
    end if;
    if exists (select 1 from pg_catalog.pg_roles where rolname = r.name and rolcreaterole) then
      execute format('alter role %I with nocreaterole', r.name);
    end if;
  end loop;
end
$$;

-- Bounds (03 P7 rule 6, EC-J8-35): see the header.
alter role influx_privacy_login with connection limit 5;
alter role influx_privacy_login set statement_timeout = '30s';
alter role influx_privacy_login set idle_in_transaction_session_timeout = '30s';

-- The only membership: the login role takes influx_privacy by SET LOCAL ROLE, nothing else.
grant influx_privacy to influx_privacy_login with inherit false, set true;

reset createrole_self_grant;

-- 2. Schema (same default privileges as the domain schemas of 0001) -----------------------------

create schema if not exists privacy;
comment on schema privacy is
  'INFLUX: execution of the data subject requests (E-5, 03 P7; 15 RG75 to RG85; 04 §9.2): the '
  'approved executions and the published exports. Written by the SECURITY DEFINER functions of '
  'influx_privacy_definer (worker, PRIVACY_DATABASE_URL) and influx_identity_definer (approval, '
  'member download) only.';

revoke all on schema privacy from public, anon, authenticated, service_role;
revoke all on all tables    in schema privacy from public, anon, authenticated, service_role;
revoke all on all sequences in schema privacy from public, anon, authenticated, service_role;
revoke all on all functions in schema privacy from public, anon, authenticated, service_role;
do $$
begin
  execute format('alter default privileges for role %I in schema privacy
                    revoke all on tables    from public, anon, authenticated, service_role',
                 current_user);
  execute format('alter default privileges for role %I in schema privacy
                    revoke all on sequences from public, anon, authenticated, service_role',
                 current_user);
  execute format('alter default privileges for role %I in schema privacy
                    revoke all on functions from public, anon, authenticated, service_role',
                 current_user);
end
$$;

-- 3. The codes -----------------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 04 §9.2 point 4: the anonymisation of an account, in the register
  ('account.anonymized',               'identity', 'account',              'critical'),
  -- 04 §9.2 point 4, 15 RG79: the queue fact (P0) towards Brevo and Apollo
  ('account.deleted',                  'identity', 'account',              'critical'),
  -- 15 RG75 step 6, RG76: an admin approved the execution (2V + R)
  ('privacy.execution_approved',       'privacy',  'data_subject_request', 'critical'),
  -- runbook §4: the export published (digest, size, categories; never the content)
  ('privacy.export_published',         'privacy',  'data_subject_request', 'sensitive'),
  -- runbook §4: the queue fact of the e-mail "export available" (P1, no link)
  ('privacy.export_ready',             'privacy',  'data_subject_request', 'info'),
  -- runbook §4: each download (export, number, session)
  ('privacy.export_downloaded',        'privacy',  'data_subject_request', 'sensitive'),
  -- 15 RG75 step 7, RG77: the closure with its typed outcome
  ('privacy.request_completed',        'privacy',  'data_subject_request', 'critical'),
  -- EC-36: the elevated transaction of E-5, on the request
  ('elevated.privacy.execute_request', 'privacy',  'data_subject_request', 'sensitive')
on conflict (code) do nothing;

-- 4. Closed-list values used by 0137 (committed first) ---------------------------------------------

-- E-4: the HOURLY purge of the exports (runbook §4: content erased at the first deadline, 7 days or
-- 3 downloads), claimed per UTC hour like auth_orphan_purge (period key and claim: 0137, EC-J8-57).
alter type ops.periodic_task add value if not exists 'data_export_purge';

-- EC-J8-41: an address change still open when its account is erased is cancelled for that reason
-- (its two digests cleared), never left open nor relabelled as the holder's own cancellation.
alter type identity.email_change_cancel_reason add value if not exists 'account_deleted';

comment on type ops.periodic_task is
  'Closed list of the E-4 tasks (decision 3 of J7): brevo_reconciliation (daily, after 03:00 UTC, '
  '05 RG91, 16 RG113), auth_orphan_purge (hourly, 04 §9), brevo_inbound_purge (daily, decision 2), '
  'data_export_purge (hourly, 0136 and 0137: the exports past their 7 days or 3 downloads). A new '
  'task is a new value, added with its first caller.';

-- 5. J6S-2: the family privacy.* belongs to influx_privacy_login ------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
grant create on schema audit to influx_audit_writer;

set role influx_audit_writer;

-- V1 (a) of 0011 refuses every connection role of ours outside its closed list: influx_privacy_login
-- joins the elevated pair (auth, worker) - service with an account, system without (EC-J8-47).
-- Same signature, owner, grants and canonical form (hash_version 1); only that list changes.
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
  elsif v_session in ('influx_auth_login', 'influx_worker_login', 'influx_privacy_login') then
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
  'business roles, else refused; influx_auth_login / influx_worker_login / influx_privacy_login '
  '(0136) => service (system without an account); any other influx_% role => refused; anything '
  'else => system, no account, and the session_user in the payload. Never call it with a network '
  'call pending in the same transaction (04 §7.2 rule 2). Returns the seq.';

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
  v_family       text;
  v_session      text := session_user;
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

  -- J6S-2 (03 P7 rule 5): the family of the motif belongs to ONE connection role. A login
  -- role can take its own elevated role only (0001, 0016, 0136), so session_user names the
  -- caller.
  -- E-1 / E-2 (api): identity.*, support.*, and leads.receive_brevo_event, the single E-1
  -- motif of the leads family (decision 2 of J7: the Brevo webhook is received by the api).
  -- E-3 / E-4 (worker): every other leads.* motif, and maintenance.*.
  -- E-5 (worker, its own pool): privacy.* (0136), and nothing else.
  v_family := pg_catalog.split_part(p_operation, '.', 1);
  if not (
       (v_session = 'influx_auth_login'
        and (v_family in ('identity', 'support') or p_operation = 'leads.receive_brevo_event'))
    or (v_session = 'influx_worker_login'
        and (v_family = 'maintenance'
             or (v_family = 'leads' and p_operation <> 'leads.receive_brevo_event')))
    or (v_session = 'influx_privacy_login' and v_family = 'privacy')) then
    raise exception 'elevated operation not allowed to this connection role'
      using errcode = 'insufficient_privilege';
  end if;

  -- V6: one derivation of the actor, in append() only.
  return audit.append(v_code, v_subject_type, p_subject_id,
                      pg_catalog.jsonb_build_object('operation', p_operation));
end
$$;

comment on function audit.append_elevated(text, uuid) is
  'EC-36: the register line of an elevated transaction that wrote (C-7). Accepts only a code '
  'elevated.<operation> of the catalogue (22023 otherwise); its subject type comes from the '
  'catalogue, its subject id from the caller (the business object touched, never a random id); '
  'payload {operation} only. J6S-2 (0115, 0136): the family of the motif is bound to the connection '
  'role (session_user) - identity.*, support.* and leads.receive_brevo_event for influx_auth_login; '
  'maintenance.* and the other leads.* for influx_worker_login; privacy.* for influx_privacy_login; '
  '42501 otherwise. Calls audit.append(), which derives the actor from session_user (V6). SECURITY '
  'DEFINER owned by influx_audit_writer; EXECUTE for influx_auth, influx_worker and influx_privacy.';

grant execute on function audit.append_elevated(text, uuid) to influx_privacy;

reset role;

revoke create on schema audit from influx_audit_writer;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- E-5 writes its register line through audit.append_elevated() only (EC-52 (3)).
grant usage on schema audit to influx_privacy;

-- 6. End-state assertions -------------------------------------------------------------------------

do $$
declare
  c_fn  constant text := 'audit.append_elevated(text, uuid)';
  v_bad text;
begin
  -- the three roles: attributes of 03 P7
  select string_agg(rolname, ', ') into v_bad
    from pg_catalog.pg_roles
   where rolname in ('influx_privacy', 'influx_privacy_login', 'influx_privacy_definer')
     and (rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication or rolinherit
          or rolcanlogin <> (rolname = 'influx_privacy_login'));
  if v_bad is not null then
    raise exception 'forbidden attribute on role(s): %', v_bad;
  end if;
  if (select count(*) from pg_catalog.pg_roles
       where rolname in ('influx_privacy', 'influx_privacy_login', 'influx_privacy_definer')) <> 3 then
    raise exception 'the three privacy roles do not all exist';
  end if;

  -- memberships held: influx_privacy_login -> influx_privacy only, INHERIT FALSE, SET TRUE, no ADMIN;
  -- influx_privacy and influx_privacy_definer are members of nothing
  select string_agg(format('%s -> %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where mem.rolname in ('influx_privacy', 'influx_privacy_login', 'influx_privacy_definer')
     and not (mem.rolname = 'influx_privacy_login' and grp.rolname = 'influx_privacy'
              and not m.inherit_option and m.set_option and not m.admin_option);
  if v_bad is not null then
    raise exception 'unexpected membership(s): %', v_bad;
  end if;

  -- members of the three roles: influx_privacy_login in influx_privacy, and the ADMIN-only grant to
  -- the migration role (C-9); never the worker's roles (03 P7: "jamais ajouté à influx_worker_login")
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_privacy', 'influx_privacy_login', 'influx_privacy_definer')
     and not (mem.rolname = 'influx_privacy_login' and grp.rolname = 'influx_privacy')
     and not (mem.rolname = current_user and not m.inherit_option and not m.set_option);
  if v_bad is not null then
    raise exception 'unexpected member(s) of the privacy roles: %', v_bad;
  end if;
  if exists (select 1
               from pg_catalog.pg_auth_members m
               join pg_catalog.pg_roles mem on mem.oid = m.member
               join pg_catalog.pg_roles grp on grp.oid = m.roleid
              where (mem.rolname in ('influx_worker_login', 'influx_worker')
                     and grp.rolname like 'influx\_privacy%')
                 or (grp.rolname in ('influx_worker_login', 'influx_worker')
                     and mem.rolname like 'influx\_privacy%')) then
    raise exception 'a privacy role is linked to the worker roles (03 P7)';
  end if;

  -- the append_elevated() binding: owner, SECURITY DEFINER, empty search_path, three callers
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = c_fn::regprocedure) <> 'influx_audit_writer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_audit_writer, empty search_path', c_fn;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0
          or a.grantee::regrole::text not in ('influx_auth', 'influx_worker', 'influx_privacy'));
  if v_bad is not null then
    raise exception '% executable by: %', c_fn, v_bad;
  end if;

  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'audit.append(text, text, uuid, jsonb)'::regprocedure) <> 'influx_audit_writer'
     or not (select prosecdef from pg_catalog.pg_proc
              where oid = 'audit.append(text, text, uuid, jsonb)'::regprocedure) then
    raise exception 'audit.append() must stay SECURITY DEFINER, owned by influx_audit_writer';
  end if;

  if (select count(*) from audit.event_types
       where code in ('account.anonymized', 'account.deleted', 'privacy.execution_approved',
                      'privacy.export_published', 'privacy.export_ready',
                      'privacy.export_downloaded', 'privacy.request_completed',
                      'elevated.privacy.execute_request')) <> 8 then
    raise exception 'the eight codes of 0136 are not all in audit.event_types';
  end if;

  -- the schema: nobody of ours holds anything on it yet (0137 grants), PUBLIC and the Data API roles
  -- never
  if pg_catalog.has_schema_privilege('public', 'privacy', 'USAGE')
     or exists (select 1 from pg_catalog.pg_roles r
                 where r.rolname in ('anon', 'authenticated', 'service_role')
                   and (pg_catalog.has_schema_privilege(r.oid, 'privacy', 'USAGE')
                        or pg_catalog.has_schema_privilege(r.oid, 'privacy', 'CREATE'))) then
    raise exception 'the schema privacy is reachable by PUBLIC or a Data API role';
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
