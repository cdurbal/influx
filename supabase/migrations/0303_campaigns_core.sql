-- =============================================================================
-- 0303_campaigns_core
-- -----------------------------------------------------------------------------
-- Lot 3 / L3B, commit 02 (jalons/l3b/02.md; fiche invariants 1, 3, 4, 9, 11, 13). The campaign as
-- the brand writes it, under RLS, in draft (09 blocks 1 to 8; 04 §5.4 as jalons/l3b/modele.md
-- reformulates it: modele.md PREVAILS for every name, §1 to §4 and §8).
--
-- 1. Types campaigns.campaign_status (the six states of 09 RG3) and campaigns.remuneration_kind
--    (cash, cash_and_gift, gift_only, affiliate; 09 RG62).
-- 2. Closed lists: reference.campaign_types (the seven of 09 RG18, no `other`, shape of
--    reference.usage_rights); campaigns.requested_items (five codes of 09 RG77, proposed_rate
--    INACTIVE, D78); campaigns.rejection_reasons (the fourteen of 09 RG90, shape of
--    profiles.creator_rejection_reasons; modele §3, not 04 l. 1747).
-- 3. campaigns.campaigns: one row per campaign, every entry column nullable (a draft keeps what was
--    entered, RG108). The budget band per creator is a COLUMN with a composite foreign key
--    (currency, code) -> reference.price_bands (Q16, modele §1); the exact range of RG55 is kept,
--    EMPTY and without any right (CHECK campaigns_exact_range_suspended_d78, D78). Checks in every
--    state (upper bounds, closed lists, the order of the four dates, the 12-month window, the
--    coherence of rights, product and gift); checks *_when_submitted outside draft, rejected and an
--    erased campaign (required fields, lower bounds, conditionals, the band unless gift only).
-- 4. Nine child tables, campaign_id first, capped by RANK (`slot` or `position` in the primary
--    key, pattern 0202), each code once: key messages (5), deliverables (10, network and format,
--    quantity 1 to 20), usage territories (5), audience countries (5), topics (3), requested items
--    (4, active code); audience languages, bands and age bands keyed by their code.
-- 5. Triggers: campaigns.guard_campaign_member_write() (the freeze, SECURITY INVOKER, pattern 0209):
--    under influx_advertiser or influx_campaign_definer (0305), 55000 campaign_not_editable on a
--    campaign whose former state is neither draft nor rejected, and on a child row of such a
--    campaign (read FOR SHARE); campaigns.check_deliverable_format() (23514 deliverable_format, -9);
--    campaigns.check_requested_item_active() (23514 requested_item_inactive, EC-L3B-02-2).
-- 6. Rights: RLS enabled and forced on every table; influx_advertiser reads his campaigns (the
--    exact range excepted), creates them in draft and updates the entry columns, never status,
--    submitted_at, erased_at, the declaration of RG85, the range nor advertiser_account_id; no
--    DELETE. Child tables: SELECT, INSERT, DELETE (a list is replaced in one transaction, never
--    updated) on the rows of his campaigns. influx_creator, influx_agent, influx_admin,
--    influx_worker, influx_identity_definer: NOTHING on campaigns.* (TM5.6; agent and admin come
--    with L3C). reference.campaign_types: read like every reference list (0201).
-- 7. The nine Lot 3 codes of 04 §4.3, each with its export_class (F3, 0302): campaign.submitted,
--    published, updated, rejected, paused, closed (exported), block.created and block.lifted
--    (excluded_third_party), search.settings_changed (exported). Only campaign.submitted is
--    written at L3B (0305); no campaign.created (-10).
--
-- RIGHTS (03 I-4, signalled): one schema USAGE (campaigns, to influx_advertiser), table and column
-- GRANTs and policies on the twelve tables of the schema and on reference.campaign_types, nine rows
-- of audit.event_types. No SECURITY DEFINER function: the three trigger functions are SECURITY
-- INVOKER, empty search_path, executed by nobody directly. Not here: the submission door, the
-- definer role and the creator view (0305), the export and the erasure (0306), the price bands
-- (0304), the routes (L3B-07).
--
-- EC-L3B-02 (micro-gaps, the safest choice):
--   EC-L3B-02-1  campaigns.rejection_reasons: its policy for influx_agent and influx_admin (aal2) is
--                written, WITHOUT any grant nor USAGE on the schema (modele §4: agent and admin hold
--                nothing at L3B, L3C grants the read). T2.2 requires a policy on every table; the
--                policy is inert without its grant.
--   EC-L3B-02-2  « code actif » of campaign_requested_items (modele §3) held by a trigger reading
--                campaigns.requested_items.is_active at the write (a code deactivated later stays
--                valid in the rows already written, as a retired reference code, EC-L2B-05-4).
--   EC-L3B-02-3  campaigns_dates_ordered written pair by pair: a partial calendar is checked on the
--                dates it holds (the single expression of 04 lets close > end through while the
--                start is empty).
--   EC-L3B-02-4  the declaration of RG85 is all or nothing (four columns), its locale fr or en, its
--                hash a SHA-256 (32 bytes): stricter than 04 l. 1991, never looser.
--   EC-L3B-02-5  campaigns_erased_is_closed: erased_at implies closed (modele §7).
--   EC-L3B-02-6  every *_when_submitted check reads coalesce(<rule>, false): a NULL never passes.
--   EC-L3B-02-7  label keys: reference.campaign_types `campaign_type.<code>`, requested items
--                `requested_item.<code>`, reasons `reason.campaigns.<code>` and
--                `campaignDecision.reason.<code>` (modele §3); illicit_content and other require
--                the agent's message, the three last ones lead to `contact`.
--   EC-L3B-02-8  advertiser_account_id references profiles.advertiser_profiles (account_id): a
--                campaign belongs to a brand profile, read live (RG2); every advertiser holds one
--                from the sign-up (0106).
--   EC-L3B-02-9  total_budget_minor > 0 (RG55 « Montant > 0 »); a key message holds 1 to 200
--                characters in any state, 10 at least to submit (0305, modele §5); free texts are
--                trimmed by the API (EC-L2B-06-4), the base holds the bounds only.
--
-- ROLLBACK (before any campaign is written): delete from audit.event_types the nine codes of §7
-- (possible while no line references them); drop table campaigns.campaign_requested_items,
-- campaigns.campaign_topics, campaigns.campaign_audience_age_bands,
-- campaigns.campaign_audience_bands, campaigns.campaign_audience_languages,
-- campaigns.campaign_audience_countries, campaigns.campaign_usage_territories,
-- campaigns.campaign_deliverables, campaigns.campaign_key_messages, campaigns.campaigns,
-- campaigns.rejection_reasons, campaigns.requested_items, reference.campaign_types; drop function
-- campaigns.guard_campaign_member_write(), campaigns.check_deliverable_format(),
-- campaigns.check_requested_item_active(); drop type campaigns.remuneration_kind,
-- campaigns.campaign_status; revoke usage on schema campaigns from influx_advertiser.
-- =============================================================================

