// POST /v1/webhooks/brevo/:pathToken without a database (J7 commit 3; 16 RG146, RG147, RG148
// scenario 9; 03 A4, A5; decision 1 of the J7 start; D60). Everything that is decided BEFORE the
// write: the closed A4 exception, the four refusals in 404 (address absent or invalid, address
// outside Brevo's ranges, either token), the address drift, and the authenticated calls answered
// 200 without writing (invalid, outside the window). The database URLs point to a closed port:
// a call that reached the database would answer 503, never 200. The write itself, the idempotence
// (scenario 8) and the audit line are in db-tests/tm1-brevo-webhook-route.test.ts.
// No test reaches Brevo (RG148).
import { valuesFoundIn } from "@influx/test-kit/logs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApiConfig } from "../src/config/schema.ts";
import {
  BREVO_WEBHOOK_ADDRESS_RANGES,
  BREVO_WEBHOOK_ROUTE,
  BrevoWebhookAddressDriftError,
  createBrevoWebhookAuthenticator,
} from "../src/domains/leads/brevo-webhook.ts";
import { OpsRecorder } from "../src/domains/ops/recorder.ts";
import { checkAddressInRanges } from "../src/platform/client-address.ts";
import {
  isWriteOriginException,
  WRITE_ORIGIN_EXCEPTIONS,
} from "../src/platform/write-origin.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_SECRET,
} from "./helpers.ts";

// Shapes of the variables (43 base64url characters for the path, 43 to 128 for the header).
const PATH_TOKEN = "Ab3-_x9QzR7kLmN2pV8wYt4uHc6eJf1oGs5iDn0aB_c";
const PATH_PREVIOUS = "Zy8_-w1PxQ6jKlM3oN9vUs5tGb7dIe2fHr4hCm0nA-d";
const HEADER_TOKEN = "hT5-header-token-current-0123456789abcdefgh";
const HEADER_PREVIOUS = "hP7_header-token-previous-0123456789abcdefg";
const BREVO_ADDRESS = "1.179.112.10";
const FOREIGN_ADDRESS = "203.0.113.77";
const NOW = new Date("2026-10-13T12:00:00.000Z");
const NOW_SECONDS = NOW.getTime() / 1000;

// Values of the event that must never reach a log line (D60).
const EMAIL = "webhook-marker-7c1e@example.test";
const MESSAGE_ID = "<202610131200.marker-message-id@smtp-relay.mailin.fr>";
const REASON = "marker-reason: mailbox unavailable";
const SUBJECT = "marker-subject of the e-mail";
const LINK = "https://marker-link.example/unsubscribe";

function event(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    event: "unsubscribed",
    email: EMAIL,
    id: 123456,
    date: "2026-10-13 14:00:00",
    ts: NOW_SECONDS,
    ts_event: NOW_SECONDS,
    ts_epoch: NOW_SECONDS * 1000,
    "message-id": MESSAGE_ID,
    subject: SUBJECT,
    link: LINK,
    sending_ip: "185.41.28.109",
    template_id: 12,
    reason: REASON,
    ...overrides,
  };
}

/** The test configuration, the webhook open (or closed), the database out of reach. */
function webhookConfig(open = true): ApiConfig {
  const base = testApiConfig();
  const unreachable = (connection: ApiConfig["database"]["app"]) => ({
    ...connection,
    url: connection.url.replace(":54322/", ":1/"),
  });
  return {
    ...base,
    database: {
      app: unreachable(base.database.app),
      auth: unreachable(base.database.auth),
      ops: unreachable(base.database.ops),
    },
    brevoWebhook: open
      ? {
          pathTokens: [PATH_TOKEN, PATH_PREVIOUS],
          headerTokens: [HEADER_TOKEN, HEADER_PREVIOUS],
        }
      : { pathTokens: [], headerTokens: [] },
  };
}

let app: ApiServer | undefined;
let logs = captureLogs();
let recorder: OpsRecorder;

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
});

function server(open = true): ApiServer {
  logs = captureLogs();
  recorder = new OpsRecorder({ version: "test", instance: "test" });
  app = buildServer(webhookConfig(open), {
    logDestination: logs.destination,
    ops: recorder,
    identity: { now: () => NOW },
  });
  return app;
}

type Call = {
  path?: string;
  headers?: Record<string, string | undefined>;
  payload?: string;
  secret?: string;
};

