-- =============================================================================
-- 0202_profiles_advertiser_full
-- -----------------------------------------------------------------------------
-- Lot 2 / L2B, commit 05. The full brand profile of 06 blocks 1 to 3 (04 §5.2, §11.2 line 0202):
-- the ADDITIVE extension announced by 0106, every new column nullable, no data to move.
--
-- 1. profiles.advertiser_profiles + the public fields of 06 RG15 and RG27: main sector (foreign
--    key to reference.sectors), company size band, website domain (RG17: a domain only, lower
--    case), presentation (at most 1 000 characters), usual exclusivity, collaboration rhythm,
--    non-monetary consideration, the ROLE of the contact person (public, RG35, EC-L2B-4) and the
--    stored completeness score (computed by packages/domain, never here). legal_name (0106) stays
--    the trading name, written by identity.update_own_account() only (0122; EC-L2B-2, EC-L2B-3);
--    country and language are read from the account (CA2); NO budget column (founder answer A
--    of L2B, D48, D78: the field is suspended and arrives with its bands).
-- 2. Eight list tables, one row per choice, each code a foreign key to its reference list:
--    secondary sectors (2 at most), target markets (5), working languages (fr, en), topics (3),
--    networks, formats, audience countries (5), usage rights (`none` refused, L2-amend). A cap
--    is held by the column `slot` (1 to the cap, in the primary key): declarative, and two
--    concurrent writers meet a key violation, never a sixth market. The minimums of RG15 and
--    RG27 (one topic, one language...) are submission rules (0203), not write rules: a draft
--    keeps whatever was entered (RG83).
-- 3. profiles.advertiser_contact_details: first name (40 characters, masked layer), professional
--    e-mail, phone (+ then 7 to 15 digits, no rule per country), contact page (https://): the
--    masked and internal layers of RG35. The owner reads and writes it; agent and admin read it
--    in aal2 (RG37); influx_creator holds NOTHING on it (D40, D46): the e-mail, the phone and the
--    page never, the first name at Lot 4 only, after a reveal (03 C(9)).
-- 4. Member writes: column grants and owner policies (WITH CHECK); status and legal_name out of
--    reach (0203 for the first, 0122 for the second). Agent and admin only read at L2B (their
--    corrections, 03 C(7), come with the review of L2C).
-- 5. Rights of the data subject (04 §9.2): privacy.export_document() and privacy.execute_request()
--    recreated by their owner influx_privacy_definer. Export: the category advertiser_profile
--    carries the whole profile, its lists and its contact person (still 14 categories). Erasure:
--    the profile columns emptied (the legal name [deleted], as in 0137), the list rows deleted,
--    the contact details emptied (row kept, columns NULL). The logo comes with its own table and
--    purge (0204; D80, jalons/l2b/stockage.md §5 and §7): no logo_path column here.
--
-- EC-L2B-05 (micro-gaps, the safest choice):
--   EC-L2B-05-1  codes of the closed lists 06 names in French only, English snake_case as in
--                jalons/l2a/referentiels.md: company size 1_10, 11_50, 51_250, 251_1000,
--                1001_plus; contact role executive, marketing, partnerships_influence,
--                communication, ecommerce, procurement, mandated_agency; rhythm one_off,
--                recurring, ambassador; exclusivity the bands of 04 §5.2 (none, le_1m, le_3m,
--                negotiable: one vocabulary with creators and campaigns, 09 RG42).
--   EC-L2B-05-2  column names: presentation (04 §5.2 says description; 06 and packages/domain say
--                presentation), primary_sector_code, company_size_band; contact_role on
--                advertiser_profiles (EC-L2B-4).
--   EC-L2B-05-3  free texts: a presentation and a first name hold one visible character at least;
--                line breaks in the presentation only, no other control character. The contact
--                page: 500 characters at most, a host with a dot, no credentials.
--   EC-L2B-05-4  a retired reference code stays valid in a row (referentiels.md: "gardé, plus
--                proposé"); offering active codes only is the API's (L2B-07), as is dropping a
--                secondary sector equal to the main one (no invariant, no trigger).
--   EC-L2B-05-5  the website domain may hold letters of any script (an IDN as typed, the shape of
--                normalizeWebsiteDomain in packages/domain); its last label is not numeric (no
--                IPv4 address) and has two characters at least.
--   EC-L2B-05-6  erasure: every column the brand entered is emptied, not only the contact details
--                of 04 §9.2 (a presentation or a domain may name a sole trader, 06 RG21); the
--                policy of influx_privacy_definer accepts nothing else.
--
-- ROLLBACK (before any profile holds these fields): recreate privacy.export_document() as in 0137
-- and privacy.execute_request() as in 0150 (as influx_privacy_definer) and the policy
-- advertiser_profiles_privacy_definer_erase as in 0137; revoke the column grants of this file on
-- profiles.advertiser_profiles and drop policy advertiser_profiles_member_update_own; drop table
-- profiles.advertiser_contact_details, profiles.advertiser_usage_rights,
-- profiles.advertiser_audience_countries, profiles.advertiser_formats,
-- profiles.advertiser_networks, profiles.advertiser_topics, profiles.advertiser_working_languages,
-- profiles.advertiser_target_markets, profiles.advertiser_secondary_sectors; alter table
-- profiles.advertiser_profiles drop the nine columns added below (their constraints go with them).
-- =============================================================================

-- 1. profiles.advertiser_profiles: the public fields of blocks 1 to 3 ----------------------------

alter table profiles.advertiser_profiles
  add column if not exists primary_sector_code   text references reference.sectors (code),
  add column if not exists company_size_band     text,
  add column if not exists website_domain        text,
  add column if not exists presentation          text,
  add column if not exists exclusivity_band      text,
  add column if not exists collaboration_rhythm  text,
  add column if not exists offers_non_monetary   boolean,
  add column if not exists contact_role          text,
  add column if not exists completeness_percent  smallint;

alter table profiles.advertiser_profiles
  drop constraint if exists advertiser_profiles_company_size_band,
  drop constraint if exists advertiser_profiles_website_domain_length,
  drop constraint if exists advertiser_profiles_website_domain_lower,
  drop constraint if exists advertiser_profiles_website_domain_shape,
  drop constraint if exists advertiser_profiles_presentation_length,
  drop constraint if exists advertiser_profiles_presentation_not_blank,
  drop constraint if exists advertiser_profiles_presentation_printable,
  drop constraint if exists advertiser_profiles_exclusivity_band,
  drop constraint if exists advertiser_profiles_collaboration_rhythm,
  drop constraint if exists advertiser_profiles_contact_role,
  drop constraint if exists advertiser_profiles_completeness_percent,

  -- RG15, RG22: a band, never a headcount (EC-L2B-05-1)
  add constraint advertiser_profiles_company_size_band
      check (company_size_band in ('1_10', '11_50', '51_250', '251_1000', '1001_plus')),
  -- RG15, RG17: a domain only, as packages/domain reduces it (EC-L2B-05-5)
  add constraint advertiser_profiles_website_domain_length
      check (char_length(website_domain) <= 100),
  add constraint advertiser_profiles_website_domain_lower
      check (website_domain = lower(website_domain)),
  add constraint advertiser_profiles_website_domain_shape
      check (website_domain ~ '^([[:alnum:]]([[:alnum:]-]{0,61}[[:alnum:]])?\.)+[[:alnum:]][[:alnum:]-]{0,61}[[:alnum:]]$'
             and website_domain !~ '\.[0-9]+$'),
  -- RG15: 1 000 characters at most; the minimum of 120 is a submission rule (0203, RG5)
  add constraint advertiser_profiles_presentation_length
      check (char_length(presentation) <= 1000),
  add constraint advertiser_profiles_presentation_not_blank
      check (presentation ~ '[^[:space:]]'),
  -- line breaks and tabs kept, any other control character refused (EC-L2B-05-3)
  add constraint advertiser_profiles_presentation_printable
      check (presentation !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F\u0080-\u009F]'),
  -- RG27: the bands of 04 §5.2, shared with creators and campaigns (09 RG42)
  add constraint advertiser_profiles_exclusivity_band
      check (exclusivity_band in ('none', 'le_1m', 'le_3m', 'negotiable')),
  add constraint advertiser_profiles_collaboration_rhythm
      check (collaboration_rhythm in ('one_off', 'recurring', 'ambassador')),
  -- RG35: the closed list of roles, public (RG36)
  add constraint advertiser_profiles_contact_role
      check (contact_role in ('executive', 'marketing', 'partnerships_influence', 'communication',
                              'ecommerce', 'procurement', 'mandated_agency')),
  -- RG57: an integer from 0 to 100, stored as packages/domain computed it
  add constraint advertiser_profiles_completeness_percent
      check (completeness_percent between 0 and 100);

comment on table profiles.advertiser_profiles is
  'Brand profile (04 §5.2; 06 blocks 1 to 3): the MINIMAL form of Lot 1 (0106) extended at L2B '
  '(0202) by nullable columns. A brand is not anonymous (D40): its contact person is; the first '
  'name and the coordinates live in advertiser_contact_details, the multiple choices in the '
  'advertiser_* list tables. Status changes belong to 0203; the logo to 0204.';
comment on column profiles.advertiser_profiles.primary_sector_code is
  'Main sector (06 RG15), public; secondary sectors in advertiser_secondary_sectors.';
comment on column profiles.advertiser_profiles.company_size_band is
  'Company size as a band (06 RG15, RG22): 1_10, 11_50, 51_250, 251_1000, 1001_plus. Never a '
  'headcount.';
comment on column profiles.advertiser_profiles.website_domain is
  'Website as a domain only (06 RG17), lower case, reduced by packages/domain before saving; a '
  'contact page belongs to advertiser_contact_details.contact_url (internal).';
comment on column profiles.advertiser_profiles.presentation is
  'The brand''s own words (06 RG15, RG16): public once moderated, at most 1 000 characters; 120 '
  'at least to submit (0203).';
comment on column profiles.advertiser_profiles.exclusivity_band is
  'Usual exclusivity (06 RG27, F15): none, le_1m, le_3m, negotiable (09 RG42 vocabulary).';
comment on column profiles.advertiser_profiles.collaboration_rhythm is
  'Collaboration rhythm (06 RG27): one_off, recurring, ambassador.';
comment on column profiles.advertiser_profiles.offers_non_monetary is
  'Non-monetary consideration offered (06 RG27, F13): NULL until the brand answers, never a '
  'default (RG34).';
comment on column profiles.advertiser_profiles.contact_role is
  'Role of the contact person (06 RG35, RG36): PUBLIC, it names nobody (EC-L2B-4). The first name '
  'and the coordinates are in advertiser_contact_details.';
comment on column profiles.advertiser_profiles.completeness_percent is
  'Completeness score (06 RG57 to RG61) as packages/domain computed it at the last save; it opens '
  'no right (RG60) and is never recomputed by the base.';

-- 2. The list tables (06 RG15, RG27) ------------------------------------------------------------

create table if not exists profiles.advertiser_secondary_sectors (
  account_id   uuid        not null references profiles.advertiser_profiles (account_id),
  slot         smallint    not null,
  sector_code  text        not null references reference.sectors (code),
  created_at   timestamptz not null default now(),
  primary key (account_id, slot),
  constraint advertiser_secondary_sectors_once unique (account_id, sector_code),
  -- RG15: two secondary sectors at most
  constraint advertiser_secondary_sectors_slot check (slot between 1 and 2)
);

create table if not exists profiles.advertiser_target_markets (
  account_id    uuid        not null references profiles.advertiser_profiles (account_id),
  slot          smallint    not null,
  country_code  char(2)     not null references reference.countries (code),
  created_at    timestamptz not null default now(),
  primary key (account_id, slot),
  constraint advertiser_target_markets_once unique (account_id, country_code),
  -- RG15: five markets at most, from the same list as the audience of a creator (RG23)
  constraint advertiser_target_markets_slot check (slot between 1 and 5)
);

create table if not exists profiles.advertiser_working_languages (
  account_id     uuid        not null references profiles.advertiser_profiles (account_id),
  language_code  char(2)     not null references reference.languages (code),
  created_at     timestamptz not null default now(),
  primary key (account_id, language_code),
  -- RG15: the closed list of the MVP, French and English
  constraint advertiser_working_languages_closed check (language_code in ('fr', 'en'))
);

create table if not exists profiles.advertiser_topics (
  account_id  uuid        not null references profiles.advertiser_profiles (account_id),
  slot        smallint    not null,
  topic_code  text        not null references reference.topics (code),
  created_at  timestamptz not null default now(),
  primary key (account_id, slot),
  constraint advertiser_topics_once unique (account_id, topic_code),
  -- RG27: three topics at most
  constraint advertiser_topics_slot check (slot between 1 and 3)
);

create table if not exists profiles.advertiser_networks (
  account_id    uuid        not null references profiles.advertiser_profiles (account_id),
  network_code  text        not null references reference.networks (code),
  created_at    timestamptz not null default now(),
  primary key (account_id, network_code)
);

create table if not exists profiles.advertiser_formats (
  account_id   uuid        not null references profiles.advertiser_profiles (account_id),
  format_code  text        not null references reference.formats (code),
  created_at   timestamptz not null default now(),
  primary key (account_id, format_code)
);

create table if not exists profiles.advertiser_audience_countries (
  account_id    uuid        not null references profiles.advertiser_profiles (account_id),
  slot          smallint    not null,
  country_code  char(2)     not null references reference.countries (code),
  created_at    timestamptz not null default now(),
  primary key (account_id, slot),
  constraint advertiser_audience_countries_once unique (account_id, country_code),
  -- RG27: five audience countries at most
  constraint advertiser_audience_countries_slot check (slot between 1 and 5)
);

create table if not exists profiles.advertiser_usage_rights (
  account_id        uuid        not null references profiles.advertiser_profiles (account_id),
  usage_right_code  text        not null references reference.usage_rights (code),
  created_at        timestamptz not null default now(),
  primary key (account_id, usage_right_code),
  -- L2-amend (referentiels.md, amendment 4): `none` is no right and is not ticked among others
  constraint advertiser_usage_rights_not_none check (usage_right_code <> 'none')
);

comment on table profiles.advertiser_secondary_sectors is
  'Secondary sectors of a brand (06 RG15): two at most (slot 1 or 2), each once. Public.';
comment on table profiles.advertiser_target_markets is
  'Target markets of a brand (06 RG15, RG23): five countries at most (slot 1 to 5). Public.';
comment on table profiles.advertiser_working_languages is
  'Working languages of a brand (06 RG15, F8): fr and en at the MVP. Public.';
comment on table profiles.advertiser_topics is
  'Topics a brand looks for (06 RG27, F1, F2): three at most (slot 1 to 3). Public.';
comment on table profiles.advertiser_networks is
  'Networks a brand targets (06 RG27, F3). Public.';
comment on table profiles.advertiser_formats is
  'Formats a brand expects (06 RG27, F11). Public.';
comment on table profiles.advertiser_audience_countries is
  'Audience countries a brand targets (06 RG27, F6): five at most (slot 1 to 5). Public.';
comment on table profiles.advertiser_usage_rights is
  'Usage rights a brand usually asks for (06 RG27, F14). `none` is refused: no right asked is no '
  'row (referentiels.md, amendment 4).';

-- 3. profiles.advertiser_contact_details (06 RG35, D40, D46) --------------------------------------

create table if not exists profiles.advertiser_contact_details (
  account_id          uuid        not null primary key
                                  references profiles.advertiser_profiles (account_id),
  contact_first_name  text,
  contact_email       text,
  contact_phone       text,
  contact_url         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- RG35: a first name of 40 characters at most, one visible character, no control character
  constraint advertiser_contact_details_first_name_length
    check (char_length(contact_first_name) <= 40),
  constraint advertiser_contact_details_first_name_not_blank
    check (contact_first_name ~ '[^[:space:]]'),
  constraint advertiser_contact_details_first_name_printable
    check (contact_first_name !~ '[[:cntrl:]]'),
  -- RG35: an address, lower case as every address of the base (0004)
  constraint advertiser_contact_details_email_shape
    check (contact_email ~ '^[^@[:space:][:cntrl:]]+@[^@[:space:][:cntrl:]]+\.[^@[:space:][:cntrl:]]+$'),
  constraint advertiser_contact_details_email_lower
    check (contact_email = lower(contact_email)),
  constraint advertiser_contact_details_email_length
    check (char_length(contact_email) <= 320),
  -- RG35: + then 7 to 15 digits (E.164), no rule per country
  constraint advertiser_contact_details_phone_shape
    check (contact_phone ~ '^\+[0-9]{7,15}$'),
  -- RG35: an https page with a host, no credentials (EC-L2B-05-3)
  constraint advertiser_contact_details_url_https
    check (contact_url ~ '^https://[^/?#@[:space:][:cntrl:]]+\.[^/?#@[:space:][:cntrl:]]+([/?#][^[:space:][:cntrl:]]*)?$'),
  constraint advertiser_contact_details_url_length
    check (char_length(contact_url) <= 500)
);

comment on table profiles.advertiser_contact_details is
  'The contact person of a brand (06 RG35): first name (MASKED: INFLUX always, a creator after the '
  'reveal of Lot 4, 03 C(9)), e-mail, phone, contact page (INTERNAL: never a member other than the '
  'owner, D46). No right of influx_creator at L2B. Emptied by the erasure (04 §9.2).';
comment on column profiles.advertiser_contact_details.contact_email is
  'Professional address of the contact person (06 RG35; default: the sign-up address, shown by '
  'the API). Never sent to Brevo nor Apollo (RG80), never served to a creator (D46).';

drop trigger if exists advertiser_contact_details_touch_updated_at on profiles.advertiser_contact_details;
create trigger advertiser_contact_details_touch_updated_at
  before update on profiles.advertiser_contact_details
  for each row execute function influx.touch_updated_at();

-- 4. Row level security and the rights of the business roles ------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'advertiser_secondary_sectors', 'advertiser_target_markets', 'advertiser_working_languages',
    'advertiser_topics', 'advertiser_networks', 'advertiser_formats',
    'advertiser_audience_countries', 'advertiser_usage_rights', 'advertiser_contact_details']
  loop
    execute format('alter table profiles.%I enable row level security', t);
    execute format('alter table profiles.%I force row level security', t);
    execute format('revoke all on profiles.%I from public, anon, authenticated, service_role', t);
  end loop;
end
$$;

-- 4.1 The owner: the profile columns of blocks 1 to 3, never status nor legal_name ---------------

grant update (primary_sector_code, company_size_band, website_domain, presentation, exclusivity_band,
              collaboration_rhythm, offers_non_monetary, contact_role, completeness_percent)
   on profiles.advertiser_profiles to influx_advertiser;

drop policy if exists advertiser_profiles_member_update_own on profiles.advertiser_profiles;
create policy advertiser_profiles_member_update_own on profiles.advertiser_profiles
  for update to influx_advertiser
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()));

