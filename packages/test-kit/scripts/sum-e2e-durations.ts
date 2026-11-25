// Sum of the median durations of a milestone's browser cases (21 §2.3 point 1; L2CT-3), read in
// the JSON reports of the closing passes (`apps/web/test-results/e2e-report.json`, copied out of
// the repository after each `pnpm test:e2e`). A case absent from a report, ambiguous or not passed
// fails the run. Usage:
// `node packages/test-kit/scripts/sum-e2e-durations.ts <cases.json> <report> <report> [<report>…]`
// where cases.json is a list of { "file": "x.spec.ts", "title": "start of the case title" }.
import { readFileSync } from "node:fs";
import { sumE2eDurations, type E2eCase } from "../src/e2e-durations.ts";

const [casesFile, ...reportFiles] = process.argv.slice(2);
if (casesFile === undefined || reportFiles.length === 0) {
  process.stderr.write(
    "Usage: node sum-e2e-durations.ts <cases.json> <report> [<report>…]\n",
  );
  process.exit(1);
}
function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    process.stderr.write(`No readable JSON file at ${file}\n`);
    process.exit(1);
  }
}
const cases = readJson(casesFile) as E2eCase[];
const verdict = sumE2eDurations(cases, reportFiles.map(readJson));
for (const item of verdict.medians) {
  process.stdout.write(
    `${(item.medianMs / 1000).toFixed(1)} s  ${item.file}  ${item.title.slice(0, 60)}\n`,
  );
}
process.stdout.write(
  `sum of medians over ${reportFiles.length} reports: ${(verdict.totalMs / 1000).toFixed(1)} s for ${cases.length} cases\n`,
);
if (verdict.problems.length > 0) {
  process.stderr.write(
    `Not a valid sum:\n${verdict.problems.map((p) => `  - ${p}`).join("\n")}\n`,
  );
  process.exit(1);
}
