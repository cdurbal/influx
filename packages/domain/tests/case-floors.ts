// Floor of executed cases per test file (docs/mvp/18 §3 rule 2, 21 Q2), the twin of the one of
// packages/contracts. Read by packages/test-kit/scripts/check-case-floors.ts after `pnpm test`.
// Raise a floor when a file gains cases. LOWERING a floor is done in a commit whose message says
// which cases disappear and why (18 §3 rule 2).
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "tests/brand-profile-completeness.test.ts": 11,
  "tests/brand-profile-contact-detection.test.ts": 9,
  "tests/brand-profile-required.test.ts": 7,
  "tests/brand-profile-website.test.ts": 7,
  "tests/creator-profile-basis-points.test.ts": 6,
  "tests/creator-profile-completeness.test.ts": 14,
  "tests/creator-profile-contact-detection.test.ts": 6,
  "tests/creator-profile-limits.test.ts": 7,
  "tests/creator-profile-message.test.ts": 4,
  "tests/creator-profile-network-line.test.ts": 12,
  "tests/creator-profile-portfolio.test.ts": 13,
  "tests/creator-profile-required.test.ts": 12,
  "tests/verification-badge-display.test.ts": 8,
  "tests/verification-figures.test.ts": 7,
  "tests/verification-lifecycle.test.ts": 19,
  "tests/verification-period.test.ts": 6,
};
