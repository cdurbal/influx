// Floor of executed cases per test file (docs/mvp/18 §3 rule 2, 21 Q2; J8T-6, J9 commit 10), the
// twin of apps/api's. Read by packages/test-kit/scripts/check-case-floors.ts after `pnpm test`: a
// file that runs fewer cases than its floor, a case that did not run (skipped, todo), a file without
// a floor or a floor without a file fails the run. Raise a floor when a file gains cases. LOWERING a
// floor is done in a commit whose message says which cases disappear and why (18 §3 rule 2).
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "tests/account-view.test.ts": 15,
  "tests/auth-steps.test.ts": 12,
  "tests/cookie-consent.test.ts": 5,
  "tests/error-notice.test.ts": 3,
  "tests/guards.test.ts": 56,
  "tests/journey-memory.test.ts": 15,
  "tests/legal-markdown.test.ts": 20,
  "tests/relay.test.ts": 74,
  "tests/signup-form.test.ts": 27,
};
