-- =============================================================================
-- 0232_verification_badge_disputes
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 07 (jalons/l2f/07.md; l2f/modele.md §1 points 7 to 10, §2 "disputes",
-- "dispute_reasons", "dispute_outcome_reasons", §3 "0232", §4, which prevails for every name;
-- l2f/textes.md « Contestation », « Issue »; l2f-fiche.md invariants 6, 8, 10, 12; 08 RG77, CA52,
-- CA53, écart 4; 04 l. 1656, l. 5107; 15 RG27 C1 to C8, RG29 file 5; archives/jalons/l2c/file.md A1
-- to A9). A creator contests a refusal or a withdrawal within dispute_window_days of its
-- notification, once per decision; the contest enters queue 5 `verification_disputes` and is decided
-- by another person than the decider as soon as the team counts one, otherwise not before
-- dispute_reflection_hours after its submission; two outcomes, notified with a reason; a badge given
-- back carries a new date of decision (CA53).
--
-- 1. verification.dispute_state (open, upheld, overturned, withdrawn); verification.dispute_reasons
--    (the creator's closed list: misread, evidence_valid, reason_wrong, other with a text);
--    verification.dispute_outcome_reasons (decision_confirmed, new_request_needed, other with a
--    message: upheld; decision_overturned: overturned).
-- 2. verification.disputes, the entry of queue 5 as file.md A1: exactly one of request_id (a
--    refusal) or badge_id (a withdrawal), each unique (one per decision); the deciders frozen at the
--    submission (the refusal's decider; the requester and the executor of the 2V of a withdrawal,
--    modele point 10); the lock, the deadlines frozen at the submission by a BEFORE trigger (04
--    §5.6), the outcome, its reason, its message, the internal comment, review_mode (independent,
--    delayed), the cause of a withdrawal (superseded, line_deleted, account_erased). The state
--    moves forward only. verification.badges + dispute_id (the badge a dispute gave back).
-- 3. Queue 5 in the catalogue (15 RG29: agent and admin, a lock, no bulk action; 04 l. 5107: 5
--    business days, a proposal: is_provisional) and the parameter dispute_reflection_hours (24, 24 to
--    168, modele point 10).
-- 4. The creator door (influx_creator_verification_definer, EXECUTE influx_creator):
--      verification.submit_own_dispute(request, badge, reason, text) -> uuid.
-- 5. The agent functions (influx_verification_definer, EXECUTE influx_agent, influx_admin): open,
--    release, extend, force release (admin), dossier, journalled read of an evidence, uphold, and
--    the three overturns (a refused « Compte vérifié », a refused « Audience vérifiée », a withdrawal);
--    the version token, never stored; the trigger withdraw_superseded_disputes() on verification.badges
--    (a badge of the same level granted on the line meanwhile closes the contest: superseded);
--    verification.read_account_badges() recreated with the contest of each badge.
--
-- Refusals (the MESSAGE is the code, the DETAIL its precision):
--   42501 forbidden   outside an active creator (door) or agent/admin in aal2; an unknown request,
--                     badge or contest, one of another account, of the caller's own account or of
--                     an account he holds.
--   55P03 no_live_claim (DETAIL the live holder or none).
--   55000 not_disputable (an approved, closed, pending request; a badge not revoked under 2V, the
--         audience carried along included), dispute_window_closed (DETAIL the closing instant, ISO
--         8601 UTC), already_disputed, entry_closed, stale_token, reviewer_is_decider,
--         reflection_delay (DETAIL the seconds left), missing_evidence, ownership_prerequisite,
--         restore_expired, line_deleted, account_unavailable, handle_already_verified.
--   22023 reason, text, member_message, internal_comment, level, and those of the grants
--         (observed_handle, observed_platform_account_ref, code_mismatch, observed_handle_mismatch,
--         figures_invalid, period_invalid); 23514 declared_figures_required.
--
-- Rights (fiche invariant 10): the three tables RLS forced, nothing for influx_advertiser. The
-- creator reads his own contests (never the lock, an agent, the deadlines, the deciders, the internal
-- comment nor review_mode); agent and admin read them in aal2, never on their own account; nobody
-- writes directly.
--
-- Not here: queue 6 (0233, L2F commit 08: it also closes the contests of a deleted line); the routes
-- (L2F commit 14); the e-mail bodies (12); the export and the erasure of the contests (0235); the
-- amendments of 08 RG77, écart 4, 04 l. 1656, 15 RG29, 17 l. 1768 (closure of the jalon).
--
-- EC-L2F-07 (micro-gaps, the safest choice):
--   EC-L2F-07-1  the case of 07.md « Arrêt si »: a refusal of « Audience vérifiée » whose evidence is
--                no longer active (evidence_too_wide purges it at the refusal, RG88; any other after
--                evidence_retention_days) cannot be overturned on the original dossier: the overturn
--                answers 55000 missing_evidence, the reviewer upholds with new_request_needed (« vous
--                pouvez déposer une nouvelle demande »). Written here, no stop: modele point 9 and
--                textes « Issue » already carry both answers.
--   EC-L2F-07-2  an overturn of « Compte vérifié » (refusal or withdrawal) on a handle that a holding
--                account badge of ANOTHER account carries (08 edge case l. 800) is refused 55000
--                handle_already_verified, nothing written: the reviewer upholds; the escalation of
--                the grant (0228) belongs to a decision of queue 4, not to a contest.
--   EC-L2F-07-3  a function that does not match the contest (an overturn of a refusal on a
--                withdrawal, of « Compte vérifié » on « Audience vérifiée », and conversely): 22023
--                level, as the grants answer a request of another level.
--   EC-L2F-07-4  a refused audience overturned: the period is judged at the date of the refusal
--                (end <= that day, that day - end < evidence_freshness_days); expires_at = the
--                refusal's decided_at + audience_badge_validity_days; past: 55000 restore_expired.
--   EC-L2F-07-5  the contest of a withdrawal names the badge of the 2V only: the audience carried
--                along by a withdrawn « Compte vérifié » answers not_disputable (modele point 4), and
--                its overturn gives back that audience when its original expiry is still ahead
--                (modele point 4), silently otherwise.
--   EC-L2F-07-6  the trigger withdraw_superseded_disputes() spares the contest whose overturn grants
--                the badge (new.dispute_id), and closes any OTHER open contest of the same level and
--                line (modele point 9: « Badge du même niveau accordé entre-temps »).
--   EC-L2F-07-7  the deadlines are written at the insertion (the submission IS the insertion), from
--                the policy of queue 5 in force (04 §5.6), and frozen with the target, the level, the
--                reason and the deciders; the text stays writable for the erasure (0235).
--   EC-L2F-07-8  the claim is cleared when a contest leaves `open` (a lock only on an open entry).
--   EC-L2F-07-9  the dossier (read_dispute_dossier) lists every evidence row of the refused request
--                with its state (purged included, never a key), so that the reviewer sees why an
--                overturn is impossible (EC-L2F-07-1).
--
-- ROLLBACK (before any contest): drop the functions of §6 to §8 (read_account_badges recreated as
-- in 0231); drop trigger badges_withdraw_superseded_disputes, disputes_prepare,
-- disputes_touch_updated_at; drop function verification.prepare_dispute(); drop column
-- verification.badges.dispute_id; drop table verification.disputes,
-- verification.dispute_outcome_reasons, verification.dispute_reasons; drop type
-- verification.dispute_state; drop the policies *_disputes_*, *_dispute_* named below and revoke their
-- grants; recreate the policies outbox_events_verification_definer_insert (0231),
-- outbox_events_creator_verification_definer_insert (0222),
-- operational_settings_creator_verification_definer_select (0223),
-- operational_settings_verification_definer_select (0224),
-- sla_policies_creator_verification_definer_select (0222); delete from backoffice.queues and
-- backoffice.sla_policies where code / queue_code = 'verification_disputes'; delete the key
-- dispute_reflection_hours and recreate operational_settings_key_closed as in 0230; delete the five
-- event types of §5.
-- =============================================================================

-- 1. The closed lists (modele §2; textes « Contestation », « Issue »; 08 écart 4) --------------------------

do $$
begin
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'dispute_state' and t.typnamespace = 'verification'::regnamespace) then
    create type verification.dispute_state as enum ('open', 'upheld', 'overturned', 'withdrawn');
  end if;
end
$$;

comment on type verification.dispute_state is
  'Life of a contest (0232, modele §2): open (in queue 5), upheld, overturned (the two outcomes of 15 '
  'C6), withdrawn (a badge of the same level granted meanwhile, the line deleted, the account erased; '
  'never a decision).';

create table if not exists verification.dispute_reasons (
  code           text     not null primary key,
  label_key      text     not null,
  requires_text  boolean  not null default false,
  position       smallint not null,
  is_active      boolean  not null default true,

  constraint dispute_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint dispute_reasons_label_key check (label_key = 'reason.verification_dispute.' || code),
  constraint dispute_reasons_position check (position > 0),
  constraint dispute_reasons_position_unique unique (position)
);

comment on table verification.dispute_reasons is
  'The closed list of the creator''s reasons to contest (0232; 08 RG77, écart 4; l2f/textes.md '
  '« Contestation »): misread, evidence_valid, reason_wrong, other (a text required). Read by agent '
  'and admin in aal2 and by the creator door; written by the migrations.';
comment on column verification.dispute_reasons.requires_text is
  'The contest requires the creator''s text (1 to 1 000 characters): other only (modele point 7).';

insert into verification.dispute_reasons (code, label_key, requires_text, position) values
  ('misread',        'reason.verification_dispute.misread',        false, 1),
  ('evidence_valid', 'reason.verification_dispute.evidence_valid', false, 2),
  ('reason_wrong',   'reason.verification_dispute.reason_wrong',   false, 3),
  ('other',          'reason.verification_dispute.other',          true,  4)
on conflict (code) do nothing;

create table if not exists verification.dispute_outcome_reasons (
  code                     text     not null primary key,
  outcome                  verification.dispute_state not null,
  label_key                text     not null,
  message_key              text     not null,
  requires_member_message  boolean  not null default false,
  position                 smallint not null,
  is_active                boolean  not null default true,

  constraint dispute_outcome_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint dispute_outcome_reasons_outcome check (outcome in ('upheld', 'overturned')),
  constraint dispute_outcome_reasons_label_key
    check (label_key = 'reason.verification_dispute_outcome.' || code),
  constraint dispute_outcome_reasons_message_key
    check (message_key = 'verificationDispute.outcome.' || code),
  constraint dispute_outcome_reasons_position check (position > 0),
  constraint dispute_outcome_reasons_position_unique unique (position),
  -- target of the composite key of a decided contest: a reason of ITS outcome
  constraint dispute_outcome_reasons_outcome_code unique (outcome, code)
);

comment on table verification.dispute_outcome_reasons is
  'The closed list of the outcome of a contest (0232; 08 RG77 « notifié de l''issue avec un motif »; '
  'l2f/textes.md « Issue »), each tied to its outcome: decision_confirmed, new_request_needed, other '
  '(a message required) uphold; decision_overturned overturns. message_key: '
  'verificationDispute.outcome.<code> in apps/api/src/locales/{fr,en}/email.json. Read by agent and '
  'admin in aal2; written by the migrations.';

insert into verification.dispute_outcome_reasons
  (code, outcome, label_key, message_key, requires_member_message, position)
values
  ('decision_confirmed',  'upheld',     'reason.verification_dispute_outcome.decision_confirmed',
   'verificationDispute.outcome.decision_confirmed',  false, 1),
  ('new_request_needed',  'upheld',     'reason.verification_dispute_outcome.new_request_needed',
   'verificationDispute.outcome.new_request_needed',  false, 2),
  ('other',               'upheld',     'reason.verification_dispute_outcome.other',
   'verificationDispute.outcome.other',               true,  3),
  ('decision_overturned', 'overturned', 'reason.verification_dispute_outcome.decision_overturned',
   'verificationDispute.outcome.decision_overturned', false, 4)
on conflict (code) do nothing;

-- 2. verification.disputes, the entry of queue 5 (modele §2; file.md A1; 04 l. 1656) -----------------------

