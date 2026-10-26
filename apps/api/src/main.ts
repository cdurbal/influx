// Entry point of the Railway service `api` (docs/mvp/02-architecture-3-espaces.md §12.1).
// Started by `node apps/api/src/main.ts` directly, never through `pnpm start`, so that SIGTERM
// reaches this process (21 §4, J1-B).
import { ConfigError, loadApiConfig, type ApiConfig } from "./config/index.ts";
import {
  closeDatabase,
  createApiDatabase,
  DatabaseRoleRefusedError,
  verifyPools,
} from "./db/index.ts";
import { OpsRecorder } from "./domains/ops/recorder.ts";
import { startWorkerWatch } from "./domains/ops/worker-watch.ts";
import { createTransactionalSender } from "./platform/brevo-transactional.ts";
import { createLogger } from "./platform/logger.ts";
import { buildServer } from "./server.ts";

/** Listens on every IPv6 and IPv4 address: Railway's private network is IPv6 (02 §12.1). */
const LISTEN_HOST = "::";

function readConfig(): ApiConfig | null {
  try {
    return loadApiConfig();
  } catch (error) {
    // No configuration means no environment or version yet: a bootstrap logger reports it.
    const logger = createLogger({
      service: "api",
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

async function main(): Promise<void> {
  const config = readConfig();
  if (config === null) {
    process.exitCode = 1;
    return;
  }

  // Pools of the api only: influx_app and influx_auth_login (EC-20). The bootstrap logger of the
  // pools is the server's once it exists; the pools connect on first use only.
  const logger = createLogger({
    service: "api",
    environment: config.environment,
    version: config.version,
  });
  const database = createApiDatabase(config.database, logger);
  // D60: errors and metrics, flushed every 10 s on the ops pool (E-6), outside any request.
  const ops = new OpsRecorder({
    version: config.version,
    instance: config.instance,
  });
  const app = buildServer(config, { database, ops });
  ops.start(database, app.log);
  // An error that escapes everything is recorded before Node stops the process (it may not be
  // written in time: the log line remains).
  process.on("uncaughtExceptionMonitor", (error) => {
    ops.recordServerError(error);
  });
  // 02 §20.5: the api watches the worker (AL50), with a sender of its own: an alert never waits
  // behind the circuit of the sign-in code.
  const workerWatch = startWorkerWatch({
    database,
    sender: createTransactionalSender(
      {
        mode: config.brevo.mode,
        testRecipients: config.brevo.testRecipients,
        apiKey: config.brevoTransport.apiKey,
        baseUrl: config.brevoTransport.baseUrl,
        senderEmail: config.brevoTransport.senderTransactional,
      },
      { logger: app.log },
    ),
    onCallRecipients: config.alerting.onCallRecipients,
    logger: app.log,
  });

  const shutDown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, "shutting down");
    // close() stops accepting connections and waits for the requests in flight (02 §4 rule 5).
    app
      .close()
      .then(() => workerWatch.stop())
      .then(() => ops.stop(database, app.log))
      .then(() => closeDatabase(database))
      .then(
        () => {
          app.log.info("stopped");
        },
        (error: unknown) => {
          app.log.error({ err: error }, "shutdown failed");
          process.exitCode = 1;
        },
      );
  };
  process.once("SIGTERM", shutDown);
  process.once("SIGINT", shutDown);

  await app.listen({ host: LISTEN_HOST, port: config.port });

  // 03 P7 rule 6: a pool connected as a forbidden role stops the process. An unreachable
  // database does not: starting never depends on it (21 J1-D point 6), the pool is verified
  // again on first use.
  verifyPools(database).catch((error: unknown) => {
    if (error instanceof DatabaseRoleRefusedError) {
      app.log.fatal(
        { role: error.role, reason: error.reason },
        "database role refused, stopping",
      );
      process.exitCode = 1;
      shutDown("SIGTERM");
      return;
    }
    app.log.warn({ err: error }, "database unreachable at startup");
  });
}

await main();
