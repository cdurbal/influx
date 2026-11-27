// RUB-T11, the member shell compared with its mockup (docs/mvp/22-refonte-ux-ui/05 §3, §8; jalons/rub/
// 11.md, modele-archi.md §6): each couple of e2e/support/visual/couples.ts, the application signed in by
// a loader of the acceptance data set (05 §4) then opened on the mockups' frozen clock (RUAT-8), against
// the state of its mockup, at N1 (structure and texts of the shell), N2 (the lines of the matrix) and N3
// (the zones), in every window of its space. What differs is listed, then compared with the deviations
// submitted to the founder (F1, R05 §3: corrected or written in 06b §7 with the founder's consent, no
// third way): a new difference fails, and so does a submitted one that no longer shows. A deliberate
// difference on the application's side is seen at each level, and a request out of the front is
// refused and counted. Local only, under E2E_VISUAL=app (playwright.config.ts).
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import {
  compareStructure,
  compareStyles,
  normalizedAria,
  zonesOf,
} from "../support/visual/compare";
import {
  expectZoneMatches,
  readStructure,
  readStyles,
  writeReference,
  type VisualMask,
  type VisualZone,
} from "../support/visual/capture";
import {
  coupleProblems,
  VISUAL_COUPLES,
  type AppLoad,
  type VisualCouple,
} from "../support/visual/couples";
import {
  captureName,
  mockupOf,
  VISUAL_WINDOWS,
  type VisualWindow,
} from "../support/visual/mockups";
import {
  openAppPage,
  openMockupState,
  watchAppPage,
  watchMockupPage,
  type MockupFindings,
} from "../support/visual/neutralize";
import {
  cleanRecette,
  loadBackofficeSpace,
  loadBrandSpace,
  loadCreatorSpace,
} from "../support/recette";
import { BACKOFFICE_ORIGIN, WEB_ORIGIN } from "../support/servers";
import { expectedDifferences, SUBMITTED_DEVIATIONS } from "./app-deviations";

test.beforeAll(() => {
  // A reference is never recorded on purpose (05 §3): `-u` would let a run write one.
  expect(
    test.info().config.updateSnapshots,
    "the visual tool runs without -u",
  ).toBe("none");
  expect(coupleProblems(VISUAL_COUPLES), "the couples").toEqual([]);
});

test.afterAll(async () => {
  await cleanRecette();
});

function originOf(couple: VisualCouple): string {
  return couple.app.front === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN;
}

/** Signs the page in with the loader of the couple (05 §4), in real time. */
async function signIn(page: Page, load: AppLoad): Promise<void> {
  if (load.space === "brand") await loadBrandSpace(page, load.options);
  else if (load.space === "creator") await loadCreatorSpace(page, load.options);
  else await loadBackofficeSpace(page, load.options);
}

type Sides = {
  reference: Page;
  candidate: Page;
  findings: MockupFindings[];
};

/** The mockup's state and the application's page of a couple, both opened and watched. */
async function openCouple(
  newPage: () => Promise<Page>,
  couple: VisualCouple,
): Promise<Sides> {
  const reference = await newPage();
  const candidate = await newPage();
  const findings = [
    await watchMockupPage(reference),
    await watchAppPage(candidate, originOf(couple)),
  ];
  await openMockupState(reference, couple.mockup.file, couple.mockup.state);
  await signIn(candidate, couple.app.load);
  await openAppPage(
    candidate,
    `${originOf(couple)}${couple.app.path}`,
    async (page) => {
      await page
        .locator(couple.app.ready)
        .first()
        .waitFor({ state: "attached" });
    },
  );
  return { reference, candidate, findings };
}

function expectQuiet(findings: readonly MockupFindings[]): void {
  for (const { networkRequests, scriptErrors } of findings) {
    expect(networkRequests, "no request out of the disk or the front").toEqual(
      [],
    );
    expect(scriptErrors, "no script error").toEqual([]);
  }
}

/**
 * Whether a zone is drawn: a box of its own, visible (as readStyles reads an element). A frame laid out
 * as `display: contents` (the column below lg) has none: it is no zone at that width, on either side.
 */
