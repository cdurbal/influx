// The technical alerts of D60 (02 §20.5, §20.6; 15 RG165): the pure part — each threshold against
// its measure, the states (raised, recalled every 30 min, resolved), the burn-in of AL51, the
// recipients. No database, no clock: the instants are given.
import { describe, expect, it } from "vitest";
import { p95UpperBoundMs } from "../src/domains/ops/buckets.ts";
import {
  applyRound,
  DEFAULT_AL49_DEFINITION,
  evaluateSnapshot,
  newErrorDecision,
  recipientsOf,
  REMINDER_INTERVAL_MS,
  siteUnreachableConditions,
  slowPageConditions,
  undelivered,
  workerStoppedCondition,
  type AlertCondition,
  type AlertDefinition,
  type AlertSnapshot,
  type ProbeResult,
  type StoredAlertState,
} from "../src/domains/ops/technical-alerts.ts";

const T0 = new Date("2026-10-22T08:00:00Z");

function after(ms: number): Date {
  return new Date(T0.getTime() + ms);
}

function definition(
  nature: AlertDefinition["nature"],
  threshold: Record<string, unknown> = {},
  overrides: Partial<AlertDefinition> = {},
): AlertDefinition {
  return {
    nature,
    threshold,
    recipientRoles: ["on_call"],
    isActive: true,
    ...overrides,
  };
}

function condition(
  code: string,
  active: boolean,
  subjectKey = "",
): AlertCondition {
  return { code, subjectKey, active, value: { measured: active ? 2 : 0 } };
}

const STATE = { AL52: definition("etat") };
const EVENT = { AL62: definition("evenement") };

describe("applyRound: a state alert (15 RG64, RG165)", () => {
  it("rises with an e-mail, stays quiet under 30 min, is recalled at 30 min, then resolved", () => {
    const raised = applyRound(
      [],
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      T0,
    );
    expect(raised.notifications.map((n) => n.kind)).toEqual(["raised"]);
    expect(raised.states).toEqual([
      expect.objectContaining({
        code: "AL52",
        state: "open",
        openedAt: T0.toISOString(),
        lastNotifiedAt: T0.toISOString(),
        notifiedCount: 1,
      }),
    ]);

    const quiet = applyRound(
      raised.states,
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      after(REMINDER_INTERVAL_MS - 1),
    );
    expect(quiet).toEqual({ states: [], notifications: [] });

    const recalled = applyRound(
      raised.states,
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      after(REMINDER_INTERVAL_MS),
    );
    expect(recalled.notifications).toEqual([
      expect.objectContaining({
        kind: "reminder",
        sequence: 2,
        openedAt: T0.toISOString(),
      }),
    ]);

    const resolved = applyRound(
      recalled.states,
      [condition("AL52", false)],
      STATE,
      new Set(["AL52"]),
      after(REMINDER_INTERVAL_MS + 60_000),
    );
    expect(resolved.notifications.map((n) => n.kind)).toEqual(["resolved"]);
    expect(resolved.states[0]).toEqual(
      expect.objectContaining({
        state: "resolved",
        resolvedAt: after(REMINDER_INTERVAL_MS + 60_000).toISOString(),
      }),
    );
  });

  it("rises again after a resolution, as a new incident", () => {
    const first = applyRound(
      [],
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      T0,
    );
    const over = applyRound(
      first.states,
      [condition("AL52", false)],
      STATE,
      new Set(["AL52"]),
      after(60_000),
    );
    const again = applyRound(
      over.states,
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      after(120_000),
    );
    expect(again.notifications).toEqual([
      expect.objectContaining({
        kind: "raised",
        sequence: 1,
        openedAt: after(120_000).toISOString(),
      }),
    ]);
  });

  it("resolves an open subject that left the measure, when its code was evaluated", () => {
    const definitions = { AL63: definition("etat") };
    const open = applyRound(
      [],
      [condition("AL63", true, "exec-1")],
      definitions,
      new Set(["AL63"]),
      T0,
    );
    const gone = applyRound(
      open.states,
      [],
      definitions,
      new Set(["AL63"]),
      after(60_000),
    );
    expect(gone.notifications).toEqual([
      expect.objectContaining({
        code: "AL63",
        subjectKey: "exec-1",
        kind: "resolved",
      }),
    ]);
  });

  it("keeps the states of a code that was not evaluated (no threshold, no measure)", () => {
    const open = applyRound(
      [],
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      T0,
    );
    expect(
      applyRound(open.states, [], STATE, new Set(), after(60_000)),
    ).toEqual({
      states: [],
      notifications: [],
    });
  });

  it("resolves silently once its definition is deactivated by an admin", () => {
    const open = applyRound(
      [],
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      T0,
    );
    const off = applyRound(
      open.states,
      [condition("AL52", true)],
      { AL52: definition("etat", {}, { isActive: false }) },
      new Set(["AL52"]),
      after(60_000),
    );
    expect(off.notifications).toEqual([]);
    expect(off.states[0]?.state).toBe("resolved");
  });

  it("sends again at once a notification that reached nobody (undelivered)", () => {
    const open = applyRound(
      [],
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      T0,
    );
    const [saved] = open.states;
    if (saved === undefined) {
      throw new Error("a state was expected");
    }
    const back = undelivered(saved, undefined);
    expect(back).toEqual(
      expect.objectContaining({ lastNotifiedAt: null, notifiedCount: 0 }),
    );
    const retried = applyRound(
      [back],
      [condition("AL52", true)],
      STATE,
      new Set(["AL52"]),
      after(60_000),
    );
    expect(retried.notifications).toEqual([
      expect.objectContaining({ kind: "raised", sequence: 1 }),
    ]);
  });
});

