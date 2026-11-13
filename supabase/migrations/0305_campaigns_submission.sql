-- =============================================================================
-- 0305_campaigns_submission
-- -----------------------------------------------------------------------------
-- Lot 3 / L3B, commit 05 (jalons/l3b/05.md; fiche invariants 3, 5 to 7, 9, 11; 09 RG4, RG84, RG85,
-- CA2, CA3, CA56, CA76; jalons/l3b/modele.md §5 and §6, which PREVAIL for every name). The brand
-- submits its campaign, guarded by the database; the creator view of a campaign, built by the base.
-- Signalled I-4 (03): a new definer role, a SECURITY DEFINER function, GRANTs, policies, audit.
--
-- 1. influx_campaign_definer: NOLOGIN NOINHERIT, no member (modele §5, D81 (5)), added to the closed
--    list of 03 P7. Owner of the submission door and of the two functions it calls; distinct from
--    influx_identity_definer, which is reached from the creator and holds no right on what D78
--    hides (pattern EC-L2G-01-4).
-- 2. campaigns.authorization_declaration_texts (locale, body, body_sha256): the exact text of the
--    declaration of RG85, FR word for word from 09 RG85, EN given here; served to the box and
--    hashed, the displayed and the hashed text are one row. Read by influx_advertiser (the box) and
--    by the owner of the door (the hash).
-- 3. campaigns.campaign_input(campaign) -> jsonb (STABLE, SECURITY INVOKER): the JSON of
--    CampaignInput (packages/domain campaign/required.ts), read with the rights of its caller.
--    campaigns.campaign_missing_required_fields(jsonb) -> text[] (IMMUTABLE, SECURITY INVOKER): the
--    database copy of missingCampaignFields(), the 27 codes of CAMPAIGN_REQUIRED_FIELDS in
--    snake_case, in their order, the same thresholds, the conditionals asked only when their
--    condition is answered. Both owned by influx_campaign_definer, executed by their owner only.
-- 4. campaigns.submit_own_campaign(campaign, declaration locale): the ONLY member transition of a
--    campaign (RG4, RG5): draft or rejected -> pending_review. Refusals (MESSAGE the code):
--      42501 forbidden                  not an active advertiser; a campaign unknown or of another
--                                       brand (same code, same body, T14)
--      55000 campaign_not_submittable   published, paused, closed (DETAIL the state)
--      55000 profile_not_published      the brand profile is not published (CA2)
--      23514 required_fields_missing    DETAIL every missing code, in the order of the form,
--                                       separated by `,` (CA3)
--      23514 authorizations_declaration a sensitive sector (RG84, read by join) without a locale fr
--                                       or en for the declaration of RG85
--    pending_review asked again: nothing written, returned as it is. Otherwise, in ONE transaction:
--    the campaign locked, the declaration written (instant, caller, locale, SHA-256 of the exact
--    text) or emptied for a sector that is not sensitive, pending_review, submitted_at, the register
--    line campaign.submitted {from_status} (+ declaration_locale, declaration_hash in hex).
--    SECURITY DEFINER owned by influx_campaign_definer; EXECUTE for influx_advertiser only.
-- 5. campaigns.campaign_creator_view(campaign) -> jsonb (STABLE, SECURITY INVOKER; modele §6, CA68,
--    RG98): what a creator sees of a campaign, an ALLOW-LIST whose keys are always present (null or
--    []); never the currency, a band, the total budget, the internal reference, the declaration, the
--    sensitivity, the state, an identifier nor max_applications. A campaign the caller cannot see:
--    42501. EXECUTE for influx_advertiser (the preview, L3B-08); L3C takes it as it is.
-- 6. L2DS-5 extended (modele §5, L3AS-3): no dynamic SQL in a function owned by
--    influx_campaign_definer or influx_identity_definer: neither the word `execute` nor
--    query_to_xml, cursor_to_xml, table_to_xml, schema_to_xml, database_to_xml, ts_stat,
--    ts_rewrite, dblink* (end-state assertion; db-tests/campaigns-submission.test.ts).
--
-- Not here: 0303 (unchanged), the routes (L3B-07, 08), the decisions of queue 7, RG15 and RG95
-- (L3C, which recreates the door), the export and the erasure (0306).
--
-- EC-L3B-05 (micro-gaps, the safest choice):
--   EC-L3B-05-1  body_sha256 is held by a CHECK (sha256 of the UTF-8 bytes of body) rather than
--                GENERATED: convert_to() is STABLE, a generated column needs an IMMUTABLE
--                expression. Same guarantee: no row whose hash is not that of its text.
--   EC-L3B-05-2  the brand profile is read without a lock (FOR SHARE needs an UPDATE right the
--                owner does not hold on the profile); a suspension racing a submission is caught by
--                the review of queue 7 (L3C), which reads the profile live (RG2).
--   EC-L3B-05-3  the creator view carries no field of the brand profile: modele §6 lists none, the
--                profile is read live by its route (RG2, L3B-08) and never copied here.
--   EC-L3B-05-4  networks of the creator view: the networks of the deliverable lines, each once, in
--                the order of their first line (RG35); audience languages, bands and age bands in
--                the order of their code (no rank in their table).
--   EC-L3B-05-5  L2DS-5 extended to influx_identity_definer as well, in the end-state assertion and
--                the test of this file (L3AS-3 falls due with the next migration touching that role;
--                applied here, nothing in it to change).
--   EC-L3B-05-6  the update policy of the owner admits pending_review only: the door can write no
--                other state, whatever its body (RG5, fiche invariant 3).
--
-- ROLLBACK (before any campaign is submitted): drop function campaigns.submit_own_campaign(uuid,
-- text), campaigns.campaign_creator_view(uuid), campaigns.campaign_missing_required_fields(jsonb),
-- campaigns.campaign_input(uuid); drop table campaigns.authorization_declaration_texts; drop the
-- policies *_campaign_definer_* named below and revoke their grants; revoke execute on
-- audit.append from influx_campaign_definer (as influx_audit_writer); drop role
-- influx_campaign_definer.
-- =============================================================================

