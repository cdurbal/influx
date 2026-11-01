-- =============================================================================
-- 0141_leads_apollo_excluded_countries
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, D33 and 05 RG84 overridden by the founder (2026-10-19): Apollo prospection
-- is open in EVERY country by default, staging and production alike; an administrator may
-- EXCLUDE countries. The key apollo_prospecting_countries (an allow-list, empty by default)
-- becomes apollo_excluded_countries (a block-list, EMPTY by default), same shape: ISO
-- 3166-1 codes of reference.countries, sorted, each once. The connector skips an excluded
-- country with country_excluded. The legal basis is unchanged (apollo_legal_basis, default
-- consentement_requis, RG83) and so is the scope (apollo_scope, RG81).
--
-- Every object that names the key is restated below VERBATIM but for the key (and, in
-- change_apollo_setting, the skip reasons the key decides): the two CHECKs of 0131, the
-- trigger function of 0103, leads.begin_outbox_attempt (0111), the canonical payload of 2V
-- (0137), change_apollo_setting and read_apollo_settings (0134), and three policies.
-- Last, the accounts skipped country_not_validated are re-evaluated once (lead.updated).
--
-- Not journaled by settings.changed: a migration is versioned and reviewed SQL.
--
-- ROLLBACK (before any real use): restate the objects of 0103, 0111, 0131, 0134 and 0137,
-- then update leads.sync_settings set key = 'apollo_prospecting_countries', value = '[]'
-- where key = 'apollo_excluded_countries'.
-- =============================================================================

-- 1. The key, renamed and emptied -----------------------------------------------------------------------

alter table leads.sync_settings drop constraint if exists sync_settings_key_closed_list;
alter table leads.sync_settings drop constraint if exists sync_settings_value_shape;

update leads.sync_settings
   set key = 'apollo_excluded_countries', value = '[]'::jsonb, updated_by_account_id = null
 where key = 'apollo_prospecting_countries';

alter table leads.sync_settings add constraint sync_settings_key_closed_list check (key in (
    'apollo_scope', 'apollo_legal_basis', 'apollo_excluded_countries',
    'signup_blocked_countries', 'signup_consent_required', 'signup_invitation_validity_days',
    'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids'));

alter table leads.sync_settings add constraint sync_settings_value_shape check (case key
    when 'apollo_scope' then
      jsonb_typeof(value) = 'string'
      and value #>> '{}' in ('annonceurs_seuls', 'annonceurs_et_createurs_pro', 'tous_les_inscrits')
    when 'apollo_legal_basis' then
      jsonb_typeof(value) = 'object'
      and value ?& array['default', 'by_country']
      and (value - 'default' - 'by_country') = '{}'::jsonb
      and value ->> 'default' in ('consentement_requis', 'interet_legitime_avec_opposition')
      and jsonb_typeof(value -> 'by_country') = 'object'
      and not jsonb_path_exists(value -> 'by_country',
            '$.keyvalue() ? (!(@.key like_regex "^[A-Z]{2}$")
                             || (@.value != "consentement_requis"
                                 && @.value != "interet_legitime_avec_opposition"))')
    when 'apollo_excluded_countries' then
      jsonb_typeof(value) = 'array'
      and not jsonb_path_exists(value, '$[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z]{2}$"))')
    when 'signup_blocked_countries' then
      jsonb_typeof(value) = 'array'
      and not jsonb_path_exists(value, '$[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z]{2}$"))')
    when 'signup_consent_required' then
      jsonb_typeof(value) = 'boolean'
    when 'signup_invitation_validity_days' then
      jsonb_typeof(value) = 'number'
      and not jsonb_path_exists(value, '$ ? (@ < 1 || @ > 365 || @.floor() != @)')
    when 'retry_schedule' then
      jsonb_typeof(value) = 'array'
      and jsonb_array_length(value) between 1 and 10
      and not jsonb_path_exists(value,
            '$[*] ? (@.type() != "number" || @ < 0 || @ > 172800 || @.floor() != @)')
    when 'rate_limits' then
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value,
            '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]{0,62}$")
                             || @.value.type() != "number" || @.value < 1
                             || @.value.floor() != @.value)')
    when 'brevo_list_ids' then
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value,
            '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]{0,62}$")
                             || (@.value != null && (@.value.type() != "number" || @.value < 1
                                                     || @.value.floor() != @.value)))')
    when 'brevo_template_ids' then
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value,
            '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$")
                             || (@.value != null && (@.value.type() != "number" || @.value < 1
                                                     || @.value.floor() != @.value)))')
    else false
  end);

