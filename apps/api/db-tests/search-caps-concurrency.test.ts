// L3G commit 02 — L3G-T2: the caps held by an advisory lock, under two COMMITTED connections
// (jalons/l3g/02.md; l3g-fiche.md invariants 1, 4, 15; L3FT-1 of the L3F review; 0323 §3.2, 0324 §3.7,
// 0325 §7, 0319 §4.2, all four redefined by 0327; D85 (1)).
// Every earlier test of these caps runs in ONE rolled-back transaction, where a lock never has a rival.
// Here two connections of the local superuser, each in a transaction of its own that COMMITS, call the
// same door of the same brand at the same time, the cap one line away:
//   - the 60th opening of the day (profileOpensPerDay) → one profile, one rate_limited;
//   - the 5th request to the team (requestsPerDay)     → one requested, one rate_limited;
//   - the 10th list (listsPerAccount)                   → one list, one 54000 shortlist_limit;
//   - the 25th item of a list (itemsPerList)            → one added, one 54000 shortlist_full;
//   - the last search of the hour (perHour)             → one page of results, one rate_limited.
// The rendezvous is not a sleep: a third connection holds the advisory lock of the account (the keys
// of 0327, in a transaction open all along, so that the connection is not closed as idle) until the
// backends of the two callers are seen waiting behind it (lockWaitersBehind), then lets go. Both
// callers have then passed every check that sits before the lock, and the lock alone decides. The
// journal lines are read back as the migration role: exact counts, the request identifier of each
// line, the one line of the refusal where the door writes one.
// Accounts, brands, creators and journal lines are this file's own (committed through
// campaign-routes-kit and creator-search-kit) and leave the stack when the file ends.
import { connectAsLocalSuperuser } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  openCampaignRouteFixtures,
  type CampaignRouteFixtures,
  type Member,
} from "./campaign-routes-kit.ts";
import {
  closeSearch,
  forgetSelections,
  HERE,
  openSearch,
  searchableCreators,
  type SearchCreator,
} from "./creator-search-kit.ts";
import { actAsMember, lockWaitersBehind, localSuperuser } from "./support.ts";

type Row = Record<string, unknown>;

/** What a door answered: its JSON, or the SQLSTATE and detail of its error (nothing committed). */
type Answer =
  | { kind: "answer"; answer: Row; request: string }
  | {
      kind: "error";
      code: string;
      detail: string | undefined;
      request: string;
    };

const LIMIT_EXCEEDED = "54000";

let fx: CampaignRouteFixtures;
/** The three connections the races use besides the probe: the holder of the lock and two callers. */
const holder = connectAsLocalSuperuser({ max: 1 });
const callers = [
  connectAsLocalSuperuser({ max: 1 }),
  connectAsLocalSuperuser({ max: 1 }),
] as const;

/** The caps in table when the file starts (the cases adapt to them, they never write them). */
let caps: {
  profileOpensPerDay: number;
  perHour: number;
  listsPerAccount: number;
  itemsPerList: number;
  requestsPerDay: number;
  k: number;
  pageSize: number;
};
/** Creators published and searchable in the audience country of the kit: enough for k and a page. */
let pool: SearchCreator[];
/** Every brand of the file, whose lines leave the stack when it ends. */
const brands: Member[] = [];

beforeAll(async () => {
  fx = await openCampaignRouteFixtures();
  const [row] = await fx.migration<Row[]>`
    select (select value from search.search_settings where key = 'rate_limits') as rate,
           (select value from search.search_settings where key = 'selection_limits') as selection,
           (select (value)::integer from search.search_settings
             where key = 'k_anonymity_threshold') as k,
           (select (value)::integer from search.search_settings where key = 'page_size') as page_size`;
  const rate = row?.rate as { perHour: number; profileOpensPerDay: number };
  const selection = row?.selection as {
    listsPerAccount: number;
    itemsPerList: number;
    requestsPerDay: number;
  };
  caps = {
    profileOpensPerDay: rate.profileOpensPerDay,
    perHour: rate.perHour,
    listsPerAccount: selection.listsPerAccount,
    itemsPerList: selection.itemsPerList,
    requestsPerDay: selection.requestsPerDay,
    k: row?.k as number,
    pageSize: row?.page_size as number,
  };
  await openSearch(fx);
  pool = await searchableCreators(fx, Math.max(caps.k + 1, 3));
});

