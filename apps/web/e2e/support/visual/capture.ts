// What the visual acceptance reads in the browser (docs/mvp/22-refonte-ux-ui/05 §3; RUA-03), for the
// pure comparators of compare.ts. N1: the ARIA snapshot of the page (`ariaSnapshot()`) and its icons
// in document order. N2: the computed styles and the box of each element of a matrix, colors
// normalized by `rgbaOf`, the family rendered (a face of `documentFontFaces` loaded). N3: the
// capture of a zone of the reference, written where `toHaveScreenshot` reads its expectation
// (`snapshotPathTemplate`, under test-results/, emptied by each run, ignored by Git), then compared
// with the candidate in the same run. The masks are those of 05 §3 and only them (MASK_KINDS).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import { documentFontFaces, rgbaOf } from "../rendering";
import {
  canonicalFamily,
  isMaskKind,
  N3_SCREENSHOT_OPTIONS,
  type MaskKind,
  type StyleRecord,
} from "./compare";

/** N1 of a page: its ARIA snapshot and the names of its visible icons, in document order. */
export type StructureCapture = { aria: string; icons: string[] };

/**
 * The visible icons: a mockup draws `<svg><use href="#i-name">` (icons.js), the application
 * `<svg class="lucide lucide-name">` (icons.ts); both read `name`.
 */
export async function readStructure(page: Page): Promise<StructureCapture> {
  const aria = await page.locator("body").ariaSnapshot();
  const icons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("svg")).flatMap((svg) => {
      if (svg.getClientRects().length === 0) return [];
      if (getComputedStyle(svg).visibility !== "visible") return [];
      const use = svg.querySelector('use[href^="#i-"]');
      if (use !== null) return [(use.getAttribute("href") ?? "").slice(3)];
      const lucide = Array.from(svg.classList).find(
        (name) => name.startsWith("lucide-") && name !== "lucide-icon",
      );
      return lucide === undefined ? [] : [lucide.slice("lucide-".length)];
    }),
  );
  return { aria, icons };
}

/** A line of the N2 matrix: a name and the selector of its elements (on one side). */
export type StyleProbe = { name: string; selector: string };

/**
 * Every visible element of the page but the inside of an icon: the matrix of the self-comparison,
 * where both sides are the same document.
 */
export const EVERY_ELEMENT: readonly StyleProbe[] = [
  {
    name: "element",
    selector: "body *:not(svg *, script, style, template, link, meta)",
  },
];

const COLOR_PROPERTIES = [
  "color",
  "background-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
] as const;

const EXACT_PROPERTIES = [
  "font-weight",
  "font-size",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "text-align",
  ...["top", "right", "bottom", "left"].flatMap((side) => [
    `padding-${side}`,
    `border-${side}-width`,
    `border-${side}-style`,
  ]),
  ...["top-left", "top-right", "bottom-right", "bottom-left"].map(
    (corner) => `border-${corner}-radius`,
  ),
  "row-gap",
  "column-gap",
  "opacity",
  "box-shadow",
  "outline-style",
  "outline-width",
] as const;

type RawRecord = Omit<StyleRecord, "colors" | "family" | "familyLoaded"> & {
  colors: Record<string, string>;
  fontFamily: string;
};

/** N2 of a page: one record per visible element of each probe, in document order. */
export async function readStyles(
  page: Page,
  probes: readonly StyleProbe[],
): Promise<StyleRecord[]> {
  const raw = await page.evaluate(
    ({ probes, colorProperties, exactProperties }) =>
      probes.flatMap((probe) =>
        Array.from(document.querySelectorAll(probe.selector))
          .filter((element) => {
            if (element.getClientRects().length === 0) return false;
            return getComputedStyle(element).visibility === "visible";
          })
          .map((element, rank) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return {
              probe: probe.name,
              rank,
              tag: element.tagName.toLowerCase(),
              colors: Object.fromEntries(
                colorProperties.map((property) => [
                  property,
                  style.getPropertyValue(property),
                ]),
              ),
              exact: Object.fromEntries(
                exactProperties.map((property) => [
                  property,
                  style.getPropertyValue(property),
                ]),
              ),
              fontFamily: style.fontFamily,
              stacking: { position: style.position, zIndex: style.zIndex },
              box: {
                x: rect.x + window.scrollX,
                y: rect.y + window.scrollY,
                width: rect.width,
                height: rect.height,
              },
            };
          }),
      ),
    {
      probes: [...probes],
      colorProperties: [...COLOR_PROPERTIES],
      exactProperties: [...EXACT_PROPERTIES],
    },
  );
  const loaded = new Set(
    (await documentFontFaces(page))
      .filter((face) => face.status === "loaded")
      .map((face) => canonicalFamily(face.family)),
  );
  return raw.map(({ colors, fontFamily, ...record }: RawRecord) => {
    const family = canonicalFamily(fontFamily.split(",")[0] ?? "");
    return {
      ...record,
      colors: Object.fromEntries(
        Object.entries(colors).map(([property, value]) => [
          property,
          rgbaOf(value),
        ]),
      ),
      family,
      familyLoaded: loaded.has(family),
    };
  });
}

/** A zone of N3: the viewport (selector null) or the first visible element of a selector. */
export type VisualZone = { name: string; selector: string | null };

/** The zones of the self-comparison: the viewport, and the main region of the state. */
export const DEFAULT_ZONES: readonly VisualZone[] = [
  { name: "viewport", selector: null },
  { name: "main", selector: "main" },
];

/** A mask of N3: one of the kinds of 05 §3 and the selector of what it covers. */
export type VisualMask = { kind: MaskKind; selector: string };

function maskLocators(page: Page, masks: readonly VisualMask[]): Locator[] {
  return masks.map((mask) => {
    if (!isMaskKind(mask.kind)) {
      throw new Error(`"${String(mask.kind)}" is not a mask of 05 §3`);
    }
    return page.locator(mask.selector);
  });
}

function zoneScreenshot(
  page: Page,
  zone: VisualZone,
  options: Parameters<Locator["screenshot"]>[0],
): Promise<Buffer> {
  return zone.selector === null
    ? page.screenshot(options)
    : page
        .locator(zone.selector)
        .filter({ visible: true })
        .first()
        .screenshot(options);
}

/**
 * Captures a zone of the reference and writes it where `toHaveScreenshot(name)` reads its
 * expectation, for the candidate compared in the same test.
 */
export async function writeReference(
  page: Page,
  zone: VisualZone,
  name: string,
  testInfo: TestInfo,
  masks: readonly VisualMask[] = [],
): Promise<void> {
  const options = {
    ...N3_SCREENSHOT_OPTIONS,
    mask: maskLocators(page, masks),
  };
  const image = await zoneScreenshot(page, zone, options);
  const file = testInfo.snapshotPath(name, { kind: "screenshot" });
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, image);
}

/** N3 of a zone of the candidate against the reference written by `writeReference`. */
export async function expectZoneMatches(
  page: Page,
  zone: VisualZone,
  name: string,
  masks: readonly VisualMask[] = [],
  soft = false,
): Promise<void> {
  const options = {
    ...N3_SCREENSHOT_OPTIONS,
    mask: maskLocators(page, masks),
  };
  const assert = soft ? expect.soft : expect;
  if (zone.selector === null) {
    await assert(page).toHaveScreenshot(name, options);
  } else {
    const target = page
      .locator(zone.selector)
      .filter({ visible: true })
      .first();
    await assert(target).toHaveScreenshot(name, options);
  }
}
