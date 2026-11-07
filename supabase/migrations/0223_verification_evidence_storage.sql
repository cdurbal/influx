-- =============================================================================
-- 0223_verification_evidence_storage
-- -----------------------------------------------------------------------------
-- Lot 2 / L2E, commit 07 (jalons/l2e/07.md; l2e/modele.md §3 "evidence_files", §4 "Créateur",
-- "E-4", "Paramètres"; D82 (3), (4), (6); fiche invariants 3, 4; 08 RG34, RG81, RG86, RG88, edge
-- cases 1 and 5; 03 P7 E-4, P10). The bucket of the evidence, the life of an evidence row, its
-- quotas, its retention and the expiry of the codes. No decision (0224), no route, no screen; the
-- brand logo keeps its behaviour (0204, 0205, 0209).
--
--   storage.buckets `verification-evidence`   private, {image/webp}, 8 388 608 bytes (D82 (3)); the
--         restrictive policies of 0204 on storage.objects and storage.buckets hold for it; no
--         influx_% role holds any right on the schema storage (asserted).
--   profiles.storage_quotas                    `verification-evidence`: 18 uploads and 64 MiB
--         received per account and UTC day (modele §4); the closed list of buckets extended.
--   Five creator doors (modele §4 "Créateur"), SECURITY DEFINER owned by
--         influx_creator_verification_definer, EXECUTE for influx_creator only, on a DRAFT
--         audience request of the caller (the model of the brand logo, 0204):
--      begin_evidence_upload(request, received bytes)  (b) quotas consumed (6 files per request,
--                                                       the daily ones), row pending written, its
--                                                       retention_due_at set; returns id and key
--      discard_evidence_upload(evidence)            (c) refused by the checks: the pending row deleted
--      fail_evidence_upload(evidence)               (d) Storage write failed: pending -> purging
--      activate_evidence(evidence, bytes, w, h, sha256)  (e) pending -> active; an active evidence
--                                                       of the request with the same checksum ->
--                                                       purging (returned for the removal)
--      remove_own_evidence(evidence)                DELETE: active -> purging (returned)
--   verification.follow_request_evidence()     AFTER UPDATE OF status on verification_requests,
--         creator population only (invariant 4, modele -16, RG86, RG88): a cancelled request puts
--         its evidence to purging at once; a refusal whose reason purges_evidence (evidence_too_wide)
--         too; a decision (approved, rejected, closed) recomputes retention_due_at = decision +
--         evidence_retention_days. Owned by influx_maintenance_definer (the retention), no EXECUTE.
--   ops.claim_storage_purges(run, attempt, limit) -> (object_id, bucket_id, object_key)
--   ops.complete_storage_purges(run, attempt, object_ids)   recreated (modele §4 "E-4"): the logo
--         exactly as 0205 and 0209; the evidence: a pending row over 15 minutes, an active row past
--         retention_due_at whose request is not pending -> purging; purging rows claimed; once their
--         object is removed: purged, deleted_at, the row, its checksum and the findings kept.
--   ops.expire_verification_requests(run, attempt)   the hourly task verification_expiry (03 P7
--         E-4 « expiration ... des codes »; 08 edge case 1): a draft request whose live code has
--         expired becomes expired, verification.request_expired queued (ids only), register line
--         verification.expired. ops.claim_periodic_run() and periodic_runs_period_format recreated.
--
-- EC-L2E-07 (micro-gaps, the safest choice):
--   EC-L2E-07-1  the cancellation and the decisions reach the evidence through ONE trigger,
--                verification.follow_request_evidence(), instead of a recreated
--                verification.cancel_request_of() (note of commit 06): every cause is covered (member,
--                line_deleted, the decisions of 0224, a later closure), and its WHEN clause
--                (population = creator) keeps every brand transaction away from a function naming
--                verification.evidence_files (-18, T9.6).
--   EC-L2E-07-2  retention_due_at at the deposit = deposit + evidence_retention_days (08 edge case
--                « conservées jusqu'à leur date de purge »); recomputed at the decision from
--                decided_at (closed_at for a closure); expired: unchanged.
--   EC-L2E-07-3  the task never purges an active evidence of a PENDING request, even past its date:
--                the agent must read it (invariant 2); the decision recomputes the date.
--   EC-L2E-07-4  deposit, activation and removal on a DRAFT request only (55000 request_not_draft):
--                the evidence of a submitted request is fixed (the review token of 0224); an upload
--                whose request left draft is failed by apps/api (pending -> purging).
--   EC-L2E-07-5  6 files per request = its pending and active rows (08 RG34, evidence_max_files_per
--                _request); 54000 upload_quota_exceeded DETAIL files; received bytes 1 to
--                evidence_max_upload_bytes (22023 received_bytes).
--   EC-L2E-07-6  object_key: SELECT for influx_creator_verification_definer (its doors hand the key
--                to apps/api to write or remove the object, never to a response) and for
--                influx_maintenance_definer (the purge); read_evidence() (0224) brings the third.
--   EC-L2E-07-7  verification_expiry is HOURLY, 500 requests per call; the expired code stays as it
--                is (expired, not revoked); a brand request (domain code) expires the same way.
--   EC-L2E-07-8  a discarded upload (no object written) deletes its pending row, as the logo; every
--                other row is kept, `purged` once its object is removed (retention.purged category
--                verification_evidence_files).
--
-- ROLLBACK (before any evidence is stored): drop trigger verification_requests_follow_evidence;
-- drop function verification.follow_request_evidence(), the five doors and
-- ops.expire_verification_requests(uuid, smallint); recreate ops.claim_storage_purges(),
-- ops.complete_storage_purges(), ops.claim_periodic_run() and periodic_runs_period_format as in
-- 0205; drop the policies *_creator_verification_definer_evidence, *_maintenance_definer_* named
-- below and revoke their grants; recreate operational_settings_creator_verification_definer_select
-- as in 0222; delete from profiles.storage_quotas where bucket_id = 'verification-evidence' and
-- recreate storage_quotas_bucket as in 0204; remove the bucket through the Storage API. The value
-- verification_expiry of ops.periodic_task stays.
-- =============================================================================

-- 1. The bucket (D82 (3); 03 P10.1, P10.3) -----------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('verification-evidence', 'verification-evidence', false, 8388608, array['image/webp'])
on conflict (id) do update
   set public             = false,
       file_size_limit    = excluded.file_size_limit,
       allowed_mime_types = excluded.allowed_mime_types;

-- 2. The quotas of the bucket (D82 (4); modele §4) ---------------------------------------------------

alter table profiles.storage_quotas drop constraint if exists storage_quotas_bucket;
alter table profiles.storage_quotas
  add constraint storage_quotas_bucket check (bucket_id in ('brand-logo', 'verification-evidence'));

insert into profiles.storage_quotas (bucket_id, max_uploads_per_day, max_bytes_per_day)
values ('verification-evidence', 18, 67108864)
on conflict (bucket_id) do nothing;

comment on table profiles.storage_quotas is
  'Daily quotas per bucket (03 P10.7, 18 T9.8): uploads and bytes received per account and per UTC '
  'day. brand-logo: 10 and 20 MiB (stockage.md §6); verification-evidence: 18 and 64 MiB (0223, '
  'modele §4). Read by the member doors of 0204 and 0223 only.';

-- 3. The task verification_expiry, hourly (EC-L2E-07-7; EC-L2B-09-2: compared as text) --------------

alter type ops.periodic_task add value if not exists 'verification_expiry';

comment on type ops.periodic_task is
  'E-4 tasks of maintenance.run_periodic (0117): brevo_reconciliation (daily), auth_orphan_purge '
  '(hourly), brevo_inbound_purge (daily), data_export_purge (hourly, 0136 and 0137), ops_retention '
  '(daily, 0147), storage_purge (hourly, 0205, 0223: the objects of Storage of the purging rows), '
  'verification_expiry (hourly, 0223: the draft requests whose code expired). A new task is a '
  'migration.';

alter table ops.periodic_runs drop constraint if exists periodic_runs_period_format;
alter table ops.periodic_runs add constraint periodic_runs_period_format check (
  (task_code::text in ('auth_orphan_purge', 'data_export_purge', 'storage_purge',
                       'verification_expiry')
   and period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}$')
  or (task_code::text not in ('auth_orphan_purge', 'data_export_purge', 'storage_purge',
                              'verification_expiry')
      and period_key ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'));

-- 4. What influx_creator_verification_definer reaches for the deposit (its own rows) ----------------

-- 4.1 The evidence of the caller: written before the object, never another account's
grant select (id, object_key, checksum) on verification.evidence_files
   to influx_creator_verification_definer;
grant insert (request_id, account_id, received_bytes, retention_due_at)
   on verification.evidence_files to influx_creator_verification_definer;
grant update (state, byte_size, width, height, checksum, activated_at, purge_requested_at)
   on verification.evidence_files to influx_creator_verification_definer;
grant delete on verification.evidence_files to influx_creator_verification_definer;

drop policy if exists evidence_files_creator_verification_definer_insert
  on verification.evidence_files;
create policy evidence_files_creator_verification_definer_insert on verification.evidence_files
  for insert to influx_creator_verification_definer
  with check (account_id = (select influx.current_account_id()) and state = 'pending');
drop policy if exists evidence_files_creator_verification_definer_update
  on verification.evidence_files;
create policy evidence_files_creator_verification_definer_update on verification.evidence_files
  for update to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and state in ('pending', 'active'))
  with check (account_id = (select influx.current_account_id())
              and state in ('active', 'purging'));
drop policy if exists evidence_files_creator_verification_definer_delete
  on verification.evidence_files;
create policy evidence_files_creator_verification_definer_delete on verification.evidence_files
  for delete to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id()) and state = 'pending');

