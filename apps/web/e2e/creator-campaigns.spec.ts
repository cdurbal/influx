// "Campagnes" of a creator, the feed C5 (docs/mvp/11 RG15, RG26, RG33 to RG36; 17 §5.5; D11, D46, D48, D78; jalons/l3d,
// commit 04, L3D-E1). A brand with a published profile publishes four campaigns through the API's own routes (the
// brand's screens are not under test): three open ones with three deadlines and one whose applications closed two
// days ago (greyed, RG26). A creator then reads the feed in French at 375 px (the count BEFORE the list, the cards,
// the nature of the consideration followed by « À négocier avec votre commercial », no figure and no contact, the
// greyed card with no way in, the two sorts) and in English at 1 440 px (the entry of the column, the same cards,
// the same sort). A third journey draws the states the base cannot make cheaply from the same screen with the
// network answers it would give: unreadable and retried, read too often, « Voir la suite » that skips a card
// already seen, the cap said, and the empty feed. The texts are the locale files', never copies. No amount, rate
// or price anywhere (CLAUDE.md §2, D48, D78).
import type { Page } from "@playwright/test";
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { retireInternals, runTag, seedColleague } from "./support/backoffice";
import { ownBrand, removeOwnCampaigns } from "./support/campaign-cleanup";
import { civilDateIn } from "./support/campaign-calendar";
import { brandAccount } from "./support/campaign-review";
import { seedCampaignInState } from "./support/campaign-states";
import { expect, open, test } from "./support/journey";
import { withSql } from "./support/verification-cycle";
import enCampaign from "@/locales/en/campaign.json" with { type: "json" };
import enMember from "@/locales/en/member.json" with { type: "json" };
import frCampaign from "@/locales/fr/campaign.json" with { type: "json" };
import frMember from "@/locales/fr/member.json" with { type: "json" };

test.describe.configure({ mode: "serial" });

test.afterAll(async () => {
  await removeOwnCampaigns();
  await retireInternals();
});

const FEED_PATH = /\/api\/v1\/open-campaigns(\?|$)/;

type Seeded = {
  tag: string;
  brandName: string;
  titles: Record<string, string>;
};

let seeded: Seeded | null = null;

/** The days from today of the deadline of each campaign, and the one of the campaign greyed since two days. */
const DEADLINE_DAYS = { alpha: 10, bravo: 20, charlie: 5 } as const;
const GREYED_SINCE_DAYS = 2;

/**
 * A brand and its four published campaigns, written once for the file. The deadline is the live column the feed
 * sorts and greys by (L3D-A §2), moved by the base as a calendar would move it: the snapshot keeps the day the
 * campaign was published with.
 */
async function seedFeed(page: Page): Promise<Seeded> {
  if (seeded !== null) {
    return seeded;
  }
  const tag = runTag("F");
  const agent = await seedColleague("agent", "Alice");
  const brand = await brandAccount(page, {
    name: tag,
    ownerAgentId: agent.accountId,
  });
  ownBrand(brand.accountId);
  const titles = {
    alpha: `Alpha ${tag}`,
    bravo: `Bravo ${tag}`,
    charlie: `Charlie ${tag}`,
    greyed: `Grisee ${tag}`,
  };
  const ids: Record<string, string> = {};
  for (const key of ["alpha", "bravo", "charlie", "greyed"] as const) {
    ids[key] = await seedCampaignInState(page, {
      title: titles[key],
      state: "published",
      decider: agent.accountId,
    });
  }
  await withSql(async (sql) => {
    const days = { ...DEADLINE_DAYS, greyed: -GREYED_SINCE_DAYS };
    for (const [key, id] of Object.entries(ids)) {
      await sql`
        update campaigns.campaigns
           set applications_close_on = ${civilDateIn(days[key as keyof typeof days])}::date
         where id = ${id}::uuid`;
    }
  });
  seeded = { tag, brandName: brand.brandName, titles };
  return seeded;
}

