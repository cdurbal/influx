// L3B commit 05 — the PARITY of the required fields of a campaign between the base (0305:
// campaigns.campaign_missing_required_fields) and packages/domain (CAMPAIGN_REQUIRED_FIELDS,
// missingCampaignFields): both copies answer the same input, the JSON of CampaignInput (modele §5,
// the pattern of 0203), the domain codes in camelCase, the base's in snake_case (L3B-T6, fiche
// invariant 5). The same thresholds, the same order, the conditionals asked only when their
// condition is answered (EC-L3B-04-1), the key messages optional (EC-L3B-04-4), the territory as its
// scope and its countries, the dates as civil dates written YYYY-MM-DD.
import {
  CAMPAIGN_REQUIRED_FIELDS,
  missingCampaignFields,
  type CampaignInput,
} from "@influx/domain/campaign";
import { describe, expect, it } from "vitest";
import { localSuperuser } from "./support.ts";

/** The base's code of a domain code: camelCase to snake_case (campaignType → campaign_type). */
const snake = (code: string) =>
  code.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

async function missingInBase(input: CampaignInput): Promise<string[]> {
  const [row] = await localSuperuser()<{ missing: string[] }[]>`
    select campaigns.campaign_missing_required_fields(${JSON.stringify(input)}::text::jsonb)
             as missing`;
  if (row === undefined) throw new Error("no answer");
  return row.missing;
}

/** The margins String.prototype.trim() removes (EC-L2B-06-4). */
const SPACES = "\t\n\u000b\f\r          　﻿";

const COMPLETE: CampaignInput = {
  title: "Summer outdoor kit",
  campaignType: "product_placement",
  publicSummary: "s".repeat(120),
  brief: "b".repeat(300),
  productDescription: "A light tent for two",
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
  audienceCountries: ["FR"],
  audienceLanguages: ["fr"],
  audienceTopics: ["sport_fitness"],
  currency: "EUR",
  remunerationKind: "cash_and_gift",
  budgetBand: "500_1000",
  creatorsWanted: 3,
  applicationsCloseOn: "2027-01-10",
  startsOn: "2027-02-01",
  endsOn: "2027-03-01",
};

/** Every field null, the lists empty: the input of a fresh draft. */
const EMPTY: CampaignInput = Object.fromEntries(
  Object.entries(COMPLETE).map(([key, value]) => [
    key,
    Array.isArray(value) ? [] : null,
  ]),
);

