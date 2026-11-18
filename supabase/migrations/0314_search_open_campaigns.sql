-- =============================================================================
-- 0314_search_open_campaigns
-- -----------------------------------------------------------------------------
-- Lot 3 / L3D, commit 02 (jalons/l3d/02.md; fiche invariants 1 to 9, 12; jalons/l3d/modele.md,
-- which PREVAILS for every name; 11 RG13, RG14, RG21, RG22, RG23, RG26, RG33, RG35, RG36, CA8, CA9,
-- CA15 to CA18; 09 RG99 to RG101; 18 TM5.2, TM5.6, T14, T15.3 to T15.5). The creator's read of the
-- open campaigns: the feed, the record and the brand logo behind three doors of the schema search,
-- the visibility computed in SQL, the journal of the reads (RG22), the rate per account, the
-- settings and the index of the feed. Signalled I-4 (03): a new definer role, SECURITY DEFINER
-- functions, GRANTs, policies. No audit.* object (modele §6: F3 without object).
--
-- 1. influx_campaign_feed_definer: NOLOGIN NOINHERIT, no member (modele §1, D81 (5)), added to the
--    closed list of 03 P7. Owner of the three doors and their four helpers; distinct from
--    influx_campaign_definer, which reads the budget band (a role reached from the creator holds
--    nothing of what D78 hides, l3b/modele §5), and from influx_identity_definer.
-- 2. backoffice.operational_settings, the closed list recreated with five keys (modele §5, pattern
--    0307), each a whole number in its range: campaign_feed_page_size 12 (1 to 50),
--    campaign_feed_max_pages 10 (1 to 50), campaign_feed_closed_days 7 (1 to 30),
--    creator_campaign_reads_per_minute 30 (1 to 600), creator_campaign_reads_per_day 600 (1 to
--    20 000). Staging hypotheses.
-- 3. campaigns.campaigns_feed_idx (first_published_at desc, id) where status = 'published' (§8).
-- 4. search.creator_campaign_reads (modele §6), NOT the register: one line per read of the feed (its
--    sort and page) or of a record (the campaign asked, no foreign key: a refusal keeps the id asked),
--    its outcome (served, refused, page_cap, rate_limited) and its instant; a CHECK of coherence, RLS
--    forced, immutable outside the erasure (guard_creator_campaign_read_write), indexed by account
--    and instant. Kept 12 months (hypothesis, as the search journal); the purge comes with that of
--    the search journal, at Lot 6 at the latest.
-- 5. What the owner reads, column by column, each right with its policy (modele §1): the eight
--    columns of a published campaign and its current snapshot; the published brand profile (the
--    columns of readOwnPublishedBrandPublicRow()) and its eight lists; its active logo; its holding
--    badge brand_verified; the status and country of the caller and of an advertiser account and
--    their roles; the status and the refused sectors of the caller's storefront; the five keys of
--    §2; the caller's own lines of the journal (its only write: an insertion). NEVER
--    advertiser_contact_details, advertiser_internal_details, a band, a budget, the reference, the
--    declaration nor the commercial owner (D46, D78 held by the rights).
-- 6. The helpers, SECURITY INVOKER, executed by their owner only:
--      search.visible_campaigns(creator)  THE predicate (modele §2): published with a current
--            snapshot, brand profile published, brand account active, ends_on >= the UTC day, the
--            sector not refused by the creator (silently, RG42, CA8); open while
--            applications_close_on >= the UTC day, greyed (applications_closed) for
--            campaign_feed_closed_days after it, absent beyond (RG26, CA9). Live columns; the
--            payload is the snapshot.
--      search.brand_public_row(advertiser)  the exact keys of PublishedBrandPublicRow
--            (profiles/repository.ts), the lists in the order of listColumn(), the badge in ISO_UTC;
--            NULL for a profile not published.
--      search.require_campaign_reader()  the caller (11 RG13, RG23; 09 RG99): the role creator, an
--            active account holding it, a storefront not suspended (any other state admitted);
--            42501 otherwise.
--      search.campaign_read_retry_after(creator)  the bucket (modele §5, pattern 0133): a
--            transaction lock per account, the lines but rate_limited counted on 60 s and 24 h
--            sliding; NULL within both limits, otherwise the seconds before enough lines leave.
-- 7. The three doors, SECURITY DEFINER, empty search_path, EXECUTE for influx_creator ONLY, no
--    dynamic SQL. The caller first (42501, nothing journaled), the parameters (22023, nothing
--    journaled), then the bucket. Every outcome is RETURNED and its line committed: apps/api answers
--    a refusal after COMMIT (modele §7).
--      search.read_open_campaigns(sort, page)  recent (first_published_at desc, id) or deadline
--            (open first, applications_close_on asc nulls last, id); page 1 to 50, beyond
--            campaign_feed_max_pages page_cap. {outcome: served, total (greyed included, RG35),
--            page, nextPage (null at the end or at the cap), capReached, items: [{id, publishedOn,
--            applicationsClosed, campaign (the snapshot whole), brand (brand_public_row whole)}]};
--            {outcome: page_cap, maxPages}; {outcome: rate_limited, retryAfterSeconds}.
--      search.read_open_campaign(campaign)  an OPEN campaign only: {outcome: served, id,
--            publishedOn, campaign, brand}; any other, unknown, greyed, paused, closed, draft, to
--            review, refused, of a brand suspended or unpublished, of a refused sector: {outcome:
--            refused} (RG24, RG100, T14: one body); {outcome: rate_limited, retryAfterSeconds}.
--      search.read_open_campaign_brand_logo(campaign)  (visible, object_key, width, height,
--            activated_at) of the active logo of the brand of an open or greyed campaign; visible
--            false otherwise; outside the bucket, never journaled.
-- 8. influx_creator: USAGE on search and EXECUTE on the three doors; nothing on campaigns, its schema
--    included (L3C-T3, TM5.6), on profiles.advertiser_* nor on a table of search.
-- 9. The rights of the data subject (04 §9): influx_privacy_definer reads the journal and deletes the
--    lines of an erased account; privacy.export_document() and privacy.execute_request() recreated
--    FROM THEIR 0310 VERSIONS: creator_profile.campaign_reads, the 15 categories unchanged; the
--    erasure deletes the lines of the account (step 3 nonies). Every other step is unchanged.
--
-- RIGHTS (03 I-4, signalled): a new role; USAGE on search to influx_creator, the owner and
-- influx_privacy_definer; column GRANTs and their policies TO the owner on campaigns.campaigns,
-- campaign_published_snapshots, profiles.advertiser_profiles and its eight lists,
-- brand_logo_objects, creator_public_profiles, creator_refused_sectors, verification.badges,
-- identity.accounts, account_roles, backoffice.operational_settings, search.creator_campaign_reads;
-- TO influx_privacy_definer on search.creator_campaign_reads; three doors executable by
-- influx_creator; two functions of E-5 recreated by their owner.
--
-- Not here: the routes, the contract, the rate per address (L3D-03), the screens (L3D-04, 05), the
-- purge of the journal (Lot 6 at the latest), party_blocks (L3E), RG14 point 5 (Lot 4).
--
-- EC-L3D-02 (micro-gaps, the safest choice):
--   EC-L3D-02-1  a read is exported with every column but its id and the account itself (the
--                document names it once, account_id); the campaign asked is the creator's own act.
--   EC-L3D-02-2  two helpers more than modele §1 names (require_campaign_reader,
--                campaign_read_retry_after), invoker and executed by nobody: one caller check for
--                the three doors, one bucket for the two counted ones.
--   EC-L3D-02-3  retryAfterSeconds is the instant at which the count of a full window falls below
--                its limit (the exit of the oldest counted line when the count equals the limit,
--                modele §5), rounded up, at least 1; the later of the two when both are full.
--   EC-L3D-02-4  a parameter out of its domain (sort, page outside 1 to 50, a NULL campaign) is 22023
--                and journals nothing: the contract of apps/api refuses it before the door; page_cap
--                journals a page of 1 to 50 beyond campaign_feed_max_pages.
--   EC-L3D-02-5  the badge is the latest holding brand_verified badge (active or to_refresh), as
--                profiles.read_own_brand_verification() (0222) reads it for the brand.
--   EC-L3D-02-6  a setting of the page or of the bucket missing is 55000 campaign_feed_settings
--                (never a default written in a function); the closure delay missing shows nothing.
--
-- ROLLBACK (before any line is journaled and any account erased once 0314 is applied): recreate
-- privacy.export_document() and privacy.execute_request() as in 0310 (as influx_privacy_definer);
-- drop the seven functions of search and search.guard_creator_campaign_read_write(); drop table
-- search.creator_campaign_reads; drop index campaigns.campaigns_feed_idx; drop the policies
-- *_campaign_feed_definer_* and creator_campaign_reads_privacy_definer_* and revoke their grants;
-- revoke usage on schema search from influx_creator and influx_privacy_definer; delete the five keys
-- of §2, drop their CHECKs and recreate operational_settings_key_closed as in 0307; drop role
-- influx_campaign_feed_definer.
-- =============================================================================

-- 1. The owner of the doors (03 P7 rule 5; rules 1 and 2 of 0001; modele §1) ------------------------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_campaign_feed_definer') then
    create role influx_campaign_feed_definer with nologin noinherit;
  end if;
  alter role influx_campaign_feed_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_feed_definer' and rolsuper) then
    raise exception 'role influx_campaign_feed_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_feed_definer' and rolbypassrls) then
    alter role influx_campaign_feed_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_feed_definer' and rolreplication) then
    alter role influx_campaign_feed_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_feed_definer' and rolcreatedb) then
    alter role influx_campaign_feed_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_feed_definer' and rolcreaterole) then
    alter role influx_campaign_feed_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. The settings of the feed and of the bucket (modele §5; 04 §5.10) ----------------------------------

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
    'badge_reminder_days', 'dispute_reflection_hours', 'portfolio_retention_days',
    'campaign_enhanced_review_minutes', 'campaign_live_cap', 'campaign_auto_close_days',
    'campaign_feed_page_size', 'campaign_feed_max_pages', 'campaign_feed_closed_days',
    'creator_campaign_reads_per_minute', 'creator_campaign_reads_per_day'));

-- EC-L3C-02-4 (0307): a whole JSON number in its range; CASE keeps the cast behind the type test
do $$
declare
  k record;
begin
  for k in select * from (values ('campaign_feed_page_size', 50),
                                 ('campaign_feed_max_pages', 50),
                                 ('campaign_feed_closed_days', 30),
                                 ('creator_campaign_reads_per_minute', 600),
                                 ('creator_campaign_reads_per_day', 20000)) as v (key, upper_bound)
  loop
    execute format('alter table backoffice.operational_settings drop constraint if exists %I',
                   'operational_settings_' || k.key);
    execute format('alter table backoffice.operational_settings add constraint %I check (key <> %L '
                   'or case when jsonb_typeof(value) = ''number'' then (value)::numeric = '
                   'trunc((value)::numeric) and (value)::numeric between 1 and %s else false end)',
                   'operational_settings_' || k.key, k.key, k.upper_bound);
  end loop;
end
$$;

insert into backoffice.operational_settings (key, value)
values ('campaign_feed_page_size', '12'::jsonb),
       ('campaign_feed_max_pages', '10'::jsonb),
       ('campaign_feed_closed_days', '7'::jsonb),
       ('creator_campaign_reads_per_minute', '30'::jsonb),
       ('creator_campaign_reads_per_day', '600'::jsonb)
on conflict (key) do nothing;

comment on column backoffice.operational_settings.key is
  'Closed list (operational_settings_key_closed), each key a whole number in the range of its own '
  'CHECK operational_settings_<key>, its meaning commented by the migration that added it (0206, '
  '0221, 0230, 0232, 0242, 0307). From 0314 (l3d/modele.md §5): campaign_feed_page_size (1 to 50, '
  'the cards of a page of the creator''s feed, RG21), campaign_feed_max_pages (1 to 50, the last page '
  'served, RG21, CA18), campaign_feed_closed_days (1 to 30, the days a campaign whose applications '
  'are closed stays greyed in the feed, RG26), creator_campaign_reads_per_minute (1 to 600) and '
  'creator_campaign_reads_per_day (1 to 20000), the reads of the feed and of the records per account '
  'on 60 s and 24 h sliding (CA18, T15.4).';

-- 3. The index of the feed (modele §8) -----------------------------------------------------------------

create index if not exists campaigns_feed_idx
  on campaigns.campaigns (first_published_at desc, id)
  where status = 'published';

