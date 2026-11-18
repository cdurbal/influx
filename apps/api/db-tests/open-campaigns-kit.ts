// Fixtures of the tests of the creator's read of the open campaigns (L3D commit 03:
// campaign-feed-route, t14-campaign-feed-route, t15-campaign-feed-rate). Built on campaign-routes-kit
// (committed accounts, member sessions, the server over the local pools): a brand whose profile is
// PUBLISHED, its contact block and its internal block holding distinctive markers (D46: never served),
// and its campaigns written complete through its own routes, their internal reference, total budget,
// bands and currency holding markers too (D78), then put in the published state as INFLUX would
// (campaign-publication-kit). The feed reads every published campaign of the stack: `closeFeed()`
// closes those of earlier cases, so that a case sees its own campaigns alone.
import type { CampaignResponse } from "@influx/contracts/campaign";
import { closeStalePublishedCampaigns } from "@influx/test-kit/db";
import { randomBytes } from "node:crypto";
import { expect } from "vitest";
import type { ObjectStore } from "../src/platform/storage.ts";
import { publishAsInflux } from "./campaign-publication-kit.ts";
import {
  campaignCalendar,
  civilDateIn,
  URL_CAMPAIGNS,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";

export const URL_FEED = "/v1/open-campaigns";

export type Marker = { name: string; value: string };

/** A brand with a published profile; `markers` are what no creator may ever read of it. */
export type PublishedBrand = Member & { markers: Marker[] };

/** A campaign of a brand; `markers` are its internal values, never served to a creator. */
export type FixtureCampaign = {
  id: string;
  title: string;
  brief: string;
  markers: Marker[];
};

function tag(): string {
  return randomBytes(4).toString("hex");
}

/** A brand whose profile is published, its contact and internal blocks holding markers. */
export async function publishedBrand(
  fx: CampaignRouteFixtures,
  server: Server,
): Promise<PublishedBrand> {
  const member = await fx.newMember("advertiser");
  const t = tag();
  const contact = {
    firstName: `Ondine${t}`,
    email: `l3d03-contact-${t}@example.test`,
    phone: `+3361${String(Number.parseInt(t, 16) % 10_000_000).padStart(7, "0")}`,
    url: `https://www.example.test/l3d03-contact-${t}`,
  };
  const profiled = await fx.call(
    server,
    "PATCH",
    "/v1/me/brand-profile",
    member.session,
    {
      primarySector: "sports_leisure",
      companySize: "11_50",
      targetMarkets: ["FR", "BE"],
      workingLanguages: ["fr", "en"],
      website: `https://www.l3d03-${t}.example.test/about`,
      presentation: `L3D03 presentation of the brand ${"p".repeat(120)}`,
      topics: ["sport_fitness"],
      networks: ["instagram"],
      formats: ["instagram_reel"],
      audienceCountries: ["FR"],
      exclusivityBand: "le_1m",
      collaborationRhythm: "recurring",
      offersNonMonetary: true,
      contactRole: "partnerships_influence",
      contact,
    },
  );
  expect(profiled.statusCode, profiled.body).toBe(200);
  const registeredName = `L3D03 Registered Name ${t}`;
  const registrationNumber = `L3D03REG${t.toUpperCase()}`;
  await fx.migration`
    insert into profiles.advertiser_internal_details
      (account_id, legal_name, registration_country_code, registration_number)
    values (${member.accountId}, ${registeredName}, 'FR', ${registrationNumber})`;
  await fx.setProfileStatus(member, "published");
  fx.watch(contact.email, contact.phone, contact.url, registrationNumber);
  return {
    ...member,
    markers: [
      { name: "contact first name", value: contact.firstName },
      { name: "contact e-mail", value: contact.email },
      { name: "contact phone", value: contact.phone },
      { name: "contact page", value: contact.url },
      { name: "registered name", value: registeredName },
      { name: "registration number", value: registrationNumber },
      { name: "brand sign-in e-mail", value: member.email },
      { name: "brand account identifier", value: member.accountId },
    ],
  };
}

export type CampaignOptions = {
  /** Days from today to the application deadline (10 by default; negative: greyed). */
  closeIn?: number;
  /** "published" (default), "paused" or "closed": the state INFLUX or the brand gives it. */
  state?:
    "published" | "paused" | "closed" | "draft" | "pending_review" | "rejected";
  /** The first publication, when the order matters (RG103). */
  publishedAt?: string;
};

/**
 * A complete campaign of `brand`, written through its own route (its internal reference, total
 * budget, bands and currency holding markers), then put in `state` by the migration role.
 */
export async function brandCampaign(
  fx: CampaignRouteFixtures,
  server: Server,
  brand: Member,
  options: CampaignOptions = {},
): Promise<FixtureCampaign> {
  const t = tag();
  const calendar = campaignCalendar();
  const title = `L3D03 campaign ${t}`;
  const brief = `L3D03 brief ${t} ${"b".repeat(300)}`;
  const reference = `L3D03-REF-${t}`;
  const totalBudget = 900_000_000 + (Number.parseInt(t, 16) % 99_999_999);
  const created = await fx.call(server, "POST", URL_CAMPAIGNS, brand.session, {
    title,
    campaignType: "product_placement",
    publicSummary: `L3D03 summary ${"s".repeat(120)}`,
    brief,
    internalReference: reference,
    productDescription: "A stove that boils a litre in three minutes",
    productSector: "sports_leisure",
    restrictions: "No comparison with another stove",
    keyMessages: ["Boils a litre in three minutes"],
    productIsSent: true,
    productValueBand: "2500_5000",
    creatorKeepsProduct: true,
    shippingCostsBorneBy: "brand",
    deliverables: [
      { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
    ],
    usageRights: "organic_repost",
    usageRightsDuration: "3m",
    usageRightsTerritoryScope: "selected_countries",
    usageRightsTerritories: ["FR", "BE"],
    exclusivity: "none",
    contentReviewDelay: "5bd",
    contentDueOn: calendar.contentDueOn,
    audienceCountries: ["FR"],
    audienceLanguages: ["fr"],
    audienceTopics: ["sport_fitness"],
    currency: "CHF",
    remunerationKind: "cash_and_gift",
    budgetBand: "10000_25000",
    creatorsWanted: 3,
    totalBudgetMinor: totalBudget,
    applicationsCloseOn: calendar.applicationsCloseOn,
    startsOn: calendar.startsOn,
    endsOn: calendar.endsOn,
    maxApplications: 173,
    requestedItems: ["motivation_message", "availability"],
  });
  expect(created.statusCode, created.body).toBe(200);
  const campaign = created.json() as CampaignResponse;
  const state = options.state ?? "published";
  if (state === "published" || state === "paused" || state === "closed") {
    await publishAsInflux(
      fx.migration,
      campaign.id,
      state === "paused" ? "paused" : "published",
    );
    if (state === "closed") {
      await fx.migration`
        update campaigns.campaigns set status = 'closed' where id = ${campaign.id}`;
    }
  } else if (state !== "draft") {
    await fx.migration`
      update campaigns.campaigns
         set status = ${state}::campaigns.campaign_status, submitted_at = now()
       where id = ${campaign.id}`;
  }
  if (options.closeIn !== undefined) {
    // live columns: the deadline moved, the snapshot untouched (modele §2)
    await fx.migration`
      update campaigns.campaigns
         set applications_close_on = ${civilDateIn(options.closeIn)}::date
       where id = ${campaign.id}`;
  }
  if (options.publishedAt !== undefined) {
    await fx.migration`
      update campaigns.campaigns set first_published_at = ${options.publishedAt}::timestamptz
       where id = ${campaign.id}`;
  }
  fx.watch(title, reference);
  return {
    id: campaign.id,
    title,
    brief,
    markers: [
      { name: "internal reference", value: reference },
      { name: "total budget", value: String(totalBudget) },
      { name: "budget band", value: "10000_25000" },
      { name: "product value band", value: "2500_5000" },
    ],
  };
}

/** Closes every campaign still published or paused: a case then sees its own alone. */
export async function closeFeed(fx: CampaignRouteFixtures): Promise<void> {
  await closeStalePublishedCampaigns(fx.migration);
}

/** The markers of `markers` found by value in the body or the headers of an answer. */
export function markersIn(
  raw: { body: string; headers: unknown },
  markers: readonly Marker[],
): string[] {
  const text = `${raw.body}\n${JSON.stringify(raw.headers)}`;
  return markers
    .filter((marker) => text.includes(marker.value))
    .map((marker) => marker.name);
}

/** Every key of a JSON value, at any depth. */
export function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keysOf);
  }
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([key, child]) => [
      key,
      ...keysOf(child),
    ]);
  }
  return [];
}