-- 1. The owner of the submission door (03 P7 rule 5; rules 1 and 2 of 0001; modele §5) -----------

set createrole_self_grant = '';

do $$
begin
  if not exists (select 1 from pg_catalog.pg_roles where rolname = 'influx_campaign_definer') then
    create role influx_campaign_definer with nologin noinherit;
  end if;
  alter role influx_campaign_definer with nologin noinherit;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_definer' and rolsuper) then
    raise exception 'role influx_campaign_definer is SUPERUSER: refuse to continue (03 P7)';
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_definer' and rolbypassrls) then
    alter role influx_campaign_definer with nobypassrls;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_definer' and rolreplication) then
    alter role influx_campaign_definer with noreplication;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_definer' and rolcreatedb) then
    alter role influx_campaign_definer with nocreatedb;
  end if;
  if exists (select 1 from pg_catalog.pg_roles
              where rolname = 'influx_campaign_definer' and rolcreaterole) then
    alter role influx_campaign_definer with nocreaterole;
  end if;
end
$$;

reset createrole_self_grant;

-- 2. The text of the declaration of RG85 (modele §5) -------------------------------------------------

create table if not exists campaigns.authorization_declaration_texts (
  locale       text        not null primary key,
  body         text        not null,
  body_sha256  bytea       not null,
  created_at   timestamptz not null default now(),
  constraint authorization_declaration_texts_locale check (locale in ('fr', 'en')),
  constraint authorization_declaration_texts_body_length check (char_length(body) between 1 and 1000),
  -- EC-L3B-05-1: the hash is that of the UTF-8 bytes of the text, never another
  constraint authorization_declaration_texts_body_sha256
    check (body_sha256 = pg_catalog.sha256(pg_catalog.convert_to(body, 'UTF8')))
);

comment on table campaigns.authorization_declaration_texts is
  'The exact text of the declaration of 09 RG85, one row per locale (modele §5): served to the box '
  'of the form AND hashed by the submission door, so that what the brand reads and what is kept are '
  'one text. FR word for word from 09 RG85; EN given by 0305. Written by the migrations only; a new '
  'wording is a new migration (the hashes kept on the campaigns name the old one).';
comment on column campaigns.authorization_declaration_texts.body_sha256 is
  'SHA-256 of the UTF-8 bytes of body (EC-L3B-05-1, held by a CHECK): the value the door copies to '
  'campaigns.authorizations_declaration_hash.';

insert into campaigns.authorization_declaration_texts (locale, body, body_sha256)
select v.locale, v.body, pg_catalog.sha256(pg_catalog.convert_to(v.body, 'UTF8'))
  from (values
    ('fr', 'Je déclare détenir les autorisations nécessaires pour promouvoir ce produit dans les '
           'pays visés et respecter les règles de publicité qui s''y appliquent.'),
    ('en', 'I declare that I hold the authorisations required to promote this product in the '
           'countries targeted and that I comply with the advertising rules that apply there.')
  ) as v (locale, body)
on conflict (locale) do nothing;

alter table campaigns.authorization_declaration_texts enable row level security;
alter table campaigns.authorization_declaration_texts force row level security;
revoke all on campaigns.authorization_declaration_texts from public, anon, authenticated, service_role;

-- the brand reads the text its box shows (modele §5)
grant select on campaigns.authorization_declaration_texts to influx_advertiser;

drop policy if exists authorization_declaration_texts_member_select
  on campaigns.authorization_declaration_texts;
create policy authorization_declaration_texts_member_select
  on campaigns.authorization_declaration_texts
  for select to influx_advertiser
  using ((select influx.current_account_id()) is not null);

-- 3. What influx_campaign_definer reads and writes (the caller's own rows) ------------------------
-- Every table below is FORCE ROW LEVEL SECURITY: each right comes with its policy TO the owner,
-- bound to the caller's own account (influx.current_account_id()).

grant usage on schema campaigns, profiles, identity, reference, audit, influx
   to influx_campaign_definer;
grant execute on function influx.current_account_id(), influx.current_account_role()
   to influx_campaign_definer;

-- 3.1 The caller: an active account
grant select (id, status) on identity.accounts to influx_campaign_definer;

drop policy if exists accounts_campaign_definer_select on identity.accounts;
create policy accounts_campaign_definer_select on identity.accounts
  for select to influx_campaign_definer
  using (id = (select influx.current_account_id()));

-- 3.2 The brand profile of the caller: its status (CA2)
grant select (account_id, status) on profiles.advertiser_profiles to influx_campaign_definer;

drop policy if exists advertiser_profiles_campaign_definer_select on profiles.advertiser_profiles;
create policy advertiser_profiles_campaign_definer_select on profiles.advertiser_profiles
  for select to influx_campaign_definer
  using (account_id = (select influx.current_account_id()));

-- 3.3 The sensitivity of a sector, read by join, never copied on the campaign (RG84)
grant select (code, is_sensitive) on reference.sectors to influx_campaign_definer;

drop policy if exists sectors_campaign_definer_select on reference.sectors;
create policy sectors_campaign_definer_select on reference.sectors
  for select to influx_campaign_definer
  using (true);

-- 3.4 The campaigns of the caller: what campaign_input() reads; the state, the cycle and the
-- declaration written by the door, pending_review only (EC-L3B-05-6)
grant select (id, advertiser_account_id, status, title, campaign_type_code, public_summary, brief,
              product_description, sector_code, product_is_sent, product_value_band_code,
              creator_keeps_product, shipping_costs_borne_by, usage_rights_code,
              usage_rights_duration_band, usage_rights_territory_scope, exclusivity_band,
              content_review_delay, currency, remuneration_kind, per_creator_budget_band_code,
              creators_wanted, applications_close_on, starts_on, ends_on, submitted_at)
   on campaigns.campaigns to influx_campaign_definer;
grant update (status, submitted_at, authorizations_declared_at,
              authorizations_declared_by_account_id, authorizations_declaration_locale,
              authorizations_declaration_hash)
   on campaigns.campaigns to influx_campaign_definer;

drop policy if exists campaigns_campaign_definer_select on campaigns.campaigns;
create policy campaigns_campaign_definer_select on campaigns.campaigns
  for select to influx_campaign_definer
  using (advertiser_account_id = (select influx.current_account_id()));

drop policy if exists campaigns_campaign_definer_update on campaigns.campaigns;
create policy campaigns_campaign_definer_update on campaigns.campaigns
  for update to influx_campaign_definer
  using (advertiser_account_id = (select influx.current_account_id()))
  with check (advertiser_account_id = (select influx.current_account_id())
              and status = 'pending_review');

-- 3.5 The lists campaign_input() reads, on the caller's campaigns
do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('campaign_key_messages',       'campaign_id, position, body'),
      ('campaign_deliverables',       'campaign_id, slot, network_code, format_code, quantity'),
      ('campaign_usage_territories',  'campaign_id, slot, country_code'),
      ('campaign_audience_countries', 'campaign_id, slot, country_code'),
      ('campaign_audience_languages', 'campaign_id, language_code'),
      ('campaign_topics',             'campaign_id, slot, topic_code')
    ) as v (name, columns)
  loop
    execute format('grant select (%s) on campaigns.%I to influx_campaign_definer', l.columns, l.name);
    execute format('drop policy if exists %I on campaigns.%I',
                   l.name || '_campaign_definer_select', l.name);
    execute format('create policy %I on campaigns.%I for select to influx_campaign_definer '
                   'using (exists (select 1 from campaigns.campaigns c '
                   'where c.id = %I.campaign_id '
                   'and c.advertiser_account_id = (select influx.current_account_id())))',
                   l.name || '_campaign_definer_select', l.name, l.name);
  end loop;
