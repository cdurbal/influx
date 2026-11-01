// The cascade of the two charters, proven in the browser (D73; 02 §21.3 to §21.5; 18 §12.1 TD3.1,
// TD3.3 to TD3.6, TD4.4): what the guards read in tokens.css, the browser computes. A member page
// carries one KEO container on which every color equals its KEO value (an alias left on its vitrine
// value fails here even when G3c passes); the landing carries none and keeps the vitrine; the KEO
// fonts come from this origin only, on member pages only, `latin` preloaded within the budget.
// Expected values come from the test-kit's reader over the same tokens.css, never from a copy.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { VITRINE_ONLY } from "@influx/test-kit/charter-data";
import {
  effectiveTokens,
  FONT_PRELOAD_CEILING_BYTES,
  FONTS_DIRECTORY,
  tokenScopes,
} from "@influx/test-kit/guards";
import { seedMember } from "./support/account";
import { CHARTER_BOUNDARY, type Charter } from "./support/charter-boundary";
import {
  AUTH_LABELS,
  enterCode,
  expect,
  mailboxAddress,
  open,
  requestCode,
  test,
  title,
} from "./support/journey";
import { BACKOFFICE_ORIGIN, WEB_ORIGIN } from "./support/servers";

const WEB_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
/** packages/ui holds the tokens and the fonts of both fronts (arbitration PL-07). */
const UI_ROOT = path.resolve(WEB_ROOT, "..", "..", "packages", "ui");
const TOKENS = readFileSync(
  path.join(UI_ROOT, "src", "styles", "tokens.css"),
  "utf8",
);
const KEO_CONTAINER = '[data-theme="keo"]';

/** Every color of @theme; under KEO, those VITRINE_ONLY leaves unread (G8) aside. */
const THEME_COLORS = [...tokenScopes(TOKENS).theme.keys()].filter((name) =>
  name.startsWith("--color-"),
);
const KEO_COLORS = THEME_COLORS.filter((name) => !VITRINE_ONLY.includes(name));

/** The font files of the repository, by the SHA-256 of their bytes. */
const FONT_FILES = new Map(
  readdirSync(path.join(UI_ROOT, FONTS_DIRECTORY))
    .filter((name) => name.endsWith(".woff2"))
    .map((name) => [
      createHash("sha256")
        .update(readFileSync(path.join(UI_ROOT, FONTS_DIRECTORY, name)))
        .digest("hex"),
      name,
    ]),
);

const PRELOADED_FONTS = [
  "manrope-latin-wght-normal.woff2",
  "source-sans-3-latin-wght-normal.woff2",
];

/**
 * Each color whose value inside the element differs from the charter's value. The browser
 * computes both sides on a probe, so that a serialization (the compiled CSS writes `#000000b3` for
 * `rgba(0, 0, 0, 0.7)`) is no difference; a probe's style is set through the CSSOM, which the CSP
 * allows.
 */
async function colorDifferences(
  page: Page,
  selector: string,
  names: readonly string[],
  charter: Charter,
): Promise<string[]> {
  const expected = effectiveTokens(TOKENS, charter);
  const pairs = names.map((name) => [name, expected.get(name) ?? ""] as const);
  const differences = await page.locator(selector).evaluate((element, list) => {
    const probe = document.createElement("span");
    (element === document.documentElement ? document.body : element).append(
      probe,
    );
    const computed = (value: string) => {
      probe.style.color = "";
      probe.style.color = value;
      return probe.style.color === "" ? null : getComputedStyle(probe).color;
    };
    const found = list.flatMap(([name, wanted]) => {
      const actual = computed(`var(${name})`);
      const reference = computed(wanted);
      return actual !== null && actual === reference
        ? []
        : [`${name}: ${actual ?? "none"}, expected ${wanted}`];
    });
    probe.remove();
    return found;
  }, pairs);
  return differences.map((difference) => `${difference} (${charter})`);
}

type FontResponse = { file: string; origin: string; bytes: number };

/** The fonts received once the page and its fonts are loaded. */
async function receivedFonts(
  page: Page,
  watch: () => Promise<FontResponse[]>,
): Promise<FontResponse[]> {
  await page.waitForLoadState("load");
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  return watch();
}

