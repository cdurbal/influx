// L3G commit 04 — the identified creator search door of the INFLUX agents, 0328 (jalons/l3g/04.md;
// l3g-fiche.md invariants 1 to 4, 6 to 8; jalons/l3g/modele.md §1 to §3; 10 RG4, RG62, RG71, RG72,
// RG76, RG78, RG87; CA58, CA61; 18 TM12.5, T14).
//   L3G-T4  the owner, the door and its helpers in the catalogue (EXECUTE for influx_agent and
//           influx_admin alone, 42501 for the brand and the creator, the brand's owner never in the
//           identified mode nor on a column of G or of layer I: T1-R by couple); the caller and the
//           contract (aal2, the sort, the page, the filters of the base and of G, the campaign, the
//           prefill); the identities (names, city, handles, the agent in charge; never a contact
//           detail), the states of the profiles (E1 lifted, G2), the pair blocked (shown, never its
//           motive), E6 with the brand of the campaign, G1, G8, G9, G10; the exact figures of the
//           creator record; the exact count without k nor switch (CA61); the pages and their cap; the
//           nominative journal written by the transaction that serves; no lead, audit nor matching.*;
//           the same engine and order as the brand's.
// Each case runs in a rolled-back transaction of the local superuser, which sets aside the storefronts
// of earlier runs sharing the audience country of this file (every search filters F6 on it), writes
// its fixtures outside the guards and acts as apps/api does (influx_app, then the internal role and its
// context in aal2). The exact count is the answer's here; the journal is read by its request id.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { EXACT_FIGURES_JOINS } from "../src/domains/backoffice/account-creator/repository.ts";
import { ISO_UTC } from "../src/domains/backoffice/sql-formats.ts";
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
const adminA = accountIdOf("admin", "a");
const brandA = accountIdOf("advertiser", "a");
const creatorA = accountIdOf("creator", "a");

const OWNER = "influx_agent_search_definer";
const BRAND_OWNER = "influx_creator_search_definer";
const DOOR_SIGNATURE =
  "search.search_creators_identified(jsonb,text,integer,uuid,uuid)";

/** The audience country of this file's storefronts: every search filters F6 on it. */
const COUNTRY = "LI";
const HERE = { F6: { country: COUNTRY } };

const DOOR =
  "select search.search_creators_identified($1::text::jsonb, $2::text, $3::integer, $4::uuid, $5::uuid) as answer";
const DOOR_RAW =
  "select search.search_creators_identified($1::text::jsonb, $2::text, $3::integer, $4::uuid, $5::uuid)::text as raw";
const BRAND_DOOR =
  "select search.search_creators($1::text::jsonb, $2::text, $3::integer, $4::uuid) as answer";

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | {
      outcome: "error";
      code: string;
      detail: string | undefined;
      message: string;
    };

type NetworkRow = {
  network: string;
  isPrimary: boolean;
  pseudonym: string | null;
  handle: string | null;
  profileUrl: string | null;
  followers: number | null;
  postsLast30Days: number | null;
  avgComments: number | null;
  engagementBp: number | null;
  measuredAt: string | null;
  source: string;
  badge: { level: string; state: string } | null;
};

type IdentifiedRow = {
  accountId: string;
  alias: string;
  status: string;
  declaredStatus: string | null;
  legalName: string | null;
  city: string | null;
  residence: { country: string; region: string | null };
  ownerAgent: { accountId: string; firstName: string | null } | null;
  refusedSectors: string[];
  blocked: boolean;
  networks: NetworkRow[];
  mainAudience: { country: string; sharePercent: number | null } | null;
  reasons: { code: string; params: Record<string, string> }[];
  vigilance: string | null;
};

type Answer = {
  state: string;
  total?: number;
  page?: number;
  nextPage?: number | null;
  capReached?: boolean;
  rows?: IdentifiedRow[];
};

type Line = {
  search_query_id: string;
  account_id: string;
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

/** A rolled-back transaction: the file's country set aside, the pages of the view as loaded. */
function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    await tx`
      update profiles.creator_public_profiles set is_searchable = false
       where main_audience_country = ${COUNTRY} and is_searchable`;
    await setting(tx, "identified_view", { pageSize: 20, maxPages: 10 });
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

type AccountSpec = {
  adult?: boolean;
  account?: "active" | "suspended";
  declared?: "individual" | "business";
  owner?: string | null;
  country?: string;
};

async function newAccount(
  tx: Tx,
  role: "creator" | "advertiser",
  spec: AccountSpec = {},
): Promise<string> {
  const id = randomUUID();
  const adult = spec.adult ?? true;
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
    values (${id}, ${randomUUID()}, ${`l3g-t4-${id}@example.test`}, now(), ${spec.country ?? "FR"},
            'fr', 'L3G T4 Person', ${adult}, case when ${adult}::boolean then now() end,
            ${role === "creator" ? (spec.declared ?? "individual") : "business"},
            ${spec.owner ?? null})`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, ${role})`;
  if (spec.account === "suspended") {
    await tx`update identity.accounts set status = 'suspended', suspended_at = now()
              where id = ${id}`;
  }
  return id;
}

/** An internal account of `role` (an active agent profile unless told), for the caller's checks. */
async function newInternal(
  tx: Tx,
  role: "agent" | "admin",
  spec: { suspended?: boolean; inactiveProfile?: boolean } = {},
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       declared_status)
    values (${id}, ${randomUUID()}, ${`l3g-t4-internal-${id}@example.test`}, now(), 'FR', 'fr',
            'L3G T4 Agent', 'business')`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, ${role})`;
  await tx`
    insert into identity.agent_profiles (account_id, first_name, activated_at, mfa_enrolled_at)
    values (${id}, 'Lena', now(), now())`;
  if (spec.suspended === true) {
    await tx`update identity.accounts set status = 'suspended', suspended_at = now()
              where id = ${id}`;
  }
  if (spec.inactiveProfile === true) {
    await tx`update identity.agent_profiles
                set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${adminA}
              where account_id = ${id}`;
  }
  return id;
}

/** A brand whose profile is published (10 RG1), its main sector given. */
async function newBrand(tx: Tx, sector = "sports_leisure"): Promise<string> {
  const id = await newAccount(tx, "advertiser");
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3G T4 Brand', ${sector}, '11_50', ${`l3g-t4-${id.slice(0, 8)}.example`},
            'A brand of the L3G tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  await tx`update profiles.advertiser_profiles set status = 'published' where account_id = ${id}`;
  return id;
}

/** A campaign of `brand`, its sector given, in `state` (pending_review by default), or erased. */
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

type NetworkLine = {
  network?: "instagram" | "tiktok";
  followers?: number;
  listed?: boolean;
  pseudonym?: string;
};

type CreatorSpec = AccountSpec & {
  status?: "published" | "draft" | "pending_review" | "rejected" | "suspended";
  searchable?: boolean;
  region?: string | null;
  topic?: string;
  lines?: NetworkLine[];
  refused?: string[];
  identity?: boolean;
  share?: number;
};

