// The correspondence table of 05 RG99 and the separation of RG100 (domains/backoffice/
// sync-causes.ts): a raw code of the worker never leaves apps/api, a normal case is never a
// failure, a refused key is an incident, a scheduled retry says when.
import { SYNC_CAUSES } from "@influx/contracts/backoffice-accounts";
import { describe, expect, it } from "vitest";
import {
  syncStatusOf,
  type RawSyncState,
} from "../src/domains/backoffice/sync-causes.ts";

const NONE: RawSyncState = {
  liveStatus: null,
  liveAttempts: null,
  liveAvailableAt: null,
  lastStatus: null,
  lastCode: null,
  lastAttemptAt: null,
};

describe("05 RG99, RG100: state, nature and cause of one destination", () => {
  it("no attempt, a waiting line, a scheduled retry, a line taken by the worker", () => {
    expect(syncStatusOf(NONE)).toMatchObject({
      state: "not_attempted",
      nature: "in_progress",
      cause: "not_attempted",
    });
    expect(
      syncStatusOf({ ...NONE, liveStatus: "pending", liveAttempts: 0 }),
    ).toMatchObject({ state: "pending", cause: "waiting", retryAt: null });
    expect(
      syncStatusOf({
        ...NONE,
        liveStatus: "pending",
        liveAttempts: 3,
        liveAvailableAt: "2026-10-15T09:30:00.000Z",
        lastStatus: "failed",
        lastCode: "brevo.unavailable",
      }),
    ).toMatchObject({
      state: "pending",
      cause: "retry_scheduled",
      retryAt: "2026-10-15T09:30:00.000Z",
    });
    expect(
      syncStatusOf({ ...NONE, liveStatus: "processing", liveAttempts: 1 }),
    ).toMatchObject({ state: "pending", cause: "waiting", retryAt: null });
  });

  it("a skip is a normal case with its cause, an unknown reason never passed through", () => {
    for (const [code, cause] of [
      ["no_consent", "no_consent"],
      ["out_of_apollo_scope_individual", "out_of_apollo_scope_individual"],
      ["country_not_validated", "country_not_validated"],
      ["skipped_no_credentials", "non_production"],
      ["list_not_configured", "configuration_missing"],
      ["something_new", "other_normal_case"],
    ] as const) {
      expect(
        syncStatusOf({ ...NONE, lastStatus: "skipped", lastCode: code }),
        code,
      ).toMatchObject({ state: "skipped", nature: "normal_case", cause });
    }
  });

  it("a failure is a failure, a refused key an incident, an unknown code never passed through", () => {
    for (const [code, nature, cause] of [
      ["brevo.rejected", "failure", "address_refused"],
      ["apollo.rate_limited", "failure", "quota_exceeded"],
      ["brevo.unreachable", "failure", "service_unavailable"],
      ["worker_interrupted", "failure", "service_unavailable"],
      ["output_check_rejected", "failure", "data_refused_by_check"],
      ["apollo.unauthorized", "incident", "access_key_refused"],
      ["brevo.teapot", "failure", "other_failure"],
      [null, "failure", "other_failure"],
    ] as const) {
      const status = syncStatusOf({
        ...NONE,
        lastStatus: "failed",
        lastCode: code,
      });
      expect(status, String(code)).toMatchObject({
        state: "failed",
        nature,
        cause,
      });
      expect(SYNC_CAUSES).toContain(status.cause);
    }
  });

  it("a success is synced", () => {
    expect(
      syncStatusOf({
        ...NONE,
        lastStatus: "succeeded",
        lastAttemptAt: "2026-10-15T08:00:00.000Z",
      }),
    ).toEqual({
      state: "synced",
      nature: "success",
      cause: "synced",
      retryAt: null,
      lastAttemptAt: "2026-10-15T08:00:00.000Z",
    });
  });
});