end
$$;

-- 3.6 The hash of the declaration
grant select (locale, body_sha256) on campaigns.authorization_declaration_texts
   to influx_campaign_definer;

drop policy if exists authorization_declaration_texts_campaign_definer_select
  on campaigns.authorization_declaration_texts;
create policy authorization_declaration_texts_campaign_definer_select
  on campaigns.authorization_declaration_texts
  for select to influx_campaign_definer
  using (true);

-- 3.7 The register, through audit.append(), granted by its owner (0006 §9 window)
do $$
begin
  execute format('grant %I to %I with inherit false, set true', 'influx_audit_writer', current_user);
end
$$;
set role influx_audit_writer;
grant execute on function audit.append(text, text, uuid, jsonb) to influx_campaign_definer;
reset role;
do $$
begin
  execute format('revoke %I from %I', 'influx_audit_writer', current_user);
end
$$;

-- 4. The rules of the required fields, the database copy (modele §5; created by the migration role,
-- handed to their owner in section 7) --------------------------------------------------------------

create or replace function campaigns.campaign_input(p_campaign_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'title',                     c.title,
    'campaignType',              c.campaign_type_code,
    'publicSummary',             c.public_summary,
    'brief',                     c.brief,
    'productDescription',        c.product_description,
    'productSector',             c.sector_code,
    'keyMessages',               coalesce((select pg_catalog.jsonb_agg(m.body order by m.position)
                                             from campaigns.campaign_key_messages m
                                            where m.campaign_id = c.id), '[]'::jsonb),
    'productIsSent',             c.product_is_sent,
    'productValueBand',          c.product_value_band_code,
    'creatorKeepsProduct',       c.creator_keeps_product,
    'shippingCostsBorneBy',      c.shipping_costs_borne_by,
    'deliverables',              coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                                    'networkCode', d.network_code,
                                                    'formatCode',  d.format_code,
                                                    'quantity',    d.quantity) order by d.slot)
                                             from campaigns.campaign_deliverables d
                                            where d.campaign_id = c.id), '[]'::jsonb),
    'usageRights',               c.usage_rights_code,
    'usageRightsDuration',       c.usage_rights_duration_band,
    'usageRightsTerritoryScope', c.usage_rights_territory_scope,
    'usageRightsTerritories',    coalesce((select pg_catalog.jsonb_agg(u.country_code order by u.slot)
                                             from campaigns.campaign_usage_territories u
                                            where u.campaign_id = c.id), '[]'::jsonb),
    'exclusivity',               c.exclusivity_band,
    'contentReviewDelay',        c.content_review_delay,
    'audienceCountries',         coalesce((select pg_catalog.jsonb_agg(a.country_code order by a.slot)
                                             from campaigns.campaign_audience_countries a
                                            where a.campaign_id = c.id), '[]'::jsonb),
    'audienceLanguages',         coalesce((select pg_catalog.jsonb_agg(l.language_code
                                                                       order by l.language_code)
                                             from campaigns.campaign_audience_languages l
                                            where l.campaign_id = c.id), '[]'::jsonb),
    'audienceTopics',            coalesce((select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                                             from campaigns.campaign_topics t
                                            where t.campaign_id = c.id), '[]'::jsonb),
    'currency',                  c.currency,
    'remunerationKind',          c.remuneration_kind,
    'budgetBand',                c.per_creator_budget_band_code,
    'creatorsWanted',            c.creators_wanted,
    'applicationsCloseOn',       c.applications_close_on,
    'startsOn',                  c.starts_on,
    'endsOn',                    c.ends_on)
    from campaigns.campaigns c
   where c.id = p_campaign_id
$$;

comment on function campaigns.campaign_input(uuid) is
  'modele §5 (0305): what the rule of the required fields reads for the campaign p_campaign_id, as '
  'the JSON of CampaignInput (packages/domain campaign/required.ts): the codes of the form in '
  'camelCase, the territory as its scope and its countries, the lists in their rank, the dates as '
  'YYYY-MM-DD. NULL for a campaign the caller does not see. SECURITY INVOKER: it reads with the '
  'rights and the policies of its caller (the door: the caller''s own campaigns); owned by '
  'influx_campaign_definer, executed by its owner only.';

