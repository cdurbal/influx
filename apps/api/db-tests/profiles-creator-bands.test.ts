// L2D commit 05 — the bands derived from the exact figures and the history of the metrics, 0218
// (jalons/l2d/05.md, l2d/modele.md §0218; 07 RG22, RG45, RG48, RG50, RG56 to RG61, RG114 to RG119;
// fiche invariants 4 to 7, EC-L2D-6, EC-L2D-9): L2D-D7 the follower band from the exact count,
// L2D-D8 the rhythm and the comments, L2D-D9 the door « Confirmer mes chiffres » and its date,
// L2D-D10 the sum of a dimension at 100 at most, L2D-D11 the history, L2D-D12 the country copied
// from the account, L2D-D13 a change of primary line derives the storefront again; plus the bound
// functions, the guard of the storefront, the reprise and the bands computed by comparison only
// (T16.1 in the base). Rights per table and role are probed by T2 (t2-rls-matrix). Each case runs
// in a rolled-back transaction.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const INSUFFICIENT_PRIVILEGE = "42501";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;
const lineB = CREATOR_SOCIAL_ACCOUNT_IDS.b;

const MIGRATION = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/0218_profiles_creator_bands_and_history.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

/** The reprise of 0218 §8, replayed as written (between its two markers). */
const REPRISE_SQL = (() => {
  const start = MIGRATION.indexOf("-- <reprise>");
  const end = MIGRATION.indexOf("-- </reprise>");
  if (start < 0 || end < start) {
    throw new Error("the reprise markers of 0218 are missing");
  }
  return MIGRATION.slice(start, end);
})();

let migration: postgres.Sql;

beforeAll(async () => {
  await testDataSet();
  migration = migrationRole();
});

type Outcome =
  | { outcome: "rows"; count: number }
  | {
      outcome: "error";
      code: string;
      constraint: string | undefined;
      message: string;
    };

/** One statement in a savepoint of `tx`: its row count, or its SQLSTATE, constraint and message. */
async function run(
  tx: Tx,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Outcome> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", count: Math.max(result.count, result.length) };
  } catch (error) {
    const found = error as {
      code?: string;
      constraint_name?: string;
      message?: string;
    };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      constraint: found.constraint_name,
      message: found.message ?? "",
    };
  }
}

function refusedBy(code: string, constraint?: string): unknown {
  return constraint === undefined
    ? expect.objectContaining({ outcome: "error", code })
    : expect.objectContaining({ outcome: "error", code, constraint });
}

const ACCEPTED_ONE = { outcome: "rows", count: 1 };

function asCreator<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
): Promise<T> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: account, role: "creator", aal: "aal1" },
    fn,
  );
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Figures = {
  network?: string;
  followers?: number | null;
  posts?: number | null;
  comments?: number | null;
  reach?: number | null;
  engagementBp?: number | null;
  primary?: boolean;
  handle?: string | null;
};

/** A network line declared by the creator himself (his entered columns only); its id. */
async function declareLine(
  tx: Tx,
  account: string,
  figures: Figures,
): Promise<string> {
  return asCreator(tx, account, async () => {
    const [row] = await tx<{ id: string }[]>`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, followers_count, posts_last_30_days,
         avg_comments_per_post, avg_reach_per_post, engagement_rate_bp)
      values (${account}, ${figures.network ?? "youtube"}, ${figures.primary ?? false},
              ${figures.handle ?? null}, ${figures.followers ?? null}, ${figures.posts ?? null},
              ${figures.comments ?? null}, ${figures.reach ?? null},
              ${figures.engagementBp ?? null})
      returning id::text`;
    if (row === undefined) {
      throw new Error("the line was not declared");
    }
    return row.id;
  });
}

type PublicNetwork = {
  account_id: string;
  network_code: string;
  is_primary: boolean;
  audience_band: string | null;
  reach_band: string | null;
  publication_frequency_code: string | null;
  comment_band: string | null;
  engagement_band: string | null;
  figures_source: string;
  figures_measured_at: Date | null;
};

async function publicNetwork(
  tx: Tx,
  line: string,
): Promise<PublicNetwork | undefined> {
  const [row] = await tx<PublicNetwork[]>`
    select account_id::text, network_code, is_primary, audience_band, reach_band,
           publication_frequency_code, comment_band, engagement_band, figures_source,
           figures_measured_at
      from profiles.creator_public_networks where social_account_id = ${line}`;
  return row;
}

type Storefront = {
  residence_country_code: string;
  residence_region_code: string | null;
  main_audience_country: string | null;
  main_audience_share_band: string | null;
  audience_gender_band: string | null;
  availability_band: string | null;
  availability_declared_at: Date | null;
};

