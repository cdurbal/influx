import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_MAX_ITEMS,
  PORTFOLIO_REJECTION_REASON_CODES,
  portfolioCaptionBodySchema,
  portfolioImageResponseSchema,
  portfolioItemSchema,
  portfolioOrderBodySchema,
  portfolioUploadQuerySchema,
} from "../src/creator-portfolio.ts";
import {
  CREATOR_PROFILE_REQUIRED_FIELD_CODES,
  CREATOR_REJECTION_REASON_CODES,
  creatorProfileRefusalSchema,
  creatorVisibilityBodySchema,
  submitCreatorProfileResponseSchema,
} from "../src/creator-profile.ts";
import {
  creatorPreviewResponseSchema,
  creatorProjectionBeforeSchema,
} from "../src/creator-projection.ts";

const ID = "7d3f6a1e-5b8c-4f21-9a64-0c1e2b3d4f50";
const OTHER_ID = "0b9c8d7e-6f5a-4b3c-8d2e-1f0a9b8c7d6e";

const ITEM = {
  id: ID,
  state: "approved",
  displayOrder: 1,
  caption: "Un plat de saison",
  brandDeclared: false,
  width: 1200,
  height: 800,
  byteSize: 120_000,
  replacesItemId: null,
  replacementPending: false,
  captionPending: false,
  reasonCode: null,
  deleteAfter: null,
  createdAt: "2026-11-11T09:00:00.000Z",
  decidedAt: "2026-11-11T10:00:00.000Z",
};

describe("L2G-06 the visual of the portfolio and its routes (07 RG77, RG82, RG83)", () => {
  it("names the states a creator reads, and no key, checksum, agent or internal comment", () => {
    expect(portfolioItemSchema.safeParse(ITEM).success).toBe(true);
    for (const state of ["uploading", "purged"]) {
      expect(portfolioItemSchema.safeParse({ ...ITEM, state }).success).toBe(
        false,
      );
    }
    for (const extra of [
      { objectKey: "portfolio/a/b.webp" },
      { checksum: "abc" },
      { decidedBy: ID },
      { internalComment: "x" },
    ]) {
      expect(portfolioItemSchema.safeParse({ ...ITEM, ...extra }).success).toBe(
        false,
      );
    }
  });

  it("holds the closed grid of the refusal: nine reasons, no `other`", () => {
    expect([...PORTFOLIO_REJECTION_REASON_CODES]).toHaveLength(9);
    expect(PORTFOLIO_REJECTION_REASON_CODES).not.toContain("other");
    expect(
      portfolioItemSchema.safeParse({
        ...ITEM,
        state: "rejected",
        reasonCode: "other",
      }).success,
    ).toBe(false);
  });

  it("takes a caption of 200 characters at most, never blank, and a box that means nothing alone (RG82, RG83)", () => {
    const parse = (body: unknown) => portfolioCaptionBodySchema.safeParse(body);
    expect(parse({ caption: null, brandDeclared: false }).success).toBe(true);
    expect(
      parse({ caption: "a".repeat(200), brandDeclared: true }).success,
    ).toBe(true);
    expect(
      parse({ caption: "a".repeat(201), brandDeclared: false }).success,
    ).toBe(false);
    expect(
      parse({ caption: "🌿".repeat(201), brandDeclared: false }).success,
    ).toBe(false);
    expect(parse({ caption: "  ", brandDeclared: false }).success).toBe(false);
    expect(
      parse({ caption: "deux\nlignes", brandDeclared: false }).success,
    ).toBe(false);
    expect(parse({ caption: null, brandDeclared: true }).success).toBe(false);
    // the box is stated: absent is not "not ticked"
    expect(parse({ caption: "Un plat" }).success).toBe(false);
  });

  it("takes an order of one to eight distinct visuals, and a replacement named by its identifier only", () => {
    expect(portfolioOrderBodySchema.safeParse({ itemIds: [ID] }).success).toBe(
      true,
    );
    expect(
      portfolioOrderBodySchema.safeParse({ itemIds: [ID, ID] }).success,
    ).toBe(false);
    expect(portfolioOrderBodySchema.safeParse({ itemIds: [] }).success).toBe(
      false,
    );
    expect(
      portfolioOrderBodySchema.safeParse({
        itemIds: Array.from({ length: PORTFOLIO_MAX_ITEMS + 1 }, (_, i) =>
          i === 0 ? ID : `${OTHER_ID.slice(0, -1)}${i}`,
        ),
      }).success,
    ).toBe(false);
    expect(portfolioUploadQuerySchema.safeParse({}).success).toBe(true);
    expect(portfolioUploadQuerySchema.safeParse({ replaces: ID }).success).toBe(
      true,
    );
    expect(
      portfolioUploadQuerySchema.safeParse({ replaces: "not-an-id" }).success,
    ).toBe(false);
    expect(
      portfolioUploadQuerySchema.safeParse({ replaces: ID, name: "x.jpg" })
        .success,
    ).toBe(false);
  });

  it("relays an image as bounded base64 of a WebP, never an address", () => {
    const image = {
      contentType: "image/webp",
      width: 10,
      height: 10,
      byteSize: 4,
      data: "AAAAAA==",
    };
    expect(portfolioImageResponseSchema.safeParse(image).success).toBe(true);
    expect(
      portfolioImageResponseSchema.safeParse({ ...image, url: "https://x" })
        .success,
    ).toBe(false);
    expect(
      portfolioImageResponseSchema.safeParse({
        ...image,
        contentType: "image/png",
      }).success,
    ).toBe(false);
  });
});

