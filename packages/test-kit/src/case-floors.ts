// Floor of executed cases per test file (docs/mvp/18 §3 rule 2, 21 §4 J2 "Vérification de fin de
// J2", Q2). The static guard of db-tests/ sees neither a dynamic skip (`context.skip()`) nor a
// removed case, nor an `it.each` over an empty list: the JSON report of Vitest does. Every case
// of the report must have run (passed or failed), and each file must run at least the number of
// cases its floor declares. Lowering a floor is done in a commit that says so.
import path from "node:path";

/** The part of Vitest's JSON reporter output that the check reads. */
export type VitestJsonReport = {
  testResults: {
    /** Absolute path of the test file, with forward slashes on every platform. */
    name: string;
    assertionResults: { status: string; fullName: string }[];
  }[];
};

/** Statuses of a case that ran. Anything else (skipped, pending, todo, disabled) did not. */
const RUN_STATUSES: ReadonlySet<string> = new Set(["passed", "failed"]);

export type CaseFloorVerdict = {
  /** Reasons to fail the run; empty when the report meets every floor. */
  problems: string[];
  /** Files that ran more cases than their floor: the floor may be raised. */
  aboveFloor: string[];
};

function isReport(value: unknown): value is VitestJsonReport {
  return (
    typeof value === "object" &&
    value !== null &&
    "testResults" in value &&
    Array.isArray(value.testResults)
  );
}

/**
 * Checks a Vitest JSON report against the floors of its files. `floors` maps a test file, relative
 * to `root` with forward slashes, to its minimum number of executed cases.
 */
export function checkCaseFloors(
  report: unknown,
  floors: Readonly<Record<string, number>>,
  root: string,
): CaseFloorVerdict {
  if (!isReport(report)) {
    return {
      problems: ["the report is not a Vitest JSON report"],
      aboveFloor: [],
    };
  }
  const problems: string[] = [];
  const aboveFloor: string[] = [];
  const seen = new Set<string>();
  if (report.testResults.length === 0) {
    problems.push("the report holds no test file");
  }
  for (const file of report.testResults) {
    const relative = path.relative(root, file.name).split(path.sep).join("/");
    seen.add(relative);
    const notRun = file.assertionResults.filter(
      (result) => !RUN_STATUSES.has(result.status),
    );
    for (const result of notRun) {
      problems.push(
        `${relative}: a case did not run (${result.status}): ${result.fullName}`,
      );
    }
    const executed = file.assertionResults.length - notRun.length;
    const floor = floors[relative];
    if (floor === undefined) {
      problems.push(
        `${relative}: no floor declared (${executed} cases executed); add it to the floor file`,
      );
      continue;
    }
    if (executed < floor) {
      problems.push(
        `${relative}: ${executed} cases executed, under its floor of ${floor}`,
      );
    } else if (executed > floor) {
      aboveFloor.push(
        `${relative}: ${executed} cases executed, floor ${floor}`,
      );
    }
  }
  for (const relative of Object.keys(floors)) {
    if (!seen.has(relative)) {
      problems.push(
        `${relative}: declared in the floor file, but absent from the report`,
      );
    }
  }
  return { problems, aboveFloor };
}

/** The part of Playwright's JSON reporter output that the adapter reads. */
type PlaywrightSuite = {
  title: string;
  file?: string;
  specs?: {
    title: string;
    tests?: { status?: string; results?: { status?: string }[] }[];
  }[];
  suites?: PlaywrightSuite[];
};

function isPlaywrightReport(
  value: unknown,
): value is { config: { rootDir: string }; suites: PlaywrightSuite[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    "suites" in value &&
    Array.isArray(value.suites) &&
    "config" in value &&
    typeof value.config === "object" &&
    value.config !== null &&
    "rootDir" in value.config &&
    typeof value.config.rootDir === "string"
  );
}

/**
 * The browser journeys (J8T-6): a Playwright JSON report read as a Vitest one, one entry per spec
 * file, one case per test and project. A test Playwright skipped, or one with no result (a serial
 * file stopped by a failure), did not run; its last result says passed or failed.
 */
export function vitestReportOfPlaywright(report: unknown): unknown {
  if (!isPlaywrightReport(report)) {
    return report;
  }
  const rootDir = report.config.rootDir.split(path.sep).join("/");
  const files = new Map<string, VitestJsonReport["testResults"][number]>();
  const visit = (suite: PlaywrightSuite, file: string, prefix: string) => {
    const entry = files.get(file) ?? {
      name: path.posix.join(rootDir, file),
      assertionResults: [],
    };
    files.set(file, entry);
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const last = test.results?.at(-1)?.status;
        entry.assertionResults.push({
          status:
            test.status === "skipped"
              ? "skipped"
              : last === undefined
                ? "pending"
                : last === "passed"
                  ? "passed"
                  : "failed",
          fullName: `${prefix}${spec.title}`,
        });
      }
    }
    for (const child of suite.suites ?? []) {
      visit(child, file, `${prefix}${child.title} › `);
    }
  };
  for (const suite of report.suites) {
    visit(suite, (suite.file ?? suite.title).split(path.sep).join("/"), "");
  }
  return { testResults: [...files.values()] };
}
