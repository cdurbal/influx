-- =============================================================================
-- 0005_identity_terms_and_consent
-- -----------------------------------------------------------------------------
-- Lot 0 / J2. Published versions of the contractual and informative documents,
-- the proof of their acceptance, and the full history of marketing consent
-- (04 §5.1; CLAUDE.md §9; D63). Both proof tables are APPEND-ONLY for real:
-- no UPDATE / DELETE / TRUNCATE right, plus a trigger that also stops the owner
-- (03 P8, 18 T3.10).
--
-- Writers at this stage (03 §3.1 C(5), §3.5):
--   * a member records his own re-acceptance or acknowledgement, and changes his
--     own consent from the account settings;
--   * the sign-up path (influx_auth, E-2) and the Brevo / Apollo feedback
--     (influx_worker, E-3) receive their rights with their first caller
--     (J3 / J5 / J7), not here (18 T6.1).
-- An agent or an administrator NEVER writes a member's consent (03 C(36)).
-- Reads by agent and admin are journaled by apps/api (03 §2, "J").
--
-- ROLLBACK (only while no real acceptance or consent exists):
--   drop table identity.consent_events, identity.terms_acceptances, identity.terms_versions;
--   drop function identity.prepare_terms_acceptance(), identity.assert_terms_version_immutable();
--   drop type identity.consent_source, identity.consent_purpose,
--             identity.acceptance_channel, identity.acceptance_nature, identity.document_kind;
-- After the first real row: NOT reversible (proof of consent and of acceptance).
-- =============================================================================

-- 1. Types -----------------------------------------------------------------------

do $$
begin
  create type identity.document_kind as enum (
    'terms_of_service', 'privacy_policy', 'cookie_policy', 'supervision_notice');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.acceptance_nature as enum ('acceptance', 'acknowledgement');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.acceptance_channel as enum (
    'signup', 're_acceptance', 'introduction_screen', 'supervision_notice_screen');
exception when duplicate_object then null;
end
$$;

do $$
begin
  -- 04 §5.1, RG35: NO transactional purpose exists, so there is literally no
  -- consent to withdraw on the channel that carries the sign-in code.
  create type identity.consent_purpose as enum ('marketing_email', 'commercial_prospection');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type identity.consent_source as enum (
    'signup_form', 'account_settings', 'brevo_webhook', 'apollo_optout', 'backoffice', 'data_request');
exception when duplicate_object then null;
end
$$;

comment on type identity.document_kind is
  'supervision_notice (12 RG103) is used from Lot 4; declared now so that the acceptance model of '
  '04 §5.1 is complete from the first migration.';
comment on type identity.acceptance_nature is
  'acceptance of a document that requires it (terms of service) vs acknowledgement of information '
  'that cannot be refused without giving up the product (12 RG104). An acknowledgement is NOT a consent.';
comment on type identity.consent_purpose is
  'Marketing purposes only. There is deliberately no transactional value (04 §5.1, 05 RG35): '
  'withdrawing consent can never block the sign-in code.';

-- 2. identity.terms_versions ----------------------------------------------------------

create table if not exists identity.terms_versions (
  id                   uuid        not null default gen_random_uuid() primary key,
  document_kind        identity.document_kind not null,
  locale               char(2)     not null references reference.languages (code),
  version_label        text        not null,
  content_uri          text        not null,
  content_hash         bytea       not null,
  requires_acceptance  boolean     not null,
  published_at         timestamptz not null,
  effective_from       timestamptz not null,
  effective_to         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint terms_versions_label_format  check (version_label ~ '^[0-9A-Za-z._-]{1,40}$'),
  constraint terms_versions_uri_length    check (length(content_uri) between 1 and 500),
  constraint terms_versions_hash_sha256   check (octet_length(content_hash) = 32),
  constraint terms_versions_period        check (effective_to is null or effective_to > effective_from),
  constraint terms_versions_published_first check (effective_from >= published_at),
  -- 04 §5.1: true for the terms of service, false for the privacy policy and the
  -- supervision notice (12 RG104: not a consent)
  constraint terms_versions_acceptance_by_kind check (
    (document_kind <> 'terms_of_service' or requires_acceptance)
    and (document_kind not in ('privacy_policy', 'supervision_notice') or not requires_acceptance)),
  constraint terms_versions_label_unique unique (document_kind, locale, version_label)
);

comment on table identity.terms_versions is
  'Each published version of a contractual or informative document, per language. Immutable once '
  'published: only effective_to may be set, once. A version that changed after the fact would void '
  'every acceptance of it (04 §5.1).';
