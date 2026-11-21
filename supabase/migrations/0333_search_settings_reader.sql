-- =============================================================================
-- 0333_search_settings_reader
-- -----------------------------------------------------------------------------
-- Lot 3 / L3G, commit 08b (jalons/l3g/08b.md, added on 2026-11-21 by the founder; l3g-fiche.md
-- invariants 3, 12, 15; jalons/l3g/modele.md §7, which names the reader of the settings screen; 03 P7;
-- 04 §5.5). The admins read the search settings through ONE function, never through a right on the
-- table: influx_admin keeps no right on search.search_settings. Signalled I-4 (03): a new SECURITY
-- DEFINER function and its EXECUTE to influx_admin.
--
-- 1. search.read_search_settings() → (key, value), every row of search.search_settings (its CHECK
--    closes them to the ten keys), ordered by key. STABLE SECURITY DEFINER owned by
--    influx_search_admin_definer, search_path = '', search.require_search_admin() first (an active
--    admin with an active internal profile in aal2, 42501 otherwise), EXECUTE for influx_admin only.
--    It reads the two columns its owner holds since 0316 (SELECT (key, value)): who changed a setting
--    and when stay in audit.* (search.settings_changed), EC-L3G-08b-1, decided on 2026-11-21: no right
--    widened. No facet (Lot 5, modele -8), no other table, no write.
--
-- RIGHTS (03 I-4, signalled): EXECUTE on search.read_search_settings() to influx_admin. NO table nor
-- column GRANT to any role; the rows and the rights of search.search_settings untouched.
--
-- ROLLBACK: drop function search.read_search_settings() (nothing stored, no caller in base).
-- =============================================================================

-- 1. The reader of the admins, as influx_search_admin_definer (modele §7; 03 P7) --------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_search_admin_definer', current_user);
end
$$;
grant create on schema search to influx_search_admin_definer;
set role influx_search_admin_definer;

create or replace function search.read_search_settings()
returns table (
  key    text,
  value  jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform search.require_search_admin();

  return query
  select s.key, s.value
    from search.search_settings s
   order by s.key;
end
$$;

comment on function search.read_search_settings() is
  '04 §5.5, 10 RG2 (l3g/modele.md §7; 0333): the search settings for the settings screen of the '
  'admins: (key, value) of each of the ten keys, ordered by key. Who changed a key and when stay in '
  'audit.* (search.settings_changed; EC-L3G-08b-1). No facet, no other table, no write. STABLE '
  'SECURITY DEFINER owned by influx_search_admin_definer, EXECUTE for influx_admin only; 42501 '
  'outside an active admin in aal2.';

revoke all on function search.read_search_settings()
  from public, anon, authenticated, service_role;
grant execute on function search.read_search_settings() to influx_admin;

reset role;
revoke create on schema search from influx_search_admin_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_search_admin_definer', current_user);
end
$$;

-- 2. End-state assertions (03 P7; fiche invariant 3; the stops of 08b.md) ----------------------------

do $$
declare
  c_fn constant regprocedure := 'search.read_search_settings()'::regprocedure;
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  v_bad  text;
begin
  -- owner, mode, volatility, empty search_path, static SQL
  if (select pg_catalog.pg_get_userbyid(p.proowner) from pg_catalog.pg_proc p where p.oid = c_fn)
       <> 'influx_search_admin_definer'
     or not (select p.prosecdef from pg_catalog.pg_proc p where p.oid = c_fn)
     or (select p.provolatile::text from pg_catalog.pg_proc p where p.oid = c_fn) <> 's'
     or (select p.proconfig from pg_catalog.pg_proc p where p.oid = c_fn)
          is distinct from array['search_path=""']
     or (select p.prosrc ~* c_dynamic from pg_catalog.pg_proc p where p.oid = c_fn)
     or (select p.prosrc not like '%search.require_search_admin()%'
           from pg_catalog.pg_proc p where p.oid = c_fn) then
    raise exception 'search.read_search_settings() must be SECURITY DEFINER, STABLE, owned by '
                    'influx_search_admin_definer, empty search_path, static, gated by its admin';
  end if;

  -- EXECUTE for influx_admin alone
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_admin');
  if v_bad is not null then
    raise exception 'search.read_search_settings() executable by: %', v_bad;
  end if;
  if not pg_catalog.has_function_privilege('influx_admin', c_fn, 'EXECUTE') then
    raise exception 'search.read_search_settings() is not executable by influx_admin';
  end if;

  -- 08b.md: no right of a login role on the settings; the owner keeps SELECT (key, value) of 0316
  select string_agg(r, ', ') into v_bad
    from unnest(array['influx_admin', 'influx_agent', 'influx_advertiser', 'influx_creator']) r
   where pg_catalog.has_table_privilege(r, 'search.search_settings',
                                        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
      or pg_catalog.has_any_column_privilege(r, 'search.search_settings', 'SELECT, INSERT, UPDATE');
  if v_bad is not null then
    raise exception 'search.search_settings reached by: %', v_bad;
  end if;
  if pg_catalog.has_column_privilege('influx_search_admin_definer', 'search.search_settings',
                                     'updated_at', 'SELECT')
     or pg_catalog.has_column_privilege('influx_search_admin_definer', 'search.search_settings',
                                        'updated_by_account_id', 'SELECT')
     or pg_catalog.has_column_privilege('influx_search_admin_definer', 'search.search_settings',
                                        'created_at', 'SELECT') then
    raise exception 'influx_search_admin_definer reads beyond (key, value) of search.search_settings';
  end if;

  -- the owner keeps no CREATE nor member
  if pg_catalog.has_schema_privilege('influx_search_admin_definer', 'search', 'CREATE')
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.roleid = 'influx_search_admin_definer'::regrole
                   and (m.inherit_option or m.set_option)) then
    raise exception 'influx_search_admin_definer left with a member or CREATE (03 P7)';
  end if;
end
$$;
