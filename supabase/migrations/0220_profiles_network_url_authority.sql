-- =============================================================================
-- 0220_profiles_network_url_authority
-- -----------------------------------------------------------------------------
-- Lot 2 / L2E, commit 01 (jalons/l2e/01.md; finding L2DS-1 of
-- archives/jalons/l2d/revue-constats-securite.md; 07 RG43, CA12).
--
-- 0217 read the authority of profile_url with `[^/?#]*`, which does not stop at a backslash:
-- `https://evil.example\.instagram.com/x` passed the guard (host « ends with .instagram.com »)
-- while a browser (WHATWG) opens evil.example. Before any clickable rendering of profile_url
-- (backoffice L2E, reveal of Lot 4), the authority must be a plain host name with an optional
-- port.
--
-- 1. profiles.guard_creator_social_account() recreated from its 0217 version: after the empty
--    authority and the credentials (unchanged, constraint creator_social_accounts_profile_url_host),
--    the authority must match `^[A-Za-z0-9.-]+(:[0-9]{1,5})?$`, otherwise 23514 with the constraint
--    creator_social_accounts_profile_url_shape (the domain's `invalid_shape`); only then is the host
--    compared to reference.network_url_hosts. Same owner, same SECURITY INVOKER, same empty
--    search_path, same trigger, same rights (none).
-- 2. The existing lines are read again, never modified: a line the new rule would refuse is
--    reported by its count only (a WARNING, no URL, no handle: D60), and stays as it is until its
--    next write of profile_url or network_code.
--
-- Not here: the rendering of profile_url, the routes, the other guards
-- (packages/domain/src/creator-profile/network-line.ts carries the same rule).
--
-- ROLLBACK: recreate profiles.guard_creator_social_account() as in 0217 (it reopens L2DS-1).
-- =============================================================================

-- 1. The guard of the URL (RG43, L2DS-1) -------------------------------------------------------------

create or replace function profiles.guard_creator_social_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_authority  text;
  v_host       text;
begin
  -- no URL, or one the shape constraint refuses after this trigger: nothing to hold here
  if new.profile_url is null or new.profile_url !~ '^https://[^[:space:][:cntrl:]]+$' then
    return new;
  end if;
  -- EC-L2D-04-6: the guard reads as its caller; a network it cannot read is not vouched for
  if not exists (select 1 from reference.networks n where n.code = new.network_code) then
    raise exception 'unknown network for a network line'
      using errcode = 'foreign_key_violation';
  end if;
  v_authority := pg_catalog.substring(new.profile_url, '^https://([^/?#]*)');
  -- no credentials before the host (https://user:secret@host), and a host
  if v_authority is null or v_authority = '' or pg_catalog.strpos(v_authority, '@') > 0 then
    raise exception 'the profile URL must name a host, without credentials'
      using errcode = 'check_violation', constraint = 'creator_social_accounts_profile_url_host';
  end if;
  -- L2DS-1: a plain host name and an optional port, nothing a browser would read otherwise
  -- (a backslash, a percent-encoding, brackets)
  if v_authority !~ '^[A-Za-z0-9.-]+(:[0-9]{1,5})?$' then
    raise exception 'the profile URL must name a plain host'
      using errcode = 'check_violation', constraint = 'creator_social_accounts_profile_url_shape';
  end if;
  v_host := pg_catalog.lower(pg_catalog.regexp_replace(v_authority, ':[0-9]*$', ''));
  -- a network with listed hosts: the host itself or one of its subdomains; otherwise free
  if exists (select 1 from reference.network_url_hosts h where h.network_code = new.network_code)
     and not exists (
       select 1 from reference.network_url_hosts h
        where h.network_code = new.network_code
          and (v_host = h.host
               or pg_catalog.right(v_host, pg_catalog.char_length(h.host) + 1) = '.' || h.host)) then
    raise exception 'the profile URL does not point to the declared network'
      using errcode = 'check_violation', constraint = 'creator_social_accounts_profile_url_host';
  end if;
  return new;
end
$$;

comment on function profiles.guard_creator_social_account() is
  '07 RG43, modele.md point 5, L2DS-1 (0220): the authority of profile_url is a plain host name '
  'with an optional port (23514, constraint creator_social_accounts_profile_url_shape, otherwise); '
  'its host is a host of reference.network_url_hosts for the network of the line, or one of its '
  'subdomains; no credentials; a network without listed host is free. 23514 (constraint '
  'creator_social_accounts_profile_url_host) otherwise. SECURITY INVOKER, empty search_path: it '
  'reads the reference lists as its caller (EC-L2D-04-6).';

revoke all on function profiles.guard_creator_social_account()
  from public, anon, authenticated, service_role;

-- 2. The existing lines, read again and never modified ------------------------------------------------

do $$
declare
  v_faulty  bigint;
begin
  select count(*) into v_faulty
    from profiles.creator_social_accounts l
   where l.profile_url ~ '^https://[^[:space:][:cntrl:]]+$'
     and pg_catalog.substring(l.profile_url, '^https://([^/?#]*)') !~ '^[A-Za-z0-9.-]+(:[0-9]{1,5})?$';
  if v_faulty > 0 then
    raise warning 'L2DS-1: % network line(s) carry a profile URL whose authority is not a plain host; '
                  'left unchanged, refused at their next write', v_faulty;
  end if;
end
$$;
