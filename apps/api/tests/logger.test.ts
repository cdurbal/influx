// Nothing sensitive reaches the log (docs/mvp/02-architecture-3-espaces.md §20.8,
// docs/mvp/21-plan-de-developpement.md §4, J1-H): the log stream is captured and searched.
import { valuesFoundIn } from "@influx/test-kit/logs";
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
      environment: "development",
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
      cause: { name: "Error", errorCode: "23505" },
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

  it("keeps the message of our own errors only, never the message of an FST_* error (21 EC-26)", () => {
    const { logs, logger } = workerLogger();
    logger.error({ err: new ApiError("forbidden") }, "refused");
    logger.error(
      {
        err: Object.assign(new Error(`Request body is too large (${TOKEN})`), {
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
    logger.info(
      {
        err: Object.assign(
          new Error(`'/v1/%zz?code=${CODE}' is not a valid url component`),
          { code: "FST_ERR_BAD_URL", statusCode: 400 },
        ),
      },
      "bad url",
    );
    const text = logs.text();
    expect(text).toContain('"message":"Forbidden"');
    expect(text).toContain('"errorCode":"FST_ERR_CTP_BODY_TOO_LARGE"');
    expect(text).toContain('"statusCode":413');
    expect(text).toContain('"errorCode":"FST_ERR_REP_ALREADY_SENT"');
    expect(text).toContain('"errorCode":"FST_ERR_BAD_URL"');
    expect(text).not.toContain("Request body is too large");
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
    // Deeper than the first level, the error is serialized too (J2 security review M3).
    logger.error({ context: { error: postgresError() } }, "nested");

    const text = logs.text();
    expectNoMarker(text);
    const lines = text
      .trim()
      .split("\n")
      .map((entry) => JSON.parse(entry) as Record<string, unknown>);
    expect(lines).toHaveLength(6);
    expect(lines[0]?.error).toMatchObject({
      type: "Error",
      errorCode: "23505",
    });
    expect(lines[1]?.cause).toMatchObject({
      type: "Error",
      errorCode: "23505",
    });
    expect(lines[2]?.error).toMatchObject({
      type: "Error",
      cause: { name: "Error", errorCode: "23505" },
    });
    expect(lines[3]?.err).toMatchObject({
      cause: { name: "Error", errorCode: "23505" },
    });
    expect(lines[4]?.err).toMatchObject({
      cause: { name: "Error", errorCode: "23505" },
    });
    expect(lines[5]?.context).toEqual({
      error: expect.objectContaining({
        type: "Error",
        errorCode: "23505",
      }) as unknown,
    });
  });

  it("serializes a postgres driver error at any depth, keeping its SQLSTATE (J2 review M3)", () => {
    /** Shaped like a PostgresError of `postgres` 3.4: `query`, `parameters` and `args` quote values. */
    class PostgresError extends Error {
      readonly severity = "ERROR";
      readonly code = "23505";
      readonly detail = `Key (email)=(${EMAIL}) already exists.`;
      readonly query = `insert into identity.accounts (email) values ('${EMAIL}')`;
      readonly parameters = [EMAIL, CODE, TOKEN];
      readonly args = [EMAIL, TOKEN];
      readonly types = [25, 25];

      constructor() {
        super(`duplicate key value violates unique constraint (${EMAIL})`);
        this.name = "PostgresError";
      }
    }
    const { logs, logger } = workerLogger();
    logger.error(
      { context: { attempt: { failure: new PostgresError() } } },
      "deep",
    );
    logger.error({ failures: [new PostgresError()] }, "in an array");
    logger.error({ err: new PostgresError() }, "as err");
    // Logged by hand, not as an error: the keys themselves are censored.
    logger.error(
      {
        outcome: {
          query: `select '${EMAIL}'`,
          parameters: [CODE],
          args: [TOKEN],
        },
      },
      "by hand",
    );

    const text = logs.text();
    expectNoMarker(text);
    const lines = text
      .trim()
      .split("\n")
      .map((entry) => JSON.parse(entry) as Record<string, unknown>);
    expect(lines).toHaveLength(4);
    expect(lines[0]?.context).toEqual({
      attempt: {
        failure: expect.objectContaining({
          type: "PostgresError",
          errorCode: "23505",
        }) as unknown,
      },
    });
    expect(lines[1]?.failures).toEqual([
      expect.objectContaining({ type: "PostgresError", errorCode: "23505" }),
    ]);
    expect(lines[2]?.err).toMatchObject({
      type: "PostgresError",
      errorCode: "23505",
    });
    expect(lines[3]?.outcome).toEqual({
      query: "[redacted]",
      parameters: "[redacted]",
      args: "[redacted]",
    });
  });

  it("survives a cycle in a logged object that holds an error", () => {
    const { logs, logger } = workerLogger();
    const context: Record<string, unknown> = { error: new Error(EMAIL) };
    context.self = context;
    logger.error({ context }, "cycle");
    expectNoMarker(logs.text());
    expect(logs.text()).toContain('"self":"[truncated]"');
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

describe("authentication values, searched by value (21 J3-C rule 7, C-1)", () => {
  function workerLogger() {
    const logs = captureLogs();
    const logger = createLogger(
      { service: "worker", environment: "staging", version: "local" },
      logs.destination,
    );
    return { logs, logger };
  }

  // J3-C rule 7, the additions of expert-cybersecurite for commit 3, and the keys of A1 they
  // repeat (password, otp, token, secret, authorization, cookie, set-cookie).
  const AUTH_KEYS = [
    "password",
    "code",
    "otp",
    "token",
    "email_otp",
    "hashed_token",
    "action_link",
    "secret",
    "qr_code",
    "uri",
    "totp",
    "recoveryCodes",
    "recoveryCode",
    "enrollmentToken",
    "matchingPhrase",
    "reauthToken",
    "apikey",
    "authorization",
    "cookie",
    "set-cookie",
    "sb-forwarded-for",
  ];

  it.each(AUTH_KEYS)(
    "censors %s from the first to the fourth level, and in an array",
    (key) => {
      const { logs, logger } = workerLogger();
      const value = `value-of-${key}-Zq81x`;
      logger.info({ [key]: value }, "level 1");
      logger.info({ a: { [key]: value } }, "level 2");
      logger.info({ a: { b: { [key]: value } } }, "level 3");
      logger.info({ a: { b: { c: { [key]: value } } } }, "level 4");
      logger.info({ list: [{ [key]: value }] }, "in an array");
      expect(valuesFoundIn(logs.text(), [value])).toEqual([]);
      expect(logs.lines()).toHaveLength(5);
      for (const line of logs.lines()) {
        expect(line).toContain("[redacted]");
      }
    },
  );

  it("logs the code of an error as errorCode, and censors any code key (21 §3 EC-49)", () => {
    const { logs, logger } = workerLogger();
    const loginCode = "734219";
    logger.warn(
      {
        code: loginCode,
        attempt: { code: loginCode },
        err: Object.assign(new Error(`code ${loginCode} refused`), {
          code: "otp_expired",
          cause: Object.assign(new Error("inner"), { code: "23505" }),
        }),
      },
      "verification refused",
    );
    const text = logs.text();
    expect(valuesFoundIn(text, [loginCode])).toEqual([]);
    const [line] = logs
      .lines()
      .map((entry) => JSON.parse(entry) as Record<string, unknown>);
    expect(line).toMatchObject({
      code: "[redacted]",
      attempt: { code: "[redacted]" },
      err: {
        type: "Error",
        errorCode: "otp_expired",
        cause: { name: "Error", errorCode: "23505" },
      },
    });
  });
});

describe("errorCode holds a diagnostic code only (21 §3 EC-49, J3 security review R-1)", () => {
  function workerLogger() {
    const logs = captureLogs();
    const logger = createLogger(
      { service: "worker", environment: "staging", version: "local" },
      logs.destination,
    );
    return { logs, logger };
  }

  function errorWithCode(code: string, causeCode: string): Error {
    return Object.assign(new Error("refused"), {
      code,
      cause: Object.assign(new Error("inner"), { code: causeCode }),
    });
  }

  it.each([
    ["six digits (a login code)", "123456"],
    ["eight digits", "12345678"],
    ["a value with a space", "code 482913"],
    ["a value with a hyphen", "tok-948213"],
  ])("writes [unrecognized] for %s, found nowhere by value", (_case, value) => {
    const { logs, logger } = workerLogger();
    logger.error({ err: errorWithCode(value, value) }, "call failed");
    logger.warn({ nested: { failure: errorWithCode(value, value) } }, "nested");
    const text = logs.text();
    expect(valuesFoundIn(text, [value])).toEqual([]);
    const [first, second] = logs
      .lines()
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const expected = {
      errorCode: "[unrecognized]",
      cause: { name: "Error", errorCode: "[unrecognized]" },
    };
    expect(first).toMatchObject({ err: expected });
    expect(second).toMatchObject({ nested: { failure: expected } });
  });

  it.each([
    ["a Fastify code", "FST_ERR_CTP_INVALID_MEDIA_TYPE"],
    ["a SQLSTATE", "23505"],
    ["a PL/pgSQL SQLSTATE", "P0001"],
    ["a GoTrue code", "otp_expired"],
    ["a Node code", "ECONNRESET"],
  ])("keeps %s", (_case, code) => {
    const { logs, logger } = workerLogger();
    logger.error({ err: errorWithCode(code, code) }, "call failed");
    const [line] = logs
      .lines()
      .map((entry) => JSON.parse(entry) as Record<string, unknown>);
    expect(line).toMatchObject({
      err: { errorCode: code, cause: { name: "Error", errorCode: code } },
    });
  });

  it("writes no errorCode when the code is not a string", () => {
    const { logs, logger } = workerLogger();
    logger.error(
      { err: Object.assign(new Error("refused"), { code: 123456 }) },
      "call failed",
    );
    const [line] = logs
      .lines()
      .map((entry) => JSON.parse(entry) as { err: Record<string, unknown> });
    expect(line?.err).not.toHaveProperty("errorCode");
    expect(valuesFoundIn(logs.text(), ["123456"])).toEqual([]);
  });
});

describe("forced truncation of every logged object (end-of-J2 review, point (b))", () => {
  const MARKER = "deep-marker-Kp27w";

  function workerLogger() {
    const logs = captureLogs();
    const logger = createLogger(
      { service: "worker", environment: "staging", version: "local" },
      logs.destination,
    );
    return { logs, logger };
  }

  it("truncates a container deeper than the redaction paths reach, without any error in it", () => {
    const { logs, logger } = workerLogger();
    logger.info({ a: { b: { c: { d: { note: MARKER } } } } }, "five levels");
    logger.info({ a: [[[[MARKER]]]] }, "nested arrays");
    logger.info(
      { a: { b: { c: { d: { e: { f: { g: new Error(MARKER) } } } } } } },
      "deep error",
    );
    expect(valuesFoundIn(logs.text(), [MARKER])).toEqual([]);
    const lines = logs
      .lines()
      .map((entry) => JSON.parse(entry) as Record<string, unknown>);
    expect(lines[0]?.a).toEqual({ b: { c: { d: "[truncated]" } } });
    expect(lines[1]?.a).toEqual([[["[truncated]"]]]);
  });

  it("never writes the content of a Map, a Set, a buffer or a class instance", () => {
    class Holder {
      readonly note = MARKER;
      readonly email = "holder.marker@example.test";
    }
    const { logs, logger } = workerLogger();
    const at = new Date("2026-09-27T10:00:00.000Z");
    logger.info(
      {
        map: new Map([["email", MARKER]]),
        set: new Set([MARKER]),
        buffer: Buffer.from(MARKER),
        holder: new Holder(),
        nested: { holder: new Holder() },
        at,
      },
      "instances",
    );
    const text = logs.text();
    expect(valuesFoundIn(text, [MARKER, "holder.marker@example.test"])).toEqual(
      [],
    );
    const [line] = logs
      .lines()
      .map((entry) => JSON.parse(entry) as Record<string, unknown>);
    expect(line).toMatchObject({
      map: "[Map]",
      set: "[Set]",
      buffer: "[Buffer]",
      holder: "[Holder]",
      nested: { holder: "[Holder]" },
      at: "2026-09-27T10:00:00.000Z",
    });
  });

  it("leaves err, req and res to their serializers, and copies everything else", () => {
    const { logs, logger } = workerLogger();
    const entry = { attempt: { count: 1 }, err: new Error(MARKER) };
    logger.error(entry, "copied");
    expect(entry.attempt).toEqual({ count: 1 });
    expect(valuesFoundIn(logs.text(), [MARKER])).toEqual([]);
    expect(logs.text()).toContain('"err":{"type":"Error"');
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
