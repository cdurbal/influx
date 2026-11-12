// What the preview "ce que voit une marque" shows of the projection (docs/mvp/07 RG16, RG49, RG84, RG102,
// RG103, RG104, RG113; 17 §5.2, §7.1; jalons/l2g, commit 14): the view renders every field the API serves
// and no other, in both tabs; the "before" tab holds no handle, no URL and no exact figure; a card with no
// approved visual has no image; the three priority metrics open a line; an observed line says its exact
// figures are not read here; every code of the closed lists has its text in French and in English. Pure
// functions, no browser.
import {
  creatorProjectionAfterSchema,
  creatorProjectionBeforeSchema,
  creatorProjectionIdentifiedNetworkSchema,
  creatorProjectionNetworkSchema,
  type CreatorPreviewResponse,
  type CreatorProjectionAfter,
  type CreatorProjectionBefore,
  type CreatorProjectionIdentifiedNetwork,
  type CreatorProjectionNetwork,
} from "@influx/contracts/creator-projection";
import { describe, expect, it } from "vitest";
import {
  afterEmptyOf,
  PREVIEW_VISUALS_SHOWN,
  previewCardOf,
  renderedFieldsOf,
  type PreviewLabels,
} from "@/components/creator-profile/creator-preview-view";
import enCreatorProfile from "@/locales/en/creator-profile.json";
import frCreatorProfile from "@/locales/fr/creator-profile.json";

const ID = (digit: string) =>
  `${digit.repeat(8)}-aaaa-4aaa-8aaa-${digit.repeat(12)}`;

type Json = { [key: string]: Json | string };

/** The texts of a locale file as `t()` reads them: a missing key is a failure of the test, never a blank. */
function labelsOf(messages: Json): PreviewLabels {
  const read = (key: string): string | null => {
    let node: Json | string = messages;
    for (const part of key.split(".")) {
      if (typeof node === "string" || !(part in node)) {
        return null;
      }
      node = node[part] as Json | string;
    }
    return typeof node === "string" ? node : null;
  };
  const text: PreviewLabels["text"] = (key, values) => {
    const found = read(key);
    if (found === null) {
      throw new Error(`missing text: ${key}`);
    }
    return found.replace(/\{(\w+)\}/g, (_, name: string) =>
      String(values?.[name] ?? `{${name}}`),
    );
  };
  return {
    text,
    has: (key) => read(key) !== null,
    topic: (code) => `topic:${code}`,
    network: (code) => `network:${code}`,
    format: (code) => `format:${code}`,
    usageRight: (code) => `right:${code}`,
    exclusivity: (code) => `exclusivity:${code}`,
    country: (code) => `country:${code}`,
    language: (code) => `language:${code}`,
    date: (iso) => `date:${iso.slice(0, 10)}`,
    count: (value) => `n${value}`,
  };
}

const FR = labelsOf(frCreatorProfile as unknown as Json);
const EN = labelsOf(enCreatorProfile as unknown as Json);

const DECLARED_LINE: CreatorProjectionNetwork = {
  networkCode: "instagram",
  isPrimary: true,
  audienceBand: "micro",
  reachBand: "nano",
  publicationFrequency: "several_per_week",
  commentBand: "50_199",
  engagementBand: "3_6",
  figuresSource: "declared",
  figuresMeasuredAt: "2026-11-02T10:00:00.000Z",
  badges: [
    { level: "account_verified", since: "2026-10-12T09:00:00.000Z" },
    { level: "audience_verified", since: "2026-10-20T09:00:00.000Z" },
  ],
};

const OBSERVED_LINE: CreatorProjectionNetwork = {
  networkCode: "tiktok",
  isPrimary: false,
  audienceBand: "nano",
  reachBand: null,
  publicationFrequency: "weekly",
  commentBand: "10_49",
  engagementBand: null,
  figuresSource: "agent_observed",
  figuresMeasuredAt: "2026-10-25T10:00:00.000Z",
  badges: [],
};

