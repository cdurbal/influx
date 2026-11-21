// The search settings screen and their change under a peer's control, without the database (docs/mvp/04 §5.5; 10
// RG2, RG11; 15 AL22, AL65; jalons/l3g/modele.md §6, §7; l3g commit 10): the counters of critical mass as the
// route shapes them, the alerts of the base as the centre of alerts words them, the refusals of the two writers at
// the confirmation, and the contract of the request. The flows run on the local stack:
// db-tests/search-settings-route.test.ts.
import {
  dualControlRequestSchema,
  dualControlViewSchema,
  SEARCH_SETTING_REASONS,
} from "@influx/contracts/backoffice-actions";
import {
  searchSettingsResponseSchema,
  SEARCH_SETTING_KEYS,
} from "@influx/contracts/search-settings";
import { describe, expect, it } from "vitest";
import { confirmRefusalOf } from "../src/domains/backoffice/actions-dual-control-routes.ts";
import { criticalMassAlerts } from "../src/domains/backoffice/alerts.ts";
import { supplyCountersOf } from "../src/domains/backoffice/search-settings-routes.ts";
import type { SupplyCounterRow } from "../src/domains/backoffice/search-settings/repository.ts";
import { ApiError, RequestValidationError } from "../src/platform/errors.ts";

/** A database error as drizzle wraps it: the driver error is its `cause`. */
function sqlError(code: string, message: string, detail?: string): Error {
  const driver = Object.assign(new Error(message), {
    code,
    ...(detail === undefined ? {} : { detail }),
  });
  return new Error("Failed query", { cause: driver });
}

const counter = (
  snapshotOn: string,
  dimension: SupplyCounterRow["dimension"],
  dimensionValue: string,
  published: number,
  searchable: number,
): SupplyCounterRow => ({
  snapshotOn,
  dimension,
  dimensionValue,
  published,
  searchable,
  computedAt: `${snapshotOn}T00:05:00.000Z`,
});

describe("L3G-10: the counters of critical mass, as the settings screen reads them (0331)", () => {
  it("is null before the first snapshot, and shapes the last one with its topics, its countries and the global curve before it", () => {
    expect(supplyCountersOf([])).toBeNull();
    const rows = [
      counter("2026-11-21", "country", "FR", 6, 5),
      counter("2026-11-21", "global", "*", 10, 8),
      counter("2026-11-21", "topic", "pets", 4, 3),
      counter("2026-11-21", "topic", "sport", 3, 3),
      counter("2026-11-20", "global", "*", 9, 7),
      counter("2026-11-19", "global", "*", 8, 6),
    ];
    const counters = supplyCountersOf(rows);
    expect(counters).toEqual({
      snapshotOn: "2026-11-21",
      computedAt: "2026-11-21T00:05:00.000Z",
      global: { published: 10, searchable: 8 },
      topics: [
        { code: "pets", published: 4, searchable: 3 },
        { code: "sport", published: 3, searchable: 3 },
      ],
      countries: [{ code: "FR", published: 6, searchable: 5 }],
      curve: [
        { snapshotOn: "2026-11-20", published: 9, searchable: 7 },
        { snapshotOn: "2026-11-19", published: 8, searchable: 6 },
      ],
    });
    expect(
      searchSettingsResponseSchema.safeParse({
        asOf: "2026-11-21T10:00:00.000Z",
        settings: [],
        counters,
      }).success,
    ).toBe(true);
  });

  it("reads the newest day whatever the order of the rows, and none without a global row", () => {
    const shuffled = [
      counter("2026-11-19", "global", "*", 8, 6),
      counter("2026-11-21", "global", "*", 10, 8),
      counter("2026-11-20", "global", "*", 9, 7),
    ];
    expect(supplyCountersOf(shuffled)?.snapshotOn).toBe("2026-11-21");
    expect(supplyCountersOf(shuffled)?.curve.length).toBe(2);
    expect(
      supplyCountersOf([counter("2026-11-21", "topic", "pets", 1, 1)]),
    ).toBeNull();
  });
});

describe("L3G-10: AL22 and AL65, as the centre of alerts carries them (0331; 15 AL22, AL65)", () => {
  it("keeps the code, the cause, the count and the date of each row of the base and nothing else", () => {
    expect(
      criticalMassAlerts([
        {
          code: "AL65",
          cause: "counters_stale",
          observed: 120,
          threshold: 26,
          since: "2026-11-16T00:05:00.000Z",
        },
        {
          code: "AL22",
          cause: "k_blocked_share",
          observed: 3000,
          threshold: 2000,
          since: "2026-11-15T08:00:00.000Z",
        },
        {
          code: "AL65",
          cause: "thresholds_reached",
          observed: null,
          threshold: 30,
          since: null,
        },
      ]),
    ).toEqual([
      {
        code: "AL65",
        cause: "counters_stale",
        destination: null,
        setting: null,
        count: 120,
        since: "2026-11-16T00:05:00.000Z",
      },
      {
        code: "AL22",
        cause: "k_blocked_share",
        destination: null,
        setting: null,
        count: 3000,
        since: "2026-11-15T08:00:00.000Z",
      },
      {
        code: "AL65",
        cause: "thresholds_reached",
        destination: null,
        setting: null,
        count: 0,
        since: null,
      },
    ]);
    expect(criticalMassAlerts([])).toEqual([]);
  });
});

