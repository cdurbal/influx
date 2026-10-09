-- =============================================================================
-- 0111_leads_drain_outbox
-- -----------------------------------------------------------------------------
-- Lot 1 / J6, commit 2. E-3 `leads.drain_outbox` (03 P7): the database half of
-- the synchronisation worker. influx_worker holds NO table right: it calls four
-- SECURITY DEFINER functions owned by influx_leads_definer, and nothing else.
--
--   leads.claim_outbox_batch()         the CLAIM (02 §6): up to p_limit lines (20
--                                      by default, 50 at most), pending and
--                                      available, ordered by priority,
--                                      available_at, id, FOR UPDATE SKIP LOCKED,
--                                      put in processing for one worker. Per
--                                      (subject_key, destination), one line at a
--                                      time, the first in (priority, id) order
--                                      (RG77, RG78, RG75).
--   leads.begin_outbox_attempt()       the START of an attempt on a line in
--                                      processing for this worker: counts the
--                                      attempt, refreshes locked_at, returns the
--                                      state read AT CONSUMPTION (RG37): account,
--                                      consents, the settings of EC-8.
--   leads.complete_outbox_attempt()    the OUTCOME: succeeded | skipped + reason |
--                                      pending + delay | failed + cause; live only,
--                                      the contact state (04 §10.7) and the journal
--                                      line of the welcome e-mail (16 RG94, P1).
--   leads.recover_stale_outbox_lines() the TAKE-BACK of the lines a stopped worker
--                                      left in processing (TM1.10), past a
--                                      threshold of 600 seconds at least.
--
-- Also: the column dry_run and its two constraints (decision 2 of the architect,
-- J6); the bound "a waiting line always has an attempt left" (RG79); the index of
-- the RG77 check; the register code elevated.leads.drain_outbox and, for
-- influx_worker, USAGE on audit and EXECUTE on audit.append_elevated() (EC-52 (3):
-- the journal line of the welcome e-mail is a subject, the claim and the outcome
-- of a queue line are not).
--
-- Choices, detailed where they apply:
--   owner     a DEDICATED role, created here by the rules of 0001: the identity
--             definer writes accounts, roles, sessions and factors; the worker's
--             functions must neither inherit those rights nor lend it theirs.
--   attempts  counted at the START of an attempt, never at the claim: a line that
--             brings the worker down is counted each time (failed after ten,
--             through the take-back), the other lines of its batch are not.
--   RG77      in the claim itself: G4 forbids holding a transaction (hence a
--             transaction advisory lock, 02 §6) around the external call.
--
-- Not here: the replay of a failed line (J8, with 0102 and 0107), the mapping of
-- the contact attributes (commits 4 and 5, with their own read if needed), any
-- column saying what a dry run would have sent (pino only, decision 3).
--
-- ROLLBACK (before any real processing): drop the four functions; revoke usage on
-- schemas leads and audit from influx_worker, and EXECUTE on
-- audit.append_elevated(text, uuid) through the window of 0006 §9; drop the
-- policies *_leads_definer_* and revoke the column grants of influx_leads_definer;
-- drop index leads.outbox_events_subject_live_idx; drop the constraints
-- outbox_events_pending_has_attempt_left, outbox_events_dry_run_succeeded_only,
-- outbox_events_dry_run_no_provider_ids and the column dry_run; delete the code
-- elevated.leads.drain_outbox (possible only while no line uses it); then, in
-- every database of the cluster, drop owned by influx_leads_definer; drop role
-- influx_leads_definer.
-- =============================================================================

