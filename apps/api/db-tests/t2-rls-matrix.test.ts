// T2 — RLS by role and by table, and failure on any undeclared table (docs/mvp/18 T2).
// The expected rights live in @influx/test-kit/rights (derived from 03 §3); this file only probes.
import {
  inRolledBackTransaction,
  probe,
  TAKEN_ROLES,
  takeRole,
  type DataSet,
  type ProbeResult,
  type UserContext,
} from "@influx/test-kit/db";
import {
  EXPECTED_PRIVILEGES,
  FOREIGN_SCHEMAS_OWNED_BY_MIGRATION_ROLE,
  OPERATIONS,
  OUR_SCHEMAS,
  PROBED_ROLES,
  TABLE_RIGHTS,
  type Operation,
  type ProbedRole,
  type TableRights,
} from "@influx/test-kit/rights";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const REPOSITORY_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const INSUFFICIENT_PRIVILEGE = "42501";
const DATA_API_ROLES = ["anon", "authenticated", "service_role"] as const;

let dataSet: DataSet;
let migration: postgres.Sql;

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// Probing
// ---------------------------------------------------------------------------------------------

type Mode = "context" | "no_context" | "aal1";

const BUSINESS_ROLE_OF: Partial<Record<ProbedRole, UserContext["role"]>> = {
  influx_advertiser: "advertiser",
  influx_creator: "creator",
  influx_agent: "agent",
  influx_admin: "admin",
};

function contextOf(role: ProbedRole, mode: Mode): UserContext | undefined {
  const business = BUSINESS_ROLE_OF[role];
  if (business === undefined || mode === "no_context") {
    return undefined;
  }
  const internal = business === "agent" || business === "admin";
  return {
    accountId: dataSet.accounts[business].a.id,
    role: business,
    aal: internal && mode === "context" ? "aal2" : "aal1",
  };
}

/** The other account (B) of the same business role: never visible, never writable. */
function otherAccountOf(role: ProbedRole): string {
  const business = BUSINESS_ROLE_OF[role];
  return business === undefined
    ? "00000000-0000-4000-8000-000000000000"
    : dataSet.accounts[business].b.id;
}

const PRIVILEGE_OF: Readonly<Record<Operation, string>> = {
  select: "SELECT",
  insert: "INSERT",
  update: "UPDATE",
  delete: "DELETE",
};

/**
 * Rights in the catalogue, read by the migration role: `has_*_privilege('schema.table')` resolves
 * the name with the rights of the CALLER, which a probed role may lack (no USAGE on the schema).
 * DELETE has no column form; the others count a column grant as a right (0004 column grants).
 */
async function hasPrivilege(
  role: ProbedRole,
  table: string,
  operation: Operation,
): Promise<boolean> {
  const rows =
    operation === "delete"
      ? await migration<{ has: boolean }[]>`
          select has_table_privilege(${role}, ${table}, 'DELETE') as has`
      : await migration<{ has: boolean }[]>`
          select has_any_column_privilege(${role}, ${table}, ${PRIVILEGE_OF[operation]}) as has`;
  return rows[0]?.has === true;
}

function attemptOf(rights: TableRights, operation: Operation, account: string) {
  const column = rights.probeColumn;
  switch (operation) {
    case "select":
      return {
        statement: `select ${column} from ${rights.table}`,
        parameters: [],
      };
    case "insert":
      return rights.insertTemplate === undefined
        ? {
            statement: `insert into ${rights.table} default values`,
            parameters: [],
          }
        : { statement: rights.insertTemplate, parameters: [account] };
    case "update":
      return rights.ownerColumn === undefined
        ? {
            statement: `update ${rights.table} set ${column} = ${column}`,
            parameters: [],
          }
        : {
            statement: `update ${rights.table} set ${rights.updateSet ?? `${column} = ${column}`} where ${rights.ownerColumn} = $1`,
            parameters: [account],
          };
    // Filtered by the owner column like `update` (testeur Q1, end of J2): an unfiltered delete of
    // account A's rows would also take B's if the policy let them through, and the later check
    // on B would then find nothing to delete and pass.
    case "delete":
      return rights.ownerColumn === undefined
        ? { statement: `delete from ${rights.table}`, parameters: [] }
        : {
            statement: `delete from ${rights.table} where ${rights.ownerColumn} = $1`,
            parameters: [account],
          };
  }
}

