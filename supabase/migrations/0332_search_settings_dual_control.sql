-- =============================================================================
-- 0332_search_settings_dual_control
-- -----------------------------------------------------------------------------
-- Lot 3 / L3G, commit 08 (jalons/l3g/08.md; l3g-fiche.md invariant 10, 3, 12, 15; jalons/l3g/modele.md
-- §7, which PREVAILS for every name; D84, D38 Q2; 03 §1.3 PD3 to PD7; archives/jalons/l3e/annexe.md
-- L3ES-2). The two writers of the search settings no longer write on the word of one administrator:
-- each consumes a dual control confirmed by ANOTHER admin (aal2, fresh second factor), and the
-- degraded form of a single operator is refused (a peer only). Signalled I-4 (03): the closed list of
-- backoffice.dual_control_requests, the canonical payloads, the consuming wrapper and its new caller,
-- two SECURITY DEFINER functions recreated with new signatures.
--
-- 1. backoffice.dual_control_requests: search.change_setting and search.change_facet enter the closed
--    list (CHECK dual_control_action_code_closed).
-- 2. backoffice.canonical_dual_control_payload() (0231 restated verbatim) gains two branches, so that
--    request_dual_control() (influx_admin) opens them:
--      search.change_setting {"key", "value"}: a key of the shape of a setting name (its row, the
--        closed list of search.search_settings, is checked by the writer: the owner of the 2V reads no
--        search table), any value present (the CHECK of search_settings decides at the write);
--      search.change_facet {"facet_code", "is_open", "display_order"}: a facet code of the shape Fn, a
--        boolean, a whole number 1 to 99;
--    both refused while no other admin can confirm (backoffice.has_peer_admin(), PD7): no request that
--    only the degraded form could confirm (D38 Q2, fiche invariant 10).
-- 3. backoffice.consume_dual_control_for() (0231) accepts the two actions besides
--    verification.revoke_badge, and is executed by influx_search_admin_definer too.
-- 4. search.write_search_setting() and search.write_facet_setting(): the signatures of 0316 DROPPED,
--    recreated as (p_session_id, p_dual_control_request_id, …, p_reason_code[, p_note]). In order: the
--    caller (search.require_search_admin(), 42501), the inputs and the row of the key or of the facet
--    (22023 key, value, is_open, display_order, note, facet_code), the reason (22023 reason: one of
--    critical_mass_reached, founder_decision, abuse_response, configuration_error), then the 2V
--    consumed once by its confirmer with R on p_session_id (backoffice.consume_dual_control_for(),
--    42501), a mode other than peer refused (42501: degraded_single_operator, pair seul). The rest of
--    0316 unchanged: the global lock, a value unchanged writes nothing (the request is consumed), the
--    CHECK as 22023, the versions (a facet, k, the cold quota), search.settings_changed {table, key,
--    before, after, facet_config_version} plus {dual_control_request_id, dual_control}. EXECUTE for
--    influx_admin only.
--
-- RIGHTS (03 I-4, signalled): EXECUTE on backoffice.consume_dual_control_for() to
-- influx_search_admin_definer (no right of it on backoffice.dual_control_requests); the CHECK and the
-- canonical payloads above; the two writers recreated, EXECUTE for influx_admin only. NOTHING to a
-- member nor to an agent; the values of the settings and the switch of staging untouched.
--
-- Not here: the routes and contracts (L3G-10: POST /v1/bo/dual-control, …/:id/confirm, the action
-- codes of apps/api), the screen (L3G-13). The test kits keep writing the settings as the migration
-- role in the test base (modele §7: no trigger, no writer).
--
-- EC-L3G-08 (micro-gaps, the safest choice):
--   EC-L3G-08-1  the canonical payload checks the SHAPE of a key or of a facet code; their rows (the
--                closed lists of search_settings and facet_settings) are checked by the writer BEFORE
--                the consumption (22023 key, facet_code): influx_identity_definer reads no search
--                table, and a second list in the 2V would drift from the CHECK.
--   EC-L3G-08-2  the note of a facet version is not in the 2V payload (a free text, as the note of a
--                request, PD4): the 2V covers the code, the opening and the order.
--   EC-L3G-08-3  the reason is checked by the writer (22023 reason) before the consumption; the
--                request carries it (request_dual_control() checks its shape only) and the
--                consumption compares it.
--   EC-L3G-08-4  a request confirmed in the degraded form (the peer left after the request) is refused
--                at the write (42501), its consumption rolled back with it: it stays unconsumed until
--                its expiry.
--   EC-L3G-08-5  consume_dual_control_for() cannot tell its two callers apart (a SECURITY DEFINER
--                function sees its owner): each caller passes its own action code as a constant.
--
-- ROLLBACK (before any setting is written under 2V): drop the two writers; re-run §8.2 to §8.3 and
-- their grants from 0316 as influx_search_admin_definer; restate consume_dual_control_for() and
-- canonical_dual_control_payload() as in 0231 and revoke EXECUTE on the first from
-- influx_search_admin_definer; restate dual_control_action_code_closed as in 0231 (no request of the
-- two actions may remain).
-- =============================================================================

