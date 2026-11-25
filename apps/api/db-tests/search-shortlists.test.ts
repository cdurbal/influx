// L3F commit 04 — the brand's shortlists through the alias, 0324 (jalons/l3f/04.md; l3f-fiche.md
// invariants 2, 4, 6, 7, 10, 15; jalons/l3f/modele.md §1, §5; 10 RG4, RG8, RG51, RG63, CA49, CA52,
// CA64; D45).
//   L3F-T4  the eight doors and their six helpers in the catalogue (EXECUTE for the brand alone, invoker
//           helpers, no dynamic statement, nothing of the outbox, matching nor a campaign table), the
//           rights of their owner and none for a member (T2, 42501 direct); the gate (42501, RG1, the
//           switch); an unknown alias answers as an excluded one; another brand's list as an unknown
//           one; a campaign of another brand or not admitted; the bounds (listsPerAccount, itemsPerList,
//           the name, the note); a hidden creator masked then back; CA52 (nothing to the creator, the
//           outbox, audit nor matching).
//   L3G-T1  (L3G commit 01, 0327; L3FS-2, L3FS-3, D85) a hidden creator no longer removed through its
//           alias; THE engine run once by add, note and remove for an alias known or unknown (the
//           calls of the transaction, track_functions = 'pl'), before the lock of the account; that
//           lock waited 1 s at most by the six writes (55P03), the caller's lock_timeout given back.
// Each case runs in a rolled-back transaction of the local superuser, which sets aside the storefronts
// of earlier runs sharing this file's audience country, opens the switch (D38: closed by default),
// writes its fixtures outside the guards, and acts as apps/api does (influx_app, then the brand's role
// and context). L3G-T1 holds the lock of an account from a second connection (its own
// transaction: nothing committed).
import {
  accountIdOf,
  connectAsLocalSuperuser,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  putCampaignInState,
  type CampaignState,
} from "./campaign-publication-kit.ts";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
type Parameter = postgres.ParameterOrJSON<never> | null | undefined;

const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

const agentA = accountIdOf("agent", "a");

const OWNER = "influx_creator_search_definer";

/** The audience country of this file's storefronts. */
const COUNTRY = "MT";

const DOORS = {
  create: "select search.create_shortlist($1::text, $2::uuid) as answer",
  update:
    "select search.update_shortlist($1::uuid, $2::text, $3::uuid) as answer",
  delete: "select search.delete_shortlist($1::uuid) as answer",
  add: "select search.add_to_shortlist($1::uuid, $2::text) as answer",
  note: "select search.set_shortlist_note($1::uuid, $2::text, $3::text) as answer",
  remove: "select search.remove_from_shortlist($1::uuid, $2::text) as answer",
  list: "select search.list_shortlists() as answer",
  read: "select search.read_shortlist($1::uuid) as answer",
} as const;
type Door = keyof typeof DOORS;

const DOOR_SIGNATURES = [
  "search.add_to_shortlist(uuid,text)",
  "search.create_shortlist(text,uuid)",
  "search.delete_shortlist(uuid)",
  "search.list_shortlists()",
  "search.read_shortlist(uuid)",
  "search.remove_from_shortlist(uuid,text)",
  "search.set_shortlist_note(uuid,text,text)",
  "search.update_shortlist(uuid,text,uuid)",
];
const HELPER_SIGNATURES = [
  "search.anonymous_card(uuid)",
  "search.check_shortlist_name(text)",
  "search.selection_limit(text)",
  "search.shortlist_creator(uuid,text,uuid)",
  "search.shortlist_gate()",
  "search.shortlist_summaries(uuid,uuid)",
];

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | {
      outcome: "error";
      code: string;
      detail: string | undefined;
      message: string;
    };

type Summary = {
  id: string;
  name: string;
  campaignId: string | null;
  count: number;
  createdAt: string;
};

type Item = {
  creator: Row & { alias: string };
  note: string | null;
  addedAt: string;
};

type Answer = {
  state: string;
  shortlist?: Summary;
  shortlists?: Summary[];
  items?: Item[];
  creator?: Row;
};

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, detail and message. */
async function run<T = Row>(
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
    const found = error as { code?: string; detail?: string; message?: string };
    if (found.code === undefined) throw error;
    return {
      outcome: "error",
      code: found.code,
      detail: found.detail,
      message: found.message ?? "",
    };
  }
}

function errorOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error"
    ? `${outcome.code} ${outcome.detail ?? ""}`.trim()
    : "ok";
}

/** An answer as the API would read it, every byte of it (CA49). */
function bytesOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error"
    ? JSON.stringify({
        code: outcome.code,
        detail: outcome.detail,
        message: outcome.message,
      })
    : JSON.stringify(outcome.rows);
}

/** A rolled-back transaction: the file's country set aside, the switch open. */
function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    await tx`
      update profiles.creator_public_profiles set is_searchable = false
       where main_audience_country = ${COUNTRY} and is_searchable`;
    await setting(tx, "is_open_to_advertisers", true);
    return fn(tx);
  });
}

beforeAll(async () => {
  await testDataSet();
});

// the fixtures ------------------------------------------------------------------------------------

async function setting(tx: Tx, key: string, value: unknown): Promise<void> {
  await tx`update search.search_settings set value = ${JSON.stringify(value)}::text::jsonb
            where key = ${key}`;
}

async function limits(
  tx: Tx,
  listsPerAccount: number,
  itemsPerList: number,
): Promise<void> {
  await setting(tx, "selection_limits", {
    listsPerAccount,
    itemsPerList,
    requestsPerDay: 5,
  });
}