-- 4. search.creator_campaign_reads, the journal of the reads (modele §6; 11 RG22, CA18) ---------------

create table if not exists search.creator_campaign_reads (
  id                  bigint      not null generated always as identity primary key,
  creator_account_id  uuid        not null references identity.accounts (id),
  kind                text        not null,
  -- no foreign key: a refusal keeps the identifier asked, known or not (RG100)
  campaign_id         uuid,
  feed_sort           text,
  feed_page           smallint,
  outcome             text        not null,
  read_at             timestamptz not null default now(),

  constraint creator_campaign_reads_kind check (kind in ('feed', 'record')),
  constraint creator_campaign_reads_outcome
    check (outcome in ('served', 'refused', 'page_cap', 'rate_limited')),
  constraint creator_campaign_reads_feed_sort check (feed_sort in ('recent', 'deadline')),
  constraint creator_campaign_reads_feed_page check (feed_page between 1 and 50),
  -- a read of the feed names its sort and page, never a campaign, and is never refused; a read of a
  -- record names the campaign asked, never a sort nor a page, and never meets the cap of pages
  constraint creator_campaign_reads_coherent check (
    (kind = 'feed' and campaign_id is null and feed_sort is not null and feed_page is not null
     and outcome in ('served', 'page_cap', 'rate_limited'))
    or (kind = 'record' and campaign_id is not null and feed_sort is null and feed_page is null
        and outcome in ('served', 'refused', 'rate_limited')))
);

-- the bucket (60 s and 24 h of one account) and the export
create index if not exists creator_campaign_reads_account_idx
  on search.creator_campaign_reads (creator_account_id, read_at desc);

comment on table search.creator_campaign_reads is
  'The reads of the open campaigns by a creator (11 RG22, CA18; l3d/modele.md §6): one line per call '
  'of search.read_open_campaigns() (kind feed: its sort and page) or search.read_open_campaign() '
  '(kind record: the campaign asked), its outcome and its instant; the logo is never journaled. Never '
  'served nor notified to the brand (RG40, RG101), never in its export. Written by '
  'influx_campaign_feed_definer only (the doors), read by it for the bucket (modele §5); exported and '
  'deleted by the erasure (influx_privacy_definer, 04 §9). Kept 12 months on read_at (hypothesis, as '
  'the search journal; purge at Lot 6 at the latest). Immutable outside the erasure.';
comment on column search.creator_campaign_reads.campaign_id is
  'The campaign asked by a read of a record, visible or not: no foreign key (a refusal keeps it, '
  'RG100). NULL for a read of the feed.';
comment on column search.creator_campaign_reads.outcome is
  'served (something was served), refused (a record not open to the caller: one answer, T14), '
  'page_cap (a page beyond campaign_feed_max_pages, CA18), rate_limited (the bucket of the account '
  'full, T15.5: nothing served, never counted in the bucket).';

-- 4.1 Immutable outside the erasure: no role but the owner inserts (§5), nobody updates; this
-- trigger is the second line
create or replace function search.guard_creator_campaign_read_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- free: the erasure deletes (its policy names an erased account), the migration role (every role
  -- outside influx_%) is not bound
  if current_user not like 'influx\_%'
     or (tg_op = 'DELETE' and current_user = 'influx_privacy_definer') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  raise exception 'campaign_read_immutable'
    using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_read_immutable';
end
$$;

comment on function search.guard_creator_campaign_read_write() is
  'l3d/modele.md §6 (0314): BEFORE UPDATE OR DELETE on search.creator_campaign_reads; 55000 '
  'campaign_read_immutable for every influx_% role but the DELETE of influx_privacy_definer (the '
  'erasure). SECURITY INVOKER, reads nothing.';

revoke all on function search.guard_creator_campaign_read_write()
  from public, anon, authenticated, service_role;

drop trigger if exists creator_campaign_reads_immutable on search.creator_campaign_reads;
create trigger creator_campaign_reads_immutable
  before update or delete on search.creator_campaign_reads
  for each row execute function search.guard_creator_campaign_read_write();

alter table search.creator_campaign_reads enable row level security;
alter table search.creator_campaign_reads force row level security;
revoke all on search.creator_campaign_reads
  from public, anon, authenticated, service_role, influx_advertiser, influx_creator, influx_agent,
       influx_admin;

-- 5. What influx_campaign_feed_definer reads and writes (modele §1) -----------------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner,
-- bounded to what a door serves (a published campaign, a published brand, the caller's own rows).

grant usage on schema search, campaigns, profiles, verification, identity, backoffice, influx
   to influx_campaign_feed_definer;
grant execute on function influx.current_account_id(), influx.current_account_role()
   to influx_campaign_feed_definer;

-- 5.1 The caller and the advertiser accounts: status, country (the brand row), role
grant select (id, status, country_code) on identity.accounts to influx_campaign_feed_definer;
grant select (account_id, role) on identity.account_roles to influx_campaign_feed_definer;

drop policy if exists account_roles_campaign_feed_definer_select on identity.account_roles;
create policy account_roles_campaign_feed_definer_select on identity.account_roles
  for select to influx_campaign_feed_definer
  using (account_id = (select influx.current_account_id()) or role = 'advertiser');

drop policy if exists accounts_campaign_feed_definer_select on identity.accounts;
create policy accounts_campaign_feed_definer_select on identity.accounts
  for select to influx_campaign_feed_definer
  using (id = (select influx.current_account_id())
         or exists (select 1 from identity.account_roles r
                     where r.account_id = accounts.id and r.role = 'advertiser'));

-- 5.2 The caller's storefront: its status (RG23) and its refused sectors (RG42, CA8)
grant select (account_id, status) on profiles.creator_public_profiles
   to influx_campaign_feed_definer;
grant select (account_id, sector_code) on profiles.creator_refused_sectors
   to influx_campaign_feed_definer;

drop policy if exists creator_public_profiles_campaign_feed_definer_select
  on profiles.creator_public_profiles;
create policy creator_public_profiles_campaign_feed_definer_select
  on profiles.creator_public_profiles
  for select to influx_campaign_feed_definer
  using (account_id = (select influx.current_account_id()));

drop policy if exists creator_refused_sectors_campaign_feed_definer_select
  on profiles.creator_refused_sectors;
create policy creator_refused_sectors_campaign_feed_definer_select
  on profiles.creator_refused_sectors
  for select to influx_campaign_feed_definer
  using (account_id = (select influx.current_account_id()));

-- 5.3 A published campaign: its eight live columns, never a text, a band, a budget, the reference,
-- the declaration nor the commercial owner; its CURRENT snapshot (the payload served)
grant select (id, advertiser_account_id, status, current_snapshot_id, first_published_at,
              applications_close_on, ends_on, sector_code)
   on campaigns.campaigns to influx_campaign_feed_definer;
grant select (id, campaign_id, payload)
   on campaigns.campaign_published_snapshots to influx_campaign_feed_definer;

drop policy if exists campaigns_campaign_feed_definer_select on campaigns.campaigns;
create policy campaigns_campaign_feed_definer_select on campaigns.campaigns
  for select to influx_campaign_feed_definer
  using (status = 'published');

drop policy if exists campaign_published_snapshots_campaign_feed_definer_select
  on campaigns.campaign_published_snapshots;
create policy campaign_published_snapshots_campaign_feed_definer_select
  on campaigns.campaign_published_snapshots
  for select to influx_campaign_feed_definer
  using (exists (select 1 from campaigns.campaigns c
                  where c.id = campaign_published_snapshots.campaign_id
                    and c.current_snapshot_id = campaign_published_snapshots.id
                    and c.status = 'published'));

-- 5.4 A published brand profile: the columns of readOwnPublishedBrandPublicRow(), never the contact
-- block (advertiser_contact_details) nor the internal block (advertiser_internal_details); its
-- eight lists
grant select (account_id, status, legal_name, primary_sector_code, company_size_band,
              website_domain, presentation, exclusivity_band, collaboration_rhythm,
              offers_non_monetary, contact_role)
   on profiles.advertiser_profiles to influx_campaign_feed_definer;

drop policy if exists advertiser_profiles_campaign_feed_definer_select
  on profiles.advertiser_profiles;
create policy advertiser_profiles_campaign_feed_definer_select on profiles.advertiser_profiles
  for select to influx_campaign_feed_definer
  using (status = 'published');

do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('advertiser_secondary_sectors',  'account_id, slot, sector_code'),
      ('advertiser_target_markets',     'account_id, slot, country_code'),
      ('advertiser_working_languages',  'account_id, language_code'),
      ('advertiser_topics',             'account_id, slot, topic_code'),
      ('advertiser_networks',           'account_id, network_code'),
      ('advertiser_formats',            'account_id, format_code'),
      ('advertiser_audience_countries', 'account_id, slot, country_code'),
      ('advertiser_usage_rights',       'account_id, usage_right_code')
    ) as v (name, columns)
  loop
    execute format('grant select (%s) on profiles.%I to influx_campaign_feed_definer',
                   l.columns, l.name);
    execute format('drop policy if exists %I on profiles.%I',
                   l.name || '_campaign_feed_definer_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_campaign_feed_definer '
                   'using (exists (select 1 from profiles.advertiser_profiles p '
                   'where p.account_id = %I.account_id and p.status = ''published''))',
                   l.name || '_campaign_feed_definer_select', l.name, l.name);
  end loop;
end
$$;

-- 5.5 The active logo of a published brand (the logo door relays it, never its bytes here)
grant select (account_id, state, object_key, width, height, activated_at, created_at)
   on profiles.brand_logo_objects to influx_campaign_feed_definer;

drop policy if exists brand_logo_objects_campaign_feed_definer_select on profiles.brand_logo_objects;
create policy brand_logo_objects_campaign_feed_definer_select on profiles.brand_logo_objects
  for select to influx_campaign_feed_definer
  using (state = 'active'
         and exists (select 1 from profiles.advertiser_profiles p
                      where p.account_id = brand_logo_objects.account_id
                        and p.status = 'published'));

-- 5.6 The holding badge « Marque vérifiée » and its date (11 RG15, 06 RG53)
grant select (account_id, level, state, granted_at) on verification.badges
   to influx_campaign_feed_definer;

drop policy if exists badges_campaign_feed_definer_select on verification.badges;
create policy badges_campaign_feed_definer_select on verification.badges
  for select to influx_campaign_feed_definer
  using (level = 'brand_verified' and state in ('active', 'to_refresh'));

-- 5.7 The five keys of §2
grant select (key, value) on backoffice.operational_settings to influx_campaign_feed_definer;

drop policy if exists operational_settings_campaign_feed_definer_select
  on backoffice.operational_settings;
create policy operational_settings_campaign_feed_definer_select on backoffice.operational_settings
  for select to influx_campaign_feed_definer
  using (key in ('campaign_feed_page_size', 'campaign_feed_max_pages', 'campaign_feed_closed_days',
                 'creator_campaign_reads_per_minute', 'creator_campaign_reads_per_day'));

-- 5.8 The caller's own lines of the journal: what the bucket counts, and the line of each read
grant select (creator_account_id, outcome, read_at),
      insert (creator_account_id, kind, campaign_id, feed_sort, feed_page, outcome)
   on search.creator_campaign_reads to influx_campaign_feed_definer;

drop policy if exists creator_campaign_reads_campaign_feed_definer_select
  on search.creator_campaign_reads;
create policy creator_campaign_reads_campaign_feed_definer_select on search.creator_campaign_reads
  for select to influx_campaign_feed_definer
  using (creator_account_id = (select influx.current_account_id()));

drop policy if exists creator_campaign_reads_campaign_feed_definer_insert
  on search.creator_campaign_reads;
create policy creator_campaign_reads_campaign_feed_definer_insert on search.creator_campaign_reads
  for insert to influx_campaign_feed_definer
  with check (creator_account_id = (select influx.current_account_id()));

-- 6. The helpers (SECURITY INVOKER, executed by their owner only) --------------------------------------

-- 6.1 The caller (11 RG13, RG23; 09 RG99)
create or replace function search.require_campaign_reader()
returns uuid
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_caller  uuid := influx.current_account_id();
begin
  -- a creator session on an active account holding the role, its storefront in any state but
  -- suspended (draft, to review, published, refused: RG13, RG99)
  if v_caller is null
     or influx.current_account_role() is distinct from 'creator'::identity.account_role
     or not exists (
          select 1
            from identity.accounts a
            join identity.account_roles r on r.account_id = a.id and r.role = 'creator'
            join profiles.creator_public_profiles p on p.account_id = a.id
           where a.id = v_caller and a.status = 'active' and p.status <> 'suspended') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return v_caller;