function post(api: ApiServer, call: Call = {}) {
  const headers: Record<string, string> = {};
  const merged = {
    "x-influx-internal": call.secret ?? WEB_SECRET,
    "content-type": "application/json",
    "x-real-ip": BREVO_ADDRESS,
    "brevo-webhook-token": HEADER_TOKEN,
    ...call.headers,
  };
  for (const [name, value] of Object.entries(merged)) {
    if (value !== undefined) {
      headers[name] = value;
    }
  }
  return api.inject({
    method: "POST",
    url: call.path ?? `/v1/webhooks/brevo/${PATH_TOKEN}`,
    headers,
    payload: call.payload ?? JSON.stringify(event()),
  });
}

type LogLine = { level: string; msg: string; reason?: string };

function logLines(): LogLine[] {
  return logs.lines().map((line) => JSON.parse(line) as LogLine);
}

function linesNamed(message: string): LogLine[] {
  return logLines().filter((line) => line.msg === message);
}

/** Every value of a call that must never be logged: tokens, address, path, event content. */
const SECRET_VALUES = [
  PATH_TOKEN,
  PATH_PREVIOUS,
  HEADER_TOKEN,
  HEADER_PREVIOUS,
  BREVO_ADDRESS,
  FOREIGN_ADDRESS,
  EMAIL,
  MESSAGE_ID,
  "marker-reason",
  "marker-subject",
  "marker-link",
];

// ---------------------------------------------------------------------------------------------
// A4: the closed exception
// ---------------------------------------------------------------------------------------------

describe("A4 exception: one entry, this route, POST, from web (decision 1)", () => {
  it("holds exactly one entry, the webhook route", () => {
    expect(WRITE_ORIGIN_EXCEPTIONS).toEqual([
      { method: "POST", route: BREVO_WEBHOOK_ROUTE, surface: "web" },
    ]);
  });

  it.each<[string, string, string | undefined, "web" | "backoffice"]>([
    ["another method", "PUT", BREVO_WEBHOOK_ROUTE, "web"],
    ["the backoffice surface", "POST", BREVO_WEBHOOK_ROUTE, "backoffice"],
    ["another route", "POST", "/v1/signup", "web"],
    ["an unknown route", "POST", undefined, "web"],
    ["the route prefix", "POST", "/v1/webhooks/brevo", "web"],
  ])("does not cover %s", (_case, method, route, surface) => {
    expect(isWriteOriginException(method, route, surface)).toBe(false);
  });

  it("covers the route itself", () => {
    expect(isWriteOriginException("POST", BREVO_WEBHOOK_ROUTE, "web")).toBe(
      true,
    );
  });

  it("still refuses a write without origin from the backoffice, on this very path", async () => {
    const response = await post(server(), { secret: BACKOFFICE_SECRET });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("forbidden");
  });

  it("still refuses a write without origin on any other web route", async () => {
    const response = await post(server(), {
      path: `/v1/webhooks/brevx/${PATH_TOKEN}`,
    });
    expect(response.statusCode).toBe(403);
  });

  it("refuses the webhook path without the internal secret (PP-8), before anything else", async () => {
    const response = await post(server(), { secret: "not-the-secret" });
    expect(response.statusCode).toBe(401);
  });
});

// ---------------------------------------------------------------------------------------------
// Authentication: refusals in 404, identical to an unknown route
// ---------------------------------------------------------------------------------------------

