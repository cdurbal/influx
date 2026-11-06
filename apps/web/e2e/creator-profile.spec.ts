// "Mon profil" of a creator, blocks 1 and 2 (docs/mvp/17 §5.2, C2; 07 RG16, RG23, RG27, RG29, RG40,
// RG111, RG112, CA3, CA6, CA29; jalons/l2d, commit 12): the alias explained before any entry, the
// five sections of the summary with working anchors, the layer of each field told by an icon AND a
// text, no photo and no age or gender of the creator, no tariff, the autosave and the warning of the
// detection, in French and in English, at 375 and 1 440 px (the widths in a loop, one entry per
// language to keep the added time short), then block 3 (commit 13): the networks, the three metrics in
// order, the source and date of the figures, the confirmation, the bands, the link of another network,
// the main account, then blocks 4 and 5 (commit 14): the audience, always about the audience, a sum
// over 100 refused, the others left as they are; the offer, with no tariff, two lists of usage rights,
// the availability with its date. A creator seeded in the local stack with its storefront
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

/** What the database holds of the network lines of a creator, and of the date of their figures. */
async function linesOf(accountId: string): Promise<
  {
    network: string;
    handle: string | null;
    url: string | null;
    followers: number | null;
    posts: number | null;
    comments: number | null;
    primary: boolean;
    dated: boolean;
  }[]
> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    return await sql`
      select network_code::text as network, handle, profile_url as url, followers_count::int as followers,
             posts_last_30_days as posts, avg_comments_per_post::int as comments,
             is_primary as primary, figures_measured_at is not null as dated
        from profiles.creator_social_accounts
       where account_id = ${accountId}
       order by created_at, id`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** A main YouTube line whose figures were confirmed 100 days ago, as if the creator had typed them then. */
async function seedYoutubeLine(accountId: string): Promise<void> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    await sql`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, profile_url, followers_count,
         posts_last_30_days, avg_comments_per_post, figures_measured_at)
      values (${accountId}, 'youtube', true, 'camille_cuisine',
              'https://www.youtube.com/@camille', 1500, 30, 3, now() - interval '100 days')`;
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** What the database holds of the audience of the creator (main country and share, age bands). */
async function audienceOf(accountId: string): Promise<{
  main: string | null;
  share: number | null;
  ages: Record<string, number>;
}> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const [row] = await sql<
      {
        main: string | null;
        share: number | null;
        ages: Record<string, number>;
      }[]
    >`
      select (select country_code::text from profiles.creator_audience_countries
               where account_id = ${accountId} and slot = 0) as main,
             (select share_percent::int from profiles.creator_audience_countries
               where account_id = ${accountId} and slot = 0) as share,
             coalesce((select jsonb_object_agg(age_band_code, share_percent)
                         from profiles.creator_audience_ages
                        where account_id = ${accountId}), '{}'::jsonb) as ages`;
    return row ?? { main: null, share: null, ages: {} };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** What the database holds of the offer of the creator: no tariff exists to read. */