create table if not exists verification.disputes (
  id                                uuid        not null primary key default gen_random_uuid(),
  account_id                        uuid        not null references identity.accounts (id),
  request_id                        uuid,
  badge_id                          uuid        references verification.badges (id),
  level                             verification.badge_level not null,
  network_code                      text        not null references reference.networks (code),
  reason_code                       text        not null references verification.dispute_reasons (code),
  text                              text,
  submitted_at                      timestamptz not null default now(),
  sla_due_at                        timestamptz not null,
  escalate_at                       timestamptz not null,
  state                             verification.dispute_state not null default 'open',
  original_decider_ids              uuid[]      not null,
  claimed_by_account_id             uuid        references identity.accounts (id),
  claimed_at                        timestamptz,
  claim_expires_at                  timestamptz,
  forced_release_at                 timestamptz,
  forced_release_by_account_id      uuid        references identity.accounts (id),
  forced_release_holder_account_id  uuid        references identity.accounts (id),
  forced_release_reason_code        text        references backoffice.claim_release_reasons (code),
  decided_by_account_id             uuid        references identity.accounts (id),
  decided_at                        timestamptz,
  outcome_reason_code               text,
  member_message                    text,
  internal_comment                  text,
  review_mode                       text,
  withdrawn_cause                   text,
  closed_at                         timestamptz,
  -- 04 l. 2238, 15 C8: decided after the deadline (a late decision is possible, marked)
  sla_breached                      boolean     not null
                                                generated always as
                                                  (decided_at is not null and decided_at > sla_due_at)
                                                stored,
  updated_at                        timestamptz not null default now(),
  texts_erased_at                   timestamptz,

  -- 04 l. 1656: exactly one decision contested, a refusal (request) or a withdrawal (badge)
  constraint disputes_target check (pg_catalog.num_nonnulls(request_id, badge_id) = 1),
  -- RG77 « une par décision »
  constraint disputes_request_unique unique (request_id),
  constraint disputes_badge_unique unique (badge_id),
  -- the refusal contested is a request of the account and of the level
  constraint disputes_request_fk
    foreign key (request_id, account_id, level)
    references verification.verification_requests (id, account_id, level),
  -- EC-L2F-8: the brand does not contest (06 l. 718: it corrects and submits again)
  constraint disputes_creator_level check (level <> 'brand_verified'),
  -- modele point 7: the text of the creator, optional but for `other`, 1 to 1 000 printable characters
  constraint disputes_text
    check (text is null
           or (char_length(text) between 1 and 1000 and text ~ '[^[:space:]]'
               and text !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]')),
  -- modele point 10: the deciders frozen at the submission, one or two named persons
  constraint disputes_deciders
    check (pg_catalog.cardinality(original_decider_ids) between 1 and 2
           and pg_catalog.array_position(original_decider_ids, null) is null),
  -- open, and only open, has no closure
  constraint disputes_closed check ((state = 'open') = (closed_at is null)),
  constraint disputes_closed_after check (closed_at >= submitted_at),
  -- 15 C6: the two outcomes carry their decider, their instant, their reason and their mode
  constraint disputes_decided
    check ((state in ('upheld', 'overturned')) = (decided_by_account_id is not null)
           and (decided_by_account_id is null) = (decided_at is null)
           and (decided_at is null) = (outcome_reason_code is null)
           and (outcome_reason_code is null) = (review_mode is null)),
  constraint disputes_decided_after check (decided_at >= submitted_at),
  -- a reason of the outcome written (MATCH SIMPLE: open and withdrawn carry none)
  constraint disputes_outcome_fk
    foreign key (state, outcome_reason_code)
    references verification.dispute_outcome_reasons (outcome, code),
  -- modele point 10: independent (another person) or delayed (a single team, after the delay)
  constraint disputes_review_mode check (review_mode in ('independent', 'delayed')),
  constraint disputes_withdrawn
    check ((state = 'withdrawn') = (withdrawn_cause is not null)),
  constraint disputes_withdrawn_cause
    check (withdrawn_cause in ('superseded', 'line_deleted', 'account_erased')),
  -- the message to the member, on an upheld contest only, 20 to 500 printable characters
  constraint disputes_member_message
    check (member_message is null
           or (state = 'upheld' and char_length(member_message) between 20 and 500
               and member_message ~ '[^[:space:]]'
               and member_message !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]')),
  -- the internal comment, never sent, 1 000 printable characters at most
  constraint disputes_internal_comment
    check (internal_comment is null
           or (char_length(internal_comment) between 1 and 1000
               and internal_comment ~ '[^[:space:]]'
               and internal_comment !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]')),
  -- 15 RG27 C1 to C3: a claim is whole, on an open entry only (EC-L2F-07-8)
  constraint disputes_claim_together
    check ((claimed_by_account_id is null) = (claimed_at is null)
           and (claimed_at is null) = (claim_expires_at is null)),
  constraint disputes_claim_open check (claimed_by_account_id is null or state = 'open'),
  constraint disputes_claim_expiry check (claim_expires_at > claimed_at),
  -- 15 C4: the last forced release is whole
  constraint disputes_forced_release_together
    check (pg_catalog.num_nulls(forced_release_at, forced_release_by_account_id,
                                forced_release_holder_account_id, forced_release_reason_code)
           in (0, 4)),
  -- 04 §5.6: the deadlines, frozen at the submission
  constraint disputes_sla_after check (sla_due_at >= submitted_at),
  constraint disputes_escalate_after check (escalate_at >= sla_due_at),
  -- the erasure (0235) empties the three texts
  constraint disputes_texts_erased
    check (texts_erased_at is null
           or (text is null and member_message is null and internal_comment is null))
);

-- queue 5 (15 C5: oldest deadline first, ties by submission)
create index if not exists disputes_queue_idx
  on verification.disputes (sla_due_at, submitted_at) where state = 'open';
create index if not exists disputes_account_idx on verification.disputes (account_id, submitted_at);

comment on table verification.disputes is
  'Queue 5 `verification_disputes` (15 RG29; 08 RG77, CA52, CA53; l2f/modele.md §2, 0232): the contest '
  'of a refusal (request_id) or of a withdrawal (badge_id) by the creator, once per decision, within '
  'dispute_window_days of its notification. Carries the deciders frozen at the submission, the lock '
  '(15 RG27), the deadlines frozen at the submission (04 §5.6), the outcome and its typed reason, the '
  'message to the member, the internal comment and review_mode. Written by '
  'verification.submit_own_dispute() (the creator) and the functions of 0232 (agent, admin); read by '
  'the creator (his own, without lock, agent, deadlines, deciders, comment nor mode) and by agent and '
  'admin in aal2, never on their own account. No right of influx_advertiser (fiche invariant 10).';
comment on column verification.disputes.original_decider_ids is
  'modele point 10: the refusal''s decided_by_account_id, or the requester and the executor of the 2V '
  'of the withdrawal (badge_revocation_requests); frozen at the submission. While another active '
  'internal person exists, none of them decides the contest.';
comment on column verification.disputes.text is
  'The creator''s text (1 to 1 000 characters, required for the reason other), checked for '
  'coordinates by apps/api (RG19); NEVER written to the register, a log nor an outbox payload '
  '(fiche invariant 12). Emptied by the erasure.';
comment on column verification.disputes.review_mode is
  'modele point 10: independent (decided by another person than the deciders) or delayed (a single '
  'team: a decider, at least dispute_reflection_hours after the submission).';
comment on column verification.disputes.withdrawn_cause is
  'The exit without decision written by the documents of the queue (15 C7): superseded (a badge of '
  'the same level granted on the line meanwhile, 0232), line_deleted (0233), account_erased (0235).';
comment on column verification.disputes.member_message is
  'The message of the agent to the member on an upheld contest whose reason requires it (other), 20 '
  'to 500 characters, checked for coordinates by apps/api. Emptied by the erasure.';
comment on column verification.disputes.internal_comment is
  'Comment of the agent, 1 000 characters at most, NEVER shown to the member, sent by e-mail, written '
  'to the register nor exported.';

drop trigger if exists disputes_touch_updated_at on verification.disputes;
create trigger disputes_touch_updated_at
  before update on verification.disputes
  for each row execute function influx.touch_updated_at();

-- 2.1 The deadlines at the submission, then frozen with the target; the state moves forward only
create or replace function verification.prepare_dispute()
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
     where p.queue_code = 'verification_disputes' and p.is_active;
    if not found then
      raise exception 'queue verification_disputes has no active delay policy'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    new.submitted_at := pg_catalog.now();
    new.sla_due_at   := backoffice.business_deadline('verification_disputes', new.submitted_at,
                                                     v_decision);
    new.escalate_at  := backoffice.business_deadline('verification_disputes', new.sla_due_at,
                                                     v_escalate);
    return new;
  end if;

  if new.state is distinct from old.state
     and not (old.state = 'open' and new.state in ('upheld', 'overturned', 'withdrawn')) then
    raise exception 'dispute: % cannot become %', old.state, new.state
      using errcode = 'object_not_in_prerequisite_state', detail = 'dispute_state';
  end if;
  -- frozen once written (04 §5.6; modele point 10: the deciders)
  new.account_id           := old.account_id;
  new.request_id           := old.request_id;
  new.badge_id             := old.badge_id;
  new.level                := old.level;
  new.network_code         := old.network_code;
  new.reason_code          := old.reason_code;
  new.original_decider_ids := old.original_decider_ids;
  new.submitted_at         := old.submitted_at;
  new.sla_due_at           := old.sla_due_at;
  new.escalate_at          := old.escalate_at;
  return new;
end
$$;

comment on function verification.prepare_dispute() is
  'BEFORE INSERT OR UPDATE on verification.disputes (0232, EC-L2F-07-7): at the insertion (the '
  'submission), submitted_at = now(), sla_due_at and escalate_at computed ONCE from the policy of queue '
  'verification_disputes in force (04 §5.6), whatever the writer gave; afterwards the account, the '
  'target, the level, the reason, the deciders and the deadlines are frozen, and the state moves '
  'forward only (open -> upheld, overturned, withdrawn; 55000 DETAIL dispute_state otherwise). '
  'SECURITY INVOKER: the writer reads the policy and executes business_deadline() with its own rights.';

revoke all on function verification.prepare_dispute() from public, anon, authenticated, service_role;

drop trigger if exists disputes_prepare on verification.disputes;
create trigger disputes_prepare
  before insert or update on verification.disputes
  for each row execute function verification.prepare_dispute();

-- 2.2 The badge a contest gave back (modele §2, point 9)
alter table verification.badges
  add column if not exists dispute_id uuid references verification.disputes (id);
create index if not exists badges_dispute_idx on verification.badges (dispute_id)
  where dispute_id is not null;

comment on column verification.badges.dispute_id is
  'The contest whose overturn granted this badge (0232; 08 CA53: a new date of decision, granted_at = '
  'the overturn); NULL for a badge of a decision of queue 4.';

-- 3. Queue 5, its delay, the reflection delay (15 RG29; 04 l. 5107; modele §4, point 10) -----------------

insert into backoffice.queues
  (code, label_key, spec_document, handled_by_roles, allows_bulk_action, has_lock)
values
  ('verification_disputes', 'queue.verification_disputes', '08 RG77', '{agent,admin}', false, true)
on conflict (code) do nothing;

insert into backoffice.sla_policies
  (queue_code, target_claim_minutes, target_decision_minutes, business_hours,
   escalate_after_minutes, is_provisional)
values
  -- 5 business days, claim within 1 business day, escalation 2 business days after the deadline;
  -- 04 l. 5107, 15 Q2: a proposal, not validated
  ('verification_disputes', 480, 2400, default, 960, true)
on conflict (queue_code) do nothing;

set constraints backoffice.queues_sla_policy_fk immediate;

alter table backoffice.operational_settings
  drop constraint if exists operational_settings_key_closed;
alter table backoffice.operational_settings
  add constraint operational_settings_key_closed check (key in (
    'claim_expiry_minutes',
    'verification_code_validity_days', 'evidence_freshness_days', 'audience_badge_validity_days',
    'badge_grace_days', 'brand_badge_validity_months', 'request_retry_hours',
    'rejection_cap_count', 'rejection_cap_window_days', 'figures_gap_alert_percent',
    'audience_drop_alert_percent', 'dispute_window_days', 'evidence_retention_days',
    'findings_retention_days', 'evidence_max_files_per_request', 'evidence_max_upload_bytes',
    'badge_reminder_days', 'dispute_reflection_hours'));

alter table backoffice.operational_settings
  drop constraint if exists operational_settings_dispute_reflection_hours;
alter table backoffice.operational_settings
  add constraint operational_settings_dispute_reflection_hours check (
    key <> 'dispute_reflection_hours'
    or case when jsonb_typeof(value) = 'number'
            then (value)::numeric = trunc((value)::numeric) and (value)::numeric between 24 and 168
            else false end);

insert into backoffice.operational_settings (key, value)
values ('dispute_reflection_hours', '24'::jsonb)
on conflict (key) do nothing;

comment on column backoffice.operational_settings.key is
  'Closed list (operational_settings_key_closed). claim_expiry_minutes: duration of a claim on a '
  'queue entry with a lock (15 RG27 C3, file.md A9), whole minutes, 1 to 1440. From 0221, the '
  'parameters of 08 RG100 (l2e/modele.md §4, values of D79): verification_code_validity_days, '
  'evidence_freshness_days, audience_badge_validity_days, badge_grace_days, '
  'brand_badge_validity_months, request_retry_hours, rejection_cap_count, '
  'rejection_cap_window_days, figures_gap_alert_percent, audience_drop_alert_percent, '
  'dispute_window_days, evidence_retention_days, findings_retention_days, '
  'evidence_max_files_per_request, evidence_max_upload_bytes; from 0230 badge_reminder_days (1 to '
  '90); from 0232 dispute_reflection_hours (24 to 168: a contest decided by a decider of a single '
  'team waits that long after its submission, 08 RG77); each a whole number in the range of its own '
  'CHECK operational_settings_<key>.';

-- 4. Row level security and the rights of the business roles (fiche invariant 10) --------------------------

do $$
declare
  t text;
begin
  foreach t in array array['dispute_reasons', 'dispute_outcome_reasons', 'disputes']
  loop
    execute format('alter table verification.%I enable row level security', t);
    execute format('alter table verification.%I force row level security', t);
    execute format('revoke all on verification.%I from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', t);
  end loop;
end
$$;

-- 4.1 The two catalogues: agent and admin, aal2
grant select on verification.dispute_reasons, verification.dispute_outcome_reasons
   to influx_agent, influx_admin;

drop policy if exists dispute_reasons_internal_select on verification.dispute_reasons;
create policy dispute_reasons_internal_select on verification.dispute_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists dispute_outcome_reasons_internal_select on verification.dispute_outcome_reasons;
create policy dispute_outcome_reasons_internal_select on verification.dispute_outcome_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 4.2 The contests: the creator his own, without lock, agent, deadlines, deciders, comment nor mode;
-- agent and admin in aal2, never their own account (15 RG36)
grant select (id, account_id, request_id, badge_id, level, network_code, reason_code, text,
              submitted_at, state, outcome_reason_code, member_message, decided_at,
              withdrawn_cause, closed_at, updated_at)
   on verification.disputes to influx_creator;
grant select on verification.disputes to influx_agent, influx_admin;

drop policy if exists disputes_creator_select_own on verification.disputes;
create policy disputes_creator_select_own on verification.disputes
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists disputes_internal_select on verification.disputes;
create policy disputes_internal_select on verification.disputes
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 5. The register and the queue (modele §4) ----------------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- the creator's act and the system's exit (payload codes and ids, never the text)
  ('verification.dispute_submitted', 'verification', 'verification_dispute', 'info'),
  ('verification.dispute_withdrawn', 'verification', 'verification_dispute', 'info'),
  -- the outcome, nominative (outcome, outcome_reason_code, review_mode, badge_id, late)
  ('verification.dispute_decided',   'verification', 'verification_dispute', 'sensitive'),
  -- the queue only (never a register line): the two e-mails of a contest (08 RG94)
  ('verification.dispute_received',  'verification', 'verification_dispute', 'info'),
  ('verification.dispute_outcome',   'verification', 'verification_dispute', 'info')
on conflict (code) do nothing;

-- 6. What the creator door reads and writes (influx_creator_verification_definer) --------------------------

-- 6.1 The decision contested: its decider (a refusal), the 2V of a withdrawal (its requester and
-- executor), the badge withdrawn
grant select (decided_by_account_id)
   on verification.verification_requests to influx_creator_verification_definer;
grant select (id, network_code, revoked_at, revocation_request_id)
   on verification.badges to influx_creator_verification_definer;
grant select (dual_control_request_id, badge_id, account_id, requested_by_account_id,
              executed_by_account_id, executed_at)
   on verification.badge_revocation_requests to influx_creator_verification_definer;

drop policy if exists badge_revocation_requests_creator_verification_definer_select
  on verification.badge_revocation_requests;
create policy badge_revocation_requests_creator_verification_definer_select
  on verification.badge_revocation_requests
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()));

-- 6.2 The contest written once, its reason read
grant select (code, requires_text, is_active)
   on verification.dispute_reasons to influx_creator_verification_definer;
drop policy if exists dispute_reasons_creator_verification_definer_select
  on verification.dispute_reasons;
create policy dispute_reasons_creator_verification_definer_select on verification.dispute_reasons
  for select to influx_creator_verification_definer
  using (true);

grant select (id, account_id, request_id, badge_id)
   on verification.disputes to influx_creator_verification_definer;
grant insert (account_id, request_id, badge_id, level, network_code, reason_code, text,
              original_decider_ids)
   on verification.disputes to influx_creator_verification_definer;

drop policy if exists disputes_creator_verification_definer_select on verification.disputes;
create policy disputes_creator_verification_definer_select on verification.disputes
  for select to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists disputes_creator_verification_definer_insert on verification.disputes;
create policy disputes_creator_verification_definer_insert on verification.disputes
  for insert to influx_creator_verification_definer
  with check (account_id = (select influx.current_account_id())
              and state = 'open' and claimed_by_account_id is null
              and decided_by_account_id is null and closed_at is null);

-- 6.3 The window (08 RG100), the delay of queue 5 (the trigger, invoker, reads it), the e-mail
drop policy if exists operational_settings_creator_verification_definer_select
  on backoffice.operational_settings;
create policy operational_settings_creator_verification_definer_select
  on backoffice.operational_settings
  for select to influx_creator_verification_definer
  using (key in ('verification_code_validity_days', 'request_retry_hours', 'rejection_cap_count',
                 'rejection_cap_window_days', 'evidence_retention_days',
                 'evidence_max_files_per_request', 'evidence_max_upload_bytes',
                 'dispute_window_days'));

drop policy if exists sla_policies_creator_verification_definer_select on backoffice.sla_policies;
create policy sla_policies_creator_verification_definer_select on backoffice.sla_policies
  for select to influx_creator_verification_definer
  using (queue_code in ('verification', 'verification_disputes'));

drop policy if exists outbox_events_creator_verification_definer_insert on leads.outbox_events;
create policy outbox_events_creator_verification_definer_insert on leads.outbox_events
  for insert to influx_creator_verification_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and destination = 'brevo_transactional'
              and event_type in ('verification.received', 'verification.code_issued',
                                 'verification.dispute_received'));

