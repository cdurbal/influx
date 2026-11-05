// Floor of executed cases per test file (docs/mvp/18 §3 rule 2, 21 Q2; J8T-6, J9 commit 10), the
// twin of apps/api's. Read by packages/test-kit/scripts/check-case-floors.ts after `pnpm test`: a
// file that runs fewer cases than its floor, a case that did not run (skipped, todo), a file without
// a floor or a floor without a file fails the run. Raise a floor when a file gains cases. LOWERING a
// floor is done in a commit whose message says which cases disappear and why (18 §3 rule 2).
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "tests/account-brand-view.test.ts": 7,
  "tests/account-record-forms.test.ts": 14,
  "tests/bo-nav-ui.test.ts": 8,
  "tests/bo-nav.test.ts": 22,
  "tests/error-notice.test.ts": 3,
  "tests/guards.test.ts": 48,
  "tests/health-errors-ui.test.ts": 8,
  "tests/ops-view-model.test.ts": 17,
  "tests/queue-review-view.test.ts": 26,
  "tests/queue-view-model.test.ts": 17,
  "tests/relay.test.ts": 5,
  "tests/route-models.test.ts": 1,
  "tests/view-model.test.ts": 12,
};