describe("applyRound: an event alert (15 RG64, RG165)", () => {
  it("sends once per fact, never a reminder nor a resolution", () => {
    const fact = applyRound(
      [],
      [condition("AL62", true)],
      EVENT,
      new Set(["AL62"]),
      T0,
    );
    expect(fact.notifications.map((n) => n.kind)).toEqual(["raised"]);
    const still = applyRound(
      fact.states,
      [condition("AL62", true)],
      EVENT,
      new Set(["AL62"]),
      after(2 * REMINDER_INTERVAL_MS),
    );
    expect(still.notifications).toEqual([]);
    const over = applyRound(
      fact.states,
      [condition("AL62", false)],
      EVENT,
      new Set(["AL62"]),
      after(3 * REMINDER_INTERVAL_MS),
    );
    expect(over.notifications).toEqual([]);
    expect(over.states[0]?.state).toBe("resolved");
  });
});

function probe(
  target: ProbeResult["target"],
  outcome: ProbeResult["outcome"],
  durationMs = 120,
): ProbeResult {
  return {
    target,
    checkedAt: T0.toISOString(),
    outcome,
    statusCode: outcome === "up" ? 200 : 503,
    failureCode: outcome === "up" ? null : "status",
    durationMs,
  };
}

describe("AL49 and AL54: the probe kept in memory (02 §20.5)", () => {
  it("raises AL49 for a target after two consecutive failures only", () => {
    const one = siteUnreachableConditions(DEFAULT_AL49_DEFINITION, {
      api_health: [probe("api_health", "up"), probe("api_health", "down")],
      web_home_fr: [probe("web_home_fr", "up")],
    });
    expect(one?.map((c) => [c.subjectKey, c.active])).toEqual([
      ["web_home_fr", false],
      ["api_health", false],
    ]);
    const two = siteUnreachableConditions(DEFAULT_AL49_DEFINITION, {
      api_health: [probe("api_health", "down"), probe("api_health", "down")],
    });
    expect(two).toEqual([
      expect.objectContaining({
        subjectKey: "api_health",
        active: true,
        value: expect.objectContaining({
          consecutiveFailures: 2,
          threshold: 2,
          statusCode: 503,
        }),
      }),
    ]);
  });

  it("leaves AL49 unevaluated without its threshold", () => {
    expect(siteUnreachableConditions(definition("etat"), {})).toBeNull();
  });

  it("raises AL54 on three consecutive loads slower than 2 s, for the pages only", () => {
    const slow = definition("etat", {
      page_max_ms: 2000,
      consecutive_probes: 3,
    });
    const conditions = slowPageConditions(slow, {
      web_home_en: [
        probe("web_home_en", "up", 2500),
        probe("web_home_en", "up", 2100),
        probe("web_home_en", "up", 3000),
      ],
      backoffice_sign_in: [
        probe("backoffice_sign_in", "up", 2500),
        probe("backoffice_sign_in", "down", 2500),
        probe("backoffice_sign_in", "up", 2500),
      ],
      api_health: [
        probe("api_health", "up", 9000),
        probe("api_health", "up", 9000),
        probe("api_health", "up", 9000),
      ],
    });
    expect(conditions?.map((c) => [c.subjectKey, c.active])).toEqual([
      ["web_home_en", true],
      ["backoffice_sign_in", false],
    ]);
  });
});

