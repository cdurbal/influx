// L3E commit 08 — L3E-T8: T15 on the brand's creator search (docs/mvp/18 T15.2 to T15.5; 10 RG63,
// RG64; jalons/l3e/modele.md §8; fiche invariant 10). Two bounds, independent:
//   - the ACCOUNT, in the base (search.creator_search_retry_after, 0319): a page is a search (served
//     and page_cap count, rate_limited never), on 1 h and 24 h sliding, the values in
//     search.search_settings (rate_limits); over it, 429 rate_limited with the Retry-After the base
//     computed, nothing served, the refusal journaled with the account once per window (T15.5, 0315);
//   - the CLIENT ADDRESS, in memory (platform/member-rate.ts), before the session: over it, 429 with
//     Retry-After, nothing journaled, the log line without the address (D60).
// Through fastify.inject(), straight to apps/api without any front (T15.3). The settings are lowered
// for a case and put back after it (committed: the local stack is disposable, the files run one after
// the other). Accounts COMMITTED through campaign-routes-kit.ts, creators through creator-search-kit.ts.
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MEMBER_ROUTE_ADDRESS_RATES } from "../src/platform/member-rate.ts";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  closeSearch,
  HERE,
  openSearch,
  postSearch,
  searchableCreators,
  searchesOf,
  withSearchSetting,
  type SearchCreator,
} from "./creator-search-kit.ts";
import { publishedBrand } from "./open-campaigns-kit.ts";

const ADDRESS_A = "203.0.113.7";
const ADDRESS_B = "198.51.100.9";

let fx: CampaignRouteFixtures;
let server: Server;
let creators: SearchCreator[];

/** Sets the bucket of the accounts for the time of `work`, then puts the previous value back. */
function withBucket<T>(
  perHour: number,
  perDay: number,
  work: () => Promise<T>,
): Promise<T> {
  return withSearchSetting(
    fx,
    "rate_limits",
    { perHour, perDay, profileOpensPerDay: 60 },
    work,
  );
}

function search(
  target: Server,
  member: Member,
  body: unknown = { filters: HERE },
  address = ADDRESS_A,
): Promise<LightMyRequestResponse> {
  return postSearch(target, member, body, address);
}

function expectRateLimited(response: LightMyRequestResponse, label: string) {
  expect(fx.errorBody(response), label).toEqual({
    status: 429,
    code: "rate_limited",
    message: "Too many requests",
  });
  for (const creator of creators) {
    expect(response.body, label).not.toContain(creator.alias);
  }
  return Number(response.headers["retry-after"]);
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server();
  await openSearch(fx);
  creators = await searchableCreators(fx, 5);
});

afterAll(async () => {
  await closeSearch(fx);
  await fx.close();
});