-- 1. Types ------------------------------------------------------------------------------------------

do $$
begin
  create type campaigns.campaign_status as enum
    ('draft', 'pending_review', 'published', 'paused', 'closed', 'rejected');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type campaigns.remuneration_kind as enum
    ('cash', 'cash_and_gift', 'gift_only', 'affiliate');
exception
  when duplicate_object then null;
end
$$;

comment on type campaigns.campaign_status is
  'The six states of a campaign (09 RG3, 04 §5.4). A member door writes pending_review only (RG4, '
  'RG5: 0305); published, paused, closed and rejected belong to INFLUX (L3C).';
comment on type campaigns.remuneration_kind is
  'Nature of the consideration (09 RG62): an enum, the code branches on it (04 §3.1).';

-- 2. Closed lists -----------------------------------------------------------------------------------

create table if not exists reference.campaign_types (
  code           text        not null primary key,
  label_key      text        not null,
  sort_order     smallint    not null unique,
  introduced_at  timestamptz not null default now(),
  retired_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint campaign_types_code_format check (code ~ '^[a-z0-9]+(_[a-z0-9]+)*$' and length(code) <= 63),
  constraint campaign_types_label_key   check (label_key = 'campaign_type.' || code),
  constraint campaign_types_sort_order  check (sort_order >= 1),
  constraint campaign_types_retired     check (retired_at is null or retired_at >= introduced_at)
);

comment on table reference.campaign_types is
  'Campaign types (09 RG18, 04 §5.4): seven codes, NO `other` (a free text in disguise, '
  'matching-spec A2). Versioned: a served code is retired, never renamed.';

insert into reference.campaign_types (code, label_key, sort_order) values
  ('product_placement', 'campaign_type.product_placement', 1),
  ('ugc_delivered',     'campaign_type.ugc_delivered',     2),
  ('product_review',    'campaign_type.product_review',    3),
  ('ambassador',        'campaign_type.ambassador',        4),
  ('contest',           'campaign_type.contest',           5),
  ('event_presence',    'campaign_type.event_presence',    6),
  ('affiliate_program', 'campaign_type.affiliate_program', 7)
on conflict (code) do nothing;

create table if not exists campaigns.requested_items (
  code        text        not null primary key,
  label_key   text        not null,
  position    smallint    not null,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  constraint requested_items_code_shape      check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint requested_items_label_key       check (label_key = 'requested_item.' || code),
  constraint requested_items_position        check (position > 0),
  constraint requested_items_position_unique unique (position)
);

comment on table campaigns.requested_items is
  'What a brand may put forward to the creator (09 RG77): INFORMATIVE ONLY, it changes no field '
  'of the application form (11 RG47). proposed_rate is INACTIVE (D78: no creator rate entered nor '
  'announced); an inactive code is refused on a new row (campaigns.check_requested_item_active).';

insert into campaigns.requested_items (code, label_key, position, is_active) values
  ('motivation_message',    'requested_item.motivation_message',    1, true),
  ('past_content_examples', 'requested_item.past_content_examples', 2, true),
  ('concept_proposal',      'requested_item.concept_proposal',      3, true),
  ('proposed_rate',         'requested_item.proposed_rate',         4, false),
  ('availability',          'requested_item.availability',          5, true)
on conflict (code) do nothing;

create table if not exists campaigns.rejection_reasons (
  code                     text     not null primary key,
  label_key                text     not null,
  message_key              text     not null,
  requires_member_message  boolean  not null default false,
  next_step                text     not null,
  position                 smallint not null,
  is_active                boolean  not null default true,
  constraint rejection_reasons_code_shape check (code ~ '^[a-z][a-z_]*[a-z]$'),
  constraint rejection_reasons_label_key check (label_key = 'reason.campaigns.' || code),
  constraint rejection_reasons_message_key check (message_key = 'campaignDecision.reason.' || code),
  constraint rejection_reasons_next_step check (next_step in ('fix', 'contact')),
  constraint rejection_reasons_position check (position > 0),
  constraint rejection_reasons_position_unique unique (position)
);

comment on table campaigns.rejection_reasons is
  'The closed list of the refusal reasons of queue 7 (09 RG90, modele §3; 04 §3.1: one table per '
  'queue). next_step: fix (the brand corrects and submits again, RG10) or contact. Written by the '
  'migrations; read by agent and admin from L3C (EC-L3B-02-1).';

insert into campaigns.rejection_reasons
  (code, label_key, message_key, requires_member_message, next_step, position)
values
  ('contact_in_text',                  'reason.campaigns.contact_in_text',
   'campaignDecision.reason.contact_in_text',                  false, 'fix',      1),
  ('amount_in_text',                   'reason.campaigns.amount_in_text',
   'campaignDecision.reason.amount_in_text',                   false, 'fix',      2),
  ('link_in_text',                     'reason.campaigns.link_in_text',
   'campaignDecision.reason.link_in_text',                     false, 'fix',      3),
  ('brief_insufficient',               'reason.campaigns.brief_insufficient',
   'campaignDecision.reason.brief_insufficient',               false, 'fix',      4),
  ('deliverables_inconsistent',        'reason.campaigns.deliverables_inconsistent',
   'campaignDecision.reason.deliverables_inconsistent',        false, 'fix',      5),
  ('budget_inconsistent',              'reason.campaigns.budget_inconsistent',
   'campaignDecision.reason.budget_inconsistent',              false, 'fix',      6),
  ('calendar_invalid',                 'reason.campaigns.calendar_invalid',
   'campaignDecision.reason.calendar_invalid',                 false, 'fix',      7),
  ('creator_personal_criterion',       'reason.campaigns.creator_personal_criterion',
   'campaignDecision.reason.creator_personal_criterion',       false, 'fix',      8),
  ('minor_audience',                   'reason.campaigns.minor_audience',
   'campaignDecision.reason.minor_audience',                   false, 'fix',      9),
  ('concealed_advertising',            'reason.campaigns.concealed_advertising',
   'campaignDecision.reason.concealed_advertising',            false, 'fix',     10),
  ('duplicate',                        'reason.campaigns.duplicate',
   'campaignDecision.reason.duplicate',                        false, 'fix',     11),
  ('sensitive_authorizations_missing', 'reason.campaigns.sensitive_authorizations_missing',
   'campaignDecision.reason.sensitive_authorizations_missing', false, 'contact', 12),
  ('illicit_content',                  'reason.campaigns.illicit_content',
   'campaignDecision.reason.illicit_content',                  true,  'contact', 13),
  ('other',                            'reason.campaigns.other',
   'campaignDecision.reason.other',                            true,  'contact', 14)
