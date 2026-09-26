-- =============================================================================
-- 0004_identity_core
-- -----------------------------------------------------------------------------
-- Lot 0 / J2. Accounts, the account <-> roles link (D41), internal agent
-- profiles (break-glass account included, 15 RG103), opaque revocable sessions
-- (EC-2, 03 A-9 / B4), and the two Lot 0 SECURITY DEFINER functions of the
-- identity domain:
--   identity.resolve_session()  owner influx_session_resolver, read only,
--                               the ONLY right of influx_app (03 P7);
--   identity.grant_role()       owner influx_identity_definer, for influx_admin.
-- Neither belongs to the migration role (03 P7 rule 5).
--
-- Deferred on purpose (other migrations, other jalons):
--   * declared_status, email_status, email_undeliverable_at, set_declared_status(),
--     correct_email(): 0104 (Lot 1);
--   * acquisition columns (signup source, D55): J5 (EC-11);
--   * writes on sessions (creation at code verification, sliding renewal,
--     revocation) and account provisioning at sign-up: J3 / J5 (EC-29, EC-30);
--   * the trigger refusing an agent deactivation while he still owns active
--     introductions or open deals: with those tables (Lot 4);
--   * the audit event codes used here (account.role_granted): 0006, where
--     audit.event_types is created.
--
-- ROLLBACK (only while no real account exists):
--   drop function identity.grant_role(uuid, identity.account_role, text);
--   drop function identity.resolve_session(bytea);
--   drop table identity.sessions, identity.agent_profiles;
--   alter table identity.accounts drop constraint accounts_owner_is_internal_fk;
--   drop table identity.account_roles, identity.accounts;
--   drop function identity.assert_valid_timezone();
--   drop type identity.session_revocation_reason, identity.session_aal,
--             identity.session_surface, identity.account_status;
-- =============================================================================

-- 1. Types -----------------------------------------------------------------------

do $$
begin
  create type identity.account_status as enum ('active', 'suspended', 'deleted');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.session_surface as enum ('member', 'backoffice');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.session_aal as enum ('aal1', 'aal2');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.session_revocation_reason as enum (
    'logout',              -- the holder signs out
    'revoked_by_holder',   -- the holder ends another of his sessions (03 A-12)
    'revoked_by_admin',    -- an administrator ends a third party's session (03 §3.1, J)
    'account_suspended',   -- A-9: suspension revokes every open session at once
    'role_changed',        -- 03 §6.3: a role change revokes the open sessions
    'account_deleted',     -- 04 §9.2, step 1
    'mfa_reset'            -- 03 MFA-6 to MFA-9: second factor reset
  );
exception when duplicate_object then null;
end
$$;

comment on type identity.account_status is
  'active, suspended, deleted. Logical deletion only (04 R6): a deleted account keeps its row.';
comment on type identity.session_surface is
  'member (apps/web, advertiser and creator) or backoffice (apps/backoffice, agent and admin).';
comment on type identity.session_aal is
  'Assurance level reached by THIS session: aal2 once the TOTP has been verified (03 §6.2).';
comment on type identity.session_revocation_reason is
  'Closed list of the reasons a session is revoked. Expiry is not a revocation: it is read from '
  'idle_expires_at and absolute_expires_at.';

-- 2. identity.accounts -------------------------------------------------------------

create or replace function identity.assert_valid_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- raises "time zone ... not recognized" on an unknown zone name
  perform pg_catalog.now() at time zone new.timezone;
  return new;
end
$$;

comment on function identity.assert_valid_timezone() is
  'BEFORE INSERT OR UPDATE OF timezone on identity.accounts: refuses a time zone name unknown to '
  'PostgreSQL. SECURITY INVOKER, reads nothing.';

revoke all on function identity.assert_valid_timezone() from public;

