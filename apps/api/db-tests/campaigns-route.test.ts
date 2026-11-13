// L3B commit 07 — the campaign routes of a brand on the local stack (docs/mvp/09 RG4, RG5, RG14, RG21
// to RG23, RG70, RG74, RG84, RG85, CA2, CA3, CA72, CA76; 18 T14; jalons/l3b/modele.md §2 to §5):
//   L3B-T8  list, create, read, autosave and submit /v1/me/campaigns, through the pools of apps/api
//           (member under influx_app, migrations 0303 to 0306): the draft never refused for what it
//           lacks, texts trimmed, lists replaced whole, the rules of packages/domain named by field
//           before the base, the freeze after the submission, the refusals of the door translated
//           into codes of field (CA3), the declaration of RG85 kept with the hash of its text.
// Who may reach a campaign (T14) is t14-campaigns-route.test.ts. The accounts are COMMITTED by the
// migration role (campaign-routes-kit.ts); the states INFLUX alone gives (rejected, published) are
// written here by the migration role, as a decision would. Every log stream is searched BY VALUE
// (C-1, D60): no title, brief nor reference of a campaign.
import { createHash } from "node:crypto";
import type { CampaignResponse } from "@influx/contracts/campaign";
import {
  CAMPAIGN_REQUIRED_FIELDS,
  missingCampaignFields,
} from "@influx/domain/campaign";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  openCampaignRouteFixtures,
  URL_CAMPAIGNS,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";

let fx: CampaignRouteFixtures;
let sensitiveSector = "";

/** The exact text of the box of RG85 in French (09 RG85), the one the hash is of. */
const DECLARATION_FR =
  "Je déclare détenir les autorisations nécessaires pour promouvoir ce produit dans les pays " +
  "visés et respecter les règles de publicité qui s'y appliquent.";
const DECLARATION_EN =
  "I declare that I hold the authorisations required to promote this product in the countries " +
  "targeted and that I comply with the advertising rules that apply there.";

const TITLE = "L3B07 summer outdoor kit";
const BRIEF = `L3B07 brief ${"b".repeat(300)}`;
const REFERENCE = "L3B07-REF-2027";

/** Everything a complete campaign holds, as the form would send it (EUR, a band of 0304). */
function completeBody(overrides: Record<string, unknown> = {}) {
  return {
    title: TITLE,
    campaignType: "product_placement",
    publicSummary: `L3B07 summary ${"s".repeat(120)}`,
    brief: BRIEF,
    internalReference: REFERENCE,
    productDescription: "A light tent for two people",
    productSector: "sports_leisure",
    keyMessages: ["Packs into a bottle", "Pitched in three minutes"],
    productIsSent: true,
    productValueBand: "100_250",
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
    currency: "EUR",
    remunerationKind: "cash_and_gift",
    budgetBand: "500_1000",
    creatorsWanted: 3,
    totalBudgetMinor: 3_000_000,
    applicationsCloseOn: "2027-01-10",
    startsOn: "2027-02-01",
    endsOn: "2027-03-01",
    maxApplications: 50,
    requestedItems: ["motivation_message", "availability"],
    ...overrides,
  };
}

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  const [sector] = await fx.migration<{ code: string }[]>`
    select code from reference.sectors
     where is_sensitive and retired_at is null order by code limit 1`;
  if (sector === undefined) {
    throw new Error("the reference list holds no sensitive sector");
  }
  sensitiveSector = sector.code;
  fx.watch(TITLE, BRIEF, REFERENCE);
});

afterAll(async () => {
  await fx.close();
});

async function brand(): Promise<{ server: Server; member: Member }> {
  return { server: fx.server(), member: await fx.newMember("advertiser") };
}

async function create(
  server: Server,
  member: Member,
  body: Record<string, unknown> = {},
): Promise<CampaignResponse> {
  const response = await fx.call(
    server,
    "POST",
    URL_CAMPAIGNS,
    member.session,
    body,
  );
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as CampaignResponse;
}

