import { describe, expect, it } from "vitest";
import {
  creatorEntryRowSchema,
  creatorReviewAlertSchema,
  creatorReviewedProfileSchema,
  creatorRevisionValueSchema,
  openPortfolioItemResponseSchema,
  portfolioEntryRowSchema,
  reviewImageResponseSchema,
} from "../src/creator-queues.ts";

const ID = "5b1d6f3e-0a52-4c8e-9f0e-2f6a1c7d9b10";
const INSTANT = "2026-11-11T09:00:00.000Z";
const CLAIM = {
  holder: null,
  claimedAt: null,
  claimExpiresAt: null,
  heldByCaller: false,
};

const creatorRow = {
  id: ID,
  accountId: ID,
  kind: "submission",
  createdAt: INSTANT,
  slaDueAt: INSTANT,
  escalateAt: null,
  overdue: false,
  alias: "KXZ4R8",
  countryCode: "FR",
  networks: ["instagram"],
  badges: [{ networkCode: "instagram", level: "account_verified" }],
  completenessPercent: 80,
  modifiedFields: [],
  owner: null,
  claim: CLAIM,
  alerts: ["direct_contact"],
};

const portfolioRow = {
  id: ID,
  accountId: ID,
  alias: "KXZ4R8",
  kind: "deposit",
  createdAt: INSTANT,
  slaDueAt: INSTANT,
  escalateAt: null,
  overdue: false,
  visualCount: 3,
  owner: null,
  claim: CLAIM,
  alerts: [],
};

describe("the lists of queues 2 and 3 carry no coordinate, no caption and no thumbnail (17b §2.7, D82 (7))", () => {
  it("accepts a line of each queue and refuses a handle, a link, a caption or a thumbnail added to it", () => {
    expect(creatorEntryRowSchema.safeParse(creatorRow).success).toBe(true);
    expect(portfolioEntryRowSchema.safeParse(portfolioRow).success).toBe(true);
    for (const extra of [
      "handle",
      "profileUrl",
      "caption",
      "headline",
      "followers",
    ]) {
      expect(
        creatorEntryRowSchema.safeParse({ ...creatorRow, [extra]: "x" })
          .success,
        extra,
      ).toBe(false);
    }
    for (const extra of [
      "thumbnail",
      "image",
      "data",
      "caption",
      "objectKey",
      "checksum",
    ]) {
      expect(
        portfolioEntryRowSchema.safeParse({ ...portfolioRow, [extra]: "x" })
          .success,
        extra,
      ).toBe(false);
    }
  });

  it("names an alert by its field, its visual and its kinds of signal, and refuses the text that matched", () => {
    const alert = {
      code: "direct_contact",
      field: "portfolio_caption",
      rowKey: ID,
      signals: ["handle"],
    };
    expect(creatorReviewAlertSchema.safeParse(alert).success).toBe(true);
    expect(
      creatorReviewAlertSchema.safeParse({ ...alert, text: "@x" }).success,
    ).toBe(false);
    expect(
      creatorReviewAlertSchema.safeParse({ ...alert, signals: [] }).success,
    ).toBe(false);
    expect(
      creatorReviewAlertSchema.safeParse({ ...alert, field: "city" }).success,
    ).toBe(false);
  });
});

describe("the decision views hold the layer I the agent moderates, never the layer N (07 RG16)", () => {
  it("refuses a legal name, an address or a contact on the profile of a decision view", () => {
    const profile = {
      alias: "KXZ4R8",
      status: "pending_review",
      firstPublishedAt: null,
      completenessPercent: 80,
      headline: "Cuisine",
      bio: null,
      primaryTopic: "food",
      residenceRegion: null,
      travelScope: null,
      collaborationExperience: null,
      deliveryLead: null,
      maxExclusivity: null,
      acceptsNonMonetary: false,
      availability: null,
      lists: {
        secondaryTopics: [],
        tones: [],
        publicationLanguages: [],
        formats: [],
        usageRights: [],
        refusedSectors: [],
      },
      lines: [],
      visuals: [],
    };
    expect(creatorReviewedProfileSchema.safeParse(profile).success).toBe(true);
    for (const extra of [
      "legalFirstName",
      "contactEmail",
      "contactPhone",
      "addressLine",
      "city",
    ]) {
      expect(
        creatorReviewedProfileSchema.safeParse({ ...profile, [extra]: "x" })
          .success,
        extra,
      ).toBe(false);
    }
  });

  it("tells a text, a line and a caption apart, and a caption with the statement of RG83", () => {
    expect(
      creatorRevisionValueSchema.safeParse({ kind: "text", text: null })
        .success,
    ).toBe(true);
    expect(
      creatorRevisionValueSchema.safeParse({
        kind: "line",
        networkCode: "instagram",
      }).success,
    ).toBe(true);
    expect(
      creatorRevisionValueSchema.safeParse({
        kind: "caption",
        caption: "Une recette",
        brandDeclared: true,
      }).success,
    ).toBe(true);
    expect(creatorRevisionValueSchema.safeParse({ kind: "logo" }).success).toBe(
      false,
    );
  });
});

describe("the visual of queue 3 and its read (D82 (7))", () => {
  it("serves the bytes as JSON to the holder, and never a key or an address with them", () => {
    const image = {
      state: "pending",
      image: {
        contentType: "image/webp",
        width: 1080,
        height: 1350,
        byteSize: 3,
        data: "AAAA",
      },
    };
    expect(reviewImageResponseSchema.safeParse(image).success).toBe(true);
    for (const extra of ["objectKey", "url", "signedUrl", "checksum"]) {
      expect(
        reviewImageResponseSchema.safeParse({ ...image, [extra]: "x" }).success,
        extra,
      ).toBe(false);
    }
    expect(
      reviewImageResponseSchema.safeParse({
        ...image,
        state: "approved",
        image: { ...image.image, contentType: "image/png" },
      }).success,
    ).toBe(false);
  });

  it("opens a visual with no message to the creator: the grid carries a code, its control and the text of the e-mail", () => {
    const opened = {
      asOf: INSTANT,
      outcome: "claimed",
      reviewToken: "a".repeat(64),
      item: {
        id: ID,
        kind: "replacement",
        state: "pending",
        createdAt: INSTANT,
        slaDueAt: INSTANT,
        escalateAt: null,
        overdue: false,
        claim: CLAIM,
        lastForcedRelease: null,
        decision: null,
        width: 1080,
        height: 1350,
        byteSize: 400000,
        caption: null,
        brandDeclared: false,
        replaces: { id: ID, displayOrder: 1, caption: null },
      },
      account: {
        id: ID,
        alias: "KXZ4R8",
        countryCode: "FR",
        preferredLanguage: "fr",
        owner: null,
      },
      alerts: [],
      reasons: [
        {
          code: "watermark",
          position: 1,
          gridControl: 1,
          message: "Un filigrane.",
        },
      ],
    };
    expect(openPortfolioItemResponseSchema.safeParse(opened).success).toBe(
      true,
    );
    expect(
      openPortfolioItemResponseSchema.safeParse({
        ...opened,
        reasons: [
          { code: "other", position: 10, gridControl: null, message: "x" },
        ],
      }).success,
    ).toBe(false);
    expect(
      openPortfolioItemResponseSchema.safeParse({
        ...opened,
        reasons: [
          { ...(opened.reasons[0] ?? {}), requiresMemberMessage: true },
        ],
      }).success,
    ).toBe(false);
  });
});
