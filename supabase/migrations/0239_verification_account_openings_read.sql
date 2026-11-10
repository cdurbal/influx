-- =============================================================================
-- 0239_verification_account_openings_read
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 20 (jalons/l2f/20.md; l2f/modele.md §5, §6; l2f-fiche.md invariants 9, 10, 13;
-- 06 RG51; D83 A). « Lancer la vérification » is offered on the page of a member account, by line of
-- network or for the brand. The agent roles read no network line (profiles.creator_social_accounts has no
-- grant for them), so the screen could not name the line it opens: one read, no table, no new right.
--
--   verification.read_account_openings(p_account_id)   an ACTIVE agent or admin in aal2 (42501 for his own
--         account, an unknown one or an internal one): one row per network line of a creator account
--         (level account_verified) and one row for an advertiser account (level brand_verified, no line),
--         each with the draft or pending request already open for that triplet (id, status, origin: a
--         member's own request is taken over by the opening, never doubled) and, for the brand, whether
--         its site has a domain and whether its internal block exists (the three fields are then to be
--         typed, 0234 open_request_for_member()). Never a handle, a figure, an agent nor a comment.
--         « Audience vérifiée » has no row: it is never opened this way (D83 (3)). STABLE.
--         SECURITY DEFINER owned by influx_verification_definer, empty search_path; EXECUTE for
--         influx_agent and influx_admin ONLY. Nothing for a member role (T9.6).
--
-- EC-L2F-20-1  0239 is the next free number. The commit titled « backoffice » carries a migration, as the
--              commit 14 did (EC-L2F-14-1): the screen cannot be written without this read.
--
-- ROLLBACK (before the API reads it): drop function verification.read_account_openings(uuid).
-- =============================================================================

-- 1. The read -----------------------------------------------------------------------------------------------

create or replace function verification.read_account_openings(p_account_id uuid)
returns table (
  social_account_id    uuid,
  network_code         text,
  level                verification.badge_level,
  request_id           uuid,
  request_status       text,
  opened_by            text,
  has_website_domain   boolean,
  has_internal_details boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := verification.require_agent(false);
begin
  -- the caller's own account, an unknown one: one answer (an account he holds is served, D83)
  if p_account_id is null or p_account_id = v_caller
     or not exists (select 1 from identity.accounts a where a.id = p_account_id) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query
  select l.id, l.network_code, 'account_verified'::verification.badge_level,
         o.id, o.status::text, o.opened_by, null::boolean, null::boolean
    from profiles.creator_social_accounts l
    left join lateral (
           select r.id, r.status, r.opened_by
             from verification.verification_requests r
            where r.account_id = p_account_id and r.social_account_id = l.id
              and r.level = 'account_verified' and r.status in ('draft', 'pending')
            order by r.created_at desc, r.id desc
            limit 1) o on true
   where l.account_id = p_account_id
     and exists (select 1 from identity.account_roles x
                  where x.account_id = p_account_id and x.role = 'creator')
   union all
  select null::uuid, null::text, 'brand_verified'::verification.badge_level,
         o.id, o.status::text, o.opened_by,
         coalesce((select p.website_domain is not null
                     from profiles.advertiser_profiles p where p.account_id = p_account_id), false),
         exists (select 1 from profiles.advertiser_internal_details d
                  where d.account_id = p_account_id)
    from (select 1) one
    left join lateral (
           select r.id, r.status, r.opened_by
             from verification.verification_requests r
            where r.account_id = p_account_id and r.social_account_id is null
              and r.level = 'brand_verified' and r.status in ('draft', 'pending')
            order by r.created_at desc, r.id desc
            limit 1) o on true
   where exists (select 1 from identity.account_roles x
                  where x.account_id = p_account_id and x.role = 'advertiser')
   order by 3, 2, 1;
end
$$;

comment on function verification.read_account_openings(uuid) is
  'D83 A (0239; modele §5, §6): an active agent or admin in aal2 reads, for a member account other than '
  'his own, what « Lancer la vérification » offers: one row per network line of a creator (account_verified) '
  'and one for an advertiser (brand_verified, no line), with the draft or pending request already open '
  '(id, status, origin) and, for the brand, whether its site has a domain and its internal block exists. '
  'Never a handle, a figure, an agent nor a comment; no row for « Audience vérifiée ». 42501 forbidden '
  'for his own or an unknown account. SECURITY DEFINER owned by influx_verification_definer; EXECUTE for '
  'influx_agent and influx_admin.';

-- 2. Rights on the function, then to its owner (03 P7 rule 5) -------------------------------------------------

revoke all on function verification.read_account_openings(uuid)
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;
grant execute on function verification.read_account_openings(uuid) to influx_agent, influx_admin;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;

alter function verification.read_account_openings(uuid) owner to influx_verification_definer;

revoke create on schema verification from influx_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
end
$$;

-- 3. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  select p.oid::regprocedure::text into v_bad
    from pg_catalog.pg_proc p
   where p.oid = 'verification.read_account_openings(uuid)'::regprocedure
     and (pg_catalog.pg_get_userbyid(p.proowner) <> 'influx_verification_definer'
          or not p.prosecdef
          or p.proconfig is distinct from array['search_path=""']
          or exists (select 1
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                                                           pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                        and (a.grantee = 0
                             or a.grantee::regrole::text <> all (array['influx_agent', 'influx_admin']))));
  if v_bad is not null then
    raise exception 'function without its owner, security, search_path or callers: %', v_bad;
  end if;
  -- NON REVERSIBLE (fiche invariant 10, T9.6): nothing for a member role
  if pg_catalog.has_function_privilege('influx_advertiser',
                                       'verification.read_account_openings(uuid)'::regprocedure, 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_creator',
                                          'verification.read_account_openings(uuid)'::regprocedure,
                                          'EXECUTE') then
    raise exception 'a member role may execute verification.read_account_openings()';
  end if;
  if pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
