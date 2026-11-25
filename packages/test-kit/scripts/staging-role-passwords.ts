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
// rotates every password: apply both parts again. The production twin:
// production-role-passwords.ts. The core: src/db/hosted-role-passwords.ts.
import { parseArgs } from "node:util";
import { drawHostedRolePasswords } from "../src/db/hosted-role-passwords.ts";
import { writeOperatorSecrets } from "../src/operator-secrets.ts";

if ([process.env.INFLUX_ENV, process.env.NODE_ENV].includes("production")) {
  throw new Error("role passwords refused in production (staging only)");
}

/** The part of an environment URL that is not secret: its host, or its project ref. */
function hostOf(variable: string): string {
  const value = process.env[variable];
  if (value === undefined || value === "") {
    return "";
  }
  try {
    return new URL(value).hostname;
  } catch {
    // Never the TypeError of new URL(): it carries the input, a password included (D70 S2).
    throw new Error(`${variable} is not a valid URL (value not shown)`);
  }
}

const { values } = parseArgs({
  // `pnpm run x -- --a=1` may hand the `--` over: it is not an argument of this script.
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: { ref: { type: "string" }, host: { type: "string" } },
});
const ref = values.ref ?? hostOf("SUPABASE_URL").replace(/\.supabase\.co$/, "");
const host = values.host ?? hostOf("DATABASE_URL");

const { sql, urls } = drawHostedRolePasswords(ref, host);
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
