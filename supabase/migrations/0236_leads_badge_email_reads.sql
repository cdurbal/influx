-- =============================================================================
-- 0236_leads_badge_email_reads
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 12 (jalons/l2f/12.md; l2f/modele.md §4 "Outbox" and the annex textes.md, which
-- prevail for every name; l2f-fiche.md invariants 11, 12, 13, 17; 08 RG94, RG93; D69). What the worker
-- needs to WRITE the eight e-mails of the life of the badge that 0230 to 0234 queue, ids only:
--   verification.expiry_reminder, .expiry_to_refresh, .expiry_removed, .revoked_notice  (badge_id)
--   verification.dispute_received, .dispute_outcome                                    (dispute_id)
--   verification.reconfirm_required                                                    (review_id)
--   verification.agent_opened_notice                                                   (request_id)
-- No table, no data: one read, one more column on the read of 0227, and the grants they need.
--
--   leads.read_brevo_badge_email(outbox, worker)   on a line of brevo_transactional in processing for
--         THIS worker whose event is one of the eight: the facts of the e-mail, from the object the
--         payload names and the account the subject key names, never from the caller: level, network
--         line code, state of the object (a badge, a request, a dispute, a review), which decision a
--         dispute contests (a refusal or a withdrawal), the badge's expiry
--         and the end of its grace period (the reminder, « à rafraîchir »), the reason of the
--         withdrawal and the message to the member (a revoked badge), the reason of the decision a
--         dispute contests, the outcome code and the message of the team (a dispute outcome), the date
--         of the badge a successful dispute restored, the window of an appeal, the account's UI
--         language. Never a figure, a handle (old, new nor observed), the text of a dispute, the
--         agent, the lock nor an internal comment. No row for an object that is not the line's
--         account's or for an erased account. SECURITY DEFINER owned by influx_leads_definer, EXECUTE
--         for influx_worker ONLY.
--   leads.read_brevo_verification_email(outbox, worker)   recreated from 0227 with ONE more column,
--         dispute_window_days: the refusal of a creator now says the appeal is open (annex textes.md,
--         « le refus créateur existant gagne la même phrase »). Body, owner and EXECUTE unchanged.
--   influx_leads_definer   named columns, each with its policy limited to an account not erased:
--         verification.badges (+ id, revocation_request_id, dispute_id), badge_revocation_requests
--         (request, badge, account, reason, message), disputes (id, account, request, badge, level, network,
--         state, outcome reason, message of the team: never the creator's text, the agent, the lock nor
--         the internal comment), identifier_change_reviews (id, account, network, state: never a
--         handle), backoffice.operational_settings (badge_grace_days and dispute_window_days only).
--         Nothing for influx_advertiser.
--
-- EC-L2F-12 (micro-gaps, the safest choice):
--   EC-L2F-12-1  0236 is the next free number (ls supabase/migrations). A read of the worker needs a
--                grant and a function: the commit carries a migration although its title is « api ».
--   EC-L2F-12-2  the end of the grace period is computed here (expires_at + badge_grace_days) so that
--                the worker holds no parameter and reads no clock.
--   EC-L2F-12-3  one read for the eight e-mails (a line of another event type is 22023); the decision
--                to send or skip (a badge replaced or ended since the line was queued) is the
--                connector's.
--
-- ROLLBACK (before any of the eight lines is processed): drop function
-- leads.read_brevo_badge_email(bigint, text); recreate leads.read_brevo_verification_email() as in
-- 0227; drop the four *_leads_definer_select policies named below and revoke their grants.
-- =============================================================================

-- 1. What the reads read (03 P7: column by column, with its policy) ------------------------------------

-- badges_leads_definer_select (0227) already limits the rows to an account not erased
grant select (id, revocation_request_id, dispute_id) on verification.badges to influx_leads_definer;

grant select (dual_control_request_id, badge_id, account_id, reason_code, member_message)
   on verification.badge_revocation_requests to influx_leads_definer;
