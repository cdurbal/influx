// L3B commit 08 — L3B-T9: "ce que voit un créateur", the brand's preview of its own campaign, on the
// RAW payload (docs/mvp/09 RG98, RG102, CA41, CA44, CA64, CA68, CA75; D48, D78; jalons/l3b/modele.md
// §6; fiche invariants 1, 2, 4, 8). GET /v1/me/campaigns/:id/creator-view serves the ONE constructor
// of the base (campaigns.campaign_creator_view(), 0305) through its strict contract, the published
// brand profile read live (06 RG73, RG74) and the key of « À négocier avec votre commercial ». The
// base holds DISTINCTIVE markers for every field a creator never receives (the budget band, the
// value band of the product, the currency, the total budget, the internal reference, the declaration
// of RG85, the sensitivity of the sector, the contact person of the brand), and each is searched BY
// VALUE in the body and the headers of the answer: none is there, not even as an empty key. A
// campaign of another brand, an identifier nobody holds and a creator get the answer of a route that
// does not exist (T14). Accounts COMMITTED through campaign-routes-kit.ts; the published state and
// the badge are written by the migration role, as a decision of INFLUX would.
import { createHash, randomUUID } from "node:crypto";
import type { CampaignResponse } from "@influx/contracts/campaign";
import {
  CAMPAIGN_REMUNERATION_NOTICE,
  campaignCreatorViewSchema,
  type CampaignCreatorViewResponse,
} from "@influx/contracts/campaign-creator-view";
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  openCampaignRouteFixtures,
  URL_CAMPAIGNS,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";
import { actAsMember, localSuperuser } from "./support.ts";

let fx: CampaignRouteFixtures;
let server: Server;
let owner: Member;
let stranger: Member;
let creator: Member;
/** A brand whose profile is still a draft: its preview carries no brand. */
let draftBrand: Member;
let campaign: CampaignResponse;
let badgeGrantedAt = "";
let badgeId = "";
let sensitiveSector = "";

/** The exact text of the box of RG85 in French (09 RG85), the one the hash is of. */
const DECLARATION_FR =
  "Je déclare détenir les autorisations nécessaires pour promouvoir ce produit dans les pays " +
  "visés et respecter les règles de publicité qui s'y appliquent.";

const TITLE = "L3B08 creator view of a mountain stove";
const REFERENCE = "L3B08-INTERNAL-REF-7Q";
const TOTAL_BUDGET = 3_141_592_653;
const BUDGET_BAND = "10000_25000";
const VALUE_BAND = "2500_5000";
const CURRENCY = "CHF";
const CONTACT_FIRST_NAME = "Ondine-L3B08";
const CONTACT_EMAIL = "ondine.l3b08.contact@example.test";
const CONTACT_PHONE = "+33612398745";
const CONTACT_URL = "https://www.example.test/l3b08-contact-page";
const PRESENTATION = `L3B08 presentation of the brand ${"p".repeat(120)}`;

/** The 32 keys of campaigns.campaign_creator_view(uuid) (0305), in its order (modele §6). */
const VIEW_KEYS = [
  "title",
  "campaignType",
  "publicSummary",
  "brief",
  "productDescription",
  "productSector",
  "restrictions",
  "keyMessages",
  "productIsSent",
  "creatorKeepsProduct",
  "shippingCostsBorneBy",
  "deliverables",
  "networks",
  "usageRights",
  "usageRightsDuration",
  "usageRightsTerritoryScope",
  "usageRightsTerritories",
  "exclusivity",
  "contentReviewDelay",
  "audienceCountries",
  "audienceLanguages",
  "audienceTopics",
  "audienceBands",
  "audienceAgeBands",
  "audienceGender",
  "remunerationKind",
  "creatorsWanted",
  "applicationsCloseOn",
  "contentDueOn",
  "startsOn",
  "endsOn",
  "requestedItems",
];

