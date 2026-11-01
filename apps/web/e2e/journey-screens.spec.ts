// The screens of the sign-in and sign-up journey in the KEO theme (DS-7; docs/mvp/18 §12.2, §12.3):
// axe on the address screens (default and empty submit) at the widths of the matrix, and no
// horizontal scroll at 320 px. Nothing here reaches the mailbox: the code and details screens are
// covered by signup-nominal and journey-resume, which stay unchanged.
import { expectNoAxeViolation } from "./support/axe";
import { AUTH_LABELS, expect, open, test } from "./support/journey";

const T = AUTH_LABELS.fr;

const PAGES = [
  { path: "/fr/connexion", name: "connexion" },
  { path: "/fr/inscription", name: "choix de porte" },
  { path: "/fr/inscription/marque", name: "inscription marque" },
] as const;

for (const { path, name } of PAGES) {
  for (const width of [375, 768, 1440]) {
    test(`axe finds nothing on ${name} at ${width} px, by default and after an empty submit`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, path);
      await expect(page.locator("h1")).toBeVisible();
      await expectNoAxeViolation(page, `${name} à ${width} px`);
      const submit = page.getByRole("button", { name: T.step1.submit });
      if (await submit.count()) {
        await submit.click();
        await expect(page.getByRole("alert").first()).toBeVisible();
        await expectNoAxeViolation(page, `${name} en erreur à ${width} px`);
      }
    });
  }

  test(`${name} does not scroll horizontally at 320 px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page, path);
    await expect(page.locator("h1")).toBeVisible();
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

// L2AU-1 and L2AU-3 (logo test of L2A; 20 §11.7, §11.8; 17 §3.1): screen 1 says the brokered
// model under its h1, the role pill only when the door is known, and its link is underlined and
// aligned to the left. One case per language, the widths in the case.
const SCREEN_1 = {
  fr: { signIn: "/fr/connexion", signup: "/fr/inscription/marque" },
  en: { signIn: "/en/sign-in", signup: "/en/signup/brand" },
} as const;

for (const locale of ["fr", "en"] as const) {
  test(`L2AU-1, L2AU-3: screen 1 in ${locale}, the mediation line, the role pill of a known door, an underlined link, at 375 and 1440 px`, async ({
    page,
  }) => {
    const t = AUTH_LABELS[locale];
    const roleDots = page.locator('[class*="bg-role-"]');
    for (const [path, door] of [
      [SCREEN_1[locale].signIn, null],
      [SCREEN_1[locale].signup, t.step1.role.advertiser],
    ] as const) {
      await open(page, path);
      for (const width of [375, 1440]) {
        const where = `${path} à ${width} px`;
        await page.setViewportSize({ width, height: 900 });
        const heading = page.locator("h1");
        await expect(heading, where).toBeVisible();
        const mediation = page.getByText(t.step1.mediation, { exact: true });
        await expect(mediation, where).toBeVisible();
        const headingBox = await heading.boundingBox();
        const mediationBox = await mediation.boundingBox();
        expect(mediationBox?.y ?? 0, where).toBeGreaterThan(
          (headingBox?.y ?? 0) + (headingBox?.height ?? 0) - 1,
        );
        if (door === null) {
          await expect(roleDots, where).toHaveCount(0);
        } else {
          const pill = page.getByText(door, { exact: true });
          await expect(pill, where).toBeVisible();
          expect((await pill.boundingBox())?.y ?? 0, where).toBeLessThan(
            headingBox?.y ?? 0,
          );
          expect(
            (await roleDots.first().boundingBox())?.width ?? 0,
            where,
          ).toBeGreaterThanOrEqual(12);
        }
        const link = page.getByRole("link", { name: t.privacy.link });
        const style = await link.evaluate((element) => {
          const computed = getComputedStyle(element);
          return {
            decoration: computed.textDecorationLine,
            align: computed.textAlign,
            weight: computed.fontWeight,
          };
        });
        expect(style, where).toEqual({
          decoration: "underline",
          align: "left",
          weight: "600",
        });
        expect((await link.boundingBox())?.x ?? 0, where).toBeCloseTo(
          headingBox?.x ?? 0,
          0,
        );
      }
    }
  });
}
