// "Mon compte" in a real browser, at 375 px (J7 commit 9; docs/mvp/17 §6.1, §6.2, §6.4, §6.7;
// 05 RG28, RG34, RG56, RG58, RG95, RG143; CA33, CA34, CA70): the preferences and their origin in
// full, the sessions and "fermer toutes les sessions", the blocking terms screen (accepted, then
// refused), and the change of address up to its waiting state. The rules of each screen are unit
// tests (account-view); these are the journeys only a browser shows.
import type { Page } from "@playwright/test";
import enAccount from "@/locales/en/account.json" with { type: "json" };
import frAccount from "@/locales/fr/account.json" with { type: "json" };
import { accountFacts, seedMember } from "./support/account";
import {
  AUTH_LABELS,
  consentBox,
  enterCode,
  expect,
  fill,
  lastCodeEmail,
  mailboxAddress,
  messagePattern,
  open,
  requestCode,
  termsBox,
  test,
  title,
} from "./support/journey";

const ACCOUNT = { fr: frAccount, en: enAccount } as const;

test.use({ viewport: { width: 375, height: 812 } });

/** 17 §6.7: no horizontal scroll at 375 px. */
async function expectNoSideScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the preferences show the value, its date and its origin in full; one gesture withdraws (RG34, RG95)", async ({
  page,
}) => {
  const t = ACCOUNT.fr.preferences;
  const member = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["firefox.windows"],
  });

  await open(page, "/fr/compte/preferences");
  await expect(title(page)).toHaveText(t.title);
  await expect(
    page.getByText(`${t.stateLabel} ${t.granted}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      messagePattern(t.since.replace("{origin}", t.origin.signupForm), "date"),
    ),
  ).toBeVisible();
  // RG35, RG94: what withdrawing does not change, said beside the action
  await expect(page.getByText(t.unchanged.code)).toBeVisible();
  await expectNoSideScroll(page);

  await page.getByRole("button", { name: t.withdraw }).click();

  await expect(
    page.getByRole("status").filter({ hasText: t.done.withdrawn }),
  ).toBeVisible();
  await expect(
    page.getByText(`${t.stateLabel} ${t.withdrawn}`, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      messagePattern(
        t.since.replace("{origin}", t.origin.accountSettings),
        "date",
      ),
    ),
  ).toBeVisible();
  expect((await accountFacts(member.accountId)).consents).toEqual([
    {
      purpose: "commercial_prospection",
      granted: false,
      source: "account_settings",
    },
    { purpose: "marketing_email", granted: false, source: "account_settings" },
  ]);
});

test("the sessions mark this device; closing all signs this one out, told before (RG143, CA33)", async ({
  page,
}) => {
  const t = ACCOUNT.en.sessions;
  const member = await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: true,
    sessions: ["firefox.windows", "safari.ios"],
  });

  await open(page, "/en/account/sessions");
  await expect(title(page)).toHaveText(t.title);
  await expect(page.getByText(t.help)).toBeVisible();
  const cards = page.getByRole("list", { name: t.title }).getByRole("listitem");
  await expect(cards).toHaveCount(2);
  const current = cards.filter({ hasText: t.current });
  await expect(current).toHaveCount(1);
  await expect(current).toContainText(
    fill(fill(t.browser, "family", "Firefox"), "system", "Windows"),
  );
  await expectNoSideScroll(page);

  // The other browser is closed alone; this one stays signed in.
  await cards
    .filter({
      hasText: fill(fill(t.browser, "family", "Safari"), "system", "iOS"),
    })
    .getByRole("button", { name: t.close })
    .click();
  await expect(page.getByText(t.closed)).toBeVisible();
  await expect(cards).toHaveCount(1);

  // "Close all": the warning first, then the confirmation.
  await page.getByRole("button", { name: t.closeAll }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: t.closeAllWarning }),
  ).toBeVisible();
  await page.getByRole("button", { name: t.closeAllConfirm }).click();
  await expect(title(page)).toHaveText(ACCOUNT.en.signedOut.title);
  await expect(page.getByText(t.allClosed)).toBeVisible();
  expect((await accountFacts(member.accountId)).openSessions).toBe(0);

  // Signed out for good: the page sends to the sign-in screen.
  await page.goto("/en/account/sessions");
  await expect(page).toHaveURL(/\/en\/sign-in$/);
});

test("a version of the terms waiting blocks every page but the rights; accepting lets through (RG28)", async ({
  page,
}) => {
  const t = ACCOUNT.fr.terms;
  const member = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: false,
    sessions: ["chrome.android"],
  });

  await open(page, "/fr/compte");
  await expect(title(page)).toHaveText(t.title);
  await expect(
    page.getByRole("navigation", { name: ACCOUNT.fr.nav.label }),
  ).toHaveCount(0);
  await expect(page.getByText(t.refuseHelp)).toBeVisible();
  await expectNoSideScroll(page);

  // The home shows the same screen, before the page.
  await page.goto("/fr/createur");
  await expect(title(page)).toHaveText(t.title);

  // The rights survive (J7 A3): "mes préférences" opens, with a notice.
  await page.getByRole("link", { name: t.rightsPreferences }).click();
  await expect(title(page)).toHaveText(ACCOUNT.fr.preferences.title);
  await expect(page.getByText(t.pendingNotice)).toBeVisible();

  await page.getByRole("link", { name: t.pendingLink }).click();
  await expect(title(page)).toHaveText(t.title);
  await page.getByRole("button", { name: t.accept }).click();
  await expect(title(page)).toHaveText(ACCOUNT.fr.details.title);
  expect((await accountFacts(member.accountId)).acceptances).toEqual([
    { channel: "re_acceptance" },
  ]);
});

test("refusing the terms signs out without deleting the account (RG28, CA70)", async ({
  page,
}) => {
  const t = ACCOUNT.en.terms;
  const member = await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: false,
    sessions: ["edge.windows"],
  });

  await open(page, "/en/brand");
  await expect(title(page)).toHaveText(t.title);
  await page.getByRole("button", { name: t.refuse }).click();
  await expect(page.getByText(t.refused)).toBeVisible();
  const facts = await accountFacts(member.accountId);
  expect(facts.status).toBe("active");
  expect(facts.acceptances).toEqual([]);
  expect(facts.openSessions).toBe(0);
});

test("a change of address waits for both codes; the sign-in address stays the old one (RG58, CA34)", async ({
  page,
}) => {
  const auth = AUTH_LABELS.fr;
  const t = ACCOUNT.fr;
  const oldAddress = mailboxAddress("account-address-old");
  const newAddress = mailboxAddress("account-address-new");

  // A real member, signed up through the screens: the fresh code needs its sign-in user.
  await open(page, "/fr/inscription/createur");
  await requestCode(page, auth, oldAddress);
  await enterCode(page, auth, oldAddress);
  await page.getByLabel(auth.signup.country.label.creator).selectOption("FR");
  await page
    .getByRole("radio", { name: auth.signup.status.individual, exact: true })
    .check();
  await page.getByRole("checkbox", { name: auth.signup.adult.label }).check();
  await termsBox(page, auth).check();
  await consentBox(page, auth, "creator").check();
  await page.getByRole("button", { name: auth.signup.submit }).click();
  await expect(title(page)).toContainText(auth.signup.success.title);
  await page.getByRole("link", { name: auth.goToSpace }).click();
  await page.getByRole("link", { name: t.homeLink }).click();
  await expect(title(page)).toHaveText(t.details.title);
  await expectNoSideScroll(page);

  // The fresh code (RG57), its phrase checked against the e-mail (RG48).
  await page.getByRole("button", { name: t.email.start }).click();
  await page.getByRole("button", { name: t.freshCode.send }).click();
  await expect(
    page.getByText(fill(t.freshCode.sent, "email", oldAddress)),
  ).toBeVisible();
  const reauth = await lastCodeEmail(page, oldAddress);
  const phrase = page
    .getByText(t.freshCode.phraseLabel)
    .locator("xpath=following-sibling::p[1]");
  expect(reauth.text).toContain((await phrase.textContent()) ?? "-");
  await page.getByLabel(t.freshCode.codeLabel).fill(reauth.code);

  // The new address, then the waiting state.
  await page.getByLabel(t.email.newLabel).fill(newAddress);
  await page.getByRole("button", { name: t.email.send }).click();
  await expect(
    page.getByText(
      messagePattern(
        t.email.pending.status.replace("{confirmed}", "0"),
        "date",
      ),
    ),
  ).toBeVisible();
  await expect(
    page.getByText(fill(t.email.pending.stays, "email", oldAddress)),
  ).toBeVisible();

  // The code of the current address: one of two.
  const oldSide = await lastCodeEmail(page, oldAddress);
  expect(oldSide.code).not.toBe(reauth.code);
  await page
    .getByLabel(fill(t.email.pending.oldLabel, "email", oldAddress))
    .fill(oldSide.code);
  await page
    .getByRole("button", { name: t.email.pending.confirm })
    .first()
    .click();
  await expect(
    page.getByText(
      messagePattern(
        t.email.pending.status.replace("{confirmed}", "1"),
        "date",
      ),
    ),
  ).toBeVisible();
  await expect(
    page.getByText(fill(t.email.pending.confirmed, "email", oldAddress)),
  ).toBeVisible();
  // Until the second code, nothing changed: the page read again still says the old address.
  await page.reload();
  await expect(
    page.getByText(fill(t.email.pending.stays, "email", oldAddress)),
  ).toBeVisible();
});
