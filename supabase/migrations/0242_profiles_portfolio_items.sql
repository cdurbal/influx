-- =============================================================================
-- 0242_profiles_portfolio_items
-- -----------------------------------------------------------------------------
-- Lot 2 / L2G, commit 02 (jalons/l2g/02.md; l2g/modele.md §1 points 2 to 5, -4, -15, §2, §3 "0242",
-- §4; fiche invariants 1 to 5, 10, 16; 07 RG77 to RG83; 04 l. 1286-1292, 1493-1495, §5.11; D79 (8),
-- D80, D82 (7)). The visuals of a creator: their rows, their bucket, their deposit doors, their
-- retention and the two creator queues in the catalogue. No decision (0244), no submission (0243),
-- no route, no screen.
--
--   influx_creator_profile_definer   NOLOGIN NOINHERIT, no member (modele -4): owns the creator
--         doors of the portfolio (and of the profile from 0243). influx_identity_definer, reached
--         from the advertiser through its brand doors, holds NO right on any object of this file.
--   storage.buckets `portfolio`       private, {image/webp}, 8 388 608 bytes (modele §4); the
--         restrictive policies of 0204 on storage.objects and storage.buckets hold for it.
--   profiles.storage_quotas            `portfolio`: 16 uploads and 64 MiB received per account and UTC
--         day (modele point 4); the closed list of buckets extended.
--   backoffice.operational_settings    portfolio_retention_days = 30 (1 to 90; 07 Q9, D79 (8)).
--   backoffice.queues, sla_policies    profiles_creator (queue 2) and portfolio_moderation (queue 3):
--         agent and admin, a lock, claim 240, decision 480, escalation 960 (modele §4); a bulk action
--         allowed in queue 3 only (15 RG29, modele point 2), with no route before Lot 6bis.
--   profiles.portfolio_item_state      uploading (row written before the object, D80 (5)), pending,
--         approved, rejected, withdrawn (removed or replaced), purging, purged (modele point 3).
--   profiles.portfolio_items           one row per visual and per object of the bucket, written
--         BEFORE the object; object_key GENERATED `<account_id>/<id>.webp` (T9.3, T9.9); the entry of
--         queue 3 IS the visual (lock, deadlines frozen at `pending`, decision, modele point 2);
--         `check (state <> 'approved' or exif_stripped)` (T9.10, RG80); a replacement is a NEW row
--         (`replaces_item_id`, one live per visual), the approved one served until the new one is
--         approved (RG81, 04 l. 1493).
--   profiles.portfolio_rejection_reasons   the closed grid of RG79 (controls 1 to 5, 7, 9) and the
--         two caption reasons (RG82, RG83); never `other`, never a message to the member.
--   profiles.portfolio_brand_declarations  the statement of RG83, timestamped and immutable (no
--         writer before 0243).
--   profiles.deposited_portfolio_count(account)   RG4, RG88, modele point 5: the pending and approved
--         visuals, a pending replacement of an approved one apart (it shares its place). SECURITY
--         INVOKER; EXECUTE for influx_creator_profile_definer (its doors, and 0243).
--   Six creator doors, SECURITY DEFINER owned by influx_creator_profile_definer, EXECUTE for
--         influx_creator only, the account read from the transaction context (03 P2):
--      begin_portfolio_upload(received bytes, replaced visual)   quotas consumed, row uploading;
--                                                  8 places at most (55000 portfolio_full); a
--                                                  replacement of an approved visual only
--                                                  (not_replaceable), one at a time (replacement_pending)
--      discard_portfolio_upload(item)              refused by the checks of its bytes: row deleted
--      fail_portfolio_upload(item)                 Storage write failed: uploading -> purging
--      store_portfolio_item(item, bytes, w, h, sha256 hex)   uploading -> pending, exif_stripped,
--                                                  a free place (not for a replacement); portfolio.deposited
--      reorder_own_portfolio(items)                the order of the placed visuals (22023 order)
--      remove_own_portfolio_item(item)             pending or approved -> withdrawn (30 days kept,
--                                                  never purging at once, modele point 3), its live
--                                                  replacement with it; 55000 portfolio_minimum on a
--                                                  published profile under 3 (RG77); portfolio.withdrawn
--   Three triggers on profiles.portfolio_items and identity.account_roles:
--      rereview_changed_portfolio_item()   (invoker) a decided visual whose checksum or key changes
--                                          goes back to pending, its decision emptied (04 l. 1291, T9.10)
--      prepare_portfolio_item_entry()      (invoker) the life moves forward only; the deadlines of
--                                          queue 3 frozen at the passage to pending (04 §5.6); a
--                                          refusal or a withdrawal dated for its purge (Q9); purged:
--                                          the caption emptied
--      withdraw_portfolio_of_former_creator()   (definer) AFTER DELETE of a creator role, the erasure
--                                          apart (modele -15): the visuals withdrawn, an upload purged
--   E-4 ops.claim_storage_purges() and ops.complete_storage_purges() recreated from 0223 (the logo and
--         the evidence unchanged): an upload left uploading 15 minutes, a refused or withdrawn
--         visual past retention_due_at -> purging; claimed after the logo and the evidence; once
--         removed: purged, the row and its decision kept, the caption emptied, retention.purged
--         {category portfolio_objects}.
--
-- EC-L2G-02 (micro-gaps, the safest choice):
--   EC-L2G-02-1  The modele (point 3) prevails over the prompt: a refused or replaced visual is
--                withdrawn and kept 30 days (portfolio_retention_days), never purging at once.
--   EC-L2G-02-2  The visuals reference profiles.creator_public_profiles (the storefront, kept by the
--                erasure); the declaration references its visual (same account) and the visual its
--                declaration, both composite keys.
--   EC-L2G-02-3  Caption: 1 to 200 characters, one line, no control character (RG82; the headline
--                rule of 0216): no line break in a caption under a picture. Its moderation and the
--                declaration are written by 0243 (set_own_portfolio_caption).
--   EC-L2G-02-4  checksum: the SHA-256 of the stored WebP in lowercase hexadecimal (64 signs, the
--                text of modele §3); sides: those of the evidence (reencodePortfolio() takes the
--                parameters of reencodeEvidence(), D82 (2)).
--   EC-L2G-02-5  A place is a display_order 1 to 8 (unique per account), given at the storage to a
--                visual that is not a replacement: the smallest free one; a replacement takes the
--                place of its original at its approval (0244). Withdrawn, refused, purging: no place.
--   EC-L2G-02-6  The removal of an approved visual withdraws its pending replacement and purges an
--                upload of one in progress: the creator removes the place, not one version of it.
--                An uploading or already ended row is not removable (false); a decided one is.
--   EC-L2G-02-7  Register (modele §4): this file writes portfolio.deposited (kind, replaces_item_id)
--                and portfolio.withdrawn (cause removed | former_creator) only, ids and codes; the
--                decision codes and queue.portfolio_read come with their writer (0244). discard and
--                fail are technical states of an object (as the logo, EC-L2B-08-3): no line.
--   EC-L2G-02-8  The suspension of a profile and the freeze of a published one reach the visuals by
--                the guard of 0243 (§3 bis); these doors do not duplicate it.
--   EC-L2G-02-9  The former creator: the owner's policies on the visuals also admit the rows of an
--                account that no longer holds the creator role; to see it, the owner reads the
--                creator role rows (account_id, role) of every account, nothing else of them.
--   EC-L2G-02-10 apps/api/src/platform/storage.ts learns the bucket `portfolio` (its limit, its key)
--                in this commit: the purge of the worker refuses an unknown bucket, and this file
--                makes ops.claim_storage_purges() answer it.
--
-- ROLLBACK (before any visual is stored): drop trigger account_roles_withdraw_portfolio on
-- identity.account_roles; recreate ops.claim_storage_purges() and ops.complete_storage_purges() as in
-- 0223 (as influx_maintenance_definer); drop the six doors, the three trigger functions and
-- profiles.deposited_portfolio_count(uuid); drop table profiles.portfolio_brand_declarations,
-- profiles.portfolio_items, profiles.portfolio_rejection_reasons; drop type
-- profiles.portfolio_item_state; drop the policies *_creator_profile_definer_* and
-- *_maintenance_definer_portfolio named below and revoke their grants; delete the event types
-- portfolio.deposited and portfolio.withdrawn (no line written); delete the two queues and their
-- policies, the setting portfolio_retention_days and the quota `portfolio`, and recreate
-- storage_quotas_bucket and operational_settings_key_closed as in 0223 and 0232; remove the bucket
-- through the Storage API; drop role influx_creator_profile_definer.
-- =============================================================================

-- 1. The owner of the creator profile doors (03 P7 rule 5; rules 1 and 2 of 0001; modele -4) -----

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_creator_profile_definer') then
    create role influx_creator_profile_definer with nologin noinherit;
  end if;
  alter role influx_creator_profile_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_profile_definer' and rolsuper) then
    raise exception 'role influx_creator_profile_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_profile_definer' and rolbypassrls) then
    alter role influx_creator_profile_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_profile_definer' and rolreplication) then
    alter role influx_creator_profile_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_profile_definer' and rolcreatedb) then
    alter role influx_creator_profile_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_creator_profile_definer' and rolcreaterole) then
    alter role influx_creator_profile_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. The bucket (modele §4; 03 P10.1, P10.3; 04 §5.11) ---------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', false, 8388608, array['image/webp'])
on conflict (id) do update
   set public             = false,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- 3. The quotas of the bucket (modele point 4) ------------------------------------------------------

alter table profiles.storage_quotas drop constraint if exists storage_quotas_bucket;
alter table profiles.storage_quotas
  add constraint storage_quotas_bucket
  check (bucket_id in ('brand-logo', 'verification-evidence', 'portfolio'));

insert into profiles.storage_quotas (bucket_id, max_uploads_per_day, max_bytes_per_day)
values ('portfolio', 16, 67108864)
on conflict (bucket_id) do nothing;