describe("AL50: the beat of the worker, judged by the api (02 §11.3)", () => {
  const al50 = definition("etat", { heartbeat_max_age_seconds: 60 });

  it("is active beyond 60 s without a beat, and when no beat was ever written", () => {
    const base = { lastLoopTurnAt: null, definition: al50 };
    expect(
      workerStoppedCondition({
        ...base,
        now: "2026-10-22T08:01:00Z",
        lastBeatAt: "2026-10-22T08:00:30Z",
      })?.active,
    ).toBe(false);
    expect(
      workerStoppedCondition({
        ...base,
        now: "2026-10-22T08:01:01Z",
        lastBeatAt: "2026-10-22T08:00:00Z",
      }),
    ).toEqual(
      expect.objectContaining({
        active: true,
        value: expect.objectContaining({ ageSeconds: 61 }),
      }),
    );
    expect(
      workerStoppedCondition({
        ...base,
        now: "2026-10-22T08:01:00Z",
        lastBeatAt: null,
      })?.active,
    ).toBe(true);
  });

  it("decides nothing without its definition or its threshold", () => {
    const base = {
      now: T0.toISOString(),
      lastBeatAt: null,
      lastLoopTurnAt: null,
    };
    expect(workerStoppedCondition({ ...base, definition: null })).toBeNull();
    expect(
      workerStoppedCondition({ ...base, definition: definition("etat") }),
    ).toBeNull();
  });
});

