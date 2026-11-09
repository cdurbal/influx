-- =============================================================================
-- 0231_verification_badge_revocation
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 06 (jalons/l2f/06.md; l2f/modele.md §1 points 4, 5, §2 "badges",
-- "badge_revocation_requests", §3 "0231", §4, which prevails for every name; l2f/textes.md « Motifs
-- / Retrait »; l2f-fiche.md invariants 3 to 5, 10, 12; 08 RG73 to RG76, CA49 to CA51; 06 RG55, CA32;
-- 03 §1.3 PD1 to PD7, §3.2 « Badge — retirer » ✔ · J · 2V; archives/jalons/pl/revue-constats.md
-- PLT-5, PLS-5, PLS-6). A badge is withdrawn only under dual control: an agent (or an admin) asks,
-- an administrator distinct from him confirms (or the degraded form of a single operator), and the
-- withdrawal consumes that confirmation once. The only other end of a badge is the expiry (0230)
-- and the erasure (0226).
--
-- 1. verification.revocation_reasons + levels (badge_level[], the levels a reason may withdraw,
--    checked at the request and at the withdrawal), position; requires_comment renamed
--    requires_member_message (terms_breach: a message to the member is required). Two brand
--    reasons (06 RG55): company_dissolved, domain_transferred. The creator keeps the five of 08 RG73
--    (RG73 unchanged); influx_error, forged_evidence and terms_breach serve both.
-- 2. verification.badge_revocation_requests: the request of a withdrawal, keyed by its 2V request;
--    the message to the member lives here (never in the 2V payload, never in the register).
--    verification.badges + revocation_request_id (the named badge and the audience it carries;
--    NULL for the erasure of 0226).
-- 3. backoffice.dual_control_requests: verification.revoke_badge enters the closed list (CHECK).
--    backoffice.canonical_dual_control_payload() gets NO new branch: the admin door
--    request_dual_control() keeps refusing this action; only the two wrappers below write and
--    consume it. PLT-5 / PLS-5: the apollo_legal_basis branch requires a string basis
--    (@.value.type() != "string") before comparing it, as the CHECK of 0151 does.
--    PLS-6: the CHECK sync_settings_value_shape restated with the same strict type test for
--    brevo_list_ids and brevo_template_ids ({"x": []} and {"x": [null]} were let in, lax mode).
-- 4. The wrappers (influx_identity_definer, EXECUTE influx_verification_definer ONLY; no new right
--    on dual_control_requests for anyone):
--      backoffice.open_dual_control_for(action, payload, reason) -> uuid: an active agent or admin
--        in aal2 opens a 2V of verification.revoke_badge, payload exactly {account_id, badge_id,
--        reason_code}, never on his own account; 55000 revocation_pending while a live 2V names the
--        badge; dual_control.requested as request_dual_control() writes it.
--      backoffice.consume_dual_control_for(session, request, action, payload, reason) -> text: an
--        active admin, R in this transaction, then backoffice.consume_dual_control() (peer or
--        degraded_single_operator; its confirm_dual_control() already refuses the confirmer whose
--        own account the payload names, account_id).
--      backoffice.dual_control_status_for(request) -> text (EC-L2F-06-1): the effective state of a
--        2V of verification.revoke_badge (pending, confirmed, degraded, cancelled, expired,
--        consumed), for the reads below.
-- 5. The functions (influx_verification_definer, aal2, active agent profile; the caller's own
--    account and an account he holds refused 42501):
--      verification.request_badge_revocation(badge, reason, member_message) -> uuid (agent, admin)
--      verification.read_badge_revocation(2V request) (admin): the recap (PD1), cascade included
--      verification.revoke_badge(session, 2V request, badge, reason) -> mode (admin): consumes the
--        2V once, revoked + revoked_at + reason + request, the audience of the line carried by a
--        withdrawn « Compte vérifié » (modele point 4), the public row derived again, lead.updated,
--        verification.revoked_notice queued, verification.badge_revoked {level, reason_code,
--        dual_control_request_id, dual_control, cascade_of}.
--      verification.read_account_badges(account) (agent, admin): the badges of an account, without
--        a figure nor a handle, with the live withdrawal request (an account held is served).
--
-- Refusals (the MESSAGE is the code, the DETAIL its precision):
--   42501 forbidden   outside an active agent (or admin) in aal2; an unknown badge, of the caller's
--                     own account or of an account he holds; a 2V not confirmed for exactly this
--                     badge and reason, expired, consumed, or confirmed by another than the caller.
--   55000 badge_not_holding, revocation_pending.
--   22023 reason (unknown, inactive or outside the levels of the badge), member_message.
--
-- Rights (fiche invariant 10): influx_verification_definer reads and writes the new table (other
-- accounts than the caller's), reads the reasons, writes the withdrawal of a holding badge and
-- queues verification.revoked_notice. Nothing for influx_advertiser nor influx_creator.
--
-- Not here: the routes and the 2V screen (L2F commit 13), the e-mail body (12), the disputes
-- (0232), the export and the erasure of the new texts (0235), the amendments of 08 RG73, 06 RG55,
-- 03 §3.2, P7, 17b §3.13 (closure of the jalon).
--
-- EC-L2F-06 (micro-gaps, the safest choice):
--   EC-L2F-06-1  a third wrapper, backoffice.dual_control_status_for(), read-only and limited to
--                verification.revoke_badge: read_account_badges must tell a live withdrawal
--                request from a cancelled or expired one, and modele point 4 forbids any right of
--                influx_verification_definer on dual_control_requests.
--   EC-L2F-06-2  the escalation of a reason (08 RG73 « Escaladé : Administrateur ») is held by
--                construction: every withdrawal is confirmed by an administrator; the flag of the
--                reason is written in verification.revocation_requested {escalated} for the
--                quality review (RG74), never as a separate line.
--   EC-L2F-06-3  the reason of the 2V request (PD4) is the reason of the withdrawal: one code,
--                compared at the consumption with the payload.
--   EC-L2F-06-4  one e-mail per withdrawal, on the named badge (key
--                verification.revoked_notice:<badge_id>); the audience carried along was announced
--                in the recap (read_badge_revocation.cascade_badge_ids).
--   EC-L2F-06-5  the public row is derived again for every network badge withdrawn (the derivation
--                reads the holding audience badge only: idempotent for an account badge).
--
-- ROLLBACK (before any withdrawal): drop the four verification functions and the three backoffice
-- wrappers; drop the policies *_verification_definer_* named below and revoke their grants; drop
-- column verification.badges.revocation_request_id; drop table verification.badge_revocation_requests;
-- restate dual_control_action_code_closed as in 0137, canonical_dual_control_payload() as in 0141 and
-- sync_settings_value_shape as in 0151; delete the brand reasons, drop levels and position, rename
-- requires_member_message back to requires_comment; delete the three event types of §6.
-- =============================================================================

-- 1. The reasons of a withdrawal (modele point 5; textes « Retrait »; 08 RG73, 06 RG55) ----------------

alter table verification.revocation_reasons
  rename column requires_comment to requires_member_message;
alter table verification.revocation_reasons
  add column if not exists levels verification.badge_level[];
alter table verification.revocation_reasons
  add column if not exists position smallint;

insert into verification.revocation_reasons
  (code, label_key, message_key, escalates_to_admin)
values
  ('company_dissolved',  'reason.verification_revocation.company_dissolved',
   'verificationRevocation.reason.company_dissolved',  false),
  ('domain_transferred', 'reason.verification_revocation.domain_transferred',
   'verificationRevocation.reason.domain_transferred', false)
on conflict (code) do nothing;

update verification.revocation_reasons r
   set levels = v.levels::verification.badge_level[],
       position = v.position,
       requires_member_message = v.requires_member_message,
       escalates_to_admin = v.escalates
  from (values
    ('forged_evidence',    '{account_verified,audience_verified,brand_verified}', 1, false, true),
    ('account_closed',     '{account_verified,audience_verified}',                2, false, false),
    ('owner_changed',      '{account_verified,audience_verified}',                3, false, true),
    ('terms_breach',       '{account_verified,audience_verified,brand_verified}', 4, true,  true),
    ('influx_error',       '{account_verified,audience_verified,brand_verified}', 5, false, true),
    ('company_dissolved',  '{brand_verified}',                                    6, false, false),
    ('domain_transferred', '{brand_verified}',                                    7, false, false)
  ) as v (code, levels, position, requires_member_message, escalates)
 where r.code = v.code;

alter table verification.revocation_reasons alter column levels set not null;
alter table verification.revocation_reasons alter column position set not null;
alter table verification.revocation_reasons drop constraint if exists revocation_reasons_levels;
alter table verification.revocation_reasons
  add constraint revocation_reasons_levels check (pg_catalog.cardinality(levels) >= 1);
alter table verification.revocation_reasons drop constraint if exists revocation_reasons_position;
alter table verification.revocation_reasons
  add constraint revocation_reasons_position unique (position);

comment on table verification.revocation_reasons is
  'The reasons of a withdrawal outside expiry (08 RG73, 06 RG55, l2f/textes.md), distinct from the '
  'refusal reasons: influx_error says INFLUX was wrong (RG74). levels: the badges a reason may '
  'withdraw (the creator keeps the five of RG73; company_dissolved and domain_transferred are the '
  'brand''s, 0231). The foreign key of a revoked badge. Read by agent and admin in aal2; written by '
  'the migrations.';
comment on column verification.revocation_reasons.levels is
  'The levels this reason may withdraw (0231), checked by request_badge_revocation() and '
  'revoke_badge() (22023 reason otherwise).';
comment on column verification.revocation_reasons.requires_member_message is
  'A message of 20 to 500 characters to the member is required (terms_breach), and refused '
  'otherwise (0231; renamed from requires_comment).';

-- 2. The request of a withdrawal and its link on the badge (modele §2) ----------------------------------

create table if not exists verification.badge_revocation_requests (
  dual_control_request_id  uuid        not null primary key
                                       references backoffice.dual_control_requests (id),
  badge_id                 uuid        not null references verification.badges (id),
  account_id               uuid        not null references identity.accounts (id),
  reason_code              text        not null references verification.revocation_reasons (code),
  member_message           text,
  requested_by_account_id  uuid        not null references identity.accounts (id),
  requested_at             timestamptz not null default now(),
  executed_by_account_id   uuid        references identity.accounts (id),
  executed_at              timestamptz,
  texts_erased_at          timestamptz,

  constraint badge_revocation_requests_member_message
    check (member_message is null
           or (char_length(member_message) between 20 and 500
               and member_message ~ '[^[:space:]]'
               and member_message !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]')),
  constraint badge_revocation_requests_executed
    check (num_nonnulls(executed_by_account_id, executed_at) in (0, 2)),
  constraint badge_revocation_requests_executed_after check (executed_at >= requested_at),
  constraint badge_revocation_requests_texts_erased
    check (texts_erased_at is null or member_message is null)
);

create index if not exists badge_revocation_requests_badge_idx
  on verification.badge_revocation_requests (badge_id);
create index if not exists badge_revocation_requests_account_idx
  on verification.badge_revocation_requests (account_id);

comment on table verification.badge_revocation_requests is
  'The request of a withdrawal of a badge (0231; 08 RG75, 03 §3.2 2V): keyed by its request of dual '
  'control (backoffice.dual_control_requests, payload {account_id, badge_id, reason_code}); the '
  'message to the member (required by the reason, 20 to 500 characters) lives here, shown in the '
  'recap, never in the payload nor the register; executed_* written by revoke_badge(). Written and '
  'read through the functions of influx_verification_definer only; nothing for a member.';

alter table verification.badge_revocation_requests enable row level security;
alter table verification.badge_revocation_requests force row level security;
revoke all on verification.badge_revocation_requests
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;

alter table verification.badges
  add column if not exists revocation_request_id uuid
    references verification.badge_revocation_requests (dual_control_request_id);
alter table verification.badges drop constraint if exists badges_revocation_request;
alter table verification.badges
  add constraint badges_revocation_request
  check (revocation_request_id is null or state = 'revoked');

comment on column verification.badges.revocation_request_id is
  'The withdrawal under 2V that revoked this badge (0231): the named badge, and the audience badge '
  'carried along by a withdrawn « Compte vérifié » (modele point 4); NULL for a revocation by the '
  'erasure (0226).';

-- 3. The closed list of 2V, the canonical payloads (PLT-5, PLS-5) and the settings (PLS-6) -------------

alter table backoffice.dual_control_requests drop constraint if exists dual_control_action_code_closed;
alter table backoffice.dual_control_requests add constraint dual_control_action_code_closed
  check (action_code in ('identity.grant_role', 'identity.invite_admin', 'identity.change_member_role',
                         'leads.change_apollo_setting', 'privacy.approve_data_request',
                         'verification.revoke_badge'));

comment on column backoffice.dual_control_requests.action_code is
  'Closed list (CHECK): identity.grant_role (0130), identity.invite_admin (0131), '
  'identity.change_member_role (0132), leads.change_apollo_setting (0134), privacy.approve_data_request '
  '(0137), verification.revoke_badge (0231: opened by an agent or an admin through '
  'backoffice.open_dual_control_for(), never through request_dual_control()). An action enters it '
  'with its consuming function.';

-- PLS-6 (0151 restated verbatim but for brevo_list_ids and brevo_template_ids: a value that is not
-- JSON null must be a whole number >= 1, its type tested strictly, never compared in lax mode)
alter table leads.sync_settings drop constraint sync_settings_value_shape;

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
                             || @.value.type() != "string"
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
                             || (@.value.type() != "null"
                                 && (@.value.type() != "number" || @.value < 1
                                     || @.value.floor() != @.value)))')
    when 'brevo_template_ids' then
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value,
            '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$")
                             || (@.value.type() != "null"
                                 && (@.value.type() != "number" || @.value < 1
                                     || @.value.floor() != @.value)))')
    else false
  end);