-- 7. What the agent functions read and write (influx_verification_definer) ---------------------------------

-- 7.1 « Autre personne » (modele point 10): an active internal account, outside the break-glass one
grant select (is_break_glass) on identity.agent_profiles to influx_verification_definer;

-- 7.2 The refusal contested (its message, for the dossier) and the badges given back (the finding of
-- a withdrawn badge copied, modele point 9)
grant select (member_message, decided_by_account_id)
   on verification.verification_requests to influx_verification_definer;
grant select (evidence_source, registry_source_id, observed_followers, observed_posts_last_30_days,
              observed_avg_comments, observed_engagement_bp, observed_period_start,
              observed_period_end, declared_followers_at_decision, declared_posts_at_decision,
              declared_comments_at_decision, declared_engagement_bp_at_decision,
              findings_erased_at, dispute_id)
   on verification.badges to influx_verification_definer;
grant insert (dispute_id) on verification.badges to influx_verification_definer;

-- 7.3 The contests: the claim, the decision, the exit superseded
grant select on verification.disputes to influx_verification_definer;
grant update (state, claimed_by_account_id, claimed_at, claim_expires_at, forced_release_at,
              forced_release_by_account_id, forced_release_holder_account_id,
              forced_release_reason_code, decided_by_account_id, decided_at, outcome_reason_code,
              member_message, internal_comment, review_mode, withdrawn_cause, closed_at)
   on verification.disputes to influx_verification_definer;

drop policy if exists disputes_verification_definer_select on verification.disputes;
create policy disputes_verification_definer_select on verification.disputes
  for select to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()));
drop policy if exists disputes_verification_definer_update on verification.disputes;
create policy disputes_verification_definer_update on verification.disputes
  for update to influx_verification_definer
  using (account_id is distinct from (select influx.current_account_id()))
  with check (account_id is distinct from (select influx.current_account_id()));

grant select (code, outcome, requires_member_message, is_active)
   on verification.dispute_outcome_reasons to influx_verification_definer;
drop policy if exists dispute_outcome_reasons_verification_definer_select
  on verification.dispute_outcome_reasons;
create policy dispute_outcome_reasons_verification_definer_select
  on verification.dispute_outcome_reasons
  for select to influx_verification_definer
  using (true);

-- 7.4 The parameters: the reflection delay joins those of 0224
drop policy if exists operational_settings_verification_definer_select
  on backoffice.operational_settings;
create policy operational_settings_verification_definer_select on backoffice.operational_settings
  for select to influx_verification_definer
  using (key in ('claim_expiry_minutes', 'evidence_freshness_days', 'audience_badge_validity_days',
                 'brand_badge_validity_months', 'figures_gap_alert_percent',
                 'rejection_cap_window_days', 'dispute_reflection_hours'));

-- 7.5 The queue: the outcome of a contest, besides the decision, the withdrawal and lead.updated
drop policy if exists outbox_events_verification_definer_insert on leads.outbox_events;
create policy outbox_events_verification_definer_insert on leads.outbox_events
  for insert to influx_verification_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((event_type in ('verification.decision', 'verification.revoked_notice',
                                   'verification.dispute_outcome')
                    and destination = 'brevo_transactional')
                   or (event_type = 'lead.updated' and destination = 'brevo_contact')));

-- 8. The functions ----------------------------------------------------------------------------------------

-- read_account_badges changes its columns: dropped by its owner, recreated below (§8.6)
do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_verification_definer', current_user);
end
$$;
set role influx_verification_definer;
drop function if exists verification.read_account_badges(uuid);
reset role;

