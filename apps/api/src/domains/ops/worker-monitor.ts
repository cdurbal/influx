// The active monitoring of the worker (02 §11.3, §20.5, §20.6; 15 RG165), under E-4
// `maintenance.run_periodic` (influx_worker, by the functions of ops of 0147, no audit line: no
// business subject is written):
//
//   heartbeat  a line per process, at each turn of the drain (at most every 10 s), and every 15 s
//              while a long step runs (the periodic tasks): the api reads it (AL50);
//   probe      every minute, the four targets (probe.ts), kept in memory (AL49, AL54 work without
//              the base) and written to ops.probe_results (buffered while the base is away);
//   alerts     every minute, under the advisory lock of the scope `worker` (one instance at a time):
//              the snapshot of the base, the conditions of AL48, AL49, AL51 to AL63, the states
//              (dedup 30 min, "resolved"), then the e-mails AFTER the transaction (G4), directly to
//              Brevo with the worker's own key, never through the queue.
//
// Base unreachable: AL49 alone (the /health of the api checks the base), on the last definition
// read (its starting value before any read), to the on-call addresses of OPS_ALERT_RECIPIENTS, its
// states kept in memory and handed to the base when it comes back. Never throws; log lines carry
// codes and counts only (D60).
import { randomUUID } from "node:crypto";
import type { ProbeOrigins } from "../../config/schema.ts";
import {
  withElevatedTransaction,
  type WorkerDatabase,
} from "../../db/index.ts";
import type { TransactionalSender } from "../../platform/brevo-transactional.ts";
import {
  deliverTechnicalAlert,
  type AlertDeliveryLogger,
} from "./alert-delivery.ts";
import {
  adminAlertRecipients,
  beginAlertRound,
  recordDatabaseSample,
  recordProbeResults,
  recordWorkerHeartbeat,
  saveAlertStates,
  technicalAlertSnapshot,
} from "./repository.ts";
import {
  applyRound,
  DEFAULT_AL49_DEFINITION,
  evaluateSnapshot,
  newErrorDecision,
  PROBE_HISTORY_LENGTH,
  recipientsOf,
  siteUnreachableConditions,
  slowPageConditions,
  undelivered,
  type AlertCondition,
  type AlertDefinition,
  type AlertNotification,
  type ErrorGroupSighting,
  type ProbeResult,
  type ProbeTarget,
  type StoredAlertState,
} from "./technical-alerts.ts";
import { probeAll } from "./probe.ts";

/** 02 §20.5: the probe and the alerts, every minute. */
export const MONITOR_INTERVAL_MS = 60_000;
/** The beat of the drain, at most this often (02 §11.3: a beat at each turn, 60 s of tolerance). */
export const HEARTBEAT_MIN_INTERVAL_MS = 10_000;
/** The beat while a long step runs. */
export const HEARTBEAT_KEEPALIVE_MS = 15_000;
/** Results kept for the base while it is away: an hour of rounds (0147 refuses older ones). */
export const PENDING_PROBE_RESULTS_MAX = 240;
const PENDING_PROBE_MAX_AGE_MS = 55 * 60_000;
/** AL51 before any watermark: the groups of the last minutes only, not the whole history. */
const FIRST_WATERMARK_LOOKBACK_MS = 10 * 60_000;

export type MonitorLogger = AlertDeliveryLogger;

// ---------------------------------------------------------------------------------------------
// Heartbeat
// ---------------------------------------------------------------------------------------------

export type Heartbeat = {
  /** After a turn of the drain; at most every HEARTBEAT_MIN_INTERVAL_MS. Never throws. */
  turned(): Promise<void>;
  /** Beats every HEARTBEAT_KEEPALIVE_MS while `work` runs (a long step is no stopped worker). */
  during<T>(work: () => Promise<T>): Promise<T>;
};

export type HeartbeatDependencies = {
  database: WorkerDatabase;
  workerId: string;
  instance: string;
  version: string;
  startedAt: string;
  logger: MonitorLogger;
  /** Milliseconds since an arbitrary origin. */
  elapsed: () => number;
};

