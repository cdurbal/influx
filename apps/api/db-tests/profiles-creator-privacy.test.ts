// L2D commit 06 — the creator profile in the export and the erasure, 0219 (jalons/l2d/06.md;
// l2d/modele.md §0219; fiche invariant 9; 04 §9.2; 15 RG81; Q18): L2D-D14 the category
// creator_profile of the export (storefront, lists, identity, network lines with their exact
// figures, bands and audience, refused sectors, history; never public_ref, a line id nor an agent),
// L2D-D15 the erasure (storefront kept and suspended, the rest emptied or deleted, nothing derived
// again, no marker left in any table), and the bounds of influx_privacy_definer. The approval runs
// as in t8-privacy-execution (2V requested by admin B, confirmed and consumed by admin A with R).
// Each case runs in ONE rolled-back transaction of the local superuser.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { OUR_SCHEMAS } from "@influx/test-kit/rights";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { DATA_EXPORT_CATEGORIES } from "../src/domains/privacy/notice.ts";
import {
  actAs,
  actAsInternal,
  actAsMember,
  bindRequestSession,
  letterName,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

const INSUFFICIENT_PRIVILEGE = "42501";

const adminA = accountIdOf("admin", "a");
const adminB = accountIdOf("admin", "b");
const agentA = accountIdOf("agent", "a");

/** A notice of the shape apps/api renders (an object with the 15 keys of the file). */
const NOTICE = {
  language: "en",
  title: "Your data held by INFLUX",
  categories: Object.fromEntries(
    DATA_EXPORT_CATEGORIES.map((key) => [key, `Purpose of ${key}`]),
  ),
};

let migration: postgres.Sql;

beforeAll(async () => {
  await testDataSet();
  migration = migrationRole();
});

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Row[]; count: number }
  | { outcome: "error"; code: string; message: string };

async function attempt(
  tx: Tx,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Attempt> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return {
      outcome: "rows",
      rows: [...result] as Row[],
      count: Math.max(result.count, result.length),
    };
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    return {
      outcome: "error",
      code: failure.code ?? "unknown",
      message: failure.message ?? "",
    };
  }
}

function rowsOf(result: Attempt): Row[] {
  if (result.outcome === "error") {
    throw new Error(`${result.code} ${result.message}`);
  }
  return result.rows;
}

// ---------------------------------------------------------------------------------------------
// The fixtures: a creator of its own, filled as he would (his session), and its approval
// ---------------------------------------------------------------------------------------------

type Creator = {
  id: string;
  tag: string;
  alias: string;
  publicRef: string;
  line: string;
};