on conflict (code) do nothing;

-- 3. campaigns.campaigns (modele §1, §2) ---------------------------------------------------------

create table if not exists campaigns.campaigns (
  id                                     uuid        not null primary key default gen_random_uuid(),
  advertiser_account_id                  uuid        not null
                                                     references profiles.advertiser_profiles (account_id),
  status                                 campaigns.campaign_status not null default 'draft',
  -- block 1: identification and texts
  title                                  text,
  campaign_type_code                     text        references reference.campaign_types (code),
  public_summary                         text,
  brief                                  text,
  internal_reference                     text,
  -- block 2: product and gift
  product_description                    text,
  sector_code                            text        references reference.sectors (code),
  restrictions                           text,
  product_is_sent                        boolean,
  product_value_band_code                text,
  creator_keeps_product                  boolean,
  shipping_costs_borne_by                text,
  -- block 3: deliverables, rights and exclusivity
  usage_rights_code                      text        references reference.usage_rights (code),
  usage_rights_duration_band             text,
  usage_rights_territory_scope           text,
  exclusivity_band                       text,
  content_review_delay                   text,
  -- block 4: audience
  audience_gender_code                   text        references reference.audience_genders (code),
  -- block 5: budget
  currency                               char(3)     references reference.currencies (code),
  remuneration_kind                      campaigns.remuneration_kind,
  per_creator_budget_band_code           text,
  per_creator_amount_min_minor           bigint,
  per_creator_amount_max_minor           bigint,
  creators_wanted                        smallint,
  total_budget_minor                     bigint,
  -- block 6: calendar, four civil dates (09 RG69, RG73)
  applications_close_on                  date,
  content_due_on                         date,
  starts_on                              date,
  ends_on                                date,
  -- block 7: application
  max_applications                       smallint,
  -- block 8: the declaration of RG85, written by the submission door only (0305)
  authorizations_declared_at             timestamptz,
  authorizations_declared_by_account_id  uuid        references identity.accounts (id),
  authorizations_declaration_locale      char(2),
  authorizations_declaration_hash        bytea,
  -- cycle
  submitted_at                           timestamptz,
  erased_at                              timestamptz,
  created_at                             timestamptz not null default now(),
  updated_at                             timestamptz not null default now(),

  -- Q16 (modele §1): a band chosen in the currency of the campaign, never derived nor computed
  constraint campaigns_product_value_band_fk
    foreign key (currency, product_value_band_code)
    references reference.price_bands (currency, code),
  constraint campaigns_budget_band_fk
    foreign key (currency, per_creator_budget_band_code)
    references reference.price_bands (currency, code),

  -- In every state: upper bounds (modele §2) ------------------------------------------------------
  constraint campaigns_title_length            check (char_length(title) <= 140),
  constraint campaigns_public_summary_length   check (char_length(public_summary) <= 400),
  constraint campaigns_brief_length            check (char_length(brief) <= 4000),
  constraint campaigns_product_length          check (char_length(product_description) <= 600),
  constraint campaigns_restrictions_length     check (char_length(restrictions) <= 1000),
  constraint campaigns_internal_reference_length check (char_length(internal_reference) <= 40),
  -- closed lists (04 §5.4; 09 RG39, RG42; RG44 -> content_review_delay, -2)
  constraint campaigns_shipping_costs_borne_by check (shipping_costs_borne_by in ('brand', 'creator')),
  constraint campaigns_usage_rights_duration_band
    check (usage_rights_duration_band in ('1m', '3m', '6m', '12m', 'unlimited')),
  constraint campaigns_usage_rights_territory_scope
    check (usage_rights_territory_scope in ('worldwide', 'selected_countries')),
  constraint campaigns_exclusivity_band check (exclusivity_band in ('none', 'le_1m', 'le_3m', 'negotiable')),
  constraint campaigns_content_review_delay check (content_review_delay in ('48h', '5bd', '10bd')),
  -- 09 RG66, RG78 (modele §2), RG55
  constraint campaigns_creators_wanted   check (creators_wanted between 1 and 50),
  constraint campaigns_max_applications  check (max_applications between 1 and 200),
  constraint campaigns_total_budget_positive check (total_budget_minor > 0),
  -- RG70: the four dates in order, pair by pair (EC-L3B-02-3)
  constraint campaigns_dates_ordered
    check (applications_close_on <= content_due_on
           and applications_close_on <= starts_on
           and applications_close_on <= ends_on
           and content_due_on <= starts_on
           and content_due_on <= ends_on
           and starts_on <= ends_on),
  -- RG74: beyond 12 months it is an ambassador contract, not a campaign
  constraint campaigns_publication_window_max_12m
    check (ends_on <= starts_on + interval '12 months'),
  -- RG39: `none` grants no right, so no duration nor territory
  constraint campaigns_usage_rights_none_has_no_terms
    check (usage_rights_code <> 'none'
           or num_nonnulls(usage_rights_duration_band, usage_rights_territory_scope) = 0),
  -- RG43: a UGC campaign grants rights
  constraint campaigns_ugc_requires_usage_rights
    check (campaign_type_code <> 'ugc_delivered' or usage_rights_code <> 'none'),
  -- RG24, RG29: a product not sent has no value, no keeping, no shipping
  constraint campaigns_product_not_sent_has_no_details
    check (product_is_sent is distinct from false
           or num_nonnulls(product_value_band_code, creator_keeps_product, shipping_costs_borne_by) = 0),
  -- RG62, RG63 (-7): a gift is a product, so a gift kind never says « no product sent »
  constraint campaigns_gift_kinds_require_product
    check (remuneration_kind not in ('cash_and_gift', 'gift_only') or product_is_sent is distinct from false),
  -- CA76: « gift only » has no budget band
  constraint campaigns_gift_only_has_no_budget_band
    check (remuneration_kind <> 'gift_only' or per_creator_budget_band_code is null),
  -- R3: an amount or a band without its currency does not exist (and MATCH SIMPLE would let a band
  -- without currency escape its foreign key)
  constraint campaigns_amounts_need_currency
    check (num_nonnulls(per_creator_budget_band_code, product_value_band_code, total_budget_minor,
                        per_creator_amount_min_minor, per_creator_amount_max_minor) = 0
           or currency is not null),
  -- D78 (modele §1): the exact range of RG55 is kept, EMPTY, and lifted with D78 only
  constraint campaigns_exact_range_suspended_d78
    check (num_nonnulls(per_creator_amount_min_minor, per_creator_amount_max_minor) = 0),
  -- RG85: the declaration, all or nothing (EC-L3B-02-4)
  constraint campaigns_declaration_is_complete
    check (num_nonnulls(authorizations_declared_at, authorizations_declared_by_account_id,
                        authorizations_declaration_locale, authorizations_declaration_hash) in (0, 4)),
  constraint campaigns_declaration_locale check (authorizations_declaration_locale in ('fr', 'en')),
  constraint campaigns_declaration_hash_sha256 check (octet_length(authorizations_declaration_hash) = 32),
  -- modele §7 (EC-L3B-02-5)
  constraint campaigns_erased_is_closed check (erased_at is null or status = 'closed'),

  -- Outside draft, rejected and an erased campaign (modele §2, EC-L3B-02-6) ----------------------
  constraint campaigns_required_when_submitted
    check (status in ('draft', 'rejected') or erased_at is not null
           or num_nonnulls(title, campaign_type_code, public_summary, brief, product_description,
                           sector_code, product_is_sent, usage_rights_code, exclusivity_band,
                           content_review_delay, currency, remuneration_kind, creators_wanted,
                           applications_close_on, starts_on, ends_on) = 16),
  constraint campaigns_text_minimums_when_submitted
    check (status in ('draft', 'rejected') or erased_at is not null
           or coalesce(char_length(title) >= 10
                       and char_length(public_summary) >= 120
                       and char_length(brief) >= 300
                       and char_length(product_description) >= 20, false)),
  constraint campaigns_product_details_when_submitted
    check (status in ('draft', 'rejected') or erased_at is not null
           or coalesce(not product_is_sent
                       or num_nonnulls(product_value_band_code, creator_keeps_product,
                                       shipping_costs_borne_by) = 3, false)),
  constraint campaigns_usage_terms_when_submitted
    check (status in ('draft', 'rejected') or erased_at is not null
           or coalesce(usage_rights_code = 'none'
                       or num_nonnulls(usage_rights_duration_band, usage_rights_territory_scope) = 2,
                       false)),
  -- Q16 (modele §1): a band unless « gift only »; affiliation included (RG64)
  constraint campaigns_budget_band_when_submitted
    check (status in ('draft', 'rejected') or erased_at is not null
           or coalesce(remuneration_kind = 'gift_only' or per_creator_budget_band_code is not null,
                       false))
);

