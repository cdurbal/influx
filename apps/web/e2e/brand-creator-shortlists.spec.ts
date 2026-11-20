// The anonymous profile, the private lists and the request to the INFLUX team (docs/mvp/10 RG1, RG15, RG48, RG50,
// RG51, RG55, RG61, RG63; 17 §4.4, §4.9, §7.1; D38, D45, D46, D48, D78; jalons/l3f, commit 11, L3F-E2): a brand opens
// a profile from its search (English, 1 440 px, axe: the card whole, three visuals read from stored objects, the
// region the base serves, only « Ajouter à ma sélection » and the request, nothing identifying), builds a list from
// its cards and manages it (French, 375 px, axe: the sticky panel above the bottom bar, the page of its lists, its
// page: rename, attach to a campaign, note, remove, delete) and asks the INFLUX team for a selection with the search
// CLOSED (French, 375 px: the criteria and the campaign taken back, a delay named, never a promise). The brand, its
// creators, the visuals, the switch and the campaign are written by the base and the API's own doors (the decisions
// are not under test); the texts are the locale files', never copies. No amount anywhere. Budget 13 s.
import enCreatorSearch from "@/locales/en/creator-search.json" with { type: "json" };
import frCreatorSearch from "@/locales/fr/creator-search.json" with { type: "json" };
import { retireInternals, seedColleague } from "./support/backoffice";
import { expectNoAxeViolation } from "./support/axe";
import { removeOwnCampaigns } from "./support/campaign-cleanup";
import { seedCampaignInState } from "./support/campaign-states";
import {
  EXACT_FOLLOWERS,
  listsOf,
  PROFILE_COUNTRY,
  removeOwnSelections,
  requestsOf,
  retireSearchCreators,
  seedCreatorWithVisuals,
  seedSearchableCreators,
  signedInBrand,
  withSearchSwitch,
} from "./support/creator-search";
import { expect, open, test, title } from "./support/journey";

test.afterAll(async () => {
  await retireSearchCreators();
  await removeOwnSelections();
  await removeOwnCampaigns();
  await retireInternals();
});

/** Five creators of one topic, all of one region of residence (RG15 shows it from five storefronts sharing it). */
const FIVE = Array.from({ length: 5 }, () => ({
  topic: "pets",
  region: "FR-IDF",
}));
const CAPTION = "Mon plat du jour";

