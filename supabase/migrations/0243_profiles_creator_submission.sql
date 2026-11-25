-- =============================================================================
-- 0243_profiles_creator_submission
-- -----------------------------------------------------------------------------
-- Lot 2 / L2G, commit 03 (jalons/l2g/03.md; l2g/modele.md §1 points 1, 6, 7, 11, 15, -4, -5, §2,
-- §3 "0243", §3 bis, §4, which prevails for every name; fiche invariants 4, 7 to 9, 16; 07 RG4, RG5,
-- RG8 to RG10, RG86 to RG90; 08 RG16; L2DS-4, L2DS-6). The submission of a creator profile and the
-- regime of a published one, guarded by the database. No claim nor decision (0244), no export nor
-- erasure of the new rows (0245), no route (08), no screen.
--
--   profiles.moderated_fields          six creator codes (modele point 6): creator.headline,
--         creator.bio, creator.portfolio_caption (row_key = an approved visual), creator.network_line
--         (a line added to a published profile, value {}), creator.network_handle and
--         creator.network_url (row_key = the line).
--   profiles.creator_rejection_reasons   the closed list of 07 RG96 (modele §2): next_step fix or
--         contact; `other` alone requires the message to the creator.
--   profiles.creator_review_entries    queue 2 (15 RG29 profiles_creator): one entry per examination
--         (submission, revision), the columns of 0207 §4, its deadlines frozen at creation by the
--         invoker trigger prepare_creator_review_entry(); at most one open per account.
--   profiles.creator_field_revisions   a submitted value of a moderated creator field (modele point
--         1: NOT profile_field_revisions, which influx_advertiser reads, a creator revision carrying a
--         handle of layer I); one pending per field and row.
--   profiles.creator_public_networks.listed_at   a line served in layer A once listed by a decision
--         (0244); kept under influx_identity_definer (its derivations never list a line).
--   profiles.trimmed_char_length(text), creator_missing_required_fields(jsonb),
--   creator_completeness_percent(jsonb)   IMMUTABLE, SECURITY INVOKER: the database copy of
--         packages/domain (required.ts, completeness.ts) on the JSON of CreatorProfileInput, plus
--         portfolioDeposited and accountVerified (modele -5, point 7: `portfolio`, `account_verified`
--         after the codes of required.ts; RG87 portfolio points). Parity: db-tests/
--         creator-profile-parity.test.ts (born here, extended by 06).
--   profiles.creator_profile_input(account)   STABLE, SECURITY INVOKER: that JSON, read from the
--         tables with the rights of its caller.
--   Five creator doors, SECURITY DEFINER owned by influx_creator_profile_definer, EXECUTE for
--   influx_creator only, the account read from the transaction context (03 P2):
--      creator_moderated_field_is_active(code)   what the guard asks (the creator reads no catalogue)
--      submit_own_creator_profile()   (status, missing_fields, entry_id): from draft or rejected, the
--                                     required fields missing listed and nothing written; otherwise
--                                     the score stored, pending_review, the entry `submission`,
--                                     creator_profile.submitted; pending_review again: nothing
--      submit_own_creator_revision(field, row_key, value)   the rules of 0209 on a published profile
--      set_own_portfolio_caption(visual, caption, brand declared)   direct, except an approved visual of
--                                     a published profile (a revision); the statement of RG83 written
--      record_own_creator_profile_change()   the score recomputed and stored; lead.updated when published
--   Two triggers owned by influx_creator_profile_definer, never on the erasure:
--      withdraw_creator_revisions_of_line()   AFTER DELETE of a line: its pending revisions withdrawn
--      refuse_creator_role_removal()          BEFORE DELETE of a creator role (L2DS-6): 55000
--                                             creator_profile_not_draft outside draft
--   profiles.guard_creator_member_write()   (§3 bis, L2DS-4) BEFORE trigger, SECURITY INVOKER, on the
--         storefront, its five lists, the refused sectors, the lines, the three audiences and the
--         visuals: under influx_creator or influx_creator_profile_definer, suspended refuses every
--         write, the status goes to pending_review from draft or rejected only, and a published
--         profile refuses headline, bio, the caption of an approved visual, the handle (but under an
--         active « Compte vérifié ») and the URL of a listed line, a main unlisted line (55000
--         moderated_field, the field code in DETAIL); the profile held FOR SHARE.
--   Rights: is_searchable writable by influx_creator (RG8, modele point 11); completeness_percent no
--         longer (L2DS-4, modele point 7). influx_advertiser and influx_identity_definer: nothing on
--         the new tables and functions (T9.6-O extended, modele -4).
--
-- Refusals (the MESSAGE is the code, the DETAIL its precision):
--   42501 forbidden   outside an active creator account holding a storefront; another's line or
--                     visual as an unknown one (T14).
--   55000 profile_state (DETAIL the status or `status`), moderated_field (DETAIL the field code),
--         item_state, creator_profile_not_draft.
--   23514 required field emptied by a revision (DETAIL its code).
--   22023 field, row_key, value, caption.
--
-- EC-L2G-03 (micro-gaps, the safest choice):
--   EC-L2G-03-1  L2DS-6 holds in a BEFORE DELETE trigger on identity.account_roles, owned by
--                influx_creator_profile_definer, rather than in a recreated
--                identity.change_member_role(): its owner influx_identity_definer reads no status of
--                a storefront and gets no new right (modele point 15, -4); every path that removes a
--                creator role (the erasure apart) is held. To see the status of the target, the owner
--                reads the non-draft storefronts of every account (status included), nothing it did
--                not already read of its caller.
--   EC-L2G-03-2  profiles.read_creator_public_badges() is left to commit 09, its only reader: its
--                owner influx_identity_definer reads no « Compte vérifié » of a creator today, and the
--                policy it needs is decided with the projection (modele point 9).
--   EC-L2G-03-3  submit_own_creator_profile() writes nothing while a field is missing (modele point 7)
--                and returns the codes, the status unchanged and no entry; the score is stored with
--                the submission only (record_own_creator_profile_change stores it on every save).
--   EC-L2G-03-4  a revision of the handle of a line holding an active « Compte vérifié » is refused
--                (22023 field): that handle is immediate, controlled by queue 6 alone (modele point
--                6); network_line names an unlisted line, network_handle and network_url a listed one
--                (22023 row_key otherwise).
--   EC-L2G-03-5  the caption of an approved visual: a revision {"caption", "brand_declaration_id"}; the
--                same caption and the same box as the validated ones withdraw the pending revision;
--                a statement of RG83 is written for each caption declared (immutable, kept), never
--                for an unchanged one. A visual neither pending nor approved: 55000 item_state.
--   EC-L2G-03-6  the guard's messages: profile_state (DETAIL suspended, or status for a forbidden
--                move) and moderated_field (DETAIL the field code); an inactive code of
--                moderated_fields is not frozen (04 §3.1, as 0209).
--   EC-L2G-03-7  record_own_creator_profile_change() returns true when it wrote lead.updated (a
--                published profile), false otherwise, the score stored in both cases (as 0209).
--   EC-L2G-03-8  listed_at: a timestamptz (the instant of the listing), as published_at.
--
-- ROLLBACK (before any profile left draft): drop the triggers creator_member_write_guard (twelve
-- tables), creator_social_accounts_withdraw_revisions, account_roles_refuse_creator_removal,
-- creator_public_networks_keep_listing, creator_review_entries_prepare and
-- creator_review_entries_touch_updated_at, creator_field_revisions_touch_updated_at; drop the
-- functions of sections 7, 10 and 11; drop table profiles.creator_field_revisions,
-- profiles.creator_review_entries, profiles.creator_rejection_reasons; alter table
-- profiles.creator_public_networks drop column listed_at; delete the six creator codes of
-- profiles.moderated_fields and the three event types; revoke the grants and drop the policies
-- *_creator_profile_definer_* of section 9 (sla_policies_creator_profile_definer_select recreated as in
-- 0242); revoke update (is_searchable) from influx_creator and grant it update (completeness_percent)
-- on profiles.creator_identities again.
-- =============================================================================

-- 1. The codes of the register (modele §4) ---------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- 07 RG4: the creator submits his profile (from draft or rejected), the entry named
  ('creator_profile.submitted',          'profiles', 'creator_profile', 'info'),
  -- 07 RG9: a moderated field of a published profile proposed, or brought back to its validated
  -- value; the payload names the field, its row and the entry, never the value
  ('creator_profile.revision_submitted', 'profiles', 'creator_profile', 'info'),
  ('creator_profile.revision_withdrawn', 'profiles', 'creator_profile', 'info')
on conflict (code) do nothing;

-- 2. The moderated fields of a creator profile (modele point 6; 07 RG9) ---------------------------

insert into profiles.moderated_fields (code, profile_kind, target_table, label_key) values
  ('creator.headline',          'creator', 'profiles.creator_public_profiles',
   'field.creator.headline'),
  ('creator.bio',               'creator', 'profiles.creator_public_profiles',
   'field.creator.bio'),
  ('creator.portfolio_caption', 'creator', 'profiles.portfolio_items',
   'field.creator.portfolio_caption'),
  ('creator.network_line',      'creator', 'profiles.creator_public_networks',
   'field.creator.network_line'),
  ('creator.network_handle',    'creator', 'profiles.creator_social_accounts',
   'field.creator.network_handle'),
  ('creator.network_url',       'creator', 'profiles.creator_social_accounts',
   'field.creator.network_url')
on conflict (code) do nothing;

comment on table profiles.moderated_fields is
  'The closed list of the profile fields whose change on a PUBLISHED profile is re-validated (04 '
  '§5.2, 06 RG9, 07 RG9, file.md A4): the change waits in profiles.profile_field_revisions (brand) or '
  'profiles.creator_field_revisions (creator), the live row keeps the validated value. A table, not '
  'an enum: a field is deactivated without migration (04 §3.1). Advertiser codes: brand_name (column '
  'legal_name), logo (profiles.brand_logo_objects), presentation, website_domain, contact_role, '
  'primary_sector. Creator codes (0243, l2g/modele point 6): headline, bio, portfolio_caption (row: '
  'an approved visual), network_line (a line added to a published profile), network_handle and '
  'network_url (row: a listed line). Read by agent and admin in aal2; written by the migrations.';

-- 3. profiles.creator_rejection_reasons (07 RG96; modele §2) ---------------------------------------

create table if not exists profiles.creator_rejection_reasons (
  code                     text     not null primary key,
  label_key                text     not null,
  message_key              text     not null,
  requires_member_message  boolean  not null default false,
  next_step                text     not null,
  position                 smallint not null,
  is_active                boolean  not null default true,

  constraint creator_rejection_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint creator_rejection_reasons_label_key
    check (label_key = 'reason.profiles_creator.' || code),
  constraint creator_rejection_reasons_message_key
    check (message_key = 'creatorProfileDecision.reason.' || code),
  constraint creator_rejection_reasons_next_step check (next_step in ('fix', 'contact')),
  constraint creator_rejection_reasons_position check (position > 0),
  constraint creator_rejection_reasons_position_unique unique (position)
);

comment on table profiles.creator_rejection_reasons is
  'The closed list of the refusal reasons of queue 2 (07 RG96, l2g/modele §2; 04 §3.1: one table per '
  'queue). A refusal is never mute (RG10): profiles.creator_review_entries.rejection_reason_code '
  'references it. next_step: fix (the creator corrects and submits again) or contact (he writes to '
  'INFLUX). Read by agent and admin in aal2; written by the migrations.';
