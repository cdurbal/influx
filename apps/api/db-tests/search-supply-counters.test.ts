// L3G commit 07 — L3G-T7: the daily counters of critical mass and their alerts, 0331 (jalons/l3g/07.md;
// l3g-fiche.md invariants 9, 3, 8, 15; jalons/l3g/modele.md §6; 10 RG2, RG86, CA60; 15 AL22, AL65; D38
// Q2). ops.compute_supply_counters() replaces the rows of the UTC day (global, topic, country;
// published = E1, E3, E4, searchable = + E2) inside an open supply_counters run, never touches
// is_open_to_advertisers; search.critical_mass_alerts() derives AL65 (thresholds reached while closed,
// below while open, counters stale) and AL22 (brand searches blocked by k) from the counters, the
// settings and the journal; search.read_supply_counters() serves the last snapshot and the curve.
// Each case runs in a rolled-back transaction of the local superuser, which sets aside the storefronts
// of earlier runs carrying this file's topic and audience country (so their rows count this file's
// creators alone), the counters and the recent journal, then acts as apps/api does (the worker, or
// influx_app and the admin in aal2).
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

const adminA = accountIdOf("admin", "a");
const agentA = accountIdOf("agent", "a");
const brandA = accountIdOf("advertiser", "a");
const creatorA = accountIdOf("creator", "a");

/** This file's main topic and main audience country: their rows count this file's creators alone. */
const TOPIC = "music";
const COUNTRY = "NR";

type CounterRow = {
  snapshot_on: string;
  dimension: string;
  dimension_value: string;
  published_profiles_count: number;
  searchable_profiles_count: number;
};

type AlertRow = {
  code: string;
  cause: string;
  observed: number | null;
  threshold: number | null;
  since_at: Date | null;
};

/** A rolled-back transaction: the file's topic and country set aside, no counter, no recent search. */
function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    await tx`update profiles.creator_public_profiles set primary_topic_code = null
              where primary_topic_code = ${TOPIC}`;
    await tx`update profiles.creator_public_profiles set main_audience_country = null
              where main_audience_country = ${COUNTRY}`;
    await tx`delete from search.supply_counters`;
    await tx`delete from search.search_queries where created_at > now() - interval '30 days'`;
    return fn(tx);
  });
}

beforeAll(async () => {
  await testDataSet();
});

// the fixtures ------------------------------------------------------------------------------------

type CreatorSpec = {
  status?: "published" | "draft" | "suspended";
  searchable?: boolean;
  adult?: boolean;
  account?: "active" | "suspended";
  topic?: string | null;
  country?: string | null;
};

/** A creator and its storefront, published, searchable, of this file's topic and country by default. */
async function newCreator(tx: Tx, spec: CreatorSpec = {}): Promise<string> {
  const id = randomUUID();
  const adult = spec.adult ?? true;
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3g-t7-${id}@example.test`}, now(), 'FR', 'fr',
            'L3G T7 Person', ${adult}, case when ${adult}::boolean then now() end, 'individual')`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, 'creator')`;
  if (spec.account === "suspended") {
    await tx`update identity.accounts set status = 'suspended', suspended_at = now()
              where id = ${id}`;
  }
  await tx`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')`;
  const status = spec.status ?? "published";
  await tx`
    update profiles.creator_public_profiles
       set status = ${status}::profiles.creator_profile_status,
           published_at = case when ${status} in ('published', 'suspended')
                               then now() - interval '40 days' end,
           is_searchable = ${spec.searchable ?? true},
           primary_topic_code = ${spec.topic === undefined ? TOPIC : spec.topic},
           main_audience_country = ${spec.country === undefined ? COUNTRY : spec.country}
     where account_id = ${id}`;
  return id;
}

