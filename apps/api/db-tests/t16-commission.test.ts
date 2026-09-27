// T16.3 to T16.5 — the commission rates table stays empty and unwritable, and no amount is a
// float (docs/mvp/18 T16; CLAUDE.md §3, transitional regime). T16.1, T16.2, T16.7: static, in
// packages/test-kit/tests/t16-static.test.ts.
import {
  inRolledBackTransaction,
  probe,
  TAKEN_ROLES,
  takeRole,
  type LoginRole,
  type TakenRole,
} from "@influx/test-kit/db";
import { EXPECTED_ROLES, OUR_SCHEMAS } from "@influx/test-kit/rights";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const TABLE = "billing.commission_rates";
const INSERT = `insert into ${TABLE} (scope, advertiser_rate_bp, creator_rate_bp, effective_from, created_by_account_id)
  values ('platform_default', 2000, 1500, now(), '00000000-0000-4000-8000-0000000004a0')`;

let migration: postgres.Sql;

beforeAll(async () => {
  migration = migrationRole();
  await testDataSet();
});

describe("T16.3: billing.commission_rates is empty", () => {
  it("holds no row after the reset and the data set", async () => {
    const [row] = await migration<{ count: number }[]>`
      select count(*)::int as count from billing.commission_rates`;
    expect(row?.count).toBe(0);
  });

  it("is named by no seed file", () => {
    const seed = path.join(ROOT, "supabase/seed");
    const files = existsSync(seed) ? readdirSync(seed) : [];
    expect(
      files.filter((file) =>
        readFileSync(path.join(seed, file), "utf8").includes(
          "commission_rates",
        ),
      ),
    ).toEqual([]);
  });
});

describe("T16.4: nobody can write it", () => {
  it("grants INSERT, UPDATE, DELETE or TRUNCATE to no role of the closed list, nor to PUBLIC or the Data API", async () => {
    const roles = [
      ...Object.keys(EXPECTED_ROLES),
      "public",
      "anon",
      "authenticated",
      "service_role",
    ];
    const rows = await migration<{ holder: string }[]>`
      select r.name || ' ' || p.privilege as holder
        from unnest(${roles}::text[]) as r(name),
             unnest(array['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) as p(privilege)
       where has_table_privilege(r.name, ${TABLE}, p.privilege)`;
    expect(rows).toEqual([]);
  });

  it.each([
    "influx_app",
    "influx_auth_login",
    "influx_worker_login",
  ] as LoginRole[])(
    "refuses an insertion by %s without a role taken",
    async (role) => {
      const result = await inRolledBackTransaction(loginRole(role), (tx) =>
        probe(tx, INSERT),
      );
      expect(result).toEqual({ outcome: "error", code: "42501" });
    },
  );

  it.each(Object.keys(TAKEN_ROLES) as TakenRole[])(
    "refuses an insertion by %s",
    async (role) => {
      const result = await inRolledBackTransaction(
        loginRole(TAKEN_ROLES[role]),
        async (tx) => {
          await takeRole(tx, role);
          return probe(tx, INSERT);
        },
      );
      expect(result).toEqual({ outcome: "error", code: "42501" });
    },
  );
});

/**
 * T16.5 findings: float or money columns, amount columns that are not a bigint, and tables with an
 * amount column but no currency column (`currency`, or `<prefix>_currency` such as
 * `product_value_currency`, 04 §2 conventions; testeur Q3, end of J2).
 */
async function amountFindings(
  sql: postgres.Sql | postgres.TransactionSql,
): Promise<string[]> {
  const rows = await sql<{ problem: string }[]>`
    with amounts as (
      select table_schema, table_name, column_name, data_type
        from information_schema.columns
       where table_schema = any (${OUR_SCHEMAS as unknown as string[]})
         and column_name ~ '(^|_)(amount|montant)(_|$)'
    )
    select table_schema || '.' || table_name || '.' || column_name || ' ' || data_type as problem
      from information_schema.columns
     where table_schema = any (${OUR_SCHEMAS as unknown as string[]})
       and data_type in ('real', 'double precision', 'money')
    union
    select table_schema || '.' || table_name || '.' || column_name || ' ' || data_type
      from amounts
     where data_type <> 'bigint'
    union
    select a.table_schema || '.' || a.table_name || ' has an amount column but no currency column'
      from amounts a
     where not exists (
             select 1 from information_schema.columns c
              where c.table_schema = a.table_schema
                and c.table_name = a.table_name
                and c.column_name ~ '(^|_)currency$')
     order by 1`;
  return rows.map((row) => row.problem);
}

describe("T16.5: no amount stored as a float, and none without its currency", () => {
  it("has no float or money column; every amount column is a bigint beside a currency column", async () => {
    expect(await amountFindings(migration)).toEqual([]);
  });

  it("detects each infraction on witness tables, created then rolled back", async () => {
    const findings = await inRolledBackTransaction(migration, async (tx) => {
      await tx`create table billing.t16_witness_float (fee double precision)`;
      await tx`create table billing.t16_witness_no_currency (fee_amount_minor bigint)`;
      await tx`create table billing.t16_witness_numeric (amount numeric, currency char(3))`;
      await tx`create table billing.t16_witness_ok
                 (fee_amount_minor bigint, product_value_currency char(3))`;
      return amountFindings(tx);
    });
    expect(findings).toEqual([
      "billing.t16_witness_float.fee double precision",
      "billing.t16_witness_no_currency has an amount column but no currency column",
      "billing.t16_witness_numeric.amount numeric",
    ]);
  });
});
