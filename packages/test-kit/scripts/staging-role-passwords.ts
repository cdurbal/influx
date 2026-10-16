// `pnpm --filter @influx/test-kit staging:role-passwords -- --ref=<project ref> --host=<pooler host>`
// (docs/mvp/runbooks/staging.md, step 3; 03 P7 rule 5 of 0001: no password in a migration).
// Draws one random password per connection role of the STAGING project and prints, once:
// 1. the SQL to paste in the Supabase SQL editor of staging: SCRAM verifiers only, so that no
//    clear password is ever sent to the database nor kept in its statement logs;
// 2. the five connection URLs, through the Supavisor pooler (transaction mode, port 6543), to set
//    on the ONE Railway service that reads each of them (02 §12.3).
// Nothing is written to disk. Running it again rotates every password: paste both outputs again.
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
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

const { values } = parseArgs({
  options: { ref: { type: "string" }, host: { type: "string" } },
});
const ref = values.ref ?? "";
const host = values.host ?? "";
if (
  !/^[a-z0-9]{20}$/.test(ref) ||
  !/^[a-z0-9.-]+\.pooler\.supabase\.com$/.test(host)
) {
  throw new Error(
    "--ref=<20-character project ref> and --host=<region>.pooler.supabase.com are required",
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

process.stdout.write(
  [
    "-- 1. Supabase SQL editor of STAGING (verifiers only):",
    ...sql,
    "",
    "# 2. Railway, environment staging, ONE service per variable (shown once):",
    ...urls,
    "",
  ].join("\n"),
);
