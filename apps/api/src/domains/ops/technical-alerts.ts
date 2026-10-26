// The technical alerts of D60 (docs/mvp/02 §20.5, §20.6; 15 RG165, AL48 to AL63): what each
// alert measures against its threshold, and how its state moves. PURE: no database, no clock, no
// network; shared by the worker (every alert but AL50) and the api (AL50, "worker stopped"), and
// naming no elevated operation (18 T6.3). The thresholds are DATA (backoffice.alert_definitions):
// a missing or unreadable member leaves its alert, or its part, unevaluated (RG165, "non fixé").
//
// State alert (15 RG64): it rises (an e-mail), is recalled at most every 30 minutes while it lasts,
// and ends with an e-mail "resolved". Event alert: one e-mail per fact; its state only remembers
// the fact while it is in the window of its measure, so that it is never sent twice (RG165).
// Nothing here ever holds an address, an IP, a URL or a message (02 §20.8): codes, counts, instants
// and opaque keys.
import { p95UpperBoundMs } from "./buckets.ts";

/** 15 RG165: the reminder of a state alert, at most every 30 minutes. */
export const REMINDER_INTERVAL_MS = 30 * 60_000;

/** The targets of the probe (ops.probe_target, 0147); never a URL. */
export const PROBE_TARGETS = [
  "web_home_fr",
  "web_home_en",
  "backoffice_sign_in",
  "api_health",
] as const;
export type ProbeTarget = (typeof PROBE_TARGETS)[number];

/** The pages of AL54: the probe targets a visitor loads. */
export const PAGE_TARGETS: readonly ProbeTarget[] = [
  "web_home_fr",
  "web_home_en",
  "backoffice_sign_in",
];

export type ProbeFailure =
  "timeout" | "connection" | "status" | "redirect" | "body";

export type ProbeResult = {
  target: ProbeTarget;
  checkedAt: string;
  outcome: "up" | "down";
  statusCode: number | null;
  failureCode: ProbeFailure | null;
  durationMs: number;
};

export type AlertNature = "etat" | "evenement";

/** A line of backoffice.alert_definitions, as the snapshot returns it. */
export type AlertDefinition = {
  nature: AlertNature;
  threshold: Readonly<Record<string, unknown>>;
  recipientRoles: readonly string[];
  isActive: boolean;
};

/** A value shown in the e-mail: counts, shares, durations, instants, codes. */
export type AlertValue = Readonly<Record<string, string | number | null>>;

/** What an evaluation says of one (code, subject) this round. */
export type AlertCondition = {
  code: string;
  /** The probe target, the service, the group, the run, the execution, an opaque key; "" alone. */
  subjectKey: string;
  active: boolean;
  value: AlertValue;
};

/** A line of ops.alert_states (0147). */
export type StoredAlertState = {
  code: string;
  subjectKey: string;
  state: "open" | "resolved";
  openedAt: string;
  lastNotifiedAt: string | null;
  notifiedCount: number;
  resolvedAt: string | null;
  lastValue?: AlertValue | undefined;
};

export type NotificationKind = "raised" | "reminder" | "resolved";

export type AlertNotification = {
  code: string;
  subjectKey: string;
  kind: NotificationKind;
  openedAt: string;
  /** notifiedCount after this notification: part of its idempotency key. */
  sequence: number;
  value: AlertValue;
};

export type RoundOutcome = {
  /** The states to write (only those that changed). */
  states: StoredAlertState[];
  notifications: AlertNotification[];
};

function keyOf(code: string, subjectKey: string): string {
  return `${code}\u0000${subjectKey}`;
}

/**
 * One round: the previous states of a scope and the conditions of this round give the states to
 * write and the e-mails to send. A code evaluated this round (`evaluatedCodes`) whose open subject
 * has no condition is inactive (the subject left the measure); a code not evaluated (no threshold,
 * no measure) keeps its states as they are. An inactive definition resolves its states silently.
 */