-- 4. The functions of influx_identity_definer: the canonical payloads, the three wrappers --------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;
set role influx_identity_definer;

-- 4.1 0141 restated verbatim but for one predicate (PLT-5, PLS-5): a basis of a country must be a
-- string before it is compared to the closed list; still no branch for verification.revoke_badge
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
  'active account other than the caller, never approved: 0137). verification.revoke_badge has NO '
  'branch (0231: opened through backoffice.open_dual_control_for() only). Returns the canonical '
  'payload, compared whole by the action function; 42501 forbidden otherwise. SECURITY INVOKER owned '
  'by influx_identity_definer, NO grant.';

-- 4.2 The agent door of the 2V of a withdrawal (modele point 4; 08 RG75; 03 PD4)
create or replace function backoffice.open_dual_control_for(
  p_action_code  text,
  p_payload      jsonb,
  p_reason_code  text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_caller   uuid := influx.current_account_id();
  v_role     text := influx.current_account_role()::text;
  v_account  uuid;
  v_badge    uuid;
  v_payload  jsonb;
  v_id       uuid;
begin
  -- an active agent or admin in aal2 (the caller of the verification function that calls this one)
  if v_caller is null
     or not influx.has_aal2()
     or v_role is null
     or v_role not in ('agent', 'admin')
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role::text = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- this one action, exactly {account_id, badge_id, reason_code}, the reason of the request itself
  if p_action_code is distinct from 'verification.revoke_badge'
     or p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,62}$'
     or p_payload is null
     or pg_catalog.jsonb_typeof(p_payload) <> 'object'
     or (p_payload - 'account_id' - 'badge_id' - 'reason_code') <> '{}'::jsonb
     or pg_catalog.jsonb_typeof(p_payload -> 'account_id') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'badge_id') is distinct from 'string'
     or pg_catalog.jsonb_typeof(p_payload -> 'reason_code') is distinct from 'string'
     or (p_payload ->> 'account_id') !~* c_uuid
     or (p_payload ->> 'badge_id') !~* c_uuid
     or (p_payload ->> 'reason_code') is distinct from p_reason_code then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  v_account := (p_payload ->> 'account_id')::uuid;
  v_badge   := (p_payload ->> 'badge_id')::uuid;
  -- C(3), 15 RG36: never on one's own account
  if v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- one live 2V per badge: pending, or confirmed and not consumed, before its expiry
  if exists (select 1
               from backoffice.dual_control_requests r
              where r.action_code = 'verification.revoke_badge'
                and r.payload ->> 'badge_id' = v_badge::text
                and r.state in ('pending', 'confirmed', 'degraded')
                and r.consumed_at is null
                and r.expires_at > pg_catalog.now()) then
    raise exception 'revocation_pending'
      using errcode = 'object_not_in_prerequisite_state', detail = 'revocation_pending';
  end if;

  v_payload := pg_catalog.jsonb_build_object('account_id', v_account, 'badge_id', v_badge,
                                             'reason_code', p_reason_code);
  insert into backoffice.dual_control_requests
    (action_code, payload, reason_code, requested_by_account_id)
  values (p_action_code, v_payload, p_reason_code, v_caller)
  returning id into v_id;

  -- as request_dual_control(): the action, the reason and the payload (identifiers and codes)
  perform audit.append('dual_control.requested', 'dual_control_request', v_id,
                       pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                     'reason_code', p_reason_code,
                                                     'action_payload', v_payload));
  return v_id;
