// The floor of executed cases of a package (docs/mvp/18 §3 rule 2, 21 Q2; J8T-6, J9 commit 10),
// run from the package's directory after its tests: reads the JSON report of the run and checks
// it against the package's floor file (a module exporting CASE_FLOORS, keyed by the test file's
// path relative to the package). A Playwright report is read as a Vitest one. A problem fails
// with a non-zero exit code; nothing is ever skipped silently. apps/api keeps its own entry
// point (scripts/check-case-floors.ts, two projects). Usage:
// `node ../../packages/test-kit/scripts/check-case-floors.ts <floor file> <report>` (any further
// argument, such as a reporter passed through `pnpm test -- …`, is ignored).
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  checkCaseFloors,
  vitestReportOfPlaywright,
} from "../src/case-floors.ts";

const [floorFile, reportFile] = process.argv.slice(2);
if (floorFile === undefined || reportFile === undefined) {
  process.stderr.write(
    "Usage: node check-case-floors.ts <floor file> <report>\n",
  );
  process.exit(1);
}
const root = process.cwd();
const { CASE_FLOORS: floors } = (await import(
  pathToFileURL(path.resolve(root, floorFile)).href
)) as { CASE_FLOORS?: Readonly<Record<string, number>> };
if (floors === undefined) {
  process.stderr.write(`${floorFile} exports no CASE_FLOORS\n`);
  process.exit(1);
}

let report: unknown;
try {
  report = JSON.parse(readFileSync(path.resolve(root, reportFile), "utf8"));
} catch {
  process.stderr.write(
    `No readable report at ${reportFile}: run the tests of the package first.\n`,
  );
  process.exit(1);
}

const label = path.basename(root);
const { problems, aboveFloor } = checkCaseFloors(
  vitestReportOfPlaywright(report),
  floors,
  root,
);
for (const line of aboveFloor) {
  process.stdout.write(`floor may be raised: ${line}\n`);
}
if (problems.length > 0) {
  process.stderr.write(
    `Floor of executed cases of ${label} not met (18 §3 rule 2):\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write(`floor of executed cases of ${label} met\n`);
