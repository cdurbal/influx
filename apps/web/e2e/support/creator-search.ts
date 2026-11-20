// What the journeys of the brand's anonymous creator search (docs/mvp/10 RG1, RG3, RG58, RG59, RG64; 17 §4.4; D38;
// jalons/l3f, commit 10, L3F-E1) start from, written straight into the local stack by the migration role (loopback
// only, @influx/test-kit/db) as apps/api's own kit writes them (db-tests/creator-search-kit.ts): creators published
// and searchable in ONE audience country of their own (every search of a journey filters F6 on it, so that a case
// sees its creators alone), the switch of the search (D38) held under an advisory lock (the closed case is
// exclusive, the open ones share), and a bucket of the account filled by lines of the journal. The states are
// prepared here, never by the screens. Nothing here is an amount, a rate or a price (D78).
import { connectAsMigrationRole } from "@influx/test-kit/db";
import { randomBytes, randomUUID } from "node:crypto";
import type { Page } from "@playwright/test";
import { seedMember } from "./account";
import { ownBrand } from "./campaign-cleanup";
import { approveVisualsAsAgent, depositVisuals } from "./creator-portfolio";
import { withSql, type Sql } from "./verification-cycle";

/** The audience country of the creators of the journeys of L3F-E1: no other file uses it (L3F annexe, base partagée). */
export const SEARCH_COUNTRY = "FO";

/** The audience country of the creators of the journeys of L3F-E2: no other file uses it (FO is E1's, GL the base tests'). */
export const PROFILE_COUNTRY = "AX";

/** The exact number of followers of every line of these journeys: never on a screen of a brand (CA3). */
export const EXACT_FOLLOWERS = 47312;

/** The key of the advisory lock that orders the files that hold the switch of the search (shared: open, exclusive: closed). */
const SWITCH_LOCK = 4_103_001;

/** A creator searchable by a brand, and what no brand may ever read of him. */
export type SearchableCreator = {
  accountId: string;
  alias: string;
  handle: string;
  profileUrl: string;
};

let seeded: string[] = [];

/** The brands of this file: their lists and requests go before their campaigns (a list may hold one). */
let brands: string[] = [];

/** Sets `is_open_to_advertisers` (D38), as the migration role writes a setting. */
async function setSwitch(sql: Sql, open: boolean): Promise<void> {
  await sql`
    update search.search_settings set value = ${JSON.stringify(open)}::text::jsonb
     where key = 'is_open_to_advertisers'`;
}

/**
 * Runs `work` with the switch of the search in `mode` and no other file able to change it meanwhile: a shared
 * advisory lock for `open` (files may run side by side), an exclusive one for `closed` (waits for the open ones).
 * When the last holder leaves, the switch goes back to its default, closed.
 */
