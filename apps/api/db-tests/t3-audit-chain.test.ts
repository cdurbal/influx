// T3 — the audit register cannot be mutated, and an alteration of the chain is detected
// (docs/mvp/18 T3; 03 P8; 0006_audit_chain). Alterations are made as the migration role, inside
// a transaction that disables the trigger, alters, re-enables, verifies ON THAT SAME transaction,
// then rolls back: no alteration is ever committed (18 T3, "Mode opératoire").
import {
  connectAsLoginRole,
  inRolledBackTransaction,
  probe,
  TAKEN_ROLES,
  takeRole,
  type DataSet,
  type LoginRole,
  type TakenRole,
} from "@influx/test-kit/db";
import { TABLE_RIGHTS } from "@influx/test-kit/rights";
import { randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";
import {
  APPEND_FUNCTION,
  APPEND_TEMPORARY_GRANTEES,
  assertNoTemporaryRights,
  AUDIT_USAGE_TEMPORARY_GRANTEES,
  INTERRUPTED_RUN_MESSAGE,
} from "./temporary-rights.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const APPEND_ONLY = TABLE_RIGHTS.filter((rights) => rights.appendOnly);
const APPEND_ONLY_TABLES = APPEND_ONLY.map((rights) => rights.table);

/** The three mutations of 03 P8, on a column the table has. */
function mutationsOf(table: string): string[] {
  const column =
    APPEND_ONLY.find((rights) => rights.table === table)?.probeColumn ?? "id";
  return [
    `update ${table} set ${column} = ${column}`,
    `delete from ${table}`,
    `truncate ${table}`,
  ];
}
const LOGIN_ROLES: readonly LoginRole[] = [
  "influx_app",
  "influx_auth_login",
  "influx_worker_login",
];
const TAKEN: readonly TakenRole[] = Object.keys(TAKEN_ROLES) as TakenRole[];

let dataSet: DataSet;
let migration: postgres.Sql;

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
});

type VerifyRow = {
  status: string;
  anomaly: string | null;
  broken_at_seq: string | null;
  head_row_hash: Buffer;
};

async function verify(
  tx: postgres.TransactionSql,
  full: boolean,
): Promise<VerifyRow> {
  const [row] = await tx<VerifyRow[]>`
    select status, anomaly, broken_at_seq::text, head_row_hash
      from audit.verify_chain('global', ${full}, true)`;
  if (row === undefined) {
    throw new Error("verify_chain returned no row");
  }
  return row;
}

/** Accounts without any role, committed: the targets of identity.grant_role(). */
async function createTargets(count: number): Promise<string[]> {
  const ids = Array.from({ length: count }, () => randomUUID());
  await migration.begin(async (tx) => {
    for (const id of ids) {
      await tx`
        insert into identity.accounts (id, auth_user_id, email, country_code, preferred_language)
        values (${id}, ${randomUUID()}, ${`t3-${id}@example.test`}, 'FR', 'fr')`;
    }
  });
  return ids;
}

/** Writes one line through the only public path at J2: identity.grant_role() by an admin. */
async function grantAsAdmin(
  tx: postgres.TransactionSql,
  target: string,
): Promise<void> {
  await takeRole(tx, "influx_admin", {
    accountId: dataSet.accounts.admin.a.id,
    role: "admin",
    aal: "aal2",
  });
  await tx`select identity.grant_role(${target}, 'advertiser', 'test_t3')`;
}

async function grantCommitted(
  sql: postgres.Sql,
  target: string,
): Promise<void> {
  await sql.begin((tx) => grantAsAdmin(tx, target));
}

async function lastSeq(): Promise<number> {
  const [row] = await migration<{ seq: string }[]>`
    select max(seq)::text as seq from audit.audit_events where chain_key = 'global'`;
  return Number(row?.seq);
}

// ---------------------------------------------------------------------------------------------

