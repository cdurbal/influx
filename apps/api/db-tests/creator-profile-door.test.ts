// L3F commit 03 — the brand's doors of the anonymous profile and of its visuals, 0323
// (jalons/l3f/03.md; l3f-fiche.md invariants 1 to 5, 8 to 10, 15; jalons/l3f/modele.md §2 to §4; 10
// RG1, RG2, RG4, RG15, RG47, RG48, RG50, RG63 to RG66, CA6, CA14, CA15, CA48 to CA50, CA59; 07 RG84,
// RG85; 18 T15.2).
//   L3F-T3  the doors and their helpers in the catalogue (EXECUTE for the brand alone, invoker
//           helpers, no dynamic statement, layer A only: T1-R by couple), the table of the openings
//           (RLS forced, no member right, append-only); the controls in their order (42501, RG1, the
//           switch, the bucket, the alias); CA49 (unknown, malformed and excluded by E1 to E6 byte for
//           byte); CA6 (the keys of the card, nothing of RG48); CA15 (4 and 5 storefronts, the
//           threshold in table); CA48 (the impression of origin opened once, the opening journaled in
//           the transaction that serves); the 60th and 61st opening (T15.2); the reasons of the
//           search of origin; CA50 (an approved visual of a visible creator, nothing else).
// Each case runs in a rolled-back transaction of the local superuser, which sets aside the storefronts
// of earlier runs sharing this file's audience country and region, opens the switch (D38: closed by
// default), writes its fixtures outside the guards, and acts as apps/api does (influx_app, then the
// brand's role and context).
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
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
const INVALID_PARAMETER = "22023";
const NOT_IN_PREREQUISITE_STATE = "55000";

const agentA = accountIdOf("agent", "a");

const OWNER = "influx_creator_search_definer";

/** The audience country of this file's storefronts: every search filters F6 on it. */
const COUNTRY = "FO";
const HERE = { F6: { country: COUNTRY } };
/** The region of residence of this file's storefronts that carry one (FR, Corsica). */
const REGION = "FR-20R";

const PROFILE = "select search.open_creator_profile($1::text) as answer";
const PROFILE_RAW = "select search.open_creator_profile($1::text)::text as raw";
const VISUAL =
  "select object_key, width, height from search.read_creator_visual($1::text, $2::uuid)";
const SEARCH =
  "select search.search_creators($1::text::jsonb, $2::text, $3::integer, $4::uuid) as answer";

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | {
      outcome: "error";
      code: string;
      detail: string | undefined;
      message: string;
    };

type Card = {
  creator: Row & { alias: string; visuals: Row[] };
  reasons: unknown[];
  vigilance: unknown;
};

type Answer = {
  state: string;
  creator?: Row & { alias: string; visuals: Row[] };
  residenceRegion?: string | null;
  reasons?: unknown[];
  vigilance?: unknown;
  retryAfterSeconds?: number;
  cards?: Card[];
};

type Visual = { object_key: string; width: number; height: number };

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

/** An error as the API would read it, every byte of it (CA49). */
function bytesOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error"
    ? JSON.stringify({
        code: outcome.code,
        detail: outcome.detail,
        message: outcome.message,
      })
    : JSON.stringify(outcome.rows);
}

/** A rolled-back transaction: the file's country and region set aside, the switch open. */
function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    await tx`
      update profiles.creator_public_profiles set is_searchable = false
       where (main_audience_country = ${COUNTRY}
              or (residence_country_code = 'FR' and residence_region_code = ${REGION}))
         and is_searchable`;
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
    values (${id}, ${randomUUID()}, ${`l3f-t3-${id}@example.test`}, now(), 'FR', 'fr',
            'L3F T3 Person', ${adult}, case when ${adult}::boolean then now() end,
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
  sector?: string;
  account?: "active" | "suspended";
};

/** A brand whose profile is published by default (10 RG1). */
async function newBrand(tx: Tx, spec: BrandSpec = {}): Promise<string> {
  const id = await newAccount(tx, "advertiser", { status: spec.account });
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3F T3 Brand', ${spec.sector ?? "sports_leisure"}, '11_50',
            ${`l3f-t3-${id.slice(0, 8)}.example`},
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
  region?: string | null;
  refused?: string[];
};

type Creator = { id: string; alias: string; line: string; handle: string };

/**
 * A creator and its storefront, published, searchable, its main audience in the file's country by
 * default, resident in France (in REGION when asked); one listed Instagram line of 47 312 followers.
 */
async function newCreator(tx: Tx, spec: CreatorSpec = {}): Promise<Creator> {
  const id = await newAccount(tx, "creator", {
    adult: spec.adult,
    status: spec.account,
  });
  await tx`
    insert into profiles.creator_public_profiles
      (account_id, alias, residence_country_code, residence_region_code)
    values (${id}, profiles.new_creator_alias(), 'FR', ${spec.region ?? null})`;
  const handle = `l3f_t3_${id.slice(0, 8)}`;
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
  await tx`insert into profiles.creator_formats (account_id, format_code)
           values (${id}, 'instagram_reel')`;
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
  return { id, alias: row.alias, line: line.id, handle };
}

async function newCreators(
  tx: Tx,
  count: number,
  spec: CreatorSpec = {},
): Promise<Creator[]> {
  const creators: Creator[] = [];
  for (let index = 0; index < count; index += 1) {
    creators.push(await newCreator(tx, spec));
  }
  return creators;
}

