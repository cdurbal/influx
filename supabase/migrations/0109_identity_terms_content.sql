-- =============================================================================
-- 0109_identity_terms_content
-- -----------------------------------------------------------------------------
-- Lot 1 / J5, amendment of 21 EC-62 (2026-10-08, founder: no 500 on GET /v1/terms/current).
--
-- The exact text of a public document is stored in the database at publication, so that the
-- API serves it without reading any file (the files of apps/api/legal stay the source of the
-- publication and the CI check of immutability).
--
-- 1. identity.terms_versions.content: 1 to 200 000 characters, whose SHA-256 (UTF-8 bytes) IS
--    content_hash, checked by the database. Every NEW version in force carries its text; the
--    constraint is NOT VALID because of the inherited rows published without text
--    (demo-fictive-1 on staging, draft-2 on the workstations), which must still be closable.
-- 2. The immutability trigger of 0005 also guards content, with ONE exception: the single
--    filling NULL -> text of an inherited row (its hash was frozen at publication, the hash
--    constraint makes the text the published one). Any later change is refused.
-- 3. identity.terms_in_force() is recreated (its return type changes): it returns content and
--    IGNORES a row without text, in the requested language and then in English (EC-62 (B): an
--    inherited row without text is not served, no fallback to a file). Everything else as in
--    0108: SECURITY DEFINER owned by influx_identity_definer, empty search_path, STABLE,
--    EXECUTE to influx_auth ONLY.
-- 4. identity.provision_account() is recreated, identical to 0106 but for `and v.content is not
--    null` in the lookup of the accepted version (micro-deviation, CLAUDE.md §7 rule 5): a
--    version without text is never shown, so it cannot be accepted; same error (23503,
--    'unknown terms version, or not in force'). Owner, rights and assertions as in 0106.
--
-- ROLLBACK (only while no real acceptance exists): drop function
-- identity.provision_account(...) and recreate it as in 0106 §2, §4 (grants, owner, assertions
-- included); drop function identity.terms_in_force(identity.document_kind, text) and recreate it
-- as in 0108 (grants, owner, assertions included); recreate identity.assert_terms_version_immutable() as in 0005;
-- revoke select (content) on identity.terms_versions from influx_identity_definer; alter table
-- identity.terms_versions drop column content (drops its three constraints). The stored texts
-- are lost: they remain in apps/api/legal, under the same hashes.
-- =============================================================================

-- 1. identity.terms_versions.content ------------------------------------------------------------

alter table identity.terms_versions add column if not exists content text;

comment on column identity.terms_versions.content is
  'Exact text of the version (restricted Markdown, 21 EC-62), stored at publication and served by '
  'identity.terms_in_force(). Its SHA-256 over the UTF-8 bytes equals content_hash (constraint). '
  'NULL only on inherited rows published before 0109, which are never served and may be filled '
  'once (immutability trigger) or closed.';

do $$
begin
  alter table identity.terms_versions
    add constraint terms_versions_content_length
    check (content is null or length(content) between 1 and 200000);
exception when duplicate_object then null;
end
$$;

do $$
begin
  alter table identity.terms_versions
    add constraint terms_versions_content_hash
    check (content is null or sha256(convert_to(content, 'UTF8')) = content_hash);
exception when duplicate_object then null;
end
$$;

-- NOT VALID: the inherited rows without text stay; every row inserted or updated from now on is
-- checked, so a new version in force carries its text and an inherited one can only be closed
-- or filled. Never VALIDATE it while such a row is still in force.
do $$
begin
  alter table identity.terms_versions
    add constraint terms_versions_content_required
    check (content is not null or effective_to is not null) not valid;
exception when duplicate_object then null;
end
$$;

comment on constraint terms_versions_content_required on identity.terms_versions is
  'Every version in force carries its text (21 EC-62 amendment). NOT VALID on purpose: the rows '
  'published without text before 0109 remain until they are filled or closed.';

-- 2. Immutability, content included (0005 §2, one exception) -----------------------------------

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
  -- UPDATE: only effective_to may move, from NULL to a value, once; content may be filled,
  -- from NULL to a text, once (0109: inherited rows; the hash constraint fixes which text).
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
     or (old.content is not null and new.content is distinct from old.content)
  then
    raise exception 'a published terms version is immutable (only effective_to may be set, once, '
                    'and a missing content filled, once)'
      using errcode = 'insufficient_privilege';
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end
$$;

comment on function identity.assert_terms_version_immutable() is
  'Guards identity.terms_versions: no delete, no truncate, no change after publication except '
  'setting effective_to once and filling a NULL content once (0109). SECURITY INVOKER, reads nothing.';

revoke all on function identity.assert_terms_version_immutable() from public;

-- 3. Rights of the owner: the text it now returns --------------------------------------------------

grant select (content) on identity.terms_versions to influx_identity_definer;

-- 4. identity.terms_in_force(), recreated with content ---------------------------------------------

drop function if exists identity.terms_in_force(identity.document_kind, text);

