// Shared fixtures of the database tests: connections of the local stack and the data set of T2,
// loaded once per file (idempotent) by the migration role.
import {
  connectAsLocalSuperuser,
  connectAsLoginRole,
  connectAsMigrationRole,
  loadDataSet,
  takeRole,
  type DataSet,
  type LoginRole,
  type UserContext,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { afterAll } from "vitest";

const opened: postgres.Sql[] = [];

export function migrationRole(): postgres.Sql {
  const sql = connectAsMigrationRole();
  opened.push(sql);
  return sql;
}

const byRole = new Map<LoginRole, postgres.Sql>();

/**
 * One shared connection per connection role and per file (its connection limit is bounded, EC-33).
 * A transaction holds its connection: tests of one file run one after the other.
 */
export function loginRole(role: LoginRole): postgres.Sql {
  let sql = byRole.get(role);
  if (sql === undefined) {
    sql = connectAsLoginRole(role, { max: 1 });
    byRole.set(role, sql);
    opened.push(sql);
  }
  return sql;
}

let dataSet: Promise<DataSet> | undefined;

export function testDataSet(): Promise<DataSet> {
  dataSet ??= loadDataSet(migrationRole());
  return dataSet;
}

let superuser: postgres.Sql | undefined;

/**
 * The local superuser (loopback only), shared per file: the only role that may SET SESSION
 * AUTHORIZATION, used to write fixtures and then act as apps/api in ONE rolled-back transaction
 * (see actAs), where a committed fixture could not be removed (append-only tables, J7).
 */
export function localSuperuser(): postgres.Sql {
  if (superuser === undefined) {
    superuser = connectAsLocalSuperuser({ max: 1 });
    opened.push(superuser);
  }
  return superuser;
}

export type Actor = "auth" | "worker";

/** Constant statements: a role name is never interpolated (03 P7 rule 4). */
const BECOME: Readonly<Record<Actor, readonly string[]>> = {
  auth: [
    "set local session authorization influx_auth_login",
    "set local role influx_auth",
  ],
  worker: [
    "set local session authorization influx_worker_login",
    "set local role influx_worker",
  ],
};

/**
 * Inside a transaction of localSuperuser(): runs `fn` with the session_user / current_user pair
 * of apps/api (influx_auth_login / influx_auth, influx_worker_login / influx_worker), then gives
 * the transaction back to the superuser. `fn` must not leave the transaction aborted: errors go
 * through probe() (a savepoint).
 */
export async function actAs<T>(
  tx: postgres.TransactionSql,
  actor: Actor,
  fn: () => Promise<T>,
): Promise<T> {
  for (const statement of BECOME[actor]) {
    await tx.unsafe(statement);
  }
  const result = await fn();
  await tx.unsafe("reset role");
  await tx.unsafe("reset session authorization");
  return result;
}

/**
 * Inside a transaction of localSuperuser(): runs `fn` as a member, the way apps/api takes the role
 * (influx_app, then takeRole with the business context), then clears the context and gives the
 * transaction back to the superuser.
 */
export async function actAsMember<T>(
  tx: postgres.TransactionSql,
  role: "influx_advertiser" | "influx_creator",
  context: UserContext,
  fn: () => Promise<T>,
): Promise<T> {
  await tx.unsafe("set local session authorization influx_app");
  await takeRole(tx, role, context);
  const result = await fn();
  await tx.unsafe("reset role");
  await tx.unsafe("reset session authorization");
  await tx`select
    pg_catalog.set_config('request.jwt.claims', '', true),
    pg_catalog.set_config('influx.account', '', true),
    pg_catalog.set_config('influx.role', '', true),
    pg_catalog.set_config('influx.aal', '', true)`;
  return result;
}

afterAll(async () => {
  await Promise.all(opened.map((sql) => sql.end({ timeout: 1 })));
  opened.length = 0;
  byRole.clear();
  superuser = undefined;
});
