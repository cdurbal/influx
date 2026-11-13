// The Lot 2 reference lists of 0201 (docs/mvp/04 §4.2, §12.12 points 3 and 4): the exact values of
// jalons/l2a/referentiels.md, D79 point (10), 07 RG114 and RG115; contiguous bands; the shape of
// codes and translation keys; no minor age band (D15); the net bounds of price_bands (04 §4.2) and
// its grid of 0304 (jalons/l3b/tranches.md).
// Rights per table are in T2, the write refusals of price_bands in T16.4; this file checks what
// their probes do not reach. Each refusal runs as the local superuser, in a rolled-back
// transaction, so that only the constraint can refuse.
import { inRolledBackTransaction, probe } from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { localSuperuser, migrationRole } from "./support.ts";

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";

let migration: postgres.Sql;

beforeAll(() => {
  migration = migrationRole();
});

/** Outcome of one statement run by the superuser, rolled back. */
function attempt(statement: string): ReturnType<typeof probe> {
  return inRolledBackTransaction(localSuperuser(), (tx) =>
    probe(tx, statement),
  );
}

async function codesOf(table: string): Promise<string[]> {
  const rows = await migration.unsafe<{ code: string }[]>(
    `select code from reference.${table} order by code`,
  );
  return rows.map((row) => row.code);
}

const TOPICS = [
  "beauty",
  "fashion",
  "food",
  "travel",
  "sport_fitness",
  "wellness",
  "family",
  "home",
  "gaming",
  "tech",
  "entertainment",
  "music",
  "culture",
  "education",
  "business_finance",
  "automotive",
  "pets",
];

const NETWORKS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "linkedin",
  "x",
  "snapchat",
  "twitch",
  "pinterest",
  "threads",
];

/** Format code → network code (null: UGC, no network). */
const FORMATS: Readonly<Record<string, string | null>> = {
  instagram_post: "instagram",
  instagram_carousel: "instagram",
  instagram_reel: "instagram",
  instagram_story: "instagram",
  instagram_live: "instagram",
  tiktok_video: "tiktok",
  tiktok_carousel: "tiktok",
  tiktok_live: "tiktok",
  youtube_video: "youtube",
  youtube_integration: "youtube",
  youtube_short: "youtube",
  youtube_live: "youtube",
  facebook_post: "facebook",
  facebook_reel: "facebook",
  facebook_story: "facebook",
  linkedin_post: "linkedin",
  x_post: "x",
  threads_post: "threads",
  snapchat_story: "snapchat",
  snapchat_spotlight: "snapchat",
  twitch_live: "twitch",
  pinterest_pin: "pinterest",
  ugc_video: null,
  ugc_photo: null,
};

const SENSITIVE_SECTORS = [
  "alcohol",
  "gambling",
  "cbd",
  "finance",
  "health",
  "crypto",
  "adult",
];

const OTHER_SECTORS = [
  "beauty_personal_care",
  "fashion_accessories",
  "food_beverages",
  "restaurants_hospitality",
  "travel_tourism",
  "sports_leisure",
  "home_garden",
  "consumer_electronics",
  "software_telecom",
  "video_games",
  "automotive_mobility",
  "media_entertainment",
  "education_training",
  "baby_kids",
  "pet_care",
  "retail_ecommerce",
  "real_estate",
  "business_services",
  "nonprofit_public",
];

const EDITORIAL_TONES = [
  "educational",
  "humorous",
  "inspiring",
  "premium",
  "straightforward",
  "family_friendly",
  "expert",
];

const REGIONS: Readonly<Record<string, string[]>> = {
  FR: "ARA BFC BRE CVL GES HDF IDF NAQ NOR OCC PAC PDL 20R".split(" "),
  GB: "ENG NIR SCT WLS".split(" "),
  US: (
    "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ " +
    "NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC"
  ).split(" "),
  CA: "AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" "),
  AU: "ACT NSW NT QLD SA TAS VIC WA".split(" "),
};

