// Queue 3, « Visuels de portfolio à modérer », in the backoffice (docs/mvp/07 RG77 to RG85, RG93, RG95 to RG97; 15
// RG27 C1 to C8; 17b §2.4 to §2.7; jalons/l2g, commit 16), in French only (the backoffice has no English before
// D36): an agent reads the list (an alias, the kind, the visuals of the profile, no thumbnail) narrowed to one
// profile as the alias of a row narrows it, opens a visual (which takes it in charge), reads it on demand from a `blob:` beside the
// grid of RG79 as written, refuses it with a reason of the grid and sees the sentence the creator will read, then
// approves the second one, the recap first. One creator, two deposited visuals and one test, to keep the added time
// short (the budget of the line is 4 s, F0). The states before the gestures are the API's own door (the deposits);
// the decisions are the screens'. The texts are the locale files', never copies. No amount, rate or price (D78).
import { messages as bo } from "../../backoffice/src/messages/fr";
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import {
  retireInternals,
  seedColleague,
  seedInternal,
} from "./support/backoffice";
import {
  depositVisuals,
  ownCreator,
  portfolioEntriesOf,
} from "./support/creator-portfolio";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";

test.afterAll(async () => {
  await retireInternals();
});

const L = bo.portfolioQueue;
const R = bo.portfolioReview;

test("an agent reads the visuals to moderate, narrows the list to one profile, reads a visual beside the grid of RG79, refuses it with a reason of the grid, then approves the second one, the recap first (07 RG77 to RG79, RG95, RG97; 15 C1 à C8)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await seedColleague("agent", "Alice");
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await ownCreator(accountId, owner.accountId);
  // two deposits at once: the API takes two at a time (D82 (2))
  await Promise.all([depositVisuals(page, 1), depositVisuals(page, 1)]);
  const deposited = await portfolioEntriesOf(accountId);
  expect(deposited.map((entry) => entry.state)).toEqual(["pending", "pending"]);
  await seedInternal(page, "agent", "Lou");

  // The list, narrowed to the profile as the alias of a row narrows it: the chip says so, without an identifier;
  // an alias, the kind, the visuals of the profile; no thumbnail, no caption.
  await page.goto(`${BACKOFFICE_ORIGIN}/files/visuels?account=${accountId}`);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: bo.queue.portfolio_moderation,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: bo.queueList.chipRemove(
        bo.queueList.chip(L.filters.account, L.filters.accountChip),
      ),
    }),
  ).toBeVisible();
  const table = page.getByRole("region", { name: L.tableLabel, exact: true });
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await expect(table.locator("tbody tr").first()).toContainText(
    L.kinds.deposit ?? "",
  );
  await expect(table.locator("tbody tr").first()).toContainText(
    L.visualCount(2),
  );
  await expect(table.locator("img")).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: bo.queueList.countersTitle }),
  ).toContainText(/en attente/);
  const aliasLink = table
    .getByRole("link", { name: /Ne voir que les visuels de/ })
    .first();
  await expect(aliasLink).toHaveAttribute(
    "href",
    `/files/visuels?account=${accountId}`,
  );
  const alias = (await aliasLink.innerText()).trim();
  await table
    .getByRole("link", { name: /Ouvrir le visuel de/ })
    .first()
    .click();

  // The decision screen: taken in charge, the grid whole beside the visual, which is read on demand.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /Visuel de portfolio — /,
  );
  // the two were deposited at once: the list says which comes first, the address says which one is open
  const openedId = new URL(page.url()).pathname.split("/").at(-1);
  await expect(
    page.getByText(/Vous avez pris cette entrée en charge à \d{2}:\d{2}\./),
  ).toBeVisible();
  const grid = page.getByRole("region", { name: R.grid.tableLabel });
  await expect(grid.locator("[data-control]")).toHaveCount(9);
  await expect(grid).toContainText(R.grid.rows[5]?.label ?? "");
  await expect(grid).toContainText(R.grid.rows[7]?.label ?? "");
  await expect(page.locator("main img")).toHaveCount(0);
  await page.getByRole("button", { name: /Afficher le visuel/ }).click();
  await expect(page.locator("[data-visual] img")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  const imageBox = await page.locator("[data-visual]").boundingBox();
  const gridBox = await grid.boundingBox();
  expect(imageBox?.x ?? 0).toBeLessThan(gridBox?.x ?? 0);
  await expectNoAxeViolation(page, "portfolio review entry, 1 440", {
    wcag22: true,
  });

  // ‹r› opens the picker and never refuses; the reason picked shows the very sentence the creator will read.
  await page.keyboard.press("r");
  const reject = page.getByRole("form", { name: R.decision.rejectTitle });
  await expect(reject).toBeVisible();
  await reject.getByRole("button", { name: R.decision.reasonConfirm }).click();
  await expect(page.getByText(R.decision.reasonRequired)).toBeVisible();
  await reject
    .getByRole("radio", {
      name: R.decision.reasonNumber(1, R.decision.reasonLabels.watermark ?? ""),
    })
    .check();
  await expect(reject.getByText(R.decision.messageToCreator)).toBeVisible();
  await expect(reject.getByText(/filigrane/i).last()).toBeVisible();
  await reject
    .getByLabel(bo.claimedReview.comment, { exact: true })
    .fill("INTERNAL-NOTE-L2G-16");
  await reject.getByRole("button", { name: R.decision.reasonConfirm }).click();
  await expect(
    page.getByText(
      R.decision.rejectedNotice(
        alias,
        R.decision.reasonLabels.watermark?.toLowerCase() ?? "",
      ),
    ),
  ).toBeVisible();
  const refused = (await portfolioEntriesOf(accountId)).find(
    (entry) => entry.id === openedId,
  );
  expect(refused).toMatchObject({
    id: openedId,
    state: "rejected",
    reasonCode: "watermark",
    internalComment: "INTERNAL-NOTE-L2G-16",
  });
  expect(refused?.decidedBy).not.toBeNull();

  // The second visual: ‹v› opens the recap and never approves, the confirmation does.
  await page.goto(
    `${BACKOFFICE_ORIGIN}/files/visuels/${deposited.find((entry) => entry.id !== openedId)?.id ?? ""}`,
  );
  await expect(
    page.getByText(/Vous avez pris cette entrée en charge à \d{2}:\d{2}\./),
  ).toBeVisible();
  await page.keyboard.press("v");
  const approve = page.getByRole("form", { name: R.decision.approveTitle });
  await expect(approve).toBeVisible();
  expect(
    (await portfolioEntriesOf(accountId)).filter(
      (entry) => entry.state === "pending",
    ),
  ).toHaveLength(1);
  await approve
    .getByRole("button", { name: R.decision.approveConfirm })
    .click();
  await expect(page.getByText(R.decision.approvedNotice(alias))).toBeVisible();
  const entries = await portfolioEntriesOf(accountId);
  expect(entries.map((entry) => entry.state).sort()).toEqual([
    "approved",
    "rejected",
  ]);
  expect(entries.find((entry) => entry.state === "approved")?.decidedBy).toBe(
    refused?.decidedBy,
  );
});