test("L3F-E2: a brand opens a profile: the card whole, three visuals, the region, two actions and nothing identifying (RG15, RG48, RG50, RG55), in English at 1 440 px", async ({
  page,
}) => {
  const copy = enCreatorSearch;
  const agent = await seedColleague("agent", "Alice");
  await seedSearchableCreators(FIVE, PROFILE_COUNTRY);
  const visual = await seedCreatorWithVisuals(page, {
    spec: { topic: "pets", region: "FR-IDF" },
    country: PROFILE_COUNTRY,
    visuals: 3,
    agentId: agent.accountId,
    caption: CAPTION,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await withSearchSwitch("open", async () => {
    const brand = await signedInBrand(page, "en");
    await open(page, `/en/creators?F6=${PROFILE_COUNTRY}`);
    const main = page.locator("main");
    const found = main.locator(`[data-search-card="${visual.alias}"]`);
    await expect(found).toBeVisible();
    // the card of the grid shows one visual, and no more
    await expect(found.locator("[data-visual] img")).toHaveCount(1);
    await found.locator("[data-open-profile]").click();
    await expect(page).toHaveURL(
      new RegExp(
        `/en/creators/profile/${visual.alias}\\?F6=${PROFILE_COUNTRY}$`,
      ),
    );
    await expect(title(page)).toHaveText(copy.profile.title);

    // the card, whole: its alias, its title, three visuals read from the stored objects, the region of the base
    const profile = main.locator("[data-profile]");
    await expect(
      profile.getByRole("heading", { level: 2, name: /^Profile \S+$/ }),
    ).toBeVisible();
    await expect(profile.locator("[data-visual] img")).toHaveCount(3);
    await expect(profile.locator("[data-visual]").first()).toContainText(
      CAPTION,
    );
    await expect(
      profile.locator('[data-field="residenceRegion"]'),
    ).toContainText("FR-IDF");
    await expect(profile.locator("[data-reasons] li").first()).toBeVisible();

    // two actions, two only: the add button and the request; nothing leads to an introduction
    await expect(profile.getByRole("button")).toHaveCount(1);
    await expect(profile.locator("[data-add-to-selection]")).toHaveText(
      copy.shortlist.add,
    );
    await expect(
      profile.getByRole("link", { name: copy.request.link }),
    ).toHaveAttribute(
      "href",
      `/en/creators/selection-request?F6=${PROFILE_COUNTRY}`,
    );
    await expect(
      main.getByRole("button", { name: /introduc|in touch/i }),
    ).toHaveCount(0);

    // nothing identifying, no amount (the handle and the link the seed gave are never on the page)
    const screen = await main.innerText();
    expect(screen).not.toContain(visual.handle);
    expect(screen).not.toContain(visual.profileUrl);
    expect(screen).not.toContain(String(EXACT_FOLLOWERS));
    for (const forbidden of ["€", "EUR", "commission"]) {
      expect(screen, forbidden).not.toContain(forbidden);
    }

    // the add: the list is made on the spot, the creator is in it, and the base kept exactly that
    await profile.locator("[data-add-to-selection]").click();
    await expect(profile.locator("[data-add-to-selection]")).toHaveAttribute(
      "data-held",
      "yes",
    );
    await expect(
      profile.getByText(
        copy.shortlist.inList.replace("{name}", copy.shortlist.defaultName),
      ),
    ).toBeVisible();
    expect(await listsOf(brand.accountId)).toEqual([
      {
        name: copy.shortlist.defaultName,
        campaignId: null,
        aliases: [visual.alias],
        notes: [null],
      },
    ]);
    await expectNoAxeViolation(page, "anonymous profile, en, 1440", {
      wcag22: true,
    });

    // back to the search: the panel shows the list and the creator, the profile still says it is held
    await main.getByRole("link", { name: copy.profile.back }).click();
    const panel = main.locator('[data-selection-panel="ready"]');
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText(
      copy.panel.title.replace("{count}", "1"),
    );
    await expect(panel.locator("[data-selection-member]")).toHaveCount(1);
    await expect(
      main.locator(`[data-add-to-selection="${visual.alias}"]`),
    ).toHaveAttribute("data-held", "yes");
  });
});

test("L3F-E2: the panel sticks above the bottom bar, the lists are made, renamed, attached to a campaign, noted, emptied and deleted, no one told (RG51, RG63, D45), in French at 375 px", async ({
  page,
}) => {
  const copy = frCreatorSearch;
  await page.setViewportSize({ width: 375, height: 800 });
  const creators = await seedSearchableCreators(
    [...FIVE, ...FIVE.slice(0, 1)],
    PROFILE_COUNTRY,
  );
  await withSearchSwitch("open", async () => {
    const brand = await signedInBrand(page, "fr");
    const campaignId = await seedCampaignInState(page, {
      title: "Rentrée 2026",
      state: "pending_review",
      decider: brand.accountId,
    });
    await open(page, `/fr/createurs?F6=${PROFILE_COUNTRY}`);
    const main = page.locator("main");
    await expect(main.locator("[data-search-card]")).toHaveCount(6);

    // two creators added one at a time from their cards: no « tout sélectionner », nothing else offered
    const [first, second] = creators;
    for (const creator of [first, second]) {
      const add = main.locator(`[data-add-to-selection="${creator?.alias}"]`);
      await add.click();
      await expect(add).toHaveAttribute("data-held", "yes");
    }
    await expect(main.getByText(/tout sélectionner|tout ajouter/i)).toHaveCount(
      0,
    );

    // the panel is a sticky bar above the bottom navigation, « privée », its creators behind its button
    const panel = main.locator('[data-selection-panel="ready"]');
    await expect(panel.getByRole("heading", { level: 2 })).toHaveText(
      copy.panel.title.replace("{count}", "2"),
    );
    await expect(panel).toBeInViewport();
    const bar = await panel.boundingBox();
    const nav = await page.locator("[data-member-nav]").boundingBox();
    expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(
      (nav?.y ?? 0) + 1,
    );
    await expect(panel.locator("[data-selection-member]").first()).toBeHidden();
    await panel.locator("[data-selection-toggle]").click();
    await expect(panel.getByText(copy.panel.private)).toBeVisible();
    await expect(panel.locator("[data-selection-member]")).toHaveCount(2);
    await expect(
      panel.locator("[data-selection-member]").first(),
    ).toBeVisible();

    // « Mes sélections »: the list, its count, then its page
    await panel.getByRole("link", { name: copy.panel.all }).click();
    await expect(page).toHaveURL(/\/fr\/createurs\/selections$/);
    await expect(title(page)).toHaveText(copy.lists.title);
    const listCard = main.locator("[data-shortlist]");
    await expect(listCard).toHaveCount(1);
    await expect(listCard).toContainText("2 créateurs");
    await listCard.locator("[data-open-shortlist]").click();
    await expect(page).toHaveURL(/\/fr\/createurs\/selections\/[0-9a-f-]{36}$/);

    // rename it and attach it to a campaign: the base keeps both
    const form = main.locator("[data-shortlist-form]");
    await form.getByLabel(copy.lists.form.name).fill("Rentrée beauté");
    await form
      .getByLabel(copy.lists.form.campaign)
      .selectOption({ label: "Rentrée 2026" });
    await form.locator("[data-shortlist-submit]").click();
    await expect(form.locator("[data-shortlist-saved]")).toHaveText(
      copy.list.edit.saved,
    );
    await expect(title(page)).toHaveText("Rentrée beauté");
    const [renamed] = await listsOf(brand.accountId);
    expect(renamed).toMatchObject({ name: "Rentrée beauté", campaignId });

    // the brand's own note on a creator, read by nobody else
    const items = main.locator("[data-shortlist-item]");
    await expect(items).toHaveCount(2);
    const target = items.filter({
      has: page.locator(`[data-save-note="${first?.alias}"]`),
    });
    await target
      .getByLabel(copy.list.note.label)
      .fill("À rappeler en septembre");
    await target.locator(`[data-save-note="${first?.alias}"]`).click();
    await expect(target.locator("[data-note-saved]")).toHaveText(
      copy.list.note.saved,
    );
    const [noted] = await listsOf(brand.accountId);
    expect(noted?.notes).toContain("À rappeler en septembre");

    // one creator taken out, the other stays, then the list deleted after a confirmation that says no one is told
    await main.locator(`[data-remove-item="${second?.alias}"]`).click();
    await expect(items).toHaveCount(1);
    const [emptied] = await listsOf(brand.accountId);
    expect(emptied?.aliases).toEqual([first?.alias]);
    await main.locator("[data-delete-list]").click();
    await expect(main.locator("[data-delete-confirm]")).toHaveText(
      copy.list.delete.confirm,
    );
    await main.locator("[data-delete-confirmed]").click();
    await expect(page).toHaveURL(/\/fr\/createurs\/selections$/);
    await expect(main.locator('[data-state="no_lists"]')).toHaveText(
      copy.lists.empty,
    );
    expect(await listsOf(brand.accountId)).toEqual([]);
    await expectNoAxeViolation(page, "shortlists, fr, 375", { wcag22: true });
  });
});

test("L3F-E2: the request for a selection takes the criteria and the campaign back, names a delay and no promise, with the search closed (RG61, D38, D46), in French at 375 px", async ({
  page,
}) => {
  const copy = frCreatorSearch;
  await page.setViewportSize({ width: 375, height: 800 });
  await withSearchSwitch("closed", async () => {
    const brand = await signedInBrand(page, "fr");
    const campaignId = await seedCampaignInState(page, {
      title: "Rentrée 2026",
      state: "pending_review",
      decider: brand.accountId,
    });
    await open(
      page,
      `/fr/createurs/demande-de-selection?F6=${PROFILE_COUNTRY}&campaign=${campaignId}`,
    );
    const main = page.locator("main");
    await expect(title(page)).toHaveText(copy.selectionRequest.title);
    // the criteria of the search come back, the campaign is chosen, nothing asks for a contact
    await expect(main.locator("[data-request-criteria] li")).toHaveCount(1);
    await expect(main.getByLabel(copy.selectionRequest.campaign)).toHaveValue(
      campaignId,
    );
    await expect(
      main.getByText(copy.selectionRequest.messageHelp),
    ).toBeVisible();
    await expectNoAxeViolation(page, "selection request, fr, 375", {
      wcag22: true,
    });
    await main
      .getByLabel(copy.selectionRequest.message)
      .fill("Des profils animaliers, un ton posé, pour septembre.");
    await main.locator("[data-send-request]").click();

    // the confirmation names the day the team answers by, the one the base fixed, and promises no result
    await expect(main.locator("[data-request-sent]")).toHaveText(
      copy.selectionRequest.sent.title,
    );
    const [stored] = await requestsOf(brand.accountId);
    expect(stored).toMatchObject({
      campaignId,
      filters: { F6: { country: PROFILE_COUNTRY } },
      language: "fr",
      message: "Des profils animaliers, un ton posé, pour septembre.",
      state: "open",
    });
    const day = new Intl.DateTimeFormat("fr", { dateStyle: "long" }).format(
      stored?.dueAt,
    );
    await expect(
      main.getByText(copy.selectionRequest.sent.text.replace("{date}", day)),
    ).toBeVisible();
    await expect(main.getByText(copy.selectionRequest.sent.note)).toBeVisible();
    await expect(
      main.getByRole("button", { name: /introduc|mise en relation/i }),
    ).toHaveCount(0);
  });
});
