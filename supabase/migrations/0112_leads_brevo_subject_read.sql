-- =============================================================================
-- 0112_leads_brevo_subject_read
-- -----------------------------------------------------------------------------
-- Lot 1 / J6, commit 4. E-3 `leads.drain_outbox` (03 P7), the Brevo connectors:
-- the "own read" announced by 0111 for the mapping of the contact attributes
-- (16 §M4, EC-11) and the address of the welcome e-mail (05 RG86), under the
-- same motive, the same owner and the same caller as the four functions of 0111.
--
--   leads.read_brevo_subject()   on a brevo_contact or brevo_transactional line in
--                                processing for THIS worker (55000 otherwise),
--                                the subject account's address, sign-up instant,
--                                company name (advertiser profile), acquisition
--                                source (EC-11), the marketing consent in force
--                                (instant, source) and whether the welcome e-mail
--                                of the line's code is already journaled.
--
-- Also: the local belt of 16 RG90 for the e-mails "once by nature" of the queue,
-- a unique index on (account_id, email_code) of leads.transactional_sends for the
-- two welcome e-mails (05 RG76: once per account, replay included).
--
-- Choices:
--   address   read at the call, never kept by the queue (05 RG74); the read is a
--             privileged read of an address: apps/api writes the register line
--             elevated.leads.drain_outbox on the account (CLAUDE.md §5 rule 5).
--   Apollo    not here: commit 5 reads what Apollo needs by its own function, with
--             its own qualification (RG82), so that neither reads the other's fields.
--   consent   the instant and source of the marketing_email consent IN FORCE, null
--             when the latest event is a refusal (RG37: read at consumption).
--
-- ROLLBACK (before any real processing): drop function leads.read_brevo_subject;
-- drop index leads.transactional_sends_once_per_account_idx; drop the policies
-- advertiser_profiles_leads_definer_select and
-- transactional_sends_leads_definer_select; revoke the column grants added below
-- and usage on schema profiles from influx_leads_definer.
-- =============================================================================

-- 1. The local belt of 16 RG90 ---------------------------------------------------------------------

create unique index if not exists transactional_sends_once_per_account_idx
  on leads.transactional_sends (account_id, email_code)
  where email_code in ('account.welcome_advertiser', 'account.welcome_creator');
comment on index leads.transactional_sends_once_per_account_idx is
  '16 RG90, 05 RG76: one welcome e-mail per account and per role, whatever the replays. The local '
  'constraint we count on; the Idempotency-Key sent to Brevo is the second belt.';

-- 2. The read ----------------------------------------------------------------------------------------

create or replace function leads.read_brevo_subject(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  email            text,
  signed_up_at     timestamptz,
  company          text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  referrer_domain  text,
  heard_from       text,
  consent_at       timestamptz,
  consent_source   text,
  welcome_sent     boolean
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
  select o.destination, o.subject_key, o.payload
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  if v_line.destination not in ('brevo_contact', 'brevo_transactional') then
    raise exception 'a Brevo line only: Apollo reads what it needs by its own function'
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
         a.created_at,
         p.legal_name,
         a.signup_utm_source,
         a.signup_utm_medium,
         a.signup_utm_campaign,
         a.signup_referrer_domain,
         a.signup_heard_from::text,
         case when c.granted then c.occurred_at end,
         case when c.granted then c.source::text end,
         (v_line.payload ->> 'email_code') is not null
           and exists (select 1
                         from leads.transactional_sends t
                        where t.account_id = a.id
                          and t.email_code = (v_line.payload ->> 'email_code'))
    from identity.accounts a
    left join profiles.advertiser_profiles p on p.account_id = a.id
    left join lateral (
          -- RG37: the consent in force, its latest event; a refusal wins a tie
          select e.granted, e.occurred_at, e.source
            from identity.consent_events e
           where e.account_id = a.id and e.purpose = 'marketing_email'
           order by e.occurred_at desc, e.granted
           limit 1) c on true
   where a.id = v_account;
end
$$;

comment on function leads.read_brevo_subject(bigint, text) is
  'E-3 read of the Brevo connectors (16 §M4, EC-11; 05 RG86), on a brevo_contact or '
  'brevo_transactional line in processing for p_worker only (55000 otherwise; 22023 for another '
  'destination): the address, sign-up instant, company name of an advertiser profile, acquisition '
  'source, instant and source of the marketing_email consent in force (null when refused), and '
  'whether the welcome e-mail of the line''s code is already journaled (16 RG90). No row for a '
  'subject that is not an existing account. SECURITY DEFINER owned by influx_leads_definer, empty '
  'search_path; EXECUTE for influx_worker ONLY.';

revoke all on function leads.read_brevo_subject(bigint, text)
  from public, anon, authenticated, service_role;
grant execute on function leads.read_brevo_subject(bigint, text) to influx_worker;

-- 3. Rights of the owner: what the read reads, column by column ------------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner
-- (identity.accounts and identity.consent_events have theirs since 0111).

grant select (email, created_at, signup_utm_source, signup_utm_medium, signup_utm_campaign,
              signup_referrer_domain, signup_heard_from)
   on identity.accounts to influx_leads_definer;

grant select (source) on identity.consent_events to influx_leads_definer;

grant usage on schema profiles to influx_leads_definer;
grant select (account_id, legal_name) on profiles.advertiser_profiles to influx_leads_definer;

drop policy if exists advertiser_profiles_leads_definer_select on profiles.advertiser_profiles;
create policy advertiser_profiles_leads_definer_select on profiles.advertiser_profiles
  for select to influx_leads_definer
  using (true);

-- the journal: whether an e-mail of the queue already left, never its recipient nor its content
grant select (account_id, email_code) on leads.transactional_sends to influx_leads_definer;

drop policy if exists transactional_sends_leads_definer_select on leads.transactional_sends;
create policy transactional_sends_leads_definer_select on leads.transactional_sends
  for select to influx_leads_definer
  using (priority = 'p1');

-- 4. Hand the function to influx_leads_definer (03 P7 rule 5, window of 0004 §9) ---------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;

alter function leads.read_brevo_subject(bigint, text) owner to influx_leads_definer;

revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 5. End-state assertions ----------------------------------------------------------------------------

do $$
declare
  c_fn constant text := 'leads.read_brevo_subject(bigint, text)';
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
     or pg_catalog.has_any_column_privilege('influx_worker', 'profiles.advertiser_profiles', 'SELECT')
     or pg_catalog.has_any_column_privilege('influx_worker', 'leads.transactional_sends', 'SELECT') then
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
