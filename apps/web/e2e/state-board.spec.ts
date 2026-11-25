// RUA-T8 (docs/mvp/jalons/rua/modele-archi.md §6): the component state board, served by the e2e
// build alone (INFLUX_ENV=development and INFLUX_STATE_BOARD=on at build time: playwright.config.ts
// locally, the "Build both fronts" step of ci.yml). One case: at 375 and at 1 440 px the page answers within 4 s,
// shows one section per component with its cells, and axe (WCAG 2.1 AA) finds nothing; at 375 px
// nothing overflows sideways (05-recette-visuelle §6, RUAU-J1). The absence of the page
// from a deployed build is the other half, proved on the artifact (tests/build.artifacts.ts).
import { expectNoAxeViolation } from "./support/axe";
import { expect, open, test } from "./support/journey";

/** The sections the board holds today, one per component of RUA-05 (RUB adds its own). */
const COMPONENTS = ["button", "notice", "badge", "field"] as const;

const SERVED_WITHIN_MS = 4_000;

/** The two widths 05-recette-visuelle §6 asks of the board. */
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 1440, height: 900 },
] as const;

test("RUA-T8: the state board is served in the e2e environment at 375 and 1 440 px, with a section per component, within 4 s, without a sideways overflow and without an axe violation", async ({
  page,
}) => {
  for (const viewport of VIEWPORTS) {
    const label = `${viewport.width} px`;
    await page.setViewportSize(viewport);
    const started = Date.now();
    await open(page, "/fr/state-board");
    const board = page.locator("[data-state-board]");
    await expect(board).toBeVisible();
    expect(Date.now() - started, label).toBeLessThanOrEqual(SERVED_WITHIN_MS);

    await expect(board.locator("h1"), label).toHaveCount(1);
    for (const component of COMPONENTS) {
      const section = board.locator(`[data-board-component="${component}"]`);
      await expect(section, `${label}: ${component}`).toHaveCount(1);
      expect(
        await section.locator("[data-board-state]").count(),
        `${label}: ${component}: at least one state`,
      ).toBeGreaterThan(0);
    }
    if (viewport.width === 375) {
      const overflow = await board.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      );
      expect(overflow, "board overflow at 375 px").toBeLessThanOrEqual(0);
    }
    await expectNoAxeViolation(page, `planche des états à ${label}`);
  }
});
