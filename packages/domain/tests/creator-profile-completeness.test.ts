import { describe, expect, it } from "vitest";
import {
  CREATOR_PROFILE_WEIGHTS,
  creatorProfileCompleteness,
  type CreatorProfileInput,
} from "../src/creator-profile/index.ts";

const HEADLINE = "x".repeat(20);
const BIO = "y".repeat(150);

/** A line the creator completed: network, handle, URL, the three metrics and the date. */
const LINE_ONE = {
  networkCode: "instagram",
  isPrimary: true,
  handle: "maison.aube",
  profileUrl: "https://www.instagram.com/maison.aube",
  followersCount: 12000,
  postsLast30Days: 12,
  avgCommentsPerPost: 40,
  avgReachPerPost: 3000,
  figuresConfirmedAt: "2026-11-01T10:00:00Z",
  audienceCountries: [
    { slot: 0, code: "FR", share: 70 },
    { slot: 1, code: "BE", share: 12 },
  ],
  audienceAges: [{ code: "25_34", share: 40 }],
  audienceGenders: [{ code: "female", share: 60 }],
};

const LINE_TWO = {
  networkCode: "tiktok",
  isPrimary: false,
  handle: "maison.aube",
  profileUrl: "https://www.tiktok.com/@maison.aube",
  followersCount: 800,
  postsLast30Days: 3,
  avgCommentsPerPost: 2,
  figuresConfirmedAt: "2026-11-01T10:00:00Z",
};

/** Every criterion the creator can earn at L2D, entered. */
const FULL: CreatorProfileInput = {
  headline: HEADLINE,
  bio: BIO,
  primaryTopicCode: "beauty",
  secondaryTopicCodes: ["fashion"],
  toneCodes: ["inspiring"],
  publicationLanguages: ["fr"],
  residenceCountryCode: "FR",
  travelScope: "domestic",
  networkLines: [LINE_ONE, LINE_TWO],
  offerLines: [
    { networkCode: "instagram", formatCode: "reel" },
    { networkCode: null, formatCode: "ugc_video" },
  ],
  usageRights: [{ code: "organic", inclusion: "included" }],
  maxExclusivityBand: "le_1m",
  availabilityBand: "lt_2w",
};

const total = (block: string) =>
  CREATOR_PROFILE_WEIGHTS.filter((weight) => weight.block === block).reduce(
    (sum, weight) => sum + weight.points,
    0,
  );

describe("L2D-U1 weights of 07 RG87", () => {
  it("add up to 100 by construction, 15, 14, 22, 20, 19, 8 and 2 by block", () => {
    expect(
      [
        "presentation",
        "editorial",
        "networks",
        "audience",
        "offer",
        "portfolio",
        "trust",
      ].map(total),
    ).toEqual([15, 14, 22, 20, 19, 8, 2]);
    expect(CREATOR_PROFILE_WEIGHTS.reduce((sum, w) => sum + w.points, 0)).toBe(
      100,
    );
  });

  it("give every criterion the points of the table, the offer lines taking those of the rate lines", () => {
    expect(
      Object.fromEntries(
        CREATOR_PROFILE_WEIGHTS.map((w) => [w.code, w.points]),
      ),
    ).toEqual({
      headline: 5,
      bio: 10,
      primaryTopic: 5,
      secondaryTopics: 2,
      tone: 2,
      languages: 3,
      residenceCountry: 1,
      travelScope: 1,
      firstNetworkLine: 16,
      secondNetworkLine: 5,
      averageReach: 1,
      mainAudienceCountry: 10,
      otherAudienceCountries: 3,
      audienceAges: 4,
      audienceGenders: 3,
      firstOfferLine: 8,
      secondOfferLine: 3,
      formats: 3,
      usageRights: 2,
      exclusivity: 1,
      availability: 2,
      portfolioThree: 6,
      portfolioFive: 2,
      badgeRequested: 2,
    });
  });

  it("holds no price, rate, net or currency criterion (D78)", () => {
    expect(
      CREATOR_PROFILE_WEIGHTS.filter((w) =>
        /price|tariff|currency|amount|^rate|^net[A-Z]/.test(w.code),
      ),
    ).toEqual([]);
  });
});