export async function withSearchSwitch<Result>(
  mode: "open" | "closed",
  work: () => Promise<Result>,
): Promise<Result> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    if (mode === "open") {
      await sql`select pg_advisory_lock_shared(${SWITCH_LOCK})`;
    } else {
      await sql`select pg_advisory_lock(${SWITCH_LOCK})`;
    }
    await setSwitch(sql, mode === "open");
    try {
      return await work();
    } finally {
      if (mode === "open") {
        await sql`select pg_advisory_unlock_shared(${SWITCH_LOCK})`;
      } else {
        await sql`select pg_advisory_unlock(${SWITCH_LOCK})`;
      }
      // alone at last (no other session holds the lock, shared or not): closed again, the default
      const [alone] = await sql<{ locked: boolean }[]>`
        select pg_try_advisory_lock(${SWITCH_LOCK}) as locked`;
      if (alone?.locked === true) {
        await setSwitch(sql, false);
        await sql`select pg_advisory_unlock(${SWITCH_LOCK})`;
      }
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** One creator to seed: his main topic (the facet F1 a journey filters on) and, if any, his region of residence (RG15). */
export type CreatorSpec = { topic: string; region?: string };

/**
 * A creator made published and searchable in `country`, inside `tx`: one listed Instagram line of EXACT_FOLLOWERS
 * followers and its main audience, a language, a format, a handle and a link holding what no brand may read. The
 * storefront (`creator_public_profiles`) and the account exist already. Returns the handle and the link the seed
 * gave, which a brand must never read.
 */
// `tx` is a transaction of the same connection; it is only ever used as a tagged template here.
async function makeSearchable(
  tx: Sql,
  accountId: string,
  spec: CreatorSpec,
  country: string,
  prefix: string,
): Promise<{ alias: string; handle: string; profileUrl: string }> {
  const tag = randomBytes(5).toString("hex");
  const handle = `${prefix}_${tag}`;
  const profileUrl = `https://www.instagram.com/${prefix}_${tag}`;
  const [line] = await tx<{ id: string }[]>`
    insert into profiles.creator_social_accounts
      (account_id, network_code, is_primary, handle, profile_url, followers_count,
       posts_last_30_days, avg_comments_per_post, figures_measured_at)
    values (${accountId}, 'instagram', true, ${handle}, ${profileUrl}, ${EXACT_FOLLOWERS}, 17, 43,
            now())
    returning id::text`;
  const lineId = line?.id ?? "";
  await tx`
    update profiles.creator_public_networks set listed_at = now()
     where social_account_id = ${lineId}`;
  await tx`
    insert into profiles.creator_audience_countries
      (social_account_id, account_id, slot, country_code, share_percent)
    values (${lineId}, ${accountId}, 0, ${country}, 83)`;
  await tx`
    insert into profiles.creator_publication_languages (account_id, slot, language_code)
    values (${accountId}, 1, 'fr')`;
  await tx`
    insert into profiles.creator_formats (account_id, format_code)
    values (${accountId}, 'instagram_reel')`;
  const [row] = await tx<{ alias: string }[]>`
    update profiles.creator_public_profiles
       set status = 'published', published_at = now() - interval '40 days',
           is_searchable = true, primary_topic_code = ${spec.topic},
           residence_region_code = ${spec.region ?? null},
           main_audience_country = ${country}, main_audience_share_band = 'ge_80'
     where account_id = ${accountId}
     returning alias`;
  return { alias: row?.alias ?? "", handle, profileUrl };
}

/**
 * Creators published and searchable in `country` (SEARCH_COUNTRY by default), in one transaction: an account, its
 * storefront and what `makeSearchable` gives it. The storefronts of earlier runs in the same country leave the
 * search first, so that a case counts its own creators only.
 */
export async function seedSearchableCreators(
  specs: readonly CreatorSpec[],
  country: string = SEARCH_COUNTRY,
): Promise<SearchableCreator[]> {
  return withSql(async (sql) => {
    await sql`
      update profiles.creator_public_profiles set is_searchable = false
       where main_audience_country = ${country} and is_searchable`;
    const creators: SearchableCreator[] = [];
    await sql.begin(async (tx) => {
      for (const spec of specs) {
        const accountId = randomUUID();
        const tag = randomBytes(5).toString("hex");
        await tx`
          insert into identity.accounts
            (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
             is_adult_attested, adult_attested_at, declared_status)
          values (${accountId}, ${randomUUID()}, ${`e2e-l3f10-${tag}@example.test`}, now(), 'FR',
                  'fr', true, now(), 'individual'::identity.declared_status)`;
        await tx`
          insert into identity.account_roles (account_id, role)
          values (${accountId}, 'creator'::identity.account_role)`;
        await tx`
          insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
          values (${accountId}, profiles.new_creator_alias(), 'FR')`;
        const made = await makeSearchable(
          tx as unknown as Sql,
          accountId,
          spec,
          country,
          "l3f10",
        );
        creators.push({ accountId, ...made });
      }
    });
    seeded = [...seeded, ...creators.map((creator) => creator.accountId)];
    return creators;
  });
}

/**
 * One creator with real portfolio visuals, signed in on this page while it is made (the journey signs a brand in
 * afterwards): the account and its storefront as the sign-up writes them, `visuals` images deposited through the
 * API's own door (their objects are stored, so that a brand's profile reads them back), approved as an agent's
 * decision leaves them (`agentId`), then published and searchable in `country`. The three visuals of a profile
 * (RG50) are drawn from objects, never from rows.
 */
export async function seedCreatorWithVisuals(
  page: Page,
  options: {
    spec: CreatorSpec;
    country: string;
    visuals: number;
    agentId: string;
    caption: string;
  },
): Promise<SearchableCreator> {
  const member = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await depositVisuals(page, options.visuals);
  await approveVisualsAsAgent(
    member.accountId,
    options.agentId,
    options.caption,
  );
  const made = await withSql((sql) =>
    sql.begin((tx) =>
      makeSearchable(
        tx as unknown as Sql,
        member.accountId,
        options.spec,
        options.country,
        "l3f11",
      ),
    ),
  );
  seeded = [...seeded, member.accountId];
  return { accountId: member.accountId, ...made };
}

/** The creators of the file out of the search when it ends (they stay published: the stack is disposable). */
export async function retireSearchCreators(): Promise<void> {
  if (seeded.length === 0) {
    return;
  }
  const ids = seeded;
  seeded = [];
  await withSql(async (sql) => {
    await sql`
      update profiles.creator_public_profiles set is_searchable = false
       where account_id = any(${ids}::uuid[])`;
  });
}

/**
 * A brand with a published profile, signed in on this page (the decision of its queue is L2C's): the account is
 * written by the base and its session is the browser's.
 */
export async function signedInBrand(
  page: Page,
  language: "fr" | "en",
): Promise<{ accountId: string }> {
  const member = await seedMember(page, {
    role: "advertiser",
    language,
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  ownBrand(member.accountId);
  brands = [...brands, member.accountId];
  await withSql(async (sql) => {
    await sql`
      update profiles.advertiser_profiles
         set status = 'published', submitted_at = now(), first_published_at = now()
       where account_id = ${member.accountId}`;
  });
  return { accountId: member.accountId };
}

/**
 * The bucket of the account full: as many searches served in the last hour as the table allows per hour (RG64),
 * written as lines of the journal, so that the next page of the brand is refused by the base itself.
 */
export async function fillSearchBucket(accountId: string): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      insert into search.search_queries
        (account_id, actor_role, view_mode, outcome, filters, sort_code, facet_config_version,
         result_count, page_reached)
      select ${accountId}, 'advertiser', 'advertiser_anonymous', 'served', '{}'::jsonb, 'default',
             (select max(version) from search.facet_config_versions), 5, 1
        from generate_series(1, (select (value->>'perHour')::int
                                   from search.search_settings where key = 'rate_limits'))`;
  });
}

/**
 * After the journeys of L3F-E2: the lists and the requests of the brands of the file, before their campaigns (a list
 * or a request may name one, `removeOwnCampaigns`). A list takes its creators with it (cascade); the register
 * (`audit.*`) and the journal of the search stay untouched.
 */
export async function removeOwnSelections(): Promise<void> {
  if (brands.length === 0) {
    return;
  }
  const ids = brands;
  brands = [];
  await withSql(async (sql) => {
    await sql`
      delete from search.selection_requests
       where advertiser_account_id = any(${ids}::uuid[])`;
    await sql`
      delete from search.shortlists
       where advertiser_account_id = any(${ids}::uuid[])`;
  });
}

/** A list of a brand as the base holds it, with its creators' aliases and notes. */
export type StoredList = {
  name: string;
  campaignId: string | null;
  aliases: string[];
  notes: (string | null)[];
};

/** The lists of a brand, newest first: what the screens did, as the base kept it. */
export async function listsOf(accountId: string): Promise<StoredList[]> {
  return withSql(async (sql) => {
    const rows = await sql<
      {
        name: string;
        campaignId: string | null;
        aliases: string[];
        notes: (string | null)[];
      }[]
    >`
      select l.name, l.campaign_id::text as "campaignId",
             coalesce(array_agg(p.alias order by i.added_at, p.alias)
                      filter (where p.alias is not null), '{}') as aliases,
             coalesce(jsonb_agg(i.note order by i.added_at, p.alias)
                      filter (where p.alias is not null), '[]'::jsonb) as notes
        from search.shortlists l
        left join search.shortlist_items i on i.shortlist_id = l.id
        left join profiles.creator_public_profiles p on p.account_id = i.creator_account_id
       where l.advertiser_account_id = ${accountId}
       group by l.id
       order by l.created_at desc, l.id`;
    return rows.map((row) => ({ ...row }));
  });
}

/** The requests for a selection of a brand as the base holds them, newest first. */
export async function requestsOf(accountId: string): Promise<
  {
    campaignId: string | null;
    filters: unknown;
    language: string;
    message: string | null;
    state: string;
    dueAt: Date;
  }[]
> {
  return withSql(
    (sql) => sql`
      select campaign_id::text as "campaignId", filters, language, message, state::text as state,
             sla_due_at as "dueAt"
        from search.selection_requests
       where advertiser_account_id = ${accountId}
       order by created_at desc, id`,
  );
}
