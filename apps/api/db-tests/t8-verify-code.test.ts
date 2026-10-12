// POST /v1/auth/verify-code, the member session, GET /v1/me and POST /v1/auth/logout on the local
// stack (docs/mvp/05 RG42 to RG47, RG54, RG66 to RG69, RG136 to RG140; 18 T8.1 to T8.3, T8.6,
// T8.7, T8.12; 21 §3 EC-3, EC-4, EC-52; J3-C rules 2, 3, 8, 12; G-1 point 3). Real database,
// real local GoTrue, the Brevo double: no external call. Every stream is read BY VALUE (C-1).
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { createAuthTokenCodec } from "../src/platform/auth-tokens.ts";
import { createTransactionalSender } from "../src/platform/brevo-transactional.ts";
import {
  createSupabaseAuth,
  type SupabaseAuth,
} from "../src/platform/supabase.ts";
import { buildServer } from "../src/server.ts";
import {
  captureLogs,
  testApiConfig,
  TOKEN_SIGNING_SECRET,
  WEB_SECRET,
} from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

const AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/131.0 marker-9d2c";

let local: LocalAuthStack;
let database: ApiDatabase;
let double: BrevoDouble;
let gotrue: SupabaseAuth;
const tokens = createAuthTokenCodec(TOKEN_SIGNING_SECRET);
const watched: { text: () => string; values: string[] }[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function newAddress(label: string): string {
  return `j3-vc-${label}-${randomUUID()}@example.test`;
}

function newClientAddress(): string {
  const group = () => randomBytes(2).toString("hex");
  return `2001:db8:${group()}:${group()}::7`;
}

/** An app whose GoTrue verification calls are counted; `now` may be moved (RG136). */
function app(options: { now?: () => Date } = {}) {
  const verifications: string[] = [];
  const logs = captureLogs();
  const server = buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
    identity: {
      supabaseAuth: {
        ...gotrue,
        verifyEmailCode(context, email, code) {
          verifications.push(email);
          return gotrue.verifyEmailCode(context, email, code);
        },
      },
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
      ...(options.now === undefined ? {} : { now: options.now }),
    },
  });
  return { server, logs, verifications };
}

type Server = ReturnType<typeof app>["server"];

function headers(extra: Record<string, string> = {}) {
  return {
    "x-influx-internal": WEB_SECRET,
    "sec-fetch-site": "same-origin",
    "client-user-agent": AGENT,
    ...extra,
  };
}

function cookieValue(
  response: LightMyRequestResponse,
  name: string,
): string | undefined {
  const header = response.headers["set-cookie"];
  const cookies = Array.isArray(header)
    ? header
    : header === undefined
      ? []
      : [header];
  return cookies.find((cookie) => cookie.startsWith(`${name}=`));
}

function valueOf(cookie: string | undefined): string {
  return decodeURIComponent(
    cookie?.split(";")[0]?.split("=").slice(1).join("=") ?? "",
  );
}

type Journey = {
  email: string;
  loginCookie: string;
  code: string;
  clientAddress: string;
};

/** Requests a code through the route and reads it in the double (the member's inbox). */
async function startJourney(
  server: Server,
  email: string,
  clientAddress = newClientAddress(),
): Promise<Journey> {
  const before = double.messages.length;
  const response = await server.inject({
    method: "POST",
    url: "/v1/auth/request-code",
    headers: headers({
      "content-type": "application/json",
      "x-real-ip": clientAddress,
    }),
    payload: JSON.stringify({ email, locale: "fr" }),
  });
  expect(response.json<{ outcome: string }>().outcome).toBe("sent");
  const text = double.messages[before]?.body.textContent ?? "";
  const code = /^(\d{6})$/m.exec(text)?.[1];
  if (code === undefined) {
    throw new Error("no code received");
  }
  return {
    email,
    loginCookie: valueOf(cookieValue(response, "__Host-influx-login")),
    code,
    clientAddress,
  };
}

