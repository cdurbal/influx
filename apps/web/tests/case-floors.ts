// Floor of executed cases per test file (docs/mvp/18 §3 rule 2, 21 Q2; J8T-6, J9 commit 10), the
// twin of apps/api's. Read by packages/test-kit/scripts/check-case-floors.ts after `pnpm test`: a
// file that runs fewer cases than its floor, a case that did not run (skipped, todo), a file without
// a floor or a floor without a file fails the run. Raise a floor when a file gains cases. LOWERING a
// floor is done in a commit whose message says which cases disappear and why (18 §3 rule 2).
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "tests/account-view.test.ts": 15,
  "tests/auth-steps.test.ts": 12,
  "tests/brand-links.test.ts": 5,
  "tests/brand-profile-form.test.ts": 22,
  "tests/brand-profile-view.test.ts": 29,
  "tests/brand-verification-view.test.ts": 26,
  "tests/cookie-consent.test.ts": 5,
  "tests/creator-audience-view.test.ts": 15,
  "tests/creator-networks-view.test.ts": 29,
  "tests/creator-profile-view.test.ts": 31,
  "tests/dispute-view.test.ts": 17,
  "tests/error-notice.test.ts": 3,
  "tests/guards.test.ts": 74,
  "tests/journey-memory.test.ts": 18,
  "tests/legal-markdown.test.ts": 21,
  "tests/member-nav-ui.test.ts": 6,
  "tests/member-nav.test.ts": 26,
  "tests/member-ui.test.ts": 11,
  "tests/relay-client.test.ts": 7,
  "tests/relay.test.ts": 79,
  "tests/route-models.test.ts": 2,
  "tests/signup-form.test.ts": 27,
  "tests/status-cache.test.ts": 7,
  "tests/verification-view.test.ts": 104,
};