async function signInAsCreator(
  page: Page,
  language: "fr" | "en",
): Promise<void> {
  await seedMember(page, {
    role: "creator",
    language,
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
}

/** The titles of the cards of this run, in the order of the feed. */
async function ownTitles(page: Page, tag: string): Promise<string[]> {
  const titles = await page.locator("[data-feed-card] h2").allInnerTexts();
  return titles.filter((title) => title.includes(tag));
}

test("a creator reads the feed in French at 375 px: the count before the cards, the nature and the notice, no figure, a greyed card with no way in, two sorts (11 RG15, RG26, RG33, RG35, D78)", async ({
  page,
}) => {
  const fr = frCampaign.feed;
  const { tag, brandName, titles } = await seedFeed(page);
  await signInAsCreator(page, "fr");
  await page.setViewportSize({ width: 375, height: 900 });
  await open(page, "/fr/campagnes");
  await expect(
    page.getByRole("heading", { level: 1, name: fr.title }),
  ).toBeVisible();

  // The count of RG35 is in the page BEFORE the first card, and counts every card of the feed.
  const count = page.locator("[data-feed-count]");
  await expect(count).toBeVisible();
  expect(
    Number(await count.getAttribute("data-feed-count")),
  ).toBeGreaterThanOrEqual(4);
  expect(
    await page.evaluate(() => {
      const first = document.querySelector("[data-feed-count]");
      const card = document.querySelector("[data-feed-card]");
      return (
        first !== null &&
        card !== null &&
        (first.compareDocumentPosition(card) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0
      );
    }),
  ).toBe(true);

  // The most recent first (RG33): the last published, then back; the greyed one was published last.
  await expect
    .poll(() => ownTitles(page, tag))
    .toEqual([titles.greyed, titles.charlie, titles.bravo, titles.alpha]);

  // An open card: the brand, the title that opens the campaign, the nature then the notice, the deadline.
  const alpha = page
    .locator("[data-feed-card]")
    .filter({ hasText: titles.alpha });
  await expect(alpha.locator("[data-feed-brand]")).toHaveText(brandName);
  await expect(alpha).toContainText(frCampaign.remuneration.cash);
  await expect(alpha.locator("[data-feed-notice]")).toHaveText(
    frCampaign.budget.negotiate,
  );
  await expect(alpha).toContainText(
    fr.card.deadline.replace("{date}", "").trim(),
  );
  await expect(
    alpha.getByRole("link", { name: new RegExp(`^${fr.card.open}`) }),
  ).toHaveAttribute("href", /^\/fr\/campagnes\/[0-9a-f-]{36}$/);

  // The greyed card (applications closed two days ago): its state in words, and nothing to open (RG26).
  const greyed = page
    .locator("[data-feed-card][data-closed]")
    .filter({ hasText: titles.greyed });
  await expect(greyed).toContainText(fr.closed);
  await expect(greyed.getByRole("link")).toHaveCount(0);

  // No figure, no commission, no way to contact the brand (D46, D48, D78).
  const screen = await page.locator("main").innerText();
  for (const forbidden of [
    "€",
    "EUR",
    "commission",
    "net créateur",
    "candidatures reçues",
  ]) {
    expect(screen, forbidden).not.toContain(forbidden);
  }
  await expect(
    page.locator("main a[href^='mailto:'], main a[href^='tel:']"),
  ).toHaveCount(0);
  await expectNoAxeViolation(page, "creator campaigns feed, FR 375", {
    wcag22: true,
  });

  // The other sort (RG33): the nearest deadline first, the open ones before the greyed one.
  await page.getByLabel(fr.sort.label).selectOption("deadline");
  await expect
    .poll(() => ownTitles(page, tag))
    .toEqual([titles.charlie, titles.alpha, titles.bravo, titles.greyed]);
});

test("a creator reaches the feed by the column in English at 1 440 px: the entry current, the same cards, the sort in English (17 §2.1, §5.5)", async ({
  page,
}) => {
  const en = enCampaign.feed;
  const { tag, titles } = await seedFeed(page);
  await signInAsCreator(page, "en");
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "/en/creator");
  const nav = page.getByRole("navigation", { name: enMember.shell.nav.label });
  await nav
    .getByRole("link", {
      name: enMember.shell.nav.entries.campaigns,
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { level: 1, name: en.title }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/en\/campaigns$/);
  await expect(nav.locator('[aria-current="page"]')).toHaveText(
    enMember.shell.nav.entries.campaigns,
  );

  await expect
    .poll(() => ownTitles(page, tag))
    .toEqual([titles.greyed, titles.charlie, titles.bravo, titles.alpha]);
  const card = page
    .locator("[data-feed-card]")
    .filter({ hasText: titles.alpha });
  await expect(card).toContainText(enCampaign.remuneration.cash);
  await expect(card.locator("[data-feed-notice]")).toHaveText(
    enCampaign.budget.negotiate,
  );
  await expect(
    page
      .locator("[data-feed-card][data-closed]")
      .filter({ hasText: titles.greyed }),
  ).toContainText(en.closed);
  await expect(page.getByLabel(en.sort.label)).toHaveValue("recent");
  await expectNoAxeViolation(page, "creator campaigns feed, EN 1 440", {
    wcag22: true,
  });
});

test("the feed says what happens: a refusal and an error retried, « Voir la suite » that skips a card already seen, the cap said, the empty feed (11 RG21, RG35, RG36; 17 §5.5)", async ({
  page,
}) => {
  const fr = frCampaign.feed;
  await signInAsCreator(page, "fr");
  await page.setViewportSize({ width: 375, height: 900 });

  const card = (n: number) => ({
    id: `7d6f1c43-6a0c-4cc4-9f0b-1c1f5f6d2a0${n}`,
    publishedOn: "2026-11-10",
    applicationsClosed: false,
    campaign: {
      title: `Mock ${n}`,
      audienceTopics: ["beauty"],
      deliverables: [
        { networkCode: "instagram", formatCode: "instagram_reel", quantity: 1 },
      ],
      remunerationKind: "cash",
      audienceCountries: ["FR"],
      startsOn: null,
      endsOn: null,
      applicationsCloseOn: null,
    },
    brand: {
      companyName: `Marque ${n}`,
      hasLogo: false,
      primarySector: null,
      companySize: null,
      badge: null,
    },
    remunerationNotice: "campaign.budget.negotiate",
  });
  const page1 = {
    total: 3,
    page: 1,
    nextPage: 2,
    capReached: false,
    items: [card(1), card(2)],
  };
  const page2 = {
    total: 3,
    page: 2,
    nextPage: null,
    capReached: true,
    items: [card(2), card(3)],
  };
  const refusal = (status: number, code: string, headers = {}) => ({
    status,
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ error: { code, message: code } }),
  });
  const answers: (
    | { status: number; headers: Record<string, string>; body: string }
    | "page1"
    | "empty"
  )[] = [
    refusal(429, "rate_limited", { "retry-after": "7" }),
    refusal(500, "internal_error"),
    "page1",
  ];
  const asked: string[] = [];
  await page.route(FEED_PATH, async (route) => {
    const url = new URL(route.request().url());
    asked.push(
      `${url.searchParams.get("sort")}:${url.searchParams.get("page")}`,
    );
    if (url.searchParams.get("page") === "2") {
      await route.fulfill({ json: page2 });
      return;
    }
    const next = answers.shift() ?? "empty";
    if (next === "page1") {
      await route.fulfill({ json: page1 });
    } else if (next === "empty") {
      await route.fulfill({
        json: {
          total: 0,
          page: 1,
          nextPage: null,
          capReached: false,
          items: [],
        },
      });
    } else {
      await route.fulfill(next);
    }
  });

  await open(page, "/fr/campagnes");
  // A read too often: the delay the API asked, in words, and a way to try again.
  const waitPrefix = fr.rateLimitedWait.split(" {seconds")[0];
  await expect(page.getByText(`${waitPrefix} 7 secondes.`)).toBeVisible();
  await page.getByRole("button", { name: fr.retry }).click();
  await expect(page.getByText(fr.unavailable)).toBeVisible();
  await page.getByRole("button", { name: fr.retry }).click();

  // The first page, the count of every card before it, and « Voir la suite » (never an endless scroll).
  await expect(page.locator("[data-feed-count]")).toHaveText("3 campagnes");
  await expect(page.locator("[data-feed-card]")).toHaveCount(2);
  await page.getByRole("button", { name: fr.more }).click();
  // The second page repeats a card (a publication moved the pages): it is shown once, and the cap is said.
  await expect(page.locator("[data-feed-card]")).toHaveCount(3);
  await expect(
    page.getByText(
      fr.capReached.replace("{count}", "3").replace("{total}", "3"),
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: fr.more })).toHaveCount(0);
  expect(asked).toEqual(["recent:1", "recent:1", "recent:1", "recent:2"]);

  // The empty feed: what a creator can do, not an error.
  await page.reload();
  await expect(page.getByText(fr.empty.title)).toBeVisible();
  await expect(page.getByText(fr.empty.text)).toBeVisible();
  await expect(page.locator("[data-feed-card]")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: fr.empty.profileLink }),
  ).toHaveAttribute("href", "/fr/compte/profil");
  expect(frMember.shell.nav.entries.campaigns).toBe("Campagnes");
});
