-- =============================================================================
-- 0208_profiles_brand_logo_in_review_state
-- -----------------------------------------------------------------------------
-- Lot 2 / L2C, commit 06 (jalons/l2c/file.md A4, D81). The state `in_review` of a brand logo: alone
-- in its file because a value added to an existing enum is unusable before COMMIT, and 0209 holds
-- it in a constraint and in an index predicate.
--
-- ROLLBACK: an enum value cannot be removed (PostgreSQL); harmless while no row holds it.
-- =============================================================================

alter type profiles.brand_logo_state add value if not exists 'in_review' after 'active';

comment on type profiles.brand_logo_state is
  'Life of a brand logo object (stockage.md §3, §5; file.md A4): pending (row written, object not '
  'yet stored), active (the logo of the brand, one per account), in_review (stored, submitted on a '
  'published profile, one per account; the active logo stays served until the decision), purging '
  '(to remove from Storage by the task storage_purge); purged = row deleted.';
