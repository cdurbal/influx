-- =============================================================================
-- 0233_verification_identifier_changes
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 08 (jalons/l2f/08.md; l2f/modele.md §1 points 6, 12, 13, §2
-- "identifier_change_reviews", §3 "0233", §4, which prevails for every name; l2f/textes.md
-- « verification.reconfirm_required »; l2f-fiche.md invariants 7, 8, 12; 08 RG78, CA54; 04 l. 1608 to
-- 1628; 15 RG27 C1 to C8, RG29 file 6; archives/jalons/l2c/file.md A1 to A9). A handle changed by the
-- creator on a line that holds « Compte vérifié » opens an entry of queue 6 `identity_change_review`;
-- the badge stays; the agent either records that the account is the same (his finding written) or
-- requires a new proof of ownership: « Compte vérifié » and the audience of the line pass to
-- `to_reconfirm` (visible to the creator, never active elsewhere) until a new finding of queue 4.
--
-- 1. verification.identifier_review_state (open, confirmed, proof_required, withdrawn).
-- 2. verification.identifier_change_reviews, the entry of queue 6 as file.md A1: the account, the line
--    (no foreign key: the line may be deleted), the badge held, the previous and the new handle
--    (internal, never public), the number of changes, the lock, the deadlines frozen at the creation
--    by a BEFORE trigger (04 §5.6), the decision (the agent's finding: the handle he typed), the
--    internal comment, the cause of a withdrawal (reverted, line_deleted, badge_ended, account_erased).
--    One open entry per line; no right for any member.
-- 3. Queue 6 in the catalogue (15 RG29: agent and admin, a lock, no bulk action; 1 business day).
-- 4. The triggers (owned by influx_creator_verification_definer, never on the erasure):
--      track_identifier_change()   AFTER UPDATE OF handle on profiles.creator_social_accounts;
--      withdraw_entries_of_line()  AFTER DELETE on profiles.creator_social_accounts (the open entries
--                                  of queues 5 and 6 of the line closed, cause line_deleted; the badges
--                                  are left to the task badge_lifecycle, modele point 6);
--    and (owned by influx_verification_definer) on verification.badges:
--      withdraw_identifier_reviews()   AFTER UPDATE OF state (the badge held ended: badge_ended);
--      guard_audience_identifier()     BEFORE INSERT (an audience never granted while an entry of the
--                                      line is open: 55000 ownership_prerequisite);
--      restore_reconfirmed_audience()  AFTER INSERT (a new « Compte vérifié »: the audience
--                                      to_reconfirm of the line back to active while its expiry is
--                                      ahead; verification.badge_reconfirmed).
-- 5. The agent functions (influx_verification_definer, EXECUTE influx_agent, influx_admin): open,
--    release, extend, force release (admin), dossier, confirm, require proof; the version token,
--    never stored.
--
-- Refusals (the MESSAGE is the code, the DETAIL its precision):
--   42501 forbidden   outside an active agent/admin in aal2; an unknown entry, one of the caller's own
--                     account or of an account he holds (08 RG53).
--   55P03 no_live_claim (DETAIL the live holder or none).
--   55000 entry_closed, stale_token, line_deleted, handle_already_verified, badge_not_holding;
--         ownership_prerequisite (an audience granted while an entry of the line is open).
--   22023 reason, observed_handle, observed_handle_mismatch, internal_comment.
--
-- Rights (fiche invariant 10): the table RLS forced, nothing for influx_advertiser nor any member.
-- Agent and admin read it in aal2, never on their own account; nobody writes directly.
--
-- Not here: the routes and the counters (L2F commit 14); the e-mail body (12); the export and the
-- erasure of the entries (0235); the commercial alert of RG78 (AL14, Lot 5, EC-L2F-11); the amendments
-- of 08 RG78 and 15 RG29 (closure of the jalon).
--
-- EC-L2F-08 (micro-gaps, the safest choice):
--   EC-L2F-08-1  only an ACTIVE « Compte vérifié » opens an entry: a to_reconfirm one already awaits a
--                new finding (its reconfirmation compares the handle declared then, 0228); to_refresh
--                never applies to the account (no expiry, RG30).
--   EC-L2F-08-2  the WHEN of the trigger compares the raw handles (the writer may not execute the
--                normalisation); the function compares verification.normalize_handle() (0228), whose
--                EXECUTE is granted by its owner to influx_creator_verification_definer. A handle
--                emptied counts as a change (new_handle NULL).
--   EC-L2F-08-3  the deadlines are frozen at the creation of the entry (04 §5.6); a further change
--                updates new_handle, change_count and last_changed_at only, and changes the token.
--   EC-L2F-08-4  without an open entry, a change back to the verified handle (the last confirmed
--                finding on the badge, else the badge's) opens nothing; with one, a return to its
--                previous handle withdraws it (reverted).
--   EC-L2F-08-5  « même compte » is refused (55000 handle_already_verified) on a new handle that a
--                holding « Compte vérifié » of ANOTHER account carries (08 edge case l. 800): the agent
--                requires a proof instead. The typed handle must be the declared one (22023
--                observed_handle_mismatch, fiche invariant 7).
--   EC-L2F-08-6  the refusal of an audience while an entry is open, and the return of the audience
--                after a reconfirmation, are held by triggers on verification.badges: every grant path
--                (queue 4, the overturns of 0232, D83 later) obeys them, without recreating the grants.
--   EC-L2F-08-7  the trigger reads in the context of the line's owner. The only writers of the handle
--                besides the erasure (excluded) are the creator on his own line: asserted at the end.
--   EC-L2F-08-8  an audience to_reconfirm whose expiry passed at the reconfirmation stays to_reconfirm
--                until the task expires it (modele point 13 « elle attend la tâche »; invariant 1).
--   EC-L2F-08-9  « même compte » writes no e-mail and no lead.updated: the badge does not change.
--   EC-L2F-08-10 the confirmed handle is never written on the badge (EC-L2F-13): the edge case l. 800
--                of a later grant still compares observed_handle_at_decision (said for the review).
--
-- ROLLBACK (before any entry): drop the triggers creator_social_accounts_track_identifier_change,
-- creator_social_accounts_withdraw_verification_entries, badges_withdraw_identifier_reviews,
-- badges_guard_audience_identifier, badges_restore_reconfirmed_audience,
-- identifier_change_reviews_prepare, identifier_change_reviews_touch_updated_at; drop the functions of
-- §6 and §7; drop table verification.identifier_change_reviews; drop type
-- verification.identifier_review_state; revoke EXECUTE on verification.normalize_handle(text) from
-- influx_creator_verification_definer (as its owner); drop the policies *_identifier_change_reviews_*,
-- badges_verification_definer_reconfirm, disputes_creator_verification_definer_withdraw and revoke
-- their grants; recreate outbox_events_verification_definer_insert (0232) and
-- sla_policies_creator_verification_definer_select (0232); delete from backoffice.queues and
-- backoffice.sla_policies where code / queue_code = 'identity_change_review'; delete the event types of
-- §5.
-- =============================================================================

-- 1. The state of an entry (modele §2) --------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'identifier_review_state'
                    and t.typnamespace = 'verification'::regnamespace) then
    create type verification.identifier_review_state as enum
      ('open', 'confirmed', 'proof_required', 'withdrawn');
  end if;
end
$$;

comment on type verification.identifier_review_state is
  'Life of an entry of queue 6 (0233, modele §2; 08 RG78): open (in the queue), confirmed (the same '
  'account, the agent''s finding written), proof_required (« Compte vérifié » to_reconfirm), withdrawn '
  '(back to the previous handle, the line deleted, the badge ended, the account erased; never a '
  'decision).';

-- 2. verification.identifier_change_reviews, the entry of queue 6 (modele §2; file.md A1) -----------------

create table if not exists verification.identifier_change_reviews (
  id                                uuid        not null primary key default gen_random_uuid(),
  account_id                        uuid        not null references identity.accounts (id),
  -- no foreign key: the line may be deleted, the entry stays (modele §2)
  social_account_id                 uuid        not null,
  network_code                      text        not null references reference.networks (code),
  badge_id                          uuid        not null references verification.badges (id),
  previous_handle                   text,
  new_handle                        text,
  change_count                      integer     not null default 1,
  created_at                        timestamptz not null default now(),
  last_changed_at                   timestamptz not null default now(),
  sla_due_at                        timestamptz not null,
  escalate_at                       timestamptz not null,
  state                             verification.identifier_review_state not null default 'open',
  claimed_by_account_id             uuid        references identity.accounts (id),
  claimed_at                        timestamptz,
  claim_expires_at                  timestamptz,
  forced_release_at                 timestamptz,
  forced_release_by_account_id      uuid        references identity.accounts (id),
  forced_release_holder_account_id  uuid        references identity.accounts (id),
  forced_release_reason_code        text        references backoffice.claim_release_reasons (code),
  decided_by_account_id             uuid        references identity.accounts (id),
  decided_at                        timestamptz,
  observed_handle                   text,
  internal_comment                  text,
  withdrawn_cause                   text,
  closed_at                         timestamptz,
  -- 04 l. 2238, 15 C8: decided after the deadline (a late decision is possible, marked)
  sla_breached                      boolean     not null
                                                generated always as
                                                  (decided_at is not null and decided_at > sla_due_at)
                                                stored,
  updated_at                        timestamptz not null default now(),
  texts_erased_at                   timestamptz,

  -- the three handles: a moderated text of the line (0217 RG44), 100 printable characters at most
  constraint identifier_change_reviews_previous_handle
    check (previous_handle is null
           or (char_length(previous_handle) between 1 and 100 and previous_handle ~ '[^[:space:]]'
               and previous_handle !~ '[[:cntrl:]]')),
  constraint identifier_change_reviews_new_handle
    check (new_handle is null
           or (char_length(new_handle) between 1 and 100 and new_handle ~ '[^[:space:]]'
               and new_handle !~ '[[:cntrl:]]')),
  constraint identifier_change_reviews_observed_handle
    check (observed_handle is null
           or (char_length(observed_handle) between 1 and 100 and observed_handle ~ '[^[:space:]]'
               and observed_handle !~ '[[:cntrl:]]')),
  -- the previous handle is known until the erasure (0235) empties it
  constraint identifier_change_reviews_previous_known
    check (previous_handle is not null or texts_erased_at is not null),
  constraint identifier_change_reviews_change_count check (change_count >= 1),
  constraint identifier_change_reviews_changed_after check (last_changed_at >= created_at),
  -- open, and only open, has no closure
  constraint identifier_change_reviews_closed check ((state = 'open') = (closed_at is null)),
  constraint identifier_change_reviews_closed_after check (closed_at >= created_at),
  -- 15 C6: the two decisions carry their decider and their instant
  constraint identifier_change_reviews_decided
    check ((state in ('confirmed', 'proof_required')) = (decided_by_account_id is not null)
           and (decided_by_account_id is null) = (decided_at is null)),
  constraint identifier_change_reviews_decided_after check (decided_at >= created_at),
  -- EC-L2F-13: « même compte » writes the handle the agent typed, and only that decision
  constraint identifier_change_reviews_finding
    check ((observed_handle is null or state = 'confirmed')
           and (state <> 'confirmed' or observed_handle is not null or texts_erased_at is not null)),
  constraint identifier_change_reviews_withdrawn
    check ((state = 'withdrawn') = (withdrawn_cause is not null)),
  constraint identifier_change_reviews_withdrawn_cause
    check (withdrawn_cause in ('reverted', 'line_deleted', 'badge_ended', 'account_erased')),
  -- the internal comment, never sent, 1 000 printable characters at most
  constraint identifier_change_reviews_internal_comment
    check (internal_comment is null
           or (char_length(internal_comment) between 1 and 1000
               and internal_comment ~ '[^[:space:]]'
               and internal_comment !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]')),
  -- 15 RG27 C1 to C3: a claim is whole, on an open entry only
  constraint identifier_change_reviews_claim_together
    check ((claimed_by_account_id is null) = (claimed_at is null)
           and (claimed_at is null) = (claim_expires_at is null)),
  constraint identifier_change_reviews_claim_open
    check (claimed_by_account_id is null or state = 'open'),
  constraint identifier_change_reviews_claim_expiry check (claim_expires_at > claimed_at),
  -- 15 C4: the last forced release is whole
  constraint identifier_change_reviews_forced_release_together
    check (pg_catalog.num_nulls(forced_release_at, forced_release_by_account_id,
                                forced_release_holder_account_id, forced_release_reason_code)
           in (0, 4)),
  -- 04 §5.6: the deadlines, frozen at the creation
  constraint identifier_change_reviews_sla_after check (sla_due_at >= created_at),
  constraint identifier_change_reviews_escalate_after check (escalate_at >= sla_due_at),
  -- the erasure (0235) empties the four texts
  constraint identifier_change_reviews_texts_erased
    check (texts_erased_at is null
           or (previous_handle is null and new_handle is null and observed_handle is null
               and internal_comment is null))
);

-- modele §2, RG78: one open entry per line
create unique index if not exists identifier_change_reviews_one_open
  on verification.identifier_change_reviews (social_account_id) where state = 'open';
-- queue 6 (15 C5: oldest deadline first, ties by creation)
create index if not exists identifier_change_reviews_queue_idx
  on verification.identifier_change_reviews (sla_due_at, created_at) where state = 'open';
create index if not exists identifier_change_reviews_account_idx
  on verification.identifier_change_reviews (account_id, created_at);
create index if not exists identifier_change_reviews_badge_idx
  on verification.identifier_change_reviews (badge_id);

comment on table verification.identifier_change_reviews is
  'Queue 6 `identity_change_review` (15 RG29; 08 RG78, CA54; l2f/modele.md §2, 0233): a handle changed '
  'on a line that holds an active « Compte vérifié »; one open entry per line, updated at each new '
  'change. Carries the badge held, the previous and the new handle (internal, NEVER public nor '
  'written to the register, a log or an outbox payload), the lock (15 RG27), the deadlines frozen at '
  'the creation (04 §5.6), the decision (confirmed: the handle the agent typed; proof_required: the '
  'badges to_reconfirm), the internal comment. Written by the triggers and the functions of 0233 only; '
  'read by agent and admin in aal2, never on their own account. No right for any member nor '
  'influx_advertiser (fiche invariant 10).';
comment on column verification.identifier_change_reviews.previous_handle is
  'modele point 12: the observed_handle of the last confirmed finding on the badge held, otherwise the '
  'observed_handle_at_decision of that badge; frozen. Internal; emptied by the erasure.';
comment on column verification.identifier_change_reviews.new_handle is
  'The handle declared on the line by the last change (NULL: emptied). Internal; emptied by the '
  'erasure.';
comment on column verification.identifier_change_reviews.observed_handle is
  'EC-L2F-13: the handle the agent read on line when he confirmed the same account (normalised equal to '
  'the declared one); the badge is never rewritten. Internal; emptied by the erasure.';
comment on column verification.identifier_change_reviews.withdrawn_cause is
  'The exit without decision (15 C7): reverted (back to the previous handle), line_deleted (the line '
  'deleted), badge_ended (the badge held expired, revoked or replaced), account_erased (0235).';
comment on column verification.identifier_change_reviews.internal_comment is
  'Comment of the agent, 1 000 characters at most, NEVER shown to the member, sent by e-mail, written '
  'to the register nor exported.';

drop trigger if exists identifier_change_reviews_touch_updated_at
  on verification.identifier_change_reviews;
create trigger identifier_change_reviews_touch_updated_at
  before update on verification.identifier_change_reviews
  for each row execute function influx.touch_updated_at();

-- 2.1 The deadlines at the creation, then frozen with the target; the state moves forward only
create or replace function verification.prepare_identifier_change_review()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision  integer;
  v_escalate  integer;
begin
  if tg_op = 'INSERT' then
    select p.target_decision_minutes, p.escalate_after_minutes
      into v_decision, v_escalate
      from backoffice.sla_policies p
     where p.queue_code = 'identity_change_review' and p.is_active;
    if not found then
      raise exception 'queue identity_change_review has no active delay policy'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    new.created_at      := pg_catalog.now();
    new.last_changed_at := new.created_at;
    new.sla_due_at      := backoffice.business_deadline('identity_change_review', new.created_at,
                                                        v_decision);
    new.escalate_at     := backoffice.business_deadline('identity_change_review', new.sla_due_at,
                                                        v_escalate);
    return new;
  end if;

  if new.state is distinct from old.state
     and not (old.state = 'open'
              and new.state in ('confirmed', 'proof_required', 'withdrawn')) then
    raise exception 'identifier change review: % cannot become %', old.state, new.state
      using errcode = 'object_not_in_prerequisite_state', detail = 'identifier_review_state';
  end if;
  -- frozen once written (04 §5.6); the previous handle until the erasure only
  new.account_id        := old.account_id;
  new.social_account_id := old.social_account_id;
  new.network_code      := old.network_code;
  new.badge_id          := old.badge_id;
  new.created_at        := old.created_at;
  new.sla_due_at        := old.sla_due_at;
  new.escalate_at       := old.escalate_at;
  if new.texts_erased_at is null then
    new.previous_handle := old.previous_handle;
  end if;
  return new;
end
$$;

comment on function verification.prepare_identifier_change_review() is
  'BEFORE INSERT OR UPDATE on verification.identifier_change_reviews (0233, EC-L2F-08-3): at the '
  'insertion, created_at = last_changed_at = now(), sla_due_at and escalate_at computed ONCE from the '
  'policy of queue identity_change_review in force (04 §5.6), whatever the writer gave; afterwards the '
  'account, the line, the network, the badge, the creation, the deadlines and (until the erasure) the '
  'previous handle are frozen, and the state moves forward only (open -> confirmed, proof_required, '
  'withdrawn; 55000 DETAIL identifier_review_state otherwise). SECURITY INVOKER: the writer reads the '
  'policy and executes business_deadline() with its own rights.';

revoke all on function verification.prepare_identifier_change_review()
  from public, anon, authenticated, service_role;

drop trigger if exists identifier_change_reviews_prepare on verification.identifier_change_reviews;
create trigger identifier_change_reviews_prepare
  before insert or update on verification.identifier_change_reviews
  for each row execute function verification.prepare_identifier_change_review();

-- 3. Queue 6 and its delay (15 RG29: 1 business day, claim within 4 business hours) ------------------------

insert into backoffice.queues
  (code, label_key, spec_document, handled_by_roles, allows_bulk_action, has_lock)
values
  ('identity_change_review', 'queue.identity_change_review', '08 RG78', '{agent,admin}', false, true)
on conflict (code) do nothing;

insert into backoffice.sla_policies
  (queue_code, target_claim_minutes, target_decision_minutes, business_hours,
   escalate_after_minutes, is_provisional)
values
  -- 1 business day, claim within 4 business hours, escalation 2 business days after the deadline
  ('identity_change_review', 240, 480, default, 960, false)
on conflict (queue_code) do nothing;

set constraints backoffice.queues_sla_policy_fk immediate;

-- 4. Row level security and the rights of the business roles (fiche invariant 10) --------------------------

alter table verification.identifier_change_reviews enable row level security;
alter table verification.identifier_change_reviews force row level security;
revoke all on verification.identifier_change_reviews
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;

-- agent and admin in aal2, never their own account (15 RG36); nothing for any member (modele §2)
grant select on verification.identifier_change_reviews to influx_agent, influx_admin;

drop policy if exists identifier_change_reviews_internal_select
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_internal_select on verification.identifier_change_reviews
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 5. The register and the queue (modele §4) ----------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- the creator's change and the system's exits (payload codes and ids, never a handle)
  ('verification.identifier_changed',            'verification', 'identifier_change_review', 'info'),
  ('verification.identifier_change_withdrawn',   'verification', 'identifier_change_review', 'info'),
  -- the two decisions, nominative
  ('verification.identifier_confirmed',          'verification', 'identifier_change_review',
   'sensitive'),
  ('verification.identifier_proof_required',     'verification', 'identifier_change_review',
   'sensitive'),
  -- a « Compte vérifié » granted again after a proof required (modele §4)
  ('verification.badge_reconfirmed',             'verification', 'verification_badge', 'sensitive'),
  -- the queue only (never a register line): the e-mail of a proof required (08 RG94)
  ('verification.reconfirm_required',            'verification', 'identifier_change_review', 'info')
on conflict (code) do nothing;

-- 6. What the triggers of the line read and write (influx_creator_verification_definer) ---------------------

-- 6.1 The badge held by the line and its handle at the decision (modele point 12)
grant select (observed_handle_at_decision)
   on verification.badges to influx_creator_verification_definer;

-- 6.2 The entries of the caller's lines: open, updated, withdrawn
grant select (id, account_id, social_account_id, badge_id, previous_handle, state, observed_handle,
              decided_at, change_count)
   on verification.identifier_change_reviews to influx_creator_verification_definer;
grant insert (account_id, social_account_id, network_code, badge_id, previous_handle, new_handle)
   on verification.identifier_change_reviews to influx_creator_verification_definer;
grant update (new_handle, change_count, last_changed_at, state, withdrawn_cause, closed_at,
              claimed_by_account_id, claimed_at, claim_expires_at)
   on verification.identifier_change_reviews to influx_creator_verification_definer;

drop policy if exists identifier_change_reviews_creator_verification_definer_select
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_creator_verification_definer_select
  on verification.identifier_change_reviews
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists identifier_change_reviews_creator_verification_definer_insert
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_creator_verification_definer_insert
  on verification.identifier_change_reviews
  for insert to influx_creator_verification_definer
  with check (account_id = (select influx.current_account_id())
              and state = 'open' and claimed_by_account_id is null
              and decided_by_account_id is null and closed_at is null);
drop policy if exists identifier_change_reviews_creator_verification_definer_update
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_creator_verification_definer_update
  on verification.identifier_change_reviews
  for update to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and state = 'open')
  with check (account_id = (select influx.current_account_id())
              and state in ('open', 'withdrawn') and decided_by_account_id is null);

-- 6.3 The open contests of a deleted line (queue 5): withdrawn, cause line_deleted (modele point 6)
grant select (state) on verification.disputes to influx_creator_verification_definer;
grant update (state, withdrawn_cause, closed_at, claimed_by_account_id, claimed_at, claim_expires_at)
   on verification.disputes to influx_creator_verification_definer;

drop policy if exists disputes_creator_verification_definer_withdraw on verification.disputes;
create policy disputes_creator_verification_definer_withdraw on verification.disputes
  for update to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and state = 'open')
  with check (account_id = (select influx.current_account_id()) and state = 'withdrawn'
              and withdrawn_cause = 'line_deleted');