comment on table profiles.storage_quotas is
  'Daily quotas per bucket (03 P10.7, 18 T9.8): uploads and bytes received per account and per UTC '
  'day. brand-logo: 10 and 20 MiB (stockage.md §6); verification-evidence: 18 and 64 MiB (0223, '
  'l2e/modele §4); portfolio: 16 and 64 MiB (0242, l2g/modele point 4). Read by the member doors of '
  '0204, 0223 and 0242 only.';

-- 4. The retention of a refused or withdrawn visual (07 Q9, D79 (8); modele §4) ---------------------

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
    'badge_reminder_days', 'dispute_reflection_hours', 'portfolio_retention_days'));

alter table backoffice.operational_settings
  drop constraint if exists operational_settings_portfolio_retention_days;
alter table backoffice.operational_settings
  add constraint operational_settings_portfolio_retention_days check (
    key <> 'portfolio_retention_days'
    or case when jsonb_typeof(value) = 'number'
            then (value)::numeric = trunc((value)::numeric) and (value)::numeric between 1 and 90
            else false end);

insert into backoffice.operational_settings (key, value)
values ('portfolio_retention_days', '30'::jsonb)
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
  'team waits that long after its submission, 08 RG77); from 0242 portfolio_retention_days (1 to 90: '
  'a refused or withdrawn visual is removed from Storage that long after, 07 Q9, D79 (8)); each a '
  'whole number in the range of its own CHECK operational_settings_<key>.';

-- 5. Queues 2 and 3 in the catalogue (15 RG26, RG29; modele §4) -----------------------------------

insert into backoffice.queues
  (code, label_key, spec_document, handled_by_roles, allows_bulk_action, has_lock)
values
  ('profiles_creator',     'queue.profiles_creator',     '07 RG4-RG10, RG93-RG97',
   '{agent,admin}', false, true),
  -- 15 RG29: a bulk action is allowed in queue 3, no route before Lot 6bis (modele point 2)
  ('portfolio_moderation', 'queue.portfolio_moderation', '07 RG77-RG83, RG97',
   '{agent,admin}', true,  true)
on conflict (code) do nothing;

insert into backoffice.sla_policies
  (queue_code, target_claim_minutes, target_decision_minutes, business_hours,
   escalate_after_minutes, is_provisional)
values
  -- 1 business day, claim within 4 business hours, escalation at 3 business days of age (as 0206)
  ('profiles_creator',     240, 480, default, 960, false),
  ('portfolio_moderation', 240, 480, default, 960, false)
on conflict (queue_code) do nothing;

-- the deferred key is checked now: a pending trigger event would block any later ALTER TABLE
set constraints backoffice.queues_sla_policy_fk immediate;

-- 6. The visuals (modele §2; 04 l. 1286-1292; 07 RG77 to RG83) -------------------------------------

do $$
begin
  if not exists (select 1 from pg_catalog.pg_type t
                  where t.typname = 'portfolio_item_state'
                    and t.typnamespace = 'profiles'::regnamespace) then
    create type profiles.portfolio_item_state as enum
      ('uploading', 'pending', 'approved', 'rejected', 'withdrawn', 'purging', 'purged');
  end if;
end
$$;

comment on type profiles.portfolio_item_state is
  'Life of a visual (l2g/modele point 3): uploading (row written, object not yet stored, D80 (5)), '
  'pending (stored, in queue 3), approved (served in layer A), rejected (refused with a reason of '
  'RG79), withdrawn (removed by its creator, replaced by an approved one, or of a former creator), '
  'purging (its object to remove from Storage), purged (object removed; row and decision kept).';

-- 6.1 The closed grid of RG79 and the two caption reasons (RG82, RG83) -----------------------------

create table if not exists profiles.portfolio_rejection_reasons (
  code          text     not null primary key,
  label_key     text     not null,
  message_key   text     not null,
  grid_control  smallint,
  position      smallint not null,
  is_active     boolean  not null default true,

  constraint portfolio_rejection_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint portfolio_rejection_reasons_label_key
    check (label_key = 'reason.portfolio_moderation.' || code),
  constraint portfolio_rejection_reasons_message_key
    check (message_key = 'portfolioDecision.reason.' || code),
  -- RG79: the numbered controls of the grid; 6 (a face) and 8 (metadata) never refuse
  constraint portfolio_rejection_reasons_grid_control
    check (grid_control between 1 and 9 and grid_control not in (6, 8)),
  constraint portfolio_rejection_reasons_position check (position > 0),
  constraint portfolio_rejection_reasons_position_unique unique (position)
);

comment on table profiles.portfolio_rejection_reasons is
  'The closed list of the refusal reasons of queue 3 (07 RG79, RG82, RG83; l2g/modele §2; 04 §3.1: '
  'one table per queue): one per refusing control of the grid of RG79, and the two caption '
  'reasons. Never `other`, never a message written to the member (RG78: one visual, one decision, '
  'a typed reason). Read by agent and admin in aal2; written by the migrations.';
comment on column profiles.portfolio_rejection_reasons.grid_control is
  'The control of the grid of RG79 (1 to 5, 7, 9); NULL for the caption reasons (RG82, RG83).';
comment on column profiles.portfolio_rejection_reasons.message_key is
  'Key of the message sent to the creator, in apps/api/src/locales/{fr,en}/email.json: '
  'portfolioDecision.reason.<code> (l2g/textes.md).';

insert into profiles.portfolio_rejection_reasons
  (code, label_key, message_key, grid_control, position)
values
  ('watermark',                    'reason.portfolio_moderation.watermark',
   'portfolioDecision.reason.watermark',                    1,    1),
  ('handle_in_image',              'reason.portfolio_moderation.handle_in_image',
   'portfolioDecision.reason.handle_in_image',              2,    2),
  ('app_interface',                'reason.portfolio_moderation.app_interface',
   'portfolioDecision.reason.app_interface',                3,    3),
  ('text_naming_account_or_brand', 'reason.portfolio_moderation.text_naming_account_or_brand',
   'portfolioDecision.reason.text_naming_account_or_brand', 4,    4),
  ('identifiable_place',           'reason.portfolio_moderation.identifiable_place',
   'portfolioDecision.reason.identifiable_place',           5,    5),
  ('statistics_screenshot',        'reason.portfolio_moderation.statistics_screenshot',
   'portfolioDecision.reason.statistics_screenshot',        7,    6),
  ('illicit_content',              'reason.portfolio_moderation.illicit_content',
   'portfolioDecision.reason.illicit_content',              9,    7),
  ('caption_identifier',           'reason.portfolio_moderation.caption_identifier',
   'portfolioDecision.reason.caption_identifier',           null, 8),
  ('caption_brand_unauthorised',   'reason.portfolio_moderation.caption_brand_unauthorised',
   'portfolioDecision.reason.caption_brand_unauthorised',   null, 9)
on conflict (code) do nothing;

-- 6.2 profiles.portfolio_items: the visual, its object, its entry of queue 3 -----------------------