end
$$;

comment on function search.require_campaign_reader() is
  '11 RG13, RG23, 09 RG99 (0314, EC-L3D-02-2): the account of a creator session that may read the '
  'open campaigns (the role creator, an active account holding it, a storefront not suspended); '
  '42501 forbidden otherwise. SECURITY INVOKER owned by influx_campaign_feed_definer, executed by '
  'its owner only.';

-- 6.2 The bucket of an account (modele §5; 11 RG21, CA18; 18 T15.3 to T15.5)
create or replace function search.campaign_read_retry_after(p_creator_account_id uuid)
returns integer
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  v_per_minute  integer;
  v_per_day     integer;
  v_minute      integer;
  v_day         integer;
  v_exit        timestamptz;
  v_retry       integer;
begin
  select (s.value)::integer into v_per_minute
    from backoffice.operational_settings s
   where s.key = 'creator_campaign_reads_per_minute';
  select (s.value)::integer into v_per_day
    from backoffice.operational_settings s
   where s.key = 'creator_campaign_reads_per_day';
  if v_per_minute is null or v_per_day is null then
    raise exception 'campaign_feed_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_feed_settings';
  end if;

  -- one read at a time per account: the count and the line the door adds are one step
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('search.creator_campaign_reads:' || p_creator_account_id::text, 0));

  -- served by creator_campaign_reads_account_idx; a refused read is counted, a rate_limited never
  select (count(*) filter (where r.read_at > pg_catalog.now() - interval '60 seconds'))::integer,
         (count(*))::integer
    into v_minute, v_day
    from search.creator_campaign_reads r
   where r.creator_account_id = p_creator_account_id
     and r.outcome <> 'rate_limited'
     and r.read_at > pg_catalog.now() - interval '24 hours';

  -- EC-L3D-02-3: the exit of the line that leaves the count of the window below its limit
  if v_minute >= v_per_minute then
    select r.read_at + interval '60 seconds' into v_exit
      from search.creator_campaign_reads r
     where r.creator_account_id = p_creator_account_id
       and r.outcome <> 'rate_limited'
       and r.read_at > pg_catalog.now() - interval '60 seconds'
     order by r.read_at
     offset v_minute - v_per_minute
     limit 1;
    v_retry := (pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer;
  end if;
  if v_day >= v_per_day then
    select r.read_at + interval '24 hours' into v_exit
      from search.creator_campaign_reads r
     where r.creator_account_id = p_creator_account_id
       and r.outcome <> 'rate_limited'
       and r.read_at > pg_catalog.now() - interval '24 hours'
     order by r.read_at
     offset v_day - v_per_day
     limit 1;
    v_retry := greatest(coalesce(v_retry, 0),
                        (pg_catalog.ceil(extract(epoch from v_exit - pg_catalog.now())))::integer);
  end if;
  if v_retry is null then
    return null;
  end if;
  return greatest(v_retry, 1);
end
$$;

comment on function search.campaign_read_retry_after(uuid) is
  'l3d/modele.md §5 (0314, EC-L3D-02-2, -3): under a transaction lock per account, counts the reads '
  'of the feed and of the records of p_creator_account_id but rate_limited ones on 60 s and 24 h '
  'sliding, against creator_campaign_reads_per_minute and creator_campaign_reads_per_day (55000 '
  'campaign_feed_settings when one is missing). NULL within both limits; otherwise the whole '
  'seconds, at least 1, before the count of every full window falls below its limit. Writes '
  'nothing: the door writes the line. SECURITY INVOKER owned by influx_campaign_feed_definer, '
  'executed by its owner only.';

-- 6.3 THE predicate of the feed, the record and the logo (modele §2; 11 RG14, RG26, RG42; 09 RG100)
create or replace function search.visible_campaigns(p_creator_account_id uuid)
returns table (
  campaign_id            uuid,
  advertiser_account_id  uuid,
  snapshot_id            uuid,
  first_published_at     timestamptz,
  applications_close_on  date,
  applications_closed    boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.id, c.advertiser_account_id, c.current_snapshot_id, c.first_published_at,
         c.applications_close_on, c.applications_close_on < d.today
    from campaigns.campaigns c
    -- RG11, RG14 point 2, CA2: the brand profile published, its account active
    join profiles.advertiser_profiles p
      on p.account_id = c.advertiser_account_id and p.status = 'published'
    join identity.accounts a
      on a.id = c.advertiser_account_id and a.status = 'active'
    cross join (select pg_catalog.timezone('UTC', pg_catalog.now())::date as today,
                       (select (s.value)::integer
                          from backoffice.operational_settings s
                         where s.key = 'campaign_feed_closed_days') as closed_days) d
   -- RG14 point 1, RG100: published by INFLUX, its snapshot served
   where c.status = 'published'
     and c.current_snapshot_id is not null
     -- RG14 point 4: the period not over (the UTC day)
     and c.ends_on >= d.today
     -- RG14 point 3, RG26, CA9: open, or greyed for campaign_feed_closed_days, absent beyond
     and c.applications_close_on >= d.today - d.closed_days
     -- RG42, CA8: a sector the creator refuses, silently
     and not exists (select 1 from profiles.creator_refused_sectors r
                       where r.account_id = p_creator_account_id
                         and r.sector_code = c.sector_code)
$$;

comment on function search.visible_campaigns(uuid) is
  'l3d/modele.md §2 (0314), THE predicate of the three doors: the campaigns the creator '
  'p_creator_account_id may see, read on their live columns (state, dates, sector): published with a '
  'current snapshot, brand profile published, brand account active (RG11, RG14, CA2), ends_on >= '
  'the UTC day, a sector the creator does not refuse (RG42, CA8: no trace, no count), '
  'applications_close_on >= the UTC day (open) or within campaign_feed_closed_days before it '
  '(applications_closed: greyed, RG26, CA9). RG14 point 5 waits for Lot 4, party_blocks for L3E. '
  'SECURITY INVOKER owned by influx_campaign_feed_definer, executed by its owner only.';

-- 6.4 The public row of a published brand (modele §1; invariant 2: one mapping, brandPublicViewOf())
create or replace function search.brand_public_row(p_advertiser_account_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
           'legal_name',           p.legal_name,
           'country',              a.country_code::text,
           'primary_sector_code',  p.primary_sector_code,
           'company_size_band',    p.company_size_band,
           'website_domain',       p.website_domain,
           'presentation',         p.presentation,
           'exclusivity_band',     p.exclusivity_band,
           'collaboration_rhythm', p.collaboration_rhythm,
           'offers_non_monetary',  p.offers_non_monetary,
           'contact_role',         p.contact_role,
           'has_logo',             exists (select 1 from profiles.brand_logo_objects lo
                                            where lo.account_id = p.account_id
                                              and lo.state = 'active'),
           -- EC-L3D-02-5: the latest holding badge, its date in ISO_UTC
           'badge_granted_at',     (select pg_catalog.to_char(
                                             pg_catalog.timezone('UTC', b.granted_at),
                                             'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                                      from verification.badges b
                                     where b.account_id = p.account_id
                                       and b.level = 'brand_verified'
                                       and b.state in ('active', 'to_refresh')
                                     order by b.granted_at desc
                                     limit 1),
           -- the eight lists in the order of listColumn(): their slot, or their code
           'secondarySectors',     coalesce((select pg_catalog.jsonb_agg(l.sector_code::text
                                                                         order by l.slot)
                                               from profiles.advertiser_secondary_sectors l
                                              where l.account_id = p.account_id), '[]'::jsonb),
           'targetMarkets',        coalesce((select pg_catalog.jsonb_agg(l.country_code::text
                                                                         order by l.slot)
                                               from profiles.advertiser_target_markets l
                                              where l.account_id = p.account_id), '[]'::jsonb),
           'workingLanguages',     coalesce((select pg_catalog.jsonb_agg(l.language_code::text
                                                                         order by l.language_code)
                                               from profiles.advertiser_working_languages l
                                              where l.account_id = p.account_id), '[]'::jsonb),
           'topics',               coalesce((select pg_catalog.jsonb_agg(l.topic_code::text
                                                                         order by l.slot)
                                               from profiles.advertiser_topics l
                                              where l.account_id = p.account_id), '[]'::jsonb),
           'networks',             coalesce((select pg_catalog.jsonb_agg(l.network_code::text
                                                                         order by l.network_code)
                                               from profiles.advertiser_networks l
                                              where l.account_id = p.account_id), '[]'::jsonb),
           'formats',              coalesce((select pg_catalog.jsonb_agg(l.format_code::text
                                                                         order by l.format_code)
                                               from profiles.advertiser_formats l
                                              where l.account_id = p.account_id), '[]'::jsonb),
           'audienceCountries',    coalesce((select pg_catalog.jsonb_agg(l.country_code::text
                                                                         order by l.slot)
                                               from profiles.advertiser_audience_countries l
                                              where l.account_id = p.account_id), '[]'::jsonb),
           'usageRights',          coalesce((select pg_catalog.jsonb_agg(l.usage_right_code::text
                                                                         order by l.usage_right_code)
                                               from profiles.advertiser_usage_rights l
                                              where l.account_id = p.account_id), '[]'::jsonb))
    from profiles.advertiser_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.account_id = p_advertiser_account_id
     and p.status = 'published'
$$;

comment on function search.brand_public_row(uuid) is
  'l3d/modele.md §1 (0314; 11 RG15, RG16, CA5; D46): the public row of the PUBLISHED brand profile '
  'p_advertiser_account_id, the exact keys of PublishedBrandPublicRow (apps/api '
  'profiles/repository.ts): legal_name, country, primary_sector_code, company_size_band, '
  'website_domain, presentation, exclusivity_band, collaboration_rhythm, offers_non_monetary, '
  'contact_role (the function of the contact person, never a coordinate), has_logo, '
  'badge_granted_at (ISO_UTC, the latest holding brand_verified badge) and the eight lists in the '
  'order of listColumn(); NULL for a profile not published. apps/api validates it and calls '
  'brandPublicViewOf(). NEVER the contact block nor the internal block. SECURITY INVOKER owned by '
  'influx_campaign_feed_definer, executed by its owner only.';

-- 7. The three doors (modele §1, §3, §4; SECURITY DEFINER, EXECUTE for influx_creator only) -----------

-- 7.1 The feed (11 RG21, RG33, RG35, RG36, CA15 to CA18)
create or replace function search.read_open_campaigns(p_sort text, p_page integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller     uuid;
  v_page_size  integer;
  v_max_pages  integer;
  v_retry      integer;
  v_total      integer;
  v_items      jsonb;
begin
  v_caller := search.require_campaign_reader();
  -- EC-L3D-02-4: the domain of the contract, refused before anything is written
  if p_sort is null or p_sort not in ('recent', 'deadline') then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'sort';
  end if;
  if p_page is null or p_page not between 1 and 50 then
    raise exception 'invalid_parameter' using errcode = 'invalid_parameter_value', detail = 'page';
  end if;
  select (s.value)::integer into v_page_size
    from backoffice.operational_settings s
   where s.key = 'campaign_feed_page_size';
  select (s.value)::integer into v_max_pages
    from backoffice.operational_settings s
   where s.key = 'campaign_feed_max_pages';
  if v_page_size is null or v_max_pages is null then
    raise exception 'campaign_feed_settings'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_feed_settings';
  end if;

  -- CA18, T15.5: the bucket full, nothing served, the refusal journaled with the account
  v_retry := search.campaign_read_retry_after(v_caller);
  if v_retry is not null then
    insert into search.creator_campaign_reads
      (creator_account_id, kind, feed_sort, feed_page, outcome)
    values (v_caller, 'feed', p_sort, p_page, 'rate_limited');
    return pg_catalog.jsonb_build_object('outcome', 'rate_limited', 'retryAfterSeconds', v_retry);
  end if;

  -- RG21, CA18: the cap of pages, held by the base, journaled
  if p_page > v_max_pages then
    insert into search.creator_campaign_reads
      (creator_account_id, kind, feed_sort, feed_page, outcome)
    values (v_caller, 'feed', p_sort, p_page, 'page_cap');
    return pg_catalog.jsonb_build_object('outcome', 'page_cap', 'maxPages', v_max_pages);
  end if;

  -- RG35: the count before the list, greyed campaigns included
  select (count(*))::integer into v_total from search.visible_campaigns(v_caller);

  -- RG33, CA15 to CA17: two sorts, the identifier last (stable from page to page); the rank, not a
  -- cursor (modele §4); the snapshot whole and the brand row whole, picked by apps/api (§3)
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'id',                 f.campaign_id,
           'publishedOn',        pg_catalog.timezone('UTC', f.first_published_at)::date,
           'applicationsClosed', f.applications_closed,
           'campaign',           s.payload,
           'brand',              search.brand_public_row(f.advertiser_account_id))
         order by f.rank), '[]'::jsonb)
    into v_items
    from (select v.campaign_id, v.advertiser_account_id, v.snapshot_id, v.first_published_at,
                 v.applications_closed,
                 pg_catalog.row_number() over (
                   order by case when p_sort = 'deadline' then v.applications_closed end,
                            case when p_sort = 'deadline' then v.applications_close_on end
                              nulls last,
                            case when p_sort = 'recent' then v.first_published_at end desc,
                            v.campaign_id) as rank
            from search.visible_campaigns(v_caller) v) f
    join campaigns.campaign_published_snapshots s on s.id = f.snapshot_id
   where f.rank > (p_page - 1) * v_page_size
     and f.rank <= p_page * v_page_size;

  insert into search.creator_campaign_reads
    (creator_account_id, kind, feed_sort, feed_page, outcome)
  values (v_caller, 'feed', p_sort, p_page, 'served');

  return pg_catalog.jsonb_build_object(
    'outcome',    'served',
    'total',      v_total,
    'page',       p_page,
    'nextPage',   case when v_total > p_page * v_page_size and p_page < v_max_pages
                       then p_page + 1 end,
    'capReached', p_page = v_max_pages and v_total > p_page * v_page_size,
    'items',      v_items);
end
$$;

comment on function search.read_open_campaigns(text, integer) is
  '11 RG21, RG33, RG35, RG36, CA15 to CA18 (0314, l3d/modele.md §3, §4): a page of the feed of the '
  'open campaigns of the calling creator (search.require_campaign_reader: 42501 otherwise, nothing '
  'journaled). p_sort recent (first_published_at desc, id) or deadline (open first, '
  'applications_close_on asc nulls last, id), p_page 1 to 50 (22023 otherwise, DETAIL sort or page, '
  'nothing journaled). Under the bucket of the account (search.campaign_read_retry_after): '
  '{outcome: rate_limited, retryAfterSeconds}; beyond campaign_feed_max_pages: {outcome: page_cap, '
  'maxPages}; otherwise {outcome: served, total (greyed included), page, nextPage (null at the end '
  'or at the cap), capReached, items: [{id, publishedOn (UTC day of first_published_at), '
  'applicationsClosed, campaign (the current snapshot whole), brand (search.brand_public_row)}]}, '
  'campaign_feed_page_size cards. Every outcome writes its line of search.creator_campaign_reads '
  '(kind feed, sort, page). SECURITY DEFINER owned by influx_campaign_feed_definer, empty '
  'search_path; EXECUTE for influx_creator only.';

-- 7.2 The record (11 RG16, RG22, RG24; 09 RG100; T14)
create or replace function search.read_open_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_caller  uuid;
  v_retry   integer;
  v_record  jsonb;
begin
  v_caller := search.require_campaign_reader();
  if p_campaign_id is null then
    raise exception 'invalid_parameter'
      using errcode = 'invalid_parameter_value', detail = 'campaign';
  end if;

  v_retry := search.campaign_read_retry_after(v_caller);
  if v_retry is not null then
    insert into search.creator_campaign_reads (creator_account_id, kind, campaign_id, outcome)
    values (v_caller, 'record', p_campaign_id, 'rate_limited');
    return pg_catalog.jsonb_build_object('outcome', 'rate_limited', 'retryAfterSeconds', v_retry);
  end if;

  -- an OPEN campaign only (modele §2): a greyed one has no record (RG26, CA9)
  select pg_catalog.jsonb_build_object(
           'outcome',     'served',
           'id',          v.campaign_id,
           'publishedOn', pg_catalog.timezone('UTC', v.first_published_at)::date,
           'campaign',    s.payload,
           'brand',       b.brand)
    into v_record
    from search.visible_campaigns(v_caller) v
    join campaigns.campaign_published_snapshots s on s.id = v.snapshot_id
    cross join lateral (select search.brand_public_row(v.advertiser_account_id) as brand) b
   where v.campaign_id = p_campaign_id
     and not v.applications_closed
     and b.brand is not null;

  -- RG24, RG100, T14: unknown, greyed, paused, closed, draft, to review, refused, of a brand
  -- suspended or unpublished, of a refused sector: one answer, journaled with the id asked
  if v_record is null then
    insert into search.creator_campaign_reads (creator_account_id, kind, campaign_id, outcome)
    values (v_caller, 'record', p_campaign_id, 'refused');
    return pg_catalog.jsonb_build_object('outcome', 'refused');
  end if;

  -- RG22: the account, the campaign, the instant; never served nor notified to the brand (RG101)
  insert into search.creator_campaign_reads (creator_account_id, kind, campaign_id, outcome)
  values (v_caller, 'record', p_campaign_id, 'served');
  return v_record;
end
$$;

comment on function search.read_open_campaign(uuid) is
  '11 RG16, RG22, RG24, 09 RG100, RG101, 18 T14 (0314, l3d/modele.md §2, §3): the record of the '
  'OPEN campaign p_campaign_id for the calling creator (42501 otherwise, nothing journaled; 22023 '
  'for a NULL id). Under the bucket: {outcome: rate_limited, retryAfterSeconds}; an open campaign '
  'of search.visible_campaigns: {outcome: served, id, publishedOn, campaign (the current snapshot '
  'whole), brand (search.brand_public_row, never null)}; any other campaign, known or not: {outcome: '
  'refused}, one body. Every outcome writes its line of search.creator_campaign_reads (kind record, '
  'the id asked). SECURITY DEFINER owned by influx_campaign_feed_definer, empty search_path; EXECUTE '
  'for influx_creator only.';

-- 7.3 The logo of the brand of a visible campaign (modele §1, §7: relayed by apps/api)
create or replace function search.read_open_campaign_brand_logo(p_campaign_id uuid)
returns table (
  visible       boolean,
  object_key    text,
  width         integer,
  height        integer,
  activated_at  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_caller  uuid;
  v_brand   uuid;
begin
  v_caller := search.require_campaign_reader();
  if p_campaign_id is null then
    raise exception 'invalid_parameter'
      using errcode = 'invalid_parameter_value', detail = 'campaign';
  end if;

  -- an open or greyed campaign (the card shows the logo of a greyed one, RG26)
  select v.advertiser_account_id into v_brand
    from search.visible_campaigns(v_caller) v
   where v.campaign_id = p_campaign_id;
  if v_brand is null then
    return query select false, null::text, null::integer, null::integer, null::timestamptz;
    return;
  end if;

  return query
    select true, lo.object_key, lo.width::integer, lo.height::integer,
           coalesce(lo.activated_at, lo.created_at)
      from (select 1) one
      left join lateral (select l.object_key, l.width, l.height, l.activated_at, l.created_at
                           from profiles.brand_logo_objects l
                          where l.account_id = v_brand and l.state = 'active'
                          order by l.activated_at desc
                          limit 1) lo on true;
end
$$;

comment on function search.read_open_campaign_brand_logo(uuid) is
  'l3d/modele.md §1, §7 (0314; 11 RG15): one row (visible, object_key, width, height, activated_at) '
  'for the calling creator (42501 otherwise; 22023 for a NULL id): the active logo of the brand of an '
  'open or greyed campaign of search.visible_campaigns (its key, sides and date; nulls without a '
  'logo), or visible false for any other campaign, known or not. Outside the bucket, never '
  'journaled. SECURITY DEFINER owned by influx_campaign_feed_definer, empty search_path; EXECUTE '
  'for influx_creator only.';

-- 7.4 Rights on the functions, then to their owner (03 P7 rule 5)
revoke all on function search.require_campaign_reader()
  from public, anon, authenticated, service_role;
revoke all on function search.campaign_read_retry_after(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.visible_campaigns(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.brand_public_row(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.read_open_campaigns(text, integer)
  from public, anon, authenticated, service_role;
revoke all on function search.read_open_campaign(uuid)
  from public, anon, authenticated, service_role;
revoke all on function search.read_open_campaign_brand_logo(uuid)
  from public, anon, authenticated, service_role;

grant execute on function search.read_open_campaigns(text, integer) to influx_creator;
grant execute on function search.read_open_campaign(uuid) to influx_creator;
grant execute on function search.read_open_campaign_brand_logo(uuid) to influx_creator;

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_feed_definer', current_user);
end
$$;
grant create on schema search to influx_campaign_feed_definer;

alter function search.require_campaign_reader() owner to influx_campaign_feed_definer;
alter function search.campaign_read_retry_after(uuid) owner to influx_campaign_feed_definer;
alter function search.visible_campaigns(uuid) owner to influx_campaign_feed_definer;
alter function search.brand_public_row(uuid) owner to influx_campaign_feed_definer;
alter function search.read_open_campaigns(text, integer) owner to influx_campaign_feed_definer;
alter function search.read_open_campaign(uuid) owner to influx_campaign_feed_definer;
alter function search.read_open_campaign_brand_logo(uuid) owner to influx_campaign_feed_definer;

revoke create on schema search from influx_campaign_feed_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_feed_definer', current_user);
end
$$;

-- 8. The creator: the schema search, its three doors, nothing else (modele §1; TM5.6) -----------------

grant usage on schema search to influx_creator;

-- 9. The rights of the data subject (04 §9; modele §6) --------------------------------------------------

-- 9.1 influx_privacy_definer: the journal read for the export, the lines of an erased account
-- deleted (the policy names an account already `deleted`); identity.accounts (id, status) read
-- since 0137
grant usage on schema search to influx_privacy_definer;
grant select (id, creator_account_id, kind, campaign_id, feed_sort, feed_page, outcome, read_at),
      delete
   on search.creator_campaign_reads to influx_privacy_definer;

drop policy if exists creator_campaign_reads_privacy_definer_select on search.creator_campaign_reads;
create policy creator_campaign_reads_privacy_definer_select on search.creator_campaign_reads
  for select to influx_privacy_definer
  using (true);

drop policy if exists creator_campaign_reads_privacy_definer_erase on search.creator_campaign_reads;
create policy creator_campaign_reads_privacy_definer_erase on search.creator_campaign_reads
  for delete to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = creator_campaign_reads.creator_account_id
                    and a.status = 'deleted'));

-- 9.2 E-5 recreated by its owner from its 0310 versions (export and execution)

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 9.2.1 The export (0137 ... 0306, 0310): the reads of the open campaigns in creator_profile ------------
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
               -- 0226 (06 RG46 to RG52; fiche invariant 16): the internal block as entered, each
               -- brand request (status, dates, reason, message to the brand) and each brand badge
               -- (state, date, source, expiry, withdrawal); never a code, the domain observed, the
               -- registry consulted, an agent, the lock nor the internal comment; 0235: the origin
               -- of each request (D83: member or agent, the agent's reason; never the agent nor his
               -- comment) and the message of a withdrawal on the badge it withdrew
               'verification', pg_catalog.jsonb_build_object(
                  'internal_details', (
                     select pg_catalog.jsonb_build_object(
                              'legal_name', d.legal_name,
                              'registration_country_code', d.registration_country_code,
                              'registration_number', d.registration_number,
                              'created_at', privacy.iso_utc(d.created_at),
                              'updated_at', privacy.iso_utc(d.updated_at))
                       from profiles.advertiser_internal_details d
                      where d.account_id = p.account_id),
                  'requests', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'level', r.level, 'status', r.status,
                              'created_at', privacy.iso_utc(r.created_at),
                              'submitted_at', privacy.iso_utc(r.submitted_at),
                              'decided_at', privacy.iso_utc(r.decided_at),
                              'rejection_reason', r.rejection_reason_code,
                              'member_message', r.member_message,
                              'cancelled_at', privacy.iso_utc(r.cancelled_at),
                              'closed_at', privacy.iso_utc(r.closed_at),
                              'opened_by', r.opened_by,
                              'opening_reason', r.opening_reason_code)
                            order by r.created_at, r.id)
                       from verification.verification_requests r
                      where r.account_id = p.account_id and r.population = 'brand'), '[]'::jsonb),
                  'badges', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'level', b.level, 'state', b.state,
                              'granted_at', privacy.iso_utc(b.granted_at),
                              'source', b.evidence_source,
                              'expires_at', privacy.iso_utc(b.expires_at),
                              'revoked_at', privacy.iso_utc(b.revoked_at),
                              'revocation_reason', b.revocation_reason_code,
                              'revocation_message', (
                                 select q.member_message
                                   from verification.badge_revocation_requests q
                                  where q.dual_control_request_id = b.revocation_request_id
                                    and q.badge_id = b.id and q.executed_at is not null))
                            order by b.granted_at, b.id)
                       from verification.badges b
                      where b.account_id = p.account_id and b.level = 'brand_verified'),
                     '[]'::jsonb)),
               -- 0306 (l3b/modele.md §7; fiche invariant 10): each campaign as the brand entered it
               -- (its internal reference, total budget and budget band included), its state, its
               -- dates, its lists in their order and its declaration of RG85 (instant, locale, hex
               -- hash); never its id, the author of the declaration (the account itself), the
               -- suspended exact range nor erased_at; 0310 (l3c/modele.md §9; EC-L3C-05-1, -2): its
               -- cycle (first publication, pause and its origin, closure), each examination of queue 7
               -- (state, dates, reason, message to the brand), each snapshot (version, instant,
               -- payload, hex hash) and each intervention of INFLUX (kind, field, old and new value,
               -- reason, instant); never an agent, the commercial owner, a lock, a deadline, the first
               -- review, the duplicate alert nor an internal comment
               'campaigns', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'status', c.status,
                           'title', c.title,
                           'campaign_type', c.campaign_type_code,
                           'public_summary', c.public_summary,
                           'brief', c.brief,
                           'internal_reference', c.internal_reference,
                           'product_description', c.product_description,
                           'sector', c.sector_code,
                           'restrictions', c.restrictions,
                           'product_is_sent', c.product_is_sent,
                           'product_value_band', c.product_value_band_code,
                           'creator_keeps_product', c.creator_keeps_product,
                           'shipping_costs_borne_by', c.shipping_costs_borne_by,
                           'key_messages', coalesce((
                              select pg_catalog.jsonb_agg(k.body order by k.position)
                                from campaigns.campaign_key_messages k
                               where k.campaign_id = c.id), '[]'::jsonb),
                           'deliverables', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'network', d.network_code, 'format', d.format_code,
                                       'quantity', d.quantity)
                                     order by d.slot)
                                from campaigns.campaign_deliverables d
                               where d.campaign_id = c.id), '[]'::jsonb),
                           'usage_rights', c.usage_rights_code,
                           'usage_rights_duration', c.usage_rights_duration_band,
                           'usage_rights_territory_scope', c.usage_rights_territory_scope,
                           'usage_territories', coalesce((
                              select pg_catalog.jsonb_agg(u.country_code order by u.slot)
                                from campaigns.campaign_usage_territories u
                               where u.campaign_id = c.id), '[]'::jsonb),
                           'exclusivity', c.exclusivity_band,
                           'content_review_delay', c.content_review_delay,
                           'audience_gender', c.audience_gender_code,
                           'audience_countries', coalesce((
                              select pg_catalog.jsonb_agg(a.country_code order by a.slot)
                                from campaigns.campaign_audience_countries a
                               where a.campaign_id = c.id), '[]'::jsonb),
                           'audience_languages', coalesce((
                              select pg_catalog.jsonb_agg(l.language_code order by l.language_code)
                                from campaigns.campaign_audience_languages l
                               where l.campaign_id = c.id), '[]'::jsonb),
                           'audience_bands', coalesce((
                              select pg_catalog.jsonb_agg(b.audience_band_code
                                                          order by b.audience_band_code)
                                from campaigns.campaign_audience_bands b
                               where b.campaign_id = c.id), '[]'::jsonb),
                           'audience_age_bands', coalesce((
                              select pg_catalog.jsonb_agg(g.age_band_code order by g.age_band_code)
                                from campaigns.campaign_audience_age_bands g
                               where g.campaign_id = c.id), '[]'::jsonb),
                           'topics', coalesce((
                              select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                                from campaigns.campaign_topics t
                               where t.campaign_id = c.id), '[]'::jsonb),
                           'currency', c.currency,
                           'remuneration_kind', c.remuneration_kind,
                           'budget_band', c.per_creator_budget_band_code,
                           'creators_wanted', c.creators_wanted,
                           'total_budget_minor', c.total_budget_minor,
                           'applications_close_on', c.applications_close_on,
                           'content_due_on', c.content_due_on,
                           'starts_on', c.starts_on,
                           'ends_on', c.ends_on,
                           'max_applications', c.max_applications,
                           'requested_items', coalesce((
                              select pg_catalog.jsonb_agg(r.item_code order by r.slot)
                                from campaigns.campaign_requested_items r
                               where r.campaign_id = c.id), '[]'::jsonb),
                           'authorizations_declaration',
                              case when c.authorizations_declared_at is not null then
                                pg_catalog.jsonb_build_object(
                                  'declared_at', privacy.iso_utc(c.authorizations_declared_at),
                                  'locale', c.authorizations_declaration_locale,
                                  'sha256', pg_catalog.encode(c.authorizations_declaration_hash,
                                                              'hex'))
                              end,
                           'submitted_at', privacy.iso_utc(c.submitted_at),
                           'first_published_at', privacy.iso_utc(c.first_published_at),
                           'paused_at', privacy.iso_utc(c.paused_at),
                           'pause_origin', c.pause_origin,
                           'closed_at', privacy.iso_utc(c.closed_at),
                           'reviews', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'state', e.state,
                                       'created_at', privacy.iso_utc(e.created_at),
                                       'decided_at', privacy.iso_utc(e.decided_at),
                                       'rejection_reason', e.rejection_reason_code,
                                       'member_message', e.member_message,
                                       'closed_at', privacy.iso_utc(e.closed_at))
                                     order by e.created_at, e.id)
                                from campaigns.campaign_review_entries e
                               where e.campaign_id = c.id
                                 and e.advertiser_account_id = c.advertiser_account_id),
                              '[]'::jsonb),
                           'snapshots', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'version', s.version,
                                       'published_at', privacy.iso_utc(s.published_at),
                                       'content', s.payload,
                                       'sha256', pg_catalog.encode(s.content_hash, 'hex'))
                                     order by s.version)
                                from campaigns.campaign_published_snapshots s
                               where s.campaign_id = c.id), '[]'::jsonb),
                           'interventions', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'kind', i.kind,
                                       'field', i.field_code,
                                       'old_value', i.old_value,
                                       'new_value', i.new_value,
                                       'reason', i.reason_code,
                                       'created_at', privacy.iso_utc(i.created_at))
                                     order by i.created_at, i.id)
                                from campaigns.agent_interventions i
                               where i.campaign_id = c.id
                                 and i.advertiser_account_id = c.advertiser_account_id),
                              '[]'::jsonb),
                           'created_at', privacy.iso_utc(c.created_at),
                           'updated_at', privacy.iso_utc(c.updated_at))
                         order by c.created_at, c.id)
                    from campaigns.campaigns c
                   where c.advertiser_account_id = p.account_id), '[]'::jsonb),
               'created_at', privacy.iso_utc(p.created_at),
               'updated_at', privacy.iso_utc(p.updated_at))
        from profiles.advertiser_profiles p
       where p.account_id = p_account_id),

    -- Profil créateur (0216 to 0218, L2D; 0219): the storefront as entered and derived, its lists
    -- in the order chosen, its identity (layer N), its network lines with their exact figures,
    -- their bands and their exact audience, the refused sectors and the history of the metrics
    -- (art. 15: the creator receives what concerns him); never public_ref nor the id of a line or
    -- of a history row (EC-L2D-06-1); an agent author of a history row shown as INFLUX
    'creator_profile', (
      select pg_catalog.jsonb_build_object(
               'alias', p.alias,
               'status', p.status,
               'is_searchable', p.is_searchable,
               'published_at', privacy.iso_utc(p.published_at),
               'headline', p.headline,
               'bio', p.bio,
               'primary_topic', p.primary_topic_code,
               'secondary_topics', coalesce((
                  select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                    from profiles.creator_topics t
                   where t.account_id = p.account_id), '[]'::jsonb),
               'publication_languages', coalesce((
                  select pg_catalog.jsonb_agg(l.language_code order by l.slot)
                    from profiles.creator_publication_languages l
                   where l.account_id = p.account_id), '[]'::jsonb),
               'tones', coalesce((
                  select pg_catalog.jsonb_agg(t.tone_code order by t.slot)
                    from profiles.creator_tones t
                   where t.account_id = p.account_id), '[]'::jsonb),
               'formats', coalesce((
                  select pg_catalog.jsonb_agg(f.format_code order by f.format_code)
                    from profiles.creator_formats f
                   where f.account_id = p.account_id), '[]'::jsonb),
               'usage_rights', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'usage_right', u.usage_right_code, 'inclusion', u.inclusion)
                         order by u.usage_right_code)
                    from profiles.creator_usage_rights u
                   where u.account_id = p.account_id), '[]'::jsonb),
               'residence_country', p.residence_country_code,
               'residence_region', p.residence_region_code,
               'travel_scope', p.travel_scope,
               'collaboration_experience', p.collaboration_experience_band,
               'delivery_lead', p.delivery_lead_band,
               'max_exclusivity', p.max_exclusivity_band,
               'accepts_non_monetary', p.accepts_non_monetary,
               'availability', p.availability_band,
               'availability_declared_at', privacy.iso_utc(p.availability_declared_at),
               'main_audience_country', p.main_audience_country,
               'main_audience_share_band', p.main_audience_share_band,
               'audience_gender_band', p.audience_gender_band,
               'audience_share_bands', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'dimension', a.dimension, 'bucket', a.bucket,
                           'share_band', a.share_band)
                         order by a.dimension, a.bucket)
                    from profiles.creator_public_audience a
                   where a.account_id = p.account_id), '[]'::jsonb),
               'identity', (
                  select pg_catalog.jsonb_build_object(
                           'legal_first_name', i.legal_first_name,
                           'legal_last_name', i.legal_last_name,
                           'contact_email', i.contact_email, 'contact_phone', i.contact_phone,
                           'address_line', i.address_line, 'postal_code', i.postal_code,
                           'city', i.city, 'country_code', i.country_code,
                           'completeness_percent', i.completeness_percent,
                           'updated_at', privacy.iso_utc(i.updated_at))
                    from profiles.creator_identities i
                   where i.account_id = p.account_id),
               'refused_sectors', coalesce((
                  select pg_catalog.jsonb_agg(r.sector_code order by r.sector_code)
                    from profiles.creator_refused_sectors r
                   where r.account_id = p.account_id), '[]'::jsonb),
               'networks', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'network', s.network_code,
                           'is_primary', s.is_primary,
                           'handle', s.handle,
                           'pseudonym', s.pseudonym,
                           'profile_url', s.profile_url,
                           'followers_count', s.followers_count,
                           'posts_last_30_days', s.posts_last_30_days,
                           'avg_comments_per_post', s.avg_comments_per_post,
                           'avg_reach_per_post', s.avg_reach_per_post,
                           'engagement_rate_bp', s.engagement_rate_bp,
                           'figures_source', s.figures_source,
                           'figures_measured_at', privacy.iso_utc(s.figures_measured_at),
                           'bands', (
                              select pg_catalog.jsonb_build_object(
                                       'audience', n.audience_band, 'reach', n.reach_band,
                                       'publication_frequency', n.publication_frequency_code,
                                       'comments', n.comment_band,
                                       'engagement', n.engagement_band)
                                from profiles.creator_public_networks n
                               where n.social_account_id = s.id),
                           'audience', pg_catalog.jsonb_build_object(
                              'countries', coalesce((
                                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                          'slot', c.slot, 'country_code', c.country_code,
                                          'share_percent', c.share_percent)
                                        order by c.slot)
                                   from profiles.creator_audience_countries c
                                  where c.social_account_id = s.id), '[]'::jsonb),
                              'ages', coalesce((
                                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                          'age_band', g.age_band_code,
                                          'share_percent', g.share_percent)
                                        order by g.age_band_code)
                                   from profiles.creator_audience_ages g
                                  where g.social_account_id = s.id), '[]'::jsonb),
                              'genders', coalesce((
                                 select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                          'gender', g.gender_code,
                                          'share_percent', g.share_percent)
                                        order by g.gender_code)
                                   from profiles.creator_audience_genders g
                                  where g.social_account_id = s.id), '[]'::jsonb)),
                           'created_at', privacy.iso_utc(s.created_at),
                           'updated_at', privacy.iso_utc(s.updated_at))
                         order by s.created_at, s.id)
                    from profiles.creator_social_accounts s
                   where s.account_id = p.account_id), '[]'::jsonb),
               'metrics_history', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'network', h.network_code,
                           'followers_count', h.followers_count,
                           'posts_last_30_days', h.posts_last_30_days,
                           'avg_comments_per_post', h.avg_comments_per_post,
                           'figures_source', h.figures_source,
                           'confirmed', h.confirmed,
                           'recorded_at', privacy.iso_utc(h.recorded_at),
                           'recorded_by', case when h.recorded_by_account_id = p.account_id
                                               then 'self' else 'INFLUX' end)
                         order by h.recorded_at, h.id)
                    from profiles.creator_network_metrics_history h
                   where h.account_id = p.account_id), '[]'::jsonb),
               -- 0226 (08 RG4, RG10; fiche invariant 16): each creator request (network, level,
               -- status, dates, reason, message to the creator) and each network badge (network,
               -- level, state, date, source, period, observed figures, expiry, withdrawal); never an
               -- evidence, a code, the observed handle, the platform reference, an agent, the lock,
               -- the internal comment nor the declared values at the decision (the gap, RG41).
               -- 0235 (fiche invariants 13, 14): the origin of each request (D83), the message of a
               -- withdrawal on its badge, each contest (target, network, level, reason, text, dates,
               -- state, outcome reason and message, cause of a withdrawal; never the deciders, the
               -- lock, the deadlines, review_mode nor the internal comment) and each entry of queue 6
               -- (network, the handle declared, count, dates, state, cause of a withdrawal; never the
               -- previous handle, the handle the agent read, an agent nor the internal comment)
               'verification', pg_catalog.jsonb_build_object(
                  'requests', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'network', r.network_code, 'level', r.level, 'status', r.status,
                              'created_at', privacy.iso_utc(r.created_at),
                              'submitted_at', privacy.iso_utc(r.submitted_at),
                              'decided_at', privacy.iso_utc(r.decided_at),
                              'rejection_reason', r.rejection_reason_code,
                              'member_message', r.member_message,
                              'cancelled_at', privacy.iso_utc(r.cancelled_at),
                              'closed_at', privacy.iso_utc(r.closed_at),
                              'opened_by', r.opened_by,
                              'opening_reason', r.opening_reason_code)
                            order by r.created_at, r.id)
                       from verification.verification_requests r
                      where r.account_id = p.account_id and r.population = 'creator'),
                     '[]'::jsonb),
                  'badges', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'network', b.network_code, 'level', b.level, 'state', b.state,
                              'granted_at', privacy.iso_utc(b.granted_at),
                              'source', b.evidence_source,
                              'period_start', b.observed_period_start,
                              'period_end', b.observed_period_end,
                              'observed_followers', b.observed_followers,
                              'observed_posts_last_30_days', b.observed_posts_last_30_days,
                              'observed_avg_comments', b.observed_avg_comments,
                              'observed_engagement_bp', b.observed_engagement_bp,
                              'expires_at', privacy.iso_utc(b.expires_at),
                              'revoked_at', privacy.iso_utc(b.revoked_at),
                              'revocation_reason', b.revocation_reason_code,
                              'revocation_message', (
                                 select q.member_message
                                   from verification.badge_revocation_requests q
                                  where q.dual_control_request_id = b.revocation_request_id
                                    and q.badge_id = b.id and q.executed_at is not null))
                            order by b.granted_at, b.id)
                       from verification.badges b
                      where b.account_id = p.account_id and b.level <> 'brand_verified'),
                     '[]'::jsonb),
                  'disputes', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'target', case when d.request_id is not null then 'refusal'
                                             else 'withdrawal' end,
                              'network', d.network_code, 'level', d.level,
                              'reason', d.reason_code,
                              'text', d.text,
                              'submitted_at', privacy.iso_utc(d.submitted_at),
                              'state', d.state,
                              'outcome_reason', d.outcome_reason_code,
                              'member_message', d.member_message,
                              'decided_at', privacy.iso_utc(d.decided_at),
                              'withdrawn_cause', d.withdrawn_cause,
                              'closed_at', privacy.iso_utc(d.closed_at))
                            order by d.submitted_at, d.id)
                       from verification.disputes d
                      where d.account_id = p.account_id), '[]'::jsonb),
                  'identifier_changes', coalesce((
                     select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                              'network', i.network_code,
                              'new_handle', i.new_handle,
                              'change_count', i.change_count,
                              'created_at', privacy.iso_utc(i.created_at),
                              'last_changed_at', privacy.iso_utc(i.last_changed_at),
                              'state', i.state,
                              'decided_at', privacy.iso_utc(i.decided_at),
                              'withdrawn_cause', i.withdrawn_cause,
                              'closed_at', privacy.iso_utc(i.closed_at))
                            order by i.created_at, i.id)
                       from verification.identifier_change_reviews i
                      where i.account_id = p.account_id), '[]'::jsonb)),
               -- 0245 (fiche invariant 15; modele -14): each visual (state, place, replacement,
               -- size, sides, caption, dates, refusal reason) with its statements of RG83 (caption
               -- declared, key of the text, instant); never the bytes, the key, the checksum, an
               -- agent, the lock, the deadlines, the internal comment nor the retention (EC-L2G-05-3)
               'portfolio', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'state', v.state,
                           'display_order', v.display_order,
                           'replacement', v.replaces_item_id is not null,
                           'byte_size', v.byte_size, 'width', v.width, 'height', v.height,
                           'caption', v.caption,
                           'created_at', privacy.iso_utc(v.created_at),
                           'stored_at', privacy.iso_utc(v.stored_at),
                           'decided_at', privacy.iso_utc(v.decided_at),
                           'rejection_reason', v.rejection_reason_code,
                           'withdrawn_at', privacy.iso_utc(v.withdrawn_at),
                           'purged_at', privacy.iso_utc(v.purged_at),
                           'brand_declarations', coalesce((
                              select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                       'caption', d.caption,
                                       'statement_key', d.statement_key,
                                       'declared_at', privacy.iso_utc(d.declared_at))
                                     order by d.declared_at, d.id)
                                from profiles.portfolio_brand_declarations d
                               where d.portfolio_item_id = v.id
                                 and d.account_id = v.account_id), '[]'::jsonb))
                         order by v.created_at, v.id)
                    from profiles.portfolio_items v
                   where v.account_id = p.account_id), '[]'::jsonb),
               -- 0245: each examination of queue 2 (kind, state, dates, reason, message to the
               -- creator); never the internal comment, an agent, the lock nor the deadlines
               'review_entries', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'kind', e.kind, 'state', e.state,
                           'created_at', privacy.iso_utc(e.created_at),
                           'decided_at', privacy.iso_utc(e.decided_at),
                           'rejection_reason', e.rejection_reason_code,
                           'member_message', e.member_message,
                           'closed_at', privacy.iso_utc(e.closed_at))
                         order by e.created_at, e.id)
                    from profiles.creator_review_entries e
                   where e.account_id = p.account_id), '[]'::jsonb),
               -- 0245 (04 §5.2): each value submitted for a moderated creator field, without its row
               -- key nor the id of a statement (EC-L2G-05-2)
               'field_revisions', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'field', r.field_code,
                           'proposed_value',
                              case when pg_catalog.jsonb_typeof(r.proposed_value) = 'object'
                                   then r.proposed_value - 'brand_declaration_id'
                                   else r.proposed_value end,
                           'status', r.status,
                           'submitted_at', privacy.iso_utc(r.submitted_at),
                           'closed_at', privacy.iso_utc(r.closed_at))
                         order by r.submitted_at, r.field_code)
                    from profiles.creator_field_revisions r
                   where r.account_id = p.account_id), '[]'::jsonb),
               -- 0314 (l3d/modele.md §6; 11 RG22): each read of the feed of the open campaigns or
               -- of a campaign record (kind, campaign asked, sort, page, outcome, instant); never
               -- the id of a line (EC-L3D-02-1)
               'campaign_reads', coalesce((
                  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                           'kind', r.kind,
                           'campaign_id', r.campaign_id,
                           'feed_sort', r.feed_sort,
                           'feed_page', r.feed_page,
                           'outcome', r.outcome,
                           'read_at', privacy.iso_utc(r.read_at))
                         order by r.read_at, r.id)
                    from search.creator_campaign_reads r
                   where r.creator_account_id = p.account_id), '[]'::jsonb),
               'created_at', privacy.iso_utc(p.created_at),
               'updated_at', privacy.iso_utc(p.updated_at))
        from profiles.creator_public_profiles p
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

    -- Journal d'activité: code and date, an internal actor shown as INFLUX, no payload, no hash;
    -- 0302 (F3, jalons/l3a/f3.md): the codes classified exported only; 0310 (L3BS-5): the lines whose
    -- subject is a campaign of the account (the decisions and interventions of INFLUX, the system
    -- closure), an agent or the system shown as INFLUX, never named
    'activity_log', coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
               'code', e.event_type, 'occurred_at', privacy.iso_utc(e.occurred_at),
               'actor', case when e.actor_account_id = p_account_id then 'self' else 'INFLUX' end)
             order by e.seq)
        from audit.audit_events e
        join audit.event_types t on t.code = e.event_type and t.export_class = 'exported'
       where e.actor_account_id = p_account_id
          or (e.subject_type = 'account' and e.subject_id = p_account_id)
          or (e.subject_type = 'campaign'
              and e.subject_id in (select c.id from campaigns.campaigns c
                                    where c.advertiser_account_id = p_account_id))
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
  'version: 1, generated_at, account_id, language, time_zone, notice, categories, data} with the 15 '
  'categories of privacy.export_categories() (EC-J8-48); advertiser_profile carries the whole brand '
  'profile of 0202, its lists and its contact person (04 §9.2), and logo_files, the metadata of '
  'its logo objects (0204: state, size, sides, dates; never the bytes nor the key), review_entries '
  '(0207: kind, state, dates, reason, message to the brand; never the internal comment, an agent '
  'nor the lock), field_revisions (0207: field, row, value, status, dates) and verification (0226: '
  'the internal block, the brand requests and badges) and campaigns (0306: each campaign as entered, '
  'its internal reference, total budget and budget band included, its state, dates and lists in '
  'their order, its declaration of RG85: instant, locale, hex hash; never its id, the author of '
  'the declaration, the suspended range nor erased_at; 0310: its cycle first_published_at, '
  'paused_at, pause_origin, closed_at, its reviews of queue 7 (state, dates, reason, message to the '
  'brand), its snapshots (version, instant, content, hex hash) and the interventions of INFLUX '
  '(kind, field, old and new value, reason, instant); never an agent, the commercial owner, a lock, '
  'a deadline, the first review, the duplicate alert nor an internal comment); creator_profile '
  '(0219) carries the creator '
  'storefront of 0216 and 0218, its five lists, its identity, its network lines with their exact '
  'figures, bands and exact audience, the refused sectors, the history of the metrics (an agent '
  'author shown as INFLUX) and verification (0226: the creator requests and the network badges with '
  'their observed figures and period; 0235: disputes, identifier_changes), portfolio (0245: each '
  'visual, its state, place, replacement, size, sides, caption, dates and refusal reason, with its '
  'statements of RG83; never the bytes, the key nor the checksum), review_entries (0245: kind, '
  'state, dates, reason, message to the creator), field_revisions (0245: field, value, status, '
  'dates; never the row key) and campaign_reads (0314: kind, campaign asked, sort, page, outcome, '
  'instant of each read of the feed or of a campaign record; never the id of a line); every '
  'request carries '
  'opened_by and opening_reason, every badge revocation_message (0235); never public_ref nor the id '
  'of a line or a history row, never an evidence, a code, an observed or previous handle, an agent, '
  'a decider, a lock, an internal or opening comment nor a declared value at a decision; NULL '
  'without a storefront; activity_log serves the codes whose export_class is exported only '
  '(0302, F3), the lines of the account, about the account and, since 0310 (L3BS-5), about its '
  'campaigns, an internal or system actor shown as INFLUX. p_addresses: privacy.account_addresses(). SECURITY INVOKER owned by '
  'influx_privacy_definer, NO grant.';

