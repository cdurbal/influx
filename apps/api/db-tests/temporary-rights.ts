// Rights that some database tests grant for the time of a file, then revoke (J2 security review of
// 0009, V4). A run stopped between the two (Ctrl+C, crash) leaves them in the local stack; the next
// run must then fail at once with a message that says what to do, instead of turning T2.7 red for
// one run and passing the next (which would be taken for an unstable test).
// Keep this list equal to the rights that the tests grant: today, the M2 block of
// t3-audit-chain.test.ts. The BYPASSRLS attribute set by the S2 case of t4-roles.test.ts is caught
// by T4.1 in global-setup.ts.
import type postgres from "postgres";

/** EXECUTE on audit.append() granted by the M2 block, to roles that never hold it (0006 §9). */
export const APPEND_FUNCTION = "audit.append(text, text, uuid, jsonb)";
export const APPEND_TEMPORARY_GRANTEES = [
  "influx_admin",
  "influx_auth",
  "influx_worker",
] as const;
// No temporary USAGE on the schema audit any more: influx_admin holds it since 0006, influx_auth
// since 0011, and influx_worker since 0111 (J6, E-3: audit.append_elevated(), EC-52 (3)). The M2
// block grants EXECUTE on audit.append() only, and must never revoke a USAGE it did not grant.

export const INTERRUPTED_RUN_MESSAGE =
  "exécution précédente interrompue : des droits temporaires d'un test sont restés dans la " +
  "pile locale. Lancer `corepack pnpm exec supabase db reset` puis " +
  "`corepack pnpm db:role-passwords` (21 J2, revue de 0009, V4).";

/** The temporary rights found in the database, as `grantee: right` lines. */
export async function leftoverTemporaryRights(
  sql: postgres.Sql,
): Promise<string[]> {
  const rows = await sql<{ line: string }[]>`
    select a.grantee::regrole::text || ': EXECUTE on ' || ${APPEND_FUNCTION} as line
      from pg_catalog.pg_proc p, pg_catalog.aclexplode(p.proacl) a
     where p.oid = ${APPEND_FUNCTION}::regprocedure
       and a.grantee::regrole::text = any (${[...APPEND_TEMPORARY_GRANTEES]})
     order by 1`;
  return rows.map((row) => row.line);
}

/** Fails with INTERRUPTED_RUN_MESSAGE when a temporary right is still granted. */
export async function assertNoTemporaryRights(
  sql: postgres.Sql,
): Promise<void> {
  const leftovers = await leftoverTemporaryRights(sql);
  if (leftovers.length > 0) {
    throw new Error(`${INTERRUPTED_RUN_MESSAGE}\n${leftovers.join("\n")}`);
  }
}
