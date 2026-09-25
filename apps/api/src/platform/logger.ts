// Common pino settings of the api and worker processes (docs/mvp/02-architecture-3-espaces.md
// §4 rule 3 and §20.8, docs/mvp/21 §4 J1-E). JSON lines to stdout, read by Railway.
// Never in a log line: cookies, authorization, the internal secret, bodies, raw URLs, e-mail
// addresses, codes, tokens. Serializers keep only safe fields; redaction is the second guard.
import pino from "pino";
import type { DestinationStream, Logger, LoggerOptions } from "pino";

export type ServiceName = "api" | "worker";

export type LoggerSettings = {
  service: ServiceName;
  environment: string;
  version: string;
};

const CENSOR = "[redacted]";

/**
 * Defence in depth when an object is logged by hand: sensitive keys at the top level or one level
 * down. `headers` is censored as a whole, which covers cookies, authorization, set-cookie and the
 * internal secret header.
 */
export const REDACTED_PATHS: readonly string[] = [
  "headers",
  "cookie",
  "cookies",
  "authorization",
  "body",
  "email",
  "password",
  "secret",
  "token",
  "loginCode",
].flatMap((key) => [key, `*.${key}`]);

type SafeRequestLog = {
  method?: string;
  route?: string;
};

/** A request is logged as its method and route model only (`/v1/creators/:id`), never its URL. */
function serializeRequest(value: unknown): SafeRequestLog {
  if (typeof value !== "object" || value === null) {
    return {};
  }
  const log: SafeRequestLog = {};
  if ("method" in value && typeof value.method === "string") {
    log.method = value.method;
  }
  if (
    "routeOptions" in value &&
    typeof value.routeOptions === "object" &&
    value.routeOptions !== null &&
    "url" in value.routeOptions &&
    typeof value.routeOptions.url === "string"
  ) {
    log.route = value.routeOptions.url;
  }
  return log;
}

/** A response is logged as its status code only, never its headers. */
function serializeResponse(value: unknown): { statusCode?: number } {
  if (
    typeof value === "object" &&
    value !== null &&
    "statusCode" in value &&
    typeof value.statusCode === "number"
  ) {
    return { statusCode: value.statusCode };
  }
  return {};
}

export function loggerOptions(settings: LoggerSettings): LoggerOptions {
  return {
    level: "info",
    base: {
      service: settings.service,
      environment: settings.environment,
      version: settings.version,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    serializers: {
      err: pino.stdSerializers.err,
      req: serializeRequest,
      res: serializeResponse,
    },
    redact: { paths: [...REDACTED_PATHS], censor: CENSOR },
  };
}

/** The destination is injectable so that tests can read what is written. */
export function createLogger(
  settings: LoggerSettings,
  destination?: DestinationStream,
): Logger {
  const options = loggerOptions(settings);
  return destination === undefined ? pino(options) : pino(options, destination);
}
