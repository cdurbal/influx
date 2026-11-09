-- =============================================================================
-- 0230_verification_badge_lifecycle
-- -----------------------------------------------------------------------------
-- Lot 2 / L2F, commit 05 (jalons/l2f/05.md; l2f/modele.md §1 points 1 to 3, §2 "badges", §3 "0230",
-- §4, which prevails for every name; l2f-fiche.md invariants 1, 2, 11, 12, 17; 08 RG69 to RG72,
-- RG100, CA45 to CA48; 06 RG54, CA31; 03 C(15)). The badge lives: the daily task of the worker
-- reminds, passes to « à rafraîchir », then expires, as a SYSTEM event (never an agent's decision);
-- a refreshed request is opened without asking the ownership again; the findings of an ended badge
-- are erased after the retention of 08 RG100.
--
-- 1. verification.badges + reminder_sent_at (the reminder of 08 RG70, once), ended_at (<=> expired,
--    revoked, replaced; written by the trigger verification.stamp_badge_end(), BEFORE INSERT OR
--    UPDATE, whoever writes: the decisions of 0224/0228, the erasure of 0226, this task; retroactive
--    coalesce(revoked_at, updated_at)), findings_erased_at (=> ended; badges_audience_figures admits
--    an audience badge whose figures were erased).
-- 2. backoffice.operational_settings: badge_reminder_days (15, 1 to 90; modele §4, 08 RG70 « J-15 »).
-- 3. ops.periodic_task + badge_lifecycle (DAILY, CA45 to CA47 « tâche quotidienne »), distinct from
--    the hourly verification_expiry.
-- 4. ops.run_badge_lifecycle(run, attempt) -> integer, 500 badges per call (500: call again), inside
--    the open badge_lifecycle run of the attempt (55000 otherwise), in this order:
--      a. a holding badge of a network line that no longer exists -> expired, cause line_deleted
--         (modele point 6), no e-mail;
--      b. to_refresh or to_reconfirm at expires_at + badge_grace_days -> expired, cause grace_ended,
--         e-mail verification.expiry_removed (RG70 « Fin du délai de grâce »);
--      c. active at expires_at -> to_refresh, e-mail verification.expiry_to_refresh (RG70 « J+0 »);
--      d. active, never reminded, at expires_at - badge_reminder_days -> reminder_sent_at, e-mail
--         verification.expiry_reminder, the badge otherwise unchanged (CA45).
--    Each change of state: the register line (sujet verification_badge, no actor: the worker's
--    transaction carries no account, C(15)), lead.updated (VERIFIED_LEVEL follows, Brevo only), and
--    for an audience badge the public row of its line derived again
--    (profiles.refresh_creator_public_network(), 0225: to_refresh keeps the observed bands, expired
--    returns to the declared and hides the engagement band, RG70). « Compte vérifié » has no expiry
--    and is never touched by b to d (RG30, RG71). Replayed in the same period: nothing changes.
-- 5. ops.purge_verification_findings(run, attempt) -> integer (modele point 3): at
--    findings_retention_days after the closure of a request, its purged evidence rows and its codes
--    deleted, its message and internal comment emptied; at findings_retention_days after the end of
--    a badge (ended_at), its figures, declared values, period and platform reference set to NULL, its
--    handle to '[deleted]' (as 0226), findings_erased_at written; the row of the badge is kept for
--    the register. retention.purged {category, count} on the run per category.
-- 6. The refresh (RG72, CA48; 06 RG54): the doors of 0222 already open an audience or brand request
--    on a badge to_refresh, to_reconfirm or active (08 cas limite 3), and an audience request asks
--    no ownership; the grant (0228) checks the active account badge and replaces the holding badge
--    (EC-L2E-14), a new decision gives a new date. Nothing to recreate (EC-L2F-05-3).
-- 7. leads.read_verified_badge() recreated by its owner: holds = active or to_refresh, without any
--    date filter (the task decides the end of a badge; to_reconfirm never counts, modele §3).
--
-- Rights (fiche invariant 10, 03 P7): influx_maintenance_definer reads the badges (never a handle, a
-- figure, a reference nor an agent), writes their state and reminder and erases their findings; reads
-- the id of a network line; deletes purged evidence rows and the codes of closed requests (never the
-- code read); empties the texts of a closed request (without reading them: the policy keeps the rows
-- that carry one); queues the three e-mails and lead.updated; executes the derivation of a line.
-- Nothing for influx_advertiser.
--
-- Not here: the withdrawal (0231), the disputes (0232), the identifier changes (0233); the scheduler,
-- the reads and the sending of the three e-mails (TypeScript, L2F commit 12); the amendments of 04,
-- 08 and 03 (closure of the jalon).
--
-- EC-L2F-05 (micro-gaps, the safest choice):
--   EC-L2F-05-1  0230 is the next free number (ls supabase/migrations).
--   EC-L2F-05-2  stamp_badge_end() also fires BEFORE INSERT (modele §2 names an UPDATE trigger): the
--                data set and a test insert an ended badge directly; the constraint badges_ended
--                would refuse them otherwise. An ended badge keeps its ended_at once written.
--   EC-L2F-05-3  open_own_request and open_own_brand_verification are NOT recreated: modele §3
--                wants them openable on a badge to_refresh, to_reconfirm or active in its reminder
--                window, which they already are; refusing an earlier refresh would contradict 08
--                cas limite 3 (« un créateur déjà vérifié redemande le même niveau : proposé comme
--                rafraîchissement ») and the attendu of verification-brand-route (L2E-B4). To
--                confirm by architecte; badge_reminder_days stays the task's only.
--   EC-L2F-05-4  a late task never skips « à rafraîchir »: an active badge past expires_at +
--                grace passes to to_refresh, and expires at the next run (the member gets the e-mail);
--                b runs before c, so that no badge goes active -> expired within one call.
--   EC-L2F-05-5  the emptying of the request texts is not counted against the 500 (the role does not
--                read the texts, so it cannot pick the rows that carry one); daily, it stays small.
--   EC-L2F-05-6  e-mail payload: event_id, account_id, badge_id, email_code (= the event type, as
--                0227); key <type>:<badge_id> (modele §4).
--
-- ROLLBACK (before any badge reaches to_refresh): drop function ops.run_badge_lifecycle(uuid,
-- smallint), ops.purge_verification_findings(uuid, smallint), ops.queue_badge_change(uuid, uuid,
-- text, boolean); recreate leads.read_verified_badge() as in 0227; drop trigger badges_stamp_end and function verification.stamp_badge_end(); drop the
-- policies *_maintenance_definer_* named below and revoke their grants; recreate the policies
-- outbox_events_maintenance_definer_insert and operational_settings_maintenance_definer_select
-- (0223); recreate badges_audience_figures as in 0221;
-- drop the constraints badges_ended, badges_findings_erased, badges_reminder_expiry and the three
-- columns; delete the key badge_reminder_days and recreate operational_settings_key_closed as in
-- 0221; delete the six event types of §4. The value badge_lifecycle of ops.periodic_task stays.
-- =============================================================================

-- 1. The life of a badge on its row (modele §2) --------------------------------------------------------

alter table verification.badges add column if not exists reminder_sent_at   timestamptz;
alter table verification.badges add column if not exists ended_at           timestamptz;
alter table verification.badges add column if not exists findings_erased_at timestamptz;

-- retroactive (modele §2): the badges already ended
update verification.badges
   set ended_at = coalesce(revoked_at, updated_at)
 where state in ('expired', 'revoked', 'replaced') and ended_at is null;

create or replace function verification.stamp_badge_end()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.state in ('expired', 'revoked', 'replaced') then
    if tg_op = 'UPDATE' and old.state in ('expired', 'revoked', 'replaced') then
      -- frozen once written
      new.ended_at := coalesce(old.ended_at, old.revoked_at, old.updated_at);
    elsif tg_op = 'UPDATE' then
      new.ended_at := pg_catalog.now();
    else
      new.ended_at := coalesce(new.ended_at, new.revoked_at, pg_catalog.now());
    end if;
  else
    new.ended_at := null;
  end if;
  return new;
end
$$;

comment on function verification.stamp_badge_end() is
  'BEFORE INSERT OR UPDATE on verification.badges (0230, modele §2; EC-L2F-05-2): ended_at = now() '
  'when a holding badge (active, to_refresh, to_reconfirm) becomes expired, revoked or replaced, '
  'whoever writes (a decision, the erasure of 0226, the task badge_lifecycle); frozen afterwards; '
  'NULL while the badge holds; an ended badge inserted directly takes its revoked_at or now(). The '
  'start of the retention of its findings (08 RG100). SECURITY INVOKER: no read, no right needed.';

revoke all on function verification.stamp_badge_end() from public, anon, authenticated, service_role;

drop trigger if exists badges_stamp_end on verification.badges;
create trigger badges_stamp_end
  before insert or update on verification.badges
  for each row execute function verification.stamp_badge_end();

alter table verification.badges drop constraint if exists badges_ended;
alter table verification.badges
  add constraint badges_ended
  check ((state in ('expired', 'revoked', 'replaced')) = (ended_at is not null));
alter table verification.badges drop constraint if exists badges_findings_erased;
alter table verification.badges
  add constraint badges_findings_erased check (findings_erased_at is null or ended_at is not null);
alter table verification.badges drop constraint if exists badges_reminder_expiry;
alter table verification.badges
  add constraint badges_reminder_expiry check (reminder_sent_at is null or expires_at is not null);

-- RG37, RG38, 04 l. 6391 (L2E-D3) as in 0221, except an audience badge whose findings were erased
-- after the retention (modele point 3)
alter table verification.badges drop constraint if exists badges_audience_figures;
alter table verification.badges
  add constraint badges_audience_figures
  check (level <> 'audience_verified'
         or findings_erased_at is not null
         or (observed_followers is not null and observed_posts_last_30_days is not null
             and observed_avg_comments is not null and observed_period_start is not null
             and observed_period_end is not null and declared_posts_at_decision is not null
             and declared_comments_at_decision is not null));

-- the retention of the findings (the task): the ended badges not yet erased
create index if not exists badges_findings_due_idx
  on verification.badges (ended_at) where findings_erased_at is null and ended_at is not null;

comment on column verification.badges.reminder_sent_at is
  'The reminder of 08 RG70 (« J-15 »), sent once at expires_at - badge_reminder_days by the task '
  'badge_lifecycle (0230); the badge is otherwise unchanged (CA45). NULL for a badge without expiry.';
comment on column verification.badges.ended_at is
  'The end of the badge (expired, revoked, replaced), written by verification.stamp_badge_end(); '
  'NULL while it holds. The findings are erased findings_retention_days after it (0230).';
comment on column verification.badges.findings_erased_at is
  'The day its figures, declared values, period, platform reference and handle were erased, '
  'findings_retention_days after ended_at (08 RG100, 0230); the row stays for the register.';

-- 2. The parameter of the reminder (modele §4, 08 RG70 « J-15 », RG100) --------------------------------

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
    'badge_reminder_days'));