/** An open run of supply_counters for the current UTC day (an earlier one set aside). */
async function openRun(tx: Tx, task = "supply_counters"): Promise<string> {
  await tx.unsafe("set local session_replication_role = replica");
  await tx`
    delete from ops.periodic_runs
     where task_code::text = ${task}
       and period_key = to_char(now() at time zone 'UTC', 'YYYY-MM-DD')`;
  await tx.unsafe("set local session_replication_role = origin");
  const [opened] = await tx<{ id: string }[]>`
    insert into ops.periodic_runs (task_code, period_key)
    values (${task}::ops.periodic_task, to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))
    returning id::text`;
  if (opened === undefined) throw new Error("no run");
  return opened.id;
}

/** The computation, as the worker; its count, or the SQLSTATE of its refusal. */
async function compute(tx: Tx, runId: string): Promise<number | string> {
  return actAs(tx, "worker", async () => {
    try {
      const [row] = await tx.savepoint(
        (savepoint) =>
          savepoint<{ n: number }[]>`
          select ops.compute_supply_counters(${runId}::uuid, 1::smallint) as n`,
      );
      return Number(row?.n);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === undefined) throw error;
      return code;
    }
  });
}

/** The rows of the UTC day, by dimension and value. */
async function countersOf(tx: Tx): Promise<CounterRow[]> {
  return tx<CounterRow[]>`
    select to_char(snapshot_on, 'YYYY-MM-DD') as snapshot_on, dimension, dimension_value,
           published_profiles_count, searchable_profiles_count
      from search.supply_counters
     where snapshot_on = (timezone('UTC', now()))::date
     order by dimension, dimension_value`;
}

function rowOf(rows: CounterRow[], dimension: string, value: string) {
  const row = rows.find(
    (r) => r.dimension === dimension && r.dimension_value === value,
  );
  return row === undefined
    ? undefined
    : [row.published_profiles_count, row.searchable_profiles_count];
}

async function setting(tx: Tx, key: string, value: unknown): Promise<void> {
  await tx`update search.search_settings set value = ${JSON.stringify(value)}::text::jsonb
            where key = ${key}`;
}

/** A row of counters written directly, `ageHours` ago, on the UTC day of that instant. */
async function counter(
  tx: Tx,
  dimension: string,
  value: string,
  searchable: number,
  ageHours = 0,
): Promise<void> {
  await tx`
    insert into search.supply_counters
      (snapshot_on, dimension, dimension_value, published_profiles_count,
       searchable_profiles_count, computed_at)
    values ((timezone('UTC', now() - make_interval(hours => ${ageHours}::integer)))::date,
            ${dimension}, ${value}, ${searchable + 1}, ${searchable},
            now() - make_interval(hours => ${ageHours}::integer))`;
}

async function alerts(
  tx: Tx,
  aal: "aal1" | "aal2" = "aal2",
): Promise<AlertRow[]> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: adminA, role: "admin", aal },
    () => tx<AlertRow[]>`select * from search.critical_mass_alerts()`,
  );
}

async function causes(tx: Tx): Promise<string[]> {
  return (await alerts(tx)).map((row) => `${row.code} ${row.cause}`);
}

/** `count` page-1 searches of the brand view served, `blocked` of them blocked by k. */
async function brandSearches(
  tx: Tx,
  count: number,
  blocked: number,
  options: {
    ageDays?: number;
    page?: number;
    view?: "advertiser_anonymous" | "agent_identified";
  } = {},
): Promise<void> {
  const view = options.view ?? "advertiser_anonymous";
  const account = view === "advertiser_anonymous" ? brandA : agentA;
  const role = view === "advertiser_anonymous" ? "advertiser" : "agent";
  await tx`
    insert into search.search_queries
      (account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
       result_count, page_reached, blocked_by_k_anonymity, created_at)
    select ${account}, ${role}, ${view}, 'served', '{}'::jsonb, 'default',
           (select max(version) from search.facet_config_versions), 3, ${options.page ?? 1},
           n <= ${blocked},
           now() - make_interval(days => ${options.ageDays ?? 0}::integer) - interval '1 minute'
      from generate_series(1, ${count}::integer) n`;
}

// L3G-T7 ------------------------------------------------------------------------------------------

