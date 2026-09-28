// The response filter cannot be bypassed (docs/mvp/21 §4, J1-J N2 and F-1; 02 §2.5 point 4): a
// body reaches the client only through the zod schema of its route. Seven vectors, one test each:
//   1. reply.serializer()          2. setReplySerializer()     3. setSerializerCompiler()
//   4. reply.hijack()              5. reply.raw               6. onSend / preSerialization hooks
//   7. a permissive response schema (any, unknown, looseObject, catchall, record…)
// Vectors 1 to 5, and the plugin-level hooks of 6, are invisible to Fastify's onRoute: ESLint
// refuses them outside src/platform/ and src/server.ts, and a counter-test shows that each one
// really leaks without the rule. Route-level hooks (6) and permissive schemas (7) stop the server
// at registration.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import { zodSerializerCompiler } from "../src/platform/schema-compilers.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "./helpers.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const MARKER = "@pseudo_leak_marker";
const idSchema = z.object({ id: z.string() });

let app: ApiServer | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

function server(): ApiServer {
  app = buildServer(testApiConfig(), {
    logDestination: captureLogs().destination,
  });
  return app;
}

// ---------------------------------------------------------------------------------------------
// Vectors 1 to 6 (plugin level): ESLint
// ---------------------------------------------------------------------------------------------

const eslint = new ESLint({ cwd: API_ROOT });
const RESTRICTION_RULES = new Set([
  "no-restricted-properties",
  "no-restricted-syntax",
]);

/** Messages of the restriction rules for `source`, linted as if it were `file` of apps/api. */
async function restrictionsOf(source: string, file: string): Promise<string[]> {
  const [result] = await eslint.lintText(source, {
    filePath: path.join(API_ROOT, file),
  });
  return (result?.messages ?? [])
    .filter((message) => RESTRICTION_RULES.has(message.ruleId ?? ""))
    .map((message) => message.message);
}

/** Loosely typed stand-ins, so that each snippet is valid TypeScript on its own. */
const PRELUDE = `
type Loose = { [key: string]: (...args: unknown[]) => unknown };
declare const app: Loose;
declare const reply: Loose & { raw: Loose };
`;

const LINTED_VECTORS: [string, string][] = [
  ["1. reply.serializer()", "reply.serializer(JSON.stringify);"],
  ["2. setReplySerializer()", "app.setReplySerializer(JSON.stringify);"],
  [
    "3. setSerializerCompiler()",
    "app.setSerializerCompiler(() => JSON.stringify);",
  ],
  ["4. reply.hijack()", "reply.hijack();"],
  ["5. reply.raw", 'reply.raw.end("{}");'],
  ["5. reply.raw, destructured", 'const { raw } = reply; raw.end("{}");'],
  ["6. a plugin-level onSend hook", 'app.addHook("onSend", async () => "{}");'],
  [
    "6. a plugin-level preSerialization hook",
    'app.addHook("preSerialization", async () => "{}");',
  ],
  ["a plugin-level not-found handler", "app.setNotFoundHandler(() => ({}));"],
];

describe("vectors 1 to 6 are refused by ESLint outside the filter's own files (21 N2)", () => {
  it.each(LINTED_VECTORS)("%s", async (_vector, snippet) => {
    const source = `${PRELUDE}\n${snippet}\nexport {};\n`;
    for (const file of [
      "src/domains/identity/routes.ts",
      "src/domains/identity/service.ts",
      "src/main.ts",
      "src/config/index.ts",
    ]) {
      const messages = await restrictionsOf(source, file);
      expect(messages.join("\n"), file).toMatch(
        /bypasses the response schemas/,
      );
    }
    // The files that build the filter may use them.
    for (const file of ["src/platform/fastify-filter.ts", "src/server.ts"]) {
      expect(await restrictionsOf(source, file), file).toEqual([]);
    }
  });

  it("does not refuse ordinary replies and hooks", async () => {
    const source = `${PRELUDE}
app.addHook("onRequest", async () => undefined);
reply.code(201);
reply.send({ id: "x" });
export {};
`;
    expect(
      await restrictionsOf(source, "src/domains/identity/routes.ts"),
    ).toEqual([]);
  });
});

