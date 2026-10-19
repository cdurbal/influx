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

/**
 * The administration API of the STAGING GoTrue, from SUPABASE_URL and SUPABASE_SECRET_KEY. J4S-5:
 * the key and the database belong to ONE project; a production key pasted by mistake next to the
 * staging database would otherwise act on production.
 */
export function stagingGoTrue(): { authUrl: string; secretKey: string } {
  const supabaseUrl = requiredStagingUrl("SUPABASE_URL");
  if (
    supabaseUrl.protocol !== "https:" ||
    !supabaseUrl.hostname.endsWith(".supabase.co")
  ) {
    throw new Error(
      "SUPABASE_URL must be the https origin of the staging project",
    );
  }
  const projectRef = supabaseUrl.hostname.slice(0, -".supabase.co".length);
  const migrationUrl = requiredStagingUrl("INFLUX_STAGING_MIGRATION_URL");
  if (
    migrationUrl.hostname !== `db.${projectRef}.supabase.co` &&
    decodeURIComponent(migrationUrl.username) !== `postgres.${projectRef}`
  ) {
    throw new Error(
      "SUPABASE_URL and INFLUX_STAGING_MIGRATION_URL name two different projects: refused",
    );
  }
  return {
    authUrl: `${supabaseUrl.origin}/auth/v1`,
    secretKey: requiredStagingVariable("SUPABASE_SECRET_KEY"),
  };
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
 * The migration role of STAGING, from INFLUX_STAGING_MIGRATION_URL, with the root certificate of
 * EC-34 when one is given (INFLUX_STAGING_DB_CA_FILE, a PEM file, or DATABASE_CA_CERT, its
 * content). Nothing is read until assertStagingMarker() has run on it.
 */
export function connectToStagingAsMigrationRole(): postgres.Sql {
  const migrationUrl = requiredStagingUrl("INFLUX_STAGING_MIGRATION_URL");
  const caFile = process.env.INFLUX_STAGING_DB_CA_FILE;
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

/**
 * Hosted Supabase refuses custom parameters (ALTER DATABASE / ROLE SET), so the marker is a table
 * created by hand on staging only, outside every migration (runbook, step 2). Two queries: a
 * reference to a missing table fails at parse time, even in a branch not taken.
 */
export async function assertStagingMarker(sql: postgres.Sql): Promise<void> {
  const [table] = await sql<{ present: boolean }[]>`
    select to_regclass('influx_staging.environment_marker') is not null as present`;
  const markers =
    table?.present === true
      ? await sql<{ environment: string }[]>`
          select environment from influx_staging.environment_marker`
      : [];
  if (markers.length !== 1 || markers[0]?.environment !== "staging") {
    throw new Error(
      "this database does not carry the influx_staging.environment_marker = staging: refused (runbook, step 2)",
    );
  }
}
