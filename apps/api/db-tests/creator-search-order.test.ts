// L3E commit 07 — the explainable order, the cold quota and the reasons, 0320 (jalons/l3e/07.md;
// l3e-fiche.md invariants 2, 5, 7, 8, 9, 16; jalons/l3e/modele.md §6, §7; 10 RG35 to RG46, RG88,
// CA4, CA23 to CA33; D11).
//   L3E-T7  the order helper in the catalogue and the new rights of the owner; tiers 1, 2, 3, 4, 6
//           and 8 in the order of RG35; the same order for two brands the same UTC day, only tier 8
//           the next day (the day of the helper simulated); the four sorts of the pilot; the cold
//           quota read in table, applied to page 1 of the default sort, never a result outside the
//           filters; 2 to 4 reasons written at the impression, codes and bands only, each read on
//           the card; one vigilance note at most; no score anywhere.
// Each case runs in a rolled-back transaction of the local superuser, which sets aside the
// storefronts of earlier runs sharing the audience country of this file, opens the switch and
// writes its fixtures outside the guards; a search runs as apps/api does (influx_advertiser and the
// brand's context); another day is read from search.creator_order() run by its owner.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { putCampaignInState } from "./campaign-publication-kit.ts";
import { actAsMember, localSuperuser, testDataSet } from "./support.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

const agentA = accountIdOf("agent", "a");
const OWNER = "influx_creator_search_definer";
const ORDER_SIGNATURE =
  "search.creator_order(uuid[],jsonb,text,uuid,integer,integer,date)";

/** The audience country of this file's storefronts (another than the door's file). */
const COUNTRY = "IE";
const HERE = { F6: { country: COUNTRY } };

const DOOR =
  "select search.search_creators($1::text::jsonb, $2::text, $3::integer, $4::uuid) as answer";

type Reason = { code: string; params: Record<string, string> };
type Line = {
  networkCode: string;
  isPrimary: boolean;
  audienceBand: string | null;
  figuresMeasuredAt: string | null;
  badges: { level: string }[];
};
type Card = {
  creator: Row & {
    alias: string;
    lines: Line[];
    formats: string[];
    publication_languages: string[];
  };
  reasons: Reason[];
  vigilance: string | null;
};
type Answer = { state: string; cards?: Card[] };

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
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3e-t7-${id}@example.test`}, now(), 'FR', 'fr',
            'L3E T7 Person', true, now(), ${role === "creator" ? "individual" : "business"})`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, ${role})`;
  return id;
}

async function newBrand(tx: Tx, sector = "sports_leisure"): Promise<string> {
  const id = await newAccount(tx, "advertiser");
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3E T7 Brand', ${sector}, '11_50', ${`l3e-t7-${id.slice(0, 8)}.example`},
            'A brand of the L3E tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  await tx`update profiles.advertiser_profiles set status = 'published' where account_id = ${id}`;
  return id;
}

/**
 * A campaign of `brand`: its deliverables (network, format) and targeted countries, then submitted
 * (pending_review: a search admits a campaign of origin out of draft only, 0322, EC-L3F-02-2).
 */
async function newCampaign(
  tx: Tx,
  brand: string,
  deliverables: [string, string][],
  countries: string[],
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns (advertiser_account_id, sector_code)
    values (${brand}, 'beauty_personal_care') returning id::text`;
  const id = row?.id ?? "";
  for (const [index, [network, format]] of deliverables.entries()) {
    await tx`insert into campaigns.campaign_deliverables
               (campaign_id, slot, network_code, format_code, quantity)
             values (${id}, ${index + 1}, ${network}, ${format}, 1)`;
  }
  for (const [index, country] of countries.entries()) {
    await tx`insert into campaigns.campaign_audience_countries (campaign_id, slot, country_code)
             values (${id}, ${index + 1}, ${country})`;
  }
  await putCampaignInState(tx, id, "pending_review");
  return id;
}

type NetworkLine = { network?: string; followers?: number };
type CreatorSpec = {
  lines?: NetworkLine[];
  languages?: string[];
  formats?: string[];
  share?: "ge_80" | "50_80" | "lt_50";
  /** days since the figures of every line (0 by default) */
  measured?: number;
  /** days since the publication (40 by default: not recent) */
  published?: number;
  availability?: "lt_2w" | "lt_1m" | "full" | null;
  /** days since a first page 1 (none by default: cold) */
  exposed?: number;
};
type Creator = { id: string; alias: string; lines: string[] };

