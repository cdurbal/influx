// L3G commit 09 — L3G-T9: the identified creator search route of the INFLUX agents, POST /v1/bo/creator-search
// (docs/mvp/10 RG4, RG62, RG71, RG72, RG76, RG78, RG87; CA56, CA58, CA61; 17b §3.3; 18 T14, TM12.3, TM12.5;
// jalons/l3g/modele.md §1 to §3, §8; l3g-fiche invariants 2, 4, 7, 8, 12, 14). Through fastify.inject(),
// straight to apps/api, the door of 0328 behind it, as an agent and an administrator of a backoffice
// session in aal2:
//   - the answer of the API, not a screen: the exact keys of a page, a row and a line of network, the
//     identities and the exact figures a brand never reads, no contact detail, no rank, no money (D46, D78);
//   - the exact count with neither k nor switch (CA61), the filters of G, the campaign of origin and the
//     pair blocked (the phrase is the screen's: the route serves a boolean, never a motive nor an author);
//   - T14.1 to T14.4: a member (any role) gets the 404 of a route that does not exist on the web surface and
//     a 401 on the backoffice's; a campaign that is a draft or unknown, a prefill that is not the caller's
//     answer exactly like an address that does not exist; nothing journaled by a refusal;
//   - the entry closed (no size of page, no facet outside the base, no other key: 400 before the session),
//     the cap of pages a 400 after the COMMIT, journaled (RG76, CA58), no route of export (TM12.3);
//   - the journal is nominative (RG78): agent or admin, mode, campaign, filters, the exact count, one
//     impression per row; nothing to the outbox, to `matching.*` nor to the creator (D45, RG8).
// Accounts COMMITTED through campaign-review-kit.ts, creators through creator-search-kit.ts.
import { identifiedCreatorSearchBodySchema } from "@influx/contracts/identified-creator-search";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { routeInventoryOf } from "../src/server.ts";
import {
  answer,
  issuesOf,
  openReviewKit,
  type Internal,
  type ReviewKit,
} from "./campaign-review-kit.ts";
import {
  closeSearch,
  EXACT_FOLLOWERS,
  keysOf,
  markersIn,
  openSearch,
  searchableCreators,
  sideEffectsOf,
  withSearchSetting,
  SEARCH_COUNTRY,
  type SearchCreator,
} from "./creator-search-kit.ts";
import {
  brandCampaign,
  publishedBrand,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";

const URL_IDENTIFIED = "/v1/bo/creator-search";
const HERE = { F6: { country: SEARCH_COUNTRY } };

let kit: ReviewKit;
let agent: Internal;
let otherAgent: Internal;
let admin: Internal;
let brand: PublishedBrand;
/** Eleven creators, all in SEARCH_COUNTRY: more than the smallest page of the view (10). */
let creators: SearchCreator[];
/** The answer of an address that does not exist (T14.4). */
let unknownAddress: { status: number; error: Record<string, unknown> };

/** The keys a page of the identified view holds, and no other. */
const PAGE_KEYS = ["capReached", "nextPage", "page", "rows", "state", "total"];
const ROW_KEYS = [
  "accountId",
  "alias",
  "blocked",
  "city",
  "declaredStatus",
  "legalName",
  "mainAudience",
  "networks",
  "ownerAgent",
  "reasons",
  "refusedSectors",
  "residence",
  "status",
  "vigilance",
];
const NETWORK_KEYS = [
  "avgComments",
  "badge",
  "engagementBp",
  "followers",
  "handle",
  "isPrimary",
  "measuredAt",
  "network",
  "postsLast30Days",
  "profileUrl",
  "pseudonym",
  "source",
];
/** What no answer of the view holds, at any depth, not even null (D46, D78, RG87, RG76). */
const NEVER_SERVED = [
  "email",
  "phone",
  "address",
  "postalCode",
  "rank",
  "place",
  "score",
  "cold",
  "coldQuota",
  "price",
  "rate",
  "currency",
  "net",
  "budget",
  "publicRef",
  "lineKey",
  "socialAccountId",
  "token",
  "blockReason",
  "blockedBy",
  "comment",
];

type Row = {
  accountId: string;
  alias: string;
  status: string;
  declaredStatus: string | null;
  legalName: string | null;
  city: string | null;
  residence: { country: string; region: string | null };
  ownerAgent: unknown;
  refusedSectors: string[];
  blocked: boolean;
  networks: Record<string, unknown>[];
  mainAudience: { country: string; sharePercent: number | null } | null;
  reasons: { code: string; params: Record<string, string> }[];
  vigilance: string | null;
};
type Page = {
  state: string;
  total: number;
  page: number;
  nextPage: number | null;
  capReached: boolean;
  rows: Row[];
};

function search(session: string | null, body: unknown) {
  return kit.bo("POST", URL_IDENTIFIED, session, body as object);
}

function markerOf(creator: SearchCreator, name: string): string {
  const found = creator.markers.find((marker) => marker.name === name);
  if (found === undefined) {
    throw new Error(`no marker ${name}`);
  }
  return found.value;
}

/** The journal lines of an internal account (search.search_queries), oldest first, with their impressions. */
async function journalOf(who: Internal) {
  return kit.fx.migration<
    {
      outcome: string;
      actor_role: string;
      view_mode: string;
      campaign_id: string | null;
      prefill_id: string | null;
      result_count: number;
      page_reached: number;
      blocked: boolean;
      filters: Record<string, unknown>;
      impressions: number;
    }[]
  >`
    select q.outcome, q.actor_role, q.view_mode, q.campaign_id::text as campaign_id,
           q.prefill_id::text as prefill_id, q.result_count, q.page_reached,
           q.blocked_by_k_anonymity as blocked, q.filters,
           (select count(*)::int from search.search_impressions i
             where i.search_query_id = q.id) as impressions
      from search.search_queries q
     where q.account_id = ${who.accountId}
     order by q.created_at, q.page_reached`;
}

/** The journal of the internal accounts of the file goes before the campaigns and the creators it names. */
async function forgetJournal(): Promise<void> {
  const actors = [agent, otherAgent, admin].map((who) => who.accountId);
  await kit.fx.migration.begin(async (tx) => {
    const queries = tx`
      select q.id from search.search_queries q where q.account_id = any(${actors}::uuid[])`;
    await tx`delete from search.impression_reasons where search_query_id in (${queries})`;
    await tx`delete from search.search_impressions where search_query_id in (${queries})`;
    await tx`delete from search.search_queries where account_id = any(${actors}::uuid[])`;
    await tx`delete from search.campaign_prefills where account_id = any(${actors}::uuid[])`;
  });
}

beforeAll(async () => {
  kit = await openReviewKit();
  await openSearch(kit.fx);
  agent = await kit.newInternal("agent", "Alix");
  otherAgent = await kit.newInternal("agent", "Camille");
  admin = await kit.newInternal("admin", "Dominique");
  brand = await publishedBrand(kit.fx, kit.server);
  creators = await searchableCreators(kit.fx, 11);
  unknownAddress = answer(
    await kit.bo("POST", `${URL_IDENTIFIED}-nothing`, agent.session, {
      filters: HERE,
    }),
  );
  expect(unknownAddress.status).toBe(404);
});

afterAll(async () => {
  await forgetJournal();
  await closeSearch(kit.fx);
  await kit.close();
});

describe("L3G-T9 the answer of the API holds the identities and the exact values, and nothing a brand may not read (fiche invariants 2, 12; D46, D78)", () => {
  it("serves a page of exact keys, the exact count, every row a creator of the file, no-store", async () => {
    const response = await search(agent.session, { filters: HERE });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const page = response.json() as Page;
    expect(Object.keys(page).sort()).toEqual(PAGE_KEYS);
    expect(page).toMatchObject({
      state: "results",
      total: 11,
      page: 1,
      nextPage: null,
      capReached: false,
    });
    expect(page.rows.map((row) => row.alias).sort()).toEqual(
      creators.map((creator) => creator.alias).sort(),
    );
    for (const row of page.rows) {
      expect(Object.keys(row).sort()).toEqual(ROW_KEYS);
      for (const line of row.networks) {
        expect(Object.keys(line).sort()).toEqual(NETWORK_KEYS);
      }
      expect(row.reasons.length).toBeGreaterThan(0);
      expect(row.reasons.length).toBeLessThanOrEqual(4);
    }
  });

  it("names the creator and gives the exact figures of his line and his audience, never a contact detail", async () => {
    const response = await search(agent.session, { filters: HERE });
    const page = response.json() as Page;
    const creator = creators[0];
    const row = page.rows.find((found) => found.alias === creator?.alias);
    if (creator === undefined || row === undefined) {
      throw new Error("the creator is not served");
    }
    expect(row).toMatchObject({
      accountId: creator.accountId,
      status: "published",
      declaredStatus: "individual",
      legalName: `${markerOf(creator, "first name")} ${markerOf(creator, "last name")}`,
      city: markerOf(creator, "city"),
      residence: { country: "FR", region: null },
      ownerAgent: null,
      refusedSectors: [markerOf(creator, "refused sector")],
      blocked: false,
      mainAudience: { country: SEARCH_COUNTRY, sharePercent: 83 },
    });
    expect(row.networks).toEqual([
      expect.objectContaining({
        network: "instagram",
        isPrimary: true,
        handle: markerOf(creator, "handle"),
        profileUrl: markerOf(creator, "profile URL"),
        followers: EXACT_FOLLOWERS,
        postsLast30Days: 17,
        avgComments: 43,
        source: "declared",
        badge: null,
      }),
    ]);
    // D46: the sign-in address and the identifiers of the storefront stay in the base
    expect(
      markersIn(response, [
        ...creators.flatMap((found) => [
          { name: "e-mail", value: markerOf(found, "sign-in e-mail") },
          { name: "public_ref", value: markerOf(found, "public_ref") },
          { name: "line", value: markerOf(found, "line identifier") },
        ]),
        ...brand.markers,
      ]),
    ).toEqual([]);
  });

  it("holds no key of contact, rank, score nor money at any depth, not even null (D46, D78, RG87)", async () => {
    const response = await search(admin.session, { filters: HERE });
    expect(response.statusCode, response.body).toBe(200);
    const keys = new Set(keysOf(response.json()));
    expect(NEVER_SERVED.filter((key) => keys.has(key))).toEqual([]);
    expect(keys.has("id")).toBe(false);
  });

  it("CA61: counts exactly with neither k nor switch, below k as with the switch closed, the same for an administrator", async () => {
    await withSearchSetting(
      kit.fx,
      "is_open_to_advertisers",
      false,
      async () => {
        const narrow = await search(admin.session, {
          filters: { ...HERE, F1: "pets", F8: ["it"] },
        });
        expect(narrow.statusCode, narrow.body).toBe(200);
        expect(narrow.json()).toMatchObject({
          state: "results",
          total: 0,
          rows: [],
        });
        const all = await search(admin.session, { filters: HERE });
        expect((all.json() as Page).total).toBe(11);
      },
    );
  });

  it("serves the filters of G: the state, the declared status and the agent in charge", async () => {
    const published = await search(agent.session, {
      filters: { ...HERE, G2: ["published"], G1: ["individual"] },
    });
    expect((published.json() as Page).total).toBe(11);
    const drafts = await search(agent.session, {
      filters: { ...HERE, G2: ["draft", "rejected"] },
    });
    expect(drafts.json()).toMatchObject({ total: 0, rows: [] });
    const ofOthers = await search(agent.session, {
      filters: { ...HERE, G8: [otherAgent.accountId] },
    });
    expect(ofOthers.json()).toMatchObject({ total: 0, rows: [] });
    const refusing = await search(agent.session, {
      filters: { ...HERE, G10: ["gambling"] },
    });
    expect((refusing.json() as Page).total).toBe(11);
  });
});

describe("L3G-T9 the campaign of origin and the pair blocked (10 RG71, RG73; 17b l. 869)", () => {
  it("links the search to an admitted campaign of any brand, a pair blocked is a boolean without motive nor author", async () => {
    const campaign = await brandCampaign(kit.fx, kit.server, brand);
    const blocked = creators[1];
    if (blocked === undefined) {
      throw new Error("no creator");
    }
    const motive = `L3G T9 motive ${randomUUID().slice(0, 8)}`;
    await kit.fx.migration`
      insert into matching.block_reasons (code, label_key, available_to_side)
      values ('lg_nine_block', 'block.reason.lg_nine_block', 'any')
      on conflict (code) do nothing`;
    await kit.fx.migration`
      insert into matching.party_blocks
        (advertiser_account_id, creator_account_id, blocked_by_account_id, blocked_by_side,
         reason_code, comment)
      values (${brand.accountId}, ${blocked.accountId}, ${admin.accountId}, 'influx',
              'lg_nine_block', ${motive})`;
    try {
      const response = await search(agent.session, {
        filters: HERE,
        campaignId: campaign.id,
      });
      expect(response.statusCode, response.body).toBe(200);
      const page = response.json() as Page;
      expect(page.total).toBe(11);
      expect(
        page.rows.filter((row) => row.blocked).map((row) => row.alias),
      ).toEqual([blocked.alias]);
      expect(response.body).not.toContain(motive);
      expect(response.body).not.toContain("lg_nine_block");
      expect(response.body).not.toContain(admin.accountId);
      const lines = await journalOf(agent);
      expect(lines.at(-1)).toMatchObject({
        outcome: "served",
        actor_role: "agent",
        view_mode: "agent_identified",
        campaign_id: campaign.id,
      });
      // without a campaign no pair is looked at
      const free = await search(agent.session, { filters: HERE });
      expect((free.json() as Page).rows.some((row) => row.blocked)).toBe(false);
    } finally {
      await kit.fx.migration`
        delete from matching.party_blocks where creator_account_id = ${blocked.accountId}`;
    }
  });
});

describe("L3G-T9 T14.1 to T14.4, TM12.5 the agents alone reach the view (fiche invariants 2, 14)", () => {
  it("TM12.5: a member of any role gets the 404 of a route that does not exist on the web surface, a 401 on the backoffice's", async () => {
    const creator = await kit.fx.newMember("creator");
    const memberSession = await kit.memberSession();
    for (const [session, cookie] of [
      [creator.session, "__Host-influx-session"],
      [brand.session, "__Host-influx-session"],
    ] as const) {
      const got = answer(
        await kit.bo(
          "POST",
          URL_IDENTIFIED,
          session,
          { filters: HERE },
          { surface: "web", cookie },
        ),
      );
      expect(got).toEqual(unknownAddress);
    }
    for (const session of [null, memberSession, brand.session]) {
      const got = answer(await search(session, { filters: HERE }));
      expect(got.status).toBe(401);
      expect(got.error.code).toBe("unauthenticated");
    }
  });

  it("T14.3, T14.4: a draft campaign, an unknown one and a campaign of nobody answer exactly like an address that does not exist, nothing journaled", async () => {
    const draft = await brandCampaign(kit.fx, kit.server, brand, {
      state: "draft",
    });
    const rejected = await brandCampaign(kit.fx, kit.server, brand, {
      state: "rejected",
    });
    const before = (await journalOf(otherAgent)).length;
    for (const campaignId of [draft.id, rejected.id, randomUUID()]) {
      const got = answer(
        await search(otherAgent.session, { filters: HERE, campaignId }),
      );
      expect(got.status, campaignId).toBe(404);
      expect(got.error, campaignId).toEqual(unknownAddress.error);
    }
    expect(await journalOf(otherAgent)).toHaveLength(before);
  });

  it("T14.3: a prefill that does not exist, or that another agent drew, answers 404 like an unknown address", async () => {
    const campaign = await brandCampaign(kit.fx, kit.server, brand);
    const drawn = await kit.bo(
      "POST",
      `/v1/bo/campaigns/${campaign.id}/creator-prefill`,
      agent.session,
    );
    expect(drawn.statusCode, drawn.body).toBe(200);
    const { prefillId } = drawn.json() as { prefillId: string };
    for (const [session, id] of [
      [otherAgent.session, prefillId],
      [agent.session, randomUUID()],
    ] as const) {
      const got = answer(
        await search(session, {
          filters: HERE,
          campaignId: campaign.id,
          prefillId: id,
        }),
      );
      expect(got.status).toBe(404);
      expect(got.error).toEqual(unknownAddress.error);
    }
    // the agent who drew it links his search to it, journaled (CA56)
    const own = await search(agent.session, {
      filters: HERE,
      campaignId: campaign.id,
      prefillId,
    });
    expect(own.statusCode, own.body).toBe(200);
    expect((await journalOf(agent)).at(-1)).toMatchObject({
      outcome: "served",
      campaign_id: campaign.id,
      prefill_id: prefillId,
    });
  });
});

describe("L3G-T9 the entry closed, the cap and the journal (10 RG63, RG76, RG78; CA58; 18 TM12.3)", () => {
  it("TM12.3: no size of page, no facet outside the base, no unknown key, no contact filter: 400 before the session, nothing journaled", async () => {
    const before = (await journalOf(agent)).length;
    for (const body of [
      { filters: HERE, pageSize: 50 },
      { filters: HERE, limit: 100 },
      { filters: HERE, email: "someone@example.test" },
      { filters: { ...HERE, F12: ["lt_500"] } },
      { filters: { ...HERE, G3: ["x"] } },
      { filters: { ...HERE, G2: ["archived"] } },
      { filters: { ...HERE, G1: ["individual", "individual"] } },
      { filters: { ...HERE, G8: ["not-an-agent"] } },
      { filters: { ...HERE, G9: { country: "FR", regions: ["BE-WAL"] } } },
      { filters: HERE, page: 51 },
      { filters: HERE, sort: "price" },
      { filters: HERE, campaignId: "not-a-uuid" },
      { sort: "default" },
    ]) {
      const response = await search(agent.session, body);
      expect(
        { status: response.statusCode, code: answer(response).error.code },
        JSON.stringify(body),
      ).toEqual({ status: 400, code: "validation_failed" });
    }
    expect(await journalOf(agent)).toHaveLength(before);
  });

  it("a facet closed in table is a 400 on `filters`, nothing journaled", async () => {
    await kit.fx.migration`
      update search.facet_settings set is_open = false where facet_code = 'F8'`;
    try {
      const before = (await journalOf(agent)).length;
      const response = await search(agent.session, {
        filters: { ...HERE, F8: ["fr"] },
      });
      expect(response.statusCode, response.body).toBe(400);
      expect(issuesOf(response)).toEqual([
        { path: "filters", issue: "invalid_filters" },
      ]);
      expect(await journalOf(agent)).toHaveLength(before);
    } finally {
      await kit.fx.migration`
        update search.facet_settings set is_open = true where facet_code = 'F8'`;
    }
  });

  it("RG76: the cap of pages held by the base, a 400 on `page` after the COMMIT, the attempt journaled; the last page says the cap hides rows", async () => {
    await withSearchSetting(
      kit.fx,
      "identified_view",
      { pageSize: 10, maxPages: 1 },
      async () => {
        const last = await search(otherAgent.session, { filters: HERE });
        expect(last.statusCode, last.body).toBe(200);
        const page = last.json() as Page;
        expect(page.rows).toHaveLength(10);
        expect(page).toMatchObject({
          total: 11,
          nextPage: null,
          capReached: true,
        });
        const beyond = await search(otherAgent.session, {
          filters: HERE,
          page: 2,
        });
        expect(beyond.statusCode, beyond.body).toBe(400);
        expect(issuesOf(beyond)).toEqual([{ path: "page", issue: "page_cap" }]);
      },
    );
    expect(
      (await journalOf(otherAgent)).slice(-2).map((line) => line.outcome),
    ).toEqual(["served", "page_cap"]);
  });

  it("CA58: journals the search nominatively, its exact count and one impression per row, nothing to the outbox, matching nor the creator", async () => {
    const before = await sideEffectsOf(kit.fx);
    const lines = (await journalOf(admin)).length;
    const response = await search(admin.session, {
      filters: { ...HERE, F1: "pets" },
      sort: "audience",
    });
    expect(response.statusCode, response.body).toBe(200);
    const page = response.json() as Page;
    expect(page.rows.length).toBeGreaterThan(0);
    const journal = await journalOf(admin);
    expect(journal).toHaveLength(lines + 1);
    expect(journal.at(-1)).toMatchObject({
      outcome: "served",
      actor_role: "admin",
      view_mode: "agent_identified",
      campaign_id: null,
      prefill_id: null,
      result_count: page.total,
      page_reached: 1,
      blocked: false,
      filters: { ...HERE, F1: "pets" },
      impressions: page.rows.length,
    });
    expect(await sideEffectsOf(kit.fx)).toEqual(before);
  });

  it("503: a setting of the view missing from the base is the answer of an unavailable service, the transaction rolled back", async () => {
    const [saved] = await kit.fx.migration<{ value: string }[]>`
      select value::text as value from search.search_settings where key = 'identified_view'`;
    if (saved === undefined) {
      throw new Error("no identified_view setting");
    }
    await kit.fx
      .migration`delete from search.search_settings where key = 'identified_view'`;
    try {
      const before = (await journalOf(agent)).length;
      const response = await search(agent.session, { filters: HERE });
      expect(answer(response)).toMatchObject({
        status: 503,
        error: { code: "service_unavailable" },
      });
      expect(await journalOf(agent)).toHaveLength(before);
    } finally {
      await kit.fx.migration`
        insert into search.search_settings (key, value) values ('identified_view', ${saved.value}::text::jsonb)`;
    }
  });

  it("TM12.3: the two routes of the view are registered, none of them an export, none with a size of page", () => {
    const routes = routeInventoryOf(kit.server).filter(
      (route) =>
        route.url.includes("creator-search") ||
        route.url.includes("creator-prefill"),
    );
    const found = routes
      .filter((route) => route.url.startsWith("/v1/bo/"))
      .map((route) => `${route.method} ${route.url}`)
      .sort();
    expect(found).toEqual([
      "POST /v1/bo/campaigns/:id/creator-prefill",
      "POST /v1/bo/creator-search",
    ]);
    // no route of the whole server exports a search, in any format (C(17))
    expect(
      routeInventoryOf(kit.server)
        .map((route) => route.url)
        .filter((url) => /search|campaign|creator/.test(url))
        .filter((url) => /export|csv|xlsx|download/.test(url)),
    ).toEqual([]);
    const SIZE =
      /^(limit|size|pageSize|perPage|per_page|page_size|count|format)$/;
    expect(
      Object.keys(identifiedCreatorSearchBodySchema.shape).filter((key) =>
        SIZE.test(key),
      ),
    ).toEqual([]);
    expect(Object.keys(identifiedCreatorSearchBodySchema.shape).sort()).toEqual(
      ["campaignId", "filters", "page", "prefillId", "sort"],
    );
  });
});