-- 8.1 The creator door (08 RG77, CA52; modele points 7, 8, 10) -----------------------------------------
create or replace function verification.submit_own_dispute(
  p_request_id   uuid,
  p_badge_id     uuid,
  p_reason_code  text,
  p_text         text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  -- the account comes from the transaction context (03 P2), never a parameter
  v_account   uuid := influx.current_account_id();
  v_reason    record;
  v_target    record;
  v_window    integer;
  v_notified  timestamptz;
  v_deciders  uuid[];
  v_deadline  timestamptz;
  v_id        uuid;
  v_event     uuid := pg_catalog.gen_random_uuid();
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

  -- a reason of the closed list; the text optional but for `other` (modele point 7)
  select r.requires_text into v_reason
    from verification.dispute_reasons r
   where r.code = p_reason_code and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  if (p_text is null and v_reason.requires_text)
     or (p_text is not null
         and (pg_catalog.char_length(p_text) not between 1 and 1000
              or p_text !~ '[^[:space:]]'
              or p_text ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]')) then
    raise exception 'text' using errcode = 'invalid_parameter_value', detail = 'text';
  end if;

  -- exactly one decision of the caller's own (another's answers as an unknown one, T14)
  if pg_catalog.num_nonnulls(p_request_id, p_badge_id) <> 1 then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if p_request_id is not null then
    select r.level, r.network_code, r.status::text as status, r.decided_at,
           r.decided_by_account_id
      into v_target
      from verification.verification_requests r
     where r.id = p_request_id and r.account_id = v_account;
    if not found then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    -- modele point 8: a refusal only (closed, account_unavailable, is not contestable)
    if v_target.status <> 'rejected' then
      raise exception 'not_disputable'
        using errcode = 'object_not_in_prerequisite_state', detail = 'not_disputable';
    end if;
    v_notified := v_target.decided_at;
    v_deciders := array[v_target.decided_by_account_id];
  else
    select b.level, b.network_code, b.state::text as state, b.revoked_at,
           q.requested_by_account_id, q.executed_by_account_id
      into v_target
      from verification.badges b
      left join verification.badge_revocation_requests q
             on q.dual_control_request_id = b.revocation_request_id
            and q.badge_id = b.id
            and q.executed_at is not null
     where b.id = p_badge_id and b.account_id = v_account;
    if not found then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    -- a withdrawal under 2V of THIS badge (modele point 4: the audience carried along, and a
    -- revocation by the erasure, are not contestable)
    if v_target.state <> 'revoked' or v_target.requested_by_account_id is null then
      raise exception 'not_disputable'
        using errcode = 'object_not_in_prerequisite_state', detail = 'not_disputable';
    end if;
    v_notified := v_target.revoked_at;
    v_deciders := case when v_target.executed_by_account_id = v_target.requested_by_account_id
                       then array[v_target.requested_by_account_id]
                       else array[v_target.requested_by_account_id,
                                  v_target.executed_by_account_id] end;
  end if;

  -- RG77, CA52: within dispute_window_days of the notification
  select (s.value)::integer into v_window
    from backoffice.operational_settings s where s.key = 'dispute_window_days';
  if v_window is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  v_deadline := v_notified + pg_catalog.make_interval(days => v_window);
  if pg_catalog.now() > v_deadline then
    raise exception 'dispute_window_closed'
      using errcode = 'object_not_in_prerequisite_state',
            detail = pg_catalog.to_char(v_deadline at time zone 'UTC',
                                        'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  end if;

  -- RG77 « une par décision »: the unique keys decide a race
  begin
    insert into verification.disputes
      (account_id, request_id, badge_id, level, network_code, reason_code, text,
       original_decider_ids)
    values (v_account, p_request_id, p_badge_id, v_target.level, v_target.network_code,
            p_reason_code, p_text, v_deciders)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'already_disputed'
      using errcode = 'object_not_in_prerequisite_state', detail = 'already_disputed';
  end;

  perform audit.append('verification.dispute_submitted', 'verification_dispute', v_id,
                       pg_catalog.jsonb_build_object('level', v_target.level,
                                                     'reason_code', p_reason_code,
                                                     'request_id', p_request_id,
                                                     'badge_id', p_badge_id));
  -- 08 RG94: the acknowledgement, written by the worker from email.json (D69); ids only
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'verification.dispute_received', 'brevo_transactional',
          'account:' || v_account::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_account,
                                        'dispute_id', v_id,
                                        'email_code', 'verification.dispute_received'),
          'verification.dispute_received:' || v_id::text);
  return v_id;
end
$$;

comment on function verification.submit_own_dispute(uuid, uuid, text, text) is
  '08 RG77, CA52 (0232; modele points 7, 8, 10): an active creator contests ONE decision of his own: '
  'a refusal (p_request_id, status rejected) or a withdrawal under 2V of the badge it named '
  '(p_badge_id, revoked), within dispute_window_days of its notification (decided_at, revoked_at), '
  'once per decision; a reason of verification.dispute_reasons, the text (1 to 1 000 printable '
  'characters) required for `other` only. Writes the contest (deciders frozen: the refusal''s '
  'decider, or the requester and the executor of the 2V; deadlines of queue 5 by the trigger), '
  'verification.dispute_submitted {level, reason_code, request_id, badge_id} (never the text) and '
  'verification.dispute_received (key verification.dispute_received:<id>). Returns its id. 42501 '
  'forbidden outside an active creator, for another''s or an unknown decision, or not exactly one; '
  '55000 not_disputable, dispute_window_closed (DETAIL the closing instant), already_disputed; 22023 '
  'reason, text. SECURITY DEFINER owned by influx_creator_verification_definer; EXECUTE for '
  'influx_creator only.';

-- 8.2 The helpers of the agent functions (SECURITY INVOKER, owned by influx_verification_definer) ------

-- « Autre personne » (modele point 10): an active internal account (agent or admin, active profile,
-- not the break-glass one) outside the deciders
create or replace function verification.dispute_other_reviewer_exists(p_deciders uuid[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
      from identity.accounts a
      join identity.agent_profiles p on p.account_id = a.id and p.is_active and not p.is_break_glass
     where a.status = 'active'
       and a.id <> all (p_deciders)
       and exists (select 1 from identity.account_roles r
                    where r.account_id = a.id and r.role in ('agent', 'admin')))
$$;

comment on function verification.dispute_other_reviewer_exists(uuid[]) is
  'modele point 10 (0232; 08 RG77): true while an active internal account (agent or admin role, active '
  'profile, outside the break-glass account) other than the deciders exists: the contest is then '
  'decided by another person. SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for '
  'anyone.';

-- the gate of every act on a held entry of queue 5 (15 RG27 C2, RG36; 08 RG53)
create or replace function verification.lock_held_dispute(p_dispute_id uuid, p_caller uuid)
returns table (
  account_id            uuid,
  request_id            uuid,
  badge_id              uuid,
  level                 verification.badge_level,
  network_code          text,
  social_account_id     uuid,
  original_decider_ids  uuid[],
  submitted_at          timestamptz,
  claimed_at            timestamptz
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry  record;
  v_line   uuid;
begin
  select d.account_id, d.request_id, d.badge_id, d.level, d.network_code, d.state::text as state,
         d.original_decider_ids, d.submitted_at, d.claimed_by_account_id, d.claimed_at,
         d.claim_expires_at
    into v_entry
    from verification.disputes d
   where d.id = p_dispute_id
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
  select coalesce((select r.social_account_id from verification.verification_requests r
                    where r.id = v_entry.request_id),
                  (select b.social_account_id from verification.badges b
                    where b.id = v_entry.badge_id))
    into v_line;
  return query select v_entry.account_id, v_entry.request_id, v_entry.badge_id, v_entry.level,
                      v_entry.network_code, v_line, v_entry.original_decider_ids,
                      v_entry.submitted_at, v_entry.claimed_at;
end
$$;

comment on function verification.lock_held_dispute(uuid, uuid) is
  'The gate of the acts on a held entry of queue 5 (0232): locks the contest FOR UPDATE; 42501 for an '
  'unknown contest, one of the caller''s own account or of an account he holds (08 RG53); 55000 '
  'entry_closed once it left open; 55P03 no_live_claim (DETAIL the live holder or none) without the '
  'caller''s live claim. Returns its account, request, badge, level, network, line, deciders, '
  'submission and claim instant. SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for '
  'anyone.';

-- the version token (never stored, rendered at the opening and the dossier, recomputed at the decision)
create or replace function verification.dispute_review_token(p_dispute_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
           'dispute', pg_catalog.jsonb_build_array(d.id, d.state, d.reason_code, d.text),
           'request', case when d.request_id is null then null
                           else verification.request_review_token(d.request_id) end,
           'badge', (select pg_catalog.jsonb_build_array(b.id, b.state, b.revoked_at,
                                                        b.revocation_reason_code, b.expires_at)
                       from verification.badges b where b.id = d.badge_id),
           'line', (select pg_catalog.jsonb_build_array(l.handle, l.pseudonym, l.profile_url,
                                                       l.followers_count, l.posts_last_30_days,
                                                       l.avg_comments_per_post, l.engagement_rate_bp)
                      from profiles.creator_social_accounts l
                     where l.account_id = d.account_id
                       and l.id = coalesce((select r.social_account_id
                                              from verification.verification_requests r
                                             where r.id = d.request_id),
                                           (select b.social_account_id from verification.badges b
                                             where b.id = d.badge_id)))
         )::text, 'UTF8')), 'hex')
    from verification.disputes d
   where d.id = p_dispute_id
$$;

comment on function verification.dispute_review_token(uuid) is
  'modele §3 (0232; file.md A3): SHA-256 hex of the version examined: the contest (state, reason, '
  'text), the token of the refused request (verification.request_review_token(): line, active '
  'evidence, live code) or the withdrawn badge (state, withdrawal, expiry), and the line contested '
  '(handle, pseudonym, URL, declared figures). Never stored; different at the decision: 55000 '
  'stale_token. STABLE. SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for anyone.';

-- the gate of a decision: the live claim, the person (modele point 10), the token
create or replace function verification.gate_dispute_decision(
  p_dispute_id    uuid,
  p_caller        uuid,
  p_review_token  text)
returns table (
  account_id         uuid,
  request_id         uuid,
  badge_id           uuid,
  level              verification.badge_level,
  network_code       text,
  social_account_id  uuid,
  review_mode        text
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_entry  record;
  v_hours  integer;
  v_until  timestamptz;
  v_mode   text := 'independent';
begin
  select * into v_entry from verification.lock_held_dispute(p_dispute_id, p_caller);
  -- RG77: another person than the decider as soon as the team counts one; otherwise the delay
  if p_caller = any (v_entry.original_decider_ids) then
    if verification.dispute_other_reviewer_exists(v_entry.original_decider_ids) then
      raise exception 'reviewer_is_decider'
        using errcode = 'object_not_in_prerequisite_state', detail = 'reviewer_is_decider';
    end if;
    select (s.value)::integer into v_hours
      from backoffice.operational_settings s where s.key = 'dispute_reflection_hours';
    if v_hours is null then
      raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
    end if;
    v_until := v_entry.submitted_at + pg_catalog.make_interval(hours => v_hours);
    if v_until > pg_catalog.now() then
      raise exception 'reflection_delay'
        using errcode = 'object_not_in_prerequisite_state',
              detail = pg_catalog.ceil(extract(epoch from v_until - pg_catalog.now()))::bigint::text;
    end if;
    v_mode := 'delayed';
  end if;
  if p_review_token is null
     or p_review_token is distinct from verification.dispute_review_token(p_dispute_id) then
    raise exception 'stale_token'
      using errcode = 'object_not_in_prerequisite_state', detail = 'stale_token';
  end if;
  return query select v_entry.account_id, v_entry.request_id, v_entry.badge_id, v_entry.level,
                      v_entry.network_code, v_entry.social_account_id, v_mode;
end
$$;

comment on function verification.gate_dispute_decision(uuid, uuid, text) is
  '08 RG77, CA52 (0232; modele point 10): before any decision of queue 5, the refusals of '
  'verification.lock_held_dispute(); then, for a decider of the contested decision, 55000 '
  'reviewer_is_decider while another person exists (verification.dispute_other_reviewer_exists()), '
  'else 55000 reflection_delay (DETAIL the seconds left) before submitted_at + '
  'dispute_reflection_hours; then 55000 stale_token. Returns the target and review_mode (independent, '
  'or delayed for a decider of a single team). SECURITY INVOKER owned by influx_verification_definer, '
  'no EXECUTE for anyone.';

-- the closure of a decision: the contest, the register, the e-mail, the badge attribute
create or replace function verification.close_dispute(
  p_dispute_id           uuid,
  p_account_id           uuid,
  p_caller               uuid,
  p_outcome              verification.dispute_state,
  p_outcome_reason_code  text,
  p_member_message       text,
  p_internal_comment     text,
  p_review_mode          text,
  p_badge_id             uuid)
returns table (
  decided_at    timestamptz,
  sla_breached  boolean
)
language plpgsql
volatile
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_decided  timestamptz;
  v_late     boolean;
  v_event    uuid := pg_catalog.gen_random_uuid();
  v_lead     uuid := pg_catalog.gen_random_uuid();
begin
  update verification.disputes d
     set state                 = p_outcome,
         decided_by_account_id = p_caller,
         decided_at            = pg_catalog.now(),
         outcome_reason_code   = p_outcome_reason_code,
         member_message        = p_member_message,
         internal_comment      = p_internal_comment,
         review_mode           = p_review_mode,
         closed_at             = pg_catalog.now(),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null
   where d.id = p_dispute_id
  returning d.decided_at, d.sla_breached into v_decided, v_late;

  -- invariant 12: codes and identifiers, never the text, the message nor the comment
  perform audit.append('verification.dispute_decided', 'verification_dispute', p_dispute_id,
                       pg_catalog.jsonb_build_object('outcome', p_outcome,
                                                     'outcome_reason_code', p_outcome_reason_code,
                                                     'review_mode', p_review_mode,
                                                     'badge_id', p_badge_id,
                                                     'late', v_late));
  -- RG77: the outcome notified with its reason, written by the worker from email.json (D69)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values (v_event, 'verification.dispute_outcome', 'brevo_transactional',
          'account:' || p_account_id::text, 100,
          pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id,
                                        'dispute_id', p_dispute_id,
                                        'email_code', 'verification.dispute_outcome'),
          'verification.dispute_outcome:' || p_dispute_id::text);
  -- modele §4: VERIFIED_LEVEL follows every change of badge, Brevo only
  if p_badge_id is not null then
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (v_lead, 'lead.updated', 'brevo_contact', 'account:' || p_account_id::text, 100,
            pg_catalog.jsonb_build_object('event_id', v_lead, 'account_id', p_account_id),
            'lead.updated:' || v_lead::text);
  end if;
  return query select v_decided, v_late;