afterAll(async () => {
  await Promise.all([holder, ...callers].map((sql) => sql.end({ timeout: 1 })));
  if (fx === undefined) {
    return;
  }
  const ids = brands.map((brand) => brand.accountId);
  if (ids.length > 0) {
    // the journal is append-only for the influx_% roles alone: the migration role removes its lines
    // (the impressions, their reasons and the openings of origin cascade with their search)
    await fx.migration.begin(async (tx) => {
      await tx`delete from search.search_queries where account_id = any(${ids}::uuid[])`;
      await tx`delete from search.profile_openings where account_id = any(${ids}::uuid[])`;
    });
    await forgetSelections(fx, brands);
  }
  await closeSearch(fx);
  await fx.close();
});

// the fixtures ------------------------------------------------------------------------------------

/** A brand, committed, with a published profile (RG1). */
async function newBrand(): Promise<Member> {
  const brand = await fx.newMember("advertiser");
  await fx.setProfileStatus(brand, "published");
  brands.push(brand);
  return brand;
}

/** `count` served openings of `brand`, `ago` in the past (the bucket of the door counts them). */
async function giveOpenings(
  brand: Member,
  creator: SearchCreator,
  count: number,
  ago: string,
): Promise<void> {
  await fx.migration`
    insert into search.profile_openings (account_id, outcome, creator_account_id, created_at)
    select ${brand.accountId}, 'served', ${creator.accountId}, now() - ${ago}::interval
      from pg_catalog.generate_series(1, ${count}::int)`;
}

/** `count` served searches of `brand`, `ago` in the past (the bucket of the search counts them). */
async function giveSearches(
  brand: Member,
  count: number,
  ago: string,
): Promise<void> {
  await fx.migration`
    insert into search.search_queries
      (account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
       result_count, page_reached, blocked_by_k_anonymity, created_at)
    select ${brand.accountId}, 'advertiser', 'advertiser_anonymous', 'served', '{}'::jsonb,
           'default', (select max(version) from search.facet_config_versions), 0, 1, false,
           now() - ${ago}::interval
      from pg_catalog.generate_series(1, ${count}::int)`;
}

// the doors ---------------------------------------------------------------------------------------

const DOOR = {
  open: "select search.open_creator_profile($1::text) as answer",
  request:
    "select search.request_team_selection($1::text::jsonb, $2::uuid, $3::text) as answer",
  createList: "select search.create_shortlist($1::text, $2::uuid) as answer",
  add: "select search.add_to_shortlist($1::uuid, $2::text) as answer",
  search:
    "select search.search_creators($1::text::jsonb, $2::text, $3::integer, $4::uuid) as answer",
} as const;

/**
 * One call of a door as apps/api makes it, on the connection `sql`: its own transaction, under a
 * request identifier of its own, the brand's role and context; COMMITTED when the door answers, rolled
 * back when it raises (the SQLSTATE and detail are then the answer).
 */
async function call(
  sql: postgres.Sql,
  brand: Member,
  statement: string,
  parameters: readonly unknown[],
): Promise<Answer> {
  const request = `l3g-t2-${randomUUID()}`;
  try {
    const rows = await sql.begin(async (tx) => {
      await tx`select pg_catalog.set_config('influx.request_id', ${request}, true)`;
      return actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brand.accountId, role: "advertiser", aal: "aal1" },
        () =>
          tx.unsafe<{ answer: Row }[]>(
            statement,
            parameters.map(
              (value) => value ?? null,
            ) as postgres.ParameterOrJSON<never>[],
          ),
      );
    });
    return { kind: "answer", answer: rows[0]?.answer ?? {}, request };
  } catch (error) {
    const found = error as { code?: string; detail?: string };
    if (found.code === undefined) {
      throw error;
    }
    return { kind: "error", code: found.code, detail: found.detail, request };
  }
}

/** The JSON a door answered; an error is no answer. */
function bodyOf(answer: Answer): Row {
  if (answer.kind !== "answer") {
    throw new Error(`${answer.code} ${answer.detail ?? ""}`);
  }
  return answer.answer;
}

