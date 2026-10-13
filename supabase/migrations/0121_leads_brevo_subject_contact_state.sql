-- =============================================================================
-- 0121_leads_brevo_subject_contact_state
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 4. The Brevo contact connector's own read (0112) learns the
-- three facts its new rules need; same motive (E-3 leads.drain_outbox), same
-- owner, same caller.
--
--   leads.read_brevo_subject()   recreated (its result gains three columns, which
--                                CREATE OR REPLACE cannot do):
--     previous_email       on an email.changed line only: the old address of the
--                          COMPLETED request named by the payload (request_id, RG74:
--                          the queue carries ids, the consumer reads the addresses).
--                          The contact is updated by its Brevo id, else by this
--                          address, never recreated (05 RG58, decision 5 of J7).
--     external_contact_id  the Brevo contact id (contact_sync_states, brevo_contact).
--     suppressed           a suppression is recorded on the Brevo contact
--                          (suppressed_reason, 0116: spam_complaint). 05 RG93, CA55:
--                          an ordinary replay never resynchronises it, even after a
--                          new consent; only an admin lifts it (J8).
--
-- ROLLBACK (before any real processing): recreate leads.read_brevo_subject() as in
-- 0112 (drop, create, comment, revoke, grant, owner); drop the policy
-- email_change_requests_leads_definer_select; revoke select (id, account_id,
-- old_email, completed_at) on identity.email_change_requests from
-- influx_leads_definer.
-- =============================================================================

-- 1. Rights of the owner: what the read now reads ------------------------------------------------
-- identity.email_change_requests is FORCE ROW LEVEL SECURITY (0118): the right comes with its
-- policy, limited to the completed requests (an open one has no old address to update from).
-- contact_sync_states: external_contact_id (0111) and suppressed_reason (0116) already granted.

grant select (id, account_id, old_email, completed_at)
   on identity.email_change_requests to influx_leads_definer;

drop policy if exists email_change_requests_leads_definer_select on identity.email_change_requests;
create policy email_change_requests_leads_definer_select on identity.email_change_requests
  for select to influx_leads_definer
  using (completed_at is not null);

-- 2. The read, recreated ----------------------------------------------------------------------------

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
  suppressed           boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line     record;
  v_account  uuid;
  v_request  uuid;
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
  if v_line.event_type = 'email.changed'
     and (v_line.payload ->> 'request_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_request := (v_line.payload ->> 'request_id')::uuid;
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
         coalesce(s.suppressed_reason is not null, false)
    from identity.accounts a
    left join profiles.advertiser_profiles p on p.account_id = a.id
    left join leads.contact_sync_states s
           on s.account_id = a.id and s.destination = 'brevo_contact'
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
  'E-3 read of the Brevo connectors (16 §M4, EC-11; 05 RG86, RG58, RG93), on a brevo_contact or '
  'brevo_transactional line in processing for p_worker only (55000 otherwise; 22023 for another '
  'destination): the address, sign-up instant, company name of an advertiser profile, acquisition '
  'source, instant and source of the marketing_email consent in force (null when refused), whether '
  'the welcome e-mail of the line''s code is already journaled (16 RG90), the old address of the '
  'completed request of an email.changed line (0121), the Brevo contact id, and whether a '
  'suppression is recorded on the Brevo contact (0121). No row for a subject that is not an '
  'existing account. SECURITY DEFINER owned by influx_leads_definer, empty search_path; EXECUTE '
  'for influx_worker ONLY.';

revoke all on function leads.read_brevo_subject(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brevo_subject(bigint, text) to influx_worker;

-- 3. Hand the function to influx_leads_definer (03 P7 rule 5, window of 0004 §9) ---------------

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

-- 4. End-state assertions ----------------------------------------------------------------------------

do $$
declare
  c_fn constant text := 'leads.read_brevo_subject(bigint, text)';
  v_bad  text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = c_fn::regprocedure) <> 'influx_leads_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_leads_definer, empty search_path', c_fn;
  end if;
  -- E-3: EXECUTE for influx_worker only, besides the owner; never PUBLIC
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_worker');
  if v_bad is not null then
    raise exception '% executable by: %', c_fn, v_bad;
  end if;

  -- the owner reads the old address and the completion, never the digests nor the new address
  if pg_catalog.has_column_privilege('influx_leads_definer', 'identity.email_change_requests',
                                     'old_code_hash', 'SELECT')
     or pg_catalog.has_column_privilege('influx_leads_definer', 'identity.email_change_requests',
                                        'new_code_hash', 'SELECT')
     or pg_catalog.has_column_privilege('influx_leads_definer', 'identity.email_change_requests',
                                        'new_email', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_leads_definer', 'identity.email_change_requests',
                                            'INSERT, UPDATE') then
    raise exception 'influx_leads_definer holds more than the read of the completed requests';
  end if;

  -- influx_worker still holds no right on any table: the read goes through the function (03 P7)
  if pg_catalog.has_any_column_privilege('influx_worker', 'identity.email_change_requests', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_worker', 'leads.contact_sync_states', 'SELECT') then
    raise exception 'influx_worker holds a table right';
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
    raise exception 'influx_leads_definer left with CREATE on schema leads';
  end if;
end
$$;
