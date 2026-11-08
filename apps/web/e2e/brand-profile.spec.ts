// "Mon profil de marque" (docs/mvp/17 §4.2, M2; 06 RG3, RG5, RG17, RG83 to RG85, CA1, CA2, CA4, CA6,
// CA7, CA39, CA44, CA46, CA47; jalons/l2b, commit 11): blocks 1 to 3 saved by themselves, the score
// and the missing fields by name, the submission, in French at 1 440 px and in English at 375 px
// (accordion, action bar), and a creator who finds its own profile, never the brand's (18 T14.3; inverted at L2D). A member seeded in the
// local stack (no code, no mail); the texts are the locale files', never copies.
import { connectAsMigrationRole } from "@influx/test-kit/db";
import type { Page, Route } from "@playwright/test";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import frCreatorProfile from "@/locales/fr/creator-profile.json" with { type: "json" };
import enBrandProfile from "@/locales/en/brand-profile.json" with { type: "json" };
import frBrandProfile from "@/locales/fr/brand-profile.json" with { type: "json" };
import enAuth from "@/locales/en/auth.json" with { type: "json" };
import enMember from "@/locales/en/member.json" with { type: "json" };
import frAuth from "@/locales/fr/auth.json" with { type: "json" };
import frMember from "@/locales/fr/member.json" with { type: "json" };
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { expect, open, reload, test, title } from "./support/journey";

const COPY = { fr: frBrandProfile, en: enBrandProfile } as const;

/** The status line that tells the draft is saved (RG83); the bar of a phone holds its own twin. */
function savedLine(page: Page, locale: "fr" | "en") {
  const copy = COPY[locale];
  return page.locator("p[role=status]:visible", {
    hasText: copy.save.saved.split("{")[0]?.trim(),
  });
}

async function profileStatus(accountId: string): Promise<string> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const [row] = await sql<{ status: string }[]>`
      select status::text as status from profiles.advertiser_profiles
       where account_id = ${accountId}`;
    return row?.status ?? "none";
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** What the autosave has stored of the draft (06 RG83): the base, not the status line, tells it is there. */
async function storedBrandOf(accountId: string): Promise<{
  sector: string | null;
  website: string | null;
  topics: string[];
  role: string | null;
}> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const [row] = await sql<
      {
        sector: string | null;
        website: string | null;
        topics: string[];
        role: string | null;
      }[]
    >`
      select p.primary_sector_code as sector, p.website_domain as website,
             coalesce((select array_agg(t.topic_code order by t.topic_code)
                         from profiles.advertiser_topics t
                        where t.account_id = p.account_id), '{}') as topics,
             p.contact_role as role
        from profiles.advertiser_profiles p
       where p.account_id = ${accountId}`;
    if (row === undefined) {
      throw new Error("the seeded brand has no profile");
    }
    return row;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

