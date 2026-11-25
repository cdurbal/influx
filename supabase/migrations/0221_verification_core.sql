-- =============================================================================
-- 0221_verification_core
-- -----------------------------------------------------------------------------
-- Lot 2 / L2E, commit 05 (jalons/l2e/05.md; l2e/modele.md §3, §4 "Paramètres", "Registre", §5;
-- l2e/registres.md; D79, D81, D82; 04 §5.3, §7.5, l. 6391; 08 RG57, RG59, RG60, RG73, RG100; 06
-- RG51, RG52; 15 RG26 to RG29). The objects of the verification, without any door, bucket, decision
-- nor derivation: the member doors come with 0222, the bucket and the life of an evidence row with
-- 0223, the claims and decisions (and the owner influx_verification_definer) with 0224, the public
-- bands with 0225, the export and the erasure with 0226.
--
--   verification.badge_level, request_status, badge_state, evidence_state   the enums of modele §3.
--   verification.rejection_reasons   the two closed lists of the refusal (08 RG57 creator, 06 RG51
--         and RG52 brand, EC-L2E-11), primary key (population, code): a creator reason never refuses
--         a brand request (foreign key by population). label_key reason.verification.<code>,
--         message_key verificationDecision.reason.<population>.<code> (texts in email.json, 16).
--   verification.revocation_reasons  the five codes of 08 RG73 (04 l. 1629), the foreign key of a
--         revoked badge; no revocation before L2F.
--   verification.registry_sources    the free public registers of l2e/registres.md (D79 (12)): one
--         row per country (e_justice, national), GLEIF once without a country; a source "à
--         confirmer" is loaded INACTIVE, an administrator activates it after checking its gratuity
--         by hand (RG101, 0224 set_registry_source). One active source per country.
--   verification.verification_requests   one request per (account, network line, level), the entry
--         of queue 4 (D81, file.md A1): its lock, its deadlines frozen at the SUBMISSION (the
--         passage to `pending`, by a BEFORE trigger, 04 §5.6), its decision, its typed reason; at
--         most one draft or pending per triplet. The status moves forward only (trigger).
--   verification.ownership_codes     the code INFLUX-XXXXXXXX of a request (network or domain) and
--         what the agent read on line (RG25, CA13: handle, or domain and channel); one live code
--         per request. The generator comes with the doors (0222).
--   verification.evidence_files      the rows of the evidence (D82), written before the object;
--         object_key generated <account_id>/<request_id>/<id>.webp (T9.3, T9.9); retention_due_at
--         NOT NULL from the insertion (RG86, L2E-D1). Their life (doors, purge) comes with 0223.
--   verification.badges              what the badge asserts (04 l. 1586): a fact, its source, a
--         named person, a date; the audience badge carries its three observed figures and its
--         period (04 l. 6391, L2E-D3); at most one holding badge per (account, line, level)
--         (L2E-D4; `replaced` and the ended states out of it, EC-L2E-14).
--   Queue 4 `verification` in the catalogue (15 RG29): agent and admin, a lock, no bulk action;
--         240, 480, escalation 960 (as 0206).
--   The parameters of 08 RG100 in backoffice.operational_settings (modele §4, values of D79), each
--         key with its own CHECK; read by agent and admin in aal2, written by the migrations only.
--   The codes verification.* of the register and of the queue (modele §4 "Registre", "Outbox").
--   Rights (fiche invariant 1, EC-L2E-18): RLS enabled and forced, refusal by default. The
--         creator reads his own rows, column by column (never the lock, an agent, the internal
--         comment, the re-examination, the escalation, what the agent observed, the key nor the
--         checksum); agent and admin read in aal2, never the rows of their own account, never the
--         object_key; nobody writes directly. influx_advertiser holds NOTHING on the schema, USAGE
--         included, default privileges included (04 §7.5): the brand reads through its function
--         (0222). Asserted at the end.
--
-- EC-L2E-05 (micro-gaps, the safest choice):
--   EC-L2E-05-1   0221 is the next free number (ls supabase/migrations).
--   EC-L2E-05-2   no SECURITY DEFINER function here: influx_creator_verification_definer and
--                 influx_verification_definer are created with their first functions (0222, 0224),
--                 as influx_moderation_definer was (0210); the policies that let them write come
--                 with them.
--   EC-L2E-05-3   the deadlines are written by a BEFORE trigger (submitted_at, sla_due_at,
--                 escalate_at) at the passage to `pending`, never by the caller, and frozen after;
--                 created_at keeps its default (the doors receive no right on it). The status moves
--                 forward only: draft -> pending, cancelled, expired, closed; pending -> approved,
--                 rejected, closed, cancelled (the line deleted, modele -16); an ended request
--                 never changes status (55000 DETAIL `request_status`).
--   EC-L2E-05-4   `closed` carries account_unavailable, and only it; approved and rejected always
--                 carry their decider, closed may carry none (a closure by the system, Lot 5).
--   EC-L2E-05-5   revocation_reasons: label_key reason.verification_revocation.<code>, message_key
--                 verificationRevocation.reason.<code> (04 l. 1632 names the columns, not the keys);
--                 requires_comment false everywhere (08 RG73 is silent), escalates_to_admin as RG73.
--   EC-L2E-05-6   bounds of the parameters (RG100 gives the values, not the ranges): see §6; a key
--                 refuses a fraction, a string and a value outside its range.
--   EC-L2E-05-7   registry sources: "à confirmer" = is_active false, checked_on = the day of the
--                 survey (2026-11-07); NO keeps e-Justice active and its national register inactive
--                 (one active per country); United States: no row (registres.md: GLEIF, then a list
--                 of States, empty) — a State needs a subdivision this table does not have yet, to
--                 decide with its first row (lines 15, 23).
--   EC-L2E-05-8   badges: declared_followers_at_decision may be NULL (04 l. 6391 makes the declared
--                 posts and comments required, the line may carry no follower count); the observed
--                 engagement is optional (EC-L2E-12); the account badge never has an expiry (RG71,
--                 RG100 names none), the audience and brand badges always one.
--   EC-L2E-05-9   checksum: the SHA-256 of the stored WebP, bytea of 32 bytes (04 l. 1565).
--   EC-L2E-05-10  the four codes of the outbox (received, decision, request_expired, code_issued)
--                 are registered with those of the register: a catalogue row writes nothing.
--   EC-L2E-05-11  observed handle and platform reference: 100 printable characters at most, as the
--                 handle of the line (0217); observed domain: the shape of website_domain (0202).
--
-- ROLLBACK (before any request is written): drop table verification.badges,
-- verification.evidence_files, verification.ownership_codes, verification.verification_requests,
-- verification.registry_sources, verification.revocation_reasons, verification.rejection_reasons;
-- drop function verification.prepare_request(); drop type verification.evidence_state,
-- verification.badge_state, verification.request_status, verification.badge_level; delete from
-- backoffice.queues and backoffice.sla_policies where code / queue_code = 'verification' (one
-- transaction); delete the keys of §6 from backoffice.operational_settings and recreate
-- operational_settings_key_closed as in 0206; delete from audit.event_types where code like
-- 'verification.%' (possible only while no line uses them); revoke usage on schema verification
-- from influx_creator, influx_agent, influx_admin.
-- =============================================================================

-- 1. The four enums (04 §3.1: the code branches on them) -----------------------------------------

do $$
begin
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'badge_level' and t.typnamespace = 'verification'::regnamespace) then
    create type verification.badge_level as enum
      ('account_verified', 'audience_verified', 'brand_verified');
  end if;
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'request_status' and t.typnamespace = 'verification'::regnamespace) then
    create type verification.request_status as enum
      ('draft', 'pending', 'approved', 'rejected', 'cancelled', 'expired', 'closed');
  end if;
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'badge_state' and t.typnamespace = 'verification'::regnamespace) then
    create type verification.badge_state as enum
      ('active', 'to_refresh', 'to_reconfirm', 'expired', 'revoked', 'replaced');
  end if;
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'evidence_state' and t.typnamespace = 'verification'::regnamespace) then
    create type verification.evidence_state as enum ('pending', 'active', 'purging', 'purged');
  end if;
end
$$;

comment on type verification.badge_level is
  'The three levels of 08 (04 l. 1596): account_verified (ownership of a network account), '
  'audience_verified (its audience, on the native dashboard), brand_verified (domain and register). '
  'Also the level a request asks for.';
comment on type verification.request_status is
  'Life of a request (modele §1 point 2): draft (opened by the member, code or evidence to come), '
  'pending (submitted: in queue 4, the only status the queue shows), approved, rejected, closed '
  '(account_unavailable, 08 RG57), cancelled (by the member, or its line deleted), expired (a draft '
  'whose code expired). "To re-examine" is an internal reason, the request stays pending.';
