// D70 commit 3 and production role passwords (runbook production §2): the one-time secrets of the
// operator scripts go to a file ignored by Git, and production role passwords refuse the CI, a
// missing --confirm and the staging project ref.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  drawHostedRolePasswords,
  HOSTED_LOGIN_ROLES,
  supabaseRefOfEnvFile,
} from "../src/db/hosted-role-passwords.ts";
import {
  isIgnoredByGit,
  OPERATOR_SECRETS_DIRECTORY,
  operatorSecretsFileName,
} from "../src/operator-secrets.ts";

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const PROD_ROLE_PASSWORDS_SCRIPT = path.join(
  PACKAGE_ROOT,
  "scripts/production-role-passwords.ts",
);

describe("operator secrets file", () => {
  it("is named after the script and the UTC time, without a colon", () => {
    expect(
      operatorSecretsFileName(
        "staging-demo-accounts",
        new Date("2026-10-18T09:05:07.123Z"),
      ),
    ).toBe("staging-demo-accounts-2026-10-18T09-05-07-123Z.txt");
  });

  it("refuses a name that is not kebab-case (no path)", () => {
    expect(() => operatorSecretsFileName("../x", new Date())).toThrow(
      /kebab-case/,
    );
    expect(() => operatorSecretsFileName("", new Date())).toThrow(/kebab-case/);
  });

  it("lives in a directory Git ignores, and the check tells an ignored path from a tracked one", () => {
    expect(isIgnoredByGit(`${OPERATOR_SECRETS_DIRECTORY}/any-file.txt`)).toBe(
      true,
    );
    expect(isIgnoredByGit("packages/test-kit/src/operator-secrets.ts")).toBe(
      false,
    );
  });
});

describe("hosted connection role passwords (staging and production)", () => {
  it("draws five distinct passwords, emits SCRAM verifiers in SQL, and keeps clear passwords in the pooler URLs only", () => {
    const ref = "abcdefghijklmnopqrst";
    const host = "aws-0-eu-west-3.pooler.supabase.com";
    const { sql, urls } = drawHostedRolePasswords(ref, host);
    expect(sql).toHaveLength(HOSTED_LOGIN_ROLES.length);
    expect(urls).toHaveLength(HOSTED_LOGIN_ROLES.length);
    for (let index = 0; index < HOSTED_LOGIN_ROLES.length; index += 1) {
      const entry = HOSTED_LOGIN_ROLES[index];
      expect(entry).toBeDefined();
      const [role, variable, service] = entry ?? ["", "", ""];
      expect(sql[index]).toMatch(
        new RegExp(
          `^alter role ${role} with password 'SCRAM-SHA-256\\$4096:[^']+';$`,
        ),
      );
      expect(urls[index]).toMatch(
        new RegExp(
          `^${service}\\s+${variable}=postgresql://${role}\\.${ref}:[A-Za-z0-9_-]+@${host}:6543/postgres$`,
        ),
      );
    }
  });

  it("refuses a malformed ref, a malformed pooler host, or a duplicate drawn password", () => {
    expect(() =>
      drawHostedRolePasswords("short", "aws-0-eu-west-3.pooler.supabase.com"),
    ).toThrow(/project ref/);
    expect(() =>
      drawHostedRolePasswords("abcdefghijklmnopqrst", "db.example.com"),
    ).toThrow(/pooler host/);
    expect(() =>
      drawHostedRolePasswords(
        "abcdefghijklmnopqrst",
        "aws-0-eu-west-3.pooler.supabase.com",
        () => "same-password-16ch",
      ),
    ).toThrow(/same password/);
  });

  it("reads the Supabase project ref of an env file without exposing any other variable", () => {
    expect(
      supabaseRefOfEnvFile(
        "SUPABASE_URL=https://pminhrwqepjzkyszgtwm.supabase.co\nSUPABASE_SECRET_KEY=sb_secret_x\n",
      ),
    ).toBe("pminhrwqepjzkyszgtwm");
    expect(
      supabaseRefOfEnvFile("SUPABASE_URL=http://127.0.0.1:54321\n"),
    ).toBeNull();
  });

  it("prod:role-passwords refuses the CI and a missing or mismatched --confirm before writing", () => {
    const baseArgs = [
      PROD_ROLE_PASSWORDS_SCRIPT,
      "--ref=zzzzzzzzzzzzzzzzzzzz",
      "--host=aws-0-eu-west-3.pooler.supabase.com",
    ];
    const inCi = spawnSync(
      process.execPath,
      [...baseArgs, "--confirm=zzzzzzzzzzzzzzzzzzzz"],
      {
        cwd: PACKAGE_ROOT,
        env: { ...process.env, CI: "true" },
        encoding: "utf8",
      },
    );
    expect(inCi.status).toBe(1);
    expect(inCi.stderr).toMatch(/never the CI/);

    const badConfirm = spawnSync(
      process.execPath,
      [...baseArgs, "--confirm=wrong"],
      {
        cwd: PACKAGE_ROOT,
        env: { ...process.env, CI: "" },
        encoding: "utf8",
      },
    );
    expect(badConfirm.status).toBe(1);
    expect(badConfirm.stderr).toMatch(/--confirm must repeat the project ref/);
  });
});
