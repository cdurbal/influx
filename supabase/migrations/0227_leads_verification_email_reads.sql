-- =============================================================================
-- 0227_leads_verification_email_reads
-- -----------------------------------------------------------------------------
-- Lot 2 / L2E, commit 16 (jalons/l2e/16.md; fiche invariants 14, 17; l2e/modele.md §1 point 7, §4
-- "Outbox"; 08 RG92, RG94; 16 §M4; D69). What the worker needs to WRITE the verification e-mails
-- and to carry the badge level to Brevo. No connector and no TypeScript here (the commit's own
-- files). Modelled on 0211 (read_brevo_profile_decision) and 0212 (read_brand_profile_attributes).
--
--   leads.read_brevo_verification_email(outbox, worker)   E-3: on a line of brevo_transactional in
--         processing for THIS worker whose event is verification.received, .code_issued, .decision
--         or .request_expired: the facts of the e-mail, from the request the payload names and the
--         account the subject key names, never from the caller: level, network line code, status,
--         reason code, the message written by the agent (the refusal only), the badge's date, expiry
--         (a decision) or the code's kind, expiry and revocation (the line's code, named by its key).
--         Never the code itself, the handle, the figures, the period, the agent, the internal
--         comment nor the evidence. No row for a request that is not the line's account's, a code
--         that is not the request's, or an erased account. SECURITY DEFINER owned by
--         influx_leads_definer, EXECUTE for influx_worker ONLY.
--   leads.read_verified_badge(outbox, worker)   E-3: on a line of brevo_contact (never Apollo, 08
--         RG92) in processing for this worker, the level the account holds (none | n1 account or
--         brand | n2 audience) and the date of the badge that fixes it (modele §1 point 7). A badge
--         holds while active, to_refresh or to_reconfirm and not past its expiry. One row for an
--         account that exists, none otherwise. Same owner and EXECUTE.
--   influx_leads_definer   USAGE on verification; SELECT on named columns of verification_requests,
--         ownership_codes (never `code`) and badges (never a figure, a handle, an agent nor a
--         reference), each policy limited to an account not erased; nothing on evidence_files,
--         registry_sources, rejection_reasons nor profiles.advertiser_internal_details (RG48).
--   The four emitters of the verification e-mails (issue_ownership_code, submit_request_of,
--         ops.expire_verification_requests, queue_decision) are recreated by their owners from their
--         0222, 0223 and 0224 versions, ONE change each: the payload names its e-mail code
--         (email_code = the event type), as profile.decision does since 0211. 0111
--         (complete_outbox_attempt §3) refuses the success of a transactional line that names no
--         e-mail code, so without it no verification e-mail could be recorded as sent. Keys,
--         owners, EXECUTE and every other line are kept.
--   profiles.advertiser_profiles.legal_name   its comment says what it is: the TRADING name (the
--         raison sociale lives in profiles.advertiser_internal_details, L2CS-8).
--
-- EC-L2E-16 (micro-gaps, the safest choice):
--   EC-L2E-16-1  0227 is the next free number. email_code joins the payload of the four lines
--                (modele §4 lists ids only: a constant is not a datum); the two db-tests that
--                list the payload keys name it.
--   EC-L2E-16-2  the code of a code_issued line is read from the line's idempotency key
--                (verification.code_issued:<code_id>, 0222), so that each e-mail speaks of ITS code.
--   EC-L2E-16-3  one read for the four e-mails (a line of another event type is 22023); the decision
--                about what to send or skip (cancelled request, revoked code) is the connector's.
--
-- ROLLBACK (before any verification line is processed): drop function
-- leads.read_brevo_verification_email(bigint, text), leads.read_verified_badge(bigint, text); drop
-- the three *_leads_definer_select policies; revoke select on the three tables and usage on
-- verification from influx_leads_definer; recreate the four emitters as in 0222, 0223, 0224.
-- =============================================================================

