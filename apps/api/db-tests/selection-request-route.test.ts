// L3F commit 08 — L3F-T8: the brand's request for a selection by the INFLUX team, POST /v1/me/selection-
// requests (docs/mvp/10 RG1, RG61, RG63; CA39, CA59, CA64; 18 T14, T15.4; D38, D45, D46, D48, D78;
// jalons/l3f/modele.md §6, §8; fiche invariants 6, 10, 11, 15). Through fastify.inject(), straight to
// apps/api, the door of 0325 behind it:
//   - the contract is strict and the answer holds the deadline of the team's answer alone: every
//     criterion, the campaign, the language and the message are stored, none echoed, no price (D78);
//   - the button is permanent: the switch closed (D38) and criteria that no creator meets do not refuse
//     it (RG61, CA59);
//   - the bucket of the brand (`requestsPerDay`) answers 429 with Retry-After, nothing written, the line
//     naming no account; the address bound (10 a minute) answers before the session (T15.4);
//   - T14: a campaign of another brand, a draft or an unknown one answers as an address that does not
//     exist; a creator or no session is refused before the door; a brand not published gets its state;
//   - nothing goes to the outbox (Brevo, Apollo), matching nor messaging, no creator is written to
//     (D45, CA64); the register holds one line a request.
// Accounts COMMITTED through campaign-routes-kit.ts, creators through creator-search-kit.ts.
import { selectionRequestBodySchema } from "@influx/contracts/selection-requests";
import { randomUUID } from "node:crypto";
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
  expectLockTimeoutRefusal,
  forgetSelections,
  HERE,
  keysOf,
  markersIn,
  openSearch,
  RG48_KEYS,
  searchableCreators,
  sendAsMember,
  sideEffectsOf,
  URL_SELECTION_REQUESTS,
  withSearchSetting,
  type SearchCreator,
} from "./creator-search-kit.ts";
import {
  brandCampaign,
  memoryStore,
  publishedBrand,
  type FixtureCampaign,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";

let fx: CampaignRouteFixtures;
let server: Server;
let owner: PublishedBrand;
let stranger: PublishedBrand;
let creators: SearchCreator[];
let campaign: FixtureCampaign;
let draftCampaign: FixtureCampaign;
let strangersCampaign: FixtureCampaign;
const brands: Member[] = [];
/** The answer of an address that does not exist (T14.4). */
let unknownAddress: { status: number; code: string; message: string };

type StoredRequest = {
  campaign_id: string | null;
  filters: unknown;
  language: string;
  message: string | null;
  state: string;
  due: string;
  on_time: boolean;
};

const FILTERS = { F1: "pets", ...HERE } as const;

async function newBrand(): Promise<PublishedBrand> {
  const brand = await publishedBrand(fx, server);
  brands.push(brand);
  return brand;
}

/** A client address of its own for each call (10 a minute per address): the bound has its own case. */
let calls = 0;
function freshAddress(): string {
  calls += 1;
  return `10.77.${Math.floor(calls / 250)}.${(calls % 250) + 1}`;
}

const request = (member: Member | null, body: unknown, address?: string) =>
  sendAsMember(
    server,
    member,
    "POST",
    URL_SELECTION_REQUESTS,
    body,
    address ?? freshAddress(),
  );

async function requestsOf(member: Member): Promise<StoredRequest[]> {
  return fx.migration<StoredRequest[]>`
    select r.campaign_id::text as campaign_id, r.filters, r.language, r.message, r.state,
           to_char(r.sla_due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as due,
           r.sla_due_at > r.created_at as on_time
      from search.selection_requests r
     where r.advertiser_account_id = ${member.accountId}
     order by r.created_at, r.id`;
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server({ storage: memoryStore() });
  await openSearch(fx);
  owner = await newBrand();
  stranger = await newBrand();
  creators = await searchableCreators(fx, 3);
  campaign = await brandCampaign(fx, server, owner, { state: "paused" });
  draftCampaign = await brandCampaign(fx, server, owner, { state: "draft" });
  strangersCampaign = await brandCampaign(fx, server, stranger, {
    state: "paused",
  });
  unknownAddress = fx.errorBody(
    await fx.call(
      server,
      "GET",
      "/v1/me/selection-requests-nothing",
      owner.session,
    ),
  );
  expect(unknownAddress).toEqual({
    status: 404,
    code: "not_found",
    message: "Not found",
  });
});

