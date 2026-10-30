// The rendered state of the KEO charter (D75; docs/mvp/18 §12.6, TK1 to TK6; jalons/rk-fiche.md R1
// and R2): a visual decision is proven by a computed style read on the real element, in the state it
// concerns, on the production build. Read once the element's animations are over, never after a
// fixed wait; a press is held by the mouse (down, read, leave, up), never a click. Shared by
// charter-rendering.spec.ts (members), backoffice.spec.ts and vitrine-unchanged.spec.ts (TK8.2).
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import {
  effectiveTokens,
  fluidTypographyTokens,
} from "@influx/test-kit/guards";
import { expect, test } from "./journey";

export const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

/** The tokens of both fronts (one file, identical byte for byte, G3). */
export const TOKENS = readFileSync(
  path.join(WEB_ROOT, "src", "styles", "tokens.css"),
  "utf8",
);

/** The KEO container: a `div` of the member layout, the `html` of the backoffice. */
export const KEO_CONTAINER = '[data-theme="keo"]';

/**
 * The sizes a title may take under KEO (TK3.1; 20 §11.5): every `--text-*` whose effective KEO value
 * is fixed. The fluid ones (`text-lead`, `text-heading-*`…) stay with the vitrine.
 */
export const KEO_FIXED_TEXT_TOKENS: readonly string[] = (() => {
  const fluid = fluidTypographyTokens(TOKENS);
  return [...effectiveTokens(TOKENS, "keo")]
    .filter(
      ([name, value]) =>
        /^--text-(?!shadow-)[\w-]+$/.test(name) &&
        !name.slice(2).includes("--") &&
        !fluid.includes(name) &&
        !/clamp\(|\dvw\b/.test(value),
    )
    .map(([name]) => name);
})();

/**
 * Waits for the end of the element's animations and transitions (`getAnimations()` flushes the style,
 * so a transition that a hover has just started is among them). An endless animation has no end.
 */
export async function settled(target: Locator): Promise<void> {
  await target.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations()
        .filter(
          (animation) =>
            animation.effect?.getComputedTiming().endTime !== Infinity,
        )
        .map((animation) => animation.finished),
    );
  });
}

/** The element hovered, its transitions over. */
export async function hovered(target: Locator): Promise<void> {
  await target.hover();
  await settled(target);
}

/**
 * Reads the element while the mouse holds it down, then leaves it before releasing: no click reaches
 * it (18 §12.6). The read happens once its transitions are over.
 */
export async function whilePressed<T>(
  page: Page,
  target: Locator,
  read: () => Promise<T>,
): Promise<T> {
  await target.hover();
  await page.mouse.down();
  try {
    await settled(target);
    return await read();
  } finally {
    await page.mouse.move(1, 1);
    await page.mouse.up();
  }
}

/**
 * The width the element is drawn at over its layout width: 1 at rest, the scale of a zoom or of a
 * press. The layout width is the computed one (border box, unrounded): `offsetWidth` rounds to a
 * pixel, half a pixel on a narrow button being more than the gap between 1.02 and 1.03.
 */
export function drawnRatio(target: Locator): Promise<number> {
  return target.evaluate((element) => {
    const style = getComputedStyle(element);
    const sides =
      style.boxSizing === "border-box"
        ? 0
        : [
            style.paddingLeft,
            style.paddingRight,
            style.borderLeftWidth,
            style.borderRightWidth,
          ].reduce((total, value) => total + parseFloat(value), 0);
    return (
      element.getBoundingClientRect().width / (parseFloat(style.width) + sides)
    );
  });
}

/** A computed property of the element. */
export function computed(target: Locator, property: string): Promise<string> {
  return target.evaluate(
    (element, name) => getComputedStyle(element).getPropertyValue(name),
    property,
  );
}

/** A color as sRGB channels (0 to 255) and its alpha (0 to 1). */
export type Rgba = { r: number; g: number; b: number; a: number };

/** `rgb()`, `rgba()` or `color(srgb …)` as Chromium serializes a computed color; null otherwise. */
export function rgbaOf(color: string): Rgba | null {
  const rgb =
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(
      color.trim(),
    );
  if (rgb !== null) {
    const alpha = rgb[4] ?? "1";
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: alpha.endsWith("%") ? parseFloat(alpha) / 100 : Number(alpha),
    };
  }
  const srgb =
    /^color\(\s*srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(
      color.trim(),
    );
  if (srgb !== null) {
    const alpha = srgb[4] ?? "1";
    return {
      r: Number(srgb[1]) * 255,
      g: Number(srgb[2]) * 255,
      b: Number(srgb[3]) * 255,
      a: alpha.endsWith("%") ? parseFloat(alpha) / 100 : Number(alpha),
    };
  }
  return null;
}