end
$$;

comment on function backoffice.open_dual_control_for(text, jsonb, text) is
  'modele point 4 (0231; 08 RG75; 03 PD4): the caller (an active agent or admin in aal2, through '
  'verification.request_badge_revocation()) opens a 2V of verification.revoke_badge only, payload '
  'exactly {"account_id", "badge_id", "reason_code"} (uuids, the reason = p_reason_code), never on '
  'his own account (C(3)); 55000 revocation_pending while a live 2V (pending, or confirmed and not '
  'consumed, unexpired) names the badge. Writes the request (pending, expiry of dual_control_pending) '
  'and dual_control.requested {action_code, reason_code, action_payload}. Returns its id. 42501 '
  'forbidden otherwise. SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE '
  'for influx_verification_definer ONLY.';

-- 4.3 The consumption of that 2V, by the administrator who withdraws (03 PD3 to PD7)
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
  if p_action_code is distinct from 'verification.revoke_badge' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform identity.require_active_admin();
  -- R in THIS transaction, then the 2V consumed once, by its confirmer
  perform identity.assert_fresh_second_factor(p_session_id);
  return backoffice.consume_dual_control(p_request_id, p_action_code, p_payload, p_reason_code);
end
$$;

comment on function backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text) is
  'modele point 4 (0231; 03 PD3 to PD7): an active admin in aal2, with R on p_session_id (TOTP within '
  '300 s, the session of the request), consumes the confirmed 2V p_request_id of '
  'verification.revoke_badge only, for exactly p_payload and p_reason_code, by its confirmer '
  '(backoffice.consume_dual_control(): the peer, or the requester in degraded mode while no peer '
  'admin exists). Returns peer or degraded_single_operator. 42501 forbidden otherwise. SECURITY '
  'DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for '
  'influx_verification_definer ONLY.';