/** A published, searchable storefront of this file's country: one listed Instagram line (micro). */
async function newCreator(tx: Tx, spec: CreatorSpec = {}): Promise<Creator> {
  const id = await newAccount(tx, "creator");
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
              ${`l3e_t7_${id.slice(0, 8)}_${index}`}, ${line.followers ?? 47312}, 12, 30,
              now() - make_interval(days => ${spec.measured ?? 0}))
      returning id::text`;
    if (row === undefined) throw new Error("no line");
    await tx`update profiles.creator_public_networks set listed_at = now()
              where social_account_id = ${row.id}`;
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
  const [row] = await tx<{ alias: string }[]>`
    update profiles.creator_public_profiles
       set status = 'published',
           published_at = now() - make_interval(days => ${spec.published ?? 40}),
           is_searchable = true,
           primary_topic_code = 'pets',
           main_audience_country = ${COUNTRY},
           main_audience_share_band = ${spec.share ?? "ge_80"},
           availability_band = ${spec.availability ?? null}
     where account_id = ${id}
     returning alias`;
  if (row === undefined) throw new Error("no storefront");
  if (spec.exposed !== undefined) {
    await tx`insert into search.creator_exposures (creator_account_id, first_page_at)
             values (${id}, now() - make_interval(days => ${spec.exposed}))`;
  }
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

/** A holding badge of a line, decided by agent A. */
async function giveBadge(
  tx: Tx,
  creator: Creator,
  level: "account_verified" | "audience_verified" = "account_verified",
  state: "active" | "to_refresh" = "active",
): Promise<void> {
  const line = creator.lines[0] ?? "";
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${creator.id}, ${line}, 'instagram', ${level}, 'pending')
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
          values (${creator.id}, ${line}, 'instagram', ${request?.id ?? null}, 'account_verified',
                  ${agentA}, now(), 'public_profile', 'l3e_t7_handle')
          returning id::text`
      : await tx<{ id: string }[]>`
          insert into verification.badges
            (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
             granted_at, expires_at, evidence_source, observed_followers,
             observed_posts_last_30_days, observed_avg_comments, observed_engagement_bp,
             observed_period_start, observed_period_end, declared_posts_at_decision,
             declared_comments_at_decision, observed_handle_at_decision)
          values (${creator.id}, ${line}, 'instagram', ${request?.id ?? null},
                  'audience_verified', ${agentA}, now(), now() + interval '90 days',
                  'native_dashboard', 47312, 12, 30, 420, current_date - 30, current_date - 1,
                  12, 30, 'l3e_t7_handle')
          returning id::text`;
  if (state === "to_refresh") {
    await tx`update verification.badges set state = 'to_refresh' where id = ${badge?.id ?? null}`;
  }
}

// the searches ------------------------------------------------------------------------------------

type Searched = { answer: Answer; queryId: string | undefined };

async function search(
  tx: Tx,
  brand: string,
  filters: unknown = HERE,
  options: { sort?: string; page?: number; campaign?: string } = {},
): Promise<Searched> {
  const request = `l3e-t7-${randomUUID()}`;
  await tx`select pg_catalog.set_config('influx.request_id', ${request}, true)`;
  const rows = await actAsMember(
    tx,
    "influx_advertiser",
    { accountId: brand, role: "advertiser", aal: "aal1" },
    () =>
      tx.unsafe(DOOR, [
        JSON.stringify(filters),
        options.sort ?? "default",
        options.page ?? 1,
        options.campaign ?? null,
      ] as postgres.ParameterOrJSON<never>[]),
  );
  const [line] = await tx<{ id: string }[]>`
    select id::text from search.search_queries where request_id = ${request}`;
  return {
    answer: (rows[0]?.answer as Answer | undefined) ?? { state: "none" },
    queryId: line?.id,
  };
}

function aliasesOf(answer: Answer): string[] {
  return (answer.cards ?? []).map((card) => card.creator.alias);
}

type Placed = {
  alias: string;
  place: number;
  cold: boolean;
  reasons: Reason[] | null;
  vigilance: string | null;
};