/** Names that no answer served toward a creator may hold, at any depth (modele §6, D78, RG98). */
const FORBIDDEN_KEYS = [
  "id",
  "status",
  "currency",
  "budgetBand",
  "productValueBand",
  "totalBudgetMinor",
  "internalReference",
  "maxApplications",
  "authorizationsDeclaredAt",
  "sectorIsSensitive",
  "isSensitive",
  "submittedAt",
  "createdAt",
  "updatedAt",
  "contact",
  "firstName",
  "email",
  "phone",
  "url",
  "legalName",
  "registrationNumber",
  "completeness",
  "missingRequired",
  "pendingChanges",
  "references",
];

function completeBody(overrides: Record<string, unknown> = {}) {
  return {
    title: TITLE,
    campaignType: "product_placement",
    publicSummary: `L3B08 summary ${"s".repeat(120)}`,
    brief: `L3B08 brief ${"b".repeat(300)}`,
    internalReference: REFERENCE,
    productDescription: "A stove that boils a litre in three minutes",
    productSector: sensitiveSector,
    restrictions: "No comparison with another stove",
    keyMessages: ["Boils a litre in three minutes", "Weighs 300 grams"],
    productIsSent: true,
    productValueBand: VALUE_BAND,
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
    contentDueOn: "2027-01-25",
    audienceCountries: ["FR"],
    audienceLanguages: ["fr"],
    audienceTopics: ["sport_fitness"],
    currency: CURRENCY,
    remunerationKind: "cash_and_gift",
    budgetBand: BUDGET_BAND,
    creatorsWanted: 3,
    totalBudgetMinor: TOTAL_BUDGET,
    applicationsCloseOn: "2027-01-10",
    startsOn: "2027-02-01",
    endsOn: "2027-03-01",
    maxApplications: 173,
    requestedItems: ["motivation_message", "availability"],
    ...overrides,
  };
}

/**
 * What a creator never receives, as the base holds it (the markers of the raw payload). The currency
 * and max_applications are too short to be searched in headers (a request id may hold them): their
 * keys and the body are checked instead.
 */
function hiddenMarkers(): { name: string; value: string }[] {
  return [
    { name: "internal reference", value: REFERENCE },
    { name: "total budget", value: String(TOTAL_BUDGET) },
    { name: "budget band", value: BUDGET_BAND },
    { name: "product value band", value: VALUE_BAND },
    { name: "declaration text", value: DECLARATION_FR },
    {
      name: "declaration hash",
      value: createHash("sha256").update(DECLARATION_FR, "utf8").digest("hex"),
    },
    { name: "contact first name", value: CONTACT_FIRST_NAME },
    { name: "contact e-mail", value: CONTACT_EMAIL },
    { name: "contact phone", value: CONTACT_PHONE },
    { name: "contact page", value: CONTACT_URL },
    { name: "brand account identifier", value: owner.accountId },
    { name: "brand sign-in e-mail", value: owner.email },
    { name: "campaign identifier", value: campaign.id },
  ];
}

function markersIn(response: LightMyRequestResponse): string[] {
  const raw = `${response.body}\n${JSON.stringify(response.headers)}`;
  return hiddenMarkers()
    .filter((marker) => valuesFoundIn(raw, [marker.value]).length > 0)
    .map((marker) => marker.name);
}