create table if not exists profiles.portfolio_items (
  id                                uuid        not null primary key default gen_random_uuid(),
  account_id                        uuid        not null
                                                references profiles.creator_public_profiles (account_id),
  -- T9.3, T9.9: computed by the base, never a name or a path of the client (modele point 4)
  object_key                        text        not null
                                                generated always as
                                                  (account_id::text || '/' || id::text || '.webp') stored,
  state                             profiles.portfolio_item_state not null default 'uploading',
  replaces_item_id                  uuid,
  display_order                     smallint,
  received_bytes                    integer     not null,
  byte_size                         integer,
  width                             integer,
  height                            integer,
  checksum                          text,
  exif_stripped                     boolean     not null default false,
  caption                           text,
  brand_declaration_id              uuid,
  stored_at                         timestamptz,
  sla_due_at                        timestamptz,
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
  rejection_reason_code             text        references profiles.portfolio_rejection_reasons (code),
  internal_comment                  text,
  -- 04 l. 2238: the decision came after the deadline (15 C8: a late decision is possible, marked)
  sla_breached                      boolean     not null
                                                generated always as
                                                  (decided_at is not null and decided_at > sla_due_at)
                                                stored,
  retention_due_at                  timestamptz,
  withdrawn_at                      timestamptz,
  purge_requested_at                timestamptz,
  purge_attempts                    smallint    not null default 0,
  last_purge_attempt_at             timestamptz,
  purged_at                         timestamptz,
  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now(),

  -- target of the composite keys: a replacement and a declaration belong to a visual of ITS account
  constraint portfolio_items_id_account unique (id, account_id),
  constraint portfolio_items_replaces_fk
    foreign key (replaces_item_id, account_id)
    references profiles.portfolio_items (id, account_id),
  constraint portfolio_items_not_self_replacing check (replaces_item_id <> id),
  -- modele point 4: one attempt through the relay (8 MiB), the WebP of the bucket (8 MiB)
  constraint portfolio_items_received_bytes check (received_bytes between 1 and 8388608),
  constraint portfolio_items_byte_size check (byte_size between 1 and 8388608),
  -- EC-L2G-02-4: the sides of the evidence (D82 (2)): WebP, 4 096² pixels at most, 320 px at least
  constraint portfolio_items_sides
    check (width between 1 and 16383 and height between 1 and 16383
           and width::bigint * height::bigint <= 16777216
           and greatest(width, height) >= 320),
  constraint portfolio_items_checksum check (checksum ~ '^[0-9a-f]{64}$'),
  -- the stored output is described whole, or not at all
  constraint portfolio_items_stored_together
    check (pg_catalog.num_nulls(byte_size, width, height, checksum, stored_at) in (0, 5)),
  constraint portfolio_items_uploading_unstored
    check (state <> 'uploading' or (stored_at is null and not exif_stripped)),
  constraint portfolio_items_examined_stored
    check (state not in ('pending', 'approved', 'rejected', 'withdrawn') or stored_at is not null),
  -- T9.10, RG80, 04 l. 1290: a visual whose metadata were not removed cannot be approved
  constraint portfolio_items_approved_exif_stripped check (state <> 'approved' or exif_stripped),
  -- 04 §5.6: the deadlines come with the storage (the passage to pending)
  constraint portfolio_items_deadlines check ((stored_at is null) = (sla_due_at is null)),
  constraint portfolio_items_sla_after check (sla_due_at >= stored_at),
  constraint portfolio_items_escalate_after check (escalate_at >= sla_due_at),
  -- EC-L2G-02-5: a place 1 to 8 (RG77), held by a pending or approved visual only
  constraint portfolio_items_display_order check (display_order between 1 and 8),
  constraint portfolio_items_display_order_live
    check (display_order is null or state in ('pending', 'approved')),
  -- RG78: approved and rejected always carry the named person who decided; the decision is kept
  -- when the visual is withdrawn and purged (modele point 3)
  constraint portfolio_items_decided
    check ((state not in ('approved', 'rejected') or decided_by_account_id is not null)
           and (decided_by_account_id is null
                or state in ('approved', 'rejected', 'withdrawn', 'purging', 'purged'))),
  constraint portfolio_items_decided_together
    check ((decided_by_account_id is null) = (decided_at is null)),
  constraint portfolio_items_decided_after check (decided_at >= stored_at),
  -- RG78: a refusal is never mute; a reason on a refusal only (kept by its purge)
  constraint portfolio_items_rejection_reason
    check ((state <> 'rejected' or rejection_reason_code is not null)
           and (rejection_reason_code is null
                or (decided_by_account_id is not null
                    and state in ('rejected', 'purging', 'purged')))),
  -- the internal comment, never sent to the member, 1 000 printable characters at most
  constraint portfolio_items_internal_comment_length
    check (char_length(internal_comment) between 1 and 1000),
  constraint portfolio_items_internal_comment_text
    check (internal_comment ~ '[^[:space:]]'
           and internal_comment !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- EC-L2G-02-3, RG82: one line of 200 characters at most; emptied by the purge
  constraint portfolio_items_caption
    check (char_length(caption) between 1 and 200 and caption ~ '[^[:space:]]'
           and caption !~ '[[:cntrl:]]'),
  constraint portfolio_items_caption_purged check (state <> 'purged' or caption is null),
  -- 15 RG27 C1 to C3: a claim is whole (holder, instant, expiry), its expiry after it
  constraint portfolio_items_claim_together
    check ((claimed_by_account_id is null) = (claimed_at is null)
           and (claimed_at is null) = (claim_expires_at is null)),
  constraint portfolio_items_claim_expiry check (claim_expires_at > claimed_at),
  -- 15 C4: the last forced release is whole (instant, admin, dispossessed holder, reason)
  constraint portfolio_items_forced_release_together
    check (pg_catalog.num_nulls(forced_release_at, forced_release_by_account_id,
                                forced_release_holder_account_id, forced_release_reason_code)
           in (0, 4)),
  -- modele point 3, Q9: a refused or withdrawn visual is dated for its purge
  constraint portfolio_items_withdrawn
    check ((state <> 'withdrawn' or withdrawn_at is not null)
           and (withdrawn_at is null or state in ('withdrawn', 'purging', 'purged'))),
  constraint portfolio_items_retention
    check (state not in ('rejected', 'withdrawn') or retention_due_at is not null),
  -- purging and purged carry the instant of the request; purged, and only it, its removal
  constraint portfolio_items_purge_dated
    check ((state in ('purging', 'purged')) = (purge_requested_at is not null)),
  constraint portfolio_items_purged check ((state = 'purged') = (purged_at is not null)),
  constraint portfolio_items_purge_attempts check (purge_attempts >= 0)
);

-- EC-L2G-02-5: one visual per place of an account
create unique index if not exists portfolio_items_one_per_place
  on profiles.portfolio_items (account_id, display_order) where display_order is not null;
-- modele §2: one live replacement per visual
create unique index if not exists portfolio_items_one_live_replacement
  on profiles.portfolio_items (replaces_item_id)
  where replaces_item_id is not null and state in ('uploading', 'pending', 'approved');
-- queue 3 (15 RG26: oldest deadline first)
create index if not exists portfolio_items_queue_idx
  on profiles.portfolio_items (sla_due_at, created_at) where state = 'pending';
-- the visuals of an account (the creator's own reads, the record of the account, the doors)
create index if not exists portfolio_items_account_idx
  on profiles.portfolio_items (account_id, created_at);
-- the task storage_purge: abandoned uploads, the visuals past their retention, the rows to remove
create index if not exists portfolio_items_purge_idx
  on profiles.portfolio_items (state, retention_due_at)
  where state in ('uploading', 'rejected', 'withdrawn', 'purging');

comment on table profiles.portfolio_items is
  'One row per visual of a creator and per object of the private bucket portfolio (04 §5.11 rule 3; '
  'l2g/modele §2), written BEFORE the object. object_key, generated: <account_id>/<id>.webp (T9.3, '
  'T9.9). The entry of queue 3 IS the visual (15 RG29 portfolio_moderation; lock, deadlines frozen '
  'at pending, decision of RG78 with a reason of RG79). A replacement is a new row (replaces_item_id): '
  'the approved original stays served until the new one is approved (RG81, 04 l. 1493). A refused or '
  'withdrawn visual is removed from Storage portfolio_retention_days after (07 Q9). Life by the '
  'creator doors of 0242, the decisions of 0244, the erasure (0245) and the task storage_purge. Read '
  'by its creator (never the lock, the agent, the deadlines nor the internal comment) and by agent '
  'and admin in aal2, never on their own account, never the key. NO right of influx_advertiser '
  '(fiche invariant 1, D82 (7)).';
comment on column profiles.portfolio_items.replaces_item_id is
  'The approved visual of the same account this one replaces (RG81); it keeps its place until this '
  'one is approved (0244), then is withdrawn.';
comment on column profiles.portfolio_items.display_order is
  'The place 1 to 8 chosen by the creator (RG84: the order of the card), held by a pending or '
  'approved visual; NULL for an upload, a pending replacement and an ended visual.';
comment on column profiles.portfolio_items.exif_stripped is
  'True once apps/api re-encoded the bytes without any metadata before storing them (RG80, D82 (7)); '
  'an approval requires it (T9.10).';
comment on column profiles.portfolio_items.checksum is
  'SHA-256 of the stored WebP, lowercase hexadecimal; a change on a decided visual sends it back to '
  'pending (rereview_changed_portfolio_item, 04 l. 1291).';
comment on column profiles.portfolio_items.caption is
  'Moderated caption (RG82), one line of 200 characters at most; written by 0243; emptied by the '
  'purge and the erasure; never in a log, the register nor an outbox payload (fiche invariant 13).';
comment on column profiles.portfolio_items.sla_due_at is
  'Decision deadline, frozen at the passage to pending: backoffice.business_deadline('
  'portfolio_moderation, now(), target_decision_minutes) (04 §5.6, R7).';
comment on column profiles.portfolio_items.internal_comment is
  'Comment of the agent, 1 000 characters at most, NEVER shown to the member, sent by e-mail, '
  'written to the register nor exported.';
comment on column profiles.portfolio_items.retention_due_at is
  'Date of the removal of the object of a refused or withdrawn visual: the refusal or the withdrawal '
  '+ portfolio_retention_days (07 Q9, D79 (8)); the task storage_purge moves it to purging then.';

drop trigger if exists portfolio_items_touch_updated_at on profiles.portfolio_items;
create trigger portfolio_items_touch_updated_at
  before update on profiles.portfolio_items
  for each row execute function influx.touch_updated_at();

-- 6.3 profiles.portfolio_brand_declarations (RG83; modele §2) --------------------------------------

create table if not exists profiles.portfolio_brand_declarations (
  id                 uuid        not null primary key default gen_random_uuid(),
  account_id         uuid        not null references identity.accounts (id),
  portfolio_item_id  uuid        not null,
  caption            text        not null,
  statement_key      text        not null,
  declared_at        timestamptz not null default now(),

  constraint portfolio_brand_declarations_item_fk
    foreign key (portfolio_item_id, account_id)
    references profiles.portfolio_items (id, account_id),
  constraint portfolio_brand_declarations_id_item_account unique (id, portfolio_item_id, account_id),
  -- the caption declared, as the caption of the visual (EC-L2G-02-3)
  constraint portfolio_brand_declarations_caption
    check (char_length(caption) between 1 and 200 and caption ~ '[^[:space:]]'
           and caption !~ '[[:cntrl:]]'),
  -- RG83: the text of the box, word for word, under its key (l2g/textes.md)
  constraint portfolio_brand_declarations_statement_key
    check (statement_key = 'creatorProfile.portfolio.brandConsent')
);

create index if not exists portfolio_brand_declarations_item_idx
  on profiles.portfolio_brand_declarations (portfolio_item_id);

comment on table profiles.portfolio_brand_declarations is
  'The statement of RG83 (« Je confirme être autorisé à citer cette marque et à publier ce visuel »): '
  'the caption declared for a visual, the key of the text of the box, the instant; timestamped and '
  'kept, never updated (trigger). Written by the caption door of 0243; deleted by the erasure only. '
  'Read by its creator and by agent and admin in aal2, never on their own account.';

drop trigger if exists portfolio_brand_declarations_immutable on profiles.portfolio_brand_declarations;
create trigger portfolio_brand_declarations_immutable
  before update on profiles.portfolio_brand_declarations
  for each row execute function influx.assert_append_only();

-- the visual names its declaration (same visual, same account)
do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'portfolio_items_brand_declaration_fk'
                    and conrelid = 'profiles.portfolio_items'::regclass) then
    alter table profiles.portfolio_items add constraint portfolio_items_brand_declaration_fk
      foreign key (brand_declaration_id, id, account_id)
      references profiles.portfolio_brand_declarations (id, portfolio_item_id, account_id);
  end if;
end
$$;

-- 6.4 The visuals that count (RG4, RG88; modele point 5) -------------------------------------------

create or replace function profiles.deposited_portfolio_count(p_account_id uuid)
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
    from profiles.portfolio_items i
   where i.account_id = p_account_id
     and i.state in ('pending', 'approved')
     -- a pending replacement shares the place of its approved original
     and not (i.state = 'pending'
              and exists (select 1 from profiles.portfolio_items o
                           where o.id = i.replaces_item_id and o.state = 'approved'))
$$;

comment on function profiles.deposited_portfolio_count(uuid) is
  'RG4, RG88, l2g/modele point 5 (0242): the visuals « déposés » of p_account_id: pending or '
  'approved, a pending replacement of an approved visual apart (it shares its place); never the '
  'approvals alone. SECURITY INVOKER: runs with the rights and the policies of its caller (the doors '
  'of influx_creator_profile_definer, 0242 and 0243).';

-- 7. The life of a visual: re-examination and schedule (invokers, created by the migration role) --

-- 7.1 04 l. 1291, T9.10: a decided visual whose object changed is examined again
create or replace function profiles.rereview_changed_portfolio_item()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.state in ('approved', 'rejected')
     and (new.checksum is distinct from old.checksum
          or new.id is distinct from old.id
          or new.account_id is distinct from old.account_id) then
    new.state                 := 'pending';
    new.decided_by_account_id := null;
    new.decided_at            := null;
    new.rejection_reason_code := null;
    new.internal_comment      := null;
    new.claimed_by_account_id := null;
    new.claimed_at            := null;
    new.claim_expires_at      := null;
    new.retention_due_at      := null;
  end if;
  return new;
end
$$;

comment on function profiles.rereview_changed_portfolio_item() is
  'BEFORE UPDATE on profiles.portfolio_items (04 l. 1290-1292; 18 T9.10; modele point 3): an approved '
  'or refused visual whose checksum or key (id, account) changes goes back to pending, its decision, '
  'its claim and its date of purge emptied: no visual becomes publishable by a change of its object '
  '(RG81). A defence: no door changes the object of a decided visual. Fires before '
  'portfolio_items_schedule_entry (names in alphabetical order). SECURITY INVOKER.';

-- 7.2 The life moves forward; the deadlines, the retention and the purge are dated here only
create or replace function profiles.prepare_portfolio_item_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_decision  integer;
  v_escalate  integer;
  v_days      integer;
begin
  if tg_op = 'UPDATE' then
    if new.state is distinct from old.state
       and not ((old.state = 'uploading' and new.state in ('pending', 'purging'))
                or (old.state = 'pending'
                    and new.state in ('approved', 'rejected', 'withdrawn', 'purging'))
                or (old.state = 'approved' and new.state in ('pending', 'withdrawn', 'purging'))
                or (old.state = 'rejected' and new.state in ('pending', 'purging'))
                or (old.state = 'withdrawn' and new.state = 'purging')
                or (old.state = 'purging' and new.state = 'purged')) then
      raise exception 'portfolio item: % cannot become %', old.state, new.state
        using errcode = 'object_not_in_prerequisite_state', detail = 'item_state';
    end if;
    -- written once
    new.created_at       := old.created_at;
    new.received_bytes   := old.received_bytes;
    new.replaces_item_id := old.replaces_item_id;
    if old.stored_at is not null then
      new.stored_at := old.stored_at;
    end if;
  else
    new.created_at := pg_catalog.now();
    new.updated_at := pg_catalog.now();
  end if;

  -- 04 §5.6, D39: the deadlines of queue 3, at each passage to pending, whatever the writer gave
  if new.state = 'pending' and (tg_op = 'INSERT' or old.state is distinct from 'pending') then
    select p.target_decision_minutes, p.escalate_after_minutes
      into v_decision, v_escalate
      from backoffice.sla_policies p
     where p.queue_code = 'portfolio_moderation' and p.is_active;
    if not found then
      raise exception 'queue portfolio_moderation has no active delay policy'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    new.sla_due_at  := backoffice.business_deadline('portfolio_moderation', pg_catalog.now(),
                                                    v_decision);
    new.escalate_at := backoffice.business_deadline('portfolio_moderation', new.sla_due_at,
                                                    v_escalate);
  elsif tg_op = 'UPDATE' then
    new.sla_due_at  := old.sla_due_at;
    new.escalate_at := old.escalate_at;
  end if;

  if tg_op = 'UPDATE' and new.state is distinct from old.state then
    if new.state in ('rejected', 'withdrawn') then
      -- 07 Q9, D79 (8): the object of a refused or withdrawn visual is kept that long
      select (s.value)::integer into v_days
        from backoffice.operational_settings s where s.key = 'portfolio_retention_days';
      if v_days is null then
        raise exception 'portfolio_retention_days missing' using errcode = 'object_not_in_prerequisite_state';
      end if;
      new.retention_due_at := pg_catalog.now() + pg_catalog.make_interval(days => v_days);
      new.display_order    := null;
      if new.state = 'withdrawn' then
        new.withdrawn_at := pg_catalog.now();
      end if;
    elsif new.state = 'purging' then
      new.purge_requested_at := pg_catalog.now();
      new.display_order      := null;
    elsif new.state = 'purged' then
      new.purged_at := pg_catalog.now();
      new.caption   := null;
    end if;
  end if;
  return new;
end
$$;

comment on function profiles.prepare_portfolio_item_entry() is
  'BEFORE INSERT OR UPDATE on profiles.portfolio_items (0242; modele point 3; 04 §5.6): the state '
  'moves forward only (uploading -> pending, purging; pending -> approved, rejected, withdrawn, '
  'purging; approved -> pending, withdrawn, purging; rejected -> pending, purging; withdrawn -> '
  'purging; purging -> purged; else 55000 DETAIL item_state); created_at, received_bytes, '
  'replaces_item_id and a stored_at written once; at each passage to pending, sla_due_at and '
  'escalate_at computed from the policy of portfolio_moderation in force (frozen otherwise); a '
  'refused or withdrawn visual leaves its place and gets retention_due_at = now() + '
  'portfolio_retention_days (withdrawn_at too); purging dated and placeless; purged dated, its caption '
  'emptied. SECURITY INVOKER: the writer reads the policy and the setting and executes '
  'business_deadline() with its own rights.';

drop trigger if exists portfolio_items_rereview_changed on profiles.portfolio_items;
create trigger portfolio_items_rereview_changed
  before update on profiles.portfolio_items
  for each row execute function profiles.rereview_changed_portfolio_item();

drop trigger if exists portfolio_items_schedule_entry on profiles.portfolio_items;
create trigger portfolio_items_schedule_entry
  before insert or update on profiles.portfolio_items
  for each row execute function profiles.prepare_portfolio_item_entry();

revoke all on function profiles.rereview_changed_portfolio_item()
  from public, anon, authenticated, service_role;
revoke all on function profiles.prepare_portfolio_item_entry()
  from public, anon, authenticated, service_role;
revoke all on function profiles.deposited_portfolio_count(uuid)
  from public, anon, authenticated, service_role;

-- 8. Row level security and the rights of the business roles (fiche invariants 1, 14, 16) ----------

do $$
declare
  t text;
begin
  foreach t in array array['portfolio_rejection_reasons', 'portfolio_items',
                           'portfolio_brand_declarations']
  loop
    execute format('alter table profiles.%I enable row level security', t);
    execute format('alter table profiles.%I force row level security', t);
    execute format('revoke all on profiles.%I from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', t);
  end loop;
end
$$;

-- 8.1 The grid: agent and admin, aal2 (15 RG26)
grant select on profiles.portfolio_rejection_reasons to influx_agent, influx_admin;

drop policy if exists portfolio_rejection_reasons_internal_select
  on profiles.portfolio_rejection_reasons;
create policy portfolio_rejection_reasons_internal_select on profiles.portfolio_rejection_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 8.2 The visuals: the creator his own, without the lock, the agent, the deadlines, the comment nor
-- the checksum; agent and admin in aal2, never their own account, never the key (modele §2)
grant select (id, account_id, object_key, state, replaces_item_id, display_order, received_bytes,
              byte_size, width, height, exif_stripped, caption, brand_declaration_id, stored_at,
              decided_at, rejection_reason_code, retention_due_at, withdrawn_at, purged_at,
              created_at, updated_at)
   on profiles.portfolio_items to influx_creator;
grant select (id, account_id, state, replaces_item_id, display_order, received_bytes, byte_size,
              width, height, checksum, exif_stripped, caption, brand_declaration_id, stored_at,
              sla_due_at, escalate_at, claimed_by_account_id, claimed_at, claim_expires_at,
              forced_release_at, forced_release_by_account_id, forced_release_holder_account_id,
              forced_release_reason_code, decided_by_account_id, decided_at, rejection_reason_code,
              internal_comment, sla_breached, retention_due_at, withdrawn_at, purge_requested_at,
              purge_attempts, last_purge_attempt_at, purged_at, created_at, updated_at)
   on profiles.portfolio_items to influx_agent, influx_admin;

drop policy if exists portfolio_items_member_select_own on profiles.portfolio_items;
create policy portfolio_items_member_select_own on profiles.portfolio_items
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

-- 15 RG36, C(3): an internal never sees a visual of his own account
drop policy if exists portfolio_items_internal_select on profiles.portfolio_items;
create policy portfolio_items_internal_select on profiles.portfolio_items
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 8.3 The declarations: the creator his own; agent and admin in aal2, never their own account
grant select on profiles.portfolio_brand_declarations
   to influx_creator, influx_agent, influx_admin;

drop policy if exists portfolio_brand_declarations_member_select_own
  on profiles.portfolio_brand_declarations;
create policy portfolio_brand_declarations_member_select_own on profiles.portfolio_brand_declarations
  for select to influx_creator
  using (account_id = (select influx.current_account_id()));

drop policy if exists portfolio_brand_declarations_internal_select
  on profiles.portfolio_brand_declarations;
create policy portfolio_brand_declarations_internal_select on profiles.portfolio_brand_declarations
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2())
         and account_id is distinct from (select influx.current_account_id()));