const PARITY_CASES: readonly [string, CampaignInput][] = [
  ["nothing entered", {}],
  ["a fresh draft (every field null, every list empty)", EMPTY],
  ["a complete campaign", COMPLETE],
  // each field absent, in turn: the conditionals follow their condition
  ...Object.keys(COMPLETE).map((field): [string, CampaignInput] => [
    `${field} absent`,
    Object.fromEntries(
      Object.entries(COMPLETE).filter(([key]) => key !== field),
    ),
  ]),
  // texts at their thresholds, margins excluded, code points counted
  ["a title of 9 characters", { ...COMPLETE, title: "a".repeat(9) }],
  ["a title of 10 characters", { ...COMPLETE, title: "a".repeat(10) }],
  [
    "a title of 9 characters between margins",
    { ...COMPLETE, title: `${SPACES}${"a".repeat(9)}${SPACES}` },
  ],
  [
    "a title of 10 characters outside the BMP",
    { ...COMPLETE, title: "\u{1f332}".repeat(10) },
  ],
  [
    "a summary of 119 characters",
    { ...COMPLETE, publicSummary: "s".repeat(119) },
  ],
  ["a brief of 299 characters", { ...COMPLETE, brief: "b".repeat(299) }],
  ["a brief of 300 characters", { ...COMPLETE, brief: "b".repeat(300) }],
  [
    "a product of 19 characters",
    { ...COMPLETE, productDescription: "p".repeat(19) },
  ],
  ["a sector of a space", { ...COMPLETE, productSector: " " }],
  ["a type of a no-break space", { ...COMPLETE, campaignType: " " }],
  // key messages: optional, a bullet that is there holds 10 to 200
  ["no key message", { ...COMPLETE, keyMessages: [] }],
  ["key messages null", { ...COMPLETE, keyMessages: null }],
  [
    "a key message of 9 characters",
    { ...COMPLETE, keyMessages: ["Fine message", "a".repeat(9)] },
  ],
  [
    "a key message of 200 characters",
    { ...COMPLETE, keyMessages: ["a".repeat(200)] },
  ],
  [
    "a key message of 201 characters",
    { ...COMPLETE, keyMessages: ["a".repeat(201)] },
  ],
  [
    "a key message of 10 characters between margins",
    { ...COMPLETE, keyMessages: [`${SPACES}${"a".repeat(10)}${SPACES}`] },
  ],
  // the product (RG24): its three fields asked only when it is sent
  [
    "a product not sent, its fields empty",
    {
      ...COMPLETE,
      productIsSent: false,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
    },
  ],
  [
    "a product sent, its fields empty",
    {
      ...COMPLETE,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: "",
    },
  ],
  [
    "the product question unanswered, its fields empty",
    {
      ...COMPLETE,
      productIsSent: null,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
    },
  ],
  [
    "the creator does not keep the product (false is an answer)",
    { ...COMPLETE, creatorKeepsProduct: false },
  ],
  // the rights (RG34, RG39): duration and territory asked unless `none`
  [
    "no usage rights, no duration nor territory",
    {
      ...COMPLETE,
      usageRights: "none",
      usageRightsDuration: null,
      usageRightsTerritoryScope: null,
      usageRightsTerritories: [],
    },
  ],
  [
    "rights unanswered, no duration nor territory",
    {
      ...COMPLETE,
      usageRights: null,
      usageRightsDuration: null,
      usageRightsTerritoryScope: null,
      usageRightsTerritories: [],
    },
  ],
  [
    "rights granted, duration and scope empty",
    {
      ...COMPLETE,
      usageRightsDuration: " ",
      usageRightsTerritoryScope: null,
      usageRightsTerritories: [],
    },
  ],
  [
    "worldwide without country",
    {
      ...COMPLETE,
      usageRightsTerritoryScope: "worldwide",
      usageRightsTerritories: [],
    },
  ],
  [
    "worldwide with a country",
    {
      ...COMPLETE,
      usageRightsTerritoryScope: "worldwide",
      usageRightsTerritories: ["FR"],
    },
  ],
  [
    "selected countries without a country",
    { ...COMPLETE, usageRightsTerritories: [] },
  ],
  [
    "countries without their scope",
    { ...COMPLETE, usageRightsTerritoryScope: null },
  ],
  ["an unknown scope", { ...COMPLETE, usageRightsTerritoryScope: "continent" }],
  // the budget (Q16, CA76): a band unless gift only, affiliation included
  [
    "gift only without band",
    { ...COMPLETE, remunerationKind: "gift_only", budgetBand: null },
  ],
  [
    "cash without band (CA76)",
    { ...COMPLETE, remunerationKind: "cash", budgetBand: null },
  ],
  [
    "affiliation without band (CA45)",
    { ...COMPLETE, remunerationKind: "affiliate", budgetBand: "" },
  ],
  [
    "the nature unanswered, no band",
    { ...COMPLETE, remunerationKind: null, budgetBand: null },
  ],
  // creators wanted: an integer from 1 to 50
  ["no creator wanted", { ...COMPLETE, creatorsWanted: 0 }],
  ["one creator wanted", { ...COMPLETE, creatorsWanted: 1 }],
  ["fifty creators wanted", { ...COMPLETE, creatorsWanted: 50 }],
  ["fifty-one creators wanted", { ...COMPLETE, creatorsWanted: 51 }],
  ["two and a half creators", { ...COMPLETE, creatorsWanted: 2.5 }],
  ["a negative number of creators", { ...COMPLETE, creatorsWanted: -3 }],
  // the dates: civil dates that exist, written YYYY-MM-DD
  ["29 February of a leap year", { ...COMPLETE, startsOn: "2028-02-29" }],
  ["29 February of a common year", { ...COMPLETE, startsOn: "2027-02-29" }],
  ["31 April", { ...COMPLETE, endsOn: "2027-04-31" }],
  ["a thirteenth month", { ...COMPLETE, applicationsCloseOn: "2027-13-01" }],
  ["a day zero", { ...COMPLETE, applicationsCloseOn: "2027-01-00" }],
  ["the year zero", { ...COMPLETE, applicationsCloseOn: "0000-01-10" }],
  ["the year one", { ...COMPLETE, applicationsCloseOn: "0001-01-10" }],
  ["29 February of the year 4", { ...COMPLETE, startsOn: "0004-02-29" }],
  ["a date written D/M/Y", { ...COMPLETE, startsOn: "01/02/2027" }],
  ["a date with an instant", { ...COMPLETE, endsOn: "2027-03-01T00:00:00Z" }],
  ["a date of spaces", { ...COMPLETE, endsOn: "  " }],
];

