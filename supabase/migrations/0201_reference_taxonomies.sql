-- =============================================================================
-- 0201_reference_taxonomies
-- -----------------------------------------------------------------------------
-- Lot 2 / L2A, commit 09. The fourteen closed lists of the Lot 2 (04 §4.2, §11.2 line 0201,
-- §12.12 points 3 and 4): topics, networks, formats, sectors, usage_rights, audience_bands,
-- engagement_bands, age_bands, audience_genders, editorial_tones, publication_frequencies,
-- comment_bands, regions, price_bands.
--
-- Values: jalons/l2a/referentiels.md (L2A-08 arbitration, the only source), D79 point (10)
-- (audience and engagement bands), 07 RG114 (publication frequencies) and RG115 (comment bands),
-- 04 §4.2 (age bands from 18, D15; audience genders as bands, never a percentage).
-- Reference data is SCHEMA, loaded here, never by supabase/seed (04 §11.1 rule 6). Codes only:
-- labels live in the translation files (R8), `label_key` = `<table in the singular>.<code>`.
--
-- Common shape: `code` (English snake_case, or the full ISO 3166-2 code for a region), `label_key`,
-- `introduced_at`, `retired_at` (a served code is never renamed nor reused: it is retired, and a
-- new one is introduced by a reviewed migration, 04 §3.1), `created_at`, `updated_at`. A code is
-- active while `retired_at` is null; regions carry no separate `is_active` (EC-L2A-09-1: one
-- source of the state, the same as the other lists).
-- Bands: integer bounds, upper bound included, contiguous, no overlap, the last one open (null);
-- engagement in basis points (350 = 3.50 percent points), never a float.
--
-- reference.price_bands: created with its net bounds, their three constraints and the REVOKE of
-- 04 §4.2 as written there, and NO ROW (L2A fiche, founder answer 2; D78): rows, currencies and
-- the reach of D78 on budgets are decided when L2B is prepared. No execution role writes any of
-- these lists (T16.4 extended to price_bands).
--
-- Access, as 0003 lines 265-308: SELECT to the four business roles; members need a transaction
-- context, agent and admin need aal2 (03 §6.2, 18 T2.5); RLS enabled and forced; nothing else.
--
-- ROLLBACK (before 0202, whose tables reference these lists):
--   drop table reference.price_bands, reference.regions, reference.comment_bands,
--     reference.publication_frequencies, reference.editorial_tones, reference.audience_genders,
--     reference.age_bands, reference.engagement_bands, reference.audience_bands,
--     reference.usage_rights, reference.sectors, reference.formats, reference.networks,
--     reference.topics;
-- =============================================================================

-- 1. Tables ---------------------------------------------------------------------

