// "Mes campagnes" and the campaign form (docs/mvp/17 §4.3, M3; 09 RG16 to RG85, RG108 to RG110, CA3, CA4,
// CA16, CA56, CA72, CA74, CA76; jalons/l3b, commits 09 and 10, L3B-E1 and L3B-E2): the list with its state written and its
// invitation to write behind a published profile, the first draft, the three steps saved by
// themselves, the draft taken up again after a reload deliverables included (CA72), the warnings of a
// text that block nothing, no field of file anywhere (CA16), a failed save that keeps the entry
// (RG108), in French at 375 px and in English at 1 440 px with axe. A member seeded in the local
// stack (no code, no mail); the texts are the locale files', never copies. States are prepared by the
// API's own routes, the screens being what is under test. Budget: 9 s for the four journeys of
// steps 1 to 3, 9 s for the four of the budget, the calendar and the submission (jalons/l3b annexe).
// L3B-E2: the budget of a gift only asks no band and the creator's box shows the nature and "à
// négocier" without a figure (CA76, D78), the dates in conflict are named (RG70), what is missing is
// listed by step with a way to the field (CA3), a sensitive category is refused without its box then
// accepted (CA56), a campaign submitted is "being reviewed" (CA4), a failed save keeps the entry.
import { connectAsMigrationRole } from "@influx/test-kit/db";
import type { Page } from "@playwright/test";
import enBrandProfile from "@/locales/en/brand-profile.json" with { type: "json" };
import enCampaign from "@/locales/en/campaign.json" with { type: "json" };
import enMember from "@/locales/en/member.json" with { type: "json" };
import frBrandProfile from "@/locales/fr/brand-profile.json" with { type: "json" };
import frCampaign from "@/locales/fr/campaign.json" with { type: "json" };
import frMember from "@/locales/fr/member.json" with { type: "json" };
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { expect, open, reload, test, title } from "./support/journey";
import { WEB_ORIGIN } from "./support/servers";

type Locale = "fr" | "en";

const COPY = { fr: frCampaign, en: enCampaign } as const;
const BRAND = { fr: frBrandProfile, en: enBrandProfile } as const;
const MEMBER = { fr: frMember.shell, en: enMember.shell } as const;
const LIST_PATH = { fr: "/fr/campagnes", en: "/en/campaigns" } as const;

const SUMMARY =
  "Nous cherchons des créateurs de contenu beauté pour tester notre nouvelle gamme de soins du visage sur Instagram, avec des contenus sincères, courts et soignés.";
const BRIEF =
  "Notre gamme de soins du visage sort en janvier. Nous voulons des vidéos courtes où le créateur essaie les produits pendant une semaine, raconte ce qu'il observe, montre sa routine du matin et du soir, et donne un avis honnête. Le ton est chaleureux, sans promesse excessive. Les produits restent libres de mise en scène, le créateur choisit son décor et son angle, tant que les gestes d'application sont visibles et que le nom de la gamme est cité une fois.";
const PRODUCT =
  "Une gamme de trois soins du visage naturels, testés dermatologiquement.";

/** The status line that tells the draft is saved (RG108); two twins exist, one shown at each width. */
function savedLine(page: Page, locale: Locale) {
  return page.locator("p[role=status]:visible", {
    hasText: COPY[locale].save.saved.split("{")[0]?.trim(),
  });
}

/** What the autosave has stored of the campaign: the base, not the status line, tells it is there. */
async function storedCampaignOf(accountId: string): Promise<{
  title: string | null;
  status: string;
  deliverables: number;
  band: string | null;
  nature: string | null;
  budgetBand: string | null;
  declared: boolean;
} | null> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const [row] = await sql<
      {
        title: string | null;
        status: string;
        deliverables: number;
        band: string | null;
        nature: string | null;
        budgetBand: string | null;
        declared: boolean;
      }[]
    >`
      select c.title, c.status::text as status,
             (select count(*)::int from campaigns.campaign_deliverables d where d.campaign_id = c.id) as deliverables,
             c.product_value_band_code as band,
             c.remuneration_kind::text as nature,
             c.per_creator_budget_band_code as "budgetBand",
             (c.authorizations_declared_at is not null) as declared
        from campaigns.campaigns c
       where c.advertiser_account_id = ${accountId}
       order by c.created_at desc limit 1`;
    return row ?? null;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** The state a review would leave the profile in: the agents' decision is L2C's, the base is written here. */
