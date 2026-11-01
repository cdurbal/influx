-- =============================================================================
-- 0145_leads_sync_settings_guard_and_journal
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, commit D67-a. The database half of D67 (architecte, 2026-10-17, arbitrages
-- (ii) and (v); 05 RG161, RG163, CA88; 18 TM1.16, TM1.12 for the base). Two triggers on
-- leads.sync_settings, and the two writers of 0140 and 0141 restated so that the journal has
-- ONE writer:
--
--   leads.guard_sync_setting_write()   BEFORE INSERT OR UPDATE OR DELETE (row) and BEFORE
--         TRUNCATE (statement). (1) 05 RG163: a Brevo id once set (a sub-key of
--         brevo_list_ids or of brevo_template_ids that is not null) is never set back to null
--         nor removed; the two rows are never deleted, renamed away nor truncated; replacing
--         an id by another positive integer (the CHECK of 0103 / 0141 judges the shape) and
--         adding a sub-key at null (a new list or template) stay possible. brevo_template_ids
--         is {} since 0140 (D69): the guard holds the day a sub-key comes back. The emptying
--         done by 0140 is history: the guard exists from this file on, so the replay of the
--         migrations on an empty base is unchanged. Refusal: 23001 restrict_violation, the
--         message names the key and the sub-keys, never a value (D60). The whole table is
--         never truncated (a row trigger does not see TRUNCATE).
--         (2) 05 RG161: it keeps updated_at, the date of modification of the key, whatever the
--         path: clock_timestamp() when the value (or the key) changes, so that a correction
--         made DURING a worker attempt is dated after the start of that attempt (EC-J9-D67a-2);
--         a write that changes no value keeps the date AND the author of the row (nothing
--         changed, nothing is re-queued). It replaces the generic sync_settings_touch_updated_at
--         of 0103 (now() on every update, even without a change). SECURITY INVOKER owned by the
--         migration role, NO grant: it reads OLD and NEW only.
--   leads.journal_sync_setting_change()   AFTER INSERT OR UPDATE OR DELETE, for each row.
--         05 RG163 (2), D67 (v): every write that changes a value writes EXACTLY ONE
--         settings.changed (04 §4.3) through audit.append() (03 §P7, the only way to the
--         register), on md5('leads.sync_settings:' || key)::uuid (EC-J8-28), payload {key,
--         from, to} or {key, from_md5, to_md5} when either side exceeds 3000 octets (EC-J8-30),
--         plus the context of the calling function (below). An INSERT has from null, a DELETE
--         to null, a rename (never of a Brevo key) carries previous_key. A write that changes
--         nothing writes nothing. No secret can be in from / to: the keys are a closed list
--         (CHECK of 0141) whose shapes hold codes, country codes, numbers, booleans and
--         numeric Brevo ids, never a key or a credential.
--         AFTER and per row, not BEFORE: it sees the final row, after the BEFORE triggers and
--         the CHECKs, so a refused write never reaches the register; and since each writer's
--         UPDATE is its LAST statement, the chain lock taken by audit.append() is the last
--         lock of the business transaction and is held until COMMIT (EC-J8-28, 04 §7.2). A
--         deferred constraint trigger (journal at COMMIT) was set aside: errors at COMMIT, the
--         context of each write lost when a transaction writes twice. Consequence for an
--         operator's psql session: the first change takes the chain lock until its COMMIT
--         (every register writer waits meanwhile): commit at once (runbook).
--         Attribution: audit.append() binds the actor to session_user (0009, 0136 V1): the
--         backoffice (influx_app) => the admin's account; the worker (influx_worker_login) =>
--         system; any other connection (the migration role, an operator's SQL, a migration)
--         => system, and db_session_user = the CONNECTION role in the payload. session_user,
--         not current_user: inside this SECURITY DEFINER function current_user is its owner,
--         and inside the two writers it is their own definer; the connection role is what
--         names the person or the process (05 RG163 "nommé par son rôle de connexion").
--         Migrations are journaled too ("quel que soit le chemin"): a migration and an
--         operator connect with the same role, the trigger cannot tell them apart, and a
--         register line costs nothing (EC-J9-D67a-1; 0141 "not journaled" is superseded).
--         SECURITY DEFINER owned by influx_leads_definer (it holds EXECUTE on audit.append()
--         since 0111), NO grant: a trigger function is never called directly.
--   Context of the calling function: influx.sync_setting_change, a JSON object set by
--         set_config(..., true) (transaction-local) right before the writer's UPDATE, read and
--         CLEARED by the journal trigger at that write (one write, one context: a later write
--         of the same transaction carries none). Closed shapes, each bound to its session:
--           {key: brevo_list_ids, reason_code: environment}              influx_worker_login
--           {key: <Apollo key>, reason_code, dual_control_request_id,
--            dual_control, reevaluated}                                   influx_app, and the
--                                                                         row's author is the
--                                                                         account in context
--         Anything else (not JSON, another key, an unknown field, a reason outside its
--         session) fails the write: 22023 invalid_parameter_value. The context is descriptive:
--         the actor never comes from it.
--   leads.apply_brevo_ids_from_environment(jsonb)   0140 restated: same signature, owner,
--         grants and behaviour; it hands {key, reason_code environment} to the trigger instead
--         of calling audit.append() itself (D68 "articulation D67": no double line).
--   backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text)   0141 restated: same
--         signature, owner and grants. The re-evaluation of the skipped accounts now runs
--         BEFORE the UPDATE, so that its count (reevaluated) is in the context and the UPDATE
--         stays the last statement; a confirmed value equal to the value in force writes
--         nothing and journals nothing (the 2V is still consumed, and journaled by
--         consume_dual_control()), returns 0 (EC-J9-D67a-3).
--
-- Who may lift the guard (05 "À relire" points 3 and 4): only the OWNER of the table, the
-- migration role, i.e. a reviewed migration (ALTER TABLE ... DISABLE TRIGGER within its own
-- transaction, then ENABLE). No execution role of 03 P7 owns the table or the functions (T4.4),
-- none holds TRIGGER, TRUNCATE nor the right to SET session_replication_role (asserted below,
-- tested by tm1-sync-settings-guard-journal), so none can disable, drop or replace a trigger.
--
-- Not in this file: the catch-up of 05 RG161 (D67-b, the worker's E-3 step, which will read
-- updated_at), no Brevo template (D69), no new GRANT to an execution role, no new motif in 03
-- §P7.
--
-- EC-J9-D67a (micro-gaps, the safest choice):
--   EC-J9-D67a-1  migrations are journaled like any write (system, db_session_user).
--   EC-J9-D67a-2  updated_at := clock_timestamp() (not now()) on a change; an unchanged write
--                 keeps date and author.
--   EC-J9-D67a-3  change_apollo_setting: re-evaluation before the UPDATE; no write, no line
--                 when the value is unchanged.
--   EC-J9-D67a-4  the context is bound to its session and key, closed, cleared at use; a bad
--                 context fails the write (22023).
--   EC-J9-D67a-5  guard refusals: 23001 restrict_violation (23514 stays the shape CHECK).
--
-- ROLLBACK (before any real use): drop trigger sync_settings_journal_change,
-- sync_settings_guard_write and sync_settings_guard_truncate on leads.sync_settings; drop
-- function leads.journal_sync_setting_change() and leads.guard_sync_setting_write(); recreate
-- trigger sync_settings_touch_updated_at as in 0103; restate
-- leads.apply_brevo_ids_from_environment(jsonb) as in 0140 (as influx_leads_definer) and
-- backoffice.change_apollo_setting() as in 0141 (as influx_identity_definer), with their
-- comments.
-- =============================================================================

