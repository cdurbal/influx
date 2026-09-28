// Adapter of Supabase Auth, against a fake GoTrue on the loopback (21 §4, J3-C rules 1 to 3, 6
// and 7; EC-38; 05 Q14 point 5). What the real GoTrue does is found in db-tests/
// t8-gotrue-findings.test.ts; here, what apps/api sends and what it keeps of the answers.
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  boundedFetch,
  createSupabaseAuth,
  GOTRUE_USER_AGENT,
  type GoTrueRequestContext,
  type SupabaseAuth,
} from "../src/platform/supabase.ts";
import { TEST_SUPABASE_SECRET_KEY } from "./helpers.ts";

type Received = {
  method: string;
  path: string;
  headers: IncomingMessage["headers"];
  body: Record<string, unknown>;
};

type Answer = { status: number; body: unknown; delayMs?: number };

/** A fake GoTrue: records every request, answers with the handler of the test. */
class FakeGoTrue {
  readonly received: Received[] = [];
  handler: (request: Received) => Answer = () => ({ status: 404, body: {} });
  private server: Server | null = null;

  async start(): Promise<string> {
    this.server = createServer((request, response) => {
      let text = "";
      request.on("data", (chunk: Buffer) => {
        text += chunk.toString("utf8");
      });
      request.on("end", () => {
        const received: Received = {
          method: request.method ?? "",
          path: request.url ?? "",
          headers: request.headers,
          body:
            text === "" ? {} : (JSON.parse(text) as Record<string, unknown>),
        };
        this.received.push(received);
        const answer = this.handler(received);
        setTimeout(() => {
          response.writeHead(answer.status, {
            "content-type": "application/json",
            "x-supabase-api-version": "2024-01-01",
          });
          response.end(JSON.stringify(answer.body));
        }, answer.delayMs ?? 0);
      });
    });
    await new Promise<void>((resolve) => {
      this.server?.listen(0, "127.0.0.1", resolve);
    });
    const { port } = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    this.server?.closeAllConnections();
    await new Promise<void>((resolve) => this.server?.close(() => resolve()));
  }
}

const USER_A = {
  id: "0b6f7d1e-2c3a-4e5f-8a9b-1c2d3e4f5a6b",
  email: "a@example.test",
};
const USER_B = {
  id: "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f",
  email: "b@example.test",
};
const ACCESS_TOKEN_A = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJhIn0.token-of-user-a";
const ACCESS_TOKEN_B = "eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJiIn0.token-of-user-b";
const REFRESH_TOKEN = "refresh-token-never-kept";

function sessionOf(user: typeof USER_A, accessToken: string) {
  return {
    access_token: accessToken,
    refresh_token: REFRESH_TOKEN,
    token_type: "bearer",
    expires_in: 300,
    expires_at: Math.floor(Date.now() / 1000) + 300,
    user: {
      ...user,
      aud: "authenticated",
      app_metadata: {},
      user_metadata: {},
    },
  };
}

const CONTEXT: GoTrueRequestContext = {
  forwardedFor: "fd12:3456:789a:bcde:f012:3456:789a:bcde",
  timeoutMs: 2_000,
};

let gotrue: FakeGoTrue;
let auth: SupabaseAuth;
let warnings: { object: object; message: string }[];

beforeEach(async () => {
  gotrue = new FakeGoTrue();
  const url = await gotrue.start();
  warnings = [];
  auth = createSupabaseAuth(
    { url, secretKey: TEST_SUPABASE_SECRET_KEY },
    { warn: (object, message) => warnings.push({ object, message }) },
  );
});

afterEach(async () => {
  await gotrue.stop();
});

/** GoTrue answering /verify for both users and /logout with 204. */
function answerVerifyAndLogout(delayMs = 0): void {
  gotrue.handler = (request) => {
    if (request.path === "/auth/v1/verify") {
      const isA = request.body.email === USER_A.email;
      return {
        status: 200,
        body: isA
          ? sessionOf(USER_A, ACCESS_TOKEN_A)
          : sessionOf(USER_B, ACCESS_TOKEN_B),
        delayMs: isA ? delayMs : 0,
      };
    }
    if (request.path === "/auth/v1/logout?scope=local") {
      return { status: 204, body: {} };
    }
    return { status: 404, body: {} };
  };
}

