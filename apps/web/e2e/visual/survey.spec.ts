// RUA-T6, the full survey (docs/mvp/22-refonte-ux-ui/05 §1; jalons/rua/03.md, modele-archi.md §5):
// every state of the 23 frozen mockups in every window of its space, 147 states and 588 captures,
// each rendered twice and compared with itself at N1, N2 and N3: 0 difference, no request to the
// network, no script error. One test per mockup and window, its states in turn (soft assertions: a
// state that differs does not hide the next). Local only, no stack needed (several minutes):
//   E2E_VISUAL=mockup pnpm --filter @influx/web exec playwright test
//   cd apps/web && node ../../packages/test-kit/scripts/check-case-floors.ts e2e/visual/case-floors.ts test-results/e2e-report.json
import { expect, test } from "@playwright/test";
import { compareStructure, compareStyles } from "../support/visual/compare";
import {
  DEFAULT_ZONES,
  EVERY_ELEMENT,
  expectZoneMatches,
  readStructure,
  readStyles,
  writeReference,
} from "../support/visual/capture";
import {
  captureName,
  MOCKUPS,
  statesOf,
  SURVEY_COUNTS,
  surveyCaptures,
  VISUAL_WINDOWS,
} from "../support/visual/mockups";
import { openMockupState, watchMockupPage } from "../support/visual/neutralize";

/** The time a state takes, twice rendered and compared (a long page at 375 px is the slowest). */
const STATE_BUDGET_MS = 20_000;

// The cases are independent: spread over the workers.
test.describe.configure({ mode: "parallel" });

test.beforeAll(() => {
  expect(
    test.info().config.updateSnapshots,
    "the visual tool runs without -u",
  ).toBe("none");
  // 05 §1: the survey of 2026-11-24, state for state.
  expect(MOCKUPS).toHaveLength(SURVEY_COUNTS.mockups);
  expect(surveyCaptures()).toHaveLength(SURVEY_COUNTS.captures);
});

for (const mockup of MOCKUPS) {
  for (const window of VISUAL_WINDOWS[mockup.space]) {
    const states = statesOf(mockup);
    test(`${mockup.file} @${window.width}x${window.height}: ${states.length} states against themselves`, async ({
      context,
    }, testInfo) => {
      test.setTimeout(states.length * STATE_BUDGET_MS);
      const reference = await context.newPage();
      const candidate = await context.newPage();
      await reference.setViewportSize(window);
      await candidate.setViewportSize(window);
      const findings = [
        await watchMockupPage(reference),
        await watchMockupPage(candidate),
      ];
      let captures = 0;
      for (const state of states) {
        const name = captureName(mockup.file, state, window);
        await openMockupState(reference, mockup.file, state);
        await openMockupState(candidate, mockup.file, state);
        expect
          .soft(
            compareStructure(
              await readStructure(reference),
              await readStructure(candidate),
            ),
            `N1 ${name}`,
          )
          .toEqual([]);
        expect
          .soft(
            compareStyles(
              await readStyles(reference, EVERY_ELEMENT),
              await readStyles(candidate, EVERY_ELEMENT),
            ),
            `N2 ${name}`,
          )
          .toEqual([]);
        for (const zone of DEFAULT_ZONES) {
          const shot = `${name}.${zone.name}.png`;
          await writeReference(reference, zone, shot, testInfo);
          await expectZoneMatches(candidate, zone, shot, [], true);
        }
        captures += 1;
      }
      expect(captures, "one capture per state").toBe(states.length);
      for (const { networkRequests, scriptErrors } of findings) {
        expect(networkRequests, "no request to the network").toEqual([]);
        expect(scriptErrors, "no script error").toEqual([]);
      }
    });
  }
}