drop policy if exists badge_revocation_requests_leads_definer_select
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_leads_definer_select on verification.badge_revocation_requests
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = badge_revocation_requests.account_id and a.status <> 'deleted'));

-- never the text of the creator, the deciders, the lock nor the internal comment
grant select (id, account_id, request_id, badge_id, level, network_code, state,
              outcome_reason_code, member_message)
   on verification.disputes to influx_leads_definer;
drop policy if exists disputes_leads_definer_select on verification.disputes;
create policy disputes_leads_definer_select on verification.disputes
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = disputes.account_id and a.status <> 'deleted'));

-- never a handle (previous, new, observed), the lock nor the comment
grant select (id, account_id, network_code, state)
   on verification.identifier_change_reviews to influx_leads_definer;
drop policy if exists identifier_change_reviews_leads_definer_select
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_leads_definer_select on verification.identifier_change_reviews
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = identifier_change_reviews.account_id and a.status <> 'deleted'));

grant select (key, value) on backoffice.operational_settings to influx_leads_definer;
drop policy if exists operational_settings_leads_definer_select on backoffice.operational_settings;
create policy operational_settings_leads_definer_select on backoffice.operational_settings
  for select to influx_leads_definer
  using (key in ('badge_grace_days', 'dispute_window_days'));

-- 2. The read of the eight e-mails ---------------------------------------------------------------------

drop function if exists leads.read_brevo_badge_email(bigint, text);