-- 9.2.2 The execution (0150 ... 0306, 0310): the erasure deletes the reads of the open campaigns -------
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
  -- logo (0204), its examinations (0207), the creator profile of L2D (0219), the verification of
  -- L2E (0226), of L2F (0235), the portfolio and queue 2 of L2G (0245), the campaigns of L3B (0306)
  -- and their entries, snapshots and interventions of L3C (0310), the reads of the open campaigns of
  -- L3D (0314), in ONE transaction.
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

  -- 3 quater. the creator profile (0216 to 0218; modele.md §0219; Q18): the storefront kept (its
  -- keys, its alias, its country), suspended, out of every search, every other column emptied in
  -- ONE statement (the policy checks them together; EC-L2D-06-2); its lists, its derived rows, its
  -- exact audience, its refused sectors and the history of its metrics deleted; its identity
  -- emptied, the row kept (04 §9.2, EC-L2D-06-3); its network lines kept for L2E, their handle,
  -- pseudonym, URL, figures and date emptied (EC-L2D-06-4). Nothing is derived again: every trigger
  -- of 0218 and the history guard of 0217 skip influx_privacy_definer.
  update profiles.creator_public_profiles
     set status                         = 'suspended',
         is_searchable                  = false,
         published_at                   = null,
         headline                       = null,
         bio                            = null,
         primary_topic_code             = null,
         residence_region_code          = null,
         travel_scope                   = null,
         collaboration_experience_band  = null,
         main_audience_country          = null,
         main_audience_share_band       = null,
         audience_gender_band           = null,
         delivery_lead_band             = null,
         max_exclusivity_band           = null,
         accepts_non_monetary           = false,
         availability_band              = null,
         availability_declared_at       = null
   where account_id = v_account.id;
  delete from profiles.creator_topics where account_id = v_account.id;
  delete from profiles.creator_publication_languages where account_id = v_account.id;
  delete from profiles.creator_tones where account_id = v_account.id;
  delete from profiles.creator_formats where account_id = v_account.id;
  delete from profiles.creator_usage_rights where account_id = v_account.id;
  delete from profiles.creator_public_audience where account_id = v_account.id;
  delete from profiles.creator_public_networks where account_id = v_account.id;
  delete from profiles.creator_audience_countries where account_id = v_account.id;
  delete from profiles.creator_audience_ages where account_id = v_account.id;
  delete from profiles.creator_audience_genders where account_id = v_account.id;
  delete from profiles.creator_refused_sectors where account_id = v_account.id;
  delete from profiles.creator_network_metrics_history where account_id = v_account.id;
  update profiles.creator_identities
     set legal_first_name      = null,
         legal_last_name       = null,
         contact_email         = null,
         contact_phone         = null,
         address_line          = null,
         postal_code           = null,
         city                  = null,
         country_code          = null,
         completeness_percent  = 0
   where account_id = v_account.id;
  update profiles.creator_social_accounts
     set handle                 = null,
         pseudonym              = null,
         profile_url            = null,
         followers_count        = null,
         posts_last_30_days     = null,
         avg_comments_per_post  = null,
         avg_reach_per_post     = null,
         engagement_rate_bp     = null,
         figures_measured_at    = null
   where account_id = v_account.id;

  -- 3 quinquies. the verification (0221 to 0225; 08 §8 « Le compte est supprimé »; 04 §9.1): the
  -- decisions and the badges kept 3 years, pseudonymous (08 Q2), everything that names the person
  -- removed. The open requests withdrawn (cancelled: the trigger of 0223 puts their evidence to
  -- purging) and, for every request, the message, the internal comment and the lock emptied in ONE
  -- statement (the policy checks them together; EC-L2E-10-6); the codes deleted with the agent's
  -- finding (handle, platform reference, domain); the holding badges revoked account_closed and
  -- every badge without its handle ('[deleted]', EC-L2E-10-3) nor its platform reference
  -- (EC-L2E-10-4); every remaining evidence to purging, removed from Storage by the task
  -- storage_purge, its row and checksum kept (08 RG86); the internal block of a brand deleted
  -- (EC-L2E-10-5). The history rows agent_observed of 0225 went with the history above.
  update verification.verification_requests
     set status                = case when status in ('draft', 'pending')
                                      then 'cancelled'::verification.request_status
                                      else status end,
         cancelled_at          = case when status in ('draft', 'pending') then pg_catalog.now()
                                      else cancelled_at end,
         closed_at             = coalesce(closed_at, pg_catalog.now()),
         member_message        = null,
         internal_comment      = null,
         opening_comment       = null,
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null
   where account_id = v_account.id;
  delete from verification.ownership_codes where account_id = v_account.id;
  update verification.badges
     set state                         = case when state in ('active', 'to_refresh', 'to_reconfirm')
                                              then 'revoked'::verification.badge_state
                                              else state end,
         revoked_at                    = case when state in ('active', 'to_refresh', 'to_reconfirm')
                                              then pg_catalog.now() else revoked_at end,
         revocation_reason_code        = case when state in ('active', 'to_refresh', 'to_reconfirm')
                                              then 'account_closed' else revocation_reason_code end,
         observed_handle_at_decision   = case when level = 'brand_verified' then null
                                              else '[deleted]' end,
         observed_platform_account_ref = null
   where account_id = v_account.id;
  update verification.evidence_files
     set state              = 'purging',
         purge_requested_at = pg_catalog.now()
   where account_id = v_account.id and state in ('pending', 'active');
  delete from profiles.advertiser_internal_details where account_id = v_account.id;

  -- 3 sexies. the data of L2F (0231 to 0234; l2f-fiche invariant 14; 04 §9.1): the withdrawal
  -- requests, the contests and the entries of queue 6 kept 3 years with the decisions, pseudonymous;
  -- every text emptied (texts_erased_at written), an open contest or entry withdrawn account_erased
  -- and its lock cleared, in ONE statement each (the policies check them together); no register line
  -- (EC-L2F-10-4). The opening comment of a request went with its other texts above.
  update verification.badge_revocation_requests
     set member_message  = null,
         texts_erased_at = coalesce(texts_erased_at, pg_catalog.now())
   where account_id = v_account.id;
  update verification.disputes
     set state                 = case when state = 'open'
                                      then 'withdrawn'::verification.dispute_state else state end,
         withdrawn_cause       = case when state = 'open' then 'account_erased'
                                      else withdrawn_cause end,
         closed_at             = coalesce(closed_at, pg_catalog.now()),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null,
         text                  = null,
         member_message        = null,
         internal_comment      = null,
         texts_erased_at       = coalesce(texts_erased_at, pg_catalog.now())
   where account_id = v_account.id;
  update verification.identifier_change_reviews
     set state                 = case when state = 'open'
                                      then 'withdrawn'::verification.identifier_review_state
                                      else state end,
         withdrawn_cause       = case when state = 'open' then 'account_erased'
                                      else withdrawn_cause end,
         closed_at             = coalesce(closed_at, pg_catalog.now()),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null,
         previous_handle       = null,
         new_handle            = null,
         observed_handle       = null,
         internal_comment      = null,
         texts_erased_at       = coalesce(texts_erased_at, pg_catalog.now())
   where account_id = v_account.id;

  -- 3 septies. the data of L2G (0242 to 0244; l2g/modele -14; fiche invariant 15): every visual to
  -- purging at once (the erasure prevails over the 30 days of retention), removed from Storage by the
  -- task storage_purge, its row and its decision kept, pseudonymous; its caption, its internal comment
  -- and the link to its statement emptied in ONE statement (the policy checks them together); the
  -- statements of RG83 and the creator revisions deleted; the entries of queue 2 kept, pseudonymous
  -- (the trace of a human decision, as 0207), their texts emptied, an open one withdrawn now. The
  -- triggers of 0242 and 0243 that act for a member or a former creator skip influx_privacy_definer;
  -- the daily Storage usage went with 3 bis.
  update profiles.portfolio_items
     set state                = case when state in ('purging', 'purged') then state
                                     else 'purging'::profiles.portfolio_item_state end,
         caption              = null,
         internal_comment     = null,
         brand_declaration_id = null
   where account_id = v_account.id;
  delete from profiles.portfolio_brand_declarations where account_id = v_account.id;
  delete from profiles.creator_field_revisions where account_id = v_account.id;
  update profiles.creator_review_entries
     set state            = case when state = 'open' then 'withdrawn'::profiles.review_entry_state
                                 else state end,
         closed_at        = coalesce(closed_at, pg_catalog.now()),
         member_message   = null,
         internal_comment = null
   where account_id = v_account.id;

  -- 3 octies. the campaigns of L3B (0303 to 0305; l3b/modele.md §7; 09 l. 993; fiche invariant
  -- 10): nothing deleted (the connections of Lot 4 will point at them); every campaign closed and
  -- marked erased, its free texts, its internal reference and its total budget emptied in ONE
  -- statement (the policy checks them together); its key messages (free texts) deleted; its codes,
  -- dates, budget band and declaration of RG85 kept, pseudonymous. The freeze of 0303 does not act
  -- for influx_privacy_definer; no register line (03 P8). 0310 (l3c/modele.md §9; EC-L3C-05-3, -4):
  -- the entries of queue 7 kept, pseudonymous (the trace of a human decision, as 0207), an open one
  -- withdrawn and its lock cleared, their message, comment and opinion emptied (texts_erased_at);
  -- the free texts of every snapshot emptied, its codes, version, instant and hash kept; the values
  -- and the comment of every intervention emptied, its kind, field, reason and author kept. The
  -- guards of 0308 and 0309 let influx_privacy_definer alone through. Entries first: a withdrawn
  -- entry no longer waits on the campaign it closes.
  update campaigns.campaign_review_entries
     set state                 = case when state = 'open'
                                      then 'withdrawn'::campaigns.review_entry_state else state end,
         closed_at             = coalesce(closed_at, pg_catalog.now()),
         claimed_by_account_id = null,
         claimed_at            = null,
         claim_expires_at      = null,
         member_message        = null,
         internal_comment      = null,
         first_review_opinion  = null,
         texts_erased_at       = coalesce(texts_erased_at, pg_catalog.now())
   where advertiser_account_id = v_account.id;
  update campaigns.campaign_published_snapshots s
     set payload = s.payload || pg_catalog.jsonb_build_object(
                                  'title', null, 'publicSummary', null, 'brief', null,
                                  'productDescription', null, 'restrictions', null,
                                  'keyMessages', '[]'::jsonb)
   where s.campaign_id in (select c.id from campaigns.campaigns c
                            where c.advertiser_account_id = v_account.id);
  update campaigns.agent_interventions
     set old_value        = null,
         new_value        = null,
         internal_comment = null
   where advertiser_account_id = v_account.id;
  delete from campaigns.campaign_key_messages m
   where m.campaign_id in (select c.id from campaigns.campaigns c
                            where c.advertiser_account_id = v_account.id);
  update campaigns.campaigns
     set status              = 'closed'::campaigns.campaign_status,
         erased_at           = pg_catalog.now(),
         title               = null,
         public_summary      = null,
         brief               = null,
         internal_reference  = null,
         product_description = null,
         restrictions        = null,
         total_budget_minor  = null
   where advertiser_account_id = v_account.id;

  -- 3 nonies. the reads of the open campaigns of L3D (0314; l3d/modele.md §6; 04 §9): every line of
  -- the account deleted, none kept pseudonymous; the account is deleted above, the only state the
  -- policy and the guard of the journal let the owner of the erasure delete in
  delete from search.creator_campaign_reads where creator_account_id = v_account.id;

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
  '(privacy.export_document), serialised once (jsonb_pretty), stored with its SHA-256, size and 15 '
  'categories, 7 days; privacy.export_ready to brevo_transactional (P1, ids, idempotency '
  'privacy.export_ready:<request>); privacy.export_published {sha256 hex, size_bytes, categories}; '
  'returns (access, NULL). ERASURE (admin 2V or member fresh code alike): p_notice NULL (22023 '
  'otherwise); the address held in propagation_email; account deleted, anonymised, '
  'deleted+<id>@invalid, display name NULL; its sessions DELETED (EC-J8-37); legal name [deleted] '
  'and the other brand profile columns NULL, its list rows deleted, its contact details NULL (0202); '
  'its logo objects to purging and its daily Storage usage deleted (0204); its field revisions '
  'deleted, the texts of its review entries emptied and an open entry withdrawn (0207); its '
  'creator storefront kept (keys, alias, country), suspended, not searchable, the rest emptied, its '
  'lists, derived rows, exact audience, refused sectors and metrics history deleted, its identity '
  'emptied, its network lines kept with handle, pseudonym, URL, figures and date emptied, nothing '
  'derived again (0219); its verification requests kept, open ones cancelled (their evidence to '
  'purging by the trigger of 0223), message, internal comment and lock emptied, its ownership codes '
  'deleted, its holding badges revoked account_closed and every badge without handle (''[deleted]'') '
  'nor platform reference, its remaining evidence to purging, its internal block deleted (0226); '
  'the opening comment of its requests, the message of its withdrawal requests, the texts of its '
  'contests and entries of queue 6 emptied (texts_erased_at), an open contest or entry withdrawn '
  'account_erased and its lock cleared, no register line (0235); its visuals to purging at once, '
  'their caption, internal comment and statement link emptied, its statements of RG83 and its '
  'creator revisions deleted, the texts of its entries of queue 2 emptied and an open one withdrawn '
  '(0245); its campaigns kept, closed, erased_at written, their free texts, internal reference and '
  'total budget emptied, their key messages deleted, codes, dates, band and declaration kept, no '
  'register line (0306); its entries of queue 7 kept, an open one withdrawn, their lock cleared, '
  'their message, comment and opinion emptied (texts_erased_at), the free texts of its snapshots '
  'emptied (null, keyMessages []), hash kept, the values and comment of its interventions emptied '
  '(0310); its reads of the open campaigns deleted (0314); addresses replaced by the marker in '
  'email_change_requests (open ones cancelled account_deleted), '
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