comment on type verification.badge_state is
  '04 l. 1605 plus replaced (EC-L2E-14): active, to_refresh (grace), to_reconfirm (identity of the '
  'observed account in doubt, 08 RG78), expired, revoked (08 RG73), replaced (by a refreshed badge). '
  'active, to_refresh and to_reconfirm hold the place of the badge (unique index).';
comment on type verification.evidence_state is
  'Life of an evidence row (D82, modele §3): pending (row written, object not yet stored), active, '
  'purging (object to remove), purged (object removed, row, checksum and findings kept).';

-- 2. verification.rejection_reasons (08 RG57, RG59; 06 RG51, RG52; EC-L2E-11; modele §3, §5) ---------

create table if not exists verification.rejection_reasons (
  population               text     not null,
  code                     text     not null,
  label_key                text     not null,
  message_key              text     not null,
  requires_member_message  boolean  not null default false,
  escalates_to_admin       boolean  not null default false,
  purges_evidence          boolean  not null default false,
  position                 smallint not null,
  is_active                boolean  not null default true,

  constraint rejection_reasons_pkey primary key (population, code),
  constraint rejection_reasons_population check (population in ('creator', 'brand')),
  constraint rejection_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint rejection_reasons_label_key check (label_key = 'reason.verification.' || code),
  constraint rejection_reasons_message_key
    check (message_key = 'verificationDecision.reason.' || population || '.' || code),
  constraint rejection_reasons_position check (position > 0),
  constraint rejection_reasons_position_unique unique (population, position),
  -- the evidence is the creator's only (EC-L2E-10: the brand deposits none)
  constraint rejection_reasons_purge_creator check (not purges_evidence or population = 'creator')
);

comment on table verification.rejection_reasons is
  'The two closed lists of the refusal of a verification request (08 RG56, RG57; 06 RG51, RG52 for '
  'the brand, EC-L2E-11), distinct by population: a refusal is never mute (RG56), and a creator '
  'reason never refuses a brand request (composite foreign key of verification_requests). Read by '
  'agent and admin in aal2; written by the migrations.';
comment on column verification.rejection_reasons.label_key is
  'Translation key of the reason in the backoffice: reason.verification.<code>.';
comment on column verification.rejection_reasons.message_key is
  'Key of the message sent to the member (RG57, modele §5), in apps/api/src/locales/{fr,en}/'
  'email.json: verificationDecision.reason.<population>.<code>.';
comment on column verification.rejection_reasons.requires_member_message is
  'The decision requires the message written by the agent to the member: other and terms_breach '
  '(RG57 "message dédié"), checked by the decision (0224).';
comment on column verification.rejection_reasons.escalates_to_admin is
  '08 RG59: a signal on the account, escalated to an administrator in addition to the refusal '
  '(evidence_suspected_forgery, shared_account, terms_breach, minor).';
comment on column verification.rejection_reasons.purges_evidence is
  'The refusal puts the evidence to purging at once (evidence_too_wide: third-party data, RG88).';

insert into verification.rejection_reasons
  (population, code, label_key, message_key, requires_member_message, escalates_to_admin,
   purges_evidence, position)
values
  ('creator', 'missing_evidence',           'reason.verification.missing_evidence',
   'verificationDecision.reason.creator.missing_evidence',           false, false, false,  1),
  ('creator', 'evidence_too_old',           'reason.verification.evidence_too_old',
   'verificationDecision.reason.creator.evidence_too_old',           false, false, false,  2),
  ('creator', 'evidence_unreadable',        'reason.verification.evidence_unreadable',
   'verificationDecision.reason.creator.evidence_unreadable',        false, false, false,  3),
  ('creator', 'evidence_wrong_source',      'reason.verification.evidence_wrong_source',
   'verificationDecision.reason.creator.evidence_wrong_source',      false, false, false,  4),
  ('creator', 'evidence_too_wide',          'reason.verification.evidence_too_wide',
   'verificationDecision.reason.creator.evidence_too_wide',          false, false, true,   5),
  ('creator', 'ownership_not_proven',       'reason.verification.ownership_not_proven',
   'verificationDecision.reason.creator.ownership_not_proven',       false, false, false,  6),
  ('creator', 'account_not_public',         'reason.verification.account_not_public',
   'verificationDecision.reason.creator.account_not_public',         false, false, false,  7),
  ('creator', 'ownership_prerequisite',     'reason.verification.ownership_prerequisite',
   'verificationDecision.reason.creator.ownership_prerequisite',     false, false, false,  8),
  ('creator', 'evidence_inconsistent',      'reason.verification.evidence_inconsistent',
   'verificationDecision.reason.creator.evidence_inconsistent',      false, false, false,  9),
  ('creator', 'evidence_suspected_forgery', 'reason.verification.evidence_suspected_forgery',
   'verificationDecision.reason.creator.evidence_suspected_forgery', false, true,  false, 10),
  ('creator', 'shared_account',             'reason.verification.shared_account',
   'verificationDecision.reason.creator.shared_account',             false, true,  false, 11),
  ('creator', 'agency_managed',             'reason.verification.agency_managed',
   'verificationDecision.reason.creator.agency_managed',             false, false, false, 12),
  ('creator', 'terms_breach',               'reason.verification.terms_breach',
   'verificationDecision.reason.creator.terms_breach',               true,  true,  false, 13),
  ('creator', 'minor',                      'reason.verification.minor',
   'verificationDecision.reason.creator.minor',                      false, true,  false, 14),
  ('creator', 'account_unavailable',        'reason.verification.account_unavailable',
   'verificationDecision.reason.creator.account_unavailable',        false, false, false, 15),
  ('creator', 'other',                      'reason.verification.other',
   'verificationDecision.reason.creator.other',                      true,  false, false, 16),
  ('brand',   'domain_code_not_found',      'reason.verification.domain_code_not_found',
   'verificationDecision.reason.brand.domain_code_not_found',        false, false, false,  1),
  ('brand',   'registration_not_found',     'reason.verification.registration_not_found',
   'verificationDecision.reason.brand.registration_not_found',       false, false, false,  2),
  ('brand',   'registration_unverifiable_country',
   'reason.verification.registration_unverifiable_country',
   'verificationDecision.reason.brand.registration_unverifiable_country', false, false, false, 3),
  ('brand',   'name_mismatch',              'reason.verification.name_mismatch',
   'verificationDecision.reason.brand.name_mismatch',                false, false, false,  4),
  ('brand',   'account_unavailable',        'reason.verification.account_unavailable',
   'verificationDecision.reason.brand.account_unavailable',          false, false, false,  5),
  ('brand',   'other',                      'reason.verification.other',
   'verificationDecision.reason.brand.other',                        true,  false, false,  6)
on conflict (population, code) do nothing;

-- 3. verification.revocation_reasons (04 l. 1627-1647; 08 RG73) -----------------------------------

create table if not exists verification.revocation_reasons (
  code                text     not null primary key,
  label_key           text     not null,
  message_key         text     not null,
  requires_comment    boolean  not null default false,
  notifies_member     boolean  not null default true,
  escalates_to_admin  boolean  not null default false,
  is_active           boolean  not null default true,

  constraint revocation_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint revocation_reasons_label_key
    check (label_key = 'reason.verification_revocation.' || code),
  constraint revocation_reasons_message_key
    check (message_key = 'verificationRevocation.reason.' || code)
);

comment on table verification.revocation_reasons is
  'The five reasons of a withdrawal outside expiry (08 RG73, 04 l. 1627), distinct from the refusal '
  'reasons: influx_error says INFLUX was wrong (RG74). The foreign key of a revoked badge; no '
  'withdrawal before L2F. Read by agent and admin in aal2; written by the migrations.';

insert into verification.revocation_reasons
  (code, label_key, message_key, escalates_to_admin)
values
  ('forged_evidence', 'reason.verification_revocation.forged_evidence',
   'verificationRevocation.reason.forged_evidence', true),
  ('account_closed',  'reason.verification_revocation.account_closed',
   'verificationRevocation.reason.account_closed',  false),
  ('owner_changed',   'reason.verification_revocation.owner_changed',
   'verificationRevocation.reason.owner_changed',   true),
  ('terms_breach',    'reason.verification_revocation.terms_breach',
   'verificationRevocation.reason.terms_breach',    true),
  ('influx_error',    'reason.verification_revocation.influx_error',
   'verificationRevocation.reason.influx_error',    true)
