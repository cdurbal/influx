// T13.1 to T13.5 on apps/api (docs/mvp/18 T13; 21 §J9 commit 7): no 4xx or 5xx answer carries a
// detail, whatever was thrown. server.test.ts checks the envelope of a 404 and of a plain error;
// this file sweeps what really fails in production: a Postgres error with its table, constraint,
// detail and query, a chain of causes, a failed call to a provider, a Fastify parser error, a
// thrown value that is not an Error. Each answer is EXACTLY the envelope (code, message,
// requestId; the details of a validation only), its message is the fixed one of its code, no
// header names a component or a version, and its requestId is in the log lines (T13.5).
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import { buildServer, type ApiServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "./helpers.ts";

const okSchema = z.object({ status: z.literal("ok") });

/** Fixed messages of the codes met below (src/platform/errors.ts). */
const MESSAGES: Readonly<Record<string, string>> = {
  internal_error: "Internal error",
  validation_failed: "Validation failed",
  not_found: "Not found",
  payload_too_large: "Payload too large",
};

/** Fragments that would betray the code, the base, the network or a version (T13.1 to T13.3). */
const LEAKS = [
  "select ",
  "insert ",
  "identity.",
  "accounts_email_key",
  "constraint",
  "relation",
  "Key (",
  "secret@example.com",
  "at ",
  ".ts:",
  "node_modules",
  "postgres",
  "54322",
  "127.0.0.1",
  "db.internal",
  "api.railway.internal",
  "ECONNREFUSED",
  "fastify",
  "Fastify",
  "FST_",
  "Unexpected token",
  "JSON",
  "v24.",
  "Node.js",
];

/** A Postgres error as postgres.js raises it: every field a database error may carry. */
function postgresError(): Error {
  return Object.assign(
    new Error(
      'duplicate key value violates unique constraint "accounts_email_key"',
    ),
    {
      name: "PostgresError",
      severity: "ERROR",
      code: "23505",
      detail: "Key (email)=(secret@example.com) already exists.",
      hint: "select * from identity.accounts",
      schema_name: "identity",
      table_name: "accounts",
      constraint_name: "accounts_email_key",
      where: "SQL statement insert into identity.accounts",
      routine: "_bt_check_unique",
      query: "insert into identity.accounts (email) values ($1)",
      parameters: ["secret@example.com"],
    },
  );
}

const THROWN: [string, () => unknown][] = [
  ["a Postgres error with its table, constraint and query", postgresError],
  [
    "an error whose cause holds the query",
    () => new Error("write failed", { cause: postgresError() }),
  ],
  [
    "a failed call to a provider (fetch, refused connection)",
    () =>
      new TypeError("fetch failed", {
        cause: Object.assign(
          new Error("connect ECONNREFUSED 127.0.0.1:54322"),
          { code: "ECONNREFUSED", address: "api.railway.internal" },
        ),
      }),
  ],
  [
    "an engine error naming the code",
    () => new TypeError("Cannot read properties of undefined (reading 'at ')"),
  ],
  [
    "an error with a 4xx status and a revealing message",
    () =>
      Object.assign(new Error("relation identity.accounts at db.internal"), {
        statusCode: 409,
      }),
  ],
  [
    "an error with a 5xx status",
    () =>
      Object.assign(new Error("upstream db.internal:5432 v24.12.0"), {
        statusCode: 503,
      }),
  ],
  ["a thrown string", () => "select * from identity.accounts"],
  ["a thrown object", () => ({ query: "select 1", host: "db.internal" })],
];

let app: ApiServer | undefined;

function server() {
  const logs = captureLogs();
  app = buildServer(testApiConfig(), { logDestination: logs.destination });
  return { api: app, logs };
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

type Answer = Awaited<ReturnType<ApiServer["inject"]>>;

/** T13.1 to T13.4 on one answer; returns its requestId. */
function expectNoDetail(response: Answer, code: string): string {
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  const body = response.json();
  expect(Object.keys(body)).toEqual(["error"]);
  const keys = Object.keys(body.error).sort();
  expect(keys).toEqual(
    code === "validation_failed" && "details" in body.error
      ? ["code", "details", "message", "requestId"]
      : ["code", "message", "requestId"],
  );
  expect(body.error.code).toBe(code);
  expect(body.error.message).toBe(MESSAGES[code]);
  expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  const lowered = response.body.toLowerCase();
  for (const leak of LEAKS) {
    expect(lowered, leak).not.toContain(leak.toLowerCase());
  }
  // T13.3: no header names the server, the framework or a version.
  for (const name of ["server", "x-powered-by", "x-runtime", "via"]) {
    expect(response.headers[name], name).toBeUndefined();
  }
  for (const value of Object.values(response.headers)) {
    expect(String(value)).not.toMatch(
      /fastify|node|postgres|\bv?\d+\.\d+\.\d+/i,
    );
  }
  return body.error.requestId as string;
}

describe("T13: whatever a handler throws, the answer has no detail", () => {
  it.each(THROWN)("%s", async (_label, make) => {
    const { api, logs } = server();
    api.get(
      "/v1/failing",
      { schema: { response: { 200: okSchema } } },
      async () => {
        throw make();
      },
    );
    const response = await api.inject({
      method: "GET",
      url: "/v1/failing",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    const code =
      response.statusCode === 400 ? "validation_failed" : "internal_error";
    expect([400, 500]).toContain(response.statusCode);
    const requestId = expectNoDetail(response, code);
    // T13.5: the identifier given to the client is the one of the server's lines.
    expect(logs.text()).toContain(`"requestId":"${requestId}"`);
  });
});

describe("T13: errors of the parsers and of the router, before any handler", () => {
  function echoServer() {
    const built = server();
    built.api.post(
      "/v1/echo",
      {
        schema: {
          body: z.strictObject({ email: z.email() }),
          response: { 200: okSchema },
        },
      },
      async () => ({ status: "ok" as const }),
    );
    return built;
  }

  const CASES: [string, Record<string, string>, string, number, string][] = [
    [
      "malformed JSON",
      { "content-type": "application/json" },
      '{"email": select * from identity.accounts',
      400,
      "validation_failed",
    ],
    [
      "an unsupported media type",
      { "content-type": "text/plain" },
      "select * from identity.accounts",
      400,
      "validation_failed",
    ],
    [
      "a form body (never parsed, 03 A4)",
      { "content-type": "application/x-www-form-urlencoded" },
      "email=secret%40example.com",
      400,
      "validation_failed",
    ],
    [
      "an empty JSON body",
      { "content-type": "application/json" },
      "",
      400,
      "validation_failed",
    ],
    [
      "a JSON body with an undeclared key",
      { "content-type": "application/json" },
      '{"email":"secret@example.com","select * from identity.accounts":1}',
      400,
      "validation_failed",
    ],
    [
      "a body over 1 MB",
      { "content-type": "application/json" },
      `{"email":"${"a".repeat(1_100_000)}"}`,
      413,
      "payload_too_large",
    ],
  ];

  it.each(CASES)("%s", async (_label, headers, payload, status, code) => {
    const { api, logs } = echoServer();
    const response = await api.inject({
      method: "POST",
      url: "/v1/echo",
      headers: {
        "x-influx-internal": WEB_SECRET,
        "sec-fetch-site": "same-origin",
        ...headers,
      },
      payload,
    });
    expect(response.statusCode).toBe(status);
    const requestId = expectNoDetail(response, code);
    expect(logs.text()).toContain(`"requestId":"${requestId}"`);
  });

  it("answers an unknown route, and an unknown method, without detail", async () => {
    const { api } = server();
    for (const method of ["GET", "PATCH"] as const) {
      const response = await api.inject({
        method,
        url: "/v1/identity.accounts/select",
        headers: {
          "x-influx-internal": WEB_SECRET,
          "sec-fetch-site": "same-origin",
        },
      });
      expect(response.statusCode).toBe(404);
      expectNoDetail(response, "not_found");
    }
  });
});
