-- =============================================================================
-- 0217_profiles_creator_identity
-- -----------------------------------------------------------------------------
-- Lot 2 / L2D, commit 04 (jalons/l2d/04.md; l2d/modele.md §0217, which prevails for every name;
-- fiche invariants 1, 2, 7, 8). The IDENTIFYING layers of the creator profile (07 RG16): what a
-- brand may read after the reveal (I) and what it never reads (N). Nothing here is a band.
--
-- NOT REVERSIBLE (04 §11.3, the line written there as « 0204 profiles_creator_identity »).
-- influx_advertiser holds NOTHING on any object below, and the REVOKE written in §8 must NEVER be
-- undone: the anonymisation of the marketplace is a separation of objects doubled by an absence of
-- right (03 P5, EC-L2D-1). A later migration that grants influx_advertiser anything here is a
-- blocking defect, caught by T1-R (db-tests/profiles-creator-identity.test.ts), which examines every
-- profiles.creator_% object by its name. The reveal of Lot 4 (0401) opens creator_social_accounts
-- through a policy carrying the reveal in its predicate; creator_identities, the exact audience
-- breakdown kept as N, the refused sectors and the history are never opened to a brand.
--
-- 1. reference.network_url_hosts (modele.md point 5): the hosts of the ten networks; the base
--    arbitrates the URL of a network line (07 RG43), packages/domain only compares. Read like every
--    reference list (0201).
-- 2. profiles.creator_identities (N, 07 RG36, RG40): legal names, contact e-mail and phone, postal
--    address, CITY (D79: never revealed), country, and the completeness score of the profile
--    (EC-02-2: outside the storefront). Neither date of birth nor company field (EC-L2D-7).
--    One row per storefront: created by a trigger at the insertion of the storefront (§7), and by
--    the reprise of §9 for the storefronts of 0216.
-- 3. profiles.creator_social_accounts (I, 07 RG41 to RG47): one line per network account, exact
--    figures (the three priority metrics of D61, reach, engagement in basis points, EC-L2D-8), the
--    pseudonym (RG30); a handle once per (creator, network), case-insensitive (RG42); at most one
--    primary line. figures_source and figures_measured_at: no member writes them (the door of 0218).
--    The guard profiles.guard_creator_social_account() holds the host of the URL to its network.
-- 4. The exact audience of a line (I, RG57, RG59; EC-02-6: one table per dimension, a foreign key
--    each): countries (slot 0 = main country, slots 1 to 4 at 10 % or more, RG56), age bands
--    (reference.age_bands, RG60), genders (female, male, other, RG61). Whole percentages 0 to 100
--    (RG57); the sum of a dimension is held by 0218. Bound to their line by a composite foreign key
--    (id, account_id), deleted with it.
-- 5. profiles.creator_refused_sectors (N, RG75): never exposed, counted nor explained.
-- 6. profiles.creator_network_metrics_history (N, RG119, 04 §12.12 point 6): append-only, no member
--    reads it; written by 0218 (each entry and confirmation of the three metrics), deleted with the
--    account only (Q18): the delete of influx_privacy_definer (0219) is the one exception.
-- 7. profiles.provision_creator_identity(): the empty identity row of every new storefront.
-- 8. Row level security (modele.md « Droits »): the creator holds his own rows through one policy
--    FOR ALL (04 §6.2 (c)), his rights being the column grants; agent and admin read in aal2;
--    influx_identity_definer inserts the identity row of a creator account; NOTHING for
--    influx_advertiser, written as an explicit REVOKE; nothing to public, anon, authenticated,
--    service_role.
-- 9. Reprise: the identity row of every storefront of 0216.
--
-- Not here: the derivations, the porte « Confirmer mes chiffres », the history writes and the sum
-- of a dimension (0218); the export and the erasure (0219); the reveal GRANT (0401); any route.
--
-- EC-L2D-04 (micro-gaps, the safest choice):
--   EC-L2D-04-1  network_code is inserted, never updated by the creator: a line changes network by
--                being deleted and declared again (its audience goes with it, its history stays).
--   EC-L2D-04-2  no ownership or verification column on the line before L2E (modele.md point 2,
--                EC-02-3), against « vérification » of 04.md: modele.md prevails for the names.
--   EC-L2D-04-3  profile_url carries no space nor control character (stricter than `^https://`).
--   EC-L2D-04-4  share_percent may be null on the main country only (slot 0): the autosave may
--                hold the country before its share; every other row carries its share.
--   EC-L2D-04-5  the identity row is created by a SECURITY INVOKER trigger: at sign-up it runs as
--                influx_identity_definer (provision_account), whose INSERT (account_id) and policy
--                are those of modele.md « Droits »; no new SECURITY DEFINER function.
--   EC-L2D-04-6  the guard reads the reference lists as its caller; a writer that cannot read the
--                network of its line is refused (23503, as an unknown network), never let through.
--
-- ROLLBACK: none by grant. Before any creator has entered anything, and only then, the objects may
-- be dropped (drop trigger creator_public_profiles_provision_identity; drop function
-- profiles.provision_creator_identity(), profiles.guard_creator_social_account(); drop table
-- profiles.creator_network_metrics_history, profiles.creator_refused_sectors,
-- profiles.creator_audience_genders, profiles.creator_audience_ages,
-- profiles.creator_audience_countries, profiles.creator_social_accounts,
-- profiles.creator_identities, reference.network_url_hosts). Never a GRANT to influx_advertiser.
-- =============================================================================