end
$$;

comment on function verification.close_dispute(uuid, uuid, uuid, verification.dispute_state, text, text, text, text, uuid) is
  '0232 (08 RG77, CA53; modele §4): closes a held contest with its outcome (decider, instant, reason, '
  'message, comment, review_mode; the claim cleared), writes verification.dispute_decided {outcome, '
  'outcome_reason_code, review_mode, badge_id, late}, queues verification.dispute_outcome (key '
  'verification.dispute_outcome:<id>) and, when a badge was given back, lead.updated. Returns '
  '(decided_at, sla_breached). SECURITY INVOKER owned by influx_verification_definer, no EXECUTE for '
  'anyone.';

-- 8.3 The claim (15 RG27 C1 to C4; file.md A8, A9; modele point 10) -------------------------------------

create or replace function verification.open_dispute(p_dispute_id uuid)
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
  select d.account_id, d.state::text as state, d.claimed_by_account_id, d.claimed_at,
         d.claim_expires_at, d.original_decider_ids
    into v_entry
    from verification.disputes d
   where d.id = p_dispute_id
     for update;
  if not found or v_entry.account_id = v_caller then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- 08 RG53: an open contest of an account the caller holds is not his to examine
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
  elsif v_caller = any (v_entry.original_decider_ids)
        and verification.dispute_other_reviewer_exists(v_entry.original_decider_ids) then
    -- modele point 10: the decider reads, never claims, while another person exists
    v_outcome := 'read_only';
    if v_entry.claim_expires_at > pg_catalog.now() then
      v_holder  := v_entry.claimed_by_account_id;
      v_claimed := v_entry.claimed_at;
      v_expires := v_entry.claim_expires_at;
    end if;
  else
    select (s.value)::integer into v_minutes
      from backoffice.operational_settings s where s.key = 'claim_expiry_minutes';
    if v_minutes is null then
      raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
    end if;
    update verification.disputes d
       set claimed_by_account_id = v_caller,
           claimed_at            = pg_catalog.now(),
           claim_expires_at      = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
     where d.id = p_dispute_id
       and d.state = 'open'
       and (d.claimed_by_account_id is null or d.claim_expires_at <= pg_catalog.now())
    returning d.claimed_by_account_id, d.claimed_at, d.claim_expires_at
      into v_holder, v_claimed, v_expires;
    if found then
      v_outcome := 'claimed';
      if v_entry.claimed_by_account_id is not null then
        perform audit.append('queue.claim_expired', 'queue_entry', p_dispute_id,
                             pg_catalog.jsonb_build_object(
                               'queue_code', 'verification_disputes',
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
    v_token := verification.dispute_review_token(p_dispute_id);
  end if;
  perform audit.append('queue.entry_opened', 'queue_entry', p_dispute_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification_disputes',
                                                     'outcome', v_outcome));
  return query select v_outcome, v_holder, v_claimed, v_expires, v_token;
end
$$;

comment on function verification.open_dispute(uuid) is
  '15 RG27 C1 to C3, RG35; 08 RG53, RG77; file.md A9 (0232; modele point 10): an agent or an admin '
  'opens an entry of queue 5. Free, or its claim expired: claimed by an atomic conditional UPDATE '
  '(claim_expiry_minutes; an expired claim taken over writes queue.claim_expired first). A decider '
  'of the contested decision reads only (read_only, never a claim) while another person exists. '
  'Returns (outcome, holder, claimed_at, claim_expires_at, review_token): claimed or held with the '
  'token, read_only with the live holder, closed with nothing; queue.entry_opened {queue_code: '
  'verification_disputes, outcome}. 42501 for an unknown contest, the caller''s own account, an open '
  'contest of an account he holds, outside an active agent or admin in aal2. SECURITY DEFINER owned '
  'by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

create or replace function verification.release_dispute(p_dispute_id uuid)
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
  select * into v_entry from verification.lock_held_dispute(p_dispute_id, v_caller);
  update verification.disputes d
     set claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
   where d.id = p_dispute_id;
  perform audit.append('queue.claim_released', 'queue_entry', p_dispute_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification_disputes',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at));
end
$$;

comment on function verification.release_dispute(uuid) is
  '15 RG27 C3, file.md A9 (0232): the holder of a live claim gives the entry back to queue 5; line '
  'queue.claim_released {queue_code, holder_account_id, claimed_at}, no comment. The refusals of '
  'verification.lock_held_dispute(). SECURITY DEFINER owned by influx_verification_definer; EXECUTE for '
  'influx_agent and influx_admin.';

create or replace function verification.extend_dispute_claim(p_dispute_id uuid)
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
  select * into v_entry from verification.lock_held_dispute(p_dispute_id, v_caller);
  select (s.value)::integer into v_minutes
    from backoffice.operational_settings s where s.key = 'claim_expiry_minutes';
  if v_minutes is null then
    raise exception 'claim_expiry_minutes is not set' using errcode = 'object_not_in_prerequisite_state';
  end if;
  update verification.disputes d
     set claim_expires_at = pg_catalog.now() + pg_catalog.make_interval(mins => v_minutes)
   where d.id = p_dispute_id
  returning d.claim_expires_at into v_expires;
  perform audit.append('queue.claim_extended', 'queue_entry', p_dispute_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification_disputes',
                                                     'holder_account_id', v_caller,
                                                     'claimed_at', v_entry.claimed_at,
                                                     'claim_expires_at', v_expires));
  return v_expires;
end
$$;

comment on function verification.extend_dispute_claim(uuid) is
  'file.md A9 (0232): the holder of a live claim extends it to now() + claim_expiry_minutes; line '
  'queue.claim_extended {queue_code, holder_account_id, claimed_at, claim_expires_at}; returns the new '
  'expiry. The refusals of verification.lock_held_dispute(). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

create or replace function verification.force_release_dispute_claim(
  p_dispute_id   uuid,
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
  select d.account_id, d.state::text as state, d.claimed_by_account_id, d.claim_expires_at
    into v_entry
    from verification.disputes d
   where d.id = p_dispute_id
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
  update verification.disputes d
     set claimed_by_account_id            = null,
         claimed_at                       = null,
         claim_expires_at                 = null,
         forced_release_at                = pg_catalog.now(),
         forced_release_by_account_id     = v_caller,
         forced_release_holder_account_id = v_entry.claimed_by_account_id,
         forced_release_reason_code       = p_reason_code
   where d.id = p_dispute_id;
  perform audit.append('queue.claim_forced_release', 'queue_entry', p_dispute_id,
                       pg_catalog.jsonb_build_object('queue_code', 'verification_disputes',
                                                     'holder_account_id', v_entry.claimed_by_account_id,
                                                     'reason_code', p_reason_code));
  return v_entry.claimed_by_account_id;
end
$$;

comment on function verification.force_release_dispute_claim(uuid, text) is
  '15 RG27 C4, file.md A8 (0232): an administrator lifts a live claim of queue 5 before its expiry, '
  'with a typed reason of backoffice.claim_release_reasons; the contest keeps the last forced '
  'release; line queue.claim_forced_release {queue_code, holder_account_id, reason_code}; returns the '
  'holder. 22023 reason, 55P03 none, 55000 entry_closed, 42501 outside an active admin in aal2 (an '
  'agent''s attempt is journalled by apps/api). SECURITY DEFINER owned by influx_verification_definer; '
  'EXECUTE for influx_agent and influx_admin (the function refuses the agent).';

-- 8.4 The examination (08 RG77; modele point 9; EC-L2F-07-9) ---------------------------------------------

create or replace function verification.read_dispute_dossier(p_dispute_id uuid)
returns table (
  dispute_id                 uuid,
  account_id                 uuid,
  kind                       text,
  level                      text,
  network_code               text,
  reason_code                text,
  dispute_text               text,
  submitted_at               timestamptz,
  sla_due_at                 timestamptz,
  escalate_at                timestamptz,
  original_decider_ids       uuid[],
  review_mode                text,
  reflection_until           timestamptz,
  social_account_id          uuid,
  handle                     text,
  pseudonym                  text,
  profile_url                text,
  request_id                 uuid,
  rejection_reason_code      text,
  refusal_member_message     text,
  refusal_decided_at         timestamptz,
  code_expires_at            timestamptz,
  evidence                   jsonb,
  badge_id                   uuid,
  badge_granted_at           timestamptz,
  badge_expires_at           timestamptz,
  revoked_at                 timestamptz,
  revocation_reason_code     text,
  revocation_member_message  text,
  cascade_badge_ids          uuid[],
  review_token               text
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
  v_hours   integer;
begin
  select * into v_entry from verification.lock_held_dispute(p_dispute_id, v_caller);
  select (s.value)::integer into v_hours
    from backoffice.operational_settings s where s.key = 'dispute_reflection_hours';

  -- one query, one snapshot: the token is the token of the view shown
  return query
    select d.id, d.account_id,
           case when d.request_id is not null then 'refusal' else 'revocation' end,
           d.level::text, d.network_code, d.reason_code, d.text, d.submitted_at, d.sla_due_at,
           d.escalate_at, d.original_decider_ids,
           case when v_caller = any (d.original_decider_ids) then 'delayed' else 'independent' end,
           case when v_caller = any (d.original_decider_ids)
                then d.submitted_at + pg_catalog.make_interval(hours => coalesce(v_hours, 24)) end,
           v_entry.social_account_id, l.handle, l.pseudonym, l.profile_url,
           d.request_id, r.rejection_reason_code, r.member_message, r.decided_at,
           (select c.expires_at from verification.ownership_codes c
             where c.request_id = d.request_id and c.revoked_at is null),
           -- EC-L2F-07-9: every evidence row of the refused request, its state, never the key
           coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'id', e.id, 'state', e.state, 'byte_size', e.byte_size,
                              'width', e.width, 'height', e.height,
                              'activated_at', e.activated_at)
                              order by e.activated_at, e.id)
                       from verification.evidence_files e
                      where e.request_id = d.request_id and e.state <> 'pending'), '[]'::jsonb),
           d.badge_id, b.granted_at, b.expires_at, b.revoked_at, b.revocation_reason_code,
           q.member_message,
           coalesce((select pg_catalog.array_agg(c.id order by c.id)
                       from verification.badges c
                      where b.level = 'account_verified'
                        and c.account_id = b.account_id
                        and c.social_account_id = b.social_account_id
                        and c.level = 'audience_verified'
                        and c.revocation_request_id = b.revocation_request_id
                        and c.id <> b.id), '{}'::uuid[]),
           verification.dispute_review_token(d.id)
      from verification.disputes d
      left join verification.verification_requests r on r.id = d.request_id
      left join verification.badges b on b.id = d.badge_id
      left join verification.badge_revocation_requests q
             on q.dual_control_request_id = b.revocation_request_id
      left join profiles.creator_social_accounts l
             on l.id = v_entry.social_account_id and l.account_id = d.account_id
     where d.id = p_dispute_id;
end
$$;

comment on function verification.read_dispute_dossier(uuid) is
  '08 RG77 (0232; modele point 9): the holder of a live claim reads the dossier of a contest, one row: '
  'the contest (kind refusal or revocation, reason, text, deadlines, deciders, the mode his decision '
  'would take and the end of the reflection delay for a decider), the line (handle, pseudonym, URL; '
  'NEVER a declared figure), for a refusal its reason, message, instant, the expiry of the live code '
  'and every evidence row with its state (never a key, EC-L2F-07-9), for a withdrawal the badge, its '
  'reason, its message and the audience carried along; the review token of this snapshot. The '
  'refusals of verification.lock_held_dispute(). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- the journalled read of an evidence of the refused request (D82 (5), C(14), RG46)
