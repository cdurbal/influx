-- =============================================================================
-- 0229_verification_registry_sources_by_subdivision
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 03 (jalons/l2f/03.md; l2f-fiche.md invariants 10, 17; 21 §8 L2E-US, L2ES-3,
-- EC-L2C-fix-2-2; archives/jalons/l2e/registres.md "États-Unis : conduite retenue"; 06 RG52, RG101;
-- 15 RG36, RG110, CA19). The registers of a State beside the register of its country, the door that
-- adds one, and two refusals that now leave their trace.
--
-- 1. verification.registry_sources.subdivision_code: NULL (the source answers for the whole
--    country), or a first-level subdivision of reference.regions OF THE SAME COUNTRY (composite
--    foreign key on (country_code, subdivision_code)). Only a source of type `national` carries one.
--    The index registry_sources_one_active (same name) now keeps one active source per
--    (country, subdivision): the national source and the sources of its States coexist. The rows
--    of 0221 keep their shape (subdivision NULL); the United States still hold none (registres.md:
--    GLEIF first, then the States an administrator adds).
-- 2. verification.add_registry_source(country, subdivision, name, url, checked_on, active): an
--    administrator in aal2 adds a source of type `national` after checking its gratuity by hand
--    (RG101), journalled as set_registry_source (verification.registry_source_changed, before NULL,
--    after the value added). SECURITY DEFINER owned by influx_verification_definer; EXECUTE for
--    influx_agent and influx_admin, the function refuses the agent (42501), as set_registry_source.
-- 3. The brand dossier reads the active sources of the country of registration, its States
--    included (apps/api, verification-queues/repository.ts: same filter on country_code, the States
--    after the national source); verification.grant_brand_verified() already accepts any active
--    source of that country (0224 §6.4): a State source of another country stays refused.
-- 4. backoffice.record_refused_action(), recreated by its owner as in 0215 with:
--    L2ES-3   two more codes for an agent, verification.set_registry_source and
--             verification.add_registry_source (the write of an administrator, attempted by an
--             agent), payload {action_code, required_role: admin};
--    EC-L2C-fix-2-2   EXECUTE for influx_admin too, for queue.conflict_of_interest ONLY: the 15 RG36
--             refusal of an administrator who holds the account is journalled as an agent's
--             (payload {action_code, reason: conflict_of_interest}); any other code of an admin is
--             refused 42501 (an admin is never refused an admin action).
--
-- Not here: the route that adds a source and the screen (L2F commit 21); the subdivision in the
-- answers of the routes (commit 21).
--
-- EC-L2F-03 (micro-gaps, the safest choice):
--   EC-L2F-03-1  a State source is of type `national` (the official register of its jurisdiction):
--                the set of types of 0221 is unchanged, so the contracts that read it today (the
--                brand dossier, the settings screen) read a State source without a new value;
--                `e_justice` and `gleif` stay the migrations' own (the door adds `national` only).
--   EC-L2F-03-2  the trace of an added source is the code of a changed one,
--                verification.registry_source_changed, with `before` NULL (no new register code).
--   EC-L2F-03-3  codes are trimmed and put in capitals; an unknown country or a subdivision that is
--                not one of the country's: 22023 country_code / subdivision_code (the foreign keys,
--                caught), never a raw 23503. A retired subdivision is not refused here: the owner
--                of the decisions reads nothing of the schema reference (no subdivision of the
--                reference is retired today).
--   EC-L2F-03-4  the admin's call of record_refused_action is accepted with the same identity checks
--                as the agent's (active account, the role held, an active internal profile, aal2).
--   EC-L2F-03-5  0229 is the next free number (ls supabase/migrations).
--
-- ROLLBACK (before any source with a subdivision is written): drop function
-- verification.add_registry_source(text, text, text, text, date, boolean); drop policy
-- registry_sources_verification_definer_insert; revoke insert on verification.registry_sources and
-- select (subdivision_code) from influx_verification_definer; recreate registry_sources_one_active as
-- in 0221; drop the constraints registry_sources_subdivision and registry_sources_subdivision_type,
-- then the column; recreate backoffice.record_refused_action() as in 0215 (as influx_identity_definer)
-- and revoke execute on it from influx_admin.
-- =============================================================================

-- 1. The subdivision of a source (L2E-US, EC-L2E-05-7) -----------------------------------------------

alter table verification.registry_sources add column if not exists subdivision_code text;

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'registry_sources_subdivision'
                    and conrelid = 'verification.registry_sources'::regclass) then
    alter table verification.registry_sources
      add constraint registry_sources_subdivision
      foreign key (country_code, subdivision_code) references reference.regions (country_code, code);
  end if;
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'registry_sources_subdivision_type'
                    and conrelid = 'verification.registry_sources'::regclass) then
    -- the register of a State is an official register (EC-L2F-03-1); GLEIF and e-Justice never have one
    alter table verification.registry_sources
      add constraint registry_sources_subdivision_type
      check (subdivision_code is null or source_type = 'national');
  end if;
