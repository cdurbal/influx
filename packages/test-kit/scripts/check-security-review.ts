// CI check I-4 of docs/mvp/03 (and C-8 of 18): every commit of the pushed range that changes
// rights must carry `security-reviewed: YYYY-MM-DD` in its message. The founder's derogation
// removes Pull Requests (F-4): this marker is the trace of expert-cybersecurite's review.
//
// A commit "changes rights" when it touches:
// - a file of supabase/migrations/** whose added or removed lines contain one of the patterns of
//   03 P8 (audit.*, a policy, a GRANT, a REVOKE, a SECURITY DEFINER function, a role attribute),
//   or the schema of the Supabase Auth hooks (`auth_hooks`, EC-48);
// - the expected rights of T2 (packages/test-kit/src/rights/**), whatever the change (18 C-8);
// - the signed list of elevated operations (packages/contracts/src/elevated-operations.ts), the
//   relay files of both fronts and their browser relay client, whatever the change (J3S-9 of the
//   end-of-J3 security review): their SHA-256 pins force a conscious gesture, the marker records
//   expert-cybersecurite's reading;
// - a line of supabase/config.toml, added or removed, that belongs to a section `[auth]` or
//   `[auth.*]` (sign-up, hooks, TOTP, code length and lifetime, rate limits), `[api]` or `[api.*]`
//   (schemas exposed to the Data API), `[storage*]`, `[db.network_restrictions]`,
//   `[db.ssl_enforcement]`, `[db.vault]`, `[edge_runtime.secrets]`, or ANY section `[remotes.<name>]`
//   or `[remotes.<name>.*]` — a remote override goes to a hosted project, whatever the key, dotted
//   keys and inline tables included (EC-48, 21 §3, widened by expert-cybersecurite on 2026-09-27;
//   C5-1 of the review of J3 commits 5 and 6). Section names are normalised (quotes and spaces
//   removed: `["storage"]` is `[storage]`). A section header that is added, removed or renamed
//   counts as a line of that section.
//
// Usage: node scripts/check-security-review.ts <base> <head>. An all-zero or missing base (first
// push of a branch) checks the head commit only. Runs in the current directory's repository.
import { execFileSync } from "node:child_process";

const MARKER = /^security-reviewed: \d{4}-\d{2}-\d{2}\b/m;
const RIGHTS_PATH = "packages/test-kit/src/rights/";
/** Files whose every change is a security change (J3S-9), in both fronts for the relay. */
const SECURITY_FILES: readonly string[] = [
  "packages/contracts/src/elevated-operations.ts",
  ...["apps/web", "apps/backoffice"].flatMap((front) =>
    [
      "src/app/api/[...path]/route.ts",
      "src/server/relay.ts",
      "src/server/api-client.ts",
      "src/config/server.ts",
      "src/browser/relay-client.ts",
    ].map((file) => `${front}/${file}`),
  ),
];
const MIGRATIONS_PATH = "supabase/migrations/";
const SUPABASE_CONFIG = "supabase/config.toml";
const SENSITIVE =
  /\baudit\.|\bpolicy\b|\bgrant\b|\brevoke\b|security\s+definer|\b(?:create|alter)\s+role\b|\b(?:no)?(?:bypassrls|superuser|createrole|login|inherit)\b|\bauth_hooks\b/i;
/** Sections of supabase/config.toml whose lines are security settings (EC-48). */
const SENSITIVE_SECTION =
  /^(?:remotes\..+|auth|auth\..+|api|api\..+|storage.*|db\.network_restrictions(?:\..+)?|db\.ssl_enforcement(?:\..+)?|db\.vault(?:\..+)?|edge_runtime\.secrets(?:\..+)?)$/;
const SECTION_HEADER = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/;

function git(...args: string[]): string {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
}

function commitsOf(base: string | undefined, head: string): string[] {
  if (base === undefined || /^0+$/.test(base)) {
    return [head];
  }
  return git("rev-list", "--no-merges", `${base}..${head}`)
    .split("\n")
    .filter((line) => line.length > 0);
}

/** The content of `file` at `revision`, as lines; empty when the file does not exist there. */
function linesAt(revision: string, file: string): string[] {
  try {
    return git("show", `${revision}:${file}`).split("\n");
  } catch {
    return [];
  }
}

/** The section governing line `number` (1-based) of a TOML file; "" before any header. */
function sectionOf(lines: readonly string[], number: number): string {
  for (let index = Math.min(number, lines.length) - 1; index >= 0; index -= 1) {
    const header = SECTION_HEADER.exec(lines[index] ?? "");
    if (header !== null) {
      // normalised: `[auth."email"]`, `['storage']` and `[ auth . email ]` name the same section
      return (header[1] ?? "").replace(/["'\s]/g, "");
    }
  }
  return "";
}

/**
 * True when an added or removed line of supabase/config.toml belongs to a sensitive section. The
 * section of an added line is read in the new file, the one of a removed line in the old file.
 */
function changesSensitiveConfig(commit: string): boolean {
  const diff = git(
    "show",
    "--format=",
    "--unified=0",
    "--no-color",
    commit,
    "--",
    SUPABASE_CONFIG,
  ).split("\n");
  const after = linesAt(commit, SUPABASE_CONFIG);
  const before = linesAt(`${commit}^`, SUPABASE_CONFIG);
  let oldLine = 0;
  let newLine = 0;
  for (const line of diff) {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk !== null) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      continue;
    }
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("-")) {
      if (SENSITIVE_SECTION.test(sectionOf(before, oldLine))) {
        return true;
      }
      oldLine += 1;
    } else if (line.startsWith("+")) {
      if (SENSITIVE_SECTION.test(sectionOf(after, newLine))) {
        return true;
      }
      newLine += 1;
    }
  }
  return false;
}

function changesRights(commit: string): boolean {
  const files = git("show", "--name-only", "--format=", commit)
    .split("\n")
    .filter((line) => line.length > 0);
  if (
    files.some(
      (file) => file.startsWith(RIGHTS_PATH) || SECURITY_FILES.includes(file),
    )
  ) {
    return true;
  }
  if (files.includes(SUPABASE_CONFIG) && changesSensitiveConfig(commit)) {
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
    `Commits changing rights without "security-reviewed: <date>" (03 I-4, 18 C-8, EC-48, J3S-9):\n${missing
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
