// "Mon profil de marque" (docs/mvp/17 §4.2, M2; 06 RG3, RG5, RG17, RG83 to RG85, CA1, CA2, CA4, CA6,
// CA7, CA39, CA44, CA46, CA47; jalons/l2b, commit 11): blocks 1 to 3 saved by themselves, the score
// and the missing fields by name, the submission, in French at 1 440 px and in English at 375 px
// (accordion, action bar), and a creator who finds no such page (18 T14.3). A member seeded in the
// local stack (no code, no mail); the texts are the locale files', never copies.
import { connectAsMigrationRole } from "@influx/test-kit/db";
import type { Page, Route } from "@playwright/test";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import frErrors from "@/locales/fr/errors.json" with { type: "json" };
import enBrandProfile from "@/locales/en/brand-profile.json" with { type: "json" };
import frBrandProfile from "@/locales/fr/brand-profile.json" with { type: "json" };
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
  await expect(
    page.getByText(copy.layer.internal, { exact: true }),
  ).toHaveCount(3);
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
  await expect(savedLine(page, "fr")).toBeVisible();
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

test("a creator finds no brand profile: not in its column, not at the address (18 T14.3)", async ({
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
  await open(page, "/fr/compte/profil");
  await expect(title(page)).toHaveText(frErrors.notFound.title);
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