type Creator = { id: string; alias: string; lines: string[] };

/** The identity written on a creator when asked: names, city and the contact never served. */
const IDENTITY = {
  first: "Ottilie",
  last: "Vandersteen",
  city: "Vaduz",
  email: "ottilie.contact@l3g-t4.example",
  phone: "+423791234567",
  address: "17 Herrengasse des Tests",
  postal: "9490",
} as const;

/**
 * A creator and its storefront, published, searchable and in the file's country by default; one
 * listed Instagram line of 47 312 followers, French, the Instagram reel; the residence of its account.
 */
async function newCreator(tx: Tx, spec: CreatorSpec = {}): Promise<Creator> {
  const residence = spec.country ?? "FR";
  const id = await newAccount(tx, "creator", { ...spec, country: residence });
  await tx`
    insert into profiles.creator_public_profiles
      (account_id, alias, residence_country_code, residence_region_code)
    values (${id}, profiles.new_creator_alias(), ${residence}, ${spec.region ?? null})`;
  const lines: string[] = [];
  for (const [index, line] of (spec.lines ?? [{}]).entries()) {
    const network = line.network ?? "instagram";
    const handle = `l3g_t4_${id.slice(0, 8)}_${index}`;
    const [row] = await tx<{ id: string }[]>`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, pseudonym, profile_url, followers_count,
         posts_last_30_days, avg_comments_per_post, engagement_rate_bp, figures_measured_at)
      values (${id}, ${network}, ${index === 0}, ${handle}, ${line.pseudonym ?? null},
              ${`https://www.${network}.com/${handle}`}, ${line.followers ?? 47312}, 12, 30, 350,
              now() - interval '3 days')
      returning id::text`;
    if (row === undefined) throw new Error("no line");
    if (line.listed ?? true) {
      await tx`update profiles.creator_public_networks set listed_at = now()
                where social_account_id = ${row.id}`;
    }
    lines.push(row.id);
  }
  if (spec.share !== undefined && lines[0] !== undefined) {
    await tx`
      insert into profiles.creator_audience_countries
        (social_account_id, account_id, slot, country_code, share_percent)
      values (${lines[0]}, ${id}, 0, ${COUNTRY}, ${spec.share})`;
  }
  await tx`insert into profiles.creator_publication_languages (account_id, slot, language_code)
           values (${id}, 1, 'fr')`;
  await tx`insert into profiles.creator_formats (account_id, format_code)
           values (${id}, 'instagram_reel')`;
  for (const sector of spec.refused ?? []) {
    await tx`insert into profiles.creator_refused_sectors (account_id, sector_code)
             values (${id}, ${sector})`;
  }
  if (spec.identity === true) {
    await tx`
      update profiles.creator_identities
         set legal_first_name = ${IDENTITY.first}, legal_last_name = ${IDENTITY.last},
             city = ${IDENTITY.city}, contact_email = ${IDENTITY.email},
             contact_phone = ${IDENTITY.phone}, address_line = ${IDENTITY.address},
             postal_code = ${IDENTITY.postal}, country_code = ${residence}
       where account_id = ${id}`;
  }
  const status = spec.status ?? "published";
  const [row] = await tx<{ alias: string }[]>`
    update profiles.creator_public_profiles
       set status = ${status}::profiles.creator_profile_status,
           published_at = case when ${status} in ('published', 'suspended')
                               then now() - interval '40 days' end,
           is_searchable = ${spec.searchable ?? true},
           primary_topic_code = ${spec.topic ?? "pets"},
           main_audience_country = ${COUNTRY},
           main_audience_share_band = 'ge_80'
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

/** A holding badge of a line of `creator`, decided by agent A; the audience badge with its figures. */
async function giveBadge(
  tx: Tx,
  creator: Creator,
  line: number,
  network: "instagram" | "tiktok",
  level: "account_verified" | "audience_verified",
  state: "active" | "to_refresh" = "active",
): Promise<void> {
  const lineId = creator.lines[line] ?? "";
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${creator.id}, ${lineId}, ${network}, ${level}, 'pending')
    returning id::text`;
  await tx`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  const [badge] =
    level === "account_verified"
      ? await tx<{ id: string }[]>`
          insert into verification.badges
            (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
             granted_at, evidence_source, observed_handle_at_decision)
          values (${creator.id}, ${lineId}, ${network}, ${request?.id ?? null}, 'account_verified',
                  ${agentA}, now() - interval '2 days', 'public_profile', 'l3g_t4_handle')
          returning id::text`
      : await tx<{ id: string }[]>`
          insert into verification.badges
            (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
             granted_at, expires_at, evidence_source, observed_followers,
             observed_posts_last_30_days, observed_avg_comments, observed_engagement_bp,
             observed_period_start, observed_period_end, declared_posts_at_decision,
             declared_comments_at_decision, observed_handle_at_decision)
          values (${creator.id}, ${lineId}, ${network}, ${request?.id ?? null},
                  'audience_verified', ${agentA}, now() - interval '1 day',
                  now() + interval '90 days', 'native_dashboard', 50210, 9, 41, 420,
                  current_date - 30, current_date - 1, 12, 30, 'l3g_t4_handle')
          returning id::text`;
  if (state === "to_refresh") {
    await tx`update verification.badges set state = 'to_refresh' where id = ${badge?.id ?? null}`;
  }
}

const BLOCK_REASON = "lg_four_block";
const BLOCK_COMMENT = "L3G T4 why the block";

/** A block of the pair posed by INFLUX (no gesture at Lot 3: the superuser writes it). */
async function giveBlock(
  tx: Tx,
  brand: string,
  creator: Creator,
  lifted = false,
): Promise<void> {
  await tx`
    insert into matching.block_reasons (code, label_key, available_to_side)
    values (${BLOCK_REASON}, ${`block.reason.${BLOCK_REASON}`}, 'any')
    on conflict (code) do nothing`;
  const [row] = await tx<{ id: string }[]>`
    insert into matching.party_blocks
      (advertiser_account_id, creator_account_id, blocked_by_account_id, blocked_by_side,
       reason_code, comment)
    values (${brand}, ${creator.id}, ${adminA}, 'influx', ${BLOCK_REASON}, ${BLOCK_COMMENT})
    returning id::text`;
  if (lifted) {
    await tx`update matching.party_blocks set lifted_at = now(), lifted_by_account_id = ${adminA}
              where id = ${row?.id ?? null}`;
  }
}

// the searches ------------------------------------------------------------------------------------

type Caller = {
  role: "agent" | "admin";
  account: string;
  aal?: "aal1" | "aal2";
};

const AGENT: Caller = { role: "agent", account: agentA };
const ADMIN: Caller = { role: "admin", account: adminA };

type SearchOptions = {
  sort?: string | null;
  page?: number | null;
  campaign?: string | null;
  prefill?: string | null;
  as?: Caller;
};