-- 4.4 The effective state of that 2V, for the reads of the withdrawal (EC-L2F-06-1)
create or replace function backoffice.dual_control_status_for(p_request_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when r.consumed_at is not null then 'consumed'
              when r.state in ('pending', 'confirmed', 'degraded')
                   and r.expires_at <= pg_catalog.now() then 'expired'
              else r.state::text end
    from backoffice.dual_control_requests r
   where r.id = p_request_id
     and r.action_code = 'verification.revoke_badge'
$$;

comment on function backoffice.dual_control_status_for(uuid) is
  'EC-L2F-06-1 (0231): the effective state of a 2V of verification.revoke_badge: consumed, expired '
  '(pending, confirmed or degraded past expires_at), else pending, confirmed, degraded, cancelled; '
  'NULL for another action or an unknown id. Read-only. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_verification_definer ONLY.';

revoke all on function backoffice.open_dual_control_for(text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.dual_control_status_for(uuid)
  from public, anon, authenticated, service_role;
grant execute on function backoffice.open_dual_control_for(text, jsonb, text)
  to influx_verification_definer;
grant execute on function backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text)
  to influx_verification_definer;
grant execute on function backoffice.dual_control_status_for(uuid) to influx_verification_definer;

reset role;
revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5. What influx_verification_definer reads and writes for a withdrawal ---------------------------------

-- 5.1 The reasons and their levels
grant select (code, levels, position, requires_member_message, escalates_to_admin, is_active)
   on verification.revocation_reasons to influx_verification_definer;
drop policy if exists revocation_reasons_verification_definer_select on verification.revocation_reasons;
create policy revocation_reasons_verification_definer_select on verification.revocation_reasons
  for select to influx_verification_definer
  using (true);

-- 5.2 The requests of a withdrawal: written by the request, executed once by the withdrawal
grant select (dual_control_request_id, badge_id, account_id, reason_code, member_message,
              requested_by_account_id, requested_at, executed_by_account_id, executed_at)
   on verification.badge_revocation_requests to influx_verification_definer;
grant insert (dual_control_request_id, badge_id, account_id, reason_code, member_message,
              requested_by_account_id)
   on verification.badge_revocation_requests to influx_verification_definer;
grant update (executed_by_account_id, executed_at)
   on verification.badge_revocation_requests to influx_verification_definer;

drop policy if exists badge_revocation_requests_verification_definer_select
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_verification_definer_select
  on verification.badge_revocation_requests
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists badge_revocation_requests_verification_definer_insert
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_verification_definer_insert
  on verification.badge_revocation_requests
  for insert to influx_verification_definer
  with check (account_id is distinct from (select influx.current_account_id())
              and requested_by_account_id = (select influx.current_account_id())
              and executed_by_account_id is null and executed_at is null);
drop policy if exists badge_revocation_requests_verification_definer_execute
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_verification_definer_execute
  on verification.badge_revocation_requests
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()) and executed_at is null)
  with check (executed_by_account_id = (select influx.current_account_id())
              and executed_at is not null);