create table if not exists identity.accounts (
  id                        uuid        not null default gen_random_uuid() primary key,
  auth_user_id              uuid        not null,
  email                     text        not null,
  email_verified_at         timestamptz,
  country_code              char(2)     not null references reference.countries (code),
  preferred_language        char(2)     not null,
  preferred_language_is_ui  boolean     not null generated always as (true) stored,
  timezone                  text        not null default 'UTC',
  display_name              text,
  status                    identity.account_status not null default 'active',
  owner_agent_id            uuid,
  owner_is_internal         boolean     not null generated always as (true) stored,
  is_adult_attested         boolean     not null default false,
  adult_attested_at         timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  suspended_at              timestamptz,
  deleted_at                timestamptz,
  anonymized_at             timestamptz,
  last_seen_at              timestamptz,

  constraint accounts_auth_user_id_key unique (auth_user_id),
  constraint accounts_email_key        unique (email),
  constraint accounts_email_normalized
    check (email = lower(email) and position('@' in email) > 1 and length(email) <= 320),
  constraint accounts_timezone_length   check (length(timezone) between 1 and 64),
  constraint accounts_display_name_length check (length(display_name) <= 120),
  constraint accounts_preferred_language_ui_fk
    foreign key (preferred_language, preferred_language_is_ui)
    references reference.languages (code, is_ui_language),
  constraint accounts_adult_attestation_pair
    check (is_adult_attested = (adult_attested_at is not null)),
  constraint accounts_suspended_has_date check (status <> 'suspended' or suspended_at is not null),
  constraint accounts_deleted_has_date   check ((status = 'deleted') = (deleted_at is not null)),
  constraint accounts_anonymized_after_deletion check (anonymized_at is null or deleted_at is not null),
  constraint accounts_owner_not_self     check (owner_agent_id is null or owner_agent_id <> id)
);

comment on table identity.accounts is
  'Root of the model: one row per user whatever the role (the role lives in identity.account_roles, '
  'D41). Personal data (e-mail). Never physically deleted: logical deletion then anonymisation '
  '(04 §9.2); the foreign keys of the audit register make a DELETE impossible.';
comment on column identity.accounts.auth_user_id is
  'Id of the matching Supabase Auth user. No foreign key on purpose: the auth schema belongs to '
  'Supabase and is never touched nor relied upon by our policies (04 §5.1).';
comment on column identity.accounts.email is
  'Normalised copy (lower case) of the address. Since D37 it is THE authentication factor of a member.';
comment on column identity.accounts.email_verified_at is
  'First successful code verification: the code proves the address (D37).';
comment on column identity.accounts.preferred_language is
  'UI language of the account (fr or en at launch). The composite key with preferred_language_is_ui '
  'restricts it to reference.languages where is_ui_language.';
comment on column identity.accounts.preferred_language_is_ui is
  'Always true. Only exists to carry the composite foreign key towards the UI languages.';
comment on column identity.accounts.timezone is
  'IANA time zone name, used for reminders and display; checked against the PostgreSQL catalogue.';
comment on column identity.accounts.display_name is
  'Displayed name. For an agent: first name only, the " — INFLUX" suffix is added at display time.';
comment on column identity.accounts.owner_agent_id is
  'Responsible salesperson (commercial responsable) from Lot 0 (D54). The composite key with '
  'owner_is_internal makes it IMPOSSIBLE to point at an account that is not agent or admin, and '
  'impossible to remove the internal role of someone still responsible for an account.';
comment on column identity.accounts.owner_is_internal is
  'Always true. Only exists to carry the composite foreign key towards identity.account_roles.';
comment on column identity.accounts.is_adult_attested is
  'D15: minors excluded at the MVP; attestation given at sign-up, with its date.';
comment on column identity.accounts.last_seen_at is
  'Feeds the activity indicator of the backoffice.';

create index if not exists accounts_created_at_idx
  on identity.accounts (created_at desc);
comment on index identity.accounts_created_at_idx is
  'Backoffice: sign-ups of the day, newest first (04 §10.1).';

create index if not exists accounts_owner_agent_idx
  on identity.accounts (owner_agent_id)
  where deleted_at is null;
comment on index identity.accounts_owner_agent_idx is
  'Portfolio of a salesperson (04 §10.1), and the foreign key check run when an internal role row '
  'is deleted from identity.account_roles.';

drop trigger if exists accounts_touch_updated_at on identity.accounts;
create trigger accounts_touch_updated_at
  before update on identity.accounts
  for each row execute function influx.touch_updated_at();

drop trigger if exists accounts_valid_timezone on identity.accounts;
create trigger accounts_valid_timezone
  before insert or update of timezone on identity.accounts
  for each row execute function identity.assert_valid_timezone();

-- 3. identity.account_roles (D41) ------------------------------------------------------

