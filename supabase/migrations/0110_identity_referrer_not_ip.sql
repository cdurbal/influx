-- =============================================================================
-- 0110_identity_referrer_not_ip
-- -----------------------------------------------------------------------------
-- Lot 1 / J5, follow-up of commit 5 (architect's arbitration of 2026-10-08, fiche J5 "Issu du
-- commit 5"; micro-deviation, CLAUDE.md §7 rule 5).
--
-- identity.accounts.signup_referrer_domain is a HOST NAME (05 RG120). The format constraint of
-- 0104 accepts an IPv4 literal (127.0.0.1) because each of its labels is a valid label. An IP
-- literal names a machine, not a site: it is dropped by normalizeReferrerDomain()
-- (packages/contracts/src/signup.ts) and refused here, by the twin rule: no value whose LAST
-- label is entirely numeric (no top-level domain is numeric, RFC 3696 §2). IPv6 literals are
-- already refused by 0104 (":" and "[" are outside its pattern).
--
-- No existing row breaks it on the workstations or staging (no real account yet); the
-- constraint is added VALID, so that a row that would break it fails the migration loudly.
--
-- ROLLBACK: alter table identity.accounts drop constraint if exists
-- accounts_signup_referrer_domain_not_ip;
-- =============================================================================

do $$
begin
  if not exists (select 1 from pg_catalog.pg_constraint
                  where conname = 'accounts_signup_referrer_domain_not_ip'
                    and conrelid = 'identity.accounts'::regclass) then
    alter table identity.accounts add constraint accounts_signup_referrer_domain_not_ip check (
      signup_referrer_domain !~ '\.[0-9]+$');
  end if;
end
$$;

comment on constraint accounts_signup_referrer_domain_not_ip on identity.accounts is
  'No IP literal as the referring domain (05 RG120: a site, never a machine): the last label is '
  'never entirely numeric. Twin of normalizeReferrerDomain() in packages/contracts.';
