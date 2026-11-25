// L3G commit 05 — the prefill of « Compatible creators » from the brief of a campaign, 0329
// (jalons/l3g/05.md; l3g-fiche.md invariants 2, 3, 5, 8, 12, 14; jalons/l3g/modele.md §4; 10 RG9, RG73,
// CA56; D78).
//   L3G-T5  search.campaign_prefills (T2: RLS forced, the restrictive member policy, no execution
//           right, append-only, codes only by CHECK) and search_queries.prefill_id; the prefill door,
//           the agents' alone (42501 for a member and in aal1), the diff executed by nobody; the
//           facets drawn from the brief one by one (F1 of rank 1, F3 and F11 of the deliverables, F4,
//           F6 country of rank 1, F8), a partial brief, a closed facet omitted; an unadmitted campaign
//           refused as an unknown one; the proposed filters journaled; the identified door that checks
//           the prefill (the caller's, the campaign's, 24 h) and journals the link, « Vider » included;
//           what was kept, removed and added (search.prefill_diff); never an amount, a band, a right,
//           an exclusivity nor an age (D78).
// Each case runs in a rolled-back transaction of the local superuser, which sets aside the storefronts
// of earlier runs sharing the audience country of this file, writes its fixtures outside the guards
// and acts as apps/api does (influx_app, then the internal or member role and its context).
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
const NO_DATA_FOUND = "P0002";
const CHECK_VIOLATION = "23514";

const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");
const brandA = accountIdOf("advertiser", "a");
const creatorA = accountIdOf("creator", "a");

const OWNER = "influx_agent_search_definer";

/** The audience country of this file's storefronts and briefs. */
const COUNTRY = "SM";

const PREFILL = "select search.prefill_campaign_filters($1::uuid) as answer";
const PREFILL_RAW =
  "select search.prefill_campaign_filters($1::uuid)::text as raw";
const DOOR =
  "select search.search_creators_identified($1::text::jsonb, $2::text, $3::integer, $4::uuid, $5::uuid) as answer";

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | { outcome: "error"; code: string; detail: string | undefined };

type Filters = Record<string, unknown>;

type Prefill = {
  prefillId: string;
  campaign: { id: string; title: string | null };
  filters: Filters;
};

type Answer = {
  state: string;
  total?: number;
  rows?: { accountId: string }[];
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
    const found = error as { code?: string; detail?: string };
    if (found.code === undefined) throw error;
    return { outcome: "error", code: found.code, detail: found.detail };
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
    await tx`update search.search_settings
                set value = '{"pageSize": 20, "maxPages": 10}'::jsonb
              where key = 'identified_view'`;
    return fn(tx);
  });
}

beforeAll(async () => {
  await testDataSet();
});

// the fixtures ------------------------------------------------------------------------------------

