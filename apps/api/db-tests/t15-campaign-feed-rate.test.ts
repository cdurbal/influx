// L3D commit 03 — L3D-T5: T15 on the creator's read of the open campaigns (docs/mvp/18 T15.3 to
// T15.5; 11 RG21, CA18; jalons/l3d/modele.md §5; fiche invariant 7). Two bounds, independent:
//   - the ACCOUNT, in the base (search.campaign_read_retry_after, 0314): the feed and the record in one
//     bucket, on 60 s and 24 h sliding, the values in backoffice.operational_settings; over it, 429
//     rate_limited with the Retry-After the base computed, nothing served, the refusal journaled with
//     the account (T15.5); the logo outside it;
//   - the CLIENT ADDRESS, in memory (platform/member-rate.ts), before the session: over it, 429 with
//     Retry-After, nothing journaled, the log line without the address (D60).
// Through fastify.inject(), straight to apps/api without any front (T15.3). The settings are lowered
// for a case and put back after it (committed: the local stack is disposable, the files run one after
// the other). Accounts COMMITTED through campaign-routes-kit.ts.
import { randomUUID } from "node:crypto";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MEMBER_ROUTE_ADDRESS_RATES } from "../src/platform/member-rate.ts";
import { WEB_SECRET } from "../tests/helpers.ts";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  brandCampaign,
  closeFeed,
  publishedBrand,
  readsOf,
  URL_FEED,
  type FixtureCampaign,
} from "./open-campaigns-kit.ts";

const ADDRESS_A = "203.0.113.7";
const ADDRESS_B = "198.51.100.9";

let fx: CampaignRouteFixtures;
let server: Server;
let campaign: FixtureCampaign;

function get(
  target: Server,
  path: string,
  member: Member,
  address: string = ADDRESS_A,
): Promise<LightMyRequestResponse> {
  return target.inject({
    method: "GET",
    url: path,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "x-real-ip": address,
      cookie: `__Host-influx-session=${member.session}`,
    },
  });
}

/** Sets the settings of the bucket for the time of `work`, then puts the previous values back. */
async function withBucket<T>(
  perMinute: number,
  perDay: number,
  work: () => Promise<T>,
): Promise<T> {
  const before = await fx.migration<{ key: string; value: number }[]>`
    select key, (value)::integer as value from backoffice.operational_settings
     where key in ('creator_campaign_reads_per_minute', 'creator_campaign_reads_per_day')`;
  const set = async (key: string, value: number) => {
    await fx.migration`
      update backoffice.operational_settings set value = to_jsonb(${value}::integer)
       where key = ${key}`;
  };
  await set("creator_campaign_reads_per_minute", perMinute);
  await set("creator_campaign_reads_per_day", perDay);
  try {
    return await work();
  } finally {
    for (const row of before) {
      await set(row.key, row.value);
    }
  }
}

function expectRateLimited(response: LightMyRequestResponse, label: string) {
  expect(fx.errorBody(response), label).toEqual({
    status: 429,
    code: "rate_limited",
    message: "Too many requests",
  });
  expect(response.body, label).not.toContain(campaign.title);
  return Number(response.headers["retry-after"]);
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server();
  await closeFeed(fx);
  const brand = await publishedBrand(fx, server);
  campaign = await brandCampaign(fx, server, brand);
});

afterAll(async () => {
  await closeFeed(fx);
  await fx.close();
});

