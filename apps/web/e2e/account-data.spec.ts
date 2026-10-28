// "Mes données" in a real browser, at 375 px (J7T-5, J8 commit 10; docs/mvp/17 §6.3; 05 RG57;
// 15 §G): a member signed up through the screens asks for the export of their data, then for the
// deletion of their account — the two lists, the word SUPPRIMER (refused when mistyped), and a
// fresh code for each request. The export stays a REQUEST, nothing says that anything was exported;
// the deletion is authorised by the fresh code alone (D72): the member is signed out at once and the
// worker erases the account. The screen passes axe on WCAG 2.1 AA (J7T-4).
import type { Page } from "@playwright/test";
import frAccount from "@/locales/fr/account.json" with { type: "json" };
import { dataRequestFacts } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import {
  AUTH_LABELS,
  expect,
  fill,
  lastCodeEmail,
  mailboxAddress,
  messagePattern,
  open,
  signUpAsCreator,
  test,
  title,
} from "./support/journey";

const t = frAccount;

test.use({ viewport: { width: 375, height: 812 } });

/** 17 §6.7: no horizontal scroll at 375 px. */
async function expectNoSideScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The fresh code of RG57: sent to the address of the session, its phrase checked, then typed. */
async function freshCode(page: Page, address: string): Promise<void> {
  await page.getByRole("button", { name: t.freshCode.send }).click();
  await expect(
    page.getByText(fill(t.freshCode.sent, "email", address)),
  ).toBeVisible();
  const email = await lastCodeEmail(page, address);
  const phrase = page
    .getByText(t.freshCode.phraseLabel)
    .locator("xpath=following-sibling::p[1]");
  expect(email.text).toContain((await phrase.textContent()) ?? "-");
  await page.getByLabel(t.freshCode.codeLabel).fill(email.code);
}

test("an export, then a deletion: two requests, the word SUPPRIMER and a fresh code each (RG57, 17 §6.3)", async ({
  page,
}) => {
  const address = mailboxAddress("data-requests");
  await open(page, "/fr/inscription/createur");
  await signUpAsCreator(page, AUTH_LABELS.fr, address);

  await open(page, "/fr/compte/donnees");
  await expect(title(page)).toHaveText(t.data.title);
  await expectNoSideScroll(page);
  await expectNoAxeViolation(page, "mes données");

  // The export: a fresh code, then the request received, with its legal deadline.
  await page.getByRole("button", { name: t.data.export.action }).click();
  await freshCode(page, address);
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: messagePattern(t.data.done.access, "date") }),
  ).toBeVisible();
  await expect(page.getByText(t.data.export.open)).toBeVisible();
  await expect(
    page.getByText(
      t.data.requests.line
        .replace("{type}", t.data.requests.type.access)
        .replace("{status}", t.data.requests.status.received),
    ),
  ).toBeVisible();

  // The danger zone: the last section, a red notice with its icon and a solid red button (T11, T12).
  const danger = page.locator("section").filter({
    has: page.getByRole("heading", { level: 2, name: t.data.danger.title }),
  });
  await expect(page.locator("section").last()).toContainText(
    t.data.danger.title,
  );
  await expect(
    danger.getByRole("heading", { level: 3, name: t.data.danger.deleteTitle }),
  ).toBeVisible();
  await expect(danger.getByText(t.data.danger.exportFirst)).toBeVisible();
  const notice = danger.locator("div").filter({ has: page.locator("strong") });
  await expect(notice.locator("strong")).toBeVisible();
  await expect(notice).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(notice).toHaveCSS("border-top-width", "1px");
  await expect(notice).toHaveCSS("border-top-color", "rgb(229, 72, 77)");
  await expect(notice).toHaveCSS("color", "rgb(236, 93, 94)");
  const deleteButton = danger.getByRole("button", {
    name: t.data.danger.deleteTitle,
  });
  await expect(deleteButton).toHaveCSS("background-color", "rgb(185, 44, 44)");
  await expectNoAxeViolation(page, "zone de danger");

  // The deletion: the two lists side by side, then the word.
  await deleteButton.click();
  await expect(title(page)).toHaveText(t.data.confirm.title);
  await expect(
    page.getByRole("heading", { name: t.data.confirm.goneTitle }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: t.data.confirm.keptTitle }),
  ).toBeVisible();
  await expect(page.locator("strong")).toBeVisible();
  await expectNoSideScroll(page);
  await expectNoAxeViolation(page, "supprimer mon compte");

  const word = t.data.confirm.word;
  const wordField = page.getByLabel(
    fill(t.data.confirm.wordLabel, "word", word),
  );
  await wordField.fill("SUPRIMER");
  await page.getByRole("button", { name: t.data.confirm.submit }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: fill(t.data.confirm.wordError, "word", word) }),
  ).toBeVisible();
  await expect(title(page)).toHaveText(t.data.confirm.title);

  await wordField.fill(word);
  await page.getByRole("button", { name: t.data.confirm.submit }).click();
  await freshCode(page, address);
  // D72: authorised by the fresh code alone, every session closed; the worker erases the account.
  // The final screen has no account navigation (T10).
  await expect(title(page)).toHaveText(t.data.deleted.title);
  await expect(page.getByRole("status")).toHaveText(t.data.deleted.text);
  await expect(
    page.getByRole("link", { name: t.data.deleted.home }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expectNoAxeViolation(page, "compte supprimé");

  // Two self-service requests: the export waits for an admin, the erasure is already in progress.
  const facts = await dataRequestFacts(address);
  expect(facts.requests).toEqual([
    { type: "access", status: "received", channel: "self_service" },
    { type: "erasure", status: "in_progress", channel: "self_service" },
  ]);
});