on conflict (code) do nothing;

-- 4. verification.registry_sources (06 RG52; D79 (12); l2e/registres.md) ------------------------

create table if not exists verification.registry_sources (
  id                     uuid        not null primary key default gen_random_uuid(),
  country_code           char(2)     references reference.countries (code),
  source_type            text        not null,
  name                   text        not null,
  url                    text        not null,
  checked_on             date        not null,
  is_active              boolean     not null default false,
  updated_by_account_id  uuid        references identity.accounts (id),
  updated_at             timestamptz not null default now(),

  constraint registry_sources_type check (source_type in ('national', 'e_justice', 'gleif')),
  -- GLEIF answers for every country; the others for one
  constraint registry_sources_country
    check ((source_type = 'gleif') = (country_code is null)),
  constraint registry_sources_name
    check (char_length(name) between 2 and 160 and name ~ '[^[:space:]]' and name !~ '[[:cntrl:]]'),
  constraint registry_sources_url
    check (url ~ '^https://[^[:space:][:cntrl:]]+$' and char_length(url) <= 500)
);

-- one active source per country, and one active GLEIF (D79 (12), modele §3)
create unique index if not exists registry_sources_one_active
  on verification.registry_sources ((coalesce(country_code::text, '')))
  where is_active;

comment on table verification.registry_sources is
  'The free public registers an agent consults for the registration of a brand (06 RG52, D79 (12), '
  'l2e/registres.md): one row per country (e_justice: the 27 of the Union, IS, LI, NO; national), '
  'GLEIF once, without a country, as the fallback of every country. One ACTIVE source per country. '
  'A source whose gratuity is not written by an official page ("à confirmer") is loaded inactive: '
  'an administrator activates it after checking it by hand (RG101; 0224 set_registry_source, '
  'journalled registry_source_changed). Never a private aggregator (D79). Read by agent and admin in '
  'aal2.';
comment on column verification.registry_sources.checked_on is
  'Day the page was last opened and its gratuity read (2026-11-07 for the rows of 0221).';
comment on column verification.registry_sources.is_active is
  'Consulted by the agents. False at the loading for a source "à confirmer" (registres.md).';

-- e-Justice: the 27 of the Union, plus IS, LI, NO (registres.md, admitted)
insert into verification.registry_sources (country_code, source_type, name, url, checked_on, is_active)
select c.code, 'e_justice', 'e-Justice Portal, Find a company (BRIS)',
       'https://e-justice.europa.eu/489/EN/business_registers__search_for_a_company_in_the_eu',
       date '2026-11-07', true
  from (values ('AT'), ('BE'), ('BG'), ('HR'), ('CY'), ('CZ'), ('DK'), ('EE'), ('FI'), ('FR'),
               ('DE'), ('GR'), ('HU'), ('IE'), ('IT'), ('LV'), ('LT'), ('LU'), ('MT'), ('NL'),
               ('PL'), ('PT'), ('RO'), ('SK'), ('SI'), ('ES'), ('SE'), ('IS'), ('LI'), ('NO'))
         as c (code)
 where not exists (select 1 from verification.registry_sources s
                    where s.country_code = c.code and s.source_type = 'e_justice');

-- GLEIF: every country, the fallback (admitted)
insert into verification.registry_sources (country_code, source_type, name, url, checked_on, is_active)
select null, 'gleif', 'GLEIF, LEI search', 'https://search.gleif.org/', date '2026-11-07', true
 where not exists (select 1 from verification.registry_sources s where s.source_type = 'gleif');

-- national registers: AU and SG admitted (SG: the free search only), the others "à confirmer"
insert into verification.registry_sources (country_code, source_type, name, url, checked_on, is_active)
select v.code, 'national', v.name, v.url, date '2026-11-07', v.active
  from (values
    ('AU', 'ABN Lookup (Australian Business Register)', 'https://abr.business.gov.au/', true),
    ('SG', 'ACRA Bizfile, free search',
     'https://www.acra.gov.sg/how-to-guides/buying-information/overview', true),
    ('GB', 'Companies House, Find and update company information',
     'https://find-and-update.company-information.service.gov.uk/', false),
    ('CH', 'Zefix', 'https://www.zefix.admin.ch/en/search/entity/welcome', false),
    ('NO', 'Enhetsregisteret (Bronnoysund Register Centre)',
     'https://www.brreg.no/en/about-us-2/our-registers/about-the-central-coordinating-register-for-legal-entities-ccr/',
     false),
    ('CA', 'Corporations Canada (federal)',
     'https://ised-isde.canada.ca/cc/lgcy/fdrlCrpSrch.html?locale=en_CA', false),
    ('NZ', 'Companies Office, companies register',
     'https://companies-register.companiesoffice.govt.nz/', false),
    ('JP', 'Corporate Number Publication Site', 'https://www.houjin-bangou.nta.go.jp/en/', false),
    ('BR', 'Receita Federal, comprovante CNPJ',
     'https://solucoes.receita.fazenda.gov.br/servicos/cnpjreva/cnpjreva_solicitacao.asp', false),
    ('IN', 'MCA, company master data',
     'https://www.mca.gov.in/content/mca/global/en/mca/master-data/MDS.html', false)
  ) as v (code, name, url, active)
 where not exists (select 1 from verification.registry_sources s
                    where s.country_code = v.code and s.source_type = 'national');

drop trigger if exists registry_sources_touch_updated_at on verification.registry_sources;
create trigger registry_sources_touch_updated_at
  before update on verification.registry_sources
  for each row execute function influx.touch_updated_at();

-- 5. Queue 4 and its delay (15 RG29; 08 RG61 to RG67) ----------------------------------------------
-- ON CONFLICT DO NOTHING: re-running the migration never overwrites a value changed since.

insert into backoffice.queues
  (code, label_key, spec_document, handled_by_roles, allows_bulk_action, has_lock)
values
  ('verification', 'queue.verification', '08 RG61-RG67; 06 RG51-RG52', '{agent,admin}', false, true)
on conflict (code) do nothing;

insert into backoffice.sla_policies
  (queue_code, target_claim_minutes, target_decision_minutes, business_hours,
   escalate_after_minutes, is_provisional)
values
  -- 1 business day, claim within 4 business hours, escalation at 3 business days of age (as 0206)
  ('verification', 240, 480, default, 960, false)
on conflict (queue_code) do nothing;

-- the deferred key is checked now: a pending trigger event would block any later ALTER TABLE
set constraints backoffice.queues_sla_policy_fk immediate;

-- 6. The parameters of 08 RG100 (modele §4; D79; EC-L2E-4, EC-L2E-05-6) ----------------------------

alter table backoffice.operational_settings
  drop constraint if exists operational_settings_key_closed;
alter table backoffice.operational_settings
  add constraint operational_settings_key_closed check (key in (
    'claim_expiry_minutes',
    'verification_code_validity_days', 'evidence_freshness_days', 'audience_badge_validity_days',
    'badge_grace_days', 'brand_badge_validity_months', 'request_retry_hours',
    'rejection_cap_count', 'rejection_cap_window_days', 'figures_gap_alert_percent',
    'audience_drop_alert_percent', 'dispute_window_days', 'evidence_retention_days',
    'findings_retention_days', 'evidence_max_files_per_request', 'evidence_max_upload_bytes'));

-- one CHECK per key, the shape of claim_expiry_minutes (0206): a JSON whole number in its range
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('verification_code_validity_days', 1, 90),
      ('evidence_freshness_days',         1, 365),
      ('audience_badge_validity_days',    1, 730),
      ('badge_grace_days',                0, 365),
      ('brand_badge_validity_months',     1, 60),
      ('request_retry_hours',             0, 720),
      ('rejection_cap_count',             1, 100),
      ('rejection_cap_window_days',       1, 365),
      ('figures_gap_alert_percent',       1, 1000),
      ('audience_drop_alert_percent',     1, 100),
      ('dispute_window_days',             1, 365),
      ('evidence_retention_days',         1, 365),
      ('findings_retention_days',         1, 3650),
      ('evidence_max_files_per_request',  1, 20),
      -- the ceiling of D82: 8 MiB, the limit of the bucket and of the relay route
      ('evidence_max_upload_bytes',       1, 8388608)
    ) as t (key, low, high)
  loop
    execute format('alter table backoffice.operational_settings drop constraint if exists %I',
                   'operational_settings_' || r.key);
    execute format(
      'alter table backoffice.operational_settings add constraint %I check ('
      || 'key <> %L or case when jsonb_typeof(value) = ''number'' '
      || 'then (value)::numeric = trunc((value)::numeric) and (value)::numeric between %s and %s '
      || 'else false end)',
      'operational_settings_' || r.key, r.key, r.low, r.high);
  end loop;
