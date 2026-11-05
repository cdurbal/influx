-- =============================================================================
-- 0216_profiles_creator_public
-- -----------------------------------------------------------------------------
-- Lot 2 / L2D, commit 03 (jalons/l2d/03.md; l2d/modele.md §0216, which prevails for every name;
-- fiche invariants 1 to 3, 7, 8). The PUBLIC layer (A) of the creator profile (07 RG16): the
-- storefront row, its five list tables and its two opaque identifiers. Nothing identifying here:
-- every column is a band, a code, a date, a boolean or a moderated text (04 §5.2 review rule).
--
-- 1. profiles.creator_profile_status: draft, pending_review, published, rejected, suspended
--    (EC-02-1: its own enumeration, not a rename of advertiser_profile_status).
-- 2. profiles.creator_public_profiles: one row per creator account (foreign key to the account
--    only, modele.md point 6: kept, invisible, when an admin turns the creator into an advertiser).
--    Its derived columns (main audience, gender band) and the date of availability are written
--    by 0218; the publication rules (minimums, required fields) belong to L2G.
-- 3. Five list tables, one row per choice, each code a foreign key to its reference list, the cap
--    held by `slot` in the primary key as in 0202: secondary topics (3), publication languages
--    (5, EC-02-4), editorial tones (2), formats (the format carries its network,
--    reference.formats.network_code; UGC without one: EC-L2D-2 corrected), usage rights
--    (included or optional, `none` refused).
-- 4. profiles.new_creator_alias() (RG23, I-2, TM12.6): six signs out of 28 (2 to 9, consonants but
--    Y: no vowel, so neither a word nor a gender mark), about 2^28.8 values. Drawn from the bytes of
--    uuid_send(gen_random_uuid()) but bytes 6 and 8 (version and variant), a byte >= 252 rejected
--    (252 = 9 x 28: no bias). It takes NO input: nothing of the account, the pseudonym nor a rank.
--    public_ref: gen_random_uuid(), distinct from account_id, never written by anyone.
-- 5. Row level security and rights (modele.md « Droits »): the creator reads his own row and
--    writes its ten entered columns, reads, adds and removes his own list rows; agent and admin read
--    everything in aal2; influx_advertiser holds NOTHING on any creator object (EC-L2D-1, P5: the
--    storefront is read at Lot 3, with the guards of C(10)); nothing to public, anon,
--    authenticated, service_role. influx_identity_definer inserts the row of a creator account at
--    sign-up (account, alias, country of residence copied from the account), status draft only.
-- 6. identity.provision_account() recreated from its last version (0109 §5), the same signature:
--    a creator sign-up also inserts the storefront row, draft, with a fresh alias (a collision
--    draws again, five draws at most, then 23505). Owner, rights and assertions as in 0109.
-- 7. Reprise: one row for each existing creator account whose status is not `deleted`.
--
-- Not here: the identifying objects (0217), the derivations, the confirmation and the guard of
-- the date of availability (0218), the export and the erasure (0219), any route or screen.
--
-- EC-L2D-03 (micro-gaps, the safest choice):
--   EC-L2D-03-1  the index of 04 §12 on creator_public_networks (account_id) comes with its table
--                (0218, modele.md); only the partial index of the storefront is created here.
--   EC-L2D-03-2  free texts as in 0202 (EC-L2B-05-3): one visible character at least; headline
--                without any control character, bio with line feeds only.
--   EC-L2D-03-3  the creator may write availability_band from now on; its date is set by the
--                guard of 0218 (no route writes either before 08).
--   EC-L2D-03-4  an account given the creator role by identity.grant_role() (0130) gets no row, as
--                an advertiser given his role there gets no profile: the API of 08 answers an
--                absent row as an empty draft it cannot write; the role change of 0134 goes the
--                other way only (creator to advertiser).
--   EC-L2D-03-5  the reprise draws aliases one account at a time (five draws each): a single
--                INSERT ... SELECT would fail the whole migration on the first collision.
--   EC-L2D-03-6  in identity.provision_account(), a taken alias is the violation of
--                creator_public_profiles_alias_unique, caught and drawn again (modele.md says ON
--                CONFLICT (alias) DO NOTHING, which would need SELECT on the alias for
--                influx_identity_definer: one right less, the same five draws).
--
-- ROLLBACK (before any creator has entered anything): recreate identity.provision_account() as in
-- 0109 §5 and §6 (grants, owner, assertions included); drop function profiles.new_creator_alias();
-- drop table profiles.creator_usage_rights, profiles.creator_formats, profiles.creator_tones,
-- profiles.creator_publication_languages, profiles.creator_topics, profiles.creator_public_profiles;
-- drop type profiles.creator_profile_status; revoke usage on schema profiles from influx_creator.
-- =============================================================================

