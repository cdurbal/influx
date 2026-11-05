-- =============================================================================
-- 0215_profiles_brand_review_owner_and_lock
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, fix-2 (jalons/l2c/fix-2.md; review findings L2CS-1, L2CS-2, L2CS-3, L2CT-4; fiche
-- invariants 1, 2, 4, 11, 15; 06 RG6, 15 RG36, RG110, CA19). Three corrections of the database side
-- of queue 1, no new table, no new role, no new right of an execution role:
--
--   L2CS-1  profiles.open_advertiser_review_entry() locks the PROFILE row FOR UPDATE, then the entry
--         (the order of publish and reject, 0210 §7.6): no member write (the profile row, or the
--         FOR SHARE the guard of 0209 takes before a list, contact or logo write) lands between the
--         version token the opening renders and the decision view apps/api reads next in the same
--         transaction (the ABA of the review: token = P1, view = P2).
--   L2CS-2  15 RG36 held in the database too: open (an open entry; a closed one still answers
--         `closed`), publish, reject, extend and read_advertiser_review_logo refuse 42501, the one
--         answer of an unknown entry, when identity.accounts.owner_agent_id of the entry's account is
--         the caller. Release and the forced release stay open to him (he gives a claim back, never
--         decides). influx_moderation_definer reads that one more column (its policy of 0210).
--         backoffice.record_refused_action() takes one more code, queue.conflict_of_interest: the
--         refusal apps/api answers 403 is journalled (15 CA19, RG110; L2CT-4), payload {action_code,
--         reason: conflict_of_interest} instead of the required role of an admin action.
--   L2CS-3  profiles.guard_advertiser_member_write(): under influx_advertiser or
--         influx_identity_definer, a change of advertiser_profiles.status to anything but
--         pending_review is refused (55000, DETAIL `status`): no member door, present or future,
--         reaches `published` (RG6, invariant 1) by a right of the column.
--
-- Owners, search_path and EXECUTE of every recreated function are those of 0209, 0210, 0211, 0213
-- (create or replace keeps the grants; the end-state assertions check them again).
--
-- EC-L2C-fix-2 (micro-gaps, the safest choice):
--   EC-L2C-fix-2-1  0215 is the next free number (ls supabase/migrations).
--   EC-L2C-fix-2-2  record_refused_action() keeps EXECUTE for influx_agent only (fix-2.md: EXECUTE
--                   unchanged): the refusal of an ADMIN who holds the account is answered 403 by
--                   apps/api and refused by the database, not journalled (15 CA19 names an agent).
--   EC-L2C-fix-2-3  the held-account test reads owner_agent_id when the function runs; a change of
--                   responsible agent between two acts is seen at the next act.
--   EC-L2C-fix-2-4  the guard refuses a status change only; an UPDATE that rewrites the same status
--                   passes (nothing moves), as the other columns of the guard.
--
-- ROLLBACK (before any line of the code queue.conflict_of_interest is written): recreate
-- open_advertiser_review_entry() and extend_advertiser_review_claim() as in 0210,
-- publish_advertiser_review_entry() and reject_advertiser_review_entry() as in 0211,
-- read_advertiser_review_logo() as in 0213 (as influx_moderation_definer), record_refused_action()
-- as in 0210 (as influx_identity_definer), guard_advertiser_member_write() as in 0209; revoke select
-- (owner_agent_id) on identity.accounts from influx_moderation_definer.
-- =============================================================================

-- 1. What the owner of the decisions reads (L2CS-2) ---------------------------------------------------
-- identity.accounts is FORCE ROW LEVEL SECURITY: the policy accounts_moderation_definer_select of
-- 0210 already lets the owner read the rows; one more column, read only.

grant select (owner_agent_id) on identity.accounts to influx_moderation_definer;

-- 2. The decisions, recreated by their owner (03 P7 rule 5) ----------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_moderation_definer', current_user);
end
$$;
grant create on schema profiles to influx_moderation_definer;
set role influx_moderation_definer;

