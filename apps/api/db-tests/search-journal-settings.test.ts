// L3E commit 03 — the journal of the creator search, its settings and the facet versions, 0316
// (jalons/l3e/03.md; l3e-fiche.md invariants 1, 8, 9, 11, 15, 16; jalons/l3e/modele.md §4, §7, §9;
// 04 §5.5; 10 RG2, RG11 to RG14, RG41, RG57, RG59, RG63, RG66, RG88). L3E-T3: the rights of the new
// objects (T2: no execution role, no member, a restrictive policy on each table), the journal
// append-only outside the erasure and the opening of an impression, reason_params without any
// number, the closed keys and their shapes (the zod schemas agree with the CHECK), the writers of an
// administrator alone with search.settings_changed chained, a version for every facet change, the
// search closed by default, the base of 7 facets open and F12 closed. Each case runs in a
// rolled-back transaction of the local superuser, the writers called as apps/api calls them.
import {
  RESULT_COUNT_BANDS,
  SEARCH_FACET_WAVES,
  SEARCH_SETTING_KEYS,
  searchFacetSettingSchema,
  searchSettingValueSchemas,
  type SearchSettingKey,
} from "@influx/contracts/search-settings";
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { searchColumns } from "../src/db/schema/introspection.ts";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

const brandA = accountIdOf("advertiser", "a");
const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const agentA = accountIdOf("agent", "a");
const adminA = accountIdOf("admin", "a");

/** The eleven tables of 0316. */
const TABLES = [
  "search.explanation_reasons",
  "search.facet_settings",
  "search.search_settings",
  "search.facet_config_versions",
  "search.search_queries",
  "search.search_impressions",
  "search.impression_reasons",
  "search.creator_exposures",
  "search.shortlists",
  "search.shortlist_items",
  "search.supply_counters",
] as const;

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | { outcome: "error"; code: string; detail: string | undefined };
type Parameter = postgres.ParameterOrJSON<never> | null | undefined;

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE and detail. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as T[] };
  } catch (error) {
    const found = error as { code?: string; detail?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      detail: found.detail,
    };
  }
}

function codeOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error" ? outcome.code : "ok";
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function asAdmin<T>(
  tx: Tx,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: adminA, role: "admin", aal },
    fn,
  );
}

const WRITE_SETTING =
  "select search.write_search_setting($1::text, $2::text::jsonb)::int as version";
const WRITE_FACET =
  "select search.write_facet_setting($1::text, $2::boolean, $3::integer, $4::text)::int as version";

type Line = {
  seq: string;
  actor_type: string;
  actor: string | null;
  subject_id: string;
  payload: Record<string, unknown>;
  chained: boolean;
};

/** The search.settings_changed lines written since `after`, each with its link to its predecessor. */
async function settingsLines(tx: Tx, after: string): Promise<Line[]> {
  return tx<Line[]>`
    select e.seq::text as seq, e.actor_type::text as actor_type,
           e.actor_account_id::text as actor, e.subject_id::text as subject_id, e.payload,
           e.prev_hash = (select p.row_hash from audit.audit_events p
                           where p.chain_key = e.chain_key and p.seq = e.seq - 1) as chained
      from audit.audit_events e
     where e.event_type = 'search.settings_changed' and e.seq > ${after}::bigint
     order by e.seq`;
}

async function lastSeq(tx: Tx): Promise<string> {
  const [row] = await tx<{ seq: string }[]>`
    select coalesce(max(seq), 0)::text as seq from audit.audit_events`;
  return row?.seq ?? "0";
}

async function latestVersion(tx: Tx): Promise<number> {
  const [row] = await tx<{ version: number }[]>`
    select max(version)::int as version from search.facet_config_versions`;
  return row?.version ?? 0;
}

