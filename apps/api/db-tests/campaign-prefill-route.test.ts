// L3G commit 09 — L3G-T9: the prefill of « Compatible creators », POST /v1/bo/campaigns/:id/creator-prefill
// (docs/mvp/10 RG9, RG73, CA56; 18 T14, T15; jalons/l3g/modele.md §4, §8; l3g-fiche invariants 2, 5, 12, 14;
// D78). Through fastify.inject(), straight to apps/api, the door of 0329 behind it, as an agent and an
// administrator of a backoffice session in aal2:
//   - the answer of the API: the exact keys, the filters drawn from the brief of an admitted campaign
//     (codes of six facets), never a band of the budget, a price nor a facet the brief does not carry (D78);
//   - the proposed line journaled (CA56), a line per call, the author the caller;
//   - T14.1 to T14.4: a member gets the 404 of a route that does not exist on the web surface and a 401 on
//     the backoffice's; a draft, rejected or unknown campaign answers exactly like an address that does not
//     exist, nothing written; a malformed identifier is a 400 before the session;
//   - 60 a minute from one client address, before the session, another address passing (T15).
// Accounts COMMITTED through campaign-review-kit.ts.
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BACKOFFICE_ORIGIN, BACKOFFICE_SECRET } from "../tests/helpers.ts";
import { MEMBER_ROUTE_ADDRESS_RATES } from "../src/platform/member-rate.ts";
import {
  answer,
  openReviewKit,
  type Internal,
  type ReviewKit,
} from "./campaign-review-kit.ts";
import { keysOf, markersIn } from "./creator-search-kit.ts";
import {
  brandCampaign,
  publishedBrand,
  type FixtureCampaign,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";

let kit: ReviewKit;
let agent: Internal;
let admin: Internal;
let brand: PublishedBrand;
let campaign: FixtureCampaign;
/** The answer of an address that does not exist (T14.4). */
let unknownAddress: { status: number; error: Record<string, unknown> };

const prefillUrl = (id: string) => `/v1/bo/campaigns/${id}/creator-prefill`;
const ADDRESS_A = "203.0.113.21";
const ADDRESS_B = "203.0.113.22";

type Prefill = {
  prefillId: string;
  campaign: { id: string; title: string };
  filters: Record<string, unknown>;
};

/** The lines of search.campaign_prefills of an author, oldest first. */
async function prefillsOf(who: Internal) {
  return kit.fx.migration<
    { id: string; campaign_id: string; proposed: Record<string, unknown> }[]
  >`
    select id::text as id, campaign_id::text as campaign_id, proposed
      from search.campaign_prefills
     where account_id = ${who.accountId}
     order by created_at, id`;
}

beforeAll(async () => {
  kit = await openReviewKit();
  agent = await kit.newInternal("agent", "Alix");
  admin = await kit.newInternal("admin", "Dominique");
  brand = await publishedBrand(kit.fx, kit.server);
  campaign = await brandCampaign(kit.fx, kit.server, brand);
  unknownAddress = answer(
    await kit.bo("POST", `${prefillUrl(randomUUID())}-nothing`, agent.session),
  );
  expect(unknownAddress.status).toBe(404);
});

afterAll(async () => {
  await kit.fx.migration`
    delete from search.campaign_prefills where account_id = any(${[agent.accountId, admin.accountId]}::uuid[])`;
  await kit.close();
});

describe("L3G-T9 the filters drawn from the brief of an admitted campaign (10 RG9, RG73; D78)", () => {
  it("answers the exact keys and the codes of the brief, no-store, never a band of the budget nor a price", async () => {
    const response = await kit.bo(
      "POST",
      prefillUrl(campaign.id),
      agent.session,
    );
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const drawn = response.json() as Prefill;
    expect(Object.keys(drawn).sort()).toEqual([
      "campaign",
      "filters",
      "prefillId",
    ]);
    expect(drawn.campaign).toEqual({ id: campaign.id, title: campaign.title });
    expect(drawn.filters).toEqual({
      F1: "sport_fitness",
      F3: ["instagram"],
      F6: { country: "FR" },
      F8: ["fr"],
      F11: ["instagram_reel"],
    });
    const keys = new Set(keysOf(drawn));
    for (const forbidden of [
      "F17",
      "F12",
      "budget",
      "budgetBand",
      "price",
      "currency",
      "usageRights",
      "exclusivity",
      "shareBands",
    ]) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
    // the internal values of the campaign (D78): its reference, its budget and its bands
    expect(markersIn(response, campaign.markers)).toEqual([]);
  });

  it("CA56: journals the proposal, one line per call, its author the caller, the same codes as the answer", async () => {
    const before = (await prefillsOf(admin)).length;
    const first = (
      await kit.bo("POST", prefillUrl(campaign.id), admin.session)
    ).json() as Prefill;
    const second = (
      await kit.bo("POST", prefillUrl(campaign.id), admin.session)
    ).json() as Prefill;
    expect(second.prefillId).not.toBe(first.prefillId);
    const lines = await prefillsOf(admin);
    expect(lines).toHaveLength(before + 2);
    expect(lines.slice(-2)).toEqual([
      {
        id: first.prefillId,
        campaign_id: campaign.id,
        proposed: first.filters,
      },
      {
        id: second.prefillId,
        campaign_id: campaign.id,
        proposed: second.filters,
      },
    ]);
    // the agent's own journal is not the administrator's
    expect(
      (await prefillsOf(agent)).some((line) => line.id === first.prefillId),
    ).toBe(false);
  });

  it("a facet closed in table is omitted, never required", async () => {
    await kit.fx.migration`
      update search.facet_settings set is_open = false where facet_code = 'F8'`;
    try {
      const drawn = (
        await kit.bo("POST", prefillUrl(campaign.id), agent.session)
      ).json() as Prefill;
      expect(drawn.filters).not.toHaveProperty("F8");
      expect(drawn.filters).toHaveProperty("F1", "sport_fitness");
    } finally {
      await kit.fx.migration`
        update search.facet_settings set is_open = true where facet_code = 'F8'`;
    }
  });
});

describe("L3G-T9 T14.1 to T14.4 the agents alone draw a prefill (fiche invariants 2, 14)", () => {
  it("TM12.5: a member of any role gets the 404 of a route that does not exist on the web surface, a 401 on the backoffice's", async () => {
    const memberSession = await kit.memberSession();
    for (const session of [memberSession, brand.session]) {
      expect(
        answer(
          await kit.bo("POST", prefillUrl(campaign.id), session, undefined, {
            surface: "web",
            cookie: "__Host-influx-session",
          }),
        ),
      ).toEqual(unknownAddress);
    }
    for (const session of [null, memberSession, brand.session]) {
      const got = answer(
        await kit.bo("POST", prefillUrl(campaign.id), session),
      );
      expect(got.status).toBe(401);
      expect(got.error.code).toBe("unauthenticated");
    }
  });

  it("T14.3, T14.4: a draft, a rejected and an unknown campaign answer exactly like an address that does not exist, nothing written", async () => {
    const draft = await brandCampaign(kit.fx, kit.server, brand, {
      state: "draft",
    });
    const rejected = await brandCampaign(kit.fx, kit.server, brand, {
      state: "rejected",
    });
    const before = (await prefillsOf(agent)).length;
    for (const id of [draft.id, rejected.id, randomUUID()]) {
      const got = answer(await kit.bo("POST", prefillUrl(id), agent.session));
      expect(got.status, id).toBe(404);
      expect(got.error, id).toEqual(unknownAddress.error);
    }
    expect(await prefillsOf(agent)).toHaveLength(before);
  });

  it("a malformed identifier is a 400 before the session, nothing written", async () => {
    const before = (await prefillsOf(agent)).length;
    const response = await kit.bo(
      "POST",
      prefillUrl("not-a-uuid"),
      agent.session,
    );
    expect(response.statusCode, response.body).toBe(400);
    expect(answer(response).error.code).toBe("validation_failed");
    expect(await prefillsOf(agent)).toHaveLength(before);
  });
});

describe("L3G-T9 T15: 60 a minute from one client address, before the session (l3g/modele.md §8)", () => {
  it("refuses the call past the bound of an address with Retry-After, whoever asks, while another address passes", async () => {
    // a clock of its own: the window of the address is a fixed minute, never crossed mid-case
    const fixed = new Date(Math.floor(Date.now() / 60_000) * 60_000 + 1_000);
    const bounded = kit.fx.server({ now: () => fixed });
    const limit =
      MEMBER_ROUTE_ADDRESS_RATES["POST /v1/bo/campaigns/:id/creator-prefill"];
    expect(limit).toBe(60);
    const call = (session: string | null, address: string) =>
      bounded.inject({
        method: "POST",
        url: prefillUrl(randomUUID()),
        headers: {
          "x-influx-internal": BACKOFFICE_SECRET,
          origin: BACKOFFICE_ORIGIN,
          "x-request-id": randomUUID(),
          "x-real-ip": address,
          ...(session === null
            ? {}
            : { cookie: `__Host-influx-ops-session=${session}` }),
        },
      });
    for (let index = 0; index < limit; index += 1) {
      const served = await call(
        index % 2 === 0 ? agent.session : admin.session,
        ADDRESS_A,
      );
      expect(served.statusCode, `call ${index}`).toBe(404);
    }
    for (const session of [agent.session, admin.session, null]) {
      const refused = await call(session, ADDRESS_A);
      expect(answer(refused)).toMatchObject({
        status: 429,
        error: { code: "rate_limited" },
      });
      const retryAfter = Number(refused.headers["retry-after"]);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(60);
    }
    expect((await call(agent.session, ADDRESS_B)).statusCode).toBe(404);
  });
});