const BLOCK_REASON = "t_three_block";

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
    values (${brand}, ${creator.id}, ${brand}, 'advertiser', ${BLOCK_REASON}, 'L3F T3 why')`;
}

type VisualState = "approved" | "pending" | "rejected";

/** A stored visual of `creator` in `state`; its id and the key of its object (the base's). */
async function newVisual(
  tx: Tx,
  creator: Creator,
  state: VisualState,
  order: number | null = null,
): Promise<{ id: string; objectKey: string }> {
  const decided = state !== "pending";
  const rejected = state === "rejected";
  const [row] = await tx<{ id: string; object_key: string }[]>`
    insert into profiles.portfolio_items
      (account_id, state, received_bytes, byte_size, width, height, checksum, stored_at,
       sla_due_at, exif_stripped, decided_by_account_id, decided_at, display_order, caption,
       rejection_reason_code, retention_due_at)
    values (${creator.id}, ${state}::profiles.portfolio_item_state, 2048, 2048, 640, 480,
            ${randomUUID().replaceAll("-", "").repeat(2)}, now(), now() + interval '1 day', true,
            ${decided ? agentA : null}, case when ${decided}::boolean then now() end,
            ${rejected ? null : order}, ${`L3F T3 ${state} caption`},
            ${rejected ? "watermark" : null},
            case when ${rejected}::boolean then now() + interval '30 days' end)
    returning id::text, object_key`;
  if (row === undefined) throw new Error("no visual");
  return { id: row.id, objectKey: row.object_key };
}

/** `count` openings served to `brand`, `ago` in the past (the bucket of the door counts them). */
async function giveOpenings(
  tx: Tx,
  brand: string,
  creator: Creator,
  count: number,
  ago: string,
  outcome: "served" | "rate_limited" = "served",
): Promise<void> {
  await tx`
    insert into search.profile_openings (account_id, outcome, creator_account_id, created_at)
    select ${brand}, ${outcome}, ${outcome === "served" ? creator.id : null},
           now() - ${ago}::interval
      from pg_catalog.generate_series(1, ${count})`;
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

type Opened = {
  outcome: Outcome<{ answer: Answer }>;
  answer: Answer;
  request: string;
};

/** An opening of `alias` by `brand` as apps/api runs it, under a request id of its own. */
async function open(
  tx: Tx,
  brand: string,
  alias: string | null,
): Promise<Opened> {
  const request = `l3f-t3-${randomUUID()}`;
  await tx`select pg_catalog.set_config('influx.request_id', ${request}, true)`;
  const outcome = await asBrand(tx, brand, () =>
    run<{ answer: Answer }>(tx, PROFILE, [alias]),
  );
  return {
    outcome,
    answer:
      outcome.outcome === "rows"
        ? (outcome.rows[0]?.answer ?? { state: "none" })
        : { state: `error ${errorOf(outcome)}` },
    request,
  };
}

async function rawOpen(tx: Tx, brand: string, alias: string): Promise<string> {
  const outcome = await asBrand(tx, brand, () =>
    run<{ raw: string }>(tx, PROFILE_RAW, [alias]),
  );
  if (outcome.outcome === "error") throw new Error(errorOf(outcome));
  return outcome.rows[0]?.raw ?? "";
}

async function readVisual(
  tx: Tx,
  brand: string,
  alias: string | null,
  visual: string | null,
): Promise<Outcome<Visual>> {
  return asBrand(tx, brand, () => run<Visual>(tx, VISUAL, [alias, visual]));
}

/** A search of `brand` as apps/api runs it; its answer and its journal line. */
async function search(
  tx: Tx,
  brand: string,
  filters: unknown = HERE,
  campaign: string | null = null,
): Promise<{ answer: Answer; queryId: string | undefined }> {
  const request = `l3f-t3-search-${randomUUID()}`;
  await tx`select pg_catalog.set_config('influx.request_id', ${request}, true)`;
  const outcome = await asBrand(tx, brand, () =>
    run<{ answer: Answer }>(tx, SEARCH, [
      JSON.stringify(filters),
      "default",
      1,
      campaign,
    ]),
  );
  const [line] = await tx<{ id: string }[]>`
    select id::text from search.search_queries where request_id = ${request}`;
  return {
    answer:
      outcome.outcome === "rows"
        ? (outcome.rows[0]?.answer ?? { state: "none" })
        : { state: `error ${errorOf(outcome)}` },
    queryId: line?.id,
  };
}

function cardOf(answer: Answer, alias: string): Card | undefined {
  return (answer.cards ?? []).find((card) => card.creator.alias === alias);
}

type Opening = {
  outcome: string;
  creator: string | null;
  query: string | null;
  request: string | null;
};

async function openingsOf(tx: Tx, brand: string): Promise<Opening[]> {
  return tx<Opening[]>`
    select o.outcome, o.creator_account_id::text as creator,
           o.search_query_id::text as query, o.request_id as request
      from search.profile_openings o
     where o.account_id = ${brand} and o.created_at = now()
     order by o.outcome, o.request_id`;
}

async function impressionOf(
  tx: Tx,
  query: string | undefined,
  creator: Creator,
): Promise<{ opened: boolean; at: boolean } | undefined> {
  const [row] = await tx<{ opened: boolean; at: boolean }[]>`
    select i.was_opened as opened, i.opened_at = now() as at
      from search.search_impressions i
     where i.search_query_id = ${query ?? null}::uuid
       and i.creator_account_id = ${creator.id}`;
  return row;
}

/** A served search of `brand` journaled `ago` in the past, with an impression of `creator`. */
async function giveImpression(
  tx: Tx,
  brand: string,
  creator: Creator,
  ago: string,
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into search.search_queries
      (id, account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
       result_count, page_reached, created_at)
    values (${id}, ${brand}, 'advertiser', 'advertiser_anonymous', 'served',
            ${JSON.stringify(HERE)}::text::jsonb, 'default',
            (select max(version) from search.facet_config_versions), 5, 1, now() - ${ago}::interval)`;
  await tx`
    insert into search.search_impressions (search_query_id, creator_account_id, rank)
    values (${id}, ${creator.id}, 1)`;
  return id;
}

