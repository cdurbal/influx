-- =============================================================================
-- 0126_identity_new_browser_signal
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 8. The "new browser" signal of a member sign-in (05 RG141,
-- RG142, CA80, CA81; 16 RG157, RG158; 21 EC-43), and what the worker reads to write
-- its e-mail.
--
--   auth.new_device      the queue fact (audit.event_types: the queue references it)
--                        and the e-mail code of 16 §H (P1).
--   identity.signal_new_browser()   E-2 identity.verify_code, influx_auth ONLY, in
--         the transaction that opened the member session (created_at = now()): no
--         other member session of the account at all => the first one, nothing
--         (RG141, CA81); another member session with the SAME summary active in the
--         last 30 days => a known browser, nothing; otherwise ONE queue line
--         auth.new_device to brevo_transactional, priority 100 (P1), payload = ids
--         (RG74), idempotency key = account + summary + UTC day (16 RG85, RG157: at
--         most one per account, summary and day, CA80). Never a block, never a
--         suspension, never a country (RG142, EC-43).
--   leads.read_brevo_subject()   recreated: on an auth.new_device line, the
--         instant the session opened and its summary (signed_in_at, browser), read
--         from the session named by the payload, of the line's account only.
--
-- The e-mail itself is written by the worker from INFLUX's translation files (16
-- RG67, RG157), without any link (RG158): no Brevo template id for this code.
--
-- ROLLBACK (before any real line): drop function identity.signal_new_browser(uuid);
-- recreate leads.read_brevo_subject() as in 0121; restore the 0120 policy
-- outbox_events_identity_definer_insert; drop the policy
-- sessions_leads_definer_select and revoke select on identity.sessions from
-- influx_leads_definer; revoke select (user_agent_summary) on identity.sessions from
-- influx_identity_definer; delete the code auth.new_device from audit.event_types
-- (possible only while no line references it).
-- =============================================================================

-- 1. The code ---------------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  ('auth.new_device', 'identity', 'account', 'sensitive')
on conflict (code) do nothing;

-- 2. Rights of the owner of the signal (influx_identity_definer) -----------------------------------
-- identity.sessions: id, account_id, surface, last_activity_at, revoked_at (0012), created_at (0118);
-- the summary is the only new column. leads.outbox_events: insert since 0104, the code added below.

grant select (user_agent_summary) on identity.sessions to influx_identity_definer;

drop policy if exists outbox_events_identity_definer_insert on leads.outbox_events;
create policy outbox_events_identity_definer_insert on leads.outbox_events
  for insert to influx_identity_definer
  with check (status = 'pending' and attempts = 0
              and event_type in ('lead.created', 'lead.updated', 'account.email_corrected',
                                 'email.changed', 'consent.granted', 'consent.revoked',
                                 'privacy.request_received', 'auth.new_device'));

-- 3. The signal -----------------------------------------------------------------------------------

create or replace function identity.signal_new_browser(
  p_session_id  uuid
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_session  record;
  v_summary  text;
  v_fact     uuid := pg_catalog.gen_random_uuid();
  v_count    integer;
begin
  -- Only the member session this very transaction opened: the signal is never replayed later,
  -- nor raised on a session of somebody else's choosing.
  select s.id, s.account_id, s.user_agent_summary
    into v_session
    from identity.sessions s
   where s.id = p_session_id
     and s.surface = 'member'
     and s.revoked_at is null
     and s.created_at = pg_catalog.now();
  if not found then
    raise exception 'a member session opened by this transaction only'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  v_summary := coalesce(v_session.user_agent_summary, 'unidentified.unidentified');

  -- RG141, CA81: the first member session of an account never signals.
  if not exists (select 1
                   from identity.sessions o
                  where o.account_id = v_session.account_id
                    and o.surface = 'member'
                    and o.id <> v_session.id) then
    return false;
  end if;

  -- RG141: a browser is known when another session of the account with the same summary had
  -- activity in the last 30 days (720 hours), closed or not. "unidentified" is a value like any.
  if exists (select 1
               from identity.sessions o
              where o.account_id = v_session.account_id
                and o.surface = 'member'
                and o.id <> v_session.id
                and coalesce(o.user_agent_summary, 'unidentified.unidentified') = v_summary
                and o.last_activity_at >= pg_catalog.now() - interval '720 hours') then
    return false;
  end if;

  -- RG142, 16 RG85: P1 through the queue, ids only (RG74); at most one per account, summary and
  -- UTC day: a second line of the same day meets the key and is dropped.
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values
    (v_fact, 'auth.new_device', 'brevo_transactional', 'account:' || v_session.account_id::text, 100,
     pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_session.account_id,
                                   'session_id', v_session.id, 'email_code', 'auth.new_device'),
     'auth.new_device:' || v_session.account_id::text || ':' || v_summary || ':'
       || pg_catalog.to_char(pg_catalog.now() at time zone 'UTC', 'YYYY-MM-DD'))
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count = 1;
end
$$;