test("a brand fills its profile in French at 1 440 px: layers, caps, missing fields, autosave, reload, submission", async ({
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
  await open(page, "/fr/compte/profil");
  await expect(title(page)).toHaveText(copy.page.title);

  // CA47: the state is written, with what it allows; CA1: the name of the sign-up is there.
  await expect(
    page.getByText(copy.state.label.replace("{state}", copy.state.draft)),
  ).toBeVisible();
  await expect(page.getByText(copy.statusText.draft)).toBeVisible();
  await expect(
    page.getByLabel(new RegExp(copy.fields.companyName.label)),
  ).toHaveValue("Maison E2E");

  // CA2: neither the sign-in address, nor the country, nor the language is asked again.
  await expect(
    page.getByRole("combobox", { name: copy.fields.country.label }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel(/langue de communication|connexion/i),
  ).toHaveCount(0);

  // CA39: every field says who sees it, by an icon AND a text.
  const publicBadges = page.getByText(copy.layer.public, { exact: true });
  expect(await publicBadges.count()).toBeGreaterThanOrEqual(16);
  await expect(
    page.getByText(copy.layer.revealed, { exact: true }),
  ).toHaveCount(1);
  // three internal fields of block 3, plus the label of block 4 (L2E, commit 20: the verification)
  await expect(
    page.getByText(copy.layer.internal, { exact: true }),
  ).toHaveCount(4);
  for (const badge of await page
    .getByText(copy.layer.internal, { exact: true })
    .all()) {
    await expect(badge.locator("svg")).toHaveCount(1);
  }
  await expectNoAxeViolation(page, "mon profil de marque, fr, 1440", {
    wcag22: true,
  });

  // CA7: the missing fields are named, and a click on the button focuses the first one.
  await expect(page.getByText(/Il manque 10 informations/)).toBeVisible();
  await page.getByRole("button", { name: copy.submit.label }).click();
  await expect(page.locator("#brand-profile-primarySector")).toBeFocused();
  await expect(page.getByText(copy.fieldErrors.required).first()).toBeVisible();

  // Block 1.
  await page
    .getByLabel(/^Secteur principal/)
    .selectOption({ label: copy.reference.sector.beauty_personal_care });
  await page
    .getByRole("radiogroup", {
      name: new RegExp(copy.fields.companySize.label),
    })
    .getByLabel(copy.companySize["11_50"])
    .check();
  await page.getByLabel(/^Marchés visés/).selectOption({ label: "France" });
  await expect(
    page.getByRole("button", { name: "Retirer France" }).first(),
  ).toBeVisible();
  await page
    .getByRole("group", {
      name: new RegExp(copy.fields.workingLanguages.label),
    })
    .getByLabel(copy.workingLanguage.fr)
    .check();
  // CA4: a full address is reduced to its domain, and the screen says where a contact page goes.
  await page
    .getByLabel(new RegExp(`^${copy.fields.website.label}`))
    .fill("https://exemple.com/contact?utm=abc");
  await expect(
    page.getByText(copy.website.normalized.replace("{domain}", "exemple.com")),
  ).toBeVisible();
  await expect(
    page.getByLabel(new RegExp(`^${copy.fields.website.label}`)),
  ).toHaveValue("exemple.com");
  await page
    .getByLabel(new RegExp(`^${copy.fields.presentation.label}`))
    .fill(
      "Une marque de cosmétiques naturels qui cherche des créateurs sincères pour raconter ses produits au quotidien, avec des formats courts, un ton chaleureux et des collaborations suivies sur plusieurs mois.",
    );

  // Block 2: the cap of three topics is told, and a fourth is refused, never replaced.
  const topics = page.getByRole("group", {
    name: new RegExp(copy.fields.topics.label),
  });
  for (const code of ["beauty", "fashion", "food"] as const) {
    await topics
      .getByLabel(copy.reference.topic[code], { exact: true })
      .check();
  }
  await expect(topics.getByText(copy.field.limitReached)).toBeVisible();
  await topics
    .getByLabel(copy.reference.topic.travel, { exact: true })
    .click({ force: true });
  await expect(
    topics.getByLabel(copy.reference.topic.travel, { exact: true }),
  ).not.toBeChecked();
  await topics.getByLabel(copy.reference.topic.food, { exact: true }).uncheck();
  await page
    .getByRole("group", { name: new RegExp(copy.fields.networks.label) })
    .getByLabel(copy.reference.network.instagram)
    .check();
  await page
    .getByRole("group", { name: new RegExp(copy.fields.formats.label) })
    .getByLabel(copy.reference.format.instagram_reel)
    .check();
  await page
    .getByLabel(/^Pays d'audience visés/)
    .selectOption({ label: "France" });

  // Block 3.
  await page
    .getByLabel(/^Fonction/)
    .selectOption({ label: copy.contactRole.marketing });

  // RG83: it saves by itself; CA44: closed and reopened, the draft is there.
  // The line stays shown from an earlier save while the last field waits for its own (SAVE_DELAY_MS),
  // so the stored state is what is awaited before the reload (L2DT-1).
  await expect(savedLine(page, "fr")).toBeVisible();
  await expect
    .poll(async () => await storedBrandOf(member.accountId))
    .toEqual({
      sector: "beauty_personal_care",
      website: "exemple.com",
      topics: ["beauty", "fashion"],
      role: "marketing",
    });
  await reload(page);
  await expect(page.getByLabel(/^Secteur principal/)).toHaveValue(
    "beauty_personal_care",
  );
  await expect(
    page.getByLabel(new RegExp(`^${copy.fields.website.label}`)),
  ).toHaveValue("exemple.com");
  await expect(
    page
      .getByRole("group", { name: new RegExp(copy.fields.topics.label) })
      .getByLabel(copy.reference.topic.fashion, { exact: true }),
  ).toBeChecked();
  await expect(page.getByText(copy.progress.allSet)).toBeVisible();

  // CA6: complete, it is submitted, written, and visible of no creator.
  await page.getByRole("button", { name: copy.submit.label }).click();
  await expect(page.getByText(copy.submit.done)).toBeVisible();
  await expect(
    page.getByText(
      copy.state.label.replace("{state}", copy.state.pending_review),
    ),
  ).toBeVisible();
  expect(await profileStatus(member.accountId)).toBe("pending_review");
});

test("a brand on a phone in English: accordion, action bar, first missing field opened and focused, no French left", async ({
  page,
}) => {
  const copy = COPY.en;
  await page.setViewportSize({ width: 375, height: 800 });
  await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await open(page, "/en/account/profile");
  await expect(title(page)).toHaveText(copy.page.title);
  await expect(
    page.getByText(copy.state.label.replace("{state}", copy.state.draft)),
  ).toBeVisible();

  // One block open at a time: the identity first, the others out of sight.
  await expect(page.getByLabel(/^Main sector/)).toBeVisible();
  await expect(page.getByLabel(/^Role/)).toBeHidden();
  await page.getByRole("button", { name: copy.section.contact }).click();
  await expect(page.getByLabel(/^Role/)).toBeVisible();
  await expect(page.getByLabel(/^Main sector/)).toBeHidden();
  await expect(
    page.getByRole("button", { name: copy.section.contact }),
  ).toHaveAttribute("aria-expanded", "true");
  await expectNoAxeViolation(page, "my brand profile, en, 375", {
    wcag22: true,
  });

  // CA7 on a phone: the bar submits, the block of the first missing field opens, the field is focused.
  await expect(
    page.getByRole("button", { name: copy.submit.label }),
  ).toBeVisible();
  await page.getByRole("button", { name: copy.submit.label }).click();
  await expect(page.locator("#brand-profile-primarySector")).toBeFocused();
  await expect(
    page.getByRole("button", { name: copy.section.identity }),
  ).toHaveAttribute("aria-expanded", "true");

  // CA46: not a word of French among the texts of the screen.
  const shown = (await page.locator("main").innerText()).toLowerCase();
  const french = [
    frBrandProfile.state.draft,
    frBrandProfile.statusText.draft,
    frBrandProfile.section.identity,
    frBrandProfile.submit.label,
    frBrandProfile.save.idle,
    frBrandProfile.fields.primarySector.label,
    frBrandProfile.layer.public,
  ];
  for (const text of french) {
    expect(shown, text).not.toContain(text.toLowerCase());
  }
});

// Inverted at L2D (commit 12): a creator used to find a page that does not exist at this address
// (18 T14.3); the address now holds its own profile, and still nothing of the brand's.
test("a creator finds its own profile, never the brand's: in its column, at the same address (18 T14.3, 17 §5.2)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await open(page, "/fr/compte");
  await expect(
    page.getByRole("link", { name: "Profil de marque" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: frCreatorProfile.page.title }).first(),
  ).toBeVisible();
  await open(page, "/fr/compte/profil");
  await expect(title(page)).toHaveText(frCreatorProfile.page.title);
  await expect(page.getByLabel(/^Secteur principal/)).toHaveCount(0);
});

const LOGO_FIXTURE = fileURLToPath(
  new URL("../../api/tests/fixtures/logo-geotagged.jpg", import.meta.url),
);
const LOGO_ROUTE = "**/api/v1/me/brand-profile/logo";

function errorEnvelope(
  code: string,
  status: number,
  issue?: string,
): Parameters<Route["fulfill"]>[0] {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify({
      error: {
        code,
        message: "test",
        requestId: "00000000-0000-4000-8000-000000000000",
        ...(issue === undefined ? {} : { details: [{ path: "logo", issue }] }),
      },
    }),
  };
}

test("a brand deposits its logo in French at 1 440 px: raw bytes without a name, server preview, score, removal (06 RG15, D80)", async ({
  page,
}) => {
  const copy = COPY.fr;
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  const puts: Record<string, string>[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith("/logo")) {
      void request.allHeaders().then((headers) => puts.push(headers));
    }
  });
  await open(page, "/fr/compte/profil");
  await expect(page.getByText(copy.logo.none)).toBeVisible();
  // The formats and the size are told before the choice.
  await expect(page.getByText(/PNG, JPEG ou WebP, 2 Mo au plus/)).toBeVisible();
  const meter = page
    .getByRole("meter", { name: copy.completeness.label })
    .first();
  const scoreNow = async () =>
    Number(await meter.getAttribute("aria-valuenow"));
  const before = await scoreNow();

  await page.locator("input[type=file]").setInputFiles(LOGO_FIXTURE);
  const preview = page.getByRole("img", { name: copy.logo.alt });
  await expect(preview).toBeVisible();
  await expect(page.getByText(copy.logo.status.uploaded)).toBeVisible();
  expect(await preview.getAttribute("src")).toMatch(
    /^data:image\/webp;base64,/,
  );
  // The file leaves as raw bytes: no declared type, and its name nowhere, sent or shown.
  expect(puts).toHaveLength(1);
  expect(puts[0]?.["content-type"]).toBe("application/octet-stream");
  expect(puts[0]?.["content-length"]).toBe(String(statSync(LOGO_FIXTURE).size));
  expect(JSON.stringify(puts[0])).not.toContain("geotagged");
  expect(await page.locator("main").innerText()).not.toContain("geotagged");
  // RG58: the score is the API's and moved with the logo.
  await expect.poll(scoreNow).toBeGreaterThan(before);
  await expectNoAxeViolation(page, "mon profil de marque, logo, fr, 1440", {
    wcag22: true,
  });

  await page.getByRole("button", { name: copy.logo.remove }).click();
  await expect(page.getByText(copy.logo.status.removed)).toBeVisible();
  await expect(preview).toHaveCount(0);
  await expect(page.getByText(copy.logo.none)).toBeVisible();
  await expect.poll(scoreNow).toBe(before);
});