describe("authentication: refused in 404, the answer of an unknown route (RG146-1 to RG146-3)", () => {
  /** The 404 of a route that does not exist, for the same call (A4 passed by same-origin). */
  async function unknownRouteAnswer() {
    const response = await post(server(), {
      path: `/v1/webhooks/brevx/${PATH_TOKEN}`,
      headers: { "sec-fetch-site": "same-origin" },
    });
    expect(response.statusCode).toBe(404);
    return response;
  }

  it.each<[string, Call, string]>([
    ["no x-real-ip", { headers: { "x-real-ip": undefined } }, "address_absent"],
    [
      "an x-real-ip that is no address",
      { headers: { "x-real-ip": "brevo.com" } },
      "address_invalid",
    ],
    [
      // With valid tokens, the same address is a drift (below).
      "an address outside Brevo's ranges, without valid tokens",
      {
        headers: {
          "x-real-ip": FOREIGN_ADDRESS,
          "brevo-webhook-token": "y".repeat(43),
        },
      },
      "address_outside_ranges",
    ],
    [
      "a wrong path token",
      { path: `/v1/webhooks/brevo/${"x".repeat(43)}` },
      "token_invalid",
    ],
    [
      "a wrong header token",
      { headers: { "brevo-webhook-token": "y".repeat(43) } },
      "token_invalid",
    ],
    [
      "no header token",
      { headers: { "brevo-webhook-token": undefined } },
      "token_invalid",
    ],
    [
      "the two tokens swapped",
      {
        path: `/v1/webhooks/brevo/${HEADER_TOKEN}`,
        headers: { "brevo-webhook-token": PATH_TOKEN },
      },
      "token_invalid",
    ],
    [
      "the path token alone, too short",
      { path: "/v1/webhooks/brevo/Ab3" },
      "token_invalid",
    ],
  ])("refuses %s", async (_case, call, reason) => {
    const reference = await unknownRouteAnswer();
    const response = await post(server(), {
      ...call,
      // An unreadable body: answered 404 all the same, so nothing was parsed before.
      payload: "{not json",
    });
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe(
      reference.headers["content-type"],
    );
    const refused = response.json().error;
    const unknown = reference.json().error;
    expect(Object.keys(refused).sort()).toEqual(Object.keys(unknown).sort());
    expect({ code: refused.code, message: refused.message }).toEqual({
      code: unknown.code,
      message: unknown.message,
    });
    expect(linesNamed("webhook.brevo.rejected")).toEqual([
      expect.objectContaining({ level: "warn", reason }),
    ]);
    expect(valuesFoundIn(logs.text(), SECRET_VALUES)).toEqual([]);
  });

  it("refuses every call while the webhook is closed (no secret configured)", async () => {
    const response = await post(server(false));
    expect(response.statusCode).toBe(404);
    expect(linesNamed("webhook.brevo.rejected")).toEqual([
      expect.objectContaining({ reason: "token_invalid" }),
    ]);
  });

  it("logs and counts a valid token from outside the ranges as a drift, answered 404", async () => {
    const api = server();
    const recorded = vi.spyOn(recorder, "recordServerError");
    const response = await post(api, {
      headers: { "x-real-ip": FOREIGN_ADDRESS },
    });
    expect(response.statusCode).toBe(404);
    expect(linesNamed("webhook.brevo.ip_drift")).toEqual([
      expect.objectContaining({ level: "error" }),
    ]);
    expect(linesNamed("webhook.brevo.rejected")).toEqual([]);
    expect(recorded).toHaveBeenCalledTimes(1);
    expect(recorded.mock.calls[0]?.[0]).toBeInstanceOf(
      BrevoWebhookAddressDriftError,
    );
    expect(recorded.mock.calls[0]?.[1]).toMatchObject({
      route: BREVO_WEBHOOK_ROUTE,
    });
    expect(valuesFoundIn(logs.text(), SECRET_VALUES)).toEqual([]);
  });

  it.each<[string, string, string]>([
    ["current, current", PATH_TOKEN, HEADER_TOKEN],
    ["previous, current", PATH_PREVIOUS, HEADER_TOKEN],
    ["current, previous", PATH_TOKEN, HEADER_PREVIOUS],
    ["previous, previous", PATH_PREVIOUS, HEADER_PREVIOUS],
  ])(
    "accepts the two values of each secret during a rotation (%s)",
    async (_case, path, header) => {
      const response = await post(server(), {
        path: `/v1/webhooks/brevo/${path}`,
        headers: { "brevo-webhook-token": header },
        payload: "[]",
      });
      expect(response.statusCode).toBe(200);
      expect(linesNamed("webhook.brevo.rejected")).toEqual([]);
    },
  );
});