-- 1. The closed list of 2V (modele §7) -------------------------------------------------------------

alter table backoffice.dual_control_requests drop constraint if exists dual_control_action_code_closed;
alter table backoffice.dual_control_requests add constraint dual_control_action_code_closed
  check (action_code in ('identity.grant_role', 'identity.invite_admin', 'identity.change_member_role',
                         'leads.change_apollo_setting', 'privacy.approve_data_request',
                         'verification.revoke_badge', 'search.change_setting', 'search.change_facet'));

comment on column backoffice.dual_control_requests.action_code is
  'Closed list (CHECK): identity.grant_role (0130), identity.invite_admin (0131), '
  'identity.change_member_role (0132), leads.change_apollo_setting (0134), privacy.approve_data_request '
  '(0137), verification.revoke_badge (0231: opened by an agent or an admin through '
  'backoffice.open_dual_control_for(), never through request_dual_control()), search.change_setting and '
  'search.change_facet (0332: a peer only, consumed by search.write_search_setting() and '
  'write_facet_setting()). An action enters it with its consuming function.';

-- 2. The functions of influx_identity_definer: the canonical payloads, the consuming wrapper ----------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;
set role influx_identity_definer;

-- 2.1 0231 restated verbatim but for the two branches of the search settings (modele §7)
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
      -- PLT-5, PLS-5 (0231): a basis is a string before it is compared (lax mode let 1, [], {} in)
      if pg_catalog.jsonb_typeof(v_value) is distinct from 'object'
         or not (v_value ?& array['default', 'by_country'])
         or (v_value - 'default' - 'by_country') <> '{}'::jsonb
         or (v_value ->> 'default') is null
         or (v_value ->> 'default') not in ('consentement_requis', 'interet_legitime_avec_opposition')
         or pg_catalog.jsonb_typeof(v_value -> 'by_country') is distinct from 'object'
         or pg_catalog.jsonb_path_exists(v_value -> 'by_country',
              '$.keyvalue() ? (!(@.key like_regex "^[A-Z]{2}$")
                               || @.value.type() != "string"
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

  if p_action_code = 'search.change_setting' then
    -- 0332 (D84, L3ES-2): exactly {"key", "value"}, a key of the shape of a setting name (its row is
    -- checked by the writer, EC-L3G-08-1), a value present within the size of search_settings (its
    -- CHECK decides at the write); D38 Q2: a peer only, never a request for the degraded form
    if (p_payload - 'key' - 'value') <> '{}'::jsonb
       or not (p_payload ? 'value')
       or pg_catalog.jsonb_typeof(p_payload -> 'key') is distinct from 'string'
       or (p_payload ->> 'key') !~ '^[a-z][a-z0-9_]{1,62}$'
       or pg_catalog.pg_column_size(p_payload -> 'value') > 2000
       or not backoffice.has_peer_admin(p_caller) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object('key', p_payload ->> 'key', 'value', p_payload -> 'value');
  end if;

  if p_action_code = 'search.change_facet' then
    -- 0332 (D84, L3ES-2): exactly {"facet_code", "is_open", "display_order"}, a code of the shape Fn
    -- (its row is checked by the writer), a boolean, a whole number 1 to 99 (the CHECK of
    -- facet_settings decides the opening at the write); D38 Q2: a peer only
    if (p_payload - 'facet_code' - 'is_open' - 'display_order') <> '{}'::jsonb
       or pg_catalog.jsonb_typeof(p_payload -> 'facet_code') is distinct from 'string'
       or (p_payload ->> 'facet_code') !~ '^F[1-9][0-9]?$'
       or pg_catalog.jsonb_typeof(p_payload -> 'is_open') is distinct from 'boolean'
       or pg_catalog.jsonb_typeof(p_payload -> 'display_order') is distinct from 'number'
       or not pg_catalog.jsonb_path_exists(p_payload,
                '$.display_order ? (@ >= 1 && @ <= 99 && @.floor() == @)')
       or not backoffice.has_peer_admin(p_caller) then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    return pg_catalog.jsonb_build_object(
             'facet_code', p_payload ->> 'facet_code',
             'is_open', (p_payload ->> 'is_open')::boolean,
             'display_order', (p_payload ->> 'display_order')::numeric::integer);
  end if;

  -- verification.revoke_badge (0231) has no branch: request_dual_control() refuses it, the agent
  -- door is backoffice.open_dual_control_for()
  raise exception 'forbidden' using errcode = 'insufficient_privilege';
end
$$;

comment on function backoffice.canonical_dual_control_payload(text, jsonb, uuid) is
  'The closed list of the 2V actions of request_dual_control() and the exact shape of each payload '
  '(03 PD4; identifiers and codes, C(33) spirit): identity.grant_role {"account_id", "role"} (never '
  'the caller, an active target); identity.change_member_role {"account_id", "role": "advertiser", '
  '"legal_name"} (an active creator, never the caller, a name of 2 to 120 printable characters: '
  'EC-J8-23, 0134); identity.invite_admin {"invitation_id"} (a live invitation proposing admin, not '
  'yet confirmed, EC-J8-12, 0131); leads.change_apollo_setting {"key", "value"} (apollo_scope, '
  'apollo_excluded_countries sorted and known, apollo_legal_basis whose bases are strings of the '
  'closed list, PLT-5 in 0231: the shapes of 0103, 0134, 0151); privacy.approve_data_request '
  '{"request_id", "request_type": access | erasure} (a self-service request of that type, open, by an '
  'active account other than the caller, never approved: 0137); search.change_setting {"key", '
  '"value"} and search.change_facet {"facet_code", "is_open", "display_order"} (0332: shapes only, '
  'the rows checked by the writers; refused while no other admin can confirm, D38 Q2). '
  'verification.revoke_badge has NO branch (0231: opened through backoffice.open_dual_control_for() '
  'only). Returns the canonical payload, compared whole by the action function; 42501 forbidden '
  'otherwise. SECURITY INVOKER owned by influx_identity_definer, NO grant.';

-- 2.2 The consumption of a 2V by the owner of its action (0231 restated: two actions more)
create or replace function backoffice.consume_dual_control_for(
  p_session_id   uuid,
  p_request_id   uuid,
  p_action_code  text,
  p_payload      jsonb,
  p_reason_code  text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- the actions consumed outside influx_identity_definer: the withdrawal of a badge (0231) and the
  -- two search settings (0332); each caller passes its own code as a constant (EC-L3G-08-5)
  if p_action_code is null
     or p_action_code not in ('verification.revoke_badge', 'search.change_setting',
                              'search.change_facet') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform identity.require_active_admin();
  -- R in THIS transaction, then the 2V consumed once, by its confirmer
  perform identity.assert_fresh_second_factor(p_session_id);
  return backoffice.consume_dual_control(p_request_id, p_action_code, p_payload, p_reason_code);
end
$$;

comment on function backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text) is
  'modele point 4 (0231; 03 PD3 to PD7), l3g/modele.md §7 (0332): an active admin in aal2, with R on '
  'p_session_id (TOTP within 300 s, the session of the request), consumes the confirmed 2V '
  'p_request_id of verification.revoke_badge, search.change_setting or search.change_facet only, for '
  'exactly p_payload and p_reason_code, by its confirmer (backoffice.consume_dual_control(): the '
  'peer, or the requester in degraded mode while no peer admin exists; the search writers refuse the '
  'latter). Returns peer or degraded_single_operator. 42501 forbidden otherwise. SECURITY DEFINER '
  'owned by influx_identity_definer, empty search_path; EXECUTE for influx_verification_definer and '
  'influx_search_admin_definer ONLY.';

revoke all on function backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
grant execute on function backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text)
  to influx_verification_definer, influx_search_admin_definer;