create or replace function campaigns.campaign_missing_required_fields(p_input jsonb)
returns text[]
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  -- the margins of String.prototype.trim() (EC-L2B-06-4), as escapes of the regular expression
  c_margins  constant text :=
    '^[\t\n\v\f\r    -     　﻿]+'
    '|[\t\n\v\f\r    -     　﻿]+$';
  v_len      jsonb;
  v_sent     boolean := coalesce(p_input -> 'productIsSent' = 'true'::jsonb, false);
  v_rights   boolean;
  v_budget   boolean;
  v_scope    text;
  v_count    integer;
  v_key      text;
  v_value    text;
  v_year     integer;
  v_month    integer;
  v_day      integer;
  v_civil    boolean;
  v_missing  text[] := '{}'::text[];
begin
  -- the trimmed length of every text field, in code points; 0 for anything but a string
  select pg_catalog.jsonb_object_agg(k,
           case when pg_catalog.jsonb_typeof(p_input -> k) = 'string'
                then pg_catalog.char_length(pg_catalog.regexp_replace(p_input ->> k, c_margins, '', 'g'))
                else 0 end)
    into v_len
    from pg_catalog.unnest(array[
           'title', 'campaignType', 'publicSummary', 'brief', 'productDescription', 'productSector',
           'productValueBand', 'shippingCostsBorneBy', 'usageRights', 'usageRightsDuration',
           'exclusivity', 'contentReviewDelay', 'currency', 'remunerationKind', 'budgetBand']) as k;

  -- the conditions of the conditional fields, on the value as stored (an unanswered condition is
  -- itself missing, never its dependants)
  v_rights := (v_len ->> 'usageRights')::integer > 0 and (p_input ->> 'usageRights') <> 'none';
  v_budget := (v_len ->> 'remunerationKind')::integer > 0
              and (p_input ->> 'remunerationKind') <> 'gift_only';

  -- step 1: block 1 (RG16), then block 2 (RG24)
  if (v_len ->> 'title')::integer < 10 then
    v_missing := v_missing || 'title'::text;
  end if;
  if (v_len ->> 'campaignType')::integer = 0 then
    v_missing := v_missing || 'campaign_type'::text;
  end if;
  if (v_len ->> 'publicSummary')::integer < 120 then
    v_missing := v_missing || 'public_summary'::text;
  end if;
  if (v_len ->> 'brief')::integer < 300 then
    v_missing := v_missing || 'brief'::text;
  end if;
  if (v_len ->> 'productDescription')::integer < 20 then
    v_missing := v_missing || 'product_description'::text;
  end if;
  if (v_len ->> 'productSector')::integer = 0 then
    v_missing := v_missing || 'product_sector'::text;
  end if;
  -- key messages are optional; a bullet that is there holds 10 to 200 characters
  if pg_catalog.jsonb_typeof(p_input -> 'keyMessages') = 'array'
     and exists (select 1 from pg_catalog.jsonb_array_elements(p_input -> 'keyMessages') m
                  where pg_catalog.jsonb_typeof(m) is distinct from 'string'
                     or pg_catalog.char_length(pg_catalog.regexp_replace(m #>> '{}', c_margins, '', 'g'))
                          not between 10 and 200) then
    v_missing := v_missing || 'key_messages'::text;
  end if;
  if pg_catalog.jsonb_typeof(p_input -> 'productIsSent') is distinct from 'boolean' then
    v_missing := v_missing || 'product_is_sent'::text;
  end if;
  if v_sent and (v_len ->> 'productValueBand')::integer = 0 then
    v_missing := v_missing || 'product_value_band'::text;
  end if;
  if v_sent and pg_catalog.jsonb_typeof(p_input -> 'creatorKeepsProduct') is distinct from 'boolean' then
    v_missing := v_missing || 'creator_keeps_product'::text;
  end if;
  if v_sent and (v_len ->> 'shippingCostsBorneBy')::integer = 0 then
    v_missing := v_missing || 'shipping_costs_borne_by'::text;
  end if;

  -- step 2: block 3 (RG34)
  if pg_catalog.jsonb_typeof(p_input -> 'deliverables') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_input -> 'deliverables') = 0 then
    v_missing := v_missing || 'deliverables'::text;
  end if;
  if (v_len ->> 'usageRights')::integer = 0 then
    v_missing := v_missing || 'usage_rights'::text;
  end if;
  if v_rights and (v_len ->> 'usageRightsDuration')::integer = 0 then
    v_missing := v_missing || 'usage_rights_duration'::text;
  end if;
  if v_rights then
    -- the world and no country, or the selected countries and one at least (RG34)
    v_scope := case when pg_catalog.jsonb_typeof(p_input -> 'usageRightsTerritoryScope') = 'string'
                    then p_input ->> 'usageRightsTerritoryScope' end;
    v_count := case when pg_catalog.jsonb_typeof(p_input -> 'usageRightsTerritories') = 'array'
                    then pg_catalog.jsonb_array_length(p_input -> 'usageRightsTerritories') else 0 end;
    if not coalesce(case v_scope
                      when 'worldwide' then v_count = 0
                      when 'selected_countries' then v_count >= 1
                      else false end, false) then
      v_missing := v_missing || 'usage_rights_territory'::text;
    end if;
  end if;
  if (v_len ->> 'exclusivity')::integer = 0 then
    v_missing := v_missing || 'exclusivity'::text;
  end if;
  if (v_len ->> 'contentReviewDelay')::integer = 0 then
    v_missing := v_missing || 'content_review_delay'::text;
  end if;

  -- step 3: block 4 (RG46)
  if pg_catalog.jsonb_typeof(p_input -> 'audienceCountries') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_input -> 'audienceCountries') = 0 then
    v_missing := v_missing || 'audience_countries'::text;
  end if;
  if pg_catalog.jsonb_typeof(p_input -> 'audienceLanguages') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_input -> 'audienceLanguages') = 0 then
    v_missing := v_missing || 'audience_languages'::text;
  end if;
  if pg_catalog.jsonb_typeof(p_input -> 'audienceTopics') is distinct from 'array'
     or pg_catalog.jsonb_array_length(p_input -> 'audienceTopics') = 0 then
    v_missing := v_missing || 'audience_topics'::text;
  end if;

  -- step 4: block 5 (RG55, RG62, Q16; CA76: no band for gift only, affiliation included)
  if (v_len ->> 'currency')::integer = 0 then
    v_missing := v_missing || 'currency'::text;
  end if;
  if (v_len ->> 'remunerationKind')::integer = 0 then
    v_missing := v_missing || 'remuneration_kind'::text;
  end if;
  if v_budget and (v_len ->> 'budgetBand')::integer = 0 then
    v_missing := v_missing || 'budget_band'::text;
  end if;
  -- an integer from 1 to 50 (RG55, RG66)
  if pg_catalog.jsonb_typeof(p_input -> 'creatorsWanted') is distinct from 'number'
     or not ((p_input ->> 'creatorsWanted')::numeric
               = pg_catalog.trunc((p_input ->> 'creatorsWanted')::numeric)
             and (p_input ->> 'creatorsWanted')::numeric between 1 and 50) then
    v_missing := v_missing || 'creators_wanted'::text;
  end if;

  -- step 5: block 6 (RG69), three civil dates that exist, written YYYY-MM-DD
  foreach v_key in array array['applicationsCloseOn', 'startsOn', 'endsOn'] loop
    v_civil := false;
    if pg_catalog.jsonb_typeof(p_input -> v_key) = 'string'
       and (p_input ->> v_key) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      v_value := p_input ->> v_key;
      v_year := pg_catalog.substr(v_value, 1, 4)::integer;
      v_month := pg_catalog.substr(v_value, 6, 2)::integer;
      v_day := pg_catalog.substr(v_value, 9, 2)::integer;
      if v_year >= 1 and v_month between 1 and 12 and v_day >= 1 then
        v_civil := v_day <= pg_catalog.date_part('day',
                     pg_catalog.make_date(v_year, v_month, 1) + interval '1 month' - interval '1 day');
      end if;
    end if;
    if not v_civil then
      v_missing := v_missing || case v_key
                                  when 'applicationsCloseOn' then 'applications_close_on'
                                  when 'startsOn' then 'starts_on'
                                  else 'ends_on' end;
    end if;
  end loop;

  return v_missing;
