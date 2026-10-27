// The landing is no mock-up any more (J9 commit 10; fiche J9 "critère de fin"; 18 §10 Lot 1; EC-15,
// EC-J9-2): in French and in English, every door of the landing opens the real sign-up page of its
// language, and a person who comes in through the landing signs up for real — the code read in the
// Brevo double, the account, the terms in force and the three lines of the queue in the local
// stack. The door labels are the locale files themselves, never a copy.
import enLanding from "@/locales/en/landing.json" with { type: "json" };
import frLanding from "@/locales/fr/landing.json" with { type: "json" };
import { signedUpAccount } from "./support/database";
import {
  AUTH_LABELS,
  consentBox,
  enterCode,
  expect,
  mailboxAddress,
  open,
  requestCode,
  signUpAsCreator,
  termsBox,
  test,
  title,
  type Locale,
} from "./support/journey";

const LANDING = { fr: frLanding, en: enLanding } as const;

/** 17 §3, EC-15: the localized paths of the two doors, and of the page that offers both. */
const DOORS: Readonly<
  Record<Locale, { advertiser: string; creator: string; both: string }>
> = {
  fr: {
    advertiser: "/fr/inscription/marque",
    creator: "/fr/inscription/createur",
    both: "/fr/inscription",
  },
  en: {
    advertiser: "/en/signup/brand",
    creator: "/en/signup/creator",
    both: "/en/signup",
  },
};

const QUEUE_OF_A_SIGNUP = [
  "apollo_contact",
  "brevo_contact",
  "brevo_transactional",
].sort();

for (const locale of ["fr", "en"] as const) {
  test(`/${locale}: every sign-up link of the landing opens the real page of its door (EC-15, EC-J9-2)`, async ({
    page,
  }) => {
    const cta = LANDING[locale].common.cta;
    await open(page, `/${locale}`);
    const hrefsOf = (name: string) =>
      page
        .getByRole("link", { name, exact: true })
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute("href") ?? ""),
        );
    const advertiser = await hrefsOf(cta.advertiser);
    const creator = await hrefsOf(cta.creator);
    const both = await hrefsOf(cta.signup);
    // At least the hero and the doors section, each a link to its own door, never elsewhere.
    expect(advertiser.length).toBeGreaterThanOrEqual(2);
    expect(creator.length).toBeGreaterThanOrEqual(2);
    expect(both.length).toBeGreaterThanOrEqual(1);
    expect(new Set(advertiser)).toEqual(new Set([DOORS[locale].advertiser]));
    expect(new Set(creator)).toEqual(new Set([DOORS[locale].creator]));
    expect(new Set(both)).toEqual(new Set([DOORS[locale].both]));
    // The mock-up's paths are gone (EC-J9-2), and no form of the landing posts anywhere.
    await expect(page.locator('a[href*="/signup/advertiser"]')).toHaveCount(0);
    await expect(page.locator("form")).toHaveCount(0);
  });
}

test("a brand comes in through the French landing and signs up for real", async ({
  page,
}) => {
  const t = AUTH_LABELS.fr;
  const address = mailboxAddress("landing-brand-fr");

  await open(page, "/fr");
  await page
    .getByRole("link", { name: frLanding.common.cta.advertiser, exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`${DOORS.fr.advertiser}$`));
  await requestCode(page, t, address);
  await enterCode(page, t, address);
  await expect(title(page)).toContainText(t.signup.title.advertiser);
  await page.getByLabel(t.signup.company.label).fill("Maison Landing");
  await page.getByLabel(t.signup.country.label.advertiser).selectOption("BE");
  await termsBox(page, t).check();
  await consentBox(page, t, "advertiser").check();
  await page.getByRole("button", { name: t.signup.submit }).click();
  await expect(title(page)).toContainText(t.signup.success.title);

  expect(await signedUpAccount(address)).toMatchObject({
    role: "advertiser",
    countryCode: "BE",
    preferredLanguage: "fr",
    legalName: "Maison Landing",
    acceptedTermsInForce: true,
    acceptanceLocale: "fr",
    queue: QUEUE_OF_A_SIGNUP,
  });
});

test("a creator comes in through the English landing and signs up for real", async ({
  page,
}) => {
  const t = AUTH_LABELS.en;
  const address = mailboxAddress("landing-creator-en");

  await open(page, "/en");
  await page
    .getByRole("link", { name: enLanding.common.cta.creator, exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`${DOORS.en.creator}$`));
  await signUpAsCreator(page, t, address);

  expect(await signedUpAccount(address)).toMatchObject({
    role: "creator",
    countryCode: "FR",
    preferredLanguage: "en",
    adultAttestedDated: true,
    acceptedTermsInForce: true,
    acceptanceLocale: "en",
    queue: QUEUE_OF_A_SIGNUP,
  });
});
