// Publication of a public document version (docs/mvp/21 EC-62 and its amendment of 2026-10-08;
// 05 RG23 to RG29), shared by the operator scripts publish-terms.ts and publish-latest-terms.ts,
// the local demo seed (seed-demo-accounts.ts) and the database tests that need a version in force.
// Under the migration role, ONE transaction:
//   1. a label already published WITH its text is never published again; one published WITHOUT
//      its text (a row from before 0109) gets its text, once, and nothing else changes;
//   2. otherwise the version in force of the same (document, locale) gets effective_to = now(),
//   3. and the new version is inserted, published_at = effective_from = now(), content_uri = the
//      path of its file, content_hash = SHA-256 of the exact bytes, content = the exact text.
// Then the manifest apps/api/legal/published.json records the path and its SHA-256, APPENDED at
// its end: a file it lists can never change nor disappear (tests/legal-manifest.test.ts), and its
// last entry per (document, locale) is the version to publish (LOCAL_SEED_DRAFTS, CI).
//
// The text is decoded strictly: valid UTF-8, no byte order mark, and re-encoded it gives back
// the same bytes, so that its SHA-256 in the database (0109 constraint) IS the file's.
import { uiLocaleSchema, type UiLocale } from "@influx/contracts/auth";
import {
  MAX_TERMS_CONTENT_LENGTH,
  publicDocumentSchema,
  TERMS_VERSION_LABEL_PATTERN,
  type PublicDocument,
} from "@influx/contracts/terms";
import type { connectAsMigrationRole } from "@influx/test-kit/db";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "../src/domains/identity/terms.ts";

/** apps/api: the base of every content_uri (`legal/…`). */
export const LEGAL_CONTENT_ROOT = fileURLToPath(
  new URL("../", import.meta.url),
);

/** Folder of the published texts, under the content root. */
const LEGAL_FOLDER = "legal";

/** The manifest of every published text: content_uri → SHA-256 (hexadecimal), in order. */
export const LEGAL_MANIFEST_FILE = path.join(
  LEGAL_CONTENT_ROOT,
  LEGAL_FOLDER,
  "published.json",
);

/** A content_uri of the manifest: the document, the language and the label. */
const CONTENT_URI_PATTERN =
  /^legal\/(terms_of_service|privacy_policy|cookie_policy)\/(fr|en)\/([0-9A-Za-z._-]{1,40})\.md$/;

export type Manifest = Record<string, string>;

/** A connection of the migration role, local (@influx/test-kit/db) or staging (script-guards.ts). */
type MigrationSql = ReturnType<typeof connectAsMigrationRole>;

/** 0005 terms_versions_acceptance_by_kind: the terms are accepted, the others are informative. */
const REQUIRES_ACCEPTANCE: Readonly<Record<PublicDocument, boolean>> = {
  terms_of_service: true,
  privacy_policy: false,
  cookie_policy: false,
};

export type PublicationRequest = {
  document: PublicDocument;
  locale: UiLocale;
  label: string;
};

export type PublishedFile = {
  /** content_uri: `legal/<document>/<locale>/<label>.md`, relative to apps/api. */
  uri: string;
  /** Absolute path of the file. */
  file: string;
  sha256: string;
  /** The exact text: its UTF-8 bytes are the bytes of the file. */
  content: string;
};

/** The one place where the path of a text is built. */
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

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/**
 * The text of a file's bytes, or an error naming `uri`: not UTF-8, a byte order mark, a NUL
 * character, bytes that do not come back when re-encoded, or a length outside 1 to
 * MAX_TERMS_CONTENT_LENGTH.
 */
export function decodeLegalText(bytes: Uint8Array, uri: string): string {
  if (UTF8_BOM.every((byte, index) => bytes[index] === byte)) {
    throw new Error(`${uri} starts with a byte order mark: refused`);
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
      bytes,
    );
  } catch {
    throw new Error(`${uri} is not valid UTF-8: refused`);
  }
  // PostgreSQL text never holds U+0000 (a UTF-16 file of ASCII is valid UTF-8, with NULs).
  if (text.includes("\u0000")) {
    throw new Error(`${uri} holds a NUL character: refused`);
  }
  if (!Buffer.from(text, "utf8").equals(Buffer.from(bytes))) {
    throw new Error(`${uri} does not re-encode to the same bytes: refused`);
  }
  if (text.length === 0 || text.length > MAX_TERMS_CONTENT_LENGTH) {
    throw new Error(
      `${uri} must hold 1 to ${MAX_TERMS_CONTENT_LENGTH} characters`,
    );
  }
  return text;
}

/** The file of a request, read once: refused when it does not exist or is not strict UTF-8. */
export function publishedFileOf(
  request: PublicationRequest,
  root: string = LEGAL_CONTENT_ROOT,
): PublishedFile {
  const uri = legalContentUri(request.document, request.locale, request.label);
  const file = legalContentPath(root, uri);
  if (file === null || !existsSync(file)) {
    throw new Error(`${uri}: no such file`);
  }
  const bytes = readFileSync(file);
  return {
    uri,
    file,
    sha256: sha256Hex(bytes),
    content: decodeLegalText(bytes, uri),
  };
}

export function readManifest(file: string = LEGAL_MANIFEST_FILE): Manifest {
  if (!existsSync(file)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("legal/published.json is not an object");
  }
  const manifest: Manifest = {};
  for (const [uri, sha256] of Object.entries(parsed)) {
    if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) {
      throw new Error(`legal/published.json: malformed SHA-256 for ${uri}`);
    }
    manifest[uri] = sha256;
  }
  return manifest;
}

