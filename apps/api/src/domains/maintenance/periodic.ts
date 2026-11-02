// E-4 `maintenance.run_periodic` in the loop of the worker (decision 3 of the J7 start; 03 P7; 05
// RG91, 16 RG113, 04 §9; decision 2 for the 30-day purge). Between two turns of the drain, at most
// once a minute, each task whose period is due is CLAIMED: ops.claim_periodic_run() keeps one line
// per (task, period), so a period runs once whatever the number of worker instances; a run left
// unfinished for an hour is taken back by any instance (attempt + 1, the fencing token of every
// later call).
//
//   brevo_reconciliation   daily (UTC), from 03:00 UTC (brevo-reconciliation.ts)
//   auth_orphan_purge      hourly (auth-orphan-purge.ts)
//   brevo_inbound_purge    daily: the raw Brevo lines 30 days after their outcome
//   data_export_purge      hourly: the content of an export expired or downloaded three times
//                          (runbook demandes-rgpd §4, J8 commit 8), its digest kept
//   ops_retention          daily: the hourly roll-up of the metrics of D60 and the purges of ops
//                          (02 §20.5, §20.8; 0147, J9 commit 8), by bounded steps
//   storage_purge          hourly: the objects of Storage of the logo rows to purge, then the rows
//                          (0205, L2B commit 09; storage-purge.ts)
//
// A task without its key in this process (no Brevo key, no GoTrue key) is never claimed. A task
// that fails closes its run `failed` with the counts reached and a closed code in pino (D60): the
// next period runs again (the 48-hour window of the reconciliation covers a missed day). A stop
// requested during a run leaves it open: another instance takes it back after an hour.
// Register (decision 1): one elevated.maintenance.run_periodic line on the run per transaction with
// an effect (the claim, new raw lines, a purge); none for a read or the closing of the run (EC-52).
import { randomUUID } from "node:crypto";
import {
  withElevatedTransaction,
  type ElevatedResult,
  type Transaction,
  type WorkerDatabase,
} from "../../db/index.ts";
import { sqlStateOf } from "../../db/sql-state.ts";
import {
  claimPeriodicRun,
  filterAuthOrphans,
  finishPeriodicRun,
  gotrueRealignmentCandidates,
  PERIODIC_TASKS,
  claimStoragePurges,
  completeStoragePurges,
  purgeBrevoInboundEvents,
  purgeDataExports,
  purgeStorageUsage,
  recordAuthOrphanPurge,
  runOpsRetention,
  recordReconciliationEvent,
  type PeriodicCounts,
  type PeriodicRun,
  type PeriodicTask,
  type RealignmentCandidate,
  type ReconciliationFinding,
  type StoragePurgeCandidate,
} from "./repository.ts";

export {
  PERIODIC_TASKS,
  type PeriodicCounts,
  type PeriodicRun,
  type PeriodicTask,
  type RealignmentCandidate,
  type ReconciliationFinding,
  type StoragePurgeCandidate,
} from "./repository.ts";

/** How often the loop looks for a due period. */
export const PERIODIC_CHECK_INTERVAL_MS = 60_000;
/** Decision 3: the reconciliation starts after 03:00 UTC. */
export const RECONCILIATION_START_HOUR_UTC = 3;
/** A period claimed elsewhere (running or finished) is looked at again after this delay. */
export const CLAIMED_ELSEWHERE_BACKOFF_MS = 15 * 60_000;
/** Raw lines written per transaction of the reconciliation. */
export const FINDINGS_PER_TRANSACTION = 500;
/** Decision 2: raw lines deleted per call, and calls per run at most. */
export const INBOUND_PURGE_BATCH = 1_000;
export const INBOUND_PURGE_MAX_BATCHES = 20;
/** Exports emptied per call, and calls per run at most (a handful a day at the Lot 1). */
export const EXPORT_PURGE_BATCH = 100;
export const EXPORT_PURGE_MAX_BATCHES = 10;
/** Bounded steps of the retention of ops per run; beyond, the next day goes on (0147). */
export const OPS_RETENTION_MAX_STEPS = 50;

const INVALID_PARAMETER_VALUE = "22023";

