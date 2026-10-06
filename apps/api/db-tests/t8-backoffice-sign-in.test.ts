// Backoffice sign-in with mandatory TOTP on the local stack (docs/mvp/03 §6.1 B-1 to B-8, §6.2,
// §6.9 MFA-1 to MFA-10; 17b §3.14; 18 T8.8, T8.10, T8.11; 21 §3 EC-39, EC-40, EC-44, EC-47, EC-55,
// EC-56, EC-57, G-1; J3-C rules 2 to 4, 8, 9). Real database, real local GoTrue; the TOTP codes
// come from the generator of @influx/test-kit. No external call. Every captured stream is read BY
// VALUE (C-1).
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { hasFreshReauthentication } from "../src/domains/identity/backoffice-sign-in.ts";
import {
  createSupabaseAuth,
  type SupabaseAuth,
} from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

const AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Firefox/131.0 marker-bo-5e1a";
const OPS_COOKIE = "__Host-influx-ops-session";

let local: LocalAuthStack;
let database: ApiDatabase;
let gotrue: SupabaseAuth;
const watched: { text: () => string; values: string[] }[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function newClientAddress(): string {
  const group = () => randomBytes(2).toString("hex");
  return `2001:db8:${group()}:${group()}::9`;
}

/** An app whose GoTrue calls are counted; the floor is off unless a test asks for it. */
function app(options: { floorMs?: number } = {}) {
  const calls = { passwordSessions: 0, factorLists: 0 };
  const logs = captureLogs();
  const server = buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
    identity: {
      supabaseAuth: {
        ...gotrue,
        withPasswordSession(context, email, password, use) {
          calls.passwordSessions += 1;
          return gotrue.withPasswordSession(context, email, password, use);
        },
        listFactors(userId) {
          calls.factorLists += 1;
          return gotrue.listFactors(userId);
        },
      },
      backofficeAuthFloorMs: options.floorMs ?? 0,
    },
  });
  return { server, logs, calls };
}

type Server = ReturnType<typeof app>["server"];

function headers(clientAddress: string, extra: Record<string, string> = {}) {
  return {
    "x-influx-internal": BACKOFFICE_SECRET,
    origin: BACKOFFICE_ORIGIN,
    "client-user-agent": AGENT,
    "x-real-ip": clientAddress,
    ...extra,
  };
}

function post(
  server: Server,
  url: string,
  body: Record<string, unknown>,
  options: { clientAddress?: string; session?: string } = {},
) {
  return server.inject({
    method: "POST",
    url,
    headers: headers(options.clientAddress ?? newClientAddress(), {
      "content-type": "application/json",
      ...(options.session === undefined
        ? {}
        : { cookie: `${OPS_COOKIE}=${options.session}` }),
    }),
    payload: JSON.stringify(body),
  });
}

function opsCookie(response: LightMyRequestResponse): string | undefined {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header)
    ? header
    : header === undefined
      ? []
      : [header];
  return cookies.find((cookie) => cookie.startsWith(`${OPS_COOKIE}=`));
}

function sessionOf(response: LightMyRequestResponse): string {
  return decodeURIComponent(
    opsCookie(response)?.split(";")[0]?.split("=").slice(1).join("=") ?? "",
  );
}

type Internal = {
  email: string;
  password: string;
  accountId: string;
  authUserId: string;
  enrollmentToken: string;
};

