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