-- 10. End-state assertions -------------------------------------------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  c_owner   constant text := 'influx_campaign_feed_definer';
  v_def     record;
  v_bad     text;
begin
  -- 03 P7: NOLOGIN NOINHERIT, no member, member of nothing, no attribute (C-9: the ADMIN OPTION the
  -- creating role keeps, without INHERIT nor SET, is tolerated)
  if not exists (select 1 from pg_catalog.pg_roles
                  where rolname = c_owner and not rolcanlogin and not rolinherit and not rolsuper
                    and not rolbypassrls and not rolcreatedb and not rolcreaterole
                    and not rolreplication)
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.member = c_owner::regrole
                    or (m.roleid = c_owner::regrole and (m.inherit_option or m.set_option))) then
    raise exception 'influx_campaign_feed_definer must be NOLOGIN NOINHERIT, without member nor membership';
  end if;

  -- the seven functions: their owner, their mode, empty search_path, EXECUTE for their callers only
  -- (the helpers: nobody)
  for v_def in
    select * from (values
      ('search.require_campaign_reader()', false, ''),
      ('search.campaign_read_retry_after(uuid)', false, ''),
      ('search.visible_campaigns(uuid)', false, ''),
      ('search.brand_public_row(uuid)', false, ''),
      ('search.read_open_campaigns(text, integer)', true, 'influx_creator'),
      ('search.read_open_campaign(uuid)', true, 'influx_creator'),
      ('search.read_open_campaign_brand_logo(uuid)', true, 'influx_creator')
    ) as d (fn, definer, callers)
  loop
    if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
         where oid = v_def.fn::regprocedure) <> c_owner
       or (select prosecdef from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from v_def.definer
       or (select proconfig from pg_catalog.pg_proc where oid = v_def.fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be owned by %, SECURITY %, empty search_path',
        v_def.fn, c_owner, case when v_def.definer then 'DEFINER' else 'INVOKER' end;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_def.fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner
       and (a.grantee = 0 or a.grantee::regrole::text is distinct from nullif(v_def.callers, ''));
    if v_bad is not null then
      raise exception '% executable by: %', v_def.fn, v_bad;
    end if;
  end loop;

  -- the guard of the journal: SECURITY INVOKER, empty search_path, executed by nobody
  if exists (select 1 from pg_catalog.pg_proc p
              where p.oid = 'search.guard_creator_campaign_read_write()'::regprocedure
                and (p.prosecdef or p.proconfig is distinct from array['search_path=""']
                     or exists (select 1
                                  from pg_catalog.aclexplode(coalesce(p.proacl,
                                         pg_catalog.acldefault('f', p.proowner))) a
                                 where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner)))
     or not exists (select 1 from pg_catalog.pg_trigger
                     where tgrelid = 'search.creator_campaign_reads'::regclass
                       and tgname = 'creator_campaign_reads_immutable' and not tgisinternal) then
    raise exception 'the guard of search.creator_campaign_reads is missing or has a wrong mode';
  end if;

  -- L2DS-5 extended (fiche invariant 4): no dynamic SQL in a function of the owner of the doors
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner = c_owner::regrole
     and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic SQL in a function of influx_campaign_feed_definer: %', v_bad;
  end if;

  -- TM5.6, L3C-T3 (fiche invariant 4): the creator holds nothing on the schema campaigns, nothing on
  -- profiles.advertiser_*, nothing on a table of search; USAGE on search and the three doors only
  if pg_catalog.has_schema_privilege('influx_creator', 'campaigns', 'USAGE')
     or not pg_catalog.has_schema_privilege('influx_creator', 'search', 'USAGE') then
    raise exception 'influx_creator: USAGE on campaigns, or none on search (TM5.6)';
  end if;
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where c.relkind in ('r', 'p', 'v', 'm', 'S')
     and (n.nspname in ('campaigns', 'search')
          or (n.nspname = 'profiles' and c.relname like 'advertiser\_%'))
     and (pg_catalog.has_table_privilege('influx_creator', c.oid,
                                         'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
          or (c.relkind <> 'S'
              and pg_catalog.has_any_column_privilege('influx_creator', c.oid,
                                                      'SELECT, INSERT, UPDATE, REFERENCES')));
  if v_bad is not null then
    raise exception 'influx_creator holds a right on campaigns, search or profiles.advertiser_*: %',
      v_bad;
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('campaigns', 'search')
     and pg_catalog.has_function_privilege('influx_creator', p.oid, 'EXECUTE')
     and p.oid not in ('search.read_open_campaigns(text, integer)'::regprocedure,
                       'search.read_open_campaign(uuid)'::regprocedure,
                       'search.read_open_campaign_brand_logo(uuid)'::regprocedure);
  if v_bad is not null then
    raise exception 'influx_creator executes a function of campaigns or search beyond its doors: %',
      v_bad;
  end if;

  -- D46, D78 held by the rights (fiche invariants 1, 2): the owner never reads the contact block, the
  -- internal block, a column of a campaign beyond its eight, nor a column of a snapshot beyond three
  if pg_catalog.has_table_privilege(c_owner, 'profiles.advertiser_contact_details',
                                    'SELECT, INSERT, UPDATE, DELETE')
     or pg_catalog.has_any_column_privilege(c_owner, 'profiles.advertiser_contact_details',
                                            'SELECT, INSERT, UPDATE')
     or pg_catalog.has_table_privilege(c_owner, 'profiles.advertiser_internal_details',
                                       'SELECT, INSERT, UPDATE, DELETE')
     or pg_catalog.has_any_column_privilege(c_owner, 'profiles.advertiser_internal_details',
                                            'SELECT, INSERT, UPDATE') then
    raise exception 'influx_campaign_feed_definer reaches the contact or the internal block of a brand';
  end if;
  select string_agg(at.attrelid::regclass::text || '.' || at.attname, ', ') into v_bad
    from pg_catalog.pg_attribute at
   where at.attrelid in ('campaigns.campaigns'::regclass,
                         'campaigns.campaign_published_snapshots'::regclass)
     and at.attnum > 0 and not at.attisdropped
     and pg_catalog.has_column_privilege(c_owner, at.attrelid, at.attnum, 'SELECT')
     and not (at.attrelid = 'campaigns.campaigns'::regclass
              and at.attname in ('id', 'advertiser_account_id', 'status', 'current_snapshot_id',
                                 'first_published_at', 'applications_close_on', 'ends_on',
                                 'sector_code'))
     and not (at.attrelid = 'campaigns.campaign_published_snapshots'::regclass
              and at.attname in ('id', 'campaign_id', 'payload'));
  if v_bad is not null then
    raise exception 'influx_campaign_feed_definer reads a column of a campaign it must not: %', v_bad;
  end if;
  -- its one write: the insertion of its journal lines
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname in ('influx', 'reference', 'identity', 'audit', 'billing', 'backoffice', 'leads',
                       'profiles', 'verification', 'campaigns', 'search', 'matching', 'messaging',
                       'ops', 'privacy')
     and c.relkind in ('r', 'p')
     and (pg_catalog.has_table_privilege(c_owner, c.oid, 'UPDATE, DELETE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'UPDATE')
          or (c.oid <> 'search.creator_campaign_reads'::regclass
              and (pg_catalog.has_table_privilege(c_owner, c.oid, 'INSERT')
                   or pg_catalog.has_any_column_privilege(c_owner, c.oid, 'INSERT'))));
  if v_bad is not null then
    raise exception 'influx_campaign_feed_definer writes beyond its journal lines: %', v_bad;
  end if;

  -- the journal: RLS enabled and forced; inserted by the owner of the doors, deleted by the owner
  -- of the erasure, read by these two, updated by nobody; nothing to the Data API roles
  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'search.creator_campaign_reads'::regclass) then
    raise exception 'search.creator_campaign_reads: RLS not enabled and forced';
  end if;
  select string_agg(ro.rolname, ', ') into v_bad
    from pg_catalog.pg_roles ro
   where (ro.rolname like 'influx\_%' or ro.rolname in ('anon', 'authenticated', 'service_role'))
     and (pg_catalog.has_table_privilege(ro.oid, 'search.creator_campaign_reads', 'UPDATE, TRUNCATE')
          or pg_catalog.has_any_column_privilege(ro.oid, 'search.creator_campaign_reads', 'UPDATE')
          or (ro.rolname <> c_owner
              and (pg_catalog.has_table_privilege(ro.oid, 'search.creator_campaign_reads', 'INSERT')
                   or pg_catalog.has_any_column_privilege(ro.oid, 'search.creator_campaign_reads',
                                                          'INSERT')))
          or (ro.rolname <> 'influx_privacy_definer'
              and pg_catalog.has_table_privilege(ro.oid, 'search.creator_campaign_reads', 'DELETE'))
          or (ro.rolname not in (c_owner, 'influx_privacy_definer')
              and pg_catalog.has_any_column_privilege(ro.oid, 'search.creator_campaign_reads',
                                                      'SELECT')));
  if v_bad is not null then
    raise exception 'search.creator_campaign_reads reached beyond its two owners: %', v_bad;
  end if;

  -- E-5: export_document() invoker, execute_request() definer, both of influx_privacy_definer
  if (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
       where oid = 'privacy.export_document(uuid, text[], jsonb)'::regprocedure)
       <> 'influx_privacy_definer'
     or (select prosecdef from pg_catalog.pg_proc
          where oid = 'privacy.export_document(uuid, text[], jsonb)'::regprocedure)
     or (select pg_catalog.pg_get_userbyid(proowner) from pg_catalog.pg_proc
          where oid = 'privacy.execute_request(uuid, jsonb)'::regprocedure)
          <> 'influx_privacy_definer'
     or not (select prosecdef from pg_catalog.pg_proc
              where oid = 'privacy.execute_request(uuid, jsonb)'::regprocedure) then
    raise exception 'E-5 recreated with a wrong owner or mode';
  end if;

  -- the settings, the index
  if (select count(*) from backoffice.operational_settings
       where key in ('campaign_feed_page_size', 'campaign_feed_max_pages',
                     'campaign_feed_closed_days', 'creator_campaign_reads_per_minute',
                     'creator_campaign_reads_per_day')) <> 5 then
    raise exception 'the five settings of 0314 are not loaded';
  end if;
  if not exists (select 1 from pg_catalog.pg_indexes
                  where schemaname = 'campaigns' and indexname = 'campaigns_feed_idx') then
    raise exception 'campaigns.campaigns_feed_idx is missing';
  end if;

  -- the owners left without a usable member nor CREATE
  if exists (select 1 from pg_catalog.pg_auth_members m
              where m.roleid in (c_owner::regrole, 'influx_privacy_definer'::regrole)
                and (m.inherit_option or m.set_option))
     or pg_catalog.has_schema_privilege(c_owner, 'search', 'CREATE')
     or pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE') then
    raise exception 'an owner of 0314 left with a member or CREATE';
  end if;
end
$$;