/** An internal account: GoTrue user with a password, account, role, profile, enrollment token. */
async function newInternal(
  label: string,
  options: {
    role?: "agent" | "admin" | "advertiser";
    status?: "active" | "suspended";
    breakGlass?: boolean;
  } = {},
): Promise<Internal> {
  const email = `j3-bo-${label}-${randomUUID()}@example.test`;
  const password = `four words ${randomBytes(6).toString("hex")} here`;
  const created = await fetch(`${local.authUrl}/admin/users`, {
    method: "POST",
    headers: {
      apikey: local.secretKey,
      authorization: `Bearer ${local.secretKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const authUserId = ((await created.json()) as { id: string }).id;
  const accountId = randomUUID();
  const role = options.role ?? "agent";
  const status = options.status ?? "active";
  const enrollmentToken = randomBytes(32).toString("base64url");
  await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, status, suspended_at)
      values (${accountId}, ${authUserId}, ${email}, now(), 'FR', 'fr', 'J3 backoffice', true,
              now(), ${status}::identity.account_status,
              ${status === "suspended" ? new Date() : null})`;
    await tx`insert into identity.account_roles (account_id, role)
             values (${accountId}, ${role}::identity.account_role)`;
    if (role !== "advertiser") {
      await tx`insert into identity.agent_profiles (account_id, first_name, is_break_glass)
               values (${accountId}, 'T8', ${options.breakGlass === true})`;
      await tx`insert into identity.mfa_enrollment_tokens (account_id, token_hash, expires_at)
               values (${accountId},
                       ${createHash("sha256").update(Buffer.from(enrollmentToken, "base64url")).digest()},
                       now() + interval '72 hours')`;
    }
  });
  return { email, password, accountId, authUserId, enrollmentToken };
}

/** Waits for a new TOTP period when the current one is nearly over: codes of steps -1 to +1. */
async function freshPeriod(): Promise<void> {
  const left = millisecondsLeftInPeriod();
  if (left < 10_000) {
    await sleep(left + 200);
  }
}

type Enrolled = {
  secret: string;
  session: string;
  recoveryCodes: string[];
  firstCode: string;
};

async function enroll(server: Server, account: Internal): Promise<Enrolled> {
  await freshPeriod();
  const started = await post(server, "/v1/bo/auth/enroll", {
    email: account.email,
    password: account.password,
    enrollmentToken: account.enrollmentToken,
  });
  const { secret } = started.json<{ secret: string }>();
  const firstCode = totpCode(secret);
  const confirmed = await post(server, "/v1/bo/auth/enroll/confirm", {
    email: account.email,
    password: account.password,
    enrollmentToken: account.enrollmentToken,
    code: firstCode,
  });
  const body = confirmed.json<{ outcome: string; recoveryCodes: string[] }>();
  if (body.outcome !== "signed_in") {
    throw new Error(`enrollment failed: ${body.outcome}`);
  }
  return {
    secret,
    session: sessionOf(confirmed),
    recoveryCodes: body.recoveryCodes,
    firstCode,
  };
}

async function auditOf(accountId: string): Promise<string[]> {
  const rows = await migrationRole()<{ event_type: string }[]>`
    select event_type from audit.audit_events
     where subject_id = ${accountId}::uuid order by id`;
  return rows.map((row) => row.event_type);
}

async function sessionsOf(accountId: string) {
  return migrationRole()<
    {
      surface: string;
      aal: string;
      mfa_method: string | null;
      revocation_reason: string | null;
      idle_minutes: number;
      absolute_hours: number;
    }[]
  >`
    select surface::text, aal::text, mfa_method::text, revocation_reason::text,
           round(extract(epoch from idle_expires_at - created_at) / 60)::int as idle_minutes,
           round(extract(epoch from absolute_expires_at - created_at) / 3600)::int
             as absolute_hours
      from identity.sessions where account_id = ${accountId}::uuid order by created_at`;
}

async function gotrueSessionsOf(authUserId: string): Promise<number> {
  const [row] = await migrationRole()<{ count: number }[]>`
    select count(*)::int as count from auth.sessions where user_id = ${authUserId}::uuid`;
  return row?.count ?? -1;
}

async function gotrueFactorsOf(authUserId: string) {
  return migrationRole()<{ id: string; status: string }[]>`
    select id::text, status::text from auth.mfa_factors where user_id = ${authUserId}::uuid`;
}

async function me(server: Server, session: string) {
  return server.inject({
    method: "GET",
    url: "/v1/bo/me",
    headers: headers(newClientAddress(), {
      cookie: `${OPS_COOKIE}=${session}`,
    }),
  });
}

beforeAll(async () => {
  local = await requireLocalAuth();
  gotrue = createSupabaseAuth(
    { url: local.apiUrl, secretKey: local.secretKey },
    { warn: () => undefined },
  );
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
});

afterAll(async () => {
  await closeDatabase(database);
  await migrationRole()`
    update identity.agent_profiles set is_break_glass = false
     where is_break_glass and account_id in (
       select id from identity.accounts where email like 'j3-bo-%@example.test')`;
  const users = await migrationRole()<{ id: string }[]>`
    select id::text from auth.users where email like 'j3-bo-%@example.test'`;
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

describe("B-2, MFA-2, MFA-3, G-1: enrollment in two requests", () => {
  it("creates the factor without a session, then opens an aal2 session and shows ten codes once", async () => {
    const { server, logs } = app();
    const account = await newInternal("enroll");
    await freshPeriod();
    const started = await post(server, "/v1/bo/auth/enroll", {
      email: account.email,
      password: account.password,
      enrollmentToken: account.enrollmentToken,
    });
    expect(started.statusCode).toBe(200);
    expect(started.headers["cache-control"]).toBe("no-store");
    expect(opsCookie(started)).toBeUndefined();
    const factor = started.json<{
      outcome: string;
      qrCodeSvg: string;
      secret: string;
      uri: string;
    }>();
    expect(factor.outcome).toBe("factor_created");
    expect(factor.qrCodeSvg).toMatch(/<svg/);
    expect(factor.qrCodeSvg.startsWith("data:")).toBe(false);
    expect(factor.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(await sessionsOf(account.accountId)).toEqual([]);

    const code = totpCode(factor.secret);
    const confirmed = await post(server, "/v1/bo/auth/enroll/confirm", {
      email: account.email,
      password: account.password,
      enrollmentToken: account.enrollmentToken,
      code,
    });
    expect(confirmed.headers["cache-control"]).toBe("no-store");
    const body = confirmed.json<{
      outcome: string;
      role: string;
      recoveryCodes: string[];
    }>();
    expect(body.outcome).toBe("signed_in");
    expect(body.role).toBe("agent");
    expect(new Set(body.recoveryCodes).size).toBe(10);

    // J3-C rule 8: opaque identifier, Strict, Max-Age = the 8-hour bound.
    const cookie = opsCookie(confirmed);
    expect(sessionOf(confirmed)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(cookie).toMatch(/; Max-Age=28800(;|$)/);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; SameSite=Strict/);
    expect(await sessionsOf(account.accountId)).toEqual([
      {
        surface: "backoffice",
        aal: "aal2",
        mfa_method: "totp",
        revocation_reason: null,
        idle_minutes: 30,
        absolute_hours: 8,
      },
    ]);

    // G-1: the verified factor is pinned, the token consumed, ten digests stored.
    const [factors, [profile], [token], [codes]] = await Promise.all([
      gotrueFactorsOf(account.authUserId),
      migrationRole()<{ mfa_factor_id: string }[]>`
        select mfa_factor_id::text from identity.agent_profiles
         where account_id = ${account.accountId}::uuid`,
      migrationRole()<{ consumed: boolean }[]>`
        select consumed_at is not null as consumed from identity.mfa_enrollment_tokens
         where account_id = ${account.accountId}::uuid`,
      migrationRole()<{ count: number }[]>`
        select count(*)::int as count from identity.mfa_recovery_codes
         where account_id = ${account.accountId}::uuid and revoked_at is null`,
    ]);
    expect(factors).toEqual([
      { id: profile?.mfa_factor_id, status: "verified" },
    ]);
    expect(token?.consumed).toBe(true);
    expect(codes?.count).toBe(10);
    expect((await auditOf(account.accountId)).sort()).toEqual([
      "agent.mfa_enrolled",
      "agent.recovery_codes_generated",
      "elevated.identity.backoffice_enroll_totp",
    ]);
    // J3-C rule 2: no GoTrue session left.
    expect(await gotrueSessionsOf(account.authUserId)).toBe(0);

    const profileResponse = await me(server, sessionOf(confirmed));
    expect(profileResponse.statusCode).toBe(200);
    expect(profileResponse.json()).toEqual({
      email: account.email,
      role: "agent",
    });

    watched.push({
      text: logs.text,
      values: [
        account.password,
        account.enrollmentToken,
        factor.secret,
        code,
        ...body.recoveryCodes,
        sessionOf(confirmed),
        AGENT,
      ],
    });
  });

  it("EC-56: two first requests leave ONE unverified factor; a factor id in the body is refused", async () => {
    const { server } = app();
    const account = await newInternal("enroll-twice");
    const request = {
      email: account.email,
      password: account.password,
      enrollmentToken: account.enrollmentToken,
    };
    for (let round = 0; round < 2; round += 1) {
      const response = await post(server, "/v1/bo/auth/enroll", request);
      expect(response.json()).toMatchObject({ outcome: "factor_created" });
    }
    const factors = await gotrueFactorsOf(account.authUserId);
    expect(factors).toHaveLength(1);
    expect(factors[0]?.status).toBe("unverified");
    const withId = await post(server, "/v1/bo/auth/enroll/confirm", {
      ...request,
      code: "123456",
      factorId: factors[0]?.id,
    });
    expect(withId.statusCode).toBe(400);
    expect(await gotrueFactorsOf(account.authUserId)).toEqual(factors);
  });

  it("EC-56: a wrong enrollment token gets its own answer, and GoTrue's factors are never listed", async () => {
    const { server, calls } = app();
    const account = await newInternal("enroll-token");
    const response = await post(server, "/v1/bo/auth/enroll", {
      email: account.email,
      password: account.password,
      enrollmentToken: randomBytes(32).toString("base64url"),
    });
    expect(response.json()).toEqual({ outcome: "invitation_invalid" });
    expect(calls.factorLists).toBe(0);
    expect(await gotrueFactorsOf(account.authUserId)).toEqual([]);
  });

  it("G-1: a verified factor INFLUX did not pin is refused, audited, and left intact", async () => {
    const { server, logs } = app();
    const account = await newInternal("unexpected");
    // A factor verified directly at GoTrue, out of INFLUX (G-1 scenario (a)).
    const token = await fetch(`${local.authUrl}/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: local.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
      }),
    });
    const jwt = ((await token.json()) as { access_token: string }).access_token;
    const userHeaders = {
      apikey: local.publishableKey,
      authorization: `Bearer ${jwt}`,
      "content-type": "application/json",
    };
    const factor = (await (
      await fetch(`${local.authUrl}/factors`, {
        method: "POST",
        headers: userHeaders,
        body: JSON.stringify({ factor_type: "totp", friendly_name: "rogue" }),
      })
    ).json()) as { id: string; totp: { secret: string } };
    await freshPeriod();
    const challenge = (await (
      await fetch(`${local.authUrl}/factors/${factor.id}/challenge`, {
        method: "POST",
        headers: userHeaders,
        body: "{}",
      })
    ).json()) as { id: string };
    await fetch(`${local.authUrl}/factors/${factor.id}/verify`, {
      method: "POST",
      headers: userHeaders,
      body: JSON.stringify({
        challenge_id: challenge.id,
        code: totpCode(factor.totp.secret),
      }),
    });

    const response = await post(server, "/v1/bo/auth/enroll", {
      email: account.email,
      password: account.password,
      enrollmentToken: account.enrollmentToken,
    });
    expect(response.json()).toEqual({ outcome: "refused" });
    expect(await gotrueFactorsOf(account.authUserId)).toEqual([
      { id: factor.id, status: "verified" },
    ]);
    expect(await auditOf(account.accountId)).toContain(
      "agent.unexpected_mfa_factor",
    );
    expect(logs.text()).toContain("security.unexpected_mfa_factor");
  });
});

describe("J3-C rule 4, EC-39: sign-in in one request, directly in aal2", () => {
  it("signs in with password and TOTP, audits the account, leaves no GoTrue session; the same code is a replay", async () => {
    const { server, logs } = app();
    const account = await newInternal("login", { role: "admin" });
    const enrolled = await enroll(server, account);
    const code = totpCode(enrolled.secret, new Date(), 1);
    const response = await post(server, "/v1/bo/auth/login", {
      email: account.email,
      password: account.password,
      totpCode: code,
    });
    expect(response.json()).toEqual({
      outcome: "signed_in",
      role: "admin",
      mfaMethod: "totp",
    });
    expect(sessionOf(response)).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(await auditOf(account.accountId)).toContain(
      "elevated.identity.backoffice_sign_in",
    );
    expect(await gotrueSessionsOf(account.authUserId)).toBe(0);

    // EC-39, T8.10: GoTrue accepts the same code again; INFLUX refuses it for 120 s.
    for (const replayed of [code, enrolled.firstCode]) {
      const replay = await post(server, "/v1/bo/auth/login", {
        email: account.email,
        password: account.password,
        totpCode: replayed,
      });
      expect(replay.json()).toEqual({ outcome: "refused" });
      expect(opsCookie(replay)).toBeUndefined();
    }
    expect(await sessionsOf(account.accountId)).toHaveLength(2);
    watched.push({
      text: logs.text,
      values: [account.password, code, enrolled.secret, sessionOf(response)],
    });
  });

  it("MFA-3, MFA-4, EC-44, T8.11: a recovery code opens one session, alerts, and never serves twice", async () => {
    const { server, logs } = app();
    const account = await newInternal("recovery");
    const enrolled = await enroll(server, account);
    const typed = (enrolled.recoveryCodes[3] ?? "")
      .toLowerCase()
      .replaceAll("-", " ");
    const response = await post(server, "/v1/bo/auth/login", {
      email: account.email,
      password: account.password,
      recoveryCode: typed,
    });
    expect(response.json()).toEqual({
      outcome: "signed_in",
      role: "agent",
      mfaMethod: "recovery_code",
      recoveryCodesLeft: 9,
    });
    expect((await sessionsOf(account.accountId)).at(-1)?.mfa_method).toBe(
      "recovery_code",
    );
    expect(await auditOf(account.accountId)).toContain(
      "agent.recovery_code_consumed",
    );
    expect(logs.text()).toContain("security.recovery_code_consumed");

    const again = await post(server, "/v1/bo/auth/login", {
      email: account.email,
      password: account.password,
      recoveryCode: typed,
    });
    expect(again.json()).toEqual({ outcome: "refused" });

    // EC-17 point 4: R is never available in this session, and it is never fresh.
    const session = sessionOf(response);
    const reauth = await post(
      server,
      "/v1/bo/auth/reauthenticate",
      {
        password: account.password,
        code: totpCode(enrolled.secret, new Date(), 1),
      },
      { session },
    );
    expect(reauth.json()).toEqual({ outcome: "recovery_session" });
    const [row] = await migrationRole()<{ id: string }[]>`
      select id::text from identity.sessions
       where account_id = ${account.accountId}::uuid and mfa_method = 'recovery_code'`;
    expect(
      await hasFreshReauthentication(database, randomUUID(), row?.id ?? ""),
    ).toBe(false);
    watched.push({
      text: logs.text,
      values: [account.password, typed, ...enrolled.recoveryCodes, session],
    });
  });

  it("MFA-10, EC-44: the break-glass account is audited and logged at each sign-in and at its first failure", async () => {
    const { server, logs } = app();
    const account = await newInternal("break-glass", {
      role: "admin",
      breakGlass: true,
    });
    const enrolled = await enroll(server, account);
    const failed = await post(server, "/v1/bo/auth/login", {
      email: account.email,
      password: `${account.password}x`,
      totpCode: "000000",
    });
    expect(failed.json()).toEqual({ outcome: "refused" });
    const signedIn = await post(server, "/v1/bo/auth/login", {
      email: account.email,
      password: account.password,
      totpCode: totpCode(enrolled.secret, new Date(), 1),
    });
    expect(signedIn.json()).toMatchObject({ outcome: "signed_in" });
    const events = await auditOf(account.accountId);
    expect(events).toContain("security.backoffice_login_failures");
    expect(events).toContain("agent.break_glass_login");
    expect(logs.text()).toContain("security.backoffice_login_failures");
    expect(logs.text()).toContain("security.break_glass_login");
    watched.push({
      text: logs.text,
      values: [account.password, account.email],
    });
  });
});

describe("EC-40, EC-55, EC-57, 17b §3.14 rule 2: one refusal, whatever the step at fault", () => {
  it("answers the same body, status and floor to a wrong code, a wrong password, an unknown address, a member, a suspended agent and a 73-byte password", async () => {
    const { server, logs } = app({ floorMs: 1_500 });
    const agent = await newInternal("uniform");
    const enrolled = await enroll(app().server, agent);
    const member = await newInternal("uniform-member", { role: "advertiser" });
    const suspended = await newInternal("uniform-suspended", {
      status: "suspended",
    });
    const attempts: Record<string, string>[] = [
      { email: agent.email, password: agent.password, totpCode: "000000" },
      {
        email: agent.email,
        password: `${agent.password}!`,
        totpCode: "000000",
      },
      {
        email: `j3-bo-nobody-${randomUUID()}@example.test`,
        password: agent.password,
        totpCode: "000000",
      },
      // EC-55: a member whose GoTrue user holds a password.
      { email: member.email, password: member.password, totpCode: "000000" },
      {
        email: suspended.email,
        password: suspended.password,
        totpCode: "000000",
      },
      // EC-57: refused before GoTrue, never read as an outage.
      {
        email: agent.email,
        password: `${"é".repeat(36)}a`,
        totpCode: "000000",
      },
    ];
    for (const body of attempts) {
      const started = performance.now();
      const response = await post(server, "/v1/bo/auth/login", body);
      const elapsed = performance.now() - started;
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ outcome: "refused" });
      expect(opsCookie(response)).toBeUndefined();
      expect(elapsed).toBeGreaterThanOrEqual(1_490);
    }
    expect(await sessionsOf(member.accountId)).toEqual([]);
    expect(await gotrueSessionsOf(member.authUserId)).toBe(0);
    watched.push({
      text: logs.text,
      values: [
        agent.password,
        member.password,
        suspended.password,
        enrolled.secret,
        agent.email,
        member.email,
      ],
    });
  });

  it("EC-47: the sixth attempt of a couple (address, IP) in 15 minutes is refused before GoTrue", async () => {
    const { server, calls } = app();
    const account = await newInternal("ceiling");
    const clientAddress = newClientAddress();
    const body = {
      email: account.email,
      password: `${account.password}?`,
      totpCode: "000000",
    };
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await post(server, "/v1/bo/auth/login", body, {
        clientAddress,
      });
      expect(response.json()).toEqual({ outcome: "refused" });
    }
    expect(calls.passwordSessions).toBe(5);
  });
});

describe("B-5, EC-40: re-authentication R", () => {
  it("confirms with password and TOTP; R then holds, and no longer once five minutes have passed", async () => {
    const { server } = app();
    const account = await newInternal("reauth");
    const enrolled = await enroll(server, account);
    const response = await post(
      server,
      "/v1/bo/auth/reauthenticate",
      {
        password: account.password,
        code: totpCode(enrolled.secret, new Date(), 1),
      },
      { session: enrolled.session },
    );
    expect(response.json()).toEqual({ outcome: "confirmed" });
    expect(await auditOf(account.accountId)).toContain(
      "elevated.identity.backoffice_reauthenticate",
    );
    const [row] = await migrationRole()<{ id: string }[]>`
      select id::text from identity.sessions where account_id = ${account.accountId}::uuid`;
    const sessionId = row?.id ?? "";
    expect(
      await hasFreshReauthentication(database, randomUUID(), sessionId),
    ).toBe(true);

    // Six minutes later, by the database's own reading: the proof is aged on the row (the
    // trigger that forbids it is suspended inside this transaction only, DDL being transactional).
    await migrationRole().begin(async (tx) => {
      await tx`alter table identity.sessions disable trigger sessions_guard_update`;
      await tx`update identity.sessions
                  set created_at = created_at - interval '6 minutes',
                      last_activity_at = last_activity_at - interval '6 minutes',
                      idle_expires_at = idle_expires_at - interval '6 minutes',
                      absolute_expires_at = absolute_expires_at - interval '6 minutes',
                      mfa_verified_at = mfa_verified_at - interval '6 minutes'
                where id = ${sessionId}::uuid`;
      await tx`alter table identity.sessions enable trigger sessions_guard_update`;
    });
    expect(
      await hasFreshReauthentication(database, randomUUID(), sessionId),
    ).toBe(false);
    expect(
      await hasFreshReauthentication(database, randomUUID(), randomUUID()),
    ).toBe(false);
  });

  it("revokes the session at the fifth failure, audits it, and the session is gone", async () => {
    const { server, logs } = app();
    const account = await newInternal("reauth-fail");
    const enrolled = await enroll(server, account);
    const outcomes: string[] = [];
    let last: LightMyRequestResponse | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      last = await post(
        server,
        "/v1/bo/auth/reauthenticate",
        { password: account.password, code: "000000" },
        { session: enrolled.session },
      );
      outcomes.push(last.json<{ outcome: string }>().outcome);
    }
    expect(outcomes).toEqual([
      "refused",
      "refused",
      "refused",
      "refused",
      "session_revoked",
    ]);
    expect(opsCookie(last as LightMyRequestResponse)).toMatch(/Max-Age=0/);
    expect((await sessionsOf(account.accountId))[0]?.revocation_reason).toBe(
      "reauthentication_failed",
    );
    expect(await auditOf(account.accountId)).toContain(
      "agent.reauthentication_failed",
    );
    expect(logs.text()).toContain("security.reauthentication_failed");
    expect((await me(server, enrolled.session)).statusCode).toBe(401);
  });
});

describe("03 §6.2, T8.8: sessions of the backoffice surface", () => {
  it("logs out: revoked by its holder, cookie cleared, then 401; an unknown session is cleared too", async () => {
    const { server } = app();
    const account = await newInternal("logout");
    const enrolled = await enroll(server, account);
    const logout = await server.inject({
      method: "POST",
      url: "/v1/bo/auth/logout",
      headers: headers(newClientAddress(), {
        cookie: `${OPS_COOKIE}=${enrolled.session}`,
      }),
    });
    expect(logout.json()).toEqual({ outcome: "signed_out" });
    expect(opsCookie(logout)).toMatch(/Max-Age=0/);
    expect((await sessionsOf(account.accountId))[0]?.revocation_reason).toBe(
      "logout",
    );
    expect((await me(server, enrolled.session)).statusCode).toBe(401);
    const unknown = await server.inject({
      method: "POST",
      url: "/v1/bo/auth/logout",
      headers: headers(newClientAddress(), {
        cookie: `${OPS_COOKIE}=${randomBytes(32).toString("base64url")}`,
      }),
    });
    expect(unknown.statusCode).toBe(200);
    expect(opsCookie(unknown)).toMatch(/Max-Age=0/);
  });

  it("never takes a backoffice session on the web surface, nor a member session on the backoffice", async () => {
    const { server } = app();
    const account = await newInternal("surfaces");
    const enrolled = await enroll(server, account);
    const onWeb = await server.inject({
      method: "GET",
      url: "/v1/me",
      headers: {
        "x-influx-internal": WEB_SECRET,
        cookie: `__Host-influx-session=${enrolled.session}`,
      },
    });
    expect(onWeb.statusCode).toBe(401);

    // A member session presented in the backoffice cookie is no session there.
    const memberToken = randomBytes(32);
    const member = await newInternal("surfaces-member", { role: "advertiser" });
    await migrationRole()`
      insert into identity.sessions (token_hash, account_id, surface, user_agent_summary)
      values (${createHash("sha256").update(memberToken).digest()}, ${member.accountId}::uuid,
              'member', 'firefox.macos')`;
    const asMember = await me(server, memberToken.toString("base64url"));
    expect(asMember.statusCode).toBe(401);
    expect(asMember.json().error.code).toBe("unauthenticated");
  });
});

describe("C-1 and RG-J3-5: nothing of the request in the logs", () => {
  it("finds no password, code, secret, token, session or browser agent in the captured streams", () => {
    expect(watched.length).toBeGreaterThanOrEqual(4);
    expect(
      watched.flatMap(({ text, values }) => valuesFoundIn(text(), values)),
    ).toEqual([]);
  });
});
