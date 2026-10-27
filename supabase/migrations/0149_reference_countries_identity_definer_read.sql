-- =============================================================================
-- 0149_reference_countries_identity_definer_read
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, commit 10 (found by J8T-4, the axe journey of the Apollo screen). 0134 granted
-- influx_identity_definer `select (code)` on reference.countries for the canonical payload of an
-- Apollo key (05 RG83, RG84: a country list, its codes known), but the table FORCES its row level
-- security (0003) and no policy names that role: it saw no country at all. Every dual control
-- request carrying a country — a non-empty apollo_excluded_countries (0141), an exception by
-- country of apollo_legal_basis — was refused (42501, "refused_value" at the screen), and the
-- guard leads.assert_sync_setting_value() (0141, invoker) refused the same values when
-- backoffice.change_apollo_setting() applied them. Only an empty list could ever pass.
--
--   reference.countries   policy countries_read_identity_definer: SELECT for
--         influx_identity_definer, every row (a reference list, no personal data, the column
--         `code` alone granted since 0134). Nothing else changes: no new grant, no other role.
--
-- ROLLBACK: drop policy countries_read_identity_definer on reference.countries.
-- =============================================================================

drop policy if exists countries_read_identity_definer on reference.countries;
create policy countries_read_identity_definer on reference.countries
  for select to influx_identity_definer
  using (true);

comment on policy countries_read_identity_definer on reference.countries is
  'The canonical payload of a dual control (backoffice.canonical_dual_control_payload) and the '
  'guard of leads.sync_settings check that a country code exists (05 RG83, RG84): the definer '
  'reads the list, column code only (grant of 0134). 0149, J9 commit 10.';