-- 6.4 The delay of queue 6 (the trigger of 2.1, invoker, reads it)
drop policy if exists sla_policies_creator_verification_definer_select on backoffice.sla_policies;
create policy sla_policies_creator_verification_definer_select on backoffice.sla_policies
  for select to influx_creator_verification_definer
  using (queue_code in ('verification', 'verification_disputes', 'identity_change_review'));

-- 6.5 The one normalisation of a handle (0228), granted by its owner (EC-L2F-08-2)
do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
set role influx_verification_definer;
grant execute on function verification.normalize_handle(text) to influx_creator_verification_definer;
reset role;

-- 7. What the agent functions and the badge triggers read and write (influx_verification_definer) ----------

-- 7.1 The entries: the claim, the decision, the exits badge_ended
grant select on verification.identifier_change_reviews to influx_verification_definer;
grant update (state, claimed_by_account_id, claimed_at, claim_expires_at, forced_release_at,
              forced_release_by_account_id, forced_release_holder_account_id,
              forced_release_reason_code, decided_by_account_id, decided_at, observed_handle,
              internal_comment, withdrawn_cause, closed_at)
   on verification.identifier_change_reviews to influx_verification_definer;

drop policy if exists identifier_change_reviews_verification_definer_select
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_verification_definer_select
  on verification.identifier_change_reviews
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists identifier_change_reviews_verification_definer_update
  on verification.identifier_change_reviews;
