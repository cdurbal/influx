-- =============================================================================
-- 0131_identity_backoffice_invitations
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 3. The two invitations of the backoffice, TWO OBJECTS NEVER MERGED
-- (EC-J8-2: lifetime, surface, rights and effect differ):
--
--   identity.internal_invitations   15 RG99, 03 MFA-1, B-8, §3.1 "Compte agent/admin -
--         créer par invitation" admin · J · R: created by an admin with a fresh second
--         factor, single use, 72 hours, BOUND TO THE ADDRESS, proposed role agent or admin.
--         The token is stored as SHA-256 only. An invitation proposing ADMIN is usable only
--         once a dual control (03 PD4) is confirmed and executed by its confirmer
--         (EC-J8-12: it grants the admin role, 15 RG101). Its acceptance (influx_auth, E-2)
--         creates the account, its single role, its agent profile and the TOTP enrollment
--         token of 0013 under the SAME digest, so that the enrollment of J3 (enroll,
--         enroll/confirm) runs unchanged. Replaces the fixed demo token of EC-45 for real
--         accounts; the local script of example.test keeps writing 0013 directly.
--   backoffice.member_invitations   05 RG116 to RG119 (D54): created by an agent or an
--         admin for a brand or a creator of his network (address, proposed role, language),
--         a unique single-use code stored as SHA-256 only, valid for the days of the setting
--         signup_invitation_validity_days (30, waiting value). Its redemption at sign-up
--         (influx_auth, same transaction as identity.provision_account) makes its author the
--         responsible agent (identity.accounts.owner_agent_id and
--         backoffice.ownership_assignments) and records the acquisition source
--         (identity.accounts.signup_invitation_id, RG120). An expired, used or revoked
--         invitation NEVER blocks a sign-up (RG119): it attributes nothing. No e-mail is sent
--         by INFLUX (EC-J8-3, D35 open): the link is copied by the agent.
--
-- Also: the 2V action identity.invite_admin (closed list of 0130 extended, payload
-- {"invitation_id"}), with backoffice.request_dual_control() rewritten around a shared
-- helper backoffice.canonical_dual_control_payload() that 0132 extends again; the codes
-- internal_invitation.*, member_invitation.*, ownership.assigned; the setting key
-- signup_invitation_validity_days of leads.sync_settings.
--
-- Every function is SECURITY DEFINER owned by influx_identity_definer, empty search_path.
-- Refusals of the internal invitation functions: 42501 'forbidden' (no oracle).
--
-- EC-J8 (micro-gaps, the safest choice; detail where they apply):
--   EC-J8-12  an invitation proposing admin needs 2V + R (03 §3.1 asks R only for the
--             creation, but RG101 asks 2V for granting admin: the stricter wins);
--   EC-J8-13  the member invitation code is stored as SHA-256 only and shown once (the
--             link): a lost link is revoked and recreated; the source keeps the invitation
--             id (signup_invitation_id), never the code;
--   EC-J8-14  the validity of a member invitation is a key of leads.sync_settings (where the
--             signup_* keys live), read by the insert trigger; a missing key refuses the
--             creation (never a silent default);
--   EC-J8-15  one live invitation per address and per kind; an address already holding an
--             account is refused (an invitation it could never use);
--   EC-J8-16  the redemption never raises for a business case and swallows any error into
--             the outcome 'error' (RG119: a sign-up is never blocked); it also records the
--             source for an expired, used or revoked invitation (the person did come through
--             it), without attribution.
--
-- ROLLBACK (before any real invitation): restore the 0130 body of
-- backoffice.request_dual_control() and the constraint dual_control_action_code_closed with
-- identity.grant_role only; drop the functions of section 6 and the helper; drop the trigger
-- functions of sections 3 and 4; alter table identity.accounts drop column
-- signup_invitation_id (and restore the 0104 trigger accounts_signup_source_immutable); drop
-- table backoffice.member_invitations, identity.internal_invitations; restore the 0103
-- constraints of leads.sync_settings (after deleting the key signup_invitation_validity_days)
-- and the 0106 policy sync_settings_identity_definer_select; revoke the grants of section 7;
-- delete the codes of section 1 (possible only while no line references them).
-- =============================================================================

-- 1. The register codes ---------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 15 RG99, RG101: the life cycle of an internal invitation, a privilege-escalation surface
  ('internal_invitation.created',   'identity',   'internal_invitation', 'critical'),
  ('internal_invitation.confirmed', 'identity',   'internal_invitation', 'critical'),
  ('internal_invitation.revoked',   'identity',   'internal_invitation', 'critical'),
  ('internal_invitation.accepted',  'identity',   'internal_invitation', 'critical'),
  -- 05 RG116 to RG119 (D54)
  ('member_invitation.created',     'backoffice', 'member_invitation',   'sensitive'),
  ('member_invitation.revoked',     'backoffice', 'member_invitation',   'sensitive'),
  ('member_invitation.redeemed',    'backoffice', 'member_invitation',   'sensitive'),
  -- 04 §4.3, RG119: a FIRST responsible agent (ownership.reassigned is a change of one)
  ('ownership.assigned',            'backoffice', 'account',             'sensitive')
on conflict (code) do nothing;

-- 2. The setting of the member invitation validity (EC-J8-14) ------------------------------------
-- The two CHECK constraints of 0103 are restated with the new key, everything else verbatim.

alter table leads.sync_settings drop constraint if exists sync_settings_key_closed_list;
alter table leads.sync_settings add constraint sync_settings_key_closed_list check (key in (
    'apollo_scope', 'apollo_legal_basis', 'apollo_prospecting_countries',
    'signup_blocked_countries', 'signup_consent_required', 'signup_invitation_validity_days',
    'retry_schedule', 'rate_limits', 'brevo_list_ids', 'brevo_template_ids'));

alter table leads.sync_settings drop constraint if exists sync_settings_value_shape;
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
    when 'apollo_prospecting_countries' then
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

-- 05 RG116: "valeur d'attente : 30 jours"
insert into leads.sync_settings (key, value) values ('signup_invitation_validity_days', '30')
on conflict (key) do nothing;

comment on column leads.sync_settings.value is
  'apollo_scope: one of the three values of 05 RG81. apollo_legal_basis: {"default": ..., '
  '"by_country": {"<ISO 3166-1>": ...}} (RG83). apollo_prospecting_countries and '
  'signup_blocked_countries: arrays of ISO 3166-1 codes, an EMPTY list means abstention for Apollo '
  '(RG84) and no blocked country for the sign-up (RG8). signup_consent_required: boolean (D63). '
  'signup_invitation_validity_days: integer 1 to 365, validity of a member invitation (05 RG116, '
  '0131). retry_schedule: delays in seconds before attempts 1 to 10 (RG79). rate_limits: positive '
  'integers per connector and unit. brevo_list_ids, brevo_template_ids: Brevo numeric ids or NULL '
  '(not yet configured: the consumer then skips with a clear cause, it never guesses).';

-- 3. identity.internal_invitations -----------------------------------------------------------------

