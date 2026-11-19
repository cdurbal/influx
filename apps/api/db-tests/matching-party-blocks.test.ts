// L3E commit 04 — the block between a brand and a creator, 0317 (jalons/l3e/04.md; l3e-fiche.md
// invariants 1, 4, 15, 16; jalons/l3e/modele.md §9; 04 §5.6; 10 RG28 to RG31; 11 CA8).
//   L3E-T4  the two tables of matching (one active block per pair, a lift kept and a new block
//           after it, the CHECKs and the trigger of a block, the guard of a lift); no right for a
//           brand, a creator, an agent nor an admin (42501, T2); the owner of the creator's doors
//           reads the pair and lifted_at only; the campaign of a blocked pair absent from the feed,
//           the record and the logo in both directions, silently (out of the total, the body of an
//           unknown record), present again after the lift; the reason never served; TM11.
// Each case runs in a rolled-back transaction of the local superuser, which first closes the campaigns
// earlier files left published (the feed reads every published campaign of the base), then writes
// the fixtures and the blocks outside the guards (no gesture at Lot 3) and acts as apps/api does.
import {
  accountIdOf,
  closeStalePublishedCampaigns,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { matchingColumns } from "../src/db/schema/introspection.ts";
import { civilDateIn } from "./campaign-dates-kit.ts";
import { publishAsInflux } from "./campaign-publication-kit.ts";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
type Parameter = postgres.ParameterOrJSON<never> | null | undefined;

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

const agentA = accountIdOf("agent", "a");
const adminA = accountIdOf("admin", "a");

const TABLES = ["matching.block_reasons", "matching.party_blocks"] as const;

/** A comment that must never reach an answer served to a creator (RG30). */
const REASON_COMMENT = "L3E-T4 the brand writes why it blocks";

const FEED =
  "select search.read_open_campaigns($1::text, $2::integer) as answer";
const RECORD = "select search.read_open_campaign($1::uuid) as answer";
const LOGO =
  "select visible from search.read_open_campaign_brand_logo($1::uuid)";

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | { outcome: "error"; code: string; detail: string | undefined };

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

function codeOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error" ? outcome.code : "ok";
}

function detailOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error"
    ? `${outcome.code} ${outcome.detail ?? ""}`.trim()
    : "ok";
}

/** A rolled-back transaction where no campaign of an earlier file is still published. */
function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    await closeStalePublishedCampaigns(tx);
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
    values (${id}, ${randomUUID()}, ${`l3e-t4-${id}@example.test`}, now(), 'FR', 'fr',
            'L3E T4 Person', true, now(),
            ${role === "creator" ? "individual" : "business"})`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, ${role})`;
  return id;
}

/** A creator account and its storefront in draft (enough to read the feed, 11 RG13). */
async function newCreator(tx: Tx): Promise<string> {
  const id = await newAccount(tx, "creator");
  await tx`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')`;
  return id;
}