export function createHeartbeat(
  dependencies: HeartbeatDependencies,
): Heartbeat {
  let lastTurnBeat = Number.NEGATIVE_INFINITY;
  let failing = false;

  async function beat(loopTurned: boolean): Promise<void> {
    try {
      await withElevatedTransaction(
        dependencies.database,
        "maintenance.run_periodic",
        randomUUID(),
        async (tx) => {
          await recordWorkerHeartbeat(tx, {
            workerId: dependencies.workerId,
            instance: dependencies.instance,
            version: dependencies.version,
            startedAt: dependencies.startedAt,
            loopTurned,
          });
          return { value: undefined, auditSubject: null };
        },
      );
      if (failing) {
        failing = false;
        dependencies.logger.info({}, "ops.heartbeat.restored");
      }
    } catch {
      if (!failing) {
        failing = true;
        dependencies.logger.warn(
          { failureCode: "database_unavailable" },
          "ops.heartbeat.failed",
        );
      }
    }
  }

  return {
    async turned() {
      const at = dependencies.elapsed();
      if (at - lastTurnBeat < HEARTBEAT_MIN_INTERVAL_MS) {
        return;
      }
      lastTurnBeat = at;
      await beat(true);
    },
    async during(work) {
      let beating: Promise<void> = Promise.resolve();
      const timer = setInterval(() => {
        beating = beating.then(() => beat(false));
      }, HEARTBEAT_KEEPALIVE_MS);
      try {
        return await work();
      } finally {
        clearInterval(timer);
        await beating;
      }
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Probe and alerts
// ---------------------------------------------------------------------------------------------

export type WorkerMonitorDependencies = {
  database: WorkerDatabase;
  /** The targets of the probe; null in development when unset (no probe, no AL49 nor AL54). */
  probe: ProbeOrigins | null;
  sender: TransactionalSender;
  onCallRecipients: readonly string[];
  instance: string;
  logger: MonitorLogger;
  fetch?: typeof fetch;
  now?: () => Date;
  elapsed?: () => number;
  /** Resolves after `ms`, or as soon as `signal` aborts; never rejects. */
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
};

export type WorkerMonitor = {
  /** One round: probe, base, alerts. Never throws. */
  tick(): Promise<void>;
  /** A round every minute until `signal` aborts. */
  run(signal: AbortSignal): Promise<void>;
};

/** A planned e-mail, with what to write back when it reaches nobody. */
type PlannedDelivery = {
  notification: AlertNotification;
  definition: AlertDefinition;
  groups?: {
    newGroups: readonly ErrorGroupSighting[];
    regressions: readonly ErrorGroupSighting[];
    digest: boolean;
  };
  /** The state written for it, and the one before (undelivered: written back). */
  saved?: StoredAlertState;
  before?: StoredAlertState;
};

type DatabaseRound =
  | { kind: "elsewhere" }
  | { kind: "planned"; deliveries: PlannedDelivery[]; admins: string[] };

function keyOf(state: { code: string; subjectKey: string }): string {
  return `${state.code}\u0000${state.subjectKey}`;
}

/** Hands the states decided without the base to those of the base (the later notification wins). */
export function mergeMemoryStates(
  previous: readonly StoredAlertState[],
  memory: readonly StoredAlertState[],
): StoredAlertState[] {
  const merged = new Map(previous.map((state) => [keyOf(state), state]));
  for (const state of memory) {
    const known = merged.get(keyOf(state));
    if (
      known === undefined ||
      Date.parse(state.lastNotifiedAt ?? state.openedAt) >
        Date.parse(known.lastNotifiedAt ?? known.openedAt)
    ) {
      merged.set(keyOf(state), state);
    }
  }
  return [...merged.values()];
}

function scalarOf(
  state: StoredAlertState | undefined,
  member: string,
): string | null {
  const value = state?.lastValue?.[member];
  return typeof value === "string" ? value : null;
}

export function createWorkerMonitor(
  dependencies: WorkerMonitorDependencies,
): WorkerMonitor {
  const now = dependencies.now ?? (() => new Date());
  const elapsed = dependencies.elapsed ?? (() => performance.now());
  const history: Partial<Record<ProbeTarget, ProbeResult[]>> = {};
  let pending: ProbeResult[] = [];
  let memoryStates: StoredAlertState[] = [];
  let al49Definition: AlertDefinition = DEFAULT_AL49_DEFINITION;
  let databaseAway = false;

  function remember(results: readonly ProbeResult[]): void {
    for (const result of results) {
      const kept = [...(history[result.target] ?? []), result];
      history[result.target] = kept.slice(-PROBE_HISTORY_LENGTH);
    }
    const oldest = now().getTime() - PENDING_PROBE_MAX_AGE_MS;
    pending = [...pending, ...results]
      .filter((result) => Date.parse(result.checkedAt) >= oldest)
      .slice(-PENDING_PROBE_RESULTS_MAX);
  }

  async function databaseRound(): Promise<DatabaseRound> {
    const recorded = pending.length;
    const round = await withElevatedTransaction(
      dependencies.database,
      "maintenance.run_periodic",
      randomUUID(),
      async (tx): Promise<{ value: DatabaseRound; auditSubject: null }> => {
        if (recorded > 0) {
          await recordProbeResults(
            tx,
            dependencies.instance,
            pending.slice(0, recorded),
          );
        }
        await recordDatabaseSample(tx);
        const stored = await beginAlertRound(tx, "worker");
        if (stored === null) {
          return { value: { kind: "elsewhere" }, auditSubject: null };
        }
        const previous = mergeMemoryStates(stored, memoryStates);
        const watermark = previous.find(
          (state) => state.code === "AL51" && state.subjectKey === "watermark",
        );
        const digestState = previous.find(
          (state) => state.code === "AL51" && state.subjectKey === "digest",
        );
        const since =
          scalarOf(watermark, "seenUntil") ??
          new Date(now().getTime() - FIRST_WATERMARK_LOOKBACK_MS).toISOString();
        const snapshot = await technicalAlertSnapshot(tx, since);
        const at = new Date(snapshot.now);
        const definitions = snapshot.definitions;
        al49Definition = definitions.AL49 ?? al49Definition;

        const conditions: AlertCondition[] = [];
        const evaluated = new Set<string>();
        for (const [code, list] of [
          ["AL49", siteUnreachableConditions(al49Definition, history)],
          [
            "AL54",
            definitions.AL54 === undefined
              ? null
              : slowPageConditions(definitions.AL54, history),
          ],
        ] as const) {
          if (list !== null && dependencies.probe !== null) {
            evaluated.add(code);
            conditions.push(...list);
          }
        }
        for (const evaluation of evaluateSnapshot(snapshot)) {
          evaluated.add(evaluation.code);
          conditions.push(...evaluation.conditions);
        }
        const outcome = applyRound(
          previous,
          conditions,
          { ...definitions, AL49: al49Definition },
          evaluated,
          at,
        );
        const savedByKey = new Map(
          outcome.states.map((state) => [keyOf(state), state]),
        );
        const beforeByKey = new Map(
          previous.map((state) => [keyOf(state), state]),
        );
        const deliveries: PlannedDelivery[] = outcome.notifications.flatMap(
          (notification) => {
            const definition =
              notification.code === "AL49"
                ? al49Definition
                : definitions[notification.code];
            if (definition === undefined) {
              return [];
            }
            const saved = savedByKey.get(keyOf(notification));
            const before = beforeByKey.get(keyOf(notification));
            return [
              {
                notification,
                definition,
                ...(saved === undefined ? {} : { saved }),
                ...(before === undefined ? {} : { before }),
              },
            ];
          },
        );
        const states = [...outcome.states];

        // AL51: one e-mail for the round's new groups and regressions; the digest once a day.
        const al51 = definitions.AL51;
        const sightings = snapshot.measures.AL51;
        if (al51 !== undefined && sightings !== undefined) {
          const decision = newErrorDecision(
            al51,
            sightings,
            scalarOf(digestState, "lastDigestDay"),
            at,
          );
          const nextWatermark: StoredAlertState = {
            code: "AL51",
            subjectKey: "watermark",
            state: "open",
            openedAt: watermark?.openedAt ?? snapshot.now,
            lastNotifiedAt: watermark?.lastNotifiedAt ?? null,
            notifiedCount: watermark?.notifiedCount ?? 0,
            resolvedAt: null,
            lastValue: { seenUntil: snapshot.now },
          };
          states.push(nextWatermark);
          if (decision.immediate !== null) {
            deliveries.push({
              notification: {
                code: "AL51",
                subjectKey: `round:${since}`,
                kind: "raised",
                openedAt: snapshot.now,
                sequence: 1,
                value: {},
              },
              definition: al51,
              groups: { ...decision.immediate, digest: false },
              saved: nextWatermark,
              ...(watermark === undefined ? {} : { before: watermark }),
            });
          }
          if (decision.digestDue) {
            const day = snapshot.now.slice(0, 10);
            const from = new Date(
              at.getTime() - decision.digestWindowHours * 3_600_000,
            ).toISOString();
            const digest = await technicalAlertSnapshot(tx, from);
            const nextDigest: StoredAlertState = {
              code: "AL51",
              subjectKey: "digest",
              state: "open",
              openedAt: digestState?.openedAt ?? snapshot.now,
              lastNotifiedAt: snapshot.now,
              notifiedCount: (digestState?.notifiedCount ?? 0) + 1,
              resolvedAt: null,
              lastValue: { lastDigestDay: day },
            };
            states.push(nextDigest);
            const groups = digest.measures.AL51?.newGroups ?? [];
            if (groups.length > 0) {
              deliveries.push({
                notification: {
                  code: "AL51",
                  subjectKey: `digest:${day}`,
                  kind: "raised",
                  openedAt: snapshot.now,
                  sequence: 1,
                  value: {},
                },
                definition: al51,
                groups: { newGroups: groups, regressions: [], digest: true },
                saved: nextDigest,
                ...(digestState === undefined ? {} : { before: digestState }),
              });
            }
          }
        }

        await saveAlertStates(tx, "worker", states);
        const needsAdmins = deliveries.some((delivery) =>
          delivery.definition.recipientRoles.includes("admin"),
        );
        const admins = needsAdmins ? await adminAlertRecipients(tx) : [];
        return {
          value: { kind: "planned", deliveries, admins },
          auditSubject: null,
        };
      },
    );
    // Written and committed: these results are in the base.
    pending = pending.slice(recorded);
    memoryStates = [];
    return round;
  }

  /** AL49 alone, on the probe in memory, to the on-call addresses (02 §20.9, "Base injoignable"). */
  async function roundWithoutDatabase(at: Date): Promise<void> {
    const conditions = siteUnreachableConditions(al49Definition, history);
    if (conditions === null || dependencies.probe === null) {
      return;
    }
    const outcome = applyRound(
      memoryStates,
      conditions,
      { AL49: al49Definition },
      new Set(["AL49"]),
      at,
    );
    const before = new Map(memoryStates.map((state) => [keyOf(state), state]));
    const next = new Map(before);
    for (const state of outcome.states) {
      next.set(keyOf(state), state);
    }
    for (const notification of outcome.notifications) {
      const delivered = await deliver(
        { notification, definition: al49Definition },
        dependencies.onCallRecipients,
        at,
      );
      const saved = next.get(keyOf(notification));
      if (
        !delivered &&
        notification.kind !== "resolved" &&
        saved !== undefined
      ) {
        next.set(keyOf(saved), undelivered(saved, before.get(keyOf(saved))));
      }
    }
    memoryStates = [...next.values()];
  }

  async function deliver(
    delivery: PlannedDelivery,
    recipients: readonly string[],
    observedAt: Date,
  ): Promise<boolean> {
    const { notification } = delivery;
    return deliverTechnicalAlert(
      dependencies,
      {
        code: notification.code,
        kind: notification.kind,
        sequence: notification.sequence,
        openedAt: new Date(notification.openedAt),
        observedAt,
        value: notification.value,
        ...(delivery.groups === undefined ? {} : { groups: delivery.groups }),
      },
      notification.subjectKey,
      recipients,
    );
  }

  /** The states of the e-mails that reached nobody go back, to be sent at the next round. */
  async function keepUndelivered(
    states: readonly StoredAlertState[],
  ): Promise<void> {
    if (states.length === 0) {
      return;
    }
    try {
      await withElevatedTransaction(
        dependencies.database,
        "maintenance.run_periodic",
        randomUUID(),
        async (tx) => {
          if ((await beginAlertRound(tx, "worker")) !== null) {
            await saveAlertStates(tx, "worker", states);
          }
          return { value: undefined, auditSubject: null };
        },
      );
    } catch {
      dependencies.logger.warn(
        { failureCode: "database_unavailable" },
        "ops.monitor.undelivered_not_kept",
      );
    }
  }

  async function tick(): Promise<void> {
    try {
      if (dependencies.probe !== null) {
        remember(
          await probeAll(dependencies.probe, {
            fetch: dependencies.fetch ?? fetch,
            now,
            elapsed,
          }),
        );
      }
      let round: DatabaseRound;
      try {
        round = await databaseRound();
        if (databaseAway) {
          databaseAway = false;
          dependencies.logger.info({}, "ops.monitor.database_restored");
        }
      } catch {
        if (!databaseAway) {
          databaseAway = true;
          dependencies.logger.warn(
            { failureCode: "database_unavailable" },
            "ops.monitor.database_unavailable",
          );
        }
        await roundWithoutDatabase(now());
        return;
      }
      if (round.kind === "elsewhere") {
        return;
      }
      const undeliveredStates: StoredAlertState[] = [];
      const observedAt = now();
      for (const delivery of round.deliveries) {
        const delivered = await deliver(
          delivery,
          recipientsOf(
            delivery.definition,
            dependencies.onCallRecipients,
            round.admins,
          ),
          observedAt,
        );
        if (
          !delivered &&
          delivery.notification.kind !== "resolved" &&
          delivery.saved !== undefined
        ) {
          undeliveredStates.push(
            delivery.groups === undefined
              ? undelivered(delivery.saved, delivery.before)
              : // AL51: the watermark (or the digest day) goes back, the groups come again.
                (delivery.before ?? {
                  ...delivery.saved,
                  lastValue: {},
                }),
          );
        }
      }
      await keepUndelivered(undeliveredStates);
    } catch (error) {
      // Unreachable by construction (every step catches); kept so that the loop never stops.
      dependencies.logger.warn(
        { failureCode: error instanceof Error ? error.name : "unknown" },
        "ops.monitor.round_failed",
      );
    }
  }

  return {
    tick,
    async run(signal) {
      while (!signal.aborted) {
        await tick();
        await dependencies.sleep(MONITOR_INTERVAL_MS, signal);
      }
    },
  };
}