-- 4.2 The lists: the owner reads, adds and removes his own rows (a list is replaced, never
-- updated); agent and admin read them in aal2 ------------------------------------------------------

do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('advertiser_secondary_sectors',  'slot, sector_code'),
      ('advertiser_target_markets',     'slot, country_code'),
      ('advertiser_working_languages',  'language_code'),
      ('advertiser_topics',             'slot, topic_code'),
      ('advertiser_networks',           'network_code'),
      ('advertiser_formats',            'format_code'),
      ('advertiser_audience_countries', 'slot, country_code'),
      ('advertiser_usage_rights',       'usage_right_code')
    ) as v (name, columns)
  loop
    execute format('grant select, delete on profiles.%I to influx_advertiser', l.name);
    execute format('grant insert (account_id, %s) on profiles.%I to influx_advertiser',
                   l.columns, l.name);
    execute format('grant select on profiles.%I to influx_agent, influx_admin', l.name);

    execute format('drop policy if exists %I on profiles.%I', l.name || '_member_select_own', l.name);
    execute format('create policy %I on profiles.%I for select to influx_advertiser '
                   'using (account_id = (select influx.current_account_id()))',
                   l.name || '_member_select_own', l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_member_insert_own', l.name);
    execute format('create policy %I on profiles.%I for insert to influx_advertiser '
                   'with check (account_id = (select influx.current_account_id()))',
                   l.name || '_member_insert_own', l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_member_delete_own', l.name);
    execute format('create policy %I on profiles.%I for delete to influx_advertiser '
                   'using (account_id = (select influx.current_account_id()))',
                   l.name || '_member_delete_own', l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_internal_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_agent, influx_admin '
                   'using ((select influx.has_aal2()))',
                   l.name || '_internal_select', l.name);
  end loop;
end
$$;

-- 4.3 The contact person: the owner reads and writes his row; agent and admin read it in aal2
-- (RG37); influx_creator nothing (D46) ------------------------------------------------------------

grant select on profiles.advertiser_contact_details to influx_advertiser, influx_agent, influx_admin;
grant insert (account_id, contact_first_name, contact_email, contact_phone, contact_url)
   on profiles.advertiser_contact_details to influx_advertiser;
grant update (contact_first_name, contact_email, contact_phone, contact_url)
   on profiles.advertiser_contact_details to influx_advertiser;

drop policy if exists advertiser_contact_details_member_select_own on profiles.advertiser_contact_details;
create policy advertiser_contact_details_member_select_own on profiles.advertiser_contact_details
  for select to influx_advertiser
  using (account_id = (select influx.current_account_id()));

drop policy if exists advertiser_contact_details_member_insert_own on profiles.advertiser_contact_details;
create policy advertiser_contact_details_member_insert_own on profiles.advertiser_contact_details
  for insert to influx_advertiser
  with check (account_id = (select influx.current_account_id()));

drop policy if exists advertiser_contact_details_member_update_own on profiles.advertiser_contact_details;
create policy advertiser_contact_details_member_update_own on profiles.advertiser_contact_details
  for update to influx_advertiser
  using (account_id = (select influx.current_account_id()))
  with check (account_id = (select influx.current_account_id()));

drop policy if exists advertiser_contact_details_internal_select on profiles.advertiser_contact_details;
create policy advertiser_contact_details_internal_select on profiles.advertiser_contact_details
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 5. influx_privacy_definer: what the export reads and the erasure empties (04 §9.2) ------------

grant select (status, updated_at, primary_sector_code, company_size_band, website_domain,
              presentation, exclusivity_band, collaboration_rhythm, offers_non_monetary,
              contact_role, completeness_percent)
   on profiles.advertiser_profiles to influx_privacy_definer;
grant update (primary_sector_code, company_size_band, website_domain, presentation,
              exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role,
              completeness_percent)
   on profiles.advertiser_profiles to influx_privacy_definer;

-- the erasure writes the neutral name and empties every column the brand entered, nothing else
-- (EC-L2B-05-6)
drop policy if exists advertiser_profiles_privacy_definer_erase on profiles.advertiser_profiles;
create policy advertiser_profiles_privacy_definer_erase on profiles.advertiser_profiles
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = advertiser_profiles.account_id and a.status = 'deleted'))
  with check (legal_name = '[deleted]'
              and primary_sector_code is null and company_size_band is null
              and website_domain is null and presentation is null and exclusivity_band is null
              and collaboration_rhythm is null and offers_non_monetary is null
              and contact_role is null and completeness_percent is null);

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
    execute format('grant select (%s) on profiles.%I to influx_privacy_definer', l.columns, l.name);
    execute format('grant delete on profiles.%I to influx_privacy_definer', l.name);

    execute format('drop policy if exists %I on profiles.%I', l.name || '_privacy_definer_select', l.name);
    execute format('create policy %I on profiles.%I for select to influx_privacy_definer '
                   'using (true)',
                   l.name || '_privacy_definer_select', l.name);
    execute format('drop policy if exists %I on profiles.%I', l.name || '_privacy_definer_erase', l.name);
    execute format('create policy %I on profiles.%I for delete to influx_privacy_definer '
                   'using (exists (select 1 from identity.accounts a '
                   'where a.id = %I.account_id and a.status = ''deleted''))',
                   l.name || '_privacy_definer_erase', l.name, l.name);
  end loop;