create policy identifier_change_reviews_verification_definer_update
  on verification.identifier_change_reviews
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (account_id is distinct from (select influx.current_account_id()));

-- 7.2 The badges: « preuve exigée » puts the holding ones of the line in to_reconfirm (RG78); a new
-- « Compte vérifié » gives the audience back (modele point 13). Never to_refresh nor expired (the task)
drop policy if exists badges_verification_definer_reconfirm on verification.badges;
create policy badges_verification_definer_reconfirm on verification.badges
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id())
         and state in ('active', 'to_refresh', 'to_reconfirm'))
  with check (state = 'to_reconfirm'
              or (state = 'active' and level = 'audience_verified' and expires_at > pg_catalog.now()));

-- 7.3 The queue: the e-mail of a proof required, besides the decision, the withdrawal, the outcome of a
-- contest and lead.updated
drop policy if exists outbox_events_verification_definer_insert on leads.outbox_events;
create policy outbox_events_verification_definer_insert on leads.outbox_events
  for insert to influx_verification_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((event_type in ('verification.decision', 'verification.revoked_notice',
                                   'verification.dispute_outcome',
                                   'verification.reconfirm_required')
                    and destination = 'brevo_transactional')
                   or (event_type = 'lead.updated' and destination = 'brevo_contact')));

