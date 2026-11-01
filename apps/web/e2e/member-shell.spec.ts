// The member shell in a real browser (DS-6; docs/mvp/18 §12.1 TD5.1 to TD5.8, §12.2; 17 §2.2,
// §2.3, §2.5; 02 §21.5): one main navigation, a bar at the bottom below lg and a column on the left
// from lg (the threshold read in tokens.css), nothing under the bar, the keyboard order and the
// focus, the session and the terms read again at each client navigation, reduced motion, the role
// colors written, and axe at four widths. A member seeded in the local stack (no code, no mail).
// "Compte supprimé" without navigation (TD5.6 c) is the journey of account-data.spec.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { effectiveTokens } from "@influx/test-kit/guards";
import enAccount from "@/locales/en/account.json" with { type: "json" };
import enMember from "@/locales/en/member.json" with { type: "json" };
import frAccount from "@/locales/fr/account.json" with { type: "json" };
import frMember from "@/locales/fr/member.json" with { type: "json" };
import { revokeSessions, seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { focusedElement } from "./support/focus";
import { AUTH_LABELS, expect, open, test, title } from "./support/journey";

type Locale = "fr" | "en";
type Role = "advertiser" | "creator";

const MEMBER = { fr: frMember.shell, en: enMember.shell } as const;
const ACCOUNT = { fr: frAccount, en: enAccount } as const;
const HOME_PATHS = {
  fr: { advertiser: "/fr/marque", creator: "/fr/createur" },
  en: { advertiser: "/en/brand", creator: "/en/creator" },
} as const;

/** The lg breakpoint of tokens.css: the bar below it, the column from it (02 §21.5 point 3). */
const LG = parseInt(
  effectiveTokens(
    readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "..",
        "..",
        "packages",
        "ui",
        "src",
        "styles",
        "tokens.css",
      ),
      "utf8",
    ),
    "keo",
  ).get("--breakpoint-lg") ?? "",
  10,
);

/** A member of `role` on the home of their space, the frame drawn. */
async function openHome(
  page: Page,
  locale: Locale,
  role: Role,
): Promise<{ accountId: string }> {
  const member = await seedMember(page, {
    role,
    language: locale,
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await open(page, HOME_PATHS[locale][role]);
  await expect(title(page)).toHaveText(AUTH_LABELS[locale].home[role].title);
  return member;
}

function mainNavigation(page: Page, locale: Locale) {
  return page.getByRole("navigation", {
    name: MEMBER[locale].nav.label,
    exact: true,
  });
}

/** Every landmark exposed, as "role: name" (a header or footer inside a section is none). */
function landmarks(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const implicit: Record<string, string> = {
      NAV: "navigation",
      MAIN: "main",
      ASIDE: "complementary",
      HEADER: "banner",
      FOOTER: "contentinfo",
    };
    const sectioning = "article, aside, main, nav, section";
    return [
      ...document.querySelectorAll("nav, main, aside, header, footer, [role]"),
    ]
      .filter((element) => element.getClientRects().length > 0)
      .flatMap((element) => {
        const role = element.getAttribute("role") ?? implicit[element.tagName];
        if (role === undefined) return [];
        if (
          (role === "banner" || role === "contentinfo") &&
          element.getAttribute("role") === null &&
          element.parentElement?.closest(sectioning) !== null
        ) {
          return [];
        }
        if (
          ![
            "navigation",
            "main",
            "complementary",
            "banner",
            "contentinfo",
            "region",
            "search",
            "form",
          ].includes(role)
        ) {
          return [];
        }
        const labelledBy = element.getAttribute("aria-labelledby");
        const name =
          element.getAttribute("aria-label") ??
          (labelledBy === null
            ? ""
            : (document.getElementById(labelledBy)?.textContent ?? ""));
        return [`${role}: ${name.trim()}`];
      });
  });
}

/** TD5.1: one main navigation, alone of its kind in the DOM, one current entry, names apart. */
async function expectOneMainNavigation(
  page: Page,
  locale: Locale,
  width: number,
): Promise<void> {
  await page.setViewportSize({ width, height: 900 });
  await expect(mainNavigation(page, locale), `${width} px`).toHaveCount(1);
  await expect(page.getByRole("navigation"), `${width} px`).toHaveCount(1);
  await expect(page.locator("nav"), `${width} px`).toHaveCount(1);
  await expect(
    page.locator('[aria-current="page"]'),
    `${width} px`,
  ).toHaveCount(1);
  const found = await landmarks(page);
  expect(found, `${width} px`).toContain(
    `navigation: ${MEMBER[locale].nav.label}`,
  );
  expect(new Set(found).size, `${width} px: ${found.join(" | ")}`).toBe(
    found.length,
  );
}

