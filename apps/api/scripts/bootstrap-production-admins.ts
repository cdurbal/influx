// `pnpm --filter @influx/api prod:bootstrap-admins -- --admin=<address> --admin-first-name=<name>
// --break-glass=<address> --country=<ISO 3166-1> [--language=fr|en] --confirm=<project ref>`:
// the FIRST admin and the break-glass account of the PRODUCTION project (03 MFA-10, B7; runbook
// production §0; EC-45). The founder's action, after the explicit agreement of CLAUDE.md §7 rule 4:
// never run by an agent, never by the CI. The core: internal-bootstrap.ts.
//
// Inputs EXPORTED IN THE SHELL for this run only, never read from a file (.env.local holds the
// values of staging only, D70):
//   INFLUX_PRODUCTION_MIGRATION_URL  connection of the migration role (postgres) of production;
//   INFLUX_PRODUCTION_DB_CA_FILE or DATABASE_CA_CERT  optional, the Supabase root certificate (EC-34);
//   SUPABASE_URL                     https://<ref>.supabase.co of production;
//   SUPABASE_SECRET_KEY              a sb_secret_… key of production;
//   INFLUX_PUBLIC_BACKOFFICE_URL     origin of the production backoffice, for the activation links.
//
// Refused, before any write: in the CI; a --confirm that is not the project ref of SUPABASE_URL; a
// key and a database of two projects; a database without influx_production.environment_marker
// = production, or with the marker table of staging; a
// database where any internal account (agent or admin) already exists: this is a bootstrap, the
// next accounts come by invitation. The passwords and activation links are written ONCE to
// .operator-secrets/ (ignored by Git), never to the output.
import { writeOperatorSecrets } from "@influx/test-kit/operator-secrets";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { randomInternalPassword } from "./demo-accounts.ts";
import {
  bootstrapInternalAdmins,
  type BootstrapAccount,
} from "./internal-bootstrap.ts";
import {
  connectAsHostedMigrationRole,
  hostedGoTrue,
  requiredShellVariable,
  urlOf,
} from "./script-guards.ts";

if (process.env.CI !== undefined && process.env.CI !== "") {
  throw new Error(
    "the production bootstrap is the founder's action, never the CI's",
  );
}
const { values } = parseArgs({
  // `pnpm run x -- --a=1` may hand the `--` over: it is not an argument of this script.
  args: process.argv.slice(2).filter((argument) => argument !== "--"),
  options: {
    admin: { type: "string" },
    "admin-first-name": { type: "string" },
    "break-glass": { type: "string" },
    country: { type: "string" },
    language: { type: "string", default: "en" },
    confirm: { type: "string" },
  },
});
const required = (name: keyof typeof values): string => {
  const value = values[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`--${name} is required`);
  }
  return value.trim();
};
const language = values.language;
if (language !== "fr" && language !== "en") {
  throw new Error("--language is fr or en");
}

const migrationUrlName = "INFLUX_PRODUCTION_MIGRATION_URL";
const gotrue = hostedGoTrue(
  requiredShellVariable,
  migrationUrlName,
  "production",
);
if (required("confirm") !== gotrue.projectRef) {
  throw new Error(
    "--confirm must be the project ref of SUPABASE_URL (the production project): refused",
  );
}
const backoffice = urlOf(
  "INFLUX_PUBLIC_BACKOFFICE_URL",
  requiredShellVariable("INFLUX_PUBLIC_BACKOFFICE_URL"),
).origin;

function newAccount(
  email: string,
  firstName: string,
  isBreakGlass: boolean,
): BootstrapAccount {
  const address = email.toLowerCase();
  return {
    email: address,
    password: randomInternalPassword(address),
    enrollmentToken: randomBytes(32).toString("base64url"),
    firstName,
    isBreakGlass,
  };
}
const admin = newAccount(
  required("admin"),
  required("admin-first-name"),
  false,
);
const breakGlass = newAccount(required("break-glass"), "Break glass", true);

const migration = connectAsHostedMigrationRole(
  requiredShellVariable,
  migrationUrlName,
  "INFLUX_PRODUCTION_DB_CA_FILE",
);
try {
  // The marker of production (runbook production §1), and no trace of the staging one, as the
  // « Migrate production » job checks; two queries, a missing table fails at parse time.
  const [tables] = await migration<{ production: boolean; staging: boolean }[]>`
    select to_regclass('influx_production.environment_marker') is not null as production,
           to_regclass('influx_staging.environment_marker') is not null as staging`;
  const markers =
    tables?.production === true && tables.staging === false
      ? await migration<{ environment: string }[]>`
          select environment from influx_production.environment_marker`
      : [];
  if (markers.length !== 1 || markers[0]?.environment !== "production") {
    throw new Error(
      "this database does not carry influx_production.environment_marker = production alone: refused",
    );
  }
  const [internal] = await migration<{ count: number }[]>`
    select count(*)::int as count from identity.account_roles
     where role in ('agent', 'admin')`;
  if (internal?.count !== 0) {
    throw new Error(
      "internal accounts already exist: the bootstrap runs once, the next accounts are invited (15 RG99)",
    );
  }
  await bootstrapInternalAdmins(migration, gotrue, {
    admin,
    breakGlass,
    countryCode: required("country").toUpperCase(),
    preferredLanguage: language,
  });
  const line = (label: string, account: BootstrapAccount) =>
    `  ${label.padEnd(12)}  ${account.email}  password "${account.password}"  ` +
    `activation link ${backoffice}/activation#${account.enrollmentToken} (72 h)`;
  const file = writeOperatorSecrets("production-admin-bootstrap", [
    "Production bootstrap: enroll each TOTP within 72 hours, keep the passwords in the password",
    "manager, then delete this file. Break-glass: TOTP on an offline device, recovery codes printed",
    "and sealed, stored apart from the device (03 MFA-10). Write the bootstrap to the incident register.",
    line("admin", admin),
    line("break-glass", breakGlass),
  ]);
  process.stdout.write(
    `admin and break-glass account created on production; their secrets are in ${file} ` +
      "(ignored by Git, never print it)\n",
  );
} finally {
  await migration.end({ timeout: 1 });
}
