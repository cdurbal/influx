// L2E commit 09 — the observed figures feed the public bands, 0225 (jalons/l2e/09.md; l2e/modele.md
// §1 point 4, §4 "Dérivation"; fiche invariant 8; 08 RG19, RG20, RG39 to RG41, RG48, CA9, CA10, CA26;
// 07 RG119; L2DS-2): L2E-D19 the bands of the observed figures (47 300 → micro), L2E-D20 a creator
// write after the observation changes no public value, L2E-D21 no engagement band without an
// observation, L2E-D22 the history row of the decision; plus the return to the declared prepared for
// L2F, the change of primary line, the reprise and the rights of the derivation. Each case runs in a
// rolled-back transaction of the local superuser, the functions called as apps/api calls them.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
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
const agentA = accountIdOf("agent", "a");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;

const MIGRATION = readFileSync(
  fileURLToPath(
    new URL(
      "../../../supabase/migrations/0225_profiles_observed_figures_bands.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

/** The reprise of 0225 §6, replayed as written (between its two markers). */
const REPRISE_SQL = (() => {
  const start = MIGRATION.indexOf("-- <reprise>");
  const end = MIGRATION.indexOf("-- </reprise>");
  if (start < 0 || end < start) {
    throw new Error("the reprise markers of 0225 are missing");
  }
  return MIGRATION.slice(start, end);
})();

type Parameter = postgres.ParameterOrJSON<never> | null | undefined;
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
  parameters: readonly Parameter[] = [],
): Promise<Outcome> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
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

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function asAgent<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: agentA, role: "agent", aal: "aal2" },
    fn,
  );
}

function asCreator<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: creatorA, role: "creator", aal: "aal1" },
    fn,
  );
}

const OPEN = "select * from verification.open_request($1::uuid)";
const GRANT_ACCOUNT =
  "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)";
const GRANT_AUDIENCE =
  "select * from verification.grant_audience_verified($1::uuid, $2::text, $3::bigint, $4::integer, $5::bigint, $6::integer, $7::date, $8::date, $9::text, $10::text)";
const CONFIRM =
  "select profiles.confirm_own_creator_figures($1::uuid, $2::bigint, $3::integer, $4::bigint) as at";