-- 1. reference.network_url_hosts (modele.md point 5) --------------------------------------------------

create table if not exists reference.network_url_hosts (
  network_code  text        not null references reference.networks (code),
  host          text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (network_code, host),
  -- a lower-case DNS name of two labels at least, no scheme, no port, no path
  constraint network_url_hosts_host_shape
    check (host ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
           and char_length(host) <= 253)
);

comment on table reference.network_url_hosts is
  'Hosts a profile URL of a network line may point to (07 RG43, modele.md point 5): the host itself '
  'or one of its subdomains. A network without any host here is free (07 l. 289). Read like every '
  'reference list; held by profiles.guard_creator_social_account().';

drop trigger if exists network_url_hosts_touch_updated_at on reference.network_url_hosts;
create trigger network_url_hosts_touch_updated_at
  before update on reference.network_url_hosts
  for each row execute function influx.touch_updated_at();

insert into reference.network_url_hosts (network_code, host) values
  ('instagram', 'instagram.com'),
  ('tiktok',    'tiktok.com'),
  ('youtube',   'youtube.com'),
  ('facebook',  'facebook.com'),
  ('facebook',  'fb.com'),
  ('linkedin',  'linkedin.com'),
  ('x',         'x.com'),
  ('x',         'twitter.com'),
  ('snapchat',  'snapchat.com'),
  ('twitch',    'twitch.tv'),
  ('pinterest', 'pinterest.com'),
  ('pinterest', 'pinterest.fr'),
  ('threads',   'threads.net'),
  ('threads',   'threads.com')
on conflict (network_code, host) do nothing;

-- 2. profiles.creator_identities: the object never revealed (N) ----------------------------------

