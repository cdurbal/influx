-- =============================================================================
-- 0103_leads_sync_settings
-- -----------------------------------------------------------------------------
-- Lot 1 / J5, commit 2. The configuration of the synchronisation and of the
-- sign-up is DATA (04 §5.8, 05 RG81): changeable without redeployment, read at
-- every consumption, never at worker start.
--
-- Closed list of keys (EC-8, which replaces the list of 04 §5.8), plus
-- signup_consent_required (05 additif D63, RG124 to RG127):
--   apollo_scope                  'annonceurs_et_createurs_pro' (waiting value of D33, RG81)
--   apollo_legal_basis            default 'consentement_requis', override per country (RG83)
--   apollo_prospecting_countries  EMPTY: no lead leaves for Apollo (RG84)
--   signup_blocked_countries      EMPTY: sign-up open everywhere (RG8)
--   signup_consent_required       true (D63; the way back without redeployment)
--   retry_schedule                RG79 starting values, in seconds, 10 attempts (EC-9)
--   rate_limits                   conservative starting values, per connector (J6)
--   brevo_list_ids                NULL ids: no real identifier in a migration
--   brevo_template_ids            NULL ids: no real identifier in a migration
--
-- The shape of every value is checked by a CHECK constraint (jsonpath, immutable);
-- what needs a table (country codes) or an order (retry schedule) by a trigger.
--
-- Writers: the migrations only, at this stage. The write function reserved to
-- influx_admin, with its register line leads.setting_changed (old and new value)
-- and the re-evaluation of the accounts skipped for the scope (04 §5.8, RG81),
-- arrives with its first caller, the backoffice (J8, with the dual control of 0107).
-- Readers receive their rights with their first caller: influx_identity_definer in
-- 0106 (identity.provision_account reads the two signup_* keys), influx_worker at J6.
--
-- ROLLBACK: drop table leads.sync_settings; drop function leads.assert_sync_setting_value().
-- =============================================================================

create table if not exists leads.sync_settings (
  key                    text        not null primary key,
  value                  jsonb       not null,
  updated_by_account_id  uuid        references identity.accounts (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  constraint sync_settings_key_closed_list check (key in (
    'apollo_scope', 'apollo_legal_basis', 'apollo_prospecting_countries',
    'signup_blocked_countries', 'signup_consent_required', 'retry_schedule', 'rate_limits',
    'brevo_list_ids', 'brevo_template_ids')),
  constraint sync_settings_value_size check (pg_column_size(value) <= 8000),
  constraint sync_settings_value_shape check (case key
    when 'apollo_scope' then
      jsonb_typeof(value) = 'string'
      and value #>> '{}' in ('annonceurs_seuls', 'annonceurs_et_createurs_pro', 'tous_les_inscrits')
    when 'apollo_legal_basis' then
      jsonb_typeof(value) = 'object'
      and value ?& array['default', 'by_country']
      and (value - 'default' - 'by_country') = '{}'::jsonb
      and value ->> 'default' in ('consentement_requis', 'interet_legitime_avec_opposition')
      and jsonb_typeof(value -> 'by_country') = 'object'
      and not jsonb_path_exists(value -> 'by_country',
            '$.keyvalue() ? (!(@.key like_regex "^[A-Z]{2}$")
                             || (@.value != "consentement_requis"
                                 && @.value != "interet_legitime_avec_opposition"))')
    when 'apollo_prospecting_countries' then
      jsonb_typeof(value) = 'array'
      and not jsonb_path_exists(value, '$[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z]{2}$"))')
    when 'signup_blocked_countries' then
      jsonb_typeof(value) = 'array'
      and not jsonb_path_exists(value, '$[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z]{2}$"))')
    when 'signup_consent_required' then
      jsonb_typeof(value) = 'boolean'
    when 'retry_schedule' then
      jsonb_typeof(value) = 'array'
      and jsonb_array_length(value) between 1 and 10
      and not jsonb_path_exists(value,
            '$[*] ? (@.type() != "number" || @ < 0 || @ > 172800 || @.floor() != @)')
    when 'rate_limits' then
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value,
            '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]{0,62}$")
                             || @.value.type() != "number" || @.value < 1
                             || @.value.floor() != @.value)')
    when 'brevo_list_ids' then
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value,
            '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]{0,62}$")
                             || (@.value != null && (@.value.type() != "number" || @.value < 1
                                                     || @.value.floor() != @.value)))')
    when 'brevo_template_ids' then
      jsonb_typeof(value) = 'object'
      and not jsonb_path_exists(value,
            '$.keyvalue() ? (!(@.key like_regex "^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)+$")
                             || (@.value != null && (@.value.type() != "number" || @.value < 1
                                                     || @.value.floor() != @.value)))')
    else false
  end)
);

comment on table leads.sync_settings is
  'Configuration of the synchronisation and of the sign-up, as data (04 §5.8, 05 RG81): closed list '
  'of keys (EC-8), shape of each value checked in base, a zod schema per key in packages/contracts. '
  'Read at EVERY consumption, never cached at start. A change of apollo_scope is a row update, not a '
  'development (D33). Assumed key/value exception (04 §5.8): a column per setting would need a '
  'migration per new parameter, exactly what "changeable without redeployment" forbids.';
