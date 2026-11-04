-- =============================================================================
-- 0207_profiles_revisions_and_review_entries
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 05 (jalons/l2c/file.md A1, A4, A6, D81; 04 §3.1, §5.2 "La dernière version
-- validée survit"; 06 RG9, RG63 to RG68; 15 RG26, RG38). The objects of queue 1, without any
-- decision: the decision functions, their owner influx_moderation_definer and the forced release
-- reasons come with 07; the freeze of a published profile and the member revision door with 06.
--
--   profiles.profile_kind, profiles.revision_status, profiles.review_entry_kind,
--   profiles.review_entry_state   the four enums of file.md A1, A4 and 04 §5.2.
--   profiles.moderated_fields     the closed list of what is re-validated on a published profile
--         (04 §5.2, 06 RG9): the six advertiser codes of file.md A4, label_key = 'field.' || code.
--   profiles.advertiser_rejection_reasons   the closed list of 06 RG66 (04 §3.1: one table per
--         queue), the eight codes of file.md A6; `other` alone requires_member_message.
--   profiles.advertiser_review_entries   one entry of queue 1 per examination (file.md A1): at most
--         one open per account (unique partial index), its lock, its deadlines frozen at creation by
--         backoffice.business_deadline() (BEFORE INSERT trigger, 04 §5.6), its global decision
--         (RG65), sla_breached generated (04 l. 2238); queue index (sla_due_at, created_at) of the
--         open entries.
--   profiles.profile_field_revisions   a submitted value of a moderated field, attached to its
--         entry (composite key: same account), without lock, decision, reason nor deadline (A1);
--         one pending revision per field and child row (04 l. 1465).
--   profiles.advertiser_review_token(account)   the version token of file.md A3: the SHA-256 (hex)
--         of what the agent examines (profile, eight lists, contact person, active and in_review
--         logos, pending revisions), never stored. SECURITY INVOKER, executed by nobody here: its
--         callers (07) receive EXECUTE with their owner.
--   profiles.submit_own_advertiser_profile()   recreated: in its transaction, the submission opens
--         the entry `submission` (or keeps the open one), the line profile.submitted carries
--         entry_id. Refusals, return type and the other rules of 0203 unchanged.
--   Rights: RLS enabled and forced, nothing for public, anon, authenticated, service_role. The
--         brand reads its own entries (never the lock, the agents, the deadlines nor the internal
--         comment) and its own revisions; agent and admin read both in aal2, never the rows of
--         their own account (15 RG36, C(3)), and the two catalogues; nobody writes them directly.
--         influx_identity_definer opens an entry (account, kind) for the caller's own row, reads
--         the delay of queue 1 and executes business_deadline() (through the trigger).
--   Rights of the data subject (04 §9.2; file.md A1): privacy.export_document() and
--         privacy.execute_request() recreated FROM THEIR 0204 VERSION by influx_privacy_definer.
--         Export: advertiser_profile also carries review_entries (kind, state, dates, reason,
--         message to the brand; never the internal comment, an agent nor the lock) and
--         field_revisions. Erasure: the revisions deleted, the texts of the entries emptied, the
--         open entry withdrawn (closed now); the entries kept, pseudonymous (04 §9.2 "Ce qui
--         survit": the trace of a human decision, 06 RG6).
--
-- EC-L2C-05 (micro-gaps, the safest choice):
--   EC-L2C-05-1  0207 is the next free number (ls supabase/migrations); 04 §11 planned 0207
--                profiles_revisions, the name kept with its entries.
--   EC-L2C-05-2  forced_release_reason_code has no foreign key yet: backoffice.claim_release_reasons
--                (file.md A8) arrives with the forced release (07), which adds the key.
--   EC-L2C-05-3  the deadlines are written by a BEFORE INSERT trigger (created_at, sla_due_at,
--                escalate_at from the policy in force), never by the caller: the doors of 05 and 06
--                insert (account_id, kind) only, and the computation exists once (04 §5.6).
--   EC-L2C-05-4  member_message: 20 to 500 characters, internal_comment: 1 to 1 000, both printable
--                (line breaks and tabs kept, as the presentation, EC-L2B-05-3), not blank; the
--                message only on a rejected entry. "Required for `other`" is a rule of the decision
--                (07, requires_member_message), not a CHECK: the erasure empties the text.
--   EC-L2C-05-5  row_key: 1 to 100 characters; proposed_value: 8 000 bytes at most (04 l. 1454).
--   EC-L2C-05-6  the token also covers the country of the account (identity.accounts.country_code,
--                a field of the profile, RG15) and excludes status, dates and completeness (no
--                content): a decision or a touch does not make a token stale (file.md A3).
--   EC-L2C-05-7  the brand reads neither sla_due_at, escalate_at nor sla_breached (internal
--                pilotage, 15 RG26); the export carries them neither.
--   EC-L2C-05-8  the export and erasure cases of the entries live in t8-privacy-execution.test.ts,
--                beside those of the profile and the logo (its helpers approve and execute E-5).
--
-- ROLLBACK (before any entry is written): recreate privacy.export_document() and
-- privacy.execute_request() as in 0204 (as influx_privacy_definer) and
-- profiles.submit_own_advertiser_profile() as in 0203 (as influx_identity_definer); drop function
-- profiles.advertiser_review_token(uuid) and profiles.prepare_advertiser_review_entry(); drop table
-- profiles.profile_field_revisions, profiles.advertiser_review_entries,
-- profiles.advertiser_rejection_reasons, profiles.moderated_fields; drop type
-- profiles.review_entry_state, profiles.review_entry_kind, profiles.revision_status,
-- profiles.profile_kind; drop policy sla_policies_identity_definer_select_queue_1; revoke select
-- (escalate_after_minutes) on backoffice.sla_policies and execute on
-- backoffice.business_deadline(text, timestamptz, integer) from influx_identity_definer.
-- =============================================================================

-- 1. The four enums (04 §3.1: the code branches on them) -----------------------------------------

do $$
begin
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'profile_kind' and t.typnamespace = 'profiles'::regnamespace) then
    create type profiles.profile_kind as enum ('advertiser', 'creator');
  end if;
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'revision_status' and t.typnamespace = 'profiles'::regnamespace) then
    create type profiles.revision_status as enum
      ('pending_review', 'approved', 'rejected', 'withdrawn', 'superseded');
  end if;
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'review_entry_kind' and t.typnamespace = 'profiles'::regnamespace) then
    create type profiles.review_entry_kind as enum ('submission', 'revision');
  end if;
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'review_entry_state' and t.typnamespace = 'profiles'::regnamespace) then
    create type profiles.review_entry_state as enum ('open', 'published', 'rejected', 'withdrawn');
  end if;
end
$$;

comment on type profiles.profile_kind is
  'The two kinds of profile (04 §5.2): advertiser, creator. Prefix of the codes of moderated_fields.';
comment on type profiles.revision_status is
  'Life of a submitted value (04 §5.2, file.md A3): pending_review (waiting for the decision of its '
  'entry), approved (applied by the decision), rejected, withdrawn (back to the validated value, or '
  'the account erased), superseded (replaced by a later value of the same field).';
comment on type profiles.review_entry_kind is
  'What an entry of queue 1 examines (file.md A1): submission (a profile never published, or '
  'submitted again after a refusal), revision (moderated fields changed on a published profile).';
comment on type profiles.review_entry_state is
  'State of an entry of queue 1 (file.md A1): open (in the queue), published, rejected (decided by '
  'an agent or an admin, 06 RG6, RG65), withdrawn (nothing left to examine, or the account erased).';

-- 2. profiles.moderated_fields (04 §5.2; 06 RG9; file.md A4) --------------------------------------

create table if not exists profiles.moderated_fields (
  code          text                  not null primary key,
  profile_kind  profiles.profile_kind not null,
  target_table  text                  not null,
  label_key     text                  not null,
  is_active     boolean               not null default true,

  constraint moderated_fields_code_shape
    check (code ~ '^(advertiser|creator)\.[a-z][a-z_]*[a-z]$'),
  constraint moderated_fields_code_kind
    check (pg_catalog.split_part(code, '.', 1) = profile_kind::text),
  constraint moderated_fields_target_table
    check (target_table ~ '^profiles\.[a-z][a-z_]*[a-z]$'),
  constraint moderated_fields_label_key check (label_key = 'field.' || code)
);

comment on table profiles.moderated_fields is
  'The closed list of the profile fields whose change on a PUBLISHED profile is re-validated (04 '
  '§5.2, 06 RG9, file.md A4): the change waits in profiles.profile_field_revisions, the live row '
  'keeps the validated value. A table, not an enum: a field is deactivated without migration (04 '
  '§3.1). Advertiser codes: brand_name (column legal_name), logo (profiles.brand_logo_objects), '
  'presentation, website_domain, contact_role, primary_sector (main sector only; secondary sectors '
  'and countries are immediate, RG13). Read by agent and admin in aal2; written by the migrations.';
