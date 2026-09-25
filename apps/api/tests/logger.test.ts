// Nothing sensitive reaches the log (docs/mvp/02-architecture-3-espaces.md §20.8,
// docs/mvp/21-plan-de-developpement.md §4, J1-H): the log stream is captured and searched.
import { afterEach, describe, expect, it } from "vitest";
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