create function leads.read_brevo_badge_email(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  level                text,
  network_code         text,
  object_state         text,
  contested_decision   text,
  badge_expires_at     timestamptz,
  grace_ends_at        timestamptz,
  reason_code          text,
  member_message       text,
  outcome_reason_code  text,
  restored_at          timestamptz,
  dispute_window_days  integer,
  preferred_language   text
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
  v_object   uuid;
  v_grace    integer;
  v_window   integer;
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker (as 0227)
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
  if v_line.destination <> 'brevo_transactional'
     or v_line.event_type not in ('verification.expiry_reminder', 'verification.expiry_to_refresh',
                                  'verification.expiry_removed', 'verification.revoked_notice',
                                  'verification.dispute_received', 'verification.dispute_outcome',
                                  'verification.reconfirm_required',
                                  'verification.agent_opened_notice') then
    raise exception 'a badge e-mail line of brevo_transactional only'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The account comes from the line, the object from its payload, never from the caller
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or pg_catalog.split_part(v_line.subject_key, ':', 2) !~ c_uuid then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;

  v_object := case
    when v_line.event_type in ('verification.expiry_reminder', 'verification.expiry_to_refresh',
                               'verification.expiry_removed', 'verification.revoked_notice')
      then case when (v_line.payload ->> 'badge_id') ~ c_uuid
                then (v_line.payload ->> 'badge_id')::uuid end
    when v_line.event_type in ('verification.dispute_received', 'verification.dispute_outcome')
      then case when (v_line.payload ->> 'dispute_id') ~ c_uuid
                then (v_line.payload ->> 'dispute_id')::uuid end
    when v_line.event_type = 'verification.reconfirm_required'
      then case when (v_line.payload ->> 'review_id') ~ c_uuid
                then (v_line.payload ->> 'review_id')::uuid end
    else case when (v_line.payload ->> 'request_id') ~ c_uuid
              then (v_line.payload ->> 'request_id')::uuid end
  end;
  if v_object is null then
    return;
  end if;

  select (s.value)::integer into v_grace
    from backoffice.operational_settings s where s.key = 'badge_grace_days';
  select (s.value)::integer into v_window
    from backoffice.operational_settings s where s.key = 'dispute_window_days';

  if v_line.event_type in ('verification.expiry_reminder', 'verification.expiry_to_refresh',
                           'verification.expiry_removed') then
    return query
    select b.level::text, b.network_code, b.state::text, null::text, b.expires_at,
           b.expires_at + pg_catalog.make_interval(days => v_grace),
           null::text, null::text, null::text, null::timestamptz, null::integer,
           a.preferred_language::text
      from verification.badges b
      join identity.accounts a on a.id = b.account_id
     where b.id = v_object and b.account_id = v_account and a.status <> 'deleted';

  elsif v_line.event_type = 'verification.revoked_notice' then
    return query
    select b.level::text, b.network_code, b.state::text, null::text, b.expires_at, null::timestamptz,
           q.reason_code, q.member_message, null::text, null::timestamptz, v_window,
           a.preferred_language::text
      from verification.badges b
      join identity.accounts a on a.id = b.account_id
      left join verification.badge_revocation_requests q
             on q.dual_control_request_id = b.revocation_request_id
     where b.id = v_object and b.account_id = v_account and a.status <> 'deleted';

  elsif v_line.event_type = 'verification.dispute_received' then
    return query
    select d.level::text, d.network_code, d.state::text, null::text, null::timestamptz, null::timestamptz,
           null::text, null::text, null::text, null::timestamptz, null::integer,
           a.preferred_language::text
      from verification.disputes d
      join identity.accounts a on a.id = d.account_id
     where d.id = v_object and d.account_id = v_account and a.status <> 'deleted';

  elsif v_line.event_type = 'verification.dispute_outcome' then
    -- the reason of the decision contested: the refusal's, or the withdrawal's (never the text of
    -- the creator); the badge a successful dispute restored gives its date
    return query
    select d.level::text, d.network_code, d.state::text,
           case when d.request_id is not null then 'refusal' else 'revocation' end,
           null::timestamptz, null::timestamptz,
           coalesce(r.rejection_reason_code, q.reason_code), d.member_message,
           d.outcome_reason_code, nb.granted_at, null::integer, a.preferred_language::text
      from verification.disputes d
      join identity.accounts a on a.id = d.account_id
      left join verification.verification_requests r
             on r.id = d.request_id and r.account_id = d.account_id
      left join verification.badges ob on ob.id = d.badge_id and ob.account_id = d.account_id
      left join verification.badge_revocation_requests q
             on q.dual_control_request_id = ob.revocation_request_id
      left join lateral (select x.granted_at
                           from verification.badges x
                          where x.dispute_id = d.id and x.account_id = d.account_id
                          order by x.granted_at desc
                          limit 1) nb on true
     where d.id = v_object and d.account_id = v_account and a.status <> 'deleted';

  elsif v_line.event_type = 'verification.reconfirm_required' then
    return query
    select 'account_verified'::text, w.network_code, w.state::text, null::text, null::timestamptz,
           null::timestamptz, null::text, null::text, null::text, null::timestamptz, null::integer,
           a.preferred_language::text
      from verification.identifier_change_reviews w
      join identity.accounts a on a.id = w.account_id
     where w.id = v_object and w.account_id = v_account and a.status <> 'deleted';

  else
    -- verification.agent_opened_notice
    return query
    select r.level::text, r.network_code, r.status::text, null::text, null::timestamptz, null::timestamptz,
           null::text, null::text, null::text, null::timestamptz, null::integer,
           a.preferred_language::text
      from verification.verification_requests r
      join identity.accounts a on a.id = r.account_id
     where r.id = v_object and r.account_id = v_account and a.status <> 'deleted';
  end if;
end
$$;

comment on function leads.read_brevo_badge_email(bigint, text) is
  'E-3 read of the e-mails of the life of the badge (08 RG94; D69; l2f/modele.md §4; 0236), on a '
  'verification.expiry_reminder, .expiry_to_refresh, .expiry_removed, .revoked_notice, '
  '.dispute_received, .dispute_outcome, .reconfirm_required or .agent_opened_notice line of '
  'brevo_transactional in processing for p_worker only (55000 otherwise; 22023 for another event or '
  'destination): level, network line code, state of the object the payload names, which decision a dispute contests (refusal or revocation), the badge expiry and '
  'the end of its grace period, the reason of the withdrawal or of the decision contested, the message '
  'to the member, the outcome code, the date of the badge restored, the window of an appeal and the '
  'account''s UI language. Never a figure, a handle, the creator''s text, the agent nor an internal '
  'comment. No row for an object that is not the line''s account''s or for an erased account. SECURITY '
  'DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 3. The read of the e-mails of the requests: one more column, dispute_window_days ---------------------

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
  preferred_language  text,
  dispute_window_days integer
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
         a.preferred_language::text,
         (select (s.value)::integer from backoffice.operational_settings s
           where s.key = 'dispute_window_days')
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
  'E-3 read of the verification e-mails (08 RG94; D69; EC-L2E-3; 0227, 0236), on a verification.received, '
  '.code_issued, .decision or .request_expired line of brevo_transactional in processing for '
  'p_worker only (55000 otherwise; 22023 for another event or destination): level, network line '
  'code, status, reason code, the agent''s message to the member, the badge''s date and expiry (a '
  'decision), the line''s code kind, expiry and revocation (a code_issued, named by its key), the '
  'account''s UI language, and (0236) the window of an appeal in days. Never the code, the handle, a '
  'figure, the period, the agent, the internal comment nor the evidence. No row for a request or code '
  'that is not the line''s account''s or for an erased account. SECURITY DEFINER owned by '
  'influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_brevo_verification_email(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function leads.read_brevo_badge_email(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brevo_verification_email(bigint, text) to influx_worker;
grant execute on function leads.read_brevo_badge_email(bigint, text) to influx_worker;

-- Hand the functions to influx_leads_definer (03 P7 rule 5, window of 0004 §9)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;

alter function leads.read_brevo_verification_email(bigint, text) owner to influx_leads_definer;
alter function leads.read_brevo_badge_email(bigint, text) owner to influx_leads_definer;

revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 4. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_fn   text;
  v_bad  text;
begin
  foreach v_fn in array array['leads.read_brevo_badge_email(bigint, text)',
                              'leads.read_brevo_verification_email(bigint, text)']
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_leads_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by influx_leads_definer, SECURITY DEFINER, empty search_path', v_fn;
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
  end loop;

  -- nothing of the new tables for the brand, and no handle nor text for the owner of the reads
  select string_agg(format('%s.%s', c.attrelid::regclass, c.attname), ', ') into v_bad
    from pg_catalog.pg_attribute c
   where c.attrelid in ('verification.badge_revocation_requests'::regclass,
                        'verification.disputes'::regclass,
                        'verification.identifier_change_reviews'::regclass)
     and c.attnum > 0 and not c.attisdropped
     and pg_catalog.has_column_privilege('influx_leads_definer', c.attrelid, c.attname,
                                         'SELECT, INSERT, UPDATE, REFERENCES')
     and (c.attrelid, c.attname) not in (
       select 'verification.badge_revocation_requests'::regclass, n from unnest(array[
         'dual_control_request_id', 'badge_id', 'account_id', 'reason_code', 'member_message']) n
       union all
       select 'verification.disputes'::regclass, n from unnest(array[
         'id', 'account_id', 'request_id', 'badge_id', 'level', 'network_code', 'state',
         'outcome_reason_code', 'member_message']) n
       union all
       select 'verification.identifier_change_reviews'::regclass, n from unnest(array[
         'id', 'account_id', 'network_code', 'state']) n);
  if v_bad is not null then
    raise exception 'influx_leads_definer reaches %', v_bad;
  end if;
  if exists (select 1 from pg_catalog.pg_class t
              where t.oid in ('verification.badge_revocation_requests'::regclass,
                              'verification.disputes'::regclass,
                              'verification.identifier_change_reviews'::regclass)
                and pg_catalog.has_table_privilege('influx_advertiser', t.oid,
                      'SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER')) then
    raise exception 'influx_advertiser reaches a table of the life of the badge';
  end if;
end
$$;
