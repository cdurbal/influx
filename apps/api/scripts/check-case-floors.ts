// Runs after the unit tests (`pnpm test:unit`) or the database tests (`pnpm test:db`): reads the
// JSON report that Vitest wrote for that project and checks it against its floor file,
// tests/case-floors.ts or db-tests/case-floors.ts (docs/mvp/18 §3 rule 2, 21 Q2, J7T-3). A problem
// fails the run with a non-zero exit code; nothing is ever skipped silently. Usage:
// `node scripts/check-case-floors.ts unit|db` (any further argument is ignored).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCaseFloors } from "@influx/test-kit/case-floors";
import { DB_CASE_FLOORS } from "../db-tests/case-floors.ts";
import { UNIT_CASE_FLOORS } from "../tests/case-floors.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

/** Per project: its floors, and the report written by its json reporter (package.json). */
const PROJECTS = {
  unit: { floors: UNIT_CASE_FLOORS, report: "unit-report.json", label: "unit" },
  db: { floors: DB_CASE_FLOORS, report: "db-report.json", label: "database" },
} as const;

const project = process.argv[2];
if (project !== "unit" && project !== "db") {
  process.stderr.write("Usage: node scripts/check-case-floors.ts unit|db\n");
  process.exit(1);
}
const { floors, report: reportName, label } = PROJECTS[project];
/** Ignored by Git. */
const REPORT = path.join(API_ROOT, "test-results", reportName);

let report: unknown;
try {
  report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch {
  process.stderr.write(
    `No readable Vitest report at ${REPORT}: run the ${label} tests with \`pnpm test:${project}\`.\n`,
  );
  process.exit(1);
}

const { problems, aboveFloor } = checkCaseFloors(report, floors, API_ROOT);
for (const line of aboveFloor) {
  process.stdout.write(`floor may be raised: ${line}\n`);
}
if (problems.length > 0) {
  process.stderr.write(
    `Floor of executed ${label} cases not met (18 §3 rule 2):\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write(`floor of executed ${label} cases met\n`);
