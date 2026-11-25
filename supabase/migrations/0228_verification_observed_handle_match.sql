-- =============================================================================
-- 0228_verification_observed_handle_match
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 02 (jalons/l2f/02.md; l2f-fiche.md invariant 7; L2ES-2 of
-- archives/jalons/l2e-fiche.md § Revue; 08 RG25, RG30, RG45). A badge is granted to the line the
-- creator declared, never to another account the agent happened to read: both grants that carry an
-- observed handle compare it with the declared handle of the line.
--
-- 1. verification.normalize_handle(text): the ONE normalisation of a handle (edge spaces, leading
--    `@`, case), IMMUTABLE, SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for
--    anyone else. Reused by L2F commit 08 (identifier changes, queue 6).
-- 2. verification.grant_account_verified() replaced as in 0224 §6.2, plus: the declared handle of the
--    line read under the lock of the request; normalised observed <> normalised declared, or a line
--    without a handle: 22023 observed_handle_mismatch, nothing written (the finding on the code
--    neither). The comparison with the badges of other accounts (edge case l. 800) now goes through
--    the same normalisation (same result: the stored handles are already trimmed).
-- 3. verification.grant_audience_verified() replaced as in 0225 §7, plus the same comparison, the
--    declared handle read in the snapshot of the review token.
-- Signatures, owners, callers and rights unchanged.
--
-- Not here: the routes and screens (the code is a 22023 of the decision; apps/api maps it in a later
-- commit), the queue of identifier changes and its trigger (L2F commit 08), the brand grant (no
-- handle).
--
-- EC-L2F-02 (micro-gaps, the safest choice):
--   EC-L2F-02-1  the MESSAGE and the DETAIL are both observed_handle_mismatch, as code_mismatch.
--   EC-L2F-02-2  the shape of the typed handle is checked first (22023 observed_handle), then the
--                claim, the token and the account, then the code, then the match: a wrong code is
--                still said as such, and a mismatch writes no finding on the code.
--   EC-L2F-02-3  normalisation = lower(ltrim(btrim(handle), '@')), empty -> NULL: the comparison of
--                EC-L2E-08-16 plus the edge spaces; NULL never matches (a line without a handle is
--                never granted).
--
-- ROLLBACK (no data is changed): restore the bodies and comments of
-- verification.grant_account_verified() from 0224 §6.2 and verification.grant_audience_verified()
-- from 0225 §7 (as influx_verification_definer, rights unchanged); then drop function
-- verification.normalize_handle(text).
-- =============================================================================

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;
set role influx_verification_definer;

-- 1. The one normalisation of a handle ---------------------------------------------------------------

create or replace function verification.normalize_handle(p_handle text)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select nullif(pg_catalog.lower(pg_catalog.ltrim(pg_catalog.btrim(p_handle), '@')), '')
$$;

comment on function verification.normalize_handle(text) is
  'L2ES-2 (0228): the one normalisation of a handle compared by the base: edge spaces, leading `@` '
  'and case removed; an empty result is NULL (never equal to anything). Used by the grants of '
  '« Compte vérifié » and « Audience vérifiée » (observed vs declared, and the handle verified '
  'elsewhere) and by the identifier changes of L2F. IMMUTABLE, SECURITY INVOKER owned by '
  'influx_verification_definer, no EXECUTE for anyone.';

revoke all on function verification.normalize_handle(text)
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;

-- the normalisation itself (EC-L2F-02-3), checked by its owner (nobody else may execute it)
do $$
begin
  if verification.normalize_handle(' @Camille_Cuisine ') is distinct from 'camille_cuisine'
     or verification.normalize_handle('@') is not null
     or verification.normalize_handle('   ') is not null
     or verification.normalize_handle(null) is not null then
    raise exception 'verification.normalize_handle() does not normalise as 0228 says';
  end if;
end
$$;

-- 2. Grant « Compte vérifié »: the handle typed is the handle declared (0224 §6.2, plus L2ES-2) -------

create or replace function verification.grant_account_verified(
  p_request_id                     uuid,
  p_review_token                   text,
  p_observed_code                  text,
  p_observed_handle                text,
  p_observed_platform_account_ref  text,
  p_internal_comment               text)