/** Band tables: bounds columns, and the first lower bound (D15: 18 for age). */
const BANDS = [
  {
    table: "audience_bands",
    min: "min_followers",
    max: "max_followers",
    start: 0,
  },
  {
    table: "engagement_bands",
    min: "min_rate_bp",
    max: "max_rate_bp",
    start: 0,
  },
  { table: "age_bands", min: "min_age", max: "max_age", start: 18 },
  {
    table: "publication_frequencies",
    min: "min_posts_30d",
    max: "max_posts_30d",
    start: 0,
  },
  {
    table: "comment_bands",
    min: "min_comments",
    max: "max_comments",
    start: 0,
  },
] as const;

/** The grid of reference.price_bands loaded by 0304 (jalons/l3b/tranches.md, validated at F1). */
const PRICE_BAND_CURRENCIES = ["CAD", "CHF", "EUR", "GBP", "USD"] as const;
const PRICE_BAND_CODES = [
  "under_100",
  "100_250",
  "250_500",
  "500_1000",
  "1000_2500",
  "2500_5000",
  "5000_10000",
  "10000_25000",
  "25000_50000",
  "50000_plus",
] as const;

/** `code min-max` of a band table, ordered by lower bound; an open upper bound reads `null`. */
async function bandsOf(band: (typeof BANDS)[number]): Promise<string[]> {
  const rows = await migration.unsafe<{ line: string }[]>(
    `select code || ' ' || ${band.min} || '-' || coalesce(${band.max}::text, 'null') as line
       from reference.${band.table} where retired_at is null order by ${band.min}`,
  );
  return rows.map((row) => row.line);
}

const ALL_TABLES = [
  ["topics", "topic"],
  ["networks", "network"],
  ["formats", "format"],
  ["sectors", "sector"],
  ["usage_rights", "usage_right"],
  ["audience_bands", "audience_band"],
  ["engagement_bands", "engagement_band"],
  ["age_bands", "age_band"],
  ["audience_genders", "audience_gender"],
  ["editorial_tones", "editorial_tone"],
  ["publication_frequencies", "publication_frequency"],
  ["comment_bands", "comment_band"],
  ["regions", "region"],
  ["price_bands", "price_band"],
] as const;

