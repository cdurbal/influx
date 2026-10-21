-- =============================================================================
-- 0146_leads_configuration_failures
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, commit D67-b. The worker half of D67 (architecte, 2026-10-17, arbitrage
-- (i); 05 RG160, RG161, RG162, RG164; 18 TM1.11 to TM1.15). A setting of INFLUX that a
-- line needs and that is missing is an incident, never a normal case: the connectors now
-- FAIL such a line, without retry (list_not_configured, apollo_settings_invalid, and
-- credentials_missing in a deployed environment), and the worker re-queues it by itself
-- once the setting in cause is corrected. What the base does for it:
--
--   leads.outbox_events.attempt_started_at   the start of the latest attempt, written by
--         leads.begin_outbox_attempt() with locked_at and KEPT after the outcome (locked_at
--         is cleared then): RG161 compares the date of the setting in cause with it.
--   leads.begin_outbox_attempt(bigint, text)   0141 restated verbatim but for
--         attempt_started_at: same signature, result, owner and grant.
--   leads.recover_stale_outbox_lines(integer)   0111 restated as the take-back STEP of E-3,
--         same signature, owner and single grantee (influx_worker): no new GRANT, no new
--         motif in 03 §P7 (D67 (i)); its result gains the reason and the code of each line
--         (DROP + CREATE: an OUT column cannot be added in place). Two take-backs:
--           (1) TM1.10, unchanged: the orphans of a stopped worker;
--           (2) 05 RG161, at most 200 FAILED contact lines per call (RG101), FOR UPDATE SKIP
--               LOCKED (safe across instances), whose cause was corrected after the START of
--               their attempt: list_not_configured once brevo_list_ids was modified,
--               apollo_settings_invalid once one of the three Apollo keys was, and
--               credentials_missing once a worker process started after that attempt (a key
--               is added by a redeployment only). The process hands its start for the call
--               (influx.worker_started_at, transaction-local, set by the caller: the start
--               instant that the database returned to its start step below); absent, no
--               credentials_missing line is re-queued. Margin: a setting dated up to 60 s
--               BEFORE the start of the attempt still re-queues it, a correction written before
--               that start but committed after it having been invisible to the attempt (the
--               date is the clock_timestamp() of the write, 0145, not its COMMIT); such a line
--               then waits until 60 s after that date, so that its next attempt starts after
--               it and the same modification never re-queues it twice (RG161: at most one new
--               failure per line and per modification). The connector stays the only judge:
--               nothing is validated here. The line: pending, attempts 0, unlocked, not
--               completed, as the replay of 0132 (its policy and guard), the SAME line and
--               idempotency key (RG102, RG76: no duplicate, no second welcome e-mail); its
--               cause kept; last_error_message names the setting, never a value (the trace on
--               the line: no human actor, no register line; the worker logs the motif
--               configuration_restored, the codes and the count).
--               Not template_not_configured: D69, no template id is read any more and no
--               connector gives the code; and a transactional line is replayed from its own
--               queue (EC-J8-20, Lot 5).
--   leads.apply_brevo_ids_from_environment(jsonb)   0145 restated as the START step of the
--         worker, same signature, behaviour, owner and single grantee, its result extended
--         (DROP + CREATE): the keys changed (D68), the seven worker keys in force after the
--         step, for the start check of 05 RG162 (read now, never cached, RG81), and the start
--         instant by the database clock. The UPDATE stays its last statement (EC-J8-28): the
--         settings are read before it, the list ids taken from the merge.
--   Reclassification (05 RG160): the lines and contact states skipped list_not_configured or
--         apollo_settings_invalid before D67 become failed with the same code; the start of
--         their attempt, not recorded then, is taken as its outcome (completed_at): at worst a
--         correction made during that attempt is missed, and the line is replayed by hand. The
--         lines skipped template_not_configured stay as they are (see above).
--
-- Rights: influx_leads_definer reads attempt_started_at and last_error_code and writes
-- attempt_started_at on leads.outbox_events, and reads updated_at on leads.sync_settings
-- (EC-J9-D67a: noted at D67-a for this commit). No right of an execution role changes.
--
-- EC-J9-D67b (micro-gaps, the safest choice):
--   EC-J9-D67b-1  the catch-up lives in the take-back (same signature, same grant) rather than
--                 in a function of its own, which a new GRANT would have required (D67 (i)).
--   EC-J9-D67b-2  the start of the process reaches the take-back through a transaction-local
--                 setting, its signature (and grant) unchanged; a malformed or future value is
--                 refused (22023).
--   EC-J9-D67b-3  margin of 60 s and wait until date + 60 s (above).
--   EC-J9-D67b-4  the configuration skips of before D67 are reclassified failed.
--
-- ROLLBACK (before any real use): restate leads.begin_outbox_attempt as in 0141,
-- leads.recover_stale_outbox_lines as in 0111 and leads.apply_brevo_ids_from_environment as
-- in 0145 (DROP + CREATE for the last two, owner influx_leads_definer, EXECUTE for
-- influx_worker only); revoke the column grants of section 2; drop index
-- leads.outbox_events_configuration_failures_idx; drop column attempt_started_at; the
-- reclassified lines stay failed (replayable by hand).
-- =============================================================================

