// What the "Santé technique" screen words and draws (docs/mvp/02 §20.5; 21 §J9 commit 9): pure
// functions, no browser. The p95 is the upper bound of a histogram bucket and is worded as such;
// a curve leaves a gap where nothing was measured, never a false zero; an availability before any
// check is a dash, not 100 %.
import type { OpsTrafficRoute } from "@influx/contracts/backoffice-ops";
import { describe, expect, it } from "vitest";
import {
  connectionShare,
  curveSegments,
  curveValues,
  formatAge,
  formatAlertValue,
  formatAvailability,
  formatBytes,
  formatErrorRate,
  formatMs,
  formatP95,
  formatRate,
  probeState,
  secondsSince,
  sortRoutes,
} from "../src/components/ops-view-model";

/** Intl puts a narrow no-break space in a number in French: compared as a plain space. */
function plain(text: string): string {
  return text.replace(/[  ]/g, " ");
}

describe("durations and the p95", () => {
  it("words a duration in ms below a second, in seconds above", () => {
    expect(formatMs(25)).toBe("25 ms");
    expect(formatMs(500)).toBe("500 ms");
    expect(formatMs(1000)).toBe("1 s");
    expect(formatMs(2500)).toBe("2,5 s");
  });

  it("a p95 is an upper bound: '≤' for a bucket, '>' for the last one, a dash when nothing was measured", () => {
    expect(formatP95({ p95Ms: 250, p95Beyond: false })).toBe("≤ 250 ms");
    expect(formatP95({ p95Ms: 1000, p95Beyond: false })).toBe("≤ 1 s");
    expect(formatP95({ p95Ms: 5000, p95Beyond: true })).toBe("> 5 s");
    expect(formatP95({ p95Ms: null, p95Beyond: false })).toBe("—");
  });

  it("calls per minute: one decimal under ten, whole above", () => {
    expect(formatRate(0.4)).toBe("0,4");
    expect(formatRate(12.4)).toBe("12");
    expect(plain(formatRate(1240))).toBe("1 240");
  });

  it("the error rate is the 5xx over the calls; a dash when nothing was called", () => {
    expect(formatErrorRate(5, 100)).toBe("5,00 %");
    expect(formatErrorRate(1, 3)).toBe("33,33 %");
    expect(formatErrorRate(0, 0)).toBe("—");
  });
});

describe("availability and ages", () => {
  it("availability is the share of checks that did not fail; a dash before any check, never 100 %", () => {
    expect(formatAvailability({ checks: 1440, failures: 1 })).toBe("99,93 %");
    expect(formatAvailability({ checks: 10, failures: 0 })).toBe("100,00 %");
    expect(formatAvailability({ checks: 0, failures: 0 })).toBe("—");
  });

  it("an age in the largest unit that reads well", () => {
    expect(formatAge(12)).toBe("12 s");
    expect(formatAge(59)).toBe("59 s");
    expect(formatAge(60)).toBe("1 min");
    expect(formatAge(3599)).toBe("59 min");
    expect(formatAge(3600)).toBe("1 h");
    expect(formatAge(7800)).toBe("2 h 10 min");
    expect(formatAge(86400 * 4)).toBe("4 j");
  });

  it("the seconds since an instant, never negative", () => {
    expect(secondsSince("2026-10-26T12:00:30.000Z", "2026-10-26T12:00:00.000Z")).toBe(30);
    expect(secondsSince("2026-10-26T12:00:00.000Z", "2026-10-26T12:00:30.000Z")).toBe(0);
  });

  it("the state of a target comes from its last check; unknown before the first one", () => {
    const base = {
      target: "api_health",
      availability: {
        day: { checks: 0, failures: 0 },
        week: { checks: 0, failures: 0 },
        month: { checks: 0, failures: 0 },
      },
    } as const;
    expect(probeState({ ...base, last: null })).toBe("unknown");
    expect(
      probeState({
        ...base,
        last: {
          checkedAt: "2026-10-26T12:00:00.000Z",
          outcome: "down",
          statusCode: null,
          failureCode: "timeout",
          durationMs: 5000,
        },
      }),
    ).toBe("down");
  });

  it("sizes and shares", () => {
    expect(plain(formatBytes(200_000_000))).toBe("191 Mo");
    expect(connectionShare(14, 60)).toBe(23);
    expect(connectionShare(1, 0)).toBe(100);
  });

  it("a value of an alert as it is, a dash for null", () => {
    expect(formatAlertValue(null)).toBe("—");
    expect(formatAlertValue(130)).toBe("130");
    expect(formatAlertValue("2026-10-26")).toBe("2026-10-26");
  });
});