// the cases ---------------------------------------------------------------------------------------

describe("L3F-T3 the doors, their helpers and the openings in the catalogue (03 P7; fiche invariants 3, 4)", () => {
  it("L3F-T3 makes the doors of the profile and of a visual SECURITY DEFINER of the owner, executable by influx_advertiser alone, their two helpers invoker executed by nobody, every one with an empty search_path and no dynamic statement", async () => {
    const functions = await scenario(
      (tx) => tx<Row[]>`
        select p.oid::regprocedure::text as name, pg_catalog.pg_get_userbyid(p.proowner) as owner,
               p.prosecdef as definer, p.provolatile as volatility, p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                              pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers,
               p.prosrc ~* '\\mexecute\\M|query_to_xml|dblink' as dynamic
          from pg_catalog.pg_proc p
         where p.oid in ('search.open_creator_profile(text)'::regprocedure,
                         'search.read_creator_visual(text,uuid)'::regprocedure,
                         'search.displayed_region(uuid)'::regprocedure,
                         'search.creator_open_retry_after(uuid)'::regprocedure)
         order by p.oid::regprocedure::text collate "C"`,
    );
    const fn = (name: string, definer: boolean, volatility: string): Row => ({
      name,
      owner: OWNER,
      definer,
      volatility,
      config: ['search_path=""'],
      callers: definer ? ["influx_advertiser"] : [],
      dynamic: false,
    });
    expect(functions).toEqual([
      fn("search.creator_open_retry_after(uuid)", false, "v"),
      fn("search.displayed_region(uuid)", false, "s"),
      fn("search.open_creator_profile(text)", true, "v"),
      fn("search.read_creator_visual(text,uuid)", true, "s"),
    ]);
  });

  it("L3F-T3 T1-R by couple: the doors and their helpers name the storefront, the card, the engine and the visuals only, never layer I, Storage, a piece nor a campaign table", async () => {
    const named = await scenario(
      (tx) => tx<Row[]>`
        select p.oid::regprocedure::text as name,
               array(select distinct lower(m[1])
                       from regexp_matches(p.prosrc, 'profiles\\s*\\.\\s*([a-z_]+)', 'gi') m
                      order by 1) as profiles,
               p.prosrc ~* 'creator_identities|creator_social_accounts|creator_audience_ages'
                           '|creator_audience_countries|creator_audience_genders'
                           '|creator_network_metrics_history' as layer_i,
               p.prosrc ~* '\\m"?storage"?\\s*\\.|evidence_files|verification\\s*\\.'
                           '|campaigns\\s*\\.' as forbidden
          from pg_catalog.pg_proc p
         where p.oid in ('search.open_creator_profile(text)'::regprocedure,
                         'search.read_creator_visual(text,uuid)'::regprocedure,
                         'search.displayed_region(uuid)'::regprocedure,
                         'search.creator_open_retry_after(uuid)'::regprocedure)
         order by p.oid::regprocedure::text collate "C"`,
    );
    expect(named).toEqual([
      {
        name: "search.creator_open_retry_after(uuid)",
        profiles: [],
        layer_i: false,
        forbidden: false,
      },
      {
        name: "search.displayed_region(uuid)",
        profiles: ["creator_public_profiles"],
        layer_i: false,
        forbidden: false,
      },
      {
        name: "search.open_creator_profile(text)",
        profiles: [
          "advertiser_profiles",
          "creator_layer_a",
          "creator_public_profiles",
        ],
        layer_i: false,
        forbidden: false,
      },
      {
        name: "search.read_creator_visual(text,uuid)",
        profiles: [
          "advertiser_profiles",
          "creator_public_profiles",
          "portfolio_items",
        ],
        layer_i: false,
        forbidden: false,
      },
    ]);
  });

  it("L3F-T3 forces RLS on search.profile_openings with the restrictive member policy, gives no execution role any right on it, the owner its count and its insertion; append-only for any influx_% role given a right (55000)", async () => {
    const outcome = await scenario(async (tx) => {
      const [table] = await tx<Row[]>`
        select c.relrowsecurity and c.relforcerowsecurity as forced,
               exists (select 1 from pg_catalog.pg_policy p
                        where p.polrelid = c.oid and not p.polpermissive
                          and p.polname = 'profile_openings_no_member_access'
                          and p.polroles @> array['influx_advertiser'::regrole::oid,
                                                  'influx_creator'::regrole::oid]
                          and pg_catalog.pg_get_expr(p.polqual, p.polrelid) = 'false') as member_policy,
               exists (select 1 from pg_catalog.pg_trigger t
                        where t.tgrelid = c.oid and t.tgname = 'profile_openings_immutable'
                          and t.tgfoid = 'search.guard_search_journal_write()'::regprocedure)
                 as guarded
          from pg_catalog.pg_class c where c.oid = 'search.profile_openings'::regclass`;
      const rights = await tx<{ line: string }[]>`
        select r.rolname as line from pg_catalog.pg_roles r
         where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                             'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                             'influx_privacy', 'anon', 'authenticated', 'service_role')
           and (has_table_privilege(r.oid, 'search.profile_openings',
                                    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_any_column_privilege(r.oid, 'search.profile_openings',
                                            'SELECT, INSERT, UPDATE'))`;
      const owner = await tx<{ name: string }[]>`
        select at.attname || ' ' ||
               case when has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'SELECT')
                    then 'S' else '' end ||
               case when has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'INSERT')
                    then 'I' else '' end ||
               case when has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'UPDATE')
                    then 'U' else '' end as name
          from pg_catalog.pg_attribute at
         where at.attrelid = 'search.profile_openings'::regclass
           and at.attnum > 0 and not at.attisdropped
         order by at.attname`;
      // a right given by mistake (rolled back): the guard of 0316 still refuses the change
      const brand = await newBrand(tx);
      const creator = await newCreator(tx);
      await giveOpenings(tx, brand, creator, 1, "1 hour");
      await tx.unsafe(
        `grant update (request_id), delete on search.profile_openings to ${OWNER}`,
      );
      await tx.unsafe(`create policy l3f_t3_all on search.profile_openings
                         for all to ${OWNER} using (true) with check (true)`);
      await tx.unsafe(`set local role ${OWNER}`);
      const changed = await run(
        tx,
        "update search.profile_openings set request_id = 'changed' where account_id = $1::uuid",
        [brand],
      );
      const removed = await run(
        tx,
        "delete from search.profile_openings where account_id = $1::uuid",
        [brand],
      );
      await tx.unsafe("reset role");
      return {
        table,
        rights: rights.map((row) => row.line),
        owner: owner.map((row) => row.name),
        codes: [errorOf(changed), errorOf(removed)],
      };
    });
    expect(outcome.table).toEqual({
      forced: true,
      member_policy: true,
      guarded: true,
    });
    expect(outcome.rights).toEqual([]);
    expect(outcome.owner).toEqual([
      "account_id SI",
      "created_at S",
      "creator_account_id I",
      "id S",
      "outcome SI",
      "request_id I",
      "search_query_id I",
    ]);
    expect(outcome.codes).toEqual([
      `${NOT_IN_PREREQUISITE_STATE} search_journal_immutable`,
      `${NOT_IN_PREREQUISITE_STATE} search_journal_immutable`,
    ]);
  });

  it("L3F-T3 gives the owner the object of an approved visual and the region, never public_ref nor Storage; the brand reaches neither the openings, the visuals nor the helpers (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      const [owner] = await tx<Row[]>`
        select
          array(select a.attname::text from pg_catalog.pg_attribute a
                 where a.attrelid = 'profiles.portfolio_items'::regclass
                   and a.attnum > 0 and not a.attisdropped
                   and has_column_privilege(${OWNER}, a.attrelid, a.attnum, 'SELECT')
                 order by a.attname) as visuals,
          has_column_privilege(${OWNER}, 'profiles.creator_public_profiles',
                               'residence_region_code', 'SELECT') as region,
          has_column_privilege(${OWNER}, 'profiles.creator_public_profiles', 'public_ref',
                               'SELECT') as public_ref,
          has_schema_privilege(${OWNER}, 'storage', 'USAGE') as storage`;
      const brand = await newBrand(tx);
      const tried = await asBrand(tx, brand, async () => ({
        openings: errorOf(
          await run(tx, "select count(*) from search.profile_openings"),
        ),
        visuals: errorOf(
          await run(
            tx,
            "select object_key from profiles.portfolio_items limit 1",
          ),
        ),
        objects: errorOf(
          await run(tx, "select name from storage.objects limit 1"),
        ),
        region: errorOf(
          await run(tx, "select search.displayed_region($1::uuid)", [brand]),
        ),
        bucket: errorOf(
          await run(
            tx,
            "select * from search.creator_open_retry_after($1::uuid)",
            [brand],
          ),
        ),
      }));
      return { owner, tried };
    });
    expect(outcome.owner).toEqual({
      visuals: [
        "account_id",
        "caption",
        "created_at",
        "display_order",
        "height",
        "id",
        "object_key",
        "state",
        "width",
      ],
      region: true,
      public_ref: false,
      storage: false,
    });
    expect(outcome.tried).toEqual({
      openings: INSUFFICIENT_PRIVILEGE,
      visuals: INSUFFICIENT_PRIVILEGE,
      objects: INSUFFICIENT_PRIVILEGE,
      region: INSUFFICIENT_PRIVILEGE,
      bucket: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("L3F-T3 the controls in their order (modele §2, §3; 10 RG1, RG2, CA59; T14)", () => {
  it("L3F-T3 CA59: the switch false answers {state: closed} and no visual, writes and counts nothing, even with a full bucket", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creator = await newCreator(tx);
      const visual = await newVisual(tx, creator, "approved", 1);
      await setting(tx, "is_open_to_advertisers", false);
      const closed = await open(tx, brand, creator.alias);
      const image = await readVisual(tx, brand, creator.alias, visual.id);
      await giveOpenings(tx, brand, creator, 60, "1 hour");
      const full = await open(tx, brand, creator.alias);
      const [lines] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.profile_openings where account_id = ${brand}`;
      return {
        closed: closed.answer,
        full: full.answer,
        image: bytesOf(image),
        lines: lines?.n,
      };
    });
    expect(outcome.closed).toEqual({ state: "closed" });
    expect(outcome.full).toEqual({ state: "closed" });
    expect(outcome.image).toBe("[]");
    // the 60 lines of the fixture, none of the door
    expect(outcome.lines).toBe(60);
  });

  it("L3F-T3 RG1, T14: a brand profile in draft, pending, refused or suspended answers {state: brand_not_published} and reads no visual, whatever the switch, and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const visual = await newVisual(tx, creator, "approved", 1);
      const answers: Answer[] = [];
      const images: string[] = [];
      const brands: string[] = [];
      for (const status of [
        "draft",
        "pending_review",
        "rejected",
        "suspended",
      ] as const) {
        const brand = await newBrand(tx, { status });
        brands.push(brand);
        answers.push((await open(tx, brand, creator.alias)).answer);
        images.push(
          bytesOf(await readVisual(tx, brand, creator.alias, visual.id)),
        );
      }
      await setting(tx, "is_open_to_advertisers", false);
      const draft = await newBrand(tx, { status: "draft" });
      answers.push((await open(tx, draft, creator.alias)).answer);
      const [lines] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.profile_openings
         where account_id = any(${[...brands, draft]}::uuid[])`;
      return { answers, images, lines: lines?.n };
    });
    expect(outcome.answers).toEqual(
      Array(5).fill({ state: "brand_not_published" }),
    );
    expect(outcome.images).toEqual(Array(4).fill("[]"));
    expect(outcome.lines).toBe(0);
  });

  it("L3F-T3 refuses a creator, an agent and a brand whose account is not active (42501); a visual answers 42501 to a role without the door, no row to a refused brand; nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const visual = await newVisual(tx, creator, "approved", 1);
      const suspended = await newBrand(tx, { account: "suspended" });
      const asCreator = await actAsMember(
        tx,
        "influx_creator",
        { accountId: creator.id, role: "creator", aal: "aal1" },
        async () => ({
          profile: errorOf(await run(tx, PROFILE, [creator.alias])),
          visual: errorOf(await run(tx, VISUAL, [creator.alias, visual.id])),
        }),
      );
      const asAgent = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal2" },
        async () => ({
          profile: errorOf(await run(tx, PROFILE, [creator.alias])),
          visual: errorOf(await run(tx, VISUAL, [creator.alias, visual.id])),
        }),
      );
      const asSuspended = await open(tx, suspended, creator.alias);
      const image = await readVisual(tx, suspended, creator.alias, visual.id);
      const [lines] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.profile_openings
         where account_id in (${creator.id}, ${suspended}, ${agentA}) and created_at = now()`;
      return {
        asCreator,
        asAgent,
        suspended: errorOf(asSuspended.outcome),
        image: bytesOf(image),
        lines: lines?.n,
      };
    });
    expect(outcome.asCreator).toEqual({
      profile: INSUFFICIENT_PRIVILEGE,
      visual: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.asAgent).toEqual({
      profile: INSUFFICIENT_PRIVILEGE,
      visual: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.suspended).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.image).toBe("[]");
    expect(outcome.lines).toBe(0);
  });
});