alter table backoffice.operational_settings
  drop constraint if exists operational_settings_badge_reminder_days;
alter table backoffice.operational_settings
  add constraint operational_settings_badge_reminder_days check (
    key <> 'badge_reminder_days'
    or case when jsonb_typeof(value) = 'number'
            then (value)::numeric = trunc((value)::numeric) and (value)::numeric between 1 and 90
            else false end);

insert into backoffice.operational_settings (key, value) values ('badge_reminder_days', '15'::jsonb)
on conflict (key) do nothing;

comment on column backoffice.operational_settings.key is
  'Closed list (operational_settings_key_closed). claim_expiry_minutes: duration of a claim on a '
  'queue entry with a lock (15 RG27 C3, file.md A9), whole minutes, 1 to 1440. From 0221, the '
  'parameters of 08 RG100 (l2e/modele.md §4, values of D79): verification_code_validity_days, '
  'evidence_freshness_days, audience_badge_validity_days, badge_grace_days, '
  'brand_badge_validity_months, request_retry_hours, rejection_cap_count, '
  'rejection_cap_window_days, figures_gap_alert_percent, audience_drop_alert_percent, '
  'dispute_window_days, evidence_retention_days, findings_retention_days, '
  'evidence_max_files_per_request, evidence_max_upload_bytes; from 0230 badge_reminder_days (the '
  'reminder before the expiry of a badge, 15, 1 to 90); each a whole number in the range of its own '
  'CHECK operational_settings_<key>.';

