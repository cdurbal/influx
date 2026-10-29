// DS-11 (docs/mvp/17b §3.14, 18 §12.2): the standalone screens of the backoffice in the KEO charter,
// without a rail: sign-in (default, empty submit, recovery code), the first step of the activation,
// its dead link, the 404 and the signed-out screen. axe-core, WCAG 2.2 AA, at 375, 768 and 1440 px;
// the focus on the h1 on arrival, a visible ring on the first field, no navigation, no horizontal
// scroll. The logic of the factors is apps/api's (J3 tests) and backoffice.spec's, untouched.
// Only an agent is seeded here: the file never touches the dual control of backoffice.spec.
import type { Page } from "@playwright/test";
import { messages } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import { seedInternal } from "./support/backoffice";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";

const m = messages;
const WIDTHS = [375, 768, 1440];
/** A token of the shape of an activation link (43 base64url characters); the API is not called. */
const LINK_TOKEN = "A".repeat(43);

function bo(path: string): string {
  return `${BACKOFFICE_ORIGIN}${path}`;
}

async function expectStandalone(page: Page, title: string): Promise<void> {
  const h1 = page.getByRole("heading", { level: 1, name: title });
  await expect(h1).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function axeAtEachWidth(page: Page, screen: string): Promise<void> {
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoAxeViolation(page, `${screen} à ${String(width)} px`, {
      wcag22: true,
    });
  }
}

test("DS-11: the sign-in is a standalone page; default, empty and recovery states pass axe at 375, 768 and 1440 px", async ({
  page,
}) => {
  await page.goto(bo("/"));
  await expectStandalone(page, m.login.title);
  await expect(
    page.getByRole("heading", { level: 1, name: m.login.title }),
  ).toBeFocused();
  await axeAtEachWidth(page, "connexion");

  await page.getByRole("button", { name: m.login.submit }).click();
  await expect(page.getByText(m.form.required).first()).toBeVisible();
  await axeAtEachWidth(page, "connexion, soumission vide");

  await page.getByRole("button", { name: m.login.useRecoveryCode }).click();
  await expect(page.getByLabel(m.login.recoveryLabel)).toBeVisible();
  await axeAtEachWidth(page, "connexion, code de secours");
});

test("DS-11: the focus ring is visible on the first field and on the primary button", async ({
  page,
}) => {
  await page.goto(bo("/"));
  await page.keyboard.press("Tab");
  const email = page.getByLabel(m.login.emailLabel);
  await expect(email).toBeFocused();
  for (const target of [
    email,
    page.getByRole("button", { name: m.login.submit }),
  ]) {
    await target.focus();
    const outline = await target.evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        style: style.outlineStyle,
        width: parseFloat(style.outlineWidth),
      };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
  }
});

test("DS-11: the activation, its first step and its dead link, pass axe at 375, 768 and 1440 px", async ({
  page,
}) => {
  await page.goto(bo(`/activation#${LINK_TOKEN}`));
  await expectStandalone(page, m.enroll.title);
  await expect(page.getByText(m.enroll.step(1))).toBeVisible();
  await axeAtEachWidth(page, "activation, étape 1");

  await page.goto(bo("/activation"));
  await expect(page.getByText(m.enroll.invitationInvalid)).toBeVisible();
  await expectStandalone(page, m.enroll.title);
  await axeAtEachWidth(page, "activation, lien invalide");
});

test("DS-11: the 404 is a standalone page that passes axe at 375, 768 and 1440 px", async ({
  page,
}) => {
  const response = await page.goto(bo("/introuvable-ds11"));
  expect(response?.status()).toBe(404);
  await expectStandalone(page, m.errorPages.notFoundTitle);
  await axeAtEachWidth(page, "404");
});

test("DS-11: the signed-out screen is a standalone page, its h1 focused, and passes axe at 375, 768 and 1440 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedInternal(page, "agent", "Jade");
  await page.goto(bo("/accueil"));
  await page.getByRole("button", { name: m.shell.signOut }).click();
  await expectStandalone(page, m.logout.done);
  await expect(
    page.getByRole("heading", { level: 1, name: m.logout.done }),
  ).toBeFocused();
  await axeAtEachWidth(page, "déconnecté");
});
