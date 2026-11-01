// Entry point of `pnpm test:unit` and `pnpm test:db` (CLAUDE.md section 7 rule 5). pnpm appends the
// arguments of `pnpm test:db -- <file>` after the whole script, so a plain `vitest ... && node
// check-case-floors.ts` handed them to the floor check and ran the entire suite. This wrapper gives
// them to Vitest instead. Usage: `node scripts/run-tests.ts unit|db [vitest arguments...]`.
//   - No file argument (flags such as --reporter=dot do not count): the whole project runs with the
//     JSON report, then the floors are checked, exactly as before.
//   - One or more file arguments: Vitest runs only those files, no JSON report is written (the full
//     report stays untouched) and the floor check is skipped with a line that says so, because the
//     floors describe the whole project.
import { spawnSync } from "node:child_process";

const [project, ...rest] = process.argv.slice(2);
if (project !== "unit" && project !== "db") {
  process.stderr.write(
    "Usage: node scripts/run-tests.ts unit|db [vitest arguments...]\n",
  );
  process.exit(1);
}
// pnpm may forward the `--` separator itself; Vitest would read it as the end of its options.
const args = rest.filter((arg) => arg !== "--");
const filtered = args.some((arg) => !arg.startsWith("-"));

const vitestArgs = ["run", "--project", project];
if (!filtered) {
  vitestArgs.push(
    "--reporter=default",
    "--reporter=json",
    `--outputFile.json=test-results/${project}-report.json`,
  );
}
vitestArgs.push(...args);

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
    "floor check skipped: files were given, the floors cover the whole project (run without a file for the full check)\n",
  );
  process.exit(vitestStatus);
}
if (vitestStatus !== 0) process.exit(vitestStatus);
process.exit(run("node", ["scripts/check-case-floors.ts", project]));