/** search.creator_order() run by its owner for `brand` on the UTC day `days` from today. */
async function orderOn(
  tx: Tx,
  brand: string,
  days: number,
  filters: unknown = HERE,
  sort = "default",
  pageSize = 12,
): Promise<Placed[]> {
  await tx.unsafe(`set local role ${OWNER}`);
  await tx`select pg_catalog.set_config('influx.account', ${brand}, true)`;
  const rows = await tx<
    {
      id: string;
      place: number;
      cold: boolean;
      reasons: Reason[] | null;
      vigilance: string | null;
    }[]
  >`
    select o.creator_account_id::text as id, o.place, o.cold_quota as cold, o.reasons,
           o.vigilance
      from search.creator_order(
             (select coalesce(array_agg(c.creator_account_id), '{}'::uuid[])
                from search.creator_candidates('advertiser_anonymous', ${brand}::uuid,
                                               ${JSON.stringify(filters)}::text::jsonb, null) c),
             ${JSON.stringify(filters)}::text::jsonb, ${sort}, null, ${pageSize}, 1,
             (pg_catalog.timezone('UTC', now())::date + ${days}::integer)) o
     order by o.place`;
  await tx.unsafe("reset role");
  const aliases = await tx<{ id: string; alias: string }[]>`
    select account_id::text as id, alias from profiles.creator_public_profiles
     where account_id = any (${rows.map((row) => row.id)}::uuid[])`;
  const byId = new Map(aliases.map((row) => [row.id, row.alias]));
  return rows.map((row) => ({
    alias: byId.get(row.id) ?? "?",
    place: row.place,
    cold: row.cold,
    reasons: row.reasons,
    vigilance: row.vigilance,
  }));
}

/** The aliases of `creators` in the order of tier 8 on the UTC day `days` from today. */
async function rotation(
  tx: Tx,
  creators: readonly Creator[],
  days: number,
): Promise<string[]> {
  const rows = await tx<{ alias: string }[]>`
    select p.alias from profiles.creator_public_profiles p
     where p.account_id = any (${creators.map((creator) => creator.id)}::uuid[])
     order by pg_catalog.md5((pg_catalog.timezone('UTC', now())::date + ${days}::integer)::text
                             || ':' || p.account_id::text), p.account_id`;
  return rows.map((row) => row.alias);
}

function cardOf(answer: Answer, creator: Creator): Card | undefined {
  return (answer.cards ?? []).find(
    (card) => card.creator.alias === creator.alias,
  );
}

/** RG41 rule 2, CA28: a reason is a fact of the card itself. */
function readOnCard(card: Card, reason: Reason): boolean {
  const c = card.creator;
  const p = reason.params;
  const line = (network: string | undefined) =>
    c.lines.filter((found) => found.networkCode === network);
  switch (reason.code) {
    case "topic_match":
    case "primary_topic":
      return c.primary_topic === p.topic;
    case "network_match":
      return line(p.network).some(
        (found) => found.audienceBand === p.audienceBand,
      );
    case "audience_country_match":
    case "campaign_audience_country":
    case "main_audience":
      return (
        c.main_audience_country === p.country &&
        c.main_audience_share_band === p.shareBand
      );
    case "language_match":
      return c.publication_languages.includes(p.language ?? "");
    case "format_match":
      return c.formats.includes(p.format ?? "");
    case "campaign_format":
      return line(p.network).length > 0 && c.formats.includes(p.format ?? "");
    case "audience_verified":
    case "account_verified":
      return line(p.network).some((found) =>
        found.badges.some((badge) => badge.level === reason.code),
      );
    case "figures_fresh":
      return line(p.network).some(
        (found) =>
          found.isPrimary &&
          found.figuresMeasuredAt !== null &&
          Date.now() - Date.parse(found.figuresMeasuredAt) < 91 * 86_400_000,
      );
    case "available":
      return c.availability === p.availability;
    default:
      return false;
  }
}

// the cases ---------------------------------------------------------------------------------------