comment on column profiles.creator_rejection_reasons.message_key is
  'Key of the message sent to the creator, in apps/api/src/locales/{fr,en}/email.json: '
  'creatorProfileDecision.reason.<code> (l2g/textes.md).';
comment on column profiles.creator_rejection_reasons.requires_member_message is
  'The reason requires the message written by the agent to the creator (07 RG96 « Autre »): `other` '
  'only, 20 to 500 characters (the entry bounds it); checked by the decision (0244).';

insert into profiles.creator_rejection_reasons
  (code, label_key, message_key, requires_member_message, next_step, position)
values
  ('identifier_in_text',        'reason.profiles_creator.identifier_in_text',
   'creatorProfileDecision.reason.identifier_in_text',        false, 'fix',     1),
  ('bio_insufficient',          'reason.profiles_creator.bio_insufficient',
   'creatorProfileDecision.reason.bio_insufficient',          false, 'fix',     2),
  ('portfolio_insufficient',    'reason.profiles_creator.portfolio_insufficient',
   'creatorProfileDecision.reason.portfolio_insufficient',    false, 'fix',     3),
  ('portfolio_non_compliant',   'reason.profiles_creator.portfolio_non_compliant',
   'creatorProfileDecision.reason.portfolio_non_compliant',   false, 'fix',     4),
  ('network_link_inconsistent', 'reason.profiles_creator.network_link_inconsistent',
   'creatorProfileDecision.reason.network_link_inconsistent', false, 'fix',     5),
  ('figures_inconsistent',      'reason.profiles_creator.figures_inconsistent',
   'creatorProfileDecision.reason.figures_inconsistent',      false, 'fix',     6),
  ('topic_inconsistent',        'reason.profiles_creator.topic_inconsistent',
   'creatorProfileDecision.reason.topic_inconsistent',        false, 'fix',     7),
  ('illicit_content',           'reason.profiles_creator.illicit_content',
   'creatorProfileDecision.reason.illicit_content',           false, 'contact', 8),
  ('age_doubt',                 'reason.profiles_creator.age_doubt',
   'creatorProfileDecision.reason.age_doubt',                 false, 'contact', 9),
  ('other',                     'reason.profiles_creator.other',
   'creatorProfileDecision.reason.other',                     true,  'contact', 10)
on conflict (code) do nothing;

-- 4. profiles.creator_review_entries: queue 2 (modele point 1; 0207 §4; 15 RG26, RG27) -------------