-- 1. The guard and the date of modification (05 RG163 (1), RG161) ---------------------------------------

create or replace function leads.guard_sync_setting_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  c_brevo_keys constant text[] := array['brevo_list_ids', 'brevo_template_ids'];
  v_lost       text;
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'leads.sync_settings is never truncated (05 RG163)'
      using errcode = 'restrict_violation';
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.key = any (c_brevo_keys) then
    if tg_op = 'DELETE' then
      raise exception 'the row % of leads.sync_settings is never deleted (05 RG163)', old.key
        using errcode = 'restrict_violation';
    end if;
    if new.key is distinct from old.key then
      raise exception 'the row % of leads.sync_settings is never renamed (05 RG163)', old.key
        using errcode = 'restrict_violation';
    end if;
    -- an id set (not null) stays set: replaced by a positive integer (the CHECK judges), never
    -- null, never removed; a sub-key still null may come and go. Names only, never a value.
    select pg_catalog.string_agg(e.key, ', ' order by e.key) into v_lost
      from pg_catalog.jsonb_each(old.value) e
     where pg_catalog.jsonb_typeof(e.value) <> 'null'
       and coalesce(pg_catalog.jsonb_typeof(new.value -> e.key), 'null') = 'null';
    if v_lost is not null then
      raise exception 'a Brevo id once set is never set back to null nor removed (05 RG163): % (%)',
                      old.key, v_lost
        using errcode = 'restrict_violation';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  -- 05 RG161: the date of modification of the key, the time of the write (not of the start of
  -- its transaction); a write that changes nothing changes neither the date nor the author
  if tg_op = 'INSERT'
     or new.key is distinct from old.key
     or new.value is distinct from old.value then
    new.updated_at := pg_catalog.clock_timestamp();
  else
    new.updated_at            := old.updated_at;
    new.updated_by_account_id := old.updated_by_account_id;
  end if;
  return new;