describe("Exact values of jalons/l2a/referentiels.md (L2A-08)", () => {
  it("loads the 17 topics, none with a parent", async () => {
    expect(await codesOf("topics")).toEqual([...TOPICS].sort());
    const [row] = await migration<{ count: number }[]>`
      select count(*)::int as count from reference.topics where parent_code is not null`;
    expect(row?.count).toBe(0);
  });

  it("loads the 10 networks, each supporting an ownership proof", async () => {
    const rows = await migration<{ code: string; proof: boolean }[]>`
      select code, supports_ownership_proof as proof from reference.networks order by code`;
    expect(rows.map((row) => row.code)).toEqual([...NETWORKS].sort());
    expect(rows.every((row) => row.proof)).toBe(true);
  });

  it("loads the 24 formats with their network, the two UGC formats without one", async () => {
    const rows = await migration<{ code: string; network: string | null }[]>`
      select code, network_code as network from reference.formats order by code`;
    expect(
      Object.fromEntries(rows.map((row) => [row.code, row.network])),
    ).toEqual(FORMATS);
  });

  it("loads the 26 sectors, the seven of 09 RG84 alone sensitive", async () => {
    const rows = await migration<{ code: string; sensitive: boolean }[]>`
      select code, is_sensitive as sensitive from reference.sectors order by code`;
    expect(rows.filter((row) => row.sensitive).map((row) => row.code)).toEqual(
      [...SENSITIVE_SECTORS].sort(),
    );
    expect(rows.filter((row) => !row.sensitive).map((row) => row.code)).toEqual(
      [...OTHER_SECTORS].sort(),
    );
  });

  it("loads the 4 usage rights of 09 RG38 by increasing reach", async () => {
    const rows = await migration<{ code: string }[]>`
      select code from reference.usage_rights order by sort_order`;
    expect(rows.map((row) => row.code)).toEqual([
      "none",
      "organic_repost",
      "paid_whitelisting",
      "media_buy",
    ]);
  });

  it("loads the 7 editorial tones of 07 RG34 and the 3 audience gender bands", async () => {
    expect(await codesOf("editorial_tones")).toEqual(
      [...EDITORIAL_TONES].sort(),
    );
    expect(await codesOf("audience_genders")).toEqual([
      "female_majority",
      "male_majority",
      "mixed",
    ]);
  });

  it("loads the audience and engagement bands of D79 point (10)", async () => {
    expect(await bandsOf(BANDS[0])).toEqual([
      "nano 0-9999",
      "micro 10000-49999",
      "mid 50000-499999",
      "macro 500000-999999",
      "mega 1000000-null",
    ]);
    // basis points: under 1, 1 to 3, 3 to 6, 6 and more percent points
    expect(await bandsOf(BANDS[1])).toEqual([
      "under_1 0-99",
      "1_3 100-299",
      "3_6 300-599",
      "6_plus 600-null",
    ]);
  });

  it("loads the age bands (04 §4.2), the publication frequencies (07 RG114) and the comment bands (07 RG115)", async () => {
    expect(await bandsOf(BANDS[2])).toEqual([
      "18_24 18-24",
      "25_34 25-34",
      "35_44 35-44",
      "45_plus 45-null",
    ]);
    expect(await bandsOf(BANDS[3])).toEqual([
      "monthly_or_less 0-1",
      "biweekly 2-3",
      "weekly 4-7",
      "several_per_week 8-24",
      "daily 25-null",
    ]);
    const order = await migration<{ code: string }[]>`
      select code from reference.publication_frequencies order by sort_order`;
    expect(order.map((row) => row.code)).toEqual([
      "daily",
      "several_per_week",
      "weekly",
      "biweekly",
      "monthly_or_less",
    ]);
    expect(await bandsOf(BANDS[4])).toEqual([
      "0_9 0-9",
      "10_49 10-49",
      "50_199 50-199",
      "200_999 200-999",
      "1000_plus 1000-null",
    ]);
  });

  it("loads the 89 regions of five countries, metropolitan France with FR-20R (ISO 3166-2)", async () => {
    const rows = await migration<{ country: string; code: string }[]>`
      select country_code as country, code from reference.regions order by country_code, code`;
    const expected = Object.entries(REGIONS)
      .flatMap(([country, codes]) =>
        codes.map((code) => ({ country, code: `${country}-${code}` })),
      )
      .sort((a, b) =>
        a.country === b.country
          ? a.code < b.code
            ? -1
            : 1
          : a.country < b.country
            ? -1
            : 1,
      );
    expect(rows.map((row) => `${row.country} ${row.code}`)).toEqual(
      expected.map((row) => `${row.country} ${row.code}`),
    );
    expect(rows).toHaveLength(89);
  });

  it("loads the ten price band codes in each of the five currencies of 0304 (jalons/l3b/tranches.md)", async () => {
    const rows = await migration<{ currency: string; codes: string[] }[]>`
      select currency, array_agg(code order by min_amount_minor) as codes
        from reference.price_bands group by currency order by currency`;
    expect(rows).toEqual(
      PRICE_BAND_CURRENCIES.map((currency) => ({
        currency,
        codes: [...PRICE_BAND_CODES],
      })),
    );
  });

  it("ties the price bands to five active currencies with a minor unit of 2 (tranches.md §1)", async () => {
    const rows = await migration<{ code: string }[]>`
      select code from reference.currencies
       where is_active and minor_unit = 2
         and code in (select currency from reference.price_bands)
       order by code`;
    expect(rows.map((row) => row.code)).toEqual([...PRICE_BAND_CURRENCIES]);
  });

  it("stores a translation key of the form <table in the singular>.<code> on every row (R8)", async () => {
    const wrong: string[] = [];
    for (const [table, singular] of ALL_TABLES) {
      const rows = await migration.unsafe<{ code: string }[]>(
        `select code from reference.${table} where label_key is distinct from '${singular}.' || code`,
      );
      wrong.push(...rows.map((row) => `${table} ${row.code}`));
    }
    expect(wrong).toEqual([]);
  });
});