/** A brand whose profile is published, with an active logo. */
async function newBrand(tx: Tx): Promise<string> {
  const id = await newAccount(tx, "advertiser");
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3E T4 Brand', 'beauty_personal_care', '11_50', 'l3e-t4-brand.example',
            'A brand of the L3E tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  await tx`insert into profiles.advertiser_target_markets (account_id, slot, country_code)
           values (${id}, 1, 'FR')`;
  await tx`insert into profiles.advertiser_working_languages (account_id, language_code)
           values (${id}, 'fr')`;
  await tx`insert into profiles.advertiser_topics (account_id, slot, topic_code)
           values (${id}, 1, 'beauty')`;
  await tx`insert into profiles.advertiser_networks (account_id, network_code)
           values (${id}, 'instagram')`;
  await tx`insert into profiles.advertiser_formats (account_id, format_code)
           values (${id}, 'instagram_reel')`;
  await tx`insert into profiles.advertiser_audience_countries (account_id, slot, country_code)
           values (${id}, 1, 'FR')`;
  await tx`update profiles.advertiser_profiles set status = 'published' where account_id = ${id}`;
  await tx`
    insert into profiles.brand_logo_objects
      (account_id, state, received_bytes, byte_size, width, height, activated_at)
    values (${id}, 'active', 2048, 1024, 256, 128, now())`;
  return id;
}

/** A complete campaign of `brand`, open for ten days, published as INFLUX would. */
async function newCampaign(tx: Tx, brand: string): Promise<string> {
  const closeOn = civilDateIn(10);
  const endsOn = civilDateIn(60);
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns
      (advertiser_account_id, status, title, campaign_type_code, public_summary, brief,
       internal_reference, product_description, sector_code, restrictions, product_is_sent,
       product_value_band_code, creator_keeps_product, shipping_costs_borne_by, usage_rights_code,
       usage_rights_duration_band, usage_rights_territory_scope, exclusivity_band,
       content_review_delay, audience_gender_code, currency, remuneration_kind,
       per_creator_budget_band_code, creators_wanted, total_budget_minor, applications_close_on,
       content_due_on, starts_on, ends_on, max_applications, submitted_at)
    values (${brand}, 'pending_review', 'L3E T4 campaign title', 'product_placement',
            ${`L3E T4 summary ${"s".repeat(120)}`}, ${`L3E T4 brief ${"b".repeat(300)}`},
            'L3E-T4-REF', ${`L3E T4 product ${"p".repeat(20)}`}, 'sports_leisure',
            'L3E T4 restrictions', true, 'under_100', true, 'brand', 'organic_repost', '3m',
            'worldwide', 'none', '5bd', 'mixed', 'EUR', 'cash', '500_1000', 3, 3000000, ${closeOn},
            ${closeOn}, ${closeOn}, ${endsOn}, 50, now())
    returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  await tx`
    insert into campaigns.campaign_key_messages (campaign_id, position, body)
    values (${row.id}, 1, 'L3E T4 key message')`;
  await tx`
    insert into campaigns.campaign_deliverables
      (campaign_id, slot, network_code, format_code, quantity)
    values (${row.id}, 1, 'instagram', 'instagram_reel', 2)`;
  await tx`
    insert into campaigns.campaign_audience_countries (campaign_id, slot, country_code)
    values (${row.id}, 1, 'FR')`;
  await tx`
    insert into campaigns.campaign_topics (campaign_id, slot, topic_code)
    values (${row.id}, 1, 'beauty')`;
  await publishAsInflux(tx, row.id);
  return row.id;
}

/** The reasons of L3E-T4 (the migration loads none, modele §9). */
async function seedReasons(tx: Tx): Promise<void> {
  await tx`
    insert into matching.block_reasons (code, label_key, available_to_side, requires_comment,
                                        is_active)
    values ('probe_brand', 'block.reason.probe_brand', 'advertiser', false, true),
           ('probe_creator', 'block.reason.probe_creator', 'creator', false, true),
           ('probe_any', 'block.reason.probe_any', 'any', false, true),
           ('probe_explain', 'block.reason.probe_explain', 'any', true, true),
           ('probe_retired', 'block.reason.probe_retired', 'any', false, false)
    on conflict do nothing`;
}

const BLOCK =
  "insert into matching.party_blocks (advertiser_account_id, creator_account_id, " +
  "blocked_by_account_id, blocked_by_side, reason_code, comment) " +
  "values ($1::uuid, $2::uuid, $3::uuid, $4::text, $5::text, $6::text) returning id::text";

/** A block posed by `side` (the superuser writes it: no gesture at Lot 3). */
async function block(
  tx: Tx,
  brand: string,
  creator: string,
  side: "advertiser" | "creator" = "advertiser",
): Promise<string> {
  const outcome = await run<{ id: string }>(tx, BLOCK, [
    brand,
    creator,
    side === "advertiser" ? brand : creator,
    side,
    "probe_explain",
    REASON_COMMENT,
  ]);
  if (outcome.outcome === "error") throw new Error(detailOf(outcome));
  const id = outcome.rows[0]?.id;
  if (id === undefined) throw new Error("no block");
  return id;
}

async function lift(tx: Tx, id: string, by: string): Promise<void> {
  await tx`update matching.party_blocks set lifted_at = now(), lifted_by_account_id = ${by}
            where id = ${id}`;
}

/** What the creator reads of a campaign: in the feed and its total, the record, the logo. */
async function readsOf(
  tx: Tx,
  creator: string,
  campaign: string,
): Promise<{
  inFeed: boolean;
  total: number;
  record: Row;
  logo: boolean;
  raw: string;
}> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: creator, role: "creator", aal: "aal1" },
    async () => {
      const feed = await run<{ answer: Row }>(tx, FEED, ["recent", 1]);
      const record = await run<{ answer: Row }>(tx, RECORD, [campaign]);
      const logo = await run<{ visible: boolean }>(tx, LOGO, [campaign]);
      if (
        feed.outcome === "error" ||
        record.outcome === "error" ||
        logo.outcome === "error"
      ) {
        throw new Error(
          [detailOf(feed), detailOf(record), detailOf(logo)].join(" / "),
        );
      }
      const page = feed.rows[0]?.answer ?? {};
      const items = (page.items as Row[] | undefined) ?? [];
      return {
        inFeed: items.some((item) => item.id === campaign),
        total: Number(page.total),
        record: record.rows[0]?.answer ?? {},
        logo: logo.rows[0]?.visible === true,
        raw: JSON.stringify([page, record.rows[0]?.answer]),
      };
    },
  );
}

// the cases ---------------------------------------------------------------------------------------

describe("L3E-T4 the rights of the two tables (T2; fiche invariants 1, 15; modele §9)", () => {
  it("L3E-T4 forces RLS and a restrictive member policy on both tables, and gives no execution role nor Data API role any right on matching", async () => {
    const outcome = await scenario(async (tx) => {
      const tables = await tx<{ name: string; ok: boolean }[]>`
        select c.oid::regclass::text as name,
               c.relrowsecurity and c.relforcerowsecurity
               and exists (select 1 from pg_catalog.pg_policy p
                            where p.polrelid = c.oid and not p.polpermissive
                              and p.polname = c.relname || '_no_member_access'
                              and p.polroles @> array['influx_advertiser'::regrole::oid,
                                                      'influx_creator'::regrole::oid]
                              and pg_catalog.pg_get_expr(p.polqual, p.polrelid) = 'false') as ok
          from pg_catalog.pg_class c
         where c.oid = any (${[...TABLES]}::regclass[])
         order by 1`;
      const rights = await tx<{ line: string }[]>`
        select r.rolname || ' ' || c.oid::regclass::text as line
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace,
               pg_catalog.pg_roles r
         where n.nspname = 'matching' and c.relkind in ('r', 'p', 'v', 'm')
           and r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                             'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                             'influx_privacy', 'anon', 'authenticated', 'service_role')
           and (has_table_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_any_column_privilege(r.oid, c.oid, 'SELECT, INSERT, UPDATE'))`;
      return { tables, rights };
    });
    expect(outcome.tables).toEqual([
      { name: "matching.block_reasons", ok: true },
      { name: "matching.party_blocks", ok: true },
    ]);
    expect(outcome.rights).toEqual([]);
  });

  it("L3E-T4 refuses (42501) both tables to a brand and a creator in their own context, and to an agent and an admin", async () => {
    const outcome = await scenario(async (tx) => {
      const codes: Record<string, string> = {};
      const attempts = (table: string, account: string) => [
        `select count(*) from ${table}`,
        table === "matching.party_blocks"
          ? `insert into ${table} (advertiser_account_id, creator_account_id, ` +
            "blocked_by_account_id, blocked_by_side, reason_code) " +
            `values ('${account}', '${account}', '${account}', 'creator', 'x')`
          : `insert into ${table} (code, label_key, available_to_side) values ('x', 'x', 'any')`,
        `delete from ${table}`,
      ];
      for (const table of TABLES) {
        for (const [who, account] of [
          ["brand", accountIdOf("advertiser", "a")],
          ["creator", accountIdOf("creator", "a")],
        ] as const) {
          const role = who === "brand" ? "influx_advertiser" : "influx_creator";
          for (const [index, statement] of attempts(table, account).entries()) {
            codes[`${who} ${index} ${table}`] = await actAsMember(
              tx,
              role,
              {
                accountId: account,
                role: who === "brand" ? "advertiser" : "creator",
                aal: "aal1",
              },
              async () => codeOf(await run(tx, statement)),
            );
          }
        }
        for (const [role, account] of [
          ["influx_agent", agentA],
          ["influx_admin", adminA],
        ] as const) {
          codes[`${role} ${table}`] = await actAsInternal(
            tx,
            role,
            {
              accountId: account,
              role: role === "influx_agent" ? "agent" : "admin",
              aal: "aal2",
            },
            async () => codeOf(await run(tx, `select count(*) from ${table}`)),
          );
        }
      }
      return codes;
    });
    expect(Object.keys(outcome)).toHaveLength(16);
    expect(
      Object.entries(outcome).filter(
        ([, code]) => code !== INSUFFICIENT_PRIVILEGE,
      ),
    ).toEqual([]);
  });

  it("L3E-T4 lets the owner of the creator's doors read the pair and lifted_at of party_blocks only, never the reason, the comment nor who blocked (RG30); visible_campaigns() stays its own, invoker, executed by nobody", async () => {
    const outcome = await scenario(async (tx) => {
      const columns = await tx<{ name: string }[]>`
        select a.attname::text as name
          from pg_catalog.pg_attribute a
         where a.attrelid = 'matching.party_blocks'::regclass and a.attnum > 0
           and not a.attisdropped
           and has_column_privilege('influx_campaign_feed_definer', a.attrelid, a.attnum,
                                    'SELECT')
         order by 1`;
      const [others] = await tx<Row[]>`
        select has_any_column_privilege('influx_campaign_feed_definer', 'matching.block_reasons',
                                        'SELECT') as reasons,
               has_any_column_privilege('influx_campaign_feed_definer', 'matching.party_blocks',
                                        'INSERT, UPDATE') as writes`;
      const [predicate] = await tx<Row[]>`
        select pg_catalog.pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
               p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(p.proacl) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner) as callers
          from pg_catalog.pg_proc p
         where p.oid = 'search.visible_campaigns(uuid)'::regprocedure`;
      return { columns: columns.map((row) => row.name), others, predicate };
    });
    expect(outcome.columns).toEqual([
      "advertiser_account_id",
      "creator_account_id",
      "lifted_at",
    ]);
    expect(outcome.others).toEqual({ reasons: false, writes: false });
    expect(outcome.predicate).toEqual({
      owner: "influx_campaign_feed_definer",
      definer: false,
      config: ['search_path=""'],
      callers: [],
    });
  });
});

describe("L3E-T4 one active block per pair, kept when lifted (04 §5.6; 10 RG28)", () => {
  it("L3E-T4 refuses a second active block of a pair whoever poses it (23505), keeps the lift and admits a new block after it", async () => {
    const outcome = await scenario(async (tx) => {
      await seedReasons(tx);
      const brand = await newAccount(tx, "advertiser");
      const creator = await newAccount(tx, "creator");
      const first = await block(tx, brand, creator, "advertiser");
      const sameSide = codeOf(
        await run(tx, BLOCK, [
          brand,
          creator,
          brand,
          "advertiser",
          "probe_brand",
          null,
        ]),
      );
      const otherSide = codeOf(
        await run(tx, BLOCK, [
          brand,
          creator,
          creator,
          "creator",
          "probe_creator",
          null,
        ]),
      );
      await lift(tx, first, brand);
      const afterLift = codeOf(
        await run(tx, BLOCK, [
          brand,
          creator,
          creator,
          "creator",
          "probe_creator",
          null,
        ]),
      );
      const [counts] = await tx<
        { all: number; active: number; lifted: number }[]
      >`
        select count(*)::int as all, count(*) filter (where lifted_at is null)::int as active,
               count(*) filter (where id = ${first} and lifted_at is not null)::int as lifted
          from matching.party_blocks
         where advertiser_account_id = ${brand} and creator_account_id = ${creator}`;
      return { sameSide, otherSide, afterLift, counts };
    });
    expect(outcome).toEqual({
      sameSide: UNIQUE_VIOLATION,
      otherSide: UNIQUE_VIOLATION,
      afterLift: "ok",
      counts: { all: 2, active: 1, lifted: 1 },
    });
  });

  it("L3E-T4 holds a block to its CHECKs and its trigger: two parties in their roles, who blocked agrees with the side, the reason active and of that side, its comment when required, born active, a lift coherent", async () => {
    const outcome = await scenario(async (tx) => {
      await seedReasons(tx);
      const brand = await newAccount(tx, "advertiser");
      const creator = await newAccount(tx, "creator");
      const insert = (values: Parameter[]) => run(tx, BLOCK, values);
      const result = {
        self: detailOf(
          await insert([brand, brand, brand, "advertiser", "probe_any", null]),
        ),
        inverted: detailOf(
          await insert([
            creator,
            brand,
            creator,
            "advertiser",
            "probe_any",
            null,
          ]),
        ),
        wrongWho: detailOf(
          await insert([
            brand,
            creator,
            creator,
            "advertiser",
            "probe_any",
            null,
          ]),
        ),
        influxByMember: detailOf(
          await insert([brand, creator, brand, "influx", "probe_any", null]),
        ),
        otherSideReason: detailOf(
          await insert([
            brand,
            creator,
            brand,
            "advertiser",
            "probe_creator",
            null,
          ]),
        ),
        retired: detailOf(
          await insert([
            brand,
            creator,
            brand,
            "advertiser",
            "probe_retired",
            null,
          ]),
        ),
        unknown: codeOf(
          await insert([
            brand,
            creator,
            brand,
            "advertiser",
            "probe_nowhere",
            null,
          ]),
        ),
        noComment: detailOf(
          await insert([
            brand,
            creator,
            brand,
            "advertiser",
            "probe_explain",
            "  ",
          ]),
        ),
        longComment: codeOf(
          await insert([
            brand,
            creator,
            brand,
            "advertiser",
            "probe_any",
            "c".repeat(1001),
          ]),
        ),
        bornLifted: detailOf(
          await run(
            tx,
            "insert into matching.party_blocks (advertiser_account_id, creator_account_id, " +
              "blocked_by_account_id, blocked_by_side, reason_code, lifted_at, " +
              "lifted_by_account_id) values ($1::uuid, $2::uuid, $1::uuid, 'advertiser', " +
              "'probe_any', now(), $1::uuid)",
            [brand, creator],
          ),
        ),
        byInflux: codeOf(
          await insert([brand, creator, agentA, "influx", "probe_any", null]),
        ),
      };
      const [row] = await tx<{ id: string }[]>`
        select id::text from matching.party_blocks
         where advertiser_account_id = ${brand} and lifted_at is null`;
      const halfLift = codeOf(
        await run(
          tx,
          "update matching.party_blocks set lifted_at = now() where id = $1::uuid",
          [row?.id],
        ),
      );
      const reasonWhileActive = codeOf(
        await run(
          tx,
          "update matching.party_blocks set lift_reason_code = 'resolved' where id = $1::uuid",
          [row?.id],
        ),
      );
      return { ...result, halfLift, reasonWhileActive };
    });
    expect(outcome).toEqual({
      self: expect.stringMatching(/^23514/),
      inverted: `${CHECK_VIOLATION} party_block_roles`,
      wrongWho: expect.stringMatching(/^23514/),
      influxByMember: `${CHECK_VIOLATION} party_block_roles`,
      otherSideReason: `${CHECK_VIOLATION} party_block_reason_not_available`,
      retired: `${CHECK_VIOLATION} party_block_reason_not_available`,
      unknown: FOREIGN_KEY_VIOLATION,
      noComment: `${CHECK_VIOLATION} party_block_comment_required`,
      longComment: CHECK_VIOLATION,
      bornLifted: `${CHECK_VIOLATION} party_block_born_active`,
      byInflux: "ok",
      halfLift: CHECK_VIOLATION,
      reasonWhileActive: CHECK_VIOLATION,
    });
  });

  it("L3E-T4 lets an influx_% role given a right lift a block once and nothing else, and delete one only as the erasure (55000 otherwise)", async () => {
    const outcome = await scenario(async (tx) => {
      await seedReasons(tx);
      const brand = await newAccount(tx, "advertiser");
      const creator = await newAccount(tx, "creator");
      const id = await block(tx, brand, creator);
      // rights granted inside the rolled-back transaction only, so that the guard is what refuses
      await tx.unsafe(
        "grant usage on schema matching to influx_admin, influx_privacy_definer",
      );
      await tx.unsafe(
        "grant select, update, delete on matching.party_blocks to influx_admin, influx_privacy_definer",
      );
      await tx.unsafe(
        "create policy l3e_t4_probe on matching.party_blocks for all " +
          "to influx_admin, influx_privacy_definer using (true) with check (true)",
      );
      await tx.unsafe("set local role influx_admin");
      const result = {
        reason: codeOf(
          await run(
            tx,
            "update matching.party_blocks set reason_code = 'probe_any' where id = $1::uuid",
            [id],
          ),
        ),
        adminDelete: codeOf(
          await run(
            tx,
            "delete from matching.party_blocks where id = $1::uuid",
            [id],
          ),
        ),
        lift: codeOf(
          await run(
            tx,
            "update matching.party_blocks set lifted_at = now(), lifted_by_account_id = $2::uuid, " +
              "lift_reason_code = 'resolved' where id = $1::uuid",
            [id, adminA],
          ),
        ),
        relift: codeOf(
          await run(
            tx,
            "update matching.party_blocks set lifted_at = now() + interval '1 hour' " +
              "where id = $1::uuid",
            [id],
          ),
        ),
        reactivate: codeOf(
          await run(
            tx,
            "update matching.party_blocks set lifted_at = null, lifted_by_account_id = null, " +
              "lift_reason_code = null where id = $1::uuid",
            [id],
          ),
        ),
      };
      await tx.unsafe("reset role");
      await tx.unsafe("set local role influx_privacy_definer");
      const erased = await run<{ id: string }>(
        tx,
        "delete from matching.party_blocks where id = $1::uuid returning id::text",
        [id],
      );
      await tx.unsafe("reset role");
      return { ...result, erased };
    });
    expect(outcome).toEqual({
      reason: NOT_IN_PREREQUISITE_STATE,
      adminDelete: NOT_IN_PREREQUISITE_STATE,
      lift: "ok",
      relift: NOT_IN_PREREQUISITE_STATE,
      reactivate: NOT_IN_PREREQUISITE_STATE,
      erased: { outcome: "rows", rows: [{ id: expect.any(String) }] },
    });
  });
});

describe("L3E-T4 the blocked pair absent from the creator's read of the open campaigns (10 RG28 to RG30; 11 CA8)", () => {
  it("L3E-T4 hides the campaign of a brand from a creator in both directions, silently: out of the feed and its total, the record answered as an unknown one, the logo not visible; present again after the lift", async () => {
    const outcome = await scenario(async (tx) => {
      await seedReasons(tx);
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const before = await readsOf(tx, creator, campaign);
      const unknown = await actAsMember(
        tx,
        "influx_creator",
        { accountId: creator, role: "creator", aal: "aal1" },
        async () => run<{ answer: Row }>(tx, RECORD, [randomUUID()]),
      );
      const byBrand = await block(tx, brand, creator, "advertiser");
      const blockedByBrand = await readsOf(tx, creator, campaign);
      await lift(tx, byBrand, brand);
      const afterBrandLift = await readsOf(tx, creator, campaign);
      const byCreator = await block(tx, brand, creator, "creator");
      const blockedByCreator = await readsOf(tx, creator, campaign);
      await lift(tx, byCreator, creator);
      const afterCreatorLift = await readsOf(tx, creator, campaign);
      return {
        before,
        unknownRecord:
          unknown.outcome === "rows" ? unknown.rows[0]?.answer : undefined,
        blockedByBrand,
        afterBrandLift,
        blockedByCreator,
        afterCreatorLift,
      };
    });
    expect(outcome.before).toMatchObject({
      inFeed: true,
      total: 1,
      logo: true,
    });
    expect(outcome.before.record).toMatchObject({ outcome: "served" });
    for (const blocked of [outcome.blockedByBrand, outcome.blockedByCreator]) {
      expect(blocked).toMatchObject({ inFeed: false, total: 0, logo: false });
      // T14: one body, that of an unknown campaign
      expect(blocked.record).toEqual(outcome.unknownRecord);
      expect(blocked.record).toEqual({ outcome: "refused" });
    }
    for (const lifted of [outcome.afterBrandLift, outcome.afterCreatorLift]) {
      expect(lifted).toMatchObject({ inFeed: true, total: 1, logo: true });
      expect(lifted.record).toMatchObject({ outcome: "served" });
    }
  });

  it("L3E-T4 blocks the pair only: another creator still reads the campaign, the blocked creator still reads another brand's; the reason, its comment and who blocked are never served nor journaled for the creator", async () => {
    const outcome = await scenario(async (tx) => {
      await seedReasons(tx);
      const creator = await newCreator(tx);
      const otherCreator = await newCreator(tx);
      const brand = await newBrand(tx);
      const otherBrand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const otherCampaign = await newCampaign(tx, otherBrand);
      await block(tx, brand, creator, "advertiser");
      const blocked = await readsOf(tx, creator, campaign);
      const otherOfBlocked = await readsOf(tx, creator, otherCampaign);
      const other = await readsOf(tx, otherCreator, campaign);
      const journal = await tx<{ line: string }[]>`
        select row_to_json(r)::text as line from search.creator_campaign_reads r
         where creator_account_id = ${creator}`;
      return {
        blocked,
        otherOfBlocked,
        other,
        journal: journal.map((row) => row.line).join("\n"),
        brand,
      };
    });
    expect(outcome.blocked).toMatchObject({ inFeed: false, total: 1 });
    expect(outcome.otherOfBlocked).toMatchObject({ inFeed: true, total: 1 });
    expect(outcome.otherOfBlocked.record).toMatchObject({ outcome: "served" });
    expect(outcome.other).toMatchObject({ inFeed: true, total: 2, logo: true });
    // RG30: no trace of the block in what the creator reads nor in its journal lines
    for (const text of [outcome.blocked.raw, outcome.journal]) {
      for (const marker of [
        REASON_COMMENT,
        "probe_explain",
        "block",
        outcome.brand,
      ]) {
        expect(text).not.toContain(marker);
      }
    }
    expect(outcome.journal).toContain('"outcome":"refused"');
  });
});

describe("L3E-T4 the codes and the declaration (F3; 18 TM11)", () => {
  it("L3E-T4 keeps block.created and block.lifted excluded from the export, with no writer at Lot 3, and loads no reason (modele §9)", async () => {
    const outcome = await scenario(async (tx) => {
      const codes = await tx<Row[]>`
        select code, domain, subject_type, severity, export_class
          from audit.event_types where code in ('block.created', 'block.lifted') order by code`;
      const [written] = await tx<{ count: number }[]>`
        select count(*)::int as count from audit.audit_events
         where event_type in ('block.created', 'block.lifted')`;
      const reasons = await tx<{ code: string }[]>`
        select code from matching.block_reasons order by code`;
      return {
        codes,
        written: written?.count,
        reasons: reasons.map((r) => r.code),
      };
    });
    expect(outcome.codes).toEqual([
      {
        code: "block.created",
        domain: "matching",
        subject_type: "party_block",
        severity: "sensitive",
        export_class: "excluded_third_party",
      },
      {
        code: "block.lifted",
        domain: "matching",
        subject_type: "party_block",
        severity: "sensitive",
        export_class: "excluded_third_party",
      },
    ]);
    expect(outcome.written).toBe(0);
    // the data set's reason only (T2 needs a row): the migration loads none
    expect(outcome.reasons).toEqual(["dataset_probe"]);
  });

  it("L3E-T4 declares every table of the schema matching with exactly its columns", async () => {
    const catalogue = await scenario(
      (tx) => tx<{ name: string; columns: string[] }[]>`
        select c.relname as name, array_agg(a.attname::text order by a.attname) as columns
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
         where n.nspname = 'matching' and c.relkind in ('r', 'p')
         group by c.relname order by c.relname`,
    );
    const declared = Object.fromEntries(
      Object.entries(matchingColumns()).map(([table, columns]) => [
        table,
        [...columns].sort(),
      ]),
    );
    expect(declared).toEqual(
      Object.fromEntries(
        catalogue.map((row) => [row.name, [...row.columns].sort()]),
      ),
    );
    expect(Object.keys(declared)).toHaveLength(2);
  });
});