describe("T3.1: no execution role mutates an append-only table", () => {
  it("lists the append-only tables of the Lot 0", () => {
    expect([...APPEND_ONLY_TABLES].sort()).toEqual(
      [
        "audit.audit_events",
        "audit.chain_checks",
        "identity.consent_events",
        "identity.terms_acceptances",
      ].sort(),
    );
  });

  it.each(LOGIN_ROLES)("%s without a role taken", async (role) => {
    const refusals = await inRolledBackTransaction(
      loginRole(role),
      async (tx) => {
        const results: string[] = [];
        for (const table of APPEND_ONLY_TABLES) {
          for (const statement of mutationsOf(table)) {
            const result = await probe(tx, statement);
            if (
              result.outcome !== "error" ||
              result.code !== INSUFFICIENT_PRIVILEGE
            ) {
              results.push(`${statement}: ${JSON.stringify(result)}`);
            }
          }
        }
        return results;
      },
    );
    expect(refusals).toEqual([]);
  });

  it.each(TAKEN)("%s with the context of account A", async (role) => {
    const business = {
      influx_advertiser: "advertiser",
      influx_creator: "creator",
      influx_agent: "agent",
      influx_admin: "admin",
    } as const;
    const refusals = await inRolledBackTransaction(
      loginRole(TAKEN_ROLES[role]),
      async (tx) => {
        const name =
          role in business
            ? business[role as keyof typeof business]
            : undefined;
        await takeRole(
          tx,
          role,
          name === undefined
            ? undefined
            : {
                accountId: dataSet.accounts[name].a.id,
                role: name,
                aal: name === "agent" || name === "admin" ? "aal2" : "aal1",
              },
        );
        const results: string[] = [];
        for (const table of APPEND_ONLY_TABLES) {
          for (const statement of mutationsOf(table)) {
            const result = await probe(tx, statement);
            if (
              result.outcome !== "error" ||
              result.code !== INSUFFICIENT_PRIVILEGE
            ) {
              results.push(`${statement}: ${JSON.stringify(result)}`);
            }
          }
        }
        return results;
      },
    );
    expect(refusals).toEqual([]);
  });

  it("gives influx_audit_writer no UPDATE, DELETE or TRUNCATE (catalogue)", async () => {
    const [row] = await migration<{ any: boolean }[]>`
      select has_table_privilege('influx_audit_writer', 'audit.audit_events', 'UPDATE')
          or has_table_privilege('influx_audit_writer', 'audit.audit_events', 'DELETE')
          or has_table_privilege('influx_audit_writer', 'audit.audit_events', 'TRUNCATE')
          as any`;
    expect(row?.any).toBe(false);
  });
});

describe("T3.2: triggers and ownership", () => {
  it.each(LOGIN_ROLES)(
    "%s can neither disable a trigger nor drop an append-only table",
    async (role) => {
      const accepted = await inRolledBackTransaction(
        loginRole(role),
        async (tx) => {
          const results: string[] = [];
          for (const table of APPEND_ONLY_TABLES) {
            for (const statement of [
              `alter table ${table} disable trigger all`,
              `drop table ${table}`,
            ]) {
              const result = await probe(tx, statement);
              if (
                result.outcome !== "error" ||
                result.code !== INSUFFICIENT_PRIVILEGE
              ) {
                results.push(`${statement}: ${JSON.stringify(result)}`);
              }
            }
          }
          return results;
        },
      );
      expect(accepted).toEqual([]);
    },
  );

  it("stops even the owner: UPDATE, DELETE and TRUNCATE raise the append-only exception", async () => {
    const outcomes = await inRolledBackTransaction(migration, async (tx) => {
      const results: string[] = [];
      for (const table of APPEND_ONLY_TABLES) {
        for (const statement of mutationsOf(table)) {
          try {
            await tx.savepoint((savepoint) => savepoint.unsafe(statement));
            results.push(`${statement}: accepted`);
          } catch (error) {
            const code = (error as { code?: string }).code;
            const message = (error as Error).message;
            if (
              code !== INSUFFICIENT_PRIVILEGE ||
              !message.includes("append-only")
            ) {
              results.push(`${statement}: ${code} ${message}`);
            }
          }
        }
      }
      return results;
    });
    expect(outcomes).toEqual([]);
  });
});