type Searched = {
  outcome: Outcome<{ answer: Answer }>;
  answer: Answer;
  line: Line | undefined;
  request: string;
};

/** An identified search as apps/api runs it, then its journal line (by its request id). */
async function identified(
  tx: Tx,
  filters: unknown = HERE,
  options: SearchOptions = {},
): Promise<Searched> {
  const request = `l3g-t4-${randomUUID()}`;
  await tx`select pg_catalog.set_config('influx.request_id', ${request}, true)`;
  const caller = options.as ?? AGENT;
  const outcome = await actAsInternal(
    tx,
    caller.role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: caller.account, role: caller.role, aal: caller.aal ?? "aal2" },
    () =>
      run<{ answer: Answer }>(tx, DOOR, [
        JSON.stringify(filters),
        options.sort === undefined ? "default" : options.sort,
        options.page === undefined ? 1 : options.page,
        options.campaign ?? null,
        options.prefill ?? null,
      ]),
  );
  const lines = await linesOf(tx, request);
  return {
    outcome,
    answer:
      outcome.outcome === "rows"
        ? (outcome.rows[0]?.answer ?? { state: "none" })
        : { state: `error ${errorOf(outcome)}` },
    line: lines[0],
    request,
  };
}

/** The raw text of an identified answer. */
async function rawIdentified(
  tx: Tx,
  filters: unknown,
  campaign: string | null = null,
): Promise<string> {
  const outcome = await actAsInternal(
    tx,
    "influx_agent",
    { accountId: agentA, role: "agent", aal: "aal2" },
    () =>
      run<{ raw: string }>(tx, DOOR_RAW, [
        JSON.stringify(filters),
        "default",
        1,
        campaign,
        null,
      ]),
  );
  if (outcome.outcome === "error") throw new Error(errorOf(outcome));
  return outcome.rows[0]?.raw ?? "";
}

async function linesOf(tx: Tx, request: string): Promise<Line[]> {
  return tx<Line[]>`
    select q.id::text as search_query_id, q.account_id::text as account_id, q.outcome, q.filters,
           q.sort_code, q.result_count, q.page_reached, q.blocked_by_k_anonymity as blocked,
           q.campaign_id::text as campaign_id, q.actor_role, q.view_mode,
           q.facet_config_version::text as version,
           (select max(v.version)::text from search.facet_config_versions v) as latest,
           q.request_id
      from search.search_queries q
     where q.request_id = ${request}
     order by q.created_at, q.outcome`;
}

function aliasesOf(answer: Answer): string[] {
  return (answer.rows ?? []).map((row) => row.alias);
}

function rowOf(answer: Answer, creator: Creator): IdentifiedRow | undefined {
  return (answer.rows ?? []).find((row) => row.accountId === creator.id);
}

/**
 * The text of the rule of the creator record (account-creator/repository.ts, EXACT_FIGURES_JOINS): a
 * fragment of strings only, without parameter (drizzle stays in src/db and the repositories, 02 §5).
 */
function recordFragment(): string {
  return EXACT_FIGURES_JOINS.queryChunks
    .map((chunk) => {
      if (
        typeof chunk === "object" &&
        chunk !== null &&
        "value" in chunk &&
        Array.isArray(chunk.value)
      ) {
        return chunk.value.join("");
      }
      throw new Error("EXACT_FIGURES_JOINS is no longer a fragment of strings");
    })
    .join("");
}

// the cases ---------------------------------------------------------------------------------------