describe("headers of every call (rule 1, EC-38, EC-46, 05 Q14 point 5)", () => {
  it("carries the secret key twice, our User-Agent and the pseudonymous address", async () => {
    answerVerifyAndLogout();
    await auth.verifyEmailCode(CONTEXT, USER_A.email, "123456");
    const verify = gotrue.received[0];
    expect(verify?.headers).toMatchObject({
      apikey: TEST_SUPABASE_SECRET_KEY,
      authorization: `Bearer ${TEST_SUPABASE_SECRET_KEY}`,
      "user-agent": GOTRUE_USER_AGENT,
      "sb-forwarded-for": CONTEXT.forwardedFor,
    });
    expect(verify?.body).toMatchObject({
      email: USER_A.email,
      token: "123456",
      type: "email",
    });
  });

  it("sends no Sb-Forwarded-For when the client address is unknown", async () => {
    answerVerifyAndLogout();
    await auth.verifyEmailCode(
      { ...CONTEXT, forwardedFor: null },
      USER_A.email,
      "123456",
    );
    expect(gotrue.received[0]?.headers["sb-forwarded-for"]).toBeUndefined();
  });

  it("sends the administration calls without Sb-Forwarded-For, with the same key and agent", async () => {
    gotrue.handler = () => ({ status: 200, body: USER_A });
    await auth.createUser(USER_A.email);
    expect(gotrue.received[0]).toMatchObject({
      method: "POST",
      path: "/auth/v1/admin/users",
      body: { email: USER_A.email, email_confirm: true },
    });
    expect(gotrue.received[0]?.headers).toMatchObject({
      apikey: TEST_SUPABASE_SECRET_KEY,
      authorization: `Bearer ${TEST_SUPABASE_SECRET_KEY}`,
      "user-agent": GOTRUE_USER_AGENT,
    });
    expect(gotrue.received[0]?.headers["sb-forwarded-for"]).toBeUndefined();
  });
});

describe("no GoTrue token survives the request (rule 2)", () => {
  it("returns the identity only, and signs the session out with its own token", async () => {
    answerVerifyAndLogout();
    const outcome = await auth.verifyEmailCode(CONTEXT, USER_A.email, "123456");
    expect(outcome).toEqual({
      ok: true,
      value: { userId: USER_A.id, email: USER_A.email },
    });
    const logout = gotrue.received[1];
    expect(logout).toMatchObject({
      method: "POST",
      path: "/auth/v1/logout?scope=local",
    });
    expect(logout?.headers.authorization).toBe(`Bearer ${ACCESS_TOKEN_A}`);
    const text = JSON.stringify(outcome);
    expect(text).not.toContain(ACCESS_TOKEN_A);
    expect(text).not.toContain(REFRESH_TOKEN);
    expect(warnings).toEqual([]);
  });

  it("still answers when the sign-out fails, with a warn line that holds codes only", async () => {
    gotrue.handler = (request) =>
      request.path === "/auth/v1/verify"
        ? { status: 200, body: sessionOf(USER_A, ACCESS_TOKEN_A) }
        : {
            status: 500,
            body: {
              code: "unexpected_failure",
              msg: `failed for ${ACCESS_TOKEN_A}`,
            },
          };
    const outcome = await auth.verifyEmailCode(CONTEXT, USER_A.email, "123456");
    expect(outcome.ok).toBe(true);
    expect(warnings).toEqual([
      {
        object: { reason: "unavailable", errorCode: null, status: 500 },
        message: "GoTrue session could not be signed out",
      },
    ]);
    expect(JSON.stringify(warnings)).not.toContain(ACCESS_TOKEN_A);
  });

  it("verifies a password the same way", async () => {
    gotrue.handler = (request) =>
      request.path === "/auth/v1/token?grant_type=password"
        ? { status: 200, body: sessionOf(USER_A, ACCESS_TOKEN_A) }
        : { status: 204, body: {} };
    const outcome = await auth.verifyPassword(
      CONTEXT,
      USER_A.email,
      "a-password-of-the-test",
    );
    expect(outcome).toEqual({
      ok: true,
      value: { userId: USER_A.id, email: USER_A.email },
    });
    expect(gotrue.received.map((request) => request.path)).toEqual([
      "/auth/v1/token?grant_type=password",
      "/auth/v1/logout?scope=local",
    ]);
  });
});