async function verify(
  server: Server,
  journey: Pick<Journey, "loginCookie" | "clientAddress">,
  body: Record<string, unknown>,
  requestId = randomUUID(),
) {
  const response = await server.inject({
    method: "POST",
    url: "/v1/auth/verify-code",
    headers: headers({
      "content-type": "application/json",
      "x-real-ip": journey.clientAddress,
      "x-request-id": requestId,
      ...(journey.loginCookie === ""
        ? {}
        : { cookie: `__Host-influx-login=${journey.loginCookie}` }),
    }),
    payload: JSON.stringify(body),
  });
  return { response, requestId };
}

function wrongCodeOf(code: string): string {
  return code === "000000" ? "000001" : "000000";
}

async function me(server: Server, sessionCookie: string) {
  return server.inject({
    method: "GET",
    url: "/v1/me",
    headers: headers({ cookie: `__Host-influx-session=${sessionCookie}` }),
  });
}

/** An account whose GoTrue user exists (created by the test), with a role and a state. */
async function newAccount(
  label: string,
  role: "advertiser" | "creator" | "agent",
  status: "active" | "suspended" = "active",
) {
  const email = newAddress(label);
  const created = await gotrue.createUser(email);
  if (!created.ok) {
    throw new Error("GoTrue user not created");
  }
  const accountId = randomUUID();
  await migrationRole()`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
       display_name, is_adult_attested, adult_attested_at, status, suspended_at,
       declared_status)
    values (${accountId}, ${created.value.userId}, ${email}, now(), 'FR', 'en', 'J3 verify',
            true, now(), ${status}::identity.account_status,
            ${status === "suspended" ? new Date() : null},
            ${role === "creator" ? "individual" : "business"}::identity.declared_status)`;
  await migrationRole()`
    insert into identity.account_roles (account_id, role)
    values (${accountId}, ${role}::identity.account_role)`;
  return { email, accountId, authUserId: created.value.userId };
}

async function sessionsOf(accountId: string) {
  return migrationRole()<
    {
      token_hash: Buffer;
      surface: string;
      aal: string;
      user_agent_summary: string;
      revoked_at: Date | null;
      revocation_reason: string | null;
    }[]
  >`
    select token_hash, surface::text, aal::text, user_agent_summary, revoked_at,
           revocation_reason::text
      from identity.sessions where account_id = ${accountId}::uuid`;
}

async function gotrueSessionsOf(authUserId: string): Promise<number> {
  const [row] = await migrationRole()<{ count: number }[]>`
    select count(*)::int as count from auth.sessions where user_id = ${authUserId}::uuid`;
  return row?.count ?? -1;
}

async function auditLinesOf(requestId: string) {
  return migrationRole()<
    { event_type: string; subject_type: string; subject_id: string }[]
  >`
    select event_type, subject_type, subject_id::text from audit.audit_events
     where request_id = ${requestId}`;
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
  double = await startBrevoDouble();
});

