-- =============================================================================
-- 0143_identity_backoffice_reauth_ip_scope
-- -----------------------------------------------------------------------------
-- Lot 1 / J9, commit 2. J8S-6: the re-authentication R (EC-40) reserved its network attempt in
-- the bucket of the backoffice sign-in, backoffice_login_ip (EC-47, 20 / h per IP): a team
-- confirming its sensitive actions from one office network ate the sign-in attempts of that
-- network, and a crowd of sign-in attempts refused R. R gets its own bucket:
--
--   identity.throttle_scope 'backoffice_reauth_ip'   per IP (/32, /64), 60 / h, reserved by
--         apps/api BEFORE GoTrue in the transaction that reads the session (J3S-1), after the
--         session's own ceiling (backoffice_reauth_session, 5 / 15 min). Without a valid client
--         address, one global key of the same scope (label of its own in throttle-keys.ts).
--
-- The threshold is a constant of apps/api (J3-C rule 6), as for every other scope (0014).
-- A value added to an enum is not usable in the transaction that adds it: nothing below uses it.
--
-- ROLLBACK: none needed (an enum value cannot be dropped; an unused value is inert). Counters of
-- this scope, if any, expire like the others (30 days, E-4).
-- =============================================================================

alter type identity.throttle_scope add value if not exists 'backoffice_reauth_ip';

comment on type identity.throttle_scope is
  'What a counter limits (05 RG44, EC-3, EC-21, EC-40, EC-47). Thresholds live in apps/api. '
  'backoffice_reauth_ip (0143, J8S-6): the network attempts of the re-authentication R, apart '
  'from those of the sign-in (backoffice_login_ip).';