comment on column leads.sync_settings.value is
  'apollo_scope: one of the three values of 05 RG81. apollo_legal_basis: {"default": ..., '
  '"by_country": {"<ISO 3166-1>": ...}} (RG83). apollo_prospecting_countries and '
  'signup_blocked_countries: arrays of ISO 3166-1 codes, an EMPTY list means abstention for Apollo '
  '(RG84) and no blocked country for the sign-up (RG8). signup_consent_required: boolean (D63). '
  'retry_schedule: delays in seconds before attempts 1 to 10 (RG79). rate_limits: positive integers '
  'per connector and unit. brevo_list_ids, brevo_template_ids: Brevo numeric ids or NULL (not yet '
  'configured: the consumer then skips with a clear cause, it never guesses).';
comment on column leads.sync_settings.updated_by_account_id is
  'Administrator who last changed the value; NULL for a value loaded by a migration (04 §5.8 asked '
  'for NOT NULL, impossible for the starting values: no account exists when they are loaded).';

-- What a CHECK cannot read: the country list, duplicates, the order of the schedule.
create or replace function leads.assert_sync_setting_value()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_codes text[];
begin
  if new.key in ('apollo_prospecting_countries', 'signup_blocked_countries') then
    select pg_catalog.array_agg(e) into v_codes from pg_catalog.jsonb_array_elements_text(new.value) e;
  elsif new.key = 'apollo_legal_basis' then
    select pg_catalog.array_agg(k) into v_codes from pg_catalog.jsonb_object_keys(new.value -> 'by_country') k;
  elsif new.key = 'retry_schedule' then
    if exists (select 1
                 from pg_catalog.jsonb_array_elements(new.value) with ordinality as s (delay, n)
                 join pg_catalog.jsonb_array_elements(new.value) with ordinality as p (delay, n)
                   on p.n = s.n - 1
                where (s.delay #>> '{}')::numeric < (p.delay #>> '{}')::numeric) then
      raise exception 'retry_schedule must be non-decreasing' using errcode = 'check_violation';
    end if;
  end if;

  if v_codes is not null then
    if pg_catalog.cardinality(v_codes) <> (select count(distinct c) from pg_catalog.unnest(v_codes) c) then
      raise exception '% lists a country twice', new.key using errcode = 'check_violation';
    end if;
    if exists (select 1 from pg_catalog.unnest(v_codes) c
                where not exists (select 1 from reference.countries r where r.code = c)) then
      raise exception '% names an unknown country', new.key using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end
$$;

comment on function leads.assert_sync_setting_value() is
  'BEFORE INSERT OR UPDATE on leads.sync_settings: every country code exists in reference.countries '
  'and appears once; the retry schedule never decreases. SECURITY INVOKER: the writer reads the '
  'countries with its own rights.';

revoke all on function leads.assert_sync_setting_value() from public;

drop trigger if exists sync_settings_assert_value on leads.sync_settings;
create trigger sync_settings_assert_value
  before insert or update on leads.sync_settings
  for each row execute function leads.assert_sync_setting_value();

drop trigger if exists sync_settings_touch_updated_at on leads.sync_settings;
create trigger sync_settings_touch_updated_at
  before update on leads.sync_settings
  for each row execute function influx.touch_updated_at();

-- Starting values. ON CONFLICT DO NOTHING: re-running the migration never overwrites a
-- value changed since by an administrator.
insert into leads.sync_settings (key, value) values
  ('apollo_scope',                 '"annonceurs_et_createurs_pro"'),
  ('apollo_legal_basis',           '{"default": "consentement_requis", "by_country": {}}'),
  ('apollo_prospecting_countries', '[]'),
  ('signup_blocked_countries',     '[]'),
  ('signup_consent_required',      'true'),
  ('retry_schedule',               '[0, 60, 300, 900, 3600, 10800, 21600, 43200, 86400, 86400]'),
  ('rate_limits',                  '{"brevo_contact_per_minute": 60, "brevo_transactional_per_minute": 60, "apollo_contact_per_minute": 20}'),
  ('brevo_list_ids',               '{"advertisers": null, "creators": null}'),
  ('brevo_template_ids',           '{"account.welcome_advertiser": null, "account.welcome_creator": null}')
on conflict (key) do nothing;

alter table leads.sync_settings enable row level security;
alter table leads.sync_settings force  row level security;
revoke all on leads.sync_settings from public, anon, authenticated, service_role;

do $$
declare
  v_bad text;
begin
  select string_agg(r.rolname, ', ') into v_bad
    from pg_catalog.pg_roles r
   where r.rolname like 'influx\_%'
     and (pg_catalog.has_any_column_privilege(r.oid, 'leads.sync_settings', 'SELECT')
          or pg_catalog.has_any_column_privilege(r.oid, 'leads.sync_settings', 'INSERT')
          or pg_catalog.has_any_column_privilege(r.oid, 'leads.sync_settings', 'UPDATE')
          or pg_catalog.has_table_privilege(r.oid, 'leads.sync_settings', 'DELETE'));
  if v_bad is not null then
    raise exception 'unexpected right(s) on leads.sync_settings: %', v_bad;
  end if;
  if (select count(*) from leads.sync_settings) <> 9 then
    raise exception 'leads.sync_settings does not hold the nine keys';
  end if;
end
$$;