/** The WCAG relative luminance of an opaque color. */
export function luminance({ r, g, b }: Rgba): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** The WCAG contrast ratio of two opaque colors. */
export function contrast(first: Rgba, second: Rgba): number {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (a, b) => b - a,
  );
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/** One layer of a computed `box-shadow`: its color, its offsets, blur and spread in px. */
export type ShadowLayer = Rgba & {
  x: number;
  y: number;
  blur: number;
  spread: number;
  inset: boolean;
};

/** The layers of a computed `box-shadow` (Chromium writes the color first); none for `none`. */
export function shadowLayers(value: string): ShadowLayer[] {
  if (value.trim() === "none" || value.trim() === "") return [];
  const layers: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      layers.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  layers.push(current);
  return layers.map((layer) => {
    const text = layer.trim();
    const color =
      /^(?:rgba?|color)\([^)]*\)/.exec(text)?.[0] ??
      /(?:rgba?|color)\([^)]*\)$/.exec(text)?.[0] ??
      "rgba(0, 0, 0, 0)";
    const lengths = text
      .replace(color, "")
      .replace("inset", "")
      .trim()
      .split(/\s+/)
      .map((length) => parseFloat(length));
    return {
      ...(rgbaOf(color) ?? { r: 0, g: 0, b: 0, a: 0 }),
      x: lengths[0] ?? 0,
      y: lengths[1] ?? 0,
      blur: lengths[2] ?? 0,
      spread: lengths[3] ?? 0,
      inset: /\binset\b/.test(text),
    };
  });
}

/** The layers that paint something: a color with some alpha, and an offset, a blur or a spread. */
export function visibleShadows(value: string): ShadowLayer[] {
  return shadowLayers(value).filter(
    (layer) =>
      layer.a > 0 &&
      (layer.blur > 0 || layer.spread !== 0 || layer.x !== 0 || layer.y !== 0),
  );
}

/**
 * The computed value of a color token, read on a probe inside the KEO container (or under it, for the
 * `html` of the backoffice); null when the token is not declared there.
 */
export function tokenColor(page: Page, name: string): Promise<Rgba | null> {
  return page
    .evaluate(
      ({ selector, token }) => {
        const container = document.querySelector(selector);
        if (container === null) return null;
        const host =
          container === document.documentElement ? document.body : container;
        const probe = document.createElement("span");
        host.append(probe);
        const declared = getComputedStyle(probe).getPropertyValue(token).trim();
        probe.style.color = `var(${token})`;
        const color = getComputedStyle(probe).color;
        probe.remove();
        return declared === "" ? null : color;
      },
      { selector: KEO_CONTAINER, token: name },
    )
    .then((color) => (color === null ? null : rgbaOf(color)));
}

/** The computed value of a token, as text, on the KEO container; "" when it is not declared. */
export function tokenValue(page: Page, name: string): Promise<string> {
  return page.evaluate(
    ({ selector, token }) => {
      const container = document.querySelector(selector);
      return container === null
        ? ""
        : getComputedStyle(container).getPropertyValue(token).trim();
    },
    { selector: KEO_CONTAINER, token: name },
  );
}