test("TD5.1: one main navigation, one current entry and landmarks named apart, from 375 to 1440 px", async ({
  page,
}) => {
  expect(LG).toBe(1024);
  await openHome(page, "fr", "creator");
  for (const width of [375, 768, LG - 1, LG, 1440]) {
    await expectOneMainNavigation(page, "fr", width);
  }
});

test("TD5.1: in English, « Main navigation », at 375 and 1440 px", async ({
  page,
}) => {
  await openHome(page, "en", "advertiser");
  for (const width of [375, 1440]) {
    await expectOneMainNavigation(page, "en", width);
  }
});

test("TD5.2: the bar at the bottom at lg − 1, the column on the left at lg, nothing under the bar", async ({
  page,
}) => {
  await openHome(page, "fr", "creator");
  const nav = mainNavigation(page, "fr");

  await page.setViewportSize({ width: LG - 1, height: 800 });
  const bar = await nav.boundingBox();
  expect(bar).not.toBeNull();
  expect(bar?.x).toBe(0);
  expect(bar?.width).toBe(LG - 1);
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeCloseTo(800, 0);

  await page.setViewportSize({ width: LG, height: 800 });
  const list = await nav.boundingBox();
  const column = await nav.locator("..").boundingBox();
  const main = await page.locator("main").boundingBox();
  expect(column).toMatchObject({ x: 0, y: 0, height: 800 });
  expect(list?.x).toBe(0);
  expect((list?.x ?? 0) + (list?.width ?? 0)).toBeLessThanOrEqual(main?.x ?? 0);
  // The column stays in place while the content scrolls.
  await page.mouse.wheel(0, 600);
  expect((await nav.locator("..").boundingBox())?.y).toBe(0);

  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 600 });
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const lowest = await page.locator("main").evaluate((element) =>
      Math.max(
        ...[...element.querySelectorAll("*")]
          .map((child) => child.getBoundingClientRect())
          .filter((box) => box.height > 0)
          .map((box) => box.bottom),
      ),
    );
    const barTop = (await nav.boundingBox())?.y ?? 0;
    expect(lowest, `${width} px`).toBeLessThanOrEqual(barTop);
  }
});

/** Where the focus is: the skip link, the header, the navigation, the foot of the column, the content. */
function focusRegion(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement;
    if (element === null || element === document.body) return "page";
    if (element.matches('a[href="#main"]')) return "skip";
    if (element.closest("main") !== null) return "content";
    if (element.closest("nav") !== null) return "navigation";
    if (element.closest("header") !== null) return "header";
    return "column";
  });
}

/** The regions met by successive Tabs, each once, until the content is reached. */
async function tabOrder(page: Page): Promise<string[]> {
  const order: string[] = [];
  for (let press = 0; press < 20; press += 1) {
    await page.keyboard.press("Tab");
    const region = await focusRegion(page);
    if (order.at(-1) !== region) order.push(region);
    if (region === "content") break;
  }
  return order;
}

