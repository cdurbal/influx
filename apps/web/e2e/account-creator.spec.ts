// The record of a creator account in the backoffice (docs/mvp/07 RG71, RG4, RG88; 15 RG40; 17b §3.6 blocks 2 to
// 4; jalons/l2g, commit 17), in French only (the backoffice has no English before D36): an agent opens the record
// and reads the networks with their exact figures, their date and their source, the line added since the last
// validation said in words, the rates block that says none was entered (D78), and the portfolio as counts with
// the way to its queue narrowed to the profile. One creator, one seed and one test, to keep the added time short
// (the budget of the line is 2 s). The seed is rows: the record counts, it reads no visual. The texts are the
// locale files', never copies. No amount, rate or price anywhere (D48, D78).
import { messages as bo } from "../../backoffice/src/messages/fr";
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { retireInternals, seedInternal } from "./support/backoffice";
import { seedRecordOfCreator } from "./support/creator-portfolio";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";

test.afterAll(async () => {
  await retireInternals();
});

const C = bo.accountCreator;

test("an agent opens the record of a creator and reads the exact figures of each network with their date and source, the line awaiting validation said in words, the rates block, and the portfolio as counts leading to its queue (07 RG71, RG4, RG88; 17b §3.6)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  const agent = await seedInternal(page, "agent", "Lou");
  await seedRecordOfCreator(accountId, agent.accountId);

  await page.goto(`${BACKOFFICE_ORIGIN}/inscrits/${accountId}`);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: new RegExp(`^${C.networksTitle}`),
    }),
  ).toBeVisible();

  // Block 2: exact figures (never a band), the date of the measure and the source, one row per line
  const table = page.getByRole("region", { name: C.tableLabel, exact: true });
  const rows = table.locator("tbody tr[data-creator-network]");
  await expect(rows).toHaveCount(2);
  const main = rows.nth(0);
  await expect(main).toContainText("Instagram");
  await expect(main).toContainText(C.primary);
  await expect(main).toContainText(/48\s210/);
  await expect(main).toContainText("3,5 %");
  await expect(main).toContainText("21/08/2026");
  await expect(main).toContainText(C.sources.declared ?? "");
  await expect(main).not.toContainText(C.unlisted);
  // the line added since: said in words, and the figures it never had are said, never a zero or a band
  const added = rows.nth(1);
  await expect(added).toContainText("TikTok");
  await expect(added).toContainText(C.unlisted);
  await expect(added).toContainText(/3\s200/);
  await expect(added).toContainText(bo.queueReview.unset);

  // Block 3: no rate was entered (D78)
  await expect(
    page.getByRole("heading", { level: 2, name: C.ratesTitle }),
  ).toBeVisible();
  await expect(page.getByText(C.rates, { exact: true })).toBeVisible();

  // Block 4: counts, and the queue narrowed to the profile
  await expect(
    page.getByText(
      C.portfolioLine(C.portfolioCount(2), C.portfolioPending(1)),
      {
        exact: true,
      },
    ),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: C.openQueue })).toHaveAttribute(
    "href",
    `/files/visuels?account=${accountId}`,
  );
  await expect(page.locator("main img")).toHaveCount(0);
  await expectNoAxeViolation(page, "creator account record, 1 440", {
    wcag22: true,
  });
});