-- 4.2 The quotas of the bucket, the caller's daily usage of it
grant select (bucket_id, max_uploads_per_day, max_bytes_per_day)
   on profiles.storage_quotas to influx_creator_verification_definer;

drop policy if exists storage_quotas_creator_verification_definer_select on profiles.storage_quotas;
create policy storage_quotas_creator_verification_definer_select on profiles.storage_quotas
  for select to influx_creator_verification_definer
  using (bucket_id = 'verification-evidence');

grant select (account_id, bucket_id, usage_day, upload_count, received_bytes),
      insert (account_id, bucket_id, usage_day),
      update (upload_count, received_bytes)
   on profiles.storage_daily_usage to influx_creator_verification_definer;

drop policy if exists storage_daily_usage_creator_verification_definer_own
  on profiles.storage_daily_usage;
create policy storage_daily_usage_creator_verification_definer_own on profiles.storage_daily_usage
  for all to influx_creator_verification_definer
  using (account_id = (select influx.current_account_id())
         and bucket_id = 'verification-evidence')
  with check (account_id = (select influx.current_account_id())
              and bucket_id = 'verification-evidence');

-- 4.3 The parameters of 08 RG34 and RG86 join those of 0222
drop policy if exists operational_settings_creator_verification_definer_select
  on backoffice.operational_settings;