async function storefront(
  tx: Tx,
  account: string,
): Promise<Storefront | undefined> {
  const [row] = await tx<Storefront[]>`
    select residence_country_code, residence_region_code, main_audience_country,
           main_audience_share_band, audience_gender_band, availability_band,
           availability_declared_at
      from profiles.creator_public_profiles where account_id = ${account}`;
  return row;
}

async function publicAudience(tx: Tx, account: string): Promise<string[]> {
  const rows = await tx<{ entry: string }[]>`
    select dimension || ':' || bucket || ':' || share_band as entry
      from profiles.creator_public_audience where account_id = ${account}
     order by dimension, bucket`;
  return rows.map((row) => row.entry);
}

type HistoryRow = {
  followers_count: string | null;
  posts_last_30_days: number | null;
  avg_comments_per_post: string | null;
  figures_source: string;
  confirmed: boolean;
  recorded_by: string;
};

async function history(tx: Tx, line: string): Promise<HistoryRow[]> {
  return tx<HistoryRow[]>`
    select followers_count::text, posts_last_30_days, avg_comments_per_post::text,
           figures_source, confirmed, recorded_by_account_id::text as recorded_by
      from profiles.creator_network_metrics_history
     where social_account_id = ${line} order by id`;
}

const CONFIRM =
  "select profiles.confirm_own_creator_figures($1::uuid, $2::bigint, $3::integer, $4::bigint) as at";

// ---------------------------------------------------------------------------------------------
// The bound functions (EC-02-7, RG58, EC-L2D-05-2, 3)
// ---------------------------------------------------------------------------------------------