end
$$;

comment on function campaigns.campaign_missing_required_fields(jsonb) is
  '09 RG4, RG16, RG24, RG34, RG46, RG55, RG69, CA3, CA76 (0305, modele §5): the required fields of '
  'a campaign still missing, in the order of the form, as snake_case codes: title, campaign_type, '
  'public_summary, brief, product_description, product_sector, key_messages (a bullet outside 10 '
  'to 200), product_is_sent, product_value_band, creator_keeps_product, shipping_costs_borne_by '
  '(the three when the product is sent), deliverables, usage_rights, usage_rights_duration, '
  'usage_rights_territory (when the rights are not none: worldwide without country, or '
  'selected_countries with one at least), exclusivity, content_review_delay, audience_countries, '
  'audience_languages, audience_topics, currency, remuneration_kind, budget_band (unless '
  'gift_only), creators_wanted (an integer, 1 to 50), applications_close_on, starts_on, ends_on (a '
  'civil date that exists). Input: the JSON of CampaignInput (campaigns.campaign_input). The '
  'database copy of missingCampaignFields() (packages/domain), held equal by the parity test '
  '(campaign-parity). IMMUTABLE, SECURITY INVOKER; owned by influx_campaign_definer, executed by its '
  'owner only.';

revoke all on function campaigns.campaign_input(uuid)
  from public, anon, authenticated, service_role;
revoke all on function campaigns.campaign_missing_required_fields(jsonb)
  from public, anon, authenticated, service_role;

-- 5. The submission door (modele §5; 09 RG4, RG5, RG84, RG85, CA2, CA3, CA76) ------------------------

create or replace function campaigns.submit_own_campaign(
  p_campaign_id         uuid,
  p_declaration_locale  text default null
)
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
  v_account    uuid := influx.current_account_id();
  v_status     text;
  v_at         timestamptz;
  v_sector     text;
  v_profile    text;
  v_missing    text[];
  v_sensitive  boolean;
  v_hash       bytea;
  v_payload    jsonb;