describe("L3D-T5 the bucket of the account, in the base (11 RG21, CA18; 18 T15.3, T15.5)", () => {
  it("T15.3, CA18: past the reads per minute of the table, a direct call gets 429 with Retry-After and nothing of a campaign", async () => {
    const creator = await fx.newMember("creator");
    await withBucket(3, 600, async () => {
      for (let index = 0; index < 3; index += 1) {
        const served = await get(server, URL_FEED, creator);
        expect(served.statusCode, served.body).toBe(200);
        expect(served.body).toContain(campaign.title);
      }
      const refused = await get(server, URL_FEED, creator);
      const retryAfter = expectRateLimited(refused, "feed");
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(60);
      // the record shares the bucket: refused too, before any visibility is looked at
      expectRateLimited(
        await get(server, `${URL_FEED}/${campaign.id}`, creator),
        "record",
      );
    });
  });

  it("T15.5: every refusal is journaled with the account, never counted, and the logo stays outside the bucket", async () => {
    const creator = await fx.newMember("creator");
    await withBucket(2, 600, async () => {
      expect((await get(server, URL_FEED, creator)).statusCode).toBe(200);
      expect(
        (await get(server, `${URL_FEED}/${campaign.id}`, creator)).statusCode,
      ).toBe(200);
      for (let index = 0; index < 3; index += 1) {
        expectRateLimited(
          await get(server, URL_FEED, creator),
          `refusal ${index}`,
        );
      }
      expectRateLimited(
        await get(server, `${URL_FEED}/${campaign.id}`, creator),
        "record",
      );
      const logo = await get(
        server,
        `${URL_FEED}/${campaign.id}/brand-logo`,
        creator,
      );
      expect(logo.statusCode, logo.body).toBe(200);
    });
    expect(await readsOf(fx, creator)).toEqual([
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 1,
        outcome: "served",
      },
      {
        kind: "record",
        campaign_id: campaign.id,
        feed_sort: null,
        feed_page: null,
        outcome: "served",
      },
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 1,
        outcome: "rate_limited",
      },
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 1,
        outcome: "rate_limited",
      },
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 1,
        outcome: "rate_limited",
      },
      {
        kind: "record",
        campaign_id: campaign.id,
        feed_sort: null,
        feed_page: null,
        outcome: "rate_limited",
      },
    ]);
  });

  it("CA18: the reads per day of the table hold on 24 h, with a Retry-After beyond the minute", async () => {
    const creator = await fx.newMember("creator");
    await withBucket(600, 2, async () => {
      expect((await get(server, URL_FEED, creator)).statusCode).toBe(200);
      expect((await get(server, URL_FEED, creator)).statusCode).toBe(200);
      const retryAfter = expectRateLimited(
        await get(server, URL_FEED, creator),
        "day",
      );
      expect(retryAfter).toBeGreaterThan(60);
      expect(retryAfter).toBeLessThanOrEqual(86_400);
    });
  });
});

describe("L3D-T5 the bound of the client address, in memory, independent of the account (18 T15.4)", () => {
  it("T15.4: an account over its bucket does not hold back another account from the same address", async () => {
    const first = await fx.newMember("creator");
    const second = await fx.newMember("creator");
    await withBucket(1, 600, async () => {
      expect((await get(server, URL_FEED, first)).statusCode).toBe(200);
      expectRateLimited(await get(server, URL_FEED, first), "first account");
      const other = await get(server, URL_FEED, second);
      expect(other.statusCode, other.body).toBe(200);
    });
  });

  it("T15.4: past the bound of an address, every account is refused from it before its session, nothing journaled, while another address passes", async () => {
    // a clock of its own: the window of the address is a fixed minute, never crossed mid-case
    const fixed = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 1_000);
    const bounded = fx.server({ now: () => fixed });
    const limit = MEMBER_ROUTE_ADDRESS_RATES["GET /v1/open-campaigns"];
    const creators = [
      await fx.newMember("creator"),
      await fx.newMember("creator"),
    ];
    await withBucket(600, 20_000, async () => {
      for (let index = 0; index < limit; index += 1) {
        const member = creators[index % 2] as Member;
        const served = await get(bounded, URL_FEED, member, ADDRESS_A);
        expect(served.statusCode, `call ${index}`).toBe(200);
      }
      for (const member of creators) {
        const refused = await get(bounded, URL_FEED, member, ADDRESS_A);
        const retryAfter = expectRateLimited(refused, "address");
        expect(retryAfter).toBeGreaterThanOrEqual(1);
        expect(retryAfter).toBeLessThanOrEqual(60);
      }
      // the record has its own bound, and another address its own window
      expect(
        (
          await get(
            bounded,
            `${URL_FEED}/${campaign.id}`,
            creators[0] as Member,
            ADDRESS_A,
          )
        ).statusCode,
      ).toBe(200);
      expect(
        (await get(bounded, URL_FEED, creators[1] as Member, ADDRESS_B))
          .statusCode,
      ).toBe(200);
    });
    // the refusals of the address reached no door: only the served reads are journaled
    const lines = [
      ...(await readsOf(fx, creators[0] as Member)),
      ...(await readsOf(fx, creators[1] as Member)),
    ];
    expect(lines.filter((line) => line.outcome !== "served")).toEqual([]);
    expect(lines).toHaveLength(limit + 2);
    // D60: the line of the refusal names the route and the bound, never the address
    const text = fx.logStreams.map((stream) => stream()).join("\n");
    expect(text).toContain("member route over its address rate");
    expect(text).not.toContain(ADDRESS_A);
    expect(text).not.toContain(ADDRESS_B);
  });
});
