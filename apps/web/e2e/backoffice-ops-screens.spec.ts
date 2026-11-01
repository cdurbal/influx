// DS-12a (docs/mvp/17b §1.7, 18 §12.2, TD6.2, TD6.5): the lists and the record of the backoffice in the
// KEO charter. The list of the sign-ups: axe-core, WCAG 2.2 AA, at 375 (the workstation screen), 768
// (compact navigation), 1024 and 1440 px; the dense table scrolls in its own region, reachable by
// keyboard, the page never sideways; the status written in words. The record and the member
// invitations at 1024 and 1440 px. The logic is backoffice.spec's (J8T-4, CA56 to CA61), untouched.
// Only an agent is seeded: this file never touches the dual control of backoffice.spec.
import type { Page } from "@playwright/test";
import { messages } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import { runTag, seedInternal, seedSignup } from "./support/backoffice";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";

const m = messages;
const ROW_HEIGHT_PX = 36;

function bo(path: string): string {
  return `${BACKOFFICE_ORIGIN}${path}`;
}

function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

test("DS-12a: the list of the sign-ups passes axe at 375, 768, 1024 and 1440 px; a dense table in its own region", async ({
  page,
}) => {
  const tag = runTag("ds12a");
  await seedSignup({
    tag,
    role: "creator",
    countryCode: "BE",
    language: "fr",
    consent: true,
  });
  await seedInternal(page, "agent", "Lou");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(bo("/inscrits"));
  await page.getByLabel(m.accounts.search, { exact: true }).fill(tag);
  await page.getByRole("button", { name: m.accounts.searchSubmit }).click();
  const table = page.getByRole("table", { name: m.accounts.title });
  await expect(table.locator("tbody").getByRole("row")).toHaveCount(1);

  // The rows are 36 px high; the status is written (never a colour alone, TD6.5).
  const row = table.locator("tbody").getByRole("row").first();
  const height = await row.evaluate(
    (node) => node.getBoundingClientRect().height,
  );
  expect(height).toBeGreaterThanOrEqual(ROW_HEIGHT_PX - 1);
  await expect(row).toContainText(m.roles.creator);
  await expect(row).toContainText(m.declaredStatus.individual);

  // The region that holds the table is a landmark that the keyboard reaches.
  const region = page.getByRole("region", { name: m.accounts.title });
  await expect(region).toHaveAttribute("tabindex", "0");
  await region.focus();
  await expect(region).toBeFocused();

  for (const width of [768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(table).toBeVisible();
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolation(page, `inscrits à ${String(width)} px`, {
      wcag22: true,
    });
  }

  // 375 px: the workstation screen, no table, no sideways scroll (17b §1.7).
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: m.shell.workstationOnly.title,
    }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  await expectNoAxeViolation(page, "inscrits à 375 px", { wcag22: true });
});

test("DS-12a: the record of a member and the member invitations pass axe at 1024 and 1440 px", async ({
  page,
}) => {
  const member = await seedSignup({
    tag: runTag("ds12a-record"),
    role: "advertiser",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  await seedInternal(page, "agent", "Noa");

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(bo(`/inscrits/${member}`));
  await expect(page.getByText(m.account.journaled)).toBeVisible();
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolation(page, `fiche d’inscrit à ${String(width)} px`, {
      wcag22: true,
    });
  }

  await page.goto(bo("/invitations"));
  await expect(
    page.getByRole("heading", { level: 1, name: m.invitations.memberTitle }),
  ).toBeVisible();
  await expect(page.getByText(m.common.loading)).toHaveCount(0);
  for (const width of [1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    await expectNoAxeViolation(page, `invitations à ${String(width)} px`, {
      wcag22: true,
    });
  }
});