/** The E-4 calls of the worker, each its own short elevated transaction. */
export type PeriodicStore = {
  claim(task: PeriodicTask, periodKey: string): Promise<PeriodicRun | null>;
  finish(
    run: PeriodicRun,
    outcome: "succeeded" | "failed",
    counts: PeriodicCounts,
  ): Promise<boolean>;
  /** Raw lines of the reconciliation; a value the database refuses (22023) is counted, skipped. */
  recordFindings(
    run: PeriodicRun,
    findings: readonly ReconciliationFinding[],
  ): Promise<{ recorded: number; refused: number }>;
  filterAuthOrphans(
    run: PeriodicRun,
    authUserIds: readonly string[],
  ): Promise<string[]>;
  recordAuthOrphanPurge(run: PeriodicRun, count: number): Promise<void>;
  /** C5.b (0125): the accounts to realign at GoTrue, or the one named, read again. */
  realignmentCandidates(
    run: PeriodicRun,
    accountId: string | null,
  ): Promise<RealignmentCandidate[]>;
  purgeBrevoInbound(run: PeriodicRun, limit: number): Promise<number>;
  purgeDataExports(run: PeriodicRun, limit: number): Promise<number>;
  /** One bounded step of ops.run_ops_retention() (0147): its counts, `more` = 1 to go on. */
  opsRetentionStep(run: PeriodicRun): Promise<PeriodicCounts>;
  /** 0205: logo rows whose object is to remove (their attempt counted). */
  claimStoragePurges(
    run: PeriodicRun,
    limit: number,
  ): Promise<StoragePurgeCandidate[]>;
  /** 0205: the rows whose object is removed, deleted; the count. */
  completeStoragePurges(
    run: PeriodicRun,
    logoIds: readonly string[],
  ): Promise<number>;
  /** 0205: the daily usage older than 7 days, deleted; the count. */
  purgeStorageUsage(run: PeriodicRun): Promise<number>;
};

export function createPeriodicStore(database: WorkerDatabase): PeriodicStore {
  function elevated<T>(
    body: (tx: Transaction) => Promise<ElevatedResult<T>>,
  ): Promise<T> {
    return withElevatedTransaction(
      database,
      "maintenance.run_periodic",
      randomUUID(),
      body,
    );
  }

  return {
    claim: (task, periodKey) =>
      elevated(async (tx) => {
        const run = await claimPeriodicRun(tx, task, periodKey);
        return { value: run, auditSubject: run?.runId ?? null };
      }),

    finish: (run, outcome, counts) =>
      elevated(async (tx) => ({
        value: await finishPeriodicRun(tx, run, outcome, counts),
        auditSubject: null,
      })),

    async recordFindings(run, findings) {
      let recorded = 0;
      let refused = 0;
      for (
        let start = 0;
        start < findings.length;
        start += FINDINGS_PER_TRANSACTION
      ) {
        const batch = findings.slice(start, start + FINDINGS_PER_TRANSACTION);
        const written = await elevated(async (tx) => {
          let batchRecorded = 0;
          for (const finding of batch) {
            try {
              // A savepoint per line: a refused value leaves the others standing.
              const id = await tx.transaction((savepoint) =>
                recordReconciliationEvent(savepoint, finding),
              );
              if (id !== null) {
                batchRecorded += 1;
              }
            } catch (error) {
              if (sqlStateOf(error) !== INVALID_PARAMETER_VALUE) {
                throw error;
              }
              refused += 1;
            }
          }
          return {
            value: batchRecorded,
            auditSubject: batchRecorded > 0 ? run.runId : null,
          };
        });
        recorded += written;
      }
      return { recorded, refused };
    },

    filterAuthOrphans: (run, authUserIds) =>
      elevated(async (tx) => ({
        value: await filterAuthOrphans(tx, run, authUserIds),
        auditSubject: null,
      })),

    recordAuthOrphanPurge: (run, count) =>
      elevated(async (tx) => {
        await recordAuthOrphanPurge(tx, run, count);
        return { value: undefined, auditSubject: run.runId };
      }),

    realignmentCandidates: (run, accountId) =>
      elevated(async (tx) => ({
        value: await gotrueRealignmentCandidates(tx, run, accountId),
        auditSubject: null,
      })),

    purgeBrevoInbound: (run, limit) =>
      elevated(async (tx) => {
        const count = await purgeBrevoInboundEvents(tx, run, limit);
        return { value: count, auditSubject: count > 0 ? run.runId : null };
      }),

    purgeDataExports: (run, limit) =>
      elevated(async (tx) => {
        const count = await purgeDataExports(tx, run, limit);
        return { value: count, auditSubject: count > 0 ? run.runId : null };
      }),

    opsRetentionStep: (run) =>
      elevated(async (tx) => {
        const counts = await runOpsRetention(tx, run);
        const effect = Object.entries(counts).some(
          ([name, value]) => name !== "more" && value > 0,
        );
        return { value: counts, auditSubject: effect ? run.runId : null };
      }),

    claimStoragePurges: (run, limit) =>
      elevated(async (tx) => {
        const claimed = await claimStoragePurges(tx, run, limit);
        return {
          value: claimed,
          auditSubject: claimed.length > 0 ? run.runId : null,
        };
      }),

    completeStoragePurges: (run, logoIds) =>
      elevated(async (tx) => {
        const count = await completeStoragePurges(tx, run, logoIds);
        return { value: count, auditSubject: count > 0 ? run.runId : null };
      }),

    purgeStorageUsage: (run) =>
      elevated(async (tx) => {
        const count = await purgeStorageUsage(tx, run);
        return { value: count, auditSubject: count > 0 ? run.runId : null };
      }),
  };
}

