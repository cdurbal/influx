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

  // The deletion: the two lists side by side, then the word.
  await page.getByRole("button", { name: t.data.delete.action }).click();
  await expect(title(page)).toHaveText(t.data.confirm.title);
  await expect(
    page.getByRole("heading", { name: t.data.confirm.goneTitle }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: t.data.confirm.keptTitle }),
  ).toBeVisible();
  await expect(page.getByText(t.data.confirm.manual)).toBeVisible();
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
  // D72: authorised by the fresh code alone, every session closed; the worker erases the account
  await expect(page.getByText(t.data.done.erasureAuthorised)).toBeVisible();

  // Two self-service requests: the export waits for an admin, the erasure is already in progress.
  const facts = await dataRequestFacts(address);
  expect(facts.requests).toEqual([
    { type: "access", status: "received", channel: "self_service" },
    { type: "erasure", status: "in_progress", channel: "self_service" },
  ]);
});