reset role;
revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 3. The two writers of the settings, under a peer's control (modele §7; fiche invariant 10) ---------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_search_admin_definer', current_user);
end
$$;
grant create on schema search to influx_search_admin_definer;
set role influx_search_admin_definer;

-- the signatures of 0316 go: no writer of a setting outside the 2V remains
drop function if exists search.write_search_setting(text, jsonb);
drop function if exists search.write_facet_setting(text, boolean, integer, text);

-- 3.1 A search setting (10 RG2, RG57, RG63; l3e/modele §9; l3g/modele §7)
create or replace function search.write_search_setting(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_key                      text,
  p_value                    jsonb,
  p_reason_code              text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := search.require_search_admin();
  v_payload  jsonb;
  v_mode     text;
  v_before   jsonb;
  v_version  bigint;
begin
  if p_key is null
     or not exists (select 1 from search.search_settings s where s.key = p_key) then
    raise exception 'key' using errcode = 'invalid_parameter_value', detail = 'key';
  end if;
  if p_value is null then
    raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
  end if;
  if p_reason_code is null
     or p_reason_code not in ('critical_mass_reached', 'founder_decision', 'abuse_response',
                              'configuration_error') then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;

  -- the canonical form of the request (canonical_dual_control_payload(), 0332), compared whole; R on
  -- p_session_id in this transaction, the 2V consumed once by its confirmer (03 PD3 to PD7)
  v_payload := pg_catalog.jsonb_build_object('key', p_key, 'value', p_value);
  v_mode := backoffice.consume_dual_control_for(p_session_id, p_dual_control_request_id,
                                                'search.change_setting', v_payload, p_reason_code);
  -- D38 Q2, fiche invariant 10: a peer only, never the degraded form of a single operator
  if v_mode is distinct from 'peer' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- one writer of the configuration at a time: a version always reads the state it follows
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('search.settings', 0));

  select s.value into v_before from search.search_settings s where s.key = p_key for update;
  if not found then
    raise exception 'key' using errcode = 'invalid_parameter_value', detail = 'key';
  end if;
  if v_before = p_value then
    select max(v.version) into v_version from search.facet_config_versions v;
    return v_version;
  end if;

  begin
    update search.search_settings
       set value = p_value, updated_by_account_id = v_caller, updated_at = pg_catalog.now()
     where key = p_key;
  exception
    when check_violation then
      raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
  end;

  -- RG88: k and the cold quota change what a search serves, so they open a version too
  if p_key in ('k_anonymity_threshold', 'cold_profile_quota') then
    insert into search.facet_config_versions (changed_by_account_id, snapshot)
    values (v_caller, search.facet_config_snapshot())
    returning version into v_version;
  else
    select max(v.version) into v_version from search.facet_config_versions v;
  end if;

  -- last: the chain lock is the last lock of the transaction (04 §7.2)
  perform audit.append('search.settings_changed', 'search_setting',
                       pg_catalog.md5('search.search_settings:' || p_key)::uuid,
                       pg_catalog.jsonb_build_object(
                         'table', 'search_settings', 'key', p_key,
                         'before', v_before, 'after', p_value,
                         'facet_config_version', v_version,
                         'dual_control_request_id', p_dual_control_request_id,
                         'dual_control', v_mode));
  return v_version;