for (const [width, expected] of [
  [375, ["skip", "header", "navigation", "content"]],
  [1440, ["skip", "header", "navigation", "column", "content"]],
] as const) {
  test(`TD5.3: the skip link first, then header, navigation and content, Shift+Tab back, at ${width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await openHome(page, "fr", "creator");

    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: MEMBER.fr.skipToContent });
    await expect(skip).toBeFocused();
    expect((await skip.boundingBox())?.width ?? 0).toBeGreaterThan(10);
    await page.keyboard.press("Enter");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("main") !== null,
      ),
    ).toBe(true);

    await page.reload();
    await expect(title(page)).toHaveText(AUTH_LABELS.fr.home.creator.title);
    expect(await tabOrder(page)).toEqual(expected);
    await page.keyboard.press("Shift+Tab");
    expect(await focusRegion(page)).toBe(expected.at(-2));
  });
}

test("TD5.4: every focusable element shows a ring of 2 px at least, never hidden by the header or the bar, at 375 and 1440 px", async ({
  page,
}) => {
  await openHome(page, "fr", "creator");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 640 });
    await page.reload();
    await expect(title(page)).toHaveText(AUTH_LABELS.fr.home.creator.title);
    const seen: string[] = [];
    for (let press = 0; press < 25; press += 1) {
      await page.keyboard.press("Tab");
      const focus = await focusedElement(page);
      if (focus === null || seen.includes(focus.description)) break;
      seen.push(focus.description);
      const where = `${width} px, ${focus.description}`;
      expect(focus.outlineStyle, where).not.toBe("none");
      expect(focus.outlineWidth, where).toBeGreaterThanOrEqual(2);
      expect(focus.covered, `${where} is covered`).toBe(false);
    }
    // The skip link, the shell's links and the home's own actions at least.
    expect(seen.length, `${width} px`).toBeGreaterThanOrEqual(6);
  }
});

test("TD5.5: after a navigation through the shell, the focus is on the h1", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openHome(page, "fr", "creator");
  const nav = mainNavigation(page, "fr");

  await nav
    .getByRole("link", { name: MEMBER.fr.nav.entries.account, exact: true })
    .click();
  await expect(title(page)).toHaveText(ACCOUNT.fr.hub.title);
  await expect(title(page)).toBeFocused();
  await expect(
    nav.getByRole("link", { name: MEMBER.fr.nav.entries.account }),
  ).toHaveAttribute("aria-current", "page");

  await nav
    .getByRole("link", { name: MEMBER.fr.nav.entries.home, exact: true })
    .click();
  await expect(title(page)).toHaveText(AUTH_LABELS.fr.home.creator.title);
  await expect(title(page)).toBeFocused();
});

/** A mark in the window: still there after a click, the page was not reloaded. */
async function markWindow(page: Page): Promise<() => Promise<boolean>> {
  await page.evaluate(() => {
    (window as unknown as { shellMark?: boolean }).shellMark = true;
  });
  return () =>
    page.evaluate(
      () => (window as unknown as { shellMark?: boolean }).shellMark === true,
    );
}

test("TD5.6 a: terms published during the session block the next page, without a reload (05 RG28)", async ({
  page,
}) => {
  await openHome(page, "fr", "creator");
  const stillLoaded = await markWindow(page);
  // A new version comes into force: GET /v1/me now names it (one account only, so that the other
  // journeys keep their terms; the screen then reads the text in force from apps/api).
  await page.route("**/api/v1/me", async (route) => {
    const response = await route.fetch();
    const me = (await response.json()) as Record<string, unknown>;
    await route.fulfill({
      response,
      json: {
        ...me,
        termsToAccept: {
          versionId: "00000000-0000-4000-8000-000000000e2e",
          versionLabel: "E2E",
          locale: "fr",
          effectiveFrom: new Date().toISOString(),
        },
      },
    });
  });

  await mainNavigation(page, "fr")
    .getByRole("link", { name: MEMBER.fr.nav.entries.account, exact: true })
    .click();
  // The page-menu is exempted (sn-fiche): the next page that is not shows the screen.
  await page
    .getByRole("main")
    .getByRole("link", { name: ACCOUNT.fr.nav.accountDetails, exact: true })
    .click();
  await expect(title(page)).toHaveText(ACCOUNT.fr.terms.title);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  expect(await stillLoaded()).toBe(true);
  // A read of the session may still be in flight: the test ends without it.
  await page.unrouteAll({ behavior: "ignoreErrors" });
});

test("TD5.6 b: a session closed elsewhere leads to sign-in at the next click", async ({
  page,
}) => {
  const member = await openHome(page, "fr", "creator");
  const stillLoaded = await markWindow(page);
  await revokeSessions(member.accountId);

  await mainNavigation(page, "fr")
    .getByRole("link", { name: MEMBER.fr.nav.entries.account, exact: true })
    .click();
  await expect(page).toHaveURL(/\/fr\/connexion$/);
  expect(await stillLoaded()).toBe(true);
});

test("TD5.6 c: « Se déconnecter » in the column ends on a page without navigation, its h1 focused", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page, "fr", "advertiser");
  await page
    .getByRole("button", { name: MEMBER.fr.footer.signOut, exact: true })
    .click();
  await expect(title(page)).toHaveText(ACCOUNT.fr.signedOut.title);
  await expect(title(page)).toBeFocused();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("17 §2.5: a page of the other space sends to the member's own home", async ({
  page,
}) => {
  await openHome(page, "fr", "creator");
  await open(page, "/fr/marque");
  await expect(page).toHaveURL(/\/fr\/createur$/);
  await expect(title(page)).toHaveText(AUTH_LABELS.fr.home.creator.title);
});

test("TD5.7: reduced motion: no transition, no endless animation, no transform on hover", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openHome(page, "fr", "creator");
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = page.locator("a, button").filter({ visible: true });
    let checked = 0;
    for (const control of await controls.all()) {
      const inShell = await control.evaluate(
        (element) =>
          element.closest("main") === null &&
          element.getBoundingClientRect().width > 2,
      );
      if (!inShell) continue;
      await control.hover();
      const style = await control.evaluate((element) => {
        const computed = getComputedStyle(element);
        return {
          durations: computed.transitionDuration
            .split(",")
            .map((value) => parseFloat(value)),
          transform: computed.transform,
          scale: computed.scale,
          translate: computed.translate,
        };
      });
      const where = `${width} px, ${await control.textContent()}`;
      expect(
        style.durations.every((value) => value === 0),
        where,
      ).toBe(true);
      expect([style.transform, style.scale, style.translate], where).toEqual([
        "none",
        "none",
        "none",
      ]);
      checked += 1;
    }
    expect(checked, `${width} px`).toBeGreaterThanOrEqual(3);
    const endless = await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations === Infinity,
          ).length,
    );
    expect(endless, `${width} px`).toBe(0);
  }
});

test("TD5.8: a role color always beside the role written; the current entry heavier than the others", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page, "fr", "creator");
  const probe = await page
    .locator('[data-theme="keo"]')
    .evaluate((container, labels) => {
      const span = document.createElement("span");
      container.append(span);
      const colorOf = (value: string) => {
        span.style.color = value;
        return getComputedStyle(span).color;
      };
      const roleColors = [
        colorOf("var(--color-role-advertiser)"),
        colorOf("var(--color-role-creator)"),
      ];
      span.remove();
      const painted = [...container.querySelectorAll("*")].filter((element) => {
        if (element.getClientRects().length === 0) return false;
        const style = getComputedStyle(element);
        const borders =
          parseFloat(style.borderTopWidth) > 0 ||
          parseFloat(style.borderLeftWidth) > 0;
        return [
          style.color,
          style.backgroundColor,
          ...(borders ? [style.borderTopColor, style.borderLeftColor] : []),
        ].some((color) => roleColors.includes(color));
      });
      return {
        painted: painted.length,
        unwritten: painted
          .filter(
            (element) =>
              !labels.some((label) =>
                (element.parentElement?.textContent ?? "").includes(label),
              ),
          )
          .map((element) => element.outerHTML.slice(0, 80)),
      };
    }, Object.values(MEMBER.fr.space));
  expect(probe.painted).toBeGreaterThan(0);
  expect(probe.unwritten).toEqual([]);

  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const weights = await mainNavigation(page, "fr")
      .getByRole("link")
      .evaluateAll((links) =>
        links.map((link) => ({
          current: link.getAttribute("aria-current") === "page",
          weight: Number(getComputedStyle(link).fontWeight),
        })),
      );
    const current = weights.filter((link) => link.current);
    const others = weights.filter((link) => !link.current);
    expect(current, `${width} px`).toHaveLength(1);
    expect(others.length, `${width} px`).toBeGreaterThan(0);
    for (const other of others) {
      expect(current[0]?.weight ?? 0, `${width} px`).toBeGreaterThan(
        other.weight,
      );
    }
  }
});

/** The four pages of "mon compte", in the order of the column and of the page-menu (D74). */
const ACCOUNT_SUB_PAGES = [
  { key: "accountDetails", screen: "details" },
  { key: "accountPreferences", screen: "preferences" },
  { key: "accountSessions", screen: "sessions" },
  { key: "accountData", screen: "data" },
] as const;

/** « ‹ Mon compte » above the h1, read « Retour à Mon compte » (sn-fiche Microcopies). */
function backToHub(page: Page, locale: Locale) {
  const hub = ACCOUNT[locale].hub;
  return page
    .getByRole("main")
    .getByRole("link", { name: `${hub.backPrefix} ${hub.back}`, exact: true });
}

test("TN6: at 1440 px, the four sub-entries under Compte on mes données, the current one marked; none on the home", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openHome(page, "fr", "advertiser");
  const nav = mainNavigation(page, "fr");
  await expect(nav.locator("ul ul")).toHaveCount(0);

  await open(page, "/fr/compte/donnees");
  await expect(title(page)).toHaveText(ACCOUNT.fr.data.title);
  const account = nav.getByRole("listitem").filter({
    has: page.getByRole("link", {
      name: MEMBER.fr.nav.entries.account,
      exact: true,
    }),
  });
  await expect(account.locator("ul a")).toHaveText(
    ACCOUNT_SUB_PAGES.map(({ key }) => ACCOUNT.fr.nav[key]),
  );
  await expect(account.locator("ul a").first()).toBeVisible();
  await expect(nav.locator('[aria-current="page"]')).toHaveText(
    ACCOUNT.fr.nav.accountData,
  );
  await expect(
    nav.getByRole("link", { name: MEMBER.fr.nav.entries.account, exact: true }),
  ).not.toHaveAttribute("aria-current");
  await expect(backToHub(page, "fr")).toBeVisible();

  // The page-menu: the rubric is the current item, its sub-menu open, no sub-entry current.
  await nav
    .getByRole("link", { name: MEMBER.fr.nav.entries.account, exact: true })
    .click();
  await expect(title(page)).toHaveText(ACCOUNT.fr.hub.title);
  await expect(account.locator("ul a")).toHaveCount(ACCOUNT_SUB_PAGES.length);
  await expect(nav.locator('[aria-current="page"]')).toHaveText(
    MEMBER.fr.nav.entries.account,
  );
  await expect(backToHub(page, "fr")).toHaveCount(0);

  await nav
    .getByRole("link", { name: MEMBER.fr.nav.entries.home, exact: true })
    .click();
  await expect(title(page)).toHaveText(AUTH_LABELS.fr.home.advertiser.title);
  await expect(nav.locator("ul ul")).toHaveCount(0);
});

for (const width of [375, 768]) {
  test(`TN6: at ${width} px, a bar without sub-entries, Compte to the page-menu, each sub-page back to it`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 812 });
    await openHome(page, "fr", "creator");
    const nav = mainNavigation(page, "fr");
    const visibleLinks = () =>
      nav
        .getByRole("link")
        .evaluateAll(
          (links) =>
            links.filter((link) => link.getClientRects().length > 0).length,
        );

    await nav
      .getByRole("link", { name: MEMBER.fr.nav.entries.account, exact: true })
      .click();
    await expect(title(page)).toHaveText(ACCOUNT.fr.hub.title);
    await expect(title(page)).toBeFocused();
    expect(await visibleLinks()).toBe(2);
    await expect(page.getByRole("main").getByRole("listitem")).toHaveCount(
      ACCOUNT_SUB_PAGES.length,
    );

    for (const { key, screen } of ACCOUNT_SUB_PAGES) {
      await page
        .getByRole("main")
        .getByRole("link", { name: ACCOUNT.fr.nav[key], exact: true })
        .click();
      await expect(title(page), key).toHaveText(ACCOUNT.fr[screen].title);
      await expect(title(page), key).toBeFocused();
      expect(await visibleLinks(), key).toBe(2);
      await expect(
        nav.getByRole("link", {
          name: MEMBER.fr.nav.entries.account,
          exact: true,
        }),
      ).toBeVisible();
      await expect(backToHub(page, "fr")).toBeVisible();
      await backToHub(page, "fr").click();
      await expect(title(page), key).toHaveText(ACCOUNT.fr.hub.title);
      await expect(title(page), key).toBeFocused();
    }
  });
}

test("TN6: one navigation landmark and one aria-current on the page-menu and a sub-page, at 375, 768, 1024 and 1440 px", async ({
  page,
}) => {
  await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  for (const path of ["/fr/compte", "/fr/compte/donnees"]) {
    await open(page, path);
    await expect(title(page)).toBeVisible();
    for (const width of [375, 768, 1024, 1440]) {
      await expectOneMainNavigation(page, "fr", width);
    }
  }
});

test("axe finds nothing on the creator home at 375, 768, 1024 and 1440 px (WCAG 2.2 AA)", async ({
  page,
}) => {
  await openHome(page, "fr", "creator");
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoAxeViolation(page, `accueil créateur à ${width} px`, {
      wcag22: true,
    });
  }
});
