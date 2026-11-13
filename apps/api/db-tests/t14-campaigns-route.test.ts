// 18 T14.1 to T14.4 on the campaign routes of a brand (jalons/l3b, commit 07; fiche invariants 1 and
// 4): for the five routes of /v1/me/campaigns, a brand never reads nor changes the campaign of
// another by changing the identifier (T14.1, T14.2), and the answer to a campaign of another brand,
// to an identifier nobody holds and to a role that is not a brand is ONE answer: the same code, the
// same message, the same body (T14.3, T14.4). The campaigns are the committed rows of
// campaign-routes-kit.ts; the existence of a campaign is guessed from nothing: no field, no state, no
// time of answer of the route says more than "not found".
import type { CampaignResponse } from "@influx/contracts/campaign";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  openCampaignRouteFixtures,
  URL_CAMPAIGNS,
  type CampaignRouteFixtures,
  type Member,
  type Method,
  type Server,
} from "./campaign-routes-kit.ts";

let fx: CampaignRouteFixtures;
let server: Server;
let owner: Member;
let stranger: Member;
let creator: Member;
let campaign: CampaignResponse;

/** What only the owner may know: it must reach nobody else, by value (T1). */
const MARKER_TITLE = "T14-CAMPAIGN-TITLE-OF-THE-OWNER";
const MARKER_REFERENCE = "T14-OWNER-REF";
const MARKER_BRIEF = `T14-BRIEF-OF-THE-OWNER ${"b".repeat(300)}`;

const COMPLETE = {
  title: MARKER_TITLE,
  campaignType: "product_placement",
  publicSummary: `T14 summary ${"s".repeat(120)}`,
  brief: MARKER_BRIEF,
  internalReference: MARKER_REFERENCE,
  productDescription: "A light tent for two people",
  productSector: "sports_leisure",
  productIsSent: false,
  deliverables: [
    { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
  ],
  usageRights: "none",
  exclusivity: "none",
  contentReviewDelay: "5bd",
  audienceCountries: ["FR"],
  audienceLanguages: ["fr"],
  audienceTopics: ["sport_fitness"],
  currency: "EUR",
  remunerationKind: "cash",
  budgetBand: "500_1000",
  creatorsWanted: 3,
  totalBudgetMinor: 3_000_000,
  applicationsCloseOn: "2027-01-10",
  startsOn: "2027-02-01",
  endsOn: "2027-03-01",
};

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server();
  owner = await fx.newMember("advertiser");
  stranger = await fx.newMember("advertiser");
  creator = await fx.newMember("creator");
  await fx.setProfileStatus(owner, "published");
  await fx.setProfileStatus(stranger, "published");
  const created = await fx.call(
    server,
    "POST",
    URL_CAMPAIGNS,
    owner.session,
    COMPLETE,
  );
  expect(created.statusCode, created.body).toBe(200);
  campaign = created.json() as CampaignResponse;
  fx.watch(MARKER_TITLE, MARKER_REFERENCE, MARKER_BRIEF);
});

afterAll(async () => {
  await fx.close();
});

/** The five routes, each aimed at ONE campaign (the list and the creation aim at none). */
function routesAimedAt(id: string): [Method, string, unknown][] {
  return [
    ["GET", URL_CAMPAIGNS, undefined],
    ["POST", URL_CAMPAIGNS, {}],
    ["GET", `${URL_CAMPAIGNS}/${id}`, undefined],
    ["PATCH", `${URL_CAMPAIGNS}/${id}`, { creatorsWanted: 9 }],
    ["POST", `${URL_CAMPAIGNS}/${id}/submit`, {}],
  ];
}

const UNKNOWN_ADDRESS = `${URL_CAMPAIGNS}-nothing`;

async function stateOfOwners() {
  const [row] = await fx.migration<
    {
      status: string;
      title: string | null;
      creators_wanted: number | null;
      updated_at: Date;
    }[]
  >`
    select status::text as status, title, creators_wanted, updated_at
      from campaigns.campaigns where id = ${campaign.id}`;
  return row;
}

