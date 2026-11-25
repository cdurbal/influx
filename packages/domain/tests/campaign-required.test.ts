import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_CONDITIONAL_FIELDS,
  CAMPAIGN_REQUIRED_FIELDS,
  CAMPAIGN_REQUIRED_FIELD_STEP,
  CAMPAIGN_STEPS,
  isAuthorizationDeclarationMissing,
  missingCampaignFields,
  missingCampaignFieldsOfStep,
  type CampaignInput,
  type CampaignRequiredField,
} from "../src/campaign/index.ts";

/** A campaign with every required field entered, product sent, rights granted, cash. */
const FILLED: CampaignInput = {
  title: "x".repeat(10),
  campaignType: "product_placement",
  publicSummary: "x".repeat(120),
  brief: "x".repeat(300),
  productDescription: "x".repeat(20),
  productSector: "beauty",
  keyMessages: ["x".repeat(10)],
  productIsSent: true,
  productValueBand: "100_250",
  creatorKeepsProduct: true,
  shippingCostsBorneBy: "brand",
  deliverables: [{ networkCode: "instagram", formatCode: "reel", quantity: 1 }],
  usageRights: "organic_repost",
  usageRightsDuration: "3m",
  usageRightsTerritoryScope: "selected_countries",
  usageRightsTerritories: ["FR"],
  exclusivity: "none",
  contentReviewDelay: "5bd",
  audienceCountries: ["FR"],
  audienceLanguages: ["fr"],
  audienceTopics: ["beauty"],
  currency: "EUR",
  remunerationKind: "cash",
  budgetBand: "500_1000",
  creatorsWanted: 1,
  applicationsCloseOn: "2027-01-10",
  startsOn: "2027-02-01",
  endsOn: "2027-03-01",
};