-- 1. The owner of the four functions (03 P7 rule 5; rules 1 and 2 of 0001) --------------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_leads_definer') then
    create role influx_leads_definer with nologin noinherit;
  end if;
  -- Re-impose the attributes on a pre-existing role instead of inheriting them (0001 §1).
  alter role influx_leads_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_leads_definer' and rolsuper) then
    raise exception 'role influx_leads_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_leads_definer' and rolbypassrls) then
    alter role influx_leads_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_leads_definer' and rolreplication) then
    alter role influx_leads_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_leads_definer' and rolcreatedb) then
    alter role influx_leads_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_leads_definer' and rolcreaterole) then
    alter role influx_leads_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. The dry_run marker, the attempt bound, the index of the RG77 check ---------------------

alter table leads.outbox_events add column if not exists dry_run boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'outbox_events_dry_run_succeeded_only'
                    and conrelid = 'leads.outbox_events'::regclass) then
    alter table leads.outbox_events
      add constraint outbox_events_dry_run_succeeded_only
      check (not dry_run or status = 'succeeded');
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'outbox_events_dry_run_no_provider_ids'
                    and conrelid = 'leads.outbox_events'::regclass) then
    alter table leads.outbox_events
      add constraint outbox_events_dry_run_no_provider_ids
      check (not dry_run or (provider_message_id is null and provider_contact_id is null));
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'outbox_events_pending_has_attempt_left'
                    and conrelid = 'leads.outbox_events'::regclass) then
    alter table leads.outbox_events
      add constraint outbox_events_pending_has_attempt_left
      check (status <> 'pending' or attempts < 10);
  end if;
end
$$;

comment on column leads.outbox_events.dry_run is
  'True when the success was SIMULATED (decision 2 of the architect, J6; 02 §12.4): qualification, '
  'mapping and output control ran as in live, no provider was called. A dry run writes neither '
  'leads.contact_sync_states nor leads.transactional_sends: no false success anywhere. A rejection '
  'in dry run is the same failed line as in live, unmarked. What it would have sent goes to pino, '
  'never to a column (decision 3).';
comment on constraint outbox_events_dry_run_succeeded_only on leads.outbox_events is
  'Only a success can be simulated: a skip or a failure in dry run is a real outcome of the '
  'qualification or of the output control.';
comment on constraint outbox_events_dry_run_no_provider_ids on leads.outbox_events is
  'A simulated success reached no provider, so it holds no provider id.';
comment on constraint outbox_events_pending_has_attempt_left on leads.outbox_events is
  'RG79: a waiting line always has an attempt left. The tenth transient failure is definitive '
  '(leads.complete_outbox_attempt writes failed), an orphan without attempt left is failed by the '
  'take-back, and a replay (J8) gives the line a new series. Without it, a line pending at ten '
  'attempts could never be started again (attempts <= 10).';
comment on column leads.outbox_events.attempts is
  'Attempts STARTED (leads.begin_outbox_attempt), never claims: a line that brings the worker down '
  'is counted at each start and fails after ten (RG79), the other lines of its batch are not.';
comment on column leads.outbox_events.subject_key is
  'Ordering key "<type>:<uuid>" (account:..., introduction:...): per (subject_key, destination), the '
  'claim takes one line at a time, the first in (priority, id) order, none while one is in '
  'processing (05 RG77, RG78; 0111). The account of a line is read from it, never from a caller.';
comment on column leads.outbox_events.locked_by is
  'Worker instance that holds the line in processing: the start and the outcome of an attempt are '
  'refused to any other (0111). The claim lock itself is FOR UPDATE SKIP LOCKED.';
comment on column leads.outbox_events.locked_at is
  'Claim, then start of the current attempt (refreshed by leads.begin_outbox_attempt): the take-back '
  'of orphans compares it with its threshold (TM1.10).';

-- 04 §7.4 counted three indexes. This fourth one serves a query that did not exist then: the RG77
-- check of the claim, run for every candidate line every 2 seconds. It holds the live part of the
-- queue only (pending and processing), a few lines per subject, and also serves the take-back.
create index if not exists outbox_events_subject_live_idx
  on leads.outbox_events (subject_key, destination)
  where status in ('pending', 'processing');