async function shows(page: Page, selector: string | null): Promise<boolean> {
  if (selector === null) return true;
  return page.evaluate(
    (selector) =>
      Array.from(document.querySelectorAll(selector)).some(
        (element) =>
          element.getClientRects().length > 0 &&
          getComputedStyle(element).display !== "contents" &&
          getComputedStyle(element).visibility === "visible",
      ),
    selector,
  );
}

/** N1 of a part: its ARIA snapshot and icons, empty when the part is absent or drawn nowhere. */
async function structureOf(
  page: Page,
  selector: string,
): Promise<{ aria: string; icons: string[] }> {
  if ((await page.locator(selector).count()) === 0) {
    return { aria: "", icons: [] };
  }
  return readStructure(page, selector);
}

/** How long a failing zone retries before it is listed: the capture is stable, the clock frozen. */
const N3_RETRY_MS = 1_000;

/** N1, N2 and N3 of a couple in one window: every difference, one line each. */
async function differencesOf(
  { reference, candidate }: Sides,
  couple: VisualCouple,
  window: VisualWindow,
  testInfo: TestInfo,
): Promise<string[]> {
  await reference.setViewportSize(window);
  await candidate.setViewportSize(window);
  const differences: string[] = [];
  const whole = {
    mockup: await structureOf(reference, couple.structure.mockup),
    app: await structureOf(candidate, couple.structure.app),
  };
  await testInfo.attach(`${couple.id}@${window.width}.structure.json`, {
    body: JSON.stringify(whole, null, 2),
    contentType: "application/json",
  });
  const zones = {
    mockup: zonesOf(normalizedAria(whole.mockup.aria)).join(" | "),
    app: zonesOf(normalizedAria(whole.app.aria)).join(" | "),
  };
  if (zones.mockup !== zones.app) {
    differences.push(`N1 zones: ${zones.mockup} → ${zones.app}`);
  }
  const parts =
    couple.parts.length > 0
      ? couple.parts
      : [{ name: "page", ...couple.structure }];
  for (const part of parts) {
    differences.push(
      ...compareStructure(
        await structureOf(reference, part.mockup),
        await structureOf(candidate, part.app),
        couple.variables,
      )
        // The zones are compared once, above, on the whole.
        .filter((line) => !line.startsWith("zones: "))
        .map((line) => `N1 ${part.name}: ${line}`),
    );
  }
  differences.push(
    ...compareStyles(
      await readStyles(
        reference,
        couple.matrix.map(({ name, mockup }) => ({ name, selector: mockup })),
      ),
      await readStyles(
        candidate,
        couple.matrix.map(({ name, app }) => ({ name, selector: app })),
      ),
    ).map((line) => `N2 ${line}`),
  );
  const masks = (side: "mockup" | "app"): VisualMask[] =>
    couple.masks.map((mask) => ({ kind: mask.kind, selector: mask[side] }));
  for (const zone of couple.zones) {
    const inReference = await shows(reference, zone.mockup);
    const inCandidate = await shows(candidate, zone.app);
    if (!inReference && !inCandidate) continue;
    if (inReference !== inCandidate) {
      differences.push(
        `N3 ${zone.name}: shown by the ${inReference ? "mockup" : "application"} only`,
      );
      continue;
    }
    const shot = `${captureName(couple.mockup.file, couple.mockup.state, window)}.${zone.name}.png`;
    const side = (selector: string | null): VisualZone => ({
      name: zone.name,
      selector,
    });
    await writeReference(
      reference,
      side(zone.mockup),
      shot,
      testInfo,
      masks("mockup"),
    );
    const failure = await expectZoneMatches(
      candidate,
      side(zone.app),
      shot,
      masks("app"),
      false,
      N3_RETRY_MS,
    ).then(
      () => null,
      (error: unknown) => error,
    );
    if (failure !== null) {
      differences.push(`N3 ${zone.name}: beyond 0.5 % of the zone`);
    }
  }
  return differences.map((line) => `${window.width}: ${line}`);
}

