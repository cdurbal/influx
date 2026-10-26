// Entry point of the Railway service `worker` (docs/mvp/02-architecture-3-espaces.md §11).
// J6: drains the outbox (E-3 `leads.drain_outbox`, src/domains/leads/drain.ts); J7: first processes
// what Brevo reported back (src/domains/leads/inbound/processing.ts), and, between two turns, the
// periodic tasks of E-4 (src/domains/maintenance/periodic.ts, J7 decision 3), then the "mes données"
// requests approved by an admin, on a pool of their own (E-5, src/domains/privacy/execution.ts, J8
// commit 8). It opens NO port.
// Started by `node apps/api/src/worker.ts` directly, so that SIGTERM reaches it (21 §4, J1-B):
// the turn in progress finishes, the lines not begun go back to pending (02 §11.2, TM1.10).
// Before the first turn, the start step (D68, then 05 RG162; 0146): the Brevo list ids of the
// environment, then the settings in force; a deployed environment refuses to start without those
// every sign-up needs (D67), with a non-zero exit code before the loop.
// Beside the drain, the active monitoring of D60 (02 §20.5, 15 RG165; domains/ops/
// worker-monitor.ts, J9 commit 8): the beat the api watches, the probe of the site every minute and the
// technical alerts, sent directly to Brevo with the worker's own key.
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import {
  ConfigError,
  loadWorkerConfig,
  type WorkerConfig,
} from "./config/index.ts";
import {
  closeDatabase,
  createWorkerDatabase,
  DatabaseRoleRefusedError,
  verifyPools,
  type WorkerDatabase,
} from "./db/index.ts";
import { sqlStateOf } from "./db/sql-state.ts";
import type { Connector } from "./domains/leads/connector.ts";
import { createApolloConnector } from "./domains/leads/connectors/apollo/index.ts";
import {
  createBrevoConnectors,
  type BrevoConnectorDependencies,
} from "./domains/leads/connectors/brevo/index.ts";
import { createOutboxDrain, workerIdentifier } from "./domains/leads/drain.ts";
import {
  createInboundProcessor,
  processInboundEvent,
} from "./domains/leads/inbound/processing.ts";
import {
  createWorkerQueue,
  readApolloSubjectOf,
  readBrevoErasureSubjectOf,
  readBrevoSubjectOf,
  startWorker,
} from "./domains/leads/queue.ts";
import type {
  OutboxDestination,
  WorkerStart,
} from "./domains/leads/repository.ts";
import { checkSettingsAtStart } from "./domains/leads/start-check.ts";
import { createAuthOrphanPurge } from "./domains/maintenance/auth-orphan-purge.ts";
import {
  createHeartbeat,
  createWorkerMonitor,
} from "./domains/ops/worker-monitor.ts";
import { createBrevoReads } from "./domains/maintenance/brevo-reads.ts";
import { createBrevoReconciliation } from "./domains/maintenance/brevo-reconciliation.ts";
import {
  createBrevoInboundPurge,
  createDataExportPurge,
  createOpsRetention,
  createPeriodicScheduler,
  createPeriodicStore,
  type PeriodicLogger,
  type PeriodicScheduler,
  type PeriodicTask,
  type PeriodicTaskRunner,
} from "./domains/maintenance/periodic.ts";
import { createPrivacyExecutor } from "./domains/privacy/execution.ts";
import { createTransactionalSender } from "./platform/brevo-transactional.ts";
import { createLogger } from "./platform/logger.ts";
import {
  createGoTrueUserDirectory,
  type GoTrueUserDirectory,
} from "./platform/supabase.ts";

/**
 * The connectors of this process: Brevo (J6 commit 4), with the worker's own key (EC-19), and
 * Apollo (commit 5), with APOLLO_API_KEY, the worker's only; without it, a qualified line fails
 * credentials_missing in a deployed environment (05 RG160), and is skipped_no_credentials in
 * development.
 */
function connectorsOf(
  config: WorkerConfig,
  database: WorkerDatabase,
  worker: string,
  logger: BrevoConnectorDependencies["logger"],
): Partial<Record<OutboxDestination, Connector>> {
  const brevo = createBrevoConnectors(
    {
      mode: config.brevo.mode,
      testRecipients: config.brevo.testRecipients,
      ...config.brevoTransport,
    },
    {
      readSubject: (line) =>
        readBrevoSubjectOf(database, randomUUID(), line, worker),
      readErasureSubject: (line) =>
        readBrevoErasureSubjectOf(database, randomUUID(), line, worker),
      logger,
    },
  );
  const apollo = createApolloConnector(config.apollo, {
    readSubject: (line) =>
      readApolloSubjectOf(database, randomUUID(), line, worker),
    logger,
  });
  return {
    brevo_contact: brevo.contact,
    brevo_transactional: brevo.transactional,
    apollo_contact: apollo,
  };
}

