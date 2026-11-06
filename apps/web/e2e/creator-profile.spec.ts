// "Mon profil" of a creator, blocks 1 and 2 (docs/mvp/17 §5.2, C2; 07 RG16, RG23, RG27, RG29, RG40,
// RG111, RG112, CA3, CA6, CA29; jalons/l2d, commit 12): the alias explained before any entry, the
// five sections of the summary with working anchors, the layer of each field told by an icon AND a
// text, no photo and no age or gender of the creator, no tariff, the autosave and the warning of the
// detection, in French and in English, at 375 and 1 440 px (the widths in a loop, one entry per
// language to keep the added time short). A creator seeded in the local stack with its storefront
// (no code, no mail); the texts are the locale files', never copies.
import { connectAsMigrationRole } from "@influx/test-kit/db";
import type { Page } from "@playwright/test";
import enBrandProfile from "@/locales/en/brand-profile.json" with { type: "json" };
import enCreatorProfile from "@/locales/en/creator-profile.json" with { type: "json" };
import frBrandProfile from "@/locales/fr/brand-profile.json" with { type: "json" };
import frCreatorProfile from "@/locales/fr/creator-profile.json" with { type: "json" };
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { expect, open, reload, test, title } from "./support/journey";

const COPY = {
  fr: { own: frCreatorProfile, brand: frBrandProfile },
  en: { own: enCreatorProfile, brand: enBrandProfile },
} as const;
const PATHS = { fr: "/fr/compte/profil", en: "/en/account/profile" } as const;
const WIDTHS = [375, 1440] as const;

type Locale = keyof typeof COPY;

/** The alias the storefront was given at sign-up, and what the autosave has stored. */
async function storedOf(accountId: string): Promise<{
  alias: string;
  headline: string | null;
  topic: string | null;
  languages: string[];
  city: string | null;
}> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const [row] = await sql<
      {
        alias: string;
        headline: string | null;
        topic: string | null;
        languages: string[];
        city: string | null;
      }[]
    >`
      select p.alias, p.headline, p.primary_topic_code as topic,
             coalesce((select array_agg(language_code::text order by language_code)
                         from profiles.creator_publication_languages l
                        where l.account_id = p.account_id), '{}') as languages,
             (select i.city from profiles.creator_identities i
               where i.account_id = p.account_id) as city
        from profiles.creator_public_profiles p
       where p.account_id = ${accountId}`;
    if (row === undefined) {
      throw new Error("the seeded creator has no storefront");
    }
    return row;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** The status line that tells the draft is saved (RG111); the bar of a phone holds its own twin. */
function savedLine(page: Page, locale: Locale) {
  return page.locator("p[role=status]:visible", {
    hasText: COPY[locale].own.save.saved.split("{")[0]?.trim(),
  });
}

/**
 * What the screen shows whatever the width: the alias explained first (RG23), the layer of every
 * field as icon AND text (CA3), no photo, no age nor gender of the creator (CA6, CA29, RG29, RG40),
 * no tariff (D78), the five sections of the summary, the three still to come told as such.
 */
async function expectScreen(
  page: Page,
  locale: Locale,
  alias: string,
  width: number,
  axe: boolean,
): Promise<void> {
  const copy = COPY[locale].own;
  await expect(title(page)).toHaveText(copy.page.title);
  await expect(
    page.getByText(
      copy.alias.explain.replace(
        "{alias}",
        copy.alias.name.replace("{alias}", alias),
      ),
    ),
  ).toBeVisible();
  await expect(page.getByText(copy.alias.forLife)).toBeVisible();

  // CA3: nine fields are visible to every brand, six only to the creator and the team.
  await expect(page.getByText(copy.layer.public, { exact: true })).toHaveCount(
    9,
  );
  await expect(
    page.getByText(copy.layer.revealed, { exact: true }),
  ).toHaveCount(0);
  const internal = page.getByText(copy.layer.internal, { exact: true });
  await expect(internal).toHaveCount(6);
  await expect(internal.locator("svg")).toHaveCount(6);

  // CA6, CA29: no photo, no avatar, no age nor gender of the creator; D78: no tariff.
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await expect(
    page.getByLabel(/\b(photo|avatar|age|gender|âge|genre)\b/i),
  ).toHaveCount(0);
  const shown = await page.locator("main").innerText();
  expect(shown).not.toMatch(/\b(tarifs?|prix|price|rates?|net|fee)\b|[€$]/i);

  // The summary: two sections to go to, three coming soon, none of them a link.
  for (const id of ["presentation", "editorial"] as const) {
    await expect(
      page.getByRole("link", { name: new RegExp(copy.sections[id]) }),
    ).toBeVisible();
  }
  for (const id of ["networks", "audience", "offer"] as const) {
    await expect(
      page.getByRole("link", { name: new RegExp(copy.sections[id]) }),
    ).toHaveCount(0);
  }
  await expect(page.getByText(copy.summary.soon)).toHaveCount(3);
  await expect(page.getByText(copy.field.required).first()).toBeVisible();
  if (axe) {
    await expectNoAxeViolation(
      page,
      `my creator profile, ${locale}, ${width}`,
      {
        wcag22: true,
      },
    );
  }
}