/** Every key of a JSON value, at any depth. */
function keysOf(value: unknown): string[] {
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

function preview(
  id: string,
  session: string | null,
): Promise<LightMyRequestResponse> {
  return fx.call(server, "GET", `${URL_CAMPAIGNS}/${id}/creator-view`, session);
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  server = fx.server();
  const [sector] = await fx.migration<{ code: string }[]>`
    select code from reference.sectors
     where is_sensitive and retired_at is null order by code limit 1`;
  if (sector === undefined) {
    throw new Error("the reference list holds no sensitive sector");
  }
  sensitiveSector = sector.code;
  owner = await fx.newMember("advertiser");
  stranger = await fx.newMember("advertiser");
  creator = await fx.newMember("creator");
  draftBrand = await fx.newMember("advertiser");
  // the public profile and the contact person, through the brand's own route (a draft: written at once)
  const profiled = await fx.call(
    server,
    "PATCH",
    "/v1/me/brand-profile",
    owner.session,
    {
      primarySector: "sports_leisure",
      companySize: "11_50",
      targetMarkets: ["FR", "BE"],
      workingLanguages: ["fr", "en"],
      website: "https://www.l3b08-stoves.example.test/about",
      presentation: PRESENTATION,
      topics: ["sport_fitness"],
      networks: ["instagram"],
      formats: ["instagram_reel"],
      audienceCountries: ["FR"],
      exclusivityBand: "le_1m",
      collaborationRhythm: "recurring",
      offersNonMonetary: true,
      contactRole: "partnerships_influence",
      contact: {
        firstName: CONTACT_FIRST_NAME,
        email: CONTACT_EMAIL,
        phone: CONTACT_PHONE,
        url: CONTACT_URL,
      },
    },
  );
  expect(profiled.statusCode, profiled.body).toBe(200);
  await fx.setProfileStatus(owner, "published");
  await fx.setProfileStatus(stranger, "published");
  // the badge « Marque vérifiée » as the decision of an agent writes it (0224), for its date (RG74)
  const agent = accountIdOf("agent", "a");
  await fx.migration.begin(async (tx) => {
    const [request] = await tx<{ id: string }[]>`
      insert into verification.verification_requests (account_id, level, status)
      values (${owner.accountId}, 'brand_verified', 'pending') returning id::text`;
    await tx`
      update verification.verification_requests
         set status = 'approved', decided_by_account_id = ${agent}, decided_at = now(),
             closed_at = now()
       where id = ${request?.id ?? null}`;
    const [badge] = await tx<{ id: string; granted_at: string }[]>`
      insert into verification.badges
        (account_id, request_id, level, granted_by_account_id, granted_at, evidence_source,
         registry_source_id, expires_at)
      select ${owner.accountId}, ${request?.id ?? null}, 'brand_verified', ${agent},
             date_trunc('milliseconds', now()), 'domain_and_registry', s.id,
             now() + interval '12 months'
        from verification.registry_sources s where s.is_active order by s.id limit 1
      returning id::text,
                to_char(granted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as granted_at`;
    if (badge === undefined) {
      throw new Error("no registry source to grant a brand badge from");
    }
    badgeId = badge.id;
    badgeGrantedAt = badge.granted_at;
  });
  // the campaign, complete, then submitted with the box of RG85 ticked (a sensitive sector)
  const created = await fx.call(
    server,
    "POST",
    URL_CAMPAIGNS,
    owner.session,
    completeBody(),
  );
  expect(created.statusCode, created.body).toBe(200);
  const draft = created.json() as CampaignResponse;
  const submitted = await fx.call(
    server,
    "POST",
    `${URL_CAMPAIGNS}/${draft.id}/submit`,
    owner.session,
    { declarationLocale: "fr" },
  );
  expect(submitted.statusCode, submitted.body).toBe(200);
  campaign = submitted.json() as CampaignResponse;
  fx.watch(TITLE, REFERENCE, CONTACT_EMAIL, CONTACT_PHONE, CONTACT_URL);
});

afterAll(async () => {
  if (badgeId !== "") {
    await fx.migration`
      update verification.badges set state = 'expired' where id = ${badgeId}`;
  }
  await fx.close();
});

