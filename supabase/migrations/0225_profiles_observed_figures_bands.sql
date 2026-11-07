-- =============================================================================
-- 0225_profiles_observed_figures_bands
-- -----------------------------------------------------------------------------
-- Lot 2 / L2E, commit 09 (jalons/l2e/09.md; l2e/modele.md §1 point 4, §4 "Dérivation", which
-- prevails for every name; fiche invariant 8; 08 RG19, RG20, RG38bis to RG41, RG48; 07 RG22, RG48,
-- RG114 to RG119; L2DS-2 of archives/jalons/l2d/revue-constats-securite.md). The observed figures of
-- the holding audience badge feed the public bands of the line; the declared figures stay where they
-- are and never touch a public value while the badge holds.
--
-- 1. profiles.creator_social_accounts is the DECLARED side only (modele point 4): its source is
--    constrained to 'declared' (same constraint name). Nothing observed is ever written there, so no
--    member write can carry an « observed » label (L2DS-2 closed by construction, EC-L2E-09-6).
-- 2. profiles.creator_public_networks: creator_public_networks_engagement_unverified becomes « an
--    engagement band only with an observation » (RG48), and an observed row is dated.
-- 3. influx_identity_definer, owner of the derivations (L2DS-5 extended, modele §4): reads the
--    observed figures of the audience badges of creator accounts (never the handle, the reference
--    nor the declared values at the decision), and the bounds of reference.engagement_bands.
-- 4. influx_verification_definer: INSERT of the decision's history row (RG119, agent_observed,
--    confirmed, its own account as author), EXECUTE on profiles.refresh_creator_public_network().
-- 5. profiles.refresh_creator_public_network(uuid) replaced: the holding audience badge of the line
--    (active, to_refresh) gives followers, posts, comments and engagement, source agent_observed,
--    date granted_at; without one, the declared figures, source declared, the declared date, no
--    engagement band (RG48). The reach band stays declared (RG39). Comparison with the active bounds
--    only, never a multiplication nor a division (T16.1).
-- 6. Reprise: every line derived again (no badge on staging: nothing moves).
-- 7. verification.grant_audience_verified() replaced as in 0224, plus, after the badge: the history
--    row of the observed figures (RG119) and the derivation of the line (RG20).
--
-- Not here: the expiry, the withdrawal and their calls of the derivation (L2F), the export and the
-- erasure of the verification data (0226), any route, the bounds of the bands (L2DS-6).
--
-- EC-L2E-09 (micro-gaps, the safest choice):
--   EC-L2E-09-1  only the audience grant derives: the account and brand badges carry no figure
--                (modele point 4), their grants change no public value (the note of commit 08 said
--                « three grants »; modele.md prevails).
--   EC-L2E-09-2  the return to the declared prepared for L2F is refresh_creator_public_network()
--                itself: a line without a holding audience badge derives from the declared. L2F
--                calls it after moving the state of a badge (expired, revoked); no trigger here.
--   EC-L2E-09-3  holding = active or to_refresh (modele point 4); to_reconfirm and the ended states
--                derive from the declared.
--   EC-L2E-09-4  the engagement band comes from observed_engagement_bp only; a declared engagement
--                never gives a band, an audience badge without an engagement leaves it null (RG48,
--                EC-L2E-12).
--   EC-L2E-09-5  the history row of a decision is written by the decision (confirmed true: the three
--                metrics observed together, RG116); its author is the agent of the session.
--   EC-L2E-09-6  L2DS-2: the trigger proposed by the review is not needed; the CHECK on the source of
--                the line makes an observed value on the declared side impossible, whoever writes.
--   EC-L2E-09-7  the constraint name creator_public_networks_engagement_unverified is kept with the
--                new expression; creator_public_networks_observed_dated added.
--
-- ROLLBACK (before any audience badge is granted): restore the function bodies of 0218 §5 and 0224
-- §6.3; revoke EXECUTE on profiles.refresh_creator_public_network(uuid) from
-- influx_verification_definer; drop the policies *_0225 named below and revoke their grants; restore
-- the two CHECKs of 0217 and 0218.
-- =============================================================================

-- 1. The declared side of a line (modele point 4, L2DS-2) ----------------------------------------------

alter table profiles.creator_social_accounts
  drop constraint if exists creator_social_accounts_figures_source;
alter table profiles.creator_social_accounts
  add constraint creator_social_accounts_figures_source check (figures_source = 'declared');

comment on column profiles.creator_social_accounts.figures_source is
  'Always declared (0225, modele.md point 4, L2DS-2): the line is what the creator says. The observed '
  'figures live on verification.badges and reach the public row through '
  'profiles.refresh_creator_public_network(), never through this table.';

