// Sum of the durations of a milestone's browser cases (21 §2.3 point 1; L2CT-3): the added or
// lengthened cases are listed by spec file and title, each is read in every Playwright JSON report
// of the closing passes, its duration is the median of those passes, and the milestone's cost is
// the sum of the medians. A case missing from a report, ambiguous, or not passed is a problem: a
// sum over a case that did not run would understate the cost.

/** One case of the list: a spec file (relative to the e2e directory) and the start of its title. */
export type E2eCase = { file: string; title: string };

export type E2eDurationVerdict = {
  /** Reasons to fail; empty when every case was read in every report. */
  problems: string[];
  /** Per case, the median duration in milliseconds over the reports. */
  medians: { file: string; title: string; medianMs: number }[];
  totalMs: number;
};

type PlaywrightTest = {
  projectName?: string;
  results?: { status?: string; duration?: number }[];
};

type PlaywrightSuite = {
  title: string;
  file?: string;
  specs?: { title: string; tests?: PlaywrightTest[] }[];
  suites?: PlaywrightSuite[];
};

type PlaywrightReport = { suites: PlaywrightSuite[] };

function isPlaywrightReport(value: unknown): value is PlaywrightReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "suites" in value &&
    Array.isArray(value.suites)
  );
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const high = sorted[middle] ?? 0;
  return sorted.length % 2 === 1
    ? high
    : ((sorted[middle - 1] ?? 0) + high) / 2;
}

/** Every spec of a report, with the file it belongs to (forward slashes). */
function specsOf(report: PlaywrightReport) {
  const found: { file: string; title: string; tests: PlaywrightTest[] }[] = [];
  const visit = (suite: PlaywrightSuite, file: string) => {
    for (const spec of suite.specs ?? []) {
      found.push({ file, title: spec.title, tests: spec.tests ?? [] });
    }
    for (const child of suite.suites ?? []) {
      visit(child, file);
    }
  };
  for (const suite of report.suites) {
    visit(suite, (suite.file ?? suite.title).split("\\").join("/"));
  }
  return found;
}

/**
 * Reads the duration of each listed case in each report (milliseconds, all attempts of the case
 * added: the journeys never retry), then takes the median per case and the sum.
 */
export function sumE2eDurations(
  cases: readonly E2eCase[],
  reports: readonly unknown[],
): E2eDurationVerdict {
  const problems: string[] = [];
  if (cases.length === 0) {
    problems.push("the list of cases is empty");
  }
  if (reports.length === 0) {
    problems.push("no report given");
  }
  const perCase = cases.map(() => [] as number[]);
  reports.forEach((report, reportIndex) => {
    if (!isPlaywrightReport(report)) {
      problems.push(`report ${reportIndex + 1}: not a Playwright JSON report`);
      return;
    }
    const specs = specsOf(report);
    cases.forEach((wanted, caseIndex) => {
      const where = `report ${reportIndex + 1}, ${wanted.file} "${wanted.title}"`;
      const matches = specs.filter(
        (spec) =>
          spec.file === wanted.file && spec.title.startsWith(wanted.title),
      );
      if (matches.length !== 1) {
        problems.push(
          `${where}: ${matches.length === 0 ? "absent" : `ambiguous (${matches.length} cases)`}`,
        );
        return;
      }
      const results = (matches[0]?.tests ?? [])
        .filter(
          (test) =>
            test.projectName === undefined || test.projectName === "chromium",
        )
        .flatMap((test) => test.results ?? []);
      if (results.length === 0 || results.some((r) => r.status !== "passed")) {
        problems.push(`${where}: did not pass`);
        return;
      }
      perCase[caseIndex]?.push(
        results.reduce((sum, result) => sum + (result.duration ?? 0), 0),
      );
    });
  });
  const medians = cases.map((wanted, index) => ({
    file: wanted.file,
    title: wanted.title,
    medianMs: median(perCase[index] ?? []),
  }));
  return {
    problems,
    medians,
    totalMs: medians.reduce((sum, item) => sum + item.medianMs, 0),
  };
}