const BEFORE: CreatorProjectionBefore = {
  alias: "7K3M",
  headline: "Créatrice de tutoriels cuisine végétale du quotidien",
  bio: "Je partage des recettes simples, de saison.",
  primaryTopic: "food",
  secondaryTopics: ["lifestyle"],
  tones: ["educational", "unwritten_tone"],
  publicationLanguages: ["fr", "en"],
  residenceCountry: "FR",
  travelScope: "domestic",
  collaborationExperience: "1_5",
  mainAudienceCountry: "FR",
  mainAudienceShareBand: "ge_80",
  audienceGenderBand: "female_majority",
  audienceBands: [
    { dimension: "country", code: "BE", shareBand: "10_25" },
    { dimension: "age", code: "25_34", shareBand: "gt_50" },
  ],
  formats: ["instagram_reel", "ugc_video"],
  usageRights: [
    { code: "organic_repost", inclusion: "included" },
    { code: "paid_whitelisting", inclusion: "optional" },
  ],
  deliveryLead: "7_14d",
  maxExclusivity: "le_1m",
  acceptsNonMonetary: false,
  availability: "lt_1m",
  networks: [DECLARED_LINE, OBSERVED_LINE],
  visuals: [1, 2, 3, 4, 5].map((order) => ({
    id: ID(String(order)),
    order,
    caption: order === 1 ? "Mon plat du jour" : null,
  })),
};

const IDENTIFIED_DECLARED: CreatorProjectionIdentifiedNetwork = {
  ...DECLARED_LINE,
  handle: "secret_handle",
  profileUrl: "https://www.instagram.com/secret_handle",
  followersCount: 48123,
  postsLast30Days: 12,
  avgCommentsPerPost: 87,
  avgReachPerPost: 9100,
};

// EC-L2G-09-3: an observed line serves no exact figure to the creator's own session
const IDENTIFIED_OBSERVED: CreatorProjectionIdentifiedNetwork = {
  ...OBSERVED_LINE,
  handle: "secret_tok",
  profileUrl: "https://www.tiktok.com/@secret_tok",
  followersCount: null,
  postsLast30Days: null,
  avgCommentsPerPost: null,
  avgReachPerPost: null,
};

const AFTER: CreatorProjectionAfter = {
  ...BEFORE,
  networks: [IDENTIFIED_DECLARED, IDENTIFIED_OBSERVED],
  audienceShares: [
    { dimension: "country", code: "FR", share: 72 },
    { dimension: "age", code: "25_34", share: 55 },
    { dimension: "gender", code: "female", share: 64 },
  ],
};

const PREVIEW: CreatorPreviewResponse = {
  published: true,
  before: BEFORE,
  after: AFTER,
};

/** The keys the contract serves: what the view must render, no more, no less. */
const BEFORE_FIELDS = [
  ...Object.keys(creatorProjectionBeforeSchema.shape),
  ...Object.keys(creatorProjectionNetworkSchema.shape),
];
const AFTER_FIELDS = [
  ...Object.keys(creatorProjectionAfterSchema.shape),
  ...Object.keys(creatorProjectionIdentifiedNetworkSchema.shape),
];

function sorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