describe("Bands: integer bounds, upper bound included, contiguous, the last one open", () => {
  it.each(BANDS)("$table", async (band) => {
    const rows = await migration.unsafe<{ min: string; max: string | null }[]>(
      `select ${band.min}::text as min, ${band.max}::text as max
         from reference.${band.table} where retired_at is null order by ${band.min}`,
    );
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const problems: string[] = [];
    if (Number(rows[0]?.min) !== band.start) {
      problems.push(`first band starts at ${rows[0]?.min}, not ${band.start}`);
    }
    rows.forEach((row, index) => {
      const last = index === rows.length - 1;
      if (last !== (row.max === null)) {
        problems.push(
          `band ${index}: open upper bound ${last ? "missing" : "before the last"}`,
        );
      }
      const next = rows[index + 1];
      if (
        next !== undefined &&
        row.max !== null &&
        Number(next.min) !== Number(row.max) + 1
      ) {
        problems.push(
          `band ${index}: ${row.max} then ${next.min} (gap or overlap)`,
        );
      }
    });
    expect(problems).toEqual([]);
  });
});

/**
 * L2AT-5 for reference.price_bands (tranches.md §2, NOT the rule of the Lot 2 bands above): per
 * currency, the first band starts at 0, the lower bound is included and the upper bound excluded,
 * so each band starts where the previous one ends; upper above lower; only the last band is open.
 * One line per finding, read from the table itself.
 */
async function priceBandFindings(
  sql: postgres.Sql | postgres.TransactionSql,
): Promise<string[]> {
  const rows = await sql<{ finding: string }[]>`
    with ordered as (
      select currency, code, min_amount_minor as low, max_amount_minor as high,
             lag(code) over w as previous_code,
             lag(max_amount_minor) over w as previous_high,
             row_number() over w as rank,
             count(*) over (partition by currency) as total
        from reference.price_bands
       where retired_at is null
      window w as (partition by currency order by min_amount_minor, code)
    )
    select currency || ' ' || code || ': first band starts at ' || low as finding
      from ordered where rank = 1 and low <> 0
    union all
    select currency || ' ' || code || ': gap after ' || previous_code
           || ' (' || previous_high || ' then ' || low || ')'
      from ordered where rank > 1 and low > previous_high
    union all
    select currency || ' ' || code || ': overlaps ' || previous_code
           || ' (' || low || ' below ' || previous_high || ')'
      from ordered where rank > 1 and low < previous_high
    union all
    select currency || ' ' || code || ': open before the last band'
      from ordered where high is null and rank < total
    union all
    select currency || ' ' || code || ': last band not open'
      from ordered where high is not null and rank = total
    union all
    select currency || ' ' || code || ': upper bound not above the lower one'
      from ordered where high <= low
    order by 1`;
  return rows.map((row) => row.finding);
}

describe("L2AT-5: reference.price_bands is contiguous per currency, one open band (tranches.md §2)", () => {
  it("finds no gap, no overlap and a single open band, the last, in each currency", async () => {
    expect(await priceBandFindings(migration)).toEqual([]);
  });

  it("reports a gap, an overlap and an early open band (witness, rolled back)", async () => {
    const findings = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx`update reference.price_bands set min_amount_minor = 12000
                  where currency = 'EUR' and code = '100_250'`;
        await tx`update reference.price_bands set min_amount_minor = 240000
                  where currency = 'GBP' and code = '2500_5000'`;
        await tx`update reference.price_bands set max_amount_minor = null
                  where currency = 'USD' and code = '25000_50000'`;
        return priceBandFindings(tx);
      },
    );
    expect(findings).toEqual([
      "EUR 100_250: gap after under_100 (10000 then 12000)",
      "GBP 2500_5000: overlaps 1000_2500 (240000 below 250000)",
      "USD 25000_50000: open before the last band",
    ]);
  });
});

