-- =============================================================================
-- 0134_backoffice_settings_suppression_alerts
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 6. The database side of the action API of the backoffice v0
-- (05 RG81, RG93, RG104, RG108, CA62, CA63; 15 §F; 03 §1.3 PD1 to PD7):
--
--   2V list   + leads.change_apollo_setting {key, value} (05 RG81 "réservé au rôle admin",
--             21 §J8 commit 6 "2V + R"); identity.change_member_role carries the legal name
--             of the new brand in its payload: {account_id, role, legal_name} (EC-J8-23
--             settled: the name is covered by the second pair of eyes).
--   backoffice.change_apollo_setting()   05 RG81: an admin, with a fresh second factor (R),
--             consumes a confirmed 2V request and writes one of the three Apollo keys of
--             leads.sync_settings (no redeployment, D33). settings.changed {key, from, to,
--             reason_code, dual_control_request_id, dual_control, reevaluated}. The accounts
--             skipped for a reason the key decides are RE-EVALUATED: one lead.updated to
--             apollo_contact each (out_of_apollo_scope*, country_not_validated, no_consent
--             under the legal basis), read again by the worker at consumption (RG37).
--   backoffice.lift_brevo_suppression()  05 RG93, CA55: an admin, with R, a typed reason,
--             lifts the suppression recorded after a spam complaint (0116). Journaled
--             leads.suppression_lifted. The contact is NOT resubscribed by the lift itself
--             (EC-J8-27): when the marketing consent in force was given AFTER the
--             unsubscription, one consent.granted goes to brevo_contact (the only event that
--             lifts the blacklist at Brevo, J6T-3); otherwise the next consent of the member
--             will.
--   backoffice.record_refused_action()   05 CA63, 15 RG110, AL39: an agent refused an admin
--             action (Apollo setting, suppression lift, 2V) leaves a trace, written by the
--             refusal itself: backoffice.action_refused {action_code} on his own account.
--   backoffice.read_apollo_settings()    the three Apollo keys for the admin screen
--             (no table right on leads.sync_settings for any execution role, 0103).
--   backoffice.last_brevo_reconciliation()  AL27 (05 RG91, RG104): the last finished run of
--             the daily reconciliation and its gap (ops.periodic_runs.counts, 0117), for
--             influx_admin; codes and counts only.
--   AL25      thresholds written (05 RG104 was silent, CA62 gives 15 minutes): a destination
--             is down when nothing of it succeeded for 15 minutes while lines wait after a
--             failure; a refused key (brevo.unauthorized, apollo.unauthorized) is at once.
--
-- EC-J8 (micro-gaps, the safest choice):
--   EC-J8-27  the suppression lift resubscribes only on a consent given after the
--             unsubscription (never the consent of the sign-up, given before the complaint);
--             no 2V (RG93 asks admin, reason, journal; 03 §3.1 R for an admin action).
--   EC-J8-28  subject of settings.changed: md5('leads.sync_settings:' || key)::uuid, one
--             stable uuid per key (the register wants a uuid, the key is text).
--   EC-J8-29  the re-evaluation lines carry priority 100 (no P2 introduced before the
--             architecte's P1 < P2 step, reliquat J7); one line per account, no dedup against
--             a live line (the worker reads the settings of the attempt anyway).
--   EC-J8-30  the Apollo key under 2V carries its whole value; a value of more than 3000
--             bytes on either side is journaled by its md5 (the register line stays < 8000).
--
-- ROLLBACK (before any real use): restore the 0132 bodies of
-- backoffice.canonical_dual_control_payload() and identity.change_member_role(), and the
-- constraint dual_control_action_code_closed of 0132; drop the five new functions; restore the
-- AL25 threshold of 0130; revoke the grants of sections 3 and 7, drop the policies of section 7; delete
-- the two codes of section 1 (possible only while no line references them).
-- =============================================================================

-- 1. The register codes ---------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 05 RG93: the suppression after a complaint lifted by an admin (explicit, reasoned)
  ('leads.suppression_lifted',  'leads',      'account', 'critical'),
  -- 05 CA63, 15 RG110: an internal account refused an action for want of the right role
  ('backoffice.action_refused', 'backoffice', 'account', 'sensitive')
on conflict (code) do nothing;

-- 2. The closed list of 2V actions ------------------------------------------------------------------

alter table backoffice.dual_control_requests drop constraint if exists dual_control_action_code_closed;
alter table backoffice.dual_control_requests add constraint dual_control_action_code_closed
  check (action_code in ('identity.grant_role', 'identity.invite_admin', 'identity.change_member_role',
                         'leads.change_apollo_setting'));

comment on column backoffice.dual_control_requests.action_code is
  'Closed list (CHECK): identity.grant_role (0130), identity.invite_admin (0131), '
  'identity.change_member_role (0132), leads.change_apollo_setting (0134). An action enters it with '
  'its consuming function.';

-- 3. The functions of influx_identity_definer --------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity, backoffice to influx_identity_definer;

-- the rights the canonical payload needs at once (the country list of an Apollo key)
grant usage on schema reference to influx_identity_definer;
grant select (code) on reference.countries to influx_identity_definer;

set role influx_identity_definer;

-- 3.1 The canonical payload, extended -------------------------------------------------------------

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
    elsif v_key = 'apollo_prospecting_countries' then
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

  raise exception 'forbidden' using errcode = 'insufficient_privilege';
end
$$;

comment on function backoffice.canonical_dual_control_payload(text, jsonb, uuid) is
  'The closed list of 2V actions and the exact shape of each payload (03 PD4; identifiers and codes, '
  'C(33) spirit): identity.grant_role {"account_id", "role"} (never the caller, an active target); '
  'identity.change_member_role {"account_id", "role": "advertiser", "legal_name"} (an active creator, '
  'never the caller, a name of 2 to 120 printable characters: EC-J8-23, 0134); identity.invite_admin '
  '{"invitation_id"} (a live invitation proposing admin, not yet confirmed, EC-J8-12, 0131); '
  'leads.change_apollo_setting {"key", "value"} (apollo_scope, apollo_prospecting_countries sorted '
  'and known, apollo_legal_basis: the shapes of 0103, 0134). Returns the canonical payload, compared '
  'whole by the action function; 42501 forbidden otherwise. SECURITY INVOKER owned by '
  'influx_identity_definer, NO grant.';

-- 3.2 identity.change_member_role(): the legal name inside the 2V (EC-J8-23) -------------------------

create or replace function identity.change_member_role(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_account_id               uuid,
  p_role                     identity.account_role,
  p_reason_code              text,
  p_legal_name               text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller      uuid;
  v_mode        text;
  v_status_set  boolean;
  v_event       uuid := pg_catalog.gen_random_uuid();
begin
  v_caller := identity.require_active_admin();

  -- C(3), EC-J8-17: never one's own account; creator -> advertiser only, on an active creator
  if p_account_id is null or p_account_id = v_caller
     or p_role is distinct from 'advertiser'
     or p_reason_code is null or p_reason_code not in ('member_request', 'signup_error')
     or p_legal_name is null or pg_catalog.char_length(pg_catalog.btrim(p_legal_name)) < 2
     or pg_catalog.char_length(p_legal_name) > 120 or p_legal_name ~ '[[:cntrl:]]' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform 1
     from identity.accounts a
     join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
    where a.id = p_account_id and a.status = 'active'
      for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- R in THIS transaction, then the 2V consumed once, by its confirmer: the legal name is part of
  -- what the second pair of eyes confirmed (EC-J8-23)
  perform identity.assert_fresh_second_factor(p_session_id);
  v_mode := backoffice.consume_dual_control(
              p_dual_control_request_id,
              'identity.change_member_role',
              pg_catalog.jsonb_build_object('account_id', p_account_id, 'role', p_role,
                                            'legal_name', p_legal_name),
              p_reason_code);

  -- D41: the single role replaced (a revoked role is deleted, 0004), the brand profile created
  delete from identity.account_roles where account_id = p_account_id and role = 'creator';
  insert into identity.account_roles (account_id, role, granted_by_account_id)
  values (p_account_id, 'advertiser', v_caller);
  insert into profiles.advertiser_profiles (account_id, legal_name) values (p_account_id, p_legal_name);

  -- 03 A-9: a role change revokes every open session of the account
  update identity.sessions
     set revoked_at = pg_catalog.now(), revocation_reason = 'role_changed'
   where account_id = p_account_id and revoked_at is null;

  -- RG22: an advertiser is business; its own lead.updated when the status changes
  v_status_set := identity.set_declared_status(p_account_id, 'business', p_reason_code);
  if not v_status_set then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select v_event, 'lead.updated', d.destination, 'account:' || p_account_id::text, 100,
           pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id),
           'lead.updated:' || v_event::text
      from (values ('brevo_contact'::leads.outbox_destination),
                   ('apollo_contact'::leads.outbox_destination)) d (destination);
  end if;

  -- last: the chain lock is held until COMMIT. PD5: the mode of the control.
  perform audit.append('account.role_revoked', 'account', p_account_id,
                       pg_catalog.jsonb_build_object('role', 'creator',
                                                     'reason_code', p_reason_code,
                                                     'dual_control_request_id', p_dual_control_request_id,
                                                     'dual_control', v_mode));
  perform audit.append('account.role_granted', 'account', p_account_id,
                       pg_catalog.jsonb_build_object('role', 'advertiser',
                                                     'reason_code', p_reason_code,
                                                     'dual_control_request_id', p_dual_control_request_id,
                                                     'dual_control', v_mode));
end
$$;

comment on function identity.change_member_role(uuid, uuid, uuid, identity.account_role, text, text) is
  '05 RG108, 03 §3.1 (J · 2V · R · C(3)): an active admin in aal2 changes the role of a member account '
  'other than his own, creator -> advertiser ONLY (EC-J8-17: advertiser -> creator refused, D15 and '
  '05 Q9). R on p_session_id in this transaction; consumes the dual control request '
  'identity.change_member_role {account_id, role: advertiser, legal_name} with this reason '
  '(member_request | signup_error), by its confirmer: the legal name is confirmed by the 2V (EC-J8-23, '
  '0134). Replaces the role (granted by the caller), creates the advertiser profile with p_legal_name '
  '(2 to 120 characters), revokes the open sessions (role_changed), sets the declared status to '
  'business (RG22) and queues ONE lead.updated to Brevo and Apollo; writes account.role_revoked and '
  'account.role_granted {role, reason_code, dual_control_request_id, dual_control}. Any refusal: '
  '42501 forbidden. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_admin ONLY.';

reset role;

revoke create on schema identity, backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- The new functions are created by the migration role, published, then handed to their owner
-- (section 8, 03 P7 rule 5).

-- 3.3 backoffice.change_apollo_setting() (admin, 2V + R; 05 RG81) ------------------------------------

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
      when 'apollo_prospecting_countries' then array['country_not_validated']
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

comment on function backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text) is
  '05 RG81, RG83, RG84; 03 §1.3 (J · 2V · R): an active admin in aal2 writes one Apollo key of '
  'leads.sync_settings (apollo_scope | apollo_prospecting_countries | apollo_legal_basis) with a '
  'fresh second factor on p_session_id, consuming the confirmed request leads.change_apollo_setting '
  '{key, value (canonical: countries sorted)} with this reason (founder_decision | legal_validation | '
  'legal_restriction | configuration_error), by its confirmer. When the value changes, every active '
  'member account whose Apollo contact was skipped for a reason the key decides (scope: '
  'out_of_apollo_scope*; countries: country_not_validated; legal basis: no_consent) gets ONE '
  'lead.updated to apollo_contact (priority 100, EC-J8-29). Writes settings.changed {key, from, to '
  '(or from_md5, to_md5, EC-J8-30), reason_code, dual_control_request_id, dual_control, reevaluated} '
  'on md5(''leads.sync_settings:'' || key)::uuid (EC-J8-28). Returns the number re-evaluated. Any '
  'refusal: 42501 forbidden; a value refused by 0103: 23514 / 23503. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_admin ONLY.';

