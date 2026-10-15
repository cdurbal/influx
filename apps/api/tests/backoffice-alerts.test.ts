// The state alerts of the leads without the database (docs/mvp/05 RG104, CA62; 15 §F AL24 to AL27):
// the business-hours delay of a queue, and which alert each set of facts raises. The reads run on
// the local stack: db-tests/t14-backoffice-actions-route.test.ts.
import { describe, expect, it } from "vitest";
import {
  businessCutoff,
  businessHoursOf,
  delayAlerts,
  destinationAlerts,
  failureAlerts,
  reconciliationAlerts,
  thresholdCodes,
  thresholdNumber,
} from "../src/domains/backoffice/alerts.ts";
import type { DestinationHealthRow } from "../src/domains/backoffice/repository.ts";

const OFFICE = businessHoursOf({
  time_zone: "UTC",
  days: [1, 2, 3, 4, 5],
  opens: "09:00",
  closes: "17:00",
});

const HEALTHY: DestinationHealthRow = {
  destination: "brevo_contact",
  waiting: 3,
  retryingOld: 0,
  oldestRetryingAt: null,
  quotaErrors: 0,
  keyRefused: 0,
  oldestKeyRefusedAt: null,
  recentSuccess: true,
};

describe("the delay of a queue in business time (0129, EC-J8-7)", () => {
  it("counts the opening hours of the open days only", () => {
    // Thursday 2026-10-15 11:00 UTC: 2 business hours today, 8 on Wednesday
    const now = new Date("2026-10-15T11:00:00.000Z");
    expect(businessCutoff(now, 60, OFFICE).toISOString()).toBe(
      "2026-10-15T10:00:00.000Z",
    );
    expect(businessCutoff(now, 180, OFFICE).toISOString()).toBe(
      "2026-10-14T16:00:00.000Z",
    );
    // 960 business minutes = two business days
    expect(businessCutoff(now, 960, OFFICE).toISOString()).toBe(
      "2026-10-13T11:00:00.000Z",
    );
  });

  it("skips the weekend and the night", () => {
    // Monday 2026-10-19 08:00 UTC, before opening: one hour back is Friday 16:00
    expect(
      businessCutoff(
        new Date("2026-10-19T08:00:00.000Z"),
        60,
        OFFICE,
      ).toISOString(),
    ).toBe("2026-10-16T16:00:00.000Z");
  });

  it("reads calendar time without business hours, or with a zone other than UTC", () => {
    const now = new Date("2026-10-18T12:00:00.000Z");
    expect(businessCutoff(now, 90, null).toISOString()).toBe(
      "2026-10-18T10:30:00.000Z",
    );
    expect(
      businessCutoff(now, 90, {
        timeZone: "Europe/Paris",
        days: [1],
        opens: "09:00",
        closes: "17:00",
      }).toISOString(),
    ).toBe("2026-10-18T10:30:00.000Z");
  });

  it("reads null for an unreadable value of 0129", () => {
    expect(businessHoursOf(null)).toBeNull();
    expect(
      businessHoursOf({
        time_zone: "UTC",
        days: [0, 8],
        opens: "9h",
        closes: "17:00",
      }),
    ).toBeNull();
  });
});

describe("AL25: a destination down, a quota, a refused key (05 RG104, CA62)", () => {
  it("raises a refused key at once, with the lines waiting", () => {
    expect(
      destinationAlerts([
        {
          ...HEALTHY,
          keyRefused: 1,
          oldestKeyRefusedAt: "2026-10-15T09:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        code: "AL25",
        cause: "access_key_refused",
        destination: "brevo",
        count: 3,
        since: "2026-10-15T09:00:00.000Z",
      },
    ]);
  });

  it("raises a destination down after the window without any success, and names a quota", () => {
    const down = {
      ...HEALTHY,
      destination: "apollo_contact" as const,
      retryingOld: 2,
      oldestRetryingAt: "2026-10-15T08:40:00.000Z",
      recentSuccess: false,
    };
    expect(destinationAlerts([down])).toEqual([
      {
        code: "AL25",
        cause: "destination_down",
        destination: "apollo",
        count: 3,
        since: "2026-10-15T08:40:00.000Z",
      },
    ]);
    expect(destinationAlerts([{ ...down, quotaErrors: 1 }])[0]?.cause).toBe(
      "quota_exceeded",
    );
  });

  it("says nothing while a success came within the window, or nothing retries", () => {
    expect(destinationAlerts([HEALTHY])).toEqual([]);
    expect(
      destinationAlerts([{ ...HEALTHY, retryingOld: 4, recentSuccess: true }]),
    ).toEqual([]);
    expect(
      destinationAlerts([{ ...HEALTHY, retryingOld: 0, recentSuccess: false }]),
    ).toEqual([]);
  });
});

describe("AL24, AL26, AL27 (05 RG79, RG90, RG91, RG104)", () => {
  it("AL24: one alert per destination with failures past the delay", () => {
    expect(
      failureAlerts([
        {
          destination: "brevo_contact",
          count: 2,
          oldestAt: "2026-10-12T10:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        code: "AL24",
        cause: "failures_past_delay",
        destination: "brevo",
        count: 2,
        since: "2026-10-12T10:00:00.000Z",
      },
    ]);
  });

  it("AL26: below 99 % in time over the sliding day, the late lines counted", () => {
    const rows = [
      {
        destination: "brevo_contact" as const,
        eligible: 100,
        inTime: 99,
        oldestLateAt: "2026-10-14T10:00:00.000Z",
      },
      {
        destination: "apollo_contact" as const,
        eligible: 10,
        inTime: 9,
        oldestLateAt: "2026-10-13T10:00:00.000Z",
      },
    ];
    expect(delayAlerts(rows, 9900)).toEqual([
      {
        code: "AL26",
        cause: "queue_late",
        destination: "apollo",
        count: 1,
        since: "2026-10-13T10:00:00.000Z",
      },
    ]);
    expect(
      delayAlerts(
        [
          {
            destination: "brevo_contact",
            eligible: 0,
            inTime: 0,
            oldestLateAt: null,
          },
        ],
        9900,
      ),
    ).toEqual([]);
  });

  it("AL27: a gap above the threshold or a failed run, nothing before the first run", () => {
    const run = {
      periodKey: "2026-10-15",
      finishedAt: "2026-10-15T03:05:00.000Z",
      outcome: "succeeded" as const,
      gap: 2,
    };
    expect(reconciliationAlerts(run, 0)).toEqual([
      {
        code: "AL27",
        cause: "unsubscribe_gap",
        destination: null,
        count: 2,
        since: "2026-10-15T03:05:00.000Z",
      },
    ]);
    expect(reconciliationAlerts({ ...run, gap: 0 }, 0)).toEqual([]);
    expect(
      reconciliationAlerts({ ...run, outcome: "failed", gap: 0 }, 0)[0]?.cause,
    ).toBe("reconciliation_failed");
    expect(reconciliationAlerts(null, 0)).toEqual([]);
  });

  it("reads a threshold as data, its document's value when it does not read", () => {
    expect(
      thresholdNumber({ down_after_minutes: 20 }, "down_after_minutes", 15),
    ).toBe(20);
    expect(
      thresholdNumber({ down_after_minutes: null }, "down_after_minutes", 15),
    ).toBe(15);
    expect(thresholdCodes({ codes: ["a", 1] }, "codes", ["b"])).toEqual(["b"]);
    expect(thresholdCodes({ codes: ["a"] }, "codes", ["b"])).toEqual(["a"]);
  });
});