async function newAccount(
  tx: Tx,
  role: "creator" | "advertiser",
  options: { adult?: boolean; status?: "active" | "suspended" } = {},
): Promise<string> {
  const id = randomUUID();
  const adult = options.adult ?? true;
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3f-t4-${id}@example.test`}, now(), 'FR', 'fr',
            'L3F T4 Person', ${adult}, case when ${adult}::boolean then now() end,
            ${role === "creator" ? "individual" : "business"})`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, ${role})`;
  if (options.status === "suspended") {
    await tx`update identity.accounts set status = 'suspended', suspended_at = now()
              where id = ${id}`;
  }
  return id;
}

type BrandSpec = {
  status?: "draft" | "pending_review" | "published" | "rejected" | "suspended";
  account?: "active" | "suspended";
};

/** A brand whose profile is published by default (10 RG1), in the sector sports_leisure. */
async function newBrand(tx: Tx, spec: BrandSpec = {}): Promise<string> {
  const id = await newAccount(tx, "advertiser", { status: spec.account });
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3F T4 Brand', 'sports_leisure', '11_50',
            ${`l3f-t4-${id.slice(0, 8)}.example`},
            'A brand of the L3F tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  const status = spec.status ?? "published";
  if (status !== "draft") {
    await tx`update profiles.advertiser_profiles
                set status = ${status}::profiles.advertiser_profile_status
              where account_id = ${id}`;
  }
  return id;
}

/** A campaign of `brand` in `state`, its sector given, its targeted audience in this file's country. */
async function newCampaign(
  tx: Tx,
  brand: string,
  sector: string,
  state: CampaignState = "pending_review",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns (advertiser_account_id, sector_code)
    values (${brand}, ${sector}) returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  await tx`insert into campaigns.campaign_audience_countries (campaign_id, slot, country_code)
           values (${row.id}, 1, ${COUNTRY})`;
  await putCampaignInState(tx, row.id, state);
  return row.id;
}

type CreatorSpec = {
  status?: "published" | "draft";
  searchable?: boolean;
  account?: "active" | "suspended";
  adult?: boolean;
  refused?: string[];
};

type Creator = { id: string; alias: string; handle: string };

/** A creator and its storefront, published, searchable, its main audience in the file's country. */
async function newCreator(tx: Tx, spec: CreatorSpec = {}): Promise<Creator> {
  const id = await newAccount(tx, "creator", {
    adult: spec.adult,
    status: spec.account,
  });
  await tx`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')`;
  const handle = `l3f_t4_${id.slice(0, 8)}`;
  const [line] = await tx<{ id: string }[]>`
    insert into profiles.creator_social_accounts
      (account_id, network_code, is_primary, handle, followers_count, posts_last_30_days,
       avg_comments_per_post, figures_measured_at)
    values (${id}, 'instagram', true, ${handle}, 47312, 12, 30, now())
    returning id::text`;
  if (line === undefined) throw new Error("no line");
  await tx`update profiles.creator_public_networks set listed_at = now()
            where social_account_id = ${line.id}`;
  await tx`insert into profiles.creator_publication_languages (account_id, slot, language_code)
           values (${id}, 1, 'fr')`;
  for (const sector of spec.refused ?? []) {
    await tx`insert into profiles.creator_refused_sectors (account_id, sector_code)
             values (${id}, ${sector})`;
  }
  const status = spec.status ?? "published";
  const [row] = await tx<{ alias: string }[]>`
    update profiles.creator_public_profiles
       set status = ${status}::profiles.creator_profile_status,
           published_at = case when ${status} = 'published' then now() - interval '40 days' end,
           is_searchable = ${spec.searchable ?? true},
           primary_topic_code = 'pets',
           main_audience_country = ${COUNTRY},
           main_audience_share_band = 'ge_80'
     where account_id = ${id}
     returning alias`;
  if (row === undefined) throw new Error("no storefront");
  return { id, alias: row.alias, handle };
}

const BLOCK_REASON = "t_four_block";

/** An active block of the pair, posed by the brand (no gesture at Lot 3: the superuser writes it). */
async function giveBlock(
  tx: Tx,
  brand: string,
  creator: Creator,
): Promise<void> {
  await tx`
    insert into matching.block_reasons (code, label_key, available_to_side)
    values (${BLOCK_REASON}, ${`block.reason.${BLOCK_REASON}`}, 'any')
    on conflict (code) do nothing`;
  await tx`
    insert into matching.party_blocks
      (advertiser_account_id, creator_account_id, blocked_by_account_id, blocked_by_side,
       reason_code, comment)
    values (${brand}, ${creator.id}, ${brand}, 'advertiser', ${BLOCK_REASON}, 'L3F T4 why')`;
}

async function liftBlock(
  tx: Tx,
  brand: string,
  creator: Creator,
): Promise<void> {
  await tx`update matching.party_blocks set lifted_at = now(), lifted_by_account_id = ${brand}
            where advertiser_account_id = ${brand} and creator_account_id = ${creator.id}
              and lifted_at is null`;
}

/** A served search of `brand` journaled `ago` in the past, with an impression of each creator. */
async function serve(
  tx: Tx,
  brand: string,
  creators: readonly Creator[],
  ago = "1 hour",
): Promise<void> {
  const id = randomUUID();
  await tx`
    insert into search.search_queries
      (id, account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
       result_count, page_reached, created_at)
    values (${id}, ${brand}, 'advertiser', 'advertiser_anonymous', 'served',
            ${JSON.stringify({ F6: { country: COUNTRY } })}::text::jsonb, 'default',
            (select max(version) from search.facet_config_versions), 5, 1, now() - ${ago}::interval)`;
  let rank = 1;
  for (const creator of creators) {
    await tx`
      insert into search.search_impressions (search_query_id, creator_account_id, rank)
      values (${id}, ${creator.id}, ${rank})`;
    rank += 1;
  }
}

/** `count` creators, each already served to `brand` by one search. */
async function servedCreators(
  tx: Tx,
  brand: string,
  count: number,
  spec: CreatorSpec = {},
): Promise<Creator[]> {
  const creators: Creator[] = [];
  for (let index = 0; index < count; index += 1) {
    creators.push(await newCreator(tx, spec));
  }
  await serve(tx, brand, creators);
  return creators;
}

// the doors ---------------------------------------------------------------------------------------

function asBrand<T>(tx: Tx, brand: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: brand, role: "advertiser", aal: "aal1" },
    fn,
  );
}

