// Witness commits for the migration file check (docs/mvp/21 §3, EC-32 and EC-37): a throw-away
// Git repository receives one commit per case, and the real script is run on each range, exactly
// as the CI runs it. Nothing touches the project's own repository.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/check-migrations.ts",
);
const MIGRATIONS = "supabase/migrations";

let repository: string;

function git(...args: string[]): string {
  return execFileSync(
    "git",
    [
      "-c",
      "user.name=witness",
      "-c",
      "user.email=witness@example.test",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.autocrlf=false",
      ...args,
    ],
    { cwd: repository, encoding: "utf8" },
  ).trim();
}

/** Commits the given changes (null deletes the file) and returns the new commit. */
function commit(message: string, files: Record<string, string | null>): string {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(repository, file);
    if (content === null) {
      rmSync(target);
      continue;
    }
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
  git("add", "--all");
  git("commit", "--quiet", "--allow-empty", "--message", message);
  return git("rev-parse", "HEAD");
}

function check(base: string, head: string): { status: number; output: string } {
  const result = spawnSync(process.execPath, [SCRIPT, base, head], {
    cwd: repository,
    encoding: "utf8",
  });
  return {
    status: result.status ?? -1,
    output: `${result.stdout}${result.stderr}`,
  };
}

/** Runs the check on the single commit made from `files`, then reverts it for the next case. */
function checkOne(files: Record<string, string | null>): {
  status: number;
  output: string;
} {
  const before = git("rev-parse", "HEAD");
  const after = commit("witness change", files);
  const result = check(before, after);
  git("reset", "--quiet", "--hard", before);
  return result;
}

beforeAll(() => {
  repository = mkdtempSync(path.join(tmpdir(), "influx-migrations-witness-"));
  git("init", "--quiet", "--initial-branch=main");
  commit("chore: witness baseline", {
    [`${MIGRATIONS}/0001_init.sql`]: "select 1;\n",
    [`${MIGRATIONS}/0002_next.sql`]: "select 2;\n",
    "README.md": "witness\n",
  });
});

afterAll(() => {
  rmSync(repository, { recursive: true, force: true });
});

describe("migration files (EC-32, EC-37)", () => {
  it("passes on a new file numbered after the highest one", () => {
    const result = checkOne({ [`${MIGRATIONS}/0003_ops.sql`]: "select 3;\n" });
    expect(result.status, result.output).toBe(0);
  });

  it("passes on a range that touches no migration", () => {
    const result = checkOne({ "README.md": "witness 2\n" });
    expect(result.status, result.output).toBe(0);
  });

  it.each([
    "0003-ops.sql",
    "3_ops.sql",
    "0003_Ops.sql",
    "0003_ops.SQL",
    "ops.sql",
  ])("refuses the malformed name %s (EC-32)", (name) => {
    const result = checkOne({ [`${MIGRATIONS}/${name}`]: "select 3;\n" });
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain(name);
  });

  it("refuses a number already used", () => {
    const result = checkOne({
      [`${MIGRATIONS}/0002_other.sql`]: "select 2;\n",
    });
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain("already used");
  });

  it("refuses a new file numbered before the highest existing one (EC-37)", () => {
    const before = git("rev-parse", "HEAD");
    commit("chore: remove 0001", { [`${MIGRATIONS}/0001_init.sql`]: null });
    const base = git("rev-parse", "HEAD");
    const after = commit("feat(db): slipped in", {
      [`${MIGRATIONS}/0001_slipped.sql`]: "select 1;\n",
    });
    const result = check(base, after);
    git("reset", "--quiet", "--hard", before);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain("0001_slipped.sql");
  });

  it("refuses a change to an applied migration", () => {
    const result = checkOne({
      [`${MIGRATIONS}/0001_init.sql`]: "select 'changed';\n",
    });
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain("never modified");
  });

  it("refuses the deletion of an applied migration", () => {
    const result = checkOne({ [`${MIGRATIONS}/0002_next.sql`]: null });
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain("never deleted");
  });

  it("checks the names only on a first push (all-zero base)", () => {
    const head = git("rev-parse", "HEAD");
    const result = check("0".repeat(40), head);
    expect(result.status, result.output).toBe(0);
  });
});
