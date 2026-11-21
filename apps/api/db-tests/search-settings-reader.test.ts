// L3G commit 08b — L3G-T9: the reader of the search settings, 0333 (jalons/l3g/08b.md; l3g-fiche.md
// invariants 3, 12, 15; jalons/l3g/modele.md §7; 03 P7; 04 §5.5). search.read_search_settings() serves
// (key, value) of the ten keys to an active admin in aal2 and to nobody else (42501), writes nothing,
// and gives influx_admin no right on search.search_settings: who and when stay in audit.*
// (EC-L3G-08b-1). Each case runs in a rolled-back transaction of the local superuser, the reader
// called as apps/api calls it (influx_app, then the role and the context of the caller).
import { SEARCH_SETTING_KEYS } from "@influx/contracts/search-settings";
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const INSUFFICIENT_PRIVILEGE = "42501";
const READER = "search.read_search_settings()";

const adminA = accountIdOf("admin", "a");
const agentA = accountIdOf("agent", "a");
const brandA = accountIdOf("advertiser", "a");
const creatorA = accountIdOf("creator", "a");

type SettingRow = { key: string; value: unknown };

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

beforeAll(async () => {
  await testDataSet();
});

/** The reader as the admin, in aal2 by default. */
function readAsAdmin(
  tx: Tx,
  aal: "aal1" | "aal2" = "aal2",
): Promise<Record<string, unknown>[]> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: adminA, role: "admin", aal },
    () =>
      tx<
        Record<string, unknown>[]
      >`select * from search.read_search_settings()`,
  );
}

/** The SQLSTATE of a refused call, or "ok". */
async function attempt(tx: Tx, call: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => {
      await call();
    });
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

