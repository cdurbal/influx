// A brand's request for « Marque vérifiée » (docs/mvp/06 RG46 to RG54, RG84, RG97, CA26 to CA29; jalons/l2e,
// commit 20; split off `verification.spec.ts` by jalons/l2f, commit 01), in French at 1 440 px and in
// English at 375 px, against the real API and the local stack: block 4 of the profile, the code of the
// domain, the internal block asked at the request and nowhere before, the request sent, an agent's
// refusal written by the database as his door would, the dated badge, then a badge to refresh. No amount,
// rate or price anywhere (D78).
import { seedMember } from "./support/account";
import { retireInternals, seedColleague } from "./support/backoffice";
import { expect, open, reload, test, title } from "./support/journey";
import {
  brandBlock,
  BRAND_JOURNEY,
  brandRequestsOf,
  COPY,
  expectAxe,
  expectNothingForbidden,
  fixed,
  grantBrandAsAgent,
  internalDetailsOf,
  PROFILE,
  refuseAsAgent,
  setWebsiteDomain,
  WIDTHS,
} from "./support/verification";

test.afterAll(async () => {
  await retireInternals();
});

test("a brand asks for the badge « Marque vérifiée » in French, from the profile to the dated badge, a refusal written on the way (06 RG46 à RG54, RG84, CA26 à CA29)", async ({
  page,
}) => {
  const copy = COPY.fr.own;
  const brand = COPY.fr.brand;
  await page.setViewportSize({ width: 1440, height: 900 });
  const { accountId } = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  const agent = await seedColleague("agent", "Noa");

  // Block 4, internal layer: nothing asked, what the badge states, and with no domain the badge told
  // impossible BEFORE any button (CA26), the publication of the profile untouched.
  await open(page, PROFILE.fr);
  const block = brandBlock(page);
  await expect(block).toContainText(copy.brandBlock.status.none);
  await expect(block).toContainText(copy.brandBlock.affirms);
  await expect(block).toContainText(copy.brandBlock.noDomain);
  await expect(block).toContainText(brand.layer.internal);
  await expect(block.locator("a")).toHaveCount(0);
  await expect(block.locator("[data-badge]")).toHaveCount(0);
  await expectNothingForbidden(page, '[data-section="verification"]');
  expect(await brandRequestsOf(accountId)).toEqual([]);

  // Screen 1: what the badge states (two things) and does not state, what is shown with it, dated; no
  // request exists yet (RG49, RG50, RG53).
  await setWebsiteDomain(accountId, "maison-e2e.example");
  await reload(page);
  await block.getByRole("link", { name: copy.brandBlock.cta.start }).click();
  await expect(page).toHaveURL(new RegExp(`${BRAND_JOURNEY.fr}$`));
  await expect(title(page)).toHaveText(copy.brand.title);
  await expect(page.locator("[data-step]")).toHaveText(
    copy.ownership.steps.progress
      .replace("{current}", "1")
      .replace("{total}", "3")
      .replace("{name}", copy.brand.steps.affirm),
  );
  const main = page.getByRole("main");
  for (const text of [
    copy.brand.affirm.intro,
    copy.brand.affirm.items.domain,
    copy.brand.affirm.items.registration,
    copy.brand.affirm.byHand,
    copy.brand.affirm.not.solvency,
    copy.brand.affirm.not.serious,
    copy.brand.affirm.not.experience,
    copy.brand.affirm.not.quality,
    copy.brand.affirm.preview.never,
    copy.brandBlock.optional,
  ]) {
    await expect(main.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.locator("[data-preview]")).toContainText(
    new RegExp(
      "Marque vérifiée le \\d{1,2}(er)? \\S+ 20\\d\\d — domaine et immatriculation contrôlés\\.",
    ),
  );
  await expectNothingForbidden(page);
  expect(await brandRequestsOf(accountId)).toEqual([]);

  // Screen 2: the code the API issued, the two ways to publish it, its validity, then the internal block
  // asked HERE and nowhere before (RG47), three fields in the internal layer.
  await page.getByRole("button", { name: copy.brand.affirm.continue }).click();
  const code = page.locator("[data-ownership-code]");
  await expect(code).toHaveText(/^INFLUX-[2-9A-HJKMNP-Z]{8}$/);
  const [draft] = await brandRequestsOf(accountId);
  expect(draft?.status).toBe("draft");
  expect(draft?.code).toBe(await code.innerText());
  await expect(page.locator("[data-step]")).toContainText(
    copy.brand.steps.publish,
  );
  for (const text of [
    copy.brand.publish.ways.dns.title,
    copy.brand.publish.ways.dns.text,
    copy.brand.publish.ways.page.title,
    copy.brand.publish.ways.page.text,
    copy.brand.publish.neverAsk,
    copy.brand.publish.screenshot,
  ]) {
    await expect(main.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.locator("[data-code-validity]")).toContainText(
    fixed(copy.verif.ownership.codeExpiry),
  );
  await expect(
    page
      .locator("[data-internal-block]")
      .getByText(brand.layer.internal, { exact: true }),
  ).toHaveCount(3);
  await expectNothingForbidden(page);
  await expectAxe(page, "brand verification, screen 2, fr", WIDTHS);

  // Nothing is sent while a field is missing: the three are named and the first one takes the focus.
  const send = page.getByRole("button", { name: copy.brand.publish.submit });
  await send.click();
  await expect(page.getByText(copy.brand.details.required)).toHaveCount(3);
  await expect(page.locator("#brand-legal-name")).toBeFocused();
  expect((await brandRequestsOf(accountId))[0]?.status).toBe("draft");
  expect(await internalDetailsOf(accountId)).toBeNull();

  // Screen 3: the block is stored, then the request goes (RG46, RG47).
  await page.locator("#brand-legal-name").fill("Maison E2E SAS");
  await page.locator("#brand-registration-country").selectOption("FR");
  await page.locator("#brand-registration-number").fill("123 456 789");
  await send.click();
  await expect(
    page.getByRole("heading", { name: copy.brand.sent.title }),
  ).toBeVisible();
  await expect(main.getByText(copy.brand.sent.body)).toBeVisible();
  await expect(main.getByText(copy.verif.request.pending)).toBeVisible();
  expect((await brandRequestsOf(accountId))[0]?.status).toBe("pending");
  expect(await internalDetailsOf(accountId)).toEqual({
    legal_name: "Maison E2E SAS",
    registration_country_code: "FR",
    registration_number: "123 456 789",
  });
  await page.getByRole("link", { name: copy.brand.sent.back }).click();
  await expect(title(page)).toHaveText(brand.page.title);
  await expect(block).toContainText(
    new RegExp(
      fixed(copy.state.requested).replace(/\s+$/, "") +
        " \\d{1,2}(er)? \\S+ 20\\d\\d",
    ),
  );
  await expect(block.locator("a")).toHaveCount(0);

  // The agent refuses (the database writes what his door writes): the reason of the closed list, its
  // text, what to do next; asked again at once, the delay left is the real Retry-After (RG56, RG60).
  const [sent] = await brandRequestsOf(accountId);
  await refuseAsAgent(sent!.id, agent.accountId, "registration_not_found");
  await reload(page);
  const refusal = block.locator('[data-reason="registration_not_found"]');
  await expect(refusal).toContainText(
    copy.brand.refusal.reason.registration_not_found,
  );
  await expect(refusal).toContainText(copy.brand.refusal.next.fixDetails);
  await expectNothingForbidden(page, '[data-section="verification"]');
  await block.getByRole("link", { name: copy.brandBlock.cta.restart }).click();
  await page.getByRole("button", { name: copy.brand.affirm.continue }).click();
  await expect(page.locator('[data-failure="retryLater"]')).toContainText(
    /dans 24\sheures/,
  );
  expect((await brandRequestsOf(accountId))[0]?.status).toBe("rejected");

  // The badge, granted by an agent: the date complete in the sentence of RG84, on the profile and at the
  // end of the journey; the badge of the account, never one per network (RG53).
  await grantBrandAsAgent(accountId, agent.accountId, "active");
  await open(page, PROFILE.fr);
  await expect(block.locator('[data-badge="brand_verified"]')).toContainText(
    new RegExp(
      "Marque vérifiée le \\d{1,2}(er)? \\S+ 20\\d\\d — domaine et immatriculation contrôlés\\.",
    ),
  );
  await expect(block).toContainText(copy.verif.badge.brandVerified.help);
  await expect(block.locator("a")).toHaveCount(0);
  await open(page, BRAND_JOURNEY.fr);
  await expect(
    page.getByRole("heading", { name: copy.brand.done.title }),
  ).toBeVisible();
  await expect(main.getByText(/Ce badge arrive à échéance le/)).toBeVisible();
});

test("a brand asks for the badge in English at 375 px: the accordion, the domain code, the request sent, then a badge to refresh (06 RG54, RG84, RG97)", async ({
  page,
}) => {
  const copy = COPY.en.own;
  const brand = COPY.en.brand;
  await page.setViewportSize({ width: 375, height: 812 });
  const { accountId } = await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await setWebsiteDomain(accountId, "maison-e2e.example");
  const agent = await seedColleague("agent", "Noa");

  await open(page, PROFILE.en);
  await page.getByRole("button", { name: brand.section.verification }).click();
  const block = brandBlock(page);
  await expect(block).toContainText(copy.brandBlock.status.none);
  await expect(block.getByRole("link")).toHaveText(copy.brandBlock.cta.start);
  await block.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${BRAND_JOURNEY.en}$`));
  await expect(page.locator("[data-preview]")).toContainText(
    new RegExp(
      "Brand verified on \\w+ \\d{1,2}, 20\\d\\d — domain and company registration checked\\.",
    ),
  );
  await expectNothingForbidden(page);
  await page.getByRole("button", { name: copy.brand.affirm.continue }).click();
  await expect(page.locator("[data-ownership-code]")).toHaveText(
    /^INFLUX-[2-9A-HJKMNP-Z]{8}$/,
  );
  await expect(
    page.getByText(copy.brand.publish.ways.dns.title, { exact: true }),
  ).toBeVisible();
  await expectAxe(page, "brand verification, screen 2, en", [375]);
  await page.locator("#brand-legal-name").fill("Maison E2E Ltd");
  await page.locator("#brand-registration-country").selectOption("GB");
  await page.locator("#brand-registration-number").fill("01234567");
  await page.getByRole("button", { name: copy.brand.publish.submit }).click();
  await expect(
    page.getByRole("main").getByText(copy.brand.sent.body),
  ).toBeVisible();
  expect((await brandRequestsOf(accountId))[0]?.status).toBe("pending");

  // A badge past its validity is written as such, dated, with the way to refresh it (RG54, RG97).
  await grantBrandAsAgent(accountId, agent.accountId, "to_refresh");
  await open(page, PROFILE.en);
  await page.getByRole("button", { name: brand.section.verification }).click();
  await expect(block.locator('[data-badge="brand_verified"]')).toContainText(
    new RegExp(
      "Brand verified on \\w+ \\d{1,2}, 20\\d\\d — verification needs refreshing\\.",
    ),
  );
  // …and until when it stays shown, the end of its grace (RG54, l2f/textes.md)
  await expect(
    block.locator('[data-badge-notice="verif.expiry.brandToRefresh"]'),
  ).toContainText(fixed(copy.verif.expiry.brandToRefresh));
  await block.getByRole("link", { name: copy.brandBlock.cta.refresh }).click();
  await expect(
    page.getByRole("main").getByText(copy.brand.affirm.refresh),
  ).toBeVisible();
});
