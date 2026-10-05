// Authentication cookies (21 §4, J3-C rule 8; G-1 point 3): attributes, one surface per cookie,
// our four names only, and the ESLint guards that keep every other module away from cookies and
// from an inbound authorization header.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import type { FastifyRequest } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import {
  AUTH_COOKIES,
  clearAuthCookie,
  readAuthCookie,
  setAuthCookie,
  type AuthCookie,
} from "../src/platform/auth-cookies.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_ORIGIN,
  WEB_SECRET,
} from "./helpers.ts";

const ALL_COOKIES = Object.keys(AUTH_COOKIES) as AuthCookie[];
const foundSchema = z.strictObject({ found: z.array(z.string()) });
const okSchema = z.strictObject({ status: z.literal("ok") });

let app: ApiServer | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/**
 * Probe routes on both surfaces: GET reads every cookie of ours and answers the names found;
 * POST sets the cookie named in the query, DELETE clears it. The probes answer from their own
 * `onRequest` hook, right after the internal secret: a `/v1/bo/…` probe would otherwise meet the
 * aal2 guard of server.ts first (J3 commit 10), which is not what these tests are about.
 */
function server(): ApiServer {
  // Logs captured: the refusal cases below write an `error` line each.
  const api = buildServer(testApiConfig(), {
    logDestination: captureLogs().destination,
  });
  app = api;
  const cookieOf = (request: FastifyRequest): AuthCookie =>
    z.enum(ALL_COOKIES).parse((request.query as { cookie?: unknown }).cookie);
  const unreachable = async (): Promise<never> => {
    throw new Error("a probe answers from its onRequest hook");
  };
  for (const url of ["/v1/cookie-probe", "/v1/bo/cookie-probe"]) {
    api.get(
      url,
      {
        schema: { response: { 200: foundSchema } },
        onRequest: async (request, reply) =>
          reply.send({
            found: ALL_COOKIES.flatMap((cookie) => {
              const value = readAuthCookie(request, cookie);
              return value === null ? [] : [`${cookie}=${value}`];
            }),
          }),
      },
      unreachable,
    );
    api.post(
      url,
      {
        schema: { response: { 200: okSchema } },
        onRequest: async (request, reply) => {
          setAuthCookie(reply, cookieOf(request), "value-1", 600);
          return reply.send({ status: "ok" as const });
        },
      },
      unreachable,
    );
    api.delete(
      url,
      {
        schema: { response: { 200: okSchema } },
        onRequest: async (request, reply) => {
          clearAuthCookie(reply, cookieOf(request));
          return reply.send({ status: "ok" as const });
        },
      },
      unreachable,
    );
  }
  return api;
}

const WEB = { "x-influx-internal": WEB_SECRET, origin: WEB_ORIGIN };
const BACKOFFICE = {
  "x-influx-internal": BACKOFFICE_SECRET,
  origin: BACKOFFICE_ORIGIN,
};

/** Every one of our cookies, plus GoTrue's and an unknown one, in one Cookie header. */
const COOKIE_HEADER = [
  ...ALL_COOKIES.map((cookie) => `${AUTH_COOKIES[cookie]}=v-${cookie}`),
  "sb-127-auth-token=eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln",
  "sb-access-token=eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln",
  "other=value",
].join("; ");

