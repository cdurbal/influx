// L3D commit 03 — L3D-T3: the creator's read of the open campaigns through apps/api (docs/mvp/11
// RG13 to RG26, RG33, RG35, RG36, CA2 to CA5, CA9, CA10, CA15 to CA17; 09 RG98 to RG101; D46, D48,
// D78; jalons/l3d/modele.md §3, §4, §7; fiche invariants 1, 2, 5, 6, 8, 9).
//   CA3   a card carries exactly the keys of RG15 at the pilot: picks of the creator view and of the
//         public brand view, the notice of D78, nothing else;
//   CA4   the record serves the snapshot whole and the brand whole, never a total budget, a note, a
//         commercial owner, a band nor a currency, not even as an empty key;
//   CA5   the ROLE of the contact person, never a coordinate of the brand nor its internal block;
//   CA2   a brand profile not published takes its campaigns out of every answer;
//   CA9   a greyed card is counted and shown, opens no record, keeps its logo;
//   RG33  two sorts, the identifier last; the rank of a page, the cap of the base (RG21, CA18);
//   RG22  every record read journaled with the account, the campaign and the outcome;
//   the logo of a visible campaign alone, relayed as JSON; `no-store` everywhere; parity with the
//   brand's own preview (the same `brand`, modele §1).
// Accounts COMMITTED through campaign-routes-kit.ts; the published states by the migration role, as a
// decision of INFLUX would; each case closes the campaigns of the cases before it (closeFeed) and reads
// with a creator of its own (the bucket of the account counts every read, modele §5).
import {
  CAMPAIGN_REMUNERATION_NOTICE,
  campaignCreatorViewSchema,
  type CampaignCreatorViewResponse,
} from "@influx/contracts/campaign-creator-view";
import type {
  OpenCampaignBrandLogoResponse,
  OpenCampaignRecordResponse,
  OpenCampaignsResponse,
} from "@influx/contracts/open-campaigns";
import { accountIdOf } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  openCampaignRouteFixtures,
  URL_CAMPAIGNS,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";
import {
  brandCampaign,
  closeFeed,
  FORBIDDEN_KEYS,
  keysOf,
  markersIn,
  memoryStore,
  publishedBrand,
  readsOf,
  URL_FEED,
} from "./open-campaigns-kit.ts";

let fx: CampaignRouteFixtures;
let server: Server;
const store = memoryStore();

/** The keys of a card (modele §3), and of its two picks, in the order of the contract. */
const CARD_KEYS = [
  "id",
  "publishedOn",
  "applicationsClosed",
  "campaign",
  "brand",
  "remunerationNotice",
];
const CARD_CAMPAIGN_KEYS = [
  "title",
  "deliverables",
  "audienceCountries",
  "audienceTopics",
  "remunerationKind",
  "applicationsCloseOn",
  "startsOn",
  "endsOn",
];
const CARD_BRAND_KEYS = [
  "companyName",
  "hasLogo",
  "primarySector",
  "companySize",
  "badge",
];

function get(path: string, member: Member | null) {
  return fx.call(server, "GET", path, member === null ? null : member.session);
}

async function feed(
  creator: Member,
  query = "",
): Promise<OpenCampaignsResponse> {
  const response = await get(`${URL_FEED}${query}`, creator);
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as OpenCampaignsResponse;
}

async function setting(key: string, value: number): Promise<number> {
  const [before] = await fx.migration<{ value: number }[]>`
    select (value)::integer as value from backoffice.operational_settings where key = ${key}`;
  await fx.migration`
    update backoffice.operational_settings set value = to_jsonb(${value}::integer) where key = ${key}`;
  if (before === undefined) throw new Error(`no setting ${key}`);
  return before.value;
}

/** A case's own scene: the feed emptied, a published brand, one open campaign, a fresh creator. */
async function scene() {
  await closeFeed(fx);
  const brand = await publishedBrand(fx, server);
  const campaign = await brandCampaign(fx, server, brand);
  const creator = await fx.newMember("creator");
  return { brand, campaign, creator };
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server({ storage: store });
});

afterAll(async () => {
  await closeFeed(fx);
  await fx.close();
});

