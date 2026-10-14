-- =============================================================================
-- 0128_leads_brevo_subject_data_request
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, after commit 8. The acknowledgement privacy.request_received (16 RG160,
-- CA117, CA118) is WRITTEN BY INFLUX from its translation files, like auth.new_device
-- (16 RG67, RG157): decision of architecte on 2026-10-14, on the recommendation of
-- product-owner. EC-8 no longer applies to it: no Brevo template id, never
-- skipped template_not_configured, and the "no link" output check holds on it.
--
--   leads.read_brevo_subject()   recreated: also the account's time zone (16 RG157,
--         RG160 point 3: the dates in the account's time zone), and on a
--         privacy.request_received line the type, receipt, deadline and closure of
--         the request named by the payload (request_id), of the line's account only.
--   influx_leads_definer         reads (id, requester_account_id, request_type,
--         received_at, due_at, status) of backoffice.data_subject_requests, policy:
--         requests of a member; never the channel, the outcome nor the dates of
--         closing; nothing of backoffice.code_delivery_reports.
--   leads.sync_settings          the key privacy.request_received leaves
--         brevo_template_ids.
--
-- ROLLBACK (before any real line): recreate leads.read_brevo_subject() as in 0126;
-- drop the policy data_subject_requests_leads_definer_select; revoke select on
-- backoffice.data_subject_requests, usage on schema backoffice and select (timezone)
-- on identity.accounts from influx_leads_definer; put back the key
-- privacy.request_received (null) in brevo_template_ids.
-- =============================================================================

-- 1. Rights of the owner of the read (influx_leads_definer) ------------------------------------------
-- identity.accounts: its policy accounts_leads_definer_select exists since 0111; only the time zone
-- is new. backoffice.data_subject_requests is FORCE ROW LEVEL SECURITY (0120): the right comes with
-- its policy.

grant select (timezone) on identity.accounts to influx_leads_definer;

grant usage on schema backoffice to influx_leads_definer;
grant select (id, requester_account_id, request_type, received_at, due_at, status)
   on backoffice.data_subject_requests to influx_leads_definer;

drop policy if exists data_subject_requests_leads_definer_select on backoffice.data_subject_requests;
create policy data_subject_requests_leads_definer_select on backoffice.data_subject_requests
  for select to influx_leads_definer
  using (requester_account_id is not null);

-- 2. The read -----------------------------------------------------------------------------------------

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
  'E-3 read of the Brevo connectors (16 §M4, EC-11; 05 RG86, RG58, RG93, RG142; 16 RG160), on a '
  'brevo_contact or brevo_transactional line in processing for p_worker only (55000 otherwise; 22023 '
  'for another destination): the address, sign-up instant, company name of an advertiser profile, '
  'acquisition source, instant and source of the marketing_email consent in force (null when '
  'refused), whether the welcome e-mail of the line''s code is already journaled (16 RG90), the old '
  'address of the completed request of an email.changed line (0121), the Brevo contact id, whether '
  'a suppression is recorded on the Brevo contact (0121), on an auth.new_device line the opening '
  'instant and the browser summary of the member session named by the payload (0126), the account''s '
  'time zone, and on a privacy.request_received line the type, receipt, deadline and closure of the '
  'data subject request named by the payload (0128), of the line''s account only. No row for a '
  'subject that is not an existing account. SECURITY DEFINER owned by influx_leads_definer, empty '
  'search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_brevo_subject(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brevo_subject(bigint, text) to influx_worker;

-- 3. The acknowledgement leaves EC-8 ------------------------------------------------------------------

update leads.sync_settings
   set value = value - 'privacy.request_received'
 where key = 'brevo_template_ids'
   and value ? 'privacy.request_received';

-- 4. Hand the read to its owner (03 P7 rule 5, window of 0004 §9) -----------------------------------

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

-- 5. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_fn   constant text := 'leads.read_brevo_subject(bigint, text)';
  v_bad  text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = v_fn::regprocedure) <> 'influx_leads_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_leads_definer, empty search_path', v_fn;
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

  -- the worker's owner reads neither the channel nor the closing of a request, writes nothing
  select string_agg(c, ', ') into v_bad
    from unnest(array['channel', 'completed_at', 'outcome_code', 'created_at', 'updated_at']) c
   where pg_catalog.has_column_privilege('influx_leads_definer', 'backoffice.data_subject_requests',
                                         c, 'SELECT');
  if v_bad is not null then
    raise exception 'influx_leads_definer reads backoffice.data_subject_requests.%', v_bad;
  end if;
  if pg_catalog.has_any_column_privilege('influx_leads_definer', 'backoffice.data_subject_requests',
                                         'INSERT, UPDATE')
     or pg_catalog.has_any_column_privilege('influx_leads_definer', 'backoffice.code_delivery_reports',
                                            'SELECT, INSERT, UPDATE')
     or pg_catalog.has_any_column_privilege('influx_worker', 'backoffice.data_subject_requests',
                                            'SELECT') then
    raise exception 'unexpected right on the backoffice tables';
  end if;

  if exists (select 1 from leads.sync_settings
              where key = 'brevo_template_ids' and value ? 'privacy.request_received') then
    raise exception 'privacy.request_received is still a Brevo template';
  end if;

  -- no usable member left on the owner (C-9: the ADMIN-only migration role)
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_leads_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE') then
    raise exception 'influx_leads_definer kept CREATE on leads';
  end if;
end
$$;
