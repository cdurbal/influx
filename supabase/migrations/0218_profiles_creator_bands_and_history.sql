-- =============================================================================
-- 0218_profiles_creator_bands_and_history
-- -----------------------------------------------------------------------------
-- Lot 2 / L2D, commit 05 (jalons/l2d/05.md; l2d/modele.md §0218, which prevails for every name;
-- fiche invariants 4 to 7, EC-L2D-6, EC-L2D-9). The bands of the storefront are DERIVED here from
-- the exact figures of 0217, by comparison with the bounds of the reference lists (0201), never by
-- a computation on a rate; the creator never writes them (07 RG22, RG45, RG114 to RG117).
--
-- 1. Three bound functions, IMMUTABLE and SECURITY INVOKER (EC-02-7, 07 RG58):
--    profiles.audience_share_band() (10_25, 25_50, gt_50; under 10 not served),
--    profiles.main_audience_share_band() (ge_80, 50_80, lt_50), profiles.audience_gender_band()
--    (female_majority or male_majority at 60 or more, otherwise mixed).
-- 2. profiles.creator_public_networks (A): one row per network line, its key the line [K] (modele.md
--    point 1: RG42 allows two accounts on one network), its bands, its source and its date; the
--    engagement band stays null at L2D (RG48, a check dropped at L2E with the audience badge).
--    profiles.creator_public_audience (A): the other countries and the age bands of the PRIMARY
--    line only (EC-L2D-9), as share bands, a share under 10 absent (RG58).
-- 3. The rights of influx_identity_definer, owner of the derivations (modele.md « Droits », 03 P7):
--    reads of the bounds, of the line and of its exact audience (never handle, pseudonym, URL nor
--    engagement), writes of the derived rows, of the derived and residence columns of the
--    storefront, of the metrics, source and date of a line (the door), INSERT of the history.
-- 4. Two invoker guards: profiles.guard_creator_public_profile_write() (BEFORE on the storefront:
--    the date of the declared availability is set, never entered; the owner of the derivations,
--    on a row that is not the session's own, moves the residence only, 42501 otherwise) and
--    profiles.check_creator_audience_sum() (a DEFERRED constraint trigger per dimension: the
--    shares of one line never exceed 100, a remainder is never filled, 07 RG57; 23514).
-- 5. The derivations, SECURITY DEFINER owned by influx_identity_definer, no EXECUTE for anyone:
--    profiles.refresh_creator_public_network(uuid), profiles.refresh_creator_public_audience(uuid),
--    and the trigger functions derive_creator_public_network(), derive_creator_public_audience(),
--    record_creator_metrics_history() (07 RG119: each entry and each confirmation of the three
--    metrics, its source and author, append-only) and copy_creator_residence_country() (07 RG36:
--    the country of the account, whatever writes it, identity.update_own_account() of 0209 and
--    identity.correct_member_account() of 0132 included; the region set back to null).
-- 6. The door « Confirmer mes chiffres », profiles.confirm_own_creator_figures() (RG50, RG116,
--    EC-L2D-6): the three metrics in one operation (a null one is not declared), source declared,
--    date now(); the only writer of the date. A figure written by the autosave stays declared and
--    leaves the date where it was (history `confirmed = false`).
-- 7. Every trigger of this migration carries `when (current_user <> 'influx_privacy_definer')`:
--    the erasure of 0219 writes what it must itself, nothing is derived from it.
-- 8. Reprise: the residence country of every storefront, then the derived rows of every line
--    already written (none on staging: no route writes a line before 08). No history reprise.
--
-- Not here: the export and the erasure (0219), the DELETE and the policies of
-- influx_privacy_definer on the creator tables (0219), any route (08, 09), the engagement band
-- and the agent's figures (L2E), the publication (L2G).
--
-- EC-L2D-05 (micro-gaps, the safest choice):
--   EC-L2D-05-1  « propre » for a derivation is the account of the line that fires it, held by the
--                composite foreign key (social_account_id, account_id), not the session's account:
--                a derivation also fires on writes without a member session (fixtures, reprise,
--                the agent of L2E). The definer's policies name a creator account; the door alone
--                is bound to the session.
--   EC-L2D-05-2  the main country of RG58 gets its own bound function, main_audience_share_band(),
--                beside the two of modele.md: its bands (ge_80, 50_80, lt_50) are not those of the
--                other countries.
--   EC-L2D-05-3  bounds of the share bands: [10, 25) 10_25, [25, 50] 25_50, above 50 gt_50; main
--                country: 80 and more ge_80, [50, 80) 50_80, under 50 lt_50 (a lower bound always
--                included, « > 50 » of RG58 read literally).
--   EC-L2D-05-4  creator_public_audience holds the OTHER countries (slots 1 to 4) and the age
--                bands: the main country lives on the storefront with its own band (RG58).
--   EC-L2D-05-5  modele.md gives the definer S, I, U, D on the public rows: creator_public_networks
--                gets S, I, U (its rows go with their line, on delete cascade),
--                creator_public_audience S, I, D (a breakdown is replaced, never updated).
--   EC-L2D-05-6  the date of the availability moves when the band changes (the same band written
--                again keeps it) and is cleared with the band.
--   EC-L2D-05-7  the author of a history row is the session's account, or the creator himself when
--                no session is posed (fixtures, operator SQL): recorded_by_account_id is NOT NULL.
--   EC-L2D-05-8  a line inserted without any figure writes no history row; one written with a
--                figure, or a change of a metric or of the source, writes one (confirmed false);
--                a new date writes one (confirmed true).
--   EC-L2D-05-9  the guard of the definer compares the whole row but the two residence columns:
--                any other change on another account's row is refused, not only the three derived
--                columns its grants allow.
--
-- ROLLBACK (before any creator has entered anything): drop the triggers of §6 (identity.accounts
-- accounts_copy_creator_residence_country; profiles.creator_public_profiles
-- creator_public_profiles_guard_write; profiles.creator_social_accounts
-- creator_social_accounts_derive_public_network, creator_social_accounts_record_metrics_history;
-- on the three audience tables *_derive_public and *_share_sum); drop the functions of §1, §4, §5
-- and the door; drop table profiles.creator_public_audience, profiles.creator_public_networks;
-- revoke the grants and drop the policies of §3. The REVOKE of influx_advertiser stays.
-- =============================================================================

-- 1. The bound functions of the shares (EC-02-7, 07 RG58) ----------------------------------------------

create or replace function profiles.audience_share_band(p_share_percent integer)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
           when p_share_percent is null or p_share_percent < 10 then null
           when p_share_percent < 25 then '10_25'
           when p_share_percent <= 50 then '25_50'
           else 'gt_50'
         end
$$;

comment on function profiles.audience_share_band(integer) is
  '07 RG58 (EC-L2D-05-3): band of the share of another country or of an age band, 10_25 [10, 25), '
  '25_50 [25, 50], gt_50 above 50; under 10, or none, null (never served). Compares, never '
  'computes. IMMUTABLE, SECURITY INVOKER; EXECUTE for influx_identity_definer only.';

create or replace function profiles.main_audience_share_band(p_share_percent integer)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
           when p_share_percent is null then null
           when p_share_percent >= 80 then 'ge_80'
           when p_share_percent >= 50 then '50_80'
           else 'lt_50'
         end
$$;

comment on function profiles.main_audience_share_band(integer) is
  '07 RG58 (EC-L2D-05-2, 3): band of the share of the main audience country, ge_80 from 80, 50_80 '
  '[50, 80), lt_50 under 50; null without a share (EC-L2D-04-4). IMMUTABLE, SECURITY INVOKER; '
  'EXECUTE for influx_identity_definer only.';

create or replace function profiles.audience_gender_band(p_female_percent integer, p_male_percent integer)
returns text
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
           when p_female_percent is null and p_male_percent is null then null
           when coalesce(p_female_percent, 0) >= 60 then 'female_majority'
           when coalesce(p_male_percent, 0) >= 60 then 'male_majority'
           else 'mixed'
         end
$$;

comment on function profiles.audience_gender_band(integer, integer) is
  '07 RG58, RG61 (modele.md point 8): gender band of the AUDIENCE, female_majority or '
  'male_majority at 60 or more, mixed otherwise; null when no gender is declared. IMMUTABLE, '
  'SECURITY INVOKER; EXECUTE for influx_identity_definer only.';

revoke all on function profiles.audience_share_band(integer)
  from public, anon, authenticated, service_role;
revoke all on function profiles.main_audience_share_band(integer)
  from public, anon, authenticated, service_role;
revoke all on function profiles.audience_gender_band(integer, integer)
  from public, anon, authenticated, service_role;
grant execute on function profiles.audience_share_band(integer) to influx_identity_definer;
grant execute on function profiles.main_audience_share_band(integer) to influx_identity_definer;
grant execute on function profiles.audience_gender_band(integer, integer) to influx_identity_definer;

-- 2. The derived storefront rows (A) -------------------------------------------------------------------

create table if not exists profiles.creator_public_networks (
  social_account_id           uuid        not null primary key,
  account_id                  uuid        not null references profiles.creator_public_profiles (account_id),
  network_code                text        not null references reference.networks (code),
  is_primary                  boolean     not null default false,
  audience_band               text        references reference.audience_bands (code),
  reach_band                  text        references reference.audience_bands (code),
  publication_frequency_code  text        references reference.publication_frequencies (code),
  comment_band                text        references reference.comment_bands (code),
  engagement_band             text        references reference.engagement_bands (code),
  figures_source              text        not null default 'declared',
  figures_measured_at         timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  -- the row of a line belongs to the account of that line, and goes with it
  constraint creator_public_networks_line_fk
    foreign key (social_account_id, account_id)
    references profiles.creator_social_accounts (id, account_id) on delete cascade,
  constraint creator_public_networks_figures_source
    check (figures_source in ('declared', 'agent_observed')),
  -- RG48: no engagement band before the audience badge (L2E drops this check, never earlier)
  constraint creator_public_networks_engagement_unverified check (engagement_band is null)
);

-- EC-L2D-03-1 (04 §12): the reconstruction of a result card
create index if not exists creator_public_networks_account
  on profiles.creator_public_networks (account_id);

-- 04 §5.2: one primary line at most, as on creator_social_accounts
create unique index if not exists creator_public_networks_one_primary
  on profiles.creator_public_networks (account_id)
  where is_primary;

comment on table profiles.creator_public_networks is
  'Bands of each network line of a creator (04 §5.2, 07 RG16 layer A): derived from the exact '
  'figures of creator_social_accounts by profiles.refresh_creator_public_network(), never written '
  'by a member. Codes, bands, a boolean and a date only. No right of influx_advertiser at Lot 2 '
  '(EC-L2D-1, P5).';
comment on column profiles.creator_public_networks.social_account_id is
  'The line [K] (modele.md point 1): never served outside the own reads of the creator.';
comment on column profiles.creator_public_networks.account_id is
  'The account [K]: never served outside the own reads of the creator and the internal ones.';
comment on column profiles.creator_public_networks.reach_band is
  'Band of the average reach PER PUBLICATION (07 RG47), the bounds of reference.audience_bands.';
comment on column profiles.creator_public_networks.publication_frequency_code is
  'Rhythm derived from the publications of the last 30 days (07 RG114), never chosen; null while '
  'the number is not declared (Q15).';
comment on column profiles.creator_public_networks.comment_band is
  'Band of the average comments per publication (07 RG115), served even when declared (RG117).';
comment on column profiles.creator_public_networks.engagement_band is
  'Null at L2D (07 RG48): served only once observed by an agent (L2E).';

drop trigger if exists creator_public_networks_touch_updated_at on profiles.creator_public_networks;
create trigger creator_public_networks_touch_updated_at
  before update on profiles.creator_public_networks
  for each row execute function influx.touch_updated_at();

create table if not exists profiles.creator_public_audience (
  account_id  uuid        not null references profiles.creator_public_profiles (account_id),
  dimension   text        not null,
  bucket      text        not null,
  share_band  text        not null,
  created_at  timestamptz not null default now(),
  primary key (account_id, dimension, bucket),
  constraint creator_public_audience_dimension check (dimension in ('country', 'age')),
  -- a country code, or an age band code of reference.age_bands
  constraint creator_public_audience_bucket
    check ((dimension = 'country' and bucket ~ '^[A-Z]{2}$')
           or (dimension = 'age' and bucket ~ '^[a-z0-9]+(_[a-z0-9]+)*$')),
  constraint creator_public_audience_share_band check (share_band in ('10_25', '25_50', 'gt_50'))
);

comment on table profiles.creator_public_audience is
  'Audience of the PRIMARY line of a creator in share bands (07 RG58, EC-L2D-9, layer A): the other '
  'countries (EC-L2D-05-4) and the age bands, a share under 10 absent. Derived by '
  'profiles.refresh_creator_public_audience(); the main country and the gender band live on the '
  'storefront. No right of influx_advertiser at Lot 2 (EC-L2D-1, P5).';

-- 2.1 Row level security and the rights of the business roles -------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['creator_public_networks', 'creator_public_audience']
  loop
    execute format('alter table profiles.%I enable row level security', t);
    execute format('alter table profiles.%I force row level security', t);
    execute format('revoke all on profiles.%I from public, anon, authenticated, service_role', t);
    -- P5, EC-L2D-1: nothing for the advertiser role at Lot 2 (the storefront is read at Lot 3)
    execute format('revoke all on profiles.%I from influx_advertiser', t);
    execute format('grant select on profiles.%I to influx_creator, influx_agent, influx_admin', t);
    execute format('drop policy if exists %I on profiles.%I', t || '_member_select_own', t);
    execute format('create policy %I on profiles.%I for select to influx_creator '
                   'using (account_id = (select influx.current_account_id()))',
                   t || '_member_select_own', t);
    execute format('drop policy if exists %I on profiles.%I', t || '_internal_select', t);
    execute format('create policy %I on profiles.%I for select to influx_agent, influx_admin '
                   'using ((select influx.has_aal2()))',
                   t || '_internal_select', t);
    -- EC-L2D-05-1: the derivations write the rows of a creator account
    execute format('drop policy if exists %I on profiles.%I', t || '_identity_definer_all', t);
    execute format('create policy %I on profiles.%I for all to influx_identity_definer '
                   'using (exists (select 1 from identity.account_roles r '
                   '                where r.account_id = %I.account_id and r.role = ''creator'')) '
                   'with check (exists (select 1 from identity.account_roles r '
                   '                     where r.account_id = %I.account_id and r.role = ''creator''))',
                   t || '_identity_definer_all', t, t, t);
  end loop;
end
$$;

-- EC-L2D-05-5
grant select, insert, update on profiles.creator_public_networks to influx_identity_definer;
grant select, insert, delete on profiles.creator_public_audience to influx_identity_definer;

-- 3. What the derivations read and write elsewhere (modele.md « Droits ») ------------------------------

-- 3.1 the bounds of the bands (0201), every row: reference lists, no personal data (as 0149)
grant select (code, min_followers, max_followers, retired_at)
   on reference.audience_bands to influx_identity_definer;
grant select (code, min_posts_30d, max_posts_30d, retired_at)
   on reference.publication_frequencies to influx_identity_definer;
grant select (code, min_comments, max_comments, retired_at)
   on reference.comment_bands to influx_identity_definer;

do $$
declare
  t text;
begin
  foreach t in array array['audience_bands', 'publication_frequencies', 'comment_bands']
  loop
    execute format('drop policy if exists %I on reference.%I', t || '_read_identity_definer', t);
    execute format('create policy %I on reference.%I for select to influx_identity_definer '
                   'using (true)',
                   t || '_read_identity_definer', t);
  end loop;
end
$$;

-- 3.2 the network line: its figures, never its handle, pseudonym, URL nor engagement; the door
-- writes the three metrics, the source and the date of the caller's own line
grant select (id, account_id, network_code, is_primary, followers_count, posts_last_30_days,
              avg_comments_per_post, avg_reach_per_post, figures_source, figures_measured_at)
   on profiles.creator_social_accounts to influx_identity_definer;
grant update (followers_count, posts_last_30_days, avg_comments_per_post, figures_source,
              figures_measured_at)
   on profiles.creator_social_accounts to influx_identity_definer;

drop policy if exists creator_social_accounts_identity_definer_select on profiles.creator_social_accounts;
create policy creator_social_accounts_identity_definer_select on profiles.creator_social_accounts
  for select to influx_identity_definer
  using (exists (select 1 from identity.account_roles r
                  where r.account_id = creator_social_accounts.account_id and r.role = 'creator'));

drop policy if exists creator_social_accounts_identity_definer_update on profiles.creator_social_accounts;
create policy creator_social_accounts_identity_definer_update on profiles.creator_social_accounts
  for update to influx_identity_definer
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()));

