import { describe, expect, it } from "vitest";
import {
  checkObservedPeriod,
  dayNumberOf,
  isPeriodFresh,
  utcDayOf,
} from "../src/verification/index.ts";

const TODAY = "2026-11-07";
const FRESHNESS_DAYS = 30;

const check = (start: string | null, end: string | null) =>
  checkObservedPeriod({
    start,
    end,
    today: TODAY,
    freshnessDays: FRESHNESS_DAYS,
  });

describe("L2E-U1 the period of a constat (08 RG36, RG37, CA18, CA27, cas limite 2)", () => {
  it("accepts an ordered period that ended recently, a single day included", () => {
    expect(check("2026-10-10", "2026-11-06")).toEqual({ ok: true });
    expect(check("2026-11-07", "2026-11-07")).toEqual({ ok: true });
    expect(check("2026-11-05", "2026-11-07")).toEqual({ ok: true });
  });

  it("requires both ends: a missing or malformed date is a missing period (RG37)", () => {
    for (const [start, end] of [
      [null, "2026-11-01"],
      ["2026-10-01", null],
      [null, null],
      ["2026-10-01", ""],
      ["2026-02-30", "2026-11-01"],
      ["2026-10-01", "01/11/2026"],
      ["0001-01-01", "2026-11-01"],
    ] as const) {
      expect(check(start, end), `${start} ${end}`).toEqual({
        ok: false,
        reason: "period_missing",
      });
    }
  });

  it("refuses an end before the start, then an end in the future, in the order of the database", () => {
    expect(check("2026-11-02", "2026-11-01")).toEqual({
      ok: false,
      reason: "period_order",
    });
    expect(check("2026-11-01", "2026-11-08")).toEqual({
      ok: false,
      reason: "period_future",
    });
    // out of order and in the future: the order comes first
    expect(check("2026-11-09", "2026-11-08")).toEqual({
      ok: false,
      reason: "period_order",
    });
  });

  it("is a setting that comes in: 29 days is fresh and 30 is too old at 30, and the number moves the line", () => {
    expect(check("2026-09-01", "2026-10-09")).toEqual({ ok: true });
    expect(check("2026-09-01", "2026-10-08")).toEqual({
      ok: false,
      reason: "period_too_old",
    });
    const at60 = checkObservedPeriod({
      start: "2026-09-01",
      end: "2026-10-08",
      today: TODAY,
      freshnessDays: 60,
    });
    expect(at60).toEqual({ ok: true });
  });
});

describe("L2E-U2 the freshness of a period (08 CA18)", () => {
  it("is fresh below the limit, not at it, never in the future", () => {
    const fresh = (end: string) =>
      isPeriodFresh({ end, today: TODAY, freshnessDays: FRESHNESS_DAYS });
    expect(fresh("2026-11-07")).toBe(true);
    expect(fresh("2026-10-09")).toBe(true);
    expect(fresh("2026-10-08")).toBe(false);
    expect(fresh("2026-11-08")).toBe(false);
    expect(fresh("not a day")).toBe(false);
  });

  it("counts calendar days across a month, a year and a leap day", () => {
    expect(dayNumberOf("1970-01-01")).toBe(0);
    expect(dayNumberOf("1970-01-02")).toBe(1);
    expect(
      (dayNumberOf("2027-03-01") ?? 0) - (dayNumberOf("2027-02-28") ?? 0),
    ).toBe(1);
    expect(
      (dayNumberOf("2028-03-01") ?? 0) - (dayNumberOf("2028-02-28") ?? 0),
    ).toBe(2);
    expect(dayNumberOf("2027-02-29")).toBeNull();
    expect(dayNumberOf("2028-02-29")).not.toBeNull();
    expect(utcDayOf(new Date("2026-11-07T23:59:59Z"))).toBe("2026-11-07");
    expect(utcDayOf(new Date("2026-11-08T00:00:00Z"))).toBe("2026-11-08");
  });
});