describe("L3B-T9 the brand's preview is what a creator sees, on the raw payload (CA68, RG102)", () => {
  it("CA68: serves the base's own constructor as it is, the 32 keys of modele §6 and nothing else, with the notice of D78", async () => {
    const response = await preview(campaign.id, owner.session);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json() as CampaignCreatorViewResponse;
    expect(Object.keys(body).sort()).toEqual(
      ["brand", "campaign", "remunerationNotice"].sort(),
    );
    expect(Object.keys(body.campaign)).toEqual(VIEW_KEYS);
    expect(Object.keys(campaignCreatorViewSchema.shape)).toEqual(VIEW_KEYS);
    // exactly what the base builds for this campaign, read as the owner (the function is invoker)
    const built = await inRolledBackTransaction(localSuperuser(), (tx) =>
      actAsMember(
        tx,
        "influx_advertiser",
        { accountId: owner.accountId, role: "advertiser", aal: "aal1" },
        () => tx<{ view: unknown }[]>`
          select campaigns.campaign_creator_view(${campaign.id}::uuid) as view`,
      ),
    );
    expect(body.campaign).toEqual(built[0]?.view);
    expect(body.campaign).toMatchObject({
      title: TITLE,
      productSector: sensitiveSector,
      remunerationKind: "cash_and_gift",
      networks: ["instagram"],
      usageRightsTerritories: ["FR", "BE"],
      creatorsWanted: 3,
      applicationsCloseOn: "2027-01-10",
      contentDueOn: "2027-01-25",
      requestedItems: ["motivation_message", "availability"],
    });
    expect(body.remunerationNotice).toBe(CAMPAIGN_REMUNERATION_NOTICE);
    expect(body.remunerationNotice).toBe("campaign.budget.negotiate");
  });

  it("CA41: the total budget is in the base and nowhere in the answer, not even as an empty key", async () => {
    const [held] = await fx.migration<{ total: string }[]>`
      select total_budget_minor::text as total from campaigns.campaigns where id = ${campaign.id}`;
    expect(held?.total).toBe(String(TOTAL_BUDGET));
    const response = await preview(campaign.id, owner.session);
    expect(markersIn(response)).not.toContain("total budget");
    expect(keysOf(response.json())).not.toContain("totalBudgetMinor");
    // the only "budget" of the answer is the key of « À négocier avec votre commercial »
    const { remunerationNotice, ...rest } =
      response.json() as CampaignCreatorViewResponse;
    expect(remunerationNotice).toBe(CAMPAIGN_REMUNERATION_NOTICE);
    expect(JSON.stringify(rest)).not.toMatch(/budget/i);
  });

  it("CA75: neither the band per creator, nor the value band of the product, nor the currency reach the answer, while the base holds them (D78)", async () => {
    const [held] = await fx.migration<
      { band: string; value_band: string; currency: string }[]
    >`
      select per_creator_budget_band_code as band, product_value_band_code as value_band,
             currency::text as currency
        from campaigns.campaigns where id = ${campaign.id}`;
    expect(held).toEqual({
      band: BUDGET_BAND,
      value_band: VALUE_BAND,
      currency: CURRENCY,
    });
    const response = await preview(campaign.id, owner.session);
    const found = markersIn(response);
    for (const name of ["budget band", "product value band"]) {
      expect(found, name).not.toContain(name);
    }
    expect(response.body).not.toContain(CURRENCY);
    const keys = keysOf(response.json());
    for (const key of ["currency", "budgetBand", "productValueBand"]) {
      expect(keys, key).not.toContain(key);
    }
    // no amount at all: no number in the campaign but the count of creators and the quantities
    const { campaign: seen } = response.json() as CampaignCreatorViewResponse;
    const numbers = JSON.stringify(seen).match(/:\s*\d+/g) ?? [];
    expect(numbers.map((entry) => entry.replace(/\D/g, "")).sort()).toEqual(
      ["2", "3"].sort(),
    );
  });

  it("serves neither the internal reference, nor max_applications, nor any identifier or state of the campaign (modele §6)", async () => {
    const response = await preview(campaign.id, owner.session);
    const found = markersIn(response);
    expect(response.body).not.toContain("173");
    for (const name of [
      "internal reference",
      "campaign identifier",
      "brand account identifier",
      "brand sign-in e-mail",
    ]) {
      expect(found, name).not.toContain(name);
    }
    const keys = keysOf(response.json());
    expect(keys.filter((key) => FORBIDDEN_KEYS.includes(key))).toEqual([]);
    expect(response.body).not.toContain("pending_review");
  });

  it("serves neither the declaration of RG85 nor the sensitivity of the sector, which the owner's own read carries (09 RG98)", async () => {
    // positive control: the declaration is kept and the owner reads it on its own campaign
    expect(campaign.sectorIsSensitive).toBe(true);
    expect(campaign.authorizationsDeclaredAt).toMatch(/Z$/);
    const own = await fx.call(
      server,
      "GET",
      `${URL_CAMPAIGNS}/${campaign.id}`,
      owner.session,
    );
    expect(own.body).toContain(REFERENCE);
    expect(own.body).toContain("sectorIsSensitive");
    const response = await preview(campaign.id, owner.session);
    const found = markersIn(response);
    expect(found).not.toContain("declaration text");
    expect(found).not.toContain("declaration hash");
    expect(response.body).not.toMatch(/sensitiv|declar|authori[sz]ation/i);
    expect(response.body).not.toContain(
      campaign.authorizationsDeclaredAt ?? "-",
    );
  });

  it("CA64: carries the published brand profile with the ROLE of its contact person and its badge dated, never a first name, an e-mail, a phone nor a contact page (06 RG38, RG74)", async () => {
    const response = await preview(campaign.id, owner.session);
    const body = response.json() as CampaignCreatorViewResponse;
    expect(body.brand).toEqual({
      companyName: owner.name,
      hasLogo: false,
      primarySector: "sports_leisure",
      secondarySectors: [],
      companySize: "11_50",
      country: "FR",
      targetMarkets: ["FR", "BE"],
      workingLanguages: ["en", "fr"],
      website: "www.l3b08-stoves.example.test",
      presentation: PRESENTATION,
      topics: ["sport_fitness"],
      networks: ["instagram"],
      formats: ["instagram_reel"],
      audienceCountries: ["FR"],
      usageRights: [],
      exclusivityBand: "le_1m",
      collaborationRhythm: "recurring",
      offersNonMonetary: true,
      contactRole: "partnerships_influence",
      badge: { since: badgeGrantedAt },
    });
    const found = markersIn(response);
    for (const name of [
      "contact first name",
      "contact e-mail",
      "contact phone",
      "contact page",
    ]) {
      expect(found, name).not.toContain(name);
    }
    // the contact person is in the base, and its owner reads it on its own profile
    const own = await fx.call(
      server,
      "GET",
      "/v1/me/brand-profile",
      owner.session,
    );
    expect(own.body).toContain(CONTACT_EMAIL);
  });

  it("serves a draft with every key present, null or empty, and no brand while the profile is not published (06 RG73)", async () => {
    const created = await fx.call(
      server,
      "POST",
      URL_CAMPAIGNS,
      draftBrand.session,
      {
        internalReference: "L3B08-DRAFT-REF",
        currency: "EUR",
        totalBudgetMinor: 271_828,
      },
    );
    expect(created.statusCode, created.body).toBe(200);
    const draft = created.json() as CampaignResponse;
    const response = await preview(draft.id, draftBrand.session);
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json() as CampaignCreatorViewResponse;
    expect(body.brand).toBeNull();
    expect(Object.keys(body.campaign)).toEqual(VIEW_KEYS);
    for (const [key, value] of Object.entries(body.campaign)) {
      expect(
        value === null || (Array.isArray(value) && value.length === 0),
        key,
      ).toBe(true);
    }
    expect(body.remunerationNotice).toBe(CAMPAIGN_REMUNERATION_NOTICE);
    expect(response.body).not.toContain("L3B08-DRAFT-REF");
    expect(response.body).not.toContain("271828");
    expect(response.body).not.toContain(draftBrand.name);
  });

  it("T14: a campaign of another brand, an identifier nobody holds and a creator get one answer, that of an address that does not exist", async () => {
    const unknownAddress = fx.errorBody(
      await fx.call(server, "GET", `${URL_CAMPAIGNS}-nothing`, owner.session),
    );
    expect(unknownAddress).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    for (const [who, id, session] of [
      ["another brand", campaign.id, stranger.session],
      ["nobody's identifier", randomUUID(), owner.session],
      ["a creator", campaign.id, creator.session],
      ["a creator, nobody's identifier", randomUUID(), creator.session],
    ] as const) {
      const response = await preview(id, session);
      expect(fx.errorBody(response), who).toEqual(unknownAddress);
      expect(markersIn(response), who).toEqual([]);
      expect(response.body, who).not.toContain(TITLE);
    }
    // without a session: refused before any read, nothing of the campaign
    const anonymous = await preview(campaign.id, null);
    expect(anonymous.statusCode).toBe(401);
    expect(anonymous.body).not.toContain(TITLE);
  });

  it("C-1 (D60): no title, reference nor contact of the brand in any log stream of the file", () => {
    const text = fx.logStreams.map((stream) => stream()).join("\n");
    expect(text.length).toBeGreaterThan(0);
    expect(valuesFoundIn(text, fx.watchedValues)).toEqual([]);
  });
});