describe("L3F-T3 CA49: the unknown and the excluded, one answer (10 RG26 to RG31, RG65; 18 T14.3)", () => {
  it("L3F-T3 CA49: an unknown alias, a malformed one and a creator excluded by E1 to E6 answer the same bytes (P0002 creator), read no visual, write and count nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const excluded = {
        draft: await newCreator(tx, { status: "draft" }),
        hidden: await newCreator(tx, { searchable: false }),
        suspended: await newCreator(tx, { account: "suspended" }),
        minor: await newCreator(tx, { adult: false }),
        blocked: await newCreator(tx),
        refusing: await newCreator(tx, { refused: ["sports_leisure"] }),
      };
      await giveBlock(tx, brand, excluded.blocked);
      const [fresh] = await tx<{ alias: string }[]>`
        select profiles.new_creator_alias() as alias`;
      const visuals: Record<string, string> = {};
      for (const [name, creator] of Object.entries(excluded)) {
        visuals[name] = (await newVisual(tx, creator, "approved", 1)).id;
      }
      const answers: Record<string, string> = {};
      const images: Record<string, string> = {};
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
        answers[name] = bytesOf((await open(tx, brand, alias)).outcome);
      }
      for (const [name, creator] of Object.entries(excluded)) {
        images[name] = bytesOf(
          await readVisual(tx, brand, creator.alias, visuals[name] ?? null),
        );
      }
      const [lines] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.profile_openings where account_id = ${brand}`;
      return { answers, images, lines: lines?.n };
    });
    const unknown = outcome.answers["unknown"];
    expect(JSON.parse(unknown ?? "{}")).toEqual({
      code: "P0002",
      detail: "creator",
      message: "creator_not_found",
    });
    expect(
      Object.entries(outcome.answers).filter(([, bytes]) => bytes !== unknown),
    ).toEqual([]);
    expect(Object.keys(outcome.answers)).toHaveLength(11);
    expect(
      Object.entries(outcome.images).filter(([, bytes]) => bytes !== "[]"),
    ).toEqual([]);
    expect(outcome.lines).toBe(0);
  });
});

describe("L3F-T3 the profile served (10 RG15, RG47, RG48, RG50; CA6, CA14, CA15)", () => {
  it("L3F-T3 CA6, RG50: the profile carries exactly the card of the search (from its one source) and the region beside it, nothing of RG48, not even null", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const others = await newCreators(tx, 4);
      const subject = await newCreator(tx, { refused: ["gambling"] });
      const approved = await newVisual(tx, subject, "approved", 1);
      const pending = await newVisual(tx, subject, "pending", 2);
      const [ref] = await tx<{ public_ref: string }[]>`
        select public_ref::text from profiles.creator_public_profiles
         where account_id = ${subject.id}`;
      const searched = await search(tx, brand);
      const opened = await open(tx, brand, subject.alias);
      const raw = await rawOpen(tx, brand, subject.alias);
      return {
        card: cardOf(searched.answer, subject.alias),
        answer: opened.answer,
        raw,
        approved: approved.id,
        others: others.length,
        markers: [
          subject.id,
          subject.line,
          subject.handle,
          ref?.public_ref ?? "none",
          approved.objectKey,
          pending.id,
          "47312",
          "gambling",
          "pending caption",
          '"status"',
          "lineKey",
          ".webp",
          brand,
        ],
      };
    });
    expect(outcome.card).toBeDefined();
    expect(Object.keys(outcome.answer).sort()).toEqual([
      "creator",
      "reasons",
      "residenceRegion",
      "state",
      "vigilance",
    ]);
    expect(outcome.answer.state).toBe("profile");
    // CA6: the same set of fields as the card, the same values (one source, one projection)
    expect(outcome.answer.creator).toEqual(outcome.card?.creator);
    expect(outcome.answer.creator?.visuals).toEqual([
      { id: outcome.approved, caption: "L3F T3 approved caption" },
    ]);
    // RG15, CA15: below the threshold, the country alone, without message nor count
    expect(outcome.answer.residenceRegion).toBeNull();
    expect(outcome.answer.creator?.["residence_country"]).toBe("FR");
    expect(
      outcome.markers.filter((marker) => outcome.raw.includes(marker)),
    ).toEqual([]);
  });

  it("L3F-T3 CA15, RG15: the region shows from region_display_threshold storefronts E1 to E4 sharing (country, region), the threshold read in table; the same for every brand", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const blocking = await newBrand(tx);
      const subject = await newCreator(tx, { region: REGION });
      const neighbours = await newCreators(tx, 3, { region: REGION });
      // E2 and E3: neither a storefront out of the search nor a suspended account counts
      const hidden = await newCreator(tx, {
        region: REGION,
        searchable: false,
      });
      await newCreator(tx, { region: REGION, account: "suspended" });
      const regionOf = async (who: string) =>
        (await open(tx, who, subject.alias)).answer.residenceRegion;
      const four = await regionOf(brand);
      await tx`update profiles.creator_public_profiles set is_searchable = true
                where account_id = ${hidden.id}`;
      const five = await regionOf(brand);
      // E5 is the brand's: a block of one of the five changes nothing for it (modele §4)
      await giveBlock(tx, blocking, neighbours[0] as Creator);
      const blocked = await regionOf(blocking);
      await setting(tx, "region_display_threshold", 6);
      const six = await regionOf(brand);
      await tx`delete from search.search_settings where key = 'region_display_threshold'`;
      const missing = await open(tx, brand, subject.alias);
      return {
        four,
        five,
        blocked,
        six,
        missing: [missing.answer.state, missing.answer.residenceRegion],
      };
    });
    expect(outcome.four).toBeNull();
    expect(outcome.five).toBe(REGION);
    expect(outcome.blocked).toBe(REGION);
    expect(outcome.six).toBeNull();
    // EC-L3F-03-2: without its threshold, no region, the profile still served
    expect(outcome.missing).toEqual(["profile", null]);
  });

  it("L3F-T3 CA14, RG15: the region is never a filter (22023) and never on the card of a search", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5, { region: REGION });
      const filtered = await search(tx, brand, { ...HERE, region: REGION });
      const listed = await search(tx, brand);
      return {
        filtered: filtered.answer.state,
        listed: listed.answer.state,
        keys: (listed.answer.cards ?? []).map((card) =>
          JSON.stringify(card).includes(REGION),
        ),
      };
    });
    expect(outcome.filtered).toBe(`error ${INVALID_PARAMETER} filters`);
    expect(outcome.listed).toBe("results");
    expect(outcome.keys).toEqual(Array(5).fill(false));
  });

  it("L3F-T3 RG41, RG42: the reasons and the note are those of the search of origin (its filters); without an origin, those of the storefront alone", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      const subject = creators[0] as Creator;
      const filters = { ...HERE, F8: ["fr"] };
      const searched = await search(tx, brand, filters);
      const opened = await open(tx, brand, subject.alias);
      const alone = await open(tx, other, subject.alias);
      return {
        card: cardOf(searched.answer, subject.alias),
        opened: opened.answer,
        alone: alone.answer,
      };
    });
    expect(outcome.opened.reasons).toEqual(outcome.card?.reasons);
    expect(outcome.opened.vigilance).toEqual(outcome.card?.vigilance);
    expect(outcome.opened.reasons).toEqual(
      expect.arrayContaining([
        { code: "language_match", params: { language: "fr" } },
      ]),
    );
    expect(outcome.alone.reasons).toEqual([
      { code: "figures_fresh", params: { network: "instagram" } },
      { code: "primary_topic", params: { topic: "pets" } },
    ]);
  });

  it("L3F-T3 EC-L3F-03-3, RG31: an admitted campaign of origin enters the reasons; rejected since, it is ignored and the profile still served", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      const subject = creators[0] as Creator;
      const campaign = await newCampaign(tx, brand, "real_estate");
      const searched = await search(tx, brand, HERE, campaign);
      const admitted = await open(tx, brand, subject.alias);
      await tx`update campaigns.campaigns set status = 'rejected' where id = ${campaign}`;
      const rejected = await open(tx, brand, subject.alias);
      const codes = (answer: Answer) =>
        (answer.reasons ?? []).map(
          (reason) => (reason as { code: string }).code,
        );
      return {
        card: codes({
          state: "card",
          reasons: cardOf(searched.answer, subject.alias)?.reasons,
        }),
        admitted: codes(admitted.answer),
        rejected: [rejected.answer.state, ...codes(rejected.answer)],
      };
    });
    expect(outcome.card).toContain("campaign_audience_country");
    expect(outcome.admitted).toEqual(outcome.card);
    expect(outcome.rejected[0]).toBe("profile");
    expect(outcome.rejected).not.toContain("campaign_audience_country");
  });
});

describe("L3F-T3 the opening, journaled in the transaction that serves (10 RG66; CA48, CA64)", () => {
  it("L3F-T3 CA48, RG66: an opening from a search marks its impression opened once and journals the account, the creator, the search and the request; a reopening adds a line, the impression unchanged; nothing to leads nor audit", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      const subject = creators[0] as Creator;
      const searched = await search(tx, brand);
      const before = await impressionOf(tx, searched.queryId, subject);
      const count = async () => {
        const [row] = await tx<{ outbox: number; audit: number }[]>`
          select (select count(*)::int from leads.outbox_events) as outbox,
                 (select count(*)::int from audit.audit_events) as audit`;
        return row;
      };
      const quiet = await count();
      const first = await open(tx, brand, subject.alias);
      const after = await impressionOf(tx, searched.queryId, subject);
      const again = await open(tx, brand, subject.alias);
      const twice = await impressionOf(tx, searched.queryId, subject);
      const others = await tx<{ n: number }[]>`
        select count(*)::int as n from search.search_impressions
         where search_query_id = ${searched.queryId ?? null}::uuid and was_opened`;
      return {
        states: [first.answer.state, again.answer.state],
        before,
        after,
        twice,
        opened: others[0]?.n,
        lines: await openingsOf(tx, brand),
        requests: [first.request, again.request].sort(),
        query: searched.queryId,
        subject: subject.id,
        quiet,
        loud: await count(),
      };
    });
    expect(outcome.states).toEqual(["profile", "profile"]);
    expect(outcome.before).toEqual({ opened: false, at: null });
    expect(outcome.after).toEqual({ opened: true, at: true });
    expect(outcome.twice).toEqual({ opened: true, at: true });
    expect(outcome.opened).toBe(1);
    expect(outcome.lines).toEqual(
      outcome.requests.map((request) => ({
        outcome: "served",
        creator: outcome.subject,
        query: outcome.query,
        request,
      })),
    );
    expect(outcome.loud).toEqual(outcome.quiet);
  });

  it("L3F-T3 modele §2: the origin is the latest impression of the creator in a search of the caller served within 24 h; older, or another brand's, no origin and nothing opened", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      const subject = creators[0] as Creator;
      const stale = await giveImpression(tx, brand, subject, "25 hours");
      const earlier = await giveImpression(tx, brand, subject, "2 hours");
      const latest = (await search(tx, brand)).queryId;
      const theirs = await open(tx, other, subject.alias);
      const mine = await open(tx, brand, subject.alias);
      const loner = creators[1] as Creator;
      const older = await giveImpression(tx, other, loner, "25 hours");
      const fromNothing = await open(tx, other, loner.alias);
      return {
        states: [
          theirs.answer.state,
          mine.answer.state,
          fromNothing.answer.state,
        ],
        theirs: (await openingsOf(tx, other)).map((line) => line.query),
        mine: (await openingsOf(tx, brand)).map((line) => line.query),
        latest,
        opened: {
          stale: (await impressionOf(tx, stale, subject))?.opened,
          earlier: (await impressionOf(tx, earlier, subject))?.opened,
          latest: (await impressionOf(tx, latest, subject))?.opened,
          older: (await impressionOf(tx, older, loner))?.opened,
        },
      };
    });
    expect(outcome.states).toEqual(["profile", "profile", "profile"]);
    expect(outcome.theirs).toEqual([null, null]);
    expect(outcome.mine).toEqual([outcome.latest]);
    expect(outcome.opened).toEqual({
      stale: false,
      earlier: false,
      latest: true,
      older: false,
    });
  });

  it("L3F-T3 CA47, fiche invariant 9: a write refused, nothing is served (the opening line, then the impression)", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      const subject = creators[0] as Creator;
      await search(tx, brand);
      await tx.unsafe(`
        create function search.l3f_t3_refuse() returns trigger language plpgsql
          set search_path = '' as $fn$
        begin
          raise exception 'journal refused' using errcode = 'object_not_in_prerequisite_state';
        end $fn$`);
      await tx.unsafe(`
        create trigger l3f_t3_refuse before insert on search.profile_openings
          for each row execute function search.l3f_t3_refuse()`);
      const lineRefused = await open(tx, brand, subject.alias);
      await tx.unsafe("drop trigger l3f_t3_refuse on search.profile_openings");
      await tx.unsafe(
        `revoke update on search.search_impressions from ${OWNER}`,
      );
      const impressionRefused = await open(tx, brand, subject.alias);
      const [lines] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.profile_openings where account_id = ${brand}`;
      return {
        codes: [
          errorOf(lineRefused.outcome),
          errorOf(impressionRefused.outcome),
        ],
        lines: lines?.n,
      };
    });
    expect(outcome.codes).toEqual([
      NOT_IN_PREREQUISITE_STATE,
      INSUFFICIENT_PRIVILEGE,
    ]);
    expect(outcome.lines).toBe(0);
  });
});