describe("L3E-T7 the order helper and the rights of 0320 (03 P7; fiche invariants 7, 15, 16)", () => {
  it("L3E-T7 makes search.creator_order() an invoker helper of the owner executed by nobody; the owner reads the quota, first_page_at, the tier-2 columns of its campaigns and inserts the reasons; no score column; the version of 0320 is the latest and journaled", async () => {
    const outcome = await scenario(async (tx) => {
      const [fn] = await tx<Row[]>`
        select pg_catalog.pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
               p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                              pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner) as callers
          from pg_catalog.pg_proc p where p.oid = ${ORDER_SIGNATURE}::regprocedure`;
      const columns = await tx<{ name: string }[]>`
        select at.attrelid::regclass::text || '.' || at.attname || ' ' ||
               case when pg_catalog.has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'SELECT')
                    then 'S' else '' end ||
               case when pg_catalog.has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'INSERT')
                    then 'I' else '' end as name
          from pg_catalog.pg_attribute at
         where at.attrelid in ('campaigns.campaign_deliverables'::regclass,
                               'campaigns.campaign_audience_countries'::regclass,
                               'search.creator_exposures'::regclass,
                               'search.impression_reasons'::regclass)
           and at.attnum > 0 and not at.attisdropped
           and pg_catalog.has_column_privilege(${OWNER}, at.attrelid, at.attnum, 'SELECT, INSERT')`;
      const [policy] = await tx<{ qual: string }[]>`
        select qual from pg_catalog.pg_policies
         where schemaname = 'search' and tablename = 'search_settings'
           and policyname = 'search_settings_creator_search_definer_select'`;
      const [score] = await tx<{ n: number }[]>`
        select count(*)::int as n from pg_catalog.pg_attribute at
          join pg_catalog.pg_class c on c.oid = at.attrelid
         where c.relnamespace = 'search'::regnamespace and at.attnum > 0
           and at.attname ~* 'score'`;
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      const searched = await search(tx, brand);
      const [version] = await tx<{ note: string; used: boolean }[]>`
        select v.note,
               v.version = (select q.facet_config_version from search.search_queries q
                             where q.id = ${searched.queryId ?? null}::uuid) as used
          from search.facet_config_versions v order by v.version desc limit 1`;
      return {
        fn,
        columns: columns.map((row) => row.name).sort(),
        policy,
        score,
        version,
      };
    });
    expect(outcome.fn).toEqual({
      owner: OWNER,
      definer: false,
      config: ['search_path=""'],
      callers: [],
    });
    expect(outcome.columns).toEqual([
      "campaigns.campaign_audience_countries.campaign_id S",
      "campaigns.campaign_audience_countries.country_code S",
      "campaigns.campaign_deliverables.campaign_id S",
      "campaigns.campaign_deliverables.format_code S",
      "campaigns.campaign_deliverables.network_code S",
      "campaigns.campaign_deliverables.slot S",
      "search.creator_exposures.creator_account_id SI",
      "search.creator_exposures.first_page_at SI",
      "search.impression_reasons.creator_account_id I",
      "search.impression_reasons.position I",
      "search.impression_reasons.reason_code I",
      "search.impression_reasons.reason_params I",
      "search.impression_reasons.search_query_id I",
    ]);
    expect(outcome.policy?.qual).toContain("cold_profile_quota");
    expect(outcome.score?.n).toBe(0);
    expect(outcome.version?.note).toMatch(/^L3E 0320:/);
    expect(outcome.version?.used).toBe(true);
  });
});