test("a brand on a phone in English: a refused image says why, an unavailable service leaves the logo to upload again, the other fields stay", async ({
  page,
}) => {
  const copy = COPY.en;
  await page.setViewportSize({ width: 375, height: 800 });
  await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await open(page, "/en/account/profile");
  await expect(title(page)).toHaveText(copy.page.title);
  const name = page.getByLabel(new RegExp(copy.fields.companyName.label));
  await expect(name).toHaveValue("Maison E2E");
  const input = page.locator("input[type=file]");

  // 422 image_rejected: the typed reason of the envelope picks the message (06 cas limite 2).
  await page.route(LOGO_ROUTE, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill(errorEnvelope("image_rejected", 422, "too_small"))
      : route.continue(),
  );
  await input.setInputFiles(LOGO_FIXTURE);
  await expect(page.getByText(copy.logo.errors.too_small)).toBeVisible();
  await expect(page.getByRole("button", { name: copy.logo.retry })).toHaveCount(
    0,
  );

  // The service does not answer (CA45, cas limite 6): the fields are kept, the logo to upload again.
  await name.fill("Maison E2E Nova");
  await page.unroute(LOGO_ROUTE);
  await page.route(LOGO_ROUTE, (route) =>
    route.request().method() === "PUT"
      ? route.fulfill(errorEnvelope("service_unavailable", 503))
      : route.continue(),
  );
  await input.setInputFiles(LOGO_FIXTURE);
  await expect(page.getByText(copy.logo.errors.unavailable)).toBeVisible();
  await expect(name).toHaveValue("Maison E2E Nova");
  await expectNoAxeViolation(page, "my brand profile, logo error, en, 375", {
    wcag22: true,
  });

  // A new attempt, without choosing the file again.
  await page.unroute(LOGO_ROUTE);
  await page.getByRole("button", { name: copy.logo.retry }).click();
  await expect(page.getByRole("img", { name: copy.logo.alt })).toBeVisible();
  await expect(page.getByText(copy.logo.errors.unavailable)).toHaveCount(0);
  await expect(name).toHaveValue("Maison E2E Nova");
});

