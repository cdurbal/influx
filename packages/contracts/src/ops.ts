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

/**
 * J4S-6, strict text: no control character, no format character (bidirectional overrides,
 * zero-width characters), no private-use character, no lone surrogate. What the "Santé technique"
 * screen shows is then the very text received, never a text that reads otherwise. A stack keeps
 * its line feeds, and nothing else of the kind.
 */
const NOT_STRICT_TEXT = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu;
const STRICT_TEXT = /^[^\p{Cc}\p{Cf}\p{Co}\p{Cs}]*$/u;
const STRICT_LINES = /^(?:[^\p{Cc}\p{Cf}\p{Co}\p{Cs}]|\n)*$/u;

/**
 * A value made strict text, then cut to `maxLength` UTF-16 units (the collector, before sending):
 * every refused character becomes a space, line feeds kept when `lines` is true. The cut never
 * leaves half of a surrogate pair.
 */
export function toStrictText(
  value: string,
  maxLength: number,
  lines = false,
): string {
  const strict = value.replace(NOT_STRICT_TEXT, (character) =>
    lines && character === "\n" ? character : " ",
  );
  let cut = strict.slice(0, maxLength);
  if (/[\uD800-\uDBFF]$/.test(cut)) {
    cut = cut.slice(0, -1);
  }
  return cut;
}

export const clientErrorReportSchema = z.strictObject({
  kind: z.enum(CLIENT_ERROR_KINDS),
  errorType: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_.:-]{0,79}$/)
    .optional(),
  message: z
    .string()
    .min(1)
    .max(CLIENT_ERROR_LIMITS.message)
    .regex(STRICT_TEXT),
  stack: z
    .string()
    .max(CLIENT_ERROR_LIMITS.stack)
    .regex(STRICT_LINES)
    .optional(),
  // location.pathname only: no query, no fragment (02 §20.8). The api reduces it to a model.
  page: z
    .string()
    .max(CLIENT_ERROR_LIMITS.page)
    .regex(/^\/[^?#\s\p{C}]*$/u),
});

export type ClientErrorReport = z.infer<typeof clientErrorReportSchema>;
