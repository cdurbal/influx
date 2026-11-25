// RUA-T6, the self-comparison of the tool (docs/mvp/22-refonte-ux-ui/05 §3; jalons/rua/03.md,
// modele-archi.md §5): a state per family of mockups, rendered twice in the same run, gives 0
// difference at N1, N2 and N3 in every window of its space; and a deliberate difference per level is
// seen (a wording at N1, a color off by one at N2, a shift of 2 px at N2 and N3). The failures are
// expected and caught, never `test.fail()`. Local only, under E2E_VISUAL (playwright.config.ts).
import { expect, test, type Page } from "@playwright/test";
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
  FAMILY_SAMPLES,
  mockupOf,
  VISUAL_WINDOWS,
  type MockupFamily,
  type VisualWindow,
} from "../support/visual/mockups";
import {
  openMockupState,
  watchMockupPage,
  type MockupFindings,
} from "../support/visual/neutralize";

test.beforeAll(() => {
  // A reference is never recorded on purpose (05 §3): `-u` would let a run write one.
  expect(
    test.info().config.updateSnapshots,
    "the visual tool runs without -u",
  ).toBe("none");
});

/** Two pages of the same window: the reference and the candidate, each watched. */
async function pair(
  newPage: () => Promise<Page>,
  window: VisualWindow,
): Promise<{
  reference: Page;
  candidate: Page;
  findings: MockupFindings[];
}> {
  const reference = await newPage();
  const candidate = await newPage();
  await reference.setViewportSize(window);
  await candidate.setViewportSize(window);
  const findings = [
    await watchMockupPage(reference),
    await watchMockupPage(candidate),
  ];
  return { reference, candidate, findings };
}

function expectQuiet(findings: readonly MockupFindings[]): void {
  for (const { networkRequests, scriptErrors } of findings) {
    expect(networkRequests, "no request to the network").toEqual([]);
    expect(scriptErrors, "no script error").toEqual([]);
  }
}

const FAMILIES = Object.keys(FAMILY_SAMPLES) as MockupFamily[];

for (const family of FAMILIES) {
  const sample = FAMILY_SAMPLES[family];
  const mockup = mockupOf(sample.file);
  for (const window of VISUAL_WINDOWS[mockup.space]) {
    const name = captureName(sample.file, sample.state, window);
    test(`${family}: ${name} against itself, 0 difference at N1, N2, N3`, async ({
      context,
    }, testInfo) => {
      const { reference, candidate, findings } = await pair(
        () => context.newPage(),
        window,
      );
      await openMockupState(reference, sample.file, sample.state);
      await openMockupState(candidate, sample.file, sample.state);
      expect(
        compareStructure(
          await readStructure(reference),
          await readStructure(candidate),
        ),
        "N1",
      ).toEqual([]);
      expect(
        compareStyles(
          await readStyles(reference, EVERY_ELEMENT),
          await readStyles(candidate, EVERY_ELEMENT),
        ),
        "N2",
      ).toEqual([]);
      for (const zone of DEFAULT_ZONES) {
        const shot = `${name}.${zone.name}.png`;
        await writeReference(reference, zone, shot, testInfo);
        await expectZoneMatches(candidate, zone, shot);
      }
      expectQuiet(findings);
    });
  }
}

const DELIBERATE = {
  file: FAMILY_SAMPLES.member.file,
  state: FAMILY_SAMPLES.member.state,
  window: { width: 1280, height: 800 },
} as const;

test.describe("a request out of the disk is refused and counted (RUAS-5)", () => {
  test("a WebSocket, like a request to http(s)", async ({ context }) => {
    const page = await context.newPage();
    const findings = await watchMockupPage(page);
    await openMockupState(page, DELIBERATE.file, DELIBERATE.state);
    const closed = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const socket = new window.WebSocket("wss://example.test/socket");
          socket.onclose = () => resolve(true);
          socket.onerror = () => resolve(true);
        }),
    );
    expect(closed, "the socket never opened").toBe(true);
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const image = new Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = "https://example.test/data.png";
        }),
    );
    expect(findings.networkRequests).toEqual([
      "wss://example.test/socket",
      "https://example.test/data.png",
    ]);
    expect(findings.scriptErrors).toEqual([]);
  });
});

test.describe("a deliberate difference is seen", () => {
  test("a wording changed: N1 sees it", async ({ context }) => {
    const { reference, candidate } = await pair(
      () => context.newPage(),
      DELIBERATE.window,
    );
    await openMockupState(reference, DELIBERATE.file, DELIBERATE.state);
    await openMockupState(candidate, DELIBERATE.file, DELIBERATE.state);
    await candidate
      .locator("main h1")
      .filter({ visible: true })
      .first()
      .evaluate((heading) => {
        heading.textContent = `${heading.textContent ?? ""} !`;
      });
    const differences = compareStructure(
      await readStructure(reference),
      await readStructure(candidate),
    );
    expect(differences.length).toBeGreaterThan(0);
    expect(differences.join("\n")).toMatch(/aria line \d+: .* !/);
  });

  test("a color off by one: N2 sees it", async ({ context }) => {
    const { reference, candidate } = await pair(
      () => context.newPage(),
      DELIBERATE.window,
    );
    await openMockupState(reference, DELIBERATE.file, DELIBERATE.state);
    await openMockupState(candidate, DELIBERATE.file, DELIBERATE.state);
    await candidate
      .locator("main h1")
      .filter({ visible: true })
      .first()
      .evaluate((heading) => {
        const channels = /\d+/g;
        const [r = 0, g = 0, b = 0] = (
          getComputedStyle(heading).color.match(channels) ?? []
        ).map(Number);
        const red = r === 255 ? r - 1 : r + 1;
        (heading as HTMLElement).style.color = `rgb(${red}, ${g}, ${b})`;
      });
    const differences = compareStyles(
      await readStyles(reference, EVERY_ELEMENT),
      await readStyles(candidate, EVERY_ELEMENT),
    );
    // The heading's color, and what follows it (`currentcolor` borders, inheriting children): colors
    // only, nothing else moved.
    expect(differences.join("\n")).toMatch(/<h1> color: /);
    expect(differences.filter((line) => !/-?color: /.test(line))).toEqual([]);
  });

  test("a shift of 2 px: N2 and N3 see it", async ({ context }, testInfo) => {
    const { reference, candidate } = await pair(
      () => context.newPage(),
      DELIBERATE.window,
    );
    await openMockupState(reference, DELIBERATE.file, DELIBERATE.state);
    await openMockupState(candidate, DELIBERATE.file, DELIBERATE.state);
    await candidate
      .locator("main")
      .first()
      .evaluate((main) => {
        for (const child of Array.from(main.children)) {
          const element = child as HTMLElement;
          element.style.position = "relative";
          element.style.left = "2px";
        }
      });
    const differences = compareStyles(
      await readStyles(reference, EVERY_ELEMENT),
      await readStyles(candidate, EVERY_ELEMENT),
    );
    expect(differences.join("\n")).toMatch(/ x: .*\(2\.00 px > 1 px\)/);
    const zone = { name: "main", selector: "main" };
    const shot = `${captureName(DELIBERATE.file, DELIBERATE.state, DELIBERATE.window)}.shifted.png`;
    await writeReference(reference, zone, shot, testInfo);
    const failure = await expectZoneMatches(candidate, zone, shot).then(
      () => null,
      (error: unknown) => error,
    );
    expect(failure, "N3 fails on the shifted zone").toBeInstanceOf(Error);
    expect(String((failure as Error).message)).toMatch(/pixels/i);
  });
});