describe("L3G-T9 the reader of the search settings (modele §7; 08b.md)", () => {
  it("L3G-T9 serves an admin in aal2 the ten keys and their values, (key, value) only, ordered by key", async () => {
    const outcome = await scenario(async (tx) => {
      const table = await tx<SettingRow[]>`
        select key, value from search.search_settings order by key`;
      const served = await readAsAdmin(tx);
      return { table, served };
    });
    expect(outcome.served.length).toBe(10);
    expect(outcome.served.map((row) => Object.keys(row).sort())).toEqual(
      outcome.served.map(() => ["key", "value"]),
    );
    expect(outcome.served.map((row) => row.key)).toEqual(
      [...SEARCH_SETTING_KEYS].sort(),
    );
    expect(outcome.served).toEqual(outcome.table);
  });

  it("L3G-T9 serves the value in force: a value changed in the transaction is read as it stands", async () => {
    const served = await scenario(async (tx) => {
      await tx`update search.search_settings set value = '7'::jsonb
                where key = 'k_anonymity_threshold'`;
      await tx`update search.search_settings
                  set value = '{"publishedProfiles": 40, "perTopic": 6}'::jsonb
                where key = 'critical_mass_thresholds'`;
      return readAsAdmin(tx);
    });
    const byKey = Object.fromEntries(served.map((row) => [row.key, row.value]));
    expect(byKey.k_anonymity_threshold).toBe(7);
    expect(byKey.critical_mass_thresholds).toEqual({
      publishedProfiles: 40,
      perTopic: 6,
    });
  });

  it("L3G-T9 refuses the agent, the brand and the creator with 42501", async () => {
    const codes = await scenario(async (tx) => {
      const read = () => tx`select * from search.read_search_settings()`;
      return {
        agent: await attempt(tx, () =>
          actAsInternal(
            tx,
            "influx_agent",
            { accountId: agentA, role: "agent", aal: "aal2" },
            read,
          ),
        ),
        brand: await attempt(tx, () =>
          actAsMember(
            tx,
            "influx_advertiser",
            { accountId: brandA, role: "advertiser", aal: "aal1" },
            read,
          ),
        ),
        creator: await attempt(tx, () =>
          actAsMember(
            tx,
            "influx_creator",
            { accountId: creatorA, role: "creator", aal: "aal1" },
            read,
          ),
        ),
      };
    });
    expect(codes).toEqual({
      agent: INSUFFICIENT_PRIVILEGE,
      brand: INSUFFICIENT_PRIVILEGE,
      creator: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("L3G-T9 refuses an admin without a second factor (aal1) and an admin whose account is suspended", async () => {
    const codes = await scenario(async (tx) => {
      const aal1 = await attempt(tx, () => readAsAdmin(tx, "aal1"));
      await tx`update identity.accounts set status = 'suspended', suspended_at = now()
                where id = ${adminA}`;
      const suspended = await attempt(tx, () => readAsAdmin(tx));
      return { aal1, suspended };
    });
    expect(codes).toEqual({
      aal1: INSUFFICIENT_PRIVILEGE,
      suspended: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("L3G-T9 gives influx_admin, nor any execution role, no right of table nor of column on search_settings; its owner keeps SELECT (key, value) alone", async () => {
    const rows = await scenario(
      (tx) => tx<{ role: string; table: boolean; column: boolean }[]>`
        select r as role,
               has_table_privilege(r, 'search.search_settings',
                                   'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                 as table,
               has_any_column_privilege(r, 'search.search_settings',
                                        'SELECT, INSERT, UPDATE, REFERENCES') as column
          from unnest(array['influx_admin', 'influx_agent', 'influx_advertiser', 'influx_creator',
                            'anon', 'authenticated']) r
         order by r`,
    );
    expect(rows.filter((row) => row.table || row.column)).toEqual([]);
    const owner = await scenario(
      (tx) => tx<{ column: string }[]>`
        select a.attname::text as column
          from pg_catalog.pg_attribute a
         where a.attrelid = 'search.search_settings'::regclass
           and a.attnum > 0 and not a.attisdropped
           and has_column_privilege('influx_search_admin_definer', a.attrelid, a.attnum, 'SELECT')
         order by 1`,
    );
    expect(owner.map((row) => row.column)).toEqual(["key", "value"]);
  });

  it("L3G-T9 modifies nothing: the settings, their authors and dates, and the journal stay as they were", async () => {
    const outcome = await scenario(async (tx) => {
      const state = () => tx<
        {
          key: string;
          value: unknown;
          updated_at: Date;
          author: string | null;
        }[]
      >`
        select key, value, updated_at, updated_by_account_id::text as author
          from search.search_settings order by key`;
      const journal = async () => {
        const [row] = await tx<{ n: number }[]>`
          select count(*)::int as n from audit.audit_events`;
        return row?.n;
      };
      const before = { settings: await state(), journal: await journal() };
      await readAsAdmin(tx);
      await readAsAdmin(tx);
      const after = { settings: await state(), journal: await journal() };
      return { before, after };
    });
    expect(outcome.after).toEqual(outcome.before);
  });

  it("L3G-T9 in the catalogue: owned by influx_search_admin_definer, SECURITY DEFINER, STABLE, empty search_path, gated by require_search_admin(), TABLE(key, value), executed by influx_admin alone", async () => {
    const [row] = await scenario(
      (tx) => tx<
        {
          owner: string;
          definer: boolean;
          volatility: string;
          config: string[];
          result: string;
          gated: boolean;
          callers: string[];
        }[]
      >`
        select pg_catalog.pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
               p.provolatile::text as volatility, p.proconfig as config,
               pg_catalog.pg_get_function_result(p.oid) as result,
               p.prosrc like '%search.require_search_admin()%' as gated,
               array(select case when a.grantee = 0 then 'PUBLIC' else a.grantee::regrole::text end
                       from pg_catalog.aclexplode(p.proacl) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers
          from pg_catalog.pg_proc p
         where p.oid = ${READER}::regprocedure`,
    );
    expect(row).toEqual({
      owner: "influx_search_admin_definer",
      definer: true,
      volatility: "s",
      config: ['search_path=""'],
      result: "TABLE(key text, value jsonb)",
      gated: true,
      callers: ["influx_admin"],
    });
  });
});