describe("L3E-T7 the tiers in the order of RG35 (10 RG35 to RG40; CA23, CA24, CA25, CA26)", () => {
  it("L3E-T7 CA24, RG36: two brands the same UTC day get the same order, the order of the helper on that day", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx, "food_beverages");
      const verified = await newCreators(tx, 3);
      for (const creator of verified) await giveBadge(tx, creator);
      await newCreators(tx, 4, { availability: "lt_2w" });
      await newCreators(tx, 2, { measured: 120 });
      const mine = aliasesOf((await search(tx, brand)).answer);
      const theirs = aliasesOf((await search(tx, other)).answer);
      const helper = (await orderOn(tx, brand, 0)).map((row) => row.alias);
      return { mine, theirs, helper };
    });
    expect(outcome.mine).toHaveLength(9);
    expect(outcome.theirs).toEqual(outcome.mine);
    expect(outcome.helper).toEqual(outcome.mine);
  });

  it("L3E-T7 CA25: the next UTC day, tiers 1 to 7 rank the same groups; only tier 8 redistributes inside each group", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const verified = await newCreators(tx, 4);
      for (const creator of verified) await giveBadge(tx, creator);
      const plain = await newCreators(tx, 4);
      const stale = await newCreators(tx, 4, { measured: 100 });
      const days = [0, 1, 2];
      const orders: string[][] = [];
      const expected: string[][] = [];
      for (const day of days) {
        orders.push((await orderOn(tx, brand, day)).map((row) => row.alias));
        expected.push([
          ...(await rotation(tx, verified, day)),
          ...(await rotation(tx, plain, day)),
          ...(await rotation(tx, stale, day)),
        ]);
      }
      return { orders, expected };
    });
    expect(outcome.orders).toEqual(outcome.expected);
    // the rotation moves: three days never give three identical orders of twelve
    expect(
      new Set(outcome.orders.map((order) => order.join())).size,
    ).toBeGreaterThan(1);
  });

  it("L3E-T7 CA26: audience verified, then account verified, then no badge, all else equal; the reason names the badge's network", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 3);
      const account = await newCreator(tx);
      await giveBadge(tx, account, "account_verified");
      const audience = await newCreator(tx);
      await giveBadge(tx, audience, "audience_verified");
      const answer = (await search(tx, brand)).answer;
      return {
        order: aliasesOf(answer).slice(0, 2),
        aliases: [audience.alias, account.alias],
        reasons: [cardOf(answer, audience), cardOf(answer, account)].map(
          (card) =>
            card?.reasons.filter((reason) => reason.code.endsWith("_verified")),
        ),
      };
    });
    expect(outcome.order).toEqual(outcome.aliases);
    expect(outcome.reasons).toEqual([
      [{ code: "audience_verified", params: { network: "instagram" } }],
      [{ code: "account_verified", params: { network: "instagram" } }],
    ]);
  });

  it("L3E-T7 CA23, RG39: figures of 91 days are demoted below 90 days, stay listed and carry stale_figures; 90 days carry figures_fresh", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 3, { measured: 30 });
      const old = await newCreator(tx, { measured: 91 });
      const edge = await newCreator(tx, { measured: 90 });
      const answer = (await search(tx, brand)).answer;
      const aliases = aliasesOf(answer);
      return {
        last: aliases[aliases.length - 1],
        old: old.alias,
        edgeBeforeOld: aliases.indexOf(edge.alias) < aliases.indexOf(old.alias),
        oldCard: cardOf(answer, old),
        edgeCard: cardOf(answer, edge),
      };
    });
    expect(outcome.last).toBe(outcome.old);
    expect(outcome.edgeBeforeOld).toBe(true);
    expect(outcome.oldCard?.vigilance).toBe("stale_figures");
    expect(outcome.oldCard?.reasons.map((reason) => reason.code)).not.toContain(
      "figures_fresh",
    );
    expect(outcome.edgeCard?.vigilance).toBeNull();
    expect(outcome.edgeCard?.reasons.map((reason) => reason.code)).toContain(
      "figures_fresh",
    );
  });

  it("L3E-T7 RG35 tier 1 before tier 3: two OR values of F8 satisfied rank ahead of one, even verified; the reason cites the first language", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const filters = { ...HERE, F8: ["fr", "en"] };
      const mono = await newCreators(tx, 4);
      for (const creator of mono) await giveBadge(tx, creator);
      const both = await newCreator(tx, { languages: ["en", "fr"] });
      const answer = (await search(tx, brand, filters)).answer;
      return {
        first: aliasesOf(answer)[0],
        both: both.alias,
        reason: cardOf(answer, both)?.reasons.find(
          (r) => r.code === "language_match",
        ),
      };
    });
    expect(outcome.first).toBe(outcome.both);
    expect(outcome.reason).toEqual({
      code: "language_match",
      params: { language: "en" },
    });
  });

  it("L3E-T7 RG35 tier 6: less than two weeks, less than a month, undeclared, full; available cited, full noted declared_full", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const full = await newCreator(tx, { availability: "full" });
      const none = await newCreator(tx);
      const month = await newCreator(tx, { availability: "lt_1m" });
      const weeks = await newCreator(tx, { availability: "lt_2w" });
      await newCreator(tx, { availability: "full" });
      const answer = (await search(tx, brand)).answer;
      return {
        order: aliasesOf(answer).slice(0, 3),
        expected: [weeks.alias, month.alias, none.alias],
        weeks: cardOf(answer, weeks)?.reasons.find(
          (r) => r.code === "available",
        ),
        full: cardOf(answer, full)?.vigilance,
      };
    });
    expect(outcome.order).toEqual(outcome.expected);
    expect(outcome.weeks).toEqual({
      code: "available",
      params: { availability: "lt_2w" },
    });
    expect(outcome.full).toBe("declared_full");
  });
});