create table if not exists identity.account_roles (
  account_id             uuid        not null references identity.accounts (id),
  role                   identity.account_role not null,
  granted_at             timestamptz not null default now(),
  granted_by_account_id  uuid        references identity.accounts (id),
  is_internal            boolean     not null generated always as (role in ('agent', 'admin')) stored,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint account_roles_pkey primary key (account_id, role),
  -- D41, MVP: EXACTLY ONE ROLE PER ACCOUNT. Removing this single constraint is the
  -- only schema change needed to open the double role (04 §5.1.1).
  constraint account_roles_single_role_mvp unique (account_id),
  -- target of the composite foreign keys (owner, agent profile, ownership history);
  -- survives the removal of the constraint above
  constraint account_roles_internal_key unique (account_id, is_internal),
  constraint account_roles_not_self_granted
    check (granted_by_account_id is null or granted_by_account_id <> account_id)
);

comment on table identity.account_roles is
  'Role(s) currently held by an account (D41). Only current roles: a revoked role is deleted and both '
  'grant and revocation are written in the audit register (account.role_granted / role_revoked). '
  'Privilege-escalation surface: no execution role writes it directly; identity.grant_role() only.';
comment on constraint account_roles_single_role_mvp on identity.account_roles is
  'D41 (2026-09-18): one role per account at the MVP. Deliberately isolated: removing it is the ONLY '
  'schema change needed to open the double role. Read docs/mvp/04-modele-de-donnees-mvp.md §5.1.1 '
  '(costed debt) first; identity.resolve_session() then needs an explicit role context.';
comment on column identity.account_roles.is_internal is
  'True for agent and admin. Carries the composite keys that restrict owner_agent_id, agent profiles '
  'and ownership assignments to internal accounts.';
comment on column identity.account_roles.granted_by_account_id is
  'Administrator who granted the role; NULL for the role given at self sign-up.';

drop trigger if exists account_roles_touch_updated_at on identity.account_roles;
create trigger account_roles_touch_updated_at
  before update on identity.account_roles
  for each row execute function influx.touch_updated_at();

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'accounts_owner_is_internal_fk'
                    and conrelid = 'identity.accounts'::regclass) then
    alter table identity.accounts
      add constraint accounts_owner_is_internal_fk
      foreign key (owner_agent_id, owner_is_internal)
      references identity.account_roles (account_id, is_internal);
  end if;
end
$$;

-- 4. identity.agent_profiles ---------------------------------------------------------------

create table if not exists identity.agent_profiles (
  account_id                 uuid        not null primary key,
  is_internal                boolean     not null generated always as (true) stored,
  first_name                 text,
  job_title                  text,
  invited_by_account_id      uuid        references identity.accounts (id),
  invited_at                 timestamptz,
  activated_at               timestamptz,
  mfa_enrolled_at            timestamptz,
  requires_reassignment      boolean     not null default false,
  is_active                  boolean     not null default true,
  deactivated_at             timestamptz,
  deactivated_by_account_id  uuid        references identity.accounts (id),
  is_break_glass             boolean     not null default false,
  absence_from               date,
  absence_to                 date,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),

  constraint agent_profiles_internal_fk
    foreign key (account_id, is_internal)
    references identity.account_roles (account_id, is_internal),
  constraint agent_profiles_first_name_length check (length(first_name) between 1 and 80),
  constraint agent_profiles_job_title_length  check (length(job_title) <= 120),
  constraint agent_profiles_active_pair       check (is_active = (deactivated_at is null)),
  constraint agent_profiles_deactivation_author
    check ((deactivated_at is null) = (deactivated_by_account_id is null)),
  constraint agent_profiles_absence_order
    check (absence_to is null or (absence_from is not null and absence_to >= absence_from))
);

comment on table identity.agent_profiles is
  'Internal information of an agent or administrator, never visible to a member. An internal account '
  'is never deleted (15 RG105): it is deactivated, so that its past actions keep its name. The '
  'composite key restricts the table to internal accounts. identity.resolve_session() refuses an '
  'internal account without an active profile.';
comment on column identity.agent_profiles.is_internal is
  'Always true. Only exists to carry the composite foreign key towards identity.account_roles.';
comment on column identity.agent_profiles.requires_reassignment is
  'backoffice-ops rule 19: reassignment is a prerequisite of deactivation (15 RG60, RG105).';