describe("L2G-14: the view renders every field the API serves, and no other (RG104)", () => {
  it("renders each key of layer A in the tab before, and only those", () => {
    const card = previewCardOf(PREVIEW, "before", FR);
    expect(sorted(renderedFieldsOf(card))).toEqual(sorted(BEFORE_FIELDS));
  });

  it("renders each key of layer A and of layer I in the tab after, and only those", () => {
    const card = previewCardOf(PREVIEW, "after", FR);
    expect(sorted(renderedFieldsOf(card))).toEqual(sorted(AFTER_FIELDS));
  });

  it("renders the same fields in English as in French", () => {
    for (const tab of ["before", "after"] as const) {
      expect(sorted(renderedFieldsOf(previewCardOf(PREVIEW, tab, EN)))).toEqual(
        sorted(renderedFieldsOf(previewCardOf(PREVIEW, tab, FR))),
      );
    }
  });

  it("shows nothing for a field the API serves empty (no invented value)", () => {
    const empty: CreatorProjectionBefore = {
      alias: "9Z2P",
      headline: null,
      bio: null,
      primaryTopic: null,
      secondaryTopics: [],
      tones: [],
      publicationLanguages: [],
      residenceCountry: "FR",
      travelScope: null,
      collaborationExperience: null,
      mainAudienceCountry: null,
      mainAudienceShareBand: null,
      audienceGenderBand: null,
      audienceBands: [],
      formats: [],
      usageRights: [],
      deliveryLead: null,
      maxExclusivity: null,
      acceptsNonMonetary: false,
      availability: null,
      networks: [],
      visuals: [],
    };
    const card = previewCardOf(
      {
        published: false,
        before: empty,
        after: { ...empty, networks: [], audienceShares: [] },
      },
      "after",
      FR,
    );
    expect(sorted(renderedFieldsOf(card))).toEqual([
      "acceptsNonMonetary",
      "alias",
      "residenceCountry",
    ]);
  });
});

describe("L2G-14: what a brand cannot read before an introduction (RG102)", () => {
  it("holds no handle, no address and no exact figure in the tab before", () => {
    const card = JSON.stringify(previewCardOf(PREVIEW, "before", FR));
    for (const secret of [
      "secret_handle",
      "secret_tok",
      "instagram.com",
      "tiktok.com",
      "n48123",
      "n9100",
      "n87",
      "n72",
    ]) {
      expect(card, secret).not.toContain(secret);
    }
  });

  it("tells the exact figures beside their band, with the source and the date, in the tab after", () => {
    const card = previewCardOf(PREVIEW, "after", FR);
    const [followers, rhythm, comments, reach] =
      card.networks[0]?.metrics ?? [];
    expect(followers).toMatchObject({
      field: "audienceBand",
      exact: "chiffre exact : n48123",
    });
    expect(rhythm).toMatchObject({
      field: "publicationFrequency",
      exact: "chiffre exact : n12",
    });
    expect(comments).toMatchObject({
      field: "commentBand",
      exact: "chiffre exact : n87",
    });
    expect(reach).toMatchObject({
      field: "reachBand",
      exact: "chiffre exact : n9100",
    });
    expect(card.networks[0]?.identity.map((entry) => entry.value)).toEqual([
      "secret_handle",
      "https://www.instagram.com/secret_handle",
    ]);
    expect(card.networks[0]?.figures).toBe(
      "Déclarés par le créateur · chiffres au date:2026-11-02",
    );
    expect(card.shares.map((entry) => entry.value)).toEqual([
      "n72 %",
      "n55 %",
      "n64 %",
    ]);
  });

  it("says that the exact figures of an observed line are not read here, and invents none", () => {
    const card = previewCardOf(PREVIEW, "after", FR);
    const observed = card.networks[1];
    expect(observed?.observedNote).toBe(frCreatorProfile.preview.observed);
    expect(observed?.metrics.every((metric) => metric.exact === null)).toBe(
      true,
    );
    expect(observed?.figures).toBe(
      "Constatés par INFLUX · chiffres au date:2026-10-25",
    );
    expect(card.networks[0]?.observedNote).toBeNull();
    expect(
      previewCardOf(PREVIEW, "before", FR).networks[1]?.observedNote,
    ).toBeNull();
  });
});