afterAll(async () => {
  await double.close();
  await closeDatabase(database);
  const users = await migrationRole()<{ id: string }[]>`
    select id::text from auth.users where email like 'j3-vc-%@example.test'`;
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

describe("RG66: a member signs in", () => {
  it("opens an opaque member session, clears the journey, audits the account once, and leaves no GoTrue session", async () => {
    const { server, logs } = app();
    const account = await newAccount("member", "advertiser");
    const journey = await startJourney(server, account.email);
    const { response, requestId } = await verify(server, journey, {
      code: journey.code,
      door: "advertiser",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      outcome: "signed_in",
      role: "advertiser",
      roleMismatch: false,
    });

    // J3-C rule 8, T8.12: opaque identifier, never a JWT; attributes of the member cookie.
    const cookie = cookieValue(response, "__Host-influx-session");
    const session = valueOf(cookie);
    expect(session).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(session.split(".")).toHaveLength(1);
    expect(cookie).toMatch(/; Max-Age=2592000(;|$)/);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookieValue(response, "__Host-influx-login")).toMatch(/Max-Age=0/);

    const rows = await sessionsOf(account.accountId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      surface: "member",
      aal: "aal1",
      user_agent_summary: "firefox.windows",
      revoked_at: null,
    });
    expect(
      rows[0]?.token_hash.equals(
        createHash("sha256").update(Buffer.from(session, "base64url")).digest(),
      ),
    ).toBe(true);

    expect(await auditLinesOf(requestId)).toEqual([
      {
        event_type: "elevated.identity.verify_code",
        subject_type: "account",
        subject_id: account.accountId,
      },
    ]);
    expect(await gotrueSessionsOf(account.authUserId)).toBe(0);

    const profile = await me(server, session);
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toEqual({
      email: account.email,
      role: "advertiser",
      preferredLanguage: "en",
    });
    // A fresh session is not renewed within the hour: no cookie set again (J3-C rule 12).
    expect(cookieValue(profile, "__Host-influx-session")).toBeUndefined();

    // T8.6: a consumed code is not reusable.
    const again = await startJourney(
      server,
      account.email,
      journey.clientAddress,
    );
    const replay = await verify(server, again, {
      code: journey.code,
      door: "advertiser",
    });
    expect(replay.response.json()).toMatchObject({ outcome: "invalid" });

    watched.push({
      text: logs.text,
      values: [
        account.email,
        journey.code,
        session,
        journey.loginCookie,
        AGENT,
      ],
    });
  });

  it("routes by the real role and says so when the door differs (RG67)", async () => {
    const { server } = app();
    const account = await newAccount("mismatch", "creator");
    const journey = await startJourney(server, account.email);
    const { response } = await verify(server, journey, {
      code: journey.code,
      door: "advertiser",
    });
    expect(response.json()).toEqual({
      outcome: "signed_in",
      role: "creator",
      roleMismatch: true,
    });
  });

  it("refuses a door outside advertiser and creator with 400, calling nothing (EC-4 (3))", async () => {
    const { server, verifications } = app();
    const journey = await startJourney(server, newAddress("door"));
    const { response } = await verify(server, journey, {
      code: journey.code,
      door: "agent",
    });
    expect(response.statusCode).toBe(400);
    expect(verifications).toEqual([]);
  });
});

describe("RG68, RG69, EC-4: after a right code, no member session unless a member account is active", () => {
  it("an internal account: no session, the journey cleared, no link (RG140, CA79)", async () => {
    const { server } = app();
    const account = await newAccount("internal", "agent");
    const journey = await startJourney(server, account.email);
    const { response, requestId } = await verify(server, journey, {
      code: journey.code,
      door: "creator",
    });
    expect(response.json()).toEqual({ outcome: "internal_account" });
    expect(cookieValue(response, "__Host-influx-session")).toBeUndefined();
    expect(cookieValue(response, "__Host-influx-login")).toMatch(/Max-Age=0/);
    expect(await sessionsOf(account.accountId)).toEqual([]);
    expect(await auditLinesOf(requestId)).toEqual([]);
  });

  it("a suspended account: no session (RG69)", async () => {
    const { server } = app();
    const account = await newAccount("suspended", "creator", "suspended");
    const journey = await startJourney(server, account.email);
    const { response } = await verify(server, journey, {
      code: journey.code,
      door: "creator",
    });
    expect(response.json()).toEqual({ outcome: "account_unavailable" });
    expect(await sessionsOf(account.accountId)).toEqual([]);
  });

  it("an unknown address: the signed sign-up token, 30 min, Strict, no session, no audit line (EC-4)", async () => {
    const { server, logs } = app();
    const email = newAddress("signup");
    const journey = await startJourney(server, email);
    const { response, requestId } = await verify(server, journey, {
      code: journey.code,
      door: "creator",
    });
    expect(response.json()).toEqual({ outcome: "signup_required" });
    const cookie = cookieValue(response, "__Host-influx-signup");
    expect(cookie).toMatch(/; Max-Age=1800(;|$)/);
    expect(cookie).toMatch(/; SameSite=Strict/);
    expect(cookie).toMatch(/; HttpOnly/);
    const token = tokens.readSignup(valueOf(cookie), new Date());
    const [user] = await migrationRole()<{ id: string }[]>`
      select id::text from auth.users where email = ${email}`;
    expect(token).toMatchObject({
      typ: "signup",
      email,
      door: "creator",
      authUserId: user?.id,
    });
    expect(tokens.readLogin(valueOf(cookie), new Date())).toBeNull();
    expect(cookieValue(response, "__Host-influx-session")).toBeUndefined();
    expect(await auditLinesOf(requestId)).toEqual([]);
    watched.push({
      text: logs.text,
      values: [email, journey.code, valueOf(cookie)],
    });
  });
});