-- 2. The trigger function of 0103 ------------------------------------------------------------------------

create or replace function leads.assert_sync_setting_value()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_codes text[];
begin
  if new.key in ('apollo_excluded_countries', 'signup_blocked_countries') then
    select pg_catalog.array_agg(e) into v_codes from pg_catalog.jsonb_array_elements_text(new.value) e;
  elsif new.key = 'apollo_legal_basis' then
    select pg_catalog.array_agg(k) into v_codes from pg_catalog.jsonb_object_keys(new.value -> 'by_country') k;
  elsif new.key = 'retry_schedule' then
    if exists (select 1
                 from pg_catalog.jsonb_array_elements(new.value) with ordinality as s (delay, n)
                 join pg_catalog.jsonb_array_elements(new.value) with ordinality as p (delay, n)
                   on p.n = s.n - 1
                where (s.delay #>> '{}')::numeric < (p.delay #>> '{}')::numeric) then
      raise exception 'retry_schedule must be non-decreasing' using errcode = 'check_violation';
    end if;
  end if;

  if v_codes is not null then
    if pg_catalog.cardinality(v_codes) <> (select count(distinct c) from pg_catalog.unnest(v_codes) c) then
      raise exception '% lists a country twice', new.key using errcode = 'check_violation';
    end if;
    if exists (select 1 from pg_catalog.unnest(v_codes) c
                where not exists (select 1 from reference.countries r where r.code = c)) then
      raise exception '% names an unknown country', new.key using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end
$$;

-- 3. The worker's read at consumption (0111), as influx_leads_definer -------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
set role influx_leads_definer;

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
           where s.key in ('apollo_scope', 'apollo_legal_basis', 'apollo_excluded_countries',
                           'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids'))
    from (select v_account as id) k
    left join identity.accounts a on a.id = k.id
    left join identity.account_roles r on r.account_id = a.id;
end
$$;

reset role;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

drop policy if exists sync_settings_leads_definer_select on leads.sync_settings;
create policy sync_settings_leads_definer_select on leads.sync_settings
  for select to influx_leads_definer
  using (key in ('apollo_scope', 'apollo_legal_basis', 'apollo_excluded_countries',
                 'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids'));


-- 4. The 2V payload and the admin functions (0137, 0134), as influx_identity_definer ----------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;
set role influx_identity_definer;

create or replace function backoffice.canonical_dual_control_payload(
  p_action_code  text,
  p_payload      jsonb,
  p_caller       uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  c_uuid      constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_target    uuid;
  v_role      identity.account_role;
  v_invite    uuid;
  v_legal     text;
  v_key       text;
  v_value     jsonb;
  v_codes     text[];
  v_request   uuid;
  v_type      backoffice.data_request_type;
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_action_code = 'identity.grant_role' then
    -- exactly {"account_id": uuid, "role": account_role}, never the caller (C(3)), an active
    -- target (R5)
    if (p_payload - 'account_id' - 'role') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'account_id') is distinct from 'string'
       or pg_catalog.jsonb_typeof(p_payload -> 'role') is distinct from 'string'
       or (p_payload ->> 'account_id') !~* c_uuid
       or not ((p_payload ->> 'role')
                 = any (pg_catalog.enum_range(null::identity.account_role)::text[])) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_target := (p_payload ->> 'account_id')::uuid;
    v_role   := (p_payload ->> 'role')::identity.account_role;
    if v_target = p_caller
       or not exists (select 1 from identity.accounts a
                       where a.id = v_target and a.status = 'active') then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('account_id', v_target, 'role', v_role);
  end if;

  if p_action_code = 'identity.change_member_role' then
    -- EC-J8-23 (0134): exactly {"account_id", "role": "advertiser", "legal_name"} on an active
    -- creator account other than the caller's; the name of the brand is covered by the 2V
    if (p_payload - 'account_id' - 'role' - 'legal_name') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'account_id') is distinct from 'string'
       or pg_catalog.jsonb_typeof(p_payload -> 'legal_name') is distinct from 'string'
       or (p_payload ->> 'account_id') !~* c_uuid
       or (p_payload ->> 'role') is distinct from 'advertiser' then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_target := (p_payload ->> 'account_id')::uuid;
    v_legal  := p_payload ->> 'legal_name';
    if v_target = p_caller
       or pg_catalog.char_length(pg_catalog.btrim(v_legal)) < 2
       or pg_catalog.char_length(v_legal) > 120 or v_legal ~ '[[:cntrl:]]'
       or not exists (select 1
                        from identity.accounts a
                        join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
                       where a.id = v_target and a.status = 'active') then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('account_id', v_target, 'role', 'advertiser',
                                         'legal_name', v_legal);
  end if;

  if p_action_code = 'identity.invite_admin' then
    -- EC-J8-12 (0131): exactly {"invitation_id": uuid}, a live admin invitation, not yet confirmed
    if (p_payload - 'invitation_id') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'invitation_id') is distinct from 'string'
       or (p_payload ->> 'invitation_id') !~* c_uuid then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_invite := (p_payload ->> 'invitation_id')::uuid;
    if not exists (select 1 from identity.internal_invitations i
                    where i.id = v_invite
                      and i.proposed_role = 'admin'
                      and i.confirmed_at is null
                      and i.accepted_at is null
                      and i.revoked_at is null
                      and i.expires_at > pg_catalog.now()) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('invitation_id', v_invite);
  end if;

  if p_action_code = 'leads.change_apollo_setting' then
    -- 05 RG81, RG83, RG84: exactly {"key", "value"}, one of the three Apollo keys, a value of the
    -- shape of 0103; a country list is sorted, its codes known (the CHECK of 0103 decides last)
    if (p_payload - 'key' - 'value') <> '{}'::jsonb
       or not (p_payload ? 'value')
       or pg_catalog.jsonb_typeof(p_payload -> 'key') is distinct from 'string' then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_key   := p_payload ->> 'key';
    v_value := p_payload -> 'value';
    if v_key = 'apollo_scope' then
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'string'
         or (v_value #>> '{}') not in ('annonceurs_seuls', 'annonceurs_et_createurs_pro',
                                       'tous_les_inscrits') then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
    elsif v_key = 'apollo_excluded_countries' then
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'array'
         or pg_catalog.jsonb_array_length(v_value) > 300
         or pg_catalog.jsonb_path_exists(v_value,
              '$[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z]{2}$"))') then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
      select pg_catalog.array_agg(distinct e order by e) into v_codes
        from pg_catalog.jsonb_array_elements_text(v_value) e;
      if exists (select 1 from pg_catalog.unnest(v_codes) c
                  where not exists (select 1 from reference.countries r where r.code = c)) then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
      v_value := coalesce(pg_catalog.to_jsonb(v_codes), '[]'::jsonb);
    elsif v_key = 'apollo_legal_basis' then
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'object'
         or not (v_value ?& array['default', 'by_country'])
         or (v_value - 'default' - 'by_country') <> '{}'::jsonb
         or (v_value ->> 'default') is null
         or (v_value ->> 'default') not in ('consentement_requis', 'interet_legitime_avec_opposition')
         or pg_catalog.jsonb_typeof(v_value -> 'by_country') is distinct from 'object'
         or pg_catalog.jsonb_path_exists(v_value -> 'by_country',
              '$.keyvalue() ? (!(@.key like_regex "^[A-Z]{2}$")
                               || (@.value != "consentement_requis"
                                   && @.value != "interet_legitime_avec_opposition"))')
         or exists (select 1 from pg_catalog.jsonb_object_keys(v_value -> 'by_country') k
                     where not exists (select 1 from reference.countries r where r.code = k)) then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
    else
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('key', v_key, 'value', v_value);
  end if;

  if p_action_code = 'privacy.approve_data_request' then
    -- 0137 (15 RG75 step 6, RG76): exactly {"request_id": uuid, "request_type": access | erasure},
    -- a request of that type deposited from the member space, open, by an active account other
    -- than the caller's (C(3)), never approved yet
    if (p_payload - 'request_id' - 'request_type') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'request_id') is distinct from 'string'
       or pg_catalog.jsonb_typeof(p_payload -> 'request_type') is distinct from 'string'
       or (p_payload ->> 'request_id') !~* c_uuid
       or (p_payload ->> 'request_type') not in ('access', 'erasure') then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_request := (p_payload ->> 'request_id')::uuid;
    v_type    := (p_payload ->> 'request_type')::backoffice.data_request_type;
    if not exists (select 1
                     from backoffice.data_subject_requests d
                     join identity.accounts a on a.id = d.requester_account_id
                    where d.id = v_request
                      and d.request_type = v_type
                      and d.channel = 'self_service'
                      and d.requester_account_id <> p_caller
                      and d.status <> 'closed'
                      and a.status = 'active')
       or exists (select 1 from privacy.request_executions e where e.request_id = v_request) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('request_id', v_request, 'request_type', v_type);
  end if;

  raise exception 'forbidden' using errcode = 'insufficient_privilege';
