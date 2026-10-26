// Contract of the "Santé technique" screen (02 §20.5; 15 RG165; 21 §J9 commit 9): the queries are
// strict and closed, the defaults are the screen's, and the answers carry nothing the screen does
// not name.
import { describe, expect, it } from "vitest";
import {
  opsErrorDetailResponseSchema,
  opsErrorParamsSchema,
  opsErrorsQuerySchema,
  opsStatusResponseSchema,
  opsTrafficQuerySchema,
} from "../src/backoffice-ops.ts";

describe("queries", () => {
  it("errors: the open groups by default, a state and a source from the closed lists", () => {
    expect(opsErrorsQuerySchema.parse({})).toEqual({ state: "open" });
    expect(
      opsErrorsQuerySchema.parse({ state: "regression", source: "browser" }),
    ).toEqual({ state: "regression", source: "browser" });
    for (const query of [
      { state: "everything" },
      { source: "worker" },
      { state: "open", q: "x" },
    ]) {
      expect(opsErrorsQuerySchema.safeParse(query).success).toBe(false);
    }
  });

  it("traffic: one window of three, the hour by default; a route is never a parameter", () => {
    expect(opsTrafficQuerySchema.parse({})).toEqual({ window: "hour" });
    expect(opsTrafficQuerySchema.parse({ window: "week" })).toEqual({
      window: "week",
    });
    for (const query of [{ window: "month" }, { route: "/v1/x" }]) {
      expect(opsTrafficQuerySchema.safeParse(query).success).toBe(false);
    }
  });

  it("a group is named by its uuid only", () => {
    expect(opsErrorParamsSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});

describe("answers", () => {
  it("a status answer of another shape is refused, an extra member included", () => {
    const status = {
      now: "2026-10-26T12:00:00.000Z",
      probes: [],
      worker: { state: "running", maxBeatAgeSeconds: 60, processes: [] },
      periodic: [],
      alerts: [],
    };
    expect(opsStatusResponseSchema.safeParse(status).success).toBe(true);
    expect(
      opsStatusResponseSchema.safeParse({ ...status, address: "x@y.test" })
        .success,
    ).toBe(false);
    expect(
      opsStatusResponseSchema.safeParse({
        ...status,
        worker: { ...status.worker, state: "dead" },
      }).success,
    ).toBe(false);
  });

  it("an occurrence keeps 4000 characters of stack and 500 of message, no more", () => {
    const group = {
      id: "6f9c3a52-0f55-4d3c-9d6e-0a5d9c1b7e21",
      source: "server",
      service: "api",
      errorType: "TypeError",
      message: "x",
      route: null,
      status: "new",
      occurrenceCount: 1,
      regressionCount: 0,
      firstSeenAt: "2026-10-26T12:00:00.000Z",
      lastSeenAt: "2026-10-26T12:00:00.000Z",
      lastRegressedAt: null,
      firstVersion: "abc",
      lastVersion: "abc",
      regression: false,
    };
    const occurrence = {
      occurredAt: "2026-10-26T12:00:00.000Z",
      service: "api",
      version: "abc",
      route: null,
      requestId: null,
      accountId: null,
      message: "x",
      stack: "s".repeat(4000),
      userAgentSummary: null,
    };
    expect(
      opsErrorDetailResponseSchema.safeParse({
        group,
        occurrences: [occurrence],
      }).success,
    ).toBe(true);
    expect(
      opsErrorDetailResponseSchema.safeParse({
        group,
        occurrences: [{ ...occurrence, stack: "s".repeat(4001) }],
      }).success,
    ).toBe(false);
  });
});