comment on column identity.terms_versions.content_hash is
  'SHA-256 of the exact published text. Copied on every acceptance (04 R7).';
comment on column identity.terms_versions.effective_to is
  'End of validity; NULL for the version in force. Set once, when the next version takes over.';

create unique index if not exists terms_versions_current_idx
  on identity.terms_versions (document_kind, locale)
  where effective_to is null;
comment on index identity.terms_versions_current_idx is
  'One version in force per document and per language, guaranteed by the database. Also serves the '
  'lookup of the version in force at sign-up and on the re-acceptance screen.';

create or replace function identity.assert_terms_version_immutable()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op in ('DELETE', 'TRUNCATE') then
    raise exception 'identity.terms_versions rows are never deleted (attempted %)', tg_op
      using errcode = 'insufficient_privilege';
  end if;
  -- UPDATE: only effective_to may move, from NULL to a value, once.
  if new.id                  is distinct from old.id
     or new.document_kind       is distinct from old.document_kind
     or new.locale              is distinct from old.locale
     or new.version_label       is distinct from old.version_label
     or new.content_uri         is distinct from old.content_uri
     or new.content_hash        is distinct from old.content_hash
     or new.requires_acceptance is distinct from old.requires_acceptance
     or new.published_at        is distinct from old.published_at
     or new.effective_from      is distinct from old.effective_from
     or new.created_at          is distinct from old.created_at
     or (old.effective_to is not null and new.effective_to is distinct from old.effective_to)
  then
    raise exception 'a published terms version is immutable (only effective_to may be set, once)'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function identity.assert_terms_version_immutable() is
  'Guards identity.terms_versions: no delete, no truncate, no change after publication except '
  'setting effective_to once. SECURITY INVOKER, reads nothing.';

revoke all on function identity.assert_terms_version_immutable() from public;

drop trigger if exists terms_versions_immutable on identity.terms_versions;
create trigger terms_versions_immutable
  before update or delete on identity.terms_versions
  for each row execute function identity.assert_terms_version_immutable();

drop trigger if exists terms_versions_no_truncate on identity.terms_versions;
create trigger terms_versions_no_truncate
  before truncate on identity.terms_versions
  for each statement execute function identity.assert_terms_version_immutable();

-- 3. identity.terms_acceptances ----------------------------------------------------------

create table if not exists identity.terms_acceptances (
  id                uuid        not null default gen_random_uuid() primary key,
  account_id        uuid        not null references identity.accounts (id),
  terms_version_id  uuid        not null references identity.terms_versions (id),
  content_hash      bytea       not null,
  accepted_at       timestamptz not null default now(),
  nature            identity.acceptance_nature  not null default 'acceptance',
  channel           identity.acceptance_channel not null,
  introduction_id   uuid,
  locale            char(2)     not null references reference.languages (code),
  ip_address        inet,
  user_agent        text,
  created_at        timestamptz not null default now(),

  constraint terms_acceptances_hash_sha256 check (octet_length(content_hash) = 32),
  constraint terms_acceptances_user_agent_length check (length(user_agent) <= 500),
  -- the supervision notice screen NEVER produces an acceptance, and an acceptance
  -- NEVER goes through that screen (12 RG104)
  constraint terms_acceptances_notice_is_acknowledgement
    check ((channel = 'supervision_notice_screen') = (nature = 'acknowledgement')),
  -- an introduction-specific acceptance only comes from the introduction screen
  constraint terms_acceptances_introduction_channel
    check ((introduction_id is not null) = (channel = 'introduction_screen'))
);

comment on table identity.terms_acceptances is
  'Proof that a given person accepted (or acknowledged) a given version, at a given time, through a '
  'given channel. Makes the non-circumvention clause enforceable (A5). APPEND-ONLY: an acceptance is '
  'never corrected, it is completed by a new one (03 C(5), P8).';
comment on column identity.terms_acceptances.content_hash is
  'COPY of the version hash at acceptance time (04 R7), filled by the BEFORE INSERT trigger from '
  'identity.terms_versions; a value supplied by the writer is ignored.';
comment on column identity.terms_acceptances.accepted_at is
  'Forced to the transaction time by the BEFORE INSERT trigger: no writer chooses its own date.';
comment on column identity.terms_acceptances.nature is
  'acceptance: the person accepted a document that requires it (terms of service). '
  'acknowledgement: the person TOOK NOTE of information that could not be refused without giving up '
  'the product (supervision of exchanges, 12 RG103, RG104). THIS IS NOT A CONSENT and must never be '
  'presented as one, in the product, in an export or before an authority. The legal basis belongs '
  'to expert-conformite-rgpd (12 Q1, veto).';