async function publishProfile(accountId: string): Promise<void> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    await sql`
      update profiles.advertiser_profiles
         set status = 'published', submitted_at = now(), first_published_at = now()
       where account_id = ${accountId}`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** What a page's own script sends, which a request of the test runner does not (03 §6.4 A4). */
const SAME_ORIGIN = { origin: WEB_ORIGIN, "sec-fetch-site": "same-origin" };

/** A draft written through the API itself, as the form does: the page asks it as the member's own session. */
async function draftThroughApi(
  page: Page,
  fields: Record<string, unknown>,
): Promise<string> {
  const created = await page.request.post("/api/v1/me/campaigns", {
    data: {},
    headers: SAME_ORIGIN,
  });
  expect(created.status()).toBe(200);
  const id = ((await created.json()) as { id: string }).id;
  if (Object.keys(fields).length > 0) {
    const saved = await page.request.patch(`/api/v1/me/campaigns/${id}`, {
      data: fields,
      headers: SAME_ORIGIN,
    });
    expect(saved.status()).toBe(200);
  }
  return id;
}

/** The words of "nothing left to complete" in a step (the `=0` case of `form.stepMissing`). */
function allSet(locale: Locale): string {
  return /=0 {([^}]+)}/.exec(COPY[locale].form.stepMissing)?.[1] ?? "";
}

/** A campaign written up to step 3 (the brief and the topics lacking at will), through the API itself. */
function wholeOffer(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    title: "Test de notre nouvelle gamme de soins",
    campaignType: "product_review",
    publicSummary: SUMMARY,
    brief: BRIEF,
    productDescription: PRODUCT,
    productSector: "beauty_personal_care",
    productIsSent: true,
    currency: "EUR",
    productValueBand: "100_250",
    creatorKeepsProduct: true,
    shippingCostsBorneBy: "brand",
    deliverables: [
      { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
    ],
    usageRights: "organic_repost",
    usageRightsDuration: "3m",
    usageRightsTerritoryScope: "worldwide",
    exclusivity: "le_1m",
    contentReviewDelay: "5bd",
    audienceCountries: ["FR"],
    audienceLanguages: ["fr"],
    audienceTopics: ["beauty"],
    ...overrides,
  };
}

/** The budget and the calendar of step 4 and 5, written through the API. */
const WHOLE_BUDGET_AND_CALENDAR = {
  remunerationKind: "cash",
  budgetBand: "1000_2500",
  creatorsWanted: 3,
  applicationsCloseOn: "2027-02-10",
  contentDueOn: "2027-02-20",
  startsOn: "2027-03-01",
  endsOn: "2027-04-01",
};

async function noFileField(page: Page): Promise<void> {
  // CA16, RG45: nothing attached to a campaign, no button of file anywhere on the page.
  await expect(page.locator("input[type=file]")).toHaveCount(0);
}