-- 3. The task badge_lifecycle, daily (modele point 1) -------------------------------------------------

alter type ops.periodic_task add value if not exists 'badge_lifecycle';

comment on type ops.periodic_task is
  'E-4 tasks of maintenance.run_periodic (0117): brevo_reconciliation (daily), auth_orphan_purge '
  '(hourly), brevo_inbound_purge (daily), data_export_purge (hourly, 0136 and 0137), ops_retention '
  '(daily, 0147), storage_purge (hourly, 0205, 0223: the objects of Storage of the purging rows), '
  'verification_expiry (hourly, 0223: the draft requests whose code expired), badge_lifecycle '
  '(daily, 0230: the reminder, the expiry of the badges and the retention of their findings). A new '
  'task is a migration.';

-- 4. The register and the queue (modele §4) -----------------------------------------------------------

insert into audit.event_types (code, domain, subject_type, severity) values
  -- system events, no actor (C(15)); payload level (and cause), never a handle nor a figure
  ('verification.badge_reminded',     'verification', 'verification_badge', 'info'),
  ('verification.badge_to_refresh',   'verification', 'verification_badge', 'info'),
  ('verification.badge_expired',      'verification', 'verification_badge', 'info'),
  -- the queue only (never a register line): the three e-mails of the cycle (08 RG94)
  ('verification.expiry_reminder',    'verification', 'verification_badge', 'info'),
  ('verification.expiry_to_refresh',  'verification', 'verification_badge', 'info'),
  ('verification.expiry_removed',     'verification', 'verification_badge', 'info')
on conflict (code) do nothing;

-- 5. What influx_maintenance_definer reaches (fiche invariant 10) --------------------------------------

-- 5.1 The badges: the cycle reads no handle, figure, reference nor agent; the purge writes them NULL
grant select (id, account_id, social_account_id, level, state, expires_at, reminder_sent_at,
              ended_at, findings_erased_at),
      update (state, reminder_sent_at, observed_followers, observed_posts_last_30_days,
              observed_avg_comments, observed_engagement_bp, observed_period_start,
              observed_period_end, declared_followers_at_decision, declared_posts_at_decision,
              declared_comments_at_decision, declared_engagement_bp_at_decision,
              observed_handle_at_decision, observed_platform_account_ref, findings_erased_at)
   on verification.badges to influx_maintenance_definer;