create function identity.terms_in_force(
  p_document  identity.document_kind,
  p_locale    text
)
returns table (
  id                   uuid,
  document_kind        identity.document_kind,
  locale               char(2),
  version_label        text,
  content_uri          text,
  content_hash         bytea,
  requires_acceptance  boolean,
  effective_from       timestamptz,
  content              text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- 12 RG103: the supervision notice is never a public document.
  if p_document is null or p_document = 'supervision_notice' then
    raise exception 'document not available without an account' using errcode = 'invalid_parameter_value';
  end if;
  -- ISO 639-1, lower case: the format of reference.languages. An unknown code simply finds
  -- nothing in its own language and falls back to English.
  if p_locale is null or p_locale !~ '^[a-z]{2}$' then
    raise exception 'the locale must be two lower-case letters' using errcode = 'invalid_parameter_value';
  end if;

  -- An inherited row without text is never served (EC-62 (B)): as if nothing were published.
  return query
    select v.id, v.document_kind, v.locale, v.version_label, v.content_uri, v.content_hash,
           v.requires_acceptance, v.effective_from, v.content
      from identity.terms_versions v
     where v.document_kind = p_document
       and v.locale = p_locale::char(2)
       and v.effective_to is null
       and v.effective_from <= pg_catalog.now()
       and v.content is not null;
  if found or p_locale = 'en' then
    return;
  end if;

  -- RG25: the English version when none is in force, with its text, in the requested language.
  return query
    select v.id, v.document_kind, v.locale, v.version_label, v.content_uri, v.content_hash,
           v.requires_acceptance, v.effective_from, v.content
      from identity.terms_versions v
     where v.document_kind = p_document
       and v.locale = 'en'
       and v.effective_to is null
       and v.effective_from <= pg_catalog.now()
       and v.content is not null;
end
$$;

comment on function identity.terms_in_force(identity.document_kind, text) is
  'Public document in force (21 EC-62 and its amendment, 05 RG23 to RG29): the version of p_document '
  'whose effective_to is NULL, effective_from <= now() and content is not NULL, in p_locale, '
  'otherwise in English (RG25); 0 or 1 row, locale = the language actually served, content = the '
  'exact text (its SHA-256 is content_hash). supervision_notice and a locale other than two '
  'lower-case letters are refused (22023). SECURITY DEFINER owned by influx_identity_definer, empty '
  'search_path; EXECUTE for influx_auth ONLY (03 P7 E-1, identity.read_published_terms), which has '
  'no direct right on identity.terms_versions.';

revoke all on function identity.terms_in_force(identity.document_kind, text) from public;
grant execute on function identity.terms_in_force(identity.document_kind, text) to influx_auth;

-- 5. identity.provision_account(), recreated: an acceptance needs a version WITH its text --------
-- Identical to 0106 §2 but for `and v.content is not null` in the lookup of the version (same
-- error). Dropped by the migration role as owner of the schema identity, recreated, handed back
-- to influx_identity_definer in §6 with its rights of 0106 §3, which this migration keeps.

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
  'advertiser profile, acceptance of the terms in force (with its text, 0109), two consent events, three lead.created '
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

-- 6. Hand the functions to influx_identity_definer (03 P7 rule 5, window of 0004 §9) ----------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.terms_in_force(identity.document_kind, text) owner to influx_identity_definer;
alter function identity.provision_account(uuid, text, identity.account_role, text, text,
    identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text,
    text, identity.heard_from) owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 7. End-state assertions --------------------------------------------------------------------------

do $$
declare
  c_fn  constant regprocedure := 'identity.terms_in_force(identity.document_kind, text)'::regprocedure;
  c_pa  constant regprocedure := 'identity.provision_account(uuid, text, identity.account_role, text, '
    'text, identity.declared_status, boolean, text, uuid, boolean, text, text, text, text, text, text, '
    'text, identity.heard_from)'::regprocedure;
  v_bad text;
begin
  -- identity.provision_account(), as 0106 §5 left it
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
                      'profiles.advertiser_profiles']) t
   where pg_catalog.has_any_column_privilege('influx_auth', t, 'INSERT')
      or pg_catalog.has_any_column_privilege('influx_auth', t, 'UPDATE');
  if v_bad is not null then
    raise exception 'influx_auth may write directly: %', v_bad;
  end if;

  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc where oid = c_fn)
       <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn)
     or (select provolatile from pg_catalog.pg_proc where oid = c_fn) <> 's'
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn) is distinct from array['search_path=""'] then
    raise exception 'identity.terms_in_force() must be SECURITY DEFINER, STABLE, owned by '
                    'influx_identity_definer, empty search_path';
  end if;

  -- EC-62: EXECUTE for influx_auth only (besides its owner)
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_auth');
  if v_bad is not null then
    raise exception 'identity.terms_in_force() executable by: %', v_bad;
  end if;

  -- influx_auth reads the documents through the function only: no right at all on the table
  if pg_catalog.has_any_column_privilege('influx_auth', 'identity.terms_versions',
                                         'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_table_privilege('influx_auth', 'identity.terms_versions',
                                       'DELETE, TRUNCATE, TRIGGER') then
    raise exception 'influx_auth holds a direct right on identity.terms_versions';
  end if;

  -- the text is written by the migration role only (publication script), never by an execution role
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_column_privilege(r.oid, 'identity.terms_versions', 'content', 'INSERT')
          or pg_catalog.has_column_privilege(r.oid, 'identity.terms_versions', 'content', 'UPDATE'));
  if v_bad is not null then
    raise exception 'unexpected write right(s) on identity.terms_versions.content: %', v_bad;
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
