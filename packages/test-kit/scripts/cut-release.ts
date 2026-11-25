// `pnpm release:cut -- --version=vX.Y.Z [--commit=<sha>] [--dry-run] [--skip-ci-check] [--push]`
// (D71 amended 2026-11-25, docs/mvp/runbooks/production.md §6).
// Freezes a release candidate on `main` as an annotated SemVer tag `vX.Y.Z` and prepares the
// promotion branch `release/vX.Y.Z` for a pull request into `production`:
// 1. refuses the CI and a dirty working tree (unless --dry-run);
// 2. checks that `vX.Y.Z` is strict SemVer and strictly greater than every existing `v*` tag;
// 3. checks that the target commit (default: `main`) descends from `origin/production`, is on
//    `main`, passes the I-4 `security-reviewed:` check from the anchor `56b8046083f809ac82399e994f0415d12afc2188`,
//    and (unless --skip-ci-check) has a green `ci.yml` run on GitHub;
// 4. builds the release notes (migrations, security review attestations, commits since the
//    previous `v*` tag or `origin/production`);
// 5. creates the annotated tag `vX.Y.Z` and the branch `release/vX.Y.Z` locally, and with `--push`
//    (on the founder's explicit confirmation, CLAUDE.md §7 rule 4) pushes both and opens the PR
//    `release/vX.Y.Z → production`.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { REPOSITORY_ROOT } from "../src/operator-secrets.ts";
import {
  assertNextReleaseTag,
  buildReleaseNotes,
  releaseBranchOf,
} from "../src/release.ts";

const I4_ANCHOR = "56b8046083f809ac82399e994f0415d12afc2188";
const CHECK_SECURITY_REVIEW = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "check-security-review.ts",
);

if (process.env.CI !== undefined && process.env.CI !== "") {
  throw new Error(
    "cutting a release is the founder's action on a workstation, never the CI's",
  );
}

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
}

function isAncestor(ancestor: string, descendant: string): boolean {
  try {
    git("merge-base", "--is-ancestor", ancestor, descendant);
    return true;
  } catch {
    return false;
  }
}

function resolveRef(candidates: readonly string[]): string {
  for (const candidate of candidates) {
    try {
      return git("rev-parse", "--verify", `${candidate}^{commit}`);
    } catch {
      continue;
    }
  }
  throw new Error(`cannot resolve any of: ${candidates.join(", ")}`);
}

const { values } = parseArgs({
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    version: { type: "string" },
    commit: { type: "string", default: "HEAD" },
    "dry-run": { type: "boolean", default: false },
    "skip-ci-check": { type: "boolean", default: false },
    push: { type: "boolean", default: false },
  },
});

if (values.version === undefined || values.version.trim() === "") {
  throw new Error(
    "usage: pnpm release:cut -- --version=vX.Y.Z [--commit=<sha>] [--dry-run] [--skip-ci-check] [--push]",
  );
}
if (!values["dry-run"] && git("status", "--porcelain") !== "") {
  throw new Error(
    "working tree is not clean: commit or stash every change before cutting a release",
  );
}

const existingTags = git("tag", "--list", "v*")
  .split(/\r?\n/)
  .filter((line) => line.length > 0);
const { next, previous } = assertNextReleaseTag(values.version, existingTags);
const branch = releaseBranchOf(next);

const commitSha = resolveRef([values.commit]);
const mainSha = resolveRef(["refs/heads/main", "refs/remotes/origin/main"]);
const productionSha = resolveRef([
  "refs/remotes/origin/production",
  "refs/heads/production",
]);

if (!isAncestor(commitSha, mainSha)) {
  throw new Error(
    `commit ${commitSha.slice(0, 12)} is not on main: a release is only cut from main`,
  );
}
if (!isAncestor(productionSha, commitSha)) {
  throw new Error(
    `commit ${commitSha.slice(0, 12)} does not descend from production (${productionSha.slice(0, 12)})`,
  );
}
if (commitSha === productionSha) {
  throw new Error(
    `commit ${commitSha.slice(0, 12)} is already the head of production: nothing to release`,
  );
}

// Blocking I-4 check before the tag is created: an unattested security commit would fail on the
// `release/vX.Y.Z → production` pull request.
execFileSync(
  process.execPath,
  [CHECK_SECURITY_REVIEW, productionSha, commitSha, I4_ANCHOR],
  {
    cwd: REPOSITORY_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  },
);

if (!values["skip-ci-check"]) {
  const runs = execFileSync(
    "gh",
    [
      "run",
      "list",
      "--workflow",
      "ci.yml",
      "--commit",
      commitSha,
      "--status",
      "success",
      "--limit",
      "1",
      "--json",
      "databaseId",
    ],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  ).trim();
  const parsed: unknown = JSON.parse(runs);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(
      `no successful ci.yml run found on GitHub for ${commitSha.slice(0, 12)} ` +
        "(wait for CI on main, or pass --skip-ci-check for an offline dry-run)",
    );
  }
}

const baseRef = previous !== null ? previous.tag : productionSha;
const baseLabel =
  previous !== null
    ? previous.tag
    : `production (${productionSha.slice(0, 7)})`;
const range = `${baseRef}..${commitSha}`;

const migrations = git(
  "diff",
  "--name-only",
  "--diff-filter=A",
  range,
  "--",
  "supabase/migrations/",
)
  .split(/\r?\n/)
  .filter((line) => line.endsWith(".sql"))
  .sort();

const commits = git("log", "--no-merges", "--format=%h %s", range)
  .split(/\r?\n/)
  .filter((line) => line.length > 0);

const attestations = git(
  "log",
  "--no-merges",
  "--grep=^security-reviewed:",
  "--format=%h %s",
  range,
)
  .split(/\r?\n/)
  .filter((line) => line.length > 0);

const notes = buildReleaseNotes({
  version: next,
  commitSha,
  baseLabel,
  migrations,
  attestations,
  commits,
});

if (values["dry-run"]) {
  process.stdout.write(`${notes}\n`);
  process.exit(0);
}

git("tag", "-a", next.tag, commitSha, "-m", notes);
git("branch", "-f", branch, next.tag);

if (values.push) {
  git("push", "origin", next.tag);
  git("push", "-u", "origin", branch);
  const prUrl = execFileSync(
    "gh",
    [
      "pr",
      "create",
      "--base",
      "production",
      "--head",
      branch,
      "--title",
      `release: ${next.tag}`,
      "--body",
      notes,
    ],
    { cwd: REPOSITORY_ROOT, encoding: "utf8" },
  ).trim();
  process.stdout.write(
    `tag ${next.tag} and branch ${branch} pushed; PR opened: ${prUrl}\n`,
  );
} else {
  process.stdout.write(
    `annotated tag ${next.tag} and branch ${branch} created locally at ${commitSha.slice(0, 12)}.\n` +
      "Next (founder confirmation, CLAUDE.md §7 rule 4):\n" +
      `  git push origin ${next.tag} && git push -u origin ${branch}\n` +
      `  gh pr create --base production --head ${branch} --title "release: ${next.tag}" --body-file <(git tag -l -n999 ${next.tag})\n`,
  );
}