/** The state of an answer, or `error <code> <detail>`. */
function stateOf(answer: Answer): string {
  return answer.kind === "answer"
    ? String(answer.answer.state)
    : `error ${answer.code} ${answer.detail ?? ""}`.trim();
}

/** A door called on a connection of its own, one after the other, to bring an account to its cap. */
async function callNow(
  brand: Member,
  statement: string,
  parameters: readonly unknown[],
): Promise<Answer> {
  const answer = await call(callers[0], brand, statement, parameters);
  expect(answer.kind, JSON.stringify(answer)).toBe("answer");
  return answer;
}

/**
 * Two calls in parallel, each on its own connection, once the advisory lock `key` is held elsewhere
 * (a third connection, in a transaction open all along) and both backends are seen waiting for it.
 * `waiting` is the number of backends seen behind the holder: 2, or the rendezvous failed.
 */
async function race(
  key: string,
  runs: readonly [
    (sql: postgres.Sql) => Promise<Answer>,
    (sql: postgres.Sql) => Promise<Answer>,
  ],
): Promise<{ answers: Answer[]; waiting: number }> {
  let pending: Promise<Answer>[] = [];
  let waiting = 0;
  await holder.begin(async (held) => {
    await held`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${key}, 0))`;
    const [self] = await held<
      { pid: number }[]
    >`select pg_backend_pid() as pid`;
    pending = runs.map((run, index) => run(callers[index] as postgres.Sql));
    waiting = await lockWaitersBehind(localSuperuser(), self?.pid ?? 0, 2);
  });
  return { answers: await Promise.all(pending), waiting };
}

/** The two answers, the served one first: `[served, refused]`, whichever call won the lock. */
function byState(
  answers: readonly Answer[],
  served: string,
): { served: Answer; refused: Answer } {
  const winner = answers.find((answer) => stateOf(answer) === served);
  const loser = answers.find((answer) => answer !== winner);
  if (winner === undefined || loser === undefined) {
    throw new Error(
      `no ${served} among ${JSON.stringify(answers.map(stateOf))}`,
    );
  }
  return { served: winner, refused: loser };
}

/** The whole seconds a refusal says to wait (the cases bound it by the date of the oldest line). */
function retryOf(answer: Answer): number {
  const value = bodyOf(answer).retryAfterSeconds;
  expect(typeof value).toBe("number");
  return value as number;
}

// the cases ---------------------------------------------------------------------------------------

