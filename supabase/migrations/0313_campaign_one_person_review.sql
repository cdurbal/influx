-- =============================================================================
-- 0313_campaign_one_person_review
-- -----------------------------------------------------------------------------
-- Lot 3 / L3C, fix X4 (jalons/l3c/fix-4.md; decisions-detail.md § D84, founder, 2026-11-16, which
-- PREVAILS; jalons/l3c/double-validation.md §2 option B, §4; l3c/modele.md "Amendement D84", which
-- makes §3, the « décideur ≠ premier examinateur » of §1 and §2 and the arbitration A3 obsolete;
-- fiche invariants 2 and 10). Signalled I-4: a row level security policy and SECURITY DEFINER
-- functions are recreated, two CHECK constraints dropped.
--
-- D84: « Pour aucun cas d'usage métier il ne peut y avoir de double validation obligatoire. » A
-- campaign of a sensitive sector is published (or refused) by ONE internal account, agent or admin;
-- the brand's declaration of authorizations stays required (09 RG85 point 1); asking a second opinion
-- is a choice, never blocking: the request gives the claim back, the entry stays readable by every
-- internal, a colleague (an admin included) publishes or refuses it, or the requester takes it back
-- and decides himself. The publisher is always named; the requester too when an opinion was asked;
-- the mode (single, second_opinion) is carried by the register.
--
--   campaigns.assert_enhanced_review()          (0308 §4) a sensitive sector asks the declaration
--         only; 23514 enhanced_review kept for a snapshot of a sensitive campaign without it.
--   campaigns.lock_held_campaign_review_entry() (0307 §8) the first reviewer is no longer refused
--         (42501 only for unknown, own account, held account: 15 RG36 unchanged).
--   campaigns.open_campaign_review_entry()      (0307 §8.2) the same: the requester opens, claims
--         or reads like anybody; the token and the opinion still go to the holder only.
--   campaigns.first_review_campaign_entry()     (0308 §7.2) the optional request of a second
--         opinion: same controls (opinion 20 to 1 000, claim, token, not_enhanced_review,
--         first_review_given), the claim given back; the comment rewritten.
--   campaigns.publish_campaign_review_entry()   (0308 §7.3) step (4) removed: neither a second
--         account nor a first reviewer is required; the line campaign.published gains review_mode
--         (second_opinion when an opinion was asked and another person decides, single otherwise);
--         the snapshot and the line still name the publisher and the requester.
--   policy campaign_review_entries_internal_select: back to the first two clauses of 0307 (the
--         third, hiding an entry from its first reviewer, 0307 then 0312, is obsolete).
--   CHECK campaign_review_entries_two_persons (0307) and campaign_published_snapshots_two_persons
--         (0308) dropped: the requester may decide.
--
-- Unchanged: every signature, result, owner, EXECUTE, empty search_path; the refusal
-- (reject_campaign_review_entry: one person, as before), the correction (correct_campaign_field:
-- still refused after a request, first_review_given), the conflict of interest (15 RG36), the claim
-- (CA58, 09 RG88), the enhanced delay (campaign_enhanced_review_minutes, 2 business days), the codes
-- of the register (campaign.first_reviewed, excluded_third_party). No GRANT, no column, no data taken
-- back. The search migrations move to 0314.
--
-- ROLLBACK (back to 0312, reversible while no entry is decided by its requester): re-run the bodies
-- and comments of the five functions from 0307 §8 (lock_held_campaign_review_entry,
-- open_campaign_review_entry) and 0308 §4, §7.2, §7.3 (assert_enhanced_review,
-- first_review_campaign_entry, publish_campaign_review_entry) by their owners; recreate the policy as
-- in 0312 §1; add back
--   alter table campaigns.campaign_review_entries add constraint campaign_review_entries_two_persons
--     check (decided_by_account_id <> first_reviewed_by_account_id);
--   alter table campaigns.campaign_published_snapshots add constraint
--     campaign_published_snapshots_two_persons
--     check (published_by_account_id <> first_reviewed_by_account_id);
-- (both refused if a requester has decided meanwhile: such rows are settled by hand first).
-- =============================================================================

