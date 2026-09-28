// T11 on build artifacts (docs/mvp/03-matrice-des-droits-et-rls.md §8, docs/mvp/18 §3 T11,
// docs/mvp/21-plan-de-developpement.md §4, J1-H). Run after `next build`, by the
// `test:artifacts` script of each front.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { listFiles, relativePath } from "./guards.ts";

/** Names that must never appear in code shipped to the browser (`.next/static`). */
export const BROWSER_FORBIDDEN_NAMES: readonly string[] = [
  "SUPABASE_",
  "BREVO_",
  "APOLLO_",
  "SERVICE_ROLE",
  // Former name, kept so that a revived one is still caught (EC-24).
  "SESSION_COOKIE_SECRET",
  // J3 commit 4 (skill env-secrets, CI-2), then commit 7, which replaces SESSION_COOKIE_SECRET
  // (03 T11, EC-24).
  "AUTH_THROTTLE_PEPPER",
  "AUTH_TOKEN_SIGNING_SECRET",
  // The prefix of a Supabase secret key VALUE (EC-46): a key read on the wrong side is caught
  // even under another variable name.
  "sb_secret_",
  "DATABASE_URL",
  "INFLUX_API_INTERNAL_",
];

/** Three base64url segments, the first two starting like a JSON object ("eyJ" encodes '{"'). */
export const JWT_PATTERN = /eyJ[\w-]{8,}\.eyJ[\w-]{8,}\.[\w-]{8,}/;

/** A Postgres connection string with credentials (anything before an "@"). */
export const POSTGRES_URL_PATTERN = /postgres(?:ql)?:\/\/[^\s"'`<>]*@/;

/**
 * Scans the `.next` directory of a front after its build. Returns one finding per offending
 * file and rule; an empty list means T11 holds. Throws when the build output is missing, so that
 * a skipped build can never pass for a clean one.
 */
export function scanBuildArtifacts(nextDirectory: string): string[] {
  const staticDirectory = path.join(nextDirectory, "static");
  if (!existsSync(staticDirectory)) {
    throw new Error(
      `No build output in ${nextDirectory}: run the build before test:artifacts.`,
    );
  }
  const root = path.dirname(nextDirectory);
  const findings: string[] = [];

  for (const file of listFiles(staticDirectory)) {
    // latin1 maps every byte to one character: binary files are read safely.
    const content = readFileSync(file, "latin1");
    for (const name of BROWSER_FORBIDDEN_NAMES) {
      if (content.includes(name)) {
        findings.push(`${relativePath(root, file)}: server name ${name}`);
      }
    }
  }

  for (const file of listFiles(nextDirectory)) {
    const content = readFileSync(file, "latin1");
    if (JWT_PATTERN.test(content)) {
      findings.push(`${relativePath(root, file)}: JWT-like string`);
    }
    if (POSTGRES_URL_PATTERN.test(content)) {
      findings.push(`${relativePath(root, file)}: Postgres connection string`);
    }
  }

  return findings;
}
