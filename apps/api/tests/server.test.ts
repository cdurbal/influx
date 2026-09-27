// HTTP behaviour of apps/api at J1 (docs/mvp/21-plan-de-developpement.md §4, J1-G and J1-H):
// health check, internal secret (T7.9), surfaces, error envelope (T13, partial).
// Everything through fastify.inject(): no network, no database.
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_SECRET,
} from "./helpers.ts";

const okSchema = z.object({ status: z.literal("ok") });

let app: ApiServer | undefined;

function server(): ApiServer {
  app = buildServer(testApiConfig(), {
    logDestination: captureLogs().destination,
  });
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const ENVELOPE_KEYS = ["code", "message", "requestId"];

describe("GET /health", () => {
  it("answers without the internal secret, with no detail", async () => {
    const response = await server().inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("internal secret (03 PP-8, T7.9)", () => {
  it("refuses any other route without the secret, with 401", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/v1/status",
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthenticated");
  });

  it("refuses an unknown secret and an unknown route without the secret", async () => {
    const api = server();
    const wrong = await api.inject({
      method: "GET",
      url: "/v1/status",
      headers: { "x-influx-internal": `${WEB_SECRET}x` },
    });
    expect(wrong.statusCode).toBe(401);
    const unknown = await api.inject({ method: "GET", url: "/v1/unknown" });
    expect(unknown.statusCode).toBe(401);
  });

  it("serves the shared status route to both fronts", async () => {
    const api = server();
    for (const secret of [WEB_SECRET, BACKOFFICE_SECRET]) {
      const response = await api.inject({
        method: "GET",
        url: "/v1/status",
        headers: { "x-influx-internal": secret },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ status: "ok" });
    }
  });
});

describe("surfaces (21 J1-G)", () => {
  function withSurfaceRoutes(): ApiServer {
    const api = server();
    api.get(
      "/v1/bo/probe",
      { schema: { response: { 200: okSchema } } },
      async () => ({ status: "ok" as const }),
    );
    api.get(
      "/v1/probe",
      { schema: { response: { 200: okSchema } } },
      async () => ({ status: "ok" as const }),
    );
    return api;
  }

  it("answers 404 to the web secret on a backoffice route", async () => {
    const response = await withSurfaceRoutes().inject({
      method: "GET",
      url: "/v1/bo/probe",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
  });

  it("answers 404 to the backoffice secret on a member route", async () => {
    const response = await withSurfaceRoutes().inject({
      method: "GET",
      url: "/v1/probe",
      headers: { "x-influx-internal": BACKOFFICE_SECRET },
    });
    expect(response.statusCode).toBe(404);
  });

  it("serves each surface its own routes", async () => {
    const api = withSurfaceRoutes();
    const backoffice = await api.inject({
      method: "GET",
      url: "/v1/bo/probe",
      headers: { "x-influx-internal": BACKOFFICE_SECRET },
    });
    const web = await api.inject({
      method: "GET",
      url: "/v1/probe",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect([backoffice.statusCode, web.statusCode]).toEqual([200, 200]);
  });
});

describe("surface bound to the prefix at startup (21 J1-G, J1-J A2)", () => {
  function register(url: string, surface?: "web" | "backoffice" | "shared") {
    const api = server();
    return () =>
      api.get(
        url,
        {
          schema: { response: { 200: okSchema } },
          ...(surface === undefined ? {} : { config: { surface } }),
        },
        async () => ({ status: "ok" as const }),
      );
  }

  it.each<[string, string, "web" | "backoffice" | "shared" | undefined]>([
    ["1. web declared under /v1/bo/", "/v1/bo/probe", "web"],
    ["1. backoffice declared outside /v1/bo/", "/v1/probe", "backoffice"],
    ["2. shared outside the closed list", "/v1/probe", "shared"],
    ["2. shared under /v1/bo/", "/v1/bo/status", "shared"],
    ["3. /v1/bo exactly", "/v1/bo", undefined],
    ["3. a parameter as first segment", "/v1/:section/probe", undefined],
    ["3. a wildcard as first segment", "/v1/*", undefined],
  ])("refuses to start: %s", (_case, url, surface) => {
    expect(register(url, surface)).toThrow(/^Route \/v1\//);
  });

  it("accepts a declared surface that matches the prefix, and the listed shared routes", () => {
    expect(register("/v1/bo/probe", "backoffice")).not.toThrow();
    expect(register("/v1/probe", "web")).not.toThrow();
    expect(register("/v1/bo/:id", undefined)).not.toThrow();
    expect(register("/v1/ops/client-errors", "shared")).not.toThrow();
  });
});

describe("route rules checked at registration (02 §4 rule 1)", () => {
  it("refuses a route without a response schema", () => {
    const api = server();
    expect(() =>
      api.get("/v1/no-schema", async () => ({ status: "ok" })),
    ).toThrow(/no response schema/);
  });

  it("refuses a route outside /v1/", () => {
    const api = server();
    expect(() =>
      api.get(
        "/admin",
        { schema: { response: { 200: okSchema } } },
        async () => ({ status: "ok" as const }),
      ),
    ).toThrow(/outside \/v1\//);
  });
});

describe("error envelope (02 §9.2, T13 partial)", () => {
  it("answers an unknown route with a 404 envelope", async () => {
    const response = await server().inject({
      method: "GET",
      url: "/v1/unknown?email=someone@example.com",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(Object.keys(body.error).sort()).toEqual([...ENVELOPE_KEYS].sort());
    expect(body.error.code).toBe("not_found");
    expect(response.body).not.toContain("someone@example.com");
  });

  it("answers an unexpected error with a 500 envelope, without any detail", async () => {
    const api = server();
    api.get(
      "/v1/failing",
      { schema: { response: { 200: okSchema } } },
      async () => {
        throw new Error("SELECT * FROM identity.accounts at db.internal:5432");
      },
    );
    const response = await api.inject({
      method: "GET",
      url: "/v1/failing",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body).toEqual({
      error: {
        code: "internal_error",
        message: "Internal error",
        requestId: expect.any(String),
      },
    });
    for (const leak of ["SELECT", "identity.accounts", "db.internal", "at "]) {
      expect(response.body).not.toContain(leak);
    }
  });

  it("answers an invalid body with the field and the rule, never the value", async () => {
    const api = server();
    api.post(
      "/v1/echo",
      {
        schema: {
          body: z.object({ email: z.email() }),
          response: { 200: okSchema },
        },
      },
      async () => ({ status: "ok" as const }),
    );
    const response = await api.inject({
      method: "POST",
      url: "/v1/echo",
      headers: { "x-influx-internal": WEB_SECRET },
      payload: { email: "not-an-address-marker" },
    });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("validation_failed");
    expect(body.error.details).toEqual([
      { path: "email", issue: "invalid_format" },
    ]);
    expect(response.body).not.toContain("not-an-address-marker");
  });

  it("answers a body over 1 MB with 413 (03 PP-9)", async () => {
    const api = server();
    api.post(
      "/v1/upload",
      { schema: { response: { 200: okSchema } } },
      async () => ({ status: "ok" as const }),
    );
    const response = await api.inject({
      method: "POST",
      url: "/v1/upload",
      headers: {
        "x-influx-internal": WEB_SECRET,
        "content-type": "application/json",
      },
      payload: JSON.stringify({ data: "x".repeat(1_048_576) }),
    });
    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe("payload_too_large");
  });
});

describe("request identifier (03 PP-7)", () => {
  it("reuses a relayed UUID and replaces anything else", async () => {
    const api = server();
    const relayed = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const kept = await api.inject({
      method: "GET",
      url: "/v1/unknown",
      headers: { "x-influx-internal": WEB_SECRET, "x-request-id": relayed },
    });
    expect(kept.json().error.requestId).toBe(relayed);
    const replaced = await api.inject({
      method: "GET",
      url: "/v1/unknown",
      headers: {
        "x-influx-internal": WEB_SECRET,
        "x-request-id": "attacker-chosen-id",
      },
    });
    expect(replaced.json().error.requestId).not.toBe("attacker-chosen-id");
    expect(replaced.json().error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it.each<[string, string, Record<string, string>]>([
    ["without the secret", "/v1/status", {}],
    [
      "with an unknown secret",
      "/v1/status",
      { "x-influx-internal": `${WEB_SECRET}x` },
    ],
    ["on /health", "/health", {}],
  ])(
    "never reuses a relayed UUID %s (18 T7.11, 21 J1-J A3)",
    async (_case, url, headers) => {
      const logs = captureLogs();
      app = buildServer(testApiConfig(), { logDestination: logs.destination });
      const chosen = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
      const response = await app.inject({
        method: "GET",
        url,
        headers: { ...headers, "x-request-id": chosen },
      });
      if (response.statusCode === 401) {
        const requestId: string = response.json().error.requestId;
        expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
        expect(requestId).not.toBe(chosen);
      }
      expect(logs.text()).toContain('"requestId":"');
      expect(logs.text()).not.toContain(chosen);
    },
  );
});

describe("errors answered by the router, before any hook (21 §3 EC-27, EC-26)", () => {
  const PATH_MARKER = "path-marker-Qz7";
  const QUERY_VALUE_MARKER = "query-marker-Wx4";

  /**
   * A server with a parameter route and, when asked, an async constraint that always fails: once
   * registered, the constraint is derived for every request, whatever the route.
   */
  function routerServer(
    logs: ReturnType<typeof captureLogs>,
    withFailingConstraint: boolean,
  ): ApiServer {
    const api = buildServer(testApiConfig(), {
      logDestination: logs.destination,
    });
    app = api;
    api.get(
      "/v1/creators/:id",
      { schema: { response: { 200: okSchema } } },
      async () => ({ status: "ok" as const }),
    );
    if (!withFailingConstraint) {
      return api;
    }
    api.addConstraintStrategy({
      name: "failingConstraint",
      storage<Handler>() {
        const handlers = new Map<unknown, Handler>();
        return {
          get: (value: unknown) => handlers.get(value) ?? null,
          set: (value: unknown, handler: Handler) => {
            handlers.set(value, handler);
          },
        };
      },
      deriveConstraint(
        _request: unknown,
        _context: unknown,
        done?: (error: Error | null, value?: string) => void,
      ) {
        done?.(new Error(`constraint failed (${PATH_MARKER})`));
      },
      mustMatchWhenDerived: true,
    });
    api.get(
      "/v1/constrained",
      {
        schema: { response: { 200: okSchema } },
        constraints: { failingConstraint: "any" },
      },
      async () => ({ status: "ok" as const }),
    );
    return api;
  }

  const CASES: [string, string][] = [
    ["FST_ERR_BAD_URL", `/v1/%zz${PATH_MARKER}?email=${QUERY_VALUE_MARKER}`],
    [
      "FST_ERR_MAX_PARAM_LENGTH",
      `/v1/creators/${PATH_MARKER.repeat(15)}?email=${QUERY_VALUE_MARKER}`,
    ],
    ["FST_ERR_ASYNC_CONSTRAINT", `/v1/constrained?email=${QUERY_VALUE_MARKER}`],
  ];

  it.each(CASES)(
    "%s: 401 envelope without the secret, 404 envelope with it, nothing of the request copied",
    async (fastifyCode, url) => {
      for (const [headers, status, code] of [
        [{}, 401, "unauthenticated"],
        [{ "x-influx-internal": `${WEB_SECRET}x` }, 401, "unauthenticated"],
        [{ "x-influx-internal": WEB_SECRET }, 404, "not_found"],
        [{ "x-influx-internal": BACKOFFICE_SECRET }, 404, "not_found"],
      ] as const) {
        const logs = captureLogs();
        const api = routerServer(
          logs,
          fastifyCode === "FST_ERR_ASYNC_CONSTRAINT",
        );
        const response = await api.inject({ method: "GET", url, headers });
        expect(response.statusCode).toBe(status);
        expect(response.headers["content-type"]).toMatch(/^application\/json/);
        const body = response.json();
        expect(Object.keys(body)).toEqual(["error"]);
        expect(Object.keys(body.error).sort()).toEqual(
          [...ENVELOPE_KEYS].sort(),
        );
        expect(body.error.code).toBe(code);
        expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
        const text = logs.text();
        // The line carries the code of the router error, never its message.
        expect(text).toContain(`"code":"${fastifyCode}"`);
        expect(text).toContain(body.error.requestId);
        for (const marker of [PATH_MARKER, QUERY_VALUE_MARKER]) {
          expect(response.body).not.toContain(marker);
          expect(text).not.toContain(marker);
        }
        expect(response.body).not.toContain("FST_");
        expect(text).not.toContain("is not a valid url component");
        expect(text).not.toContain("exceeding the max param length");
        await api.close();
        app = undefined;
      }
    },
  );
});