-- 2.1 Opening = claiming (0210 §7.2; L2CS-1, L2CS-2) ------------------------------------------------
create or replace function profiles.open_advertiser_review_entry(p_entry_id uuid)
returns table (
  outcome            text,
  holder_account_id  uuid,
  claimed_at         timestamptz,
  claim_expires_at   timestamptz,
  review_token       text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_account   uuid;
  v_entry     record;
  v_minutes   integer;
  v_outcome   text;
  v_holder    uuid;
  v_claimed   timestamptz;
  v_expires   timestamptz;
  v_token     text;
begin
  -- Unknown, or of the caller's own account (the policy hides it): 42501, one answer
  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  if not found or v_account = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- L2CS-1: the profile row FIRST, as publish, reject and every member door of the account (0209):
  -- a member write waits for this transaction, so the token rendered below is the version of the
  -- view apps/api reads next in it. Then the entry row: every act on an entry is serial on it.
  perform 1
     from profiles.advertiser_profiles p
    where p.account_id = v_account
      for update of p;

  select e.account_id, e.state::text as state, e.claimed_by_account_id, e.claimed_at,
         e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;

  -- 15 RG36, L2CS-2: an open entry of an account the caller HOLDS is not his to examine; a closed
  -- one answers `closed` as to anybody (EC-L2C-07-3)
  if v_entry.state = 'open'
     and exists (select 1 from identity.accounts a
                  where a.id = v_account and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_entry.state <> 'open' then
    v_outcome := 'closed';
  elsif v_entry.claimed_by_account_id = v_caller and v_entry.claim_expires_at > pg_catalog.now() then
    -- EC-L2C-07-4: the caller's own live claim, unchanged
    v_outcome := 'held';
    v_holder  := v_caller;
    v_claimed := v_entry.claimed_at;
    v_expires := v_entry.claim_expires_at;
  else
    select (s.value)::integer into v_minutes
      from backoffice.operational_settings s
     where s.key = 'claim_expiry_minutes';
    if v_minutes is null then
      raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
    end if;

    -- 04 l. 2465-2480: the condition IS the lock, the row count the answer
    update profiles.advertiser_review_entries e
       set claimed_by_account_id = v_caller,
           claimed_at            = pg_catalog.now(),
           claim_expires_at      = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
     where e.id = p_entry_id
       and e.state = 'open'
       and (e.claimed_by_account_id is null or e.claim_expires_at <= pg_catalog.now())
    returning e.claimed_by_account_id, e.claimed_at, e.claim_expires_at
      into v_holder, v_claimed, v_expires;

    if found then
      v_outcome := 'claimed';
      -- file.md A9: the claim taken over had expired; its abandonment is written first, with its
      -- holder and its real expiry (15 C3: the holder and the duration)
      if v_entry.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_entry_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'profiles_advertiser',
                               'holder_account_id', v_entry.claimed_by_account_id,
                               'claimed_at', v_entry.claimed_at,
                               'expired_at', v_entry.claim_expires_at));
      end if;
    else
      -- 15 C2: somebody else holds it, read only, never an error
      v_outcome := 'read_only';
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  end if;

  if v_outcome in ('claimed', 'held') then
    v_token := profiles.advertiser_review_token(v_account);
  end if;

  -- 15 RG35, L2BS-7: the opening is an act (the decision view shows the contact person); last
  perform audit.append('queue.entry_opened', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_advertiser',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires, v_token;
end
$$;

comment on function profiles.open_advertiser_review_entry(uuid) is
  '15 RG27 C1, C2, C3, RG35, RG36; file.md A3, A9; L2CS-1, L2CS-2 (0215): an agent or an admin opens '
  'an entry of queue 1. The profile row locked FOR UPDATE first, then the entry: no member write '
  'between the token and the view read after it in the transaction. Free, or its claim expired: '
  'claimed by an atomic conditional UPDATE (04 l. 2465-2480), claim_expires_at = now() + '
  'claim_expiry_minutes; an expired claim taken over writes queue.claim_expired {queue_code, '
  'holder_account_id, claimed_at, expired_at} first. Returns (outcome, holder, claimed_at, '
  'claim_expires_at, review_token): claimed or held (the caller''s live claim, unchanged) with the '
  'version token; read_only with the live holder (15 C2); closed with nothing. Every opening writes '
  'queue.entry_opened {queue_code, outcome}. 42501 for an unknown entry, an entry of the caller''s own '
  'account (C(3)), an open entry of an account the caller holds (RG36), outside an active agent or '
  'admin in aal2. SECURITY DEFINER owned by influx_moderation_definer, empty search_path; EXECUTE '
  'for influx_agent and influx_admin.';

-- 2.2 Extend (0210 §7.4; L2CS-2) ----------------------------------------------------------------------
create or replace function profiles.extend_advertiser_review_claim(p_entry_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := profiles.require_review_agent(false);
  v_entry    record;
  v_minutes  integer;
  v_expires  timestamptz;
begin
  select e.account_id, e.state::text as state, e.claimed_by_account_id, e.claimed_at,
         e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  -- 15 RG36, L2CS-2 (0215): an account the caller HOLDS is his to hold, never to examine longer
  if not found or v_entry.account_id = v_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_entry.account_id and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;

  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s
   where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;

  update profiles.advertiser_review_entries e
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where e.id = p_entry_id
  returning e.claim_expires_at into v_expires;

  perform audit.append('queue.claim_extended', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'profiles_advertiser',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function profiles.extend_advertiser_review_claim(uuid) is
  'file.md A9: the holder of a live claim extends it to now() + claim_expiry_minutes; line '
  'queue.claim_extended {queue_code, holder_account_id, claimed_at, claim_expires_at}; returns the new '
  'expiry. 55P03, 55000 entry_closed, 42501 as the release, and for an account the caller holds (15 '
  'RG36, 0215). SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent and '
  'influx_admin.';

-- 2.3 Publish (0211 §1.1, one change: RG36) -----------------------------------------------------
create or replace function profiles.publish_advertiser_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_internal_comment  text
)
returns table (
  decided_at         timestamptz,
  sla_breached       boolean,
  first_publication  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := profiles.require_review_agent(false);
  v_account   uuid;
  v_status    text;
  v_first     boolean;
  v_entry     record;
  v_rev       record;
  v_logo      uuid;
  v_text      text;
  v_fields    text[] := '{}';
  v_values    jsonb;
  v_missing   text[];
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  if p_internal_comment is not null
     and (pg_catalog.char_length(p_internal_comment) not between 1 and 1000
          or p_internal_comment !~ '[^[:space:]]'
          or p_internal_comment ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]') then
    raise exception 'the internal comment is 1 to 1 000 printable characters'
      using errcode = 'invalid_parameter_value', detail = 'internal_comment';
  end if;

  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  -- 15 RG36, L2CS-2 (0215): an account the caller HOLDS is his to hold, never to decide
  if not found or v_account = v_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_account and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The profile row FIRST, as every member door of the account (0209), then the entry: a member
  -- write waits for this decision, or this decision reads it (file.md A3).
  select p.status::text, p.first_published_at is null
    into v_status, v_first
    from profiles.advertiser_profiles p
   where p.account_id = v_account
     for update of p;

  select e.kind::text as kind, e.state::text as state, e.claimed_by_account_id, e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- 06 CA18: no decision without a live claim of the caller
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  -- file.md A3, L2BS-1: the version examined
  if p_review_token is null
     or p_review_token is distinct from profiles.advertiser_review_token(v_account) then
    raise exception 'the profile changed since it was opened'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  -- EC-L2C-07-6
  if not ((v_entry.kind = 'submission' and v_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_status = 'published')) then
    raise exception 'a % entry is not decided on a % profile', v_entry.kind, v_status
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  -- RG9: every pending value applied, its revision approved, in this transaction; the constraints of
  -- the column apply now (file.md A4)
  for v_rev in
    select r.id, r.field_code, r.proposed_value
      from profiles.profile_field_revisions r
     where r.advertiser_review_entry_id = p_entry_id and r.status = 'pending_review'
     order by r.field_code
  loop
    if v_rev.field_code = 'advertiser.logo' then
      v_logo := (v_rev.proposed_value ->> 'logo_object_id')::uuid;
      if v_logo is not null then
        perform 1 from profiles.brand_logo_objects l
         where l.id = v_logo and l.account_id = v_account and l.state = 'in_review';
        if not found then
          raise exception 'the proposed logo is no longer under review'
            using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
        end if;
      end if;
      -- one active logo per brand: the previous one leaves first
      update profiles.brand_logo_objects l
         set state = 'purging', purge_requested_at = pg_catalog.now()
       where l.account_id = v_account and l.state = 'active';
      if v_logo is not null then
        update profiles.brand_logo_objects l
           set state = 'active', activated_at = pg_catalog.now()
         where l.id = v_logo;
      end if;
    else
      v_text := v_rev.proposed_value #>> '{}';
      case v_rev.field_code
        when 'advertiser.brand_name' then
          update profiles.advertiser_profiles p set legal_name = v_text where p.account_id = v_account;
        when 'advertiser.presentation' then
          update profiles.advertiser_profiles p set presentation = v_text where p.account_id = v_account;
        when 'advertiser.website_domain' then
          update profiles.advertiser_profiles p set website_domain = v_text where p.account_id = v_account;
        when 'advertiser.contact_role' then
          update profiles.advertiser_profiles p set contact_role = v_text where p.account_id = v_account;
        when 'advertiser.primary_sector' then
          update profiles.advertiser_profiles p set primary_sector_code = v_text
           where p.account_id = v_account;
        else
          raise exception 'no application for the field %', v_rev.field_code
            using errcode = 'invalid_parameter_value';
      end case;
    end if;
    update profiles.profile_field_revisions r
       set status = 'approved', closed_at = pg_catalog.now()
     where r.id = v_rev.id;
    v_fields := v_fields || v_rev.field_code;
  end loop;

  -- 06 RG5, L2BS-1: the required fields of the version published (0203)
  select pg_catalog.jsonb_build_object(
           'legal_name',         p.legal_name,
           'primary_sector',     p.primary_sector_code,
           'company_size',       p.company_size_band,
           'country',            a.country_code,
           'target_markets',     (select pg_catalog.jsonb_agg(m.country_code)
                                    from profiles.advertiser_target_markets m
                                   where m.account_id = p.account_id),
           'working_languages',  (select pg_catalog.jsonb_agg(w.language_code)
                                    from profiles.advertiser_working_languages w
                                   where w.account_id = p.account_id),
           'presentation',       p.presentation,
           'topics',             (select pg_catalog.jsonb_agg(t.topic_code)
                                    from profiles.advertiser_topics t
                                   where t.account_id = p.account_id),
           'networks',           (select pg_catalog.jsonb_agg(n.network_code)
                                    from profiles.advertiser_networks n
                                   where n.account_id = p.account_id),
           'formats',            (select pg_catalog.jsonb_agg(f.format_code)
                                    from profiles.advertiser_formats f
                                   where f.account_id = p.account_id),
           'audience_countries', (select pg_catalog.jsonb_agg(c.country_code)
                                    from profiles.advertiser_audience_countries c
                                   where c.account_id = p.account_id),
           'contact_role',       p.contact_role)
    into v_values
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.account_id = v_account;
  v_missing := profiles.advertiser_missing_required_fields(v_values);
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'required field missing: %', v_missing[1]
      using errcode = 'check_violation', detail = v_missing[1];
  end if;

  update profiles.advertiser_profiles p
     set status = 'published',
         first_published_at = coalesce(p.first_published_at, pg_catalog.now())
   where p.account_id = v_account;

  update profiles.advertiser_review_entries e
     set state = 'published', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- 06 RG69: the decision e-mail, in the brand's language, rendered by the worker (09, D69); its
  -- code in the payload, without which 0111 refuses any success of a transactional line (0211)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'profile.decision', 'brevo_transactional', 'account:' || v_account::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_account,
                                        'entry_id', p_entry_id,
                                        'email_code', 'profile.decision'),
          'profile.decision:' || p_entry_id::text);
  -- 06 RG78: profile.completed once per account, lead.updated afterwards; ids only (05 RG74)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_lead, case when v_first then 'profile.completed' else 'lead.updated' end, d.destination,
         'account:' || v_account::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', v_account),
         case when v_first then 'profile.completed:' || v_account::text
              else 'lead.updated:' || v_lead::text end
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  -- The register, in the transaction of the fact; last (04 §7.2)
  perform audit.append('profile.published', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'fields', pg_catalog.to_jsonb(v_fields),
                                                     'late', v_late));
  return query select v_decided, v_late, v_first;