/** The state a review would leave the profile in: the agents' decision is L2C's, the base is written here. */
async function submitDirectly(accountId: string): Promise<void> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    await sql`
      update profiles.advertiser_profiles
         set status = 'pending_review', submitted_at = now()
       where account_id = ${accountId}`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

test("the home and the column of a brand: the action card with what is missing, the locked screens told, the state written once submitted, in French at 1 440 px then in English at 375 px (17 §2.3, §2.4; L2AU-4)", async ({
  page,
}) => {
  const fr = COPY.fr;
  await page.setViewportSize({ width: 1440, height: 900 });
  const member = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await open(page, "/fr/marque");
  await expect(title(page)).toHaveText(frAuth.home.advertiser.title);
  const main = page.locator("main");
  const draftLine = fr.state.label.replace("{state}", fr.state.draft);

  // Block 1: the action, the state written, what is missing by name; block 2: told in advance.
  await expect(
    main.getByRole("heading", { name: fr.home.action.title }),
  ).toBeVisible();
  await expect(main.getByText(draftLine)).toBeVisible();
  await expect(main.getByText(/Il manque 10 informations/)).toBeVisible();
  await expect(
    main.getByRole("heading", { name: fr.home.locked.campaign.title }),
  ).toBeVisible();
  await expect(main.getByText(fr.home.locked.campaign.text)).toBeVisible();
  await expect(
    main.getByRole("heading", { name: fr.home.locked.search.title }),
  ).toBeVisible();
  await expect(main.getByText(fr.search.blockedUntilPublished)).toBeVisible();
  // Block 3: how it works, three steps; nothing else (no figure, no chart).
  await expect(main.getByRole("listitem")).toHaveCount(2 + 3);
  // L2AU-4: the sign-in address and the sign-out button are the column's alone.
  await expect(main.getByText(/Connecté avec/)).toHaveCount(0);
  await expect(
    main.getByRole("button", { name: frAuth.logout.action }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: frMember.shell.footer.signOut }),
  ).toBeVisible();
  // The column: the state, what is missing, the way to the profile (the home's button is the same).
  await expect(
    page.getByText(
      frMember.shell.accountState.state.replace("{state}", fr.state.draft),
    ),
  ).toBeVisible();
  await expect(page.getByText("10 informations manquantes")).toBeVisible();
  const toProfile = page.getByRole("link", {
    name: frMember.shell.accountState.complete,
  });
  await expect(toProfile).toHaveCount(2);
  await expect(toProfile.first()).toBeVisible();
  await toProfile.last().click();
  await expect(title(page)).toHaveText(fr.page.title);

  // Submitted: the state is written in place of the card, and the column stops asking.
  await submitDirectly(member.accountId);
  await open(page, "/fr/marque");
  await expect(title(page)).toHaveText(frAuth.home.advertiser.title);
  await expect(
    main.getByText(fr.state.label.replace("{state}", fr.state.pending_review)),
  ).toBeVisible();
  await expect(
    main.getByRole("heading", { name: fr.home.action.title }),
  ).toHaveCount(0);
  await expect(
    page.getByText(
      frMember.shell.accountState.state.replace(
        "{state}",
        fr.state.pending_review,
      ),
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: frMember.shell.accountState.complete }),
  ).toHaveCount(0);
  await expectNoAxeViolation(page, "accueil marque, fr, 1440", {
    wcag22: true,
  });

  // On a phone, in English: no column, so the state lives on the home alone; no French left.
  const en = COPY.en;
  await page.setViewportSize({ width: 375, height: 800 });
  await open(page, "/en/brand");
  await expect(title(page)).toHaveText(enAuth.home.advertiser.title);
  await expect(
    main.getByText(en.state.label.replace("{state}", en.state.pending_review)),
  ).toBeVisible();
  await expect(main.getByText(en.home.locked.campaign.text)).toBeVisible();
  await expect(main.getByText(en.search.blockedUntilPublished)).toBeVisible();
  await expect(
    page
      .getByText(
        enMember.shell.accountState.state.replace(
          "{state}",
          en.state.pending_review,
        ),
      )
      .filter({ visible: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: enMember.shell.footer.signOut }),
  ).toBeHidden();
  const shown = (await main.innerText()).toLowerCase();
  for (const text of [
    frBrandProfile.home.locked.campaign.title,
    frBrandProfile.home.locked.search.title,
    frAuth.home.howItWorks,
    frBrandProfile.state.pending_review,
  ]) {
    expect(shown, text).not.toContain(text.toLowerCase());
  }
  await expectNoAxeViolation(page, "brand home, en, 375", { wcag22: true });
});

