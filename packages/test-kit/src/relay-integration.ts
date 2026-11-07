// T7 in integration, and T13 on the fronts (docs/mvp/18 T7, T13; 03 §6.4 PP-1 to PP-12; 21 §J9
// commit 7). The unit tests of the relay (tests/relay.test.ts) call its handler on a fake server;
// here the BUILT front runs (`next start`, after `next build`, in `test:artifacts`) in front of an
// API double, and every request goes over HTTP, written byte for byte (node:http, no client
// normalisation): what Next.js does to the request before the relay — routing, decoding, the
// proxy — is part of what is tested. One suite, run by both fronts on their own build.
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { createRequire } from "node:module";
import { createServer as createNetServer, type AddressInfo } from "node:net";
import type {
  afterAll as AfterAll,
  beforeAll as BeforeAll,
  beforeEach as BeforeEach,
  describe as Describe,
  expect as Expect,
  it as It,
} from "vitest";

/** A request received by the API double, as it arrived. */
export type RecordedRequest = {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  bodyBytes: number;
};

export type ApiDouble = {
  origin: string;
  requests: RecordedRequest[];
  close(): Promise<void>;
};

/** Session cookie read by the double to answer per user (T7.7); any name would do. */
const SESSION_COOKIE = "__Host-influx-session";

