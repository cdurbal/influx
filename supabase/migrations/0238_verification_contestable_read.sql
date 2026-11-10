-- =============================================================================
-- 0238_verification_contestable_read
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 14 (jalons/l2f/14.md; l2f/modele.md §1 points 7, 8, §5; l2f-fiche.md invariants 6,
-- 10, 13; 08 RG77, CA52). A creator reads, on his own space, the decisions he may still contest: the
-- refusal of a request (status rejected) and the withdrawal under 2V of a badge, each within
-- dispute_window_days of its notification, none already contested, with the reason of the decision and,
-- for a withdrawal, the agent's own message to the member. The member roles read no parameter
-- (operational_settings is the team's), nor the message of a withdrawal (badge_revocation_requests is
-- internal), and cannot tell a withdrawal under 2V from the audience carried along by a withdrawn
-- « Compte vérifié » (EC-L2F-07-5): one read, no table, no data.
--
--   verification.read_own_contestable_decisions()   for an ACTIVE creator account (42501 otherwise):
--         one row (window_days, decisions jsonb); decisions is the array of the decisions of his own, newest
--         first, each {kind: refusal | revocation, request_id, badge_id, level, network_code, reason_code,
--         member_message (a withdrawal only), decided_at, closes_at}. A refusal: a request of the account,
--         population creator, status rejected, with a reason, not contested. A withdrawal: a badge of the
--         account revoked under a 2V that named THIS badge and was executed (the audience carried along and
--         the revocation of an erasure are not contestable), not contested. Never the deciders, an agent,
--         the lock, the deadlines nor a figure. STABLE. SECURITY DEFINER owned by
--         influx_creator_verification_definer, empty search_path; EXECUTE for influx_creator ONLY.
--   influx_creator_verification_definer   named columns: verification.badges.revocation_reason_code,
--         verification.badge_revocation_requests.reason_code and .member_message (its policy on the account
--         exists since 0232). Nothing for influx_advertiser (T9.6).
--
-- EC-L2F-14-1  0238 is the next free number (ls supabase/migrations). A read of the member needs a grant
--              and a function: the commit carries a migration although its title is « api ».
-- EC-L2F-14-2  one row with the window and the array (a decision-per-row table could not carry the window
--              of an account that has no decision to contest).
--
-- ROLLBACK (before the API reads it): drop function verification.read_own_contestable_decisions();
-- revoke select (reason_code, member_message) on verification.badge_revocation_requests and select
-- (revocation_reason_code) on verification.badges from influx_creator_verification_definer.
-- =============================================================================

-- 1. The columns the definer may read ---------------------------------------------------------------------

grant select (revocation_reason_code)
   on verification.badges to influx_creator_verification_definer;
grant select (reason_code, member_message)
   on verification.badge_revocation_requests to influx_creator_verification_definer;

-- 2. The read -----------------------------------------------------------------------------------------------

create or replace function verification.read_own_contestable_decisions()
returns table (
  window_days  integer,
  decisions    jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_window   integer;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
           where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select (s.value #>> '{}')::integer into v_window
    from backoffice.operational_settings s where s.key = 'dispute_window_days';
  if v_window is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  return query
    select v_window,
           coalesce((select pg_catalog.jsonb_agg(d.item order by d.decided_at desc, d.id)
                       from (
                         select r.id, r.decided_at,
                                pg_catalog.jsonb_build_object(
                                  'kind', 'refusal',
                                  'request_id', r.id,
                                  'badge_id', null,
                                  'level', r.level::text,
                                  'network_code', r.network_code,
                                  'reason_code', r.rejection_reason_code,
                                  'member_message', null,
                                  'decided_at', r.decided_at,
                                  'closes_at', r.decided_at + pg_catalog.make_interval(days => v_window)
                                ) as item
                           from verification.verification_requests r
                          where r.account_id = v_account and r.population = 'creator'
                            and r.level <> 'brand_verified' and r.status = 'rejected'
                            and r.rejection_reason_code is not null and r.decided_at is not null
                            and pg_catalog.now() <= r.decided_at + pg_catalog.make_interval(days => v_window)
                            and not exists (select 1 from verification.disputes x
                                             where x.request_id = r.id)
                         union all
                         select b.id, b.revoked_at,
                                pg_catalog.jsonb_build_object(
                                  'kind', 'revocation',
                                  'request_id', null,
                                  'badge_id', b.id,
                                  'level', b.level::text,
                                  'network_code', b.network_code,
                                  'reason_code', b.revocation_reason_code,
                                  'member_message', q.member_message,
                                  'decided_at', b.revoked_at,
                                  'closes_at', b.revoked_at + pg_catalog.make_interval(days => v_window)
                                ) as item
                           from verification.badges b
                           join verification.badge_revocation_requests q
                             on q.dual_control_request_id = b.revocation_request_id
                            and q.badge_id = b.id and q.executed_at is not null
                          where b.account_id = v_account and b.level <> 'brand_verified'
                            and b.state = 'revoked' and b.revoked_at is not null
                            and b.revocation_reason_code is not null
                            and q.requested_by_account_id is not null
                            and pg_catalog.now() <= b.revoked_at + pg_catalog.make_interval(days => v_window)
                            and not exists (select 1 from verification.disputes x
                                             where x.badge_id = b.id)
                       ) d), '[]'::pg_catalog.jsonb);
end
$$;

comment on function verification.read_own_contestable_decisions() is
  '08 RG77, CA52 (0238; l2f/modele.md §1 points 7, 8): the decisions an active creator may still contest, '
  'one row (window_days, decisions jsonb): his refusals (status rejected, with a reason) and the '
  'withdrawals under 2V of a badge the 2V named (executed), each within dispute_window_days of its '
  'notification and not already contested, newest first; each with its reason, a withdrawal with the '
  'agent''s message to the member. Never the deciders, an agent, the lock, the deadlines nor a figure. '
  '42501 outside an active creator. STABLE. SECURITY DEFINER owned by '
  'influx_creator_verification_definer, empty search_path; EXECUTE for influx_creator ONLY.';

revoke all on function verification.read_own_contestable_decisions()
  from public, anon, authenticated, service_role, influx_advertiser, influx_agent, influx_admin;
grant execute on function verification.read_own_contestable_decisions() to influx_creator;

-- Hand the function to its owner (03 P7 rule 5, window of 0004 §9)
do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_creator_verification_definer;

alter function verification.read_own_contestable_decisions()
  owner to influx_creator_verification_definer;

revoke create on schema verification from influx_creator_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_verification_definer', current_user);
end
$$;

-- 3. End-state assertions -----------------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'verification.read_own_contestable_decisions()'::regprocedure)
        <> 'influx_creator_verification_definer'
     or not (select prosecdef from pg_catalog.pg_proc
              where oid = 'verification.read_own_contestable_decisions()'::regprocedure)
     or (select proconfig from pg_catalog.pg_proc
          where oid = 'verification.read_own_contestable_decisions()'::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception 'verification.read_own_contestable_decisions() must be owned by influx_creator_verification_definer, SECURITY DEFINER, empty search_path';
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = 'verification.read_own_contestable_decisions()'::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_creator');
  if v_bad is not null then
    raise exception 'verification.read_own_contestable_decisions() executable by: %', v_bad;
  end if;
  -- NON REVERSIBLE (fiche invariant 10): still nothing for influx_advertiser on the schema
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'verification'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'influx_advertiser may execute: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_creator_verification_definer', 'verification', 'CREATE') then
    raise exception 'influx_creator_verification_definer left with a window of ownership';
  end if;
end
$$;
