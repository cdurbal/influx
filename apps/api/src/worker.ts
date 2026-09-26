// Entry point of the Railway service `worker` (docs/mvp/02-architecture-3-espaces.md §11).
// J1: an empty loop that logs its mode; the outbox drain arrives at J6. It opens NO port.
// Started by `node apps/api/src/worker.ts` directly, so that SIGTERM reaches it (21 §4, J1-B).
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
} from "./db/index.ts";
import { createLogger } from "./platform/logger.ts";

/** One turn every 5 s at rest (02 §11.1). */
const TURN_INTERVAL_MS = 5_000;

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

  // The worker's ONLY pool: influx_worker_login (EC-20). No operation uses it yet (E-3 at J6).
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

  while (!stop.signal.aborted) {
    // A turn runs to its end even when a stop is requested meanwhile (02 §11.2).
    logger.debug("worker turn");
    try {
      await sleep(TURN_INTERVAL_MS, undefined, { signal: stop.signal });
    } catch (error) {
      if (!isAbort(error)) {
        throw error;
      }
    }
  }
  await closeDatabase(database);
  logger.info("worker stopped");
}

await main();