end
$$;

comment on function search.write_search_setting(uuid, uuid, text, jsonb, text) is
  '10 RG2, RG57, RG63; l3e/modele.md §9 (0316), l3g/modele.md §7 (0332; D84, D38 Q2): an '
  'administrator changes a search setting under a peer''s control. 42501 outside an active admin in '
  'aal2; 22023 key (NULL or outside the ten), value (NULL, or a shape refused by the CHECK), reason '
  '(outside critical_mass_reached, founder_decision, abuse_response, configuration_error); then the '
  '2V search.change_setting {key, value} with this reason, confirmed by ANOTHER admin, consumed once '
  'by that confirmer with R on p_session_id (backoffice.consume_dual_control_for()); 42501 otherwise, '
  'and for the degraded form of a single operator. A value unchanged writes nothing (the request is '
  'consumed). A change writes search.settings_changed {table, key, before, after, '
  'facet_config_version, dual_control_request_id, dual_control} on '
  'md5(''search.search_settings:'' || key)::uuid, and a version when the key is '
  'k_anonymity_threshold or cold_profile_quota (RG88). Returns the facet configuration version in '
  'force. SECURITY DEFINER owned by influx_search_admin_definer; EXECUTE for influx_admin only.';

-- 3.2 A facet (10 RG11, RG88; l3e/modele §9; l3g/modele §7)
create or replace function search.write_facet_setting(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_code                     text,
  p_is_open                  boolean,
  p_display_order            integer,
  p_reason_code              text,
  p_note                     text)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller       uuid := search.require_search_admin();
  v_note         text := nullif(pg_catalog.btrim(p_note), '');
  v_payload      jsonb;
  v_mode         text;
  v_before_open  boolean;
  v_before_order smallint;
  v_version      bigint;
