-- =============================================================================
-- 0115_audit_j7_codes_and_family_binding
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 2 (first of the J7 series 0115 to 0120; 0102 and 0107 stay
-- reserved to J8). The register entries and closed-list values the other J7
-- migrations rely on, loaded FIRST so that every later file applies alone:
--
--   codes     EC-10 consent.granted / consent.revoked (changes after the sign-up;
--             CA47: consent.revoked has its emitters in 0116 and 0119), RG58
--             email.changed, 04 §9 retention.purged, decision 6
--             privacy.request_received; the elevated codes of the J7 start
--             decisions (architect, 2026-10-09): leads.receive_brevo_event (E-1,
--             decision 2), maintenance.run_periodic (E-4, decision 3),
--             identity.member_reauthenticate (E-2, decision 4),
--             support.report_delivery_issue (E-1, decision 6; motif declared in 0011,
--             first function in 0120).
--   enums     identity.session_revocation_reason + email_changed (decision 5: the
--             other sessions are revoked when the address changes);
--             identity.throttle_scope + delivery_report_* (decision 6: the rescue
--             channel is rate limited, never on the counters of the sign-in code).
--             Added here, used only from 0118 / by apps/api: a new enum value is
--             usable once its transaction has committed.
--   J6S-2     audit.append_elevated() binds the FAMILY of a motif to the connection
--             role that may write it (03 P7 rule 5): identity.* and support.* and
--             the single E-1 exception leads.receive_brevo_event => influx_auth_login;
--             leads.* (but that one) and maintenance.* => influx_worker_login.
--             Anything else is refused (42501). session_user is the proof: a login
--             role can SET ROLE to its own elevated role only (0001), and only the
--             elevated roles hold EXECUTE.
--
-- Subject types (EC-36: fixed per code, subject id supplied by the caller):
--   brevo_inbound_event   the raw line written (leads.brevo_inbound_events.id, 0116)
--   periodic_run          the run claimed or purged for (ops.periodic_runs.id, 0117)
--   code_delivery_report  the report written (backoffice.code_delivery_reports.id, 0120)
--   data_subject_request  the request deposited (backoffice.data_subject_requests.id, 0120)
--   account               consent.*, email.changed, member_reauthenticate
--
-- ROLLBACK (before any real line): re-create the 0011 body of audit.append_elevated()
-- through the same window; delete the nine codes below from audit.event_types (possible
-- only while no line references them). The enum values cannot be removed (PostgreSQL):
-- harmless while unused.
-- =============================================================================

-- 1. The codes -------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- EC-10, RG73: queue facts after the sign-up (also usable as register lines)
  ('consent.granted',                         'identity',    'account',              'sensitive'),
  ('consent.revoked',                         'identity',    'account',              'sensitive'),
  -- RG58, decision 5: the address of an account changed by its holder (both sides confirmed)
  ('email.changed',                           'identity',    'account',              'critical'),
  -- 04 §9: "a summary in the register, like every purge" (category and count)
  ('retention.purged',                        'maintenance', 'periodic_run',         'sensitive'),
  -- decision 6, EC-14: a data subject request deposited from the member space
  ('privacy.request_received',                'privacy',     'data_subject_request', 'sensitive'),
  -- EC-36: one code per elevated motif of the J7 decisions
  ('elevated.leads.receive_brevo_event',      'leads',       'brevo_inbound_event',  'sensitive'),
  ('elevated.maintenance.run_periodic',       'maintenance', 'periodic_run',         'sensitive'),
  ('elevated.identity.member_reauthenticate', 'identity',    'account',              'sensitive'),
  ('elevated.support.report_delivery_issue',  'support',     'code_delivery_report', 'sensitive')
on conflict (code) do nothing;

-- 2. Closed-list values used from 0118 and by apps/api ----------------------------------------

-- Decision 5: completing an address change revokes every OTHER open session of the account.
alter type identity.session_revocation_reason add value if not exists 'email_changed';

-- Decision 6: the rescue channel (05 RG65) is rate limited on its own counters, never on those
-- of the sign-in code (sharing them would let a report lock someone out of his code).
alter type identity.throttle_scope add value if not exists 'delivery_report_email';
alter type identity.throttle_scope add value if not exists 'delivery_report_ip';
alter type identity.throttle_scope add value if not exists 'delivery_report_unknown_ip';

comment on type identity.session_revocation_reason is
  'Closed list of the reasons a session is revoked. Expiry is not a revocation: it is read from '
  'idle_expires_at and absolute_expires_at. email_changed (0115, decision 5 of J7): the other '
  'sessions of an account whose address was changed by its holder.';

-- 3. J6S-2: audit.append_elevated() binds the family of a motif to its connection role --------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
grant create on schema audit to influx_audit_writer;

set role influx_audit_writer;

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
  -- role can take its own elevated role only (0001), so session_user names the caller.
  -- E-1 / E-2 (api): identity.*, support.*, and leads.receive_brevo_event, the single E-1
  -- motif of the leads family (decision 2 of J7: the Brevo webhook is received by the api).
  -- E-3 / E-4 (worker): every other leads.* motif, and maintenance.*.
  v_family := pg_catalog.split_part(p_operation, '.', 1);
  if not (
       (v_session = 'influx_auth_login'
        and (v_family in ('identity', 'support') or p_operation = 'leads.receive_brevo_event'))
    or (v_session = 'influx_worker_login'
        and (v_family = 'maintenance'
             or (v_family = 'leads' and p_operation <> 'leads.receive_brevo_event')))) then
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
  'payload {operation} only. J6S-2 (0115): the family of the motif is bound to the connection role '
  '(session_user) - identity.*, support.* and leads.receive_brevo_event for influx_auth_login; '
  'maintenance.* and the other leads.* for influx_worker_login; 42501 otherwise. Calls '
  'audit.append(), which derives the actor from session_user (V6). SECURITY DEFINER owned by '
  'influx_audit_writer; EXECUTE for influx_auth and influx_worker.';

reset role;

revoke create on schema audit from influx_audit_writer;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 4. End-state assertions ---------------------------------------------------------------------

do $$
declare
  c_fn  constant text := 'audit.append_elevated(text, uuid)';
  v_bad text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = c_fn::regprocedure) <> 'influx_audit_writer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_audit_writer, empty search_path', c_fn;
  end if;

  -- unchanged publication: influx_auth and influx_worker only, never PUBLIC
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_auth', 'influx_worker'));
  if v_bad is not null then
    raise exception '% executable by: %', c_fn, v_bad;
  end if;

  if (select count(*) from audit.event_types
       where code in ('consent.granted', 'consent.revoked', 'email.changed', 'retention.purged',
                      'privacy.request_received', 'elevated.leads.receive_brevo_event',
                      'elevated.maintenance.run_periodic', 'elevated.identity.member_reauthenticate',
                      'elevated.support.report_delivery_issue')) <> 9 then
    raise exception 'the nine J7 codes are not all in audit.event_types';
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