-- 1. The four emitters name their e-mail code (EC-L2E-16-1) -------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_verification_definer', current_user);
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
  execute format('grant %I to %I with inherit false, set true',
                 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema verification to influx_creator_verification_definer;
grant create on schema verification to influx_verification_definer;
grant create on schema ops to influx_maintenance_definer;

-- 1.1 issue_ownership_code (0222)
set role influx_creator_verification_definer;
create or replace function verification.issue_ownership_code(
  p_request_id  uuid,
  p_account_id  uuid,
  p_kind        text)
returns table (
  code_id     uuid,
  code        text,
  expires_at  timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_days     integer;
  v_id       uuid;
  v_code     text;
  v_expires  timestamptz;
  v_event    uuid := pg_catalog.gen_random_uuid();
begin
  select (s.value)::integer into v_days
    from backoffice.operational_settings s where s.key = 'verification_code_validity_days';
  if v_days is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- RG23: one valid code per request, the former one invalidated in the same transaction
  update verification.ownership_codes c
     set revoked_at = pg_catalog.now()
   where c.request_id = p_request_id and c.revoked_at is null;

  v_expires := pg_catalog.now() + pg_catalog.make_interval(days => v_days);
  for attempt in 1 .. 5 loop
    begin
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (p_request_id, p_account_id, p_kind, verification.new_ownership_code(), v_expires)
      returning id, code into v_id, v_code;
      exit;
    exception when unique_violation then
      -- the request row is locked by the door: only a collision of codes lands here
      if attempt = 5 then
        raise;
      end if;
    end;
  end loop;

  -- the e-mail « code generated » (EC-L2E-3), never the code itself
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'verification.code_issued', 'brevo_transactional',
          'account:' || p_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id,
                                        'request_id', p_request_id,
                                            'email_code', 'verification.code_issued'),
          'verification.code_issued:' || v_id::text);

  perform audit.append('verification.code_generated', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('code_id', v_id, 'kind', p_kind));
  return query select v_id, v_code, v_expires;
end
$$;
reset role;

-- 1.2 submit_request_of (0222)
set role influx_creator_verification_definer;
create or replace function verification.submit_request_of(
  p_request_id  uuid,
  p_account_id  uuid)
returns timestamptz
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_at     timestamptz;
  v_level  verification.badge_level;
  v_event  uuid := pg_catalog.gen_random_uuid();
begin
  -- the deadlines are written by the trigger verification_requests_prepare (EC-L2E-05-3)
  update verification.verification_requests r
     set status = 'pending'
   where r.id = p_request_id and r.account_id = p_account_id and r.status = 'draft'
  returning r.submitted_at, r.level into v_at, v_level;
  if v_at is null then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;

  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'verification.received', 'brevo_transactional',
          'account:' || p_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id,
                                        'request_id', p_request_id,
                                            'email_code', 'verification.received'),
          'verification.received:' || p_request_id::text);

  perform audit.append('verification.submitted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_level));
  return v_at;
end
$$;
reset role;

-- 1.3 expire_verification_requests (0223)
set role influx_maintenance_definer;
create or replace function ops.expire_verification_requests(
  p_run_id   uuid,
  p_attempt  smallint
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row    record;
  v_event  uuid;
  v_count  integer := 0;
begin
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code::text = 'verification_expiry') then
    raise exception 'no open verification_expiry run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- the live (unrevoked) code of the draft is past its date: the request cannot be submitted
  -- (EC-L2E-06-3), it expires (EC-L2E-07-7: 500 per call, the next call goes on)
  for v_row in
    select q.id, q.account_id, q.level
      from verification.verification_requests q
     where q.status = 'draft'
       and exists (select 1 from verification.ownership_codes c
                    where c.request_id = q.id and c.revoked_at is null
                      and c.expires_at <= pg_catalog.now())
     order by q.id
     limit 500
       for update of q skip locked
  loop
    update verification.verification_requests q
       set status = 'expired', closed_at = pg_catalog.now()
     where q.id = v_row.id and q.status = 'draft';
    if found then
      v_event := pg_catalog.gen_random_uuid();
      -- the e-mail « request expired » (EC-L2E-3), ids only
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (v_event, 'verification.request_expired', 'brevo_transactional',
              'account:' || v_row.account_id::text, 100,
              pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_row.account_id,
                                            'request_id', v_row.id,
                                            'email_code', 'verification.request_expired'),
              'verification.request_expired:' || v_row.id::text);
      perform audit.append('verification.expired', 'verification_request', v_row.id,
                           pg_catalog.jsonb_build_object('level', v_row.level));
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end
$$;
reset role;

-- 1.4 queue_decision (0224)
set role influx_verification_definer;
create or replace function verification.queue_decision(
  p_request_id     uuid,
  p_account_id     uuid,
  p_badge_changed  boolean)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  -- 08 RG52: the decision e-mail, written by the worker from email.json (D69); ids only
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'verification.decision', 'brevo_transactional',
          'account:' || p_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', p_account_id,
                                        'request_id', p_request_id,
                                            'email_code', 'verification.decision'),
          'verification.decision:' || p_request_id::text);
  -- modele "Outbox": VERIFIED_LEVEL follows every change of badge, Brevo only (never Apollo)
  if p_badge_changed then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (v_lead, 'lead.updated', 'brevo_contact', 'account:' || p_account_id::text, 100,
            pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', p_account_id),
            'lead.updated:' || v_lead::text);
  end if;
