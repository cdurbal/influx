// Floor of executed cases per test file (docs/mvp/18 §3 rule 2, 21 Q2; J8T-6, J9 commit 10), the
// twin of apps/api's. Read by packages/test-kit/scripts/check-case-floors.ts after `pnpm test`: a
// file that runs fewer cases than its floor, a case that did not run (skipped, todo), a file without
// a floor or a floor without a file fails the run. Raise a floor when a file gains cases. LOWERING a
// floor is done in a commit whose message says which cases disappear and why (18 §3 rule 2).
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "tests/artifacts.test.ts": 9,
  "tests/case-floors.test.ts": 13,
  "tests/charter-boundary.test.ts": 15,
  "tests/check-migrations.test.ts": 12,
  "tests/ci-production-job.test.ts": 7,
  "tests/check-security-review.test.ts": 46,
  "tests/font-guards.test.ts": 8,
  "tests/guards.test.ts": 16,
  "tests/logs.test.ts": 11,
  "tests/operator-secrets.test.ts": 3,
  "tests/rendering-guards.test.ts": 21,
  "tests/t16-static.test.ts": 13,
  "tests/token-readers.test.ts": 33,
  "tests/totp.test.ts": 8,
};