describe("L3G-T7 the daily counters (10 RG2, D38; modele §6; fiche invariant 9)", () => {
  it("L3G-T7 loads the task supply_counters and AL22, AL65 as state alerts for the admins, their thresholds in table", async () => {
    const outcome = await scenario(async (tx) => {
      const task = await tx<{ label: string }[]>`
        select enumlabel as label from pg_catalog.pg_enum
         where enumtypid = 'ops.periodic_task'::regtype and enumlabel = 'supply_counters'`;
      const rows = await tx<
        {
          code: string;
          nature: string;
          recipient_roles: string[];
          threshold_value: unknown;
          is_active: boolean;
        }[]
      >`select code, nature::text as nature, recipient_roles, threshold_value, is_active
          from backoffice.alert_definitions where code in ('AL22', 'AL65') order by code`;
      return { task: task.length, rows };
    });
    expect(outcome.task).toBe(1);
    expect(outcome.rows).toEqual([
      {
        code: "AL22",
        nature: "etat",
        recipient_roles: ["admin"],
        threshold_value: {
          blockedShareBp: 2000,
          windowDays: 7,
          minSearches: 20,
        },
        is_active: true,
      },
      {
        code: "AL65",
        nature: "etat",
        recipient_roles: ["admin"],
        threshold_value: { staleAfterHours: 26 },
        is_active: true,
      },
    ]);
  });

  it("L3G-T7 counts exactly: published = a published storefront of an active, attested account; searchable adds is_searchable; draft, suspended storefront, suspended account and no attestation never count", async () => {
    const outcome = await scenario(async (tx) => {
      const run = await openRun(tx);
      await compute(tx, run);
      const before = await countersOf(tx);
      await newCreator(tx);
      await newCreator(tx);
      await newCreator(tx);
      await newCreator(tx, { searchable: false });
      await newCreator(tx, { status: "draft" });
      await newCreator(tx, { status: "suspended" });
      await newCreator(tx, { account: "suspended" });
      await newCreator(tx, { adult: false });
      // no main topic nor audience country: global alone (EC-L3G-07-2)
      await newCreator(tx, { topic: null, country: null });
      const written = await compute(tx, run);
      const after = await countersOf(tx);
      return { before, after, written };
    });
    expect(rowOf(outcome.before, "topic", TOPIC)).toBeUndefined();
    expect(rowOf(outcome.before, "country", COUNTRY)).toBeUndefined();
    expect(rowOf(outcome.after, "topic", TOPIC)).toEqual([4, 3]);
    expect(rowOf(outcome.after, "country", COUNTRY)).toEqual([4, 3]);
    const [publishedBefore = 0, searchableBefore = 0] =
      rowOf(outcome.before, "global", "*") ?? [];
    expect(rowOf(outcome.after, "global", "*")).toEqual([
      publishedBefore + 5,
      searchableBefore + 4,
    ]);
    expect(outcome.written).toBe(outcome.after.length);
    expect(
      outcome.after.every(
        (row) => row.searchable_profiles_count <= row.published_profiles_count,
      ),
    ).toBe(true);
  });

  it("L3G-T7 a replay of the day replaces the day, never doubles it, and never touches the day before", async () => {
    const outcome = await scenario(async (tx) => {
      await counter(tx, "global", "*", 11, 24);
      await counter(tx, "topic", TOPIC, 7, 24);
      const run = await openRun(tx);
      await newCreator(tx);
      await compute(tx, run);
      const first = await countersOf(tx);
      await newCreator(tx);
      await compute(tx, run);
      const second = await countersOf(tx);
      const [{ days } = { days: 0 }] = await tx<{ days: number }[]>`
        select count(distinct snapshot_on)::integer as days from search.supply_counters`;
      const [{ kept } = { kept: 0 }] = await tx<{ kept: number }[]>`
        select count(*)::integer as kept from search.supply_counters
         where snapshot_on = (timezone('UTC', now() - interval '24 hours'))::date
           and ((dimension = 'global' and searchable_profiles_count = 11)
                or (dimension = 'topic' and searchable_profiles_count = 7))`;
      return { first, second, days, kept };
    });
    expect(rowOf(outcome.first, "topic", TOPIC)).toEqual([1, 1]);
    expect(rowOf(outcome.second, "topic", TOPIC)).toEqual([2, 2]);
    expect(outcome.second).toHaveLength(outcome.first.length);
    expect(outcome.days).toBe(2);
    expect(outcome.kept).toBe(2);
  });

  it("L3G-T7 never touches the switch nor the settings, and writes neither the outbox, matching, nor the register (RG2, D45)", async () => {
    const outcome = await scenario(async (tx) => {
      const snapshot = () => tx<
        { key: string; value: unknown; at: Date | null }[]
      >`
        select key, value, updated_at as at from search.search_settings order by key`;
      const counts = () => tx<
        { outbox: number; audit: number; blocks: number }[]
      >`
        select (select count(*) from leads.outbox_events)::integer as outbox,
               (select count(*) from audit.audit_events
                 where event_type like 'search.%')::integer as audit,
               (select count(*) from matching.party_blocks)::integer as blocks`;
      await setting(tx, "critical_mass_thresholds", {
        publishedProfiles: 1,
        perTopic: 1,
      });
      const settingsBefore = await snapshot();
      const countsBefore = await counts();
      await newCreator(tx);
      const run = await openRun(tx);
      await compute(tx, run);
      await compute(tx, run);
      return {
        settingsBefore,
        settingsAfter: await snapshot(),
        countsBefore,
        countsAfter: await counts(),
        reached: await causes(tx),
      };
    });
    expect(outcome.settingsAfter).toEqual(outcome.settingsBefore);
    expect(
      outcome.settingsAfter.find((row) => row.key === "is_open_to_advertisers")
        ?.value,
    ).toBe(false);
    expect(outcome.countsAfter).toEqual(outcome.countsBefore);
    // CA60: the thresholds reached raise the alert, the search stays closed
    expect(outcome.reached).toContain("AL65 thresholds_reached");
  });

  it("L3G-T7 runs inside an open supply_counters run of the attempt only (55000), executed by influx_worker alone", async () => {
    const outcome = await scenario(async (tx) => {
      const unknown = await compute(tx, randomUUID());
      const other = await compute(tx, await openRun(tx, "campaign_closure"));
      const run = await openRun(tx);
      await tx`update ops.periodic_runs set finished_at = now(), outcome = 'succeeded'
                where id = ${run}`;
      const finished = await compute(tx, run);
      const [rights] = await tx<Record<string, boolean>[]>`
        select has_function_privilege('influx_worker', 'ops.compute_supply_counters(uuid,smallint)', 'EXECUTE') as worker,
               has_function_privilege('influx_agent', 'ops.compute_supply_counters(uuid,smallint)', 'EXECUTE') as agent,
               has_function_privilege('influx_admin', 'ops.compute_supply_counters(uuid,smallint)', 'EXECUTE') as admin,
               has_function_privilege('influx_advertiser', 'ops.compute_supply_counters(uuid,smallint)', 'EXECUTE') as brand,
               has_function_privilege('influx_creator', 'ops.compute_supply_counters(uuid,smallint)', 'EXECUTE') as creator`;
      const [left] = await tx<{ rows: number }[]>`
        select count(*)::integer as rows from search.supply_counters`;
      return { unknown, other, finished, rights, left: left?.rows };
    });
    expect(outcome).toEqual({
      unknown: NOT_IN_PREREQUISITE_STATE,
      other: NOT_IN_PREREQUISITE_STATE,
      finished: NOT_IN_PREREQUISITE_STATE,
      rights: {
        worker: true,
        agent: false,
        admin: false,
        brand: false,
        creator: false,
      },
      left: 0,
    });
  });
});