create or replace function verification.read_dispute_evidence(p_dispute_id uuid, p_evidence_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid := verification.require_agent(false);
  v_entry   record;
  v_key     text;
begin
  select * into v_entry from verification.lock_held_dispute(p_dispute_id, v_caller);
  select e.object_key into v_key
    from verification.evidence_files e
   where e.id = p_evidence_id and v_entry.request_id is not null
     and e.request_id = v_entry.request_id and e.state = 'active';
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  perform audit.append('verification.evidence_viewed', 'verification_request', v_entry.request_id,
                       pg_catalog.jsonb_build_object('evidence_id', p_evidence_id,
                                                     'level', v_entry.level,
                                                     'dispute_id', p_dispute_id));
  return v_key;
end
$$;

comment on function verification.read_dispute_evidence(uuid, uuid) is
  'D82 (5), 08 RG46, C(14) (0232; modele §3, §4): the holder of a live claim on a contest of a refusal '
  'receives the object_key of an ACTIVE evidence of the refused request, for apps/api to relay the '
  'bytes; writes verification.evidence_viewed {evidence_id, level, dispute_id} on the request in the '
  'same transaction. 42501 for an evidence not active or of another request, then the refusals of '
  'verification.lock_held_dispute(). SECURITY DEFINER owned by influx_verification_definer; EXECUTE for '
  'influx_agent and influx_admin.';

-- 8.5 The decisions (08 RG77, CA53; 15 C6; modele point 9) ----------------------------------------------

create or replace function verification.uphold_dispute(
  p_dispute_id           uuid,
  p_review_token         text,
  p_outcome_reason_code  text,
  p_member_message       text,
  p_internal_comment     text)
returns table (
  outcome       text,
  decided_at    timestamptz,
  sla_breached  boolean,
  review_mode   text
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
  v_reason  record;
  v_closed  record;
begin
  perform verification.check_internal_comment(p_internal_comment);
  select r.requires_member_message into v_reason
    from verification.dispute_outcome_reasons r
   where r.code = p_outcome_reason_code and r.outcome = 'upheld' and r.is_active;
  if not found then
    raise exception 'reason' using errcode = 'invalid_parameter_value', detail = 'reason';
  end if;
  if v_reason.requires_member_message then
    if p_member_message is null
       or pg_catalog.char_length(p_member_message) not between 20 and 500
       or p_member_message !~ '[^[:space:]]'
       or p_member_message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]' then
      raise exception 'member_message' using errcode = 'invalid_parameter_value', detail = 'member_message';
    end if;
  elsif p_member_message is not null then
    raise exception 'member_message' using errcode = 'invalid_parameter_value', detail = 'member_message';
  end if;

  select * into v_entry from verification.gate_dispute_decision(p_dispute_id, v_caller, p_review_token);
  select * into v_closed
    from verification.close_dispute(p_dispute_id, v_entry.account_id, v_caller, 'upheld',
                                    p_outcome_reason_code, p_member_message, p_internal_comment,
                                    v_entry.review_mode, null);
  return query select 'upheld'::text, v_closed.decided_at, v_closed.sla_breached, v_entry.review_mode;
end
$$;

comment on function verification.uphold_dispute(uuid, text, text, text, text) is
  '08 RG77, 15 C6 (0232): the holder of a live claim upholds a contest with a reason of outcome upheld '
  '(decision_confirmed, new_request_needed, other), the message to the member (20 to 500 printable '
  'characters) exactly when the reason requires it (other), an internal comment of 1 000 characters at '
  'most; the decision contested is unchanged. verification.close_dispute(): dispute_decided, '
  'dispute_outcome queued. Returns (upheld, decided_at, sla_breached, review_mode). 22023 reason, '
  'member_message, internal_comment; then the refusals of verification.gate_dispute_decision(). '
  'SECURITY DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- a refused « Compte vérifié », overturned on the original dossier (modele point 9; 0228)
create or replace function verification.overturn_refusal_account(
  p_dispute_id                     uuid,
  p_review_token                   text,
  p_observed_code                  text,
  p_observed_handle                text,
  p_observed_platform_account_ref  text,
  p_internal_comment               text)
returns table (
  outcome       text,
  badge_id      uuid,
  decided_at    timestamptz,
  sla_breached  boolean,
  review_mode   text
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
  v_ref       text := nullif(pg_catalog.btrim(p_observed_platform_account_ref), '');
  v_entry     record;
  v_code      record;
  v_declared  text;
  v_badge     uuid;
  v_closed    record;
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

  select * into v_entry from verification.gate_dispute_decision(p_dispute_id, v_caller, p_review_token);
  -- EC-L2F-07-3: a contested refusal of « Compte vérifié » only
  if v_entry.request_id is null or v_entry.level <> 'account_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  select l.handle into v_declared
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if not found then
    raise exception 'line_deleted'
      using errcode = 'object_not_in_prerequisite_state', detail = 'line_deleted';
  end if;
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;

  -- modele point 9: the finding on the original dossier, the live code of the refused request
  select c.id, c.code, c.observed_at into v_code
    from verification.ownership_codes c
   where c.request_id = v_entry.request_id and c.kind = 'network' and c.revoked_at is null;
  if not found or pg_catalog.upper(pg_catalog.btrim(p_observed_code)) is distinct from v_code.code then
    raise exception 'code_mismatch' using errcode = 'invalid_parameter_value', detail = 'code_mismatch';
  end if;
  -- fiche invariant 7, 0228: the handle typed again is the handle declared on the line
  if verification.normalize_handle(v_declared) is null
     or verification.normalize_handle(v_declared) <> verification.normalize_handle(v_handle) then
    raise exception 'observed_handle_mismatch'
      using errcode = 'invalid_parameter_value', detail = 'observed_handle_mismatch';
  end if;
  -- EC-L2F-07-2, edge case l. 800: never a second holding account badge on that handle
  if exists (select 1 from verification.badges b
              where b.account_id <> v_entry.account_id
                and b.network_code = v_entry.network_code
                and b.level = 'account_verified'
                and b.state in ('active', 'to_refresh', 'to_reconfirm')
                and (verification.normalize_handle(b.observed_handle_at_decision)
                       = verification.normalize_handle(v_handle)
                     or (v_ref is not null and b.observed_platform_account_ref = v_ref))) then
    raise exception 'handle_already_verified'
      using errcode = 'object_not_in_prerequisite_state', detail = 'handle_already_verified';
  end if;

  if v_code.observed_at is null then
    update verification.ownership_codes c
       set observed_by_account_id        = v_caller,
           observed_at                   = pg_catalog.now(),
           observed_handle               = v_handle,
           observed_platform_account_ref = v_ref
     where c.id = v_code.id;
  end if;

  -- EC-L2E-14: a holding badge of the line (to_reconfirm) is replaced, never doubled
  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
     and b.level = 'account_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  -- CA53: a new date of decision, the badge tied to the contest
  insert into verification.badges
    (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
     granted_at, evidence_source, observed_handle_at_decision, observed_platform_account_ref,
     dispute_id)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, v_entry.request_id,
          'account_verified', v_caller, pg_catalog.now(), 'public_profile', v_handle, v_ref,
          p_dispute_id)
  returning id into v_badge;

  select * into v_closed
    from verification.close_dispute(p_dispute_id, v_entry.account_id, v_caller, 'overturned',
                                    'decision_overturned', null, p_internal_comment,
                                    v_entry.review_mode, v_badge);
  return query select 'overturned'::text, v_badge, v_closed.decided_at, v_closed.sla_breached,
                      v_entry.review_mode;
end
$$;

comment on function verification.overturn_refusal_account(uuid, text, text, text, text, text) is
  '08 RG77, CA53 (0232; modele point 9; fiche invariant 7): the holder of a live claim overturns a '
  'contested refusal of « Compte vérifié » on its original dossier: the code he reads on line compared '
  'with the live code of the refused request, the handle he types compared with the handle declared '
  'on the line (verification.normalize_handle(), 0228); never a second holding account badge on that '
  'handle (55000 handle_already_verified, EC-L2F-07-2). A badge active without expiry granted NOW '
  '(dispute_id; a holding one replaced), the request unchanged; verification.close_dispute() '
  '(decision_overturned, lead.updated). Returns (overturned, badge_id, decided_at, sla_breached, '
  'review_mode). 22023 observed_handle, observed_platform_account_ref, internal_comment, level, '
  'code_mismatch, observed_handle_mismatch; 55000 line_deleted, account_unavailable, '
  'handle_already_verified; then the refusals of verification.gate_dispute_decision(). SECURITY '
  'DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- a refused « Audience vérifiée », overturned on the original dossier (modele point 9; EC-L2F-07-1, -4)
create or replace function verification.overturn_refusal_audience(
  p_dispute_id          uuid,
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
  sla_breached  boolean,
  review_mode   text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller     uuid := verification.require_agent(false);
  v_handle     text := pg_catalog.btrim(p_observed_handle);
  v_entry      record;
  v_line       record;
  v_refused    timestamptz;
  v_refusal    date;
  v_fresh      integer;
  v_validity   integer;
  v_expires    timestamptz;
  v_badge      uuid;
  v_closed     record;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if v_handle is null or pg_catalog.char_length(v_handle) not between 1 and 100
     or v_handle ~ '[[:cntrl:]]' then
    raise exception 'observed_handle' using errcode = 'invalid_parameter_value', detail = 'observed_handle';
  end if;
  perform verification.check_observed_figures(p_followers, p_posts_last_30_days, p_avg_comments,
                                              p_engagement_bp);

  select * into v_entry from verification.gate_dispute_decision(p_dispute_id, v_caller, p_review_token);
  if v_entry.request_id is null or v_entry.level <> 'audience_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  select r.decided_at into v_refused
    from verification.verification_requests r where r.id = v_entry.request_id;
  v_refusal := (v_refused at time zone 'UTC')::date;

  -- EC-L2F-07-4: the period judged at the date of the refusal (RG36, RG37, CA18, CA27)
  select (s.value)::integer into v_fresh
    from backoffice.operational_settings s where s.key = 'evidence_freshness_days';
  select (s.value)::integer into v_validity
    from backoffice.operational_settings s where s.key = 'audience_badge_validity_days';
  if v_fresh is null or v_validity is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  if p_period_start is null or p_period_end is null then
    raise exception 'period_invalid' using errcode = 'invalid_parameter_value', detail = 'period_missing';
  end if;
  if p_period_start > p_period_end then
    raise exception 'period_invalid' using errcode = 'invalid_parameter_value', detail = 'period_order';
  end if;
  if p_period_end > v_refusal then
    raise exception 'period_invalid' using errcode = 'invalid_parameter_value', detail = 'period_future';
  end if;
  if v_refusal - p_period_end >= v_fresh then
    raise exception 'period_invalid' using errcode = 'invalid_parameter_value', detail = 'period_too_old';
  end if;

  select l.handle, l.followers_count, l.posts_last_30_days, l.avg_comments_per_post,
         l.engagement_rate_bp
    into v_line
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if not found then
    raise exception 'line_deleted'
      using errcode = 'object_not_in_prerequisite_state', detail = 'line_deleted';
  end if;
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;
  if verification.normalize_handle(v_line.handle) is null
     or verification.normalize_handle(v_line.handle) <> verification.normalize_handle(v_handle) then
    raise exception 'observed_handle_mismatch'
      using errcode = 'invalid_parameter_value', detail = 'observed_handle_mismatch';
  end if;
  -- RG12: never the audience of an account whose ownership is not established
  if not exists (select 1 from verification.badges b
                  where b.account_id = v_entry.account_id
                    and b.social_account_id = v_entry.social_account_id
                    and b.level = 'account_verified' and b.state = 'active') then
    raise exception 'ownership_prerequisite'
      using errcode = 'object_not_in_prerequisite_state', detail = 'ownership_prerequisite';
  end if;
  -- EC-L2F-07-1: the original evidence must still be active (purged: upheld, new_request_needed)
  if not exists (select 1 from verification.evidence_files e
                  where e.request_id = v_entry.request_id and e.state = 'active') then
    raise exception 'missing_evidence'
      using errcode = 'object_not_in_prerequisite_state', detail = 'missing_evidence';
  end if;
  if v_line.posts_last_30_days is null or v_line.avg_comments_per_post is null then
    raise exception 'declared_figures_required'
      using errcode = 'check_violation', detail = 'declared_figures_required';
  end if;
  v_expires := v_refused + pg_catalog.make_interval(days => v_validity);
  if v_expires <= pg_catalog.now() then
    raise exception 'restore_expired'
      using errcode = 'object_not_in_prerequisite_state', detail = 'restore_expired';
  end if;

  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
     and b.level = 'audience_verified' and b.state in ('active', 'to_refresh', 'to_reconfirm');

  -- CA53: granted now, valid from the refusal (modele point 9)
  insert into verification.badges
    (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
     granted_at, evidence_source, observed_followers, observed_posts_last_30_days,
     observed_avg_comments, observed_engagement_bp, observed_period_start, observed_period_end,
     declared_followers_at_decision, declared_posts_at_decision, declared_comments_at_decision,
     declared_engagement_bp_at_decision, observed_handle_at_decision, expires_at, dispute_id)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, v_entry.request_id,
          'audience_verified', v_caller, pg_catalog.now(), 'native_dashboard', p_followers,
          p_posts_last_30_days, p_avg_comments, p_engagement_bp, p_period_start, p_period_end,
          v_line.followers_count, v_line.posts_last_30_days, v_line.avg_comments_per_post,
          v_line.engagement_rate_bp, v_handle, v_expires, p_dispute_id)
  returning id into v_badge;

  -- 07 RG119 (0225): the observed metrics in the history, by the agent
  insert into profiles.creator_network_metrics_history
    (account_id, social_account_id, network_code, followers_count, posts_last_30_days,
     avg_comments_per_post, figures_source, confirmed, recorded_by_account_id)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, p_followers,
          p_posts_last_30_days, p_avg_comments, 'agent_observed', true, v_caller);
  perform profiles.refresh_creator_public_network(v_entry.social_account_id);

  select * into v_closed
    from verification.close_dispute(p_dispute_id, v_entry.account_id, v_caller, 'overturned',
                                    'decision_overturned', null, p_internal_comment,
                                    v_entry.review_mode, v_badge);
  return query select 'overturned'::text, v_badge, v_closed.decided_at, v_closed.sla_breached,
                      v_entry.review_mode;