/** A served search of advertiser A and one impression of `creator`, written by the superuser. */
async function servedSearch(
  tx: Tx,
  creator: string = creatorA,
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into search.search_queries
      (id, account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
       result_count, page_reached)
    values (${id}, ${brandA}, 'advertiser', 'advertiser_anonymous', 'served', '{}'::jsonb, 'default',
            (select max(version) from search.facet_config_versions), 7, 1)`;
  await tx`
    insert into search.search_impressions (search_query_id, creator_account_id, rank)
    values (${id}, ${creator}, 1)`;
  return id;
}

beforeAll(async () => {
  await testDataSet();
});

describe("L3E-T3 the rights of the new objects (T2; fiche invariants 1, 15)", () => {
  it("L3E-T3 forces RLS and a restrictive member policy on the eleven tables, and gives no execution role nor Data API role any right on a table of search", async () => {
    const outcome = await scenario(async (tx) => {
      const tables = await tx<
        { name: string; forced: boolean; member_policy: boolean }[]
      >`
        select c.oid::regclass::text as name,
               c.relrowsecurity and c.relforcerowsecurity as forced,
               exists (select 1 from pg_catalog.pg_policy p
                        where p.polrelid = c.oid and not p.polpermissive
                          and p.polname = c.relname || '_no_member_access'
                          and p.polroles @> array['influx_advertiser'::regrole::oid,
                                                  'influx_creator'::regrole::oid]
                          and pg_catalog.pg_get_expr(p.polqual, p.polrelid) = 'false') as member_policy
          from pg_catalog.pg_class c
         where c.oid = any (${[...TABLES]}::regclass[])
         order by 1`;
      const rights = await tx<{ line: string }[]>`
        select r.rolname || ' ' || c.oid::regclass::text as line
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace,
               pg_catalog.pg_roles r
         where n.nspname = 'search' and c.relkind in ('r', 'p', 'v', 'm')
           and r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                             'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                             'influx_privacy', 'anon', 'authenticated', 'service_role')
           and (has_table_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_any_column_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE'))`;
      return { tables, rights };
    });
    expect(outcome.tables).toHaveLength(TABLES.length);
    expect(
      outcome.tables.filter((table) => !table.forced || !table.member_policy),
    ).toEqual([]);
    expect(outcome.rights).toEqual([]);
  });

  it("L3E-T3 makes influx_search_admin_definer NOLOGIN NOINHERIT without member, owner of two SECURITY DEFINER writers executable by influx_admin alone; the members and the agent execute nothing of search beyond their doors", async () => {
    const outcome = await scenario(async (tx) => {
      const [role] = await tx<Record<string, unknown>[]>`
        select rolcanlogin, rolinherit, rolbypassrls, rolsuper,
               (select count(*)::int from pg_catalog.pg_auth_members m
                 where m.roleid = r.oid and (m.inherit_option or m.set_option)) as members
          from pg_catalog.pg_roles r where rolname = 'influx_search_admin_definer'`;
      const writers = await tx<
        {
          name: string;
          owner: string;
          definer: boolean;
          config: string[];
          callers: string[];
        }[]
      >`
        select p.oid::regprocedure::text as name, pg_catalog.pg_get_userbyid(p.proowner) as owner,
               p.prosecdef as definer, p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(p.proacl) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers
          from pg_catalog.pg_proc p
         where p.oid in ('search.write_search_setting(text, jsonb)'::regprocedure,
                         'search.write_facet_setting(text, boolean, integer, text)'::regprocedure)
         order by 1`;
      const executed = await tx<{ role: string; name: string }[]>`
        select r as role, p.oid::regprocedure::text as name
          from pg_catalog.pg_proc p,
               unnest(array['influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin']) r
         where p.pronamespace = 'search'::regnamespace
           and has_function_privilege(r, p.oid, 'EXECUTE')
         order by r, p.oid::regprocedure::text collate "C"`;
      return { role, writers, executed };
    });
    expect(outcome.role).toEqual({
      rolcanlogin: false,
      rolinherit: false,
      rolbypassrls: false,
      rolsuper: false,
      members: 0,
    });
    expect(outcome.writers).toEqual([
      {
        name: "search.write_facet_setting(text,boolean,integer,text)",
        owner: "influx_search_admin_definer",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_admin"],
      },
      {
        name: "search.write_search_setting(text,jsonb)",
        owner: "influx_search_admin_definer",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_admin"],
      },
    ]);
    expect(outcome.executed).toEqual([
      // 0321 (L3E-10): AL21, the volume alert read by the admins, beside the two writers
      {
        role: "influx_admin",
        name: "search.creator_search_volume_alerts()",
      },
      {
        role: "influx_admin",
        name: "search.write_facet_setting(text,boolean,integer,text)",
      },
      { role: "influx_admin", name: "search.write_search_setting(text,jsonb)" },
      // 0319 (L3E-06, EC-L3E-06-11): the brand's door of the creator search, its one function
      {
        role: "influx_advertiser",
        name: "search.search_creators(jsonb,text,integer,uuid)",
      },
      { role: "influx_creator", name: "search.read_open_campaign(uuid)" },
      {
        role: "influx_creator",
        name: "search.read_open_campaign_brand_logo(uuid)",
      },
      {
        role: "influx_creator",
        name: "search.read_open_campaigns(text,integer)",
      },
    ]);
  });

  it("L3E-T3 refuses the journal, the shortlists and the settings to a brand and to a creator in their own context", async () => {
    const outcome = await scenario(async (tx) => {
      const codes: Record<string, string> = {};
      for (const table of TABLES) {
        codes[`brand ${table}`] = await actAsMember(
          tx,
          "influx_advertiser",
          { accountId: brandA, role: "advertiser", aal: "aal1" },
          async () => codeOf(await run(tx, `select count(*) from ${table}`)),
        );
        codes[`creator ${table}`] = await actAsMember(
          tx,
          "influx_creator",
          { accountId: creatorA, role: "creator", aal: "aal1" },
          async () => codeOf(await run(tx, `select count(*) from ${table}`)),
        );
      }
      return codes;
    });
    expect(
      Object.entries(outcome).filter(
        ([, code]) => code !== INSUFFICIENT_PRIVILEGE,
      ),
    ).toEqual([]);
  });
});