describe("L3D-T3 the feed of the open campaigns (11 RG15, RG33, RG35, CA3, CA15 to CA17)", () => {
  it("CA3: a card carries exactly the picks of RG15 at the pilot, the snapshot's values, the public brand and the notice of D78, `no-store`", async () => {
    const { brand, campaign, creator } = await scene();
    const response = await get(URL_FEED, creator);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const page = response.json() as OpenCampaignsResponse;
    expect(page).toMatchObject({
      total: 1,
      page: 1,
      nextPage: null,
      capReached: false,
    });
    const [card] = page.items;
    expect(Object.keys(card ?? {})).toEqual(CARD_KEYS);
    expect(Object.keys(card?.campaign ?? {}).sort()).toEqual(
      [...CARD_CAMPAIGN_KEYS].sort(),
    );
    expect(Object.keys(card?.brand ?? {}).sort()).toEqual(
      [...CARD_BRAND_KEYS].sort(),
    );
    expect(card).toMatchObject({
      id: campaign.id,
      applicationsClosed: false,
      remunerationNotice: CAMPAIGN_REMUNERATION_NOTICE,
      campaign: {
        title: campaign.title,
        remunerationKind: "cash_and_gift",
        audienceCountries: ["FR"],
        audienceTopics: ["sport_fitness"],
        deliverables: [
          {
            networkCode: "instagram",
            formatCode: "instagram_reel",
            quantity: 2,
          },
        ],
      },
      brand: {
        companyName: brand.name,
        hasLogo: false,
        primarySector: "sports_leisure",
        companySize: "11_50",
        badge: null,
      },
    });
    expect(card?.publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // the card is the snapshot's: the same values as the creator view the base froze
    const [snapshot] = await fx.migration<
      { payload: Record<string, unknown> }[]
    >`
      select s.payload from campaigns.campaigns c
        join campaigns.campaign_published_snapshots s on s.id = c.current_snapshot_id
       where c.id = ${campaign.id}`;
    for (const key of CARD_CAMPAIGN_KEYS) {
      expect(
        (card?.campaign as Record<string, unknown> | undefined)?.[key],
        key,
      ).toEqual(snapshot?.payload[key]);
    }
    // never the brief nor the summary on a card: the record holds them
    expect(response.body).not.toContain(campaign.brief.slice(0, 24));
  });

  it("CA10, invariant 1: no amount, band, currency, total, reference, state nor count in the feed, not even as a key; no contact of the brand (D46, D78)", async () => {
    const { brand, campaign, creator } = await scene();
    const response = await get(URL_FEED, creator);
    expect(response.statusCode).toBe(200);
    expect(
      markersIn(response, [...campaign.markers, ...brand.markers]),
    ).toEqual([]);
    expect(response.body).not.toContain("CHF");
    expect(response.body).not.toContain("173");
    expect(
      keysOf(response.json()).filter((key) => FORBIDDEN_KEYS.includes(key)),
    ).toEqual([]);
    const { items } = response.json() as OpenCampaignsResponse;
    const { remunerationNotice, ...rest } = items[0] ?? {
      remunerationNotice: null,
    };
    expect(remunerationNotice).toBe("campaign.budget.negotiate");
    expect(JSON.stringify(rest)).not.toMatch(/budget/i);
  });

  it("RG33, CA15 to CA17: `recent` by the first publication, `deadline` open first by the nearest deadline, the identifier last; RG35 counts the greyed card", async () => {
    await closeFeed(fx);
    const brand = await publishedBrand(fx, server);
    const day = 86_400_000;
    const older = await brandCampaign(fx, server, brand, {
      closeIn: 20,
      publishedAt: new Date(Date.now() - 3 * day).toISOString(),
    });
    const sooner = await brandCampaign(fx, server, brand, {
      closeIn: 5,
      publishedAt: new Date(Date.now() - 2 * day).toISOString(),
    });
    const greyed = await brandCampaign(fx, server, brand, {
      closeIn: -2,
      publishedAt: new Date(Date.now() - day).toISOString(),
    });
    const creator = await fx.newMember("creator");
    const recent = await feed(creator);
    expect(recent.total).toBe(3);
    expect(recent.items.map((item) => item.id)).toEqual([
      greyed.id,
      sooner.id,
      older.id,
    ]);
    expect(recent.items.map((item) => item.applicationsClosed)).toEqual([
      true,
      false,
      false,
    ]);
    const deadline = await feed(creator, "?sort=deadline");
    expect(deadline.total).toBe(3);
    expect(deadline.items.map((item) => item.id)).toEqual([
      sooner.id,
      older.id,
      greyed.id,
    ]);
    // the explicit default is the default
    expect((await feed(creator, "?sort=recent&page=1")).items).toEqual(
      recent.items,
    );
  });

  it("RG21, RG36: the rank of a page, `nextPage` until the end, and the cap of the base refused as a page, journaled (CA18)", async () => {
    await closeFeed(fx);
    const brand = await publishedBrand(fx, server);
    for (let index = 0; index < 3; index += 1) {
      await brandCampaign(fx, server, brand);
    }
    const creator = await fx.newMember("creator");
    const size = await setting("campaign_feed_page_size", 2);
    const max = await setting("campaign_feed_max_pages", 1);
    try {
      const first = await feed(creator);
      expect(first).toMatchObject({
        total: 3,
        page: 1,
        nextPage: null,
        capReached: true,
      });
      expect(first.items).toHaveLength(2);
      const capped = await get(`${URL_FEED}?page=2`, creator);
      expect(fx.errorBody(capped)).toEqual({
        status: 400,
        code: "validation_failed",
        message: "Validation failed",
      });
      expect(fx.issuesOf(capped)).toEqual([
        { path: "page", issue: "page_cap" },
      ]);
      await setting("campaign_feed_max_pages", 10);
      const again = await feed(creator);
      expect(again).toMatchObject({ nextPage: 2, capReached: false });
      const second = await feed(creator, "?page=2");
      expect(second).toMatchObject({ total: 3, page: 2, nextPage: null });
      expect(second.items).toHaveLength(1);
      const seen = [...again.items, ...second.items].map((item) => item.id);
      expect(new Set(seen).size).toBe(3);
    } finally {
      await setting("campaign_feed_page_size", size);
      await setting("campaign_feed_max_pages", max);
    }
    expect(await readsOf(fx, creator)).toEqual([
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 1,
        outcome: "served",
      },
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 2,
        outcome: "page_cap",
      },
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 1,
        outcome: "served",
      },
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 2,
        outcome: "served",
      },
    ]);
  });

  it("refuses a sort or a page outside the contract by its schema (400), before any door: nothing journaled", async () => {
    const { creator } = await scene();
    for (const query of [
      "?sort=score",
      "?page=0",
      "?page=51",
      "?page=x",
      "?limit=100",
    ]) {
      const response = await get(`${URL_FEED}${query}`, creator);
      expect(response.statusCode, query).toBe(400);
      expect(fx.errorBody(response).code, query).toBe("validation_failed");
    }
    expect(await readsOf(fx, creator)).toEqual([]);
  });
});