describe("counter-test: each vector guarded by ESLint really leaks without the rule", () => {
  type Setup = (api: FastifyInstance) => void;
  const withSchema = { schema: { response: { 200: idSchema } } };
  const leaking = { id: "c_1", handle: MARKER } as z.input<typeof idSchema>;

  const CASES: [string, string, Setup][] = [
    [
      "1. reply.serializer()",
      "/v1/probe",
      (api) =>
        api.get("/v1/probe", withSchema, async (_request, reply) => {
          reply.serializer((payload: unknown) => JSON.stringify(payload));
          return leaking;
        }),
    ],
    [
      "2. setReplySerializer()",
      "/v1/probe",
      (api) =>
        void api.register(async (child) => {
          child.setReplySerializer((payload) => JSON.stringify(payload));
          child.get("/v1/probe", withSchema, async () => leaking);
        }),
    ],
    [
      "3. setSerializerCompiler() in a plugin",
      "/v1/probe",
      (api) =>
        void api.register(async (child) => {
          child.setSerializerCompiler(() => (data) => JSON.stringify(data));
          child.get("/v1/probe", withSchema, async () => leaking);
        }),
    ],
    [
      "4. reply.hijack()",
      "/v1/probe",
      (api) =>
        api.get("/v1/probe", withSchema, async (_request, reply) => {
          reply.hijack();
          reply.raw.writeHead(200);
          reply.raw.end(JSON.stringify(leaking));
        }),
    ],
    [
      "5. reply.raw",
      "/v1/probe",
      (api) =>
        api.get("/v1/probe", withSchema, async (_request, reply) => {
          reply.raw.writeHead(200);
          reply.raw.end(JSON.stringify(leaking));
          return reply;
        }),
    ],
    [
      "6. a plugin-level onSend hook",
      "/v1/probe",
      (api) =>
        void api.register(async (child) => {
          child.addHook("onSend", async () => JSON.stringify(leaking));
          child.get("/v1/probe", withSchema, async () => ({ id: "c_1" }));
        }),
    ],
    [
      "a plugin-level not-found handler",
      "/v1/scope/unknown",
      (api) =>
        void api.register(
          async (child) => {
            child.setNotFoundHandler(async () => leaking);
          },
          { prefix: "/v1/scope" },
        ),
    ],
  ];

  it.each(CASES)("%s", async (_vector, url, setup) => {
    const api = server();
    setup(api as unknown as FastifyInstance);
    const response = await api.inject({
      method: "GET",
      url,
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.body).toContain(MARKER);
  });
});

// ---------------------------------------------------------------------------------------------
// Vector 6 (route level): onRoute
// ---------------------------------------------------------------------------------------------

describe("vector 6: a route-level onSend or preSerialization hook stops the server", () => {
  const rewrite = async () => JSON.stringify({ handle: MARKER });

  it.each<[string, Record<string, unknown>, RegExp]>([
    ["onSend", { onSend: rewrite }, /declares its own onSend hook/],
    ["onSend as a list", { onSend: [rewrite] }, /declares its own onSend hook/],
    [
      "preSerialization",
      { preSerialization: rewrite },
      /declares its own preSerialization hook/,
    ],
  ])("refuses %s", (_case, hooks, message) => {
    const api = server();
    expect(() =>
      api.get(
        "/v1/probe",
        { schema: { response: { 200: idSchema } }, ...hooks },
        async () => ({ id: "c_1" }),
      ),
    ).toThrow(message);
  });

  it("accepts an empty list of hooks, which declares none", () => {
    const api = server();
    expect(() =>
      api.get(
        "/v1/probe",
        { schema: { response: { 200: idSchema } }, onSend: [] },
        async () => ({ id: "c_1" }),
      ),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------------------------
// Vector 7: permissive response schemas
// ---------------------------------------------------------------------------------------------

describe("vector 7: a 2xx schema that lets undeclared data through stops the server", () => {
  function register(schema: z.ZodType) {
    const api = server();
    return () =>
      api.get(
        "/v1/probe",
        { schema: { response: { 200: schema } } },
        async () => ({}),
      );
  }

  const tree: z.ZodType = z.lazy(() =>
    z.object({ name: z.string(), children: z.array(tree) }),
  );
  const looseTree: z.ZodType = z.lazy(() =>
    z.object({
      name: z.string(),
      children: z.array(looseTree),
      extra: z.unknown(),
    }),
  );

  it.each<[string, z.ZodType, string]>([
    ["any", z.any(), "200: any lets any value through"],
    ["unknown", z.unknown(), "200: unknown lets any value through"],
    [
      "looseObject",
      z.looseObject({ id: z.string() }),
      "200: an object with a catchall",
    ],
    [
      "passthrough",
      z.object({ id: z.string() }).passthrough(),
      "200: an object with a catchall",
    ],
    [
      "catchall",
      z.object({ id: z.string() }).catchall(z.string()),
      "200: an object with a catchall",
    ],
    [
      "record",
      z.record(z.string(), z.string()),
      "200: a record lets keys chosen by the data through",
    ],
    [
      "a nested unknown",
      z.object({ profile: z.object({ meta: z.unknown() }) }),
      "200.profile.meta: unknown",
    ],
    [
      "a record in an array",
      z.object({ items: z.array(z.record(z.string(), z.number())) }),
      "200.items[]: a record",
    ],
    [
      "any in an optional, nullable union",
      z.object({ value: z.union([z.string(), z.any()]).nullable().optional() }),
      "200.value: any",
    ],
    [
      "a loose object in an intersection",
      z.intersection(
        z.object({ a: z.string() }),
        z.looseObject({ b: z.string() }),
      ),
      "200: an object with a catchall",
    ],
    [
      "unknown as the rest of a tuple",
      z.tuple([z.string()]).rest(z.unknown()),
      "200[]: unknown",
    ],
    ["unknown inside a lazy schema", looseTree, "200.extra: unknown"],
    [
      "a transform",
      z.object({ id: z.string() }).transform(() => ({ handle: MARKER })),
      "200: a transform computes the output by code",
    ],
    [
      "z.custom",
      z.custom<{ id: string }>(),
      '200: the zod type "custom" is not allowed',
    ],
    [
      "z.instanceof",
      z.object({ at: z.instanceof(Date) }),
      '200.at: the zod type "custom" is not allowed',
    ],
    [
      "a map",
      z.map(z.string(), z.string()),
      '200: the zod type "map" is not allowed',
    ],
    [
      "a catch that returns the raw input (R-2)",
      z
        .strictObject({ id: z.string() })
        .catch(({ input }) => input as { id: string }),
      "200: a catch answers its own value, or the raw input",
    ],
    [
      "a catch with a fixed value (R-2)",
      z.object({ id: z.string().catch("c_0") }),
      "200.id: a catch answers its own value, or the raw input",
    ],
  ])("refuses %s", (_case, schema, message) => {
    expect(register(schema)).toThrow(
      `Route GET /v1/probe has a permissive response schema at ${message}`,
    );
  });

  it("counter-test (R-2): a catch returning its input leaks undeclared fields past the serializer", () => {
    const schema = z
      .strictObject({ id: z.string() })
      .catch(({ input }) => input as { id: string });
    const serialize = zodSerializerCompiler({
      schema,
      method: "GET",
      url: "/v1/probe",
      httpStatus: "200",
    });
    // A strict object would throw on the undeclared field: the catch answers the raw input.
    expect(serialize({ id: "c_1", handle: MARKER })).toContain(MARKER);
  });

  it("walks every 2xx status, the 2xx class included", () => {
    const api = server();
    expect(() =>
      api.get(
        "/v1/probe",
        {
          schema: {
            response: {
              200: idSchema,
              "2xx": z.looseObject({ id: z.string() }),
            },
          },
        },
        async () => ({ id: "c_1" }),
      ),
    ).toThrow("permissive response schema at 2xx: an object with a catchall");
  });

  it.each<[string, z.ZodType]>([
    ["a strict object", z.strictObject({ id: z.string() })],
    [
      "nested objects, arrays, enums and formats",
      z.object({
        id: z.uuid(),
        country: z.enum(["FR", "BE"]),
        createdAt: z.iso.datetime(),
        tags: z.array(z.string()).readonly(),
        score: z.int().nullable(),
        status: z.literal("ok").default("ok"),
      }),
    ],
    [
      "a discriminated union",
      z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("a"), a: z.string() }),
        z.object({ kind: z.literal("b"), b: z.number() }),
      ]),
    ],
    ["a recursive lazy schema", tree],
    ["a pipe between two declared shapes", z.string().pipe(z.email())],
  ])("accepts %s", (_case, schema) => {
    expect(register(schema)).not.toThrow();
  });
});