end
$$;

comment on column backoffice.operational_settings.key is
  'Closed list (operational_settings_key_closed). claim_expiry_minutes: duration of a claim on a '
  'queue entry with a lock (15 RG27 C3, file.md A9), whole minutes, 1 to 1440. From 0221, the '
  'parameters of 08 RG100 (l2e/modele.md §4, values of D79): verification_code_validity_days, '
  'evidence_freshness_days, audience_badge_validity_days, badge_grace_days, '
  'brand_badge_validity_months, request_retry_hours, rejection_cap_count, '
  'rejection_cap_window_days, figures_gap_alert_percent, audience_drop_alert_percent, '
  'dispute_window_days, evidence_retention_days, findings_retention_days, '
  'evidence_max_files_per_request, evidence_max_upload_bytes; each a whole number in the range of '
  'its own CHECK operational_settings_<key>.';

insert into backoffice.operational_settings (key, value) values
  ('verification_code_validity_days', '7'::jsonb),
  ('evidence_freshness_days',         '30'::jsonb),
  ('audience_badge_validity_days',    '90'::jsonb),
  ('badge_grace_days',                '30'::jsonb),
  ('brand_badge_validity_months',     '12'::jsonb),
  ('request_retry_hours',             '24'::jsonb),
  ('rejection_cap_count',             '3'::jsonb),
  ('rejection_cap_window_days',       '30'::jsonb),
  ('figures_gap_alert_percent',       '30'::jsonb),
  ('audience_drop_alert_percent',     '40'::jsonb),
  ('dispute_window_days',             '30'::jsonb),
  ('evidence_retention_days',         '45'::jsonb),
  ('findings_retention_days',         '1095'::jsonb),
  ('evidence_max_files_per_request',  '6'::jsonb),
  ('evidence_max_upload_bytes',       '8388608'::jsonb)
on conflict (key) do nothing;

-- 7. verification.verification_requests (modele §3; file.md A1; D81; 04 §5.6) ----------------------

