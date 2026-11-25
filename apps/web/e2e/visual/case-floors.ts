// Floor of executed cases of the visual tool (RUA-03; 18 §3 rule 2), read after a local run under
// E2E_VISUAL=mockup (playwright.config.ts): `node ../../packages/test-kit/scripts/check-case-floors.ts
// e2e/visual/case-floors.ts test-results/e2e-report.json`. Out of e2e/case-floors.ts: these specs
// never run in `pnpm test:e2e` nor in CI. The survey is one case per mockup and window (23 × 4 = 92,
// 588 captures); the self-comparison, 4 families × 4 windows and 3 deliberate differences.
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "e2e/visual/mockup-self.spec.ts": 19,
  "e2e/visual/survey.spec.ts": 92,
};