describe("L3F-T3 the bucket of the openings (10 RG63, RG64; 18 T15.2, T15.5)", () => {
  it("L3F-T3 T15.2: the 60th opening of the day is served, the 61st refused with retryAfterSeconds until the oldest leaves the 24 h, an unknown alias alike; one rate_limited line, without a creator nor a search; another brand opens", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      const subject = creators[0] as Creator;
      await giveOpenings(tx, brand, subject, 59, "2 hours");
      const sixtieth = await open(tx, brand, subject.alias);
      const refused = await open(tx, brand, subject.alias);
      const unknown = await open(tx, brand, "BCDFGH");
      const theirs = await open(tx, other, subject.alias);
      return {
        sixtieth: sixtieth.answer.state,
        refused: refused.answer,
        unknown: unknown.answer,
        theirs: theirs.answer.state,
        refusals: (await openingsOf(tx, brand)).filter(
          (line) => line.outcome === "rate_limited",
        ),
      };
    });
    expect(outcome.sixtieth).toBe("profile");
    expect(outcome.refused).toEqual({
      state: "rate_limited",
      retryAfterSeconds: 22 * 3600,
    });
    expect(outcome.unknown).toEqual(outcome.refused);
    expect(outcome.theirs).toBe("profile");
    expect(outcome.refusals).toEqual([
      {
        outcome: "rate_limited",
        creator: null,
        query: null,
        request: expect.any(String),
      },
    ]);
  });

  it("L3F-T3 T15.2: profileOpensPerDay is read in table, a reopening counts, a rate_limited line never does", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      const subject = creators[0] as Creator;
      await setting(tx, "rate_limits", {
        perHour: 30,
        perDay: 200,
        profileOpensPerDay: 2,
      });
      const states = [
        (await open(tx, brand, subject.alias)).answer.state,
        (await open(tx, brand, subject.alias)).answer.state,
      ];
      const third = await open(tx, brand, subject.alias);
      await giveOpenings(tx, other, subject, 30, "3 hours", "rate_limited");
      await giveOpenings(tx, other, subject, 1, "3 hours");
      const counted = await open(tx, other, subject.alias);
      return { states, third: third.answer, counted: counted.answer.state };
    });
    expect(outcome.states).toEqual(["profile", "profile"]);
    expect(outcome.third).toEqual({
      state: "rate_limited",
      retryAfterSeconds: 24 * 3600,
    });
    expect(outcome.counted).toBe("profile");
  });
});

