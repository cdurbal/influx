import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DELIVERABLES_MAX,
  CAMPAIGN_KEY_MESSAGES_MAX,
  CAMPAIGN_TOPICS_MAX,
  hasCampaignBrief,
  hasCampaignSummary,
  hasCampaignTitle,
  isCampaignBriefLengthAllowed,
  isCampaignInternalReferenceLengthAllowed,
  isCampaignKeyMessageLengthAllowed,
  isCampaignProductLengthAllowed,
  isCampaignRestrictionsLengthAllowed,
  isCampaignSummaryLengthAllowed,
  isCampaignTitleLengthAllowed,
  isCreatorsWantedAllowed,
  isMaxApplicationsAllowed,
} from "../src/campaign/index.ts";

describe("L3B-T5 bounds of the texts and values of a campaign (09 RG16, RG24, RG55, RG76)", () => {
  it("accepts a title from 10 to 140 characters, margins excluded", () => {
    expect(isCampaignTitleLengthAllowed("x".repeat(9))).toBe(false);
    expect(isCampaignTitleLengthAllowed("x".repeat(10))).toBe(true);
    expect(isCampaignTitleLengthAllowed("x".repeat(140))).toBe(true);
    expect(isCampaignTitleLengthAllowed("x".repeat(141))).toBe(false);
    expect(isCampaignTitleLengthAllowed(` ${"x".repeat(9)} `)).toBe(false);
    expect(hasCampaignTitle("x".repeat(10))).toBe(true);
  });

  it("accepts a summary from 120 to 400 characters", () => {
    expect(isCampaignSummaryLengthAllowed("x".repeat(119))).toBe(false);
    expect(isCampaignSummaryLengthAllowed("x".repeat(120))).toBe(true);
    expect(isCampaignSummaryLengthAllowed("x".repeat(400))).toBe(true);
    expect(isCampaignSummaryLengthAllowed("x".repeat(401))).toBe(false);
    expect(hasCampaignSummary("x".repeat(119))).toBe(false);
  });

  it("accepts a brief from 300 to 4 000 characters", () => {
    expect(isCampaignBriefLengthAllowed("x".repeat(299))).toBe(false);
    expect(isCampaignBriefLengthAllowed("x".repeat(300))).toBe(true);
    expect(isCampaignBriefLengthAllowed("x".repeat(4000))).toBe(true);
    expect(isCampaignBriefLengthAllowed("x".repeat(4001))).toBe(false);
    expect(hasCampaignBrief("x".repeat(300))).toBe(true);
  });

  it("accepts a product from 20 to 600 characters and a key message from 10 to 200", () => {
    expect(isCampaignProductLengthAllowed("x".repeat(19))).toBe(false);
    expect(isCampaignProductLengthAllowed("x".repeat(20))).toBe(true);
    expect(isCampaignProductLengthAllowed("x".repeat(600))).toBe(true);
    expect(isCampaignProductLengthAllowed("x".repeat(601))).toBe(false);
    expect(isCampaignKeyMessageLengthAllowed("x".repeat(9))).toBe(false);
    expect(isCampaignKeyMessageLengthAllowed("x".repeat(10))).toBe(true);
    expect(isCampaignKeyMessageLengthAllowed("x".repeat(200))).toBe(true);
    expect(isCampaignKeyMessageLengthAllowed("x".repeat(201))).toBe(false);
  });

  it("bounds the optional texts from above only: restrictions 1 000, reference 40", () => {
    expect(isCampaignRestrictionsLengthAllowed("")).toBe(true);
    expect(isCampaignRestrictionsLengthAllowed("x".repeat(1000))).toBe(true);
    expect(isCampaignRestrictionsLengthAllowed("x".repeat(1001))).toBe(false);
    expect(isCampaignInternalReferenceLengthAllowed("x".repeat(40))).toBe(true);
    expect(isCampaignInternalReferenceLengthAllowed("x".repeat(41))).toBe(
      false,
    );
  });

  it("counts a code point as one character", () => {
    expect(isCampaignTitleLengthAllowed("😀".repeat(10))).toBe(true);
  });

  it("holds the ceilings of the lists: 10 deliverables, 5 key messages, 3 topics", () => {
    expect(CAMPAIGN_DELIVERABLES_MAX).toBe(10);
    expect(CAMPAIGN_KEY_MESSAGES_MAX).toBe(5);
    expect(CAMPAIGN_TOPICS_MAX).toBe(3);
  });

  it("accepts 1 to 50 creators and 1 to 200 applications, integers only", () => {
    expect(isCreatorsWantedAllowed(0)).toBe(false);
    expect(isCreatorsWantedAllowed(1)).toBe(true);
    expect(isCreatorsWantedAllowed(50)).toBe(true);
    expect(isCreatorsWantedAllowed(51)).toBe(false);
    expect(isCreatorsWantedAllowed(1.5)).toBe(false);
    expect(isMaxApplicationsAllowed(0)).toBe(false);
    expect(isMaxApplicationsAllowed(1)).toBe(true);
    expect(isMaxApplicationsAllowed(200)).toBe(true);
    expect(isMaxApplicationsAllowed(201)).toBe(false);
  });
});