create table if not exists profiles.creator_identities (
  account_id            uuid        not null primary key
                                    references profiles.creator_public_profiles (account_id),
  legal_first_name      text,
  legal_last_name       text,
  contact_email         text,
  contact_phone         text,
  address_line          text,
  postal_code           text,
  city                  text,
  country_code          char(2)     references reference.countries (code),
  completeness_percent  smallint    not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint creator_identities_legal_first_name_length check (char_length(legal_first_name) <= 100),
  constraint creator_identities_legal_first_name_not_blank check (legal_first_name ~ '[^[:space:]]'),
  constraint creator_identities_legal_first_name_printable check (legal_first_name !~ '[[:cntrl:]]'),
  constraint creator_identities_legal_last_name_length check (char_length(legal_last_name) <= 100),
  constraint creator_identities_legal_last_name_not_blank check (legal_last_name ~ '[^[:space:]]'),
  constraint creator_identities_legal_last_name_printable check (legal_last_name !~ '[[:cntrl:]]'),
  -- an address, lower case as every address of the base (0004, 0202)
  constraint creator_identities_contact_email_shape
    check (contact_email ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+\.[^@[:space:][:cntrl:]]+$'),
  constraint creator_identities_contact_email_lower check (contact_email = lower(contact_email)),
  constraint creator_identities_contact_email_length check (char_length(contact_email) <= 320),
  -- + then 7 to 15 digits, no rule per country (0202)
  constraint creator_identities_contact_phone_shape check (contact_phone ~ '^\+[0-9]{7,15}$'),
  constraint creator_identities_address_line_length check (char_length(address_line) <= 200),
  constraint creator_identities_address_line_not_blank check (address_line ~ '[^[:space:]]'),
  constraint creator_identities_address_line_printable check (address_line !~ '[[:cntrl:]]'),
  -- letters and digits, inner spaces and hyphens (FR 75001, GB SW1A 1AA, US 12345-6789)
  constraint creator_identities_postal_code_shape
    check (postal_code ~ '^[[:alnum:]]([[:alnum:] -]*[[:alnum:]])?$' and char_length(postal_code) <= 20),
  constraint creator_identities_city_length check (char_length(city) <= 100),
  constraint creator_identities_city_not_blank check (city ~ '[^[:space:]]'),
  constraint creator_identities_city_printable check (city !~ '[[:cntrl:]]'),
  constraint creator_identities_completeness_percent check (completeness_percent between 0 and 100)
);

comment on table profiles.creator_identities is
  'The identifying object NEVER revealed (07 RG16 layer N, 04 §5.2): legal names, contact details, '
  'postal address, city (D79), country. No GRANT to influx_advertiser, ever (03 P5, 04 §11.3, '
  'non reversible). One row per storefront, created empty with it. Neither date of birth nor '
  'company field (EC-L2D-7); the declared status lives on identity.accounts.';
comment on column profiles.creator_identities.city is
  'City of residence (07 RG36, D79): layer N, never revealed, never a search facet (RG38).';
comment on column profiles.creator_identities.completeness_percent is
  'Completeness score of the creator profile (07 RG86, EC-02-2), computed by packages/domain and '
  'written by apps/api; kept OUT of the storefront: never served to a brand.';

drop trigger if exists creator_identities_touch_updated_at on profiles.creator_identities;
create trigger creator_identities_touch_updated_at
  before update on profiles.creator_identities
  for each row execute function influx.touch_updated_at();

-- 3. profiles.creator_social_accounts: the object revealed at Lot 4 (I) ---------------------------

create table if not exists profiles.creator_social_accounts (
  id                     uuid        not null primary key default gen_random_uuid(),
  account_id             uuid        not null references profiles.creator_public_profiles (account_id),
  network_code           text        not null references reference.networks (code),
  is_primary             boolean     not null default false,
  handle                 text,
  pseudonym              text,
  profile_url            text,
  followers_count        bigint,
  posts_last_30_days     integer,
  avg_comments_per_post  bigint,
  avg_reach_per_post     bigint,
  engagement_rate_bp     integer,
  figures_source         text        not null default 'declared',
  figures_measured_at    timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  -- target of the composite foreign keys of the audience: a row of the audience belongs to a line
  -- of the same account
  constraint creator_social_accounts_id_account_unique unique (id, account_id),
  -- RG44: a moderated text of 100 characters at most
  constraint creator_social_accounts_handle_length check (char_length(handle) <= 100),
  constraint creator_social_accounts_handle_not_blank check (handle ~ '[^[:space:]]'),
  constraint creator_social_accounts_handle_printable check (handle !~ '[[:cntrl:]]'),
  -- RG30: one pseudonym per line, 60 characters at most
  constraint creator_social_accounts_pseudonym_length check (char_length(pseudonym) <= 60),
  constraint creator_social_accounts_pseudonym_not_blank check (pseudonym ~ '[^[:space:]]'),
  constraint creator_social_accounts_pseudonym_printable check (pseudonym !~ '[[:cntrl:]]'),
  -- RG43; its host is held by profiles.guard_creator_social_account() (EC-L2D-04-3)
  constraint creator_social_accounts_profile_url_shape
    check (profile_url ~ '^https://[^[:space:][:cntrl:]]+$' and char_length(profile_url) <= 500),
  -- RG46: whole numbers, zero accepted, never negative
  constraint creator_social_accounts_followers_count check (followers_count >= 0),
  constraint creator_social_accounts_posts_last_30_days check (posts_last_30_days >= 0),
  constraint creator_social_accounts_avg_comments_per_post check (avg_comments_per_post >= 0),
  constraint creator_social_accounts_avg_reach_per_post check (avg_reach_per_post >= 0),
  -- RG46, EC-L2D-8: 0 to 100 percent with two decimals, in basis points (350 = 3.50 %)
  constraint creator_social_accounts_engagement_rate_bp check (engagement_rate_bp between 0 and 10000),
  constraint creator_social_accounts_figures_source
    check (figures_source in ('declared', 'agent_observed'))
);

-- RG42: a handle once per (creator, network), whatever its case; two accounts on one network allowed
create unique index if not exists creator_social_accounts_handle_unique
  on profiles.creator_social_accounts (account_id, network_code, lower(handle))
  where handle is not null;

-- RG41: exactly one primary line on a published profile, never two (L2G requires the one)
create unique index if not exists creator_social_accounts_one_primary
  on profiles.creator_social_accounts (account_id)
  where is_primary;

-- the reads of a creator's own lines (apps/api, 09) and the policy predicate
create index if not exists creator_social_accounts_account
  on profiles.creator_social_accounts (account_id);

comment on table profiles.creator_social_accounts is
  'Network lines of a creator (07 RG41 to RG47, layer I): handle, pseudonym, URL and EXACT figures. '
  'No right of influx_advertiser before the reveal of Lot 4 (0401, a policy carrying the reveal). '
  'The storefront only ever gets bands derived from it (0218, creator_public_networks).';
comment on column profiles.creator_social_accounts.account_id is
  'The account [K] (EC-02-5): the same policy form on every creator object.';
comment on column profiles.creator_social_accounts.posts_last_30_days is
  'Priority metric 2 (D61, RG114): publications of the last 30 days, the rhythm derives from it.';
comment on column profiles.creator_social_accounts.avg_comments_per_post is
  'Priority metric 3 (D61, RG115): average comments per publication.';
comment on column profiles.creator_social_accounts.avg_reach_per_post is
  'Average reach PER PUBLICATION, never per month (07 RG47).';
comment on column profiles.creator_social_accounts.engagement_rate_bp is
  'Engagement rate in basis points, 0 to 10000 (EC-L2D-8): the units of reference.engagement_bands; '
  'the entry is converted as a string, never by a division.';
comment on column profiles.creator_social_accounts.figures_source is
  'declared or agent_observed (RG45, RG49): written by no member (the door of 0218, the agent at L2E).';
comment on column profiles.creator_social_accounts.figures_measured_at is
  'Date of the figures (RG50, RG116): set by « Confirmer mes chiffres » (0218), never entered.';

drop trigger if exists creator_social_accounts_touch_updated_at on profiles.creator_social_accounts;
create trigger creator_social_accounts_touch_updated_at
  before update on profiles.creator_social_accounts
  for each row execute function influx.touch_updated_at();

-- 3.1 The guard of the URL (RG43, modele.md point 5) --------------------------------------------------

create or replace function profiles.guard_creator_social_account()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_authority  text;
  v_host       text;
begin
  -- no URL, or one the shape constraint refuses after this trigger: nothing to hold here
  if new.profile_url is null or new.profile_url !~ '^https://[^[:space:][:cntrl:]]+$' then
    return new;
  end if;
  -- EC-L2D-04-6: the guard reads as its caller; a network it cannot read is not vouched for
  if not exists (select 1 from reference.networks n where n.code = new.network_code) then
    raise exception 'unknown network for a network line'
      using errcode = 'foreign_key_violation';
  end if;
  v_authority := pg_catalog.substring(new.profile_url, '^https://([^/?#]*)');
  -- no credentials before the host (https://user:secret@host), and a host
  if v_authority is null or v_authority = '' or pg_catalog.strpos(v_authority, '@') > 0 then
    raise exception 'the profile URL must name a host, without credentials'
      using errcode = 'check_violation', constraint = 'creator_social_accounts_profile_url_host';
  end if;
  v_host := pg_catalog.lower(pg_catalog.regexp_replace(v_authority, ':[0-9]*$', ''));
  -- a network with listed hosts: the host itself or one of its subdomains; otherwise free
  if exists (select 1 from reference.network_url_hosts h where h.network_code = new.network_code)
     and not exists (
       select 1 from reference.network_url_hosts h
        where h.network_code = new.network_code
          and (v_host = h.host
               or pg_catalog.right(v_host, pg_catalog.char_length(h.host) + 1) = '.' || h.host)) then
    raise exception 'the profile URL does not point to the declared network'
      using errcode = 'check_violation', constraint = 'creator_social_accounts_profile_url_host';
  end if;
  return new;
end
$$;

comment on function profiles.guard_creator_social_account() is
  '07 RG43, modele.md point 5: the host of profile_url is a host of reference.network_url_hosts for '
  'the network of the line, or one of its subdomains; no credentials; a network without listed '
  'host is free. 23514 (constraint creator_social_accounts_profile_url_host) otherwise. SECURITY '
  'INVOKER, empty search_path: it reads the reference lists as its caller (EC-L2D-04-6).';

revoke all on function profiles.guard_creator_social_account()
  from public, anon, authenticated, service_role;

drop trigger if exists creator_social_accounts_guard on profiles.creator_social_accounts;
create trigger creator_social_accounts_guard
  before insert or update of profile_url, network_code on profiles.creator_social_accounts
  for each row execute function profiles.guard_creator_social_account();

-- 4. The exact audience of a line (I, RG56 to RG61; EC-02-6) ----------------------------------------

create table if not exists profiles.creator_audience_countries (
  social_account_id  uuid        not null,
  account_id         uuid        not null,
  slot               smallint    not null,
  country_code       char(2)     not null references reference.countries (code),
  share_percent      smallint,
  created_at         timestamptz not null default now(),
  primary key (social_account_id, slot),
  constraint creator_audience_countries_line_fk
    foreign key (social_account_id, account_id)
    references profiles.creator_social_accounts (id, account_id) on delete cascade,
  constraint creator_audience_countries_once unique (social_account_id, country_code),
  -- RG56: the main country (slot 0) and four other countries at most
  constraint creator_audience_countries_slot check (slot between 0 and 4),
  -- RG57: whole percentages
  constraint creator_audience_countries_share_percent check (share_percent between 0 and 100),
  -- RG56: every other country weighs 10 % or more; EC-L2D-04-4: the main one may wait for its share
  constraint creator_audience_countries_other_share
    check (slot = 0 or (share_percent is not null and share_percent >= 10))
);

create table if not exists profiles.creator_audience_ages (
  social_account_id  uuid        not null,
  account_id         uuid        not null,
  age_band_code      text        not null references reference.age_bands (code),
  share_percent      smallint    not null,
  created_at         timestamptz not null default now(),
  primary key (social_account_id, age_band_code),
  constraint creator_audience_ages_line_fk
    foreign key (social_account_id, account_id)
    references profiles.creator_social_accounts (id, account_id) on delete cascade,
  constraint creator_audience_ages_share_percent check (share_percent between 0 and 100)
);

create table if not exists profiles.creator_audience_genders (
  social_account_id  uuid        not null,
  account_id         uuid        not null,
  gender_code        text        not null,
  share_percent      smallint    not null,
  created_at         timestamptz not null default now(),
  primary key (social_account_id, gender_code),
  constraint creator_audience_genders_line_fk
    foreign key (social_account_id, account_id)
    references profiles.creator_social_accounts (id, account_id) on delete cascade,
  -- RG61: women, men, others or not declared; always about the audience
  constraint creator_audience_genders_gender_code check (gender_code in ('female', 'male', 'other')),
  constraint creator_audience_genders_share_percent check (share_percent between 0 and 100)
);

comment on table profiles.creator_audience_countries is
  'Exact audience by country of a network line (07 RG56, RG57, RG59, layer I): slot 0 the main '
  'country, slots 1 to 4 the others at 10 % or more. Bands only reach the storefront (0218).';
comment on table profiles.creator_audience_ages is
  'Exact audience by age band of a network line (07 RG57, RG60, layer I): whole percentages.';
comment on table profiles.creator_audience_genders is
  'Exact audience by gender of a network line (07 RG57, RG61, layer I): the AUDIENCE, never the '
  'creator (RG55); the storefront gets the gender band only (0218).';

-- 5. profiles.creator_refused_sectors (N, RG75) ----------------------------------------------------

create table if not exists profiles.creator_refused_sectors (
  account_id   uuid        not null references profiles.creator_public_profiles (account_id),
  sector_code  text        not null references reference.sectors (code),
  created_at   timestamptz not null default now(),
  primary key (account_id, sector_code)
);

comment on table profiles.creator_refused_sectors is
  'Sectors a creator refuses (07 RG75, layer N): never exposed, explained nor counted, even to the '
  'brand concerned (a conviction may be inferred, 04 §5.2); a silent exclusion of the search.';

-- 6. profiles.creator_network_metrics_history (N, RG119), append-only -------------------------------

create table if not exists profiles.creator_network_metrics_history (
  id                      bigint      not null generated always as identity primary key,
  account_id              uuid        not null references profiles.creator_public_profiles (account_id),
  -- no foreign key: the history outlives a deleted line (RG119)
  social_account_id       uuid        not null,
  network_code            text        not null references reference.networks (code),
  followers_count         bigint,
  posts_last_30_days      integer,
  avg_comments_per_post   bigint,
  figures_source          text        not null,
  confirmed               boolean     not null default false,
  recorded_at             timestamptz not null default now(),
  recorded_by_account_id  uuid        not null references identity.accounts (id),
  constraint creator_network_metrics_history_followers_count check (followers_count >= 0),
  constraint creator_network_metrics_history_posts_last_30_days check (posts_last_30_days >= 0),
  constraint creator_network_metrics_history_avg_comments_per_post
    check (avg_comments_per_post >= 0),
  constraint creator_network_metrics_history_figures_source
    check (figures_source in ('declared', 'agent_observed'))
);

comment on table profiles.creator_network_metrics_history is
  'History of the three priority metrics of each line (07 RG119, 04 §12.12 point 6, layer N): one '
  'row per entry or confirmation (confirmed), its source and author. Append-only; read by agent and '
  'admin only; never served to a member. Kept while the account exists, deleted with it (Q18): the '
  'delete of influx_privacy_definer (0219) is the only mutation let through.';

drop trigger if exists creator_network_metrics_history_no_update on profiles.creator_network_metrics_history;
create trigger creator_network_metrics_history_no_update
  before update on profiles.creator_network_metrics_history
  for each row execute function influx.assert_append_only();

drop trigger if exists creator_network_metrics_history_no_delete on profiles.creator_network_metrics_history;
create trigger creator_network_metrics_history_no_delete
  before delete on profiles.creator_network_metrics_history
  for each row when (current_user <> 'influx_privacy_definer')
  execute function influx.assert_append_only();

drop trigger if exists creator_network_metrics_history_no_truncate on profiles.creator_network_metrics_history;
create trigger creator_network_metrics_history_no_truncate
  before truncate on profiles.creator_network_metrics_history
  for each statement execute function influx.assert_append_only();

-- 7. The identity row of every new storefront (EC-L2D-04-5) ---------------------------------------

create or replace function profiles.provision_creator_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into profiles.creator_identities (account_id) values (new.account_id);
  return null;
end
$$;

comment on function profiles.provision_creator_identity() is
  'AFTER INSERT on profiles.creator_public_profiles: the empty identity row of the new storefront '
  '(modele.md §0217). SECURITY INVOKER, empty search_path: at sign-up it runs as '
  'influx_identity_definer (identity.provision_account), under its INSERT (account_id) and policy.';

revoke all on function profiles.provision_creator_identity()
  from public, anon, authenticated, service_role;

drop trigger if exists creator_public_profiles_provision_identity on profiles.creator_public_profiles;
create trigger creator_public_profiles_provision_identity
  after insert on profiles.creator_public_profiles
  for each row execute function profiles.provision_creator_identity();

-- 8. Row level security and the rights of the business roles ----------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'creator_identities', 'creator_social_accounts', 'creator_audience_countries',
    'creator_audience_ages', 'creator_audience_genders', 'creator_refused_sectors',
    'creator_network_metrics_history']
  loop
    execute format('alter table profiles.%I enable row level security', t);
    execute format('alter table profiles.%I force row level security', t);
    execute format('revoke all on profiles.%I from public, anon, authenticated, service_role', t);
    -- NON REVERSIBLE (header, 04 §11.3, P5): never a right of the advertiser role
    execute format('revoke all on profiles.%I from influx_advertiser', t);
    execute format('grant select on profiles.%I to influx_agent, influx_admin', t);
    execute format('drop policy if exists %I on profiles.%I', t || '_internal_select', t);
    execute format('create policy %I on profiles.%I for select to influx_agent, influx_admin '
                   'using ((select influx.has_aal2()))',
                   t || '_internal_select', t);
  end loop;
end
$$;

revoke all on sequence profiles.creator_network_metrics_history_id_seq
  from public, anon, authenticated, service_role, influx_advertiser;

-- 8.1 The owner: one policy FOR ALL per table (04 §6.2 (c)), the column grants say what he does ------

do $$
declare
  t text;
begin
  foreach t in array array[
    'creator_identities', 'creator_social_accounts', 'creator_audience_countries',
    'creator_audience_ages', 'creator_audience_genders', 'creator_refused_sectors']
  loop
    execute format('drop policy if exists %I on profiles.%I', t || '_owner_all', t);
    execute format('create policy %I on profiles.%I for all to influx_creator '
                   'using (account_id = (select influx.current_account_id())) '
                   'with check (account_id = (select influx.current_account_id()))',
                   t || '_owner_all', t);
  end loop;
end
$$;

-- identity: read, and the nine entered columns; never inserted nor deleted by him
grant select on profiles.creator_identities to influx_creator;
grant update (legal_first_name, legal_last_name, contact_email, contact_phone, address_line,
              postal_code, city, country_code, completeness_percent)
   on profiles.creator_identities to influx_creator;

-- network lines: declared, corrected, removed; never the source, the date nor the network of an
-- existing line (EC-L2D-04-1)
grant select, delete on profiles.creator_social_accounts to influx_creator;
grant insert (account_id, network_code, is_primary, handle, pseudonym, profile_url, followers_count,
              posts_last_30_days, avg_comments_per_post, avg_reach_per_post, engagement_rate_bp)
   on profiles.creator_social_accounts to influx_creator;
grant update (is_primary, handle, pseudonym, profile_url, followers_count, posts_last_30_days,
              avg_comments_per_post, avg_reach_per_post, engagement_rate_bp)
   on profiles.creator_social_accounts to influx_creator;

-- the exact audience and the refused sectors: a list is replaced, never updated
grant select, delete on profiles.creator_audience_countries, profiles.creator_audience_ages,
                        profiles.creator_audience_genders, profiles.creator_refused_sectors
   to influx_creator;
grant insert (social_account_id, account_id, slot, country_code, share_percent)
   on profiles.creator_audience_countries to influx_creator;
grant insert (social_account_id, account_id, age_band_code, share_percent)
   on profiles.creator_audience_ages to influx_creator;
grant insert (social_account_id, account_id, gender_code, share_percent)
   on profiles.creator_audience_genders to influx_creator;
grant insert (account_id, sector_code)
   on profiles.creator_refused_sectors to influx_creator;

-- the history: nothing for a member (RG119); its writer arrives with 0218

-- 8.2 influx_identity_definer: the identity row of a creator account (§7) ---------------------------

grant insert (account_id) on profiles.creator_identities to influx_identity_definer;

drop policy if exists creator_identities_identity_definer_insert on profiles.creator_identities;
create policy creator_identities_identity_definer_insert on profiles.creator_identities
  for insert to influx_identity_definer
  with check (
    exists (select 1 from identity.account_roles r
             where r.account_id = creator_identities.account_id and r.role = 'creator'));

-- 8.3 reference.network_url_hosts: as 0201 -----------------------------------------------------------

alter table reference.network_url_hosts enable row level security;
alter table reference.network_url_hosts force row level security;
revoke all on reference.network_url_hosts from public, anon, authenticated, service_role;
grant select on reference.network_url_hosts
   to influx_advertiser, influx_creator, influx_agent, influx_admin;

drop policy if exists network_url_hosts_read_members on reference.network_url_hosts;
create policy network_url_hosts_read_members on reference.network_url_hosts
  for select to influx_advertiser, influx_creator
  using ((select influx.current_account_id()) is not null);

drop policy if exists network_url_hosts_read_internal on reference.network_url_hosts;
create policy network_url_hosts_read_internal on reference.network_url_hosts
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 9. Reprise: the identity row of every storefront of 0216 ---------------------------------------
-- <reprise> (replayed as is by db-tests/profiles-creator-identity.test.ts)
insert into profiles.creator_identities (account_id)
select p.account_id
  from profiles.creator_public_profiles p
 where not exists (select 1 from profiles.creator_identities i where i.account_id = p.account_id)
 order by p.account_id
on conflict (account_id) do nothing;
-- </reprise>

-- 10. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  v_bad text;
begin
  if (select count(*) from reference.network_url_hosts) <> 14 then
    raise exception 'reference.network_url_hosts does not hold the fourteen hosts of modele.md';
  end if;

  -- RLS enabled and forced on the eight tables
  select string_agg(n.nspname || '.' || c.relname, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where (n.nspname, c.relname) in (
           ('profiles', 'creator_identities'), ('profiles', 'creator_social_accounts'),
           ('profiles', 'creator_audience_countries'), ('profiles', 'creator_audience_ages'),
           ('profiles', 'creator_audience_genders'), ('profiles', 'creator_refused_sectors'),
           ('profiles', 'creator_network_metrics_history'), ('reference', 'network_url_hosts'))
     and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not enabled and forced on: %', v_bad;
  end if;

  -- NON REVERSIBLE (04 §11.3, P5, EC-L2D-1): influx_advertiser holds no right at all on any creator
  -- object, guarded by name: tables, views, sequences, functions, and no policy names him
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
   where n.nspname = 'profiles' and p.proname like '%creator%'
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

  -- fiche invariant 7, RG50: no member nor internal role writes the source, the date, the key or
  -- the account of a line; nobody writes the history yet; the creator never inserts his identity
  select string_agg(r.rolname || '.' || t.tab || '.' || t.col || '.' || t.priv, ', ') into v_bad
    from pg_catalog.pg_roles r,
         (values ('creator_social_accounts', 'figures_source', 'INSERT'),
                 ('creator_social_accounts', 'figures_source', 'UPDATE'),
                 ('creator_social_accounts', 'figures_measured_at', 'INSERT'),
                 ('creator_social_accounts', 'figures_measured_at', 'UPDATE'),
                 ('creator_social_accounts', 'id', 'INSERT'),
                 ('creator_social_accounts', 'id', 'UPDATE'),
                 ('creator_social_accounts', 'account_id', 'UPDATE'),
                 ('creator_social_accounts', 'network_code', 'UPDATE'),
                 ('creator_identities', 'account_id', 'INSERT'),
                 ('creator_identities', 'account_id', 'UPDATE'),
                 ('creator_network_metrics_history', 'account_id', 'INSERT'),
                 ('creator_network_metrics_history', 'account_id', 'UPDATE')) as t (tab, col, priv)
   where r.rolname in ('influx_creator', 'influx_advertiser', 'influx_agent', 'influx_admin',
                       'influx_auth', 'influx_worker', 'influx_ops', 'influx_privacy')
     and pg_catalog.has_column_privilege(r.oid, 'profiles.' || t.tab, t.col, t.priv);
  if v_bad is not null then
    raise exception 'unexpected write right(s): %', v_bad;
  end if;

  -- every storefront holds its identity row
  select string_agg(p.account_id::text, ', ') into v_bad
    from profiles.creator_public_profiles p
   where not exists (select 1 from profiles.creator_identities i where i.account_id = p.account_id);
  if v_bad is not null then
    raise exception 'storefront(s) without an identity row: %', v_bad;
  end if;
end
$$;