-- 9. What influx_creator_profile_definer reads and writes (the caller's own rows) ------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner,
-- bound to the caller's own account (influx.current_account_id()).

grant usage on schema profiles, identity, backoffice, audit, influx to influx_creator_profile_definer;
grant execute on function influx.current_account_id(), influx.current_account_role()
   to influx_creator_profile_definer;
grant execute on function profiles.deposited_portfolio_count(uuid) to influx_creator_profile_definer;

-- 9.1 The caller: an active creator account. EC-L2G-02-9: the creator role rows of every account
-- (account_id, role), so that the policies below recognise a former creator
grant select (id, status) on identity.accounts to influx_creator_profile_definer;
grant select (account_id, role) on identity.account_roles to influx_creator_profile_definer;

drop policy if exists accounts_creator_profile_definer_select on identity.accounts;
create policy accounts_creator_profile_definer_select on identity.accounts
  for select to influx_creator_profile_definer
  using (id = (select influx.current_account_id()));
drop policy if exists account_roles_creator_profile_definer_select on identity.account_roles;
create policy account_roles_creator_profile_definer_select on identity.account_roles
  for select to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()) or role = 'creator');

-- 9.2 The storefront of the caller: its existence and its status (RG77 on a published profile)
grant select (account_id, status) on profiles.creator_public_profiles
   to influx_creator_profile_definer;

