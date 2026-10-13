// Database access of apps/api (docs/mvp/21 §4, J2 point 4; 03 §4 P2, P3, P7 and §6.7).
//
// Two ways into the database, and no other:
// - withUserTransaction: pool `influx_app` (DATABASE_URL). Resolves the session in ONE indexed
//   read (identity.resolve_session), takes the Postgres role of the business role read in the
//   database (never in a token, P3), poses the transaction context, runs the domain function
//   under RLS.
// - withElevatedTransaction: pool of the operation (AUTH_DATABASE_URL, WORKER_DATABASE_URL or,
//   for the monitoring of D60, OPS_DATABASE_URL).
//   Refuses AT RUNTIME any operation outside the closed union of packages/contracts, takes the
//   elevated role, runs, and writes the audit line of the operation.
//
// Every transaction starts with the guard `current_user = session_user = <connection role>`:
// a role left on a pooled connection would otherwise apply to another user's transaction.
import {
  ELEVATED_POOL_EXCEPTIONS,
  isElevatedOperation,
  type ElevatedOperation,
} from "@influx/contracts/elevated-operations";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { ConnectionRole, DatabaseConnection } from "../config/schema.ts";
import { ConnectionPool, type DbLogger } from "./pool.ts";
import {
  elevatedRoleStatement,
  POOL_CONNECTION_ROLES,
  userRoleStatement,
  type BusinessRole,
  type ElevatedPoolKind,
} from "./roles.ts";

export { ConnectionPool, DatabaseRoleRefusedError } from "./pool.ts";
export type { DbLogger } from "./pool.ts";
export type { BusinessRole } from "./roles.ts";

/** A transaction handed to a domain function (Drizzle over postgres.js, no relational schema). */
export type Transaction = Parameters<
  Parameters<PostgresJsDatabase["transaction"]>[0]
>[0];

// ---------------------------------------------------------------------------------------------
// Pools per process (EC-20: api = app + auth + ops, worker = worker only)
// ---------------------------------------------------------------------------------------------

/** Pool sizes per process. Provisional, with the role bounds of EC-33 (architecte, J4). */
const APP_POOL_MAX = 10;
const AUTH_POOL_MAX = 5;
const WORKER_POOL_MAX = 4;
/** Monitoring writes (E-6): a few per minute; never more than this, never waited for. */
const OPS_POOL_MAX = 2;

export type ApiDatabase = {
  app: ConnectionPool;
  elevated: { auth: ConnectionPool; ops: ConnectionPool };
  logger: DbLogger;
};

export type WorkerDatabase = {
  elevated: { worker: ConnectionPool };
  logger: DbLogger;
};

export type ElevatedDatabase = {
  elevated: Partial<Record<ElevatedPoolKind, ConnectionPool>>;
  logger: DbLogger;
};

export function createApiDatabase(
  connections: {
    app: DatabaseConnection;
    auth: DatabaseConnection;
    ops: DatabaseConnection;
  },
  logger: DbLogger,
): ApiDatabase {
  return {
    app: new ConnectionPool(
      connections.app,
      { max: APP_POOL_MAX, applicationName: "influx-api" },
      logger,
    ),
    elevated: {
      auth: new ConnectionPool(
        connections.auth,
        { max: AUTH_POOL_MAX, applicationName: "influx-api-auth" },
        logger,
      ),
      ops: new ConnectionPool(
        connections.ops,
        { max: OPS_POOL_MAX, applicationName: "influx-api-ops" },
        logger,
      ),
    },
    logger,
  };
}

export function createWorkerDatabase(
  connections: { worker: DatabaseConnection },
  logger: DbLogger,
): WorkerDatabase {
  return {
    elevated: {
      worker: new ConnectionPool(
        connections.worker,
        { max: WORKER_POOL_MAX, applicationName: "influx-worker" },
        logger,
      ),
    },
    logger,
  };
}

/** Every pool of a process, for the startup verification and the shutdown. */
export function poolsOf(
  database: ApiDatabase | WorkerDatabase,
): ConnectionPool[] {
  return "app" in database
    ? [database.app, database.elevated.auth, database.elevated.ops]
    : [database.elevated.worker];
}

/**
 * Startup verification of every pool (03 P7 rule 6). Resolves when all are verified; rejects
 * with DatabaseRoleRefusedError when one is connected as a forbidden role (the process must
 * stop), or with the connection error when the database is unreachable (the process goes on:
 * starting never depends on the database, 21 J1-D point 6).
 */
export async function verifyPools(
  database: ApiDatabase | WorkerDatabase,
): Promise<void> {
  await Promise.all(poolsOf(database).map((pool) => pool.verify()));
}

