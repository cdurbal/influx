// CI check I-4 of docs/mvp/03 (and C-8 of 18): every commit of the pushed range that changes
// rights must carry `security-reviewed: YYYY-MM-DD` in its message. The founder's derogation
// removes Pull Requests (F-4): this marker is the trace of expert-cybersecurite's review.
//
// A commit "changes rights" when it touches:
// - a file of supabase/migrations/** whose added or removed lines contain one of the patterns of
//   03 P8 (audit.*, a policy, a GRANT, a REVOKE, a SECURITY DEFINER function, a role attribute);
// - the expected rights of T2 (packages/test-kit/src/rights/**), whatever the change (18 C-8).
//
// Usage: node scripts/check-security-review.ts <base> <head>. An all-zero or missing base (first
// push of a branch) checks the head commit only.
import { execFileSync } from "node:child_process";

const MARKER = /^security-reviewed: \d{4}-\d{2}-\d{2}\b/m;
const RIGHTS_PATH = "packages/test-kit/src/rights/";
const MIGRATIONS_PATH = "supabase/migrations/";
const SENSITIVE =
  /\baudit\.|\bpolicy\b|\bgrant\b|\brevoke\b|security\s+definer|\b(?:create|alter)\s+role\b|\b(?:no)?(?:bypassrls|superuser|createrole|login|inherit)\b/i;

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

function commitsOf(base: string | undefined, head: string): string[] {
  if (base === undefined || /^0+$/.test(base)) {
    return [head];
  }
  return git("rev-list", "--no-merges", `${base}..${head}`)
    .split("\n")
    .filter((line) => line.length > 0);
}

function changesRights(commit: string): boolean {
  const files = git("show", "--name-only", "--format=", commit)
    .split("\n")
    .filter((line) => line.length > 0);
  if (files.some((file) => file.startsWith(RIGHTS_PATH))) {
    return true;
  }
  return files
    .filter((file) => file.startsWith(MIGRATIONS_PATH))
    .some((file) =>
      git("show", "--format=", "--unified=0", commit, "--", file)
        .split("\n")
        .filter((line) => /^[+-](?![+-])/.test(line))
        .some((line) => SENSITIVE.test(line)),
    );
}

const [base, head = "HEAD"] = process.argv.slice(2);
const missing = commitsOf(base, head).filter(
  (commit) =>
    changesRights(commit) &&
    !MARKER.test(git("show", "--no-patch", "--format=%B", commit)),
);

if (missing.length > 0) {
  process.stderr.write(
    `Commits changing rights without "security-reviewed: <date>" (03 I-4, 18 C-8):\n${missing
      .map(
        (commit) =>
          `  ${git("show", "--no-patch", "--format=%h %s", commit).trim()}`,
      )
      .join("\n")}\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write("security review markers: ok\n");
}
