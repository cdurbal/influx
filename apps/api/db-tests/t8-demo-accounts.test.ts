// The demonstration accounts (docs/mvp/21 §4, J3 commit 11; EC-30, EC-45, EC-57) and the
// "Terminé quand" of the J3: the four accounts reach their own space on the local stack — the
// members with the code the Brevo double receives, the internal accounts with password and a TOTP
// enrolled at the first sign-in (B-2). A random tag keeps THE demo accounts of the workstation
// untouched (their first sign-in stays to be made). No external call; C-1 on every stream.
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import {
  localRoleUrl,
  requireLocalAuth,
  type LocalAuthStack,
  type LoginRole,
} from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import { millisecondsLeftInPeriod, totpCode } from "@influx/test-kit/totp";
import type { LightMyRequestResponse } from "fastify";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  checkDemoPasswords,
  demoAccounts,
  seedDemoAccounts,
  type DemoAccount,
} from "../scripts/demo-accounts.ts";
import { ensureInForce } from "../scripts/terms-publication.ts";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { enrollmentTokenHashOf } from "../src/domains/identity/mfa-secrets.ts";
import { createTransactionalSender } from "../src/platform/brevo-transactional.ts";
import { createSupabaseAuth } from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const AGENT = "Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0 marker-demo-7c";

let local: LocalAuthStack;
let database: ApiDatabase;
let double: BrevoDouble;

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function newTag(): string {
  return `t${randomBytes(4).toString("hex")}`;
}

function cookieOf(response: LightMyRequestResponse, name: string): string {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header)
    ? header
    : header === undefined
      ? []
      : [header];
  const cookie = cookies.find((value) => value.startsWith(`${name}=`));
  return decodeURIComponent(
    cookie?.split(";")[0]?.split("=").slice(1).join("=") ?? "",
  );
}

beforeAll(async () => {
  local = await requireLocalAuth();
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  double = await startBrevoDouble();
  // The members accept the terms of service in force (21 EC-62): the data set of T2 has a French
  // version; the English draft is published when no English version is in force yet.
  for (const locale of ["fr", "en"] as const) {
    await ensureInForce(migrationRole(), {
      document: "terms_of_service",
      locale,
      label: "draft-2",
    });
  }
});