-- 1. The two CHECK constraints of the two persons (0307, 0308) ---------------------------------------

alter table campaigns.campaign_review_entries
  drop constraint if exists campaign_review_entries_two_persons;
alter table campaigns.campaign_published_snapshots
  drop constraint if exists campaign_published_snapshots_two_persons;

comment on column campaigns.campaign_published_snapshots.first_reviewed_by_account_id is
  'D84 (0313): the internal account who asked a second opinion on this entry, NULL when none was '
  'asked; may be the publisher (the requester took the entry back). Never served to a creator.';

-- 2. The read policy of agent and admin: the first two clauses of 0307 -------------------------------

drop policy if exists campaign_review_entries_internal_select on campaigns.campaign_review_entries;
create policy campaign_review_entries_internal_select on campaigns.campaign_review_entries
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and advertiser_account_id is distinct from (select influx.current_account_id()));

-- 3. The enhanced review: the declaration only (owner: the migration role, as 0308 §4) --------------

create or replace function campaigns.assert_enhanced_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sensitive  boolean;
begin
  -- RG84: the sensitivity of the CURRENT sector, read by join, never copied on the campaign
  select s.is_sensitive into v_sensitive
    from reference.sectors s
   where s.code = new.sector_code;
  -- 09 RG85 point 1, D84: the brand's declaration of authorizations, never a second person
  if coalesce(v_sensitive, false) and new.authorizations_declaration_hash is null then
    raise exception 'enhanced_review'
      using errcode = 'check_violation', detail = 'enhanced_review';
  end if;
  return new;
end
$$;

comment on function campaigns.assert_enhanced_review() is
  '04 §5.4, 09 RG85 point 1, D84 (0308, 0313): BEFORE UPDATE on campaigns.campaigns when '
  'current_snapshot_id changes to a snapshot: a sensitive sector (reference.sectors, join) asks the '
  'brand''s declaration on the campaign; 23514 enhanced_review otherwise. No second person (D84). '
  'SECURITY INVOKER (the writer reads with its own rights), executed by nobody.';

-- 4. The functions of queue 7, as influx_campaign_review_definer (03 P7 rule 5) ----------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_review_definer', current_user);
end
$$;
grant create on schema campaigns to influx_campaign_review_definer;
set role influx_campaign_review_definer;

