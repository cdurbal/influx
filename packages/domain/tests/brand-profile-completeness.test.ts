import { describe, expect, it } from "vitest";
import {
  BRAND_PROFILE_WEIGHTS,
  brandProfileCompleteness,
  type BrandProfileCompletenessInput,
} from "../src/brand-profile/index.ts";

const PRESENTATION = "x".repeat(120);

/** Every offered criterion entered but the badge request; the budget is suspended (answer A). */
const COMPLETE: BrandProfileCompletenessInput = {
  legalName: "Maison Aube",
  primarySector: "fashion",
  companySize: "11-50",
  country: "FR",
  presentation: PRESENTATION,
  hasLogo: true,
  targetMarkets: ["FR"],
  workingLanguages: ["fr"],
  topics: ["beauty"],
  networks: ["instagram"],
  formats: ["reel"],
  audienceCountries: ["FR"],
  usageRights: ["organic"],
  websiteDomain: "maison-aube.fr",
  contactRole: "marketing",
  contactPhone: "+33102030405",
  contactEmail: "marketing@maison-aube.fr",
};

describe("weights of 06 RG58", () => {
  it("sums to 40, 35, 15 and 10 points by block, 100 in all", () => {
    const total = (block: string) =>
      BRAND_PROFILE_WEIGHTS.filter((weight) => weight.block === block).reduce(
        (sum, weight) => sum + weight.points,
        0,
      );
    expect([
      total("identity"),
      total("expectations"),
      total("trust"),
      total("contact"),
    ]).toEqual([40, 35, 15, 10]);
    expect(BRAND_PROFILE_WEIGHTS.reduce((sum, w) => sum + w.points, 0)).toBe(
      100,
    );
  });

  it("gives every criterion the points of the table", () => {
    expect(
      Object.fromEntries(BRAND_PROFILE_WEIGHTS.map((w) => [w.code, w.points])),
    ).toEqual({
      legalName: 5,
      primarySector: 5,
      companySize: 3,
      country: 2,
      presentation: 10,
      logo: 10,
      targetMarkets: 3,
      workingLanguages: 2,
      topics: 8,
      networks: 6,
      formats: 6,
      budgetBand: 8,
      audienceCountries: 4,
      usageRights: 3,
      websiteDomain: 5,
      badgeRequested: 10,
      contactRole: 3,
      contactPhone: 4,
      contactEmail: 3,
    });
  });

  it("offers everything but the budget (D78): the badge request is offered from L2E", () => {
    expect(
      BRAND_PROFILE_WEIGHTS.filter((weight) => !weight.offered).map(
        (weight) => weight.code,
      ),
    ).toEqual(["budgetBand"]);
  });
});

describe("CA35 score and detail by block", () => {
  it("is the sum of the matching weights over the reachable points, block by block", () => {
    const result = brandProfileCompleteness({
      legalName: "Maison Aube",
      primarySector: "fashion",
      companySize: "11-50",
      country: "FR",
      presentation: PRESENTATION,
    });
    // 5 + 5 + 3 + 2 + 10 = 25 points out of the 92 that can be reached today
    expect(result.earnedPoints).toBe(25);
    expect(result.attainablePoints).toBe(92);
    expect(result.score).toBe(27);
    expect(
      result.blocks.map((b) => [b.id, b.earnedPoints, b.attainablePoints]),
    ).toEqual([
      ["identity", 25, 40],
      ["expectations", 0, 27],
      ["trust", 0, 15],
      ["contact", 0, 10],
    ]);
  });

  it("scores an empty profile 0 and a complete one 100, whole numbers both", () => {
    expect(brandProfileCompleteness({}).score).toBe(0);
    const complete = brandProfileCompleteness({
      ...COMPLETE,
      badgeRequested: true,
    });
    expect(complete.score).toBe(100);
    expect(complete.earnedPoints).toBe(92);
    expect(Number.isInteger(complete.score)).toBe(true);
    // without the request, the 10 points of the badge are the only ones missing
    expect(brandProfileCompleteness(COMPLETE).score).toBe(89);
  });

  it("never shows 100 while one reachable point is missing", () => {
    const result = brandProfileCompleteness({
      ...COMPLETE,
      badgeRequested: true,
      contactEmail: null,
    });
    expect(result.earnedPoints).toBe(89);
    expect(result.score).toBe(97);
    expect(
      brandProfileCompleteness({ ...COMPLETE, contactEmail: null }).score,
    ).toBeLessThan(100);
  });

  it("counts a presentation from 120 characters only, margins excluded", () => {
    const short = brandProfileCompleteness({
      presentation: `  ${"x".repeat(119)}  `,
    });
    const enough = brandProfileCompleteness({ presentation: PRESENTATION });
    expect([short.earnedPoints, enough.earnedPoints]).toEqual([0, 10]);
  });

  it("does not count `none` as a usage right (L2-amend)", () => {
    expect(
      brandProfileCompleteness({ usageRights: ["none"] }).earnedPoints,
    ).toBe(0);
    expect(
      brandProfileCompleteness({ usageRights: ["none", "organic"] })
        .earnedPoints,
    ).toBe(3);
  });
});

describe("CA36 nothing depends on an action of INFLUX (RG59)", () => {
  it("counts a request filed, never a badge obtained: a decision input changes nothing", () => {
    const filed = brandProfileCompleteness({
      ...COMPLETE,
      badgeRequested: true,
    });
    expect(filed.earnedPoints).toBe(92);
    expect(
      brandProfileCompleteness({
        ...COMPLETE,
        badgeRequested: true,
        badgeObtained: true,
        status: "published",
      } as BrandProfileCompletenessInput),
    ).toEqual(filed);
    expect(
      filed.blocks.find((block) => block.id === "trust")?.earnedPoints,
    ).toBe(15);
  });

  it("ignores the budget while it is suspended: the reachable points stay 92", () => {
    const withBudget = brandProfileCompleteness({
      ...COMPLETE,
      budgetBand: "band-2",
    });
    expect(withBudget.earnedPoints).toBe(82);
    expect(withBudget.attainablePoints).toBe(92);
    const criterion = withBudget.blocks
      .flatMap((block) => block.criteria)
      .find((c) => c.code === "budgetBand");
    expect(criterion).toMatchObject({ offered: false, earned: false });
  });
});

describe("CA37 the score is not a threshold", () => {
  it("reports a profile that holds only the required fields, and carries no pass mark", () => {
    const result = brandProfileCompleteness({
      legalName: "Maison Aube",
      primarySector: "fashion",
      companySize: "11-50",
      country: "FR",
      targetMarkets: ["FR"],
      workingLanguages: ["fr"],
      presentation: PRESENTATION,
      topics: ["beauty"],
      networks: ["instagram"],
      formats: ["reel"],
      audienceCountries: ["FR"],
      contactRole: "marketing",
    });
    // 5+5+3+2+3+2+10 + 8+6+6+4 + 3 = 57 of 92: the result only reports; the submission reads the
    // required list (required.test.ts), and no export of this package offers a pass mark.
    expect(result.score).toBe(62);
    expect(Object.keys(result).sort()).toEqual([
      "attainablePoints",
      "blocks",
      "earnedPoints",
      "score",
    ]);
  });
});