create table if not exists verification.verification_requests (
  id                                uuid        not null primary key default gen_random_uuid(),
  account_id                        uuid        not null references identity.accounts (id),
  -- no foreign key: the trace survives the line (modele §3); null <=> a brand request
  social_account_id                 uuid,
  network_code                      text        references reference.networks (code),
  level                             verification.badge_level    not null,
  population                        text        not null
                                                generated always as
                                                  (case when level = 'brand_verified'
                                                        then 'brand' else 'creator' end) stored,
  status                            verification.request_status not null default 'draft',
  created_at                        timestamptz not null default now(),
  submitted_at                      timestamptz,
  sla_due_at                        timestamptz,
  escalate_at                       timestamptz,
  claimed_by_account_id             uuid        references identity.accounts (id),
  claimed_at                        timestamptz,
  claim_expires_at                  timestamptz,
  forced_release_at                 timestamptz,
  forced_release_by_account_id      uuid        references identity.accounts (id),
  forced_release_holder_account_id  uuid        references identity.accounts (id),
  forced_release_reason_code        text        references backoffice.claim_release_reasons (code),
  decided_by_account_id             uuid        references identity.accounts (id),
  decided_at                        timestamptz,
  rejection_reason_code             text,
  member_message                    text,
  internal_comment                  text,
  reexamine_reason_code             text,
  reexamined_at                     timestamptz,
  escalated_at                      timestamptz,
  cancelled_at                      timestamptz,
  closed_at                         timestamptz,
  -- 04 l. 2238: the decision came after the deadline (15 C8: a late decision is possible, marked)
  sla_breached                      boolean     not null
                                                generated always as
                                                  (decided_at is not null and decided_at > sla_due_at)
                                                stored,
  updated_at                        timestamptz not null default now(),

  -- targets of the composite keys: a code, an evidence or a badge belongs to a request of ITS
  -- account (and a badge to a request of its level)
  constraint verification_requests_id_account unique (id, account_id),
  constraint verification_requests_id_account_level unique (id, account_id, level),
  -- RG56, EC-L2E-11: a creator reason never refuses a brand request, and conversely
  constraint verification_requests_reason_fk
    foreign key (population, rejection_reason_code)
    references verification.rejection_reasons (population, code),
  -- a brand request has no network line; a creator request always one, and its network
  constraint verification_requests_target
    check ((level = 'brand_verified') = (social_account_id is null)
           and (social_account_id is null) = (network_code is null)),
  -- the submission: pending and the decisions were submitted; the deadlines come with it
  constraint verification_requests_submitted
    check (status not in ('pending', 'approved', 'rejected') or submitted_at is not null),
  constraint verification_requests_deadlines
    check ((submitted_at is null) = (sla_due_at is null)),
  constraint verification_requests_submitted_after check (submitted_at >= created_at),
  constraint verification_requests_sla_after check (sla_due_at >= submitted_at),
  constraint verification_requests_escalate_after check (escalate_at >= sla_due_at),
  -- draft and pending, and only they, are open
  constraint verification_requests_closed
    check ((status in ('draft', 'pending')) = (closed_at is null)),
  constraint verification_requests_closed_after check (closed_at >= created_at),
  constraint verification_requests_cancelled
    check ((status = 'cancelled') = (cancelled_at is not null)),
  -- RG47, invariant 5: approved and rejected always carry the named person who decided (EC-L2E-05-4)
  constraint verification_requests_decided
    check ((status not in ('approved', 'rejected') or decided_by_account_id is not null)
           and (decided_by_account_id is null or status in ('approved', 'rejected', 'closed'))),
  constraint verification_requests_decided_together
    check ((decided_by_account_id is null) = (decided_at is null)),
  constraint verification_requests_decided_after check (decided_at >= submitted_at),
  -- RG56 (L2E-D2): a refusal is never mute; closed carries account_unavailable, and only it
  constraint verification_requests_rejection_reason
    check ((status in ('rejected', 'closed')) = (rejection_reason_code is not null)),
  constraint verification_requests_closed_reason
    check ((status = 'closed') = (rejection_reason_code is not distinct from 'account_unavailable')),
  -- the message to the member: on a refusal or a closure, 20 to 500 printable characters
  constraint verification_requests_member_message_decided
    check (member_message is null or status in ('rejected', 'closed')),
  constraint verification_requests_member_message_length
    check (char_length(member_message) between 20 and 500),
  constraint verification_requests_member_message_text
    check (member_message ~ '[^[:space:]]'
           and member_message !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- the internal comment, never sent to the member, 1 000 printable characters at most
  constraint verification_requests_internal_comment_length
    check (char_length(internal_comment) between 1 and 1000),
  constraint verification_requests_internal_comment_text
    check (internal_comment ~ '[^[:space:]]'
           and internal_comment !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- "to re-examine" (RG50, CA29): an internal reason of a closed list, dated, the request pending
  constraint verification_requests_reexamine_reason
    check (reexamine_reason_code in ('network_unreachable', 'evidence_technical',
                                     'registry_unavailable', 'storage_unavailable')),
  constraint verification_requests_reexamined_together
    check ((reexamine_reason_code is null) = (reexamined_at is null)),
  -- 15 RG27 C1 to C3: a claim is whole (holder, instant, expiry), its expiry after it
  constraint verification_requests_claim_together
    check ((claimed_by_account_id is null) = (claimed_at is null)
           and (claimed_at is null) = (claim_expires_at is null)),
  constraint verification_requests_claim_expiry check (claim_expires_at > claimed_at),
  -- 15 C4: the last forced release is whole (instant, admin, dispossessed holder, reason)
  constraint verification_requests_forced_release_together
    check (pg_catalog.num_nulls(forced_release_at, forced_release_by_account_id,
                                forced_release_holder_account_id, forced_release_reason_code)
           in (0, 4))
);

-- invariant 7, RG21: one draft or pending request per triplet (account, line, level)
create unique index if not exists verification_requests_one_open
  on verification.verification_requests
     (account_id, coalesce(social_account_id, '00000000-0000-0000-0000-000000000000'::uuid), level)
  where status in ('draft', 'pending');
-- queue 4 (15 RG26: oldest deadline first; 04 l. 5693 without the in_review of 04)
create index if not exists verification_requests_queue_idx
  on verification.verification_requests (sla_due_at, created_at) where status = 'pending';
-- the history of an account (RG60: the refusals of a triplet; the member's own reads)
create index if not exists verification_requests_account_idx
  on verification.verification_requests (account_id, created_at);

comment on table verification.verification_requests is
  'Queue 4 (15 RG29 verification; 08 RG61 to RG67; D81, l2e/modele.md §3): one request per '
  '(account, network line, level), a creator request (account_verified, audience_verified) or a '
  'brand request (brand_verified); at most one draft or pending per triplet. Carries the lock (15 '
  'RG27), the deadlines frozen at the submission (04 §5.6, trigger), the decision and its typed '
  'reason. Opened by the member doors (0222), decided by the functions of 0224 only. Read by the '
  'creator (his own, without lock, agent, deadlines, internal comment, re-examination nor escalation; '
  'the brand through its function) and by agent and admin in aal2, never on their own account '
  '(15 RG36). No right of influx_advertiser (fiche invariant 1).';
comment on column verification.verification_requests.social_account_id is
  'The network line (profiles.creator_social_accounts.id) of a creator request; NULL for a brand. '
  'No foreign key: the request, its decision and its badge survive the line (modele §3, -16).';
comment on column verification.verification_requests.population is
  'Generated from the level: creator or brand. Half of the key of the refusal reason (RG56).';
comment on column verification.verification_requests.submitted_at is
  'Passage to pending (the submission), written by the trigger verification_requests_prepare; '
  'the deadlines are counted from it, once.';
comment on column verification.verification_requests.sla_due_at is
  'Decision deadline, frozen at the submission: backoffice.business_deadline(verification, '
  'submitted_at, target_decision_minutes) of the policy in force then (04 §5.6). Never recomputed.';
comment on column verification.verification_requests.escalate_at is
  'Escalation instant, frozen at the submission: business_deadline(verification, sla_due_at, '
  'escalate_after_minutes).';
comment on column verification.verification_requests.claim_expires_at is
  'End of the claim: claimed_at + claim_expiry_minutes (file.md A9). Held <=> a holder and '
  'claim_expires_at > now(); computed at the read, no task.';
comment on column verification.verification_requests.member_message is
  'Message written by the agent to the member (RG57 other, terms_breach), plain text, 20 to 500 '
  'characters, on a refusal or a closure only; checked for coordinates by apps/api. Emptied by the '
  'erasure.';
comment on column verification.verification_requests.internal_comment is
  'Comment of the agent, 1 000 characters at most, NEVER shown to the member, sent by e-mail, '
  'written to the register nor exported (fiche invariant 11).';
comment on column verification.verification_requests.reexamine_reason_code is
  'Internal reason of a "to re-examine" (RG50, CA29: network_unreachable, evidence_technical, '
  'registry_unavailable, storage_unavailable): the request stays pending, its age runs on.';
comment on column verification.verification_requests.escalated_at is
  'Escalation to an administrator (RG59; -17: the screen at Lot 5), journalled '
  'verification.escalated.';
comment on column verification.verification_requests.sla_breached is
  'Generated: decided after sla_due_at (04 l. 2238; 15 C8, a late decision is marked).';

drop trigger if exists verification_requests_touch_updated_at
  on verification.verification_requests;
create trigger verification_requests_touch_updated_at
  before update on verification.verification_requests
  for each row execute function influx.touch_updated_at();

-- 7.1 The deadlines, written once, at the submission; the status moves forward only (EC-L2E-05-3) --

create or replace function verification.prepare_request()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision  integer;
  v_escalate  integer;
begin
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       and not ((old.status = 'draft'
                 and new.status in ('pending', 'cancelled', 'expired', 'closed'))
                or (old.status = 'pending'
                    and new.status in ('approved', 'rejected', 'closed', 'cancelled'))) then
      raise exception 'verification request: % cannot become %', old.status, new.status
        using errcode = 'object_not_in_prerequisite_state', detail = 'request_status';
    end if;
    new.created_at := old.created_at;
  end if;

  if new.status = 'pending' and (tg_op = 'INSERT' or old.status = 'draft') then
    select p.target_decision_minutes, p.escalate_after_minutes
      into v_decision, v_escalate
      from backoffice.sla_policies p
     where p.queue_code = 'verification' and p.is_active;
    if not found then
      raise exception 'queue verification has no active delay policy'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    new.submitted_at := pg_catalog.now();
    new.sla_due_at   := backoffice.business_deadline('verification', new.submitted_at, v_decision);
    new.escalate_at  := backoffice.business_deadline('verification', new.sla_due_at, v_escalate);
  elsif tg_op = 'UPDATE' then
    -- frozen once written (04 §5.6, R7)
    new.submitted_at := old.submitted_at;
    new.sla_due_at   := old.sla_due_at;
    new.escalate_at  := old.escalate_at;
  end if;
  return new;
end
$$;

comment on function verification.prepare_request() is
  'BEFORE INSERT OR UPDATE on verification.verification_requests: at the passage to pending (the '
  'submission), submitted_at = now(), sla_due_at and escalate_at computed ONCE from the policy of '
  'queue verification in force (04 §5.6, D39), whatever the writer gave; frozen afterwards, as '
  'created_at. The status moves forward only: draft -> pending, cancelled, expired, closed; '
  'pending -> approved, rejected, closed, cancelled; anything else 55000 DETAIL request_status. '
  'SECURITY INVOKER: the writer reads the policy and executes business_deadline() with its own '
  'rights (granted with the doors, 0222).';

revoke all on function verification.prepare_request() from public, anon, authenticated, service_role;

drop trigger if exists verification_requests_prepare on verification.verification_requests;
create trigger verification_requests_prepare
  before insert or update on verification.verification_requests
  for each row execute function verification.prepare_request();

-- 8. verification.ownership_codes (modele §3; 04 l. 1532-1559; 08 RG21 to RG25) ---------------------

create table if not exists verification.ownership_codes (
  id                             uuid        not null primary key default gen_random_uuid(),
  request_id                     uuid        not null,
  account_id                     uuid        not null,
  kind                           text        not null,
  code                           text        not null,
  created_at                     timestamptz not null default now(),
  expires_at                     timestamptz not null,
  revoked_at                     timestamptz,
  observed_by_account_id         uuid        references identity.accounts (id),
  observed_at                    timestamptz,
  observed_handle                text,
  observed_platform_account_ref  text,
  observed_domain                text,
  observed_channel               text,

  constraint ownership_codes_code_unique unique (code),
  -- the code belongs to a request of its account
  constraint ownership_codes_request_fk
    foreign key (request_id, account_id)
    references verification.verification_requests (id, account_id),
  constraint ownership_codes_kind check (kind in ('network', 'domain')),
  -- RG22: INFLUX- and 8 signs without ambiguity (no 0, 1, I, L, O), never a coordinate
  constraint ownership_codes_code_shape
    check (code ~ '^INFLUX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
  constraint ownership_codes_expiry check (expires_at > created_at),
  constraint ownership_codes_revoked_after check (revoked_at >= created_at),
  constraint ownership_codes_channel check (observed_channel in ('dns_txt', 'web_page')),
  -- RG25, 04 l. 1558: a finding is whole, by its agent; what was seen depends on the kind
  constraint ownership_codes_observed_by
    check ((observed_at is null) = (observed_by_account_id is null)),
  constraint ownership_codes_observed_network
    check (kind <> 'network'
           or (observed_domain is null and observed_channel is null
               and (observed_at is null) = (observed_handle is null)
               and (observed_platform_account_ref is null or observed_at is not null))),
  constraint ownership_codes_observed_domain
    check (kind <> 'domain'
           or (observed_handle is null and observed_platform_account_ref is null
               and (observed_at is null) = (observed_domain is null)
               and (observed_domain is null) = (observed_channel is null))),
  -- EC-L2E-05-11: the bounds of the handle of a line (0217) and of website_domain (0202)
  constraint ownership_codes_observed_handle
    check (char_length(observed_handle) <= 100 and observed_handle ~ '[^[:space:]]'
           and observed_handle !~ '[[:cntrl:]]'),
  constraint ownership_codes_observed_platform_account_ref
    check (char_length(observed_platform_account_ref) <= 100
           and observed_platform_account_ref ~ '[^[:space:]]'
           and observed_platform_account_ref !~ '[[:cntrl:]]'),
  constraint ownership_codes_observed_domain_shape
    check (char_length(observed_domain) <= 100 and observed_domain = lower(observed_domain)
           and observed_domain ~ '^([[:alnum:]]([[:alnum:]-]{0,61}[[:alnum:]])?\.)+[[:alnum:]][[:alnum:]-]{0,61}[[:alnum:]]$')
);

-- RG23: one valid code per request (the former one revoked when a new one is issued)
create unique index if not exists ownership_codes_one_live
  on verification.ownership_codes (request_id) where revoked_at is null;
create index if not exists ownership_codes_account_idx
  on verification.ownership_codes (account_id);

comment on table verification.ownership_codes is
  'The code of a request (08 RG21 to RG25; modele §3): network (put in the bio of the account, '
  'account_verified) or domain (a DNS TXT record or a page of the website, brand_verified); one '
  'non-revoked code per request, valid verification_code_validity_days days. The agent reads it '
  'ON LINE and types what he saw (RG25, CA13, CA14): the handle (and the stable reference of the '
  'account when the network shows it), or the domain and the channel; never copied from the '
  'declaration, never updated afterwards (04 l. 1546). Issued by the member doors (0222), observed '
  'by the decisions (0224). Read by the creator (his codes, without the finding) and by agent and '
  'admin in aal2. No right of influx_advertiser: the brand reads its code through its function.';
comment on column verification.ownership_codes.observed_handle is
  'Identifiant @ du compte tel que l''agent l''a LU EN LIGNE au moment du constat (R7). Jamais '
  'recopie depuis le declaratif du createur, jamais mis a jour ensuite. C''est la valeur qu''on '
  'compare a l''identifiant courant pour detecter un changement (08 RG78).';
comment on column verification.ownership_codes.observed_platform_account_ref is
  'Identifiant interne stable du compte chez le reseau (numeric user id), quand le reseau l''expose. '
  'Un pseudo change, cet identifiant non. Nullable : tous les reseaux ne l''affichent pas.';
comment on column verification.ownership_codes.observed_domain is
  'Domain on which the agent found the code of a brand (06 RG51), lower case, as website_domain.';
comment on column verification.ownership_codes.observed_channel is
  'Where the code of a brand was found: dns_txt (a TXT record of the domain) or web_page.';

-- 9. verification.evidence_files: the rows, without the bucket (D82; modele §3; 04 l. 1561) ---------

create table if not exists verification.evidence_files (
  id                     uuid        not null primary key default gen_random_uuid(),
  request_id             uuid        not null,
  account_id             uuid        not null references profiles.creator_public_profiles (account_id),
  -- T9.3, T9.9: computed by the base, never a name or a path of the client
  object_key             text        not null
                                     generated always as
                                       (account_id::text || '/' || request_id::text || '/'
                                        || id::text || '.webp') stored,
  state                  verification.evidence_state not null default 'pending',
  received_bytes         integer     not null,
  byte_size              integer,
  width                  smallint,
  height                 smallint,
  checksum               bytea,
  created_at             timestamptz not null default now(),
  activated_at           timestamptz,
  retention_due_at       timestamptz not null,
  purge_requested_at     timestamptz,
  purge_attempts         smallint    not null default 0,
  last_purge_attempt_at  timestamptz,
  deleted_at             timestamptz,

  -- the evidence belongs to a request of its account
  constraint evidence_files_request_fk
    foreign key (request_id, account_id)
    references verification.verification_requests (id, account_id),
  -- D82 (1), (4): one file per request of the relay, 8 MiB at most, received and stored
  constraint evidence_files_received_bytes check (received_bytes between 1 and 8388608),
  constraint evidence_files_byte_size check (byte_size between 1 and 8388608),
  -- D82 (2): sides of WebP (16 383 at most), 4 096² pixels at most, longest side 320 px at least
  constraint evidence_files_sides
    check (width between 1 and 16383 and height between 1 and 16383
           and width::integer * height::integer <= 16777216
           and greatest(width, height) >= 320),
  -- EC-L2E-05-9: SHA-256 of the stored WebP
  constraint evidence_files_checksum check (octet_length(checksum) = 32),
  -- the stored output is described whole, or not at all
  constraint evidence_files_stored_together
    check ((byte_size is null) = (width is null) and (width is null) = (height is null)
           and (height is null) = (checksum is null)),
  -- pending: nothing stored yet; active: stored and dated
  constraint evidence_files_pending_unstored
    check (state <> 'pending' or (byte_size is null and activated_at is null)),
  constraint evidence_files_active_complete
    check (state <> 'active' or (byte_size is not null and activated_at is not null)),
  -- purging and purged carry the instant of the request; purged, and only it, its removal
  constraint evidence_files_purge_dated
    check ((state in ('purging', 'purged')) = (purge_requested_at is not null)),
  constraint evidence_files_purged
    check ((state = 'purged') = (deleted_at is not null)),
  constraint evidence_files_purge_attempts check (purge_attempts >= 0),
  constraint evidence_files_retention_after check (retention_due_at > created_at)
);

create index if not exists evidence_files_request_idx
  on verification.evidence_files (request_id);
-- the task storage_purge (0223): pending rows older than 15 minutes, purging rows
create index if not exists evidence_files_purge_idx
  on verification.evidence_files (state, created_at) where state in ('pending', 'purging');
-- RG86: the active rows reach their date of purge
create index if not exists evidence_files_retention_idx
  on verification.evidence_files (retention_due_at) where state = 'active';

comment on table verification.evidence_files is
  'One row per object of the private bucket verification-evidence (D82, EC-L2E-8), written BEFORE '
  'the object: the WebP re-encoded by apps/api, without any metadata, never the original nor its '
  'name. object_key, generated: <account_id>/<request_id>/<id>.webp (T9.3, T9.9). retention_due_at '
  'is required from the insertion (RG86, L2E-D1): no evidence without its date of purge; the object '
  'is removed at that date (decision + evidence_retention_days), at once for evidence_too_wide or a '
  'cancelled request; the row, its checksum and the findings are kept (purged). Transitions by the '
  'doors and the task of 0223. Read by the creator (metadata only, never the bytes nor the key, '
  'EC-L2E-7) and by agent and admin in aal2 (never the key: verification.read_evidence(), 0224, '
  'journalled). NEVER any right of influx_advertiser (fiche invariant 1, C(13), T9.6).';
comment on column verification.evidence_files.received_bytes is
  'Bytes received by the relay for this attempt (counted in the daily quota before any decoding).';
comment on column verification.evidence_files.byte_size is
  'Bytes of the stored WebP (the re-encoded output, never the original); NULL while pending.';
comment on column verification.evidence_files.checksum is
  'SHA-256 of the stored WebP (32 bytes): the same evidence deposited twice is recognised; kept '
  'after the purge (findings, 3 years).';
comment on column verification.evidence_files.retention_due_at is
  'Date of purge of the object, required at the insertion and recomputed at the decision '
  '(+ evidence_retention_days, D79). An active row is never removed before it.';

-- 10. verification.badges (04 l. 1586-1625, l. 6391; modele §3) -------------------------------------

create table if not exists verification.badges (
  id                                  uuid        not null primary key default gen_random_uuid(),
  account_id                          uuid        not null references identity.accounts (id),
  -- no foreign key: the badge survives the line until L2F decides it (modele -16)
  social_account_id                   uuid,
  network_code                        text        references reference.networks (code),
  request_id                          uuid        not null,
  level                               verification.badge_level not null,
  granted_by_account_id               uuid        not null references identity.accounts (id),
  granted_at                          timestamptz not null,
  evidence_source                     text        not null,
  registry_source_id                  uuid        references verification.registry_sources (id),
  observed_followers                  bigint,
  observed_posts_last_30_days         integer,
  observed_avg_comments               bigint,
  observed_engagement_bp              integer,
  observed_period_start               date,
  observed_period_end                 date,
  declared_followers_at_decision      bigint,
  declared_posts_at_decision          integer,
  declared_comments_at_decision       bigint,
  declared_engagement_bp_at_decision  integer,
  observed_handle_at_decision         text,
  observed_platform_account_ref       text,
  expires_at                          timestamptz,
  state                               verification.badge_state not null default 'active',
  revoked_at                          timestamptz,
  revocation_reason_code              text        references verification.revocation_reasons (code),
  created_at                          timestamptz not null default now(),
  updated_at                          timestamptz not null default now(),

  -- the badge comes from a request of its account and of its level
  constraint badges_request_fk
    foreign key (request_id, account_id, level)
    references verification.verification_requests (id, account_id, level),
  -- the badge is by network (04 l. 1595); a brand badge has none
  constraint badges_target
    check ((level = 'brand_verified') = (social_account_id is null)
           and (social_account_id is null) = (network_code is null)),
  -- the source of each level (modele §3)
  constraint badges_evidence_source
    check ((level = 'account_verified' and evidence_source = 'public_profile')
           or (level = 'audience_verified' and evidence_source = 'native_dashboard')
           or (level = 'brand_verified' and evidence_source = 'domain_and_registry')),
  constraint badges_registry_source
    check ((level = 'brand_verified') = (registry_source_id is not null)),
  -- RG37, RG38, 04 l. 6391 (L2E-D3): the audience badge carries its three observed figures, its
  -- period and the declared posts and comments at the decision; the other levels no figure
  constraint badges_audience_figures
    check (level <> 'audience_verified'
           or (observed_followers is not null and observed_posts_last_30_days is not null
               and observed_avg_comments is not null and observed_period_start is not null
               and observed_period_end is not null and declared_posts_at_decision is not null
               and declared_comments_at_decision is not null)),
  constraint badges_figures_audience_only
    check (level = 'audience_verified'
           or pg_catalog.num_nonnulls(observed_followers, observed_posts_last_30_days,
                                      observed_avg_comments, observed_engagement_bp,
                                      observed_period_start, observed_period_end,
                                      declared_followers_at_decision, declared_posts_at_decision,
                                      declared_comments_at_decision,
                                      declared_engagement_bp_at_decision) = 0),
  -- RG46, cas limite 2: whole numbers, zero accepted, never negative; engagement 0 to 100 %
  constraint badges_figures_positive
    check (observed_followers >= 0 and observed_posts_last_30_days >= 0
           and observed_avg_comments >= 0 and declared_followers_at_decision >= 0
           and declared_posts_at_decision >= 0 and declared_comments_at_decision >= 0),
  constraint badges_engagement_bp
    check (observed_engagement_bp between 0 and 10000
           and declared_engagement_bp_at_decision between 0 and 10000),
  constraint badges_period check (observed_period_start <= observed_period_end),
  -- R7: the handle read on line the day of the decision, for a network badge
  constraint badges_observed_handle
    check ((level = 'brand_verified') = (observed_handle_at_decision is null)),
  constraint badges_observed_handle_text
    check (char_length(observed_handle_at_decision) <= 100
           and observed_handle_at_decision ~ '[^[:space:]]'
           and observed_handle_at_decision !~ '[[:cntrl:]]'),
  constraint badges_platform_account_ref
    check (char_length(observed_platform_account_ref) <= 100
           and observed_platform_account_ref ~ '[^[:space:]]'
           and observed_platform_account_ref !~ '[[:cntrl:]]'),
  constraint badges_platform_account_ref_network
    check (observed_platform_account_ref is null or level <> 'brand_verified'),
  -- 04 l. 1613 (90 days, D34) and the brand (12 months); the account badge has none (EC-L2E-05-8)
  constraint badges_expiry
    check ((level = 'account_verified') = (expires_at is null)),
  constraint badges_expiry_after check (expires_at > granted_at),
  -- 04 l. 1615: a withdrawal is dated and reasoned, and only a withdrawal
  constraint badges_revocation
    check ((state = 'revoked') = (revocation_reason_code is not null)
           and (revocation_reason_code is null) = (revoked_at is null)),
  constraint badges_revoked_after check (revoked_at >= granted_at)
);

-- 04 l. 1618 (L2E-D4): one badge holds the place per (account, line, level); to_reconfirm included
-- (04 l. 1623), replaced and the ended states out (EC-L2E-14)
create unique index if not exists badges_holding_unique
  on verification.badges
     (account_id, coalesce(social_account_id, '00000000-0000-0000-0000-000000000000'::uuid), level)
  where state in ('active', 'to_refresh', 'to_reconfirm');
create index if not exists badges_account_idx on verification.badges (account_id);
create index if not exists badges_request_idx on verification.badges (request_id);
-- the expiry (L2F): the badges that may expire
create index if not exists badges_expiry_idx
  on verification.badges (expires_at) where state in ('active', 'to_refresh');

comment on table verification.badges is
  'What the badge asserts (04 l. 1586, 08 RG1 to RG10): a precise fact, observed on a document by a '
  'named person at a given date, by network. The audience badge carries the three figures the agent '
  'typed (never copied from the declaration, RG37), the period of the capture, and the declared '
  'figures at the decision (the gap is computed at the read, never stored nor published, RG41). '
  'At most one holding badge (active, to_refresh, to_reconfirm) per (account, line, level). '
  'Written by the decisions (0224); read by the creator (his own, without the agent, the figures, '
  'the declared values nor the handle) and by agent and admin in aal2. No right of '
  'influx_advertiser: the public bands are derived by the system (0225), the brand reads through '
  'its function.';
comment on column verification.badges.observed_engagement_bp is
  'Engagement read on the capture, in basis points (0 to 10 000); optional (RG38, EC-L2E-12): an '
  'engagement band is published only with it (RG48).';
comment on column verification.badges.observed_handle_at_decision is
  'L''identifiant @ lu en ligne le jour de la decision (R7). C''est lui que la tache quotidienne '
  'compare a l''identifiant courant (08 RG78).';
comment on column verification.badges.expires_at is
  'audience_verified: decision + audience_badge_validity_days (90, EC-L2E-1); brand_verified: '
  '+ brand_badge_validity_months (12); account_verified: none.';

drop trigger if exists badges_touch_updated_at on verification.badges;
create trigger badges_touch_updated_at
  before update on verification.badges
  for each row execute function influx.touch_updated_at();

-- 11. The codes of the register and of the queue (modele §4 "Registre", "Outbox") -------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- the member's acts and the system's (payload request_id, level; never a code, a handle, a figure)
  ('verification.requested',               'verification', 'verification_request', 'info'),
  ('verification.code_generated',          'verification', 'verification_request', 'info'),
  ('verification.submitted',               'verification', 'verification_request', 'info'),
  ('verification.cancelled',               'verification', 'verification_request', 'info'),
  ('verification.expired',                 'verification', 'verification_request', 'info'),
  ('verification.to_reexamine',            'verification', 'verification_request', 'info'),
  -- the agent's reads and decisions, nominative (payload evidence_id, level, badge_id,
  -- reason_code, late)
  ('verification.evidence_viewed',         'verification', 'verification_request', 'sensitive'),
  ('verification.granted',                 'verification', 'verification_request', 'sensitive'),
  ('verification.rejected',                'verification', 'verification_request', 'sensitive'),
  ('verification.closed',                  'verification', 'verification_request', 'sensitive'),
  ('verification.escalated',               'verification', 'verification_request', 'sensitive'),
  -- an administrator changes a registry source (payload before and after)
  ('verification.registry_source_changed', 'verification', 'registry_source',      'sensitive'),
  -- the queue only (never a register line): the transactional e-mails of 16 (EC-L2E-05-10)
  ('verification.received',                'verification', 'verification_request', 'info'),
  ('verification.decision',                'verification', 'verification_request', 'info'),
  ('verification.request_expired',         'verification', 'verification_request', 'info'),
  ('verification.code_issued',             'verification', 'verification_request', 'info')
on conflict (code) do nothing;

-- 12. Row level security and the rights of the business roles (fiche invariant 1, EC-L2E-18) -------

do $$
declare
  t text;
begin
  foreach t in array array['rejection_reasons', 'revocation_reasons', 'registry_sources',
                           'verification_requests', 'ownership_codes', 'evidence_files', 'badges']
  loop
    execute format('alter table verification.%I enable row level security', t);
    execute format('alter table verification.%I force row level security', t);
    execute format('revoke all on verification.%I from public, anon, authenticated, service_role, '
                   'influx_advertiser', t);
  end loop;
end
$$;

-- 04 §7.5, NON REVERSIBLE (03 P5, C(13), T9.6): the advertiser holds nothing on the schema, USAGE
-- included, and no future object of the schema gives him anything
revoke all on schema verification from influx_advertiser;
revoke all on all tables    in schema verification from influx_advertiser;
revoke all on all sequences in schema verification from influx_advertiser;
revoke all on all functions in schema verification from influx_advertiser;
alter default privileges in schema verification revoke all on tables    from influx_advertiser;
alter default privileges in schema verification revoke all on sequences from influx_advertiser;
alter default privileges in schema verification revoke all on functions from influx_advertiser;

grant usage on schema verification to influx_creator, influx_agent, influx_admin;

-- 12.1 The three catalogues: agent and admin, aal2 ------------------------------------------------

grant select on verification.rejection_reasons, verification.revocation_reasons,
                verification.registry_sources
   to influx_agent, influx_admin;

drop policy if exists rejection_reasons_internal_select on verification.rejection_reasons;
create policy rejection_reasons_internal_select on verification.rejection_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists revocation_reasons_internal_select on verification.revocation_reasons;
create policy revocation_reasons_internal_select on verification.revocation_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists registry_sources_internal_select on verification.registry_sources;
create policy registry_sources_internal_select on verification.registry_sources
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 12.2 The requests: the creator his own, without lock, agent, deadlines, internal comment,
-- re-examination nor escalation; agent and admin in aal2, never their own account (15 RG36) -------

grant select (id, account_id, social_account_id, network_code, level, population, status,
              created_at, submitted_at, decided_at, rejection_reason_code, member_message,
              cancelled_at, closed_at, updated_at)
   on verification.verification_requests to influx_creator;
grant select on verification.verification_requests to influx_agent, influx_admin;

drop policy if exists verification_requests_creator_select_own
  on verification.verification_requests;
create policy verification_requests_creator_select_own on verification.verification_requests
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists verification_requests_internal_select on verification.verification_requests;
create policy verification_requests_internal_select on verification.verification_requests
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 12.3 The codes: the creator his own, without the finding -------------------------------------------

grant select (id, request_id, account_id, kind, code, created_at, expires_at, revoked_at)
   on verification.ownership_codes to influx_creator;
grant select on verification.ownership_codes to influx_agent, influx_admin;

drop policy if exists ownership_codes_creator_select_own on verification.ownership_codes;
create policy ownership_codes_creator_select_own on verification.ownership_codes
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists ownership_codes_internal_select on verification.ownership_codes;
create policy ownership_codes_internal_select on verification.ownership_codes
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 12.4 The evidence: metadata only, never the key (EC-L2E-7; D82 (5): the key through
-- verification.read_evidence(), journalled) -------------------------------------------------------

grant select (id, request_id, account_id, state, byte_size, width, height, created_at,
              activated_at, retention_due_at, deleted_at)
   on verification.evidence_files to influx_creator;
grant select (id, request_id, account_id, state, received_bytes, byte_size, width, height,
              checksum, created_at, activated_at, retention_due_at, purge_requested_at,
              purge_attempts, last_purge_attempt_at, deleted_at)
   on verification.evidence_files to influx_agent, influx_admin;

drop policy if exists evidence_files_creator_select_own on verification.evidence_files;
create policy evidence_files_creator_select_own on verification.evidence_files
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists evidence_files_internal_select on verification.evidence_files;
create policy evidence_files_internal_select on verification.evidence_files
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 12.5 The badges: the creator his own, the fact, its source, its date and period, its state --------

grant select (id, account_id, social_account_id, network_code, request_id, level, granted_at,
              evidence_source, observed_period_start, observed_period_end, expires_at, state,
              revoked_at, revocation_reason_code, created_at, updated_at)
   on verification.badges to influx_creator;
grant select on verification.badges to influx_agent, influx_admin;

drop policy if exists badges_creator_select_own on verification.badges;
create policy badges_creator_select_own on verification.badges
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists badges_internal_select on verification.badges;
create policy badges_internal_select on verification.badges
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 13. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- RLS enabled and forced on the seven tables of the schema, each with a policy
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.relnamespace = 'verification'::regnamespace and c.relkind in ('r', 'p')
     and not (c.relrowsecurity and c.relforcerowsecurity
              and exists (select 1 from pg_catalog.pg_policies p
                           where p.schemaname = 'verification' and p.tablename = c.relname));
  if v_bad is not null then
    raise exception 'row level security not enabled, forced and policed on: %', v_bad;
  end if;

  -- NON REVERSIBLE (fiche invariant 1, EC-L2E-18, 04 §7.5): influx_advertiser holds no right on the
  -- schema verification, USAGE included, on none of its objects, through no policy and no default
  -- privilege
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.relnamespace = 'verification'::regnamespace
     and ((c.relkind in ('r', 'p', 'v', 'm')
           and (pg_catalog.has_table_privilege('influx_advertiser', c.oid,
                                               'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                or pg_catalog.has_any_column_privilege('influx_advertiser', c.oid,
                                                       'SELECT, INSERT, UPDATE, REFERENCES')))
          or (c.relkind = 'S'
              and pg_catalog.has_sequence_privilege('influx_advertiser', c.oid, 'USAGE, SELECT, UPDATE')));
  if v_bad is not null then
    raise exception 'influx_advertiser holds a right on: %', v_bad;
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'verification'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'influx_advertiser may execute: %', v_bad;
  end if;
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
    from pg_catalog.pg_policies
   where schemaname = 'verification'
     and (roles && array['influx_advertiser', 'public']::name[]);
  if v_bad is not null then
    raise exception 'a policy of the schema verification names influx_advertiser or public: %', v_bad;
  end if;
  select string_agg(d.defaclobjtype::text, ', ') into v_bad
    from pg_catalog.pg_default_acl d, pg_catalog.aclexplode(d.defaclacl) a
   where (d.defaclnamespace = 'verification'::regnamespace or d.defaclnamespace = 0)
     and a.grantee = 'influx_advertiser'::regrole::oid;
  if v_bad is not null then
    raise exception 'a default privilege gives influx_advertiser something: %', v_bad;
  end if;

  -- nobody writes the schema directly at 0221: the doors (0222), the task (0223) and the decisions
  -- (0224) bring their owners and their policies
  select string_agg(r.rolname || ' ' || c.relname, ', ') into v_bad
    from pg_catalog.pg_roles r, pg_catalog.pg_class c
   where r.rolname like 'influx\_%'
     and c.relnamespace = 'verification'::regnamespace and c.relkind in ('r', 'p')
     and (pg_catalog.has_any_column_privilege(r.oid, c.oid, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'unexpected write right(s): %', v_bad;
  end if;

  -- the creator never reads the lock, an agent, the internal comment, the finding, the key nor
  -- the checksum
  select string_agg(t.tab || '.' || t.col, ', ') into v_bad
    from (values ('verification_requests', 'claimed_by_account_id'),
                 ('verification_requests', 'decided_by_account_id'),
                 ('verification_requests', 'forced_release_by_account_id'),
                 ('verification_requests', 'internal_comment'),
                 ('verification_requests', 'reexamine_reason_code'),
                 ('verification_requests', 'escalated_at'),
                 ('ownership_codes', 'observed_by_account_id'),
                 ('ownership_codes', 'observed_handle'),
                 ('evidence_files', 'object_key'),
                 ('evidence_files', 'checksum'),
                 ('badges', 'granted_by_account_id'),
                 ('badges', 'observed_followers'),
                 ('badges', 'declared_followers_at_decision'),
                 ('badges', 'observed_handle_at_decision')) as t (tab, col)
   where pg_catalog.has_column_privilege('influx_creator', 'verification.' || t.tab, t.col, 'SELECT');
  if v_bad is not null then
    raise exception 'influx_creator reads: %', v_bad;
  end if;
  -- the key of an evidence is read through its journalled function only (D82 (5))
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and pg_catalog.has_column_privilege(r.oid, 'verification.evidence_files', 'object_key', 'SELECT');
  if v_bad is not null then
    raise exception 'the object key is readable by: %', v_bad;
  end if;

  -- the catalogues and the queue
  if (select count(*) from verification.rejection_reasons where population = 'creator') <> 16
     or (select count(*) from verification.rejection_reasons where population = 'brand') <> 6 then
    raise exception 'the refusal reasons are not the 16 of 08 RG57 and the 6 of EC-L2E-11';
  end if;
  if (select count(*) from verification.revocation_reasons) <> 5 then
    raise exception 'the revocation reasons are not the five of 08 RG73';
  end if;
  if (select count(*) from verification.registry_sources where source_type = 'e_justice' and is_active) <> 30
     or (select count(*) from verification.registry_sources where source_type = 'gleif' and is_active) <> 1
     or (select count(*) from verification.registry_sources where source_type = 'national' and is_active) <> 2
     or (select count(*) from verification.registry_sources where source_type = 'national' and not is_active) <> 8 then
    raise exception 'the registry sources are not those of l2e/registres.md';
  end if;
  if not exists (select 1 from backoffice.queues
                  where code = 'verification' and label_key = 'queue.verification'
                    and handled_by_roles = '{agent,admin}'::identity.account_role[]
                    and not allows_bulk_action and has_lock and is_active)
     or not exists (select 1 from backoffice.sla_policies
                     where queue_code = 'verification' and target_claim_minutes = 240
                       and target_decision_minutes = 480 and escalate_after_minutes = 960
                       and business_hours is not null and not is_provisional and is_active) then
    raise exception 'queue verification or its delay is not as 15 RG29 says';
  end if;
  if (select count(*) from backoffice.operational_settings) <> 16 then
    raise exception 'backoffice.operational_settings does not hold its sixteen keys';
  end if;
end
$$;
