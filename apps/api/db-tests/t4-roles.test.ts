// T4 — no execution role bypasses RLS; the closed list of roles of 03 P7 is exact
// (docs/mvp/18 T4; 21 §3 EC-1, EC-20; J2 security review R4). T4.1 also runs in the global
// setup, before any other database test. T4.6 a-d, g, h and T4.8 are unit tests
// (tests/config.test.ts, tests/db-unit.test.ts, tests/database-variables.test.ts).
import {
  connectAsLocalSuperuser,
  inRolledBackTransaction,
  localRoleUrl,
  LOCAL_HOST,
  LOCAL_PORT,
  probe,
  type DataSet,
  type LoginRole,
} from "@influx/test-kit/db";
import {
  EXECUTION_ROLES,
  EXPECTED_ROLES,
  FUNCTION_OWNER_ROLES,
  OUR_SCHEMAS,
  SECURITY_DEFINER_FUNCTIONS,
  TABLE_RIGHTS,
} from "@influx/test-kit/rights";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ConnectionPool,
  createApiDatabase,
  createWorkerDatabase,
  closeDatabase,
  DatabaseRoleRefusedError,
  TransactionGuardError,
  verifyPools,
  withUserTransaction,
  type ApiDatabase,
  type DbLogger,
} from "../src/db/index.ts";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const LOGIN_ROLES = Object.entries(EXPECTED_ROLES)
  .filter(([, role]) => role.login)
  .map(([name]) => name as LoginRole);
const SCHEMAS = OUR_SCHEMAS as unknown as string[];

let migration: postgres.Sql;
let dataSet: DataSet;

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
});

function recordingLogger(): DbLogger & { lines: string[] } {
  const lines: string[] = [];
  const write = (object: object, message: string) => {
    lines.push(`${message} ${JSON.stringify(object)}`);
  };
  return { lines, error: write, warn: write, info: write };
}

describe("T4.1: no influx role is superuser or bypasses RLS", () => {
  it("finds none, by pattern", async () => {
    const rows = await migration<{ rolname: string }[]>`
      select rolname from pg_catalog.pg_roles
       where rolname like 'influx\\_%' and (rolsuper or rolbypassrls)`;
    expect(rows).toEqual([]);
  });
});

describe("T4.2: closed list and exact attributes", () => {
  it("has exactly the twelve roles of J2, and no influx_service", async () => {
    const rows = await migration<{ rolname: string }[]>`
      select rolname from pg_catalog.pg_roles where rolname like 'influx\\_%' order by 1`;
    expect(rows.map((row) => row.rolname)).toEqual(
      Object.keys(EXPECTED_ROLES).sort(),
    );
  });

  it("imposes the attributes of 03 P7 on every role", async () => {
    const rows = await migration<
      {
        rolname: string;
        rolcreatedb: boolean;
        rolcreaterole: boolean;
        rolreplication: boolean;
        rolcanlogin: boolean;
        rolinherit: boolean;
        rolconnlimit: number;
        rolconfig: string[] | null;
      }[]
    >`
      select rolname, rolcreatedb, rolcreaterole, rolreplication, rolcanlogin, rolinherit,
             rolconnlimit, rolconfig
        from pg_catalog.pg_roles where rolname like 'influx\\_%'`;
    const problems = rows.flatMap((row) => {
      const expected = EXPECTED_ROLES[row.rolname];
      const issues: string[] = [];
      if (row.rolcreatedb || row.rolcreaterole || row.rolreplication) {
        issues.push(`${row.rolname}: createdb, createrole or replication`);
      }
      if (row.rolcanlogin !== expected?.login) {
        issues.push(`${row.rolname}: login ${row.rolcanlogin}`);
      }
      if (row.rolinherit) {
        issues.push(`${row.rolname}: INHERIT`);
      }
      if (expected?.login === true) {
        const config = (row.rolconfig ?? []).join(" ");
        if (row.rolconnlimit === -1) {
          issues.push(`${row.rolname}: no connection limit`);
        }
        // Values fixed by `architecte` (EC-33): presence only until then.
        for (const setting of [
          "statement_timeout=",
          "idle_in_transaction_session_timeout=",
        ]) {
          if (!config.includes(setting)) {
            issues.push(`${row.rolname}: no ${setting}`);
          }
        }
      }
      return issues;
    });
    expect(problems).toEqual([]);
  });

  it("R4: no NOLOGIN role of ours carries a password (pg_authid)", async () => {
    const superuser = connectAsLocalSuperuser({ max: 1 });
    try {
      const rows = await superuser<{ rolname: string }[]>`
        select rolname from pg_catalog.pg_authid
         where rolname like 'influx\\_%' and not rolcanlogin and rolpassword is not null`;
      expect(rows).toEqual([]);
    } finally {
      await superuser.end({ timeout: 1 });
    }
  });
});