describe("D15: no minor age band can be modelled", () => {
  it("refuses an age band starting at 17", async () => {
    expect(
      await attempt(
        `insert into reference.age_bands (code, label_key, min_age, max_age)
         values ('17_17', 'age_band.17_17', 17, 17)`,
      ),
    ).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });

  it("accepts a band starting at 18 (the witness of the refusal above)", async () => {
    expect(
      await attempt(
        `insert into reference.age_bands (code, label_key, min_age, max_age)
         values ('18_19', 'age_band.18_19', 18, 19)`,
      ),
    ).toEqual({ outcome: "rows", count: 1 });
  });
});

describe("Shape of codes, keys and bounds", () => {
  it.each([
    [
      "an upper-case code",
      `insert into reference.topics (code, label_key) values ('Beauty', 'topic.Beauty')`,
    ],
    [
      "a hyphen in a code",
      `insert into reference.topics (code, label_key) values ('self-care', 'topic.self-care')`,
    ],
    [
      "an empty code",
      `insert into reference.topics (code, label_key) values ('', 'topic.')`,
    ],
    [
      "a label_key of another table",
      `insert into reference.topics (code, label_key) values ('diy', 'sector.diy')`,
    ],
    [
      "a plural label_key",
      `insert into reference.editorial_tones (code, label_key) values ('dry', 'editorial_tones.dry')`,
    ],
    [
      "a topic of its own parent",
      `insert into reference.topics (code, parent_code, label_key) values ('diy', 'diy', 'topic.diy')`,
    ],
    [
      "a format not prefixed by its network",
      `insert into reference.formats (code, network_code, label_key) values ('reel_instagram', 'instagram', 'format.reel_instagram')`,
    ],
    [
      "a region of another country",
      `insert into reference.regions (country_code, code, label_key) values ('FR', 'GB-ENG', 'region.GB-ENG')`,
    ],
    [
      "a region code without its country",
      `insert into reference.regions (country_code, code, label_key) values ('FR', 'IDF', 'region.IDF')`,
    ],
    [
      "an upper bound under the lower one",
      `insert into reference.comment_bands (code, label_key, min_comments, max_comments) values ('x_y', 'comment_band.x_y', 50, 10)`,
    ],
    [
      "a negative lower bound",
      `insert into reference.audience_bands (code, label_key, min_followers, max_followers) values ('neg', 'audience_band.neg', -1, 5)`,
    ],
    [
      "a retirement before the introduction",
      `insert into reference.networks (code, label_key, supports_ownership_proof, introduced_at, retired_at) values ('vine', 'network.vine', false, now(), now() - interval '1 day')`,
    ],
  ])("refuses %s", async (_label, statement) => {
    expect(await attempt(statement)).toEqual({
      outcome: "error",
      code: CHECK_VIOLATION,
    });
  });

  it.each([
    [
      "a topic whose parent is unknown",
      `insert into reference.topics (code, parent_code, label_key) values ('diy', 'crafts', 'topic.diy')`,
    ],
    [
      "a format of an unknown network",
      `insert into reference.formats (code, network_code, label_key) values ('vine_video', 'vine', 'format.vine_video')`,
    ],
    [
      "a region of an unknown country",
      `insert into reference.regions (country_code, code, label_key) values ('ZZ', 'ZZ-AB', 'region.ZZ-AB')`,
    ],
    [
      "a price band in an unknown currency",
      `insert into reference.price_bands (currency, code, label_key, min_amount_minor) values ('ZZZ', 'b1', 'price_band.b1', 0)`,
    ],
  ])("refuses %s", async (_label, statement) => {
    expect(await attempt(statement)).toEqual({
      outcome: "error",
      code: FOREIGN_KEY_VIOLATION,
    });
  });
});