returns table (
  outcome       text,
  badge_id      uuid,
  decided_at    timestamptz,
  sla_breached  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller   uuid := verification.require_agent(false);
  v_handle   text := pg_catalog.btrim(p_observed_handle);
  v_ref      text := nullif(pg_catalog.btrim(p_observed_platform_account_ref), '');
  v_entry    record;
  v_code     record;
  v_declared text;
  v_winner   record;
  v_badge    uuid;
  v_decided  timestamptz;
  v_late     boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if v_handle is null or pg_catalog.char_length(v_handle) not between 1 and 100
     or v_handle ~ '[[:cntrl:]]' then
    raise exception 'observed_handle' using errcode = 'invalid_parameter_value', detail = 'observed_handle';
  end if;
  if v_ref is not null and (pg_catalog.char_length(v_ref) > 100 or v_ref ~ '[[:cntrl:]]') then
    raise exception 'observed_platform_account_ref'
      using errcode = 'invalid_parameter_value', detail = 'observed_platform_account_ref';
  end if;

  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'account_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  if p_review_token is null
     or p_review_token is distinct from verification.request_review_token(p_request_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  -- EC-L2E-08-5, edge case l. 811: a suspended account is closed by the agent, never granted
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;

  -- RG25, CA13: the code typed by the agent, compared with the live code (EC-L2E-08-4)
  select c.id, c.code into v_code
    from verification.ownership_codes c
   where c.request_id = p_request_id and c.kind = 'network' and c.revoked_at is null;
  if not found or pg_catalog.upper(pg_catalog.btrim(p_observed_code)) is distinct from v_code.code then
    raise exception 'code_mismatch' using errcode = 'invalid_parameter_value', detail = 'code_mismatch';
  end if;

  -- L2ES-2 (0228): the handle read on line is the handle the creator declared on the line
  select l.handle into v_declared
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if verification.normalize_handle(v_declared) is null
     or verification.normalize_handle(v_declared) <> verification.normalize_handle(v_handle) then
    raise exception 'observed_handle_mismatch'
      using errcode = 'invalid_parameter_value', detail = 'observed_handle_mismatch';
  end if;

  update verification.ownership_codes c
     set observed_by_account_id        = v_caller,
         observed_at                   = pg_catalog.now(),
         observed_handle               = v_handle,
         observed_platform_account_ref = v_ref
   where c.id = v_code.id;

  -- edge case l. 800 (EC-L2E-08-2, -16): the first finding wins; the second is refused, both escalated
  select b.request_id, b.account_id into v_winner
    from verification.badges b
   where b.account_id <> v_entry.account_id
     and b.network_code = v_entry.network_code
     and b.level = 'account_verified'
     and b.state in ('active', 'to_refresh', 'to_reconfirm')
     and (verification.normalize_handle(b.observed_handle_at_decision)
            = verification.normalize_handle(v_handle)
          or (v_ref is not null and b.observed_platform_account_ref = v_ref))
   order by b.granted_at, b.id
   limit 1;
  if found then
    update verification.verification_requests r
       set status                = 'rejected',
           decided_by_account_id = v_caller,
           decided_at            = pg_catalog.now(),
           closed_at             = pg_catalog.now(),
           rejection_reason_code = 'ownership_not_proven',
           internal_comment      = p_internal_comment,
           escalated_at          = pg_catalog.now()
     where r.id = p_request_id
    returning r.decided_at, r.sla_breached into v_decided, v_late;
    update verification.verification_requests r
       set escalated_at = coalesce(r.escalated_at, pg_catalog.now())
     where r.id = v_winner.request_id;

    perform verification.queue_decision(p_request_id, v_entry.account_id, false);
    perform audit.append('verification.rejected', 'verification_request', p_request_id,
                         pg_catalog.jsonb_build_object('level', v_entry.level,
                                                       'reason_code', 'ownership_not_proven',
                                                       'late', v_late));
    perform audit.append('verification.escalated', 'verification_request', p_request_id,
                         pg_catalog.jsonb_build_object('level', v_entry.level,
                                                       'reason_code', 'ownership_not_proven',
                                                       'cause', 'handle_already_verified'));
    perform audit.append('verification.escalated', 'verification_request', v_winner.request_id,
                         pg_catalog.jsonb_build_object('level', 'account_verified',
                                                       'cause', 'handle_already_verified'));
    return query select 'handle_already_verified'::text, null::uuid, v_decided, v_late;
    return;
  end if;

  -- EC-L2E-14: a holding badge of the line (to_reconfirm) is replaced, never doubled
  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
     and b.level = 'account_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  update verification.verification_requests r
     set status                = 'approved',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  -- RG30, EC-L2E-05-8: the ownership of an account has no expiry
  insert into verification.badges
    (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
     granted_at, evidence_source, observed_handle_at_decision, observed_platform_account_ref)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, p_request_id,
          'account_verified', v_caller, v_decided, 'public_profile', v_handle, v_ref)
  returning id into v_badge;

  perform verification.queue_decision(p_request_id, v_entry.account_id, true);
  perform audit.append('verification.granted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level, 'badge_id', v_badge,
                                                     'late', v_late));
  return query select 'granted'::text, v_badge, v_decided, v_late;