/** An active creator account with its storefront (as identity.provision_account() leaves it). */
async function newCreator(tx: Tx): Promise<Creator> {
  const id = randomUUID();
  const tag = letterName(id.slice(0, 8));
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l2d-privacy-${id}@example.test`}, now(), 'FR', 'en',
            'L2D Privacy Creator', true, now(), 'individual')`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, 'creator')`;
  const [storefront] = await tx<{ alias: string; public_ref: string }[]>`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')
    returning alias, public_ref::text`;
  if (storefront === undefined) {
    throw new Error("no storefront");
  }
  return {
    id,
    tag,
    alias: storefront.alias,
    publicRef: storefront.public_ref,
    line: "",
  };
}

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

/** Blocks 1 to 5 filled by the creator himself; one history row written by an agent. */
async function fillCreatorProfile(tx: Tx, creator: Creator): Promise<Creator> {
  const { id, tag } = creator;
  const line = await asCreator(tx, id, async () => {
    await tx`
      update profiles.creator_public_profiles
         set headline = ${`${tag} headline`}, bio = ${`${tag} bio, my own words.`},
             primary_topic_code = 'beauty', residence_region_code = 'FR-BRE',
             travel_scope = 'domestic', collaboration_experience_band = '6_20',
             delivery_lead_band = '7_14d', max_exclusivity_band = 'le_1m',
             accepts_non_monetary = true, availability_band = 'lt_1m'
       where account_id = ${id}`;
    await tx`
      insert into profiles.creator_topics (account_id, slot, topic_code)
      values (${id}, 1, 'fashion'), (${id}, 2, 'travel')`;
    await tx`
      insert into profiles.creator_publication_languages (account_id, slot, language_code)
      values (${id}, 1, 'fr'), (${id}, 2, 'en')`;
    await tx`
      insert into profiles.creator_tones (account_id, slot, tone_code)
      values (${id}, 1, 'educational')`;
    await tx`
      insert into profiles.creator_formats (account_id, format_code)
      values (${id}, 'ugc_photo'), (${id}, 'instagram_reel')`;
    await tx`
      insert into profiles.creator_usage_rights (account_id, usage_right_code, inclusion)
      values (${id}, 'paid_whitelisting', 'optional'), (${id}, 'organic_repost', 'included')`;
    await tx`
      update profiles.creator_identities
         set legal_first_name = ${`${tag}first`}, legal_last_name = ${`${tag}last`},
             contact_email = ${`${tag}@example.test`}, contact_phone = '+33698765432',
             address_line = ${`12 rue ${tag}`}, postal_code = '29200',
             city = ${`${tag}ville`}, country_code = 'FR', completeness_percent = 72
       where account_id = ${id}`;
    const [row] = await tx<{ id: string }[]>`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, pseudonym, profile_url, followers_count,
         posts_last_30_days, avg_comments_per_post, avg_reach_per_post, engagement_rate_bp)
      values (${id}, 'instagram', true, ${`${tag}_handle`}, ${`${tag} Pseudo`},
              ${`https://www.instagram.com/${tag}_handle`}, 873541, 14, 35, 120000, 350)
      returning id::text`;
    if (row === undefined) {
      throw new Error("no network line");
    }
    await tx`
      insert into profiles.creator_audience_countries
        (social_account_id, account_id, slot, country_code, share_percent)
      values (${row.id}, ${id}, 0, 'FR', 72), (${row.id}, ${id}, 1, 'BE', 15)`;
    await tx`
      insert into profiles.creator_audience_ages
        (social_account_id, account_id, age_band_code, share_percent)
      values (${row.id}, ${id}, '18_24', 40), (${row.id}, ${id}, '25_34', 35)`;
    await tx`
      insert into profiles.creator_audience_genders
        (social_account_id, account_id, gender_code, share_percent)
      values (${row.id}, ${id}, 'female', 61), (${row.id}, ${id}, 'male', 39)`;
    await tx`
      insert into profiles.creator_refused_sectors (account_id, sector_code)
      values (${id}, 'gambling')`;
    await tx`select profiles.confirm_own_creator_figures(${row.id}::uuid, 873541, 14, 35)`;
    return row.id;
  });
  // an agent's observation (L2E writes it through its own door): the author is not the creator
  await tx`
    insert into profiles.creator_network_metrics_history
      (account_id, social_account_id, network_code, followers_count, posts_last_30_days,
       avg_comments_per_post, figures_source, confirmed, recorded_by_account_id)
    values (${id}, ${line}, 'instagram', 880000, 15, 36, 'agent_observed', true, ${agentA})`;
  return { ...creator, line };
}

async function deposit(
  tx: Tx,
  account: string,
  type: "access" | "erasure",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into backoffice.data_subject_requests (request_type, requester_account_id)
    values (${type}::backoffice.data_request_type, ${account})
    returning id::text`;
  if (row === undefined) {
    throw new Error("no request");
  }
  return row.id;
}

function asAdmin<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: account, role: "admin", aal: "aal2" },
    fn,
  );
}

