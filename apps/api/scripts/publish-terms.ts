// `pnpm --filter @influx/api db:publish-terms -- --document=<kind> --locale=<fr|en> --label=<label>
// [--target=local|staging|production --confirm=<project ref>]`: publishes one version of a public
// document (docs/mvp/21 EC-62 and its amendment; 05 RG23 to RG29), its exact text included. On a
// label published WITHOUT its text (before 0109), fills the text instead. The transaction and the
// manifest: terms-publication.ts.
//
// `… db:publish-terms -- --latest [--target=local|staging|production --confirm=<project ref>]`:
// the idempotent form, for the CI step of staging after `supabase db push` (EC-62 (C)), or for the
// founder on production once every latest entry of legal/published.json is a non-draft version: for
// each (document, locale), the last entry of legal/published.json is published, or its text filled,
// or left as it is.
//
// Targets:
//   local       (default) the local Supabase stack, with the guards of seed-demo-accounts.ts;
//   staging     INFLUX_STAGING_MIGRATION_URL (and INFLUX_STAGING_DB_CA_FILE or DATABASE_CA_CERT),
//               from apps/api/.env.local through `db:publish-terms:staging` (D70 commit 3), or
//               exported by the CI step of staging; with the guards of seed-staging-demo-accounts.ts
//               (marker table of the runbook);
//   production  the founder's action (runbook production §12): refused in the CI; reads
//               INFLUX_PRODUCTION_MIGRATION_URL (and optional INFLUX_PRODUCTION_DB_CA_FILE or
//               DATABASE_CA_CERT) exported in the shell, requires --confirm=<project ref>, refuses
//               any draft-* label, draft notice or unreplaced `[…]` company marker (D25), requires
//               every file to be recorded in legal/published.json and committed in HEAD, and checks
//               influx_production.environment_marker = production (and no staging marker).
//
// Refused, before any write: a document or a language outside the closed lists; a malformed
// label; a missing file; a file that is not strict UTF-8 (byte order mark, invalid bytes); a file
// whose bytes differ from those legal/published.json recorded; with --document, a label already
// published with its text; on staging or production, a file that is not committed as it is. On the
// local stack an uncommitted file is published with a warning: commit it with the manifest.
import { uiLocaleSchema } from "@influx/contracts/auth";
import {
  publicDocumentSchema,
  TERMS_VERSION_LABEL_PATTERN,
} from "@influx/contracts/terms";
import { connectAsMigrationRole, requireLocalStack } from "@influx/test-kit/db";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  assertProductionMarker,
  assertStagingMarker,
  connectToProductionAsMigrationRole,
  connectToStagingAsMigrationRole,
  productionProjectRefOfMigrationUrl,
  refuseOutsideTheLocalStack,
  refuseProduction,
  requiredShellVariable,
} from "./script-guards.ts";
import {
  assertMatchesManifest,
  assertReadyForProduction,
  LEGAL_CONTENT_ROOT,
  LOCAL_SEED_DRAFTS,
  publishedFileOf,
  publishTermsVersion,
  readManifest,
  recordInManifest,
  type PublicationRequest,
  type PublishedFile,
} from "./terms-publication.ts";

const REPOSITORY_ROOT = path.resolve(LEGAL_CONTENT_ROOT, "..", "..");

const USAGE =
  "usage: --document=terms_of_service|privacy_policy|cookie_policy --locale=fr|en " +
  "--label=<[0-9A-Za-z._-]{1,40}> [--target=local|staging|production --confirm=<ref>], " +
  "or --latest [--target=local|staging|production --confirm=<ref>]";

