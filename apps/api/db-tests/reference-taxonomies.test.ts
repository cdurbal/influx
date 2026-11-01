// The Lot 2 reference lists of 0201 (docs/mvp/04 §4.2, §12.12 points 3 and 4): the exact values of
// jalons/l2a/referentiels.md, D79 point (10), 07 RG114 and RG115; contiguous bands; the shape of
// codes and translation keys; no minor age band (D15); the net bounds of price_bands (04 §4.2).
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

  it("loads no price band (D78, L2A founder answer 2)", async () => {
    expect(await codesOf("price_bands")).toEqual([]);
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