async function adminSession(tx: Tx, account: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp', 'firefox.linux')
    returning id::text`;
  if (row === undefined) {
    throw new Error("no session");
  }
  return row.id;
}

async function inSession(
  tx: Tx,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[],
): Promise<Attempt> {
  await bindRequestSession(tx, String(parameters[0]));
  return attempt(tx, statement, parameters);
}

/** The whole approval: 2V requested by B, confirmed by A, consumed by A with R (t8). */
async function approve(
  tx: Tx,
  request: string,
  type: "access" | "erasure",
): Promise<void> {
  const payload = JSON.stringify({ request_id: request, request_type: type });
  const requested = await asAdmin(tx, adminB, () =>
    attempt(
      tx,
      "select backoffice.request_dual_control('privacy.approve_data_request', $1::text::jsonb, $2)::text as id",
      [payload, "request_instructed"],
    ),
  );
  const dualControl = String(rowsOf(requested)[0]?.id);
  const session = await adminSession(tx, adminA);
  rowsOf(
    await asAdmin(tx, adminA, () =>
      inSession(
        tx,
        "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3) as mode",
        [session, dualControl, null],
      ),
    ),
  );
  rowsOf(
    await asAdmin(tx, adminA, () =>
      inSession(
        tx,
        "select backoffice.approve_data_request_execution($1::uuid, $2::uuid, $3::uuid, " +
          "$4::backoffice.data_request_type, $5)",
        [session, dualControl, request, type, "request_instructed"],
      ),
    ),
  );
}

async function execute(
  tx: Tx,
  account: string,
  type: "access" | "erasure",
): Promise<string> {
  const request = await deposit(tx, account, type);
  await approve(tx, request, type);
  rowsOf(
    await actAs(tx, "privacy", () =>
      attempt(
        tx,
        "select request_type from privacy.execute_request($1::uuid, $2::text::jsonb)",
        [request, type === "access" ? JSON.stringify(NOTICE) : null],
      ),
    ),
  );
  return request;
}

type ExportFile = { categories: string[]; data: Record<string, unknown> };

async function exportOf(
  tx: Tx,
  account: string,
): Promise<{ content: string; file: ExportFile }> {
  const request = await execute(tx, account, "access");
  const [stored] = await tx<{ content: string }[]>`
    select content from privacy.data_exports where request_id = ${request}`;
  const content = String(stored?.content);
  return { content, file: JSON.parse(content) as ExportFile };
}

/** The tables of our schemas holding a row whose text carries `tag`, in any column. */
async function tablesCarrying(tx: Tx, tag: string): Promise<string[]> {
  const tables = await tx<{ name: string }[]>`
    select format('%I.%I', n.nspname, c.relname) as name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname = any (${OUR_SCHEMAS as unknown as string[]})
     order by 1`;
  const found: string[] = [];
  for (const { name } of tables) {
    const [row] = await tx.unsafe<{ hits: number }[]>(
      `select count(*)::int as hits from ${name} t where to_jsonb(t)::text ilike $1`,
      [`%${tag}%`],
    );
    if ((row?.hits ?? 0) > 0) {
      found.push(name);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// L2D-D14: the export
// ---------------------------------------------------------------------------------------------

describe("L2D-D14: the creator profile in the export (art. 15, 15 RG81)", () => {
  it("exports the storefront, its lists in their order, the identity, the lines with their figures, bands and audience, the refused sectors and the history", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      return { creator, ...(await exportOf(tx, creator.id)) };
    });
    const { creator, file } = outcome;
    const tag = creator.tag;
    expect(file.categories).toEqual([...DATA_EXPORT_CATEGORIES]);
    expect(file.categories.slice(0, 3)).toEqual([
      "account",
      "advertiser_profile",
      "creator_profile",
    ]);
    expect(file.data.advertiser_profile).toBeNull();
    const profile = file.data.creator_profile as Row;
    expect(profile).toEqual({
      alias: creator.alias,
      status: "draft",
      is_searchable: true,
      published_at: null,
      headline: `${tag} headline`,
      bio: `${tag} bio, my own words.`,
      primary_topic: "beauty",
      secondary_topics: ["fashion", "travel"],
      publication_languages: ["fr", "en"],
      tones: ["educational"],
      formats: ["instagram_reel", "ugc_photo"],
      usage_rights: [
        { usage_right: "organic_repost", inclusion: "included" },
        { usage_right: "paid_whitelisting", inclusion: "optional" },
      ],
      residence_country: "FR",
      residence_region: "FR-BRE",
      travel_scope: "domestic",
      collaboration_experience: "6_20",
      delivery_lead: "7_14d",
      max_exclusivity: "le_1m",
      accepts_non_monetary: true,
      availability: "lt_1m",
      availability_declared_at: expect.stringMatching(/Z$/),
      main_audience_country: "FR",
      main_audience_share_band: "50_80",
      audience_gender_band: "female_majority",
      audience_share_bands: [
        { dimension: "age", bucket: "18_24", share_band: "25_50" },
        { dimension: "age", bucket: "25_34", share_band: "25_50" },
        { dimension: "country", bucket: "BE", share_band: "10_25" },
      ],
      identity: {
        legal_first_name: `${tag}first`,
        legal_last_name: `${tag}last`,
        contact_email: `${tag}@example.test`,
        contact_phone: "+33698765432",
        address_line: `12 rue ${tag}`,
        postal_code: "29200",
        city: `${tag}ville`,
        country_code: "FR",
        completeness_percent: 72,
        updated_at: expect.stringMatching(/Z$/),
      },
      refused_sectors: ["gambling"],
      networks: [
        {
          network: "instagram",
          is_primary: true,
          handle: `${tag}_handle`,
          pseudonym: `${tag} Pseudo`,
          profile_url: `https://www.instagram.com/${tag}_handle`,
          followers_count: 873541,
          posts_last_30_days: 14,
          avg_comments_per_post: 35,
          avg_reach_per_post: 120000,
          engagement_rate_bp: 350,
          figures_source: "declared",
          figures_measured_at: expect.stringMatching(/Z$/),
          bands: {
            audience: expect.any(String),
            reach: expect.any(String),
            publication_frequency: expect.any(String),
            comments: expect.any(String),
            engagement: null,
          },
          audience: {
            countries: [
              { slot: 0, country_code: "FR", share_percent: 72 },
              { slot: 1, country_code: "BE", share_percent: 15 },
            ],
            ages: [
              { age_band: "18_24", share_percent: 40 },
              { age_band: "25_34", share_percent: 35 },
            ],
            genders: [
              { gender: "female", share_percent: 61 },
              { gender: "male", share_percent: 39 },
            ],
          },
          created_at: expect.stringMatching(/Z$/),
          updated_at: expect.stringMatching(/Z$/),
        },
      ],
      metrics_history: expect.any(Array),
      created_at: expect.stringMatching(/Z$/),
      updated_at: expect.stringMatching(/Z$/),
    });
    // RG119: every entry and confirmation, the agent's row last, shown as INFLUX
    const history = profile.metrics_history as Row[];
    expect(history.length).toBeGreaterThanOrEqual(3);
    expect(history.at(-1)).toEqual({
      network: "instagram",
      followers_count: 880000,
      posts_last_30_days: 15,
      avg_comments_per_post: 36,
      figures_source: "agent_observed",
      confirmed: true,
      recorded_at: expect.stringMatching(/Z$/),
      recorded_by: "INFLUX",
    });
    expect(
      history.slice(0, -1).every((row) => row.recorded_by === "self"),
    ).toBe(true);
    expect(
      history.some(
        (row) => row.recorded_by === "self" && row.confirmed === true,
      ),
    ).toBe(true);
  });

  it("never exports public_ref, the id of a line, the agent nor another creator's data", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      const stranger = await fillCreatorProfile(tx, await newCreator(tx));
      return { creator, stranger, ...(await exportOf(tx, creator.id)) };
    });
    const { creator, stranger, content } = outcome;
    expect(content).toContain(creator.tag);
    expect(content.includes(creator.publicRef)).toBe(false);
    expect(content.includes(creator.line)).toBe(false);
    expect(content.includes(agentA)).toBe(false);
    // 15 RG81: the requester's data only
    expect(content.includes(stranger.tag)).toBe(false);
    expect(content.includes(stranger.alias)).toBe(false);
  });

  it("exports an untouched storefront with empty lists, an empty identity and no line", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      return { creator, ...(await exportOf(tx, creator.id)) };
    });
    expect(outcome.file.data.creator_profile).toMatchObject({
      alias: outcome.creator.alias,
      status: "draft",
      headline: null,
      primary_topic: null,
      secondary_topics: [],
      publication_languages: [],
      tones: [],
      formats: [],
      usage_rights: [],
      residence_country: "FR",
      accepts_non_monetary: false,
      audience_share_bands: [],
      identity: {
        legal_first_name: null,
        legal_last_name: null,
        contact_email: null,
        contact_phone: null,
        address_line: null,
        postal_code: null,
        city: null,
        country_code: null,
        completeness_percent: 0,
        updated_at: expect.stringMatching(/Z$/),
      },
      refused_sectors: [],
      networks: [],
      metrics_history: [],
    });
  });

  it("exports creator_profile as null for an account without a storefront (an advertiser)", async () => {
    const outcome = await scenario(async (tx) => {
      const id = randomUUID();
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           declared_status)
        values (${id}, ${randomUUID()}, ${`l2d-privacy-${id}@example.test`}, now(), 'FR', 'en',
                'business')`;
      await tx`insert into identity.account_roles (account_id, role) values (${id}, 'advertiser')`;
      await tx`insert into profiles.advertiser_profiles (account_id, legal_name)
               values (${id}, 'L2D Privacy Brand')`;
      return exportOf(tx, id);
    });
    expect(outcome.file.categories).toEqual([...DATA_EXPORT_CATEGORIES]);
    expect(outcome.file.data).toHaveProperty("creator_profile", null);
    expect(outcome.file.data.advertiser_profile).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
// L2D-D15: the erasure
// ---------------------------------------------------------------------------------------------

type ErasedState = {
  storefront: Row | undefined;
  identity: Row | undefined;
  lines: Row[];
  counts: Row | undefined;
};

async function creatorStateOf(tx: Tx, account: string): Promise<ErasedState> {
  const [storefront] = await tx<Row[]>`
    select account_id::text, public_ref::text, alias, status::text, is_searchable, published_at,
           headline, bio, primary_topic_code, residence_country_code, residence_region_code,
           travel_scope, collaboration_experience_band, main_audience_country,
           main_audience_share_band, audience_gender_band, delivery_lead_band,
           max_exclusivity_band, accepts_non_monetary, availability_band, availability_declared_at
      from profiles.creator_public_profiles where account_id = ${account}`;
  const [identity] = await tx<Row[]>`
    select legal_first_name, legal_last_name, contact_email, contact_phone, address_line,
           postal_code, city, country_code, completeness_percent
      from profiles.creator_identities where account_id = ${account}`;
  const lines = await tx<Row[]>`
    select id::text, network_code, is_primary, handle, pseudonym, profile_url,
           followers_count::text, posts_last_30_days, avg_comments_per_post::text,
           avg_reach_per_post::text, engagement_rate_bp, figures_source, figures_measured_at
      from profiles.creator_social_accounts where account_id = ${account} order by id`;
  const [counts] = await tx<Row[]>`
    select (select count(*)::int from profiles.creator_topics where account_id = ${account}) as topics,
           (select count(*)::int from profiles.creator_publication_languages
             where account_id = ${account}) as languages,
           (select count(*)::int from profiles.creator_tones where account_id = ${account}) as tones,
           (select count(*)::int from profiles.creator_formats where account_id = ${account}) as formats,
           (select count(*)::int from profiles.creator_usage_rights
             where account_id = ${account}) as usage_rights,
           (select count(*)::int from profiles.creator_public_networks
             where account_id = ${account}) as public_networks,
           (select count(*)::int from profiles.creator_public_audience
             where account_id = ${account}) as public_audience,
           (select count(*)::int from profiles.creator_audience_countries
             where account_id = ${account}) as audience_countries,
           (select count(*)::int from profiles.creator_audience_ages
             where account_id = ${account}) as audience_ages,
           (select count(*)::int from profiles.creator_audience_genders
             where account_id = ${account}) as audience_genders,
           (select count(*)::int from profiles.creator_refused_sectors
             where account_id = ${account}) as refused_sectors,
           (select count(*)::int from profiles.creator_network_metrics_history
             where account_id = ${account}) as history`;
  return { storefront, identity, lines, counts };
}

const NOTHING_LEFT = {
  topics: 0,
  languages: 0,
  tones: 0,
  formats: 0,
  usage_rights: 0,
  public_networks: 0,
  public_audience: 0,
  audience_countries: 0,
  audience_ages: 0,
  audience_genders: 0,
  refused_sectors: 0,
  history: 0,
};

describe("L2D-D15: the creator profile in the erasure (04 §9.2, Q18, modele.md §0219)", () => {
  it("keeps the storefront (keys, alias, country), suspended and out of every search, every other column emptied", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      await execute(tx, creator.id, "erasure");
      return { creator, state: await creatorStateOf(tx, creator.id) };
    });
    expect(outcome.state.storefront).toEqual({
      account_id: outcome.creator.id,
      public_ref: outcome.creator.publicRef,
      alias: outcome.creator.alias,
      status: "suspended",
      is_searchable: false,
      published_at: null,
      headline: null,
      bio: null,
      primary_topic_code: null,
      residence_country_code: "FR",
      residence_region_code: null,
      travel_scope: null,
      collaboration_experience_band: null,
      main_audience_country: null,
      main_audience_share_band: null,
      audience_gender_band: null,
      delivery_lead_band: null,
      max_exclusivity_band: null,
      accepts_non_monetary: false,
      availability_band: null,
      availability_declared_at: null,
    });
  });

  it("deletes the lists, the derived rows, the exact audience, the refused sectors and the history; empties the identity; keeps the lines without handle, pseudonym, URL, figures nor date", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      const before = await creatorStateOf(tx, creator.id);
      await execute(tx, creator.id, "erasure");
      return { creator, before, after: await creatorStateOf(tx, creator.id) };
    });
    // the témoin: every table held something before
    expect(
      Object.values(outcome.before.counts ?? {}).every((n) => Number(n) > 0),
    ).toBe(true);
    expect(outcome.after.counts).toEqual(NOTHING_LEFT);
    expect(outcome.after.identity).toEqual({
      legal_first_name: null,
      legal_last_name: null,
      contact_email: null,
      contact_phone: null,
      address_line: null,
      postal_code: null,
      city: null,
      country_code: null,
      completeness_percent: 0,
    });
    expect(outcome.after.lines).toEqual([
      {
        id: outcome.creator.line,
        network_code: "instagram",
        is_primary: true,
        handle: null,
        pseudonym: null,
        profile_url: null,
        followers_count: null,
        posts_last_30_days: null,
        avg_comments_per_post: null,
        avg_reach_per_post: null,
        engagement_rate_bp: null,
        figures_source: "declared",
        figures_measured_at: null,
      },
    ]);
  });

  it("leaves no marker in any table of the base, where it found them before", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      const before = await tablesCarrying(tx, creator.tag);
      await execute(tx, creator.id, "erasure");
      return { before, after: await tablesCarrying(tx, creator.tag) };
    });
    expect(outcome.before).toEqual(
      expect.arrayContaining([
        "profiles.creator_identities",
        "profiles.creator_public_profiles",
        "profiles.creator_social_accounts",
      ]),
    );
    expect(outcome.after).toEqual([]);
  });

  it("writes in the register the line account.anonymized only, without any marker", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      const [mark] = await tx<{ seq: string }[]>`
        select coalesce(max(seq), 0)::text as seq from audit.audit_events`;
      await execute(tx, creator.id, "erasure");
      const lines = await tx<{ event_type: string; payload: string }[]>`
        select event_type, payload::text as payload from audit.audit_events
         where seq > ${String(mark?.seq)}::bigint and subject_id = ${creator.id}
         order by seq`;
      return { creator, lines };
    });
    expect(outcome.lines.map((line) => line.event_type)).toEqual([
      "account.anonymized",
    ]);
    expect(
      outcome.lines.some((line) => line.payload.includes(outcome.creator.tag)),
    ).toBe(false);
  });

  it("leaves another creator untouched", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      const stranger = await fillCreatorProfile(tx, await newCreator(tx));
      const before = await creatorStateOf(tx, stranger.id);
      await execute(tx, creator.id, "erasure");
      return { before, after: await creatorStateOf(tx, stranger.id) };
    });
    expect(outcome.after).toEqual(outcome.before);
    expect(outcome.after.storefront).toMatchObject({ status: "draft" });
  });
});

// ---------------------------------------------------------------------------------------------
// The bounds of influx_privacy_definer (modele.md « Droits », 03 P7 clause « L2D »)
// ---------------------------------------------------------------------------------------------

describe("influx_privacy_definer on the creator objects (0219 §1)", () => {
  it("empties and deletes nothing of an account that is not erased", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      await tx.unsafe("set local role influx_privacy_definer");
      const results = {
        identity: await attempt(
          tx,
          "update profiles.creator_identities set legal_first_name = null, legal_last_name = null, " +
            "contact_email = null, contact_phone = null, address_line = null, postal_code = null, " +
            "city = null, country_code = null, completeness_percent = 0 where account_id = $1",
          [creator.id],
        ),
        history: await attempt(
          tx,
          "delete from profiles.creator_network_metrics_history where account_id = $1",
          [creator.id],
        ),
        sectors: await attempt(
          tx,
          "delete from profiles.creator_refused_sectors where account_id = $1",
          [creator.id],
        ),
      };
      await tx.unsafe("reset role");
      return { results, state: await creatorStateOf(tx, creator.id) };
    });
    for (const result of Object.values(outcome.results)) {
      expect(result).toMatchObject({ outcome: "rows", count: 0 });
    }
    expect(outcome.state.identity).toMatchObject({ completeness_percent: 72 });
    expect(outcome.state.counts).toMatchObject({
      history: 3,
      refused_sectors: 1,
    });
  });

  it("refuses on an erased account any write that does not empty the row (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await fillCreatorProfile(tx, await newCreator(tx));
      await execute(tx, creator.id, "erasure");
      await tx.unsafe("set local role influx_privacy_definer");
      const results = [
        await attempt(
          tx,
          "update profiles.creator_public_profiles set status = 'draft' where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "update profiles.creator_public_profiles set headline = 'kept' where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "update profiles.creator_identities set city = 'Brest' where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "update profiles.creator_social_accounts set handle = 'kept' where account_id = $1",
          [creator.id],
        ),
      ];
      await tx.unsafe("reset role");
      return results;
    });
    for (const result of outcome) {
      expect(result).toMatchObject({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    }
  });

  it("inserts nothing, never writes a key, the alias, the country, the network nor the source, never reads public_ref", async () => {
    const [rights] = await migration<Row[]>`
      select
        (select coalesce(string_agg(c.relname, ', ' order by c.relname), '')
           from pg_catalog.pg_class c
           join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'profiles' and c.relname like 'creator\\_%' and c.relkind = 'r'
            and (has_table_privilege('influx_privacy_definer', c.oid, 'INSERT, TRUNCATE')
                 or has_any_column_privilege('influx_privacy_definer', c.oid, 'INSERT')))
          as inserts,
        (select coalesce(string_agg(t.tab || '.' || t.col, ', '), '')
           from (values ('creator_public_profiles', 'account_id'),
                        ('creator_public_profiles', 'public_ref'),
                        ('creator_public_profiles', 'alias'),
                        ('creator_public_profiles', 'residence_country_code'),
                        ('creator_identities', 'account_id'),
                        ('creator_social_accounts', 'account_id'),
                        ('creator_social_accounts', 'network_code'),
                        ('creator_social_accounts', 'is_primary'),
                        ('creator_social_accounts', 'figures_source')) as t (tab, col)
          where has_column_privilege('influx_privacy_definer', 'profiles.' || t.tab, t.col,
                                     'UPDATE')) as key_updates,
        has_column_privilege('influx_privacy_definer', 'profiles.creator_public_profiles',
                             'public_ref', 'SELECT') as reads_public_ref,
        (select count(*)::int from pg_catalog.pg_class c
           join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'profiles' and c.relname like 'creator\\_%' and c.relkind = 'r'
            and has_any_column_privilege('influx_privacy_definer', c.oid, 'SELECT')) as read_tables`;
    expect(rights).toEqual({
      inserts: "",
      key_updates: "",
      reads_public_ref: false,
      read_tables: 15,
    });
  });
});
