// L3F commit 07 — L3F-T7: the anonymous profile a brand opens and its visuals, GET /v1/creator-search/
// profiles/:alias and …/visuals/:visualId (docs/mvp/10 RG1, RG2, RG15, RG41, RG42, RG48, RG50, RG65,
// RG66; CA1, CA6, CA14, CA15, CA48, CA50, CA59, CA64; D82 (7), EC-L2G-16; jalons/l3f/modele.md §2, §3,
// §8; fiche invariants 1 to 3, 9, 10). Through fastify.inject(), straight to apps/api, the doors of 0323
// behind it and a Storage double holding the objects:
//   - the profile is the card of the search, whole and equal, plus the region of RG15 and the reasons:
//     the exact keys, no key of RG48 at any depth, not even null, no marker of layer I by value (CA6);
//   - the region shows from the threshold of the table, the country alone below it (CA14, CA15);
//   - the states without a profile: the switch closed (D38), the brand not published (RG1), nothing
//     journaled, no visual either;
//   - the opening journaled in the transaction that serves, the impression of origin opened once
//     (CA48), nothing to the outbox (CA64);
//   - a visual is JSON (type, sides, base64), no URL, host, key nor token (D82 (7)); approved only and
//     of this creator (CA50); Storage unavailable 503, the object gone 404; neither journal nor count.
// Accounts COMMITTED through campaign-routes-kit.ts, creators and visuals through creator-search-kit.ts.
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ObjectStore } from "../src/platform/storage.ts";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  closeSearch,
  getProfile,
  getVisual,
  HERE,
  keysOf,
  markersIn,
  openingsOf,
  openSearch,
  postSearch,
  searchableCreators,
  storedVisual,
  withSearchSetting,
  type SearchCreator,
  type StoredVisual,
} from "./creator-search-kit.ts";
import {
  memoryStore,
  publishedBrand,
  type Marker,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";

let fx: CampaignRouteFixtures;
let store: ReturnType<typeof memoryStore>;
let server: Server;
let brand: PublishedBrand;
/** Six creators of the file; the first holds three approved visuals and a rejected one. */
let creators: SearchCreator[];
let subject: SearchCreator;
let approved: StoredVisual[];
let rejected: StoredVisual;
/** An approved visual of another creator of the file. */
let theirs: StoredVisual;
/** The answer of an address that does not exist (T14.4). */
let unknownAddress: { status: number; code: string; message: string };

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
  "share",
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
  "score",
  "price",
  "rate",
  "currency",
  "net",
  "objectKey",
  "object_key",
  "signedUrl",
  "token",
];

/** The keys of a card's creator (L3E-T8), which the profile carries exactly (CA6). */
const CARD_KEYS = [
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
];

type Profile = {
  state: string;
  creator: Record<string, unknown> & {
    alias: string;
    visuals: { id: string; order: number; caption: string | null }[];
  };
  residenceRegion: string | null;
  reasons: { code: string; params: Record<string, unknown> }[];
  vigilance: string | null;
};

function withoutRequestId(response: LightMyRequestResponse): string {
  return response.body.replace(/"requestId":"[^"]*"/, "");
}

function allMarkers(): Marker[] {
  return [
    ...creators.flatMap((creator) => creator.markers),
    ...brand.markers,
    ...[...approved, rejected, theirs].map((visual) => ({
      name: "object key",
      value: visual.objectKey,
    })),
  ];
}