create index if not exists campaigns_advertiser_status_idx
  on campaigns.campaigns (advertiser_account_id, status);

comment on table campaigns.campaigns is
  'A campaign of a brand (09 blocks 1 to 8; 04 §5.4 as jalons/l3b/modele.md reformulates it). '
  'Written by its brand in draft or rejected only (the freeze, campaigns.guard_campaign_member_write); '
  'submitted by the door of 0305. NEVER read by influx_creator: the creator view is a projection '
  '(0305, modele §6) without currency, bands, total budget, internal reference, declaration nor '
  'sensitivity (D78, RG65). The sensitive character of the sector is read by join, never copied '
  'here (RG84).';
comment on column campaigns.campaigns.internal_reference is
  'The brand''s own reference (09 RG16), at most 40 characters: INTERNAL to the brand, never served '
  'to a creator.';
comment on column campaigns.campaigns.content_review_delay is
  'Time the brand takes to review a content (09 RG44, modele -2): 48h, 5bd, 10bd (business days).';
comment on column campaigns.campaigns.audience_gender_code is
  'Gender split of the AUDIENCE aimed at, never of the creator (09 RG47, RG52); NULL means '
  '« indifferent », never a default.';
comment on column campaigns.campaigns.per_creator_budget_band_code is
  'Budget band per creator (Q16, D78), chosen by the brand in the currency of the campaign: total '
  'cost to the advertiser, INFLUX commission included (RG56). INTERNAL: the brand and INFLUX only, '
  'never served to a creator, not even empty. Required unless gift only (CA76).';
comment on column campaigns.campaigns.per_creator_amount_min_minor is
  'Exact range of RG55, SUSPENDED (D78): kept empty by campaigns_exact_range_suspended_d78, no role '
  'holds any right on it. Lifted with D78 only.';
comment on column campaigns.campaigns.per_creator_amount_max_minor is
  'Exact range of RG55, SUSPENDED (D78): see per_creator_amount_min_minor.';
comment on column campaigns.campaigns.total_budget_minor is
  'Total budget of the campaign, in the minor unit of its currency (09 RG65): INTERNAL, never in a '
  'response served to a creator, not even null. No computation is ever made on it (T16.1).';
comment on column campaigns.campaigns.authorizations_declaration_hash is
  'SHA-256 of the exact text of the declaration of RG85 shown to the brand (32 bytes), with its '
  'locale, author and instant: written by the submission door (0305), never by the brand directly.';
comment on column campaigns.campaigns.submitted_at is
  'Last submission (0305). Written by the door only.';
comment on column campaigns.campaigns.erased_at is
  'Erasure of the advertiser account (modele §7, 0306): the campaign is closed and its texts emptied.';

drop trigger if exists campaigns_touch_updated_at on campaigns.campaigns;
create trigger campaigns_touch_updated_at
  before update on campaigns.campaigns
  for each row execute function influx.touch_updated_at();

-- 4. The child tables (modele §3) --------------------------------------------------------------------

create table if not exists campaigns.campaign_key_messages (
  campaign_id  uuid        not null references campaigns.campaigns (id),
  position     smallint    not null,
  body         text        not null,
  created_at   timestamptz not null default now(),
  primary key (campaign_id, position),
  -- 09 RG24, RG27: one to five key messages
  constraint campaign_key_messages_position check (position between 1 and 5),
  -- 10 to 200 to submit (0305); 200 at most in any state (EC-L3B-02-9)
  constraint campaign_key_messages_body_length check (char_length(body) between 1 and 200)
);

create table if not exists campaigns.campaign_deliverables (
  campaign_id   uuid        not null references campaigns.campaigns (id),
  slot          smallint    not null,
  network_code  text        not null references reference.networks (code),
  format_code   text        not null references reference.formats (code),
  quantity      smallint    not null,
  created_at    timestamptz not null default now(),
  primary key (campaign_id, slot),
  -- RG36: two identical lines are one line with a quantity
  constraint campaign_deliverables_once unique (campaign_id, network_code, format_code),
  -- RG37: ten lines at most
  constraint campaign_deliverables_slot check (slot between 1 and 10),
  -- RG36: 1 to 20 per line
  constraint campaign_deliverables_quantity check (quantity between 1 and 20)
);

