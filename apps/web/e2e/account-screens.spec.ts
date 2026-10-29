// The homes and the "mon compte" screens in the KEO theme (DS-8; docs/mvp/18 §12.2, §12.3; 17 §2.4,
// §6.1 to §6.4): axe at the widths of the matrix (four on "mes données", the longest page; two on
// the others; the two homes and one account screen again in English), a single `h1` per page, and
// no horizontal scroll at 320 px. A member seeded in the local stack (no code, no mail). The logic
// and the texts are those of account.spec and account-data.spec, which stay unchanged.
import enAccount from "@/locales/en/account.json" with { type: "json" };
import frAccount from "@/locales/fr/account.json" with { type: "json" };
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { AUTH_LABELS, expect, open, test, title } from "./support/journey";

type Locale = "fr" | "en";

const ACCOUNT = { fr: frAccount, en: enAccount } as const;

const HOMES = [
  { locale: "fr", role: "advertiser", path: "/fr/marque", widths: [375, 1440] },
  {
    locale: "fr",
    role: "creator",
    path: "/fr/createur",
    widths: [375, 768, 1024, 1440],
  },
  { locale: "en", role: "advertiser", path: "/en/brand", widths: [375, 1440] },
  { locale: "en", role: "creator", path: "/en/creator", widths: [375, 1440] },
] as const;

const SCREENS = [
  { locale: "fr", path: "/fr/compte", key: "details", widths: [375, 1440] },
  {
    locale: "fr",
    path: "/fr/compte/preferences",
    key: "preferences",
    widths: [375, 1440],
  },
  {
    locale: "fr",
    path: "/fr/compte/sessions",
    key: "sessions",
    widths: [375, 1440],
  },
  {
    locale: "fr",
    path: "/fr/compte/donnees",
    key: "data",
    widths: [375, 768, 1024, 1440],
  },
  {
    locale: "en",
    path: "/en/account/preferences",
    key: "preferences",
    widths: [375, 1440],
  },
] as const;

async function expectNoSideScroll320(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 320, height: 640 });
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function seed(
  page: import("@playwright/test").Page,
  locale: Locale,
  role: "advertiser" | "creator",
  acceptTerms: boolean,
) {
  await seedMember(page, {
    role,
    language: locale,
    acceptTerms,
    sessions: ["chrome.windows", "firefox.macos"],
  });
}

for (const { locale, role, path, widths } of HOMES) {
  test(`axe finds nothing on the ${role} home in ${locale}, with one h1 and no side scroll`, async ({
    page,
  }) => {
    await seed(page, locale, role, true);
    await open(page, path);
    await expect(title(page)).toHaveText(AUTH_LABELS[locale].home[role].title);
    await expect(page.locator("h1")).toHaveCount(1);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoAxeViolation(page, `accueil ${role} ${locale} à ${width}`);
    }
    await expectNoSideScroll320(page);
  });
}

test("axe finds nothing on a home whose terms wait", async ({ page }) => {
  await seed(page, "fr", "advertiser", false);
  await open(page, "/fr/marque");
  await expect(page.locator("h1")).toHaveCount(1);
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoAxeViolation(page, `accueil, CGU en attente à ${width}`);
  }
});

for (const { locale, path, key, widths } of SCREENS) {
  test(`axe finds nothing on "${key}" in ${locale}, with one h1 and no side scroll`, async ({
    page,
  }) => {
    await seed(page, locale, "creator", true);
    await open(page, path);
    await expect(title(page)).toHaveText(ACCOUNT[locale][key].title);
    await expect(page.locator("h1")).toHaveCount(1);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoAxeViolation(page, `${key} ${locale} à ${width}`);
    }
    await expectNoSideScroll320(page);
  });
}
