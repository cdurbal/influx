// Public documents: terms of service, privacy policy, cookie policy (docs/mvp/21 EC-62; 05 RG23
// to RG29). GET /v1/terms/current serves the version in force, readable without an account (RG27).
//
// - The database says WHICH version is in force, through identity.terms_in_force() under the E-1
//   motif identity.read_published_terms (0108); influx_auth reads nothing else.
// - The text is the file apps/api/legal/<document>/<locale>/<label>.md, exact bytes. Its path is
//   REBUILT from (document, locale, label) and must equal content_uri: a stored path is never
//   followed (no traversal). Its SHA-256 is recomputed and must equal content_hash.
// - Any mismatch FAILS CLOSED: no text is served (500) and an error line names the version and
//   the reason, nothing else. A text that differs from the one fingerprinted at publication
//   would void the proof of acceptance (RG24, RG29).
// - A verified text is kept in memory by version id: a published version never changes (0005).
import { uiLocaleSchema, type UiLocale } from "@influx/contracts/auth";
import {
  MAX_TERMS_CONTENT_LENGTH,
  TERMS_VERSION_LABEL_PATTERN,
  type CurrentTermsQuery,
  type CurrentTermsResponse,
  type PublicDocument,
} from "@influx/contracts/terms";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { withElevatedTransaction, type ApiDatabase } from "../../db/index.ts";
import { termsInForce, type TermsVersionRow } from "./repository.ts";

/** apps/api: the base of every content_uri (`legal/…`). */
export const LEGAL_CONTENT_ROOT = fileURLToPath(
  new URL("../../../", import.meta.url),
);

/** Folder of the published texts, under the content root. */
const LEGAL_FOLDER = "legal";

/** The one place where the path of a text is built (publication script included). */
export function legalContentUri(
  document: PublicDocument,
  locale: UiLocale,
  versionLabel: string,
): string {
  if (!TERMS_VERSION_LABEL_PATTERN.test(versionLabel)) {
    throw new Error("malformed version label");
  }
  return `${LEGAL_FOLDER}/${document}/${locale}/${versionLabel}.md`;
}

/** Absolute path of a content_uri under `root`, or null when it would leave the legal folder. */
export function legalContentPath(
  root: string,
  contentUri: string,
): string | null {
  const folder = path.resolve(root, LEGAL_FOLDER);
  const file = path.resolve(root, ...contentUri.split("/"));
  return file.startsWith(folder + path.sep) ? file : null;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
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
export type TermsContentFailure =
  | "unexpected_row"
  | "content_uri_mismatch"
  | "content_missing"
  | "content_unreadable"
  | "content_hash_mismatch"
  | "content_malformed";

/** The text of a version in force failed its check: answered as a 500, nothing is served. */
export class TermsContentError extends Error {
  readonly failure: TermsContentFailure;

  constructor(failure: TermsContentFailure) {
    super("published document failed its content check");
    this.name = "TermsContentError";
    this.failure = failure;
  }
}

export type TermsLogger = {
  error(object: object, message: string): void;
};

export type TermsReader = {
  /** The version in force, or null when none is published (in the language nor in English). */
  current(
    query: CurrentTermsQuery,
    requestId: string,
    logger: TermsLogger,
  ): Promise<CurrentTermsResponse | null>;
};

/** Bound of the memory cache: a handful of versions exist; never more than this kept. */
const MAX_CACHED_VERSIONS = 64;

const UTF8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** A text that passed its check, and the language it is in. */
type VerifiedContent = { content: string; locale: UiLocale };

async function readVerifiedContent(
  root: string,
  query: CurrentTermsQuery,
  row: TermsVersionRow,
): Promise<VerifiedContent> {
  const served = uiLocaleSchema.safeParse(row.locale);
  if (
    !served.success ||
    row.documentKind !== query.document ||
    (served.data !== query.locale && served.data !== "en") ||
    !TERMS_VERSION_LABEL_PATTERN.test(row.versionLabel)
  ) {
    throw new TermsContentError("unexpected_row");
  }
  const expectedUri = legalContentUri(
    query.document,
    served.data,
    row.versionLabel,
  );
  const file = legalContentPath(root, expectedUri);
  if (row.contentUri !== expectedUri || file === null) {
    throw new TermsContentError("content_uri_mismatch");
  }
  let bytes: Buffer;
  try {
    bytes = await readFile(file);
  } catch (error) {
    const code =
      error instanceof Error && "code" in error ? error.code : undefined;
    throw new TermsContentError(
      code === "ENOENT" ? "content_missing" : "content_unreadable",
    );
  }
  if (sha256Hex(bytes) !== row.contentSha256) {
    throw new TermsContentError("content_hash_mismatch");
  }
  let content: string;
  try {
    content = UTF8.decode(bytes);
  } catch {
    throw new TermsContentError("content_malformed");
  }
  if (content.length === 0 || content.length > MAX_TERMS_CONTENT_LENGTH) {
    throw new TermsContentError("content_malformed");
  }
  return { content, locale: served.data };
}

export function createTermsReader(options: {
  lookup: TermsLookup;
  /** apps/api in production; a temporary folder in the route tests. */
  contentRoot: string;
}): TermsReader {
  const verified = new Map<string, VerifiedContent>();
  return {
    async current(query, requestId, logger) {
      const row = await options.lookup(query.document, query.locale, requestId);
      if (row === null) {
        return null;
      }
      let text = verified.get(row.id);
      if (text === undefined) {
        try {
          text = await readVerifiedContent(options.contentRoot, query, row);
        } catch (error) {
          if (error instanceof TermsContentError) {
            // 02 §20.8: the version and the reason; no text, no path, no personal data.
            logger.error(
              {
                document: query.document,
                locale: query.locale,
                versionLabel: row.versionLabel,
                reason: error.failure,
              },
              "published document failed its content check: not served",
            );
          }
          throw error;
        }
        if (verified.size >= MAX_CACHED_VERSIONS) {
          verified.clear();
        }
        verified.set(row.id, text);
      }
      return {
        id: row.id,
        document: query.document,
        locale: text.locale,
        isFallback: text.locale !== query.locale,
        versionLabel: row.versionLabel,
        effectiveFrom: row.effectiveFrom,
        requiresAcceptance: row.requiresAcceptance,
        contentSha256: row.contentSha256,
        content: text.content,
      };
    },
  };
}