drop policy if exists badges_maintenance_definer_select on verification.badges;
create policy badges_maintenance_definer_select on verification.badges
  for select to influx_maintenance_definer
  using (true);
-- the cycle: a holding badge stays active (its reminder), or becomes to_refresh or expired
drop policy if exists badges_maintenance_definer_cycle on verification.badges;
create policy badges_maintenance_definer_cycle on verification.badges
  for update to influx_maintenance_definer
  using (state in ('active', 'to_refresh', 'to_reconfirm') and findings_erased_at is null)
  with check (state in ('active', 'to_refresh', 'expired') and findings_erased_at is null);
-- the retention: an ended badge, once, its findings erased
drop policy if exists badges_maintenance_definer_erase on verification.badges;
create policy badges_maintenance_definer_erase on verification.badges
  for update to influx_maintenance_definer
  using (state in ('expired', 'revoked', 'replaced') and findings_erased_at is null)
  with check (state in ('expired', 'revoked', 'replaced') and findings_erased_at is not null
              and observed_platform_account_ref is null
              and (observed_handle_at_decision is null
                   or observed_handle_at_decision = '[deleted]'));

-- 5.2 The id of a network line (a line that no longer exists ends its badges, modele point 6)
grant select (id) on profiles.creator_social_accounts to influx_maintenance_definer;

drop policy if exists creator_social_accounts_maintenance_definer_select
  on profiles.creator_social_accounts;
create policy creator_social_accounts_maintenance_definer_select on profiles.creator_social_accounts
  for select to influx_maintenance_definer
  using (true);

-- 5.3 The retention of the requests: a purged evidence row and a code deleted, the texts emptied
-- without being read (the policy keeps the closed rows that carry one)
grant delete on verification.evidence_files to influx_maintenance_definer;

drop policy if exists evidence_files_maintenance_definer_delete on verification.evidence_files;
create policy evidence_files_maintenance_definer_delete on verification.evidence_files
  for delete to influx_maintenance_definer
  using (state = 'purged');

grant select (id) on verification.ownership_codes to influx_maintenance_definer;
grant delete on verification.ownership_codes to influx_maintenance_definer;

drop policy if exists ownership_codes_maintenance_definer_delete on verification.ownership_codes;
create policy ownership_codes_maintenance_definer_delete on verification.ownership_codes
  for delete to influx_maintenance_definer
  using (exists (select 1 from verification.verification_requests r
                  where r.id = ownership_codes.request_id and r.closed_at is not null));

grant select (closed_at),
      update (member_message, internal_comment)
   on verification.verification_requests to influx_maintenance_definer;

drop policy if exists verification_requests_maintenance_definer_erase_texts
  on verification.verification_requests;
create policy verification_requests_maintenance_definer_erase_texts
  on verification.verification_requests
  for update to influx_maintenance_definer
  using (closed_at is not null and (member_message is not null or internal_comment is not null))
  with check (closed_at is not null and member_message is null and internal_comment is null);

-- 5.4 The parameters of the cycle and of the retention
drop policy if exists operational_settings_maintenance_definer_select
  on backoffice.operational_settings;
create policy operational_settings_maintenance_definer_select on backoffice.operational_settings
  for select to influx_maintenance_definer
  using (key in ('evidence_retention_days', 'badge_grace_days', 'badge_reminder_days',
                 'findings_retention_days'));

-- 5.5 The e-mails of the cycle and lead.updated (ids only, 05 RG74)
drop policy if exists outbox_events_maintenance_definer_insert on leads.outbox_events;
create policy outbox_events_maintenance_definer_insert on leads.outbox_events
  for insert to influx_maintenance_definer
  with check (status = 'pending' and attempts = 0 and not dry_run and priority = 100
              and ((destination = 'brevo_transactional'
                    and event_type in ('verification.request_expired',
                                       'verification.expiry_reminder',
                                       'verification.expiry_to_refresh',
                                       'verification.expiry_removed'))
                   or (destination = 'brevo_contact' and event_type = 'lead.updated')));

-- 5.6 The derivation of a line (0225), executed as its owner grants it
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
set role influx_identity_definer;
grant execute on function profiles.refresh_creator_public_network(uuid) to influx_maintenance_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 6. The task, as influx_maintenance_definer (03 P7 rule 5) -------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_maintenance_definer', current_user);
end
$$;
grant create on schema ops to influx_maintenance_definer;
set role influx_maintenance_definer;

-- 6.1 What one change of a badge queues (helper, SECURITY INVOKER, no EXECUTE)
create or replace function ops.queue_badge_change(
  p_account_id  uuid,
  p_badge_id    uuid,
  p_email_type  text,
  p_lead        boolean)
