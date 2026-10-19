// One-time secrets of the operator scripts of staging (docs/mvp/archives/jalons/d70-plan.md, commit 3): the
// passwords and activation links of the demonstration accounts, the passwords of the connection
// roles. They are NEVER printed (the output of an agent's command lands in its conversation): they
// are written to a file of OPERATOR_SECRETS_DIRECTORY, readable by its owner only, and the file is
// refused unless Git ignores it (`git check-ignore`). The caller prints the path, never the content.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The repository root, from this file (packages/test-kit/src). */
export const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/** Ignored by .gitignore; one file per run, never committed. */
export const OPERATOR_SECRETS_DIRECTORY = ".operator-secrets";

/** `<what>-<UTC timestamp>.txt`: `what` is a kebab-case name of the script. */
export function operatorSecretsFileName(what: string, now: Date): string {
  if (!/^[a-z][a-z0-9-]{0,40}$/.test(what)) {
    throw new Error("the name of an operator secrets file is kebab-case");
  }
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return `${what}-${stamp}.txt`;
}

/** True when Git ignores `relative` (a path from the repository root, existing or not). */
export function isIgnoredByGit(relative: string): boolean {
  try {
    execFileSync("git", ["check-ignore", "--quiet", "--", relative], {
      cwd: REPOSITORY_ROOT,
      stdio: "ignore",
    });
    return true;
  } catch {
    // check-ignore exits with 1 when the path is not ignored (128 outside a repository).
    return false;
  }
}

/**
 * Writes `lines` to a new file of OPERATOR_SECRETS_DIRECTORY (mode 0600, never overwritten) and
 * returns its path relative to the repository root. Refused, before anything is written, when Git
 * would not ignore the file.
 */
export function writeOperatorSecrets(
  what: string,
  lines: readonly string[],
  now: Date = new Date(),
): string {
  const relative = path.posix.join(
    OPERATOR_SECRETS_DIRECTORY,
    operatorSecretsFileName(what, now),
  );
  if (!isIgnoredByGit(relative)) {
    throw new Error(
      `${relative} is not ignored by Git: refused, nothing written (.gitignore)`,
    );
  }
  const directory = path.join(REPOSITORY_ROOT, OPERATOR_SECRETS_DIRECTORY);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  writeFileSync(path.join(REPOSITORY_ROOT, relative), `${lines.join("\n")}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  return relative;
}
