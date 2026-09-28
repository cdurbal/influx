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
  // Query and parameters of a PostgresError of the `postgres` driver (21 J2, security review M3).
  "parameters",
  "query",
  "args",
  // Fields of a PostgreSQL error that quote values (`Key (email)=(…) already exists`), 21 N1.
  "detail",
  "hint",
  "where",
  // Authentication values (21 J3-C rule 7, and the additions of expert-cybersecurite for J3
  // commit 3): login and TOTP codes, GoTrue link properties, TOTP enrolment, recovery codes, the
  // matching phrase, and the outbound headers of the Supabase calls (EC-38, EC-46). `code` is
  // why an error's own code is logged as `errorCode` (21 §3 EC-49).
  "code",
  "email_otp",
  "hashed_token",
  "action_link",
  "qr_code",
  "uri",
  "totp",
  "recoveryCodes",
  "recoveryCode",
  "enrollmentToken",
  "matchingPhrase",
  "apikey",
  "sb-forwarded-for",
];

/** A key three objects deep (`{ a: { b: { c: { email } } } }`) is still censored (18 T13.6). */
const REDACTED_DEPTH = 3;

/**
 * Deepest level of a logged key that the redaction paths reach: `email` is level 1, `*.*.*.email`
 * level 4. A container at this level would have keys that no path censors: it is truncated.
 */
const DEEPEST_REDACTED_LEVEL = REDACTED_DEPTH + 1;

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
 * Shape of a diagnostic code (21 §3 EC-49, J3 security review R-1): an identifier starting with a
 * letter (`FST_ERR_*`, `ERR_*`, `ECONNRESET`, `UND_ERR_*`, GoTrue's `otp_expired`), or a SQLSTATE
 * (`23505`, `P0001`). A login code, a token or any value with a space or a hyphen never has it.
 * Linear: two anchored alternatives, no nested quantifier.
 */
const DIAGNOSTIC_CODE_PATTERN = /^(?:[A-Za-z][A-Za-z0-9_]{1,63}|[0-9A-Z]{5})$/;

/** Written instead of a code that does not have the shape of a diagnostic code (R-1). */
export const UNRECOGNIZED_ERROR_CODE = "[unrecognized]";

/**
 * The string `code` of an error, only when it has the shape of a diagnostic code; any other string
 * becomes UNRECOGNIZED_ERROR_CODE, since it might be a login code or a token (R-1).
 */
function stringCodeOf(value: object): string | undefined {
  if (!("code" in value) || typeof value.code !== "string") {
    return undefined;
  }
  return DIAGNOSTIC_CODE_PATTERN.test(value.code)
    ? value.code
    : UNRECOGNIZED_ERROR_CODE;
}

/**
 * Errors whose message is written by us and never carries a value (A1): an allow-list of our own
 * classes. No Fastify message is kept, `FST_*` included: several quote the request URL or another
 * error's message, and the `@fastify/*` plugins share the prefix (21 §3 EC-26). The code and the
 * status are enough to diagnose them.
 */
function hasSafeMessage(error: Error): boolean {
  return (
    error instanceof ApiError ||
    error instanceof RequestValidationError ||
    error instanceof ConfigError
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

/**
 * The code of an error is written as `errorCode`, never `code`: `code` is a censored key, since it
 * names the login and TOTP codes (21 J3-C rule 7, §3 EC-49). `errorCode` is not censored: it holds
 * only a value with the shape of a diagnostic code, or `[unrecognized]` (R-1).
 */
export type SafeErrorLog = {
  type: string;
  message?: string;
  errorCode?: string;
  statusCode?: number;
  stack?: string;
  cause?: { name: string; errorCode?: string };
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
    log.errorCode = code;
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
        : { name: typeOf(cause), errorCode: causeCode };
  } else if (cause !== undefined) {
    log.cause = { name: typeof cause };
  }
  return log;
}

/** Keys of pino's own serializers, left to them at the top level (`err`, `req`, `res`). */
const SERIALIZED_KEYS: ReadonlySet<string> = new Set(["err", "req", "res"]);

const TRUNCATED = "[truncated]";

function isPlainObject(value: object): boolean {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * Copy of a logged value, made for EVERY logged object (end-of-J2 security review, point (b)):
 * - an error, at any level, goes through `serializeError` (21 N1, J2 review M3): pino would
 *   otherwise write every enumerable property (`detail`, `query`, `parameters`…);
 * - plain objects and arrays are copied down to DEEPEST_REDACTED_LEVEL; a container at that
 *   level, whose keys no redaction path would reach, becomes `[truncated]`, as does a cycle;
 * - any other object (Map, Set, Buffer, class instance) becomes `[<class>]`: its content is not
 *   inspected by the redaction, so it is never written; a date is kept (an ISO string).
 * The logged object itself is never modified.
 */
function sanitizeLogValue(
  value: unknown,
  level: number,
  seen: WeakSet<object>,
): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }
  if (typeof value !== "object" || value === null || value instanceof Date) {
    return value;
  }
  if (!Array.isArray(value) && !isPlainObject(value)) {
    const name = value.constructor?.name ?? "";
    return `[${name === "" ? "object" : name}]`;
  }
  if (seen.has(value) || level >= DEEPEST_REDACTED_LEVEL) {
    return TRUNCATED;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogValue(item, level + 1, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sanitizeLogValue(entry, level + 1, seen),
    ]),
  );
}

/** The logged object, always copied; `err`, `req` and `res` are left to their serializers. */
function sanitizeLogObject(value: object): object {
  const seen = new WeakSet<object>([value]);
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) =>
      SERIALIZED_KEYS.has(key)
        ? [key, entry]
        : [key, sanitizeLogValue(entry, 1, seen)],
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
          method.apply(this, [sanitizeLogObject(first), ...rest] as Parameters<
            typeof method
          >);
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
