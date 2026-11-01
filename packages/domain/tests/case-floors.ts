// Floor of executed cases per test file (docs/mvp/18 §3 rule 2, 21 Q2), the twin of the one of
// packages/contracts. Read by packages/test-kit/scripts/check-case-floors.ts after `pnpm test`.
// Raise a floor when a file gains cases. LOWERING a floor is done in a commit whose message says
// which cases disappear and why (18 §3 rule 2).
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "tests/brand-profile-completeness.test.ts": 11,
  "tests/brand-profile-required.test.ts": 7,
  "tests/brand-profile-website.test.ts": 7,
};