export async function closeDatabase(
  database: ApiDatabase | WorkerDatabase,
): Promise<void> {
  await Promise.all(poolsOf(database).map((pool) => pool.close()));
}

// ---------------------------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------------------------

/** No valid session for this token: the caller answers 401, nothing was read. */
export class SessionNotFoundError extends Error {
  constructor() {
    super("no valid session");
    this.name = "SessionNotFoundError";
  }
}

/** The connection was not in the expected state at the start of a transaction (18 T4.7). */
export class TransactionGuardError extends Error {
  constructor() {
    super("transaction guard failed: unexpected current_user or session_user");
    this.name = "TransactionGuardError";
  }
}

/** An operation outside the closed union reached withElevatedTransaction (18 T6.2). */
export class ElevatedOperationRefusedError extends Error {
  constructor() {
    super("elevated operation refused: not in the closed list");
    this.name = "ElevatedOperationRefusedError";
  }
}

/** resolve_session returned a role or level that the constant tables do not know. */
export class SessionRoleRefusedError extends Error {
  constructor() {
    super("session refused: unknown role or assurance level");
    this.name = "SessionRoleRefusedError";
  }
}

// ---------------------------------------------------------------------------------------------
// Transaction guard (03 P7 rule 3)
// ---------------------------------------------------------------------------------------------

type GuardRow = { current_user: string; session_user: string };

async function assertConnectionRole(
  tx: Transaction,
  expected: ConnectionRole,
): Promise<void> {
  const rows = await tx.execute<GuardRow>(
    "select current_user::text as current_user, session_user::text as session_user",
  );
  const row = rows[0];
  if (
    row === undefined ||
    row.current_user !== expected ||
    row.session_user !== expected
  ) {
    throw new TransactionGuardError();
  }
}

/**
 * Runs a transaction on a verified pool. A failed guard destroys the whole pool (the faulty
 * connection cannot be singled out) and writes an `error` line without any data.
 */
