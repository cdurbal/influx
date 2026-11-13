// The rules of the campaign screens that are not apps/api's (docs/mvp/09 RG14, RG21 to RG23, RG108;
// 17 §4.3; jalons/l3b, commit 09): the draft, the patch of the autosave, the dependents an answer empties
// (EC-L3B-07-1), the checks the browser makes with the schema of the API, the warnings of a text, the steps
// and their missing fields, the texts of the translation files that no code may lack. Pure functions, no
// browser.
import {
  CAMPAIGN_STATUSES,
  type CampaignResponse,
} from "@influx/contracts/campaign";
import { describe, expect, it } from "vitest";
import enCampaign from "@/locales/en/campaign.json";
import frCampaign from "@/locales/fr/campaign.json";
import {
  afterSave,
  applyChange,
  AVAILABLE_STEPS,
  completeDeliverables,
  controlIdOf,
  DEPENDENT_KEYS,
  DRAFT_KEYS,
  draftOf,
  fieldErrorOf,
  formatsOfNetwork,
  isConditionallyRequired,
  isEditable,
  isRequired,
  missingOfStep,
  planPatch,
  RELATED_ERROR_KEYS,
  sameValue,
  singleFieldPatch,
  STATUS_TEXT_KEYS,
  STATUS_TONES,
  stepOfParameter,
  STEP_OF_KEY,
  TOTAL_STEPS,
  warningKeysOf,
  type CampaignDraft,
} from "@/components/campaign/campaign-view";

const CAMPAIGN: CampaignResponse = {
  id: "7d6f1c43-6a0c-4cc4-9f0b-1c1f5f6d2a10",
  status: "draft",
  submittedAt: null,
  createdAt: "2026-11-13T10:00:00.000Z",
  updatedAt: "2026-11-13T10:00:00.000Z",
  title: null,
  campaignType: null,
  publicSummary: null,
  brief: null,
  internalReference: null,
  productDescription: null,
  productSector: null,
  restrictions: null,
  productIsSent: null,
  productValueBand: null,
  creatorKeepsProduct: null,
  shippingCostsBorneBy: null,
  keyMessages: [],
  deliverables: [],
  usageRights: null,
  usageRightsDuration: null,
  usageRightsTerritoryScope: null,
  usageRightsTerritories: [],
  exclusivity: null,
  contentReviewDelay: null,
  contentDueOn: null,
  audienceGender: null,
  audienceCountries: [],
  audienceLanguages: [],
  audienceBands: [],
  audienceAgeBands: [],
  audienceTopics: [],
  currency: null,
  remunerationKind: null,
  budgetBand: null,
  creatorsWanted: null,
  totalBudgetMinor: null,
  applicationsCloseOn: null,
  startsOn: null,
  endsOn: null,
  maxApplications: null,
  requestedItems: [],
  authorizationsDeclaredAt: null,
  sectorIsSensitive: false,
  missingRequired: [],
  references: {
    campaignTypes: [],
    sectors: [],
    sensitiveSectors: [],
    usageRights: [],
    networks: [],
    formats: [],
    countries: [],
    languages: [],
    topics: [],
    audienceGenders: [],
    audienceBands: [],
    audienceAgeBands: [],
    currencies: [],
    requestedItems: [],
    authorizationDeclarations: [],
  },
};

const EMPTY = draftOf(CAMPAIGN);

