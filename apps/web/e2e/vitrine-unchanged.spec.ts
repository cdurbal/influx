// The vitrine unchanged by the DS milestone (D59, D73; 18 §12.1 TD4.2 and TD4.3; A-9): the
// computed-style fingerprint of /fr and /en, at 375 and 1440 px, equals the one taken on the parent
// of DS-1, the code before any change of the milestone. G3e freezes the tokens; this sees a shared
// component or globals.css. The fixture is never edited by hand: it is recorded again by
// `pnpm --filter @influx/web e2e:record-vitrine` (this spec with --update-snapshots), and the
// commit that records it says why the landing changed. The RK milestone (D75; 18 §12.6, TK8.2,
// TK3.4) adds the states of the landing's buttons and of a card, taken on the parent of RK-1 in
// vitrine-states.json, recorded the same way, and the body left unsmoothed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "@playwright/test";
import {
  DOCUMENT_ELEMENTS,
  FINGERPRINT_ELEMENTS,
  fingerprintDifferences,
  fingerprintOf,
  type Fingerprint,
} from "./support/computed-styles";
import { expect, open, test, type Locale } from "./support/journey";
import {
  computed,
  drawnRatio,
  hovered,
  settled,
  whilePressed,
} from "./support/rendering";

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "vitrine-computed-styles.json",
);

const LOCALES: readonly Locale[] = ["fr", "en"];
const WIDTHS = [375, 1440] as const;
const HEIGHT = 900;

/** Fingerprints by "locale@width". */
type Fixture = Record<string, Fingerprint>;

function key(locale: Locale, width: number): string {
  return `${locale}@${width}`;
}

/** --update-snapshots records the fixture instead of comparing with it. */
function recording(): boolean {
  const mode = test.info().config.updateSnapshots;
  return mode === "all" || mode === "changed";
}

function readFixture(): Fixture {
  expect(
    existsSync(FIXTURE),
    `${FIXTURE} is missing: record it with pnpm --filter @influx/web e2e:record-vitrine`,
  ).toBe(true);
  return JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;
}

/** The elements of a fingerprint, with or without html and body. */
function pick(fingerprint: Fingerprint, document: boolean): Fingerprint {
  return Object.fromEntries(
    Object.entries(fingerprint).filter(
      ([name]) => DOCUMENT_ELEMENTS.includes(name) === document,
    ),
  );
}

async function fingerprintAt(
  page: Parameters<typeof fingerprintOf>[0],
  locale: Locale,
  width: number,
): Promise<Fingerprint> {
  await page.setViewportSize({ width, height: HEIGHT });
  await open(page, `/${locale}`);
  return fingerprintOf(page);
}

test("TD4.2: the computed styles of /fr and /en, at 375 and 1440, are those of the fixture", async ({
  page,
}) => {
  const actual: Fixture = {};
  for (const locale of LOCALES) {
    for (const width of WIDTHS) {
      actual[key(locale, width)] = await fingerprintAt(page, locale, width);
    }
  }
  if (recording()) {
    writeFileSync(FIXTURE, `${JSON.stringify(actual, null, 2)}\n`);
    return;
  }
  const fixture = readFixture();
  expect(Object.keys(actual)).toEqual(Object.keys(fixture));
  for (const [name, fingerprint] of Object.entries(actual)) {
    const expected = fixture[name] ?? {};
    expect(pick(expected, false), name).not.toEqual({});
    expect(
      fingerprintDifferences(pick(expected, false), pick(fingerprint, false)),
      name,
    ).toEqual([]);
  }
});

for (const locale of LOCALES) {
  test(`TD4.3: /${locale}, html and body keep their classes and their declared font-family`, async ({
    page,
  }) => {
    test.skip(recording(), "TD4.2 records the whole fixture");
    const fixture = readFixture();
    for (const width of WIDTHS) {
      const expected = pick(fixture[key(locale, width)] ?? {}, true);
      expect(Object.keys(expected)).toEqual([...DOCUMENT_ELEMENTS]);
      const actual = pick(await fingerprintAt(page, locale, width), true);
      expect(
        fingerprintDifferences(expected, actual),
        key(locale, width),
      ).toEqual([]);
    }
  });
}

