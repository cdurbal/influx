// GET /v1/auth/journey and POST /v1/auth/journey/reset (D66; docs/mvp/05 RG111): the step a
// reloaded journey resumes at, read from the two signed journey cookies only. The database is a
// pool that reaches nothing and GoTrue is never configured to answer: a route that touched either
// would fail here.
import { journeyResponseSchema } from "@influx/contracts/auth";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  createAuthTokenCodec,
  LOGIN_TOKEN_TTL_SECONDS,
  SIGNUP_TOKEN_TTL_SECONDS,
} from "../src/platform/auth-tokens.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  TOKEN_SIGNING_SECRET,
  WEB_SECRET,
} from "./helpers.ts";

const tokens = createAuthTokenCodec(TOKEN_SIGNING_SECRET);
const NOW = new Date("2026-10-08T10:00:00.000Z");
const EMAIL = "journey-unit@example.test";
const PHRASE = "blue harbour";

let app: ApiServer | undefined;

function server() {
  const logs = captureLogs();
  app = buildServer(testApiConfig(), {
    logDestination: logs.destination,
    identity: { now: () => NOW },
  });
  return { api: app, logs };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function secondsBefore(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

function loginToken(issuedAt: Date): string {
  return tokens.issueLogin(
    { ref: randomUUID(), email: EMAIL, phrase: PHRASE },
    issuedAt,
  );
}

function signupToken(issuedAt: Date): string {
  return tokens.issueSignup(
    {
      verifiedAt: Math.floor(issuedAt.getTime() / 1000),
      authUserId: randomUUID(),
      email: EMAIL,
      door: "creator",
    },
    issuedAt,
  );
}

function cookieHeader(cookies: { login?: string; signup?: string }) {
  const parts = [
    cookies.login === undefined
      ? null
      : `__Host-influx-login=${encodeURIComponent(cookies.login)}`,
    cookies.signup === undefined
      ? null
      : `__Host-influx-signup=${encodeURIComponent(cookies.signup)}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? {} : { cookie: parts.join("; ") };
}

function getJourney(
  api: ApiServer,
  cookies: { login?: string; signup?: string } = {},
  secret = WEB_SECRET,
) {
  return api.inject({
    method: "GET",
    url: "/v1/auth/journey",
    headers: { "x-influx-internal": secret, ...cookieHeader(cookies) },
  });
}

function reset(api: ApiServer, cookies: { login?: string; signup?: string }) {
  return api.inject({
    method: "POST",
    url: "/v1/auth/journey/reset",
    headers: {
      "x-influx-internal": WEB_SECRET,
      "sec-fetch-site": "same-origin",
      ...cookieHeader(cookies),
    },
  });
}

function setCookies(headers: Record<string, unknown>): string[] {
  const header = headers["set-cookie"];
  if (header === undefined) {
    return [];
  }
  return (Array.isArray(header) ? header : [header]).filter(
    (cookie): cookie is string => typeof cookie === "string",
  );
}

function cleared(headers: Record<string, unknown>, name: string): boolean {
  return setCookies(headers).some(
    (cookie) => cookie.startsWith(`${name}=;`) && cookie.includes("Max-Age=0"),
  );
}

describe("GET /v1/auth/journey (D66, RG111)", () => {
  it("answers none without a cookie, sets no cookie, and is never cached", async () => {
    const { api } = server();
    const response = await getJourney(api);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ step: "none" });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(setCookies(response.headers)).toEqual([]);
  });

  it("answers code with the address, the phrase and the resend delay left (RG50)", async () => {
    const { api } = server();
    const response = await getJourney(api, {
      login: loginToken(secondsBefore(20)),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      step: "code",
      email: EMAIL,
      matchingPhrase: PHRASE,
      retryAfterSeconds: 40,
    });
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(setCookies(response.headers)).toEqual([]);
  });

  it("answers a resend delay of 0 once the minute has passed", async () => {
    const { api } = server();
    const response = await getJourney(api, {
      login: loginToken(secondsBefore(5 * 60)),
    });
    expect(response.json()).toMatchObject({
      step: "code",
      retryAfterSeconds: 0,
    });
  });

  it("answers details with the verified address, never the door", async () => {
    const { api } = server();
    const response = await getJourney(api, {
      signup: signupToken(secondsBefore(60)),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ step: "details", email: EMAIL });
    expect(response.body).not.toContain("creator");
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("prefers the sign-up token to a login token (the later step)", async () => {
    const { api } = server();
    const response = await getJourney(api, {
      login: loginToken(secondsBefore(30)),
      signup: signupToken(secondsBefore(10)),
    });
    expect(response.json()).toEqual({ step: "details", email: EMAIL });
    expect(setCookies(response.headers)).toEqual([]);
  });

  it.each([
    ["forged", { login: `${loginToken(NOW)}x` }, "__Host-influx-login"],
    [
      "expired",
      { login: loginToken(secondsBefore(LOGIN_TOKEN_TTL_SECONDS + 1)) },
      "__Host-influx-login",
    ],
    [
      "a sign-up token in the login cookie",
      { login: signupToken(NOW) },
      "__Host-influx-login",
    ],
    ["forged", { signup: `${signupToken(NOW)}x` }, "__Host-influx-signup"],
    [
      "expired",
      { signup: signupToken(secondsBefore(SIGNUP_TOKEN_TTL_SECONDS + 1)) },
      "__Host-influx-signup",
    ],
  ])(
    "answers none to a %s token and clears it (%j)",
    async (_label, cookies, name) => {
      const { api } = server();
      const response = await getJourney(api, cookies);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ step: "none" });
      expect(cleared(response.headers, name)).toBe(true);
      expect(response.headers["cache-control"]).toBe("no-store");
    },
  );

  it("falls back to a valid login token when the sign-up cookie is unreadable, and clears it", async () => {
    const { api } = server();
    const response = await getJourney(api, {
      login: loginToken(NOW),
      signup: "garbage",
    });
    expect(response.json()).toMatchObject({ step: "code", email: EMAIL });
    expect(cleared(response.headers, "__Host-influx-signup")).toBe(true);
    expect(cleared(response.headers, "__Host-influx-login")).toBe(false);
  });

  it("never logs the address nor the phrase", async () => {
    const { api, logs } = server();
    await getJourney(api, { login: loginToken(NOW) });
    await getJourney(api, { signup: signupToken(NOW) });
    expect(logs.text()).not.toContain(EMAIL);
    expect(logs.text()).not.toContain(PHRASE);
  });

  it("answers a shape the contract accepts", async () => {
    const { api } = server();
    const response = await getJourney(api, { login: loginToken(NOW) });
    expect(journeyResponseSchema.safeParse(response.json()).success).toBe(true);
  });

  it("does not exist on the backoffice surface", async () => {
    const { api } = server();
    const response = await getJourney(
      api,
      { login: loginToken(NOW) },
      BACKOFFICE_SECRET,
    );
    expect(response.statusCode).toBe(404);
  });
});

describe("POST /v1/auth/journey/reset (D66)", () => {
  it("clears both journey cookies and answers reset, never cached", async () => {
    const { api } = server();
    const response = await reset(api, {
      login: loginToken(NOW),
      signup: signupToken(NOW),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ outcome: "reset" });
    expect(cleared(response.headers, "__Host-influx-login")).toBe(true);
    expect(cleared(response.headers, "__Host-influx-signup")).toBe(true);
    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("clears them even when the browser holds none", async () => {
    const { api } = server();
    const response = await reset(api, {});
    expect(response.statusCode).toBe(200);
    expect(cleared(response.headers, "__Host-influx-login")).toBe(true);
    expect(cleared(response.headers, "__Host-influx-signup")).toBe(true);
  });

  it("refuses a cross-site write", async () => {
    const { api } = server();
    const response = await api.inject({
      method: "POST",
      url: "/v1/auth/journey/reset",
      headers: {
        "x-influx-internal": WEB_SECRET,
        "sec-fetch-site": "cross-site",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(setCookies(response.headers)).toEqual([]);
  });
});