end
$$;

-- one active source per (country, subdivision), one active GLEIF; the name of 0221 kept
drop index if exists verification.registry_sources_one_active;
create unique index registry_sources_one_active
  on verification.registry_sources ((coalesce(country_code::text, '')), (coalesce(subdivision_code, '')))
  where is_active;

comment on table verification.registry_sources is
  'The free public registers an agent consults for the registration of a brand (06 RG52, D79 (12), '
  'l2e/registres.md): one row per country (e_justice: the 27 of the Union, IS, LI, NO; national), '
  'GLEIF once, without a country, as the fallback of every country; since 0229 the registers of a '
  'State (national, with its subdivision) beside the register of its country. One ACTIVE source per '
  '(country, subdivision). A source whose gratuity is not written by an official page ("à confirmer") '
  'is loaded inactive: an administrator activates it after checking it by hand (RG101; 0224 '
  'set_registry_source, 0229 add_registry_source, journalled registry_source_changed). Never a private '
  'aggregator (D79). Read by agent and admin in aal2.';
comment on column verification.registry_sources.subdivision_code is
  'L2E-US (0229): NULL for a source of the whole country; otherwise the ISO 3166-2 code of a '
  'subdivision of reference.regions of the SAME country (composite foreign key), type national only. '
  'Added by an administrator (verification.add_registry_source).';

-- 2. What the owner of the decisions reads and writes (0224 §2.6, one column, one insert) ------------

grant select (subdivision_code) on verification.registry_sources to influx_verification_definer;
grant insert (country_code, subdivision_code, source_type, name, url, checked_on, is_active,
              updated_by_account_id)
   on verification.registry_sources to influx_verification_definer;
drop policy if exists registry_sources_verification_definer_insert on verification.registry_sources;
create policy registry_sources_verification_definer_insert on verification.registry_sources
  for insert to influx_verification_definer
  with check (source_type = 'national'
              and updated_by_account_id = (select influx.current_account_id()));

-- 3. The door of an administrator (06 RG52, RG101; L2E-US) ------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;
set role influx_verification_definer;

create or replace function verification.add_registry_source(
  p_country_code      text,
  p_subdivision_code  text,
  p_name              text,
  p_url               text,
  p_checked_on        date,
  p_is_active         boolean)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller       uuid := verification.require_agent(true);
  v_country      text := pg_catalog.upper(pg_catalog.btrim(p_country_code));
  v_subdivision  text := nullif(pg_catalog.upper(pg_catalog.btrim(p_subdivision_code)), '');
  v_id           uuid;
  v_constraint   text;
begin
  if p_checked_on is null or p_checked_on > (pg_catalog.now() at time zone 'UTC')::date
     or p_is_active is null then
    raise exception 'checked_on' using errcode = 'invalid_parameter_value', detail = 'checked_on';
  end if;
  if v_country is null or v_country !~ '^[A-Z]{2}$' then
    raise exception 'country_code' using errcode = 'invalid_parameter_value', detail = 'country_code';
  end if;

  begin
    -- the shapes of name and URL are the constraints of 0221 (23514); one active per (country,
    -- subdivision) (23505)
    insert into verification.registry_sources
      (country_code, subdivision_code, source_type, name, url, checked_on, is_active,
       updated_by_account_id)
    values (v_country, v_subdivision, 'national', pg_catalog.btrim(p_name), pg_catalog.btrim(p_url),
            p_checked_on, p_is_active, v_caller)
    returning id into v_id;
  exception
    when foreign_key_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'registry_sources_subdivision' then
        raise exception 'subdivision_code'
          using errcode = 'invalid_parameter_value', detail = 'subdivision_code';
      end if;
      raise exception 'country_code' using errcode = 'invalid_parameter_value', detail = 'country_code';
  end;

  perform audit.append('verification.registry_source_changed', 'registry_source', v_id,
                       pg_catalog.jsonb_build_object(
                         'before', null,
                         'after', pg_catalog.jsonb_build_object(
                                    'country_code', v_country, 'subdivision_code', v_subdivision,
                                    'source_type', 'national', 'name', pg_catalog.btrim(p_name),
                                    'url', pg_catalog.btrim(p_url), 'checked_on', p_checked_on,
                                    'is_active', p_is_active)));
  return v_id;
end
$$;

comment on function verification.add_registry_source(text, text, text, text, date, boolean) is
  '06 RG52, RG101; L2E-US (0229): an administrator adds a register of type national for a country, '
  'or for one of its subdivisions (a State), after checking its gratuity by hand; writes '
  'verification.registry_source_changed {before: null, after}; returns the id. 22023 checked_on '
  '(none, in the future, or no active flag), country_code (unknown), subdivision_code (not a '
  'subdivision of that country); 23514 a shape of 0221; 23505 a second active source for the '
  '(country, subdivision); 42501 outside an active admin in aal2. SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin (the function refuses the '
  'agent, whose attempt apps/api journals through backoffice.record_refused_action).';