describe("L3E-T3 the settings as data (fiche invariant 11; 10 RG2, RG11 to RG14)", () => {
  it("L3E-T3 loads the eight keys with the values of modele §9, the search closed, no alert_thresholds, version 1 as the snapshot of the loaded state", async () => {
    const outcome = await scenario(async (tx) => {
      const settings = await tx<{ key: string; value: unknown }[]>`
        select key, value from search.search_settings order by key`;
      const [version] = await tx<
        { version: number; same: boolean; author: string | null }[]
      >`
        select version::int as version, snapshot = search.facet_config_snapshot() as same,
               changed_by_account_id::text as author
          from search.facet_config_versions order by version limit 1`;
      const alert = codeOf(
        await run(
          tx,
          "insert into search.search_settings (key, value) values ('alert_thresholds', '{}')",
        ),
      );
      return { settings, version, alert };
    });
    expect(
      Object.fromEntries(outcome.settings.map((s) => [s.key, s.value])),
    ).toEqual({
      is_open_to_advertisers: false,
      k_anonymity_threshold: 5,
      page_size: 12,
      max_pages: 5,
      rate_limits: { perHour: 30, perDay: 200, profileOpensPerDay: 60 },
      cold_profile_quota: { slots: 2, recentDays: 30 },
      critical_mass_thresholds: { publishedProfiles: 30, perTopic: 5 },
      region_display_threshold: 5,
    });
    expect([...SEARCH_SETTING_KEYS].sort()).toEqual(
      outcome.settings.map((s) => s.key),
    );
    expect(outcome.version).toEqual({ version: 1, same: true, author: null });
    expect(outcome.alert).toBe(CHECK_VIOLATION);
  });

  it("L3E-T3 checks each value in base exactly as its zod schema does (EC-L3E-03-1)", async () => {
    const candidates: [SearchSettingKey, unknown][] = [
      ["is_open_to_advertisers", true],
      ["is_open_to_advertisers", "true"],
      ["k_anonymity_threshold", 4],
      ["k_anonymity_threshold", 50],
      ["k_anonymity_threshold", 51],
      ["k_anonymity_threshold", 7.5],
      ["page_size", 0],
      ["page_size", 50],
      ["max_pages", 51],
      ["rate_limits", { perHour: 30, perDay: 200, profileOpensPerDay: 60 }],
      ["rate_limits", { perHour: 300, perDay: 200, profileOpensPerDay: 60 }],
      ["rate_limits", { perHour: 30, perDay: 200 }],
      [
        "rate_limits",
        { perHour: 30, perDay: 200, profileOpensPerDay: 60, x: 1 },
      ],
      ["rate_limits", { perHour: "30", perDay: 200, profileOpensPerDay: 60 }],
      ["cold_profile_quota", { slots: 0, recentDays: 365 }],
      ["cold_profile_quota", { slots: -1, recentDays: 30 }],
      ["cold_profile_quota", { slots: 2, recentDays: 366 }],
      ["critical_mass_thresholds", { publishedProfiles: 0, perTopic: 5 }],
      ["critical_mass_thresholds", { publishedProfiles: 100000, perTopic: 1 }],
      ["region_display_threshold", 4],
      ["region_display_threshold", 5],
    ];
    const base = await scenario(async (tx) => {
      const accepted: boolean[] = [];
      for (const [key, value] of candidates) {
        const result = await run(
          tx,
          "update search.search_settings set value = $2::text::jsonb where key = $1",
          [key, JSON.stringify(value)],
        );
        accepted.push(result.outcome === "rows");
      }
      return accepted;
    });
    const zod = candidates.map(
      ([key, value]) => searchSettingValueSchemas[key].safeParse(value).success,
    );
    expect(base).toEqual(zod);
    // the witness: both accept and refuse something
    expect(zod).toContain(true);
    expect(zod).toContain(false);
  });

  it("L3E-T3 loads the 24 facets in their wave, the base open but F12, and refuses in base an open facet outside the base and an open F12 (D78)", async () => {
    const outcome = await scenario(async (tx) => {
      const facets = await tx<{ code: string; wave: number; open: boolean }[]>`
        select facet_code as code, wave::int as wave, is_open as open
          from search.facet_settings order by display_order`;
      return {
        facets,
        secondWave: codeOf(
          await run(
            tx,
            "update search.facet_settings set is_open = true where facet_code = 'F2'",
          ),
        ),
        price: codeOf(
          await run(
            tx,
            "update search.facet_settings set is_open = true where facet_code = 'F12'",
          ),
        ),
        wrongWave: codeOf(
          await run(
            tx,
            "update search.facet_settings set wave = 2 where facet_code = 'F1'",
          ),
        ),
      };
    });
    expect(
      Object.fromEntries(outcome.facets.map((f) => [f.code, f.wave])),
    ).toEqual(SEARCH_FACET_WAVES);
    expect(outcome.facets.filter((f) => f.open).map((f) => f.code)).toEqual([
      "F1",
      "F3",
      "F4",
      "F6",
      "F8",
      "F11",
      "F17",
    ]);
    expect(outcome).toMatchObject({
      secondWave: CHECK_VIOLATION,
      price: CHECK_VIOLATION,
      wrongWave: CHECK_VIOLATION,
    });
    // the contract refuses what the base refuses
    expect(
      searchFacetSettingSchema.safeParse({
        code: "F12",
        isOpen: true,
        facetOrder: 7,
        note: null,
      }).success,
    ).toBe(false);
  });
});

