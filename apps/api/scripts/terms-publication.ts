// Publication of a public document version (docs/mvp/21 EC-62; 05 RG23 to RG29), shared by the
// operator script publish-terms.ts, the local demo seed (seed-demo-accounts.ts) and the database
// tests that need a version in force. Under the migration role, ONE transaction:
//   1. a label already published for (document, locale) is never published again;
//   2. the version in force of the same (document, locale) gets effective_to = now();
//   3. the new version is inserted, published_at = effective_from = now(), content_uri = the path
//      rebuilt by legalContentUri(), content_hash = SHA-256 of the exact bytes of the file.
// Then the manifest apps/api/legal/published.json records the path and its SHA-256: a file it
// lists can never change nor disappear (tests/legal-manifest.test.ts).
//
// The SHA-256 is computed HERE, once, from the bytes on disk; the API recomputes it at each first
// read and fails closed on any difference (src/domains/identity/terms.ts).
import type { UiLocale } from "@influx/contracts/auth";
import type { PublicDocument } from "@influx/contracts/terms";
import type { connectAsMigrationRole } from "@influx/test-kit/db";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  LEGAL_CONTENT_ROOT,
  legalContentPath,
  legalContentUri,
  sha256Hex,
} from "../src/domains/identity/terms.ts";

/** The manifest of every published text: content_uri → SHA-256 (hexadecimal). */
export const LEGAL_MANIFEST_FILE = path.join(
  LEGAL_CONTENT_ROOT,
  "legal",
  "published.json",
);

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
};

/** The file of a request, read once: refused when it does not exist. */
export function publishedFileOf(
  request: PublicationRequest,
  root: string = LEGAL_CONTENT_ROOT,
): PublishedFile {
  const uri = legalContentUri(request.document, request.locale, request.label);
  const file = legalContentPath(root, uri);
  if (file === null || !existsSync(file)) {
    throw new Error(`${uri}: no such file`);
  }
  return { uri, file, sha256: sha256Hex(readFileSync(file)) };
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

/** Records the file in the manifest (sorted keys, LF); a no-op when it is already there. */
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
  const sorted = Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
}

export type PublicationOutcome =
  | { kind: "published"; id: string; closedVersionLabel: string | null }
  | { kind: "already_published" };

/** Steps 1 to 3 of the head of this file, in one transaction of the migration role. */
export async function publishTermsVersion(
  migration: MigrationSql,
  request: PublicationRequest,
  published: PublishedFile,
): Promise<PublicationOutcome> {
  return migration.begin(async (tx) => {
    const existing = await tx<{ id: string }[]>`
      select id::text from identity.terms_versions
       where document_kind = ${request.document}::identity.document_kind
         and locale = ${request.locale} and version_label = ${request.label}`;
    if (existing.length > 0) {
      return { kind: "already_published" } as const;
    }
    const closed = await tx<{ version_label: string }[]>`
      update identity.terms_versions set effective_to = now()
       where document_kind = ${request.document}::identity.document_kind
         and locale = ${request.locale} and effective_to is null
      returning version_label`;
    const [inserted] = await tx<{ id: string }[]>`
      insert into identity.terms_versions
        (document_kind, locale, version_label, content_uri, content_hash, requires_acceptance,
         published_at, effective_from)
      values (${request.document}::identity.document_kind, ${request.locale}, ${request.label},
              ${published.uri}, decode(${published.sha256}, 'hex'),
              ${REQUIRES_ACCEPTANCE[request.document]}, now(), now())
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

/** The drafts the local demo seed publishes (seed-demo-accounts.ts): three documents, FR and EN. */
export const LOCAL_SEED_DRAFTS: readonly PublicationRequest[] = (
  ["terms_of_service", "privacy_policy", "cookie_policy"] as const
).flatMap((document) =>
  (["fr", "en"] as const).map((locale) => ({
    document,
    locale,
    label: "draft-1",
  })),
);

/**
 * Publishes `request` unless its label is already published, and records it in the manifest:
 * the idempotent form, for the local seed. Returns what it did.
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
 * For the database tests: publishes `request` only when NO version of its document is in force
 * in its language, so that a version published on the workstation is never replaced. The
 * manifest is not touched (the file must already be listed there).
 */
export async function ensureInForce(
  migration: MigrationSql,
  request: PublicationRequest,
): Promise<void> {
  const [current] = await migration<{ id: string }[]>`
    select id::text from identity.terms_versions
     where document_kind = ${request.document}::identity.document_kind
       and locale = ${request.locale} and effective_to is null and effective_from <= now()`;
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
