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
  // The terms of service in force are not accepted yet: the re-acceptance screen first (05 RG28).
  "terms_acceptance_required",
  // A sensitive action without a fresh code for it on this session (05 RG57; J7 decision 4): the
  // "code frais" step first (POST /v1/me/reauthenticate/request-code).
  "reauthentication_required",
  // The codes of an address change could not be sent, or GoTrue could not take the new address:
  // nothing changed, try again (05 RG58; J7 decision 5). Never a silent skip.
  "email_change_unavailable",
  // The export of a "mes données" request is no longer downloadable: expired, purged or downloaded
  // three times (runbook demandes-rgpd §4; J8 commit 8). A new request gives a new export.
  "export_unavailable",
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