describe("the bound functions of the shares compare, bounds included (RG58)", () => {
  it("bands the share of another country or an age band, under 10 absent", async () => {
    const rows = await migration<{ share: number; band: string | null }[]>`
      select s.share, profiles.audience_share_band(s.share) as band
        from unnest(array[0, 9, 10, 24, 25, 50, 51, 100]) as s (share) order by s.share`;
    expect(rows.map((row) => [row.share, row.band])).toEqual([
      [0, null],
      [9, null],
      [10, "10_25"],
      [24, "10_25"],
      [25, "25_50"],
      [50, "25_50"],
      [51, "gt_50"],
      [100, "gt_50"],
    ]);
  });

  it("bands the share of the main country, ge_80 from 80, lt_50 under 50, null without one", async () => {
    const rows = await migration<{ band: string | null }[]>`
      select profiles.main_audience_share_band(s.share) as band
        from unnest(array[49, 50, 79, 80, null]::integer[]) with ordinality as s (share, n)
       order by s.n`;
    expect(rows.map((row) => row.band)).toEqual([
      "lt_50",
      "50_80",
      "50_80",
      "ge_80",
      null,
    ]);
  });

  it("bands the gender of the audience at 60 or more, mixed otherwise, null when undeclared", async () => {
    const [row] = await migration<Record<string, string | null>[]>`
      select profiles.audience_gender_band(60, 40) as female,
             profiles.audience_gender_band(59, 41) as mixed,
             profiles.audience_gender_band(0, 60) as male,
             profiles.audience_gender_band(null, null) as none`;
    expect(row).toEqual({
      female: "female_majority",
      mixed: "mixed",
      male: "male_majority",
      none: null,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D7: the follower band from the exact count (RG22, RG45, D79 (10))
// ---------------------------------------------------------------------------------------------

describe("L2D-D7: the follower and reach bands are derived from the exact figures", () => {
  it.each([
    [0, "nano"],
    [9999, "nano"],
    [10000, "micro"],
    [47312, "micro"],
    [49999, "micro"],
    [50000, "mid"],
    [500000, "macro"],
    [1000000, "mega"],
  ])("derives %i followers to %s", async (followers, band) => {
    const found = await scenario(async (tx) => {
      const line = await declareLine(tx, creatorA, { followers });
      return publicNetwork(tx, line);
    });
    expect(found).toMatchObject({
      account_id: creatorA,
      network_code: "youtube",
      is_primary: false,
      audience_band: band,
      figures_source: "declared",
      figures_measured_at: null,
    });
  });

  it("derives the reach band per publication from the same bounds, none without a value", async () => {
    const found = await scenario(async (tx) => {
      const withReach = await declareLine(tx, creatorA, { reach: 12000 });
      const without = await declareLine(tx, creatorA, {});
      return {
        withReach: await publicNetwork(tx, withReach),
        without: await publicNetwork(tx, without),
      };
    });
    expect(found.withReach).toMatchObject({
      reach_band: "micro",
      audience_band: null,
    });
    expect(found.without).toMatchObject({
      audience_band: null,
      reach_band: null,
      publication_frequency_code: null,
      comment_band: null,
    });
  });

  it("derives again when the creator corrects a figure (autosave)", async () => {
    const found = await scenario(async (tx) => {
      const before = await publicNetwork(tx, lineA);
      const updated = await asCreator(tx, creatorA, () =>
        run(
          tx,
          `update profiles.creator_social_accounts set followers_count = 600000
            where id = '${lineA}'`,
        ),
      );
      return { before, updated, after: await publicNetwork(tx, lineA) };
    });
    expect(found.before).toMatchObject({ audience_band: "micro" });
    expect(found.updated).toEqual(ACCEPTED_ONE);
    expect(found.after).toMatchObject({ audience_band: "macro" });
  });

  it("never derives an engagement band (RG48), and the base refuses one (23514)", async () => {
    const found = await scenario(async (tx) => {
      const line = await declareLine(tx, creatorA, {
        engagementBp: 900,
        followers: 1200,
      });
      return {
        row: await publicNetwork(tx, line),
        forced: await run(
          tx,
          `update profiles.creator_public_networks set engagement_band = '6_plus'
            where social_account_id = '${line}'`,
        ),
      };
    });
    expect(found.row).toMatchObject({
      engagement_band: null,
      audience_band: "nano",
    });
    expect(found.forced).toEqual(
      refusedBy(
        CHECK_VIOLATION,
        "creator_public_networks_engagement_unverified",
      ),
    );
  });

  it("lets the creator read his own derived rows only, never write them (42501)", async () => {
    const found = await scenario((tx) =>
      asCreator(tx, creatorA, async () => ({
        networks: await tx<{ account_id: string }[]>`
          select distinct account_id::text from profiles.creator_public_networks`,
        audience: await tx<{ account_id: string }[]>`
          select distinct account_id::text from profiles.creator_public_audience`,
        update: await run(
          tx,
          `update profiles.creator_public_networks set audience_band = 'mega'
            where social_account_id = '${lineA}'`,
        ),
        insert: await run(
          tx,
          `insert into profiles.creator_public_audience (account_id, dimension, bucket, share_band)
           values ('${creatorA}', 'age', '35_44', 'gt_50')`,
        ),
        delete: await run(
          tx,
          `delete from profiles.creator_public_audience where account_id = '${creatorA}'`,
        ),
      })),
    );
    expect(found.networks.map((row) => row.account_id)).toEqual([creatorA]);
    expect(found.audience.map((row) => row.account_id)).toEqual([creatorA]);
    expect(found.update).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(found.insert).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(found.delete).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });

  it("keeps the advertiser off the derived rows and the door (42501)", async () => {
    const found = await scenario((tx) =>
      actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        async () => ({
          networks: await run(
            tx,
            "select 1 from profiles.creator_public_networks",
          ),
          audience: await run(
            tx,
            "select 1 from profiles.creator_public_audience",
          ),
          door: await run(tx, CONFIRM, [lineA, 1, 1, 1]),
        }),
      ),
    );
    expect(found.networks).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(found.audience).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(found.door).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D8: the rhythm and the comments (RG114, RG115, RG117)
// ---------------------------------------------------------------------------------------------

describe("L2D-D8: the rhythm and the comment band are derived, never chosen", () => {
  it.each([
    [0, "monthly_or_less"],
    [1, "monthly_or_less"],
    [2, "biweekly"],
    [3, "biweekly"],
    [4, "weekly"],
    [7, "weekly"],
    [8, "several_per_week"],
    [14, "several_per_week"],
    [24, "several_per_week"],
    [25, "daily"],
  ])("derives %i publications over 30 days to %s", async (posts, code) => {
    const found = await scenario(async (tx) =>
      publicNetwork(tx, await declareLine(tx, creatorA, { posts })),
    );
    expect(found).toMatchObject({ publication_frequency_code: code });
  });

  it.each([
    [0, "0_9"],
    [9, "0_9"],
    [10, "10_49"],
    [35, "10_49"],
    [199, "50_199"],
    [200, "200_999"],
    [999, "200_999"],
    [1000, "1000_plus"],
  ])(
    "derives %i average comments to %s, served though declared (RG117)",
    async (comments, band) => {
      const found = await scenario(async (tx) =>
        publicNetwork(tx, await declareLine(tx, creatorA, { comments })),
      );
      expect(found).toMatchObject({
        comment_band: band,
        figures_source: "declared",
      });
    },
  );
});

// ---------------------------------------------------------------------------------------------
// L2D-D9: « Confirmer mes chiffres » and the date of the figures (RG50, RG116, EC-L2D-6)
// ---------------------------------------------------------------------------------------------

describe("L2D-D9: the date of the figures is set by the door alone, the three metrics together", () => {
  it("writes the three metrics, the source and the date of the caller's line, and returns the date", async () => {
    const found = await scenario(async (tx) => {
      const result = await asCreator(
        tx,
        creatorA,
        () =>
          tx<{ at: Date }[]>`select profiles.confirm_own_creator_figures(
            ${lineA}::uuid, 52000, 9, 210) as at`,
      );
      const [line] = await tx<
        {
          followers_count: string;
          posts_last_30_days: number;
          avg_comments_per_post: string;
          figures_source: string;
          figures_measured_at: Date;
          now: Date;
        }[]
      >`
        select followers_count::text, posts_last_30_days, avg_comments_per_post::text,
               figures_source, figures_measured_at, now() as now
          from profiles.creator_social_accounts where id = ${lineA}`;
      return {
        at: result[0]?.at,
        line,
        derived: await publicNetwork(tx, lineA),
      };
    });
    expect(found.line).toMatchObject({
      followers_count: "52000",
      posts_last_30_days: 9,
      avg_comments_per_post: "210",
      figures_source: "declared",
    });
    expect(found.at).toEqual(found.line?.now);
    expect(found.line?.figures_measured_at).toEqual(found.line?.now);
    expect(found.derived).toMatchObject({
      audience_band: "mid",
      publication_frequency_code: "several_per_week",
      comment_band: "200_999",
      figures_source: "declared",
      figures_measured_at: found.line?.now,
    });
  });

  it("accepts a null metric as not declared (Q15)", async () => {
    const found = await scenario(async (tx) => {
      const outcome = await asCreator(tx, creatorA, () =>
        run(tx, CONFIRM, [lineA, 47312, null, null]),
      );
      return { outcome, derived: await publicNetwork(tx, lineA) };
    });
    expect(found.outcome).toEqual(ACCEPTED_ONE);
    expect(found.derived).toMatchObject({
      audience_band: "micro",
      publication_frequency_code: null,
      comment_band: null,
    });
    expect(found.derived?.figures_measured_at).not.toBeNull();
  });

  it("leaves the date where it was when a figure alone changes (RG116)", async () => {
    const found = await scenario(async (tx) => {
      await asCreator(tx, creatorA, () =>
        run(tx, CONFIRM, [lineA, 47312, 14, 35]),
      );
      await tx`update profiles.creator_social_accounts
                  set figures_measured_at = figures_measured_at - interval '120 days'
                where id = ${lineA}`;
      const [before] = await tx<{ at: Date }[]>`
        select figures_measured_at as at from profiles.creator_social_accounts where id = ${lineA}`;
      await asCreator(tx, creatorA, () =>
        run(
          tx,
          `update profiles.creator_social_accounts set followers_count = 48000
            where id = '${lineA}'`,
        ),
      );
      const [after] = await tx<{ at: Date; source: string }[]>`
        select figures_measured_at as at, figures_source as source
          from profiles.creator_social_accounts where id = ${lineA}`;
      return {
        before: before?.at,
        after,
        derived: await publicNetwork(tx, lineA),
      };
    });
    expect(found.after?.at).toEqual(found.before);
    expect(found.after?.source).toBe("declared");
    expect(found.derived?.figures_measured_at).toEqual(found.before);
  });

  it("answers another creator's line as an unknown one, the same 42501 'forbidden'", async () => {
    const found = await scenario((tx) =>
      asCreator(tx, creatorA, async () => ({
        other: await run(tx, CONFIRM, [lineB, 1, 1, 1]),
        unknown: await run(tx, CONFIRM, [
          "00000000-0000-4000-8000-00000000dead",
          1,
          1,
          1,
        ]),
      })),
    );
    expect(found.other).toEqual({
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
      constraint: undefined,
      message: "forbidden",
    });
    expect(found.unknown).toEqual(found.other);
  });

  it("refuses a negative figure (23514) and an agent (42501)", async () => {
    const found = await scenario(async (tx) => ({
      negative: await asCreator(tx, creatorA, () =>
        run(tx, CONFIRM, [lineA, -1, 1, 1]),
      ),
      agent: await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal2" },
        () => run(tx, CONFIRM, [lineA, 1, 1, 1]),
      ),
    }));
    expect(found.negative).toEqual(
      refusedBy(CHECK_VIOLATION, "creator_social_accounts_followers_count"),
    );
    expect(found.agent).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D10: the sum of a dimension, 100 at most (RG57)
// ---------------------------------------------------------------------------------------------

describe("L2D-D10: the shares of one dimension never exceed 100, a remainder is never filled", () => {
  it.each([
    [
      "countries",
      `insert into profiles.creator_audience_countries
         (social_account_id, account_id, slot, country_code, share_percent)
       values ('${lineA}', '${creatorA}', 1, 'BE', 28)`,
      `insert into profiles.creator_audience_countries
         (social_account_id, account_id, slot, country_code, share_percent)
       values ('${lineA}', '${creatorA}', 1, 'BE', 29)`,
      "creator_audience_countries_share_sum",
    ],
    [
      "ages",
      `insert into profiles.creator_audience_ages
         (social_account_id, account_id, age_band_code, share_percent)
       values ('${lineA}', '${creatorA}', '25_34', 60)`,
      `insert into profiles.creator_audience_ages
         (social_account_id, account_id, age_band_code, share_percent)
       values ('${lineA}', '${creatorA}', '25_34', 61)`,
      "creator_audience_ages_share_sum",
    ],
    [
      "genders",
      `insert into profiles.creator_audience_genders
         (social_account_id, account_id, gender_code, share_percent)
       values ('${lineA}', '${creatorA}', 'male', 39)`,
      `insert into profiles.creator_audience_genders
         (social_account_id, account_id, gender_code, share_percent)
       values ('${lineA}', '${creatorA}', 'male', 40)`,
      "creator_audience_genders_share_sum",
    ],
  ])(
    "%s: 100 accepted, 101 refused at the check (23514)",
    async (_dimension, exact, over, name) => {
      const accepted = await scenario((tx) =>
        asCreator(tx, creatorA, async () => ({
          insert: await run(tx, exact),
          check: await run(tx, "set constraints all immediate"),
        })),
      );
      const refused = await scenario((tx) =>
        asCreator(tx, creatorA, async () => ({
          insert: await run(tx, over),
          check: await run(tx, "set constraints all immediate"),
        })),
      );
      expect(accepted).toEqual({
        insert: ACCEPTED_ONE,
        check: { outcome: "rows", count: 0 },
      });
      expect(refused.insert).toEqual(ACCEPTED_ONE);
      expect(refused.check).toEqual(refusedBy(CHECK_VIOLATION, name));
    },
  );

  it("accepts 60 and adds no remainder row; a list replaced in one transaction is judged at the end", async () => {
    const found = await scenario(async (tx) => {
      const outcomes = await asCreator(tx, creatorA, async () => ({
        removed: await run(
          tx,
          `delete from profiles.creator_audience_ages where social_account_id = '${lineA}'`,
        ),
        first: await run(
          tx,
          `insert into profiles.creator_audience_ages
             (social_account_id, account_id, age_band_code, share_percent)
           values ('${lineA}', '${creatorA}', '18_24', 70)`,
        ),
        replaced: await run(
          tx,
          `delete from profiles.creator_audience_ages where social_account_id = '${lineA}'`,
        ),
        sixty: await run(
          tx,
          `insert into profiles.creator_audience_ages
             (social_account_id, account_id, age_band_code, share_percent)
           values ('${lineA}', '${creatorA}', '25_34', 35), ('${lineA}', '${creatorA}', '35_44', 25)`,
        ),
        check: await run(tx, "set constraints all immediate"),
      }));
      const rows = await tx<{ code: string; share: number }[]>`
        select age_band_code as code, share_percent as share from profiles.creator_audience_ages
         where social_account_id = ${lineA} order by age_band_code`;
      return { outcomes, rows, audience: await publicAudience(tx, creatorA) };
    });
    expect(found.outcomes.check).toEqual({ outcome: "rows", count: 0 });
    expect(found.rows).toEqual([
      { code: "25_34", share: 35 },
      { code: "35_44", share: 25 },
    ]);
    expect(found.audience).toEqual(["age:25_34:25_50", "age:35_44:25_50"]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D11: the history of the three metrics, append-only (RG119)
// ---------------------------------------------------------------------------------------------

describe("L2D-D11: every entry and every confirmation of the three metrics is historised", () => {
  it("writes an entry at the declaration, at a change, a confirmation at the door, nothing for a handle", async () => {
    const found = await scenario(async (tx) => {
      const line = await declareLine(tx, creatorA, {
        followers: 1500,
        posts: 4,
      });
      await asCreator(tx, creatorA, async () => {
        await run(
          tx,
          `update profiles.creator_social_accounts set handle = 'l2d05_handle' where id = '${line}'`,
        );
        await run(
          tx,
          `update profiles.creator_social_accounts set avg_comments_per_post = 12
            where id = '${line}'`,
        );
        await run(tx, CONFIRM, [line, 1600, 5, 12]);
      });
      return history(tx, line);
    });
    expect(found).toEqual([
      {
        followers_count: "1500",
        posts_last_30_days: 4,
        avg_comments_per_post: null,
        figures_source: "declared",
        confirmed: false,
        recorded_by: creatorA,
      },
      {
        followers_count: "1500",
        posts_last_30_days: 4,
        avg_comments_per_post: "12",
        figures_source: "declared",
        confirmed: false,
        recorded_by: creatorA,
      },
      {
        followers_count: "1600",
        posts_last_30_days: 5,
        avg_comments_per_post: "12",
        figures_source: "declared",
        confirmed: true,
        recorded_by: creatorA,
      },
    ]);
  });

  it("writes nothing for a line declared without any figure, nor for an unchanged figure", async () => {
    const found = await scenario(async (tx) => {
      const line = await declareLine(tx, creatorA, { handle: "l2d05_empty" });
      const unchanged = await asCreator(tx, creatorA, () =>
        run(
          tx,
          `update profiles.creator_social_accounts set followers_count = followers_count
            where id = '${lineA}'`,
        ),
      );
      const [count] = await tx<{ count: number }[]>`
        select count(*)::int as count from profiles.creator_network_metrics_history
         where social_account_id = ${lineA}`;
      return { rows: await history(tx, line), unchanged, count: count?.count };
    });
    expect(found.rows).toEqual([]);
    expect(found.unchanged).toEqual(ACCEPTED_ONE);
    // the data set's row only (inserted by its declaration, or by the data set on an older stack)
    expect(found.count).toBe(1);
  });

  it("keeps the rows of a removed line, and nobody but the erasure rewrites them", async () => {
    const found = await scenario(async (tx) => {
      const line = await declareLine(tx, creatorA, { followers: 10 });
      await asCreator(tx, creatorA, () =>
        run(
          tx,
          `delete from profiles.creator_social_accounts where id = '${line}'`,
        ),
      );
      return {
        rows: await history(tx, line),
        update: await run(
          tx,
          `update profiles.creator_network_metrics_history set confirmed = true
            where social_account_id = '${line}'`,
        ),
      };
    });
    expect(found.rows).toHaveLength(1);
    expect(found.update).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D12: the country of residence copied from the account, whatever writes it (RG36)
// ---------------------------------------------------------------------------------------------

describe("L2D-D12: the storefront takes the country of the account and loses its region", () => {
  async function withRegion(tx: Tx): Promise<void> {
    await asCreator(tx, creatorA, () =>
      run(
        tx,
        `update profiles.creator_public_profiles set residence_region_code = 'FR-ARA'
          where account_id = '${creatorA}'`,
      ),
    );
  }

  it("by the creator's own account door (identity.update_own_account)", async () => {
    const found = await scenario(async (tx) => {
      await withRegion(tx);
      const before = await storefront(tx, creatorA);
      const changed = await asCreator(tx, creatorA, () =>
        run(tx, "select identity.update_own_account('BE', null, null, null)"),
      );
      return { before, changed, after: await storefront(tx, creatorA) };
    });
    expect(found.before).toMatchObject({
      residence_country_code: "FR",
      residence_region_code: "FR-ARA",
    });
    expect(found.changed).toEqual(ACCEPTED_ONE);
    expect(found.after).toMatchObject({
      residence_country_code: "BE",
      residence_region_code: null,
    });
  });

  it("by the correction of an agent (identity.correct_member_account)", async () => {
    const found = await scenario(async (tx) => {
      await withRegion(tx);
      const changed = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal2" },
        () =>
          run(
            tx,
            "select identity.correct_member_account($1::uuid, 'signup_error', null, 'DE', null, null)",
            [creatorA],
          ),
      );
      return { changed, after: await storefront(tx, creatorA) };
    });
    expect(found.changed).toEqual(ACCEPTED_ONE);
    expect(found.after).toMatchObject({
      residence_country_code: "DE",
      residence_region_code: null,
    });
  });

  it("by any other writer, and keeps the region when the country does not change", async () => {
    const found = await scenario(async (tx) => {
      await withRegion(tx);
      await tx`update identity.accounts set country_code = 'FR', preferred_language = 'en'
                where id = ${creatorA}`;
      const kept = await storefront(tx, creatorA);
      await tx`update identity.accounts set country_code = 'GB' where id = ${creatorA}`;
      return { kept, moved: await storefront(tx, creatorA) };
    });
    expect(found.kept).toMatchObject({
      residence_country_code: "FR",
      residence_region_code: "FR-ARA",
    });
    expect(found.moved).toMatchObject({
      residence_country_code: "GB",
      residence_region_code: null,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D13: the audience of the storefront is that of the primary line (EC-L2D-9)
// ---------------------------------------------------------------------------------------------

describe("L2D-D13: a change of primary line derives the storefront again", () => {
  it("derives the main country, the gender band and the audience bands from the primary line", async () => {
    const found = await scenario(async (tx) => {
      await asCreator(tx, creatorA, async () => {
        await run(
          tx,
          `insert into profiles.creator_audience_countries
             (social_account_id, account_id, slot, country_code, share_percent)
           values ('${lineA}', '${creatorA}', 1, 'BE', 15), ('${lineA}', '${creatorA}', 2, 'CH', 10)`,
        );
        await run(
          tx,
          `insert into profiles.creator_audience_ages
             (social_account_id, account_id, age_band_code, share_percent)
           values ('${lineA}', '${creatorA}', '25_34', 51), ('${lineA}', '${creatorA}', '35_44', 9)`,
        );
      });
      const before = await storefront(tx, creatorA);
      await asCreator(tx, creatorA, async () => {
        await run(
          tx,
          `delete from profiles.creator_audience_genders where social_account_id = '${lineA}'`,
        );
        await run(
          tx,
          `insert into profiles.creator_audience_genders
             (social_account_id, account_id, gender_code, share_percent)
           values ('${lineA}', '${creatorA}', 'male', 45), ('${lineA}', '${creatorA}', 'other', 10)`,
        );
      });
      return {
        front: before,
        mixed: (await storefront(tx, creatorA))?.audience_gender_band,
        audience: await publicAudience(tx, creatorA),
      };
    });
    expect(found.front).toMatchObject({
      main_audience_country: "FR",
      main_audience_share_band: "50_80",
      audience_gender_band: "female_majority",
    });
    expect(found.mixed).toBe("mixed");
    expect(found.audience).toEqual([
      "age:18_24:25_50",
      "age:25_34:gt_50",
      "country:BE:10_25",
      "country:CH:10_25",
    ]);
  });

  it("ignores the audience of another line, follows the new primary one, empties with its removal", async () => {
    const found = await scenario(async (tx) => {
      const second = await declareLine(tx, creatorA, { followers: 120000 });
      await asCreator(tx, creatorA, async () => {
        await run(
          tx,
          `insert into profiles.creator_audience_countries
             (social_account_id, account_id, slot, country_code, share_percent)
           values ('${second}', '${creatorA}', 0, 'BE', 85)`,
        );
        await run(
          tx,
          `insert into profiles.creator_audience_ages
             (social_account_id, account_id, age_band_code, share_percent)
           values ('${second}', '${creatorA}', '35_44', 30), ('${second}', '${creatorA}', '45_plus', 8)`,
        );
        await run(
          tx,
          `insert into profiles.creator_audience_genders
             (social_account_id, account_id, gender_code, share_percent)
           values ('${second}', '${creatorA}', 'male', 70), ('${second}', '${creatorA}', 'female', 30)`,
        );
      });
      const untouched = await storefront(tx, creatorA);
      await asCreator(tx, creatorA, async () => {
        await run(
          tx,
          `update profiles.creator_social_accounts set is_primary = false where id = '${lineA}'`,
        );
        await run(
          tx,
          `update profiles.creator_social_accounts set is_primary = true where id = '${second}'`,
        );
      });
      const switched = {
        front: await storefront(tx, creatorA),
        audience: await publicAudience(tx, creatorA),
        old: (await publicNetwork(tx, lineA))?.is_primary,
        new: (await publicNetwork(tx, second))?.is_primary,
      };
      await asCreator(tx, creatorA, () =>
        run(
          tx,
          `delete from profiles.creator_social_accounts where id = '${second}'`,
        ),
      );
      return {
        untouched,
        switched,
        removed: {
          front: await storefront(tx, creatorA),
          audience: await publicAudience(tx, creatorA),
          row: await publicNetwork(tx, second),
        },
      };
    });
    expect(found.untouched).toMatchObject({
      main_audience_country: "FR",
      audience_gender_band: "female_majority",
    });
    expect(found.switched).toEqual({
      front: expect.objectContaining({
        main_audience_country: "BE",
        main_audience_share_band: "ge_80",
        audience_gender_band: "male_majority",
      }),
      audience: ["age:35_44:25_50"],
      old: false,
      new: true,
    });
    expect(found.removed).toEqual({
      front: expect.objectContaining({
        main_audience_country: null,
        main_audience_share_band: null,
        audience_gender_band: null,
      }),
      audience: [],
      row: undefined,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// The guard of the storefront (modele.md « Droits », EC-L2D-05-6, 9)
// ---------------------------------------------------------------------------------------------

describe("the guard of the storefront: the date of availability, the reach of the definer", () => {
  it("sets the date of availability with its band, keeps it otherwise, clears it with the band", async () => {
    const found = await scenario(async (tx) => {
      const steps: (Date | null | undefined)[] = [];
      for (const assignment of [
        "availability_band = 'full'",
        "headline = 'Cuisine du marché'",
        "availability_band = null",
      ]) {
        await asCreator(tx, creatorA, () =>
          run(
            tx,
            `update profiles.creator_public_profiles set ${assignment}
              where account_id = '${creatorA}'`,
          ),
        );
        steps.push((await storefront(tx, creatorA))?.availability_declared_at);
        if (steps.length === 1) {
          await tx`update profiles.creator_public_profiles
                      set availability_declared_at = now() - interval '3 days'
                    where account_id = ${creatorA}`;
          steps[0] = (await storefront(tx, creatorA))?.availability_declared_at;
        }
      }
      return steps;
    });
    expect(found[0]).toBeInstanceOf(Date);
    expect(found[1]).toEqual(found[0]);
    expect(found[2]).toBeNull();
  });

  it("bounds influx_identity_definer to the residence on a row that is not the session's own (42501)", async () => {
    const found = await scenario(async (tx) => {
      await tx.unsafe("set local role influx_identity_definer");
      await tx`select set_config('influx.account', ${creatorB}, true)`;
      const outcomes = {
        derived: await run(
          tx,
          `update profiles.creator_public_profiles set main_audience_country = 'DE'
            where account_id = '${creatorA}'`,
        ),
        residence: await run(
          tx,
          `update profiles.creator_public_profiles
              set residence_country_code = 'BE', residence_region_code = null
            where account_id = '${creatorA}'`,
        ),
        own: await run(
          tx,
          `update profiles.creator_public_profiles set main_audience_country = 'DE'
            where account_id = '${creatorB}'`,
        ),
      };
      await tx.unsafe("reset role");
      return outcomes;
    });
    expect(found).toEqual({
      derived: refusedBy(INSUFFICIENT_PRIVILEGE),
      residence: ACCEPTED_ONE,
      own: ACCEPTED_ONE,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// The reprise, and the bands by comparison only (T16.1 in the base)
// ---------------------------------------------------------------------------------------------

describe("the reprise and the derivations", () => {
  it("replays the reprise as influx_identity_definer without changing any derived row", async () => {
    const found = await scenario(async (tx) => {
      const snapshot = async () =>
        tx<{ entry: string }[]>`
          select n.social_account_id || ':' || coalesce(n.audience_band, '-') || ':'
                 || coalesce(n.publication_frequency_code, '-') || ':'
                 || coalesce(n.comment_band, '-') as entry
            from profiles.creator_public_networks n
           where n.account_id in (${creatorA}, ${creatorB}) order by 1`;
      const before = await snapshot();
      await tx`delete from profiles.creator_public_networks where social_account_id = ${lineB}`;
      await tx.unsafe("set local role influx_identity_definer");
      await tx.unsafe(REPRISE_SQL);
      await tx.unsafe("reset role");
      return {
        before,
        after: await snapshot(),
        audienceA: await publicAudience(tx, creatorA),
      };
    });
    expect(found.before).toHaveLength(2);
    expect(found.after).toEqual(found.before);
    expect(found.audienceA).toEqual(["age:18_24:25_50"]);
  });

  it("derives by comparison only: no multiplication nor division in any function of 0218 (T16.1)", async () => {
    const rows = await migration<{ name: string; source: string }[]>`
      select p.proname as name, p.prosrc as source
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'profiles'
         and p.proname in ('audience_share_band', 'main_audience_share_band',
                           'audience_gender_band', 'refresh_creator_public_network',
                           'refresh_creator_public_audience', 'derive_creator_public_network',
                           'derive_creator_public_audience', 'record_creator_metrics_history',
                           'copy_creator_residence_country', 'confirm_own_creator_figures',
                           'guard_creator_public_profile_write', 'check_creator_audience_sum')
       order by 1`;
    expect(rows).toHaveLength(12);
    const arithmetic = rows.filter(({ source }) =>
      /[*/]/.test(
        source
          .replace(/--[^\n]*/g, "")
          .replace(/count\(\*\)/g, "")
          .replace(/'[^']*'/g, "''"),
      ),
    );
    expect(arithmetic.map((row) => row.name)).toEqual([]);
  });

  it("hands every derivation to influx_identity_definer, the door to influx_creator alone", async () => {
    const rows = await migration<
      { name: string; owner: string; definer: boolean }[]
    >`
      select p.oid::regprocedure::text as name, pg_get_userbyid(p.proowner) as owner,
             p.prosecdef as definer
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'profiles' and p.prosecdef
         and p.proname in ('refresh_creator_public_network', 'refresh_creator_public_audience',
                           'derive_creator_public_network', 'derive_creator_public_audience',
                           'record_creator_metrics_history', 'copy_creator_residence_country',
                           'confirm_own_creator_figures')
       order by 1`;
    expect(rows).toHaveLength(7);
    expect(new Set(rows.map((row) => row.owner))).toEqual(
      new Set(["influx_identity_definer"]),
    );
    const [door] = await migration<{ creator: boolean; agent: boolean }[]>`
      select has_function_privilege('influx_creator',
               'profiles.confirm_own_creator_figures(uuid, bigint, integer, bigint)', 'EXECUTE') as creator,
             has_function_privilege('influx_agent',
               'profiles.confirm_own_creator_figures(uuid, bigint, integer, bigint)', 'EXECUTE') as agent`;
    expect(door).toEqual({ creator: true, agent: false });
  });
});