async function runGuardedTransaction<T>(
  pool: ConnectionPool,
  logger: DbLogger,
  body: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const database: PostgresJsDatabase = await pool.acquire();
  try {
    return await database.transaction(async (tx) => {
      await assertConnectionRole(tx, pool.role);
      return body(tx);
    });
  } catch (error) {
    if (error instanceof TransactionGuardError) {
      logger.error(
        { role: pool.role },
        "transaction guard failed, pool destroyed",
      );
      await pool.destroy();
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// withUserTransaction (03 P2, P3, P7)
// ---------------------------------------------------------------------------------------------

const SHA256_BYTES = 32;

export type UserRequest = {
  /** SHA-256 of the session identifier carried by the cookie (EC-2). */
  sessionTokenHash: Uint8Array;
  /** Correlation identifier of the request, copied into the audit lines (influx.request_id). */
  requestId: string;
};

export type UserContext = {
  sessionId: string;
  accountId: string;
  role: BusinessRole;
  aal: "aal1" | "aal2";
};

type ResolvedSessionRow = {
  session_id: string;
  account_id: string;
  account_role: string;
  session_aal: string;
};

const AAL_VALUES: readonly string[] = ["aal1", "aal2"];

export async function withUserTransaction<T>(
  database: ApiDatabase,
  request: UserRequest,
  fn: (tx: Transaction, context: UserContext) => Promise<T>,
): Promise<T> {
  if (request.sessionTokenHash.byteLength !== SHA256_BYTES) {
    throw new SessionNotFoundError();
  }
  const tokenHash = Buffer.from(request.sessionTokenHash);
  return runGuardedTransaction(database.app, database.logger, async (tx) => {
    // ONE indexed read: account, business role, suspension (an inactive account resolves to
    // nothing) and session. The only right of influx_app before the role is taken (03 P7).
    const rows = await tx.execute<ResolvedSessionRow>(
      sql`select session_id, account_id, account_role::text as account_role,
                 session_aal::text as session_aal
            from identity.resolve_session(${tokenHash})`,
    );
    const row = rows[0];
    if (row === undefined) {
      throw new SessionNotFoundError();
    }
    const roleStatement = userRoleStatement(row.account_role);
    if (roleStatement === null || !AAL_VALUES.includes(row.session_aal)) {
      throw new SessionRoleRefusedError();
    }
    const context: UserContext = {
      sessionId: row.session_id,
      accountId: row.account_id,
      role: row.account_role as BusinessRole,
      aal: row.session_aal as UserContext["aal"],
    };
    // The role name comes from the constant table of roles.ts, never from the row (rule 4).
    await tx.execute(roleStatement);
    const claims = JSON.stringify({
      sub: context.accountId,
      role: context.role,
      aal: context.aal,
      session_id: context.sessionId,
    });
    // `true`: local to the transaction. Outside it, the policies see no context (03 P2).
    await tx.execute(sql`select
      pg_catalog.set_config('request.jwt.claims', ${claims}, true),
      pg_catalog.set_config('influx.account', ${context.accountId}, true),
      pg_catalog.set_config('influx.role', ${context.role}, true),
      pg_catalog.set_config('influx.aal', ${context.aal}, true),
      pg_catalog.set_config('influx.request_id', ${request.requestId}, true)`);
    return fn(tx, context);
  });
}

// ---------------------------------------------------------------------------------------------
// withElevatedTransaction (03 P7, §6.7; 18 T6)
// ---------------------------------------------------------------------------------------------

/**
 * Pool of each family of operations of the closed union (P7 rule 5: E-1, E-2 → auth; E-3, E-4 →
 * worker; E-6 → ops). By family, not by operation: the table names no operation, so the worker process,
 * which imports this module, never names an operation of the api, nor the reverse (18 T6.3).
 * An operation still needs to be in the union (set U) to run.
 */
const ELEVATED_FAMILY_POOLS: Readonly<Record<string, ElevatedPoolKind>> = {
  identity: "auth",
  support: "auth",
  leads: "worker",
  maintenance: "worker",
  ops: "ops",
};

/** The pool kind of an operation name, or null (its family has no pool in apps/api). */
export function elevatedPoolKindOf(operation: string): ElevatedPoolKind | null {
  // An operation of P bound outside its family (contracts, next to P): checked first.
  const exception = Object.prototype.hasOwnProperty.call(
    ELEVATED_POOL_EXCEPTIONS,
    operation,
  )
    ? ELEVATED_POOL_EXCEPTIONS[
        operation as keyof typeof ELEVATED_POOL_EXCEPTIONS
      ]
    : undefined;
  if (exception !== undefined) {
    return exception;
  }
  const family = operation.slice(0, operation.indexOf("."));
  return Object.prototype.hasOwnProperty.call(ELEVATED_FAMILY_POOLS, family)
    ? (ELEVATED_FAMILY_POOLS[family] ?? null)
    : null;
}

/**
 * What the function of an elevated transaction returns: its value, and the subject of the audit
 * line (21 §3 EC-52, C-7 made precise). A subject is the business object an effect was written on
 * (a journal line, a session, a pinned factor, a consumed recovery code); null when the
 * transaction only reserved an attempt, counted a failure or wrote the outcome of an existing
 * line: then no audit line is written, only a `pino` line without data.
 */
export type ElevatedResult<T> = {
  value: T;
  auditSubject: string | null;
};

/**
 * Pool of a requested operation, or null when the operation is outside the closed union, or when
 * this process has no pool for it (P7 rule 5: a process only configures its own pools). Typed on
 * `string` on purpose: the parameter's static type is not trusted.
 */
function elevatedPoolOf(
  database: ElevatedDatabase,
  requested: string,
): { kind: ElevatedPoolKind; pool: ConnectionPool } | null {
  if (!isElevatedOperation(requested)) {
    return null;
  }
  const kind = elevatedPoolKindOf(requested);
  if (kind === null) {
    return null;
  }
  const pool = database.elevated[kind];
  if (pool === undefined || pool.role !== POOL_CONNECTION_ROLES[kind]) {
    return null;
  }
  return { kind, pool };
}

export async function withElevatedTransaction<T>(
  database: ElevatedDatabase,
  operation: ElevatedOperation,
  requestId: string,
  fn: (tx: Transaction) => Promise<ElevatedResult<T>>,
): Promise<T> {
  // Checked at runtime, before any connection is taken: a cast passes the compiler (T6.2).
  // The log line carries no data, not even the refused value.
  const resolved = elevatedPoolOf(database, operation);
  if (resolved === null) {
    database.logger.error({}, "elevated operation refused");
    throw new ElevatedOperationRefusedError();
  }
  const { kind, pool } = resolved;
  return runGuardedTransaction(pool, database.logger, async (tx) => {
    await tx.execute(elevatedRoleStatement(kind));
    await tx.execute(
      sql`select pg_catalog.set_config('influx.request_id', ${requestId}, true)`,
    );
    const result = await fn(tx);
    if (result.auditSubject === null) {
      // EC-52 (3): a reservation, a counted failure or an outcome alone writes no audit line.
      database.logger.info(
        { operation },
        "elevated transaction without effect to audit",
      );
      return result.value;
    }
    // 03 §6.7 point 7, EC-36: one audit line, elevated.<operation>, on the subject the effect was
    // written on, in the same transaction and as late as possible (the chain lock is held until
    // COMMIT). The actor is derived from session_user by audit.append() (V6).
    await tx.execute(
      sql`select audit.append_elevated(${operation}::text, ${result.auditSubject}::uuid)`,
    );
    return result.value;
  });
}
