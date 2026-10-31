-- =============================================================================
-- 0151_leads_apollo_basis_string_values
-- -----------------------------------------------------------------------------
-- PL-04a (stop of PL-04, founder's choice A, 2026-10-31): the CHECK sync_settings_value_shape of
-- 0141 let any NON-STRING value into apollo_legal_basis.by_country (1, true, {}, [], 1.5, [1]):
-- in lax mode, @.value != "consentement_requis" between a non-string and a string is unknown, the
-- filter finds nothing and "not jsonb_path_exists" lets the row in. The worker then cannot read
-- the key (unreadableApolloKeys, zod z.enum): every Apollo line fails (05 RG160) and the worker
-- refuses to start (RG162).
--
-- The CHECK is restated VERBATIM but for one predicate of the apollo_legal_basis branch: a basis
-- of a country must be a string (@.value.type() != "string") before it is compared to the closed
-- list. Same refusal as before (23514). No other key, table, function or policy is touched; the
-- canonical payload of 2V (0141 §4) keeps its own check, fed by the contract's closed list.
-- Staging was read before writing (read-only, D70): its by_country is empty, nothing to repair.
--
-- Not journaled by settings.changed: no value is written.
--
-- ROLLBACK: restate the CHECK sync_settings_value_shape of 0141 §1.
-- =============================================================================

alter table leads.sync_settings drop constraint sync_settings_value_shape;

alter table leads.sync_settings add constraint sync_settings_value_shape check (case key
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
                             || @.value.type() != "string"
                             || (@.value != "consentement_requis"
                                 && @.value != "interet_legitime_avec_opposition"))')
    when 'apollo_excluded_countries' then
      jsonb_typeof(value) = 'array'
      and not jsonb_path_exists(value, '$[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z]{2}$"))')
    when 'signup_blocked_countries' then
      jsonb_typeof(value) = 'array'
      and not jsonb_path_exists(value, '$[*] ? (@.type() != "string" || !(@ like_regex "^[A-Z]{2}$"))')
    when 'signup_consent_required' then
      jsonb_typeof(value) = 'boolean'
    when 'signup_invitation_validity_days' then
      jsonb_typeof(value) = 'number'
      and not jsonb_path_exists(value, '$ ? (@ < 1 || @ > 365 || @.floor() != @)')
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
  end);