describe("L3G-T7 AL65, the critical mass (CA60; 10 RG2, edge case « passe sous le seuil »; D38 Q2)", () => {
  it("L3G-T7 raises thresholds_reached when the search is closed, the global searchable count reaches publishedProfiles and one topic reaches perTopic", async () => {
    const rows = await scenario(async (tx) => {
      await setting(tx, "critical_mass_thresholds", {
        publishedProfiles: 30,
        perTopic: 5,
      });
      await counter(tx, "global", "*", 30);
      await counter(tx, "topic", TOPIC, 5);
      await counter(tx, "topic", "food", 2);
      await counter(tx, "country", COUNTRY, 30);
      return alerts(tx);
    });
    expect(rows).toEqual([
      {
        code: "AL65",
        cause: "thresholds_reached",
        observed: 30,
        threshold: 30,
        since_at: expect.any(Date),
      },
    ]);
  });

  it("L3G-T7 raises nothing under a threshold: 29 of 30, or no topic at perTopic (the published count, above, never stands for the searchable one)", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "critical_mass_thresholds", {
        publishedProfiles: 30,
        perTopic: 5,
      });
      // published 30 (counter() writes searchable + 1), searchable 29
      await counter(tx, "global", "*", 29);
      await counter(tx, "topic", TOPIC, 5);
      const global = await causes(tx);
      await tx`delete from search.supply_counters`;
      await counter(tx, "global", "*", 40);
      await counter(tx, "topic", TOPIC, 4);
      await counter(tx, "topic", "food", 4);
      const topic = await causes(tx);
      return { global, topic };
    });
    expect(outcome).toEqual({ global: [], topic: [] });
  });

  it("L3G-T7 once the search is open: below the thresholds raises below_while_open, above them nothing (the closing stays human)", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "is_open_to_advertisers", true);
      await setting(tx, "critical_mass_thresholds", {
        publishedProfiles: 30,
        perTopic: 5,
      });
      await counter(tx, "global", "*", 12);
      await counter(tx, "topic", TOPIC, 5);
      const below = await alerts(tx);
      await tx`update search.supply_counters set searchable_profiles_count = 31,
                                                  published_profiles_count = 32
                where dimension = 'global'`;
      const above = await alerts(tx);
      return { below, above };
    });
    expect(outcome.below).toMatchObject([
      { code: "AL65", cause: "below_while_open", observed: 12, threshold: 30 },
    ]);
    expect(outcome.above).toEqual([]);
  });

  it("L3G-T7 a failed day keeps the day before and says so: the computation refused, yesterday's rows stay, counters_stale is raised and the thresholds still read yesterday", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "critical_mass_thresholds", {
        publishedProfiles: 30,
        perTopic: 5,
      });
      await counter(tx, "global", "*", 31, 30);
      await counter(tx, "topic", TOPIC, 6, 30);
      const [before] = await tx<{ rows: number }[]>`
        select count(*)::integer as rows from search.supply_counters`;
      // a failed computation (a run taken back: the attempt is no longer the one in base)
      const run = await openRun(tx);
      await tx`update ops.periodic_runs set attempt = 2 where id = ${run}`;
      const failed = await compute(tx, run);
      const [after] = await tx<{ rows: number }[]>`
        select count(*)::integer as rows from search.supply_counters`;
      return {
        before: before?.rows,
        failed,
        after: after?.rows,
        rows: await alerts(tx),
      };
    });
    expect(outcome.failed).toBe(NOT_IN_PREREQUISITE_STATE);
    expect(outcome.after).toBe(outcome.before);
    expect(outcome.rows).toEqual([
      {
        code: "AL65",
        cause: "counters_stale",
        observed: 30,
        threshold: 26,
        since_at: expect.any(Date),
      },
      {
        code: "AL65",
        cause: "thresholds_reached",
        observed: 31,
        threshold: 30,
        since_at: expect.any(Date),
      },
    ]);
  });

  it("L3G-T7 never computed is stale (observed NULL), a computation of the day is not; an inactive AL65 or a malformed threshold is silent", async () => {
    const outcome = await scenario(async (tx) => {
      const never = await alerts(tx);
      const run = await openRun(tx);
      await compute(tx, run);
      const fresh = (await causes(tx)).filter((cause) =>
        cause.endsWith("stale"),
      );
      await tx`delete from search.supply_counters`;
      await tx`update backoffice.alert_definitions set is_active = false where code = 'AL65'`;
      const inactive = await causes(tx);
      await tx`update backoffice.alert_definitions
                  set is_active = true, threshold_value = '{"staleAfterHours": "soon"}'::jsonb
                where code = 'AL65'`;
      const malformed = await causes(tx);
      return { never, fresh, inactive, malformed };
    });
    expect(outcome.never).toEqual([
      {
        code: "AL65",
        cause: "counters_stale",
        observed: null,
        threshold: 26,
        since_at: null,
      },
    ]);
    expect(outcome.fresh).toEqual([]);
    expect(outcome.inactive).toEqual([]);
    expect(outcome.malformed).toEqual([]);
  });
});

