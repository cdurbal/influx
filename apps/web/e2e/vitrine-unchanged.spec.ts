// The vitrine unchanged by the DS milestone (D59, D73; 18 §12.1 TD4.2 and TD4.3; A-9): the
// computed-style fingerprint of /fr and /en, at 375 and 1440 px, equals the one taken on the parent
// of DS-1, the code before any change of the milestone. G3e freezes the tokens; this sees a shared
// component or globals.css. The fixture is never edited by hand: it is recorded again by
// `pnpm --filter @influx/web e2e:record-vitrine` (this spec with --update-snapshots), and the
// commit that records it says why the landing changed.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOCUMENT_ELEMENTS,
  fingerprintDifferences,
  fingerprintOf,
  type Fingerprint,
} from "./support/computed-styles";
import { expect, open, test, type Locale } from "./support/journey";

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
