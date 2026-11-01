// "Mon compte" in a real browser, at 375 px (J7 commit 9; docs/mvp/17 §6.1, §6.2, §6.4, §6.7;
// 05 RG28, RG34, RG56, RG58, RG95, RG143; CA33, CA34, CA70): the preferences and their origin in
// full, the sessions and "fermer toutes les sessions", the blocking terms screen (accepted, then
// refused), and the change of address up to its waiting state. The rules of each screen are unit
// tests (account-view); these are the journeys only a browser shows. J7T-4 (J8 commit 10): each
// screen passes axe on WCAG 2.1 AA at 375 px ("mes données": account-data.spec.ts).
import type { Page } from "@playwright/test";
import enAccount from "@/locales/en/account.json" with { type: "json" };
import frAccount from "@/locales/fr/account.json" with { type: "json" };
import { accountFacts, seedMember } from "./support/account";
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
  await expectNoAxeViolation(page, "mes préférences");

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
  await expectNoAxeViolation(page, "my sessions");

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

  await open(page, "/fr/compte/informations");
  await expect(title(page)).toHaveText(t.title);
  await expect(page.getByRole("navigation")).toHaveCount(0);
  await expect(page.getByText(t.refuseHelp)).toBeVisible();
  await expectNoSideScroll(page);
  await expectNoAxeViolation(page, "conditions en attente");

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
  await signUpAsCreator(page, auth, oldAddress);
  await page.getByRole("link", { name: auth.goToSpace }).click();
  await page.getByRole("link", { name: t.homeLink }).click();
  await expect(title(page)).toHaveText(t.hub.title);
  await page.getByRole("link", { name: t.nav.accountDetails }).click();
  await expect(title(page)).toHaveText(t.details.title);
  await expectNoSideScroll(page);
  await expectNoAxeViolation(page, "mon compte");

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

/** The language link the screen shows (header below lg, foot of the column from lg). */
function languageLink(page: Page, to: "fr" | "en") {
  return page.locator(`a[hreflang="${to}"]:visible`);
}

const HUB_ROWS = [
  "accountDetails",
  "accountPreferences",
  "accountSessions",
  "accountData",
] as const;

const HUB_PATHS = {
  fr: {
    accountDetails: "/fr/compte/informations",
    accountPreferences: "/fr/compte/preferences",
    accountSessions: "/fr/compte/sessions",
    accountData: "/fr/compte/donnees",
  },
  en: {
    accountDetails: "/en/account/details",
    accountPreferences: "/en/account/preferences",
    accountSessions: "/en/account/sessions",
    accountData: "/en/account/data",
  },
} as const;

test("the page-menu lists the four pages of mon compte, in French then in English (17 §6.0, D74)", async ({
  page,
}) => {
  await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.android"],
  });
  await open(page, "/fr/compte");
  for (const locale of ["fr", "en"] as const) {
    const t = ACCOUNT[locale];
    await expect(title(page)).toHaveText(t.hub.title);
    const rows = page.getByRole("main").getByRole("listitem");
    await expect(rows).toHaveCount(HUB_ROWS.length);
    for (const [index, key] of HUB_ROWS.entries()) {
      const row = rows.nth(index);
      await expect(row.getByRole("link")).toHaveText(t.nav[key]);
      await expect(row.getByRole("link")).toHaveAttribute(
        "href",
        HUB_PATHS[locale][key],
      );
      await expect(row).toContainText(t.hub.items[key]);
    }
    await expect(page.getByRole("main").getByRole("navigation")).toHaveCount(0);
    await expectNoSideScroll(page);
    if (locale === "fr") {
      await expect(languageLink(page, "en")).toHaveAttribute(
        "href",
        "/en/account",
      );
      await languageLink(page, "en").click();
      await expect(page).toHaveURL(/\/en\/account$/);
    }
  }
  await expect(languageLink(page, "fr")).toHaveAttribute("href", "/fr/compte");
});

test("« Mes informations » links to its own page in the other language (sn-fiche Adresses)", async ({
  page,
}) => {
  await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["edge.windows"],
  });
  await open(page, "/fr/compte/informations");
  await expect(title(page)).toHaveText(ACCOUNT.fr.details.title);
  await expect(languageLink(page, "en")).toHaveAttribute(
    "href",
    "/en/account/details",
  );
  await languageLink(page, "en").click();
  await expect(page).toHaveURL(/\/en\/account\/details$/);
  await expect(title(page)).toHaveText(ACCOUNT.en.details.title);
});

test("while terms wait, the page-menu leads to the exempted pages and « Mes informations » to the screen (RG28, J7 A3)", async ({
  page,
}) => {
  const t = ACCOUNT.fr;
  await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: false,
    sessions: ["chrome.android"],
  });
  await open(page, "/fr/compte");
  await expect(title(page)).toHaveText(t.hub.title);
  await expectNoAxeViolation(page, "page-menu, CGU en attente");

  await page
    .getByRole("link", { name: t.nav.accountPreferences, exact: true })
    .click();
  await expect(title(page)).toHaveText(t.preferences.title);

  await open(page, "/fr/compte");
  await page
    .getByRole("link", { name: t.nav.accountData, exact: true })
    .click();
  await expect(title(page)).toHaveText(t.data.title);

  await open(page, "/fr/compte");
  await page
    .getByRole("link", { name: t.nav.accountDetails, exact: true })
    .click();
  await expect(title(page)).toHaveText(t.terms.title);
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