-- 2. The public row: an engagement band only with an observation (RG48) -------------------------------

alter table profiles.creator_public_networks
  drop constraint if exists creator_public_networks_engagement_unverified;
alter table profiles.creator_public_networks
  add constraint creator_public_networks_engagement_unverified
  check (engagement_band is null or figures_source = 'agent_observed');
alter table profiles.creator_public_networks
  drop constraint if exists creator_public_networks_observed_dated;
alter table profiles.creator_public_networks
  add constraint creator_public_networks_observed_dated
  check (figures_source <> 'agent_observed' or figures_measured_at is not null);

comment on column profiles.creator_public_networks.engagement_band is
  'Band of the engagement OBSERVED by an agent (07 RG48, 08 RG38, 0225): null without a holding '
  'audience badge, or when the agent read no engagement; never from a declared rate.';
comment on column profiles.creator_public_networks.figures_source is
  'agent_observed while an audience badge of the line holds (active, to_refresh), declared otherwise '
  '(08 RG19, RG39, 0225).';
comment on column profiles.creator_public_networks.figures_measured_at is
  'The date of the figures: granted_at of the holding audience badge, or the declared date of the '
  'line (07 RG50).';

-- 3. What the derivation reads (influx_identity_definer, L2DS-5 extended) -----------------------------

-- 3.1 the observed figures of an audience badge of a creator account (0222 gave the brand columns)
grant select (observed_followers, observed_posts_last_30_days, observed_avg_comments,
              observed_engagement_bp)
   on verification.badges to influx_identity_definer;

drop policy if exists badges_identity_definer_select_audience_0225 on verification.badges;
create policy badges_identity_definer_select_audience_0225 on verification.badges
  for select to influx_identity_definer
  using (level = 'audience_verified'
         and exists (select 1 from identity.account_roles r
                      where r.account_id = badges.account_id and r.role = 'creator'));

-- 3.2 the bounds of the engagement bands, every row (reference list, as 0218 §3.1)
grant select (code, min_rate_bp, max_rate_bp, retired_at)
   on reference.engagement_bands to influx_identity_definer;

drop policy if exists engagement_bands_read_identity_definer on reference.engagement_bands;
create policy engagement_bands_read_identity_definer on reference.engagement_bands
  for select to influx_identity_definer
  using (true);

-- 4. What the decision writes (influx_verification_definer) -------------------------------------------

-- 4.1 RG119: the observed figures of the decision in the history, by the agent of the session
grant insert (account_id, social_account_id, network_code, followers_count, posts_last_30_days,
              avg_comments_per_post, figures_source, confirmed, recorded_by_account_id)
   on profiles.creator_network_metrics_history to influx_verification_definer;

drop policy if exists creator_network_metrics_history_verification_definer_insert_0225
  on profiles.creator_network_metrics_history;
create policy creator_network_metrics_history_verification_definer_insert_0225
  on profiles.creator_network_metrics_history
  for insert to influx_verification_definer
  with check (figures_source = 'agent_observed'
              and confirmed
              and recorded_by_account_id = (select influx.current_account_id())
              and account_id is distinct from (select influx.current_account_id())
              and exists (select 1 from identity.account_roles r
                           where r.account_id = creator_network_metrics_history.account_id
                             and r.role = 'creator'));

-- 5. The derivation of a line, replaced (03 P7 rule 5: as its owner, window of 0218 §8) ----------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema profiles to influx_identity_definer;
set role influx_identity_definer;