describe("one client per request (rule 1)", () => {
  it("never mixes two concurrent verifications, whatever order they finish in", async () => {
    answerVerifyAndLogout(150);
    const [a, b] = await Promise.all([
      auth.verifyEmailCode(CONTEXT, USER_A.email, "111111"),
      auth.verifyEmailCode(CONTEXT, USER_B.email, "222222"),
    ]);
    expect(a).toEqual({
      ok: true,
      value: { userId: USER_A.id, email: USER_A.email },
    });
    expect(b).toEqual({
      ok: true,
      value: { userId: USER_B.id, email: USER_B.email },
    });
    const logouts = gotrue.received
      .filter((request) => request.path.startsWith("/auth/v1/logout"))
      .map((request) => request.headers.authorization);
    expect(logouts.sort()).toEqual(
      [`Bearer ${ACCESS_TOKEN_A}`, `Bearer ${ACCESS_TOKEN_B}`].sort(),
    );
  });
});

describe("GoTrue's answers reduced to a code and a status (rule 7)", () => {
  it("returns a refusal as its code and status, never its message", async () => {
    gotrue.handler = () => ({
      status: 403,
      body: {
        code: 403,
        error_code: "otp_expired",
        msg: "Token has expired or is invalid for a@example.test",
      },
    });
    const outcome = await auth.verifyEmailCode(CONTEXT, USER_A.email, "123456");
    expect(outcome).toEqual({
      ok: false,
      reason: "rejected",
      errorCode: "otp_expired",
      status: 403,
    });
  });

  it("returns email_exists for a known address (J3-A b7)", async () => {
    gotrue.handler = () => ({
      status: 422,
      body: {
        code: 422,
        error_code: "email_exists",
        msg: "already registered",
      },
    });
    expect(await auth.createUser(USER_A.email)).toEqual({
      ok: false,
      reason: "rejected",
      errorCode: "email_exists",
      status: 422,
    });
  });

  it("reports a 5xx as unavailable", async () => {
    gotrue.handler = () => ({ status: 503, body: { msg: "down" } });
    expect(await auth.generateEmailCode(USER_A.email)).toMatchObject({
      ok: false,
      reason: "unavailable",
      status: 503,
    });
  });

  it("reports a time-out as unavailable, within the bound of the request", async () => {
    gotrue.handler = () => ({
      status: 200,
      body: sessionOf(USER_A, ACCESS_TOKEN_A),
      delayMs: 1_000,
    });
    const started = Date.now();
    const outcome = await auth.verifyEmailCode(
      { ...CONTEXT, timeoutMs: 100 },
      USER_A.email,
      "123456",
    );
    expect(outcome).toEqual({
      ok: false,
      reason: "unavailable",
      errorCode: null,
      status: null,
    });
    expect(Date.now() - started).toBeLessThan(900);
  });

  it("reports an answer without code as unavailable (malformed)", async () => {
    gotrue.handler = () => ({
      status: 200,
      body: { ...USER_A, properties: {} },
    });
    expect(await auth.generateEmailCode(USER_A.email)).toEqual({
      ok: false,
      reason: "unavailable",
      errorCode: null,
      status: null,
    });
  });

  it("returns the code of generateLink, from its properties (J3-A b1)", async () => {
    gotrue.handler = () => ({
      status: 200,
      body: {
        ...USER_A,
        action_link: "http://127.0.0.1/verify?token=x",
        email_otp: "654321",
        hashed_token: "hashed",
        verification_type: "magiclink",
        redirect_to: "",
      },
    });
    expect(await auth.generateEmailCode(USER_A.email)).toEqual({
      ok: true,
      value: { userId: USER_A.id, email: USER_A.email, code: "654321" },
    });
    expect(gotrue.received[0]?.body).toMatchObject({
      type: "magiclink",
      email: USER_A.email,
    });
  });
});

describe("boundedFetch", () => {
  it("gives each call its own time-out", async () => {
    const calls: AbortSignal[] = [];
    const fake: typeof fetch = async (_input, init) => {
      if (init?.signal) {
        calls.push(init.signal);
      }
      return new Response("{}");
    };
    const bounded = boundedFetch(1_000, fake);
    await bounded("http://127.0.0.1/a");
    await bounded("http://127.0.0.1/b");
    expect(calls).toHaveLength(2);
    expect(calls[0]).not.toBe(calls[1]);
  });

  it("keeps the caller's own signal", async () => {
    const controller = new AbortController();
    let received: AbortSignal | undefined;
    const fake: typeof fetch = async (_input, init) => {
      received = init?.signal ?? undefined;
      return new Response("{}");
    };
    await boundedFetch(1_000, fake)("http://127.0.0.1/", {
      signal: controller.signal,
    });
    controller.abort();
    expect(received?.aborted).toBe(true);
  });
});