create table if not exists profiles.creator_review_entries (
  id                                uuid        not null primary key default gen_random_uuid(),
  account_id                        uuid        not null
                                                references profiles.creator_public_profiles (account_id),
  kind                              profiles.review_entry_kind  not null,
  state                             profiles.review_entry_state not null default 'open',
  created_at                        timestamptz not null default now(),
  sla_due_at                        timestamptz not null,
  escalate_at                       timestamptz,
  claimed_by_account_id             uuid        references identity.accounts (id),
  claimed_at                        timestamptz,
  claim_expires_at                  timestamptz,
  forced_release_at                 timestamptz,
  forced_release_by_account_id      uuid        references identity.accounts (id),
  forced_release_holder_account_id  uuid        references identity.accounts (id),
  forced_release_reason_code        text        references backoffice.claim_release_reasons (code),
  decided_by_account_id             uuid        references identity.accounts (id),
  decided_at                        timestamptz,
  rejection_reason_code             text        references profiles.creator_rejection_reasons (code),
  member_message                    text,
  internal_comment                  text,
  closed_at                         timestamptz,
  -- 04 l. 2238: the decision came after the deadline (15 C8: a late decision is possible, marked)
  sla_breached                      boolean     not null
                                                generated always as
                                                  (decided_at is not null and decided_at > sla_due_at)
                                                stored,
  updated_at                        timestamptz not null default now(),

  -- the key of the revisions: a revision belongs to an entry of ITS account
  constraint creator_review_entries_id_account unique (id, account_id),
  constraint creator_review_entries_closed check ((state = 'open') = (closed_at is null)),
  constraint creator_review_entries_closed_after check (closed_at >= created_at),
  -- 07 RG5, RG10: published and rejected, and only they, carry a human decision, whole
  constraint creator_review_entries_decided
    check ((state in ('published', 'rejected')) = (decided_by_account_id is not null)),
  constraint creator_review_entries_decided_together
    check ((decided_by_account_id is null) = (decided_at is null)),
  constraint creator_review_entries_decided_after check (decided_at >= created_at),
  constraint creator_review_entries_rejection_reason
    check ((state = 'rejected') = (rejection_reason_code is not null)),
  -- the message to the creator, on a refusal only, 20 to 500 printable characters (EC-L2C-05-4)
  constraint creator_review_entries_member_message_rejected
    check (member_message is null or state = 'rejected'),
  constraint creator_review_entries_member_message_length
    check (char_length(member_message) between 20 and 500),
  constraint creator_review_entries_member_message_text
    check (member_message ~ '[^[:space:]]'
           and member_message !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- the internal comment, never sent to the creator, 1 000 printable characters at most
  constraint creator_review_entries_internal_comment_length
    check (char_length(internal_comment) between 1 and 1000),
  constraint creator_review_entries_internal_comment_text
    check (internal_comment ~ '[^[:space:]]'
           and internal_comment !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- 15 RG27 C1 to C3: a claim is whole, its expiry after it
  constraint creator_review_entries_claim_together
    check ((claimed_by_account_id is null) = (claimed_at is null)
           and (claimed_at is null) = (claim_expires_at is null)),
  constraint creator_review_entries_claim_expiry check (claim_expires_at > claimed_at),
  -- 15 C4: the last forced release is whole
  constraint creator_review_entries_forced_release_together
    check (pg_catalog.num_nulls(forced_release_at, forced_release_by_account_id,
                                forced_release_holder_account_id, forced_release_reason_code)
           in (0, 4)),
  constraint creator_review_entries_sla_after check (sla_due_at >= created_at),
  constraint creator_review_entries_escalate_after check (escalate_at >= sla_due_at)
);

-- at most one open entry per account
create unique index if not exists creator_review_entries_one_open
  on profiles.creator_review_entries (account_id) where state = 'open';
-- queue 2 (15 RG26: oldest deadline first)
create index if not exists creator_review_entries_queue_idx
  on profiles.creator_review_entries (sla_due_at, created_at) where state = 'open';
-- the history of an account (the creator's own reads, the record of the account)
create index if not exists creator_review_entries_account_idx
  on profiles.creator_review_entries (account_id, created_at);

comment on table profiles.creator_review_entries is
  'Queue 2 (15 RG29 profiles_creator; 07 RG4 to RG10, RG93 to RG97; l2g/modele point 1): one entry '
  'per examination of a creator profile, a submission or the revision of moderated fields; at most '
  'one open per account. Carries the lock (15 RG27), the deadlines frozen at creation (04 §5.6, '
  'trigger), the global decision and its reason of 07 RG96; the revisions attach to it. Opened by the '
  'creator doors of 0243 (influx_creator_profile_definer); decided by the functions of 0244 only. '
  'Read by the creator (his own, without lock, agent, deadlines nor internal comment) and by agent '
  'and admin in aal2, never on their own account (15 RG36). NO right of influx_advertiser nor '
  'influx_identity_definer.';
comment on column profiles.creator_review_entries.sla_due_at is
  'Decision deadline, frozen at creation: backoffice.business_deadline(profiles_creator, created_at, '
  'target_decision_minutes) of the policy in force then (04 §5.6, 07 RG6). Never recomputed.';
comment on column profiles.creator_review_entries.member_message is
  'Message written by the agent to the creator (07 RG96 « Autre »), plain text, 20 to 500 characters, '
  'on a refusal only. Emptied by the erasure (0245).';
comment on column profiles.creator_review_entries.internal_comment is
  'Comment of the agent, 1 000 characters at most, NEVER shown to the creator, sent by e-mail, '
  'written to the register nor exported.';

drop trigger if exists creator_review_entries_touch_updated_at on profiles.creator_review_entries;
create trigger creator_review_entries_touch_updated_at
  before update on profiles.creator_review_entries
  for each row execute function influx.touch_updated_at();

create or replace function profiles.prepare_creator_review_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision  integer;
  v_escalate  integer;
begin
  select p.target_decision_minutes, p.escalate_after_minutes
    into v_decision, v_escalate
    from backoffice.sla_policies p
   where p.queue_code = 'profiles_creator' and p.is_active;
  if not found then
    raise exception 'queue profiles_creator has no active delay policy'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  new.created_at  := pg_catalog.now();
  new.updated_at  := pg_catalog.now();
  new.sla_due_at  := backoffice.business_deadline('profiles_creator', new.created_at, v_decision);
  new.escalate_at := backoffice.business_deadline('profiles_creator', new.sla_due_at, v_escalate);
  return new;
end
$$;

comment on function profiles.prepare_creator_review_entry() is
  'BEFORE INSERT on profiles.creator_review_entries (0243): created_at = now(), sla_due_at and '
  'escalate_at computed ONCE from the policy of profiles_creator in force (04 §5.6, 07 RG6), whatever '
  'the writer gave. 55000 when the queue has no active policy. SECURITY INVOKER: the writer '
  '(influx_creator_profile_definer) reads the policy and executes business_deadline() with its own '
  'rights.';

revoke all on function profiles.prepare_creator_review_entry()
  from public, anon, authenticated, service_role;

drop trigger if exists creator_review_entries_prepare on profiles.creator_review_entries;
create trigger creator_review_entries_prepare
  before insert on profiles.creator_review_entries
  for each row execute function profiles.prepare_creator_review_entry();

-- 5. profiles.creator_field_revisions (modele point 1, §2; 04 §5.2) ----------------------------------

create table if not exists profiles.creator_field_revisions (
  id                       uuid        not null primary key default gen_random_uuid(),
  account_id               uuid        not null references identity.accounts (id),
  field_code               text        not null references profiles.moderated_fields (code),
  row_key                  text,
  proposed_value           jsonb       not null,
  status                   profiles.revision_status not null default 'pending_review',
  submitted_at             timestamptz not null default now(),
  creator_review_entry_id  uuid        not null,
  closed_at                timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  constraint creator_field_revisions_entry_fk
    foreign key (creator_review_entry_id, account_id)
    references profiles.creator_review_entries (id, account_id),
  -- a creator field only (modele point 1: the brand fields live in profile_field_revisions)
  constraint creator_field_revisions_creator_field check (field_code like 'creator.%'),
  constraint creator_field_revisions_value_size
    check (pg_catalog.pg_column_size(proposed_value) <= 8000),
  constraint creator_field_revisions_row_key check (char_length(row_key) between 1 and 100),
  constraint creator_field_revisions_closed
    check ((status = 'pending_review') = (closed_at is null)),
  constraint creator_field_revisions_closed_after check (closed_at >= submitted_at)
);

-- 04 l. 1465: one pending revision per field and row; a new value supersedes the old one
create unique index if not exists creator_field_revisions_pending_idx
  on profiles.creator_field_revisions (account_id, field_code, coalesce(row_key, ''))
  where status = 'pending_review';
create index if not exists creator_field_revisions_entry_idx
  on profiles.creator_field_revisions (creator_review_entry_id);

comment on table profiles.creator_field_revisions is
  'Submitted values of moderated creator fields, WAITING for the decision of their entry of queue 2 '
  '(07 RG9, CA48; l2g/modele point 1): the live rows keep the last VALIDATED version. Its own table, '
  'not profile_field_revisions (which influx_advertiser reads): a creator revision carries a handle or '
  'a URL of layer I (CLAUDE.md §5 rule 3). Written by the creator doors of 0243 only; applied by the '
  'decisions of 0244; read by the owner and by agent and admin in aal2, never on their own account. '
  'NO right of influx_advertiser nor influx_identity_definer.';
comment on column profiles.creator_field_revisions.row_key is
  'The row of the field: the line (network_line, network_handle, network_url) or the approved visual '
  '(portfolio_caption), its uuid as text; NULL for headline and bio.';
comment on column profiles.creator_field_revisions.proposed_value is
  'The submitted value, not the published one; 8 000 bytes at most. A text for headline, bio, '
  'network_handle, network_url; {} for network_line; {"caption", "brand_declaration_id"} for '
  'portfolio_caption. Never in a log, the register nor an outbox payload (fiche invariant 13).';

drop trigger if exists creator_field_revisions_touch_updated_at on profiles.creator_field_revisions;
create trigger creator_field_revisions_touch_updated_at
  before update on profiles.creator_field_revisions
  for each row execute function influx.touch_updated_at();

-- 6. A listed line (modele point 6) -----------------------------------------------------------------

alter table profiles.creator_public_networks
  add column if not exists listed_at timestamptz;

comment on column profiles.creator_public_networks.listed_at is
  'Instant from which the line is served in layer A (l2g/modele point 6, EC-L2G-03-8): written by '
  'the decisions of queue 2 (0244, a publication or an approved network_line); NULL: not listed, '
  'never projected. Kept as it is under influx_identity_definer (its derivations rewrite the bands '
  'only), dropped with its line.';

create or replace function profiles.keep_creator_network_listing()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- the derivations of 0218 (influx_identity_definer) rewrite the bands of a line, never its listing
  if current_user = 'influx_identity_definer' then
    if tg_op = 'INSERT' then
      new.listed_at := null;
    else
      new.listed_at := old.listed_at;
    end if;
  end if;
  return new;
end
$$;

comment on function profiles.keep_creator_network_listing() is
  'BEFORE INSERT OR UPDATE on profiles.creator_public_networks (0243, l2g/modele point 6): under '
  'influx_identity_definer (the derivations, reached from the brand doors), listed_at is NULL on an '
  'insertion and kept on an update, whatever was written. SECURITY INVOKER, empty search_path, NO '
  'grant.';

revoke all on function profiles.keep_creator_network_listing()
  from public, anon, authenticated, service_role;

drop trigger if exists creator_public_networks_keep_listing on profiles.creator_public_networks;
create trigger creator_public_networks_keep_listing
  before insert or update on profiles.creator_public_networks
  for each row execute function profiles.keep_creator_network_listing();

-- 7. The rules of the required fields and of the score, the database copy (modele -5) ---------------
-- On the JSON of CreatorProfileInput (packages/domain creator-profile/input.ts), plus
-- portfolioDeposited (integer) and accountVerified (boolean). The margins are those of
-- String.prototype.trim() (EC-L2B-06-4, 0203), listed explicitly; lengths in code points.

create or replace function profiles.trimmed_char_length(p_value text)
returns integer
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(pg_catalog.char_length(pg_catalog.regexp_replace(
           p_value,
           '^[\t\n\v\f\r    -     　﻿]+'
           '|[\t\n\v\f\r    -     　﻿]+$',
           '', 'g')), 0)
$$;

comment on function profiles.trimmed_char_length(text) is
  '0243: the length in code points of a text once trimmed as String.prototype.trim() does '
  '(EC-L2B-06-4), 0 for NULL: trimmedLength() of packages/domain. IMMUTABLE, SECURITY INVOKER; '
  'EXECUTE for influx_creator_profile_definer only.';

create or replace function profiles.creator_missing_required_fields(p_input jsonb)
returns text[]
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_lines    jsonb := case when pg_catalog.jsonb_typeof(p_input -> 'networkLines') = 'array'
                           then p_input -> 'networkLines' else '[]'::jsonb end;
  v_count    integer;
  v_primary  jsonb;
  v_main     jsonb;
  v_missing  text[] := '{}'::text[];
begin
  v_count := pg_catalog.jsonb_array_length(v_lines);
  -- RG41: the main account is the one line marked primary; none or several, no main account
  if (select count(*) from pg_catalog.jsonb_array_elements(v_lines) l
       where l -> 'isPrimary' = 'true'::jsonb) = 1 then
    select l into v_primary from pg_catalog.jsonb_array_elements(v_lines) l
     where l -> 'isPrimary' = 'true'::jsonb;
  end if;
  -- RG56: the main country of its audience, slot 0 (the first one)
  if pg_catalog.jsonb_typeof(v_primary -> 'audienceCountries') = 'array' then
    select c into v_main
      from pg_catalog.jsonb_array_elements(v_primary -> 'audienceCountries') with ordinality as x (c, n)
     where (c ->> 'slot')::numeric = 0
     order by n
     limit 1;
  end if;

  -- RG16, in the order of the form (required.ts), then the portfolio (RG4, RG77) and the badge (08 RG16)
  if profiles.trimmed_char_length(p_input ->> 'headline') < 20 then
    v_missing := v_missing || 'headline'::text;
  end if;
  if profiles.trimmed_char_length(p_input ->> 'bio') < 150 then
    v_missing := v_missing || 'bio'::text;
  end if;
  if profiles.trimmed_char_length(p_input ->> 'primaryTopicCode') = 0 then
    v_missing := v_missing || 'primary_topic'::text;
  end if;
  if pg_catalog.jsonb_typeof(p_input -> 'publicationLanguages') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_input -> 'publicationLanguages') = 0 then
    v_missing := v_missing || 'publication_languages'::text;
  end if;
  if profiles.trimmed_char_length(p_input ->> 'residenceCountryCode') = 0 then
    v_missing := v_missing || 'residence_country'::text;
  end if;
  if v_count = 0 or exists (select 1 from pg_catalog.jsonb_array_elements(v_lines) l
                             where profiles.trimmed_char_length(l ->> 'networkCode') = 0) then
    v_missing := v_missing || 'network_lines'::text;
  end if;
  if v_primary is null then
    v_missing := v_missing || 'primary_account'::text;
  end if;
  if v_count = 0 or exists (select 1 from pg_catalog.jsonb_array_elements(v_lines) l
                             where profiles.trimmed_char_length(l ->> 'handle') = 0) then
    v_missing := v_missing || 'handle'::text;
  end if;
  if v_count = 0 or exists (select 1 from pg_catalog.jsonb_array_elements(v_lines) l
                             where profiles.trimmed_char_length(l ->> 'profileUrl') = 0) then
    v_missing := v_missing || 'profile_url'::text;
  end if;
  if (v_primary ->> 'followersCount') is null then
    v_missing := v_missing || 'followers'::text;
  end if;
  if profiles.trimmed_char_length(v_primary ->> 'figuresConfirmedAt') = 0 then
    v_missing := v_missing || 'figures_date'::text;
  end if;
  if profiles.trimmed_char_length(v_main ->> 'code') = 0 then
    v_missing := v_missing || 'main_audience_country'::text;
  end if;
  if (v_main ->> 'share') is null then
    v_missing := v_missing || 'main_audience_share'::text;
  end if;
  if pg_catalog.jsonb_typeof(p_input -> 'offerLines') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_input -> 'offerLines') = 0 then
    v_missing := v_missing || 'formats'::text;
  end if;
  if profiles.trimmed_char_length(p_input ->> 'availabilityBand') = 0 then
    v_missing := v_missing || 'availability'::text;
  end if;
  -- RG4, RG88, modele point 5: three visuals deposited, never the approvals
  if coalesce((p_input ->> 'portfolioDeposited')::numeric, 0) < 3 then
    v_missing := v_missing || 'portfolio'::text;
  end if;
  -- 08 RG16, D79 (6): an active « Compte vérifié »
  if (p_input -> 'accountVerified') is distinct from 'true'::jsonb then
    v_missing := v_missing || 'account_verified'::text;
  end if;
  return v_missing;
end
$$;

comment on function profiles.creator_missing_required_fields(jsonb) is
  '07 RG4, RG16, RG90; 08 RG16 (0243, l2g/modele point 7, -5): the required fields of a creator '
  'profile still missing, in the order of the form, as snake_case codes: headline, bio, '
  'primary_topic, publication_languages, residence_country, network_lines, primary_account, handle, '
  'profile_url, followers, figures_date, main_audience_country, main_audience_share, formats, '
  'availability (the codes of packages/domain CREATOR_PROFILE_REQUIRED_FIELDS), then portfolio (fewer '
  'than 3 visuals deposited) and account_verified (no active « Compte vérifié »). Input: the JSON of '
  'CreatorProfileInput plus portfolioDeposited and accountVerified (profiles.creator_profile_input). '
  'The database copy of missingCreatorRequiredFields(), held equal by the parity test '
  '(creator-profile-parity). IMMUTABLE, SECURITY INVOKER; EXECUTE for influx_creator_profile_definer '
  'only.';

create or replace function profiles.creator_completeness_percent(p_input jsonb)
returns smallint
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_lines     jsonb := case when pg_catalog.jsonb_typeof(p_input -> 'networkLines') = 'array'
                            then p_input -> 'networkLines' else '[]'::jsonb end;
  v_offer     jsonb := case when pg_catalog.jsonb_typeof(p_input -> 'offerLines') = 'array'
                            then p_input -> 'offerLines' else '[]'::jsonb end;
  v_rights    jsonb := case when pg_catalog.jsonb_typeof(p_input -> 'usageRights') = 'array'
                            then p_input -> 'usageRights' else '[]'::jsonb end;
  v_primary   jsonb;
  v_main      jsonb;
  v_complete  integer;
  v_deposited numeric := coalesce((p_input ->> 'portfolioDeposited')::numeric, 0);
  v_score     integer := 0;
begin
  if (select count(*) from pg_catalog.jsonb_array_elements(v_lines) l
       where l -> 'isPrimary' = 'true'::jsonb) = 1 then
    select l into v_primary from pg_catalog.jsonb_array_elements(v_lines) l
     where l -> 'isPrimary' = 'true'::jsonb;
  end if;
  if pg_catalog.jsonb_typeof(v_primary -> 'audienceCountries') = 'array' then
    select c into v_main
      from pg_catalog.jsonb_array_elements(v_primary -> 'audienceCountries') with ordinality as x (c, n)
     where (c ->> 'slot')::numeric = 0
     order by n
     limit 1;
  end if;
  -- RG87: a complete line holds the network, handle, URL, the three priority metrics and their date
  select count(*) into v_complete
    from pg_catalog.jsonb_array_elements(v_lines) l
   where profiles.trimmed_char_length(l ->> 'networkCode') > 0
     and profiles.trimmed_char_length(l ->> 'handle') > 0
     and profiles.trimmed_char_length(l ->> 'profileUrl') > 0
     and (l ->> 'followersCount') is not null
     and (l ->> 'postsLast30Days') is not null
     and (l ->> 'avgCommentsPerPost') is not null
     and profiles.trimmed_char_length(l ->> 'figuresConfirmedAt') > 0;

  -- RG87, in the order of the table (completeness.ts); block totals 15, 14, 22, 20, 19, 8, 2
  v_score := v_score
    + case when profiles.trimmed_char_length(p_input ->> 'headline') >= 20 then 5 else 0 end
    + case when profiles.trimmed_char_length(p_input ->> 'bio') >= 150 then 10 else 0 end
    + case when profiles.trimmed_char_length(p_input ->> 'primaryTopicCode') > 0 then 5 else 0 end
    + case when pg_catalog.jsonb_typeof(p_input -> 'secondaryTopicCodes') = 'array'
                and pg_catalog.jsonb_array_length(p_input -> 'secondaryTopicCodes') > 0
           then 2 else 0 end
    + case when pg_catalog.jsonb_typeof(p_input -> 'toneCodes') = 'array'
                and pg_catalog.jsonb_array_length(p_input -> 'toneCodes') > 0
           then 2 else 0 end
    + case when pg_catalog.jsonb_typeof(p_input -> 'publicationLanguages') = 'array'
                and pg_catalog.jsonb_array_length(p_input -> 'publicationLanguages') > 0
           then 3 else 0 end
    + case when profiles.trimmed_char_length(p_input ->> 'residenceCountryCode') > 0 then 1 else 0 end
    + case when profiles.trimmed_char_length(p_input ->> 'travelScope') > 0 then 1 else 0 end
    + case when v_complete >= 1 then 16 else 0 end
    + case when v_complete >= 2 then 5 else 0 end
    + case when exists (select 1 from pg_catalog.jsonb_array_elements(v_lines) l
                         where (l ->> 'avgReachPerPost') is not null)
           then 1 else 0 end
    + case when profiles.trimmed_char_length(v_main ->> 'code') > 0 and (v_main ->> 'share') is not null
           then 10 else 0 end
    + case when pg_catalog.jsonb_typeof(v_primary -> 'audienceCountries') = 'array'
                and exists (select 1 from pg_catalog.jsonb_array_elements(v_primary -> 'audienceCountries') c
                             where (c ->> 'slot')::numeric > 0
                               and profiles.trimmed_char_length(c ->> 'code') > 0)
           then 3 else 0 end
    + case when pg_catalog.jsonb_typeof(v_primary -> 'audienceAges') = 'array'
                and exists (select 1 from pg_catalog.jsonb_array_elements(v_primary -> 'audienceAges') a
                             where (a ->> 'share') is not null)
           then 4 else 0 end
    + case when pg_catalog.jsonb_typeof(v_primary -> 'audienceGenders') = 'array'
                and exists (select 1 from pg_catalog.jsonb_array_elements(v_primary -> 'audienceGenders') g
                             where (g ->> 'share') is not null)
           then 3 else 0 end
    -- EC-L2D-4, D78: the two lines of the offer take the points of the two rate lines
    + case when pg_catalog.jsonb_array_length(v_offer) >= 1 then 8 else 0 end
    + case when pg_catalog.jsonb_array_length(v_offer) >= 2 then 3 else 0 end
    + case when exists (select 1 from pg_catalog.jsonb_array_elements(v_offer) o
                         where profiles.trimmed_char_length(o ->> 'formatCode') > 0)
           then 3 else 0 end
    + case when exists (select 1 from pg_catalog.jsonb_array_elements(v_rights) u
                         where (u ->> 'code') is distinct from 'none')
           then 2 else 0 end
    + case when profiles.trimmed_char_length(p_input ->> 'maxExclusivityBand') > 0 then 1 else 0 end
    + case when profiles.trimmed_char_length(p_input ->> 'availabilityBand') > 0 then 2 else 0 end
    -- block 6, RG88: the visuals deposited, never the approvals
    + case when v_deposited >= 3 then 6 else 0 end
    + case when v_deposited >= 5 then 2 else 0 end
    -- block 7, RG88: a badge request FILED
    + case when (p_input -> 'badgeRequested') = 'true'::jsonb then 2 else 0 end;
  return v_score::smallint;
end
$$;

comment on function profiles.creator_completeness_percent(jsonb) is
  '07 RG86 to RG88 (0243, l2g/modele -5): the score of a creator profile, the points of RG87 the '
  'creator entered (portfolioThree 6 and portfolioFive 2 on the visuals deposited, badgeRequested 2 '
  'on a request filed), 0 to 100, never a decision of INFLUX. Input: as '
  'creator_missing_required_fields(). The database copy of creatorProfileCompleteness() (score), '
  'held equal by the parity test (creator-profile-parity); stored by the doors of 0243 (RG86). '
  'IMMUTABLE, SECURITY INVOKER; EXECUTE for influx_creator_profile_definer only.';

create or replace function profiles.creator_profile_input(p_account_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'headline',             p.headline,
    'bio',                  p.bio,
    'primaryTopicCode',     p.primary_topic_code,
    'secondaryTopicCodes',  coalesce((select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                                        from profiles.creator_topics t
                                       where t.account_id = p.account_id), '[]'::jsonb),
    'toneCodes',            coalesce((select pg_catalog.jsonb_agg(t.tone_code order by t.slot)
                                        from profiles.creator_tones t
                                       where t.account_id = p.account_id), '[]'::jsonb),
    'publicationLanguages', coalesce((select pg_catalog.jsonb_agg(l.language_code order by l.slot)
                                        from profiles.creator_publication_languages l
                                       where l.account_id = p.account_id), '[]'::jsonb),
    'residenceCountryCode', p.residence_country_code,
    'travelScope',          p.travel_scope,
    'networkLines',         coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                 'networkCode',        n.network_code,
                                 'isPrimary',          n.is_primary,
                                 'handle',             n.handle,
                                 'profileUrl',         n.profile_url,
                                 'followersCount',     n.followers_count,
                                 'postsLast30Days',    n.posts_last_30_days,
                                 'avgCommentsPerPost', n.avg_comments_per_post,
                                 'avgReachPerPost',    n.avg_reach_per_post,
                                 'figuresConfirmedAt', n.figures_measured_at,
                                 'audienceCountries',  coalesce((select pg_catalog.jsonb_agg(
                                                          pg_catalog.jsonb_build_object(
                                                            'slot', c.slot, 'code', c.country_code,
                                                            'share', c.share_percent) order by c.slot)
                                                          from profiles.creator_audience_countries c
                                                         where c.social_account_id = n.id
                                                           and c.account_id = n.account_id),
                                                        '[]'::jsonb),
                                 'audienceAges',       coalesce((select pg_catalog.jsonb_agg(
                                                          pg_catalog.jsonb_build_object(
                                                            'code', g.age_band_code,
                                                            'share', g.share_percent)
                                                          order by g.age_band_code)
                                                          from profiles.creator_audience_ages g
                                                         where g.social_account_id = n.id
                                                           and g.account_id = n.account_id),
                                                        '[]'::jsonb),
                                 'audienceGenders',    coalesce((select pg_catalog.jsonb_agg(
                                                          pg_catalog.jsonb_build_object(
                                                            'code', x.gender_code,
                                                            'share', x.share_percent)
                                                          order by x.gender_code)
                                                          from profiles.creator_audience_genders x
                                                         where x.social_account_id = n.id
                                                           and x.account_id = n.account_id),
                                                        '[]'::jsonb))
                               order by n.created_at, n.id)
                               from profiles.creator_social_accounts n
                              where n.account_id = p.account_id), '[]'::jsonb),
    'offerLines',           coalesce((select pg_catalog.jsonb_agg(
                                        pg_catalog.jsonb_build_object('formatCode', f.format_code)
                                        order by f.format_code)
                                        from profiles.creator_formats f
                                       where f.account_id = p.account_id), '[]'::jsonb),
    'usageRights',          coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                          'code', u.usage_right_code, 'inclusion', u.inclusion)
                                        order by u.usage_right_code)
                                        from profiles.creator_usage_rights u
                                       where u.account_id = p.account_id), '[]'::jsonb),
    'maxExclusivityBand',   p.max_exclusivity_band,
    'availabilityBand',     p.availability_band,
    -- 07 RG88: a request FILED (submitted, never withdrawn), never a badge obtained
    'badgeRequested',       exists (select 1 from verification.verification_requests v
                                     where v.account_id = p.account_id and v.population = 'creator'
                                       and v.submitted_at is not null and v.status <> 'cancelled'),
    'portfolioDeposited',   profiles.deposited_portfolio_count(p.account_id),
    -- 08 RG16: an active « Compte vérifié » on one of his lines
    'accountVerified',      exists (select 1 from verification.badges b
                                     where b.account_id = p.account_id
                                       and b.level = 'account_verified' and b.state = 'active'))
    from profiles.creator_public_profiles p
   where p.account_id = p_account_id