-- 8. The functions ----------------------------------------------------------------------------------------

-- 8.1 The triggers of the line (08 RG78, CA54; modele points 6, 12) ---------------------------------------

create or replace function verification.track_identifier_change()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_badge     record;
  v_entry     record;
  v_previous  text;
  v_id        uuid;
  v_count     integer;
begin
  if verification.normalize_handle(old.handle) is not distinct from verification.normalize_handle(new.handle) then
    return null;
  end if;
  -- EC-L2F-08-1: an active « Compte vérifié » on the line (the caller's own: policy of the owner)
  select b.id, b.observed_handle_at_decision into v_badge
    from verification.badges b
   where b.account_id = new.account_id and b.social_account_id = new.id
     and b.level = 'account_verified' and b.state = 'active';
  if not found then
    return null;
  end if;

  -- modele point 12: one open entry per line, updated at each new change
  select r.id, r.previous_handle, r.change_count into v_entry
    from verification.identifier_change_reviews r
   where r.account_id = new.account_id and r.social_account_id = new.id and r.state = 'open'
     for update;
  if found then
    if verification.normalize_handle(new.handle)
         is not distinct from verification.normalize_handle(v_entry.previous_handle) then
      -- EC-L2F-08-4: back to the previous handle, nothing left to control
      update verification.identifier_change_reviews r
         set state                 = 'withdrawn',
             withdrawn_cause       = 'reverted',
             closed_at             = pg_catalog.now(),
             claimed_by_account_id = null,
             claimed_at            = null,
             claim_expires_at      = null
       where r.id = v_entry.id;
      perform audit.append('verification.identifier_change_withdrawn', 'identifier_change_review',
                           v_entry.id,
                           pg_catalog.jsonb_build_object('cause', 'reverted', 'badge_id', v_badge.id));
    else
      update verification.identifier_change_reviews r
         set new_handle      = new.handle,
             change_count    = r.change_count + 1,
             last_changed_at = pg_catalog.now()
       where r.id = v_entry.id
      returning r.change_count into v_count;
      perform audit.append('verification.identifier_changed', 'identifier_change_review', v_entry.id,
                           pg_catalog.jsonb_build_object('network_code', new.network_code,
                                                         'change_count', v_count));
    end if;
    return null;
  end if;

  -- modele point 12: the last confirmed finding on this badge, otherwise the badge's handle
  select r.observed_handle into v_previous
    from verification.identifier_change_reviews r
   where r.badge_id = v_badge.id and r.state = 'confirmed' and r.observed_handle is not null
   order by r.decided_at desc, r.id desc
   limit 1;
  v_previous := coalesce(v_previous, v_badge.observed_handle_at_decision, old.handle);
  if v_previous is null
     or verification.normalize_handle(new.handle)
          is not distinct from verification.normalize_handle(v_previous) then
    return null;
  end if;

  insert into verification.identifier_change_reviews
    (account_id, social_account_id, network_code, badge_id, previous_handle, new_handle)
  values (new.account_id, new.id, new.network_code, v_badge.id, v_previous, new.handle)
  returning id into v_id;
  perform audit.append('verification.identifier_changed', 'identifier_change_review', v_id,
                       pg_catalog.jsonb_build_object('network_code', new.network_code,
                                                     'change_count', 1));
  return null;
end
$$;

comment on function verification.track_identifier_change() is
  'AFTER UPDATE OF handle on profiles.creator_social_accounts (0233; 08 RG78, CA54; modele point 12; '
  'EC-L2F-08-1 to -4): when the normalised handle (verification.normalize_handle(), 0228) changes on '
  'a line that holds an active « Compte vérifié »: the open entry of the line updated (new_handle, '
  'change_count, last_changed_at; verification.identifier_changed {network_code, change_count}), or '
  'withdrawn when the handle comes back to its previous one (reverted); otherwise an entry of queue '
  '6 opened, previous_handle = the last confirmed finding on the badge or the badge''s handle at the '
  'decision (nothing when the new handle is that one). The badge never changes. Never a handle in the '
  'register. Never on the erasure (WHEN current_user <> influx_privacy_definer). SECURITY DEFINER '
  'owned by influx_creator_verification_definer, empty search_path; no EXECUTE for anyone.';

drop trigger if exists creator_social_accounts_track_identifier_change
  on profiles.creator_social_accounts;
create trigger creator_social_accounts_track_identifier_change
  after update of handle on profiles.creator_social_accounts
  for each row
  when (current_user <> 'influx_privacy_definer' and old.handle is distinct from new.handle)
  execute function verification.track_identifier_change();

create or replace function verification.withdraw_entries_of_line()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row  record;
begin
  -- queue 5: the open contests of a decision on the line (a refusal, a withdrawal)
  for v_row in
    select d.id
      from verification.disputes d
      left join verification.verification_requests r on r.id = d.request_id
      left join verification.badges b on b.id = d.badge_id
     where d.account_id = old.account_id
       and d.state = 'open'
       and coalesce(r.social_account_id, b.social_account_id) = old.id
     order by d.id
       for update of d
  loop
    update verification.disputes d
       set state                 = 'withdrawn',
           withdrawn_cause       = 'line_deleted',
           closed_at             = pg_catalog.now(),
           claimed_by_account_id = null,
           claimed_at            = null,
           claim_expires_at      = null
     where d.id = v_row.id;
    perform audit.append('verification.dispute_withdrawn', 'verification_dispute', v_row.id,
                         pg_catalog.jsonb_build_object('cause', 'line_deleted'));
  end loop;

  -- queue 6: the open entry of the line
  for v_row in
    select r.id, r.badge_id
      from verification.identifier_change_reviews r
     where r.account_id = old.account_id and r.social_account_id = old.id and r.state = 'open'
     order by r.id
       for update
  loop
    update verification.identifier_change_reviews r
       set state                 = 'withdrawn',
           withdrawn_cause       = 'line_deleted',
           closed_at             = pg_catalog.now(),
           claimed_by_account_id = null,
           claimed_at            = null,
           claim_expires_at      = null
     where r.id = v_row.id;
    perform audit.append('verification.identifier_change_withdrawn', 'identifier_change_review',
                         v_row.id,
                         pg_catalog.jsonb_build_object('cause', 'line_deleted',
                                                       'badge_id', v_row.badge_id));
  end loop;
  return null;
end
$$;

comment on function verification.withdraw_entries_of_line() is
  'AFTER DELETE on profiles.creator_social_accounts (0233; modele point 6; EC-L2F-6): the open '
  'contests of a decision on the deleted line (queue 5) and its open entry of queue 6 are withdrawn, '
  'cause line_deleted, the claim cleared (verification.dispute_withdrawn, '
  'verification.identifier_change_withdrawn {cause, badge_id}). The badges are left to the task '
  'badge_lifecycle (expired, cause line_deleted, 0230). The caller''s own rows only (policies of the '
  'owner). Never on the erasure (WHEN current_user <> influx_privacy_definer). SECURITY DEFINER owned '
  'by influx_creator_verification_definer, empty search_path; no EXECUTE for anyone.';

drop trigger if exists creator_social_accounts_withdraw_verification_entries
  on profiles.creator_social_accounts;
create trigger creator_social_accounts_withdraw_verification_entries
  after delete on profiles.creator_social_accounts
  for each row when (current_user <> 'influx_privacy_definer')
  execute function verification.withdraw_entries_of_line();

-- 8.2 The triggers of the badges (modele points 12, 13; EC-L2F-08-6) -------------------------------------

create or replace function verification.withdraw_identifier_reviews()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row  record;
begin
  for v_row in
    select r.id
      from verification.identifier_change_reviews r
     where r.badge_id = new.id and r.state = 'open'
     order by r.id
       for update
  loop
    update verification.identifier_change_reviews r
       set state                 = 'withdrawn',
           withdrawn_cause       = 'badge_ended',
           closed_at             = pg_catalog.now(),
           claimed_by_account_id = null,
           claimed_at            = null,
           claim_expires_at      = null
     where r.id = v_row.id;
    perform audit.append('verification.identifier_change_withdrawn', 'identifier_change_review',
                         v_row.id,
                         pg_catalog.jsonb_build_object('cause', 'badge_ended', 'badge_id', new.id));
  end loop;
  return null;
end
$$;

comment on function verification.withdraw_identifier_reviews() is
  'AFTER UPDATE OF state on verification.badges (0233; modele §3): the « Compte vérifié » held by an '
  'open entry of queue 6 ended (expired by the task, revoked under 2V, replaced): the entry is '
  'withdrawn, cause badge_ended, the claim cleared (verification.identifier_change_withdrawn {cause, '
  'badge_id}). Never on the erasure (0235 writes account_erased). SECURITY DEFINER owned by '
  'influx_verification_definer, empty search_path; no EXECUTE for anyone.';

drop trigger if exists badges_withdraw_identifier_reviews on verification.badges;
create trigger badges_withdraw_identifier_reviews
  after update of state on verification.badges
  for each row
  when (current_user <> 'influx_privacy_definer'
        and new.level = 'account_verified'
        and old.state in ('active', 'to_refresh', 'to_reconfirm')
        and new.state in ('expired', 'revoked', 'replaced'))
  execute function verification.withdraw_identifier_reviews();

create or replace function verification.guard_audience_identifier()
returns trigger
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- modele §3 « File 4 »: the audience of a line whose handle is in doubt is never granted
  if exists (select 1 from verification.identifier_change_reviews r
              where r.account_id = new.account_id and r.social_account_id = new.social_account_id
                and r.state = 'open') then
    raise exception 'ownership_prerequisite'
      using errcode = 'object_not_in_prerequisite_state', detail = 'ownership_prerequisite';
  end if;
  return new;
end
$$;

comment on function verification.guard_audience_identifier() is
  'BEFORE INSERT on verification.badges (0233; modele §3 « File 4 »; EC-L2F-08-6): a holding « Audience '
  'vérifiée » is never inserted while an entry of queue 6 of its line is open: 55000 '
  'ownership_prerequisite, nothing written (queue 4, the overturns of 0232 and every later grant). '
  'SECURITY DEFINER owned by influx_verification_definer, empty search_path; no EXECUTE for anyone.';

drop trigger if exists badges_guard_audience_identifier on verification.badges;
create trigger badges_guard_audience_identifier
  before insert on verification.badges
  for each row
  when (new.level = 'audience_verified' and new.state in ('active', 'to_refresh', 'to_reconfirm'))
  execute function verification.guard_audience_identifier();

create or replace function verification.restore_reconfirmed_audience()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_replaced  record;
  v_audience  uuid[];
begin
  -- modele point 13: the audience to_reconfirm of the line comes back while its expiry is ahead
  -- (EC-L2F-08-8: otherwise it waits for the task)
  with restored as (
    update verification.badges b
       set state = 'active'
     where b.account_id = new.account_id and b.social_account_id = new.social_account_id
       and b.level = 'audience_verified' and b.state = 'to_reconfirm'
       and b.expires_at > pg_catalog.now()
    returning b.id)
  select coalesce(pg_catalog.array_agg(restored.id order by restored.id), '{}'::uuid[])
    into v_audience
    from restored;
  if pg_catalog.cardinality(v_audience) > 0 then
    perform profiles.refresh_creator_public_network(new.social_account_id);
  end if;

  -- the « Compte vérifié » replaced in this transaction was held in doubt by a proof required
  select o.id as badge_id, r.id as review_id into v_replaced
    from verification.badges o
    join verification.identifier_change_reviews r
      on r.badge_id = o.id and r.state = 'proof_required'
   where o.account_id = new.account_id and o.social_account_id = new.social_account_id
     and o.level = 'account_verified' and o.state = 'replaced' and o.id <> new.id
     and o.ended_at = pg_catalog.now()
   order by r.decided_at desc, r.id desc
   limit 1;
  if found then
    perform audit.append('verification.badge_reconfirmed', 'verification_badge', new.id,
                         pg_catalog.jsonb_build_object('replaced_badge_id', v_replaced.badge_id,
                                                       'review_id', v_replaced.review_id,
                                                       'audience_badge_ids', v_audience));
  end if;
  return null;
end
$$;

comment on function verification.restore_reconfirmed_audience() is
  'AFTER INSERT on verification.badges (0233; modele point 13; EC-L2F-08-6, -8): a new active « Compte '
  'vérifié » (the reconfirmation by queue 4, or an overturn of 0232) gives back the « Audience '
  'vérifiée » to_reconfirm of its line whose expiry is ahead (active; the public row derived again); '
  'when the account badge it replaces in the same transaction was held by a proof required, '
  'verification.badge_reconfirmed {replaced_badge_id, review_id, audience_badge_ids}. SECURITY '
  'DEFINER owned by influx_verification_definer, empty search_path; no EXECUTE for anyone.';

drop trigger if exists badges_restore_reconfirmed_audience on verification.badges;
create trigger badges_restore_reconfirmed_audience
  after insert on verification.badges
  for each row
  when (new.level = 'account_verified' and new.state = 'active')
  execute function verification.restore_reconfirmed_audience();

-- 8.3 The helpers of the agent functions (SECURITY INVOKER, owned by influx_verification_definer) ------

-- the gate of every act on a held entry of queue 6 (15 RG27 C2, RG36; 08 RG53)
create or replace function verification.lock_held_identifier_change(p_review_id uuid, p_caller uuid)
returns table (
  account_id         uuid,
  social_account_id  uuid,
  network_code       text,
  badge_id           uuid,
  claimed_at         timestamptz
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
  select r.account_id, r.social_account_id, r.network_code, r.badge_id, r.state::text as state,
         r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
    into v_entry
    from verification.identifier_change_reviews r
   where r.id = p_review_id
     for update;
  -- unknown, the caller's own account (the policy hides it), an account he holds: one answer
  if not found or v_entry.account_id = p_caller
     or exists (select 1 from identity.accounts a
                 where a.id = v_entry.account_id and a.owner_agent_id = p_caller) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is distinct from p_caller
     or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim'
      using errcode = 'lock_not_available',
            detail = case when v_entry.claim_expires_at > pg_catalog.now()
                          then v_entry.claimed_by_account_id::text else 'none' end;
  end if;
  return query select v_entry.account_id, v_entry.social_account_id, v_entry.network_code,
                      v_entry.badge_id, v_entry.claimed_at;
end
$$;

comment on function verification.lock_held_identifier_change(uuid, uuid) is
  'The gate of the acts on a held entry of queue 6 (0233): locks the entry FOR UPDATE; 42501 for an '
  'unknown entry, one of the caller''s own account or of an account he holds (08 RG53); 55000 '
  'entry_closed once it left open; 55P03 no_live_claim (DETAIL the live holder or none) without the '
  'caller''s live claim. Returns its account, line, network, badge and claim instant. SECURITY '
  'INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

-- the version token (never stored, rendered at the opening and the dossier, recomputed at the decision)
create or replace function verification.identifier_change_review_token(p_review_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
           'review', pg_catalog.jsonb_build_array(r.id, r.state, r.previous_handle, r.new_handle,
                                                  r.change_count, r.last_changed_at),
           'badge', (select pg_catalog.jsonb_build_array(b.id, b.state)
                       from verification.badges b where b.id = r.badge_id),
           'line', (select pg_catalog.jsonb_build_array(l.handle, l.pseudonym, l.profile_url)
                      from profiles.creator_social_accounts l
                     where l.id = r.social_account_id and l.account_id = r.account_id)
         )::text, 'UTF8')), 'hex')
    from verification.identifier_change_reviews r
   where r.id = p_review_id
