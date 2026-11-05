-- =============================================================================
-- 0213_profiles_brand_logo_agent_read
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 18a (jalons/l2c/18a.md; founder's decision of 2026-11-05, EC-L2C-12-2,
-- EC-L2C-17-1; fiche invariants 7, 11, 15; archives/jalons/l2b/stockage.md §4: "lecture d'agent
-- journalisée"). The journaled door through which apps/api learns which object of Storage to relay to
-- an internal reader of queue 1. No route, no screen (18b), nothing on the member side; no right on
-- Storage for any role: apps/api reads the object with its own relay, as for a member.
--
--   audit.event_types   queue.logo_read (backoffice, queue_entry, sensitive): payload queue_code,
--         logo_id, state. The object key, the name of the brand and the bytes are never written.
--   profiles.read_advertiser_review_logo(entry, logo)   an active agent or admin in aal2, on an entry
--         that is not of his own account (15 RG36, C(3)), holder of the claim or not (the read-only
--         view of a colleague, 15 C2, must see the image), for a logo `active` or `in_review` of the
--         account of that entry: writes one nominative line, returns the object key and its
--         metadata, nothing else. SECURITY DEFINER owned by influx_moderation_definer, EXECUTE for
--         influx_agent and influx_admin.
--   influx_moderation_definer   SELECT on the object key and the metadata of a logo (its policy of
--         0210 keeps the caller's own account out); no other right.
--
-- Refusals: 42501, one answer without DETAIL, for a caller outside an active agent or admin in aal2,
-- an unknown entry, an entry of the caller's own account, a logo unknown, of another account or in
-- any other state (pending, purging, purged). A refusal writes no line.
--
-- EC-L2C-18a (micro-gaps, the safest choice):
--   EC-L2C-18a-1  0213 is the next free number (ls supabase/migrations).
--   EC-L2C-18a-2  the logo is named by its id, the one the decision view already serves (readLogos):
--                 the reader gets the object he was shown, never another one that became active
--                 meanwhile. A state as an argument would not say so.
--   EC-L2C-18a-3  a closed entry is readable: its decision view is open to the same readers (15 C2,
--                 outcome `closed`) and the logo stays bound to the account, not to the entry.
--   EC-L2C-18a-4  updated_at = coalesce(activated_at, created_at), as the member read: an `in_review`
--                 logo has no activated_at (0209).
--   EC-L2C-18a-5  no row lock: a read stops nothing; a purge right after it is what a member read
--                 meets too (the relay answers "no object").
--
-- ROLLBACK (before any line of this code is written): drop function
-- profiles.read_advertiser_review_logo(uuid, uuid); revoke select (object_key, byte_size, width, height,
-- activated_at, created_at) on profiles.brand_logo_objects from influx_moderation_definer; delete from
-- audit.event_types where code = 'queue.logo_read' (possible only while no line references it).
-- =============================================================================

-- 1. The code of the register (fiche invariant 7) -------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  ('queue.logo_read', 'backoffice', 'queue_entry', 'sensitive')
on conflict (code) do nothing;

-- 2. What the owner reads (its policy brand_logo_objects_moderation_definer_select, 0210) ---------

grant select (object_key, byte_size, width, height, activated_at, created_at)
   on profiles.brand_logo_objects to influx_moderation_definer;

-- 3. The read, as influx_moderation_definer (03 P7 rule 5) ----------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_moderation_definer', current_user);
end
$$;
grant create on schema profiles to influx_moderation_definer;
set role influx_moderation_definer;

create or replace function profiles.read_advertiser_review_logo(
  p_entry_id  uuid,
  p_logo_id   uuid
)
returns table (
  state       text,
  object_key  text,
  byte_size   integer,
  width       smallint,
  height      smallint,
  updated_at  timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller   uuid := profiles.require_review_agent(false);
  v_account  uuid;
  v_logo     record;
begin
  -- Unknown, or of the caller's own account (the policy hides it): 42501, one answer
  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  if not found or v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  select l.state::text as state, l.object_key, l.byte_size, l.width, l.height,
         coalesce(l.activated_at, l.created_at) as updated_at
    into v_logo
    from profiles.brand_logo_objects l
   where l.id = p_logo_id
     and l.account_id = v_account
     and l.state in ('active', 'in_review');
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- One nominative line per read, in the transaction of the read; never the key (fiche invariant 7)
  perform audit.append('queue.logo_read', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_advertiser',
                                                     'logo_id', p_logo_id,
                                                     'state', v_logo.state));
  return query select v_logo.state, v_logo.object_key, v_logo.byte_size, v_logo.width, v_logo.height,
                      v_logo.updated_at;
end
$$;

comment on function profiles.read_advertiser_review_logo(uuid, uuid) is
  'Founder''s decision of 2026-11-05, stockage.md §4: an internal reader of queue 1 asks for a logo of '
  'an entry. Holder of the claim or not (15 C2), on an open or closed entry, for a logo active or '
  'in_review of the account of the entry: writes queue.logo_read {queue_code, logo_id, state} and '
  'returns (state, object_key, byte_size, width, height, updated_at) for apps/api to relay the object. '
  '42501, without DETAIL and without a line, outside an active agent or admin in aal2, for an unknown '
  'entry, an entry of the caller''s own account (C(3)), a logo unknown, of another account, pending, '
  'purging or purged. SECURITY DEFINER owned by influx_moderation_definer, empty search_path; EXECUTE '
  'for influx_agent and influx_admin.';

revoke all on function profiles.read_advertiser_review_logo(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function profiles.read_advertiser_review_logo(uuid, uuid)
   to influx_agent, influx_admin;

reset role;
revoke create on schema profiles from influx_moderation_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_moderation_definer', current_user);
end
$$;

-- 4. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_fn   constant text := 'profiles.read_advertiser_review_logo(uuid, uuid)';
  v_bad  text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = v_fn::regprocedure) <> 'influx_moderation_definer'
     or not (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
     or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception '% must be SECURITY DEFINER, owned by influx_moderation_definer, empty search_path',
      v_fn;
  end if;

  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = v_fn::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_agent', 'influx_admin'));
  if v_bad is not null then
    raise exception '% executable by: %', v_fn, v_bad;
  end if;

  if not exists (select 1 from audit.event_types
                  where code = 'queue.logo_read' and domain = 'backoffice'
                    and subject_type = 'queue_entry' and severity = 'sensitive' and is_active) then
    raise exception 'the code queue.logo_read is not as this migration writes it';
  end if;

  -- 18a.md "Arrêt si": no execution role reaches the objects of the bucket by this door
  select string_agg(r || ' ' || p, ', ') into v_bad
    from unnest(array['influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin',
                      'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy',
                      'influx_moderation_definer']) r,
         unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
   where pg_catalog.has_table_privilege(r, 'storage.objects', p);
  if v_bad is not null then
    raise exception 'a role with a direct right on storage.objects: %', v_bad;
  end if;

  if exists (select 1
               from pg_catalog.pg_auth_members m
               join pg_catalog.pg_roles mem on mem.oid = m.member
               join pg_catalog.pg_roles grp on grp.oid = m.roleid
              where grp.rolname = 'influx_moderation_definer'
                and (mem.rolname <> current_user or m.set_option or m.inherit_option))
     or pg_catalog.has_schema_privilege('influx_moderation_definer', 'profiles', 'CREATE') then
    raise exception 'influx_moderation_definer left with a usable member or CREATE on its schema';
  end if;
end
$$;