$$;

comment on function profiles.creator_profile_input(uuid) is
  '0243 (l2g/modele §3, -5): what the rules of the required fields and of the score read for the '
  'creator p_account_id, as the JSON of CreatorProfileInput (packages/domain) plus portfolioDeposited '
  '(profiles.deposited_portfolio_count) and accountVerified (an active « Compte vérifié »); the '
  'entered values only, never a decision (RG88). NULL without a storefront. SECURITY INVOKER: it reads '
  'with the rights and the policies of its caller (the doors of influx_creator_profile_definer: the '
  'caller''s own rows); EXECUTE for influx_creator_profile_definer only.';

revoke all on function profiles.trimmed_char_length(text)
  from public, anon, authenticated, service_role;
revoke all on function profiles.creator_missing_required_fields(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function profiles.creator_completeness_percent(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function profiles.creator_profile_input(uuid)
  from public, anon, authenticated, service_role;

-- 8. Row level security and the rights of the business roles (fiche invariants 1, 14, 16) ----------

do $$
declare
  t text;
begin
  foreach t in array array['creator_rejection_reasons', 'creator_review_entries',
                           'creator_field_revisions']
  loop
    execute format('alter table profiles.%I enable row level security', t);
    execute format('alter table profiles.%I force row level security', t);
    execute format('revoke all on profiles.%I from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', t);
  end loop;
end
$$;

-- 8.1 The grid of RG96: agent and admin, aal2
grant select on profiles.creator_rejection_reasons to influx_agent, influx_admin;

drop policy if exists creator_rejection_reasons_internal_select on profiles.creator_rejection_reasons;
create policy creator_rejection_reasons_internal_select on profiles.creator_rejection_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 8.2 The entries: the creator his own, without the lock, the agents, the deadlines nor the comment
grant select (id, account_id, kind, state, created_at, decided_at, rejection_reason_code,
              member_message, closed_at, updated_at)
   on profiles.creator_review_entries to influx_creator;
grant select on profiles.creator_review_entries to influx_agent, influx_admin;

drop policy if exists creator_review_entries_member_select_own on profiles.creator_review_entries;
create policy creator_review_entries_member_select_own on profiles.creator_review_entries
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

-- 15 RG36, C(3): an internal never sees an entry of his own account
drop policy if exists creator_review_entries_internal_select on profiles.creator_review_entries;
create policy creator_review_entries_internal_select on profiles.creator_review_entries
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 8.3 The revisions: the owner, agent and admin in aal2 (never their own account)
grant select on profiles.creator_field_revisions to influx_creator, influx_agent, influx_admin;

drop policy if exists creator_field_revisions_member_select_own on profiles.creator_field_revisions;
create policy creator_field_revisions_member_select_own on profiles.creator_field_revisions
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists creator_field_revisions_internal_select on profiles.creator_field_revisions;
create policy creator_field_revisions_internal_select on profiles.creator_field_revisions
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 8.4 RG8, modele point 11: the switch « visible dans la recherche », in any state but suspended
-- (the guard), without door, register nor lead.updated
grant update (is_searchable) on profiles.creator_public_profiles to influx_creator;

-- 8.5 L2DS-4, modele point 7: the score is the database's, recomputed by the doors of section 10
revoke update (completeness_percent) on profiles.creator_identities from influx_creator;

-- 9. What influx_creator_profile_definer reads and writes (the caller's own rows) ------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner,
-- bound to the caller's own account (influx.current_account_id()), but the one of 9.1 (L2DS-6).

grant usage on schema verification, leads to influx_creator_profile_definer;

-- 9.1 The storefront: what the rules read, the status of the submission; the status of a non-draft
-- storefront of any account (EC-L2G-03-1: refuse_creator_role_removal)
grant select (headline, bio, primary_topic_code, residence_country_code, travel_scope,
              max_exclusivity_band, availability_band)
   on profiles.creator_public_profiles to influx_creator_profile_definer;
grant update (status) on profiles.creator_public_profiles to influx_creator_profile_definer;

drop policy if exists creator_public_profiles_creator_profile_definer_select_not_draft
  on profiles.creator_public_profiles;
create policy creator_public_profiles_creator_profile_definer_select_not_draft
  on profiles.creator_public_profiles
  for select to influx_creator_profile_definer
  using (status <> 'draft');

-- the submission only: the caller's own row, to pending_review (the guard holds the move)
drop policy if exists creator_public_profiles_creator_profile_definer_update
  on profiles.creator_public_profiles;
create policy creator_public_profiles_creator_profile_definer_update
  on profiles.creator_public_profiles
  for update to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()) and status = 'pending_review');

-- 9.2 The five lists, the lines and the three audiences: what the rules read
do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('creator_topics',                'account_id, slot, topic_code'),
      ('creator_tones',                 'account_id, slot, tone_code'),
      ('creator_publication_languages', 'account_id, slot, language_code'),
      ('creator_formats',               'account_id, format_code'),
      ('creator_usage_rights',          'account_id, usage_right_code, inclusion'),
      ('creator_social_accounts',       'id, account_id, network_code, is_primary, handle, '
                                        'profile_url, followers_count, posts_last_30_days, '
                                        'avg_comments_per_post, avg_reach_per_post, '
                                        'figures_measured_at, created_at'),
      ('creator_audience_countries',    'social_account_id, account_id, slot, country_code, '
                                        'share_percent'),
      ('creator_audience_ages',         'social_account_id, account_id, age_band_code, share_percent'),
      ('creator_audience_genders',      'social_account_id, account_id, gender_code, share_percent'),
      ('creator_public_networks',       'social_account_id, account_id, listed_at')
    ) as v (name, columns)
  loop
    execute format('grant select (%s) on profiles.%I to influx_creator_profile_definer',
                   l.columns, l.name);
    execute format('drop policy if exists %I on profiles.%I',
                   l.name || '_creator_profile_definer_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_creator_profile_definer '
                   'using (account_id = (select influx.current_account_id()))',
                   l.name || '_creator_profile_definer_select', l.name);
  end loop;