for (const couple of VISUAL_COUPLES) {
  const windows =
    couple.windows ?? VISUAL_WINDOWS[mockupOf(couple.mockup.file).space];
  test(`RUB-T11 ${couple.id}: N1, N2, N3 at ${windows.map((window) => window.width).join(", ")}`, async ({
    context,
  }, testInfo) => {
    test.setTimeout(180_000);
    const sides = await openCouple(() => context.newPage(), couple);
    const deviations = SUBMITTED_DEVIATIONS[couple.id] ?? [];
    for (const window of windows) {
      const differences = await differencesOf(sides, couple, window, testInfo);
      await testInfo.attach(`${couple.id}@${window.width}.differences.txt`, {
        body: differences.join("\n"),
        contentType: "text/plain",
      });
      // Soft: every window is compared and reported, the first one off does not hide the others.
      expect
        .soft(
          [...differences].sort(),
          `${window.width}: the differences submitted to the founder (F1), and no other`,
        )
        .toEqual(expectedDifferences(deviations, window.width));
    }
    expectQuiet(sides.findings);
  });
}

const DELIBERATE = {
  couple: VISUAL_COUPLES.find((couple) => couple.id === "E01.0:marque"),
  window: { width: 1280, height: 800 },
} as const;

test.describe("RUB-T11 a deliberate difference of the application is seen", () => {
  test("a wording at N1, a shift of 2 px at N2 and N3", async ({
    context,
  }, testInfo) => {
    test.setTimeout(120_000);
    const couple = DELIBERATE.couple;
    if (couple === undefined) throw new Error("no couple E01.0:marque");
    const sides = await openCouple(() => context.newPage(), couple);
    const before = await differencesOf(
      sides,
      couple,
      DELIBERATE.window,
      testInfo,
    );
    await sides.candidate
      .locator('[data-member-nav] a[aria-current="page"]')
      .evaluate((link) => {
        link.append(" !");
      });
    // The list inside the navigation: the zone keeps its box, its content moves.
    await sides.candidate.locator("[data-member-nav] > ul").evaluate((list) => {
      const element = list as HTMLElement;
      element.style.position = "relative";
      element.style.left = "2px";
    });
    const after = await differencesOf(
      sides,
      couple,
      DELIBERATE.window,
      testInfo,
    );
    const added = after.filter((line) => !before.includes(line));
    expect(added.join("\n")).toMatch(/N1 navigation: aria line \d+: .* !/);
    expect(added.join("\n")).toMatch(
      /N2 E01\.0-S07\[0\] <a> x: .*\(2\.00 px > 1 px\)/,
    );
    expect(after).toContain("1280: N3 navigation: beyond 0.5 % of the zone");
    expect(before).not.toContain(
      "1280: N3 navigation: beyond 0.5 % of the zone",
    );
    expectQuiet(sides.findings);
  });
});

test.describe("RUB-T11 a request out of the front is refused and counted", () => {
  // The page's own requests are held by its CSP before the network: the refusal is shown on a
  // navigation, which the CSP does not govern.
  test("a navigation to another origin, while the front itself answers", async ({
    context,
  }) => {
    const couple = VISUAL_COUPLES[0];
    if (couple === undefined) throw new Error("no couple");
    const page = await context.newPage();
    const findings = await watchAppPage(page, originOf(couple));
    await signIn(page, couple.app.load);
    await openAppPage(
      page,
      `${originOf(couple)}${couple.app.path}`,
      async (opened) => {
        await opened
          .locator(couple.app.ready)
          .first()
          .waitFor({ state: "attached" });
      },
    );
    expect(findings.networkRequests, "the front alone answered").toEqual([]);
    const refused = await page.goto("https://example.test/data.png").then(
      () => null,
      (error: unknown) => error,
    );
    expect(refused, "the navigation never reached the network").toBeInstanceOf(
      Error,
    );
    expect(findings.networkRequests).toEqual(["https://example.test/data.png"]);
    expect(findings.scriptErrors).toEqual([]);
  });
});