end
$$;

comment on function leads.guard_sync_setting_write() is
  '05 RG163 (1), RG161 (0145). BEFORE INSERT OR UPDATE OR DELETE (row) and BEFORE TRUNCATE '
  '(statement) on leads.sync_settings: a Brevo id once set (a non-null sub-key of brevo_list_ids '
  'or brevo_template_ids) is never set back to null nor removed, the two rows are never deleted '
  'nor renamed, the table is never truncated: 23001 restrict_violation, naming keys only. '
  'Replacing an id by a positive integer and adding a sub-key at null stay possible. Keeps '
  'updated_at = clock_timestamp() when the value or the key changes; an unchanged write keeps '
  'date and author. Only a reviewed migration (the owner of the table) can disable it. SECURITY '
  'INVOKER, NO grant.';

revoke all on function leads.guard_sync_setting_write() from public;

drop trigger if exists sync_settings_touch_updated_at on leads.sync_settings;

drop trigger if exists sync_settings_guard_write on leads.sync_settings;
create trigger sync_settings_guard_write
  before insert or update or delete on leads.sync_settings
  for each row execute function leads.guard_sync_setting_write();

drop trigger if exists sync_settings_guard_truncate on leads.sync_settings;
create trigger sync_settings_guard_truncate
  before truncate on leads.sync_settings
  for each statement execute function leads.guard_sync_setting_write();

-- 2. The journal, whatever the path (05 RG163 (2), D67 (v)) -----------------------------------------------

create or replace function leads.journal_sync_setting_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  c_large    constant integer := 3000;
  v_raw      text := nullif(pg_catalog.current_setting('influx.sync_setting_change', true), '');
  v_key      text;
  v_from     jsonb;
  v_to       jsonb;
  v_context  jsonb;
  v_reason   text;
  v_count    jsonb;
  v_payload  jsonb;
