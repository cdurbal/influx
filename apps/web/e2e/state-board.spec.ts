// RUA-T8 (docs/mvp/jalons/rua/modele-archi.md §6): the component state board, served by the e2e
// build alone (INFLUX_ENV=development and INFLUX_STATE_BOARD=on at build time: playwright.config.ts
// locally, the "Build both fronts" step of ci.yml). One case: the page answers, shows one section per
// component with its cells, within 4 s, and axe (WCAG 2.1 AA) finds nothing. The absence of the page
// from a deployed build is the other half, proved on the artifact (tests/build.artifacts.ts).
import { expectNoAxeViolation } from "./support/axe";
import { expect, open, test } from "./support/journey";

/** The sections the board holds today, one per component of RUA-05 (RUB adds its own). */
const COMPONENTS = ["button", "notice", "badge", "field"] as const;

const SERVED_WITHIN_MS = 4_000;

test("RUA-T8: the state board is served in the e2e environment, with a section per component, within 4 s and without an axe violation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const started = Date.now();
  await open(page, "/fr/state-board");
  const board = page.locator("[data-state-board]");
  await expect(board).toBeVisible();
  expect(Date.now() - started).toBeLessThanOrEqual(SERVED_WITHIN_MS);

  await expect(board.locator("h1")).toHaveCount(1);
  for (const component of COMPONENTS) {
    const section = board.locator(`[data-board-component="${component}"]`);
    await expect(section, component).toHaveCount(1);
    expect(
      await section.locator("[data-board-state]").count(),
      `${component}: at least one state`,
    ).toBeGreaterThan(0);
  }
  await expectNoAxeViolation(page, "planche des états à 1 440 px");
});
