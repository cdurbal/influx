// Self-checks of the sum of browser case durations (21 §2.3 point 1; L2CT-3).
import { describe, expect, it } from "vitest";
import { median, sumE2eDurations } from "../src/e2e-durations.ts";

type Spec = { title: string; durations: number[]; status?: string };

/** A Playwright JSON report: one suite per file, specs nested one describe deep for `nested`. */
function report(files: Record<string, Spec[]>, nested = false) {
  const specsOf = (specs: Spec[]) =>
    specs.map((spec) => ({
      title: spec.title,
      tests: [
        {
          projectName: "chromium",
          results: spec.durations.map((duration) => ({
            status: spec.status ?? "passed",
            duration,
          })),
        },
      ],
    }));
  return {
    suites: Object.entries(files).map(([file, specs]) => ({
      title: file,
      file,
      ...(nested
        ? { suites: [{ title: "group", specs: specsOf(specs) }] }
        : { specs: specsOf(specs) }),
    })),
  };
}

const FIRST = { file: "a.spec.ts", title: "first" };
const SECOND = { file: "b.spec.ts", title: "second" };
const CASES = [FIRST, SECOND];

describe("sum of the median durations of listed browser cases", () => {
  it("takes the median of each case over the reports, then the sum", () => {
    const run = (a: number, b: number) =>
      report({
        "a.spec.ts": [{ title: "first case, long title", durations: [a] }],
        "b.spec.ts": [{ title: "second case", durations: [b] }],
      });
    const verdict = sumE2eDurations(CASES, [
      run(1000, 5000),
      run(3000, 2000),
      run(2000, 4000),
    ]);
    expect(verdict.problems).toEqual([]);
    expect(verdict.medians.map((m) => m.medianMs)).toEqual([2000, 4000]);
    expect(verdict.totalMs).toBe(6000);
  });

  it("reads cases nested in a describe, and adds the attempts of a case", () => {
    const verdict = sumE2eDurations(
      [FIRST],
      [
        report(
          { "a.spec.ts": [{ title: "first", durations: [400, 600] }] },
          true,
        ),
      ],
    );
    expect(verdict.problems).toEqual([]);
    expect(verdict.totalMs).toBe(1000);
  });

  it("fails on a case absent from a report", () => {
    const full = report({
      "a.spec.ts": [{ title: "first", durations: [1000] }],
      "b.spec.ts": [{ title: "second", durations: [1000] }],
    });
    const missing = report({
      "a.spec.ts": [{ title: "first", durations: [1000] }],
      "b.spec.ts": [{ title: "another", durations: [1000] }],
    });
    expect(sumE2eDurations(CASES, [full, missing]).problems).toEqual([
      'report 2, b.spec.ts "second": absent',
    ]);
  });

  it("fails on a case of another file, an ambiguous title and a case that did not pass", () => {
    const verdict = sumE2eDurations(CASES, [
      report({
        "a.spec.ts": [
          { title: "first one", durations: [1] },
          { title: "first two", durations: [1] },
        ],
        "c.spec.ts": [{ title: "second", durations: [1] }],
      }),
      report({
        "a.spec.ts": [{ title: "first", durations: [1], status: "failed" }],
        "b.spec.ts": [{ title: "second", durations: [1] }],
      }),
    ]);
    expect(verdict.problems).toEqual([
      'report 1, a.spec.ts "first": ambiguous (2 cases)',
      'report 1, b.spec.ts "second": absent',
      'report 2, a.spec.ts "first": did not pass',
    ]);
  });

  it("fails on an empty list, no report, or a report that is not Playwright's", () => {
    expect(sumE2eDurations([], [{}]).problems).toContain(
      "the list of cases is empty",
    );
    expect(sumE2eDurations(CASES, []).problems).toContain("no report given");
    expect(sumE2eDurations(CASES, [{ testResults: [] }]).problems).toEqual([
      "report 1: not a Playwright JSON report",
    ]);
  });

  it("computes the median of an even count as the mean of the middle two", () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});