returns void
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_event  uuid;
begin
  -- the e-mail of the member (08 RG94), written by the worker from email.json (D69); ids only
  if p_email_type is not null then
    v_event := pg_catalog.gen_random_uuid();
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (v_event, p_email_type, 'brevo_transactional', 'account:' || p_account_id::text, 100,
            pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id,
                                          'badge_id', p_badge_id, 'email_code', p_email_type),
            p_email_type || ':' || p_badge_id::text);
  end if;
  -- modele §4: VERIFIED_LEVEL follows every change of badge, Brevo only (never Apollo, RG92)
  if p_lead then
    v_event := pg_catalog.gen_random_uuid();
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (v_event, 'lead.updated', 'brevo_contact', 'account:' || p_account_id::text, 100,
            pg_catalog.jsonb_build_object('event_id', v_event, 'account_id', p_account_id),
            'lead.updated:' || v_event::text);
  end if;
end
$$;

comment on function ops.queue_badge_change(uuid, uuid, text, boolean) is
  'Helper of ops.run_badge_lifecycle() (0230, modele §4 "Outbox"): queues the e-mail p_email_type of '
  'the badge to brevo_transactional (event_id, account_id, badge_id, email_code; key '
  '<type>:<badge_id>) and, when p_lead, lead.updated to brevo_contact (event_id, account_id). '
  'SECURITY INVOKER, owned by influx_maintenance_definer; no EXECUTE for anyone.';

-- 6.2 The cycle (08 RG69 to RG71; 06 RG54; 03 C(15); modele points 1, 2, 6)
create or replace function ops.run_badge_lifecycle(
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
  v_grace     integer;
  v_reminder  integer;
  v_left      integer := 500;
  v_row       record;
begin
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code::text = 'badge_lifecycle') then
    raise exception 'no open badge_lifecycle run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  select (s.value)::integer into v_grace
    from backoffice.operational_settings s where s.key = 'badge_grace_days';
  select (s.value)::integer into v_reminder
    from backoffice.operational_settings s where s.key = 'badge_reminder_days';
  if v_grace is null or v_reminder is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;

  -- a. the line of a holding badge no longer exists: the badge ends, by the system (modele point 6)
  for v_row in
    select b.id, b.account_id, b.level
      from verification.badges b
     where b.state in ('active', 'to_refresh', 'to_reconfirm')
       and b.social_account_id is not null
       and not exists (select 1 from profiles.creator_social_accounts s
                        where s.id = b.social_account_id)
     order by b.id
     limit v_left
       for update of b skip locked
  loop
    update verification.badges b set state = 'expired'
     where b.id = v_row.id and b.state in ('active', 'to_refresh', 'to_reconfirm');
    if found then
      perform audit.append('verification.badge_expired', 'verification_badge', v_row.id,
                           pg_catalog.jsonb_build_object('level', v_row.level,
                                                         'cause', 'line_deleted'));
      perform ops.queue_badge_change(v_row.account_id, v_row.id, null, true);
      v_left := v_left - 1;
    end if;
  end loop;

  -- b. the end of the grace (RG70): to_refresh or to_reconfirm at expires_at + badge_grace_days
  for v_row in
    select b.id, b.account_id, b.level, b.social_account_id
      from verification.badges b
     where b.state in ('to_refresh', 'to_reconfirm')
       and b.expires_at is not null
       and b.expires_at + pg_catalog.make_interval(days => v_grace) <= pg_catalog.now()
     order by b.expires_at, b.id
     limit v_left
       for update of b skip locked
  loop
    update verification.badges b set state = 'expired'
     where b.id = v_row.id and b.state in ('to_refresh', 'to_reconfirm');
    if found then
      if v_row.level = 'audience_verified' then
        perform profiles.refresh_creator_public_network(v_row.social_account_id);
      end if;
      perform audit.append('verification.badge_expired', 'verification_badge', v_row.id,
                           pg_catalog.jsonb_build_object('level', v_row.level,
                                                         'cause', 'grace_ended'));
      perform ops.queue_badge_change(v_row.account_id, v_row.id, 'verification.expiry_removed', true);
      v_left := v_left - 1;
    end if;
  end loop;

  -- c. the expiry (RG69, RG70 « J+0 »; 06 RG54): active at expires_at -> to_refresh, visible, dated
  for v_row in
    select b.id, b.account_id, b.level, b.social_account_id
      from verification.badges b
     where b.state = 'active'
       and b.expires_at is not null
       and b.expires_at <= pg_catalog.now()
     order by b.expires_at, b.id
     limit v_left
       for update of b skip locked
  loop
    update verification.badges b set state = 'to_refresh'
     where b.id = v_row.id and b.state = 'active';
    if found then
      if v_row.level = 'audience_verified' then
        perform profiles.refresh_creator_public_network(v_row.social_account_id);
      end if;
      perform audit.append('verification.badge_to_refresh', 'verification_badge', v_row.id,
                           pg_catalog.jsonb_build_object('level', v_row.level));
      perform ops.queue_badge_change(v_row.account_id, v_row.id, 'verification.expiry_to_refresh',
                                     true);
      v_left := v_left - 1;
    end if;
  end loop;

  -- d. the reminder (RG70 « J-15 », CA45): once, the badge otherwise unchanged
  for v_row in
    select b.id, b.account_id, b.level
      from verification.badges b
     where b.state = 'active'
       and b.reminder_sent_at is null
       and b.expires_at is not null
       and b.expires_at > pg_catalog.now()
       and b.expires_at - pg_catalog.make_interval(days => v_reminder) <= pg_catalog.now()
     order by b.expires_at, b.id
     limit v_left
       for update of b skip locked
  loop
    update verification.badges b set reminder_sent_at = pg_catalog.now()
     where b.id = v_row.id and b.state = 'active' and b.reminder_sent_at is null;
    if found then
      perform audit.append('verification.badge_reminded', 'verification_badge', v_row.id,
                           pg_catalog.jsonb_build_object('level', v_row.level));
      perform ops.queue_badge_change(v_row.account_id, v_row.id, 'verification.expiry_reminder',
                                     false);
      v_left := v_left - 1;
    end if;
  end loop;

  return 500 - v_left;