end
$$;

grant select (account_id, contact_first_name, contact_email, contact_phone, contact_url, updated_at)
   on profiles.advertiser_contact_details to influx_privacy_definer;
grant update (contact_first_name, contact_email, contact_phone, contact_url)
   on profiles.advertiser_contact_details to influx_privacy_definer;

drop policy if exists advertiser_contact_details_privacy_definer_select on profiles.advertiser_contact_details;
create policy advertiser_contact_details_privacy_definer_select on profiles.advertiser_contact_details
  for select to influx_privacy_definer
  using (true);

drop policy if exists advertiser_contact_details_privacy_definer_erase on profiles.advertiser_contact_details;
create policy advertiser_contact_details_privacy_definer_erase on profiles.advertiser_contact_details
  for update to influx_privacy_definer
  using (exists (select 1 from identity.accounts a
                  where a.id = advertiser_contact_details.account_id and a.status = 'deleted'))
  with check (contact_first_name is null and contact_email is null and contact_phone is null
              and contact_url is null);

-- 6. E-5 recreated by its owner (0137, 0150): the export and the erasure of the brand profile ------

do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_privacy_definer', current_user);
end
$$;
grant create on schema privacy to influx_privacy_definer;
set role influx_privacy_definer;

-- 6.1 The export (0137): the category advertiser_profile carries the whole brand profile ----------
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
  'profile of 0202, its lists and its contact person (04 §9.2). p_addresses: '
  'privacy.account_addresses(). SECURITY INVOKER owned by influx_privacy_definer, NO grant.';