end
$$;

comment on function verification.grant_account_verified(uuid, text, text, text, text, text) is
  '08 RG25, RG30, RG45, RG47, RG51, CA13, CA14, edge case l. 800 (0224, 0228): the holder of a live '
  'claim grants « Compte vérifié »: the code he read on line compared with the live code of the '
  'request (case and spaces ignored), the handle he typed compared with the handle DECLARED on the '
  'line through verification.normalize_handle() (L2ES-2), then recorded (with the stable reference '
  'when shown) with his identity and the instant on the code. A holding account badge of ANOTHER '
  'account on that handle: the request rejected ownership_not_proven, both requests escalated, '
  'outcome handle_already_verified (EC-L2E-08-2). Otherwise the request approved, a badge active '
  'without expiry (a holding one replaced), verification.decision and lead.updated queued, '
  'verification.granted {level, badge_id, late}. Returns (outcome, badge_id, decided_at, '
  'sla_breached). 22023 observed_handle, observed_platform_account_ref, internal_comment, level, '
  'code_mismatch or observed_handle_mismatch (another handle, or a line without one: nothing '
  'written); 55000 stale_token or account_unavailable; then the refusals of '
  'verification.lock_held_request(). SECURITY DEFINER owned by influx_verification_definer; EXECUTE '
  'for influx_agent and influx_admin.';

-- 3. Grant « Audience vérifiée »: the same comparison (0225 §7, plus L2ES-2) --------------------------

create or replace function verification.grant_audience_verified(
  p_request_id          uuid,
  p_review_token        text,
  p_followers           bigint,
  p_posts_last_30_days  integer,
  p_avg_comments        bigint,
  p_engagement_bp       integer,
  p_period_start        date,
  p_period_end          date,
  p_observed_handle     text,
  p_internal_comment    text)
returns table (
  outcome       text,
  badge_id      uuid,
  decided_at    timestamptz,
  sla_breached  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller   uuid := verification.require_agent(false);
  v_handle   text := pg_catalog.btrim(p_observed_handle);
  v_entry    record;
  v_line     record;
  v_days     integer;
  v_badge    uuid;
  v_decided  timestamptz;
  v_late     boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if v_handle is null or pg_catalog.char_length(v_handle) not between 1 and 100
     or v_handle ~ '[[:cntrl:]]' then
    raise exception 'observed_handle' using errcode = 'invalid_parameter_value', detail = 'observed_handle';
  end if;
  perform verification.check_observed_figures(p_followers, p_posts_last_30_days, p_avg_comments,
                                              p_engagement_bp);
  perform verification.check_observed_period(p_period_start, p_period_end);

  select * into v_entry from verification.lock_held_request(p_request_id, v_caller);
  if v_entry.level <> 'audience_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  -- the declared figures kept at the decision and the token, in ONE snapshot (RG40, CA26)
  select l.handle, l.followers_count, l.posts_last_30_days, l.avg_comments_per_post,
         l.engagement_rate_bp, verification.request_review_token(p_request_id) as token
    into v_line
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if not found or p_review_token is null or p_review_token is distinct from v_line.token then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;
  -- L2ES-2 (0228): the handle read again is the handle the creator declared on the line
  if verification.normalize_handle(v_line.handle) is null
     or verification.normalize_handle(v_line.handle) <> verification.normalize_handle(v_handle) then
    raise exception 'observed_handle_mismatch'
      using errcode = 'invalid_parameter_value', detail = 'observed_handle_mismatch';
  end if;
  -- RG12: the audience of an account whose ownership is not established is never granted
  if not exists (select 1 from verification.badges b
                  where b.account_id = v_entry.account_id
                    and b.social_account_id = v_entry.social_account_id
                    and b.level = 'account_verified' and b.state = 'active') then
    raise exception 'ownership_prerequisite'
      using errcode = 'object_not_in_prerequisite_state', detail = 'ownership_prerequisite';
  end if;
  -- -13: at least one active evidence was examined
  if not exists (select 1 from verification.evidence_files e
                  where e.request_id = p_request_id and e.state = 'active') then
    raise exception 'missing_evidence'
      using errcode = 'object_not_in_prerequisite_state', detail = 'missing_evidence';
  end if;
  -- EC-L2E-08-11: 04 l. 6391 keeps the declared posts and comments on the badge
  if v_line.posts_last_30_days is null or v_line.avg_comments_per_post is null then
    raise exception 'declared_figures_required'
      using errcode = 'check_violation', detail = 'declared_figures_required';
  end if;
  select (s.value)::integer into v_days
    from backoffice.operational_settings s where s.key = 'audience_badge_validity_days';
  if v_days is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- EC-L2E-14, 08 edge case l. 801: a refresh replaces the holding badge, its date and expiry anew
  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
     and b.level = 'audience_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  update verification.verification_requests r
     set status                = 'approved',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         closed_at             = pg_catalog.now(),
         internal_comment      = p_internal_comment
   where r.id = p_request_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  -- RG69, EC-L2E-1: 90 days (the parameter) from the decision
  insert into verification.badges
    (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
     granted_at, evidence_source, observed_followers, observed_posts_last_30_days,
     observed_avg_comments, observed_engagement_bp, observed_period_start, observed_period_end,
     declared_followers_at_decision, declared_posts_at_decision, declared_comments_at_decision,
     declared_engagement_bp_at_decision, observed_handle_at_decision, expires_at)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, p_request_id,
          'audience_verified', v_caller, v_decided, 'native_dashboard', p_followers,
          p_posts_last_30_days, p_avg_comments, p_engagement_bp, p_period_start, p_period_end,
          v_line.followers_count, v_line.posts_last_30_days, v_line.avg_comments_per_post,
          v_line.engagement_rate_bp, v_handle,
          v_decided + pg_catalog.make_interval(days => v_days))
  returning id into v_badge;

  -- 07 RG119 (0225, EC-L2E-09-5): the three observed metrics in the history, by the agent
  insert into profiles.creator_network_metrics_history
    (account_id, social_account_id, network_code, followers_count, posts_last_30_days,
     avg_comments_per_post, figures_source, confirmed, recorded_by_account_id)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, p_followers,
          p_posts_last_30_days, p_avg_comments, 'agent_observed', true, v_caller);
  -- 08 RG20 (0225): the public bands of the line derived by the system from the badge
  perform profiles.refresh_creator_public_network(v_entry.social_account_id);

  perform verification.queue_decision(p_request_id, v_entry.account_id, true);
  perform audit.append('verification.granted', 'verification_request', p_request_id,
                       pg_catalog.jsonb_build_object('level', v_entry.level, 'badge_id', v_badge,
                                                     'late', v_late));
  return query select 'granted'::text, v_badge, v_decided, v_late;
