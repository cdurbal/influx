// "What a creator sees" of a campaign (docs/mvp/09 RG102, CA15, CA68; D48, D78; jalons/l3b, commit 11): the
// rows drawn from the answer of the creator view and from nothing else, no row for what the answer does not
// hold, the nature of the consideration and the notice and never a figure, the brand as published, and the
// texts of the translation files that no row may lack. Pure functions, no browser.
import {
  campaignCreatorViewResponseSchema,
  type CampaignCreatorViewResponse,
} from "@influx/contracts/campaign-creator-view";
import { describe, expect, it } from "vitest";
import enBrandProfile from "@/locales/en/brand-profile.json";
import enCampaign from "@/locales/en/campaign.json";
import frBrandProfile from "@/locales/fr/brand-profile.json";
import frCampaign from "@/locales/fr/campaign.json";
import {
  BRAND_OPTION_GROUPS,
  previewBrandOf,
  previewOriginOf,
  previewOriginQuery,
  previewSectionsOf,
  type PreviewLabels,
  type PreviewRow,
} from "@/components/campaign/campaign-preview-view";

/** Labels that write where each word comes from, so that a row is traced to its source. */
const LABELS: PreviewLabels = {
  row: (scope, key) => `${scope}:${key}`,
  option: (group, code) => `${group}/${code}`,
  country: (code) => `country/${code}`,
  language: (code) => `language/${code}`,
  civilDate: (date) => `date/${date}`,
  yes: "yes",
  no: "no",
  deliverable: (quantity, network, format) =>
    `${quantity}x ${network} ${format}`,
  nature: (kind) => `nature/${kind}`,
  notice: "notice",
  section: (id) => `section/${id}`,
  badge: (since) => `badge/${since}`,
};