comment on column identity.agent_profiles.is_break_glass is
  'Break-glass administrator account (15 RG103, 03 MFA-10, blocking finding B7). DISTINCT address, '
  'never an alias of a personal one; TOTP on an offline device; recovery codes printed and sealed. '
  'EVERY sign-in raises an immediate alert to the founder (AL33) and an audit line '
  '(agent.break_glass_login), justified in writing within 24 hours. NEVER used for daily work. '
  'Unique partial index: there is only one.';
comment on column identity.agent_profiles.absence_from is
  'DECLARED absence period (15 RG62, RG106). Changes NO right and reassigns NOTHING: it feeds alert '
  'AL41, justifies the continuite_de_service reading reason (12 RG56) and informs colleagues.';

create unique index if not exists agent_profiles_break_glass_idx
  on identity.agent_profiles (is_break_glass)
  where is_break_glass;
comment on index identity.agent_profiles_break_glass_idx is
  'There is only ONE break-glass account (15 RG103); its multiplication would be the first symptom of '
  'a problem. Constraint, not optimisation.';

drop trigger if exists agent_profiles_touch_updated_at on identity.agent_profiles;
create trigger agent_profiles_touch_updated_at
  before update on identity.agent_profiles
  for each row execute function influx.touch_updated_at();

-- 5. identity.sessions (EC-2) -----------------------------------------------------------------

create table if not exists identity.sessions (
  id                   uuid        not null default gen_random_uuid() primary key,
  token_hash           bytea       not null,
  account_id           uuid        not null references identity.accounts (id),
  surface              identity.session_surface not null,
  aal                  identity.session_aal     not null default 'aal1',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  last_activity_at     timestamptz not null default now(),
  idle_expires_at      timestamptz not null,
  absolute_expires_at  timestamptz not null,
  revoked_at           timestamptz,
  revocation_reason    identity.session_revocation_reason,
  user_agent_summary   text,
  country_code         char(2)     references reference.countries (code),

  constraint sessions_token_hash_key       unique (token_hash),
  constraint sessions_token_hash_is_sha256 check (octet_length(token_hash) = 32),
  constraint sessions_revocation_pair      check ((revoked_at is null) = (revocation_reason is null)),
  constraint sessions_activity_order       check (last_activity_at >= created_at),
  constraint sessions_idle_within_absolute check (idle_expires_at <= absolute_expires_at),
  constraint sessions_idle_after_activity  check (idle_expires_at > last_activity_at),
  constraint sessions_user_agent_length    check (length(user_agent_summary) <= 200),
  -- Upper bounds validated by expert-cybersecurite (03 §6.1): member 30 days sliding,
  -- 180 days absolute; backoffice 30 minutes idle, 8 hours absolute. Written in hours
  -- so that the arithmetic does not depend on the session time zone.
  constraint sessions_member_bounds check (
    surface <> 'member'
    or (absolute_expires_at <= created_at + interval '4320 hours'
        and idle_expires_at <= last_activity_at + interval '720 hours')),
  constraint sessions_backoffice_bounds check (
    surface <> 'backoffice'
    or (absolute_expires_at <= created_at + interval '8 hours'
        and idle_expires_at <= last_activity_at + interval '30 minutes'))
);

comment on table identity.sessions is
  'Opaque revocable sessions (EC-2; 03 A-9, blocking finding B4). The cookie carries a random '
  'identifier; the database keeps ONLY its SHA-256 hash. A suspension, a role change or a deletion '
  'revokes every open session of the account immediately. Read before any role is taken by '
  'identity.resolve_session() only.';
comment on column identity.sessions.token_hash is
  'SHA-256 (32 bytes) of the session identifier held by the cookie. The raw value is never stored.';
comment on column identity.sessions.aal is
  'aal2 once the TOTP has been verified for THIS session (backoffice). apps/api copies it into the '
  'influx.aal transaction setting; the policies read it through influx.current_aal() (03 §6.2).';
comment on column identity.sessions.idle_expires_at is
  'Sliding expiry: last activity + 30 days (member) or + 30 minutes (backoffice), at most.';
comment on column identity.sessions.absolute_expires_at is
  'Absolute ceiling whatever the activity: 180 days (member, 03 §6.1) or 8 hours (backoffice).';
comment on column identity.sessions.user_agent_summary is
  'Summarised browser (family and OS, e.g. "Firefox / Android"), never the raw user agent. For the '
  '"my sessions" screen (03 A-12) and the new-device notification.';