describe("09 RG4, CA3: the required fields of the base equal those of packages/domain (0305, modele §5)", () => {
  it("names, for an empty input, the codes of CAMPAIGN_REQUIRED_FIELDS that hang on no condition, in their order", async () => {
    const conditional = new Set([
      "productValueBand",
      "creatorKeepsProduct",
      "shippingCostsBorneBy",
      "usageRightsDuration",
      "usageRightsTerritory",
      "budgetBand",
      "keyMessages",
    ]);
    expect(await missingInBase({})).toEqual(
      CAMPAIGN_REQUIRED_FIELDS.filter((field) => !conditional.has(field)).map(
        snake,
      ),
    );
  });

  it("names the 24 other codes, in the order of CAMPAIGN_REQUIRED_FIELDS, when only the three conditions are answered", async () => {
    const input: CampaignInput = {
      keyMessages: ["short"],
      productIsSent: true,
      usageRights: "organic_repost",
      remunerationKind: "cash",
    };
    const expected = CAMPAIGN_REQUIRED_FIELDS.filter(
      (field) =>
        field !== "productIsSent" &&
        field !== "usageRights" &&
        field !== "remunerationKind",
    ).map(snake);
    expect(await missingInBase(input)).toEqual(expected);
    expect(missingCampaignFields(input).map(snake)).toEqual(expected);
    expect(CAMPAIGN_REQUIRED_FIELDS).toHaveLength(27);
  });

  it.each(PARITY_CASES)(
    "answers as missingCampaignFields() for %s",
    async (_label, input) => {
      expect(await missingInBase(input)).toEqual(
        missingCampaignFields(input).map(snake),
      );
    },
  );

  it("is pure and closed: IMMUTABLE, SECURITY INVOKER, owned by influx_campaign_definer, executed by its owner only", async () => {
    const rows = await localSuperuser()<
      {
        name: string;
        volatility: string;
        definer: boolean;
        owner: string;
        config: string[] | null;
        grantees: string[];
      }[]
    >`
      select p.proname as name, p.provolatile::text as volatility, p.prosecdef as definer,
             pg_catalog.pg_get_userbyid(p.proowner) as owner, p.proconfig as config,
             coalesce((select pg_catalog.array_agg(distinct pg_catalog.pg_get_userbyid(a.grantee)::text)
                         from pg_catalog.aclexplode(p.proacl) a
                        where a.grantee <> p.proowner), '{}') as grantees
        from pg_catalog.pg_proc p
       where p.oid in ('campaigns.campaign_missing_required_fields(jsonb)'::regprocedure,
                       'campaigns.campaign_input(uuid)'::regprocedure)
       order by p.proname`;
    expect(rows).toEqual([
      {
        name: "campaign_input",
        volatility: "s",
        definer: false,
        owner: "influx_campaign_definer",
        config: ['search_path=""'],
        grantees: [],
      },
      {
        name: "campaign_missing_required_fields",
        volatility: "i",
        definer: false,
        owner: "influx_campaign_definer",
        config: ['search_path=""'],
        grantees: [],
      },
    ]);
  });
});
