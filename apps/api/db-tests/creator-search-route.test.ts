// L3E commit 08 — L3E-T8: the brand's anonymous creator search route, POST /v1/creator-search (docs/
// mvp/10 RG1, RG2, RG41, RG42, RG48, RG57 to RG59, RG63, RG65, RG66; CA1, CA3, CA34 to CA36, CA41, CA42,
// CA47, CA59, CA64, CA65; 18 TM12.2 to TM12.4; jalons/l3e/modele.md §2, §4, §5, §7, §10; fiche
// invariants 2, 3, 6, 9, 11 to 13). Through fastify.inject(), straight to apps/api, the door of 0319
// and 0320 behind it:
//   - the answer of the API, not a screen: the exact keys of a page, a card, its creator and its
//     lines; no key of RG48 at any depth, not even null; no marker of layer I by value (CA1, CA3);
//     the lines start with the audience band, the rhythm and the comment band, with source and date,
//     and no exact count of posts or comments (CA65); reasons in codes and bands (RG41);
//   - the states without a list: the switch closed (D38), the brand not published (RG1), below k the
//     same body for 0 and 4 (CA35), each journaled as 0319 says and nothing more;
//   - the entry closed (no size of page, no facet outside the base, TM12.2), the cap of pages a 400
//     after the COMMIT, journaled (CA42), every served page journaled (TM12.4), no route of export
//     nor size parameter in the two search routers (TM12.3), nothing to the outbox (CA64).
// Accounts COMMITTED through campaign-routes-kit.ts, creators through creator-search-kit.ts.
import { creatorSearchBodySchema } from "@influx/contracts/creator-search";
import { openCampaignsQuerySchema } from "@influx/contracts/open-campaigns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { routeInventoryOf } from "../src/server.ts";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  closeSearch,
  EXACT_FOLLOWERS,
  HERE,
  keysOf,
  markersIn,
  openSearch,
  postSearch,
  searchableCreators,
  searchesOf,
  URL_SEARCH,
  withSearchSetting,
  type SearchCreator,
} from "./creator-search-kit.ts";
import { publishedBrand, type PublishedBrand } from "./open-campaigns-kit.ts";

let fx: CampaignRouteFixtures;
let server: Server;
let brand: PublishedBrand;
/** Six creators in French and four in Italian, all in SEARCH_COUNTRY: ten in all. */
let creators: SearchCreator[];

/** The keys of RG48 (and of the internal order) that no answer holds, at any depth, not even null. */
const RG48_KEYS = [
  "handle",
  "pseudonym",
  "profileUrl",
  "url",
  "firstName",
  "lastName",
  "legalFirstName",
  "legalLastName",
  "city",
  "email",
  "phone",
  "followersCount",
  "postsLast30Days",
  "avgCommentsPerPost",
  "avgReachPerPost",
  "engagementRate",
  "engagementRateBp",
  "share",
  "sharePercent",
  "audienceShares",
  "refusedSectors",
  "completeness",
  "status",
  "published",
  "socialAccountId",
  "accountId",
  "creatorAccountId",
  "publicRef",
  "lineKey",
  "rank",
  "place",
  "score",
  "cold",
  "coldQuota",
  "resultCount",
  "total",
  "price",
  "rate",
  "currency",
  "net",
  "avatar",
  "dateOfBirth",
];

type Page = {
  state: string;
  countBand: string;
  page: number;
  nextPage: number | null;
  capReached: boolean;
  cards: {
    creator: Record<string, unknown> & {
      alias: string;
      networks: Record<string, unknown>[];
    };
    reasons: { code: string; params: Record<string, unknown> }[];
    vigilance: string | null;
  }[];
};

function search(body: unknown, member: Member = brand) {
  return postSearch(server, member, body);
}

function allMarkers() {
  return [...creators.flatMap((creator) => creator.markers), ...brand.markers];
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server();
  await openSearch(fx);
  brand = await publishedBrand(fx, server);
  creators = [
    ...(await searchableCreators(fx, 6)),
    ...(await searchableCreators(fx, 4, { languages: ["it"] })),
  ];
});