describe("L3D-T3 the record of an open campaign (11 RG16, RG22, CA4, CA5; 09 RG98)", () => {
  it("CA4: serves the snapshot whole, the brand whole and the notice of D78, `no-store`, the parity with the brand's own preview (modele §1)", async () => {
    const { brand, campaign, creator } = await scene();
    const response = await get(`${URL_FEED}/${campaign.id}`, creator);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const record = response.json() as OpenCampaignRecordResponse;
    expect(Object.keys(record)).toEqual([
      "id",
      "publishedOn",
      "campaign",
      "brand",
      "remunerationNotice",
    ]);
    expect(record.id).toBe(campaign.id);
    expect(Object.keys(record.campaign)).toEqual(
      Object.keys(campaignCreatorViewSchema.shape),
    );
    expect(record.campaign).toMatchObject({
      title: campaign.title,
      brief: campaign.brief,
    });
    expect(record.remunerationNotice).toBe(CAMPAIGN_REMUNERATION_NOTICE);
    const [snapshot] = await fx.migration<{ payload: unknown }[]>`
      select s.payload from campaigns.campaigns c
        join campaigns.campaign_published_snapshots s on s.id = c.current_snapshot_id
       where c.id = ${campaign.id}`;
    expect(record.campaign).toEqual(snapshot?.payload);
    // the brand's preview of what a creator sees: the same campaign, the same brand
    const preview = await fx.call(
      server,
      "GET",
      `${URL_CAMPAIGNS}/${campaign.id}/creator-view`,
      brand.session,
    );
    expect(preview.statusCode, preview.body).toBe(200);
    const own = preview.json() as CampaignCreatorViewResponse;
    expect(record.brand).toEqual(own.brand);
    expect(record.campaign).toEqual(own.campaign);
  });

  it("CA4, CA10: never a total budget, a reference, a band, a currency, a note, an owner nor a state, not even an empty key", async () => {
    const { campaign, creator } = await scene();
    // the commercial owner named, as INFLUX assigns one
    const owner = accountIdOf("agent", "b");
    await fx.migration`
      update campaigns.campaigns set owner_agent_id = ${owner} where id = ${campaign.id}`;
    const response = await get(`${URL_FEED}/${campaign.id}`, creator);
    expect(response.body).not.toContain(owner);
    expect(response.statusCode).toBe(200);
    // positive control: the base holds them
    const [held] = await fx.migration<{ reference: string; total: string }[]>`
      select internal_reference as reference, total_budget_minor::text as total
        from campaigns.campaigns where id = ${campaign.id}`;
    expect(held?.reference).toMatch(/^L3D03-REF-/);
    expect(markersIn(response, campaign.markers)).toEqual([]);
    expect(response.body).not.toContain("CHF");
    expect(response.body).not.toContain("173");
    expect(response.body).not.toMatch(/sensitiv|declar|authori[sz]ation/i);
    expect(
      keysOf(response.json()).filter((key) => FORBIDDEN_KEYS.includes(key)),
    ).toEqual([]);
    const { remunerationNotice, ...rest } =
      response.json() as OpenCampaignRecordResponse;
    expect(remunerationNotice).toBe(CAMPAIGN_REMUNERATION_NOTICE);
    expect(JSON.stringify(rest)).not.toMatch(/budget/i);
  });

  it("CA5 (D46, 06 RG38): the ROLE of the contact person, never its first name, e-mail, phone or page, nor the registered name or number", async () => {
    const { brand, campaign, creator } = await scene();
    const response = await get(`${URL_FEED}/${campaign.id}`, creator);
    expect(response.statusCode).toBe(200);
    const record = response.json() as OpenCampaignRecordResponse;
    expect(record.brand.contactRole).toBe("partnerships_influence");
    expect(record.brand.companyName).toBe(brand.name);
    expect(markersIn(response, brand.markers)).toEqual([]);
    // positive control: the brand reads its own contact
    const own = await fx.call(
      server,
      "GET",
      "/v1/me/brand-profile",
      brand.session,
    );
    expect(markersIn(own, brand.markers)).toContain("contact e-mail");
  });

  it("CA2: a brand whose profile is no longer published takes its campaign out of the feed and of the record, and back once published", async () => {
    const { brand, campaign, creator } = await scene();
    await fx.setProfileStatus(brand, "suspended");
    try {
      expect((await feed(creator)).total).toBe(0);
      const record = await get(`${URL_FEED}/${campaign.id}`, creator);
      expect(fx.errorBody(record)).toEqual({
        status: 404,
        code: "not_found",
        message: "Not found",
      });
    } finally {
      await fx.setProfileStatus(brand, "published");
    }
    expect((await feed(creator)).items.map((item) => item.id)).toEqual([
      campaign.id,
    ]);
  });

  it("CA9, RG26: a greyed campaign is counted and carded, opens no record, keeps its logo", async () => {
    await closeFeed(fx);
    const brand = await publishedBrand(fx, server);
    const greyed = await brandCampaign(fx, server, brand, { closeIn: -3 });
    const creator = await fx.newMember("creator");
    const page = await feed(creator);
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: greyed.id,
      applicationsClosed: true,
    });
    const record = await get(`${URL_FEED}/${greyed.id}`, creator);
    expect(record.statusCode).toBe(404);
    const logo = await get(`${URL_FEED}/${greyed.id}/brand-logo`, creator);
    expect(logo.statusCode, logo.body).toBe(200);
    expect(logo.json()).toEqual({ logo: null });
  });

  it("RG22, RG101: every record read is journaled with the account, the campaign and the outcome, a refusal with the identifier asked", async () => {
    const { campaign, creator } = await scene();
    const nobody = randomUUID();
    expect((await get(`${URL_FEED}/${campaign.id}`, creator)).statusCode).toBe(
      200,
    );
    expect((await get(`${URL_FEED}/${nobody}`, creator)).statusCode).toBe(404);
    expect(
      (await get(`${URL_FEED}/${campaign.id}/brand-logo`, creator)).statusCode,
    ).toBe(200);
    expect(await readsOf(fx, creator)).toEqual([
      {
        kind: "record",
        campaign_id: campaign.id,
        feed_sort: null,
        feed_page: null,
        outcome: "served",
      },
      {
        kind: "record",
        campaign_id: nobody,
        feed_sort: null,
        feed_page: null,
        outcome: "refused",
      },
    ]);
  });
});