end
$$;

comment on function verification.overturn_refusal_audience(uuid, text, bigint, integer, bigint, integer, date, date, text, text) is
  '08 RG77, CA53 (0232; modele point 9; EC-L2F-07-1, -4): the holder of a live claim overturns a '
  'contested refusal of « Audience vérifiée » on its original dossier: the figures he TYPES, a period '
  'judged at the date of the refusal, the handle typed again compared with the declared one (0228); '
  'an active « Compte vérifié » on the line and an ACTIVE evidence of the refused request required (a '
  'purged one: 55000 missing_evidence, the reviewer upholds with new_request_needed). A badge granted '
  'NOW, valid until the refusal''s decided_at + audience_badge_validity_days (past: restore_expired), '
  'carrying the declared figures of the line (a holding one replaced); the metrics historised; the '
  'public bands derived again; verification.close_dispute(). Returns (overturned, badge_id, '
  'decided_at, sla_breached, review_mode). 22023 figures_invalid, period_invalid, observed_handle, '
  'observed_handle_mismatch, internal_comment, level; 55000 line_deleted, account_unavailable, '
  'ownership_prerequisite, missing_evidence, restore_expired; 23514 declared_figures_required; then '
  'the refusals of verification.gate_dispute_decision(). SECURITY DEFINER owned by '
  'influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- a withdrawal overturned: a new badge, the finding copied, the original expiry (modele points 4, 9)
create or replace function verification.overturn_revocation(
  p_dispute_id        uuid,
  p_review_token      text,
  p_observed_handle   text,
  p_internal_comment  text)
returns table (
  outcome       text,
  badge_id      uuid,
  decided_at    timestamptz,
  sla_breached  boolean,
  review_mode   text
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
  v_old       record;
  v_declared  text;
  v_badge     uuid;
  v_carried   record;
  v_closed    record;
begin
  perform verification.check_internal_comment(p_internal_comment);
  if v_handle is null or pg_catalog.char_length(v_handle) not between 1 and 100
     or v_handle ~ '[[:cntrl:]]' then
    raise exception 'observed_handle' using errcode = 'invalid_parameter_value', detail = 'observed_handle';
  end if;

  select * into v_entry from verification.gate_dispute_decision(p_dispute_id, v_caller, p_review_token);
  if v_entry.badge_id is null then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  select b.id, b.request_id, b.level, b.evidence_source, b.registry_source_id,
         b.observed_followers, b.observed_posts_last_30_days, b.observed_avg_comments,
         b.observed_engagement_bp, b.observed_period_start, b.observed_period_end,
         b.declared_followers_at_decision, b.declared_posts_at_decision,
         b.declared_comments_at_decision, b.declared_engagement_bp_at_decision,
         b.observed_platform_account_ref, b.expires_at, b.revocation_request_id
    into v_old
    from verification.badges b
   where b.id = v_entry.badge_id;

  select l.handle into v_declared
    from profiles.creator_social_accounts l
   where l.id = v_entry.social_account_id and l.account_id = v_entry.account_id;
  if not found then
    raise exception 'line_deleted'
      using errcode = 'object_not_in_prerequisite_state', detail = 'line_deleted';
  end if;
  if not exists (select 1 from identity.accounts a
                  where a.id = v_entry.account_id and a.status = 'active') then
    raise exception 'account_unavailable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'account_unavailable';
  end if;
  if verification.normalize_handle(v_declared) is null
     or verification.normalize_handle(v_declared) <> verification.normalize_handle(v_handle) then
    raise exception 'observed_handle_mismatch'
      using errcode = 'invalid_parameter_value', detail = 'observed_handle_mismatch';
  end if;
  -- modele point 9: the original expiry, never prolonged
  if v_old.expires_at is not null and v_old.expires_at <= pg_catalog.now() then
    raise exception 'restore_expired'
      using errcode = 'object_not_in_prerequisite_state', detail = 'restore_expired';
  end if;
  if v_old.level = 'audience_verified'
     and not exists (select 1 from verification.badges b
                      where b.account_id = v_entry.account_id
                        and b.social_account_id = v_entry.social_account_id
                        and b.level = 'account_verified' and b.state = 'active') then
    raise exception 'ownership_prerequisite'
      using errcode = 'object_not_in_prerequisite_state', detail = 'ownership_prerequisite';
  end if;
  if v_old.level = 'account_verified'
     and exists (select 1 from verification.badges b
                  where b.account_id <> v_entry.account_id
                    and b.network_code = v_entry.network_code
                    and b.level = 'account_verified'
                    and b.state in ('active', 'to_refresh', 'to_reconfirm')
                    and (verification.normalize_handle(b.observed_handle_at_decision)
                           = verification.normalize_handle(v_handle)
                         or (v_old.observed_platform_account_ref is not null
                             and b.observed_platform_account_ref = v_old.observed_platform_account_ref))) then
    raise exception 'handle_already_verified'
      using errcode = 'object_not_in_prerequisite_state', detail = 'handle_already_verified';
  end if;

  update verification.badges b
     set state = 'replaced'
   where b.account_id = v_entry.account_id and b.social_account_id = v_entry.social_account_id
     and b.level = v_old.level and b.state in ('active', 'to_refresh', 'to_reconfirm');

  -- CA53: a new badge, the finding of the withdrawn one copied, the handle typed again
  insert into verification.badges
    (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
     granted_at, evidence_source, registry_source_id, observed_followers,
     observed_posts_last_30_days, observed_avg_comments, observed_engagement_bp,
     observed_period_start, observed_period_end, declared_followers_at_decision,
     declared_posts_at_decision, declared_comments_at_decision, declared_engagement_bp_at_decision,
     observed_handle_at_decision, observed_platform_account_ref, expires_at, dispute_id)
  values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code, v_old.request_id,
          v_old.level, v_caller, pg_catalog.now(), v_old.evidence_source, v_old.registry_source_id,
          v_old.observed_followers, v_old.observed_posts_last_30_days, v_old.observed_avg_comments,
          v_old.observed_engagement_bp, v_old.observed_period_start, v_old.observed_period_end,
          v_old.declared_followers_at_decision, v_old.declared_posts_at_decision,
          v_old.declared_comments_at_decision, v_old.declared_engagement_bp_at_decision,
          v_handle, v_old.observed_platform_account_ref, v_old.expires_at, p_dispute_id)
  returning id into v_badge;

  -- modele point 4, EC-L2F-07-5: the audience carried along comes back while its expiry is ahead
  if v_old.level = 'account_verified' then
    for v_carried in
      select c.request_id, c.observed_followers, c.observed_posts_last_30_days,
             c.observed_avg_comments, c.observed_engagement_bp, c.observed_period_start,
             c.observed_period_end, c.declared_followers_at_decision, c.declared_posts_at_decision,
             c.declared_comments_at_decision, c.declared_engagement_bp_at_decision,
             c.expires_at
        from verification.badges c
       where c.account_id = v_entry.account_id
         and c.social_account_id = v_entry.social_account_id
         and c.level = 'audience_verified'
         and c.state = 'revoked'
         and c.revocation_request_id = v_old.revocation_request_id
         and c.expires_at > pg_catalog.now()
         and c.findings_erased_at is null
         and not exists (select 1 from verification.badges h
                          where h.account_id = v_entry.account_id
                            and h.social_account_id = v_entry.social_account_id
                            and h.level = 'audience_verified'
                            and h.state in ('active', 'to_refresh', 'to_reconfirm'))
       order by c.id
       limit 1
    loop
      insert into verification.badges
        (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
         granted_at, evidence_source, observed_followers, observed_posts_last_30_days,
         observed_avg_comments, observed_engagement_bp, observed_period_start,
         observed_period_end, declared_followers_at_decision, declared_posts_at_decision,
         declared_comments_at_decision, declared_engagement_bp_at_decision,
         observed_handle_at_decision, expires_at, dispute_id)
      values (v_entry.account_id, v_entry.social_account_id, v_entry.network_code,
              v_carried.request_id, 'audience_verified', v_caller, pg_catalog.now(),
              'native_dashboard', v_carried.observed_followers,
              v_carried.observed_posts_last_30_days, v_carried.observed_avg_comments,
              v_carried.observed_engagement_bp, v_carried.observed_period_start,
              v_carried.observed_period_end, v_carried.declared_followers_at_decision,
              v_carried.declared_posts_at_decision, v_carried.declared_comments_at_decision,
              v_carried.declared_engagement_bp_at_decision, v_handle, v_carried.expires_at,
              p_dispute_id);
    end loop;
  end if;
  -- RG76: the public row of the line derived again
  perform profiles.refresh_creator_public_network(v_entry.social_account_id);

  select * into v_closed
    from verification.close_dispute(p_dispute_id, v_entry.account_id, v_caller, 'overturned',
                                    'decision_overturned', null, p_internal_comment,
                                    v_entry.review_mode, v_badge);
  return query select 'overturned'::text, v_badge, v_closed.decided_at, v_closed.sla_breached,
                      v_entry.review_mode;
end
$$;

comment on function verification.overturn_revocation(uuid, text, text, text) is
  '08 RG77, CA53 (0232; modele points 4, 9; EC-L2F-07-5): the holder of a live claim overturns a '
  'contested withdrawal: a NEW badge granted now, the finding of the withdrawn one copied (figures, '
  'period, declared values, reference), the handle typed again and compared with the declared one '
  '(0228), its original expiry (passed: 55000 restore_expired; never prolonged); a « Compte vérifié » '
  'given back brings back the audience it carried along while its expiry is ahead. dispute_id on '
  'each; a holding badge of the level replaced; the public row derived again; '
  'verification.close_dispute(). Returns (overturned, badge_id, decided_at, sla_breached, '
  'review_mode). 22023 observed_handle, observed_handle_mismatch, internal_comment, level (a refusal); '
  '55000 line_deleted, account_unavailable, restore_expired, ownership_prerequisite, '
  'handle_already_verified; then the refusals of verification.gate_dispute_decision(). SECURITY '
  'DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 8.6 The badges of an account with their contest (17b §3.6; modele §3) --------------------------------