describe("L3E-T7 the sorts of the pilot (10 RG43, RG44; CA31, CA32, CA33)", () => {
  it("L3E-T7 RG43: verified_first puts tier 3 ahead of tier 1; audience ranks the best band of the lines of F3", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const filters = { ...HERE, F8: ["fr", "en"] };
      const both = await newCreators(tx, 4, { languages: ["fr", "en"] });
      const verified = await newCreator(tx);
      await giveBadge(tx, verified);
      const first = aliasesOf(
        (await search(tx, brand, filters, { sort: "verified_first" })).answer,
      )[0];
      const tiktok = { ...HERE, F3: ["tiktok"] };
      const mid = await newCreator(tx, {
        lines: [{ network: "tiktok", followers: 120_000 }],
        formats: ["tiktok_video"],
      });
      await newCreator(tx, {
        lines: [
          { network: "instagram", followers: 2_000_000 },
          { network: "tiktok", followers: 20_000 },
        ],
      });
      await newCreators(tx, 3, {
        lines: [{ network: "tiktok", followers: 5_000 }],
      });
      const audience = aliasesOf(
        (await search(tx, brand, tiktok, { sort: "audience" })).answer,
      );
      return {
        first,
        verified: verified.alias,
        audience,
        mid: mid.alias,
        both,
      };
    });
    expect(outcome.first).toBe(outcome.verified);
    expect(outcome.audience[0]).toBe(outcome.mid);
    expect(outcome.audience).toHaveLength(5);
  });

  it("L3E-T7 CA31, CA30: new_profiles puts the storefronts published less than recentDays days ago first; such a card is noted recent_profile, never anything else", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const old = await newCreators(tx, 4, { exposed: 5 });
      for (const creator of old) await giveBadge(tx, creator);
      const recent = await newCreator(tx, { published: 10 });
      const answer = (await search(tx, brand, HERE, { sort: "new_profiles" }))
        .answer;
      await setting(tx, "cold_profile_quota", { slots: 2, recentDays: 5 });
      const shorter = (await search(tx, brand, HERE, { sort: "new_profiles" }))
        .answer;
      return {
        first: aliasesOf(answer)[0],
        recent: recent.alias,
        note: cardOf(answer, recent)?.vigilance,
        shorterFirst: aliasesOf(shorter)[0],
        shorterNote: cardOf(shorter, recent)?.vigilance,
      };
    });
    expect(outcome.first).toBe(outcome.recent);
    expect(outcome.note).toBe("recent_profile");
    expect(outcome.shorterFirst).not.toBe(outcome.recent);
    expect(outcome.shorterNote).toBeNull();
  });

  it("L3E-T7 CA32, RG44: every sort of the pilot is journaled with its filters", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 5);
      const filters = { ...HERE, F8: ["fr"] };
      const lines: Row[] = [];
      for (const sort of [
        "default",
        "audience",
        "verified_first",
        "new_profiles",
      ]) {
        const searched = await search(tx, brand, filters, { sort });
        const [line] = await tx<Row[]>`
          select sort_code, filters from search.search_queries
           where id = ${searched.queryId ?? null}::uuid`;
        if (line !== undefined) lines.push(line);
      }
      return lines;
    });
    expect(outcome).toEqual(
      ["default", "audience", "verified_first", "new_profiles"].map((sort) => ({
        sort_code: sort,
        filters: { ...HERE, F8: ["fr"] },
      })),
    );
  });

  it("L3E-T7 CA33, RG37: from a campaign, tier 2 ranks its deliverables and targeted country ahead of a badge and names them; without the campaign it is neutral for all", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(
        tx,
        brand,
        [["tiktok", "tiktok_video"]],
        [COUNTRY],
      );
      const verified = await newCreators(tx, 4, { exposed: 5 });
      for (const creator of verified) await giveBadge(tx, creator);
      const fit = await newCreator(tx, {
        lines: [{ network: "tiktok" }],
        formats: ["tiktok_video"],
        exposed: 5,
      });
      const from = (await search(tx, brand, HERE, { campaign })).answer;
      const outside = (await search(tx, brand)).answer;
      return {
        fromFirst: aliasesOf(from)[0],
        outsideLast: aliasesOf(outside)[4],
        fit: fit.alias,
        reasons: cardOf(from, fit)?.reasons,
        outsideCodes: cardOf(outside, fit)?.reasons.map((r) => r.code),
      };
    });
    expect(outcome.fromFirst).toBe(outcome.fit);
    expect(outcome.outsideLast).toBe(outcome.fit);
    expect(outcome.reasons?.slice(0, 2)).toEqual([
      {
        code: "audience_country_match",
        params: { country: COUNTRY, shareBand: "ge_80" },
      },
      {
        code: "campaign_format",
        params: { network: "tiktok", format: "tiktok_video" },
      },
    ]);
    expect(outcome.reasons?.map((r) => r.code)).toContain(
      "campaign_audience_country",
    );
    expect(outcome.outsideCodes).not.toContain("campaign_format");
  });
});