/** Keys no answer served to a creator holds, at any depth (fiche invariant 1, D46, D78). */
export const FORBIDDEN_KEYS = [
  "status",
  "currency",
  "budgetBand",
  "productValueBand",
  "totalBudgetMinor",
  "internalReference",
  "internalNote",
  "maxApplications",
  "authorizationsDeclaredAt",
  "sectorIsSensitive",
  "isSensitive",
  "ownerAgentId",
  "owner",
  "agent",
  "contact",
  "firstName",
  "email",
  "phone",
  "url",
  "legalName",
  "registrationNumber",
  "applicationsCount",
  "viewsCount",
  "submittedAt",
];

/** A Storage double that keeps the objects written, read back as written. */
export function memoryStore(): ObjectStore & { objects: Map<string, Buffer> } {
  const objects = new Map<string, Buffer>();
  return {
    objects,
    write: async (bucket, key, bytes) => {
      objects.set(`${bucket}/${key}`, Buffer.from(bytes));
      return { ok: true, value: null };
    },
    read: async (bucket, key) => ({
      ok: true,
      value: objects.get(`${bucket}/${key}`) ?? null,
    }),
    remove: async (bucket, key) => {
      objects.delete(`${bucket}/${key}`);
      return { ok: true, value: null };
    },
  };
}

/** The read lines of a creator in the journal of 0314, oldest first. */
export async function readsOf(
  fx: CampaignRouteFixtures,
  creator: Member,
): Promise<
  {
    kind: string;
    campaign_id: string | null;
    feed_sort: string | null;
    feed_page: number | null;
    outcome: string;
  }[]
> {
  return fx.migration`
    select kind, campaign_id::text, feed_sort, feed_page, outcome
      from search.creator_campaign_reads
     where creator_account_id = ${creator.accountId}
     order by id`;
}
