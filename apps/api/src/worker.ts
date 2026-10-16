// Entry point of the Railway service `worker` (docs/mvp/02-architecture-3-espaces.md §11).
// J6: drains the outbox (E-3 `leads.drain_outbox`, src/domains/leads/drain.ts); J7: first processes
// what Brevo reported back (src/domains/leads/inbound/processing.ts), and, between two turns, the
// periodic tasks of E-4 (src/domains/maintenance/periodic.ts, J7 decision 3), then the "mes données"
// requests approved by an admin, on a pool of their own (E-5, src/domains/privacy/execution.ts, J8
// commit 8). It opens NO port.
// Started by `node apps/api/src/worker.ts` directly, so that SIGTERM reaches it (21 §4, J1-B):
// the turn in progress finishes, the lines not begun go back to pending (02 §11.2, TM1.10).
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
} from "./domains/leads/queue.ts";
import type { OutboxDestination } from "./domains/leads/repository.ts";
import { createAuthOrphanPurge } from "./domains/maintenance/auth-orphan-purge.ts";
import { createBrevoReads } from "./domains/maintenance/brevo-reads.ts";
import { createBrevoReconciliation } from "./domains/maintenance/brevo-reconciliation.ts";
import {
  createBrevoInboundPurge,
  createDataExportPurge,
  createPeriodicScheduler,
  createPeriodicStore,
  type PeriodicLogger,
  type PeriodicScheduler,
  type PeriodicTask,
  type PeriodicTaskRunner,
} from "./domains/maintenance/periodic.ts";
import { createPrivacyExecutor } from "./domains/privacy/execution.ts";
import { createLogger } from "./platform/logger.ts";
import {
  createGoTrueUserDirectory,
  type GoTrueUserDirectory,
} from "./platform/supabase.ts";

/**
 * The connectors of this process: Brevo (J6 commit 4), with the worker's own key (EC-19), and
 * Apollo (commit 5), with APOLLO_API_KEY, the worker's only; without it, skipped_no_credentials.
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
 * its own secret key; a task without its key is never claimed. The 30-day purge and the purge of
 * the exports (J8 commit 8) need neither.
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

  const worker = workerIdentifier(config.instance);
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
  logger.info({ worker }, "outbox drain started");
  const drain = createOutboxDrain({
    queue: createWorkerQueue(database),
    connectors: connectorsOf(config, database, worker, logger),
    inbound: createInboundProcessor({
      process: (requestId) => processInboundEvent(database, requestId),
      logger,
    }),
    periodic: {
      async tick(signal) {
        await periodic.tick(signal);
        await privacy?.tick(signal);
      },
    },
    worker,
    sync: {
      mode: config.sync.mode,
      environment: config.environment,
      nonProductionRecipientAllowlist:
        config.sync.nonProductionRecipientAllowlist,
    },
    logger,
    now: () => Date.now(),
    sleep: pause,
  });
  // A turn runs to its end even when a stop is requested meanwhile (02 §11.2).
  await drain.run(stop.signal);
  await closeDatabase(database);
  logger.info("worker stopped");
}

await main();
