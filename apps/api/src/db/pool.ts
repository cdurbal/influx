// One connection pool per connection role (docs/mvp/03 §4 P7, EC-1 and EC-20 of 21 §3).
// Rules applied here:
// - `prepare: false`: prepared statements do not survive the transaction-mode pooler (P7 rule 1);
// - TLS with certificate verification outside a loopback host, never disabled (P7 rule 1);
// - NO session state: the pool never sends SET, SET ROLE or a session advisory lock (P7 rule 2);
// - when the pool opens, `current_user`, `session_user` and the absence of rolsuper and
//   rolbypassrls are read in the database, on the connection role AND on every role it reaches by
//   membership: any deviation refuses the pool for good (P7 rule 6, 18 T4.6 e, end-of-J2 security
//   review S2);
// - a pool whose connection has been found in a wrong state is destroyed, and the next call gets
//   a fresh one (P7 rule 3, 18 T4.7).
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ConnectionRole, DatabaseConnection } from "../config/schema.ts";

/** What the database module writes to the logs: messages and codes, never a value. */
export type DbLogger = {
  error(object: object, message: string): void;
  warn(object: object, message: string): void;
  info(object: object, message: string): void;
};

export type PoolOptions = {
  /** Maximum number of connections of this pool. */
  max: number;
  /** `application_name` shown in pg_stat_activity: the service, never a user. */
  applicationName: string;
};

/** The row read when a pool opens. */
export type ConnectionIdentity = {
  currentUser: string;
  sessionUser: string;
  isSuperuser: boolean;
  bypassesRls: boolean;
  /** A role reached by membership, at any depth, is superuser. */
  reachesSuperuser: boolean;
  /** A role reached by membership, at any depth, bypasses RLS. */
  reachesBypassRls: boolean;
};

export type IdentityVerdict =
  { ok: true } | { ok: false; reason: IdentityRefusalReason };

export type IdentityRefusalReason =
  | "role_not_found"
  | "unexpected_current_user"
  | "unexpected_session_user"
  | "superuser"
  | "bypassrls"
  | "superuser_reachable"
  | "bypassrls_reachable";

/**
 * Decision of 18 T4.6 e, pure so that every branch is tested without a database: the pool must
 * be connected as exactly its role, which is neither SUPERUSER nor BYPASSRLS, and reaches no role
 * that is. A BYPASSRLS set one day on influx_admin, taken by SET LOCAL ROLE, would make RLS
 * optional without the connection role changing (S2).
 */
export function checkConnectionIdentity(
  identity: ConnectionIdentity | undefined,
  expectedRole: ConnectionRole,
): IdentityVerdict {
  if (identity === undefined) {
    return { ok: false, reason: "role_not_found" };
  }
  if (identity.currentUser !== expectedRole) {
    return { ok: false, reason: "unexpected_current_user" };
  }
  if (identity.sessionUser !== expectedRole) {
    return { ok: false, reason: "unexpected_session_user" };
  }
  if (identity.isSuperuser) {
    return { ok: false, reason: "superuser" };
  }
  if (identity.bypassesRls) {
    return { ok: false, reason: "bypassrls" };
  }
  if (identity.reachesSuperuser) {
    return { ok: false, reason: "superuser_reachable" };
  }
  if (identity.reachesBypassRls) {
    return { ok: false, reason: "bypassrls_reachable" };
  }
  return { ok: true };
}

/** The pool is connected as a role it must never use: the process refuses to go on. */
export class DatabaseRoleRefusedError extends Error {
  readonly role: ConnectionRole;
  readonly reason: IdentityRefusalReason;

  constructor(role: ConnectionRole, reason: IdentityRefusalReason) {
    super(`database pool for ${role} refused: ${reason}`);
    this.name = "DatabaseRoleRefusedError";
    this.role = role;
    this.reason = reason;
  }
}

/**
 * Every role reached by membership counts, whatever its INHERIT and SET options: the graph of
 * pg_auth_members is followed from the connection role, at any depth.
 */
const IDENTITY_QUERY = `with recursive reached(oid) as (
  select m.roleid
    from pg_catalog.pg_auth_members m
   where m.member = (select oid from pg_catalog.pg_roles where rolname = current_user)
  union
  select m.roleid
    from pg_catalog.pg_auth_members m
    join reached on m.member = reached.oid
)
select current_user::text as current_user,
       session_user::text as session_user,
       r.rolsuper,
       r.rolbypassrls,
       coalesce((select bool_or(g.rolsuper)
                   from reached join pg_catalog.pg_roles g on g.oid = reached.oid), false)
         as reaches_superuser,
       coalesce((select bool_or(g.rolbypassrls)
                   from reached join pg_catalog.pg_roles g on g.oid = reached.oid), false)
         as reaches_bypassrls
  from pg_catalog.pg_roles r
 where r.rolname = current_user`;