afterAll(async () => {
  await closeSearch(fx);
  await fx.close();
});

describe("L3E-T8 CA1, CA3, CA65 the answer of the API holds layer A alone (10 RG48, RG65; fiche invariants 2, 3, 13)", () => {
  it("CA1: serves a page of exact keys, the count in a band, every card the layer A of a creator of the file", async () => {
    const response = await search({ filters: HERE });
    expect(response.statusCode, response.body).toBe(200);
    const page = response.json() as Page;
    expect(Object.keys(page).sort()).toEqual([
      "capReached",
      "cards",
      "countBand",
      "nextPage",
      "page",
      "state",
    ]);
    expect(page).toMatchObject({
      state: "results",
      countBand: "10_24",
      page: 1,
      nextPage: null,
      capReached: false,
    });
    expect(page.cards.map((card) => card.creator.alias).sort()).toEqual(
      creators.map((creator) => creator.alias).sort(),
    );
    for (const card of page.cards) {
      expect(Object.keys(card).sort()).toEqual([
        "creator",
        "reasons",
        "vigilance",
      ]);
      expect(Object.keys(card.creator).sort()).toEqual([
        "acceptsNonMonetary",
        "alias",
        "audienceBands",
        "audienceGenderBand",
        "availability",
        "bio",
        "collaborationExperience",
        "deliveryLead",
        "formats",
        "headline",
        "mainAudienceCountry",
        "mainAudienceShareBand",
        "maxExclusivity",
        "networks",
        "primaryTopic",
        "publicationLanguages",
        "residenceCountry",
        "secondaryTopics",
        "tones",
        "travelScope",
        "usageRights",
        "visuals",
      ]);
      expect(card.creator.mainAudienceCountry).toBe(HERE.F6.country);
    }
  });

  it("CA1: holds no key of RG48 at any depth, not even null, and no marker of layer I by value", async () => {
    const response = await search({ filters: HERE });
    expect(response.statusCode).toBe(200);
    const keys = new Set(keysOf(response.json()));
    expect(RG48_KEYS.filter((key) => keys.has(key))).toEqual([]);
    expect(markersIn(response, allMarkers())).toEqual([]);
    // no identifier of any kind beside the alias: the card holds none (RG65, CA49)
    expect(keys.has("id")).toBe(false);
  });

  it("CA3: the 47 312 followers declared are a band, and the number appears nowhere in the answer", async () => {
    const response = await search({ filters: HERE });
    const page = response.json() as Page;
    expect(response.body).not.toContain(String(EXACT_FOLLOWERS));
    expect(response.body).not.toContain("47 312");
    for (const card of page.cards) {
      expect(card.creator.networks).toHaveLength(1);
      expect(card.creator.networks[0]?.audienceBand).toEqual(
        expect.any(String),
      );
    }
  });

  it("CA65: each line opens with the audience band, the rhythm and the comment band, its source and date, no exact count not even null", async () => {
    const page = (await search({ filters: HERE })).json() as Page;
    for (const card of page.cards) {
      for (const line of card.creator.networks) {
        const order = Object.keys(line);
        expect(order.indexOf("audienceBand")).toBeLessThan(
          order.indexOf("publicationFrequency"),
        );
        expect(order.indexOf("publicationFrequency")).toBeLessThan(
          order.indexOf("commentBand"),
        );
        expect(order).toEqual(
          expect.arrayContaining(["figuresSource", "figuresMeasuredAt"]),
        );
        expect(line.figuresSource).toBe("declared");
        expect(line.figuresMeasuredAt).toEqual(expect.any(String));
        for (const exact of [
          "postsLast30Days",
          "avgCommentsPerPost",
          "avgReachPerPost",
          "followersCount",
        ]) {
          expect(order, exact).not.toContain(exact);
        }
      }
    }
  });

  it("RG41, RG42: 2 to 4 reasons per card in codes and string bands, at most one note, no label and no number", async () => {
    const page = (await search({ filters: HERE })).json() as Page;
    expect(page.cards.length).toBe(10);
    for (const card of page.cards) {
      expect(card.reasons.length).toBeGreaterThanOrEqual(2);
      expect(card.reasons.length).toBeLessThanOrEqual(4);
      for (const reason of card.reasons) {
        expect(Object.keys(reason).sort()).toEqual(["code", "params"]);
        expect(reason.code).toMatch(/^[a-z][a-z_]+$/);
        for (const value of Object.values(reason.params)) {
          expect(typeof value).toBe("string");
          expect(value).toMatch(/^[A-Za-z0-9_]+$/);
        }
      }
      expect(
        card.vigilance === null || typeof card.vigilance === "string",
      ).toBe(true);
    }
    // F6 is served in its band (ge_80), never the 83 % typed (CA4)
    const audience = page.cards
      .flatMap((card) => card.reasons)
      .find((reason) => reason.code === "audience_country_match");
    expect(audience?.params).toEqual({
      country: HERE.F6.country,
      shareBand: "ge_80",
    });
  });
});