drop policy if exists creator_public_profiles_creator_profile_definer_select
  on profiles.creator_public_profiles;
create policy creator_public_profiles_creator_profile_definer_select
  on profiles.creator_public_profiles
  for select to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()));

-- 9.3 The visuals of the caller, and those of a former creator (EC-L2G-02-9, modele -15)
grant select (id, account_id, object_key, state, replaces_item_id, display_order, received_bytes,
              byte_size, checksum, stored_at, created_at)
   on profiles.portfolio_items to influx_creator_profile_definer;
grant insert (account_id, received_bytes, replaces_item_id)
   on profiles.portfolio_items to influx_creator_profile_definer;
grant update (state, byte_size, width, height, checksum, exif_stripped, stored_at, display_order)
   on profiles.portfolio_items to influx_creator_profile_definer;
grant delete on profiles.portfolio_items to influx_creator_profile_definer;

drop policy if exists portfolio_items_creator_profile_definer_select on profiles.portfolio_items;
create policy portfolio_items_creator_profile_definer_select on profiles.portfolio_items
  for select to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id())
         or not exists (select 1 from identity.account_roles r
                         where r.account_id = portfolio_items.account_id and r.role = 'creator'));
drop policy if exists portfolio_items_creator_profile_definer_insert on profiles.portfolio_items;
create policy portfolio_items_creator_profile_definer_insert on profiles.portfolio_items
  for insert to influx_creator_profile_definer
  with check (account_id = (select influx.current_account_id()) and state = 'uploading');
-- the doors never write a decision, a refusal nor a purged row
drop policy if exists portfolio_items_creator_profile_definer_update on profiles.portfolio_items;
create policy portfolio_items_creator_profile_definer_update on profiles.portfolio_items
  for update to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id())
         or not exists (select 1 from identity.account_roles r
                         where r.account_id = portfolio_items.account_id and r.role = 'creator'))
  with check (state in ('uploading', 'pending', 'approved', 'withdrawn', 'purging'));
drop policy if exists portfolio_items_creator_profile_definer_delete on profiles.portfolio_items;
create policy portfolio_items_creator_profile_definer_delete on profiles.portfolio_items
  for delete to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()) and state = 'uploading');

-- 9.4 The quotas of the bucket, the caller's daily usage of it
grant select (bucket_id, max_uploads_per_day, max_bytes_per_day)
   on profiles.storage_quotas to influx_creator_profile_definer;

drop policy if exists storage_quotas_creator_profile_definer_select on profiles.storage_quotas;
create policy storage_quotas_creator_profile_definer_select on profiles.storage_quotas
  for select to influx_creator_profile_definer
  using (bucket_id = 'portfolio');

grant select (account_id, bucket_id, usage_day, upload_count, received_bytes),
      insert (account_id, bucket_id, usage_day),
      update (upload_count, received_bytes)
   on profiles.storage_daily_usage to influx_creator_profile_definer;

drop policy if exists storage_daily_usage_creator_profile_definer_own
  on profiles.storage_daily_usage;
create policy storage_daily_usage_creator_profile_definer_own on profiles.storage_daily_usage
  for all to influx_creator_profile_definer
  using (account_id = (select influx.current_account_id()) and bucket_id = 'portfolio')
  with check (account_id = (select influx.current_account_id()) and bucket_id = 'portfolio');

-- 9.5 The delay of queue 3 and the retention (the trigger of 7.2, invoker, reads them)
grant select (key, value) on backoffice.operational_settings to influx_creator_profile_definer;
grant select (queue_code, is_active, target_decision_minutes, escalate_after_minutes, business_hours)
   on backoffice.sla_policies to influx_creator_profile_definer;
grant execute on function backoffice.business_deadline(text, timestamptz, integer)
   to influx_creator_profile_definer;

drop policy if exists operational_settings_creator_profile_definer_select
  on backoffice.operational_settings;
create policy operational_settings_creator_profile_definer_select
  on backoffice.operational_settings
  for select to influx_creator_profile_definer
  using (key = 'portfolio_retention_days');
drop policy if exists sla_policies_creator_profile_definer_select on backoffice.sla_policies;
create policy sla_policies_creator_profile_definer_select on backoffice.sla_policies
  for select to influx_creator_profile_definer
  using (queue_code = 'portfolio_moderation');

