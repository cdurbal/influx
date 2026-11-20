// Fixtures of the tests of the brand's creator search route (L3E commit 08: creator-search-route,
// t14-creator-search-route, t15-creator-search-rate). Built on campaign-routes-kit (committed accounts,
// member sessions, the server over the local pools) and open-campaigns-kit (a brand whose profile is
// PUBLISHED, its contact and internal blocks holding markers). The creators are COMMITTED by the
// migration role: a storefront published and searchable, its main audience in SEARCH_COUNTRY (every
// search of these files filters F6 on it, so that a case sees the creators of these files alone), one
// listed Instagram line of 47 312 followers (CA3), its identity, its handle, its URL, its exact figures
// and audience and a refused sector holding markers: what no brand may ever read (RG48). The switch
// (D38) is opened for the time of a file and closed after it; the storefronts of these files leave
// the search when it ends (they stay published: the stack is disposable, RG25 reads none of them).
import { accountIdOf } from "@influx/test-kit/db";
import type { LightMyRequestResponse } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import type { ObjectStore } from "../src/platform/storage.ts";
import { WEB_SECRET } from "../tests/helpers.ts";
import type {
  CampaignRouteFixtures,
  Member,
  Server,
} from "./campaign-routes-kit.ts";
import type { Marker } from "./open-campaigns-kit.ts";

// The markers and the keys of an answer, read as the feed's tests read them.
export { keysOf, markersIn } from "./open-campaigns-kit.ts";

export const URL_SEARCH = "/v1/creator-search";

/** The main audience country of the creators of these files: every search filters F6 on it. */
export const SEARCH_COUNTRY = "GL";
export const HERE = { F6: { country: SEARCH_COUNTRY } } as const;

/** The exact number of followers of every line of these files (CA3): never in an answer. */
export const EXACT_FOLLOWERS = 47312;

/** The refused sector of the creators of these files (RG48): never in an answer. */
export const REFUSED_SECTOR = "gambling";

/** A creator searchable by a brand; `markers` are what no brand may ever read of him. */
export type SearchCreator = Member & {
  alias: string;
  lineId: string;
  markers: Marker[];
  /** The exact figures typed on his line and his main audience, served as bands only (CA3, CA4). */
  exact: { followers: number; posts: number; comments: number; share: number };
};

/**
 * `posts`, `comments` and `share` override the exact figures of the line (17 posts, 43 comments,
 * 83 % of the main audience): a distinctive posts or comments figure (six digits at least) joins the
 * markers, so that the sweeps of T1 search it BY VALUE (L2DT-5); `shareBand` follows `share`.
 */
export type CreatorSpec = {
  topic?: string;
  languages?: string[];
  posts?: number;
  comments?: number;
  share?: number;
  shareBand?: "ge_80" | "50_80" | "lt_50";
};

const creatorsOf = new Map<CampaignRouteFixtures, string[]>();

/** Opens the switch (D38) and sets aside the storefronts of earlier runs in SEARCH_COUNTRY. */
export async function openSearch(fx: CampaignRouteFixtures): Promise<void> {
  await fx.migration`
    update profiles.creator_public_profiles set is_searchable = false
     where main_audience_country = ${SEARCH_COUNTRY} and is_searchable`;
  await setSearchSetting(fx, "is_open_to_advertisers", true);
}

/** Closes the switch (its default) and takes the creators of the file out of the search. */
export async function closeSearch(fx: CampaignRouteFixtures): Promise<void> {
  await setSearchSetting(fx, "is_open_to_advertisers", false);
  const ids = creatorsOf.get(fx) ?? [];
  if (ids.length > 0) {
    await fx.migration`
      update profiles.creator_public_profiles set is_searchable = false
       where account_id = any(${ids}::uuid[])`;
  }
}

/**
 * The journal lines of the searches made FROM a campaign of `brands` (search_queries.campaign_id),
 * removed by the migration role so that campaign-routes-kit can remove the campaigns when the file
 * ends (the journal is append-only for the influx_% roles alone, 0316; the stack is disposable).
 */
export async function forgetCampaignSearches(
  fx: CampaignRouteFixtures,
  brands: readonly Member[],
): Promise<void> {
  const ids = brands.map((brand) => brand.accountId);
  await fx.migration.begin(async (tx) => {
    const queries = tx`
      select q.id from search.search_queries q
        join campaigns.campaigns c on c.id = q.campaign_id
       where c.advertiser_account_id = any(${ids}::uuid[])`;
    await tx`delete from search.impression_reasons where search_query_id in (${queries})`;
    await tx`delete from search.search_impressions where search_query_id in (${queries})`;
    await tx`delete from search.search_queries where id in (${queries})`;
  });
}

