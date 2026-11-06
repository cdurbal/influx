import { describe, expect, it } from "vitest";
import {
  audienceRemainder,
  audienceSum,
  hasBio,
  hasHeadline,
  isAudienceShare,
  isAudienceSumAllowed,
  isBioLengthAllowed,
  isHeadlineLengthAllowed,
} from "../src/creator-profile/index.ts";

describe("L2D-U5 bounds of the short title and the bio (RG25, RG26)", () => {
  it("accepts a short title from 20 to 120 characters, margins excluded", () => {
    expect(isHeadlineLengthAllowed("x".repeat(19))).toBe(false);
    expect(isHeadlineLengthAllowed("x".repeat(20))).toBe(true);
    expect(isHeadlineLengthAllowed("x".repeat(120))).toBe(true);
    expect(isHeadlineLengthAllowed("x".repeat(121))).toBe(false);
    expect(isHeadlineLengthAllowed(` ${"x".repeat(19)} `)).toBe(false);
  });

  it("accepts a bio from 150 to 800 characters, margins excluded", () => {
    expect(isBioLengthAllowed("y".repeat(149))).toBe(false);
    expect(isBioLengthAllowed("y".repeat(150))).toBe(true);
    expect(isBioLengthAllowed("y".repeat(800))).toBe(true);
    expect(isBioLengthAllowed("y".repeat(801))).toBe(false);
  });

  it("counts a code point as one character", () => {
    expect(isHeadlineLengthAllowed("😀".repeat(20))).toBe(true);
    expect(isHeadlineLengthAllowed("😀".repeat(121))).toBe(false);
  });

  it("counts a text as entered from its minimum, an absent one never", () => {
    expect(hasHeadline("x".repeat(20))).toBe(true);
    expect(hasHeadline(null)).toBe(false);
    expect(hasBio("y".repeat(150))).toBe(true);
    expect(hasBio(undefined)).toBe(false);
  });
});

describe("L2D-U5 audience shares (RG57, CA26, CA27)", () => {
  it("refuses a dimension of 140 and accepts one of 60", () => {
    expect(isAudienceSumAllowed([70, 40, 30])).toBe(false);
    expect(isAudienceSumAllowed([40, 20])).toBe(true);
    expect(isAudienceSumAllowed([100])).toBe(true);
    expect(isAudienceSumAllowed([100, 1])).toBe(false);
    expect(isAudienceSumAllowed([])).toBe(true);
  });

  it("leaves the rest to others, never completed", () => {
    expect(audienceSum([40, 20, null, undefined])).toBe(60);
    expect(audienceRemainder([40, 20])).toBe(40);
    expect(audienceRemainder([70, 40, 30])).toBe(0);
  });

  it("takes whole percentages from 0 to 100 only", () => {
    expect(isAudienceShare(0)).toBe(true);
    expect(isAudienceShare(100)).toBe(true);
    expect(isAudienceShare(101)).toBe(false);
    expect(isAudienceShare(-1)).toBe(false);
    expect(isAudienceShare(12.5)).toBe(false);
  });
});