test("my campaigns: the invitation to write waits for a published profile, then the first draft opens on its first step (CA2, CA74, 17 §2.4, D74)", async ({
  page,
}) => {
  const copy = COPY.fr;
  await page.setViewportSize({ width: 1440, height: 900 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });

  // Draft profile: the sentence that says so, the way to the profile, no button to create.
  await open(page, LIST_PATH.fr);
  await expect(title(page)).toHaveText(copy.list.title);
  const main = page.locator("main");
  await expect(main.getByText(copy.publish.profileRequired)).toBeVisible();
  await expect(
    main.getByRole("link", { name: copy.list.profileLink }),
  ).toBeVisible();
  await expect(
    main.getByRole("button", { name: copy.list.create }),
  ).toHaveCount(0);
  await expect(main.getByText(copy.list.empty.title)).toBeVisible();
  // D74: "Campagnes" is an entry of the column, active here; no tab, no pill, a single navigation.
  const nav = page.getByRole("navigation", { name: MEMBER.fr.nav.label });
  await expect(
    nav.getByRole("link", {
      name: MEMBER.fr.nav.entries.campaigns,
      exact: true,
    }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.locator("nav")).toHaveCount(1);
  await expectNoAxeViolation(page, "my campaigns, fr, 1440", { wcag22: true });

  // Published profile: the home card is no longer locked, the list offers to create.
  await publishProfile(member.accountId);
  await open(page, "/fr/marque");
  await expect(
    page.getByRole("heading", { name: copy.home.title }),
  ).toBeVisible();
  await expect(page.getByText(BRAND.fr.home.locked.campaign.text)).toHaveCount(
    0,
  );
  await page.getByRole("link", { name: copy.home.link }).click();
  await expect(title(page)).toHaveText(copy.list.title);
  await expect(page.getByText(copy.publish.profileRequired)).toHaveCount(0);
  await page.getByRole("button", { name: copy.list.create }).click();

  // The first draft: its own address, the state written, the first step, nothing saved yet but the draft.
  await expect(page).toHaveURL(/\/fr\/campagnes\/[0-9a-f-]{36}$/);
  await expect(title(page)).toHaveText(copy.form.newTitle);
  await expect(
    page.getByRole("heading", { level: 2, name: copy.form.steps["1"].title }),
  ).toBeVisible();
  await expect(
    page.getByText(
      copy.form.step.replace("{step}", "1").replace("{total}", "5"),
    ),
  ).toBeVisible();
  await expect(
    page.getByText(copy.status.label.draft, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(copy.status.draft)).toBeVisible();
  await noFileField(page);
  expect((await storedCampaignOf(member.accountId))?.status).toBe("draft");
});

test("the offer, the work expected and the audience, in French at 375 px: saved by themselves, taken up again after a reload with the deliverables, warnings that block nothing (RG108, CA72, RG21 to RG23)", async ({
  page,
}) => {
  const copy = COPY.fr;
  await page.setViewportSize({ width: 375, height: 800 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await publishProfile(member.accountId);
  const id = await draftThroughApi(page, {
    title: "Test de notre nouvelle gamme de soins",
    campaignType: "product_review",
    publicSummary: SUMMARY,
    productDescription: PRODUCT,
    productSector: "beauty_personal_care",
  });
  await open(page, `/fr/campagnes/${id}`);
  await expect(page.locator("#campaign-title")).toHaveValue(
    "Test de notre nouvelle gamme de soins",
  );

  // Step 1: the brief, with a warning that blocks nothing (the bounds told, the text kept as typed).
  await page
    .locator("#campaign-brief")
    .fill(
      `${BRIEF} Écrivez-nous à partenariats@marque.com ou sur https://marque.example/offre pour 500 €.`,
    );
  for (const kind of ["contactInText", "linkInText", "amountInText"] as const) {
    await expect(page.getByText(copy.errors[kind])).toBeVisible();
  }
  await expect(page.locator("#campaign-brief")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.locator("#campaign-brief").fill(BRIEF);
  await expect(page.getByText(copy.errors.contactInText)).toHaveCount(0);

  // Block 2: the product, a product sent with its currency and its band (a band, never an amount).
  await page
    .locator("#campaign-keyMessages")
    .fill("Une routine simple en deux gestes");
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.productIsSent.label),
    })
    .getByLabel(frBrandProfile.field.yes)
    .check();
  await page.locator("#campaign-currency").selectOption("EUR");
  await page.locator("#campaign-productValueBand").selectOption("100_250");
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.creatorKeepsProduct.label),
    })
    .getByLabel(frBrandProfile.field.yes)
    .check();
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.shippingCostsBorneBy.label),
    })
    .getByLabel(copy.shipping.brand)
    .check();
  await page.locator("#campaign-internalReference").fill("Janvier-2027");
  await noFileField(page);
  await expectNoAxeViolation(page, "campaign step 1, fr, 375", {
    wcag22: true,
  });

  // Step 2: the deliverables, two lines, then the rights; a line half entered stays on screen, never sent.
  await page.getByRole("button", { name: copy.form.next }).click();
  await expect(page).toHaveURL(/\?step=2$/);
  await expect(
    page.getByRole("heading", { level: 2, name: copy.form.steps["2"].title }),
  ).toBeFocused();
  await page.locator("#campaign-deliverables").selectOption("instagram");
  await page
    .locator("#campaign-deliverables-format")
    .selectOption("instagram_reel");
  await page.locator("#campaign-deliverables-quantity").selectOption("2");
  await page.getByRole("button", { name: copy.field.addLine }).click();
  await page.locator("#campaign-deliverables-2").selectOption("tiktok");
  await page
    .locator("#campaign-deliverables-2-format")
    .selectOption("tiktok_video");
  await page.getByRole("button", { name: copy.field.addLine }).click();
  await page.locator("#campaign-deliverables-3").selectOption("youtube");
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.usageRights.label),
    })
    .getByLabel(copy.usage_right.organic_repost)
    .check();
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.usageRightsDuration.label),
    })
    .getByLabel(copy.usage_duration["3m"])
    .check();
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.usageRightsTerritoryScope.label),
    })
    .getByLabel(copy.usage_territory.worldwide)
    .check();
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.exclusivity.label),
    })
    .getByLabel(frBrandProfile.exclusivity.le_1m)
    .check();
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.contentReviewDelay.label),
    })
    .getByLabel(copy.review_delay["5bd"])
    .check();
  await expect(savedLine(page, "fr")).toBeVisible();
  await noFileField(page);

  // CA72: the reload comes back to the step, with the two complete lines of deliverables.
  await reload(page);
  await expect(
    page.getByRole("heading", { level: 2, name: copy.form.steps["2"].title }),
  ).toBeVisible();
  await expect(page.locator("#campaign-deliverables")).toHaveValue("instagram");
  await expect(page.locator("#campaign-deliverables-format")).toHaveValue(
    "instagram_reel",
  );
  await expect(page.locator("#campaign-deliverables-quantity")).toHaveValue(
    "2",
  );
  await expect(page.locator("#campaign-deliverables-2")).toHaveValue("tiktok");
  await expect(page.locator("#campaign-deliverables-3")).toHaveCount(0);
  const stored = await storedCampaignOf(member.accountId);
  expect(stored?.deliverables).toBe(2);
  expect(stored?.band).toBe("100_250");

  // Step 3: for whom.
  await page.getByRole("button", { name: copy.form.next }).click();
  await page
    .locator("#campaign-audienceCountries")
    .selectOption({ label: "France" });
  await page
    .locator("#campaign-audienceLanguages")
    .selectOption({ label: "français" });
  const topics = page.getByRole("group", {
    name: new RegExp(copy.fields.audienceTopics.label),
  });
  await topics
    .getByLabel(frBrandProfile.reference.topic.beauty, { exact: true })
    .check();
  await topics
    .getByLabel(frBrandProfile.reference.topic.wellness, { exact: true })
    .check();
  await expect(savedLine(page, "fr")).toBeVisible();
  await noFileField(page);

  // The steps tell what is left in each, from the API's own count: steps 1 to 3 are complete.
  await page.locator("summary").click();
  await expect(
    page.getByText(allSet("fr")).filter({ visible: true }),
  ).toHaveCount(3);
});