-- 3.4 backoffice.read_apollo_settings() (admin) ------------------------------------------------------

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
   where s.key in ('apollo_scope', 'apollo_prospecting_countries', 'apollo_legal_basis')
   order by s.key;
end
$$;

comment on function backoffice.read_apollo_settings() is
  '05 RG81: the three Apollo keys of leads.sync_settings, their value, last change and author, for '
  'the admin screen (no execution role holds a right on the table, 0103). An active admin in aal2; '
  '42501 forbidden otherwise. A read of configuration, not of a person: not journaled. SECURITY '
  'DEFINER owned by influx_identity_definer; EXECUTE for influx_admin ONLY.';

-- 3.5 backoffice.lift_brevo_suppression() (admin, R; 05 RG93) ----------------------------------------

create or replace function backoffice.lift_brevo_suppression(
  p_session_id   uuid,
  p_account_id   uuid,
  p_reason_code  text,
  p_comment      text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller        uuid;
  v_unsubscribed  timestamptz;
  v_suppressed    text;
  v_granted       boolean;
  v_granted_at    timestamptz;
  v_resync        boolean := false;
  v_fact          uuid := pg_catalog.gen_random_uuid();
  v_extra         jsonb := '{}'::jsonb;
begin
  v_caller := identity.require_active_admin();

  if p_reason_code is null
     or p_reason_code not in ('member_request', 'complaint_misattributed', 'provider_error') then
    raise exception 'a reason of the closed list is required' using errcode = 'invalid_parameter_value';
  end if;
  if p_comment is not null and (pg_catalog.length(p_comment) > 500 or p_comment ~ '[[:cntrl:]]') then
    raise exception 'comment too long or not printable' using errcode = 'invalid_parameter_value';
  end if;
  if p_comment is not null then
    v_extra := pg_catalog.jsonb_build_object('comment', p_comment);
  end if;

  -- C(3): never one's own account; an active MEMBER account, locked. Same error as unknown (T14).
  if p_account_id is null or p_account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform 1
     from identity.accounts a
     join identity.account_roles r on r.account_id = a.id and r.role in ('advertiser', 'creator')
    where a.id = p_account_id and a.status = 'active'
      for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- R in THIS transaction (03 §3.1: an admin action on a member's rights)
  perform identity.assert_fresh_second_factor(p_session_id);

  select s.unsubscribed_at, s.suppressed_reason
    into v_unsubscribed, v_suppressed
    from leads.contact_sync_states s
   where s.account_id = p_account_id and s.destination = 'brevo_contact'
     for update;
  if not found or v_suppressed is null then
    raise exception 'no suppression to lift' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update leads.contact_sync_states
     set suppressed_reason = null
   where account_id = p_account_id and destination = 'brevo_contact';

  -- EC-J8-27: resubscribed only on a marketing consent given AFTER the unsubscription (RG37: the
  -- consent in force is the latest event, a refusal wins a tie)
  select c.granted, c.occurred_at
    into v_granted, v_granted_at
    from identity.consent_events c
   where c.account_id = p_account_id and c.purpose = 'marketing_email'
   order by c.occurred_at desc, c.granted
   limit 1;
  if coalesce(v_granted, false)
     and (v_unsubscribed is null or v_granted_at > v_unsubscribed) then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (v_fact, 'consent.granted', 'brevo_contact', 'account:' || p_account_id::text, 100,
            pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', p_account_id,
                                          'purpose', 'marketing_email'),
            'consent.granted:' || v_fact::text);
    v_resync := true;
  end if;

  -- last: the chain lock is held until COMMIT
  perform audit.append('leads.suppression_lifted', 'account', p_account_id,
                       pg_catalog.jsonb_build_object('reason_code', p_reason_code,
                                                     'previous_reason', v_suppressed,
                                                     'resync_queued', v_resync) || v_extra);
  return v_resync;
end
$$;

comment on function backoffice.lift_brevo_suppression(uuid, uuid, text, text) is
  '05 RG93, CA55: an active admin in aal2, with a fresh second factor on p_session_id, lifts the '
  'suppression of the Brevo contact of a MEMBER account other than his own (C(3)), with a reason '
  '(member_request | complaint_misattributed | provider_error; 22023 otherwise) and an optional '
  'comment (500, printable). The unsubscription date stays. When the marketing consent in force was '
  'given after it, ONE consent.granted goes to brevo_contact (EC-J8-27: the only event that lifts the '
  'blacklist at Brevo); returns whether it did. Writes leads.suppression_lifted {reason_code, '
  'previous_reason, resync_queued[, comment]}. 55000 when no suppression is recorded; 42501 forbidden '
  'for the caller, R or the target. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for '
  'influx_admin ONLY.';

-- 3.6 backoffice.record_refused_action() (agent; 05 CA63, 15 RG110) ----------------------------------

create or replace function backoffice.record_refused_action(p_action_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller uuid := influx.current_account_id();
begin
  if v_caller is null
     or influx.current_account_role() is distinct from 'agent'
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'agent'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_action_code is null
     or p_action_code not in ('leads.change_apollo_setting', 'leads.read_apollo_settings',
                              'leads.lift_brevo_suppression', 'backoffice.dual_control',
                              'identity.change_member_role') then
    raise exception 'unknown action code' using errcode = 'invalid_parameter_value';
  end if;
  -- the trace of the attempt, on the caller's own account (AL39 counts them per account)
  perform audit.append('backoffice.action_refused', 'account', v_caller,
                       pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                     'required_role', 'admin'));
end
$$;

comment on function backoffice.record_refused_action(text) is
  '05 CA63, 15 RG110 (AL39): an active agent in aal2 who attempted an admin action leaves its trace: '
  'backoffice.action_refused {action_code, required_role: admin} on his own account. Closed list: '
  'leads.change_apollo_setting, leads.read_apollo_settings, leads.lift_brevo_suppression, '
  'backoffice.dual_control, identity.change_member_role (22023 otherwise). apps/api calls it before '
  'answering 403, in a transaction that commits. SECURITY DEFINER owned by influx_identity_definer; '
  'EXECUTE for influx_agent ONLY.';

-- 4. backoffice.last_brevo_reconciliation() (admin; AL27) --------------------------------------------

create or replace function backoffice.last_brevo_reconciliation()
returns table (period_key text, finished_at timestamptz, outcome text, gap integer)
language sql
stable
security definer
set search_path = ''
as $$
  select r.period_key, r.finished_at, r.outcome::text,
         coalesce((r.counts ->> 'gap')::integer, 0)
    from ops.periodic_runs r
   where r.task_code = 'brevo_reconciliation'
     and r.finished_at is not null
   order by r.finished_at desc
   limit 1
$$;

comment on function backoffice.last_brevo_reconciliation() is
  'AL27 (05 RG90, RG91, RG104): the last FINISHED run of the daily Brevo reconciliation (0117), its '
  'period, end, outcome and gap (counts.gap: the withdrawals the webhook missed). Codes and counts '
  'only, never a person. No row before the first run. SECURITY DEFINER owned by '
  'influx_maintenance_definer; EXECUTE for influx_admin ONLY.';

-- 5. AL25: the thresholds 05 RG104 left open, from CA62 --------------------------------------------

update backoffice.alert_definitions
   set threshold_value = '{"immediate_error_codes": ["brevo.unauthorized", "apollo.unauthorized"], "quota_error_codes": ["brevo.rate_limited", "apollo.rate_limited"], "down_after_minutes": 15}'::jsonb
 where code = 'AL25';

-- 6. Publication --------------------------------------------------------------------------------------

revoke all on function backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.read_apollo_settings()
  from public, anon, authenticated, service_role;
revoke all on function backoffice.lift_brevo_suppression(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.record_refused_action(text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.last_brevo_reconciliation()
  from public, anon, authenticated, service_role;

grant execute on function backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text) to influx_admin;
grant execute on function backoffice.read_apollo_settings() to influx_admin;
grant execute on function backoffice.lift_brevo_suppression(uuid, uuid, text, text) to influx_admin;
grant execute on function backoffice.record_refused_action(text) to influx_agent;
grant execute on function backoffice.last_brevo_reconciliation() to influx_admin;

-- 7. Rights of the owners -----------------------------------------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy.

-- 7.1 influx_identity_definer: the three Apollo keys, read and written
grant select (updated_at, updated_by_account_id) on leads.sync_settings to influx_identity_definer;
grant update (value, updated_by_account_id) on leads.sync_settings to influx_identity_definer;

drop policy if exists sync_settings_identity_definer_select_apollo on leads.sync_settings;
create policy sync_settings_identity_definer_select_apollo on leads.sync_settings
  for select to influx_identity_definer
  using (key in ('apollo_scope', 'apollo_prospecting_countries', 'apollo_legal_basis'));

drop policy if exists sync_settings_identity_definer_update_apollo on leads.sync_settings;
create policy sync_settings_identity_definer_update_apollo on leads.sync_settings
  for update to influx_identity_definer
  using (key in ('apollo_scope', 'apollo_prospecting_countries', 'apollo_legal_basis'))
  with check (key in ('apollo_scope', 'apollo_prospecting_countries', 'apollo_legal_basis')
              and updated_by_account_id = (select influx.current_account_id()));

-- 7.2 influx_identity_definer: the contact states (the re-evaluation reads Apollo's, the lift
-- clears the suppression of Brevo's, and nothing else)
grant select (account_id, destination, last_status, last_error_code, unsubscribed_at, suppressed_reason)
   on leads.contact_sync_states to influx_identity_definer;
grant update (suppressed_reason) on leads.contact_sync_states to influx_identity_definer;

drop policy if exists contact_sync_states_identity_definer_select on leads.contact_sync_states;
create policy contact_sync_states_identity_definer_select on leads.contact_sync_states
  for select to influx_identity_definer
  using (true);

drop policy if exists contact_sync_states_identity_definer_lift on leads.contact_sync_states;
create policy contact_sync_states_identity_definer_lift on leads.contact_sync_states
  for update to influx_identity_definer
  using (destination = 'brevo_contact' and suppressed_reason is not null)
  with check (destination = 'brevo_contact' and suppressed_reason is null);

-- 7.3 influx_maintenance_definer: the outcome and the counts of a run (it wrote them, 0117)
grant select (outcome, counts) on ops.periodic_runs to influx_maintenance_definer;

-- 8. Hand the functions to their owners (03 P7 rule 5, window of 0004 §9) ----------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer, influx_maintenance_definer;

alter function backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text) owner to influx_identity_definer;
alter function backoffice.read_apollo_settings() owner to influx_identity_definer;
alter function backoffice.lift_brevo_suppression(uuid, uuid, text, text) owner to influx_identity_definer;
alter function backoffice.record_refused_action(text) owner to influx_identity_definer;
alter function backoffice.last_brevo_reconciliation() owner to influx_maintenance_definer;

revoke create on schema backoffice from influx_identity_definer, influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 9. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('backoffice.change_apollo_setting(uuid, uuid, text, jsonb, text)',
        'influx_identity_definer', array['influx_admin']),
      ('backoffice.read_apollo_settings()',
        'influx_identity_definer', array['influx_admin']),
      ('backoffice.lift_brevo_suppression(uuid, uuid, text, text)',
        'influx_identity_definer', array['influx_admin']),
      ('backoffice.record_refused_action(text)',
        'influx_identity_definer', array['influx_agent']),
      ('identity.change_member_role(uuid, uuid, uuid, identity.account_role, text, text)',
        'influx_identity_definer', array['influx_admin']),
      ('backoffice.last_brevo_reconciliation()',
        'influx_maintenance_definer', array['influx_admin'])
    ) as t (fn, owner, callers)
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
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;

  if (select prosecdef from pg_catalog.pg_proc
       where oid = 'backoffice.canonical_dual_control_payload(text, jsonb, uuid)'::regprocedure) then
    raise exception 'backoffice.canonical_dual_control_payload() must stay SECURITY INVOKER';
  end if;

  -- still nobody but its writers on the configuration: no execution role reads or writes it
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname in ('influx_agent', 'influx_admin', 'influx_worker', 'influx_app', 'influx_auth')
     and (pg_catalog.has_any_column_privilege(r.oid, 'leads.sync_settings', 'SELECT')
          or pg_catalog.has_any_column_privilege(r.oid, 'leads.sync_settings', 'UPDATE'));
  if v_bad is not null then
    raise exception 'unexpected right(s) on leads.sync_settings: %', v_bad;
  end if;

  -- the register: still no write right but the writer's insert (03 P8 layer 1)
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_table_privilege(r.oid, 'audit.audit_events', 'UPDATE, DELETE, TRUNCATE')
          or (r.rolname <> 'influx_audit_writer'
              and pg_catalog.has_table_privilege(r.oid, 'audit.audit_events', 'INSERT')));
  if v_bad is not null then
    raise exception 'unexpected write right(s) on the register: %', v_bad;
  end if;

  if (select count(*) from audit.event_types
       where code in ('leads.suppression_lifted', 'backoffice.action_refused')) <> 2 then
    raise exception 'the two codes of 0134 are not in audit.event_types';
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_identity_definer', 'influx_maintenance_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_maintenance_definer', 'backoffice', 'CREATE') then
    raise exception 'a function owner kept CREATE on a schema';
  end if;
end
$$;