comment on function identity.signal_new_browser(uuid) is
  'E-2 identity.verify_code (05 RG141, RG142, CA80, CA81; 21 EC-43): on the member session opened by '
  'the calling transaction (55000 otherwise), queues auth.new_device (brevo_transactional, priority '
  '100, payload = event, account and session ids; key = account + summary + UTC day) unless it is '
  'the first member session of the account, or another member session with the same summary had '
  'activity in the last 30 days. Returns true when a line was queued (false also when the key of '
  'the day already exists). Never blocks nor suspends. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_auth ONLY.';

revoke all on function identity.signal_new_browser(uuid)
  from public, anon, authenticated, service_role;
grant execute on function identity.signal_new_browser(uuid) to influx_auth;

-- 4. The worker's read (influx_leads_definer) --------------------------------------------------------
-- identity.sessions is FORCE ROW LEVEL SECURITY (0004): the right comes with its policy, member
-- sessions only; never the token digest, the marker nor the country.

grant select (id, account_id, surface, created_at, user_agent_summary)
   on identity.sessions to influx_leads_definer;

drop policy if exists sessions_leads_definer_select on identity.sessions;
create policy sessions_leads_definer_select on identity.sessions
  for select to influx_leads_definer
  using (surface = 'member');

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
  browser              text
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
  v_session  uuid;
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
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
         n.user_agent_summary
    from identity.accounts a
    left join profiles.advertiser_profiles p on p.account_id = a.id
    left join leads.contact_sync_states s
           on s.account_id = a.id and s.destination = 'brevo_contact'
    left join identity.sessions n
           on n.id = v_session and n.account_id = a.id and n.surface = 'member'
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
  'E-3 read of the Brevo connectors (16 §M4, EC-11; 05 RG86, RG58, RG93, RG142), on a brevo_contact '
  'or brevo_transactional line in processing for p_worker only (55000 otherwise; 22023 for another '
  'destination): the address, sign-up instant, company name of an advertiser profile, acquisition '
  'source, instant and source of the marketing_email consent in force (null when refused), whether '
  'the welcome e-mail of the line''s code is already journaled (16 RG90), the old address of the '
  'completed request of an email.changed line (0121), the Brevo contact id, whether a suppression is '
  'recorded on the Brevo contact (0121), and on an auth.new_device line the opening instant and the '
  'browser summary of the member session named by the payload, of the line''s account only (0126). '
  'No row for a subject that is not an existing account. SECURITY DEFINER owned by '
  'influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_brevo_subject(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brevo_subject(bigint, text) to influx_worker;

-- 5. Hand the functions to their owners (03 P7 rule 5, window of 0004 §9) --------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;
alter function identity.signal_new_browser(uuid) owner to influx_identity_definer;
revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

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

-- 6. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('identity.signal_new_browser(uuid)', 'influx_identity_definer', 'influx_auth'),
      ('leads.read_brevo_subject(bigint, text)', 'influx_leads_definer', 'influx_worker')
    ) as t (fn, owner, caller)
  loop
    v_fn := v_def.fn;
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> v_def.owner
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by %, empty search_path', v_fn, v_def.owner;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> v_def.caller);
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- the worker's owner reads no secret of a session (digest, marker, country, revocation)
  select string_agg(c, ', ') into v_bad
    from unnest(array['token_hash', 'reauthenticated_at', 'reauth_purpose', 'country_code',
                      'mfa_verified_at', 'revoked_at']) c
   where pg_catalog.has_column_privilege('influx_leads_definer', 'identity.sessions', c, 'SELECT');
  if v_bad is not null then
    raise exception 'influx_leads_definer reads identity.sessions.%', v_bad;
  end if;
  if pg_catalog.has_any_column_privilege('influx_leads_definer', 'identity.sessions', 'INSERT, UPDATE')
     or pg_catalog.has_any_column_privilege('influx_worker', 'identity.sessions', 'SELECT') then
    raise exception 'unexpected right on identity.sessions';
  end if;

  -- no usable member left on either owner (C-9: the ADMIN-only migration role)
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_identity_definer', 'influx_leads_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE') then
    raise exception 'a function owner kept CREATE on its schema';
  end if;
end
$$;
