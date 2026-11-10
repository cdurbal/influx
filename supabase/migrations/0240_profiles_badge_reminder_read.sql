-- =============================================================================
-- 0240_profiles_badge_reminder_read
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, fix-1 (jalons/l2f/fix-1.md; l2f/ux-constats.md L2FU-2, answer A of the founder on
-- 2026-11-10; l2f/modele.md §3; l2f-fiche.md invariants 1, 10, 15; 08 RG70 « J-15 »; 06 RG54). The
-- reminder e-mail says « Déposez une capture récente pour la conserver », and the doors of 0230 already
-- open a new request on an ACTIVE badge in the window of the reminder; the screen could not say so, as the
-- member roles read no parameter. A member reads, as 0237 does for the grace, the one number that opens the
-- window: badge_reminder_days. One read, no table, no data, no right on the badge.
--
--   profiles.read_badge_reminder_days()   the number of days before the expiry of a badge from which it
--         may be renewed and is reminded of (backoffice.operational_settings `badge_reminder_days`, 1 to
--         90, 15 at the start), for an ACTIVE creator or advertiser account; 42501 otherwise. Never the
--         account, a badge, the instant of the reminder nor any other parameter. SECURITY DEFINER owned by
--         influx_identity_definer (which reads the brand's parameters), empty search_path; EXECUTE for
--         influx_creator and influx_advertiser ONLY. It lives in `profiles` (the advertiser holds no right
--         on `verification`, T9.6) and names neither a piece nor storage.
--   influx_identity_definer   its policy on operational_settings gains the one key: the brand doors keep
--         their four, the grace of 0237 its one, and read nothing else.
--
-- EC-L2F-fix-1-1  0240 is the next free number (ls supabase/migrations). The window is the domain's rule
--                 (isInRenewalWindow, packages/domain: the days come IN); the API reads them here once per
--                 answer, only when an active badge with an expiry is held, and serves `renewable`.
--
-- ROLLBACK (before the API reads it): drop function profiles.read_badge_reminder_days(); recreate the
-- policy operational_settings_identity_definer_select as in 0237 (five keys).
-- =============================================================================

-- 1. The parameter the definer may read -----------------------------------------------------------------

drop policy if exists operational_settings_identity_definer_select on backoffice.operational_settings;
create policy operational_settings_identity_definer_select on backoffice.operational_settings
  for select to influx_identity_definer
  using (key in ('verification_code_validity_days', 'request_retry_hours', 'rejection_cap_count',
                 'rejection_cap_window_days', 'badge_grace_days', 'badge_reminder_days'));

-- 2. The read -------------------------------------------------------------------------------------------

create or replace function profiles.read_badge_reminder_days()
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_days     integer;
begin
  if v_account is null
     or influx.current_account_role() is null
     or influx.current_account_role()::text not in ('creator', 'advertiser')
     or not exists (select 1 from identity.accounts a where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select (s.value #>> '{}')::integer into v_days
    from backoffice.operational_settings s
   where s.key = 'badge_reminder_days';
  if v_days is null then
    raise exception 'badge_reminder_days is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;
  return v_days;
end
$$;

comment on function profiles.read_badge_reminder_days() is
  '08 RG70 « J-15 », 06 RG54 (0240; l2f/ux-constats.md L2FU-2, answer A): the days before its expiry from '
  'which an active badge may be renewed (operational_settings badge_reminder_days), read for an active '
  'creator or advertiser account so that the API can serve `renewable`. Never the account, a badge, the '
  'instant of the reminder nor another parameter. 42501 outside an active member account. SECURITY DEFINER '
  'owned by influx_identity_definer, empty search_path; EXECUTE for influx_creator and influx_advertiser ONLY.';

revoke all on function profiles.read_badge_reminder_days()
  from public, anon, authenticated, service_role, influx_agent, influx_admin;
grant execute on function profiles.read_badge_reminder_days() to influx_creator, influx_advertiser;

-- Hand the function to influx_identity_definer (03 P7 rule 5, window of 0004 §9)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema profiles to influx_identity_definer;

alter function profiles.read_badge_reminder_days() owner to influx_identity_definer;

revoke create on schema profiles from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 3. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'profiles.read_badge_reminder_days()'::regprocedure) <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc
              where oid = 'profiles.read_badge_reminder_days()'::regprocedure)
     or (select proconfig from pg_catalog.pg_proc
          where oid = 'profiles.read_badge_reminder_days()'::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception 'profiles.read_badge_reminder_days() must be owned by influx_identity_definer, SECURITY DEFINER, empty search_path';
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = 'profiles.read_badge_reminder_days()'::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_creator', 'influx_advertiser'));
  if v_bad is not null then
    raise exception 'profiles.read_badge_reminder_days() executable by: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'profiles', 'CREATE') then
    raise exception 'influx_identity_definer left with a window of ownership';
  end if;
  if not exists (select 1 from backoffice.operational_settings where key = 'badge_reminder_days') then
    raise exception 'badge_reminder_days is not set (0230)';
  end if;
end
$$;