comment on column identity.sessions.country_code is
  'Approximate country of the sign-in (03 A-8, B-7), never an address.';

create index if not exists sessions_account_open_idx
  on identity.sessions (account_id)
  where revoked_at is null;
comment on index identity.sessions_account_open_idx is
  'Immediate revocation of every open session of an account on suspension or role change (03 A-9), '
  'and the "my sessions" screen (03 A-12).';

drop trigger if exists sessions_touch_updated_at on identity.sessions;
create trigger sessions_touch_updated_at
  before update on identity.sessions
  for each row execute function influx.touch_updated_at();

-- 6. Row level security --------------------------------------------------------------------------

alter table identity.accounts       enable row level security;
alter table identity.accounts       force  row level security;
alter table identity.account_roles  enable row level security;
alter table identity.account_roles  force  row level security;
alter table identity.agent_profiles enable row level security;
alter table identity.agent_profiles force  row level security;
alter table identity.sessions       enable row level security;
alter table identity.sessions       force  row level security;

revoke all on identity.accounts, identity.account_roles, identity.agent_profiles, identity.sessions
  from public, anon, authenticated, service_role;

grant usage on schema identity
  to influx_advertiser, influx_creator, influx_agent, influx_admin,
     influx_app, influx_session_resolver, influx_identity_definer;
grant usage on schema influx to influx_identity_definer;
grant execute on function influx.current_account_id(),
                          influx.current_account_role(),
                          influx.current_aal(),
                          influx.has_aal2()
   to influx_identity_definer;

-- 6.1 accounts ------------------------------------------------------------------------------
-- 03 §3.1: own data read and modified by every role; all accounts listed by agent and
-- admin (L·J: the nominative journal of the consultation is written by apps/api).
grant select (id, email, email_verified_at, country_code, preferred_language, timezone,
              display_name, status, is_adult_attested, adult_attested_at, created_at,
              updated_at, last_seen_at)
   on identity.accounts to influx_advertiser, influx_creator;
grant select on identity.accounts to influx_agent, influx_admin;
grant update (display_name, timezone, preferred_language)
   on identity.accounts to influx_advertiser, influx_creator, influx_agent, influx_admin;
grant select (id, status) on identity.accounts to influx_session_resolver, influx_identity_definer;

drop policy if exists accounts_member_select_own on identity.accounts;
create policy accounts_member_select_own on identity.accounts
  for select to influx_advertiser, influx_creator
  using (id = (select influx.current_account_id()));

drop policy if exists accounts_member_update_own on identity.accounts;
create policy accounts_member_update_own on identity.accounts
  for update to influx_advertiser, influx_creator
  using      (id = (select influx.current_account_id()) and status = 'active')
  with check (id = (select influx.current_account_id()) and status = 'active');

drop policy if exists accounts_internal_select on identity.accounts;
create policy accounts_internal_select on identity.accounts
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists accounts_internal_update_own on identity.accounts;
create policy accounts_internal_update_own on identity.accounts
  for update to influx_agent, influx_admin
  using      (id = (select influx.current_account_id()) and (select influx.has_aal2())
              and status = 'active')
  with check (id = (select influx.current_account_id()) and (select influx.has_aal2())
              and status = 'active');

drop policy if exists accounts_session_resolver_select on identity.accounts;
create policy accounts_session_resolver_select on identity.accounts
  for select to influx_session_resolver
  using (true);

drop policy if exists accounts_identity_definer_select on identity.accounts;
create policy accounts_identity_definer_select on identity.accounts
  for select to influx_identity_definer
  using (true);

-- 6.2 account_roles -----------------------------------------------------------------------------
-- No INSERT, UPDATE or DELETE for any execution role: identity.grant_role() only.
grant select (account_id, role, granted_at, created_at)
   on identity.account_roles to influx_advertiser, influx_creator;
grant select on identity.account_roles to influx_agent, influx_admin;
grant select (account_id, role) on identity.account_roles
   to influx_session_resolver, influx_identity_definer;
grant insert (account_id, role, granted_by_account_id) on identity.account_roles
   to influx_identity_definer;

drop policy if exists account_roles_member_select_own on identity.account_roles;
create policy account_roles_member_select_own on identity.account_roles
  for select to influx_advertiser, influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists account_roles_internal_select on identity.account_roles;