comment on column identity.terms_acceptances.introduction_id is
  'Acceptance specific to an introduction (INFLUX proposal, 04 §5.6). The foreign key to '
  'matching.introductions is added with that table (0401).';
comment on column identity.terms_acceptances.locale is
  'Language in which the text was presented; must equal the version locale (checked by trigger).';
comment on column identity.terms_acceptances.ip_address is
  'Element of proof. PERSONAL DATA: retention and relevance to be validated by expert-conformite-rgpd '
  '(04 §12.1 point 6, §12.2).';

create unique index if not exists terms_acceptances_unique_idx
  on identity.terms_acceptances
     (account_id, terms_version_id,
      coalesce(introduction_id, '00000000-0000-0000-0000-000000000000'::uuid));
comment on index identity.terms_acceptances_unique_idx is
  'One acceptance per account, version and introduction (04 §5.1). Constraint, not optimisation; also '
  'answers "has this account acknowledged the notice in force?" (12 CA56).';

create index if not exists terms_acceptances_account_idx
  on identity.terms_acceptances (account_id, accepted_at desc);
comment on index identity.terms_acceptances_account_idx is
  'Backoffice account page: which version was accepted, and when (04 §10.1).';

create or replace function identity.prepare_terms_acceptance()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version record;
begin
  -- security review R3: only the version IN FORCE can be accepted, whoever writes
  select v.content_hash, v.locale
    into v_version
    from identity.terms_versions v
   where v.id = new.terms_version_id
     and v.effective_to is null
     and v.effective_from <= pg_catalog.now();
  if not found then
    -- same message whether the version does not exist or is not visible to the writer
    raise exception 'unknown terms version, or not in force' using errcode = 'foreign_key_violation';
  end if;
  if new.locale is distinct from v_version.locale then
    raise exception 'acceptance locale must equal the version locale'
      using errcode = 'check_violation';
  end if;
  new.content_hash := v_version.content_hash;   -- copied, never supplied (04 R7)
  new.accepted_at  := pg_catalog.now();           -- no writer chooses its own date
  new.created_at   := pg_catalog.now();
  return new;
end
$$;

comment on function identity.prepare_terms_acceptance() is
  'BEFORE INSERT on identity.terms_acceptances: accepts only the version in force (security review R3), '
  'copies the version hash, forces the dates, checks the locale. SECURITY INVOKER: the writer must be able to read the version it accepts.';

revoke all on function identity.prepare_terms_acceptance() from public;

drop trigger if exists terms_acceptances_prepare on identity.terms_acceptances;
create trigger terms_acceptances_prepare
  before insert on identity.terms_acceptances
  for each row execute function identity.prepare_terms_acceptance();

drop trigger if exists terms_acceptances_append_only on identity.terms_acceptances;
create trigger terms_acceptances_append_only
  before update or delete on identity.terms_acceptances
  for each row execute function influx.assert_append_only();

drop trigger if exists terms_acceptances_no_truncate on identity.terms_acceptances;
create trigger terms_acceptances_no_truncate
  before truncate on identity.terms_acceptances
  for each statement execute function influx.assert_append_only();

-- 4. identity.consent_events ------------------------------------------------------------------

create table if not exists identity.consent_events (
  id                      uuid        not null default gen_random_uuid() primary key,
  account_id              uuid        not null references identity.accounts (id),
  purpose                 identity.consent_purpose not null,
  granted                 boolean     not null,
  source                  identity.consent_source  not null,
  occurred_at             timestamptz not null default now(),
  evidence                jsonb       not null default '{}'::jsonb,
  recorded_by_account_id  uuid        references identity.accounts (id),
  created_at              timestamptz not null default now(),

  constraint consent_events_evidence_object check (jsonb_typeof(evidence) = 'object'),
  constraint consent_events_evidence_size   check (pg_column_size(evidence) <= 4000),
  -- a consent is never recorded by a third party (03 C(36)); the only named
  -- exception, an offline consent entered from the backoffice, is not opened
  -- until expert-conformite-rgpd has ruled on it
  constraint consent_events_no_third_party
    check (recorded_by_account_id is null or recorded_by_account_id <> account_id),
  constraint consent_events_recorder_only_backoffice
    check ((recorded_by_account_id is not null) = (source = 'backoffice'))
);