/** The first family of a computed `font-family`, unquoted and in lower case. */
export function firstFamily(fontFamily: string): string {
  return (fontFamily.split(",")[0] ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .toLowerCase();
}

/** A face of the document's font set: its family, unquoted and in lower case, and its status. */
export type DocumentFontFace = { family: string; status: FontFaceLoadStatus };

/** The faces of the document (those next/font declared), once `document.fonts` is ready. */
export function documentFontFaces(page: Page): Promise<DocumentFontFace[]> {
  return page
    .evaluate(async () => {
      await document.fonts.ready;
      const faces: { family: string; status: FontFaceLoadStatus }[] = [];
      document.fonts.forEach((face) => {
        faces.push({ family: face.family, status: face.status });
      });
      return faces;
    })
    .then((faces) =>
      faces.map(({ family, status }) => ({
        family: firstFamily(family),
        status,
      })),
    );
}

/**
 * The first family of `--font-display` inside the KEO container (Manrope's, under KEO). Under KEO it
 * is a family that next/font declared, never one of the system stack: a token resolved on the system
 * stack fails here (UX-1), instead of being compared with a title that falls back on it too.
 */
export async function displayFamily(page: Page): Promise<string> {
  const family = firstFamily(
    await page.evaluate((selector) => {
      const container = document.querySelector(selector);
      if (container === null) return "";
      const host =
        container === document.documentElement ? document.body : container;
      const probe = document.createElement("span");
      probe.style.fontFamily = "var(--font-display)";
      host.append(probe);
      const family = getComputedStyle(probe).fontFamily;
      probe.remove();
      return family;
    }, KEO_CONTAINER),
  );
  const declared = (await documentFontFaces(page))
    .map((face) => face.family)
    .filter((name) => !name.endsWith(" fallback"));
  if (!declared.includes(family)) {
    throw new Error(
      `--font-display resolves to "${family}" under KEO, not a family of next/font (${declared.join(", ")})`,
    );
  }
  return family;
}

/**
 * UX-1: the KEO typefaces rendered, not only declared. Once `document.fonts` is ready, the latin face
 * of Manrope (the one next/font preloads) is loaded; the heading is drawn in its family, and the
 * button in a family that next/font generated, never in the system stack (02 §21.4).
 */
export async function expectKeoTypefaces(
  page: Page,
  heading: Locator,
  button: Locator,
): Promise<void> {
  await expect(heading).toBeVisible();
  await expect(button).toBeVisible();
  const faces = await documentFontFaces(page);
  const manrope = faces.find(
    ({ family }) => family.includes("manrope") && !/ext|fallback/.test(family),
  );
  expect(manrope, "the latin face of Manrope declared").toBeDefined();
  expect(manrope?.status, "the latin face of Manrope loaded").toBe("loaded");
  expect(
    firstFamily(await computed(heading, "font-family")),
    "the heading in Manrope",
  ).toBe(manrope?.family);
  expect(
    faces
      .map(({ family }) => family)
      .filter((family) => !family.endsWith(" fallback")),
    "the button in a family of next/font",
  ).toContain(firstFamily(await computed(button, "font-family")));
}

/**
 * The mean luma of each row of a strip of the page, 0 to 255 (0.2126 R + 0.7152 G + 0.0722 B, 18
 * §12.6): a screenshot of the strip, decoded in the browser by `createImageBitmap` and a canvas, no
 * dependency (architecte, RK-1). The strip is in CSS pixels of the window, scrolled to the top; a
 * row is averaged over the width of the strip, which neutralizes Chromium's dithering of gradients.
 */
export async function rowLumas(
  page: Page,
  strip: { x: number; y: number; width: number; height: number },
): Promise<number[]> {
  const png = await page.screenshot({
    clip: strip,
    animations: "disabled",
    caret: "hide",
    scale: "css",
  });
  return page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
      { colorSpaceConversion: "none", premultiplyAlpha: "none" },
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("no 2D context");
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(
      0,
      0,
      bitmap.width,
      bitmap.height,
    );
    const rows: number[] = [];
    for (let y = 0; y < height; y += 1) {
      let sum = 0;
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        sum +=
          0.2126 * (data[index] ?? 0) +
          0.7152 * (data[index + 1] ?? 0) +
          0.0722 * (data[index + 2] ?? 0);
      }
      rows.push(sum / width);
    }
    return rows;
  }, png.toString("base64"));
}

/** The luma of an opaque color, as rowLumas measures it. */
export function luma({ r, g, b }: Rgba): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Two colors equal to a unit of a channel (the rounding of a serialization). */
export function sameColor(first: Rgba, second: Rgba): boolean {
  return (
    Math.abs(first.r - second.r) <= 1 &&
    Math.abs(first.g - second.g) <= 1 &&
    Math.abs(first.b - second.b) <= 1
  );
}

/** The brand green as the page computes it. */
export async function brandGreen(page: Page): Promise<Rgba> {
  const green = await tokenColor(page, "--color-brand-primary");
  if (green === null) throw new Error("--color-brand-primary is not declared");
  return green;
}

// ---------------------------------------------------------------------------------------------
// TK1: the glow, the zoom and the press of a button (20 §11.5)
// ---------------------------------------------------------------------------------------------

