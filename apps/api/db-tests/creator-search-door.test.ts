// L3E commit 06 — the brand's anonymous creator search door, 0319 (jalons/l3e/06.md; l3e-fiche.md
// invariants 1 to 6, 9 to 16; jalons/l3e/modele.md §1 to §5, §8, §9; 10 RG1, RG2, RG17, RG26 to
// RG31, RG57 to RG59, RG63 to RG66, CA9, CA13, CA17 to CA21, CA34 to CA36, CA41, CA42, CA47, CA48,
// CA59, CA64; 18 TM12.1, TM12.2, TM12.4, TM12.5, T15.2).
//   L3E-T6  the owner, the door and its helpers in the catalogue (one door, EXECUTE for the brand
//           alone, invoker helpers, no dynamic statement), the one source of layer A and the T1-R
//           couples it reaches (never layer I), the rights of the owner column by column; the
//           controls in their order (42501, the contract, RG1, the switch, the bucket, the filters,
//           the campaign, the cap); E1 to E6 silent and out of the count; the filters of the base
//           (RG17); k (0 and 4 byte for byte) and the band; the card; the pages; the journal written
//           by the transaction that serves (a write refused, nothing served); no lead event; the
//           bucket per account (31st in the hour, 201st in the day); the order of tier 8.
// Each case runs in a rolled-back transaction of the local superuser, which sets aside the storefronts
// of earlier runs sharing the audience country of this file (every search filters F6 on it), opens the
// switch (D38: closed by default), writes its fixtures outside the guards, and acts as apps/api does
// (influx_app, then the brand's role and context). The exact count is read from the journal (never
// served), by the request id of each search.
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
const NO_DATA_FOUND = "P0002";

const agentA = accountIdOf("agent", "a");

const OWNER = "influx_creator_search_definer";
const DOOR_SIGNATURE = "search.search_creators(jsonb,text,integer,uuid)";

/** The audience country of this file's storefronts: every search filters F6 on it. */
const COUNTRY = "IS";
const HERE = { F6: { country: COUNTRY } };

const DOOR =
  "select search.search_creators($1::text::jsonb, $2::text, $3::integer, $4::uuid) as answer";
const DOOR_RAW =
  "select search.search_creators($1::text::jsonb, $2::text, $3::integer, $4::uuid)::text as raw";

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | {
      outcome: "error";
      code: string;
      detail: string | undefined;
      message: string;
    };

type Card = {
  creator: Row & {
    alias: string;
    lines: Row[];
    visuals: Row[];
  };
  reasons: unknown[];
  vigilance: unknown;
};

type Answer = {
  state: string;
  countBand?: string;
  page?: number;
  nextPage?: number | null;
  capReached?: boolean;
  retryAfterSeconds?: number;
  cards?: Card[];
};

type Line = {
  search_query_id: string;
  outcome: string;
  filters: Row;
  sort_code: string;
  result_count: number;
  page_reached: number;
  blocked: boolean;
  campaign_id: string | null;
  actor_role: string;
  view_mode: string;
  version: string;
  latest: string;
  request_id: string | null;
};

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE and detail. */
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
    values (${id}, ${randomUUID()}, ${`l3e-t6-${id}@example.test`}, now(), 'FR', 'fr',
            'L3E T6 Person', ${adult}, case when ${adult}::boolean then now() end,
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
  secondary?: string[];
  account?: "active" | "suspended";
};

/** A brand whose profile is published by default (10 RG1). */
async function newBrand(tx: Tx, spec: BrandSpec = {}): Promise<string> {
  const id = await newAccount(tx, "advertiser", { status: spec.account });
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3E T6 Brand', ${spec.sector ?? "sports_leisure"}, '11_50',
            ${`l3e-t6-${id.slice(0, 8)}.example`},
            'A brand of the L3E tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  for (const [index, sector] of (spec.secondary ?? []).entries()) {
    await tx`insert into profiles.advertiser_secondary_sectors (account_id, slot, sector_code)
             values (${id}, ${index + 1}, ${sector})`;
  }
  const status = spec.status ?? "published";
  if (status !== "draft") {
    await tx`update profiles.advertiser_profiles
                set status = ${status}::profiles.advertiser_profile_status
              where account_id = ${id}`;
  }
  return id;
}

/**
 * A campaign of `brand`, its sector given, in `state` (pending_review by default: the first state a
 * search admits as its origin, 0322), or an erased one.
 */
async function newCampaign(
  tx: Tx,
  brand: string,
  sector: string,
  state: CampaignState | "erased" = "pending_review",
): Promise<string> {
  const [row] =
    state === "erased"
      ? await tx<{ id: string }[]>`
        insert into campaigns.campaigns (advertiser_account_id, sector_code, status, erased_at)
        values (${brand}, ${sector}, 'closed', now()) returning id::text`
      : await tx<{ id: string }[]>`
        insert into campaigns.campaigns (advertiser_account_id, sector_code)
        values (${brand}, ${sector}) returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  if (state !== "erased") await putCampaignInState(tx, row.id, state);
  return row.id;
}

type NetworkLine = { network?: string; followers?: number; listed?: boolean };

type CreatorSpec = {
  status?: "published" | "draft" | "pending_review" | "rejected" | "suspended";
  searchable?: boolean;
  account?: "active" | "suspended";
  adult?: boolean;
  topic?: string;
  country?: string;
  share?: "ge_80" | "50_80" | "lt_50";
  lines?: NetworkLine[];
  languages?: string[];
  formats?: string[];
  refused?: string[];
};

type Creator = { id: string; alias: string; lines: string[] };

/**
 * A creator and its storefront, published, searchable and in the file's country by default; one
 * listed Instagram line of 47 312 followers (micro), French, the Instagram reel.
 */
async function newCreator(tx: Tx, spec: CreatorSpec = {}): Promise<Creator> {
  const id = await newAccount(tx, "creator", {
    adult: spec.adult,
    status: spec.account,
  });
  await tx`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')`;
  const lines: string[] = [];
  for (const [index, line] of (spec.lines ?? [{}]).entries()) {
    const [row] = await tx<{ id: string }[]>`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, followers_count, posts_last_30_days,
         avg_comments_per_post, figures_measured_at)
      values (${id}, ${line.network ?? "instagram"}, ${index === 0},
              ${`l3e_t6_${id.slice(0, 8)}_${index}`}, ${line.followers ?? 47312}, 12, 30, now())
      returning id::text`;
    if (row === undefined) throw new Error("no line");
    if (line.listed ?? true) {
      await tx`update profiles.creator_public_networks set listed_at = now()
                where social_account_id = ${row.id}`;
    }
    lines.push(row.id);
  }
  for (const [index, language] of (spec.languages ?? ["fr"]).entries()) {
    await tx`insert into profiles.creator_publication_languages (account_id, slot, language_code)
             values (${id}, ${index + 1}, ${language})`;
  }
  for (const format of spec.formats ?? ["instagram_reel"]) {
    await tx`insert into profiles.creator_formats (account_id, format_code)
             values (${id}, ${format})`;
  }
  for (const sector of spec.refused ?? []) {
    await tx`insert into profiles.creator_refused_sectors (account_id, sector_code)
             values (${id}, ${sector})`;
  }
  const status = spec.status ?? "published";
  const [row] = await tx<{ alias: string }[]>`
    update profiles.creator_public_profiles
       set status = ${status}::profiles.creator_profile_status,
           published_at = case when ${status} in ('published', 'suspended')
                               then now() - interval '40 days' end,
           is_searchable = ${spec.searchable ?? true},
           primary_topic_code = ${spec.topic ?? "pets"},
           main_audience_country = ${spec.country ?? COUNTRY},
           main_audience_share_band = ${spec.share ?? "ge_80"}
     where account_id = ${id}
     returning alias`;
  if (row === undefined) throw new Error("no storefront");
  return { id, alias: row.alias, lines };
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

/** A holding badge « Compte vérifié » of a line, decided by agent A, in `state`. */
async function giveBadge(
  tx: Tx,
  creator: Creator,
  state: "active" | "to_refresh" | "expired" = "active",
  line = 0,
): Promise<void> {
  const lineId = creator.lines[line] ?? "";
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${creator.id}, ${lineId}, 'instagram', 'account_verified', 'pending')
    returning id::text`;
  await tx`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  const [badge] = await tx<{ id: string }[]>`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision)
    values (${creator.id}, ${lineId}, 'instagram', ${request?.id ?? null}, 'account_verified',
            ${agentA}, now(), 'public_profile', 'l3e_t6_handle')
    returning id::text`;
  if (state !== "active") {
    await tx`update verification.badges set state = 'to_refresh' where id = ${badge?.id ?? null}`;
  }
  if (state === "expired") {
    await tx`update verification.badges set state = 'expired' where id = ${badge?.id ?? null}`;
  }
}

const BLOCK_REASON = "t_six_block";