-- 1. The start of the latest attempt, and the index of the catch-up --------------------------------------

alter table leads.outbox_events add column if not exists attempt_started_at timestamptz;

comment on column leads.outbox_events.attempt_started_at is
  'Start of the latest attempt (leads.begin_outbox_attempt, with locked_at), kept after its outcome '
  '(0146): 05 RG161 re-queues a configuration failure whose setting was modified after it. Null: no '
  'attempt yet. A line reclassified by 0146 holds its completed_at.';

-- 05 RG161: the catch-up reads the failed configuration lines once a minute; failed lines are kept
-- until handled (04 §8), so the queue is never scanned for them.
create index if not exists outbox_events_configuration_failures_idx
  on leads.outbox_events (id)
  where status = 'failed'
    and last_error_code in ('list_not_configured', 'apollo_settings_invalid', 'credentials_missing');
comment on index leads.outbox_events_configuration_failures_idx is
  'Catch-up of 05 RG161 in leads.recover_stale_outbox_lines() (0146): the failed lines of a '
  'configuration code. Partial: a few lines, none while the configuration is complete.';

-- 2. Rights of the owner ----------------------------------------------------------------------------------

grant select (attempt_started_at, last_error_code), update (attempt_started_at)
   on leads.outbox_events to influx_leads_definer;
grant select (updated_at) on leads.sync_settings to influx_leads_definer;

-- 3. Reclassification of the configuration skips of before D67 (05 RG160) ---------------------------------

update leads.contact_sync_states s
   set last_status = 'failed'
 where s.last_status = 'skipped'
   and s.last_error_code in ('list_not_configured', 'apollo_settings_invalid');

update leads.outbox_events o
   set status             = 'failed',
       skip_reason        = null,
       last_error_code    = o.skip_reason,
       last_error_message = 'Reclassified by 0146 (05 RG160): a missing setting is an incident, '
                            || 'never a normal case.',
       attempt_started_at = o.completed_at
 where o.status = 'skipped'
   and o.skip_reason in ('list_not_configured', 'apollo_settings_invalid');

-- 4. The three functions, as influx_leads_definer (03 P7 rule 5, window of 0004 §9) ------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
set role influx_leads_definer;

-- 4.1 The start of an attempt (0141 restated: attempt_started_at) -----------------------------------------