create table if not exists identity.internal_invitations (
  id                       uuid        not null default gen_random_uuid() primary key,
  email                    text        not null,
  proposed_role            identity.account_role not null,
  token_hash               bytea       not null,
  created_by_account_id    uuid        not null,
  created_by_is_internal   boolean     not null generated always as (true) stored,
  reason_code              text        not null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  expires_at               timestamptz not null,
  requires_dual_control    boolean     not null generated always as (proposed_role = 'admin') stored,
  dual_control_request_id  uuid        references backoffice.dual_control_requests (id),
  confirmed_at             timestamptz,
  revoked_at               timestamptz,
  revoked_by_account_id    uuid        references identity.accounts (id),
  revoke_reason_code       text,
  accepted_at              timestamptz,
  account_id               uuid        references identity.accounts (id),

  constraint internal_invitations_token_hash_key unique (token_hash),
  constraint internal_invitations_account_key    unique (account_id),
  constraint internal_invitations_dual_control_key unique (dual_control_request_id),
  constraint internal_invitations_creator_is_internal_fk
    foreign key (created_by_account_id, created_by_is_internal)
    references identity.account_roles (account_id, is_internal),
  constraint internal_invitations_email_normalized
    check (email = lower(btrim(email)) and position('@' in email) > 1 and length(email) <= 320),
  constraint internal_invitations_internal_role check (proposed_role in ('agent', 'admin')),
  constraint internal_invitations_token_sha256  check (octet_length(token_hash) = 32),
  constraint internal_invitations_reason_format check (reason_code ~ '^[a-z][a-z0-9_]{1,62}$'),
  -- 15 RG99: 72 hours, never more
  constraint internal_invitations_lifetime
    check (expires_at > created_at and expires_at <= created_at + interval '72 hours'),
  constraint internal_invitations_confirmation_pair
    check ((dual_control_request_id is null) = (confirmed_at is null)),
  constraint internal_invitations_confirmation_only_admin
    check (confirmed_at is null or requires_dual_control),
  constraint internal_invitations_revocation_triple
    check (num_nonnulls(revoked_at, revoked_by_account_id, revoke_reason_code) in (0, 3)),
  constraint internal_invitations_revoke_reason_format
    check (revoke_reason_code ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint internal_invitations_acceptance_pair
    check ((accepted_at is null) = (account_id is null)),
  constraint internal_invitations_single_end check (accepted_at is null or revoked_at is null),
  -- EC-J8-12: an admin invitation is usable once its dual control is executed
  constraint internal_invitations_admin_confirmed_before_use
    check (accepted_at is null or not requires_dual_control or confirmed_at is not null),
  constraint internal_invitations_accepted_before_expiry
    check (accepted_at is null or (accepted_at >= created_at and accepted_at < expires_at)),
  constraint internal_invitations_confirmed_before_expiry
    check (confirmed_at is null or (confirmed_at >= created_at and confirmed_at < expires_at)),
  constraint internal_invitations_not_self check (account_id is distinct from created_by_account_id)
);

comment on table identity.internal_invitations is
  'Invitations of internal accounts (15 RG99, 03 MFA-1, B-8; D12: no self sign-up on the backoffice). '
  'Created by an active admin with a fresh second factor (03 §3.1 J · R); one proposing admin is usable '
  'only once its dual control is confirmed and executed (EC-J8-12, 15 RG101). Single use, 72 hours, '
  'bound to the address. NEVER merged with backoffice.member_invitations (EC-J8-2). Written by the '
  'identity functions only; never deleted. Retention: 30 days after expiry, revocation or acceptance '
  '(04 §9.1, as identity.mfa_enrollment_tokens; purge E-4 to come).';
comment on column identity.internal_invitations.email is
  'The invited address, normalised (lower case, trimmed). The acceptance requires the SAME address '
  '(15 RG99 "liée à l''adresse"): the GoTrue user and the account are created with it.';
comment on column identity.internal_invitations.token_hash is
  'SHA-256 of the 32 random bytes of the link (base64url), the raw value is never stored (G-1 point 2). '
  'The acceptance copies this digest into identity.mfa_enrollment_tokens: the link is also the '
  'enrollment token of the TOTP (0013).';
comment on column identity.internal_invitations.reason_code is
  'Typed reason of the creation, closed list of identity.create_internal_invitation(): '
  'new_team_member, team_replacement.';
comment on column identity.internal_invitations.requires_dual_control is
  'True for an invitation proposing admin (EC-J8-12): unusable until confirmed_at is set by '
  'identity.approve_admin_invitation() under a dual control identity.invite_admin.';
comment on column identity.internal_invitations.dual_control_request_id is
  'The executed dual control request (action identity.invite_admin, payload {"invitation_id"}).';
comment on column identity.internal_invitations.revoke_reason_code is
  'Closed list: sent_to_wrong_address, no_longer_needed, suspected_compromise, '
  'replaced_by_new_invitation.';
comment on column identity.internal_invitations.account_id is
  'The internal account created by the acceptance (single use).';

create or replace function identity.prepare_internal_invitation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- 15 RG99: the dates are the transaction time, 72 hours; nothing is decided at creation
  new.created_at              := pg_catalog.now();
  new.updated_at              := pg_catalog.now();
  new.expires_at              := pg_catalog.now() + interval '72 hours';
  new.dual_control_request_id := null;
  new.confirmed_at            := null;
  new.revoked_at              := null;
  new.revoked_by_account_id   := null;
  new.revoke_reason_code      := null;
  new.accepted_at             := null;
  new.account_id              := null;
  return new;
end
$$;

comment on function identity.prepare_internal_invitation() is
  'BEFORE INSERT on identity.internal_invitations: created_at = now(), expires_at = now() + 72 hours, '
  'every decision column empty. SECURITY INVOKER, reads nothing.';

create or replace function identity.guard_internal_invitation_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id                       is distinct from old.id
     or new.email                 is distinct from old.email
     or new.proposed_role         is distinct from old.proposed_role
     or new.token_hash            is distinct from old.token_hash
     or new.created_by_account_id is distinct from old.created_by_account_id
     or new.reason_code           is distinct from old.reason_code
     or new.created_at            is distinct from old.created_at
     or new.expires_at            is distinct from old.expires_at then
    raise exception 'immutable invitation column' using errcode = 'insufficient_privilege';
  end if;
  -- an accepted or revoked invitation is frozen; a decision is written once
  if old.accepted_at is not null or old.revoked_at is not null
     or (old.confirmed_at is not null
         and (new.confirmed_at is distinct from old.confirmed_at
              or new.dual_control_request_id is distinct from old.dual_control_request_id)) then
    raise exception 'a decided invitation is frozen' using errcode = 'insufficient_privilege';
  end if;
  -- confirmation and acceptance only before the expiry; revocation at any time before an end
  if (new.confirmed_at is distinct from old.confirmed_at or new.accepted_at is distinct from old.accepted_at)
     and pg_catalog.now() >= old.expires_at then
    raise exception 'the invitation has expired' using errcode = 'insufficient_privilege';
  end if;
  -- the decision instants are the transaction time, never a supplied value
  if new.confirmed_at is distinct from old.confirmed_at then
    new.confirmed_at := pg_catalog.now();
  end if;
  if new.revoked_at is distinct from old.revoked_at then
    new.revoked_at := pg_catalog.now();
  end if;
  if new.accepted_at is distinct from old.accepted_at then
    new.accepted_at := pg_catalog.now();
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function identity.guard_internal_invitation_update() is
  'BEFORE UPDATE on identity.internal_invitations: the invitation itself never changes; an accepted or '
  'revoked invitation is frozen; a confirmation is written once; confirmation and acceptance only '
  'before expires_at; every decision instant is now(). SECURITY INVOKER, reads nothing.';

revoke all on function identity.prepare_internal_invitation()      from public;
revoke all on function identity.guard_internal_invitation_update() from public;

drop trigger if exists internal_invitations_prepare on identity.internal_invitations;
create trigger internal_invitations_prepare
  before insert on identity.internal_invitations
  for each row execute function identity.prepare_internal_invitation();

drop trigger if exists internal_invitations_guard_update on identity.internal_invitations;
create trigger internal_invitations_guard_update
  before update on identity.internal_invitations
  for each row execute function identity.guard_internal_invitation_update();

drop trigger if exists internal_invitations_no_delete on identity.internal_invitations;
create trigger internal_invitations_no_delete
  before delete on identity.internal_invitations
  for each row execute function influx.assert_append_only();

drop trigger if exists internal_invitations_no_truncate on identity.internal_invitations;
create trigger internal_invitations_no_truncate
  before truncate on identity.internal_invitations
  for each statement execute function influx.assert_append_only();

-- No index besides the three keys: a handful of rows, read by token (acceptance) or listed whole
-- by the admin screen (17b §3.13). An index arrives with a measured query (R10).

-- 4. backoffice.member_invitations -------------------------------------------------------------------

create table if not exists backoffice.member_invitations (
  id                        uuid        not null default gen_random_uuid() primary key,
  code_hash                 bytea       not null,
  email                     text        not null,
  proposed_role             identity.account_role not null,
  preferred_language        char(2)     not null,
  preferred_language_is_ui  boolean     not null generated always as (true) stored,
  created_by_account_id     uuid        not null,
  created_by_is_internal    boolean     not null generated always as (true) stored,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  expires_at                timestamptz not null,
  redeemed_at               timestamptz,
  account_id                uuid        references identity.accounts (id),
  revoked_at                timestamptz,
  revoked_by_account_id     uuid        references identity.accounts (id),
  revoke_reason_code        text,

  constraint member_invitations_code_hash_key unique (code_hash),
  constraint member_invitations_account_key   unique (account_id),
  constraint member_invitations_author_is_internal_fk
    foreign key (created_by_account_id, created_by_is_internal)
    references identity.account_roles (account_id, is_internal),
  constraint member_invitations_language_ui_fk
    foreign key (preferred_language, preferred_language_is_ui)
    references reference.languages (code, is_ui_language),
  constraint member_invitations_code_sha256 check (octet_length(code_hash) = 32),
  constraint member_invitations_email_normalized
    check (email = lower(btrim(email)) and position('@' in email) > 1 and length(email) <= 320),
  -- 05 RG116: annonceur ou créateur
  constraint member_invitations_member_role check (proposed_role in ('advertiser', 'creator')),
  constraint member_invitations_lifetime
    check (expires_at > created_at and expires_at <= created_at + interval '365 days'),
  constraint member_invitations_redemption_pair check ((redeemed_at is null) = (account_id is null)),
  constraint member_invitations_redeemed_before_expiry
    check (redeemed_at is null or (redeemed_at >= created_at and redeemed_at < expires_at)),
  constraint member_invitations_revocation_triple
    check (num_nonnulls(revoked_at, revoked_by_account_id, revoke_reason_code) in (0, 3)),
  constraint member_invitations_revoke_reason_format
    check (revoke_reason_code ~ '^[a-z][a-z0-9_]{1,62}$'),
  constraint member_invitations_single_end check (redeemed_at is null or revoked_at is null),
  constraint member_invitations_not_own_account check (account_id is distinct from created_by_account_id)
);

comment on table backoffice.member_invitations is
  'Nominative invitations of a brand or a creator by an agent or an admin (05 RG116 to RG119, D54). '
  'A unique single-use code (SHA-256 only, EC-J8-13), valid for signup_invitation_validity_days '
  '(leads.sync_settings, 30 days). The invited person signs up by the normal path (RG117): nothing is '
  'pre-filled, no consent is inherited, the address used may differ. A valid code makes its author the '
  'responsible agent (RG119); an expired, redeemed or revoked one attributes nothing and never blocks '
  'the sign-up. No e-mail from INFLUX at J8 (EC-J8-3). NEVER merged with identity.internal_invitations '
  '(EC-J8-2). Written by the functions only; never deleted.';
comment on column backoffice.member_invitations.code_hash is
  'SHA-256 of the 32 random bytes of the code (base64url in the link), the raw value is never stored '
  'and is shown once, at creation (EC-J8-13).';
comment on column backoffice.member_invitations.email is
  'The invited address, normalised. Informative (RG117: the sign-up address may differ); never copied '
  'to the register, never sent to Brevo or Apollo by this table.';
comment on column backoffice.member_invitations.proposed_role is
  'advertiser or creator, proposed only: the invited person chooses the final role (RG117).';
comment on column backoffice.member_invitations.preferred_language is
  'Language of the invitation (fr, en): the link opens the sign-up in it.';
comment on column backoffice.member_invitations.created_by_account_id is
  'The author, agent or admin (composite key: an internal account), who becomes the responsible agent '
  'of the account created with a valid code (RG119).';
comment on column backoffice.member_invitations.account_id is
  'The account whose sign-up redeemed the code (single use), set with redeemed_at.';
comment on column backoffice.member_invitations.revoke_reason_code is
  'Closed list: sent_to_wrong_address, no_longer_needed, suspected_compromise, '
  'replaced_by_new_invitation.';

create or replace function backoffice.prepare_member_invitation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_days integer;
begin
  -- 05 RG116: the validity is a setting (EC-J8-14); without it, no invitation
  select (s.value #>> '{}')::integer
    into v_days
    from leads.sync_settings s
   where s.key = 'signup_invitation_validity_days';
  if v_days is null then
    raise exception 'signup_invitation_validity_days is not set'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  new.created_at            := pg_catalog.now();
  new.updated_at            := pg_catalog.now();
  new.expires_at            := pg_catalog.now() + pg_catalog.make_interval(days => v_days);
  new.redeemed_at           := null;
  new.account_id            := null;
  new.revoked_at            := null;
  new.revoked_by_account_id := null;
  new.revoke_reason_code    := null;
  return new;
end
$$;

comment on function backoffice.prepare_member_invitation() is
  'BEFORE INSERT on backoffice.member_invitations: created_at = now(), expires_at = now() + the days of '
  'signup_invitation_validity_days (55000 when the key is missing), every end column empty. SECURITY '
  'INVOKER: the writer reads the setting with its own rights.';

create or replace function backoffice.guard_member_invitation_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id                       is distinct from old.id
     or new.code_hash             is distinct from old.code_hash
     or new.email                 is distinct from old.email
     or new.proposed_role         is distinct from old.proposed_role
     or new.preferred_language    is distinct from old.preferred_language
     or new.created_by_account_id is distinct from old.created_by_account_id
     or new.created_at            is distinct from old.created_at
     or new.expires_at            is distinct from old.expires_at then
    raise exception 'immutable invitation column' using errcode = 'insufficient_privilege';
  end if;
  if old.redeemed_at is not null or old.revoked_at is not null then
    raise exception 'a redeemed or revoked invitation is frozen' using errcode = 'insufficient_privilege';
  end if;
  if new.redeemed_at is distinct from old.redeemed_at then
    if pg_catalog.now() >= old.expires_at then
      raise exception 'the invitation has expired' using errcode = 'insufficient_privilege';
    end if;
    new.redeemed_at := pg_catalog.now();
  end if;
  if new.revoked_at is distinct from old.revoked_at then
    new.revoked_at := pg_catalog.now();
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function backoffice.guard_member_invitation_update() is
  'BEFORE UPDATE on backoffice.member_invitations: the invitation itself never changes; a redeemed or '
  'revoked invitation is frozen; a redemption only before expires_at; every end instant is now(). '
  'SECURITY INVOKER, reads nothing.';

revoke all on function backoffice.prepare_member_invitation()      from public;
revoke all on function backoffice.guard_member_invitation_update() from public;

drop trigger if exists member_invitations_prepare on backoffice.member_invitations;
create trigger member_invitations_prepare
  before insert on backoffice.member_invitations
  for each row execute function backoffice.prepare_member_invitation();

drop trigger if exists member_invitations_guard_update on backoffice.member_invitations;
create trigger member_invitations_guard_update
  before update on backoffice.member_invitations
  for each row execute function backoffice.guard_member_invitation_update();

drop trigger if exists member_invitations_no_delete on backoffice.member_invitations;
create trigger member_invitations_no_delete
  before delete on backoffice.member_invitations
  for each row execute function influx.assert_append_only();

drop trigger if exists member_invitations_no_truncate on backoffice.member_invitations;
create trigger member_invitations_no_truncate
  before truncate on backoffice.member_invitations
  for each statement execute function influx.assert_append_only();

-- No index besides the two keys: the redemption reads by code_hash (unique), the screens list a few
-- hundred rows at most at Lot 1. The per-agent indicator of RG123 gets its index with its query.

-- 5. The acquisition source: the invitation (05 RG120) -------------------------------------------------

alter table identity.accounts
  add column if not exists signup_invitation_id uuid references backoffice.member_invitations (id);

comment on column identity.accounts.signup_invitation_id is
  'Acquisition source "invitation" (05 RG119, RG120): the member invitation whose code was presented '
  'at sign-up, written by backoffice.redeem_member_invitation() in the sign-up transaction, whether it '
  'attributed the account or not (EC-J8-16); never the code itself (EC-J8-13). Immutable afterwards.';

-- RG120: written once, in the creating transaction (created_at = now()), then never changed
create or replace function identity.guard_account_signup_source()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.signup_utm_source      is distinct from old.signup_utm_source
     or new.signup_utm_medium      is distinct from old.signup_utm_medium
     or new.signup_utm_campaign    is distinct from old.signup_utm_campaign
     or new.signup_referrer_domain is distinct from old.signup_referrer_domain
     or new.signup_heard_from      is distinct from old.signup_heard_from then
    raise exception 'the acquisition source of an account is written once' using errcode = 'insufficient_privilege';
  end if;
  if new.signup_invitation_id is distinct from old.signup_invitation_id
     and (old.signup_invitation_id is not null or old.created_at <> pg_catalog.now()) then
    raise exception 'the acquisition source of an account is written once' using errcode = 'insufficient_privilege';
  end if;
  return new;
end
$$;

comment on function identity.guard_account_signup_source() is
  'BEFORE UPDATE on identity.accounts: the five acquisition columns never change after the sign-up '
  '(05 RG120, EC-11); signup_invitation_id goes from NULL to a value once, in the transaction that '
  'created the account (0131), then never changes. SECURITY INVOKER, reads nothing.';

drop trigger if exists accounts_signup_source_immutable on identity.accounts;
create trigger accounts_signup_source_immutable
  before update of signup_utm_source, signup_utm_medium, signup_utm_campaign,
                   signup_referrer_domain, signup_heard_from, signup_invitation_id on identity.accounts
  for each row execute function identity.guard_account_signup_source();

-- 6. The functions --------------------------------------------------------------------------------------

-- 6.1 The 2V payloads, one place (SECURITY INVOKER, owned by influx_identity_definer, no grant) ----------

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
begin
  if p_payload is null or pg_catalog.jsonb_typeof(p_payload) <> 'object' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_action_code = 'identity.grant_role' then
    -- 0130: exactly {"account_id": uuid, "role": account_role}, never the caller (C(3)), an active
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

  if p_action_code = 'identity.invite_admin' then
    -- EC-J8-12: exactly {"invitation_id": uuid}, a live invitation proposing admin, not yet confirmed
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

  raise exception 'forbidden' using errcode = 'insufficient_privilege';
end
$$;

comment on function backoffice.canonical_dual_control_payload(text, jsonb, uuid) is
  'The closed list of 2V actions and the exact shape of each payload (03 PD4; identifiers only, C(33) '
  'spirit): identity.grant_role {"account_id", "role"} (never the caller, an active target); '
  'identity.invite_admin {"invitation_id"} (a live invitation proposing admin, not yet confirmed, '
  'EC-J8-12). Returns the canonical payload, compared whole by the action function; 42501 forbidden '
  'otherwise. Extended by 0132. SECURITY INVOKER owned by influx_identity_definer, NO grant.';

-- 6.2 backoffice.request_dual_control(), rewritten around the helper (same contract as 0130) -------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity, backoffice to influx_identity_definer;

set role influx_identity_definer;

create or replace function backoffice.request_dual_control(
  p_action_code  text,
  p_payload      jsonb,
  p_reason_code  text,
  p_reason_note  text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid;
  v_payload  jsonb;
  v_note     text;
  v_id       uuid;
begin
  v_caller := identity.require_active_admin();

  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,62}$' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_reason_note is not null then
    v_note := nullif(pg_catalog.btrim(
                pg_catalog.regexp_replace(p_reason_note, '[\x01-\x09\x0b-\x1f\x7f]+', ' ', 'g')), '');
    if pg_catalog.length(v_note) > 500 then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- the closed list (with the CHECK of the table) and the canonical payload of each action
  v_payload := backoffice.canonical_dual_control_payload(p_action_code, p_payload, v_caller);

  insert into backoffice.dual_control_requests
    (action_code, payload, reason_code, reason_note, requested_by_account_id)
  values (p_action_code, v_payload, p_reason_code, v_note, v_caller)
  returning id into v_id;

  -- last: the chain lock is held until COMMIT (04 §7.2); never the free note
  perform audit.append('dual_control.requested', 'dual_control_request', v_id,
                       pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                     'reason_code', p_reason_code,
                                                     'action_payload', v_payload));
  return v_id;
end
$$;

-- the owner comments its own function (COMMENT needs ownership)
comment on function backoffice.request_dual_control(text, jsonb, text, text) is
  '03 PD4, 15 RG31: an active admin in aal2 requests a 2V action. Closed list and payload shapes in '
  'backoffice.canonical_dual_control_payload(): identity.grant_role {"account_id", "role"}, '
  'identity.invite_admin {"invitation_id"} (0131), never on his own account (C(3)); typed reason, '
  'optional note of at most 500 characters. Writes the request (pending, expires after the calendar '
  'delay of dual_control_pending) and dual_control.requested {action_code, reason_code, '
  'action_payload}. Returns the request id. Any refusal: 42501 forbidden. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_admin ONLY.';

reset role;

revoke create on schema identity, backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

alter table backoffice.dual_control_requests drop constraint if exists dual_control_action_code_closed;
alter table backoffice.dual_control_requests add constraint dual_control_action_code_closed
  check (action_code in ('identity.grant_role', 'identity.invite_admin'));

comment on column backoffice.dual_control_requests.action_code is
  'Closed list (CHECK): identity.grant_role (0130), identity.invite_admin (0131). An action enters it '
  'with its consuming function.';

-- 6.3 Internal invitation: creation (admin, R) ------------------------------------------------------------

create or replace function identity.create_internal_invitation(
  p_session_id   uuid,
  p_email        text,
  p_role         identity.account_role,
  p_token_hash   bytea,
  p_reason_code  text
)
returns table (invitation_id uuid, expires_at timestamptz, requires_dual_control boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid;
  v_email   text := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_row     record;
begin
  v_caller := identity.require_active_admin();
  -- 03 §3.1 "créer par invitation": R in this transaction
  perform identity.assert_fresh_second_factor(p_session_id);

  if p_role is null or p_role not in ('agent', 'admin')
     or p_reason_code is null or p_reason_code not in ('new_team_member', 'team_replacement')
     or p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32
     or v_email is null or pg_catalog.strpos(v_email, '@') <= 1
     or pg_catalog.length(v_email) > 320 then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- EC-J8-15: one live invitation per address, none for an address that already has an account;
  -- two concurrent creations for one address are serialised here
  perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended('identity.internal_invitation:' || v_email, 0));
  if exists (select 1 from identity.accounts a where a.email = v_email)
     or exists (select 1 from identity.internal_invitations i
                 where i.email = v_email
                   and i.accepted_at is null and i.revoked_at is null
                   and i.expires_at > pg_catalog.now()) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  insert into identity.internal_invitations
    (email, proposed_role, token_hash, created_by_account_id, reason_code)
  values (v_email, p_role, p_token_hash, v_caller, p_reason_code)
  returning id, expires_at, requires_dual_control into v_row;

  -- last: the chain lock is held until COMMIT; never the address
  perform audit.append('internal_invitation.created', 'internal_invitation', v_row.id,
                       pg_catalog.jsonb_build_object('proposed_role', p_role,
                                                     'reason_code', p_reason_code,
                                                     'requires_dual_control', v_row.requires_dual_control));
  return query select v_row.id, v_row.expires_at, v_row.requires_dual_control;
end
$$;

comment on function identity.create_internal_invitation(uuid, text, identity.account_role, bytea, text) is
  '15 RG99, 03 §3.1 (J · R): an active admin in aal2, with R on p_session_id (TOTP within 300 s), '
  'invites an address (normalised) to an agent or admin account. Token: SHA-256 of the link (32 bytes). '
  'Reason: new_team_member | team_replacement. Refused when an account or a live invitation already '
  'holds the address (EC-J8-15). Writes the invitation (72 hours) and internal_invitation.created '
  '{proposed_role, reason_code, requires_dual_control}. An admin invitation is usable only after '
  'identity.approve_admin_invitation() (EC-J8-12). Returns (id, expires_at, requires_dual_control). '
  'Any refusal: 42501 forbidden. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for '
  'influx_admin ONLY.';

-- 6.4 Internal invitation: execution of the 2V of an admin invitation (the confirmer, R) --------------------

create or replace function identity.approve_admin_invitation(
  p_session_id               uuid,
  p_dual_control_request_id  uuid,
  p_invitation_id            uuid,
  p_reason_code              text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid;
  v_mode    text;
begin
  v_caller := identity.require_active_admin();
  if p_invitation_id is null
     or p_reason_code is null or p_reason_code not in ('new_team_member', 'team_replacement') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- a live admin invitation, not yet confirmed, locked
  perform 1
     from identity.internal_invitations i
    where i.id = p_invitation_id
      and i.proposed_role = 'admin'
      and i.confirmed_at is null
      and i.accepted_at is null
      and i.revoked_at is null
      and i.expires_at > pg_catalog.now()
      for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- R in THIS transaction, then the 2V consumed once, by its confirmer
  perform identity.assert_fresh_second_factor(p_session_id);
  v_mode := backoffice.consume_dual_control(
              p_dual_control_request_id,
              'identity.invite_admin',
              pg_catalog.jsonb_build_object('invitation_id', p_invitation_id),
              p_reason_code);

  update identity.internal_invitations
     set dual_control_request_id = p_dual_control_request_id,
         confirmed_at            = pg_catalog.now()
   where id = p_invitation_id;

  perform audit.append('internal_invitation.confirmed', 'internal_invitation', p_invitation_id,
                       pg_catalog.jsonb_build_object('reason_code', p_reason_code,
                                                     'dual_control_request_id', p_dual_control_request_id,
                                                     'dual_control', v_mode));
end
$$;

comment on function identity.approve_admin_invitation(uuid, uuid, uuid, text) is
  'EC-J8-12, 15 RG101: the confirmer of a dual control identity.invite_admin {"invitation_id"} (the peer, '
  'or the requester alone while no other admin can confirm, PD7), with R on p_session_id, makes a live '
  'admin invitation usable. Consumes the request once; writes confirmed_at and '
  'internal_invitation.confirmed {reason_code, dual_control_request_id, dual_control: peer | '
  'degraded_single_operator}. Any refusal: 42501 forbidden. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_admin ONLY.';

-- 6.5 Internal invitation: revocation (admin) ---------------------------------------------------------------

create or replace function identity.revoke_internal_invitation(
  p_invitation_id  uuid,
  p_reason_code    text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller uuid;
begin
  v_caller := identity.require_active_admin();
  if p_reason_code is null
     or p_reason_code not in ('sent_to_wrong_address', 'no_longer_needed', 'suspected_compromise',
                              'replaced_by_new_invitation') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- an unused invitation, expired or not (closing an expired one frees nothing but is allowed)
  update identity.internal_invitations
     set revoked_at = pg_catalog.now(), revoked_by_account_id = v_caller,
         revoke_reason_code = p_reason_code
   where id = p_invitation_id
     and accepted_at is null and revoked_at is null;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  perform audit.append('internal_invitation.revoked', 'internal_invitation', p_invitation_id,
                       pg_catalog.jsonb_build_object('reason_code', p_reason_code));
end
$$;

comment on function identity.revoke_internal_invitation(uuid, text) is
  '15 RG99: an active admin in aal2 revokes an unused internal invitation with a typed reason '
  '(sent_to_wrong_address | no_longer_needed | suspected_compromise | replaced_by_new_invitation); '
  'internal_invitation.revoked {reason_code}. Any refusal: 42501 forbidden. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_admin ONLY.';

-- 6.6 Internal invitation: validity check before GoTrue is called (influx_auth, read only) ------------------

create or replace function identity.internal_invitation_is_valid(
  p_token_hash  bytea,
  p_email       text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from identity.internal_invitations i
     where p_token_hash is not null
       and pg_catalog.octet_length(p_token_hash) = 32
       and i.token_hash = p_token_hash
       and i.email = pg_catalog.lower(pg_catalog.btrim(p_email))
       and i.accepted_at is null
       and i.revoked_at is null
       and i.expires_at > pg_catalog.now()
       and (not i.requires_dual_control or i.confirmed_at is not null)
       and not exists (select 1 from identity.accounts a where a.email = i.email))
$$;

comment on function identity.internal_invitation_is_valid(bytea, text) is
  '15 RG99, first screen of the invitation (J8 commit 7): true when the token (SHA-256) is a live, usable '
  'invitation (an admin one confirmed) of exactly this address (bound to the address) and no account '
  'holds it yet. Reads only; asked BEFORE the GoTrue user is created. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_auth ONLY.';

-- 6.7 Internal invitation: acceptance (influx_auth, E-2) -----------------------------------------------------

create or replace function identity.accept_internal_invitation(
  p_token_hash          bytea,
  p_auth_user_id        uuid,
  p_email               text,
  p_first_name          text,
  p_country_code        text,
  p_preferred_language  text
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email    text := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_first    text := pg_catalog.btrim(p_first_name);
  v_invite   record;
  v_account  uuid;
begin
  if p_token_hash is null or pg_catalog.octet_length(p_token_hash) <> 32 or p_auth_user_id is null
     or v_first is null or pg_catalog.length(v_first) not between 1 and 80 or v_first ~ '[[:cntrl:]]' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- single use under concurrency: the row lock makes one winner; the second finds it accepted
  select i.id, i.email, i.proposed_role, i.created_by_account_id, i.expires_at,
         i.requires_dual_control, i.dual_control_request_id
    into v_invite
    from identity.internal_invitations i
   where i.token_hash = p_token_hash
     and i.accepted_at is null
     and i.revoked_at is null
     and i.expires_at > pg_catalog.now()
     and (not i.requires_dual_control or i.confirmed_at is not null)
     for update;
  -- 15 RG99, B-8: bound to the address; one uniform refusal whatever fails
  if not found or v_invite.email <> v_email
     or exists (select 1 from identity.accounts a
                 where a.email = v_email or a.auth_user_id = p_auth_user_id) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- the account: an internal one is never a lead (no queue line), declared business like the
  -- internal accounts of the demo script; the address is proven by the password sign-in and TOTP
  insert into identity.accounts
    (auth_user_id, email, country_code, preferred_language, display_name, declared_status)
  values (p_auth_user_id, v_email, p_country_code, p_preferred_language, v_first, 'business')
  returning id into v_account;

  -- D41: exactly one role, granted by the author of the invitation
  insert into identity.account_roles (account_id, role, granted_by_account_id)
  values (v_account, v_invite.proposed_role, v_invite.created_by_account_id);

  insert into identity.agent_profiles (account_id, first_name, invited_by_account_id, invited_at)
  values (v_account, v_first, v_invite.created_by_account_id, pg_catalog.now());

  -- G-1 point 2: the link is the enrollment token of 0013, same digest, same deadline
  insert into identity.mfa_enrollment_tokens (account_id, token_hash, created_by_account_id, expires_at)
  values (v_account, p_token_hash, v_invite.created_by_account_id, v_invite.expires_at);

  update identity.internal_invitations
     set accepted_at = pg_catalog.now(), account_id = v_account
   where id = v_invite.id;

  -- last: the chain lock is held until COMMIT
  perform audit.append('internal_invitation.accepted', 'internal_invitation', v_invite.id,
                       pg_catalog.jsonb_build_object('account_id', v_account,
                                                     'role', v_invite.proposed_role));
  -- 15 RG101: the attribution of a role is journaled (the admin one alerted, AL to come)
  perform audit.append('account.role_granted', 'account', v_account,
                       pg_catalog.jsonb_build_object(
                         'role', v_invite.proposed_role,
                         'reason_code', 'internal_invitation',
                         'internal_invitation_id', v_invite.id,
                         'granted_by_account_id', v_invite.created_by_account_id,
                         'dual_control_request_id', v_invite.dual_control_request_id));
  return v_account;
end
$$;

comment on function identity.accept_internal_invitation(bytea, uuid, text, text, text, text) is
  '15 RG99, B-8 (J8 commit 7, E-2): after the GoTrue user is created WITH THE INVITED ADDRESS and its '
  'password (HIBP), consumes a live usable invitation (admin: confirmed) once, under a row lock, and '
  'creates the account (declared business, no queue line), its single role (granted by the author), '
  'its agent profile (first name, invited by, invited at) and the TOTP enrollment token of 0013 with '
  'the SAME digest and deadline: the enrollment of J3 then runs unchanged. Writes '
  'internal_invitation.accepted {account_id, role} and account.role_granted {role, reason_code '
  'internal_invitation, internal_invitation_id, granted_by_account_id, dual_control_request_id}. '
  'Returns the account id. Any refusal (unknown, used, revoked, expired, unconfirmed, other address, '
  'address or GoTrue user already known): 42501 forbidden; 23503 for an unknown country or a language '
  'without translation. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_auth ONLY.';

-- 6.8 Member invitation: creation (agent, admin) -------------------------------------------------------------

create or replace function backoffice.create_member_invitation(
  p_email               text,
  p_proposed_role       identity.account_role,
  p_preferred_language  text,
  p_code_hash           bytea
)
returns table (invitation_id uuid, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := influx.current_account_id();
  v_role    identity.account_role := influx.current_account_role();
  v_email   text := pg_catalog.lower(pg_catalog.btrim(p_email));
  v_row     record;
begin
  -- 05 RG116: an active agent or admin in aal2
  if v_caller is null or v_role is null or v_role not in ('agent', 'admin')
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_proposed_role is null or p_proposed_role not in ('advertiser', 'creator') then
    raise exception 'the proposed role is advertiser or creator' using errcode = 'invalid_parameter_value';
  end if;
  if p_code_hash is null or pg_catalog.octet_length(p_code_hash) <> 32 then
    raise exception 'the code is a SHA-256 digest' using errcode = 'invalid_parameter_value';
  end if;
  if v_email is null or pg_catalog.strpos(v_email, '@') <= 1 or pg_catalog.length(v_email) > 320 then
    raise exception 'a valid address is required' using errcode = 'invalid_parameter_value';
  end if;

  -- EC-J8-15: never one's own address, never an address that already has an account, one live
  -- invitation per address (serialised)
  perform pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended('backoffice.member_invitation:' || v_email, 0));
  if exists (select 1 from identity.accounts a where a.email = v_email) then
    raise exception 'an account already uses this address' using errcode = 'unique_violation';
  end if;
  if exists (select 1 from backoffice.member_invitations i
              where i.email = v_email
                and i.redeemed_at is null and i.revoked_at is null
                and i.expires_at > pg_catalog.now()) then
    raise exception 'a live invitation already exists for this address' using errcode = 'unique_violation';
  end if;

  -- 23503 for a language without translation (composite key)
  insert into backoffice.member_invitations
    (code_hash, email, proposed_role, preferred_language, created_by_account_id)
  values (p_code_hash, v_email, p_proposed_role, p_preferred_language, v_caller)
  returning id, expires_at into v_row;

  -- last: never the address nor the code
  perform audit.append('member_invitation.created', 'member_invitation', v_row.id,
                       pg_catalog.jsonb_build_object('proposed_role', p_proposed_role,
                                                     'preferred_language', p_preferred_language));
  return query select v_row.id, v_row.expires_at;
end
$$;

comment on function backoffice.create_member_invitation(text, identity.account_role, text, bytea) is
  '05 RG116 (D54): an active agent or admin in aal2 invites an address (normalised) as advertiser or '
  'creator, in a UI language; p_code_hash = SHA-256 of the 32 random bytes of the link (EC-J8-13). '
  'Valid for signup_invitation_validity_days (30). Refused: one''s own address or any address holding an '
  'account, a live invitation for the address (23505, EC-J8-15); 22023 for a malformed field, 23503 for '
  'a language without translation, 42501 outside an active internal role in aal2. Writes '
  'member_invitation.created {proposed_role, preferred_language}. Returns (id, expires_at). No e-mail '
  '(EC-J8-3). SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_agent, influx_admin.';

-- 6.9 Member invitation: revocation (its author, or an admin) ----------------------------------------------

create or replace function backoffice.revoke_member_invitation(
  p_invitation_id  uuid,
  p_reason_code    text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := influx.current_account_id();
  v_role    identity.account_role := influx.current_account_role();
begin
  if v_caller is null or v_role is null or v_role not in ('agent', 'admin')
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active')
     or p_reason_code is null
     or p_reason_code not in ('sent_to_wrong_address', 'no_longer_needed', 'suspected_compromise',
                              'replaced_by_new_invitation') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  update backoffice.member_invitations
     set revoked_at = pg_catalog.now(), revoked_by_account_id = v_caller,
         revoke_reason_code = p_reason_code
   where id = p_invitation_id
     and redeemed_at is null and revoked_at is null
     and (created_by_account_id = v_caller or v_role = 'admin');
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  perform audit.append('member_invitation.revoked', 'member_invitation', p_invitation_id,
                       pg_catalog.jsonb_build_object('reason_code', p_reason_code));
end
$$;

comment on function backoffice.revoke_member_invitation(uuid, text) is
  '05 RG116: the author (agent or admin) or any admin, active and in aal2, revokes an unredeemed member '
  'invitation with a typed reason (sent_to_wrong_address | no_longer_needed | suspected_compromise | '
  'replaced_by_new_invitation); member_invitation.revoked {reason_code}. Any refusal: 42501 forbidden. '
  'SECURITY DEFINER owned by influx_identity_definer; EXECUTE for influx_agent, influx_admin.';

-- 6.10 Member invitation: redemption at sign-up (influx_auth, E-2, same transaction) --------------------------

create or replace function backoffice.redeem_member_invitation(
  p_account_id  uuid,
  p_code_hash   bytea
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_invite  record;
begin
  begin
    -- only the account created by THIS transaction (identity.provision_account, outcome created), a
    -- member, without a source nor a responsible agent yet: anything else is not applicable
    perform 1
       from identity.accounts a
       join identity.account_roles r on r.account_id = a.id and r.role in ('advertiser', 'creator')
      where a.id = p_account_id
        and a.status = 'active'
        and a.created_at = pg_catalog.now()
        and a.signup_invitation_id is null
        and a.owner_agent_id is null
        for update of a;
    if not found then
      return 'not_applicable';
    end if;
    if p_code_hash is null or pg_catalog.octet_length(p_code_hash) <> 32 then
      return 'unknown';
    end if;

    -- read without a lock: a FOR UPDATE would only see the rows the update policy lets through
    -- (unredeemed, unrevoked), and an ended invitation must still be recognised (RG120)
    select i.id, i.created_by_account_id, i.expires_at, i.redeemed_at, i.revoked_at
      into v_invite
      from backoffice.member_invitations i
     where i.code_hash = p_code_hash;
    if not found then
      return 'unknown';
    end if;

    -- RG120: the person came through an invitation, whatever its state (EC-J8-16)
    update identity.accounts set signup_invitation_id = v_invite.id where id = p_account_id;

    -- RG119: expired, redeemed or revoked = no attribution, never a refusal
    if v_invite.revoked_at is not null then
      return 'revoked';
    end if;
    if v_invite.redeemed_at is not null then
      return 'already_redeemed';
    end if;
    if v_invite.expires_at <= pg_catalog.now() then
      return 'expired';
    end if;
    -- a deactivated or suspended author is never made responsible (15 RG60, AL41)
    if not exists (select 1
                     from identity.accounts a
                     join identity.agent_profiles p on p.account_id = a.id and p.is_active
                    where a.id = v_invite.created_by_account_id and a.status = 'active') then
      return 'author_inactive';
    end if;

    -- single use under concurrency: the conditional update is the lock; a concurrent winner makes
    -- it touch no row once committed (the condition is re-read), and this sign-up gets no attribution
    update backoffice.member_invitations
       set redeemed_at = pg_catalog.now(), account_id = p_account_id
     where id = v_invite.id
       and redeemed_at is null and revoked_at is null
       and expires_at > pg_catalog.now();
    if not found then
      return case when exists (select 1 from backoffice.member_invitations i
                                where i.id = v_invite.id and i.revoked_at is not null)
                  then 'revoked' else 'already_redeemed' end;
    end if;
    update identity.accounts set owner_agent_id = v_invite.created_by_account_id where id = p_account_id;
    -- backoffice-ops rule 18: the history of the responsible agents (assigned_by NULL: automatic)
    insert into backoffice.ownership_assignments (account_id, agent_account_id, reason_code)
    values (p_account_id, v_invite.created_by_account_id, 'member_invitation');

    perform audit.append('member_invitation.redeemed', 'member_invitation', v_invite.id,
                         pg_catalog.jsonb_build_object('account_id', p_account_id));
    perform audit.append('ownership.assigned', 'account', p_account_id,
                         pg_catalog.jsonb_build_object('agent_account_id', v_invite.created_by_account_id,
                                                       'reason_code', 'member_invitation',
                                                       'member_invitation_id', v_invite.id));
    return 'attributed';
  exception when others then
    -- RG119 (EC-J8-16): an invitation never blocks a sign-up; the subtransaction is undone
    return 'error';
  end;
end
$$;

comment on function backoffice.redeem_member_invitation(uuid, bytea) is
  '05 RG119, RG120 (J8 commit 7, E-2): called by apps/api in the sign-up transaction, right after '
  'identity.provision_account() returned created, with the SHA-256 of the presented code. Outcomes: '
  'attributed (the author becomes the responsible agent: owner_agent_id, an ownership_assignments '
  'line member_invitation, the invitation redeemed; member_invitation.redeemed {account_id} and '
  'ownership.assigned {agent_account_id, reason_code, member_invitation_id}); expired, '
  'already_redeemed, revoked, author_inactive (source recorded, no attribution); unknown (no source); '
  'not_applicable (not an account created by this transaction, or already sourced); error (any '
  'failure, undone, EC-J8-16). NEVER raises: a sign-up is never blocked by an invitation. Nothing is '
  'pre-filled, no consent inherited (RG117). SECURITY DEFINER owned by influx_identity_definer; '
  'EXECUTE for influx_auth ONLY.';

-- 6.11 Publication ---------------------------------------------------------------------------------------

revoke all on function backoffice.canonical_dual_control_payload(text, jsonb, uuid)
  from public, anon, authenticated, service_role;
revoke all on function identity.create_internal_invitation(uuid, text, identity.account_role, bytea, text)
  from public, anon, authenticated, service_role;
revoke all on function identity.approve_admin_invitation(uuid, uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function identity.revoke_internal_invitation(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function identity.internal_invitation_is_valid(bytea, text)
  from public, anon, authenticated, service_role;
revoke all on function identity.accept_internal_invitation(bytea, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.create_member_invitation(text, identity.account_role, text, bytea)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.revoke_member_invitation(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function backoffice.redeem_member_invitation(uuid, bytea)
  from public, anon, authenticated, service_role;

grant execute on function identity.create_internal_invitation(uuid, text, identity.account_role, bytea, text)
   to influx_admin;
grant execute on function identity.approve_admin_invitation(uuid, uuid, uuid, text) to influx_admin;
grant execute on function identity.revoke_internal_invitation(uuid, text)           to influx_admin;
grant execute on function identity.internal_invitation_is_valid(bytea, text)        to influx_auth;
grant execute on function identity.accept_internal_invitation(bytea, uuid, text, text, text, text)
   to influx_auth;
grant execute on function backoffice.create_member_invitation(text, identity.account_role, text, bytea)
   to influx_agent, influx_admin;
grant execute on function backoffice.revoke_member_invitation(uuid, text) to influx_agent, influx_admin;
grant execute on function backoffice.redeem_member_invitation(uuid, bytea) to influx_auth;

-- 7. Rights --------------------------------------------------------------------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy.

alter table identity.internal_invitations enable row level security;
alter table identity.internal_invitations force  row level security;
alter table backoffice.member_invitations enable row level security;
alter table backoffice.member_invitations force  row level security;
revoke all on identity.internal_invitations, backoffice.member_invitations
  from public, anon, authenticated, service_role;

-- 7.1 Readers: the internal invitations for admin, the member invitations for agent and admin,
-- in aal2; NEVER the digests

grant select (id, email, proposed_role, created_by_account_id, reason_code, created_at, updated_at,
              expires_at, requires_dual_control, dual_control_request_id, confirmed_at, revoked_at,
              revoked_by_account_id, revoke_reason_code, accepted_at, account_id)
   on identity.internal_invitations to influx_admin;

drop policy if exists internal_invitations_admin_select on identity.internal_invitations;
create policy internal_invitations_admin_select on identity.internal_invitations
  for select to influx_admin
  using ((select influx.has_aal2()));

grant select (id, email, proposed_role, preferred_language, created_by_account_id, created_at,
              updated_at, expires_at, redeemed_at, account_id, revoked_at, revoked_by_account_id,
              revoke_reason_code)
   on backoffice.member_invitations to influx_agent, influx_admin;

drop policy if exists member_invitations_internal_select on backoffice.member_invitations;
create policy member_invitations_internal_select on backoffice.member_invitations
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 7.2 The owner of the functions, column by column

grant select (id, email, proposed_role, token_hash, created_by_account_id, expires_at,
              requires_dual_control, dual_control_request_id, confirmed_at, revoked_at, accepted_at)
   on identity.internal_invitations to influx_identity_definer;
grant insert (email, proposed_role, token_hash, created_by_account_id, reason_code)
   on identity.internal_invitations to influx_identity_definer;
grant update (dual_control_request_id, confirmed_at, revoked_at, revoked_by_account_id,
              revoke_reason_code, accepted_at, account_id)
   on identity.internal_invitations to influx_identity_definer;

drop policy if exists internal_invitations_identity_definer_select on identity.internal_invitations;
create policy internal_invitations_identity_definer_select on identity.internal_invitations
  for select to influx_identity_definer
  using (true);

drop policy if exists internal_invitations_identity_definer_insert on identity.internal_invitations;
create policy internal_invitations_identity_definer_insert on identity.internal_invitations
  for insert to influx_identity_definer
  with check (created_by_account_id = (select influx.current_account_id()));

drop policy if exists internal_invitations_identity_definer_update on identity.internal_invitations;
create policy internal_invitations_identity_definer_update on identity.internal_invitations
  for update to influx_identity_definer
  using (accepted_at is null and revoked_at is null)
  with check (revoked_by_account_id is null
              or revoked_by_account_id = (select influx.current_account_id()));

grant select (id, code_hash, email, created_by_account_id, expires_at, redeemed_at, revoked_at)
   on backoffice.member_invitations to influx_identity_definer;
grant insert (code_hash, email, proposed_role, preferred_language, created_by_account_id)
   on backoffice.member_invitations to influx_identity_definer;
grant update (redeemed_at, account_id, revoked_at, revoked_by_account_id, revoke_reason_code)
   on backoffice.member_invitations to influx_identity_definer;

drop policy if exists member_invitations_identity_definer_select on backoffice.member_invitations;
create policy member_invitations_identity_definer_select on backoffice.member_invitations
  for select to influx_identity_definer
  using (true);

drop policy if exists member_invitations_identity_definer_insert on backoffice.member_invitations;
create policy member_invitations_identity_definer_insert on backoffice.member_invitations
  for insert to influx_identity_definer
  with check (created_by_account_id = (select influx.current_account_id()));

drop policy if exists member_invitations_identity_definer_update on backoffice.member_invitations;
create policy member_invitations_identity_definer_update on backoffice.member_invitations
  for update to influx_identity_definer
  using (redeemed_at is null and revoked_at is null)
  with check (revoked_by_account_id is null
              or revoked_by_account_id = (select influx.current_account_id()));

-- the validity of a member invitation, read by the insert trigger (EC-J8-14); the 0106 policy
-- restated with the new key
drop policy if exists sync_settings_identity_definer_select on leads.sync_settings;
create policy sync_settings_identity_definer_select on leads.sync_settings
  for select to influx_identity_definer
  using (key in ('signup_blocked_countries', 'signup_consent_required',
                 'signup_invitation_validity_days'));

-- the acceptance: an internal account, its profile, its enrollment token (0004, 0013 rights extended)
grant insert (display_name) on identity.accounts to influx_identity_definer;
grant insert (account_id, first_name, invited_by_account_id, invited_at)
   on identity.agent_profiles to influx_identity_definer;

drop policy if exists agent_profiles_identity_definer_insert on identity.agent_profiles;
create policy agent_profiles_identity_definer_insert on identity.agent_profiles
  for insert to influx_identity_definer
  with check (is_active and not is_break_glass and mfa_factor_id is null
              and invited_by_account_id is not null);

grant insert (account_id, token_hash, created_by_account_id, expires_at)
   on identity.mfa_enrollment_tokens to influx_identity_definer;

-- the redemption: the responsible agent and the source of the account, the ownership history
grant select (created_at, owner_agent_id, signup_invitation_id) on identity.accounts
   to influx_identity_definer;
grant update (owner_agent_id, signup_invitation_id) on identity.accounts to influx_identity_definer;

grant usage on schema backoffice to influx_identity_definer;
grant insert (account_id, agent_account_id, reason_code)
   on backoffice.ownership_assignments to influx_identity_definer;

drop policy if exists ownership_assignments_identity_definer_insert on backoffice.ownership_assignments;
create policy ownership_assignments_identity_definer_insert on backoffice.ownership_assignments
  for insert to influx_identity_definer
  with check (account_id is not null and unassigned_at is null and assigned_by_account_id is null
              and reason_code = 'member_invitation');

-- 8. Hand the functions to influx_identity_definer (03 P7 rule 5, window of 0004 §9) ------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity, backoffice to influx_identity_definer;

alter function backoffice.canonical_dual_control_payload(text, jsonb, uuid) owner to influx_identity_definer;
alter function identity.create_internal_invitation(uuid, text, identity.account_role, bytea, text)
  owner to influx_identity_definer;
alter function identity.approve_admin_invitation(uuid, uuid, uuid, text) owner to influx_identity_definer;
alter function identity.revoke_internal_invitation(uuid, text)           owner to influx_identity_definer;
alter function identity.internal_invitation_is_valid(bytea, text)        owner to influx_identity_definer;
alter function identity.accept_internal_invitation(bytea, uuid, text, text, text, text)
  owner to influx_identity_definer;
alter function backoffice.create_member_invitation(text, identity.account_role, text, bytea)
  owner to influx_identity_definer;
alter function backoffice.revoke_member_invitation(uuid, text)  owner to influx_identity_definer;
alter function backoffice.redeem_member_invitation(uuid, bytea) owner to influx_identity_definer;

revoke create on schema identity, backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 9. End-state assertions ------------------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_fn   text;
  v_bad  text;
begin
  for v_def in
    select * from (values
      ('backoffice.request_dual_control(text, jsonb, text, text)',  true,  array['influx_admin']),
      ('backoffice.canonical_dual_control_payload(text, jsonb, uuid)', false, array[]::text[]),
      ('identity.create_internal_invitation(uuid, text, identity.account_role, bytea, text)',
                                                                   true,  array['influx_admin']),
      ('identity.approve_admin_invitation(uuid, uuid, uuid, text)', true,  array['influx_admin']),
      ('identity.revoke_internal_invitation(uuid, text)',           true,  array['influx_admin']),
      ('identity.internal_invitation_is_valid(bytea, text)',        true,  array['influx_auth']),
      ('identity.accept_internal_invitation(bytea, uuid, text, text, text, text)',
                                                                   true,  array['influx_auth']),
      ('backoffice.create_member_invitation(text, identity.account_role, text, bytea)',
                                                                   true,  array['influx_agent', 'influx_admin']),
      ('backoffice.revoke_member_invitation(uuid, text)',           true,  array['influx_agent', 'influx_admin']),
      ('backoffice.redeem_member_invitation(uuid, bytea)',          true,  array['influx_auth'])
    ) as t (fn, definer, callers)
  loop
    v_fn := v_def.fn;
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_fn::regprocedure) <> 'influx_identity_definer'
       or (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure) <> v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by influx_identity_definer (SECURITY DEFINER: %), empty search_path',
        v_fn, v_def.definer;
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

  -- nobody writes the two tables directly: the functions' owner only
  select string_agg(r.rolname || ' on ' || t, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['identity.internal_invitations', 'backoffice.member_invitations']) t
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_any_column_privilege(r.oid, t, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, t, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'unexpected write right(s): %', v_bad;
  end if;
  -- the digests are read by the owner only
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_column_privilege(r.oid, 'identity.internal_invitations', 'token_hash', 'SELECT')
          or pg_catalog.has_column_privilege(r.oid, 'backoffice.member_invitations', 'code_hash', 'SELECT'));
  if v_bad is not null then
    raise exception 'role(s) reading an invitation digest: %', v_bad;
  end if;
  -- the internal invitations are read by admin and the owner only
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_admin', 'influx_identity_definer')
     and pg_catalog.has_any_column_privilege(r.oid, 'identity.internal_invitations', 'SELECT');
  if v_bad is not null then
    raise exception 'unexpected reader(s) of identity.internal_invitations: %', v_bad;
  end if;

  if (select count(*) from audit.event_types
       where code in ('internal_invitation.created', 'internal_invitation.confirmed',
                      'internal_invitation.revoked', 'internal_invitation.accepted',
                      'member_invitation.created', 'member_invitation.revoked',
                      'member_invitation.redeemed', 'ownership.assigned')) <> 8 then
    raise exception 'the eight codes of 0131 are not all in audit.event_types';
  end if;
  if not exists (select 1 from leads.sync_settings where key = 'signup_invitation_validity_days') then
    raise exception 'signup_invitation_validity_days is missing';
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_identity_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_identity_definer left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema identity or backoffice';
  end if;
end
$$;
