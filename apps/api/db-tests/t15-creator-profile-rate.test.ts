// L3F commit 07 — L3F-T7: T15 on the profile a brand opens (docs/mvp/18 T15.2 to T15.5; 10 RG63, RG64;
// jalons/l3f/modele.md §2, §8; fiche invariant 8). Two bounds, independent:
//   - the ACCOUNT, in the base (search.creator_open_retry_after, 0323): the openings served on 24 h
//     sliding, a reopening included, against `profileOpensPerDay` of search.search_settings
//     (rate_limits); over it, 429 rate_limited with the Retry-After the base computed, nothing served,
//     the refusal journaled once per window (L3DS-1), never counted as an opening;
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
  getProfile,
  openingsOf,
  openSearch,
  searchableCreators,
  withSearchSetting,
  type SearchCreator,
} from "./creator-search-kit.ts";
import { publishedBrand } from "./open-campaigns-kit.ts";

const ADDRESS_A = "203.0.113.7";
const ADDRESS_B = "198.51.100.9";

let fx: CampaignRouteFixtures;
let server: Server;
let creators: SearchCreator[];

/** Sets the openings per day of the accounts for the time of `work`, then puts the value back. */
function withOpenings<T>(perDay: number, work: () => Promise<T>): Promise<T> {
  return withSearchSetting(
    fx,
    "rate_limits",
    { perHour: 30, perDay: 200, profileOpensPerDay: perDay },
    work,
  );
}

function open(
  target: Server,
  member: Member,
  creator: SearchCreator = creators[0] as SearchCreator,
  address = ADDRESS_A,
): Promise<LightMyRequestResponse> {
  return getProfile(target, member, creator.alias, address);
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

describe("L3F-T7 the bucket of the openings of the account, in the base (10 RG63, RG64; 18 T15.2, T15.3, T15.5)", () => {
  it("T15.2, T15.3: past the openings per day of the table, a direct call gets 429 with Retry-After and no creator", async () => {
    const brand = await publishedBrand(fx, server);
    await withOpenings(3, async () => {
      for (const creator of creators.slice(0, 3)) {
        const served = await open(server, brand, creator);
        expect(served.statusCode, served.body).toBe(200);
        expect(served.json()).toMatchObject({ state: "profile" });
      }
      const refused = await open(server, brand, creators[3] as SearchCreator);
      const retryAfter = expectRateLimited(refused, "day");
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(86_400);
      expect(refused.headers["cache-control"]).toBe("no-store");
    });
  });

  it("T15.5, L3DS-1: a reopening counts, the refusal is journaled once per window without a creator, never as an opening", async () => {
    const brand = await publishedBrand(fx, server);
    const creator = creators[0] as SearchCreator;
    await withOpenings(2, async () => {
      expect((await open(server, brand, creator)).statusCode).toBe(200);
      expect((await open(server, brand, creator)).statusCode).toBe(200);
      for (let index = 0; index < 3; index += 1) {
        expectRateLimited(
          await open(server, brand, creator),
          `refusal ${index}`,
        );
      }
    });
    expect(await openingsOf(fx, brand)).toEqual([
      {
        outcome: "served",
        creator_account_id: creator.accountId,
        from_search: false,
      },
      {
        outcome: "served",
        creator_account_id: creator.accountId,
        from_search: false,
      },
      { outcome: "rate_limited", creator_account_id: null, from_search: false },
    ]);
  });
});

describe("L3F-T7 the bound of the client address, in memory, independent of the account (18 T15.4)", () => {
  it("T15.4: an account over its bucket does not hold back another account from the same address", async () => {
    const first = await publishedBrand(fx, server);
    const second = await publishedBrand(fx, server);
    await withOpenings(1, async () => {
      expect((await open(server, first)).statusCode).toBe(200);
      expectRateLimited(await open(server, first), "first account");
      const other = await open(server, second);
      expect(other.statusCode, other.body).toBe(200);
    });
  });

  it("T15.4: past the bound of an address, every brand is refused from it before its session, nothing journaled, while another address passes", async () => {
    // a clock of its own: the window of the address is a fixed minute, never crossed mid-case
    const fixed = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 1_000);
    const bounded = fx.server({ now: () => fixed });
    const limit =
      MEMBER_ROUTE_ADDRESS_RATES["GET /v1/creator-search/profiles/:alias"];
    const brands = [
      await publishedBrand(fx, server),
      await publishedBrand(fx, server),
    ];
    await withOpenings(1000, async () => {
      for (let index = 0; index < limit; index += 1) {
        const member = brands[index % 2] as Member;
        const served = await open(bounded, member);
        expect(served.statusCode, `call ${index}`).toBe(200);
      }
      for (const member of brands) {
        const refused = await open(bounded, member);
        const retryAfter = expectRateLimited(refused, "address");
        expect(retryAfter).toBeGreaterThanOrEqual(1);
        expect(retryAfter).toBeLessThanOrEqual(60);
      }
      // another address has its own window
      expect(
        (await open(bounded, brands[1] as Member, undefined, ADDRESS_B))
          .statusCode,
      ).toBe(200);
    });
    // the refusals of the address reached no door: only the served openings are journaled
    const lines = [
      ...(await openingsOf(fx, brands[0] as Member)),
      ...(await openingsOf(fx, brands[1] as Member)),
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
