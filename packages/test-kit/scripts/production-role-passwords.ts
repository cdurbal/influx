// `pnpm --filter @influx/test-kit prod:role-passwords -- --ref=<project ref> --host=<pooler host>
// --confirm=<project ref>` (docs/mvp/runbooks/production.md, section 2; 03 P7 rule 5 of 0001).
// The founder's action, after the first « Migrate production » (the five roles come from 0001,
// 0016 and 0136): never run by an agent, never by the CI. Twin of staging-role-passwords.ts, with
// the differences production needs:
// - NOTHING is read from apps/api/.env.local (values of staging, D70): the ref and the pooler host
//   are arguments, and --confirm repeats the ref;
// - the ref of staging (SUPABASE_URL of apps/api/.env.local, when the file exists) is refused;
// - the output file says « PRODUCTION » and never sends a URL to .env.local.
// Writes, once, to .operator-secrets/ (ignored by Git, never printed): the SQL to run in the SQL
// editor of the PRODUCTION project (SCRAM verifiers only), then the five URLs for Railway,
// environment production, one service per variable. Running it again rotates every password:
// apply both parts again, then redeploy api and worker. The core: src/db/hosted-role-passwords.ts.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  drawHostedRolePasswords,
  supabaseRefOfEnvFile,
} from "../src/db/hosted-role-passwords.ts";
import {
  REPOSITORY_ROOT,
  writeOperatorSecrets,
} from "../src/operator-secrets.ts";

if (process.env.CI !== undefined && process.env.CI !== "") {
  throw new Error(
    "the production role passwords are the founder's action, never the CI's",
  );
}

const { values } = parseArgs({
  // `pnpm run x -- --a=1` may hand the `--` over: it is not an argument of this script.
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    ref: { type: "string" },
    host: { type: "string" },
    confirm: { type: "string" },
  },
});
const ref = values.ref ?? "";
const host = values.host ?? "";
if (ref === "" || host === "") {
  throw new Error(
    "--ref=<project ref of production> and --host=<region>.pooler.supabase.com are required " +
      "(nothing is read from apps/api/.env.local, which holds staging)",
  );
}
if (values.confirm !== ref) {
  throw new Error(
    "--confirm must repeat the project ref of production: refused",
  );
}
const stagingEnv = path.join(REPOSITORY_ROOT, "apps", "api", ".env.local");
if (
  existsSync(stagingEnv) &&
  supabaseRefOfEnvFile(readFileSync(stagingEnv, "utf8")) === ref
) {
  throw new Error(
    "this ref is the one of staging (apps/api/.env.local): refused",
  );
}

const { sql, urls } = drawHostedRolePasswords(ref, host);
const file = writeOperatorSecrets("production-role-passwords", [
  `-- 1. SQL editor of the PRODUCTION project ${ref} (verifiers only):`,
  ...sql,
  "",
  "# 2. Railway, environment PRODUCTION, ONE service per variable (never apps/api/.env.local):",
  ...urls,
  "",
  "# 3. Keep the five passwords in the password manager, redeploy api and worker, delete this file.",
]);
process.stdout.write(
  `five role passwords drawn for production ${ref}; SQL and URLs written to ${file} ` +
    "(ignored by Git, never print it; delete it once applied)\n",
);