-- 1. The status of a creator profile (EC-02-1) -------------------------------------------------------

do $$
begin
  create type profiles.creator_profile_status as enum
    ('draft', 'pending_review', 'published', 'rejected', 'suspended');
exception when duplicate_object then null;
end
$$;

comment on type profiles.creator_profile_status is
  'Life cycle of a creator profile (04 §5.2): draft, pending_review, published, rejected, suspended. '
  'Its own enumeration (EC-02-1), the same values as the brand profile; draft only at L2D, the '
  'submission and the decisions arrive at L2G.';

-- 2. profiles.creator_public_profiles: the storefront (layer A) --------------------------------------

create table if not exists profiles.creator_public_profiles (
  account_id                     uuid        not null primary key references identity.accounts (id),
  public_ref                     uuid        not null default gen_random_uuid(),
  alias                          text        not null,
  status                         profiles.creator_profile_status not null default 'draft',
  is_searchable                  boolean     not null default true,
  published_at                   timestamptz,
  headline                       text,
  bio                            text,
  primary_topic_code             text        references reference.topics (code),
  residence_country_code         char(2)     not null references reference.countries (code),
  residence_region_code          text,
  travel_scope                   text,
  collaboration_experience_band  text,
  main_audience_country          char(2)     references reference.countries (code),
  main_audience_share_band       text,
  audience_gender_band           text        references reference.audience_genders (code),
  delivery_lead_band             text,
  max_exclusivity_band           text,
  accepts_non_monetary           boolean     not null default false,
  availability_band              text,
  availability_declared_at       timestamptz,
  created_at                     timestamptz not null default now(),
  updated_at                     timestamptz not null default now(),

  constraint creator_public_profiles_public_ref_unique unique (public_ref),
  constraint creator_public_profiles_alias_unique unique (alias),
  -- RG23, modele.md: six signs of the alphabet of profiles.new_creator_alias()
  constraint creator_public_profiles_alias_shape
    check (alias ~ '^[2-9BCDFGHJKLMNPQRSTVWXZ]{6}$'),
  constraint creator_public_profiles_public_ref_not_account
    check (public_ref <> account_id),
  -- RG25: one line of 120 characters at most, no control character (EC-L2D-03-2)
  constraint creator_public_profiles_headline_length check (char_length(headline) <= 120),
  constraint creator_public_profiles_headline_not_blank check (headline ~ '[^[:space:]]'),
  constraint creator_public_profiles_headline_printable check (headline !~ '[[:cntrl:]]'),
  -- 800 characters at most, line feeds only (EC-L2D-03-2)
  constraint creator_public_profiles_bio_length check (char_length(bio) <= 800),
  constraint creator_public_profiles_bio_not_blank check (bio ~ '[^[:space:]]'),
  constraint creator_public_profiles_bio_printable
    check (bio !~ '[\x01-\x09\x0B-\x1F\x7F\u0080-\u009F]'),
  -- RG37: a first-level subdivision of the country of residence
  constraint creator_public_profiles_region_fk
    foreign key (residence_country_code, residence_region_code)
    references reference.regions (country_code, code),
  -- RG39
  constraint creator_public_profiles_travel_scope
    check (travel_scope in ('none', 'domestic', 'international')),
  -- RG32: a declarative band, never a list of brands
  constraint creator_public_profiles_collaboration_experience_band
    check (collaboration_experience_band in ('none', '1_5', '6_20', 'gt_20')),
  constraint creator_public_profiles_main_audience_share_band
    check (main_audience_share_band in ('ge_80', '50_80', 'lt_50')),
  constraint creator_public_profiles_delivery_lead_band
    check (delivery_lead_band in ('lt_7d', '7_14d', '15_30d', 'gt_30d')),
  -- the bands of brands and campaigns (09 RG42, 0202)
  constraint creator_public_profiles_max_exclusivity_band
    check (max_exclusivity_band in ('none', 'le_1m', 'le_3m', 'negotiable')),
  constraint creator_public_profiles_availability_band
    check (availability_band in ('lt_2w', 'lt_1m', 'full'))
);

