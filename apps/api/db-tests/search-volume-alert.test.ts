// L3E commit 10 — L3E-T10: AL21, the abnormal volume of creator profiles served (I-9), 0321
// (jalons/l3e/10.md; l3e-fiche.md invariants 9, 10, 12, 15, 16; jalons/l3e/modele.md §10; 03 I-9;
// 10 RG68, CA44; 15 AL21). The function search.creator_search_volume_alerts() answers from the journal
// of the search, an account, a cause, a count and a date, never a filter nor a creator; it falls by
// itself when the window leaves the lines behind. Part one runs in rolled-back transactions of the
// local superuser (the thresholds, the caps and the lines written inside), the function called as
// apps/api calls it; part two reads GET /v1/bo/alerts with committed sessions (the admin sees AL21,
// the agent never, and no filter nor profile leaves).
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { buildServer } from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
} from "../tests/helpers.ts";
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const INSUFFICIENT_PRIVILEGE = "42501";

const brandA = accountIdOf("advertiser", "a");
const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const agentA = accountIdOf("agent", "a");
const adminA = accountIdOf("admin", "a");

/** The row of the function, as apps/api reads it. */
type Row = {
  subject_account_id: string;
  cause: string;
  observed: number;
  since_at: Date;
};

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

async function asAdmin<T>(
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

/** The rows of the function for one account, as the admin reads them. */
async function alertsOf(tx: Tx, account: string): Promise<Row[]> {
  const rows = await asAdmin(
    tx,
    () => tx<Row[]>`select * from search.creator_search_volume_alerts()`,
  );
  return rows.filter((row) => row.subject_account_id === account);
}

/** The thresholds of AL21 and the caps of the search for the time of the transaction. */
async function configure(
  tx: Tx,
  options: {
    distinct?: number;
    shareBp?: number;
    perHour?: number;
    perDay?: number;
  } = {},
): Promise<void> {
  await tx`
    update backoffice.alert_definitions
       set threshold_value = ${JSON.stringify({
         distinct_profiles_served_24h: options.distinct ?? 150,
         rate_cap_share_bp: options.shareBp ?? 8000,
       })}::text::jsonb
     where code = 'AL21'`;
  await tx`
    update search.search_settings
       set value = ${JSON.stringify({
         perHour: options.perHour ?? 30,
         perDay: options.perDay ?? 200,
         profileOpensPerDay: 60,
       })}::text::jsonb
     where key = 'rate_limits'`;
}

/** `count` lines of `account`, `ageHours` old, each serving the creators given (when served). */
async function journal(
  tx: Tx,
  account: string,
  options: {
    count?: number;
    ageHours?: number;
    outcome?: "served" | "page_cap" | "rate_limited";
    creators?: readonly string[];
    actorRole?: "advertiser" | "agent" | "admin";
  } = {},
): Promise<void> {
  const outcome = options.outcome ?? "served";
  const actorRole = options.actorRole ?? "advertiser";
  const view =
    actorRole === "advertiser" ? "advertiser_anonymous" : "agent_identified";
  for (let line = 0; line < (options.count ?? 1); line += 1) {
    const id = randomUUID();
    await tx`
      insert into search.search_queries
        (id, account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
         result_count, page_reached, created_at)
      values (${id}, ${account}, ${actorRole}, ${view}, ${outcome},
              ${outcome === "rate_limited" ? "{}" : '{"F6":{"country":"GL"}}'}::text::jsonb,
              'default', (select max(version) from search.facet_config_versions),
              ${outcome === "served" ? 7 : 0}, 1,
              now() - make_interval(hours => ${options.ageHours ?? 0}::integer) - interval '1 minute')`;
    let rank = 1;
    for (const creator of outcome === "served"
      ? (options.creators ?? [])
      : []) {
      await tx`
        insert into search.search_impressions (search_query_id, creator_account_id, rank)
        values (${id}, ${creator}, ${rank})`;
      rank += 1;
    }
  }
}

async function clear(tx: Tx, account: string): Promise<void> {
  await tx`delete from search.search_queries where account_id = ${account}`;
}

beforeAll(async () => {
  await testDataSet();
});

describe("L3E-T10 AL21 in the catalogue and in the function (15 AL21; modele §10; fiche invariants 9, 15)", () => {
  it("L3E-T10 loads AL21 as a state alert for the admins, its thresholds in table (150 profiles over 24 h, 80 % of a cap)", async () => {
    const rows = await scenario(
      (tx) => tx<
        {
          code: string;
          nature: string;
          recipient_roles: string[];
          threshold_value: unknown;
          label_key: string;
          is_active: boolean;
        }[]
      >`select code, nature::text as nature, recipient_roles, threshold_value, label_key, is_active
          from backoffice.alert_definitions where code = 'AL21'`,
    );
    expect(rows).toEqual([
      {
        code: "AL21",
        nature: "etat",
        recipient_roles: ["admin"],
        threshold_value: {
          distinct_profiles_served_24h: 150,
          rate_cap_share_bp: 8000,
        },
        label_key: "alert.AL21",
        is_active: true,
      },
    ]);
  });

  it("L3E-T10 raises nothing under the threshold, and counts DISTINCT creators: one creator served five times is one", async () => {
    const outcome = await scenario(async (tx) => {
      await clear(tx, brandA);
      await configure(tx, { distinct: 1 });
      await journal(tx, brandA, { count: 5, creators: [creatorA] });
      const under = await alertsOf(tx, brandA);
      await journal(tx, brandA, { creators: [creatorB] });
      const over = await alertsOf(tx, brandA);
      return { under, over };
    });
    expect(outcome.under).toEqual([]);
    expect(outcome.over).toMatchObject([
      {
        subject_account_id: brandA,
        cause: "distinct_profiles_served",
        observed: 2,
      },
    ]);
  });

  it("L3E-T10 serves the account, the cause, a count and a date: never a filter nor a creator", async () => {
    const rows = await scenario(async (tx) => {
      await clear(tx, brandA);
      await configure(tx, { distinct: 1 });
      await journal(tx, brandA, { creators: [creatorA, creatorB] });
      return alertsOf(tx, brandA);
    });
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "cause",
      "observed",
      "since_at",
      "subject_account_id",
    ]);
    const text = JSON.stringify(rows);
    expect(text).not.toContain(creatorA);
    expect(text).not.toContain(creatorB);
    expect(text).not.toContain("GL");
  });

  it("L3E-T10 raises at 80 % of the hourly cap, not at 7 of 10, and names the window", async () => {
    const outcome = await scenario(async (tx) => {
      await clear(tx, brandA);
      await configure(tx, { perHour: 10, perDay: 1000 });
      await journal(tx, brandA, { count: 7 });
      const under = await alertsOf(tx, brandA);
      await journal(tx, brandA, { outcome: "page_cap" });
      const reached = await alertsOf(tx, brandA);
      return { under, reached };
    });
    expect(outcome.under).toEqual([]);
    expect(outcome.reached).toMatchObject([
      { cause: "rate_cap_share_hour", observed: 8 },
    ]);
  });

  it("L3E-T10 raises at 80 % of the daily cap on lines older than an hour: the day alone, not the hour", async () => {
    const rows = await scenario(async (tx) => {
      await clear(tx, brandA);
      await configure(tx, { perHour: 10, perDay: 10 });
      await journal(tx, brandA, { count: 8, ageHours: 3 });
      return alertsOf(tx, brandA);
    });
    expect(rows).toMatchObject([{ cause: "rate_cap_share_day", observed: 8 }]);
  });

  it("L3E-T10 raises on a refusal journalled in the last 24 hours, and a refusal never counts toward a cap", async () => {
    const rows = await scenario(async (tx) => {
      await clear(tx, brandA);
      await configure(tx, { perHour: 2, perDay: 2 });
      await journal(tx, brandA, { count: 3, outcome: "rate_limited" });
      return alertsOf(tx, brandA);
    });
    expect(rows).toMatchObject([{ cause: "rate_limited", observed: 3 }]);
  });

  it("L3E-T10 falls after the window: the same lines at 23 hours raise, at 25 hours nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await clear(tx, brandA);
      await configure(tx, { distinct: 1, perHour: 4, perDay: 4 });
      await journal(tx, brandA, {
        count: 4,
        ageHours: 23,
        creators: [creatorA, creatorB],
      });
      const inside = (await alertsOf(tx, brandA)).map((row) => row.cause);
      await clear(tx, brandA);
      await journal(tx, brandA, {
        count: 4,
        ageHours: 25,
        creators: [creatorA, creatorB],
      });
      const outside = await alertsOf(tx, brandA);
      return { inside, outside };
    });
    expect(outcome.inside).toEqual([
      "distinct_profiles_served",
      "rate_cap_share_day",
    ]);
    expect(outcome.outside).toEqual([]);
  });

  it("L3E-T10 counts the accounts of the agents and of the admins as the brands' (RG50)", async () => {
    const rows = await scenario(async (tx) => {
      await clear(tx, agentA);
      await configure(tx, { distinct: 1 });
      await journal(tx, agentA, {
        actorRole: "agent",
        creators: [creatorA, creatorB],
      });
      return alertsOf(tx, agentA);
    });
    expect(rows).toMatchObject([
      { subject_account_id: agentA, cause: "distinct_profiles_served" },
    ]);
  });

  it("L3E-T10 is silent, never an error, when AL21 is inactive or a threshold is not a non-negative number", async () => {
    const outcome = await scenario(async (tx) => {
      await clear(tx, brandA);
      await configure(tx, { distinct: 1, perHour: 10, perDay: 1000 });
      await journal(tx, brandA, { count: 9, creators: [creatorA, creatorB] });
      const up = (await alertsOf(tx, brandA)).map((row) => row.cause);
      await tx`update backoffice.alert_definitions set is_active = false where code = 'AL21'`;
      const inactive = await alertsOf(tx, brandA);
      await tx`
        update backoffice.alert_definitions
           set is_active = true,
               threshold_value = '{"distinct_profiles_served_24h": "many", "rate_cap_share_bp": -1}'::jsonb
         where code = 'AL21'`;
      const malformed = await alertsOf(tx, brandA);
      return { up, inactive, malformed };
    });
    expect(outcome.up).toEqual([
      "distinct_profiles_served",
      "rate_cap_share_hour",
    ]);
    expect(outcome.inactive).toEqual([]);
    expect(outcome.malformed).toEqual([]);
  });

  it("L3E-T10 executes for an active admin in aal2 only: an agent, a brand, a creator and an admin in aal1 get 42501", async () => {
    const codes = await scenario(async (tx) => {
      const attempt = async (call: () => Promise<unknown>) => {
        try {
          await tx.savepoint(async () => {
            await call();
          });
          return "ok";
        } catch (error) {
          return (error as { code?: string }).code ?? "unknown";
        }
      };
      const select = () =>
        tx`select * from search.creator_search_volume_alerts()`;
      return {
        admin: await attempt(() => asAdmin(tx, select)),
        adminAal1: await attempt(() => asAdmin(tx, select, "aal1")),
        agent: await attempt(() =>
          actAsInternal(
            tx,
            "influx_agent",
            { accountId: agentA, role: "agent", aal: "aal2" },
            select,
          ),
        ),
        brand: await attempt(() =>
          actAsMember(
            tx,
            "influx_advertiser",
            { accountId: brandA, role: "advertiser", aal: "aal1" },
            select,
          ),
        ),
        creator: await attempt(() =>
          actAsMember(
            tx,
            "influx_creator",
            { accountId: creatorA, role: "creator", aal: "aal1" },
            select,
          ),
        ),
      };
    });
    expect(codes).toEqual({
      admin: "ok",
      adminAal1: INSUFFICIENT_PRIVILEGE,
      agent: INSUFFICIENT_PRIVILEGE,
      brand: INSUFFICIENT_PRIVILEGE,
      creator: INSUFFICIENT_PRIVILEGE,
    });
  });

  it("L3E-T10 gives the function to influx_admin alone, SECURITY DEFINER STABLE, empty search_path, owned by influx_search_admin_definer, and no member right on the journal", async () => {
    const outcome = await scenario(async (tx) => {
      const [fn] = await tx<
        {
          owner: string;
          definer: boolean;
          volatility: string;
          config: string[];
          callers: string[];
        }[]
      >`
        select pg_catalog.pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
               p.provolatile as volatility, p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(p.proacl) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers
          from pg_catalog.pg_proc p
         where p.oid = 'search.creator_search_volume_alerts()'::regprocedure`;
      const members = await tx<{ line: string }[]>`
        select r.rolname || ' ' || c.oid::regclass::text as line
          from pg_catalog.pg_class c, pg_catalog.pg_roles r
         where c.oid in ('search.search_queries'::regclass, 'search.search_impressions'::regclass)
           and r.rolname in ('influx_advertiser', 'influx_creator', 'influx_agent', 'influx_admin',
                             'anon', 'authenticated', 'service_role')
           and (has_table_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE, DELETE')
                or has_any_column_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE'))`;
      return { fn, members };
    });
    expect(outcome.fn).toEqual({
      owner: "influx_search_admin_definer",
      definer: true,
      volatility: "s",
      config: ['search_path=""'],
      callers: ["influx_admin"],
    });
    expect(outcome.members).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// GET /v1/bo/alerts: the committed sessions, the thresholds lowered for the time of the file
// ---------------------------------------------------------------------------------------------

describe("L3E-T10 GET /v1/bo/alerts raises AL21 for the admin, never for an agent, and serves no filter nor profile", () => {
  let database: ApiDatabase;
  let migration: postgres.Sql;
  let server: ReturnType<typeof buildServer>;
  const accounts: string[] = [];
  let thresholdBefore: unknown;

  type Internal = { accountId: string; session: string };

  function localConnection(role: LoginRole) {
    return { url: localRoleUrl(role), role, tls: false };
  }

  async function newInternal(role: "agent" | "admin"): Promise<Internal> {
    const accountId = randomUUID();
    const token = randomBytes(32);
    await migration.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           display_name, is_adult_attested, adult_attested_at, declared_status)
        values (${accountId}, ${randomUUID()}, ${`l3e-t10-${role}-${accountId}@example.test`}, now(),
                'FR', 'fr', 'Camille', true, now(), 'business')`;
      await tx`
        insert into identity.account_roles (account_id, role)
        values (${accountId}, ${role}::identity.account_role)`;
      await tx`
        insert into identity.agent_profiles
          (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
        values (${accountId}, 'Camille', now(), now(), ${randomUUID()})`;
      await tx`
        insert into identity.sessions
          (token_hash, account_id, surface, mfa_method, user_agent_summary)
        values (${createHash("sha256").update(token).digest()}, ${accountId}, 'backoffice', 'totp',
                'firefox.linux')`;
    });
    accounts.push(accountId);
    return { accountId, session: token.toString("base64url") };
  }

  async function newBrand(): Promise<string> {
    const accountId = randomUUID();
    await migration.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status)
        values (${accountId}, ${randomUUID()}, ${`l3e-t10-brand-${accountId}@example.test`}, now(),
                'FR', 'fr', true, now(), 'business')`;
      await tx`
        insert into identity.account_roles (account_id, role) values (${accountId}, 'advertiser')`;
    });
    accounts.push(accountId);
    return accountId;
  }

  async function alertsFor(who: Internal) {
    const response = await server.inject({
      method: "GET",
      url: "/v1/bo/alerts",
      headers: {
        "x-influx-internal": BACKOFFICE_SECRET,
        origin: BACKOFFICE_ORIGIN,
        "x-request-id": randomUUID(),
        cookie: `__Host-influx-ops-session=${who.session}`,
      },
    });
    return {
      status: response.statusCode,
      text: response.body,
      alerts: (response.json() as { alerts: Record<string, unknown>[] }).alerts,
    };
  }

  beforeAll(async () => {
    migration = migrationRole();
    database = createApiDatabase(
      {
        app: localConnection("influx_app"),
        auth: localConnection("influx_auth_login"),
        ops: localConnection("influx_ops_login"),
      },
      { info: () => undefined, warn: () => undefined, error: () => undefined },
    );
    const logs = captureLogs();
    server = buildServer(testApiConfig(), {
      logDestination: logs.destination,
      database,
    });
    const [before] = await migration<{ value: unknown }[]>`
      select threshold_value as value from backoffice.alert_definitions where code = 'AL21'`;
    thresholdBefore = before?.value;
    await migration`
      update backoffice.alert_definitions
         set threshold_value = '{"distinct_profiles_served_24h": 1, "rate_cap_share_bp": 8000}'::jsonb
       where code = 'AL21'`;
  });

  afterAll(async () => {
    await migration`
      update backoffice.alert_definitions
         set threshold_value = ${JSON.stringify(thresholdBefore)}::text::jsonb
       where code = 'AL21'`;
    await migration`delete from search.search_queries where account_id = any(${accounts}::uuid[])`;
    await migration`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${accounts}::uuid[]) and is_active`;
    await closeDatabase(database);
    await migration.end();
  });

  it("L3E-T10 shows the admin one AL21 per account and cause with the account, the count and the date, and no filter, no creator, nothing of what was searched", async () => {
    const admin = await newInternal("admin");
    const brand = await newBrand();
    await migration`
      insert into search.search_queries
        (id, account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
         result_count, page_reached)
      select q.id, ${brand}, 'advertiser', 'advertiser_anonymous', 'served',
             '{"F6":{"country":"GL"}}'::jsonb, 'default',
             (select max(version) from search.facet_config_versions), 7, 1
        from (select ${randomUUID()}::uuid as id) q`;
    await migration`
      insert into search.search_impressions (search_query_id, creator_account_id, rank)
      select q.id, c.creator, c.rank
        from (select id from search.search_queries where account_id = ${brand}) q,
             (values (${creatorA}::uuid, 1), (${creatorB}::uuid, 2)) as c (creator, rank)`;
    const read = await alertsFor(admin);
    expect(read.status).toBe(200);
    const mine = read.alerts.filter((alert) => alert.accountId === brand);
    expect(mine).toEqual([
      {
        code: "AL21",
        cause: "distinct_profiles_served",
        destination: null,
        setting: null,
        accountId: brand,
        count: 2,
        since: expect.any(String),
      },
    ]);
    expect(read.text).not.toContain(creatorA);
    expect(read.text).not.toContain(creatorB);
    expect(read.text).not.toContain("GL");
  });

  it("L3E-T10 shows an agent no AL21, whoever searched (the recipient of AL21 is the admin)", async () => {
    const agent = await newInternal("agent");
    const read = await alertsFor(agent);
    expect(read.status).toBe(200);
    expect(read.alerts.filter((alert) => alert.code === "AL21")).toEqual([]);
    expect(read.text).not.toMatch(/distinct_profiles_served|rate_cap_share/);
  });
});