describe("L3G-T2 the caps held by an advisory lock, under two committed connections (0327; L3FT-1, D85)", () => {
  it("L3G-T2 the last opening of the day: two openings in parallel at the cap less one, one profile and one rate_limited, the 60th line and the one line of the refusal exact", async () => {
    const brand = await newBrand();
    const subject = pool[0] as SearchCreator;
    await giveOpenings(brand, subject, caps.profileOpensPerDay - 1, "2 hours");
    const { answers, waiting } = await race(
      `search.profile_openings:${brand.accountId}`,
      [
        (sql) => call(sql, brand, DOOR.open, [subject.alias]),
        (sql) => call(sql, brand, DOOR.open, [subject.alias]),
      ],
    );
    expect(waiting).toBe(2);
    const { served, refused } = byState(answers, "profile");
    const retry = retryOf(refused);
    // the oldest line of the day leaves the 24 h two hours from its date: 22 h, minus the test's time
    expect(retry).toBeGreaterThan(22 * 3600 - 120);
    expect(retry).toBeLessThanOrEqual(22 * 3600);
    expect(Object.keys(bodyOf(refused)).sort()).toEqual([
      "retryAfterSeconds",
      "state",
    ]);
    const lines = await fx.migration<Row[]>`
      select o.outcome, o.creator_account_id::text as creator, o.search_query_id is not null as origin,
             o.request_id as request
        from search.profile_openings o
       where o.account_id = ${brand.accountId} and o.request_id is not null
       order by o.created_at, o.id`;
    expect(lines).toHaveLength(2);
    expect(lines).toEqual(
      expect.arrayContaining([
        {
          outcome: "served",
          creator: subject.accountId,
          origin: false,
          request: served.request,
        },
        {
          outcome: "rate_limited",
          creator: null,
          origin: false,
          request: refused.request,
        },
      ]),
    );
    const [counted] = await fx.migration<{ served: number; refused: number }[]>`
      select (count(*) filter (where outcome = 'served'))::int as served,
             (count(*) filter (where outcome = 'rate_limited'))::int as refused
        from search.profile_openings where account_id = ${brand.accountId}`;
    expect(counted).toEqual({ served: caps.profileOpensPerDay, refused: 1 });
  });

  it("L3G-T2 the last request to the team of the day: two requests in parallel at the cap less one, one requested and one rate_limited, the cap's lines and their register lines exact, the refusal writing none", async () => {
    const brand = await newBrand();
    const message = "Twelve creators, please.";
    const deposited: string[] = [];
    for (let index = 1; index < caps.requestsPerDay; index += 1) {
      const filled = await callNow(brand, DOOR.request, [
        JSON.stringify(HERE),
        null,
        `${message} ${index}`,
      ]);
      expect(stateOf(filled)).toBe("requested");
      deposited.push(filled.request);
    }
    const { answers, waiting } = await race(
      `search.selection_requests:${brand.accountId}`,
      [
        (sql) =>
          call(sql, brand, DOOR.request, [JSON.stringify(HERE), null, message]),
        (sql) =>
          call(sql, brand, DOOR.request, [JSON.stringify(HERE), null, message]),
      ],
    );
    expect(waiting).toBe(2);
    const { served, refused } = byState(answers, "requested");
    const retry = retryOf(refused);
    // the oldest request leaves the 24 h a day after its deposit, a few seconds ago
    expect(retry).toBeGreaterThan(24 * 3600 - 120);
    expect(retry).toBeLessThanOrEqual(24 * 3600);
    const lines = await fx.migration<Row[]>`
      select r.id::text as id, r.state::text as state
        from search.selection_requests r
       where r.advertiser_account_id = ${brand.accountId}`;
    expect(lines).toHaveLength(caps.requestsPerDay);
    expect(lines.every((line) => line.state === "open")).toBe(true);
    const register = await fx.migration<{ subject_id: string }[]>`
      select e.subject_id::text as subject_id
        from audit.audit_events e
       where e.event_type = 'search.selection_requested' and e.actor_account_id = ${brand.accountId}`;
    expect(register.map((line) => line.subject_id).sort()).toEqual(
      lines.map((line) => String(line.id)).sort(),
    );
    expect(served.kind).toBe("answer");
    expect(deposited).toHaveLength(caps.requestsPerDay - 1);
  });

  it("L3G-T2 the last list of an account: two lists created in parallel at the cap less one, one list and one 54000 shortlist_limit, the cap's lines exact, the refused name written nowhere", async () => {
    const brand = await newBrand();
    for (let index = 1; index < caps.listsPerAccount; index += 1) {
      const filled = await callNow(brand, DOOR.createList, [
        `List ${index}`,
        null,
      ]);
      expect(stateOf(filled)).toBe("shortlist");
    }
    const { answers, waiting } = await race(
      `search.shortlists:${brand.accountId}`,
      [
        (sql) => call(sql, brand, DOOR.createList, ["Race A", null]),
        (sql) => call(sql, brand, DOOR.createList, ["Race B", null]),
      ],
    );
    expect(waiting).toBe(2);
    const { served, refused } = byState(answers, "shortlist");
    expect(stateOf(refused)).toBe(`error ${LIMIT_EXCEEDED} shortlist_limit`);
    const named = (bodyOf(served).shortlist as { name: string }).name;
    expect(["Race A", "Race B"]).toContain(named);
    const lines = await fx.migration<{ name: string }[]>`
      select s.name from search.shortlists s
       where s.advertiser_account_id = ${brand.accountId}
       order by s.created_at, s.id`;
    expect(lines).toHaveLength(caps.listsPerAccount);
    expect(lines.filter((line) => line.name.startsWith("Race"))).toEqual([
      { name: named },
    ]);
  });

  it("L3G-T2 the last item of a list: two creators added in parallel at the cap less one, one added and one 54000 shortlist_full, the cap's lines exact, the refused creator absent", async () => {
    const brand = await newBrand();
    const racers = [pool[0], pool[1]] as [SearchCreator, SearchCreator];
    // the two creators of the race were served to the brand (an opening each): EC-L3F-04-1
    await giveOpenings(brand, racers[0], 1, "1 hour");
    await giveOpenings(brand, racers[1], 1, "1 hour");
    const made = await callNow(brand, DOOR.createList, ["Full soon", null]);
    const listId = (bodyOf(made).shortlist as { id: string }).id;
    // the list holds every row but one; the bound counts the hidden ones too (modele §5, D85)
    for (let index = 1; index < caps.itemsPerList; index += 1) {
      const filler = await fx.newMember("creator");
      await fx.migration`
        insert into search.shortlist_items (shortlist_id, creator_account_id)
        values (${listId}, ${filler.accountId})`;
    }
    const { answers, waiting } = await race(
      `search.shortlists:${brand.accountId}`,
      [
        (sql) => call(sql, brand, DOOR.add, [listId, racers[0].alias]),
        (sql) => call(sql, brand, DOOR.add, [listId, racers[1].alias]),
      ],
    );
    expect(waiting).toBe(2);
    const { refused } = byState(answers, "added");
    expect(stateOf(refused)).toBe(`error ${LIMIT_EXCEEDED} shortlist_full`);
    const items = await fx.migration<{ creator: string }[]>`
      select i.creator_account_id::text as creator from search.shortlist_items i
       where i.shortlist_id = ${listId}`;
    expect(items).toHaveLength(caps.itemsPerList);
    const present = racers.filter((racer) =>
      items.some((item) => item.creator === racer.accountId),
    );
    expect(present).toHaveLength(1);
  });

  it("L3G-T2 the last search of the hour: two searches in parallel at the cap less one, one page of results and one rate_limited, the cap's lines, the one line of the refusal and the impressions of the search served exact", async () => {
    const brand = await newBrand();
    await giveSearches(brand, caps.perHour - 1, "30 minutes");
    const { answers, waiting } = await race(
      `search.search_queries:${brand.accountId}`,
      [
        (sql) =>
          call(sql, brand, DOOR.search, [
            JSON.stringify(HERE),
            "default",
            1,
            null,
          ]),
        (sql) =>
          call(sql, brand, DOOR.search, [
            JSON.stringify(HERE),
            "default",
            1,
            null,
          ]),
      ],
    );
    expect(waiting).toBe(2);
    const { served, refused } = byState(answers, "results");
    const retry = retryOf(refused);
    // the oldest search of the hour leaves it half an hour from now, less the test's time
    expect(retry).toBeGreaterThan(30 * 60 - 120);
    expect(retry).toBeLessThanOrEqual(30 * 60);
    const lines = await fx.migration<Row[]>`
      select q.id::text as id, q.outcome, q.filters, q.result_count as count, q.page_reached as page,
             q.campaign_id::text as campaign, q.blocked_by_k_anonymity as blocked,
             q.request_id as request
        from search.search_queries q
       where q.account_id = ${brand.accountId} and q.request_id is not null
       order by q.created_at, q.id`;
    expect(lines).toHaveLength(2);
    const won = lines.find((line) => line.request === served.request);
    const lost = lines.find((line) => line.request === refused.request);
    expect(won).toEqual({
      id: expect.any(String),
      outcome: "served",
      filters: HERE,
      count: pool.length,
      page: 1,
      campaign: null,
      blocked: false,
      request: served.request,
    });
    expect(lost).toEqual({
      id: expect.any(String),
      outcome: "rate_limited",
      filters: {},
      count: 0,
      page: 1,
      campaign: null,
      blocked: false,
      request: refused.request,
    });
    const [counted] = await fx.migration<{ served: number; refused: number }[]>`
      select (count(*) filter (where outcome = 'served'))::int as served,
             (count(*) filter (where outcome = 'rate_limited'))::int as refused
        from search.search_queries where account_id = ${brand.accountId}`;
    expect(counted).toEqual({ served: caps.perHour, refused: 1 });
    const [impressions] = await fx.migration<{ n: number; other: number }[]>`
      select (count(*) filter (where search_query_id = ${String(won?.id)}))::int as n,
             (count(*) filter (where search_query_id <> ${String(won?.id)}))::int as other
        from search.search_impressions
       where search_query_id in (select id from search.search_queries
                                  where account_id = ${brand.accountId})`;
    expect(impressions).toEqual({
      n: Math.min(pool.length, caps.pageSize),
      other: 0,
    });
  });
});
