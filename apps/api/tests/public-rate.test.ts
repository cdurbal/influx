// T15 (docs/mvp/18 T15.1 to T15.5; 21 §J9 commit 7): the rate of EVERY public route, read from the
// server itself rather than from a list kept by hand.
//   - the registered routes are exactly the public ones of PUBLIC_ROUTE_RATES, the exempted ones,
//     /health and the routes behind a session below: a new route fails here until it is placed;
//   - each public route answers 429 past its bound per address, before its handler, while another
//     address still passes (T15.4); the instance bound holds across addresses;
//   - every 429 is the same answer: the envelope `rate_limited` and a Retry-After, whatever
//     produced it (this bound or a counter in the database).
// Through fastify.inject(), i.e. straight to apps/api without any front (T15.3). The requests are
// incomplete on purpose (no body, no cookie, no query): refused by their schema or their missing
// cookie, they never reach the database, which these tests do not have.
import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import {
  PUBLIC_RATE_EXEMPTIONS,
  PUBLIC_ROUTE_RATES,
} from "../src/platform/public-rate.ts";
import {
  BACKOFFICE_ATTEMPTS_PER_IP_HOUR,
  CODE_REQUESTS_PER_IP_HOUR,
  CODE_VERIFY_FAILURES_PER_IP_HOUR,
  DELIVERY_REPORTS_UNKNOWN_IP_HOUR,
} from "../src/domains/identity/settings.ts";
import { ApiError } from "../src/platform/errors.ts";
import {
  buildServer,
  RATE_LIMITED_RETRY_AFTER_SECONDS,
  type ApiServer,
} from "../src/server.ts";
import {
  BACKOFFICE_SECRET,
  captureLogs,
  registeredRoutes,
  testApiConfig,
  WEB_SECRET,
} from "./helpers.ts";

/** Every route that requires a session (member on web, internal on the backoffice). */
const SESSION_ROUTES: readonly string[] = [
  "GET /v1/me",
  "PATCH /v1/me",
  "GET /v1/me/brand-profile",
  "PATCH /v1/me/brand-profile",
  "POST /v1/me/brand-profile/submit",
  "GET /v1/me/brand-profile/logo",
  "PUT /v1/me/brand-profile/logo",
  "DELETE /v1/me/brand-profile/logo",
  "GET /v1/me/creator-profile",
  "PATCH /v1/me/creator-profile",
  "GET /v1/me/consent",
  "PUT /v1/me/consent",
  "GET /v1/me/sessions",
  "DELETE /v1/me/sessions",
  "DELETE /v1/me/sessions/:id",
  "POST /v1/me/terms/accept",
  "POST /v1/me/reauthenticate/request-code",
  "POST /v1/me/reauthenticate/verify-code",
  "GET /v1/me/email-change",
  "POST /v1/me/email-change",
  "POST /v1/me/email-change/confirm",
  "DELETE /v1/me/email-change/:id",
  "GET /v1/me/data-requests",
  "POST /v1/me/data-requests",
  "GET /v1/me/data-export",
  "POST /v1/me/data-export/:id/download",
  "POST /v1/ops/client-errors",
  "POST /v1/bo/auth/reauthenticate",
  "GET /v1/bo/me",
  "GET /v1/bo/accounts",
  "POST /v1/bo/accounts/search",
  "GET /v1/bo/accounts/counters",
  "GET /v1/bo/accounts/:id",
  "POST /v1/bo/accounts/:id/corrections",
  "POST /v1/bo/accounts/:id/brevo-suppression/lift",
  "POST /v1/bo/leads/replays",
  "GET /v1/bo/settings/apollo",
  "GET /v1/bo/alerts",
  "GET /v1/bo/ops/status",
  "GET /v1/bo/ops/errors",
  "GET /v1/bo/ops/errors/:id",
  "GET /v1/bo/ops/traffic",
  "GET /v1/bo/ops/processes",
  "GET /v1/bo/queues/counters",
  "GET /v1/bo/queues/profiles-advertiser/entries",
  "POST /v1/bo/queues/profiles-advertiser/entries/search",
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/open",
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/publish",
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/reject",
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/release",
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/extend",
  "POST /v1/bo/queues/profiles-advertiser/entries/:id/force-release",
  "GET /v1/bo/queues/profiles-advertiser/entries/:id/logo",
  "GET /v1/bo/dual-control",
  "POST /v1/bo/dual-control",
  "GET /v1/bo/dual-control/degraded",
  "GET /v1/bo/dual-control/:id",
  "POST /v1/bo/dual-control/:id/confirm",
  "POST /v1/bo/dual-control/:id/cancel",
  "GET /v1/bo/internal-accounts",
  "GET /v1/bo/internal-invitations",
  "POST /v1/bo/internal-invitations",
  "POST /v1/bo/internal-invitations/:id/revoke",
  "GET /v1/bo/member-invitations",
  "POST /v1/bo/member-invitations",
  "POST /v1/bo/member-invitations/:id/revoke",
];

