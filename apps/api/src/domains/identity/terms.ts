// Public documents: terms of service, privacy policy, cookie policy (docs/mvp/21 EC-62 and its
// amendment of 2026-10-08; 05 RG23 to RG29). GET /v1/terms/current serves the version in force,
// readable without an account (RG27).
//
// - The database says WHICH version is in force AND holds its exact text (0109), through
//   identity.terms_in_force() under the E-1 motif identity.read_published_terms; influx_auth
//   reads nothing else. No file is read here: apps/api/legal is the source of the publication
//   (scripts/terms-publication.ts), not of the answer.
// - The SHA-256 of the text is recomputed at each answer and must equal content_hash: a text that
//   differs from the one fingerprinted at publication would void the proof of acceptance (RG24).
// - Any failure (database unreachable, unexpected row, fingerprint mismatch) is a
//   TermsUnavailableError: the route answers 503 terms_unavailable, never 500 (EC-62 (D)), and an
//   error line names the document and the reason, never the text.
import { uiLocaleSchema, type UiLocale } from "@influx/contracts/auth";
import {
  currentTermsResponseSchema,
  TERMS_VERSION_LABEL_PATTERN,
  type CurrentTermsQuery,
  type CurrentTermsResponse,
  type PublicDocument,
} from "@influx/contracts/terms";
import { createHash } from "node:crypto";
import { withElevatedTransaction, type ApiDatabase } from "../../db/index.ts";
import {
  sqlStateOf,
  termsInForce,
  type TermsVersionRow,
} from "./repository.ts";

/** SHA-256, lower-case hexadecimal; a string is hashed as its UTF-8 bytes (0109 constraint). */
export function sha256Hex(value: Uint8Array | string): string {
  return createHash("sha256")
    .update(typeof value === "string" ? Buffer.from(value, "utf8") : value)
    .digest("hex");
}

/** Reads the version in force: the database in production, a fake in the route tests. */
export type TermsLookup = (
  document: PublicDocument,
  locale: UiLocale,
  requestId: string,
) => Promise<TermsVersionRow | null>;

export function databaseTermsLookup(database: ApiDatabase): TermsLookup {
  return (document, locale, requestId) =>
    withElevatedTransaction(
      database,
      "identity.read_published_terms",
      requestId,
      async (tx) => ({
        value: await termsInForce(tx, document, locale),
        // A read of a public document writes nothing: no audit line (EC-52 (3)).
        auditSubject: null,
      }),
    );
}

/** Why a version in force could not be served. Never a value of the text. */
export type TermsFailure =
  | "lookup_failed"
  | "unexpected_row"
  | "content_hash_mismatch"
  | "response_invalid";

/** The version in force cannot be served safely: answered 503 terms_unavailable. */
export class TermsUnavailableError extends Error {
  readonly failure: TermsFailure;

  constructor(failure: TermsFailure) {
    super("public document unavailable");
    this.name = "TermsUnavailableError";
    this.failure = failure;
  }
}

export type TermsLogger = {
  error(object: object, message: string): void;
};

export type TermsReader = {
  /**
   * The version in force, or null when none is published with its text (in the language nor in
   * English). Throws TermsUnavailableError only, after one error line.
   */
  current(
    query: CurrentTermsQuery,
    requestId: string,
    logger: TermsLogger,
  ): Promise<CurrentTermsResponse | null>;
};

/** The answer for a row, or the reason it cannot be served. */
function answerOf(
  query: CurrentTermsQuery,
  row: TermsVersionRow,
): CurrentTermsResponse | TermsFailure {
  const served = uiLocaleSchema.safeParse(row.locale);
  if (
    !served.success ||
    row.documentKind !== query.document ||
    (served.data !== query.locale && served.data !== "en") ||
    !TERMS_VERSION_LABEL_PATTERN.test(row.versionLabel)
  ) {
    return "unexpected_row";
  }
  if (sha256Hex(row.content) !== row.contentSha256) {
    return "content_hash_mismatch";
  }
  // The response schema is checked HERE: a value it refuses would otherwise fail at
  // serialisation, as a 500 (EC-62 (D)).
  const answer = currentTermsResponseSchema.safeParse({
    id: row.id,
    document: query.document,
    locale: served.data,
    isFallback: served.data !== query.locale,
    versionLabel: row.versionLabel,
    effectiveFrom: row.effectiveFrom,
    requiresAcceptance: row.requiresAcceptance,
    contentSha256: row.contentSha256,
    content: row.content,
  });
  return answer.success ? answer.data : "response_invalid";
}

export function createTermsReader(options: {
  lookup: TermsLookup;
}): TermsReader {
  return {
    async current(query, requestId, logger) {
      // 02 §20.8: the document, the reason and a technical code; no text, no personal data.
      const fail = (failure: TermsFailure, extra: object = {}): never => {
        logger.error(
          {
            document: query.document,
            locale: query.locale,
            reason: failure,
            ...extra,
          },
          "public document not served: terms_unavailable",
        );
        throw new TermsUnavailableError(failure);
      };
      let row: TermsVersionRow | null;
      try {
        row = await options.lookup(query.document, query.locale, requestId);
      } catch (error) {
        return fail("lookup_failed", {
          errorName: error instanceof Error ? error.name : typeof error,
          sqlState: sqlStateOf(error),
        });
      }
      if (row === null) {
        return null;
      }
      const answer = answerOf(query, row);
      return typeof answer === "string"
        ? fail(answer, { versionLabel: row.versionLabel })
        : answer;
    },
  };
}