-- 4.1 The gate of every act on a held entry (0307 §8, the first reviewer no longer refused) ---------
create or replace function campaigns.lock_held_campaign_review_entry(p_entry_id uuid, p_caller uuid)
returns table (
  campaign_id            uuid,
  advertiser_account_id  uuid,
  claimed_at             timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry  record;
begin
  select e.campaign_id, e.advertiser_account_id, e.state::text as state, e.claimed_by_account_id,
         e.claimed_at, e.claim_expires_at
    into v_entry
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id
     for update;
  -- unknown, the caller's own account (the policy hides it), an account he HOLDS (15 RG36): one
  -- answer (T14). D84: the requester of a second opinion is not refused
  if not found or v_entry.advertiser_account_id = p_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_entry.advertiser_account_id and a.owner_agent_id = p_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  -- 09 RG88, 15 C2: no examination nor decision without the caller's live claim
  if v_entry.claimed_by_account_id is distinct from p_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  return query select v_entry.campaign_id, v_entry.advertiser_account_id, v_entry.claimed_at;
end
$$;

comment on function campaigns.lock_held_campaign_review_entry(uuid, uuid) is
  'The gate of the acts on a held entry of queue 7 (0307, 0313): the entry FOR UPDATE; 42501 '
  '(unknown, own account, held account), 55000 entry_closed, 55P03 no_live_claim (DETAIL the live '
  'holder or none). D84: the requester of a second opinion is not refused. SECURITY INVOKER owned by '
  'influx_campaign_review_definer, no EXECUTE.';

-- 4.2 Opening = claiming (0307 §8.2, the requester opens like anybody) -------------------------------
create or replace function campaigns.open_campaign_review_entry(p_entry_id uuid)
returns table (
  outcome                       text,
  holder_account_id             uuid,
  claimed_at                    timestamptz,
  claim_expires_at              timestamptz,
  review_token                  text,
  first_reviewed_by_account_id  uuid,
  first_reviewed_at             timestamptz,
  first_review_opinion          text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := campaigns.require_campaign_agent(false);
  v_entry     record;
  v_minutes   integer;
  v_outcome   text;
  v_holder    uuid;
  v_claimed   timestamptz;
  v_expires   timestamptz;
  v_token     text;
  v_opinion   text;
begin
  -- EC-L3C-02-3: the entry alone is locked, the campaign is frozen meanwhile
  select e.campaign_id, e.advertiser_account_id, e.state::text as state, e.claimed_by_account_id,
         e.claimed_at, e.claim_expires_at, e.first_reviewed_by_account_id, e.first_reviewed_at,
         e.first_review_opinion
    into v_entry
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id
     for update;
  -- unknown, or of the caller's own account (the policy hides it): 42501, one answer
  if not found or v_entry.advertiser_account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- 15 RG36: an open entry of an account the caller HOLDS is not his to examine. A closed one
  -- answers `closed` as to anybody. D84: the requester of a second opinion opens it like anybody
  if v_entry.state = 'open'
     and exists (select 1 from identity.accounts a
                  where a.id = v_entry.advertiser_account_id and a.owner_agent_id = v_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if v_entry.state <> 'open' then
    v_outcome := 'closed';
  elsif v_entry.claimed_by_account_id = v_caller and v_entry.claim_expires_at > pg_catalog.now() then
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
    update campaigns.campaign_review_entries e
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
      -- file.md A9: an expired claim taken over is written first, its holder and its real expiry
      if v_entry.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_entry_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'campaigns',
                               'holder_account_id', v_entry.claimed_by_account_id,
                               'claimed_at', v_entry.claimed_at,
                               'expired_at', v_entry.claim_expires_at));
      end if;
    else
      -- 09 RG88, 15 C2: « déjà prise en charge par … », read only, never an error
      v_outcome := 'read_only';
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  end if;

  -- the version token and the opinion asked: to the holder only
  if v_outcome in ('claimed', 'held') then
    v_token   := campaigns.campaign_review_token(v_entry.campaign_id);
    v_opinion := v_entry.first_review_opinion;
  end if;

  -- 15 RG35: the opening is an act; last
  perform audit.append('queue.entry_opened', 'queue_entry', p_entry_id,
                       pg_catalog.jsonb_build_object('queue_code', 'campaigns',
                                                     'outcome', v_outcome));
  return query
    select v_outcome, v_holder, v_claimed, v_expires, v_token,
           case when v_outcome <> 'closed' then v_entry.first_reviewed_by_account_id end,
           case when v_outcome <> 'closed' then v_entry.first_reviewed_at end,
           v_opinion;
end
$$;

comment on function campaigns.open_campaign_review_entry(uuid) is
  '09 RG88; 15 RG27 C1 to C3, RG35, RG36; modele §1, D84 (0307, 0313): an agent or an admin opens an '
  'entry of queue 7: free or expired, claimed by an atomic conditional UPDATE for '
  'claim_expiry_minutes (queue.claim_expired first for an expired one); outcome claimed or held '
  '(with the token and the opinion asked), read_only (the live holder, 15 C2) or closed; '
  'queue.entry_opened {queue_code, outcome}. 42501 for an unknown entry, the caller''s own account, '
  'an open entry of an account he holds. The requester of a second opinion opens it like anybody '
  '(D84). SECURITY DEFINER; EXECUTE for influx_agent and influx_admin.';

-- 4.3 The optional request of a second opinion (0308 §7.2; D84) --------------------------------------
create or replace function campaigns.first_review_campaign_entry(
  p_entry_id      uuid,
  p_review_token  text,
  p_opinion       text)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid := campaigns.require_campaign_agent(false);
  v_entry      record;
  v_status     text;
  v_sensitive  boolean;
  v_first      uuid;
  v_at         timestamptz;
begin
  -- modele §3: a reasoned opinion of 20 to 1 000 characters
  perform campaigns.check_campaign_review_text(p_opinion, 20, 1000, true, 'opinion');
  -- the entry locked, the caller's live claim
  select * into v_entry from campaigns.lock_held_campaign_review_entry(p_entry_id, v_caller);

  select c.status::text, coalesce(s.is_sensitive, false)
    into v_status, v_sensitive
    from campaigns.campaigns c
    left join reference.sectors s on s.code = c.sector_code
   where c.id = v_entry.campaign_id
     for update of c;
  if v_status is distinct from 'pending_review' then
    raise exception 'campaign_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_state';
  end if;
  if p_review_token is null
     or p_review_token is distinct from campaigns.campaign_review_token(v_entry.campaign_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  if not v_sensitive then
    raise exception 'not_enhanced_review'
      using errcode = 'object_not_in_prerequisite_state', detail = 'not_enhanced_review';
  end if;
  select e.first_reviewed_by_account_id into v_first
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id;
  if v_first is not null then
    raise exception 'first_review_given'
      using errcode = 'object_not_in_prerequisite_state', detail = 'first_review_given';
  end if;

  -- D84: the request kept with its opinion, the claim given back (EC-L3C-03-3); the entry returns to
  -- queue 7, readable by every internal: a colleague decides it, or the requester takes it back
  update campaigns.campaign_review_entries e
     set first_reviewed_by_account_id = v_caller,
         first_reviewed_at            = pg_catalog.now(),
         first_review_opinion         = p_opinion,
         claimed_by_account_id        = null,
         claimed_at                   = null,
         claim_expires_at             = null
   where e.id = p_entry_id;
  v_at := pg_catalog.now();

  -- the register, codes and ids only (never the opinion); last (04 §7.2)
  perform audit.append('campaign.first_reviewed', 'campaign', v_entry.campaign_id,
                       pg_catalog.jsonb_build_object('entry_id', p_entry_id));
  return v_at;
end
$$;

comment on function campaigns.first_review_campaign_entry(uuid, text, text) is
  '09 RG85, D84; 17b §3.8; modele §3 (0308, 0313): the holder of a live claim on an entry of a '
  'sensitive sector asks a second opinion, a choice that never blocks: his reasoned opinion (20 to '
  '1 000 characters, never sent nor registered) kept, the claim given back, the entry readable by '
  'every internal; a colleague publishes or refuses it, or the requester takes it back and decides. '
  'campaign.first_reviewed {entry_id}. Returns the instant. 22023 opinion; 55000 campaign_state, '
  'stale_token, not_enhanced_review (a sector that is not sensitive), first_review_given (once per '
  'entry); then the refusals of lock_held_campaign_review_entry(). SECURITY DEFINER; EXECUTE for '
  'influx_agent and influx_admin.';

-- 4.4 Publication (0308 §7.3; D84: one person, the mode in the register) -----------------------------
create or replace function campaigns.publish_campaign_review_entry(
  p_entry_id          uuid,
  p_review_token      text,
  p_owner_agent_id    uuid,
  p_internal_comment  text)
returns table (
  decided_at         timestamptz,
  sla_breached       boolean,
  snapshot_version   integer,
  first_publication  boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller     uuid := campaigns.require_campaign_agent(false);
  v_entry      record;
  v_campaign   record;
  v_first      uuid;
  v_mode       text;
  v_version    smallint;
  v_payload    jsonb;
  v_snapshot   uuid;
  v_decided    timestamptz;
  v_late       boolean;
  v_decision   uuid := pg_catalog.gen_random_uuid();
  v_lead       uuid := pg_catalog.gen_random_uuid();
begin
  perform campaigns.check_campaign_review_text(p_internal_comment, 1, 1000, false,
                                               'internal_comment');
  -- (1) the entry locked, the caller's live claim (fiche « Arrêt si »), neither his own account nor a
  -- held one (42501, T14)
  select * into v_entry from campaigns.lock_held_campaign_review_entry(p_entry_id, v_caller);

  -- (2) the campaign locked: the brand's writes are frozen meanwhile (0307)
  select c.status::text as status, c.applications_close_on, c.first_published_at,
         coalesce(s.is_sensitive, false) as sensitive
    into v_campaign
    from campaigns.campaigns c
    left join reference.sectors s on s.code = c.sector_code
   where c.id = v_entry.campaign_id
     for update of c;
  if v_campaign.status is distinct from 'pending_review' then
    raise exception 'campaign_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_state';
  end if;

  -- (3) the version examined (modele §1)
  if p_review_token is null
     or p_review_token is distinct from campaigns.campaign_review_token(v_entry.campaign_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;

  -- (4) D84: no second person required. The requester of a second opinion, if any, is named; the mode
  -- is second_opinion when another person decides after the request, single otherwise
  select e.first_reviewed_by_account_id into v_first
    from campaigns.campaign_review_entries e
   where e.id = p_entry_id;
  v_mode := case when v_first is not null and v_first <> v_caller
                 then 'second_opinion' else 'single' end;

  -- (5) 17b §3.8: the responsible salesperson, an active internal account
  if p_owner_agent_id is null
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r  on r.account_id = a.id and r.role::text in ('agent', 'admin')
            join identity.agent_profiles p on p.account_id = a.id and p.is_active
           where a.id = p_owner_agent_id
             and a.status = 'active') then
    raise exception 'owner_agent' using errcode = 'invalid_parameter_value', detail = 'owner_agent';
  end if;

  -- (6) the brand: its profile published, its account active (17b §3.8 « marque suspendue »)
  if not exists (select 1
                   from identity.accounts a
                   join profiles.advertiser_profiles p on p.account_id = a.id
                  where a.id = v_entry.advertiser_account_id
                    and a.status = 'active'
                    and p.status = 'published') then
    raise exception 'brand_not_publishable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'brand_not_publishable';
  end if;

  -- (7) CA48: the application deadline not passed, in UTC days
  if v_campaign.applications_close_on < (pg_catalog.timezone('UTC', pg_catalog.now()))::date then
    raise exception 'calendar_passed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'calendar_passed';
  end if;

  -- (8) RG15 read again under the brand's advisory lock (0307): 55000 live_campaign_cap
  perform campaigns.assert_live_campaign_cap(v_entry.advertiser_account_id);

  -- (9) the snapshot, version n+1: the output of the creator view, nothing else (TM5.6, D78)
  v_payload := campaigns.campaign_creator_view(v_entry.campaign_id);
  select (coalesce(pg_catalog.max(p.version), 0) + 1)::smallint into v_version
    from campaigns.campaign_published_snapshots p
   where p.campaign_id = v_entry.campaign_id;
  insert into campaigns.campaign_published_snapshots
    (campaign_id, version, payload, content_hash, published_at, published_by_account_id,
     first_reviewed_by_account_id, review_entry_id)
  values (v_entry.campaign_id, v_version, v_payload,
          pg_catalog.sha256(pg_catalog.convert_to(v_payload::text, 'UTF8')), pg_catalog.now(),
          v_caller, v_first, p_entry_id)
  returning id into v_snapshot;

  -- (10) the state (the trigger of the enhanced review checks the declaration, 23514)
  update campaigns.campaigns c
     set status              = 'published',
         current_snapshot_id = v_snapshot,
         first_published_at  = coalesce(c.first_published_at, pg_catalog.now()),
         owner_agent_id      = p_owner_agent_id
   where c.id = v_entry.campaign_id;

  update campaigns.campaign_review_entries e
     set state = 'published', decided_by_account_id = v_caller, decided_at = pg_catalog.now(),
         internal_comment = p_internal_comment, closed_at = pg_catalog.now()
   where e.id = p_entry_id
  returning e.decided_at, e.sla_breached into v_decided, v_late;

  -- (11) 09 RG93: the decision e-mail, written by the worker; ids and its code only (modele §8)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_decision, 'campaign.decision', 'brevo_transactional',
          'account:' || v_entry.advertiser_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_decision,
                                        'account_id', v_entry.advertiser_account_id,
                                        'campaign_id', v_entry.campaign_id,
                                        'email_code', 'published',
                                        'entry_id', p_entry_id),
          'campaign.decision:' || p_entry_id::text);
  -- 09 RG103, CA69: the first publication only, to Brevo and Apollo; ids only (05 RG74), the
  -- consent read again by the consumer (RG105)
  if v_campaign.first_published_at is null then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    select v_lead, 'campaign.published', d.destination,
           'account:' || v_entry.advertiser_account_id::text, 100,
           pg_catalog.jsonb_build_object('event_id', v_lead,
                                         'account_id', v_entry.advertiser_account_id,
                                         'campaign_id', v_entry.campaign_id),
           'campaign.published:' || v_entry.campaign_id::text
      from (values ('brevo_contact'::leads.outbox_destination),
                   ('apollo_contact'::leads.outbox_destination)) d (destination);
  end if;

  -- (12) the register, nominative (the caller is the actor, the publisher), the requester and the
  -- mode (D84), codes and ids only (D60); last
  perform audit.append('campaign.published', 'campaign', v_entry.campaign_id,
                       pg_catalog.jsonb_build_object(
                         'entry_id', p_entry_id,
                         'snapshot_version', v_version,
                         'first_publication', v_campaign.first_published_at is null,
                         'owner_agent_id', p_owner_agent_id,
                         'enhanced_review', v_campaign.sensitive,
                         'review_mode', v_mode,
                         'first_reviewed_by_account_id', v_first,
                         'late', v_late));
  return query select v_decided, v_late, v_version::integer, v_campaign.first_published_at is null;
end
$$;

comment on function campaigns.publish_campaign_review_entry(uuid, text, uuid, text) is
  '09 RG5, RG15, RG85, RG89, RG93, RG103, CA48, CA69; D84; 15 C6, C8; modele §2 to §4, §8 (0308, '
  '0313): the holder of a live claim publishes an entry of queue 7, alone, a sensitive sector '
  'included (D84: no second person; the brand''s declaration checked by the trigger, 23514 '
  'enhanced_review). The entry then the campaign locked; the version token compared; the responsible '
  'salesperson an active internal account (22023 owner_agent); the brand profile published and its '
  'account active (brand_not_publishable); applications_close_on >= the UTC day (calendar_passed); '
  'RG15 read again (live_campaign_cap). In ONE transaction: snapshot n+1 = campaign_creator_view(), '
  'its SHA-256, publisher and requester of a second opinion if any; the campaign published '
  '(current_snapshot_id, first_published_at once, owner_agent_id); the entry published (decider, '
  'instant, internal comment); campaign.decision to brevo_transactional (key '
  'campaign.decision:<entry>, payload {event_id, account_id, campaign_id, email_code published, '
  'entry_id}); at the first publication campaign.published to brevo_contact and apollo_contact (key '
  'campaign.published:<campaign>, ids only); the line campaign.published {entry_id, '
  'snapshot_version, first_publication, owner_agent_id, enhanced_review, review_mode (single, or '
  'second_opinion when another person decides after a request), first_reviewed_by_account_id (the '
  'requester), late}. Returns (decided_at, sla_breached, snapshot_version, first_publication). '
  'SECURITY DEFINER; EXECUTE for influx_agent and influx_admin.';

reset role;
revoke create on schema campaigns from influx_campaign_review_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_review_definer', current_user);
end
$$;

-- 5. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_def   record;
  v_bad   text;
  v_qual  text;
begin
  -- the five functions: owner, mode, empty search_path, EXECUTE unchanged (agent and admin for the
  -- doors, nobody for the helper and the trigger)
  for v_def in
    select * from (values
      ('campaigns.open_campaign_review_entry(uuid)', 'influx_campaign_review_definer', true),
      ('campaigns.first_review_campaign_entry(uuid, text, text)', 'influx_campaign_review_definer', true),
      ('campaigns.publish_campaign_review_entry(uuid, text, uuid, text)',
       'influx_campaign_review_definer', true),
      ('campaigns.lock_held_campaign_review_entry(uuid, uuid)', 'influx_campaign_review_definer', false),
      ('campaigns.assert_enhanced_review()', null, false)
    ) as d (fn, owner, definer)
  loop
    if (v_def.owner is not null
        and (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
              where oid = v_def.fn::regprocedure) <> v_def.owner)
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% lost its owner, its mode or its empty search_path', v_def.fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or not v_def.definer
            or a.grantee::regrole::text not in ('influx_agent', 'influx_admin'));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
    if v_def.definer and (
         not pg_catalog.has_function_privilege('influx_agent', v_def.fn, 'EXECUTE')
         or not pg_catalog.has_function_privilege('influx_admin', v_def.fn, 'EXECUTE')) then
      raise exception '% lost its grant to agent or admin', v_def.fn;
    end if;
  end loop;

  -- D84: no body refuses the requester any more, the publication requires no second person
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('campaigns.lock_held_campaign_review_entry(uuid, uuid)'::regprocedure,
                   'campaigns.open_campaign_review_entry(uuid)'::regprocedure,
                   'campaigns.publish_campaign_review_entry(uuid, text, uuid, text)'::regprocedure,
                   'campaigns.assert_enhanced_review()'::regprocedure)
     and (p.prosrc ~ 'first_reviewed_by_account_id = (p_caller|v_caller)'
          or p.prosrc ~ 'enhanced_review_required'
          or p.prosrc ~ 'v_first is null');
  if v_bad is not null then
    raise exception 'D84: a second person is still required by %', v_bad;
  end if;
  if (select p.prosrc !~ '''review_mode''' from pg_catalog.pg_proc p
       where p.oid = 'campaigns.publish_campaign_review_entry(uuid, text, uuid, text)'::regprocedure) then
    raise exception 'campaign.published does not carry review_mode';
  end if;

  -- the two CHECK constraints gone
  if exists (select 1 from pg_catalog.pg_constraint
              where conname in ('campaign_review_entries_two_persons',
                                'campaign_published_snapshots_two_persons')) then
    raise exception 'a CHECK of the two persons survived';
  end if;

  -- the policy: one, SELECT, permissive, agent and admin, the two clauses of 0307 only
  if (select count(*) from pg_catalog.pg_policies
       where schemaname = 'campaigns' and tablename = 'campaign_review_entries'
         and policyname = 'campaign_review_entries_internal_select'
         and cmd = 'SELECT' and permissive = 'PERMISSIVE'
         and (select array_agg(r order by r) from unnest(roles::text[]) r)
               = array['influx_admin', 'influx_agent']::text[]) <> 1 then
    raise exception 'campaign_review_entries_internal_select is not the policy of agent and admin';
  end if;
  select qual into v_qual from pg_catalog.pg_policies
   where schemaname = 'campaigns' and tablename = 'campaign_review_entries'
     and policyname = 'campaign_review_entries_internal_select';
  if pg_catalog.strpos(v_qual, 'has_aal2()') = 0
     or v_qual !~ 'advertiser_account_id IS DISTINCT FROM'
     or v_qual ~ 'first_reviewed_by_account_id'
     or v_qual ~ 'state' then
    raise exception 'campaign_review_entries_internal_select does not read: %', v_qual;
  end if;

  -- the owner of the decisions left without member nor membership, without CREATE on campaigns
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.member = 'influx_campaign_review_definer'::regrole
                 or (m.roleid = 'influx_campaign_review_definer'::regrole
                     and (m.inherit_option or m.set_option))) then
    raise exception 'influx_campaign_review_definer left with a member or a membership';
  end if;
  if pg_catalog.has_schema_privilege('influx_campaign_review_definer', 'campaigns', 'CREATE') then
    raise exception 'influx_campaign_review_definer kept CREATE on campaigns';
  end if;
end
$$;