comment on table profiles.creator_public_profiles is
  'Storefront of a creator (04 §5.2, 07 RG16 layer A): bands, codes, dates, booleans and moderated '
  'texts ONLY, never an exact figure nor an identifying field (those live in creator_identities and '
  'creator_social_accounts, 0217). No right of influx_advertiser at Lot 2 (EC-L2D-1, P5). One row per '
  'creator account, created at sign-up (identity.provision_account) or by the reprise of 0216.';
comment on column profiles.creator_public_profiles.account_id is
  'The account [K]: never served outside the own reads of the creator and the internal ones.';
comment on column profiles.creator_public_profiles.public_ref is
  'Opaque reference of the storefront (I-2): random, distinct from account_id, written by nobody.';
comment on column profiles.creator_public_profiles.alias is
  'Public alias (07 RG23): profiles.new_creator_alias(), stable for life, global, derived from '
  'nothing, chosen and changed by nobody.';
comment on column profiles.creator_public_profiles.status is
  'Life cycle (EC-02-1). No member writes it; draft for the whole of L2D (fiche invariant 7).';
comment on column profiles.creator_public_profiles.residence_country_code is
  'Country of residence copied from the account (07 RG36), kept equal by 0218.';
comment on column profiles.creator_public_profiles.main_audience_country is
  'Main audience country, derived from the primary network line by 0218 (EC-L2D-9).';
comment on column profiles.creator_public_profiles.main_audience_share_band is
  'Band of the share of the main audience country (ge_80, 50_80, lt_50), derived by 0218.';
comment on column profiles.creator_public_profiles.audience_gender_band is
  'Gender band of the AUDIENCE (07 RG61), derived by 0218; never an attribute of the creator.';
comment on column profiles.creator_public_profiles.availability_declared_at is
  'Date of the declared availability, set by the guard of 0218, never entered.';

drop trigger if exists creator_public_profiles_touch_updated_at on profiles.creator_public_profiles;
create trigger creator_public_profiles_touch_updated_at
  before update on profiles.creator_public_profiles
  for each row execute function influx.touch_updated_at();

-- 04 §12: every search starts with this filter; the partial index mostly counts (k-anonymity)
create index if not exists creator_public_profiles_searchable
  on profiles.creator_public_profiles (status, is_searchable)
  where status = 'published' and is_searchable;

-- 3. The list tables (07 RG26, RG33, RG34, RG64, RG73) ------------------------------------------------

create table if not exists profiles.creator_topics (
  account_id  uuid        not null references profiles.creator_public_profiles (account_id),
  slot        smallint    not null,
  topic_code  text        not null references reference.topics (code),
  created_at  timestamptz not null default now(),
  primary key (account_id, slot),
  constraint creator_topics_once unique (account_id, topic_code),
  -- three secondary topics at most; the main one is primary_topic_code of the storefront
  constraint creator_topics_slot check (slot between 1 and 3)
);

create table if not exists profiles.creator_publication_languages (
  account_id     uuid        not null references profiles.creator_public_profiles (account_id),
  slot           smallint    not null,
  language_code  char(2)     not null references reference.languages (code),
  created_at     timestamptz not null default now(),
  primary key (account_id, slot),
  constraint creator_publication_languages_once unique (account_id, language_code),
  -- EC-02-4: five at most, the base caps (rare languages identify)
  constraint creator_publication_languages_slot check (slot between 1 and 5)
);

create table if not exists profiles.creator_tones (
  account_id  uuid        not null references profiles.creator_public_profiles (account_id),
  slot        smallint    not null,
  tone_code   text        not null references reference.editorial_tones (code),
  created_at  timestamptz not null default now(),
  primary key (account_id, slot),
  constraint creator_tones_once unique (account_id, tone_code),
  -- RG34: two at most
  constraint creator_tones_slot check (slot between 1 and 2)
);

create table if not exists profiles.creator_formats (
  account_id   uuid        not null references profiles.creator_public_profiles (account_id),
  format_code  text        not null references reference.formats (code),
  created_at   timestamptz not null default now(),
  primary key (account_id, format_code)
);

create table if not exists profiles.creator_usage_rights (
  account_id        uuid        not null references profiles.creator_public_profiles (account_id),
  usage_right_code  text        not null references reference.usage_rights (code),
  inclusion         text        not null,
  created_at        timestamptz not null default now(),
  -- RG73: the key forbids a right both included and optional
  primary key (account_id, usage_right_code),
  constraint creator_usage_rights_inclusion check (inclusion in ('included', 'optional')),
  -- referentiels.md, amendment 4: `none` is no right, no row says it
  constraint creator_usage_rights_not_none check (usage_right_code <> 'none')
);

