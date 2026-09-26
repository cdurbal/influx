// Common pino settings of the api and worker processes (docs/mvp/02-architecture-3-espaces.md
// §4 rule 3 and §20.8, docs/mvp/21 §4 J1-E and J1-J A1). JSON lines to stdout, read by Railway.
// Never in a log line: cookies, authorization, the internal secret, bodies, raw URLs, e-mail
// addresses, codes, tokens. Serializers keep only safe fields; redaction is the second guard.
import pino from "pino";
import type { DestinationStream, Logger, LoggerOptions } from "pino";
import { ConfigError } from "../config/schema.ts";
import { ApiError, RequestValidationError } from "./errors.ts";

export type ServiceName = "api" | "worker";

export type LoggerSettings = {
  service: ServiceName;
  environment: string;
  version: string;
};

const CENSOR = "[redacted]";

/** Sensitive keys, censored wherever they appear down to REDACTED_DEPTH levels of nesting. */
const REDACTED_KEYS: readonly string[] = [
  "headers",
  "cookie",
  "cookies",
  "set-cookie",
  "authorization",
  "x-influx-internal",
  "body",
  "email",
  "phone",
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "loginCode",
  "otp",
  "ip",
  "clientAddress",
  // Query parameters of a database error (DrizzleQueryError.params), 21 J1-J A1.
  "params",
  // Fields of a PostgreSQL error that quote values (`Key (email)=(…) already exists`), 21 N1.
  "detail",
  "hint",
  "where",
];

/** A key three objects deep (`{ a: { b: { c: { email } } } }`) is still censored (18 T13.6). */
const REDACTED_DEPTH = 3;

/** `email` → `email`, `*.email`, `*.*.email`…; `set-cookie` → `["set-cookie"]`, `*["set-cookie"]`… */
function redactedPathsOf(key: string): string[] {
  const isPlainKey = /^[A-Za-z_$][\w$]*$/.test(key);
  const segment = isPlainKey ? key : `["${key}"]`;
  const paths = [segment];
  for (let depth = 1; depth <= REDACTED_DEPTH; depth += 1) {
    const wildcards = Array.from({ length: depth }, () => "*").join(".");
    paths.push(isPlainKey ? `${wildcards}.${key}` : `${wildcards}${segment}`);
  }
  return paths;
}

/**
 * Defence in depth when an object is logged by hand. `headers` is censored as a whole, which
 * covers cookies, authorization, set-cookie and the internal secret header.
 */
export const REDACTED_PATHS: readonly string[] =
  REDACTED_KEYS.flatMap(redactedPathsOf);

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

/**
 * Fastify errors whose message quotes a value: the request URL (FST_ERR_REP_ALREADY_SENT) or the
 * message of another error (FST_ERR_FAILED_ERROR_SERIALIZATION). Their message is dropped like any
 * other; the code is enough to diagnose them (21 §3 EC-26).
 */
const FASTIFY_CODES_QUOTING_VALUES: readonly string[] = [
  "FST_ERR_REP_ALREADY_SENT",
  "FST_ERR_FAILED_ERROR_SERIALIZATION",
];

function stringCodeOf(value: object): string | undefined {
  return "code" in value && typeof value.code === "string"
    ? value.code
    : undefined;
}

/** Errors whose message is written by us or by Fastify, and never carries a value (A1). */
function hasSafeMessage(error: Error): boolean {
  if (
    error instanceof ApiError ||
    error instanceof RequestValidationError ||
    error instanceof ConfigError
  ) {
    return true;
  }
  const code = stringCodeOf(error);
  return (
    code !== undefined &&
    code.startsWith("FST_") &&
    !FASTIFY_CODES_QUOTING_VALUES.includes(code)
  );
}

function typeOf(error: Error): string {
  const name = error.constructor.name;
  return name === "" ? "Error" : name;
}

/**
 * The frames of the stack, without the message: the first lines of a V8 stack repeat the message,
 * which may span several lines. Everything up to the end of the message is cut, then only the
 * `at …` lines are kept.
 */
function framesOf(error: Error): string | undefined {
  if (typeof error.stack !== "string") {
    return undefined;
  }
  const messageEnd =
    error.message === "" ? -1 : error.stack.indexOf(error.message);
  const afterMessage =
    messageEnd === -1
      ? error.stack
      : error.stack.slice(messageEnd + error.message.length);
  const frames = afterMessage
    .split("\n")
    .filter((line) => /^\s+at\s/.test(line))
    .map((line) => line.trim());
  return frames.length === 0 ? undefined : frames.join("\n");
}

export type SafeErrorLog = {
  type: string;
  message?: string;
  code?: string;
  statusCode?: number;
  stack?: string;
  cause?: { name: string; code?: string };
};

/**
 * `err` serializer on an allow-list (21 J1-J A1, 02 §20.8). A database error carries its SQL
 * parameters in `message`, `stack` and `params` (DrizzleQueryError): none of the three may reach
 * a log line. No enumerable property is copied; the message is kept for our own errors only; the
 * cause is reduced to its name and code.
 */
export function serializeError(value: unknown): SafeErrorLog {
  if (!(value instanceof Error)) {
    // A thrown string or object may hold anything: only its type is kept.
    return { type: typeof value };
  }
  const log: SafeErrorLog = { type: typeOf(value) };
  if (hasSafeMessage(value)) {
    log.message = value.message;
  }
  const code = stringCodeOf(value);
  if (code !== undefined) {
    log.code = code;
  }
  if ("statusCode" in value && typeof value.statusCode === "number") {
    log.statusCode = value.statusCode;
  }
  const stack = framesOf(value);
  if (stack !== undefined) {
    log.stack = stack;
  }
  const cause: unknown = value.cause;
  if (cause instanceof Error) {
    const causeCode = stringCodeOf(cause);
    log.cause =
      causeCode === undefined
        ? { name: typeOf(cause) }
        : { name: typeOf(cause), code: causeCode };
  } else if (cause !== undefined) {
    log.cause = { name: typeof cause };
  }
  return log;
}

/**
 * `{ error }`, `{ cause }` or any other top-level key holding an error would be written by pino
 * with every enumerable property of the error (`detail`, `params`, `query`…): each one goes through
 * `serializeError` instead (21 N1). `err` is left to its serializer. The logged object is copied,
 * never modified, and only when it holds an error.
 */
function withSerializedErrors(value: object): object {
  const entries = Object.entries(value);
  if (
    !entries.some(([key, entry]) => key !== "err" && entry instanceof Error)
  ) {
    return value;
  }
  return Object.fromEntries(
    entries.map(([key, entry]) =>
      key !== "err" && entry instanceof Error
        ? [key, serializeError(entry)]
        : [key, entry],
    ),
  );
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
      err: serializeError,
      req: serializeRequest,
      res: serializeResponse,
    },
    hooks: {
      // `logger.error(error)` would make the error's message the `msg` of the line. The error
      // goes to `err`, through the allow-list serializer, and the line gets a fixed message.
      logMethod(args, method) {
        const [first, ...rest] = args;
        if (first instanceof Error) {
          const message: unknown[] = rest.length > 0 ? rest : ["error logged"];
          method.apply(this, [{ err: first }, ...message] as Parameters<
            typeof method
          >);
          return;
        }
        if (
          typeof first === "object" &&
          first !== null &&
          !Array.isArray(first)
        ) {
          method.apply(this, [
            withSerializedErrors(first),
            ...rest,
          ] as Parameters<typeof method>);
          return;
        }
        method.apply(this, args);
      },
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
