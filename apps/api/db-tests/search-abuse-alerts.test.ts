// L3F commit 06 — L3F-T6: the refinement (CA45) and the scraping (CA46) of the anonymous directory,
// and the openings of a profile counted in AL21, 0326 (jalons/l3f/06.md; l3f-fiche.md invariants 4,
// 9; jalons/l3f/modele.md §7; 10 RG63, RG68, CA45, CA46; 15 AL21). The function
// search.creator_search_volume_alerts() answers an account, a cause, a count and a date over the
// journal of 24 sliding hours, its thresholds in table; never a filter, an alias nor a creator. Each
// case runs in a rolled-back transaction of the local superuser, which writes the journal, the
// openings, the shortlists and the requests outside the doors, and calls the function as the admin
// (apps/api reads it at each GET /v1/bo/alerts, L3E-T10).
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
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
const OWNER = "influx_search_admin_definer";

const adminA = accountIdOf("admin", "a");
const agentA = accountIdOf("agent", "a");

/** The row of the function, as apps/api reads it. */
type Row = {
  subject_account_id: string;
  cause: string;
  observed: number;
  since_at: Date;
};

type Thresholds = {
  distinct_profiles_served_24h?: number;
  rate_cap_share_bp?: number;
  refinement_searches?: unknown;
  refinement_blocked?: number;
  aspiration_profiles_24h?: number;
};

/** The starting values of staging (0321, 0326; annexe « Hypothèses staging »). */
const STAGING: Required<Thresholds> = {
  distinct_profiles_served_24h: 150,
  rate_cap_share_bp: 8000,
  refinement_searches: 6,
  refinement_blocked: 2,
  aspiration_profiles_24h: 150,
};

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function asAdmin<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: adminA, role: "admin", aal: "aal2" },
    fn,
  );
}

/** Every row of the function, as the admin reads it. */
function alerts(tx: Tx): Promise<Row[]> {
  return asAdmin(
    tx,
    () => tx<Row[]>`select * from search.creator_search_volume_alerts()`,
  );
}

/** The rows of `accounts`, one cause at a time when given. */
async function alertsOf(
  tx: Tx,
  accounts: readonly string[],
  cause?: string,
): Promise<Row[]> {
  return (await alerts(tx)).filter(
    (row) =>
      accounts.includes(row.subject_account_id) &&
      (cause === undefined || row.cause === cause),
  );
}

// the fixtures ------------------------------------------------------------------------------------

/** The thresholds of AL21 (in table) and the caps, for the time of the transaction. */
async function configure(
  tx: Tx,
  thresholds: Thresholds = STAGING,
  caps: { perHour?: number; perDay?: number; profileOpensPerDay?: number } = {},
): Promise<void> {
  await tx`
    update backoffice.alert_definitions
       set threshold_value = ${JSON.stringify(thresholds)}::text::jsonb
     where code = 'AL21'`;
  await tx`
    update search.search_settings
       set value = ${JSON.stringify({
         perHour: caps.perHour ?? 1000,
         perDay: caps.perDay ?? 20000,
         profileOpensPerDay: caps.profileOpensPerDay ?? 1000,
       })}::text::jsonb
     where key = 'rate_limits'`;
}