describe("04 §4.2: the net bounds of reference.price_bands", () => {
  const BAND = `insert into reference.price_bands
    (currency, code, label_key, min_amount_minor, max_amount_minor,
     net_min_amount_minor, net_max_amount_minor, net_basis_label, net_computed_at) values `;

  it.each([
    [
      "one net bound without the other (net_pair)",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, 6000, null, 'basis', now())`,
    ],
    [
      "a net lower bound above the gross one (net_within_gross)",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, 12000, 30000, 'basis', now())`,
    ],
    [
      "a net upper bound above the gross one (net_within_gross)",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, 6000, 60000, 'basis', now())`,
    ],
    [
      "a negative net (net_within_gross)",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, -1, 30000, 'basis', now())`,
    ],
    [
      "net bounds in reverse order (net_within_gross)",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, 9000, 8000, 'basis', now())`,
    ],
    [
      "a net without its written basis (net_needs_basis)",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, 6000, 30000, null, now())`,
    ],
    [
      "a net without its computation date (net_needs_basis)",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, 6000, 30000, 'basis', null)`,
    ],
  ])("refuses %s", async (_label, values) => {
    expect(await attempt(BAND + values)).toEqual({
      outcome: "error",
      code: CHECK_VIOLATION,
    });
  });

  it.each([
    [
      "a band without any net",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, null, null, null, null)`,
    ],
    [
      "a band with both nets and their basis",
      `('EUR', 'b1', 'price_band.b1', 10000, 50000, 6000, 30000, 'basis', now())`,
    ],
    [
      "an open last band with a net",
      `('EUR', 'b9', 'price_band.b9', 500000, null, 300000, 900000, 'basis', now())`,
    ],
  ])("accepts %s (witness, rolled back)", async (_label, values) => {
    expect(await attempt(BAND + values)).toEqual({ outcome: "rows", count: 1 });
  });
});

// L2AT-5: EVERY check constraint of the Lot 2 lists has a case that it alone refuses. Two proofs
// per case, so that no case passes by luck (R4, "seen red by mutation"): the statement is refused
// BY THAT constraint (its name, read from the error), and, with that constraint dropped in the
// rolled-back transaction, the same statement is accepted. A constraint added to these tables
// without a case fails the inventory below. Contiguity of price_bands per currency is not a check
// constraint: it is read from the table loaded by 0304, with its witness (L2AT-5 describe above).
type Refusal =
  | { outcome: "accepted" }
  | { outcome: "refused"; code: string; constraint: string | undefined };

/** One statement in a rolled-back transaction, after `beforehand` (a mutation) when given. */
function refusalOf(statement: string, beforehand?: string): Promise<Refusal> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    if (beforehand !== undefined) {
      await tx.unsafe(beforehand);
    }
    try {
      await tx.savepoint((savepoint) => savepoint.unsafe(statement));
      return { outcome: "accepted" } satisfies Refusal;
    } catch (error) {
      const found = error as { code?: string; constraint_name?: string };
      return {
        outcome: "refused",
        code: found.code ?? "unknown",
        constraint: found.constraint_name,
      } satisfies Refusal;
    }
  });
}

/** The twelve lists keyed by `code` alone: their extra not-null columns, with valid values. */
const CODE_LISTS: readonly {
  table: string;
  singular: string;
  columns?: string;
  values?: string;
}[] = [
  { table: "topics", singular: "topic" },
  {
    table: "networks",
    singular: "network",
    columns: ", supports_ownership_proof",
    values: ", false",
  },
  { table: "formats", singular: "format" },
  {
    table: "sectors",
    singular: "sector",
    columns: ", is_sensitive",
    values: ", false",
  },
  {
    table: "usage_rights",
    singular: "usage_right",
    columns: ", sort_order",
    values: ", 99",
  },
  {
    table: "audience_bands",
    singular: "audience_band",
    columns: ", min_followers",
    values: ", 0",
  },
  {
    table: "engagement_bands",
    singular: "engagement_band",
    columns: ", min_rate_bp",
    values: ", 0",
  },
  {
    table: "age_bands",
    singular: "age_band",
    columns: ", min_age",
    values: ", 18",
  },
  { table: "audience_genders", singular: "audience_gender" },
  { table: "editorial_tones", singular: "editorial_tone" },
  {
    table: "publication_frequencies",
    singular: "publication_frequency",
    columns: ", min_posts_30d, sort_order",
    values: ", 0, 99",
  },
  {
    table: "comment_bands",
    singular: "comment_band",
    columns: ", min_comments",
    values: ", 0",
  },
];

