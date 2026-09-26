// Nothing sensitive reaches the log (docs/mvp/02-architecture-3-espaces.md §20.8,
// docs/mvp/21-plan-de-developpement.md §4, J1-H): the log stream is captured and searched.
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import { ApiError } from "../src/platform/errors.ts";
import { createLogger } from "../src/platform/logger.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "./helpers.ts";

let app: ApiServer | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const COOKIE_MARKER = "cookie-value-marker";
const AUTHORIZATION_MARKER = "authorization-value-marker";
const QUERY_MARKER = "query-value-marker";

describe("api request logs", () => {
  it("contain no cookie, authorization, internal secret or raw URL", async () => {
    const logs = captureLogs();
    app = buildServer(testApiConfig(), { logDestination: logs.destination });
    for (const url of [
      "/v1/status",
      `/v1/unknown?q=${QUERY_MARKER}`,
      "/health",
    ]) {
      await app.inject({
        method: "GET",
        url,
        headers: {
          "x-influx-internal": WEB_SECRET,
          cookie: `__Host-influx-session=${COOKIE_MARKER}`,
          authorization: `Bearer ${AUTHORIZATION_MARKER}`,
        },
      });
    }
    const text = logs.text();
    expect(text).toContain("request completed");
    for (const marker of [
      COOKIE_MARKER,
      AUTHORIZATION_MARKER,
      WEB_SECRET,
      QUERY_MARKER,
    ]) {
      expect(text).not.toContain(marker);
    }
  });

  it("carry the service, environment, version, route model and request identifier", async () => {
    const logs = captureLogs();
    app = buildServer(testApiConfig(), { logDestination: logs.destination });
    const requestId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    await app.inject({
      method: "GET",
      url: "/v1/status",
      headers: { "x-influx-internal": WEB_SECRET, "x-request-id": requestId },
    });
    const line = logs
      .text()
      .split("\n")
      .filter((entry) => entry.includes("request completed"))
      .map((entry) => JSON.parse(entry) as Record<string, unknown>)[0];
    expect(line).toMatchObject({
      service: "api",
      environment: "staging",
      version: "local",
      method: "GET",
      route: "/v1/status",
      statusCode: 200,
      requestId,
    });
  });

  it("put the request identifier of an error response in the log (T13.5)", async () => {
    const logs = captureLogs();
    app = buildServer(testApiConfig(), { logDestination: logs.destination });
    const response = await app.inject({ method: "GET", url: "/v1/status" });
    const requestId: string = response.json().error.requestId;
    expect(logs.text()).toContain(requestId);
  });
});