/** A watcher whose reading waits for every body of the responses seen so far. */
function fontWatcher(page: Page): () => Promise<FontResponse[]> {
  const seen: Promise<FontResponse>[] = [];
  page.on("response", (response) => {
    if (!new URL(response.url()).pathname.endsWith(".woff2")) return;
    seen.push(
      response.body().then((body) => ({
        file:
          FONT_FILES.get(createHash("sha256").update(body).digest("hex")) ??
          `unknown ${response.url()}`,
        origin: new URL(response.url()).origin,
        bytes: body.length,
      })),
    );
  });
  return () => Promise.all(seen);
}

test.describe("TD3.1: a member page computes the KEO value of every color", () => {
  for (const path of ["/fr/connexion", "/en/sign-in"]) {
    test(`${path}: one KEO container, every --color-* at its KEO value`, async ({
      page,
    }) => {
      await open(page, path);
      await expect(page.locator(KEO_CONTAINER)).toHaveCount(1);
      await expect(page.locator("[data-theme]")).toHaveCount(1);
      expect(
        await colorDifferences(page, KEO_CONTAINER, KEO_COLORS, "keo"),
      ).toEqual([]);
    });
  }

  test("the home with a session: one KEO container, every --color-* at its KEO value", async ({
    page,
  }) => {
    await seedMember(page, {
      role: "creator",
      language: "fr",
      acceptTerms: true,
      sessions: ["chrome.windows"],
    });
    await open(page, "/fr/createur");
    await expect(page.locator(KEO_CONTAINER)).toHaveCount(1);
    expect(
      await colorDifferences(page, KEO_CONTAINER, KEO_COLORS, "keo"),
    ).toEqual([]);
  });
});

test("TD3.2: the backoffice is KEO whole, on <html>, every --color-* at its KEO value", async ({
  page,
}) => {
  await page.goto(`${BACKOFFICE_ORIGIN}/`);
  await expect(page.locator("[data-theme]")).toHaveCount(1);
  await expect(page.locator("html[data-theme='keo']")).toHaveCount(1);
  expect(await colorDifferences(page, "html", KEO_COLORS, "keo")).toEqual([]);
});

for (const locale of ["fr", "en"] as const) {
  test(`TD3.3: /${locale} carries no data-theme and computes the vitrine value of every color`, async ({
    page,
  }) => {
    await open(page, `/${locale}`);
    await expect(page.locator("[data-theme]")).toHaveCount(0);
    expect(
      await colorDifferences(page, "html", THEME_COLORS, "vitrine"),
    ).toEqual([]);
  });
}

test.describe("TD3.4: the KEO fonts, from this origin, on member pages only", () => {
  test("the landing, /fr and /en, downloads and preloads no font", async ({
    page,
  }) => {
    const fonts = fontWatcher(page);
    for (const path of ["/fr", "/en"]) {
      await open(page, path);
      await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(
        0,
      );
      await receivedFonts(page, fonts);
    }
    expect(await fonts()).toEqual([]);
  });

  test("a member page preloads the two latin files, from this origin, within the budget; no latin-ext on French", async ({
    page,
  }) => {
    const fonts = fontWatcher(page);
    await open(page, "/fr/connexion");
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(2);
    const received = await receivedFonts(page, fonts);
    expect(received.map((font) => font.file).sort()).toEqual(PRELOADED_FONTS);
    expect(received.map((font) => font.origin)).toEqual([
      WEB_ORIGIN,
      WEB_ORIGIN,
    ]);
    const bytes = received.reduce((total, font) => total + font.bytes, 0);
    expect(bytes).toBeLessThanOrEqual(FONT_PRELOAD_CEILING_BYTES);
  });

  test("a backoffice page preloads the two latin files, from its own origin, within the budget", async ({
    page,
  }) => {
    const fonts = fontWatcher(page);
    await page.goto(`${BACKOFFICE_ORIGIN}/`);
    await expect(page.locator('link[rel="preload"][as="font"]')).toHaveCount(2);
    const received = await receivedFonts(page, fonts);
    expect(received.map((font) => font.file).sort()).toEqual(PRELOADED_FONTS);
    expect(received.map((font) => font.origin)).toEqual([
      BACKOFFICE_ORIGIN,
      BACKOFFICE_ORIGIN,
    ]);
    const bytes = received.reduce((total, font) => total + font.bytes, 0);
    expect(bytes).toBeLessThanOrEqual(FONT_PRELOAD_CEILING_BYTES);
  });

  // The fallback case of 02 §21.4 point 3, so the expected result is the inverse one: Next 16.3.6
  // gives each file a family of its own, and the metric fallback of `latin` (a local font) draws a
  // `latin-ext` glyph before any second family could. A name such as "Łucja" shows in that
  // fallback, and no `latin-ext` file is ever fetched.
  test("a name in latin-ext (ł) shows in the fallback: latin only, no latin-ext file fetched", async ({
    page,
  }) => {
    const fonts = fontWatcher(page);
    await open(page, "/fr/connexion");
    await receivedFonts(page, fonts);
    const drawn = await page
      .locator(KEO_CONTAINER)
      .evaluate(async (container) => {
        const name = document.createElement("p");
        name.textContent = "Łucja Wróbel";
        container.append(name);
        const width = name.getBoundingClientRect().width;
        await document.fonts.ready;
        return width;
      });
    expect(drawn).toBeGreaterThan(0);
    const received = await receivedFonts(page, fonts);
    expect(received.map((font) => font.file).sort()).toEqual(PRELOADED_FONTS);
  });
});