/** The UTC date `days` days from today, as the agent types it. */
function day(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** A pending request of creator A on line A (as the doors of 0222 leave it), and its code. */
async function pendingRequest(
  tx: Tx,
  level: "account_verified" | "audience_verified",
): Promise<{ request: string; code: string }> {
  const code = `INFLUX-${randomUUID()
    .replace(/[^2-9]/g, "")
    .padEnd(8, "2")
    .slice(0, 8)}`;
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${creatorA}, ${lineA}, 'instagram', ${level}::verification.badge_level, 'pending')
    returning id::text as id`;
  if (row === undefined) throw new Error("no request");
  if (level === "account_verified") {
    await tx`
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (${row.id}, ${creatorA}, 'network', ${code}, now() + interval '7 days')`;
  }
  return { request: row.id, code };
}

/** Agent A opens `request` and returns its review token. */
async function claim(tx: Tx, request: string): Promise<string> {
  const [opened] = await asAgent(tx, () =>
    tx.unsafe<{ review_token: string | null }[]>(OPEN, [request]),
  );
  if (opened?.review_token == null) throw new Error("not claimed");
  return opened.review_token;
}

type Observed = {
  followers: number;
  posts: number;
  comments: number;
  engagementBp: number | null;
};

const OBSERVED: Observed = {
  followers: 47_300,
  posts: 3,
  comments: 250,
  engagementBp: 350,
};

/** Line A declared at 120 000 followers (mid), 14 posts, 35 comments, a reach of 12 000, 9 %. */
async function declareLineA(tx: Tx): Promise<void> {
  await tx`
    update profiles.creator_social_accounts
       set followers_count = 120000, posts_last_30_days = 14, avg_comments_per_post = 35,
           avg_reach_per_post = 12000, engagement_rate_bp = 900
     where id = ${lineA}`;
}

/** declareLineA(), then observeLineA(): the line observed. Returns the audience badge. */
async function observedLineA(
  tx: Tx,
  observed: Observed = OBSERVED,
): Promise<string> {
  await declareLineA(tx);
  return observeLineA(tx, observed);
}

/**
 * « Compte vérifié » then « Audience vérifiée » on line A, granted by agent A through the functions,
 * with `observed`. Returns the audience badge.
 */
async function observeLineA(
  tx: Tx,
  observed: Observed = OBSERVED,
): Promise<string> {
  const ownership = await pendingRequest(tx, "account_verified");
  const ownershipToken = await claim(tx, ownership.request);
  await asAgent(tx, () =>
    tx.unsafe(GRANT_ACCOUNT, [
      ownership.request,
      ownershipToken,
      ownership.code,
      "t2_creator_a",
      null,
      null,
    ]),
  );
  const { request } = await pendingRequest(tx, "audience_verified");
  await tx`
    insert into verification.evidence_files
      (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
       activated_at, retention_due_at)
    values (${request}, ${creatorA}, 'active', 500000, 400000, 1290, 2796,
            sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')`;
  const token = await claim(tx, request);
  const [granted] = await asAgent(tx, () =>
    tx.unsafe<{ outcome: string; badge_id: string | null }[]>(GRANT_AUDIENCE, [
      request,
      token,
      observed.followers,
      observed.posts,
      observed.comments,
      observed.engagementBp,
      day(-20),
      day(-1),
      "t2_creator_a",
      null,
    ]),
  );
  if (granted?.badge_id == null)
    throw new Error(`not granted: ${granted?.outcome}`);
  return granted.badge_id;
}

type PublicNetwork = {
  is_primary: boolean;
  audience_band: string | null;
  reach_band: string | null;
  publication_frequency_code: string | null;
  comment_band: string | null;
  engagement_band: string | null;
  figures_source: string;
  figures_measured_at: Date | null;
};

async function publicNetwork(tx: Tx, line: string): Promise<PublicNetwork> {
  const [row] = await tx<PublicNetwork[]>`
    select is_primary, audience_band, reach_band, publication_frequency_code, comment_band,
           engagement_band, figures_source, figures_measured_at
      from profiles.creator_public_networks where social_account_id = ${line}`;
  if (row === undefined) throw new Error("no public row");
  return row;
}

type DeclaredLine = {
  followers_count: string | null;
  posts_last_30_days: number | null;
  avg_comments_per_post: string | null;
  engagement_rate_bp: number | null;
  figures_source: string;
  figures_measured_at: Date | null;
};

async function declaredLine(tx: Tx, line: string): Promise<DeclaredLine> {
  const [row] = await tx<DeclaredLine[]>`
    select followers_count::text, posts_last_30_days, avg_comments_per_post::text,
           engagement_rate_bp, figures_source, figures_measured_at
      from profiles.creator_social_accounts where id = ${line}`;
  if (row === undefined) throw new Error("no line");
  return row;
}

async function grantedAt(tx: Tx, badge: string): Promise<Date> {
  const [row] = await tx<{ granted_at: Date }[]>`
    select granted_at from verification.badges where id = ${badge}`;
  if (row === undefined) throw new Error("no badge");
  return row.granted_at;
}

const OBSERVED_BANDS = {
  audience_band: "micro",
  publication_frequency_code: "biweekly",
  comment_band: "200_999",
  engagement_band: "3_6",
  figures_source: "agent_observed",
};

const DECLARED_BANDS = {
  audience_band: "mid",
  reach_band: "micro",
  publication_frequency_code: "several_per_week",
  comment_band: "10_49",
  engagement_band: null,
  figures_source: "declared",
};

let migration: postgres.Sql;

beforeAll(async () => {
  await testDataSet();
  migration = migrationRole();
});

// ---------------------------------------------------------------------------------------------
// L2E-D19: the bands of the observed figures (08 RG20, CA10; 07 RG22, RG114, RG115)
// ---------------------------------------------------------------------------------------------

describe("L2E-D19: the public bands are derived from the observed figures of the badge", () => {
  it("derives 47 300 observed followers to micro (CA10), the rhythm, the comments and the engagement, dated by the decision", async () => {
    const found = await scenario(async (tx) => {
      await declareLineA(tx);
      const before = await publicNetwork(tx, lineA);
      const badge = await observeLineA(tx);
      return {
        before,
        after: await publicNetwork(tx, lineA),
        grantedAt: await grantedAt(tx, badge),
      };
    });
    expect(found.before).toMatchObject(DECLARED_BANDS);
    expect(found.after).toMatchObject({
      ...OBSERVED_BANDS,
      // RG39: the reach is never observed, its band stays the declared one
      reach_band: "micro",
      is_primary: true,
    });
    expect(found.after.figures_measured_at?.getTime()).toBe(
      found.grantedAt.getTime(),
    );
  });

  it("keeps the declared figures of the line, unlabelled and unchanged (CA26, RG40)", async () => {
    const found = await scenario(async (tx) => {
      await declareLineA(tx);
      const before = await declaredLine(tx, lineA);
      await observeLineA(tx);
      return { before, after: await declaredLine(tx, lineA) };
    });
    expect(found.after).toEqual(found.before);
    expect(found.after).toMatchObject({
      followers_count: "120000",
      posts_last_30_days: 14,
      avg_comments_per_post: "35",
      engagement_rate_bp: 900,
      figures_source: "declared",
    });
  });

  it("writes no exact value in any creator_public_* object: codes, a boolean and dates only", async () => {
    const columns = await migration<{ table: string; type: string }[]>`
      select c.relname as table, format_type(a.atttypid, a.atttypmod) as type
        from pg_catalog.pg_attribute a
        join pg_catalog.pg_class c on c.oid = a.attrelid
       where c.relnamespace = 'profiles'::regnamespace
         and c.relname in ('creator_public_networks', 'creator_public_audience')
         and a.attnum > 0 and not a.attisdropped
         and format_type(a.atttypid, a.atttypmod) not in
             ('uuid', 'text', 'boolean', 'timestamp with time zone')`;
    expect(columns).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// L2E-D20: a creator write after the observation (L2DS-2, fiche invariant 8)
// ---------------------------------------------------------------------------------------------

describe("L2E-D20: a creator write changes no public value while the audience badge holds (L2DS-2)", () => {
  it("records the autosave as declared and leaves the observed bands, their source and date", async () => {
    const found = await scenario(async (tx) => {
      await observedLineA(tx);
      const observed = await publicNetwork(tx, lineA);
      const autosave = await asCreator(tx, () =>
        run(
          tx,
          `update profiles.creator_social_accounts
              set followers_count = 500000, posts_last_30_days = 30, avg_comments_per_post = 5,
                  engagement_rate_bp = 1200
            where id = '${lineA}'`,
        ),
      );
      const afterAutosave = await publicNetwork(tx, lineA);
      const confirmed = await asCreator(tx, () =>
        run(tx, CONFIRM, [lineA, 600000, 31, 6]),
      );
      return {
        observed,
        autosave,
        afterAutosave,
        confirmed,
        afterConfirm: await publicNetwork(tx, lineA),
        line: await declaredLine(tx, lineA),
      };
    });
    expect(found.autosave).toEqual(ACCEPTED_ONE);
    expect(found.confirmed).toEqual(ACCEPTED_ONE);
    expect(found.afterAutosave).toEqual(found.observed);
    expect(found.afterConfirm).toEqual(found.observed);
    expect(found.observed).toMatchObject(OBSERVED_BANDS);
    // the declared value stays recorded beside the observed one (RG40)
    expect(found.line).toMatchObject({
      followers_count: "600000",
      posts_last_30_days: 31,
      avg_comments_per_post: "6",
      engagement_rate_bp: 1200,
      figures_source: "declared",
    });
  });

  it("never lets an observed source onto the declared line: 42501 for the creator, 23514 for anyone", async () => {
    const found = await scenario(async (tx) => {
      await observedLineA(tx);
      return {
        creator: await asCreator(tx, () =>
          run(
            tx,
            `update profiles.creator_social_accounts set figures_source = 'agent_observed'
              where id = '${lineA}'`,
          ),
        ),
        owner: await run(
          tx,
          `update profiles.creator_social_accounts set figures_source = 'agent_observed'
            where id = '${lineA}'`,
        ),
      };
    });
    expect(found.creator).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    expect(found.owner).toEqual(
      refusedBy(CHECK_VIOLATION, "creator_social_accounts_figures_source"),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L2E-D21: no engagement band without an observation (07 RG48, 08 CA9, EC-L2E-12)
// ---------------------------------------------------------------------------------------------

describe("L2E-D21: the engagement band is null without an observed engagement (RG48, CA9)", () => {
  it("leaves it null for a declared engagement, and for an audience badge granted without one", async () => {
    const found = await scenario(async (tx) => {
      await tx`
        update profiles.creator_social_accounts set engagement_rate_bp = 900
         where id = ${lineA}`;
      const declared = await publicNetwork(tx, lineA);
      await observedLineA(tx, { ...OBSERVED, engagementBp: null });
      return { declared, observed: await publicNetwork(tx, lineA) };
    });
    expect(found.declared).toMatchObject({
      engagement_band: null,
      figures_source: "declared",
    });
    expect(found.observed).toMatchObject({
      ...OBSERVED_BANDS,
      engagement_band: null,
    });
  });

  it("refuses an engagement band on a declared row, and an observed row without its date (23514)", async () => {
    const found = await scenario(async (tx) => ({
      band: await run(
        tx,
        `update profiles.creator_public_networks set engagement_band = '3_6'
          where social_account_id = '${lineA}'`,
      ),
      undated: await run(
        tx,
        `update profiles.creator_public_networks
            set figures_source = 'agent_observed', figures_measured_at = null
          where social_account_id = '${lineA}'`,
      ),
    }));
    expect(found.band).toEqual(
      refusedBy(
        CHECK_VIOLATION,
        "creator_public_networks_engagement_unverified",
      ),
    );
    expect(found.undated).toEqual(
      refusedBy(CHECK_VIOLATION, "creator_public_networks_observed_dated"),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L2E-D22: the history row of the decision (07 RG119)
// ---------------------------------------------------------------------------------------------

describe("L2E-D22: the decision historises the observed figures, by the agent (RG119)", () => {
  it("appends one agent_observed confirmation with the typed figures, then the creator's entries as declared", async () => {
    const found = await scenario(async (tx) => {
      const [mark] = await tx<{ id: string }[]>`
        select coalesce(max(id), 0)::text as id from profiles.creator_network_metrics_history`;
      await observedLineA(tx);
      await asCreator(tx, () =>
        run(
          tx,
          `update profiles.creator_social_accounts set followers_count = 500000
            where id = '${lineA}'`,
        ),
      );
      return tx<
        {
          followers: string;
          posts: number;
          comments: string;
          source: string;
          confirmed: boolean;
          author: string;
        }[]
      >`
        select followers_count::text as followers, posts_last_30_days as posts,
               avg_comments_per_post::text as comments, figures_source as source, confirmed,
               recorded_by_account_id::text as author
          from profiles.creator_network_metrics_history
         where social_account_id = ${lineA} and id > ${mark?.id ?? "0"}::bigint
         order by id`;
    });
    // the declaration of the fixture (superuser, no session: the creator as author), the
    // observation, then the creator's autosave
    expect(found.slice(-2)).toEqual([
      {
        followers: "47300",
        posts: 3,
        comments: "250",
        source: "agent_observed",
        confirmed: true,
        author: agentA,
      },
      {
        followers: "500000",
        posts: 14,
        comments: "35",
        source: "declared",
        confirmed: false,
        author: creatorA,
      },
    ]);
    expect(found.filter((row) => row.source === "agent_observed")).toHaveLength(
      1,
    );
  });
});

// ---------------------------------------------------------------------------------------------
// The return to the declared (L2F), the primary line, the reprise, the rights
// ---------------------------------------------------------------------------------------------

describe("the derivation follows the holding badge only (EC-L2E-09-2, -3)", () => {
  it("keeps the observed bands at to_refresh, returns to the declared once the badge has ended", async () => {
    const found = await scenario(async (tx) => {
      const badge = await observedLineA(tx);
      const lineDate = (await declaredLine(tx, lineA)).figures_measured_at;
      await tx`update verification.badges set state = 'to_refresh' where id = ${badge}`;
      await tx`select profiles.refresh_creator_public_network(${lineA}::uuid)`;
      const toRefresh = await publicNetwork(tx, lineA);
      await tx`update verification.badges set state = 'expired' where id = ${badge}`;
      await tx`select profiles.refresh_creator_public_network(${lineA}::uuid)`;
      return { toRefresh, expired: await publicNetwork(tx, lineA), lineDate };
    });
    expect(found.toRefresh).toMatchObject(OBSERVED_BANDS);
    expect(found.expired).toMatchObject(DECLARED_BANDS);
    expect(found.expired.figures_measured_at).toEqual(found.lineDate);
  });

  it("derives right when the primary line changes: the observed line keeps its bands", async () => {
    const found = await scenario(async (tx) => {
      await observedLineA(tx);
      const other = await asCreator(tx, async () => {
        await tx`
          update profiles.creator_social_accounts set is_primary = false where id = ${lineA}`;
        const [row] = await tx<{ id: string }[]>`
          insert into profiles.creator_social_accounts
            (account_id, network_code, is_primary, followers_count)
          values (${creatorA}, 'youtube', true, 600000)
          returning id::text`;
        return row?.id ?? "";
      });
      return {
        observed: await publicNetwork(tx, lineA),
        other: await publicNetwork(tx, other),
      };
    });
    expect(found.observed).toMatchObject({
      ...OBSERVED_BANDS,
      is_primary: false,
    });
    expect(found.other).toMatchObject({
      is_primary: true,
      audience_band: "macro",
      engagement_band: null,
      figures_source: "declared",
    });
  });

  it("replays the reprise as influx_identity_definer without changing a derived row", async () => {
    const found = await scenario(async (tx) => {
      await observedLineA(tx);
      const before = await publicNetwork(tx, lineA);
      await tx`delete from profiles.creator_public_networks where social_account_id = ${lineA}`;
      await tx.unsafe("set local role influx_identity_definer");
      await tx.unsafe(REPRISE_SQL);
      await tx.unsafe("reset role");
      return { before, after: await publicNetwork(tx, lineA) };
    });
    expect(found.after).toEqual(found.before);
    expect(found.after).toMatchObject(OBSERVED_BANDS);
  });

  it("lets influx_verification_definer alone execute the derivation, whose owner reads no handle", async () => {
    const [row] = await migration<Record<string, boolean>[]>`
      select
        has_function_privilege('influx_verification_definer',
          'profiles.refresh_creator_public_network(uuid)', 'EXECUTE') as verification,
        has_function_privilege('influx_advertiser',
          'profiles.refresh_creator_public_network(uuid)', 'EXECUTE') as advertiser,
        has_function_privilege('influx_creator',
          'profiles.refresh_creator_public_network(uuid)', 'EXECUTE') as creator,
        has_function_privilege('influx_agent',
          'profiles.refresh_creator_public_network(uuid)', 'EXECUTE') as agent,
        has_column_privilege('influx_identity_definer', 'verification.badges',
          'observed_followers', 'SELECT') as figures,
        has_column_privilege('influx_identity_definer', 'verification.badges',
          'observed_handle_at_decision', 'SELECT') as handle,
        has_column_privilege('influx_identity_definer', 'verification.badges',
          'declared_followers_at_decision', 'SELECT') as declared`;
    expect(row).toEqual({
      verification: true,
      advertiser: false,
      creator: false,
      agent: false,
      figures: true,
      handle: false,
      declared: false,
    });
  });
});
