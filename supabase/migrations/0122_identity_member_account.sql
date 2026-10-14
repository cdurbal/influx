-- =============================================================================
-- 0122_identity_member_account
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 6. "Mon compte" (1): what PATCH /v1/me and the blocking
-- re-acceptance of the terms of service need (05 RG15, RG28, RG71, RG73; 17 §6.1).
--
--   identity.update_own_account()   the ONLY door to a member's country, language and
--         company name after the sign-up; the declared status of a creator goes through
--         identity.set_declared_status() (0104), called from here. ONE lead.updated per
--         call, in the SAME transaction (RG73): the one of set_declared_status when the
--         status changes, otherwise its own. No change, no line.
--   identity.own_terms_to_accept()  the version of the terms of service in force for the
--         caller (his language, else English, RG25) when he has not accepted that release
--         yet (RG28): zero or one row. A release is its version_label, unique per document
--         and language (0005): accepting it in one language accepts it in all.
--
-- The direct UPDATE of preferred_language that 0004 gave the members is REVOKED: a
-- language changed without its lead.updated would never reach Brevo (RG15 held by the
-- database rather than by a convention, as 0119 did for the consent).
--
-- ROLLBACK: drop function identity.update_own_account(text, text, identity.declared_status,
-- text), identity.own_terms_to_accept(); grant update (preferred_language) on identity.accounts
-- to influx_advertiser, influx_creator; revoke select (country_code, preferred_language), update
-- (country_code, preferred_language) on identity.accounts from influx_identity_definer; revoke
-- select (account_id, legal_name), update (legal_name) on profiles.advertiser_profiles from
-- influx_identity_definer; drop the policies advertiser_profiles_identity_definer_select and
-- advertiser_profiles_identity_definer_update.
-- =============================================================================

-- 1. identity.update_own_account() -----------------------------------------------------------

create or replace function identity.update_own_account(
  p_country_code        text,
  p_preferred_language  text,
  p_declared_status     identity.declared_status,
  p_legal_name          text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account    uuid := influx.current_account_id();
  v_role       identity.account_role := influx.current_account_role();
  v_country    char(2);
  v_language   char(2);
  v_legal_name text;
  v_changed    boolean := false;
  v_status_set boolean := false;
  v_event      uuid := pg_catalog.gen_random_uuid();
begin
  if v_account is null or v_role is null or v_role not in ('advertiser', 'creator') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- One change at a time per account: the row lock serialises two submissions.
  select a.country_code, a.preferred_language
    into v_country, v_language
    from identity.accounts a
    join identity.account_roles r on r.account_id = a.id and r.role = v_role
   where a.id = v_account and a.status = 'active'
     for update of a;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The fields of the other door are refused, never ignored (17 §6.1).
  if v_role = 'creator' and p_legal_name is not null then
    raise exception 'a creator has no company name' using errcode = 'invalid_parameter_value';
  end if;
  if v_role = 'advertiser' and p_declared_status is not null and p_declared_status <> 'business' then
    raise exception 'an advertiser account is business by construction (RG22)'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_country_code is not null and p_country_code is distinct from v_country then
    if p_country_code !~ '^[A-Z]{2}$' then
      raise exception 'the country is an ISO 3166-1 alpha-2 code' using errcode = 'invalid_parameter_value';
    end if;
    -- RG8: a blocked country is not reached after the sign-up either.
    if exists (select 1 from leads.sync_settings s
                where s.key = 'signup_blocked_countries' and s.value ? p_country_code) then
      raise exception 'country not available' using errcode = 'check_violation';
    end if;
    update identity.accounts set country_code = p_country_code where id = v_account;
    v_changed := true;
  end if;

  if p_preferred_language is not null and p_preferred_language is distinct from v_language then
    -- the composite key of 0004 refuses a language the product is not translated into (23503)
    update identity.accounts set preferred_language = p_preferred_language where id = v_account;
    v_changed := true;
  end if;

  if v_role = 'advertiser' and p_legal_name is not null then
    select p.legal_name into v_legal_name
      from profiles.advertiser_profiles p where p.account_id = v_account;
    if p_legal_name is distinct from v_legal_name then
      -- kept as typed (05 RG13); the constraints of 0106 refuse a short or unprintable name (23514)
      update profiles.advertiser_profiles set legal_name = p_legal_name where account_id = v_account;
      v_changed := true;
    end if;
  end if;

  if v_role = 'creator' and p_declared_status is not null then
    -- its own lead.updated and its chained register line (0104)
    v_status_set := identity.set_declared_status(v_account, p_declared_status, 'member_settings');
  end if;

  -- RG73: ONE lead.updated per change, in the transaction of the fact.
  if v_changed and not v_status_set then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select v_event, 'lead.updated', d.destination, 'account:' || v_account::text, 100,
           pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_account),
           'lead.updated:' || v_event::text
      from (values ('brevo_contact'::leads.outbox_destination),
                   ('apollo_contact'::leads.outbox_destination)) d (destination);
  end if;
  return v_changed or v_status_set;
end
$$;