describe("EC-3, RG42, RG136: five attempts per code, counted before GoTrue", () => {
  it("gives 4, 3, 2, 1 attempts left, then kills the code at GoTrue too; the account is never blocked (T8.3)", async () => {
    const { server, verifications, logs } = app();
    const account = await newAccount("attempts", "advertiser");
    const journey = await startJourney(server, account.email);
    const wrong = wrongCodeOf(journey.code);
    const seen = [];
    for (let attempt = 0; attempt < 5; attempt += 1) {
      seen.push(
        (
          await verify(server, journey, { code: wrong, door: "advertiser" })
        ).response.json(),
      );
    }
    expect(seen).toEqual([
      { outcome: "invalid", attemptsLeft: 4 },
      { outcome: "invalid", attemptsLeft: 3 },
      { outcome: "invalid", attemptsLeft: 2 },
      { outcome: "invalid", attemptsLeft: 1 },
      { outcome: "too_many_attempts" },
    ]);
    expect(verifications).toHaveLength(5);
    // Sixth attempt with the same journey: refused without calling GoTrue.
    const sixth = await verify(server, journey, {
      code: journey.code,
      door: "advertiser",
    });
    expect(sixth.response.json()).toEqual({ outcome: "too_many_attempts" });
    expect(verifications).toHaveLength(5);
    // The right code is dead at GoTrue itself (regeneration after the fifth failure).
    const direct = await gotrue.verifyEmailCode(
      { forwardedFor: null, timeoutMs: 5_000 },
      account.email,
      journey.code,
    );
    expect(direct).toMatchObject({ ok: false, reason: "rejected" });
    // A new code opens the account: the code was blocked, never the account.
    const next = await startJourney(
      server,
      account.email,
      journey.clientAddress,
    );
    expect(
      (
        await verify(server, next, { code: next.code, door: "advertiser" })
      ).response.json(),
    ).toMatchObject({ outcome: "signed_in" });
    watched.push({
      text: logs.text,
      values: [account.email, journey.code, next.code],
    });
  });

  it("lets twenty parallel attempts on one journey reach GoTrue five times at most", async () => {
    const { server, verifications } = app();
    const journey = await startJourney(server, newAddress("parallel"));
    const wrong = wrongCodeOf(journey.code);
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        verify(server, journey, { code: wrong, door: "creator" }),
      ),
    );
    expect(verifications.length).toBeLessThanOrEqual(5);
    expect(
      results.filter(
        ({ response }) =>
          response.json<{ outcome: string }>().outcome === "too_many_attempts",
      ).length,
    ).toBeGreaterThanOrEqual(15);
  });

  it("refuses without calling GoTrue a missing, altered, expired or sign-up-typed journey (RG47)", async () => {
    const { server, verifications } = app();
    const journey = await startJourney(server, newAddress("journey"));
    // The replaced character is the second to last (the last one may hold padding bits only): the
    // substitute is chosen from that character, or an "A" left as "A" would leave it unaltered.
    const cookie = journey.loginCookie;
    const altered = `${cookie.slice(0, -2)}${cookie.at(-2) === "A" ? "B" : "A"}${cookie.slice(-1)}`;
    expect(altered).not.toBe(cookie);
    const signupTyped = tokens.issueSignup(
      {
        verifiedAt: Math.floor(Date.now() / 1000),
        authUserId: randomUUID(),
        email: journey.email,
        door: "creator",
      },
      new Date(),
    );
    const late = app({ now: () => new Date(Date.now() + 16 * 60_000) });
    for (const [target, cookie] of [
      [server, ""],
      [server, altered],
      [server, signupTyped],
      [late.server, journey.loginCookie],
    ] as const) {
      const { response } = await verify(
        target,
        { ...journey, loginCookie: cookie },
        { code: journey.code, door: "creator" },
      );
      expect(response.json()).toEqual({ outcome: "session_lost" });
    }
    expect(verifications).toEqual([]);
    expect(late.verifications).toEqual([]);
  });

  it("answers expired after ten minutes whatever the code, counting no attempt (RG136, CA77)", async () => {
    const { server } = app();
    const account = await newAccount("expired", "creator");
    const journey = await startJourney(server, account.email);
    const later = app({ now: () => new Date(Date.now() + 11 * 60_000) });
    for (const code of [journey.code, wrongCodeOf(journey.code)]) {
      const { response } = await verify(later.server, journey, {
        code,
        door: "creator",
      });
      expect(response.json()).toEqual({ outcome: "expired" });
    }
    expect(later.verifications).toEqual([]);
    // Nothing was counted: at the real time, the right code still opens the session.
    expect(
      (
        await verify(server, journey, { code: journey.code, door: "creator" })
      ).response.json(),
    ).toMatchObject({ outcome: "signed_in" });
  });

  it("stops a network at twenty failed verifications in the hour, before GoTrue (RG44, EC-3 point 5)", async () => {
    const { server, verifications } = app();
    const clientAddress = newClientAddress();
    for (let journeyIndex = 0; journeyIndex < 4; journeyIndex += 1) {
      const journey = await startJourney(
        server,
        newAddress(`network-${journeyIndex}`),
        clientAddress,
      );
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await verify(server, journey, {
          code: wrongCodeOf(journey.code),
          door: "creator",
        });
      }
    }
    expect(verifications).toHaveLength(20);
    const last = await startJourney(
      server,
      newAddress("network-last"),
      clientAddress,
    );
    const { response } = await verify(server, last, {
      code: last.code,
      door: "creator",
    });
    expect(response.json()).toEqual({ outcome: "too_many_requests" });
    expect(verifications).toHaveLength(20);
  });
});

