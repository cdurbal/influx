-- =============================================================================
-- 0108_identity_terms_public_read
-- -----------------------------------------------------------------------------
-- Lot 1 / J5, commit 3 (21 EC-62).
--
-- identity.terms_in_force(): the ONLY way a visitor without an account reads a public
-- document (terms of service, privacy policy, cookie policy; 05 RG23 to RG29). No third
-- connection path: apps/api calls it under influx_auth (03 P7, E-1, motif
-- identity.read_published_terms), which holds NO direct right on identity.terms_versions.
-- The text itself lives in apps/api/legal/<document_kind>/<locale>/<version_label>.md; the
-- API checks content_uri and recomputes the SHA-256 against content_hash, failing closed.
--
-- Rules carried by the function:
--   * the version IN FORCE: effective_to IS NULL and effective_from <= now(). A version
--     published for later, or closed, is never served;
--   * in the requested language; failing that, and unless English was requested, the
--     English version (RG25). The served locale is returned: the caller tells a fallback
--     from the column, never from its own parameter;
--   * zero or one row (terms_versions_current_idx: one version in force per document and
--     language);
--   * supervision_notice is refused (12 RG103: shown inside the platform only, to members),
--     like a locale that is not two lower-case letters (22023).
--   SECURITY DEFINER owned by influx_identity_definer, empty search_path, STABLE, EXECUTE
--   to influx_auth ONLY. The owner receives the three columns it did not read yet
--   (version_label, content_uri, requires_acceptance); 0106 already gave it the others and
--   the policy terms_versions_identity_definer_select.
--
-- ROLLBACK: drop function identity.terms_in_force(identity.document_kind, text); revoke
-- select (version_label, content_uri, requires_acceptance) on identity.terms_versions from
-- influx_identity_definer. Nothing is written by this migration: the rollback loses no data.
-- =============================================================================

-- 1. identity.terms_in_force() (EC-62) ------------------------------------------------------------

create or replace function identity.terms_in_force(
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
  effective_from       timestamptz
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

  return query
    select v.id, v.document_kind, v.locale, v.version_label, v.content_uri, v.content_hash,
           v.requires_acceptance, v.effective_from
      from identity.terms_versions v
     where v.document_kind = p_document
       and v.locale = p_locale::char(2)
       and v.effective_to is null
       and v.effective_from <= pg_catalog.now();
  if found or p_locale = 'en' then
    return;
  end if;

  -- RG25: the English version when none is in force in the requested language.
  return query
    select v.id, v.document_kind, v.locale, v.version_label, v.content_uri, v.content_hash,
           v.requires_acceptance, v.effective_from
      from identity.terms_versions v
     where v.document_kind = p_document
       and v.locale = 'en'
       and v.effective_to is null
       and v.effective_from <= pg_catalog.now();
end
$$;

comment on function identity.terms_in_force(identity.document_kind, text) is
  'Public document in force (21 EC-62, 05 RG23 to RG29): the version of p_document whose '
  'effective_to is NULL and effective_from <= now(), in p_locale, otherwise in English (RG25); 0 or '
  '1 row, locale = the language actually served. supervision_notice and a locale other than two '
  'lower-case letters are refused (22023). SECURITY DEFINER owned by influx_identity_definer, empty '
  'search_path; EXECUTE for influx_auth ONLY (03 P7 E-1, identity.read_published_terms), which has '
  'no direct right on identity.terms_versions.';

revoke all on function identity.terms_in_force(identity.document_kind, text) from public;
grant execute on function identity.terms_in_force(identity.document_kind, text) to influx_auth;

-- 2. Rights of the owner: the three columns 0106 did not give it --------------------------------
-- 0106 §3 grants (id, document_kind, locale, content_hash, effective_from, effective_to) and the
-- policy terms_versions_identity_definer_select (using true): both are reused as they are.

grant select (version_label, content_uri, requires_acceptance)
   on identity.terms_versions to influx_identity_definer;

-- 3. Hand the function to influx_identity_definer (03 P7 rule 5, window of 0004 §9) -----------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.terms_in_force(identity.document_kind, text) owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 4. End-state assertions --------------------------------------------------------------------------

do $$
declare
  c_fn  constant regprocedure := 'identity.terms_in_force(identity.document_kind, text)'::regprocedure;
  v_bad text;
begin
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