/**
 * Two decimals, ± 0.005, for the scales of 20 §11.5 (1.03, 0.98): the zoom before the milestone,
 * 1.02, lies 0.01 from 1.03, on the edge of the ± 0.01 of 18 §12.6. The layout width is unrounded,
 * so the ratio is exact to the thousandth.
 */
export const SCALE_DIGITS = 2;

/** TK1.1: a glow of the brand green at rest, other and wider on hover. */
export async function expectGreenGlow(
  page: Page,
  button: Locator,
): Promise<void> {
  await expect(button).toBeVisible();
  const green = await brandGreen(page);
  const rest = visibleShadows(await computed(button, "box-shadow"));
  expect(rest, "a glow at rest").not.toEqual([]);
  expect(
    rest.every((layer) => sameColor(layer, green)),
    "the glow is the brand green",
  ).toBe(true);
  await hovered(button);
  const hover = visibleShadows(await computed(button, "box-shadow"));
  expect(hover, "a glow on hover, other than at rest").not.toEqual(rest);
  expect(hover.every((layer) => sameColor(layer, green))).toBe(true);
  expect(Math.max(...hover.map((layer) => layer.blur))).toBeGreaterThan(
    Math.max(...rest.map((layer) => layer.blur)),
  );
}

/** TK1.1 and TK1.4: no glow, at rest nor on hover (a disabled button is hovered by force). */
export async function expectNoGlow(
  button: Locator,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  expect(
    visibleShadows(await computed(button, "box-shadow")),
    "at rest",
  ).toEqual([]);
  await button.hover({ force });
  await settled(button);
  expect(
    visibleShadows(await computed(button, "box-shadow")),
    "on hover",
  ).toEqual([]);
}

/** TK1.2: 1.03 on hover, 0.98 while pressed. */
export async function expectZoomAndPress(
  page: Page,
  button: Locator,
): Promise<void> {
  await hovered(button);
  expect(await drawnRatio(button), "on hover").toBeCloseTo(1.03, SCALE_DIGITS);
  expect(
    await whilePressed(page, button, () => drawnRatio(button)),
    "pressed",
  ).toBeCloseTo(0.98, SCALE_DIGITS);
}

/** TK1.2 and TK1.4: drawn at its layout width, on hover and while pressed. */
export async function expectStill(
  page: Page,
  button: Locator,
  { force = false }: { force?: boolean } = {},
): Promise<void> {
  await button.hover({ force });
  await settled(button);
  expect(await drawnRatio(button), "on hover").toBeCloseTo(1, 3);
  await page.mouse.down();
  try {
    await settled(button);
    expect(await drawnRatio(button), "pressed").toBeCloseTo(1, 3);
  } finally {
    await page.mouse.move(1, 1);
    await page.mouse.up();
  }
}

// ---------------------------------------------------------------------------------------------
// TK2: the header glow on the ground of the screen container (20 §11.5)
// ---------------------------------------------------------------------------------------------

/** Thresholds of TK2.2, in luma /255 (expert-ux, RK-0; 18 §12.6). */
export const GLOW_PEAK = { min: 16, max: 25 } as const;
export const GLOW_EDGE_MAX = 2;

/** The probe of TK2.2 reads 4 px around an edge of the header, and 4 px under the container's top. */
const EDGE_OFFSET_PX = 4;
const STRIP_WIDTH_PX = 16;

/**
 * What TK2.1 reads: the ground of the screen container (the parent of the header that holds the h1),
 * the elements of the page whose ground is a radial gradient, the height of the glow, and the
 * ancestors whose overflow cuts the glow's box.
 */
export function glowFacts(page: Page) {
  return page.evaluate(() => {
    const container = document
      .querySelector("h1")
      ?.closest("header")?.parentElement;
    if (container === null || container === undefined) return null;
    const probe = document.createElement("div");
    probe.style.height = "var(--size-header-glow)";
    container.append(probe);
    const glowHeight = probe.getBoundingClientRect().height;
    probe.remove();
    const box = container.getBoundingClientRect();
    const bottom = box.top + Math.min(glowHeight, box.height);
    const clippedBy: string[] = [];
    for (
      let ancestor = container.parentElement;
      ancestor !== null;
      ancestor = ancestor.parentElement
    ) {
      const style = getComputedStyle(ancestor);
      const rect = ancestor.getBoundingClientRect();
      const clips =
        style.overflowX !== "visible" || style.overflowY !== "visible";
      if (
        clips &&
        (rect.top > box.top ||
          rect.bottom < bottom ||
          rect.left > box.left ||
          rect.right < box.right)
      ) {
        clippedBy.push(ancestor.tagName.toLowerCase());
      }
    }
    const glows = [...document.querySelectorAll("*")].filter((element) =>
      getComputedStyle(element).backgroundImage.includes("radial-gradient"),
    );
    return {
      ground: getComputedStyle(container).backgroundImage,
      glows: glows.length,
      containerIsTheGlow: glows.includes(container),
      height: box.height,
      glowHeight,
      clippedBy,
    };
  });
}