create table if not exists campaigns.campaign_usage_territories (
  campaign_id   uuid        not null references campaigns.campaigns (id),
  slot          smallint    not null,
  country_code  char(2)     not null references reference.countries (code),
  created_at    timestamptz not null default now(),
  primary key (campaign_id, slot),
  constraint campaign_usage_territories_once unique (campaign_id, country_code),
  constraint campaign_usage_territories_slot check (slot between 1 and 5)
);

create table if not exists campaigns.campaign_audience_countries (
  campaign_id   uuid        not null references campaigns.campaigns (id),
  slot          smallint    not null,
  country_code  char(2)     not null references reference.countries (code),
  created_at    timestamptz not null default now(),
  primary key (campaign_id, slot),
  constraint campaign_audience_countries_once unique (campaign_id, country_code),
  -- RG46, RG49: five countries at most, the cap of the brand profile
  constraint campaign_audience_countries_slot check (slot between 1 and 5)
);

create table if not exists campaigns.campaign_audience_languages (
  campaign_id    uuid        not null references campaigns.campaigns (id),
  language_code  char(2)     not null references reference.languages (code),
  created_at     timestamptz not null default now(),
  primary key (campaign_id, language_code)
);

create table if not exists campaigns.campaign_audience_bands (
  campaign_id         uuid        not null references campaigns.campaigns (id),
  audience_band_code  text        not null references reference.audience_bands (code),
  created_at          timestamptz not null default now(),
  primary key (campaign_id, audience_band_code)
);

create table if not exists campaigns.campaign_audience_age_bands (
  campaign_id    uuid        not null references campaigns.campaigns (id),
  age_band_code  text        not null references reference.age_bands (code),
  created_at     timestamptz not null default now(),
  primary key (campaign_id, age_band_code)
);

create table if not exists campaigns.campaign_topics (
  campaign_id  uuid        not null references campaigns.campaigns (id),
  slot         smallint    not null,
  topic_code   text        not null references reference.topics (code),
  created_at   timestamptz not null default now(),
  primary key (campaign_id, slot),
  constraint campaign_topics_once unique (campaign_id, topic_code),
  -- RG46: one to three topics
  constraint campaign_topics_slot check (slot between 1 and 3)
);

create table if not exists campaigns.campaign_requested_items (
  campaign_id  uuid        not null references campaigns.campaigns (id),
  slot         smallint    not null,
  item_code    text        not null references campaigns.requested_items (code),
  created_at   timestamptz not null default now(),
  primary key (campaign_id, slot),
  constraint campaign_requested_items_once unique (campaign_id, item_code),
  -- RG77: four at most
  constraint campaign_requested_items_slot check (slot between 1 and 4)
);

comment on table campaigns.campaign_key_messages is
  'Key messages of a campaign (09 RG24, RG27): one to five (position 1 to 5), moderated one by one.';
comment on table campaigns.campaign_deliverables is
  'Deliverable lines (09 RG36, RG37): (network, format, quantity), ten at most, each pair once. A '
  'format without network (ugc_*) goes with any network; otherwise its own (check_deliverable_format).';
comment on table campaigns.campaign_usage_territories is
  'Countries of the usage rights when the scope is selected_countries (09 RG39): five at most. The '
  '« at least one » is the submission''s (0305), not a declarative rule.';
comment on table campaigns.campaign_audience_countries is
  'Audience countries aimed at (09 RG46, RG49): five at most. The audience, never the creator.';
comment on table campaigns.campaign_audience_languages is
  'Expected publication languages (09 RG46).';
comment on table campaigns.campaign_audience_bands is
  'Audience size bands wished (09 RG46, RG50): codes of reference.audience_bands, never a number.';
comment on table campaigns.campaign_audience_age_bands is
  'Age bands of the audience (09 RG46, RG51): from 18 only (D15).';
comment on table campaigns.campaign_topics is
  'Topics aimed at (09 RG46): one to three (slot 1 to 3).';
comment on table campaigns.campaign_requested_items is
  'Items the brand puts forward to the creator (09 RG77): four at most, active codes only. '
  'INFORMATIVE ONLY: it changes no field of the application form (11 RG47); a read of this table that '
  'conditions a form field is a defect.';

-- 5. Triggers ------------------------------------------------------------------------------------------

-- 5.1 The freeze (modele §4; pattern 0209) ------------------------------------------------------------

create or replace function campaigns.guard_campaign_member_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_campaign  uuid;
  v_status    text;