function sessionOf(headers: IncomingHttpHeaders): string | null {
  const cookie = headers.cookie ?? "";
  const match = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`).exec(cookie);
  return match?.[1] ?? null;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    // Headers apps/api never sends: the relay must not let them through (PP-11).
    server: "api-double/1.2.3",
    "x-powered-by": "api-double",
    "x-internal-host": "api.railway.internal",
  });
  response.end(JSON.stringify(body));
}

/**
 * The double of apps/api: records every request, then answers by path.
 * - /v1/slow: never answers (PP-9: the relay gives up after 10 s);
 * - /v1/redirect: 302 to another origin (PP-4: relayed, never followed);
 * - /v1/cookies: two __Host- cookies with every attribute (PP-10: verbatim);
 * - /v1/bad-cookie: a cookie without the __Host- prefix (PP-10: the answer is refused);
 * - /v1/failing: a 500 envelope, as apps/api writes it (T13: relayed as is);
 * - anything else: 200 with the method, the path and the session cookie received (T7.7).
 */
export async function startApiDouble(): Promise<ApiDouble> {
  const requests: RecordedRequest[] = [];
  const pending = new Set<ServerResponse>();
  const server = createServer((request: IncomingMessage, response) => {
    let bodyBytes = 0;
    request.on("data", (chunk: Buffer) => {
      bodyBytes += chunk.byteLength;
    });
    request.on("end", () => {
      const url = request.url ?? "";
      requests.push({
        method: request.method ?? "",
        url,
        headers: request.headers,
        bodyBytes,
      });
      const path = url.split("?")[0];
      if (path === "/v1/slow") {
        pending.add(response);
        return;
      }
      if (path === "/v1/redirect") {
        response.writeHead(302, { location: "https://elsewhere.example/v1/x" });
        response.end();
        return;
      }
      if (path === "/v1/cookies") {
        response.setHeader("set-cookie", [
          "__Host-influx-session=s1; Path=/; Secure; HttpOnly; SameSite=Lax; Partitioned; Priority=High",
          "__Host-influx-login=l1; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=600",
        ]);
        json(response, 200, { status: "ok" });
        return;
      }
      if (path === "/v1/bad-cookie") {
        response.setHeader(
          "set-cookie",
          "session=s1; Path=/; Secure; HttpOnly",
        );
        json(response, 200, { status: "ok" });
        return;
      }
      if (path === "/v1/failing") {
        json(response, 500, {
          error: {
            code: "internal_error",
            message: "Internal error",
            requestId: randomUUID(),
          },
        });
        return;
      }
      json(response, 200, {
        method: request.method,
        path,
        session: sessionOf(request.headers),
      });
    });
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        for (const response of pending) {
          response.destroy();
        }
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export type RawResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  /** Every Set-Cookie line, as received. */
  setCookies: string[];
  body: string;
};

/**
 * One HTTP/1.1 request whose request-target is sent exactly as given: no URL parsing, no dot
 * segment removal, no encoding (node:http only refuses spaces and control characters).
 */
export function rawRequest(
  origin: string,
  target: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
    /** Sends the body in chunks, without Content-Length. */
    chunked?: boolean;
  } = {},
): Promise<RawResponse> {
  const { hostname, port } = new URL(origin);
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      {
        host: hostname,
        port,
        method: options.method ?? "GET",
        path: target,
        headers: options.headers,
        agent: false,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            setCookies: response.headers["set-cookie"] ?? [],
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", reject);
      },
    );
    outgoing.on("error", reject);
    if (options.body !== undefined) {
      if (options.chunked === true) {
        const body = Buffer.from(options.body);
        const size = 64 * 1024;
        for (let offset = 0; offset < body.byteLength; offset += size) {
          outgoing.write(body.subarray(offset, offset + size));
        }
      } else {
        outgoing.setHeader("content-length", Buffer.byteLength(options.body));
        outgoing.write(options.body);
      }
    }
    outgoing.end();
  });
}

async function freePort(): Promise<number> {
  const server = createNetServer();
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
  return port;
}

export type BuiltFront = {
  origin: string;
  /** What the server printed (standard output and error). */
  output(): string;
  close(): Promise<void>;
};

const START_TIMEOUT_MS = 60_000;

/**
 * Starts the build of a front with `next start` on the loopback, its relay pointed at `apiOrigin`.
 * Throws when the build is missing (`next start` fails): a skipped build never passes.
 */
export async function startBuiltFront(
  frontRoot: string,
  apiOrigin: string,
  internalSecret: string,
): Promise<BuiltFront> {
  const port = await freePort();
  const nextBin = createRequire(`${frontRoot}/package.json`).resolve(
    "next/dist/bin/next",
  );
  let output = "";
  const child: ChildProcess = spawn(
    process.execPath,
    [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)],
    {
      cwd: frontRoot,
      env: {
        PATH: process.env.PATH,
        SystemRoot: process.env.SystemRoot,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        INFLUX_ENV: "development",
        INFLUX_API_INTERNAL_URL: apiOrigin,
        INFLUX_API_INTERNAL_SECRET: internalSecret,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout?.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  const origin = `http://127.0.0.1:${port}`;
  const close = async () => {
    if (child.exitCode === null) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
    }
  };
  const deadline = Date.now() + START_TIMEOUT_MS;
  for (;;) {
    if (child.exitCode !== null) {
      throw new Error(`next start exited (${child.exitCode}):\n${output}`);
    }
    try {
      // A path the relay refuses by itself: the readiness probe never reaches the double.
      await rawRequest(origin, "/api/ready");
      break;
    } catch {
      if (Date.now() > deadline) {
        await close();
        throw new Error(`next start did not answer in time:\n${output}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return { origin, output: () => output, close };
}

export type RelayIntegrationSuite = {
  /** The front's root directory (its `.next` holds the build). */
  frontRoot: string;
  /** A page of the front that does not exist, and a text its own 404 screen shows. */
  unknownPage: { path: string; text: string };
  vitest: {
    describe: typeof Describe;
    it: typeof It;
    expect: typeof Expect;
    beforeAll: typeof BeforeAll;
    afterAll: typeof AfterAll;
    beforeEach: typeof BeforeEach;
  };
};

/** Paths refused by the relay itself, 404 envelope, without any call to apps/api (T7.1, PP-2). */
export const REFUSED_TARGETS: readonly string[] = [
  // Resolved by Next.js to /api/admin first (see DOT_SEGMENT_TARGETS), then refused.
  "/api/v1/../admin",
  "/api/v1/a:b",
  "/api/v1/a@b",
  "/api/v1/status.json",
  "/api/v2/status",
  "/api/status",
  `/api/v1/${"a".repeat(201)}`,
  "/api/v1/%2e%2e%2fadmin",
  "/api/v1/..%2fadmin",
  "/api/v1/api.internal%40evil.tld",
  "/api/v1/%252e%252e",
  "/api/v1/%73tatus",
  "/api/v1/bo%2Fx",
];

/**
 * Dot segments are resolved by Next.js (WHATWG URL) BEFORE the relay, which checks the result like
 * any path: the request reaches apps/api under the resolved path, never under the raw one, and it
 * cannot leave /api/v1/ (a path resolved outside it is not the relay's route).
 */
export const DOT_SEGMENT_TARGETS: readonly [string, string][] = [
  ["/api/v1/./status", "/v1/status"],
  ["/api/v1/bo/../status", "/v1/status"],
];

/**
 * Paths that Next.js answers itself, BEFORE the relay (its server normalises `//` and `\` with a
 * 308 to the cleaned path of the same origin, and cannot decode a broken percent sequence: 500,
 * plain text). Never a call to apps/api; the cleaned path, once followed, meets the relay's
 * checks like any other (J9 commit 7, "Issu du commit 7").
 */
export const NEXT_ANSWERED_TARGETS: readonly [string, number, string | null][] =
  [
    ["/api/v1//status", 308, "/api/v1/status"],
    ["/api//v1/status", 308, "/api/v1/status"],
    ["/api/v1/a\\b", 308, "/api/v1/a/b"],
    ["//evil.example/api/v1/status", 308, "/evil.example/api/v1/status"],
    ["/api/v1/%E0%A4%A", 500, null],
  ];

const ENVELOPE_KEYS = ["code", "message", "requestId"];

/** The four relay files' answer of a refusal (relay.ts `refuse`): the envelope and no-store. */
function expectRelayRefusal(
  expect: typeof Expect,
  response: RawResponse,
  status: number,
  code: string,
): void {
  expect(response.status).toBe(status);
  expect(response.headers["cache-control"]).toBe("no-store");
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  const body = JSON.parse(response.body) as { error: Record<string, unknown> };
  expect(Object.keys(body)).toEqual(["error"]);
  expect(Object.keys(body.error).sort()).toEqual(ENVELOPE_KEYS);
  expect(body.error.code).toBe(code);
  expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
}

/** T13.3 on any answer of the front: no header names the server, the framework or a version. */
function expectNoComponentHeader(
  expect: typeof Expect,
  response: RawResponse,
): void {
  expect(response.headers["x-powered-by"]).toBeUndefined();
  expect(response.headers.server).toBeUndefined();
  expect(response.headers["x-internal-host"]).toBeUndefined();
}

export function relayIntegrationSuite(suite: RelayIntegrationSuite): void {
  const { describe, it, expect, beforeAll, afterAll, beforeEach } =
    suite.vitest;
  const secret = `relay-integration-secret-${randomUUID()}`;
  let api: ApiDouble;
  let front: BuiltFront;
  /** Every answer of the front in this suite: each must carry no-store (T7.6). */
  const relayAnswers: RawResponse[] = [];

  async function relayed(
    target: string,
    options: Parameters<typeof rawRequest>[2] = {},
  ): Promise<RawResponse> {
    const response = await rawRequest(front.origin, target, options);
    relayAnswers.push(response);
    return response;
  }

  beforeAll(async () => {
    api = await startApiDouble();
    front = await startBuiltFront(suite.frontRoot, api.origin, secret);
  }, START_TIMEOUT_MS + 10_000);

  afterAll(async () => {
    await front?.close();
    await api?.close();
  });

  beforeEach(() => {
    api.requests.length = 0;
  });

  describe("T7.1: refused on the raw path, without any call to apps/api", () => {
    it.each(REFUSED_TARGETS)("%s", async (target) => {
      const response = await relayed(target);
      expectRelayRefusal(expect, response, 404, "not_found");
      expect(api.requests).toEqual([]);
    });

    it.each(NEXT_ANSWERED_TARGETS)(
      "%s: answered by Next.js before the relay (%d), never by apps/api",
      async (target, status, location) => {
        const response = await rawRequest(front.origin, target);
        expect(response.status).toBe(status);
        if (location === null) {
          expect(response.body).toBe("Internal Server Error");
        } else {
          // Same origin: a path, never an authority.
          expect(response.headers.location).toBe(location);
        }
        expect(api.requests).toEqual([]);
      },
    );

    it.each(DOT_SEGMENT_TARGETS)(
      "%s: resolved by Next.js first, relayed as %s",
      async (target, apiPath) => {
        const response = await relayed(target);
        expect(response.status).toBe(200);
        expect(api.requests.map((request) => request.url)).toEqual([apiPath]);
      },
    );

    it("never relays an absolute-form target (a browser never sends one)", async () => {
      // Next.js answers it with a 308 to the target's own authority (J9 commit 7, "Issu du
      // commit 7": Railway's edge to be checked on staging). What matters here: no call.
      const response = await rawRequest(
        front.origin,
        "https://api.internal@evil.tld/api/v1/status",
      );
      expect(response.status).not.toBe(200);
      expect(api.requests).toEqual([]);
    });

    it("refuses a method outside PP-3, without any call to apps/api", async () => {
      // CONNECT is never routed by Node.js's HTTP server to Next.js: the connection is closed.
      for (const method of ["OPTIONS", "TRACE", "HEAD"]) {
        const response = await rawRequest(front.origin, "/api/v1/status", {
          method,
        });
        expect(response.status, method).not.toBe(200);
      }
      expect(api.requests).toEqual([]);
    });

    it("forwards an allowed path and its query unchanged, to the configured base (PP-1)", async () => {
      const response = await relayed("/api/v1/me/data-export?page=2&x=a-b", {
        headers: { host: "evil.example", "x-forwarded-host": "evil.example" },
      });
      expect(response.status).toBe(200);
      expect(api.requests).toHaveLength(1);
      expect(api.requests[0]?.url).toBe("/v1/me/data-export?page=2&x=a-b");
      expect(api.requests[0]?.headers.host).toBe(new URL(api.origin).host);
      expect(api.requests[0]?.headers["x-influx-internal"]).toBe(secret);
    });
  });

  describe("T7.2: headers forwarded (PP-5, PP-6, PP-7)", () => {
    it("forwards the allow-list only, and drops x-middleware-subrequest, x-forwarded-*, x-*", async () => {
      await relayed("/api/v1/echo", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "accept-language": "fr",
          "idempotency-key": "k-1",
          origin: "https://influx.example",
          "sec-fetch-site": "same-origin",
          cookie: `${SESSION_COOKIE}=a`,
          "user-agent": "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0",
          "x-middleware-subrequest":
            "middleware:middleware:middleware:middleware:middleware",
          "x-forwarded-for": "203.0.113.9",
          "x-forwarded-host": "evil.example",
          "x-real-ip": "198.51.100.7",
          "x-request-id": "client-chosen-id",
          "x-influx-internal": "forged",
          "x-anything": "1",
          authorization: "Bearer forged",
        },
        body: "{}",
      });
      expect(api.requests).toHaveLength(1);
      const headers = api.requests[0]?.headers ?? {};
      for (const name of [
        "x-middleware-subrequest",
        "x-forwarded-for",
        "x-forwarded-host",
        "x-anything",
        "authorization",
      ]) {
        expect(headers[name], name).toBeUndefined();
      }
      expect(headers["x-influx-internal"]).toBe(secret);
      expect(headers["x-real-ip"]).toBe("198.51.100.7");
      expect(headers["client-request-id"]).toBe("client-chosen-id");
      expect(headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
      expect(headers["client-user-agent"]).toBe(
        "Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0",
      );
      expect(headers["idempotency-key"]).toBe("k-1");
      expect(headers.cookie).toBe(`${SESSION_COOKIE}=a`);
    });

    it("never forwards a malformed x-real-ip, nor any x-forwarded-for in its place", async () => {
      // The shape only (PP-6): `1.2.3.4:80` passes it, and apps/api's zod refuses it (A5).
      for (const value of [
        "198.51.100.7, 203.0.113.9",
        "host.example",
        "1".repeat(46),
      ]) {
        await relayed("/api/v1/echo", {
          headers: { "x-real-ip": value, "x-forwarded-for": "203.0.113.9" },
        });
      }
      expect(api.requests).toHaveLength(3);
      for (const request of api.requests) {
        expect(request.headers["x-real-ip"]).toBeUndefined();
        expect(request.headers["x-forwarded-for"]).toBeUndefined();
      }
    });
  });

  describe("T7.3: body size and delay (PP-9)", () => {
    // D80: 2 MiB, the raw bytes of a logo (jalons/l2b/stockage.md §3).
    it("forwards 2 MiB, refuses 2 MiB + 1 with 413, declared or streamed", async () => {
      const limit = 2_097_152;
      const exact = await relayed("/api/v1/echo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: Buffer.alloc(limit, 0x61),
      });
      expect(exact.status).toBe(200);
      expect(api.requests[0]?.bodyBytes).toBe(limit);
      for (const chunked of [false, true]) {
        const over = await relayed("/api/v1/echo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: Buffer.alloc(limit + 1, 0x61),
          chunked,
        });
        expectRelayRefusal(expect, over, 413, "payload_too_large");
      }
      expect(api.requests).toHaveLength(1);
    });

    // D82 (1): 8 MiB on the deposit of a piece of verification, and on that path only.
    it("forwards 8 MiB on the deposit of a piece, refuses 8 MiB + 1 there and 2 MiB + 1 elsewhere", async () => {
      const limit = 8_388_608;
      const evidence =
        "/api/v1/me/verification/requests/0d6c1b9e-3f7a-4c52-9a1e-6b2f8d4c7e10/evidence";
      const octets = { "content-type": "application/octet-stream" };
      const exact = await relayed(evidence, {
        method: "PUT",
        headers: octets,
        body: Buffer.alloc(limit, 0x61),
      });
      expect(exact.status).toBe(200);
      expect(api.requests[0]?.bodyBytes).toBe(limit);
      for (const chunked of [false, true]) {
        const over = await relayed(evidence, {
          method: "PUT",
          headers: octets,
          body: Buffer.alloc(limit + 1, 0x61),
          chunked,
        });
        expectRelayRefusal(expect, over, 413, "payload_too_large");
      }
      const elsewhere = await relayed(evidence, {
        method: "POST",
        headers: octets,
        body: Buffer.alloc(2_097_153, 0x61),
      });
      expectRelayRefusal(expect, elsewhere, 413, "payload_too_large");
      expect(api.requests).toHaveLength(1);
    });

    it("gives up after 10 s with a 502 envelope, and nothing else (T13)", async () => {
      const started = Date.now();
      const response = await relayed("/api/v1/slow");
      const elapsed = Date.now() - started;
      expectRelayRefusal(expect, response, 502, "service_unavailable");
      // The cause stays in the server's line (relay.ts logRelayError), never in the answer.
      expect(response.body).not.toMatch(
        /at |ECONN|127\.0\.0\.1|fetch|undici|node|abort|timeout/i,
      );
      expect(elapsed).toBeGreaterThanOrEqual(9_500);
      expect(elapsed).toBeLessThan(15_000);
    }, 20_000);
  });

  describe("T7.4, T7.5: the answer of apps/api", () => {
    it("relays a redirect as is, without following it (PP-4)", async () => {
      const response = await relayed("/api/v1/redirect");
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe("https://elsewhere.example/v1/x");
      expect(api.requests).toHaveLength(1);
    });

    it("relays several Set-Cookie verbatim, every attribute kept (PP-10)", async () => {
      const response = await relayed("/api/v1/cookies");
      expect(response.status).toBe(200);
      expect(response.setCookies).toEqual([
        "__Host-influx-session=s1; Path=/; Secure; HttpOnly; SameSite=Lax; Partitioned; Priority=High",
        "__Host-influx-login=l1; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=600",
      ]);
    });

    it("refuses the whole answer when a cookie is not a __Host- cookie (PP-10)", async () => {
      const response = await relayed("/api/v1/bad-cookie");
      expectRelayRefusal(expect, response, 502, "service_unavailable");
      expect(response.setCookies).toEqual([]);
    });

    it("relays only content-type, retry-after and location (PP-11, T13.3)", async () => {
      const response = await relayed("/api/v1/echo");
      expectNoComponentHeader(expect, response);
    });
  });

  describe("T7.7: two users, one URL, two answers", () => {
    it("answers each session its own data, requests interleaved", async () => {
      const sessions = Array.from({ length: 24 }, (_, index) =>
        index % 2 === 0 ? `user-a-${index}` : `user-b-${index}`,
      );
      const responses = await Promise.all(
        sessions.map((session) =>
          relayed("/api/v1/me", {
            headers: { cookie: `${SESSION_COOKIE}=${session}` },
          }),
        ),
      );
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(JSON.parse(response.body).session).toBe(sessions[index]);
      });
      expect(api.requests).toHaveLength(sessions.length);
      // Once more, sequentially: the second user never gets the first one's answer.
      const first = await relayed("/api/v1/me", {
        headers: { cookie: `${SESSION_COOKIE}=first` },
      });
      const second = await relayed("/api/v1/me", {
        headers: { cookie: `${SESSION_COOKIE}=second` },
      });
      expect(JSON.parse(first.body).session).toBe("first");
      expect(JSON.parse(second.body).session).toBe("second");
    });
  });

  describe("T13 on the front: no detail", () => {
    it("relays the 500 envelope of apps/api as is, without adding anything", async () => {
      const response = await relayed("/api/v1/failing");
      expect(response.status).toBe(500);
      const body = JSON.parse(response.body) as {
        error: Record<string, unknown>;
      };
      expect(Object.keys(body.error).sort()).toEqual(ENVELOPE_KEYS);
      expectNoComponentHeader(expect, response);
    });

    it("serves an unknown page with its own 404 screen, never Next.js's", async () => {
      const response = await rawRequest(front.origin, suite.unknownPage.path);
      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toMatch(/^text\/html/);
      expect(response.body).toContain(suite.unknownPage.text);
      // Next.js's own page (inline styles, light background) is never rendered as HTML.
      expect(response.body).not.toContain('class="next-error-h1"');
      expectNoComponentHeader(expect, response);
    });
  });

  describe("T7.6: no-store on every answer of the relay", () => {
    it("has seen no answer of the relay without Cache-Control: no-store", () => {
      expect(relayAnswers.length).toBeGreaterThan(REFUSED_TARGETS.length);
      for (const response of relayAnswers) {
        expect(response.headers["cache-control"]).toBe("no-store");
      }
    });
  });
}
