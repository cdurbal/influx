// The rules of the campaign screens that are not apps/api's (docs/mvp/09 RG14, RG21 to RG23, RG108;
// 17 §4.3; jalons/l3b, commits 09 and 10): the draft, the patch of the autosave, the dependents an answer empties
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
  dateConflictsOf,
  DEPENDENT_KEYS,
  DRAFT_KEYS,
  draftOf,
  fieldErrorOf,
  firstInvalid,
  firstMissing,
  formatsOfNetwork,
  invalidFields,
  isConditionallyRequired,
  isEditable,
  isGiftOnly,
  isKeyOfStep,
  isRequired,
  missingErrors,
  missingGroups,
  missingKeyOf,
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
  unsavedInError,
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

  it("places every field in one of the five steps, in the order of the form", () => {
    expect(AVAILABLE_STEPS).toEqual([1, 2, 3, 4, 5]);
    expect(TOTAL_STEPS).toBe(5);
    const steps = DRAFT_KEYS.map((key) => STEP_OF_KEY[key]);
    expect(steps).toEqual([...steps].sort());
    expect(new Set(steps)).toEqual(new Set([1, 2, 3, 4, 5]));
  });

  it("holds the budget and the calendar as the API says them: dates as civil dates or empty, bands as codes", () => {
    const draft = draftOf({
      ...CAMPAIGN,
      remunerationKind: "cash",
      currency: "EUR",
      budgetBand: "1000_2500",
      creatorsWanted: 3,
      applicationsCloseOn: "2027-02-10",
      startsOn: "2027-03-01",
      requestedItems: ["motivation_message"],
      maxApplications: 40,
    });
    expect(draft.remunerationKind).toBe("cash");
    expect(draft.budgetBand).toBe("1000_2500");
    expect(draft.creatorsWanted).toBe(3);
    expect(draft.applicationsCloseOn).toBe("2027-02-10");
    expect(draft.contentDueOn).toBe("");
    expect(draft.startsOn).toBe("2027-03-01");
    expect(draft.endsOn).toBe("");
    expect(draft.requestedItems).toEqual(["motivation_message"]);
    expect(draft.maxApplications).toBe(40);
    // no field of the form types the total budget, nor holds a verified-only switch (RG79, EC-L3B-10-1)
    expect(DRAFT_KEYS).not.toContain("totalBudgetMinor");
    expect(DRAFT_KEYS).not.toContain("verifiedOnly");
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

  it("empties both bands with the currency, in the same save (a band of another grid is refused by the base)", () => {
    const priced = { ...sent, budgetBand: "1000_2500" };
    const next = applyChange(priced, "currency", "USD");
    expect(next.budgetBand).toBeNull();
    expect(planPatch(next, priced).body).toEqual({
      currency: "USD",
      productValueBand: null,
      budgetBand: null,
    });
  });

  it("asks no band of budget for a gift only, and empties the one chosen (CA76)", () => {
    const priced = {
      ...sent,
      remunerationKind: "cash_and_gift",
      budgetBand: "500_1000",
    };
    expect(isGiftOnly(priced)).toBe(false);
    const next = applyChange(priced, "remunerationKind", "gift_only");
    expect(isGiftOnly(next)).toBe(true);
    expect(next.budgetBand).toBeNull();
    expect(planPatch(next, priced).body).toEqual({
      remunerationKind: "gift_only",
      budgetBand: null,
    });
    // another nature keeps the band
    expect(applyChange(priced, "remunerationKind", "cash").budgetBand).toBe(
      "500_1000",
    );
    expect(isConditionallyRequired("budgetBand", priced)).toBe(true);
    expect(isConditionallyRequired("budgetBand", next)).toBe(false);
    expect(isConditionallyRequired("budgetBand", sent)).toBe(false);
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
      "remunerationKind",
      "usageRights",
      "usageRightsTerritoryScope",
    ]);
    expect(Object.keys(RELATED_ERROR_KEYS).sort()).toEqual([
      "applicationsCloseOn",
      "campaignType",
      "contentDueOn",
      "endsOn",
      "productIsSent",
      "startsOn",
      "usageRights",
    ]);
    expect(RELATED_ERROR_KEYS.campaignType).toEqual(["usageRights"]);
    expect(RELATED_ERROR_KEYS.usageRights).toEqual(["campaignType"]);
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
    expect(fieldErrorOf(refused(["date_order"]))).toBe("dateOrder");
    expect(fieldErrorOf(refused(["window_too_long"]))).toBe("windowTooLong");
  });

  it("falls back to an invalid value for any other answer", () => {
    expect(fieldErrorOf(refused([]))).toBe("invalid");
    expect(fieldErrorOf(refused(["something_else"]))).toBe("invalid");
    expect(fieldErrorOf({ kind: "failed" })).toBe("invalid");
  });

  it("has a sentence, in both languages, for each reason", () => {
    for (const copy of [frCampaign, enCampaign]) {
      expect(Object.keys(copy.fieldErrors).sort()).toEqual([
        "dateOrder",
        "duplicate",
        "formatNetworkMismatch",
        "giftRequiresProduct",
        "invalid",
        "notApplicable",
        "required",
        "tooLong",
        "ugcRequiresRights",
        "unknown",
        "windowTooLong",
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
    expect(stepOfParameter("4")).toBe(4);
    expect(stepOfParameter("5")).toBe(5);
    for (const value of [undefined, "", "0", "6", "x", "2.5"]) {
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

describe("L3B-E2 the calendar: the order of the four dates and the length of the period (RG70, RG74)", () => {
  const sound: CampaignDraft = {
    ...EMPTY,
    applicationsCloseOn: "2027-02-10",
    contentDueOn: "2027-02-20",
    startsOn: "2027-03-01",
    endsOn: "2027-04-01",
  };

  it("names the pair of dates out of order, from the domain's own rule", () => {
    expect(dateConflictsOf(sound)).toEqual([]);
    expect(dateConflictsOf({ ...sound, startsOn: "2027-02-01" })).toEqual([
      { earlier: "applicationsCloseOn", later: "startsOn" },
      { earlier: "contentDueOn", later: "startsOn" },
    ]);
    // a date not entered conflicts with nothing: it is missing, which is another message
    expect(dateConflictsOf({ ...EMPTY, endsOn: "2027-02-01" })).toEqual([]);
  });

  it("keeps a date out of order on the screen and never sends it, naming it as in conflict", () => {
    const draft = { ...sound, startsOn: "2027-02-01" };
    const plan = planPatch(draft, { ...sound });
    expect(plan.body).toBeNull();
    expect(plan.refused).toEqual({ startsOn: "dateOrder" });
  });

  it("sends the dates together once they hold together, whatever the order they were typed in", () => {
    const saved = { ...EMPTY };
    const plan = planPatch(sound, saved);
    expect(plan.keys).toEqual([
      "applicationsCloseOn",
      "contentDueOn",
      "startsOn",
      "endsOn",
    ]);
    expect(plan.body).toEqual({
      applicationsCloseOn: "2027-02-10",
      contentDueOn: "2027-02-20",
      startsOn: "2027-03-01",
      endsOn: "2027-04-01",
    });
    // a date cleared empties the field
    expect(planPatch({ ...sound, contentDueOn: "" }, sound).body).toEqual({
      contentDueOn: null,
    });
  });

  it("refuses a publication period of more than 12 months", () => {
    const draft = { ...sound, endsOn: "2028-03-02" };
    expect(planPatch(draft, sound).refused).toEqual({
      endsOn: "windowTooLong",
    });
    expect(
      planPatch({ ...sound, endsOn: "2028-03-01" }, sound).refused,
    ).toEqual({});
  });

  it("settles the refusal of a date by a change of another one", () => {
    for (const key of [
      "applicationsCloseOn",
      "contentDueOn",
      "startsOn",
      "endsOn",
    ] as const) {
      expect(RELATED_ERROR_KEYS[key]).toHaveLength(3);
      expect(RELATED_ERROR_KEYS[key]).not.toContain(key);
    }
  });

  it("names both dates in a sentence in each language, the first one opening it", () => {
    for (const copy of [frCampaign, enCampaign]) {
      expect(copy.errors.datesOrder).toContain("{first}");
      expect(copy.errors.datesOrder).toContain("{second}");
      for (const key of [
        "applicationsCloseOn",
        "contentDueOn",
        "startsOn",
        "endsOn",
      ] as const) {
        expect(copy.fields[key].label.length).toBeGreaterThan(5);
      }
    }
  });
});

describe("L3B-E2 the submission names what is missing, step by step (RG4, CA3)", () => {
  const MISSING = [
    "title",
    "usageRightsTerritory",
    "audienceTopics",
    "budgetBand",
    "applicationsCloseOn",
    "endsOn",
  ] as const;

  it("points the territory at its scope until it is chosen, then at its countries", () => {
    expect(missingKeyOf("usageRightsTerritory", EMPTY)).toBe(
      "usageRightsTerritoryScope",
    );
    expect(
      missingKeyOf("usageRightsTerritory", {
        ...EMPTY,
        usageRightsTerritoryScope: "selected_countries",
      }),
    ).toBe("usageRightsTerritories");
    expect(missingKeyOf("title", EMPTY)).toBe("title");
  });

  it("groups the missing fields by step, in the order of the form, none for a step that lacks nothing", () => {
    expect(missingGroups(MISSING, EMPTY)).toEqual([
      { step: 1, keys: ["title"] },
      { step: 2, keys: ["usageRightsTerritoryScope"] },
      { step: 3, keys: ["audienceTopics"] },
      { step: 4, keys: ["budgetBand"] },
      { step: 5, keys: ["applicationsCloseOn", "endsOn"] },
    ]);
    expect(missingGroups([], EMPTY)).toEqual([]);
  });

  it("sends the focus to the first missing field", () => {
    expect(firstMissing(MISSING, EMPTY)).toEqual({ step: 1, key: "title" });
    expect(firstMissing(["endsOn", "budgetBand"], EMPTY)).toEqual({
      step: 4,
      key: "budgetBand",
    });
    expect(firstMissing([], EMPTY)).toBeNull();
  });

  it("names every missing field as an error of the form once a submission asked, and no other", () => {
    expect(missingErrors(["title", "endsOn"], EMPTY)).toEqual({
      title: "required",
      endsOn: "required",
    });
    expect(missingErrors([], EMPTY)).toEqual({});
  });

  it("finds the fields a refusal holds on the screen and the API does not hold", () => {
    const saved = { ...EMPTY };
    const draft = {
      ...EMPTY,
      campaignType: "ugc_delivered",
      title: "Un titre",
    };
    expect(
      unsavedInError(draft, saved, { campaignType: "ugcRequiresRights" }),
    ).toEqual(["campaignType"]);
    // an error on a field the screen gave up (back to what the API holds) is no obstacle
    expect(
      unsavedInError(saved, saved, { campaignType: "ugcRequiresRights" }),
    ).toEqual([]);
    expect(unsavedInError(draft, saved, {})).toEqual([]);
  });

  it("sends a submission to the first refused field in the order of the screen, whatever the order of the errors", () => {
    const saved = { ...EMPTY };
    const draft = {
      ...EMPTY,
      title: "x".repeat(3),
      campaignType: "ugc_delivered",
      startsOn: "2027-02-01",
      budgetBand: "1000_2500",
    };
    const errors = {
      startsOn: "dateOrder",
      budgetBand: "invalid",
      campaignType: "ugcRequiresRights",
    } as const;
    expect(firstInvalid(draft, saved, errors)).toEqual({
      step: 1,
      key: "campaignType",
    });
    expect(invalidFields(draft, saved, errors)).toEqual([
      { step: 1, key: "campaignType" },
      { step: 4, key: "budgetBand" },
      { step: 5, key: "startsOn" },
    ]);
    // the currency is drawn in step 4 until a product is sent
    expect(
      firstInvalid({ ...draft, currency: "EUR" }, saved, {
        currency: "invalid",
        startsOn: "dateOrder",
      }),
    ).toEqual({ step: 4, key: "currency" });
  });

  it("finds no field to go to when nothing refused is left on the screen", () => {
    const saved = { ...EMPTY };
    expect(firstInvalid(EMPTY, saved, {})).toBeNull();
    expect(
      firstInvalid(saved, saved, { campaignType: "ugcRequiresRights" }),
    ).toBeNull();
  });

  it("draws the currency in step 4 always, in step 1 once a product is sent, and every other field in its own step", () => {
    expect(isKeyOfStep("currency", 4, EMPTY)).toBe(true);
    expect(isKeyOfStep("currency", 1, EMPTY)).toBe(false);
    expect(isKeyOfStep("currency", 1, { ...EMPTY, productIsSent: true })).toBe(
      true,
    );
    expect(isKeyOfStep("budgetBand", 4, EMPTY)).toBe(true);
    expect(isKeyOfStep("budgetBand", 5, EMPTY)).toBe(false);
    expect(isKeyOfStep("endsOn", 5, EMPTY)).toBe(true);
  });

  it("asks the required fields of steps 4 and 5 as required", () => {
    for (const key of [
      "currency",
      "remunerationKind",
      "creatorsWanted",
      "applicationsCloseOn",
      "startsOn",
      "endsOn",
    ] as const) {
      expect(isRequired(key, EMPTY), key).toBe(true);
    }
    for (const key of [
      "contentDueOn",
      "requestedItems",
      "maxApplications",
    ] as const) {
      expect(isRequired(key, EMPTY), key).toBe(false);
    }
  });
});

describe("L3B-E2 the texts of the budget: the brand's band, the creator's mention, no figure (D48, D78)", () => {
  it("has the three sentences of the pilot regime in both languages, as 09 RG109 words them", () => {
    expect(frCampaign.budget.bandBrand).toContain("commission INFLUX incluse");
    expect(frCampaign.budget.negotiate).toBe(
      "À négocier avec votre commercial.",
    );
    expect(frCampaign.budget.internalPilot).toBe(
      "Votre budget n'est jamais publié : seul votre commercial INFLUX le voit.",
    );
    expect(enCampaign.budget.negotiate).toBe(
      "To be negotiated with your account manager.",
    );
    expect(enCampaign.budget.internalPilot).toBe(
      "Your budget is never published: only your INFLUX account manager sees it.",
    );
  });

  it("labels the four natures of the compensation and the four items asked of an application", () => {
    for (const copy of [frCampaign, enCampaign]) {
      expect(Object.keys(copy.remuneration)).toEqual([
        "cash",
        "cash_and_gift",
        "gift_only",
        "affiliate",
      ]);
      expect(Object.keys(copy.requested_item)).toEqual([
        "motivation_message",
        "past_content_examples",
        "concept_proposal",
        "availability",
      ]);
    }
  });

  it("says in words what a missing submission and a sent one are, both languages", () => {
    for (const copy of [frCampaign, enCampaign]) {
      for (const key of [
        "missing",
        "ready",
        "button",
        "submittedTitle",
        "declarationRequired",
        "unsaved",
        "invalid",
      ] as const) {
        expect(copy.publish[key].length, key).toBeGreaterThan(10);
      }
    }
    expect(frCampaign.publish.missing).toContain("{count, plural");
    expect(frCampaign.publish.missing).toContain("{fields}");
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
