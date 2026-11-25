// L3E commit 08 — L3E-T8: T14 on the brand's creator search route (docs/mvp/18 T14.1, T14.3, T14.4;
// 10 RG1, RG37; jalons/l3e/modele.md §4, §10; fiche invariant 14). A role other than advertiser gets,
// whatever its body, the answer of a route that does not exist, before any door; the campaign of
// origin of another brand gets exactly the answer of a campaign nobody holds (the same status, code
// and body), nothing written; a brand whose profile is suspended gets the answer of RG1, no list.
// Accounts COMMITTED through campaign-routes-kit.ts, creators through creator-search-kit.ts.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  closeSearch,
  forgetCampaignSearches,
  HERE,
  markersIn,
  openSearch,
  postSearch,
  searchableCreators,
  searchesOf,
  URL_SEARCH,
  type SearchCreator,
} from "./creator-search-kit.ts";
import {
  brandCampaign,
  publishedBrand,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";

let fx: CampaignRouteFixtures;
let server: Server;
let brand: PublishedBrand;
let creators: SearchCreator[];
/** The brands whose campaigns were searched from: their journal lines go before the campaigns. */
const searchedFrom: PublishedBrand[] = [];
/** The answer of an address that does not exist (T14.4). */
let unknownAddress: { status: number; code: string; message: string };

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server();
  await openSearch(fx);
  brand = await publishedBrand(fx, server);
  creators = await searchableCreators(fx, 5);
  unknownAddress = fx.errorBody(
    await fx.call(server, "POST", `${URL_SEARCH}-nothing`, brand.session, {
      filters: HERE,
    }),
  );
  expect(unknownAddress).toEqual({
    status: 404,
    code: "not_found",
    message: "Not found",
  });
});

afterAll(async () => {
  await forgetCampaignSearches(fx, searchedFrom);
  await closeSearch(fx);
  await fx.close();
});

describe("L3E-T8 T14.3, T14.4 the brand alone reaches the search (10 RG1; fiche invariant 14)", () => {
  it("T14.3: a creator gets the answer of a route that does not exist, nothing of a creator, nothing journaled", async () => {
    const creator = await fx.newMember("creator");
    for (const body of [
      { filters: HERE },
      { filters: HERE, campaignId: randomUUID() },
    ]) {
      const response = await postSearch(server, creator, body);
      expect(fx.errorBody(response)).toEqual(unknownAddress);
      expect(
        markersIn(
          response,
          creators.flatMap((c) => c.markers),
        ),
      ).toEqual([]);
      for (const searched of creators) {
        expect(response.body).not.toContain(searched.alias);
      }
    }
    expect(await searchesOf(fx, creator)).toEqual([]);
  });

  it("T14: no session is 401, a brand's session is served (positive control)", async () => {
    const anonymous = await postSearch(server, null, { filters: HERE });
    expect(fx.errorBody(anonymous).status).toBe(401);
    const served = await postSearch(server, brand, { filters: HERE });
    expect(served.statusCode, served.body).toBe(200);
    expect(served.json()).toMatchObject({ state: "results" });
  });

  it("T14.1, T14.4: the campaign of origin of another brand answers as one nobody holds, both as an unknown address, nothing written", async () => {
    const searcher = await publishedBrand(fx, server);
    searchedFrom.push(searcher);
    const other = await publishedBrand(fx, server);
    const theirs = await brandCampaign(fx, server, other);
    const mine = await brandCampaign(fx, server, searcher);
    const foreign = await postSearch(server, searcher, {
      filters: HERE,
      campaignId: theirs.id,
    });
    const nobody = await postSearch(server, searcher, {
      filters: HERE,
      campaignId: randomUUID(),
    });
    expect(fx.errorBody(foreign)).toEqual(unknownAddress);
    expect(fx.errorBody(nobody)).toEqual(unknownAddress);
    expect(foreign.body.replace(/"requestId":"[^"]*"/, "")).toBe(
      nobody.body.replace(/"requestId":"[^"]*"/, ""),
    );
    expect(foreign.body).not.toContain(theirs.title);
    expect(markersIn(foreign, theirs.markers)).toEqual([]);
    expect(await searchesOf(fx, searcher)).toEqual([]);
    // positive control: its own campaign is served, and journaled with it
    const served = await postSearch(server, searcher, {
      filters: HERE,
      campaignId: mine.id,
    });
    expect(served.statusCode, served.body).toBe(200);
    expect(await searchesOf(fx, searcher)).toEqual([
      expect.objectContaining({ outcome: "served", campaign_id: mine.id }),
    ]);
  });

  it("fiche invariant 14: a brand whose profile is suspended gets the answer of RG1, no list, nothing journaled", async () => {
    const suspended = await publishedBrand(fx, server);
    expect(
      (await postSearch(server, suspended, { filters: HERE })).statusCode,
    ).toBe(200);
    await fx.setProfileStatus(suspended, "suspended");
    const response = await postSearch(server, suspended, { filters: HERE });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ state: "brand_not_published" });
    for (const searched of creators) {
      expect(response.body).not.toContain(searched.alias);
    }
    expect(await searchesOf(fx, suspended)).toHaveLength(1);
  });
});