comment on column profiles.moderated_fields.target_table is
  'The table that carries the validated value, for the application of an approved revision (07).';
comment on column profiles.moderated_fields.label_key is
  'Translation key of the field (R8): field.<code>.';

insert into profiles.moderated_fields (code, profile_kind, target_table, label_key) values
  ('advertiser.brand_name',     'advertiser', 'profiles.advertiser_profiles',
   'field.advertiser.brand_name'),
  ('advertiser.logo',           'advertiser', 'profiles.brand_logo_objects',
   'field.advertiser.logo'),
  ('advertiser.presentation',   'advertiser', 'profiles.advertiser_profiles',
   'field.advertiser.presentation'),
  ('advertiser.website_domain', 'advertiser', 'profiles.advertiser_profiles',
   'field.advertiser.website_domain'),
  ('advertiser.contact_role',   'advertiser', 'profiles.advertiser_profiles',
   'field.advertiser.contact_role'),
  ('advertiser.primary_sector', 'advertiser', 'profiles.advertiser_profiles',
   'field.advertiser.primary_sector')
on conflict (code) do nothing;

-- 3. profiles.advertiser_rejection_reasons (04 §3.1; 06 RG66 to RG68; file.md A6) -------------------

create table if not exists profiles.advertiser_rejection_reasons (
  code                     text     not null primary key,
  label_key                text     not null,
  message_key              text     not null,
  requires_member_message  boolean  not null default false,
  position                 smallint not null,
  is_active                boolean  not null default true,

  constraint advertiser_rejection_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint advertiser_rejection_reasons_label_key
    check (label_key = 'reason.profiles_advertiser.' || code),
  constraint advertiser_rejection_reasons_message_key
    check (message_key = 'profileDecision.reason.' || code),
  constraint advertiser_rejection_reasons_position check (position > 0),
  constraint advertiser_rejection_reasons_position_unique unique (position)
);

comment on table profiles.advertiser_rejection_reasons is
  'The closed list of the refusal reasons of queue 1 (06 RG66, file.md A6; 04 §3.1: one table per '
  'queue). A refusal is never mute (RG10): profiles.advertiser_review_entries.rejection_reason_code '
  'references it. Read by agent and admin in aal2; written by the migrations.';
comment on column profiles.advertiser_rejection_reasons.label_key is
  'Translation key of the reason in the backoffice: reason.profiles_advertiser.<code>.';
comment on column profiles.advertiser_rejection_reasons.message_key is
  'Key of the message sent to the brand (06 RG66), in apps/api/src/locales/{fr,en}/email.json: '
  'profileDecision.reason.<code>; served to the e-mail (09), the preview (11) and the member (13).';
comment on column profiles.advertiser_rejection_reasons.requires_member_message is
  'The reason requires the message written by the agent to the brand (06 RG66 "Autre"): `other` '
  'only; checked by the decision (07), the text bounded by the entry (20 to 500 characters).';
comment on column profiles.advertiser_rejection_reasons.position is
  'Order of the list on the decision screen (17b §4.3).';

insert into profiles.advertiser_rejection_reasons
  (code, label_key, message_key, requires_member_message, position)
values
  ('contact_in_public_field',   'reason.profiles_advertiser.contact_in_public_field',
   'profileDecision.reason.contact_in_public_field',   false, 1),
  ('presentation_insufficient', 'reason.profiles_advertiser.presentation_insufficient',
   'profileDecision.reason.presentation_insufficient', false, 2),
  ('logo_non_compliant',        'reason.profiles_advertiser.logo_non_compliant',
   'profileDecision.reason.logo_non_compliant',        false, 3),
  ('misleading_brand_name',     'reason.profiles_advertiser.misleading_brand_name',
   'profileDecision.reason.misleading_brand_name',     false, 4),
  ('sector_inconsistent',       'reason.profiles_advertiser.sector_inconsistent',
   'profileDecision.reason.sector_inconsistent',       false, 5),
  ('illicit_content',           'reason.profiles_advertiser.illicit_content',
   'profileDecision.reason.illicit_content',           false, 6),
  ('duplicate_brand',           'reason.profiles_advertiser.duplicate_brand',
   'profileDecision.reason.duplicate_brand',           false, 7),
  ('other',                     'reason.profiles_advertiser.other',
   'profileDecision.reason.other',                     true,  8)
on conflict (code) do nothing;

-- 4. profiles.advertiser_review_entries (file.md A1; 04 §5.6; 15 RG26, RG27) ----------------------