test("a creator in French: alias, layers, anchors, the warning of the detection, autosave and reload, at 375 then 1 440 px (07 RG23, RG27, RG111, CA3, CA6, CA29)", async ({
  page,
}) => {
  const copy = COPY.fr.own;
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  const { alias } = await storedOf(accountId);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, PATHS.fr);
    await expectScreen(page, "fr", alias, width, width === 1440);
  }

  // Nothing is complete yet, and what is missing is named (RG90).
  await expect(
    page.getByText(copy.blocks.missing.split("{")[0]!.trim()),
  ).toContainText(copy.required.headline);

  // The anchors: a link of the summary leads to its section.
  await page
    .getByRole("link", { name: new RegExp(copy.sections.editorial) })
    .click();
  await expect(page).toHaveURL(/#creator-section-editorial$/);
  await expect(
    page.getByRole("heading", { name: new RegExp(copy.sections.editorial) }),
  ).toBeInViewport();

  // Blocks 1 and 2, saved by themselves in one go. RG27: a handle in the bio is a warning, never an
  // error, and the text is saved as typed.
  await page
    .getByLabel(new RegExp(`^${copy.fields.headline.label}`))
    .fill("Cuisine végétale et voyages en famille");
  await page
    .getByLabel(new RegExp(`^${copy.fields.bio.label}`))
    .fill(
      "Je partage chaque semaine des recettes végétales simples, des idées de menus pour toute la famille et mes escapades gourmandes, avec des conseils pratiques pour cuisiner mieux : suivez-moi sur @camille_cuisine.",
    );
  await page
    .getByLabel(new RegExp(`^${copy.fields.primaryTopic.label}`))
    .selectOption({ label: COPY.fr.brand.reference.topic.food });
  await page
    .getByLabel(new RegExp(`^${copy.fields.publicationLanguages.label}`))
    .selectOption("fr");
  await expect(
    page.getByRole("button", {
      name: copy.field.remove.replace("{label}", "français"),
    }),
  ).toBeVisible();
  await page.getByLabel(new RegExp(`^${copy.fields.city.label}`)).fill("Lyon");
  await expect(savedLine(page, "fr")).toBeVisible();
  await expect(page.getByText(copy.errors.identifierInText)).toBeVisible();
  await expect
    .poll(async () => await storedOf(accountId))
    .toMatchObject({
      headline: "Cuisine végétale et voyages en famille",
      topic: "food",
      languages: ["fr"],
      city: "Lyon",
    });

  // After a reload: the values are back, both sections are complete, the missing list lost them.
  await reload(page);
  await expect(
    page.getByLabel(new RegExp(`^${copy.fields.headline.label}`)),
  ).toHaveValue("Cuisine végétale et voyages en famille");
  await expect(
    page.getByLabel(new RegExp(`^${copy.fields.city.label}`)),
  ).toHaveValue("Lyon");
  await expect(page.getByText(copy.summary.complete)).toHaveCount(2);
  await expect(
    page.getByText(copy.blocks.missing.split("{")[0]!.trim()),
  ).not.toContainText(copy.required.headline);
});

test("a creator in English: the same screen at 375 then 1 440 px, no French left (07 RG112)", async ({
  page,
}) => {
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  const { alias } = await storedOf(accountId);
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await open(page, PATHS.en);
    await expectScreen(page, "en", alias, width, width === 375);
  }

  // Not a word of French among the texts of the screen.
  const shown = (await page.locator("main").innerText()).toLowerCase();
  for (const text of [
    frCreatorProfile.page.title,
    frCreatorProfile.sections.editorial,
    frCreatorProfile.layer.public,
    frCreatorProfile.alias.forLife,
    frCreatorProfile.summary.soon,
    frCreatorProfile.save.idle,
    frCreatorProfile.fields.headline.label,
  ]) {
    expect(shown, text).not.toContain(text.toLowerCase());
  }
});
