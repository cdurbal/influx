// Witness commits for the I-4 marker check (docs/mvp/03 I-4, 18 C-8; EC-48 of 21 §3, widened by
// expert-cybersecurite on 2026-09-27): a throw-away Git repository receives one commit per case,
// and the real script is run on each range, exactly as the CI runs it. Nothing touches the
// project's own repository.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../scripts/check-security-review.ts",
);
const MARKER = "\n\nsecurity-reviewed: 2026-09-27";

const BASE_CONFIG = `project_id = "witness"

[api]
enabled = true
schemas = ["public", "graphql_public"]

[db]
port = 54322

[auth]
enabled = true
enable_signup = false

[auth.email]
otp_expiry = 600

[auth.hook.send_email]
enabled = true

[storage]
enabled = true

[analytics]
enabled = true

[db.network_restrictions]
enabled = false

[remotes.staging]
project_id = "witness-staging"
`;

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

function write(file: string, content: string): void {
  const target = path.join(repository, file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/** Commits the given files and returns the new commit. */
function commit(message: string, files: Record<string, string>): string {
  for (const [file, content] of Object.entries(files)) {
    write(file, content);
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

/** Runs the check on the single commit made by `make`, on top of the current head. */
function checkOne(make: () => string): { status: number; output: string } {
  const before = git("rev-parse", "HEAD");
  const after = make();
  return check(before, after);
}

function editConfig(from: string, to: string): Record<string, string> {
  if (!BASE_CONFIG.includes(from)) {
    throw new Error(`witness config has no ${from}`);
  }
  return { "supabase/config.toml": BASE_CONFIG.replace(from, to) };
}

beforeAll(() => {
  repository = mkdtempSync(path.join(tmpdir(), "influx-i4-witness-"));
  git("init", "--quiet", "--initial-branch=main");
  commit(`chore: witness baseline${MARKER}`, {
    "supabase/config.toml": BASE_CONFIG,
    "README.md": "witness\n",
  });
});

afterAll(() => {
  rmSync(repository, { recursive: true, force: true });
});

describe("I-4 marker check on supabase/config.toml (EC-48)", () => {
  // Each case starts from the baseline config again, so that each diff holds one change only.
  function fromBaseline(
    message: string,
    files: Record<string, string>,
  ): () => string {
    return () => {
      commit(`chore: reset${MARKER}`, { "supabase/config.toml": BASE_CONFIG });
      const before = git("rev-parse", "HEAD");
      const after = commit(message, files);
      return `${before}..${after}`;
    };
  }

  function run(make: () => string): { status: number; output: string } {
    const [before, after] = make().split("..");
    return check(before ?? "", after ?? "");
  }

  it.each([
    ["[auth] enable_signup", "enable_signup = false", "enable_signup = true"],
    ["[auth.email] otp_expiry", "otp_expiry = 600", "otp_expiry = 3600"],
    [
      "[auth.hook.send_email] enabled",
      "[auth.hook.send_email]\nenabled = true",
      "[auth.hook.send_email]\nenabled = false",
    ],
    [
      "[api] schemas",
      'schemas = ["public", "graphql_public"]',
      'schemas = ["public", "graphql_public", "identity"]',
    ],
    [
      "[storage] enabled",
      "[storage]\nenabled = true",
      "[storage]\nenabled = false",
    ],
    [
      "a renamed [auth] section header",
      "[auth.hook.send_email]",
      "[auth.hook.send_sms]",
    ],
  ])("fails without the marker on %s", (_label, from, to) => {
    const result = run(
      fromBaseline("chore: unreviewed change", editConfig(from, to)),
    );
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain("chore: unreviewed change");
  });

  // C5-1 (review of J3 commits 5 and 6): the three bypasses found on witness commits.
  it.each([
    [
      "a dotted auth key under [remotes.staging]",
      'project_id = "witness-staging"',
      'project_id = "witness-staging"\nauth.enable_signup = true',
    ],
    [
      "an inline auth table under [remotes.staging]",
      'project_id = "witness-staging"',
      'project_id = "witness-staging"\nauth = { enable_signup = true }',
    ],
    [
      "any key of [remotes.staging]",
      'project_id = "witness-staging"',
      'project_id = "other-project"',
    ],
    [
      'a quoted header ["storage"]',
      "[analytics]",
      '["storage"]\nfile_size_limit = "5GiB"\n\n[analytics]',
    ],
    [
      'a quoted header [auth."email"]',
      "[analytics]",
      '[auth."email"]\notp_expiry = 3600\n\n[analytics]',
    ],
    [
      "[db.network_restrictions] enabled",
      "[db.network_restrictions]\nenabled = false",
      "[db.network_restrictions]\nenabled = true",
    ],
    [
      "a new [db.ssl_enforcement] section",
      "[analytics]",
      "[db.ssl_enforcement]\nenabled = false\n\n[analytics]",
    ],
    [
      "a new [db.vault] section",
      "[analytics]",
      '[db.vault]\nsecret_key = "env(SECRET_VALUE)"\n\n[analytics]',
    ],
    [
      "a new [edge_runtime.secrets] section",
      "[analytics]",
      '[edge_runtime.secrets]\nsecret_key = "env(SECRET_VALUE)"\n\n[analytics]',
    ],
  ])("fails without the marker on %s (C5-1)", (_label, from, to) => {
    const result = run(
      fromBaseline("chore: unreviewed change", editConfig(from, to)),
    );
    expect(result.status, result.output).toBe(1);
  });

  it("fails on an [auth] line added at the end of a remote override section", () => {
    const result = run(
      fromBaseline("chore: remote override", {
        "supabase/config.toml": `${BASE_CONFIG}\n[remotes.staging.auth]\nenable_signup = true\n`,
      }),
    );
    expect(result.status, result.output).toBe(1);
  });

  it("passes with the marker on the same [auth] change", () => {
    const result = run(
      fromBaseline(
        `chore: reviewed change${MARKER}`,
        editConfig("enable_signup = false", "enable_signup = true"),
      ),
    );
    expect(result.status, result.output).toBe(0);
  });

  it.each([
    ["[db] port", "port = 54322", "port = 54330"],
    [
      "[analytics] enabled",
      "[analytics]\nenabled = true",
      "[analytics]\nenabled = false",
    ],
    ["the root project_id", 'project_id = "witness"', 'project_id = "other"'],
  ])(
    "passes without the marker on %s (not a security section)",
    (_label, from, to) => {
      const result = run(
        fromBaseline("chore: unrelated change", editConfig(from, to)),
      );
      expect(result.status, result.output).toBe(0);
    },
  );
});

describe("I-4 marker check on migrations and expected rights", () => {
  it("fails without the marker on a migration that mentions auth_hooks (EC-48)", () => {
    const result = checkOne(() =>
      commit("feat(db): hook schema", {
        "supabase/migrations/9001_witness.sql":
          "create schema if not exists auth_hooks;\n",
      }),
    );
    expect(result.status, result.output).toBe(1);
  });

  it("fails without the marker on a migration that grants a right", () => {
    const result = checkOne(() =>
      commit("feat(db): grant", {
        "supabase/migrations/9002_witness.sql":
          "grant select on identity.accounts to influx_agent;\n",
      }),
    );
    expect(result.status, result.output).toBe(1);
  });

  it("fails without the marker on the expected rights of T2 (C-8)", () => {
    const result = checkOne(() =>
      commit("test: expected rights", {
        "packages/test-kit/src/rights/expected-rights.ts": "export {};\n",
      }),
    );
    expect(result.status, result.output).toBe(1);
  });

  // J3S-9 (end-of-J3 security review): the signed list P and the relay files of both fronts.
  it.each([
    "packages/contracts/src/elevated-operations.ts",
    "apps/web/src/server/relay.ts",
    "apps/web/src/app/api/[...path]/route.ts",
    "apps/backoffice/src/server/api-client.ts",
    "apps/backoffice/src/config/server.ts",
    "apps/web/src/browser/relay-client.ts",
  ])("fails without the marker on any change of %s (J3S-9)", (file) => {
    const result = checkOne(() =>
      commit("refactor: harmless-looking change", {
        [file]: `// ${file}\n`,
      }),
    );
    expect(result.status, result.output).toBe(1);
  });

  it("passes without the marker on a front file outside the relay (J3S-9)", () => {
    const result = checkOne(() =>
      commit("feat(web): a page", {
        "apps/web/src/app/page.tsx": "export {};\n",
      }),
    );
    expect(result.status, result.output).toBe(0);
  });

  it("passes without the marker on a migration without any sensitive pattern", () => {
    const result = checkOne(() =>
      commit("feat(db): plain table", {
        "supabase/migrations/9003_witness.sql":
          "create table if not exists reference.witness (id int);\n",
      }),
    );
    expect(result.status, result.output).toBe(0);
  });

  it("reports only the unreviewed commits of a range", () => {
    const before = git("rev-parse", "HEAD");
    commit(`feat(db): reviewed${MARKER}`, {
      "supabase/migrations/9004_witness.sql":
        "revoke all on reference.witness from public;\n",
    });
    commit("feat(db): unreviewed", {
      "supabase/migrations/9005_witness.sql":
        "revoke all on reference.witness from anon;\n",
    });
    const after = commit("docs: unrelated", { "README.md": "witness 2\n" });
    const result = check(before, after);
    expect(result.status, result.output).toBe(1);
    expect(result.output).toContain("feat(db): unreviewed");
    expect(result.output).not.toContain("feat(db): reviewed");
    expect(result.output).not.toContain("docs: unrelated");
  });
});