describe("T4.3: exact memberships", () => {
  it("gives each role exactly its transitive memberships, INHERIT FALSE, SET TRUE", async () => {
    const rows = await migration<
      { member: string; granted: string[]; bad_options: number }[]
    >`
      with recursive tree as (
        select m.member, m.roleid, m.inherit_option, m.set_option, m.admin_option
          from pg_catalog.pg_auth_members m
        union
        select t.member, m.roleid, m.inherit_option, m.set_option, m.admin_option
          from tree t join pg_catalog.pg_auth_members m on m.member = t.roleid)
      select mem.rolname as member,
             array_agg(distinct grp.rolname order by grp.rolname) as granted,
             count(*) filter (where t.inherit_option or not t.set_option or t.admin_option)::int
               as bad_options
        from tree t
        join pg_catalog.pg_roles mem on mem.oid = t.member
        join pg_catalog.pg_roles grp on grp.oid = t.roleid
       where mem.rolname like 'influx\\_%'
       group by mem.rolname`;
    const actual = Object.fromEntries(
      rows.map((row) => [row.member, row.granted]),
    );
    for (const [name, role] of Object.entries(EXPECTED_ROLES)) {
      expect(actual[name] ?? [], name).toEqual([...role.memberOf].sort());
    }
    expect(rows.filter((row) => row.bad_options > 0)).toEqual([]);
  });

  it("gives the three function owners no member but the ADMIN-only migration role (C-9)", async () => {
    const rows = await migration<{ line: string }[]>`
      select grp.rolname || ' <- ' || mem.rolname || ' inherit=' || m.inherit_option ||
             ' set=' || m.set_option || ' admin=' || m.admin_option as line
        from pg_catalog.pg_auth_members m
        join pg_catalog.pg_roles grp on grp.oid = m.roleid
        join pg_catalog.pg_roles mem on mem.oid = m.member
       where grp.rolname = any (${FUNCTION_OWNER_ROLES as unknown as string[]})
         and not (mem.rolname = current_user and m.admin_option
                  and not m.inherit_option and not m.set_option)`;
    expect(rows).toEqual([]);
  });

  const FORBIDDEN_TARGETS: Readonly<Record<LoginRole, readonly string[]>> = {
    influx_app: ["influx_auth", "influx_worker"],
    influx_auth_login: [
      "influx_worker",
      "influx_advertiser",
      "influx_creator",
      "influx_agent",
      "influx_admin",
    ],
    influx_worker_login: [
      "influx_auth",
      "influx_advertiser",
      "influx_creator",
      "influx_agent",
      "influx_admin",
    ],
  };

  it.each(LOGIN_ROLES)(
    "refuses %s every SET ROLE outside its line",
    async (role) => {
      const targets = [
        "service_role",
        "postgres",
        "authenticated",
        "anon",
        ...FUNCTION_OWNER_ROLES,
        ...FORBIDDEN_TARGETS[role],
      ];
      const accepted = await inRolledBackTransaction(
        loginRole(role),
        async (tx) => {
          const results: string[] = [];
          for (const target of targets) {
            // Constant list above, quoted as an identifier.
            const result = await probe(tx, `set local role "${target}"`);
            if (
              result.outcome !== "error" ||
              result.code !== INSUFFICIENT_PRIVILEGE
            ) {
              results.push(`${target}: ${JSON.stringify(result)}`);
            }
          }
          return results;
        },
      );
      expect(accepted).toEqual([]);
    },
  );
});