create policy operational_settings_creator_verification_definer_select
  on backoffice.operational_settings
  for select to influx_creator_verification_definer
  using (key in ('verification_code_validity_days', 'request_retry_hours', 'rejection_cap_count',
                 'rejection_cap_window_days', 'evidence_retention_days',
                 'evidence_max_files_per_request', 'evidence_max_upload_bytes'));

-- 5. What influx_maintenance_definer reaches: the retention of the evidence, the expiry ------------

grant usage on schema verification to influx_maintenance_definer;

-- 5.1 The evidence: never an account, a size nor a checksum; a purged row is never written again.
-- The SELECT policy sees every row: an UPDATE checks its NEW row against it (purging -> purged).
grant select (id, request_id, object_key, state, created_at, retention_due_at, purge_requested_at,
              purge_attempts, last_purge_attempt_at),
      update (state, retention_due_at, purge_requested_at, purge_attempts, last_purge_attempt_at,
              deleted_at)
   on verification.evidence_files to influx_maintenance_definer;

drop policy if exists evidence_files_maintenance_definer_select on verification.evidence_files;
create policy evidence_files_maintenance_definer_select on verification.evidence_files
  for select to influx_maintenance_definer
  using (true);
-- an active row stays active (its date recomputed) or goes to purging; purging ends purged
drop policy if exists evidence_files_maintenance_definer_update on verification.evidence_files;
create policy evidence_files_maintenance_definer_update on verification.evidence_files
  for update to influx_maintenance_definer
  using (state in ('pending', 'active', 'purging'))
  with check (state in ('active', 'purging', 'purged'));

-- 5.2 The requests: the status of every request (the task spares a pending one, EC-L2E-07-3), the
-- expiry of a draft
grant select (id, account_id, level, status),
      update (status, closed_at)
   on verification.verification_requests to influx_maintenance_definer;

drop policy if exists verification_requests_maintenance_definer_select
  on verification.verification_requests;
create policy verification_requests_maintenance_definer_select
  on verification.verification_requests
  for select to influx_maintenance_definer
  using (true);
drop policy if exists verification_requests_maintenance_definer_update
  on verification.verification_requests;
create policy verification_requests_maintenance_definer_update
  on verification.verification_requests
  for update to influx_maintenance_definer
  using (status = 'draft')
  with check (status = 'expired');

-- 5.3 The live code of a draft (its expiry), never the code itself nor the finding
grant select (request_id, expires_at, revoked_at)
   on verification.ownership_codes to influx_maintenance_definer;

drop policy if exists ownership_codes_maintenance_definer_select on verification.ownership_codes;
create policy ownership_codes_maintenance_definer_select on verification.ownership_codes
  for select to influx_maintenance_definer
  using (true);

-- 5.4 The reason that purges at once (RG88), the duration of RG86
grant select (population, code, purges_evidence)
   on verification.rejection_reasons to influx_maintenance_definer;

drop policy if exists rejection_reasons_maintenance_definer_select on verification.rejection_reasons;
create policy rejection_reasons_maintenance_definer_select on verification.rejection_reasons
  for select to influx_maintenance_definer
  using (true);

grant select (key, value) on backoffice.operational_settings to influx_maintenance_definer;

drop policy if exists operational_settings_maintenance_definer_select
  on backoffice.operational_settings;
create policy operational_settings_maintenance_definer_select on backoffice.operational_settings
  for select to influx_maintenance_definer
  using (key = 'evidence_retention_days');

-- 5.5 The e-mail « request expired » (ids only, 05 RG74)
grant insert (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
   on leads.outbox_events to influx_maintenance_definer;

drop policy if exists outbox_events_maintenance_definer_insert on leads.outbox_events;
create policy outbox_events_maintenance_definer_insert on leads.outbox_events
  for insert to influx_maintenance_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and destination = 'brevo_transactional'
              and event_type = 'verification.request_expired');

-- 6. The five creator doors (created by the migration role, handed to their owner in section 8) ----

-- (b) The quotas consumed and the row written, before any byte is decoded --------------------------
create or replace function verification.begin_evidence_upload(
  p_request_id      uuid,
  p_received_bytes  integer)
