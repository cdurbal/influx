// Floor of executed cases per build-artifact test file (J9T-9; docs/mvp/18 §3 rule 2), the twin of
// case-floors.ts for `pnpm test:artifacts` (run after `next build`). Read by
// packages/test-kit/scripts/check-case-floors.ts: a file that runs fewer cases than its floor, a case
// that did not run, a file without a floor or a floor without a file fails the run. Raise a floor when
// a file gains cases. LOWERING a floor is done in a commit whose message says which cases disappear
// and why.
export const CASE_FLOORS: Readonly<Record<string, number>> = {
  "tests/build.artifacts.ts": 1,
  "tests/keo-tokens.artifacts.ts": 3,
  "tests/relay-integration.artifacts.ts": 36,
};
