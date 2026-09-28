// J3, commit 5 — the Supabase Auth settings and the "sink" send-e-mail hook (docs/mvp/21 §4, J3-A
// a1 to a6, EC-16, EC-41, EC-38 point 4; migration 0010).
// 1. Static: supabase/config.toml carries the settings decided in J3-A and by the security review
//    (a file test, as J3-A a2 asks: a 10-minute wait is not a test).
// 2. In base: auth_hooks.refuse_native_email() refuses with a constant, reads nothing of its
//    argument, and only supabase_auth_admin (the role GoTrue connects as) may execute it.
// The HTTP constats against GoTrue itself (sign-up refused, createUser accepted, /otp sends nothing
// and leaves the current code valid) need the local secret key: they belong to commit 7 (J3-F),
// with the adapter of apps/api.
import {
  connectAsLocalSuperuser,
  inRolledBackTransaction,
  probe,
} from "@influx/test-kit/db";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrationRole } from "./support.ts";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const HOOK = "auth_hooks.refuse_native_email(jsonb)";
const HOOK_URI = "pg-functions://postgres/auth_hooks/refuse_native_email";
const REFUSAL = {
  error: { http_code: 403, message: "Native e-mails are disabled." },
};

/** Minimal TOML reader: `section -> key -> raw value`, comments and blank lines ignored. */
function readConfig(): Map<string, Map<string, string>> {
  const sections = new Map<string, Map<string, string>>();
  let current = "";
  sections.set(current, new Map());
  const text = readFileSync(
    path.join(REPOSITORY_ROOT, "supabase/config.toml"),
    "utf8",
  );
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    const header = /^\[([^\]]+)\]$/.exec(line);
    if (header !== null) {
      current = header[1] ?? "";
      sections.set(current, sections.get(current) ?? new Map());
      continue;
    }
    const entry = /^([A-Za-z0-9_]+)\s*=\s*(.+)$/.exec(line);
    if (entry !== null) {
      sections.get(current)?.set(entry[1] ?? "", entry[2] ?? "");
    }
  }
  return sections;
}

describe("J3-A: the Supabase Auth settings of supabase/config.toml", () => {
  const config = readConfig();
  const value = (section: string, key: string): string | undefined =>
    config.get(section)?.get(key);

  it.each([
    // a1: a 6-digit code
    ["auth.email", "otp_length", "6"],
    // a2: 10 minutes from generation
    ["auth.email", "otp_expiry", "600"],
    // a3 and EC-16: public sign-up closed (the admin API ignores it)
    ["auth", "enable_signup", "false"],
    // EC-50, EC-55: the Email provider stays on (password sign-in of the backoffice); sign-up is
    // closed by [auth] enable_signup above, proven by the findings of t8-gotrue-findings
    ["auth.email", "enable_signup", "true"],
    ["auth", "enable_anonymous_sign_ins", "false"],
    ["auth", "enable_manual_linking", "false"],
    ["auth.sms", "enable_signup", "false"],
    // a5: TOTP for internal accounts
    ["auth.mfa.totp", "enroll_enabled", "true"],
    ["auth.mfa.totp", "verify_enabled", "true"],
    ["auth.mfa.phone", "enroll_enabled", "false"],
    ["auth.mfa.phone", "verify_enabled", "false"],
    // J3-A d, B-1: floor of GoTrue
    ["auth", "minimum_password_length", "12"],
    // J3-A a6: a GoTrue token lives for one request only
    ["auth", "jwt_expiry", "300"],
    // EC-16/EC-41 point 3
    ["auth.email", "max_frequency", '"60s"'],
    ["auth.email", "secure_password_change", "true"],
    // EC-41: the sink hook
    ["auth.hook.send_email", "enabled", "true"],
    ["auth.hook.send_email", "uri", `"${HOOK_URI}"`],
  ])("[%s] %s = %s", (section, key, expected) => {
    expect(value(section, key)).toBe(expected);
  });

  it("disables every external provider, Web3 and third-party sign-in (EC-16 point 1)", () => {
    const enabled = [...config.entries()]
      .filter(
        ([section]) =>
          section.startsWith("auth.external.") ||
          section.startsWith("auth.third_party.") ||
          section.startsWith("auth.web3.") ||
          section === "auth.sms.twilio",
      )
      .filter(([, entries]) => entries.get("enabled") !== "false")
      .map(([section]) => section);
    expect(enabled).toEqual([]);
    expect(
      [...config.keys()].filter((section) =>
        section.startsWith("auth.external."),
      ),
    ).not.toEqual([]);
  });

  it("declares no SMTP server and no native security notification (EC-41)", () => {
    expect(
      [...config.keys()].filter(
        (section) =>
          section === "auth.email.smtp" ||
          section.startsWith("auth.email.notification."),
      ),
    ).toEqual([]);
  });

  it("reads the raised local rate limits from the environment only (EC-38 point 4)", () => {
    // A value written here would be carried to a hosted project by `supabase config push`.
    expect(value("auth.rate_limit", "sign_in_sign_ups")).toBe(
      '"env(INFLUX_LOCAL_AUTH_SIGN_IN_LIMIT)"',
    );
    expect(value("auth.rate_limit", "token_verifications")).toBe(
      '"env(INFLUX_LOCAL_AUTH_VERIFY_LIMIT)"',
    );
  });
});