/** A setting of search.search_settings, written as the migration role (committed). */
export async function setSearchSetting(
  fx: CampaignRouteFixtures,
  key: string,
  value: unknown,
): Promise<void> {
  await fx.migration`
    update search.search_settings set value = ${JSON.stringify(value)}::text::jsonb
     where key = ${key}`;
}

/** Sets a setting for the time of `work`, then puts the previous value back. */
export async function withSearchSetting<T>(
  fx: CampaignRouteFixtures,
  key: string,
  value: unknown,
  work: () => Promise<T>,
): Promise<T> {
  const [before] = await fx.migration<{ value: string }[]>`
    select value::text as value from search.search_settings where key = ${key}`;
  if (before === undefined) {
    throw new Error(`no search setting ${key}`);
  }
  await setSearchSetting(fx, key, value);
  try {
    return await work();
  } finally {
    await fx.migration`
      update search.search_settings set value = ${before.value}::text::jsonb where key = ${key}`;
  }
}

/** A creator published and searchable in SEARCH_COUNTRY, his layer I holding markers. */
export async function searchableCreator(
  fx: CampaignRouteFixtures,
  spec: CreatorSpec = {},
): Promise<SearchCreator> {
  const member = await fx.newMember("creator");
  const tag = randomBytes(5).toString("hex");
  const handle = `l3e08_${tag}`;
  const url = `https://instagram.com/l3e08_${tag}`;
  const firstName = `Maelle${tag}`;
  const lastName = `Kervella${tag}`;
  const city = `Quimper${tag}`;
  const posts = spec.posts ?? 17;
  const comments = spec.comments ?? 43;
  const share = spec.share ?? 83;
  const [line] = await fx.migration<{ id: string }[]>`
    insert into profiles.creator_social_accounts
      (account_id, network_code, is_primary, handle, profile_url, followers_count,
       posts_last_30_days, avg_comments_per_post, figures_measured_at)
    values (${member.accountId}, 'instagram', true, ${handle}, ${url}, ${EXACT_FOLLOWERS}, ${posts}, ${comments},
            now())
    returning id::text`;
  const lineId = line?.id ?? "";
  await fx.migration`
    update profiles.creator_public_networks set listed_at = now()
     where social_account_id = ${lineId}`;
  await fx.migration`
    insert into profiles.creator_audience_countries
      (social_account_id, account_id, slot, country_code, share_percent)
    values (${lineId}, ${member.accountId}, 0, ${SEARCH_COUNTRY}, ${share})`;
  await fx.migration`
    insert into profiles.creator_identities (account_id, legal_first_name, legal_last_name, city)
    values (${member.accountId}, ${firstName}, ${lastName}, ${city})
    on conflict (account_id) do update
      set legal_first_name = excluded.legal_first_name,
          legal_last_name = excluded.legal_last_name, city = excluded.city`;
  for (const [index, language] of (spec.languages ?? ["fr"]).entries()) {
    await fx.migration`
      insert into profiles.creator_publication_languages (account_id, slot, language_code)
      values (${member.accountId}, ${index + 1}, ${language})`;
  }
  await fx.migration`
    insert into profiles.creator_formats (account_id, format_code)
    values (${member.accountId}, 'instagram_reel')`;
  await fx.migration`
    insert into profiles.creator_refused_sectors (account_id, sector_code)
    values (${member.accountId}, ${REFUSED_SECTOR})`;
  const [row] = await fx.migration<{ alias: string; public_ref: string }[]>`
    update profiles.creator_public_profiles
       set status = 'published', published_at = now() - interval '40 days',
           is_searchable = true, primary_topic_code = ${spec.topic ?? "pets"},
           main_audience_country = ${SEARCH_COUNTRY}, main_audience_share_band = ${spec.shareBand ?? "ge_80"}
     where account_id = ${member.accountId}
     returning alias, public_ref::text`;
  if (row === undefined) {
    throw new Error("no storefront");
  }
  creatorsOf.set(fx, [...(creatorsOf.get(fx) ?? []), member.accountId]);
  fx.watch(handle, url, firstName, lastName, city);
  return {
    ...member,
    alias: row.alias,
    lineId,
    exact: { followers: EXACT_FOLLOWERS, posts, comments, share },
    markers: [
      { name: "handle", value: handle },
      { name: "profile URL", value: url },
      { name: "first name", value: firstName },
      { name: "last name", value: lastName },
      { name: "city", value: city },
      { name: "exact followers", value: String(EXACT_FOLLOWERS) },
      { name: "sign-in e-mail", value: member.email },
      { name: "account identifier", value: member.accountId },
      { name: "line identifier", value: lineId },
      { name: "public_ref", value: row.public_ref },
      { name: "refused sector", value: REFUSED_SECTOR },
      ...(spec.posts === undefined
        ? []
        : [{ name: "exact posts", value: String(spec.posts) }]),
      ...(spec.comments === undefined
        ? []
        : [{ name: "exact comments", value: String(spec.comments) }]),
    ],
  };
}