describe("L2G recette: the tab after says when it reveals nothing, and marks what it reveals", () => {
  it("marks an exact figure as revealed, beside its band or alone, and never in the tab before", () => {
    const after = previewCardOf(PREVIEW, "after", FR);
    const declared = after.networks[0];
    expect(
      declared?.metrics.filter((metric) => metric.revealed).map((m) => m.field),
    ).toEqual([
      "audienceBand",
      "publicationFrequency",
      "commentBand",
      "reachBand",
    ]);
    expect(after.networks[1]?.metrics.some((metric) => metric.revealed)).toBe(
      false,
    );
    const alone = previewCardOf(
      {
        ...PREVIEW,
        after: {
          ...AFTER,
          networks: [{ ...IDENTIFIED_DECLARED, audienceBand: null }],
        },
      },
      "after",
      FR,
    ).networks[0]?.metrics[0];
    expect(alone).toMatchObject({
      value: "n48123",
      exact: null,
      revealed: true,
    });
    const before = previewCardOf(PREVIEW, "before", FR);
    expect(
      before.networks
        .flatMap((network) => network.metrics)
        .some((m) => m.revealed),
    ).toBe(false);
  });

  it("reveals something when a line, an exact figure or an exact share is served", () => {
    expect(afterEmptyOf(previewCardOf(PREVIEW, "after", FR))).toBeNull();
    // an observed line still reveals its handle and its address
    const observedOnly = previewCardOf(
      {
        ...PREVIEW,
        after: {
          ...AFTER,
          networks: [IDENTIFIED_OBSERVED],
          audienceShares: [],
        },
      },
      "after",
      FR,
    );
    expect(afterEmptyOf(observedOnly)).toBeNull();
  });

  it("says why the tab after is the tab before: no listed line, or nothing identified on the lines", () => {
    const noNetwork = previewCardOf(
      {
        ...PREVIEW,
        before: { ...BEFORE, networks: [] },
        after: { ...AFTER, networks: [], audienceShares: [] },
      },
      "after",
      FR,
    );
    expect(afterEmptyOf(noNetwork)).toBe("noNetwork");
    const bare: CreatorProjectionIdentifiedNetwork = {
      ...IDENTIFIED_OBSERVED,
      handle: null,
      profileUrl: null,
    };
    const nothing = previewCardOf(
      { ...PREVIEW, after: { ...AFTER, networks: [bare], audienceShares: [] } },
      "after",
      FR,
    );
    expect(afterEmptyOf(nothing)).toBe("nothingIdentified");
    for (const labels of [FR, EN]) {
      for (const reason of ["noNetwork", "nothingIdentified"]) {
        expect(labels.has(`preview.afterEmpty.${reason}`)).toBe(true);
      }
    }
    expect(FR.has("layer.revealed") && EN.has("layer.revealed")).toBe(true);
  });
});

describe("L2G-14: the card (17 §7.1, RG84, RG113)", () => {
  it("shows the first three visuals in the creator's order, the caption beside the visual", () => {
    const card = previewCardOf(PREVIEW, "before", FR);
    expect(PREVIEW_VISUALS_SHOWN).toBe(3);
    expect(card.visuals).toEqual([
      { id: ID("1"), position: 1, caption: "Mon plat du jour" },
      { id: ID("2"), position: 2, caption: null },
      { id: ID("3"), position: 3, caption: null },
    ]);
  });

  it("has no image when no visual is approved, and still the rest of the card (RG5, RG84)", () => {
    const card = previewCardOf(
      {
        published: false,
        before: { ...BEFORE, visuals: [] },
        after: { ...AFTER, visuals: [] },
      },
      "before",
      FR,
    );
    expect(card.visuals).toEqual([]);
    expect(card.headline).toBe(BEFORE.headline);
    expect(renderedFieldsOf(card)).not.toContain("visuals");
  });

  it("opens each line with the three priority metrics in their order, the engagement only when served (RG48, RG113)", () => {
    const card = previewCardOf(PREVIEW, "before", FR);
    expect(card.networks[0]?.metrics.map((metric) => metric.field)).toEqual([
      "audienceBand",
      "publicationFrequency",
      "commentBand",
      "reachBand",
      "engagementBand",
    ]);
    expect(card.networks[1]?.metrics.map((metric) => metric.field)).toEqual([
      "audienceBand",
      "publicationFrequency",
      "commentBand",
    ]);
  });

  it("dates each badge and the figures, and says an undated figure undated (RG49)", () => {
    const card = previewCardOf(PREVIEW, "before", FR);
    expect(card.networks[0]?.badges.map((badge) => badge.text)).toEqual([
      "Compte vérifié le date:2026-10-12",
      "Audience vérifiée le date:2026-10-20",
    ]);
    const undated = previewCardOf(
      {
        ...PREVIEW,
        before: {
          ...BEFORE,
          networks: [{ ...DECLARED_LINE, figuresMeasuredAt: null }],
        },
      },
      "before",
      EN,
    );
    expect(undated.networks[0]?.figures).toBe(
      "Declared by the creator · figures not dated",
    );
  });

  it("shows a code with no label as itself, never an invented text", () => {
    const card = previewCardOf(PREVIEW, "before", FR);
    expect(card.profile.find((entry) => entry.field === "tones")?.value).toBe(
      "Pédagogique, unwritten_tone",
    );
  });

  it("splits the rights by how they are offered and answers yes or no for the counterpart", () => {
    const card = previewCardOf(PREVIEW, "before", EN);
    const rows = card.offer.filter((entry) => entry.field === "usageRights");
    expect(rows.map((entry) => [entry.label, entry.value])).toEqual([
      [enCreatorProfile.fields.usageIncluded.label, "right:organic_repost"],
      [enCreatorProfile.fields.usageOptional.label, "right:paid_whitelisting"],
    ]);
    expect(
      card.offer.find((entry) => entry.field === "acceptsNonMonetary")?.value,
    ).toBe(enCreatorProfile.field.no);
  });

  it("carries no amount, rate, net or currency (D48, D78, RG103)", () => {
    for (const tab of ["before", "after"] as const) {
      const text = JSON.stringify(previewCardOf(PREVIEW, tab, FR));
      expect(text).not.toMatch(/€|\$|\b(?:EUR|USD)\b|\bnet\b|commission/i);
    }
  });
});