async function newAccount(
  tx: Tx,
  role: "creator" | "advertiser",
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3g-t5-${id}@example.test`}, now(), 'FR', 'fr',
            'L3G T5 Person', true, now(), ${role === "creator" ? "individual" : "business"})`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, ${role})`;
  return id;
}

/** A brand whose profile is published. */
async function newBrand(tx: Tx): Promise<string> {
  const id = await newAccount(tx, "advertiser");
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3G T5 Brand', 'sports_leisure', '11_50', ${`l3g-t5-${id.slice(0, 8)}.example`},
            'A brand of the L3G tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  await tx`update profiles.advertiser_profiles set status = 'published' where account_id = ${id}`;
  return id;
}

type Brief = {
  topics?: string[];
  /** Topics at explicit slots (the topic of rank 1 is the lowest slot), instead of `topics`. */
  topicSlots?: [number, string][];
  deliverables?: [string, string][];
  bands?: string[];
  countries?: string[];
  languages?: string[];
  ages?: string[];
  territories?: string[];
};

/** The full brief of the correspondence case: two topics, two deliverables, the rest by two. */
const FULL_BRIEF: Brief = {
  topics: ["pets", "food"],
  deliverables: [
    ["tiktok", "tiktok_video"],
    ["instagram", "instagram_reel"],
  ],
  bands: ["mid", "micro"],
  countries: [COUNTRY, "FR"],
  languages: ["fr", "en"],
  ages: ["18_24"],
  territories: ["FR"],
};

/**
 * A campaign of `brand` in draft, its brief written in its lists (slot order as given), then put in
 * `state` (pending_review by default), or erased.
 */
async function newCampaign(
  tx: Tx,
  brand: string,
  brief: Brief = FULL_BRIEF,
  state: CampaignState | "erased" = "pending_review",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns (advertiser_account_id, sector_code, title)
    values (${brand}, 'sports_leisure', 'L3G T5 compatible creators') returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  const id = row.id;
  const topics =
    brief.topicSlots ??
    (brief.topics ?? []).map((topic, index): [number, string] => [
      index + 1,
      topic,
    ]);
  for (const [slot, topic] of topics) {
    await tx`insert into campaigns.campaign_topics (campaign_id, slot, topic_code)
             values (${id}, ${slot}, ${topic})`;
  }
  for (const [index, [network, format]] of (
    brief.deliverables ?? []
  ).entries()) {
    await tx`insert into campaigns.campaign_deliverables
               (campaign_id, slot, network_code, format_code, quantity)
             values (${id}, ${index + 1}, ${network}, ${format}, 2)`;
  }
  for (const band of brief.bands ?? []) {
    await tx`insert into campaigns.campaign_audience_bands (campaign_id, audience_band_code)
             values (${id}, ${band})`;
  }
  for (const [index, country] of (brief.countries ?? []).entries()) {
    await tx`insert into campaigns.campaign_audience_countries (campaign_id, slot, country_code)
             values (${id}, ${index + 1}, ${country})`;
  }
  for (const language of brief.languages ?? []) {
    await tx`insert into campaigns.campaign_audience_languages (campaign_id, language_code)
             values (${id}, ${language})`;
  }
  for (const age of brief.ages ?? []) {
    await tx`insert into campaigns.campaign_audience_age_bands (campaign_id, age_band_code)
             values (${id}, ${age})`;
  }
  for (const [index, country] of (brief.territories ?? []).entries()) {
    await tx`insert into campaigns.campaign_usage_territories (campaign_id, slot, country_code)
             values (${id}, ${index + 1}, ${country})`;
  }
  if (state === "erased") {
    await putCampaignInState(tx, id, "closed");
    await tx`update campaigns.campaigns set erased_at = now() where id = ${id}`;
  } else {
    await putCampaignInState(tx, id, state);
  }
  return id;
}

/**
 * A published, searchable creator of the file's country: one listed line of `network` (47 312
 * followers, the band micro), French, the format given, the topic given.
 */
async function newCreator(
  tx: Tx,
  spec: { topic?: string; network?: string; format?: string } = {},
): Promise<string> {
  const id = await newAccount(tx, "creator");
  const network = spec.network ?? "instagram";
  await tx`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')`;
  const handle = `l3g_t5_${id.slice(0, 8)}`;
  const [line] = await tx<{ id: string }[]>`
    insert into profiles.creator_social_accounts
      (account_id, network_code, is_primary, handle, profile_url, followers_count,
       posts_last_30_days, avg_comments_per_post, engagement_rate_bp, figures_measured_at)
    values (${id}, ${network}, true, ${handle}, ${`https://www.${network}.com/${handle}`}, 47312,
            12, 30, 350, now() - interval '3 days')
    returning id::text`;
  await tx`update profiles.creator_public_networks set listed_at = now()
            where social_account_id = ${line?.id ?? null}`;
  await tx`insert into profiles.creator_publication_languages (account_id, slot, language_code)
           values (${id}, 1, 'fr')`;
  await tx`insert into profiles.creator_formats (account_id, format_code)
           values (${id}, ${spec.format ?? "instagram_reel"})`;
  await tx`
    update profiles.creator_public_profiles
       set status = 'published', published_at = now() - interval '40 days', is_searchable = true,
           primary_topic_code = ${spec.topic ?? "pets"}, main_audience_country = ${COUNTRY},
           main_audience_share_band = 'ge_80'
     where account_id = ${id}`;
  return id;
}

// the calls ---------------------------------------------------------------------------------------

type Caller = {
  role: "agent" | "admin";
  account: string;
  aal?: "aal1" | "aal2";
};

const AGENT: Caller = { role: "agent", account: agentA };
const ADMIN: Caller = { role: "admin", account: adminA };

function asInternal<T>(tx: Tx, caller: Caller, fn: () => Promise<T>) {
  return actAsInternal(
    tx,
    caller.role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: caller.account, role: caller.role, aal: caller.aal ?? "aal2" },
    fn,
  );
}

/** The prefill of `campaign` as apps/api asks it. */
async function prefill(
  tx: Tx,
  campaign: string,
  caller: Caller = AGENT,
): Promise<{ outcome: Outcome<{ answer: Prefill }>; answer: Prefill | null }> {
  const outcome = await asInternal(tx, caller, () =>
    run<{ answer: Prefill }>(tx, PREFILL, [campaign]),
  );
  return {
    outcome,
    answer:
      outcome.outcome === "rows" ? (outcome.rows[0]?.answer ?? null) : null,
  };
}

async function prefilled(
  tx: Tx,
  campaign: string,
  caller: Caller = AGENT,
): Promise<Prefill> {
  const { outcome, answer } = await prefill(tx, campaign, caller);
  if (answer === null) throw new Error(`no prefill: ${errorOf(outcome)}`);
  return answer;
}

type Searched = {
  outcome: Outcome<{ answer: Answer }>;
  answer: Answer;
  line: { prefill_id: string | null; filters: Filters } | undefined;
};

/** An identified search as apps/api runs it, then its journal line (by its request id). */
async function identified(
  tx: Tx,
  filters: Filters,
  options: {
    campaign?: string | null;
    prefill?: string | null;
    page?: number;
    as?: Caller;
  },
): Promise<Searched> {
  const request = `l3g-t5-${randomUUID()}`;
  await tx`select pg_catalog.set_config('influx.request_id', ${request}, true)`;
  const outcome = await asInternal(tx, options.as ?? AGENT, () =>
    run<{ answer: Answer }>(tx, DOOR, [
      JSON.stringify(filters),
      "default",
      options.page ?? 1,
      options.campaign ?? null,
      options.prefill ?? null,
    ]),
  );
  const [line] = await tx<{ prefill_id: string | null; filters: Filters }[]>`
    select q.prefill_id::text as prefill_id, q.filters
      from search.search_queries q where q.request_id = ${request}`;
  return {
    outcome,
    answer:
      outcome.outcome === "rows"
        ? (outcome.rows[0]?.answer ?? { state: "none" })
        : { state: `error ${errorOf(outcome)}` },
    line,
  };
}

async function prefillCount(tx: Tx): Promise<number> {
  const [row] = await tx<{ count: number }[]>`
    select count(*)::int as count from search.campaign_prefills`;
  return row?.count ?? -1;
}

async function diff(
  tx: Tx,
  proposed: Filters,
  filters: Filters,
): Promise<{ retained: Filters; removed: Filters; added: Filters }> {
  const [row] = await tx<
    { diff: { retained: Filters; removed: Filters; added: Filters } }[]
  >`select search.prefill_diff(${JSON.stringify(proposed)}::text::jsonb,
                               ${JSON.stringify(filters)}::text::jsonb) as diff`;
  if (row === undefined) throw new Error("no diff");
  return row.diff;
}

/** The filters the full brief proposes (codes in code order, the topic and country of rank 1). */
const FULL_FILTERS = {
  F1: "pets",
  F3: ["instagram", "tiktok"],
  F4: ["micro", "mid"],
  F6: { country: COUNTRY },
  F8: ["en", "fr"],
  F11: ["instagram_reel", "tiktok_video"],
};

// the cases ---------------------------------------------------------------------------------------

describe("L3G-T5 the table, the link and the rights (T2; TM12.5; fiche invariants 2, 3)", () => {
  it("L3G-T5 T2: forces RLS on search.campaign_prefills with the restrictive member policy, gives no execution role any right, the owner its insertion and its reading; append-only for any influx_% role given a right (55000); the CHECK keeps codes of the base only", async () => {
    const outcome = await scenario(async (tx) => {
      const [table] = await tx<Row[]>`
        select c.relrowsecurity and c.relforcerowsecurity as forced,
               exists (select 1 from pg_catalog.pg_policy p
                        where p.polrelid = c.oid and not p.polpermissive
                          and p.polname = 'campaign_prefills_no_member_access'
                          and p.polroles @> array['influx_advertiser'::regrole::oid,
                                                  'influx_creator'::regrole::oid]
                          and pg_catalog.pg_get_expr(p.polqual, p.polrelid) = 'false') as member_policy,
               exists (select 1 from pg_catalog.pg_trigger t
                        where t.tgrelid = c.oid and t.tgname = 'campaign_prefills_immutable'
                          and t.tgfoid = 'search.guard_search_journal_write()'::regprocedure)
                 as guarded
          from pg_catalog.pg_class c where c.oid = 'search.campaign_prefills'::regclass`;
      const rights = await tx<{ line: string }[]>`
        select r.rolname as line from pg_catalog.pg_roles r
         where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                             'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                             'influx_privacy', 'anon', 'authenticated', 'service_role')
           and (has_table_privilege(r.oid, 'search.campaign_prefills',
                                    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_any_column_privilege(r.oid, 'search.campaign_prefills',
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
         where at.attrelid = 'search.campaign_prefills'::regclass
           and at.attnum > 0 and not at.attisdropped
         order by at.attname`;
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      await prefilled(tx, campaign);
      const shapes: string[] = [];
      for (const proposed of [
        { F17: ["audience_verified"] },
        { G2: ["published"] },
        { F12: ["500_1000"] },
        { F6: { country: COUNTRY, shareBands: ["ge_80"] } },
        { budget: 1000 },
        { F1: "pets" },
      ]) {
        const inserted = await run(
          tx,
          "insert into search.campaign_prefills (account_id, campaign_id, proposed) values ($1::uuid, $2::uuid, $3::text::jsonb)",
          [agentA, campaign, JSON.stringify(proposed)],
        );
        shapes.push(errorOf(inserted).slice(0, 5));
      }
      // a right given by mistake (rolled back): the guard of 0316 still refuses the change
      await tx.unsafe(
        `grant update (proposed), delete on search.campaign_prefills to ${OWNER}`,
      );
      await tx.unsafe(`create policy l3g_t5_all on search.campaign_prefills
                         for all to ${OWNER} using (true) with check (true)`);
      await tx.unsafe(`set local role ${OWNER}`);
      const changed = await run(
        tx,
        "update search.campaign_prefills set proposed = '{}'::jsonb where campaign_id = $1::uuid",
        [campaign],
      );
      const removed = await run(
        tx,
        "delete from search.campaign_prefills where campaign_id = $1::uuid",
        [campaign],
      );
      await tx.unsafe("reset role");
      return {
        table,
        rights: rights.map((row) => row.line),
        owner: owner.map((row) => row.name),
        shapes,
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
      "campaign_id SI",
      "created_at S",
      "id S",
      "proposed SI",
    ]);
    expect(outcome.shapes).toEqual([
      CHECK_VIOLATION,
      CHECK_VIOLATION,
      CHECK_VIOLATION,
      CHECK_VIOLATION,
      CHECK_VIOLATION,
      "ok",
    ]);
    expect(outcome.codes).toEqual([
      "55000 search_journal_immutable",
      "55000 search_journal_immutable",
    ]);
  });

  it("L3G-T5 TM12.5: a brand and a creator get 42501 on the prefill in base, an agent in aal1 and a role the account does not hold too; the diff is executed by nobody; nothing is written", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const before = await prefillCount(tx);
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
            () => run(tx, PREFILL, [campaign]),
          ),
        );
      const codes = [
        await member("influx_advertiser", brandA),
        await member("influx_creator", creatorA),
        errorOf(
          (await prefill(tx, campaign, { ...AGENT, aal: "aal1" })).outcome,
        ),
        errorOf(
          (await prefill(tx, campaign, { role: "admin", account: agentA }))
            .outcome,
        ),
      ];
      const diffs = [
        errorOf(
          await asInternal(tx, AGENT, () =>
            run(tx, "select search.prefill_diff('{}'::jsonb, '{}'::jsonb)"),
          ),
        ),
        errorOf(
          await asInternal(tx, ADMIN, () =>
            run(tx, "select search.prefill_diff('{}'::jsonb, '{}'::jsonb)"),
          ),
        ),
      ];
      const [catalogue] = await tx<Row[]>`
        select array(select r from unnest(array['influx_advertiser', 'influx_creator',
                                                 'influx_agent', 'influx_admin', 'influx_app']) r
                      where pg_catalog.has_function_privilege(r,
                              'search.prefill_diff(jsonb,jsonb)', 'EXECUTE')) as diff,
               array(select r from unnest(array['influx_advertiser', 'influx_creator',
                                                 'influx_agent', 'influx_admin', 'influx_app']) r
                      where pg_catalog.has_function_privilege(r,
                              'search.prefill_campaign_filters(uuid)', 'EXECUTE')
                      order by r) as prefill`;
      return {
        codes,
        diffs,
        catalogue,
        written: (await prefillCount(tx)) - before,
      };
    });
    expect(outcome.codes).toEqual([
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
    ]);
    expect(outcome.diffs).toEqual([
      INSUFFICIENT_PRIVILEGE,
      INSUFFICIENT_PRIVILEGE,
    ]);
    expect(outcome.catalogue).toEqual({
      diff: [],
      prefill: ["influx_admin", "influx_agent"],
    });
    expect(outcome.written).toBe(0);
  });

  it("L3G-T5 search_queries.prefill_id: NULL outside the identified view and without a campaign (23514), a prefill that exists only", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const proposed = await prefilled(tx, campaign);
      const insert = (
        role: string,
        view: string,
        withCampaign: string | null,
        prefillId: string,
      ) =>
        run(
          tx,
          `insert into search.search_queries
             (account_id, actor_role, view_mode, campaign_id, outcome, filters, sort_code,
              facet_config_version, result_count, page_reached, prefill_id)
           values ($1::uuid, $2::text, $3::text, $4::uuid, 'served', '{}'::jsonb, 'default',
                   (select max(version) from search.facet_config_versions), 0, 1, $5::uuid)`,
          [
            role === "advertiser" ? brand : agentA,
            role,
            view,
            withCampaign,
            prefillId,
          ],
        );
      const tried = [
        await insert(
          "advertiser",
          "advertiser_anonymous",
          campaign,
          proposed.prefillId,
        ),
        await insert("agent", "agent_identified", null, proposed.prefillId),
        await insert("agent", "agent_identified", campaign, randomUUID()),
        await insert("agent", "agent_identified", campaign, proposed.prefillId),
      ];
      return tried.map((inserted) => errorOf(inserted).slice(0, 5));
    });
    expect(outcome).toEqual([CHECK_VIOLATION, CHECK_VIOLATION, "23503", "ok"]);
  });
});

describe("L3G-T5 the facets drawn from the brief (10 RG9, RG73; fiche invariants 5, 12)", () => {
  it("L3G-T5 RG73: draws each facet from its field (F1 the topic of rank 1, F3 and F11 the deliverables, F4 the bands, F6 the country of rank 1, F8 the languages), in the form of p_filters, and the identified door serves them", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const matching = await newCreator(tx);
      await newCreator(tx, { topic: "food" });
      await newCreator(tx, { network: "youtube", format: "youtube_video" });
      const answer = await prefilled(tx, campaign);
      const searched = await identified(tx, answer.filters, {
        campaign,
        prefill: answer.prefillId,
      });
      return { answer, campaign, matching, searched };
    });
    expect(outcome.answer).toEqual({
      prefillId: expect.stringMatching(/^[0-9a-f-]{36}$/),
      campaign: { id: outcome.campaign, title: "L3G T5 compatible creators" },
      filters: FULL_FILTERS,
    });
    expect(outcome.searched.answer.state).toBe("results");
    expect(outcome.searched.answer.rows?.map((row) => row.accountId)).toEqual([
      outcome.matching,
    ]);
    expect(outcome.searched.line?.prefill_id).toBe(outcome.answer.prefillId);
  });

  it("L3G-T5 RG9: a partial brief yields its own facets only (the topic of the lowest slot), an empty brief {}; a facet closed in table is omitted, never required", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const topicsOnly = await newCampaign(tx, brand, {
        topicSlots: [
          [3, "travel"],
          [2, "food"],
        ],
      });
      const partial = await newCampaign(tx, brand, {
        deliverables: [["instagram", "instagram_story"]],
        languages: ["it"],
      });
      const empty = await newCampaign(tx, brand, {});
      const before = await prefillCount(tx);
      const answers = {
        topics: (await prefilled(tx, topicsOnly)).filters,
        partial: (await prefilled(tx, partial)).filters,
        empty: (await prefilled(tx, empty)).filters,
      };
      await tx`update search.facet_settings set is_open = false
                where facet_code in ('F8', 'F11', 'F4')`;
      const closed = (await prefilled(tx, await newCampaign(tx, brand)))
        .filters;
      return {
        answers,
        closed,
        written: (await prefillCount(tx)) - before,
      };
    });
    expect(outcome.answers).toEqual({
      topics: { F1: "food" },
      partial: { F3: ["instagram"], F8: ["it"], F11: ["instagram_story"] },
      empty: {},
    });
    expect(outcome.closed).toEqual({
      F1: "pets",
      F3: ["instagram", "tiktok"],
      F6: { country: COUNTRY },
    });
    expect(outcome.written).toBe(4);
  });

  it("L3G-T5 T14: a campaign in draft, rejected, erased or unknown is refused as one (P0002 campaign) and writes nothing; pending_review, published, paused and closed of any brand are drawn", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const refused: string[] = [];
      const before = await prefillCount(tx);
      for (const state of ["draft", "rejected", "erased"] as const) {
        refused.push(
          errorOf(
            (await prefill(tx, await newCampaign(tx, brand, FULL_BRIEF, state)))
              .outcome,
          ),
        );
      }
      refused.push(errorOf((await prefill(tx, randomUUID())).outcome));
      const written = (await prefillCount(tx)) - before;
      const admitted: string[] = [];
      for (const state of [
        "pending_review",
        "published",
        "paused",
        "closed",
      ] as const) {
        const answer = await prefilled(
          tx,
          await newCampaign(tx, await newBrand(tx), FULL_BRIEF, state),
        );
        admitted.push(answer.filters.F1 as string);
      }
      return { refused, written, admitted };
    });
    expect(outcome.refused).toEqual(
      Array.from({ length: 4 }, () => `${NO_DATA_FOUND} campaign`),
    );
    expect(outcome.written).toBe(0);
    expect(outcome.admitted).toEqual(["pets", "pets", "pets", "pets"]);
  });

  it("L3G-T5 D78: never an amount, a budget band, a currency, the usage rights, their territories, the exclusivity, the ages nor the gender, in the answer nor in the journal", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      await tx`update campaigns.campaigns
                  set total_budget_minor = 987654, audience_gender_code = (
                        select code from reference.audience_genders order by code limit 1)
                where id = ${campaign}`;
      const [brief] = await tx<Row[]>`
        select per_creator_budget_band_code as band, currency, usage_rights_code as rights,
               exclusivity_band as exclusivity, audience_gender_code as gender
          from campaigns.campaigns where id = ${campaign}`;
      const raw = await asInternal(tx, AGENT, () =>
        run<{ raw: string }>(tx, PREFILL_RAW, [campaign]),
      );
      const [journal] = await tx<{ proposed: string }[]>`
        select proposed::text from search.campaign_prefills
         where campaign_id = ${campaign} order by created_at desc limit 1`;
      return {
        brief,
        raw: raw.outcome === "rows" ? (raw.rows[0]?.raw ?? "") : errorOf(raw),
        journal: journal?.proposed ?? "",
      };
    });
    const forbidden = [
      "987654",
      String(outcome.brief?.band),
      String(outcome.brief?.currency),
      String(outcome.brief?.rights),
      "18_24",
      "3m",
      "worldwide",
      `"${String(outcome.brief?.gender)}"`,
      "F12",
      "F17",
      "budget",
      "amount",
      "exclusiv",
    ];
    for (const text of [outcome.raw, outcome.journal]) {
      for (const word of forbidden) expect(text).not.toContain(word);
    }
    expect(Object.keys(JSON.parse(outcome.journal) as Filters).sort()).toEqual([
      "F1",
      "F11",
      "F3",
      "F4",
      "F6",
      "F8",
    ]);
  });
});

describe("L3G-T5 the journal of the prefill (10 RG73, CA56; fiche invariants 4, 5, 8)", () => {
  it("L3G-T5 CA56: journals the proposed filters (the caller, the campaign, the filters answered), an admin its own line; neither outbox, audit nor matching.*", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const count = async () => {
        const [row] = await tx<Row[]>`
          select (select count(*)::int from leads.outbox_events) as outbox,
                 (select count(*)::int from audit.audit_events) as audit,
                 (select count(*)::int from matching.party_blocks) as blocks`;
        return row;
      };
      const before = await count();
      const byAgent = await prefilled(tx, campaign);
      const byAdmin = await prefilled(tx, campaign, ADMIN);
      const after = await count();
      const lines = await tx<Row[]>`
        select id::text as id, account_id::text as account, campaign_id::text as campaign,
               proposed, created_at > now() - interval '1 minute' as recent
          from search.campaign_prefills
         where campaign_id = ${campaign}
         order by account_id = ${agentA} desc`;
      return { byAgent, byAdmin, lines, before, after, campaign };
    });
    expect(outcome.lines).toEqual([
      {
        id: outcome.byAgent.prefillId,
        account: agentA,
        campaign: outcome.campaign,
        proposed: FULL_FILTERS,
        recent: true,
      },
      {
        id: outcome.byAdmin.prefillId,
        account: adminA,
        campaign: outcome.campaign,
        proposed: FULL_FILTERS,
        recent: true,
      },
    ]);
    expect(outcome.after).toEqual(outcome.before);
  });

  it("L3G-T5 CA56: a search from the prefill names it, a page_cap too; what was kept, removed and added is search.prefill_diff(proposed, filters)", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      await newCreator(tx);
      const answer = await prefilled(tx, campaign);
      const corrected = {
        F1: "pets",
        F3: ["instagram", "tiktok"],
        F4: ["micro", "macro"],
        F6: { country: COUNTRY, shareBands: ["ge_80"] },
        G2: ["published"],
      };
      const searched = await identified(tx, corrected, {
        campaign,
        prefill: answer.prefillId,
      });
      const capped = await identified(tx, corrected, {
        campaign,
        prefill: answer.prefillId,
        page: 11,
      });
      const [proposed] = await tx<{ proposed: Filters }[]>`
        select p.proposed from search.campaign_prefills p
         where p.id = ${searched.line?.prefill_id ?? null}::uuid`;
      return {
        prefillId: answer.prefillId,
        lines: [searched.line?.prefill_id, capped.line?.prefill_id],
        states: [searched.answer.state, capped.answer.state],
        diff: await diff(
          tx,
          proposed?.proposed ?? {},
          searched.line?.filters ?? {},
        ),
      };
    });
    expect(outcome.lines).toEqual([outcome.prefillId, outcome.prefillId]);
    expect(outcome.states).toEqual(["results", "page_cap"]);
    expect(outcome.diff).toEqual({
      retained: {
        F1: "pets",
        F3: ["instagram", "tiktok"],
        F4: ["micro"],
        F6: { country: COUNTRY },
      },
      removed: {
        F4: ["mid"],
        F8: ["en", "fr"],
        F11: ["instagram_reel", "tiktok_video"],
      },
      added: {
        F4: ["macro"],
        F6: { shareBands: ["ge_80"] },
        G2: ["published"],
      },
    });
  });

  it("L3G-T5 « Vider »: a search with the filters emptied keeps the link, everything removed; a changed topic is removed and added whole", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const answer = await prefilled(tx, campaign);
      const emptied = await identified(
        tx,
        {},
        {
          campaign,
          prefill: answer.prefillId,
        },
      );
      return {
        prefillId: answer.prefillId,
        line: emptied.line,
        state: emptied.answer.state,
        emptied: await diff(tx, answer.filters, emptied.line?.filters ?? {}),
        topic: await diff(tx, { F1: "pets" }, { F1: "food" }),
        refused: errorOf(
          await run(tx, "select search.prefill_diff('[]'::jsonb, '{}'::jsonb)"),
        ),
      };
    });
    expect(outcome.state).toBe("results");
    expect(outcome.line).toEqual({
      prefill_id: outcome.prefillId,
      filters: {},
    });
    expect(outcome.emptied).toEqual({
      retained: {},
      removed: FULL_FILTERS,
      added: {},
    });
    expect(outcome.topic).toEqual({
      retained: {},
      removed: { F1: "pets" },
      added: { F1: "food" },
    });
    expect(outcome.refused).toBe("22023 filters");
  });

  it("L3G-T5 the door refuses a prefill of another agent, of another campaign, older than 24 h or without a campaign (P0002 prefill), after the campaign, and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const other = await newCampaign(tx, brand);
      const mine = await prefilled(tx, campaign);
      const theirs = await prefilled(tx, campaign, {
        role: "agent",
        account: agentB,
      });
      const old = await prefilled(tx, campaign);
      await tx`update search.campaign_prefills
                  set created_at = now() - interval '24 hours 1 second'
                where id = ${old.prefillId}`;
      const tried = [
        await identified(tx, mine.filters, {
          campaign,
          prefill: theirs.prefillId,
        }),
        await identified(tx, mine.filters, {
          campaign: other,
          prefill: mine.prefillId,
        }),
        await identified(tx, mine.filters, {
          campaign,
          prefill: old.prefillId,
        }),
        await identified(tx, mine.filters, { prefill: mine.prefillId }),
        await identified(tx, mine.filters, {
          campaign: randomUUID(),
          prefill: mine.prefillId,
        }),
      ];
      const served = await identified(tx, mine.filters, {
        campaign,
        prefill: mine.prefillId,
        as: AGENT,
      });
      return {
        codes: tried.map((searched) => errorOf(searched.outcome)),
        lines: tried.filter((searched) => searched.line !== undefined).length,
        served: served.answer.state,
      };
    });
    expect(outcome.codes).toEqual([
      `${NO_DATA_FOUND} prefill`,
      `${NO_DATA_FOUND} prefill`,
      `${NO_DATA_FOUND} prefill`,
      `${NO_DATA_FOUND} prefill`,
      `${NO_DATA_FOUND} campaign`,
    ]);
    expect(outcome.lines).toBe(0);
    expect(outcome.served).toBe("results");
  });
});
