// M4, the brand's anonymous creator search (docs/mvp/10 RG1, RG3, RG6, RG41, RG44, RG57 to RG60, RG64, CA35, CA37,
// CA59; 17 §4.4, §7.1; D38, D48, D78; jalons/l3f, commit 10, L3F-E1): the search closed keeps the criteria and the
// request (French, 375 px, axe); below the threshold the screen is the same for 0 and for 4 profiles and its
// widenings are the contract's list (French); the results come as cards with their reasons « Proposé car », the
// sort and the criteria change the search, nothing identifying is on the page (English, 1 440 px, axe); the bucket
// of the account full is told and the request stays (French). The brand, its creators, the switch and the bucket
// are written by the base (the decisions are not under test); the texts are the locale files', never copies. The
// switch is held under an advisory lock (support/creator-search.ts). No amount anywhere. Budget 12 s.
import enCreatorSearch from "@/locales/en/creator-search.json" with { type: "json" };
import frCreatorSearch from "@/locales/fr/creator-search.json" with { type: "json" };
import { expectNoAxeViolation } from "./support/axe";
import { removeOwnCampaigns } from "./support/campaign-cleanup";
import {
  EXACT_FOLLOWERS,
  fillSearchBucket,
  retireSearchCreators,
  SEARCH_COUNTRY,
  seedSearchableCreators,
  signedInBrand,
  withSearchSwitch,
} from "./support/creator-search";
import { expect, open, test, title } from "./support/journey";

test.afterAll(async () => {
  await retireSearchCreators();
  await removeOwnCampaigns();
});

/** Six creators in SEARCH_COUNTRY: four of one topic, two of another (so that a topic alone falls under k = 5). */
const SIX = [
  { topic: "pets" },
  { topic: "pets" },
  { topic: "pets" },
  { topic: "pets" },
  { topic: "gaming" },
  { topic: "gaming" },
];

test("L3F-E1: the search closed keeps the criteria and the request for a selection (D38, CA59), in French at 375 px", async ({
  page,
}) => {
  const copy = frCreatorSearch;
  await page.setViewportSize({ width: 375, height: 800 });
  await withSearchSwitch("closed", async () => {
    await signedInBrand(page, "fr");
    await open(page, `/fr/createurs?F6=${SEARCH_COUNTRY}`);
    await expect(title(page)).toHaveText(copy.page.title);
    const main = page.locator("main");
    await expect(main.getByText(copy.closed.notice)).toBeVisible();
    await expect(main.locator("[data-search-card]")).toHaveCount(0);
    await expect(main.locator("[data-count-band]")).toHaveCount(0);
    // the criteria are kept, and the request carries them (reprise)
    await expect(main.locator('[data-criterion="F6"]')).toBeVisible();
    const requests = main.getByRole("link", { name: copy.request.link });
    await expect(requests).toHaveCount(2);
    for (const request of await requests.all()) {
      await expect(request).toHaveAttribute(
        "href",
        `/fr/createurs/demande-de-selection?F6=${SEARCH_COUNTRY}`,
      );
    }
    // no search bar, and the explanation says why (RG6)
    await expect(main.getByRole("searchbox")).toHaveCount(0);
    await expect(main.getByText(copy.page.explain)).toBeVisible();
    // « Mes sélections » has its own way on a phone, the search closed or not (D74, L3FU-3)
    await expect(main.locator("[data-shortlists-link]")).toBeVisible();
    await expectNoAxeViolation(page, "creator search closed, fr, 375", {
      wcag22: true,
    });
  });
});

test("L3F-E1: below the threshold the screen is the same for 0 and for 4 profiles, and the widenings are the contract's (RG58, RG60, CA35, CA37), in French", async ({
  page,
}) => {
  const copy = frCreatorSearch;
  await page.setViewportSize({ width: 375, height: 800 });
  await seedSearchableCreators(SIX);
  await withSearchSwitch("open", async () => {
    await signedInBrand(page, "fr");
    const main = page.locator("main");
    const readNarrow = async (topic: string) => {
      await open(page, `/fr/createurs?F6=${SEARCH_COUNTRY}&F1=${topic}`);
      const card = main.locator('[data-state="too_narrow"]').locator("..");
      await expect(card).toContainText(copy.tooNarrow.title);
      await expect(main.locator("[data-count-band]")).toHaveCount(0);
      await expect(main.locator("[data-search-card]")).toHaveCount(0);
      return card.innerText();
    };
    // four profiles (pets) and none (travel): one and the same screen, word for word
    const four = await readNarrow("pets");
    const none = await readNarrow("travel");
    expect(four).toBe(none);
    // the widenings: the facets the query holds, in the order of WIDENING_ORDER (F6 before F1), nothing asked
    const widenings = main.locator("[data-widen]");
    await expect(widenings).toHaveCount(2);
    expect(
      await widenings.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute("data-widen")),
      ),
    ).toEqual(["F6", "F1"]);
    // removing the topic widens the search to the six creators of the country
    await main.locator('[data-widen="F1"]').click();
    await expect(page).toHaveURL(
      new RegExp(`/fr/createurs\\?F6=${SEARCH_COUNTRY}$`),
    );
    await expect(main.locator("[data-search-card]")).toHaveCount(6);
    await expect(main.locator('[data-count-band="5_9"]')).toHaveText(
      copy.bands["5_9"],
    );
  });
});