/** TK2.1: the container's ground is the glow, the only one of the page, whole. */
export function expectWholeGlow(
  where: string,
  facts: Awaited<ReturnType<typeof glowFacts>>,
): void {
  expect(facts, where).not.toBeNull();
  expect(facts?.ground, `${where}: the ground of the container`).toContain(
    "radial-gradient",
  );
  expect(facts?.containerIsTheGlow, where).toBe(true);
  expect(facts?.glows, `${where}: one glow per page`).toBe(1);
  expect(facts?.glowHeight, `${where}: --size-header-glow`).toBeGreaterThan(0);
  expect(
    facts?.height ?? 0,
    `${where}: the glow fades out inside the container`,
  ).toBeGreaterThanOrEqual(facts?.glowHeight ?? Infinity);
  expect(facts?.clippedBy, `${where}: no ancestor cuts it`).toEqual([]);
}

/**
 * The probe of TK2.2: the luma over the page 4 px under the top of the container, and the step
 * between the rows 4 px above and below each edge of the header, at the centre of the container.
 */
export async function glowProbe(
  page: Page,
): Promise<{ peak: number; edges: Record<string, number> }> {
  await page.evaluate(() => window.scrollTo(0, 0));
  const boxes = await page.evaluate(() => {
    const header = document.querySelector("h1")?.closest("header");
    const container = header?.parentElement;
    if (header === null || header === undefined || !container) return null;
    const box = container.getBoundingClientRect();
    const head = header.getBoundingClientRect();
    return {
      centre: box.left + box.width / 2,
      top: box.top,
      headerTop: head.top,
      headerBottom: head.bottom,
    };
  });
  if (boxes === null) throw new Error("no header holding the h1");
  const top = Math.floor(boxes.top);
  const lumas = await rowLumas(page, {
    x: Math.round(boxes.centre - STRIP_WIDTH_PX / 2),
    y: top,
    width: STRIP_WIDTH_PX,
    height: Math.ceil(boxes.headerBottom) + EDGE_OFFSET_PX + 2 - top,
  });
  const at = (y: number) => lumas[Math.floor(y) - top] ?? Number.NaN;
  const ground = await tokenColor(page, "--color-surface-page");
  if (ground === null) throw new Error("--color-surface-page is not declared");
  const edge = (y: number) =>
    Math.abs(at(y - EDGE_OFFSET_PX) - at(y + EDGE_OFFSET_PX));
  return {
    peak: at(boxes.top + EDGE_OFFSET_PX) - luma(ground),
    edges: {
      "top of the header": edge(boxes.headerTop),
      "bottom of the header": edge(boxes.headerBottom),
    },
  };
}

/**
 * TK2.2: the peak within its thresholds, no edge. Soft: each measure is reported, the edge of the
 * rectangle before the milestone as much as its missing peak.
 */
export function expectSoftGlow(
  where: string,
  probe: Awaited<ReturnType<typeof glowProbe>>,
): void {
  expect
    .soft(probe.peak, `${where}: the peak`)
    .toBeGreaterThanOrEqual(GLOW_PEAK.min);
  expect
    .soft(probe.peak, `${where}: the peak`)
    .toBeLessThanOrEqual(GLOW_PEAK.max);
  for (const [edge, step] of Object.entries(probe.edges)) {
    expect.soft(step, `${where}: ${edge}`).toBeLessThanOrEqual(GLOW_EDGE_MAX);
  }
}

/** Whether the page scrolls sideways, and whether a glow is drawn on it (TK2.3). */
export function sidewaysFacts(
  page: Page,
): Promise<{ overflow: number; glows: number }> {
  return page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    glows: [...document.querySelectorAll("*")].filter((element) =>
      getComputedStyle(element).backgroundImage.includes("radial-gradient"),
    ).length,
  }));
}