export function applyRound(
  previous: readonly StoredAlertState[],
  conditions: readonly AlertCondition[],
  definitions: Readonly<Record<string, AlertDefinition | undefined>>,
  evaluatedCodes: ReadonlySet<string>,
  now: Date,
): RoundOutcome {
  const at = now.toISOString();
  const byKey = new Map(
    previous.map((state) => [keyOf(state.code, state.subjectKey), state]),
  );
  const seen = new Set<string>();
  const states: StoredAlertState[] = [];
  const notifications: AlertNotification[] = [];

  for (const condition of conditions) {
    const key = keyOf(condition.code, condition.subjectKey);
    seen.add(key);
    const definition = definitions[condition.code];
    if (definition === undefined) {
      continue;
    }
    const before = byKey.get(key);
    const isOpen = before?.state === "open";
    const active = condition.active && definition.isActive;
    if (active && !isOpen) {
      const opened: StoredAlertState = {
        code: condition.code,
        subjectKey: condition.subjectKey,
        state: "open",
        openedAt: at,
        lastNotifiedAt: at,
        notifiedCount: 1,
        resolvedAt: null,
        lastValue: condition.value,
      };
      states.push(opened);
      notifications.push(notificationOf(opened, "raised", condition.value));
      continue;
    }
    if (active && before !== undefined) {
      const due =
        before.lastNotifiedAt === null ||
        (definition.nature === "etat" &&
          now.getTime() - Date.parse(before.lastNotifiedAt) >=
            REMINDER_INTERVAL_MS);
      if (due) {
        const recalled: StoredAlertState = {
          ...before,
          lastNotifiedAt: at,
          notifiedCount: before.notifiedCount + 1,
          lastValue: condition.value,
        };
        states.push(recalled);
        notifications.push(
          notificationOf(
            recalled,
            before.notifiedCount === 0 ? "raised" : "reminder",
            condition.value,
          ),
        );
      }
      continue;
    }
    if (!active && isOpen) {
      states.push(resolvedState(before, at, condition.value));
      // An event leaves silently; a disabled definition too.
      if (definition.nature === "etat" && definition.isActive) {
        notifications.push(
          notificationOf(
            before,
            "resolved",
            condition.value,
            before.notifiedCount,
          ),
        );
      }
    }
  }

  // The open subjects of an evaluated code that left its measure: the condition is over.
  for (const state of previous) {
    const key = keyOf(state.code, state.subjectKey);
    if (
      seen.has(key) ||
      state.state !== "open" ||
      !evaluatedCodes.has(state.code)
    ) {
      continue;
    }
    const definition = definitions[state.code];
    states.push(resolvedState(state, at, state.lastValue ?? {}));
    if (definition?.nature === "etat" && definition.isActive) {
      notifications.push(
        notificationOf(
          state,
          "resolved",
          state.lastValue ?? {},
          state.notifiedCount,
        ),
      );
    }
  }
  return { states, notifications };
}

function resolvedState(
  state: StoredAlertState,
  at: string,
  value: AlertValue,
): StoredAlertState {
  return { ...state, state: "resolved", resolvedAt: at, lastValue: value };
}

function notificationOf(
  state: StoredAlertState,
  kind: NotificationKind,
  value: AlertValue,
  sequence = state.notifiedCount,
): AlertNotification {
  return {
    code: state.code,
    subjectKey: state.subjectKey,
    kind,
    openedAt: state.openedAt,
    sequence,
    value,
  };
}

/**
 * A notification that reached no recipient: its state goes back to "not notified", so that the
 * next round sends it again (a state alert without waiting 30 minutes, an event alert at all).
 * A "resolved" that reached nobody is not sent again: the screen still shows the end.
 */
