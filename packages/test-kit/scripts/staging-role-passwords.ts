// `pnpm --filter @influx/test-kit staging:role-passwords [-- --ref=<project ref> --host=<pooler host>]`
// (docs/mvp/runbooks/staging.md, step 3; 03 P7 rule 5 of 0001: no password in a migration).
// Draws one random password per connection role of the STAGING project and writes, once, to a file
// of .operator-secrets/ ignored by Git (D70 commit 3: never in the output):
// 1. the SQL to run on the database of staging: SCRAM verifiers only, so that no clear password is
//    ever sent to the database nor kept in its statement logs;
// 2. the five connection URLs, through the Supavisor pooler (transaction mode, port 6543), to set
//    on the ONE Railway service that reads each of them (02 §12.3).
// The project ref and the pooler host default to those of apps/api/.env.local (values of staging,
// loaded by --env-file): the ref of SUPABASE_URL, the host of DATABASE_URL. Running it again
// rotates every password: apply both parts again.
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { writeOperatorSecrets } from "../src/operator-secrets.ts";
import {
  SCRAM_VERIFIER_PATTERN,
  scramSha256Verifier,
} from "../src/db/scram.ts";

/** Connection role → variable → Railway service (02 §12.3, EC-20). */
const ROLES = [
  ["influx_app", "DATABASE_URL", "api"],
  ["influx_auth_login", "AUTH_DATABASE_URL", "api"],
  ["influx_ops_login", "OPS_DATABASE_URL", "api"],
  ["influx_worker_login", "WORKER_DATABASE_URL", "worker"],
  // J8 commit 8 (0136, 03 P7 E-5): the worker's second pool, never influx_worker_login.
  ["influx_privacy_login", "PRIVACY_DATABASE_URL", "worker"],
] as const;

if ([process.env.INFLUX_ENV, process.env.NODE_ENV].includes("production")) {
  throw new Error("role passwords refused in production (staging only)");
}

/** The part of an environment URL that is not secret: its host, or its project ref. */
function hostOf(variable: string): string {
  const value = process.env[variable];
  return value === undefined || value === "" ? "" : new URL(value).hostname;
}

const { values } = parseArgs({
  // `pnpm run x -- --a=1` may hand the `--` over: it is not an argument of this script.
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: { ref: { type: "string" }, host: { type: "string" } },
});
const ref = values.ref ?? hostOf("SUPABASE_URL").replace(/\.supabase\.co$/, "");
const host = values.host ?? hostOf("DATABASE_URL");
if (
  !/^[a-z0-9]{20}$/.test(ref) ||
  !/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host)
) {
  throw new Error(
    "the project ref (SUPABASE_URL of apps/api/.env.local, or --ref=) and the pooler host " +
      "(DATABASE_URL, or --host=<region>.pooler.supabase.com) are required",
  );
}

const sql: string[] = [];
const urls: string[] = [];
for (const [role, variable, service] of ROLES) {
  const password = randomBytes(32).toString("base64url");
  const verifier = scramSha256Verifier(password);
  if (!SCRAM_VERIFIER_PATTERN.test(verifier)) {
    throw new Error("malformed SCRAM verifier");
  }
  sql.push(`alter role ${role} with password '${verifier}';`);
  urls.push(
    `${service.padEnd(7)} ${variable}=postgresql://${role}.${ref}:${password}@${host}:6543/postgres`,
  );
}

const file = writeOperatorSecrets("staging-role-passwords", [
  "-- 1. Database of STAGING (verifiers only):",
  ...sql,
  "",
  "# 2. Railway, environment staging, ONE service per variable, and apps/api/.env.local:",
  ...urls,
]);
process.stdout.write(
  `five role passwords drawn for staging; SQL and URLs written to ${file} ` +
    "(ignored by Git, never print it; delete it once applied)\n",
);