describe("the member session: renewal, suspension, logout (J3-C rule 12, T8.7, T8.12)", () => {
  async function signIn(server: Server) {
    const account = await newAccount("session", "creator");
    const journey = await startJourney(server, account.email);
    const { response } = await verify(server, journey, {
      code: journey.code,
      door: "creator",
    });
    return {
      account,
      session: valueOf(cookieValue(response, "__Host-influx-session")),
    };
  }

  it("renews a session idle for more than an hour, and sets the cookie again", async () => {
    const { server } = app();
    const { account, session } = await signIn(server);
    // The irreversibility trigger forbids moving activity back (0012): lifted for this row only,
    // by the migration role, in one transaction.
    await migrationRole().begin(async (tx) => {
      await tx`alter table identity.sessions disable trigger sessions_guard_update`;
      // The bounds of 0004 (sessions_member_bounds) move with the dates.
      await tx`update identity.sessions
                  set created_at = now() - interval '3 hours',
                      absolute_expires_at = now() - interval '3 hours' + interval '4320 hours',
                      last_activity_at = now() - interval '2 hours',
                      idle_expires_at = now() - interval '2 hours' + interval '720 hours'
                where account_id = ${account.accountId}::uuid`;
      await tx`alter table identity.sessions enable trigger sessions_guard_update`;
    });
    const response = await me(server, session);
    expect(response.statusCode).toBe(200);
    const cookie = cookieValue(response, "__Host-influx-session");
    expect(valueOf(cookie)).toBe(session);
    const maxAge = Number(/Max-Age=(\d+)/.exec(cookie ?? "")?.[1]);
    expect(maxAge).toBeGreaterThan(2_591_000);
    expect(maxAge).toBeLessThanOrEqual(2_592_000);
  });

  it("stops at once when the account is suspended (T8.7, RG69)", async () => {
    const { server } = app();
    const { account, session } = await signIn(server);
    expect((await me(server, session)).statusCode).toBe(200);
    await migrationRole()`
      update identity.accounts set status = 'suspended', suspended_at = now()
       where id = ${account.accountId}::uuid`;
    const refused = await me(server, session);
    expect(refused.statusCode).toBe(401);
    expect(cookieValue(refused, "__Host-influx-session")).toMatch(/Max-Age=0/);
  });

  it("stops at once when the session is revoked in base, and refuses an identifier of another form (T8.12)", async () => {
    const { server } = app();
    const { account, session } = await signIn(server);
    await migrationRole()`
      update identity.sessions set revoked_at = now(), revocation_reason = 'revoked_by_admin'
       where account_id = ${account.accountId}::uuid`;
    expect((await me(server, session)).statusCode).toBe(401);
    for (const forged of [
      "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln",
      "x".repeat(43),
      "",
    ]) {
      expect((await me(server, forged)).statusCode).toBe(401);
    }
  });

  it("logs out: the session revoked by its holder, the cookie cleared, then 401; an unknown session is cleared too", async () => {
    const { server } = app();
    const { account, session } = await signIn(server);
    const logout = await server.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: headers({ cookie: `__Host-influx-session=${session}` }),
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ outcome: "signed_out" });
    expect(cookieValue(logout, "__Host-influx-session")).toMatch(/Max-Age=0/);
    expect(await sessionsOf(account.accountId)).toMatchObject([
      { revocation_reason: "logout" },
    ]);
    expect((await me(server, session)).statusCode).toBe(401);
    const unknown = await server.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: headers({
        cookie: `__Host-influx-session=${randomBytes(32).toString("base64url")}`,
      }),
    });
    expect(unknown.statusCode).toBe(200);
    expect(cookieValue(unknown, "__Host-influx-session")).toMatch(/Max-Age=0/);
  });

  it("refuses a GoTrue token in Authorization or in an sb-* cookie, with the internal secret (G-1 point 3)", async () => {
    const { server } = app();
    const account = await newAccount("gotrue-token", "creator");
    const generated = await gotrue.generateEmailCode(account.email);
    if (!generated.ok) {
      throw new Error("no code");
    }
    const direct = await fetch(`${local.authUrl}/verify`, {
      method: "POST",
      headers: {
        apikey: local.publishableKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "email",
        email: account.email,
        token: generated.value.code,
      }),
    });
    const jwt = ((await direct.json()) as { access_token: string })
      .access_token;
    const attempts: Record<string, string>[] = [
      { authorization: `Bearer ${jwt}` },
      { cookie: `sb-access-token=${jwt}` },
    ];
    for (const extra of attempts) {
      const response = await server.inject({
        method: "GET",
        url: "/v1/me",
        headers: headers(extra),
      });
      expect(response.statusCode).toBe(401);
    }
  });
});

describe("C-1 and RG-J3-5: nothing of the request in the logs; the summary only in the session row", () => {
  it("finds no address, code, cookie, token or browser agent in the captured streams", () => {
    expect(watched.length).toBeGreaterThanOrEqual(3);
    expect(
      watched.flatMap(({ text, values }) => valuesFoundIn(text(), values)),
    ).toEqual([]);
  });

  it("stores no raw browser agent in any session row", async () => {
    const rows = await migrationRole()<{ count: number }[]>`
      select count(*)::int as count from identity.sessions
       where user_agent_summary like '%marker%' or user_agent_summary like '%Mozilla%'`;
    expect(rows[0]?.count).toBe(0);
  });
});
