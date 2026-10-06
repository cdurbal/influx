// Floor of executed cases per database test file (docs/mvp/18 §3 rule 2, 21 Q2). Read by
// scripts/check-db-case-floors.ts after `pnpm test:db`: a file that runs fewer cases than its floor,
// a case that did not run (skipped, todo), a file without a floor or a floor without a file fails
// the run. Raise a floor when a file gains cases. LOWERING a floor is done in a commit whose
// message says which cases disappear and why (18 §3 rule 2).
export const DB_CASE_FLOORS: Readonly<Record<string, number>> = {
  "db-tests/ops-schema.test.ts": 12,
  "db-tests/t16-commission.test.ts": 16,
  "db-tests/t2-rls-matrix.test.ts": 26,
  "db-tests/t3-audit-chain.test.ts": 40,
  "db-tests/t3-elevated-audit.test.ts": 21,
  "db-tests/t4-roles.test.ts": 30,
  "db-tests/t8-auth-settings.test.ts": 26,
  "db-tests/t8-backoffice-sign-in.test.ts": 14,
  "db-tests/t8-demo-accounts.test.ts": 4,
  "db-tests/t8-gotrue-findings.test.ts": 26,
  "db-tests/t8-mfa-throttle-journal.test.ts": 30,
  "db-tests/t8-request-code.test.ts": 11,
  "db-tests/t8-session-writes.test.ts": 43,
  "db-tests/t8-verify-code.test.ts": 18,
};
