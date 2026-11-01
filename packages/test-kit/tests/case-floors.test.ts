// Self-checks of the floor of executed cases (docs/mvp/18 §3 rule 2, 21 Q2): each way a family of
// database tests can go quiet is written as a witness report, and must be reported.
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  checkCaseFloors,
  vitestReportOfPlaywright,
} from "../src/case-floors.ts";

const ROOT = path.resolve("/repo/apps/api");
const FILE_A = "db-tests/a.test.ts";
const FILE_B = "db-tests/b.test.ts";

/** A report as Vitest writes it: absolute paths with forward slashes. */
function report(files: Record<string, string[]>) {
  return {
    testResults: Object.entries(files).map(([relative, statuses]) => ({
      name: path.join(ROOT, relative).split(path.sep).join("/"),
      assertionResults: statuses.map((status, index) => ({
        status,
        fullName: `${relative} case ${index + 1}`,
      })),
    })),
  };
}

const FLOORS = { [FILE_A]: 2, [FILE_B]: 1 };

describe("floor of executed cases (18 §3 rule 2)", () => {
  it("accepts a report that meets every floor, failed cases counting as executed", () => {
    expect(
      checkCaseFloors(
        report({ [FILE_A]: ["passed", "failed"], [FILE_B]: ["passed"] }),
        FLOORS,
        ROOT,
      ),
    ).toEqual({ problems: [], aboveFloor: [] });
  });

  it.each([["skipped"], ["pending"], ["todo"], ["disabled"]])(
    "reports a case that did not run: %s",
    (status) => {
      const { problems } = checkCaseFloors(
        report({
          [FILE_A]: ["passed", "passed", status],
          [FILE_B]: ["passed"],
        }),
        FLOORS,
        ROOT,
      );
      expect(problems).toEqual([
        `${FILE_A}: a case did not run (${status}): ${FILE_A} case 3`,
      ]);
    },
  );

  it("reports a file under its floor, such as an it.each over an empty list", () => {
    const { problems } = checkCaseFloors(
      report({ [FILE_A]: ["passed"], [FILE_B]: [] }),
      FLOORS,
      ROOT,
    );
    expect(problems).toEqual([
      `${FILE_A}: 1 cases executed, under its floor of 2`,
      `${FILE_B}: 0 cases executed, under its floor of 1`,
    ]);
  });

  it("reports a file without a floor, and a floor without a file", () => {
    const { problems } = checkCaseFloors(
      report({
        [FILE_A]: ["passed", "passed"],
        "db-tests/new.test.ts": ["passed"],
      }),
      FLOORS,
      ROOT,
    );
    expect(problems).toEqual([
      "db-tests/new.test.ts: no floor declared (1 cases executed); add it to the floor file",
      `${FILE_B}: declared in the floor file, but absent from the report`,
    ]);
  });

  it("reports an empty report and a value that is not a report", () => {
    expect(checkCaseFloors({ testResults: [] }, {}, ROOT).problems).toEqual([
      "the report holds no test file",
    ]);
    expect(checkCaseFloors({ files: [] }, {}, ROOT).problems).toEqual([
      "the report is not a Vitest JSON report",
    ]);
  });

  it("lists the files above their floor without failing", () => {
    expect(
      checkCaseFloors(
        report({
          [FILE_A]: ["passed", "passed", "passed"],
          [FILE_B]: ["passed"],
        }),
        FLOORS,
        ROOT,
      ),
    ).toEqual({
      problems: [],
      aboveFloor: [`${FILE_A}: 3 cases executed, floor 2`],
    });
  });
});

describe("a Playwright report read as a Vitest one (J8T-6)", () => {
  const WEB = path.resolve("/repo/apps/web");
  const E2E = path.join(WEB, "e2e");

  function playwright(
    files: Record<string, { status: string; results: string[] }[]>,
  ) {
    return {
      config: { rootDir: E2E },
      suites: Object.entries(files).map(([file, tests]) => ({
        title: file,
        file,
        specs: [],
        suites: [
          {
            title: "a describe",
            file,
            specs: tests.map((test, index) => ({
              title: `case ${index + 1}`,
              tests: [
                {
                  status: test.status,
                  results: test.results.map((status) => ({ status })),
                },
              ],
            })),
          },
        ],
      })),
    };
  }

  it("counts each test of each spec file, nested describes included, keyed by its path in the package", () => {
    const report = playwright({
      "a.spec.ts": [
        { status: "expected", results: ["passed"] },
        { status: "unexpected", results: ["failed"] },
      ],
    });
    expect(vitestReportOfPlaywright(report)).toEqual({
      testResults: [
        {
          name: path.join(E2E, "a.spec.ts").split(path.sep).join("/"),
          assertionResults: [
            { status: "passed", fullName: "a describe › case 1" },
            { status: "failed", fullName: "a describe › case 2" },
          ],
        },
      ],
    });
    expect(
      checkCaseFloors(
        vitestReportOfPlaywright(report),
        { "e2e/a.spec.ts": 2 },
        WEB,
      ),
    ).toEqual({ problems: [], aboveFloor: [] });
  });

  // RK-1 (rk-fiche, integrateur): the safety net of a milestone writes its red cases as test.fail();
  // Playwright reports such a case "expected", its last result "failed": it ran. One that passes
  // is "unexpected" and fails the run by itself.
  it("counts a test.fail() that failed, as expected, as executed", () => {
    const report = playwright({
      "a.spec.ts": [
        { status: "expected", results: ["failed"] },
        { status: "unexpected", results: ["passed"] },
      ],
    });
    expect(
      checkCaseFloors(
        vitestReportOfPlaywright(report),
        { "e2e/a.spec.ts": 2 },
        WEB,
      ),
    ).toEqual({ problems: [], aboveFloor: [] });
  });

  it("reports a skipped test, and one a serial file never ran after a failure", () => {
    const { problems } = checkCaseFloors(
      vitestReportOfPlaywright(
        playwright({
          "a.spec.ts": [
            { status: "unexpected", results: ["timedOut"] },
            { status: "skipped", results: [] },
            { status: "expected", results: [] },
          ],
        }),
      ),
      { "e2e/a.spec.ts": 3 },
      WEB,
    );
    expect(problems).toEqual([
      "e2e/a.spec.ts: a case did not run (skipped): a describe › case 2",
      "e2e/a.spec.ts: a case did not run (pending): a describe › case 3",
      "e2e/a.spec.ts: 1 cases executed, under its floor of 3",
    ]);
  });

  it("leaves any other value to the Vitest check, which refuses it", () => {
    expect(
      checkCaseFloors(vitestReportOfPlaywright({ suites: [] }), {}, WEB)
        .problems,
    ).toEqual(["the report is not a Vitest JSON report"]);
  });
});