end
$$;

comment on function profiles.publish_advertiser_review_entry(uuid, text, text) is
  '06 RG6, RG9, RG65, RG69, RG78; 15 C6, C8; file.md A2, A3: the holder of a live claim publishes an '
  'entry of queue 1. The profile row locked first, then the entry; the version token recomputed and '
  'compared; in ONE transaction: each pending revision applied to its column (logo: the in_review '
  'object active, the previous active one purging) and approved, the required fields recontrolled, '
  'status published, first_published_at written once, the entry published (decider, instant, '
  'internal comment), profile.decision to brevo_transactional (key profile.decision:<entry>, '
  'payload {event_id, account_id, entry_id, email_code = profile.decision}, 0211), '
  'profile.completed to brevo_contact and apollo_contact at the first publication (key '
  'profile.completed:<account>), lead.updated otherwise, the line profile.published {entry_id, kind, '
  'fields, late}. Returns (decided_at, sla_breached, first_publication). 55P03 no live claim of the '
  'caller (DETAIL holder or none), 55000 entry_closed, stale_token or profile_state, 23514 a required '
  'field missing (DETAIL its code) or a column constraint, 22023 internal_comment, 42501 as the '
  'opening (an account the caller holds included, 0215). SECURITY DEFINER owned by '
  'influx_moderation_definer; EXECUTE for influx_agent and influx_admin.';