/** constraint name → statements that only that constraint refuses. */
const CONSTRAINT_CASES: Readonly<Record<string, readonly string[]>> = (() => {
  const cases: Record<string, string[]> = {};
  const add = (constraint: string, ...statements: string[]) => {
    cases[constraint] = [...(cases[constraint] ?? []), ...statements];
  };
  for (const { table, singular, columns = "", values = "" } of CODE_LISTS) {
    const insert = (code: string, key: string, more = ["", ""]) =>
      `insert into reference.${table} (code, label_key${columns}${more[0]})
       values ('${code}', '${key}'${values}${more[1]})`;
    add(`${table}_code_format`, insert("Bad-Code", `${singular}.Bad-Code`));
    add(`${table}_label_key`, insert("fine_code", `${singular}s.fine_code`));
    add(
      `${table}_retired`,
      insert("fine_code", `${singular}.fine_code`, [
        ", introduced_at, retired_at",
        ", now(), now() - interval '1 day'",
      ]),
    );
  }
  add(
    "topics_parent_other",
    `insert into reference.topics (code, parent_code, label_key)
     values ('diy', 'diy', 'topic.diy')`,
  );
  add(
    "formats_network_prefix",
    `insert into reference.formats (code, network_code, label_key)
     values ('reel_instagram', 'instagram', 'format.reel_instagram')`,
  );
  add(
    "usage_rights_sort_order",
    `insert into reference.usage_rights (code, label_key, sort_order)
     values ('zero_right', 'usage_right.zero_right', 0)`,
  );
  add(
    "audience_bands_bounds",
    `insert into reference.audience_bands (code, label_key, min_followers)
     values ('neg', 'audience_band.neg', -1)`,
    `insert into reference.audience_bands (code, label_key, min_followers, max_followers)
     values ('reversed', 'audience_band.reversed', 50, 10)`,
  );
  add(
    "engagement_bands_bounds",
    `insert into reference.engagement_bands (code, label_key, min_rate_bp)
     values ('neg', 'engagement_band.neg', -1)`,
    `insert into reference.engagement_bands (code, label_key, min_rate_bp, max_rate_bp)
     values ('reversed', 'engagement_band.reversed', 50, 10)`,
  );
  add(
    "age_bands_adult_only",
    `insert into reference.age_bands (code, label_key, min_age, max_age)
     values ('17_19', 'age_band.17_19', 17, 19)`,
  );
  add(
    "age_bands_bounds",
    `insert into reference.age_bands (code, label_key, min_age, max_age)
     values ('reversed', 'age_band.reversed', 30, 20)`,
  );
  add(
    "publication_frequencies_sort_order",
    `insert into reference.publication_frequencies (code, label_key, min_posts_30d, sort_order)
     values ('zero_order', 'publication_frequency.zero_order', 0, 0)`,
  );
  add(
    "publication_frequencies_bounds",
    `insert into reference.publication_frequencies (code, label_key, min_posts_30d, sort_order)
     values ('neg', 'publication_frequency.neg', -1, 99)`,
    `insert into reference.publication_frequencies (code, label_key, min_posts_30d, max_posts_30d, sort_order)
     values ('reversed', 'publication_frequency.reversed', 8, 2, 99)`,
  );
  add(
    "comment_bands_bounds",
    `insert into reference.comment_bands (code, label_key, min_comments)
     values ('neg', 'comment_band.neg', -1)`,
    `insert into reference.comment_bands (code, label_key, min_comments, max_comments)
     values ('reversed', 'comment_band.reversed', 50, 10)`,
  );
  // Regions: the full ISO 3166-2 code, its country as prefix.
  add(
    "regions_code_format",
    `insert into reference.regions (country_code, code, label_key)
     values ('FR', 'FR-ABCD', 'region.FR-ABCD')`,
    `insert into reference.regions (country_code, code, label_key)
     values ('FR', 'GB-ZZ', 'region.GB-ZZ')`,
  );
  add(
    "regions_label_key",
    `insert into reference.regions (country_code, code, label_key)
     values ('FR', 'FR-ZZ', 'region.ZZ')`,
  );
  add(
    "regions_retired",
    `insert into reference.regions (country_code, code, label_key, introduced_at, retired_at)
     values ('FR', 'FR-ZZ', 'region.FR-ZZ', now(), now() - interval '1 day')`,
  );
  // Price bands: codes outside the grid of 0304, the rows below exist in the transaction only.
  const band = (
    code: string,
    key: string,
    min: number,
    max: number,
    net = "",
    more = ["", ""],
  ) =>
    `insert into reference.price_bands
       (currency, code, label_key, min_amount_minor, max_amount_minor${net === "" ? "" : ", net_min_amount_minor, net_max_amount_minor, net_basis_label, net_computed_at"}${more[0]})
     values ('EUR', '${code}', '${key}', ${min}, ${max}${net === "" ? "" : `, ${net}`}${more[1]})`;
  add(
    "price_bands_code_format",
    band("Bad-Code", "price_band.Bad-Code", 0, 10),
  );
  add("price_bands_label_key", band("fine", "price_bands.fine", 0, 10));
  add(
    "price_bands_bounds",
    band("neg", "price_band.neg", -1, 10),
    band("reversed", "price_band.reversed", 50, 10),
  );
  add(
    "price_bands_retired",
    band("fine", "price_band.fine", 0, 10, "", [
      ", introduced_at, retired_at",
      ", now(), now() - interval '1 day'",
    ]),
  );
  add(
    "price_bands_net_pair",
    band("pair", "price_band.pair", 10000, 50000, "6000, null, 'basis', now()"),
  );
  add(
    "price_bands_net_within_gross",
    band(
      "high",
      "price_band.high",
      10000,
      50000,
      "12000, 30000, 'basis', now()",
    ),
    band(
      "over",
      "price_band.over",
      10000,
      50000,
      "6000, 60000, 'basis', now()",
    ),
    band(
      "below",
      "price_band.below",
      10000,
      50000,
      "-1, 30000, 'basis', now()",
    ),
    band(
      "reverse",
      "price_band.reverse",
      10000,
      50000,
      "9000, 8000, 'basis', now()",
    ),
  );
  add(
    "price_bands_net_needs_basis",
    band(
      "nobasis",
      "price_band.nobasis",
      10000,
      50000,
      "6000, 30000, null, now()",
    ),
    band(
      "nodate",
      "price_band.nodate",
      10000,
      50000,
      "6000, 30000, 'basis', null",
    ),
  );
  return cases;
})();