describe("L3E-T7 the cold quota (10 RG45, RG46; CA29)", () => {
  it("L3E-T7 CA29, RG46: on page 1 of the default sort the two best-ranked colds take the last places, flagged cold_quota in the journal; the displaced open page 2; one order across pages", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const warm = await newCreators(tx, 12, { exposed: 3 });
      for (const creator of warm) await giveBadge(tx, creator);
      const cold = await newCreators(tx, 3);
      const coldAliases = await rotation(tx, cold, 0);
      const warmAliases = await rotation(tx, warm, 0);
      const first = await search(tx, brand);
      const second = await search(tx, brand, HERE, { page: 2 });
      const flags = await tx<{ rank: number; cold: boolean }[]>`
        select rank, cold_quota as cold from search.search_impressions
         where search_query_id = ${first.queryId ?? null}::uuid order by rank`;
      return {
        first: aliasesOf(first.answer),
        second: aliasesOf(second.answer),
        coldAliases,
        warmAliases,
        flags,
      };
    });
    expect(outcome.first).toEqual([
      ...outcome.warmAliases.slice(0, 10),
      ...outcome.coldAliases.slice(0, 2),
    ]);
    expect(outcome.second).toEqual([
      ...outcome.warmAliases.slice(10),
      outcome.coldAliases[2],
    ]);
    expect(
      outcome.flags.filter((flag) => flag.cold).map((flag) => flag.rank),
    ).toEqual([11, 12]);
  });

  it("L3E-T7 CA29: the quota never makes a result: a cold outside the filters stays out, slots come from the table (0: no place given)", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const filters = { ...HERE, F8: ["fr"] };
      const warm = await newCreators(tx, 12, { exposed: 3 });
      for (const creator of warm) await giveBadge(tx, creator);
      const cold = await newCreator(tx);
      await newCreator(tx, { languages: ["de"] });
      const one = aliasesOf((await search(tx, brand, filters)).answer);
      await setting(tx, "cold_profile_quota", { slots: 0, recentDays: 30 });
      const none = aliasesOf((await search(tx, brand, filters)).answer);
      return { one, none, cold: cold.alias };
    });
    expect(outcome.one).toHaveLength(12);
    expect(outcome.one[11]).toBe(outcome.cold);
    expect(outcome.none).not.toContain(outcome.cold);
  });

  it("L3E-T7 RG44: a named sort keeps its promise, the quota applies to the default sort only", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const warm = await newCreators(tx, 12, { exposed: 3 });
      for (const creator of warm) await giveBadge(tx, creator);
      const cold = await newCreators(tx, 2);
      const sorted = await search(tx, brand, HERE, { sort: "verified_first" });
      const [flags] = await tx<{ n: number }[]>`
        select count(*) filter (where cold_quota)::int as n from search.search_impressions
         where search_query_id = ${sorted.queryId ?? null}::uuid`;
      return {
        served: aliasesOf(sorted.answer),
        cold: cold.map((creator) => creator.alias),
        flagged: flags?.n,
      };
    });
    expect(outcome.served).toHaveLength(12);
    expect(
      outcome.served.filter((alias) => outcome.cold.includes(alias)),
    ).toEqual([]);
    expect(outcome.flagged).toBe(0);
  });
});

