// Contract of the public documents (docs/mvp/21 EC-62; 05 RG23 to RG29): GET /v1/terms/current
// serves the version in force of a document, in the language asked or, failing that, in English
// (RG25). Shared by apps/api and apps/web. Readable without an account (RG27).
import * as z from "zod";
import { uiLocaleSchema } from "./auth.ts";

/** The documents a visitor reads without an account; never the supervision notice (12 RG103). */
export const PUBLIC_DOCUMENTS = [
  "terms_of_service",
  "privacy_policy",
  "cookie_policy",
] as const;
export const publicDocumentSchema = z.enum(PUBLIC_DOCUMENTS);
export type PublicDocument = z.infer<typeof publicDocumentSchema>;

/** Query of GET /v1/terms/current: both parameters, nothing else (an unknown one is a 400). */
export const currentTermsQuerySchema = z.strictObject({
  document: publicDocumentSchema,
  locale: uiLocaleSchema,
});
export type CurrentTermsQuery = z.infer<typeof currentTermsQuerySchema>;

/** Format of identity.terms_versions.version_label (0005, terms_versions_label_format). */
export const TERMS_VERSION_LABEL_PATTERN = /^[0-9A-Za-z._-]{1,40}$/;

/** A draft (`draft-N`): local and staging only, never indexed (21 EC-62). */
export const DRAFT_LABEL_PREFIX = "draft-";

export function isDraftLabel(label: string): boolean {
  return label.startsWith(DRAFT_LABEL_PREFIX);
}

/** Bound of a document's text: far above any real document, small enough for one answer. */
export const MAX_TERMS_CONTENT_LENGTH = 200_000;

export const currentTermsResponseSchema = z.strictObject({
  /** The version to send back with the acceptance (POST /v1/signup, RG24). */
  id: z.uuid(),
  document: publicDocumentSchema,
  /** The language actually served, never the one asked (RG25). */
  locale: uiLocaleSchema,
  /** True when the English version is served for another language (RG25). */
  isFallback: z.boolean(),
  versionLabel: z.string().regex(TERMS_VERSION_LABEL_PATTERN),
  effectiveFrom: z.iso.datetime(),
  requiresAcceptance: z.boolean(),
  /** SHA-256 of the exact bytes of `content`, lower-case hexadecimal (RG24, 04 R7). */
  contentSha256: z.string().regex(/^[0-9a-f]{64}$/),
  /** Restricted Markdown (21 EC-62): rendered as text by the fronts, never as HTML. */
  content: z.string().min(1).max(MAX_TERMS_CONTENT_LENGTH),
});
export type CurrentTermsResponse = z.infer<typeof currentTermsResponseSchema>;