/** The codes of the breaker of the GoTrue purge (auth-orphan-purge.ts, J7S-2). */
const BREAKER_CODE_PREFIX = "breaker.";

/** A task that stops: its closed code goes to pino, the run is closed `failed`. */
export class PeriodicTaskError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "PeriodicTaskError";
    this.code = code;
  }
}

/** A stop requested during a run: the run is left open, taken back after an hour. */
export class PeriodicRunInterrupted extends Error {
  constructor() {
    super("periodic run interrupted");
    this.name = "PeriodicRunInterrupted";
  }
}

/** Throws PeriodicRunInterrupted once a stop is requested; called between two steps of a task. */
export function checkNotStopped(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new PeriodicRunInterrupted();
  }
}

/**
 * One task: runs the claimed `run`, writing its counts into `counts` as it goes (they are kept
 * when it fails).
 */
export type PeriodicTaskRunner = (
  run: PeriodicRun,
  counts: PeriodicCounts,
  signal: AbortSignal,
) => Promise<void>;

/** The hourly tasks; the others run once a day. */
const HOURLY_TASKS: ReadonlySet<PeriodicTask> = new Set([
  "auth_orphan_purge",
  "data_export_purge",
  "storage_purge",
]);

/** The UTC period of a task at `now`: YYYY-MM-DD, or YYYY-MM-DDTHH for an hourly purge (0117). */
export function periodKeyOf(task: PeriodicTask, now: number): string {
  const iso = new Date(now).toISOString();
  return HOURLY_TASKS.has(task) ? iso.slice(0, 13) : iso.slice(0, 10);
}

/** Whether a task may run at `now` (the reconciliation waits for its hour). */
export function isDue(
  task: PeriodicTask,
  now: number,
  reconciliationStartHourUtc: number,
): boolean {
  return (
    task !== "brevo_reconciliation" ||
    new Date(now).getUTCHours() >= reconciliationStartHourUtc
  );
}

/** The closed code of a failure (D60: never a message nor a value). */
function failureCodeOf(error: unknown): string {
  if (error instanceof PeriodicTaskError) {
    return error.code;
  }
  if (
    error instanceof Error &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[a-z_]+\.[a-z_]+$/.test(error.code)
  ) {
    return error.code;
  }
  return "internal";
}

export type PeriodicLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type PeriodicScheduler = {
  /** Every due task of this process, one after the other; never throws. */
  tick(signal: AbortSignal): Promise<void>;
};