/** Nothing that names Storage, an address or a credential in an answer (D82 (7), T9.2). */
function expectNoAddress(response: LightMyRequestResponse): void {
  const raw = `${response.body}\n${JSON.stringify(response.headers)}`;
  for (const word of [
    "http",
    "supabase",
    "storage",
    "token",
    "portfolio/",
    ".webp",
  ]) {
    expect(raw.toLowerCase(), word).not.toContain(word);
  }
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  store = memoryStore();
  server = fx.server({ storage: store });
  await openSearch(fx);
  brand = await publishedBrand(fx, server);
  creators = await searchableCreators(fx, 6);
  subject = creators[0] as SearchCreator;
  approved = [
    await storedVisual(fx, store, subject, "approved", 1),
    await storedVisual(fx, store, subject, "approved", 2),
    await storedVisual(fx, store, subject, "approved", 3),
  ];
  rejected = await storedVisual(fx, store, subject, "rejected");
  theirs = await storedVisual(
    fx,
    store,
    creators[1] as SearchCreator,
    "approved",
    1,
  );
  // RG15: five storefronts of the file share (AU, AU-TAS), the threshold of the table; the sixth is
  // alone in AU-NT
  const shared = creators.slice(0, 5).map((creator) => creator.accountId);
  await fx.migration`
    update profiles.creator_public_profiles
       set residence_country_code = 'AU', residence_region_code = 'AU-TAS'
     where account_id = any(${shared}::uuid[])`;
  await fx.migration`
    update profiles.creator_public_profiles
       set residence_country_code = 'AU', residence_region_code = 'AU-NT'
     where account_id = ${(creators[5] as SearchCreator).accountId}`;
  unknownAddress = fx.errorBody(
    await fx.call(server, "GET", "/v1/creator-search-nothing", brand.session),
  );
  expect(unknownAddress.status).toBe(404);
});

afterAll(async () => {
  await closeSearch(fx);
  await fx.close();
});

describe("L3F-T7 CA6, CA1 the profile is the card of the search, whole (10 RG48, RG50, RG65; fiche invariant 1)", () => {
  it("CA6: answers the exact keys, its creator the card the search serves for him, equal value for value", async () => {
    const response = await getProfile(server, brand, subject.alias);
    expect(response.statusCode, response.body).toBe(200);
    const profile = response.json() as Profile;
    expect(Object.keys(profile).sort()).toEqual([
      "creator",
      "reasons",
      "residenceRegion",
      "state",
      "vigilance",
    ]);
    expect(profile.state).toBe("profile");
    expect(Object.keys(profile.creator).sort()).toEqual(CARD_KEYS);
    const page = (
      await postSearch(server, brand, { filters: HERE })
    ).json() as {
      cards: { creator: { alias: string } }[];
    };
    const card = page.cards.find(
      (candidate) => candidate.creator.alias === subject.alias,
    );
    expect(card).toBeDefined();
    expect(profile.creator).toEqual(card?.creator);
  });

  it("CA1: holds no key of RG48 at any depth, not even null, and no marker of layer I nor key of an object by value", async () => {
    const response = await getProfile(server, brand, subject.alias);
    expect(response.statusCode).toBe(200);
    const keys = new Set(keysOf(response.json()));
    expect(RG48_KEYS.filter((key) => keys.has(key))).toEqual([]);
    expect(markersIn(response, allMarkers())).toEqual([]);
    expectNoAddress(response);
  });

  it("RG41, RG42: 2 to 4 reasons in codes and string bands, at most one note, no label and no number", async () => {
    const profile = (
      await getProfile(server, brand, subject.alias)
    ).json() as Profile;
    expect(profile.reasons.length).toBeGreaterThanOrEqual(2);
    expect(profile.reasons.length).toBeLessThanOrEqual(4);
    for (const reason of profile.reasons) {
      expect(Object.keys(reason).sort()).toEqual(["code", "params"]);
      expect(reason.code).toMatch(/^[a-z][a-z_]+$/);
      for (const value of Object.values(reason.params)) {
        expect(value).toEqual(expect.stringMatching(/^[A-Za-z0-9_]+$/));
      }
    }
    expect(
      profile.vigilance === null || typeof profile.vigilance === "string",
    ).toBe(true);
  });

  it("RG15, CA14, CA15: the region from the threshold of the table; below it the country alone, null, no message nor count", async () => {
    const shown = (
      await getProfile(server, brand, subject.alias)
    ).json() as Profile;
    expect(shown.creator.residenceCountry).toBe("AU");
    expect(shown.residenceRegion).toBe("AU-TAS");
    const alone = await getProfile(
      server,
      brand,
      (creators[5] as SearchCreator).alias,
    );
    const below = alone.json() as Profile;
    expect(below.creator.residenceCountry).toBe("AU");
    expect(below.residenceRegion).toBeNull();
    expect(alone.body).not.toContain("AU-NT");
    // the threshold raised above the five: the region leaves the profile, whatever the brand
    await withSearchSetting(fx, "region_display_threshold", 6, async () => {
      const raised = (
        await getProfile(server, brand, subject.alias)
      ).json() as Profile;
      expect(raised.residenceRegion).toBeNull();
    });
  });

  it("no-store and nosniff on the profile, the visual and a refusal", async () => {
    for (const response of [
      await getProfile(server, brand, subject.alias),
      await getVisual(
        server,
        brand,
        subject.alias,
        (approved[0] as StoredVisual).id,
      ),
      await getVisual(server, brand, subject.alias, rejected.id),
    ]) {
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    }
  });
});