function describeProbe(result: ProbeResult): string {
  return result.outcome === "rows"
    ? `${result.count} row(s)`
    : `error ${result.code}`;
}

/** Probes one role on every table and operation; returns the deviations, empty when conform. */
async function deviationsOf(role: ProbedRole, mode: Mode): Promise<string[]> {
  const deviations: string[] = [];
  const sql = loginRole(TAKEN_ROLES[role]);
  const context = contextOf(role, mode);
  // An elevated role has no business context: its probes act on account A of the agent role
  // (a backoffice session, a P0 journal line of the data set). A business role without
  // context acts on account B, whose rows it must never reach.
  const self =
    context?.accountId ??
    (BUSINESS_ROLE_OF[role] === undefined
      ? dataSet.accounts.agent.a.id
      : otherAccountOf(role));
  const other = otherAccountOf(role);
  await inRolledBackTransaction(sql, async (tx) => {
    await takeRole(tx, role, context);
    for (const rights of TABLE_RIGHTS) {
      for (const operation of OPERATIONS) {
        const expectation = rights.expected[role]?.[operation];
        const label = `${role} ${operation} ${rights.table} (${mode})`;
        const privileged = await hasPrivilege(role, rights.table, operation);
        const own = attemptOf(rights, operation, self);
        const result = await probe(tx, own.statement, own.parameters);

        if (expectation === undefined) {
          // refus_droit: no right in the catalogue, and the attempt raises 42501.
          if (privileged) {
            deviations.push(`${label}: expected refus_droit, the right exists`);
          }
          if (
            result.outcome !== "error" ||
            result.code !== INSUFFICIENT_PRIVILEGE
          ) {
            deviations.push(
              `${label}: expected 42501, got ${describeProbe(result)}`,
            );
          }
          continue;
        }
        if (!privileged) {
          deviations.push(
            `${label}: expected ${expectation.form}, the right is missing`,
          );
          continue;
        }
        if (mode !== "context" || expectation.form === "vide") {
          // filtré (T2.5), or an empty table by design: no row seen or touched, insert refused.
          const insertCode =
            mode === "context"
              ? INSUFFICIENT_PRIVILEGE
              : (rights.filteredInsertCode ?? INSUFFICIENT_PRIVILEGE);
          const expected =
            operation === "insert"
              ? result.outcome === "error" && result.code === insertCode
              : result.outcome === "rows" && result.count === 0;
          if (!expected) {
            deviations.push(
              `${label}: expected ${mode === "context" ? "vide" : "filtré"}, got ${describeProbe(result)}`,
            );
          }
          continue;
        }
        if (result.outcome !== "rows" || result.count < 1) {
          deviations.push(
            `${label}: expected ${expectation.form} on its own rows, got ${describeProbe(result)}`,
          );
        }
        if (expectation.form === "propre") {
          deviations.push(
            ...(await otherRowsDeviations(tx, rights, operation, other, label)),
          );
        }
      }
    }
  });
  return deviations;
}

/** `propre`: the rows of account B are never seen, touched nor written. */
async function otherRowsDeviations(
  tx: postgres.TransactionSql,
  rights: TableRights,
  operation: Operation,
  other: string,
  label: string,
): Promise<string[]> {
  const owner = rights.ownerColumn;
  if (owner === undefined) {
    return [`${label}: propre without an owner column in the expectations`];
  }
  if (operation === "select") {
    const result = await probe(
      tx,
      `select ${owner} from ${rights.table} where ${owner} is distinct from (select influx.current_account_id())`,
    );
    return result.outcome === "rows" && result.count === 0
      ? []
      : [
          `${label}: rows of another account are visible (${describeProbe(result)})`,
        ];
  }
  const attempt = attemptOf(rights, operation, other);
  const result = await probe(tx, attempt.statement, attempt.parameters);
  const refused =
    operation === "insert"
      ? result.outcome === "error" && result.code === INSUFFICIENT_PRIVILEGE
      : result.outcome === "rows" && result.count === 0;
  return refused
    ? []
    : [
        `${label}: the row of another account was written (${describeProbe(result)})`,
      ];
}

// ---------------------------------------------------------------------------------------------
// T2.2, T2.3: inventory
// ---------------------------------------------------------------------------------------------