begin
  -- (1) an active advertiser, his own campaign; an unknown one answers the same (T14)
  if v_account is null
     or influx.current_account_role() is distinct from 'advertiser'
     or not exists (select 1 from identity.accounts a
                     where a.id = v_account and a.status = 'active') then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;

  -- (2) the row lock serialises two submissions (double click, second tab) and the brand's writes
  -- (the freeze reads the campaign FOR SHARE): the second one reads what the first one committed
  select c.status::text, c.submitted_at, c.sector_code
    into v_status, v_at, v_sector
    from campaigns.campaigns c
   where c.id = p_campaign_id and c.advertiser_account_id = v_account
     for update of c;
  if not found then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  -- submitted again while waiting: nothing written
  if v_status = 'pending_review' then
    return query select v_status, v_at, false;
    return;
  end if;
  -- RG5: published, paused and closed are left by INFLUX only
  if v_status not in ('draft', 'rejected') then
    raise exception 'campaign_not_submittable'
      using errcode = 'object_not_in_prerequisite_state', detail = v_status;
  end if;

  -- (3) CA2: the brand profile is published
  select p.status::text into v_profile
    from profiles.advertiser_profiles p
   where p.account_id = v_account;
  if v_profile is distinct from 'published' then
    raise exception 'profile_not_published'
      using errcode = 'object_not_in_prerequisite_state', detail = 'profile_not_published';
  end if;

  -- (4) RG4, CA3: every missing field named, in the order of the form
  v_missing := campaigns.campaign_missing_required_fields(campaigns.campaign_input(p_campaign_id));
  if pg_catalog.cardinality(v_missing) > 0 then
    raise exception 'required_fields_missing'
      using errcode = 'check_violation', detail = pg_catalog.array_to_string(v_missing, ',');
  end if;

  -- (5) RG84, RG85: a sensitive sector, read by join, asks the declaration ticked in fr or en; the
  -- hash of the exact text shown is kept with its locale, its author and its instant
  select s.is_sensitive into v_sensitive
    from reference.sectors s
   where s.code = v_sector;
  v_sensitive := coalesce(v_sensitive, false);
  if v_sensitive then
    select t.body_sha256 into v_hash
      from campaigns.authorization_declaration_texts t
     where t.locale = p_declaration_locale;
    if v_hash is null then
      raise exception 'authorizations_declaration'
        using errcode = 'check_violation', detail = 'authorizations_declaration';
    end if;
  end if;

  -- (6) the state, the instant and the declaration (emptied for a sector that is not sensitive)
  update campaigns.campaigns c
     set status = 'pending_review',
         submitted_at = pg_catalog.now(),
         authorizations_declared_at = case when v_sensitive then pg_catalog.now() end,
         authorizations_declared_by_account_id = case when v_sensitive then v_account end,
         authorizations_declaration_locale = case when v_sensitive then p_declaration_locale end,
         authorizations_declaration_hash = v_hash
   where c.id = p_campaign_id
  returning c.submitted_at into v_at;

  v_payload := pg_catalog.jsonb_build_object('from_status', v_status);
  if v_sensitive then
    v_payload := v_payload || pg_catalog.jsonb_build_object(
                   'declaration_locale', p_declaration_locale,
                   'declaration_hash', pg_catalog.encode(v_hash, 'hex'));
  end if;
  -- The register, in the transaction of the fact; last: the chain lock is held until COMMIT
  -- (04 §7.2).
  perform audit.append('campaign.submitted', 'campaign', p_campaign_id, v_payload);
  return query select 'pending_review'::text, v_at, true;
end
$$;

comment on function campaigns.submit_own_campaign(uuid, text) is
  '09 RG4, RG5, RG84, RG85, CA2, CA3, CA76 (0305, modele §5): an active advertiser submits his own '
  'campaign. From draft or rejected, the brand profile published, no required field missing '
  '(campaign_missing_required_fields of campaign_input), and for a sensitive sector the declaration '
  'of RG85 ticked in p_declaration_locale (fr or en): in ONE transaction, the declaration written '
  '(instant, caller, locale, SHA-256 of the text of authorization_declaration_texts) or emptied, '
  'status pending_review, submitted_at now(), the register line campaign.submitted {from_status, '
  'declaration_locale, declaration_hash}; returns (pending_review, instant, true). Already '
  'pending_review: nothing written, returns (pending_review, instant of the submission, false). '
  'Refusals: 42501 forbidden (not an active advertiser, a campaign unknown or of another brand), '
  '55000 campaign_not_submittable (DETAIL the state), 55000 profile_not_published, 23514 '
  'required_fields_missing (DETAIL every code, separated by a comma), 23514 '
  'authorizations_declaration. SECURITY DEFINER owned by influx_campaign_definer, empty '
  'search_path; EXECUTE for influx_advertiser only.';

revoke all on function campaigns.submit_own_campaign(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function campaigns.submit_own_campaign(uuid, text) to influx_advertiser;

-- 6. The creator view of a campaign (modele §6; CA68, RG98; D78) ------------------------------------

create or replace function campaigns.campaign_creator_view(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_view  jsonb;
begin
  -- an ALLOW-LIST: every key always present, null or []; never the currency, a band, the total
  -- budget, the internal reference, the declaration, the sensitivity, the state, an identifier
  select pg_catalog.jsonb_build_object(
    'title',                     c.title,
    'campaignType',              c.campaign_type_code,
    'publicSummary',             c.public_summary,
    'brief',                     c.brief,
    'productDescription',        c.product_description,
    'productSector',             c.sector_code,
    'restrictions',              c.restrictions,
    'keyMessages',               coalesce((select pg_catalog.jsonb_agg(m.body order by m.position)
                                             from campaigns.campaign_key_messages m
                                            where m.campaign_id = c.id), '[]'::jsonb),
    'productIsSent',             c.product_is_sent,
    'creatorKeepsProduct',       c.creator_keeps_product,
    'shippingCostsBorneBy',      c.shipping_costs_borne_by,
    'deliverables',              coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                                                    'networkCode', d.network_code,
                                                    'formatCode',  d.format_code,
                                                    'quantity',    d.quantity) order by d.slot)
                                             from campaigns.campaign_deliverables d
                                            where d.campaign_id = c.id), '[]'::jsonb),
    -- RG35: the networks follow from the deliverables (EC-L3B-05-4)
    'networks',                  coalesce((select pg_catalog.jsonb_agg(n.network_code
                                                                       order by n.first_slot)
                                             from (select d.network_code, pg_catalog.min(d.slot) as first_slot
                                                     from campaigns.campaign_deliverables d
                                                    where d.campaign_id = c.id
                                                    group by d.network_code) n), '[]'::jsonb),
    'usageRights',               c.usage_rights_code,
    'usageRightsDuration',       c.usage_rights_duration_band,
    'usageRightsTerritoryScope', c.usage_rights_territory_scope,
    'usageRightsTerritories',    coalesce((select pg_catalog.jsonb_agg(u.country_code order by u.slot)
                                             from campaigns.campaign_usage_territories u
                                            where u.campaign_id = c.id), '[]'::jsonb),
    'exclusivity',               c.exclusivity_band,
    'contentReviewDelay',        c.content_review_delay,
    'audienceCountries',         coalesce((select pg_catalog.jsonb_agg(a.country_code order by a.slot)
                                             from campaigns.campaign_audience_countries a
                                            where a.campaign_id = c.id), '[]'::jsonb),
    'audienceLanguages',         coalesce((select pg_catalog.jsonb_agg(l.language_code
                                                                       order by l.language_code)
                                             from campaigns.campaign_audience_languages l
                                            where l.campaign_id = c.id), '[]'::jsonb),
    'audienceTopics',            coalesce((select pg_catalog.jsonb_agg(t.topic_code order by t.slot)
                                             from campaigns.campaign_topics t
                                            where t.campaign_id = c.id), '[]'::jsonb),
    'audienceBands',             coalesce((select pg_catalog.jsonb_agg(b.audience_band_code
                                                                       order by b.audience_band_code)
                                             from campaigns.campaign_audience_bands b
                                            where b.campaign_id = c.id), '[]'::jsonb),
    'audienceAgeBands',          coalesce((select pg_catalog.jsonb_agg(g.age_band_code
                                                                       order by g.age_band_code)
                                             from campaigns.campaign_audience_age_bands g
                                            where g.campaign_id = c.id), '[]'::jsonb),
    'audienceGender',            c.audience_gender_code,
    'remunerationKind',          c.remuneration_kind,
    'creatorsWanted',            c.creators_wanted,
    'applicationsCloseOn',       c.applications_close_on,
    'contentDueOn',              c.content_due_on,
    'startsOn',                  c.starts_on,
    'endsOn',                    c.ends_on,
    'requestedItems',            coalesce((select pg_catalog.jsonb_agg(r.item_code order by r.slot)
                                             from campaigns.campaign_requested_items r
                                            where r.campaign_id = c.id), '[]'::jsonb))
    into v_view
    from campaigns.campaigns c
   where c.id = p_campaign_id;
  -- a campaign the caller does not see answers as an unknown one (T14)
  if v_view is null then
    raise exception 'forbidden' using errcode = 'insufficient_privilege';
  end if;
  return v_view;
