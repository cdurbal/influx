-- =============================================================================
-- 0133_backoffice_account_search_journal
-- -----------------------------------------------------------------------------
-- Lot 1 / J8, commit 5. The partial search of member accounts of the backoffice v0
-- (05 RG98, 15 RG50, CA30; 17b §1.5): "limitée en débit et journalisée, afin qu'une
-- extraction massive de la base par l'interface soit détectable".
--
--   backoffice.reserve_account_search(p_term_length)  called by apps/api BEFORE each
--         partial search (every page of it): an active agent or admin in aal2, at most
--         20 partial searches per sliding 15 minutes and per internal account, counted
--         in the register itself under a per-caller transaction lock (two parallel
--         searches never both take the last place). Within the limit: one register line
--         accounts.searched_partial {outcome: performed, term_length}, true. Beyond: one
--         line {outcome: refused, term_length}, false, and apps/api answers 429 after
--         COMMIT (the refusal is a trace of abuse, it must stay).
--
-- The line never carries the search term: a fragment of an address is personal data, and
-- the register is append-only (no erasure possible). Its length is enough to tell a
-- browsing from a sweep. The subject is the internal account that searched: its history
-- (EC-31, admin) shows its searches.
--
-- The search by EXACT address is free (RG98) and journals nothing here; the opening of an
-- account record is journaled by backoffice.read_subject_history() (0132, history.
-- account_read), which every GET /v1/bo/accounts/:id calls (EC-J8-24).
--
-- EC-J8-25: the limit (20 / 15 min) is a constant of this function until
-- backoffice.operational_settings (0503, Lot 5) holds the values of 15 RG38.
--
-- ROLLBACK (before any real use): drop function backoffice.reserve_account_search(integer);
-- delete from audit.event_types where code = 'accounts.searched_partial' (possible only while
-- no line references it).
-- =============================================================================

-- 1. The register code -------------------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 05 RG98, 15 RG50: a partial search of member accounts, performed or refused at the limit
  ('accounts.searched_partial', 'backoffice', 'account', 'sensitive')
on conflict (code) do nothing;

-- 2. backoffice.reserve_account_search() ---------------------------------------------------------

create or replace function backoffice.reserve_account_search(
  p_term_length  integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_limit   constant integer  := 20;
  c_window  constant interval := interval '15 minutes';
  v_caller  uuid := influx.current_account_id();
  v_role    identity.account_role := influx.current_account_role();
  v_count   integer;
begin
  if v_caller is null or v_role is null or v_role not in ('agent', 'admin')
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = v_role
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_term_length is null or p_term_length not between 1 and 254 then
    raise exception 'term length outside 1 to 254' using errcode = 'invalid_parameter_value';
  end if;

  -- one caller at a time: the count and the line it adds are one step
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('backoffice.account_search:' || v_caller::text, 0));

  -- served by audit_events_subject_idx (subject_type, subject_id, occurred_at desc)
  select count(*)::integer into v_count
    from audit.audit_events e
   where e.subject_type = 'account'
     and e.subject_id = v_caller
     and e.occurred_at > pg_catalog.now() - c_window
     and e.event_type = 'accounts.searched_partial'
     and e.payload ->> 'outcome' = 'performed';

  if v_count >= c_limit then
    perform audit.append('accounts.searched_partial', 'account', v_caller,
                         pg_catalog.jsonb_build_object('outcome', 'refused',
                                                       'term_length', p_term_length));
    return false;
  end if;

  perform audit.append('accounts.searched_partial', 'account', v_caller,
                       pg_catalog.jsonb_build_object('outcome', 'performed',
                                                     'term_length', p_term_length));
  return true;
end
$$;

comment on function backoffice.reserve_account_search(integer) is
  '05 RG98, 15 RG50, CA30: reserves ONE partial search of member accounts for the calling active '
  'agent or admin in aal2 (42501 otherwise): at most 20 per sliding 15 minutes (EC-J8-25), counted in '
  'the register under a per-caller transaction lock. Writes accounts.searched_partial {outcome: '
  'performed | refused, term_length} on the caller''s account and returns whether the search may run. '
  'Never the term itself (personal data in an append-only register). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_agent, influx_admin.';

-- 3. Publication ----------------------------------------------------------------------------------

revoke all on function backoffice.reserve_account_search(integer)
  from public, anon, authenticated, service_role;
grant execute on function backoffice.reserve_account_search(integer) to influx_agent, influx_admin;

-- 4. Hand the function to its owner (03 P7 rule 5, window of 0004 §9) --------------------------
-- influx_identity_definer already reads the caller check (0004, 0132) and audit.audit_events (0132
-- §11.1), and executes audit.append() (0006).

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;

alter function backoffice.reserve_account_search(integer) owner to influx_identity_definer;

revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  if not exists (select 1 from audit.event_types where code = 'accounts.searched_partial') then
    raise exception 'the code of 0133 is not in audit.event_types';
  end if;

  if (select r.rolname
        from pg_catalog.pg_proc f
        join pg_catalog.pg_roles r on r.oid = f.proowner
       where f.oid = 'backoffice.reserve_account_search(integer)'::regprocedure)
     is distinct from 'influx_identity_definer' then
    raise exception 'backoffice.reserve_account_search() is not owned by influx_identity_definer';
  end if;

  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_agent', 'influx_admin', 'influx_identity_definer')
     and pg_catalog.has_function_privilege(r.oid, 'backoffice.reserve_account_search(integer)',
                                           'EXECUTE');
  if v_bad is not null then
    raise exception 'unexpected EXECUTE on backoffice.reserve_account_search(): %', v_bad;
  end if;

  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_identity_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'function owner left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'influx_identity_definer kept CREATE on backoffice';
  end if;
end
$$;