/** A block of the pair, posed by a side (no gesture at Lot 3: the superuser writes it). */
async function giveBlock(
  tx: Tx,
  brand: string,
  creator: Creator,
  side: "advertiser" | "creator" | "influx",
  lifted = false,
): Promise<void> {
  await tx`
    insert into matching.block_reasons (code, label_key, available_to_side)
    values (${BLOCK_REASON}, ${`block.reason.${BLOCK_REASON}`}, 'any')
    on conflict (code) do nothing`;
  const by =
    side === "advertiser" ? brand : side === "creator" ? creator.id : agentA;
  const [row] = await tx<{ id: string }[]>`
    insert into matching.party_blocks
      (advertiser_account_id, creator_account_id, blocked_by_account_id, blocked_by_side,
       reason_code, comment)
    values (${brand}, ${creator.id}, ${by}, ${side}, ${BLOCK_REASON}, 'L3E T6 why the block')
    returning id::text`;
  if (lifted) {
    await tx`update matching.party_blocks set lifted_at = now(), lifted_by_account_id = ${by}
              where id = ${row?.id ?? null}`;
  }
}

/** `count` journal lines of `brand`, `ago` in the past (the bucket of the door counts them). */
async function giveSearches(
  tx: Tx,
  brand: string,
  count: number,
  outcome: "served" | "page_cap" | "rate_limited",
  ago: string,
): Promise<void> {
  await tx`
    insert into search.search_queries
      (account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
       result_count, page_reached, created_at)
    select ${brand}, 'advertiser', 'advertiser_anonymous', ${outcome},
           ${JSON.stringify(outcome === "rate_limited" ? {} : HERE)}::text::jsonb, 'default',
           (select max(version) from search.facet_config_versions), 0, 1,
           now() - ${ago}::interval
      from pg_catalog.generate_series(1, ${count})`;
}

// the searches ------------------------------------------------------------------------------------

type SearchOptions = {
  sort?: string | null;
  page?: number | null;
  campaign?: string | null;
};

type Searched = {
  outcome: Outcome<{ answer: Answer }>;
  answer: Answer;
  line: Line | undefined;
};

/** A search of `brand` as apps/api runs it, then its journal line (by its request id). */
async function search(
  tx: Tx,
  brand: string,
  filters: unknown = HERE,
  options: SearchOptions = {},
): Promise<Searched> {
  const request = `l3e-t6-${randomUUID()}`;
  await tx`select pg_catalog.set_config('influx.request_id', ${request}, true)`;
  const outcome = await actAsMember(
    tx,
    "influx_advertiser",
    { accountId: brand, role: "advertiser", aal: "aal1" },
    () =>
      run<{ answer: Answer }>(tx, DOOR, [
        JSON.stringify(filters),
        options.sort === undefined ? "default" : options.sort,
        options.page === undefined ? 1 : options.page,
        options.campaign ?? null,
      ]),
  );
  const lines = await linesOf(tx, brand, request);
  return {
    outcome,
    answer:
      outcome.outcome === "rows"
        ? (outcome.rows[0]?.answer ?? { state: "none" })
        : { state: `error ${errorOf(outcome)}` },
    line: lines[0],
  };
}

/** The raw text of an answer, byte for byte (CA35). */
async function rawSearch(
  tx: Tx,
  brand: string,
  filters: unknown,
): Promise<string> {
  const outcome = await actAsMember(
    tx,
    "influx_advertiser",
    { accountId: brand, role: "advertiser", aal: "aal1" },
    () =>
      run<{ raw: string }>(tx, DOOR_RAW, [
        JSON.stringify(filters),
        "default",
        1,
        null,
      ]),
  );
  if (outcome.outcome === "error") throw new Error(errorOf(outcome));
  return outcome.rows[0]?.raw ?? "";
}

async function linesOf(
  tx: Tx,
  brand: string,
  request?: string,
): Promise<Line[]> {
  return tx<Line[]>`
    select q.id::text as search_query_id, q.outcome, q.filters, q.sort_code, q.result_count,
           q.page_reached, q.blocked_by_k_anonymity as blocked, q.campaign_id::text as campaign_id,
           q.actor_role, q.view_mode, q.facet_config_version::text as version,
           (select max(v.version)::text from search.facet_config_versions v) as latest,
           q.request_id
      from search.search_queries q
     where q.account_id = ${brand}
       and (${request ?? null}::text is null or q.request_id = ${request ?? null})
     order by q.created_at, q.outcome, q.page_reached`;
}

function aliasesOf(answer: Answer): string[] {
  return (answer.cards ?? []).map((card) => card.creator.alias);
}

// the cases ---------------------------------------------------------------------------------------