revoke all on function verification.add_registry_source(text, text, text, text, date, boolean)
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator;
grant execute on function verification.add_registry_source(text, text, text, text, date, boolean)
  to influx_agent, influx_admin;

reset role;
revoke create on schema verification from influx_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
end
$$;

-- 4. The refusals journalled (L2ES-3, EC-L2C-fix-2-2; 15 RG36, RG110, CA19) -------------------------
-- backoffice.record_refused_action(), recreated by its owner as in 0215 with two more codes and the
-- administrator's conflict of interest.

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;

set role influx_identity_definer;

create or replace function backoffice.record_refused_action(p_action_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller uuid := influx.current_account_id();
  v_role   text := influx.current_account_role()::text;
begin
  if v_caller is null
     or v_role is null
     or v_role not in ('agent', 'admin')
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role::text = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_action_code is null
     or p_action_code not in ('leads.change_apollo_setting', 'leads.read_apollo_settings',
                              'leads.lift_brevo_suppression', 'backoffice.dual_control',
                              'identity.change_member_role', 'identity.internal_invitation',
                              'privacy.approve_data_request', 'ops.read_health',
                              'queue.force_release_claim', 'queue.conflict_of_interest',
                              'verification.set_registry_source',
                              'verification.add_registry_source') then
    raise exception 'unknown action code' using errcode = 'invalid_parameter_value';
  end if;
  -- EC-L2C-fix-2-2: an administrator is refused no admin action; only the act on an account he holds
  if v_role = 'admin' and p_action_code <> 'queue.conflict_of_interest' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the trace of the attempt, on the caller's own account (AL39 counts them per account); RG110:
  -- the action and the reason of the refusal
  perform audit.append('backoffice.action_refused', 'account', v_caller,
                       case when p_action_code = 'queue.conflict_of_interest'
                            then pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                               'reason', 'conflict_of_interest')
                            else pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                               'required_role', 'admin')
                       end);
end
$$;

comment on function backoffice.record_refused_action(text) is
  '05 CA63, 15 RG110 (AL39): an active agent in aal2 who attempted an admin action leaves its trace: '
  'backoffice.action_refused {action_code, required_role: admin} on his own account. Closed list: '
  'leads.change_apollo_setting, leads.read_apollo_settings, leads.lift_brevo_suppression, '
  'backoffice.dual_control, identity.change_member_role, identity.internal_invitation (0135), '
  'privacy.approve_data_request (0137, EC-J8-49), ops.read_health (0148: the "Santé technique" screen), '
  'queue.force_release_claim (0210: the forced release of a claim, 15 C4), '
  'verification.set_registry_source and verification.add_registry_source (0229, L2ES-3); 22023 '
  'otherwise. Since 0215 also queue.conflict_of_interest (15 RG36, CA19: an act on an entry of an '
  'account the caller holds), payload {action_code, reason: conflict_of_interest}; since 0229 an '
  'active admin in aal2 journals that one code too (EC-L2C-fix-2-2), any other code of an admin is '
  'refused 42501. apps/api calls it before answering 403, in a transaction that commits. SECURITY '
  'DEFINER owned by influx_identity_definer; EXECUTE for influx_agent and influx_admin.';

grant execute on function backoffice.record_refused_action(text) to influx_admin;

reset role;

revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- the two functions: owner, security, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('verification.add_registry_source(text,text,text,text,date,boolean)',
       'influx_verification_definer', array['influx_agent', 'influx_admin']),
      ('backoffice.record_refused_action(text)',
       'influx_identity_definer', array['influx_agent', 'influx_admin'])
    ) as f (sig, owner, callers)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> f.owner
      or not p.prosecdef
      or p.proconfig is distinct from array['search_path=""']
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0 or a.grantee::regrole::text <> all (f.callers)));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, search_path or callers: %', v_bad;
  end if;
  if (select count(*) from pg_catalog.pg_proc p
       where p.oid in ('verification.add_registry_source(text,text,text,text,date,boolean)'::regprocedure,
                       'backoffice.record_refused_action(text)'::regprocedure)
         and exists (select 1
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                                                           pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE'
                        and a.grantee = 'influx_admin'::regrole)) <> 2 then
    raise exception 'influx_admin does not execute both functions';
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'verification'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'influx_advertiser may execute: %', v_bad;
  end if;

  -- still no execution role writing a source directly
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and (pg_catalog.has_any_column_privilege(r.oid, 'verification.registry_sources', 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'verification.registry_sources', 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'execution role(s) writing verification.registry_sources: %', v_bad;
  end if;

  -- the sources of 0221 unchanged: the counts of its assertion, no subdivision, no State loaded
  if (select count(*) from verification.registry_sources where source_type = 'e_justice' and is_active) <> 30
     or (select count(*) from verification.registry_sources where source_type = 'gleif' and is_active) <> 1
     or exists (select 1 from verification.registry_sources
                 where subdivision_code is not null or country_code = 'US') then
    raise exception 'the registry sources of 0221 changed';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_verification_definer', 'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