end
$$;

comment on function ops.run_badge_lifecycle(uuid, smallint) is
  'E-4 badge_lifecycle (0230; 08 RG69 to RG71, CA45 to CA47; 06 RG54, CA31; 03 C(15); l2f/modele.md '
  'points 1, 2, 6): at most 500 badges per call (500: call again), in this order: a holding badge of '
  'a network line that no longer exists -> expired (cause line_deleted, no e-mail); to_refresh or '
  'to_reconfirm at expires_at + badge_grace_days -> expired (cause grace_ended, '
  'verification.expiry_removed); active at expires_at -> to_refresh (verification.expiry_to_refresh); '
  'active, never reminded, at expires_at - badge_reminder_days -> reminder_sent_at '
  '(verification.expiry_reminder), the badge otherwise unchanged. Each change of state: a register '
  'line verification.badge_expired {level, cause} | badge_to_refresh {level} (badge_reminded {level} '
  'for the reminder) on the badge, written without actor; lead.updated; the public row of an '
  'audience line derived again. A badge without expiry (« Compte vérifié ») only ends with its line. '
  'Replayed in the period: nothing changes. Inside the open badge_lifecycle run of this attempt only '
  '(55000 otherwise). SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; '
  'EXECUTE for influx_worker ONLY.';

-- 6.3 The retention of the findings (08 RG100; modele point 3)
create or replace function ops.purge_verification_findings(
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
  v_days      integer;
  v_cutoff    timestamptz;
  v_left      integer := 500;
  v_evidence  integer;
  v_codes     integer;
  v_texts     integer;
  v_badges    integer;
begin
  if not exists (select 1 from ops.periodic_runs r
                  where r.id = p_run_id and r.attempt = p_attempt and r.finished_at is null
                    and r.task_code::text = 'badge_lifecycle') then
    raise exception 'no open badge_lifecycle run for this attempt'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  select (s.value)::integer into v_days
    from backoffice.operational_settings s where s.key = 'findings_retention_days';
  if v_days is null then
    raise exception 'verification parameters missing' using errcode = 'object_not_in_prerequisite_state';
  end if;
  v_cutoff := pg_catalog.now() - pg_catalog.make_interval(days => v_days);

  -- the rows of the evidence whose object is gone, of a request closed for the retention
  delete from verification.evidence_files e
   where e.id in (select x.id
                    from verification.evidence_files x
                    join verification.verification_requests r on r.id = x.request_id
                   where x.state = 'purged' and r.closed_at <= v_cutoff
                   order by x.id
                   limit v_left);
  get diagnostics v_evidence = row_count;
  v_left := v_left - v_evidence;

  -- the codes of such a request, with what the agent read
  delete from verification.ownership_codes c
   where c.id in (select x.id
                    from verification.ownership_codes x
                    join verification.verification_requests r on r.id = x.request_id
                   where r.closed_at <= v_cutoff
                   order by x.id
                   limit v_left);
  get diagnostics v_codes = row_count;
  v_left := v_left - v_codes;

  -- its message and internal comment (EC-L2F-05-5: the policy keeps the rows that carry one)
  update verification.verification_requests r
     set member_message = null, internal_comment = null
   where r.closed_at <= v_cutoff;
  get diagnostics v_texts = row_count;

  -- the findings of a badge ended for the retention; the row stays for the register
  update verification.badges b
     set observed_followers                 = null,
         observed_posts_last_30_days        = null,
         observed_avg_comments              = null,
         observed_engagement_bp             = null,
         observed_period_start              = null,
         observed_period_end                = null,
         declared_followers_at_decision     = null,
         declared_posts_at_decision         = null,
         declared_comments_at_decision      = null,
         declared_engagement_bp_at_decision = null,
         observed_platform_account_ref      = null,
         observed_handle_at_decision        = case when b.level = 'brand_verified' then null
                                                   else '[deleted]' end,
         findings_erased_at                 = pg_catalog.now()
   where b.id in (select x.id
                    from verification.badges x
                   where x.ended_at <= v_cutoff and x.findings_erased_at is null
                   order by x.ended_at, x.id
                   limit v_left
                     for update of x skip locked);
  get diagnostics v_badges = row_count;

  if v_evidence > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_evidence_rows',
                                                       'count', v_evidence));
  end if;
  if v_codes > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_codes',
                                                       'count', v_codes));
  end if;
  if v_texts > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_request_texts',
                                                       'count', v_texts));
  end if;
  if v_badges > 0 then
    perform audit.append('retention.purged', 'periodic_run', p_run_id,
                         pg_catalog.jsonb_build_object('category', 'verification_badge_findings',
                                                       'count', v_badges));
  end if;
  return v_evidence + v_codes + v_texts + v_badges;