create policy account_roles_internal_select on identity.account_roles
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists account_roles_session_resolver_select on identity.account_roles;
create policy account_roles_session_resolver_select on identity.account_roles
  for select to influx_session_resolver
  using (true);

drop policy if exists account_roles_identity_definer_select on identity.account_roles;
create policy account_roles_identity_definer_select on identity.account_roles
  for select to influx_identity_definer
  using (true);

drop policy if exists account_roles_identity_definer_insert on identity.account_roles;
create policy account_roles_identity_definer_insert on identity.account_roles
  for insert to influx_identity_definer
  with check (true);

-- 6.3 agent_profiles ------------------------------------------------------------------------------
-- Never visible to a member. Writes arrive with the invitation flow (J3) and the
-- backoffice (Lot 5), through named functions.
grant select on identity.agent_profiles to influx_agent, influx_admin;
grant select (account_id, is_active) on identity.agent_profiles
   to influx_session_resolver, influx_identity_definer;

drop policy if exists agent_profiles_internal_select on identity.agent_profiles;
create policy agent_profiles_internal_select on identity.agent_profiles
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists agent_profiles_session_resolver_select on identity.agent_profiles;
create policy agent_profiles_session_resolver_select on identity.agent_profiles
  for select to influx_session_resolver
  using (true);

drop policy if exists agent_profiles_identity_definer_select on identity.agent_profiles;
create policy agent_profiles_identity_definer_select on identity.agent_profiles
  for select to influx_identity_definer
  using (true);

-- 6.4 sessions -------------------------------------------------------------------------------------
-- 03 §3.1: a role lists its own sessions. token_hash is readable by nobody but the
-- resolver. Writes (creation, renewal, revocation): J3, see EC-29.
grant select (id, account_id, surface, aal, created_at, updated_at, last_activity_at,
              idle_expires_at, absolute_expires_at, revoked_at, revocation_reason,
              user_agent_summary, country_code)
   on identity.sessions to influx_advertiser, influx_creator, influx_agent, influx_admin;
grant select (id, token_hash, account_id, surface, aal, idle_expires_at, absolute_expires_at,
              revoked_at)
   on identity.sessions to influx_session_resolver;

drop policy if exists sessions_member_select_own on identity.sessions;
create policy sessions_member_select_own on identity.sessions
  for select to influx_advertiser, influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists sessions_internal_select_own on identity.sessions;
create policy sessions_internal_select_own on identity.sessions
  for select to influx_agent, influx_admin
  using (account_id = (select influx.current_account_id()) and (select influx.has_aal2()));

drop policy if exists sessions_session_resolver_select on identity.sessions;
create policy sessions_session_resolver_select on identity.sessions
  for select to influx_session_resolver
  using (true);

-- 7. identity.resolve_session() ---------------------------------------------------------------------
-- The ONLY statement influx_app may run before SET LOCAL ROLE (03 P7). Read only.
-- Returns at most one row, and NO row when the session is unknown, revoked or
-- expired, the account is not active, the surface does not match the role, or an
-- internal account has no active agent profile.