end
$$;

comment on function campaigns.campaign_creator_view(uuid) is
  'modele §6, 09 CA68, RG98, D78 (0305): what a creator sees of the campaign p_campaign_id, an '
  'ALLOW-LIST whose 32 keys are always present (null or []): title, campaignType, publicSummary, '
  'brief, productDescription, productSector, restrictions, keyMessages, productIsSent, '
  'creatorKeepsProduct, shippingCostsBorneBy, deliverables, networks (deduced, RG35), usageRights, '
  'usageRightsDuration, usageRightsTerritoryScope, usageRightsTerritories, exclusivity, '
  'contentReviewDelay, audienceCountries, audienceLanguages, audienceTopics, audienceBands, '
  'audienceAgeBands, audienceGender, remunerationKind, creatorsWanted, applicationsCloseOn, '
  'contentDueOn, startsOn, endsOn, requestedItems. NEVER the currency, a band, the total budget, '
  'the internal reference, the declaration of RG85, the sensitivity, the state, an identifier nor '
  'max_applications. A campaign the caller does not see: 42501 forbidden. STABLE, SECURITY INVOKER '
  '(the rights and policies of its caller); EXECUTE for influx_advertiser (the preview, L3B-08); '
  'L3C builds the snapshot from it.';

revoke all on function campaigns.campaign_creator_view(uuid)
  from public, anon, authenticated, service_role;
grant execute on function campaigns.campaign_creator_view(uuid) to influx_advertiser;

-- 7. The functions handed to their owner (03 P7 rule 5) --------------------------------------------

do $$
begin
  execute format('grant %I to %I with inherit false, set true',
                 'influx_campaign_definer', current_user);
end
$$;
grant create on schema campaigns to influx_campaign_definer;

alter function campaigns.campaign_input(uuid) owner to influx_campaign_definer;
alter function campaigns.campaign_missing_required_fields(jsonb) owner to influx_campaign_definer;
alter function campaigns.submit_own_campaign(uuid, text) owner to influx_campaign_definer;

revoke create on schema campaigns from influx_campaign_definer;
do $$
begin
  execute format('revoke %I from %I', 'influx_campaign_definer', current_user);
end
$$;

-- 8. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  c_dynamic constant text :=
    '\mexecute\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml'
    '|ts_stat|ts_rewrite|dblink';
  v_bad  text;
