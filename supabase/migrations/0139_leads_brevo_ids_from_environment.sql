-- =============================================================================
-- 0139_leads_brevo_ids_from_environment
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, D68 (founder, 2026-10-17). The Brevo list and template ids may come from
-- the worker's environment: at start, before its first E-3 turn and under the motif
-- leads.drain_outbox (no new motif in 03 §P7), the worker hands the ids it was given
-- to the function below. The database stays the source of truth, read at every
-- consumption (05 RG37).
--
--   leads.apply_brevo_ids_from_environment(p_list_ids jsonb, p_template_ids jsonb)
--         merges the GIVEN sub-keys only (closed lists below), each a positive
--         integer, never NULL (an absent variable leaves the base alone, 05 RG163);
--         an unchanged key writes nothing; a changed key writes settings.changed
--         {key, from, to, reason_code 'environment'} on the subject of EC-J8-28 and
--         resets updated_by_account_id to NULL (no administrator wrote it). Returns
--         the keys changed, sorted. Any refusal: 22023 invalid_parameter_value.
--         SECURITY DEFINER owned by influx_leads_definer; EXECUTE for influx_worker ONLY.
--   influx_leads_definer  UPDATE (value, updated_by_account_id) on leads.sync_settings,
--         bounded by policy to brevo_list_ids and brevo_template_ids.
--
-- D67 (v): when the journal trigger on leads.sync_settings arrives, this function stops
-- writing settings.changed itself (one line per change, never two).
--
-- ROLLBACK (before any real use): drop function leads.apply_brevo_ids_from_environment(jsonb, jsonb);
-- drop policy sync_settings_leads_definer_update_brevo on leads.sync_settings;
-- revoke update on leads.sync_settings from influx_leads_definer.
-- =============================================================================

-- 1. The write right of the owner, bounded to the two Brevo keys --------------------------------------

grant update (value, updated_by_account_id) on leads.sync_settings to influx_leads_definer;

drop policy if exists sync_settings_leads_definer_update_brevo on leads.sync_settings;
create policy sync_settings_leads_definer_update_brevo on leads.sync_settings
  for update to influx_leads_definer
  using (key in ('brevo_list_ids', 'brevo_template_ids'))
  with check (key in ('brevo_list_ids', 'brevo_template_ids') and updated_by_account_id is null);

-- 2. The function ---------------------------------------------------------------------------------------

create or replace function leads.apply_brevo_ids_from_environment(
  p_list_ids      jsonb,
  p_template_ids  jsonb
)
returns text[]
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_list_keys     constant text[] := array['advertisers', 'creators'];
  c_template_keys constant text[] := array['account.welcome_advertiser', 'account.welcome_creator',
                                           'auth.email_changed_notice'];
  v_given     jsonb;
  v_allowed   text[];
  v_key       text;
  v_previous  jsonb;
  v_next      jsonb;
  v_changed   text[] := array[]::text[];
begin
  foreach v_key in array array['brevo_list_ids', 'brevo_template_ids'] loop
    v_given   := case v_key when 'brevo_list_ids' then p_list_ids else p_template_ids end;
    v_allowed := case v_key when 'brevo_list_ids' then c_list_keys else c_template_keys end;

    if v_given is null or pg_catalog.jsonb_typeof(v_given) <> 'object' then
      raise exception 'the % given must be an object', v_key using errcode = 'invalid_parameter_value';
    end if;
    -- a closed list of sub-keys, each a positive integer: never NULL (05 RG163)
    if exists (select 1 from pg_catalog.jsonb_each(v_given) e
                where not (e.key = any (v_allowed))
                   or pg_catalog.jsonb_typeof(e.value) <> 'number'
                   or (e.value #>> '{}')::numeric < 1
                   or (e.value #>> '{}')::numeric <> pg_catalog.floor((e.value #>> '{}')::numeric)) then
      raise exception 'the % given hold an unknown key or a value that is not a positive integer', v_key
        using errcode = 'invalid_parameter_value';
    end if;
    if v_given = '{}'::jsonb then
      continue;
    end if;

    select s.value into v_previous
      from leads.sync_settings s
     where s.key = v_key
       for update;
    if not found then
      raise exception '% is missing from leads.sync_settings', v_key
        using errcode = 'invalid_parameter_value';
    end if;

    v_next := v_previous || v_given;
    if v_next = v_previous then
      continue;
    end if;

    update leads.sync_settings
       set value = v_next, updated_by_account_id = null
     where key = v_key;

    -- last for this key: the chain lock is held until COMMIT (EC-J8-28: one stable uuid per key)
    perform audit.append('settings.changed', 'setting',
                         pg_catalog.md5('leads.sync_settings:' || v_key)::uuid,
                         pg_catalog.jsonb_build_object('key', v_key, 'from', v_previous, 'to', v_next,
                                                       'reason_code', 'environment'));
    v_changed := v_changed || v_key;
  end loop;
  return v_changed;
end
$$;

comment on function leads.apply_brevo_ids_from_environment(jsonb, jsonb) is
  'D68: the worker, at start, hands the Brevo ids of its environment. p_list_ids: {advertisers?, '
  'creators?}; p_template_ids: {account.welcome_advertiser?, account.welcome_creator?, '
  'auth.email_changed_notice?}; each a positive integer, only the GIVEN sub-keys are merged, never '
  'NULL (05 RG163). A changed key writes settings.changed {key, from, to, reason_code environment} on '
  'md5(''leads.sync_settings:'' || key)::uuid (EC-J8-28) and resets updated_by_account_id to NULL. '
  'Returns the keys changed, sorted. Refusal: 22023. SECURITY DEFINER owned by influx_leads_definer; '
  'EXECUTE for influx_worker ONLY.';

revoke all on function leads.apply_brevo_ids_from_environment(jsonb, jsonb) from public;
grant execute on function leads.apply_brevo_ids_from_environment(jsonb, jsonb) to influx_worker;

-- 3. Hand the function to its owner (03 P7 rule 5, window of 0004 §9) --------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
alter function leads.apply_brevo_ids_from_environment(jsonb, jsonb) owner to influx_leads_definer;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 4. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_fn   constant text := 'leads.apply_brevo_ids_from_environment(jsonb, jsonb)';
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

  -- the owner writes the value and its author, nothing else; no other role of ours writes
  if pg_catalog.has_column_privilege('influx_leads_definer', 'leads.sync_settings', 'key', 'UPDATE')
     or pg_catalog.has_table_privilege('influx_leads_definer', 'leads.sync_settings', 'INSERT')
     or pg_catalog.has_table_privilege('influx_leads_definer', 'leads.sync_settings', 'DELETE') then
    raise exception 'influx_leads_definer writes more than the value of leads.sync_settings';
  end if;
  if pg_catalog.has_any_column_privilege('influx_worker', 'leads.sync_settings', 'SELECT, INSERT, UPDATE') then
    raise exception 'influx_worker reaches leads.sync_settings directly';
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
