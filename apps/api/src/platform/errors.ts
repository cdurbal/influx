// Error code → HTTP status → envelope (docs/mvp/02-architecture-3-espaces.md §9.2, T13).
// A 5xx response never carries a detail: no stack, no SQL, no host name, no version.
import {
  errorEnvelopeSchema,
  type ErrorCode,
  type ErrorEnvelope,
  type ValidationIssue,
} from "@influx/contracts/errors";

export const HTTP_STATUS_BY_CODE: Readonly<Record<ErrorCode, number>> = {
  validation_failed: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  terms_not_published: 404,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,
  internal_error: 500,
  service_unavailable: 503,
};

/** Technical English, never displayed as is: the front translates the code (02 §9.2). */
const DEFAULT_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  validation_failed: "Validation failed",
  unauthenticated: "Authentication required",
  forbidden: "Forbidden",
  not_found: "Not found",
  terms_not_published: "No version of this document is published",
  conflict: "Conflict",
  payload_too_large: "Payload too large",
  rate_limited: "Too many requests",
  internal_error: "Internal error",
  service_unavailable: "Service unavailable",
};

/** An error that the API answers on purpose, with a code of the closed union. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly details: readonly ValidationIssue[] | undefined;

  constructor(code: ErrorCode, details?: readonly ValidationIssue[]) {
    super(DEFAULT_MESSAGES[code]);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

/** Returned by the zod validator compiler; Fastify then routes it to the error handler. */
export class RequestValidationError extends Error {
  readonly issues: readonly ValidationIssue[];
  readonly statusCode = 400;

  constructor(issues: readonly ValidationIssue[]) {
    super(DEFAULT_MESSAGES.validation_failed);
    this.name = "RequestValidationError";
    this.issues = issues;
  }
}

/**
 * A response body that went through no response schema: a string, a buffer or a stream sent by a
 * handler (02 §4 rule 1, 18 TM11.4 c). Answered as a 500 envelope, like an undeclared status.
 */
export class UnserializedResponseError extends Error {
  constructor() {
    super("A response body bypassed the response schemas");
    this.name = "UnserializedResponseError";
  }
}

export type ClassifiedError = {
  code: ErrorCode;
  details?: readonly ValidationIssue[];
};

function statusCodeOf(error: unknown): number | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }
  return undefined;
}

/** Maps any thrown value to a code of the closed union. Unknown errors are internal errors. */
export function classifyError(error: unknown): ClassifiedError {
  if (error instanceof ApiError) {
    return error.details === undefined
      ? { code: error.code }
      : { code: error.code, details: error.details };
  }
  if (error instanceof RequestValidationError) {
    return { code: "validation_failed", details: error.issues };
  }
  // Errors raised by Fastify itself before the handler (body parsing, body size, media type).
  const statusCode = statusCodeOf(error);
  if (statusCode === 413) {
    return { code: "payload_too_large" };
  }
  if (statusCode === 404) {
    return { code: "not_found" };
  }
  if (statusCode === 429) {
    return { code: "rate_limited" };
  }
  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return { code: "validation_failed" };
  }
  return { code: "internal_error" };
}

export function errorEnvelope(
  classified: ClassifiedError,
  requestId: string,
): ErrorEnvelope {
  // Parsing through the contract strips anything that is not declared.
  return errorEnvelopeSchema.parse({
    error: {
      code: classified.code,
      message: DEFAULT_MESSAGES[classified.code],
      details:
        classified.details === undefined ? undefined : [...classified.details],
      requestId,
    },
  });
}