comment on table identity.consent_events is
  'Full history of marketing consent, both ways, as dated events: the question asked six months later '
  'is "what was true on 14 March?". APPEND-ONLY. Read again by the worker AT CONSUMPTION, never at '
  'emission (lead-pipeline rule 2): it conditions every synchronisation to Brevo and Apollo. D63: '
  'consent is required to create an account; withdrawing it later never deletes the account.';
comment on column identity.consent_events.evidence is
  'Form version, checkbox wording key, locale, provider event id: identifiers and codes only.';
comment on column identity.consent_events.recorded_by_account_id is
  'Set only for source = backoffice, a path that stays closed (03 C(36)) until '
  'expert-conformite-rgpd rules on offline consent.';

create index if not exists consent_events_lookup_idx
  on identity.consent_events (account_id, purpose, occurred_at desc);
comment on index identity.consent_events_lookup_idx is
  'Latest consent per account and purpose, read by the worker before EVERY send (04 §10.1). No '
  'current-state table: one indexed row read (04 R10).';

drop trigger if exists consent_events_append_only on identity.consent_events;
create trigger consent_events_append_only
  before update or delete on identity.consent_events
  for each row execute function influx.assert_append_only();

drop trigger if exists consent_events_no_truncate on identity.consent_events;
create trigger consent_events_no_truncate
  before truncate on identity.consent_events
  for each statement execute function influx.assert_append_only();

-- 5. Row level security and privileges -----------------------------------------------------------

alter table identity.terms_versions    enable row level security;
alter table identity.terms_versions    force  row level security;
alter table identity.terms_acceptances enable row level security;
alter table identity.terms_acceptances force  row level security;
alter table identity.consent_events    enable row level security;
alter table identity.consent_events    force  row level security;

revoke all on identity.terms_versions, identity.terms_acceptances, identity.consent_events
  from public, anon, authenticated, service_role;

-- 5.1 terms_versions: read by everyone with a context; publication is an
-- administrator act with dual control (03 §3.1), through a named function later.
grant select on identity.terms_versions
  to influx_advertiser, influx_creator, influx_agent, influx_admin;

drop policy if exists terms_versions_member_select on identity.terms_versions;
create policy terms_versions_member_select on identity.terms_versions
  for select to influx_advertiser, influx_creator
  using ((select influx.current_account_id()) is not null);

drop policy if exists terms_versions_internal_select on identity.terms_versions;
create policy terms_versions_internal_select on identity.terms_versions
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 5.2 terms_acceptances: a member reads and adds his own; agent and admin read.
-- Sign-up acceptances (channel signup) come from influx_auth (J5); acceptances
-- tied to an introduction come from the Lot 4 functions. A member may only write
-- a re-acceptance or a supervision acknowledgement, for himself.
grant select on identity.terms_acceptances
  to influx_advertiser, influx_creator, influx_agent, influx_admin;
grant insert (account_id, terms_version_id, nature, channel, locale, ip_address, user_agent)
   on identity.terms_acceptances to influx_advertiser, influx_creator;

drop policy if exists terms_acceptances_member_select_own on identity.terms_acceptances;
create policy terms_acceptances_member_select_own on identity.terms_acceptances
  for select to influx_advertiser, influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists terms_acceptances_member_insert_own on identity.terms_acceptances;
create policy terms_acceptances_member_insert_own on identity.terms_acceptances
  for insert to influx_advertiser, influx_creator
  with check (account_id = (select influx.current_account_id())
              and channel in ('re_acceptance', 'supervision_notice_screen')
              and introduction_id is null);

drop policy if exists terms_acceptances_internal_select on identity.terms_acceptances;
create policy terms_acceptances_internal_select on identity.terms_acceptances
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 5.3 consent_events: a member reads and changes his own consent, from his
-- account settings only, at the time of the change; agent and admin read, never
-- write (03 C(36)).
grant select on identity.consent_events
  to influx_advertiser, influx_creator, influx_agent, influx_admin;
grant insert (account_id, purpose, granted, source, evidence)
   on identity.consent_events to influx_advertiser, influx_creator;

drop policy if exists consent_events_member_select_own on identity.consent_events;
create policy consent_events_member_select_own on identity.consent_events
  for select to influx_advertiser, influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists consent_events_member_insert_own on identity.consent_events;
create policy consent_events_member_insert_own on identity.consent_events
  for insert to influx_advertiser, influx_creator
  with check (account_id = (select influx.current_account_id())
              and source = 'account_settings'
              and recorded_by_account_id is null
              and occurred_at = now());

drop policy if exists consent_events_internal_select on identity.consent_events;
create policy consent_events_internal_select on identity.consent_events
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));