describe("L3G-T4 the door, its owner and its helpers in the catalogue (TM12.5; fiche invariants 2, 3)", () => {
  it("L3G-T4 makes influx_agent_search_definer NOLOGIN NOINHERIT without member, owner of the identified door and of the prefill door (0329), executable by influx_agent and influx_admin alone, and of invoker helpers executed by nobody, empty search_path, no dynamic statement", async () => {
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
    const helper = (name: string) => ({
      name,
      definer: false,
      config: ['search_path=""'],
      callers: [],
      dynamic: false,
    });
    expect(outcome.functions).toEqual([
      helper("search.check_identified_search_filters(jsonb)"),
      helper("search.identified_creator_row(uuid,uuid)"),
      // 0329 (L3G-05, l3g/modele §4): the prefill of « Compatible creators », the agents' alone, and
      // the diff of a prefill, executed by nobody
      {
        name: "search.prefill_campaign_filters(uuid)",
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_admin", "influx_agent"],
        dynamic: false,
      },
      helper("search.prefill_diff(jsonb,jsonb)"),
      helper("search.require_identified_searcher()"),
      {
        name: DOOR_SIGNATURE,
        definer: true,
        config: ['search_path=""'],
        callers: ["influx_admin", "influx_agent"],
        dynamic: false,
      },
    ]);
  });

  it("L3G-T4 TM12.5: the brand and the creator get 42501 on the door in base, an agent and an admin are served; the brand's owner gets 42501 running the engine in agent_identified", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreator(tx);
      const member = async (
        role: "influx_advertiser" | "influx_creator",
        account: string,
      ) =>
        errorOf(
          await actAsMember(
            tx,
            role,
            {
              accountId: account,
              role: role === "influx_advertiser" ? "advertiser" : "creator",
              aal: "aal1",
            },
            () =>
              run(tx, DOOR, [JSON.stringify(HERE), "default", 1, null, null]),
          ),
        );
      const brand = await member("influx_advertiser", brandA);
      const creator = await member("influx_creator", creatorA);
      const agent = (await identified(tx)).answer.state;
      const admin = (await identified(tx, HERE, { as: ADMIN })).answer.state;
      await tx.unsafe(`set local role ${BRAND_OWNER}`);
      await tx`select pg_catalog.set_config('influx.account', ${brandA}, true)`;
      const engine = await run(
        tx,
        "select * from search.creator_candidates('agent_identified', null, $1::text::jsonb, null)",
        [JSON.stringify(HERE)],
      );
      await tx.unsafe("reset role");
      await tx`select pg_catalog.set_config('influx.account', '', true)`;
      return { brand, creator, agent, admin, engine: errorOf(engine) };
    });
    expect(outcome).toEqual({
      brand: INSUFFICIENT_PRIVILEGE,
      creator: INSUFFICIENT_PRIVILEGE,
      agent: "results",
      admin: "results",
      engine: `${INSUFFICIENT_PRIVILEGE} agent_identified`,
    });
  });

  it("L3G-T4 T1-R by couple: the brand's owner holds no column of G nor of layer I and the engine names no relation of layer I; the door and its row reach layer I and no member executes them", async () => {
    const outcome = await scenario(async (tx) => {
      const [brandOwner] = await tx<Row[]>`
        select pg_catalog.has_column_privilege(${BRAND_OWNER}, 'identity.accounts',
                                               'declared_status', 'SELECT') as declared,
               pg_catalog.has_column_privilege(${BRAND_OWNER}, 'identity.accounts',
                                               'owner_agent_id', 'SELECT') as owner,
               pg_catalog.has_any_column_privilege(${BRAND_OWNER}, 'identity.agent_profiles',
                                                   'SELECT') as agents,
               pg_catalog.has_any_column_privilege(${BRAND_OWNER}, 'profiles.creator_identities',
                                                   'SELECT') as identities,
               pg_catalog.has_any_column_privilege(${BRAND_OWNER}, 'profiles.creator_social_accounts',
                                                   'SELECT') as lines,
               pg_catalog.has_any_column_privilege(${BRAND_OWNER},
                                                   'profiles.creator_audience_countries',
                                                   'SELECT') as audience`;
      const named = await tx<{ fn: string; layer_i: boolean }[]>`
        select p.oid::regprocedure::text as fn,
               p.prosrc ~* 'profiles\\s*\\.\\s*creator_(identities|social_accounts|audience_|network_metrics)'
                 as layer_i
          from pg_catalog.pg_proc p
         where p.oid in ('search.creator_candidates(text,uuid,jsonb,uuid)'::regprocedure,
                         'search.creator_order(uuid[],jsonb,text,uuid,integer,integer,date)'::regprocedure,
                         'search.identified_creator_row(uuid,uuid)'::regprocedure,
                         ${DOOR_SIGNATURE}::regprocedure)
         order by p.oid::regprocedure::text collate "C"`;
      const [members] = await tx<{ names: string[] }[]>`
        select coalesce(array_agg(r || ' ' || p.oid::regprocedure::text order by 1), '{}') as names
          from pg_catalog.pg_proc p, unnest(array['influx_advertiser', 'influx_creator']) r
         where p.proowner = ${OWNER}::regrole
           and pg_catalog.has_function_privilege(r, p.oid, 'EXECUTE')`;
      return { brandOwner, named, members: members?.names };
    });
    expect(outcome.brandOwner).toEqual({
      declared: false,
      owner: false,
      agents: false,
      identities: false,
      lines: false,
      audience: false,
    });
    expect(outcome.named).toEqual([
      { fn: "search.creator_candidates(text,uuid,jsonb,uuid)", layer_i: false },
      {
        fn: "search.creator_order(uuid[],jsonb,text,uuid,integer,integer,date)",
        layer_i: false,
      },
      { fn: "search.identified_creator_row(uuid,uuid)", layer_i: true },
      { fn: DOOR_SIGNATURE, layer_i: false },
    ]);
    expect(outcome.members).toEqual([]);
  });

  it("L3G-T4 gives its owner the searchable storefronts, the names and city of the identity, never a contact detail nor the address; it writes its journal only, never the exposures (RG87), the outbox nor matching.*", async () => {
    const outcome = await scenario(async (tx) => {
      const identity = await tx<{ name: string }[]>`
        select at.attname::text as name
          from pg_catalog.pg_attribute at
         where at.attrelid = 'profiles.creator_identities'::regclass
           and at.attnum > 0 and not at.attisdropped
           and pg_catalog.has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'SELECT')
         order by at.attname::text collate "C"`;
      const writes = await tx<{ name: string }[]>`
        select c.oid::regclass::text as name
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where c.relkind in ('r', 'p') and n.nspname not in ('pg_catalog', 'information_schema')
           and (pg_catalog.has_table_privilege(${OWNER}, c.oid, 'INSERT, UPDATE, DELETE, TRUNCATE')
                or pg_catalog.has_any_column_privilege(${OWNER}, c.oid, 'INSERT, UPDATE'))
         order by c.oid::regclass::text collate "C"`;
      const [storefronts] = await tx<{ qual: string }[]>`
        select qual from pg_catalog.pg_policies
         where schemaname = 'profiles' and tablename = 'creator_public_profiles'
           and roles = array[${OWNER}]::name[]`;
      const [leads] = await tx<{ reached: string[] }[]>`
        select coalesce(array_agg(c.oid::regclass::text order by 1), '{}') as reached
          from pg_catalog.pg_class c
         where c.relnamespace = 'leads'::regnamespace and c.relkind in ('r', 'p')
           and pg_catalog.has_any_column_privilege(${OWNER}, c.oid, 'SELECT, INSERT, UPDATE')`;
      return {
        identity: identity.map((row) => row.name),
        writes: writes.map((row) => row.name),
        storefronts: storefronts?.qual,
        leads: leads?.reached,
      };
    });
    expect(outcome.identity).toEqual([
      "account_id",
      "city",
      "legal_first_name",
      "legal_last_name",
    ]);
    expect(outcome.writes).toEqual([
      // 0329 (L3G-05, l3g/modele §4): its own prefills, inserted by the prefill door
      "search.campaign_prefills",
      "search.impression_reasons",
      "search.search_impressions",
      "search.search_queries",
    ]);
    expect(outcome.storefronts).toBe("is_searchable");
    expect(outcome.leads).toEqual([]);
  });
});

