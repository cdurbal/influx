// SQL of the creator profile of the member's own account (docs/mvp/07 RG16, RG23, RG33 to RG39, RG64
// to RG76; 0216, 0217, 0218; jalons/l2d, commit 08). Every statement runs in the member's
// transaction, as influx_creator: the account is the one of the transaction context
// (`influx.current_account_id()`), never a parameter, and the row-level policies of 0216 and 0217
// bind every read and write to it.
// - The storefront (layer A) holds blocks 1, 2 and 5; its ten entered columns are the only ones a
//   creator may update (the alias, the status, the derived bands and the date of the availability
//   are the system's, guarded by the database).
// - The lists are replaced as a whole: delete, then insert with a `slot` where the list is ordered.
// - The identifying fields (layer N) live in creator_identities, which also holds the stored score
//   (EC-02-2): never on the storefront, never served to a brand.
// - The network lines and their exact audience are read here to compute the completeness, and
//   written by the routes of commit 09 (the second half of this file). A creator reads and writes
//   them as their owner (layer I, 0217); the bands, the date of the figures and their history are
//   the database's (0218), never written from here.
// An account promoted to creator after the sign-up has no storefront (`grant_role()` provisions none):
// the absence of a row reads as an empty draft, and nothing can be written (the member holds no
// INSERT on the storefront, 0216 §5.3).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

/** The lists of the profile, by the name the contract gives them; the code column is fixed here. */
export const CREATOR_PROFILE_LISTS = {
  secondaryTopics: {
    table: "creator_topics",
    column: "topic_code",
    slotted: true,
  },
  tones: { table: "creator_tones", column: "tone_code", slotted: true },
  publicationLanguages: {
    table: "creator_publication_languages",
    column: "language_code",
    slotted: true,
  },
  formats: {
    table: "creator_formats",
    column: "format_code",
    slotted: false,
  },
  refusedSectors: {
    table: "creator_refused_sectors",
    column: "sector_code",
    slotted: false,
  },
} as const;

export type CreatorProfileListName = keyof typeof CREATOR_PROFILE_LISTS;

/** A share of the exact audience as the creator typed it (layer I): a code and a whole percentage. */
export type StoredAudienceShare = { code: string; share: number | null };

/** A network line as stored, read for the completeness (commit 09 reads and writes the whole line). */
export type StoredCreatorLine = {
  networkCode: string;
  isPrimary: boolean;
  handle: string | null;
  profileUrl: string | null;
  followersCount: number | null;
  postsLast30Days: number | null;
  avgCommentsPerPost: number | null;
  avgReachPerPost: number | null;
  figuresMeasuredAt: string | null;
  audienceCountries: (StoredAudienceShare & { slot: number })[];
  audienceAges: StoredAudienceShare[];
  audienceGenders: StoredAudienceShare[];
};

/** The profile as stored: what the account and the `profiles` tables hold, nothing computed. */
export type StoredCreatorProfile = {
  /** False for an account whose role was granted after the sign-up: an empty draft, unwritable. */
  hasStorefront: boolean;
  status: string;
  alias: string | null;
  residenceCountry: string;
  preferredLanguage: string;
  headline: string | null;
  bio: string | null;
  collaborationExperience: string | null;
  primaryTopic: string | null;
  residenceRegion: string | null;
  travelScope: string | null;
  deliveryLead: string | null;
  maxExclusivity: string | null;
  acceptsNonMonetary: boolean;
  availability: string | null;
  availabilityDeclaredAt: string | null;
  lists: {
    secondaryTopics: string[];
    tones: string[];
    publicationLanguages: string[];
    refusedSectors: string[];
    /** The format and its network (null: UGC); the network ties the offer line (EC-L2D-4). */
    formats: { code: string; networkCode: string | null }[];
    usageRights: { code: string; inclusion: "included" | "optional" }[];
  };
  identity: {
    legalFirstName: string | null;
    legalLastName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    addressLine: string | null;
    postalCode: string | null;
    city: string | null;
    addressCountry: string | null;
  };
  lines: StoredCreatorLine[];
  /**
   * A request for « Compte vérifié » or « Audience vérifiée » FILED on one of his lines: submitted,
   * pending or decided, never withdrawn (07 RG87, RG88; counted as filed, never as obtained).
   */
  badgeRequested: boolean;
};