end
$$;

-- 9.3 The stored score (RG86), in the identity row (EC-02-2)
grant select (account_id, completeness_percent), update (completeness_percent)
   on profiles.creator_identities to influx_creator_profile_definer;

drop policy if exists creator_identities_creator_profile_definer_own on profiles.creator_identities;
create policy creator_identities_creator_profile_definer_own on profiles.creator_identities
  for all to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()));

-- 9.4 The request filed (RG88) and the « Compte vérifié » (08 RG16, the handle of §3 bis)
grant select (account_id, population, submitted_at, status)
   on verification.verification_requests to influx_creator_profile_definer;
grant select (account_id, social_account_id, level, state)
   on verification.badges to influx_creator_profile_definer;

drop policy if exists verification_requests_creator_profile_definer_select
  on verification.verification_requests;
create policy verification_requests_creator_profile_definer_select
  on verification.verification_requests
  for select to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists badges_creator_profile_definer_select on verification.badges;
create policy badges_creator_profile_definer_select on verification.badges
  for select to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id())
         and level <> 'brand_verified');

-- 9.5 The catalogue of the creator fields
grant select (code, profile_kind, is_active) on profiles.moderated_fields
   to influx_creator_profile_definer;

drop policy if exists moderated_fields_creator_profile_definer_select on profiles.moderated_fields;
create policy moderated_fields_creator_profile_definer_select on profiles.moderated_fields
  for select to influx_creator_profile_definer
  using (profile_kind = 'creator');

-- 9.6 Queue 2: the caller's entry opened, joined or withdrawn, his revisions; never a decision
grant select (id, account_id, kind, state), insert (account_id, kind), update (state, closed_at)
   on profiles.creator_review_entries to influx_creator_profile_definer;

drop policy if exists creator_review_entries_creator_profile_definer_select
  on profiles.creator_review_entries;
create policy creator_review_entries_creator_profile_definer_select
  on profiles.creator_review_entries
  for select to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists creator_review_entries_creator_profile_definer_insert
  on profiles.creator_review_entries;
create policy creator_review_entries_creator_profile_definer_insert
  on profiles.creator_review_entries
  for insert to influx_creator_profile_definer
  with check (account_id = (select influx.current_account_id()) and state = 'open');
drop policy if exists creator_review_entries_creator_profile_definer_update
  on profiles.creator_review_entries;
create policy creator_review_entries_creator_profile_definer_update
  on profiles.creator_review_entries
  for update to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()) and state = 'open')
  with check (account_id = (select influx.current_account_id())
              and state in ('open', 'withdrawn'));

grant select (id, account_id, field_code, row_key, proposed_value, status, creator_review_entry_id),
      insert (account_id, field_code, row_key, proposed_value, creator_review_entry_id),
      update (status, closed_at)
   on profiles.creator_field_revisions to influx_creator_profile_definer;

drop policy if exists creator_field_revisions_creator_profile_definer_select
  on profiles.creator_field_revisions;
create policy creator_field_revisions_creator_profile_definer_select
  on profiles.creator_field_revisions
  for select to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists creator_field_revisions_creator_profile_definer_insert
  on profiles.creator_field_revisions;
create policy creator_field_revisions_creator_profile_definer_insert
  on profiles.creator_field_revisions
  for insert to influx_creator_profile_definer
  with check (account_id = (select influx.current_account_id()) and status = 'pending_review');
-- superseded or withdrawn by the doors; approved and rejected belong to the decisions (0244)
drop policy if exists creator_field_revisions_creator_profile_definer_update
  on profiles.creator_field_revisions;
create policy creator_field_revisions_creator_profile_definer_update
  on profiles.creator_field_revisions
  for update to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()) and status = 'pending_review')
  with check (account_id = (select influx.current_account_id())
              and status in ('superseded', 'withdrawn'));

-- the trigger of section 4 runs with the writer's rights: the delay of queue 2 besides queue 3
drop policy if exists sla_policies_creator_profile_definer_select on backoffice.sla_policies;
create policy sla_policies_creator_profile_definer_select on backoffice.sla_policies
  for select to influx_creator_profile_definer
  using (queue_code in ('portfolio_moderation', 'profiles_creator'));

-- 9.7 The caption of a visual and the statement of RG83 (modele §2: no writer before 0243)
grant select (caption, brand_declaration_id), update (caption, brand_declaration_id)
   on profiles.portfolio_items to influx_creator_profile_definer;
grant select (id, account_id, portfolio_item_id),
      insert (account_id, portfolio_item_id, caption, statement_key)
   on profiles.portfolio_brand_declarations to influx_creator_profile_definer;

drop policy if exists portfolio_brand_declarations_creator_profile_definer_select
  on profiles.portfolio_brand_declarations;
create policy portfolio_brand_declarations_creator_profile_definer_select
  on profiles.portfolio_brand_declarations
  for select to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()));
drop policy if exists portfolio_brand_declarations_creator_profile_definer_insert
  on profiles.portfolio_brand_declarations;
create policy portfolio_brand_declarations_creator_profile_definer_insert
  on profiles.portfolio_brand_declarations
  for insert to influx_creator_profile_definer
  with check (account_id = (select influx.current_account_id()));

-- 9.8 lead.updated of a published profile (07 RG106, 05 RG73), in the transaction of the fact
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_creator_profile_definer;

drop policy if exists outbox_events_creator_profile_definer_insert on leads.outbox_events;
create policy outbox_events_creator_profile_definer_insert on leads.outbox_events
  for insert to influx_creator_profile_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and event_type = 'lead.updated'
              and destination in ('brevo_contact', 'apollo_contact'));

-- 9.9 The functions the doors call
grant execute on function
  profiles.trimmed_char_length(text),
  profiles.creator_missing_required_fields(jsonb),
  profiles.creator_completeness_percent(jsonb),
  profiles.creator_profile_input(uuid)
  to influx_creator_profile_definer;

-- 10. The creator doors and the two triggers (created by the migration role, handed to their owner
-- in section 12) ------------------------------------------------------------------------------------

-- 10.1 What the guard asks (EC-L2C-06-2: the creator reads no catalogue)
create or replace function profiles.creator_moderated_field_is_active(p_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from profiles.moderated_fields f
                  where f.code = p_code and f.profile_kind = 'creator' and f.is_active)
$$;

comment on function profiles.creator_moderated_field_is_active(text) is
  '0243 (§3 bis, EC-L2C-06-2): is this creator code of profiles.moderated_fields active? A boolean, '
  'for the guard of the member writes (SECURITY INVOKER) and the routes of 08, the creator reading '
  'no catalogue. SECURITY DEFINER owned by influx_creator_profile_definer, empty search_path; '
  'EXECUTE for influx_creator only.';