describe("T4.4: ownership", () => {
  it("lets no execution role own anything", async () => {
    const rows = await migration<{ owned: string }[]>`
      with roles as (select oid, rolname from pg_catalog.pg_roles
                      where rolname = any (${EXECUTION_ROLES as unknown as string[]}))
      select r.rolname || ' owns relation ' || c.oid::regclass::text as owned
        from pg_catalog.pg_class c join roles r on r.oid = c.relowner
      union all
      select r.rolname || ' owns function ' || p.oid::regprocedure::text
        from pg_catalog.pg_proc p join roles r on r.oid = p.proowner
      union all
      select r.rolname || ' owns type ' || t.oid::regtype::text
        from pg_catalog.pg_type t join roles r on r.oid = t.typowner
      union all
      select r.rolname || ' owns schema ' || n.nspname
        from pg_catalog.pg_namespace n join roles r on r.oid = n.nspowner`;
    expect(rows).toEqual([]);
  });

  it("gives schemas, tables, types and sequences of ours to the migration role", async () => {
    const rows = await migration<{ object: string }[]>`
      select 'schema ' || nspname as object from pg_catalog.pg_namespace
       where nspname = any (${SCHEMAS}) and nspowner <> (select oid from pg_roles where rolname = current_user)
      union all
      select 'relation ' || c.oid::regclass::text
        from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = any (${SCHEMAS})
         and c.relowner <> (select oid from pg_roles where rolname = current_user)
      union all
      select 'type ' || t.oid::regtype::text
        from pg_catalog.pg_type t join pg_catalog.pg_namespace n on n.oid = t.typnamespace
       where n.nspname = any (${SCHEMAS})
         and t.typowner <> (select oid from pg_roles where rolname = current_user)`;
    expect(rows).toEqual([]);
  });

  it("declares every SECURITY DEFINER function with its owner, empty search_path, never the migration role", async () => {
    const rows = await migration<
      {
        name: string;
        owner: string;
        config: string[] | null;
        dangerous_owner: boolean;
      }[]
    >`
      select p.oid::regprocedure::text as name, r.rolname as owner, p.proconfig as config,
             (r.rolsuper or r.rolbypassrls) as dangerous_owner
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        join pg_catalog.pg_roles r on r.oid = p.proowner
       where n.nspname = any (${SCHEMAS}) and p.prosecdef
       order by 1`;
    expect(
      Object.fromEntries(rows.map((row) => [row.name, row.owner])),
    ).toEqual(SECURITY_DEFINER_FUNCTIONS);
    for (const row of rows) {
      expect(row.dangerous_owner, row.name).toBe(false);
      expect(row.config ?? [], row.name).toContain('search_path=""');
    }
  });
});