end
$$;

comment on function ops.purge_verification_findings(uuid, smallint) is
  'E-4 badge_lifecycle (0230; 08 RG100; l2f/modele.md point 3): findings_retention_days after the '
  'closure of a request, its purged evidence rows and its codes deleted, its member message and '
  'internal comment emptied; findings_retention_days after the end of a badge (ended_at), its '
  'figures, declared values, period and platform reference set to NULL, its handle to ''[deleted]'' '
  '(a network badge), findings_erased_at = now(); the row of the badge stays for the register. At '
  'most 500 rows deleted or erased per call (the texts besides, EC-L2F-05-5). retention.purged '
  '{category verification_evidence_rows | verification_codes | verification_request_texts | '
  'verification_badge_findings, count} on the run for each that changed. Inside the open '
  'badge_lifecycle run of this attempt only (55000 otherwise). Returns the count (500 or more: call '
  'again). SECURITY DEFINER owned by influx_maintenance_definer, empty search_path; EXECUTE for '
  'influx_worker ONLY.';

revoke all on function ops.queue_badge_change(uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function ops.run_badge_lifecycle(uuid, smallint)
  from public, anon, authenticated, service_role;
revoke all on function ops.purge_verification_findings(uuid, smallint)
  from public, anon, authenticated, service_role;
grant execute on function ops.run_badge_lifecycle(uuid, smallint) to influx_worker;
grant execute on function ops.purge_verification_findings(uuid, smallint) to influx_worker;

reset role;
revoke create on schema ops from influx_maintenance_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_maintenance_definer', current_user);
end
$$;

-- 7. The badge level of a Brevo contact, recreated by its owner from 0227 ------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_leads_definer', current_user);
end
$$;
grant create on schema leads to influx_leads_definer;
set role influx_leads_definer;

create or replace function leads.read_verified_badge(
  p_outbox_id  bigint,
  p_worker     text
)
returns table (
  verified_level  text,
  verified_at     timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_line     record;
  v_account  uuid;
  c_uuid     constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_worker is null or p_worker !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$' then
    raise exception 'a worker identifier is required: 1 to 100 characters among [A-Za-z0-9._:-]'
      using errcode = 'invalid_parameter_value';
  end if;

  select o.destination, o.subject_key
    into v_line
    from leads.outbox_events o
   where o.id = p_outbox_id
     and o.status = 'processing'
     and o.locked_by = p_worker;
  if not found then
    raise exception 'the queue line is not in processing for this worker'
      using errcode = 'object_not_in_prerequisite_state';
  end if;
  -- Brevo only: no badge leaves for Apollo (08 RG92)
  if v_line.destination <> 'brevo_contact' then
    raise exception 'a contact line of Brevo only'
      using errcode = 'invalid_parameter_value';
  end if;

  if pg_catalog.split_part(v_line.subject_key, ':', 1) <> 'account'
     or pg_catalog.split_part(v_line.subject_key, ':', 2) !~ c_uuid then
    return;
  end if;
  v_account := pg_catalog.split_part(v_line.subject_key, ':', 2)::uuid;

  -- modele §3 (0230): n2 audience, n1 account or brand, none otherwise; the date of the badge that
  -- fixes the level. A badge holds while it is shown (active, to_refresh), whatever its expiry: the
  -- task badge_lifecycle decides its end. to_reconfirm never counts.
  return query
  select case when au.at is not null then 'n2'
              when n1.at is not null then 'n1'
              else 'none' end,
         coalesce(au.at, n1.at)
    from identity.accounts a
    left join lateral (
           select pg_catalog.max(b.granted_at) as at
             from verification.badges b
            where b.account_id = a.id and b.level = 'audience_verified'
              and b.state in ('active', 'to_refresh')) au on true
    left join lateral (
           select pg_catalog.max(b.granted_at) as at
             from verification.badges b
            where b.account_id = a.id and b.level in ('account_verified', 'brand_verified')
              and b.state in ('active', 'to_refresh')) n1 on true
   where a.id = v_account
     and a.status <> 'deleted';
end
$$;

comment on function leads.read_verified_badge(bigint, text) is
  'E-3 read of the badge level of a Brevo contact (16 §M4 VERIFIED_LEVEL and VERIFIED_AT; 08 RG92; '
  'l2f/modele.md §3; 0227, 0230), on a brevo_contact line in processing for p_worker only (55000 '
  'otherwise; 22023 for another destination: nothing leaves for Apollo): n2 when an audience badge '
  'holds, n1 for an account or brand badge, none otherwise, with the grant date of the badge that '
  'fixes the level (null for none). Holds = active or to_refresh, without any date filter (the task '
  'badge_lifecycle ends a badge); to_reconfirm never. Never a figure, a handle, a network nor a '
  'reason. One row for an account that exists, none for an unknown or erased one. SECURITY DEFINER '
  'owned by influx_leads_definer, empty search_path; EXECUTE for influx_worker ONLY.';

reset role;
revoke create on schema leads from influx_leads_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_leads_definer', current_user);
end
$$;

-- 8. End-state assertions -------------------------------------------------------------------------

do $$
declare
  v_bad  text;
begin
  -- the functions: owner, security, empty search_path, callers
  select string_agg(f.sig, ', ') into v_bad
    from (values
      ('ops.run_badge_lifecycle(uuid,smallint)', 'influx_maintenance_definer', true,
       array['influx_worker']),
      ('ops.purge_verification_findings(uuid,smallint)', 'influx_maintenance_definer', true,
       array['influx_worker']),
      ('ops.queue_badge_change(uuid,uuid,text,boolean)', 'influx_maintenance_definer', false,
       array[]::text[]),
      ('leads.read_verified_badge(bigint,text)', 'influx_leads_definer', true,
       array['influx_worker']),
      ('profiles.refresh_creator_public_network(uuid)', 'influx_identity_definer', true,
       array['influx_verification_definer', 'influx_maintenance_definer'])
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
  if exists (select 1 from pg_catalog.pg_proc p,
                    pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
              where p.oid = 'verification.stamp_badge_end()'::regprocedure
                and a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner) then
    raise exception 'verification.stamp_badge_end() is executable by another role';
  end if;

  -- the ended badges carry their end, the parameter its value
  if exists (select 1 from verification.badges
              where (state in ('expired', 'revoked', 'replaced')) <> (ended_at is not null)) then
    raise exception 'an ended badge without ended_at, or a holding one with it';
  end if;
  if not exists (select 1 from backoffice.operational_settings
                  where key = 'badge_reminder_days' and value = '15'::jsonb) then
    raise exception 'badge_reminder_days is not 15';
  end if;

  -- the task reads no handle, figure, reference, agent nor code (fiche invariant 12)
  select string_agg(c, ', ') into v_bad
    from unnest(array['observed_handle_at_decision', 'observed_platform_account_ref',
                      'observed_followers', 'declared_followers_at_decision',
                      'granted_by_account_id']) c
   where pg_catalog.has_column_privilege('influx_maintenance_definer', 'verification.badges', c,
                                         'SELECT');
  if v_bad is not null
     or pg_catalog.has_column_privilege('influx_maintenance_definer',
                                        'verification.ownership_codes', 'code', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer',
                                        'verification.ownership_codes', 'observed_handle', 'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer',
                                        'verification.verification_requests', 'member_message',
                                        'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer',
                                        'verification.verification_requests', 'internal_comment',
                                        'SELECT')
     or pg_catalog.has_column_privilege('influx_maintenance_definer',
                                        'profiles.creator_social_accounts', 'handle', 'SELECT') then
    raise exception 'influx_maintenance_definer reads beyond the cycle and the retention: %',
      coalesce(v_bad, '-');
  end if;

  -- NON REVERSIBLE (fiche invariant 10, EC-L2E-18): still nothing for influx_advertiser
  if pg_catalog.has_schema_privilege('influx_advertiser', 'verification', 'USAGE, CREATE') then
    raise exception 'influx_advertiser holds a right on the schema verification';
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.pronamespace in ('verification'::regnamespace, 'ops'::regnamespace)
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'influx_advertiser may execute: %', v_bad;
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

  -- no definer role left usable nor with CREATE on its schema
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname in ('influx_maintenance_definer', 'influx_leads_definer',
                         'influx_identity_definer')
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'a definer role left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_maintenance_definer', 'ops', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_leads_definer', 'leads', 'CREATE') then
    raise exception 'a definer role left with CREATE on its schema';
  end if;
end
$$;
