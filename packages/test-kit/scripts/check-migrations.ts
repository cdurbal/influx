// CI check of the migration files (docs/mvp/21 §3, EC-32 and EC-37; J4). From J4, every push to
// main migrates `staging` with `supabase db push`, which applies the files it has not applied yet,
// in name order, and never re-reads one it already applied. Hence three rules:
// 1. every file of supabase/migrations is named `NNNN_snake_case.sql`, numbers unique (EC-32);
// 2. a file added by the pushed range has a number ABOVE every number present at the base: a file
//    slipped in before an applied one would run out of order on staging, or never (EC-37);
// 3. a file present at the base is never modified, renamed nor deleted by the range: staging
//    already ran it, so the change would never reach it and the environments would drift
//    silently. A correction is a new migration.
//
// Usage: node scripts/check-migrations.ts <base> <head>. An all-zero or missing base (first push
// of a branch) checks rule 1 only. Runs in the current directory's repository.
import { execFileSync } from "node:child_process";

export const MIGRATIONS_PATH = "supabase/migrations/";
export const MIGRATION_NAME = /^[0-9]{4}_[a-z0-9_]+\.sql$/;

function git(...args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** The migration file names present at `revision`. */
function migrationsAt(revision: string): string[] {
  return git("ls-tree", "--name-only", revision, MIGRATIONS_PATH)
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.slice(MIGRATIONS_PATH.length));
}

/** Rule 1, on the files of the head. */
function namingProblems(files: readonly string[]): string[] {
  const problems: string[] = [];
  const numbers = new Map<string, string>();
  for (const file of files) {
    if (!MIGRATION_NAME.test(file)) {
      problems.push(`${file}: name must match NNNN_snake_case.sql (EC-32)`);
      continue;
    }
    const number = file.slice(0, 4);
    const other = numbers.get(number);
    if (other !== undefined) {
      problems.push(`${file}: number ${number} already used by ${other}`);
    }
    numbers.set(number, file);
  }
  return problems;
}

/** Rules 2 and 3, on the changes of the range. */
function rangeProblems(base: string, head: string): string[] {
  const atBase = migrationsAt(base).filter((file) => MIGRATION_NAME.test(file));
  const highest = atBase.reduce(
    (max, file) => Math.max(max, Number(file.slice(0, 4))),
    -1,
  );
  const changes = git(
    "diff",
    "--name-status",
    "--no-renames",
    `${base}..${head}`,
    "--",
    MIGRATIONS_PATH,
  )
    .split("\n")
    .filter((line) => line.length > 0);
  const problems: string[] = [];
  for (const change of changes) {
    const [status = "", path = ""] = change.split("\t");
    const file = path.slice(MIGRATIONS_PATH.length);
    if (status === "A") {
      if (MIGRATION_NAME.test(file) && Number(file.slice(0, 4)) <= highest) {
        problems.push(
          `${file}: added before the highest existing number ${String(highest).padStart(4, "0")} (EC-37)`,
        );
      }
      continue;
    }
    problems.push(
      `${file}: an existing migration is never ${status === "D" ? "deleted" : "modified"}; write a new one`,
    );
  }
  return problems;
}

const [base, head = "HEAD"] = process.argv.slice(2);
const problems = [
  ...namingProblems(migrationsAt(head)),
  ...(base === undefined || /^0+$/.test(base) ? [] : rangeProblems(base, head)),
];

if (problems.length > 0) {
  process.stderr.write(
    `Migration files refused (21 EC-32, EC-37):\n${problems.map((problem) => `  ${problem}`).join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write("migration files: ok\n");
}
