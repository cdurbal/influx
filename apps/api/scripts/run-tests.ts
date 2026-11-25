// Entry point of `pnpm test:unit` and `pnpm test:db` (CLAUDE.md section 7 rule 5). pnpm appends the
// arguments of `pnpm test:db -- <file>` after the whole script, so a plain `vitest ... && node
// check-case-floors.ts` handed them to the floor check and ran the entire suite. This wrapper gives
// them to Vitest instead. Usage: `node scripts/run-tests.ts unit|db [vitest arguments...]`.
//   - No file argument (flags such as --reporter=dot do not count): the whole project runs with the
//     JSON report, then the floors are checked, exactly as before.
//   - One or more file arguments: Vitest runs only those files, no JSON report is written (the full
//     report stays untouched) and the floor check is skipped with a line that says so, because the
//     floors describe the whole project.
//   - `db --shard=<n>` (CI only, L3A-04): runs the files that db-tests/shards.ts assigns to shard
//     <n>, writes test-results/db-report-shard-<n>.json and skips the floor check; the floors are
//     checked on the union of the shard reports by scripts/check-db-shards.ts.
import { spawnSync } from "node:child_process";
import { DB_SHARDS } from "../db-tests/shards.ts";

const [project, ...rest] = process.argv.slice(2);
if (project !== "unit" && project !== "db") {
  process.stderr.write(
    "Usage: node scripts/run-tests.ts unit|db [vitest arguments...]\n",
  );
  process.exit(1);
}
const SHARD_FLAG = "--shard=";
// pnpm may forward the `--` separator itself; Vitest would read it as the end of its options.
const allArgs = rest.filter((arg) => arg !== "--");
const shardArg = allArgs.find((arg) => arg.startsWith(SHARD_FLAG));
const args = allArgs.filter((arg) => arg !== shardArg);
const shard = shardArg?.slice(SHARD_FLAG.length);
const shardFiles =
  shard !== undefined && Object.hasOwn(DB_SHARDS, shard)
    ? DB_SHARDS[shard]
    : undefined;
if (shardArg !== undefined && (project !== "db" || shardFiles === undefined)) {
  process.stderr.write(
    `${shardArg}: only the database tests have shards, ${Object.keys(DB_SHARDS).join(" or ")}\n`,
  );
  process.exit(1);
}
const filtered =
  shardFiles !== undefined || args.some((arg) => !arg.startsWith("-"));

const vitestArgs = ["run", "--project", project];
if (shardFiles !== undefined) {
  vitestArgs.push(
    "--reporter=default",
    "--reporter=json",
    `--outputFile.json=test-results/db-report-shard-${shard}.json`,
    ...args,
    ...shardFiles,
  );
} else if (!filtered) {
  vitestArgs.push(
    "--reporter=default",
    "--reporter=json",
    `--outputFile.json=test-results/${project}-report.json`,
  );
}
if (shardFiles === undefined) vitestArgs.push(...args);

const run = (command: string, commandArgs: string[]): number => {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
};

const vitestStatus = run("vitest", vitestArgs);
if (filtered) {
  process.stdout.write(
    shardFiles === undefined
      ? "floor check skipped: files were given, the floors cover the whole project (run without a file for the full check)\n"
      : `floor check skipped: shard ${shard} only, the floors are checked on the union of the shards (scripts/check-db-shards.ts)\n`,
  );
  process.exit(vitestStatus);
}
if (vitestStatus !== 0) process.exit(vitestStatus);
process.exit(run("node", ["scripts/check-case-floors.ts", project]));
