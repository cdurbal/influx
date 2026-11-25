// RUA-T7 (jalons/rua/04.md; docs/mvp/22-refonte-ux-ui/05 §4): the loaders of the synthetic acceptance data
// set write what they promise, in the local stack, through the helpers the journeys already use. Two cases
// for three spaces: the brand and the backoffice, then the creator. Each case opens one screen that reads
// what was written (the list of campaigns, the verification of a profile): nothing is compared to a mockup
// here (the tool is RUA-03's, the screens are RUB's). No amount anywhere. Budget: 5 s for the two cases.
import { BRAND_DATA, CREATOR_DATA } from "./fixtures/recette";
import { expect, open, test } from "./support/journey";
import {
  cleanRecette,
  loadBackofficeSpace,
  loadBrandSpace,
  loadCreatorSpace,
} from "./support/recette";

test.afterAll(async () => {
  await cleanRecette();
});

test("RUA-T7: the brand space and the backoffice space load their data (Maison Azur, its campaigns, two creators, a brand profile, two signups)", async ({
  page,
}) => {
  const brand = await loadBrandSpace(page, {
    campaigns: ["draft", "published", "rejected"],
    creators: true,
  });
  expect(brand.brandName).toBe(`Maison ${BRAND_DATA.name}`);
  expect(Object.keys(brand.campaigns).sort()).toEqual([
    "draft",
    "published",
    "rejected",
  ]);
  expect(brand.creators).toHaveLength(BRAND_DATA.searchableCreators.length);

  const backoffice = await loadBackofficeSpace(page, {
    role: "admin",
    brandEntries: 1,
    signups: 2,
  });
  expect(backoffice.brandEntries).toHaveLength(1);
  expect(backoffice.signups).toHaveLength(2);
  expect(backoffice.agentId).not.toBe(backoffice.ownerAgentId);

  await open(page, "/fr/campagnes");
  const main = page.locator("main");
  for (const state of ["draft", "published", "rejected"] as const) {
    const wanted = BRAND_DATA.campaigns.find(
      (campaign) => campaign.state === state,
    );
    await expect(main).toContainText(wanted?.title ?? "");
  }
});

test("RUA-T7: the creator space loads its profile and the lines of its verification (an active badge, one to reconfirm, a withdrawn one, a refusal)", async ({
  page,
}) => {
  const creator = await loadCreatorSpace(page, { verification: true });
  expect(creator.verifiedNetworks.sort()).toEqual(
    [
      ...new Set(CREATOR_DATA.verification.map((line) => line.networkCode)),
    ].sort(),
  );

  await open(page, "/fr/compte/profil");
  for (const network of ["instagram", "tiktok"]) {
    await expect(
      page.locator(`[data-verification-line="${network}"]`),
    ).toHaveCount(1);
  }
});