describe("L3E-T3 the writers of an administrator (fiche invariant 11; 10 RG11, RG88)", () => {
  it("L3E-T3 writes a setting as an admin in aal2, journals search.settings_changed chained with before and after, and opens a version for k", async () => {
    const outcome = await scenario(async (tx) => {
      const since = await lastSeq(tx);
      const before = await latestVersion(tx);
      const open = await asAdmin(tx, () =>
        run<{ version: number }>(tx, WRITE_SETTING, [
          "is_open_to_advertisers",
          "true",
        ]),
      );
      const afterOpen = await latestVersion(tx);
      const k = await asAdmin(tx, () =>
        run<{ version: number }>(tx, WRITE_SETTING, [
          "k_anonymity_threshold",
          "7",
        ]),
      );
      const [row] = await tx<{ value: unknown; author: string }[]>`
        select value, updated_by_account_id::text as author
          from search.search_settings where key = 'is_open_to_advertisers'`;
      // identity values are not rolled back: the version is read, never computed
      const [version] = await tx<
        { version: number; k: unknown; author: string }[]
      >`
        select version::int as version, snapshot -> 'k_anonymity_threshold' as k,
               changed_by_account_id::text as author
          from search.facet_config_versions order by version desc limit 1`;
      const [subject] = await tx<{ id: string }[]>`
        select md5('search.search_settings:is_open_to_advertisers')::uuid::text as id`;
      return {
        before,
        afterOpen,
        open,
        k,
        row,
        version,
        subject: subject?.id,
        lines: await settingsLines(tx, since),
      };
    });
    expect(outcome.afterOpen).toBe(outcome.before);
    expect(outcome.open).toEqual({
      outcome: "rows",
      rows: [{ version: outcome.before }],
    });
    expect(outcome.version?.version).toBeGreaterThan(outcome.before);
    expect(outcome.k).toEqual({
      outcome: "rows",
      rows: [{ version: outcome.version?.version }],
    });
    expect(outcome.row).toEqual({ value: true, author: adminA });
    expect(outcome.version).toMatchObject({ k: 7, author: adminA });
    expect(outcome.lines).toHaveLength(2);
    expect(outcome.lines[0]).toMatchObject({
      actor_type: "admin",
      actor: adminA,
      subject_id: outcome.subject,
      chained: true,
      payload: {
        table: "search_settings",
        key: "is_open_to_advertisers",
        before: false,
        after: true,
        facet_config_version: outcome.before,
      },
    });
    expect(outcome.lines[1]).toMatchObject({
      chained: true,
      payload: { key: "k_anonymity_threshold", before: 5, after: 7 },
    });
  });

  it("L3E-T3 writes nothing for an unchanged value, refuses an unknown key and a refused shape (22023), and refuses the agent, the brand and an admin in aal1 (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      const since = await lastSeq(tx);
      const unchanged = await asAdmin(tx, () =>
        run(tx, WRITE_SETTING, ["page_size", "12"]),
      );
      const unknown = await asAdmin(tx, () =>
        run(tx, WRITE_SETTING, ["alert_thresholds", "{}"]),
      );
      const shape = await asAdmin(tx, () =>
        run(tx, WRITE_SETTING, ["k_anonymity_threshold", "4"]),
      );
      const aal1 = await asAdmin(
        tx,
        () => run(tx, WRITE_SETTING, ["page_size", "10"]),
        "aal1",
      );
      const agent = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal2" },
        () => run(tx, WRITE_SETTING, ["page_size", "10"]),
      );
      const brand = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        () => run(tx, WRITE_FACET, ["F17", false, 8, null]),
      );
      const [row] = await tx<{ author: string | null }[]>`
        select updated_by_account_id::text as author
          from search.search_settings where key = 'page_size'`;
      return {
        unchanged: codeOf(unchanged),
        unknown,
        shape,
        aal1: codeOf(aal1),
        agent: codeOf(agent),
        brand: codeOf(brand),
        author: row?.author ?? null,
        lines: await settingsLines(tx, since),
      };
    });
    expect(outcome).toMatchObject({
      unchanged: "ok",
      unknown: { outcome: "error", code: INVALID_PARAMETER, detail: "key" },
      shape: { outcome: "error", code: INVALID_PARAMETER, detail: "value" },
      aal1: INSUFFICIENT_PRIVILEGE,
      agent: INSUFFICIENT_PRIVILEGE,
      brand: INSUFFICIENT_PRIVILEGE,
      author: null,
      lines: [],
    });
  });

  it("L3E-T3 inserts a version with its note at every facet change, journals it, and refuses an unknown code and a facet that may not open", async () => {
    const outcome = await scenario(async (tx) => {
      const since = await lastSeq(tx);
      const before = await latestVersion(tx);
      const close = await asAdmin(tx, () =>
        run<{ version: number }>(tx, WRITE_FACET, [
          "F17",
          false,
          8,
          "  pilot check  ",
        ]),
      );
      const reorder = await asAdmin(tx, () =>
        run<{ version: number }>(tx, WRITE_FACET, ["F17", false, 3, null]),
      );
      const unchanged = await asAdmin(tx, () =>
        run<{ version: number }>(tx, WRITE_FACET, ["F17", false, 3, "again"]),
      );
      const secondWave = await asAdmin(tx, () =>
        run(tx, WRITE_FACET, ["F2", true, 9, null]),
      );
      const price = await asAdmin(tx, () =>
        run(tx, WRITE_FACET, ["F12", true, 7, null]),
      );
      const unknown = await asAdmin(tx, () =>
        run(tx, WRITE_FACET, ["F21", false, 9, null]),
      );
      const versions = await tx<
        { version: number; note: string | null; f17: unknown; author: string }[]
      >`
        select version::int as version, note,
               (select f from jsonb_array_elements(snapshot -> 'facets') f
                 where f ->> 'code' = 'F17') as f17,
               changed_by_account_id::text as author
          from search.facet_config_versions
         where version > ${before} order by version`;
      return {
        before,
        close,
        reorder,
        unchanged,
        secondWave,
        price,
        unknown,
        versions,
        lines: await settingsLines(tx, since),
      };
    });
    // identity values are not rolled back: the two versions are read, then held in order
    const first = outcome.versions[0]?.version ?? 0;
    const second = outcome.versions[1]?.version ?? 0;
    expect(first).toBeGreaterThan(outcome.before);
    expect(second).toBeGreaterThan(first);
    expect(outcome.close).toEqual({
      outcome: "rows",
      rows: [{ version: first }],
    });
    expect(outcome.reorder).toEqual({
      outcome: "rows",
      rows: [{ version: second }],
    });
    expect(outcome.unchanged).toEqual({
      outcome: "rows",
      rows: [{ version: second }],
    });
    expect(outcome.versions).toEqual([
      {
        version: first,
        note: "pilot check",
        f17: { code: "F17", wave: 1, is_open: false, display_order: 8 },
        author: adminA,
      },
      {
        version: second,
        note: null,
        f17: { code: "F17", wave: 1, is_open: false, display_order: 3 },
        author: adminA,
      },
    ]);
    expect(outcome).toMatchObject({
      secondWave: { code: INVALID_PARAMETER, detail: "facet_not_openable" },
      price: { code: INVALID_PARAMETER, detail: "facet_not_openable" },
      unknown: { code: INVALID_PARAMETER, detail: "facet_code" },
    });
    expect(outcome.lines.map((line) => line.payload)).toEqual([
      {
        table: "facet_settings",
        key: "F17",
        before: { is_open: true, display_order: 8 },
        after: { is_open: false, display_order: 8 },
        facet_config_version: first,
      },
      {
        table: "facet_settings",
        key: "F17",
        before: { is_open: false, display_order: 8 },
        after: { is_open: false, display_order: 3 },
        facet_config_version: second,
      },
    ]);
    expect(outcome.lines.every((line) => line.chained)).toBe(true);
  });
});