describe("T3.3: the register is written by audit.append() only", () => {
  it("refuses a direct INSERT to every execution role; only the writer holds INSERT", async () => {
    const [row] = await migration<{ holders: string[] }[]>`
      select coalesce(array_agg(rolname order by rolname), '{}') as holders
        from pg_catalog.pg_roles
       where rolname like 'influx\\_%'
         and has_table_privilege(rolname, 'audit.audit_events', 'INSERT')`;
    expect(row?.holders).toEqual(["influx_audit_writer"]);

    for (const role of TAKEN) {
      const result = await inRolledBackTransaction(
        loginRole(TAKEN_ROLES[role]),
        async (tx) => {
          await takeRole(tx, role);
          return probe(tx, "insert into audit.audit_events default values");
        },
      );
      expect(result, role).toEqual({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    }
  });
});

describe("T3.4 to T3.9: the chain", () => {
  beforeAll(async () => {
    // At least five lines after the genesis, written through audit.append() and committed.
    const app = loginRole("influx_app");
    for (const target of await createTargets(5)) {
      await grantCommitted(app, target);
    }
  });

  it("T3.4: is continuous, and every hash recomputed from the canonical form matches", async () => {
    const [links] = await migration<{ breaks: number; gaps: number }[]>`
      select count(*) filter (where prev_hash <> previous_row_hash)::int as breaks,
             count(*) filter (where seq <> previous_seq + 1)::int as gaps
        from (select seq, prev_hash,
                     lag(row_hash) over (order by seq) as previous_row_hash,
                     lag(seq) over (order by seq) as previous_seq
                from audit.audit_events where chain_key = 'global') chain
       where previous_seq is not null`;
    expect(links).toEqual({ breaks: 0, gaps: 0 });
    const result = await inRolledBackTransaction(migration, (tx) =>
      verify(tx, true),
    );
    expect(result.status).toBe("ok");
    expect(result.anomaly).toBeNull();
  });

  it("T3.5: detects a changed content (broken_row, exact seq)", async () => {
    const target = (await lastSeq()) - 2;
    const result = await inRolledBackTransaction(migration, async (tx) => {
      await tx`alter table audit.audit_events disable trigger audit_events_no_update_delete`;
      await tx`update audit.audit_events set payload = payload || '{"altered": true}'::jsonb
                where chain_key = 'global' and seq = ${target}`;
      await tx`alter table audit.audit_events enable trigger audit_events_no_update_delete`;
      return verify(tx, true);
    });
    expect(result).toMatchObject({
      status: "broken",
      anomaly: "broken_row",
      broken_at_seq: String(target),
    });
  });

  it("T3.6: detects a rewritten link (broken_link)", async () => {
    const target = (await lastSeq()) - 1;
    const result = await inRolledBackTransaction(migration, async (tx) => {
      await tx`alter table audit.audit_events disable trigger audit_events_no_update_delete`;
      await tx`update audit.audit_events set prev_hash = ${randomBytes(32)}
                where chain_key = 'global' and seq = ${target}`;
      await tx`alter table audit.audit_events enable trigger audit_events_no_update_delete`;
      return verify(tx, true);
    });
    expect(result).toMatchObject({
      status: "broken",
      anomaly: "broken_link",
      broken_at_seq: String(target),
    });
  });

  it("T3.7: detects a deleted middle line (gap on the missing seq)", async () => {
    const target = (await lastSeq()) - 2;
    const result = await inRolledBackTransaction(migration, async (tx) => {
      await tx`alter table audit.audit_events disable trigger audit_events_no_update_delete`;
      await tx`delete from audit.audit_events where chain_key = 'global' and seq = ${target}`;
      await tx`alter table audit.audit_events enable trigger audit_events_no_update_delete`;
      return verify(tx, true);
    });
    expect(result).toMatchObject({
      status: "gap",
      anomaly: "gap",
      broken_at_seq: String(target),
    });
  });

  it("T3.8: fifty simultaneous writers produce fifty consecutive seq, no fork", async () => {
    const targets = await createTargets(50);
    // Fifty DISTINCT connections (not the shared one), closed at the end.
    const connections = targets.map(() =>
      connectAsLoginRole("influx_app", { max: 1 }),
    );
    await Promise.all(
      targets.map((target, index) => {
        const sql = connections[index];
        if (sql === undefined) {
          throw new Error("missing connection");
        }
        return grantCommitted(sql, target);
      }),
    );
    await Promise.all(connections.map((sql) => sql.end({ timeout: 1 })));
    const [row] = await migration<
      { count: number; span: number; distinct: number }[]
    >`
      select count(*)::int as count, (max(seq) - min(seq))::int as span,
             count(distinct prev_hash)::int as distinct
        from audit.audit_events
       where subject_id = any (${targets})`;
    expect(row).toEqual({ count: 50, span: 49, distinct: 50 });
    const result = await inRolledBackTransaction(migration, (tx) =>
      verify(tx, true),
    );
    expect(result.status).toBe("ok");
  });

  it("T3.9: a rolled-back transaction leaves no hole", async () => {
    const [rolledBack, committed] = await createTargets(2);
    if (rolledBack === undefined || committed === undefined) {
      throw new Error("targets missing");
    }
    const app = loginRole("influx_app");
    const before = await lastSeq();
    await inRolledBackTransaction(app, (tx) => grantAsAdmin(tx, rolledBack));
    await grantCommitted(app, committed);
    expect(await lastSeq()).toBe(before + 1);
  });
});

describe("T3.10 and T3.11: the verification record, and trailing lines", () => {
  it("T3.10: each verification writes one chain_checks line with a head hash", async () => {
    const written = await inRolledBackTransaction(migration, async (tx) => {
      const [before] = await tx<{ count: number }[]>`
        select count(*)::int as count from audit.chain_checks`;
      const result = await verify(tx, false);
      const [after] = await tx<{ count: number; hash: Buffer }[]>`
        select count(*)::int as count,
               (select head_row_hash from audit.chain_checks order by id desc limit 1) as hash
          from audit.chain_checks`;
      return {
        before: before?.count,
        after: after?.count,
        hash: after?.hash,
        result,
      };
    });
    expect((written.after ?? 0) - (written.before ?? 0)).toBe(1);
    expect(written.hash?.length).toBe(32);
    expect(written.result.status).toBe("ok");
  });

  it("T3.11: detects the deletion of the last line through the anchor", async () => {
    const result = await inRolledBackTransaction(migration, async (tx) => {
      // The anchor: a successful check up to the current head.
      expect((await verify(tx, false)).status).toBe("ok");
      await tx`alter table audit.audit_events disable trigger audit_events_no_update_delete`;
      await tx`delete from audit.audit_events where chain_key = 'global'
                 and seq = (select max(seq) from audit.audit_events where chain_key = 'global')`;
      await tx`alter table audit.audit_events enable trigger audit_events_no_update_delete`;
      return verify(tx, false);
    });
    expect(result.status).toBe("gap");
  });

  it("T3.11: detects a rewritten last line, hashes recomputed, through the anchor", async () => {
    const result = await inRolledBackTransaction(migration, async (tx) => {
      expect((await verify(tx, false)).status).toBe("ok");
      await tx`alter table audit.audit_events disable trigger audit_events_no_update_delete`;
      await tx`update audit.audit_events
                  set payload = payload || '{"rewritten": true}'::jsonb,
                      row_hash = sha256(row_hash)
                where chain_key = 'global'
                  and seq = (select max(seq) from audit.audit_events where chain_key = 'global')`;
      await tx`alter table audit.audit_events enable trigger audit_events_no_update_delete`;
      return verify(tx, false);
    });
    expect(result.status).toBe("broken");
  });
});

// What EC-36 will give influx_auth and influx_worker through a narrow function, and a direct
// right for influx_admin, so that each connection role can reach append() in the M2 tests only.
const APPEND_CALLERS = APPEND_TEMPORARY_GRANTEES.join(", ");
const AUDIT_USAGE_CALLERS = AUDIT_USAGE_TEMPORARY_GRANTEES.join(", ");

/** Grants (or revokes) the temporary rights as the owner, through the window of 0006 §9. */
async function setTemporaryRights(grant: boolean): Promise<void> {
  await migration.begin(async (tx) => {
    await tx.unsafe(
      "grant influx_audit_writer to current_user with inherit false, set true",
    );
    await tx.unsafe("set local role influx_audit_writer");
    await tx.unsafe(
      grant
        ? `grant execute on function ${APPEND_FUNCTION} to ${APPEND_CALLERS}`
        : `revoke execute on function ${APPEND_FUNCTION} from ${APPEND_CALLERS}`,
    );
    await tx.unsafe("reset role");
    await tx.unsafe("revoke influx_audit_writer from current_user");
    await tx.unsafe(
      grant
        ? `grant usage on schema audit to ${AUDIT_USAGE_CALLERS}`
        : `revoke usage on schema audit from ${AUDIT_USAGE_CALLERS}`,
    );
  });
}

describe("V4: the temporary rights of an interrupted run are refused, never ignored", () => {
  it("fails with the reset instruction while they are granted, and passes once revoked", async () => {
    await assertNoTemporaryRights(migration);
    await setTemporaryRights(true);
    try {
      const refusal = assertNoTemporaryRights(migration);
      await expect(refusal).rejects.toThrow(INTERRUPTED_RUN_MESSAGE);
      await expect(refusal).rejects.toThrow(
        `influx_admin: EXECUTE on ${APPEND_FUNCTION}`,
      );
      await expect(refusal).rejects.toThrow(
        "influx_worker: USAGE on schema audit",
      );
    } finally {
      await setTemporaryRights(false);
    }
    await expect(assertNoTemporaryRights(migration)).resolves.toBeUndefined();
  });
});

describe("M2: the actor type of a line is bound to session_user (0009)", () => {
  beforeAll(async () => {
    // V4: granting over rights left by an interrupted run would hide them until afterAll.
    await assertNoTemporaryRights(migration);
    await setTemporaryRights(true);
  });

  afterAll(async () => {
    await setTemporaryRights(false);
  });

  type Written = { actor_type: string; actor_account_id: string | null };

  /**
   * Appends one line under `role` with the given settings, commits, and reads the line back as
   * the migration role. `influx.role` is set by hand: the case of an application that lies.
   */
  async function appendAs(
    login: LoginRole,
    role: TakenRole,
    settings: { account?: string; role?: string },
  ): Promise<Written> {
    const seq = await loginRole(login).begin(async (tx) => {
      await takeRole(tx, role);
      await tx`select
        pg_catalog.set_config('influx.account', ${settings.account ?? ""}, true),
        pg_catalog.set_config('influx.role', ${settings.role ?? ""}, true)`;
      const [row] = await tx<{ seq: string }[]>`
        select audit.append('account.role_granted', 'account', ${randomUUID()})::text as seq`;
      return row?.seq;
    });
    const [line] = await migration<Written[]>`
      select actor_type::text, actor_account_id::text
        from audit.audit_events where chain_key = 'global' and seq = ${seq ?? "0"}`;
    if (line === undefined) {
      throw new Error("the appended line was not found");
    }
    return line;
  }

  it("records a service act for influx_auth_login, even when influx.role says admin", async () => {
    const account = dataSet.accounts.admin.a.id;
    expect(
      await appendAs("influx_auth_login", "influx_auth", {
        account,
        role: "admin",
      }),
    ).toEqual({ actor_type: "service", actor_account_id: account });
    expect(
      await appendAs("influx_auth_login", "influx_auth", { role: "admin" }),
    ).toEqual({ actor_type: "system", actor_account_id: null });
  });

  it("records a service act for influx_worker_login, even when influx.role says agent", async () => {
    const account = dataSet.accounts.agent.a.id;
    expect(
      await appendAs("influx_worker_login", "influx_worker", {
        account,
        role: "agent",
      }),
    ).toEqual({ actor_type: "service", actor_account_id: account });
  });

  it("derives the actor from influx.role for influx_app, and refuses anything else", async () => {
    const account = dataSet.accounts.admin.a.id;
    expect(
      await appendAs("influx_app", "influx_admin", { account, role: "admin" }),
    ).toEqual({ actor_type: "admin", actor_account_id: account });
    for (const settings of [
      { account, role: "service" },
      { account, role: "system" },
      { account },
      { role: "admin" },
    ]) {
      await expect(
        appendAs("influx_app", "influx_admin", settings),
        JSON.stringify(settings),
      ).rejects.toMatchObject({ code: INSUFFICIENT_PRIVILEGE });
    }
  });

  it("records a system act without account for any other session_user (migration role)", async () => {
    const account = dataSet.accounts.admin.a.id;
    const line = await inRolledBackTransaction(migration, async (tx) => {
      await tx.unsafe(
        "grant influx_audit_writer to current_user with inherit false, set true",
      );
      await tx.unsafe("set local role influx_audit_writer");
      await tx`select
        pg_catalog.set_config('influx.account', ${account}, true),
        pg_catalog.set_config('influx.role', 'admin', true)`;
      // Two statements: a statement does not see the row its own function call inserts.
      const [written] = await tx<{ seq: string }[]>`
        select audit.append('account.role_granted', 'account', ${randomUUID()})::text as seq`;
      const [row] = await tx<Written[]>`
        select actor_type::text, actor_account_id::text
          from audit.audit_events
         where chain_key = 'global' and seq = ${written?.seq ?? "0"}`;
      return row;
    });
    expect(line).toEqual({ actor_type: "system", actor_account_id: null });
  });

  it("keeps the chain continuous and verifiable after these lines", async () => {
    const result = await inRolledBackTransaction(migration, (tx) =>
      verify(tx, true),
    );
    expect(result.status).toBe("ok");
  });
});