-- 6.2 The execution (0150): the erasure also empties the brand profile ---------------------------
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

  -- Erasure (04 §9.2, 21 §J8 point 6): the tables of Lot 1 and the brand profile of L2B (0202), in
  -- ONE transaction.
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

-- 7. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  c_tables constant text[] := array[
    'profiles.advertiser_profiles', 'profiles.advertiser_secondary_sectors',
    'profiles.advertiser_target_markets', 'profiles.advertiser_working_languages',
    'profiles.advertiser_topics', 'profiles.advertiser_networks', 'profiles.advertiser_formats',
    'profiles.advertiser_audience_countries', 'profiles.advertiser_usage_rights',
    'profiles.advertiser_contact_details'];
  v_def  record;
  v_bad  text;
begin
  -- D40, D46 (03 C(9)): influx_creator holds nothing on the brand profile, its lists or its
  -- contact person at L2B
  select string_agg(t || ' ' || p, ', ') into v_bad
    from unnest(c_tables) t, unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
   where pg_catalog.has_table_privilege('influx_creator', t, p)
      or (p <> 'DELETE' and pg_catalog.has_any_column_privilege('influx_creator', t, p));
  if v_bad is not null then
    raise exception 'influx_creator holds: %', v_bad;
  end if;

  -- 06 RG6 (0203), RG2 (0122): no member writes the status nor the name directly, nor creates or
  -- deletes a profile
  if pg_catalog.has_column_privilege('influx_advertiser', 'profiles.advertiser_profiles', 'status',
                                     'UPDATE')
     or pg_catalog.has_column_privilege('influx_advertiser', 'profiles.advertiser_profiles',
                                        'legal_name', 'UPDATE')
     or pg_catalog.has_any_column_privilege('influx_advertiser', 'profiles.advertiser_profiles',
                                            'INSERT')
     or pg_catalog.has_table_privilege('influx_advertiser', 'profiles.advertiser_profiles', 'DELETE')
  then
    raise exception 'influx_advertiser may write the status, the name or a whole profile';
  end if;

  -- 03 C(7) comes with L2C: agent and admin only read
  select string_agg(r || ' ' || p || ' ' || t, ', ') into v_bad
    from unnest(c_tables) t, unnest(array['influx_agent', 'influx_admin']) r,
         unnest(array['INSERT', 'UPDATE', 'DELETE']) p
   where pg_catalog.has_table_privilege(r, t, p)
      or (p <> 'DELETE' and pg_catalog.has_any_column_privilege(r, t, p));
  if v_bad is not null then
    raise exception 'internal write right(s) at L2B: %', v_bad;
  end if;

  -- RLS enabled and forced on every table of the profile
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
   where c.oid = any (c_tables::regclass[])
     and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not enabled and forced on: %', v_bad;
  end if;

  -- E-5 unchanged in its form (0137, 0150): the execution SECURITY DEFINER for influx_privacy
  -- only, the export a SECURITY INVOKER helper without any grant, both owned by
  -- influx_privacy_definer, which still owns exactly the ten functions of E-5
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
  select string_agg(format('%s in %s', mem.rolname, grp.rolname), ', ') into v_bad
    from pg_catalog.pg_auth_members m
    join pg_catalog.pg_roles mem on mem.oid = m.member
    join pg_catalog.pg_roles grp on grp.oid = m.roleid
   where grp.rolname = 'influx_privacy_definer'
     and (mem.rolname <> current_user or m.set_option or m.inherit_option);
  if v_bad is not null then
    raise exception 'influx_privacy_definer left with a usable member: %', v_bad;
  end if;
  if pg_catalog.has_schema_privilege('influx_privacy_definer', 'privacy', 'CREATE') then
    raise exception 'influx_privacy_definer left with CREATE on schema privacy';
  end if;
end
$$;