begin
  -- 03 P7: NOLOGIN NOINHERIT, no member, member of nothing, no attribute (C-9: the ADMIN OPTION
  -- the creating role keeps, without INHERIT nor SET, is tolerated)
  if not exists (select 1 from pg_catalog.pg_roles
                  where rolname = 'influx_campaign_definer' and not rolcanlogin and not rolinherit
                    and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole
                    and not rolreplication)
     or exists (select 1 from pg_catalog.pg_auth_members m
                 where m.member = 'influx_campaign_definer'::regrole
                    or (m.roleid = 'influx_campaign_definer'::regrole
                        and (m.inherit_option or m.set_option))) then
    raise exception 'influx_campaign_definer must be NOLOGIN NOINHERIT, without member nor membership';
  end if;

  -- the door: its owner, SECURITY DEFINER, empty search_path, EXECUTE for influx_advertiser only
  if (select p.proowner <> 'influx_campaign_definer'::regrole or not p.prosecdef
             or p.proconfig is distinct from array['search_path=""']
        from pg_catalog.pg_proc p
       where p.oid = 'campaigns.submit_own_campaign(uuid, text)'::regprocedure) then
    raise exception 'campaigns.submit_own_campaign() with a wrong owner or mode';
  end if;
  -- the two rules: their owner, SECURITY INVOKER, empty search_path
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.oid in ('campaigns.campaign_input(uuid)'::regprocedure,
                   'campaigns.campaign_missing_required_fields(jsonb)'::regprocedure)
     and (p.proowner <> 'influx_campaign_definer'::regrole or p.prosecdef
          or p.proconfig is distinct from array['search_path=""']);
  if v_bad is not null then
    raise exception 'rules of the submission with a wrong owner or mode: %', v_bad;
  end if;
  if (select prosecdef or proconfig is distinct from array['search_path=""']
        from pg_catalog.pg_proc
       where oid = 'campaigns.campaign_creator_view(uuid)'::regprocedure) then
    raise exception 'campaigns.campaign_creator_view() must be SECURITY INVOKER, empty search_path';
  end if;

  -- EXECUTE: the door and the view to influx_advertiser only, the rules to their owner only
  select string_agg(p.oid::regprocedure::text || ' ' ||
                    case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
    into v_bad
    from pg_catalog.pg_proc p,
         pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
   where p.oid in ('campaigns.submit_own_campaign(uuid, text)'::regprocedure,
                   'campaigns.campaign_creator_view(uuid)'::regprocedure,
                   'campaigns.campaign_input(uuid)'::regprocedure,
                   'campaigns.campaign_missing_required_fields(jsonb)'::regprocedure)
     and a.privilege_type = 'EXECUTE'
     and a.grantee <> p.proowner
     and not (a.grantee = 'influx_advertiser'::regrole
              and p.oid in ('campaigns.submit_own_campaign(uuid, text)'::regprocedure,
                            'campaigns.campaign_creator_view(uuid)'::regprocedure));
  if v_bad is not null then
    raise exception 'EXECUTE beyond the brand on the functions of 0305: %', v_bad;
  end if;

  -- D78, TM5.6 (fiche invariant 1): the creator, the owner of the brand doors and the roles of L3C
  -- still hold nothing on the schema campaigns, its new table included
  select string_agg(r, ', ') into v_bad
    from unnest(array['influx_creator', 'influx_agent', 'influx_admin', 'influx_worker',
                      'influx_identity_definer', 'influx_auth', 'influx_privacy']) r
   where pg_catalog.has_schema_privilege(r, 'campaigns', 'USAGE')
      or pg_catalog.has_table_privilege(r, 'campaigns.authorization_declaration_texts',
                                        'SELECT, INSERT, UPDATE, DELETE')
      or pg_catalog.has_any_column_privilege(r, 'campaigns.authorization_declaration_texts',
                                             'SELECT, INSERT, UPDATE');
  if v_bad is not null then
    raise exception 'right on campaigns.* outside the brand and its door: %', v_bad;
  end if;

  -- RG5 (fiche invariant 3): the owner of the door writes the state, the cycle and the declaration
  -- only; it neither inserts nor deletes a campaign, and writes no list
  if pg_catalog.has_table_privilege('influx_campaign_definer', 'campaigns.campaigns', 'INSERT, DELETE')
     or pg_catalog.has_any_column_privilege('influx_campaign_definer', 'campaigns.campaigns', 'INSERT')
     or exists (select 1 from pg_catalog.pg_attribute at
                 where at.attrelid = 'campaigns.campaigns'::regclass and at.attnum > 0
                   and not at.attisdropped
                   and pg_catalog.has_column_privilege('influx_campaign_definer', at.attrelid,
                                                       at.attnum, 'UPDATE')
                   and at.attname not in ('status', 'submitted_at', 'authorizations_declared_at',
                                          'authorizations_declared_by_account_id',
                                          'authorizations_declaration_locale',
                                          'authorizations_declaration_hash')) then
    raise exception 'influx_campaign_definer writes beyond the state, the cycle and the declaration';
  end if;
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'campaigns' and c.relkind in ('r', 'p') and c.relname <> 'campaigns'
     and (pg_catalog.has_table_privilege('influx_campaign_definer', c.oid, 'INSERT, UPDATE, DELETE')
          or pg_catalog.has_any_column_privilege('influx_campaign_definer', c.oid, 'INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'influx_campaign_definer writes a list or a closed list: %', v_bad;
  end if;

  -- the new table: RLS enabled and forced, nothing to the Data API roles
  if not (select relrowsecurity and relforcerowsecurity from pg_catalog.pg_class
           where oid = 'campaigns.authorization_declaration_texts'::regclass)
     or pg_catalog.has_table_privilege('service_role', 'campaigns.authorization_declaration_texts',
                                       'SELECT, INSERT, UPDATE, DELETE')
     or pg_catalog.has_table_privilege('anon', 'campaigns.authorization_declaration_texts', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'campaigns.authorization_declaration_texts',
                                       'SELECT') then
    raise exception 'campaigns.authorization_declaration_texts is not protected';
  end if;
  -- RG85: the two texts, FR word for word, each with the hash of its bytes
  if (select array_agg(locale order by locale) from campaigns.authorization_declaration_texts)
       is distinct from array['en', 'fr']
     or not exists (select 1 from campaigns.authorization_declaration_texts
                     where locale = 'fr'
                       and body = 'Je déclare détenir les autorisations nécessaires pour promouvoir '
                                  'ce produit dans les pays visés et respecter les règles de '
                                  'publicité qui s''y appliquent.') then
    raise exception 'the texts of the declaration of RG85 are not those of 09';
  end if;

  -- L2DS-5 extended (modele §5, L3AS-3, EC-L3B-05-5): no dynamic SQL in a function owned by the
  -- owner of the door or by influx_identity_definer
  select string_agg(p.oid::regprocedure::text, ', ') into v_bad
    from pg_catalog.pg_proc p
   where p.proowner in ('influx_campaign_definer'::regrole, 'influx_identity_definer'::regrole)
     and p.prosrc ~* c_dynamic;
  if v_bad is not null then
    raise exception 'L2DS-5: dynamic SQL in a function owned by a member door owner: %', v_bad;
  end if;
end
$$;