begin
  -- The two roles a brand acts under; the erasure (0306) and INFLUX (L3C) are not members.
  if current_user not in ('influx_advertiser', 'influx_campaign_definer') then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_table_name = 'campaigns' then
    -- a BEFORE ROW trigger sees the latest version of the row it updates: its FORMER state
    v_status := old.status::text;
  else
    if tg_op = 'DELETE' then
      v_campaign := old.campaign_id;
    else
      v_campaign := new.campaign_id;
    end if;
    -- FOR SHARE: a decision (L3C) waits for this write, or this write waits for the decision. No
    -- row (somebody else's campaign): the policy of the table refuses it.
    select c.status::text into v_status
      from campaigns.campaigns c
     where c.id = v_campaign
       for share of c;
  end if;

  if v_status is not null and v_status not in ('draft', 'rejected') then
    raise exception 'campaign_not_editable'
      using errcode = 'object_not_in_prerequisite_state', detail = 'campaign_not_editable';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

comment on function campaigns.guard_campaign_member_write() is
  'modele §4: BEFORE trigger on a campaign and its nine child tables. When current_user is '
  'influx_advertiser or influx_campaign_definer: 55000 campaign_not_editable unless the former state '
  'of the campaign is draft or rejected (INFLUX examines the submitted version; L3C recreates the '
  'guard, RG7). SECURITY INVOKER (it reads current_user), empty search_path, executed by nobody '
  'directly.';

revoke all on function campaigns.guard_campaign_member_write()
  from public, anon, authenticated, service_role;

drop trigger if exists campaign_member_write_guard on campaigns.campaigns;
create trigger campaign_member_write_guard
  before update on campaigns.campaigns
  for each row execute function campaigns.guard_campaign_member_write();

do $$
declare
  t text;
begin
  foreach t in array array[
    'campaign_key_messages', 'campaign_deliverables', 'campaign_usage_territories',
    'campaign_audience_countries', 'campaign_audience_languages', 'campaign_audience_bands',
    'campaign_audience_age_bands', 'campaign_topics', 'campaign_requested_items']
  loop
    execute format('drop trigger if exists campaign_member_write_guard on campaigns.%I', t);
    execute format('create trigger campaign_member_write_guard '
                   'before insert or update or delete on campaigns.%I '
                   'for each row execute function campaigns.guard_campaign_member_write()', t);
  end loop;
end
$$;

-- 5.2 A format goes with its network (modele §3, -9) -------------------------------------------------

create or replace function campaigns.check_deliverable_format()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_network  text;
begin
  select f.network_code into v_network
    from reference.formats f
   where f.code = new.format_code;
  -- a format without network (ugc_*) goes with any network the brand publishes on; an unknown
  -- format is the foreign key's
  if v_network is not null and v_network <> new.network_code then
    raise exception 'deliverable_format'
      using errcode = 'check_violation', constraint = 'deliverable_format',
            detail = 'deliverable_format';
  end if;
  return new;
end
$$;

comment on function campaigns.check_deliverable_format() is
  'modele §3 (-9), 09 RG36: a deliverable line whose format belongs to a network names that network; '
  'a format without network (ugc_*) goes with any. 23514, constraint and DETAIL deliverable_format. '
  'SECURITY INVOKER, empty search_path, executed by nobody directly.';

revoke all on function campaigns.check_deliverable_format()
  from public, anon, authenticated, service_role;

drop trigger if exists campaign_deliverables_format_check on campaigns.campaign_deliverables;
create trigger campaign_deliverables_format_check
  before insert or update on campaigns.campaign_deliverables
  for each row execute function campaigns.check_deliverable_format();

-- 5.3 An active requested item (modele §3, EC-L3B-02-2) ----------------------------------------------

create or replace function campaigns.check_requested_item_active()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (select 1 from campaigns.requested_items i
              where i.code = new.item_code and not i.is_active) then
    raise exception 'requested_item_inactive'
      using errcode = 'check_violation', constraint = 'requested_item_inactive',
            detail = 'requested_item_inactive';
  end if;
  return new;
end
$$;

comment on function campaigns.check_requested_item_active() is
  'modele §3, D78 (EC-L3B-02-2): a requested item is written with an ACTIVE code only (proposed_rate '
  'is not). 23514, constraint and DETAIL requested_item_inactive. SECURITY INVOKER, empty '
  'search_path, executed by nobody directly.';

revoke all on function campaigns.check_requested_item_active()
  from public, anon, authenticated, service_role;

drop trigger if exists campaign_requested_items_active_check on campaigns.campaign_requested_items;
create trigger campaign_requested_items_active_check
  before insert or update on campaigns.campaign_requested_items
  for each row execute function campaigns.check_requested_item_active();

-- 6. Row level security and the rights of the business roles (modele §4) ----------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'campaigns', 'campaign_key_messages', 'campaign_deliverables', 'campaign_usage_territories',
    'campaign_audience_countries', 'campaign_audience_languages', 'campaign_audience_bands',
    'campaign_audience_age_bands', 'campaign_topics', 'campaign_requested_items',
    'requested_items', 'rejection_reasons']
  loop
    execute format('alter table campaigns.%I enable row level security', t);
    execute format('alter table campaigns.%I force row level security', t);
    execute format('revoke all on campaigns.%I from public, anon, authenticated, service_role', t);
  end loop;
end
$$;

-- 6.1 reference.campaign_types: read like every reference list (0201 §5) ----------------------------

alter table reference.campaign_types enable row level security;
alter table reference.campaign_types force row level security;
revoke all on reference.campaign_types from public, anon, authenticated, service_role;
grant select on reference.campaign_types
   to influx_advertiser, influx_creator, influx_agent, influx_admin;

drop policy if exists campaign_types_read_members on reference.campaign_types;
create policy campaign_types_read_members on reference.campaign_types
  for select to influx_advertiser, influx_creator
  using ((select influx.current_account_id()) is not null);

drop policy if exists campaign_types_read_internal on reference.campaign_types;
create policy campaign_types_read_internal on reference.campaign_types
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

drop trigger if exists campaign_types_touch_updated_at on reference.campaign_types;
create trigger campaign_types_touch_updated_at
  before update on reference.campaign_types
  for each row execute function influx.touch_updated_at();

-- 6.2 The schema: the brand only (influx_creator NOTHING, TM5.6) -----------------------------------

grant usage on schema campaigns to influx_advertiser;

-- 6.3 The campaign: the brand reads his own (the suspended range excepted), creates it in draft and
-- writes the entry columns; never the state, the cycle, the declaration, the range nor the owner --

grant select (id, advertiser_account_id, status, title, campaign_type_code, public_summary, brief,
              internal_reference, product_description, sector_code, restrictions, product_is_sent,
              product_value_band_code, creator_keeps_product, shipping_costs_borne_by,
              usage_rights_code, usage_rights_duration_band, usage_rights_territory_scope,
              exclusivity_band, content_review_delay, audience_gender_code, currency,
              remuneration_kind, per_creator_budget_band_code, creators_wanted, total_budget_minor,
              applications_close_on, content_due_on, starts_on, ends_on, max_applications,
              authorizations_declared_at, authorizations_declared_by_account_id,
              authorizations_declaration_locale, authorizations_declaration_hash, submitted_at,
              erased_at, created_at, updated_at)
   on campaigns.campaigns to influx_advertiser;

grant insert (advertiser_account_id, title, campaign_type_code, public_summary, brief,
              internal_reference, product_description, sector_code, restrictions, product_is_sent,
              product_value_band_code, creator_keeps_product, shipping_costs_borne_by,
              usage_rights_code, usage_rights_duration_band, usage_rights_territory_scope,
              exclusivity_band, content_review_delay, audience_gender_code, currency,
              remuneration_kind, per_creator_budget_band_code, creators_wanted, total_budget_minor,
              applications_close_on, content_due_on, starts_on, ends_on, max_applications)
   on campaigns.campaigns to influx_advertiser;

grant update (title, campaign_type_code, public_summary, brief, internal_reference,
              product_description, sector_code, restrictions, product_is_sent,
              product_value_band_code, creator_keeps_product, shipping_costs_borne_by,
              usage_rights_code, usage_rights_duration_band, usage_rights_territory_scope,
              exclusivity_band, content_review_delay, audience_gender_code, currency,
              remuneration_kind, per_creator_budget_band_code, creators_wanted, total_budget_minor,
              applications_close_on, content_due_on, starts_on, ends_on, max_applications)
   on campaigns.campaigns to influx_advertiser;

