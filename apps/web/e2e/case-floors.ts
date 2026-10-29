// Floor of executed browser journeys per spec file (docs/mvp/18 §3 rule 2, 21 Q2; J8T-6, J9 commit 10),
// read by packages/test-kit/scripts/check-case-floors.ts after `pnpm test:e2e` (Playwright's JSON
// report): a spec that runs fewer tests than its floor, a test that did not run (skipped, or left
// behind by a failure in a serial file), a spec without a floor or a floor without a spec fails the
// run. Raise a floor when a spec gains tests. LOWERING a floor is done in a commit whose message
// says which tests disappear and why (18 §3 rule 2).
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "e2e/account-data.spec.ts": 1,
  "e2e/account-screens.spec.ts": 10,
  "e2e/account.spec.ts": 5,
  "e2e/backoffice.spec.ts": 14,
  "e2e/charter-cascade.spec.ts": 15,
  "e2e/global-net.spec.ts": 4,
  "e2e/journey-resume.spec.ts": 7,
  "e2e/journey-screens.spec.ts": 12,
  "e2e/landing-signup.spec.ts": 4,
  "e2e/member-primitives.spec.ts": 3,
  "e2e/member-shell.spec.ts": 14,
  "e2e/security-headers.spec.ts": 30,
  "e2e/signup-nominal.spec.ts": 2,
  "e2e/vitrine-unchanged.spec.ts": 4,
};