const TABLES_OF_THE_LISTS = [
  ...CODE_LISTS.map((list) => list.table),
  "regions",
  "price_bands",
];

describe("L2AT-5: every check constraint of the Lot 2 lists has a case", () => {
  it("inventories exactly the check constraints of the 14 lists", async () => {
    const rows = await migration<{ name: string }[]>`
      select conname as name
        from pg_constraint
       where contype = 'c'
         and connamespace = 'reference'::regnamespace
         and conrelid::regclass::text = any(${TABLES_OF_THE_LISTS.map((table) => `reference.${table}`)})
       order by conname`;
    expect(rows.map((row) => row.name)).toEqual(
      Object.keys(CONSTRAINT_CASES).sort(),
    );
  });

  const flat = Object.entries(CONSTRAINT_CASES).flatMap(
    ([constraint, statements]) =>
      statements.map((statement, index) => ({
        constraint,
        index,
        statement,
        table: TABLES_OF_THE_LISTS.find((name) =>
          constraint.startsWith(`${name}_`),
        ),
      })),
  );

  it.each(flat)(
    "refuses $constraint (case $index) by that constraint",
    async ({ constraint, statement }) => {
      expect(await refusalOf(statement)).toEqual({
        outcome: "refused",
        code: CHECK_VIOLATION,
        constraint,
      });
    },
  );

  it.each(flat)(
    "accepts the case $index of $constraint once it is dropped (mutation)",
    async ({ constraint, statement, table }) => {
      expect(
        await refusalOf(
          statement,
          `alter table reference.${table} drop constraint ${constraint}`,
        ),
      ).toEqual({ outcome: "accepted" });
    },
  );
});
