-- =============================================================================
-- 0119_identity_member_consent
-- -----------------------------------------------------------------------------
-- Lot 1 / J7, commit 2. EC-10 and CA47: consent.granted / consent.revoked for the
-- changes made after the sign-up, from the member space (05 RG34, RG35, RG73, RG78,
-- RG92, RG94; the route PUT /v1/me/consent comes at commit 6).
--
--   identity.set_marketing_consent()  the ONLY door to a member's consent after the
--         sign-up: the consent event (source account_settings) and its queue facts in
--         the SAME transaction (RG73) - consent.revoked priority 0 to Brevo and Apollo
--         (RG78, RG92: effective at once in INFLUX, recorded even if the propagation
--         fails), consent.granted priority 100. No change, no line.
--
-- The direct INSERT that 0005 gave the members on identity.consent_events is
-- REVOKED: a consent written without its queue fact would never reach Brevo nor
-- Apollo (RG73 held by the database rather than by a convention). Reads unchanged.
-- RG35 and RG94 hold by construction: no transactional purpose exists (0005), and the
-- function touches neither the account nor a session.
--
-- ROLLBACK: drop function identity.set_marketing_consent(identity.consent_purpose,
-- boolean, jsonb); re-grant insert (account_id, purpose, granted, source, evidence) on
-- identity.consent_events to influx_advertiser, influx_creator and re-create the policy
-- consent_events_member_insert_own of 0005 §5.3; drop the policies
-- consent_events_identity_definer_insert_settings and
-- consent_events_identity_definer_select; revoke select (account_id, purpose, granted,
-- occurred_at) on identity.consent_events from influx_identity_definer; restore the
-- 0118 policy outbox_events_identity_definer_insert.
-- =============================================================================

-- 1. The function -----------------------------------------------------------------------------

create or replace function identity.set_marketing_consent(
  p_purpose   identity.consent_purpose,
  p_granted   boolean,
  p_evidence  jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_current  boolean;
  v_fact     uuid := pg_catalog.gen_random_uuid();
  v_type     text;
begin
  if v_account is null or influx.current_account_role() is null
     or influx.current_account_role() not in ('advertiser', 'creator') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_purpose is null or p_granted is null then
    raise exception 'a purpose and a value are required' using errcode = 'invalid_parameter_value';
  end if;
  -- 0005: identifiers and codes only (form version, wording key, locale), never an address
  if p_evidence is null or pg_catalog.jsonb_typeof(p_evidence) <> 'object'
     or pg_catalog.pg_column_size(p_evidence) > 1000
     or pg_catalog.strpos(p_evidence::text, '@') > 0 then
    raise exception 'evidence is a small object of codes' using errcode = 'invalid_parameter_value';
  end if;

  -- One change at a time per account: the row lock serialises two clicks.
  perform 1 from identity.accounts a where a.id = v_account and a.status = 'active' for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- RG37: the consent in force is the latest event of the purpose; a refusal wins a tie.
  select c.granted
    into v_current
    from identity.consent_events c
   where c.account_id = v_account and c.purpose = p_purpose
   order by c.occurred_at desc, c.granted
   limit 1;
  -- no event at all means no consent: withdrawing it changes nothing
  if coalesce(v_current, false) = p_granted then
    return false;
  end if;

  insert into identity.consent_events (account_id, purpose, granted, source, evidence)
  values (v_account, p_purpose, p_granted, 'account_settings', p_evidence);

  -- RG73, RG78: the fact and its queue lines together; a withdrawal passes ahead of the queue.
  v_type := case when p_granted then 'consent.granted' else 'consent.revoked' end;
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_fact, v_type, d.destination, 'account:' || v_account::text,
         case when p_granted then 100 else 0 end,
         pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account,
                                       'purpose', p_purpose),
         v_type || ':' || v_fact::text
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);
  return true;
end
$$;

comment on function identity.set_marketing_consent(identity.consent_purpose, boolean, jsonb) is
  'EC-10, 05 RG34, RG73, RG78, RG92: an advertiser or creator gives or withdraws one consent '
  '(marketing_email or commercial_prospection) from his account settings, in one gesture. In one '
  'transaction: the event (source account_settings, occurred_at = now(), evidence = codes only) and '
  'consent.revoked (priority 0) or consent.granted (priority 100) to brevo_contact and '
  'apollo_contact, payload = ids and the purpose. Returns false when the value in force is already '
  'the requested one (no event, no line; no event at all = no consent). No effect on the account, '
  'the sessions nor the transactional e-mails (RG35, RG94). 22023 for a malformed value, 42501 '
  'outside an active member account. SECURITY DEFINER owned by influx_identity_definer, empty '
  'search_path; EXECUTE for influx_advertiser and influx_creator.';

revoke all on function identity.set_marketing_consent(identity.consent_purpose, boolean, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function identity.set_marketing_consent(identity.consent_purpose, boolean, jsonb)
   to influx_advertiser, influx_creator;

-- 2. Rights ---------------------------------------------------------------------------------------

-- 2.1 Members: the function is the only door (RG73); their history stays readable (0005) ---------

revoke insert on identity.consent_events from influx_advertiser, influx_creator;
drop policy if exists consent_events_member_insert_own on identity.consent_events;

-- 2.2 The owner -------------------------------------------------------------------------------------

grant select (account_id, purpose, granted, occurred_at)
   on identity.consent_events to influx_identity_definer;

drop policy if exists consent_events_identity_definer_select on identity.consent_events;
create policy consent_events_identity_definer_select on identity.consent_events
  for select to influx_identity_definer
  using (true);

-- the insert columns of 0106 suffice; one more policy, for the account settings
drop policy if exists consent_events_identity_definer_insert_settings on identity.consent_events;
create policy consent_events_identity_definer_insert_settings on identity.consent_events
  for insert to influx_identity_definer
  with check (source = 'account_settings' and recorded_by_account_id is null
              and occurred_at = now()
              and account_id = (select influx.current_account_id()));

drop policy if exists outbox_events_identity_definer_insert on leads.outbox_events;
create policy outbox_events_identity_definer_insert on leads.outbox_events
  for insert to influx_identity_definer
  with check (status = 'pending' and attempts = 0
              and event_type in ('lead.created', 'lead.updated', 'account.email_corrected',
                                 'email.changed', 'consent.granted', 'consent.revoked'));

-- 3. Hand the function to influx_identity_definer (03 P7 rule 5, window of 0004 §9) ---------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema identity to influx_identity_definer;

alter function identity.set_marketing_consent(identity.consent_purpose, boolean, jsonb)
  owner to influx_identity_definer;

revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 4. End-state assertions ----------------------------------------------------------------------------

do $$
declare
  c_fn  constant text := 'identity.set_marketing_consent(identity.consent_purpose, boolean, jsonb)';
  v_bad text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = c_fn::regprocedure) <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = c_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = c_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_identity_definer, empty search_path', c_fn;
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = c_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_advertiser', 'influx_creator'));
  if v_bad is not null then
    raise exception '% executable by: %', c_fn, v_bad;
  end if;

  -- RG73: no execution role writes a consent event directly any more
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops')
     and (pg_catalog.has_any_column_privilege(r.oid, 'identity.consent_events', 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'identity.consent_events', 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'execution role(s) may write identity.consent_events: %', v_bad;
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