export async function searchableCreators(
  fx: CampaignRouteFixtures,
  count: number,
  spec: CreatorSpec = {},
): Promise<SearchCreator[]> {
  const creators: SearchCreator[] = [];
  for (let index = 0; index < count; index += 1) {
    creators.push(await searchableCreator(fx, spec));
  }
  return creators;
}

/** POST /v1/creator-search as the web front relays it, from a client address. */
export function postSearch(
  server: Server,
  member: Member | null,
  body: unknown,
  address = "203.0.113.7",
): Promise<LightMyRequestResponse> {
  return server.inject({
    method: "POST",
    url: URL_SEARCH,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "x-real-ip": address,
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      ...(member === null
        ? {}
        : { cookie: `__Host-influx-session=${member.session}` }),
    },
    payload: JSON.stringify(body),
  });
}

// L3F commit 07: the profile a brand opens and its visuals (creator-profile-route,
// t14-creator-profile-route, t15-creator-profile-rate) -------------------------------------------------

export const URL_PROFILES = `${URL_SEARCH}/profiles`;

/** A GET of the brand's routes as the web front relays it, from a client address. */
export function getAsMember(
  server: Server,
  member: Member | null,
  url: string,
  address = "203.0.113.7",
): Promise<LightMyRequestResponse> {
  return server.inject({
    method: "GET",
    url,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "x-real-ip": address,
      "sec-fetch-site": "same-origin",
      ...(member === null
        ? {}
        : { cookie: `__Host-influx-session=${member.session}` }),
    },
  });
}

/** GET /v1/creator-search/profiles/:alias. */
export function getProfile(
  server: Server,
  member: Member | null,
  alias: string,
  address?: string,
): Promise<LightMyRequestResponse> {
  return getAsMember(server, member, `${URL_PROFILES}/${alias}`, address);
}

/** GET /v1/creator-search/profiles/:alias/visuals/:visualId. */
export function getVisual(
  server: Server,
  member: Member | null,
  alias: string,
  visualId: string,
  address?: string,
): Promise<LightMyRequestResponse> {
  return getAsMember(
    server,
    member,
    `${URL_PROFILES}/${alias}/visuals/${visualId}`,
    address,
  );
}

/** A stored visual of a creator: its id, the key of its object (the base's) and its bytes. */
export type StoredVisual = { id: string; objectKey: string; bytes: Buffer };

/** The agent who decides the visuals of these files (the data set's agent A). */
const VISUAL_AGENT = accountIdOf("agent", "a");

/**
 * A visual of `creator` in `state`, COMMITTED by the migration role, 640 x 480, its object written to
 * `store` under the key the base generated (`approved` and `rejected` are decided by the data set's
 * agent; a `rejected` one keeps no place, as the base wants). Never `pending`: a committed pending
 * visual would enter queue 3, which other files count.
 */
export async function storedVisual(
  fx: CampaignRouteFixtures,
  store: ObjectStore,
  creator: Member,
  state: "approved" | "rejected",
  order: number | null = null,
): Promise<StoredVisual> {
  const rejected = state === "rejected";
  const [row] = await fx.migration<{ id: string; object_key: string }[]>`
    insert into profiles.portfolio_items
      (account_id, state, received_bytes, byte_size, width, height, checksum, stored_at,
       sla_due_at, exif_stripped, decided_by_account_id, decided_at, display_order, caption,
       rejection_reason_code, retention_due_at)
    values (${creator.accountId}, ${state}::profiles.portfolio_item_state, 2048, 2048, 640, 480,
            ${randomUUID().replaceAll("-", "").repeat(2)}, now(), now() + interval '1 day', true,
            ${VISUAL_AGENT}, now(), ${rejected ? null : order}, ${`L3F 07 ${state} caption`},
            ${rejected ? "watermark" : null},
            case when ${rejected}::boolean then now() + interval '30 days' end)
    returning id::text, object_key`;
  if (row === undefined) {
    throw new Error("no visual");
  }
  const bytes = randomBytes(96);
  const written = await store.write(
    "portfolio",
    row.object_key,
    bytes,
    "image/webp",
  );
  if (!written.ok) {
    throw new Error("the visual's object was not written");
  }
  return { id: row.id, objectKey: row.object_key, bytes };
}

/** The openings of `brand` (search.profile_openings), oldest first; never served. */
export async function openingsOf(
  fx: CampaignRouteFixtures,
  brand: Member,
): Promise<
  {
    outcome: string;
    creator_account_id: string | null;
    from_search: boolean;
  }[]