end
$$;
reset role;

revoke create on schema verification from influx_creator_verification_definer;
revoke create on schema verification from influx_verification_definer;
revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_verification_definer', current_user);
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 2. What the reads read (03 P7: column by column, with its policy) ------------------------------------
-- The three tables are FORCE ROW LEVEL SECURITY (0221): the right comes with its policy TO the owner.
-- identity.accounts (id, status, preferred_language) and its policy accounts_leads_definer_select
-- exist since 0111; USAGE on leads and identity since 0111.

grant usage on schema verification to influx_leads_definer;

grant select (id, account_id, level, population, network_code, status, rejection_reason_code,
              member_message)
   on verification.verification_requests to influx_leads_definer;
drop policy if exists verification_requests_leads_definer_select on verification.verification_requests;
create policy verification_requests_leads_definer_select on verification.verification_requests
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = verification_requests.account_id and a.status <> 'deleted'));

-- never the code itself (a member's proof), nor what the agent observed
grant select (id, request_id, account_id, kind, expires_at, revoked_at)
   on verification.ownership_codes to influx_leads_definer;
drop policy if exists ownership_codes_leads_definer_select on verification.ownership_codes;
create policy ownership_codes_leads_definer_select on verification.ownership_codes
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = ownership_codes.account_id and a.status <> 'deleted'));

-- never a figure, a period, a handle, a reference nor the agent (08 RG92)
grant select (account_id, request_id, level, network_code, granted_at, expires_at, state,
              evidence_source)
   on verification.badges to influx_leads_definer;
drop policy if exists badges_leads_definer_select on verification.badges;
create policy badges_leads_definer_select on verification.badges
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = badges.account_id and a.status <> 'deleted'));

-- 3. The two reads (E-3) -----------------------------------------------------------------------------

drop function if exists leads.read_brevo_verification_email(bigint, text);

