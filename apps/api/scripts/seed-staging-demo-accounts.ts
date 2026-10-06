// `pnpm --filter @influx/api db:staging-demo-accounts`: the four demonstration accounts of the
// STAGING project (docs/mvp/21 §4 J4, "Terminé quand"; J3S-2 of the end-of-J3 security review).
// Variant of scripts/seed-demo-accounts.ts (local stack) with secrets that are never in the
// repository: the passwords of the two internal accounts and their enrollment tokens are drawn
// at random at each run and printed ONCE, here, to the person who runs it.
//
// Run from the founder's or the developer's machine, with the variables EXPORTED IN THE SHELL
// (never written to a file, docs/mvp/runbooks/staging.md):
//   INFLUX_STAGING_MIGRATION_URL  direct connection of the migration role (postgres) of staging;
//   INFLUX_STAGING_DB_CA_FILE     optional, the Supabase root certificate (PEM) when the system
//                                 store does not know it (EC-34);
//   SUPABASE_URL                  https://<ref>.supabase.co of staging;
//   SUPABASE_SECRET_KEY           a sb_secret_… key of staging;
//   STAGING_PUBLIC_BACKOFFICE_URL origin of the staging backoffice, for the activation links.
// and the four addresses as arguments: --advertiser= --creator= --agent= --admin=. The member
// addresses must be listed in BREVO_TEST_RECIPIENTS of the staging api: the codes go there
// (BREVO_MODE=redirect).
//
// Refused: when INFLUX_ENV or NODE_ENV says production; when the database does not carry the
// marker `influx.environment = staging` (set once by the runbook, never on production); when the
// Supabase URL is not an https *.supabase.co origin.
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
// An operator script, outside the api process: the migration role of staging, which no pool of
// src/db/ may ever reach (CI-5, J3S-2).
// eslint-disable-next-line no-restricted-imports -- see the line above
import postgres from "postgres";
import { localPasswordVerdict } from "../src/domains/identity/password-policy.ts";
import { isPasswordWithinBounds } from "../src/platform/supabase.ts";
import {
  demoAccounts,
  seedDemoAccounts,
  type DemoAccount,
} from "./demo-accounts.ts";

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} must be exported in the shell (never in a file)`);
  }
  return value;
}

/** A random password that passes the local rules of B-1 and EC-57 for `email`. */
function randomPassword(email: string): string {
  for (;;) {
    const candidate = randomBytes(18).toString("base64url");
    if (
      isPasswordWithinBounds(candidate) &&
      localPasswordVerdict(candidate, email) === "accepted"
    ) {
      return candidate;
    }
  }
}

if ([process.env.INFLUX_ENV, process.env.NODE_ENV].includes("production")) {
  throw new Error("demo accounts are refused in production (EC-45, J3S-2)");
}
const { values } = parseArgs({
  options: {
    advertiser: { type: "string" },
    creator: { type: "string" },
    agent: { type: "string" },
    admin: { type: "string" },
  },
});
const supabaseUrl = new URL(required("SUPABASE_URL"));
if (
  supabaseUrl.protocol !== "https:" ||
  !supabaseUrl.hostname.endsWith(".supabase.co")
) {
  throw new Error(
    "SUPABASE_URL must be the https origin of the staging project",
  );
}
const backoffice = new URL(required("STAGING_PUBLIC_BACKOFFICE_URL")).origin;
const caFile = process.env.INFLUX_STAGING_DB_CA_FILE;

const accounts: DemoAccount[] = demoAccounts().map((account) => {
  const email = values[account.role];
  if (email === undefined || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`--${account.role}=<address> is required`);
  }
  return account.password === null
    ? { ...account, email: email.toLowerCase() }
    : {
        ...account,
        email: email.toLowerCase(),
        password: randomPassword(email),
        enrollmentToken: randomBytes(32).toString("base64url"),
      };
});

const migration = postgres(required("INFLUX_STAGING_MIGRATION_URL"), {
  max: 1,
  prepare: false,
  ssl:
    caFile === undefined
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: true, ca: readFileSync(caFile, "utf8") },
  onnotice: () => undefined,
});
try {
  const [marker] = await migration<{ environment: string | null }[]>`
    select current_setting('influx.environment', true) as environment`;
  if (marker?.environment !== "staging") {
    throw new Error(
      "this database does not carry influx.environment = staging: refused (runbook, step 2)",
    );
  }
  const outcome = await seedDemoAccounts(
    migration,
    {
      authUrl: `${supabaseUrl.origin}/auth/v1`,
      secretKey: required("SUPABASE_SECRET_KEY"),
    },
    accounts,
  );
  if (outcome === "already_present") {
    process.stdout.write(
      "demo accounts already present on staging: their secrets were shown at creation only.\n",
    );
  } else {
    process.stdout.write(
      "demo accounts created on staging. SHOWN ONCE, keep them in the password manager:\n",
    );
    for (const account of accounts) {
      const access =
        account.password === null
          ? "code by e-mail (Brevo redirect)"
          : `password "${account.password}"  activation link ${backoffice}/activation#${account.enrollmentToken ?? ""} (72 h)`;
      process.stdout.write(
        `  ${account.role.padEnd(10)}  ${account.email.padEnd(34)}  ${access}\n`,
      );
    }
  }
} finally {
  await migration.end({ timeout: 1 });
}