begin
  if p_is_open is null then
    raise exception 'is_open' using errcode = 'invalid_parameter_value', detail = 'is_open';
  end if;
  if p_display_order is null or p_display_order not between 1 and 99 then
    raise exception 'display_order' using errcode = 'invalid_parameter_value', detail = 'display_order';
  end if;
  if v_note is not null and pg_catalog.char_length(v_note) > 500 then
    raise exception 'note' using errcode = 'invalid_parameter_value', detail = 'note';
  end if;
  if p_code is null
     or not exists (select 1 from search.facet_settings f where f.facet_code = p_code) then
    raise exception 'facet_code' using errcode = 'invalid_parameter_value', detail = 'facet_code';
  end if;
  if p_reason_code is null
     or p_reason_code not in ('critical_mass_reached', 'founder_decision', 'abuse_response',
                              'configuration_error') then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;

  -- the canonical form of the request, compared whole (the note stays out of it, EC-L3G-08-2)
  v_payload := pg_catalog.jsonb_build_object('facet_code', p_code, 'is_open', p_is_open,
                                             'display_order', p_display_order);
  v_mode := backoffice.consume_dual_control_for(p_session_id, p_dual_control_request_id,
                                                'search.change_facet', v_payload, p_reason_code);
  -- D38 Q2, fiche invariant 10: a peer only
  if v_mode is distinct from 'peer' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('search.settings', 0));

  select f.is_open, f.display_order into v_before_open, v_before_order
    from search.facet_settings f
   where f.facet_code = p_code
     for update;
  if not found then
    raise exception 'facet_code' using errcode = 'invalid_parameter_value', detail = 'facet_code';
  end if;
  if v_before_open = p_is_open and v_before_order = p_display_order then
    select max(v.version) into v_version from search.facet_config_versions v;
    return v_version;
  end if;

  begin
    update search.facet_settings
       set is_open = p_is_open, display_order = p_display_order,
           updated_by_account_id = v_caller, updated_at = pg_catalog.now()
     where facet_code = p_code;
  exception
    when check_violation then
      -- outside the base, or F12 while D78 holds
      raise exception 'facet_not_openable'
        using errcode = 'invalid_parameter_value', detail = 'facet_not_openable';
  end;

  insert into search.facet_config_versions (changed_by_account_id, snapshot, note)
  values (v_caller, search.facet_config_snapshot(), v_note)
  returning version into v_version;

  perform audit.append('search.settings_changed', 'search_setting',
                       pg_catalog.md5('search.facet_settings:' || p_code)::uuid,
                       pg_catalog.jsonb_build_object(
                         'table', 'facet_settings', 'key', p_code,
                         'before', pg_catalog.jsonb_build_object('is_open', v_before_open,
                                                                 'display_order', v_before_order),
                         'after', pg_catalog.jsonb_build_object('is_open', p_is_open,
                                                                'display_order', p_display_order),
                         'facet_config_version', v_version,
                         'dual_control_request_id', p_dual_control_request_id,
                         'dual_control', v_mode));
  return v_version;
