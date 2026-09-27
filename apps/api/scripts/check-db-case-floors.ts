// Runs after the database tests (`pnpm test:db`): reads the JSON report that Vitest wrote for the
// `db` project and checks it against db-tests/case-floors.ts (docs/mvp/18 §3 rule 2, 21 Q2).
// A problem fails the run with a non-zero exit code; nothing is ever skipped silently.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCaseFloors } from "@influx/test-kit/case-floors";
import { DB_CASE_FLOORS } from "../db-tests/case-floors.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
/** Written by the json reporter of `pnpm test:db` (package.json); ignored by Git. */
const REPORT = path.join(API_ROOT, "test-results", "db-report.json");

let report: unknown;
try {
  report = JSON.parse(readFileSync(REPORT, "utf8"));
} catch {
  process.stderr.write(
    `No readable Vitest report at ${REPORT}: run the database tests with \`pnpm test:db\`.\n`,
  );
  process.exit(1);
}

const { problems, aboveFloor } = checkCaseFloors(
  report,
  DB_CASE_FLOORS,
  API_ROOT,
);
for (const line of aboveFloor) {
  process.stdout.write(`floor may be raised: ${line}\n`);
}
if (problems.length > 0) {
  process.stderr.write(
    `Floor of executed database cases not met (18 §3 rule 2):\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write("floor of executed database cases met\n");