-- 10.2 The submission (07 RG4, RG5, RG10; modele point 7) -----------------------------------------
create or replace function profiles.submit_own_creator_profile()
returns table (
  status          text,
  missing_fields  text[],
  entry_id        uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- the account comes from the transaction context (03 P2), never a parameter
  v_account  uuid := influx.current_account_id();
  v_status   text;
  v_input    jsonb;
  v_missing  text[];
  v_score    smallint;
  v_entry    uuid;
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

  -- The row lock serialises two submissions (double click, second tab) and the member writes (the
  -- guard holds the profile FOR SHARE): the second one reads what the first one committed.
  select p.status::text into v_status
    from profiles.creator_public_profiles p
   where p.account_id = v_account
     for update of p;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- submitted again while waiting: nothing written
  if v_status = 'pending_review' then
    select e.id into v_entry
      from profiles.creator_review_entries e
     where e.account_id = v_account and e.state = 'open';
    return query select v_status, '{}'::text[], v_entry;
    return;
  end if;
  -- RG5, RG10: published and suspended are left by a decision of INFLUX only
  if v_status not in ('draft', 'rejected') then
    raise exception 'profile_state'
      using errcode = 'object_not_in_prerequisite_state', detail = v_status;
  end if;

  -- RG4, RG90: the nominative list of what is missing, nothing written (EC-L2G-03-3)
  v_input := profiles.creator_profile_input(v_account);
  v_missing := profiles.creator_missing_required_fields(v_input);
  if pg_catalog.cardinality(v_missing) > 0 then
    return query select v_status, v_missing, null::uuid;
    return;
  end if;

  -- L2DS-4, RG86: the score recomputed by the base, never read from the column
  v_score := profiles.creator_completeness_percent(v_input);
  update profiles.creator_identities i
     set completeness_percent = v_score
   where i.account_id = v_account and i.completeness_percent is distinct from v_score;

  update profiles.creator_public_profiles p
     set status = 'pending_review'
   where p.account_id = v_account;

  select e.id into v_entry
    from profiles.creator_review_entries e
   where e.account_id = v_account and e.state = 'open';
  if v_entry is null then
    -- its deadlines are written by the trigger of the table (04 §5.6)
    insert into profiles.creator_review_entries (account_id, kind)
    values (v_account, 'submission')
    returning id into v_entry;
  end if;

  -- The register, in the transaction of the fact; last: the chain lock is held until COMMIT.
  perform audit.append('creator_profile.submitted', 'creator_profile', v_account,
                       pg_catalog.jsonb_build_object('from_status', v_status, 'entry_id', v_entry));
  return query select 'pending_review'::text, '{}'::text[], v_entry;
end
$$;

comment on function profiles.submit_own_creator_profile() is
  '07 RG4, RG5, RG10, RG90; l2g/modele point 7 (0243): an active creator submits his own profile. '
  'From draft or rejected with a required field missing (creator_missing_required_fields: the codes '
  'of required.ts, then portfolio and account_verified): nothing written, returns (status, the codes '
  'in the order of the form, NULL). Otherwise, in ONE transaction (the storefront locked): the score '
  'recomputed and stored (creator_completeness_percent, L2DS-4), status pending_review, the entry '
  '`submission` of queue 2 opened (or the open one kept), the register line creator_profile.submitted '
  '{from_status, entry_id}; returns (pending_review, {}, entry). Already pending_review: nothing '
  'written, returns (pending_review, {}, the open entry). 55000 profile_state (DETAIL the status) from '
  'published or suspended; 42501 outside an active creator account holding a storefront. SECURITY '
  'DEFINER owned by influx_creator_profile_definer, empty search_path; EXECUTE for influx_creator only.';

-- 10.3 The member door of RG9 (the rules of 0209; modele point 6) -----------------------------------
create or replace function profiles.submit_own_creator_revision(
  p_field_code  text,
  p_row_key     text,
  p_value       jsonb)
returns table (
  revision_status  profiles.revision_status,
  entry_id         uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  c_uuid           constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  v_account        uuid := influx.current_account_id();
  v_status         text;
  v_headline       text;
  v_bio            text;
  v_row            uuid;
  v_row_key        text;
  v_line           record;
  v_listed         boolean;
  v_item           record;
  v_validated      jsonb;
  v_required       text;
  v_pending_id     uuid;
  v_pending_value  jsonb;
  v_entry          uuid;
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

  -- The row lock serialises the doors of the account and a decision (0244): one pending revision
  -- per field and row, one open entry per account.
  select p.status::text, p.headline, p.bio into v_status, v_headline, v_bio
    from profiles.creator_public_profiles p
   where p.account_id = v_account
     for update of p;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  if p_field_code is null or not profiles.creator_moderated_field_is_active(p_field_code) then
    raise exception 'field' using errcode = 'invalid_parameter_value', detail = 'field';
  end if;
  -- RG9: a revision on a published profile only (direct elsewhere; the guard refuses suspended)
  if v_status <> 'published' then
    raise exception 'profile_state'
      using errcode = 'object_not_in_prerequisite_state', detail = v_status;
  end if;
  if p_value is null then
    raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
  end if;

  -- the row of the field: none for the storefront, a uuid of the caller otherwise
  if p_field_code in ('creator.headline', 'creator.bio') then
    if p_row_key is not null then
      raise exception 'row_key' using errcode = 'invalid_parameter_value', detail = 'row_key';
    end if;
  else
    if p_row_key is null or p_row_key !~* c_uuid then
      raise exception 'row_key' using errcode = 'invalid_parameter_value', detail = 'row_key';
    end if;
    v_row := p_row_key::uuid;
    v_row_key := v_row::text;
  end if;

  if p_field_code in ('creator.headline', 'creator.bio') then
    -- the type and the required at the door, the constraints of the column at the approval (0244)
    if pg_catalog.jsonb_typeof(p_value) not in ('string', 'null') then
      raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
    end if;
    v_required := pg_catalog.split_part(p_field_code, '.', 2);
    if v_required = any (profiles.creator_missing_required_fields(
                           pg_catalog.jsonb_build_object(v_required, p_value))) then
      raise exception 'required field missing: %', v_required
        using errcode = 'check_violation', detail = v_required;
    end if;
    v_validated := case p_field_code when 'creator.headline' then pg_catalog.to_jsonb(v_headline)
                                     else pg_catalog.to_jsonb(v_bio) end;
  elsif p_field_code in ('creator.network_line', 'creator.network_handle', 'creator.network_url') then
    select n.id, n.handle, n.profile_url into v_line
      from profiles.creator_social_accounts n
     where n.id = v_row and n.account_id = v_account;
    if not found then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    v_listed := exists (select 1 from profiles.creator_public_networks c
                         where c.social_account_id = v_row and c.listed_at is not null);
    if p_field_code = 'creator.network_line' then
      -- EC-L2G-03-4: a line added to a published profile, listed by the decision
      if v_listed then
        raise exception 'row_key' using errcode = 'invalid_parameter_value', detail = 'row_key';
      end if;
      if p_value <> '{}'::jsonb then
        raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
      end if;
      v_validated := null;
    else
      if not v_listed then
        raise exception 'row_key' using errcode = 'invalid_parameter_value', detail = 'row_key';
      end if;
      -- modele point 6: the handle of a line holding an active « Compte vérifié » is immediate
      -- (queue 6 alone, 0233), never a revision
      if p_field_code = 'creator.network_handle'
         and exists (select 1 from verification.badges b
                      where b.account_id = v_account and b.social_account_id = v_row
                        and b.level = 'account_verified' and b.state = 'active') then
        raise exception 'field' using errcode = 'invalid_parameter_value', detail = 'field';
      end if;
      if pg_catalog.jsonb_typeof(p_value) <> 'string' then
        raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
      end if;
      -- RG16: a line of the profile keeps its handle and its URL
      if profiles.trimmed_char_length(p_value #>> '{}') = 0 then
        v_required := case p_field_code when 'creator.network_handle' then 'handle'
                                        else 'profile_url' end;
        raise exception 'required field missing: %', v_required
          using errcode = 'check_violation', detail = v_required;
      end if;
      v_validated := case p_field_code when 'creator.network_handle' then pg_catalog.to_jsonb(v_line.handle)
                                       else pg_catalog.to_jsonb(v_line.profile_url) end;
    end if;
  else
    -- creator.portfolio_caption: an approved visual of the caller (EC-L2G-03-5)
    select i.state::text as state, i.caption, i.brand_declaration_id into v_item
      from profiles.portfolio_items i
     where i.id = v_row and i.account_id = v_account;
    if not found then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    if v_item.state <> 'approved' then
      raise exception 'row_key' using errcode = 'invalid_parameter_value', detail = 'row_key';
    end if;
    if pg_catalog.jsonb_typeof(p_value) <> 'object'
       or (p_value - 'caption' - 'brand_declaration_id') <> '{}'::jsonb
       or not (p_value ? 'caption') or not (p_value ? 'brand_declaration_id')
       or pg_catalog.jsonb_typeof(p_value -> 'caption') not in ('string', 'null')
       or pg_catalog.jsonb_typeof(p_value -> 'brand_declaration_id') not in ('string', 'null') then
      raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
    end if;
    -- the statement named is one of this visual (written by set_own_portfolio_caption)
    if (p_value ->> 'brand_declaration_id') is not null
       and ((p_value ->> 'brand_declaration_id') !~* c_uuid
            or not exists (select 1 from profiles.portfolio_brand_declarations d
                            where d.id = (p_value ->> 'brand_declaration_id')::uuid
                              and d.portfolio_item_id = v_row and d.account_id = v_account)) then
      raise exception 'value' using errcode = 'invalid_parameter_value', detail = 'value';
    end if;
    v_validated := pg_catalog.jsonb_build_object('caption', v_item.caption,
                                                 'brand_declaration_id', v_item.brand_declaration_id);
  end if;

  select r.id, r.proposed_value, r.creator_review_entry_id
    into v_pending_id, v_pending_value, v_entry
    from profiles.creator_field_revisions r
   where r.account_id = v_account and r.field_code = p_field_code
     and coalesce(r.row_key, '') = coalesce(v_row_key, '') and r.status = 'pending_review';

  -- back to the validated value: the pending revision withdrawn, its revision entry when empty
  if p_value = v_validated then
    if v_pending_id is null then
      return query select null::profiles.revision_status, null::uuid;
      return;
    end if;
    update profiles.creator_field_revisions r
       set status = 'withdrawn', closed_at = pg_catalog.now()
     where r.id = v_pending_id;
    update profiles.creator_review_entries e
       set state = 'withdrawn', closed_at = pg_catalog.now()
     where e.id = v_entry and e.state = 'open' and e.kind = 'revision'
       and not exists (select 1 from profiles.creator_field_revisions r
                        where r.creator_review_entry_id = v_entry
                          and r.status = 'pending_review');
    perform audit.append('creator_profile.revision_withdrawn', 'creator_profile', v_account,
                         pg_catalog.jsonb_build_object('field_code', p_field_code,
                                                       'row_key', v_row_key, 'entry_id', v_entry));
    return query select 'withdrawn'::profiles.revision_status, v_entry;
    return;
  end if;

  if v_pending_id is not null then
    if v_pending_value = p_value then
      return query select 'pending_review'::profiles.revision_status, v_entry;
      return;
    end if;
    update profiles.creator_field_revisions r
       set status = 'superseded', closed_at = pg_catalog.now()
     where r.id = v_pending_id;
  else
    select e.id into v_entry
      from profiles.creator_review_entries e
     where e.account_id = v_account and e.state = 'open';
    if v_entry is null then
      insert into profiles.creator_review_entries (account_id, kind)
      values (v_account, 'revision')
      returning id into v_entry;
    end if;
  end if;

  insert into profiles.creator_field_revisions
    (account_id, field_code, row_key, proposed_value, creator_review_entry_id)
  values (v_account, p_field_code, v_row_key, p_value, v_entry);

  perform audit.append('creator_profile.revision_submitted', 'creator_profile', v_account,
                       pg_catalog.jsonb_build_object('field_code', p_field_code,
                                                     'row_key', v_row_key, 'entry_id', v_entry));
  return query select 'pending_review'::profiles.revision_status, v_entry;
end
$$;

comment on function profiles.submit_own_creator_revision(text, text, jsonb) is
  '07 RG9, CA48, CA49; l2g/modele point 6 (0243, the rules of 0209): an active creator proposes a '
  'change of a moderated field of his PUBLISHED profile; the live rows keep the validated value. '
  'p_field_code: creator.headline, creator.bio (p_row_key NULL, a JSON text), creator.network_handle '
  'and creator.network_url (a listed line of the caller, a JSON text), creator.network_line (an '
  'unlisted line, {}), creator.portfolio_caption (an approved visual, {"caption", '
  '"brand_declaration_id"}). In ONE transaction (the storefront locked): the revision deposited, the '
  'pending one of the field and row superseded, the entry of queue 2 joined or created (`revision`), '
  'creator_profile.revision_submitted {field_code, row_key, entry_id}; returns (pending_review, entry). '
  'The validated value: the pending revision withdrawn, its `revision` entry too when nothing is left, '
  'creator_profile.revision_withdrawn; returns (withdrawn, entry). The value already pending: '
  '(pending_review, entry), nothing written. Nothing to do: (NULL, NULL). 22023 field (unknown, '
  'inactive, or the handle of a line holding an active « Compte vérifié »), row_key, value; 23514 '
  'for a required field emptied (DETAIL its code); 55000 profile_state unless published; 42501 '
  'outside an active creator account, and for another''s line or visual as for an unknown one. '
  'SECURITY DEFINER owned by influx_creator_profile_definer, empty search_path; EXECUTE for '
  'influx_creator only.';

-- 10.4 The caption of a visual and the statement of RG83 (07 RG82, RG83; EC-L2G-03-5) -------------
create or replace function profiles.set_own_portfolio_caption(
  p_item_id         uuid,
  p_caption         text,
  p_brand_declared  boolean)
returns table (
  revision_status  profiles.revision_status,
  entry_id         uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account      uuid := influx.current_account_id();
  v_status       text;
  v_item         record;
  v_declaration  uuid;
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

  -- the profile first, as every door of the account; then the visual
  select p.status::text into v_status
    from profiles.creator_public_profiles p
   where p.account_id = v_account
     for update of p;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select i.state::text as state, i.caption, i.brand_declaration_id into v_item
    from profiles.portfolio_items i
   where i.id = p_item_id and i.account_id = v_account
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_item.state not in ('pending', 'approved') then
    raise exception 'item_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'item_state';
  end if;

  -- RG82: one line of 200 characters at most (EC-L2G-02-3); RG83: a box, never pre-ticked, and
  -- nothing to declare without a caption
  if p_brand_declared is null
     or (p_caption is not null
         and (pg_catalog.char_length(p_caption) not between 1 and 200
              or p_caption !~ '[^[:space:]]' or p_caption ~ '[[:cntrl:]]'))
     or (p_caption is null and p_brand_declared) then
    raise exception 'caption' using errcode = 'invalid_parameter_value', detail = 'caption';
  end if;

  -- the same caption and the same box: nothing new to declare
  if p_caption is not distinct from v_item.caption
     and p_brand_declared = (v_item.brand_declaration_id is not null) then
    if v_status = 'published' and v_item.state = 'approved' then
      return query
        select r.revision_status, r.entry_id
          from profiles.submit_own_creator_revision(
                 'creator.portfolio_caption', p_item_id::text,
                 pg_catalog.jsonb_build_object('caption', v_item.caption,
                                               'brand_declaration_id', v_item.brand_declaration_id)) r;
      return;
    end if;
    return query select null::profiles.revision_status, null::uuid;
    return;
  end if;

  -- RG83: the statement, timestamped and kept, for the caption declared
  if p_brand_declared then
    insert into profiles.portfolio_brand_declarations
      (account_id, portfolio_item_id, caption, statement_key)
    values (v_account, p_item_id, p_caption, 'creatorProfile.portfolio.brandConsent')
    returning id into v_declaration;
  end if;

  -- RG9: on a published profile the caption of an approved visual is re-validated
  if v_status = 'published' and v_item.state = 'approved' then
    return query
      select r.revision_status, r.entry_id
        from profiles.submit_own_creator_revision(
               'creator.portfolio_caption', p_item_id::text,
               pg_catalog.jsonb_build_object('caption', p_caption,
                                             'brand_declaration_id', v_declaration)) r;
    return;
  end if;

  update profiles.portfolio_items i
     set caption = p_caption, brand_declaration_id = v_declaration
   where i.id = p_item_id;
  return query select null::profiles.revision_status, null::uuid;
end
$$;

comment on function profiles.set_own_portfolio_caption(uuid, text, boolean) is
  '07 RG82, RG83, RG9; l2g/modele §3 (0243, EC-L2G-03-5): an active creator sets the caption of his '
  'pending or approved visual p_item_id (NULL removes it; 1 to 200 characters on one line) and the box '
  'of RG83 (p_brand_declared, never NULL; TRUE writes the statement, timestamped, under '
  'creatorProfile.portfolio.brandConsent). Direct, returns (NULL, NULL); on an approved visual of a '
  'PUBLISHED profile, a revision creator.portfolio_caption (profiles.submit_own_creator_revision), the '
  'validated caption served meanwhile; the same caption and box withdraw the pending one. 22023 '
  'caption; 55000 item_state for a visual neither pending nor approved; 42501 outside an active '
  'creator account, and for another''s visual as for an unknown one. SECURITY DEFINER owned by '
  'influx_creator_profile_definer, empty search_path; EXECUTE for influx_creator only.';

-- 10.5 The score after a save, lead.updated when published (07 RG86, RG106; modele §3) -------------
create or replace function profiles.record_own_creator_profile_change()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_status   text;
  v_score    smallint;
  v_event    uuid := pg_catalog.gen_random_uuid();
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select p.status::text into v_status
    from profiles.creator_public_profiles p
   where p.account_id = v_account;
  if not found then
    return false;
  end if;

  -- L2DS-4, RG86: the score recomputed by the base from what is stored, never sent by the API
  v_score := profiles.creator_completeness_percent(profiles.creator_profile_input(v_account));
  update profiles.creator_identities i
     set completeness_percent = v_score
   where i.account_id = v_account and i.completeness_percent is distinct from v_score;

  if v_status <> 'published' then
    return false;
  end if;
  -- 05 RG73, 07 RG106: in the transaction of the fact, the payload reduced to identifiers
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_event, 'lead.updated', d.destination, 'account:' || v_account::text, 100,
         pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_account),
         'lead.updated:' || v_event::text
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);
  return true;
end
$$;

comment on function profiles.record_own_creator_profile_change() is
  '07 RG86, RG106; l2g/modele §3 (0243, EC-L2G-03-7): after a save of the caller''s creator profile, '
  'the score recomputed (creator_completeness_percent of creator_profile_input) and stored in '
  'profiles.creator_identities; on a PUBLISHED profile, ONE lead.updated (priority 100) to '
  'brevo_contact and apollo_contact, payload = ids only, returns true; otherwise false. The API calls '
  'it once per save. 42501 outside a creator context. SECURITY DEFINER owned by '
  'influx_creator_profile_definer, empty search_path; EXECUTE for influx_creator only.';

-- 10.6 AFTER DELETE of a line: its pending revisions withdrawn (modele §3 "0243") -------------------
create or replace function profiles.withdraw_creator_revisions_of_line()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_revision  record;
begin
  for v_revision in
    update profiles.creator_field_revisions r
       set status = 'withdrawn', closed_at = pg_catalog.now()
     where r.account_id = old.account_id and r.row_key = old.id::text
       and r.field_code in ('creator.network_line', 'creator.network_handle', 'creator.network_url')
       and r.status = 'pending_review'
    returning r.field_code, r.creator_review_entry_id
  loop
    update profiles.creator_review_entries e
       set state = 'withdrawn', closed_at = pg_catalog.now()
     where e.id = v_revision.creator_review_entry_id and e.state = 'open' and e.kind = 'revision'
       and not exists (select 1 from profiles.creator_field_revisions r
                        where r.creator_review_entry_id = v_revision.creator_review_entry_id
                          and r.status = 'pending_review');
    perform audit.append('creator_profile.revision_withdrawn', 'creator_profile', old.account_id,
                         pg_catalog.jsonb_build_object('field_code', v_revision.field_code,
                                                       'row_key', old.id::text,
                                                       'entry_id', v_revision.creator_review_entry_id));
  end loop;
  return null;
end
$$;

comment on function profiles.withdraw_creator_revisions_of_line() is
  'AFTER DELETE on profiles.creator_social_accounts, never on the erasure (WHEN current_user <> '
  'influx_privacy_definer; 0245 owns it) (0243): the pending revisions of the line (network_line, '
  'network_handle, network_url) withdrawn, their `revision` entry too when nothing is left; '
  'creator_profile.revision_withdrawn {field_code, row_key, entry_id} for each. The creator deletes '
  'his own line: the policies of the owner bind it to his account. SECURITY DEFINER owned by '
  'influx_creator_profile_definer, empty search_path; no EXECUTE for anyone.';

drop trigger if exists creator_social_accounts_withdraw_revisions on profiles.creator_social_accounts;
create trigger creator_social_accounts_withdraw_revisions
  after delete on profiles.creator_social_accounts
  for each row when (current_user <> 'influx_privacy_definer')
  execute function profiles.withdraw_creator_revisions_of_line();

-- 10.7 BEFORE DELETE of a creator role (L2DS-6, modele point 15, EC-L2G-03-1) ----------------------
create or replace function profiles.refuse_creator_role_removal()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- the policy of 9.1 shows the owner every storefront that is not a draft
  if exists (select 1 from profiles.creator_public_profiles p
              where p.account_id = old.account_id and p.status <> 'draft') then
    raise exception 'creator_profile_not_draft'
      using errcode = 'object_not_in_prerequisite_state', detail = 'creator_profile_not_draft';
  end if;
  return old;
end
$$;

comment on function profiles.refuse_creator_role_removal() is
  'BEFORE DELETE on identity.account_roles, a creator role, never on the erasure (WHEN current_user '
  '<> influx_privacy_definer) (0243; L2DS-6; l2g/modele point 15; EC-L2G-03-1): a creator whose '
  'profile is not a draft keeps his role, 55000 creator_profile_not_draft; identity.change_member_role() '
  'refused so, in its own transaction. SECURITY DEFINER owned by influx_creator_profile_definer, empty '
  'search_path; no EXECUTE for anyone.';

drop trigger if exists account_roles_refuse_creator_removal on identity.account_roles;
create trigger account_roles_refuse_creator_removal
  before delete on identity.account_roles
  for each row when (old.role = 'creator' and current_user <> 'influx_privacy_definer')
  execute function profiles.refuse_creator_role_removal();

-- 11. The guard (§3 bis; L2DS-4; the model of 0209) ------------------------------------------------

create or replace function profiles.guard_creator_member_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_account  uuid;
  v_status   text;
  v_field    text;
  v_listed   boolean;
begin
  -- The two roles a creator acts under; the erasure, the purge, the derivations and the decisions are
  -- not members.
  if current_user not in ('influx_creator', 'influx_creator_profile_definer') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_table_name = 'creator_public_profiles' then
    -- a BEFORE ROW trigger sees the latest version of the row it updates
    v_status := old.status::text;
  else
    if tg_op = 'DELETE' then
      v_account := old.account_id;
    else
      v_account := new.account_id;
    end if;
    -- FOR SHARE: a decision (0244) waits for this write, or this write waits for the decision. No
    -- row (somebody else's account): the policy of the table refuses the write.
    select p.status::text into v_status
      from profiles.creator_public_profiles p
     where p.account_id = v_account
       for share of p;
  end if;

  if v_status = 'suspended' then
    raise exception 'profile_state'
      using errcode = 'object_not_in_prerequisite_state', detail = 'suspended';
  end if;

  if tg_table_name = 'creator_public_profiles' then
    -- 07 RG4, RG5: a member moves the status to pending_review, from draft or rejected, and nowhere else
    if new.status is distinct from old.status
       and not (new.status = 'pending_review' and old.status in ('draft', 'rejected')) then
      raise exception 'profile_state'
        using errcode = 'object_not_in_prerequisite_state', detail = 'status';
    end if;
    if new.published_at is distinct from old.published_at then
      raise exception 'profile_state'
        using errcode = 'object_not_in_prerequisite_state', detail = 'status';
    end if;
  end if;

  if v_status = 'published' then
    if tg_table_name = 'creator_public_profiles' then
      select c.code into v_field
        from (values
               ('creator.headline', new.headline is distinct from old.headline),
               ('creator.bio',      new.bio is distinct from old.bio)
             ) as c (code, changed)
       where c.changed and profiles.creator_moderated_field_is_active(c.code)
       limit 1;
    elsif tg_table_name = 'creator_social_accounts' then
      if tg_op = 'INSERT' then
        -- modele point 6: a line added is direct and unlisted, never the main one
        if new.is_primary and profiles.creator_moderated_field_is_active('creator.network_line') then
          v_field := 'creator.network_line';
        end if;
      elsif tg_op = 'UPDATE' then
        v_listed := exists (select 1 from profiles.creator_public_networks c
                             where c.social_account_id = old.id and c.listed_at is not null);
        if v_listed then
          if new.handle is distinct from old.handle
             and profiles.creator_moderated_field_is_active('creator.network_handle')
             and not exists (select 1 from verification.badges b
                              where b.account_id = old.account_id and b.social_account_id = old.id
                                and b.level = 'account_verified' and b.state = 'active') then
            v_field := 'creator.network_handle';
          elsif new.profile_url is distinct from old.profile_url
                and profiles.creator_moderated_field_is_active('creator.network_url') then
            v_field := 'creator.network_url';
          end if;
        elsif new.is_primary and not old.is_primary
              and profiles.creator_moderated_field_is_active('creator.network_line') then
          v_field := 'creator.network_line';
        end if;
      end if;
    elsif tg_table_name = 'portfolio_items' then
      -- the caption of an approved visual is the validated one
      if tg_op = 'UPDATE' and old.state = 'approved'
         and (new.caption is distinct from old.caption
              or new.brand_declaration_id is distinct from old.brand_declaration_id)
         and profiles.creator_moderated_field_is_active('creator.portfolio_caption') then
        v_field := 'creator.portfolio_caption';
      end if;
    end if;
    if v_field is not null then
      raise exception 'moderated_field'
        using errcode = 'object_not_in_prerequisite_state', detail = v_field;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

comment on function profiles.guard_creator_member_write() is
  'l2g/modele §3 bis, L2DS-4, 07 RG9 (0243): BEFORE trigger on the creator storefront, its five lists, '
  'the refused sectors, the network lines, the three exact audiences and the visuals. When '
  'current_user is influx_creator or influx_creator_profile_definer: suspended refuses every write '
  '(55000 profile_state DETAIL suspended); the status goes to pending_review from draft or rejected '
  'only, published_at never (DETAIL status); a PUBLISHED profile refuses the change of the headline, '
  'the bio, the caption of an approved visual, the handle (unless an active « Compte vérifié » on the '
  'line) and the URL of a listed line, a main line that is not listed (55000 moderated_field, the '
  'field code as DETAIL; an inactive code is not frozen). The profile is held FOR SHARE. SECURITY '
  'INVOKER (it reads current_user), empty search_path, executed by nobody directly.';

revoke all on function profiles.guard_creator_member_write()
  from public, anon, authenticated, service_role;

drop trigger if exists creator_member_write_guard on profiles.creator_public_profiles;
create trigger creator_member_write_guard
  before update on profiles.creator_public_profiles
  for each row execute function profiles.guard_creator_member_write();

do $$
declare
  t text;
begin
  foreach t in array array[
    'creator_topics', 'creator_publication_languages', 'creator_tones', 'creator_formats',
    'creator_usage_rights', 'creator_refused_sectors', 'creator_social_accounts',
    'creator_audience_countries', 'creator_audience_ages', 'creator_audience_genders',
    'portfolio_items']
  loop
    execute format('drop trigger if exists creator_member_write_guard on profiles.%I', t);
    execute format('create trigger creator_member_write_guard '
                   'before insert or update or delete on profiles.%I '
                   'for each row execute function profiles.guard_creator_member_write()', t);
  end loop;
end
$$;

-- 12. Rights and owners of the doors and of the triggers (03 P7 rule 5) ----------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'profiles.creator_moderated_field_is_active(text)',
    'profiles.submit_own_creator_profile()',
    'profiles.submit_own_creator_revision(text, text, jsonb)',
    'profiles.set_own_portfolio_caption(uuid, text, boolean)',
    'profiles.record_own_creator_profile_change()',
    'profiles.withdraw_creator_revisions_of_line()',
    'profiles.refuse_creator_role_removal()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', f);
  end loop;
end
$$;

grant execute on function
  profiles.creator_moderated_field_is_active(text),
  profiles.submit_own_creator_profile(),
  profiles.submit_own_creator_revision(text, text, jsonb),
  profiles.set_own_portfolio_caption(uuid, text, boolean),
  profiles.record_own_creator_profile_change()
  to influx_creator;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_profile_definer', current_user);
end
$$;
grant create on schema profiles to influx_creator_profile_definer;

alter function profiles.creator_moderated_field_is_active(text)
  owner to influx_creator_profile_definer;
alter function profiles.submit_own_creator_profile()
  owner to influx_creator_profile_definer;
alter function profiles.submit_own_creator_revision(text, text, jsonb)
  owner to influx_creator_profile_definer;
alter function profiles.set_own_portfolio_caption(uuid, text, boolean)
  owner to influx_creator_profile_definer;
alter function profiles.record_own_creator_profile_change()
  owner to influx_creator_profile_definer;
alter function profiles.withdraw_creator_revisions_of_line()
  owner to influx_creator_profile_definer;
alter function profiles.refuse_creator_role_removal()
  owner to influx_creator_profile_definer;

revoke create on schema profiles from influx_creator_profile_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_profile_definer', current_user);
end
$$;

-- 13. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  -- NON REVERSIBLE (fiche invariants 1, 16; modele -4): neither the advertiser nor the owner of the
  -- brand doors reaches a table of this file, nor executes a function of it
  select string_agg(r || ' on ' || t, ', ') into v_bad
    from unnest(array['influx_advertiser', 'influx_identity_definer']) r,
         unnest(array['profiles.creator_review_entries', 'profiles.creator_field_revisions',
                      'profiles.creator_rejection_reasons']) t
   where pg_catalog.has_table_privilege(r, t,
                                        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
      or pg_catalog.has_any_column_privilege(r, t, 'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'right on a table of queue 2: %', v_bad;
  end if;
  select string_agg(r || ' on ' || p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p,
         unnest(array['influx_advertiser', 'influx_identity_definer']) r
   where p.oid in ('profiles.creator_moderated_field_is_active(text)'::regprocedure,
                   'profiles.submit_own_creator_profile()'::regprocedure,
                   'profiles.submit_own_creator_revision(text, text, jsonb)'::regprocedure,
                   'profiles.set_own_portfolio_caption(uuid, text, boolean)'::regprocedure,
                   'profiles.record_own_creator_profile_change()'::regprocedure,
                   'profiles.trimmed_char_length(text)'::regprocedure,
                   'profiles.creator_missing_required_fields(jsonb)'::regprocedure,
                   'profiles.creator_completeness_percent(jsonb)'::regprocedure,
                   'profiles.creator_profile_input(uuid)'::regprocedure)
     and pg_catalog.has_function_privilege(r, p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'EXECUTE on a function of the creator submission: %', v_bad;
  end if;
  -- the listing of a line: no column right for the advertiser (T9.6)
  if pg_catalog.has_column_privilege('influx_advertiser', 'profiles.creator_public_networks',
                                     'listed_at', 'SELECT, INSERT, UPDATE') then
    raise exception 'influx_advertiser reaches profiles.creator_public_networks.listed_at';
  end if;

  -- the doors: their owner, SECURITY DEFINER, empty search_path, EXECUTE for influx_creator only
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('profiles.creator_moderated_field_is_active(text)'::regprocedure,
                   'profiles.submit_own_creator_profile()'::regprocedure,
                   'profiles.submit_own_creator_revision(text, text, jsonb)'::regprocedure,
                   'profiles.set_own_portfolio_caption(uuid, text, boolean)'::regprocedure,
                   'profiles.record_own_creator_profile_change()'::regprocedure,
                   'profiles.withdraw_creator_revisions_of_line()'::regprocedure,
                   'profiles.refuse_creator_role_removal()'::regprocedure)
     and (p.proowner <> 'influx_creator_profile_definer'::regrole or not p.prosecdef
          or p.proconfig is distinct from array['search_path=""']
          or pg_catalog.has_function_privilege('influx_agent', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('influx_admin', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('influx_worker', p.oid, 'EXECUTE'));
  if v_bad is not null then
    raise exception 'doors of the creator submission with a wrong owner, mode or EXECUTE: %', v_bad;
  end if;
  if pg_catalog.has_function_privilege('influx_creator',
                                       'profiles.withdraw_creator_revisions_of_line()', 'EXECUTE')
     or pg_catalog.has_function_privilege('influx_creator',
                                          'profiles.refuse_creator_role_removal()', 'EXECUTE') then
    raise exception 'a trigger function of 0243 is executable by influx_creator';
  end if;

  -- the guard: SECURITY INVOKER, empty search_path, on its twelve tables
  if (select prosecdef from pg_catalog.pg_proc
       where oid = 'profiles.guard_creator_member_write()'::regprocedure)
     or (select proconfig from pg_catalog.pg_proc
          where oid = 'profiles.guard_creator_member_write()'::regprocedure)
          is distinct from array['search_path=""'] then
    raise exception 'profiles.guard_creator_member_write() must be SECURITY INVOKER, empty search_path';
  end if;
  if (select count(*) from pg_catalog.pg_trigger t
       where t.tgname = 'creator_member_write_guard' and t.tgenabled = 'O'
         and t.tgfoid = 'profiles.guard_creator_member_write()'::regprocedure) <> 12 then
    raise exception 'the guard must fire on the twelve tables of a creator profile';
  end if;

  -- L2DS-4: the score is no member write
  if pg_catalog.has_column_privilege('influx_creator', 'profiles.creator_identities',
                                     'completeness_percent', 'UPDATE') then
    raise exception 'influx_creator still writes profiles.creator_identities.completeness_percent';
  end if;

  -- no execution role writes the entries nor the revisions directly
  select string_agg(r || ' ' || p || ' ' || t, ', ') into v_bad
    from unnest(array['profiles.creator_rejection_reasons', 'profiles.creator_review_entries',
                      'profiles.creator_field_revisions']) t,
         unnest(array['influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin',
                      'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy']) r,
         unnest(array['INSERT', 'UPDATE', 'DELETE']) p
   where pg_catalog.has_table_privilege(r, t, p)
      or (p <> 'DELETE' and pg_catalog.has_any_column_privilege(r, t, p));
  if v_bad is not null then
    raise exception 'execution role(s) writing a table of queue 2: %', v_bad;
  end if;

  -- 03 P8: RLS enabled and forced on the three tables
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid in ('profiles.creator_rejection_reasons'::regclass,
                   'profiles.creator_review_entries'::regclass,
                   'profiles.creator_field_revisions'::regclass)
     and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not forced on: %', v_bad;
  end if;

  -- the owner left without a member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = 'influx_creator_profile_definer'::regrole
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege('influx_creator_profile_definer', 'profiles', 'CREATE') then
    raise exception 'influx_creator_profile_definer left with a member or CREATE on profiles';
  end if;
end
$$;