async function newAccount(
  tx: Tx,
  role: "creator" | "advertiser",
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3f-t6-${id}@example.test`}, now(), 'FR', 'fr',
            'L3F T6 Person', true, now(), ${role === "creator" ? "individual" : "business"})`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, ${role})`;
  return id;
}

/** A brand with its profile (a shortlist and a request name it). */
async function newBrand(tx: Tx): Promise<string> {
  const id = await newAccount(tx, "advertiser");
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3F T6 Brand', 'sports_leisure', '11_50',
            ${`l3f-t6-${id.slice(0, 8)}.example`},
            'A brand of the L3F tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  await tx`update profiles.advertiser_profiles set status = 'published' where account_id = ${id}`;
  return id;
}

/** `count` creators, with a storefront and its alias when asked. */
async function newCreators(
  tx: Tx,
  count: number,
  storefront = false,
): Promise<string[]> {
  const ids: string[] = [];
  for (let n = 0; n < count; n += 1) {
    const id = await newAccount(tx, "creator");
    if (storefront) {
      await tx`
        insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
        values (${id}, profiles.new_creator_alias(), 'FR')`;
    }
    ids.push(id);
  }
  return ids;
}

/** One search of `account`, `minutesAgo` old, and the creators it listed. */
async function search(
  tx: Tx,
  account: string,
  options: {
    minutesAgo: number;
    filters?: Record<string, unknown>;
    blocked?: boolean;
    page?: number;
    sort?: string;
    outcome?: "served" | "page_cap" | "rate_limited";
    creators?: readonly string[];
  },
): Promise<void> {
  const id = randomUUID();
  const outcome = options.outcome ?? "served";
  await tx`
    insert into search.search_queries
      (id, account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
       result_count, page_reached, blocked_by_k_anonymity, created_at)
    values (${id}, ${account}, 'advertiser', 'advertiser_anonymous', ${outcome},
            ${JSON.stringify(outcome === "rate_limited" ? {} : (options.filters ?? {}))}::text::jsonb,
            ${options.sort ?? "default"}, (select max(version) from search.facet_config_versions),
            ${outcome === "served" ? (options.blocked === true ? 3 : 12) : 0},
            ${options.page ?? 1}, ${outcome === "served" && options.blocked === true},
            now() - make_interval(mins => ${options.minutesAgo}::integer))`;
  let rank = 1;
  for (const creator of options.creators ?? []) {
    await tx`
      insert into search.search_impressions (search_query_id, creator_account_id, rank)
      values (${id}, ${creator}, ${rank})`;
    rank += 1;
  }
}

/** Openings of `account` (served, one per creator; or one refusal), `minutesAgo` old. */
async function open(
  tx: Tx,
  account: string,
  creators: readonly (string | null | undefined)[],
  minutesAgo = 10,
): Promise<void> {
  for (const creator of creators) {
    if (creator === undefined) throw new Error("no creator");
    await tx`
      insert into search.profile_openings (account_id, outcome, creator_account_id, created_at)
      values (${account}, ${creator === null ? "rate_limited" : "served"}, ${creator},
              now() - make_interval(mins => ${minutesAgo}::integer))`;
  }
}

/** A shortlist of `brand` that gained `creator`, `minutesAgo` ago. */
async function addToShortlist(
  tx: Tx,
  brand: string,
  creator: string,
  minutesAgo = 5,
): Promise<void> {
  const [list] = await tx<{ id: string }[]>`
    insert into search.shortlists (advertiser_account_id, name) values (${brand}, 'L3F T6 list')
    returning id::text`;
  await tx`
    insert into search.shortlist_items (shortlist_id, creator_account_id, added_at)
    values (${list?.id ?? null}, ${creator}, now() - make_interval(mins => ${minutesAgo}::integer))`;
}

async function requestSelection(tx: Tx, brand: string): Promise<void> {
  await tx`
    insert into search.selection_requests (advertiser_account_id, filters, language, sla_due_at)
    values (${brand}, '{"F1": "pets"}'::jsonb, 'fr', now() + interval '1 day')`;
}

/** The six searches of CA45: each differs from the one before by one facet, two below k. */
const SERIES: readonly {
  filters: Record<string, unknown>;
  blocked: boolean;
}[] = [
  { filters: { F1: "pets" }, blocked: false },
  { filters: { F1: "pets", F6: { country: "CY" } }, blocked: false },
  { filters: { F1: "pets", F6: { country: "MT" } }, blocked: true },
  {
    filters: { F1: "pets", F6: { country: "MT" }, F11: ["fr"] },
    blocked: false,
  },
  {
    filters: { F1: "food", F6: { country: "MT" }, F11: ["fr"] },
    blocked: true,
  },
  {
    filters: { F1: "food", F6: { country: "MT" }, F11: ["en"] },
    blocked: false,
  },
];

/** The searches of `series` by `account`, the first 60 minutes ago, one every 5 minutes. */
async function runSeries(
  tx: Tx,
  account: string,
  series: readonly { filters: Record<string, unknown>; blocked: boolean }[],
): Promise<void> {
  let minutesAgo = 60;
  for (const step of series) {
    await search(tx, account, {
      minutesAgo,
      filters: step.filters,
      blocked: step.blocked,
    });
    minutesAgo -= 5;
  }
}

beforeAll(async () => {
  await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// CA45: the refinement
// ---------------------------------------------------------------------------------------------

describe("L3F-T6 CA45, the refinement: six successive searches varying by one filter, two below k (10 RG68; modele §7)", () => {
  it("L3F-T6 raises at the sixth search, its count 6 and the date of the first; never a filter", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx);
      const brand = await newBrand(tx);
      await runSeries(tx, brand, SERIES);
      const [first] = await tx<{ at: Date }[]>`
        select min(created_at) as at from search.search_queries where account_id = ${brand}`;
      return { rows: await alertsOf(tx, [brand]), first: first?.at, brand };
    });
    expect(outcome.rows).toEqual([
      {
        subject_account_id: outcome.brand,
        cause: "refinement",
        observed: 6,
        since_at: outcome.first,
      },
    ]);
    const text = JSON.stringify(outcome.rows);
    expect(text).not.toMatch(/pets|food|MT|CY|F1|F6|F11/);
  });

  it("L3F-T6 raises nothing at the fifth search", async () => {
    const rows = await scenario(async (tx) => {
      await configure(tx);
      const brand = await newBrand(tx);
      await runSeries(tx, brand, SERIES.slice(0, 5));
      return alertsOf(tx, [brand]);
    });
    expect(rows).toEqual([]);
  });

  it("L3F-T6 raises nothing when one step varies two filters, or repeats the same search (exactly one facet)", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx);
      const twoFilters = await newBrand(tx);
      await runSeries(tx, twoFilters, [
        ...SERIES.slice(0, 5),
        // F1 and F11 change together
        {
          filters: { F1: "pets", F6: { country: "MT" }, F11: ["en"] },
          blocked: false,
        },
      ]);
      const repeated = await newBrand(tx);
      await runSeries(tx, repeated, [
        ...SERIES.slice(0, 5),
        { filters: SERIES[4]?.filters ?? {}, blocked: false },
      ]);
      return {
        twoFilters: await alertsOf(tx, [twoFilters]),
        repeated: await alertsOf(tx, [repeated]),
      };
    });
    expect(outcome.twoFilters).toEqual([]);
    expect(outcome.repeated).toEqual([]);
  });

  it("L3F-T6 counts new searches only (a later page is not one, the sort is ignored), and needs two below k", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx);
      const paged = await newBrand(tx);
      await runSeries(tx, paged, SERIES);
      // a page 2 and a page beyond the cap, between the last two: neither is a new search
      await search(tx, paged, {
        minutesAgo: 34,
        filters: { F2: ["x"] },
        page: 2,
      });
      await search(tx, paged, {
        minutesAgo: 33,
        filters: { F2: ["y"] },
        outcome: "page_cap",
        page: 6,
      });
      const sorted = await newBrand(tx);
      let minutesAgo = 60;
      for (const [index, step] of SERIES.entries()) {
        await search(tx, sorted, {
          minutesAgo,
          filters: step.filters,
          blocked: step.blocked,
          sort: index % 2 === 0 ? "default" : "audience",
        });
        minutesAgo -= 5;
      }
      const oneBlocked = await newBrand(tx);
      await runSeries(
        tx,
        oneBlocked,
        SERIES.map((step, index) => ({ ...step, blocked: index === 2 })),
      );
      const stale = await newBrand(tx);
      let ageMinutes = 25 * 60;
      for (const step of SERIES) {
        await search(tx, stale, {
          minutesAgo: ageMinutes,
          filters: step.filters,
          blocked: step.blocked,
        });
        ageMinutes -= 5;
      }
      const causes = async (account: string) =>
        (await alertsOf(tx, [account])).map((row) => row.cause);
      return {
        paged: await causes(paged),
        sorted: await causes(sorted),
        oneBlocked: await causes(oneBlocked),
        stale: await causes(stale),
      };
    });
    expect(outcome).toEqual({
      paged: ["refinement"],
      sorted: ["refinement"],
      oneBlocked: [],
      stale: [],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// CA46: the scraping
// ---------------------------------------------------------------------------------------------

describe("L3F-T6 CA46, the scraping: profiles opened over 24 h without a shortlist nor a request (10 RG68; modele §7; L3ES-3)", () => {
  it("L3F-T6 raises for an account that opened 150 profiles in 24 h without adding nor asking, with the thresholds of staging; 149 raise nothing", async () => {
    const outcome = await scenario(async (tx) => {
      // the thresholds as staging holds them: the row of the migration, untouched
      await tx`
        update search.search_settings
           set value = '{"perHour": 30, "perDay": 200, "profileOpensPerDay": 60}'::jsonb
         where key = 'rate_limits'`;
      await tx`delete from search.profile_openings`;
      const creators = await newCreators(tx, 150);
      const brand = await newBrand(tx);
      await open(tx, brand, creators.slice(0, 149));
      const under = await alertsOf(tx, [brand], "aspiration");
      await open(tx, brand, creators.slice(149));
      const reached = await alertsOf(tx, [brand], "aspiration");
      return { under, reached, brand };
    });
    expect(outcome.under).toEqual([]);
    expect(outcome.reached).toMatchObject([
      { subject_account_id: outcome.brand, cause: "aspiration", observed: 150 },
    ]);
  });

  it("L3F-T6 adds the creators opened by every such account (L3ES-3): one row per account, none below the threshold", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx, { ...STAGING, aspiration_profiles_24h: 5 });
      await tx`delete from search.profile_openings`;
      const [c1, c2, c3, c4, c5] = await newCreators(tx, 5);
      const one = await newBrand(tx);
      const two = await newBrand(tx);
      await open(tx, one, [c1, c2, c3]);
      await open(tx, two, [c3, c4], 30);
      const under = await alertsOf(tx, [one, two], "aspiration");
      await open(tx, two, [c5], 20);
      const reached = await alertsOf(tx, [one, two], "aspiration");
      return { under, reached, one, two };
    });
    expect(outcome.under).toEqual([]);
    expect(
      outcome.reached.map((row) => [row.subject_account_id, row.observed]),
    ).toEqual(
      [
        [outcome.one, 5],
        [outcome.two, 5],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
  });

  it("L3F-T6 falls for the account that adds to a shortlist or asks for a selection, not for an addition older than 24 h", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx, { ...STAGING, aspiration_profiles_24h: 3 });
      await tx`delete from search.profile_openings`;
      const [c1, c2, c3, c4, c5, c6] = await newCreators(tx, 6);
      const lister = await newBrand(tx);
      const asker = await newBrand(tx);
      const old = await newBrand(tx);
      await open(tx, lister, [c1, c2, c3]);
      await open(tx, asker, [c4, c5, c6]);
      await open(tx, old, [c1, c4, c6]);
      const accounts = [lister, asker, old];
      const causes = async () =>
        (await alertsOf(tx, accounts, "aspiration"))
          .map((row) => row.subject_account_id)
          .sort();
      const before = await causes();
      await addToShortlist(tx, lister, c1 as string);
      await addToShortlist(tx, old, c4 as string, 25 * 60);
      const afterList = await causes();
      await requestSelection(tx, asker);
      const afterRequest = await causes();
      return { before, afterList, afterRequest, lister, asker, old };
    });
    expect(outcome.before).toEqual(
      [outcome.lister, outcome.asker, outcome.old].sort(),
    );
    expect(outcome.afterList).toEqual([outcome.asker, outcome.old].sort());
    expect(outcome.afterRequest).toEqual([outcome.old]);
  });
});

// ---------------------------------------------------------------------------------------------
// AL21: the openings of a profile in the volume
// ---------------------------------------------------------------------------------------------

describe("L3F-T6 AL21 counts the openings of a profile (15 AL21; 10 RG63; modele §7)", () => {
  it("L3F-T6 counts DISTINCT creators served by a search or opened: one listed then opened is one", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx, { ...STAGING, distinct_profiles_served_24h: 2 });
      const [c1, c2, c3] = await newCreators(tx, 3);
      const brand = await newBrand(tx);
      await search(tx, brand, {
        minutesAgo: 40,
        filters: { F1: "pets" },
        creators: [c1 as string],
      });
      await open(tx, brand, [c1 as string, c2 as string], 30);
      const under = await alertsOf(tx, [brand]);
      await open(tx, brand, [c3 as string], 20);
      const over = await alertsOf(tx, [brand]);
      return { under, over };
    });
    expect(outcome.under).toEqual([]);
    expect(outcome.over).toMatchObject([
      { cause: "distinct_profiles_served", observed: 3 },
    ]);
  });

  it("L3F-T6 raises at 80 % of profileOpensPerDay (8 of 10), not at 7", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx, STAGING, { profileOpensPerDay: 10 });
      const creators = await newCreators(tx, 8);
      const brand = await newBrand(tx);
      await open(tx, brand, creators.slice(0, 7), 60);
      const under = await alertsOf(tx, [brand]);
      await open(tx, brand, creators.slice(7), 50);
      const reached = await alertsOf(tx, [brand]);
      return { under, reached };
    });
    expect(outcome.under).toEqual([]);
    expect(outcome.reached).toMatchObject([
      { cause: "open_cap_share_day", observed: 8 },
    ]);
  });

  it("L3F-T6 counts a refused opening as a refusal, beside a refused search", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx);
      const brand = await newBrand(tx);
      await open(tx, brand, [null], 90);
      const opening = await alertsOf(tx, [brand]);
      await search(tx, brand, { minutesAgo: 30, outcome: "rate_limited" });
      const both = await alertsOf(tx, [brand]);
      return { opening, both };
    });
    expect(outcome.opening).toMatchObject([
      { cause: "rate_limited", observed: 1 },
    ]);
    expect(outcome.both).toMatchObject([
      { cause: "rate_limited", observed: 2 },
    ]);
  });
});

// ---------------------------------------------------------------------------------------------
// The thresholds and the recipients
// ---------------------------------------------------------------------------------------------

describe("L3F-T6 the thresholds in table and the recipients (fiche invariant 4; 15 AL21)", () => {
  it("L3F-T6 adds the thresholds of CA45 and CA46 to AL21 for the admins; an absent or malformed threshold silences its cause, never an error", async () => {
    const outcome = await scenario(async (tx) => {
      const [row] = await tx<
        {
          threshold_value: Record<string, unknown>;
          recipient_roles: string[];
        }[]
      >`select threshold_value, recipient_roles from backoffice.alert_definitions
         where code = 'AL21'`;
      await configure(tx);
      await tx`delete from search.profile_openings`;
      const creators = await newCreators(tx, 2);
      const brand = await newBrand(tx);
      await runSeries(tx, brand, SERIES);
      await open(tx, brand, creators);
      await configure(tx, { ...STAGING, aspiration_profiles_24h: 2 });
      const up = (await alertsOf(tx, [brand])).map((r) => r.cause).sort();
      await configure(tx, {
        distinct_profiles_served_24h: STAGING.distinct_profiles_served_24h,
        rate_cap_share_bp: STAGING.rate_cap_share_bp,
        refinement_blocked: STAGING.refinement_blocked,
      });
      const silentAbsent = await alertsOf(tx, [brand]);
      await configure(tx, {
        ...STAGING,
        refinement_searches: 5.5,
        aspiration_profiles_24h: -1,
      });
      const silentMalformed = await alertsOf(tx, [brand]);
      return { row, up, silentAbsent, silentMalformed };
    });
    expect(outcome.row).toEqual({
      threshold_value: STAGING,
      recipient_roles: ["admin"],
    });
    expect(outcome.up).toEqual(["aspiration", "refinement"]);
    expect(outcome.silentAbsent).toEqual([]);
    expect(outcome.silentMalformed).toEqual([]);
  });

  it("L3F-T6 serves the admin the account, the cause, a count and a date only; an agent and a brand get 42501; the owner reads no name, note, message nor listed creator, and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await configure(tx, { ...STAGING, aspiration_profiles_24h: 1 });
      await tx`delete from search.profile_openings`;
      const [creator = ""] = await newCreators(tx, 1, true);
      const brand = await newBrand(tx);
      await runSeries(tx, brand, SERIES);
      await open(tx, brand, [creator]);
      const rows = await alertsOf(tx, [brand]);
      const [alias] = await tx<{ alias: string }[]>`
        select alias from profiles.creator_public_profiles where account_id = ${creator}`;
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
      const agent = await attempt(() =>
        actAsInternal(
          tx,
          "influx_agent",
          { accountId: agentA, role: "agent", aal: "aal2" },
          select,
        ),
      );
      const asBrand = await attempt(() =>
        actAsMember(
          tx,
          "influx_advertiser",
          { accountId: brand, role: "advertiser", aal: "aal1" },
          select,
        ),
      );
      const [owner] = await tx<{ forbidden_reads: boolean; writes: boolean }[]>`
        select (has_column_privilege(${OWNER}, 'search.shortlists', 'name', 'SELECT')
                or has_column_privilege(${OWNER}, 'search.shortlists', 'campaign_id', 'SELECT')
                or has_column_privilege(${OWNER}, 'search.shortlist_items', 'note', 'SELECT')
                or has_column_privilege(${OWNER}, 'search.shortlist_items', 'creator_account_id', 'SELECT')
                or has_column_privilege(${OWNER}, 'search.selection_requests', 'message', 'SELECT')
                or has_column_privilege(${OWNER}, 'search.selection_requests', 'filters', 'SELECT'))
                 as forbidden_reads,
               exists (select 1
                         from unnest(array['search.profile_openings', 'search.shortlists',
                                           'search.shortlist_items', 'search.selection_requests',
                                           'search.search_queries']::regclass[]) t
                        where has_table_privilege(${OWNER}, t, 'INSERT, UPDATE, DELETE, TRUNCATE')
                           or has_any_column_privilege(${OWNER}, t, 'INSERT, UPDATE')) as writes`;
      return { rows, alias: alias?.alias, creator, agent, asBrand, owner };
    });
    expect(outcome.rows.map((row) => row.cause).sort()).toEqual([
      "aspiration",
      "refinement",
    ]);
    for (const row of outcome.rows) {
      expect(Object.keys(row).sort()).toEqual([
        "cause",
        "observed",
        "since_at",
        "subject_account_id",
      ]);
    }
    const text = JSON.stringify(outcome.rows);
    expect(text).not.toContain(outcome.creator);
    expect(text).not.toContain(outcome.alias);
    expect(text).not.toMatch(/pets|food|MT|CY/);
    expect({ agent: outcome.agent, brand: outcome.asBrand }).toEqual({
      agent: INSUFFICIENT_PRIVILEGE,
      brand: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.owner).toEqual({ forbidden_reads: false, writes: false });
  });
});
