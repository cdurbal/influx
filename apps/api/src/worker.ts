// Entry point of the Railway service `worker` (docs/mvp/02-architecture-3-espaces.md §11).
// J6: drains the outbox (E-3 `leads.drain_outbox`, src/domains/leads/drain.ts). It opens NO port.
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
import {
  createBrevoConnectors,
  type BrevoConnectorDependencies,
} from "./domains/leads/connectors/brevo/index.ts";
import { createOutboxDrain, workerIdentifier } from "./domains/leads/drain.ts";
import {
  createWorkerQueue,
  readBrevoSubjectOf,
} from "./domains/leads/queue.ts";
import type { OutboxDestination } from "./domains/leads/repository.ts";
import { createLogger } from "./platform/logger.ts";

/**
 * The connectors of this process: Brevo (J6 commit 4), with the worker's own key (EC-19). Apollo
 * arrives with commit 5: until then its lines wait an hour without using an attempt (drain.ts).
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
      logger,
    },
  );
  return {
    brevo_contact: brevo.contact,
    brevo_transactional: brevo.transactional,
  };
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
    { syncMode: config.sync.mode, brevoMode: config.brevo.mode },
    "worker started",
  );

  // The worker's ONLY pool: influx_worker_login (EC-20), for E-3 alone.
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
  logger.info({ worker }, "outbox drain started");
  const drain = createOutboxDrain({
    queue: createWorkerQueue(database),
    connectors: connectorsOf(config, database, worker, logger),
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
