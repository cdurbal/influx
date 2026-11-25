-- =============================================================================
-- 0334_identity_owner_agent_lookup_index
-- -----------------------------------------------------------------------------
-- Lot 3 / L3G, commit 14 (jalons/l3g/14.md, added on 2026-11-21 by the founder: the latency of the
-- dual control screens). Measured on the local stack (pg_stat_statements, track = all; EXPLAIN
-- (ANALYZE, BUFFERS)): the 2 s of the dual control screen are NOT the request nor the confirmation
-- (POST /v1/bo/dual-control ≈ 65 ms, /:id/confirm ≈ 60 ms) but the two reads the screen makes at
-- once, GET /v1/bo/internal-accounts and GET /v1/bo/dual-control/:id:
-- - the team list (internalAccounts(), 17b §3.13.a) counts the member accounts each internal account
--   owns with `where m.owner_agent_id = a.id`, and accounts_owner_agent_idx (0004) is partial
--   (`where deleted_at is null`), so the planner cannot use it: one sequential scan of
--   identity.accounts per listed account (200 × 8 ms, ≈ 2 s with 86 000 accounts);
-- - the view of the request waits for it: both transactions renew the same session
--   (identity.touch_session() locks its row) and the first holds the lock until its commit.
-- 1. accounts_owner_agent_any_idx: (owner_agent_id) where owner_agent_id is not null, which any
--    equality on owner_agent_id implies. The team count drops from ≈ 1 700 ms to ≈ 35 ms (same
--    rows). It also serves the check of accounts_owner_is_internal_fk when an internal role row is
--    deleted (owner_agent_id, owner_is_internal), which the partial index of 0004 could not.
--    accounts_owner_agent_idx is kept: the portfolio reads that filter deleted_at use it.
--
-- RIGHTS: none. No GRANT, no policy, no function, no audit row; rows, readers and writers unchanged.
--
-- ROLLBACK: drop index identity.accounts_owner_agent_any_idx (nothing stored, nothing depends on it).
-- =============================================================================

create index if not exists accounts_owner_agent_any_idx
  on identity.accounts (owner_agent_id)
  where owner_agent_id is not null;
comment on index identity.accounts_owner_agent_any_idx is
  'Every lookup by owner whatever the deletion state: the team count of internal accounts '
  '(17b §3.13.a, L3G 14) and the check of accounts_owner_is_internal_fk on an internal role row.';
