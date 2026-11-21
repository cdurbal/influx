// The identified creator search of the backoffice (docs/mvp/10 RG16, RG71 to RG73, RG76 to RG78, CA56, CA58; 17b §3.3,
// §4.9; jalons/l3g, commit 12, L3G-E1), in French only (the backoffice has no English before D36, so the second axe
// pass is the narrow desktop width): an agent opens the search and reads the marker (the bar of 4 px, the written
// heading) before any name, then the identities and the exact figures (the name and the alias, the handle as a link
// that opens outside INFLUX, the figures folded, no box to tick, no export, no tariff); a profile not published is
// labelled in words and a pair blocked with the brand of the campaign says its sentence, never a motive; the
// compatible creators of a campaign open the search with the facets of its brief, then one facet is taken away and
// both searches are in the journal with the proposal they come from. The creators, the brand, its campaign and the
// block are written by the base (their decisions are not under test); the screens' words are the locale files',
// never copies. The creators live in ONE audience country that no other file uses (SJ). No amount anywhere.
// Budget 9 s per case.
import { messages as bo } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import {
  retireInternals,
  runTag,
  seedColleague,
  seedInternal,
} from "./support/backoffice";
import { ownBrand, removeOwnCampaigns } from "./support/campaign-cleanup";
import { submittedCampaign } from "./support/campaign-review";
import {
  retireSearchCreators,
  seedSearchableCreators,
  EXACT_FOLLOWERS,
} from "./support/creator-search";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";
import { withSql } from "./support/verification-cycle";

const S = bo.identifiedSearch;

/** The audience country of the creators of this file: FO and AX are the brand search's, GL the base tests'. */
const COUNTRY = "SJ";
const COUNTRY_NAME = "Svalbard et Jan Mayen";

/** What the cleanup needs to find again: the agents who searched, the brands, the campaigns. */
const agents: string[] = [];
const brands: string[] = [];
const campaigns: string[] = [];

test.afterAll(async () => {
  // The journal and the proposals of the searches go before the campaigns they name (a foreign key); the
  // pairs blocked go with their brand. The migration role is free to delete: the journal is append-only for
  // the application's roles only.
  await withSql(async (sql) => {
    if (agents.length > 0) {
      await sql`
        delete from search.search_queries where account_id = any(${agents}::uuid[])`;
    }
    if (campaigns.length > 0) {
      await sql`
        delete from search.campaign_prefills where campaign_id = any(${campaigns}::uuid[])`;
    }
    if (brands.length > 0) {
      await sql`
        delete from matching.party_blocks where advertiser_account_id = any(${brands}::uuid[])`;
    }
  });
  await removeOwnCampaigns();
  await retireSearchCreators();
  await retireInternals();
});

let ownerOnce: ReturnType<typeof seedColleague> | null = null;
/** The colleague who owns the brands of the journeys. */
function owner(): ReturnType<typeof seedColleague> {
  ownerOnce ??= seedColleague("agent", "Alice");
  return ownerOnce;
}

/** A campaign waiting in queue 7 (admitted to the search), its audience country moved to the journeys' own. */
async function campaignInCountry(
  page: Parameters<typeof submittedCampaign>[0],
  tag: string,
): Promise<{ campaignId: string; accountId: string; title: string }> {
  const title = `Gamme ${tag}`;
  const campaign = await submittedCampaign(page, {
    title,
    ownerAgentId: (await owner()).accountId,
  });
  ownBrand(campaign.accountId);
  brands.push(campaign.accountId);
  campaigns.push(campaign.campaignId);
  await withSql(async (sql) => {
    await sql`
      update campaigns.campaign_audience_countries set country_code = ${COUNTRY}
       where campaign_id = ${campaign.campaignId}`;
  });
  return { ...campaign, title };
}