comment on index leads.outbox_events_subject_live_idx is
  'RG77 check of leads.claim_outbox_batch(): is a line of the same (subject_key, destination) in '
  'processing, or pending ahead in (priority, id) order? Partial on the live lines only.';

-- 3. The register code of the elevated operation (EC-36, EC-52) ------------------------------

-- EC-52 (3): withElevatedTransaction writes the line if and only if the transaction returns a
-- subject. For E-3, the claim is a reservation and the outcome of a queue line closes an existing
-- line: no subject. The journal line of the welcome e-mail (leads.transactional_sends) is an
-- insertion: its subject is the account, as for identity.verify_code (EC-52 (2)).
insert into audit.event_types (code, domain, subject_type, severity) values
  ('elevated.leads.drain_outbox', 'leads', 'account', 'sensitive')
on conflict (code) do nothing;

-- 4. The four functions ---------------------------------------------------------------------------

-- 4.1 The claim ---------------------------------------------------------------------------------

create or replace function leads.claim_outbox_batch(
  p_worker  text,
  p_limit   integer default 20
)
returns table (
  outbox_id        bigint,
  event_id         uuid,
  event_type       text,
  destination      leads.outbox_destination,
  subject_key      text,
  priority         smallint,
  payload          jsonb,
  idempotency_key  text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  -- The worker instance: the key of the start and of the outcome, and observability.
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;
  -- 20 by default (02 §6). At most 50: a full batch of external calls bounded at 10 seconds
  -- stays under the floor of the take-back (600 s, leads.recover_stale_outbox_lines).
  if p_limit is null or p_limit not between 1 and 50 then
    raise exception 'the batch size is between 1 and 50' using errcode = 'invalid_parameter_value';
  end if;

  return query
  with picked as (
    select o.id
      from leads.outbox_events o
     where o.status = 'pending'
       and o.available_at <= pg_catalog.now()
       -- RG77, RG78, RG75: per (subject_key, destination), the first pending line in
       -- (priority, id) order, and none while a line of the pair is in processing. An earlier
       -- line of the same priority goes first even while it waits for a retry (a creation
       -- precedes an update); a more urgent line goes first even when emitted later (a priority
       -- 0 revocation passes a creation waiting for a retry, never another priority 0 line).
       -- Two takers: a line locked by the other is SKIPPED, and still holds its pair here.
       and not exists (
             select 1
               from leads.outbox_events e
              where e.subject_key = o.subject_key
                and e.destination = o.destination
                and e.status in ('pending', 'processing')
                and (e.status = 'processing' or (e.priority, e.id) < (o.priority, o.id)))
     order by o.priority, o.available_at, o.id
     limit p_limit
       for update of o skip locked
  ), claimed as (
    update leads.outbox_events u
       set status    = 'processing',
           locked_by = p_worker,
           locked_at = pg_catalog.now()
      from picked
     where u.id = picked.id
    returning u.id, u.event_id, u.event_type, u.destination, u.subject_key, u.priority,
              u.payload, u.idempotency_key, u.available_at
  )
  select c.id, c.event_id, c.event_type, c.destination, c.subject_key, c.priority, c.payload,
         c.idempotency_key
    from claimed c
   order by c.priority, c.available_at, c.id;
end
$$;

comment on function leads.claim_outbox_batch(text, integer) is
  'E-3 claim (02 §6): up to p_limit lines (20 by default, 1 to 50), pending with available_at <= '
  'now(), in priority, available_at, id order, FOR UPDATE SKIP LOCKED, set to processing with '
  'locked_by = p_worker. One line per (subject_key, destination) at a time, the first in (priority, '
  'id) order, none while one is in processing (RG77, RG78, RG75). attempts is NOT counted here. '
  'Returns what the loop needs, identifiers only (05 RG74): line id, fact, destination, subject, '
  'priority, payload, idempotency key. 22023 for a malformed worker or batch size. SECURITY DEFINER '
  'owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.2 The start of an attempt ---------------------------------------------------------------------

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
  -- not this worker's any more.
  update leads.outbox_events o
     set attempts  = o.attempts + 1,
         locked_at = pg_catalog.now()
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
           where s.key in ('apollo_scope', 'apollo_legal_basis', 'apollo_prospecting_countries',
                           'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids'))
    from (select v_account as id) k
    left join identity.accounts a on a.id = k.id
    left join identity.account_roles r on r.account_id = a.id;
