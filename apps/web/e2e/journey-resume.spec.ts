// D66 in a real browser (05 RG111, RG130; 17 §3 "Changement de langue"; j5-fiche, "Issu du commit
// 5", testeur): what a reload resumes from apps/api's journey cookies, what a change of language
// carries over, and when the resume gives up for screen 1. The rules of each screen are unit tests
// (auth-steps, signup-form, journey-memory); these are the journeys only a browser shows.
import {
  AUTH_LABELS,
  consentBox,
  countdown,
  enterCode,
  expect,
  fill,
  mailboxAddress,
  matchingPhrase,
  messagePattern,
  open,
  reload,
  requestCode,
  switchLanguage,
  termsBox,
  test,
  title,
} from "./support/journey";

test("a reload on screen 2 keeps the address and the phrase, and the countdown goes on (RG50, RG111)", async ({
  page,
}) => {
  const t = AUTH_LABELS.fr;
  const address = mailboxAddress("reload-code");
  await open(page, "/fr/inscription/createur");
  await requestCode(page, t, address);
  const phrase = await matchingPhrase(page, t).textContent();
  // The countdown is announced every ten seconds (17 §3.2): 50 is the first step after 60.
  await expect(countdown(page, t)).toContainText("60", { timeout: 2_000 });
  await expect(countdown(page, t)).toContainText("50", { timeout: 15_000 });

  await reload(page);

  await expect(title(page)).toContainText(t.step2.title);
  await expect(
    page.getByText(fill(t.step2.sentTo, "email", address)),
  ).toBeVisible();
  await expect(matchingPhrase(page, t)).toHaveText(phrase ?? "");
  const left = messagePattern(t.code.resend.countdown, "seconds").exec(
    (await countdown(page, t).textContent()) ?? "",
  )?.[1];
  expect(Number(left)).toBeLessThanOrEqual(50);
  expect(Number(left)).toBeGreaterThan(0);
});

test("a reload on screen 3 of a door keeps the verified address, not the answers (RG111, D66)", async ({
  page,
}) => {
  const t = AUTH_LABELS.en;
  const address = mailboxAddress("reload-details-door");
  await open(page, "/en/signup/brand");
  await requestCode(page, t, address);
  await enterCode(page, t, address);
  await expect(title(page)).toContainText(t.signup.title.advertiser);
  await page.getByLabel(t.signup.company.label).fill("Typed before the reload");
  await page.getByLabel(t.signup.country.label.advertiser).selectOption("GB");
  await termsBox(page, t).check();

  await reload(page);

  await expect(page).toHaveURL(/\/en\/signup\/brand$/);
  await expect(title(page)).toContainText(t.signup.title.advertiser);
  await expect(
    page.getByText(fill(t.signup.verifiedEmail, "email", address)),
  ).toBeVisible();
  await expect(page.getByLabel(t.signup.company.label)).toHaveValue("");
  await expect(page.getByLabel(t.signup.country.label.advertiser)).toHaveValue(
    "",
  );
  await expect(termsBox(page, t)).not.toBeChecked();
});

test("a reload after the code on the sign-in or the doors page asks for the door, then screen 3 (RG3, D66)", async ({
  page,
}) => {
  const t = AUTH_LABELS.fr;
  const address = mailboxAddress("reload-details-sign-in");
  await open(page, "/fr/connexion");
  await requestCode(page, t, address);
  await enterCode(page, t, address);
  // No account for this address: the door is asked for after the code.
  await expect(title(page)).toContainText(t.door.title);

  await reload(page);
  await expect(page).toHaveURL(/\/fr\/connexion$/);
  await expect(title(page)).toContainText(t.door.title);

  await open(page, "/fr/inscription");
  await expect(title(page)).toContainText(t.door.title);
  await page.getByRole("button", { name: t.door.creator.action }).click();

  // Screen 3 at once: the address is already verified, no new code.
  await expect(page).toHaveURL(/\/fr\/inscription\/createur$/);
  await expect(title(page)).toContainText(t.signup.title.creator);
  await expect(
    page.getByText(fill(t.signup.verifiedEmail, "email", address)),
  ).toBeVisible();
});