/** True when `file` is in HEAD with exactly these bytes (blob ids compared). */
function isCommittedAsIs(file: string): boolean {
  const relative = path
    .relative(REPOSITORY_ROOT, file)
    .split(path.sep)
    .join("/");
  const git = (args: string[]) =>
    execFileSync("git", args, {
      cwd: REPOSITORY_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  let committed: string;
  try {
    committed = git(["rev-parse", "--verify", "--quiet", `HEAD:${relative}`]);
  } catch {
    // rev-parse exits with 1 when HEAD has no such path: the file is not committed.
    return false;
  }
  return committed === git(["hash-object", "--", relative]);
}

const { values } = parseArgs({
  // `pnpm run x -- --a=1` may hand the `--` over: it is not an argument of this script.
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    document: { type: "string" },
    locale: { type: "string" },
    label: { type: "string" },
    latest: { type: "boolean", default: false },
    target: { type: "string", default: "local" },
    confirm: { type: "string" },
  },
});
const target = values.target;
if (target !== "local" && target !== "staging" && target !== "production") {
  throw new Error("--target must be local, staging or production");
}
if (target !== "production") {
  refuseProduction("terms publication");
}
if (target === "local") {
  refuseOutsideTheLocalStack("terms publication");
}
if (target === "production") {
  if (process.env.CI !== undefined && process.env.CI !== "") {
    throw new Error(
      "publishing the public documents on production is the founder's action, never the CI's",
    );
  }
  const projectRef = productionProjectRefOfMigrationUrl(requiredShellVariable);
  if (values.confirm !== projectRef) {
    throw new Error(
      "--confirm must be the project ref of INFLUX_PRODUCTION_MIGRATION_URL (the production project): refused",
    );
  }
}

/** The requests of the command line: one version, or the latest of the manifest. */
function requestsOf(): readonly PublicationRequest[] {
  if (values.latest) {
    if (values.document !== undefined || values.locale !== undefined) {
      throw new Error(USAGE);
    }
    return LOCAL_SEED_DRAFTS;
  }
  const document = publicDocumentSchema.safeParse(values.document);
  const locale = uiLocaleSchema.safeParse(values.locale);
  const label = values.label ?? "";
  if (
    !document.success ||
    !locale.success ||
    !TERMS_VERSION_LABEL_PATTERN.test(label)
  ) {
    throw new Error(USAGE);
  }
  return [{ document: document.data, locale: locale.data, label }];
}

// Every file is read and checked before the database is reached.
const manifest = readManifest();
const files: { request: PublicationRequest; published: PublishedFile }[] =
  requestsOf().map((request) => {
    const published = publishedFileOf(request);
    assertMatchesManifest(published, manifest);
    if (target === "production") {
      assertReadyForProduction(request, published, manifest);
    }
    if (!isCommittedAsIs(published.file)) {
      if (target === "staging" || target === "production") {
        throw new Error(
          `${published.uri} is not committed as it is: commit it before publishing on ${target}`,
        );
      }
      process.stdout.write(
        `warning: ${published.uri} is not committed yet; commit it with legal/published.json\n`,
      );
    }
    return { request, published };
  });

if (target === "local") {
  await requireLocalStack();
}
const migration =
  target === "local"
    ? connectAsMigrationRole({ max: 1 })
    : target === "staging"
      ? connectToStagingAsMigrationRole()
      : connectToProductionAsMigrationRole();
try {
  if (target === "staging") {
    await assertStagingMarker(migration);
  } else if (target === "production") {
    await assertProductionMarker(migration);
  }
  for (const { request, published } of files) {
    const outcome = await publishTermsVersion(migration, request, published);
    if (outcome.kind === "already_published") {
      if (!values.latest) {
        throw new Error(
          `${request.document}/${request.locale} "${request.label}" is already published: ` +
            "a published label is never published again",
        );
      }
      process.stdout.write(`unchanged on ${target}: ${published.uri}\n`);
      continue;
    }
    recordInManifest(published);
    process.stdout.write(
      outcome.kind === "content_filled"
        ? `text filled on ${target}: ${published.uri}  sha256 ${published.sha256}  id ${outcome.id}\n`
        : `published on ${target}: ${published.uri}  sha256 ${published.sha256}  id ${outcome.id}` +
            (outcome.closedVersionLabel === null
              ? "\n"
              : `  (closes "${outcome.closedVersionLabel}")\n`),
    );
  }
} finally {
  await migration.end({ timeout: 1 });
}