create or replace function verification.read_account_badges(p_account_id uuid)
returns table (
  badge_id                 uuid,
  level                    verification.badge_level,
  network_code             text,
  social_account_id        uuid,
  state                    text,
  granted_at               timestamptz,
  expires_at               timestamptz,
  ended_at                 timestamptz,
  revoked_at               timestamptz,
  revocation_reason_code   text,
  revocation_request_id    uuid,
  pending_revocation_id    uuid,
  pending_revocation_state text,
  dispute_id               uuid,
  dispute_state            text
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
  if p_account_id is null or p_account_id = v_caller
     or not exists (select 1 from identity.accounts a where a.id = p_account_id) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return query
  select b.id, b.level, b.network_code, b.social_account_id, b.state::text, b.granted_at,
         b.expires_at, b.ended_at, b.revoked_at, b.revocation_reason_code, b.revocation_request_id,
         p.dual_control_request_id, p.status, d.id, d.state::text
    from verification.badges b
    left join lateral (
           select q.dual_control_request_id, s.status
             from verification.badge_revocation_requests q
            cross join lateral (
                    select backoffice.dual_control_status_for(q.dual_control_request_id) as status) s
            where q.badge_id = b.id
              and q.executed_at is null
              and s.status in ('pending', 'confirmed', 'degraded')
            order by q.requested_at desc
            limit 1) p on true
    left join verification.disputes d on d.badge_id = b.id
   where b.account_id = p_account_id
   order by b.granted_at desc, b.id;
end
$$;

comment on function verification.read_account_badges(uuid) is
  '17b §3.6 (0231, 0232; modele §3, §5): an active agent or admin in aal2 reads every badge of an '
  'account other than his own (an account he holds is served): level, network, line, state, dates, '
  'reason and request of a withdrawal, the live request of a withdrawal (pending, confirmed or '
  'degraded, unexpired, not executed) with its state, and the contest of its withdrawal (id, state). '
  'Never a figure, a handle nor an agent. 42501 forbidden for his own or an unknown account. SECURITY '
  'DEFINER owned by influx_verification_definer; EXECUTE for influx_agent and influx_admin.';

-- 8.7 A badge of the same level granted on the line closes the other open contests (modele point 9)
create or replace function verification.withdraw_superseded_disputes()
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
    select d.id
      from verification.disputes d
      left join verification.verification_requests r on r.id = d.request_id
      left join verification.badges b on b.id = d.badge_id
     where d.account_id = new.account_id
       and d.state = 'open'
       and d.level = new.level
       and coalesce(r.social_account_id, b.social_account_id) = new.social_account_id
       and d.id is distinct from new.dispute_id
     order by d.id
       for update of d
  loop
    update verification.disputes d
       set state                 = 'withdrawn',
           withdrawn_cause       = 'superseded',
           closed_at             = pg_catalog.now(),
           claimed_by_account_id = null,
           claimed_at            = null,
           claim_expires_at      = null
     where d.id = v_row.id;
    perform audit.append('verification.dispute_withdrawn', 'verification_dispute', v_row.id,
                         pg_catalog.jsonb_build_object('cause', 'superseded',
                                                       'badge_id', new.id));
  end loop;
  return null;
end
$$;

comment on function verification.withdraw_superseded_disputes() is
  'AFTER INSERT on verification.badges (0232; modele point 9; EC-L2F-07-6): a holding badge of a '
  'creator level granted on a line closes every OTHER open contest of the same account, level and '
  'line (withdrawn, superseded, the claim cleared; verification.dispute_withdrawn {cause, badge_id}), '
  'the contest whose overturn grants it (new.dispute_id) spared. SECURITY DEFINER owned by '
  'influx_verification_definer, empty search_path; no EXECUTE for anyone.';

drop trigger if exists badges_withdraw_superseded_disputes on verification.badges;
create trigger badges_withdraw_superseded_disputes
  after insert on verification.badges
  for each row
  when (new.state in ('active', 'to_refresh', 'to_reconfirm') and new.level <> 'brand_verified')
  execute function verification.withdraw_superseded_disputes();

-- 9. Rights on the functions, then to their owners (03 P7 rule 5) -----------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.submit_own_dispute(uuid, uuid, text, text)',
    'verification.dispute_other_reviewer_exists(uuid[])',
    'verification.lock_held_dispute(uuid, uuid)',
    'verification.dispute_review_token(uuid)',
    'verification.gate_dispute_decision(uuid, uuid, text)',
    'verification.close_dispute(uuid, uuid, uuid, verification.dispute_state, text, text, text, text, uuid)',
    'verification.open_dispute(uuid)',
    'verification.release_dispute(uuid)',
    'verification.extend_dispute_claim(uuid)',
    'verification.force_release_dispute_claim(uuid, text)',
    'verification.read_dispute_dossier(uuid)',
    'verification.read_dispute_evidence(uuid, uuid)',
    'verification.uphold_dispute(uuid, text, text, text, text)',
    'verification.overturn_refusal_account(uuid, text, text, text, text, text)',
    'verification.overturn_refusal_audience(uuid, text, bigint, integer, bigint, integer, date, date, text, text)',
    'verification.overturn_revocation(uuid, text, text, text)',
    'verification.read_account_badges(uuid)',
    'verification.withdraw_superseded_disputes()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', f);
  end loop;
end
$$;

grant execute on function verification.submit_own_dispute(uuid, uuid, text, text) to influx_creator;

grant execute on function
  verification.open_dispute(uuid),
  verification.release_dispute(uuid),
  verification.extend_dispute_claim(uuid),
  verification.force_release_dispute_claim(uuid, text),
  verification.read_dispute_dossier(uuid),
  verification.read_dispute_evidence(uuid, uuid),
  verification.uphold_dispute(uuid, text, text, text, text),
  verification.overturn_refusal_account(uuid, text, text, text, text, text),
  verification.overturn_refusal_audience(uuid, text, bigint, integer, bigint, integer, date, date, text, text),
  verification.overturn_revocation(uuid, text, text, text),
  verification.read_account_badges(uuid)
  to influx_agent, influx_admin;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_verification_definer', current_user);
end
$$;
grant create on schema verification to influx_verification_definer;
grant create on schema verification to influx_creator_verification_definer;

alter function verification.submit_own_dispute(uuid, uuid, text, text)
  owner to influx_creator_verification_definer;

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.dispute_other_reviewer_exists(uuid[])',
    'verification.lock_held_dispute(uuid, uuid)',
    'verification.dispute_review_token(uuid)',
    'verification.gate_dispute_decision(uuid, uuid, text)',
    'verification.close_dispute(uuid, uuid, uuid, verification.dispute_state, text, text, text, text, uuid)',
    'verification.open_dispute(uuid)',
    'verification.release_dispute(uuid)',
    'verification.extend_dispute_claim(uuid)',
    'verification.force_release_dispute_claim(uuid, text)',
    'verification.read_dispute_dossier(uuid)',
    'verification.read_dispute_evidence(uuid, uuid)',
    'verification.uphold_dispute(uuid, text, text, text, text)',
    'verification.overturn_refusal_account(uuid, text, text, text, text, text)',
    'verification.overturn_refusal_audience(uuid, text, bigint, integer, bigint, integer, date, date, text, text)',
    'verification.overturn_revocation(uuid, text, text, text)',
    'verification.read_account_badges(uuid)',
    'verification.withdraw_superseded_disputes()']
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
      ('verification.submit_own_dispute(uuid,uuid,text,text)',
       'influx_creator_verification_definer', true, array['influx_creator']),
      ('verification.dispute_other_reviewer_exists(uuid[])', 'influx_verification_definer', false,
       array[]::text[]),
      ('verification.lock_held_dispute(uuid,uuid)', 'influx_verification_definer', false,
       array[]::text[]),
      ('verification.dispute_review_token(uuid)', 'influx_verification_definer', false,
       array[]::text[]),
      ('verification.gate_dispute_decision(uuid,uuid,text)', 'influx_verification_definer', false,
       array[]::text[]),
      ('verification.close_dispute(uuid,uuid,uuid,verification.dispute_state,text,text,text,text,uuid)',
       'influx_verification_definer', false, array[]::text[]),
      ('verification.open_dispute(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.release_dispute(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.extend_dispute_claim(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.force_release_dispute_claim(uuid,text)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.read_dispute_dossier(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.read_dispute_evidence(uuid,uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.uphold_dispute(uuid,text,text,text,text)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.overturn_refusal_account(uuid,text,text,text,text,text)',
       'influx_verification_definer', true, array['influx_agent', 'influx_admin']),
      ('verification.overturn_refusal_audience(uuid,text,bigint,integer,bigint,integer,date,date,text,text)',
       'influx_verification_definer', true, array['influx_agent', 'influx_admin']),
      ('verification.overturn_revocation(uuid,text,text,text)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.read_account_badges(uuid)', 'influx_verification_definer', true,
       array['influx_agent', 'influx_admin']),
      ('verification.withdraw_superseded_disputes()', 'influx_verification_definer', true,
       array[]::text[])
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

  -- RLS enabled, forced and policed on the three new tables
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.relnamespace = 'verification'::regnamespace
     and c.relname in ('dispute_reasons', 'dispute_outcome_reasons', 'disputes')
     and not (c.relrowsecurity and c.relforcerowsecurity
              and exists (select 1 from pg_catalog.pg_policies p
                           where p.schemaname = 'verification' and p.tablename = c.relname));
  if v_bad is not null then
    raise exception 'row level security not enabled, forced and policed on: %', v_bad;
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.relnamespace = 'verification'::regnamespace
     and c.relname in ('dispute_reasons', 'dispute_outcome_reasons', 'disputes')
     and (pg_catalog.has_table_privilege('influx_advertiser', c.oid,
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          or pg_catalog.has_any_column_privilege('influx_advertiser', c.oid,
                                                 'SELECT, INSERT, UPDATE, REFERENCES'));
  if v_bad is not null then
    raise exception 'influx_advertiser holds a right on: %', v_bad;
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'verification'::regnamespace
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'influx_advertiser may execute: %', v_bad;
  end if;

  -- the creator never reads the lock, an agent, the deadlines, the deciders, the comment nor the mode
  select string_agg(t.col, ', ') into v_bad
    from (values ('claimed_by_account_id'), ('claim_expires_at'), ('forced_release_by_account_id'),
                 ('decided_by_account_id'), ('original_decider_ids'), ('internal_comment'),
                 ('review_mode'), ('sla_due_at'), ('escalate_at')) as t (col)
   where pg_catalog.has_column_privilege('influx_creator', 'verification.disputes', t.col, 'SELECT');
  if v_bad is not null then
    raise exception 'influx_creator reads verification.disputes.%', v_bad;
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

  -- the catalogues, queue 5 and the parameter
  if (select pg_catalog.array_agg(code order by position) from verification.dispute_reasons
       where is_active) is distinct from array['misread', 'evidence_valid', 'reason_wrong', 'other']
     or (select pg_catalog.array_agg(code order by code) from verification.dispute_reasons
          where requires_text) is distinct from array['other']
     or (select count(*) from verification.dispute_outcome_reasons
          where is_active and outcome = 'upheld') <> 3
     or (select pg_catalog.array_agg(code) from verification.dispute_outcome_reasons
          where is_active and outcome = 'overturned') is distinct from array['decision_overturned'] then
    raise exception 'the dispute reasons are not those of l2f/textes.md';
  end if;
  if not exists (select 1 from backoffice.queues
                  where code = 'verification_disputes' and label_key = 'queue.verification_disputes'
                    and handled_by_roles = '{agent,admin}'::identity.account_role[]
                    and not allows_bulk_action and has_lock and is_active)
     or not exists (select 1 from backoffice.sla_policies
                     where queue_code = 'verification_disputes' and target_claim_minutes = 480
                       and target_decision_minutes = 2400 and escalate_after_minutes = 960
                       and business_hours is not null and is_provisional and is_active) then
    raise exception 'queue verification_disputes or its delay is not as 15 RG29 and 04 l. 5107 say';
  end if;
  if not exists (select 1 from backoffice.operational_settings
                  where key = 'dispute_reflection_hours') then
    raise exception 'dispute_reflection_hours is not loaded';
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