end
$$;

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
  v_from_to    jsonb;
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

  -- RG81: a row update, read by the worker at its next consumption; the shape is checked by 0103
  update leads.sync_settings
     set value = v_payload -> 'value', updated_by_account_id = v_caller
   where key = p_key;

  -- RG81: the accounts skipped for a reason this key decides are re-evaluated (EC-J8-29)
  if v_previous is distinct from (v_payload -> 'value') then
    v_reasons := case p_key
      when 'apollo_scope'                 then array['out_of_apollo_scope', 'out_of_apollo_scope_individual']
      when 'apollo_excluded_countries' then array['country_excluded', 'country_not_validated']
      when 'apollo_legal_basis'           then array['no_consent']
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
  end if;

  -- EC-J8-30: the old and new values, or their digests when either is large
  v_from_to := case
    when pg_catalog.octet_length(v_previous::text) > 3000
         or pg_catalog.octet_length((v_payload -> 'value')::text) > 3000 then
      pg_catalog.jsonb_build_object('from_md5', pg_catalog.md5(v_previous::text),
                                    'to_md5', pg_catalog.md5((v_payload -> 'value')::text))
    else pg_catalog.jsonb_build_object('from', v_previous, 'to', v_payload -> 'value')
  end;

  -- last: the chain lock is held until COMMIT (EC-J8-28: one stable uuid per key)
  perform audit.append('settings.changed', 'setting',
                       pg_catalog.md5('leads.sync_settings:' || p_key)::uuid,
                       pg_catalog.jsonb_build_object('key', p_key,
                                                     'reason_code', p_reason_code,
                                                     'dual_control_request_id', p_dual_control_request_id,
                                                     'dual_control', v_mode,
                                                     'reevaluated', v_count) || v_from_to);
  return v_count;