describe("L3G-T4 the caller and the contract (fiche invariants 2, 14; T14)", () => {
  it("L3G-T4 refuses an agent in aal1, a suspended internal account, an inactive internal profile and a role the account does not hold (42501), and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreator(tx);
      const suspended = await newInternal(tx, "agent", { suspended: true });
      const inactive = await newInternal(tx, "agent", {
        inactiveProfile: true,
      });
      const tried = [
        await identified(tx, HERE, { as: { ...AGENT, aal: "aal1" } }),
        await identified(tx, HERE, {
          as: { role: "agent", account: suspended },
        }),
        await identified(tx, HERE, {
          as: { role: "agent", account: inactive },
        }),
        await identified(tx, HERE, { as: { role: "admin", account: agentA } }),
      ];
      return {
        codes: tried.map((searched) => errorOf(searched.outcome)),
        lines: tried.filter((searched) => searched.line !== undefined).length,
      };
    });
    expect(outcome.codes).toEqual([
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
    ]);
    expect(outcome.lines).toBe(0);
  });

  it("L3G-T4 serves an admin in aal2 and journals the search under the role admin", async () => {
    const outcome = await scenario(async (tx) => {
      const [creator] = await newCreators(tx, 1);
      const searched = await identified(tx, HERE, { as: ADMIN });
      return { creator, searched };
    });
    expect(outcome.searched.answer).toMatchObject({
      state: "results",
      total: 1,
    });
    expect(outcome.searched.line).toMatchObject({
      account_id: adminA,
      actor_role: "admin",
      view_mode: "agent_identified",
      outcome: "served",
      result_count: 1,
    });
  });

  it("L3G-T4 refuses a sort or a page outside the contract (22023 sort, page) before anything is written", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreator(tx);
      const tried = [
        await identified(tx, HERE, { sort: "price" }),
        await identified(tx, HERE, { sort: null }),
        await identified(tx, HERE, { page: 0 }),
        await identified(tx, HERE, { page: 51 }),
        await identified(tx, HERE, { page: null }),
      ];
      return {
        codes: tried.map((searched) => errorOf(searched.outcome)),
        lines: tried.filter((searched) => searched.line !== undefined).length,
      };
    });
    expect(outcome.codes).toEqual([
      `${INVALID_PARAMETER} sort`,
      `${INVALID_PARAMETER} sort`,
      `${INVALID_PARAMETER} page`,
      `${INVALID_PARAMETER} page`,
      `${INVALID_PARAMETER} page`,
    ]);
    expect(outcome.lines).toBe(0);
  });

  it("L3G-T4 RG72: accepts G1, G2, G8, G9 and G10 beside the base; refuses an unknown key, a closed facet and every malformed value (22023 filters), nothing written; the brand's door refuses G", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreator(tx);
      const accepted = await identified(tx, {
        ...HERE,
        G1: ["individual", "business"],
        G2: ["draft", "published"],
        G8: [agentA],
        G9: { country: "FR", regions: ["FR-IDF", "FR-OCC"] },
        G10: ["gambling"],
      });
      const refusedFilters = [
        { ...HERE, G3: ["recent"] },
        { ...HERE, F12: ["eur_100_300"] },
        { ...HERE, G1: ["company"] },
        { ...HERE, G1: [] },
        { ...HERE, G2: ["archived"] },
        { ...HERE, G2: ["draft", "draft"] },
        { ...HERE, G8: ["agent-a"] },
        { ...HERE, G8: [agentA.toUpperCase()] },
        { ...HERE, G9: { country: "fr" } },
        { ...HERE, G9: { country: "FR", regions: ["GB-ENG"] } },
        { ...HERE, G9: { country: "FR", city: "Paris" } },
        { ...HERE, G9: { regions: ["FR-IDF"] } },
        { ...HERE, G10: "gambling" },
        { ...HERE, G10: ["not a code"] },
        { ...HERE, G10: Array.from({ length: 21 }, (_, index) => `s${index}`) },
      ];
      const refused: string[] = [];
      let lines = 0;
      for (const filters of refusedFilters) {
        const searched = await identified(tx, filters);
        refused.push(errorOf(searched.outcome));
        if (searched.line !== undefined) lines += 1;
      }
      // the brand's door, open and with a published brand: G is no facet of its view (RG72)
      await setting(tx, "is_open_to_advertisers", true);
      const brand = await newBrand(tx);
      const brandDoor = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brand, role: "advertiser", aal: "aal1" },
        () =>
          run(tx, BRAND_DOOR, [
            JSON.stringify({ ...HERE, G2: ["draft"] }),
            "default",
            1,
            null,
          ]),
      );
      return {
        accepted: accepted.answer.state,
        refused,
        lines,
        brandDoor: errorOf(brandDoor),
      };
    });
    expect(outcome.accepted).toBe("results");
    expect(outcome.refused).toEqual(
      Array.from({ length: 15 }, () => `${INVALID_PARAMETER} filters`),
    );
    expect(outcome.lines).toBe(0);
    expect(outcome.brandDoor).toBe(`${INVALID_PARAMETER} filters`);
  });

  it("L3G-T4 T14: a campaign unknown, in draft, rejected or erased gets one error (P0002 campaign), nothing written; an admitted campaign of any brand anchors the search and is journaled", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreator(tx);
      const brand = await newBrand(tx);
      const states: (CampaignState | "erased")[] = [
        "draft",
        "rejected",
        "erased",
      ];
      const unknown = await identified(tx, HERE, { campaign: randomUUID() });
      const refused = [errorOf(unknown.outcome)];
      let lines = unknown.line === undefined ? 0 : 1;
      for (const state of states) {
        const campaign = await newCampaign(tx, brand, "food_beverages", state);
        const searched = await identified(tx, HERE, { campaign });
        refused.push(errorOf(searched.outcome));
        if (searched.line !== undefined) lines += 1;
      }
      const admitted: string[] = [];
      for (const state of [
        "pending_review",
        "published",
        "paused",
        "closed",
      ] as const) {
        const campaign = await newCampaign(tx, brand, "food_beverages", state);
        const searched = await identified(tx, HERE, { campaign });
        admitted.push(
          `${searched.answer.state} ${searched.line?.campaign_id === campaign}`,
        );
      }
      return { refused, lines, admitted };
    });
    expect(outcome.refused).toEqual(
      Array.from({ length: 4 }, () => `${NO_DATA_FOUND} campaign`),
    );
    expect(outcome.lines).toBe(0);
    expect(outcome.admitted).toEqual(
      Array.from({ length: 4 }, () => "results true"),
    );
  });

  // 0329 (L3G-05, l3g/modele §4): the 0A000 of 0328 became the check of the prefill (L3G-T5 holds the
  // rest of it)
  it("L3G-T4 answers P0002 prefill to an unknown prefill, after the campaign, and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreator(tx);
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand, "food_beverages");
      const prefilled = await identified(tx, HERE, {
        campaign,
        prefill: randomUUID(),
      });
      const unknownFirst = await identified(tx, HERE, {
        campaign: randomUUID(),
        prefill: randomUUID(),
      });
      return {
        prefilled: errorOf(prefilled.outcome),
        unknownFirst: errorOf(unknownFirst.outcome),
        lines: [prefilled, unknownFirst].filter((s) => s.line !== undefined)
          .length,
      };
    });
    expect(outcome).toEqual({
      prefilled: `${NO_DATA_FOUND} prefill`,
      unknownFirst: `${NO_DATA_FOUND} campaign`,
      lines: 0,
    });
  });
});