describe("L3D-T3 the logo of the brand of a visible campaign (11 RG15; modele §7)", () => {
  it("relays the active logo of the brand as JSON, its bytes in base64, no key, no URL, `no-store`", async () => {
    const { brand, campaign, creator } = await scene();
    const [row] = await fx.migration<
      { object_key: string; activated_at: string }[]
    >`
      insert into profiles.brand_logo_objects
        (account_id, state, received_bytes, byte_size, width, height, activated_at)
      values (${brand.accountId}, 'active', 64, 32, 256, 128, date_trunc('milliseconds', now()))
      returning object_key,
                to_char(activated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as activated_at`;
    if (row === undefined) throw new Error("no logo row");
    const bytes = Buffer.from(`l3d03-logo-${randomUUID()}`);
    store.objects.set(`brand-logo/${row.object_key}`, bytes);
    try {
      const response = await get(
        `${URL_FEED}/${campaign.id}/brand-logo`,
        creator,
      );
      expect(response.statusCode, response.body).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.json()).toEqual({
        logo: {
          contentType: "image/webp",
          width: 256,
          height: 128,
          byteSize: bytes.length,
          data: bytes.toString("base64"),
          updatedAt: row.activated_at,
        },
      } satisfies OpenCampaignBrandLogoResponse);
      expect(response.body).not.toContain(row.object_key);
      expect(response.body).not.toContain(brand.accountId);
      // the card says the brand has one
      const page = await feed(creator);
      expect(page.items[0]?.brand.hasLogo).toBe(true);
    } finally {
      await fx.migration`
        update profiles.brand_logo_objects set state = 'purging', purge_requested_at = now()
         where account_id = ${brand.accountId} and state = 'active'`;
    }
  });

  it("answers the logo of an invisible campaign as an address that does not exist, and a visible one without a logo `null`", async () => {
    const { brand, campaign, creator } = await scene();
    const draft = await brandCampaign(fx, server, brand, { state: "draft" });
    const unknown = fx.errorBody(await get(`${URL_FEED}-nothing`, creator));
    for (const id of [draft.id, randomUUID()]) {
      const response = await get(`${URL_FEED}/${id}/brand-logo`, creator);
      expect(fx.errorBody(response), id).toEqual(unknown);
    }
    const none = await get(`${URL_FEED}/${campaign.id}/brand-logo`, creator);
    expect(none.json()).toEqual({ logo: null });
    // the logo is outside the journal (modele §6)
    expect(await readsOf(fx, creator)).toEqual([]);
  });
});