-- 2.4 Reject (0211 §1.2, one change: RG36) ------------------------------------------------------
create or replace function profiles.reject_advertiser_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_reason_code       text,
  p_member_message    text,
  p_internal_comment  text
)
returns table (
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
  v_caller    uuid := profiles.require_review_agent(false);
  v_requires  boolean;
  v_account   uuid;
  v_status    text;
  v_entry     record;
  v_decided   timestamptz;
  v_late      boolean;
  v_decision  uuid := pg_catalog.gen_random_uuid();
begin
  -- RG65, RG66: a typed reason of the closed list, never a refusal without one
  select r.requires_member_message into v_requires
    from profiles.advertiser_rejection_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'a typed reason of profiles.advertiser_rejection_reasons is required'
      using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  -- file.md A6: the message to the brand for `other` only, 20 to 500 printable characters
  if v_requires then
    if p_member_message is null
       or pg_catalog.char_length(p_member_message) not between 20 and 500
       or p_member_message !~ '[^[:space:]]'
       or p_member_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'this reason requires a message of 20 to 500 printable characters'
        using errcode = 'invalid_parameter_value', detail = 'member_message';
    end if;
  elsif p_member_message is not null then
    raise exception 'this reason takes no message' using errcode = 'invalid_parameter_value',
      detail = 'member_message';
  end if;
  if p_internal_comment is not null
     and (pg_catalog.char_length(p_internal_comment) not between 1 and 1000
          or p_internal_comment !~ '[^[:space:]]'
          or p_internal_comment ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]') then
    raise exception 'the internal comment is 1 to 1 000 printable characters'
      using errcode = 'invalid_parameter_value', detail = 'internal_comment';
  end if;

  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  -- 15 RG36, L2CS-2 (0215): an account the caller HOLDS is his to hold, never to decide
  if not found or v_account = v_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_account and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The profile row first, then the entry (same order as the publication and the member doors)
  select p.status::text into v_status
    from profiles.advertiser_profiles p
   where p.account_id = v_account
     for update of p;

  select e.kind::text as kind, e.state::text as state, e.claimed_by_account_id, e.claim_expires_at
    into v_entry
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id
     for update;
  if v_entry.state <> 'open' then
    raise exception 'the entry is closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is distinct from v_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'the caller holds no live claim on this entry'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  if p_review_token is null
     or p_review_token is distinct from profiles.advertiser_review_token(v_account) then
    raise exception 'the profile changed since it was opened'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not ((v_entry.kind = 'submission' and v_status = 'pending_review')
          or (v_entry.kind = 'revision' and v_status = 'published')) then
    raise exception 'a % entry is not decided on a % profile', v_entry.kind, v_status
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_state';
  end if;

  update profiles.profile_field_revisions r
     set status = 'rejected', closed_at = pg_catalog.now()
   where r.advertiser_review_entry_id = p_entry_id and r.status = 'pending_review';
  -- the logo proposed goes to purge, the active one stays served
  update profiles.brand_logo_objects l
     set state = 'purging', purge_requested_at = pg_catalog.now()
   where l.account_id = v_account and l.state = 'in_review';
  -- RG10: a refused submission goes back to the brand; a refused revision leaves it published (A2)
  if v_entry.kind = 'submission' then
    update profiles.advertiser_profiles p set status = 'rejected' where p.account_id = v_account;
  end if;

  update profiles.advertiser_review_entries e
     set state = 'rejected', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         rejection_reason_code = p_reason_code, member_message = p_member_message,
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- 06 RG69: the decision e-mail, its code in the payload (0211)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'profile.decision', 'brevo_transactional', 'account:' || v_account::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision, 'account_id', v_account,
                                        'entry_id', p_entry_id,
                                        'email_code', 'profile.decision'),
          'profile.decision:' || p_entry_id::text);

  perform audit.append('profile.rejected', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id,
                                                     'kind', v_entry.kind,
                                                     'reason_code', p_reason_code,
                                                     'late', v_late));
  return query select v_decided, v_late;