create function leads.read_brevo_verification_email(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  level               text,
  network_code        text,
  request_status      text,
  reason_code         text,
  member_message      text,
  granted_at          timestamptz,
  badge_expires_at    timestamptz,
  code_kind           text,
  code_expires_at     timestamptz,
  code_revoked        boolean,
  preferred_language  text
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
  v_code     uuid;
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker: the facts are read for the e-mail about to be sent,
  -- never for a line of another instance or one taken back.
  select o.destination, o.event_type, o.subject_key, o.payload, o.idempotency_key
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_line.destination <> 'brevo_transactional'
     or v_line.event_type not in ('verification.received', 'verification.code_issued',
                                  'verification.decision', 'verification.request_expired') then
    raise exception 'a verification e-mail line of brevo_transactional only'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The account comes from the line, the request from its payload, never from the caller
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or pg_catalog.split_part(v_line.subject_key, ':', 2) !~ c_uuid
     or (v_line.payload ->> 'request_id') is null
     or (v_line.payload ->> 'request_id') !~ c_uuid then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;
  v_request := (v_line.payload ->> 'request_id')::uuid;

  -- EC-L2E-16-2: the code of a code_issued line is the one its key names
  if v_line.event_type = 'verification.code_issued' then
    if pg_catalog.split_part(v_line.idempotency_key, ':', 2) !~ c_uuid then
      return;
    end if;
    v_code := pg_catalog.split_part(v_line.idempotency_key, ':', 2)::uuid;
  end if;

  return query
  select r.level::text,
         r.network_code,
         r.status::text,
         r.rejection_reason_code,
         r.member_message,
         b.granted_at,
         b.expires_at,
         c.kind,
         c.expires_at,
         (c.revoked_at is not null),
         a.preferred_language::text
    from verification.verification_requests r
    join identity.accounts a on a.id = r.account_id
    left join lateral (
           select x.granted_at, x.expires_at
             from verification.badges x
            where v_line.event_type = 'verification.decision'
              and x.request_id = r.id and x.account_id = r.account_id
            order by x.granted_at desc
            limit 1) b on true
    left join verification.ownership_codes c
           on c.id = v_code and c.request_id = r.id and c.account_id = r.account_id
   where r.id = v_request
     and r.account_id = v_account
     and a.status <> 'deleted'
     and (v_line.event_type <> 'verification.code_issued' or c.id is not null);
end
$$;

comment on function leads.read_brevo_verification_email(bigint, text) is
  'E-3 read of the verification e-mails (08 RG94; D69; EC-L2E-3; 0227), on a verification.received, '
  '.code_issued, .decision or .request_expired line of brevo_transactional in processing for '
  'p_worker only (55000 otherwise; 22023 for another event or destination): level, network line '
  'code, status, reason code, the agent''s message to the member, the badge''s date and expiry (a '
  'decision), the line''s code kind, expiry and revocation (a code_issued, named by its key), the '
  'account''s UI language. Never the code, the handle, a figure, the period, the agent, the internal '
  'comment nor the evidence. No row for a request or code that is not the line''s account''s or for '
  'an erased account. SECURITY DEFINER owned by influx_leads_definer, empty search_path; EXECUTE '
  'for influx_worker ONLY.';

drop function if exists leads.read_verified_badge(bigint, text);

create function leads.read_verified_badge(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  verified_level  text,
  verified_at     timestamptz
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
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  select o.destination, o.subject_key
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  -- Brevo only: no badge leaves for Apollo (08 RG92)
  if v_line.destination <> 'brevo_contact' then
    raise exception 'a contact line of Brevo only'
      using errcode = 'invalid_parameter_value';
  end if;

  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or pg_catalog.split_part(v_line.subject_key, ':', 2) !~ c_uuid then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;

  -- modele §1 point 7: n2 audience, n1 account or brand, none otherwise; the date of the badge that
  -- fixes the level. A badge holds while it is displayed (active, to_refresh, to_reconfirm) and not
  -- past its expiry.
  return query
  select case when au.at is not null then 'n2'
              when n1.at is not null then 'n1'
              else 'none' end,
         coalesce(au.at, n1.at)
    from identity.accounts a
    left join lateral (
           select pg_catalog.max(b.granted_at) as at
             from verification.badges b
            where b.account_id = a.id and b.level = 'audience_verified'
              and b.state in ('active', 'to_refresh', 'to_reconfirm')
              and (b.expires_at is null or b.expires_at > pg_catalog.now())) au on true
    left join lateral (
           select pg_catalog.max(b.granted_at) as at
             from verification.badges b
            where b.account_id = a.id and b.level in ('account_verified', 'brand_verified')
              and b.state in ('active', 'to_refresh', 'to_reconfirm')
              and (b.expires_at is null or b.expires_at > pg_catalog.now())) n1 on true
   where a.id = v_account
     and a.status <> 'deleted';
end
$$;

comment on function leads.read_verified_badge(bigint, text) is
  'E-3 read of the badge level of a Brevo contact (16 §M4 VERIFIED_LEVEL and VERIFIED_AT; 08 RG92; '
  'modele §1 point 7; 0227), on a brevo_contact line in processing for p_worker only (55000 '
  'otherwise; 22023 for another destination: nothing leaves for Apollo): n2 when an audience badge '
  'holds, n1 for an account or brand badge, none otherwise, with the grant date of the badge that '
  'fixes the level (null for none). Holds = active, to_refresh or to_reconfirm and not past its '
  'expiry. Never a figure, a handle, a network nor a reason. One row for an account that exists, '
  'none for an unknown or erased one. SECURITY DEFINER owned by influx_leads_definer, empty '
  'search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_brevo_verification_email(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function leads.read_verified_badge(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brevo_verification_email(bigint, text) to influx_worker;
grant execute on function leads.read_verified_badge(bigint, text) to influx_worker;

-- Hand the functions to influx_leads_definer (03 P7 rule 5, window of 0004 §9)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;

alter function leads.read_brevo_verification_email(bigint, text) owner to influx_leads_definer;
alter function leads.read_verified_badge(bigint, text) owner to influx_leads_definer;

revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 4. The trading name says what it is (L2CS-8) -----------------------------------------------------------

comment on column profiles.advertiser_profiles.legal_name is
  'The TRADING name of the brand as typed at sign-up (05 RG13), the one Brevo (COMPANY) and Apollo '
  '(organization_name) carry, the column name being historical (l2e/modele.md §1 point 5). The raison '
  'sociale as registered is profiles.advertiser_internal_details.legal_name, which no worker read '
  'reaches (06 RG48, RG80). Changing it emits lead.updated (RG73): the change goes through a named '
  'function (J7), never a direct UPDATE.';

-- 5. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('leads.read_brevo_verification_email(bigint, text)', 'influx_leads_definer', true,
        array['influx_worker']),
      ('leads.read_verified_badge(bigint, text)', 'influx_leads_definer', true,
        array['influx_worker']),
      ('verification.issue_ownership_code(uuid, uuid, text)',
        'influx_creator_verification_definer', false, array['influx_identity_definer']),
      ('verification.submit_request_of(uuid, uuid)', 'influx_creator_verification_definer', false,
        array['influx_identity_definer']),
      ('ops.expire_verification_requests(uuid, smallint)', 'influx_maintenance_definer', true,
        array['influx_worker']),
      ('verification.queue_decision(uuid, uuid, boolean)', 'influx_verification_definer', false,
        array[]::text[])
    ) as t (fn, owner, definer, callers)
  loop
    v_fn := v_def.fn;
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> v_def.owner
       or (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by %, SECURITY DEFINER = %, empty search_path', v_fn, v_def.owner,
        v_def.definer;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  -- the four emitters name their e-mail code
  foreach v_fn in array array[
    'verification.issue_ownership_code(uuid, uuid, text)',
    'verification.submit_request_of(uuid, uuid)',
    'ops.expire_verification_requests(uuid, smallint)',
    'verification.queue_decision(uuid, uuid, boolean)']
  loop
    if (select prosrc from pg_catalog.pg_proc where oid = v_fn::regprocedure)
         !~ '''email_code'', ''verification\.' then
      raise exception '% does not name its e-mail code', v_fn;
    end if;
  end loop;

  -- the owner of the reads reaches only the named columns of the three tables, never writes them
  select string_agg(format('%s.%s', c.attrelid::regclass, c.attname), ', ') into v_bad
    from pg_catalog.pg_attribute c
   where c.attrelid in ('verification.verification_requests'::regclass,
                        'verification.ownership_codes'::regclass,
                        'verification.badges'::regclass)
     and c.attnum > 0 and not c.attisdropped
     and pg_catalog.has_column_privilege('influx_leads_definer', c.attrelid, c.attname,
                                         'SELECT, INSERT, UPDATE, REFERENCES')
     and (c.attrelid, c.attname) not in (
       select 'verification.verification_requests'::regclass, n from unnest(array[
         'id', 'account_id', 'level', 'population', 'network_code', 'status',
         'rejection_reason_code', 'member_message']) n
       union all
       select 'verification.ownership_codes'::regclass, n from unnest(array[
         'id', 'request_id', 'account_id', 'kind', 'expires_at', 'revoked_at']) n
       union all
       select 'verification.badges'::regclass, n from unnest(array[
         'account_id', 'request_id', 'level', 'network_code', 'granted_at', 'expires_at', 'state',
         'evidence_source']) n);
  if v_bad is not null then
    raise exception 'influx_leads_definer reaches %', v_bad;
  end if;
  if exists (select 1 from pg_catalog.pg_class t
              where t.relnamespace = 'verification'::regnamespace and t.relkind in ('r', 'p', 'v', 'm')
                and pg_catalog.has_any_column_privilege('influx_leads_definer', t.oid,
                                                        'INSERT, UPDATE')) then
    raise exception 'influx_leads_definer writes a table of verification';
  end if;
  if pg_catalog.has_any_column_privilege('influx_leads_definer', 'verification.evidence_files',
                                         'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_any_column_privilege('influx_leads_definer', 'verification.registry_sources',
                                            'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_any_column_privilege('influx_leads_definer', 'verification.rejection_reasons',
                                            'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_any_column_privilege('influx_leads_definer',
                                            'profiles.advertiser_internal_details',
                                            'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_leads_definer reaches a table it must not (RG48, RG82)';
  end if;

  -- the advertiser still has nothing on verification, usage included (EC-L2E-18)
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;

  -- influx_worker still holds no right on the tables: the reads go through the functions (03 P7)
  if pg_catalog.has_any_column_privilege('influx_worker', 'verification.verification_requests',
                                         'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_any_column_privilege('influx_worker', 'verification.badges',
                                            'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_any_column_privilege('influx_worker', 'verification.ownership_codes',
                                            'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_worker holds a right on a table of verification';
  end if;

  -- no usable member left on the owners (C-9: the ADMIN-only migration role), no CREATE kept
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_leads_definer', 'influx_creator_verification_definer',
                         'influx_verification_definer', 'influx_maintenance_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_creator_verification_definer', 'verification', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE') then
    raise exception 'a function owner left with CREATE on its schema';
  end if;
end
$$;