create or replace function leads.begin_outbox_attempt(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  attempt                         smallint,
  account_id                      uuid,
  account_status                  text,
  account_role                    text,
  declared_status                 text,
  country_code                    text,
  preferred_language              text,
  email_verified                  boolean,
  marketing_email_consent         boolean,
  commercial_prospection_consent  boolean,
  settings                        jsonb
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_attempt  smallint;
  v_subject  text;
  v_account  uuid;
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The attempt starts: counted (RG79), and its line kept from the take-back (locked_at). Only
  -- a line in processing for THIS worker: one taken back meanwhile, or by another instance, is
  -- not this worker's any more. 0146: its start is kept after the outcome (05 RG161).
  update leads.outbox_events o
     set attempts           = o.attempts + 1,
         locked_at          = pg_catalog.now(),
         attempt_started_at = pg_catalog.now()
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker
  returning o.attempts, o.subject_key into v_attempt, v_subject;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- The account comes from the line ("account:<uuid>"), never from the caller. Another kind of
  -- subject, or an unknown account, gives no account state: the caller skips with its reason.
  if pg_catalog.split_part(v_subject, ':', 1) = 'account' then
    v_account := pg_catalog.split_part(v_subject, ':', 2)::uuid;
  end if;

  return query
  select v_attempt,
         a.id,
         a.status::text,
         r.role::text,
         a.declared_status::text,
         a.country_code::text,
         a.preferred_language::text,
         case when a.id is not null then a.email_verified_at is not null end,
         -- RG37: the consent in force NOW, the latest event of its purpose (04 §10.1); at the
         -- same instant, a refusal wins (false sorts first). No event: null, i.e. no consent.
         (select c.granted
            from identity.consent_events c
           where c.account_id = a.id and c.purpose = 'marketing_email'
           order by c.occurred_at desc, c.granted
           limit 1),
         (select c.granted
            from identity.consent_events c
           where c.account_id = a.id and c.purpose = 'commercial_prospection'
           order by c.occurred_at desc, c.granted
           limit 1),
         -- 05 RG81: the settings read at EVERY consumption, never cached (EC-8, worker keys)
         (select coalesce(pg_catalog.jsonb_object_agg(s.key, s.value), '{}'::jsonb)
            from leads.sync_settings s
           where s.key in ('apollo_scope', 'apollo_legal_basis', 'apollo_excluded_countries',
                           'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids'))
    from (select v_account as id) k
    left join identity.accounts a on a.id = k.id
    left join identity.account_roles r on r.account_id = a.id;
end
$$;

-- 4.2 The take-back step: orphans (TM1.10) and the catch-up of 05 RG161 ----------------------------------

drop function leads.recover_stale_outbox_lines(integer);

create function leads.recover_stale_outbox_lines(
  p_stale_after_seconds  integer default 600
)
returns table (
  outbox_id       bigint,
  written_status  leads.outbox_status,
  reason          text,
  error_code      text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- RG101: a bounded batch per call
  c_batch       constant integer := 200;
  -- EC-J9-D67b-3: a correction committed after the start of an attempt but written before it
  c_margin      constant interval := interval '60 seconds';
  v_raw         text := nullif(pg_catalog.current_setting('influx.worker_started_at', true), '');
  v_started_at  timestamptz;
  v_lists_at    timestamptz;
  v_apollo_at   timestamptz;
begin
  -- The floor: a line still being processed must never be taken back. Its start refreshes
  -- locked_at, so the threshold must exceed one attempt (an external call of a few seconds, the
  -- outcome, statements bounded at 60 s by the statement_timeout of influx_worker_login, 0001),
  -- and the claim of a batch that no start has refreshed yet (50 lines at most, calls bounded at
  -- 10 seconds: 500 s). 600 seconds covers both; a line taken back too early is refused to its
  -- first worker (55000), never processed twice by the database.
  if p_stale_after_seconds is null or p_stale_after_seconds not between 600 and 86400 then
    raise exception 'the threshold is between 600 seconds (the floor) and 86400 seconds'
      using errcode = 'invalid_parameter_value';
  end if;
  -- The start of the calling process (EC-J9-D67b-2): for this call only, never in the future.
  if v_raw is not null then
    perform pg_catalog.set_config('influx.worker_started_at', '', true);
    begin
      v_started_at := v_raw::timestamptz;
    exception when others then
      raise exception 'influx.worker_started_at must be a timestamp with time zone'
        using errcode = 'invalid_parameter_value';
    end;
    if v_started_at > pg_catalog.now() then
      raise exception 'influx.worker_started_at is in the future'
        using errcode = 'invalid_parameter_value';
    end if;
  end if;

  -- (1) TM1.10: back to pending, nothing lost; without an attempt left, failed (RG79), with a
  -- cause in clear for the backoffice.
  return query
  with stale as (
    select o.id
      from leads.outbox_events o
     where o.status = 'processing'
       and o.locked_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_stale_after_seconds)
     order by o.id
       for update of o skip locked
  ), taken_back as (
    update leads.outbox_events u
       set status             = case when u.attempts >= 10 then 'failed'::leads.outbox_status
                                     else 'pending'::leads.outbox_status end,
           locked_by          = null,
           locked_at          = null,
           last_error_code    = 'worker_interrupted',
           last_error_message = 'Processing interrupted before its outcome was recorded: '
                                || 'the line was taken back.',
           completed_at       = case when u.attempts >= 10 then pg_catalog.now() end
      from stale
     where u.id = stale.id
    returning u.id, u.status
  )
  select t.id, t.status, 'worker_interrupted'::text, null::text from taken_back t order by t.id;

  -- (2) 05 RG161: the dates of the settings in cause, kept by the base whatever the path (0145)
  select max(s.updated_at) filter (where s.key = 'brevo_list_ids'),
         max(s.updated_at) filter (where s.key in ('apollo_scope', 'apollo_legal_basis',
                                                   'apollo_excluded_countries'))
    into v_lists_at, v_apollo_at
    from leads.sync_settings s
   where s.key in ('brevo_list_ids', 'apollo_scope', 'apollo_legal_basis',
                   'apollo_excluded_countries');

  return query
  with restored as (
    select o.id, o.last_error_code as code,
           case o.last_error_code
             when 'list_not_configured' then v_lists_at
             when 'apollo_settings_invalid' then v_apollo_at
           end as setting_at
      from leads.outbox_events o
     where o.status = 'failed'
       and o.destination in ('brevo_contact', 'apollo_contact')
       and o.last_error_code in ('list_not_configured', 'apollo_settings_invalid',
                                 'credentials_missing')
       and o.attempt_started_at is not null
       and case o.last_error_code
             when 'list_not_configured'
               then v_lists_at > o.attempt_started_at - c_margin
             when 'apollo_settings_invalid'
               then v_apollo_at > o.attempt_started_at - c_margin
             else v_started_at > o.attempt_started_at
           end
     order by o.id
     limit c_batch
       for update of o skip locked
  ), requeued as (
    -- the replay of 0132 (policy outbox_events_leads_definer_replay, guard of the table)
    update leads.outbox_events u
       set status             = 'pending'::leads.outbox_status,
           attempts           = 0,
           available_at       = greatest(pg_catalog.now(),
                                         coalesce(r.setting_at + c_margin, pg_catalog.now())),
           completed_at       = null,
           last_error_message = 'Re-queued by the worker (configuration_restored): '
                                || case r.code
                                     when 'list_not_configured' then 'brevo_list_ids'
                                     when 'apollo_settings_invalid' then 'the Apollo settings'
                                     else 'a new worker process'
                                   end
                                || ' changed since the failed attempt.'
      from restored r
     where u.id = r.id
       and u.status = 'failed'
    returning u.id, u.status, r.code
  )
  select q.id, q.status, 'configuration_restored'::text, q.code from requeued q order by q.id;
end
$$;

comment on function leads.recover_stale_outbox_lines(integer) is
  'E-3 take-back step (TM1.10; 05 RG161, 0146), at the start of the worker then at most once a '
  'minute. (1) Every line in processing whose locked_at is older than the threshold (600 s by '
  'default, 600 to 86400) goes back to pending, or to failed without an attempt left (RG79), cause '
  'worker_interrupted; lines locked by a running transaction are skipped. (2) At most 200 FAILED '
  'contact lines of a configuration code go back to pending, attempts 0, the same line and '
  'idempotency key: list_not_configured once brevo_list_ids, apollo_settings_invalid once an Apollo '
  'key, was modified after the start of the failed attempt (60 s of margin, the line then waiting '
  'until 60 s after that date), credentials_missing once influx.worker_started_at (the start of the '
  'calling process, transaction-local, read and cleared here; malformed or future: 22023) is after '
  'it. Returns (line id, written status, reason worker_interrupted | configuration_restored, the '
  'code re-queued or null). SECURITY DEFINER owned by influx_leads_definer, empty search_path; '
  'EXECUTE for influx_worker ONLY.';

revoke all on function leads.recover_stale_outbox_lines(integer) from public;
grant execute on function leads.recover_stale_outbox_lines(integer) to influx_worker;

-- 4.3 The start step of the worker (0145 restated: the settings in force, the start instant) ---------------

drop function leads.apply_brevo_ids_from_environment(jsonb);

create function leads.apply_brevo_ids_from_environment(p_list_ids jsonb)
returns table (
  changed_keys  text[],
  settings      jsonb,
  started_at    timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c_list_keys constant text[] := array['advertisers', 'creators'];
  v_settings  jsonb;
  v_previous  jsonb;
  v_next      jsonb;
begin
  if p_list_ids is null or pg_catalog.jsonb_typeof(p_list_ids) <> 'object' then
    raise exception 'the brevo_list_ids given must be an object' using errcode = 'invalid_parameter_value';
  end if;
  -- a closed list of sub-keys, each a positive integer: never NULL (05 RG163)
  if exists (select 1 from pg_catalog.jsonb_each(p_list_ids) e
              where not (e.key = any (c_list_keys))
                 or pg_catalog.jsonb_typeof(e.value) <> 'number'
                 or (e.value #>> '{}')::numeric < 1
                 or (e.value #>> '{}')::numeric <> pg_catalog.floor((e.value #>> '{}')::numeric)) then
    raise exception 'the brevo_list_ids given hold an unknown key or a value that is not a positive integer'
      using errcode = 'invalid_parameter_value';
  end if;

  -- 05 RG162: the worker keys in force, read now as leads.begin_outbox_attempt() reads them (RG81)
  select coalesce(pg_catalog.jsonb_object_agg(s.key, s.value), '{}'::jsonb) into v_settings
    from leads.sync_settings s
   where s.key in ('apollo_scope', 'apollo_legal_basis', 'apollo_excluded_countries',
                   'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids');

  if p_list_ids = '{}'::jsonb then
    return query select array[]::text[], v_settings, pg_catalog.now();
    return;
  end if;

  select s.value into v_previous
    from leads.sync_settings s
   where s.key = 'brevo_list_ids'
     for update;
  if not found then
    raise exception 'brevo_list_ids is missing from leads.sync_settings'
      using errcode = 'invalid_parameter_value';
  end if;

  v_next := v_previous || p_list_ids;
  v_settings := v_settings || pg_catalog.jsonb_build_object('brevo_list_ids', v_next);
  if v_next = v_previous then
    return query select array[]::text[], v_settings, pg_catalog.now();
    return;
  end if;

  -- D67 (v), 0145: the journal trigger of leads.sync_settings writes the register line of this
  -- UPDATE, the last statement (EC-J8-28); this function only hands it the reason, for this write
  perform pg_catalog.set_config('influx.sync_setting_change',
                                pg_catalog.jsonb_build_object('key', 'brevo_list_ids',
                                                              'reason_code', 'environment')::text,
                                true);
  update leads.sync_settings
     set value = v_next, updated_by_account_id = null
   where key = 'brevo_list_ids';
  return query select array['brevo_list_ids'], v_settings, pg_catalog.now();
end
$$;

comment on function leads.apply_brevo_ids_from_environment(jsonb) is
  'The start step of the worker (D68, amended by D69; 05 RG162, 0146). p_list_ids: {advertisers?, '
  'creators?}, each a positive integer; only the GIVEN sub-keys are merged, never NULL (05 RG163); '
  '{} writes nothing. A change is journaled by the trigger of leads.sync_settings (0145): '
  'settings.changed {key, from, to, reason_code environment} on '
  'md5(''leads.sync_settings:brevo_list_ids'')::uuid (EC-J8-28), the reason handed through '
  'influx.sync_setting_change; updated_by_account_id reset to NULL. Returns the keys changed, the '
  'seven worker keys in force after the step (the start check of RG162, read now, RG81) and the '
  'start instant (now()), that the worker hands back to the take-back (RG161). Refusal: 22023. '
  'SECURITY DEFINER owned by influx_leads_definer; EXECUTE for influx_worker ONLY.';

revoke all on function leads.apply_brevo_ids_from_environment(jsonb) from public;
grant execute on function leads.apply_brevo_ids_from_environment(jsonb) to influx_worker;

reset role;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 5. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  c_fns constant text[] := array[
    'leads.begin_outbox_attempt(bigint, text)',
    'leads.recover_stale_outbox_lines(integer)',
    'leads.apply_brevo_ids_from_environment(jsonb)'];
  v_fn   text;
  v_bad  text;
begin
  foreach v_fn in array c_fns loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_leads_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_leads_definer, empty search_path', v_fn;
    end if;
    -- E-3: EXECUTE for influx_worker only, besides the owner; never PUBLIC (D67 (i): no new grant)
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
    if not pg_catalog.has_function_privilege('influx_worker', v_fn, 'EXECUTE') then
      raise exception '% lost its grant to influx_worker', v_fn;
    end if;
  end loop;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'leads'
                and p.proname in ('recover_stale_outbox_lines', 'apply_brevo_ids_from_environment')
                and p.oid not in ('leads.recover_stale_outbox_lines(integer)'::regprocedure,
                                  'leads.apply_brevo_ids_from_environment(jsonb)'::regprocedure)) then
    raise exception 'an older form of the take-back or of the start step survived';
  end if;

  -- influx_worker holds no right on any table of ours: E-3 goes through the functions (03 P7)
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('influx', 'reference', 'identity', 'audit', 'billing', 'backoffice', 'leads',
                       'profiles', 'verification', 'campaigns', 'search', 'matching', 'messaging',
                       'ops')
     and c.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
     and (pg_catalog.has_table_privilege('influx_worker', c.oid, 'SELECT, INSERT, UPDATE, DELETE, '
                                         'TRUNCATE, REFERENCES, TRIGGER')
          or (c.relkind <> 'S'
              and pg_catalog.has_any_column_privilege('influx_worker', c.oid,
                                                      'SELECT, INSERT, UPDATE, REFERENCES')));
  if v_bad is not null then
    raise exception 'influx_worker holds a table right: %', v_bad;
  end if;

  -- no configuration skip left (05 RG160)
  if exists (select 1 from leads.outbox_events
              where status = 'skipped'
                and skip_reason in ('list_not_configured', 'apollo_settings_invalid')) then
    raise exception 'a configuration skip survived the reclassification';
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
