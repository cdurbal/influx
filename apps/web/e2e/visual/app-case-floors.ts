// Floor of executed cases of the `app` project of the visual tool (RUB-X1; jalons/rub/modele-archi.md
// §6; 18 §3 rule 2), read after a local run under E2E_VISUAL=app (playwright.config.ts):
// `node ../../packages/test-kit/scripts/check-case-floors.ts e2e/visual/app-case-floors.ts
// test-results/e2e-report.json`. A module of its own: the floor of the mockups (case-floors.ts) is
// read after a run with no stack, and `app.spec.ts` (RUB line 11) runs only against the servers of the
// ordinary mode, so neither run could meet the other's file. Four cases: the three levels N1 to N3 of
// the first couples, and the refusal of a request out of the application. Raised, never lowered.
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "e2e/visual/app.spec.ts": 4,
};
