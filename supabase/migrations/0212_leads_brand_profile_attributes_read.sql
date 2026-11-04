-- =============================================================================
-- 0212_leads_brand_profile_attributes_read
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 10 (jalons/l2c/10.md; fiche invariants 8, 9, 15; 06 RG79 to RG81, CA40 to CA42;
-- 16 §M4). The worker's own read of what a brand profile adds to its Brevo and Apollo contacts: the
-- connectors of profile.completed and lead.updated need the profile, and influx_leads_definer reads
-- nothing of it but the trading name (0112). No connector, no TypeScript of the worker here.
--
--   leads.read_brand_profile_attributes(outbox, worker)   E-3, modelled on read_apollo_subject() (0113)
--         and read_brevo_profile_decision() (0211): on a line of brevo_contact or apollo_contact in
--         processing for THIS worker only, for the advertiser account the line names: the state of
--         the profile, the stored completeness, the main sector, the company size band, the website
--         domain, the first topic and the target markets (in order), and whether the profile was
--         ever published. The LIVE row only (06 RG9): a modification waiting in the review keeps
--         the validated value. Never the legal name (EC-L2C-3: the trading name travels by the
--         subject reads), the presentation, the contact person, the registration number, the
--         notes, a budget (none exists, D48) nor a badge (L2E). No row for a creator, an account
--         without a profile, or an erased account.
--         SECURITY DEFINER owned by influx_leads_definer, EXECUTE for influx_worker ONLY.
--   influx_leads_definer   SELECT on six columns of profiles.advertiser_profiles (its policy exists
--         since 0112), on (account_id, slot, topic_code) of profiles.advertiser_topics and on
--         (account_id, slot, country_code) of profiles.advertiser_target_markets, each policy limited
--         to an account not erased; no INSERT, no UPDATE, no other column.
--
-- EC-L2C-10 (micro-gaps, the safest choice):
--   EC-L2C-10-1  0212 is the next free number (ls supabase/migrations).
--   EC-L2C-10-2  one function for both connectors (Brevo and Apollo read the same facts); a line of
--                another destination is 22023, a subject key that is not an account or an unknown
--                account gives no row, as the subject reads do.
--   EC-L2C-10-3  the status is returned as stored (draft, pending_review, published, rejected,
--                suspended); a revision under review leaves it published (A2).
--   EC-L2C-10-4  the first topic (slot 1) answers the "main topic" of 16 §M4 for a brand; the sector
--                has its own attribute.
--
-- ROLLBACK (before any contact carries these attributes): drop function
-- leads.read_brand_profile_attributes(bigint, text); drop policy
-- advertiser_topics_leads_definer_select on profiles.advertiser_topics and
-- advertiser_target_markets_leads_definer_select on profiles.advertiser_target_markets; revoke select
-- (status, completeness_percent, primary_sector_code, company_size_band, website_domain,
-- first_published_at) on profiles.advertiser_profiles, select (account_id, slot, topic_code) on
-- profiles.advertiser_topics and select (account_id, slot, country_code) on
-- profiles.advertiser_target_markets from influx_leads_definer.
-- =============================================================================

-- 1. What the read reads (03 P7: column by column, with its policy) --------------------------------
-- The three tables are FORCE ROW LEVEL SECURITY (0106, 0202): the right comes with its policy TO the
-- owner. advertiser_profiles_leads_definer_select (0112) already covers the profile row; USAGE on
-- profiles since 0112; identity.accounts (id, status) and its policy since 0111.

grant select (status, completeness_percent, primary_sector_code, company_size_band, website_domain,
              first_published_at)
   on profiles.advertiser_profiles to influx_leads_definer;

grant select (account_id, slot, topic_code) on profiles.advertiser_topics to influx_leads_definer;
grant select (account_id, slot, country_code) on profiles.advertiser_target_markets
   to influx_leads_definer;

drop policy if exists advertiser_topics_leads_definer_select on profiles.advertiser_topics;
create policy advertiser_topics_leads_definer_select on profiles.advertiser_topics
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = advertiser_topics.account_id and a.status <> 'deleted'));

drop policy if exists advertiser_target_markets_leads_definer_select
  on profiles.advertiser_target_markets;
create policy advertiser_target_markets_leads_definer_select on profiles.advertiser_target_markets
  for select to influx_leads_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = advertiser_target_markets.account_id and a.status <> 'deleted'));

-- 2. The read (E-3) ------------------------------------------------------------------------------------

drop function if exists leads.read_brand_profile_attributes(bigint, text);

