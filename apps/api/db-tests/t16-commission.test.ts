// T16.3 to T16.5 — the commission rates table stays empty and unwritable, and no amount is a
// float (docs/mvp/18 T16; CLAUDE.md §3, transitional regime); T16.4 and T16.5 also cover
// reference.price_bands (04 §4.2, 0201; grid of 0304). T16.1, T16.2, T16.7: static, in
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

const PRICE_BANDS = "reference.price_bands";
const PRICE_BANDS_INSERT = `insert into ${PRICE_BANDS} (currency, code, label_key, min_amount_minor)
  values ('EUR', 't16_witness', 'price_band.t16_witness', 0)`;

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

/** T16.4 for one table: no write right anywhere, and every insertion refused. */
function nobodyWrites(table: string, insert: string): void {
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
       where has_table_privilege(r.name, ${table}, p.privilege)`;
    expect(rows).toEqual([]);
  });

  it.each([
    "influx_app",
    "influx_auth_login",
    "influx_worker_login",
    "influx_ops_login",
  ] as LoginRole[])(
    "refuses an insertion by %s without a role taken",
    async (role) => {
      const result = await inRolledBackTransaction(loginRole(role), (tx) =>
        probe(tx, insert),
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
          return probe(tx, insert);
        },
      );
      expect(result).toEqual({ outcome: "error", code: "42501" });
    },
  );
}

describe("T16.4: nobody can write it", () => {
  nobodyWrites(TABLE, INSERT);
});

// 04 §4.2: the price bands, and their net bounds, are data written by a reviewed migration only,
// under the same regime as the rates. 0304 (L3B) loads the grid validated by the founder
// (jalons/l3b/tranches.md §5), bounds written literally, no net.
const GRID_CURRENCIES = ["CAD", "CHF", "EUR", "GBP", "USD"];
const GRID_BANDS = [
  "under_100 0-10000",
  "100_250 10000-25000",
  "250_500 25000-50000",
  "500_1000 50000-100000",
  "1000_2500 100000-250000",
  "2500_5000 250000-500000",
  "5000_10000 500000-1000000",
  "10000_25000 1000000-2500000",
  "25000_50000 2500000-5000000",
  "50000_plus 5000000-null",
];

describe("T16.4 extended to reference.price_bands (04 §4.2)", () => {
  it("L3B-T4: holds exactly the grid of 0304 (tranches.md §5), and no net", async () => {
    const rows = await migration<{ line: string }[]>`
      select currency || ' ' || code || ' ' || min_amount_minor || '-'
             || coalesce(max_amount_minor::text, 'null') as line
        from reference.price_bands
       where num_nulls(net_min_amount_minor, net_max_amount_minor, net_basis_label,
                       net_computed_at) = 4
       order by currency, min_amount_minor`;
    expect(rows.map((row) => row.line)).toEqual(
      GRID_CURRENCIES.flatMap((currency) =>
        GRID_BANDS.map((band) => `${currency} ${band}`),
      ),
    );
  });

  it("is named by no seed file", () => {
    const seed = path.join(ROOT, "supabase/seed");
    const files = existsSync(seed) ? readdirSync(seed) : [];
    expect(
      files.filter((file) =>
        readFileSync(path.join(seed, file), "utf8").includes("price_bands"),
      ),
    ).toEqual([]);
  });

  nobodyWrites(PRICE_BANDS, PRICE_BANDS_INSERT);
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

  it("sees the four amount columns of reference.price_bands, all bigint beside its currency", async () => {
    const rows = await migration<{ column: string }[]>`
      select column_name || ' ' || data_type as column
        from information_schema.columns
       where table_schema = 'reference' and table_name = 'price_bands'
         and (column_name ~ '(^|_)(amount|montant)(_|$)' or column_name = 'currency')
       order by column_name`;
    expect(rows.map((row) => row.column)).toEqual([
      "currency character",
      "max_amount_minor bigint",
      "min_amount_minor bigint",
      "net_max_amount_minor bigint",
      "net_min_amount_minor bigint",
    ]);
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

// T16-L2D (jalons/l2d commit 11; D78, D48, EC-L2D-2): no creator price is stored. The two tables of
// 04 (rate cards, public rates) are not created, the net bounds of the price bands stay empty and
// the commission rates stay empty; no column of a creator table is named after a price word.
const PRICE_WORDS = ["price", "rate", "net", "currency", "amount"];

/** Tables the creator profile must not have, wherever they would be created. */
async function absentTables(
  sql: postgres.Sql | postgres.TransactionSql,
): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select table_schema || '.' || table_name as name
      from information_schema.tables
     where table_name in ('creator_rate_cards', 'creator_public_rates')
     order by 1`;
  return rows.map((row) => row.name);
}

/** Columns of a `creator_%` table whose whole name is a price word. */
async function priceColumns(
  sql: postgres.Sql | postgres.TransactionSql,
): Promise<string[]> {
  const rows = await sql<{ name: string }[]>`
    select table_schema || '.' || table_name || '.' || column_name as name
      from information_schema.columns
     where table_schema = any (${OUR_SCHEMAS as unknown as string[]})
       and table_name like 'creator\_%'
       and column_name = any (${PRICE_WORDS})
     order by 1`;
  return rows.map((row) => row.name);
}

describe("T16-L2D: no creator price, no net, no rate stored", () => {
  it("has neither creator_rate_cards nor creator_public_rates, in any schema", async () => {
    expect(await absentTables(migration)).toEqual([]);
  });

  it("holds no net bound in reference.price_bands, and no row in billing.commission_rates", async () => {
    const [bands] = await migration<{ count: number }[]>`
      select count(*)::int as count from reference.price_bands
       where net_min_amount_minor is not null or net_max_amount_minor is not null
          or net_basis_label is not null or net_computed_at is not null`;
    expect(bands?.count).toBe(0);
    const [rates] = await migration<{ count: number }[]>`
      select count(*)::int as count from billing.commission_rates`;
    expect(rates?.count).toBe(0);
  });

  it("names no column of a creator table price, rate, net, currency or amount", async () => {
    expect(await priceColumns(migration)).toEqual([]);
  });

  it("sees a rate table and a price column when one is created, then rolled back", async () => {
    const found = await inRolledBackTransaction(migration, async (tx) => {
      await tx`create table profiles.creator_rate_cards (account_id uuid, price bigint)`;
      await tx`create table profiles.creator_public_rates (account_id uuid, rate smallint)`;
      return {
        tables: await absentTables(tx),
        columns: await priceColumns(tx),
      };
    });
    expect(found.tables).toEqual([
      "profiles.creator_public_rates",
      "profiles.creator_rate_cards",
    ]);
    expect(found.columns).toEqual([
      "profiles.creator_public_rates.rate",
      "profiles.creator_rate_cards.price",
    ]);
  });
});