/** One door as apps/api calls it for `brand`: its outcome. */
function call(
  tx: Tx,
  brand: string,
  door: Door,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<{ answer: Answer }>> {
  return asBrand(tx, brand, () =>
    run<{ answer: Answer }>(tx, DOORS[door], parameters),
  );
}

function answerOf(outcome: Outcome<{ answer: Answer }>): Answer {
  return outcome.outcome === "rows"
    ? (outcome.rows[0]?.answer ?? { state: "none" })
    : { state: `error ${errorOf(outcome)}` };
}

async function door(
  tx: Tx,
  brand: string,
  name: Door,
  parameters: readonly Parameter[] = [],
): Promise<Answer> {
  return answerOf(await call(tx, brand, name, parameters));
}

/** A new list of `brand`, its id. */
async function newList(
  tx: Tx,
  brand: string,
  name = "My list",
  campaign: string | null = null,
): Promise<string> {
  const answer = await door(tx, brand, "create", [name, campaign]);
  const id = answer.shortlist?.id;
  if (id === undefined) throw new Error(`no list: ${answer.state}`);
  return id;
}

async function aliasesOf(
  tx: Tx,
  brand: string,
  list: string,
): Promise<string[]> {
  const answer = await door(tx, brand, "read", [list]);
  return (answer.items ?? []).map((item) => item.creator.alias);
}

// L3G-T1 (0327): THE engine counted, the lock of an account held from elsewhere

const ENGINE = "search.creator_candidates(text,uuid,jsonb,uuid)";

/** A second connection of the local superuser: it holds the lock of an account, nothing committed. */
const holder = connectAsLocalSuperuser({ max: 1 });
afterAll(async () => {
  await holder.end({ timeout: 1 });
});

/** Counts the calls of the PL/pgSQL functions of this transaction (a superuser's setting). */
async function trackFunctions(tx: Tx): Promise<void> {
  await tx`set local track_functions = 'pl'`;
}

/** The calls of THE engine made by `fn`, read from the statistics of the transaction. */
async function engineRuns(tx: Tx, fn: () => Promise<unknown>): Promise<number> {
  const calls = async (): Promise<number> => {
    const [row] = await tx<{ n: number }[]>`
      select coalesce(pg_catalog.pg_stat_get_xact_function_calls(${ENGINE}::regprocedure), 0)::int
               as n`;
    return row?.n ?? 0;
  };
  const before = await calls();
  await fn();
  return (await calls()) - before;
}

/**
 * Runs `fn` while the second connection holds the advisory lock `key` in a transaction of its own,
 * open all along (an idle connection would be closed, its lock with it), which writes nothing.
 */
async function holdingLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  let result: T | undefined;
  await holder.begin(async (held) => {
    await held`select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(${key}, 0))`;
    result = await fn();
  });
  return result as T;
}

async function rowsOf(tx: Tx, brand: string): Promise<Row> {
  const [row] = await tx<Row[]>`
    select (select count(*)::int from search.shortlists
             where advertiser_account_id = ${brand}) as lists,
           (select count(*)::int from search.shortlist_items i
              join search.shortlists s on s.id = i.shortlist_id
             where s.advertiser_account_id = ${brand}) as items`;
  return row ?? {};
}

// the cases ---------------------------------------------------------------------------------------

