-- =============================================================================
-- 0106_profiles_advertiser_minimal
-- -----------------------------------------------------------------------------
-- Lot 1 / J5, commit 2.
--
-- 1. profiles.advertiser_profiles in its MINIMAL form (04 §5.2, "avancée au Lot 1"):
--    account_id, legal_name, status 'draft'. The company name is a profile attribute,
--    not an identity one; Lot 2 (0202) only ADDS nullable columns. A composite key
--    restricts the table to accounts holding the advertiser role, in base.
--
-- 2. identity.provision_account() (EC-30, 03 C(1)): the creation of an account at the
--    validation of screen 3 (05 RG5), the ONLY way an advertiser or creator account
--    comes to exist. It lives here, not in 0104, because it writes the profile created
--    above. One call writes, all or nothing (05 RG7): the account (declared status,
--    adult attestation, acquisition source), its single role, the advertiser profile,
--    the acceptance of the terms in force (RG24, RG29), the two consent events of the
--    single checkbox (RG32, RG33, D63) and the three queue lines of lead.created
--    (EC-10). Idempotent on auth_user_id (RG110). Refuses a blocked country without
--    writing anything (RG8).
--    SECURITY DEFINER owned by influx_identity_definer, empty search_path, EXECUTE to
--    influx_auth ONLY. Role limited to advertiser or creator: no internal role can be
--    created this way. influx_auth thus holds NO write right on the accounts, the roles,
--    the acceptances, the consents, the queue or the profiles (03 P7, E-2).
--    The register line of the elevated transaction (elevated.identity.complete_signup,
--    0104) is written by apps/api through audit.append_elevated() (EC-36), not here.
--
-- ROLLBACK (only while no real account exists): drop function
-- identity.provision_account(...); revoke the grants of influx_identity_definer and
-- influx_auth listed below; drop table profiles.advertiser_profiles; drop type
-- profiles.advertiser_profile_status.
-- =============================================================================

-- 1. profiles.advertiser_profiles ---------------------------------------------------------

do $$
begin
  create type profiles.advertiser_profile_status as enum ('draft');
exception when duplicate_object then null;
end
$$;

comment on type profiles.advertiser_profile_status is
  'Life cycle of an advertiser profile. Lot 1: draft only; the other states arrive with the full '
  'profile (Lot 2, 0202).';

create table if not exists profiles.advertiser_profiles (
  account_id  uuid        not null primary key,
  role        identity.account_role not null generated always as ('advertiser'::identity.account_role) stored,
  legal_name  text        not null,
  status      profiles.advertiser_profile_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- only an account that holds the advertiser role has an advertiser profile
  constraint advertiser_profiles_advertiser_fk
    foreign key (account_id, role) references identity.account_roles (account_id, role),
  -- 05 RG11, RG13: kept as typed (case included), at most 120 characters, at least two
  -- outside spaces; no control character
  constraint advertiser_profiles_legal_name_length
    check (char_length(legal_name) <= 120 and char_length(btrim(legal_name)) >= 2),
  constraint advertiser_profiles_legal_name_printable check (legal_name !~ '[[:cntrl:]]')
);

comment on table profiles.advertiser_profiles is
  'Advertiser profile, MINIMAL form of Lot 1 (04 §5.2): the company name collected at sign-up (05 '
  'RG11). Extended at Lot 2 by nullable columns only (0202). A brand is not anonymous (D40): its '
  'interlocutor is; the contact details will live in advertiser_contact_details (Lot 2), never here.';
comment on column profiles.advertiser_profiles.role is
  'Always advertiser. Only exists to carry the composite foreign key towards identity.account_roles: '
  'an advertiser profile can only belong to an advertiser account, and that role cannot be removed '
  'while the profile exists.';
comment on column profiles.advertiser_profiles.legal_name is
  'Company name as typed at sign-up (05 RG13), not checked against a registry at Lot 1. Changing it '
  'emits lead.updated (RG73): the change goes through a named function (J7), never a direct UPDATE.';

drop trigger if exists advertiser_profiles_touch_updated_at on profiles.advertiser_profiles;
create trigger advertiser_profiles_touch_updated_at
  before update on profiles.advertiser_profiles
  for each row execute function influx.touch_updated_at();

alter table profiles.advertiser_profiles enable row level security;
alter table profiles.advertiser_profiles force  row level security;
revoke all on profiles.advertiser_profiles from public, anon, authenticated, service_role;

-- 04 §6: the advertiser reads his own profile (S), agent and admin read all (L, aal2). No
-- member writes it directly at Lot 1; a creator has no right at all on it.
grant usage on schema profiles to influx_advertiser, influx_agent, influx_admin;
grant select on profiles.advertiser_profiles to influx_advertiser, influx_agent, influx_admin;

drop policy if exists advertiser_profiles_member_select_own on profiles.advertiser_profiles;
create policy advertiser_profiles_member_select_own on profiles.advertiser_profiles
  for select to influx_advertiser
  using (account_id = (select influx.current_account_id()));

drop policy if exists advertiser_profiles_internal_select on profiles.advertiser_profiles;
create policy advertiser_profiles_internal_select on profiles.advertiser_profiles
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 2. identity.provision_account() (EC-30) -------------------------------------------------------