test("the form in English at 1 440 px: a campaign taken up where it was left, a type that needs rights refused with its words, axe (RG43)", async ({
  page,
}) => {
  const copy = COPY.en;
  await page.setViewportSize({ width: 1440, height: 900 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await publishProfile(member.accountId);
  const id = await draftThroughApi(page, {
    title: "A trial of our new skincare range",
    audienceCountries: ["FR"],
    audienceTopics: ["beauty"],
    usageRights: "none",
  });

  // The campaign as it was left: step 3 from the address, the saved fields in place.
  await open(page, `/en/campaigns/${id}?step=3`);
  await expect(title(page)).toHaveText("A trial of our new skincare range");
  await expect(
    page.getByRole("heading", { level: 2, name: copy.form.steps["3"].title }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp("France") }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("group", {
        name: new RegExp(copy.fields.audienceTopics.label),
      })
      .getByLabel(enBrandProfile.reference.topic.beauty, { exact: true }),
  ).toBeChecked();
  await noFileField(page);
  await expectNoAxeViolation(page, "campaign step 3, en, 1440", {
    wcag22: true,
  });

  // The steps are free: back to step 1, then a type that needs usage rights over rights that are none (RG43).
  await page
    .getByRole("button", { name: new RegExp(copy.form.steps["1"].title) })
    .click();
  await page
    .locator("#campaign-campaignType")
    .selectOption({ label: copy.campaign_type.ugc_delivered });
  await expect(
    page.getByText(copy.fieldErrors.ugcRequiresRights).first(),
  ).toBeVisible();
  await expect(page.locator("#campaign-campaignType")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  // settled by the rights, in the other step: sent again with the next save
  await page
    .getByRole("button", { name: new RegExp(copy.form.steps["2"].title) })
    .click();
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.usageRights.label),
    })
    .getByLabel(copy.usage_right.organic_repost)
    .check();
  await expect(savedLine(page, "en")).toBeVisible();
  await page
    .getByRole("button", { name: new RegExp(copy.form.steps["1"].title) })
    .click();
  await expect(page.locator("#campaign-campaignType")).toHaveValue(
    "ugc_delivered",
  );
  await expect(page.getByText(copy.fieldErrors.ugcRequiresRights)).toHaveCount(
    0,
  );
});