// L2C-15: the profile as the review leaves it. The profile and the logo of a seeded member are read
// from the real API and given the fields the review adds (06 RG9, RG10; `pendingChanges`, `refusal`,
// `pendingLogo`), so that no fixture drifts from the contract; the screens are what is under test.
const PROFILE_ROUTE = "**/api/v1/me/brand-profile";
const LOGO_PATH = "**/api/v1/me/brand-profile/logo";
const TINY_WEBP = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";
const DECIDED = "2026-11-04T09:00:00.000Z";

type Overrides = Record<string, unknown>;

async function stubProfile(page: Page, now: () => Overrides): Promise<void> {
  await page.route(PROFILE_ROUTE, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    const real = (await (await route.fetch()).json()) as Overrides;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...real, ...now() }),
    });
  });
}

async function stubLogo(page: Page): Promise<void> {
  const logo = {
    contentType: "image/webp",
    width: 1,
    height: 1,
    byteSize: 36,
    data: TINY_WEBP,
    updatedAt: DECIDED,
  };
  await page.route(LOGO_PATH, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ logo, pendingLogo: logo }),
    });
  });
}

const refusalOf = (kind: "submission" | "revision", message: string) => ({
  kind,
  reasonCode: "presentation_insufficient",
  message,
  memberMessage: null,
  fields: [],
  decidedAt: DECIDED,
});