export function undelivered(
  state: StoredAlertState,
  previous: StoredAlertState | undefined,
): StoredAlertState {
  return {
    ...state,
    lastNotifiedAt: previous?.state === "open" ? previous.lastNotifiedAt : null,
    notifiedCount: previous?.state === "open" ? previous.notifiedCount : 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Threshold members
// ---------------------------------------------------------------------------------------------

/** A finite number of the threshold, or null (absent, null: "non fixé", or unreadable). */
export function thresholdNumber(
  threshold: Readonly<Record<string, unknown>>,
  member: string,
): number | null {
  const value = threshold[member];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function thresholdStrings(
  threshold: Readonly<Record<string, unknown>>,
  member: string,
): string[] {
  const value = threshold[member];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/** Basis points of a share, rounded down: 1 % is 100. */
export function shareBp(part: number, whole: number): number {
  return whole <= 0 ? 0 : Math.floor((part * 10_000) / whole);
}

// ---------------------------------------------------------------------------------------------
// The probe (AL49, AL54): judged on the results kept in memory, so that it works without the base
// ---------------------------------------------------------------------------------------------

/** The results of the probe kept per target, newest last; enough for every threshold. */
export const PROBE_HISTORY_LENGTH = 10;

/** AL49, starting value of 15 RG165: used until the definition has been read once. */
export const DEFAULT_AL49_DEFINITION: AlertDefinition = {
  nature: "etat",
  threshold: { consecutive_failures: 2, probe_interval_seconds: 60 },
  recipientRoles: ["on_call"],
  isActive: true,
};

export type ProbeHistory = Readonly<
  Partial<Record<ProbeTarget, readonly ProbeResult[]>>
>;

/** AL49: per target, the last `consecutive_failures` results all down. */
export function siteUnreachableConditions(
  definition: AlertDefinition,
  history: ProbeHistory,
): AlertCondition[] | null {
  const required = thresholdNumber(
    definition.threshold,
    "consecutive_failures",
  );
  if (required === null || required < 1) {
    return null;
  }
  return PROBE_TARGETS.flatMap((target) => {
    const results = history[target] ?? [];
    const last = results.at(-1);
    if (last === undefined) {
      return [];
    }
    const recent = results.slice(-required);
    const active =
      recent.length >= required &&
      recent.every((result) => result.outcome === "down");
    return [
      {
        code: "AL49",
        subjectKey: target,
        active,
        value: {
          target,
          consecutiveFailures: trailingCount(
            results,
            (r) => r.outcome === "down",
          ),
          threshold: required,
          failureCode: last.failureCode,
          statusCode: last.statusCode,
        },
      },
    ];
  });
}

/** AL54: per page, the last `consecutive_probes` results all up and slower than `page_max_ms`. */
export function slowPageConditions(
  definition: AlertDefinition,
  history: ProbeHistory,
): AlertCondition[] | null {
  const required = thresholdNumber(definition.threshold, "consecutive_probes");
  const maxMs = thresholdNumber(definition.threshold, "page_max_ms");
  if (required === null || required < 1 || maxMs === null) {
    return null;
  }
  const isSlow = (result: ProbeResult) =>
    result.outcome === "up" && result.durationMs > maxMs;
  return PAGE_TARGETS.flatMap((target) => {
    const results = history[target] ?? [];
    const last = results.at(-1);
    if (last === undefined) {
      return [];
    }
    const recent = results.slice(-required);
    return [
      {
        code: "AL54",
        subjectKey: target,
        active: recent.length >= required && recent.every(isSlow),
        value: {
          target,
          durationMs: last.durationMs,
          thresholdMs: maxMs,
          probes: required,
        },
      },
    ];
  });
}

function trailingCount<T>(
  items: readonly T[],
  test: (item: T) => boolean,
): number {
  let count = 0;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item === undefined || !test(item)) {
      break;
    }
    count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------------------------
// AL50, evaluated by the api
// ---------------------------------------------------------------------------------------------

export type WorkerLiveness = {
  now: string;
  lastBeatAt: string | null;
  lastLoopTurnAt: string | null;
  definition: AlertDefinition | null;
};

/**
 * AL50: no beat since `heartbeat_max_age_seconds` (02 §11.3). No beat ever written is a stopped
 * worker too: a deployed environment always runs one.
 */
export function workerStoppedCondition(
  liveness: WorkerLiveness,
): AlertCondition | null {
  const definition = liveness.definition;
  if (definition === null) {
    return null;
  }
  const maxAge = thresholdNumber(
    definition.threshold,
    "heartbeat_max_age_seconds",
  );
  if (maxAge === null) {
    return null;
  }
  const ageSeconds =
    liveness.lastBeatAt === null
      ? null
      : Math.max(
          0,
          Math.floor(
            (Date.parse(liveness.now) - Date.parse(liveness.lastBeatAt)) / 1000,
          ),
        );
  return {
    code: "AL50",
    subjectKey: "",
    active: ageSeconds === null || ageSeconds > maxAge,
    value: {
      lastBeatAt: liveness.lastBeatAt,
      ageSeconds,
      thresholdSeconds: maxAge,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// The snapshot of the worker (ops.technical_alert_snapshot, 0147)
// ---------------------------------------------------------------------------------------------

export type ErrorGroupSighting = {
  id: string;
  errorType: string;
  route: string | null;
  at: string;
};

export type AlertMeasures = {
  AL48?: {
    sends: number;
    medianDeliverySeconds: number | null;
    p90DeliverySeconds: number | null;
    noSignInShareBp: number | null;
    deliveredShareBp: number | null;
  };
  AL51?: {
    newGroups: readonly ErrorGroupSighting[];
    regressions: readonly ErrorGroupSighting[];
  };
  AL52?: { requests: number; serverErrors: number };
  AL53?: { buckets: readonly number[] };
  AL55?: {
    callsPerMinute: number;
    usualCallsPerMinute: number | null;
    historyDays: number;
  };
  AL56?: { requests: number; throttled: number };
  AL57?: {
    services: readonly {
      service: string;
      minutes: number;
      avgEventLoopDelayMs: number;
      avgRssBytes: number;
    }[];
  };
  AL58?: {
    samples: readonly {
      minute: string;
      connections: number;
      maxConnections: number;
    }[];
  };
  AL59?: { targets: readonly { key: string; failures: number }[] };
  AL60?: {
    runs: readonly {
      runId: string;
      finishedAt: string;
      realignFailed: number;
      breaker: string | null;
    }[];
  };
  AL61?: { authenticated: number; ignored: number };
  AL62?: { occurrences: number; lastAt: string | null };
  AL63?: { executions: readonly { id: string; executedAt: string }[] };
};

export type AlertSnapshot = {
  now: string;
  definitions: Readonly<Record<string, AlertDefinition | undefined>>;
  measures: AlertMeasures;
};

type Evaluation = { code: string; conditions: AlertCondition[] };

/**
 * Every alert of the worker but AL49 and AL54 (the probe, in memory) and AL51 (its own rhythm,
 * newErrorDecision): the conditions of each code that has its definition, its threshold and its
 * measure. A code absent from the result is not evaluated this round.
 */
export function evaluateSnapshot(snapshot: AlertSnapshot): Evaluation[] {
  const evaluations: Evaluation[] = [];
  const { definitions, measures } = snapshot;
  const add = (
    code: string,
    evaluate: (definition: AlertDefinition) => AlertCondition[] | null,
  ) => {
    const definition = definitions[code];
    if (definition === undefined) {
      return;
    }
    const conditions = evaluate(definition);
    if (conditions !== null) {
      evaluations.push({ code, conditions });
    }
  };

  add("AL48", ({ threshold }) => {
    const m = measures.AL48;
    if (m === undefined) {
      return null;
    }
    const checks: [
      number | null,
      number | null,
      (v: number, t: number) => boolean,
    ][] = [
      [
        m.medianDeliverySeconds,
        thresholdNumber(threshold, "median_delivery_seconds_max"),
        (v, t) => v > t,
      ],
      [
        m.p90DeliverySeconds,
        thresholdNumber(threshold, "p90_delivery_seconds_max"),
        (v, t) => v > t,
      ],
      [
        m.noSignInShareBp,
        thresholdNumber(threshold, "no_sign_in_share_max_bp"),
        (v, t) => v > t,
      ],
      [
        m.deliveredShareBp,
        thresholdNumber(threshold, "delivered_share_min_bp"),
        (v, t) => v < t,
      ],
    ];
    const active =
      m.sends > 0 &&
      checks.some(([value, limit, exceeds]) =>
        value !== null && limit !== null ? exceeds(value, limit) : false,
      );
    return [
      {
        code: "AL48",
        subjectKey: "",
        active,
        value: {
          sends: m.sends,
          medianDeliverySeconds: m.medianDeliverySeconds,
          p90DeliverySeconds: m.p90DeliverySeconds,
          noSignInShareBp: m.noSignInShareBp,
          deliveredShareBp: m.deliveredShareBp,
        },
      },
    ];
  });

  add("AL52", ({ threshold }) => {
    const m = measures.AL52;
    const maxBp = thresholdNumber(threshold, "max_share_bp");
    const window = thresholdNumber(threshold, "window_minutes");
    if (m === undefined || maxBp === null || window === null) {
      return null;
    }
    const share = shareBp(m.serverErrors, m.requests);
    return [
      {
        code: "AL52",
        subjectKey: "",
        active: m.requests > 0 && share > maxBp,
        value: {
          requests: m.requests,
          serverErrors: m.serverErrors,
          shareBp: share,
          thresholdBp: maxBp,
          windowMinutes: window,
        },
      },
    ];
  });

  add("AL53", ({ threshold }) => {
    const m = measures.AL53;
    const maxMs = thresholdNumber(threshold, "p95_max_ms");
    const window = thresholdNumber(threshold, "window_minutes");
    if (m === undefined || maxMs === null || window === null) {
      return null;
    }
    const p95 = p95UpperBoundMs(m.buckets);
    return [
      {
        code: "AL53",
        subjectKey: "",
        active: p95 !== null && p95 > maxMs,
        value: {
          p95UpperMs: p95 === null || Number.isFinite(p95) ? p95 : null,
          p95Beyond: p95 !== null && !Number.isFinite(p95) ? 1 : 0,
          thresholdMs: maxMs,
          windowMinutes: window,
          requests: m.buckets.reduce((sum, count) => sum + count, 0),
        },
      },
    ];
  });

  add("AL55", ({ threshold }) => {
    const m = measures.AL55;
    const multiplier = thresholdNumber(threshold, "usual_multiplier");
    const historyDays = thresholdNumber(threshold, "history_days");
    const fixed = thresholdNumber(threshold, "fixed_calls_per_minute");
    if (m === undefined || fixed === null) {
      return null;
    }
    // Usual volume once there is enough history; never below the fixed floor (an information
    // alert at three calls a minute would teach to ignore it).
    const hasHistory =
      m.usualCallsPerMinute !== null &&
      multiplier !== null &&
      historyDays !== null &&
      m.historyDays >= historyDays;
    const limit = hasHistory
      ? Math.max(multiplier * (m.usualCallsPerMinute ?? 0), fixed)
      : fixed;
    return [
      {
        code: "AL55",
        subjectKey: "",
        active: m.callsPerMinute > limit,
        value: {
          callsPerMinute: round1(m.callsPerMinute),
          usualCallsPerMinute:
            m.usualCallsPerMinute === null
              ? null
              : round1(m.usualCallsPerMinute),
          limit: round1(limit),
        },
      },
    ];
  });

  add("AL56", ({ threshold }) => {
    const m = measures.AL56;
    const maxBp = thresholdNumber(threshold, "max_share_bp");
    const minCount = thresholdNumber(threshold, "min_count");
    const window = thresholdNumber(threshold, "window_minutes");
    if (
      m === undefined ||
      maxBp === null ||
      minCount === null ||
      window === null
    ) {
      return null;
    }
    const share = shareBp(m.throttled, m.requests);
    return [
      {
        code: "AL56",
        subjectKey: "",
        active: m.throttled >= minCount && share > maxBp,
        value: {
          requests: m.requests,
          throttled: m.throttled,
          shareBp: share,
          thresholdBp: maxBp,
          minCount,
          windowMinutes: window,
        },
      },
    ];
  });

  add("AL57", ({ threshold }) => {
    const m = measures.AL57;
    const window = thresholdNumber(threshold, "window_minutes");
    const delayMax = thresholdNumber(threshold, "event_loop_delay_max_ms");
    const memoryMaxBp = thresholdNumber(threshold, "memory_max_share_bp");
    const memoryLimit = thresholdNumber(threshold, "memory_limit_bytes");
    if (m === undefined || window === null || delayMax === null) {
      return null;
    }
    return m.services.map((service) => {
      const covered = service.minutes >= window;
      const memoryShare =
        memoryLimit === null || memoryLimit <= 0
          ? null
          : shareBp(service.avgRssBytes, memoryLimit);
      const slow = service.avgEventLoopDelayMs > delayMax;
      const full =
        memoryShare !== null &&
        memoryMaxBp !== null &&
        memoryShare > memoryMaxBp;
      return {
        code: "AL57",
        subjectKey: service.service,
        active: covered && (slow || full),
        value: {
          service: service.service,
          avgEventLoopDelayMs: round1(service.avgEventLoopDelayMs),
          thresholdMs: delayMax,
          memoryShareBp: memoryShare,
          windowMinutes: window,
        },
      };
    });
  });

  add("AL58", ({ threshold }) => {
    const m = measures.AL58;
    const maxBp = thresholdNumber(threshold, "connections_max_share_bp");
    const required = thresholdNumber(threshold, "consecutive_samples");
    if (
      m === undefined ||
      maxBp === null ||
      required === null ||
      required < 1
    ) {
      return null;
    }
    const recent = m.samples.slice(-required);
    const last = m.samples.at(-1);
    return [
      {
        code: "AL58",
        subjectKey: "",
        active:
          recent.length >= required &&
          recent.every(
            (sample) =>
              shareBp(sample.connections, sample.maxConnections) > maxBp,
          ),
        value: {
          connections: last?.connections ?? null,
          maxConnections: last?.maxConnections ?? null,
          thresholdBp: maxBp,
          samples: required,
        },
      },
    ];
  });

  add("AL59", ({ threshold }) => {
    const m = measures.AL59;
    const minFailures = thresholdNumber(threshold, "min_failures");
    if (m === undefined || minFailures === null) {
      return null;
    }
    return m.targets.map((target) => ({
      code: "AL59",
      // Opaque (0147): never the address, nor anything that leads back to it outside identity.
      subjectKey: target.key,
      active: target.failures >= minFailures,
      value: { failures: target.failures, threshold: minFailures },
    }));
  });

  add("AL60", ({ threshold }) => {
    const m = measures.AL60;
    const minFailed = thresholdNumber(threshold, "realign_failed_min");
    if (m === undefined || minFailed === null) {
      return null;
    }
    const breakers = new Set(thresholdStrings(threshold, "breaker_counts"));
    return m.runs.map((run) => ({
      code: "AL60",
      subjectKey: run.runId,
      active:
        run.realignFailed >= minFailed ||
        (run.breaker !== null && breakers.has(run.breaker)),
      value: {
        runId: run.runId,
        finishedAt: run.finishedAt,
        realignFailed: run.realignFailed,
        breaker: run.breaker,
      },
    }));
  });

  add("AL61", ({ threshold }) => {
    const m = measures.AL61;
    const maxBp = thresholdNumber(threshold, "max_share_bp");
    const minIgnored = thresholdNumber(threshold, "min_ignored");
    const hours = thresholdNumber(threshold, "window_hours");
    if (
      m === undefined ||
      maxBp === null ||
      minIgnored === null ||
      hours === null
    ) {
      return null;
    }
    const share = shareBp(m.ignored, m.authenticated);
    return [
      {
        code: "AL61",
        subjectKey: "",
        active: m.ignored >= minIgnored && share > maxBp,
        value: {
          authenticated: m.authenticated,
          ignored: m.ignored,
          shareBp: share,
          thresholdBp: maxBp,
          windowHours: hours,
        },
      },
    ];
  });

  add("AL62", ({ threshold }) => {
    const m = measures.AL62;
    const minimum = thresholdNumber(threshold, "min_occurrences");
    if (m === undefined || minimum === null) {
      return null;
    }
    return [
      {
        code: "AL62",
        subjectKey: "",
        active: m.occurrences >= minimum,
        value: { occurrences: m.occurrences, lastAt: m.lastAt },
      },
    ];
  });

  add("AL63", ({ threshold }) => {
    const m = measures.AL63;
    const hours = thresholdNumber(threshold, "open_after_hours");
    if (m === undefined || hours === null) {
      return null;
    }
    return m.executions.map((execution) => ({
      code: "AL63",
      subjectKey: execution.id,
      active: true,
      value: {
        executionId: execution.id,
        executedAt: execution.executedAt,
        thresholdHours: hours,
      },
    }));
  });

  return evaluations;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------------------------
// AL51: new server errors and regressions (02 §20.7, J4S-6)
// ---------------------------------------------------------------------------------------------

export type NewErrorDecision = {
  /** The groups to send now, in one e-mail for the round; null when there is none. */
  immediate: {
    newGroups: ErrorGroupSighting[];
    regressions: ErrorGroupSighting[];
  } | null;
  /**
   * Outside the burn-in, the daily digest is due this round: the caller reads the new groups of the
   * last `digestWindowHours` and sends them in one e-mail.
   */
  digestDue: boolean;
  digestWindowHours: number;
};

/**
 * AL51 (15 RG165): during the burn-in (no `burn_in_until`, or a later one: 02 §20.7, "sans période
 * saisie, le régime de rodage s'applique"), every new group and regression of the round goes out
 * at once; outside it, the regressions only, and the new groups in the daily digest at
 * `digest_hour_utc`. `lastDigestDay` is the UTC day (YYYY-MM-DD) of the last digest.
 */
export function newErrorDecision(
  definition: AlertDefinition,
  sightings: NonNullable<AlertMeasures["AL51"]>,
  lastDigestDay: string | null,
  now: Date,
): NewErrorDecision {
  const windowHours =
    thresholdNumber(definition.threshold, "digest_window_hours") ?? 24;
  if (!definition.isActive) {
    return {
      immediate: null,
      digestDue: false,
      digestWindowHours: windowHours,
    };
  }
  const burnInUntil = definition.threshold.burn_in_until;
  const inBurnIn =
    burnInUntil === null ||
    burnInUntil === undefined ||
    (typeof burnInUntil === "string" &&
      !(Date.parse(burnInUntil) <= now.getTime()));
  const newGroups = [...sightings.newGroups];
  const regressions = [...sightings.regressions];
  if (inBurnIn) {
    return {
      immediate:
        newGroups.length + regressions.length > 0
          ? { newGroups, regressions }
          : null,
      digestDue: false,
      digestWindowHours: windowHours,
    };
  }
  const hour = thresholdNumber(definition.threshold, "digest_hour_utc") ?? 7;
  return {
    immediate: regressions.length > 0 ? { newGroups: [], regressions } : null,
    digestDue:
      now.getUTCHours() >= hour &&
      lastDigestDay !== now.toISOString().slice(0, 10),
    digestWindowHours: windowHours,
  };
}

// ---------------------------------------------------------------------------------------------
// Recipients (15 RG165): on_call from the variable, admin from the base; nothing else here
// ---------------------------------------------------------------------------------------------

export function recipientsOf(
  definition: AlertDefinition,
  onCall: readonly string[],
  admins: readonly string[] | null,
): string[] {
  const addresses: string[] = [];
  if (definition.recipientRoles.includes("on_call")) {
    addresses.push(...onCall);
  }
  if (definition.recipientRoles.includes("admin") && admins !== null) {
    addresses.push(...admins);
  }
  return [...new Set(addresses.map((address) => address.toLowerCase()))];
}
