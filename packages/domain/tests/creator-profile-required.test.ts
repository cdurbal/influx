import { describe, expect, it } from "vitest";
import {
  CREATOR_PROFILE_REQUIRED_FIELDS,
  missingCreatorRequiredFields,
  type CreatorProfileInput,
} from "../src/creator-profile/index.ts";

/** Everything the required list asks for, and nothing of the three priority metrics but abonnés. */
const REQUIRED: CreatorProfileInput = {
  headline: "x".repeat(20),
  bio: "y".repeat(150),
  primaryTopicCode: "beauty",
  publicationLanguages: ["fr"],
  residenceCountryCode: "FR",
  networkLines: [
    {
      networkCode: "instagram",
      isPrimary: true,
      handle: "maison.aube",
      profileUrl: "https://www.instagram.com/maison.aube",
      followersCount: 0,
      figuresConfirmedAt: "2026-11-01T10:00:00Z",
      audienceCountries: [{ slot: 0, code: "FR", share: 0 }],
    },
  ],
  offerLines: [{ networkCode: "instagram", formatCode: "reel" }],
  availabilityBand: "lt_2w",
  // L2G: the portfolio (RG77) and « Compte vérifié » (RG16) are required too
  portfolioDeposited: 3,
  accountVerified: true,
};

describe("L2D-U2 required fields of blocks 1 to 5 (RG16, Q15)", () => {
  it("lists them by name in the order of the form", () => {
    expect([...CREATOR_PROFILE_REQUIRED_FIELDS]).toEqual([
      "headline",
      "bio",
      "primaryTopic",
      "publicationLanguages",
      "residenceCountry",
      "networkLines",
      "primaryAccount",
      "handle",
      "profileUrl",
      "followers",
      "figuresDate",
      "mainAudienceCountry",
      "mainAudienceShare",
      "formats",
      "availability",
      "portfolio",
      "accountVerified",
    ]);
  });

  it("misses all of them for an empty profile, and none for one that has them", () => {
    expect(missingCreatorRequiredFields({})).toEqual([
      ...CREATOR_PROFILE_REQUIRED_FIELDS,
    ]);
    expect(missingCreatorRequiredFields(REQUIRED)).toEqual([]);
  });

  it("asks the abonnés of the main account only, not the rhythm nor the comments (Q15)", () => {
    const line = REQUIRED.networkLines?.[0];
    expect(line?.postsLast30Days).toBeUndefined();
    expect(line?.avgCommentsPerPost).toBeUndefined();
    expect(
      CREATOR_PROFILE_REQUIRED_FIELDS.some((field) =>
        /posts|comments|rhythm|engagement|reach/i.test(field),
      ),
    ).toBe(false);
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        networkLines: [{ ...line, followersCount: null }],
      }),
    ).toEqual(["followers"]);
  });

  it("accepts zero followers: a zero is a figure (RG46), a missing value is not", () => {
    expect(missingCreatorRequiredFields(REQUIRED)).not.toContain("followers");
  });

  it("holds the text minimums: a short headline or a short bio is missing", () => {
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        headline: "x".repeat(19),
        bio: "y".repeat(149),
      }),
    ).toEqual(["headline", "bio"]);
  });

  it("needs one line marked main: none or two leave the main account and its figures missing", () => {
    const line = REQUIRED.networkLines?.[0] ?? {};
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        networkLines: [{ ...line, isPrimary: false }],
      }),
    ).toEqual([
      "primaryAccount",
      "followers",
      "figuresDate",
      "mainAudienceCountry",
      "mainAudienceShare",
    ]);
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        networkLines: [line, { ...line, handle: "autre" }],
      }),
    ).toContain("primaryAccount");
    expect(
      missingCreatorRequiredFields({ ...REQUIRED, networkLines: [] }),
    ).toEqual([
      "networkLines",
      "primaryAccount",
      "handle",
      "profileUrl",
      "followers",
      "figuresDate",
      "mainAudienceCountry",
      "mainAudienceShare",
    ]);
  });

  it("asks a handle and a URL on every line, the date on the main account", () => {
    const line = REQUIRED.networkLines?.[0] ?? {};
    const second = { networkCode: "tiktok", isPrimary: false };
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        networkLines: [line, second],
      }),
    ).toEqual(["handle", "profileUrl"]);
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        networkLines: [{ ...line, figuresConfirmedAt: null }],
      }),
    ).toEqual(["figuresDate"]);
  });

  it("asks the main audience country and its share, on the main account", () => {
    const line = REQUIRED.networkLines?.[0] ?? {};
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        networkLines: [
          {
            ...line,
            audienceCountries: [{ slot: 0, code: "FR", share: null }],
          },
        ],
      }),
    ).toEqual(["mainAudienceShare"]);
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        networkLines: [
          { ...line, audienceCountries: [{ slot: 1, code: "BE", share: 12 }] },
        ],
      }),
    ).toEqual(["mainAudienceCountry", "mainAudienceShare"]);
  });

  it("asks at least a format and an availability, and no price (D78)", () => {
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        offerLines: [],
        availabilityBand: null,
      }),
    ).toEqual(["formats", "availability"]);
    expect(
      CREATOR_PROFILE_REQUIRED_FIELDS.some((field) =>
        /price|tariff|currency|^rate|^net[A-Z]/.test(field),
      ),
    ).toBe(false);
  });
});

describe("L2G-U1 the portfolio and the badge among the required fields (RG4, RG16, RG77, RG88)", () => {
  it("asks three visuals deposited, and counts none of the approvals (RG88)", () => {
    const missing = (portfolioDeposited?: number) =>
      missingCreatorRequiredFields({
        ...REQUIRED,
        portfolioDeposited,
      });
    expect(missing(undefined)).toEqual(["portfolio"]);
    expect(missing(0)).toEqual(["portfolio"]);
    expect(missing(2)).toEqual(["portfolio"]);
    expect(missing(3)).toEqual([]);
    expect(missing(8)).toEqual([]);
  });

  it("asks an active « Compte vérifié », and only a true one counts (RG16, D79 (6))", () => {
    const missing = (accountVerified?: boolean) =>
      missingCreatorRequiredFields({ ...REQUIRED, accountVerified });
    expect(missing(undefined)).toEqual(["accountVerified"]);
    expect(missing(false)).toEqual(["accountVerified"]);
    expect(missing(true)).toEqual([]);
  });

  it("puts the portfolio then the badge after block 5, and lists both for a profile of the first five blocks", () => {
    expect(
      missingCreatorRequiredFields({
        ...REQUIRED,
        portfolioDeposited: undefined,
        accountVerified: undefined,
      }),
    ).toEqual(["portfolio", "accountVerified"]);
    expect(CREATOR_PROFILE_REQUIRED_FIELDS.slice(-3)).toEqual([
      "availability",
      "portfolio",
      "accountVerified",
    ]);
  });
});