create function leads.read_brand_profile_attributes(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  profile_status       text,
  completeness_percent integer,
  primary_sector_code  text,
  company_size_band    text,
  website_domain       text,
  main_topic_code      text,
  target_markets       text,
  ever_published       boolean
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
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Only a line in processing for THIS worker: the profile is read for the call about to be made,
  -- never for a line of another instance or one taken back.
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
  if v_line.destination not in ('brevo_contact', 'apollo_contact') then
    raise exception 'a contact line of Brevo or Apollo only'
      using errcode = 'invalid_parameter_value';
  end if;

  -- The account comes from the line, never from the caller
  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or pg_catalog.split_part(v_line.subject_key, ':', 2) !~ c_uuid then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;

  return query
  select p.status::text,
         p.completeness_percent::integer,
         p.primary_sector_code,
         p.company_size_band,
         p.website_domain,
         (select t.topic_code
            from profiles.advertiser_topics t
           where t.account_id = p.account_id
           order by t.slot
           limit 1),
         coalesce((select pg_catalog.string_agg(m.country_code::text, ',' order by m.slot)
                     from profiles.advertiser_target_markets m
                    where m.account_id = p.account_id),
                  ''),
         p.first_published_at is not null
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.account_id = v_account
     and a.status <> 'deleted';
end
$$;

comment on function leads.read_brand_profile_attributes(bigint, text) is
  'E-3 read of the brand attributes of a Brevo or Apollo contact (06 RG79 to RG81, CA40 to CA42; 16 '
  '§M4; 0212), on a line of brevo_contact or apollo_contact in processing for p_worker only (55000 '
  'otherwise; 22023 for another destination): the state, the stored completeness, the main sector, '
  'the company size band, the website domain, the first topic, the target markets (ISO codes in slot order, comma-separated, empty when none) and whether the '
  'profile was ever published, from the LIVE row (06 RG9). Never the legal name, the presentation, '
  'the contact person, a registration number, a note, a budget nor a badge. No row for an account '
  'without a brand profile or an erased account. SECURITY DEFINER owned by influx_leads_definer, '
  'empty search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_brand_profile_attributes(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brand_profile_attributes(bigint, text) to influx_worker;

-- Hand the function to influx_leads_definer (03 P7 rule 5, window of 0004 §9)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;

alter function leads.read_brand_profile_attributes(bigint, text) owner to influx_leads_definer;

revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 3. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_fn   constant text := 'leads.read_brand_profile_attributes(bigint, text)';
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

  -- the read reaches the listed columns, never the presentation, the contact person nor the logo
  select string_agg(c.attname, ', ') into v_bad
    from pg_catalog.pg_attribute c
   where c.attrelid = 'profiles.advertiser_profiles'::regclass
     and c.attnum > 0 and not c.attisdropped
     and c.attname not in ('account_id', 'legal_name', 'status', 'completeness_percent',
                           'primary_sector_code', 'company_size_band', 'website_domain',
                           'first_published_at')
     and pg_catalog.has_column_privilege('influx_leads_definer', c.attrelid, c.attname,
                                         'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'influx_leads_definer reaches advertiser_profiles.%', v_bad;
  end if;
  select string_agg(c.attname, ', ') into v_bad
    from pg_catalog.pg_attribute c
   where c.attrelid = 'profiles.advertiser_topics'::regclass
     and c.attnum > 0 and not c.attisdropped
     and c.attname not in ('account_id', 'slot', 'topic_code')
     and pg_catalog.has_column_privilege('influx_leads_definer', c.attrelid, c.attname,
                                         'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'influx_leads_definer reaches advertiser_topics.%', v_bad;
  end if;
  select string_agg(c.attname, ', ') into v_bad
    from pg_catalog.pg_attribute c
   where c.attrelid = 'profiles.advertiser_target_markets'::regclass
     and c.attnum > 0 and not c.attisdropped
     and c.attname not in ('account_id', 'slot', 'country_code')
     and pg_catalog.has_column_privilege('influx_leads_definer', c.attrelid, c.attname,
                                         'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'influx_leads_definer reaches advertiser_target_markets.%', v_bad;
  end if;
  if pg_catalog.has_any_column_privilege('influx_leads_definer', 'profiles.advertiser_profiles',
                                         'INSERT, UPDATE')
     or pg_catalog.has_any_column_privilege('influx_leads_definer', 'profiles.advertiser_topics',
                                            'INSERT, UPDATE')
     or pg_catalog.has_any_column_privilege('influx_leads_definer',
                                            'profiles.advertiser_target_markets', 'INSERT, UPDATE') then
    raise exception 'influx_leads_definer writes a brand profile table';
  end if;
  if pg_catalog.has_any_column_privilege('influx_leads_definer', 'profiles.advertiser_contact_details',
                                         'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_leads_definer reaches the contact person of a brand';
  end if;

  -- influx_worker still holds no right on the profile: the read goes through the function (03 P7)
  if pg_catalog.has_any_column_privilege('influx_worker', 'profiles.advertiser_profiles',
                                         'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_any_column_privilege('influx_worker', 'profiles.advertiser_topics',
                                            'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_any_column_privilege('influx_worker', 'profiles.advertiser_target_markets',
                                            'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_worker holds a right on a brand profile table';
  end if;

  -- no usable member left on the owner (C-9: the ADMIN-only migration role), no CREATE kept
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
    raise exception 'a function owner left with CREATE on its schema';
  end if;
end
$$;