-- 9.6 The register, through audit.append(), granted by its owner (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_creator_profile_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

insert into audit.event_types (code, domain, subject_type, severity) values
  -- modele §4: a deposit (kind, replaced visual) and a withdrawal (cause), ids and codes only
  ('portfolio.deposited', 'profiles', 'portfolio_item', 'info'),
  ('portfolio.withdrawn', 'profiles', 'portfolio_item', 'info')
on conflict (code) do nothing;

-- 10. What influx_maintenance_definer reaches: the retention of the visuals ------------------------
-- Never an account, a size, a checksum nor a caption; never a pending nor an approved visual. The
-- SELECT policy sees the purged rows: an UPDATE checks its NEW row against it (purging -> purged).

grant select (id, object_key, state, created_at, retention_due_at, purge_requested_at,
              purge_attempts, last_purge_attempt_at),
      update (state, purge_attempts, last_purge_attempt_at)
   on profiles.portfolio_items to influx_maintenance_definer;

drop policy if exists portfolio_items_maintenance_definer_select on profiles.portfolio_items;
create policy portfolio_items_maintenance_definer_select on profiles.portfolio_items
  for select to influx_maintenance_definer
  using (state in ('uploading', 'rejected', 'withdrawn', 'purging', 'purged'));
drop policy if exists portfolio_items_maintenance_definer_update on profiles.portfolio_items;
create policy portfolio_items_maintenance_definer_update on profiles.portfolio_items
  for update to influx_maintenance_definer
  using (state in ('uploading', 'rejected', 'withdrawn', 'purging'))
  with check (state in ('purging', 'purged'));

-- 11. The six creator doors and the trigger of a former creator (created by the migration role,
-- handed to their owner in section 12) --------------------------------------------------------------

-- (b) The quotas consumed, the place checked and the row written, before any byte is decoded ------
create or replace function profiles.begin_portfolio_upload(
  p_received_bytes    integer,
  p_replaces_item_id  uuid)
returns table (
  item_id     uuid,
  object_key  text
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
  v_day      date := (pg_catalog.now() at time zone 'UTC')::date;
  v_quota    record;
  v_usage    record;
  v_state    text;
  v_places   integer;
  v_id       uuid;
  v_key      text;
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
           where a.id = v_account and a.status = 'active')
     or not exists (select 1 from profiles.creator_public_profiles p where p.account_id = v_account) then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- modele point 4: what the relay may carry on the route of the deposit (D82 (7))
  if p_received_bytes is null or p_received_bytes < 1 or p_received_bytes > 8388608 then
    raise exception 'received_bytes' using errcode = 'invalid_parameter_value', detail = 'received_bytes';
  end if;

  select q.max_uploads_per_day, q.max_bytes_per_day
    into v_quota
    from profiles.storage_quotas q
   where q.bucket_id = 'portfolio';
  if not found then
    raise exception 'no quota for portfolio' using errcode = 'object_not_in_prerequisite_state';
  end if;

  insert into profiles.storage_daily_usage (account_id, bucket_id, usage_day)
  values (v_account, 'portfolio', v_day)
  on conflict (account_id, bucket_id, usage_day) do nothing;

  -- The row lock serialises two concurrent deposits of the account (T9.8 at the exact frontier, the
  -- eight places of RG77, one live replacement per visual).
  select u.upload_count, u.received_bytes
    into v_usage
    from profiles.storage_daily_usage u
   where u.account_id = v_account and u.bucket_id = 'portfolio' and u.usage_day = v_day
     for update;

  if p_replaces_item_id is not null then
    -- RG81: an approved visual of the caller, one replacement at a time
    select i.state::text into v_state
      from profiles.portfolio_items i
     where i.id = p_replaces_item_id and i.account_id = v_account
       for update;
    if not found then
      raise exception 'forbidden' using errcode = 'insufficient_privilege';
    end if;
    if v_state <> 'approved' then
      raise exception 'not_replaceable' using
        errcode = 'object_not_in_prerequisite_state', detail = 'not_replaceable';
    end if;
    if exists (select 1 from profiles.portfolio_items i
                where i.replaces_item_id = p_replaces_item_id
                  and i.state in ('uploading', 'pending')) then
      raise exception 'replacement_pending' using
        errcode = 'object_not_in_prerequisite_state', detail = 'replacement_pending';
    end if;
  else
    -- RG77: eight places, the visuals deposited and the uploads in progress (a replacement apart)
    select profiles.deposited_portfolio_count(v_account) + count(*)::integer
      into v_places
      from profiles.portfolio_items i
     where i.account_id = v_account and i.state = 'uploading'
       and not exists (select 1 from profiles.portfolio_items o
                        where o.id = i.replaces_item_id and o.state = 'approved');
    if v_places >= 8 then
      raise exception 'portfolio_full' using
        errcode = 'object_not_in_prerequisite_state', detail = 'portfolio_full';
    end if;
  end if;

  if v_usage.upload_count + 1 > v_quota.max_uploads_per_day then
    raise exception 'upload_quota_exceeded'
      using errcode = 'program_limit_exceeded', detail = 'uploads';
  end if;
  if v_usage.received_bytes + p_received_bytes > v_quota.max_bytes_per_day then
    raise exception 'upload_quota_exceeded'
      using errcode = 'program_limit_exceeded', detail = 'bytes';
  end if;

  update profiles.storage_daily_usage u
     set upload_count = u.upload_count + 1,
         received_bytes = u.received_bytes + p_received_bytes
   where u.account_id = v_account and u.bucket_id = 'portfolio' and u.usage_day = v_day;

  insert into profiles.portfolio_items as i (account_id, received_bytes, replaces_item_id)
  values (v_account, p_received_bytes, p_replaces_item_id)
  returning i.id, i.object_key into v_id, v_key;

  return query select v_id, v_key;
end
$$;

comment on function profiles.begin_portfolio_upload(integer, uuid) is
  'l2g/modele point 4, §3; 07 RG77, RG81; 18 T9.8 (0242): an active creator starts the deposit of '
  'p_received_bytes (1 to 8 388 608, 22023 received_bytes), a new visual (p_replaces_item_id NULL) '
  'or the replacement of one of his approved visuals. In ONE transaction, the usage of the UTC day '
  'locked: a new visual needs a place (8 at most, the deposited and the uploading ones: 55000 '
  'portfolio_full); a replacement an approved visual (55000 not_replaceable) without another live '
  'replacement (55000 replacement_pending); the usage counted (54000 upload_quota_exceeded DETAIL '
  'uploads or bytes beyond profiles.storage_quotas); the row uploading written. Returns (item_id, '
  'object_key), the key generated by the base (<account>/<id>.webp, T9.3, T9.9). 42501 outside an '
  'active creator account holding a storefront, and for another''s visual as for an unknown one. '
  'SECURITY DEFINER owned by influx_creator_profile_definer, empty search_path; EXECUTE for '
  'influx_creator only.';

-- (c) Refused by the checks of the bytes: the uploading row deleted -------------------------------
create or replace function profiles.discard_portfolio_upload(p_item_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  delete from profiles.portfolio_items i
   where i.id = p_item_id and i.account_id = v_account and i.state = 'uploading';
  return found;
end
$$;

comment on function profiles.discard_portfolio_upload(uuid) is
  'D82 (2), (7) (0242): the deposit p_item_id of the caller, refused by the checks of its bytes '
  '(type, pixels, output), is forgotten: its UPLOADING row deleted (no object was written). Returns '
  'false when the caller holds no such row. The quotas stay consumed. 42501 outside a creator '
  'context. SECURITY DEFINER owned by influx_creator_profile_definer; EXECUTE for influx_creator only.';

-- (d) The Storage write failed: the object may exist, the row goes to purging ----------------------
create or replace function profiles.fail_portfolio_upload(p_item_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
begin
  if v_account is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  update profiles.portfolio_items i
     set state = 'purging'
   where i.id = p_item_id and i.account_id = v_account and i.state = 'uploading';
  return found;
end
$$;

comment on function profiles.fail_portfolio_upload(uuid) is
  'D80 (5) (0242): the Storage write of the deposit p_item_id failed, or its storage was refused; '
  'its UPLOADING row passes to purging (an object may have been written), removed by the task '
  'storage_purge. Returns false when the caller holds no such row. 42501 outside a creator context. '
  'SECURITY DEFINER owned by influx_creator_profile_definer; EXECUTE for influx_creator only.';

-- (e) The object stored: the visual enters queue 3 ---------------------------------------------------
create or replace function profiles.store_portfolio_item(
  p_item_id    uuid,
  p_byte_size  integer,
  p_width      integer,
  p_height     integer,
  p_checksum   text)
returns table (
  state          text,
  display_order  smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account      uuid := influx.current_account_id();
  v_row          record;
  v_replacement  boolean;
  v_order        smallint;
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
  -- every visual of the account locked: the free place and the original of a replacement stay as read
  perform 1 from profiles.portfolio_items i where i.account_id = v_account for update;

  select i.state::text as state, i.replaces_item_id into v_row
    from profiles.portfolio_items i
   where i.id = p_item_id and i.account_id = v_account;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_row.state <> 'uploading' then
    raise exception 'item_not_uploading' using
      errcode = 'object_not_in_prerequisite_state', detail = 'item_not_uploading';
  end if;
  if p_checksum is null or p_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'checksum' using errcode = 'invalid_parameter_value', detail = 'checksum';
  end if;

  v_replacement := v_row.replaces_item_id is not null;
  if v_replacement then
    -- RG81: the original is still the approved one it replaces (it keeps its place, 0244)
    perform 1 from profiles.portfolio_items o
     where o.id = v_row.replaces_item_id and o.state = 'approved';
    if not found then
      raise exception 'not_replaceable' using
        errcode = 'object_not_in_prerequisite_state', detail = 'not_replaceable';
    end if;
  else
    -- EC-L2G-02-5: the smallest free place
    select min(s.place)::smallint into v_order
      from pg_catalog.generate_series(1, 8) as s (place)
     where not exists (select 1 from profiles.portfolio_items i
                        where i.account_id = v_account and i.display_order = s.place);
    if v_order is null then
      raise exception 'portfolio_full' using
        errcode = 'object_not_in_prerequisite_state', detail = 'portfolio_full';
    end if;
  end if;

  -- RG80: apps/api stores only what it re-encoded without any metadata (T9.5); the constraints
  -- hold the sizes (23514 beyond them); the trigger freezes the deadlines of queue 3
  update profiles.portfolio_items i
     set state = 'pending', byte_size = p_byte_size, width = p_width, height = p_height,
         checksum = p_checksum, exif_stripped = true, stored_at = pg_catalog.now(),
         display_order = v_order
   where i.id = p_item_id;

  perform audit.append('portfolio.deposited', 'portfolio_item', p_item_id,
                       pg_catalog.jsonb_build_object(
                         'kind', case when v_replacement then 'replacement' else 'deposit' end,
                         'replaces_item_id', v_row.replaces_item_id));

  return query select 'pending'::text, v_order;
end
$$;

comment on function profiles.store_portfolio_item(uuid, integer, integer, integer, text) is
  'D82 (2), (7); 07 RG78, RG80, RG81; modele §3 (0242): the WebP of the deposit p_item_id, '
  're-encoded by apps/api without any metadata, is stored (p_byte_size bytes, p_width x p_height, '
  'p_checksum its SHA-256 in lowercase hexadecimal, 22023 checksum otherwise); its UPLOADING row '
  'becomes pending (exif_stripped, the deadlines of queue 3 frozen by the trigger) and takes the '
  'smallest free place, unless it replaces an approved visual (which keeps its place; 55000 '
  'not_replaceable when it no longer is approved). Writes portfolio.deposited {kind deposit | '
  'replacement, replaces_item_id}. Returns (state, display_order). 55000 item_not_uploading, '
  'portfolio_full; 23514 when a size is out of bounds; 42501 outside an active creator account, and '
  'for another''s visual as for an unknown one. SECURITY DEFINER owned by '
  'influx_creator_profile_definer, empty search_path; EXECUTE for influx_creator only.';

-- The order of the placed visuals (RG84) --------------------------------------------------------------
create or replace function profiles.reorder_own_portfolio(p_item_ids uuid[])
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_placed   uuid[];
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
  perform 1 from profiles.portfolio_items i where i.account_id = v_account for update;

  select coalesce(pg_catalog.array_agg(i.id), '{}'::uuid[]) into v_placed
    from profiles.portfolio_items i
   where i.account_id = v_account and i.display_order is not null;

  -- every placed visual of the caller, once each, and nothing else (an unknown or another's id
  -- answers as a wrong list, T14)
  if p_item_ids is null
     or pg_catalog.cardinality(p_item_ids) <> pg_catalog.cardinality(v_placed)
     or (select count(distinct x) from pg_catalog.unnest(p_item_ids) as x)
          <> pg_catalog.cardinality(p_item_ids)
     or exists (select 1 from pg_catalog.unnest(p_item_ids) as x where x is null or x <> all (v_placed)) then
    raise exception 'order' using errcode = 'invalid_parameter_value', detail = 'order';
  end if;
  if pg_catalog.cardinality(p_item_ids) = 0 then
    return;
  end if;

  -- two statements: no place is ever held twice on the way
  update profiles.portfolio_items i
     set display_order = null
   where i.account_id = v_account and i.display_order is not null;
  update profiles.portfolio_items i
     set display_order = o.place::smallint
    from pg_catalog.unnest(p_item_ids) with ordinality as o (item_id, place)
   where i.id = o.item_id and i.account_id = v_account;
end
$$;

comment on function profiles.reorder_own_portfolio(uuid[]) is
  '07 RG84 (0242): an active creator gives the order of his placed visuals (pending and approved, a '
  'pending replacement apart): p_item_ids lists each of them once, the first at place 1. Anything '
  'else, an unknown or another''s visual included, 22023 order. No register line (the order is not '
  'moderated). 42501 outside an active creator account. SECURITY DEFINER owned by '
  'influx_creator_profile_definer, empty search_path; EXECUTE for influx_creator only.';

-- DELETE: a visual withdrawn by its creator, kept 30 days (modele point 3) --------------------------
create or replace function profiles.remove_own_portfolio_item(p_item_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_row      record;
  v_status   text;
  v_id       uuid;
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
  -- every visual of the account locked: two removals follow each other (the minimum of RG77)
  perform 1 from profiles.portfolio_items i where i.account_id = v_account for update;

  select i.state::text as state, i.replaces_item_id into v_row
    from profiles.portfolio_items i
   where i.id = p_item_id and i.account_id = v_account;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_row.state not in ('pending', 'approved') then
    return false;
  end if;

  -- RG77: a published profile keeps three visuals deposited (a pending replacement does not count)
  if not (v_row.state = 'pending'
          and exists (select 1 from profiles.portfolio_items o
                       where o.id = v_row.replaces_item_id and o.state = 'approved')) then
    select p.status::text into v_status
      from profiles.creator_public_profiles p where p.account_id = v_account;
    if v_status = 'published' and profiles.deposited_portfolio_count(v_account) <= 3 then
      raise exception 'portfolio_minimum' using
        errcode = 'object_not_in_prerequisite_state', detail = 'portfolio_minimum';
    end if;
  end if;

  -- EC-L2G-02-6: the replacement in progress of an approved visual leaves with it
  if v_row.state = 'approved' then
    update profiles.portfolio_items i
       set state = 'purging'
     where i.replaces_item_id = p_item_id and i.account_id = v_account and i.state = 'uploading';
    for v_id in
      update profiles.portfolio_items i
         set state = 'withdrawn'
       where i.replaces_item_id = p_item_id and i.account_id = v_account and i.state = 'pending'
      returning i.id
    loop
      perform audit.append('portfolio.withdrawn', 'portfolio_item', v_id,
                           pg_catalog.jsonb_build_object('cause', 'removed'));
    end loop;
  end if;

  update profiles.portfolio_items i
     set state = 'withdrawn'
   where i.id = p_item_id;
  perform audit.append('portfolio.withdrawn', 'portfolio_item', p_item_id,
                       pg_catalog.jsonb_build_object('cause', 'removed'));
  return true;
end
$$;

comment on function profiles.remove_own_portfolio_item(uuid) is
  'l2g/modele point 3; 07 RG77, Q9 (0242): an active creator withdraws his pending or approved '
  'visual p_item_id: it passes to withdrawn (its place freed, its object kept portfolio_retention_days '
  'then removed by the task storage_purge, never at once); an approved one takes its replacement in '
  'progress with it (pending -> withdrawn, uploading -> purging, EC-L2G-02-6). Writes '
  'portfolio.withdrawn {cause removed} for each. Returns false when the visual is neither pending nor '
  'approved. 55000 portfolio_minimum when the profile is published and would keep fewer than 3 '
  'deposited visuals; 42501 outside an active creator account, and for another''s visual as for an '
  'unknown one. SECURITY DEFINER owned by influx_creator_profile_definer, empty search_path; EXECUTE '
  'for influx_creator only.';

-- AFTER DELETE of a creator role (modele -15): the visuals of the former creator leave ------------
create or replace function profiles.withdraw_portfolio_of_former_creator()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id  uuid;
begin
  -- the account still holds the creator role (a row deleted and inserted again): nothing to do
  if exists (select 1 from identity.account_roles r
              where r.account_id = old.account_id and r.role = 'creator') then
    return null;
  end if;
  update profiles.portfolio_items i
     set state = 'purging'
   where i.account_id = old.account_id and i.state = 'uploading';
  for v_id in
    update profiles.portfolio_items i
       set state = 'withdrawn'
     where i.account_id = old.account_id and i.state in ('pending', 'approved')
    returning i.id
  loop
    perform audit.append('portfolio.withdrawn', 'portfolio_item', v_id,
                         pg_catalog.jsonb_build_object('cause', 'former_creator'));
  end loop;
  return null;
end
$$;

comment on function profiles.withdraw_portfolio_of_former_creator() is
  'AFTER DELETE on identity.account_roles, a creator role, never on the erasure (WHEN current_user <> '
  'influx_privacy_definer; 0245 owns it) (l2g/modele -15; 0242): the account no longer being a '
  'creator, its pending and approved visuals are withdrawn (their entries of queue 3 closed, their '
  'objects kept portfolio_retention_days), an upload in progress purged; portfolio.withdrawn {cause '
  'former_creator} for each. SECURITY DEFINER owned by influx_creator_profile_definer, empty '
  'search_path; no EXECUTE for anyone.';

drop trigger if exists account_roles_withdraw_portfolio on identity.account_roles;
create trigger account_roles_withdraw_portfolio
  after delete on identity.account_roles
  for each row when (old.role = 'creator' and current_user <> 'influx_privacy_definer')
  execute function profiles.withdraw_portfolio_of_former_creator();

-- 12. Rights and owners of the doors and of the trigger (03 P7 rule 5) -----------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'profiles.begin_portfolio_upload(integer, uuid)',
    'profiles.discard_portfolio_upload(uuid)',
    'profiles.fail_portfolio_upload(uuid)',
    'profiles.store_portfolio_item(uuid, integer, integer, integer, text)',
    'profiles.reorder_own_portfolio(uuid[])',
    'profiles.remove_own_portfolio_item(uuid)',
    'profiles.withdraw_portfolio_of_former_creator()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', f);
  end loop;
end
$$;

grant execute on function
  profiles.begin_portfolio_upload(integer, uuid),
  profiles.discard_portfolio_upload(uuid),
  profiles.fail_portfolio_upload(uuid),
  profiles.store_portfolio_item(uuid, integer, integer, integer, text),
  profiles.reorder_own_portfolio(uuid[]),
  profiles.remove_own_portfolio_item(uuid)
  to influx_creator;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_profile_definer', current_user);
end
$$;
grant create on schema profiles to influx_creator_profile_definer;

alter function profiles.begin_portfolio_upload(integer, uuid)
  owner to influx_creator_profile_definer;
alter function profiles.discard_portfolio_upload(uuid)
  owner to influx_creator_profile_definer;
alter function profiles.fail_portfolio_upload(uuid)
  owner to influx_creator_profile_definer;
alter function profiles.store_portfolio_item(uuid, integer, integer, integer, text)
  owner to influx_creator_profile_definer;
alter function profiles.reorder_own_portfolio(uuid[])
  owner to influx_creator_profile_definer;
alter function profiles.remove_own_portfolio_item(uuid)
  owner to influx_creator_profile_definer;
alter function profiles.withdraw_portfolio_of_former_creator()
  owner to influx_creator_profile_definer;

revoke create on schema profiles from influx_creator_profile_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_profile_definer', current_user);
end
$$;

-- 13. E-4: the claim and the purge of the three buckets, as influx_maintenance_definer -------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;
set role influx_maintenance_definer;

-- 13.1 The objects to remove (same signature and result as 0223) -----------------------------------
create or replace function ops.claim_storage_purges(
  p_run_id   uuid,
  p_attempt  smallint,
  p_limit    integer default 100
)
returns table (
  object_id   uuid,
  bucket_id   text,
  object_key  text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_logos     integer;
  v_evidence  integer := 0;
begin
  if p_limit is null or p_limit not between 1 and 1000 then
    raise exception 'the batch size is between 1 and 1000' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'storage_purge') then
    raise exception 'no open storage_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- The logo, as 0205: an upload left pending for 15 minutes is abandoned (its object may exist);
  -- purging first, so that a late activation is refused (EC-L2B-09-3). Never active nor in_review.
  update profiles.brand_logo_objects l
     set state = 'purging', purge_requested_at = pg_catalog.now()
   where l.state = 'pending'
     and l.created_at < pg_catalog.now() - interval '15 minutes';

  -- The evidence (0223): the same abandoned deposit; an active evidence at its date of purge (RG86),
  -- never before it, never while its request waits in the queue (EC-L2E-07-3)
  update verification.evidence_files e
     set state = 'purging', purge_requested_at = pg_catalog.now()
   where e.state = 'pending'
     and e.created_at < pg_catalog.now() - interval '15 minutes';
  update verification.evidence_files e
     set state = 'purging', purge_requested_at = pg_catalog.now()
   where e.state = 'active'
     and e.retention_due_at <= pg_catalog.now()
     and not exists (select 1 from verification.verification_requests r
                      where r.id = e.request_id and r.status = 'pending');

  -- The visuals (0242, modele point 3): the same abandoned upload; a refused or withdrawn visual at
  -- its date (07 Q9, D79 (8)), never before it; never a pending nor an approved one. The trigger of
  -- the table dates the request.
  update profiles.portfolio_items i
     set state = 'purging'
   where i.state = 'uploading'
     and i.created_at < pg_catalog.now() - interval '15 minutes';
  update profiles.portfolio_items i
     set state = 'purging'
   where i.state in ('rejected', 'withdrawn')
     and i.retention_due_at <= pg_catalog.now();

  -- a row tried in the last 30 minutes waits for the next hour (no loop inside one run)
  return query
    with picked as (
      select l.id
        from profiles.brand_logo_objects l
       where l.state = 'purging'
         and (l.last_purge_attempt_at is null
              or l.last_purge_attempt_at < pg_catalog.now() - interval '30 minutes')
       order by l.purge_requested_at, l.id
       limit p_limit
         for update skip locked
    )
    update profiles.brand_logo_objects l
       set purge_attempts = least(l.purge_attempts + 1, 32767)::smallint,
           last_purge_attempt_at = pg_catalog.now()
      from picked
     where l.id = picked.id
    returning l.id, 'brand-logo'::text, l.object_key;
  get diagnostics v_logos = row_count;

  if v_logos < p_limit then
    return query
      with picked as (
        select e.id
          from verification.evidence_files e
         where e.state = 'purging'
           and (e.last_purge_attempt_at is null
                or e.last_purge_attempt_at < pg_catalog.now() - interval '30 minutes')
         order by e.purge_requested_at, e.id
         limit p_limit - v_logos
           for update skip locked
      )
      update verification.evidence_files e
         set purge_attempts = least(e.purge_attempts + 1, 32767)::smallint,
             last_purge_attempt_at = pg_catalog.now()
        from picked
       where e.id = picked.id
      returning e.id, 'verification-evidence'::text, e.object_key;
    get diagnostics v_evidence = row_count;
  end if;

  if v_logos + v_evidence < p_limit then
    return query
      with picked as (
        select i.id
          from profiles.portfolio_items i
         where i.state = 'purging'
           and (i.last_purge_attempt_at is null
                or i.last_purge_attempt_at < pg_catalog.now() - interval '30 minutes')
         order by i.purge_requested_at, i.id
         limit p_limit - v_logos - v_evidence
           for update skip locked
      )
      update profiles.portfolio_items i
         set purge_attempts = least(i.purge_attempts + 1, 32767)::smallint,
             last_purge_attempt_at = pg_catalog.now()
        from picked
       where i.id = picked.id
      returning i.id, 'portfolio'::text, i.object_key;
  end if;
end
$$;

comment on function ops.claim_storage_purges(uuid, smallint, integer) is
  'E-4 storage_purge (stockage.md §7; 0223; 0242, l2g/modele point 3): the pending logo rows, the '
  'pending evidence rows and the uploading visuals older than 15 minutes pass to purging, with the '
  'active evidence whose retention_due_at has come (never one of a pending request, EC-L2E-07-3) and '
  'the refused or withdrawn visuals whose retention_due_at has come (07 Q9); then at most p_limit (1 '
  'to 1000, 100 by default) purging rows not tried in the last 30 minutes are taken, the logo first, '
  'then the evidence, then the visuals (SKIP LOCKED), purge_attempts + 1 and last_purge_attempt_at = '
  'now(), and their (object_id, bucket_id, object_key) returned for the removal through the API of '
  'Storage. Inside the open storage_purge run of this attempt only (55000 otherwise). Never an active '
  'logo, an active evidence before its date, a pending nor an approved visual. SECURITY DEFINER owned '
  'by influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

-- 13.2 The objects removed: a logo row deleted, an evidence row and a visual purged and kept -------
create or replace function ops.complete_storage_purges(
  p_run_id      uuid,
  p_attempt     smallint,
  p_object_ids  uuid[]
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_logos     integer;
  v_evidence  integer;
  v_visuals   integer;
begin
  if p_object_ids is null or pg_catalog.cardinality(p_object_ids) not between 1 and 1000 then
    raise exception 'between 1 and 1000 object ids' using errcode = 'invalid_parameter_value';
  end if;
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code = 'storage_purge') then
    raise exception 'no open storage_purge run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  delete from profiles.brand_logo_objects l
   where l.id = any (p_object_ids) and l.state = 'purging';
  get diagnostics v_logos = row_count;

  -- RG86: the object gone, the row, its checksum and the findings kept (3 years, L2F)
  update verification.evidence_files e
     set state = 'purged', deleted_at = pg_catalog.now()
   where e.id = any (p_object_ids) and e.state = 'purging';
  get diagnostics v_evidence = row_count;

  -- modele point 3: the object gone, the row and its decision kept, the caption emptied (trigger)
  update profiles.portfolio_items i
     set state = 'purged'
   where i.id = any (p_object_ids) and i.state = 'purging';
  get diagnostics v_visuals = row_count;

  if v_logos > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'brand_logo_objects',
                                                       'count', v_logos));
  end if;
  if v_evidence > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_evidence_files',
                                                       'count', v_evidence));
  end if;
  if v_visuals > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'portfolio_objects',
                                                       'count', v_visuals));
  end if;
  return v_logos + v_evidence + v_visuals;
