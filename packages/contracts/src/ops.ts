// Report of a browser error, POST /v1/ops/client-errors (docs/mvp/02 §20.5, "Erreurs du
// navigateur"; 21 §4 J4 point 3). Sent by the collector of the connected spaces of apps/web and
// apps/backoffice (src/observability/), never by the landing. Every value is cleaned AGAIN by
// apps/api before it is stored (02 §20.8): this schema bounds the shape, not the content.
import { z } from "./zod.ts";

export const CLIENT_ERROR_KINDS = [
  "error",
  "unhandledrejection",
  "render",
] as const;

/** Bounds shared by the collector (truncation) and the api (refusal). */
export const CLIENT_ERROR_LIMITS = {
  message: 500,
  stack: 4000,
  page: 200,
  errorType: 80,
} as const;

export const clientErrorReportSchema = z.strictObject({
  kind: z.enum(CLIENT_ERROR_KINDS),
  errorType: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/)
    .optional(),
  message: z.string().min(1).max(CLIENT_ERROR_LIMITS.message),
  stack: z.string().max(CLIENT_ERROR_LIMITS.stack).optional(),
  // location.pathname only: no query, no fragment (02 §20.8). The api reduces it to a model.
  page: z
    .string()
    .max(CLIENT_ERROR_LIMITS.page)
    .regex(/^\/[^?#\s]*$/),
});

export type ClientErrorReport = z.infer<typeof clientErrorReportSchema>;