$$;

comment on function verification.identifier_change_review_token(uuid) is
  'modele §3 (0233; file.md A3): SHA-256 hex of the version examined: the entry (state, previous and '
  'new handle, number and instant of the last change), the badge held (state) and the line (handle, '
  'pseudonym, URL). Never stored; different at the decision: 55000 stale_token. STABLE. SECURITY '
  'INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

-- the gate of a decision: the live claim, the token
create or replace function verification.gate_identifier_change_decision(
  p_review_id     uuid,
  p_caller        uuid,
  p_review_token  text)
returns table (
  account_id         uuid,
  social_account_id  uuid,
  network_code       text,
  badge_id           uuid
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
  select * into v_entry from verification.lock_held_identifier_change(p_review_id, p_caller);
  if p_review_token is null
     or p_review_token is distinct from verification.identifier_change_review_token(p_review_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  return query select v_entry.account_id, v_entry.social_account_id, v_entry.network_code,
                      v_entry.badge_id;
end
$$;

comment on function verification.gate_identifier_change_decision(uuid, uuid, text) is
  '08 RG78 (0233): before any decision of queue 6, the refusals of '
  'verification.lock_held_identifier_change(), then 55000 stale_token. Returns the target. SECURITY '
  'INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

-- 8.4 The claim (15 RG27 C1 to C4; file.md A8, A9) ---------------------------------------------------------

create or replace function verification.open_identifier_change(p_review_id uuid)
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
  v_caller   uuid := verification.require_agent(false);
  v_entry    record;
  v_minutes  integer;
  v_outcome  text;
  v_holder   uuid;
  v_claimed  timestamptz;
  v_expires  timestamptz;
  v_token    text;
begin
  select r.account_id, r.state::text as state, r.claimed_by_account_id, r.claimed_at,
         r.claim_expires_at
    into v_entry
    from verification.identifier_change_reviews r
   where r.id = p_review_id
     for update;
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- 08 RG53: an open entry of an account the caller holds is not his to examine
  if v_entry.state = 'open'
     and exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.owner_agent_id = v_caller) then
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
      from backoffice.operational_settings s where s.key = 'claim_expiry_minutes';
    if v_minutes is null then
      raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
    end if;
    update verification.identifier_change_reviews r
       set claimed_by_account_id = v_caller,
           claimed_at            = pg_catalog.now(),
           claim_expires_at      = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
     where r.id = p_review_id
       and r.state = 'open'
       and (r.claimed_by_account_id is null or r.claim_expires_at <= pg_catalog.now())
    returning r.claimed_by_account_id, r.claimed_at, r.claim_expires_at
      into v_holder, v_claimed, v_expires;
    if found then
      v_outcome := 'claimed';
      if v_entry.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_review_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'identity_change_review',
                               'holder_account_id', v_entry.claimed_by_account_id,
                               'claimed_at', v_entry.claimed_at,
                               'expired_at', v_entry.claim_expires_at));
      end if;
    else
      v_outcome := 'read_only';
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  end if;

  if v_outcome in ('claimed', 'held') then
    v_token := verification.identifier_change_review_token(p_review_id);
  end if;
  perform audit.append('queue.entry_opened', 'queue_entry', p_review_id,
                       pg_catalog.jsonb_build_object('queue_code', 'identity_change_review',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires, v_token;
end
$$;

comment on function verification.open_identifier_change(uuid) is
  '15 RG27 C1 to C3, RG35; 08 RG53, RG78; file.md A9 (0233): an agent or an admin opens an entry of '
  'queue 6. Free, or its claim expired: claimed by an atomic conditional UPDATE (claim_expiry_minutes; '
  'an expired claim taken over writes queue.claim_expired first). Returns (outcome, holder, '
  'claimed_at, claim_expires_at, review_token): claimed or held with the token, read_only with the '
  'live holder, closed with nothing; queue.entry_opened {queue_code: identity_change_review, '
  'outcome}. 42501 for an unknown entry, the caller''s own account, an open entry of an account he '
  'holds, outside an active agent or admin in aal2. SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

create or replace function verification.release_identifier_change(p_review_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := verification.require_agent(false);
  v_entry   record;
begin
  select * into v_entry from verification.lock_held_identifier_change(p_review_id, v_caller);
  update verification.identifier_change_reviews r
     set claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
   where r.id = p_review_id;
  perform audit.append('queue.claim_released', 'queue_entry', p_review_id,
                       pg_catalog.jsonb_build_object('queue_code', 'identity_change_review',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at));
end
$$;

comment on function verification.release_identifier_change(uuid) is
  '15 RG27 C3, file.md A9 (0233): the holder of a live claim gives the entry back to queue 6; line '
  'queue.claim_released {queue_code, holder_account_id, claimed_at}, no comment. The refusals of '
  'verification.lock_held_identifier_change(). SECURITY DEFINER owned by influx_verification_definer; '
  'EXECUTE for influx_agent and influx_admin.';

create or replace function verification.extend_identifier_change_claim(p_review_id uuid)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller   uuid := verification.require_agent(false);
  v_entry    record;
  v_minutes  integer;
  v_expires  timestamptz;
begin
  select * into v_entry from verification.lock_held_identifier_change(p_review_id, v_caller);
  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;
  update verification.identifier_change_reviews r
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where r.id = p_review_id
  returning r.claim_expires_at into v_expires;
  perform audit.append('queue.claim_extended', 'queue_entry', p_review_id,
                       pg_catalog.jsonb_build_object('queue_code', 'identity_change_review',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function verification.extend_identifier_change_claim(uuid) is
  'file.md A9 (0233): the holder of a live claim extends it to now() + claim_expiry_minutes; line '
  'queue.claim_extended {queue_code, holder_account_id, claimed_at, claim_expires_at}; returns the new '
  'expiry. The refusals of verification.lock_held_identifier_change(). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

create or replace function verification.force_release_identifier_change_claim(
  p_review_id    uuid,
  p_reason_code  text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := verification.require_agent(true);
  v_entry   record;
begin
  perform 1 from backoffice.claim_release_reasons r where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  select r.account_id, r.state::text as state, r.claimed_by_account_id, r.claim_expires_at
    into v_entry
    from verification.identifier_change_reviews r
   where r.id = p_review_id
     for update;
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_entry.state <> 'open' then
    raise exception 'entry_closed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'entry_closed';
  end if;
  if v_entry.claimed_by_account_id is null or v_entry.claim_expires_at <= pg_catalog.now() then
    raise exception 'no_live_claim' using errcode = 'lock_not_available', detail = 'none';
  end if;
  update verification.identifier_change_reviews r
     set claimed_by_account_id            = null,
         claimed_at                       = null,
         claim_expires_at                 = null,
         forced_release_at                = pg_catalog.now(),
         forced_release_by_account_id     = v_caller,
         forced_release_holder_account_id = v_entry.claimed_by_account_id,
         forced_release_reason_code       = p_reason_code
   where r.id = p_review_id;
  perform audit.append('queue.claim_forced_release', 'queue_entry', p_review_id,
                       pg_catalog.jsonb_build_object('queue_code', 'identity_change_review',
                                                     'holder_account_id', v_entry.claimed_by_account_id,
                                                     'reason_code', p_reason_code));
  return v_entry.claimed_by_account_id;
end
$$;

comment on function verification.force_release_identifier_change_claim(uuid, text) is
  '15 RG27 C4, file.md A8 (0233): an administrator lifts a live claim of queue 6 before its expiry, '
  'with a typed reason of backoffice.claim_release_reasons; the entry keeps the last forced release; '
  'line queue.claim_forced_release {queue_code, holder_account_id, reason_code}; returns the holder. '
  '22023 reason, 55P03 none, 55000 entry_closed, 42501 outside an active admin in aal2 (an agent''s '
  'attempt is journalled by apps/api). SECURITY DEFINER owned by influx_verification_definer; EXECUTE '
  'for influx_agent and influx_admin (the function refuses the agent).';

-- 8.5 The examination (08 RG78) --------------------------------------------------------------------------

create or replace function verification.read_identifier_change_dossier(p_review_id uuid)
returns table (
  review_id            uuid,
  account_id           uuid,
  network_code         text,
  social_account_id    uuid,
  previous_handle      text,
  new_handle           text,
  change_count         integer,
  created_at           timestamptz,
  last_changed_at      timestamptz,
  sla_due_at           timestamptz,
  escalate_at          timestamptz,
  handle               text,
  pseudonym            text,
  profile_url          text,
  badge_id             uuid,
  badge_state          text,
  badge_granted_at     timestamptz,
  audience_badge_id    uuid,
  audience_state       text,
  audience_expires_at  timestamptz,
  review_token         text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid := verification.require_agent(false);
  v_entry   record;
begin
  select * into v_entry from verification.lock_held_identifier_change(p_review_id, v_caller);

  -- one query, one snapshot: the token is the token of the view shown
  return query
    select r.id, r.account_id, r.network_code, r.social_account_id, r.previous_handle,
           r.new_handle, r.change_count, r.created_at, r.last_changed_at, r.sla_due_at,
           r.escalate_at, l.handle, l.pseudonym, l.profile_url, b.id, b.state::text, b.granted_at,
           a.id, a.state::text, a.expires_at,
           verification.identifier_change_review_token(r.id)
      from verification.identifier_change_reviews r
      join verification.badges b on b.id = r.badge_id
      left join profiles.creator_social_accounts l
             on l.id = r.social_account_id and l.account_id = r.account_id
      left join lateral (
             select h.id, h.state, h.expires_at
               from verification.badges h
              where h.account_id = r.account_id and h.social_account_id = r.social_account_id
                and h.level = 'audience_verified'
                and h.state in ('active', 'to_refresh', 'to_reconfirm')
              order by h.granted_at desc
              limit 1) a on true
     where r.id = p_review_id;
end
$$;

comment on function verification.read_identifier_change_dossier(uuid) is
  '08 RG78 (0233): the holder of a live claim reads the dossier of an entry of queue 6, one row: the '
  'entry (previous and new handle, number and instant of the changes, deadlines), the line as declared '
  'now (handle, pseudonym, URL; NEVER a figure), the « Compte vérifié » held and the holding audience '
  'of the line (state, expiry), the review token of this snapshot. The refusals of '
  'verification.lock_held_identifier_change(). SECURITY DEFINER owned by influx_verification_definer; '
  'EXECUTE for influx_agent and influx_admin.';

-- 8.6 The decisions (08 RG78, CA54; 15 C6; modele point 13) -------------------------------------------------

-- « même compte »: the agent's finding written on the entry, the badge never rewritten (EC-L2F-13)
create or replace function verification.confirm_identifier_change(
  p_review_id         uuid,
  p_review_token      text,
  p_observed_handle   text,
  p_internal_comment  text)
returns table (
  outcome       text,
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
  v_caller    uuid := verification.require_agent(false);
  v_handle    text := pg_catalog.btrim(p_observed_handle);
  v_entry     record;
  v_declared  text;
  v_decided   timestamptz;
  v_late      boolean;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if v_handle is null or pg_catalog.char_length(v_handle) not between 1 and 100
     or v_handle ~ '[[:cntrl:]]' then
    raise exception 'observed_handle' using errcode = 'invalid_parameter_value', detail = 'observed_handle';
  end if;

  select * into v_entry
    from verification.gate_identifier_change_decision(p_review_id, v_caller, p_review_token);
  select l.handle into v_declared
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if not found then
    raise exception 'line_deleted'
      using errcode = 'object_not_in_prerequisite_state', detail = 'line_deleted';
  end if;
  -- fiche invariant 7, 0228: the handle read on line is the handle declared now
  if verification.normalize_handle(v_declared) is null
     or verification.normalize_handle(v_declared) <> verification.normalize_handle(v_handle) then
    raise exception 'observed_handle_mismatch'
      using errcode = 'invalid_parameter_value', detail = 'observed_handle_mismatch';
  end if;
  -- EC-L2F-08-5, edge case l. 800: never « même compte » on a handle verified for another account
  if exists (select 1 from verification.badges b
              where b.account_id <> v_entry.account_id
                and b.network_code = v_entry.network_code
                and b.level = 'account_verified'
                and b.state in ('active', 'to_refresh', 'to_reconfirm')
                and verification.normalize_handle(b.observed_handle_at_decision)
                      = verification.normalize_handle(v_handle)) then
    raise exception 'handle_already_verified'
      using errcode = 'object_not_in_prerequisite_state', detail = 'handle_already_verified';
  end if;

  update verification.identifier_change_reviews r
     set state                 = 'confirmed',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         observed_handle       = v_handle,
         internal_comment      = p_internal_comment,
         closed_at             = pg_catalog.now(),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null
   where r.id = p_review_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  -- invariant 12: codes and identifiers, never a handle nor the comment
  perform audit.append('verification.identifier_confirmed', 'identifier_change_review', p_review_id,
                       pg_catalog.jsonb_build_object('network_code', v_entry.network_code,
                                                     'badge_id', v_entry.badge_id,
                                                     'late', v_late));
  return query select 'confirmed'::text, v_decided, v_late;
end
$$;

comment on function verification.confirm_identifier_change(uuid, text, text, text) is
  '08 RG78, CA54 (0233; EC-L2F-13; EC-L2F-08-5, -9): the holder of a live claim records that the '
  'account is the same: the handle he read on line, compared with the handle declared now '
  '(verification.normalize_handle(), 0228), written on the entry with his identity and the instant; '
  'the badge is never rewritten, nothing is sent. Never on a handle a holding « Compte vérifié » of '
  'ANOTHER account carries. verification.identifier_confirmed {network_code, badge_id, late}. Returns '
  '(confirmed, decided_at, sla_breached). 22023 observed_handle, internal_comment, '
  'observed_handle_mismatch; 55000 line_deleted, handle_already_verified; then the refusals of '
  'verification.gate_identifier_change_decision(). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- « preuve exigée »: the badges of the line to_reconfirm, the public row declared, the e-mail (RG78)
create or replace function verification.require_identifier_proof(
  p_review_id         uuid,
  p_review_token      text,
  p_internal_comment  text)
returns table (
  outcome             text,
  decided_at          timestamptz,
  sla_breached        boolean,
  badge_id            uuid,
  audience_badge_ids  uuid[]
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller    uuid := verification.require_agent(false);
  v_entry     record;
  v_badge     uuid;
  v_audience  uuid[];
  v_decided   timestamptz;
  v_late      boolean;
  v_event     uuid := pg_catalog.gen_random_uuid();
  v_lead      uuid := pg_catalog.gen_random_uuid();
begin
  perform verification.check_internal_comment(p_internal_comment);
  select * into v_entry
    from verification.gate_identifier_change_decision(p_review_id, v_caller, p_review_token);

  -- RG78: « Compte vérifié » to_reconfirm (an ended badge already withdrew the entry)
  update verification.badges b
     set state = 'to_reconfirm'
   where b.id = v_entry.badge_id and b.state = 'active'
  returning b.id into v_badge;
  if v_badge is null then
    raise exception 'badge_not_holding'
      using errcode = 'object_not_in_prerequisite_state', detail = 'badge_not_holding';
  end if;
  -- EC-L2F-13: the holding audience of the line goes with it (it requires the ownership, L2E -13)
  with doubted as (
    update verification.badges b
       set state = 'to_reconfirm'
     where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
       and b.level = 'audience_verified' and b.state in ('active', 'to_refresh')
    returning b.id)
  select coalesce(pg_catalog.array_agg(doubted.id order by doubted.id), '{}'::uuid[])
    into v_audience
    from doubted;
  -- RG93, fiche invariant 2: the public row of the line back to the declared figures
  perform profiles.refresh_creator_public_network(v_entry.social_account_id);

  update verification.identifier_change_reviews r
     set state                 = 'proof_required',
         decided_by_account_id = v_caller,
         decided_at            = pg_catalog.now(),
         internal_comment      = p_internal_comment,
         closed_at             = pg_catalog.now(),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null
   where r.id = p_review_id
  returning r.decided_at, r.sla_breached into v_decided, v_late;

  perform audit.append('verification.identifier_proof_required', 'identifier_change_review',
                       p_review_id,
                       pg_catalog.jsonb_build_object('network_code', v_entry.network_code,
                                                     'badge_id', v_badge,
                                                     'audience_badge_ids', v_audience,
                                                     'late', v_late));
  -- 08 RG94: the creator is told, written by the worker from email.json (D69); ids only
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'verification.reconfirm_required', 'brevo_transactional',
          'account:' || v_entry.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_entry.account_id,
                                        'review_id', p_review_id,
                                        'email_code', 'verification.reconfirm_required'),
          'verification.reconfirm_required:' || p_review_id::text);
  -- modele §4: VERIFIED_LEVEL follows every change of badge, Brevo only
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_lead, 'lead.updated', 'brevo_contact', 'account:' || v_entry.account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', v_entry.account_id),
          'lead.updated:' || v_lead::text);
  return query select 'proof_required'::text, v_decided, v_late, v_badge, v_audience;
end
$$;

comment on function verification.require_identifier_proof(uuid, text, text) is
  '08 RG78, CA54 (0233; EC-L2F-13): the holder of a live claim requires a new proof of ownership: the '
  '« Compte vérifié » held and the holding « Audience vérifiée » of the line pass to to_reconfirm '
  '(visible to the creator, never active elsewhere), the public row of the line derived again from the '
  'declared figures, verification.reconfirm_required (key verification.reconfirm_required:<id>) and '
  'lead.updated queued, verification.identifier_proof_required {network_code, badge_id, '
  'audience_badge_ids, late}. A new finding of queue 4 gives the state back (modele point 13). Returns '
  '(proof_required, decided_at, sla_breached, badge_id, audience_badge_ids). 22023 internal_comment; '
  '55000 badge_not_holding; then the refusals of verification.gate_identifier_change_decision(). '
  'SECURITY DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 9. Rights on the functions, then to their owners (03 P7 rule 5) -----------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.track_identifier_change()',
    'verification.withdraw_entries_of_line()',
    'verification.withdraw_identifier_reviews()',
    'verification.guard_audience_identifier()',
    'verification.restore_reconfirmed_audience()',
    'verification.lock_held_identifier_change(uuid, uuid)',
    'verification.identifier_change_review_token(uuid)',
    'verification.gate_identifier_change_decision(uuid, uuid, text)',
    'verification.open_identifier_change(uuid)',
    'verification.release_identifier_change(uuid)',
    'verification.extend_identifier_change_claim(uuid)',
    'verification.force_release_identifier_change_claim(uuid, text)',
    'verification.read_identifier_change_dossier(uuid)',
    'verification.confirm_identifier_change(uuid, text, text, text)',
    'verification.require_identifier_proof(uuid, text, text)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', f);
  end loop;
end
$$;

grant execute on function
  verification.open_identifier_change(uuid),
  verification.release_identifier_change(uuid),
  verification.extend_identifier_change_claim(uuid),
  verification.force_release_identifier_change_claim(uuid, text),
  verification.read_identifier_change_dossier(uuid),
  verification.confirm_identifier_change(uuid, text, text, text),
  verification.require_identifier_proof(uuid, text, text)
  to influx_agent, influx_admin;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;
grant create on schema verification to influx_creator_verification_definer;

alter function verification.track_identifier_change() owner to influx_creator_verification_definer;
alter function verification.withdraw_entries_of_line() owner to influx_creator_verification_definer;

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.withdraw_identifier_reviews()',
    'verification.guard_audience_identifier()',
    'verification.restore_reconfirmed_audience()',
    'verification.lock_held_identifier_change(uuid, uuid)',
    'verification.identifier_change_review_token(uuid)',
    'verification.gate_identifier_change_decision(uuid, uuid, text)',
    'verification.open_identifier_change(uuid)',
    'verification.release_identifier_change(uuid)',
    'verification.extend_identifier_change_claim(uuid)',
    'verification.force_release_identifier_change_claim(uuid, text)',
    'verification.read_identifier_change_dossier(uuid)',
    'verification.confirm_identifier_change(uuid, text, text, text)',
    'verification.require_identifier_proof(uuid, text, text)']
  loop
    execute format('alter function %s owner to influx_verification_definer', f);
  end loop;
end
$$;

revoke create on schema verification from influx_verification_definer;
revoke create on schema verification from influx_creator_verification_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_verification_definer', current_user);
  execute format('revoke %I from %I', 'influx_creator_verification_definer', current_user);
end
$$;

-- 10. End-state assertions --------------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  -- the functions: owner, security, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('verification.track_identifier_change()', 'influx_creator_verification_definer', true,
       array[]::text[]),
      ('verification.withdraw_entries_of_line()', 'influx_creator_verification_definer', true,
       array[]::text[]),
      ('verification.withdraw_identifier_reviews()', 'influx_verification_definer', true,
       array[]::text[]),
      ('verification.guard_audience_identifier()', 'influx_verification_definer', true,
       array[]::text[]),
      ('verification.restore_reconfirmed_audience()', 'influx_verification_definer', true,
       array[]::text[]),
      ('verification.lock_held_identifier_change(uuid,uuid)', 'influx_verification_definer', false,
       array[]::text[]),
      ('verification.identifier_change_review_token(uuid)', 'influx_verification_definer', false,
       array[]::text[]),
      ('verification.gate_identifier_change_decision(uuid,uuid,text)', 'influx_verification_definer',
       false, array[]::text[]),
      ('verification.open_identifier_change(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.release_identifier_change(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.extend_identifier_change_claim(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.force_release_identifier_change_claim(uuid,text)', 'influx_verification_definer',
       true, array['influx_agent', 'influx_admin']),
      ('verification.read_identifier_change_dossier(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.confirm_identifier_change(uuid,text,text,text)', 'influx_verification_definer',
       true, array['influx_agent', 'influx_admin']),
      ('verification.require_identifier_proof(uuid,text,text)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      -- EC-L2F-08-2: the normalisation of 0228, executed by the trigger of the line as well
      ('verification.normalize_handle(text)', 'influx_verification_definer', false,
       array['influx_creator_verification_definer'])
    ) as f (sig, owner, definer, callers)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> f.owner
      or p.prosecdef is distinct from f.definer
      or p.proconfig is distinct from array['search_path=""']
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0 or a.grantee::regrole::text <> all (f.callers)));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, search_path or callers: %', v_bad;
  end if;

  -- RLS enabled, forced and policed on the new table
  if not exists (select 1 from pg_catalog.pg_class c
                  where c.oid = 'verification.identifier_change_reviews'::regclass
                    and c.relrowsecurity and c.relforcerowsecurity
                    and exists (select 1 from pg_catalog.pg_policies p
                                 where p.schemaname = 'verification'
                                   and p.tablename = 'identifier_change_reviews')) then
    raise exception 'row level security not enabled, forced and policed on identifier_change_reviews';
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  if pg_catalog.has_table_privilege('influx_advertiser', 'verification.identifier_change_reviews',
                                    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or pg_catalog.has_any_column_privilege('influx_advertiser',
                                            'verification.identifier_change_reviews',
                                            'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_advertiser holds a right on verification.identifier_change_reviews';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'verification'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'influx_advertiser may execute: %', v_bad;
  end if;

  -- modele §2: no member reads an entry of queue 6
  if pg_catalog.has_any_column_privilege('influx_creator', 'verification.identifier_change_reviews',
                                         'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_creator holds a right on verification.identifier_change_reviews';
  end if;

  -- still no execution role writing the schema verification
  select string_agg(r.rolname || ' ' || c.relname, ', ') into v_bad
    from pg_catalog.pg_roles r, pg_catalog.pg_class c
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and c.relnamespace = 'verification'::regnamespace and c.relkind in ('r', 'p')
     and (pg_catalog.has_any_column_privilege(r.oid, c.oid, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'execution role(s) writing a verification table: %', v_bad;
  end if;

  -- 08.md « Arrêt si », EC-L2F-08-7: the handle of a line is written by the creator (the trigger sees
  -- it) and by the erasure (excluded on purpose) only
  select string_agg(distinct a.grantee::regrole::text, ', ') into v_bad
    from (select (pg_catalog.aclexplode(t.attacl)).*
            from pg_catalog.pg_attribute t
           where t.attrelid = 'profiles.creator_social_accounts'::regclass
             and t.attname = 'handle' and t.attacl is not null
          union all
          select (pg_catalog.aclexplode(c.relacl)).*
            from pg_catalog.pg_class c
           where c.oid = 'profiles.creator_social_accounts'::regclass and c.relacl is not null) a
   where a.privilege_type = 'UPDATE'
     and a.grantee <> (select c.relowner from pg_catalog.pg_class c
                        where c.oid = 'profiles.creator_social_accounts'::regclass)
     and (a.grantee = 0
          or a.grantee::regrole::text not in ('influx_creator', 'influx_privacy_definer'));
  if v_bad is not null then
    raise exception 'the handle of a line is written by a role the trigger does not follow: %', v_bad;
  end if;

  -- queue 6 and its delay
  if not exists (select 1 from backoffice.queues
                  where code = 'identity_change_review' and label_key = 'queue.identity_change_review'
                    and handled_by_roles = '{agent,admin}'::identity.account_role[]
                    and not allows_bulk_action and has_lock and is_active)
     or not exists (select 1 from backoffice.sla_policies
                     where queue_code = 'identity_change_review' and target_claim_minutes = 240
                       and target_decision_minutes = 480 and escalate_after_minutes = 960
                       and business_hours is not null and not is_provisional and is_active) then
    raise exception 'queue identity_change_review or its delay is not as 15 RG29 says';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_verification_definer', 'influx_creator_verification_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_verification_definer', 'verification', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_creator_verification_definer', 'verification',
                                        'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