create or replace function identity.provision_account(
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
  v_subject   text;
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

  -- RG25, RG29: the terms of service IN FORCE; the acceptance records the language of
  -- the version actually shown (its own locale), never the wished one.
  select v.id, v.locale
    into v_terms
    from identity.terms_versions v
   where v.id = p_terms_version_id
     and v.document_kind = 'terms_of_service'
     and v.effective_to is null
     and v.effective_from <= pg_catalog.now();
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
  'advertiser profile, acceptance of the terms in force, two consent events, three lead.created '
  'queue lines, all or nothing. advertiser or creator only (42501 otherwise); business imposed for an '
  'advertiser (RG22); creator: declared status and adult attestation required (RG18, RG19, RG20); '
  'consent required unless signup_consent_required is false (D63). Returns (account id, outcome): '
  'created; existing when an account already holds this auth_user_id (RG110, nothing written); '
  'country_blocked with no id (RG8, nothing written). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_auth ONLY.';

revoke all on function identity.provision_account(uuid, text, identity.account_role, text, text,
    identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text,
    text, identity.heard_from) from public;
grant execute on function identity.provision_account(uuid, text, identity.account_role, text, text,
    identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text,
    text, identity.heard_from) to influx_auth;

-- 3. Rights of the owner, what the function reads and writes and nothing more ------------------

grant select (auth_user_id) on identity.accounts to influx_identity_definer;
grant insert (auth_user_id, email, email_verified_at, country_code, preferred_language,
              declared_status, is_adult_attested, adult_attested_at, signup_utm_source,
              signup_utm_medium, signup_utm_campaign, signup_referrer_domain, signup_heard_from)
   on identity.accounts to influx_identity_definer;

drop policy if exists accounts_identity_definer_insert on identity.accounts;
create policy accounts_identity_definer_insert on identity.accounts
  for insert to influx_identity_definer
  with check (status = 'active' and owner_agent_id is null and deleted_at is null);

-- the version in force, read by the function and by identity.prepare_terms_acceptance()
grant select (id, document_kind, locale, content_hash, effective_from, effective_to)
   on identity.terms_versions to influx_identity_definer;

drop policy if exists terms_versions_identity_definer_select on identity.terms_versions;
create policy terms_versions_identity_definer_select on identity.terms_versions
  for select to influx_identity_definer
  using (true);

grant insert (account_id, terms_version_id, nature, channel, locale)
   on identity.terms_acceptances to influx_identity_definer;

drop policy if exists terms_acceptances_identity_definer_insert on identity.terms_acceptances;
create policy terms_acceptances_identity_definer_insert on identity.terms_acceptances
  for insert to influx_identity_definer
  with check (channel = 'signup' and nature = 'acceptance' and introduction_id is null);

grant insert (account_id, purpose, granted, source, evidence)
   on identity.consent_events to influx_identity_definer;

drop policy if exists consent_events_identity_definer_insert on identity.consent_events;
create policy consent_events_identity_definer_insert on identity.consent_events
  for insert to influx_identity_definer
  with check (source = 'signup_form' and recorded_by_account_id is null);

grant select (key, value) on leads.sync_settings to influx_identity_definer;

drop policy if exists sync_settings_identity_definer_select on leads.sync_settings;
create policy sync_settings_identity_definer_select on leads.sync_settings
  for select to influx_identity_definer
  using (key in ('signup_blocked_countries', 'signup_consent_required'));

grant usage on schema profiles to influx_identity_definer;
grant insert (account_id, legal_name) on profiles.advertiser_profiles to influx_identity_definer;

drop policy if exists advertiser_profiles_identity_definer_insert on profiles.advertiser_profiles;
create policy advertiser_profiles_identity_definer_insert on profiles.advertiser_profiles
  for insert to influx_identity_definer
  with check (status = 'draft');

-- 4. Hand the function to influx_identity_definer (03 P7 rule 5, window of 0004 §9) -----------

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

-- 5. End-state assertions --------------------------------------------------------------------------

do $$
declare
  c_fn  constant regprocedure := 'identity.provision_account(uuid, text, identity.account_role, text, '
    'text, identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text, '
    'text, identity.heard_from)'::regprocedure;
  v_bad text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid = c_fn)
       <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn) is distinct from array['search_path=""'] then
    raise exception 'identity.provision_account() must be SECURITY DEFINER, owned by '
                    'influx_identity_definer, empty search_path';
  end if;

  -- EC-30: EXECUTE for influx_auth only (besides its owner)
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn
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
                      'profiles.advertiser_profiles']) t
   where pg_catalog.has_any_column_privilege('influx_auth', t, 'INSERT')
      or pg_catalog.has_any_column_privilege('influx_auth', t, 'UPDATE');
  if v_bad is not null then
    raise exception 'influx_auth may write directly: %', v_bad;
  end if;

  -- no member writes a profile directly at Lot 1; a creator has nothing on it
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname <> 'influx_identity_definer'
     and (pg_catalog.has_any_column_privilege(r.oid, 'profiles.advertiser_profiles', 'INSERT')
          or pg_catalog.has_any_column_privilege(r.oid, 'profiles.advertiser_profiles', 'UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'profiles.advertiser_profiles', 'DELETE'));
  if v_bad is not null then
    raise exception 'unexpected write right(s) on profiles.advertiser_profiles: %', v_bad;
  end if;
  if pg_catalog.has_any_column_privilege('influx_creator', 'profiles.advertiser_profiles', 'SELECT') then
    raise exception 'a creator may read the advertiser profiles';
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