describe("L3G-T4 the identities and the states (10 RG71, RG72; D46, D78; fiche invariants 6, 12)", () => {
  it("L3G-T4 RG71: serves the identity of a row (alias, legal name, city, residence, declared status, agent in charge, handle, pseudonym, URL); never a contact detail, the address, a rate nor a budget", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx, {
        identity: true,
        declared: "business",
        owner: agentA,
        country: "FR",
        region: "FR-IDF",
        lines: [{ pseudonym: "Otti on the road" }],
      });
      const searched = await identified(tx);
      const raw = await rawIdentified(tx, HERE);
      return { creator, row: rowOf(searched.answer, creator), raw };
    });
    const handle = `l3g_t4_${outcome.creator.id.slice(0, 8)}_0`;
    expect(outcome.row).toMatchObject({
      accountId: outcome.creator.id,
      alias: outcome.creator.alias,
      status: "published",
      declaredStatus: "business",
      legalName: `${IDENTITY.first} ${IDENTITY.last}`,
      city: IDENTITY.city,
      residence: { country: "FR", region: "FR-IDF" },
      ownerAgent: { accountId: agentA, firstName: "T2agenta" },
      refusedSectors: [],
      blocked: false,
    });
    expect(outcome.row?.networks).toMatchObject([
      {
        network: "instagram",
        isPrimary: true,
        pseudonym: "Otti on the road",
        handle,
        profileUrl: `https://www.instagram.com/${handle}`,
      },
    ]);
    for (const secret of [
      IDENTITY.email,
      IDENTITY.phone,
      IDENTITY.address,
      IDENTITY.postal,
      "contact",
      "address",
      "postal",
      "budget",
      "price",
      "rate",
    ]) {
      expect(outcome.raw.toLowerCase()).not.toContain(secret.toLowerCase());
    }
  });

  it("L3G-T4 RG71: shows the profiles in draft, pending, refused and suspended with their state (E1 lifted) and filters them by G2; a storefront not searchable, of a suspended account or without the attestation of majority stays absent (E2 to E4)", async () => {
    const outcome = await scenario(async (tx) => {
      const published = await newCreator(tx);
      const draft = await newCreator(tx, { status: "draft" });
      const pending = await newCreator(tx, { status: "pending_review" });
      const rejected = await newCreator(tx, { status: "rejected" });
      const suspendedProfile = await newCreator(tx, { status: "suspended" });
      const hidden = [
        await newCreator(tx, { searchable: false }),
        await newCreator(tx, { status: "suspended", searchable: false }),
      ];
      const suspendedAccount = await newCreator(tx, { account: "suspended" });
      const minor = await newCreator(tx, { adult: false });
      // EC-L3G-04-11: a draft once exposed (no publication date) is still served
      await tx`insert into search.creator_exposures (creator_account_id, first_page_at)
               values (${draft.id}, now() - interval '3 days')`;
      const all = await identified(tx);
      const unpublished = await identified(tx, {
        ...HERE,
        G2: ["draft", "pending_review", "rejected", "suspended"],
      });
      const states = Object.fromEntries(
        (all.answer.rows ?? []).map((row) => [row.accountId, row.status]),
      );
      return {
        states,
        total: all.answer.total,
        unpublished: [
          ...(unpublished.answer.rows ?? []).map((r) => r.accountId),
        ].sort(),
        expectedUnpublished: [
          draft.id,
          pending.id,
          rejected.id,
          suspendedProfile.id,
        ].sort(),
        ids: { published, draft, pending, rejected, suspendedProfile },
        absent: [...hidden, suspendedAccount, minor].filter(
          (creator) => states[creator.id] !== undefined,
        ).length,
      };
    });
    expect(outcome.total).toBe(5);
    expect(outcome.states).toEqual({
      [outcome.ids.published.id]: "published",
      [outcome.ids.draft.id]: "draft",
      [outcome.ids.pending.id]: "pending_review",
      [outcome.ids.rejected.id]: "rejected",
      [outcome.ids.suspendedProfile.id]: "suspended",
    });
    expect(outcome.unpublished).toEqual(outcome.expectedUnpublished);
    expect(outcome.absent).toBe(0);
  });

  it("L3G-T4 RG71, 17b l. 869: flags an active block of the pair with the brand of the campaign (blocked, never its motive nor its author) and never removes the creator; lifted, of another brand or without a campaign, not blocked", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      const campaign = await newCampaign(
        tx,
        brand,
        "food_beverages",
        "published",
      );
      const [blocked, lifted, elsewhere, free] = await newCreators(tx, 4);
      if (!blocked || !lifted || !elsewhere || !free)
        throw new Error("no creators");
      await giveBlock(tx, brand, blocked);
      await giveBlock(tx, brand, lifted, true);
      await giveBlock(tx, other, elsewhere);
      const anchored = await identified(tx, HERE, { campaign });
      const loose = await identified(tx);
      const raw = await rawIdentified(tx, HERE, campaign);
      const flags = (answer: Answer) =>
        [blocked, lifted, elsewhere, free].map(
          (creator) => rowOf(answer, creator)?.blocked ?? "absent",
        );
      return {
        anchored: flags(anchored.answer),
        loose: flags(loose.answer),
        raw,
      };
    });
    expect(outcome.anchored).toEqual([true, false, false, false]);
    expect(outcome.loose).toEqual([false, false, false, false]);
    expect(outcome.raw).not.toContain(BLOCK_REASON);
    expect(outcome.raw).not.toContain(BLOCK_COMMENT);
    expect(outcome.raw).not.toContain(adminA);
    expect(outcome.raw.toLowerCase()).not.toContain("reason_code");
    expect(outcome.raw.toLowerCase()).not.toContain("blocked_by");
  });

  it("L3G-T4 E6 with the brand of the campaign: a creator refusing its sector or a sector of its brand is absent; without a campaign it is shown with its refused sectors, and G10 selects it", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx, "sports_leisure");
      const campaign = await newCampaign(
        tx,
        brand,
        "food_beverages",
        "published",
      );
      const plain = await newCreator(tx);
      const refusesCampaign = await newCreator(tx, {
        refused: ["food_beverages"],
      });
      const refusesBrand = await newCreator(tx, {
        refused: ["sports_leisure", "gambling"],
      });
      const anchored = await identified(tx, HERE, { campaign });
      const loose = await identified(tx);
      const g10 = await identified(tx, { ...HERE, G10: ["gambling"] });
      return {
        anchored: aliasesOf(anchored.answer).sort(),
        anchoredTotal: anchored.answer.total,
        loose: aliasesOf(loose.answer).sort(),
        refused: rowOf(loose.answer, refusesBrand)?.refusedSectors,
        g10: aliasesOf(g10.answer),
        expected: {
          anchored: [plain.alias],
          loose: [
            plain.alias,
            refusesCampaign.alias,
            refusesBrand.alias,
          ].sort(),
          g10: [refusesBrand.alias],
        },
      };
    });
    expect(outcome.anchored).toEqual(outcome.expected.anchored);
    expect(outcome.anchoredTotal).toBe(1);
    expect(outcome.loose).toEqual(outcome.expected.loose);
    expect(outcome.refused).toEqual(["gambling", "sports_leisure"]);
    expect(outcome.g10).toEqual(outcome.expected.g10);
  });

  it("L3G-T4 RG72: filters by G1 (declared status), G8 (agent in charge) and G9 (country of residence, its regions)", async () => {
    const outcome = await scenario(async (tx) => {
      const a = await newCreator(tx, {
        declared: "individual",
        owner: agentA,
        country: "FR",
        region: "FR-IDF",
      });
      const b = await newCreator(tx, { declared: "business", country: "BE" });
      const c = await newCreator(tx, {
        declared: "individual",
        owner: adminA,
        country: "FR",
        region: "FR-OCC",
      });
      const ids = async (filters: Row) =>
        [...((await identified(tx, { ...HERE, ...filters })).answer.rows ?? [])]
          .map((row) => row.accountId)
          .sort();
      return {
        g1: await ids({ G1: ["business"] }),
        g8: await ids({ G8: [agentA] }),
        g9: await ids({ G9: { country: "FR" } }),
        g9Region: await ids({ G9: { country: "FR", regions: ["FR-OCC"] } }),
        g8g9: await ids({
          G8: [adminA, agentA],
          G9: { country: "FR", regions: ["FR-IDF"] },
        }),
        expected: { a: a.id, b: b.id, c: c.id, ac: [a.id, c.id].sort() },
      };
    });
    expect(outcome.g1).toEqual([outcome.expected.b]);
    expect(outcome.g8).toEqual([outcome.expected.a]);
    expect(outcome.g9).toEqual(outcome.expected.ac);
    expect(outcome.g9Region).toEqual([outcome.expected.c]);
    expect(outcome.g8g9).toEqual([outcome.expected.a]);
  });
});

