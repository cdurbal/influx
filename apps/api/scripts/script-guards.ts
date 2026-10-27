// Guards shared by the operator scripts that write with the migration role: the demonstration
// accounts (seed-demo-accounts.ts, seed-staging-demo-accounts.ts; EC-45, J3S-2) and the
// publication of the public documents (publish-terms.ts; 21 EC-62). Each one refuses production
// BEFORE anything is read; the local ones refuse any Supabase outside the loopback; the staging
// ones refuse a database without the marker table of the runbook (docs/mvp/runbooks/staging.md).
import { readFileSync } from "node:fs";
// An operator script, outside the api process: the migration role of staging, which no pool of
// src/db/ may ever reach (CI-5, J3S-2).
// eslint-disable-next-line no-restricted-imports -- see the line above
import postgres from "postgres";

/** `what` names the refused action in the message (« demo accounts », « terms publication »). */
export function refuseProduction(what: string): void {
  if ([process.env.INFLUX_ENV, process.env.NODE_ENV].includes("production")) {
    throw new Error(`${what} refused in production (EC-45)`);
  }
}

/** The local stack only: a SUPABASE_URL that is not the loopback is refused (EC-45). */
export function refuseOutsideTheLocalStack(what: string): void {
  refuseProduction(what);
  const supabaseUrl = process.env.SUPABASE_URL;
  if (supabaseUrl !== undefined && supabaseUrl !== "") {
    const host = urlOf("SUPABASE_URL", supabaseUrl).hostname;
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]") {
      throw new Error(`${what} refused outside the loopback (EC-45)`);
    }
  }
}

/**
 * A variable of apps/api/.env.local (values of staging, D70), loaded by the --env-file of the
 * staging scripts; a variable exported in the shell takes precedence (the CI step of staging).
 */
export function requiredStagingVariable(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(
      `${name} is missing from apps/api/.env.local (values of staging)`,
    );
  }
  return value;
}

/** Where the inputs of an operator script come from: .env.local (staging) or the shell (production). */
export type VariableSource = (name: string) => string;

/**
 * The administration API of a hosted GoTrue, from SUPABASE_URL and SUPABASE_SECRET_KEY. J4S-5:
 * the key and the database (`migrationUrlName`) belong to ONE project; a production key pasted by
 * mistake next to the staging database would otherwise act on production, and conversely.
 */
export function hostedGoTrue(
  source: VariableSource,
  migrationUrlName: string,
  environment: "staging" | "production",
): { authUrl: string; secretKey: string; projectRef: string } {
  const supabaseUrl = urlOf("SUPABASE_URL", source("SUPABASE_URL"));
  if (
    supabaseUrl.protocol !== "https:" ||
    !supabaseUrl.hostname.endsWith(".supabase.co")
  ) {
    throw new Error(
      `SUPABASE_URL must be the https origin of the ${environment} project`,
    );
  }
  const projectRef = supabaseUrl.hostname.slice(0, -".supabase.co".length);
  const migrationUrl = urlOf(migrationUrlName, source(migrationUrlName));
  if (
    migrationUrl.hostname !== `db.${projectRef}.supabase.co` &&
    decodeURIComponent(migrationUrl.username) !== `postgres.${projectRef}`
  ) {
    throw new Error(
      `SUPABASE_URL and ${migrationUrlName} name two different projects: refused`,
    );
  }
  return {
    authUrl: `${supabaseUrl.origin}/auth/v1`,
    secretKey: source("SUPABASE_SECRET_KEY"),
    projectRef,
  };
}

/** hostedGoTrue() of STAGING, from apps/api/.env.local. */
export function stagingGoTrue(): { authUrl: string; secretKey: string } {
  const { authUrl, secretKey } = hostedGoTrue(
    requiredStagingVariable,
    "INFLUX_STAGING_MIGRATION_URL",
    "staging",
  );
  return { authUrl, secretKey };
}

/**
 * A URL variable parsed without ever echoing it: `new URL()` puts its input (a database password
 * included) in the TypeError that Node prints (D70 end-of-work review, S2).
 */
export function urlOf(name: string, value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL (value not shown)`);
  }
}

/** requiredStagingVariable() parsed as a URL by urlOf(). */
export function requiredStagingUrl(name: string): URL {
  return urlOf(name, requiredStagingVariable(name));
}

/** A variable that must be exported in the shell, never written to a file. */
export function requiredShellVariable(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} must be exported in the shell (never in a file)`);
  }
  return value;
}

/**
 * The migration role of a hosted project, from `migrationUrlName`, with the root certificate of
 * EC-34 when one is given (`caFileName`, a PEM file, or DATABASE_CA_CERT, its content). Nothing is
 * read until the caller has checked which database this is (marker table).
 */
export function connectAsHostedMigrationRole(
  source: VariableSource,
  migrationUrlName: string,
  caFileName: string,
): postgres.Sql {
  const migrationUrl = urlOf(migrationUrlName, source(migrationUrlName));
  const caFile = process.env[caFileName];
  const ca =
    caFile === undefined || caFile === ""
      ? process.env.DATABASE_CA_CERT
      : readFileSync(caFile, "utf8");
  return postgres(migrationUrl.href, {
    max: 1,
    prepare: false,
    ssl:
      ca === undefined || ca === ""
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: true, ca },
    onnotice: () => undefined,
  });
}

/** connectAsHostedMigrationRole() of STAGING (INFLUX_STAGING_MIGRATION_URL, _DB_CA_FILE). */
export function connectToStagingAsMigrationRole(): postgres.Sql {
  return connectAsHostedMigrationRole(
    requiredStagingVariable,
    "INFLUX_STAGING_MIGRATION_URL",
    "INFLUX_STAGING_DB_CA_FILE",
  );
}

/**
 * Hosted Supabase refuses custom parameters (ALTER DATABASE / ROLE SET), so the marker is a table
 * created by hand on staging only, outside every migration (runbook, step 2). Two queries: a
 * reference to a missing table fails at parse time, even in a branch not taken.
 */
export async function assertStagingMarker(sql: postgres.Sql): Promise<void> {
  if (!(await carriesStagingMarker(sql))) {
    throw new Error(
      "this database does not carry the influx_staging.environment_marker = staging: refused (runbook, step 2)",
    );
  }
}

/** True when the database carries the marker table of staging with its single `staging` row. */
export async function carriesStagingMarker(
  sql: postgres.Sql,
): Promise<boolean> {
  const [table] = await sql<{ present: boolean }[]>`
    select to_regclass('influx_staging.environment_marker') is not null as present`;
  const markers =
    table?.present === true
      ? await sql<{ environment: string }[]>`
          select environment from influx_staging.environment_marker`
      : [];
  return markers.length === 1 && markers[0]?.environment === "staging";
}