describe("L2G-14: every code of the closed lists has its text, in both languages", () => {
  const GROUPS: Record<string, readonly string[]> = {
    "preview.share": ["ge_80", "50_80", "lt_50", "10_25", "25_50", "gt_50"],
    "preview.gender": [
      "female_majority",
      "male_majority",
      "mixed",
      "female",
      "male",
      "other",
    ],
    "preview.age": ["18_24", "25_34", "35_44", "45_plus"],
    "preview.engagementBand": ["under_1", "1_3", "3_6", "6_plus"],
    "preview.source": ["declared", "agent_observed"],
    "preview.badge": ["account_verified", "audience_verified"],
  };

  it("has a text for each band, gender, age, source and badge", () => {
    for (const labels of [FR, EN]) {
      for (const [group, codes] of Object.entries(GROUPS)) {
        for (const code of codes) {
          expect(labels.has(`${group}.${code}`), `${group}.${code}`).toBe(true);
        }
      }
    }
  });

  it("has the same keys in French and in English", () => {
    const keysOf = (node: Json, prefix = ""): string[] =>
      Object.entries(node).flatMap(([key, value]) =>
        typeof value === "string"
          ? [`${prefix}${key}`]
          : keysOf(value, `${prefix}${key}.`),
      );
    expect(keysOf(frCreatorProfile.preview as unknown as Json)).toEqual(
      keysOf(enCreatorProfile.preview as unknown as Json),
    );
  });

  it("reads only keys that exist while building the full card in both languages", () => {
    for (const labels of [FR, EN]) {
      for (const tab of ["before", "after"] as const) {
        expect(() => previewCardOf(PREVIEW, tab, labels)).not.toThrow();
      }
    }
  });

  it("uses the words of the page for the title and the two tabs (textes.md)", () => {
    expect(frCreatorProfile.preview.title).toBe("Ce que voit une marque");
    expect(frCreatorProfile.preview.before).toBe("Avant la mise en relation");
    expect(frCreatorProfile.preview.after).toBe("Après la mise en relation");
    expect(enCreatorProfile.preview.title).toBe("What a brand sees");
    expect(enCreatorProfile.preview.before).toBe("Before an introduction");
    expect(enCreatorProfile.preview.after).toBe("After an introduction");
  });
});