end
$$;

comment on function profiles.reject_advertiser_review_entry(uuid, text, text, text, text) is
  '06 RG10, RG65, RG66, RG68, RG69; 15 C6, C8; file.md A2, A3, A6: the holder of a live claim refuses '
  'an entry of queue 1 with a typed reason of profiles.advertiser_rejection_reasons; the message to '
  'the brand (20 to 500 characters) for a reason that requires it only (other); an internal comment '
  'of 1 000 characters at most, never sent. Same locks and token as the publication; in ONE '
  'transaction: the pending revisions rejected, the in_review logo purging, a submission back to '
  'rejected (a revision leaves the profile published), the entry rejected, profile.decision to '
  'brevo_transactional (email_code = profile.decision, 0211), the line profile.rejected {entry_id, '
  'kind, reason_code, late}. Returns '
  '(decided_at, sla_breached). 22023 reason, member_message or internal_comment, then the refusals '
  'of the publication. SECURITY DEFINER owned by influx_moderation_definer; EXECUTE for influx_agent '
  'and influx_admin.';

-- 2.5 The read of a logo (0213 §3; L2CS-2) -----------------------------------------------------------
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
  -- Unknown, of the caller's own account (the policy hides it), or of an account he HOLDS (15 RG36,
  -- L2CS-2, 0215): 42501, one answer
  select e.account_id into v_account
    from profiles.advertiser_review_entries e
   where e.id = p_entry_id;
  if not found or v_account = v_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_account and a.owner_agent_id = v_caller) then
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
  'entry, an entry of the caller''s own account (C(3)) or of an account he holds (15 RG36, 0215), a '
  'logo unknown, of another account, pending, purging or purged. SECURITY DEFINER owned by '
  'influx_moderation_definer, empty search_path; EXECUTE for influx_agent and influx_admin.';