describe("L2G-06 the submission, the refusal and the visibility of a creator profile (07 RG4, RG8, RG96)", () => {
  it("answers a submission with its state and what is still missing, in the codes of the form", () => {
    expect(
      submitCreatorProfileResponseSchema.safeParse({
        status: "draft",
        missing: ["portfolio", "accountVerified"],
      }).success,
    ).toBe(true);
    expect(
      submitCreatorProfileResponseSchema.safeParse({
        status: "pending_review",
        missing: [],
      }).success,
    ).toBe(true);
    expect(
      submitCreatorProfileResponseSchema.safeParse({
        status: "pending_review",
        missing: ["price"],
      }).success,
    ).toBe(false);
    expect(CREATOR_PROFILE_REQUIRED_FIELD_CODES.slice(-2)).toEqual([
      "portfolio",
      "accountVerified",
    ]);
  });

  it("holds the closed list of RG96, and a free message for `other` only in 20 to 500 characters", () => {
    expect([...CREATOR_REJECTION_REASON_CODES]).toHaveLength(10);
    const refusal = {
      kind: "submission",
      reasonCode: "bio_insufficient",
      nextStep: "fix",
      memberMessage: null,
      decidedAt: "2026-11-11T10:00:00.000Z",
    };
    expect(creatorProfileRefusalSchema.safeParse(refusal).success).toBe(true);
    expect(
      creatorProfileRefusalSchema.safeParse({
        ...refusal,
        reasonCode: "other",
        nextStep: "contact",
        memberMessage: "Merci de nous écrire pour en discuter.",
      }).success,
    ).toBe(true);
    expect(
      creatorProfileRefusalSchema.safeParse({
        ...refusal,
        memberMessage: "court",
      }).success,
    ).toBe(false);
    expect(
      creatorProfileRefusalSchema.safeParse({ ...refusal, reasonCode: "spam" })
        .success,
    ).toBe(false);
    expect(
      creatorProfileRefusalSchema.safeParse({ ...refusal, agent: ID }).success,
    ).toBe(false);
  });

  it("takes the one global switch of visibility, and nothing else", () => {
    expect(
      creatorVisibilityBodySchema.safeParse({ isSearchable: false }).success,
    ).toBe(true);
    expect(creatorVisibilityBodySchema.safeParse({}).success).toBe(false);
    expect(
      creatorVisibilityBodySchema.safeParse({
        isSearchable: true,
        status: "published",
      }).success,
    ).toBe(false);
  });
});

describe("L2G-06 what a brand sees (07 RG16, RG84, RG104)", () => {
  const BEFORE = {
    alias: "7K3MZQ",
    headline: "Créatrice lifestyle à Rennes, voyages et cuisine",
    bio: "b".repeat(160),
    primaryTopic: "food",
    secondaryTopics: ["travel"],
    tones: [],
    publicationLanguages: ["fr"],
    residenceCountry: "FR",
    travelScope: "domestic",
    collaborationExperience: null,
    mainAudienceCountry: "FR",
    mainAudienceShareBand: "50_74",
    audienceGenderBand: null,
    audienceBands: [{ dimension: "age", code: "25_34", shareBand: "25_50" }],
    formats: ["instagram_reel"],
    usageRights: [{ code: "organic_repost", inclusion: "included" }],
    deliveryLead: null,
    maxExclusivity: "le_1m",
    acceptsNonMonetary: false,
    availability: "lt_1m",
    networks: [
      {
        networkCode: "instagram",
        isPrimary: true,
        audienceBand: "micro",
        reachBand: null,
        publicationFrequency: "weekly",
        commentBand: null,
        engagementBand: null,
        figuresSource: "declared",
        figuresMeasuredAt: "2026-11-10T09:00:00.000Z",
        badges: [],
      },
    ],
    visuals: [{ id: ID, order: 1, caption: null }],
  };

  it("serves layer A alone before an introduction: no handle, no URL, no exact figure, no score, no reference", () => {
    expect(creatorProjectionBeforeSchema.safeParse(BEFORE).success).toBe(true);
    for (const extra of [
      { publicRef: ID },
      { completeness: 80 },
      { status: "published" },
      { price: 100 },
    ]) {
      expect(
        creatorProjectionBeforeSchema.safeParse({ ...BEFORE, ...extra })
          .success,
        JSON.stringify(extra),
      ).toBe(false);
    }
    const [network] = BEFORE.networks;
    expect(
      creatorProjectionBeforeSchema.safeParse({
        ...BEFORE,
        networks: [{ ...network, handle: "camille_cuisine" }],
      }).success,
    ).toBe(false);
  });

  it("shows two tabs: the second one adds the layer I of the listed lines to the first", () => {
    const [network] = BEFORE.networks;
    const preview = {
      published: false,
      before: BEFORE,
      after: {
        ...BEFORE,
        networks: [
          {
            ...network,
            handle: "camille_cuisine",
            profileUrl: "https://www.instagram.com/camille_cuisine",
            followersCount: 48000,
            postsLast30Days: 12,
            avgCommentsPerPost: 30,
            avgReachPerPost: null,
          },
        ],
        audienceShares: [{ dimension: "country", code: "FR", share: 70 }],
      },
    };
    expect(creatorPreviewResponseSchema.safeParse(preview).success).toBe(true);
    expect(
      creatorPreviewResponseSchema.safeParse({
        ...preview,
        before: preview.after,
      }).success,
    ).toBe(false);
  });
});