end
$$;

comment on function verification.grant_audience_verified(uuid, text, bigint, integer, bigint, integer, date, date, text, text) is
  '08 RG12, RG20, RG36 to RG38bis, RG40, RG47, RG69, CA26, CA27, cas limite 2 (0224, 0225, 0228): '
  'the holder of a live claim grants « Audience vérifiée » with the figures he TYPED (followers, '
  'posts of the last 30 days, average comments; engagement optional), the period of the capture and '
  'the handle read again (RG30), compared with the handle DECLARED on the line through '
  'verification.normalize_handle() (L2ES-2). Requires an active « Compte vérifié » on the line (55000 '
  'ownership_prerequisite), an active evidence (55000 missing_evidence), an active account. The '
  'request approved; a badge active until decision + audience_badge_validity_days, carrying the '
  'declared figures of the line at the decision beside the observed ones (never overwritten), a '
  'holding one replaced; the observed figures historised (07 RG119, agent_observed, confirmed, by the '
  'agent); the public bands of the line derived from the badge (0225, '
  'profiles.refresh_creator_public_network); the retention of the evidence recomputed by the trigger of 0223; '
  'verification.decision and lead.updated queued; verification.granted {level, badge_id, late}. '
  'Returns (granted, badge_id, decided_at, sla_breached). 22023 figures_invalid, period_invalid, '
  'observed_handle, observed_handle_mismatch (another handle, or a line without one: nothing '
  'written), internal_comment or level; 55000 stale_token or account_unavailable; 23514 '
  'declared_figures_required; then the refusals of verification.lock_held_request(). SECURITY '
  'DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

reset role;
revoke create on schema verification from influx_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
end
$$;

-- 4. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- the three functions: owner, security, volatility, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('verification.normalize_handle(text)', false, 'i', array[]::text[]),
      ('verification.grant_account_verified(uuid,text,text,text,text,text)', true, 'v',
       array['influx_agent', 'influx_admin']),
      ('verification.grant_audience_verified(uuid,text,bigint,integer,bigint,integer,date,date,text,text)',
       true, 'v', array['influx_agent', 'influx_admin'])
    ) as f (sig, definer, volatility, callers)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> 'influx_verification_definer'
      or p.prosecdef <> f.definer
      or p.provolatile <> f.volatility
      or p.proconfig is distinct from array['search_path=""']
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0 or a.grantee::regrole::text <> all (f.callers)));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, volatility, search_path or callers: %',
      v_bad;
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_verification_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE') then
    raise exception 'influx_verification_definer left with CREATE on the schema verification';
  end if;
end
$$;