drop policy if exists campaigns_member_select_own on campaigns.campaigns;
create policy campaigns_member_select_own on campaigns.campaigns
  for select to influx_advertiser
  using (advertiser_account_id = (select influx.current_account_id()));

-- CA2: any active advertiser creates a draft; the profile blocks the submission only (0305)
drop policy if exists campaigns_member_insert_own on campaigns.campaigns;
create policy campaigns_member_insert_own on campaigns.campaigns
  for insert to influx_advertiser
  with check (advertiser_account_id = (select influx.current_account_id()) and status = 'draft');

drop policy if exists campaigns_member_update_own on campaigns.campaigns;
create policy campaigns_member_update_own on campaigns.campaigns
  for update to influx_advertiser
  using (advertiser_account_id = (select influx.current_account_id()))
  with check (advertiser_account_id = (select influx.current_account_id()));

-- 6.4 The child tables: the brand reads, adds and removes the rows of his campaigns (a list is
-- replaced in one transaction, never updated) ------------------------------------------------------

do $$
declare
  l record;
begin
  for l in
    select * from (values
      ('campaign_key_messages',       'position, body'),
      ('campaign_deliverables',       'slot, network_code, format_code, quantity'),
      ('campaign_usage_territories',  'slot, country_code'),
      ('campaign_audience_countries', 'slot, country_code'),
      ('campaign_audience_languages', 'language_code'),
      ('campaign_audience_bands',     'audience_band_code'),
      ('campaign_audience_age_bands', 'age_band_code'),
      ('campaign_topics',             'slot, topic_code'),
      ('campaign_requested_items',    'slot, item_code')
    ) as v (name, columns)
  loop
    execute format('grant select, delete on campaigns.%I to influx_advertiser', l.name);
    execute format('grant insert (campaign_id, %s) on campaigns.%I to influx_advertiser',
                   l.columns, l.name);

    execute format('drop policy if exists %I on campaigns.%I', l.name || '_member_select_own', l.name);
    execute format('create policy %I on campaigns.%I for select to influx_advertiser '
                   'using (exists (select 1 from campaigns.campaigns c '
                   'where c.id = %I.campaign_id '
                   'and c.advertiser_account_id = (select influx.current_account_id())))',
                   l.name || '_member_select_own', l.name, l.name);
    execute format('drop policy if exists %I on campaigns.%I', l.name || '_member_insert_own', l.name);
    execute format('create policy %I on campaigns.%I for insert to influx_advertiser '
                   'with check (exists (select 1 from campaigns.campaigns c '
                   'where c.id = %I.campaign_id '
                   'and c.advertiser_account_id = (select influx.current_account_id())))',
                   l.name || '_member_insert_own', l.name, l.name);
    execute format('drop policy if exists %I on campaigns.%I', l.name || '_member_delete_own', l.name);
    execute format('create policy %I on campaigns.%I for delete to influx_advertiser '
                   'using (exists (select 1 from campaigns.campaigns c '
                   'where c.id = %I.campaign_id '
                   'and c.advertiser_account_id = (select influx.current_account_id())))',
                   l.name || '_member_delete_own', l.name, l.name);
  end loop;
end
$$;

-- 6.5 The closed lists of the schema ----------------------------------------------------------------

-- the brand reads the items it may put forward (the form offers the active ones)
grant select on campaigns.requested_items to influx_advertiser;

drop policy if exists requested_items_member_select on campaigns.requested_items;
create policy requested_items_member_select on campaigns.requested_items
  for select to influx_advertiser
  using ((select influx.current_account_id()) is not null);

-- EC-L3B-02-1: the read of queue 7 is written, granted by L3C only
drop policy if exists rejection_reasons_internal_select on campaigns.rejection_reasons;
create policy rejection_reasons_internal_select on campaigns.rejection_reasons
  for select to influx_agent, influx_admin
  using ((select influx.has_aal2()));

-- 7. The Lot 3 codes of 04 §4.3, with their export_class (F3, 0302) -------------------------------

insert into audit.event_types (code, domain, subject_type, severity, export_class) values
  -- 09 RG4: the brand submits its campaign (draft or rejected -> pending_review), 0305
  ('campaign.submitted',      'campaigns', 'campaign',       'info',      'exported'),
  -- 09 RG5: the human decision of publication, with one or both reviewers (L3C)
  ('campaign.published',      'campaigns', 'campaign',       'sensitive', 'exported'),
  -- 09 RG7: a change of a published campaign, with the regime applied (L3C)
  ('campaign.updated',        'campaigns', 'campaign',       'info',      'exported'),
  -- 09 RG9, RG90: a refusal with its typed reason (L3C)
  ('campaign.rejected',       'campaigns', 'campaign',       'sensitive', 'exported'),
  ('campaign.paused',         'campaigns', 'campaign',       'info',      'exported'),
  ('campaign.closed',         'campaigns', 'campaign',       'info',      'exported'),
  -- 10 RG28: one party against another, silent for the blocked party (art. 15(4), F3)
  ('block.created',           'matching',  'party_block',    'sensitive', 'excluded_third_party'),
  ('block.lifted',            'matching',  'party_block',    'sensitive', 'excluded_third_party'),
  -- 10 RG2, RG11: a search setting or a facet changed
  ('search.settings_changed', 'search',    'search_setting', 'sensitive', 'exported')
on conflict (code) do nothing;

-- 8. End-state assertions ---------------------------------------------------------------------------

do $$
declare
  c_children constant text[] := array[
    'campaigns.campaign_key_messages', 'campaigns.campaign_deliverables',
    'campaigns.campaign_usage_territories', 'campaigns.campaign_audience_countries',
    'campaigns.campaign_audience_languages', 'campaigns.campaign_audience_bands',
    'campaigns.campaign_audience_age_bands', 'campaigns.campaign_topics',
    'campaigns.campaign_requested_items'];
  c_frozen_columns constant text[] := array[
    'id', 'advertiser_account_id', 'status', 'submitted_at', 'erased_at',
    'authorizations_declared_at', 'authorizations_declared_by_account_id',
    'authorizations_declaration_locale', 'authorizations_declaration_hash',
    'per_creator_amount_min_minor', 'per_creator_amount_max_minor', 'created_at', 'updated_at'];
  v_bad  text;
  v_fn   text;