describe("T14.1 and T14.2 a brand reaches the campaigns of its own account only", () => {
  it("T14.1 reads nothing of another brand's campaign by changing the identifier, and the owner still reads it", async () => {
    const other = await fx.call(
      server,
      "GET",
      `${URL_CAMPAIGNS}/${campaign.id}`,
      stranger.session,
    );
    expect(fx.errorBody(other)).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    for (const value of [
      MARKER_TITLE,
      MARKER_REFERENCE,
      MARKER_BRIEF,
      owner.accountId,
      owner.email,
    ]) {
      expect(other.body).not.toContain(value);
    }
    const mine = await fx.call(
      server,
      "GET",
      `${URL_CAMPAIGNS}/${campaign.id}`,
      owner.session,
    );
    expect(mine.statusCode).toBe(200);
    expect(mine.json()).toMatchObject({ id: campaign.id, title: MARKER_TITLE });
  });

  it("T14.1 lists the campaigns of the session's account alone, and a stranger's list holds nothing of another's", async () => {
    const strangers = await fx.call(
      server,
      "GET",
      URL_CAMPAIGNS,
      stranger.session,
    );
    expect(strangers.statusCode).toBe(200);
    expect(strangers.json()).toEqual({ campaigns: [] });
    for (const value of [MARKER_TITLE, campaign.id, MARKER_REFERENCE]) {
      expect(strangers.body).not.toContain(value);
    }
    const owners = (
      (await fx.call(server, "GET", URL_CAMPAIGNS, owner.session)).json() as {
        campaigns: { id: string }[];
      }
    ).campaigns;
    expect(owners.map((entry) => entry.id)).toContain(campaign.id);
  });

  it("T14.2 changes nothing of another brand's campaign by an autosave, with the same answer as to an unknown one", async () => {
    const before = await stateOfOwners();
    const unknown = await fx.call(
      server,
      "PATCH",
      `${URL_CAMPAIGNS}/${randomUUID()}`,
      stranger.session,
      { creatorsWanted: 9, title: "Taken over by another brand" },
    );
    const foreign = await fx.call(
      server,
      "PATCH",
      `${URL_CAMPAIGNS}/${campaign.id}`,
      stranger.session,
      { creatorsWanted: 9, title: "Taken over by another brand" },
    );
    expect(fx.errorBody(foreign)).toEqual(fx.errorBody(unknown));
    expect(fx.errorBody(foreign)).toMatchObject({
      status: 404,
      code: "not_found",
    });
    expect(await stateOfOwners()).toEqual(before);
  });

  it("T14.2 submits nothing of another brand's campaign, with the same answer as to an unknown one, and the draft stays a draft", async () => {
    const unknown = await fx.call(
      server,
      "POST",
      `${URL_CAMPAIGNS}/${randomUUID()}/submit`,
      stranger.session,
      {},
    );
    const foreign = await fx.call(
      server,
      "POST",
      `${URL_CAMPAIGNS}/${campaign.id}/submit`,
      stranger.session,
      {},
    );
    expect(fx.errorBody(foreign)).toEqual(fx.errorBody(unknown));
    expect(fx.errorBody(foreign)).toMatchObject({
      status: 404,
      code: "not_found",
    });
    expect(await stateOfOwners()).toMatchObject({ status: "draft" });
    const lines = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from audit.audit_events
       where event_type = 'campaign.submitted' and subject_id = ${campaign.id}`;
    expect(lines[0]?.n).toBe(0);
  });

  it("T14.2 accepts no account in a body: a draft is always the session's own, a campaign never moves to another brand", async () => {
    const withOwner = await fx.call(
      server,
      "POST",
      URL_CAMPAIGNS,
      stranger.session,
      { advertiserAccountId: owner.accountId },
    );
    expect(withOwner.statusCode).toBe(400);
    const patched = await fx.call(
      server,
      "PATCH",
      `${URL_CAMPAIGNS}/${campaign.id}`,
      owner.session,
      { advertiserAccountId: stranger.accountId },
    );
    expect(patched.statusCode).toBe(400);
    const [row] = await fx.migration<{ advertiser_account_id: string }[]>`
      select advertiser_account_id::text from campaigns.campaigns where id = ${campaign.id}`;
    expect(row?.advertiser_account_id).toBe(owner.accountId);
  });
});

describe("T14.3 and T14.4 one answer for what does not exist and what is not for the caller", () => {
  it("answers an identifier nobody holds, to the brand, as it answers an address that does not exist for it (404, not_found, the same body)", async () => {
    const unknownAddress = fx.errorBody(
      await fx.call(server, "GET", UNKNOWN_ADDRESS, owner.session),
    );
    expect(unknownAddress).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    const id = randomUUID();
    for (const [method, url, body] of [
      ["GET", `${URL_CAMPAIGNS}/${id}`, undefined],
      ["PATCH", `${URL_CAMPAIGNS}/${id}`, { creatorsWanted: 2 }],
      ["POST", `${URL_CAMPAIGNS}/${id}/submit`, {}],
    ] as const) {
      const response = await fx.call(server, method, url, owner.session, body);
      expect(fx.errorBody(response), `${method} ${url}`).toEqual(
        unknownAddress,
      );
    }
  });

  it("T14.3 T14.4 answers a creator, on all five routes, exactly as an address that does not exist, whether the campaign is another's or nobody's", async () => {
    const expected = fx.errorBody(
      await fx.call(server, "GET", UNKNOWN_ADDRESS, creator.session),
    );
    expect(expected).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    for (const id of [campaign.id, randomUUID()]) {
      for (const [method, url, body] of routesAimedAt(id)) {
        const response = await fx.call(
          server,
          method,
          url,
          creator.session,
          body,
        );
        expect(fx.errorBody(response), `${method} ${url}`).toEqual(expected);
        expect(response.body).not.toContain(MARKER_TITLE);
      }
    }
  });

  it("T14.3 answers a creator nothing of the owner's campaign by value, and writes nothing", async () => {
    const before = await stateOfOwners();
    for (const [method, url, body] of routesAimedAt(campaign.id)) {
      const response = await fx.call(
        server,
        method,
        url,
        creator.session,
        body,
      );
      for (const value of [MARKER_TITLE, MARKER_REFERENCE, "500_1000"]) {
        expect(response.body, `${method} ${url}`).not.toContain(value);
      }
    }
    expect(await stateOfOwners()).toEqual(before);
    const [created] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from campaigns.campaigns
       where advertiser_account_id = ${creator.accountId}`;
    expect(created?.n).toBe(0);
  });

  it("answers 401 without a session and 403 while the terms in force are not accepted, on all five routes, before any campaign is looked at", async () => {
    for (const [method, url, body] of routesAimedAt(campaign.id)) {
      const response = await fx.call(server, method, url, null, body);
      expect(fx.errorBody(response), `${method} ${url}`).toMatchObject({
        status: 401,
        code: "unauthenticated",
      });
    }
    const unaccepted = await fx.newMember("advertiser", { acceptTerms: false });
    for (const id of [campaign.id, randomUUID()]) {
      for (const [method, url, body] of routesAimedAt(id)) {
        const response = await fx.call(
          server,
          method,
          url,
          unaccepted.session,
          body,
        );
        expect(fx.errorBody(response), `${method} ${url}`).toMatchObject({
          status: 403,
          code: "terms_acceptance_required",
        });
      }
    }
  });

  it("answers a malformed identifier by the shape of the path (400), the same for every role, never by a lookup", async () => {
    for (const session of [owner.session, stranger.session, creator.session]) {
      const response = await fx.call(
        server,
        "GET",
        `${URL_CAMPAIGNS}/not-an-identifier`,
        session,
      );
      expect(fx.errorBody(response)).toMatchObject({
        status: 400,
        code: "validation_failed",
      });
    }
  });
});
