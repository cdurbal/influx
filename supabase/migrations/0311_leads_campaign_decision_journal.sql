-- =============================================================================
-- 0311_leads_campaign_decision_journal
-- -----------------------------------------------------------------------------
-- Lot 3 / L3C, fix X1 (jalons/l3c/fix-1.md; l3c/modele.md "Arbitrage A2", architecte,
-- 2026-11-15, which prevails over §8 and §9; fiche invariant 10). Signalled I-4: a SECURITY
-- DEFINER function is redefined.
--
-- The defect: 0111 copies payload.email_code into leads.transactional_sends. A campaign.decision
-- line (0308, 0309) carries its VARIANT there (published, rejected, paused_by_influx...), which the
-- dotted format of 0015 (transactional_sends_email_code_format, template_ref_format) refuses: the
-- e-mail left, the outcome failed with 23514, the line was taken back after 600 s and only the
-- idempotency of Brevo kept the brand from a second e-mail.
--
--   leads.complete_outbox_attempt(...)   0111 restated verbatim by its owner influx_leads_definer
--         (window of 0146 §4), but for:
--           §2  o.event_type is read with the line (influx_leads_definer already holds SELECT on
--               it, 0111 §5: no new right);
--           §2  ONE journal code, computed once: campaign.decision for a campaign.decision line,
--               the code of the catalogue (16 RG85), equal to its event type and to the Brevo
--               tag, as L2 journals profile.decision, creator_profile.decision and
--               verification.decision; otherwise payload ->> 'email_code', as before;
--           §7  that code is written in email_code and, when a template version is named, in
--               template_ref.
--         The nullity of payload.email_code is still tested on every transactional live success
--         (§3, 22023): a campaign.decision line without its variant is still refused. The variant
--         stays in the payload and in the decision tables (campaigns.*), never in the journal
--         (D60: the journal says that an e-mail left, not that a campaign was refused).
--
-- Unchanged: the signature, the result, the owner, EXECUTE (influx_worker only), the comment
-- (kept by CREATE OR REPLACE), the empty search_path, every other line of the body. No GRANT, no
-- column, no constraint relaxed, no code emitted changed; no data taken back (the failed lines
-- stay failed, their e-mail having left). The search migrations move to 0312 and after.
-- =============================================================================

-- 1. The function, as influx_leads_definer (03 P7 rule 5, window of 0004 §9, as 0146 §4) ---------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
set role influx_leads_definer;

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
  v_code     text;
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
  select o.event_type, o.destination, o.subject_key, o.payload, o.attempts
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
  -- 0311, arbitrage A2: the code journaled is the code of the catalogue (16 RG85). A campaign
  -- decision is journaled under campaign.decision, its event type; its variant (published,
  -- rejected...) stays in the payload. Any other line keeps the code it names.
  v_code := case when v_line.event_type = 'campaign.decision' then 'campaign.decision'
                 else v_line.payload ->> 'email_code' end;

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
      -- e-mail code comes from the line (0311: the catalogue code of §2), never from the caller;
      -- the template version is COPIED (04 R7) when the caller names it.
      insert into leads.transactional_sends
        (email_code, priority, account_id, locale, template_ref, template_version,
         outbox_event_id, provider_message_id, status, sent_at)
      values
        (v_code, 'p1', v_account, p_locale,
         case when p_template_version is not null then v_code end,
         p_template_version, p_outbox_id, p_provider_message_id, 'sent', pg_catalog.now());
    end if;
  end if;

  return query select v_status, v_journal, v_account;
end
$$;

reset role;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 2. End-state assertions --------------------------------------------------------------------------

do $$
declare
  c_fn constant regprocedure :=
    'leads.complete_outbox_attempt(bigint, text, leads.outbox_status, boolean, text, text, text, '
    'integer, text, text, text, integer)'::regprocedure;
  v_bad  text;
begin
  -- the owner, the definer mode, the volatility and the empty search_path of 0111
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid = c_fn)
       <> 'influx_leads_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn)
     or (select provolatile from pg_catalog.pg_proc where oid = c_fn) <> 'v'
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, volatile, owned by influx_leads_definer, empty search_path',
      c_fn;
  end if;

  -- E-3: EXECUTE for influx_worker only, besides the owner; never PUBLIC (no new grant)
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_worker');
  if v_bad is not null then
    raise exception '% executable by: %', c_fn, v_bad;
  end if;
  if not pg_catalog.has_function_privilege('influx_worker', c_fn, 'EXECUTE') then
    raise exception '% lost its grant to influx_worker', c_fn;
  end if;

  -- one form only, its comment of 0111 kept, and the code of the catalogue in its body
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'leads' and p.proname = 'complete_outbox_attempt' and p.oid <> c_fn) then
    raise exception 'another form of leads.complete_outbox_attempt exists';
  end if;
  if pg_catalog.obj_description(c_fn, 'pg_proc') not like 'E-3 outcome, %' then
    raise exception 'the comment of leads.complete_outbox_attempt was lost';
  end if;
  if (select p.prosrc from pg_catalog.pg_proc p where p.oid = c_fn)
       !~ 'v_line\.event_type = ''campaign\.decision'' then ''campaign\.decision''' then
    raise exception 'leads.complete_outbox_attempt does not journal campaign.decision under its code';
  end if;

  -- no usable member left on the owner (C-9: the ADMIN-only migration role), no CREATE left
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