reset role;
revoke create on schema profiles from influx_moderation_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_moderation_definer', current_user);
end
$$;

-- 3. The refusal of a held account, journalled (15 CA19, RG110; L2CT-4) ---------------------------
-- backoffice.record_refused_action(), recreated by its owner as in 0210 with one more code.

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema backoffice to influx_identity_definer;

set role influx_identity_definer;

create or replace function backoffice.record_refused_action(p_action_code text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller uuid := influx.current_account_id();
begin
  if v_caller is null
     or influx.current_account_role() is distinct from 'agent'
     or not influx.has_aal2()
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role = 'agent'
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = v_caller and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_action_code is null
     or p_action_code not in ('leads.change_apollo_setting', 'leads.read_apollo_settings',
                              'leads.lift_brevo_suppression', 'backoffice.dual_control',
                              'identity.change_member_role', 'identity.internal_invitation',
                              'privacy.approve_data_request', 'ops.read_health',
                              'queue.force_release_claim', 'queue.conflict_of_interest') then
    raise exception 'unknown action code' using errcode = 'invalid_parameter_value';
  end if;
  -- the trace of the attempt, on the caller's own account (AL39 counts them per account); RG110:
  -- the action and the reason of the refusal
  perform audit.append('backoffice.action_refused', 'account', v_caller,
                       case when p_action_code = 'queue.conflict_of_interest'
                            then pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                               'reason', 'conflict_of_interest')
                            else pg_catalog.jsonb_build_object('action_code', p_action_code,
                                                               'required_role', 'admin')
                       end);
end
$$;