describe("L3F-T7 the states without a profile (10 RG1, RG2; CA59; fiche invariant 10)", () => {
  it("D38, CA59: the switch closed answers `closed` alone, no visual is served, nothing journaled", async () => {
    const other = await publishedBrand(fx, server);
    await withSearchSetting(fx, "is_open_to_advertisers", false, async () => {
      const response = await getProfile(server, other, subject.alias);
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toEqual({ state: "closed" });
      const visual = await getVisual(
        server,
        other,
        subject.alias,
        (approved[0] as StoredVisual).id,
      );
      expect(fx.errorBody(visual)).toEqual(unknownAddress);
    });
    expect(await openingsOf(fx, other)).toEqual([]);
  });

  it("RG1: a brand whose profile is not published opens nothing and reads no visual, nothing journaled", async () => {
    const draft = await fx.newMember("advertiser");
    const response = await getProfile(server, draft, subject.alias);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({ state: "brand_not_published" });
    expect(markersIn(response, allMarkers())).toEqual([]);
    const visual = await getVisual(
      server,
      draft,
      subject.alias,
      (approved[0] as StoredVisual).id,
    );
    expect(fx.errorBody(visual)).toEqual(unknownAddress);
    expect(await openingsOf(fx, draft)).toEqual([]);
  });
});