describe("L3G-T7 AL22, the brand searches blocked by k (10 RG86; 15 AL22)", () => {
  it("L3G-T7 raises above 20 % of at least 20 page-1 searches of the brand view over 7 days; exactly 20 % raises nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await counter(tx, "global", "*", 1);
      await brandSearches(tx, 20, 4);
      const exactly = (await alerts(tx)).filter((row) => row.code === "AL22");
      await tx`
        update search.search_queries set blocked_by_k_anonymity = true
         where id = (select id from search.search_queries
                      where account_id = ${brandA} and not blocked_by_k_anonymity
                        and created_at > now() - interval '1 hour'
                      limit 1)`;
      const above = (await alerts(tx)).filter((row) => row.code === "AL22");
      return { exactly, above };
    });
    expect(outcome.exactly).toEqual([]);
    expect(outcome.above).toEqual([
      {
        code: "AL22",
        cause: "k_blocked_share",
        observed: 2500,
        threshold: 2000,
        since_at: expect.any(Date),
      },
    ]);
  });

  it("L3G-T7 counts the brand view alone, page 1, inside the window: under 20 searches, an agent's identified searches, a page 2 and a search of 8 days ago raise nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await counter(tx, "global", "*", 1);
      await brandSearches(tx, 19, 19);
      const few = await causes(tx);
      await brandSearches(tx, 10, 10, { view: "agent_identified" });
      await brandSearches(tx, 10, 10, { page: 2 });
      await brandSearches(tx, 10, 10, { ageDays: 8 });
      const outside = await causes(tx);
      await brandSearches(tx, 1, 1);
      const reached = await causes(tx);
      return { few, outside, reached };
    });
    expect(outcome.few).toEqual([]);
    expect(outcome.outside).toEqual([]);
    expect(outcome.reached).toEqual(["AL22 k_blocked_share"]);
  });

  it("L3G-T7 is silent, never an error, when AL22 is inactive or its thresholds are malformed", async () => {
    const outcome = await scenario(async (tx) => {
      await counter(tx, "global", "*", 1);
      await brandSearches(tx, 20, 20);
      const up = await causes(tx);
      await tx`update backoffice.alert_definitions set is_active = false where code = 'AL22'`;
      const inactive = await causes(tx);
      await tx`update backoffice.alert_definitions
                  set is_active = true,
                      threshold_value = '{"blockedShareBp": 20000, "windowDays": 0, "minSearches": "x"}'::jsonb
                where code = 'AL22'`;
      const malformed = await causes(tx);
      return { up, inactive, malformed };
    });
    expect(outcome).toEqual({
      up: ["AL22 k_blocked_share"],
      inactive: [],
      malformed: [],
    });
  });
});