test("a save that fails keeps the entry on screen and says so, then goes through on the new attempt (RG108)", async ({
  page,
}) => {
  const copy = COPY.fr;
  await page.setViewportSize({ width: 1440, height: 900 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await publishProfile(member.accountId);
  const id = await draftThroughApi(page, {});
  await open(page, `/fr/campagnes/${id}`);

  const route = `**/api/v1/me/campaigns/${id}`;
  await page.route(route, (call) =>
    call.request().method() === "PATCH"
      ? call.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "service_unavailable", message: "unavailable" },
          }),
        })
      : call.continue(),
  );
  const typed = "Un titre qui ne doit pas se perdre";
  await page.locator("#campaign-title").fill(typed);
  await expect(page.getByText(copy.save.failedTitle)).toBeVisible();
  await expect(page.getByText(copy.save.failedText)).toBeVisible();
  await expect(page.locator("#campaign-title")).toHaveValue(typed);
  expect((await storedCampaignOf(member.accountId))?.title).toBeNull();
  await page.unroute(route);
  await page.getByRole("button", { name: copy.save.retryNow }).click();
  await expect(savedLine(page, "fr")).toBeVisible();
  await expect(page.getByText(copy.save.failedTitle)).toHaveCount(0);
  expect((await storedCampaignOf(member.accountId))?.title).toBe(typed);
});