comment on function identity.update_own_account(text, text, identity.declared_status, text) is
  '05 RG15, RG71, RG73; 17 §6.1: an advertiser or creator changes his own country, language, '
  'declared status (creator) or company name (advertiser); NULL = unchanged. In one transaction: the '
  'columns and ONE lead.updated (priority 100) to brevo_contact and apollo_contact, payload = ids '
  'only; a change of declared status goes through identity.set_declared_status() (reason '
  'member_settings, its own lead.updated and register line). Returns false when nothing changes '
  '(no line). 22023 for a field of the other door or a malformed country, 23514 for a blocked '
  'country (RG8) or a company name refused by 0106, 23503 for an unknown country or a language '
  'without translation, 42501 outside an active member account. SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and influx_creator.';

revoke all on function identity.update_own_account(text, text, identity.declared_status, text)
  from public, anon, authenticated, service_role;
grant execute on function identity.update_own_account(text, text, identity.declared_status, text)
   to influx_advertiser, influx_creator;

-- 2. identity.own_terms_to_accept() ------------------------------------------------------------
-- SECURITY INVOKER: the members already read every version (0005 §5.1) and their own
-- acceptances (§5.2). Same version as identity.terms_in_force(): in force, with its text,
-- in the account's language, else in English (RG25).

create or replace function identity.own_terms_to_accept()
returns table (
  id              uuid,
  version_label   text,
  locale          char(2),
  effective_from  timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with served as (
    select v.id, v.version_label, v.locale, v.effective_from
      from identity.terms_versions v
      join identity.accounts a on a.id = (select influx.current_account_id())
     where v.document_kind = 'terms_of_service'
       and v.locale in (a.preferred_language, 'en')
       and v.effective_to is null
       and v.effective_from <= pg_catalog.now()
       and v.content is not null
     order by (v.locale = a.preferred_language) desc
     limit 1
  )
  select s.id, s.version_label, s.locale, s.effective_from
    from served s
   where not exists (
           select 1
             from identity.terms_acceptances t
             join identity.terms_versions w on w.id = t.terms_version_id
            where t.account_id = (select influx.current_account_id())
              and t.nature = 'acceptance'
              and t.introduction_id is null
              and w.document_kind = 'terms_of_service'
              and w.version_label = s.version_label)
$$;

comment on function identity.own_terms_to_accept() is
  '05 RG28, CA70: the terms of service in force for the caller (his language, else English, RG25; '
  'with its text, 0109) when he has accepted no version of that release (same version_label, any '
  'language): zero or one row. Nothing published = nothing to accept. SECURITY INVOKER (the member '
  'reads the versions and his own acceptances, 0005); EXECUTE for influx_advertiser and '
  'influx_creator.';

revoke all on function identity.own_terms_to_accept() from public, anon, authenticated, service_role;
grant execute on function identity.own_terms_to_accept() to influx_advertiser, influx_creator;

-- 3. Rights --------------------------------------------------------------------------------------

-- 3.1 Members: the function is the only door to the language (RG15, RG73) -------------------------

revoke update (preferred_language) on identity.accounts from influx_advertiser, influx_creator;

-- 3.2 The owner: what update_own_account reads and writes, nothing more ---------------------------

grant select (country_code, preferred_language) on identity.accounts to influx_identity_definer;
grant update (country_code, preferred_language) on identity.accounts to influx_identity_definer;

grant select (account_id, legal_name) on profiles.advertiser_profiles to influx_identity_definer;
grant update (legal_name) on profiles.advertiser_profiles to influx_identity_definer;

drop policy if exists advertiser_profiles_identity_definer_select on profiles.advertiser_profiles;
create policy advertiser_profiles_identity_definer_select on profiles.advertiser_profiles
  for select to influx_identity_definer
  using (account_id = (select influx.current_account_id()));

drop policy if exists advertiser_profiles_identity_definer_update on profiles.advertiser_profiles;
create policy advertiser_profiles_identity_definer_update on profiles.advertiser_profiles
  for update to influx_identity_definer
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()));

-- 4. Hand the function to influx_identity_definer (03 P7 rule 5, window of 0004 §9) ---------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.update_own_account(text, text, identity.declared_status, text)
  owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5. End-state assertions ----------------------------------------------------------------------------

do $$
declare
  c_fn    constant text := 'identity.update_own_account(text, text, identity.declared_status, text)';
  c_terms constant text := 'identity.own_terms_to_accept()';
  v_bad   text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = c_fn::regprocedure) <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_identity_definer, empty search_path', c_fn;
  end if;
  if (select prosecdef from pg_catalog.pg_proc where oid = c_terms::regprocedure) then
    raise exception '% must be SECURITY INVOKER', c_terms;
  end if;

  select string_agg(format('%s: %s', p.oid::regprocedure,
                           case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end), ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in (c_fn::regprocedure, c_terms::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_advertiser', 'influx_creator'));
  if v_bad is not null then
    raise exception 'executable by: %', v_bad;
  end if;

  -- RG15, RG73: no member writes his country, language or company name directly any more
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname in ('influx_advertiser', 'influx_creator')
     and (pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'preferred_language', 'UPDATE')
          or pg_catalog.has_column_privilege(r.oid, 'identity.accounts', 'country_code', 'UPDATE')
          or pg_catalog.has_any_column_privilege(r.oid, 'profiles.advertiser_profiles', 'UPDATE'));
  if v_bad is not null then
    raise exception 'member role(s) may write their account settings directly: %', v_bad;
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