create or replace function profiles.refresh_creator_public_network(p_social_account_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- modele point 4: the holding audience badge of the line gives the figures, otherwise the declared
  -- line (EC-L2E-09-2, -3); RG22, RG45, RG114, RG115: each band is the active code whose bounds hold
  -- the value (bounds included, the last one open); no value, no band. RG39: the reach stays
  -- declared. RG48 (EC-L2E-09-4): an engagement band from an observed engagement only.
  insert into profiles.creator_public_networks
    (social_account_id, account_id, network_code, is_primary, audience_band, reach_band,
     publication_frequency_code, comment_band, engagement_band, figures_source,
     figures_measured_at)
  select s.id, s.account_id, s.network_code, s.is_primary,
         (select b.code from reference.audience_bands b
           where (b.retired_at is null or b.retired_at > pg_catalog.now())
             and v.followers >= b.min_followers
             and (b.max_followers is null or v.followers <= b.max_followers)
           order by b.min_followers desc limit 1),
         (select b.code from reference.audience_bands b
           where (b.retired_at is null or b.retired_at > pg_catalog.now())
             and s.avg_reach_per_post >= b.min_followers
             and (b.max_followers is null or s.avg_reach_per_post <= b.max_followers)
           order by b.min_followers desc limit 1),
         (select f.code from reference.publication_frequencies f
           where (f.retired_at is null or f.retired_at > pg_catalog.now())
             and v.posts >= f.min_posts_30d
             and (f.max_posts_30d is null or v.posts <= f.max_posts_30d)
           order by f.min_posts_30d desc limit 1),
         (select c.code from reference.comment_bands c
           where (c.retired_at is null or c.retired_at > pg_catalog.now())
             and v.comments >= c.min_comments
             and (c.max_comments is null or v.comments <= c.max_comments)
           order by c.min_comments desc limit 1),
         (select e.code from reference.engagement_bands e
           where (e.retired_at is null or e.retired_at > pg_catalog.now())
             and v.engagement_bp >= e.min_rate_bp
             and (e.max_rate_bp is null or v.engagement_bp <= e.max_rate_bp)
           order by e.min_rate_bp desc limit 1),
         v.source,
         v.measured_at
    from profiles.creator_social_accounts s
    left join lateral (
      select o.granted_at, o.observed_followers, o.observed_posts_last_30_days,
             o.observed_avg_comments, o.observed_engagement_bp
        from verification.badges o
       where o.account_id = s.account_id
         and o.social_account_id = s.id
         and o.level = 'audience_verified'
         and o.state in ('active', 'to_refresh')
       order by o.granted_at desc
       limit 1) h on true
    cross join lateral (
      select case when h.granted_at is null then s.followers_count
                  else h.observed_followers end as followers,
             case when h.granted_at is null then s.posts_last_30_days
                  else h.observed_posts_last_30_days end as posts,
             case when h.granted_at is null then s.avg_comments_per_post
                  else h.observed_avg_comments end as comments,
             case when h.granted_at is null then null::integer
                  else h.observed_engagement_bp end as engagement_bp,
             case when h.granted_at is null then 'declared'
                  else 'agent_observed' end as source,
             case when h.granted_at is null then s.figures_measured_at
                  else h.granted_at end as measured_at) v
   where s.id = p_social_account_id
  on conflict (social_account_id) do update
     set network_code               = excluded.network_code,
         is_primary                 = excluded.is_primary,
         audience_band              = excluded.audience_band,
         reach_band                 = excluded.reach_band,
         publication_frequency_code = excluded.publication_frequency_code,
         comment_band               = excluded.comment_band,
         engagement_band            = excluded.engagement_band,
         figures_source             = excluded.figures_source,
         figures_measured_at        = excluded.figures_measured_at;
end
$$;

comment on function profiles.refresh_creator_public_network(uuid) is
  '0218, 0225 (modele.md point 4; 07 RG22, RG45, RG48, RG114, RG115; 08 RG20, RG39): (re)writes the '
  'row of creator_public_networks of one line. With a holding audience badge of the line (active, '
  'to_refresh): followers, posts, comments and engagement OBSERVED, source agent_observed, date '
  'granted_at; otherwise the declared figures, source declared, the declared date, no engagement '
  'band. Reach always declared. Bands by comparison with the active bounds of reference.*_bands, '
  'never a computation; no exact value written. Also the return to the declared of L2F, called once '
  'a badge leaves the holding states (EC-L2E-09-2). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path; EXECUTE for influx_verification_definer only (the '
  'audience grant); the derivations and the reprise call it as its owner.';

revoke all on function profiles.refresh_creator_public_network(uuid)
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;
grant execute on function profiles.refresh_creator_public_network(uuid)
   to influx_verification_definer;

-- 6. Reprise: every line derived again, as the owner (replayed by db-tests/verification-bands.test.ts)
-- <reprise>
do $$
declare
  v_row  record;
begin
  for v_row in select s.id from profiles.creator_social_accounts s order by s.id loop
    perform profiles.refresh_creator_public_network(v_row.id);
  end loop;
end
$$;
-- </reprise>

reset role;
revoke create on schema profiles from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 7. The audience grant, replaced as its owner (0224 §6.3, plus RG119 and RG20) -------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;
set role influx_verification_definer;

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
  select l.followers_count, l.posts_last_30_days, l.avg_comments_per_post, l.engagement_rate_bp,
         verification.request_review_token(p_request_id) as token
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
  '08 RG12, RG20, RG36 to RG38bis, RG40, RG47, RG69, CA26, CA27, cas limite 2 (0224, 0225): the '
  'holder of a live claim grants « Audience vérifiée » with the figures he TYPED (followers, posts of '
  'the last 30 days, average comments; engagement optional), the period of the capture and the '
  'handle read again (RG30). Requires an active « Compte vérifié » on the line (55000 '
  'ownership_prerequisite), an active evidence (55000 missing_evidence), an active account. The '
  'request approved; a badge active until decision + audience_badge_validity_days, carrying the '
  'declared figures of the line at the decision beside the observed ones (never overwritten), a '
  'holding one replaced; the observed figures historised (07 RG119, agent_observed, confirmed, by the '
  'agent); the public bands of the line derived from the badge (0225, '
  'profiles.refresh_creator_public_network); the retention of the evidence recomputed by the trigger of 0223; '
  'verification.decision and lead.updated queued; verification.granted {level, badge_id, late}. '
  'Returns (granted, badge_id, decided_at, sla_breached). 22023 figures_invalid, period_invalid, '
  'observed_handle, internal_comment or level; 55000 stale_token or account_unavailable; 23514 '
  'declared_figures_required; then the refusals of verification.lock_held_request(). SECURITY '
  'DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

reset role;
revoke create on schema verification from influx_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
end
$$;

-- 8. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- the two replaced functions: owner, security, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('profiles.refresh_creator_public_network(uuid)', 'influx_identity_definer',
       array['influx_verification_definer']),
      ('verification.grant_audience_verified(uuid,text,bigint,integer,bigint,integer,date,date,text,text)',
       'influx_verification_definer', array['influx_agent', 'influx_admin'])
    ) as f (sig, owner, callers)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> f.owner
      or not p.prosecdef
      or p.proconfig is distinct from array['search_path=""']
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0 or a.grantee::regrole::text <> all (f.callers)));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, search_path or callers: %', v_bad;
  end if;

  -- NON REVERSIBLE (fiche invariant 1, EC-L2E-18, P5): nothing for influx_advertiser on the schema
  -- verification nor on a creator object
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.relnamespace = 'profiles'::regnamespace
     and c.relname like 'creator\_%'
     and c.relkind in ('r', 'p', 'v', 'm')
     and (pg_catalog.has_table_privilege('influx_advertiser', c.oid,
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          or pg_catalog.has_any_column_privilege('influx_advertiser', c.oid,
                                                 'SELECT, INSERT, UPDATE, REFERENCES'));
  if v_bad is not null then
    raise exception 'influx_advertiser holds a right on: %', v_bad;
  end if;

  -- -18: the owner of the derivations (and of the brand doors) never reads an evidence row
  if pg_catalog.has_any_column_privilege('influx_identity_definer', 'verification.evidence_files',
                                         'SELECT, INSERT, UPDATE, REFERENCES')
     or pg_catalog.has_table_privilege('influx_identity_definer', 'verification.evidence_files',
                                       'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') then
    raise exception 'influx_identity_definer holds a right on verification.evidence_files';
  end if;
  -- nor the handle, the reference or the declared values of a badge (the derivation needs none)
  select string_agg(col, ', ') into v_bad
    from unnest(array['observed_handle_at_decision', 'observed_platform_account_ref',
                      'declared_followers_at_decision', 'declared_posts_at_decision',
                      'declared_comments_at_decision', 'declared_engagement_bp_at_decision',
                      'granted_by_account_id']) col
   where pg_catalog.has_column_privilege('influx_identity_definer', 'verification.badges', col,
                                         'SELECT');
  if v_bad is not null then
    raise exception 'influx_identity_definer reads the badge column(s): %', v_bad;
  end if;

  -- still no member nor internal role writing a public row, the source, the date or the history
  select string_agg(r.rolname || '.' || t.tab || '.' || t.priv, ', ') into v_bad
    from pg_catalog.pg_roles r,
         (values ('creator_public_networks', 'INSERT'), ('creator_public_networks', 'UPDATE'),
                 ('creator_public_networks', 'DELETE'),
                 ('creator_network_metrics_history', 'INSERT')) as t (tab, priv)
   where r.rolname in ('influx_creator', 'influx_advertiser', 'influx_agent', 'influx_admin',
                       'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and (pg_catalog.has_table_privilege(r.oid, 'profiles.' || t.tab, t.priv)
          or (t.priv <> 'DELETE'
              and pg_catalog.has_any_column_privilege(r.oid, 'profiles.' || t.tab, t.priv)));
  if v_bad is not null then
    raise exception 'unexpected write right(s): %', v_bad;
  end if;

  -- the reprise: every line holds its derived row; no engagement band without an observation
  select string_agg(s.id::text, ', ') into v_bad
    from profiles.creator_social_accounts s
   where not exists (select 1 from profiles.creator_public_networks n where n.social_account_id = s.id);
  if v_bad is not null then
    raise exception 'network line(s) without a derived row: %', v_bad;
  end if;

  -- no definer role left usable nor with CREATE on a schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_identity_definer', 'influx_verification_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'profiles', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE') then
    raise exception 'a definer role left with CREATE on a schema';
  end if;
end
$$;
