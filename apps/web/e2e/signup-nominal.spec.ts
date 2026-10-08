// The two nominal sign-ups of the J5, one per door (21 §J5 "Tests"; 18 §7.1 E1 and E2 in their J5
// form; 05 CA1, CA2, CA22; 17 §3): door, address, code read in the Brevo double, information,
// space. Then what the sign-up left: the account and its role, the terms in force accepted, the
// consent given under the exact wording on screen (RG32), and the three lines of EC-10.
import { signedUpAccount } from "./support/database";
import {
  AUTH_LABELS,
  consentBox,
  enterCode,
  expect,
  fill,
  mailboxAddress,
  open,
  requestCode,
  termsBox,
  test,
  title,
} from "./support/journey";

const QUEUE_OF_A_SIGNUP = [
  "apollo_contact",
  "brevo_contact",
  "brevo_transactional",
].sort();

test("a brand signs up through its door, in French (CA1, CA2, CA22, EC-10)", async ({
  page,
}) => {
  const t = AUTH_LABELS.fr;
  const address = mailboxAddress("brand-nominal");

  await open(page, "/fr/inscription/marque");
  await requestCode(page, t, address);
  await enterCode(page, t, address);

  await expect(title(page)).toContainText(t.signup.title.advertiser);
  await expect(
    page.getByText(fill(t.signup.verifiedEmail, "email", address)),
  ).toBeVisible();
  // D63, RG23: neither box is ever ticked for the member.
  await expect(termsBox(page, t)).not.toBeChecked();
  await expect(consentBox(page, t, "advertiser")).not.toBeChecked();

  await page.getByLabel(t.signup.company.label).fill("Maison E2E");
  await page.getByLabel(t.signup.country.label.advertiser).selectOption("GB");
  await termsBox(page, t).check();
  await consentBox(page, t, "advertiser").check();
  await page.getByRole("button", { name: t.signup.submit }).click();

  await expect(title(page)).toContainText(t.signup.success.title);
  await page.getByRole("link", { name: t.goToSpace }).click();
  await expect(page).toHaveURL(/\/fr\/marque$/);
  await expect(title(page)).toContainText(t.home.advertiser.title);

  const account = await signedUpAccount(address);
  expect(account).toEqual({
    role: "advertiser",
    countryCode: "GB",
    preferredLanguage: "fr",
    declaredStatus: "business", // RG22
    adultAttestedDated: false,
    legalName: "Maison E2E",
    acceptedTermsInForce: true,
    acceptanceLocale: "fr",
    consents: [
      {
        purpose: "commercial_prospection",
        granted: true,
        wording: t.signup.consent.advertiser.label,
      },
      {
        purpose: "marketing_email",
        granted: true,
        wording: t.signup.consent.advertiser.label,
      },
    ],
    queue: QUEUE_OF_A_SIGNUP,
  });
});

test("a creator chooses the creator door and signs up, in English (CA1, CA2, RG20, EC-10)", async ({
  page,
}) => {
  const t = AUTH_LABELS.en;
  const address = mailboxAddress("creator-nominal");

  await open(page, "/en/signup");
  await expect(title(page)).toContainText(t.door.title);
  await page.getByRole("button", { name: t.door.creator.action }).click();
  await expect(page).toHaveURL(/\/en\/signup\/creator$/);
  await requestCode(page, t, address);
  await enterCode(page, t, address);

  await expect(title(page)).toContainText(t.signup.title.creator);
  await expect(termsBox(page, t)).not.toBeChecked();
  await expect(consentBox(page, t, "creator")).not.toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: t.signup.adult.label }),
  ).not.toBeChecked();

  await page.getByLabel(t.signup.country.label.creator).selectOption("FR");
  await page
    .getByRole("radio", { name: t.signup.status.individual, exact: true })
    .check();
  await page.getByRole("checkbox", { name: t.signup.adult.label }).check();
  await termsBox(page, t).check();
  await consentBox(page, t, "creator").check();
  await page.getByRole("button", { name: t.signup.submit }).click();

  await expect(title(page)).toContainText(t.signup.success.title);
  await page.getByRole("link", { name: t.goToSpace }).click();
  await expect(page).toHaveURL(/\/en\/creator$/);
  await expect(title(page)).toContainText(t.home.creator.title);

  const account = await signedUpAccount(address);
  expect(account).toEqual({
    role: "creator",
    countryCode: "FR",
    preferredLanguage: "en",
    declaredStatus: "individual",
    adultAttestedDated: true, // RG20: the attestation is dated
    legalName: null,
    acceptedTermsInForce: true,
    acceptanceLocale: "en",
    consents: [
      {
        purpose: "commercial_prospection",
        granted: true,
        wording: t.signup.consent.creator.label,
      },
      {
        purpose: "marketing_email",
        granted: true,
        wording: t.signup.consent.creator.label,
      },
    ],
    queue: QUEUE_OF_A_SIGNUP,
  });
});