test("the budget, the calendar and the submission in French at 1 440 px: a gift only asks no band, the creator's box shows no figure, dates in conflict are named, a whole campaign is submitted (CA76, RG70, CA4, D78)", async ({
  page,
}) => {
  const copy = COPY.fr;
  await page.setViewportSize({ width: 1440, height: 900 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await publishProfile(member.accountId);
  const id = await draftThroughApi(page, wholeOffer());
  await open(page, `/fr/campagnes/${id}?step=4`);
  await expect(
    page.getByRole("heading", { level: 2, name: copy.form.steps["4"].title }),
  ).toBeVisible();

  // The band is told before it is chosen (CA37), in the box that says it is never published.
  const internal = page.locator("[data-internal-box]");
  await expect(internal.getByText(copy.budget.internalPilot)).toBeVisible();
  await expect(internal.getByText(copy.budget.bandBrand)).toBeVisible();
  const nature = (label: string) =>
    page
      .getByRole("radiogroup", {
        name: new RegExp(copy.fields.remunerationKind.label),
      })
      .getByLabel(label, { exact: true });

  // A gift only asks no band (CA76); the creator's box shows the nature and "to negotiate", no figure.
  await nature(copy.remuneration.gift_only).check();
  await expect(page.locator("#campaign-budgetBand")).toHaveCount(0);
  await expect(internal.getByText(copy.budget.giftOnly)).toBeVisible();
  const creatorBox = page.locator("[data-creator-box]");
  await expect(
    creatorBox.getByText(
      copy.budget.creatorNature.replace("{kind}", copy.remuneration.gift_only),
    ),
  ).toBeVisible();
  await expect(creatorBox.getByText(copy.budget.negotiate)).toBeVisible();
  await expect
    .poll(async () => (await storedCampaignOf(member.accountId))?.nature)
    .toBe("gift_only");
  expect((await storedCampaignOf(member.accountId))?.budgetBand).toBeNull();

  // Back to cash: the band is asked, chosen from the grid of the currency, and the box still shows none.
  await nature(copy.remuneration.cash).check();
  await page.locator("#campaign-budgetBand").selectOption("1000_2500");
  await page.locator("#campaign-creatorsWanted").fill("3");
  await expect(creatorBox).not.toContainText("1\u202f000");
  await expect(creatorBox).not.toContainText("EUR");
  await expect
    .poll(async () => (await storedCampaignOf(member.accountId))?.budgetBand)
    .toBe("1000_2500");
  await noFileField(page);
  await expectNoAxeViolation(page, "campaign step 4, fr, 1440", {
    wcag22: true,
  });

  // Step 5: a start before the deadline names the two dates in conflict, and is kept on screen.
  await page.getByRole("button", { name: copy.form.next }).click();
  await expect(page.locator("#campaign-applicationsCloseOn")).toBeVisible();
  await page.locator("#campaign-applicationsCloseOn").fill("2027-02-10");
  await page.locator("#campaign-contentDueOn").fill("2027-02-20");
  await page.locator("#campaign-startsOn").fill("2027-02-01");
  const conflict = copy.errors.datesOrder
    .replace("{first}", copy.fields.applicationsCloseOn.label)
    .replace(
      "{second}",
      copy.fields.startsOn.label.replace(/^./u, (letter) =>
        letter.toLowerCase(),
      ),
    );
  await expect(page.getByText(conflict).first()).toBeVisible();
  await expect(page.locator("#campaign-startsOn")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#campaign-startsOn")).toHaveValue("2027-02-01");
  // no switch "verified profiles only" (RG79), no field of file
  await expect(page.getByLabel(/profils vérifiés/iu)).toHaveCount(0);

  // The dates put in order: the refusal is lifted and they are saved together.
  await page.locator("#campaign-startsOn").fill("2027-03-01");
  await page.locator("#campaign-endsOn").fill("2027-04-01");
  await expect(page.getByText(conflict)).toHaveCount(0);
  await expect(page.locator("#campaign-startsOn")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );

  // Submit: nothing is missing, the campaign is "being reviewed" and no longer editable (CA4, RG5).
  const panel = page.locator("[data-submit-panel]");
  await expect(panel.getByText(copy.publish.ready)).toBeVisible();
  await panel.getByRole("button", { name: copy.publish.button }).click();
  await expect(page.getByText(copy.publish.submittedTitle)).toBeVisible();
  await expect(
    page.getByText(copy.status.label.pending_review, { exact: true }),
  ).toBeVisible();
  await expect(panel).toHaveCount(0);
  expect((await storedCampaignOf(member.accountId))?.status).toBe(
    "pending_review",
  );
});

test("a submission names what is missing, step by step, with a way to each field, in English at 375 px (CA3, RG4)", async ({
  page,
}) => {
  const copy = COPY.en;
  await page.setViewportSize({ width: 375, height: 800 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await publishProfile(member.accountId);
  const id = await draftThroughApi(
    page,
    wholeOffer({ brief: null, audienceTopics: [] }),
  );
  await open(page, `/en/campaigns/${id}?step=5`);
  const panel = page.locator("[data-submit-panel]");

  // The button is always there and never disabled; the sentence says how much is missing.
  const button = panel.getByRole("button", { name: copy.publish.button });
  await expect(button).toBeVisible();
  await expect(button).not.toHaveAttribute("aria-disabled", "true");
  await expect(
    panel.getByText(
      /pieces of information are missing to submit your campaign/u,
    ),
  ).toBeVisible();

  // A click names them by step and takes the focus to the first one, in the step that holds it.
  await button.click();
  await expect(page).toHaveURL(/\?step=1$/);
  await expect(page.locator("#campaign-brief")).toBeFocused();
  await expect(panel.getByText(copy.publish.listTitle)).toBeVisible();
  for (const key of ["brief", "audienceTopics", "remunerationKind"] as const) {
    await expect(
      panel.getByRole("button", { name: copy.fields[key].label }),
    ).toBeVisible();
  }
  await expect(page.locator("#campaign-brief")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expectNoAxeViolation(page, "campaign submit list, en, 375", {
    wcag22: true,
  });

  // A name in the list is a way to its field, in another step.
  await panel
    .getByRole("button", { name: copy.fields.audienceTopics.label })
    .click();
  await expect(page).toHaveURL(/\?step=3$/);
  await expect(page.locator("#campaign-audienceTopics")).toBeFocused();
  expect((await storedCampaignOf(member.accountId))?.status).toBe("draft");
});

test("a sensitive category is refused without its declaration, then accepted once the box is ticked, never pre-ticked (CA56, RG85)", async ({
  page,
}) => {
  const copy = COPY.fr;
  await page.setViewportSize({ width: 1440, height: 900 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await publishProfile(member.accountId);
  const id = await draftThroughApi(
    page,
    wholeOffer({
      productSector: "alcohol",
      productIsSent: false,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
      ...WHOLE_BUDGET_AND_CALENDAR,
    }),
  );
  await open(page, `/fr/campagnes/${id}?step=5`);
  const panel = page.locator("[data-submit-panel]");
  await expect(panel.getByText(copy.publish.sensitiveNotice)).toBeVisible();
  const box = panel.getByRole("checkbox");
  await expect(box).not.toBeChecked();

  await panel.getByRole("button", { name: copy.publish.button }).click();
  await expect(panel.getByText(copy.publish.declarationRequired)).toBeVisible();
  await expect(box).toBeFocused();
  expect((await storedCampaignOf(member.accountId))?.status).toBe("draft");

  await box.check();
  await panel.getByRole("button", { name: copy.publish.button }).click();
  await expect(page.getByText(copy.publish.submittedTitle)).toBeVisible();
  const stored = await storedCampaignOf(member.accountId);
  expect(stored?.status).toBe("pending_review");
  expect(stored?.declared).toBe(true);
});

test("a save that fails on the budget keeps the entry on screen and says so, then goes through on the new attempt (RG108)", async ({
  page,
}) => {
  const copy = COPY.fr;
  await page.setViewportSize({ width: 1440, height: 900 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await publishProfile(member.accountId);
  const id = await draftThroughApi(page, wholeOffer());
  await open(page, `/fr/campagnes/${id}?step=4`);

  const route = `**/api/v1/me/campaigns/${id}`;
  await page.route(route, (call) =>
    call.request().method() === "PATCH"
      ? call.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: { code: "service_unavailable", message: "unavailable" },
          }),
        })
      : call.continue(),
  );
  await page.locator("#campaign-creatorsWanted").fill("4");
  await expect(page.getByText(copy.save.failedTitle)).toBeVisible();
  await expect(page.locator("#campaign-creatorsWanted")).toHaveValue("4");
  await page.unroute(route);
  await page.getByRole("button", { name: copy.save.retryNow }).click();
  await expect(page.getByText(copy.save.failedTitle)).toHaveCount(0);
  await expect(savedLine(page, "fr")).toBeVisible();
  await page.reload();
  await expect(page.locator("#campaign-creatorsWanted")).toHaveValue("4");
});