create table if not exists profiles.advertiser_review_entries (
  id                                uuid        not null primary key default gen_random_uuid(),
  account_id                        uuid        not null
                                                references profiles.advertiser_profiles (account_id),
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
  -- EC-L2C-05-2: references backoffice.claim_release_reasons from 07
  forced_release_reason_code        text,
  decided_by_account_id             uuid        references identity.accounts (id),
  decided_at                        timestamptz,
  rejection_reason_code             text        references profiles.advertiser_rejection_reasons (code),
  member_message                    text,
  internal_comment                  text,
  closed_at                         timestamptz,
  -- 04 l. 2238: the decision came after the deadline (C8: a late decision is possible, and marked)
  sla_breached                      boolean     not null
                                                generated always as
                                                  (decided_at is not null and decided_at > sla_due_at)
                                                stored,
  updated_at                        timestamptz not null default now(),

  -- the key of the revisions: a revision belongs to an entry of ITS account
  constraint advertiser_review_entries_id_account unique (id, account_id),
  -- open, and only open, is not closed
  constraint advertiser_review_entries_closed check ((state = 'open') = (closed_at is null)),
  constraint advertiser_review_entries_closed_after check (closed_at >= created_at),
  -- RG6, RG65: published and rejected, and only they, carry a human decision, whole
  constraint advertiser_review_entries_decided
    check ((state in ('published', 'rejected')) = (decided_by_account_id is not null)),
  constraint advertiser_review_entries_decided_together
    check ((decided_by_account_id is null) = (decided_at is null)),
  constraint advertiser_review_entries_decided_after check (decided_at >= created_at),
  -- RG10, RG65: a refusal is never mute; a reason on a refusal only
  constraint advertiser_review_entries_rejection_reason
    check ((state = 'rejected') = (rejection_reason_code is not null)),
  -- EC-L2C-05-4: the message to the brand, on a refusal only, 20 to 500 printable characters
  constraint advertiser_review_entries_member_message_rejected
    check (member_message is null or state = 'rejected'),
  constraint advertiser_review_entries_member_message_length
    check (char_length(member_message) between 20 and 500),
  constraint advertiser_review_entries_member_message_text
    check (member_message ~ '[^[:space:]]'
           and member_message !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- EC-L2C-05-4: the internal comment, never sent to the brand, 1 000 printable characters at most
  constraint advertiser_review_entries_internal_comment_length
    check (char_length(internal_comment) between 1 and 1000),
  constraint advertiser_review_entries_internal_comment_text
    check (internal_comment ~ '[^[:space:]]'
           and internal_comment !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- 15 RG27 C1 to C3: a claim is whole (holder, instant, expiry), its expiry after it
  constraint advertiser_review_entries_claim_together
    check ((claimed_by_account_id is null) = (claimed_at is null)
           and (claimed_at is null) = (claim_expires_at is null)),
  constraint advertiser_review_entries_claim_expiry check (claim_expires_at > claimed_at),
  -- 15 C4: the last forced release is whole (instant, admin, dispossessed holder, reason)
  constraint advertiser_review_entries_forced_release_together
    check (pg_catalog.num_nulls(forced_release_at, forced_release_by_account_id,
                                forced_release_holder_account_id, forced_release_reason_code)
           in (0, 4)),
  -- 04 §5.6: the deadlines follow the entry
  constraint advertiser_review_entries_sla_after check (sla_due_at >= created_at),
  constraint advertiser_review_entries_escalate_after check (escalate_at >= sla_due_at)
);

-- file.md A1: at most one open entry per account
create unique index if not exists advertiser_review_entries_one_open
  on profiles.advertiser_review_entries (account_id) where state = 'open';
-- the queue (15 RG26: oldest deadline first)
create index if not exists advertiser_review_entries_queue_idx
  on profiles.advertiser_review_entries (sla_due_at, created_at) where state = 'open';
-- the history of an account (the brand's own reads, the record of the account)
create index if not exists advertiser_review_entries_account_idx
  on profiles.advertiser_review_entries (account_id, created_at);

comment on table profiles.advertiser_review_entries is
  'Queue 1 (15 RG29 profiles_advertiser; 06 RG63 to RG72; file.md A1, D81): one entry per '
  'examination of a brand profile, a first submission or the revision of moderated fields; at most '
  'one open per account. Carries the lock (15 RG27), the deadlines frozen at creation (04 §5.6, '
  'trigger), the global decision (RG65) and its reason; the revisions attach to it. Opened by the '
  'member doors (0207 submission, 06 revision, influx_identity_definer); decided by the functions '
  'of 07 only. Read by the brand (its own, without lock, agent, deadlines nor internal comment) and '
  'by agent and admin in aal2, never on their own account (15 RG36). Erasure: texts emptied, an '
  'open entry withdrawn, the row kept (04 §9.2).';
comment on column profiles.advertiser_review_entries.sla_due_at is
  'Decision deadline, frozen at creation: backoffice.business_deadline(profiles_advertiser, '
  'created_at, target_decision_minutes) of the policy in force then (04 §5.6, R7). Never recomputed.';
comment on column profiles.advertiser_review_entries.escalate_at is
  'Escalation instant, frozen at creation: business_deadline(profiles_advertiser, sla_due_at, '
  'escalate_after_minutes) (06 RG7: 3 business days of age); NULL when the policy has none.';
comment on column profiles.advertiser_review_entries.claim_expires_at is
  'End of the claim: claimed_at + claim_expiry_minutes (backoffice.operational_settings, file.md '
  'A9). Held <=> a holder and claim_expires_at > now(); computed at the read, no task.';
comment on column profiles.advertiser_review_entries.member_message is
  'Message written by the agent to the brand (06 RG66 "Autre"), plain text, 20 to 500 characters, '
  'on a refusal only; checked for coordinates by apps/api (RG19). Emptied by the erasure.';
comment on column profiles.advertiser_review_entries.internal_comment is
  'Comment of the agent (06 RG68), 1 000 characters at most, NEVER shown to the brand, sent by '
  'e-mail, written to the register nor exported. Emptied by the erasure.';
comment on column profiles.advertiser_review_entries.sla_breached is
  'Generated: decided after sla_due_at (04 l. 2238; 15 C8, a late decision is marked).';

drop trigger if exists advertiser_review_entries_touch_updated_at
  on profiles.advertiser_review_entries;
create trigger advertiser_review_entries_touch_updated_at
  before update on profiles.advertiser_review_entries
  for each row execute function influx.touch_updated_at();

-- 4.1 The deadlines, written once, at the creation (04 §5.6; EC-L2C-05-3) ----------------------------

create or replace function profiles.prepare_advertiser_review_entry()
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
   where p.queue_code = 'profiles_advertiser' and p.is_active;
  if not found then
    raise exception 'queue profiles_advertiser has no active delay policy'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  new.created_at  := pg_catalog.now();
  new.updated_at  := pg_catalog.now();
  new.sla_due_at  := backoffice.business_deadline('profiles_advertiser', new.created_at, v_decision);
  new.escalate_at := backoffice.business_deadline('profiles_advertiser', new.sla_due_at, v_escalate);
  return new;
end
$$;

comment on function profiles.prepare_advertiser_review_entry() is
  'BEFORE INSERT on profiles.advertiser_review_entries: created_at = now(), sla_due_at and '
  'escalate_at computed ONCE from the policy of profiles_advertiser in force (04 §5.6, D39), '
  'whatever the writer gave. 55000 when the queue has no active policy. SECURITY INVOKER: the '
  'writer (influx_identity_definer) reads the policy and executes business_deadline() with its '
  'own rights.';

revoke all on function profiles.prepare_advertiser_review_entry()
  from public, anon, authenticated, service_role;

drop trigger if exists advertiser_review_entries_prepare on profiles.advertiser_review_entries;
create trigger advertiser_review_entries_prepare
  before insert on profiles.advertiser_review_entries
  for each row execute function profiles.prepare_advertiser_review_entry();

-- 5. profiles.profile_field_revisions (04 §5.2 l. 1448-1473, file.md A1) ------------------------

create table if not exists profiles.profile_field_revisions (
  id                          uuid        not null primary key default gen_random_uuid(),
  account_id                  uuid        not null references identity.accounts (id),
  field_code                  text        not null references profiles.moderated_fields (code),
  row_key                     text,
  proposed_value              jsonb       not null,
  status                      profiles.revision_status not null default 'pending_review',
  submitted_at                timestamptz not null default now(),
  advertiser_review_entry_id  uuid        not null,
  closed_at                   timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- file.md A1: the revision belongs to an entry of the same account
  constraint profile_field_revisions_entry_fk
    foreign key (advertiser_review_entry_id, account_id)
    references profiles.advertiser_review_entries (id, account_id),
  -- 04 l. 1454
  constraint profile_field_revisions_value_size
    check (pg_catalog.pg_column_size(proposed_value) <= 8000),
  -- EC-L2C-05-5
  constraint profile_field_revisions_row_key check (char_length(row_key) between 1 and 100),
  -- pending, and only pending, is not closed
  constraint profile_field_revisions_closed
    check ((status = 'pending_review') = (closed_at is null)),
  constraint profile_field_revisions_closed_after check (closed_at >= submitted_at)
);

-- 04 l. 1465: one pending revision per field (and child row); a new value supersedes the old one
create unique index if not exists profile_field_revisions_pending_idx
  on profiles.profile_field_revisions (account_id, field_code, coalesce(row_key, ''))
  where status = 'pending_review';
create index if not exists profile_field_revisions_entry_idx
  on profiles.profile_field_revisions (advertiser_review_entry_id);

comment on table profiles.profile_field_revisions is
  'Submitted values of moderated fields, WAITING for the decision of their entry (04 §5.2, 06 RG9, '
  'file.md A1): the live row of the profile always carries the last VALIDATED version, a profile '
  'never becomes invisible because its owner corrected a typo. Attached to an entry of queue 1 of '
  'the same account; no lock, decision, reason nor deadline of its own (those of the entry). At the '
  'approval, the decision (07) applies the value to the target table and passes the revision to '
  'approved in the same transaction. Written by the member door of 06 only; read by the owner and '
  'by agent and admin in aal2. Deleted by the erasure.';
comment on column profiles.profile_field_revisions.row_key is
  'Discriminant when the field lives on a child row (a network, a portfolio item); NULL for the '
  'brand fields.';
comment on column profiles.profile_field_revisions.proposed_value is
  'The submitted value, not the published one; 8 000 bytes at most.';

drop trigger if exists profile_field_revisions_touch_updated_at on profiles.profile_field_revisions;
create trigger profile_field_revisions_touch_updated_at
  before update on profiles.profile_field_revisions
  for each row execute function influx.touch_updated_at();

-- 6. Row level security and the rights of the business roles ----------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['moderated_fields', 'advertiser_rejection_reasons',
                           'advertiser_review_entries', 'profile_field_revisions']
  loop
    execute format('alter table profiles.%I enable row level security', t);
    execute format('alter table profiles.%I force row level security', t);
    execute format('revoke all on profiles.%I from public, anon, authenticated, service_role', t);
  end loop;
end
$$;

-- 6.1 The two catalogues: agent and admin, aal2 (15 RG26) -----------------------------------------

grant select on profiles.moderated_fields, profiles.advertiser_rejection_reasons
   to influx_agent, influx_admin;

drop policy if exists moderated_fields_internal_select on profiles.moderated_fields;
create policy moderated_fields_internal_select on profiles.moderated_fields
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop policy if exists advertiser_rejection_reasons_internal_select
  on profiles.advertiser_rejection_reasons;
create policy advertiser_rejection_reasons_internal_select on profiles.advertiser_rejection_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 6.2 The entries: the brand its own, without the lock, the agents nor the internal comment ------

grant select (id, account_id, kind, state, created_at, decided_at, rejection_reason_code,
              member_message, closed_at, updated_at)
   on profiles.advertiser_review_entries to influx_advertiser;
grant select on profiles.advertiser_review_entries to influx_agent, influx_admin;

drop policy if exists advertiser_review_entries_member_select_own
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_member_select_own on profiles.advertiser_review_entries
  for select to influx_advertiser
  using (account_id = (select influx.current_account_id()));

-- 15 RG36, C(3): an internal never sees an entry of his own account
drop policy if exists advertiser_review_entries_internal_select
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_internal_select on profiles.advertiser_review_entries
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 6.3 The revisions: the owner, agent and admin in aal2 (never their own account) -----------------

grant select on profiles.profile_field_revisions to influx_advertiser, influx_agent, influx_admin;

drop policy if exists profile_field_revisions_member_select_own on profiles.profile_field_revisions;
create policy profile_field_revisions_member_select_own on profiles.profile_field_revisions
  for select to influx_advertiser
  using (account_id = (select influx.current_account_id()));

drop policy if exists profile_field_revisions_internal_select on profiles.profile_field_revisions;
create policy profile_field_revisions_internal_select on profiles.profile_field_revisions
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 6.4 The owner of the member doors: opens an entry of the caller's own row --------------------

grant select (id, account_id, kind, state) on profiles.advertiser_review_entries
   to influx_identity_definer;
grant insert (account_id, kind) on profiles.advertiser_review_entries to influx_identity_definer;

drop policy if exists advertiser_review_entries_identity_definer_select
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_identity_definer_select
  on profiles.advertiser_review_entries
  for select to influx_identity_definer
  using (account_id = (select influx.current_account_id()));

drop policy if exists advertiser_review_entries_identity_definer_insert
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_identity_definer_insert
  on profiles.advertiser_review_entries
  for insert to influx_identity_definer
  with check (account_id = (select influx.current_account_id()) and state = 'open');

-- the trigger of 4.1 runs with the writer's rights: the delay of queue 1 and its computation
grant select (escalate_after_minutes) on backoffice.sla_policies to influx_identity_definer;
-- 0130 grants queue_code, business_hours, is_active, target_decision_minutes; its policy reads
-- dual_control_pending only
drop policy if exists sla_policies_identity_definer_select_queue_1 on backoffice.sla_policies;
create policy sla_policies_identity_definer_select_queue_1 on backoffice.sla_policies
  for select to influx_identity_definer
  using (queue_code = 'profiles_advertiser');
grant execute on function backoffice.business_deadline(text, timestamptz, integer)
   to influx_identity_definer;

-- 6.5 influx_privacy_definer: what the export reads and the erasure writes (04 §9.2) --------------

grant select (id, account_id, kind, state, created_at, decided_at, rejection_reason_code,
              member_message, closed_at)
   on profiles.advertiser_review_entries to influx_privacy_definer;
grant update (state, closed_at, member_message, internal_comment)
   on profiles.advertiser_review_entries to influx_privacy_definer;

drop policy if exists advertiser_review_entries_privacy_definer_select
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_privacy_definer_select
  on profiles.advertiser_review_entries
  for select to influx_privacy_definer
  using (true);

-- the erasure empties the texts and withdraws the open entry of an erased account, nothing else
drop policy if exists advertiser_review_entries_privacy_definer_erase
  on profiles.advertiser_review_entries;
create policy advertiser_review_entries_privacy_definer_erase
  on profiles.advertiser_review_entries
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = advertiser_review_entries.account_id and a.status = 'deleted'))
  with check (state <> 'open' and member_message is null and internal_comment is null);

grant select (account_id, field_code, row_key, proposed_value, status, submitted_at, closed_at)
   on profiles.profile_field_revisions to influx_privacy_definer;
grant delete on profiles.profile_field_revisions to influx_privacy_definer;

drop policy if exists profile_field_revisions_privacy_definer_select
  on profiles.profile_field_revisions;
create policy profile_field_revisions_privacy_definer_select on profiles.profile_field_revisions
  for select to influx_privacy_definer
  using (true);

drop policy if exists profile_field_revisions_privacy_definer_erase
  on profiles.profile_field_revisions;
create policy profile_field_revisions_privacy_definer_erase on profiles.profile_field_revisions
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = profile_field_revisions.account_id and a.status = 'deleted'));