create table if not exists reference.topics (
  code           text        not null primary key,
  parent_code    text        references reference.topics (code),
  label_key      text        not null,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint topics_code_format  check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint topics_label_key    check (label_key = 'topic.' || code),
  constraint topics_parent_other check (parent_code is distinct from code),
  constraint topics_retired      check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.topics is
  'Content topics of creators, brands and campaigns (06 RG27, F1, F2): one list for all. Coarse '
  'by design at launch (k-anonymity at 30 profiles, D38); refined later through parent_code, '
  'never by renaming a served code.';
comment on column reference.topics.parent_code is
  'Parent topic, null at launch (no sub-topic). Lets a later migration refine a topic without '
  'renaming it.';

create table if not exists reference.networks (
  code                      text        not null primary key,
  label_key                 text        not null,
  supports_ownership_proof  boolean     not null,
  introduced_at             timestamptz not null default now(),
  retired_at                timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint networks_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint networks_label_key   check (label_key = 'network.' || code),
  constraint networks_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.networks is
  'Social networks a creator may declare (F3, 07 block 3). A network outside the list cannot be '
  'declared (08 RG16, RG32).';
comment on column reference.networks.supports_ownership_proof is
  'The network lets an agent check account ownership (08 RG26, D52). True for the ten networks '
  'of launch; to be observed on a real account before production.';

create table if not exists reference.formats (
  code           text        not null primary key,
  network_code   text        references reference.networks (code),
  label_key      text        not null,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint formats_code_format    check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint formats_label_key      check (label_key = 'format.' || code),
  -- the network is the prefix of the code
  constraint formats_network_prefix check (network_code is null
                                           or starts_with(code, network_code || '_')),
  constraint formats_retired        check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.formats is
  'Content formats a brand buys on its own (F11, F12, 07 RG64, 09 RG36), prefixed by their network.';
comment on column reference.formats.network_code is
  'Network of the format; null for the UGC formats, delivered to the brand and published by no '
  'network (09 RG18).';

create table if not exists reference.sectors (
  code           text        not null primary key,
  label_key      text        not null,
  is_sensitive   boolean     not null,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint sectors_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint sectors_label_key   check (label_key = 'sector.' || code),
  constraint sectors_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.sectors is
  'Business sectors of brands, campaigns and creator exclusions (06 RG15, 07 RG75, 09 RG25).';
comment on column reference.sectors.is_sensitive is
  'Reinforced review sector: exactly the seven of 09 RG84. Another one enters only by amending '
  'RG84 (09 Q6).';

create table if not exists reference.usage_rights (
  code           text        not null primary key,
  label_key      text        not null,
  sort_order     smallint    not null unique,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint usage_rights_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint usage_rights_label_key   check (label_key = 'usage_right.' || code),
  constraint usage_rights_sort_order  check (sort_order >= 1),
  constraint usage_rights_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.usage_rights is
  'Usage rights granted on a content (F14, 09 RG38).';
comment on column reference.usage_rights.sort_order is
  'Display order, by increasing reach (09 RG38).';

create table if not exists reference.audience_bands (
  code           text        not null primary key,
  label_key      text        not null,
  min_followers  bigint      not null,
  max_followers  bigint,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint audience_bands_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint audience_bands_label_key   check (label_key = 'audience_band.' || code),
  constraint audience_bands_bounds      check (min_followers >= 0
                                               and (max_followers is null or max_followers >= min_followers)),
  constraint audience_bands_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.audience_bands is
  'Audience size bands (D79 point 10, F4), the same for creators, search and campaigns (08 Q10). '
  'Also the reference of average reach bands (04 §5.2). Bounds included, the last one open.';

create table if not exists reference.engagement_bands (
  code           text        not null primary key,
  label_key      text        not null,
  min_rate_bp    integer     not null,
  max_rate_bp    integer,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint engagement_bands_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint engagement_bands_label_key   check (label_key = 'engagement_band.' || code),
  constraint engagement_bands_bounds      check (min_rate_bp >= 0
                                                 and (max_rate_bp is null or max_rate_bp >= min_rate_bp)),
  constraint engagement_bands_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.engagement_bands is
  'Engagement bands (D79 point 10, F5), bounds in whole basis points (300 = 3.00 percent points), '
  'never a float. Bounds included, the last one open.';

create table if not exists reference.age_bands (
  code           text        not null primary key,
  label_key      text        not null,
  min_age        smallint    not null,
  max_age        smallint,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint age_bands_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint age_bands_label_key   check (label_key = 'age_band.' || code),
  -- D15: no minor band can be modelled
  constraint age_bands_adult_only  check (min_age >= 18),
  constraint age_bands_bounds      check (max_age is null or max_age >= min_age),
  constraint age_bands_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.age_bands is
  'Audience age bands (F10). min_age >= 18: no minor band exists (D15).';

create table if not exists reference.audience_genders (
  code           text        not null primary key,
  label_key      text        not null,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint audience_genders_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint audience_genders_label_key   check (label_key = 'audience_gender.' || code),
  constraint audience_genders_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.audience_genders is
  'Audience gender split as bands, never a percentage (F9, 04 §4.2). The majority threshold is a '
  'label and a derivation of L2B, not a bound stored here.';

create table if not exists reference.editorial_tones (
  code           text        not null primary key,
  label_key      text        not null,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint editorial_tones_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint editorial_tones_label_key   check (label_key = 'editorial_tone.' || code),
  constraint editorial_tones_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.editorial_tones is
  'The seven editorial tones of 07 RG34 (F22).';

create table if not exists reference.publication_frequencies (
  code           text        not null primary key,
  label_key      text        not null,
  min_posts_30d  smallint    not null,
  max_posts_30d  smallint,
  sort_order     smallint    not null unique,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint publication_frequencies_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint publication_frequencies_label_key   check (label_key = 'publication_frequency.' || code),
  constraint publication_frequencies_bounds      check (min_posts_30d >= 0
                                                        and (max_posts_30d is null or max_posts_30d >= min_posts_30d)),
  constraint publication_frequencies_sort_order  check (sort_order >= 1),
  constraint publication_frequencies_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.publication_frequencies is
  'Publication rhythm derived from the number of permanent posts of the last 30 days (07 RG114, '
  'F24, 04 §12.12 point 3); never chosen by the creator. Bounds included, the last one open.';
comment on column reference.publication_frequencies.sort_order is
  'Display order, from the most frequent (1) to the least frequent.';

create table if not exists reference.comment_bands (
  code           text        not null primary key,
  label_key      text        not null,
  min_comments   bigint      not null,
  max_comments   bigint,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint comment_bands_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint comment_bands_label_key   check (label_key = 'comment_band.' || code),
  constraint comment_bands_bounds      check (min_comments >= 0
                                              and (max_comments is null or max_comments >= min_comments)),
  constraint comment_bands_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.comment_bands is
  'Average comments per post over the last 12 permanent posts, contests excluded (07 RG115, F25, '
  '04 §12.12 point 4). Bounds included, the last one open.';

create table if not exists reference.regions (
  country_code   char(2)     not null references reference.countries (code),
  code           text        not null,
  label_key      text        not null,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (country_code, code),
  -- full ISO 3166-2 code, its country as prefix
  constraint regions_code_format check (code ~ '^[A-Z]{2}-[A-Z0-9]{1,3}$'
                                        and left(code, 2) = country_code),
  constraint regions_label_key   check (label_key = 'region.' || code),
  constraint regions_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.regions is
  'First-level subdivisions (ISO 3166-2), loaded country by country on demand (07 RG37, 10 G9): '
  'FR (metropolitan France), GB, US, CA and AU at launch. Overseas territories are countries of '
  'their own in ISO 3166-1. A country without region shows no region field.';

create table if not exists reference.price_bands (
  currency          char(3)     not null references reference.currencies (code),
  code              text        not null,
  label_key         text        not null,
  min_amount_minor  bigint      not null,
  max_amount_minor  bigint,
  primary key (currency, code),
  constraint price_bands_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint price_bands_label_key   check (label_key = 'price_band.' || code),
  constraint price_bands_bounds      check (min_amount_minor >= 0
                                            and (max_amount_minor is null
                                                 or max_amount_minor >= min_amount_minor)),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 04 §4.2, as written there
alter table reference.price_bands
  add column if not exists net_min_amount_minor bigint,
  add column if not exists net_max_amount_minor bigint,
  add column if not exists net_basis_label      text,
  add column if not exists net_computed_at      timestamptz,
  add column if not exists introduced_at        timestamptz not null default now(),
  add column if not exists retired_at           timestamptz;

alter table reference.price_bands
  drop constraint if exists price_bands_net_pair,
  drop constraint if exists price_bands_net_within_gross,
  drop constraint if exists price_bands_net_needs_basis,
  drop constraint if exists price_bands_retired,

  -- both net bounds go together, or none
  add constraint price_bands_net_pair
      check (num_nonnulls(net_min_amount_minor, net_max_amount_minor) in (0, 2)),
  -- a net never exceeds the gross, and never goes below zero
  add constraint price_bands_net_within_gross
      check (net_min_amount_minor is null
             or (net_min_amount_minor >= 0
                 and net_max_amount_minor >= net_min_amount_minor
                 and net_min_amount_minor <= min_amount_minor
                 and (max_amount_minor is null or net_max_amount_minor <= max_amount_minor))),
  -- a net without a written basis is not enforceable
  add constraint price_bands_net_needs_basis
      check (net_min_amount_minor is null
             or (net_basis_label is not null and net_computed_at is not null)),
  add constraint price_bands_retired
      check (retired_at is null or retired_at >= introduced_at);

comment on table reference.price_bands is
  'Price bands, each tied to a currency (04 §4.2). EMPTY at L2A (D78, L2A founder answer 2): rows '
  'and currencies are decided when L2B is prepared. Written by a reviewed migration only.';
comment on column reference.price_bands.net_min_amount_minor is
  'Lower bound of the creator net for this band, in the minor unit. DATA VALUE, COMPUTED OUTSIDE '
  'THE APPLICATION, WRITTEN BY A REVIEWED MIGRATION. The code never recomputes it and never '
  'multiplies an amount by a rate (03 C(32), T16). Null = no net shown for this currency '
  '(09 RG59, edge case): never estimated on the fly.';
comment on column reference.price_bands.net_basis_label is
  'Written basis of the computation, plain text the code never uses: for review and audit only, '
  'never for a computation.';

-- 2. updated_at -------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'topics', 'networks', 'formats', 'sectors', 'usage_rights', 'audience_bands',
    'engagement_bands', 'age_bands', 'audience_genders', 'editorial_tones',
    'publication_frequencies', 'comment_bands', 'regions', 'price_bands']
  loop
    execute format('drop trigger if exists %I on reference.%I', t || '_touch_updated_at', t);
    execute format('create trigger %I before update on reference.%I '
                   'for each row execute function influx.touch_updated_at()',
                   t || '_touch_updated_at', t);
  end loop;
end
$$;

-- 3. Data (jalons/l2a/referentiels.md; D79 (10); 07 RG114, RG115; 04 §4.2) ------------------

insert into reference.topics (code, label_key) values
  ('beauty',           'topic.beauty'),
  ('fashion',          'topic.fashion'),
  ('food',             'topic.food'),
  ('travel',           'topic.travel'),
  ('sport_fitness',    'topic.sport_fitness'),
  ('wellness',         'topic.wellness'),
  ('family',           'topic.family'),
  ('home',             'topic.home'),
  ('gaming',           'topic.gaming'),
  ('tech',             'topic.tech'),
  ('entertainment',    'topic.entertainment'),
  ('music',            'topic.music'),
  ('culture',          'topic.culture'),
  ('education',        'topic.education'),
  ('business_finance', 'topic.business_finance'),
  ('automotive',       'topic.automotive'),
  ('pets',             'topic.pets')
on conflict (code) do nothing;

insert into reference.networks (code, label_key, supports_ownership_proof) values
  ('instagram', 'network.instagram', true),
  ('tiktok',    'network.tiktok',    true),
  ('youtube',   'network.youtube',   true),
  ('facebook',  'network.facebook',  true),
  ('linkedin',  'network.linkedin',  true),
  ('x',         'network.x',         true),
  ('snapchat',  'network.snapchat',  true),
  ('twitch',    'network.twitch',    true),
  ('pinterest', 'network.pinterest', true),
  ('threads',   'network.threads',   true)
on conflict (code) do nothing;

insert into reference.formats (code, network_code, label_key) values
  ('instagram_post',      'instagram', 'format.instagram_post'),
  ('instagram_carousel',  'instagram', 'format.instagram_carousel'),
  ('instagram_reel',      'instagram', 'format.instagram_reel'),
  ('instagram_story',     'instagram', 'format.instagram_story'),
  ('instagram_live',      'instagram', 'format.instagram_live'),
  ('tiktok_video',        'tiktok',    'format.tiktok_video'),
  ('tiktok_carousel',     'tiktok',    'format.tiktok_carousel'),
  ('tiktok_live',         'tiktok',    'format.tiktok_live'),
  ('youtube_video',       'youtube',   'format.youtube_video'),
  ('youtube_integration', 'youtube',   'format.youtube_integration'),
  ('youtube_short',       'youtube',   'format.youtube_short'),
  ('youtube_live',        'youtube',   'format.youtube_live'),
  ('facebook_post',       'facebook',  'format.facebook_post'),
  ('facebook_reel',       'facebook',  'format.facebook_reel'),
  ('facebook_story',      'facebook',  'format.facebook_story'),
  ('linkedin_post',       'linkedin',  'format.linkedin_post'),
  ('x_post',              'x',         'format.x_post'),
  ('threads_post',        'threads',   'format.threads_post'),
  ('snapchat_story',      'snapchat',  'format.snapchat_story'),
  ('snapchat_spotlight',  'snapchat',  'format.snapchat_spotlight'),
  ('twitch_live',         'twitch',    'format.twitch_live'),
  ('pinterest_pin',       'pinterest', 'format.pinterest_pin'),
  ('ugc_video',           null,        'format.ugc_video'),
  ('ugc_photo',           null,        'format.ugc_photo')
on conflict (code) do nothing;

insert into reference.sectors (code, label_key, is_sensitive) values
  ('alcohol',                 'sector.alcohol',                 true),
  ('gambling',                'sector.gambling',                true),
  ('cbd',                     'sector.cbd',                     true),
  ('finance',                 'sector.finance',                 true),
  ('health',                  'sector.health',                  true),
  ('crypto',                  'sector.crypto',                  true),
  ('adult',                   'sector.adult',                   true),
  ('beauty_personal_care',    'sector.beauty_personal_care',    false),
  ('fashion_accessories',     'sector.fashion_accessories',     false),
  ('food_beverages',          'sector.food_beverages',          false),
  ('restaurants_hospitality', 'sector.restaurants_hospitality', false),
  ('travel_tourism',          'sector.travel_tourism',          false),
  ('sports_leisure',          'sector.sports_leisure',          false),
  ('home_garden',             'sector.home_garden',             false),
  ('consumer_electronics',    'sector.consumer_electronics',    false),
  ('software_telecom',        'sector.software_telecom',        false),
  ('video_games',             'sector.video_games',             false),
  ('automotive_mobility',     'sector.automotive_mobility',     false),
  ('media_entertainment',     'sector.media_entertainment',     false),
  ('education_training',      'sector.education_training',      false),
  ('baby_kids',               'sector.baby_kids',               false),
  ('pet_care',                'sector.pet_care',                false),
  ('retail_ecommerce',        'sector.retail_ecommerce',        false),
  ('real_estate',             'sector.real_estate',             false),
  ('business_services',       'sector.business_services',       false),
  ('nonprofit_public',        'sector.nonprofit_public',        false)
on conflict (code) do nothing;

insert into reference.usage_rights (code, label_key, sort_order) values
  ('none',             'usage_right.none',             1),
  ('organic_repost',   'usage_right.organic_repost',   2),
  ('paid_whitelisting','usage_right.paid_whitelisting',3),
  ('media_buy',        'usage_right.media_buy',        4)
on conflict (code) do nothing;

insert into reference.audience_bands (code, label_key, min_followers, max_followers) values
  ('nano',  'audience_band.nano',        0,    9999),
  ('micro', 'audience_band.micro',   10000,   49999),
  ('mid',   'audience_band.mid',     50000,  499999),
  ('macro', 'audience_band.macro',  500000,  999999),
  ('mega',  'audience_band.mega',  1000000,    null)
on conflict (code) do nothing;

insert into reference.engagement_bands (code, label_key, min_rate_bp, max_rate_bp) values
  ('under_1', 'engagement_band.under_1',   0,   99),
  ('1_3',     'engagement_band.1_3',     100,  299),
  ('3_6',     'engagement_band.3_6',     300,  599),
  ('6_plus',  'engagement_band.6_plus',  600, null)
on conflict (code) do nothing;

insert into reference.age_bands (code, label_key, min_age, max_age) values
  ('18_24',   'age_band.18_24',   18,   24),
  ('25_34',   'age_band.25_34',   25,   34),
  ('35_44',   'age_band.35_44',   35,   44),
  ('45_plus', 'age_band.45_plus', 45, null)
on conflict (code) do nothing;

insert into reference.audience_genders (code, label_key) values
  ('female_majority', 'audience_gender.female_majority'),
  ('mixed',           'audience_gender.mixed'),
  ('male_majority',   'audience_gender.male_majority')
on conflict (code) do nothing;

insert into reference.editorial_tones (code, label_key) values
  ('educational',     'editorial_tone.educational'),
  ('humorous',        'editorial_tone.humorous'),
  ('inspiring',       'editorial_tone.inspiring'),
  ('premium',         'editorial_tone.premium'),
  ('straightforward', 'editorial_tone.straightforward'),
  ('family_friendly', 'editorial_tone.family_friendly'),
  ('expert',          'editorial_tone.expert')
on conflict (code) do nothing;

insert into reference.publication_frequencies
  (code, label_key, min_posts_30d, max_posts_30d, sort_order) values
  ('daily',            'publication_frequency.daily',            25, null, 1),
  ('several_per_week', 'publication_frequency.several_per_week',  8,   24, 2),
  ('weekly',           'publication_frequency.weekly',            4,    7, 3),
  ('biweekly',         'publication_frequency.biweekly',          2,    3, 4),
  ('monthly_or_less',  'publication_frequency.monthly_or_less',   0,    1, 5)
on conflict (code) do nothing;

insert into reference.comment_bands (code, label_key, min_comments, max_comments) values
  ('0_9',       'comment_band.0_9',          0,    9),
  ('10_49',     'comment_band.10_49',       10,   49),
  ('50_199',    'comment_band.50_199',      50,  199),
  ('200_999',   'comment_band.200_999',    200,  999),
  ('1000_plus', 'comment_band.1000_plus', 1000, null)
on conflict (code) do nothing;

-- ISO 3166-2, checked on 2026-11-01 (FR-20R: Corse, metropolitan collectivity with special
-- status, ex FR-COR since 2020-11-24). France: the thirteen metropolitan regions (EC-08-2).
insert into reference.regions (country_code, code, label_key)
select left(code, 2), code, 'region.' || code
  from unnest(array[
    'FR-ARA', 'FR-BFC', 'FR-BRE', 'FR-CVL', 'FR-GES', 'FR-HDF', 'FR-IDF', 'FR-NAQ', 'FR-NOR',
    'FR-OCC', 'FR-PAC', 'FR-PDL', 'FR-20R',
    'GB-ENG', 'GB-NIR', 'GB-SCT', 'GB-WLS',
    'US-AL', 'US-AK', 'US-AZ', 'US-AR', 'US-CA', 'US-CO', 'US-CT', 'US-DE', 'US-FL', 'US-GA',
    'US-HI', 'US-ID', 'US-IL', 'US-IN', 'US-IA', 'US-KS', 'US-KY', 'US-LA', 'US-ME', 'US-MD',
    'US-MA', 'US-MI', 'US-MN', 'US-MS', 'US-MO', 'US-MT', 'US-NE', 'US-NV', 'US-NH', 'US-NJ',
    'US-NM', 'US-NY', 'US-NC', 'US-ND', 'US-OH', 'US-OK', 'US-OR', 'US-PA', 'US-RI', 'US-SC',
    'US-SD', 'US-TN', 'US-TX', 'US-UT', 'US-VT', 'US-VA', 'US-WA', 'US-WV', 'US-WI', 'US-WY',
    'US-DC',
    'CA-AB', 'CA-BC', 'CA-MB', 'CA-NB', 'CA-NL', 'CA-NS', 'CA-NT', 'CA-NU', 'CA-ON', 'CA-PE',
    'CA-QC', 'CA-SK', 'CA-YT',
    'AU-ACT', 'AU-NSW', 'AU-NT', 'AU-QLD', 'AU-SA', 'AU-TAS', 'AU-VIC', 'AU-WA'
  ]) as r (code)
on conflict (country_code, code) do nothing;

-- reference.price_bands: no row (D78).

-- 4. Validation ---------------------------------------------------------------------

do $$
begin
  if (select count(*) from reference.topics) <> 17
     or (select count(*) from reference.networks) <> 10
     or (select count(*) from reference.formats) <> 24
     or (select count(*) from reference.sectors) <> 26
     or (select count(*) from reference.usage_rights) <> 4
     or (select count(*) from reference.audience_bands) <> 5
     or (select count(*) from reference.engagement_bands) <> 4
     or (select count(*) from reference.age_bands) <> 4
     or (select count(*) from reference.audience_genders) <> 3
     or (select count(*) from reference.editorial_tones) <> 7
     or (select count(*) from reference.publication_frequencies) <> 5
     or (select count(*) from reference.comment_bands) <> 5
     or (select count(*) from reference.regions) <> 89 then
    raise exception 'reference lists of 0201 do not hold the counts of jalons/l2a/referentiels.md';
  end if;
  if (select array_agg(code order by code) from reference.sectors where is_sensitive)
       is distinct from array['adult', 'alcohol', 'cbd', 'crypto', 'finance', 'gambling', 'health'] then
    raise exception 'sensitive sectors are exactly the seven of 09 RG84';
  end if;
  if exists (select 1 from reference.price_bands) then
    raise exception 'reference.price_bands holds no row at L2A (D78)';
  end if;
end
$$;

-- 5. Row level security and privileges ----------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'topics', 'networks', 'formats', 'sectors', 'usage_rights', 'audience_bands',
    'engagement_bands', 'age_bands', 'audience_genders', 'editorial_tones',
    'publication_frequencies', 'comment_bands', 'regions', 'price_bands']
  loop
    execute format('alter table reference.%I enable row level security', t);
    execute format('alter table reference.%I force row level security', t);
    execute format('revoke all on reference.%I from public, anon, authenticated, service_role', t);
    execute format('grant select on reference.%I '
                   'to influx_advertiser, influx_creator, influx_agent, influx_admin', t);

    execute format('drop policy if exists %I on reference.%I', t || '_read_members', t);
    execute format('create policy %I on reference.%I for select to influx_advertiser, influx_creator '
                   'using ((select influx.current_account_id()) is not null)',
                   t || '_read_members', t);

    execute format('drop policy if exists %I on reference.%I', t || '_read_internal', t);
    execute format('create policy %I on reference.%I for select to influx_agent, influx_admin '
                   'using ((select influx.has_aal2()))',
                   t || '_read_internal', t);
  end loop;
end
$$;

-- 04 §4.2: the same regime as billing.commission_rates, nobody writes this list from the
-- application (already true without any grant; written down so that no later grant slips in
-- unnoticed by a reviewer)
revoke insert, update, delete on reference.price_bands
  from influx_advertiser, influx_creator, influx_agent, influx_admin, influx_auth, influx_worker;
