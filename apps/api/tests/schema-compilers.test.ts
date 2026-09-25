// The response schema is an output filter: an undeclared field is never serialized
// (docs/mvp/02-architecture-3-espaces.md §2.5 point 4, docs/mvp/21 §4 J1-A and J1-H).
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import {
  zodSerializerCompiler,
  zodValidatorCompiler,
} from "../src/platform/schema-compilers.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "./helpers.ts";

let app: ApiServer | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const profileSchema = z.object({ publicId: z.string(), country: z.string() });

describe("serializer compiler", () => {
  it("strips every field that the response schema does not declare", async () => {
    app = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    app.get(
      "/v1/profile",
      { schema: { response: { 200: profileSchema } } },
      // The handler returns more than the contract: an identity field leaks from the "database".
      async () =>
        ({
          publicId: "c_8f3k2",
          country: "FR",
          handle: "@pseudo_test",
        }) as z.input<typeof profileSchema>,
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/profile",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ publicId: "c_8f3k2", country: "FR" });
    expect(response.body).not.toContain("@pseudo_test");
  });

  it("turns a payload that breaks its schema into a 500 without detail", async () => {
    app = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    app.get(
      "/v1/broken",
      { schema: { response: { 200: profileSchema } } },
      async () =>
        ({ publicId: 42, country: "FR" }) as unknown as z.input<
          typeof profileSchema
        >,
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/broken",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe("internal_error");
    expect(response.body).not.toContain("publicId");
  });

  it("refuses a schema that is not a zod schema", () => {
    expect(() =>
      zodSerializerCompiler({
        schema: { type: "object" },
        method: "GET",
        url: "/v1/json-schema",
        httpStatus: "200",
      }),
    ).toThrow(/must be zod schemas/);
  });
});

describe("no response without a schema (18 TM11.4, 21 J1-J B1)", () => {
  const MARKER = "@pseudo_test";

  function server(): ApiServer {
    app = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    return app;
  }

  function call(api: ApiServer, url: string) {
    return api.inject({
      method: "GET",
      url,
      headers: { "x-influx-internal": WEB_SECRET },
    });
  }

  /** A 500 envelope, and nothing of the payload that the handler tried to send. */
  function expectBareInternalError(response: {
    statusCode: number;
    body: string;
    json: () => unknown;
  }): void {
    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: {
        code: "internal_error",
        message: "Internal error",
        requestId: expect.any(String),
      },
    });
    for (const leak of [MARKER, "publicId", "handle", "c_8f3k2"]) {
      expect(response.body).not.toContain(leak);
    }
  }

  it.each<[string, unknown, RegExp]>([
    ["an empty response schema", {}, /declares no 2xx response schema/],
    [
      "error schemas only",
      { 400: profileSchema, 500: profileSchema },
      /declares no 2xx response schema/,
    ],
    [
      "a non-2xx schema next to a 2xx one",
      { 200: profileSchema, 404: profileSchema },
      /non-2xx response schemas \(404\)/,
    ],
    [
      "a default schema of its own",
      { 200: profileSchema, default: z.unknown() },
      /non-2xx response schemas \(default\)/,
    ],
  ])("refuses to start with %s (b)", (_case, response, message) => {
    const api = server();
    expect(() =>
      api.get("/v1/profile", { schema: { response } }, async () => ({})),
    ).toThrow(message);
  });

  it("refuses to start when a route sets its own serializer compiler (b)", () => {
    const api = server();
    expect(() =>
      api.get(
        "/v1/profile",
        {
          schema: { response: { 200: profileSchema } },
          serializerCompiler: () => (data) => JSON.stringify(data),
        },
        async () => ({ publicId: "c_8f3k2", country: "FR" }),
      ),
    ).toThrow(/sets its own serializer compiler/);
  });

  it("answers an undeclared status code with a bare 500 envelope (c)", async () => {
    const api = server();
    api.get(
      "/v1/profile",
      { schema: { response: { 200: profileSchema } } },
      async (_request, reply) => {
        // Sent with 201, which the route does not declare: no schema would filter it.
        void reply.code(201 as 200);
        return {
          publicId: "c_8f3k2",
          country: "FR",
          handle: MARKER,
        } as z.input<typeof profileSchema>;
      },
    );
    expectBareInternalError(await call(api, "/v1/profile"));
  });

  it("answers a payload that breaks its schema with a bare 500 envelope (c)", async () => {
    const api = server();
    api.get(
      "/v1/profile",
      { schema: { response: { 200: profileSchema } } },
      async () =>
        ({ publicId: 42, country: "FR", handle: MARKER }) as unknown as z.input<
          typeof profileSchema
        >,
    );
    expectBareInternalError(await call(api, "/v1/profile"));
  });

  it.each<[string, () => unknown]>([
    [
      "a JSON string",
      () => JSON.stringify({ publicId: "c_8f3k2", handle: MARKER }),
    ],
    ["a buffer", () => Buffer.from(`{"handle":"${MARKER}"}`)],
  ])(
    "answers %s sent past the serializer with a bare 500 envelope (c)",
    async (_case, payload) => {
      const api = server();
      api.get(
        "/v1/raw",
        { schema: { response: { 200: profileSchema } } },
        async (_request, reply) =>
          reply.send(payload() as z.input<typeof profileSchema>),
      );
      expectBareInternalError(await call(api, "/v1/raw"));
    },
  );

  it("filters a code of a declared 2xx class, and keeps error envelopes intact", async () => {
    const api = server();
    api.get(
      "/v1/created",
      { schema: { response: { "2xx": profileSchema } } },
      async (_request, reply) => {
        void reply.code(201);
        return {
          publicId: "c_8f3k2",
          country: "FR",
          handle: MARKER,
        } as z.input<typeof profileSchema>;
      },
    );
    const created = await call(api, "/v1/created");
    expect(created.statusCode).toBe(201);
    expect(created.json()).toEqual({ publicId: "c_8f3k2", country: "FR" });
    const refused = await api.inject({ method: "GET", url: "/v1/created" });
    expect(refused.statusCode).toBe(401);
    expect(refused.json().error.code).toBe("unauthenticated");
  });
});

describe("validator compiler", () => {
  it("returns the parsed value, or the failing fields without their values", () => {
    const validate = zodValidatorCompiler({
      schema: z.object({ count: z.number().int() }),
      method: "POST",
      url: "/v1/count",
      httpPart: "body",
    });
    expect(validate({ count: 3, extra: "dropped" })).toEqual({
      value: { count: 3 },
    });
    const failure = validate({ count: "secret-value" });
    expect(failure).toMatchObject({
      error: { issues: [{ path: "count", issue: "invalid_type" }] },
    });
    expect(JSON.stringify(failure)).not.toContain("secret-value");
  });
});