describe("the score of a creator profile (RG86, RG88)", () => {
  it("is 0 for an empty profile, and for a profile without any input", () => {
    expect(creatorProfileCompleteness({}).score).toBe(0);
    expect(creatorProfileCompleteness({ networkLines: [] }).score).toBe(0);
  });

  it("offers every criterion from L2G: the portfolio of block 6 and the badge request of block 7 included", () => {
    const notOffered = creatorProfileCompleteness({}).blocks.map((block) => [
      block.id,
      block.criteria.filter((c) => !c.offered).map((c) => c.code),
    ]);
    expect(notOffered).toEqual([
      ["presentation", []],
      ["editorial", []],
      ["networks", []],
      ["audience", []],
      ["offer", []],
      ["portfolio", []],
      ["trust", []],
    ]);
    expect(CREATOR_PROFILE_WEIGHTS.reduce((sum, w) => sum + w.points, 0)).toBe(
      100,
    );
  });

  it("reaches 100 from L2G: every criterion is offered, the portfolio counts once deposited", () => {
    const full = creatorProfileCompleteness(FULL);
    expect(full.attainablePoints).toBe(100);
    // the 90 of L2D, without the badge request (2) nor the portfolio (8)
    expect(full.score).toBe(90);
    const filed = creatorProfileCompleteness({ ...FULL, badgeRequested: true });
    expect(filed.score).toBe(92);
    const three = creatorProfileCompleteness({
      ...FULL,
      badgeRequested: true,
      portfolioDeposited: 3,
    });
    expect(three.score).toBe(98);
    const five = creatorProfileCompleteness({
      ...FULL,
      badgeRequested: true,
      portfolioDeposited: 5,
    });
    expect(five.score).toBe(100);
    expect(five.score).toBe(five.attainablePoints);
    expect(
      full.blocks.flatMap((block) => block.criteria).filter((c) => !c.offered),
    ).toHaveLength(0);
  });

  it("counts the visuals deposited, never the approved ones, and keeps the badge out of the score (RG88)", () => {
    const portfolio = (input: CreatorProfileInput) =>
      creatorProfileCompleteness(input).blocks.find(
        (block) => block.id === "portfolio",
      )?.earnedPoints;
    expect(portfolio(FULL)).toBe(0);
    expect(portfolio({ ...FULL, portfolioDeposited: 2 })).toBe(0);
    expect(portfolio({ ...FULL, portfolioDeposited: 3 })).toBe(6);
    expect(portfolio({ ...FULL, portfolioDeposited: 4 })).toBe(6);
    expect(portfolio({ ...FULL, portfolioDeposited: 5 })).toBe(8);
    expect(portfolio({ ...FULL, portfolioDeposited: 8 })).toBe(8);
    // « Compte vérifié » is a required field, not a point: nothing INFLUX decides moves the score
    expect(
      creatorProfileCompleteness({ ...FULL, accountVerified: true }),
    ).toEqual(creatorProfileCompleteness(FULL));
  });

  it("counts the points of what was entered, block by block, without rescaling", () => {
    const result = creatorProfileCompleteness({
      headline: HEADLINE,
      bio: BIO,
      primaryTopicCode: "beauty",
      publicationLanguages: ["fr"],
    });
    expect(result.score).toBe(23);
    expect(
      Object.fromEntries(result.blocks.map((b) => [b.id, b.earnedPoints])),
    ).toEqual({
      presentation: 15,
      editorial: 8,
      networks: 0,
      audience: 0,
      offer: 0,
      portfolio: 0,
      trust: 0,
    });
  });

  it("counts the bio from 150 characters and the headline from 20, margins excluded", () => {
    const earned = (headline: string, bio: string) =>
      creatorProfileCompleteness({ headline, bio }).score;
    expect(earned("x".repeat(19), "y".repeat(149))).toBe(0);
    expect(earned("x".repeat(20), "y".repeat(149))).toBe(5);
    expect(earned("x".repeat(19), "y".repeat(150))).toBe(10);
    expect(earned(` ${"x".repeat(18)} `, `${"y".repeat(148)}  `)).toBe(0);
  });

  it("counts a network line only when it holds the three priority metrics and their date", () => {
    const score = (line: object) =>
      creatorProfileCompleteness({
        networkLines: [{ ...LINE_ONE, ...line }],
      }).blocks.find((block) => block.id === "networks")?.earnedPoints;
    expect(score({})).toBe(17);
    expect(score({ postsLast30Days: null })).toBe(1);
    expect(score({ avgCommentsPerPost: null })).toBe(1);
    expect(score({ figuresConfirmedAt: null })).toBe(1);
    expect(score({ handle: " " })).toBe(1);
    expect(score({ profileUrl: null })).toBe(1);
    expect(score({ postsLast30Days: 0, avgCommentsPerPost: 0 })).toBe(17);
  });

  it("gives the second line its 5 points only when two lines are complete", () => {
    const networks = (lines: object[]) =>
      creatorProfileCompleteness({ networkLines: lines }).blocks.find(
        (block) => block.id === "networks",
      )?.earnedPoints;
    expect(networks([LINE_ONE])).toBe(17);
    expect(networks([LINE_ONE, { ...LINE_TWO, followersCount: null }])).toBe(
      17,
    );
    expect(networks([LINE_ONE, LINE_TWO])).toBe(22);
  });

  it("reads the audience on the main account only, exact shares kept out of the result", () => {
    const audience = (lines: object[]) =>
      creatorProfileCompleteness({ networkLines: lines }).blocks.find(
        (block) => block.id === "audience",
      )?.earnedPoints;
    expect(audience([LINE_ONE])).toBe(20);
    expect(audience([{ ...LINE_ONE, isPrimary: false }])).toBe(0);
    expect(
      audience([
        {
          ...LINE_ONE,
          audienceCountries: [{ slot: 0, code: "FR", share: null }],
        },
      ]),
    ).toBe(7);
    expect(JSON.stringify(creatorProfileCompleteness(FULL))).not.toMatch(
      /70|12000/,
    );
  });

  it("scores the offer by its lines, without any price (EC-L2D-4)", () => {
    const offer = (input: CreatorProfileInput) =>
      creatorProfileCompleteness(input).blocks.find(
        (block) => block.id === "offer",
      )?.earnedPoints;
    expect(offer({})).toBe(0);
    expect(offer({ offerLines: [{ formatCode: "reel" }] })).toBe(11);
    expect(
      offer({ offerLines: [{ formatCode: "reel" }, { formatCode: "story" }] }),
    ).toBe(14);
    expect(offer(FULL)).toBe(19);
    expect(
      offer({ usageRights: [{ code: "none", inclusion: "included" }] }),
    ).toBe(0);
  });

  it("counts a request FILED, never a badge obtained: no decision or moderation input changes it (RG88)", () => {
    const withDecisions = {
      ...FULL,
      portfolioItems: 8,
      status: "published",
      badge: "granted",
      badgeObtained: true,
    } as CreatorProfileInput;
    expect(creatorProfileCompleteness(withDecisions)).toEqual(
      creatorProfileCompleteness(FULL),
    );
    const trust = (input: CreatorProfileInput) =>
      creatorProfileCompleteness(input).blocks.find(
        (block) => block.id === "trust",
      )?.earnedPoints;
    expect(trust(FULL)).toBe(0);
    expect(trust({ ...FULL, badgeRequested: true })).toBe(2);
    expect(trust({ ...FULL, badgeRequested: false })).toBe(0);
  });
});
