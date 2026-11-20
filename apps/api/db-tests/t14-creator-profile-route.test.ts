// L3F commit 07 — L3F-T7: T14 on the profile a brand opens and on its visuals (docs/mvp/18 T14.1,
// T14.3, T14.4; 10 RG4, RG65, CA49, CA50; jalons/l3f/modele.md §2, §3, §8; fiche invariants 2, 15). A
// role other than advertiser gets the answer of a route that does not exist, before any door; an alias
// unknown, excluded by the engine or malformed gets exactly that answer too, compared byte for byte,
// nothing written nor counted; a visual of another creator, rejected, unknown or of an excluded alias
// the same. Accounts COMMITTED through campaign-routes-kit.ts, creators and visuals through
// creator-search-kit.ts.
import type { LightMyRequestResponse } from "fastify";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  closeSearch,
  getProfile,
  getVisual,
  markersIn,
  openingsOf,
  openSearch,
  searchableCreators,
  storedVisual,
  type SearchCreator,
  type StoredVisual,
} from "./creator-search-kit.ts";
import {
  memoryStore,
  publishedBrand,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";

let fx: CampaignRouteFixtures;
let server: Server;
let brand: PublishedBrand;
let creators: SearchCreator[];
let subject: SearchCreator;
/** A creator of the file taken out of the search (E2): his alias is excluded by the engine. */
let excluded: SearchCreator;
let visual: StoredVisual;
let rejected: StoredVisual;
let excludedVisual: StoredVisual;
let theirs: StoredVisual;
/** The answer of an address that does not exist (T14.4). */
let unknownAddress: { status: number; code: string; message: string };

/** The body of a response without its request id: what T14.4 compares byte for byte. */
function bodyOf(response: LightMyRequestResponse): string {
  return response.body.replace(/"requestId":"[^"]*"/, "");
}

/** An alias of the alphabet of profiles.new_creator_alias() that no storefront holds. */
async function unknownAlias(): Promise<string> {
  const alphabet = "23456789BCDFGHJKLMNPQRSTVWXZ";
  for (;;) {
    const alias = Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
    const [held] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from profiles.creator_public_profiles where alias = ${alias}`;
    if (held?.n === 0) {
      return alias;
    }
  }
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  const store = memoryStore();
  server = fx.server({ storage: store });
  await openSearch(fx);
  brand = await publishedBrand(fx, server);
  creators = await searchableCreators(fx, 6);
  subject = creators[0] as SearchCreator;
  excluded = creators[5] as SearchCreator;
  visual = await storedVisual(fx, store, subject, "approved", 1);
  rejected = await storedVisual(fx, store, subject, "rejected");
  theirs = await storedVisual(
    fx,
    store,
    creators[1] as SearchCreator,
    "approved",
    1,
  );
  excludedVisual = await storedVisual(fx, store, excluded, "approved", 1);
  await fx.migration`
    update profiles.creator_public_profiles set is_searchable = false
     where account_id = ${excluded.accountId}`;
  unknownAddress = fx.errorBody(
    await fx.call(server, "GET", "/v1/creator-search-nothing", brand.session),
  );
  expect(unknownAddress).toEqual({
    status: 404,
    code: "not_found",
    message: "Not found",
  });
});

afterAll(async () => {
  await closeSearch(fx);
  await fx.close();
});

describe("L3F-T7 T14.3, T14.4 the brand alone opens a profile (10 RG4, RG65, CA49, CA50; fiche invariants 2, 15)", () => {
  it("T14.3: a creator gets the answer of a route that does not exist on the profile and the visual, nothing of a creator, nothing journaled", async () => {
    const creator = await fx.newMember("creator");
    for (const response of [
      await getProfile(server, creator, subject.alias),
      await getVisual(server, creator, subject.alias, visual.id),
    ]) {
      expect(fx.errorBody(response)).toEqual(unknownAddress);
      expect(response.body).not.toContain(subject.alias);
      expect(markersIn(response, subject.markers)).toEqual([]);
    }
    expect(await openingsOf(fx, creator)).toEqual([]);
  });

  it("T14: no session is 401 on both routes, a brand's session is served (positive control)", async () => {
    expect(
      fx.errorBody(await getProfile(server, null, subject.alias)).status,
    ).toBe(401);
    expect(
      fx.errorBody(await getVisual(server, null, subject.alias, visual.id))
        .status,
    ).toBe(401);
    const served = await getProfile(server, brand, subject.alias);
    expect(served.statusCode, served.body).toBe(200);
    expect(served.json()).toMatchObject({ state: "profile" });
    expect(
      (await getVisual(server, brand, subject.alias, visual.id)).statusCode,
    ).toBe(200);
  });

  it("T14.4, CA49: an alias unknown, excluded by the engine or malformed answers byte for byte as an unknown address, nothing journaled", async () => {
    const searcher = await publishedBrand(fx, server);
    const unknown = await getProfile(server, searcher, await unknownAlias());
    const answers = [
      unknown,
      await getProfile(server, searcher, excluded.alias),
      await getProfile(server, searcher, "not-an-alias"),
      await getProfile(server, searcher, subject.alias.toLowerCase()),
    ];
    for (const response of answers) {
      expect(fx.errorBody(response)).toEqual(unknownAddress);
      expect(bodyOf(response)).toBe(bodyOf(unknown));
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(markersIn(response, excluded.markers)).toEqual([]);
    }
    expect(await openingsOf(fx, searcher)).toEqual([]);
  });

  it("T14.1, T14.4, CA50: a visual rejected, of another creator, unknown, or of an excluded alias answers byte for byte as an unknown address; a malformed id by the shape of the path", async () => {
    const refused = [
      await getVisual(server, brand, subject.alias, rejected.id),
      await getVisual(server, brand, subject.alias, theirs.id),
      await getVisual(server, brand, subject.alias, randomUUID()),
      await getVisual(server, brand, excluded.alias, excludedVisual.id),
      await getVisual(server, brand, await unknownAlias(), visual.id),
    ];
    for (const response of refused) {
      expect(fx.errorBody(response)).toEqual(unknownAddress);
      expect(bodyOf(response)).toBe(
        bodyOf(refused[0] as LightMyRequestResponse),
      );
    }
    const malformed = await getVisual(
      server,
      brand,
      subject.alias,
      "not-a-uuid",
    );
    expect(fx.errorBody(malformed)).toMatchObject({
      status: 400,
      code: "validation_failed",
    });
  });
});