describe("L3G-T7 the readers of the admins (modele §6; TM12, T14)", () => {
  it("L3G-T7 read_supply_counters() serves the last snapshot whole and the global curve of the 29 days before, newest first", async () => {
    const rows = await scenario(async (tx) => {
      await counter(tx, "global", "*", 9);
      await counter(tx, "topic", TOPIC, 4);
      await counter(tx, "country", COUNTRY, 9);
      await counter(tx, "global", "*", 8, 24);
      await counter(tx, "topic", TOPIC, 3, 24);
      await counter(tx, "global", "*", 2, 24 * 30);
      return actAsInternal(
        tx,
        "influx_admin",
        { accountId: adminA, role: "admin", aal: "aal2" },
        () => tx<CounterRow[]>`
          select to_char(snapshot_on, 'YYYY-MM-DD') as snapshot_on, dimension, dimension_value,
                 published_profiles_count, searchable_profiles_count
            from search.read_supply_counters()`,
      );
    });
    expect(
      rows.map((row) => [
        row.dimension,
        row.dimension_value,
        row.searchable_profiles_count,
      ]),
    ).toEqual([
      ["country", COUNTRY, 9],
      ["global", "*", 9],
      ["topic", TOPIC, 4],
      ["global", "*", 8],
    ]);
  });

  it("L3G-T7 executes for an active admin in aal2 only: an agent, a brand, a creator and an admin in aal1 get 42501", async () => {
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
      const reads = [
        () => tx`select * from search.critical_mass_alerts()`,
        () => tx`select * from search.read_supply_counters()`,
      ];
      const each = async (
        as: (fn: () => Promise<unknown>) => Promise<unknown>,
      ): Promise<string[]> => {
        const out: string[] = [];
        for (const read of reads) {
          out.push(await attempt(() => as(read)));
        }
        return out;
      };
      return {
        admin: await each((fn) =>
          actAsInternal(
            tx,
            "influx_admin",
            { accountId: adminA, role: "admin", aal: "aal2" },
            fn,
          ),
        ),
        adminAal1: await each((fn) =>
          actAsInternal(
            tx,
            "influx_admin",
            { accountId: adminA, role: "admin", aal: "aal1" },
            fn,
          ),
        ),
        agent: await each((fn) =>
          actAsInternal(
            tx,
            "influx_agent",
            { accountId: agentA, role: "agent", aal: "aal2" },
            fn,
          ),
        ),
        brand: await each((fn) =>
          actAsMember(
            tx,
            "influx_advertiser",
            { accountId: brandA, role: "advertiser", aal: "aal1" },
            fn,
          ),
        ),
        creator: await each((fn) =>
          actAsMember(
            tx,
            "influx_creator",
            { accountId: creatorA, role: "creator", aal: "aal1" },
            fn,
          ),
        ),
      };
    });
    expect(codes).toEqual({
      admin: ["ok", "ok"],
      adminAal1: [INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE],
      agent: [INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE],
      brand: [INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE],
      creator: [INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE],
    });
  });

  it("L3G-T7 the three functions in the catalogue: owners, SECURITY DEFINER, empty search_path, their callers alone; the counters read neither layer I nor the settings", async () => {
    const rows = await scenario(
      (tx) => tx<
        {
          fn: string;
          owner: string;
          definer: boolean;
          volatility: string;
          config: string[];
          callers: string[];
          beyond: boolean;
        }[]
      >`
        select p.oid::regprocedure::text as fn, pg_catalog.pg_get_userbyid(p.proowner) as owner,
               p.prosecdef as definer, p.provolatile::text as volatility, p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(p.proacl) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers,
               p.prosrc ~* 'search_settings|creator_identities|creator_social_accounts|creator_audience' as beyond
          from pg_catalog.pg_proc p
         where p.oid in ('ops.compute_supply_counters(uuid,smallint)'::regprocedure,
                         'search.critical_mass_alerts()'::regprocedure,
                         'search.read_supply_counters()'::regprocedure)
         order by 1`,
    );
    expect(rows).toEqual([
      {
        fn: "ops.compute_supply_counters(uuid,smallint)",
        owner: "influx_maintenance_definer",
        definer: true,
        volatility: "v",
        config: ['search_path=""'],
        callers: ["influx_worker"],
        beyond: false,
      },
      {
        // the alerts read the switch and the thresholds of the opening (D38 Q2), never write them
        fn: "search.critical_mass_alerts()",
        owner: "influx_search_admin_definer",
        definer: true,
        volatility: "s",
        config: ['search_path=""'],
        callers: ["influx_admin"],
        beyond: true,
      },
      {
        fn: "search.read_supply_counters()",
        owner: "influx_search_admin_definer",
        definer: true,
        volatility: "s",
        config: ['search_path=""'],
        callers: ["influx_admin"],
        beyond: false,
      },
    ]);
  });
});