test("a published brand in French at 1 440 px: changes waiting for review shown as sent, the regime told on each moderated field, the logo beside the one in force, then a refused revision (06 RG9, RG10, RG84)", async ({
  page,
}) => {
  const copy = COPY.fr;
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  const refused = "Votre présentation est trop courte.";
  let scenario: Overrides = {
    status: "published",
    submittedAt: DECIDED,
    missingRequired: [],
    refusal: null,
    pendingChanges: [
      {
        field: "presentation",
        change: "set",
        value: "Une présentation plus détaillée, proposée à l'examen.",
        submittedAt: DECIDED,
      },
      { field: "logo", change: "set", value: null, submittedAt: DECIDED },
    ],
  };
  await stubProfile(page, () => scenario);
  await stubLogo(page);
  await open(page, "/fr/compte/profil");
  await expect(title(page)).toHaveText(copy.page.title);

  // Published, its changes waiting: the previous version stays visible, said so.
  await expect(
    page.getByText(copy.state.label.replace("{state}", copy.state.published)),
  ).toBeVisible();
  await expect(page.getByText(copy.status.pendingWithPublished)).toBeVisible();
  // The field waiting for review shows the value sent and says it is being reviewed; the others of
  // the regime say it beforehand; nothing is left to submit.
  await expect(
    page.getByLabel(new RegExp(`^${copy.fields.presentation.label}`)),
  ).toHaveValue("Une présentation plus détaillée, proposée à l'examen.");
  await expect(page.getByText(copy.review.pending).first()).toBeVisible();
  await expect(page.getByText(copy.review.regime).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: copy.submit.label }),
  ).toHaveCount(0);
  // The logo waiting sits beside the one in force, told with words.
  await expect(
    page.getByRole("img", { name: copy.logo.alt, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: copy.logo.pendingAlt }),
  ).toBeVisible();
  await expect(page.getByText(copy.logo.review.set)).toBeVisible();
  await expectNoAxeViolation(page, "mon profil publié, révision, fr, 1440", {
    wcag22: true,
  });

  // The review refused them: the profile stays published, the reason is written, nothing waits.
  scenario = {
    ...scenario,
    pendingChanges: [],
    refusal: refusalOf("revision", refused),
  };
  await reload(page);
  await expect(
    page.getByText(copy.status.revisionRefused.replace("{reason}", refused)),
  ).toBeVisible();
  await expect(page.getByText(copy.status.pendingWithPublished)).toHaveCount(0);
  await expect(page.getByText(copy.logo.review.set)).toHaveCount(0);
});

test("a refused then a suspended brand in English at 375 px: the typed reason and the agent's text, the same words on the home, a suspended profile read-only (06 RG10, RG84)", async ({
  page,
}) => {
  const copy = COPY.en;
  await page.setViewportSize({ width: 375, height: 800 });
  await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  const reason =
    "Your profile can't be published. Please describe your activity.";
  let scenario: Overrides = {
    status: "rejected",
    refusal: {
      ...refusalOf("submission", "Your profile can't be published."),
      reasonCode: "other",
      memberMessage: "Please describe your activity.",
    },
  };
  await stubProfile(page, () => scenario);
  const refusedText = copy.status.rejected.replace("{reason}", reason);

  // Refused: the reason in clear and what to do, on the page and on the home alike.
  await open(page, "/en/account/profile");
  await expect(title(page)).toHaveText(copy.page.title);
  await expect(page.getByText(refusedText)).toBeVisible();
  await expect(page.getByText(copy.statusText.rejectedNext)).toBeVisible();
  await open(page, "/en/brand");
  await expect(page.getByText(refusedText)).toBeVisible();
  await expectNoAxeViolation(page, "brand home, refused, en, 375", {
    wcag22: true,
  });

  // Suspended: said, and read-only.
  scenario = { status: "suspended", refusal: null };
  await open(page, "/en/account/profile");
  await expect(page.getByText(copy.statusText.suspended)).toBeVisible();
  await expect(page.getByLabel(/^Main sector/)).toBeDisabled();
  await expect(page.getByText(refusedText)).toHaveCount(0);
});