create or replace function identity.resolve_session(p_token_hash bytea)
returns table (
  session_id           uuid,
  account_id           uuid,
  account_role         identity.account_role,
  session_surface      identity.session_surface,
  session_aal          identity.session_aal,
  idle_expires_at      timestamptz,
  absolute_expires_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.account_id, r.role, s.surface, s.aal, s.idle_expires_at, s.absolute_expires_at
    from identity.sessions s
    join identity.accounts a       on a.id = s.account_id
    join identity.account_roles r  on r.account_id = a.id
    left join identity.agent_profiles p on p.account_id = a.id
   where p_token_hash is not null
     and pg_catalog.octet_length(p_token_hash) = 32
     and s.token_hash = p_token_hash
     and s.revoked_at is null
     and s.idle_expires_at     > pg_catalog.now()
     and s.absolute_expires_at > pg_catalog.now()
     and a.status = 'active'
     and (   (r.role in ('advertiser', 'creator') and s.surface = 'member')
          or (r.role in ('agent', 'admin') and s.surface = 'backoffice'
              and p.is_active is true))
$$;

comment on function identity.resolve_session(bytea) is
  'Resolves a session from the SHA-256 hash of its identifier: account, business role (read in the '
  'database, never in a token, 03 P3), surface, aal and deadlines. SECURITY DEFINER owned by '
  'influx_session_resolver (no login, no member, column SELECT only, no write); EXECUTE for '
  'influx_app ONLY. No row = no session: apps/api then opens no business transaction. With D41 '
  '(one role per account) at most one row; opening the double role requires an explicit role '
  'context here (04 §5.1.1, item 2).';

revoke all on function identity.resolve_session(bytea) from public;
grant execute on function identity.resolve_session(bytea) to influx_app;

-- 8. identity.grant_role() ---------------------------------------------------------------------------
-- 03 §3.1: grant a role — admin only, J (audit), 2V and R, C(3) never on oneself.
-- The database enforces: caller is an active admin with an active profile, in an
-- aal2 transaction, not acting on himself; the audit line is written in the same
-- transaction. The dual control (2V) and fresh re-authentication (R) are enforced
-- by apps/api until backoffice.dual_control_requests exists (0107, Lot 1): open
-- point for expert-cybersecurite.

create or replace function identity.grant_role(
  p_account_id  uuid,
  p_role        identity.account_role,
  p_reason_code text
)
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
     or not influx.has_aal2()
     or influx.current_account_role() is distinct from 'admin'
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'admin'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller
             and a.status = 'active')
  then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- C(3): never on one's own account; the target must be active, neither suspended
  -- nor deleted (security review R5). Same error as an unknown target (03 T14).
  if p_account_id is null
     or p_account_id = v_caller
     or not exists (select 1 from identity.accounts
                     where id = p_account_id and status = 'active') then  -- R5: not suspended
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_role is null then
    raise exception 'role is required' using errcode = 'invalid_parameter_value';
  end if;

  if p_reason_code is null or p_reason_code !~ '^[a-z][a-z0-9_]{1,62}$' then
    raise exception 'a typed reason code is required' using errcode = 'invalid_parameter_value';
  end if;

  -- D41: a second role violates account_roles_single_role_mvp (23505), on purpose.
  insert into identity.account_roles (account_id, role, granted_by_account_id)
  values (p_account_id, p_role, v_caller);

  perform audit.append(
    'account.role_granted',
    'account',
    p_account_id,
    pg_catalog.jsonb_build_object('role', p_role, 'reason_code', p_reason_code));
end
$$;

comment on function identity.grant_role(uuid, identity.account_role, text) is
  'Grants a role to an account (03 §3.1). SECURITY DEFINER owned by influx_identity_definer; EXECUTE '
  'for influx_admin only. Checks itself the caller (active admin, active profile, aal2), refuses to '
  'act on the caller''s own account (C(3), backoffice-ops ban 46), writes account.role_granted in '
  'the chained register in the same transaction. 2V and R: enforced by apps/api until 0107.';

revoke all on function identity.grant_role(uuid, identity.account_role, text) from public;
grant execute on function identity.grant_role(uuid, identity.account_role, text) to influx_admin;

-- 9. Hand both SECURITY DEFINER functions to their dedicated owners (03 P7 rule 5) ---------------
-- ALTER ... OWNER TO requires (a) that the migration role can SET ROLE to the new
-- owner and (b) that the new owner has CREATE on the schema. Both are granted for
-- the duration of the transfer only, then withdrawn; the end state is asserted.
-- The EXECUTE grants above were made while the migration role still owned the
-- functions: PostgreSQL transfers them to the new owner as grantor.

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_session_resolver', current_user);
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_session_resolver, influx_identity_definer;

alter function identity.resolve_session(bytea) owner to influx_session_resolver;
alter function identity.grant_role(uuid, identity.account_role, text) owner to influx_identity_definer;

revoke create on schema identity from influx_session_resolver, influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_session_resolver', current_user);
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

do $$
declare
  v_bad text;
begin
  -- owners as declared, never the migration role
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'identity.resolve_session(bytea)'::regprocedure) <> 'influx_session_resolver'
     or (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'identity.grant_role(uuid, identity.account_role, text)'::regprocedure)
          <> 'influx_identity_definer' then
    raise exception 'SECURITY DEFINER function owned by the wrong role';
  end if;

  -- no temporary privilege left behind
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_session_resolver', 'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'owner role(s) left with a usable member: %', v_bad;
  end if;

  if pg_catalog.has_schema_privilege('influx_session_resolver', 'identity', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'owner role left with CREATE on schema identity';
  end if;
end
$$;
