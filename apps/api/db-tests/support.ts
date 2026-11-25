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

let sharedMigration: postgres.Sql | undefined;

/**
 * The migration role over ONE pool per file, for a file that reads and writes fixtures many times:
 * migrationRole() opens a new connection at every call and keeps it until the end of the file, so a
 * long file holds dozens of slots and starves the parallel files of the full suite (EC-33).
 */
export function sharedMigrationRole(): postgres.Sql {
  if (sharedMigration === undefined) {
    sharedMigration = connectAsMigrationRole({ max: 3 });
    opened.push(sharedMigration);
  }
  return sharedMigration;
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

export type Actor = "auth" | "worker" | "privacy" | "ops";

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
  // J8 commit 8 (0136): E-5, the worker's own pool, never influx_worker_login
  privacy: [
    "set local session authorization influx_privacy_login",
    "set local role influx_privacy",
  ],
  // J9 commit 8 (0147): E-6, the ops pool of apps/api (OPS_DATABASE_URL)
  ops: [
    "set local session authorization influx_ops_login",
    "set local role influx_ops",
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

/**
 * Inside a transaction of localSuperuser(): runs `fn` as an agent or an admin, the way apps/api
 * takes the role (influx_app, then takeRole with the business context, aal2 unless told), then
 * clears the context and gives the transaction back to the superuser (J8, 0130).
 */
export async function actAsInternal<T>(
  tx: postgres.TransactionSql,
  role: "influx_agent" | "influx_admin",
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

/**
 * J8S-3 (0142): inside actAsInternal() (or actAsMember()), poses the claim session_id of the
 * request on top of the claims of the context, the way apps/api does with `context.sessionId` —
 * which it also passes as p_session_id. R refuses any other session than this one.
 */
export async function bindRequestSession(
  tx: postgres.TransactionSql,
  session: string,
): Promise<void> {
  await tx`select pg_catalog.set_config('request.jwt.claims',
    (coalesce(nullif(pg_catalog.current_setting('request.jwt.claims', true), ''), '{}')::jsonb
       || jsonb_build_object('session_id', ${session}::text))::text, true)`;
}

/**
 * A fixture name drawn from a hexadecimal identifier, with an alphabet of letters only (L2CT-1):
 * each hexadecimal character becomes one of `g` to `v`, so the name holds no run of digits (RG19
 * would read it as a phone number) and cannot collide, once normalised (RG25), with the names of
 * earlier runs or of other files (`x` and `a` to `f` only).
 */
export function letterName(hex: string): string {
  return hex
    .replace(/-/g, "")
    .replace(/[0-9a-f]/gi, (character) =>
      String.fromCharCode("g".charCodeAt(0) + Number.parseInt(character, 16)),
    );
}

/**
 * L2CT-1, L2CT-7: leaves nothing of the brand fixtures of a file in the shared stack. The open
 * entries of the accounts are withdrawn (they would crowd the queue of the agents and its
 * counters), and their published profiles leave `published` for `draft`: RG25 reads every
 * published profile of the database, and a name left there makes duplicates for the runs to come.
 */
export async function retireBrandFixtures(
  sql: postgres.Sql,
  accountIds: readonly string[],
): Promise<void> {
  if (accountIds.length === 0) {
    return;
  }
  const ids = [...accountIds];
  await sql.begin(async (tx) => {
    await tx`
      update profiles.advertiser_review_entries
         set state = 'withdrawn', closed_at = now()
       where state = 'open' and account_id = any(${ids}::uuid[])`;
    await tx`
      update profiles.advertiser_profiles
         set status = 'draft'
       where status = 'published' and account_id = any(${ids}::uuid[])`;
  });
}

/**
 * L2CT-2, L2CS-1: a bounded probe, never a sleep alone. Polls `pg_stat_activity` (from `probe`, a
 * connection of the local superuser outside the transactions it watches) until `count` backends wait
 * on a lock behind the backend `holderPid`, directly or through one another, or until `timeoutMs`
 * has passed. Returns the number of waiting backends seen last.
 */
export async function lockWaitersBehind(
  probe: postgres.Sql,
  holderPid: number,
  count: number,
  timeoutMs = 5_000,
): Promise<number> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [row] = await probe<{ n: number }[]>`
      with recursive chain (pid) as (
        select a.pid from pg_catalog.pg_stat_activity a
         where a.wait_event_type = 'Lock'
           and ${holderPid}::int = any (pg_catalog.pg_blocking_pids(a.pid))
        union
        select a.pid from pg_catalog.pg_stat_activity a
          join chain c on c.pid = any (pg_catalog.pg_blocking_pids(a.pid))
         where a.wait_event_type = 'Lock'
      )
      select count(*)::int as n from chain`;
    const seen = row?.n ?? 0;
    if (seen >= count || Date.now() >= deadline) {
      return seen;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** The backend of a transaction, for lockWaitersBehind(). */
export async function backendPid(tx: postgres.TransactionSql): Promise<number> {
  const [row] = await tx<{ pid: number }[]>`select pg_backend_pid() as pid`;
  if (row === undefined) {
    throw new Error("no backend pid");
  }
  return row.pid;
}

afterAll(async () => {
  await Promise.all(opened.map((sql) => sql.end({ timeout: 1 })));
  opened.length = 0;
  byRole.clear();
  superuser = undefined;
  sharedMigration = undefined;
});