describe("L3G-T4 the exact figures (10 RG71; modele -2)", () => {
  it("L3G-T4 modele -2: the figures of every line equal the rule of the creator record (EXACT_FIGURES_JOINS): declared and dated by their measure, or observed by the holding audience badge and dated by its grant", async () => {
    const fragment = recordFragment();
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx, {
        lines: [
          { network: "instagram", followers: 47312 },
          { network: "tiktok", followers: 61000 },
        ],
      });
      await giveBadge(tx, creator, 1, "tiktok", "audience_verified");
      const searched = await identified(tx);
      const record = await tx.unsafe<Row[]>(
        `select f.followers::float8 as followers, f.posts::float8 as posts,
                f.comments::float8 as comments, f.engagement::float8 as engagement,
                to_char(f.measured_at at time zone 'UTC', '${ISO_UTC}') as measured_at, f.source
           from profiles.creator_social_accounts n
           ${fragment}
          where n.account_id = $1::uuid
          order by n.is_primary desc, n.network_code, n.id`,
        [creator.id],
      );
      return { row: rowOf(searched.answer, creator), record };
    });
    const served = (outcome.row?.networks ?? []).map((line) => ({
      followers: line.followers,
      posts: line.postsLast30Days,
      comments: line.avgComments,
      engagement: line.engagementBp,
      measured_at: line.measuredAt,
      source: line.source,
    }));
    expect(served).toEqual(outcome.record);
    expect(served).toMatchObject([
      {
        followers: 47312,
        posts: 12,
        comments: 30,
        engagement: 350,
        source: "declared",
      },
      {
        followers: 50210,
        posts: 9,
        comments: 41,
        engagement: 420,
        source: "agent_observed",
      },
    ]);
  });

  it("L3G-T4 RG71: serves the exact share of the main audience and the best holding badge of each line {level, state}, never a band in place of a figure", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx, {
        share: 72,
        lines: [{ network: "instagram" }, { network: "tiktok" }],
      });
      await giveBadge(
        tx,
        creator,
        0,
        "instagram",
        "account_verified",
        "to_refresh",
      );
      await giveBadge(tx, creator, 1, "tiktok", "account_verified");
      await giveBadge(tx, creator, 1, "tiktok", "audience_verified");
      const bare = await newCreator(tx);
      const searched = await identified(tx);
      return {
        row: rowOf(searched.answer, creator),
        bare: rowOf(searched.answer, bare),
      };
    });
    expect(outcome.row?.mainAudience).toEqual({
      country: COUNTRY,
      sharePercent: 72,
    });
    expect(outcome.row?.networks.map((line) => line.badge)).toEqual([
      { level: "account_verified", state: "to_refresh" },
      { level: "audience_verified", state: "active" },
    ]);
    expect(outcome.bare?.mainAudience).toEqual({
      country: COUNTRY,
      sharePercent: null,
    });
    expect(outcome.bare?.networks.map((line) => line.badge)).toEqual([null]);
    const keys = Object.keys(outcome.row?.networks[0] ?? {}).sort();
    expect(keys).toEqual(
      [
        "avgComments",
        "badge",
        "engagementBp",
        "followers",
        "handle",
        "isPrimary",
        "measuredAt",
        "network",
        "postsLast30Days",
        "profileUrl",
        "pseudonym",
        "source",
      ].sort(),
    );
  });
});

describe("L3G-T4 the count, the switch and the pages (10 RG62, RG76; CA61; TM12.3)", () => {
  it("L3G-T4 RG62, CA61: counts exactly, below k and with the switch closed: two creators give total 2 and two rows, none gives total 0 and no row", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "is_open_to_advertisers", false);
      await setting(tx, "k_anonymity_threshold", 5);
      await newCreators(tx, 2);
      const two = await identified(tx);
      const none = await identified(tx, { ...HERE, F1: "travel" });
      return {
        two: two.answer,
        none: none.answer,
        lines: [two.line, none.line],
      };
    });
    expect(outcome.two).toMatchObject({ state: "results", total: 2, page: 1 });
    expect(outcome.two.rows).toHaveLength(2);
    expect(outcome.none).toEqual({
      state: "results",
      total: 0,
      page: 1,
      nextPage: null,
      capReached: false,
      rows: [],
    });
    expect(outcome.lines.map((line) => line?.result_count)).toEqual([2, 0]);
    expect(outcome.lines.map((line) => line?.blocked)).toEqual([false, false]);
  });

  it("L3G-T4 TM12.2: reads identified_view at every call: pageSize rows per page, the next page, capReached on the last page allowed, no row beyond the results", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreators(tx, 12);
      await setting(tx, "identified_view", { pageSize: 10, maxPages: 1 });
      const capped = await identified(tx);
      await setting(tx, "identified_view", { pageSize: 10, maxPages: 3 });
      const first = await identified(tx);
      const second = await identified(tx, HERE, { page: 2 });
      const beyond = await identified(tx, HERE, { page: 3 });
      const summary = (answer: Answer) => ({
        total: answer.total,
        rows: answer.rows?.length,
        nextPage: answer.nextPage,
        capReached: answer.capReached,
      });
      return {
        capped: summary(capped.answer),
        first: summary(first.answer),
        second: summary(second.answer),
        beyond: summary(beyond.answer),
        disjoint: new Set([
          ...aliasesOf(first.answer),
          ...aliasesOf(second.answer),
        ]).size,
      };
    });
    expect(outcome.capped).toEqual({
      total: 12,
      rows: 10,
      nextPage: null,
      capReached: true,
    });
    expect(outcome.first).toEqual({
      total: 12,
      rows: 10,
      nextPage: 2,
      capReached: false,
    });
    expect(outcome.second).toEqual({
      total: 12,
      rows: 2,
      nextPage: null,
      capReached: false,
    });
    expect(outcome.beyond).toEqual({
      total: 12,
      rows: 0,
      nextPage: null,
      capReached: false,
    });
    expect(outcome.disjoint).toBe(12);
  });

  it("L3G-T4 RG76, TM12.3: a page beyond maxPages answers {state: page_cap} and journals the attempt; the door takes no size parameter and the setting holds its bounds", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreators(tx, 2);
      await setting(tx, "identified_view", { pageSize: 10, maxPages: 2 });
      const capped = await identified(tx, HERE, { page: 3 });
      const [door] = await tx<{ args: string[] }[]>`
        select p.proargnames::text[] as args from pg_catalog.pg_proc p
         where p.oid = ${DOOR_SIGNATURE}::regprocedure`;
      const bounds: string[] = [];
      for (const value of [
        { pageSize: 9, maxPages: 2 },
        { pageSize: 51, maxPages: 2 },
        { pageSize: 20, maxPages: 21 },
        { pageSize: 20 },
        { pageSize: 20, maxPages: 2, extra: 1 },
      ]) {
        const updated = await run(
          tx,
          "update search.search_settings set value = $1::text::jsonb where key = 'identified_view'",
          [JSON.stringify(value)],
        );
        bounds.push(updated.outcome === "error" ? updated.code : "ok");
      }
      return {
        capped: capped.answer,
        line: capped.line,
        args: door?.args,
        bounds,
      };
    });
    expect(outcome.capped).toEqual({ state: "page_cap" });
    expect(outcome.line).toMatchObject({
      outcome: "page_cap",
      result_count: 0,
      page_reached: 3,
      view_mode: "agent_identified",
    });
    expect(outcome.args).toEqual([
      "p_filters",
      "p_sort",
      "p_page",
      "p_campaign_id",
      "p_prefill_id",
    ]);
    expect(outcome.bounds).toEqual(Array.from({ length: 5 }, () => "23514"));
  });
});