returns table (
  evidence_id  uuid,
  object_key   text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  -- the account comes from the transaction context (03 P2), never a parameter
  v_account    uuid := influx.current_account_id();
  v_day        date := (pg_catalog.now() at time zone 'UTC')::date;
  v_request    record;
  v_max_files  integer;
  v_max_bytes  integer;
  v_days       integer;
  v_files      integer;
  v_quota      record;
  v_usage      record;
  v_id         uuid;
  v_key        text;
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
  -- the row lock serialises two deposits on the request (the frontier of 6 files) and a submission
  select r.id, r.level, r.status::text as status into v_request
    from verification.verification_requests r
   where r.id = p_request_id and r.account_id = v_account
     for update;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  if v_request.level <> 'audience_verified' then
    raise exception 'level' using errcode = 'invalid_parameter_value', detail = 'level';
  end if;
  if v_request.status <> 'draft' then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;

  select max(case when s.key = 'evidence_max_files_per_request' then (s.value)::integer end),
         max(case when s.key = 'evidence_max_upload_bytes' then (s.value)::integer end),
         max(case when s.key = 'evidence_retention_days' then (s.value)::integer end)
    into v_max_files, v_max_bytes, v_days
    from backoffice.operational_settings s
   where s.key in ('evidence_max_files_per_request', 'evidence_max_upload_bytes',
                   'evidence_retention_days');
  if v_max_files is null or v_max_bytes is null or v_days is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  -- EC-L2E-07-5: what one deposit may carry (D82 (1): 8 MiB at most)
  if p_received_bytes is null or p_received_bytes < 1 or p_received_bytes > v_max_bytes then
    raise exception 'received_bytes' using errcode = 'invalid_parameter_value', detail = 'received_bytes';
  end if;
  -- 08 RG34: 6 files per request, the pending and the active ones
  select count(*) into v_files
    from verification.evidence_files e
   where e.request_id = p_request_id and e.account_id = v_account
     and e.state in ('pending', 'active');
  if v_files >= v_max_files then
    raise exception 'upload_quota_exceeded' using errcode = 'program_limit_exceeded', detail = 'files';
  end if;

  select q.max_uploads_per_day, q.max_bytes_per_day
    into v_quota
    from profiles.storage_quotas q
   where q.bucket_id = 'verification-evidence';
  if not found then
    raise exception 'no quota for verification-evidence'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  insert into profiles.storage_daily_usage (account_id, bucket_id, usage_day)
  values (v_account, 'verification-evidence', v_day)
  on conflict (account_id, bucket_id, usage_day) do nothing;

  -- The row lock serialises two concurrent deposits of the account (T9.8 at the exact frontier).
  select u.upload_count, u.received_bytes
    into v_usage
    from profiles.storage_daily_usage u
   where u.account_id = v_account and u.bucket_id = 'verification-evidence' and u.usage_day = v_day
     for update;

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
   where u.account_id = v_account and u.bucket_id = 'verification-evidence' and u.usage_day = v_day;

  -- RG86 (L2E-D1): the date of purge from the insertion (EC-L2E-07-2)
  insert into verification.evidence_files as e
    (request_id, account_id, received_bytes, retention_due_at)
  values (p_request_id, v_account, p_received_bytes,
          pg_catalog.now() + pg_catalog.make_interval(days => v_days))
  returning e.id, e.object_key into v_id, v_key;

  return query select v_id, v_key;
end
$$;

comment on function verification.begin_evidence_upload(uuid, integer) is
  'D82 (1), (4); 08 RG34, RG86; 18 T9.8 (0223): on his own DRAFT audience request, an active '
  'creator starts the deposit of p_received_bytes (1 to evidence_max_upload_bytes, 22023 '
  'received_bytes). In ONE transaction, the request locked: at most evidence_max_files_per_request '
  'pending or active files (54000 upload_quota_exceeded DETAIL files), the usage of the UTC day '
  'counted (54000 DETAIL uploads or bytes beyond profiles.storage_quotas), the row pending written '
  'with retention_due_at = now() + evidence_retention_days; returns (evidence_id, object_key), the '
  'key generated by the base (<account>/<request>/<id>.webp, T9.3, T9.9). 22023 level for an account '
  'request; 55000 request_not_draft; 42501 outside an active creator account, and for another''s '
  'request as for an unknown one. SECURITY DEFINER owned by influx_creator_verification_definer, '
  'empty search_path; EXECUTE for influx_creator only.';

-- (c) Refused by the checks of the bytes: the pending row deleted --------------------------------
create or replace function verification.discard_evidence_upload(p_evidence_id uuid)
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
  delete from verification.evidence_files e
   where e.id = p_evidence_id and e.account_id = v_account and e.state = 'pending';
  return found;
end
$$;

comment on function verification.discard_evidence_upload(uuid) is
  'D82 (2), EC-L2E-07-8 (0223): the deposit p_evidence_id of the caller, refused by the checks of '
  'its bytes (type, pixels, output), is forgotten: its PENDING row deleted (no object was written). '
  'Returns false when the caller holds no such pending row. The quotas stay consumed. 42501 outside '
  'a creator context. SECURITY DEFINER owned by influx_creator_verification_definer; EXECUTE for '
  'influx_creator only.';

-- (d) The Storage write failed: the object may exist, the row goes to purging ----------------------
create or replace function verification.fail_evidence_upload(p_evidence_id uuid)
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
  update verification.evidence_files e
     set state = 'purging', purge_requested_at = pg_catalog.now()
   where e.id = p_evidence_id and e.account_id = v_account and e.state = 'pending';
  return found;
end
$$;

comment on function verification.fail_evidence_upload(uuid) is
  'D82 (3); 08 edge case 5 (0223): the Storage write of the deposit p_evidence_id failed, or its '
  'request left draft meanwhile; its PENDING row passes to purging (an object may have been '
  'written), removed by the task storage_purge: no partial file is kept. Returns false when the '
  'caller holds no such pending row. 42501 outside a creator context. SECURITY DEFINER owned by '
  'influx_creator_verification_definer; EXECUTE for influx_creator only.';

-- (e) The object stored: the row active, the same evidence deposited before to purge ---------------
create or replace function verification.activate_evidence(
  p_evidence_id  uuid,
  p_byte_size    integer,
  p_width        integer,
  p_height       integer,
  p_checksum     bytea)
returns table (
  previous_evidence_id  uuid,
  previous_object_key   text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_request  uuid;
  v_status   text;
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
  select e.request_id into v_request
    from verification.evidence_files e
   where e.id = p_evidence_id and e.account_id = v_account;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- the request locked first, as every door of it (a submission, a cancellation, another deposit)
  select r.status::text into v_status
    from verification.verification_requests r
   where r.id = v_request and r.account_id = v_account
     for update;
  if v_status is distinct from 'draft' then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;
  perform 1 from verification.evidence_files e
   where e.id = p_evidence_id and e.state = 'pending'
     for update;
  if not found then
    raise exception 'evidence_not_pending' using
      errcode = 'object_not_in_prerequisite_state', detail = 'evidence_not_pending';
  end if;
  if p_checksum is null or pg_catalog.octet_length(p_checksum) <> 32 then
    raise exception 'checksum' using errcode = 'invalid_parameter_value', detail = 'checksum';
  end if;

  -- modele §4: the same evidence (same SHA-256 of the WebP) deposited again replaces the former one
  return query
    update verification.evidence_files e
       set state = 'purging', purge_requested_at = pg_catalog.now()
     where e.request_id = v_request and e.account_id = v_account and e.state = 'active'
       and e.checksum = p_checksum
    returning e.id, e.object_key;

  -- the constraints hold the sizes (D82 (2)): 23514 beyond them
  update verification.evidence_files e
     set state = 'active', byte_size = p_byte_size, width = p_width, height = p_height,
         checksum = p_checksum, activated_at = pg_catalog.now()
   where e.id = p_evidence_id;
end
$$;

comment on function verification.activate_evidence(uuid, integer, integer, integer, bytea) is
  'D82 (2), (3); modele §4 (0223): the re-encoded WebP of the deposit p_evidence_id is stored '
  '(p_byte_size bytes, p_width x p_height, p_checksum its SHA-256); its PENDING row becomes active '
  'and an active evidence of the same request with the same checksum passes to purging, in ONE '
  'transaction (the request locked). Returns the replaced (id, object_key) for the immediate '
  'removal, or no row. 55000 request_not_draft when the request left draft (apps/api then fails the '
  'deposit), evidence_not_pending; 22023 checksum (32 bytes); 23514 when a size is out of the '
  'bounds of D82; 42501 outside an active creator account, and for another''s evidence as for an '
  'unknown one. SECURITY DEFINER owned by influx_creator_verification_definer, empty search_path; '
  'EXECUTE for influx_creator only.';

-- DELETE: the evidence withdrawn by its creator, before the submission -----------------------------
create or replace function verification.remove_own_evidence(p_evidence_id uuid)
returns table (
  evidence_id  uuid,
  object_key   text
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_account  uuid := influx.current_account_id();
  v_request  uuid;
  v_status   text;
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
  select e.request_id into v_request
    from verification.evidence_files e
   where e.id = p_evidence_id and e.account_id = v_account;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  select r.status::text into v_status
    from verification.verification_requests r
   where r.id = v_request and r.account_id = v_account
     for update;
  if v_status is distinct from 'draft' then
    raise exception 'request_not_draft' using
      errcode = 'object_not_in_prerequisite_state', detail = 'request_not_draft';
  end if;
  return query
    update verification.evidence_files e
       set state = 'purging', purge_requested_at = pg_catalog.now()
     where e.id = p_evidence_id and e.account_id = v_account and e.state = 'active'
    returning e.id, e.object_key;
end
$$;

comment on function verification.remove_own_evidence(uuid) is
  'D82 (6), EC-L2E-07-4 (0223): on his own DRAFT request, an active creator withdraws the active '
  'evidence p_evidence_id: it passes to purging; returns its (evidence_id, object_key) for the '
  'immediate removal, or no row when it is not active (already withdrawn, pending). 55000 '
  'request_not_draft once submitted or ended; 42501 outside an active creator account, and for '
  'another''s evidence as for an unknown one. SECURITY DEFINER owned by '
  'influx_creator_verification_definer, empty search_path; EXECUTE for influx_creator only.';

-- 7. The evidence follows its request (invariant 4; modele -16; RG86, RG88; EC-L2E-07-1) -----------

create or replace function verification.follow_request_evidence()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_days  integer;
  v_at    timestamptz;
begin
  if new.status = 'cancelled'
     or (new.status = 'rejected'
         and exists (select 1 from verification.rejection_reasons r
                      where r.population = new.population and r.code = new.rejection_reason_code
                        and r.purges_evidence)) then
    -- modele -16, RG88: unreachable at once, removed by the next run of storage_purge
    update verification.evidence_files e
       set state = 'purging', purge_requested_at = pg_catalog.now()
     where e.request_id = new.id and e.state in ('pending', 'active');
  else
    -- RG86, D79: 45 days (the parameter) after the decision
    select (s.value)::integer into v_days
      from backoffice.operational_settings s where s.key = 'evidence_retention_days';
    if v_days is null then
      raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
    end if;
    v_at := coalesce(new.decided_at, new.closed_at, pg_catalog.now());
    update verification.evidence_files e
       set retention_due_at = v_at + pg_catalog.make_interval(days => v_days)
     where e.request_id = new.id and e.state = 'active';
  end if;
  return null;
end
$$;

comment on function verification.follow_request_evidence() is
  'AFTER UPDATE OF status on verification.verification_requests, creator requests only (0223; '
  'invariant 4; modele -16; 08 RG86, RG88): a request cancelled (member, deleted line) or refused '
  'with a reason that purges_evidence (evidence_too_wide) puts its pending and active evidence to '
  'purging at once; approved, rejected or closed recomputes the retention_due_at of its active '
  'evidence = decided_at (closed_at) + evidence_retention_days. SECURITY DEFINER owned by '
  'influx_maintenance_definer (the retention), empty search_path; no EXECUTE for anyone.';

drop trigger if exists verification_requests_follow_evidence on verification.verification_requests;
create trigger verification_requests_follow_evidence
  after update of status on verification.verification_requests
  for each row
  when (new.population = 'creator' and old.status is distinct from new.status
        and new.status in ('cancelled', 'approved', 'rejected', 'closed'))
  execute function verification.follow_request_evidence();

-- 8. Rights and owners of the doors and of the trigger (03 P7 rule 5) -----------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'verification.begin_evidence_upload(uuid, integer)',
    'verification.discard_evidence_upload(uuid)',
    'verification.fail_evidence_upload(uuid)',
    'verification.activate_evidence(uuid, integer, integer, integer, bytea)',
    'verification.remove_own_evidence(uuid)',
    'verification.follow_request_evidence()']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role, '
                   'influx_advertiser, influx_creator, influx_agent, influx_admin', f);
  end loop;
end
$$;

grant execute on function
  verification.begin_evidence_upload(uuid, integer),
  verification.discard_evidence_upload(uuid),
  verification.fail_evidence_upload(uuid),
  verification.activate_evidence(uuid, integer, integer, integer, bytea),
  verification.remove_own_evidence(uuid)
  to influx_creator;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_creator_verification_definer', current_user);
  execute format('grant %I to %I with inherit false, set true',
                 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema verification to influx_creator_verification_definer;
grant create on schema verification to influx_maintenance_definer;

alter function verification.begin_evidence_upload(uuid, integer)
  owner to influx_creator_verification_definer;
alter function verification.discard_evidence_upload(uuid)
  owner to influx_creator_verification_definer;
alter function verification.fail_evidence_upload(uuid)
  owner to influx_creator_verification_definer;
alter function verification.activate_evidence(uuid, integer, integer, integer, bytea)
  owner to influx_creator_verification_definer;
alter function verification.remove_own_evidence(uuid)
  owner to influx_creator_verification_definer;
alter function verification.follow_request_evidence() owner to influx_maintenance_definer;

revoke create on schema verification from influx_creator_verification_definer;
revoke create on schema verification from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_creator_verification_definer', current_user);
end
$$;

-- 9. E-4: the claim, the purge of both buckets, the expiry, as influx_maintenance_definer ---------

grant create on schema ops to influx_maintenance_definer;
set role influx_maintenance_definer;

-- 9.1 The claim of 0205, verification_expiry hourly --------------------------------------------------
create or replace function ops.claim_periodic_run(
  p_task        ops.periodic_task,
  p_period_key  text
)
returns table (
  run_id   uuid,
  attempt  smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_current  text;
  v_id       uuid;
  v_run      record;
begin
  if p_task is null then
    raise exception 'a task is required' using errcode = 'invalid_parameter_value';
  end if;
  -- hourly: the GoTrue pass (04 §9), the purge of the exports (0137), of Storage (0205) and the
  -- expiry of the verification codes (0223)
  v_current := pg_catalog.to_char(pg_catalog.now() at time zone 'UTC',
                                  case when p_task::text in ('auth_orphan_purge', 'data_export_purge',
                                                             'storage_purge', 'verification_expiry')
                                       then 'YYYY-MM-DD"T"HH24' else 'YYYY-MM-DD' end);
  -- Only the current period: no scheduling error replays a past one nor reserves a future one.
  if p_period_key is distinct from v_current then
    raise exception 'only the current period (%) can be claimed', v_current
      using errcode = 'invalid_parameter_value';
  end if;

  insert into ops.periodic_runs (task_code, period_key)
  values (p_task, p_period_key)
  on conflict (task_code, period_key) do nothing
  returning id into v_id;
  if v_id is not null then
    return query select v_id, 1::smallint;
    return;
  end if;

  -- The period exists: finished, running elsewhere, or left unfinished for an hour.
  select r.id, r.attempt, r.started_at, r.finished_at
    into v_run
    from ops.periodic_runs r
   where r.task_code = p_task and r.period_key = p_period_key
     for update;
  -- FOR UPDATE reads through the UPDATE policy (finished_at is null): a finished run is not
  -- found here. Nothing to take back, never a row of NULLs.
  if not found then
    return;
  end if;
  if v_run.finished_at is not null
     or v_run.started_at > pg_catalog.now() - interval '1 hour'
     or v_run.attempt >= 100 then
    return;
  end if;
  update ops.periodic_runs r
     set attempt = r.attempt + 1,
         counts  = '{}'::jsonb
   where r.id = v_run.id;
  return query select v_run.id, (v_run.attempt + 1)::smallint;
end
$$;

comment on function ops.claim_periodic_run(ops.periodic_task, text) is
  'E-4 claim (decision 3 of J7): for the CURRENT UTC period of the task only (22023 otherwise): '
  'hourly YYYY-MM-DDTHH for auth_orphan_purge, data_export_purge (0137), storage_purge (0205) and '
  'verification_expiry (0223), daily YYYY-MM-DD for the others; creates the run (attempt 1), or '
  'takes back a run left unfinished for one hour (attempt + 1, started_at = now(), counts reset). '
  'No row: the period is finished or running elsewhere. Returns (run id, attempt): the run id is '
  'the subject of elevated.maintenance.run_periodic, the attempt the fencing token of the other '
  'functions. SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

-- 9.2 The objects to remove, of both buckets (their result changes: dropped and recreated) -------
drop function if exists ops.claim_storage_purges(uuid, smallint, integer);
drop function if exists ops.complete_storage_purges(uuid, smallint, uuid[]);

create function ops.claim_storage_purges(
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
  v_logos  integer;
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
  end if;
end
$$;

comment on function ops.claim_storage_purges(uuid, smallint, integer) is
  'E-4 storage_purge (stockage.md §7; 0223, modele §4): the pending logo rows and pending evidence '
  'rows older than 15 minutes pass to purging, and the active evidence whose retention_due_at has '
  'come (never one of a pending request, EC-L2E-07-3); then at most p_limit (1 to 1000, 100 by '
  'default) purging rows not tried in the last 30 minutes are taken, the logo first (SKIP LOCKED), '
  'purge_attempts + 1 and last_purge_attempt_at = now(), and their (object_id, bucket_id, '
  'object_key) returned for the removal through the API of Storage. Inside the open storage_purge '
  'run of this attempt only (55000 otherwise). Never an active logo, never an active evidence before '
  'its date. SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

-- 9.3 The objects removed: a logo row deleted, an evidence row purged and kept ---------------------
create function ops.complete_storage_purges(
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
  return v_logos + v_evidence;
end
$$;

comment on function ops.complete_storage_purges(uuid, smallint, uuid[]) is
  'E-4 storage_purge (stockage.md §7; 0223): the purging rows of p_object_ids (1 to 1000), whose '
  'object the worker removed from Storage: a logo row is deleted (0204), an evidence row becomes '
  'purged (deleted_at = now(); the row, its checksum and the findings kept, RG86). Writes '
  'retention.purged {category brand_logo_objects | verification_evidence_files, count} on the run '
  'for each that changed. Inside the open storage_purge run of this attempt only (55000 otherwise). '
  'Returns the count. SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; '
  'EXECUTE for influx_worker ONLY.';

-- 9.4 The draft requests whose code expired (08 edge case 1; 03 P7 E-4) ----------------------------
create or replace function ops.expire_verification_requests(
  p_run_id   uuid,
  p_attempt  smallint
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row    record;
  v_event  uuid;
  v_count  integer := 0;
begin
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code::text = 'verification_expiry') then
    raise exception 'no open verification_expiry run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- the live (unrevoked) code of the draft is past its date: the request cannot be submitted
  -- (EC-L2E-06-3), it expires (EC-L2E-07-7: 500 per call, the next call goes on)
  for v_row in
    select q.id, q.account_id, q.level
      from verification.verification_requests q
     where q.status = 'draft'
       and exists (select 1 from verification.ownership_codes c
                    where c.request_id = q.id and c.revoked_at is null
                      and c.expires_at <= pg_catalog.now())
     order by q.id
     limit 500
       for update of q skip locked
  loop
    update verification.verification_requests q
       set status = 'expired', closed_at = pg_catalog.now()
     where q.id = v_row.id and q.status = 'draft';
    if found then
      v_event := pg_catalog.gen_random_uuid();
      -- the e-mail « request expired » (EC-L2E-3), ids only
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (v_event, 'verification.request_expired', 'brevo_transactional',
              'account:' || v_row.account_id::text, 100,
              pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', v_row.account_id,
                                            'request_id', v_row.id),
              'verification.request_expired:' || v_row.id::text);
      perform audit.append('verification.expired', 'verification_request', v_row.id,
                           pg_catalog.jsonb_build_object('level', v_row.level));
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end
$$;

comment on function ops.expire_verification_requests(uuid, smallint) is
  'E-4 verification_expiry (0223; 08 edge case 1, RG22; 03 P7 E-4): at most 500 draft requests '
  'whose live code has expired become expired (closed_at = now()); for each, '
  'verification.request_expired queued to brevo_transactional (event_id, account_id, request_id; '
  'key verification.request_expired:<request>) and the register line verification.expired {level}. '
  'Inside the open verification_expiry run of this attempt only (55000 otherwise). Returns the count '
  '(500: call again). SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; '
  'EXECUTE for influx_worker ONLY.';

revoke all on function ops.claim_storage_purges(uuid, smallint, integer)
  from public, anon, authenticated, service_role;
revoke all on function ops.complete_storage_purges(uuid, smallint, uuid[])
  from public, anon, authenticated, service_role;
revoke all on function ops.expire_verification_requests(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function ops.claim_storage_purges(uuid, smallint, integer) to influx_worker;
grant execute on function ops.complete_storage_purges(uuid, smallint, uuid[]) to influx_worker;
grant execute on function ops.expire_verification_requests(uuid, smallint) to influx_worker;

reset role;

revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 10. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  -- D82 (3), 18 T9.1: every bucket private; verification-evidence WebP only, 8 MiB
  select string_agg(b.id, ', ') into v_bad from storage.buckets b where b.public is not false;
  if v_bad is not null then
    raise exception 'public bucket(s): %', v_bad;
  end if;
  if not exists (select 1 from storage.buckets b
                  where b.id = 'verification-evidence' and b.public = false
                    and b.file_size_limit = 8388608
                    and b.allowed_mime_types = array['image/webp']) then
    raise exception 'the bucket verification-evidence is not private, WebP only, 8 MiB';
  end if;
  if not exists (select 1 from storage.buckets b
                  where b.id = 'brand-logo' and b.public = false and b.file_size_limit = 1048576
                    and b.allowed_mime_types = array['image/webp']) then
    raise exception 'the bucket brand-logo changed';
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

  -- D82 (3): no influx_% role holds any right on the schema storage
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

  -- the quotas of modele §4
  if not exists (select 1 from profiles.storage_quotas q
                  where q.bucket_id = 'verification-evidence' and q.max_uploads_per_day = 18
                    and q.max_bytes_per_day = 67108864) then
    raise exception 'the quota of verification-evidence is not 18 uploads and 64 MiB a day';
  end if;

  -- NON REVERSIBLE (fiche invariant 1, EC-L2E-18): still nothing for influx_advertiser
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
  if pg_catalog.has_table_privilege('influx_identity_definer', 'verification.evidence_files',
                                    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
     or pg_catalog.has_any_column_privilege('influx_identity_definer', 'verification.evidence_files',
                                            'SELECT, INSERT, UPDATE, REFERENCES') then
    raise exception 'influx_identity_definer holds a right on verification.evidence_files';
  end if;

  -- EC-L2E-07-6: the key of an evidence, to the owner of the doors and to the purge only
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and r.rolname not in ('influx_creator_verification_definer', 'influx_maintenance_definer')
     and pg_catalog.has_column_privilege(r.oid, 'verification.evidence_files', 'object_key', 'SELECT');
  if v_bad is not null then
    raise exception 'the object key is readable by: %', v_bad;
  end if;

  -- the retention never reads an account, a size, a side nor a checksum, never inserts nor deletes
  select string_agg(c, ', ') into v_bad
    from unnest(array['account_id', 'byte_size', 'width', 'height', 'checksum',
                      'received_bytes']) c
   where pg_catalog.has_column_privilege('influx_maintenance_definer', 'verification.evidence_files',
                                         c, 'SELECT');
  if v_bad is not null
     or pg_catalog.has_any_column_privilege('influx_maintenance_definer',
                                            'verification.evidence_files', 'INSERT')
     or pg_catalog.has_table_privilege('influx_maintenance_definer', 'verification.evidence_files',
                                       'DELETE')
     or pg_catalog.has_column_privilege('influx_maintenance_definer',
                                        'verification.ownership_codes', 'code', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer',
                                        'verification.ownership_codes', 'observed_handle', 'SELECT') then
    raise exception 'influx_maintenance_definer reaches beyond the retention: %', coalesce(v_bad, '-');
  end if;

  -- still no execution role writing the schema verification nor the tables of Storage
  select string_agg(r.rolname || ' ' || c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_roles r, pg_catalog.pg_class c
   where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                       'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and c.relkind in ('r', 'p')
     and (c.relnamespace = 'verification'::regnamespace
          or c.oid in ('profiles.storage_quotas'::regclass, 'profiles.storage_daily_usage'::regclass))
     and (pg_catalog.has_any_column_privilege(r.oid, c.oid, 'INSERT, UPDATE')
          or pg_catalog.has_table_privilege(r.oid, c.oid, 'DELETE, TRUNCATE'));
  if v_bad is not null then
    raise exception 'execution role(s) writing a verification or Storage table: %', v_bad;
  end if;

  -- the functions: owner, SECURITY DEFINER, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('verification.begin_evidence_upload(uuid,integer)',
       'influx_creator_verification_definer', 'influx_creator'),
      ('verification.discard_evidence_upload(uuid)',
       'influx_creator_verification_definer', 'influx_creator'),
      ('verification.fail_evidence_upload(uuid)',
       'influx_creator_verification_definer', 'influx_creator'),
      ('verification.activate_evidence(uuid,integer,integer,integer,bytea)',
       'influx_creator_verification_definer', 'influx_creator'),
      ('verification.remove_own_evidence(uuid)',
       'influx_creator_verification_definer', 'influx_creator'),
      ('verification.follow_request_evidence()', 'influx_maintenance_definer', null),
      ('ops.claim_periodic_run(ops.periodic_task,text)', 'influx_maintenance_definer', 'influx_worker'),
      ('ops.claim_storage_purges(uuid,smallint,integer)', 'influx_maintenance_definer', 'influx_worker'),
      ('ops.complete_storage_purges(uuid,smallint,uuid[])', 'influx_maintenance_definer',
       'influx_worker'),
      ('ops.expire_verification_requests(uuid,smallint)', 'influx_maintenance_definer',
       'influx_worker')
    ) as f (sig, owner, caller)
    join pg_catalog.pg_proc p on p.oid = f.sig::regprocedure
   where pg_catalog.pg_get_userbyid(p.proowner) <> f.owner
      or not p.prosecdef
      or p.proconfig is distinct from array['search_path=""']
      or exists (select 1
                   from pg_catalog.aclexplode(coalesce(p.proacl,
                                                       pg_catalog.acldefault('f', p.proowner))) a
                  where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                    and (a.grantee = 0 or a.grantee::regrole::text is distinct from f.caller));
  if v_bad is not null then
    raise exception 'function(s) without their owner, security, search_path or callers: %', v_bad;
  end if;

  -- no definer role left usable nor with CREATE on a schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_creator_verification_definer', 'influx_maintenance_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_creator_verification_definer', 'verification', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_maintenance_definer', 'verification', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE') then
    raise exception 'a definer role left with CREATE on a schema';
  end if;
end
$$;