describe("L3F-T7 the opening journaled (10 RG66; CA48, CA64; fiche invariant 9)", () => {
  it("CA48: opened from a search, the opening names it and its impression is opened once; nothing to the outbox", async () => {
    const other = await publishedBrand(fx, server);
    const [start] = await fx.migration<
      { at: string }[]
    >`select now()::text as at`;
    expect(
      (await postSearch(server, other, { filters: HERE })).statusCode,
    ).toBe(200);
    expect((await getProfile(server, other, subject.alias)).statusCode).toBe(
      200,
    );
    const impressions = () => fx.migration<
      { creator: string; was_opened: boolean; opened_at: string | null }[]
    >`
      select i.creator_account_id::text as creator, i.was_opened, i.opened_at::text as opened_at
        from search.search_impressions i
        join search.search_queries q on q.id = i.search_query_id
       where q.account_id = ${other.accountId}`;
    const first = await impressions();
    const opened = first.filter((line) => line.was_opened);
    expect(opened.map((line) => line.creator)).toEqual([subject.accountId]);
    expect(first.length).toBe(creators.length);
    // a reopening is journaled too, the impression stays opened once (its first date)
    expect((await getProfile(server, other, subject.alias)).statusCode).toBe(
      200,
    );
    const second = await impressions();
    expect(second.find((line) => line.was_opened)?.opened_at).toBe(
      opened[0]?.opened_at,
    );
    expect(await openingsOf(fx, other)).toEqual([
      {
        outcome: "served",
        creator_account_id: subject.accountId,
        from_search: true,
      },
      {
        outcome: "served",
        creator_account_id: subject.accountId,
        from_search: true,
      },
    ]);
    const [events] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from leads.outbox_events
       where created_at >= ${start?.at ?? null}::timestamptz`;
    expect(events?.n).toBe(0);
  });
});

describe("L3F-T7 the visuals relayed as JSON (10 CA50; D82 (7), EC-L2G-16; fiche invariant 3)", () => {
  it("D82 (7): an approved visual is JSON, its type, sides and bytes in base64, no URL, host, key nor token", async () => {
    const visual = approved[1] as StoredVisual;
    const response = await getVisual(server, brand, subject.alias, visual.id);
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json() as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual([
      "byteSize",
      "contentType",
      "data",
      "height",
      "width",
    ]);
    expect(body).toMatchObject({
      contentType: "image/webp",
      width: 640,
      height: 480,
      byteSize: visual.bytes.length,
    });
    expect(
      Buffer.from(body.data as string, "base64").equals(visual.bytes),
    ).toBe(true);
    expect(markersIn(response, allMarkers())).toEqual([]);
    expectNoAddress(response);
  });

  it("CA50: the profile lists the approved visuals alone, in order; a rejected one, another's or an unknown id answers as an unknown address", async () => {
    const profile = (
      await getProfile(server, brand, subject.alias)
    ).json() as Profile;
    expect(profile.creator.visuals.map((visual) => visual.id)).toEqual(
      approved.map((visual) => visual.id),
    );
    expect(profile.creator.visuals.map((visual) => visual.order)).toEqual([
      1, 2, 3,
    ]);
    const refused = [
      await getVisual(server, brand, subject.alias, rejected.id),
      await getVisual(server, brand, subject.alias, theirs.id),
      await getVisual(
        server,
        brand,
        subject.alias,
        "00000000-0000-4000-8000-000000000000",
      ),
    ];
    for (const response of refused) {
      expect(fx.errorBody(response)).toEqual(unknownAddress);
      expect(withoutRequestId(response)).toBe(
        withoutRequestId(refused[0] as LightMyRequestResponse),
      );
    }
    // positive control: the other creator's visual under his own alias
    const own = await getVisual(
      server,
      brand,
      (creators[1] as SearchCreator).alias,
      theirs.id,
    );
    expect(own.statusCode, own.body).toBe(200);
  });

  it("Storage unavailable: 503 service_unavailable, the line with its status and never the key nor the alias", async () => {
    const failing: ObjectStore = {
      write: async () => ({ ok: true, value: null }),
      read: async () => ({
        ok: false,
        reason: "unavailable",
        status: 503,
        errorCode: null,
      }),
      remove: async () => ({ ok: true, value: null }),
    };
    const down = fx.server({ storage: failing });
    const visual = approved[0] as StoredVisual;
    const response = await getVisual(down, brand, subject.alias, visual.id);
    expect(fx.errorBody(response)).toMatchObject({
      status: 503,
      code: "service_unavailable",
    });
    expectNoAddress(response);
    const text = fx.logStreams.map((stream) => stream()).join("\n");
    expect(text).toContain("search.creator_visual.read_failed");
    expect(text).not.toContain(visual.objectKey);
    expect(text).not.toContain(subject.alias);
  });

  it("an object gone from Storage: the visual answers as an unknown address, never a broken image", async () => {
    const visual = approved[2] as StoredVisual;
    await store.remove("portfolio", visual.objectKey);
    try {
      const response = await getVisual(server, brand, subject.alias, visual.id);
      expect(fx.errorBody(response)).toEqual(unknownAddress);
    } finally {
      await store.write(
        "portfolio",
        visual.objectKey,
        visual.bytes,
        "image/webp",
      );
    }
  });

  it("modele §3: a visual is neither journaled nor counted in the bucket of the openings", async () => {
    const other = await publishedBrand(fx, server);
    for (const visual of approved) {
      expect(
        (await getVisual(server, other, subject.alias, visual.id)).statusCode,
      ).toBe(200);
    }
    expect(await openingsOf(fx, other)).toEqual([]);
  });
});