describe("reading: our names, of the identified surface only", () => {
  it("reads the three web cookies on a web request, nothing else", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/v1/cookie-probe",
      headers: { ...WEB, cookie: COOKIE_HEADER },
    });
    expect(response.json()).toEqual({
      found: ["webSession=v-webSession", "login=v-login", "signup=v-signup"],
    });
  });

  it("reads the backoffice session only on a backoffice request", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/v1/bo/cookie-probe",
      headers: { ...BACKOFFICE, cookie: COOKIE_HEADER },
    });
    expect(response.json()).toEqual({
      found: ["backofficeSession=v-backofficeSession"],
    });
  });

  it("finds nothing without a Cookie header, or with an empty value", async () => {
    const api = server();
    for (const cookie of [undefined, "", `${AUTH_COOKIES.webSession}=`]) {
      const response = await api.inject({
        method: "GET",
        url: "/v1/cookie-probe",
        headers: cookie === undefined ? WEB : { ...WEB, cookie },
      });
      expect(response.json()).toEqual({ found: [] });
    }
  });

  it("refuses a GoTrue token in Authorization or in sb-* cookies without the internal secret (G-1 point 3)", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/v1/cookie-probe",
      headers: {
        authorization: "Bearer eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2ln",
        cookie: COOKIE_HEADER,
      },
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("writing: attributes of J3-C rule 8", () => {
  it.each<[AuthCookie, string, "Lax" | "Strict"]>([
    ["webSession", "/v1/cookie-probe", "Lax"],
    ["login", "/v1/cookie-probe", "Strict"],
    ["signup", "/v1/cookie-probe", "Strict"],
    ["backofficeSession", "/v1/bo/cookie-probe", "Strict"],
  ])(
    "sets %s with __Host-, Secure, HttpOnly, Path=/, no Domain",
    async (cookie, url, sameSite) => {
      const response = await server().inject({
        method: "POST",
        url: `${url}?cookie=${cookie}`,
        headers: url.startsWith("/v1/bo/") ? BACKOFFICE : WEB,
      });
      expect(response.statusCode).toBe(200);
      const header = String(response.headers["set-cookie"]);
      expect(header).toBe(
        `${AUTH_COOKIES[cookie]}=value-1; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=${sameSite}`,
      );
      expect(header).not.toMatch(/domain/i);
      expect(AUTH_COOKIES[cookie]).toMatch(/^__Host-influx-/);
    },
  );

  it("clears a cookie with the same attributes and Max-Age=0", async () => {
    const response = await server().inject({
      method: "DELETE",
      url: "/v1/cookie-probe?cookie=login",
      headers: WEB,
    });
    const header = String(response.headers["set-cookie"]);
    expect(header).toMatch(
      /^__Host-influx-login=; Max-Age=0; Path=\/; Expires=/,
    );
    expect(header).toMatch(/; HttpOnly; Secure; SameSite=Strict$/);
  });

  it("refuses to set a cookie of the other surface (500, nothing set)", async () => {
    const api = server();
    for (const [url, cookie, headers] of [
      ["/v1/cookie-probe", "backofficeSession", WEB],
      ["/v1/bo/cookie-probe", "webSession", BACKOFFICE],
      ["/v1/bo/cookie-probe", "login", BACKOFFICE],
    ] as const) {
      const response = await api.inject({
        method: "POST",
        url: `${url}?cookie=${cookie}`,
        headers,
      });
      expect(response.statusCode).toBe(500);
      expect(response.headers["set-cookie"]).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------------------------
// ESLint guards of src/
// ---------------------------------------------------------------------------------------------

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const eslint = new ESLint({ cwd: API_ROOT });

async function restrictedProperties(
  source: string,
  file: string,
): Promise<string[]> {
  const [result] = await eslint.lintText(source, {
    filePath: path.join(API_ROOT, file),
  });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === "no-restricted-properties")
    .map((message) => message.message);
}

describe("only src/platform/auth-cookies.ts touches cookies (J3-C rule 8)", () => {
  const source = `declare const request: { cookies: unknown; headers: { cookie?: string }; unsignCookie(v: string): unknown };
declare const reply: { setCookie(n: string, v: string): void; clearCookie(n: string): void };
export const a = request.cookies;
export const b = request.headers.cookie;
export const c = request.unsignCookie("x");
reply.setCookie("n", "v");
reply.clearCookie("n");
`;

  it.each([
    ["src/domains/identity/routes.ts"],
    ["src/platform/supabase.ts"],
    ["src/server.ts"],
    ["src/config/index.ts"],
    ["src/db/pool.ts"],
  ])("refuses every cookie property in %s", async (file) => {
    const messages = await restrictedProperties(source, file);
    expect(messages).toHaveLength(5);
    for (const message of messages) {
      expect(message).toMatch(/through src\/platform\/auth-cookies\.ts only/);
    }
  });

  it("accepts them in src/platform/auth-cookies.ts", async () => {
    expect(
      await restrictedProperties(source, "src/platform/auth-cookies.ts"),
    ).toEqual([]);
  });
});

describe("no inbound authorization header is read in src/ (J3-C rule 3, G-1 point 3)", () => {
  it.each([
    ["src/domains/identity/routes.ts"],
    ["src/platform/supabase.ts"],
    ["src/platform/auth-cookies.ts"],
    ["src/server.ts"],
    ["src/db/pool.ts"],
  ])("refuses headers.authorization in %s", async (file) => {
    const source = `declare const headers: { authorization?: string };
export const a = headers.authorization;
export const b = headers["authorization"];
`;
    const messages = await restrictedProperties(source, file);
    expect(messages).toHaveLength(2);
    for (const message of messages) {
      expect(message).toMatch(/never reads an authorization header/);
    }
  });
});
