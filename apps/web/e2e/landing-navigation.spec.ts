// The landing's own navigation in a real browser (L2A-06; SNT-3; fix 40e1559 and feat 5e49da1):
// every entry of the header menu (a bar at 1440 px, the opened menu at 375 px) and of the footer
// menu leads to its section, the mobile menu closing on the way; and the brand of the legal pages,
// of the page not found and of the terms barrier leads back to the landing of its language. One
// case per language, the widths and the pages in loops inside the case. The two error screens
// (error.tsx, global-error.tsx) cannot be reached by a journey: tests/brand-links.test.ts.
// Labels are the locale files themselves, anchors the constant the sections are built from.
import type { Page } from "@playwright/test";
import {
  LANDING_NAV_IDS,
  LANDING_SECTION_ANCHORS,
} from "@/components/landing/landing-sections";
import { legalDocumentPath } from "@/lib/legal-documents";
import enLanding from "@/locales/en/landing.json" with { type: "json" };
import frLanding from "@/locales/fr/landing.json" with { type: "json" };
import { seedMember } from "./support/account";
import { expect, open, test, title, type Locale } from "./support/journey";

const LANDING = { fr: frLanding, en: enLanding } as const;
const LOCALES: readonly Locale[] = ["fr", "en"];
const WIDTHS = [1440, 375] as const;
const HEIGHT = 900;
const BRAND = "INFLUX";

/** Back to the top with no fragment: the next entry starts from a page that has not moved. */
async function backToTop(page: Page): Promise<void> {
  await page.evaluate(() => {
    history.replaceState(null, "", location.pathname);
    window.scrollTo(0, 0);
  });
}

/**
 * The address ends with the section's fragment and the section starts on screen: the page scrolled
 * to it, and not past it. Waits on animation frames, not on the 100 ms steps of expect.poll.
 */
async function expectReached(page: Page, anchor: string): Promise<void> {
  await page.waitForFunction(
    (id) => {
      const top = document.getElementById(id)?.getBoundingClientRect().top;
      return (
        location.hash === `#${id}` &&
        top !== undefined &&
        top >= -1 &&
        top < window.innerHeight
      );
    },
    anchor,
    { polling: "raf" },
  );
}

for (const locale of LOCALES) {
  test(`/${locale}: every entry of the header and footer menus leads to its section, at 1440 and 375 px (SNT-3)`, async ({
    page,
  }) => {
    const { header, footer } = LANDING[locale];
    // One load: the two layouts are one page, a media query apart.
    await open(page, `/${locale}`);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: HEIGHT });
      const toggle = page.getByRole("button", { name: header.menuButton });
      const headerNav = page.getByRole("navigation", { name: header.navLabel });
      const footerNav = page.getByRole("navigation", { name: footer.navLabel });

      // The mobile menu starts closed: its entries are out of the accessibility tree.
      if (width === 375) {
        await expect(headerNav).toHaveCount(0);
      }

      for (const id of LANDING_NAV_IDS) {
        const anchor = LANDING_SECTION_ANCHORS[id];
        const label = header.nav[id];
        const where = `${locale}@${width} ${id}`;

        // The header: the bar at 1440 px, the opened menu below breakpoint lg (375 px).
        await backToTop(page);
        if (width === 375) {
          await toggle.click();
        }
        await headerNav.getByRole("link", { name: label, exact: true }).click();
        await expectReached(page, anchor);
        if (width === 375) {
          await expect(toggle, where).toHaveAttribute("aria-expanded", "false");
        }

        // The footer (the click scrolls the link into view first).
        await backToTop(page);
        await footerNav.getByRole("link", { name: label, exact: true }).click();
        await expectReached(page, anchor);
      }
    }
  });
}

for (const locale of LOCALES) {
  test(`/${locale}: the brand of a legal page, of the page not found and of the terms barrier leads to the landing`, async ({
    page,
  }) => {
    const landing = new RegExp(`/${locale}$`);
    const pages: readonly { name: string; show: () => Promise<void> }[] = [
      {
        name: "legal page",
        show: () => open(page, legalDocumentPath("terms_of_service", locale)),
      },
      { name: "page not found", show: () => open(page, `/${locale}/absente`) },
      {
        name: "terms barrier",
        show: async () => {
          await seedMember(page, {
            role: "creator",
            language: locale,
            acceptTerms: false,
            sessions: ["chrome.windows"],
          });
          await open(page, locale === "fr" ? "/fr/createur" : "/en/creator");
          await expect(title(page)).toBeVisible();
        },
      },
    ];
    for (const { name, show } of pages) {
      await show();
      const brand = page.getByRole("link", { name: BRAND, exact: true });
      await expect(brand, name).toHaveAttribute("href", `/${locale}`);
      await brand.click();
      await expect(page, name).toHaveURL(landing);
      await expect(page.locator("#hero-title"), name).toBeVisible();
    }
  });
}
