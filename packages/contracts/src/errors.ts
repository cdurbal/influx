// Error envelope shared by apps/api and the fronts (docs/mvp/02-architecture-3-espaces.md §9.2).
// The front translates `code` into a translation key; `message` is technical English and is
// never displayed as is.
import * as z from "zod";

/** Closed union of the API error codes, in snake_case. Adding a code is a contract change. */
export const ERROR_CODES = [
  "validation_failed",
  "unauthenticated",
  "forbidden",
  "not_found",
  // No version of the public document is in force, in the language asked nor in English (21 EC-62).
  "terms_not_published",
  "conflict",
  "payload_too_large",
  "rate_limited",
  "internal_error",
  "service_unavailable",
  // A public document could not be served safely (21 EC-62 (D)): retry later, never a 500.
  "terms_unavailable",
] as const;

export const errorCodeSchema = z.enum(ERROR_CODES);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

/**
 * One invalid input field of a `validation_failed` error: where, and which rule failed.
 * Never the received value (it may be personal data).
 */
export const validationIssueSchema = z.object({
  path: z.string(),
  issue: z.string(),
});

export type ValidationIssue = z.infer<typeof validationIssueSchema>;

export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: z.array(validationIssueSchema).optional(),
    requestId: z.string(),
  }),
});

export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