end
$$;

comment on function ops.complete_storage_purges(uuid, smallint, uuid[]) is
  'E-4 storage_purge (stockage.md §7; 0223; 0242): the purging rows of p_object_ids (1 to 1000), '
  'whose object the worker removed from Storage: a logo row is deleted (0204), an evidence row '
  'becomes purged (deleted_at = now(); the row, its checksum and the findings kept, RG86), a visual '
  'becomes purged (purged_at = now(); the row and its decision kept, its caption emptied, modele '
  'point 3). Writes retention.purged {category brand_logo_objects | verification_evidence_files | '
  'portfolio_objects, count} on the run for each that changed. Inside the open storage_purge run of '
  'this attempt only (55000 otherwise). Returns the count. SECURITY DEFINER owned by '
  'influx_maintenance_definer, empty search_path; EXECUTE for influx_worker ONLY.';

revoke all on function ops.claim_storage_purges(uuid, smallint, integer)
  from public, anon, authenticated, service_role;
revoke all on function ops.complete_storage_purges(uuid, smallint, uuid[])
  from public, anon, authenticated, service_role;
grant execute on function ops.claim_storage_purges(uuid, smallint, integer) to influx_worker;
grant execute on function ops.complete_storage_purges(uuid, smallint, uuid[]) to influx_worker;