comment on table profiles.creator_topics is
  'Secondary topics of a creator (07 RG26): three at most (slot 1 to 3), each once; the main topic is '
  'primary_topic_code of the storefront (a duplicate is removed by the API). Layer A.';
comment on table profiles.creator_publication_languages is
  'Publication languages of a creator (07 RG33): five at most (slot 1 to 5, EC-02-4). Layer A.';
comment on table profiles.creator_tones is
  'Editorial tones of a creator (07 RG34): two at most (slot 1 or 2). Layer A.';
comment on table profiles.creator_formats is
  'Formats a creator offers (07 RG64, EC-L2D-2 corrected): the format carries its network '
  '(reference.formats.network_code), UGC without one. No price, ever (D78). Layer A.';
comment on table profiles.creator_usage_rights is
  'Usage rights a creator includes or offers as an option (07 RG73); `none` refused. Layer A.';

-- 4. profiles.new_creator_alias() (RG23, I-2, TM12.6) -----------------------------------------------

create or replace function profiles.new_creator_alias()
returns text
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  c_alphabet  constant text := '23456789BCDFGHJKLMNPQRSTVWXZ';
  v_alias     text := '';
  v_bytes     bytea;
  v_byte      integer;
begin
  while pg_catalog.char_length(v_alias) < 6 loop
    v_bytes := pg_catalog.uuid_send(pg_catalog.gen_random_uuid());
    for i in 0 .. 15 loop
      -- bytes 6 and 8 carry the version and the variant of the UUID: not random
      continue when i = 6 or i = 8;
      v_byte := pg_catalog.get_byte(v_bytes, i);
      -- 252 = 9 x 28: rejecting the last four values keeps every sign equally likely
      continue when v_byte >= 252;
      v_alias := v_alias || pg_catalog.substr(c_alphabet, v_byte % 28 + 1, 1);
      exit when pg_catalog.char_length(v_alias) = 6;
    end loop;
  end loop;
  return v_alias;
end
$$;

comment on function profiles.new_creator_alias() is
  '07 RG23, I-2, TM12.6: a fresh alias of six signs out of 28 (2-9 and the consonants but Y), drawn '
  'from gen_random_uuid() bytes (version and variant bytes left out, bytes >= 252 rejected). Takes '
  'no input: derived from nothing. Uniqueness is the caller''s (on conflict, draw again). SECURITY '
  'INVOKER, empty search_path; EXECUTE for influx_identity_definer only.';

revoke all on function profiles.new_creator_alias() from public, anon, authenticated, service_role;
grant execute on function profiles.new_creator_alias() to influx_identity_definer;

-- 5. Row level security and the rights of the business roles ----------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'creator_public_profiles', 'creator_topics', 'creator_publication_languages', 'creator_tones',
    'creator_formats', 'creator_usage_rights']
  loop
    execute format('alter table profiles.%I enable row level security', t);
    execute format('alter table profiles.%I force row level security', t);
    execute format('revoke all on profiles.%I from public, anon, authenticated, service_role', t);
  end loop;
end
$$;

grant usage on schema profiles to influx_creator;

-- 5.1 The storefront: the creator reads his row and writes its ten entered columns, never status,
-- alias, public_ref, published_at, is_searchable, the country nor a derived band ------------------

grant select on profiles.creator_public_profiles to influx_creator, influx_agent, influx_admin;
grant update (headline, bio, primary_topic_code, residence_region_code, travel_scope,
              collaboration_experience_band, delivery_lead_band, max_exclusivity_band,
              accepts_non_monetary, availability_band)
   on profiles.creator_public_profiles to influx_creator;

drop policy if exists creator_public_profiles_member_select_own on profiles.creator_public_profiles;
create policy creator_public_profiles_member_select_own on profiles.creator_public_profiles
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists creator_public_profiles_member_update_own on profiles.creator_public_profiles;
create policy creator_public_profiles_member_update_own on profiles.creator_public_profiles
  for update to influx_creator
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()));

drop policy if exists creator_public_profiles_internal_select on profiles.creator_public_profiles;
create policy creator_public_profiles_internal_select on profiles.creator_public_profiles
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 5.2 The lists: the creator reads, adds and removes his own rows (a list is replaced, never
-- updated); agent and admin read them in aal2 ------------------------------------------------------