// ---------------------------------------------------------------------------------------------
// TK3: the titles (20 §11.5)
// ---------------------------------------------------------------------------------------------

/** TK3.3: the letter-spacing of a title is `--tracking-heading`, a negative token. */
export async function expectHeadingTracking(
  page: Page,
  heading: Locator,
): Promise<void> {
  await expect(heading).toBeVisible();
  const token = await tokenValue(page, "--tracking-heading");
  expect(token, "--tracking-heading in em").toMatch(/^-?[\d.]+em$/);
  const size = parseFloat(await computed(heading, "font-size"));
  const expected = parseFloat(token) * size;
  expect(expected, "a negative token").toBeLessThan(0);
  expect(
    parseFloat(await computed(heading, "letter-spacing")) || 0,
    "letter-spacing in px",
  ).toBeCloseTo(expected, 2);
}

/** A visible title of a screen: level, text, first family, size and the fixed KEO tokens of that size. */
export type HeadingFacts = {
  level: number;
  text: string;
  family: string;
  size: number;
  tokens: string[];
};

/** The titles of one screen at one width, as an axe pass of 18 §12.2 sees them (TK3.1). */
export type HeadingSurvey = {
  origin: string;
  path: string;
  screen: string;
  width: number;
  display: string;
  headings: HeadingFacts[];
};

/**
 * Every visible `h1`–`h4` of a KEO page (a title hidden for the eyes, 1 px wide, aside), its first
 * family and its size, with the fixed KEO `--text-*` tokens of that size at this width; null on a
 * page without the KEO container (the vitrine).
 */
export async function surveyHeadings(
  page: Page,
  screen: string,
): Promise<HeadingSurvey | null> {
  const facts = await page.evaluate(
    ({ selector, names }) => {
      const container = document.querySelector(selector);
      if (container === null) return null;
      const host =
        container === document.documentElement ? document.body : container;
      const probe = document.createElement("span");
      host.append(probe);
      probe.style.fontFamily = "var(--font-display)";
      const display = getComputedStyle(probe).fontFamily;
      const sizes = names.flatMap((name) => {
        if (getComputedStyle(probe).getPropertyValue(name).trim() === "") {
          return [];
        }
        probe.style.fontSize = `var(${name})`;
        return [[name, parseFloat(getComputedStyle(probe).fontSize)] as const];
      });
      probe.remove();
      const headings = [
        ...document.querySelectorAll<HTMLElement>("h1, h2, h3, h4"),
      ]
        .filter((heading) => {
          const box = heading.getBoundingClientRect();
          return (
            heading.checkVisibility({ visibilityProperty: true }) &&
            box.width > 1 &&
            box.height > 1
          );
        })
        .map((heading) => {
          const style = getComputedStyle(heading);
          const size = parseFloat(style.fontSize);
          return {
            level: Number(heading.tagName.slice(1)),
            text: (heading.textContent ?? "").trim().slice(0, 60),
            family: style.fontFamily,
            size,
            tokens: sizes
              .filter(([, value]) => Math.abs(value - size) < 0.01)
              .map(([name]) => name),
          };
        });
      return {
        origin: location.origin,
        path: location.pathname,
        width: window.innerWidth,
        display,
        headings,
      };
    },
    { selector: KEO_CONTAINER, names: KEO_FIXED_TEXT_TOKENS },
  );
  if (facts === null) return null;
  return {
    ...facts,
    screen,
    display: firstFamily(facts.display),
    headings: facts.headings.map((heading) => ({
      ...heading,
      family: firstFamily(heading.family),
    })),
  };
}

/** Where the axe passes leave their surveys for TK3.1 (charter-headings.spec.ts reads them). */
export const HEADING_SURVEYS = "tk3-headings";

const surveysWritten = new Map<string, number>();

/**
 * TK3.1 grafted on the axe passes of 18 §12.2 (no navigation of its own): the survey of the screen
 * the pass has just checked, written beside the run's results; nothing on a vitrine page.
 */
export async function recordHeadings(
  page: Page,
  screen: string,
): Promise<void> {
  const survey = await surveyHeadings(page, screen);
  if (survey === null) return;
  const info = test.info();
  const index = (surveysWritten.get(info.testId) ?? 0) + 1;
  surveysWritten.set(info.testId, index);
  const directory = path.join(info.project.outputDir, HEADING_SURVEYS);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    path.join(directory, `${info.testId}-${index}.json`),
    JSON.stringify(survey),
  );
}