describe("L3E-T6 the door, its owner and its helpers in the catalogue (03 P7; fiche invariants 1, 2, 15)", () => {
  it("L3E-T6 makes influx_creator_search_definer NOLOGIN NOINHERIT without member, owner of ONE SECURITY DEFINER door executable by influx_advertiser alone and four invoker helpers executed by nobody, empty search_path, no dynamic statement", async () => {
    const outcome = await scenario(async (tx) => {
      const [role] = await tx<Row[]>`
        select rolcanlogin, rolinherit, rolbypassrls, rolsuper,
               (select count(*)::int from pg_catalog.pg_auth_members m
                 where m.roleid = r.oid and (m.inherit_option or m.set_option)) as members,
               (select count(*)::int from pg_catalog.pg_auth_members m
                 where m.member = r.oid) as memberships
          from pg_catalog.pg_roles r where rolname = ${OWNER}`;
      const functions = await tx<Row[]>`
        select p.oid::regprocedure::text as name, p.prosecdef as definer, p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                              pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers,
               p.prosrc ~* '\\mexecute\\M|query_to_xml|dblink' as dynamic
          from pg_catalog.pg_proc p
         where p.proowner = ${OWNER}::regrole
         order by p.oid::regprocedure::text collate "C"`;
      return { role, functions };
    });
    expect(outcome.role).toEqual({
      rolcanlogin: false,
      rolinherit: false,
      rolbypassrls: false,
      rolsuper: false,
      members: 0,
      memberships: 0,
    });
    const helper = (name: string, callers: string[] = []) => ({
      name,
      definer: false,
      config: ['search_path=""'],
      callers,
      dynamic: false,
    });
    // 0328 (L3G-04, EC-L3G-04-3): one engine (RG4): the engine, the order, the closed entry of the
    // base and the admission run for the agents' identified door, under the rights of its owner
    const AGENT_DOOR_OWNER = ["influx_agent_search_definer"];
    expect(outcome.functions).toEqual([
      // 0324 (L3F-04, EC-L3F-04-8): the eight doors of the shortlists, the brand's alone, and their
      // six invoker helpers
      {
        name: "search.add_to_shortlist(uuid,text)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      helper("search.anonymous_card(uuid)"),
      helper("search.check_creator_search_filters(jsonb)", AGENT_DOOR_OWNER),
      helper("search.check_shortlist_name(text)"),
      {
        name: "search.create_shortlist(text,uuid)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      helper(
        "search.creator_candidates(text,uuid,jsonb,uuid)",
        AGENT_DOOR_OWNER,
      ),
      // 0323 (L3F-03, EC-L3F-03-8): the bucket of the openings, a seventh invoker helper
      helper("search.creator_open_retry_after(uuid)"),
      // 0320 (L3E-07, EC-L3E-07-8): the explainable order, a fifth invoker helper
      helper(
        "search.creator_order(uuid[],jsonb,text,uuid,integer,integer,date)",
        AGENT_DOOR_OWNER,
      ),
      helper("search.creator_search_retry_after(uuid)"),
      {
        name: "search.delete_shortlist(uuid)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      // 0323 (L3F-03, EC-L3F-03-8): the region shown on a profile, an eighth invoker helper
      helper("search.displayed_region(uuid)"),
      // 0322 (L3F-02, EC-L3F-02-1): the admission of a campaign of origin, a sixth invoker helper
      helper("search.is_admitted_campaign(uuid,uuid)", AGENT_DOOR_OWNER),
      {
        name: "search.list_shortlists()",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      // 0323 (L3F-03, EC-L3F-03-8): the doors of the profile and of a visual, the brand's alone
      {
        name: "search.open_creator_profile(text)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      {
        name: "search.read_creator_visual(text,uuid)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      {
        name: "search.read_shortlist(uuid)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      {
        name: "search.remove_from_shortlist(uuid,text)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      // 0325 (L3F-05, EC-L3F-05-7): the brand's request for a selection by the team
      {
        name: "search.request_team_selection(jsonb,uuid,text)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      helper("search.require_creator_searcher()"),
      {
        name: DOOR_SIGNATURE,
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      helper("search.selection_limit(text)"),
      {
        name: "search.set_shortlist_note(uuid,text,text)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
      helper("search.shortlist_creator(uuid,text,uuid)"),
      helper("search.shortlist_gate()"),
      helper("search.shortlist_summaries(uuid,uuid)"),
      {
        name: "search.update_shortlist(uuid,text,uuid)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_advertiser"],
        dynamic: false,
      },
    ]);
  });

  it("L3E-T6 serves layer A from ONE source, profiles.creator_layer_a() (invoker, STABLE, the creator and the owner only), and reaches by name the relations of layer A and the refused sectors, never layer I (T1-R by couple)", async () => {
    const outcome = await scenario(async (tx) => {
      const [card] = await tx<Row[]>`
        select pg_catalog.pg_get_userbyid(p.proowner) like 'influx\\_%' as influx_owner,
               p.prosecdef as definer, p.provolatile as volatility, p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                              pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers
          from pg_catalog.pg_proc p
         where p.oid = 'profiles.creator_layer_a(uuid)'::regprocedure`;
      const named = await tx<{ name: string }[]>`
        select distinct lower(m[1]) as name
          from pg_catalog.pg_proc p,
               regexp_matches(p.prosrc, 'profiles\\s*\\.\\s*(creator_[a-z_]+)', 'gi') m
         where p.proowner = ${OWNER}::regrole
            or p.oid = 'profiles.creator_layer_a(uuid)'::regprocedure`;
      const [door] = await tx<{ names: boolean }[]>`
        select p.prosrc ~ 'profiles\\.creator_layer_a\\(' and p.prosrc ~ 'search\\.creator_candidates\\('
                 as names
          from pg_catalog.pg_proc p where p.oid = ${DOOR_SIGNATURE}::regprocedure`;
      return { card, named: named.map((row) => row.name).sort(), door };
    });
    expect(outcome.card).toEqual({
      influx_owner: false,
      definer: false,
      volatility: "s",
      config: ['search_path=""'],
      callers: ["influx_creator", OWNER],
    });
    expect(outcome.door?.names).toBe(true);
    expect(outcome.named).toEqual([
      "creator_formats",
      "creator_layer_a",
      "creator_public_audience",
      "creator_public_networks",
      "creator_public_profiles",
      "creator_publication_languages",
      "creator_refused_sectors",
      "creator_tones",
      "creator_topics",
      "creator_usage_rights",
    ]);
  });

  it("L3E-T6 gives the owner layer A of a published and searchable storefront column by column and the pair of its active blocks by its own policy; it writes its journal lines, impressions and exposures only; never layer I, public_ref, the region, leads.*, a coordinate nor a budget", async () => {
    const outcome = await scenario(async (tx) => {
      const columns = await tx<{ name: string }[]>`
        select at.attrelid::regclass::text || '.' || at.attname as name
          from pg_catalog.pg_attribute at
         where at.attrelid in ('profiles.creator_public_profiles'::regclass,
                               'matching.party_blocks'::regclass,
                               'campaigns.campaigns'::regclass)
           and at.attnum > 0 and not at.attisdropped
           and pg_catalog.has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'SELECT')
         order by at.attrelid::regclass::text || '.' || at.attname collate "C"`;
      const policies = await tx<Row[]>`
        select policyname, roles::text[] as roles, cmd, qual
          from pg_catalog.pg_policies
         where schemaname = 'matching' and tablename = 'party_blocks'
           and policyname like '%select'
         order by 1`;
      const writes = await tx<{ name: string }[]>`
        select c.oid::regclass::text as name
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema')
           and (pg_catalog.has_table_privilege(${OWNER}, c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
                or pg_catalog.has_any_column_privilege(${OWNER}, c.oid, 'INSERT, UPDATE'))
         order by c.oid::regclass::text collate "C"`;
      const [never] = await tx<Row[]>`
        select
          (select coalesce(array_agg(c.oid::regclass::text order by 1), '{}')
             from pg_catalog.pg_class c
             join pg_catalog.pg_namespace n on n.oid = c.relnamespace
            where c.relkind in ('r', 'p')
              and (n.nspname = 'leads'
                   or c.oid in ('profiles.creator_identities'::regclass,
                                'profiles.creator_social_accounts'::regclass,
                                'profiles.creator_audience_ages'::regclass,
                                'profiles.creator_audience_countries'::regclass,
                                'profiles.creator_audience_genders'::regclass,
                                'profiles.creator_network_metrics_history'::regclass,
                                'profiles.advertiser_contact_details'::regclass,
                                'profiles.advertiser_internal_details'::regclass))
              and pg_catalog.has_any_column_privilege(${OWNER}, c.oid,
                                                      'SELECT, INSERT, UPDATE')) as reached,
          pg_catalog.has_column_privilege(${OWNER}, 'profiles.portfolio_items', 'object_key',
                                          'SELECT') as object_key`;
      return {
        columns: columns.map((row) => row.name),
        policies,
        writes,
        never,
      };
    });
    expect(outcome.columns).toEqual([
      "campaigns.campaigns.advertiser_account_id",
      "campaigns.campaigns.erased_at",
      "campaigns.campaigns.id",
      "campaigns.campaigns.sector_code",
      // 0322 (L3F-02, EC-L3F-02-1): the state of a campaign of origin (L3ES-1)
      "campaigns.campaigns.status",
      "matching.party_blocks.advertiser_account_id",
      "matching.party_blocks.creator_account_id",
      "matching.party_blocks.lifted_at",
      ...[
        "accepts_non_monetary",
        "account_id",
        "alias",
        "audience_gender_band",
        "availability_band",
        "bio",
        "collaboration_experience_band",
        "delivery_lead_band",
        "headline",
        "is_searchable",
        "main_audience_country",
        "main_audience_share_band",
        "max_exclusivity_band",
        "primary_topic_code",
        "published_at",
        "residence_country_code",
        // 0323 (L3F-03, EC-L3F-03-8): the region, shown on the profile above its threshold (RG15)
        "residence_region_code",
        "status",
        "travel_scope",
      ].map((name) => `profiles.creator_public_profiles.${name}`),
    ]);
    // four readers, four policies: the agents' identified door (0328, the pair shown, never its motive),
    // the creator's feed (0317), this door, the erasure (0318)
    expect(outcome.policies).toEqual([
      expect.objectContaining({
        policyname: "party_blocks_agent_search_definer_select",
        roles: ["influx_agent_search_definer"],
      }),
      expect.objectContaining({
        policyname: "party_blocks_campaign_feed_definer_select",
        roles: ["influx_campaign_feed_definer"],
      }),
      {
        policyname: "party_blocks_creator_search_definer_select",
        roles: [OWNER],
        cmd: "SELECT",
        qual: "((advertiser_account_id = ( SELECT influx.current_account_id() AS current_account_id)) AND (lifted_at IS NULL))",
      },
      expect.objectContaining({
        policyname: "party_blocks_privacy_definer_select",
        roles: ["influx_privacy_definer"],
      }),
    ]);
    expect(outcome.writes.map((row) => row.name)).toEqual([
      "search.creator_exposures",
      // 0320 (L3E-07, EC-L3E-07-8): the reasons of its impressions
      "search.impression_reasons",
      // 0323 (L3F-03, EC-L3F-03-8): its openings of a profile (the impressions opened once)
      "search.profile_openings",
      "search.search_impressions",
      "search.search_queries",
      // 0325 (L3F-05, EC-L3F-05-7): the caller's requests for a selection, inserted by its door
      "search.selection_requests",
      // 0324 (L3F-04, EC-L3F-04-8): the caller's own shortlists and their items, by its doors
      "search.shortlist_items",
      "search.shortlists",
    ]);
    // 0323 (L3F-03, modele §3, -1): the key of an approved visual is read by the door of the visual
    // and relayed by apps/api, never served (L3F-T3)
    expect(outcome.never).toEqual({ reached: [], object_key: true });
  });

  it("L3E-T6 gives the brand USAGE on search and the door only: no right on a table of search, matching, verification nor profiles.creator_*, 42501 on the storefront and on the engine", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const [catalogue] = await tx<Row[]>`
        select
          (select coalesce(array_agg(c.oid::regclass::text order by 1), '{}')
             from pg_catalog.pg_class c
             join pg_catalog.pg_namespace n on n.oid = c.relnamespace
            where c.relkind in ('r', 'p', 'v', 'm')
              and (n.nspname in ('search', 'matching', 'verification')
                   or (n.nspname = 'profiles' and c.relname like 'creator\\_%'))
              and (pg_catalog.has_table_privilege('influx_advertiser', c.oid,
                     'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
                   or pg_catalog.has_any_column_privilege('influx_advertiser', c.oid,
                        'SELECT, INSERT, UPDATE, REFERENCES'))) as tables,
          (select coalesce(array_agg(p.oid::regprocedure::text order by 1), '{}')
             from pg_catalog.pg_proc p
             join pg_catalog.pg_namespace n on n.oid = p.pronamespace
            where pg_catalog.has_function_privilege('influx_advertiser', p.oid, 'EXECUTE')
              and (n.nspname = 'search'
                   or (n.nspname = 'profiles' and p.proname like '%creator%'))) as functions`;
      const tried = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brand, role: "advertiser", aal: "aal1" },
        async () => ({
          storefront: errorOf(
            await run(
              tx,
              "select alias from profiles.creator_public_profiles limit 1",
            ),
          ),
          card: errorOf(
            await run(tx, "select profiles.creator_layer_a($1::uuid)", [brand]),
          ),
          engine: errorOf(
            await run(
              tx,
              "select * from search.creator_candidates('advertiser_anonymous', $1::uuid, '{}', null)",
              [brand],
            ),
          ),
          journal: errorOf(
            await run(tx, "select count(*) from search.search_queries"),
          ),
        }),
      );
      // `order by 1` in an aggregate orders by a constant: the functions sorted here (0324, eleven)
      return {
        catalogue: {
          ...catalogue,
          functions: [...((catalogue?.functions as string[]) ?? [])].sort(),
        },
        tried,
      };
    });
    expect(outcome.catalogue).toEqual({
      tables: [],
      // 0323 (L3F-03, EC-L3F-03-8): the doors of the profile and of a visual beside the search's
      // 0324 (L3F-04, EC-L3F-04-8): the eight doors of the shortlists, by alias
      functions: [
        "search.add_to_shortlist(uuid,text)",
        "search.create_shortlist(text,uuid)",
        "search.delete_shortlist(uuid)",
        "search.list_shortlists()",
        "search.open_creator_profile(text)",
        "search.read_creator_visual(text,uuid)",
        "search.read_shortlist(uuid)",
        "search.remove_from_shortlist(uuid,text)",
        // 0325 (L3F-05, EC-L3F-05-7): the request for a selection by the team
        "search.request_team_selection(jsonb,uuid,text)",
        DOOR_SIGNATURE,
        "search.set_shortlist_note(uuid,text,text)",
        "search.update_shortlist(uuid,text,uuid)",
      ],
    });
    expect(outcome.tried).toEqual({
      storefront: INSUFFICIENT_PRIVILEGE,
      card: INSUFFICIENT_PRIVILEGE,
      engine: INSUFFICIENT_PRIVILEGE,
      journal: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("L3E-T6 the controls in their order (modele §4; 10 RG1, RG2, CA59; T14)", () => {
  it("L3E-T6 CA59: the switch false answers {state: closed}, writes and counts nothing, even with a full bucket", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      await setting(tx, "is_open_to_advertisers", false);
      const closed = await search(tx, brand);
      await giveSearches(tx, brand, 30, "served", "10 minutes");
      const full = await search(tx, brand);
      const lines = await linesOf(tx, brand);
      return { closed: closed.answer, full: full.answer, lines: lines.length };
    });
    expect(outcome.closed).toEqual({ state: "closed" });
    expect(outcome.full).toEqual({ state: "closed" });
    // the 30 lines of the fixture, none of the door
    expect(outcome.lines).toBe(30);
  });

  it("L3E-T6 RG1, T14: a brand profile in draft, pending, refused or suspended answers {state: brand_not_published}, whatever the switch, and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreators(tx, 5);
      const answers: Answer[] = [];
      const written: number[] = [];
      for (const status of [
        "draft",
        "pending_review",
        "rejected",
        "suspended",
      ] as const) {
        const brand = await newBrand(tx, { status });
        answers.push((await search(tx, brand)).answer);
        written.push((await linesOf(tx, brand)).length);
      }
      await setting(tx, "is_open_to_advertisers", false);
      const draft = await newBrand(tx, { status: "draft" });
      answers.push((await search(tx, draft)).answer);
      return { answers, written };
    });
    expect(outcome.answers).toEqual(
      Array(5).fill({ state: "brand_not_published" }),
    );
    expect(outcome.written).toEqual([0, 0, 0, 0]);
  });

  it("L3E-T6 refuses a creator, an agent and a brand whose account is not active (42501), and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const suspended = await newBrand(tx, { account: "suspended" });
      const asCreator = await actAsMember(
        tx,
        "influx_creator",
        { accountId: creator.id, role: "creator", aal: "aal1" },
        () => run(tx, DOOR, [JSON.stringify(HERE), "default", 1, null]),
      );
      const asAgent = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal2" },
        () => run(tx, DOOR, [JSON.stringify(HERE), "default", 1, null]),
      );
      const asSuspended = await search(tx, suspended);
      const [lines] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.search_queries
         where account_id in (${creator.id}, ${suspended}, ${agentA})
           and created_at = now()`;
      return {
        codes: [
          errorOf(asCreator),
          errorOf(asAgent),
          errorOf(asSuspended.outcome),
        ],
        lines: lines?.n,
      };
    });
    expect(outcome.codes).toEqual(Array(3).fill(INSUFFICIENT_PRIVILEGE));
    expect(outcome.lines).toBe(0);
  });

  it("L3E-T6 refuses a sort or a page outside the contract (22023 sort, page) before anything is written", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const refused = [
        await search(tx, brand, HERE, { sort: "price" }),
        await search(tx, brand, HERE, { sort: null }),
        await search(tx, brand, HERE, { page: 0 }),
        await search(tx, brand, HERE, { page: 51 }),
        await search(tx, brand, HERE, { page: null }),
      ].map((searched) => errorOf(searched.outcome));
      const accepted = [];
      for (const sort of [
        "default",
        "audience",
        "verified_first",
        "new_profiles",
      ]) {
        accepted.push(
          (await search(tx, brand, HERE, { sort })).line?.sort_code,
        );
      }
      return { refused, accepted, lines: (await linesOf(tx, brand)).length };
    });
    expect(outcome.refused).toEqual([
      `${INVALID_PARAMETER} sort`,
      `${INVALID_PARAMETER} sort`,
      `${INVALID_PARAMETER} page`,
      `${INVALID_PARAMETER} page`,
      `${INVALID_PARAMETER} page`,
    ]);
    expect(outcome.accepted).toEqual([
      "default",
      "audience",
      "verified_first",
      "new_profiles",
    ]);
    expect(outcome.lines).toBe(4);
  });

  it("L3E-T6 CA13, D78: refuses an unknown key, a closed facet (F2, F5, F12), a facet closed by the administrator and every malformed value (22023 filters), nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const twenty = Array.from({ length: 21 }, (_, index) => `code_${index}`);
      // twenty codes of 64 signs each: every value valid, the whole over 2 000 bytes
      const long = Array.from(
        { length: 20 },
        (_, index) => `${"x".repeat(60)}_${String(index).padStart(3, "0")}`,
      );
      const filters: unknown[] = [
        null,
        [],
        "F6",
        { ...HERE, F99: "x" },
        { ...HERE, size: 200 },
        { ...HERE, F2: ["food"] },
        { ...HERE, F5: ["high"] },
        { ...HERE, F12: ["500_1000"] },
        { ...HERE, F3: [] },
        { ...HERE, F3: twenty },
        { ...HERE, F3: ["instagram", "instagram"] },
        { ...HERE, F3: [1] },
        { ...HERE, F3: "instagram" },
        { ...HERE, F3: ["insta gram"] },
        { ...HERE, F1: ["pets"] },
        { F6: { shareBands: ["ge_80"] } },
        { F6: { country: "is" } },
        { F6: { country: COUNTRY, shareBands: ["gt_90"] } },
        { F6: { country: COUNTRY, shareBands: [] } },
        { F6: { country: COUNTRY, region: "x" } },
        { ...HERE, F17: ["brand_verified"] },
        { ...HERE, F8: long, F11: long },
      ];
      const codes: string[] = [];
      for (const value of filters) {
        codes.push(errorOf((await search(tx, brand, value)).outcome));
      }
      // a base facet the administrator closed (RG11): refused as a closed one
      await tx`update search.facet_settings set is_open = false where facet_code = 'F17'`;
      codes.push(
        errorOf(
          (await search(tx, brand, { ...HERE, F17: ["account_verified"] }))
            .outcome,
        ),
      );
      return { codes, lines: (await linesOf(tx, brand)).length };
    });
    expect(outcome.codes).toEqual(
      Array(23).fill(`${INVALID_PARAMETER} filters`),
    );
    expect(outcome.lines).toBe(0);
  });

  it("L3E-T6 T14: a campaign unknown, of another brand or erased gets one error (P0002 campaign); the brand's own campaign is journaled", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      await newCreators(tx, 5);
      const own = await newCampaign(tx, brand, "beauty_personal_care");
      const theirs = await newCampaign(tx, other, "beauty_personal_care");
      const erased = await newCampaign(
        tx,
        brand,
        "beauty_personal_care",
        "erased",
      );
      const refused = [];
      for (const campaign of [randomUUID(), theirs, erased]) {
        refused.push(
          errorOf((await search(tx, brand, HERE, { campaign })).outcome),
        );
      }
      const accepted = await search(tx, brand, HERE, { campaign: own });
      return {
        refused,
        state: accepted.answer.state,
        campaign: accepted.line?.campaign_id,
        own,
      };
    });
    expect(outcome.refused).toEqual(Array(3).fill(`${NO_DATA_FOUND} campaign`));
    expect(outcome.state).toBe("results");
    expect(outcome.campaign).toBe(outcome.own);
  });
});

/** The engine run by the superuser for `brand`: the candidates it keeps (E1 to E6, the filters). */
async function candidatesOf(
  tx: Tx,
  brand: string,
  campaign: string | null,
): Promise<string[]> {
  const rows = await tx<{ id: string }[]>`
    select c.creator_account_id::text as id
      from search.creator_candidates('advertiser_anonymous', ${brand}::uuid,
                                     ${JSON.stringify(HERE)}::text::jsonb, ${campaign}::uuid) c
     order by 1`;
  return rows.map((row) => row.id);
}

describe("L3F-T2 only a campaign out of draft anchors a search (0322, L3ES-1; l3f/modele.md §1)", () => {
  it("L3F-T2 L3ES-1: a campaign of origin in draft or rejected answers byte for byte as an unknown one (P0002 campaign), nothing written nor counted", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      const draft = await newCampaign(tx, brand, "gambling", "draft");
      const rejected = await newCampaign(tx, brand, "gambling", "rejected");
      const answers: string[] = [];
      for (const campaign of [randomUUID(), draft, rejected]) {
        const searched = await search(tx, brand, HERE, { campaign });
        answers.push(JSON.stringify(searched.outcome));
      }
      return { answers, lines: await linesOf(tx, brand) };
    });
    const [unknown, ...others] = outcome.answers;
    expect(JSON.parse(unknown ?? "{}")).toMatchObject({
      outcome: "error",
      code: NO_DATA_FOUND,
      detail: "campaign",
    });
    expect(others).toEqual([unknown, unknown]);
    // nothing journaled, so nothing counted by the bucket of the account
    expect(outcome.lines).toEqual([]);
  });

  it("L3F-T2 L3ES-1, RG31: the sector of a draft changed between two searches has no observable effect; the engine ignores it; submitted, the sector counts", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      const refuser = await newCreator(tx, { refused: ["gambling"] });
      const draft = await newCampaign(tx, brand, "alcohol", "draft");
      const before = JSON.stringify(
        (await search(tx, brand, HERE, { campaign: draft })).outcome,
      );
      const engineBefore = await candidatesOf(tx, brand, draft);
      await tx`update campaigns.campaigns set sector_code = 'gambling' where id = ${draft}`;
      const after = JSON.stringify(
        (await search(tx, brand, HERE, { campaign: draft })).outcome,
      );
      const engineAfter = await candidatesOf(tx, brand, draft);
      const engineAlone = await candidatesOf(tx, brand, null);
      const linesInDraft = await linesOf(tx, brand);
      await putCampaignInState(tx, draft, "pending_review");
      const submitted = await search(tx, brand, HERE, { campaign: draft });
      return {
        before,
        after,
        engineBefore,
        engineAfter,
        engineAlone,
        linesInDraft,
        submitted: {
          state: submitted.answer.state,
          count: submitted.line?.result_count,
          served: aliasesOf(submitted.answer),
          campaign: submitted.line?.campaign_id,
        },
        refuser,
        draft,
      };
    });
    expect(outcome.after).toBe(outcome.before);
    expect(JSON.parse(outcome.before)).toMatchObject({
      outcome: "error",
      code: NO_DATA_FOUND,
      detail: "campaign",
    });
    expect(outcome.linesInDraft).toEqual([]);
    // E6 of the engine: the draft's sector, whatever it is, never removes a creator
    expect(outcome.engineBefore).toEqual(outcome.engineAlone);
    expect(outcome.engineAfter).toEqual(outcome.engineAlone);
    expect(outcome.engineAlone).toContain(outcome.refuser.id);
    expect(outcome.engineAlone).toHaveLength(6);
    // positive control: submitted, its sector is frozen and counts (E6)
    expect(outcome.submitted.state).toBe("results");
    expect(outcome.submitted.count).toBe(5);
    expect(outcome.submitted.served).not.toContain(outcome.refuser.alias);
    expect(outcome.submitted.campaign).toBe(outcome.draft);
  });

  it("L3F-T2 modele §1: a campaign pending_review, published, paused or closed anchors a search: served, journaled with it, its sector excluded (E6)", async () => {
    const states = ["pending_review", "published", "paused", "closed"] as const;
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      // a sector outside the enhanced review (RG85): the fixture publishes without a first reviewer
      const refuser = await newCreator(tx, { refused: ["real_estate"] });
      const served = [];
      for (const state of states) {
        const campaign = await newCampaign(tx, brand, "real_estate", state);
        const [row] = await tx<{ status: string }[]>`
          select status::text from campaigns.campaigns where id = ${campaign}`;
        const searched = await search(tx, brand, HERE, { campaign });
        served.push({
          status: row?.status,
          state: searched.answer.state,
          count: searched.line?.result_count,
          ownCampaign: searched.line?.campaign_id === campaign,
          refuserServed: aliasesOf(searched.answer).includes(refuser.alias),
        });
      }
      return served;
    });
    expect(outcome).toEqual(
      states.map((status) => ({
        status,
        state: "results",
        count: 5,
        ownCampaign: true,
        refuserServed: false,
      })),
    );
  });
});

describe("L3E-T6 the exclusions E1 to E6, silent and out of the count (10 RG26 to RG31)", () => {
  it("L3E-T6 CA18, CA19, L2GS-8, D15: a storefront in draft, pending, refused or suspended, not searchable, of a suspended account or without the attestation of majority is absent and out of the count", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const kept = await newCreators(tx, 5);
      const excluded = [
        await newCreator(tx, { status: "draft" }),
        await newCreator(tx, { status: "pending_review" }),
        await newCreator(tx, { status: "rejected" }),
        await newCreator(tx, { status: "suspended" }),
        await newCreator(tx, { searchable: false }),
        await newCreator(tx, { account: "suspended" }),
        await newCreator(tx, { adult: false }),
      ];
      const searched = await search(tx, brand);
      return {
        count: searched.line?.result_count,
        band: searched.answer.countBand,
        served: aliasesOf(searched.answer).sort(),
        kept: kept.map((creator) => creator.alias).sort(),
        leaked: excluded.filter((creator) =>
          aliasesOf(searched.answer).includes(creator.alias),
        ),
      };
    });
    expect(outcome.count).toBe(5);
    expect(outcome.band).toBe("5_9");
    expect(outcome.served).toEqual(outcome.kept);
    expect(outcome.leaked).toEqual([]);
  });

  it("L3E-T6 CA20: a block of the pair, posed by the brand, the creator or INFLUX, removes the creator silently; lifted, the creator returns; another brand still sees it", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      await newCreators(tx, 5);
      const [byBrand, byCreator, byInflux, lifted] = await newCreators(tx, 4);
      if (!byBrand || !byCreator || !byInflux || !lifted)
        throw new Error("fixtures");
      await giveBlock(tx, brand, byBrand, "advertiser");
      await giveBlock(tx, brand, byCreator, "creator");
      await giveBlock(tx, brand, byInflux, "influx");
      await giveBlock(tx, brand, lifted, "advertiser", true);
      const searched = await search(tx, brand);
      const raw = await rawSearch(tx, brand, HERE);
      const elsewhere = await search(tx, other);
      return {
        count: searched.line?.result_count,
        served: aliasesOf(searched.answer),
        blocked: [byBrand.alias, byCreator.alias, byInflux.alias],
        lifted: lifted.alias,
        filters: searched.line?.filters,
        mentions: /block|t_six/i.test(raw),
        elsewhere: elsewhere.line?.result_count,
      };
    });
    expect(outcome.count).toBe(6);
    expect(outcome.served).toContain(outcome.lifted);
    expect(
      outcome.served.filter((alias) => outcome.blocked.includes(alias)),
    ).toEqual([]);
    expect(outcome.filters).toEqual(HERE);
    expect(outcome.mentions).toBe(false);
    expect(outcome.elsewhere).toBe(9);
  });

  it("L3E-T6 CA21, RG31: a sector refused by the creator among the brand's main and secondary sectors and the sector of its campaign removes it; neither the answer nor the journal names the motive", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx, {
        sector: "sports_leisure",
        secondary: ["video_games"],
      });
      const campaign = await newCampaign(tx, brand, "gambling");
      await newCreators(tx, 5);
      const main = await newCreator(tx, { refused: ["sports_leisure"] });
      const secondary = await newCreator(tx, { refused: ["video_games"] });
      const ofCampaign = await newCreator(tx, { refused: ["gambling"] });
      const unrelated = await newCreator(tx, { refused: ["alcohol"] });
      const alone = await search(tx, brand);
      const fromCampaign = await search(tx, brand, HERE, { campaign });
      const raw = await rawSearch(tx, brand, HERE);
      const lines = await linesOf(tx, brand);
      return {
        alone: {
          count: alone.line?.result_count,
          served: aliasesOf(alone.answer),
        },
        fromCampaign: {
          count: fromCampaign.line?.result_count,
          served: aliasesOf(fromCampaign.answer),
        },
        aliases: { main, secondary, ofCampaign, unrelated },
        named: /sports_leisure|video_games|gambling|alcohol|refus/i.test(
          raw + JSON.stringify(lines.map((line) => line.filters)),
        ),
      };
    });
    const { main, secondary, ofCampaign, unrelated } = outcome.aliases;
    expect(outcome.alone.count).toBe(7);
    expect(outcome.alone.served).toEqual(
      expect.arrayContaining([ofCampaign.alias, unrelated.alias]),
    );
    expect(outcome.fromCampaign.count).toBe(6);
    expect(outcome.fromCampaign.served).toContain(unrelated.alias);
    for (const served of [outcome.alone.served, outcome.fromCampaign.served]) {
      expect(served).not.toContain(main.alias);
      expect(served).not.toContain(secondary.alias);
    }
    expect(outcome.fromCampaign.served).not.toContain(ofCampaign.alias);
    expect(outcome.named).toBe(false);
  });
});

describe("L3E-T6 the filters of the base (10 RG12, RG17)", () => {
  it("L3E-T6 CA9: F3 and F4 hold on ONE listed line: macro on Instagram and nano on TikTok is absent for TikTok + macro; an unlisted line never matches", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5, {
        lines: [{ network: "tiktok", followers: 600000 }],
      });
      await newCreators(tx, 4, {
        lines: [{ network: "instagram", followers: 600000 }],
      });
      const subject = await newCreator(tx, {
        lines: [
          { network: "instagram", followers: 600000 },
          { network: "tiktok", followers: 5000 },
        ],
      });
      const unlisted = await newCreator(tx, {
        lines: [
          { network: "instagram", followers: 5000 },
          { network: "tiktok", followers: 600000, listed: false },
        ],
      });
      const tiktok = await search(tx, brand, {
        ...HERE,
        F3: ["tiktok"],
        F4: ["macro"],
      });
      const instagram = await search(tx, brand, {
        ...HERE,
        F3: ["instagram"],
        F4: ["macro"],
      });
      return {
        tiktok: {
          count: tiktok.line?.result_count,
          served: aliasesOf(tiktok.answer),
        },
        instagram: {
          count: instagram.line?.result_count,
          served: aliasesOf(instagram.answer),
        },
        subject: subject.alias,
        unlisted: unlisted.alias,
      };
    });
    expect(outcome.tiktok.count).toBe(5);
    expect(outcome.tiktok.served).not.toContain(outcome.subject);
    expect(outcome.tiktok.served).not.toContain(outcome.unlisted);
    expect(outcome.instagram.count).toBe(5);
    expect(outcome.instagram.served).toContain(outcome.subject);
  });

  it("L3E-T6 CA17: OR inside a facet, AND between facets (F3, F8, F11)", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 3, {
        lines: [{ network: "instagram" }],
        languages: ["fr"],
      });
      await newCreators(tx, 3, {
        lines: [{ network: "tiktok" }],
        languages: ["fr"],
        formats: ["tiktok_video"],
      });
      await newCreators(tx, 2, {
        lines: [{ network: "instagram" }],
        languages: ["en"],
      });
      const counts: (number | undefined)[] = [];
      for (const filters of [
        { ...HERE, F3: ["instagram", "tiktok"], F8: ["fr"] },
        { ...HERE, F3: ["instagram"], F8: ["fr", "en"] },
        { ...HERE, F3: ["instagram"], F8: ["fr"] },
        { ...HERE, F3: ["instagram", "tiktok"], F11: ["tiktok_video"] },
        { ...HERE, F11: ["tiktok_video", "instagram_reel"], F8: ["en", "fr"] },
      ]) {
        counts.push((await search(tx, brand, filters)).line?.result_count);
      }
      return counts;
    });
    expect(outcome).toEqual([6, 5, 3, 3, 8]);
  });

  it("L3E-T6 F1 and F6: the main topic; the main country of the audience and its share, together", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5, { topic: "pets", share: "ge_80" });
      await newCreator(tx, { topic: "pets", share: "50_80" });
      await newCreator(tx, { topic: "food", share: "ge_80" });
      const counts: (number | undefined)[] = [];
      for (const filters of [
        { F6: { country: COUNTRY, shareBands: ["ge_80"] }, F1: "pets" },
        { F6: { country: COUNTRY }, F1: "pets" },
        { F6: { country: COUNTRY, shareBands: ["50_80", "lt_50"] } },
        { F6: { country: COUNTRY, shareBands: ["ge_80"] } },
        { F6: { country: COUNTRY }, F1: "travel" },
      ]) {
        counts.push((await search(tx, brand, filters)).line?.result_count);
      }
      return counts;
    });
    expect(outcome).toEqual([5, 6, 1, 6, 0]);
  });

  it("L3E-T6 F17: a holding badge of a listed line (active or to_refresh), never an expired one nor the badge of an unlisted line", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      for (const creator of await newCreators(tx, 5)) {
        await giveBadge(tx, creator);
      }
      const refresh = await newCreator(tx);
      await giveBadge(tx, refresh, "to_refresh");
      const expired = await newCreator(tx);
      await giveBadge(tx, expired, "expired");
      const unlisted = await newCreator(tx, {
        lines: [{ network: "tiktok" }, { network: "instagram", listed: false }],
      });
      await giveBadge(tx, unlisted, "active", 1);
      await newCreator(tx);
      const verified = await search(tx, brand, {
        ...HERE,
        F17: ["account_verified"],
      });
      const audience = await search(tx, brand, {
        ...HERE,
        F17: ["audience_verified"],
      });
      return {
        count: verified.line?.result_count,
        served: aliasesOf(verified.answer),
        absent: [expired.alias, unlisted.alias],
        refresh: refresh.alias,
        audience: [audience.answer, audience.line?.result_count],
        badges: (verified.answer.cards ?? []).map(
          (card) =>
            (card.creator.lines[0]?.badges as Row[] | undefined)?.length,
        ),
      };
    });
    expect(outcome.count).toBe(6);
    expect(outcome.served).toContain(outcome.refresh);
    expect(
      outcome.served.filter((alias) => outcome.absent.includes(alias)),
    ).toEqual([]);
    expect(outcome.badges).toEqual(Array(6).fill(1));
    expect(outcome.audience).toEqual([{ state: "too_narrow" }, 0]);
  });

  it("L3E-T6 CA13: an engagement declared but not verified is no filter (F5 closed, 22023) and the card carries no engagement band", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      const withF5 = await search(tx, brand, { ...HERE, F5: ["high"] });
      const without = await search(tx, brand);
      return {
        withF5: errorOf(withF5.outcome),
        bands: (without.answer.cards ?? []).map(
          (card) => card.creator.lines[0]?.engagementBand,
        ),
      };
    });
    expect(outcome.withF5).toBe(`${INVALID_PARAMETER} filters`);
    expect(outcome.bands).toEqual(Array(5).fill(null));
  });
});

describe("L3E-T6 k-anonymity and the band (10 RG57 to RG59)", () => {
  it("L3E-T6 TM12.1, CA34, CA35: 0 and 4 results give the same bytes, {state: too_narrow} and nothing else; the journal keeps the exact count and the k block, no impression; 5 results are served", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 4, { topic: "pets" });
      const none = await rawSearch(tx, brand, { ...HERE, F1: "travel" });
      const four = await rawSearch(tx, brand, { ...HERE, F1: "pets" });
      const lines = await linesOf(tx, brand);
      const [impressions] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.search_impressions i
          join search.search_queries q on q.id = i.search_query_id
         where q.account_id = ${brand}`;
      await newCreator(tx, { topic: "pets" });
      const five = await search(tx, brand, { ...HERE, F1: "pets" });
      return {
        none,
        four,
        lines: lines
          .map((line) => [line.outcome, line.result_count, line.blocked])
          .sort((a, b) => Number(a[1]) - Number(b[1])),
        impressions: impressions?.n,
        five: [
          five.answer.state,
          five.answer.countBand,
          five.answer.cards?.length,
        ],
      };
    });
    expect(outcome.none).toBe('{"state": "too_narrow"}');
    expect(outcome.four).toBe(outcome.none);
    expect(outcome.lines).toEqual([
      ["served", 0, true],
      ["served", 4, true],
    ]);
    expect(outcome.impressions).toBe(0);
    expect(outcome.five).toEqual(["results", "5_9", 5]);
  });

  it("L3E-T6 CA36: 37 results are served as the band 25_49, never 37; k is read in table at every search", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 37);
      const served = await search(tx, brand);
      await setting(tx, "k_anonymity_threshold", 40);
      const raised = await search(tx, brand);
      return { served, raised };
    });
    const answer = outcome.served.answer;
    expect(Object.keys(answer).sort()).toEqual([
      "capReached",
      "cards",
      "countBand",
      "nextPage",
      "page",
      "state",
    ]);
    expect(answer).toMatchObject({
      state: "results",
      countBand: "25_49",
      page: 1,
      nextPage: 2,
      capReached: false,
    });
    expect(answer.cards).toHaveLength(12);
    expect(
      Object.values(answer).filter((value) => typeof value === "number"),
    ).toEqual([1, 2]);
    expect(outcome.served.line?.result_count).toBe(37);
    expect(outcome.raised.answer).toEqual({ state: "too_narrow" });
    expect(outcome.raised.line).toMatchObject({
      result_count: 37,
      blocked: true,
    });
  });

  it("L3E-T6 the card: layer A of the storefront without its status, the key of a line nor any field of RG48, referenced by its alias, its approved visuals only, its listed lines only", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 4);
      const subject = await newCreator(tx, {
        lines: [{ network: "instagram" }, { network: "tiktok", listed: false }],
      });
      const [approved] = await tx<{ id: string }[]>`
        insert into profiles.portfolio_items
          (account_id, state, received_bytes, byte_size, width, height, checksum, stored_at,
           sla_due_at, exif_stripped, decided_by_account_id, decided_at, display_order, caption)
        values (${subject.id}, 'approved', 2048, 2048, 640, 480, ${"a".repeat(64)}, now(),
                now() + interval '1 day', true, ${agentA}, now(), 1, 'L3E T6 approved caption')
        returning id::text`;
      await tx`
        insert into profiles.portfolio_items
          (account_id, state, received_bytes, byte_size, width, height, checksum, stored_at,
           sla_due_at, exif_stripped, display_order, caption)
        values (${subject.id}, 'pending', 2048, 2048, 640, 480, ${"b".repeat(64)}, now(),
                now() + interval '1 day', true, 2, 'L3E T6 pending caption')`;
      const [refs] = await tx<{ public_ref: string }[]>`
        select public_ref::text from profiles.creator_public_profiles
         where account_id = ${subject.id}`;
      const searched = await search(tx, brand);
      const raw = await rawSearch(tx, brand, HERE);
      const card = (searched.answer.cards ?? []).find(
        (found) => found.creator.alias === subject.alias,
      );
      return {
        card,
        raw,
        approved: approved?.id,
        markers: [
          subject.id,
          ...subject.lines,
          refs?.public_ref ?? "none",
          `l3e_t6_${subject.id.slice(0, 8)}`,
          "47312",
          "pending caption",
          '"status"',
          "lineKey",
          brand,
        ],
      };
    });
    expect(outcome.card).toBeDefined();
    expect(Object.keys(outcome.card ?? {}).sort()).toEqual([
      "creator",
      "reasons",
      "vigilance",
    ]);
    expect(Object.keys(outcome.card?.creator ?? {}).sort()).toEqual([
      "accepts_non_monetary",
      "alias",
      "audience_bands",
      "audience_gender_band",
      "availability",
      "bio",
      "collaboration_experience",
      "delivery_lead",
      "formats",
      "headline",
      "lines",
      "main_audience_country",
      "main_audience_share_band",
      "max_exclusivity",
      "primary_topic",
      "publication_languages",
      "residence_country",
      "secondary_topics",
      "tones",
      "travel_scope",
      "usage_rights",
      "visuals",
    ]);
    expect(outcome.card?.creator.lines).toHaveLength(1);
    expect(Object.keys(outcome.card?.creator.lines[0] ?? {}).sort()).toEqual([
      "audienceBand",
      "badges",
      "commentBand",
      "engagementBand",
      "figuresMeasuredAt",
      "figuresSource",
      "isPrimary",
      "networkCode",
      "publicationFrequency",
      "reachBand",
    ]);
    expect(outcome.card?.creator.lines[0]).toMatchObject({
      networkCode: "instagram",
      audienceBand: "micro",
    });
    expect(outcome.card?.creator.visuals).toEqual([
      { id: outcome.approved, caption: "L3E T6 approved caption" },
    ]);
    // 0320 (L3E-07, EC-L3E-07-8): the reasons of its tiers, codes and bands only, no note
    expect(outcome.card).toMatchObject({
      reasons: [
        {
          code: "audience_country_match",
          params: { country: COUNTRY, shareBand: "ge_80" },
        },
        { code: "figures_fresh", params: { network: "instagram" } },
      ],
      vigilance: null,
    });
    expect(
      outcome.markers.filter((marker) => outcome.raw.includes(marker)),
    ).toEqual([]);
  });
});