test("TD3.5: Manrope's tabular figures align, its proportional ones do not", async ({
  page,
}) => {
  await open(page, "/fr/connexion");
  const widths = await page
    .locator(KEO_CONTAINER)
    .evaluate(async (container) => {
      const measure = async (text: string, numeric: string) => {
        const span = document.createElement("span");
        span.textContent = text;
        span.style.fontFamily = "var(--font-display)";
        span.style.fontVariantNumeric = numeric;
        container.append(span);
        // The web family alone: its metric fallback is a local font (Arial) that a Linux runner
        // lacks, and loading the whole list would fail on it.
        const family = getComputedStyle(span).fontFamily.split(",")[0] ?? "";
        await document.fonts.load(`16px ${family}`, text);
        const width = span.getBoundingClientRect().width;
        span.remove();
        return { family, width };
      };
      return {
        tabular: [
          await measure("1111", "tabular-nums"),
          await measure("8888", "tabular-nums"),
        ],
        proportional: [
          await measure("1111", "proportional-nums"),
          await measure("8888", "proportional-nums"),
        ],
      };
    });
  const [one, eight] = widths.tabular;
  expect(one?.family).toMatch(/manrope/i);
  expect(Math.abs((one?.width ?? 0) - (eight?.width ?? -1))).toBeLessThan(0.01);
  // The control: the same figures in proportional width differ, so the font is applied.
  const [narrow, wide] = widths.proportional;
  expect(Math.abs((narrow?.width ?? 0) - (wide?.width ?? 0))).toBeGreaterThan(
    1,
  );
});

test("TD3.6: the terms dialog stays inside the KEO container, over an opaque backdrop", async ({
  page,
}) => {
  const t = AUTH_LABELS.fr;
  const address = mailboxAddress("charter-terms-dialog");
  await open(page, "/fr/inscription/createur");
  await requestCode(page, t, address);
  await enterCode(page, t, address);
  await expect(title(page)).toContainText(t.signup.title.creator);
  await page.getByRole("button", { name: t.signup.terms.read }).click();
  const dialog = page.getByRole("dialog", { name: t.signup.terms.title });
  await expect(dialog).toBeVisible();
  const facts = await dialog.evaluate((element) => ({
    insideKeo: element.closest('[data-theme="keo"]') !== null,
    backdrop: getComputedStyle(element, "::backdrop").backgroundColor,
  }));
  expect(facts.insideKeo).toBe(true);
  expect(facts.backdrop).not.toMatch(/^(transparent|rgba\(0, 0, 0, 0\))$/);
});

test.describe("TD4.4: each page of the boundary carries data-theme or not", () => {
  const groups = [
    ["without a session", undefined],
    ["of an advertiser", "advertiser"],
    ["of a creator", "creator"],
  ] as const;
  for (const [label, role] of groups) {
    test(`the pages ${label}`, async ({ page }) => {
      const pages = CHARTER_BOUNDARY.filter((entry) => entry.session === role);
      expect(pages.length).toBeGreaterThan(0);
      if (role !== undefined) {
        await seedMember(page, {
          role,
          language: "fr",
          acceptTerms: true,
          sessions: ["chrome.windows"],
        });
      }
      for (const entry of pages) {
        await open(page, entry.path);
        await expect(
          page.locator(KEO_CONTAINER),
          `${entry.path} (${entry.charter})`,
        ).toHaveCount(entry.charter === "keo" ? 1 : 0);
        // The KEO container lies under <body>, never on <html> nor <body> (02 §21.3 point 4).
        await expect(
          page.locator("html[data-theme], body[data-theme]"),
        ).toHaveCount(0);
      }
    });
  }
});
