import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DATE_FIELDS,
  campaignDateConflicts,
  campaignDateIssues,
  isCivilDate,
  isPublicationWindowTooLong,
  type CampaignDateField,
  type CampaignDates,
} from "../src/campaign/index.ts";

const SOUND: Required<CampaignDates> = {
  applicationsCloseOn: "2027-01-10",
  contentDueOn: "2027-01-20",
  startsOn: "2027-02-01",
  endsOn: "2027-03-01",
};

describe("L3B-T5 the calendar of 09 RG69, RG70, RG74", () => {
  it("keeps the four dates in the order of RG70", () => {
    expect(CAMPAIGN_DATE_FIELDS).toEqual([
      "applicationsCloseOn",
      "contentDueOn",
      "startsOn",
      "endsOn",
    ]);
    expect(campaignDateConflicts(SOUND)).toEqual([]);
    expect(
      campaignDateConflicts({
        ...SOUND,
        contentDueOn: SOUND.applicationsCloseOn,
      }),
    ).toEqual([]);
  });

  // Each of the six pairs: the earlier date placed one day after the later one names that pair.
  const pairs: [CampaignDateField, CampaignDateField][] = [
    ["applicationsCloseOn", "contentDueOn"],
    ["applicationsCloseOn", "startsOn"],
    ["applicationsCloseOn", "endsOn"],
    ["contentDueOn", "startsOn"],
    ["contentDueOn", "endsOn"],
    ["startsOn", "endsOn"],
  ];
  it.each(pairs)(
    "names %s against %s when they are the wrong way round",
    (earlier, later) => {
      const dates: CampaignDates = {
        [earlier]: "2027-06-02",
        [later]: "2027-06-01",
      };
      expect(campaignDateConflicts(dates)).toEqual([{ earlier, later }]);
    },
  );

  it("names every pair that conflicts, in calendar order", () => {
    expect(
      campaignDateConflicts({
        applicationsCloseOn: "2027-05-01",
        contentDueOn: "2027-04-01",
        startsOn: "2027-03-01",
        endsOn: "2027-02-01",
      }),
    ).toHaveLength(6);
  });

  it("says nothing of a date that is missing or malformed", () => {
    expect(campaignDateConflicts({ startsOn: "2027-02-01" })).toEqual([]);
    expect(
      campaignDateConflicts({ startsOn: "2027-02-30", endsOn: "2027-01-01" }),
    ).toEqual([]);
    expect(campaignDateConflicts({ startsOn: "x", endsOn: null })).toEqual([]);
  });

  it("accepts a period of exactly 12 months and refuses one day more (RG74)", () => {
    expect(isPublicationWindowTooLong("2027-02-01", "2028-02-01")).toBe(false);
    expect(isPublicationWindowTooLong("2027-02-01", "2028-02-02")).toBe(true);
    expect(isPublicationWindowTooLong("2027-02-01", "2027-02-01")).toBe(false);
  });

  it("counts 12 months as the database does at the end of a month", () => {
    expect(isPublicationWindowTooLong("2028-02-29", "2029-02-28")).toBe(false);
    expect(isPublicationWindowTooLong("2028-02-29", "2029-03-01")).toBe(true);
    expect(isPublicationWindowTooLong("2027-12-31", "2028-12-31")).toBe(false);
    expect(isPublicationWindowTooLong("2027-12-31", "2029-01-01")).toBe(true);
  });

  it("says nothing of the period while a date is missing", () => {
    expect(isPublicationWindowTooLong(null, "2030-01-01")).toBe(false);
    expect(isPublicationWindowTooLong("2027-02-01", undefined)).toBe(false);
  });

  it("recognises a civil date that exists", () => {
    expect(isCivilDate("2028-02-29")).toBe(true);
    expect(isCivilDate("2027-02-29")).toBe(false);
    expect(isCivilDate("2027-13-01")).toBe(false);
    expect(isCivilDate("2027-1-1")).toBe(false);
    expect(isCivilDate(null)).toBe(false);
  });

  it("gathers both rules", () => {
    expect(campaignDateIssues(SOUND)).toEqual({
      conflicts: [],
      windowTooLong: false,
    });
    expect(campaignDateIssues({ ...SOUND, endsOn: "2029-01-01" })).toEqual({
      conflicts: [],
      windowTooLong: true,
    });
  });
});
