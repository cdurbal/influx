// L3D commit 03 — L3D-T4: T14 on the creator's read of the open campaigns (docs/mvp/18 T14.1, T14.3,
// T14.4; 11 RG24; 09 RG100; jalons/l3d/modele.md §2, §7; fiche invariant 6). A campaign that is not
// one of the feed — an identifier nobody holds, a draft, one under review, refused, paused, closed,
// one of a brand suspended — gets, on the record and on the logo, exactly the answer of an address
// that does not exist: the same status, code and body, nothing of the campaign by value. A brand and
// an agent get the same answer on the three routes, whatever the campaign, and nothing is journaled
// for them. Accounts COMMITTED through campaign-routes-kit.ts; the states by the migration role.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BACKOFFICE_SECRET } from "../tests/helpers.ts";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  brandCampaign,
  closeFeed,
  markersIn,
  publishedBrand,
  readsOf,
  URL_FEED,
  type FixtureCampaign,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";

let fx: CampaignRouteFixtures;
let server: Server;
let brand: PublishedBrand;
let open: FixtureCampaign;
/** The answer of an address that does not exist, as a creator gets it (T14.4). */
let unknownAddress: { status: number; code: string; message: string };

function get(path: string, member: Member | null) {
  return fx.call(server, "GET", path, member === null ? null : member.session);
}

/** The record and the logo of `campaign` answer `member` as an unknown address, nothing of it. */
async function expectUnknown(
  member: Member,
  campaign: FixtureCampaign | string,
  label: string,
): Promise<void> {
  const id = typeof campaign === "string" ? campaign : campaign.id;
  for (const path of [`${URL_FEED}/${id}`, `${URL_FEED}/${id}/brand-logo`]) {
    const response = await get(path, member);
    expect(fx.errorBody(response), `${label} ${path}`).toEqual(unknownAddress);
    if (typeof campaign !== "string") {
      expect(response.body, label).not.toContain(campaign.title);
      expect(markersIn(response, campaign.markers), label).toEqual([]);
    }
    expect(markersIn(response, brand.markers), label).toEqual([]);
  }
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server();
  await closeFeed(fx);
  brand = await publishedBrand(fx, server);
  open = await brandCampaign(fx, server, brand);
  const creator = await fx.newMember("creator");
  unknownAddress = fx.errorBody(await get(`${URL_FEED}-nothing`, creator));
  expect(unknownAddress).toEqual({
    status: 404,
    code: "not_found",
    message: "Not found",
  });
});

afterAll(async () => {
  await closeFeed(fx);
  await fx.close();
});

describe("L3D-T4 T14.3, T14.4 one answer for what is not in the feed (11 RG24; 09 RG100)", () => {
  it("answers an identifier nobody holds and a draft as an address that does not exist, while the open campaign is served (positive control)", async () => {
    const creator = await fx.newMember("creator");
    const served = await get(`${URL_FEED}/${open.id}`, creator);
    expect(served.statusCode, served.body).toBe(200);
    expect(served.body).toContain(open.title);
    const draft = await brandCampaign(fx, server, brand, { state: "draft" });
    await expectUnknown(creator, randomUUID(), "nobody's identifier");
    await expectUnknown(creator, draft, "draft");
  });

  it("answers a campaign under review and a refused one alike", async () => {
    const creator = await fx.newMember("creator");
    for (const state of ["pending_review", "rejected"] as const) {
      const campaign = await brandCampaign(fx, server, brand, { state });
      await expectUnknown(creator, campaign, state);
    }
  });

  it("answers a paused and a closed campaign alike, both of which carry a snapshot (RG100)", async () => {
    const creator = await fx.newMember("creator");
    for (const state of ["paused", "closed"] as const) {
      const campaign = await brandCampaign(fx, server, brand, { state });
      const [held] = await fx.migration<{ snapshot: string | null }[]>`
        select current_snapshot_id::text as snapshot from campaigns.campaigns
         where id = ${campaign.id}`;
      expect(held?.snapshot, state).not.toBeNull();
      await expectUnknown(creator, campaign, state);
    }
    // and neither is in the feed
    const page = (await get(URL_FEED, creator)).json() as {
      items: { id: string }[];
    };
    expect(page.items.map((item) => item.id)).toEqual([open.id]);
  });

  it("answers the published campaign of a brand suspended alike (RG11), the profile and the account", async () => {
    const creator = await fx.newMember("creator");
    const other = await publishedBrand(fx, server);
    const campaign = await brandCampaign(fx, server, other);
    expect((await get(`${URL_FEED}/${campaign.id}`, creator)).statusCode).toBe(
      200,
    );
    await fx.setProfileStatus(other, "suspended");
    await expectUnknown(creator, campaign, "brand profile suspended");
    await fx.setProfileStatus(other, "published");
    await fx.migration`
      update identity.accounts set status = 'suspended', suspended_at = now()
       where id = ${other.accountId}`;
    try {
      // a session of another account still reads; the brand's account suspended hides its campaign
      await expectUnknown(creator, campaign, "brand account suspended");
    } finally {
      await fx.migration`
        update identity.accounts set status = 'active', suspended_at = null
         where id = ${other.accountId}`;
    }
  });
});

describe("L3D-T4 T14.3 the routes of a creator are unknown to any other role", () => {
  it("answers a brand on the three routes as an address that does not exist, its own campaign included, and journals nothing", async () => {
    const unknownToBrand = fx.errorBody(
      await get(`${URL_FEED}-nothing`, brand),
    );
    expect(unknownToBrand).toEqual(unknownAddress);
    for (const path of [
      URL_FEED,
      `${URL_FEED}?sort=deadline&page=2`,
      `${URL_FEED}/${open.id}`,
      `${URL_FEED}/${open.id}/brand-logo`,
      `${URL_FEED}/${randomUUID()}`,
    ]) {
      const response = await get(path, brand);
      expect(fx.errorBody(response), path).toEqual(unknownAddress);
      expect(response.body, path).not.toContain(open.title);
    }
    const [lines] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from search.creator_campaign_reads
       where creator_account_id = ${brand.accountId}`;
    expect(lines?.n).toBe(0);
  });

  it("answers the backoffice surface (an agent) on the three routes as an address that does not exist (T14.1)", async () => {
    const unknownThere = await server.inject({
      method: "GET",
      url: `${URL_FEED}-nothing`,
      headers: { "x-influx-internal": BACKOFFICE_SECRET },
    });
    for (const path of [
      URL_FEED,
      `${URL_FEED}/${open.id}`,
      `${URL_FEED}/${open.id}/brand-logo`,
    ]) {
      const response = await server.inject({
        method: "GET",
        url: path,
        headers: { "x-influx-internal": BACKOFFICE_SECRET },
      });
      expect(fx.errorBody(response), path).toEqual(fx.errorBody(unknownThere));
      expect(response.statusCode, path).toBe(404);
      expect(response.body, path).not.toContain(open.title);
    }
  });

  it("answers a malformed identifier by the shape of the path (400) for every role, never by a lookup; nothing is journaled", async () => {
    const creator = await fx.newMember("creator");
    for (const member of [creator, brand]) {
      for (const path of [
        `${URL_FEED}/not-a-uuid`,
        `${URL_FEED}/not-a-uuid/brand-logo`,
      ]) {
        const response = await get(path, member);
        expect(response.statusCode, path).toBe(400);
        expect(fx.errorBody(response).code, path).toBe("validation_failed");
      }
    }
    expect(await readsOf(fx, creator)).toEqual([]);
  });
});