async function read(
  server: Server,
  member: Member,
  id: string,
): Promise<CampaignResponse> {
  const response = await fx.call(
    server,
    "GET",
    `${URL_CAMPAIGNS}/${id}`,
    member.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return response.json() as CampaignResponse;
}

function patch(server: Server, member: Member, id: string, body: unknown) {
  return fx.call(
    server,
    "PATCH",
    `${URL_CAMPAIGNS}/${id}`,
    member.session,
    body,
  );
}

function submit(server: Server, member: Member, id: string, body?: unknown) {
  return fx.call(
    server,
    "POST",
    `${URL_CAMPAIGNS}/${id}/submit`,
    member.session,
    body ?? {},
  );
}

async function stateOf(id: string): Promise<string> {
  const [row] = await fx.migration<{ status: string }[]>`
    select status::text as status from campaigns.campaigns where id = ${id}`;
  return row?.status ?? "";
}

/** A brand whose profile is published and whose complete campaign is a draft, ready to submit. */
async function readyBrand(
  overrides: Record<string, unknown> = {},
): Promise<{ server: Server; member: Member; campaign: CampaignResponse }> {
  const { server, member } = await brand();
  await fx.setProfileStatus(member, "published");
  const campaign = await create(server, member, completeBody(overrides));
  return { server, member, campaign };
}

describe("L3B-T8 the list and the creation (09 RG108, CA2, CA72)", () => {
  it("creates an empty draft the brand is never refused for what it lacks, naming what is missing in the order of the form (RG108, CA3)", async () => {
    const { server, member } = await brand();
    const response = await fx.call(
      server,
      "POST",
      URL_CAMPAIGNS,
      member.session,
      {},
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const campaign = response.json() as CampaignResponse;
    expect(campaign).toMatchObject({
      status: "draft",
      submittedAt: null,
      title: null,
      currency: null,
      budgetBand: null,
      totalBudgetMinor: null,
      keyMessages: [],
      deliverables: [],
      audienceTopics: [],
      requestedItems: [],
      authorizationsDeclaredAt: null,
      sectorIsSensitive: false,
    });
    expect(campaign.id).toMatch(/^[0-9a-f-]{36}$/);
    // the required fields still missing are those of packages/domain, in its order (key messages
    // being optional and the conditionals asked only when their condition is answered)
    expect(campaign.missingRequired).toEqual(missingCampaignFields({}));
    expect(campaign.missingRequired[0]).toBe("title");
    expect(campaign.missingRequired).not.toContain("keyMessages");
    expect(campaign.missingRequired).not.toContain("productValueBand");
  });

  it("creates a draft that already holds the first fields, trimmed, and lists them with their dates (CA72)", async () => {
    const { server, member } = await brand();
    const first = await create(server, member, {
      title: `  ${TITLE}  `,
      campaignType: "ugc_delivered",
      usageRights: "organic_repost",
    });
    expect(first).toMatchObject({
      title: TITLE,
      campaignType: "ugc_delivered",
      usageRights: "organic_repost",
    });
    // no body at all is a draft too, the form's first save being empty
    const second = await create(server, member);
    await patch(server, member, first.id, {
      applicationsCloseOn: "2027-05-01",
    });
    const response = await fx.call(
      server,
      "GET",
      URL_CAMPAIGNS,
      member.session,
    );
    expect(response.statusCode).toBe(200);
    const { campaigns } = response.json() as {
      campaigns: { id: string; title: string | null; status: string }[];
    };
    // the most recently changed first
    expect(campaigns.map((entry) => entry.id)).toEqual([first.id, second.id]);
    expect(Object.keys(campaigns[0] ?? {}).sort()).toEqual(
      [
        "applicationsCloseOn",
        "createdAt",
        "endsOn",
        "id",
        "startsOn",
        "status",
        "submittedAt",
        "title",
        "updatedAt",
      ].sort(),
    );
    expect(campaigns[0]).toMatchObject({
      title: TITLE,
      status: "draft",
      applicationsCloseOn: "2027-05-01",
    });
  });

  it("serves the codes the form draws from: bands per currency, the sensitive sectors, the texts of RG85, the active items only (D78)", async () => {
    const { server, member } = await brand();
    const { references } = await create(server, member);
    const euro = references.currencies.find((entry) => entry.code === "EUR");
    expect(euro?.bands).toHaveLength(10);
    expect(euro?.bands[0]).toBe("under_100");
    expect(euro?.bands.at(-1)).toBe("50000_plus");
    expect(references.currencies.map((entry) => entry.code)).toEqual([
      "CAD",
      "CHF",
      "EUR",
      "GBP",
      "USD",
    ]);
    expect(references.sensitiveSectors).toContain(sensitiveSector);
    expect(references.usageRights).toContain("none");
    expect(references.campaignTypes).toContain("ugc_delivered");
    // no rate is ever asked of an applicant (D78): the inactive item is not offered
    expect(references.requestedItems).not.toContain("proposed_rate");
    expect(references.requestedItems).toEqual(
      expect.arrayContaining(["motivation_message", "availability"]),
    );
    expect(references.authorizationDeclarations).toEqual([
      { locale: "en", body: DECLARATION_EN },
      { locale: "fr", body: DECLARATION_FR },
    ]);
    // a format of a network names it, a UGC format goes with any (RG36)
    expect(references.formats).toContainEqual({
      code: "instagram_reel",
      networkCode: "instagram",
    });
    expect(
      references.formats.some((format) => format.networkCode === null),
    ).toBe(true);
  });
});

describe("L3B-T8 the autosave (09 RG14, RG16, RG24, RG36; modele §2)", () => {
  it("saves the fields that changed alone and replaces a list as a whole, in the order given", async () => {
    const { server, member } = await brand();
    const draft = await create(server, member, {
      title: TITLE,
      keyMessages: ["First message here", "Second message here"],
      audienceCountries: ["FR", "BE"],
      deliverables: [
        { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
      ],
    });
    const response = await patch(server, member, draft.id, {
      keyMessages: ["Second message here", "Third message here"],
      audienceTopics: ["sport_fitness"],
      creatorsWanted: 4,
    });
    expect(response.statusCode).toBe(200);
    const saved = response.json() as CampaignResponse;
    expect(saved).toMatchObject({
      title: TITLE,
      // replaced as a whole, in the order given
      keyMessages: ["Second message here", "Third message here"],
      audienceTopics: ["sport_fitness"],
      creatorsWanted: 4,
      // untouched
      audienceCountries: ["FR", "BE"],
      deliverables: [
        { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
      ],
    });
    // an empty list empties it, null empties a single value
    const emptied = (
      await patch(server, member, draft.id, {
        audienceCountries: [],
        creatorsWanted: null,
      })
    ).json() as CampaignResponse;
    expect(emptied.audienceCountries).toEqual([]);
    expect(emptied.creatorsWanted).toBeNull();
    expect(emptied.keyMessages).toEqual([
      "Second message here",
      "Third message here",
    ]);
    // read again, as the brand resumes it (CA72)
    expect(await read(server, member, draft.id)).toEqual(emptied);
  });

  it("trims the texts, empties a blank one and drops a blank key message (EC-L2B-06-4)", async () => {
    const { server, member } = await brand();
    const draft = await create(server, member);
    const saved = (
      await patch(server, member, draft.id, {
        title: `\t ${TITLE} \n`,
        brief: "   ",
        restrictions: " ",
        keyMessages: ["  A key message  ", "   ", "Another key message"],
      })
    ).json() as CampaignResponse;
    expect(saved.title).toBe(TITLE);
    expect(saved.brief).toBeNull();
    expect(saved.restrictions).toBeNull();
    expect(saved.keyMessages).toEqual(["A key message", "Another key message"]);
  });

  it("refuses an empty body, a field the brand holds no right on and an exact amount per creator (400, nothing written; D78)", async () => {
    const { server, member } = await brand();
    const draft = await create(server, member, { title: TITLE });
    for (const body of [
      {},
      { status: "published" },
      { submittedAt: "2027-01-01T00:00:00.000Z" },
      { advertiserAccountId: member.accountId },
      { perCreatorAmountMinMinor: 1000, perCreatorAmountMaxMinor: 2000 },
      { authorizationsDeclaredAt: "2027-01-01T00:00:00.000Z" },
      { verifiedOnly: true },
      { creatorsWanted: 0 },
      { creatorsWanted: 51 },
      { totalBudgetMinor: 0 },
    ]) {
      const response = await patch(server, member, draft.id, body);
      expect(fx.errorBody(response), JSON.stringify(body)).toMatchObject({
        status: 400,
        code: "validation_failed",
      });
    }
    expect(await read(server, member, draft.id)).toMatchObject({
      status: "draft",
      title: TITLE,
      creatorsWanted: null,
    });
  });

  it("names the field and the rule of what the form got wrong, writes nothing, and holds a draft never to a minimum (RG14, RG16, RG70, RG74)", async () => {
    const { server, member } = await brand();
    const draft = await create(server, member, { title: TITLE });
    const cases: [string, Record<string, unknown>, string, string][] = [
      ["a title above 140", { title: "t".repeat(141) }, "title", "too_long"],
      ["a brief above 4000", { brief: "b".repeat(4001) }, "brief", "too_long"],
      [
        "a bullet above 200",
        { keyMessages: ["k".repeat(201)] },
        "keyMessages",
        "too_long",
      ],
      [
        "an unknown type",
        { campaignType: "nothing_of_the_kind" },
        "campaignType",
        "unknown",
      ],
      [
        "an unknown language",
        { audienceLanguages: ["zz"] },
        "audienceLanguages",
        "unknown",
      ],
      [
        "a date that does not exist",
        { startsOn: "2027-02-30" },
        "startsOn",
        "invalid_date",
      ],
      [
        "an application deadline after the end",
        { applicationsCloseOn: "2027-06-01", endsOn: "2027-03-01" },
        "endsOn",
        "date_order",
      ],
      [
        "a period above 12 months",
        { startsOn: "2027-02-01", endsOn: "2028-02-02" },
        "endsOn",
        "window_too_long",
      ],
      [
        "a format of another network",
        {
          deliverables: [
            {
              networkCode: "tiktok",
              formatCode: "instagram_reel",
              quantity: 1,
            },
          ],
        },
        "deliverables",
        "format_network_mismatch",
      ],
      [
        "a line twice",
        {
          deliverables: [
            {
              networkCode: "instagram",
              formatCode: "instagram_reel",
              quantity: 1,
            },
            {
              networkCode: "instagram",
              formatCode: "instagram_reel",
              quantity: 2,
            },
          ],
        },
        "deliverables",
        "duplicate",
      ],
      [
        "an inactive item (no rate is asked, D78)",
        { requestedItems: ["proposed_rate"] },
        "requestedItems",
        "unknown",
      ],
      [
        "a control character in a text",
        { title: "a\u0000b" },
        "title",
        "control_character",
      ],
    ];
    for (const [label, body, path, rule] of cases) {
      const response = await patch(server, member, draft.id, body);
      expect(response.statusCode, label).toBe(400);
      const issues = fx.issuesOf(response);
      if (rule === "control_character") {
        // refused by the shape of the contract: the path and a rule of its own
        expect(
          issues.map((issue) => issue.path),
          label,
        ).toContain(path);
      } else {
        expect(issues, label).toContainEqual({ path, issue: rule });
      }
    }
    expect(await read(server, member, draft.id)).toMatchObject({
      title: TITLE,
      brief: null,
      startsOn: null,
      endsOn: null,
    });
  });

  it("refuses a save that makes a dependent field inapplicable, and accepts it once the fields are emptied with the answer (EC-L3B-07-1)", async () => {
    const { server, member } = await brand();
    const draft = await create(server, member, completeBody());
    const refusals: [string, Record<string, unknown>, string, string][] = [
      [
        "no usage right while a duration stays",
        { usageRights: "none" },
        "usageRightsDuration",
        "not_applicable",
      ],
      [
        "a product no longer sent while its value stays",
        { productIsSent: false },
        "productValueBand",
        "not_applicable",
      ],
      [
        "a gift only while a band stays",
        { remunerationKind: "gift_only" },
        "budgetBand",
        "not_applicable",
      ],
      [
        "a UGC campaign without any right",
        {
          campaignType: "ugc_delivered",
          usageRights: "none",
          usageRightsDuration: null,
          usageRightsTerritoryScope: null,
        },
        "usageRights",
        "ugc_requires_rights",
      ],
      [
        "a band that is not of the grid of the currency",
        { budgetBand: "not_a_band" },
        "budgetBand",
        "unknown",
      ],
      [
        "an amount without its currency",
        { currency: null },
        "currency",
        "required",
      ],
    ];
    for (const [label, body, path, rule] of refusals) {
      const response = await patch(server, member, draft.id, body);
      expect(response.statusCode, label).toBe(400);
      expect(fx.issuesOf(response), label).toContainEqual({
        path,
        issue: rule,
      });
    }
    // a gift needs a product: no « product not sent » with a gift kind
    const gift = await patch(server, member, draft.id, {
      productIsSent: false,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
    });
    expect(fx.issuesOf(gift)).toContainEqual({
      path: "remunerationKind",
      issue: "gift_requires_product",
    });
    // the answer that changes them sends them emptied together: accepted
    const done = await patch(server, member, draft.id, {
      remunerationKind: "cash",
      productIsSent: false,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
      usageRights: "none",
      usageRightsDuration: null,
      usageRightsTerritoryScope: null,
    });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json()).toMatchObject({
      productIsSent: false,
      productValueBand: null,
      usageRights: "none",
      usageRightsDuration: null,
    });
  });

  it("empties the two bands of the old grid when the currency changes, unless the same save names them (modele §1)", async () => {
    const { server, member } = await brand();
    const draft = await create(server, member, completeBody());
    expect(draft).toMatchObject({
      currency: "EUR",
      budgetBand: "500_1000",
      productValueBand: "100_250",
    });
    const changed = await patch(server, member, draft.id, { currency: "GBP" });
    expect(changed.statusCode, changed.body).toBe(200);
    expect(changed.json()).toMatchObject({
      currency: "GBP",
      budgetBand: null,
      productValueBand: null,
      totalBudgetMinor: 3_000_000,
    });
    const named = await patch(server, member, draft.id, {
      currency: "USD",
      budgetBand: "1000_2500",
      productValueBand: "250_500",
    });
    expect(named.json()).toMatchObject({
      currency: "USD",
      budgetBand: "1000_2500",
      productValueBand: "250_500",
    });
    // an unknown currency is refused, the brand's choice never an invented one
    const unknown = await patch(server, member, draft.id, { currency: "ZZZ" });
    expect(fx.issuesOf(unknown)).toContainEqual({
      path: "currency",
      issue: "unknown",
    });
  });

  it("does not block nor change a coordinate, a link or an amount in a text: the form signals it (RG21 to RG23, invariant 8)", async () => {
    const { server, member } = await brand();
    const draft = await create(server, member);
    const text =
      "Write to jane.doe@example.test or +33 6 12 34 56 78, see https://example.test/x, 500 EUR";
    const saved = await patch(server, member, draft.id, {
      publicSummary: text,
      keyMessages: ["Only 99 € for a link www.example.test"],
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({
      publicSummary: text,
      keyMessages: ["Only 99 € for a link www.example.test"],
    });
  });

  it("answers a campaign no longer written by its brand with a conflict, after the submission (modele §4, RG7)", async () => {
    const { server, member, campaign } = await readyBrand();
    expect((await submit(server, member, campaign.id)).statusCode).toBe(200);
    for (const body of [
      { title: "Another title for it" },
      { keyMessages: [] },
    ]) {
      const response = await patch(server, member, campaign.id, body);
      expect(fx.errorBody(response)).toMatchObject({
        status: 409,
        code: "conflict",
      });
      expect(fx.issuesOf(response)).toEqual([
        { path: "status", issue: "campaign_not_editable" },
      ]);
    }
    expect(await read(server, member, campaign.id)).toMatchObject({
      status: "pending_review",
      title: TITLE,
    });
    // a refusal by INFLUX gives it back to the brand (rejected is written)
    await fx.migration`
      update campaigns.campaigns set status = 'rejected' where id = ${campaign.id}`;
    const again = await patch(server, member, campaign.id, {
      title: "A better title for it",
    });
    expect(again.statusCode, again.body).toBe(200);
    expect(again.json()).toMatchObject({
      status: "rejected",
      title: "A better title for it",
    });
  });
});

describe("L3B-T8 the submission (09 RG4, RG5, RG84, RG85, CA2, CA3)", () => {
  it("moves a complete draft to pending_review, and a second click writes nothing (changed false)", async () => {
    const { server, member, campaign } = await readyBrand();
    expect(campaign.missingRequired).toEqual([]);
    const first = await submit(server, member, campaign.id);
    expect(first.statusCode, first.body).toBe(200);
    const done = first.json() as CampaignResponse & { changed: boolean };
    expect(done).toMatchObject({
      status: "pending_review",
      changed: true,
      authorizationsDeclaredAt: null,
    });
    expect(done.submittedAt).toMatch(/Z$/);
    const second = (
      await submit(server, member, campaign.id)
    ).json() as typeof done;
    expect(second).toMatchObject({
      status: "pending_review",
      changed: false,
      submittedAt: done.submittedAt,
    });
    // ONE line of the register, written in the transaction of the submission
    const lines = await fx.migration<{ payload: Record<string, unknown> }[]>`
      select payload from audit.audit_events
       where event_type = 'campaign.submitted' and subject_id = ${campaign.id}`;
    expect(lines).toEqual([{ payload: { from_status: "draft" } }]);
  });

  it("names EVERY missing field, in the order of the form, in camelCase (CA3), and changes nothing", async () => {
    const { server, member } = await brand();
    await fx.setProfileStatus(member, "published");
    const draft = await create(server, member, {
      title: TITLE,
      productIsSent: true,
      usageRights: "organic_repost",
      remunerationKind: "cash",
    });
    const response = await submit(server, member, draft.id);
    expect(fx.errorBody(response)).toMatchObject({
      status: 400,
      code: "validation_failed",
    });
    const issues = fx.issuesOf(response);
    expect(issues.every((issue) => issue.issue === "required")).toBe(true);
    const paths = issues.map((issue) => issue.path);
    // the conditionals follow their answers: a product sent asks its three fields, rights their two
    expect(paths).toEqual(
      expect.arrayContaining([
        "campaignType",
        "publicSummary",
        "brief",
        "productValueBand",
        "creatorKeepsProduct",
        "shippingCostsBorneBy",
        "usageRightsDuration",
        "usageRightsTerritory",
        "budgetBand",
        "applicationsCloseOn",
      ]),
    );
    expect(paths).not.toContain("title");
    expect(paths).toEqual(
      CAMPAIGN_REQUIRED_FIELDS.filter((field) => paths.includes(field)),
    );
    expect(paths).toEqual(
      (await read(server, member, draft.id)).missingRequired,
    );
    expect(await stateOf(draft.id)).toBe("draft");
  });

  it("refuses a brand whose profile is not published, naming it (CA2), and a campaign that is not the brand's to submit (RG5)", async () => {
    const { server, member } = await brand();
    const campaign = await create(server, member, completeBody());
    const refused = await submit(server, member, campaign.id);
    expect(fx.errorBody(refused)).toMatchObject({
      status: 409,
      code: "conflict",
    });
    expect(fx.issuesOf(refused)).toEqual([
      { path: "profile", issue: "profile_not_published" },
    ]);
    expect(await stateOf(campaign.id)).toBe("draft");
    // published, paused and closed are left by INFLUX only
    await fx.setProfileStatus(member, "published");
    for (const state of ["published", "paused", "closed"]) {
      await fx.migration`
        update campaigns.campaigns set status = ${state} where id = ${campaign.id}`;
      const response = await submit(server, member, campaign.id);
      expect(fx.errorBody(response), state).toMatchObject({
        status: 409,
        code: "conflict",
      });
      expect(fx.issuesOf(response), state).toEqual([
        { path: "status", issue: "campaign_not_submittable" },
      ]);
    }
  });

  it("submits again after a refusal by INFLUX (rejected)", async () => {
    const { server, member, campaign } = await readyBrand();
    await fx.migration`
      update campaigns.campaigns set status = 'rejected' where id = ${campaign.id}`;
    const response = await submit(server, member, campaign.id);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      status: "pending_review",
      changed: true,
    });
    const lines = await fx.migration<{ payload: Record<string, unknown> }[]>`
      select payload from audit.audit_events
       where event_type = 'campaign.submitted' and subject_id = ${campaign.id}`;
    expect(lines).toEqual([{ payload: { from_status: "rejected" } }]);
  });

  it("asks the declaration of RG85 of a sensitive sector, ticked in fr or en, and keeps the hash of the exact text, the language, the author and the instant", async () => {
    const { server, member, campaign } = await readyBrand({
      productSector: sensitiveSector,
    });
    expect(campaign.sectorIsSensitive).toBe(true);
    // the box not ticked: refused, nothing moves
    for (const body of [{}, undefined]) {
      const refused = await submit(server, member, campaign.id, body);
      expect(fx.errorBody(refused)).toMatchObject({
        status: 400,
        code: "validation_failed",
      });
      expect(fx.issuesOf(refused)).toEqual([
        { path: "authorizationsDeclaration", issue: "required" },
      ]);
    }
    // only a language of the texts of the box: any other is refused by the contract
    expect(
      (await submit(server, member, campaign.id, { declarationLocale: "de" }))
        .statusCode,
    ).toBe(400);
    expect(await stateOf(campaign.id)).toBe("draft");
    const done = await submit(server, member, campaign.id, {
      declarationLocale: "fr",
    });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json()).toMatchObject({
      status: "pending_review",
      changed: true,
      authorizationsDeclaredAt: expect.stringMatching(/Z$/),
    });
    const [kept] = await fx.migration<
      {
        by: string;
        locale: string;
        hash: string;
        at: Date;
      }[]
    >`
      select authorizations_declared_by_account_id::text as by,
             authorizations_declaration_locale::text as locale,
             encode(authorizations_declaration_hash, 'hex') as hash,
             authorizations_declared_at as at
        from campaigns.campaigns where id = ${campaign.id}`;
    expect(kept).toMatchObject({
      by: member.accountId,
      locale: "fr",
      hash: createHash("sha256").update(DECLARATION_FR, "utf8").digest("hex"),
    });
    const lines = await fx.migration<{ payload: Record<string, unknown> }[]>`
      select payload from audit.audit_events
       where event_type = 'campaign.submitted' and subject_id = ${campaign.id}`;
    expect(lines).toEqual([
      {
        payload: {
          from_status: "draft",
          declaration_locale: "fr",
          declaration_hash: createHash("sha256")
            .update(DECLARATION_FR, "utf8")
            .digest("hex"),
        },
      },
    ]);
  });

  it("keeps no declaration for a sector that is not sensitive, even when a language is sent (RG84: the box is not shown)", async () => {
    const { server, member, campaign } = await readyBrand();
    expect(campaign.sectorIsSensitive).toBe(false);
    const done = await submit(server, member, campaign.id, {
      declarationLocale: "en",
    });
    expect(done.statusCode, done.body).toBe(200);
    expect(done.json()).toMatchObject({ authorizationsDeclaredAt: null });
    const [row] = await fx.migration<{ n: number }[]>`
      select num_nonnulls(authorizations_declared_at, authorizations_declared_by_account_id,
                          authorizations_declaration_locale, authorizations_declaration_hash)::int
               as n
        from campaigns.campaigns where id = ${campaign.id}`;
    expect(row?.n).toBe(0);
  });

  it("serves a rejected campaign back to the brand with its fields, ready to be corrected and submitted again (CA72)", async () => {
    const { server, member, campaign } = await readyBrand();
    await submit(server, member, campaign.id);
    await fx.migration`
      update campaigns.campaigns set status = 'rejected' where id = ${campaign.id}`;
    const back = await read(server, member, campaign.id);
    expect(back).toMatchObject({
      status: "rejected",
      title: TITLE,
      brief: BRIEF,
      internalReference: REFERENCE,
      budgetBand: "500_1000",
      totalBudgetMinor: 3_000_000,
      missingRequired: [],
    });
  });
});

describe("C-1 (D60): nothing of a campaign in the logs", () => {
  it("finds no title, brief, reference, name nor address in any captured stream", () => {
    expect(fx.logStreams.length).toBeGreaterThanOrEqual(10);
    expect(
      fx.logStreams.flatMap((text) => valuesFoundIn(text(), fx.watchedValues)),
    ).toEqual([]);
  });
});