// G7: the comparison fails on a single changed property (a CSSOM change, which the CSP allows).
test("the fingerprint detects a changed radius and a changed weight (self-check)", async ({
  page,
}) => {
  test.skip(recording(), "TD4.2 records the whole fixture");
  const before = await fingerprintAt(page, "fr", 1440);
  await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const cta = document.querySelector<HTMLElement>(
      '[aria-describedby="hero-creator-audience"]',
    );
    if (h1 === null || cta === null) throw new Error("landing changed");
    h1.style.borderTopLeftRadius = "3px";
    cta.style.fontWeight = "700";
  });
  const after = await fingerprintOf(page);
  expect(fingerprintDifferences(before, after)).toEqual([
    `h1 border-top-left-radius: "0px" → "3px"`,
    `secondaryCta font-weight: "500" → "700"`,
  ]);
});

const STATES_FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "vitrine-states.json",
);

/** The landing's two calls to action and a card of the pricing (those of TD4.2). */
const STATE_ELEMENTS = {
  primaryCta: FINGERPRINT_ELEMENTS.primaryCta ?? "",
  secondaryCta: FINGERPRINT_ELEMENTS.secondaryCta ?? "",
  card: FINGERPRINT_ELEMENTS.card ?? "",
} as const;

/** What an effect of the RK milestone would change in a state (18 §12.6, TK8.2). */
const STATE_PROPERTIES: readonly string[] = [
  "box-shadow",
  ...["top", "right", "bottom", "left"].map((side) => `border-${side}-color`),
  "font-weight",
  "-webkit-font-smoothing",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
];

/** The properties of the element and the ratio of its drawn width (2 decimals: a zoom of 1 %). */
async function stateOf(target: Locator): Promise<Record<string, string>> {
  const properties = await Promise.all(
    STATE_PROPERTIES.map(
      async (property) => [property, await computed(target, property)] as const,
    ),
  );
  return {
    ...Object.fromEntries(properties),
    ratio: (await drawnRatio(target)).toFixed(3),
  };
}

/** At rest, hovered, pressed and, for a control, focused from the keyboard (:focus-visible). */
async function statesOf(page: Page, selector: string): Promise<Fingerprint> {
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded();
  await page.mouse.move(1, 1);
  await settled(target);
  const states: Fingerprint = { rest: await stateOf(target) };
  await hovered(target);
  states.hover = await stateOf(target);
  states.press = await whilePressed(page, target, () => stateOf(target));
  await page.mouse.move(1, 1);
  const focusable = await target.evaluate(
    (element) => element instanceof HTMLElement && element.tabIndex >= 0,
  );
  if (focusable) {
    await page.keyboard.press("Shift");
    await target.focus();
    await settled(target);
    states.focus = await stateOf(target);
    await target.blur();
  }
  return states;
}

test("TK8.2: the states of the landing's calls to action and of a card are those of the parent of RK-1", async ({
  page,
}) => {
  const actual: Record<string, Fingerprint> = {};
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: HEIGHT });
    await open(page, "/fr");
    for (const [name, selector] of Object.entries(STATE_ELEMENTS)) {
      actual[`fr@${width} ${name}`] = await statesOf(page, selector);
    }
  }
  if (recording()) {
    writeFileSync(STATES_FIXTURE, `${JSON.stringify(actual, null, 2)}\n`);
    return;
  }
  expect(
    existsSync(STATES_FIXTURE),
    `${STATES_FIXTURE} is missing: record it with pnpm --filter @influx/web e2e:record-vitrine`,
  ).toBe(true);
  const fixture = JSON.parse(readFileSync(STATES_FIXTURE, "utf8")) as Record<
    string,
    Fingerprint
  >;
  expect(Object.keys(actual)).toEqual(Object.keys(fixture));
  for (const [name, states] of Object.entries(actual)) {
    expect(fingerprintDifferences(fixture[name] ?? {}, states), name).toEqual(
      [],
    );
  }
});

test("TK3.4: /fr and /en keep the body unsmoothed (auto), the KEO smoothing never reaching the vitrine", async ({
  page,
}) => {
  for (const locale of LOCALES) {
    await open(page, `/${locale}`);
    expect(
      await computed(page.locator("body"), "-webkit-font-smoothing"),
      locale,
    ).toBe("auto");
  }
});