-- 5.3 The badges: the withdrawal of a holding one, and the reads of the account block
grant select (revoked_at, revocation_reason_code, revocation_request_id, ended_at)
   on verification.badges to influx_verification_definer;
grant update (revoked_at, revocation_reason_code, revocation_request_id)
   on verification.badges to influx_verification_definer;

drop policy if exists badges_verification_definer_revoke on verification.badges;
create policy badges_verification_definer_revoke on verification.badges
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id())
         and state in ('active', 'to_refresh', 'to_reconfirm'))
  with check (state = 'revoked' and revocation_request_id is not null
              and revoked_at is not null);

-- 5.4 The queue: the e-mail of a withdrawal, besides the decision and lead.updated (0224)
drop policy if exists outbox_events_verification_definer_insert on leads.outbox_events;
create policy outbox_events_verification_definer_insert on leads.outbox_events
  for insert to influx_verification_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((event_type in ('verification.decision', 'verification.revoked_notice')
                    and destination = 'brevo_transactional')
                   or (event_type = 'lead.updated' and destination = 'brevo_contact')));

-- 6. The register and the queue (modele §4) -------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- nominative; payload codes and identifiers, never the message to the member
  ('verification.revocation_requested', 'verification', 'verification_badge', 'sensitive'),
  ('verification.badge_revoked',        'verification', 'verification_badge', 'sensitive'),
  -- the queue only (never a register line): the e-mail of a withdrawal (08 RG94)
  ('verification.revoked_notice',       'verification', 'verification_badge', 'info')
on conflict (code) do nothing;

-- 7. The functions of the withdrawal (influx_verification_definer) --------------------------------------

-- 7.1 The message to the member, required by the reason and refused otherwise (as reject_request)
create or replace function verification.check_revocation_reason(
  p_level           verification.badge_level,
  p_reason_code     text,
  p_member_message  text)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_reason  record;
begin
  select r.requires_member_message, r.escalates_to_admin into v_reason
    from verification.revocation_reasons r
   where r.code = p_reason_code and r.is_active and p_level = any (r.levels);
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  if v_reason.requires_member_message then
    if p_member_message is null
       or pg_catalog.char_length(p_member_message) not between 20 and 500
       or p_member_message !~ '[^[:space:]]'
       or p_member_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'member_message' using errcode = 'invalid_parameter_value', detail = 'member_message';
    end if;
  elsif p_member_message is not null then
    raise exception 'member_message' using errcode = 'invalid_parameter_value', detail = 'member_message';
  end if;
  return v_reason.escalates_to_admin;
end
$$;

comment on function verification.check_revocation_reason(verification.badge_level, text, text) is
  '0231 (08 RG73, 06 RG55): 22023 reason unless p_reason_code is an active revocation reason whose '
  'levels hold p_level; 22023 member_message unless the message (20 to 500 printable characters) is '
  'given exactly when the reason requires it. Returns escalates_to_admin. SECURITY INVOKER owned by '
  'influx_verification_definer, no EXECUTE for anyone.';