describe("L3E-T8 the bucket of the account, in the base (10 RG63, RG64; 18 T15.2, T15.3, T15.5)", () => {
  it("T15.2, T15.3: past the searches per hour of the table, a direct call gets 429 with Retry-After and no creator", async () => {
    const brand = await publishedBrand(fx, server);
    await withBucket(3, 200, async () => {
      for (let index = 0; index < 3; index += 1) {
        const served = await search(server, brand);
        expect(served.statusCode, served.body).toBe(200);
        expect(served.json()).toMatchObject({ state: "results" });
      }
      const retryAfter = expectRateLimited(await search(server, brand), "hour");
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(3600);
    });
  });

  it("T15.5: the refusal is journaled with the account once per window (0315), never counted as a search", async () => {
    const brand = await publishedBrand(fx, server);
    await withBucket(2, 200, async () => {
      expect((await search(server, brand)).statusCode).toBe(200);
      expect((await search(server, brand)).statusCode).toBe(200);
      for (let index = 0; index < 3; index += 1) {
        expectRateLimited(await search(server, brand), `refusal ${index}`);
      }
    });
    expect((await searchesOf(fx, brand)).map((line) => line.outcome)).toEqual([
      "served",
      "served",
      "rate_limited",
    ]);
  });

  it("RG63: a page beyond the cap is a search too, and counts in the bucket", async () => {
    const brand = await publishedBrand(fx, server);
    await withBucket(2, 200, async () => {
      const capped = await search(server, brand, { filters: HERE, page: 6 });
      expect(fx.errorBody(capped).status).toBe(400);
      expect((await search(server, brand)).statusCode).toBe(200);
      expectRateLimited(await search(server, brand), "after the cap");
    });
    expect((await searchesOf(fx, brand)).map((line) => line.outcome)).toEqual([
      "page_cap",
      "served",
      "rate_limited",
    ]);
  });

  it("RG64: the searches per day of the table hold on 24 h, with a Retry-After beyond the hour", async () => {
    const brand = await publishedBrand(fx, server);
    // perHour <= perDay (CHECK of 0316): both full, the day decides the wait
    await withBucket(2, 2, async () => {
      expect((await search(server, brand)).statusCode).toBe(200);
      expect((await search(server, brand)).statusCode).toBe(200);
      const retryAfter = expectRateLimited(await search(server, brand), "day");
      expect(retryAfter).toBeGreaterThan(3600);
      expect(retryAfter).toBeLessThanOrEqual(86_400);
    });
  });
});

describe("L3E-T8 the bound of the client address, in memory, independent of the account (18 T15.4)", () => {
  it("T15.4: an account over its bucket does not hold back another account from the same address", async () => {
    const first = await publishedBrand(fx, server);
    const second = await publishedBrand(fx, server);
    await withBucket(1, 200, async () => {
      expect((await search(server, first)).statusCode).toBe(200);
      expectRateLimited(await search(server, first), "first account");
      const other = await search(server, second);
      expect(other.statusCode, other.body).toBe(200);
    });
  });

  it("T15.4: past the bound of an address, every brand is refused from it before its session, nothing journaled, while another address passes", async () => {
    // a clock of its own: the window of the address is a fixed minute, never crossed mid-case
    const fixed = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 1_000);
    const bounded = fx.server({ now: () => fixed });
    const limit = MEMBER_ROUTE_ADDRESS_RATES["POST /v1/creator-search"];
    const brands = [
      await publishedBrand(fx, server),
      await publishedBrand(fx, server),
    ];
    // below k (one creator of the file in Italian: none), cheap, still a search of the journal
    const narrow = { filters: { ...HERE, F8: ["it"] } };
    await withBucket(600, 20_000, async () => {
      for (let index = 0; index < limit; index += 1) {
        const member = brands[index % 2] as Member;
        const served = await search(bounded, member, narrow, ADDRESS_A);
        expect(served.statusCode, `call ${index}`).toBe(200);
      }
      for (const member of brands) {
        const refused = await search(bounded, member, narrow, ADDRESS_A);
        const retryAfter = expectRateLimited(refused, "address");
        expect(retryAfter).toBeGreaterThanOrEqual(1);
        expect(retryAfter).toBeLessThanOrEqual(60);
      }
      // another address has its own window
      expect(
        (await search(bounded, brands[1] as Member, narrow, ADDRESS_B))
          .statusCode,
      ).toBe(200);
    });
    // the refusals of the address reached no door: only the served searches are journaled
    const lines = [
      ...(await searchesOf(fx, brands[0] as Member)),
      ...(await searchesOf(fx, brands[1] as Member)),
    ];
    expect(lines.filter((line) => line.outcome !== "served")).toEqual([]);
    expect(lines).toHaveLength(limit + 1);
    // D60: the line of the refusal names the route and the bound, never the address
    const text = fx.logStreams.map((stream) => stream()).join("\n");
    expect(text).toContain("member route over its address rate");
    expect(text).not.toContain(ADDRESS_A);
    expect(text).not.toContain(ADDRESS_B);
  });
});