describe("T4.5: without a role taken, a connection role has no right at all", () => {
  it.each(LOGIN_ROLES)(
    "%s is refused on every table, in and out of a transaction",
    async (role) => {
      const sql = loginRole(role);
      const accepted: string[] = [];
      for (const rights of TABLE_RIGHTS) {
        const statements = [
          `select ${rights.probeColumn} from ${rights.table} limit 1`,
          `insert into ${rights.table} default values`,
          `update ${rights.table} set ${rights.probeColumn} = ${rights.probeColumn}`,
          `delete from ${rights.table}`,
        ];
        for (const statement of statements) {
          // An isolated statement, outside any transaction.
          try {
            const rows = await sql.unsafe(statement);
            accepted.push(
              `${statement}: ${rows.count} row(s) outside a transaction`,
            );
          } catch (error) {
            const code = (error as { code?: string }).code;
            if (code !== INSUFFICIENT_PRIVILEGE) {
              accepted.push(`${statement}: ${code} outside a transaction`);
            }
          }
        }
        const inside = await inRolledBackTransaction(sql, async (tx) => {
          const results: string[] = [];
          for (const statement of statements) {
            const result = await probe(tx, statement);
            if (
              result.outcome !== "error" ||
              result.code !== INSUFFICIENT_PRIVILEGE
            ) {
              results.push(
                `${statement}: ${JSON.stringify(result)} in a transaction`,
              );
            }
          }
          return results;
        });
        accepted.push(...inside);
      }
      expect(accepted).toEqual([]);
    },
  );

  it.each(LOGIN_ROLES)(
    "%s executes identity.resolve_session() only if it is influx_app",
    async (role) => {
      const result = await inRolledBackTransaction(loginRole(role), (tx) =>
        probe(tx, "select * from identity.resolve_session($1)", [
          Buffer.alloc(32),
        ]),
      );
      expect(result).toEqual(
        role === "influx_app"
          ? { outcome: "rows", count: 0 }
          : { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      );
    },
  );

  it("does not keep the role after COMMIT nor after ROLLBACK (pool of size 1)", async () => {
    const sql = loginRole("influx_app");
    await sql.begin(async (tx) => {
      await tx.unsafe("set local role influx_admin");
    });
    const [afterCommit] = await sql<
      { user: string }[]
    >`select current_user::text as user`;
    expect(afterCommit?.user).toBe("influx_app");
    expect(await probe0(sql)).toBe(INSUFFICIENT_PRIVILEGE);

    await inRolledBackTransaction(sql, async (tx) => {
      await tx.unsafe("set local role influx_admin");
    });
    const [afterRollback] = await sql<
      { user: string }[]
    >`select current_user::text as user`;
    expect(afterRollback?.user).toBe("influx_app");
    expect(await probe0(sql)).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

async function probe0(sql: postgres.Sql): Promise<string> {
  try {
    await sql`select id from identity.accounts limit 1`;
    return "accepted";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

// ---------------------------------------------------------------------------------------------
// T4.6 e, T4.7: the real pools of apps/api
// ---------------------------------------------------------------------------------------------

const MIGRATION_URL = `postgresql://postgres:postgres@${LOCAL_HOST}:${LOCAL_PORT}/postgres`;
const localConnection = (role: LoginRole) => ({
  url: localRoleUrl(role),
  role,
  tls: false,
});

describe("T4.6 e: the pools of apps/api verify their role when they open", () => {
  const opened: (ApiDatabase | ReturnType<typeof createWorkerDatabase>)[] = [];
  afterAll(async () => {
    await Promise.all(opened.map((database) => closeDatabase(database)));
  });

  it("accepts the api pools and the worker pool on their roles", async () => {
    const logger = recordingLogger();
    const api = createApiDatabase(
      {
        app: localConnection("influx_app"),
        auth: localConnection("influx_auth_login"),
      },
      logger,
    );
    const worker = createWorkerDatabase(
      { worker: localConnection("influx_worker_login") },
      logger,
    );
    opened.push(api, worker);
    await expect(verifyPools(api)).resolves.toBeUndefined();
    await expect(verifyPools(worker)).resolves.toBeUndefined();
  });

  it("refuses for good a pool connected as another role", async () => {
    const logger = recordingLogger();
    const pool = new ConnectionPool(
      { url: MIGRATION_URL, role: "influx_app", tls: false },
      { max: 1, applicationName: "t4" },
      logger,
    );
    await expect(pool.verify()).rejects.toBeInstanceOf(
      DatabaseRoleRefusedError,
    );
    await expect(pool.acquire()).rejects.toMatchObject({
      reason: "unexpected_current_user",
    });
    expect(logger.lines.join("\n")).not.toContain("postgres:postgres");
    await pool.close();
  });

  it("refuses the right password on the wrong pool (auth login role as influx_app)", async () => {
    const pool = new ConnectionPool(
      {
        url: localRoleUrl("influx_auth_login"),
        role: "influx_app",
        tls: false,
      },
      { max: 1, applicationName: "t4" },
      recordingLogger(),
    );
    await expect(pool.verify()).rejects.toMatchObject({
      reason: "unexpected_current_user",
    });
    await pool.close();
  });

  // End-of-J2 security review S2: influx_app itself is untouched, but it reaches influx_admin by
  // membership. The attribute is committed (the pool reads it on its own connection), then
  // removed whatever happens; if the process dies in between, T4.1 stops the next run.
  it("refuses a pool whose role reaches a BYPASSRLS role by membership (S2)", async () => {
    const pool = new ConnectionPool(
      localConnection("influx_app"),
      { max: 1, applicationName: "t4" },
      recordingLogger(),
    );
    await migration`alter role influx_admin bypassrls`;
    try {
      await expect(pool.verify()).rejects.toMatchObject({
        reason: "bypassrls_reachable",
      });
    } finally {
      await migration`alter role influx_admin nobypassrls`;
      await pool.close();
    }
  });
});

describe("T4.7: guard at the start of a transaction", () => {
  it("refuses a leaked session role, runs nothing, destroys the pool, then recovers", async () => {
    const logger = recordingLogger();
    const database = createApiDatabase(
      {
        app: localConnection("influx_app"),
        auth: localConnection("influx_auth_login"),
      },
      logger,
    );
    // Size 1: the leak and the next transaction share the only connection.
    const pool = new ConnectionPool(
      localConnection("influx_app"),
      { max: 1, applicationName: "t4.7" },
      logger,
    );
    const single: ApiDatabase = { ...database, app: pool };
    const member = dataSet.accounts.advertiser.a;
    try {
      const db = await pool.acquire();
      // The leak: a SESSION-level role left on the connection (forbidden in src/, simulated here).
      await db.execute("set role influx_advertiser");

      let ran = false;
      await expect(
        withUserTransaction(
          single,
          { sessionTokenHash: member.sessionTokenHash, requestId: "t4-7" },
          () => {
            ran = true;
            return Promise.resolve();
          },
        ),
      ).rejects.toBeInstanceOf(TransactionGuardError);
      expect(ran).toBe(false);
      expect(logger.lines).toContain(
        'transaction guard failed, pool destroyed {"role":"influx_app"}',
      );

      const context = await withUserTransaction(
        single,
        { sessionTokenHash: member.sessionTokenHash, requestId: "t4-7" },
        async (tx, resolved) => {
          const rows = await tx.execute<{
            current_user: string;
            session_user: string;
          }>(
            "select current_user::text as current_user, session_user::text as session_user",
          );
          return { resolved, row: rows[0] };
        },
      );
      expect(context.resolved).toMatchObject({
        accountId: member.id,
        role: "advertiser",
      });
      expect(context.row).toEqual({
        current_user: "influx_advertiser",
        session_user: "influx_app",
      });
    } finally {
      await pool.close();
      await closeDatabase(database);
    }
  });
});

describe("withUserTransaction on the local stack", () => {
  it("resolves the session, takes the role and poses the context: own rows only", async () => {
    const database = createApiDatabase(
      {
        app: localConnection("influx_app"),
        auth: localConnection("influx_auth_login"),
      },
      recordingLogger(),
    );
    try {
      for (const role of ["advertiser", "creator", "agent", "admin"] as const) {
        const account = dataSet.accounts[role].a;
        const seen = await withUserTransaction(
          database,
          { sessionTokenHash: account.sessionTokenHash, requestId: "req-1" },
          async (tx, context) => {
            const rows = await tx.execute<{ id: string }>(
              "select id from identity.accounts where id = (select influx.current_account_id())",
            );
            const [settings] = await tx.execute<{
              aal: string;
              request: string;
            }>(
              "select current_setting('influx.aal') as aal, current_setting('influx.request_id') as request",
            );
            return { context, ids: rows.map((row) => row.id), settings };
          },
        );
        expect(seen.context.role).toBe(role);
        expect(seen.ids).toEqual([account.id]);
        expect(seen.settings).toEqual({
          aal: role === "agent" || role === "admin" ? "aal2" : "aal1",
          request: "req-1",
        });
      }
    } finally {
      await closeDatabase(database);
    }
  });

  it("finds no session for an unknown token", async () => {
    const database = createApiDatabase(
      {
        app: localConnection("influx_app"),
        auth: localConnection("influx_auth_login"),
      },
      recordingLogger(),
    );
    try {
      await expect(
        withUserTransaction(
          database,
          { sessionTokenHash: new Uint8Array(32), requestId: "r" },
          () => Promise.resolve(),
        ),
      ).rejects.toMatchObject({ name: "SessionNotFoundError" });
    } finally {
      await closeDatabase(database);
    }
  });
});