afterAll(async () => {
  await double.close();
  await closeDatabase(database);
  const users = await migrationRole()<{ id: string }[]>`
    select id::text from auth.users where email like 'demo-t%@example.test'`;
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

function gotrueOf() {
  return { authUrl: local.authUrl, secretKey: local.secretKey };
}

describe("J3 commit 11: the demonstration accounts", () => {
  it("EC-57 (b), B-1: every demo password is 12 characters to 72 bytes and passes the local rules", () => {
    const accounts = demoAccounts();
    expect(() => checkDemoPasswords(accounts)).not.toThrow();
    const internal = accounts.filter((account) => account.password !== null);
    expect(internal.map((account) => account.role)).toEqual(["agent", "admin"]);
    for (const account of internal) {
      expect([...(account.password ?? "")].length).toBeGreaterThanOrEqual(12);
      expect(
        Buffer.byteLength(account.password ?? "", "utf8"),
      ).toBeLessThanOrEqual(72);
    }
    expect(
      accounts.every((account) => account.email.endsWith("@example.test")),
    ).toBe(true);
  });

  it("creates four accounts, roles, acceptances of the terms in force, enrollment tokens, and nothing twice", async () => {
    const accounts = demoAccounts(newTag());
    expect(await seedDemoAccounts(migrationRole(), gotrueOf(), accounts)).toBe(
      "created",
    );
    const rows = await migrationRole()<
      { email: string; role: string; accepted: number }[]
    >`
      select a.email, r.role::text as role,
             (select count(*)::int from identity.terms_acceptances t where t.account_id = a.id)
               as accepted
        from identity.accounts a
        join identity.account_roles r on r.account_id = a.id
        join auth.users u on u.id = a.auth_user_id
       where a.email in ${migrationRole()(accounts.map((account) => account.email))}
       order by a.email`;
    expect(rows.map((row) => [row.role, row.accepted]).sort()).toEqual([
      ["admin", 0],
      ["advertiser", 1],
      ["agent", 0],
      ["creator", 1],
    ]);
    for (const account of accounts.filter(
      (each) => each.enrollmentToken !== null,
    )) {
      const [valid] = await migrationRole()<{ valid: boolean }[]>`
        select exists (
          select 1 from identity.mfa_enrollment_tokens t
            join identity.accounts a on a.id = t.account_id
           where a.email = ${account.email}
             and t.token_hash = ${enrollmentTokenHashOf(account.enrollmentToken ?? "")}
             and t.consumed_at is null and t.expires_at > now()) as valid`;
      expect(valid?.valid).toBe(true);
    }
    const [terms] = await migrationRole()<{ count: number }[]>`
      select count(*)::int as count from identity.terms_versions
       where document_kind = 'terms_of_service' and effective_to is null`;
    expect(terms?.count).toBeGreaterThanOrEqual(2);

    expect(await seedDemoAccounts(migrationRole(), gotrueOf(), accounts)).toBe(
      "already_present",
    );
    const partial = demoAccounts(newTag());
    await seedDemoAccounts(migrationRole(), gotrueOf(), partial.slice(0, 1));
    await expect(
      seedDemoAccounts(migrationRole(), gotrueOf(), partial),
    ).rejects.toThrow(/partly present/);
  });

  it("EC-45 (1): the script refuses production and any Supabase outside the loopback, before anything", async () => {
    const run = promisify(execFile);
    for (const env of [
      { INFLUX_ENV: "production" },
      { SUPABASE_URL: "https://abcdefghijklmnop.supabase.co" },
    ]) {
      await expect(
        run(process.execPath, ["scripts/seed-demo-accounts.ts"], {
          cwd: API_ROOT,
          env: { ...process.env, ...env },
          timeout: 60_000,
        }),
      ).rejects.toMatchObject({ code: 1 });
    }
  });
});

describe("J3 « Terminé quand »: the four demo accounts reach their own space", () => {
  function app() {
    const logs = captureLogs();
    const server = buildServer(testApiConfig(), {
      logDestination: logs.destination,
      database,
      identity: {
        supabaseAuth: createSupabaseAuth(
          { url: local.apiUrl, secretKey: local.secretKey },
          { warn: () => undefined },
        ),
        sender: createTransactionalSender(
          {
            mode: "live",
            testRecipients: [],
            apiKey: "local-double-key",
            baseUrl: double.baseUrl,
            senderEmail: "no-reply@tx.influx.example",
          },
          {
            logger: {
              info: () => undefined,
              warn: () => undefined,
              error: () => undefined,
            },
          },
        ),
        codeRequestFloorMs: 0,
        backofficeAuthFloorMs: 0,
      },
    });
    return { server, logs };
  }

  type Server = ReturnType<typeof app>["server"];

  function webHeaders(clientAddress: string, cookie?: string) {
    return {
      "x-influx-internal": WEB_SECRET,
      "sec-fetch-site": "same-origin",
      "client-user-agent": AGENT,
      "x-real-ip": clientAddress,
      "content-type": "application/json",
      ...(cookie === undefined ? {} : { cookie }),
    };
  }

  function boHeaders(cookie?: string) {
    return {
      "x-influx-internal": BACKOFFICE_SECRET,
      origin: BACKOFFICE_ORIGIN,
      "client-user-agent": AGENT,
      "x-real-ip": `2001:db8:${randomBytes(2).toString("hex")}::5`,
      "content-type": "application/json",
      ...(cookie === undefined ? {} : { cookie }),
    };
  }

  async function memberSignsIn(server: Server, account: DemoAccount) {
    const clientAddress = `2001:db8:${randomBytes(2).toString("hex")}::4`;
    const before = double.messages.length;
    const requested = await server.inject({
      method: "POST",
      url: "/v1/auth/request-code",
      headers: webHeaders(clientAddress),
      payload: JSON.stringify({
        email: account.email,
        locale: account.preferredLanguage,
      }),
    });
    expect(requested.json()).toMatchObject({ outcome: "sent" });
    const text = double.messages[before]?.body.textContent ?? "";
    const code = /^(\d{6})$/m.exec(text)?.[1] ?? "";
    const verified = await server.inject({
      method: "POST",
      url: "/v1/auth/verify-code",
      headers: webHeaders(
        clientAddress,
        `__Host-influx-login=${cookieOf(requested, "__Host-influx-login")}`,
      ),
      payload: JSON.stringify({ code, door: account.role }),
    });
    expect(verified.json()).toEqual({
      outcome: "signed_in",
      role: account.role,
      roleMismatch: false,
    });
    const session = cookieOf(verified, "__Host-influx-session");
    const me = await server.inject({
      method: "GET",
      url: "/v1/me",
      headers: webHeaders(clientAddress, `__Host-influx-session=${session}`),
    });
    expect(me.json()).toEqual({
      email: account.email,
      role: account.role,
      preferredLanguage: account.preferredLanguage,
    });
    return [code, session];
  }

  async function internalSignsIn(server: Server, account: DemoAccount) {
    if (millisecondsLeftInPeriod() < 10_000) {
      await sleep(millisecondsLeftInPeriod() + 200);
    }
    const credentials = {
      email: account.email,
      password: account.password,
      enrollmentToken: account.enrollmentToken,
    };
    const started = await server.inject({
      method: "POST",
      url: "/v1/bo/auth/enroll",
      headers: boHeaders(),
      payload: JSON.stringify(credentials),
    });
    const { secret } = started.json<{ secret: string }>();
    const firstCode = totpCode(secret);
    const confirmed = await server.inject({
      method: "POST",
      url: "/v1/bo/auth/enroll/confirm",
      headers: boHeaders(),
      payload: JSON.stringify({ ...credentials, code: firstCode }),
    });
    expect(confirmed.json()).toMatchObject({
      outcome: "signed_in",
      role: account.role,
    });
    // The following day, so to speak: password and the next code, one request.
    const nextCode = totpCode(secret, new Date(), 1);
    const login = await server.inject({
      method: "POST",
      url: "/v1/bo/auth/login",
      headers: boHeaders(),
      payload: JSON.stringify({
        email: account.email,
        password: account.password,
        totpCode: nextCode,
      }),
    });
    expect(login.json()).toEqual({
      outcome: "signed_in",
      role: account.role,
      mfaMethod: "totp",
    });
    const session = cookieOf(login, "__Host-influx-ops-session");
    const me = await server.inject({
      method: "GET",
      url: "/v1/bo/me",
      headers: boHeaders(`__Host-influx-ops-session=${session}`),
    });
    expect(me.json()).toEqual({ email: account.email, role: account.role });
    return [secret, firstCode, nextCode, session];
  }

  it("signs the two members in by code and the two internal accounts in by password and TOTP", async () => {
    const { server, logs } = app();
    const accounts = demoAccounts(newTag());
    await seedDemoAccounts(migrationRole(), gotrueOf(), accounts);
    const seen: string[] = [];
    for (const account of accounts) {
      seen.push(
        ...(account.password === null
          ? await memberSignsIn(server, account)
          : await internalSignsIn(server, account)),
      );
    }
    // C-1: no code, secret, session, password or token in the captured stream.
    const passwords = accounts.flatMap((account) =>
      account.password === null
        ? []
        : [account.password, account.enrollmentToken ?? ""],
    );
    expect(valuesFoundIn(logs.text(), [...seen, ...passwords, AGENT])).toEqual(
      [],
    );
  });
});
