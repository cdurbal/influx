// Control of the sharded database tests in CI (L3A-04, L2GT-1). The `db` job runs the files of
// db-tests/shards.ts in two shards, each on its own stack, and keeps one Vitest JSON report per
// shard (`pnpm --filter @influx/api test:db -- --shard=<n>`). This script runs in the job that
// follows, on the downloaded reports, and fails when:
//   - a test file of the project `db` is in no shard, or in two, or a shard names a file that does
//     not exist (the declaration against the disk);
//   - a shard report is missing, runs a file that is not assigned to it, runs a file twice, or
//     lacks one that is (the reports against the declaration);
//   - the union of the reports does not meet db-tests/case-floors.ts (same check as
//     `pnpm test:db` on the whole project: floor not met, case not run, file without floor, floor
//     without file).
// Usage: `node scripts/check-db-shards.ts [directory of the reports]`, by default
// test-results/shards. Nothing is ever skipped silently.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkCaseFloors } from "@influx/test-kit/case-floors";
import type { VitestJsonReport } from "@influx/test-kit/case-floors";
import { DB_CASE_FLOORS } from "../db-tests/case-floors.ts";
import { DB_SHARDS } from "../db-tests/shards.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const reportsDir = path.resolve(
  API_ROOT,
  process.argv[2] ?? "test-results/shards",
);

const problems: string[] = [];

// 1. The declaration against the disk: the files that the Vitest project `db` would run.
const onDisk = readdirSync(path.join(API_ROOT, "db-tests"), {
  recursive: true,
})
  .map((entry) => `db-tests/${String(entry).split(path.sep).join("/")}`)
  .filter((file) => file.endsWith(".test.ts"));
const owner = new Map<string, string[]>();
for (const [shard, files] of Object.entries(DB_SHARDS)) {
  for (const file of files) {
    owner.set(file, [...(owner.get(file) ?? []), shard]);
  }
}
for (const file of onDisk) {
  const shards = owner.get(file) ?? [];
  if (shards.length === 0) {
    problems.push(`${file}: in no shard (db-tests/shards.ts)`);
  } else if (shards.length > 1) {
    problems.push(`${file}: in ${shards.length} shards (${shards.join(", ")})`);
  }
}
for (const file of owner.keys()) {
  if (!onDisk.includes(file)) {
    problems.push(
      `${file}: named by a shard, but not a test file of db-tests/`,
    );
  }
}

// 2. Each shard report against its declaration, then the union against the floors.
const union: VitestJsonReport = { testResults: [] };
for (const [shard, declared] of Object.entries(DB_SHARDS)) {
  const reportPath = path.join(reportsDir, `db-report-shard-${shard}.json`);
  let report: unknown;
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch {
    problems.push(`shard ${shard}: no readable Vitest report at ${reportPath}`);
    continue;
  }
  const results =
    typeof report === "object" &&
    report !== null &&
    "testResults" in report &&
    Array.isArray(report.testResults)
      ? (report.testResults as VitestJsonReport["testResults"])
      : undefined;
  if (results === undefined) {
    problems.push(`shard ${shard}: the report is not a Vitest JSON report`);
    continue;
  }
  const ran = new Map<string, number>();
  for (const result of results) {
    const relative = path
      .relative(API_ROOT, result.name)
      .split(path.sep)
      .join("/");
    ran.set(relative, (ran.get(relative) ?? 0) + 1);
  }
  for (const [file, times] of ran) {
    if (times > 1) problems.push(`shard ${shard}: ${file} ran ${times} times`);
    if (!declared.includes(file)) {
      problems.push(`shard ${shard}: ran ${file}, which is not assigned to it`);
    }
  }
  for (const file of declared) {
    if (!ran.has(file)) {
      problems.push(
        `shard ${shard}: ${file} is assigned to it but did not run`,
      );
    }
  }
  union.testResults.push(...results);
}

const verdict = checkCaseFloors(union, DB_CASE_FLOORS, API_ROOT);
for (const line of verdict.aboveFloor) {
  process.stdout.write(`floor may be raised: ${line}\n`);
}
problems.push(...verdict.problems);

if (problems.length > 0) {
  process.stderr.write(
    `Sharded database tests: the control failed (18 §3 rule 2, L3A-04):\n${problems
      .map((problem) => `  - ${problem}`)
      .join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write(
  `every database test file ran in exactly one of ${Object.keys(DB_SHARDS).length} shards (${union.testResults.length} files); floor of executed database cases met\n`,
);