describe("L3E-T8 the states without a list (10 RG1, RG2, RG57, RG58; CA34, CA35, CA59)", () => {
  it("D38, CA59: the switch closed answers `closed` alone, nothing journaled nor counted", async () => {
    const other = await publishedBrand(fx, server);
    await withSearchSetting(fx, "is_open_to_advertisers", false, async () => {
      const response = await search({ filters: HERE }, other);
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({ state: "closed" });
      expect(response.headers["cache-control"]).toBe("no-store");
    });
    expect(await searchesOf(fx, other)).toEqual([]);
  });

  it("RG1: a brand whose profile is not published sees no list, nothing journaled", async () => {
    const draft = await fx.newMember("advertiser");
    const response = await search({ filters: HERE }, draft);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ state: "brand_not_published" });
    expect(markersIn(response, allMarkers())).toEqual([]);
    expect(await searchesOf(fx, draft)).toEqual([]);
  });

  it("CA35: below k, 0 and 4 creators answer the same body byte for byte, the exact counts in the journal only", async () => {
    const other = await publishedBrand(fx, server);
    const four = await search({ filters: { ...HERE, F8: ["it"] } }, other);
    const none = await search({ filters: { ...HERE, F1: "travel" } }, other);
    expect(four.statusCode, four.body).toBe(200);
    expect(none.statusCode, none.body).toBe(200);
    expect(four.json()).toEqual({ state: "too_narrow" });
    expect(four.body).toBe(none.body);
    expect(await searchesOf(fx, other)).toEqual([
      expect.objectContaining({
        outcome: "served",
        blocked: true,
        result_count: 4,
      }),
      expect.objectContaining({
        outcome: "served",
        blocked: true,
        result_count: 0,
      }),
    ]);
  });
});