function route(
  name: string,
  calls: number,
  serverErrors: number,
  p95Ms: number | null,
  p95Beyond = false,
): OpsTrafficRoute {
  return {
    method: "GET",
    route: name,
    summary: {
      calls,
      callsPerMinute: calls / 60,
      serverErrors,
      throttled: 0,
      p95Ms,
      p95Beyond,
    },
    points: [],
  };
}

describe("the table of routes", () => {
  const routes = [
    route("/v1/a", 100, 1, 250),
    route("/v1/b", 500, 0, 100),
    route("/v1/c", 50, 25, 5000, true),
    route("/v1/d", 0, 0, null),
  ];

  it("sorts by calls, by p95 (nothing measured last, beyond first) or by the share of 5xx", () => {
    expect(sortRoutes(routes, "calls").map((r) => r.route)).toEqual([
      "/v1/b",
      "/v1/a",
      "/v1/c",
      "/v1/d",
    ]);
    expect(sortRoutes(routes, "p95").map((r) => r.route)).toEqual([
      "/v1/c",
      "/v1/a",
      "/v1/b",
      "/v1/d",
    ]);
    expect(sortRoutes(routes, "errors").map((r) => r.route)).toEqual([
      "/v1/c",
      "/v1/a",
      "/v1/b",
      "/v1/d",
    ]);
  });

  it("never reorders the answer it was given", () => {
    const before = routes.map((r) => r.route);
    sortRoutes(routes, "p95");
    expect(routes.map((r) => r.route)).toEqual(before);
  });
});

describe("the curves", () => {
  const point = (
    calls: number,
    callsPerMinute: number,
    serverErrors: number,
    p95Ms: number | null,
    p95Beyond = false,
  ) => ({
    at: "2026-10-26T12:00:00.000Z",
    calls,
    callsPerMinute,
    serverErrors,
    throttled: 0,
    p95Ms,
    p95Beyond,
    open: false,
  });

  it("draws one value per bucket of time: calls per minute, the p95 bound, the share of 5xx; null where nothing was measured", () => {
    const points = [point(10, 2, 1, 250), point(0, 0, 0, null), point(4, 0.8, 0, 5000, true)];
    expect(curveValues(points, "calls")).toEqual([2, 0, 0.8]);
    expect(curveValues(points, "p95")).toEqual([250, null, 5001]);
    expect(curveValues(points, "errors")).toEqual([10, null, 0]);
  });

  it("a gap leaves two lines, never a false zero", () => {
    expect(curveSegments([1, 2, null, 3, 4], 100, 32)).toHaveLength(2);
    expect(curveSegments([null, null], 100, 32)).toEqual([]);
  });

  it("starts at zero: the largest value touches the top, zero the bottom", () => {
    const [segment] = curveSegments([0, 10], 100, 32);
    expect(segment).toBe("0,31 100,1");
  });

  it("a lone point is still drawn, and a flat zero stays on the bottom line", () => {
    expect(curveSegments([null, 5, null], 100, 32)).toHaveLength(1);
    const [flat] = curveSegments([0, 0, 0], 100, 32);
    expect(flat).toBe("0,31 50,31 100,31");
  });

  it("two curves share a scale when a ceiling is given", () => {
    const [low] = curveSegments([0, 5], 100, 32, 10);
    expect(low).toBe("0,31 100,16");
  });
});
