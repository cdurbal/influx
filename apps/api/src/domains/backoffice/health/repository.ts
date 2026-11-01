// Database access of the "Santé technique" screen (docs/mvp/02 §20.5; migration 0148): the five
// functions of backoffice.ops_*, called under the backoffice session of an admin, in the
// transaction of the route (withBackofficeSession). Each answers one jsonb document; this module
// hands it back AS IT CAME — reading it through a schema and shaping it for the contract is the work
// of ../ops-health.ts, which never touches the database. Every value is a bound parameter (S-1).
// Nothing is written: the functions are STABLE and executable by influx_admin alone.
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

async function jsonOf(
  tx: Transaction,
  statement: ReturnType<typeof sql>,
): Promise<unknown> {
  const rows = await tx.execute<{ answer: unknown }>(statement);
  return rows[0]?.answer;
}

/** The probe, the worker, the periodic tasks and the open technical alerts. */
export function healthStatus(tx: Transaction): Promise<unknown> {
  return jsonOf(tx, sql`select backoffice.ops_health_status() as answer`);
}

/** The error groups of one state and origin (at most `limit`), and the counts of every state. */
export function errorGroups(
  tx: Transaction,
  state: string,
  source: string | null,
  limit: number,
): Promise<unknown> {
  return jsonOf(
    tx,
    sql`select backoffice.ops_error_groups(${state}, ${source}, ${limit}) as answer`,
  );
}

/** One group and its kept occurrences; null for an unknown group. */
export function errorGroup(tx: Transaction, groupId: string): Promise<unknown> {
  return jsonOf(
    tx,
    sql`select backoffice.ops_error_group(${groupId}::uuid) as answer`,
  );
}

/** Calls and duration histograms per route and per bucket of time, all instances added up. */
export function traffic(tx: Transaction, window: string): Promise<unknown> {
  return jsonOf(tx, sql`select backoffice.ops_traffic(${window}) as answer`);
}

/** The last sample and the last hour of each process, and the connections of the base. */
export function processes(tx: Transaction): Promise<unknown> {
  return jsonOf(tx, sql`select backoffice.ops_processes() as answer`);
}