end
$$;

comment on function search.write_facet_setting(uuid, uuid, text, boolean, integer, text, text) is
  '10 RG11, RG88; l3e/modele.md §9 (0316), l3g/modele.md §7 (0332; D84, D38 Q2): an administrator '
  'opens, closes or orders a facet under a peer''s control. 42501 outside an active admin in aal2; '
  '22023 is_open (NULL), display_order (outside 1 to 99), note (over 500 characters, trimmed), '
  'facet_code (unknown), reason (outside the four of write_search_setting()); then the 2V '
  'search.change_facet {facet_code, is_open, display_order} with this reason, confirmed by ANOTHER '
  'admin, consumed once by that confirmer with R on p_session_id; 42501 otherwise, and for the '
  'degraded form of a single operator; 22023 facet_not_openable (outside the base, or F12 while D78 '
  'holds). Unchanged: nothing written (the request is consumed). A change inserts a version (its '
  'note) and writes search.settings_changed {table, key, before, after, facet_config_version, '
  'dual_control_request_id, dual_control} on md5(''search.facet_settings:'' || code)::uuid; returns '
  'the version. SECURITY DEFINER owned by influx_search_admin_definer; EXECUTE for influx_admin only.';

revoke all on function search.write_search_setting(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function search.write_facet_setting(uuid, uuid, text, boolean, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function search.write_search_setting(uuid, uuid, text, jsonb, text) to influx_admin;
grant execute on function search.write_facet_setting(uuid, uuid, text, boolean, integer, text, text)
  to influx_admin;

reset role;
revoke create on schema search from influx_search_admin_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_search_admin_definer', current_user);
end
$$;

-- 4. The comments of the two tables (their owner, the migration role) -------------------------------

comment on table search.search_settings is
  'The settings of the creator search, as data (04 §5.5; 10 RG2, RG57, RG63; l3e/modele.md §9; '
  'l3f/modele.md §5; l3g/modele.md §1, §7): a closed list of ten keys, the shape of each value checked '
  'in base (EC-L3E-03-1) and by its zod schema (packages/contracts, search-settings.ts). '
  'is_open_to_advertisers FALSE: closed, no list (D38, CA59). identified_view: the pages of the '
  'identified view of the agents (0328). Read at EVERY search, never at start. Written by '
  'search.write_search_setting() only (influx_admin, aal2, a 2V search.change_setting confirmed by '
  'another admin: 0332, D38 Q2), every change a line search.settings_changed (before, after, the 2V), '
  'a change of k or of the cold quota a version of search.facet_config_versions.';

comment on table search.facet_settings is
  'The opening of each facet of the creator search, as data (10 RG11; 04 §5.5): its wave (RG12 base, '
  'RG13 second, RG14 third), open or not, its display order. The base is open from the first day but '
  'F12 (D78: 7 facets at the pilot); an open facet belongs to the base (modele §9). Written by '
  'search.write_facet_setting() only (influx_admin, aal2, a 2V search.change_facet confirmed by '
  'another admin: 0332, D38 Q2), every change a version of search.facet_config_versions (RG88) and a '
  'line search.settings_changed. Read at every search.';

-- 5. End-state assertions (03 P7; fiche invariants 3, 10) ------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  v_def  record;
  v_bad  text;
begin
  -- no writer of a setting outside the 2V remains
  if to_regprocedure('search.write_search_setting(text, jsonb)') is not null
     or to_regprocedure('search.write_facet_setting(text, boolean, integer, text)') is not null then
    raise exception 'a writer of 0316 without dual control is still there';
  end if;

  -- owner, mode, empty search_path, static SQL, EXECUTE for their callers only
  for v_def in
    select * from (values
      ('search.write_search_setting(uuid, uuid, text, jsonb, text)', 'influx_search_admin_definer',
       array['influx_admin']),
      ('search.write_facet_setting(uuid, uuid, text, boolean, integer, text, text)',
       'influx_search_admin_definer', array['influx_admin']),
      ('backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text)', 'influx_identity_definer',
       array['influx_verification_definer', 'influx_search_admin_definer'])
    ) as d (fn, owner, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p
         where p.oid = v_def.fn::regprocedure) <> v_def.owner
       or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = v_def.fn::regprocedure)
       or (select p.provolatile::text from pg_catalog.pg_proc p
            where p.oid = v_def.fn::regprocedure) <> 'v'
       or (select p.proconfig from pg_catalog.pg_proc p where p.oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""']
       or (select p.prosrc ~* c_dynamic from pg_catalog.pg_proc p
            where p.oid = v_def.fn::regprocedure) then
      raise exception '% must be SECURITY DEFINER, owned by %, VOLATILE, empty search_path, static',
        v_def.fn, v_def.owner;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
    if exists (select 1 from unnest(v_def.callers) c
                where not pg_catalog.has_function_privilege(c, v_def.fn::regprocedure, 'EXECUTE')) then
      raise exception '% is not executable by all of %', v_def.fn, v_def.callers;
    end if;
  end loop;

  -- fiche invariant 10: both writers consume their 2V and refuse the degraded form
  if exists (select 1 from pg_catalog.pg_proc p
              where p.oid in ('search.write_search_setting(uuid, uuid, text, jsonb, text)'::regprocedure,
                              'search.write_facet_setting(uuid, uuid, text, boolean, integer, text, text)'::regprocedure)
                and (p.prosrc not like '%backoffice.consume_dual_control_for(%'
                     or p.prosrc not like '%v_mode is distinct from ''peer''%')) then
    raise exception 'a writer of the search settings does not consume a peer''s 2V';
  end if;

  -- the closed list holds the two actions, the canonical payloads open them
  if not exists (select 1 from pg_catalog.pg_constraint c
                  where c.conrelid = 'backoffice.dual_control_requests'::regclass
                    and c.conname = 'dual_control_action_code_closed'
                    and pg_catalog.pg_get_constraintdef(c.oid) like '%search.change_setting%'
                    and pg_catalog.pg_get_constraintdef(c.oid) like '%search.change_facet%') then
    raise exception 'dual_control_action_code_closed lacks the search actions';
  end if;
  if not exists (select 1 from pg_catalog.pg_proc p
                  where p.oid = 'backoffice.canonical_dual_control_payload(text,jsonb,uuid)'::regprocedure
                    and p.prosrc like '%p_action_code = ''search.change_setting''%'
                    and p.prosrc like '%p_action_code = ''search.change_facet''%'
                    and p.prosrc not like '%p_action_code = ''verification.revoke_badge''%') then
    raise exception 'canonical_dual_control_payload() does not hold the branches of 0332';
  end if;

  -- no right of the owner of the search settings on the 2V table; nothing to a member
  if pg_catalog.has_table_privilege('influx_search_admin_definer', 'backoffice.dual_control_requests',
                                    'SELECT, INSERT, UPDATE, DELETE')
     or pg_catalog.has_any_column_privilege('influx_search_admin_definer',
                                            'backoffice.dual_control_requests',
                                            'SELECT, INSERT, UPDATE') then
    raise exception 'influx_search_admin_definer reaches backoffice.dual_control_requests';
  end if;
  select string_agg(r || ' ' || f, ', ') into v_bad
    from unnest(array['influx_advertiser', 'influx_creator', 'influx_agent']) r,
         unnest(array['search.write_search_setting(uuid, uuid, text, jsonb, text)',
                      'search.write_facet_setting(uuid, uuid, text, boolean, integer, text, text)',
                      'backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text)']) f
   where pg_catalog.has_function_privilege(r, f::regprocedure, 'EXECUTE');
  if v_bad is not null then
    raise exception 'executed beyond the admins: %', v_bad;
  end if;

  -- the owners keep no CREATE nor member
  if pg_catalog.has_schema_privilege('influx_search_admin_definer', 'search', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE')
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid in ('influx_search_admin_definer'::regrole,
                                    'influx_identity_definer'::regrole)
                   and (m.inherit_option or m.set_option)) then
    raise exception 'an owner of 0332 left with a member or CREATE (03 P7)';
  end if;
end
$$;