describe("T2.2 and T2.3: every table of our schemas is declared, protected and alive", () => {
  it("has RLS enabled, forced, a policy and an expectation line on every table", async () => {
    const tables = await migration<
      { name: string; enabled: boolean; forced: boolean; policies: number }[]
    >`
      select n.nspname || '.' || c.relname as name,
             c.relrowsecurity as enabled,
             c.relforcerowsecurity as forced,
             (select count(*)::int from pg_catalog.pg_policies p
               where p.schemaname = n.nspname and p.tablename = c.relname) as policies
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p')
         and n.nspname = any (${OUR_SCHEMAS as unknown as string[]})
       order by 1`;
    const declared = new Set(TABLE_RIGHTS.map((rights) => rights.table));
    const problems = tables.flatMap((table) => [
      ...(table.enabled ? [] : [`${table.name}: RLS not enabled`]),
      ...(table.forced ? [] : [`${table.name}: RLS not forced`]),
      ...(table.policies > 0 ? [] : [`${table.name}: no policy`]),
      ...(declared.has(table.name)
        ? []
        : [`${table.name}: absent from the expected rights (test-kit/rights)`]),
    ]);
    expect(problems).toEqual([]);
    // T2.3: no orphan expectation
    const existing = new Set(tables.map((table) => table.name));
    expect(
      TABLE_RIGHTS.map((r) => r.table).filter((name) => !existing.has(name)),
    ).toEqual([]);
    expect(tables.length).toBeGreaterThanOrEqual(15);
  });

  it("finds a row in every table for the migration role, commission_rates excepted (rule 3)", async () => {
    const empty: string[] = [];
    for (const rights of TABLE_RIGHTS) {
      const [row] = await migration.unsafe<{ count: number }[]>(
        `select count(*)::int as count from ${rights.table}`,
      );
      const isRates = rights.table === "billing.commission_rates";
      if ((row?.count ?? 0) === 0 && !isRates) {
        empty.push(rights.table);
      }
      if (isRates) {
        expect(row?.count).toBe(0);
      }
    }
    expect(empty).toEqual([]);
  });

  it("owns no schema outside the declared list, and keeps public empty of our objects", async () => {
    const schemas = await migration<{ nspname: string }[]>`
      select nspname from pg_catalog.pg_namespace
       where nspowner = (select oid from pg_catalog.pg_roles where rolname = current_user)`;
    const allowed = new Set<string>([
      ...OUR_SCHEMAS,
      ...FOREIGN_SCHEMAS_OWNED_BY_MIGRATION_ROLE,
    ]);
    expect(
      schemas.map((row) => row.nspname).filter((name) => !allowed.has(name)),
    ).toEqual([]);

    const inPublic = await migration<{ name: string }[]>`
      select c.relname as name from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      union all
      select p.proname from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'`;
    expect(inPublic).toEqual([]);
  });

  // EC-35 (3), accepted by expert-cybersecurite on condition of this test: _realtime and extensions
  // are excluded from T2.2 because Supabase creates them, so no influx_% role may hold anything
  // there — no schema right (PUBLIC included, through has_schema_privilege), no ACL entry on the
  // schema or on any object in it, no default privilege, no ownership.
  it("gives no influx_% role any right in the excluded schemas _realtime and extensions (EC-35 (3))", async () => {
    const excluded = FOREIGN_SCHEMAS_OWNED_BY_MIGRATION_ROLE.filter(
      (schema) => schema !== "supabase_migrations",
    ) as string[];
    const present = await migration<{ nspname: string }[]>`
      select nspname from pg_catalog.pg_namespace
       where nspname = any (${excluded}) order by 1`;
    // Never a vacuous pass: both schemas exist, and the closed list of roles is there.
    expect(present.map((row) => row.nspname)).toEqual([
      "_realtime",
      "extensions",
    ]);
    const [roles] = await migration<{ count: number }[]>`
      select count(*)::int as count from pg_catalog.pg_roles where rolname like 'influx\\_%'`;
    expect(roles?.count ?? 0).toBeGreaterThanOrEqual(12);

    const rights = await migration<{ line: string }[]>`
      with excluded as (
        select oid, nspname from pg_catalog.pg_namespace where nspname = any (${excluded})
      ), ours as (
        select oid, rolname from pg_catalog.pg_roles where rolname like 'influx\\_%'
      )
      select r.rolname || ': ' || p.privilege || ' on schema ' || e.nspname as line
        from ours r cross join excluded e
        cross join (values ('USAGE'), ('CREATE')) as p (privilege)
       where pg_catalog.has_schema_privilege(r.oid, e.oid, p.privilege)
      union all
      select r.rolname || ': ' || a.privilege_type || ' on schema ' || e.nspname
        from excluded e
        join pg_catalog.pg_namespace n on n.oid = e.oid
        cross join lateral pg_catalog.aclexplode(n.nspacl) a
        join ours r on r.oid = a.grantee
      union all
      select r.rolname || ': ' || a.privilege_type || ' on ' || e.nspname || '.' || c.relname
        from pg_catalog.pg_class c
        join excluded e on e.oid = c.relnamespace
        cross join lateral pg_catalog.aclexplode(c.relacl) a
        join ours r on r.oid = a.grantee
      union all
      select r.rolname || ': ' || a.privilege_type || ' on column ' || e.nspname || '.'
             || c.relname || '.' || att.attname
        from pg_catalog.pg_attribute att
        join pg_catalog.pg_class c on c.oid = att.attrelid
        join excluded e on e.oid = c.relnamespace
        cross join lateral pg_catalog.aclexplode(att.attacl) a
        join ours r on r.oid = a.grantee
      union all
      select r.rolname || ': ' || a.privilege_type || ' on function ' || e.nspname || '.'
             || f.proname
        from pg_catalog.pg_proc f
        join excluded e on e.oid = f.pronamespace
        cross join lateral pg_catalog.aclexplode(f.proacl) a
        join ours r on r.oid = a.grantee
      union all
      select r.rolname || ': ' || a.privilege_type || ' on type ' || e.nspname || '.' || t.typname
        from pg_catalog.pg_type t
        join excluded e on e.oid = t.typnamespace
        cross join lateral pg_catalog.aclexplode(t.typacl) a
        join ours r on r.oid = a.grantee
      union all
      select r.rolname || ': default ' || a.privilege_type || ' in ' || e.nspname
        from pg_catalog.pg_default_acl d
        join excluded e on e.oid = d.defaclnamespace
        cross join lateral pg_catalog.aclexplode(d.defaclacl) a
        join ours r on r.oid = a.grantee
      union all
      select r.rolname || ': owns ' || e.nspname || '.' || c.relname
        from pg_catalog.pg_class c
        join excluded e on e.oid = c.relnamespace
        join ours r on r.oid = c.relowner
      union all
      select r.rolname || ': owns ' || e.nspname || '.' || f.proname
        from pg_catalog.pg_proc f
        join excluded e on e.oid = f.pronamespace
        join ours r on r.oid = f.proowner
      union all
      select r.rolname || ': owns ' || e.nspname || '.' || t.typname
        from pg_catalog.pg_type t
        join excluded e on e.oid = t.typnamespace
        join ours r on r.oid = t.typowner
      union all
      select r.rolname || ': owns schema ' || e.nspname
        from excluded e
        join pg_catalog.pg_namespace n on n.oid = e.oid
        join ours r on r.oid = n.nspowner
      order by 1`;
    expect(rights.map((row) => row.line)).toEqual([]);
  });

  it("declares every view of our schemas security_invoker (P5)", async () => {
    const views = await migration<{ name: string }[]>`
      select n.nspname || '.' || c.relname as name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('v', 'm')
         and n.nspname = any (${OUR_SCHEMAS as unknown as string[]})
         and not coalesce('security_invoker=true' = any (c.reloptions), false)`;
    expect(views).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// T2.1, T2.5: probes, one rolled-back transaction per role and mode (18 A-4)
// ---------------------------------------------------------------------------------------------

describe("T2.1: each role, with the full context of account A, matches the matrix", () => {
  it.each(PROBED_ROLES)("%s", async (role) => {
    expect(await deviationsOf(role, "context")).toEqual([]);
  });
});

describe("T2.5: a role taken without context, or in aal1, sees nothing", () => {
  it.each(PROBED_ROLES.filter((role) => role in BUSINESS_ROLE_OF))(
    "%s without context",
    async (role) => {
      expect(await deviationsOf(role, "no_context")).toEqual([]);
    },
  );

  it.each(["influx_agent", "influx_admin"] as const)(
    "%s in aal1",
    async (role) => {
      expect(await deviationsOf(role, "aal1")).toEqual([]);
    },
  );
});

// ---------------------------------------------------------------------------------------------
// T2.4, T2.6, T2.7, T2.8: the catalogue
// ---------------------------------------------------------------------------------------------

describe("T2.4: PUBLIC and the Data API roles have nothing on our schemas", () => {
  it("holds no schema, table, sequence or function privilege", async () => {
    const leaks = await migration<{ leak: string }[]>`
      with ours as (
        select oid, nspname from pg_catalog.pg_namespace
         where nspname = any (${OUR_SCHEMAS as unknown as string[]})),
      grantees as (
        select 0::oid as oid, 'PUBLIC' as name
        union all
        select oid, rolname from pg_catalog.pg_roles
         where rolname = any (${DATA_API_ROLES as unknown as string[]}))
      select g.name || ' ' || a.privilege_type || ' schema ' || n.nspname as leak
        from ours n, aclexplode(coalesce(
               (select nspacl from pg_catalog.pg_namespace where oid = n.oid),
               acldefault('n', (select nspowner from pg_catalog.pg_namespace where oid = n.oid)))) a
        join grantees g on g.oid = a.grantee
      union all
      select g.name || ' ' || a.privilege_type || ' ' || n.nspname || '.' || c.relname
        from pg_catalog.pg_class c join ours n on n.oid = c.relnamespace,
             aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
        join grantees g on g.oid = a.grantee
       where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
      union all
      select g.name || ' ' || a.privilege_type || ' ' || p.oid::regprocedure::text
        from pg_catalog.pg_proc p join ours n on n.oid = p.pronamespace,
             aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
        join grantees g on g.oid = a.grantee`;
    expect(leaks.map((row) => row.leak)).toEqual([]);
  });

  it("exposes none of our schemas through the Data API (supabase/config.toml [api].schemas)", () => {
    const config = readFileSync(
      path.join(REPOSITORY_ROOT, "supabase/config.toml"),
      "utf8",
    );
    const line = config
      .split("\n")
      .find((entry) => /^\s*schemas\s*=/.test(entry));
    const exposed = [...(line ?? "").matchAll(/"([^"]+)"/g)].map(
      (match) => match[1],
    );
    expect(
      exposed.filter((name) =>
        (OUR_SCHEMAS as readonly string[]).includes(name ?? ""),
      ),
    ).toEqual([]);
  });
});

describe("T2.6: write-forbidden columns are refused at column level", () => {
  // identity_revealed_at, origin, reference and the two historised countries arrive with their
  // tables (Lot 4, Lot 5). The check runs from now on and bites as soon as one appears.
  it("grants no INSERT or UPDATE on them to any execution role", async () => {
    const granted = await migration<{ grant: string }[]>`
      select r.rolname || ' ' || a.privilege_type || ' ' || n.nspname || '.' || c.relname || '.' ||
             at.attname as grant
        from pg_catalog.pg_attribute at
        join pg_catalog.pg_class c on c.oid = at.attrelid
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace,
             aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))
                        || coalesce(at.attacl, '{}'::aclitem[])) a
        join pg_catalog.pg_roles r on r.oid = a.grantee
       where n.nspname = any (${OUR_SCHEMAS as unknown as string[]})
         and at.attname in ('identity_revealed_at', 'origin', 'reference',
                            'advertiser_country_code', 'creator_country_code')
         and a.privilege_type in ('INSERT', 'UPDATE')
         and r.rolname like 'influx\\_%'`;
    // Homonym, not a protected column: the reception channel of a raw Brevo line (webhook or
    // reconciliation, 0116, J7 decision 2), written once at insertion by its function owner and
    // never updated (guard of 0116). Only that INSERT, by that owner, is let through.
    const HOMONYMS = [
      "influx_leads_definer INSERT leads.brevo_inbound_events.origin",
    ];
    expect(granted.filter((row) => !HOMONYMS.includes(row.grant))).toEqual([]);
  });
});

describe("T2.7: exact snapshot of the privileges of the closed list", () => {
  it("equals the expected snapshot, no more, no less", async () => {
    const rows = await migration<{ line: string }[]>`
      with roles as (select oid, rolname from pg_catalog.pg_roles where rolname like 'influx\\_%'),
      ours as (select oid, nspname from pg_catalog.pg_namespace
                where nspname = any (${OUR_SCHEMAS as unknown as string[]})),
      t as (
        select r.rolname g, 'table' k, n.nspname || '.' || c.relname o, a.privilege_type p
          from pg_catalog.pg_class c join ours n on n.oid = c.relnamespace,
               aclexplode(c.relacl) a join roles r on r.oid = a.grantee
         where c.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
        union all
        select r.rolname, 'column', n.nspname || '.' || c.relname || '.' || at.attname,
               a.privilege_type
          from pg_catalog.pg_attribute at
          join pg_catalog.pg_class c on c.oid = at.attrelid
          join ours n on n.oid = c.relnamespace,
               aclexplode(at.attacl) a join roles r on r.oid = a.grantee
         where at.attnum > 0 and not at.attisdropped
        union all
        select r.rolname, 'function', p.oid::regprocedure::text, a.privilege_type
          from pg_catalog.pg_proc p join ours n on n.oid = p.pronamespace,
               aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          join roles r on r.oid = a.grantee
        union all
        select r.rolname, 'schema', n.nspname, a.privilege_type
          from ours n join pg_catalog.pg_namespace n0 on n0.oid = n.oid,
               aclexplode(n0.nspacl) a join roles r on r.oid = a.grantee)
      select g || '|' || k || '|' || o || '|' || string_agg(p, ',' order by p) as line
        from t group by g, k, o order by 1`;
    const actual = rows.map((row) => row.line);
    const expected = [...EXPECTED_PRIVILEGES].sort();
    expect(actual.filter((line) => !expected.includes(line))).toEqual([]);
    expect(expected.filter((line) => !actual.includes(line))).toEqual([]);
  });

  it("grants TRUNCATE, REFERENCES, TRIGGER or MAINTAIN to no role of ours", () => {
    expect(
      EXPECTED_PRIVILEGES.filter((line) =>
        /TRUNCATE|REFERENCES|TRIGGER|MAINTAIN/.test(line),
      ),
    ).toEqual([]);
  });

  it("gives EXECUTE on audit.append() neither to influx_app nor to a business role (C(37))", () => {
    const appenders = EXPECTED_PRIVILEGES.filter((line) =>
      line.includes("|audit.append("),
    ).map((line) => line.split("|")[0]);
    // influx_maintenance_definer (0117): retention.purged, from E-4 functions only;
    // influx_leads_definer (0132): leads.replay_requested, from leads.replay_outbox_lines() only;
    // influx_privacy_definer (0137): the E-5 lines, from the privacy functions only
    expect(appenders.sort()).toEqual([
      "influx_audit_writer",
      "influx_identity_definer",
      "influx_leads_definer",
      "influx_maintenance_definer",
      "influx_privacy_definer",
    ]);
  });
});

describe("T2.8: no function is published by default", () => {
  it("grants EXECUTE to PUBLIC on no function of ours", async () => {
    const published = await migration<{ name: string }[]>`
      select p.oid::regprocedure::text as name
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace,
             aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where n.nspname = any (${OUR_SCHEMAS as unknown as string[]})
         and a.grantee = 0`;
    expect(published).toEqual([]);
  });

  it("leaves a new table, sequence and function of each schema without any public right", async () => {
    const leaks = await inRolledBackTransaction(migration, async (tx) => {
      for (const schema of OUR_SCHEMAS) {
        await tx.unsafe(`create table ${schema}.t2_witness (id int)`);
        await tx.unsafe(`create sequence ${schema}.t2_witness_seq`);
        await tx.unsafe(
          `create function ${schema}.t2_witness_fn() returns int language sql as 'select 1'`,
        );
      }
      return tx<{ leak: string }[]>`
        with grantees as (
          select 0::oid as oid, 'PUBLIC' as name
          union all
          select oid, rolname from pg_catalog.pg_roles
           where rolname = any (${DATA_API_ROLES as unknown as string[]}))
        select g.name || ' ' || a.privilege_type || ' ' || c.oid::regclass::text as leak
          from pg_catalog.pg_class c,
               aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
          join grantees g on g.oid = a.grantee
         where c.relname in ('t2_witness', 't2_witness_seq')
        union all
        select g.name || ' ' || a.privilege_type || ' ' || p.oid::regprocedure::text
          from pg_catalog.pg_proc p,
               aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
          join grantees g on g.oid = a.grantee
         where p.proname = 't2_witness_fn'`;
    });
    expect(leaks.map((row) => row.leak)).toEqual([]);
  });
});