end
$$;

create or replace function backoffice.read_apollo_settings()
returns table (key text, value jsonb, updated_at timestamptz, updated_by_account_id uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform identity.require_active_admin();
  return query
  select s.key, s.value, s.updated_at, s.updated_by_account_id
    from leads.sync_settings s
   where s.key in ('apollo_scope', 'apollo_excluded_countries', 'apollo_legal_basis')
   order by s.key;
end
$$;


comment on function backoffice.canonical_dual_control_payload(text, jsonb, uuid) is
  'The closed list of 2V actions and the exact shape of each payload (03 PD4; identifiers and codes, '
  'C(33) spirit): identity.grant_role {"account_id", "role"} (never the caller, an active target); '
  'identity.change_member_role {"account_id", "role": "advertiser", "legal_name"} (an active creator, '
  'never the caller, a name of 2 to 120 printable characters: EC-J8-23, 0134); identity.invite_admin '
  '{"invitation_id"} (a live invitation proposing admin, not yet confirmed, EC-J8-12, 0131); '
  'leads.change_apollo_setting {"key", "value"} (apollo_scope, apollo_excluded_countries sorted '
  'and known, apollo_legal_basis: the shapes of 0103, 0134); privacy.approve_data_request {"request_id", '
  '"request_type": access | erasure} (a self-service request of that type, open, by an active account '
  'other than the caller, never approved: 0137). Returns the canonical payload, compared whole by the '
  'action function; 42501 forbidden otherwise. SECURITY INVOKER owned by influx_identity_definer, NO '
  'grant.';

comment on function backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text) is
  '05 RG81, RG83, RG84 (0141: block-list); 03 §1.3 (J · 2V · R): an active admin in aal2 writes one '
  'Apollo key of leads.sync_settings (apollo_scope | apollo_excluded_countries | apollo_legal_basis) '
  'with a fresh second factor on p_session_id, consuming the confirmed request '
  'leads.change_apollo_setting {key, value (canonical: countries sorted)} with this reason '
  '(founder_decision | legal_validation | legal_restriction | configuration_error), by its confirmer. '
  'When the value changes, every active member account whose Apollo contact was skipped for a reason '
  'the key decides (scope: out_of_apollo_scope*; countries: country_excluded, country_not_validated; '
  'legal basis: no_consent) gets ONE lead.updated to apollo_contact (priority 100, EC-J8-29). Writes '
  'settings.changed {key, from, to (or from_md5, to_md5, EC-J8-30), reason_code, '
  'dual_control_request_id, dual_control, reevaluated} on md5(''leads.sync_settings:'' || key)::uuid '
  '(EC-J8-28). Returns the number re-evaluated. Any refusal: 42501 forbidden; a value refused by 0103: '
  '23514 / 23503. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_admin ONLY.';

