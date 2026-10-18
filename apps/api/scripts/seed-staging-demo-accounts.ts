// `pnpm --filter @influx/api db:staging-demo-accounts`: the demonstration accounts of the STAGING
// project (docs/mvp/21 §4 J4, "Terminé quand"; J3S-2 of the end-of-J3 security review): the two
// members and the FIRST admin only (EC-45, J8 commit 7): every other internal account is created
// by an invitation of that admin (15 RG99, POST /v1/bo/internal-invitations), never by a script.
// Variant of scripts/seed-demo-accounts.ts (local stack) with secrets that are never in the
// repository: the admin's password and enrollment token are drawn at random at each run and
// written ONCE to a file of .operator-secrets/ ignored by Git, never to the output (D70 commit 3).
//
// Run by an agent or the founder, from the machine; the inputs come from apps/api/.env.local
// (values of staging, D70), loaded by --env-file:
//   INFLUX_STAGING_MIGRATION_URL  connection of the migration role (postgres) of staging;
//   INFLUX_STAGING_DB_CA_FILE or DATABASE_CA_CERT  optional, the Supabase root certificate (a PEM
//                                 file, or its content) when the system store does not know it (EC-34);
//   SUPABASE_URL                  https://<ref>.supabase.co of staging;
//   SUPABASE_SECRET_KEY           a sb_secret_… key of staging;
//   INFLUX_PUBLIC_BACKOFFICE_URL  origin of the staging backoffice, for the activation links.
// and the three addresses as arguments: --advertiser= --creator= --admin=. The members receive
// their code by a real e-mail (staging is live, D70).
//
// Refused: when INFLUX_ENV or NODE_ENV says production; when the database does not carry the
// marker table `influx_staging.environment_marker` (created by hand by the runbook, never on production); when the
// Supabase URL is not an https *.supabase.co origin.
import { writeOperatorSecrets } from "@influx/test-kit/operator-secrets";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { localPasswordVerdict } from "../src/domains/identity/password-policy.ts";
import { isPasswordWithinBounds } from "../src/platform/supabase.ts";
import {
  demoAccounts,
  seedDemoAccounts,
  type DemoAccount,
} from "./demo-accounts.ts";
import {
  assertStagingMarker,
  connectToStagingAsMigrationRole,
  refuseProduction,
  requiredStagingVariable as required,
} from "./script-guards.ts";

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

refuseProduction("demo accounts (J3S-2)");
const { values } = parseArgs({
  // `pnpm run x -- --a=1` may hand the `--` over: it is not an argument of this script.
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    advertiser: { type: "string" },
    creator: { type: "string" },
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
// J4S-5: the GoTrue key and the database belong to ONE project. A production key pasted by mistake
// next to the staging database would otherwise create the accounts in production.
const projectRef = supabaseUrl.hostname.slice(0, -".supabase.co".length);
const migrationUrl = new URL(required("INFLUX_STAGING_MIGRATION_URL"));
if (
  migrationUrl.hostname !== `db.${projectRef}.supabase.co` &&
  decodeURIComponent(migrationUrl.username) !== `postgres.${projectRef}`
) {
  throw new Error(
    "SUPABASE_URL and INFLUX_STAGING_MIGRATION_URL name two different projects: refused",
  );
}
const backoffice = new URL(required("INFLUX_PUBLIC_BACKOFFICE_URL")).origin;

// EC-45: no agent from a script; the agent is invited by this admin.
const bootstrap = demoAccounts().filter(
  (
    account,
  ): account is DemoAccount & { role: "advertiser" | "creator" | "admin" } =>
    account.role !== "agent",
);
const accounts: DemoAccount[] = bootstrap.map((account) => {
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

const migration = connectToStagingAsMigrationRole();
try {
  await assertStagingMarker(migration);
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
    const file = writeOperatorSecrets("staging-demo-accounts", [
      "Demonstration accounts of staging: keep them in the password manager, then delete this file.",
      ...accounts.map((account) => {
        const access =
          account.password === null
            ? "code by e-mail"
            : `password "${account.password}"  activation link ${backoffice}/activation#${account.enrollmentToken ?? ""} (72 h)`;
        return `  ${account.role.padEnd(10)}  ${account.email.padEnd(34)}  ${access}`;
      }),
    ]);
    process.stdout.write(
      `demo accounts created on staging (${accounts.map((account) => account.role).join(", ")}); ` +
        `their secrets are in ${file} (ignored by Git, never print it)\n`,
    );
  }
} finally {
  await migration.end({ timeout: 1 });
}