describe("L3E-T8 the entry closed, the cap and the journal (10 RG63, RG66; CA41, CA42, CA47; 18 TM12.2 to TM12.4)", () => {
  it("TM12.2: no size of page, no facet outside the base, no unknown key: 400 before the session, nothing journaled", async () => {
    const other = await publishedBrand(fx, server);
    for (const body of [
      { filters: HERE, pageSize: 50 },
      { filters: HERE, limit: 100 },
      { filters: { ...HERE, F12: ["lt_500"] } },
      { filters: { ...HERE, F2: "pets" } },
      { filters: HERE, page: 51 },
      { filters: HERE, sort: "price" },
      { sort: "default" },
    ]) {
      const response = await search(body, other);
      expect(fx.errorBody(response), JSON.stringify(body)).toEqual({
        status: 400,
        code: "validation_failed",
        message: "Validation failed",
      });
    }
    expect(await searchesOf(fx, other)).toEqual([]);
  });

  it("CA42: a page beyond the cap of the base is 400 on `page` after the COMMIT, the attempt journaled, nothing of a creator", async () => {
    const other = await publishedBrand(fx, server);
    const response = await search({ filters: HERE, page: 6 }, other);
    expect(fx.errorBody(response)).toEqual({
      status: 400,
      code: "validation_failed",
      message: "Validation failed",
    });
    expect(fx.issuesOf(response)).toEqual([
      { path: "page", issue: "page_cap" },
    ]);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(markersIn(response, allMarkers())).toEqual([]);
    for (const creator of creators) {
      expect(response.body).not.toContain(creator.alias);
    }
    expect(await searchesOf(fx, other)).toEqual([
      expect.objectContaining({ outcome: "page_cap", page_reached: 6 }),
    ]);
  });

  it("RG11, RG12: a facet of the base closed in table is 400 on `filters`, nothing written", async () => {
    const other = await publishedBrand(fx, server);
    await fx.migration`update search.facet_settings set is_open = false where facet_code = 'F11'`;
    try {
      const response = await search(
        { filters: { ...HERE, F11: ["instagram_reel"] } },
        other,
      );
      expect(fx.errorBody(response).status).toBe(400);
      expect(fx.issuesOf(response)).toEqual([
        { path: "filters", issue: "invalid_filters" },
      ]);
    } finally {
      await fx.migration`update search.facet_settings set is_open = true where facet_code = 'F11'`;
    }
    expect(await searchesOf(fx, other)).toEqual([]);
  });

  it("TM12.4, CA47: every page served is journaled with its sort and page, beyond the results a page without cards, nothing to the outbox (CA64)", async () => {
    const other = await publishedBrand(fx, server);
    const [start] = await fx.migration<
      { at: string }[]
    >`select now()::text as at`;
    const first = await search({ filters: HERE, sort: "audience" }, other);
    const second = await search(
      { filters: HERE, sort: "verified_first", page: 2 },
      other,
    );
    expect(first.statusCode, first.body).toBe(200);
    expect(second.json()).toEqual({
      state: "results",
      countBand: "10_24",
      page: 2,
      nextPage: null,
      capReached: false,
      cards: [],
    });
    expect(await searchesOf(fx, other)).toEqual([
      {
        outcome: "served",
        sort_code: "audience",
        page_reached: 1,
        blocked: false,
        campaign_id: null,
        result_count: 10,
      },
      {
        outcome: "served",
        sort_code: "verified_first",
        page_reached: 2,
        blocked: false,
        campaign_id: null,
        result_count: 10,
      },
    ]);
    // RG8, CA64: no lead event, nothing to Brevo nor Apollo, no notice to a creator
    const [events] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from leads.outbox_events
       where created_at >= ${start?.at ?? null}::timestamptz`;
    expect(events?.n).toBe(0);
  });

  it("TM12.3: no route of export and no size parameter in the two search routers, every answer `no-store`", async () => {
    const inventory = routeInventoryOf(server);
    const searchRoutes = inventory
      .filter(
        (route) =>
          route.url.startsWith(URL_SEARCH) ||
          route.url.startsWith("/v1/open-campaigns"),
      )
      .map((route) => `${route.method} ${route.url}`)
      .sort();
    expect(searchRoutes).toEqual([
      // L3F 07: the profile a brand opens and its visuals, neither an export nor a size of page
      "GET /v1/creator-search/profiles/:alias",
      "GET /v1/creator-search/profiles/:alias/visuals/:visualId",
      "GET /v1/open-campaigns",
      "GET /v1/open-campaigns/:id",
      "GET /v1/open-campaigns/:id/brand-logo",
      "POST /v1/creator-search",
    ]);
    // no route of the whole server exports a search, in any format (C(17))
    expect(
      inventory
        .map((route) => route.url)
        .filter((url) => /search|campaign|creator/.test(url))
        .filter((url) => /export|csv|xlsx|download/.test(url)),
    ).toEqual([]);
    const SIZE =
      /^(limit|size|pageSize|perPage|per_page|page_size|count|format)$/;
    expect(
      Object.keys(creatorSearchBodySchema.shape).filter((key) =>
        SIZE.test(key),
      ),
    ).toEqual([]);
    expect(
      Object.keys(openCampaignsQuerySchema.shape).filter((key) =>
        SIZE.test(key),
      ),
    ).toEqual([]);
    const served = await search({ filters: HERE });
    expect(served.headers["cache-control"]).toBe("no-store");
  });
});