> {
  return fx.migration`
    select o.outcome, o.creator_account_id::text as creator_account_id,
           o.search_query_id is not null as from_search
      from search.profile_openings o
     where o.account_id = ${brand.accountId}
     order by o.created_at, o.id`;
}

/** The journal lines of `brand` (search.search_queries), oldest first; the count is never served. */
export async function searchesOf(
  fx: CampaignRouteFixtures,
  brand: Member,
): Promise<
  {
    outcome: string;
    sort_code: string;
    page_reached: number;
    blocked: boolean;
    campaign_id: string | null;
    result_count: number;
  }[]
> {
  return fx.migration`
    select q.outcome, q.sort_code, q.page_reached, q.blocked_by_k_anonymity as blocked,
           q.campaign_id::text as campaign_id, q.result_count
      from search.search_queries q
     where q.account_id = ${brand.accountId}
     order by q.created_at, q.page_reached`;
}

// L3F commit 08: the brand's shortlists and its request for a selection (search-shortlists-route,
// selection-request-route) -----------------------------------------------------------------------------

export const URL_SHORTLISTS = "/v1/me/shortlists";
export const URL_SELECTION_REQUESTS = "/v1/me/selection-requests";

/** Any call of the brand's routes as the web front relays it (a body is JSON), from a client address. */
export function sendAsMember(
  server: Server,
  member: Member | null,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: unknown,
  address = "203.0.113.7",
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "x-real-ip": address,
      "sec-fetch-site": "same-origin",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(member === null
        ? {}
        : { cookie: `__Host-influx-session=${member.session}` }),
    },
    ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
  });
}

/** An alias of the alphabet of profiles.new_creator_alias() that no storefront holds. */
export async function unusedAlias(fx: CampaignRouteFixtures): Promise<string> {
  const alphabet = "23456789BCDFGHJKLMNPQRSTVWXZ";
  for (;;) {
    const alias = Array.from(
      { length: 6 },
      () => alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
    const [held] = await fx.migration<{ n: number }[]>`
      select count(*)::int as n from profiles.creator_public_profiles where alias = ${alias}`;
    if (held?.n === 0) {
      return alias;
    }
  }
}

/**
 * The shortlists and the requests of `brands` removed by the migration role, so that
 * campaign-routes-kit can remove their campaigns when the file ends (both point at a campaign; the stack
 * is disposable).
 */
export async function forgetSelections(
  fx: CampaignRouteFixtures,
  brands: readonly Member[],
): Promise<void> {
  const ids = brands.map((brand) => brand.accountId);
  await fx.migration.begin(async (tx) => {
    await tx`
      delete from search.shortlists where advertiser_account_id = any(${ids}::uuid[])`;
    await tx`
      delete from search.selection_requests where advertiser_account_id = any(${ids}::uuid[])`;
  });
}

/** What a brand's route may never write: the counts of the outbox, matching and messaging, and of the register. */
export async function sideEffectsOf(fx: CampaignRouteFixtures): Promise<{
  outbox: number;
  tables: Record<string, number>;
}> {
  const [outbox] = await fx.migration<{ n: number }[]>`
    select count(*)::int as n from leads.outbox_events`;
  const names = await fx.migration<{ name: string }[]>`
    select c.oid::regclass::text as name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname in ('matching', 'messaging') and c.relkind in ('r', 'p')
     order by 1`;
  const tables: Record<string, number> = {};
  for (const { name } of names) {
    const [counted] = await fx.migration.unsafe<{ n: number }[]>(
      `select count(*)::int as n from ${name}`,
    );
    tables[name] = counted?.n ?? -1;
  }
  return { outbox: outbox?.n ?? -1, tables };
}

/** The keys of RG48 (and of the internal order) that no answer holds, at any depth, not even null. */
export const RG48_KEYS = [
  "handle",
  "pseudonym",
  "profileUrl",
  "url",
  "firstName",
  "lastName",
  "legalFirstName",
  "legalLastName",
  "city",
  "email",
  "phone",
  "followersCount",
  "postsLast30Days",
  "avgCommentsPerPost",
  "avgReachPerPost",
  "engagementRate",
  "share",
  "audienceShares",
  "refusedSectors",
  "completeness",
  "status",
  "published",
  "socialAccountId",
  "accountId",
  "creatorAccountId",
  "creator_account_id",
  "advertiserAccountId",
  "publicRef",
  "lineKey",
  "rank",
  "score",
  "price",
  "rate",
  "currency",
  "net",
  "budget",
  "objectKey",
  "object_key",
  "signedUrl",
  "token",
];