/** Codes still active in each reference list the form draws from. */
export type ActiveCreatorReferences = {
  topics: string[];
  tones: string[];
  languages: string[];
  regions: string[];
  formats: { code: string; networkCode: string | null }[];
  usageRights: string[];
  sectors: string[];
};

/** The type each value is cast to (a parameter has none of its own); fragments, never raw text. */
const CAST = {
  text: sql`text`,
  boolean: sql`boolean`,
  char2: sql`char(2)`,
  bigint: sql`bigint`,
  integer: sql`integer`,
} as const;

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** A Postgres text-array literal, every element quoted (drizzle expands a JS array into a list). */
function textArray(values: readonly string[]): string {
  return `{${values
    .map((value) => `"${value.replace(/["\\]/g, "\\$&")}"`)
    .join(",")}}`;
}

type StoredRow = {
  has_storefront: boolean;
  status: string | null;
  alias: string | null;
  residence_country: string;
  preferred_language: string;
  headline: string | null;
  bio: string | null;
  collaboration_experience_band: string | null;
  primary_topic_code: string | null;
  residence_region_code: string | null;
  travel_scope: string | null;
  delivery_lead_band: string | null;
  max_exclusivity_band: string | null;
  accepts_non_monetary: boolean | null;
  availability_band: string | null;
  availability_declared_at: string | null;
  legal_first_name: string | null;
  legal_last_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address_line: string | null;
  postal_code: string | null;
  city: string | null;
  identity_country: string | null;
  badge_requested: boolean;
  secondary_topics: string[];
  tones: string[];
  publication_languages: string[];
  refused_sectors: string[];
  formats: { code: string; networkCode: string | null }[];
  usage_rights: { code: string; inclusion: "included" | "optional" }[];
  lines: {
    networkCode: string;
    isPrimary: boolean;
    handle: string | null;
    profileUrl: string | null;
    followers: number | null;
    posts: number | null;
    comments: number | null;
    reach: number | null;
    measuredAt: string | null;
    countries: { slot: number; code: string; share: number | null }[];
    ages: StoredAudienceShare[];
    genders: StoredAudienceShare[];
  }[];
};

/** An aggregated slotted list of one table, in slot order, as JSON (the pool fetches no array type). */
function slottedList(
  name: Extract<
    CreatorProfileListName,
    "secondaryTopics" | "tones" | "publicationLanguages"
  >,
) {
  const list = CREATOR_PROFILE_LISTS[name];
  const table = sql`${sql.identifier("profiles")}.${sql.identifier(list.table)}`;
  const column = sql.identifier(list.column);
  return sql`coalesce((select jsonb_agg(l.${column}::text order by l.slot)
                         from ${table} l where l.account_id = a.id), '[]'::jsonb)`;
}

/**
 * The state of the session's own creator profile, or null when the session's account is not there.
 * A creator without a storefront reads as an empty draft (`hasStorefront` false).
 */
export async function readOwnCreatorProfile(
  tx: Transaction,
): Promise<StoredCreatorProfile | null> {
  const rows = await tx.execute<StoredRow>(sql`
    select p.account_id is not null as has_storefront,
           p.status::text as status, p.alias,
           coalesce(p.residence_country_code, a.country_code)::text as residence_country,
           a.preferred_language::text as preferred_language,
           p.headline, p.bio, p.collaboration_experience_band, p.primary_topic_code,
           p.residence_region_code, p.travel_scope, p.delivery_lead_band, p.max_exclusivity_band,
           p.accepts_non_monetary, p.availability_band,
           to_char(p.availability_declared_at at time zone 'UTC', ${ISO_UTC}) as availability_declared_at,
           i.legal_first_name, i.legal_last_name, i.contact_email, i.contact_phone, i.address_line,
           i.postal_code, i.city, i.country_code::text as identity_country,
           exists (select 1 from verification.verification_requests v
                    where v.account_id = a.id and v.population = 'creator'
                      and v.submitted_at is not null and v.status <> 'cancelled')
             as badge_requested,
           ${slottedList("secondaryTopics")} as secondary_topics,
           ${slottedList("tones")} as tones,
           ${slottedList("publicationLanguages")} as publication_languages,
           coalesce((select jsonb_agg(s.sector_code::text order by s.sector_code)
                       from profiles.creator_refused_sectors s where s.account_id = a.id),
                    '[]'::jsonb) as refused_sectors,
           coalesce((select jsonb_agg(jsonb_build_object('code', f.format_code::text,
                                                         'networkCode', r.network_code::text)
                                      order by f.format_code)
                       from profiles.creator_formats f
                       join reference.formats r on r.code = f.format_code
                      where f.account_id = a.id), '[]'::jsonb) as formats,
           coalesce((select jsonb_agg(jsonb_build_object('code', u.usage_right_code::text,
                                                         'inclusion', u.inclusion)
                                      order by u.usage_right_code)
                       from profiles.creator_usage_rights u where u.account_id = a.id),
                    '[]'::jsonb) as usage_rights,
           coalesce((select jsonb_agg(jsonb_build_object(
                        'networkCode', n.network_code::text,
                        'isPrimary', n.is_primary,
                        'handle', n.handle,
                        'profileUrl', n.profile_url,
                        'followers', n.followers_count,
                        'posts', n.posts_last_30_days,
                        'comments', n.avg_comments_per_post,
                        'reach', n.avg_reach_per_post,
                        'measuredAt', to_char(n.figures_measured_at at time zone 'UTC', ${ISO_UTC}),
                        'countries', coalesce((select jsonb_agg(jsonb_build_object(
                                        'slot', c.slot, 'code', c.country_code::text,
                                        'share', c.share_percent) order by c.slot)
                                      from profiles.creator_audience_countries c
                                     where c.social_account_id = n.id), '[]'::jsonb),
                        'ages', coalesce((select jsonb_agg(jsonb_build_object(
                                        'code', g.age_band_code::text, 'share', g.share_percent)
                                        order by g.age_band_code)
                                      from profiles.creator_audience_ages g
                                     where g.social_account_id = n.id), '[]'::jsonb),
                        'genders', coalesce((select jsonb_agg(jsonb_build_object(
                                        'code', x.gender_code::text, 'share', x.share_percent)
                                        order by x.gender_code)
                                      from profiles.creator_audience_genders x
                                     where x.social_account_id = n.id), '[]'::jsonb))
                      order by n.created_at, n.id)
                       from profiles.creator_social_accounts n where n.account_id = a.id),
                    '[]'::jsonb) as lines
      from identity.accounts a
      left join profiles.creator_public_profiles p on p.account_id = a.id
      left join profiles.creator_identities i on i.account_id = a.id
     where a.id = (select influx.current_account_id())`);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    hasStorefront: row.has_storefront === true,
    status: row.status ?? "draft",
    alias: row.alias,
    residenceCountry: row.residence_country,
    preferredLanguage: row.preferred_language,
    headline: row.headline,
    bio: row.bio,
    collaborationExperience: row.collaboration_experience_band,
    primaryTopic: row.primary_topic_code,
    residenceRegion: row.residence_region_code,
    travelScope: row.travel_scope,
    deliveryLead: row.delivery_lead_band,
    maxExclusivity: row.max_exclusivity_band,
    acceptsNonMonetary: row.accepts_non_monetary === true,
    availability: row.availability_band,
    availabilityDeclaredAt: row.availability_declared_at,
    lists: {
      secondaryTopics: row.secondary_topics,
      tones: row.tones,
      publicationLanguages: row.publication_languages,
      refusedSectors: row.refused_sectors,
      formats: row.formats,
      usageRights: row.usage_rights,
    },
    identity: {
      legalFirstName: row.legal_first_name,
      legalLastName: row.legal_last_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      addressLine: row.address_line,
      postalCode: row.postal_code,
      city: row.city,
      addressCountry: row.identity_country,
    },
    lines: row.lines.map((line): StoredCreatorLine => ({
      networkCode: line.networkCode,
      isPrimary: line.isPrimary,
      handle: line.handle,
      profileUrl: line.profileUrl,
      followersCount: line.followers,
      postsLast30Days: line.posts,
      avgCommentsPerPost: line.comments,
      avgReachPerPost: line.reach,
      figuresMeasuredAt: line.measuredAt,
      audienceCountries: line.countries.map((row) => ({
        slot: row.slot,
        code: row.code,
        share: row.share,
      })),
      audienceAges: line.ages,
      audienceGenders: line.genders,
    })),
    badgeRequested: row.badge_requested === true,
  };
}

/**
 * Locks the storefront row for the rest of the transaction and returns its status: two saves at the
 * same moment (autosave from two tabs) are serialised, the second reads what the first committed.
 * Null: the account holds no storefront.
 */
export async function lockOwnCreatorStorefront(
  tx: Transaction,
): Promise<string | null> {
  const rows = await tx.execute<{ status: string }>(
    sql`select status::text as status
          from profiles.creator_public_profiles
         where account_id = (select influx.current_account_id())
           for update`,
  );
  return rows[0]?.status ?? null;
}

/** The codes still active in the reference lists of the form (a retired code is never offered). */
export async function readActiveCreatorReferences(
  tx: Transaction,
  residenceCountry: string,
): Promise<ActiveCreatorReferences> {
  const rows = await tx.execute<{
    topics: string[];
    tones: string[];
    languages: string[];
    regions: string[];
    formats: { code: string; networkCode: string | null }[];
    usage_rights: string[];
    sectors: string[];
  }>(sql`
    select (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.topics
             where retired_at is null) as topics,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.editorial_tones
             where retired_at is null) as tones,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.languages
             where is_active) as languages,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.regions
             where retired_at is null and country_code = ${residenceCountry}::char(2)) as regions,
           (select coalesce(jsonb_agg(jsonb_build_object('code', code::text,
                                                         'networkCode', network_code::text)
                                      order by code), '[]'::jsonb)
              from reference.formats where retired_at is null) as formats,
           (select coalesce(jsonb_agg(code::text order by sort_order), '[]'::jsonb) from reference.usage_rights
             where retired_at is null and code <> 'none') as usage_rights,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.sectors
             where retired_at is null) as sectors`);
  const row = rows[0];
  return {
    topics: row?.topics ?? [],
    tones: row?.tones ?? [],
    languages: row?.languages ?? [],
    regions: row?.regions ?? [],
    formats: row?.formats ?? [],
    usageRights: row?.usage_rights ?? [],
    sectors: row?.sectors ?? [],
  };
}

/** The columns of the storefront a save may set; an absent key is left as it is. */
export type CreatorStorefrontColumns = {
  headline?: string | null | undefined;
  bio?: string | null | undefined;
  collaborationExperience?: string | null | undefined;
  primaryTopic?: string | null | undefined;
  residenceRegion?: string | null | undefined;
  travelScope?: string | null | undefined;
  deliveryLead?: string | null | undefined;
  maxExclusivity?: string | null | undefined;
  acceptsNonMonetary?: boolean | undefined;
  availability?: string | null | undefined;
};

/** Sets the given columns of the storefront (0216 §5.1: the ten column rights of influx_creator). */
export async function updateCreatorStorefrontColumns(
  tx: Transaction,
  columns: CreatorStorefrontColumns,
): Promise<void> {
  const assignments = [
    ["headline", columns.headline, "text"],
    ["bio", columns.bio, "text"],
    ["collaboration_experience_band", columns.collaborationExperience, "text"],
    ["primary_topic_code", columns.primaryTopic, "text"],
    ["residence_region_code", columns.residenceRegion, "text"],
    ["travel_scope", columns.travelScope, "text"],
    ["delivery_lead_band", columns.deliveryLead, "text"],
    ["max_exclusivity_band", columns.maxExclusivity, "text"],
    ["accepts_non_monetary", columns.acceptsNonMonetary, "boolean"],
    ["availability_band", columns.availability, "text"],
  ] as const;
  const set = assignments
    .filter(([, value]) => value !== undefined)
    .map(
      ([column, value, type]) =>
        sql`${sql.identifier(column)} = ${value}::${CAST[type]}`,
    );
  if (set.length === 0) {
    return;
  }
  await tx.execute(
    sql`update profiles.creator_public_profiles
           set ${sql.join(set, sql`, `)}
         where account_id = (select influx.current_account_id())`,
  );
}

/** Replaces a list as a whole: deletion, then insertion in the order given (slot 1 to n if ordered). */
export async function replaceCreatorProfileList(
  tx: Transaction,
  name: CreatorProfileListName,
  codes: readonly string[],
): Promise<void> {
  const list = CREATOR_PROFILE_LISTS[name];
  const table = sql`${sql.identifier("profiles")}.${sql.identifier(list.table)}`;
  const column = sql.identifier(list.column);
  await tx.execute(
    sql`delete from ${table} where account_id = (select influx.current_account_id())`,
  );
  if (codes.length === 0) {
    return;
  }
  const literal = textArray(codes);
  if (list.slotted) {
    await tx.execute(
      sql`insert into ${table} (account_id, slot, ${column})
          select (select influx.current_account_id()), v.ord::smallint, v.code
            from unnest(${literal}::text[]) with ordinality as v (code, ord)`,
    );
  } else {
    await tx.execute(
      sql`insert into ${table} (account_id, ${column})
          select (select influx.current_account_id()), v.code
            from unnest(${literal}::text[]) as v (code)`,
    );
  }
}

/** Replaces the usage rights as a whole (07 RG73): the code and how it is offered, once per code. */
export async function replaceCreatorUsageRights(
  tx: Transaction,
  rights: readonly { code: string; inclusion: "included" | "optional" }[],
): Promise<void> {
  await tx.execute(
    sql`delete from profiles.creator_usage_rights
         where account_id = (select influx.current_account_id())`,
  );
  if (rights.length === 0) {
    return;
  }
  const codes = textArray(rights.map((right) => right.code));
  const inclusions = textArray(rights.map((right) => right.inclusion));
  await tx.execute(
    sql`insert into profiles.creator_usage_rights (account_id, usage_right_code, inclusion)
        select (select influx.current_account_id()), v.code, v.inclusion
          from unnest(${codes}::text[], ${inclusions}::text[]) as v (code, inclusion)`,
  );
}

/** The identifying fields to write (layer N); `null` empties one, an absent key is left alone. */
export type CreatorIdentityChanges = {
  legalFirstName?: string | null | undefined;
  legalLastName?: string | null | undefined;
  contactEmail?: string | null | undefined;
  contactPhone?: string | null | undefined;
  addressLine?: string | null | undefined;
  postalCode?: string | null | undefined;
  city?: string | null | undefined;
  addressCountry?: string | null | undefined;
};

/** Updates the identity row of the storefront (0217 §8.1: nine column rights, no insert). */
export async function updateCreatorIdentity(
  tx: Transaction,
  changes: CreatorIdentityChanges,
): Promise<void> {
  const assignments = [
    ["legal_first_name", changes.legalFirstName, "text"],
    ["legal_last_name", changes.legalLastName, "text"],
    ["contact_email", changes.contactEmail, "text"],
    ["contact_phone", changes.contactPhone, "text"],
    ["address_line", changes.addressLine, "text"],
    ["postal_code", changes.postalCode, "text"],
    ["city", changes.city, "text"],
    ["country_code", changes.addressCountry, "char2"],
  ] as const;
  const set = assignments
    .filter(([, value]) => value !== undefined)
    .map(
      ([column, value, type]) =>
        sql`${sql.identifier(column)} = ${value}::${CAST[type]}`,
    );
  if (set.length === 0) {
    return;
  }
  await tx.execute(
    sql`update profiles.creator_identities
           set ${sql.join(set, sql`, `)}
         where account_id = (select influx.current_account_id())`,
  );
}

/** Stores the score as packages/domain computed it (07 RG86); the base never recomputes it. */
export async function storeCreatorScore(
  tx: Transaction,
  percent: number,
): Promise<void> {
  await tx.execute(
    sql`update profiles.creator_identities
           set completeness_percent = ${percent}::smallint
         where account_id = (select influx.current_account_id())
           and completeness_percent is distinct from ${percent}::smallint`,
  );
}

// --- Network lines, figures and audience (07 RG41 to RG61; 0217, 0218; commit 09) -----------------

/** The bands the database derived for the main line (0218); codes of the reference lists. */
export type StoredNetworkBands = {
  audienceBand: string | null;
  reachBand: string | null;
  publicationFrequency: string | null;
  commentBand: string | null;
};

/** A network line with everything its owner reads (layer I) and its exact audience. */
export type StoredNetworkLine = {
  id: string;
  networkCode: string;
  isPrimary: boolean;
  handle: string | null;
  pseudonym: string | null;
  profileUrl: string | null;
  followersCount: number | null;
  postsLast30Days: number | null;
  avgCommentsPerPost: number | null;
  avgReachPerPost: number | null;
  engagementRateBp: number | null;
  figuresSource: string;
  figuresMeasuredAt: string | null;
  /** Slot 0 is the main country, whose share may wait; slots 1 to 4 weigh 10 % or more. */
  countries: { slot: number; code: string; share: number | null }[];
  ages: { code: string; share: number }[];
  genders: { code: string; share: number }[];
  /** Null off the main line (07 RG22). */
  bands: StoredNetworkBands | null;
};

/** The lines of the session's own account, oldest first; one line when `lineId` is given (none: unknown). */
export async function readOwnNetworkLines(
  tx: Transaction,
  lineId: string | null = null,
): Promise<StoredNetworkLine[]> {
  const rows = await tx.execute<{ line: StoredNetworkLine }>(sql`
    select jsonb_build_object(
             'id', n.id,
             'networkCode', n.network_code::text,
             'isPrimary', n.is_primary,
             'handle', n.handle,
             'pseudonym', n.pseudonym,
             'profileUrl', n.profile_url,
             'followersCount', n.followers_count,
             'postsLast30Days', n.posts_last_30_days,
             'avgCommentsPerPost', n.avg_comments_per_post,
             'avgReachPerPost', n.avg_reach_per_post,
             'engagementRateBp', n.engagement_rate_bp,
             'figuresSource', n.figures_source,
             'figuresMeasuredAt', to_char(n.figures_measured_at at time zone 'UTC', ${ISO_UTC}),
             'countries', coalesce((select jsonb_agg(jsonb_build_object(
                             'slot', c.slot, 'code', c.country_code::text,
                             'share', c.share_percent) order by c.slot)
                           from profiles.creator_audience_countries c
                          where c.social_account_id = n.id), '[]'::jsonb),
             'ages', coalesce((select jsonb_agg(jsonb_build_object(
                             'code', g.age_band_code::text, 'share', g.share_percent)
                             order by g.age_band_code)
                           from profiles.creator_audience_ages g
                          where g.social_account_id = n.id), '[]'::jsonb),
             'genders', coalesce((select jsonb_agg(jsonb_build_object(
                             'code', x.gender_code::text, 'share', x.share_percent)
                             order by x.gender_code)
                           from profiles.creator_audience_genders x
                          where x.social_account_id = n.id), '[]'::jsonb),
             'bands', case when n.is_primary then
                         (select jsonb_build_object(
                                   'audienceBand', b.audience_band,
                                   'reachBand', b.reach_band,
                                   'publicationFrequency', b.publication_frequency_code,
                                   'commentBand', b.comment_band)
                            from profiles.creator_public_networks b
                           where b.social_account_id = n.id)
                       end) as line
      from profiles.creator_social_accounts n
     where n.account_id = (select influx.current_account_id())
       and (${lineId}::uuid is null or n.id = ${lineId}::uuid)
     order by n.created_at, n.id`);
  return rows.map((row) => row.line);
}

/** An open network: the hosts a profile URL may point to (empty: the network lists none, any host does). */
export type ActiveNetwork = { hosts: string[] };

/**
 * A network with its hosts (07 RG43); null: unknown, or retired when `activeOnly` (a new line takes
 * an offered network only; an existing line keeps the hosts of its own, retired or not).
 */
export async function readNetworkHosts(
  tx: Transaction,
  networkCode: string,
  activeOnly: boolean,
): Promise<ActiveNetwork | null> {
  const rows = await tx.execute<{ hosts: string[] }>(sql`
    select coalesce((select jsonb_agg(h.host order by h.host)
                       from reference.network_url_hosts h
                      where h.network_code = n.code), '[]'::jsonb) as hosts
      from reference.networks n
     where n.code = ${networkCode}::text
       and (not ${activeOnly}::boolean or n.retired_at is null)`);
  const row = rows[0];
  return row === undefined ? null : { hosts: row.hosts };
}

/** The age bands still offered to the audience (07 RG60). */
export async function readActiveAgeBandCodes(
  tx: Transaction,
): Promise<string[]> {
  const rows = await tx.execute<{ code: string }>(
    sql`select code::text as code from reference.age_bands where retired_at is null`,
  );
  return rows.map((row) => row.code);
}

/** The columns of a network line a save may set; an absent key is left as it is, `null` empties one. */
export type NetworkLineColumns = {
  isPrimary?: boolean | undefined;
  handle?: string | null | undefined;
  pseudonym?: string | null | undefined;
  profileUrl?: string | null | undefined;
  followersCount?: number | null | undefined;
  postsLast30Days?: number | null | undefined;
  avgCommentsPerPost?: number | null | undefined;
  avgReachPerPost?: number | null | undefined;
  engagementRateBp?: number | null | undefined;
};

/** The entered columns (the nine of the insert and update grants of 0217 §8), with the type each is cast to. */
function networkLineAssignments(columns: NetworkLineColumns) {
  return [
    ["is_primary", columns.isPrimary, "boolean"],
    ["handle", columns.handle, "text"],
    ["pseudonym", columns.pseudonym, "text"],
    ["profile_url", columns.profileUrl, "text"],
    ["followers_count", columns.followersCount, "bigint"],
    ["posts_last_30_days", columns.postsLast30Days, "integer"],
    ["avg_comments_per_post", columns.avgCommentsPerPost, "bigint"],
    ["avg_reach_per_post", columns.avgReachPerPost, "bigint"],
    ["engagement_rate_bp", columns.engagementRateBp, "integer"],
  ] as const;
}

/** Unchecks the main line of the account but one: the explicit half of "check this one" (07 RG41, CA11). */
export async function uncheckPrimaryNetworkLines(
  tx: Transaction,
  exceptLineId: string | null,
): Promise<void> {
  await tx.execute(
    sql`update profiles.creator_social_accounts
           set is_primary = false
         where account_id = (select influx.current_account_id())
           and is_primary
           and (${exceptLineId}::uuid is null or id <> ${exceptLineId}::uuid)`,
  );
}

/** Inserts a line of the session's account and returns its identifier. Never the source nor the date (0217). */
export async function insertNetworkLine(
  tx: Transaction,
  networkCode: string,
  columns: NetworkLineColumns,
): Promise<string> {
  const entered = networkLineAssignments(columns).filter(
    ([, value]) => value !== undefined,
  );
  const names = [
    sql.identifier("account_id"),
    sql.identifier("network_code"),
    ...entered.map(([column]) => sql.identifier(column)),
  ];
  const values = [
    sql`(select influx.current_account_id())`,
    sql`${networkCode}::text`,
    ...entered.map(([, value, type]) => sql`${value}::${CAST[type]}`),
  ];
  const rows = await tx.execute<{ id: string }>(
    sql`insert into profiles.creator_social_accounts (${sql.join(names, sql`, `)})
        values (${sql.join(values, sql`, `)})
        returning id::text as id`,
  );
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error("a network line was inserted without an identifier");
  }
  return id;
}

/** Sets the given columns of one of the account's lines (another account's line is out of reach by policy). */
export async function updateNetworkLineColumns(
  tx: Transaction,
  lineId: string,
  columns: NetworkLineColumns,
): Promise<void> {
  const set = networkLineAssignments(columns)
    .filter(([, value]) => value !== undefined)
    .map(
      ([column, value, type]) =>
        sql`${sql.identifier(column)} = ${value}::${CAST[type]}`,
    );
  if (set.length === 0) {
    return;
  }
  await tx.execute(
    sql`update profiles.creator_social_accounts
           set ${sql.join(set, sql`, `)}
         where id = ${lineId}::uuid
           and account_id = (select influx.current_account_id())`,
  );
}

/** Removes one of the account's lines with its audience; false when the account holds no such line. */
export async function deleteNetworkLine(
  tx: Transaction,
  lineId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ id: string }>(
    sql`delete from profiles.creator_social_accounts
         where id = ${lineId}::uuid
           and account_id = (select influx.current_account_id())
        returning id::text as id`,
  );
  return rows.length > 0;
}

/**
 * "Confirmer mes chiffres" (07 RG50, RG116, EC-L2D-6): the three metrics written together by the
 * database's door, which sets the source and the date. The door answers 42501 for a line that is
 * not the caller's, as for an unknown one.
 */
export async function confirmOwnNetworkFigures(
  tx: Transaction,
  lineId: string,
  figures: {
    followersCount: number | null;
    postsLast30Days: number | null;
    avgCommentsPerPost: number | null;
  },
): Promise<void> {
  await tx.execute(
    sql`select profiles.confirm_own_creator_figures(
               ${lineId}::uuid,
               ${figures.followersCount}::bigint,
               ${figures.postsLast30Days}::integer,
               ${figures.avgCommentsPerPost}::bigint)`,
  );
}

/** The exact audience to store for one line: the main country is slot 0, the others slots 1 to 4. */
export type NetworkAudienceRows = {
  countries: { slot: number; code: string; share: number | null }[];
  ages: { code: string; share: number }[];
  genders: { code: string; share: number }[];
};

/** A Postgres array literal of whole numbers, `null` standing for NULL. */
function numberArray(values: readonly (number | null)[]): string {
  return `{${values
    .map((value) => (value === null ? "NULL" : String(value)))
    .join(",")}}`;
}

/** Replaces the three dimensions of a line as a whole: deletion, then insertion (0217: no update right). */
export async function replaceNetworkAudience(
  tx: Transaction,
  lineId: string,
  audience: NetworkAudienceRows,
): Promise<void> {
  await tx.execute(
    sql`delete from profiles.creator_audience_countries
         where social_account_id = ${lineId}::uuid
           and account_id = (select influx.current_account_id())`,
  );
  await tx.execute(
    sql`delete from profiles.creator_audience_ages
         where social_account_id = ${lineId}::uuid
           and account_id = (select influx.current_account_id())`,
  );
  await tx.execute(
    sql`delete from profiles.creator_audience_genders
         where social_account_id = ${lineId}::uuid
           and account_id = (select influx.current_account_id())`,
  );
  if (audience.countries.length > 0) {
    await tx.execute(
      sql`insert into profiles.creator_audience_countries
            (social_account_id, account_id, slot, country_code, share_percent)
          select ${lineId}::uuid, (select influx.current_account_id()),
                 v.slot, v.code::char(2), v.share
            from unnest(${numberArray(audience.countries.map((c) => c.slot))}::smallint[],
                        ${textArray(audience.countries.map((c) => c.code))}::text[],
                        ${numberArray(audience.countries.map((c) => c.share))}::smallint[])
                 as v (slot, code, share)`,
    );
  }
  if (audience.ages.length > 0) {
    await tx.execute(
      sql`insert into profiles.creator_audience_ages
            (social_account_id, account_id, age_band_code, share_percent)
          select ${lineId}::uuid, (select influx.current_account_id()), v.code, v.share
            from unnest(${textArray(audience.ages.map((a) => a.code))}::text[],
                        ${numberArray(audience.ages.map((a) => a.share))}::smallint[])
                 as v (code, share)`,
    );
  }
  if (audience.genders.length > 0) {
    await tx.execute(
      sql`insert into profiles.creator_audience_genders
            (social_account_id, account_id, gender_code, share_percent)
          select ${lineId}::uuid, (select influx.current_account_id()), v.code, v.share
            from unnest(${textArray(audience.genders.map((g) => g.code))}::text[],
                        ${numberArray(audience.genders.map((g) => g.share))}::smallint[])
                 as v (code, share)`,
    );
  }
}

/**
 * Runs the deferred sum checks of the audience now (0218 holds them to the commit), so that a sum
 * over 100 is answered here, as the request's fault, and not as an error of the commit.
 */
export async function settleAudienceSums(tx: Transaction): Promise<void> {
  await tx.execute(sql`set constraints all immediate`);
}
