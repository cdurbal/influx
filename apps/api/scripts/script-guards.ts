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
    const host = new URL(supabaseUrl).hostname;
    if (host !== "127.0.0.1" && host !== "localhost" && host !== "[::1]") {
      throw new Error(`${what} refused outside the loopback (EC-45)`);
    }
  }
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
 * The migration role of STAGING, from INFLUX_STAGING_MIGRATION_URL (and the optional CA file of
 * EC-34). Nothing is read until assertStagingMarker() has run on it.
 */
export function connectToStagingAsMigrationRole(): postgres.Sql {
  const migrationUrl = new URL(
    requiredShellVariable("INFLUX_STAGING_MIGRATION_URL"),
  );
  const caFile = process.env.INFLUX_STAGING_DB_CA_FILE;
  return postgres(migrationUrl.href, {
    max: 1,
    prepare: false,
    ssl:
      caFile === undefined
        ? { rejectUnauthorized: true }
        : { rejectUnauthorized: true, ca: readFileSync(caFile, "utf8") },
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