/**
 * E-4 (decision 3 of J7): the reconciliation with the worker's Brevo key, the purge of GoTrue with
 * its own secret key; a task without its key is never claimed. The 30-day purge, the purge of the
 * exports (J8 commit 8) and the retention of ops (J9 commit 8) need neither.
 */
function periodicSchedulerOf(
  config: WorkerConfig,
  database: WorkerDatabase,
  directory: GoTrueUserDirectory | null,
  logger: PeriodicLogger,
): PeriodicScheduler {
  const store = createPeriodicStore(database);
  const now = () => Date.now();
  const runners: Partial<Record<PeriodicTask, PeriodicTaskRunner>> = {
    brevo_inbound_purge: createBrevoInboundPurge(store),
    data_export_purge: createDataExportPurge(store),
    // 0147: the roll-up and the purges of the monitoring of D60 (02 §20.5, §20.8)
    ops_retention: createOpsRetention(store),
  };
  if (config.brevoTransport.apiKey !== null) {
    runners.brevo_reconciliation = createBrevoReconciliation({
      reads: createBrevoReads({
        apiKey: config.brevoTransport.apiKey,
        baseUrl: config.brevoTransport.baseUrl,
      }),
      store,
      now,
    });
  }
  if (directory !== null) {
    runners.auth_orphan_purge = createAuthOrphanPurge({
      directory,
      store,
      now,
    });
  }
  logger.info(
    { periodicTasks: Object.keys(runners).sort() },
    "periodic tasks configured",
  );
  return createPeriodicScheduler({ store, runners, logger, now });
}

function readConfig(): WorkerConfig | null {
  try {
    return loadWorkerConfig();
  } catch (error) {
    const logger = createLogger({
      service: "worker",
      environment: "unknown",
      version: "unknown",
    });
    if (error instanceof ConfigError) {
      logger.fatal(
        { issues: error.issues },
        "invalid configuration, refusing to start",
      );
    } else {
      logger.fatal({ err: error }, "configuration could not be read");
    }
    return null;
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Waits `ms`, or until `signal` aborts; never rejects on the abort. */
async function pause(ms: number, signal?: AbortSignal): Promise<void> {
  try {
    await sleep(ms, undefined, { signal });
  } catch (error) {
    if (!isAbort(error)) {
      throw error;
    }
  }
}

/** The wait between two start steps while the database cannot be reached. */
const START_RETRY_MS = 5_000;

/** The codes of a connection that failed (Node, postgres.js), as opposed to an answer. */
const CONNECTION_FAILURE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "CONNECT_TIMEOUT",
  "CONNECTION_CLOSED",
  "CONNECTION_ENDED",
  "CONNECTION_DESTROYED",
]);

/**
 * The database could not be reached (a connection failure, or a connection exception 08, 57P):
 * to wait for. Any other error, an answer of the database or not, stops the worker.
 */