-- 7.2 The request (08 RG75, CA49; modele point 4)
create or replace function verification.request_badge_revocation(
  p_badge_id        uuid,
  p_reason_code     text,
  p_member_message  text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid := verification.require_agent(false);
  v_badge      record;
  v_escalated  boolean;
  v_id         uuid;
begin
  -- the badge (the policy hides the caller's own account), then its row locked while it holds:
  -- one request at a time per badge (the update policies only reach a holding badge)
  select b.id, b.account_id, b.level, b.state::text as state
    into v_badge
    from verification.badges b
   where b.id = p_badge_id;
  if not found
     or exists (select 1 from identity.accounts a
                 where a.id = v_badge.account_id and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform 1
     from verification.badges b
    where b.id = p_badge_id and b.state in ('active', 'to_refresh', 'to_reconfirm')
      for update;
  if not found then
    raise exception 'badge_not_holding'
      using errcode = 'object_not_in_prerequisite_state', detail = 'badge_not_holding';
  end if;
  v_escalated := verification.check_revocation_reason(v_badge.level, p_reason_code, p_member_message);

  v_id := backoffice.open_dual_control_for(
            'verification.revoke_badge',
            pg_catalog.jsonb_build_object('account_id', v_badge.account_id,
                                          'badge_id', v_badge.id,
                                          'reason_code', p_reason_code),
            p_reason_code);

  insert into verification.badge_revocation_requests
    (dual_control_request_id, badge_id, account_id, reason_code, member_message,
     requested_by_account_id)
  values (v_id, v_badge.id, v_badge.account_id, p_reason_code, p_member_message, v_caller);

  perform audit.append('verification.revocation_requested', 'verification_badge', v_badge.id,
                       pg_catalog.jsonb_build_object('level', v_badge.level,
                                                     'reason_code', p_reason_code,
                                                     'dual_control_request_id', v_id,
                                                     'escalated', v_escalated));
  return v_id;
end
$$;

comment on function verification.request_badge_revocation(uuid, text, text) is
  '08 RG75, CA49 (0231; modele point 4): an active agent or admin in aal2 asks the withdrawal of a '
  'holding badge (active, to_refresh, to_reconfirm) of another account than his own and than an '
  'account he holds, with a reason of its level (08 RG73, 06 RG55) and the message to the member '
  'exactly when the reason requires it. Opens the 2V verification.revoke_badge {account_id, '
  'badge_id, reason_code} through backoffice.open_dual_control_for(), writes the request (the '
  'message here, never in the payload) and verification.revocation_requested {level, reason_code, '
  'dual_control_request_id, escalated}. Returns the 2V request id. 42501 forbidden, 55000 '
  'badge_not_holding or revocation_pending, 22023 reason or member_message. SECURITY DEFINER owned '
  'by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 7.3 The recap of the 2V screen (03 PD1, 17b §3.13)
create or replace function verification.read_badge_revocation(p_dual_control_request_id uuid)
returns table (
  dual_control_request_id  uuid,
  badge_id                 uuid,
  account_id               uuid,
  level                    verification.badge_level,
  network_code             text,
  badge_state              text,
  reason_code              text,
  member_message           text,
  requested_by_account_id  uuid,
  requested_at             timestamptz,
  executed_by_account_id   uuid,
  executed_at              timestamptz,
  dual_control_state       text,
  cascade_badge_ids        uuid[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := verification.require_agent(true);
begin
  return query
  select q.dual_control_request_id, q.badge_id, q.account_id, b.level, b.network_code,
         b.state::text, q.reason_code, q.member_message, q.requested_by_account_id,
         q.requested_at, q.executed_by_account_id, q.executed_at,
         backoffice.dual_control_status_for(q.dual_control_request_id),
         -- modele point 4: the audience badge a withdrawn « Compte vérifié » carries along (still
         -- holding before the withdrawal, revoked with it after)
         coalesce((select pg_catalog.array_agg(c.id order by c.id)
                     from verification.badges c
                    where b.level = 'account_verified'
                      and c.account_id = b.account_id
                      and c.social_account_id = b.social_account_id
                      and c.level = 'audience_verified'
                      and ((q.executed_at is null
                            and c.state in ('active', 'to_refresh', 'to_reconfirm'))
                           or (q.executed_at is not null
                               and c.revocation_request_id = q.dual_control_request_id))),
                  '{}'::uuid[])
    from verification.badge_revocation_requests q
    join verification.badges b on b.id = q.badge_id
   where q.dual_control_request_id = p_dual_control_request_id;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
end
$$;

comment on function verification.read_badge_revocation(uuid) is
  '03 PD1, 17b §3.13 (0231; modele §3): an active admin in aal2 reads the request of a withdrawal of '
  'another account than his own: the badge (level, network, state), the reason, the message to the '
  'member, who asked and when, who executed and when, the effective state of the 2V '
  '(backoffice.dual_control_status_for()) and the audience badges carried along '
  '(cascade_badge_ids). Never a figure nor a handle. 42501 forbidden for an unknown request, one of '
  'his own account, outside an admin. SECURITY DEFINER owned by influx_verification_definer; EXECUTE '
  'for influx_agent and influx_admin (the function refuses the agent).';

-- 7.4 The withdrawal, consuming the 2V once (08 RG73 to RG76, CA49 to CA51; 06 RG55, CA32)
create or replace function verification.revoke_badge(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_badge_id                 uuid,
  p_reason_code              text)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := verification.require_agent(true);
  v_badge    record;
  v_request  record;
  v_mode     text;
  v_cascade  record;
  v_lines    uuid[] := '{}';
  v_event    uuid;
  v_line     uuid;
begin
  select b.id, b.account_id, b.social_account_id, b.level, b.state::text as state
    into v_badge
    from verification.badges b
   where b.id = p_badge_id;
  if not found
     or exists (select 1 from identity.accounts a
                 where a.id = v_badge.account_id and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the request of THIS badge and THIS reason, never executed
  select q.dual_control_request_id, q.member_message
    into v_request
    from verification.badge_revocation_requests q
   where q.dual_control_request_id = p_dual_control_request_id
     and q.badge_id = p_badge_id
     and q.reason_code = p_reason_code
     and q.executed_at is null
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the badge row locked while it holds (the task or a grant may have ended it since the request)
  perform 1
     from verification.badges b
    where b.id = p_badge_id and b.state in ('active', 'to_refresh', 'to_reconfirm')
      for update;
  if not found then
    raise exception 'badge_not_holding'
      using errcode = 'object_not_in_prerequisite_state', detail = 'badge_not_holding';
  end if;
  perform verification.check_revocation_reason(v_badge.level, p_reason_code, v_request.member_message);

  -- 03 PD3 to PD7: R, then the 2V consumed once, payload compared whole, by its confirmer
  v_mode := backoffice.consume_dual_control_for(
              p_session_id, p_dual_control_request_id, 'verification.revoke_badge',
              pg_catalog.jsonb_build_object('account_id', v_badge.account_id,
                                            'badge_id', v_badge.id,
                                            'reason_code', p_reason_code),
              p_reason_code);

  update verification.badges b
     set state                  = 'revoked',
         revoked_at             = pg_catalog.now(),
         revocation_reason_code = p_reason_code,
         revocation_request_id  = p_dual_control_request_id
   where b.id = v_badge.id;
  perform audit.append('verification.badge_revoked', 'verification_badge', v_badge.id,
                       pg_catalog.jsonb_build_object('level', v_badge.level,
                                                     'reason_code', p_reason_code,
                                                     'dual_control_request_id',
                                                     p_dual_control_request_id,
                                                     'dual_control', v_mode));
  if v_badge.social_account_id is not null then
    v_lines := array[v_badge.social_account_id];
  end if;

  -- modele point 4: a withdrawn « Compte vérifié » carries the holding audience of its line
  if v_badge.level = 'account_verified' then
    for v_cascade in
      select c.id, c.level
        from verification.badges c
       where c.account_id = v_badge.account_id
         and c.social_account_id = v_badge.social_account_id
         and c.level = 'audience_verified'
         and c.state in ('active', 'to_refresh', 'to_reconfirm')
       order by c.id
         for update
    loop
      update verification.badges b
         set state                  = 'revoked',
             revoked_at             = pg_catalog.now(),
             revocation_reason_code = p_reason_code,
             revocation_request_id  = p_dual_control_request_id
       where b.id = v_cascade.id;
      perform audit.append('verification.badge_revoked', 'verification_badge', v_cascade.id,
                           pg_catalog.jsonb_build_object('level', v_cascade.level,
                                                         'reason_code', p_reason_code,
                                                         'dual_control_request_id',
                                                         p_dual_control_request_id,
                                                         'dual_control', v_mode,
                                                         'cascade_of', v_badge.id));
    end loop;
  end if;

  update verification.badge_revocation_requests q
     set executed_by_account_id = v_caller, executed_at = pg_catalog.now()
   where q.dual_control_request_id = p_dual_control_request_id;

  -- RG76, CA50: the public row of the line derived again in this transaction (EC-L2F-06-5)
  foreach v_line in array v_lines loop
    perform profiles.refresh_creator_public_network(v_line);
  end loop;

  -- 08 RG94: the e-mail of the withdrawal (ids only, written by the worker from email.json, D69)
  v_event := pg_catalog.gen_random_uuid();
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'verification.revoked_notice', 'brevo_transactional',
          'account:' || v_badge.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_badge.account_id,
                                        'badge_id', v_badge.id,
                                        'email_code', 'verification.revoked_notice'),
          'verification.revoked_notice:' || v_badge.id::text);
  -- modele §4: VERIFIED_LEVEL follows every change of badge, Brevo only (never Apollo, RG92)
  v_event := pg_catalog.gen_random_uuid();
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'lead.updated', 'brevo_contact', 'account:' || v_badge.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_badge.account_id),
          'lead.updated:' || v_event::text);
  return v_mode;
end
$$;

comment on function verification.revoke_badge(uuid, uuid, uuid, text) is
  '08 RG73 to RG76, CA49 to CA51; 06 RG55, CA32; 03 PD3 to PD7 (0231; modele point 4): an active '
  'admin in aal2 withdraws a holding badge of another account than his own and than an account he '
  'holds, for the request p_dual_control_request_id of THIS badge and THIS reason, never executed: '
  'R on p_session_id and the 2V consumed once by its confirmer (backoffice.consume_dual_control_for(): '
  'peer, or degraded_single_operator while no peer admin exists). The badge revoked (revoked_at, '
  'reason, revocation_request_id); a « Compte vérifié » carries the holding audience badge of its '
  'line (cascade_of); the request executed; the public row of the line derived again; '
  'verification.revoked_notice (key verification.revoked_notice:<badge_id>) and lead.updated queued; '
  'verification.badge_revoked {level, reason_code, dual_control_request_id, dual_control[, '
  'cascade_of]} per badge. Returns the mode. 42501 forbidden, 55000 badge_not_holding, 22023 reason. '
  'SECURITY DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin '
  '(the function refuses the agent).';

-- 7.5 The badges of an account, for its backoffice page (17b §3.6; modele §5)
create or replace function verification.read_account_badges(p_account_id uuid)
returns table (
  badge_id                 uuid,
  level                    verification.badge_level,
  network_code             text,
  social_account_id        uuid,
  state                    text,
  granted_at               timestamptz,
  expires_at               timestamptz,
  ended_at                 timestamptz,
  revoked_at               timestamptz,
  revocation_reason_code   text,
  revocation_request_id    uuid,
  pending_revocation_id    uuid,
  pending_revocation_state text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := verification.require_agent(false);
begin
  -- the caller's own account, or an unknown one: one answer (an account he holds is served)
  if p_account_id is null or p_account_id = v_caller
     or not exists (select 1 from identity.accounts a where a.id = p_account_id) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query
  select b.id, b.level, b.network_code, b.social_account_id, b.state::text, b.granted_at,
         b.expires_at, b.ended_at, b.revoked_at, b.revocation_reason_code, b.revocation_request_id,
         p.dual_control_request_id, p.status
    from verification.badges b
    left join lateral (
           select q.dual_control_request_id, s.status
             from verification.badge_revocation_requests q
            cross join lateral (
                    select backoffice.dual_control_status_for(q.dual_control_request_id) as status) s
            where q.badge_id = b.id
              and q.executed_at is null
              and s.status in ('pending', 'confirmed', 'degraded')
            order by q.requested_at desc
            limit 1) p on true
   where b.account_id = p_account_id
   order by b.granted_at desc, b.id;
end
$$;

comment on function verification.read_account_badges(uuid) is
  '17b §3.6 (0231; modele §3, §5): an active agent or admin in aal2 reads every badge of an account '
  'other than his own (an account he holds is served): level, network, line, state, dates, reason '
  'and request of a withdrawal, and the live request of a withdrawal (pending, confirmed or degraded, '
  'unexpired, not executed) with its state. Never a figure, a handle nor an agent. 42501 forbidden '
  'for his own or an unknown account. SECURITY DEFINER owned by influx_verification_definer; EXECUTE '
  'for influx_agent and influx_admin.';

-- 8. Rights on the functions, then to their owner (03 P7 rule 5) ----------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.check_revocation_reason(verification.badge_level, text, text)',
    'verification.request_badge_revocation(uuid, text, text)',
    'verification.read_badge_revocation(uuid)',
    'verification.revoke_badge(uuid, uuid, uuid, text)',
    'verification.read_account_badges(uuid)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', f);
  end loop;
end
$$;

grant execute on function
  verification.request_badge_revocation(uuid, text, text),
  verification.read_badge_revocation(uuid),
  verification.revoke_badge(uuid, uuid, uuid, text),
  verification.read_account_badges(uuid)
  to influx_agent, influx_admin;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.check_revocation_reason(verification.badge_level, text, text)',
    'verification.request_badge_revocation(uuid, text, text)',
    'verification.read_badge_revocation(uuid)',
    'verification.revoke_badge(uuid, uuid, uuid, text)',
    'verification.read_account_badges(uuid)']
  loop
    execute format('alter function %s owner to influx_verification_definer', f);
  end loop;
end
$$;

revoke create on schema verification from influx_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
end
$$;

-- 9. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  -- the functions: owner, security, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('backoffice.open_dual_control_for(text,jsonb,text)', 'influx_identity_definer', true,
       array['influx_verification_definer']),
      ('backoffice.consume_dual_control_for(uuid,uuid,text,jsonb,text)', 'influx_identity_definer',
       true, array['influx_verification_definer']),
      ('backoffice.dual_control_status_for(uuid)', 'influx_identity_definer', true,
       array['influx_verification_definer']),
      ('backoffice.canonical_dual_control_payload(text,jsonb,uuid)', 'influx_identity_definer',
       false, array[]::text[]),
      ('verification.check_revocation_reason(verification.badge_level,text,text)',
       'influx_verification_definer', false, array[]::text[]),
      ('verification.request_badge_revocation(uuid,text,text)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.read_badge_revocation(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.revoke_badge(uuid,uuid,uuid,text)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.read_account_badges(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin'])
    ) as f (sig, owner, definer, callers)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> f.owner
      or p.prosecdef is distinct from f.definer
      or p.proconfig is distinct from array['search_path=""']
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0 or a.grantee::regrole::text <> all (f.callers)));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, search_path or callers: %', v_bad;
  end if;

  -- modele point 4: no new right on dual_control_requests for the owner of the verification
  if pg_catalog.has_table_privilege('influx_verification_definer', 'backoffice.dual_control_requests',
                                    'SELECT, INSERT, UPDATE, DELETE')
     or pg_catalog.has_any_column_privilege('influx_verification_definer',
                                            'backoffice.dual_control_requests',
                                            'SELECT, INSERT, UPDATE') then
    raise exception 'influx_verification_definer reaches backoffice.dual_control_requests';
  end if;
  -- request_dual_control() still refuses the withdrawal (no canonical branch)
  if exists (select 1 from pg_catalog.pg_proc p
              where p.oid = 'backoffice.canonical_dual_control_payload(text,jsonb,uuid)'::regprocedure
                and p.prosrc like '%p_action_code = ''verification.revoke_badge''%') then
    raise exception 'canonical_dual_control_payload() names verification.revoke_badge';
  end if;

  -- the reasons: the five of RG73 for the creator, five for the brand (06 RG55), one message
  if (select count(*) from verification.revocation_reasons
       where is_active and levels && array['account_verified', 'audience_verified']::verification.badge_level[]) <> 5
     or (select count(*) from verification.revocation_reasons
          where is_active and 'brand_verified' = any (levels)) <> 5
     or (select pg_catalog.array_agg(code order by code) from verification.revocation_reasons
          where requires_member_message) is distinct from array['terms_breach'] then
    raise exception 'the revocation reasons are not those of 08 RG73 and 06 RG55';
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace in ('verification'::regnamespace, 'backoffice'::regnamespace)
     and p.proname in ('open_dual_control_for', 'consume_dual_control_for', 'dual_control_status_for',
                       'request_badge_revocation', 'read_badge_revocation', 'revoke_badge',
                       'read_account_badges', 'check_revocation_reason')
     and (pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('influx_creator', p.oid, 'EXECUTE'));
  if v_bad is not null then
    raise exception 'a member role may execute: %', v_bad;
  end if;
  if pg_catalog.has_table_privilege('influx_advertiser', 'verification.badge_revocation_requests',
                                    'SELECT, INSERT, UPDATE, DELETE')
     or pg_catalog.has_any_column_privilege('influx_creator', 'verification.badge_revocation_requests',
                                            'SELECT, INSERT, UPDATE') then
    raise exception 'a member role reaches verification.badge_revocation_requests';
  end if;

  -- still no execution role writing the schema verification
  select string_agg(r.rolname || ' ' || c.relname, ', ') into v_bad
    from pg_catalog.pg_roles r, pg_catalog.pg_class c
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and c.relnamespace = 'verification'::regnamespace and c.relkind in ('r', 'p')
     and (pg_catalog.has_any_column_privilege(r.oid, c.oid, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'execution role(s) writing a verification table: %', v_bad;
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_identity_definer', 'influx_verification_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