describe("L3B-T5 required fields of 09 RG4, RG16, RG24, RG34, RG46, RG55, RG69", () => {
  it("lists the 27 codes of modele §5 in the order of the form", () => {
    expect(CAMPAIGN_REQUIRED_FIELDS).toEqual([
      "title",
      "campaignType",
      "publicSummary",
      "brief",
      "productDescription",
      "productSector",
      "keyMessages",
      "productIsSent",
      "productValueBand",
      "creatorKeepsProduct",
      "shippingCostsBorneBy",
      "deliverables",
      "usageRights",
      "usageRightsDuration",
      "usageRightsTerritory",
      "exclusivity",
      "contentReviewDelay",
      "audienceCountries",
      "audienceLanguages",
      "audienceTopics",
      "currency",
      "remunerationKind",
      "budgetBand",
      "creatorsWanted",
      "applicationsCloseOn",
      "startsOn",
      "endsOn",
    ]);
  });

  it("gives every field a step, in the non-decreasing order of the five steps (17 §4.3)", () => {
    const steps = CAMPAIGN_REQUIRED_FIELDS.map(
      (field) => CAMPAIGN_REQUIRED_FIELD_STEP[field],
    );
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    expect(new Set(steps)).toEqual(new Set(CAMPAIGN_STEPS));
  });

  it("accepts a filled campaign, and a filled one without optional fields", () => {
    expect(missingCampaignFields(FILLED)).toEqual([]);
    expect(
      missingCampaignFields({
        ...FILLED,
        keyMessages: [],
        contentDueOn: null,
      } as CampaignInput),
    ).toEqual([]);
  });

  it("names every field of an empty campaign, in order, except the conditional and the recommended ones", () => {
    // Key messages are recommended: an empty list is not a missing field.
    const conditional = new Set<string>([
      ...Object.values(CAMPAIGN_CONDITIONAL_FIELDS).flat(),
      "keyMessages",
    ]);
    expect(missingCampaignFields({})).toEqual(
      CAMPAIGN_REQUIRED_FIELDS.filter((field) => !conditional.has(field)),
    );
  });

  // Each required field on its own: removing it names it, and only it.
  const emptied: [CampaignRequiredField, Partial<CampaignInput>][] = [
    ["title", { title: null }],
    ["campaignType", { campaignType: null }],
    ["publicSummary", { publicSummary: "" }],
    ["brief", { brief: null }],
    ["productDescription", { productDescription: null }],
    ["productSector", { productSector: null }],
    ["productIsSent", { productIsSent: null, productValueBand: null }],
    ["deliverables", { deliverables: [] }],
    ["usageRights", { usageRights: null }],
    ["exclusivity", { exclusivity: null }],
    ["contentReviewDelay", { contentReviewDelay: null }],
    ["audienceCountries", { audienceCountries: [] }],
    ["audienceLanguages", { audienceLanguages: null }],
    ["audienceTopics", { audienceTopics: [] }],
    ["currency", { currency: null }],
    ["remunerationKind", { remunerationKind: null, budgetBand: null }],
    ["creatorsWanted", { creatorsWanted: null }],
    ["applicationsCloseOn", { applicationsCloseOn: null }],
    ["startsOn", { startsOn: null }],
    ["endsOn", { endsOn: null }],
  ];
  it.each(emptied)("names %s alone when it is not entered", (field, change) => {
    const missing = missingCampaignFields({ ...FILLED, ...change });
    expect(missing).toContain(field);
    // productIsSent and remunerationKind are unanswered conditions, which hide their dependants.
    expect(missing).toEqual([field]);
  });

  it("counts a text below its minimum as missing, margins excluded (RG16, RG24)", () => {
    expect(missingCampaignFields({ ...FILLED, title: "x".repeat(9) })).toEqual([
      "title",
    ]);
    expect(
      missingCampaignFields({ ...FILLED, title: ` ${"x".repeat(9)} ` }),
    ).toEqual(["title"]);
    expect(
      missingCampaignFields({ ...FILLED, publicSummary: "x".repeat(119) }),
    ).toEqual(["publicSummary"]);
    expect(
      missingCampaignFields({ ...FILLED, brief: "x".repeat(299) }),
    ).toEqual(["brief"]);
    expect(
      missingCampaignFields({ ...FILLED, productDescription: "x".repeat(19) }),
    ).toEqual(["productDescription"]);
  });

  it("asks for a key message only when one is there and out of 10 to 200 (RG24)", () => {
    expect(
      missingCampaignFields({ ...FILLED, keyMessages: ["x".repeat(9)] }),
    ).toEqual(["keyMessages"]);
    expect(
      missingCampaignFields({ ...FILLED, keyMessages: ["x".repeat(200)] }),
    ).toEqual([]);
    expect(
      missingCampaignFields({ ...FILLED, keyMessages: ["x".repeat(201)] }),
    ).toEqual(["keyMessages"]);
    expect(
      missingCampaignFields({ ...FILLED, keyMessages: ["x".repeat(10), " "] }),
    ).toEqual(["keyMessages"]);
  });

  it("counts a number of creators outside 1 to 50 as missing (RG55, RG66)", () => {
    expect(missingCampaignFields({ ...FILLED, creatorsWanted: 0 })).toEqual([
      "creatorsWanted",
    ]);
    expect(missingCampaignFields({ ...FILLED, creatorsWanted: 50 })).toEqual(
      [],
    );
    expect(missingCampaignFields({ ...FILLED, creatorsWanted: 51 })).toEqual([
      "creatorsWanted",
    ]);
    expect(missingCampaignFields({ ...FILLED, creatorsWanted: 2.5 })).toEqual([
      "creatorsWanted",
    ]);
  });

  it("counts a date that does not exist as missing, whatever its shape (RG69)", () => {
    expect(
      missingCampaignFields({ ...FILLED, startsOn: "2027-02-30" }),
    ).toEqual(["startsOn"]);
    expect(missingCampaignFields({ ...FILLED, endsOn: "01/03/2027" })).toEqual([
      "endsOn",
    ]);
  });

  describe("conditionals", () => {
    it("asks the three fields of a sent product only when it is sent (RG24)", () => {
      const notSent = {
        ...FILLED,
        productIsSent: false,
        productValueBand: null,
        creatorKeepsProduct: null,
        shippingCostsBorneBy: null,
      };
      expect(missingCampaignFields(notSent)).toEqual([]);
      expect(
        missingCampaignFields({
          ...FILLED,
          productValueBand: null,
          creatorKeepsProduct: null,
          shippingCostsBorneBy: null,
        }),
      ).toEqual([
        "productValueBand",
        "creatorKeepsProduct",
        "shippingCostsBorneBy",
      ]);
      expect(
        missingCampaignFields({ ...FILLED, creatorKeepsProduct: null }),
      ).toEqual(["creatorKeepsProduct"]);
    });

    it("asks duration and territory only when the rights are not none (RG34, RG39)", () => {
      expect(
        missingCampaignFields({
          ...FILLED,
          usageRights: "none",
          usageRightsDuration: null,
          usageRightsTerritoryScope: null,
          usageRightsTerritories: [],
        }),
      ).toEqual([]);
      expect(
        missingCampaignFields({
          ...FILLED,
          usageRightsDuration: null,
          usageRightsTerritoryScope: null,
          usageRightsTerritories: [],
        }),
      ).toEqual(["usageRightsDuration", "usageRightsTerritory"]);
    });

    it("holds the territory to its scope: the world alone, or one to five countries", () => {
      const rights = { ...FILLED, usageRights: "paid_media" };
      expect(
        missingCampaignFields({
          ...rights,
          usageRightsTerritoryScope: "worldwide",
          usageRightsTerritories: [],
        }),
      ).toEqual([]);
      expect(
        missingCampaignFields({
          ...rights,
          usageRightsTerritoryScope: "worldwide",
          usageRightsTerritories: ["FR"],
        }),
      ).toEqual(["usageRightsTerritory"]);
      expect(
        missingCampaignFields({
          ...rights,
          usageRightsTerritoryScope: "selected_countries",
          usageRightsTerritories: [],
        }),
      ).toEqual(["usageRightsTerritory"]);
      expect(
        missingCampaignFields({
          ...rights,
          usageRightsTerritoryScope: null,
          usageRightsTerritories: ["FR"],
        }),
      ).toEqual(["usageRightsTerritory"]);
    });

    it("asks a budget band unless the nature is gift only; affiliation included (CA76, RG64, Q16)", () => {
      expect(
        missingCampaignFields({
          ...FILLED,
          remunerationKind: "gift_only",
          budgetBand: null,
        }),
      ).toEqual([]);
      expect(missingCampaignFields({ ...FILLED, budgetBand: null })).toEqual([
        "budgetBand",
      ]);
      expect(
        missingCampaignFields({
          ...FILLED,
          remunerationKind: "cash_and_gift",
          budgetBand: null,
        }),
      ).toEqual(["budgetBand"]);
      expect(
        missingCampaignFields({
          ...FILLED,
          remunerationKind: "affiliate",
          budgetBand: null,
        }),
      ).toEqual(["budgetBand"]);
    });

    it("never asks for an amount of money: no exact range, no total budget (D78)", () => {
      expect(CAMPAIGN_REQUIRED_FIELDS).not.toContain("totalBudget");
      expect(
        missingCampaignFields({ ...FILLED, budgetBand: "500_1000" }),
      ).toEqual([]);
    });
  });

  it("splits the missing fields by step (17 §4.3)", () => {
    const empty = missingCampaignFields({});
    expect(missingCampaignFieldsOfStep({}, 3)).toEqual([
      "audienceCountries",
      "audienceLanguages",
      "audienceTopics",
    ]);
    expect(
      CAMPAIGN_STEPS.flatMap((step) => missingCampaignFieldsOfStep({}, step)),
    ).toEqual(empty);
  });

  it("requires the declaration of RG85 for a sensitive category only, ticked by the brand", () => {
    expect(
      isAuthorizationDeclarationMissing({
        sectorIsSensitive: true,
        declarationTicked: false,
      }),
    ).toBe(true);
    expect(
      isAuthorizationDeclarationMissing({
        sectorIsSensitive: true,
        declarationTicked: null,
      }),
    ).toBe(true);
    expect(
      isAuthorizationDeclarationMissing({
        sectorIsSensitive: true,
        declarationTicked: true,
      }),
    ).toBe(false);
    expect(
      isAuthorizationDeclarationMissing({
        sectorIsSensitive: false,
        declarationTicked: false,
      }),
    ).toBe(false);
    expect(
      isAuthorizationDeclarationMissing({
        sectorIsSensitive: null,
        declarationTicked: null,
      }),
    ).toBe(false);
  });
});
