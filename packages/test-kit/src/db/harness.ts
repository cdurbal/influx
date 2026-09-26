// Harness of roles and transactions (docs/mvp/18 §9.3 A-2): open a transaction, take a role,
// pose the context, execute, roll back. Every database test goes through it, so that no test
// commits by accident and the roles are always taken the way apps/api takes them (18 T2 rule 5:
// business roles from influx_app, influx_auth from influx_auth_login, influx_worker from
// influx_worker_login — never from the migration role).
import type postgres from "postgres";

/** Roles a test may take by SET LOCAL ROLE, with the connection role that holds each one. */
export const TAKEN_ROLES = {
  influx_advertiser: "influx_app",
  influx_creator: "influx_app",
  influx_agent: "influx_app",
  influx_admin: "influx_app",
  influx_auth: "influx_auth_login",
  influx_worker: "influx_worker_login",
} as const;

export type TakenRole = keyof typeof TAKEN_ROLES;

/** Constant statements: a role name is never interpolated from a variable (03 P7 rule 4). */
const TAKE_ROLE_STATEMENTS: Readonly<Record<TakenRole, string>> = {
  influx_advertiser: "set local role influx_advertiser",
  influx_creator: "set local role influx_creator",
  influx_agent: "set local role influx_agent",
  influx_admin: "set local role influx_admin",
  influx_auth: "set local role influx_auth",
  influx_worker: "set local role influx_worker",
};

/** Business context posed by withUserTransaction (03 P2). */
export type UserContext = {
  accountId: string;
  role: "advertiser" | "creator" | "agent" | "admin";
  aal: "aal1" | "aal2";
};

class RollbackSignal extends Error {
  constructor() {
    super("rollback requested by the test harness");
  }
}

/** Runs `fn` in a transaction that is ALWAYS rolled back, and returns its result. */
export async function inRolledBackTransaction<T>(
  sql: postgres.Sql,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  let result: { value: T } | undefined;
  try {
    await sql.begin(async (tx) => {
      result = { value: await fn(tx) };
      throw new RollbackSignal();
    });
  } catch (error) {
    if (!(error instanceof RollbackSignal)) {
      throw error;
    }
  }
  if (result === undefined) {
    throw new Error("the transaction body did not complete");
  }
  return result.value;
}

/** SET LOCAL ROLE, then the context when one is given (none: the "role without context" case). */
export async function takeRole(
  tx: postgres.TransactionSql,
  role: TakenRole,
  context?: UserContext,
): Promise<void> {
  await tx.unsafe(TAKE_ROLE_STATEMENTS[role]);
  if (context !== undefined) {
    await tx`select
      pg_catalog.set_config('request.jwt.claims',
        ${JSON.stringify({ sub: context.accountId, role: context.role, aal: context.aal })}, true),
      pg_catalog.set_config('influx.account', ${context.accountId}, true),
      pg_catalog.set_config('influx.role', ${context.role}, true),
      pg_catalog.set_config('influx.aal', ${context.aal}, true)`;
  }
}

export type ProbeResult =
  { outcome: "rows"; count: number } | { outcome: "error"; code: string };

function sqlStateOf(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
    ? error.code
    : "unknown";
}

/**
 * Runs one statement inside a savepoint of the transaction: an error does not abort the
 * transaction, so that hundreds of attempts share one transaction (18 A-4). Returns the number of
 * rows returned or affected, or the SQLSTATE.
 */
export async function probe(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<ProbeResult> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", count: Math.max(result.count, result.length) };
  } catch (error) {
    return { outcome: "error", code: sqlStateOf(error) };
  }
}
