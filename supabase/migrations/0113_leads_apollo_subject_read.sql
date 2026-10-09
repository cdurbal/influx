-- =============================================================================
-- 0113_leads_apollo_subject_read
-- -----------------------------------------------------------------------------
-- Lot 1 / J6, commit 5. E-3 `leads.drain_outbox` (03 P7), the Apollo connector:
-- its own read, announced by 0112 ("Apollo reads what it needs by its own
-- function"), under the same motive, the same owner and the same caller as the
-- functions of 0111 and 0112.
--
--   leads.read_apollo_subject()  on an apollo_contact line in processing for THIS
--                                worker (55000 otherwise), the subject account's
--                                address, the company name of an advertiser
--                                profile (05 RG82: company identified), whether
--                                an opposition to prospection was ever recorded
--                                after the sign-up (RG83), and the Apollo contact
--                                id already known (contact_sync_states: update,
--                                never a duplicate).
--
-- Choices:
--   opposition  a refusal of commercial_prospection whose source is NOT the sign-up
--               form: an act of the person after the sign-up (account settings,
--               Apollo opt-out, Brevo webhook, backoffice, data request). Under
--               interet_legitime_avec_opposition it excludes for good (RG83), even
--               if a consent is granted again later. The unticked box of the
--               sign-up is no opposition: it is the absence of consent, which
--               consentement_requis alone refuses (CA45).
--   rights      none added: every column read here is already granted to
--               influx_leads_definer by 0111 (accounts.id, consent_events purpose,
--               granted, contact_sync_states) and 0112 (accounts.email,
--               consent_events.source, advertiser_profiles.legal_name).
--   nothing     of Apollo's own data is read or kept here (05 RG85): the contact id
--               is the only value that comes back from Apollo, written by 0111.
--
-- ROLLBACK (before any real processing): drop function leads.read_apollo_subject.
-- =============================================================================

create or replace function leads.read_apollo_subject(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  email                text,
  company              text,
  prospection_opposed  boolean,
  external_contact_id  text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line     record;
  v_account  uuid;
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker: the address is read for the call about to be
  -- made, never for a line of another instance or one taken back.
  select o.destination, o.subject_key
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_line.destination <> 'apollo_contact' then
    raise exception 'an Apollo line only: Brevo reads what it needs by its own function'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The account comes from the line, never from the caller; another kind of subject, or an
  -- unknown account, returns no row.
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account' then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;

  return query
  select a.email::text,
         p.legal_name,
         exists (select 1
                   from identity.consent_events e
                  where e.account_id = a.id
                    and e.purpose = 'commercial_prospection'
                    and not e.granted
                    and e.source <> 'signup_form'),
         s.external_contact_id
    from identity.accounts a
    left join profiles.advertiser_profiles p on p.account_id = a.id
    left join leads.contact_sync_states s
           on s.account_id = a.id and s.destination = 'apollo_contact'
   where a.id = v_account;
end
$$;

comment on function leads.read_apollo_subject(bigint, text) is
  'E-3 read of the Apollo connector (05 RG82, RG83), on an apollo_contact line in processing for '
  'p_worker only (55000 otherwise; 22023 for another destination): the address, the company name of '
  'an advertiser profile, whether an opposition to prospection was recorded after the sign-up (a '
  'refusal of commercial_prospection from another source than the sign-up form), and the Apollo '
  'contact id already known. No row for a subject that is not an existing account. SECURITY DEFINER '
  'owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_apollo_subject(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_apollo_subject(bigint, text) to influx_worker;

-- Hand the function to influx_leads_definer (03 P7 rule 5, window of 0004 §9) -----------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;

alter function leads.read_apollo_subject(bigint, text) owner to influx_leads_definer;

revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- End-state assertions ------------------------------------------------------------------------------

do $$
declare
  c_fn constant text := 'leads.read_apollo_subject(bigint, text)';
  v_bad  text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = c_fn::regprocedure) <> 'influx_leads_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_leads_definer, empty search_path', c_fn;
  end if;
  -- E-3: EXECUTE for influx_worker only, besides the owner; never PUBLIC
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_worker');
  if v_bad is not null then
    raise exception '% executable by: %', c_fn, v_bad;
  end if;

  -- influx_worker still holds no right on any table: the read goes through the function (03 P7)
  if pg_catalog.has_any_column_privilege('influx_worker', 'identity.accounts', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_worker', 'identity.consent_events', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_worker', 'leads.contact_sync_states', 'SELECT') then
    raise exception 'influx_worker holds a table right';
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
    raise exception 'influx_leads_definer left with CREATE on schema leads';
  end if;
end
$$;