describe("L3F-T4 the doors, their helpers and the rights in the catalogue (03 P7; fiche invariants 4, 6)", () => {
  it("L3F-T4 makes the eight doors SECURITY DEFINER of the owner, executable by influx_advertiser alone, the six helpers invoker executed by nobody, all with an empty search_path, no dynamic statement, nothing of the outbox, matching, messaging, audit nor a campaign table", async () => {
    const functions = await scenario(
      (tx) => tx<Row[]>`
        select p.oid::regprocedure::text as name, pg_catalog.pg_get_userbyid(p.proowner) as owner,
               p.prosecdef as definer, p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                              pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers,
               p.prosrc ~* '\\mexecute\\M|query_to_xml|dblink' as dynamic,
               p.prosrc ~* '\\m(leads|matching|messaging|audit|campaigns)\\s*\\.|outbox'
                 as forbidden,
               p.prosrc ~* 'creator_identities|creator_social_accounts|creator_audience_'
                           '|creator_network_metrics_history|\\m"?storage"?\\s*\\.' as layer_i
          from pg_catalog.pg_proc p
         where p.oid::regprocedure::text = any(${[...DOOR_SIGNATURES, ...HELPER_SIGNATURES]})
         order by p.oid::regprocedure::text collate "C"`,
    );
    const fn = (name: string, definer: boolean): Row => ({
      name,
      owner: OWNER,
      definer,
      config: ['search_path=""'],
      callers: definer ? ["influx_advertiser"] : [],
      dynamic: false,
      forbidden: false,
      layer_i: false,
    });
    expect(functions).toEqual(
      [
        ...DOOR_SIGNATURES.map((name) => fn(name, true)),
        ...HELPER_SIGNATURES.map((name) => fn(name, false)),
      ].sort((a, b) => ((a.name as string) < (b.name as string) ? -1 : 1)),
    );
  });

  it("L3F-T4 T2: the owner reads and writes the caller's lists column by column, reads the creator of its openings; no execution role holds a right on the lists; the brand reaches neither the tables nor a helper (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      const owner = await tx<{ name: string }[]>`
        select c.relname || '.' || at.attname || ' ' ||
               case when has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'SELECT')
                    then 'S' else '' end ||
               case when has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'INSERT')
                    then 'I' else '' end ||
               case when has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'UPDATE')
                    then 'U' else '' end as name
          from pg_catalog.pg_attribute at
          join pg_catalog.pg_class c on c.oid = at.attrelid
         where at.attrelid in ('search.shortlists'::regclass, 'search.shortlist_items'::regclass)
           and at.attnum > 0 and not at.attisdropped
         order by 1`;
      const [deletes] = await tx<Row[]>`
        select has_table_privilege(${OWNER}, 'search.shortlists', 'DELETE') as lists,
               has_table_privilege(${OWNER}, 'search.shortlist_items', 'DELETE') as items,
               has_column_privilege(${OWNER}, 'search.profile_openings', 'creator_account_id',
                                    'SELECT') as openings`;
      const rights = await tx<{ line: string }[]>`
        select r.rolname || ' ' || t.name as line
          from pg_catalog.pg_roles r,
               (values ('search.shortlists'), ('search.shortlist_items')) as t (name)
         where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                             'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                             'influx_privacy', 'anon', 'authenticated', 'service_role')
           and (has_table_privilege(r.oid, t.name, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_any_column_privilege(r.oid, t.name, 'SELECT, INSERT, UPDATE'))`;
      const brand = await newBrand(tx);
      const tried = await asBrand(tx, brand, async () => ({
        lists: errorOf(await run(tx, "select count(*) from search.shortlists")),
        items: errorOf(
          await run(tx, "select count(*) from search.shortlist_items"),
        ),
        insert: errorOf(
          await run(
            tx,
            "insert into search.shortlists (advertiser_account_id, name) values ($1::uuid, 'x')",
            [brand],
          ),
        ),
        gate: errorOf(await run(tx, "select * from search.shortlist_gate()")),
        creator: errorOf(
          await run(
            tx,
            "select search.shortlist_creator($1::uuid, 'BCDFGH', null)",
            [brand],
          ),
        ),
        card: errorOf(
          await run(tx, "select search.anonymous_card($1::uuid)", [brand]),
        ),
      }));
      return {
        owner: owner.map((row) => row.name),
        deletes,
        rights: rights.map((row) => row.line),
        tried,
      };
    });
    expect(outcome.owner).toEqual([
      "shortlist_items.added_at S",
      "shortlist_items.creator_account_id SI",
      "shortlist_items.note SU",
      "shortlist_items.shortlist_id SI",
      "shortlists.advertiser_account_id SI",
      "shortlists.campaign_id SIU",
      "shortlists.created_at S",
      "shortlists.id S",
      "shortlists.name SIU",
    ]);
    expect(outcome.deletes).toEqual({
      lists: true,
      items: true,
      openings: true,
    });
    expect(outcome.rights).toEqual([]);
    expect(outcome.tried).toEqual({
      lists: INSUFFICIENT_PRIVILEGE,
      items: INSUFFICIENT_PRIVILEGE,
      insert: INSUFFICIENT_PRIVILEGE,
      gate: INSUFFICIENT_PRIVILEGE,
      creator: INSUFFICIENT_PRIVILEGE,
      card: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("L3F-T4 the gate (10 RG1, D38, CA59; modele §5, -8; T14)", () => {
  it("L3F-T4 refuses a creator, an agent and a brand whose account is not active (42501) on every door; nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const suspended = await newBrand(tx, { account: "suspended" });
      const tryAll = async (): Promise<string[]> => {
        const codes: string[] = [];
        for (const name of Object.keys(DOORS) as Door[]) {
          const parameters: Parameter[] =
            name === "create"
              ? ["x", null]
              : name === "update"
                ? [randomUUID(), "x", null]
                : name === "note"
                  ? [randomUUID(), creator.alias, "x"]
                  : name === "add" || name === "remove"
                    ? [randomUUID(), creator.alias]
                    : name === "list"
                      ? []
                      : [randomUUID()];
          codes.push(errorOf(await run(tx, DOORS[name], parameters)));
        }
        return codes;
      };
      const asCreator = await actAsMember(
        tx,
        "influx_creator",
        { accountId: creator.id, role: "creator", aal: "aal1" },
        tryAll,
      );
      const asAgent = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal2" },
        tryAll,
      );
      const asSuspended = await asBrand(tx, suspended, tryAll);
      return {
        asCreator,
        asAgent,
        asSuspended,
        rows: await rowsOf(tx, suspended),
      };
    });
    const refused = Array(8).fill(INSUFFICIENT_PRIVILEGE);
    expect(outcome.asCreator).toEqual(refused);
    expect(outcome.asAgent).toEqual(refused);
    expect(outcome.asSuspended).toEqual(refused);
    expect(outcome.rows).toEqual({ lists: 0, items: 0 });
  });

  it("L3F-T4 RG1 and CA59: a brand not published answers {state: brand_not_published} and the switch false {state: closed} on every door, nothing written nor served, an existing list untouched", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const [subject] = await servedCreators(tx, brand, 1);
      const list = await newList(tx, brand, "Kept");
      await door(tx, brand, "add", [list, subject?.alias]);
      const every = async (who: string): Promise<string[]> => {
        const states: string[] = [];
        for (const [name, parameters] of [
          ["create", ["Other", null]],
          ["update", [list, "Renamed", null]],
          ["add", [list, subject?.alias]],
          ["note", [list, subject?.alias, "A note"]],
          ["remove", [list, subject?.alias]],
          ["list", []],
          ["read", [list]],
          ["delete", [list]],
        ] as [Door, Parameter[]][]) {
          states.push((await door(tx, who, name, parameters)).state);
        }
        return states;
      };
      await setting(tx, "is_open_to_advertisers", false);
      const closed = await every(brand);
      await setting(tx, "is_open_to_advertisers", true);
      await tx`update profiles.advertiser_profiles set status = 'suspended'
                where account_id = ${brand}`;
      const unpublished = await every(brand);
      const draft = await newBrand(tx, { status: "draft" });
      const [kept] = await tx<Row[]>`
        select s.name, (select count(*)::int from search.shortlist_items i
                         where i.shortlist_id = s.id and i.note is null) as items
          from search.shortlists s where s.id = ${list}`;
      return {
        closed,
        unpublished,
        draft: await every(draft),
        kept,
        rows: await rowsOf(tx, brand),
      };
    });
    expect(outcome.closed).toEqual(Array(8).fill("closed"));
    expect(outcome.unpublished).toEqual(Array(8).fill("brand_not_published"));
    expect(outcome.draft).toEqual(Array(8).fill("brand_not_published"));
    expect(outcome.kept).toEqual({ name: "Kept", items: 1 });
    expect(outcome.rows).toEqual({ lists: 1, items: 1 });
  });
});

describe("L3F-T4 the lists, their campaign and their bounds (10 RG51, RG63; modele §1, §5)", () => {
  it("L3F-T4 creates a list named once trimmed, 1 to 80 characters on one line (22023 name otherwise), attached to an admitted campaign; a campaign in draft, refused, of another brand or unknown answers the same P0002 campaign, nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      const admitted = await newCampaign(tx, brand, "real_estate", "published");
      const campaigns = {
        draft: await newCampaign(tx, brand, "real_estate", "draft"),
        rejected: await newCampaign(tx, brand, "real_estate", "rejected"),
        other: await newCampaign(tx, other, "real_estate", "published"),
        unknown: randomUUID(),
      };
      const created = await door(tx, brand, "create", [
        "  Summer creators  ",
        admitted,
      ]);
      const names: Record<string, string> = {};
      for (const [label, name] of [
        ["empty", ""],
        ["blank", "   "],
        ["null", null],
        ["81", "x".repeat(81)],
        ["two lines", "first\nsecond"],
        ["tab", "a\tb"],
      ] as [string, string | null][]) {
        names[label] = errorOf(await call(tx, brand, "create", [name, null]));
      }
      const refused: Record<string, string> = {};
      for (const [label, campaign] of Object.entries(campaigns)) {
        refused[label] = bytesOf(
          await call(tx, brand, "create", ["A list", campaign]),
        );
      }
      return {
        created,
        eighty: (await door(tx, brand, "create", ["y".repeat(80), null])).state,
        admitted,
        names,
        refused,
        rows: await rowsOf(tx, brand),
      };
    });
    expect(outcome.created).toEqual({
      state: "shortlist",
      shortlist: {
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: "Summer creators",
        campaignId: outcome.admitted,
        count: 0,
        createdAt: expect.stringMatching(
          /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/,
        ),
      },
    });
    expect(outcome.eighty).toBe("shortlist");
    expect(outcome.names).toEqual(
      Object.fromEntries(
        Object.keys(outcome.names).map((key) => [key, "22023 name"]),
      ),
    );
    const unknown = outcome.refused["unknown"];
    expect(JSON.parse(unknown ?? "{}")).toMatchObject({
      code: "P0002",
      detail: "campaign",
    });
    expect(Object.values(outcome.refused)).toEqual(Array(4).fill(unknown));
    expect(outcome.rows).toEqual({ lists: 2, items: 0 });
  });

  it("L3F-T4 bounds the lists of an account by listsPerAccount in table (54000 shortlist_limit), another brand untouched; selection_limits missing answers 55000", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      await limits(tx, 2, 25);
      const states = [
        (await door(tx, brand, "create", ["One", null])).state,
        (await door(tx, brand, "create", ["Two", null])).state,
        errorOf(await call(tx, brand, "create", ["Three", null])),
        (await door(tx, other, "create", ["Other one", null])).state,
      ];
      await tx`delete from search.search_settings where key = 'selection_limits'`;
      const missing = errorOf(await call(tx, other, "create", ["Four", null]));
      return {
        states,
        missing,
        rows: [await rowsOf(tx, brand), await rowsOf(tx, other)],
      };
    });
    expect(outcome.states).toEqual([
      "shortlist",
      "shortlist",
      "54000 shortlist_limit",
      "shortlist",
    ]);
    expect(outcome.missing).toBe(
      `${NOT_IN_PREREQUISITE_STATE} creator_search_settings`,
    );
    expect(outcome.rows).toEqual([
      { lists: 2, items: 0 },
      { lists: 1, items: 0 },
    ]);
  });

  it("L3F-T4 updates a list by replacement (the name, an admitted campaign, NULL detaches; a campaign kept as it is passes though refused since, EC-L3F-04-3); another campaign not admitted P0002 campaign; a bad name 22023", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const first = await newCampaign(tx, brand, "real_estate", "published");
      const second = await newCampaign(tx, brand, "real_estate", "paused");
      const draft = await newCampaign(tx, brand, "real_estate", "draft");
      const list = await newList(tx, brand, "Initial", first);
      const renamed = await door(tx, brand, "update", [
        list,
        "Renamed",
        second,
      ]);
      const detached = await door(tx, brand, "update", [
        list,
        "Detached",
        null,
      ]);
      const toDraft = errorOf(
        await call(tx, brand, "update", [list, "Draft", draft]),
      );
      await door(tx, brand, "update", [list, "Again", first]);
      await tx`update campaigns.campaigns set status = 'rejected' where id = ${first}`;
      const kept = await door(tx, brand, "update", [list, "Kept", first]);
      const badName = errorOf(
        await call(tx, brand, "update", [list, "", null]),
      );
      return {
        renamed: renamed.shortlist,
        detached: detached.shortlist,
        toDraft,
        kept: kept.shortlist,
        badName,
        second,
        first,
      };
    });
    expect(outcome.renamed).toMatchObject({
      name: "Renamed",
      campaignId: outcome.second,
    });
    expect(outcome.detached).toMatchObject({
      name: "Detached",
      campaignId: null,
    });
    expect(outcome.toDraft).toBe("P0002 campaign");
    expect(outcome.kept).toMatchObject({
      name: "Kept",
      campaignId: outcome.first,
    });
    expect(outcome.badName).toBe("22023 name");
  });

  it("L3F-T4 deletes a list with its items; it then answers P0002 shortlist everywhere, a second deletion too", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creators = await servedCreators(tx, brand, 2);
      const list = await newList(tx, brand);
      for (const creator of creators) {
        await door(tx, brand, "add", [list, creator.alias]);
      }
      const deleted = await door(tx, brand, "delete", [list]);
      return {
        deleted,
        after: [
          errorOf(await call(tx, brand, "read", [list])),
          errorOf(await call(tx, brand, "delete", [list])),
          errorOf(await call(tx, brand, "add", [list, creators[0]?.alias])),
        ],
        rows: await rowsOf(tx, brand),
      };
    });
    expect(outcome.deleted).toEqual({ state: "deleted" });
    expect(outcome.after).toEqual(Array(3).fill("P0002 shortlist"));
    expect(outcome.rows).toEqual({ lists: 0, items: 0 });
  });

  it("L3F-T4 T14: another brand's list answers every door as an unknown one, byte for byte (P0002 shortlist), and stays untouched; the lists of a brand are its own, newest first", async () => {
    const outcome = await scenario(async (tx) => {
      const owner = await newBrand(tx);
      const intruder = await newBrand(tx);
      const [subject] = await servedCreators(tx, owner, 1);
      await serve(tx, intruder, subject === undefined ? [] : [subject]);
      const older = await newList(tx, owner, "Older");
      await tx`update search.shortlists set created_at = now() - interval '1 day'
                where id = ${older}`;
      const list = await newList(tx, owner, "Newer");
      await door(tx, owner, "add", [list, subject?.alias]);
      await newList(tx, intruder, "Intruder's");
      const answers: Record<string, [string, string]> = {};
      for (const [name, theirs, none] of [
        ["read", [list], [randomUUID()]],
        ["update", [list, "Taken", null], [randomUUID(), "Taken", null]],
        ["delete", [list], [randomUUID()]],
        ["add", [list, subject?.alias], [randomUUID(), subject?.alias]],
        [
          "note",
          [list, subject?.alias, "Mine"],
          [randomUUID(), subject?.alias, "Mine"],
        ],
        ["remove", [list, subject?.alias], [randomUUID(), subject?.alias]],
      ] as [Door, Parameter[], Parameter[]][]) {
        answers[name] = [
          bytesOf(await call(tx, intruder, name, theirs)),
          bytesOf(await call(tx, intruder, name, none)),
        ];
      }
      const nullId = errorOf(await call(tx, owner, "read", [null]));
      const lists = await door(tx, owner, "list");
      const theirs = await door(tx, intruder, "list");
      return {
        answers,
        nullId,
        lists: (lists.shortlists ?? []).map((s) => [s.name, s.count]),
        theirs: (theirs.shortlists ?? []).map((s) => s.name),
        kept: await aliasesOf(tx, owner, list),
        subject: subject?.alias,
      };
    });
    for (const [theirs, none] of Object.values(outcome.answers)) {
      expect(theirs).toBe(none);
      expect(JSON.parse(theirs)).toMatchObject({
        code: "P0002",
        detail: "shortlist",
      });
    }
    expect(outcome.nullId).toBe("P0002 shortlist");
    expect(outcome.lists).toEqual([
      ["Newer", 1],
      ["Older", 0],
    ]);
    expect(outcome.theirs).toEqual(["Intruder's"]);
    expect(outcome.kept).toEqual([outcome.subject]);
  });
});

describe("L3F-T4 the creators of a list, by alias (10 RG4, RG51, CA49; modele §5, -5)", () => {
  it("L3F-T4 adds a creator already served (an impression or an opening), idempotent with its date kept; a creator listed but never served to the caller answers P0002 creator", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const [byImpression] = await servedCreators(tx, brand, 1);
      const byOpening = await newCreator(tx);
      const neverServed = await newCreator(tx);
      const elsewhere = await newCreator(tx);
      // served to another brand only: never to the caller
      await serve(tx, await newBrand(tx), [elsewhere]);
      const opened = await asBrand(tx, brand, () =>
        run<{ answer: Answer }>(
          tx,
          "select search.open_creator_profile($1::text) as answer",
          [byOpening.alias],
        ),
      );
      const list = await newList(tx, brand);
      const states = [
        (await door(tx, brand, "add", [list, byImpression?.alias])).state,
        (await door(tx, brand, "add", [list, byOpening.alias])).state,
      ];
      const [first] = await tx<{ at: string }[]>`
        select added_at::text as at from search.shortlist_items
         where shortlist_id = ${list} and creator_account_id = ${byImpression?.id ?? null}`;
      // one transaction, one now(): the order is given by the dates
      await tx`update search.shortlist_items
                  set added_at = added_at - case when creator_account_id = ${byOpening.id}
                                                 then interval '1 hour' else interval '2 hours' end
                where shortlist_id = ${list}`;
      const again = (await door(tx, brand, "add", [list, byImpression?.alias]))
        .state;
      const [kept] = await tx<{ n: number; moved: boolean }[]>`
        select count(*)::int as n, bool_and(added_at < now()) as moved
          from search.shortlist_items where shortlist_id = ${list}`;
      return {
        opened: answerOf(opened).state,
        states,
        first: first?.at !== undefined,
        again,
        kept,
        never: errorOf(await call(tx, brand, "add", [list, neverServed.alias])),
        elsewhere: errorOf(
          await call(tx, brand, "add", [list, elsewhere.alias]),
        ),
        read: await aliasesOf(tx, brand, list),
        expected: [byOpening.alias, byImpression?.alias],
      };
    });
    expect(outcome.opened).toBe("profile");
    expect(outcome.states).toEqual(["added", "added"]);
    expect(outcome.first).toBe(true);
    expect(outcome.again).toBe("added");
    expect(outcome.kept).toEqual({ n: 2, moved: true });
    expect(outcome.never).toBe("P0002 creator");
    expect(outcome.elsewhere).toBe("P0002 creator");
    expect(outcome.read).toEqual(outcome.expected);
  });

  it("L3F-T4 CA49: an unknown alias, a malformed one and a creator excluded by E1 to E6, all served before, answer the same bytes (P0002 creator); nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand, "real_estate", "published");
      const excluded = {
        draft: await newCreator(tx, { status: "draft" }),
        hidden: await newCreator(tx, { searchable: false }),
        suspended: await newCreator(tx, { account: "suspended" }),
        minor: await newCreator(tx, { adult: false }),
        blocked: await newCreator(tx),
        refusingBrand: await newCreator(tx, { refused: ["sports_leisure"] }),
        refusingCampaign: await newCreator(tx, { refused: ["real_estate"] }),
      };
      await giveBlock(tx, brand, excluded.blocked);
      await serve(tx, brand, Object.values(excluded));
      const list = await newList(tx, brand, "With campaign", campaign);
      const [fresh] = await tx<{ alias: string }[]>`
        select profiles.new_creator_alias() as alias`;
      const answers: Record<string, string> = {};
      for (const [name, alias] of [
        ["unknown", fresh?.alias ?? "BCDFGH"],
        ["malformed", "not-an-alias"],
        ["lower case", (fresh?.alias ?? "BCDFGH").toLowerCase()],
        ["empty", ""],
        ["null", null],
        ...Object.entries(excluded).map(([key, creator]) => [
          key,
          creator.alias,
        ]),
      ] as [string, string | null][]) {
        answers[name] = bytesOf(await call(tx, brand, "add", [list, alias]));
      }
      // without the campaign, the creator refusing its sector alone is listed
      const plain = await newList(tx, brand, "Plain");
      const without = (
        await door(tx, brand, "add", [plain, excluded.refusingCampaign.alias])
      ).state;
      return { answers, without, rows: await rowsOf(tx, brand) };
    });
    const unknown = outcome.answers["unknown"];
    expect(JSON.parse(unknown ?? "{}")).toEqual({
      code: "P0002",
      detail: "creator",
      message: "creator_not_found",
    });
    expect(Object.values(outcome.answers)).toEqual(
      Array(Object.keys(outcome.answers).length).fill(unknown),
    );
    expect(outcome.without).toBe("added");
    expect(outcome.rows).toEqual({ lists: 2, items: 1 });
  });

  it("L3F-T4 bounds a list by itemsPerList in table, every row counted, a hidden one included (54000 shortlist_full); adding one already there still answers added", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await limits(tx, 10, 2);
      const [first, second, third] = await servedCreators(tx, brand, 3);
      const list = await newList(tx, brand);
      await door(tx, brand, "add", [list, first?.alias]);
      await door(tx, brand, "add", [list, second?.alias]);
      if (second !== undefined) await giveBlock(tx, brand, second);
      return {
        full: errorOf(await call(tx, brand, "add", [list, third?.alias])),
        again: (await door(tx, brand, "add", [list, first?.alias])).state,
        summary: (await door(tx, brand, "read", [list])).shortlist?.count,
        rows: await rowsOf(tx, brand),
      };
    });
    expect(outcome.full).toBe("54000 shortlist_full");
    expect(outcome.again).toBe("added");
    expect(outcome.summary).toBe(1);
    expect(outcome.rows).toEqual({ lists: 1, items: 2 });
  });

  it("L3F-T4 CA6: reads the items newest first, each the card of the profile door (the same source, nothing of RG48), its note and its date; never an account id, a handle nor a line key", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const [older, newer] = await servedCreators(tx, brand, 2);
      const list = await newList(tx, brand);
      await door(tx, brand, "add", [list, older?.alias]);
      await tx`update search.shortlist_items set added_at = now() - interval '2 hours'
                where shortlist_id = ${list}`;
      await door(tx, brand, "add", [list, newer?.alias]);
      await door(tx, brand, "note", [list, newer?.alias, "  To call first  "]);
      const read = await call(tx, brand, "read", [list]);
      const profile = answerOf(
        await asBrand(tx, brand, () =>
          run<{ answer: Answer }>(
            tx,
            "select search.open_creator_profile($1::text) as answer",
            [newer?.alias],
          ),
        ),
      );
      return {
        answer: answerOf(read),
        raw: bytesOf(read),
        profile: profile.creator,
        secrets: [older?.id, newer?.id, older?.handle, newer?.handle],
        aliases: [newer?.alias, older?.alias],
      };
    });
    expect(outcome.answer.state).toBe("shortlist");
    expect(outcome.answer.shortlist?.count).toBe(2);
    const items = outcome.answer.items ?? [];
    expect(items.map((item) => item.creator.alias)).toEqual(outcome.aliases);
    expect(items.map((item) => item.note)).toEqual(["To call first", null]);
    expect(items[0]?.creator).toEqual(outcome.profile);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(["addedAt", "creator", "note"]);
      expect(item.creator).not.toHaveProperty("status");
      expect(item.addedAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    }
    for (const secret of outcome.secrets) {
      expect(outcome.raw).not.toContain(secret);
    }
    expect(outcome.raw).not.toContain("lineKey");
  });

  it("L3F-T4 masks a creator excluded since (E5, E6 of the list's campaign) without trace nor count, and gives it back when visible again; a campaign refused since keeps its link and loses its sector", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand, "real_estate", "published");
      const [kept, blocked] = await servedCreators(tx, brand, 2);
      const list = await newList(tx, brand, "Campaign list", campaign);
      await door(tx, brand, "add", [list, kept?.alias]);
      // one transaction, one now(): the first added is the older
      await tx`update search.shortlist_items set added_at = now() - interval '1 hour'
                where shortlist_id = ${list}`;
      await door(tx, brand, "add", [list, blocked?.alias]);
      await door(tx, brand, "note", [list, blocked?.alias, "Kept note"]);
      if (blocked === undefined || kept === undefined) throw new Error("none");
      await giveBlock(tx, brand, blocked);
      const masked = await door(tx, brand, "read", [list]);
      const listed = await door(tx, brand, "list");
      await liftBlock(tx, brand, blocked);
      const back = await door(tx, brand, "read", [list]);
      // E6 of the campaign of the list: masked; the campaign refused since, its sector ignored
      await tx`insert into profiles.creator_refused_sectors (account_id, sector_code)
               values (${kept.id}, 'real_estate')`;
      const refusing = await aliasesOf(tx, brand, list);
      await tx`update campaigns.campaigns set status = 'rejected' where id = ${campaign}`;
      const rejected = await door(tx, brand, "read", [list]);
      return {
        masked: (masked.items ?? []).map((item) => item.creator.alias),
        maskedCount: masked.shortlist?.count,
        listedCount: listed.shortlists?.[0]?.count,
        maskedRaw: JSON.stringify(masked),
        back: (back.items ?? []).map((item) => [item.creator.alias, item.note]),
        refusing,
        rejected: {
          campaignId: rejected.shortlist?.campaignId,
          count: rejected.shortlist?.count,
        },
        kept: kept.alias,
        blocked: blocked.alias,
        campaign,
      };
    });
    expect(outcome.masked).toEqual([outcome.kept]);
    expect(outcome.maskedCount).toBe(1);
    expect(outcome.listedCount).toBe(1);
    expect(outcome.maskedRaw).not.toContain(outcome.blocked);
    expect(outcome.maskedRaw).not.toContain("Kept note");
    expect(outcome.back).toEqual([
      [outcome.blocked, "Kept note"],
      [outcome.kept, null],
    ]);
    expect(outcome.refusing).toEqual([outcome.blocked]);
    expect(outcome.rejected).toEqual({
      campaignId: outcome.campaign,
      count: 2,
    });
  });

  it("L3F-T4 notes a creator of the list (trimmed, 1 to 500, NULL clears; 22023 note otherwise); a creator hidden or absent from the list answers P0002 creator", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const [noted, hidden, absent] = await servedCreators(tx, brand, 3);
      const list = await newList(tx, brand);
      await door(tx, brand, "add", [list, noted?.alias]);
      await door(tx, brand, "add", [list, hidden?.alias]);
      if (hidden !== undefined) await giveBlock(tx, brand, hidden);
      const note = async () => {
        const [row] = await tx<{ note: string | null }[]>`
          select note from search.shortlist_items
           where shortlist_id = ${list} and creator_account_id = ${noted?.id ?? null}`;
        return row?.note;
      };
      const states: unknown[] = [];
      states.push(
        (
          await door(tx, brand, "note", [
            list,
            noted?.alias,
            " Line one\nline two ",
          ])
        ).state,
        await note(),
        (await door(tx, brand, "note", [list, noted?.alias, "z".repeat(500)]))
          .state,
        errorOf(
          await call(tx, brand, "note", [list, noted?.alias, "z".repeat(501)]),
        ),
        errorOf(await call(tx, brand, "note", [list, noted?.alias, "   "])),
        (await door(tx, brand, "note", [list, noted?.alias, null])).state,
        await note(),
        bytesOf(await call(tx, brand, "note", [list, hidden?.alias, "Hidden"])),
        bytesOf(await call(tx, brand, "note", [list, absent?.alias, "Absent"])),
        bytesOf(await call(tx, brand, "note", [list, "BCDFGH", "Unknown"])),
      );
      return states;
    });
    expect(outcome.slice(0, 7)).toEqual([
      "noted",
      "Line one\nline two",
      "noted",
      "22023 note",
      "22023 note",
      "noted",
      null,
    ]);
    const [hidden, absent, unknown] = outcome.slice(7) as string[];
    expect(JSON.parse(hidden ?? "{}")).toMatchObject({
      code: "P0002",
      detail: "creator",
    });
    expect(absent).toBe(hidden);
    expect(unknown).toBe(hidden);
  });

  it("L3F-T4 removes by alias, idempotent: present, absent, unknown or hidden, the same answer (L3G-T1, L3FS-2: EC-L3F-04-4 inverted, a hidden creator stays, EC-L3G-1)", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const [present, hidden, absent] = await servedCreators(tx, brand, 3);
      const list = await newList(tx, brand);
      await door(tx, brand, "add", [list, present?.alias]);
      await door(tx, brand, "add", [list, hidden?.alias]);
      if (hidden !== undefined) await giveBlock(tx, brand, hidden);
      const answers = [
        bytesOf(await call(tx, brand, "remove", [list, present?.alias])),
        bytesOf(await call(tx, brand, "remove", [list, present?.alias])),
        bytesOf(await call(tx, brand, "remove", [list, absent?.alias])),
        bytesOf(await call(tx, brand, "remove", [list, "BCDFGH"])),
        bytesOf(await call(tx, brand, "remove", [list, null])),
        bytesOf(await call(tx, brand, "remove", [list, hidden?.alias])),
      ];
      return { answers, rows: await rowsOf(tx, brand) };
    });
    expect(new Set(outcome.answers)).toEqual(
      new Set([JSON.stringify([{ answer: { state: "removed" } }])]),
    );
    // L3FS-2: the hidden creator is not removed through its alias (the engine resolves it no more)
    expect(outcome.rows).toEqual({ lists: 1, items: 1 });
  });

  it("L3G-T1 L3FS-2, D85: adding, noting and removing run THE engine once for an alias known or unknown, before the lock of the account", async () => {
    const outcome = await scenario(async (tx) => {
      await trackFunctions(tx);
      const brand = await newBrand(tx);
      const [present] = await servedCreators(tx, brand, 1);
      const list = await newList(tx, brand);
      await door(tx, brand, "add", [list, present?.alias]);
      const runs = async (name: Door, parameters: readonly Parameter[]) => {
        let state = "none";
        const engine = await engineRuns(tx, async () => {
          state = answerOf(await call(tx, brand, name, parameters)).state;
        });
        return `${state} ${engine}`;
      };
      return [
        await runs("add", [list, present?.alias]),
        await runs("add", [list, "BCDFGH"]),
        await runs("note", [list, present?.alias, "Known"]),
        await runs("note", [list, "BCDFGH", "Unknown"]),
        await runs("remove", [list, "BCDFGH"]),
        await runs("remove", [list, present?.alias]),
      ];
    });
    expect(outcome).toEqual([
      "added 1",
      "error P0002 creator 1",
      "noted 1",
      "error P0002 creator 1",
      "removed 1",
      "removed 1",
    ]);
  });

  it("L3G-T1 D85: the lock of the account held elsewhere, every write of a list answers 55P03 after about a second, the engine already run by add, note and remove, nothing written; the caller's lock_timeout given back", async () => {
    const outcome = await scenario(async (tx) => {
      await trackFunctions(tx);
      await tx`set local lock_timeout = '7s'`;
      const brand = await newBrand(tx);
      const [present, other] = await servedCreators(tx, brand, 2);
      // written outside the doors: a door would hold the lock of the account in this transaction
      const [written] = await tx<{ id: string }[]>`
        insert into search.shortlists (advertiser_account_id, name)
        values (${brand}, 'My list') returning id::text`;
      const list = written?.id ?? null;
      await tx`insert into search.shortlist_items (shortlist_id, creator_account_id)
               values (${list}, ${present?.id ?? null})`;
      const answers = await holdingLock(
        `search.shortlists:${brand}`,
        async () => {
          const seen: Row[] = [];
          for (const [name, parameters] of [
            ["create", ["Another", null]],
            ["update", [list, "Renamed", null]],
            ["delete", [list]],
            ["add", [list, other?.alias]],
            ["note", [list, present?.alias, "Held"]],
            ["remove", [list, present?.alias]],
          ] as [Door, Parameter[]][]) {
            const started = Date.now();
            let state = "none";
            const engine = await engineRuns(tx, async () => {
              state = answerOf(await call(tx, brand, name, parameters)).state;
            });
            const elapsed = Date.now() - started;
            seen.push({
              name,
              state,
              engine,
              waited: elapsed >= 900 && elapsed < 5_000,
            });
          }
          return seen;
        },
      );
      const [setting] = await tx<{ value: string }[]>`
        select pg_catalog.current_setting('lock_timeout') as value`;
      const [item] = await tx<{ note: string | null }[]>`
        select note from search.shortlist_items where shortlist_id = ${list}`;
      return {
        answers,
        rows: await rowsOf(tx, brand),
        note: item?.note,
        names: (await door(tx, brand, "list")).shortlists?.map((s) => s.name),
        timeout: setting?.value,
      };
    });
    const held = (name: string, engine: number): Row => ({
      name,
      state: "error 55P03",
      engine,
      waited: true,
    });
    expect(outcome.answers).toEqual([
      held("create", 0),
      held("update", 0),
      held("delete", 0),
      held("add", 1),
      held("note", 1),
      held("remove", 1),
    ]);
    expect(outcome.rows).toEqual({ lists: 1, items: 1 });
    expect(outcome.note).toBeNull();
    expect(outcome.names).toEqual(["My list"]);
    expect(outcome.timeout).toBe("7s");
  });
});

describe("L3F-T4 CA52: nothing to the creator (D45, RG8, CA64)", () => {
  it("L3F-T4 CA52: creating, adding, noting, removing and deleting write nothing to leads.outbox_events, audit, matching nor the creator's account", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const [subject] = await servedCreators(tx, brand, 1);
      const counts = async () => {
        const [row] = await tx<Row[]>`
          select (select count(*)::int from leads.outbox_events) as outbox,
                 (select count(*)::int from audit.audit_events) as audit,
                 (select count(*)::int from matching.party_blocks) as blocks,
                 (select md5(a::text) from identity.accounts a
                   where a.id = ${subject?.id ?? null}) as account,
                 (select md5(p::text) from profiles.creator_public_profiles p
                   where p.account_id = ${subject?.id ?? null}) as storefront`;
        return row;
      };
      const before = await counts();
      const list = await newList(tx, brand);
      const states = [
        (await door(tx, brand, "add", [list, subject?.alias])).state,
        (await door(tx, brand, "note", [list, subject?.alias, "Nice"])).state,
        (await door(tx, brand, "list")).state,
        (await door(tx, brand, "read", [list])).state,
        (await door(tx, brand, "remove", [list, subject?.alias])).state,
        (await door(tx, brand, "delete", [list])).state,
      ];
      return { states, before, after: await counts() };
    });
    expect(outcome.states).toEqual([
      "added",
      "noted",
      "shortlists",
      "shortlist",
      "removed",
      "deleted",
    ]);
    expect(outcome.after).toEqual(outcome.before);
  });
});