afterAll(async () => {
  await forgetSelections(fx, brands);
  await closeSearch(fx);
  await fx.close();
});

describe("L3F-T8 CA39 every criterion, the campaign, the language and the message (10 RG61; modele §6; fiche invariant 11)", () => {
  it("CA39: answers {state: requested, answerBy} alone, no-store; the request stores the filters as entered, the campaign, the language of the account, the message trimmed and the deadline the answer gives; none of it echoed", async () => {
    const brand = owner;
    const response = await request(brand, {
      filters: FILTERS,
      campaignId: campaign.id,
      message: "  Twelve creators, please.\nPets first.  ",
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const answer = response.json() as { state: string; answerBy: string };
    expect(Object.keys(answer).sort()).toEqual(["answerBy", "state"]);
    expect(answer.state).toBe("requested");
    expect(Date.parse(answer.answerBy)).toBeGreaterThan(Date.now());
    const lines = await requestsOf(brand);
    expect(lines).toEqual([
      {
        campaign_id: campaign.id,
        filters: FILTERS,
        language: "fr",
        message: "Twelve creators, please.\nPets first.",
        state: "open",
        on_time: true,
        due: answer.answerBy,
      },
    ]);
    for (const text of ["Twelve creators", "Pets first", campaign.id, "pets"]) {
      expect(response.body, text).not.toContain(text);
    }
    expect(
      RG48_KEYS.filter((key) => new Set(keysOf(response.json())).has(key)),
    ).toEqual([]);
    expect(
      markersIn(
        response,
        creators.flatMap((c) => c.markers),
      ),
    ).toEqual([]);
  });

  it("a request with neither campaign nor message nor criteria is a request; the message and the campaign are optional", async () => {
    const brand = await newBrand();
    for (const body of [
      { filters: {} },
      { filters: FILTERS, campaignId: null, message: null },
    ]) {
      const response = await request(brand, body);
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toMatchObject({ state: "requested" });
    }
    const lines = await requestsOf(brand);
    expect(lines.map((line) => line.message)).toEqual([null, null]);
    expect(lines.map((line) => line.campaign_id)).toEqual([null, null]);
  });
});

describe("L3F-T8 RG61, CA59 the button is permanent (10 RG61; D38; fiche invariant 10)", () => {
  it("D38, CA59: the switch closed and criteria that no creator meets do not refuse the request", async () => {
    const brand = await newBrand();
    await withSearchSetting(fx, "is_open_to_advertisers", false, async () => {
      const response = await request(brand, { filters: FILTERS });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json()).toMatchObject({ state: "requested" });
    });
    // open again, a main audience country no creator of the file has: below k, still accepted
    const narrow = await request(brand, {
      filters: { F1: "pets", F6: { country: "NZ", shareBands: ["lt_50"] } },
    });
    expect(narrow.statusCode, narrow.body).toBe(200);
    expect(narrow.json()).toMatchObject({ state: "requested" });
    expect(await requestsOf(brand)).toHaveLength(2);
  });
});

describe("L3F-T8 the entry is closed and the bucket of the brand holds (10 RG61, RG63; modele §6, §8)", () => {
  it("a body with another key, a price, a budget or an identifier is 400; a facet closed in table is 400 on `filters`; a message out of bounds 400 on `message`; nothing written", async () => {
    const brand = await newBrand();
    for (const body of [
      { filters: FILTERS, creatorAccountId: randomUUID() },
      { filters: FILTERS, price: 100 },
      { filters: FILTERS, budget: "10000_25000", currency: "EUR" },
      { filters: { ...FILTERS, F12: ["price"] } },
      { filters: FILTERS, campaignId: "not-a-uuid" },
      { filters: FILTERS, message: "" },
      { message: "No filters key" },
      {},
    ]) {
      const response = await request(brand, body);
      expect(response.statusCode, JSON.stringify(body)).toBe(400);
      expect(fx.errorBody(response).code).toBe("validation_failed");
    }
    // the base refuses what the contract lets through: a message of blanks, one of 1 001 characters
    for (const message of ["   ", "x".repeat(1001)]) {
      const response = await request(brand, { filters: FILTERS, message });
      expect(response.statusCode, message.slice(0, 3)).toBe(400);
      expect(fx.issuesOf(response)).toEqual([
        { path: "message", issue: "invalid_message" },
      ]);
    }
    // a facet of the contract the base keeps closed (facet_settings): 22023 on `filters`
    await fx.migration`
      update search.facet_settings set is_open = false where facet_code = 'F11'`;
    try {
      const response = await request(brand, {
        filters: { ...FILTERS, F11: ["instagram_reel"] },
      });
      expect(response.statusCode, response.body).toBe(400);
      expect(fx.issuesOf(response)).toEqual([
        { path: "filters", issue: "invalid_filters" },
      ]);
    } finally {
      await fx.migration`
        update search.facet_settings set is_open = true where facet_code = 'F11'`;
    }
    expect(await requestsOf(brand)).toEqual([]);
    // the contract itself has no size, no price, no identifier
    expect(Object.keys(selectionRequestBodySchema.shape).sort()).toEqual([
      "campaignId",
      "filters",
      "message",
    ]);
  });

  it("requestsPerDay reached: 429 rate_limited with Retry-After, nothing written, the line names no account; another brand is not affected", async () => {
    const brand = await newBrand();
    await withSearchSetting(
      fx,
      "selection_limits",
      { listsPerAccount: 10, itemsPerList: 25, requestsPerDay: 2 },
      async () => {
        for (let index = 0; index < 2; index += 1) {
          expect((await request(brand, { filters: FILTERS })).statusCode).toBe(
            200,
          );
        }
        const refused = await request(brand, {
          filters: FILTERS,
          message: "A third one",
        });
        expect(fx.errorBody(refused)).toMatchObject({
          status: 429,
          code: "rate_limited",
        });
        const retryAfter = Number(refused.headers["retry-after"]);
        expect(retryAfter).toBeGreaterThan(0);
        expect(retryAfter).toBeLessThanOrEqual(24 * 3600);
        expect(await requestsOf(brand)).toHaveLength(2);
        const other = await newBrand();
        expect((await request(other, { filters: FILTERS })).statusCode).toBe(
          200,
        );
      },
    );
    const text = fx.logStreams.map((stream) => stream()).join("\n");
    expect(text).toContain("search.selection_request.refused");
    expect(text).not.toContain(brand.accountId);
    expect(text).not.toContain("A third one");
  });

  it("T15.4: past 10 a minute from one client address the route answers 429 before the session, another address still passes", async () => {
    const address = "198.51.100.77";
    for (let index = 0; index < 10; index += 1) {
      expect(
        fx.errorBody(await request(null, { filters: {} }, address)).status,
      ).toBe(401);
    }
    const refused = await request(null, { filters: {} }, address);
    expect(fx.errorBody(refused)).toMatchObject({
      status: 429,
      code: "rate_limited",
    });
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    expect(
      fx.errorBody(await request(null, { filters: {} }, "198.51.100.78"))
        .status,
    ).toBe(401);
  });
});

describe("L3F-T8 T14.1 to T14.4 the campaign, the role, the brand (18 T14; fiche invariant 15)", () => {
  it("T14.4: a campaign of another brand, a draft or an unknown one answers byte for byte as an address that does not exist, nothing written; an admitted one of the brand is stored", async () => {
    const brand = owner;
    const before = (await requestsOf(brand)).length;
    const unknown = await request(brand, {
      filters: FILTERS,
      campaignId: randomUUID(),
    });
    for (const campaignId of [strangersCampaign.id, draftCampaign.id]) {
      const refused = await request(brand, { filters: FILTERS, campaignId });
      expect(fx.errorBody(refused)).toEqual(unknownAddress);
      expect(refused.body.replace(/"requestId":"[^"]*"/, "")).toBe(
        unknown.body.replace(/"requestId":"[^"]*"/, ""),
      );
      expect(refused.body).not.toContain(campaignId);
    }
    expect(fx.errorBody(unknown)).toEqual(unknownAddress);
    expect(await requestsOf(brand)).toHaveLength(before);
    const admitted = await request(brand, {
      filters: FILTERS,
      campaignId: campaign.id,
    });
    expect(admitted.statusCode, admitted.body).toBe(200);
    expect(await requestsOf(brand)).toHaveLength(before + 1);
  });

  it("T14.3: a creator gets the answer of a route that does not exist before the door, no session is 401, a brand not published gets its state; nothing written", async () => {
    const creator = await fx.newMember("creator");
    const refused = await request(creator, { filters: FILTERS });
    expect(fx.errorBody(refused)).toEqual(unknownAddress);
    expect(fx.errorBody(await request(null, { filters: FILTERS })).status).toBe(
      401,
    );
    const draft = await fx.newMember("advertiser");
    brands.push(draft);
    const state = await request(draft, { filters: FILTERS });
    expect(state.statusCode, state.body).toBe(200);
    expect(state.json()).toEqual({ state: "brand_not_published" });
    for (const member of [creator, draft]) {
      expect(await requestsOf(member)).toEqual([]);
    }
  });
});

describe("L3F-T8 nothing leaves the brand (10 RG8; CA64; D45, D46)", () => {
  it("D45, CA64: a request writes nothing to the outbox (Brevo, Apollo), matching nor messaging, and no creator; one line of the register by the brand", async () => {
    const brand = await newBrand();
    const before = await sideEffectsOf(fx);
    expect(Object.keys(before.tables)).toContain("matching.party_blocks");
    const [audits] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from audit.audit_events e
       where e.event_type = 'search.selection_requested' and e.actor_account_id = ${brand.accountId}`;
    const creatorsBefore = await fx.migration<{ digest: string }[]>`
      select md5(p::text) as digest from profiles.creator_public_profiles p
       where p.account_id = any(${creators.map((c) => c.accountId)}::uuid[])
       order by p.account_id`;
    const response = await request(brand, {
      filters: FILTERS,
      message: "For the team only",
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(await sideEffectsOf(fx)).toEqual(before);
    const [after] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from audit.audit_events e
       where e.event_type = 'search.selection_requested' and e.actor_account_id = ${brand.accountId}`;
    expect(after?.n).toBe((audits?.n ?? 0) + 1);
    expect(
      await fx.migration`
        select md5(p::text) as digest from profiles.creator_public_profiles p
         where p.account_id = any(${creators.map((c) => c.accountId)}::uuid[])
         order by p.account_id`,
    ).toEqual(creatorsBefore);
    // the message is read by the agents alone: no route of a brand returns it (D46)
    const routes = routeInventoryOf(server)
      .filter((route) => route.url.includes("selection-request"))
      .map((route) => `${route.method} ${route.url}`);
    expect(routes).toEqual(["POST /v1/me/selection-requests"]);
  });
});

describe("L3G fix-2 L3GS-1 a lock timeout answers 429 (0327; D85 (1))", () => {
  it("the lock of the brand's requests held elsewhere: 429 rate_limited, Retry-After 1, the envelope alone, no server error line, nothing written", async () => {
    const brand = await newBrand();
    await expectLockTimeoutRefusal(
      fx,
      `search.selection_requests:${brand.accountId}`,
      () => request(brand, { filters: FILTERS }),
    );
    expect(await requestsOf(brand)).toEqual([]);
  });
});