-- 7. The version token (file.md A3) ---------------------------------------------------------------

create or replace function profiles.advertiser_review_token(p_account_id uuid)
returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_profile  jsonb;
begin
  select pg_catalog.jsonb_build_object(
           'legal_name',           p.legal_name,
           'primary_sector',       p.primary_sector_code,
           'company_size',         p.company_size_band,
           'country',              a.country_code,
           'website_domain',       p.website_domain,
           'presentation',         p.presentation,
           'exclusivity',          p.exclusivity_band,
           'collaboration_rhythm', p.collaboration_rhythm,
           'offers_non_monetary',  p.offers_non_monetary,
           'contact_role',         p.contact_role)
    into v_profile
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.account_id = p_account_id;
  if not found then
    return null;
  end if;

  return pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
    'profile', v_profile,
    'secondary_sectors', (select pg_catalog.jsonb_agg(s.sector_code order by s.slot)
                            from profiles.advertiser_secondary_sectors s
                           where s.account_id = p_account_id),
    'target_markets', (select pg_catalog.jsonb_agg(m.country_code order by m.slot)
                         from profiles.advertiser_target_markets m
                        where m.account_id = p_account_id),
    'working_languages', (select pg_catalog.jsonb_agg(w.language_code order by w.language_code)
                            from profiles.advertiser_working_languages w
                           where w.account_id = p_account_id),
    'topics', (select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                 from profiles.advertiser_topics t
                where t.account_id = p_account_id),
    'networks', (select pg_catalog.jsonb_agg(n.network_code order by n.network_code)
                   from profiles.advertiser_networks n
                  where n.account_id = p_account_id),
    'formats', (select pg_catalog.jsonb_agg(f.format_code order by f.format_code)
                  from profiles.advertiser_formats f
                 where f.account_id = p_account_id),
    'audience_countries', (select pg_catalog.jsonb_agg(c.country_code order by c.slot)
                             from profiles.advertiser_audience_countries c
                            where c.account_id = p_account_id),
    'usage_rights', (select pg_catalog.jsonb_agg(u.usage_right_code order by u.usage_right_code)
                       from profiles.advertiser_usage_rights u
                      where u.account_id = p_account_id),
    'contact', (select pg_catalog.jsonb_build_array(d.contact_first_name, d.contact_email,
                                                    d.contact_phone, d.contact_url)
                  from profiles.advertiser_contact_details d
                 where d.account_id = p_account_id),
    -- the logo shown and the logo under review (`in_review`, 06): the text keeps the comparison
    -- valid before the enum value exists
    'logos', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(l.id, l.state)
                                          order by l.id)
                from profiles.brand_logo_objects l
               where l.account_id = p_account_id
                 and l.state::text in ('active', 'in_review')),
    'revisions', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(
                                                r.id, r.field_code, r.row_key, r.proposed_value)
                                              order by r.id)
                    from profiles.profile_field_revisions r
                   where r.account_id = p_account_id and r.status = 'pending_review')
  )::text, 'UTF8')), 'hex');
end
$$;

comment on function profiles.advertiser_review_token(uuid) is
  'Version token of a brand profile under examination (file.md A3, L2BS-1): the SHA-256, in hex, '
  'of what the agent examines — the profile content and the country of the account, the eight '
  'lists in their order, the contact person, the active and in_review logos, the pending '
  'revisions — never stored; rendered at the opening of an entry and recomputed at the decision '
  '(07), a different token refuses the decision (55000 stale_token). Status, dates and '
  'completeness are not content (EC-L2C-05-6). NULL without a profile. SECURITY INVOKER: its '
  'callers read those tables with their own rights; no grant here.';

revoke all on function profiles.advertiser_review_token(uuid)
  from public, anon, authenticated, service_role;

-- 8. The submission opens the entry (0203 recreated by its owner, 06 RG5, file.md A1) -------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema profiles to influx_identity_definer;
set role influx_identity_definer;