async function offerOf(accountId: string): Promise<{
  formats: string[];
  rights: Record<string, string>;
  availability: string | null;
  declared: boolean;
  nonMonetary: boolean;
  sectors: string[];
}> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const [row] = await sql<
      {
        formats: string[];
        rights: Record<string, string>;
        availability: string | null;
        declared: boolean;
        nonMonetary: boolean;
        sectors: string[];
      }[]
    >`
      select coalesce((select array_agg(format_code order by format_code)
                         from profiles.creator_formats where account_id = p.account_id), '{}') as formats,
             coalesce((select jsonb_object_agg(usage_right_code, inclusion)
                         from profiles.creator_usage_rights
                        where account_id = p.account_id), '{}'::jsonb) as rights,
             p.availability_band as availability,
             p.availability_declared_at is not null as declared,
             p.accepts_non_monetary as "nonMonetary",
             coalesce((select array_agg(sector_code order by sector_code)
                         from profiles.creator_refused_sectors
                        where account_id = p.account_id), '{}') as sectors
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
 * no tariff (D78), the five sections of the summary, the two still to come told as such. `seeded`: a
 * network line is already there, so the counts of the empty page and its words do not apply.
 */
async function expectScreen(
  page: Page,
  locale: Locale,
  alias: string,
  width: number,
  axe: boolean,
  seeded = false,
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

  // CA3: seventeen fields (and the network to add) are visible to every brand, seven only to the
  // creator and the team: ten from blocks 1 to 3, then seven public ones and the refused sectors of
  // block 5 (block 4 shows nothing of its own until a network line exists).
  const internal = page.getByText(copy.layer.internal, { exact: true });
  if (!seeded) {
    await expect(
      page.getByText(copy.layer.public, { exact: true }),
    ).toHaveCount(17);
    await expect(
      page.getByText(copy.layer.revealed, { exact: true }),
    ).toHaveCount(0);
    await expect(internal).toHaveCount(7);
    await expect(internal.locator("svg")).toHaveCount(7);
  }

  // CA6, CA29: no photo, no avatar, no age nor gender of the creator; D78: no tariff. (The formats of
  // block 5 name "photo" content, a format and not a picture of the creator: they are looked at apart.)
  await expect(page.locator("input[type=file]")).toHaveCount(0);
  await expect(
    page
      .locator("[data-section]:not([data-section=offer])")
      .getByLabel(/\b(photo|avatar|age|gender|âge|genre)\b/i),
  ).toHaveCount(0);
  await expect(
    page
      .locator("[data-section=offer]")
      .getByLabel(/\b(avatar|age|gender|âge|genre)\b/i),
  ).toHaveCount(0);
  if (!seeded) {
    const shown = await page.locator("main").innerText();
    expect(shown).not.toMatch(/\b(tarifs?|prix|price|rates?|net|fee)\b|[€$]/i);
  }

  // The summary: the five sections to go to, none of them told "coming soon" any more.
  for (const id of [
    "presentation",
    "editorial",
    "networks",
    "audience",
    "offer",
  ] as const) {
    await expect(
      page.getByRole("link", { name: new RegExp(copy.sections[id]) }),
    ).toBeVisible();
  }
  await expect(page.getByText(copy.summary.soon)).toHaveCount(0);
  // Block 3 starts empty: it says so, and offers the closed list of networks.
  if (!seeded) {
    await expect(page.getByText(copy.networks.empty)).toBeVisible();
  }
  await expect(
    page.getByLabel(new RegExp(`^${copy.networks.add.label}`)),
  ).toBeVisible();
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
    await expectScreen(page, "fr", alias, width, false);
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

  // Block 3 (CA10 to CA12, CA18). The first line is the main account; the three metrics come first and
  // in order, the secondary indicators after them (RG113).
  await page
    .getByLabel(new RegExp(`^${copy.networks.add.label}`))
    .selectOption({ label: COPY.fr.brand.reference.network.instagram });
  const instagram = page.locator('[data-network-line="instagram"]');
  await expect(
    instagram.getByRole("radio", { name: copy.networks.primary.label }),
  ).toBeChecked();
  const fieldNames = await instagram
    .locator("input:not([type=radio])")
    .evaluateAll((inputs) =>
      inputs.map((input) => (input as HTMLInputElement).name.slice(37)),
    );
  expect(fieldNames).toEqual([
    "handle",
    "profileUrl",
    "pseudonym",
    "followers",
    "posts",
    "comments",
    "reach",
    "engagement",
  ]);
  await expect(page.getByText(copy.priorityMetrics.explain)).toBeVisible();
  await expect(page.getByText(copy.posts30d.hint)).toBeVisible();
  await expect(page.getByText(copy.comments.hint)).toBeVisible();
  await expect(page.getByText(copy.engagement.unverified)).toBeVisible();
  const typeIn = (label: string, value: string) =>
    instagram.getByLabel(new RegExp(`^${label}`)).fill(value);
  const names = copy.networks.fields;

  // CA12: a link to another network is refused with its own message, and holds back no other field.
  await typeIn(names.handle.label, "camille_cuisine");
  await typeIn(names.profileUrl.label, "https://www.tiktok.com/@camille");
  await typeIn(names.followers.label, "47312");
  await typeIn(names.posts.label, "12");
  await typeIn(names.comments.label, "85");
  await expect(instagram.getByText(copy.issues.wrong_network)).toBeVisible();
  await expect
    .poll(async () => (await linesOf(accountId))[0])
    .toMatchObject({
      network: "instagram",
      handle: "camille_cuisine",
      followers: 47312,
      posts: 12,
      comments: 85,
      primary: true,
      dated: false,
    });
  await typeIn(names.profileUrl.label, "https://www.instagram.com/camille");

  // CA18: figures typed alone keep no date; the message asks for the confirmation, source said.
  const source = copy.figures.source.declared;
  await expect(
    instagram.getByText(copy.figures.undated.replace("{source}", source)),
  ).toBeVisible();
  await expect(instagram.getByText(copy.figures.confirmAll)).toBeVisible();
  await expect(instagram.getByText(copy.issues.wrong_network)).toHaveCount(0);
  await instagram.getByRole("button", { name: copy.figures.confirm }).click();
  await expect(instagram.getByText(copy.figures.confirmAll)).toHaveCount(0);
  await expect(
    instagram.getByText(
      new RegExp(
        `^${copy.figures.dated.replace("{source}", source).split("{")[0]}`,
      ),
    ),
  ).toBeVisible();
  await expect
    .poll(async () => (await linesOf(accountId))[0]?.dated)
    .toBe(true);

  // The bands the brands will see, derived by the system from the exact figures (RG22, RG114, RG115).
  await expect(
    instagram.getByText(copy.reference.audience_band.micro),
  ).toBeVisible();
  await expect(
    instagram.getByText(copy.reference.publication_frequency.several_per_week),
  ).toBeVisible();
  await expect(
    instagram.getByText(copy.reference.comment_band["50_199"]),
  ).toBeVisible();
  await expect(page.getByText(copy.summary.complete)).toHaveCount(3);
  expect((await linesOf(accountId))[0]?.url).toBe(
    "https://www.instagram.com/camille",
  );

  // Block 4 (CA26 to CA28): every label is about the audience; 140 in a dimension is refused and told,
  // nothing of the audience is saved meanwhile; 70 is accepted and the 30 left read "others", which
  // the API says and the screen never completes.
  const aud = copy.audience;
  const audience = page.locator('[data-audience-line="instagram"]');
  const share = (label: string) => audience.getByLabel(label);
  await share(aud.countries.main).selectOption("FR");
  await share(aud.countries.mainShare).fill("72");
  await share(aud.ages.band["18_24"]).fill("60");
  await share(aud.ages.band["25_34"]).fill("80");
  await expect(audience.getByText(copy.issues.sum_exceeds_100)).toBeVisible();
  expect((await audienceOf(accountId)).main).toBeNull();
  await share(aud.ages.band["25_34"]).fill("10");

  // Block 5: no tariff, costs said to be negotiated; a usage right is in one list only (RG73).
  const offer = page.locator('[data-section="offer"]');
  const group = (name: string) => offer.getByRole("group", { name });
  const reference = COPY.fr.brand.reference;
  await expect(offer.getByText(copy.offer.negotiation)).toBeVisible();
  await offer.getByLabel(reference.format.instagram_reel).check();
  await offer.getByLabel(reference.format.ugc_video).check();
  await group(copy.fields.usageIncluded.label)
    .getByLabel(reference.usage_right.organic_repost)
    .check();
  await group(copy.fields.usageOptional.label)
    .getByLabel(reference.usage_right.media_buy)
    .check();
  await group(copy.fields.usageIncluded.label)
    .getByLabel(reference.usage_right.media_buy)
    .check();
  await expect(
    group(copy.fields.usageOptional.label).getByLabel(
      reference.usage_right.media_buy,
    ),
  ).not.toBeChecked();
  await offer.getByLabel(copy.offer.delivery["7_14d"]).check();
  await offer
    .getByRole("radiogroup", { name: copy.fields.acceptsNonMonetary.label })
    .getByLabel(copy.field.yes)
    .check();
  await offer.getByLabel(copy.offer.availability.lt_2w).check();
  await group(copy.fields.refusedSectors.label)
    .getByLabel(reference.sector.gambling)
    .check();

  await expect
    .poll(async () => await audienceOf(accountId))
    .toEqual({ main: "FR", share: 72, ages: { "18_24": 60, "25_34": 10 } });
  await expect(
    audience.getByText(aud.remainder.replace("{share, number}", "28")),
  ).toBeVisible();
  await expect(
    audience.getByText(aud.remainder.replace("{share, number}", "30")),
  ).toBeVisible();
  await expect
    .poll(async () => await offerOf(accountId))
    .toEqual({
      formats: ["instagram_reel", "ugc_video"],
      rights: { organic_repost: "included", media_buy: "included" },
      availability: "lt_2w",
      declared: true,
      nonMonetary: true,
      sectors: ["gambling"],
    });
  await expect(
    offer.getByText(copy.offer.availabilityDeclared.split("{")[0]!.trim()),
  ).toBeVisible();
  await expect(page.getByText(copy.summary.complete)).toHaveCount(5);

  // D78, D48: not one amount, tariff, net or currency on the screen, nor an attribute of the old mock-up.
  expect(await page.locator("main").innerText()).not.toMatch(
    /\b(tarifs?|prix|montants?|net)\b|[€$£]/i,
  );
  await expect(
    page.locator("[data-net-creator], [data-advertiser-share]"),
  ).toHaveCount(0);
  await expectNoAxeViolation(
    page,
    "my creator profile, five blocks, fr, 1440",
    { wcag22: true },
  );

  // CA11: choosing the main account on a second line unchecks the first, and the screen says so.
  await page
    .getByLabel(new RegExp(`^${copy.networks.add.label}`))
    .selectOption({ label: COPY.fr.brand.reference.network.tiktok });
  const tiktok = page.locator('[data-network-line="tiktok"]');
  await expect(
    tiktok.getByRole("radio", { name: copy.networks.primary.label }),
  ).not.toBeChecked();
  await tiktok
    .getByRole("radio", { name: copy.networks.primary.label })
    .click();
  await expect(
    page.getByText(
      copy.networks.primary.moved
        .replace("{to}", COPY.fr.brand.reference.network.tiktok)
        .replace("{from}", COPY.fr.brand.reference.network.instagram),
    ),
  ).toBeVisible();
  await expect(
    instagram.getByRole("radio", { name: copy.networks.primary.label }),
  ).not.toBeChecked();
  await expect
    .poll(async () => (await linesOf(accountId)).map((l) => l.primary))
    .toEqual([false, true]);
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
    if (width === 1440) {
      await seedYoutubeLine(accountId);
    }
    await open(page, PATHS.en);
    await expectScreen(page, "en", alias, width, false, width === 1440);
  }

  // Block 3 in English (a line seeded with figures dated 100 days ago, none of it typed): the source
  // and the date of the figures (RG49), the past 90 days said and nothing hidden (RG50), the bands
  // in English.
  const copy = COPY.en.own;
  const youtube = page.locator('[data-network-line="youtube"]');
  await expect(
    youtube.getByText(copy.reference.audience_band.nano),
  ).toBeVisible();
  await expect(
    youtube.getByText(copy.reference.publication_frequency.daily),
  ).toBeVisible();
  await expect(
    youtube.getByText(copy.reference.comment_band["0_9"]),
  ).toBeVisible();
  await expect(
    youtube.getByText(
      new RegExp(
        `^${copy.figures.dated.replace("{source}", copy.figures.source.declared).split("{")[0]}`,
      ),
    ),
  ).toBeVisible();
  await expect(
    page.getByText(copy.figures.stale.split("{")[0]!.trim()),
  ).toBeVisible();
  await expect(
    youtube.getByRole("button", { name: copy.figures.confirm }),
  ).toBeVisible();

  // Blocks 4 and 5 in English: the audience labels about the audience, the offer without a tariff.
  const audienceLine = page.locator('[data-audience-line="youtube"]');
  await expect(
    audienceLine.getByLabel(copy.audience.ages.band["25_34"]),
  ).toBeVisible();
  await expect(
    audienceLine.getByLabel(copy.audience.genders.share.female),
  ).toBeVisible();
  await expect(page.getByText(copy.audience.intro)).toBeVisible();
  const offer = page.locator('[data-section="offer"]');
  await expect(offer.getByText(copy.offer.negotiation)).toBeVisible();
  await expect(
    offer.getByLabel(COPY.en.brand.reference.format.tiktok_video),
  ).toBeVisible();
  await expect(
    offer.getByRole("radiogroup", { name: copy.fields.availability.label }),
  ).toBeVisible();

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
    frCreatorProfile.networks.primary.label,
    frCreatorProfile.figures.confirm,
    frCreatorProfile.networks.bands.title,
    frCreatorProfile.offer.negotiation,
    frCreatorProfile.audience.intro,
    frCreatorProfile.fields.formats.label,
  ]) {
    expect(shown, text).not.toContain(text.toLowerCase());
  }
});