describe("masking of personal data and secrets (02 §20.8, 18 T13.6, 21 J1-J A1)", () => {
  const EMAIL = "masking.marker@example.com";
  const CODE = "481516";
  const TOKEN = "tok_masking_marker_Zx9Qw";
  const MARKERS = [EMAIL, CODE, TOKEN];

  /** Shaped like a DrizzleQueryError: SQL parameters in the message and in `params`. */
  class FakeQueryError extends Error {
    readonly query = "select * from identity.accounts where email = $1";
    readonly params = [EMAIL, CODE, TOKEN];

    constructor() {
      super(
        `Failed query: select * from identity.accounts where email = $1\nparams: ${EMAIL},${CODE},${TOKEN}`,
        {
          cause: Object.assign(
            new Error(`duplicate key value (email)=(${EMAIL}) token ${TOKEN}`),
            { code: "23505", detail: `Key (email)=(${EMAIL})` },
          ),
        },
      );
      this.name = "DrizzleQueryError";
    }
  }

  function workerLogger() {
    const logs = captureLogs();
    const logger = createLogger(
      { service: "worker", environment: "staging", version: "local" },
      logs.destination,
    );
    return { logs, logger };
  }

  function expectNoMarker(text: string): void {
    for (const marker of MARKERS) {
      expect(text).not.toContain(marker);
    }
  }

  it("(a) keeps neither the message, the stack header, the parameters nor the cause of an error", () => {
    const { logs, logger } = workerLogger();
    logger.error({ err: new FakeQueryError() }, "query failed");
    logger.error(new FakeQueryError());
    const text = logs.text();
    expectNoMarker(text);
    const [line] = text
      .trim()
      .split("\n")
      .map((entry) => JSON.parse(entry) as { err: Record<string, unknown> });
    expect(Object.keys(line?.err ?? {}).sort()).toEqual([
      "cause",
      "stack",
      "type",
    ]);
    expect(line?.err).toMatchObject({
      type: "FakeQueryError",
      cause: { name: "Error", code: "23505" },
    });
    expect(String(line?.err.stack)).toMatch(/^at /);
    expect(text).not.toContain("select");
  });

  it("(a) does the same for an error thrown by a route, through the error handler", async () => {
    const logs = captureLogs();
    app = buildServer(testApiConfig(), { logDestination: logs.destination });
    app.get(
      "/v1/failing",
      { schema: { response: { 200: z.object({ status: z.literal("ok") }) } } },
      async () => {
        throw new FakeQueryError();
      },
    );
    const response = await app.inject({
      method: "GET",
      url: "/v1/failing",
      headers: { "x-influx-internal": WEB_SECRET },
    });
    expect(response.statusCode).toBe(500);
    expect(logs.text()).toContain("request failed");
    expectNoMarker(logs.text());
    expectNoMarker(response.body);
  });

  it("(b) censors sensitive keys three objects deep", () => {
    const { logs, logger } = workerLogger();
    logger.info(
      {
        context: {
          account: {
            contact: { email: EMAIL, otp: CODE, accessToken: TOKEN },
          },
        },
        relay: {
          request: {
            "x-influx-internal": TOKEN,
            "set-cookie": TOKEN,
            clientAddress: "203.0.113.7",
          },
        },
      },
      "nested entry",
    );
    const text = logs.text();
    expectNoMarker(text);
    expect(text).not.toContain("203.0.113.7");
    expect(text).toContain("[redacted]");
  });

  it("keeps the message of our own errors and of Fastify errors, never one that quotes a value", () => {
    const { logs, logger } = workerLogger();
    logger.error({ err: new ApiError("forbidden") }, "refused");
    logger.error(
      {
        err: Object.assign(new Error("Request body is too large"), {
          code: "FST_ERR_CTP_BODY_TOO_LARGE",
          statusCode: 413,
        }),
      },
      "fastify error",
    );
    logger.warn(
      {
        err: Object.assign(
          new Error(
            `Reply was already sent, did you forget to "return reply" in "/v1/x?email=${EMAIL}" (GET)?`,
          ),
          { code: "FST_ERR_REP_ALREADY_SENT" },
        ),
      },
      "already sent",
    );
    const text = logs.text();
    expect(text).toContain('"message":"Forbidden"');
    expect(text).toContain('"message":"Request body is too large"');
    expect(text).toContain('"code":"FST_ERR_REP_ALREADY_SENT"');
    expectNoMarker(text);
  });

  it("serializes an error under any top-level key, such as `error` or `cause` (21 N1)", () => {
    /** Shaped like a PostgresError of the `postgres` driver: values in message, detail, hint, where. */
    function postgresError(): Error {
      return Object.assign(
        new Error(`duplicate key value violates unique constraint (${EMAIL})`),
        {
          code: "23505",
          detail: `Key (email)=(${EMAIL}) already exists.`,
          hint: `Check the value ${TOKEN}.`,
          where: `SQL statement "insert into identity.accounts values ('${CODE}')"`,
          schema: "identity",
          table: "accounts",
          constraint: "accounts_email_key",
        },
      );
    }
    const { logs, logger } = workerLogger();
    logger.error({ error: postgresError() }, "under error");
    logger.error({ cause: postgresError() }, "under cause");
    const wrapper = () =>
      new Error(`insert failed for ${EMAIL}`, { cause: postgresError() });
    logger.error({ error: wrapper() }, "wrapper under error");
    logger.error({ err: wrapper() }, "wrapper under err");
    logger.error(wrapper());
    // Deeper than the first level, the error is not serialized: redaction still censors its
    // `detail`, `hint` and `where`, and its message is not enumerable.
    logger.error({ context: { error: postgresError() } }, "nested");

    const text = logs.text();
    expectNoMarker(text);
    const lines = text
      .trim()
      .split("\n")
      .map((entry) => JSON.parse(entry) as Record<string, unknown>);
    expect(lines).toHaveLength(6);
    expect(lines[0]?.error).toMatchObject({ type: "Error", code: "23505" });
    expect(lines[1]?.cause).toMatchObject({ type: "Error", code: "23505" });
    expect(lines[2]?.error).toMatchObject({
      type: "Error",
      cause: { name: "Error", code: "23505" },
    });
    expect(lines[3]?.err).toMatchObject({
      cause: { name: "Error", code: "23505" },
    });
    expect(lines[4]?.err).toMatchObject({
      cause: { name: "Error", code: "23505" },
    });
    expect(lines[5]?.context).toMatchObject({
      error: { code: "23505", detail: "[redacted]" },
    });
  });

  it("does not modify the object that is logged", () => {
    const { logger } = workerLogger();
    const error = new Error("kept by the caller");
    const entry = { error, attempt: 1 };
    logger.error(entry, "not modified");
    expect(entry.error).toBe(error);
  });

  it("logs only the type of a thrown value that is not an error", () => {
    const { logs, logger } = workerLogger();
    logger.error({ err: `thrown string ${EMAIL}` }, "odd throw");
    logger.error({ err: { email: EMAIL, detail: CODE } }, "odd throw");
    const text = logs.text();
    expectNoMarker(text);
    expect(text).toContain('"err":{"type":"string"}');
    expect(text).toContain('"err":{"type":"object"}');
  });
});

describe("logger redaction", () => {
  it("censors sensitive keys logged by hand", () => {
    const logs = captureLogs();
    const logger = createLogger(
      { service: "worker", environment: "staging", version: "local" },
      logs.destination,
    );
    logger.info(
      {
        headers: { cookie: COOKIE_MARKER },
        contact: { email: "someone@example.com", loginCode: "123456" },
        token: AUTHORIZATION_MARKER,
      },
      "manual entry",
    );
    const text = logs.text();
    for (const marker of [
      COOKIE_MARKER,
      "someone@example.com",
      "123456",
      AUTHORIZATION_MARKER,
    ]) {
      expect(text).not.toContain(marker);
    }
    expect(text).toContain("[redacted]");
  });
});