reset role;
revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

drop policy if exists sync_settings_identity_definer_select_apollo on leads.sync_settings;
create policy sync_settings_identity_definer_select_apollo on leads.sync_settings
  for select to influx_identity_definer
  using (key in ('apollo_scope', 'apollo_excluded_countries', 'apollo_legal_basis'));

drop policy if exists sync_settings_identity_definer_update_apollo on leads.sync_settings;
create policy sync_settings_identity_definer_update_apollo on leads.sync_settings
  for update to influx_identity_definer
  using (key in ('apollo_scope', 'apollo_excluded_countries', 'apollo_legal_basis'))
  with check (key in ('apollo_scope', 'apollo_excluded_countries', 'apollo_legal_basis')
              and updated_by_account_id = (select influx.current_account_id()));

-- 5. The accounts skipped for a country before 0141, re-evaluated once (as change_apollo_setting) ------

with candidates as (
  select s.account_id, pg_catalog.gen_random_uuid() as event_id
    from leads.contact_sync_states s
    join identity.accounts a on a.id = s.account_id and a.status = 'active'
   where s.destination = 'apollo_contact'
     and s.last_status = 'skipped'
     and s.last_error_code = 'country_not_validated'
     and exists (select 1 from identity.account_roles r
                  where r.account_id = s.account_id and r.role in ('advertiser', 'creator'))
)
insert into leads.outbox_events
  (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
select c.event_id, 'lead.updated', 'apollo_contact', 'account:' || c.account_id::text, 100,
       pg_catalog.jsonb_build_object('event_id', c.event_id, 'account_id', c.account_id),
       'lead.updated:' || c.event_id::text
  from candidates c;