type IdentityRow = {
  current_user: string;
  session_user: string;
  rolsuper: boolean;
  rolbypassrls: boolean;
  reaches_superuser: boolean;
  reaches_bypassrls: boolean;
};

/** Seconds: a connection that cannot be opened fails fast (the api answers 503, D60). */
const CONNECT_TIMEOUT_S = 5;
/** Seconds: an idle connection is closed; the pooler holds the server side. */
const IDLE_TIMEOUT_S = 30;
/** Seconds: connections are renewed regularly. */
const MAX_LIFETIME_S = 30 * 60;

export class ConnectionPool {
  readonly role: ConnectionRole;
  private readonly connection: DatabaseConnection;
  private readonly options: PoolOptions;
  private readonly logger: DbLogger;
  private client: postgres.Sql | null = null;
  private database: PostgresJsDatabase | null = null;
  private verification: Promise<void> | null = null;
  private refusal: DatabaseRoleRefusedError | null = null;

  constructor(
    connection: DatabaseConnection,
    options: PoolOptions,
    logger: DbLogger,
  ) {
    this.role = connection.role;
    this.connection = connection;
    this.options = options;
    this.logger = logger;
  }

  /** The Drizzle database of a verified pool. Opens and verifies the pool on first use. */
  async acquire(): Promise<PostgresJsDatabase> {
    if (this.refusal !== null) {
      throw this.refusal;
    }
    const database = this.open();
    await this.verify();
    return database;
  }

  /**
   * Verifies the identity of the pool once. A definite refusal is permanent; an unreachable
   * database is retried on the next call.
   */
  verify(): Promise<void> {
    if (this.refusal !== null) {
      return Promise.reject(this.refusal);
    }
    if (this.verification === null) {
      this.verification = this.readIdentity().catch((error: unknown) => {
        this.verification = null;
        throw error;
      });
    }
    return this.verification;
  }

  /**
   * Closes every connection of the pool at once (a connection found in a wrong state, 18 T4.7).
   * The next call opens a fresh pool, verified again.
   */
  async destroy(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.database = null;
    this.verification = null;
    if (client !== null) {
      await client.end({ timeout: 0 });
    }
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = null;
    this.database = null;
    if (client !== null) {
      await client.end({ timeout: 5 });
    }
  }

  private open(): PostgresJsDatabase {
    if (this.database !== null) {
      return this.database;
    }
    const client = postgres(this.connection.url, {
      max: this.options.max,
      prepare: false,
      ssl: this.connection.tls ? { rejectUnauthorized: true } : false,
      connect_timeout: CONNECT_TIMEOUT_S,
      idle_timeout: IDLE_TIMEOUT_S,
      max_lifetime: MAX_LIFETIME_S,
      // No catalogue lookup of array types at connection time: nothing we read needs it.
      fetch_types: false,
      // A NOTICE may quote values: never printed (no console in apps/api).
      onnotice: () => undefined,
      connection: { application_name: this.options.applicationName },
    });
    this.client = client;
    this.database = drizzle({ client });
    return this.database;
  }

  private async readIdentity(): Promise<void> {
    this.open();
    const client = this.client;
    if (client === null) {
      throw new Error("database pool could not be opened");
    }
    const rows = await client.unsafe<IdentityRow[]>(IDENTITY_QUERY);
    const row = rows[0];
    const verdict = checkConnectionIdentity(
      row === undefined
        ? undefined
        : {
            currentUser: row.current_user,
            sessionUser: row.session_user,
            isSuperuser: row.rolsuper,
            bypassesRls: row.rolbypassrls,
            reachesSuperuser: row.reaches_superuser,
            reachesBypassRls: row.reaches_bypassrls,
          },
      this.role,
    );
    if (!verdict.ok) {
      this.refusal = new DatabaseRoleRefusedError(this.role, verdict.reason);
      this.logger.error(
        { role: this.role, reason: verdict.reason },
        "database pool refused",
      );
      await this.destroy();
      throw this.refusal;
    }
    this.logger.info({ role: this.role }, "database pool verified");
  }
}