describe("EC-41: the sink send-e-mail hook (0010)", () => {
  let migration: postgres.Sql;
  let superuser: postgres.Sql;

  beforeAll(() => {
    migration = migrationRole();
    // Local stack only (loopback), to take the role GoTrue connects as.
    superuser = connectAsLocalSuperuser({ max: 1 });
  });

  afterAll(async () => {
    await superuser.end({ timeout: 1 });
  });

  it("is SECURITY INVOKER with an empty search_path, in a schema without any relation", async () => {
    const [fn] = await migration<
      { secdef: boolean; config: string[] | null; volatility: string }[]
    >`
      select prosecdef as secdef, proconfig as config, provolatile as volatility
        from pg_catalog.pg_proc where oid = ${HOOK}::regprocedure`;
    expect(fn?.secdef).toBe(false);
    expect(fn?.config).toEqual(['search_path=""']);
    const relations = await migration`
      select c.relname from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'auth_hooks'`;
    expect(relations).toEqual([]);
    const functions = await migration<{ name: string }[]>`
      select p.oid::regprocedure::text as name from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'auth_hooks'`;
    expect(functions.map((row) => row.name)).toEqual([HOOK]);
  });

  it("is executable by supabase_auth_admin only, besides its owner", async () => {
    const rows = await migration<{ grantee: string; privilege: string }[]>`
      select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end as grantee,
             a.privilege_type as privilege
        from pg_catalog.pg_proc p,
             pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
       where p.oid = ${HOOK}::regprocedure and a.grantee <> p.proowner
      union all
      select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end,
             'schema ' || a.privilege_type
        from pg_catalog.pg_namespace n,
             pg_catalog.aclexplode(coalesce(n.nspacl, pg_catalog.acldefault('n', n.nspowner))) a
       where n.nspname = 'auth_hooks' and a.grantee <> n.nspowner
       order by 1, 2`;
    expect(rows).toEqual([
      { grantee: "supabase_auth_admin", privilege: "EXECUTE" },
      { grantee: "supabase_auth_admin", privilege: "schema USAGE" },
    ]);
  });

  it("answers the constant refusal to supabase_auth_admin, whatever the event says", async () => {
    const marker = "hook-marker-481516";
    const answers = await inRolledBackTransaction(superuser, async (tx) => {
      await tx.unsafe("set local role supabase_auth_admin");
      const results: unknown[] = [];
      for (const event of [
        {},
        {
          user: { email: `${marker}@example.test` },
          email_data: {
            token: "123456",
            token_hash: marker,
            email_action_type: "magiclink",
          },
        },
        null,
      ]) {
        const [row] = await tx<{ answer: unknown }[]>`
          select auth_hooks.refuse_native_email(${event === null ? null : tx.json(event)}::jsonb) as answer`;
        results.push(row?.answer);
      }
      return results;
    });
    for (const answer of answers) {
      expect(answer).toEqual(REFUSAL);
      expect(JSON.stringify(answer)).not.toContain(marker);
      expect(JSON.stringify(answer)).not.toContain("123456");
    }
  });

  it.each(["anon", "authenticated", "service_role"])(
    "is refused to %s (42501)",
    async (role) => {
      const result = await inRolledBackTransaction(superuser, async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        return probe(tx, "select auth_hooks.refuse_native_email('{}'::jsonb)");
      });
      expect(result).toEqual({ outcome: "error", code: "42501" });
    },
  );
});