reset role;

revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 14. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  -- modele §4, 18 T9.1: every bucket private; portfolio WebP only, 8 MiB
  select string_agg(b.id, ', ') into v_bad from storage.buckets b where b.public is not false;
  if v_bad is not null then
    raise exception 'public bucket(s): %', v_bad;
  end if;
  if not exists (select 1 from storage.buckets b
                  where b.id = 'portfolio' and b.public = false and b.file_size_limit = 8388608
                    and b.allowed_mime_types = array['image/webp']) then
    raise exception 'the bucket portfolio is not private, WebP only, 8 MiB';
  end if;

  -- 03 P10.6: the restrictive policy on storage.objects and storage.buckets (0204) still there
  select string_agg(t, ', ') into v_bad
    from unnest(array['objects', 'buckets']) t
   where not exists (select 1 from pg_catalog.pg_policies p
                      where p.schemaname = 'storage' and p.tablename = t
                        and p.policyname = 'influx_no_member_access'
                        and p.permissive = 'RESTRICTIVE' and p.cmd = 'ALL'
                        and p.roles = array['anon', 'authenticated']::name[]
                        and p.qual = 'false' and p.with_check = 'false');
  if v_bad is not null then
    raise exception 'restrictive policy missing on storage.%', v_bad;
  end if;

  -- fiche invariant 1: no influx_% role holds any right on the schema storage, USAGE included
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_schema_privilege(r.oid, 'storage', 'USAGE, CREATE')
          or pg_catalog.has_table_privilege(r.oid, 'storage.objects',
                                            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_table_privilege(r.oid, 'storage.buckets',
                                            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'influx role(s) with a right on storage: %', v_bad;
  end if;

  -- modele point 4, §4: the quota and the retention
  if not exists (select 1 from profiles.storage_quotas q
                  where q.bucket_id = 'portfolio' and q.max_uploads_per_day = 16
                    and q.max_bytes_per_day = 67108864) then
    raise exception 'the quota of portfolio is not 16 uploads and 64 MiB a day';
  end if;
  if not exists (select 1 from backoffice.operational_settings s
                  where s.key = 'portfolio_retention_days') then
    raise exception 'portfolio_retention_days missing';
  end if;

  -- 15 RG26: the two queues, each with its policy
  if (select count(*) from backoffice.queues q
       where q.code in ('profiles_creator', 'portfolio_moderation') and q.has_lock
         and exists (select 1 from backoffice.sla_policies p where p.queue_code = q.code)) <> 2 then
    raise exception 'queues profiles_creator and portfolio_moderation missing or without a policy';
  end if;

  -- the owner: no login, no inheritance, no member, never superuser nor bypassing RLS
  if not exists (select 1 from pg_catalog.pg_roles r
                  where r.rolname = 'influx_creator_profile_definer' and not r.rolcanlogin
                    and not r.rolinherit and not r.rolsuper and not r.rolbypassrls) then
    raise exception 'influx_creator_profile_definer must be NOLOGIN NOINHERIT, neither superuser nor bypassrls';
  end if;
  -- the ADMIN option of its creator (CREATEROLE, C-9 tolerance of T4.3) is not a membership that
  -- inherits nor sets the role
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid = 'influx_creator_profile_definer'::regrole
                and (m.inherit_option or m.set_option)) then
    raise exception 'influx_creator_profile_definer has a member';
  end if;

  -- NON REVERSIBLE (fiche invariants 1, 16; modele -4): neither the advertiser nor the owner of the
  -- brand doors reaches a table of this file, nor executes a function of it
  select string_agg(r || ' on ' || t, ', ') into v_bad
    from unnest(array['influx_advertiser', 'influx_identity_definer']) r,
         unnest(array['profiles.portfolio_items', 'profiles.portfolio_rejection_reasons',
                      'profiles.portfolio_brand_declarations']) t
   where pg_catalog.has_table_privilege(r, t,
                                        'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
      or pg_catalog.has_any_column_privilege(r, t, 'SELECT, INSERT, UPDATE, REFERENCES');
  if v_bad is not null then
    raise exception 'right on a table of the portfolio: %', v_bad;
  end if;
  select string_agg(r || ' on ' || p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p,
         unnest(array['influx_advertiser', 'influx_identity_definer']) r
   where p.pronamespace = 'profiles'::regnamespace
     and (p.proname like '%portfolio%')
     and pg_catalog.has_function_privilege(r, p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'EXECUTE on a function of the portfolio: %', v_bad;
  end if;

  -- the doors: their owner, EXECUTE for influx_creator only among the business roles
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace = 'profiles'::regnamespace
     and p.proname in ('begin_portfolio_upload', 'discard_portfolio_upload', 'fail_portfolio_upload',
                       'store_portfolio_item', 'reorder_own_portfolio', 'remove_own_portfolio_item',
                       'withdraw_portfolio_of_former_creator')
     and (p.proowner <> 'influx_creator_profile_definer'::regrole or not p.prosecdef
          or pg_catalog.has_function_privilege('influx_agent', p.oid, 'EXECUTE')
          or pg_catalog.has_function_privilege('influx_admin', p.oid, 'EXECUTE'));
  if v_bad is not null then
    raise exception 'doors of the portfolio with a wrong owner or EXECUTE: %', v_bad;
  end if;

  -- 03 P8: RLS enabled and forced on the three tables
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid in ('profiles.portfolio_items'::regclass, 'profiles.portfolio_rejection_reasons'::regclass,
                   'profiles.portfolio_brand_declarations'::regclass)
     and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not forced on: %', v_bad;
  end if;
end
$$;