do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('creator_topics',                 'slot, topic_code'),
      ('creator_publication_languages',  'slot, language_code'),
      ('creator_tones',                  'slot, tone_code'),
      ('creator_formats',                'format_code'),
      ('creator_usage_rights',           'usage_right_code, inclusion')
    ) as v (name, columns)
  loop
    execute format('grant select, delete on profiles.%I to influx_creator', l.name);
    execute format('grant insert (account_id, %s) on profiles.%I to influx_creator',
                   l.columns, l.name);
    execute format('grant select on profiles.%I to influx_agent, influx_admin', l.name);

    execute format('drop policy if exists %I on profiles.%I', l.name || '_member_select_own', l.name);
    execute format('create policy %I on profiles.%I for select to influx_creator '
                   'using (account_id = (select influx.current_account_id()))',
                   l.name || '_member_select_own', l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_member_insert_own', l.name);
    execute format('create policy %I on profiles.%I for insert to influx_creator '
                   'with check (account_id = (select influx.current_account_id()))',
                   l.name || '_member_insert_own', l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_member_delete_own', l.name);
    execute format('create policy %I on profiles.%I for delete to influx_creator '
                   'using (account_id = (select influx.current_account_id()))',
                   l.name || '_member_delete_own', l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_internal_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_agent, influx_admin '
                   'using ((select influx.has_aal2()))',
                   l.name || '_internal_select', l.name);
  end loop;
end
$$;

-- 5.3 influx_identity_definer: the row of a creator account at sign-up, draft, its country --------

grant insert (account_id, alias, residence_country_code)
   on profiles.creator_public_profiles to influx_identity_definer;

drop policy if exists creator_public_profiles_identity_definer_insert on profiles.creator_public_profiles;
create policy creator_public_profiles_identity_definer_insert on profiles.creator_public_profiles
  for insert to influx_identity_definer
  with check (
    status = 'draft'
    and exists (select 1 from identity.account_roles r
                 where r.account_id = creator_public_profiles.account_id and r.role = 'creator')
    and exists (select 1 from identity.accounts a
                 where a.id = creator_public_profiles.account_id
                   and a.country_code = creator_public_profiles.residence_country_code));

-- 6. identity.provision_account(), recreated: a creator gets his storefront ---------------------------
-- Identical to 0109 §5 but for the storefront row of a creator. Dropped by the migration role as
-- owner of the schema identity, recreated, handed back to influx_identity_definer below with its
-- rights of 0106 §3, 0109, which this migration keeps.

drop function if exists identity.provision_account(uuid, text, identity.account_role, text, text,
    identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text,
    text, identity.heard_from);

create function identity.provision_account(
  p_auth_user_id         uuid,
  p_email                text,
  p_role                 identity.account_role,
  p_country_code         text,
  p_preferred_language   text,
  p_declared_status      identity.declared_status,
  p_adult_attested       boolean,
  p_legal_name           text,
  p_terms_version_id     uuid,
  p_marketing_consent    boolean,
  p_consent_wording_key  text,
  p_consent_wording      text,
  p_display_locale       text,
  p_utm_source           text default null,
  p_utm_medium           text default null,
  p_utm_campaign         text default null,
  p_referrer_domain      text default null,
  p_heard_from           identity.heard_from default null
)
returns table (provisioned_account_id uuid, outcome text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account   uuid;
  v_status    identity.declared_status;
  v_terms     record;
  v_required  boolean;
  v_evidence  jsonb;
  v_event     uuid := pg_catalog.gen_random_uuid();
  v_subject     text;
  v_written     integer := 0;
  v_constraint  text;
begin
  -- EC-30: a member role only. No internal account is ever created by a sign-up.
  if p_role is null or p_role not in ('advertiser', 'creator') then
    raise exception 'role not allowed at sign-up' using errcode = 'insufficient_privilege';
  end if;
  if p_auth_user_id is null then
    raise exception 'the authentication user is required' using errcode = 'invalid_parameter_value';
  end if;

  -- RG110: a second submission (double click, second tab, back button) has no effect.
  select a.id into v_account from identity.accounts a where a.auth_user_id = p_auth_user_id;
  if found then
    return query select v_account, 'existing'::text;
    return;
  end if;

  -- RG8: a blocked country creates nothing; apps/api answers neutrally and journals it.
  if exists (select 1 from leads.sync_settings s
              where s.key = 'signup_blocked_countries' and s.value ? p_country_code) then
    return query select null::uuid, 'country_blocked'::text;
    return;
  end if;

  -- Role-specific rules (05 RG11, RG17 to RG22).
  if p_role = 'advertiser' then
    if p_declared_status is not null and p_declared_status <> 'business' then
      raise exception 'an advertiser account is business by construction (RG22)'
        using errcode = 'invalid_parameter_value';
    end if;
    v_status := 'business';
    if p_legal_name is null or pg_catalog.char_length(pg_catalog.btrim(p_legal_name)) < 2 then
      raise exception 'the company name is required' using errcode = 'invalid_parameter_value';
    end if;
    if p_adult_attested is true then
      raise exception 'no adult attestation is collected for an advertiser'
        using errcode = 'invalid_parameter_value';
    end if;
  else
    if p_declared_status is null then
      raise exception 'the declared status is required (RG18)' using errcode = 'invalid_parameter_value';
    end if;
    v_status := p_declared_status;
    if p_adult_attested is not true then
      raise exception 'the adult attestation is required (D15, RG19)' using errcode = 'invalid_parameter_value';
    end if;
    if p_legal_name is not null then
      raise exception 'no company name for a creator' using errcode = 'invalid_parameter_value';
    end if;
  end if;

  -- D63 (RG124): the consent is required to create an account, unless the setting says
  -- otherwise (the way back without redeployment). Missing setting = required.
  select coalesce((select (s.value #>> '{}')::boolean from leads.sync_settings s
                    where s.key = 'signup_consent_required'), true)
    into v_required;
  if p_marketing_consent is null or (v_required and not p_marketing_consent) then
    raise exception 'the marketing consent is required at sign-up (D63)'
      using errcode = 'invalid_parameter_value';
  end if;
  -- RG32: the exact wording presented, its key and the language of the page.
  if p_consent_wording_key is null
     or p_consent_wording_key !~ '^[a-z][a-zA-Z0-9_]*(\.[a-z][a-zA-Z0-9_]*)+$'
     or pg_catalog.length(p_consent_wording_key) > 120
     or p_consent_wording is null
     or pg_catalog.length(p_consent_wording) not between 1 and 1500
     or p_consent_wording ~ '[[:cntrl:]]'
     or p_display_locale is null or p_display_locale !~ '^[a-z]{2}$' then
    raise exception 'the consent wording, its key and the page language are required'
      using errcode = 'invalid_parameter_value';
  end if;

  -- RG25, RG29: the terms of service IN FORCE, with its text (0109: a version without text
  -- is never shown, so it cannot be accepted); the acceptance records the language of
  -- the version actually shown (its own locale), never the wished one.
  select v.id, v.locale
    into v_terms
    from identity.terms_versions v
   where v.id = p_terms_version_id
     and v.document_kind = 'terms_of_service'
     and v.effective_to is null
     and v.effective_from <= pg_catalog.now()
     and v.content is not null;  -- 0109: only a version whose text is stored can be accepted
  if not found then
    raise exception 'unknown terms version, or not in force' using errcode = 'foreign_key_violation';
  end if;

  -- The account. A concurrent first submission makes this one a no-op (RG110).
  insert into identity.accounts
    (auth_user_id, email, email_verified_at, country_code, preferred_language, declared_status,
     is_adult_attested, adult_attested_at, signup_utm_source, signup_utm_medium,
     signup_utm_campaign, signup_referrer_domain, signup_heard_from)
  values
    (p_auth_user_id, pg_catalog.lower(pg_catalog.btrim(p_email)), pg_catalog.now(),
     p_country_code, p_preferred_language, v_status,
     p_role = 'creator', case when p_role = 'creator' then pg_catalog.now() end,
     p_utm_source, p_utm_medium, p_utm_campaign, p_referrer_domain, p_heard_from)
  on conflict (auth_user_id) do nothing
  returning id into v_account;
  if v_account is null then
    select a.id into v_account from identity.accounts a where a.auth_user_id = p_auth_user_id;
    return query select v_account, 'existing'::text;
    return;
  end if;

  -- D41: exactly one role; granted_by NULL = self sign-up.
  insert into identity.account_roles (account_id, role) values (v_account, p_role);

  if p_role = 'advertiser' then
    insert into profiles.advertiser_profiles (account_id, legal_name) values (v_account, p_legal_name);
  else
    -- 0216 (L2D, RG23): the storefront, draft, with a fresh alias; a taken alias draws again
    -- (EC-L2D-03-6: the violation of the alias key is caught, ON CONFLICT would need SELECT)
    for v_try in 1 .. 5 loop
      begin
        insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
        values (v_account, profiles.new_creator_alias(), p_country_code);
        v_written := 1;
      exception when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint is distinct from 'creator_public_profiles_alias_unique' then
          raise;
        end if;
      end;
      exit when v_written = 1;
    end loop;
    if v_written <> 1 then
      raise exception 'no free creator alias after five draws' using errcode = 'unique_violation';
    end if;
  end if;

  -- RG24: the hash and the instant are copied / forced by identity.prepare_terms_acceptance().
  insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
  values (v_account, v_terms.id, 'acceptance', 'signup', v_terms.locale);

  -- RG33: one checkbox, two events (one per purpose), same instant, same proof.
  v_evidence := pg_catalog.jsonb_build_object(
    'form', 'signup_' || p_role::text,
    'wording_key', p_consent_wording_key,
    'wording', p_consent_wording,
    'locale', p_display_locale);
  insert into identity.consent_events (account_id, purpose, granted, source, evidence)
  select v_account, p.purpose, p_marketing_consent, 'signup_form', v_evidence
    from (values ('marketing_email'::identity.consent_purpose),
                 ('commercial_prospection'::identity.consent_purpose)) p (purpose);

  -- EC-10: lead.created alone, three lines. Contact keys include the event id (RG76); the
  -- welcome e-mail, unique by nature, is keyed on the account only (once, replay included).
  v_subject := 'account:' || v_account::text;
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values
    (v_event, 'lead.created', 'brevo_contact', v_subject, 100,
     pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_account),
     'lead.created:' || v_event::text),
    (v_event, 'lead.created', 'apollo_contact', v_subject, 100,
     pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_account),
     'lead.created:' || v_event::text),
    (v_event, 'lead.created', 'brevo_transactional', v_subject, 100,
     pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_account,
                                   'email_code', 'account.welcome_' || p_role::text),
     'account.welcome:' || v_account::text);

  return query select v_account, 'created'::text;
end
$$;

comment on function identity.provision_account(uuid, text, identity.account_role, text, text,
    identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text,
    text, identity.heard_from) is
  'Creation of a member account at sign-up (EC-30, 03 C(1), 05 RG5, RG7): account, single role, '
  'advertiser profile or creator storefront (draft, fresh alias, 0216), acceptance of the terms in '
  'force (with its text, 0109), two consent events, three lead.created queue lines, all or nothing. '
  'advertiser or creator only (42501 otherwise); business imposed for an advertiser (RG22); creator: '
  'declared status and adult attestation required (RG18, RG19, RG20); consent required unless '
  'signup_consent_required is false (D63). Returns (account id, outcome): created; existing when an '
  'account already holds this auth_user_id (RG110, nothing written); country_blocked with no id '
  '(RG8, nothing written). SECURITY DEFINER owned by influx_identity_definer, empty search_path; '
  'EXECUTE for influx_auth ONLY.';

revoke all on function identity.provision_account(uuid, text, identity.account_role, text, text,
    identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text,
    text, identity.heard_from) from public;
grant execute on function identity.provision_account(uuid, text, identity.account_role, text, text,
    identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text,
    text, identity.heard_from) to influx_auth;

-- Hand the function to influx_identity_definer (03 P7 rule 5, window of 0004 §9)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.provision_account(uuid, text, identity.account_role, text, text,
    identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text,
    text, identity.heard_from) owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 7. Reprise: the existing creator accounts, deleted ones aside (EC-L2D-03-5) ------------------------
-- <reprise> (replayed as is by db-tests/profiles-creator-public.test.ts, L2D-D2)
do $$
declare
  v_account  record;
  v_written  bigint;
begin
  for v_account in
    select a.id, a.country_code
      from identity.accounts a
      join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
     where a.status <> 'deleted'
       and not exists (select 1 from profiles.creator_public_profiles p where p.account_id = a.id)
     order by a.id
  loop
    v_written := 0;
    for v_try in 1 .. 5 loop
      insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
      values (v_account.id, profiles.new_creator_alias(), v_account.country_code)
      on conflict do nothing;
      get diagnostics v_written = row_count;
      exit when v_written = 1;
    end loop;
    if v_written <> 1 then
      raise exception 'no free creator alias after five draws for an existing creator account'
        using errcode = 'unique_violation';
    end if;
  end loop;
end
$$;
-- </reprise>

-- 8. End-state assertions ----------------------------------------------------------------------------

do $$
declare
  c_pa  constant regprocedure := 'identity.provision_account(uuid, text, identity.account_role, text, '
    'text, identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text, '
    'text, identity.heard_from)'::regprocedure;
  c_al  constant regprocedure := 'profiles.new_creator_alias()'::regprocedure;
  v_bad text;
begin
  -- identity.provision_account(), as 0109 left it
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid = c_pa)
       <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_pa)
     or (select proconfig from pg_catalog.pg_proc where oid = c_pa) is distinct from array['search_path=""'] then
    raise exception 'identity.provision_account() must be SECURITY DEFINER, owned by '
                    'influx_identity_definer, empty search_path';
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_pa
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_auth');
  if v_bad is not null then
    raise exception 'identity.provision_account() executable by: %', v_bad;
  end if;
  -- influx_auth writes none of the tables the function writes (03 P7, E-2)
  select string_agg(t, ', ') into v_bad
    from unnest(array['identity.accounts', 'identity.account_roles', 'identity.terms_acceptances',
                      'identity.consent_events', 'leads.outbox_events',
                      'profiles.advertiser_profiles', 'profiles.creator_public_profiles']) t
   where pg_catalog.has_any_column_privilege('influx_auth', t, 'INSERT')
      or pg_catalog.has_any_column_privilege('influx_auth', t, 'UPDATE');
  if v_bad is not null then
    raise exception 'influx_auth may write directly: %', v_bad;
  end if;

  -- the alias generator: invoker, empty search_path, executed by influx_identity_definer only
  if (select prosecdef from pg_catalog.pg_proc where oid = c_al)
     or (select proconfig from pg_catalog.pg_proc where oid = c_al) is distinct from array['search_path=""'] then
    raise exception 'profiles.new_creator_alias() must be SECURITY INVOKER, empty search_path';
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_al
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_identity_definer');
  if v_bad is not null then
    raise exception 'profiles.new_creator_alias() executable by: %', v_bad;
  end if;

  -- RLS enabled and forced on the six tables
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'profiles'
     and c.relname in ('creator_public_profiles', 'creator_topics', 'creator_publication_languages',
                       'creator_tones', 'creator_formats', 'creator_usage_rights')
     and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not enabled and forced on: %', v_bad;
  end if;

  -- EC-L2D-1, P5: influx_advertiser holds no right at all on any creator object, guarded by name
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'profiles'
     and c.relname like 'creator\_%'
     and c.relkind in ('r', 'p', 'v', 'm')
     and (pg_catalog.has_table_privilege('influx_advertiser', c.oid,
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          or pg_catalog.has_any_column_privilege('influx_advertiser', c.oid,
                                                 'SELECT, INSERT, UPDATE, REFERENCES'));
  if v_bad is not null then
    raise exception 'influx_advertiser holds a right on: %', v_bad;
  end if;

  -- no member writes status, alias, public_ref, published_at, is_searchable nor a derived band
  select string_agg(r.rolname || '.' || col, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['status', 'alias', 'public_ref', 'published_at', 'is_searchable', 'account_id',
                      'residence_country_code', 'main_audience_country', 'main_audience_share_band',
                      'audience_gender_band', 'availability_declared_at']) col
   where r.rolname in ('influx_creator', 'influx_advertiser', 'influx_agent', 'influx_admin')
     and (pg_catalog.has_column_privilege(r.oid, 'profiles.creator_public_profiles', col, 'INSERT')
          or pg_catalog.has_column_privilege(r.oid, 'profiles.creator_public_profiles', col, 'UPDATE'));
  if v_bad is not null then
    raise exception 'unexpected write right(s) on profiles.creator_public_profiles: %', v_bad;
  end if;

  -- every existing creator account, deleted ones aside, holds its storefront
  select string_agg(a.id::text, ', ') into v_bad
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
   where a.status <> 'deleted'
     and not exists (select 1 from profiles.creator_public_profiles p where p.account_id = a.id);
  if v_bad is not null then
    raise exception 'creator account(s) without a storefront: %', v_bad;
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
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema identity';
  end if;
end
$$;
