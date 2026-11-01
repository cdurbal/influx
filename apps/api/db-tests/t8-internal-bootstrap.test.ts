// The bootstrap of the backoffice of an empty project (03 MFA-10, B7; EC-45; runbook production
// §0): the first admin and the break-glass account, run on the local stack through the core of
// scripts/bootstrap-production-admins.ts. The guards of the production CLI that need no database
// are run as a process. The break-glass flag is released in afterAll (unique partial index).
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { requireLocalAuth, type LocalAuthStack } from "@influx/test-kit/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomInternalPassword } from "../scripts/demo-accounts.ts";
import {
  bootstrapInternalAdmins,
  checkBootstrapRequest,
  mailboxOf,
  type BootstrapAccount,
  type BootstrapRequest,
} from "../scripts/internal-bootstrap.ts";
import { enrollmentTokenHashOf } from "../src/domains/identity/mfa-secrets.ts";
import { migrationRole } from "./support.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

let local: LocalAuthStack;

beforeAll(async () => {
  local = await requireLocalAuth();
});

afterAll(async () => {
  await migrationRole()`
    update identity.agent_profiles set is_break_glass = false
     where is_break_glass and account_id in (
       select id from identity.accounts where email like 'boot-%@example.test')`;
  const users = await migrationRole()<{ id: string }[]>`
    select id::text from auth.users where email like 'boot-%@example.test'`;
  for (const { id } of users) {
    await fetch(`${local.authUrl}/admin/users/${id}`, {
      method: "DELETE",
      headers: {
        apikey: local.secretKey,
        authorization: `Bearer ${local.secretKey}`,
      },
    });
  }
});

function account(email: string, isBreakGlass: boolean): BootstrapAccount {
  return {
    email,
    password: randomInternalPassword(email),
    enrollmentToken: randomBytes(32).toString("base64url"),
    firstName: isBreakGlass ? "Break glass" : "Founder",
    isBreakGlass,
  };
}

function request(tag = randomBytes(4).toString("hex")): BootstrapRequest {
  return {
    admin: account(`boot-${tag}-admin@example.test`, false),
    breakGlass: account(`boot-${tag}-glass@example.test`, true),
    countryCode: "GB",
    preferredLanguage: "en",
  };
}

async function breakGlassAccounts(): Promise<number> {
  const [row] = await migrationRole()<{ count: number }[]>`
    select count(*)::int as count from identity.agent_profiles where is_break_glass`;
  return row?.count ?? 0;
}

describe("MFA-10, B7: the bootstrap of the first admin and of the break-glass account", () => {
  it("refuses a break-glass address that reaches the admin's mailbox", () => {
    expect(mailboxOf("Jane.Doe+ops@GMail.com")).toBe("janedoe@gmail.com");
    expect(mailboxOf("a+x@influx.example")).toBe("a@influx.example");
    const aliased = request();
    aliased.breakGlass = account("boot-x-admin+glass@example.test", true);
    aliased.admin = account("boot-x-admin@example.test", false);
    expect(() => checkBootstrapRequest(aliased)).toThrow(/alias/);
    const lowercase = request();
    lowercase.countryCode = "gb";
    expect(() => checkBootstrapRequest(lowercase)).toThrow(/ISO 3166-1/);
  });

  it("creates two admins, one flagged break-glass, each with an enrollment token, and refuses a second break-glass", async () => {
    const released = await breakGlassAccounts();
    if (released > 0) {
      // Another file left one: this test needs the slot (unique partial index).
      await migrationRole()`update identity.agent_profiles set is_break_glass = false where is_break_glass`;
    }
    const first = request();
    const gotrue = { authUrl: local.authUrl, secretKey: local.secretKey };
    await bootstrapInternalAdmins(migrationRole(), gotrue, first);

    const rows = await migrationRole()<
      {
        email: string;
        role: string;
        is_break_glass: boolean;
        country: string;
      }[]
    >`
      select a.email, r.role::text as role, p.is_break_glass, a.country_code as country
        from identity.accounts a
        join identity.account_roles r on r.account_id = a.id
        join identity.agent_profiles p on p.account_id = a.id
        join auth.users u on u.id = a.auth_user_id
       where a.email in (${first.admin.email}, ${first.breakGlass.email})
       order by p.is_break_glass`;
    expect(
      rows.map((row) => [row.role, row.is_break_glass, row.country]),
    ).toEqual([
      ["admin", false, "GB"],
      ["admin", true, "GB"],
    ]);
    for (const each of [first.admin, first.breakGlass]) {
      const [valid] = await migrationRole()<{ valid: boolean }[]>`
        select exists (
          select 1 from identity.mfa_enrollment_tokens t
            join identity.accounts a on a.id = t.account_id
           where a.email = ${each.email}
             and t.token_hash = ${enrollmentTokenHashOf(each.enrollmentToken)}
             and t.consumed_at is null and t.expires_at > now()) as valid`;
      expect(valid?.valid).toBe(true);
    }

    await expect(
      bootstrapInternalAdmins(migrationRole(), gotrue, first),
    ).rejects.toThrow(/already known/);
    const second = request();
    await expect(
      bootstrapInternalAdmins(migrationRole(), gotrue, second),
    ).rejects.toThrow(/break-glass account already exists/);
    const [orphans] = await migrationRole()<{ count: number }[]>`
      select count(*)::int as count from auth.users
       where email in (${second.admin.email}, ${second.breakGlass.email})`;
    expect(orphans?.count).toBe(0);
  });

  it("EC-45: the production CLI refuses the CI and a key of another project, before any connection", async () => {
    const run = promisify(execFile);
    const base = {
      ...process.env,
      SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
      SUPABASE_SECRET_KEY: "sb_secret_fake",
      INFLUX_PUBLIC_BACKOFFICE_URL: "https://backoffice.influx.example",
      INFLUX_PRODUCTION_MIGRATION_URL:
        "postgresql://postgres:fake@db.zzzzzzzzzzzzzzzz.supabase.co:5432/postgres",
    };
    const args = [
      "scripts/bootstrap-production-admins.ts",
      "--admin=a@influx.example",
      "--admin-first-name=A",
      "--break-glass=b@influx.example",
      "--country=GB",
      "--confirm=abcdefghijklmnop",
    ];
    for (const [env, message] of [
      [{ ...base, CI: "true" }, /never the CI/],
      [{ ...base, CI: "" }, /two different projects/],
      [
        {
          ...base,
          CI: "",
          INFLUX_PRODUCTION_MIGRATION_URL:
            "postgresql://postgres:fake@db.abcdefghijklmnop.supabase.co:5432/postgres",
        },
        null,
      ],
    ] as const) {
      const attempt = run(
        process.execPath,
        message === null ? [...args.slice(0, -1), "--confirm=wrong"] : args,
        { cwd: API_ROOT, env, timeout: 60_000 },
      );
      await expect(attempt).rejects.toMatchObject({
        code: 1,
        stderr: expect.stringMatching(
          message ?? /--confirm must be the project ref/,
        ),
      });
    }
  });
});
