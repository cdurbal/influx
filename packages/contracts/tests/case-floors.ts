// Floor of executed cases per test file (docs/mvp/18 §3 rule 2, 21 Q2; J8T-6, J9 commit 10), the
// twin of apps/api's. Read by packages/test-kit/scripts/check-case-floors.ts after `pnpm test`: a
// file that runs fewer cases than its floor, a case that did not run (skipped, todo), a file without
// a floor or a floor without a file fails the run. Raise a floor when a file gains cases. LOWERING a
// floor is done in a commit whose message says which cases disappear and why (18 §3 rule 2).
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "tests/account.test.ts": 13,
  "tests/backoffice-accounts.test.ts": 6,
  "tests/backoffice-queues.test.ts": 9,
  "tests/backoffice-actions.test.ts": 13,
  "tests/backoffice-invitations.test.ts": 5,
  "tests/backoffice-ops.test.ts": 5,
  "tests/brand-profile.test.ts": 10,
  "tests/elevated-operations.test.ts": 4,
  "tests/errors.test.ts": 5,
  "tests/ops.test.ts": 27,
  "tests/signup.test.ts": 34,
  "tests/terms.test.ts": 5,
  "tests/user-agent.test.ts": 4,
  "tests/verification.test.ts": 16,
  "tests/verification-lifecycle.test.ts": 15,
  "tests/zod.test.ts": 2,
};