-- 3.3 the exact audience of a line, read for its bands
grant select (social_account_id, account_id, slot, country_code, share_percent)
   on profiles.creator_audience_countries to influx_identity_definer;
grant select (social_account_id, account_id, age_band_code, share_percent)
   on profiles.creator_audience_ages to influx_identity_definer;
grant select (social_account_id, account_id, gender_code, share_percent)
   on profiles.creator_audience_genders to influx_identity_definer;

do $$
declare
  t text;
begin
  foreach t in array array['creator_audience_countries', 'creator_audience_ages',
                           'creator_audience_genders']
  loop
    execute format('drop policy if exists %I on profiles.%I', t || '_identity_definer_select', t);
    execute format('create policy %I on profiles.%I for select to influx_identity_definer '
                   'using (exists (select 1 from identity.account_roles r '
                   '                where r.account_id = %I.account_id and r.role = ''creator''))',
                   t || '_identity_definer_select', t, t);
  end loop;
end
$$;

-- 3.4 the storefront: the derived audience columns and the residence (the guard of §4 bounds the
-- rows that are not the session's own to the residence)
grant select (account_id) on profiles.creator_public_profiles to influx_identity_definer;
grant update (residence_country_code, residence_region_code, main_audience_country,
              main_audience_share_band, audience_gender_band)
   on profiles.creator_public_profiles to influx_identity_definer;

drop policy if exists creator_public_profiles_identity_definer_select on profiles.creator_public_profiles;
create policy creator_public_profiles_identity_definer_select on profiles.creator_public_profiles
  for select to influx_identity_definer
  using (exists (select 1 from identity.account_roles r
                  where r.account_id = creator_public_profiles.account_id and r.role = 'creator'));

drop policy if exists creator_public_profiles_identity_definer_update on profiles.creator_public_profiles;
create policy creator_public_profiles_identity_definer_update on profiles.creator_public_profiles
  for update to influx_identity_definer
  using (exists (select 1 from identity.account_roles r
                  where r.account_id = creator_public_profiles.account_id and r.role = 'creator'))
  with check (exists (select 1 from identity.account_roles r
                       where r.account_id = creator_public_profiles.account_id and r.role = 'creator'));

-- 3.5 the history (RG119): appended by the derivation, for a creator account
grant insert (account_id, social_account_id, network_code, followers_count, posts_last_30_days,
              avg_comments_per_post, figures_source, confirmed, recorded_by_account_id)
   on profiles.creator_network_metrics_history to influx_identity_definer;

drop policy if exists creator_network_metrics_history_identity_definer_insert
  on profiles.creator_network_metrics_history;
create policy creator_network_metrics_history_identity_definer_insert
  on profiles.creator_network_metrics_history
  for insert to influx_identity_definer
  with check (exists (select 1 from identity.account_roles r
                       where r.account_id = creator_network_metrics_history.account_id
                         and r.role = 'creator'));

-- 4. The guards (SECURITY INVOKER) ---------------------------------------------------------------------

create or replace function profiles.guard_creator_public_profile_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session  uuid;
  v_rest     profiles.creator_public_profiles%rowtype;
begin
  -- EC-L2D-05-6: the date of the declared availability is set here, never entered
  if tg_op = 'INSERT' then
    new.availability_declared_at :=
      case when new.availability_band is null then null else pg_catalog.now() end;
    return new;
  end if;
  if new.availability_band is distinct from old.availability_band then
    new.availability_declared_at :=
      case when new.availability_band is null then null else pg_catalog.now() end;
  else
    new.availability_declared_at := old.availability_declared_at;
  end if;

  -- modele.md « Droits », EC-L2D-05-9: the owner of the derivations moves the residence alone on a
  -- row that is not the session's own (identity.correct_member_account() of an agent)
  if current_user = 'influx_identity_definer' then
    v_session := influx.current_account_id();
    if v_session is not null and v_session <> new.account_id then
      v_rest := new;
      v_rest.residence_country_code := old.residence_country_code;
      v_rest.residence_region_code := old.residence_region_code;
      if v_rest is distinct from old then
        raise exception 'forbidden' using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  return new;
end
$$;

comment on function profiles.guard_creator_public_profile_write() is
  'BEFORE INSERT OR UPDATE on profiles.creator_public_profiles (0218): availability_declared_at '
  'follows availability_band (now() when the band changes, null with it), whatever the writer '
  'gave; influx_identity_definer, on a row that is not the account of the session, changes the '
  'two residence columns only (42501 otherwise). SECURITY INVOKER, empty search_path, NO grant.';

revoke all on function profiles.guard_creator_public_profile_write()
  from public, anon, authenticated, service_role;

drop trigger if exists creator_public_profiles_guard_write on profiles.creator_public_profiles;
create trigger creator_public_profiles_guard_write
  before insert or update on profiles.creator_public_profiles
  for each row when (current_user <> 'influx_privacy_definer')
  execute function profiles.guard_creator_public_profile_write();

create or replace function profiles.check_creator_audience_sum()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sum  bigint;
begin
  if tg_table_name = 'creator_audience_countries' then
    select pg_catalog.sum(c.share_percent) into v_sum
      from profiles.creator_audience_countries c
     where c.social_account_id = new.social_account_id;
  elsif tg_table_name = 'creator_audience_ages' then
    select pg_catalog.sum(a.share_percent) into v_sum
      from profiles.creator_audience_ages a
     where a.social_account_id = new.social_account_id;
  else
    select pg_catalog.sum(g.share_percent) into v_sum
      from profiles.creator_audience_genders g
     where g.social_account_id = new.social_account_id;
  end if;
  -- RG57: never more than 100; a sum under 100 is accepted and never completed
  if v_sum > 100 then
    raise exception 'the shares of one dimension of an audience exceed 100'
      using errcode = 'check_violation', constraint = tg_table_name || '_share_sum';
  end if;
  return null;
end
$$;

comment on function profiles.check_creator_audience_sum() is
  'DEFERRED constraint trigger on the three exact audience tables (07 RG57, 0218): the shares of '
  'one dimension of one line never exceed 100, checked at commit (a list is replaced by a delete '
  'and inserts); 23514, constraint <table>_share_sum. A remainder is never filled. SECURITY '
  'INVOKER (the writer reads his own line), empty search_path, NO grant.';

revoke all on function profiles.check_creator_audience_sum()
  from public, anon, authenticated, service_role;

do $$
declare
  t text;
begin
  foreach t in array array['creator_audience_countries', 'creator_audience_ages',
                           'creator_audience_genders']
  loop
    execute format('drop trigger if exists %I on profiles.%I', t || '_share_sum', t);
    execute format('create constraint trigger %I after insert or update on profiles.%I '
                   'deferrable initially deferred for each row '
                   'when (current_user <> ''influx_privacy_definer'') '
                   'execute function profiles.check_creator_audience_sum()',
                   t || '_share_sum', t);
  end loop;
end
$$;

-- 5. The derivations (SECURITY DEFINER, handed to influx_identity_definer in §7) -----------------------

create or replace function profiles.refresh_creator_public_network(p_social_account_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- RG22, RG45, RG114, RG115: each band is the active code whose bounds hold the exact value
  -- (bounds included, the last one open); no value, no band. RG48: no engagement band at L2D.
  insert into profiles.creator_public_networks
    (social_account_id, account_id, network_code, is_primary, audience_band, reach_band,
     publication_frequency_code, comment_band, engagement_band, figures_source,
     figures_measured_at)
  select s.id, s.account_id, s.network_code, s.is_primary,
         (select b.code from reference.audience_bands b
           where (b.retired_at is null or b.retired_at > pg_catalog.now())
             and s.followers_count >= b.min_followers
             and (b.max_followers is null or s.followers_count <= b.max_followers)
           order by b.min_followers desc limit 1),
         (select b.code from reference.audience_bands b
           where (b.retired_at is null or b.retired_at > pg_catalog.now())
             and s.avg_reach_per_post >= b.min_followers
             and (b.max_followers is null or s.avg_reach_per_post <= b.max_followers)
           order by b.min_followers desc limit 1),
         (select f.code from reference.publication_frequencies f
           where (f.retired_at is null or f.retired_at > pg_catalog.now())
             and s.posts_last_30_days >= f.min_posts_30d
             and (f.max_posts_30d is null or s.posts_last_30_days <= f.max_posts_30d)
           order by f.min_posts_30d desc limit 1),
         (select c.code from reference.comment_bands c
           where (c.retired_at is null or c.retired_at > pg_catalog.now())
             and s.avg_comments_per_post >= c.min_comments
             and (c.max_comments is null or s.avg_comments_per_post <= c.max_comments)
           order by c.min_comments desc limit 1),
         null,
         s.figures_source,
         s.figures_measured_at
    from profiles.creator_social_accounts s
   where s.id = p_social_account_id
  on conflict (social_account_id) do update
     set network_code               = excluded.network_code,
         is_primary                 = excluded.is_primary,
         audience_band              = excluded.audience_band,
         reach_band                 = excluded.reach_band,
         publication_frequency_code = excluded.publication_frequency_code,
         comment_band               = excluded.comment_band,
         engagement_band            = null,
         figures_source             = excluded.figures_source,
         figures_measured_at        = excluded.figures_measured_at;
end
$$;

comment on function profiles.refresh_creator_public_network(uuid) is
  '0218, 07 RG22, RG45, RG114, RG115: (re)writes the row of creator_public_networks of one line '
  'from its exact figures, by comparison with the active bounds of reference.audience_bands '
  '(followers, reach), publication_frequencies and comment_bands; engagement_band null (RG48). '
  'SECURITY DEFINER owned by influx_identity_definer, empty search_path; NO EXECUTE for anyone '
  '(called by the derivations and the reprise only).';

create or replace function profiles.refresh_creator_public_audience(p_account_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_line     uuid;
  v_country  char(2);
  v_share    smallint;
  v_female   bigint;
  v_male     bigint;
  v_genders  bigint := 0;
begin
  -- EC-L2D-9: the audience of the storefront is that of the primary line only
  select s.id into v_line
    from profiles.creator_social_accounts s
   where s.account_id = p_account_id and s.is_primary;

  delete from profiles.creator_public_audience a where a.account_id = p_account_id;

  if v_line is not null then
    select c.country_code, c.share_percent into v_country, v_share
      from profiles.creator_audience_countries c
     where c.social_account_id = v_line and c.slot = 0;

    -- RG58: the other countries and the age bands in share bands, a share under 10 not served
    insert into profiles.creator_public_audience (account_id, dimension, bucket, share_band)
    select p_account_id, 'country', c.country_code, profiles.audience_share_band(c.share_percent)
      from profiles.creator_audience_countries c
     where c.social_account_id = v_line and c.slot > 0
       and profiles.audience_share_band(c.share_percent) is not null
    union all
    select p_account_id, 'age', a.age_band_code, profiles.audience_share_band(a.share_percent)
      from profiles.creator_audience_ages a
     where a.social_account_id = v_line
       and profiles.audience_share_band(a.share_percent) is not null;

    select pg_catalog.sum(g.share_percent) filter (where g.gender_code = 'female'),
           pg_catalog.sum(g.share_percent) filter (where g.gender_code = 'male'),
           pg_catalog.count(*)
      into v_female, v_male, v_genders
      from profiles.creator_audience_genders g
     where g.social_account_id = v_line;
  end if;

  update profiles.creator_public_profiles p
     set main_audience_country    = v_country,
         main_audience_share_band = profiles.main_audience_share_band(v_share),
         audience_gender_band     = case when v_genders > 0 then
                                      profiles.audience_gender_band(coalesce(v_female, 0)::integer,
                                                                    coalesce(v_male, 0)::integer)
                                    end
   where p.account_id = p_account_id;
end
$$;

comment on function profiles.refresh_creator_public_audience(uuid) is
  '0218, 07 RG56 to RG61, EC-L2D-9: (re)writes the public audience of a creator from his PRIMARY '
  'line: main country and its band, gender band on the storefront; other countries and age bands '
  'in creator_public_audience (share bands, under 10 absent). No primary line: all of it null or '
  'absent. SECURITY DEFINER owned by influx_identity_definer, empty search_path; NO EXECUTE for '
  'anyone (called by the derivations and the reprise only).';

create or replace function profiles.derive_creator_public_network()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- a removed line: its row goes with it (cascade); the primary one takes the audience with it
  if tg_op = 'DELETE' then
    if old.is_primary then
      perform profiles.refresh_creator_public_audience(old.account_id);
    end if;
    return null;
  end if;
  perform profiles.refresh_creator_public_network(new.id);
  -- L2D-D13: a change of primary line derives the storefront again
  if (tg_op = 'INSERT' and new.is_primary)
     or (tg_op = 'UPDATE' and new.is_primary is distinct from old.is_primary) then
    perform profiles.refresh_creator_public_audience(new.account_id);
  end if;
  return null;
end
$$;

comment on function profiles.derive_creator_public_network() is
  'AFTER INSERT OR UPDATE OR DELETE on profiles.creator_social_accounts (0218): the bands of the '
  'line (refresh_creator_public_network), and the public audience when the primary line changes '
  'or goes. SECURITY DEFINER owned by influx_identity_definer, empty search_path, NO grant.';

create or replace function profiles.derive_creator_public_audience()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform profiles.refresh_creator_public_audience(old.account_id);
  else
    perform profiles.refresh_creator_public_audience(new.account_id);
  end if;
  return null;
end
$$;

comment on function profiles.derive_creator_public_audience() is
  'AFTER INSERT OR UPDATE OR DELETE on the three exact audience tables (0218): the public audience '
  'of the account again (refresh_creator_public_audience). SECURITY DEFINER owned by '
  'influx_identity_definer, empty search_path, NO grant.';

create or replace function profiles.record_creator_metrics_history()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_confirmed  boolean;
begin
  -- EC-L2D-05-8: what is an entry and what is a confirmation
  if tg_op = 'INSERT' then
    if new.followers_count is null and new.posts_last_30_days is null
       and new.avg_comments_per_post is null and new.figures_measured_at is null then
      return null;
    end if;
    v_confirmed := new.figures_measured_at is not null;
  else
    v_confirmed := new.figures_measured_at is not null
                   and new.figures_measured_at is distinct from old.figures_measured_at;
    if not v_confirmed
       and (new.followers_count, new.posts_last_30_days, new.avg_comments_per_post,
            new.figures_source)
           is not distinct from
           (old.followers_count, old.posts_last_30_days, old.avg_comments_per_post,
            old.figures_source) then
      return null;
    end if;
  end if;

  -- RG119: value, source, date, author; append-only. EC-L2D-05-7: the author.
  insert into profiles.creator_network_metrics_history
    (account_id, social_account_id, network_code, followers_count, posts_last_30_days,
     avg_comments_per_post, figures_source, confirmed, recorded_by_account_id)
  values
    (new.account_id, new.id, new.network_code, new.followers_count, new.posts_last_30_days,
     new.avg_comments_per_post, new.figures_source, v_confirmed,
     coalesce(influx.current_account_id(), new.account_id));
  return null;
end
$$;

comment on function profiles.record_creator_metrics_history() is
  'AFTER INSERT OR UPDATE of the three metrics, the source or the date on '
  'profiles.creator_social_accounts (07 RG119, 0218): one history row per entry (confirmed false) '
  'and per confirmation (a new date, confirmed true), with the source and the author (the session, '
  'or the creator without one, EC-L2D-05-7). SECURITY DEFINER owned by influx_identity_definer, '
  'empty search_path, NO grant.';

create or replace function profiles.copy_creator_residence_country()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- 07 RG36: the country of residence is that of the account; the region of the old country goes
  -- (the trigger fires on a changed country only)
  update profiles.creator_public_profiles p
     set residence_country_code = new.country_code,
         residence_region_code  = null
   where p.account_id = new.id;
  return null;
end
$$;

comment on function profiles.copy_creator_residence_country() is
  'AFTER UPDATE OF country_code on identity.accounts (07 RG36, 0218): the storefront of the account '
  'takes the new country and loses its region, in the same transaction, whatever the writer '
  '(identity.update_own_account, identity.correct_member_account, operator SQL). SECURITY DEFINER '
  'owned by influx_identity_definer, empty search_path, NO grant.';

-- 6. The door « Confirmer mes chiffres » (RG50, RG116, EC-L2D-6) ------------------------------------

create or replace function profiles.confirm_own_creator_figures(
  p_social_account_id      uuid,
  p_followers_count        bigint,
  p_posts_last_30_days     integer,
  p_avg_comments_per_post  bigint
)
returns timestamptz
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account  uuid := influx.current_account_id();
  v_at       timestamptz;
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

  -- the three metrics in one operation (a null one is not declared), source and date set here
  update profiles.creator_social_accounts s
     set followers_count       = p_followers_count,
         posts_last_30_days    = p_posts_last_30_days,
         avg_comments_per_post = p_avg_comments_per_post,
         figures_source        = 'declared',
         figures_measured_at   = pg_catalog.now()
   where s.id = p_social_account_id and s.account_id = v_account
  returning s.figures_measured_at into v_at;
  -- another creator's line answers as an unknown one (T14)
  if v_at is null then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return v_at;
end
$$;

comment on function profiles.confirm_own_creator_figures(uuid, bigint, integer, bigint) is
  '« Confirmer mes chiffres » (07 RG50, RG116, EC-L2D-6, 0218): on a line of the caller, the three '
  'priority metrics written together (null = not declared), figures_source declared and '
  'figures_measured_at now(), returned; the only writer of the date. 23514 for a negative figure; '
  '42501 outside an active creator account, and for another''s line as for an unknown one. '
  'SECURITY DEFINER owned by influx_identity_definer, empty search_path; EXECUTE for influx_creator '
  'only.';

do $$
declare
  f text;
begin
  foreach f in array array[
    'profiles.refresh_creator_public_network(uuid)',
    'profiles.refresh_creator_public_audience(uuid)',
    'profiles.derive_creator_public_network()',
    'profiles.derive_creator_public_audience()',
    'profiles.record_creator_metrics_history()',
    'profiles.copy_creator_residence_country()',
    'profiles.confirm_own_creator_figures(uuid, bigint, integer, bigint)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
  end loop;
end
$$;
grant execute on function profiles.confirm_own_creator_figures(uuid, bigint, integer, bigint)
   to influx_creator;

-- 6.1 The triggers (§7 of the header: never on the erasure) ------------------------------------------

drop trigger if exists creator_social_accounts_derive_public_network on profiles.creator_social_accounts;
create trigger creator_social_accounts_derive_public_network
  after insert or update or delete on profiles.creator_social_accounts
  for each row when (current_user <> 'influx_privacy_definer')
  execute function profiles.derive_creator_public_network();

drop trigger if exists creator_social_accounts_record_metrics_history on profiles.creator_social_accounts;
create trigger creator_social_accounts_record_metrics_history
  after insert or update of followers_count, posts_last_30_days, avg_comments_per_post,
                            figures_source, figures_measured_at
  on profiles.creator_social_accounts
  for each row when (current_user <> 'influx_privacy_definer')
  execute function profiles.record_creator_metrics_history();

do $$
declare
  t text;
begin
  foreach t in array array['creator_audience_countries', 'creator_audience_ages',
                           'creator_audience_genders']
  loop
    execute format('drop trigger if exists %I on profiles.%I', t || '_derive_public', t);
    execute format('create trigger %I after insert or update or delete on profiles.%I '
                   'for each row when (current_user <> ''influx_privacy_definer'') '
                   'execute function profiles.derive_creator_public_audience()',
                   t || '_derive_public', t);
  end loop;
end
$$;

drop trigger if exists accounts_copy_creator_residence_country on identity.accounts;
create trigger accounts_copy_creator_residence_country
  after update of country_code on identity.accounts
  for each row when (old.country_code is distinct from new.country_code
                     and current_user <> 'influx_privacy_definer')
  execute function profiles.copy_creator_residence_country();

-- 7. Reprise of the residence (the migration role, owner of the tables) --------------------------------
-- <reprise-residence>
update profiles.creator_public_profiles p
   set residence_country_code = a.country_code,
       residence_region_code  = null
  from identity.accounts a
 where a.id = p.account_id
   and p.residence_country_code is distinct from a.country_code;
-- </reprise-residence>

-- 8. The derivations to their owner, then the reprise as that owner (03 P7 rule 5, window of 0004 §9) --

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_identity_definer', current_user);
end
$$;
grant create on schema profiles to influx_identity_definer;

alter function profiles.refresh_creator_public_network(uuid) owner to influx_identity_definer;
alter function profiles.refresh_creator_public_audience(uuid) owner to influx_identity_definer;
alter function profiles.derive_creator_public_network() owner to influx_identity_definer;
alter function profiles.derive_creator_public_audience() owner to influx_identity_definer;
alter function profiles.record_creator_metrics_history() owner to influx_identity_definer;
alter function profiles.copy_creator_residence_country() owner to influx_identity_definer;
alter function profiles.confirm_own_creator_figures(uuid, bigint, integer, bigint)
  owner to influx_identity_definer;

set role influx_identity_definer;
-- <reprise> (replayed as is by db-tests/profiles-creator-bands.test.ts, as influx_identity_definer)
do $$
declare
  v_row  record;
begin
  for v_row in select s.id from profiles.creator_social_accounts s order by s.id loop
    perform profiles.refresh_creator_public_network(v_row.id);
  end loop;
  for v_row in
    select distinct s.account_id from profiles.creator_social_accounts s where s.is_primary
     order by s.account_id
  loop
    perform profiles.refresh_creator_public_audience(v_row.account_id);
  end loop;
end
$$;
-- </reprise>
reset role;

revoke create on schema profiles from influx_identity_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_identity_definer', current_user);
end
$$;

-- 9. End-state assertions ------------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  -- the seven derivations and the door: SECURITY DEFINER, influx_identity_definer, empty search_path
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('profiles.refresh_creator_public_network(uuid)'::regprocedure,
                   'profiles.refresh_creator_public_audience(uuid)'::regprocedure,
                   'profiles.derive_creator_public_network()'::regprocedure,
                   'profiles.derive_creator_public_audience()'::regprocedure,
                   'profiles.record_creator_metrics_history()'::regprocedure,
                   'profiles.copy_creator_residence_country()'::regprocedure,
                   'profiles.confirm_own_creator_figures(uuid, bigint, integer, bigint)'::regprocedure)
     and (pg_catalog.pg_get_userbyid(p.proowner) <> 'influx_identity_definer'
          or not p.prosecdef
          or p.proconfig is distinct from array['search_path=""']);
  if v_bad is not null then
    raise exception 'not SECURITY DEFINER of influx_identity_definer with an empty search_path: %', v_bad;
  end if;

  -- EXECUTE: the door to influx_creator alone, the derivations to nobody but their owner
  select string_agg(p.oid::regprocedure::text || ' to '
                    || case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where n.nspname = 'profiles'
     and p.proname in ('refresh_creator_public_network', 'refresh_creator_public_audience',
                       'derive_creator_public_network', 'derive_creator_public_audience',
                       'record_creator_metrics_history', 'copy_creator_residence_country',
                       'confirm_own_creator_figures', 'guard_creator_public_profile_write',
                       'check_creator_audience_sum', 'audience_share_band',
                       'main_audience_share_band', 'audience_gender_band')
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (p.proname = 'confirm_own_creator_figures' and a.grantee <> 0
              and a.grantee::regrole::text = 'influx_creator')
     and not (p.proname in ('audience_share_band', 'main_audience_share_band', 'audience_gender_band')
              and a.grantee <> 0 and a.grantee::regrole::text = 'influx_identity_definer');
  if v_bad is not null then
    raise exception 'unexpected EXECUTE: %', v_bad;
  end if;

  -- RLS enabled and forced on the two new tables
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'profiles'
     and c.relname in ('creator_public_networks', 'creator_public_audience')
     and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not enabled and forced on: %', v_bad;
  end if;

  -- NON REVERSIBLE (04 §11.3, P5, EC-L2D-1): still no right of influx_advertiser on any creator
  -- object, guarded by name
  select string_agg(c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'profiles'
     and c.relname like 'creator\_%'
     and ((c.relkind in ('r', 'p', 'v', 'm')
           and (pg_catalog.has_table_privilege('influx_advertiser', c.oid,
                                               'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                or pg_catalog.has_any_column_privilege('influx_advertiser', c.oid,
                                                       'SELECT, INSERT, UPDATE, REFERENCES')))
          or (c.relkind = 'S'
              and pg_catalog.has_sequence_privilege('influx_advertiser', c.oid, 'USAGE, SELECT, UPDATE')));
  if v_bad is not null then
    raise exception 'influx_advertiser holds a right on: %', v_bad;
  end if;
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'profiles'
     and (p.proname like '%creator%' or p.proname like '%audience%')
     and pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE');
  if v_bad is not null then
    raise exception 'influx_advertiser may execute: %', v_bad;
  end if;
  select string_agg(tablename || '.' || policyname, ', ') into v_bad
    from pg_catalog.pg_policies
   where schemaname = 'profiles' and tablename like 'creator\_%'
     and (roles && array['influx_advertiser', 'public']::name[]);
  if v_bad is not null then
    raise exception 'a policy of a creator object names influx_advertiser or public: %', v_bad;
  end if;

  -- fiche invariants 4, 5, 7: no member nor internal role writes a band, a derived row, the source,
  -- the date or the history
  select string_agg(r.rolname || '.' || t.tab || '.' || t.priv, ', ') into v_bad
    from pg_catalog.pg_roles r,
         (values ('creator_public_networks', 'INSERT'), ('creator_public_networks', 'UPDATE'),
                 ('creator_public_networks', 'DELETE'), ('creator_public_audience', 'INSERT'),
                 ('creator_public_audience', 'UPDATE'), ('creator_public_audience', 'DELETE'),
                 ('creator_network_metrics_history', 'INSERT')) as t (tab, priv)
   where r.rolname in ('influx_creator', 'influx_advertiser', 'influx_agent', 'influx_admin',
                       'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and (pg_catalog.has_table_privilege(r.oid, 'profiles.' || t.tab, t.priv)
          or (t.priv <> 'DELETE'
              and pg_catalog.has_any_column_privilege(r.oid, 'profiles.' || t.tab, t.priv)));
  if v_bad is not null then
    raise exception 'unexpected write right(s): %', v_bad;
  end if;
  select string_agg(r.rolname || '.' || col || '.' || priv, ', ') into v_bad
    from pg_catalog.pg_roles r,
         unnest(array['figures_source', 'figures_measured_at']) col,
         unnest(array['INSERT', 'UPDATE']) priv
   where r.rolname in ('influx_creator', 'influx_advertiser', 'influx_agent', 'influx_admin',
                       'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and pg_catalog.has_column_privilege(r.oid, 'profiles.creator_social_accounts', col, priv);
  if v_bad is not null then
    raise exception 'unexpected write right(s) on the source or the date: %', v_bad;
  end if;

  -- RG48: no engagement band anywhere
  if exists (select 1 from profiles.creator_public_networks where engagement_band is not null) then
    raise exception 'an engagement band was derived (RG48)';
  end if;
  -- the reprise: every line holds its derived row, every storefront the country of its account
  select string_agg(s.id::text, ', ') into v_bad
    from profiles.creator_social_accounts s
   where not exists (select 1 from profiles.creator_public_networks n where n.social_account_id = s.id);
  if v_bad is not null then
    raise exception 'network line(s) without a derived row: %', v_bad;
  end if;
  select string_agg(p.account_id::text, ', ') into v_bad
    from profiles.creator_public_profiles p
    join identity.accounts a on a.id = p.account_id
   where p.residence_country_code is distinct from a.country_code;
  if v_bad is not null then
    raise exception 'storefront(s) whose country is not that of the account: %', v_bad;
  end if;

  if exists (select 1
               from pg_catalog.pg_auth_members m
               join pg_catalog.pg_roles grp on grp.oid = m.roleid
               join pg_catalog.pg_roles mem on mem.oid = m.member
              where grp.rolname = 'influx_identity_definer'
                and (mem.rolname <> current_user or m.set_option or m.inherit_option)) then
    raise exception 'influx_identity_definer left with a usable member';
  end if;
  if pg_catalog.has_schema_privilege('influx_identity_definer', 'profiles', 'CREATE') then
    raise exception 'influx_identity_definer left with CREATE on schema profiles';
  end if;
end
$$;