describe("L3F-T3 the visuals, relayed (D82 (7), EC-L2G-16; 10 CA50; 07 RG84, RG85)", () => {
  it("L3F-T3 CA50: an approved visual of the creator gives its object (key, sides); pending, rejected, unknown or another creator's gives no row; the door writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      const subject = creators[0] as Creator;
      const neighbour = creators[1] as Creator;
      const approved = await newVisual(tx, subject, "approved", 1);
      const pending = await newVisual(tx, subject, "pending", 2);
      const rejected = await newVisual(tx, subject, "rejected");
      const theirs = await newVisual(tx, neighbour, "approved", 1);
      const read = async (alias: string, visual: string | null) =>
        bytesOf(await readVisual(tx, brand, alias, visual));
      const answers = {
        approved: await readVisual(tx, brand, subject.alias, approved.id),
        pending: await read(subject.alias, pending.id),
        rejected: await read(subject.alias, rejected.id),
        unknown: await read(subject.alias, randomUUID()),
        theirs: await read(subject.alias, theirs.id),
        none: await read(subject.alias, null),
        rightful: await readVisual(tx, brand, neighbour.alias, theirs.id),
      };
      const [written] = await tx<{ openings: number; searches: number }[]>`
        select (select count(*)::int from search.profile_openings
                 where account_id = ${brand}) as openings,
               (select count(*)::int from search.search_queries
                 where account_id = ${brand}) as searches`;
      return { answers, approved, theirs, subject: subject.id, written };
    });
    expect(outcome.answers.approved).toEqual({
      outcome: "rows",
      rows: [
        { object_key: outcome.approved.objectKey, width: 640, height: 480 },
      ],
    });
    expect(outcome.approved.objectKey).toBe(
      `${outcome.subject}/${outcome.approved.id}.webp`,
    );
    expect(outcome.answers).toMatchObject({
      pending: "[]",
      rejected: "[]",
      unknown: "[]",
      theirs: "[]",
      none: "[]",
    });
    expect(outcome.answers.rightful).toEqual({
      outcome: "rows",
      rows: [{ object_key: outcome.theirs.objectKey, width: 640, height: 480 }],
    });
    expect(outcome.written).toEqual({ openings: 0, searches: 0 });
  });

  it("L3F-T3 RG4, RG85: the visual of a creator the engine does not list for the brand gives no row (E2, E5, E6); outside the bucket of the openings", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const visible = await newCreator(tx);
      const hidden = await newCreator(tx, { searchable: false });
      const blocked = await newCreator(tx);
      const refusing = await newCreator(tx, { refused: ["sports_leisure"] });
      await giveBlock(tx, brand, blocked);
      const visuals = {
        visible: await newVisual(tx, visible, "approved", 1),
        hidden: await newVisual(tx, hidden, "approved", 1),
        blocked: await newVisual(tx, blocked, "approved", 1),
        refusing: await newVisual(tx, refusing, "approved", 1),
      };
      await giveOpenings(tx, brand, visible, 60, "1 hour");
      const full = await open(tx, brand, visible.alias);
      const rows = async (creator: Creator, visual: { id: string }) => {
        const read = await readVisual(tx, brand, creator.alias, visual.id);
        return read.outcome === "rows" ? read.rows.length : -1;
      };
      return {
        full: full.answer.state,
        rows: {
          visible: await rows(visible, visuals.visible),
          hidden: await rows(hidden, visuals.hidden),
          blocked: await rows(blocked, visuals.blocked),
          refusing: await rows(refusing, visuals.refusing),
        },
      };
    });
    expect(outcome.full).toBe("rate_limited");
    expect(outcome.rows).toEqual({
      visible: 1,
      hidden: 0,
      blocked: 0,
      refusing: 0,
    });
  });
});