create or replace function profiles.submit_own_advertiser_profile()
returns table (
  status        text,
  submitted_at  timestamptz,
  changed       boolean
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
  v_at       timestamptz;
  v_values   jsonb;
  v_missing  text[];
  v_entry    uuid;
begin
  if v_account is null or influx.current_account_role() is distinct from 'advertiser' then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- The row lock serialises two submissions (double click, second tab): the second one reads the
  -- state the first one committed, and finds its entry.
  select p.status::text, p.submitted_at,
         pg_catalog.jsonb_build_object(
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
    into v_status, v_at, v_values
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id and a.status = 'active'
   where p.account_id = v_account
     for update of p;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- Edge case 3: submitted again while waiting, nothing is written (the entry is already open).
  if v_status = 'pending_review' then
    return query select v_status, v_at, false;
    return;
  end if;
  -- Edge case 5, RG6: published and suspended are left by a decision of INFLUX only.
  if v_status not in ('draft', 'rejected') then
    raise exception 'a % brand profile cannot be submitted', v_status
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- RG5: every required field, the first missing one named (RG61: the order of the form).
  v_missing := profiles.advertiser_missing_required_fields(v_values);
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'required field missing: %', v_missing[1]
      using errcode = 'check_violation', detail = v_missing[1];
  end if;

  update profiles.advertiser_profiles p
     set status = 'pending_review', submitted_at = pg_catalog.now()
   where p.account_id = v_account
  returning p.submitted_at into v_at;

  -- file.md A1: the entry of queue 1, in the transaction of the submission; an entry still open
  -- (none is expected after a refusal, which closes it) is kept, never doubled. Its deadlines are
  -- written by the trigger of the table (04 §5.6).
  select e.id into v_entry
    from profiles.advertiser_review_entries e
   where e.account_id = v_account and e.state = 'open';
  if v_entry is null then
    insert into profiles.advertiser_review_entries (account_id, kind)
    values (v_account, 'submission')
    returning id into v_entry;
  end if;

  -- The register, in the transaction of the fact; last: the chain lock is held until COMMIT
  -- (04 §7.2).
  perform audit.append('profile.submitted', 'advertiser_profile', v_account,
                       pg_catalog.jsonb_build_object('from_status', v_status, 'entry_id', v_entry));
  return query select 'pending_review'::text, v_at, true;
end
$$;

comment on function profiles.submit_own_advertiser_profile() is
  '06 RG5, RG6, edge cases 3 and 5; file.md A1: an active advertiser submits his own brand profile. '
  'From draft or rejected, with no required field missing (profiles.advertiser_missing_required_'
  'fields()): in ONE transaction, status pending_review, submitted_at now(), the entry `submission` '
  'of queue 1 opened (profiles.advertiser_review_entries, deadlines by its trigger; an open entry is '
  'kept), the register line profile.submitted {from_status, entry_id}; returns (pending_review, '
  'instant, true). Already pending_review: nothing written, returns (pending_review, instant of the '
  'submission, false). 23514 with the code of the first missing field (message and DETAIL), 55000 '
  'from published or suspended, 42501 outside an active advertiser account holding a profile. '
  'SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for '
  'influx_advertiser only.';

revoke all on function profiles.submit_own_advertiser_profile()
  from public, anon, authenticated, service_role;
grant execute on function profiles.submit_own_advertiser_profile() to influx_advertiser;

reset role;
revoke create on schema profiles from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 9. E-5 recreated by its owner from its 0204 version: the entries in the export and the erasure --

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 9.1 The export (0137, 0202, 0204): advertiser_profile also carries its entries and revisions ----
create or replace function privacy.export_document(
  p_account_id  uuid,
  p_addresses   text[],
  p_notice      jsonb
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_account   jsonb;
  v_language  text;
  v_zone      text;
  v_data      jsonb;
begin
  -- Compte (runbook §4): the account, its role, the referent agent's first name only
  select pg_catalog.jsonb_build_object(
           'id', a.id,
           'role', r.role,
           'email', a.email,
           'email_verified_at', privacy.iso_utc(a.email_verified_at),
           'email_status', a.email_status,
           'email_undeliverable_at', privacy.iso_utc(a.email_undeliverable_at),
           'country_code', a.country_code,
           'preferred_language', a.preferred_language,
           'time_zone', a.timezone,
           'display_name', a.display_name,
           'status', a.status,
           'adult_attested', a.is_adult_attested,
           'adult_attested_at', privacy.iso_utc(a.adult_attested_at),
           'declared_status', a.declared_status,
           'signup_source', pg_catalog.jsonb_build_object(
              'utm_source', a.signup_utm_source,
              'utm_medium', a.signup_utm_medium,
              'utm_campaign', a.signup_utm_campaign,
              'referrer_domain', a.signup_referrer_domain,
              'heard_from', a.signup_heard_from,
              'via_invitation', a.signup_invitation_id is not null),
           'created_at', privacy.iso_utc(a.created_at),
           'last_seen_at', privacy.iso_utc(a.last_seen_at),
           'role_granted_at', privacy.iso_utc(r.granted_at),
           'referent_first_name', p.first_name),
         a.preferred_language::text,
         a.timezone
    into v_account, v_language, v_zone
    from identity.accounts a
    left join identity.account_roles r on r.account_id = a.id
    left join identity.agent_profiles p on p.account_id = a.owner_agent_id
   where a.id = p_account_id;
  if not found then
    raise exception 'unknown account' using errcode = 'no_data_found';
  end if;

  v_data := pg_catalog.jsonb_build_object(
    'account', v_account,

    -- Profil de marque (0202): the profile of an advertiser as entered, its lists in the order
    -- chosen, its contact person (first name and coordinates); codes of the closed lists, as stored
    'advertiser_profile', (
      select pg_catalog.jsonb_build_object(
               'legal_name', p.legal_name,
               'status', p.status,
               'primary_sector', p.primary_sector_code,
               'secondary_sectors', coalesce((
                  select pg_catalog.jsonb_agg(s.sector_code order by s.slot)
                    from profiles.advertiser_secondary_sectors s
                   where s.account_id = p.account_id), '[]'::jsonb),
               'company_size', p.company_size_band,
               'target_markets', coalesce((
                  select pg_catalog.jsonb_agg(m.country_code order by m.slot)
                    from profiles.advertiser_target_markets m
                   where m.account_id = p.account_id), '[]'::jsonb),
               'working_languages', coalesce((
                  select pg_catalog.jsonb_agg(w.language_code order by w.language_code)
                    from profiles.advertiser_working_languages w
                   where w.account_id = p.account_id), '[]'::jsonb),
               'website_domain', p.website_domain,
               'presentation', p.presentation,
               'topics', coalesce((
                  select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                    from profiles.advertiser_topics t
                   where t.account_id = p.account_id), '[]'::jsonb),
               'networks', coalesce((
                  select pg_catalog.jsonb_agg(n.network_code order by n.network_code)
                    from profiles.advertiser_networks n
                   where n.account_id = p.account_id), '[]'::jsonb),
               'formats', coalesce((
                  select pg_catalog.jsonb_agg(f.format_code order by f.format_code)
                    from profiles.advertiser_formats f
                   where f.account_id = p.account_id), '[]'::jsonb),
               'audience_countries', coalesce((
                  select pg_catalog.jsonb_agg(c.country_code order by c.slot)
                    from profiles.advertiser_audience_countries c
                   where c.account_id = p.account_id), '[]'::jsonb),
               'usage_rights', coalesce((
                  select pg_catalog.jsonb_agg(u.usage_right_code order by u.usage_right_code)
                    from profiles.advertiser_usage_rights u
                   where u.account_id = p.account_id), '[]'::jsonb),
               'exclusivity', p.exclusivity_band,
               'collaboration_rhythm', p.collaboration_rhythm,
               'offers_non_monetary', p.offers_non_monetary,
               'contact_role', p.contact_role,
               'contact', (
                  select pg_catalog.jsonb_build_object(
                           'first_name', d.contact_first_name, 'email', d.contact_email,
                           'phone', d.contact_phone, 'page_url', d.contact_url,
                           'updated_at', privacy.iso_utc(d.updated_at))
                    from profiles.advertiser_contact_details d
                   where d.account_id = p.account_id),
               'completeness_percent', p.completeness_percent,
               -- 0204 (stockage.md §7): the metadata of each logo file, never its bytes nor its key
               'logo_files', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'state', l.state, 'byte_size', l.byte_size, 'width', l.width,
                           'height', l.height, 'created_at', privacy.iso_utc(l.created_at),
                           'activated_at', privacy.iso_utc(l.activated_at))
                         order by l.created_at, l.id)
                    from profiles.brand_logo_objects l
                   where l.account_id = p.account_id), '[]'::jsonb),
               -- 0207 (file.md A1): each examination of the profile, never the internal comment,
               -- an agent nor the lock
               'review_entries', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'kind', e.kind, 'state', e.state,
                           'created_at', privacy.iso_utc(e.created_at),
                           'decided_at', privacy.iso_utc(e.decided_at),
                           'rejection_reason', e.rejection_reason_code,
                           'member_message', e.member_message,
                           'closed_at', privacy.iso_utc(e.closed_at))
                         order by e.created_at, e.id)
                    from profiles.advertiser_review_entries e
                   where e.account_id = p.account_id), '[]'::jsonb),
               -- 0207 (04 §5.2): each value submitted for a moderated field
               'field_revisions', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'field', r.field_code, 'row_key', r.row_key,
                           'proposed_value', r.proposed_value, 'status', r.status,
                           'submitted_at', privacy.iso_utc(r.submitted_at),
                           'closed_at', privacy.iso_utc(r.closed_at))
                         order by r.submitted_at, r.field_code, r.row_key)
                    from profiles.profile_field_revisions r
                   where r.account_id = p.account_id), '[]'::jsonb),
               'created_at', privacy.iso_utc(p.created_at),
               'updated_at', privacy.iso_utc(p.updated_at))
        from profiles.advertiser_profiles p
       where p.account_id = p_account_id),

    -- Consentements: purpose, value, date, origin, evidence
    'consents', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'purpose', c.purpose, 'granted', c.granted, 'source', c.source,
               'occurred_at', privacy.iso_utc(c.occurred_at), 'evidence', c.evidence)
             order by c.occurred_at, c.id)
        from identity.consent_events c
       where c.account_id = p_account_id), '[]'::jsonb),

    -- Conditions acceptées: version, date, nature, channel, language, IP address and browser
    'terms_acceptances', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'document_kind', v.document_kind, 'version_label', v.version_label,
               'version_locale', v.locale, 'accepted_at', privacy.iso_utc(t.accepted_at),
               'nature', t.nature, 'channel', t.channel, 'locale', t.locale,
               'ip_address', pg_catalog.host(t.ip_address), 'user_agent', t.user_agent)
             order by t.accepted_at, t.id)
        from identity.terms_acceptances t
        join identity.terms_versions v on v.id = t.terms_version_id
       where t.account_id = p_account_id), '[]'::jsonb),

    -- Sessions: creation, last activity, browser, country; never the token digest
    'sessions', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'created_at', privacy.iso_utc(s.created_at),
               'last_activity_at', privacy.iso_utc(s.last_activity_at),
               'surface', s.surface, 'browser', s.user_agent_summary,
               'country_code', s.country_code, 'revoked_at', privacy.iso_utc(s.revoked_at),
               'revocation_reason', s.revocation_reason)
             order by s.created_at, s.id)
        from identity.sessions s
       where s.account_id = p_account_id), '[]'::jsonb),

    -- E-mails transactionnels: code, date, language, status; never the content of a code
    'transactional_emails', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'email_code', t.email_code, 'priority', t.priority, 'locale', t.locale,
               'status', t.status, 'created_at', privacy.iso_utc(t.created_at),
               'sent_at', privacy.iso_utc(t.sent_at),
               'delivered_at', privacy.iso_utc(t.delivered_at),
               'failed_at', privacy.iso_utc(t.failed_at))
             order by t.created_at, t.id)
        from leads.transactional_sends t
       where t.account_id = p_account_id
          -- by address only when the line names no account (EC-J8-55)
          or (t.account_id is null and t.recipient_email = any (p_addresses))), '[]'::jsonb),

    -- Changements d'adresse: old and new addresses, dates; never the digests
    'email_changes', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'old_email', r.old_email, 'new_email', r.new_email,
               'created_at', privacy.iso_utc(r.created_at),
               'completed_at', privacy.iso_utc(r.completed_at),
               'cancelled_at', privacy.iso_utc(r.cancelled_at),
               'cancel_reason', r.cancel_reason)
             order by r.created_at, r.id)
        from identity.email_change_requests r
       where r.account_id = p_account_id), '[]'::jsonb),

    -- Incidents de délivrance: type, date, address concerned
    'email_delivery_incidents', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'incident_type', i.incident_type, 'channel', i.channel,
               'occurred_at', privacy.iso_utc(i.occurred_at), 'email_address', i.email_address)
             order by i.occurred_at, i.id)
        from identity.email_delivery_incidents i
       where i.account_id = p_account_id), '[]'::jsonb),

    -- Signalements de secours naming a current or former address of the account
    'delivery_reports', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'received_at', privacy.iso_utc(d.received_at), 'login_email', d.login_email,
               'contact_email', d.contact_email, 'message', d.message, 'status', d.status)
             order by d.received_at, d.id)
        from backoffice.code_delivery_reports d
       where d.login_email = any (p_addresses)
          or d.contact_email = any (p_addresses)), '[]'::jsonb),

    -- Événements reçus de Brevo rattachés au compte (30 days window by purge)
    'brevo_events', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'event', e.event, 'occurred_at', privacy.iso_utc(e.occurred_at),
               'outcome', o.outcome, 'processed_at', privacy.iso_utc(o.processed_at))
             order by o.processed_at, o.event_id)
        from leads.brevo_inbound_outcomes o
        join leads.brevo_inbound_events e on e.id = o.event_id
       where o.account_id = p_account_id), '[]'::jsonb),

    -- Journal d'activité: code and date, an internal actor shown as INFLUX, no payload, no hash
    'activity_log', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', e.event_type, 'occurred_at', privacy.iso_utc(e.occurred_at),
               'actor', case when e.actor_account_id = p_account_id then 'self' else 'INFLUX' end)
             order by e.seq)
        from audit.audit_events e
       where e.actor_account_id = p_account_id
          or (e.subject_type = 'account' and e.subject_id = p_account_id)
          or (e.subject_type = 'data_subject_request'
              and e.subject_id in (select d.id from backoffice.data_subject_requests d
                                    where d.requester_account_id = p_account_id))), '[]'::jsonb),

    -- Rapports d'erreur of the account: date, route, service; the message and the browser of a
    -- BROWSER report only (a server message is a technical trace, EC-J8-56); never the stack
    'error_reports', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'occurred_at', privacy.iso_utc(x.occurred_at), 'route', x.route,
               'service', x.service,
               'message', case when x.service in ('web', 'backoffice') then x.message end,
               'browser', case when x.service in ('web', 'backoffice')
                               then x.user_agent_summary end)
             order by x.occurred_at, x.id)
        from ops.error_occurrences x
       where x.account_id = p_account_id), '[]'::jsonb),

    -- Demandes « mes données » of the requester
    'data_requests', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'id', d.id, 'request_type', d.request_type, 'channel', d.channel,
               'received_at', privacy.iso_utc(d.received_at), 'due_at', privacy.iso_utc(d.due_at),
               'status', d.status, 'completed_at', privacy.iso_utc(d.completed_at),
               'outcome', d.outcome_code)
             order by d.received_at, d.id)
        from backoffice.data_subject_requests d
       where d.requester_account_id = p_account_id), '[]'::jsonb),

    -- Destinataires: external id, last state, unsubscription
    'recipients', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'destination', s.destination, 'external_contact_id', s.external_contact_id,
               'last_status', s.last_status,
               'last_attempt_at', privacy.iso_utc(s.last_attempt_at),
               'last_success_at', privacy.iso_utc(s.last_success_at),
               'unsubscribed_at', privacy.iso_utc(s.unsubscribed_at),
               'suppressed_reason', s.suppressed_reason)
             order by s.destination)
        from leads.contact_sync_states s
       where s.account_id = p_account_id), '[]'::jsonb));

  return pg_catalog.jsonb_build_object(
    'format', 'influx.data_export',
    'version', 1,
    'generated_at', privacy.iso_utc(pg_catalog.now()),
    'account_id', p_account_id,
    'language', v_language,
    'time_zone', v_zone,
    'notice', p_notice,
    'categories', pg_catalog.to_jsonb(privacy.export_categories()),
    'data', v_data);