comment on function backoffice.record_refused_action(text) is
  '05 CA63, 15 RG110 (AL39): an active agent in aal2 who attempted an admin action leaves its trace: '
  'backoffice.action_refused {action_code, required_role: admin} on his own account. Closed list: '
  'leads.change_apollo_setting, leads.read_apollo_settings, leads.lift_brevo_suppression, '
  'backoffice.dual_control, identity.change_member_role, identity.internal_invitation (0135), '
  'privacy.approve_data_request (0137, EC-J8-49), ops.read_health (0148: the "Santé technique" screen), '
  'queue.force_release_claim (0210: the forced release of a claim, 15 C4); 22023 otherwise. Since '
  '0215 also queue.conflict_of_interest (15 RG36, CA19: an act on an entry of an account the agent '
  'holds), payload {action_code, reason: conflict_of_interest}. apps/api calls it before answering '
  '403, in a transaction that commits. SECURITY DEFINER owned by influx_identity_definer; EXECUTE for '
  'influx_agent ONLY.';

reset role;

revoke create on schema backoffice from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 4. The guard: a member moves his profile to pending_review only (L2CS-3; 06 RG6) -----------------

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
    -- L2CS-3, RG6: the submission door is the member's only move of the state; every other one
    -- (published, rejected, suspended, back to draft) is a decision of an agent or an admin
    if new.status is distinct from old.status and new.status::text <> 'pending_review' then
      raise exception 'a member moves a brand profile to pending_review only'
        using errcode = 'object_not_in_prerequisite_state', detail = 'status';
    end if;
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
  'file.md A4, L2BS-1, 06 RG6, RG9: BEFORE trigger on the brand profile, its eight lists, its contact '
  'person and its logo rows. When current_user is influx_advertiser or influx_identity_definer: a '
  'change of the profile status to anything but pending_review is refused (DETAIL status, L2CS-3, '
  '0215); suspended refuses every write; published refuses the change of an active moderated column, '
  'and any move of a logo into or out of active. 55000, the field code as DETAIL. SECURITY INVOKER '
  '(it reads current_user), empty search_path, executed by nobody directly.';

revoke all on function profiles.guard_advertiser_member_write()
  from public, anon, authenticated, service_role;

-- 5. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_def  record;
  v_bad  text;
begin
  -- the seven functions of queue 1: SECURITY DEFINER, their owner, empty search_path, agent and admin
  for v_def in
    select * from (values
      ('profiles.open_advertiser_review_entry(uuid)'),
      ('profiles.release_advertiser_review_entry(uuid)'),
      ('profiles.extend_advertiser_review_claim(uuid)'),
      ('profiles.force_release_advertiser_review_claim(uuid, text)'),
      ('profiles.publish_advertiser_review_entry(uuid, text, text)'),
      ('profiles.reject_advertiser_review_entry(uuid, text, text, text, text)'),
      ('profiles.read_advertiser_review_logo(uuid, uuid)')
    ) as d (fn)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> 'influx_moderation_definer'
       or not (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY DEFINER, owned by influx_moderation_definer, empty search_path',
        v_def.fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text not in ('influx_agent', 'influx_admin'));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- the trace of a refused act: its owner, influx_agent only
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'backoffice.record_refused_action(text)'::regprocedure) <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc
              where oid = 'backoffice.record_refused_action(text)'::regprocedure)
     or (select proconfig from pg_catalog.pg_proc
          where oid = 'backoffice.record_refused_action(text)'::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception 'backoffice.record_refused_action() must be SECURITY DEFINER, owned by '
                    'influx_identity_definer, empty search_path';
  end if;
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = 'backoffice.record_refused_action(text)'::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_agent');
  if v_bad is not null then
    raise exception 'backoffice.record_refused_action() executable by: %', v_bad;
  end if;

  -- the guard: SECURITY INVOKER, empty search_path, executed by nobody, still on its eleven tables
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

  -- the one column added to the owner of the decisions, read only; no execution role reads it anew
  if not pg_catalog.has_column_privilege('influx_moderation_definer', 'identity.accounts',
                                         'owner_agent_id', 'SELECT')
     or pg_catalog.has_column_privilege('influx_moderation_definer', 'identity.accounts',
                                        'owner_agent_id', 'UPDATE') then
    raise exception 'influx_moderation_definer must read identity.accounts.owner_agent_id, and only read it';
  end if;

  -- no definer role left usable nor with CREATE on its schemas
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_moderation_definer', 'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_moderation_definer', 'profiles', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'backoffice', 'CREATE') then
    raise exception 'a definer role left with CREATE on a schema';
  end if;
end
$$;