function isUnreachable(error: unknown): boolean {
  const state = sqlStateOf(error);
  if (state !== null) {
    return state.startsWith("08") || state.startsWith("57P");
  }
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const code: unknown = (current as Error & { code?: unknown }).code;
    if (typeof code === "string" && CONNECTION_FAILURE_CODES.has(code)) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

/**
 * The start step, before the first turn. A refusal of the database (an id of the environment
 * refused, 22023) stops the worker: it never runs against a base that contradicts its environment
 * (D68). An unreachable base is waited for, so that a short outage does not use up the restarts of
 * Railway. null: refused, or stopped while waiting.
 */
async function startStep(
  config: WorkerConfig,
  database: WorkerDatabase,
  logger: ReturnType<typeof createLogger>,
  signal: AbortSignal,
): Promise<WorkerStart | null> {
  while (!signal.aborted) {
    try {
      const start = await startWorker(database, randomUUID(), config.brevoIds);
      if (Object.keys(config.brevoIds.listIds).length > 0) {
        logger.info(
          { changedKeys: start.changedKeys },
          "leads.settings.environment_applied",
        );
      }
      return start;
    } catch (error) {
      if (!isUnreachable(error)) {
        logger.fatal({ err: error }, "leads.settings.environment_refused");
        return null;
      }
      logger.warn({ err: error }, "database unreachable at start, waiting");
      await pause(START_RETRY_MS, signal);
    }
  }
  return null;
}

async function main(): Promise<void> {
  const config = readConfig();
  if (config === null) {
    process.exitCode = 1;
    return;
  }

  const logger = createLogger({
    service: "worker",
    environment: config.environment,
    version: config.version,
  });
  // The environment is already in every line (logger base): only the modes are added here.
  logger.info(
    {
      syncMode: config.sync.mode,
      brevoMode: config.brevo.mode,
      apolloCredentials: config.apollo.apiKey !== null,
    },
    "worker started",
  );

  // influx_worker_login (EC-20) for E-3 and E-4; influx_privacy_login for E-5 alone, when set
  // (required in production): two pools, never one role for both (03 P7).
  const database = createWorkerDatabase(config.database, logger);
  try {
    await verifyPools(database);
  } catch (error) {
    if (error instanceof DatabaseRoleRefusedError) {
      // 03 P7 rule 6: refuse to go on with a forbidden role.
      logger.fatal(
        { role: error.role, reason: error.reason },
        "database role refused, stopping",
      );
      await closeDatabase(database);
      process.exitCode = 1;
      return;
    }
    // Unreachable: verified again on first use (21 J1-D point 6).
    logger.warn({ err: error }, "database unreachable at startup");
  }

  const stop = new AbortController();
  const requestStop = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, "stop requested, finishing the current turn");
    stop.abort();
  };
  process.once("SIGTERM", requestStop);
  process.once("SIGINT", requestStop);

  // D68, then 05 RG162 (0146): the Brevo ids of the environment, then the settings in force, read
  // now (never cached, RG81), judged for the destinations this process holds a key of.
  const start = await startStep(config, database, logger, stop.signal);
  if (start === null) {
    await closeDatabase(database);
    process.exitCode = stop.signal.aborted ? 0 : 1;
    return;
  }
  const worker = workerIdentifier(config.instance);
  const connectors = connectorsOf(config, database, worker, logger);
  const destinationsWithKey = Object.values(connectors)
    .filter((connector) => connector.hasCredentials)
    .map((connector) => connector.destination);
  if (
    !checkSettingsAtStart(
      start.settings,
      destinationsWithKey,
      config.settingsRequiredAtStart,
      logger,
    )
  ) {
    await closeDatabase(database);
    process.exitCode = 1;
    return;
  }

  const directory =
    config.supabase === null
      ? null
      : createGoTrueUserDirectory(config.supabase);
  const periodic = periodicSchedulerOf(config, database, directory, logger);
  // E-5 between two turns, after the periodic tasks: an approved request waits a minute at most.
  const privacy =
    database.elevated.privacy === undefined
      ? null
      : createPrivacyExecutor({ database, directory, logger });
  logger.info(
    { privacyExecution: privacy !== null },
    "data subject requests execution configured",
  );
  // 02 §11.3: the beat of this process, which the api watches (AL50).
  const heartbeat = createHeartbeat({
    database,
    workerId: worker,
    instance: config.instance,
    version: config.version,
    startedAt: start.startedAt,
    logger,
    elapsed: () => performance.now(),
  });
  // 02 §20.5: the probe and the technical alerts, every minute, beside the drain (a long turn never
  // delays them), with a sender of their own on the worker's key (never the queue).
  const monitor = createWorkerMonitor({
    database,
    probe: config.probe,
    sender: createTransactionalSender(
      {
        mode: config.brevo.mode,
        testRecipients: config.brevo.testRecipients,
        apiKey: config.brevoTransport.apiKey,
        baseUrl: config.brevoTransport.baseUrl,
        senderEmail: config.brevoTransport.senderTransactional,
      },
      { logger },
    ),
    onCallRecipients: config.alerting.onCallRecipients,
    instance: config.instance,
    logger,
    sleep: pause,
  });
  logger.info({ probe: config.probe !== null }, "monitoring started");
  logger.info({ worker }, "outbox drain started");
  const drain = createOutboxDrain({
    queue: createWorkerQueue(database),
    connectors,
    inbound: createInboundProcessor({
      process: (requestId) => processInboundEvent(database, requestId),
      logger,
    }),
    periodic: {
      // A long periodic task is no stopped worker: the beat goes on meanwhile.
      async tick(signal) {
        await heartbeat.during(async () => {
          await periodic.tick(signal);
          await privacy?.tick(signal);
        });
      },
    },
    heartbeat,
    worker,
    startedAt: start.startedAt,
    sync: config.sync,
    logger,
    now: () => Date.now(),
    sleep: pause,
  });
  // A turn runs to its end even when a stop is requested meanwhile (02 §11.2).
  await Promise.all([drain.run(stop.signal), monitor.run(stop.signal)]);
  await closeDatabase(database);
  logger.info("worker stopped");
}

await main();
