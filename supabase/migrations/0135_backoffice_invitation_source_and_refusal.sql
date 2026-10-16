-- =============================================================================
-- 0135_backoffice_invitation_source_and_refusal
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 7 (the invitation routes of apps/api; the objects are 0131's).
--
--   leads.read_brevo_subject()        recreated: also `via_invitation`, true when the
--         account was created through a member invitation (identity.accounts.
--         signup_invitation_id, 0131): the Brevo attribute SIGNUP_SOURCE becomes
--         `invitation` instead of `direct` (05 RG120, RG122; 16 §M4, EC-11). Never the
--         invitation id, its author nor its address.
--   backoffice.record_refused_action() recreated: the closed list also holds
--         identity.internal_invitation (an agent's attempt on the internal invitation
--         routes, 05 CA63, 15 RG99, RG110).
--
-- ROLLBACK (before any real line): recreate leads.read_brevo_subject() as in 0128 and
-- backoffice.record_refused_action() as in 0134; revoke select (signup_invitation_id) on
-- identity.accounts from influx_leads_definer.
-- =============================================================================

-- 1. leads.read_brevo_subject() ------------------------------------------------------------------------
-- identity.accounts: its policy accounts_leads_definer_select exists since 0111; only the column is new.

grant select (signup_invitation_id) on identity.accounts to influx_leads_definer;

drop function if exists leads.read_brevo_subject(bigint, text);

create function leads.read_brevo_subject(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  email                text,
  signed_up_at         timestamptz,
  company              text,
  utm_source           text,
  utm_medium           text,
  utm_campaign         text,
  referrer_domain      text,
  heard_from           text,
  via_invitation       boolean,
  consent_at           timestamptz,
  consent_source       text,
  welcome_sent         boolean,
  previous_email       text,
  external_contact_id  text,
  suppressed           boolean,
  signed_in_at         timestamptz,
  browser              text,
  time_zone            text,
  request_type         text,
  request_received_at  timestamptz,
  request_due_at       timestamptz,
  request_closed       boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line          record;
  v_account       uuid;
  v_request       uuid;
  v_session       uuid;
  v_data_request  uuid;
  c_uuid          constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker: the address is read for the call about to be
  -- made, never for a line of another instance or one taken back.
  select o.destination, o.event_type, o.subject_key, o.payload
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_line.destination not in ('brevo_contact', 'brevo_transactional') then
    raise exception 'a Brevo line only: Apollo reads what it needs by its own function'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The account comes from the line, never from the caller; another kind of subject, or an
  -- unknown account, returns no row.
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account' then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;

  -- RG58: the request of an email.changed line, by the id of its payload (never an address).
  if v_line.event_type = 'email.changed' and (v_line.payload ->> 'request_id') ~ c_uuid then
    v_request := (v_line.payload ->> 'request_id')::uuid;
  end if;
  -- RG142: the session of an auth.new_device line, by the id of its payload.
  if v_line.event_type = 'auth.new_device' and (v_line.payload ->> 'session_id') ~ c_uuid then
    v_session := (v_line.payload ->> 'session_id')::uuid;
  end if;
  -- RG160: the data subject request of a privacy.request_received line, by the id of its payload.
  if v_line.event_type = 'privacy.request_received'
     and (v_line.payload ->> 'request_id') ~ c_uuid then
    v_data_request := (v_line.payload ->> 'request_id')::uuid;
  end if;

  return query
  select a.email::text,
         a.created_at,
         p.legal_name,
         a.signup_utm_source,
         a.signup_utm_medium,
         a.signup_utm_campaign,
         a.signup_referrer_domain,
         a.signup_heard_from::text,
         -- RG120, RG122: the person came through an invitation (whatever its state, 0131 EC-J8-16)
         a.signup_invitation_id is not null,
         case when c.granted then c.occurred_at end,
         case when c.granted then c.source::text end,
         (v_line.payload ->> 'email_code') is not null
           and exists (select 1
                         from leads.transactional_sends t
                        where t.account_id = a.id
                          and t.email_code = (v_line.payload ->> 'email_code')),
         (select r.old_email
            from identity.email_change_requests r
           where r.id = v_request
             and r.account_id = a.id
             and r.completed_at is not null),
         s.external_contact_id,
         coalesce(s.suppressed_reason is not null, false),
         n.created_at,
         n.user_agent_summary,
         a.timezone,
         d.request_type::text,
         d.received_at,
         d.due_at,
         case when d.id is not null then d.status = 'closed' end
    from identity.accounts a
    left join profiles.advertiser_profiles p on p.account_id = a.id
    left join leads.contact_sync_states s
           on s.account_id = a.id and s.destination = 'brevo_contact'
    left join identity.sessions n
           on n.id = v_session and n.account_id = a.id and n.surface = 'member'
    -- the join, not the policy, keeps the read to the line's own account
    left join backoffice.data_subject_requests d
           on d.id = v_data_request and d.requester_account_id = a.id
    left join lateral (
          -- RG37: the consent in force, its latest event; a refusal wins a tie
          select e.granted, e.occurred_at, e.source
            from identity.consent_events e
           where e.account_id = a.id and e.purpose = 'marketing_email'
           order by e.occurred_at desc, e.granted
           limit 1) c on true
   where a.id = v_account;
end
$$;

comment on function leads.read_brevo_subject(bigint, text) is
  'E-3 read of the Brevo connectors (16 §M4, EC-11; 05 RG86, RG58, RG93, RG120, RG122, RG142; 16 '
  'RG160), on a brevo_contact or brevo_transactional line in processing for p_worker only (55000 '
  'otherwise; 22023 for another destination): the address, sign-up instant, company name of an '
  'advertiser profile, acquisition source and whether the account came through a member invitation '
  '(0135, never the invitation itself), instant and source of the marketing_email consent in force '
  '(null when refused), whether the welcome e-mail of the line''s code is already journaled (16 '
  'RG90), the old address of the completed request of an email.changed line (0121), the Brevo '
  'contact id, whether a suppression is recorded on the Brevo contact (0121), on an auth.new_device '
  'line the opening instant and the browser summary of the member session named by the payload '
  '(0126), the account''s time zone, and on a privacy.request_received line the type, receipt, '
  'deadline and closure of the data subject request named by the payload (0128), of the line''s '
  'account only. No row for a subject that is not an existing account. SECURITY DEFINER owned by '
  'influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_brevo_subject(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brevo_subject(bigint, text) to influx_worker;

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
alter function leads.read_brevo_subject(bigint, text) owner to influx_leads_definer;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 2. backoffice.record_refused_action(), recreated by its owner ---------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;

set role influx_identity_definer;

create or replace function backoffice.record_refused_action(p_action_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller uuid := influx.current_account_id();
begin
  if v_caller is null
     or influx.current_account_role() is distinct from 'agent'
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'agent'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_action_code is null
     or p_action_code not in ('leads.change_apollo_setting', 'leads.read_apollo_settings',
                              'leads.lift_brevo_suppression', 'backoffice.dual_control',
                              'identity.change_member_role', 'identity.internal_invitation') then
    raise exception 'unknown action code' using errcode = 'invalid_parameter_value';
  end if;
  -- the trace of the attempt, on the caller's own account (AL39 counts them per account)
  perform audit.append('backoffice.action_refused', 'account', v_caller,
                       pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                     'required_role', 'admin'));
end
$$;

comment on function backoffice.record_refused_action(text) is
  '05 CA63, 15 RG110 (AL39): an active agent in aal2 who attempted an admin action leaves its trace: '
  'backoffice.action_refused {action_code, required_role: admin} on his own account. Closed list: '
  'leads.change_apollo_setting, leads.read_apollo_settings, leads.lift_brevo_suppression, '
  'backoffice.dual_control, identity.change_member_role, identity.internal_invitation (0135; 22023 '
  'otherwise). apps/api calls it before answering 403, in a transaction that commits. SECURITY '
  'DEFINER owned by influx_identity_definer; EXECUTE for influx_agent ONLY.';

reset role;

revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 3. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_fn   text;
  v_bad  text;
begin
  foreach v_fn in array array['leads.read_brevo_subject(bigint, text)',
                              'backoffice.record_refused_action(text)'] loop
    if not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER with an empty search_path', v_fn;
    end if;
  end loop;
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'leads.read_brevo_subject(bigint, text)'::regprocedure) <> 'influx_leads_definer'
     or (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
          where oid = 'backoffice.record_refused_action(text)'::regprocedure)
          <> 'influx_identity_definer' then
    raise exception 'unexpected owner of a recreated function';
  end if;

  select string_agg(format('%s: %s', p.oid::regprocedure,
                           case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end), ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in ('leads.read_brevo_subject(bigint, text)'::regprocedure,
                   'backoffice.record_refused_action(text)'::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0
          or (p.oid = 'leads.read_brevo_subject(bigint, text)'::regprocedure
              and a.grantee::regrole::text <> 'influx_worker')
          or (p.oid = 'backoffice.record_refused_action(text)'::regprocedure
              and a.grantee::regrole::text <> 'influx_agent'));
  if v_bad is not null then
    raise exception 'unexpected EXECUTE: %', v_bad;
  end if;

  -- the worker's owner reads whether an invitation was used, never the invitations themselves
  if pg_catalog.has_table_privilege('influx_leads_definer', 'backoffice.member_invitations', 'SELECT')
     or pg_catalog.has_column_privilege('influx_leads_definer', 'identity.accounts',
                                        'signup_invitation_id', 'UPDATE') then
    raise exception 'influx_leads_definer reaches the member invitations';
  end if;

  -- no usable member left on the owners (C-9: the ADMIN-only migration role)
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_leads_definer', 'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'a function owner kept CREATE';
  end if;
end
$$;