describe("the authenticator and the ranges", () => {
  it("compares the four values in constant time on digests, whatever the lengths", () => {
    const authenticate = createBrevoWebhookAuthenticator({
      pathTokens: [PATH_TOKEN],
      headerTokens: [HEADER_TOKEN],
    });
    expect(authenticate(PATH_TOKEN, HEADER_TOKEN)).toBe(true);
    expect(authenticate(PATH_TOKEN, `${HEADER_TOKEN}x`)).toBe(false);
    expect(authenticate(PATH_TOKEN, [HEADER_TOKEN, HEADER_TOKEN])).toBe(false);
    expect(authenticate(undefined, HEADER_TOKEN)).toBe(false);
    expect(authenticate("", "")).toBe(false);
    // No previous value configured: nothing matches in its place, not even an empty string.
    expect(authenticate(PATH_PREVIOUS, HEADER_TOKEN)).toBe(false);
  });

  it("matches nothing when closed", () => {
    const authenticate = createBrevoWebhookAuthenticator({
      pathTokens: [],
      headerTokens: [],
    });
    expect(authenticate("", "")).toBe(false);
    expect(authenticate(PATH_TOKEN, HEADER_TOKEN)).toBe(false);
  });

  it.each<[string, string]>([
    ["1.179.112.0", "within"],
    ["1.179.127.255", "within"],
    ["172.246.240.0", "within"],
    ["172.246.255.255", "within"],
    ["::ffff:1.179.112.5", "within"],
    ["1.179.111.255", "outside"],
    ["1.179.128.0", "outside"],
    ["172.246.239.255", "outside"],
    ["2001:db8::1", "outside"],
    ["1.179.112.10, 203.0.113.7", "invalid"],
    ["", "absent"],
  ])("places %s %s Brevo's ranges", (address, expected) => {
    expect(checkAddressInRanges(address, BREVO_WEBHOOK_ADDRESS_RANGES)).toBe(
      expected,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Authenticated, nothing written: 200 counted (decision 1; 16 RG148 scenario 9)
// ---------------------------------------------------------------------------------------------

describe("authenticated but not recorded: 200, a closed reason, no database (scenario 9)", () => {
  it.each<[string, Call]>([
    ["malformed JSON", { payload: "{not json" }],
    ["an empty body", { payload: "" }],
    [
      "a batch (a list, batched webhooks are disabled)",
      { payload: JSON.stringify([event()]) },
    ],
    ["text/plain", { headers: { "content-type": "text/plain" } }],
    ["no content-type", { headers: { "content-type": undefined } }],
    [
      "an event without ts_event (a contact event)",
      { payload: JSON.stringify(event({ ts_event: undefined })) },
    ],
    [
      "an event name outside the normalised shape",
      { payload: JSON.stringify(event({ event: "Hard Bounce" })) },
    ],
    [
      "a malformed message-id",
      { payload: JSON.stringify(event({ "message-id": "two words" })) },
    ],
    [
      "an address without @",
      { payload: JSON.stringify(event({ email: "nobody" })) },
    ],
  ])("answers 200 to %s, journaled invalid_payload", async (_case, call) => {
    const response = await post(server(), call);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ received: true });
    expect(linesNamed("webhook.brevo.ignored")).toEqual([
      expect.objectContaining({ level: "info", reason: "invalid_payload" }),
    ]);
    expect(valuesFoundIn(logs.text(), SECRET_VALUES)).toEqual([]);
  });

  it.each<[string, number]>([
    [
      "more than 15 minutes old (a replayed capture)",
      NOW_SECONDS - 15 * 60 - 1,
    ],
    ["more than 15 minutes ahead", NOW_SECONDS + 15 * 60 + 1],
    ["a day old", NOW_SECONDS - 86_400],
  ])(
    "rejects an event %s: 200, outside_window, nothing written",
    async (_case, tsEvent) => {
      const response = await post(server(), {
        payload: JSON.stringify(event({ ts_event: tsEvent })),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ received: true });
      expect(linesNamed("webhook.brevo.ignored")).toEqual([
        expect.objectContaining({ reason: "outside_window" }),
      ]);
    },
  );

  it("refuses a body over 64 KiB with 413", async () => {
    const response = await post(server(), {
      payload: JSON.stringify(event({ reason: "r".repeat(70_000) })),
    });
    expect(response.statusCode).toBe(413);
  });
});

describe("the write: 503 when the line cannot be written, without any value in the logs", () => {
  it.each<[string, number]>([
    ["at the edge of the window, in the past", NOW_SECONDS - 15 * 60],
    ["now", NOW_SECONDS],
  ])(
    "tries to write an event %s, and answers 503 for Brevo to retry",
    async (_case, tsEvent) => {
      const response = await post(server(), {
        payload: JSON.stringify(event({ ts_event: tsEvent })),
      });
      expect(response.statusCode).toBe(503);
      expect(response.json().error.code).toBe("service_unavailable");
      expect(linesNamed("webhook.brevo.write_failed")).toHaveLength(1);
      expect(valuesFoundIn(logs.text(), SECRET_VALUES)).toEqual([]);
    },
  );
});
