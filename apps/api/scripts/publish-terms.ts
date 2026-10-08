// `pnpm --filter @influx/api db:publish-terms -- --document=<kind> --locale=<fr|en> --label=<label>
// [--target=local|staging]`: publishes one version of a public document (docs/mvp/21 EC-62; 05
// RG23 to RG29). The transaction and the manifest are in terms-publication.ts.
//
// Targets:
//   local    (default) the local Supabase stack, with the guards of seed-demo-accounts.ts;
//   staging  INFLUX_STAGING_MIGRATION_URL (and INFLUX_STAGING_DB_CA_FILE) EXPORTED IN THE SHELL,
//            with the guards of seed-staging-demo-accounts.ts (marker table of the runbook).
// Production is refused: publishing there is the founder's action (J9).
//
// Refused, before any write: a document or a language outside the closed lists; a malformed
// label; a missing file; a file whose bytes differ from those legal/published.json recorded; a
// label already published for this document and language; on staging, a file that is not
// committed as it is (the api of staging serves the committed file, and would fail closed). On
// the local stack an uncommitted file is published with a warning: commit it with the manifest.
// `draft-*` labels are for the local stack and staging only, which is all this script reaches.
import { uiLocaleSchema } from "@influx/contracts/auth";
import {
  publicDocumentSchema,
  TERMS_VERSION_LABEL_PATTERN,
} from "@influx/contracts/terms";
import { connectAsMigrationRole, requireLocalStack } from "@influx/test-kit/db";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { parseArgs } from "node:util";
import { LEGAL_CONTENT_ROOT } from "../src/domains/identity/terms.ts";
import {
  assertStagingMarker,
  connectToStagingAsMigrationRole,
  refuseOutsideTheLocalStack,
  refuseProduction,
} from "./script-guards.ts";
import {
  assertMatchesManifest,
  publishedFileOf,
  publishTermsVersion,
  readManifest,
  recordInManifest,
  type PublicationRequest,
} from "./terms-publication.ts";

const REPOSITORY_ROOT = path.resolve(LEGAL_CONTENT_ROOT, "..", "..");

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

refuseProduction("terms publication");
const { values } = parseArgs({
  // `pnpm run x -- --a=1` may hand the `--` over: it is not an argument of this script.
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    document: { type: "string" },
    locale: { type: "string" },
    label: { type: "string" },
    target: { type: "string", default: "local" },
  },
});
const document = publicDocumentSchema.safeParse(values.document);
const locale = uiLocaleSchema.safeParse(values.locale);
const label = values.label ?? "";
if (
  !document.success ||
  !locale.success ||
  !TERMS_VERSION_LABEL_PATTERN.test(label)
) {
  throw new Error(
    "usage: --document=terms_of_service|privacy_policy|cookie_policy --locale=fr|en " +
      "--label=<[0-9A-Za-z._-]{1,40}> [--target=local|staging]",
  );
}
const target = values.target;
if (target !== "local" && target !== "staging") {
  throw new Error(
    "--target must be local or staging (production: J9, founder)",
  );
}
if (target === "local") {
  refuseOutsideTheLocalStack("terms publication");
}
const request: PublicationRequest = {
  document: document.data,
  locale: locale.data,
  label,
};

const published = publishedFileOf(request);
assertMatchesManifest(published, readManifest());
if (!isCommittedAsIs(published.file)) {
  if (target === "staging") {
    throw new Error(
      `${published.uri} is not committed as it is: commit it before publishing on staging`,
    );
  }
  process.stdout.write(
    `warning: ${published.uri} is not committed yet; commit it with legal/published.json\n`,
  );
}

if (target === "local") {
  await requireLocalStack();
}
const migration =
  target === "local"
    ? connectAsMigrationRole({ max: 1 })
    : connectToStagingAsMigrationRole();
try {
  if (target === "staging") {
    await assertStagingMarker(migration);
  }
  const outcome = await publishTermsVersion(migration, request, published);
  if (outcome.kind === "already_published") {
    throw new Error(
      `${request.document}/${request.locale} "${request.label}" is already published: ` +
        "a published label is never published again",
    );
  }
  recordInManifest(published);
  process.stdout.write(
    `published on ${target}: ${published.uri}  sha256 ${published.sha256}  id ${outcome.id}` +
      (outcome.closedVersionLabel === null
        ? "\n"
        : `  (closes "${outcome.closedVersionLabel}")\n`),
  );
} finally {
  await migration.end({ timeout: 1 });
}