describe("L3E-T6 the pages (10 RG63; TM12.2, CA41, CA42)", () => {
  it("L3E-T6 TM12.2, CA41: the size and the number of pages are read in table; the last page allowed flags capReached, no next page; beyond the results, no card", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 7);
      await setting(tx, "page_size", 2);
      await setting(tx, "max_pages", 3);
      const first = (await search(tx, brand)).answer;
      const last = (await search(tx, brand, HERE, { page: 3 })).answer;
      await setting(tx, "max_pages", 5);
      const beyond = await search(tx, brand, HERE, { page: 5 });
      const [impressions] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.search_impressions
         where search_query_id = ${beyond.line?.search_query_id ?? null}::uuid`;
      return {
        first,
        last,
        beyond: beyond.answer,
        line: beyond.line,
        impressions: impressions?.n,
      };
    });
    expect(outcome.first).toMatchObject({
      page: 1,
      nextPage: 2,
      capReached: false,
    });
    expect(outcome.first.cards).toHaveLength(2);
    expect(outcome.last).toMatchObject({
      page: 3,
      nextPage: null,
      capReached: true,
    });
    expect(outcome.last.cards).toHaveLength(2);
    expect(outcome.beyond).toEqual({
      state: "results",
      countBand: "5_9",
      page: 5,
      nextPage: null,
      capReached: false,
      cards: [],
    });
    expect(outcome.line).toMatchObject({
      outcome: "served",
      result_count: 7,
      page_reached: 5,
    });
    expect(outcome.impressions).toBe(0);
  });

  it("L3E-T6 CA42: a page beyond max_pages answers {state: page_cap} and journals the attempt; the door takes no size parameter", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 7);
      const capped = await search(tx, brand, HERE, { page: 6 });
      const [door] = await tx<Row[]>`
        select p.pronargs as arguments, p.proargnames as names
          from pg_catalog.pg_proc p where p.oid = ${DOOR_SIGNATURE}::regprocedure`;
      return { capped, door };
    });
    expect(outcome.capped.answer).toEqual({ state: "page_cap" });
    expect(outcome.capped.line).toMatchObject({
      outcome: "page_cap",
      result_count: 0,
      page_reached: 6,
      blocked: false,
      filters: HERE,
    });
    expect(outcome.door).toEqual({
      arguments: 4,
      names: ["p_filters", "p_sort", "p_page", "p_campaign_id"],
    });
  });
});

describe("L3E-T6 the journal, written by the transaction that serves (10 RG66; TM12.4, CA47, CA48, CA64)", () => {
  it("L3E-T6 TM12.4: a served search is journaled with its account, role, view, campaign, filters, sort, facet version, exact count, page, k block and request", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand, "beauty_personal_care");
      await newCreators(tx, 6);
      const filters = { ...HERE, F3: ["instagram"], F8: ["fr"] };
      const searched = await search(tx, brand, filters, {
        sort: "verified_first",
        campaign,
      });
      return { line: searched.line, campaign };
    });
    expect(outcome.line).toMatchObject({
      outcome: "served",
      actor_role: "advertiser",
      view_mode: "advertiser_anonymous",
      campaign_id: outcome.campaign,
      filters: { ...HERE, F3: ["instagram"], F8: ["fr"] },
      sort_code: "verified_first",
      result_count: 6,
      page_reached: 1,
      blocked: false,
    });
    expect(outcome.line?.version).toBe(outcome.line?.latest);
    expect(outcome.line?.request_id).toMatch(/^l3e-t6-/);
  });

  it("L3E-T6 CA48: one impression per card served with its rank across pages; the exposures of page 1, once", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creators = await newCreators(tx, 5);
      await setting(tx, "page_size", 2);
      const second = await search(tx, brand, HERE, { page: 2 });
      const exposedAfterSecond = await exposures(tx, creators);
      const first = await search(tx, brand);
      const again = await search(tx, brand);
      const impressions = await tx<
        {
          alias: string;
          rank: number;
          cold: boolean;
          vigilance: string | null;
        }[]
      >`
        select p.alias, i.rank, i.cold_quota as cold, i.vigilance_code as vigilance
          from search.search_impressions i
          join profiles.creator_public_profiles p on p.account_id = i.creator_account_id
         where i.search_query_id = ${second.line?.search_query_id ?? null}::uuid
         order by i.rank`;
      return {
        served: aliasesOf(second.answer),
        impressions,
        exposedAfterSecond,
        exposed: await exposures(tx, creators),
        firstPage: aliasesOf(first.answer).sort(),
        again: again.answer.state,
      };
    });
    expect(outcome.impressions).toEqual(
      outcome.served.map((alias, index) => ({
        alias,
        rank: index + 3,
        cold: false,
        vigilance: null,
      })),
    );
    expect(outcome.exposedAfterSecond).toEqual([]);
    expect(outcome.exposed).toEqual(outcome.firstPage);
    expect(outcome.again).toBe("results");
  });

  it("L3E-T6 CA47: a write of the journal refused, nothing is served (the search line, then an impression)", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      await tx.unsafe(`
        create function search.l3e_t6_refuse() returns trigger language plpgsql
          set search_path = '' as $fn$
        begin
          raise exception 'journal refused' using errcode = 'object_not_in_prerequisite_state';
        end $fn$`);
      await tx.unsafe(`
        create trigger l3e_t6_refuse before insert on search.search_queries
          for each row execute function search.l3e_t6_refuse()`);
      const lineRefused = await search(tx, brand);
      await tx.unsafe("drop trigger l3e_t6_refuse on search.search_queries");
      await tx.unsafe(
        `revoke insert on search.search_impressions from ${OWNER}`,
      );
      const impressionRefused = await search(tx, brand);
      return {
        codes: [
          errorOf(lineRefused.outcome),
          errorOf(impressionRefused.outcome),
        ],
        lines: (await linesOf(tx, brand)).length,
      };
    });
    expect(outcome.codes).toEqual(["55000", INSUFFICIENT_PRIVILEGE]);
    expect(outcome.lines).toBe(0);
  });

  it("L3E-T6 CA64, RG8: a search emits no lead event, no audit line and nothing toward the creator", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      const count = async () => {
        const [row] = await tx<{ outbox: number; audit: number }[]>`
          select (select count(*)::int from leads.outbox_events) as outbox,
                 (select count(*)::int from audit.audit_events) as audit`;
        return row;
      };
      const before = await count();
      const searched = await search(tx, brand);
      const after = await count();
      return { before, after, state: searched.answer.state };
    });
    expect(outcome.state).toBe("results");
    expect(outcome.after).toEqual(outcome.before);
  });
});

describe("L3E-T6 the bucket of the account (10 RG63, RG64; 18 T15.2, T15.5)", () => {
  it("L3E-T6 T15.2: the 31st search of the hour is refused with retryAfterSeconds and nothing served; a page_cap counts; one rate_limited line per window", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      await giveSearches(tx, brand, 29, "served", "10 minutes");
      await giveSearches(tx, brand, 1, "page_cap", "10 minutes");
      const refused = await search(tx, brand);
      const again = await search(
        tx,
        brand,
        { ...HERE, F1: "pets" },
        { page: 2 },
      );
      const lines = await linesOf(tx, brand);
      return {
        refused: refused.answer,
        again: again.answer,
        refusals: lines
          .filter((line) => line.outcome === "rate_limited")
          .map((line) => [
            line.filters,
            line.campaign_id,
            line.result_count,
            line.page_reached,
          ]),
      };
    });
    expect(outcome.refused).toEqual({
      state: "rate_limited",
      retryAfterSeconds: 3000,
    });
    expect(outcome.again).toEqual({
      state: "rate_limited",
      retryAfterSeconds: 3000,
    });
    expect(outcome.refusals).toEqual([[{}, null, 0, 1]]);
  });

  it("L3E-T6 T15.2: the 201st search of the day is refused until the oldest line leaves the 24 h; a rate_limited line never counts", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      await newCreators(tx, 5);
      await giveSearches(tx, brand, 200, "served", "2 hours");
      const refused = await search(tx, brand);
      const again = await search(tx, brand);
      await giveSearches(tx, other, 199, "served", "2 hours");
      await giveSearches(tx, other, 30, "rate_limited", "3 hours");
      const counted = await search(tx, other);
      return {
        refused: refused.answer,
        again: again.answer.state,
        refusals: (await linesOf(tx, brand)).filter(
          (line) => line.outcome === "rate_limited",
        ).length,
        counted: counted.answer.state,
      };
    });
    expect(outcome.refused).toEqual({
      state: "rate_limited",
      retryAfterSeconds: 22 * 3600,
    });
    expect(outcome.again).toBe("rate_limited");
    expect(outcome.refusals).toBe(1);
    expect(outcome.counted).toBe("results");
  });
});

describe("L3E-T6 the order and the identified view (10 RG4, RG5; D11; TM12.5)", () => {
  it("L3E-T6 D11: tiers 1 to 7 equal, tier 8 decides (0320), the same order for two brands the same UTC day, no score served", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx, { sector: "food_beverages" });
      await newCreators(tx, 8);
      const mine = aliasesOf((await search(tx, brand)).answer);
      const theirs = aliasesOf((await search(tx, other)).answer);
      const [expected] = await tx<{ aliases: string[] }[]>`
        select array_agg(p.alias order by pg_catalog.md5(
                 pg_catalog.timezone('UTC', now())::date::text || ':' || p.account_id::text),
                 p.account_id) as aliases
          from profiles.creator_public_profiles p
         where p.main_audience_country = ${COUNTRY} and p.is_searchable
           and p.status = 'published'`;
      const raw = await rawSearch(tx, brand, HERE);
      return { mine, theirs, expected: expected?.aliases, raw };
    });
    expect(outcome.mine).toHaveLength(8);
    expect(outcome.theirs).toEqual(outcome.mine);
    expect(outcome.mine).toEqual(outcome.expected);
    // case-sensitive: an alias is written in capitals only
    expect(/score|rank|md5/.test(outcome.raw)).toBe(false);
  });

  // 0328 (L3G-04, EC-L3G-04-3): the identified view runs under the owner of the agents' door alone;
  // the brand's owner gets 42501 (0A000 until 0327), the agent and the admin hold that door
  it("L3E-T6 TM12.5: the engine refuses the identified view to the brand's owner (42501) and no member holds a door to it, the agent the identified door alone", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await tx.unsafe(`set local role ${OWNER}`);
      await tx`select pg_catalog.set_config('influx.account', ${brand}, true)`;
      const identified = await run(
        tx,
        "select * from search.creator_candidates('agent_identified', $1::uuid, '{}', null)",
        [brand],
      );
      await tx.unsafe("reset role");
      const [doors] = await tx<{ names: string[] }[]>`
        select coalesce(array_agg(r || ' ' || p.oid::regprocedure::text order by 1), '{}') as names
          from pg_catalog.pg_proc p,
               unnest(array['influx_advertiser', 'influx_creator', 'influx_agent']) r
         where p.pronamespace = 'search'::regnamespace
           and has_function_privilege(r, p.oid, 'EXECUTE')
           and p.oid not in ('search.read_open_campaigns(text, integer)'::regprocedure,
                             'search.read_open_campaign(uuid)'::regprocedure,
                             'search.read_open_campaign_brand_logo(uuid)'::regprocedure)`;
      // `order by 1` in an aggregate orders by a constant: the names sorted here (CI 44701258993)
      return {
        identified: errorOf(identified),
        doors: [...(doors?.names ?? [])].sort(),
      };
    });
    expect(outcome.identified).toBe(
      `${INSUFFICIENT_PRIVILEGE} agent_identified`,
    );
    // 0323 (L3F-03, EC-L3F-03-8): the brand's doors of the profile and of a visual, both anonymous
    // 0324 (L3F-04, EC-L3F-04-8): the brand's eight doors of the shortlists, by alias
    // 0325 (L3F-05, EC-L3F-05-7): the brand's request for a selection by the team
    expect(outcome.doors).toEqual([
      "influx_advertiser search.add_to_shortlist(uuid,text)",
      "influx_advertiser search.create_shortlist(text,uuid)",
      "influx_advertiser search.delete_shortlist(uuid)",
      "influx_advertiser search.list_shortlists()",
      "influx_advertiser search.open_creator_profile(text)",
      "influx_advertiser search.read_creator_visual(text,uuid)",
      "influx_advertiser search.read_shortlist(uuid)",
      "influx_advertiser search.remove_from_shortlist(uuid,text)",
      "influx_advertiser search.request_team_selection(jsonb,uuid,text)",
      `influx_advertiser ${DOOR_SIGNATURE}`,
      "influx_advertiser search.set_shortlist_note(uuid,text,text)",
      "influx_advertiser search.update_shortlist(uuid,text,uuid)",
      // 0330 (L3G-06): the agents' four doors of queue 9, the same owner (TM12.5)
      "influx_agent search.close_team_selection_request(uuid,text,text)",
      "influx_agent search.extend_team_selection_claim(uuid)",
      "influx_agent search.open_team_selection_request(uuid)",
      // 0329 (L3G-05): the agents' prefill of « Compatible creators », the same owner (TM12.5)
      "influx_agent search.prefill_campaign_filters(uuid)",
      "influx_agent search.release_team_selection_request(uuid)",
      // 0328 (L3G-04): the agents' identified door, its own owner (TM12.5)
      "influx_agent search.search_creators_identified(jsonb,text,integer,uuid,uuid)",
    ]);
  });
});

async function exposures(
  tx: Tx,
  creators: readonly Creator[],
): Promise<string[]> {
  const rows = await tx<{ alias: string }[]>`
    select p.alias from search.creator_exposures e
      join profiles.creator_public_profiles p on p.account_id = e.creator_account_id
     where e.creator_account_id = any (${creators.map((creator) => creator.id)}::uuid[])
     order by 1`;
  return rows.map((row) => row.alias).sort();
}