test("L3F-E1: the results come as cards with their reasons, the sort and the criteria change the search, nothing identifying is shown (RG41, RG44, RG48), in English at 1 440 px", async ({
  page,
}) => {
  const copy = enCreatorSearch;
  await page.setViewportSize({ width: 1440, height: 900 });
  const creators = await seedSearchableCreators(SIX);
  await withSearchSwitch("open", async () => {
    await signedInBrand(page, "en");
    await open(page, `/en/creators?F6=${SEARCH_COUNTRY}`);
    await expect(title(page)).toHaveText(copy.page.title);
    const main = page.locator("main");
    const cards = main.locator("[data-search-card]");
    await expect(cards).toHaveCount(6);
    await expect(main.locator("[data-count-band]")).toHaveText(
      copy.bands["5_9"],
    );
    // each card: its alias, then « Suggested because », its reasons in words, no handle nor figure
    for (const creator of creators) {
      const card = main.locator(`[data-search-card="${creator.alias}"]`);
      await expect(card).toBeVisible();
      await expect(card.locator("[data-reasons]")).toContainText(
        copy.reasons.title,
      );
      await expect(card.locator("[data-reasons] li").first()).toBeVisible();
    }
    const screen = await main.innerText();
    for (const creator of creators) {
      expect(screen).not.toContain(creator.handle);
      expect(screen).not.toContain(creator.profileUrl);
    }
    expect(screen).not.toContain(String(EXACT_FOLLOWERS));
    for (const forbidden of ["€", "EUR", "commission"]) {
      expect(screen, forbidden).not.toContain(forbidden);
    }
    // no action of introduction: the card offers none (RG55, D45)
    await expect(
      main.getByRole("button", { name: /introduc|in touch/i }),
    ).toHaveCount(0);

    // the sort is named, and a change is a new search carried by the address
    await main
      .getByLabel(copy.sort.label, { exact: true })
      .selectOption("audience");
    await expect(page).toHaveURL(
      new RegExp(`/en/creators\\?F6=${SEARCH_COUNTRY}&sort=audience$`),
    );
    await expect(cards).toHaveCount(6);

    // a criterion of the form: a network ticked, applied, then removed by its chip
    const form = main.getByRole("form", { name: copy.filters.title });
    await form.getByText(copy.facets.F3, { exact: true }).click();
    await form.getByLabel("Instagram", { exact: true }).check();
    await form.getByRole("button", { name: copy.filters.apply }).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/en/creators\\?F3=instagram&F6=${SEARCH_COUNTRY}&sort=audience$`,
      ),
    );
    await expect(cards).toHaveCount(6);
    await main.locator('[data-criterion="F3:instagram"]').click();
    await expect(page).toHaveURL(
      new RegExp(`/en/creators\\?F6=${SEARCH_COUNTRY}&sort=audience$`),
    );
    await expect(cards).toHaveCount(6);
    await expectNoAxeViolation(page, "creator search results, en, 1440", {
      wcag22: true,
    });
  });
});

test("L3F-E1: the bucket of the account full is told and the request stays (RG64), in French", async ({
  page,
}) => {
  const copy = frCreatorSearch;
  await page.setViewportSize({ width: 375, height: 800 });
  await withSearchSwitch("open", async () => {
    const brand = await signedInBrand(page, "fr");
    await fillSearchBucket(brand.accountId);
    await open(page, `/fr/createurs?F6=${SEARCH_COUNTRY}`);
    const main = page.locator("main");
    await expect(main.locator('[data-state="rate_limited"]')).toHaveText(
      copy.rateLimited.text,
    );
    await expect(main.locator("[data-search-card]")).toHaveCount(0);
    // the request is still there, with the criteria; the criteria stay editable
    await expect(
      main.getByRole("link", { name: copy.request.link }).last(),
    ).toHaveAttribute(
      "href",
      `/fr/createurs/demande-de-selection?F6=${SEARCH_COUNTRY}`,
    );
    await expect(main.locator('[data-criterion="F6"]')).toBeVisible();
    await expect(main.getByRole("button", { name: /^Filtres/ })).toBeVisible();
  });
});