begin
  if tg_op = 'DELETE' then
    v_key := old.key;  v_from := old.value;  v_to := null;
  elsif tg_op = 'INSERT' then
    v_key := new.key;  v_from := null;       v_to := new.value;
  else
    v_key := new.key;  v_from := old.value;  v_to := new.value;
  end if;

  -- The context of the calling function: for THIS write only (cleared here, whatever follows),
  -- a closed shape bound to the session that may give it; anything else fails the write.
  if v_raw is not null then
    perform pg_catalog.set_config('influx.sync_setting_change', '', true);
    begin
      v_context := v_raw::jsonb;
    exception when invalid_text_representation then
      raise exception 'the context of a settings change must be a JSON object'
        using errcode = 'invalid_parameter_value';
    end;
    if pg_catalog.jsonb_typeof(v_context) is distinct from 'object'
       or (v_context ->> 'key') is distinct from v_key then
      raise exception 'the context of a settings change does not name the key written'
        using errcode = 'invalid_parameter_value';
    end if;
    v_reason := v_context ->> 'reason_code';

    if v_reason = 'environment' then
      -- D68: the worker's function, on the list ids, from the worker's connection
      if (v_context - 'key' - 'reason_code') <> '{}'::jsonb
         or session_user::text <> 'influx_worker_login'
         or tg_op <> 'UPDATE'
         or v_key <> 'brevo_list_ids' then
        raise exception 'this settings change context belongs to the worker''s function'
          using errcode = 'invalid_parameter_value';
      end if;
    elsif v_reason in ('founder_decision', 'legal_validation', 'legal_restriction',
                       'configuration_error') then
      -- 0141: the backoffice writer, an admin under 2V, on the three Apollo keys
      v_count := v_context -> 'reevaluated';
      if (v_context - 'key' - 'reason_code' - 'dual_control_request_id' - 'dual_control'
                    - 'reevaluated') <> '{}'::jsonb
         or pg_catalog.jsonb_typeof(v_context -> 'dual_control_request_id') is distinct from 'string'
         or coalesce((v_context ->> 'dual_control_request_id') !~* c_uuid, true)
         or coalesce((v_context ->> 'dual_control') not in ('peer', 'degraded_single_operator'), true)
         or pg_catalog.jsonb_typeof(v_count) is distinct from 'number'
         or session_user::text <> 'influx_app'
         or tg_op <> 'UPDATE'
         or v_key not in ('apollo_scope', 'apollo_excluded_countries', 'apollo_legal_basis') then
        raise exception 'this settings change context belongs to the backoffice writer'
          using errcode = 'invalid_parameter_value';
      end if;
      if (v_count #>> '{}')::numeric < 0
         or (v_count #>> '{}')::numeric <> pg_catalog.floor((v_count #>> '{}')::numeric)
         or new.updated_by_account_id is null
         or new.updated_by_account_id is distinct from influx.current_account_id() then
        raise exception 'this settings change context belongs to the backoffice writer'
          using errcode = 'invalid_parameter_value';
      end if;
    else
      raise exception 'unknown settings change context'
        using errcode = 'invalid_parameter_value';
    end if;
  end if;

  -- nothing changed: nothing journaled (the guard kept the date and the author)
  if tg_op = 'UPDATE' and new.key = old.key and new.value = old.value then
    return null;
  end if;

  v_payload := pg_catalog.jsonb_build_object('key', v_key);
  if tg_op = 'UPDATE' and new.key <> old.key then
    v_payload := v_payload || pg_catalog.jsonb_build_object('previous_key', old.key);
  end if;
  if v_context is not null then
    v_payload := v_payload || (v_context - 'key');
  end if;
  -- EC-J8-30: the old and new values, or their digests when either is large
  v_payload := v_payload || case
    when coalesce(pg_catalog.octet_length(v_from::text), 0) > c_large
         or coalesce(pg_catalog.octet_length(v_to::text), 0) > c_large then
      pg_catalog.jsonb_build_object('from_md5', pg_catalog.md5(v_from::text),
                                    'to_md5', pg_catalog.md5(v_to::text))
    else pg_catalog.jsonb_build_object('from', v_from, 'to', v_to)
  end;

  -- the actor and, outside the api and the worker, db_session_user come from audit.append()
  -- (session_user, 0136 V1); last of the writer's statement: the chain lock is held until COMMIT
  perform audit.append('settings.changed', 'setting',
                       pg_catalog.md5('leads.sync_settings:' || v_key)::uuid, v_payload);
  return null;
end
$$;

comment on function leads.journal_sync_setting_change() is
  '05 RG163 (2), D67 (v) (0145). AFTER INSERT OR UPDATE OR DELETE, for each row, on '
  'leads.sync_settings: the ONLY writer of settings.changed for this table. Every write that '
  'changes a value, whatever the path (worker, backoffice, operator SQL, migration), writes one '
  'line through audit.append() on md5(''leads.sync_settings:'' || key)::uuid (EC-J8-28): {key, '
  'from, to} or {key, from_md5, to_md5} beyond 3000 octets (EC-J8-30), previous_key on a rename, '
  'plus the context of influx.sync_setting_change (worker: reason_code environment; backoffice: '
  'reason_code, dual_control_request_id, dual_control, reevaluated), read and cleared at that '
  'write, closed and bound to its session (influx_worker_login, influx_app with the row''s author '
  'as account), else 22023. The actor comes from audit.append() (session_user; db_session_user '
  'for any other connection). An unchanged write writes nothing. SECURITY DEFINER owned by '
  'influx_leads_definer, NO grant.';

revoke all on function leads.journal_sync_setting_change() from public;

drop trigger if exists sync_settings_journal_change on leads.sync_settings;
create trigger sync_settings_journal_change
  after insert or update or delete on leads.sync_settings
  for each row execute function leads.journal_sync_setting_change();

-- 3. The journal to its owner, and the worker's function restated (03 P7 rule 5, window of 0004 §9) ------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
alter function leads.journal_sync_setting_change() owner to influx_leads_definer;
set role influx_leads_definer;

create or replace function leads.apply_brevo_ids_from_environment(p_list_ids jsonb)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_list_keys constant text[] := array['advertisers', 'creators'];
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
  if p_list_ids = '{}'::jsonb then
    return array[]::text[];
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
  if v_next = v_previous then
    return array[]::text[];
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
  return array['brevo_list_ids'];
end
$$;

comment on function leads.apply_brevo_ids_from_environment(jsonb) is
  'D68, amended by D69: the worker, at start, hands the Brevo list ids of its environment. '
  'p_list_ids: {advertisers?, creators?}, each a positive integer; only the GIVEN sub-keys are '
  'merged, never NULL (05 RG163). A change is journaled by the trigger of leads.sync_settings '
  '(0145): settings.changed {key, from, to, reason_code environment} on '
  'md5(''leads.sync_settings:brevo_list_ids'')::uuid (EC-J8-28), the reason handed through '
  'influx.sync_setting_change; updated_by_account_id reset to NULL. Returns the keys changed. '
  'Refusal: 22023. SECURITY DEFINER owned by influx_leads_definer; EXECUTE for influx_worker ONLY.';

reset role;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 4. The backoffice writer of 0141 restated, as influx_identity_definer ---------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;
set role influx_identity_definer;

create or replace function backoffice.change_apollo_setting(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_key                      text,
  p_value                    jsonb,
  p_reason_code              text
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid;
  v_payload    jsonb;
  v_previous   jsonb;
  v_mode       text;
  v_reasons    text[];
  v_count      integer := 0;
begin
  v_caller := identity.require_active_admin();

  if p_reason_code is null
     or p_reason_code not in ('founder_decision', 'legal_validation', 'legal_restriction',
                              'configuration_error') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the same canonical form as the request: a value the request did not confirm is not consumed
  v_payload := backoffice.canonical_dual_control_payload(
                 'leads.change_apollo_setting',
                 pg_catalog.jsonb_build_object('key', p_key, 'value', p_value), v_caller);

  -- R in THIS transaction, then the 2V consumed once, by its confirmer (03 PD3 to PD7)
  perform identity.assert_fresh_second_factor(p_session_id);
  v_mode := backoffice.consume_dual_control(p_dual_control_request_id, 'leads.change_apollo_setting',
                                            v_payload, p_reason_code);

  select s.value into v_previous
    from leads.sync_settings s
   where s.key = p_key
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- 0145 (EC-J9-D67a-3): the value in force confirmed again writes nothing, journals nothing
  if v_previous is not distinct from (v_payload -> 'value') then
    return 0;
  end if;

  -- RG81: the accounts skipped for a reason this key decides are re-evaluated (EC-J8-29), BEFORE
  -- the write, so that its count goes to the journal and the write stays the last statement
  v_reasons := case p_key
    when 'apollo_scope'              then array['out_of_apollo_scope', 'out_of_apollo_scope_individual']
    when 'apollo_excluded_countries' then array['country_excluded', 'country_not_validated']
    when 'apollo_legal_basis'        then array['no_consent']
  end;
  with candidates as (
    select s.account_id, pg_catalog.gen_random_uuid() as event_id
      from leads.contact_sync_states s
      join identity.accounts a on a.id = s.account_id and a.status = 'active'
     where s.destination = 'apollo_contact'
       and s.last_status = 'skipped'
       and s.last_error_code = any (v_reasons)
       and exists (select 1 from identity.account_roles r
                    where r.account_id = s.account_id and r.role in ('advertiser', 'creator'))
  ), queued as (
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select c.event_id, 'lead.updated', 'apollo_contact', 'account:' || c.account_id::text, 100,
           pg_catalog.jsonb_build_object('event_id', c.event_id, 'account_id', c.account_id),
           'lead.updated:' || c.event_id::text
      from candidates c
    returning 1
  )
  select count(*)::integer into v_count from queued;

  -- D67 (v), 0145: the journal trigger of leads.sync_settings writes the register line of this
  -- UPDATE, last (EC-J8-28), with the context of this act, for this write only
  perform pg_catalog.set_config('influx.sync_setting_change',
                                pg_catalog.jsonb_build_object(
                                  'key', p_key,
                                  'reason_code', p_reason_code,
                                  'dual_control_request_id', p_dual_control_request_id,
                                  'dual_control', v_mode,
                                  'reevaluated', v_count)::text,
                                true);
  -- RG81: a row update, read by the worker at its next consumption; the shape is checked by 0103
  update leads.sync_settings
     set value = v_payload -> 'value', updated_by_account_id = v_caller
   where key = p_key;
  return v_count;
end
$$;

comment on function backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text) is
  '05 RG81, RG83, RG84 (0141: block-list); 03 §1.3 (J · 2V · R): an active admin in aal2 writes one '
  'Apollo key of leads.sync_settings (apollo_scope | apollo_excluded_countries | apollo_legal_basis) '
  'with a fresh second factor on p_session_id, consuming the confirmed request '
  'leads.change_apollo_setting {key, value (canonical: countries sorted)} with this reason '
  '(founder_decision | legal_validation | legal_restriction | configuration_error), by its confirmer. '
  'When the value changes, every active member account whose Apollo contact was skipped for a reason '
  'the key decides (scope: out_of_apollo_scope*; countries: country_excluded, country_not_validated; '
  'legal basis: no_consent) gets ONE lead.updated to apollo_contact (priority 100, EC-J8-29), then '
  'the key is written, last; the trigger of leads.sync_settings (0145) journals settings.changed '
  '{key, from, to (or from_md5, to_md5, EC-J8-30), reason_code, dual_control_request_id, '
  'dual_control, reevaluated} on md5(''leads.sync_settings:'' || key)::uuid (EC-J8-28), the '
  'context handed through influx.sync_setting_change. The value in force confirmed again writes '
  'and journals nothing and returns 0 (EC-J9-D67a-3). Returns the number re-evaluated. Any '
  'refusal: 42501 forbidden; a value refused by 0103: 23514 / 23503. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_admin ONLY.';

reset role;
revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_guard    constant regprocedure := 'leads.guard_sync_setting_write()'::regprocedure;
  v_journal  constant regprocedure := 'leads.journal_sync_setting_change()'::regprocedure;
  v_bad      text;
begin
  -- the guard: invoker, owned by the migration role; the journal: definer, owned by influx_leads_definer
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid = v_guard) <> current_user
     or (select prosecdef from pg_catalog.pg_proc where oid = v_guard)
     or (select proconfig from pg_catalog.pg_proc where oid = v_guard) is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY INVOKER, owned by the migration role, empty search_path', v_guard;
  end if;
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid = v_journal)
       <> 'influx_leads_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = v_journal)
     or (select proconfig from pg_catalog.pg_proc where oid = v_journal) is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_leads_definer, empty search_path', v_journal;
  end if;
  -- neither is executable by anyone but its owner
  select string_agg(format('%s: %s', p.oid::regprocedure,
                           case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end), ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in (v_guard, v_journal)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner;
  if v_bad is not null then
    raise exception 'trigger function(s) executable by: %', v_bad;
  end if;

  -- the three triggers, enabled; the touch trigger of 0103 gone
  if (select count(*) from pg_catalog.pg_trigger t
       where t.tgrelid = 'leads.sync_settings'::regclass and not t.tgisinternal and t.tgenabled = 'O'
         and ((t.tgname in ('sync_settings_guard_write', 'sync_settings_guard_truncate') and t.tgfoid = v_guard)
              or (t.tgname = 'sync_settings_journal_change' and t.tgfoid = v_journal))) <> 3 then
    raise exception 'the guard and journal triggers of leads.sync_settings are not all in place and enabled';
  end if;
  if exists (select 1 from pg_catalog.pg_trigger t
              where t.tgrelid = 'leads.sync_settings'::regclass
                and t.tgname = 'sync_settings_touch_updated_at') then
    raise exception 'sync_settings_touch_updated_at survived';
  end if;

  -- only a reviewed migration lifts the guard: the table is the migration role's, and no role of
  -- ours may truncate it, create a trigger on it, or switch the triggers off by replica mode
  if (select pg_catalog.pg_get_userbyid(relowner) from pg_catalog.pg_class
       where oid = 'leads.sync_settings'::regclass) <> current_user then
    raise exception 'leads.sync_settings must be owned by the migration role';
  end if;
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_table_privilege(r.oid, 'leads.sync_settings', 'TRUNCATE')
          or pg_catalog.has_table_privilege(r.oid, 'leads.sync_settings', 'TRIGGER')
          or pg_catalog.has_table_privilege(r.oid, 'leads.sync_settings', 'INSERT')
          or pg_catalog.has_table_privilege(r.oid, 'leads.sync_settings', 'DELETE')
          or pg_catalog.has_parameter_privilege(r.oid, 'session_replication_role', 'SET')
          or r.rolsuper or r.rolbypassrls);
  if v_bad is not null then
    raise exception 'role(s) able to lift the guard of leads.sync_settings: %', v_bad;
  end if;

  -- one writer of settings.changed in the base: the trigger function (D67 (v))
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.prosrc like '%''settings.changed''%'
     and p.oid <> v_journal;
  if v_bad is not null then
    raise exception 'settings.changed still written by: %', v_bad;
  end if;

  -- the two restated functions kept their owner and their single grantee
  select string_agg(format('%s: %s', p.oid::regprocedure,
                           case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end), ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in ('leads.apply_brevo_ids_from_environment(jsonb)'::regprocedure,
                   'backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text)'::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0
          or a.grantee::regrole::text <> case p.oid
               when 'leads.apply_brevo_ids_from_environment(jsonb)'::regprocedure then 'influx_worker'
               else 'influx_admin' end);
  if v_bad is not null then
    raise exception 'restated writer(s) executable by: %', v_bad;
  end if;
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'leads.apply_brevo_ids_from_environment(jsonb)'::regprocedure) <> 'influx_leads_definer'
     or (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
          where oid = 'backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text)'::regprocedure)
          <> 'influx_identity_definer' then
    raise exception 'a restated writer changed owner';
  end if;

  -- no usable member left on the two owners (C-9: the ADMIN-only migration role)
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
    raise exception 'a function owner kept CREATE on its schema';
  end if;
end
$$;