describe("L3E-T7 the reasons and the note (10 RG41, RG42; CA4, CA27, CA28)", () => {
  it("L3E-T7 CA27, CA28: every card carries 2 to 4 reasons of the closed list, in the order of the tiers, codes and bands only, each read on the card, written as shown in impression_reasons", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(
        tx,
        brand,
        [["instagram", "instagram_reel"]],
        [COUNTRY],
      );
      const filters = {
        ...HERE,
        F1: "pets",
        F3: ["instagram"],
        F8: ["fr"],
        F11: ["instagram_reel"],
      };
      const badged = await newCreators(tx, 3, { availability: "lt_2w" });
      for (const creator of badged)
        await giveBadge(tx, creator, "audience_verified");
      await newCreators(tx, 3, { measured: 120 });
      const searched = await search(tx, brand, filters, { campaign });
      const written = await tx<{ alias: string; reasons: Reason[] }[]>`
        select p.alias,
               jsonb_agg(jsonb_build_object('code', r.reason_code, 'params', r.reason_params)
                         order by r.position) as reasons
          from search.impression_reasons r
          join profiles.creator_public_profiles p on p.account_id = r.creator_account_id
         where r.search_query_id = ${searched.queryId ?? null}::uuid
         group by p.alias`;
      const [tiers] = await tx<{ tiers: Record<string, number | null> }[]>`
        select jsonb_object_agg(code, coalesce(tier, 99)) as tiers
          from search.explanation_reasons where kind = 'reason'`;
      return {
        cards: searched.answer.cards ?? [],
        written,
        tiers: tiers?.tiers ?? {},
      };
    });
    expect(outcome.cards).toHaveLength(6);
    for (const card of outcome.cards) {
      expect(card.reasons.length).toBeGreaterThanOrEqual(2);
      expect(card.reasons.length).toBeLessThanOrEqual(4);
      const tiers = card.reasons.map((reason) => outcome.tiers[reason.code]);
      expect(tiers.every((tier) => tier !== undefined)).toBe(true);
      expect(tiers).toEqual([...tiers].sort((a, b) => (a ?? 0) - (b ?? 0)));
      for (const reason of card.reasons) {
        expect(
          Object.values(reason.params).every(
            (v) => /^[A-Za-z0-9_]+$/.test(v) && !/^\d+$/.test(v),
          ),
        ).toBe(true);
        expect([reason.code, readOnCard(card, reason)]).toEqual([
          reason.code,
          true,
        ]);
      }
      expect(
        outcome.written.find((row) => row.alias === card.creator.alias)
          ?.reasons,
      ).toEqual(card.reasons);
    }
    expect(JSON.stringify(outcome.cards)).not.toMatch(/score|"rank"|"cold"/);
  });

  it("L3E-T7 RG41: under two reasons the card falls back on a fact required to publish, never one already cited", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 4);
      const stale = await newCreator(tx, { measured: 120 });
      const answer = (await search(tx, brand)).answer;
      const withTopic = (await search(tx, brand, { ...HERE, F1: "pets" }))
        .answer;
      return {
        stale: cardOf(answer, stale)?.reasons,
        topic: cardOf(withTopic, stale)?.reasons,
      };
    });
    expect(outcome.stale).toEqual([
      {
        code: "audience_country_match",
        params: { country: COUNTRY, shareBand: "ge_80" },
      },
      { code: "primary_topic", params: { topic: "pets" } },
    ]);
    expect(outcome.topic).toEqual([
      { code: "topic_match", params: { topic: "pets" } },
      {
        code: "audience_country_match",
        params: { country: COUNTRY, shareBand: "ge_80" },
      },
    ]);
  });

  it("L3E-T7 CA4, EC-L3E-2: an audience of 72 % in the country is cited by its band 50_80, never 72", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 4);
      const subject = await newCreator(tx);
      await tx`
        insert into profiles.creator_audience_countries
          (social_account_id, account_id, slot, country_code, share_percent)
        values (${subject.lines[0] ?? null}, ${subject.id}, 0, ${COUNTRY}, 72)`;
      await tx`
        update profiles.creator_public_profiles
           set main_audience_share_band = profiles.main_audience_share_band(72)
         where account_id = ${subject.id}`;
      const searched = await search(tx, brand);
      const card = cardOf(searched.answer, subject);
      const [params] = await tx<{ params: string }[]>`
        select string_agg(reason_params::text, ' ') as params from search.impression_reasons
         where search_query_id = ${searched.queryId ?? null}::uuid
           and creator_account_id = ${subject.id}`;
      return { card, params: params?.params ?? "" };
    });
    expect(
      outcome.card?.reasons.find((r) => r.code === "audience_country_match"),
    ).toEqual({
      code: "audience_country_match",
      params: { country: COUNTRY, shareBand: "50_80" },
    });
    expect(JSON.stringify(outcome.card?.reasons)).not.toContain("72");
    expect(outcome.params).not.toContain("72");
  });

  it("L3E-T7 RG42: one note at most, in its order: stale figures before a recent profile, an audience badge to renew, a declared full", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await newCreators(tx, 2);
      const both = await newCreator(tx, {
        measured: 120,
        published: 10,
        availability: "full",
      });
      const renew = await newCreator(tx, { availability: "full" });
      await giveBadge(tx, renew, "audience_verified", "to_refresh");
      const full = await newCreator(tx, { availability: "full" });
      const searched = await search(tx, brand);
      const notes = await tx<{ alias: string; note: string | null }[]>`
        select p.alias, i.vigilance_code as note from search.search_impressions i
          join profiles.creator_public_profiles p on p.account_id = i.creator_account_id
         where i.search_query_id = ${searched.queryId ?? null}::uuid`;
      const of = (creator: Creator) => ({
        card: cardOf(searched.answer, creator)?.vigilance,
        journal: notes.find((row) => row.alias === creator.alias)?.note,
      });
      return { both: of(both), renew: of(renew), full: of(full) };
    });
    expect(outcome.both).toEqual({
      card: "stale_figures",
      journal: "stale_figures",
    });
    expect(outcome.renew).toEqual({
      card: "audience_badge_to_renew",
      journal: "audience_badge_to_renew",
    });
    expect(outcome.full).toEqual({
      card: "declared_full",
      journal: "declared_full",
    });
  });
});