describe("L3B-E1 draft: what the form holds for a campaign", () => {
  it("holds an empty text for a field not entered, a list for a list, null for a choice not made", () => {
    expect(EMPTY.title).toBe("");
    expect(EMPTY.campaignType).toBeNull();
    expect(EMPTY.productIsSent).toBeNull();
    expect(EMPTY.deliverables).toEqual([]);
    expect(EMPTY.audienceCountries).toEqual([]);
    expect(Object.keys(EMPTY).sort()).toEqual([...DRAFT_KEYS].sort());
  });

  it("takes the texts and the lists of the answer as they are, deliverables included", () => {
    const draft = draftOf({
      ...CAMPAIGN,
      title: "Une campagne d'été",
      keyMessages: ["Un message clé"],
      deliverables: [
        { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
      ],
      audienceTopics: ["beauty"],
    });
    expect(draft.title).toBe("Une campagne d'été");
    expect(draft.keyMessages).toEqual(["Un message clé"]);
    expect(draft.deliverables).toEqual([
      { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
    ]);
    expect(draft.audienceTopics).toEqual(["beauty"]);
  });

  it("places every field in one of the first three steps, in the order of the form", () => {
    expect(AVAILABLE_STEPS).toEqual([1, 2, 3]);
    expect(TOTAL_STEPS).toBe(5);
    const steps = DRAFT_KEYS.map((key) => STEP_OF_KEY[key]);
    expect(steps).toEqual([...steps].sort());
    expect(new Set(steps)).toEqual(new Set([1, 2, 3]));
  });

  it("gives every field the id its control is focused by", () => {
    expect(controlIdOf("title")).toBe("campaign-title");
    expect(new Set(DRAFT_KEYS.map(controlIdOf)).size).toBe(DRAFT_KEYS.length);
  });
});

describe("L3B-E1 planPatch: the autosave sends what changed (RG108)", () => {
  it("sends nothing when nothing changed", () => {
    expect(planPatch(EMPTY, EMPTY)).toEqual({
      body: null,
      keys: [],
      refused: {},
    });
  });

  it("sends the fields that changed alone, a text emptied as null, a text kept as typed", () => {
    const draft = { ...EMPTY, title: "  Un titre d'été  ", brief: "" };
    const saved = { ...EMPTY, brief: "Un brief" };
    const plan = planPatch(draft, saved);
    expect(plan.keys).toEqual(["title", "brief"]);
    expect(plan.body).toEqual({ title: "  Un titre d'été  ", brief: null });
  });

  it("sends a list whole, and a choice as its code", () => {
    const draft = {
      ...EMPTY,
      audienceCountries: ["FR", "BE"],
      campaignType: "product_review",
    };
    const plan = planPatch(draft, EMPTY);
    expect(plan.body).toEqual({
      campaignType: "product_review",
      audienceCountries: ["FR", "BE"],
    });
  });

  it("leaves a field in error alone until the member changes it (no loop)", () => {
    const draft = {
      ...EMPTY,
      campaignType: "ugc_delivered",
      title: "Un titre",
    };
    const plan = planPatch(draft, EMPTY, { campaignType: "ugcRequiresRights" });
    expect(plan.keys).toEqual(["title"]);
    expect(plan.body).toEqual({ title: "Un titre" });
  });

  it("refuses with the schema of the API what it would refuse, without holding back the others", () => {
    const draft = {
      ...EMPTY,
      audienceCountries: ["FR", "FR"],
      title: "Un titre",
    };
    const plan = planPatch(draft, EMPTY);
    expect(plan.refused).toEqual({ audienceCountries: "invalid" });
    expect(plan.keys).toEqual(["title"]);
  });

  it("keeps a line of deliverables half entered on the screen and never sends it (a brand interrupted never starts over)", () => {
    const half = {
      ...EMPTY,
      deliverables: [{ networkCode: "instagram", formatCode: "", quantity: 1 }],
    };
    expect(planPatch(half, EMPTY).body).toBeNull();
    const done = {
      ...EMPTY,
      deliverables: [
        { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
        { networkCode: "tiktok", formatCode: "", quantity: 1 },
      ],
    };
    const plan = planPatch(done, EMPTY);
    expect(plan.body).toEqual({
      deliverables: [
        { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
      ],
    });
    // the half line added after the save changes nothing the API holds
    expect(planPatch(done, afterSave(EMPTY, done, plan.keys)).body).toBeNull();
  });

  it("reads a deliverable line complete once its network and its format are chosen", () => {
    expect(
      completeDeliverables([
        { networkCode: "", formatCode: "", quantity: 1 },
        { networkCode: "tiktok", formatCode: "tiktok_video", quantity: 3 },
      ]),
    ).toEqual([
      { networkCode: "tiktok", formatCode: "tiktok_video", quantity: 3 },
    ]);
  });
});

describe("L3B-E1 applyChange: an answer empties what it makes inapplicable (EC-L3B-07-1)", () => {
  const sent: CampaignDraft = {
    ...EMPTY,
    productIsSent: true,
    currency: "EUR",
    productValueBand: "100_250",
    creatorKeepsProduct: true,
    shippingCostsBorneBy: "brand",
    usageRights: "paid_whitelisting",
    usageRightsDuration: "3m",
    usageRightsTerritoryScope: "selected_countries",
    usageRightsTerritories: ["FR"],
  };

  it("empties the three fields of a product no longer sent, and sends them emptied with the answer", () => {
    const next = applyChange(sent, "productIsSent", false);
    expect(next.productValueBand).toBeNull();
    expect(next.creatorKeepsProduct).toBeNull();
    expect(next.shippingCostsBorneBy).toBeNull();
    const plan = planPatch(next, sent);
    expect(plan.body).toEqual({
      productIsSent: false,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
    });
  });

  it("keeps them when the product stays sent", () => {
    expect(applyChange(sent, "productIsSent", true)).toEqual(sent);
  });

  it("empties the duration, the scope and the countries when the rights become none", () => {
    const next = applyChange(sent, "usageRights", "none");
    expect(next.usageRightsDuration).toBeNull();
    expect(next.usageRightsTerritoryScope).toBeNull();
    expect(next.usageRightsTerritories).toEqual([]);
    expect(planPatch(next, sent).body).toEqual({
      usageRights: "none",
      usageRightsDuration: null,
      usageRightsTerritoryScope: null,
      usageRightsTerritories: [],
    });
  });

  it("keeps the territory when one right replaces another", () => {
    const next = applyChange(sent, "usageRights", "media_buy");
    expect(next.usageRightsTerritories).toEqual(["FR"]);
  });

  it("empties the countries when the territory becomes the world", () => {
    const next = applyChange(sent, "usageRightsTerritoryScope", "worldwide");
    expect(next.usageRightsTerritories).toEqual([]);
  });

  it("empties the band of the old grid when the currency changes", () => {
    const next = applyChange(sent, "currency", "GBP");
    expect(next.productValueBand).toBeNull();
    expect(planPatch(next, sent).body).toEqual({
      currency: "GBP",
      productValueBand: null,
    });
  });

  it("sends a field alone with the dependents it empties that changed too", () => {
    const next = applyChange(sent, "productIsSent", false);
    const single = singleFieldPatch("productIsSent", next, sent);
    expect(single?.keys).toEqual([
      "productIsSent",
      "productValueBand",
      "creatorKeepsProduct",
      "shippingCostsBorneBy",
    ]);
    expect(single?.body).toEqual({
      productIsSent: false,
      productValueBand: null,
      creatorKeepsProduct: null,
      shippingCostsBorneBy: null,
    });
    // a dependent already saved as emptied is not sent again
    expect(singleFieldPatch("productIsSent", next, next)?.keys).toEqual([
      "productIsSent",
    ]);
  });

  it("names the dependents of the answers that have some, and no other", () => {
    expect(Object.keys(DEPENDENT_KEYS).sort()).toEqual([
      "currency",
      "productIsSent",
      "usageRights",
      "usageRightsTerritoryScope",
    ]);
    expect(RELATED_ERROR_KEYS).toEqual({
      campaignType: ["usageRights"],
      usageRights: ["campaignType"],
    });
  });
});

describe("L3B-E1 afterSave and sameValue", () => {
  it("makes the fields sent the new reference, texts as typed", () => {
    const sent = { ...EMPTY, title: "  Un titre  ", audienceCountries: ["FR"] };
    const saved = afterSave(EMPTY, sent, ["title", "audienceCountries"]);
    expect(saved.title).toBe("  Un titre  ");
    expect(planPatch(sent, saved).body).toBeNull();
  });

  it("compares a list in order, element by element", () => {
    expect(sameValue(["FR", "BE"], ["FR", "BE"])).toBe(true);
    expect(sameValue(["FR", "BE"], ["BE", "FR"])).toBe(false);
    expect(sameValue(null, "")).toBe(false);
  });
});

describe("L3B-E1 fieldErrorOf: the reason of a field the API refused, by the words of its answer", () => {
  const refused = (issues: string[]) =>
    ({ kind: "failed", code: "validation_failed", issues }) as const;

  it("names each reason the screen has a sentence for", () => {
    expect(fieldErrorOf(refused(["ugc_requires_rights"]))).toBe(
      "ugcRequiresRights",
    );
    expect(fieldErrorOf(refused(["gift_requires_product"]))).toBe(
      "giftRequiresProduct",
    );
    expect(fieldErrorOf(refused(["format_network_mismatch"]))).toBe(
      "formatNetworkMismatch",
    );
    expect(fieldErrorOf(refused(["duplicate"]))).toBe("duplicate");
    expect(fieldErrorOf(refused(["too_long"]))).toBe("tooLong");
    expect(fieldErrorOf(refused(["unknown"]))).toBe("unknown");
    expect(fieldErrorOf(refused(["not_applicable"]))).toBe("notApplicable");
  });

  it("falls back to an invalid value for any other answer", () => {
    expect(fieldErrorOf(refused([]))).toBe("invalid");
    expect(fieldErrorOf(refused(["something_else"]))).toBe("invalid");
    expect(fieldErrorOf({ kind: "failed" })).toBe("invalid");
  });

  it("has a sentence, in both languages, for each reason", () => {
    for (const copy of [frCampaign, enCampaign]) {
      expect(Object.keys(copy.fieldErrors).sort()).toEqual([
        "duplicate",
        "formatNetworkMismatch",
        "giftRequiresProduct",
        "invalid",
        "notApplicable",
        "tooLong",
        "ugcRequiresRights",
        "unknown",
      ]);
    }
  });
});

describe("L3B-E1 warnings of a text: signalled, never refused or changed (RG21 to RG23)", () => {
  it("signals a contact, a link and an amount, in the order of the warnings, each once", () => {
    expect(
      warningKeysOf([
        "Écrivez-moi à partenariats@marque.com",
        "voir https://marque.com/offre",
        "un cachet de 500 € par post",
        "ou à contact@autre.fr",
      ]),
    ).toEqual(["contactInText", "linkInText", "amountInText"]);
  });

  it("signals nothing in an ordinary text", () => {
    expect(
      warningKeysOf(["Une campagne 2026 pour les 18-24 ans, avec 3 reels", ""]),
    ).toEqual([]);
  });

  it("has the sentence of each warning in both languages", () => {
    for (const copy of [frCampaign, enCampaign]) {
      for (const key of [
        "contactInText",
        "linkInText",
        "amountInText",
      ] as const) {
        expect(copy.errors[key].length).toBeGreaterThan(20);
      }
    }
  });
});

describe("L3B-E1 required fields and steps", () => {
  it("asks the conditional fields only once their condition holds", () => {
    expect(isConditionallyRequired("productValueBand", EMPTY)).toBe(false);
    expect(
      isConditionallyRequired("productValueBand", {
        ...EMPTY,
        productIsSent: true,
      }),
    ).toBe(true);
    expect(
      isConditionallyRequired("usageRightsDuration", {
        ...EMPTY,
        usageRights: "none",
      }),
    ).toBe(false);
    expect(
      isConditionallyRequired("usageRightsDuration", {
        ...EMPTY,
        usageRights: "organic_repost",
      }),
    ).toBe(true);
    expect(isRequired("title", EMPTY)).toBe(true);
    expect(isRequired("restrictions", EMPTY)).toBe(false);
    expect(isRequired("internalReference", EMPTY)).toBe(false);
  });

  it("counts what is missing in a step from the codes the API gives, in the domain's own step map", () => {
    const missing = [
      "title",
      "productIsSent",
      "deliverables",
      "audienceCountries",
      "currency",
    ] as const;
    expect(missingOfStep(missing, 1)).toEqual(["title", "productIsSent"]);
    expect(missingOfStep(missing, 2)).toEqual(["deliverables"]);
    expect(missingOfStep(missing, 3)).toEqual(["audienceCountries"]);
  });

  it("reads the step of the address, the first when it names none that exists", () => {
    expect(stepOfParameter("2")).toBe(2);
    expect(stepOfParameter(["3", "1"])).toBe(3);
    for (const value of [undefined, "", "0", "4", "5", "x", "2.5"]) {
      expect(stepOfParameter(value), String(value)).toBe(1);
    }
  });

  it("offers the formats of a network and the UGC ones that go with any", () => {
    const formats = [
      { code: "instagram_reel", networkCode: "instagram" },
      { code: "tiktok_video", networkCode: "tiktok" },
      { code: "ugc_video", networkCode: null },
    ];
    expect(formatsOfNetwork(formats, "instagram")).toEqual([
      "instagram_reel",
      "ugc_video",
    ]);
    expect(formatsOfNetwork(formats, "pinterest")).toEqual(["ugc_video"]);
  });
});

describe("L3B-E1 states: written, never by a color alone (CA74)", () => {
  it("lets the brand write a draft and a refused campaign only", () => {
    expect(CAMPAIGN_STATUSES.filter(isEditable)).toEqual(["draft", "rejected"]);
  });

  it("gives every state a tone, a label and a sentence in both languages", () => {
    for (const status of CAMPAIGN_STATUSES) {
      expect(STATUS_TONES[status], status).toBeDefined();
      for (const copy of [frCampaign, enCampaign]) {
        expect(copy.status.label[status].length, status).toBeGreaterThan(0);
        expect(
          copy.status[STATUS_TEXT_KEYS[status]].length,
          status,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("L3B-E1 translations: the grid of bands, the lists, both languages (tranches.md §4)", () => {
  const BAND_CODES = [
    "under_100",
    "100_250",
    "250_500",
    "500_1000",
    "1000_2500",
    "2500_5000",
    "5000_10000",
    "10000_25000",
    "25000_50000",
    "50000_plus",
  ];

  it("labels the ten bands with the currency of the campaign, never a symbol or a number computed", () => {
    for (const copy of [frCampaign, enCampaign]) {
      expect(Object.keys(copy.price_band)).toEqual(BAND_CODES);
      for (const label of Object.values(copy.price_band)) {
        expect(label).toContain("{currency}");
        expect(label).not.toMatch(/[€$£]/u);
      }
    }
  });

  it("writes the thousands as the language does, a narrow no-break space in French, a comma in English, and a no-break space before the currency", () => {
    expect(frCampaign.price_band["500_1000"]).toBe("500 à 1 000 {currency}");
    expect(frCampaign.price_band["50000_plus"]).toBe(
      "50 000 {currency} et plus",
    );
    expect(enCampaign.price_band["500_1000"]).toBe("500 to 1,000 {currency}");
    expect(enCampaign.price_band["50000_plus"]).toBe(
      "50,000 {currency} or more",
    );
  });

  it("has the same keys in French and in English", () => {
    const keysOf = (value: unknown, prefix = ""): string[] =>
      typeof value === "object" && value !== null
        ? Object.entries(value).flatMap(([key, child]) =>
            keysOf(child, `${prefix}${key}.`),
          )
        : [prefix];
    expect(keysOf(frCampaign)).toEqual(keysOf(enCampaign));
  });

  it("labels the seven campaign types, the four usage rights and the three review delays", () => {
    for (const copy of [frCampaign, enCampaign]) {
      expect(Object.keys(copy.campaign_type)).toEqual([
        "product_placement",
        "ugc_delivered",
        "product_review",
        "ambassador",
        "contest",
        "event_presence",
        "affiliate_program",
      ]);
      expect(Object.keys(copy.usage_right)).toEqual([
        "none",
        "organic_repost",
        "paid_whitelisting",
        "media_buy",
      ]);
      expect(Object.keys(copy.review_delay)).toEqual(["48h", "5bd", "10bd"]);
      expect(Object.keys(copy.age_band)).toEqual([
        "18_24",
        "25_34",
        "35_44",
        "45_plus",
      ]);
    }
  });

  it("writes no rate, no net and no percentage of commission anywhere (D48, D78)", () => {
    for (const copy of [frCampaign, enCampaign]) {
      const text = JSON.stringify(copy);
      expect(text).not.toMatch(
        /\d\s?%.{0,40}commission|commission.{0,40}\d\s?%/iu,
      );
      expect(text).not.toMatch(/\bnet\b/iu);
    }
  });
});