export function createPeriodicScheduler(dependencies: {
  store: PeriodicStore;
  /** The tasks this process can run; a missing one is never claimed. */
  runners: Partial<Record<PeriodicTask, PeriodicTaskRunner>>;
  logger: PeriodicLogger;
  now: () => number;
  reconciliationStartHourUtc?: number;
}): PeriodicScheduler {
  const { store, runners, logger, now } = dependencies;
  const startHour =
    dependencies.reconciliationStartHourUtc ?? RECONCILIATION_START_HOUR_UTC;
  /** Per task: the period this process closed, or until when a period claimed elsewhere waits. */
  const settled = new Map<PeriodicTask, string>();
  const waitUntil = new Map<PeriodicTask, number>();

  async function runTask(
    task: PeriodicTask,
    runner: PeriodicTaskRunner,
    signal: AbortSignal,
  ): Promise<void> {
    const at = now();
    const periodKey = periodKeyOf(task, at);
    if (
      settled.get(task) === periodKey ||
      (waitUntil.get(task) ?? 0) > at ||
      !isDue(task, at, startHour)
    ) {
      return;
    }
    const run = await store.claim(task, periodKey);
    if (run === null) {
      waitUntil.set(task, at + CLAIMED_ELSEWHERE_BACKOFF_MS);
      return;
    }
    const counts: PeriodicCounts = {};
    let outcome: "succeeded" | "failed" = "succeeded";
    try {
      await runner(run, counts, signal);
    } catch (error) {
      if (error instanceof PeriodicRunInterrupted) {
        logger.warn(
          { task, runId: run.runId, attempt: run.attempt },
          "maintenance.periodic.interrupted",
        );
        return;
      }
      outcome = "failed";
      const errorCode = failureCodeOf(error);
      // AL60 (15 RG165): a stop by the breaker of the GoTrue purge (J7S-2) is counted on its run,
      // the trace the base keeps of it (0117 counts are snake_case: breaker.x is breaker_x).
      if (errorCode.startsWith(BREAKER_CODE_PREFIX)) {
        counts[`breaker_${errorCode.slice(BREAKER_CODE_PREFIX.length)}`] = 1;
      }
      logger.error(
        {
          task,
          runId: run.runId,
          attempt: run.attempt,
          errorCode,
        },
        "maintenance.periodic.failed",
      );
    }
    const closed = await store.finish(run, outcome, counts);
    settled.set(task, periodKey);
    if (!closed) {
      // Taken back by another instance meanwhile: its attempt writes the outcome.
      logger.warn(
        { task, runId: run.runId, attempt: run.attempt },
        "maintenance.periodic.taken_back",
      );
      return;
    }
    logger.info(
      { task, runId: run.runId, attempt: run.attempt, outcome, counts },
      "maintenance.periodic.finished",
    );
  }

  return {
    async tick(signal) {
      for (const task of PERIODIC_TASKS) {
        const runner = runners[task];
        if (runner === undefined || signal.aborted) {
          continue;
        }
        try {
          await runTask(task, runner, signal);
        } catch (error) {
          // The claim or the closing failed (database): the next tick tries again.
          logger.error(
            { task, err: error },
            "maintenance.periodic.tick_failed",
          );
        }
      }
    },
  };
}

/** Runbook §4: the exports past their first deadline (7 days, or 3 downloads), by batches. */
export function createDataExportPurge(
  store: PeriodicStore,
): PeriodicTaskRunner {
  return async (run, counts, signal) => {
    counts.purged = 0;
    for (let batch = 0; batch < EXPORT_PURGE_MAX_BATCHES; batch += 1) {
      checkNotStopped(signal);
      const purged = await store.purgeDataExports(run, EXPORT_PURGE_BATCH);
      counts.purged += purged;
      if (purged < EXPORT_PURGE_BATCH) {
        return;
      }
    }
  };
}

/**
 * 0147: the retention of ops (02 §20.5, §20.8), by bounded steps, each in its own transaction, until
 * the database says there is no more; the counts of the steps are added up.
 */
export function createOpsRetention(store: PeriodicStore): PeriodicTaskRunner {
  return async (run, counts, signal) => {
    for (let step = 0; step < OPS_RETENTION_MAX_STEPS; step += 1) {
      checkNotStopped(signal);
      const stepCounts = await store.opsRetentionStep(run);
      for (const [name, value] of Object.entries(stepCounts)) {
        if (name !== "more") {
          counts[name] = (counts[name] ?? 0) + value;
        }
      }
      if ((stepCounts.more ?? 0) === 0) {
        return;
      }
    }
  };
}

/** Decision 2: the raw Brevo lines processed over 30 days ago, by batches. */
export function createBrevoInboundPurge(
  store: PeriodicStore,
): PeriodicTaskRunner {
  return async (run, counts, signal) => {
    counts.purged = 0;
    for (let batch = 0; batch < INBOUND_PURGE_MAX_BATCHES; batch += 1) {
      checkNotStopped(signal);
      const purged = await store.purgeBrevoInbound(run, INBOUND_PURGE_BATCH);
      counts.purged += purged;
      if (purged < INBOUND_PURGE_BATCH) {
        return;
      }
    }
  };
}