end
$$;

comment on function privacy.export_document(uuid, text[], jsonb) is
  'The export of an access request (runbook §4; 15 RG81: the requester''s data only, never a third '
  'party''s, never a digest of a token, a code, a throttle or the chain): {format: influx.data_export, '
  'version: 1, generated_at, account_id, language, time_zone, notice, categories, data} with the 14 '
  'categories of privacy.export_categories() (EC-J8-48); advertiser_profile carries the whole brand '
  'profile of 0202, its lists and its contact person (04 §9.2), and logo_files, the metadata of '
  'its logo objects (0204: state, size, sides, dates; never the bytes nor the key), review_entries '
  '(0207: kind, state, dates, reason, message to the brand; never the internal comment, an agent '
  'nor the lock) and field_revisions (0207: field, row, value, status, dates). p_addresses: '
  'privacy.account_addresses(). SECURITY INVOKER owned by influx_privacy_definer, NO grant.';

-- 9.2 The execution (0150, 0202, 0204): the erasure also clears the examinations ---------------
create or replace function privacy.execute_request(
  p_request_id  uuid,
  p_notice      jsonb
)
returns table (
  request_type  text,
  auth_user_id  uuid
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_exec       record;
  v_account    record;
  v_addresses  text[];
  v_marker     text;
  v_document   jsonb;
  v_content    text;
  v_bytes      bytea;
  v_digest     bytea;
  v_export     uuid;
  v_fact       uuid := pg_catalog.gen_random_uuid();
  v_mail       uuid := pg_catalog.gen_random_uuid();
  v_withdrawn  uuid[];
  v_access     uuid;
begin
  -- The authorised, not yet executed row; another worker holding it, or nothing to do: no row.
  select e.request_id, e.request_type, e.account_id
    into v_exec
    from privacy.request_executions e
   where e.request_id = p_request_id
     and e.executed_at is null
     for update skip locked;
  if not found then
    return;
  end if;

  -- The request is still open; the requester is still an active account (locked).
  perform 1 from backoffice.data_subject_requests d
   where d.id = p_request_id and d.status <> 'closed'
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select a.id, a.email, a.auth_user_id
    into v_account
    from identity.accounts a
   where a.id = v_exec.account_id and a.status = 'active'
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- EC-J8-42: the current and former addresses, read before anything changes
  v_addresses := privacy.account_addresses(v_account.id);

  if v_exec.request_type = 'access' then
    -- The notice of art. 15(1) a-h and 15(2), rendered by apps/api in the account's language
    -- (runbook §4), stored verbatim in the file.
    if p_notice is null or pg_catalog.jsonb_typeof(p_notice) <> 'object'
       or pg_catalog.octet_length(p_notice::text) > 65536 then
      raise exception 'the notice is a JSON object of at most 64 KiB'
        using errcode = 'invalid_parameter_value';
    end if;

    update privacy.request_executions set executed_at = pg_catalog.now()
     where request_id = p_request_id;

    -- Built FROM THE BASE, serialised ONCE: the stored text is the file delivered.
    v_document := privacy.export_document(v_account.id, v_addresses, p_notice);
    v_content  := pg_catalog.jsonb_pretty(v_document);
    v_bytes    := pg_catalog.convert_to(v_content, 'UTF8');
    v_digest   := pg_catalog.sha256(v_bytes);

    insert into privacy.data_exports (request_id, account_id, content, sha256, size_bytes, categories)
    values (p_request_id, v_account.id, v_content, v_digest, pg_catalog.octet_length(v_bytes),
            privacy.export_categories())
    returning id into v_export;

    -- runbook §4: the e-mail "export available until ...", P1, ids only, once per request
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values
      (v_fact, 'privacy.export_ready', 'brevo_transactional', 'account:' || v_account.id::text, 100,
       pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account.id,
                                     'request_id', p_request_id, 'export_id', v_export,
                                     'email_code', 'privacy.export_ready'),
       'privacy.export_ready:' || p_request_id::text);

    -- last: the chain lock is held until COMMIT (04 §7.2); never the content
    perform audit.append('privacy.export_published', 'data_subject_request', p_request_id,
                         pg_catalog.jsonb_build_object(
                           'sha256', pg_catalog.encode(v_digest, 'hex'),
                           'size_bytes', pg_catalog.octet_length(v_bytes),
                           'categories', pg_catalog.to_jsonb(privacy.export_categories())));
    return query select 'access'::text, null::uuid;
    return;
  end if;

  -- Erasure (04 §9.2, 21 §J8 point 6): the tables of Lot 1, the brand profile of L2B (0202), its
  -- logo (0204) and its examinations (0207), in ONE transaction.
  if p_notice is not null then
    raise exception 'an erasure takes no notice' using errcode = 'invalid_parameter_value';
  end if;
  v_marker := 'deleted+' || v_account.id::text || '@invalid';

  -- the address the Brevo deletion and the confirmation e-mail need, held until the closure
  -- (EC-J8-46, D72)
  update privacy.request_executions
     set executed_at = pg_catalog.now(), propagation_email = v_account.email
   where request_id = p_request_id;

  -- 1. the account: deleted, access closed, directly identifying data replaced (EC-J8-38)
  update identity.accounts
     set status        = 'deleted',
         deleted_at    = pg_catalog.now(),
         anonymized_at = pg_catalog.now(),
         email         = v_marker,
         display_name  = null
   where id = v_account.id;

  -- 2. the sessions, deleted with their re-authentication markers (04 §9.1, EC-J8-37)
  delete from identity.sessions where account_id = v_account.id;

  -- 3. the advertiser profile: the legal name (NOT NULL: a neutral label, EC-J8-38) and every
  -- column the brand entered (0202, EC-L2B-05-6), in ONE statement (the policy of the owner checks
  -- them together); its lists deleted; its contact person emptied, the row kept (04 §9.2)
  update profiles.advertiser_profiles
     set legal_name           = '[deleted]',
         primary_sector_code  = null,
         company_size_band    = null,
         website_domain       = null,
         presentation         = null,
         exclusivity_band     = null,
         collaboration_rhythm = null,
         offers_non_monetary  = null,
         contact_role         = null,
         completeness_percent = null
   where account_id = v_account.id;
  delete from profiles.advertiser_secondary_sectors where account_id = v_account.id;
  delete from profiles.advertiser_target_markets where account_id = v_account.id;
  delete from profiles.advertiser_working_languages where account_id = v_account.id;
  delete from profiles.advertiser_topics where account_id = v_account.id;
  delete from profiles.advertiser_networks where account_id = v_account.id;
  delete from profiles.advertiser_formats where account_id = v_account.id;
  delete from profiles.advertiser_audience_countries where account_id = v_account.id;
  delete from profiles.advertiser_usage_rights where account_id = v_account.id;
  update profiles.advertiser_contact_details
     set contact_first_name = null,
         contact_email      = null,
         contact_phone      = null,
         contact_url        = null
   where account_id = v_account.id;

  -- 3 bis. the logo (0204, stockage.md §7): every object of the account to purge, unreachable at
  -- once, removed from Storage by the task storage_purge; its daily usage deleted
  update profiles.brand_logo_objects
     set state              = 'purging',
         purge_requested_at = pg_catalog.now()
   where account_id = v_account.id and state <> 'purging';
  delete from profiles.storage_daily_usage where account_id = v_account.id;

  -- 3 ter. the examinations (0207, file.md A1): the submitted values deleted; the entries kept,
  -- pseudonymous (the trace of a human decision, 06 RG6), their texts emptied, an open one
  -- withdrawn now
  delete from profiles.profile_field_revisions where account_id = v_account.id;
  update profiles.advertiser_review_entries
     set state            = case when state = 'open' then 'withdrawn'::profiles.review_entry_state
                                 else state end,
         closed_at        = coalesce(closed_at, pg_catalog.now()),
         member_message   = null,
         internal_comment = null
   where account_id = v_account.id;

  -- 4. the plain addresses of the Lot 1 tables (21 §J8; EC-J8-39, EC-J8-40, EC-J8-41, EC-J8-44)
  -- the closed address changes: their two addresses only; the open one (at most one): cancelled
  -- account_deleted, its digests cleared (never read: the owner has no right on them)
  update identity.email_change_requests
     set old_email = v_marker,
         new_email = 'deleted+' || v_account.id::text || '.new@invalid'
   where account_id = v_account.id
     and (completed_at is not null or cancelled_at is not null);
  update identity.email_change_requests
     set old_email     = v_marker,
         new_email     = 'deleted+' || v_account.id::text || '.new@invalid',
         cancelled_at  = pg_catalog.now(),
         cancel_reason = 'account_deleted',
         old_code_hash = null,
         new_code_hash = null
   where account_id = v_account.id
     and completed_at is null and cancelled_at is null;

  update identity.email_delivery_incidents
     set email_address = v_marker,
         payload       = case when pg_catalog.strpos(payload::text, '@') > 0
                              then '{}'::jsonb else payload end
   where account_id = v_account.id;

  -- EC-J8-55: v_addresses holds no address another account holds or held, and a row that names
  -- an account is matched by address only when it names THIS one (or none)
  update backoffice.code_delivery_reports
     set login_email = v_marker, contact_email = v_marker, message = null
   where login_email = any (v_addresses) or contact_email = any (v_addresses);

  update leads.brevo_inbound_events e
     set email = null
   where e.email is not null
     and (e.account_ref = v_account.id
          or exists (select 1 from leads.brevo_inbound_outcomes o
                      where o.event_id = e.id and o.account_id = v_account.id)
          or (e.email = any (v_addresses)
              and (e.account_ref is null or e.account_ref = v_account.id)
              and not exists (select 1 from leads.brevo_inbound_outcomes o
                               where o.event_id = e.id and o.account_id <> v_account.id)));

  update leads.transactional_sends
     set recipient_email = v_marker
   where account_id is null and recipient_email = any (v_addresses);

  update backoffice.member_invitations i
     set email = v_marker
   where i.email <> v_marker
     and (i.account_id is null or i.account_id = v_account.id)
     and (i.account_id = v_account.id
          or i.email = any (v_addresses)
          or i.id = (select a.signup_invitation_id from identity.accounts a where a.id = v_account.id));

  -- 5. any export of the account still holding a content: purged (purged_at by the guard); the
  -- member can no longer sign in to download it (D72)
  update privacy.data_exports set content = null
   where account_id = v_account.id and purged_at is null;

  -- 5 bis. D72, EC-DZ-3: an access request of the account still open is withdrawn (at most one,
  -- index data_subject_requests_open_idx); its execution, if any, is left out of E-5 from now on
  with withdrawn as (
    update backoffice.data_subject_requests d
       set status = 'closed', outcome_code = 'retiree_par_le_demandeur'
     where d.requester_account_id = v_account.id
       and d.request_type = 'access'
       and d.status <> 'closed'
    returning d.id
  )
  select pg_catalog.array_agg(w.id) into v_withdrawn from withdrawn w;

  -- 6. 04 §9.2 point 4, 15 RG79: the propagation, P0, ids only (RG74), once per account by nature
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  select v_fact, 'account.deleted', d.destination, 'account:' || v_account.id::text, 0,
         pg_catalog.jsonb_build_object('event_id', v_fact, 'account_id', v_account.id,
                                       'request_id', p_request_id),
         'account.deleted:' || v_account.id::text
    from (values ('brevo_contact'::leads.outbox_destination),
                 ('apollo_contact'::leads.outbox_destination)) d (destination);

  -- 7. D72 §2.2: the e-mail "your account is deleted" (the answer of art. 12(3)), P1, ids only,
  -- once per request, to the held address (privacy.read_erasure_notification_subject)
  insert into leads.outbox_events
    (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
  values
    (v_mail, 'privacy.erasure_completed', 'brevo_transactional', 'account:' || v_account.id::text,
     100,
     pg_catalog.jsonb_build_object('event_id', v_mail, 'account_id', v_account.id,
                                   'request_id', p_request_id,
                                   'email_code', 'privacy.erasure_completed'),
     'privacy.erasure_completed:' || p_request_id::text);

  -- last: the chain lock is held until COMMIT (04 §7.2)
  if v_withdrawn is not null then
    foreach v_access in array v_withdrawn loop
      perform audit.append('privacy.request_completed', 'data_subject_request', v_access,
                           pg_catalog.jsonb_build_object('request_type', 'access',
                                                         'outcome_code', 'retiree_par_le_demandeur'));
    end loop;
  end if;
  perform audit.append('account.anonymized', 'account', v_account.id,
                       pg_catalog.jsonb_build_object('request_id', p_request_id));

  -- the GoTrue user is deleted by the worker AFTER the commit (admin API), then recorded
  return query select 'erasure'::text, v_account.auth_user_id;
end
$$;

comment on function privacy.execute_request(uuid, jsonb) is
  'E-5 privacy.execute_request (03 P7; 15 RG75 step 6; 04 §9.2; 21 §J8 point 6; D72). Locks the '
  'authorised, not executed row FOR UPDATE SKIP LOCKED (none: no row). 42501 when the request is '
  'closed or the requester is no longer active. ACCESS: p_notice required (JSON object, 64 KiB at '
  'most, 22023 otherwise), stored under "notice"; the export built from the base '
  '(privacy.export_document), serialised once (jsonb_pretty), stored with its SHA-256, size and 14 '
  'categories, 7 days; privacy.export_ready to brevo_transactional (P1, ids, idempotency '
  'privacy.export_ready:<request>); privacy.export_published {sha256 hex, size_bytes, categories}; '
  'returns (access, NULL). ERASURE (admin 2V or member fresh code alike): p_notice NULL (22023 '
  'otherwise); the address held in propagation_email; account deleted, anonymised, '
  'deleted+<id>@invalid, display name NULL; its sessions DELETED (EC-J8-37); legal name [deleted] '
  'and the other brand profile columns NULL, its list rows deleted, its contact details NULL (0202); '
  'its logo objects to purging and its daily Storage usage deleted (0204); its field revisions '
  'deleted, the texts of its review entries emptied and an open entry withdrawn (0207); '
  'addresses replaced by the marker in email_change_requests (open ones cancelled account_deleted), '
  'email_delivery_incidents, code_delivery_reports (message cleared), transactional_sends, '
  'member_invitations; cleared in brevo_inbound_events; exports purged; an open access request '
  'closed retiree_par_le_demandeur with privacy.request_completed (EC-DZ-4); account.deleted to '
  'brevo_contact and apollo_contact (P0, ids, account.deleted:<account>); privacy.erasure_completed '
  'to brevo_transactional (P1, ids, privacy.erasure_completed:<request>); account.anonymized '
  '{request_id}; returns (erasure, auth_user_id) for the GoTrue deletion after the commit. SECURITY '
  'DEFINER owned by influx_privacy_definer, empty search_path; EXECUTE for influx_privacy ONLY.';

reset role;
revoke create on schema privacy from influx_privacy_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_privacy_definer', current_user);
end
$$;

-- 10. End-state assertions --------------------------------------------------------------------------

do $$
declare
  c_tables constant text[] := array[
    'profiles.moderated_fields', 'profiles.advertiser_rejection_reasons',
    'profiles.advertiser_review_entries', 'profiles.profile_field_revisions'];
  v_def  record;
  v_bad  text;
begin
  -- file.md A4, A6: the six moderated fields of the brand, the eight reasons, `other` alone with
  -- its message
  if (select pg_catalog.array_agg(code order by code) from profiles.moderated_fields
       where profile_kind = 'advertiser')
     is distinct from array['advertiser.brand_name', 'advertiser.contact_role', 'advertiser.logo',
                            'advertiser.presentation', 'advertiser.primary_sector',
                            'advertiser.website_domain'] then
    raise exception 'profiles.moderated_fields does not hold the six brand fields of file.md A4';
  end if;
  if (select pg_catalog.array_agg(code order by position) from profiles.advertiser_rejection_reasons)
     is distinct from array['contact_in_public_field', 'presentation_insufficient',
                            'logo_non_compliant', 'misleading_brand_name', 'sector_inconsistent',
                            'illicit_content', 'duplicate_brand', 'other']
     or (select pg_catalog.array_agg(code) from profiles.advertiser_rejection_reasons
          where requires_member_message) is distinct from array['other'] then
    raise exception 'profiles.advertiser_rejection_reasons is not the list of 06 RG66, file.md A6';
  end if;

  -- RLS enabled and forced
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid = any (c_tables::regclass[])
     and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not enabled and forced on: %', v_bad;
  end if;

  -- no execution role writes any of the four tables; influx_creator reads none
  select string_agg(r || ' ' || p || ' ' || t, ', ') into v_bad
    from unnest(c_tables) t,
         unnest(array['influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin',
                      'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy']) r,
         unnest(array['INSERT', 'UPDATE', 'DELETE']) p
   where pg_catalog.has_table_privilege(r, t, p)
      or (p <> 'DELETE' and pg_catalog.has_any_column_privilege(r, t, p));
  if v_bad is not null then
    raise exception 'execution role(s) writing a table of queue 1: %', v_bad;
  end if;
  select string_agg(t, ', ') into v_bad
    from unnest(c_tables) t
   where pg_catalog.has_any_column_privilege('influx_creator', t, 'SELECT');
  if v_bad is not null then
    raise exception 'influx_creator reads: %', v_bad;
  end if;

  -- file.md A1: the brand never reads the lock, an agent, a deadline nor the internal comment
  select string_agg(c, ', ') into v_bad
    from unnest(array['claimed_by_account_id', 'claimed_at', 'claim_expires_at',
                      'forced_release_at', 'forced_release_by_account_id',
                      'forced_release_holder_account_id', 'forced_release_reason_code',
                      'decided_by_account_id', 'internal_comment', 'sla_due_at', 'escalate_at',
                      'sla_breached']) c
   where pg_catalog.has_column_privilege('influx_advertiser', 'profiles.advertiser_review_entries',
                                         c, 'SELECT');
  if v_bad is not null then
    raise exception 'influx_advertiser reads the internal column(s): %', v_bad;
  end if;

  -- the token and the trigger function: SECURITY INVOKER, empty search_path, executed by nobody
  for v_def in
    select * from (values
      ('profiles.advertiser_review_token(uuid)'),
      ('profiles.prepare_advertiser_review_entry()')
    ) as d (fn)
  loop
    if (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY INVOKER with an empty search_path', v_def.fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner;
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- business_deadline(): executed by influx_identity_definer only (the trigger of the entries)
  select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid = 'backoffice.business_deadline(text, timestamptz, integer)'::regprocedure
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and (a.grantee = 0 or a.grantee::regrole::text <> 'influx_identity_definer');
  if v_bad is not null then
    raise exception 'business_deadline executable by: %', v_bad;
  end if;

  -- the submission keeps its owner, its security, its search_path and its only caller
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'profiles.submit_own_advertiser_profile()'::regprocedure)
       <> 'influx_identity_definer'
     or not (select prosecdef from pg_catalog.pg_proc
              where oid = 'profiles.submit_own_advertiser_profile()'::regprocedure) then
    raise exception 'profiles.submit_own_advertiser_profile() lost its owner or its security';
  end if;

  -- E-5 unchanged in its form (0137, 0150, 0202, 0204)
  for v_def in
    select * from (values
      ('privacy.execute_request(uuid, jsonb)', true, array['influx_privacy']),
      ('privacy.export_document(uuid, text[], jsonb)', false, array[]::text[])
    ) as d (fn, definer, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> 'influx_privacy_definer'
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            <> v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% lost its owner, its security or its search_path', v_def.fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text <> all (v_def.callers));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_proc p
       where p.proowner = 'influx_privacy_definer'::regrole) <> 10 then
    raise exception 'influx_privacy_definer must own exactly the ten functions of E-5';
  end if;

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_privacy_definer', 'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_identity_definer', 'profiles', 'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
