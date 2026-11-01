// The api watches the worker (02 §11.3, §20.5; 15 RG165, AL50 "worker stopped"): no service watches
// itself. Every 60 s, on the ops pool (E-6, influx_ops, no business read), one instance at a time
// under the advisory lock of the scope `api` (ops.begin_alert_round, 0147): the last beat, the
// state of AL50, the e-mail AFTER the transaction (G4), directly to Brevo by the api's sender
// (D43), to the on-call addresses of OPS_ALERT_RECIPIENTS only (RG165: AL50 is on_call alone).
// An unreachable base is no stopped worker: nothing is decided, the worker's probe of /health
// raises AL49. Never throws; a log line carries codes and counts only (D60).
import { randomUUID } from "node:crypto";
import { withElevatedTransaction, type ApiDatabase } from "../../db/index.ts";
import type { TransactionalSender } from "../../platform/brevo-transactional.ts";
import {
  deliverTechnicalAlert,
  type AlertDeliveryLogger,
} from "./alert-delivery.ts";
import {
  beginAlertRound,
  saveAlertStates,
  workerLiveness,
} from "./repository.ts";
import {
  applyRound,
  undelivered,
  workerStoppedCondition,
  type AlertNotification,
  type StoredAlertState,
} from "./technical-alerts.ts";

/** 02 §20.5: the api looks at the beat of the worker every 60 s. */
export const WORKER_WATCH_INTERVAL_MS = 60_000;

export type WorkerWatchDependencies = {
  database: ApiDatabase;
  sender: TransactionalSender;
  onCallRecipients: readonly string[];
  logger: AlertDeliveryLogger;
  now?: () => Date;
};

type PlannedRound = {
  notifications: AlertNotification[];
  saved: StoredAlertState[];
  previous: readonly StoredAlertState[];
};

/** One look; returns whether this instance held the lock. */
export async function watchWorkerOnce(
  dependencies: WorkerWatchDependencies,
): Promise<boolean> {
  const now = dependencies.now ?? (() => new Date());
  let planned: PlannedRound | null;
  try {
    planned = await withElevatedTransaction(
      dependencies.database,
      "ops.record_telemetry",
      randomUUID(),
      async (tx) => {
        const previous = await beginAlertRound(tx, "api");
        if (previous === null) {
          return { value: null, auditSubject: null };
        }
        const liveness = await workerLiveness(tx);
        const condition = workerStoppedCondition(liveness);
        const definition = liveness.definition;
        if (condition === null || definition === null) {
          return {
            value: { notifications: [], saved: [], previous },
            auditSubject: null,
          };
        }
        const round = applyRound(
          previous,
          [condition],
          { AL50: definition },
          new Set(["AL50"]),
          new Date(liveness.now),
        );
        await saveAlertStates(tx, "api", round.states);
        // E-6: no business subject is written, no audit line (03 P7).
        return {
          value: {
            notifications: round.notifications,
            saved: round.states,
            previous,
          },
          auditSubject: null,
        };
      },
    );
  } catch {
    dependencies.logger.warn(
      { failureCode: "database_unavailable" },
      "ops.worker_watch.skipped",
    );
    return false;
  }
  if (planned === null) {
    return false;
  }
  const failed: StoredAlertState[] = [];
  for (const notification of planned.notifications) {
    const delivered = await deliverTechnicalAlert(
      dependencies,
      {
        code: notification.code,
        kind: notification.kind,
        sequence: notification.sequence,
        openedAt: new Date(notification.openedAt),
        observedAt: now(),
        value: notification.value,
      },
      notification.subjectKey,
      dependencies.onCallRecipients,
    );
    const saved = planned.saved.find(
      (state) =>
        state.code === notification.code &&
        state.subjectKey === notification.subjectKey,
    );
    if (!delivered && notification.kind !== "resolved" && saved !== undefined) {
      failed.push(
        undelivered(
          saved,
          planned.previous.find(
            (state) =>
              state.code === saved.code &&
              state.subjectKey === saved.subjectKey,
          ),
        ),
      );
    }
  }
  if (failed.length > 0) {
    await markUndelivered(dependencies, failed);
  }
  return true;
}

/** A notification that reached nobody is sent again at the next look (technical-alerts.ts). */
async function markUndelivered(
  dependencies: WorkerWatchDependencies,
  states: readonly StoredAlertState[],
): Promise<void> {
  try {
    await withElevatedTransaction(
      dependencies.database,
      "ops.record_telemetry",
      randomUUID(),
      async (tx) => {
        if ((await beginAlertRound(tx, "api")) !== null) {
          await saveAlertStates(tx, "api", states);
        }
        return { value: undefined, auditSubject: null };
      },
    );
  } catch {
    dependencies.logger.warn(
      { failureCode: "database_unavailable" },
      "ops.worker_watch.undelivered_not_kept",
    );
  }
}

export type WorkerWatch = { stop(): Promise<void> };

/** Starts the look every 60 s, the first one after a full interval (the worker may be starting). */
export function startWorkerWatch(
  dependencies: WorkerWatchDependencies,
): WorkerWatch {
  let running: Promise<unknown> = Promise.resolve();
  const timer = setInterval(() => {
    running = running.then(() => watchWorkerOnce(dependencies));
  }, WORKER_WATCH_INTERVAL_MS);
  timer.unref();
  return {
    async stop() {
      clearInterval(timer);
      await running;
    },
  };
}
