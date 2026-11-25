-- =============================================================================
-- 0209_profiles_brand_freeze_and_revision_door
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 06 (jalons/l2c/file.md A3, A4, D81; 04 §5.2; 06 RG9, CA15, CA16; L2BS-1). A
-- member cannot, around the API, write a moderated field of a published profile nor anything of a
-- suspended one; on a published profile a moderated change waits in profile_field_revisions and the
-- live row keeps the validated version. No decision here (07), no route (13).
--
--   profiles.guard_advertiser_member_write()   BEFORE trigger, SECURITY INVOKER, on the profile, the
--         eight lists, the contact person and the logo rows. When current_user is influx_advertiser
--         or influx_identity_definer: `suspended` refuses every write, `published` refuses the
--         change of an active moderated column (and any move of a logo into or out of `active`),
--         55000 with the field code as DETAIL. Other writers (the erasure, the purge, the decisions
--         of 07) are not members. On a list, the contact person and a logo it holds the profile row
--         FOR SHARE, so a write and a decision are serial: the decision recomputes the token after
--         such a write has committed (file.md A3).
--   profiles.moderated_field_is_active(code)   what the guard asks, the brand reading no catalogue.
--   profiles.submit_own_advertiser_revision(field, value)   the member door of RG9: on a published
--         profile, a change is deposited or replaces the pending one (superseded), the entry of
--         queue 1 is created or joined; the validated value withdraws it, the entry too when nothing
--         is left. Type and required checked here, column constraints at the approval (07).
--   profiles.record_own_advertiser_profile_change()   lead.updated when published (called by 13).
--   profiles.activate_brand_logo(), remove_own_brand_logo()   recreated: on a published profile the
--         new object goes `in_review` and is proposed, the removal is proposed, the active logo
--         stays and no purge of it before the decision. Other states: as in 0204.
--   identity.update_own_account()   recreated: on a published profile the company name goes through
--         the door (no lead.updated: the validated name did not change). Other states: as in 0122,
--         a suspended profile refused by the guard.
--   influx_maintenance_definer   sees and moves `pending` and `purging` rows only (0205 said "not
--         active", which would have reached `in_review`).
--
-- EC-L2C-06 (micro-gaps, the safest choice):
--   EC-L2C-06-1  the enum value has its own file, 0208 (see that file); 0209 is the next number.
--   EC-L2C-06-2  moderated_field_is_active() is a SECURITY DEFINER added to file.md A4: the guard
--                is invoker (it reads current_user) and the brand reads no catalogue (test of 05,
--                expectation unchanged). It answers a boolean on a code, nothing else.
--   EC-L2C-06-3  the door answers (NULL, NULL) when nothing changes (the validated value and nothing
--                pending), ('pending_review', entry) without any write for the value already pending.
--   EC-L2C-06-4  a value equal to the validated one on an entry `submission` closes nothing: only a
--                `revision` entry is withdrawn by the door (a submission has no revision to lose).
--   EC-L2C-06-5  a logo proposal names an own `in_review` or `active` row; any other row is refused
--                (22023). The door purges an `in_review` row it no longer proposes, for a member
--                calling it directly; the two logo doors purge it first, to return its key.
--   EC-L2C-06-6  update_own_account() also returns true for a name deposited or withdrawn.
--   EC-L2C-06-7  a country stays a member write on a suspended profile: it lives on the account, and
--                file.md A4 names the company name only.
--
-- ROLLBACK (before any revision is written): drop the triggers advertiser_member_write_guard and
-- function profiles.guard_advertiser_member_write(); recreate profiles.activate_brand_logo() and
-- remove_own_brand_logo() as in 0204 and identity.update_own_account() as in 0122 (as
-- influx_identity_definer); drop function profiles.submit_own_advertiser_revision(text, jsonb),
-- profiles.record_own_advertiser_profile_change(), profiles.moderated_field_is_active(text); recreate
-- the two policies brand_logo_objects_maintenance_definer_select and _update as in 0205; drop index
-- brand_logo_objects_one_in_review and constraint brand_logo_objects_in_review_stored; drop the
-- policies and revoke the grants of section 3; delete the two codes from audit.event_types (possible
-- only while no line references them).
-- =============================================================================

-- 1. The logo under review (file.md A4) ---------------------------------------------------------

alter table profiles.brand_logo_objects
  drop constraint if exists brand_logo_objects_in_review_stored,
  -- stored and described, never yet activated: the decision (07) dates its activation
  add constraint brand_logo_objects_in_review_stored
    check (state <> 'in_review' or (byte_size is not null and activated_at is null));

-- one logo under review per brand
create unique index if not exists brand_logo_objects_one_in_review
  on profiles.brand_logo_objects (account_id) where state = 'in_review';

-- 0205: the task reaches the rows to purge, never a logo served or under review
drop policy if exists brand_logo_objects_maintenance_definer_select on profiles.brand_logo_objects;
create policy brand_logo_objects_maintenance_definer_select on profiles.brand_logo_objects
  for select to influx_maintenance_definer
  using (state in ('pending', 'purging'));

drop policy if exists brand_logo_objects_maintenance_definer_update on profiles.brand_logo_objects;
create policy brand_logo_objects_maintenance_definer_update on profiles.brand_logo_objects
  for update to influx_maintenance_definer
  using (state in ('pending', 'purging'))
  with check (state = 'purging' and purge_requested_at is not null);

comment on table profiles.brand_logo_objects is
  'One row per object of the private bucket brand-logo (04 §5.11 rule 3; stockage.md §3, §5), '
  'written BEFORE the object. object_key, generated: <account_id>/<id>.webp (T9.3, T9.9). '
  'Transitions by the member doors of 0204 and 0209 only (begin, discard, fail, activate, remove), '
  'the decisions (07), the erasure (purging) and the task storage_purge of L2B-09 (row deleted once '
  'the object is removed). On a published profile a new logo waits `in_review`, the active one stays '
  'served (file.md A4). Read by the owner, and by agent and admin in aal2.';

-- 2. The codes of the register (file.md, codes) ---------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 06 RG9: a moderated field of a published profile is submitted, or goes back to the validated
  -- value; the payload names the field and the entry, never the value
  ('profile.revision_submitted', 'profiles', 'advertiser_profile', 'info'),
  ('profile.revision_withdrawn', 'profiles', 'advertiser_profile', 'info')
on conflict (code) do nothing;

-- 3. What the owner of the member doors reads and writes, on the caller's rows only ---------------

grant select (website_domain) on profiles.advertiser_profiles to influx_identity_definer;

grant select (code, profile_kind, is_active) on profiles.moderated_fields to influx_identity_definer;

drop policy if exists moderated_fields_identity_definer_select on profiles.moderated_fields;
create policy moderated_fields_identity_definer_select on profiles.moderated_fields
  for select to influx_identity_definer
  using (true);

grant update (state, closed_at) on profiles.advertiser_review_entries to influx_identity_definer;

-- the door withdraws an open entry of the caller, and decides nothing (RG6)
drop policy if exists advertiser_review_entries_identity_definer_update
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_identity_definer_update
  on profiles.advertiser_review_entries
  for update to influx_identity_definer
  using (account_id = (select influx.current_account_id()) and state = 'open')
  with check (account_id = (select influx.current_account_id())
              and state in ('open', 'withdrawn'));

grant select (id, account_id, field_code, proposed_value, status, advertiser_review_entry_id),
      insert (account_id, field_code, proposed_value, advertiser_review_entry_id),
      update (status, closed_at)
   on profiles.profile_field_revisions to influx_identity_definer;

drop policy if exists profile_field_revisions_identity_definer_select
  on profiles.profile_field_revisions;
create policy profile_field_revisions_identity_definer_select on profiles.profile_field_revisions
  for select to influx_identity_definer
  using (account_id = (select influx.current_account_id()));

drop policy if exists profile_field_revisions_identity_definer_insert
  on profiles.profile_field_revisions;
create policy profile_field_revisions_identity_definer_insert on profiles.profile_field_revisions
  for insert to influx_identity_definer
  with check (account_id = (select influx.current_account_id()) and status = 'pending_review');

-- replaced or withdrawn by the door; `approved` and `rejected` belong to the decisions (RG6)
drop policy if exists profile_field_revisions_identity_definer_update
  on profiles.profile_field_revisions;
create policy profile_field_revisions_identity_definer_update on profiles.profile_field_revisions
  for update to influx_identity_definer
  using (account_id = (select influx.current_account_id()) and status = 'pending_review')
  with check (account_id = (select influx.current_account_id())
              and status in ('superseded', 'withdrawn'));

-- 4. The doors, as influx_identity_definer (03 P7 rule 5) -----------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema profiles to influx_identity_definer;
grant create on schema identity to influx_identity_definer;
set role influx_identity_definer;

-- 4.1 What the guard asks (EC-L2C-06-2) ------------------------------------------------------------
create or replace function profiles.moderated_field_is_active(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from profiles.moderated_fields f
                  where f.code = p_code and f.is_active)
$$;

comment on function profiles.moderated_field_is_active(text) is
  'file.md A4, EC-L2C-06-2: is this code of profiles.moderated_fields active? A boolean, for the '
  'guard of the member writes (SECURITY INVOKER) and for the routes of 13, the brand reading no '
  'catalogue. SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for '
  'influx_advertiser only.';

revoke all on function profiles.moderated_field_is_active(text)
  from public, anon, authenticated, service_role;
grant execute on function profiles.moderated_field_is_active(text) to influx_advertiser;

-- 4.2 The member door of RG9 ------------------------------------------------------------------------
create or replace function profiles.submit_own_advertiser_revision(p_field_code text, p_value jsonb)
returns table (
  revision_status  profiles.revision_status,
  entry_id         uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- the account comes from the transaction context (03 P2), never a parameter
  v_account        uuid := influx.current_account_id();
  v_status         text;
  v_live           jsonb;
  v_value          jsonb := p_value;
  v_validated      jsonb;
  v_required       text;
  v_logo_text      text;
  v_logo           uuid;
  v_pending_id     uuid;
  v_pending_value  jsonb;
  v_entry          uuid;
begin
  if v_account is null or influx.current_account_role() is distinct from 'advertiser' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The row lock serialises the doors of the account and a decision (07): one pending revision per
  -- field, one open entry per account.
  select p.status::text,
         pg_catalog.jsonb_build_object(
           'advertiser.brand_name',     p.legal_name,
           'advertiser.presentation',   p.presentation,
           'advertiser.website_domain', p.website_domain,
           'advertiser.contact_role',   p.contact_role,
           'advertiser.primary_sector', p.primary_sector_code,
           'advertiser.logo', pg_catalog.jsonb_build_object('logo_object_id',
             (select l.id from profiles.brand_logo_objects l
               where l.account_id = p.account_id and l.state = 'active')))
    into v_status, v_live
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id and a.status = 'active'
   where p.account_id = v_account
     for update of p;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  perform 1 from profiles.moderated_fields f
   where f.code = p_field_code and f.profile_kind = 'advertiser' and f.is_active;
  if not found or not (v_live ? p_field_code) then
    raise exception 'not a moderated field of a brand profile' using errcode = 'invalid_parameter_value';
  end if;

  -- file.md A3: direct outside `published` (the guard refuses `suspended`), a revision on `published`
  if v_status <> 'published' then
    raise exception 'a % brand profile takes no revision', v_status
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if p_value is null then
    raise exception 'a revision carries a value (JSON null to remove)'
      using errcode = 'invalid_parameter_value';
  end if;

  -- file.md A4: the type and the required at the door, the constraints of the column at the approval
  if p_field_code = 'advertiser.logo' then
    if pg_catalog.jsonb_typeof(p_value) <> 'object'
       or not (p_value ? 'logo_object_id')
       or (select count(*) from pg_catalog.jsonb_object_keys(p_value)) <> 1
       or pg_catalog.jsonb_typeof(p_value -> 'logo_object_id') not in ('string', 'null') then
      raise exception 'a logo revision is {"logo_object_id": uuid or null}'
        using errcode = 'invalid_parameter_value';
    end if;
    v_logo_text := p_value ->> 'logo_object_id';
    if v_logo_text is not null then
      if v_logo_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception 'not a logo of this brand' using errcode = 'invalid_parameter_value';
      end if;
      v_logo := v_logo_text::uuid;
      perform 1 from profiles.brand_logo_objects l
       where l.id = v_logo and l.account_id = v_account and l.state in ('in_review', 'active');
      if not found then
        raise exception 'not a logo of this brand' using errcode = 'invalid_parameter_value';
      end if;
    end if;
    v_value := pg_catalog.jsonb_build_object('logo_object_id', v_logo);
    -- EC-L2C-06-5: an object no longer proposed is not left behind
    update profiles.brand_logo_objects l
       set state = 'purging', purge_requested_at = pg_catalog.now()
     where l.account_id = v_account and l.state = 'in_review' and l.id is distinct from v_logo;
  else
    if pg_catalog.jsonb_typeof(p_value) not in ('string', 'null') then
      raise exception 'this field takes a text or null' using errcode = 'invalid_parameter_value';
    end if;
    v_required := case p_field_code
                    when 'advertiser.brand_name'     then 'legal_name'
                    when 'advertiser.presentation'   then 'presentation'
                    when 'advertiser.contact_role'   then 'contact_role'
                    when 'advertiser.primary_sector' then 'primary_sector'
                  end;
    if v_required is not null
       and v_required = any (profiles.advertiser_missing_required_fields(
                               pg_catalog.jsonb_build_object(v_required, p_value))) then
      raise exception 'required field missing: %', v_required
        using errcode = 'check_violation', detail = v_required;
    end if;
  end if;

  v_validated := v_live -> p_field_code;

  select r.id, r.proposed_value, r.advertiser_review_entry_id
    into v_pending_id, v_pending_value, v_entry
    from profiles.profile_field_revisions r
   where r.account_id = v_account and r.field_code = p_field_code and r.status = 'pending_review';

  -- file.md A3: back to the validated value, no forced reading
  if v_value = v_validated then
    if v_pending_id is null then
      return query select null::profiles.revision_status, null::uuid;
      return;
    end if;
    update profiles.profile_field_revisions r
       set status = 'withdrawn', closed_at = pg_catalog.now()
     where r.id = v_pending_id;
    update profiles.advertiser_review_entries e
       set state = 'withdrawn', closed_at = pg_catalog.now()
     where e.id = v_entry and e.state = 'open' and e.kind = 'revision'
       and not exists (select 1 from profiles.profile_field_revisions r
                        where r.advertiser_review_entry_id = v_entry
                          and r.status = 'pending_review');
    perform audit.append('profile.revision_withdrawn', 'advertiser_profile', v_account,
                         pg_catalog.jsonb_build_object('field_code', p_field_code,
                                                       'entry_id', v_entry));
    return query select 'withdrawn'::profiles.revision_status, v_entry;
    return;
  end if;

  if v_pending_id is not null then
    if v_pending_value = v_value then
      return query select 'pending_review'::profiles.revision_status, v_entry;
      return;
    end if;
    update profiles.profile_field_revisions r
       set status = 'superseded', closed_at = pg_catalog.now()
     where r.id = v_pending_id;
  else
    select e.id into v_entry
      from profiles.advertiser_review_entries e
     where e.account_id = v_account and e.state = 'open';
    if v_entry is null then
      -- its deadlines are written by the trigger of the table (04 §5.6)
      insert into profiles.advertiser_review_entries (account_id, kind)
      values (v_account, 'revision')
      returning id into v_entry;
    end if;
  end if;

  insert into profiles.profile_field_revisions
    (account_id, field_code, proposed_value, advertiser_review_entry_id)
  values (v_account, p_field_code, v_value, v_entry);

  -- The register, in the transaction of the fact; last: the chain lock is held until COMMIT (04 §7.2).
  perform audit.append('profile.revision_submitted', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('field_code', p_field_code,
                                                     'entry_id', v_entry));
  return query select 'pending_review'::profiles.revision_status, v_entry;
end
$$;

comment on function profiles.submit_own_advertiser_revision(text, jsonb) is
  '06 RG9, CA15; file.md A3, A4: an active advertiser proposes a change of a moderated field of his '
  'PUBLISHED profile; the live row keeps the validated value. p_value: a JSON text, or JSON null to '
  'remove; the logo: {"logo_object_id": uuid or null}. In ONE transaction (the profile row locked): '
  'the revision deposited, the pending one of the field superseded, the entry joined or created '
  '(`revision`), the register line profile.revision_submitted {field_code, entry_id}; returns '
  '(pending_review, entry). The validated value: the pending revision withdrawn, its `revision` entry '
  'too when nothing is left, line profile.revision_withdrawn; returns (withdrawn, entry). The value '
  'already pending: nothing written, (pending_review, entry). Nothing to do: (NULL, NULL). 22023 for '
  'an unknown or inactive field, a value of the wrong type or a logo that is not an own in_review or '
  'active row; 23514 with the code as DETAIL for a required field emptied '
  '(advertiser_missing_required_fields); 55000 unless published; 42501 outside an active advertiser '
  'account holding a profile. SECURITY DEFINER owned by influx_identity_definer, empty search_path; '
  'EXECUTE for influx_advertiser only.';

revoke all on function profiles.submit_own_advertiser_revision(text, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function profiles.submit_own_advertiser_revision(text, jsonb) to influx_advertiser;

-- 4.3 A change that applies at once (called by 13) ---------------------------------------------------
create or replace function profiles.record_own_advertiser_profile_change()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_event    uuid := pg_catalog.gen_random_uuid();
begin
  if v_account is null or influx.current_account_role() is distinct from 'advertiser' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from profiles.advertiser_profiles p
   where p.account_id = v_account and p.status = 'published';
  if not found then
    return false;
  end if;
  -- 05 RG73: in the transaction of the fact, the payload reduced to identifiers
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_event, 'lead.updated', d.destination, 'account:' || v_account::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_account),
         'lead.updated:' || v_event::text
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);
  return true;
end
$$;

comment on function profiles.record_own_advertiser_profile_change() is
  '06 RG78, file.md A4: a field with immediate effect changed on the caller''s PUBLISHED profile: '
  'ONE lead.updated (priority 100) to brevo_contact and apollo_contact, payload = ids only, returns '
  'true; any other state: nothing, false. The API calls it once per save (13). 42501 outside an '
  'advertiser context. SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE '
  'for influx_advertiser only.';

revoke all on function profiles.record_own_advertiser_profile_change()
  from public, anon, authenticated, service_role;
grant execute on function profiles.record_own_advertiser_profile_change() to influx_advertiser;

-- 4.4 The logo (0204 recreated by its owner, file.md A4) ----------------------------------------------
create or replace function profiles.activate_brand_logo(
  p_logo_id     uuid,
  p_byte_size   integer,
  p_width       integer,
  p_height      integer
)
returns table (
  previous_logo_id     uuid,
  previous_object_key  text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account       uuid := influx.current_account_id();
  v_status        text;
  v_previous_id   uuid;
  v_previous_key  text;
begin
  if v_account is null or influx.current_account_role() is distinct from 'advertiser' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform 1 from identity.accounts a where a.id = v_account and a.status = 'active';
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The profile first, as every door of the account (the guard holds it too).
  select p.status::text into v_status
    from profiles.advertiser_profiles p
   where p.account_id = v_account
     for update of p;

  -- Every row of the account locked: two activations of the same account follow each other, the
  -- last one wins, one active row at most.
  perform 1 from profiles.brand_logo_objects l where l.account_id = v_account for update;

  perform 1 from profiles.brand_logo_objects l
   where l.id = p_logo_id and l.account_id = v_account and l.state = 'pending';
  if not found then
    raise exception 'the logo upload is not pending' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- file.md A4: on a published profile the new object waits, the active logo stays served
  if v_status = 'published' and profiles.moderated_field_is_active('advertiser.logo') then
    update profiles.brand_logo_objects l
       set state = 'purging', purge_requested_at = pg_catalog.now()
     where l.account_id = v_account and l.state = 'in_review'
    returning l.id, l.object_key into v_previous_id, v_previous_key;

    update profiles.brand_logo_objects l
       set state = 'in_review', byte_size = p_byte_size, width = p_width, height = p_height
     where l.id = p_logo_id;

    perform profiles.submit_own_advertiser_revision(
      'advertiser.logo', pg_catalog.jsonb_build_object('logo_object_id', p_logo_id));
  else
    update profiles.brand_logo_objects l
       set state = 'purging', purge_requested_at = pg_catalog.now()
     where l.account_id = v_account and l.state = 'active'
    returning l.id, l.object_key into v_previous_id, v_previous_key;

    -- the constraints hold the sizes (EC-L2B-08-2): 23514 beyond them
    update profiles.brand_logo_objects l
       set state = 'active', byte_size = p_byte_size, width = p_width, height = p_height,
           activated_at = pg_catalog.now()
     where l.id = p_logo_id;
  end if;

  if v_previous_id is not null then
    return query select v_previous_id, v_previous_key;
  end if;
end
$$;

comment on function profiles.activate_brand_logo(uuid, integer, integer, integer) is
  'stockage.md §3 (e), file.md A4: the WebP of the upload p_logo_id is stored (p_byte_size bytes, '
  'p_width x p_height). Published profile: its PENDING row goes in_review and is proposed '
  '(profiles.submit_own_advertiser_revision), a previous in_review row passes to purging, the active '
  'logo stays. Other states: it becomes the active logo and the previous active row, if any, passes '
  'to purging. In ONE transaction (the rows of the account locked). Returns the row sent to purge '
  '(id, object_key) for the immediate removal (f), or no row. 55000 when the caller holds no such '
  'pending row or the profile is suspended (the guard); 23514 when a size is out of the bounds of '
  'the bucket; 42501 outside an active advertiser account. SECURITY DEFINER owned by '
  'influx_identity_definer; EXECUTE for influx_advertiser only.';

create or replace function profiles.remove_own_brand_logo()
returns table (
  logo_id     uuid,
  object_key  text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_status   text;
begin
  if v_account is null or influx.current_account_role() is distinct from 'advertiser' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  select p.status::text into v_status
    from profiles.advertiser_profiles p
   where p.account_id = v_account
     for update of p;

  -- file.md A4: on a published profile the removal is proposed, the active logo stays served
  if v_status = 'published' and profiles.moderated_field_is_active('advertiser.logo') then
    return query
      update profiles.brand_logo_objects l
         set state = 'purging', purge_requested_at = pg_catalog.now()
       where l.account_id = v_account and l.state = 'in_review'
      returning l.id, l.object_key;
    perform profiles.submit_own_advertiser_revision(
      'advertiser.logo', pg_catalog.jsonb_build_object('logo_object_id', null::uuid));
    return;
  end if;

  return query
    update profiles.brand_logo_objects l
       set state = 'purging', purge_requested_at = pg_catalog.now()
     where l.account_id = v_account and l.state = 'active'
    returning l.id, l.object_key;
end
$$;

comment on function profiles.remove_own_brand_logo() is
  'stockage.md §3 (DELETE), file.md A4: published profile: the removal is proposed '
  '(profiles.submit_own_advertiser_revision), the active logo stays, an in_review row passes to '
  'purging and is returned. Other states: the active logo passes to purging and is returned. Returns '
  '(logo_id, object_key) for the immediate removal (f), or no row. 55000 on a suspended profile (the '
  'guard); 42501 outside an advertiser context. SECURITY DEFINER owned by influx_identity_definer; '
  'EXECUTE for influx_advertiser only.';

-- 4.5 The company name (0122 recreated by its owner, file.md A4) ---------------------------------------
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
  v_profile    text;
  v_revision   profiles.revision_status;
  v_changed    boolean := false;
  v_status_set boolean := false;
  v_proposed   boolean := false;
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
    select p.legal_name, p.status::text into v_legal_name, v_profile
      from profiles.advertiser_profiles p where p.account_id = v_account;
    if v_profile = 'published' and profiles.moderated_field_is_active('advertiser.brand_name') then
      -- file.md A4: a revision, the validated name stays; the door withdraws a return to it
      select r.revision_status into v_revision
        from profiles.submit_own_advertiser_revision('advertiser.brand_name',
                                                     pg_catalog.to_jsonb(p_legal_name)) r;
      v_proposed := v_revision is not null;
    elsif p_legal_name is distinct from v_legal_name then
      -- kept as typed (05 RG13); the constraints of 0106 refuse a short or unprintable name (23514);
      -- a suspended profile is refused by the guard (55000)
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
  return v_changed or v_status_set or v_proposed;
end
$$;

comment on function identity.update_own_account(text, text, identity.declared_status, text) is
  '05 RG15, RG71, RG73; 17 §6.1; file.md A4: an advertiser or creator changes his own country, '
  'language, declared status (creator) or company name (advertiser); NULL = unchanged. In one '
  'transaction: the columns and ONE lead.updated (priority 100) to brevo_contact and apollo_contact, '
  'payload = ids only; a change of declared status goes through identity.set_declared_status() '
  '(reason member_settings, its own lead.updated and register line). On a PUBLISHED brand profile '
  'the company name goes through profiles.submit_own_advertiser_revision(): the validated name stays, '
  'no lead.updated for it. Returns false when nothing changes (no line). 22023 for a field of the '
  'other door or a malformed country, 23514 for a blocked country (RG8) or a company name refused by '
  '0106, 23503 for an unknown country or a language without translation, 55000 for a change of the '
  'name of a suspended profile (the guard), 42501 outside an active member account. SECURITY DEFINER '
  'owned by influx_identity_definer, empty search_path; EXECUTE for influx_advertiser and '
  'influx_creator.';

reset role;
revoke create on schema profiles from influx_identity_definer;
revoke create on schema identity from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 5. The guard (file.md A4; L2BS-1) ------------------------------------------------------------------

create or replace function profiles.guard_advertiser_member_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account  uuid;
  v_status   text;
  v_field    text;
begin
  -- The two roles a member acts under; the erasure, the purge and the decisions are not members.
  if current_user not in ('influx_advertiser', 'influx_identity_definer') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_table_name = 'advertiser_profiles' then
    -- a BEFORE ROW trigger sees the latest version of the row it updates
    v_status := old.status::text;
  else
    if tg_op = 'DELETE' then
      v_account := old.account_id;
    else
      v_account := new.account_id;
    end if;
    -- FOR SHARE: a decision (07) waits for this write, or this write waits for the decision. No row
    -- (somebody else's account): the policy of the table refuses it.
    select p.status::text into v_status
      from profiles.advertiser_profiles p
     where p.account_id = v_account
       for share of p;
  end if;

  if v_status = 'suspended' then
    raise exception 'a suspended brand profile is frozen'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  if v_status = 'published' then
    if tg_table_name = 'advertiser_profiles' then
      select c.code into v_field
        from (values
               ('advertiser.brand_name',     new.legal_name is distinct from old.legal_name),
               ('advertiser.presentation',   new.presentation is distinct from old.presentation),
               ('advertiser.website_domain', new.website_domain is distinct from old.website_domain),
               ('advertiser.contact_role',   new.contact_role is distinct from old.contact_role),
               ('advertiser.primary_sector', new.primary_sector_code is distinct from old.primary_sector_code)
             ) as c (code, changed)
       where c.changed and profiles.moderated_field_is_active(c.code)
       limit 1;
    elsif tg_table_name = 'brand_logo_objects' then
      -- the active logo is the validated one: nothing moves into or out of `active`
      if (tg_op <> 'INSERT' and old.state = 'active') or (tg_op <> 'DELETE' and new.state = 'active') then
        if profiles.moderated_field_is_active('advertiser.logo') then
          v_field := 'advertiser.logo';
        end if;
      end if;
    end if;
    if v_field is not null then
      raise exception 'a moderated field of a published brand profile goes through a revision'
        using errcode = 'object_not_in_prerequisite_state', detail = v_field;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

comment on function profiles.guard_advertiser_member_write() is
  'file.md A4, L2BS-1, 06 RG9: BEFORE trigger on the brand profile, its eight lists, its contact '
  'person and its logo rows. When current_user is influx_advertiser or influx_identity_definer: '
  'suspended refuses every write; published refuses the change of an active moderated column, and '
  'any move of a logo into or out of active. 55000, the field code as DETAIL. SECURITY INVOKER (it '
  'reads current_user), empty search_path, executed by nobody directly.';

revoke all on function profiles.guard_advertiser_member_write()
  from public, anon, authenticated, service_role;

drop trigger if exists advertiser_member_write_guard on profiles.advertiser_profiles;
create trigger advertiser_member_write_guard
  before update on profiles.advertiser_profiles
  for each row execute function profiles.guard_advertiser_member_write();

do $$
declare
  t text;
begin
  foreach t in array array[
    'advertiser_secondary_sectors', 'advertiser_target_markets', 'advertiser_working_languages',
    'advertiser_topics', 'advertiser_networks', 'advertiser_formats',
    'advertiser_audience_countries', 'advertiser_usage_rights', 'advertiser_contact_details',
    'brand_logo_objects']
  loop
    execute format('drop trigger if exists advertiser_member_write_guard on profiles.%I', t);
    execute format('create trigger advertiser_member_write_guard '
                   'before insert or update or delete on profiles.%I '
                   'for each row execute function profiles.guard_advertiser_member_write()', t);
  end loop;
end
$$;

-- 6. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  -- the doors: SECURITY DEFINER, their owner, empty search_path, their only callers
  for v_def in
    select * from (values
      ('profiles.moderated_field_is_active(text)', array['influx_advertiser']),
      ('profiles.submit_own_advertiser_revision(text, jsonb)', array['influx_advertiser']),
      ('profiles.record_own_advertiser_profile_change()', array['influx_advertiser']),
      ('profiles.activate_brand_logo(uuid, integer, integer, integer)', array['influx_advertiser']),
      ('profiles.remove_own_brand_logo()', array['influx_advertiser']),
      ('identity.update_own_account(text, text, identity.declared_status, text)',
       array['influx_advertiser', 'influx_creator'])
    ) as d (fn, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> 'influx_identity_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_identity_definer, empty search_path',
        v_def.fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- the guard: SECURITY INVOKER, empty search_path, executed by nobody, on its eleven tables
  if (select prosecdef from pg_catalog.pg_proc
       where oid = 'profiles.guard_advertiser_member_write()'::regprocedure)
     or (select proconfig from pg_catalog.pg_proc
          where oid = 'profiles.guard_advertiser_member_write()'::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception 'profiles.guard_advertiser_member_write() must be SECURITY INVOKER, empty search_path';
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = 'profiles.guard_advertiser_member_write()'::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner;
  if v_bad is not null then
    raise exception 'profiles.guard_advertiser_member_write() executable by: %', v_bad;
  end if;
  if (select count(*) from pg_catalog.pg_trigger t
       where t.tgname = 'advertiser_member_write_guard' and t.tgenabled = 'O'
         and t.tgfoid = 'profiles.guard_advertiser_member_write()'::regprocedure) <> 11 then
    raise exception 'the guard must fire on the eleven tables of a brand profile';
  end if;

  -- no execution role writes the revisions nor the entries directly (0207 still holds)
  select string_agg(r || ' ' || p || ' ' || t, ', ') into v_bad
    from unnest(array['profiles.moderated_fields', 'profiles.advertiser_review_entries',
                      'profiles.profile_field_revisions']) t,
         unnest(array['influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin',
                      'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy']) r,
         unnest(array['INSERT', 'UPDATE', 'DELETE']) p
   where pg_catalog.has_table_privilege(r, t, p)
      or (p <> 'DELETE' and pg_catalog.has_any_column_privilege(r, t, p));
  if v_bad is not null then
    raise exception 'execution role(s) writing a table of queue 1: %', v_bad;
  end if;

  -- no definer role left usable nor with CREATE on its schemas
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_identity_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'profiles', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'identity', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on a schema';
  end if;
end
$$;