/** The legal name and the city of a creator, as the identity object holds them (layer N: only an agent reads them). */
async function nameCreator(
  accountId: string,
  first: string,
  last: string,
  city: string,
): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      update profiles.creator_identities
         set legal_first_name = ${first}, legal_last_name = ${last}, city = ${city}
       where account_id = ${accountId}`;
  });
}

test("L3G-E1: the marker comes before the names; the identities, the handle as an outside link and the exact figures are read, with no box to tick, no export and no tariff (RG71, RG76, CA61), at 1 440 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const tag = runTag("S");
  const [first, second] = await seedSearchableCreators(
    [{ topic: "beauty" }, { topic: "beauty" }],
    COUNTRY,
  );
  if (first === undefined || second === undefined) {
    throw new Error("the creators were not seeded");
  }
  await nameCreator(first.accountId, "Camille", `Seed ${tag}`, "Lyon");
  const agent = await seedInternal(page, "agent", "Lou");
  agents.push(agent.accountId);

  await page.goto(`${BACKOFFICE_ORIGIN}/createurs/recherche`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(S.title);

  // The marker: a bar of 4 px, a written heading, the warning; the rail holds the entry, current.
  const frame = page.locator("[data-identified-frame]");
  await expect(frame).toContainText(S.frame.mark);
  await expect(frame).toContainText(S.frame.lead);
  await expect(frame).toContainText(S.frame.warning);
  const bar = page.locator("[data-identified-bar]");
  await expect(bar).toBeVisible();
  expect(Math.round((await bar.boundingBox())?.width ?? 0)).toBe(4);
  await expect(
    page
      .getByRole("navigation", { name: bo.nav.label })
      .getByRole("link", { name: bo.nav.creatorSearch }),
  ).toHaveAttribute("aria-current", "page");

  // The facets of the brand's search and the internal ones; the country of the journeys narrows to its creators.
  const facets = page.getByRole("form", { name: S.facets.title });
  await expect(facets).toContainText(S.facets.shared);
  await expect(facets).toContainText(S.facets.internal);
  await facets.getByLabel(S.facets.audienceCountry).selectOption(COUNTRY);
  await facets.getByRole("button", { name: S.facets.submit }).click();

  const results = page.getByRole("region", { name: S.results.label });
  await expect(results.locator("[data-result-count]")).toHaveAttribute(
    "data-result-count",
    "2",
  );
  await expect(results).toContainText(S.results.exactNote);

  // The identities: the name and the alias, the handle as a link that opens outside INFLUX.
  const row = results.locator(`[data-creator-row="${first.alias}"]`);
  await expect(row).toContainText(`Camille Seed ${tag}`);
  await expect(row).toContainText(first.alias);
  const handle = row.getByRole("link", { name: new RegExp(first.handle) });
  await expect(handle).toHaveAttribute("href", first.profileUrl);
  await expect(handle).toHaveAttribute("target", "_blank");
  await expect(handle).toHaveAttribute("rel", /noopener/);
  await expect(handle).toContainText(S.row.opensOutside);
  await expect(row).toContainText(S.row.why("").split(" :")[0] ?? "");
  // The exact figures are folded, then read.
  const exact = row.locator("details");
  await expect(exact).not.toHaveAttribute("open", "");
  await exact.locator("summary").click();
  // the exact figure as the screen writes it (French thousands separator, a non-breaking space)
  const figure = new Intl.NumberFormat("fr-FR").format(EXACT_FOLLOWERS);
  await expect(exact).toContainText(`${figure} abonnés`);
  await expect(exact).toContainText("Lyon");
  await expect(row.getByRole("cell").first()).toBeVisible();

  // No box to tick (the selection comes with « Proposer », Lot 4), no export, no tariff, no amount (D78, D48).
  await expect(results.locator('input[type="checkbox"]')).toHaveCount(0);
  const screen = await page.locator("main").innerText();
  for (const forbidden of [
    "Exporter",
    "Export",
    "Tarif",
    "tarif",
    "€",
    "EUR",
    "commission",
    "net créateur",
  ]) {
    expect(screen, forbidden).not.toContain(forbidden);
  }
  await expectNoAxeViolation(page, "identified search, 1 440", {
    wcag22: true,
  });
});

test("L3G-E1: a profile not published is labelled in words and a pair blocked with the brand of the campaign says one sentence, never its motive nor its author (RG71, 17b l. 868-869), at 1 280 px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const tag = runTag("B");
  const [blocked, draft] = await seedSearchableCreators(
    [{ topic: "beauty" }, { topic: "beauty" }],
    COUNTRY,
  );
  if (blocked === undefined || draft === undefined) {
    throw new Error("the creators were not seeded");
  }
  const campaign = await campaignInCountry(page, tag);
  const agent = await seedInternal(page, "agent", "Lou");
  agents.push(agent.accountId);
  const motive = `motif-${tag}`;
  const author = `auteur-${tag}`;
  await withSql(async (sql) => {
    await sql`
      update profiles.creator_public_profiles
         set status = 'draft', published_at = null
       where account_id = ${draft.accountId}`;
    await sql`
      insert into matching.block_reasons (code, label_key, available_to_side)
      values ('lg_search_block', 'block.reason.lg_search_block', 'any')
      on conflict (code) do nothing`;
    await sql`
      insert into matching.party_blocks
        (advertiser_account_id, creator_account_id, blocked_by_account_id, blocked_by_side,
         reason_code, comment)
      values (${campaign.accountId}, ${blocked.accountId}, ${agent.accountId}, 'influx',
              'lg_search_block', ${`${motive} ${author}`})`;
  });

  await page.goto(
    `${BACKOFFICE_ORIGIN}/createurs/recherche?campagne=${campaign.campaignId}`,
  );
  const results = page.getByRole("region", { name: S.results.label });
  await expect(results.locator("[data-result-count]")).toHaveAttribute(
    "data-result-count",
    "2",
  );

  // The profile not published: its state in words, as a text, beside the words « Non publié ».
  const draftRow = results.locator(`[data-creator-row="${draft.alias}"]`);
  await expect(draftRow).toContainText(`${S.unpublished} · ${S.states.draft}`);
  await expect(draftRow).not.toContainText(S.row.blockedPhrase);

  // The pair blocked stays in the list, flagged, with its sentence and nothing else.
  const blockedRow = results.locator(`[data-creator-row="${blocked.alias}"]`);
  await expect(blockedRow).toContainText(S.row.blockedState);
  await expect(blockedRow).toContainText(S.row.blockedPhrase);
  const screen = await page.locator("main").innerText();
  expect(screen).not.toContain(motive);
  expect(screen).not.toContain(author);
  expect(screen).not.toContain("lg_search_block");
  await expectNoAxeViolation(page, "identified search blocked, 1 280", {
    wcag22: true,
  });
});

test("L3G-E1: the compatible creators of a campaign open the search with the facets of its brief; one facet taken away, both searches are in the journal with the proposal they come from (RG73, CA56)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const tag = runTag("P");
  await seedSearchableCreators(
    [{ topic: "beauty" }, { topic: "beauty" }],
    COUNTRY,
  );
  const campaign = await campaignInCountry(page, tag);
  const agent = await seedInternal(page, "agent", "Lou");
  agents.push(agent.accountId);

  // From the record of the campaign: the block, then the search it opens.
  await page.goto(
    `${BACKOFFICE_ORIGIN}/inscrits/campagnes/${campaign.campaignId}`,
  );
  const block = page.getByRole("region", { name: S.compatible.title });
  await expect(block).toContainText(S.compatible.lead);
  await block.getByRole("link", { name: S.compatible.open }).click();
  await expect(page).toHaveURL(
    `${BACKOFFICE_ORIGIN}/createurs/recherche?campagne=${campaign.campaignId}`,
  );

  // The facets are those of the brief, named after the campaign; the results are the creators that match all.
  await expect(page.locator("[data-prefill-line]")).toContainText(
    S.origin.prefilled(campaign.title),
  );
  const chips = page.getByRole("list", { name: S.criteria.label });
  await expect(chips).toContainText(S.criteria.topic("Beauty"));
  await expect(chips).toContainText(S.criteria.networks("Instagram"));
  await expect(chips).toContainText(S.criteria.audienceCountry(COUNTRY_NAME));
  await expect(chips).toContainText(S.criteria.languages("français"));
  const results = page.getByRole("region", { name: S.results.label });
  await expect(results.locator("[data-result-count]")).toHaveAttribute(
    "data-result-count",
    "2",
  );

  // One facet taken away: its chip goes, the search is made again, the proposal is still the one.
  await page
    .getByRole("button", {
      name: S.criteria.remove(S.criteria.languages("français")),
    })
    .click();
  await expect(chips).not.toContainText(S.criteria.languages("français"));
  await expect(chips).toContainText(S.criteria.topic("Beauty"));
  await expect(results.locator("[data-result-count]")).toHaveAttribute(
    "data-result-count",
    "2",
  );

  // The journal: two searches, each naming the proposal it comes from; the second holds one facet fewer than the
  // proposal (what is kept, removed and added is derived from the pair by search.prefill_diff(), CA56).
  const journal = await withSql(
    (sql) => sql<
      { proposed: Record<string, unknown>; filters: Record<string, unknown> }[]
    >`
      select p.proposed, q.filters
        from search.search_queries q
        join search.campaign_prefills p on p.id = q.prefill_id
       where q.account_id = ${agent.accountId}
       order by q.created_at, q.id`,
  );
  expect(journal).toHaveLength(2);
  expect(Object.keys(journal[0]?.proposed ?? {})).toContain("F8");
  expect(journal[0]?.filters).toEqual(journal[0]?.proposed);
  expect(Object.keys(journal[1]?.filters ?? {})).not.toContain("F8");
  expect(Object.keys(journal[1]?.filters ?? {})).toContain("F1");
  await expectNoAxeViolation(page, "identified search prefilled, 1 440", {
    wcag22: true,
  });
});