describe("L3D-T3 who reads (11 RG13, RG23; 09 RG99)", () => {
  it("RG99: admits a creator whose storefront is a draft, under review or refused; RG23: refuses a suspended one 403 on the three routes, nothing journaled", async () => {
    const { campaign } = await scene();
    for (const state of ["draft", "pending_review", "rejected"]) {
      const creator = await fx.newMember("creator");
      await fx.migration`
        update profiles.creator_public_profiles
           set status = ${state}::profiles.creator_profile_status
         where account_id = ${creator.accountId}`;
      expect((await get(URL_FEED, creator)).statusCode, state).toBe(200);
    }
    const suspended = await fx.newMember("creator");
    await fx.migration`
      update profiles.creator_public_profiles set status = 'suspended'
       where account_id = ${suspended.accountId}`;
    for (const path of [
      URL_FEED,
      `${URL_FEED}/${campaign.id}`,
      `${URL_FEED}/${campaign.id}/brand-logo`,
    ]) {
      const response = await get(path, suspended);
      expect(fx.errorBody(response), path).toEqual({
        status: 403,
        code: "forbidden",
        message: "Forbidden",
      });
      expect(response.body, path).not.toContain(campaign.title);
    }
    expect(await readsOf(fx, suspended)).toEqual([]);
  });

  it("answers 401 without a session and 403 while the terms in force are not accepted, before any door", async () => {
    const { campaign } = await scene();
    const pending = await fx.newMember("creator", { acceptTerms: false });
    for (const path of [
      URL_FEED,
      `${URL_FEED}/${campaign.id}`,
      `${URL_FEED}/${campaign.id}/brand-logo`,
    ]) {
      expect((await get(path, null)).statusCode, path).toBe(401);
      const gated = await get(path, pending);
      expect(fx.errorBody(gated).code, path).toBe("terms_acceptance_required");
      expect(gated.body, path).not.toContain(campaign.title);
    }
    expect(await readsOf(fx, pending)).toEqual([]);
  });

  it("C-1 (D60): no title, reference, contact nor registration number of a brand in any log stream of the file", () => {
    const text = fx.logStreams.map((stream) => stream()).join("\n");
    expect(text.length).toBeGreaterThan(0);
    expect(valuesFoundIn(text, fx.watchedValues)).toEqual([]);
  });
});