end
$$;

comment on function leads.begin_outbox_attempt(bigint, text) is
  'E-3 start of an attempt, called FIRST for each claimed line: on a line in processing for p_worker '
  'only (55000 otherwise), counts the attempt (returned, 1 to 10) and refreshes locked_at, then '
  'returns the state read AT CONSUMPTION (05 RG37, RG80): the account taken from the subject of the '
  'line (status, role, declared status, country, language, address verified), the marketing_email '
  'and commercial_prospection consents in force (latest event; a refusal wins a tie; null = none), '
  'and the seven worker keys of leads.sync_settings (EC-8). No address, no name, no contact '
  'attribute: the mapping (commits 4 and 5) reads them by its own means. SECURITY DEFINER owned by '
  'influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.3 The outcome ---------------------------------------------------------------------------------

create or replace function leads.complete_outbox_attempt(
  p_outbox_id            bigint,
  p_worker               text,
  p_status               leads.outbox_status,
  p_dry_run              boolean,
  p_skip_reason          text    default null,
  p_error_code           text    default null,
  p_error_message        text    default null,
  p_retry_in_seconds     integer default null,
  p_provider_message_id  text    default null,
  p_provider_contact_id  text    default null,
  p_locale               text    default null,
  p_template_version     integer default null
)
returns table (
  written_status    leads.outbox_status,
  journal_inserted  boolean,
  account_id        uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line     record;
  v_account  uuid;
  v_status   leads.outbox_status := p_status;
  v_message  text;
  v_cause    text;
  v_journal  boolean := false;
begin
  -- 1. One shape per outcome, checked before the line is even looked for.
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_status is null or p_status = 'processing' then
    raise exception 'an outcome is succeeded, skipped, pending or failed'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_dry_run is null then
    raise exception 'dry_run is explicit: true or false' using errcode = 'invalid_parameter_value';
  end if;
  if (p_status = 'skipped') <> (p_skip_reason is not null) then
    raise exception 'a skip reason goes with skipped, and only with it'
      using errcode = 'invalid_parameter_value';
  end if;
  if (p_status in ('pending', 'failed')) <> (p_error_code is not null)
     or (p_error_message is not null and p_error_code is null) then
    raise exception 'a cause (and its message) goes with pending or failed, and only with them'
      using errcode = 'invalid_parameter_value';
  end if;
  if (p_status = 'pending') <> (p_retry_in_seconds is not null)
     or p_retry_in_seconds not between 0 and 172800 then
    raise exception 'a delay of 0 to 172800 seconds goes with pending, and only with it'
      using errcode = 'invalid_parameter_value';
  end if;
  if (p_status <> 'succeeded' or p_dry_run)
     and (p_provider_message_id is not null or p_provider_contact_id is not null
          or p_locale is not null or p_template_version is not null) then
    raise exception 'provider ids and the description of a send go with a live success only'
      using errcode = 'invalid_parameter_value';
  end if;

  -- 2. The line: in processing for THIS worker, locked until the end of the transaction. A line
  -- taken back meanwhile (leads.recover_stale_outbox_lines) is refused, never closed twice.
  select o.destination, o.subject_key, o.payload, o.attempts
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker
     for update;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if pg_catalog.split_part(v_line.subject_key, ':', 1) = 'account' then
    v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;
  end if;

  -- 3. What fits the destination.
  if v_line.destination = 'brevo_transactional' then
    if p_provider_contact_id is not null then
      raise exception 'a transactional line has no contact id' using errcode = 'invalid_parameter_value';
    end if;
    if p_status = 'succeeded' and not p_dry_run then
      -- 16 RG94: the messageId of every transactional e-mail is kept, with its language
      if p_provider_message_id is null or p_locale is null then
        raise exception 'a transactional success names its messageId and its language'
          using errcode = 'invalid_parameter_value';
      end if;
      if (v_line.payload ->> 'email_code') is null then
        raise exception 'the queue line names no e-mail code' using errcode = 'invalid_parameter_value';
      end if;
      v_journal := v_account is not null;
    end if;
  elsif p_provider_message_id is not null or p_locale is not null or p_template_version is not null then
    raise exception 'a contact line has no message id and journals no send'
      using errcode = 'invalid_parameter_value';
  end if;

  -- 4. RG79: the tenth attempt does not wait, it fails with the cause of its last error.
  if v_status = 'pending' and v_line.attempts >= 10 then
    v_status := 'failed';
  end if;

  -- 5. The cause in clear (05 RG99): one line, at most 1000 characters, never an address (0101).
  if p_error_message is not null then
    v_message := pg_catalog.regexp_replace(p_error_message, '[[:cntrl:]]+', ' ', 'g');
    v_message := pg_catalog.regexp_replace(
      v_message, '[^[:space:]@<>(),;:"'']+@[^[:space:]@<>(),;:"'']+', '[address]', 'g');
    v_message := nullif(pg_catalog.left(pg_catalog.btrim(v_message), 1000), '');
  end if;

  -- 6. The line. The lock is released whatever the outcome; only pending waits again.
  update leads.outbox_events o
     set status              = v_status,
         dry_run             = (p_dry_run and v_status = 'succeeded'),
         skip_reason         = case when v_status = 'skipped' then p_skip_reason end,
         last_error_code     = case when v_status in ('pending', 'failed') then p_error_code end,
         last_error_message  = case when v_status in ('pending', 'failed') then v_message end,
         available_at        = case when v_status = 'pending'
                                    then pg_catalog.now()
                                         + pg_catalog.make_interval(secs => p_retry_in_seconds)
                                    else o.available_at end,
         provider_message_id = p_provider_message_id,
         provider_contact_id = p_provider_contact_id,
         locked_by           = null,
         locked_at           = null,
         completed_at        = case when v_status = 'pending' then null else pg_catalog.now() end
   where o.id = p_outbox_id;

  -- 7. The side tables, live only: a dry run claims no success anywhere (decision 2).
  if not p_dry_run and v_account is not null then
    if v_line.destination <> 'brevo_transactional' then
      -- 04 §10.7: the state of the contact per destination, whatever the outcome. The channel of
      -- the sign-in code never has one (0101, contact_sync_states_no_transactional). The update
      -- names the values themselves, not EXCLUDED: reading EXCLUDED needs SELECT on its columns.
      v_cause := case v_status when 'skipped' then p_skip_reason
                               when 'succeeded' then null
                               else p_error_code end;
      if exists (select 1 from identity.accounts a where a.id = v_account) then
        insert into leads.contact_sync_states as s
          (account_id, destination, external_contact_id, last_attempt_at, last_success_at,
           last_status, last_error_code)
        values
          (v_account, v_line.destination, p_provider_contact_id, pg_catalog.now(),
           case when v_status = 'succeeded' then pg_catalog.now() end, v_status, v_cause)
        on conflict (account_id, destination) do update
           set external_contact_id = coalesce(p_provider_contact_id, s.external_contact_id),
               last_attempt_at     = pg_catalog.now(),
               last_success_at     = case when v_status = 'succeeded' then pg_catalog.now()
                                          else s.last_success_at end,
               last_status         = v_status,
               last_error_code     = v_cause;
      end if;
    elsif v_journal then
      -- 16 RG94, 0015: the welcome e-mail that LEFT, as a P1 line tied to its queue line. The
      -- e-mail code comes from the line, never from the caller; the template version is COPIED
      -- (04 R7) when the caller names it.
      insert into leads.transactional_sends
        (email_code, priority, account_id, locale, template_ref, template_version,
         outbox_event_id, provider_message_id, status, sent_at)
      values
        (v_line.payload ->> 'email_code', 'p1', v_account, p_locale,
         case when p_template_version is not null then v_line.payload ->> 'email_code' end,
         p_template_version, p_outbox_id, p_provider_message_id, 'sent', pg_catalog.now());
    end if;
  end if;

  return query select v_status, v_journal, v_account;
end
$$;

comment on function leads.complete_outbox_attempt(bigint, text, leads.outbox_status, boolean, text,
    text, text, integer, text, text, text, integer) is
  'E-3 outcome, on a line in processing for p_worker only (55000 otherwise). succeeded (provider ids '
  'in live; for brevo_transactional, the messageId and the language are required) | skipped + reason '
  '| pending + cause + delay in seconds (0 to 172800, from the server clock) | failed + cause; any '
  'other shape is 22023, RG35 stays a 23514. p_dry_run is explicit: true marks a success as '
  'simulated and writes no side table. A pending outcome at the tenth attempt is written failed '
  '(RG79). The message of a cause is cut to one line of 1000 characters, addresses redacted. Live: '
  'the contact state of a contact line (any outcome, known account), the P1 journal line of a '
  'transactional success. Returns (written status, journal line inserted, account of the subject): '
  'a journal line is the subject of the register line elevated.leads.drain_outbox (EC-52 (3)). '
  'SECURITY DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.4 The take-back of orphans ---------------------------------------------------------------------

create or replace function leads.recover_stale_outbox_lines(
  p_stale_after_seconds  integer default 600
)
returns table (
  outbox_id       bigint,
  written_status  leads.outbox_status
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
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

  return query
  with stale as (
    select o.id
      from leads.outbox_events o
     where o.status = 'processing'
       and o.locked_at < pg_catalog.now() - pg_catalog.make_interval(secs => p_stale_after_seconds)
     order by o.id
       for update of o skip locked
  ), taken_back as (
    -- TM1.10: back to pending, nothing lost; without an attempt left, failed (RG79), with a
    -- cause in clear for the backoffice.
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
  select t.id, t.status from taken_back t order by t.id;
end
$$;

comment on function leads.recover_stale_outbox_lines(integer) is
  'E-3 take-back (TM1.10): every line in processing whose locked_at is older than the threshold '
  '(600 s by default, 600 to 86400) goes back to pending, or to failed without an attempt left '
  '(RG79), with the cause worker_interrupted; lines locked by a running transaction are skipped. '
  'Returns (line id, written status). Called at the start of the worker and between batches. '
  'SECURITY DEFINER owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 4.5 Publication: influx_worker only (E-3) -------------------------------------------------------

revoke all on function leads.claim_outbox_batch(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function leads.begin_outbox_attempt(bigint, text)
  from public, anon, authenticated, service_role;
revoke all on function leads.complete_outbox_attempt(bigint, text, leads.outbox_status, boolean,
    text, text, text, integer, text, text, text, integer)
  from public, anon, authenticated, service_role;
revoke all on function leads.recover_stale_outbox_lines(integer)
  from public, anon, authenticated, service_role;

grant execute on function leads.claim_outbox_batch(text, integer) to influx_worker;
grant execute on function leads.begin_outbox_attempt(bigint, text) to influx_worker;
grant execute on function leads.complete_outbox_attempt(bigint, text, leads.outbox_status, boolean,
    text, text, text, integer, text, text, text, integer) to influx_worker;
grant execute on function leads.recover_stale_outbox_lines(integer) to influx_worker;

-- 5. Rights of the owner: what the four functions read and write, nothing more ----------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner.

grant usage on schema leads, identity to influx_leads_definer;

-- the queue: the description read, the processing columns written
grant select (id, event_id, event_type, destination, subject_key, priority, payload,
              idempotency_key, status, attempts, available_at, locked_by, locked_at)
   on leads.outbox_events to influx_leads_definer;
grant update (status, attempts, available_at, skip_reason, last_error_code, last_error_message,
              provider_message_id, provider_contact_id, locked_by, locked_at, completed_at, dry_run)
   on leads.outbox_events to influx_leads_definer;

drop policy if exists outbox_events_leads_definer_select on leads.outbox_events;
create policy outbox_events_leads_definer_select on leads.outbox_events
  for select to influx_leads_definer
  using (true);

-- a closed line (succeeded, skipped, failed) is never touched again by the worker; a line is
-- locked if and only if it is in processing
drop policy if exists outbox_events_leads_definer_update on leads.outbox_events;
create policy outbox_events_leads_definer_update on leads.outbox_events
  for update to influx_leads_definer
  using (status in ('pending', 'processing'))
  with check ((status = 'processing') = (locked_by is not null));

-- the contact state: an outcome, never processing; unsubscription and suppression stay with
-- their own writers (J7)
grant select (account_id, destination, external_contact_id, last_success_at)
   on leads.contact_sync_states to influx_leads_definer;
grant insert (account_id, destination, external_contact_id, last_attempt_at, last_success_at,
              last_status, last_error_code)
   on leads.contact_sync_states to influx_leads_definer;
grant update (external_contact_id, last_attempt_at, last_success_at, last_status, last_error_code)
   on leads.contact_sync_states to influx_leads_definer;

drop policy if exists contact_sync_states_leads_definer_select on leads.contact_sync_states;
create policy contact_sync_states_leads_definer_select on leads.contact_sync_states
  for select to influx_leads_definer
  using (true);

drop policy if exists contact_sync_states_leads_definer_insert on leads.contact_sync_states;
create policy contact_sync_states_leads_definer_insert on leads.contact_sync_states
  for insert to influx_leads_definer
  with check (last_status <> 'processing');

drop policy if exists contact_sync_states_leads_definer_update on leads.contact_sync_states;
create policy contact_sync_states_leads_definer_update on leads.contact_sync_states
  for update to influx_leads_definer
  using (true)
  with check (last_status <> 'processing');

-- the journal: the P1 line of a queue e-mail that left, insert only (0015: append-only
-- description; the delivery acknowledgement comes with the webhook, J7)
grant insert (email_code, priority, account_id, locale, template_ref, template_version,
              outbox_event_id, provider_message_id, status, sent_at)
   on leads.transactional_sends to influx_leads_definer;

drop policy if exists transactional_sends_leads_definer_insert on leads.transactional_sends;
create policy transactional_sends_leads_definer_insert on leads.transactional_sends
  for insert to influx_leads_definer
  with check (priority = 'p1' and status = 'sent' and sent_at = now()
              and outbox_event_id is not null and account_id is not null
              and recipient_email is null);

-- the settings: the seven keys the worker reads (EC-8), not the two signup_* keys
grant select (key, value) on leads.sync_settings to influx_leads_definer;

drop policy if exists sync_settings_leads_definer_select on leads.sync_settings;
create policy sync_settings_leads_definer_select on leads.sync_settings
  for select to influx_leads_definer
  using (key in ('apollo_scope', 'apollo_legal_basis', 'apollo_prospecting_countries',
                 'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids'));

-- the account of a subject: no address, no name, no acquisition source
grant select (id, status, country_code, preferred_language, declared_status, email_verified_at)
   on identity.accounts to influx_leads_definer;

drop policy if exists accounts_leads_definer_select on identity.accounts;
create policy accounts_leads_definer_select on identity.accounts
  for select to influx_leads_definer
  using (true);

grant select (account_id, role) on identity.account_roles to influx_leads_definer;

drop policy if exists account_roles_leads_definer_select on identity.account_roles;
create policy account_roles_leads_definer_select on identity.account_roles
  for select to influx_leads_definer
  using (true);

-- the consent in force (RG37): purpose, value, instant; never the evidence
grant select (account_id, purpose, granted, occurred_at)
   on identity.consent_events to influx_leads_definer;

drop policy if exists consent_events_leads_definer_select on identity.consent_events;
create policy consent_events_leads_definer_select on identity.consent_events
  for select to influx_leads_definer
  using (true);

-- 6. Rights of influx_worker: the four functions and the register line, no table --------------

grant usage on schema leads to influx_worker;

-- EC-52 (3), announced by 0011: EXECUTE on audit.append_elevated() with the first operation of
-- the worker. Granted by the owner, through the window of 0006 §9: the migration role does not
-- own the function.
grant usage on schema audit to influx_worker;

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append_elevated(text, uuid) to influx_worker;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 7. Hand the four functions to influx_leads_definer (03 P7 rule 5, window of 0004 §9) ----------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;

alter function leads.claim_outbox_batch(text, integer) owner to influx_leads_definer;
alter function leads.begin_outbox_attempt(bigint, text) owner to influx_leads_definer;
alter function leads.complete_outbox_attempt(bigint, text, leads.outbox_status, boolean, text,
    text, text, integer, text, text, text, integer) owner to influx_leads_definer;
alter function leads.recover_stale_outbox_lines(integer) owner to influx_leads_definer;

revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 8. End-state assertions ----------------------------------------------------------------------------

do $$
declare
  c_fns constant text[] := array[
    'leads.claim_outbox_batch(text, integer)',
    'leads.begin_outbox_attempt(bigint, text)',
    'leads.complete_outbox_attempt(bigint, text, leads.outbox_status, boolean, text, text, text, '
      'integer, text, text, text, integer)',
    'leads.recover_stale_outbox_lines(integer)'];
  v_fn   text;
  v_bad  text;
begin
  -- the owner: no login, no inheritance, nothing dangerous, member of nothing
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_leads_definer'
                and (rolcanlogin or rolinherit or rolsuper or rolbypassrls or rolcreatedb
                     or rolcreaterole or rolreplication)) then
    raise exception 'influx_leads_definer must be NOLOGIN NOINHERIT, with no dangerous attribute';
  end if;
  if exists (select 1 from pg_catalog.pg_auth_members m
               join pg_catalog.pg_roles r on r.oid = m.member
              where r.rolname = 'influx_leads_definer') then
    raise exception 'influx_leads_definer is a member of another role';
  end if;

  foreach v_fn in array c_fns loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_leads_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_leads_definer, empty search_path', v_fn;
    end if;
    -- E-3: EXECUTE for influx_worker only, besides the owner; never PUBLIC
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

  -- the register: through audit.append_elevated() only (EC-36, EC-52)
  if not pg_catalog.has_function_privilege('influx_worker', 'audit.append_elevated(text, uuid)', 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_worker', 'audit.append(text, text, uuid, jsonb)', 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_worker', 'audit.append_auth_event(text, uuid)', 'EXECUTE') then
    raise exception 'influx_worker must reach the register through audit.append_elevated() only';
  end if;

  -- nobody else writes the processing state of the queue, nor the contact states
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['leads.outbox_events', 'leads.contact_sync_states']) t
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_leads_definer'
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'UPDATE')
          or (t = 'leads.contact_sync_states'
              and pg_catalog.has_any_column_privilege(r.oid, t, 'INSERT'))
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'unexpected write right(s) on the queue state: %', v_bad;
  end if;

  -- no usable member left on the two owners used here (C-9: the ADMIN-only migration role)
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_leads_definer', 'influx_audit_writer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE') then
    raise exception 'influx_leads_definer left with CREATE on schema leads';
  end if;
end
$$;