test("a change of language on screens 2 and 3 keeps the phrase and the answers, and unticks terms and consent (RG130, RG32, D66)", async ({
  page,
}) => {
  const fr = AUTH_LABELS.fr;
  const en = AUTH_LABELS.en;
  const address = mailboxAddress("language");
  await open(page, "/fr/inscription/marque");
  await requestCode(page, fr, address);
  const phrase = await matchingPhrase(page, fr).textContent();

  await switchLanguage(page, fr, "en");

  await expect(page).toHaveURL(/\/en\/signup\/brand$/);
  await expect(title(page)).toContainText(en.step2.title);
  await expect(
    page.getByText(fill(en.step2.sentTo, "email", address)),
  ).toBeVisible();
  await expect(matchingPhrase(page, en)).toHaveText(phrase ?? "");

  await enterCode(page, en, address);
  await expect(title(page)).toContainText(en.signup.title.advertiser);
  await page.getByLabel(en.signup.company.label).fill("Maison bilingue");
  await page.getByLabel(en.signup.country.label.advertiser).selectOption("CA");
  await page.getByRole("radio", { name: en.language.en, exact: true }).check();
  await termsBox(page, en).check();
  await consentBox(page, en, "advertiser").check();

  await switchLanguage(page, en, "fr");

  await expect(page).toHaveURL(/\/fr\/inscription\/marque$/);
  await expect(title(page)).toContainText(fr.signup.title.advertiser);
  await expect(page.getByLabel(fr.signup.company.label)).toHaveValue(
    "Maison bilingue",
  );
  await expect(page.getByLabel(fr.signup.country.label.advertiser)).toHaveValue(
    "CA",
  );
  await expect(
    page.getByRole("radio", { name: fr.language.en, exact: true }),
  ).toBeChecked();
  // Ticked under the other language's wording: ticked again under this one (RG32).
  await expect(termsBox(page, fr)).not.toBeChecked();
  await expect(consentBox(page, fr, "advertiser")).not.toBeChecked();
});

test("“change address” then a reload starts again from screen 1 (D66)", async ({
  page,
}) => {
  const t = AUTH_LABELS.en;
  const address = mailboxAddress("change-address");
  await open(page, "/en/signup/creator");
  await requestCode(page, t, address);

  // The reset is not awaited by the screen: the reload waits for it, as a person would not notice.
  const reset = page.waitForResponse("**/api/v1/auth/journey/reset");
  await page.getByRole("button", { name: t.step2.changeEmail }).click();
  await expect(title(page)).toContainText(t.step1.title);
  expect((await reset).ok()).toBe(true);

  await reload(page);

  await expect(title(page)).toContainText(t.step1.title);
  await expect(page.getByLabel(t.step1.emailLabel)).toHaveValue("");
});

test("the door chosen becomes the URL, and a reload stays on that door (RG3, D66)", async ({
  page,
}) => {
  const t = AUTH_LABELS.fr;
  await open(page, "/fr/inscription");
  await page.getByRole("button", { name: t.door.creator.action }).click();
  await expect(page).toHaveURL(/\/fr\/inscription\/createur$/);
  await expect(title(page)).toContainText(t.step1.title);

  await reload(page);

  await expect(page).toHaveURL(/\/fr\/inscription\/createur$/);
  await expect(title(page)).toContainText(t.step1.title);
  await expect(
    page.getByRole("button", { name: t.step1.roleChange }),
  ).toBeVisible();
});

test("the resume gives up for screen 1 when apps/api stays silent over 3 s or cannot be reached (D66, RG109)", async ({
  page,
}) => {
  const t = AUTH_LABELS.en;
  const address = mailboxAddress("resume-gives-up");
  // The 3 s of RESUME_TIMEOUT_MS are the browser's clock, moved forward below rather than waited.
  await page.clock.install();
  await open(page, "/en/signup/creator");
  await requestCode(page, t, address);

  // Silent: the answer is held back past the 3 s of RESUME_TIMEOUT_MS, too late to be used.
  let answer: () => void = () => undefined;
  const answerHeld = new Promise<void>((resolve) => {
    answer = resolve;
  });
  await page.route("**/api/v1/auth/journey", async (route) => {
    await answerHeld;
    await route.continue().catch(() => undefined);
  });
  await reload(page);
  await expect(page.getByText(t.journey.loading)).toBeVisible();
  await page.clock.fastForward(3_500);
  await expect(title(page)).toContainText(t.step1.title, { timeout: 5_000 });
  answer();
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // Unreachable: the relay call fails at once.
  await page.route("**/api/v1/auth/journey", (route) =>
    route.abort("internetdisconnected"),
  );
  await reload(page);
  await expect(title(page)).toContainText(t.step1.title);
  await page.unrouteAll({ behavior: "ignoreErrors" });

  // The journey itself was still at the code: once apps/api answers, the reload resumes there.
  await reload(page);
  await expect(title(page)).toContainText(t.step2.title);
});
