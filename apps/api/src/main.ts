// Entry point of the Railway service `api` (docs/mvp/02-architecture-3-espaces.md §12.1).
// Started by `node apps/api/src/main.ts` directly, never through `pnpm start`, so that SIGTERM
// reaches this process (21 §4, J1-B).
import { ConfigError, loadApiConfig, type ApiConfig } from "./config/index.ts";
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

  const app = buildServer(config);

  const shutDown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, "shutting down");
    // close() stops accepting connections and waits for the requests in flight (02 §4 rule 5).
    app.close().then(
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
}

await main();
