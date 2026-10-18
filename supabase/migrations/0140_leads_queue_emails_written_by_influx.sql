-- =============================================================================
-- 0140_leads_queue_emails_written_by_influx
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, D69 (founder, 2026-10-18). Every queue e-mail is WRITTEN BY INFLUX from
-- its translation files and Brevo only carries it (16 RG67), as 0128 did for
-- privacy.request_received: account.welcome_advertiser, account.welcome_creator and
-- auth.email_changed_notice leave EC-8. No Brevo template id is read any more.
--
--   leads.sync_settings  brevo_template_ids is emptied ({}): the key stays in the
--         closed list (its shape allows an empty object), nothing reads it.
--   leads.apply_brevo_ids_from_environment()  recreated with the list ids only
--         (D68 amended by D69): the template variables of the worker are gone.
--   influx_leads_definer  its update policy is bounded to brevo_list_ids.
--
-- ROLLBACK (before any real use): recreate the function and the policy as in 0139;
-- put back the three keys (null) in brevo_template_ids.
-- =============================================================================

-- 1. The three template ids leave the settings -------------------------------------------------------

update leads.sync_settings
   set value = '{}'::jsonb, updated_by_account_id = null
 where key = 'brevo_template_ids'
   and value <> '{}'::jsonb;

-- 2. The owner writes the list ids only --------------------------------------------------------------

drop policy if exists sync_settings_leads_definer_update_brevo on leads.sync_settings;
create policy sync_settings_leads_definer_update_brevo on leads.sync_settings
  for update to influx_leads_definer
  using (key = 'brevo_list_ids')
  with check (key = 'brevo_list_ids' and updated_by_account_id is null);

-- 3. The function, list ids only ----------------------------------------------------------------------

drop function if exists leads.apply_brevo_ids_from_environment(jsonb, jsonb);

create function leads.apply_brevo_ids_from_environment(p_list_ids jsonb)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_list_keys constant text[] := array['advertisers', 'creators'];
  v_previous  jsonb;
  v_next      jsonb;
begin
  if p_list_ids is null or pg_catalog.jsonb_typeof(p_list_ids) <> 'object' then
    raise exception 'the brevo_list_ids given must be an object' using errcode = 'invalid_parameter_value';
  end if;
  -- a closed list of sub-keys, each a positive integer: never NULL (05 RG163)
  if exists (select 1 from pg_catalog.jsonb_each(p_list_ids) e
              where not (e.key = any (c_list_keys))
                 or pg_catalog.jsonb_typeof(e.value) <> 'number'
                 or (e.value #>> '{}')::numeric < 1
                 or (e.value #>> '{}')::numeric <> pg_catalog.floor((e.value #>> '{}')::numeric)) then
    raise exception 'the brevo_list_ids given hold an unknown key or a value that is not a positive integer'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_list_ids = '{}'::jsonb then
    return array[]::text[];
  end if;

  select s.value into v_previous
    from leads.sync_settings s
   where s.key = 'brevo_list_ids'
     for update;
  if not found then
    raise exception 'brevo_list_ids is missing from leads.sync_settings'
      using errcode = 'invalid_parameter_value';
  end if;

  v_next := v_previous || p_list_ids;
  if v_next = v_previous then
    return array[]::text[];
  end if;

  update leads.sync_settings
     set value = v_next, updated_by_account_id = null
   where key = 'brevo_list_ids';

  -- last: the chain lock is held until COMMIT (EC-J8-28: one stable uuid per key)
  perform audit.append('settings.changed', 'setting',
                       pg_catalog.md5('leads.sync_settings:brevo_list_ids')::uuid,
                       pg_catalog.jsonb_build_object('key', 'brevo_list_ids', 'from', v_previous,
                                                     'to', v_next, 'reason_code', 'environment'));
  return array['brevo_list_ids'];
end
$$;

comment on function leads.apply_brevo_ids_from_environment(jsonb) is
  'D68, amended by D69: the worker, at start, hands the Brevo list ids of its environment. '
  'p_list_ids: {advertisers?, creators?}, each a positive integer; only the GIVEN sub-keys are '
  'merged, never NULL (05 RG163). A change writes settings.changed {key, from, to, reason_code '
  'environment} on md5(''leads.sync_settings:brevo_list_ids'')::uuid (EC-J8-28) and resets '
  'updated_by_account_id to NULL. Returns the keys changed. Refusal: 22023. SECURITY DEFINER owned '
  'by influx_leads_definer; EXECUTE for influx_worker ONLY.';

revoke all on function leads.apply_brevo_ids_from_environment(jsonb) from public;
grant execute on function leads.apply_brevo_ids_from_environment(jsonb) to influx_worker;

-- 4. Hand the function to its owner (03 P7 rule 5, window of 0004 §9) --------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
alter function leads.apply_brevo_ids_from_environment(jsonb) owner to influx_leads_definer;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 5. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_fn   constant text := 'leads.apply_brevo_ids_from_environment(jsonb)';
  v_bad  text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = v_fn::regprocedure) <> 'influx_leads_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_leads_definer, empty search_path', v_fn;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = v_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_worker');
  if v_bad is not null then
    raise exception '% executable by: %', v_fn, v_bad;
  end if;
  if exists (select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'leads' and p.proname = 'apply_brevo_ids_from_environment'
                and p.oid <> v_fn::regprocedure) then
    raise exception 'the two-argument apply_brevo_ids_from_environment survived';
  end if;
  if (select value from leads.sync_settings where key = 'brevo_template_ids') <> '{}'::jsonb then
    raise exception 'brevo_template_ids still names a Brevo template';
  end if;

  -- no usable member left on the owner (C-9: the ADMIN-only migration role)
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_leads_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE') then
    raise exception 'influx_leads_definer kept CREATE on leads';
  end if;
end
$$;