describe("L3G-T4 the journal (10 RG78, RG87; CA58; D45, RG8)", () => {
  it("L3G-T4 RG78, CA58: journals a served call nominatively (account, role, view, campaign, filters, sort, facet version, exact count, page, request) with one impression per row, its rank and its reasons in bands; never an exposure nor an exact value", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(
        tx,
        brand,
        "food_beverages",
        "published",
      );
      const creators = await newCreators(tx, 3);
      const filters = { ...HERE, G2: ["published"] };
      const searched = await identified(tx, filters, {
        campaign,
        sort: "audience",
      });
      const impressions = await tx<
        { creator: string; rank: number; reasons: number }[]
      >`
        select i.creator_account_id::text as creator, i.rank::int as rank,
               (select count(*)::int from search.impression_reasons r
                 where r.search_query_id = i.search_query_id
                   and r.creator_account_id = i.creator_account_id) as reasons
          from search.search_impressions i
         where i.search_query_id = ${searched.line?.search_query_id ?? null}::uuid
         order by i.rank`;
      const [params] = await tx<{ text: string }[]>`
        select coalesce(string_agg(r.reason_params::text, ' '), '') as text
          from search.impression_reasons r
         where r.search_query_id = ${searched.line?.search_query_id ?? null}::uuid`;
      const [exposures] = await tx<{ count: number }[]>`
        select count(*)::int as count from search.creator_exposures
         where creator_account_id = any (${creators.map((c) => c.id)}::uuid[])`;
      return {
        searched,
        filters,
        campaign,
        impressions,
        params: params?.text ?? "",
        exposures: exposures?.count,
      };
    });
    expect(outcome.searched.line).toEqual({
      search_query_id: expect.any(String),
      account_id: agentA,
      outcome: "served",
      filters: outcome.filters,
      sort_code: "audience",
      result_count: 3,
      page_reached: 1,
      blocked: false,
      campaign_id: outcome.campaign,
      actor_role: "agent",
      view_mode: "agent_identified",
      version: outcome.searched.line?.latest,
      latest: outcome.searched.line?.latest,
      request_id: outcome.searched.request,
    });
    expect(outcome.impressions.map((row) => row.rank)).toEqual([1, 2, 3]);
    expect(outcome.impressions.map((row) => row.creator)).toEqual(
      (outcome.searched.answer.rows ?? []).map((row) => row.accountId),
    );
    expect(outcome.impressions.every((row) => row.reasons >= 2)).toBe(true);
    expect(outcome.params).not.toMatch(/47312|350|\b12\b|\b30\b/);
    expect(outcome.exposures).toBe(0);
  });

  it("L3G-T4 CA58: a write of the journal refused, nothing is served (the search line, then an impression)", async () => {
    const outcome = await scenario(async (tx) => {
      await newCreators(tx, 2);
      await tx.unsafe(`
        create function search.l3g_t4_refuse() returns trigger language plpgsql
          set search_path = '' as $fn$
        begin
          raise exception 'journal refused' using errcode = 'object_not_in_prerequisite_state';
        end $fn$`);
      await tx.unsafe(`
        create trigger l3g_t4_refuse before insert on search.search_queries
          for each row execute function search.l3g_t4_refuse()`);
      const lineRefused = await identified(tx);
      await tx.unsafe("drop trigger l3g_t4_refuse on search.search_queries");
      await tx.unsafe(
        `revoke insert on search.search_impressions from ${OWNER}`,
      );
      const impressionRefused = await identified(tx);
      return {
        codes: [
          errorOf(lineRefused.outcome),
          errorOf(impressionRefused.outcome),
        ],
        lines: [lineRefused.line, impressionRefused.line].filter(
          (l) => l !== undefined,
        ).length,
      };
    });
    expect(outcome.codes).toEqual(["55000", INSUFFICIENT_PRIVILEGE]);
    expect(outcome.lines).toBe(0);
  });

  it("L3G-T4 D45, RG8, CA64: a search emits no lead event, no audit line, nothing in matching.* and nothing toward the creator", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(
        tx,
        brand,
        "food_beverages",
        "published",
      );
      await newCreators(tx, 2);
      const count = async () => {
        const [row] = await tx<Row[]>`
          select (select count(*)::int from leads.outbox_events) as outbox,
                 (select count(*)::int from audit.audit_events) as audit,
                 (select count(*)::int from matching.party_blocks) as blocks,
                 (select count(*)::int from matching.block_reasons) as reasons`;
        return row;
      };
      const before = await count();
      const searched = await identified(tx, HERE, { campaign });
      const after = await count();
      return { before, after, state: searched.answer.state };
    });
    expect(outcome.state).toBe("results");
    expect(outcome.after).toEqual(outcome.before);
  });

  it("L3G-T4 RG4, RG71, RG77: one engine and one order: the published storefronts come in the brand's order, with the brand's reasons and notes", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "is_open_to_advertisers", true);
      const brand = await newBrand(tx);
      await newCreators(tx, 6);
      await newCreator(tx, { status: "draft" });
      const branded = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brand, role: "advertiser", aal: "aal1" },
        () =>
          run<{
            answer: {
              cards?: {
                creator: { alias: string };
                reasons: unknown;
                vigilance: unknown;
              }[];
            };
          }>(tx, BRAND_DOOR, [JSON.stringify(HERE), "default", 1, null]),
      );
      const cards =
        branded.outcome === "rows" ? (branded.rows[0]?.answer.cards ?? []) : [];
      const agent = await identified(tx, { ...HERE, G2: ["published"] });
      return {
        brand: cards.map((card) => ({
          alias: card.creator.alias,
          reasons: card.reasons,
          vigilance: card.vigilance,
        })),
        agent: (agent.answer.rows ?? []).map((row) => ({
          alias: row.alias,
          reasons: row.reasons,
          vigilance: row.vigilance,
        })),
      };
    });
    expect(outcome.brand).toHaveLength(6);
    expect(outcome.agent).toEqual(outcome.brand);
  });
});