describe("L3E-T3 the journal (fiche invariants 8, 9; 10 RG41, RG66)", () => {
  it("L3E-T3 keeps reason_params to strings without any number, within 500 bytes and with the keys of its reason", async () => {
    const outcome = await scenario(async (tx) => {
      const query = await servedSearch(tx);
      const insert = (code: string, position: number, params: unknown) =>
        run(
          tx,
          "insert into search.impression_reasons " +
            "(search_query_id, creator_account_id, reason_code, position, reason_params) " +
            "values ($1::uuid, $2::uuid, $3::text, $4::smallint, $5::text::jsonb)",
          [query, creatorA, code, position, JSON.stringify(params)],
        );
      return {
        band: codeOf(
          await insert("audience_country_match", 1, {
            country: "FR",
            shareBand: "50_80",
          }),
        ),
        number: await insert("main_audience", 2, {
          country: "FR",
          shareBand: 72,
        }),
        digits: await insert("main_audience", 2, {
          country: "FR",
          shareBand: "72",
        }),
        decimal: await insert("main_audience", 2, {
          country: "FR",
          shareBand: "72.5",
        }),
        nested: await insert("main_audience", 2, {
          country: "FR",
          shareBand: { v: "a" },
        }),
        large: await insert("primary_topic", 2, {
          topic: "x".repeat(64),
          ...Object.fromEntries(
            Array.from({ length: 12 }, (_, i) => [
              `k${"a".repeat(i + 1)}`,
              "y".repeat(40),
            ]),
          ),
        }),
        missingKey: await insert("main_audience", 2, { country: "FR" }),
        extraKey: await insert("primary_topic", 2, {
          topic: "beauty",
          share: "ge_80",
        }),
        vigilance: await insert("stale_figures", 2, {}),
        position: await insert("primary_topic", 5, { topic: "beauty" }),
      };
    });
    expect(outcome.band).toBe("ok");
    for (const refused of [
      outcome.number,
      outcome.digits,
      outcome.decimal,
      outcome.nested,
      outcome.large,
      outcome.position,
    ]) {
      expect(refused).toMatchObject({
        outcome: "error",
        code: CHECK_VIOLATION,
      });
    }
    expect(outcome).toMatchObject({
      missingKey: { code: CHECK_VIOLATION, detail: "impression_reason_params" },
      extraKey: { code: CHECK_VIOLATION, detail: "impression_reason_params" },
      vigilance: { code: CHECK_VIOLATION, detail: "impression_reason_code" },
    });
  });

  it("L3E-T3 holds the coherence of a search line: a refusal counts nothing, rate_limited keeps no filter, a brand searches anonymously, the filters within 2 000 bytes; a vigilance note is of its kind", async () => {
    const outcome = await scenario(async (tx) => {
      const insert = (overrides: Record<string, unknown>) => {
        const row = {
          actor_role: "advertiser",
          view_mode: "advertiser_anonymous",
          outcome: "served",
          filters: {},
          sort_code: "default",
          result_count: 0,
          blocked: false,
          ...overrides,
        };
        return run(
          tx,
          "insert into search.search_queries (account_id, actor_role, view_mode, outcome, filters, " +
            "sort_code, facet_config_version, result_count, page_reached, blocked_by_k_anonymity) " +
            "values ($1::uuid, $2, $3, $4, $5::text::jsonb, $6, 1, $7::int, 1, $8::boolean)",
          [
            brandA,
            row.actor_role as string,
            row.view_mode as string,
            row.outcome as string,
            JSON.stringify(row.filters),
            row.sort_code as string,
            row.result_count as number,
            row.blocked as boolean,
          ],
        );
      };
      const query = await servedSearch(tx);
      return {
        served: codeOf(await insert({ result_count: 3, blocked: true })),
        pageCapCount: codeOf(
          await insert({ outcome: "page_cap", result_count: 4 }),
        ),
        rateFilters: codeOf(
          await insert({ outcome: "rate_limited", filters: { F1: "beauty" } }),
        ),
        identified: codeOf(await insert({ view_mode: "agent_identified" })),
        sort: codeOf(await insert({ sort_code: "price" })),
        large: codeOf(await insert({ filters: { F3: "x".repeat(2100) } })),
        vigilance: codeOf(
          await run(
            tx,
            "insert into search.search_impressions (search_query_id, creator_account_id, rank, " +
              "vigilance_code) values ($1::uuid, $2::uuid, 2, 'primary_topic')",
            [query, creatorB],
          ),
        ),
        note: codeOf(
          await run(
            tx,
            "insert into search.search_impressions (search_query_id, creator_account_id, rank, " +
              "vigilance_code) values ($1::uuid, $2::uuid, 2, 'stale_figures')",
            [query, creatorB],
          ),
        ),
      };
    });
    expect(outcome).toEqual({
      served: "ok",
      pageCapCount: CHECK_VIOLATION,
      rateFilters: CHECK_VIOLATION,
      identified: CHECK_VIOLATION,
      sort: CHECK_VIOLATION,
      large: CHECK_VIOLATION,
      vigilance: CHECK_VIOLATION,
      note: "ok",
    });
  });

  it("L3E-T3 keeps the journal append-only for every influx_% role given a right: an impression opens once, the erasure deletes, a version never changes", async () => {
    const outcome = await scenario(async (tx) => {
      const query = await servedSearch(tx);
      // rights granted inside the rolled-back transaction only, so that the guard is what refuses
      for (const table of [
        "search_queries",
        "search_impressions",
        "facet_config_versions",
      ]) {
        await tx.unsafe(
          `grant select, update, delete on search.${table} to influx_admin, influx_privacy_definer`,
        );
        await tx.unsafe(
          `create policy l3e_t3_probe on search.${table} for all ` +
            "to influx_admin, influx_privacy_definer using (true) with check (true)",
        );
      }
      await tx.unsafe("set local role influx_admin");
      const result = {
        updateQuery: codeOf(
          await run(
            tx,
            "update search.search_queries set result_count = 99 where id = $1::uuid",
            [query],
          ),
        ),
        adminDelete: codeOf(
          await run(
            tx,
            "delete from search.search_queries where id = $1::uuid",
            [query],
          ),
        ),
        open: codeOf(
          await run(
            tx,
            "update search.search_impressions set was_opened = true, opened_at = now() " +
              "where search_query_id = $1::uuid",
            [query],
          ),
        ),
        reopen: codeOf(
          await run(
            tx,
            "update search.search_impressions set opened_at = now() - interval '1 day' " +
              "where search_query_id = $1::uuid",
            [query],
          ),
        ),
        rerank: codeOf(
          await run(
            tx,
            "update search.search_impressions set rank = 2 where search_query_id = $1::uuid",
            [query],
          ),
        ),
        updateVersion: codeOf(
          await run(
            tx,
            "update search.facet_config_versions set note = 'x' where version = 1",
          ),
        ),
      };
      await tx.unsafe("reset role");
      await tx.unsafe("set local role influx_privacy_definer");
      const erasure = {
        deleteVersion: codeOf(
          await run(
            tx,
            "delete from search.facet_config_versions where version = 1",
          ),
        ),
        deleteQuery: await run<{ id: string }>(
          tx,
          "delete from search.search_queries where id = $1::uuid returning id",
          [query],
        ),
      };
      await tx.unsafe("reset role");
      const [left] = await tx<{ impressions: number }[]>`
        select count(*)::int as impressions from search.search_impressions
         where search_query_id = ${query}`;
      return { ...result, ...erasure, left: left?.impressions };
    });
    expect(outcome).toMatchObject({
      updateQuery: NOT_IN_PREREQUISITE_STATE,
      adminDelete: NOT_IN_PREREQUISITE_STATE,
      deleteQuery: { outcome: "rows", rows: [{ id: expect.any(String) }] },
      open: "ok",
      reopen: NOT_IN_PREREQUISITE_STATE,
      rerank: NOT_IN_PREREQUISITE_STATE,
      updateVersion: NOT_IN_PREREQUISITE_STATE,
      deleteVersion: NOT_IN_PREREQUISITE_STATE,
      left: 0,
    });
  });

  it("L3E-T3 refuses the delete of a journal line to an influx_% role that is not the erasure", async () => {
    const outcome = await scenario(async (tx) => {
      const query = await servedSearch(tx);
      await tx.unsafe(
        "grant select, delete on search.search_queries to influx_admin",
      );
      await tx.unsafe(
        "create policy l3e_t3_probe on search.search_queries for all to influx_admin using (true)",
      );
      await tx.unsafe("set local role influx_admin");
      const deleted = codeOf(
        await run(tx, "delete from search.search_queries where id = $1::uuid", [
          query,
        ]),
      );
      await tx.unsafe("reset role");
      return deleted;
    });
    expect(outcome).toBe(NOT_IN_PREREQUISITE_STATE);
  });

  it("L3E-T3 bands a count served (RG59): 5_9, 10_24, 25_49, 50_plus, nothing below 5", async () => {
    const rows = await scenario(
      (tx) => tx<{ band: string | null }[]>`
        select search.result_count_band(n) as band
          from unnest(array[null, 0, 4, 5, 9, 10, 24, 25, 49, 50, 5000]::int[]) with ordinality as t (n, i)
         order by i`,
    );
    expect(rows.map((row) => row.band)).toEqual([
      null,
      null,
      null,
      "5_9",
      "5_9",
      "10_24",
      "10_24",
      "25_49",
      "25_49",
      "50_plus",
      "50_plus",
    ]);
    expect(new Set(rows.map((row) => row.band).filter(Boolean))).toEqual(
      new Set(RESULT_COUNT_BANDS),
    );
  });

  it("L3E-T3 loads 13 reasons and 4 vigilance notes, codes and keys only, no label in base (R8)", async () => {
    const rows = await scenario(
      (tx) => tx<
        {
          code: string;
          kind: string;
          tier: number | null;
          keys: string[];
          label: string;
        }[]
      >`
        select code, kind, tier::int as tier, param_keys as keys, label_key as label
          from search.explanation_reasons order by kind, code`,
    );
    expect(rows.filter((row) => row.kind === "reason")).toHaveLength(13);
    expect(
      rows.filter((row) => row.kind === "vigilance").map((row) => row.code),
    ).toEqual([
      "audience_badge_to_renew",
      "declared_full",
      "recent_profile",
      "stale_figures",
    ]);
    expect(
      rows.filter(
        (row) => row.label !== `creatorSearch.${row.kind}.${row.code}`,
      ),
    ).toEqual([]);
    expect(rows.find((row) => row.code === "main_audience")).toMatchObject({
      tier: null,
      keys: ["country", "shareBand"],
    });
  });
});

describe("L3E-T3 TM11: the Drizzle declaration of search.ts has the columns of the base", () => {
  it("L3E-T3 declares every table of the schema search with exactly its columns", async () => {
    const catalogue = await scenario(
      (tx) => tx<{ name: string; columns: string[] }[]>`
        select c.relname as name, array_agg(a.attname::text order by a.attname) as columns
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
         where n.nspname = 'search' and c.relkind in ('r', 'p')
         group by c.relname order by c.relname`,
    );
    const declared = Object.fromEntries(
      Object.entries(searchColumns()).map(([table, columns]) => [
        table,
        [...columns].sort(),
      ]),
    );
    expect(declared).toEqual(
      Object.fromEntries(
        catalogue.map((row) => [row.name, [...row.columns].sort()]),
      ),
    );
    // creator_campaign_reads (0314) and the eleven tables of 0316
    expect(Object.keys(declared)).toHaveLength(12);
  });
});