describe("L3G-10: the refusals of the two writers at the confirmation (0332)", () => {
  it("answers each 22023 DETAIL as a 400 on the field of the request, the confirmation rolled back with it", () => {
    for (const [detail, path, issue] of [
      ["key", "setting.key", "invalid_key"],
      ["value", "setting.value", "invalid_value"],
      ["reason", "reasonCode", "invalid_reason"],
      ["facet_code", "facetCode", "invalid_facet_code"],
      ["facet_not_openable", "isOpen", "facet_not_openable"],
      ["is_open", "isOpen", "invalid_value"],
      ["display_order", "displayOrder", "invalid_value"],
      ["note", "reasonNote", "invalid_note"],
    ] as const) {
      const refused = confirmRefusalOf(sqlError("22023", detail, detail));
      expect(refused, detail).toBeInstanceOf(RequestValidationError);
      expect((refused as RequestValidationError).issues).toEqual([
        { path, issue },
      ]);
    }
  });

  it("leaves a 22023 of another door, the deliberate 42501 and the refusals of the other actions as they were", () => {
    for (const error of [
      sqlError("22023", "other", "other"),
      sqlError("22023", "no detail"),
      sqlError("42501", "forbidden"),
    ]) {
      expect(confirmRefusalOf(error)).toBe(error);
    }
    const badge = confirmRefusalOf(
      sqlError("55000", "badge_not_holding", "badge_not_holding"),
    );
    expect(badge).toBeInstanceOf(ApiError);
  });
});

describe("L3G-10: the request of a change of the search configuration, as a closed contract (D84; 0332)", () => {
  const request = (body: object) => dualControlRequestSchema.safeParse(body);
  const setting = (key: string, value: unknown) => ({
    code: "search.change_setting",
    setting: { key, value },
    reasonCode: "founder_decision",
  });

  it("takes each of the ten keys with the value of its schema, and refuses a key outside them or a value out of its bounds", () => {
    const values: Record<(typeof SEARCH_SETTING_KEYS)[number], unknown> = {
      is_open_to_advertisers: true,
      k_anonymity_threshold: 8,
      page_size: 20,
      max_pages: 10,
      rate_limits: { perHour: 30, perDay: 200, profileOpensPerDay: 50 },
      cold_profile_quota: { slots: 2, recentDays: 30 },
      critical_mass_thresholds: { publishedProfiles: 30, perTopic: 5 },
      region_display_threshold: 5,
      selection_limits: {
        listsPerAccount: 10,
        itemsPerList: 50,
        requestsPerDay: 5,
      },
      identified_view: { pageSize: 20, maxPages: 10 },
    };
    for (const key of SEARCH_SETTING_KEYS) {
      expect(request(setting(key, values[key])).success, key).toBe(true);
    }
    for (const body of [
      setting("no_such_key", 1),
      setting("k_anonymity_threshold", 4),
      setting("is_open_to_advertisers", "yes"),
      setting("rate_limits", {
        perHour: 500,
        perDay: 100,
        profileOpensPerDay: 1,
      }),
      { ...setting("page_size", 20), reasonCode: "because" },
      { ...setting("page_size", 20), extra: true },
    ]) {
      expect(request(body).success).toBe(false);
    }
    expect([...SEARCH_SETTING_REASONS]).toEqual([
      "critical_mass_reached",
      "founder_decision",
      "abuse_response",
      "configuration_error",
    ]);
  });

  it("opens a facet of the base only: F12 stays closed while D78 holds, a facet of a later wave is not opened, a note stays within 500", () => {
    const facet = (facetCode: string, isOpen: boolean, extra: object = {}) => ({
      code: "search.change_facet",
      facetCode,
      isOpen,
      displayOrder: 3,
      reasonCode: "critical_mass_reached",
      ...extra,
    });
    expect(request(facet("F1", true)).success).toBe(true);
    expect(request(facet("F12", false)).success).toBe(true);
    expect(request(facet("F2", false)).success).toBe(true);
    expect(request(facet("F12", true)).success).toBe(false);
    expect(request(facet("F19", true)).success).toBe(false);
    expect(request(facet("F99", false)).success).toBe(false);
    expect(request(facet("F1", true, { displayOrder: 0 })).success).toBe(false);
    expect(request(facet("F1", true, { displayOrder: 100 })).success).toBe(
      false,
    );
    expect(request(facet("F1", true, { displayOrder: 2.5 })).success).toBe(
      false,
    );
    expect(
      request(facet("F1", true, { reasonNote: "x".repeat(500) })).success,
    ).toBe(true);
    expect(
      request(facet("F1", true, { reasonNote: "x".repeat(501) })).success,
    ).toBe(false);
  });

  it("shows a stored request of either action, with no target, in the view the screen reads", () => {
    const view = (action: object, consequences: string[]) => ({
      id: "00000000-0000-4000-8000-000000000001",
      action,
      target: null,
      recap: {
        scope: { kind: "setting", count: 1 },
        consequences,
        reversible: true,
      },
      reasonCode: "founder_decision",
      reasonNote: null,
      requestedBy: "00000000-0000-4000-8000-000000000002",
      requestedAt: "2026-11-21T10:00:00.000Z",
      expiresAt: "2026-11-22T10:00:00.000Z",
      state: "pending",
      confirmation: null,
      executed: false,
      next: { kind: "await_peer" },
    });
    expect(
      dualControlViewSchema.safeParse(
        view(
          {
            code: "search.change_setting",
            setting: { key: "page_size", value: 20 },
          },
          ["setting_changed"],
        ),
      ).success,
    ).toBe(true);
    expect(
      dualControlViewSchema.safeParse(
        view(
          {
            code: "search.change_facet",
            facetCode: "F1",
            isOpen: true,
            displayOrder: 1,
          },
          ["facet_changed", "config_version_opened"],
        ),
      ).success,
    ).toBe(true);
  });
});