begin
  -- D78, TM5.6 (fiche invariant 1): influx_creator holds nothing on the schema campaigns, nor do
  -- the roles that come with L3C or never: no USAGE, no table or column right, no EXECUTE
  select string_agg(r, ', ') into v_bad
    from unnest(array['influx_creator', 'influx_agent', 'influx_admin', 'influx_worker',
                      'influx_identity_definer', 'influx_auth', 'influx_privacy']) r
   where pg_catalog.has_schema_privilege(r, 'campaigns', 'USAGE')
      or pg_catalog.has_schema_privilege(r, 'campaigns', 'CREATE');
  if v_bad is not null then
    raise exception 'USAGE or CREATE on schema campaigns held by: %', v_bad;
  end if;

  select string_agg(r || ' ' || p || ' ' || c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace,
         unnest(array['influx_creator', 'influx_agent', 'influx_admin', 'influx_worker',
                      'influx_identity_definer', 'influx_auth', 'influx_privacy']) r,
         unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
   where n.nspname = 'campaigns' and c.relkind in ('r', 'p', 'v', 'm')
     and (pg_catalog.has_table_privilege(r, c.oid, p)
          or (p <> 'DELETE' and pg_catalog.has_any_column_privilege(r, c.oid, p)));
  if v_bad is not null then
    raise exception 'right(s) on campaigns.* outside the brand at L3B: %', v_bad;
  end if;

  -- modele §4: the brand never writes the state, the cycle, the declaration, the range nor the
  -- owner (its insert names the owner, checked by the policy), never deletes a campaign, never
  -- reads the suspended range, never updates a list row
  select string_agg(col || ' ' || p, ', ') into v_bad
    from unnest(c_frozen_columns) col, unnest(array['UPDATE', 'INSERT']) p
   where pg_catalog.has_column_privilege('influx_advertiser', 'campaigns.campaigns', col, p)
     and not (p = 'INSERT' and col = 'advertiser_account_id');
  if v_bad is not null then
    raise exception 'influx_advertiser may write campaigns.campaigns: %', v_bad;
  end if;
  if pg_catalog.has_table_privilege('influx_advertiser', 'campaigns.campaigns', 'DELETE')
     or pg_catalog.has_column_privilege('influx_advertiser', 'campaigns.campaigns',
                                        'per_creator_amount_min_minor', 'SELECT')
     or pg_catalog.has_column_privilege('influx_advertiser', 'campaigns.campaigns',
                                        'per_creator_amount_max_minor', 'SELECT') then
    raise exception 'influx_advertiser may delete a campaign or read the suspended range (D78)';
  end if;
  select string_agg(t, ', ') into v_bad
    from unnest(c_children) t
   where pg_catalog.has_any_column_privilege('influx_advertiser', t, 'UPDATE');
  if v_bad is not null then
    raise exception 'influx_advertiser may update a list row (a list is replaced): %', v_bad;
  end if;

  -- nobody else but the brand on the lists and the campaign; nothing to the Data API roles
  select string_agg(r || ' ' || c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace,
         unnest(array['anon', 'authenticated', 'service_role']) r
   where (n.nspname = 'campaigns' or c.oid = 'reference.campaign_types'::regclass)
     and c.relkind in ('r', 'p')
     and (pg_catalog.has_table_privilege(r, c.oid, 'SELECT, INSERT, UPDATE, DELETE')
          or pg_catalog.has_any_column_privilege(r, c.oid, 'SELECT, INSERT, UPDATE'));
  if v_bad is not null then
    raise exception 'Data API role(s) hold a right: %', v_bad;
  end if;

  -- RLS enabled and forced on every table of the schema and on reference.campaign_types
  select string_agg(c.oid::regclass::text, ', ') into v_bad
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where (n.nspname = 'campaigns' or c.oid = 'reference.campaign_types'::regclass)
     and c.relkind in ('r', 'p')
     and not (c.relrowsecurity and c.relforcerowsecurity);
  if v_bad is not null then
    raise exception 'row level security not enabled and forced on: %', v_bad;
  end if;
  if (select count(*) from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'campaigns' and c.relkind in ('r', 'p')) <> 12 then
    raise exception 'the schema campaigns holds exactly the twelve tables of 0303';
  end if;

  -- fiche invariant 9, F3: the nine Lot 3 codes, each with its class; no code without a class
  if (select count(*) from audit.event_types where export_class is null) <> 0 then
    raise exception 'a code of audit.event_types has no export_class';
  end if;
  if (select array_agg(code || '=' || export_class order by code) from audit.event_types
       where code in ('campaign.submitted', 'campaign.published', 'campaign.updated',
                      'campaign.rejected', 'campaign.paused', 'campaign.closed',
                      'block.created', 'block.lifted', 'search.settings_changed'))
     is distinct from array[
       'block.created=excluded_third_party', 'block.lifted=excluded_third_party',
       'campaign.closed=exported', 'campaign.paused=exported', 'campaign.published=exported',
       'campaign.rejected=exported', 'campaign.submitted=exported', 'campaign.updated=exported',
       'search.settings_changed=exported'] then
    raise exception 'the nine Lot 3 codes of 04 §4.3 are not loaded with their export_class';
  end if;

  -- the closed lists hold the counts of modele §3
  if (select count(*) from reference.campaign_types) <> 7
     or exists (select 1 from reference.campaign_types where code = 'other')
     or (select count(*) from campaigns.requested_items) <> 5
     or (select array_agg(code order by code) from campaigns.requested_items where not is_active)
          is distinct from array['proposed_rate']
     or (select count(*) from campaigns.rejection_reasons) <> 14 then
    raise exception 'the closed lists of 0303 do not hold the counts of modele §3';
  end if;

  -- the three trigger functions: SECURITY INVOKER, empty search_path, executable by no role
  foreach v_fn in array array['campaigns.guard_campaign_member_write()',
                              'campaigns.check_deliverable_format()',
                              'campaigns.check_requested_item_active()']
  loop
    if (select prosecdef from pg_catalog.pg_proc where oid = v_fn::regprocedure)
       or (select proconfig from pg_catalog.pg_proc where oid = v_fn::regprocedure)
            is distinct from array['search_path=""'] then
      raise exception '% must be SECURITY INVOKER with an empty search_path', v_fn;
    end if;
    select string_agg(case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end, ', ')
      into v_bad
      from pg_catalog.pg_proc p,
           pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
     where p.oid = v_fn::regprocedure
       and a.privilege_type = 'EXECUTE'
       and a.grantee <> p.proowner;
    if v_bad is not null then
      raise exception '% executable by: %', v_fn, v_bad;
    end if;
  end loop;
  if (select count(*) from pg_catalog.pg_trigger t
       where t.tgname = 'campaign_member_write_guard' and t.tgenabled = 'O'
         and t.tgfoid = 'campaigns.guard_campaign_member_write()'::regprocedure) <> 10 then
    raise exception 'the guard must fire on the campaign and its nine child tables';
  end if;
end
$$;