describe("p95 of a histogram of nine buckets (02 §20.5, AL53)", () => {
  it("is the upper bound of the bucket of the 95th percentile", () => {
    expect(p95UpperBoundMs([0, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(p95UpperBoundMs([95, 0, 0, 0, 0, 0, 5, 0, 0])).toBe(25);
    expect(p95UpperBoundMs([94, 0, 0, 0, 0, 0, 6, 0, 0])).toBe(2500);
    expect(p95UpperBoundMs([0, 0, 0, 0, 0, 0, 0, 0, 3])).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});

function snapshot(
  measures: AlertSnapshot["measures"],
  definitions: AlertSnapshot["definitions"],
): AlertSnapshot {
  return { now: T0.toISOString(), definitions, measures };
}

function activeOf(
  result: ReturnType<typeof evaluateSnapshot>,
  code: string,
): boolean[] {
  return (
    result
      .find((evaluation) => evaluation.code === code)
      ?.conditions.map((c) => c.active) ?? []
  );
}

describe("evaluateSnapshot: the thresholds of 15 RG165", () => {
  it("AL52: 5xx above 1 % of the responses", () => {
    const al52 = definition("etat", { window_minutes: 5, max_share_bp: 100 });
    expect(
      activeOf(
        evaluateSnapshot(
          snapshot(
            { AL52: { requests: 200, serverErrors: 2 } },
            { AL52: al52 },
          ),
        ),
        "AL52",
      ),
    ).toEqual([false]);
    expect(
      activeOf(
        evaluateSnapshot(
          snapshot(
            { AL52: { requests: 200, serverErrors: 3 } },
            { AL52: al52 },
          ),
        ),
        "AL52",
      ),
    ).toEqual([true]);
    expect(
      activeOf(
        evaluateSnapshot(
          snapshot({ AL52: { requests: 0, serverErrors: 0 } }, { AL52: al52 }),
        ),
        "AL52",
      ),
    ).toEqual([false]);
  });

  it("AL53: p95 above 1 s", () => {
    const al53 = definition("etat", { window_minutes: 10, p95_max_ms: 1000 });
    expect(
      activeOf(
        evaluateSnapshot(
          snapshot(
            { AL53: { buckets: [90, 0, 0, 0, 0, 10, 0, 0, 0] } },
            { AL53: al53 },
          ),
        ),
        "AL53",
      ),
    ).toEqual([false]);
    expect(
      activeOf(
        evaluateSnapshot(
          snapshot(
            { AL53: { buckets: [90, 0, 0, 0, 0, 0, 10, 0, 0] } },
            { AL53: al53 },
          ),
        ),
        "AL53",
      ),
    ).toEqual([true]);
  });

  it("AL55: three times the usual volume, never under the fixed floor; the floor alone without history", () => {
    const al55 = definition("etat", {
      window_minutes: 5,
      usual_multiplier: 3,
      history_days: 14,
      fixed_calls_per_minute: 300,
    });
    const run = (m: NonNullable<AlertSnapshot["measures"]["AL55"]>) =>
      activeOf(evaluateSnapshot(snapshot({ AL55: m }, { AL55: al55 })), "AL55");
    expect(
      run({ callsPerMinute: 301, usualCallsPerMinute: null, historyDays: 3 }),
    ).toEqual([true]);
    expect(
      run({ callsPerMinute: 250, usualCallsPerMinute: 10, historyDays: 14 }),
    ).toEqual([false]);
    expect(
      run({ callsPerMinute: 700, usualCallsPerMinute: 200, historyDays: 14 }),
    ).toEqual([true]);
    expect(
      run({ callsPerMinute: 590, usualCallsPerMinute: 200, historyDays: 14 }),
    ).toEqual([false]);
  });

  it("AL56: 429 above 2 % and at least 20 of them", () => {
    const al56 = definition("etat", {
      window_minutes: 15,
      max_share_bp: 200,
      min_count: 20,
    });
    const run = (requests: number, throttled: number) =>
      activeOf(
        evaluateSnapshot(
          snapshot({ AL56: { requests, throttled } }, { AL56: al56 }),
        ),
        "AL56",
      );
    expect(run(100, 19)).toEqual([false]);
    expect(run(2000, 20)).toEqual([false]);
    expect(run(900, 20)).toEqual([true]);
  });

  it("AL57: the event loop, per service, over a covered window; the memory part off without a limit", () => {
    const al57 = definition("etat", {
      window_minutes: 5,
      event_loop_delay_max_ms: 200,
      memory_max_share_bp: 8500,
      memory_limit_bytes: null,
    });
    const services = [
      {
        service: "api",
        minutes: 5,
        avgEventLoopDelayMs: 250,
        avgRssBytes: 9e9,
      },
      {
        service: "worker",
        minutes: 3,
        avgEventLoopDelayMs: 900,
        avgRssBytes: 1,
      },
    ];
    expect(
      activeOf(
        evaluateSnapshot(snapshot({ AL57: { services } }, { AL57: al57 })),
        "AL57",
      ),
    ).toEqual([true, false]);
    const withLimit = definition("etat", {
      ...al57.threshold,
      memory_limit_bytes: 1_000,
    });
    const full = [
      { service: "api", minutes: 5, avgEventLoopDelayMs: 10, avgRssBytes: 900 },
    ];
    expect(
      activeOf(
        evaluateSnapshot(
          snapshot({ AL57: { services: full } }, { AL57: withLimit }),
        ),
        "AL57",
      ),
    ).toEqual([true]);
  });

  it("AL58: connections above 80 % on the last three samples", () => {
    const al58 = definition("etat", {
      connections_max_share_bp: 8000,
      consecutive_samples: 3,
    });
    const sample = (connections: number) => ({
      minute: T0.toISOString(),
      connections,
      maxConnections: 100,
    });
    const run = (samples: ReturnType<typeof sample>[]) =>
      activeOf(
        evaluateSnapshot(snapshot({ AL58: { samples } }, { AL58: al58 })),
        "AL58",
      );
    expect(run([sample(81), sample(81)])).toEqual([false]);
    expect(run([sample(81), sample(80), sample(81)])).toEqual([false]);
    expect(run([sample(70), sample(81), sample(85), sample(81)])).toEqual([
      true,
    ]);
  });

  it("AL59, AL60, AL63: one condition per opaque key, run, execution", () => {
    const result = evaluateSnapshot(
      snapshot(
        {
          AL59: { targets: [{ key: "a1b2", failures: 25 }] },
          AL60: {
            runs: [
              {
                runId: "r1",
                finishedAt: T0.toISOString(),
                realignFailed: 0,
                breaker: "breaker_orphan_ratio",
              },
              {
                runId: "r2",
                finishedAt: T0.toISOString(),
                realignFailed: 0,
                breaker: null,
              },
            ],
          },
          AL63: { executions: [{ id: "e1", executedAt: T0.toISOString() }] },
        },
        {
          AL59: definition("evenement", { window_hours: 24, min_failures: 25 }),
          AL60: definition("evenement", {
            realign_failed_min: 1,
            breaker_counts: ["breaker_orphan_ratio", "breaker_filter_refused"],
          }),
          AL63: definition("etat", { open_after_hours: 24 }),
        },
      ),
    );
    expect(result.find((e) => e.code === "AL59")?.conditions).toEqual([
      expect.objectContaining({ subjectKey: "a1b2", active: true }),
    ]);
    expect(activeOf(result, "AL60")).toEqual([true, false]);
    expect(
      result.find((e) => e.code === "AL63")?.conditions[0]?.subjectKey,
    ).toBe("e1");
  });

  it("AL61 and AL62: the Brevo webhook", () => {
    const result = evaluateSnapshot(
      snapshot(
        {
          AL61: { authenticated: 50, ignored: 10 },
          AL62: { occurrences: 1, lastAt: T0.toISOString() },
        },
        {
          AL61: definition("etat", {
            window_hours: 24,
            max_share_bp: 1000,
            min_ignored: 10,
          }),
          AL62: definition("evenement", {
            window_hours: 24,
            min_occurrences: 1,
          }),
        },
      ),
    );
    expect(activeOf(result, "AL61")).toEqual([true]);
    expect(activeOf(result, "AL62")).toEqual([true]);
  });

  it("AL48: the deliverability of the sign-in code (16 RG98)", () => {
    const al48 = definition("etat", {
      median_delivery_seconds_max: 60,
      p90_delivery_seconds_max: 180,
      no_sign_in_within_minutes: 10,
      no_sign_in_share_max_bp: 1500,
      delivered_share_min_bp: 9700,
    });
    const run = (m: NonNullable<AlertSnapshot["measures"]["AL48"]>) =>
      activeOf(evaluateSnapshot(snapshot({ AL48: m }, { AL48: al48 })), "AL48");
    const fine = {
      sends: 40,
      medianDeliverySeconds: 8,
      p90DeliverySeconds: 30,
      noSignInShareBp: 500,
      deliveredShareBp: 9900,
    };
    expect(run(fine)).toEqual([false]);
    expect(run({ ...fine, deliveredShareBp: 9600 })).toEqual([true]);
    expect(
      run({ ...fine, medianDeliverySeconds: null, p90DeliverySeconds: 200 }),
    ).toEqual([true]);
    expect(run({ ...fine, sends: 0, deliveredShareBp: 0 })).toEqual([false]);
  });

  it("leaves out a code without its definition, its measure or a threshold member", () => {
    const result = evaluateSnapshot(
      snapshot(
        {
          AL52: { requests: 10, serverErrors: 10 },
          AL56: { requests: 10, throttled: 10 },
        },
        {
          AL52: definition("etat", { window_minutes: 5 }),
          AL53: definition("etat", { window_minutes: 10, p95_max_ms: 1000 }),
        },
      ),
    );
    expect(result).toEqual([]);
  });
});

describe("AL51: new errors and regressions, the burn-in (02 §20.7)", () => {
  const group = {
    id: "g1",
    errorType: "TypeError",
    route: "/v1/x",
    at: T0.toISOString(),
  };
  const regression = { ...group, id: "g2" };
  const sightings = { newGroups: [group], regressions: [regression] };

  it("sends everything at once during the burn-in, also when no period is set", () => {
    for (const burnIn of [null, "2026-11-30T00:00:00Z"]) {
      const decision = newErrorDecision(
        definition("evenement", {
          burn_in_until: burnIn,
          digest_hour_utc: 7,
          digest_window_hours: 24,
        }),
        sightings,
        null,
        T0,
      );
      expect(decision).toEqual({
        immediate: { newGroups: [group], regressions: [regression] },
        digestDue: false,
        digestWindowHours: 24,
      });
    }
  });

  it("outside it, the regressions at once and the new groups in the daily digest", () => {
    const outside = definition("evenement", {
      burn_in_until: "2026-10-01T00:00:00Z",
      digest_hour_utc: 7,
      digest_window_hours: 24,
    });
    expect(newErrorDecision(outside, sightings, "2026-10-21", T0)).toEqual({
      immediate: { newGroups: [], regressions: [regression] },
      digestDue: true,
      digestWindowHours: 24,
    });
    expect(
      newErrorDecision(outside, sightings, "2026-10-22", T0).digestDue,
    ).toBe(false);
    expect(
      newErrorDecision(
        outside,
        sightings,
        "2026-10-21",
        new Date("2026-10-22T06:59:59Z"),
      ).digestDue,
    ).toBe(false);
  });
});

describe("recipients (15 RG165): on_call from the variable, admin from the base", () => {
  it("joins both, lower case and once, and resolves no other role", () => {
    expect(
      recipientsOf(
        definition(
          "etat",
          {},
          { recipientRoles: ["on_call", "admin", "agent"] },
        ),
        ["Ops@Influx.example", "dev@influx.example"],
        ["ops@influx.example", "admin@influx.example"],
      ),
    ).toEqual([
      "ops@influx.example",
      "dev@influx.example",
      "admin@influx.example",
    ]);
    expect(
      recipientsOf(
        definition("etat", {}, { recipientRoles: ["admin"] }),
        ["a@x.example"],
        null,
      ),
    ).toEqual([]);
  });
});

describe("stored states never carry a personal value (02 §20.8)", () => {
  it("keeps on a state only the scalar value of its condition", () => {
    const states: StoredAlertState[] = applyRound(
      [],
      [
        {
          code: "AL59",
          subjectKey: "a1b2c3d4",
          active: true,
          value: { failures: 30, threshold: 25 },
        },
      ],
      { AL59: definition("evenement", { min_failures: 25 }) },
      new Set(["AL59"]),
      T0,
    ).states;
    expect(JSON.stringify(states)).not.toMatch(/@/);
    expect(states[0]?.lastValue).toEqual({ failures: 30, threshold: 25 });
  });
});