const CREATOR_VIEW = {
  title: "Test de notre gamme",
  campaignType: "product_review",
  publicSummary: "Un résumé public.",
  brief: "Un brief.\nSur deux lignes.",
  productDescription: "Trois soins du visage.",
  productSector: "beauty_personal_care",
  restrictions: "Pas de promesse excessive.",
  keyMessages: ["Un message clé de plus de dix caractères"],
  productIsSent: true,
  creatorKeepsProduct: false,
  shippingCostsBorneBy: "brand",
  deliverables: [
    { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
  ],
  networks: ["instagram"],
  usageRights: "organic_repost",
  usageRightsDuration: "3m",
  usageRightsTerritoryScope: "selected_countries",
  usageRightsTerritories: ["FR", "BE"],
  exclusivity: "le_1m",
  contentReviewDelay: "5bd",
  audienceCountries: ["FR"],
  audienceLanguages: ["fr"],
  audienceTopics: ["beauty"],
  audienceBands: ["micro"],
  audienceAgeBands: ["25_34"],
  audienceGender: "mixed",
  remunerationKind: "cash",
  creatorsWanted: 3,
  applicationsCloseOn: "2027-02-10",
  contentDueOn: "2027-02-20",
  startsOn: "2027-03-01",
  endsOn: "2027-04-01",
  requestedItems: ["motivation_message"],
} as const;

const BRAND_VIEW: NonNullable<CampaignCreatorViewResponse["brand"]> = {
  companyName: "Maison Aurore",
  hasLogo: true,
  primarySector: "beauty_personal_care",
  secondarySectors: ["fashion"],
  companySize: "11_50",
  country: "FR",
  targetMarkets: ["FR", "BE"],
  workingLanguages: ["fr"],
  website: "aurore.example",
  presentation: "Une maison de soins.",
  topics: ["beauty"],
  networks: ["instagram"],
  formats: ["instagram_reel"],
  audienceCountries: ["FR"],
  usageRights: ["organic_repost"],
  exclusivityBand: "le_1m",
  collaborationRhythm: "recurring",
  offersNonMonetary: true,
  contactRole: "marketing",
  badge: { since: "2026-11-01T10:00:00.000Z" },
};

function answer(
  overrides: Partial<CampaignCreatorViewResponse["campaign"]> = {},
  brand: CampaignCreatorViewResponse["brand"] = { ...BRAND_VIEW },
): CampaignCreatorViewResponse {
  // The fixture is the contract's own shape: a key the schema refuses fails here before it fails a row.
  return campaignCreatorViewResponseSchema.parse({
    campaign: { ...CREATOR_VIEW, ...overrides },
    remunerationNotice: "campaign.budget.negotiate",
    brand,
  });
}

const EMPTY_CAMPAIGN: Partial<CampaignCreatorViewResponse["campaign"]> = {
  title: null,
  campaignType: null,
  publicSummary: null,
  brief: null,
  productDescription: null,
  productSector: null,
  restrictions: null,
  keyMessages: [],
  productIsSent: null,
  creatorKeepsProduct: null,
  shippingCostsBorneBy: null,
  deliverables: [],
  networks: [],
  usageRights: null,
  usageRightsDuration: null,
  usageRightsTerritoryScope: null,
  usageRightsTerritories: [],
  exclusivity: null,
  contentReviewDelay: null,
  audienceCountries: [],
  audienceLanguages: [],
  audienceTopics: [],
  audienceBands: [],
  audienceAgeBands: [],
  audienceGender: null,
  remunerationKind: null,
  creatorsWanted: null,
  applicationsCloseOn: null,
  contentDueOn: null,
  startsOn: null,
  endsOn: null,
  requestedItems: [],
};

function rowsOf(sections: ReturnType<typeof previewSectionsOf>): PreviewRow[] {
  return sections.flatMap((section) => section.rows);
}

describe("L3B-11: the campaign as a creator sees it, from the answer alone (RG102, CA68)", () => {
  it("writes the sections in the order a creator reads them, each row from its own key of the answer", () => {
    const sections = previewSectionsOf(answer(), LABELS);
    expect(sections.map((section) => section.id)).toEqual([
      "offer",
      "product",
      "work",
      "audience",
      "remuneration",
      "calendar",
    ]);
    const byKey = Object.fromEntries(
      rowsOf(sections).map((row) => [row.key, row]),
    );
    expect(byKey.campaignType).toMatchObject({
      label: "campaign:campaignType",
      text: "campaign_type/product_review",
    });
    expect(byKey.brief).toMatchObject({
      kind: "paragraph",
      text: "Un brief.\nSur deux lignes.",
    });
    expect(byKey.keyMessages).toMatchObject({
      kind: "list",
      items: ["Un message clé de plus de dix caractères"],
    });
    expect(byKey.deliverables).toMatchObject({
      kind: "list",
      items: ["2x reference.network/instagram reference.format/instagram_reel"],
    });
    expect(byKey.usageRightsTerritories).toMatchObject({
      text: "country/FR, country/BE",
    });
    expect(byKey.productIsSent).toMatchObject({ text: "yes" });
    expect(byKey.creatorKeepsProduct).toMatchObject({ text: "no" });
    expect(byKey.startsOn).toMatchObject({ text: "date/2027-03-01" });
    expect(byKey.exclusivity).toMatchObject({ text: "exclusivity/le_1m" });
    expect(byKey.productSector).toMatchObject({
      text: "reference.sector/beauty_personal_care",
    });
  });

  it("makes no row for what the answer does not hold, and no section for a block that is empty", () => {
    const sections = previewSectionsOf(answer(EMPTY_CAMPAIGN), LABELS);
    // Nothing is left but the notice of the answer: the sections that hold only absences are gone.
    expect(sections.map((section) => section.id)).toEqual(["remuneration"]);
    expect(rowsOf(sections).map((row) => row.key)).toEqual([
      "remunerationNotice",
    ]);
    const partial = previewSectionsOf(
      answer({
        ...EMPTY_CAMPAIGN,
        brief: "   ",
        applicationsCloseOn: "2027-02-10",
      }),
      LABELS,
    );
    expect(partial.map((section) => section.id)).toEqual([
      "remuneration",
      "calendar",
    ]);
    expect(rowsOf(partial).map((row) => row.key)).not.toContain("brief");
  });

  it("shows the nature of the consideration then the notice, and never a figure, a band or a currency (D48, D78, CA68)", () => {
    const remuneration = previewSectionsOf(answer(), LABELS).find(
      (section) => section.id === "remuneration",
    );
    expect(remuneration?.rows).toEqual([
      {
        key: "remunerationKind",
        label: "campaign:remunerationKind",
        kind: "text",
        text: "nature/cash",
      },
      {
        key: "creatorsWanted",
        label: "campaign:creatorsWanted",
        kind: "text",
        text: "3",
      },
      {
        key: "remunerationNotice",
        label: "campaign:remunerationNotice",
        kind: "text",
        text: "notice",
      },
    ]);
    // The answer carries none of the internal fields, so the rows cannot: the keys drawn are the contract's.
    const drawn = rowsOf(previewSectionsOf(answer(), LABELS)).map(
      (row) => row.key,
    );
    for (const internal of [
      "budgetBand",
      "productValueBand",
      "currency",
      "internalReference",
      "budgetTotal",
      "maxApplications",
    ]) {
      expect(drawn).not.toContain(internal);
    }
  });

  it("draws the title as the heading of the page, not as a row", () => {
    expect(
      rowsOf(previewSectionsOf(answer(), LABELS)).map((r) => r.key),
    ).not.toContain("title");
  });
});

describe("L3B-11: the brand as a creator sees it (06 RG73, CA64, CA15)", () => {
  it("is none while the profile is not published", () => {
    expect(previewBrandOf(answer({}, null), LABELS)).toBeNull();
  });

  it("holds the public identity, the badge and the ROLE of the contact, never a coordinate", () => {
    const brand = previewBrandOf(answer(), LABELS);
    expect(brand).toMatchObject({
      name: "Maison Aurore",
      hasLogo: true,
      badge: "badge/2026-11-01T10:00:00.000Z",
    });
    const keys = brand?.rows.map((row) => row.key) ?? [];
    expect(keys).toContain("contactRole");
    expect(keys).toContain("website");
    for (const coordinate of [
      "contactFirstName",
      "contactEmail",
      "contactPhone",
      "contactUrl",
    ]) {
      expect(keys).not.toContain(coordinate);
    }
    expect(brand?.rows.find((row) => row.key === "website")).toMatchObject({
      kind: "text",
      text: "aurore.example",
    });
    expect(
      brand?.rows.find((row) => row.key === "offersNonMonetary"),
    ).toMatchObject({
      text: "yes",
    });
  });

  it("shows no badge without one, and no row for an empty value", () => {
    const brand = previewBrandOf(
      answer(
        {},
        {
          ...BRAND_VIEW,
          badge: null,
          presentation: null,
          website: null,
          secondarySectors: [],
          offersNonMonetary: null,
          contactRole: null,
        },
      ),
      LABELS,
    );
    expect(brand?.badge).toBeNull();
    const keys = brand?.rows.map((row) => row.key) ?? [];
    for (const absent of [
      "presentation",
      "website",
      "secondarySectors",
      "offersNonMonetary",
      "contactRole",
    ]) {
      expect(keys).not.toContain(absent);
    }
  });
});

describe("L3B-11: the words of the preview in both languages (04 R8, CA23)", () => {
  const rowKeys = rowsOf(previewSectionsOf(answer(), LABELS)).map(
    (row) => row.key,
  );

  it("has a label for every row of a whole answer, a title for every section, in French and English", () => {
    for (const copy of [frCampaign, enCampaign]) {
      for (const key of rowKeys) {
        expect(
          copy.preview.rows[key as keyof typeof copy.preview.rows],
          key,
        ).toEqual(expect.any(String));
      }
      for (const id of [
        "offer",
        "product",
        "work",
        "audience",
        "remuneration",
        "calendar",
      ] as const) {
        expect(copy.preview.sections[id], id).toEqual(expect.any(String));
      }
      expect(copy.meta.preview).toEqual(expect.any(String));
      expect(copy.preview.link).toEqual(expect.any(String));
    }
  });

  it("labels every row of the brand with the profile's own field label", () => {
    const brand = previewBrandOf(answer(), LABELS);
    for (const profile of [frBrandProfile, enBrandProfile]) {
      for (const row of brand?.rows ?? []) {
        expect(
          profile.fields[row.key as keyof typeof profile.fields],
          row.key,
        ).toMatchObject({ label: expect.any(String) });
      }
    }
  });

  it("writes no amount, rate or currency in the words of the preview", () => {
    for (const copy of [frCampaign, enCampaign]) {
      const text = JSON.stringify(copy.preview);
      expect(text).not.toMatch(/%|€|\$|£|\b(EUR|GBP|USD|CAD|CHF)\b/u);
    }
  });

  it("reads the shared vocabulary in the brand profile and the campaign's own lists in `campaign`", () => {
    expect([...BRAND_OPTION_GROUPS].sort()).toEqual([
      "companySize",
      "contactRole",
      "exclusivity",
      "reference.format",
      "reference.network",
      "reference.sector",
      "reference.topic",
      "reference.usage_right",
      "rhythm",
      "workingLanguage",
    ]);
  });
});

describe("L3B-fix-1: the way back of the preview returns where it was opened (L3BU-1)", () => {
  it("returns to the step the preview was opened from, and the link says it", () => {
    expect(previewOriginQuery(4)).toBe("?from=4");
    expect(previewOriginOf("4")).toEqual({ to: "campaign", step: 4 });
    expect(previewOriginOf(["2", "5"])).toEqual({ to: "campaign", step: 2 });
  });

  it("returns to the list when the preview was opened from the list", () => {
    expect(previewOriginQuery("list")).toBe("?from=list");
    expect(previewOriginOf("list")).toEqual({ to: "list" });
  });

  it("returns to the campaign itself when the origin is absent or unknown", () => {
    for (const value of [undefined, "", "0", "6", "step", "LIST", []]) {
      expect(previewOriginOf(value), String(value)).toEqual({
        to: "campaign",
        step: null,
      });
    }
  });
});