const NIL = "00000000-0000-4000-8000-000000000000";
const NOW = new Date("2026-10-21T10:00:05Z");

let app: ApiServer | undefined;

function server(now: () => Date = () => NOW) {
  const logs = captureLogs();
  app = buildServer(testApiConfig(), {
    logDestination: logs.destination,
    identity: {
      now,
      codeRequestFloorMs: 0,
      deliveryReportFloorMs: 0,
      backofficeAuthFloorMs: 0,
    },
  });
  return { api: app, logs };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

/** A random address of the documentation prefixes (RFC 5737), one per caller. */
function address(): string {
  const [a = 0, b = 0] = randomBytes(2);
  return `198.51.${a}.${b}`;
}

/** An incomplete call of a route: the bound is counted, the database is never reached. */
async function call(api: ApiServer, routeKey: string, clientAddress?: string) {
  const [method = "GET", url = "/"] = routeKey.split(" ");
  const write = method !== "GET" && method !== "DELETE";
  return api.inject({
    method: method as "GET" | "POST",
    url: url.replace(":id", NIL),
    headers: {
      "x-influx-internal": url.startsWith("/v1/bo/")
        ? BACKOFFICE_SECRET
        : WEB_SECRET,
      "sec-fetch-site": "same-origin",
      ...(clientAddress === undefined ? {} : { "x-real-ip": clientAddress }),
      ...(write ? { "content-type": "application/json" } : {}),
    },
    ...(write ? { payload: "{}" } : {}),
  });
}

/** The single answer of every 429 (02 §9.2, T13.4). */
function expectHomogeneous429(response: Awaited<ReturnType<typeof call>>) {
  expect(response.statusCode).toBe(429);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  const body = response.json();
  expect(body).toEqual({
    error: {
      code: "rate_limited",
      message: "Too many requests",
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    },
  });
  const retryAfter = Number(response.headers["retry-after"]);
  expect(Number.isInteger(retryAfter)).toBe(true);
  expect(retryAfter).toBeGreaterThanOrEqual(1);
  expect(retryAfter).toBeLessThanOrEqual(RATE_LIMITED_RETRY_AFTER_SECONDS);
}

describe("inventory: every route reached without a session is bounded (T15)", () => {
  it("places every registered route, and only registered ones", async () => {
    const { api } = server();
    const registered = await registeredRoutes(api);
    const placed = [
      "GET /health",
      ...Object.keys(PUBLIC_ROUTE_RATES),
      ...Object.keys(PUBLIC_RATE_EXEMPTIONS),
      ...SESSION_ROUTES,
    ];
    expect(new Set(placed).size).toBe(placed.length);
    expect(registered).toEqual([...placed].sort());
  });

  it.each(SESSION_ROUTES)(
    "%s never answers without a session (refused by its schema or its session)",
    async (routeKey) => {
      const { api } = server();
      const response = await call(api, routeKey, address());
      expect([400, 401]).toContain(response.statusCode);
    },
  );

  it("stays above the hourly ceilings of the counters in the database, which answer first (RG44)", () => {
    const ceilings: [string, number][] = [
      ["POST /v1/auth/request-code", CODE_REQUESTS_PER_IP_HOUR],
      ["POST /v1/auth/verify-code", CODE_VERIFY_FAILURES_PER_IP_HOUR],
      ["POST /v1/support/code-not-received", DELIVERY_REPORTS_UNKNOWN_IP_HOUR],
      ["POST /v1/bo/auth/login", BACKOFFICE_ATTEMPTS_PER_IP_HOUR],
    ];
    const rates: Readonly<Record<string, { address: number }>> =
      PUBLIC_ROUTE_RATES;
    for (const [routeKey, ceiling] of ceilings) {
      expect(rates[routeKey]?.address, routeKey).toBeGreaterThan(ceiling);
    }
  });

  it("bounds every public route at positive values, the instance above the address", () => {
    for (const rate of Object.values(PUBLIC_ROUTE_RATES)) {
      expect(rate.address).toBeGreaterThan(0);
      expect(rate.instance).toBeGreaterThan(rate.address);
    }
  });
});

describe("429 past the bound of each public route (T15.1, T15.3, T15.4)", () => {
  it.each(Object.entries(PUBLIC_ROUTE_RATES))(
    "%s: %o",
    async (routeKey, rate) => {
      const { api } = server();
      const caller = address();
      for (let index = 0; index < rate.address; index += 1) {
        const response = await call(api, routeKey, caller);
        expect(response.statusCode, `call ${index + 1}`).not.toBe(429);
        expect(response.statusCode, `call ${index + 1}`).toBeLessThan(500);
      }
      expectHomogeneous429(await call(api, routeKey, caller));
      // T15.4: another address keeps its own bound.
      expect((await call(api, routeKey, address())).statusCode).not.toBe(429);
    },
  );

  it("bounds an unknown address as one caller (03 A5 point 5)", async () => {
    const { api } = server();
    const routeKey = "POST /v1/signup";
    const rate = PUBLIC_ROUTE_RATES[routeKey];
    for (let index = 0; index < rate.address; index += 1) {
      const invalid = index % 2 === 0 ? undefined : "not-an-address";
      expect((await call(api, routeKey, invalid)).statusCode).toBe(400);
    }
    expectHomogeneous429(await call(api, routeKey));
    expectHomogeneous429(await call(api, routeKey, "999.1.1.1"));
  });

  it("bounds the whole instance across addresses, and starts again the next minute", async () => {
    let now = NOW;
    const { api } = server(() => now);
    const routeKey = "POST /v1/support/code-not-received";
    const rate = PUBLIC_ROUTE_RATES[routeKey];
    let accepted = 0;
    while (accepted < rate.instance) {
      const caller = address();
      for (let index = 0; index < rate.address; index += 1) {
        expect((await call(api, routeKey, caller)).statusCode).toBe(400);
        accepted += 1;
      }
    }
    expectHomogeneous429(await call(api, routeKey, address()));
    now = new Date(NOW.getTime() + 60_000);
    expect((await call(api, routeKey, address())).statusCode).toBe(400);
  });

  it("counts each route apart: one route over its bound leaves the others open", async () => {
    const { api } = server();
    const caller = address();
    for (
      let index = 0;
      index < PUBLIC_ROUTE_RATES["POST /v1/signup"].address;
      index += 1
    ) {
      await call(api, "POST /v1/signup", caller);
    }
    expect((await call(api, "POST /v1/signup", caller)).statusCode).toBe(429);
    expect((await call(api, "GET /v1/auth/journey", caller)).statusCode).toBe(
      200,
    );
  });

  it("logs the overflow with the route model and the bound, never the address (T15.5)", async () => {
    const { api, logs } = server();
    const caller = address();
    for (
      let index = 0;
      index <= PUBLIC_ROUTE_RATES["POST /v1/signup"].address;
      index += 1
    ) {
      await call(api, "POST /v1/signup", caller);
    }
    const text = logs.text();
    expect(text).toContain('"msg":"public route over its rate"');
    expect(text).toContain('"route":"/v1/signup","scope":"address"');
    expect(text).not.toContain(caller);
  });
});

describe("one 429 for every limiter (homogeneous)", () => {
  it("adds the same Retry-After to a 429 of a counter in the database", async () => {
    const { api } = server();
    api.get(
      "/v1/throttled",
      { schema: { response: { 200: z.object({ status: z.literal("ok") }) } } },
      async () => {
        throw new ApiError("rate_limited");
      },
    );
    const response = await api.inject({
      method: "GET",
      url: "/v1/throttled",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expectHomogeneous429(response);
    expect(response.headers["retry-after"]).toBe(
      String(RATE_LIMITED_RETRY_AFTER_SECONDS),
    );
  });
});