/**
 * The version to publish of each (document, locale): the LAST entry of the manifest, in the order
 * of the file (entries are only ever appended).
 */
export function latestPublications(
  manifest: Manifest,
): readonly PublicationRequest[] {
  const latest = new Map<string, PublicationRequest>();
  for (const uri of Object.keys(manifest)) {
    const match = CONTENT_URI_PATTERN.exec(uri);
    if (match === null) {
      throw new Error(`legal/published.json: malformed path ${uri}`);
    }
    const document = publicDocumentSchema.parse(match[1]);
    const locale = uiLocaleSchema.parse(match[2]);
    const label = match[3] ?? "";
    // Deleted then set again: a (document, locale) takes the place of its last entry.
    latest.delete(`${document}/${locale}`);
    latest.set(`${document}/${locale}`, { document, locale, label });
  }
  return [...latest.values()];
}

/** Refuses a file whose bytes differ from those the manifest recorded (a published text). */
export function assertMatchesManifest(
  published: PublishedFile,
  manifest: Manifest,
): void {
  const recorded = manifest[published.uri];
  if (recorded !== undefined && recorded !== published.sha256) {
    throw new Error(
      `${published.uri} differs from the published text recorded in legal/published.json: ` +
        "a published text never changes, publish a new label instead",
    );
  }
}

/** Appends the file to the manifest (2 spaces, LF); a no-op when it is already there. */
export function recordInManifest(
  published: PublishedFile,
  file: string = LEGAL_MANIFEST_FILE,
): void {
  const manifest = readManifest(file);
  assertMatchesManifest(published, manifest);
  if (manifest[published.uri] === published.sha256) {
    return;
  }
  manifest[published.uri] = published.sha256;
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export type PublicationOutcome =
  | { kind: "published"; id: string; closedVersionLabel: string | null }
  | { kind: "content_filled"; id: string }
  | { kind: "already_published" };

/** Steps 1 to 3 of the head of this file, in one transaction of the migration role. */
export async function publishTermsVersion(
  migration: MigrationSql,
  request: PublicationRequest,
  published: PublishedFile,
): Promise<PublicationOutcome> {
  return migration.begin(async (tx) => {
    const [existing] = await tx<{ id: string; has_content: boolean }[]>`
      select id::text, content is not null as has_content
        from identity.terms_versions
       where document_kind = ${request.document}::identity.document_kind
         and locale = ${request.locale} and version_label = ${request.label}
       for update`;
    if (existing !== undefined) {
      if (existing.has_content) {
        return { kind: "already_published" } as const;
      }
      // A row published before 0109: its text, once (immutability trigger); the hash constraint
      // refuses any text other than the one fingerprinted at publication.
      await tx`
        update identity.terms_versions set content = ${published.content}
         where id = ${existing.id} and content is null`;
      return { kind: "content_filled", id: existing.id } as const;
    }
    const closed = await tx<{ version_label: string }[]>`
      update identity.terms_versions set effective_to = now()
       where document_kind = ${request.document}::identity.document_kind
         and locale = ${request.locale} and effective_to is null
      returning version_label`;
    const [inserted] = await tx<{ id: string }[]>`
      insert into identity.terms_versions
        (document_kind, locale, version_label, content_uri, content_hash, requires_acceptance,
         published_at, effective_from, content)
      values (${request.document}::identity.document_kind, ${request.locale}, ${request.label},
              ${published.uri}, decode(${published.sha256}, 'hex'),
              ${REQUIRES_ACCEPTANCE[request.document]}, now(), now(), ${published.content})
      returning id::text`;
    if (inserted === undefined) {
      throw new Error("terms version not inserted");
    }
    return {
      kind: "published",
      id: inserted.id,
      closedVersionLabel: closed[0]?.version_label ?? null,
    } as const;
  });
}

/**
 * The versions the local demo seed and the CI step of staging publish: the last entry of
 * legal/published.json per (document, locale).
 */
export const LOCAL_SEED_DRAFTS: readonly PublicationRequest[] =
  latestPublications(readManifest());

/**
 * Publishes `request`, or fills its text when it was published without, unless it is already
 * published with its text; then records it in the manifest. The idempotent form.
 */
export async function publishUnlessPublished(
  migration: MigrationSql,
  request: PublicationRequest,
): Promise<PublicationOutcome> {
  const published = publishedFileOf(request);
  assertMatchesManifest(published, readManifest());
  const outcome = await publishTermsVersion(migration, request, published);
  recordInManifest(published);
  return outcome;
}

/**
 * For the database tests: publishes `request` (or fills its text) only when NO version of its
 * document is in force WITH its text in its language, so that a version published on the
 * workstation is never replaced. The manifest is not touched (the file must be listed there).
 */
export async function ensureInForce(
  migration: MigrationSql,
  request: PublicationRequest,
): Promise<void> {
  const [current] = await migration<{ id: string }[]>`
    select id::text from identity.terms_versions
     where document_kind = ${request.document}::identity.document_kind
       and locale = ${request.locale} and effective_to is null and effective_from <= now()
       and content is not null`;
  if (current !== undefined) {
    return;
  }
  const published = publishedFileOf(request);
  const manifest = readManifest();
  if (manifest[published.uri] !== published.sha256) {
    throw new Error(
      `${published.uri} is not listed as it is in legal/published.json`,
    );
  }
  await publishTermsVersion(migration, request, published);
}
