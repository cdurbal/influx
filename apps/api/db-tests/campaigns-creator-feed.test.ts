// L3D commit 02 — the creator's read of the open campaigns, in the base (0314; docs/mvp/11 RG13,
// RG14, RG21 to RG26, RG33, RG35, RG42, CA8, CA9, CA15 to CA18; 09 RG99 to RG101; 18 TM5.2, TM5.6,
// T14, T15.3 to T15.5; jalons/l3d/modele.md, which prevails for every name; fiche invariants 1 to 9).
//   L3D-T2  the three doors of the schema search (feed, record, logo) for influx_creator only; the
//           visibility computed in SQL (published, brand published and active, the deadline and the
//           end on the UTC day, a refused sector silently, greyed for 7 days); the two sorts and the
//           rank; the cap of pages; the bucket of the account; the journal of the reads; one body for
//           every refusal (T14); the rights of the owner and of the creator (TM5.6, D46, D78).
//   L3E-T1  (L3E commit 01, 0315, L3DS-1) the bucket bounded under refusals: one rate_limited line
//           per account in the window that refuses, the Retry-After unchanged, the count on the
//           partial index creator_campaign_reads_bucket_idx.
// Each case runs in a rolled-back transaction of the local superuser, which first closes the campaigns
// earlier files left published (the feed reads every published campaign of the base), then writes
// the fixtures outside the guards and acts as apps/api does (support.ts: actAsMember).
import {
  accountIdOf,
  closeStalePublishedCampaigns,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";
import { civilDateIn } from "./campaign-dates-kit.ts";
import { publishAsInflux } from "./campaign-publication-kit.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
type Parameter = postgres.ParameterOrJSON<never> | undefined;

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";

const FEED =
  "select search.read_open_campaigns($1::text, $2::integer) as answer";
const RECORD = "select search.read_open_campaign($1::uuid) as answer";
const LOGO =
  "select visible, object_key, width, height, activated_at " +
  "from search.read_open_campaign_brand_logo($1::uuid)";
const NOWHERE = "00000000-0000-4000-8000-00000000d3d2";

/** What must reach no output served to a creator (D46, D78, TM5.6; fiche invariants 1, 2). */
const MARKERS = {
  contactFirstName: "Ondine-L3D02",
  contactEmail: "ondine.l3d02.contact@example.test",
  contactPhone: "+33612398746",
  contactUrl: "https://www.example.test/l3d02-contact-page",
  internalLegalName: "L3D02 Internal Legal Name",
  registrationNumber: "L3D02REG778899",
  internalReference: "L3D02-INTERNAL-REF",
} as const;

/** Keys no answer of a door holds, at any depth (RG11, RG25, RG37, RG38, CA4, CA10; invariant 1). */
const FORBIDDEN_KEYS = new Set([
  "currency",
  "productValueBand",
  "productValueBandCode",
  "product_value_band_code",
  "perCreatorBudgetBand",
  "perCreatorBudgetBandCode",
  "per_creator_budget_band_code",
  "perCreatorAmountMinMinor",
  "perCreatorAmountMaxMinor",
  "totalBudget",
  "totalBudgetMinor",
  "total_budget_minor",
  "internalReference",
  "internal_reference",
  "internalNote",
  "internal_note",
  "authorizationsDeclaration",
  "authorizationsDeclaredAt",
  "authorizations_declaration_hash",
  "sectorIsSensitive",
  "is_sensitive",
  "status",
  "maxApplications",
  "max_applications",
  "ownerAgentId",
  "owner_agent_id",
  "contact",
  "contact_first_name",
  "contact_email",
  "contact_phone",
  "contact_url",
  "firstName",
  "email",
  "phone",
  "registration_number",
  "registrationNumber",
  "applicationsCount",
  "viewsCount",
]);

/** The keys of PublishedBrandPublicRow (apps/api profiles/repository.ts), modele §1. */
const BRAND_ROW_KEYS = [
  "audienceCountries",
  "badge_granted_at",
  "collaboration_rhythm",
  "company_size_band",
  "contact_role",
  "country",
  "exclusivity_band",
  "formats",
  "has_logo",
  "legal_name",
  "networks",
  "offers_non_monetary",
  "presentation",
  "primary_sector_code",
  "secondarySectors",
  "targetMarkets",
  "topics",
  "usageRights",
  "website_domain",
  "workingLanguages",
];

const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");
const brandA = accountIdOf("advertiser", "a");

beforeAll(async () => {
  await testDataSet();
});

/** A rolled-back transaction where no campaign of an earlier file is still published. */
function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    await closeStalePublishedCampaigns(tx);
    return fn(tx);
  });
}

type Refusal = { outcome: "error"; code: string; detail: string | undefined };
type Outcome<T> = { outcome: "rows"; rows: T[] } | Refusal;

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE and detail. */
async function run<T = Row>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...result] as T[] };
  } catch (error) {
    const found = error as { code?: string; detail?: string };
    if (found.code === undefined) throw error;
    return { outcome: "error", code: found.code, detail: found.detail };
  }
}

function codeOf(result: Outcome<unknown>): string {
  return result.outcome === "error" ? result.code : "rows";
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

/** The answer of a door called by the creator; throws on an error. */
async function answer(
  tx: Tx,
  creator: string,
  statement: string,
  parameters: readonly Parameter[],
): Promise<Row> {
  const result = await asCreator(tx, creator, () =>
    run<{ answer: Row }>(tx, statement, parameters),
  );
  if (result.outcome === "error") {
    throw new Error(`${result.code} ${result.detail ?? ""}`);
  }
  return result.rows[0]?.answer ?? {};
}

function feed(
  tx: Tx,
  creator: string,
  sort: string = "recent",
  page: number = 1,
): Promise<Row> {
  return answer(tx, creator, FEED, [sort, page]);
}

function record(tx: Tx, creator: string, campaign: string): Promise<Row> {
  return answer(tx, creator, RECORD, [campaign]);
}

type Logo = {
  visible: boolean;
  object_key: string | null;
  width: number | null;
  height: number | null;
  activated_at: Date | null;
};

async function logo(tx: Tx, creator: string, campaign: string): Promise<Logo> {
  const result = await asCreator(tx, creator, () =>
    run<Logo>(tx, LOGO, [campaign]),
  );
  if (result.outcome === "error") {
    throw new Error(`${result.code} ${result.detail ?? ""}`);
  }
  const [row] = result.rows;
  if (row === undefined) throw new Error("no logo row");
  return row;
}

/** The identifiers of the cards of an answer of the feed, in their order. */
function idsOf(page: Row): string[] {
  return ((page.items as Row[] | undefined) ?? []).map((item) =>
    String(item.id),
  );
}

type Read = {
  kind: string;
  campaign_id: string | null;
  feed_sort: string | null;
  feed_page: number | null;
  outcome: string;
  at_now: boolean;
};

async function readsOf(tx: Tx, creator: string): Promise<Read[]> {
  return tx<Read[]>`
    select kind, campaign_id::text, feed_sort, feed_page, outcome, read_at = now() as at_now
      from search.creator_campaign_reads
     where creator_account_id = ${creator}
     order by id`;
}

async function setting(tx: Tx, key: string, value: number): Promise<void> {
  await tx`update backoffice.operational_settings set value = to_jsonb(${value}::integer)
            where key = ${key}`;
}

/** Every key of a JSON value, at any depth. */
function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysOf);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [
      key,
      ...keysOf(child),
    ]);
  }
  return [];
}

// the fixtures ------------------------------------------------------------------------------------

/** A creator account and its storefront in `state` (draft by default, 07 RG7). */
async function newCreator(tx: Tx, state: string = "draft"): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3d-t2-${id}@example.test`}, now(), 'FR', 'fr',
            'L3D T2 Creator', true, now(), 'individual')`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, 'creator')`;
  await tx`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')`;
  if (state !== "draft") {
    await tx`update profiles.creator_public_profiles
                set status = ${state}::profiles.creator_profile_status
              where account_id = ${id}`;
  }
  return id;
}

/**
 * A brand with its profile PUBLISHED, every public field and list filled, its contact block and its
 * internal block holding the markers (never served, D46).
 */
async function newBrand(
  tx: Tx,
  name: string = "L3D T2 Brand",
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3d-t2-brand-${id}@example.test`}, now(), 'FR', 'fr',
            'L3D T2 Brand Person', true, now(), 'business')`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, 'advertiser')`;
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, ${name}, 'beauty_personal_care', '11_50', 'l3d-t2-brand.example',
            'A brand of the L3D tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  // slots in an order that is not the alphabetical one, to see the order of listColumn()
  await tx`insert into profiles.advertiser_secondary_sectors (account_id, slot, sector_code)
           values (${id}, 1, 'retail_ecommerce'), (${id}, 2, 'home_garden')`;
  await tx`insert into profiles.advertiser_target_markets (account_id, slot, country_code)
           values (${id}, 1, 'FR'), (${id}, 2, 'BE')`;
  await tx`insert into profiles.advertiser_working_languages (account_id, language_code)
           values (${id}, 'fr'), (${id}, 'en')`;
  await tx`insert into profiles.advertiser_topics (account_id, slot, topic_code)
           values (${id}, 1, 'wellness'), (${id}, 2, 'beauty')`;
  await tx`insert into profiles.advertiser_networks (account_id, network_code)
           values (${id}, 'tiktok'), (${id}, 'instagram')`;
  await tx`insert into profiles.advertiser_formats (account_id, format_code)
           values (${id}, 'tiktok_video'), (${id}, 'instagram_reel')`;
  await tx`insert into profiles.advertiser_audience_countries (account_id, slot, country_code)
           values (${id}, 1, 'FR'), (${id}, 2, 'CH')`;
  await tx`insert into profiles.advertiser_usage_rights (account_id, usage_right_code)
           values (${id}, 'organic_repost')`;
  await tx`
    insert into profiles.advertiser_contact_details
      (account_id, contact_first_name, contact_email, contact_phone, contact_url)
    values (${id}, ${MARKERS.contactFirstName}, ${MARKERS.contactEmail}, ${MARKERS.contactPhone},
            ${MARKERS.contactUrl})`;
  await tx`
    insert into profiles.advertiser_internal_details
      (account_id, legal_name, registration_country_code, registration_number)
    values (${id}, ${MARKERS.internalLegalName}, 'FR', ${MARKERS.registrationNumber})`;
  await tx`update profiles.advertiser_profiles set status = 'published' where account_id = ${id}`;
  return id;
}

/** The active logo of a brand (stockage.md §5): its row, never an object. */
async function giveLogo(tx: Tx, brand: string): Promise<string> {
  const [row] = await tx<{ object_key: string }[]>`
    insert into profiles.brand_logo_objects
      (account_id, state, received_bytes, byte_size, width, height, activated_at)
    values (${brand}, 'active', 2048, 1024, 256, 128, now())
    returning object_key`;
  if (row === undefined) throw new Error("no logo");
  return row.object_key;
}

/** The badge « Marque vérifiée » as a decision of an agent writes it (0224): its ISO date. */
async function giveBadge(tx: Tx, brand: string): Promise<string> {
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests (account_id, level, status)
    values (${brand}, 'brand_verified', 'pending') returning id::text`;
  await tx`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  const [badge] = await tx<{ granted_at: string }[]>`
    insert into verification.badges
      (account_id, request_id, level, granted_by_account_id, granted_at, evidence_source,
       registry_source_id, expires_at)
    select ${brand}, ${request?.id ?? null}, 'brand_verified', ${agentA},
           date_trunc('milliseconds', now()), 'domain_and_registry', s.id,
           now() + interval '12 months'
      from verification.registry_sources s where s.is_active order by s.id limit 1
    returning to_char(granted_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as granted_at`;
  if (badge === undefined)
    throw new Error("no registry source to grant a badge from");
  return badge.granted_at;
}

type CampaignOptions = {
  /** Days from today to the application deadline (10 by default). */
  closeIn?: number;
  /** Days from today to the end of the period (60 by default). */
  endIn?: number;
  sector?: string;
  /** The first publication, when it matters (RG103). */
  publishedAt?: string;
};

/**
 * A complete campaign of `brand`, its internal reference, budget and band filled, put in the
 * published state as INFLUX would (campaign-publication-kit), its commercial owner named.
 */
async function newCampaign(
  tx: Tx,
  brand: string,
  options: CampaignOptions = {},
): Promise<string> {
  const closeOn = civilDateIn(options.closeIn ?? 10);
  const endsOn = civilDateIn(options.endIn ?? 60);
  // RG70: deadline <= delivery <= start <= end; the two middle dates on the deadline
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns
      (advertiser_account_id, status, title, campaign_type_code, public_summary, brief,
       internal_reference, product_description, sector_code, restrictions, product_is_sent,
       product_value_band_code, creator_keeps_product, shipping_costs_borne_by, usage_rights_code,
       usage_rights_duration_band, usage_rights_territory_scope, exclusivity_band,
       content_review_delay, audience_gender_code, currency, remuneration_kind,
       per_creator_budget_band_code, creators_wanted, total_budget_minor, applications_close_on,
       content_due_on, starts_on, ends_on, max_applications, submitted_at)
    values (${brand}, 'pending_review', 'L3D T2 campaign title', 'product_placement',
            ${`L3D T2 summary ${"s".repeat(120)}`}, ${`L3D T2 brief ${"b".repeat(300)}`},
            ${MARKERS.internalReference}, ${`L3D T2 product ${"p".repeat(20)}`},
            ${options.sector ?? "sports_leisure"}, 'L3D T2 restrictions', true, 'under_100', true,
            'brand', 'organic_repost', '3m', 'worldwide', 'none', '5bd', 'mixed', 'EUR', 'cash',
            '500_1000', 3, 3000000, ${closeOn}, ${closeOn}, ${closeOn}, ${endsOn}, 50, now())
    returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  await tx`
    insert into campaigns.campaign_key_messages (campaign_id, position, body)
    values (${row.id}, 1, 'L3D T2 key message')`;
  await tx`
    insert into campaigns.campaign_deliverables
      (campaign_id, slot, network_code, format_code, quantity)
    values (${row.id}, 1, 'tiktok', 'tiktok_video', 1), (${row.id}, 2, 'instagram', 'instagram_reel', 2)`;
  await tx`
    insert into campaigns.campaign_audience_countries (campaign_id, slot, country_code)
    values (${row.id}, 1, 'FR'), (${row.id}, 2, 'BE')`;
  await tx`
    insert into campaigns.campaign_topics (campaign_id, slot, topic_code)
    values (${row.id}, 1, 'beauty')`;
  await publishAsInflux(tx, row.id);
  await tx`update campaigns.campaigns set owner_agent_id = ${agentB} where id = ${row.id}`;
  if (options.publishedAt !== undefined) {
    await tx`update campaigns.campaigns set first_published_at = ${options.publishedAt}::timestamptz
              where id = ${row.id}`;
  }
  return row.id;
}

/** A campaign of `brand` left in `state` without a publication (draft, pending_review, rejected). */
async function unpublishedCampaign(
  tx: Tx,
  brand: string,
  state: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns (advertiser_account_id, title)
    values (${brand}, 'L3D T2 unpublished') returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  if (state !== "draft") {
    // the fields a submission requires, then the state
    await tx`
      update campaigns.campaigns
         set campaign_type_code = 'product_placement', public_summary = ${"s".repeat(130)},
             brief = ${"b".repeat(310)}, product_description = 'L3D T2 product description',
             sector_code = 'sports_leisure', product_is_sent = false,
             usage_rights_code = 'organic_repost', usage_rights_duration_band = '3m',
             usage_rights_territory_scope = 'worldwide', exclusivity_band = 'none',
             content_review_delay = '5bd', currency = 'EUR', remuneration_kind = 'cash',
             per_creator_budget_band_code = '500_1000', creators_wanted = 3,
             applications_close_on = ${civilDateIn(10)}, content_due_on = ${civilDateIn(10)},
             starts_on = ${civilDateIn(10)}, ends_on = ${civilDateIn(60)},
             title = 'L3D T2 unpublished title', submitted_at = now(),
             status = ${state}::campaigns.campaign_status
       where id = ${row.id}`;
  }
  return row.id;
}

// the rights ---------------------------------------------------------------------------------------

describe("L3D-T2 the rights of the doors (modele §1; TM5.6, L3C-T3)", () => {
  it("gives influx_creator USAGE on search and EXECUTE on the three doors only; nothing on campaigns, profiles.advertiser_* nor a table of search", async () => {
    const migration = migrationRole();
    const [schemas] = await migration<
      { campaigns: boolean; search: boolean }[]
    >`
      select has_schema_privilege('influx_creator', 'campaigns', 'USAGE') as campaigns,
             has_schema_privilege('influx_creator', 'search', 'USAGE') as search`;
    expect(schemas).toEqual({ campaigns: false, search: true });
    const tables = await migration<{ name: string }[]>`
      select c.oid::regclass::text as name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where c.relkind in ('r', 'p', 'v', 'm')
         and (n.nspname in ('campaigns', 'search')
              or (n.nspname = 'profiles' and c.relname like 'advertiser\\_%'))
         and (has_table_privilege('influx_creator', c.oid, 'SELECT, INSERT, UPDATE, DELETE')
              or has_any_column_privilege('influx_creator', c.oid, 'SELECT, INSERT, UPDATE'))`;
    expect(tables).toEqual([]);
    const functions = await migration<{ name: string }[]>`
      select p.oid::regprocedure::text as name
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('campaigns', 'search')
         and has_function_privilege('influx_creator', p.oid, 'EXECUTE')`;
    expect(functions.map((row) => row.name).sort()).toEqual([
      "search.read_open_campaign(uuid)",
      "search.read_open_campaign_brand_logo(uuid)",
      "search.read_open_campaigns(text,integer)",
    ]);
  });

  it("makes influx_campaign_feed_definer NOLOGIN NOINHERIT without member; it reads eight columns of a campaign and never a coordinate, the internal block, a band, a budget nor the owner, and writes its journal lines only", async () => {
    const migration = migrationRole();
    const [role] = await migration<Row[]>`
      select rolcanlogin, rolinherit, rolbypassrls, rolsuper,
             (select count(*)::int from pg_catalog.pg_auth_members m
               where m.roleid = r.oid and (m.inherit_option or m.set_option)) as members
        from pg_catalog.pg_roles r where rolname = 'influx_campaign_feed_definer'`;
    expect(role).toEqual({
      rolcanlogin: false,
      rolinherit: false,
      rolbypassrls: false,
      rolsuper: false,
      members: 0,
    });
    const columns = await migration<{ name: string }[]>`
      select at.attname::text as name
        from pg_catalog.pg_attribute at
       where at.attrelid = 'campaigns.campaigns'::regclass and at.attnum > 0
         and not at.attisdropped
         and has_column_privilege('influx_campaign_feed_definer', at.attrelid, at.attnum, 'SELECT')`;
    expect(columns.map((row) => row.name).sort()).toEqual([
      "advertiser_account_id",
      "applications_close_on",
      "current_snapshot_id",
      "ends_on",
      "first_published_at",
      "id",
      "sector_code",
      "status",
    ]);
    const [blocks] = await migration<Row[]>`
      select has_any_column_privilege('influx_campaign_feed_definer',
                                      'profiles.advertiser_contact_details', 'SELECT') as contact,
             has_any_column_privilege('influx_campaign_feed_definer',
                                      'profiles.advertiser_internal_details', 'SELECT') as internal`;
    expect(blocks).toEqual({ contact: false, internal: false });
    const writes = await migration<{ name: string }[]>`
      select c.oid::regclass::text || ' ' || x.privilege as name
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace,
             unnest(array['INSERT', 'UPDATE', 'DELETE']) x (privilege)
       where n.nspname not like 'pg\\_%' and n.nspname <> 'information_schema'
         and c.relkind in ('r', 'p')
         and (has_table_privilege('influx_campaign_feed_definer', c.oid, x.privilege)
              or (x.privilege <> 'DELETE'
                  and has_any_column_privilege('influx_campaign_feed_definer', c.oid, x.privilege)))
       order by 1`;
    expect(writes.map((row) => row.name)).toEqual([
      "search.creator_campaign_reads INSERT",
    ]);
  });

  it("keeps the journal immutable: no role updates a line, the erasure alone deletes those of an erased account", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      await feed(tx, creator);
      await tx.unsafe("set local role influx_campaign_feed_definer");
      const update = await run(
        tx,
        "update search.creator_campaign_reads set outcome = 'refused' " +
          "where creator_account_id = $1 returning 1",
        [creator],
      );
      await tx.unsafe("reset role");
      await tx.unsafe("set local role influx_privacy_definer");
      const whileActive = await run(
        tx,
        "delete from search.creator_campaign_reads where creator_account_id = $1 returning 1",
        [creator],
      );
      await tx.unsafe("reset role");
      await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                where id = ${creator}`;
      await tx.unsafe("set local role influx_privacy_definer");
      const onceErased = await run(
        tx,
        "delete from search.creator_campaign_reads where creator_account_id = $1 returning 1",
        [creator],
      );
      await tx.unsafe("reset role");
      return { update, whileActive, onceErased };
    });
    expect(codeOf(outcome.update)).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.whileActive).toEqual({ outcome: "rows", rows: [] });
    expect(outcome.onceErased).toMatchObject({ outcome: "rows", rows: [{}] });
  });

  it("refuses the three doors to the brand, the agent and the admin (T14: no EXECUTE, 42501)", async () => {
    const codes = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const campaign = await newCampaign(tx, brand);
      const statements: [string, Parameter[]][] = [
        [FEED, ["recent", 1]],
        [RECORD, [campaign]],
        [LOGO, [campaign]],
      ];
      const found: string[] = [];
      for (const [statement, parameters] of statements) {
        found.push(
          codeOf(
            await actAsMember(
              tx,
              "influx_advertiser",
              { accountId: brandA, role: "advertiser", aal: "aal1" },
              () => run(tx, statement, parameters),
            ),
          ),
        );
        for (const [role, account] of [
          ["influx_agent", agentA],
          ["influx_admin", adminA],
        ] as const) {
          found.push(
            codeOf(
              await actAsInternal(
                tx,
                role,
                {
                  accountId: account,
                  role: role === "influx_agent" ? "agent" : "admin",
                  aal: "aal2",
                },
                () => run(tx, statement, parameters),
              ),
            ),
          );
        }
      }
      return found;
    });
    expect(codes).toEqual(Array(9).fill(INSUFFICIENT_PRIVILEGE));
  });
});

// the caller ---------------------------------------------------------------------------------------

describe("L3D-T2 the caller (11 RG13, RG23; 09 RG99)", () => {
  it.each(["draft", "pending_review", "published", "rejected"])(
    "serves the feed and the record to a creator whose storefront is %s",
    async (state) => {
      const outcome = await scenario(async (tx) => {
        const creator = await newCreator(tx, state);
        const campaign = await newCampaign(tx, await newBrand(tx));
        return {
          feed: await feed(tx, creator),
          record: await record(tx, creator, campaign),
          campaign,
        };
      });
      expect(outcome.feed).toMatchObject({ outcome: "served", total: 1 });
      expect(idsOf(outcome.feed)).toEqual([outcome.campaign]);
      expect(outcome.record).toMatchObject({
        outcome: "served",
        id: outcome.campaign,
      });
    },
  );

  it("refuses a suspended storefront, a suspended account and a creator session on an advertiser account (42501), journaling nothing (RG23)", async () => {
    const outcome = await scenario(async (tx) => {
      const campaign = await newCampaign(tx, await newBrand(tx));
      const suspendedStorefront = await newCreator(tx, "suspended");
      const suspendedAccount = await newCreator(tx);
      await tx`update identity.accounts set status = 'suspended', suspended_at = now()
                where id = ${suspendedAccount}`;
      const codes: string[] = [];
      for (const creator of [suspendedStorefront, suspendedAccount, brandA]) {
        for (const [statement, parameters] of [
          [FEED, ["recent", 1]],
          [RECORD, [campaign]],
          [LOGO, [campaign]],
        ] as [string, Parameter[]][]) {
          codes.push(
            codeOf(
              await asCreator(tx, creator, () =>
                run(tx, statement, parameters),
              ),
            ),
          );
        }
      }
      const [lines] = await tx<{ n: number }[]>`
        select count(*)::int as n from search.creator_campaign_reads
         where creator_account_id in (${suspendedStorefront}, ${suspendedAccount}, ${brandA})
           and read_at = now()`;
      return { codes, lines: lines?.n };
    });
    expect(outcome.codes).toEqual(Array(9).fill(INSUFFICIENT_PRIVILEGE));
    expect(outcome.lines).toBe(0);
  });
});

// the visibility -----------------------------------------------------------------------------------

describe("L3D-T2 the visibility, computed in SQL (11 RG14, RG11, RG26, RG42; 09 RG100; TM5.2)", () => {
  it.each(["draft", "pending_review", "paused", "closed", "rejected"])(
    "TM5.2, RG100: a campaign %s is in no feed nor total, its record refused, its logo hidden",
    async (state) => {
      const outcome = await scenario(async (tx) => {
        const creator = await newCreator(tx);
        const brand = await newBrand(tx);
        await giveLogo(tx, brand);
        let campaign: string;
        if (state === "paused" || state === "closed") {
          campaign = await newCampaign(tx, brand);
          await tx`update campaigns.campaigns set status = ${state}::campaigns.campaign_status
                    where id = ${campaign}`;
        } else {
          campaign = await unpublishedCampaign(tx, brand, state);
        }
        return {
          feed: await feed(tx, creator),
          record: await record(tx, creator, campaign),
          logo: await logo(tx, creator, campaign),
        };
      });
      expect(outcome.feed).toMatchObject({
        outcome: "served",
        total: 0,
        items: [],
      });
      expect(outcome.record).toEqual({ outcome: "refused" });
      expect(outcome.logo).toEqual({
        visible: false,
        object_key: null,
        width: null,
        height: null,
        activated_at: null,
      });
    },
  );

  it("RG11, CA2: a published campaign of a brand whose profile is suspended, or whose account is suspended, is absent and refused", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const profileSuspended = await newBrand(tx);
      const accountSuspended = await newBrand(tx);
      const shown = await newCampaign(tx, await newBrand(tx));
      const first = await newCampaign(tx, profileSuspended);
      const second = await newCampaign(tx, accountSuspended);
      await tx`update profiles.advertiser_profiles set status = 'suspended'
                where account_id = ${profileSuspended}`;
      await tx`update identity.accounts set status = 'suspended', suspended_at = now()
                where id = ${accountSuspended}`;
      return {
        shown,
        feed: await feed(tx, creator),
        records: [
          await record(tx, creator, first),
          await record(tx, creator, second),
        ],
      };
    });
    expect(outcome.feed).toMatchObject({ total: 1 });
    expect(idsOf(outcome.feed)).toEqual([outcome.shown]);
    expect(outcome.records).toEqual([
      { outcome: "refused" },
      { outcome: "refused" },
    ]);
  });

  it("RG14 point 3, RG26: a deadline today is open; yesterday, the card is greyed and has no record", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      const today = await newCampaign(tx, brand, {
        closeIn: 0,
        publishedAt: "2026-11-01T10:00:00Z",
      });
      const yesterday = await newCampaign(tx, brand, {
        closeIn: -1,
        publishedAt: "2026-11-01T09:00:00Z",
      });
      return {
        today,
        yesterday,
        feed: await feed(tx, creator),
        records: [
          await record(tx, creator, today),
          await record(tx, creator, yesterday),
        ],
      };
    });
    const items = outcome.feed.items as Row[];
    expect(items.map((item) => [item.id, item.applicationsClosed])).toEqual([
      [outcome.today, false],
      [outcome.yesterday, true],
    ]);
    expect(outcome.records[0]).toMatchObject({ outcome: "served" });
    expect(outcome.records[1]).toEqual({ outcome: "refused" });
  });

  it("RG14 point 4: a period ending today is shown; one that ended yesterday is out of the feed and of the total", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      const today = await newCampaign(tx, brand, { closeIn: 0, endIn: 0 });
      const ended = await newCampaign(tx, brand, { closeIn: -1, endIn: -1 });
      return {
        today,
        ended,
        feed: await feed(tx, creator),
        record: await record(tx, creator, ended),
      };
    });
    expect(outcome.feed).toMatchObject({ total: 1 });
    expect(idsOf(outcome.feed)).toEqual([outcome.today]);
    expect(outcome.record).toEqual({ outcome: "refused" });
  });

  it("CA9, RG35: closed 3 days or 7 days, greyed and counted; 8 days, gone", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      const three = await newCampaign(tx, brand, {
        closeIn: -3,
        publishedAt: "2026-11-01T10:00:00Z",
      });
      const seven = await newCampaign(tx, brand, {
        closeIn: -7,
        publishedAt: "2026-11-01T09:00:00Z",
      });
      const eight = await newCampaign(tx, brand, {
        closeIn: -8,
        publishedAt: "2026-11-01T08:00:00Z",
      });
      return {
        three,
        seven,
        eight,
        feed: await feed(tx, creator),
        logo: await logo(tx, creator, eight),
      };
    });
    expect(outcome.feed).toMatchObject({ total: 2 });
    expect(
      (outcome.feed.items as Row[]).map((item) => [
        item.id,
        item.applicationsClosed,
      ]),
    ).toEqual([
      [outcome.three, true],
      [outcome.seven, true],
    ]);
    expect(outcome.logo.visible).toBe(false);
  });

  it("CA8, RG42: a sector the creator refuses is absent, out of the count, its record refused and its logo hidden; another creator sees it", async () => {
    const outcome = await scenario(async (tx) => {
      const refuser = await newCreator(tx);
      const other = await newCreator(tx);
      await tx`insert into profiles.creator_refused_sectors (account_id, sector_code)
               values (${refuser}, 'home_garden')`;
      const brand = await newBrand(tx);
      await giveLogo(tx, brand);
      const kept = await newCampaign(tx, brand);
      const refused = await newCampaign(tx, brand, { sector: "home_garden" });
      return {
        kept,
        refused,
        refuserFeed: await feed(tx, refuser),
        refuserRecord: await record(tx, refuser, refused),
        refuserLogo: await logo(tx, refuser, refused),
        otherFeed: await feed(tx, other),
      };
    });
    expect(outcome.refuserFeed).toMatchObject({ total: 1 });
    expect(idsOf(outcome.refuserFeed)).toEqual([outcome.kept]);
    expect(outcome.refuserRecord).toEqual({ outcome: "refused" });
    expect(outcome.refuserLogo.visible).toBe(false);
    expect(outcome.otherFeed).toMatchObject({ total: 2 });
    expect([...idsOf(outcome.otherFeed)].sort()).toEqual(
      [outcome.kept, outcome.refused].sort(),
    );
  });
});

// the feed -----------------------------------------------------------------------------------------

describe("L3D-T2 the feed (11 RG21, RG33, RG35, RG36, CA15 to CA18)", () => {
  it("CA15: sorted recent, the latest first publication first, no score", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      const oldest = await newCampaign(tx, brand, {
        publishedAt: "2026-11-01T08:00:00Z",
      });
      const latest = await newCampaign(tx, brand, {
        publishedAt: "2026-11-03T08:00:00Z",
      });
      const middle = await newCampaign(tx, brand, {
        publishedAt: "2026-11-02T08:00:00Z",
      });
      return { oldest, latest, middle, feed: await feed(tx, creator) };
    });
    expect(idsOf(outcome.feed)).toEqual([
      outcome.latest,
      outcome.middle,
      outcome.oldest,
    ]);
    expect(
      (outcome.feed.items as Row[]).map((item) => item.publishedOn),
    ).toEqual(["2026-11-03", "2026-11-02", "2026-11-01"]);
  });

  it("RG33 (deadline): the open campaigns first by their deadline, the greyed after", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      const greyed = await newCampaign(tx, brand, { closeIn: -2 });
      const far = await newCampaign(tx, brand, { closeIn: 20 });
      const near = await newCampaign(tx, brand, { closeIn: 5 });
      return {
        greyed,
        far,
        near,
        feed: await feed(tx, creator, "deadline"),
      };
    });
    expect(idsOf(outcome.feed)).toEqual([
      outcome.near,
      outcome.far,
      outcome.greyed,
    ]);
  });

  it("CA17: two campaigns of the same second, one per page: ordered by id, none twice, none lost", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "campaign_feed_page_size", 1);
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      const at = "2026-11-02T08:00:00Z";
      const ids = [
        await newCampaign(tx, brand, { publishedAt: at }),
        await newCampaign(tx, brand, { publishedAt: at }),
      ];
      return {
        ids,
        pages: [
          await feed(tx, creator, "recent", 1),
          await feed(tx, creator, "recent", 2),
          await feed(tx, creator, "recent", 1),
          await feed(tx, creator, "recent", 3),
        ],
      };
    });
    const [first, second, again, beyond] = outcome.pages;
    expect([...idsOf(first ?? {}), ...idsOf(second ?? {})]).toEqual(
      [...outcome.ids].sort(),
    );
    expect(idsOf(again ?? {})).toEqual(idsOf(first ?? {}));
    expect(first).toMatchObject({
      total: 2,
      page: 1,
      nextPage: 2,
      capReached: false,
    });
    expect(second).toMatchObject({
      total: 2,
      page: 2,
      nextPage: null,
      capReached: false,
    });
    expect(beyond).toMatchObject({
      total: 2,
      page: 3,
      nextPage: null,
      items: [],
    });
  });

  it("RG21, CA18: a page beyond the cap is refused and journaled, nothing served; the last page says the cap is reached", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "campaign_feed_page_size", 1);
      await setting(tx, "campaign_feed_max_pages", 2);
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      for (const day of ["01", "02", "03"]) {
        await newCampaign(tx, brand, {
          publishedAt: `2026-11-${day}T08:00:00Z`,
        });
      }
      return {
        last: await feed(tx, creator, "recent", 2),
        beyond: await feed(tx, creator, "deadline", 3),
        reads: await readsOf(tx, creator),
      };
    });
    expect(outcome.last).toMatchObject({
      outcome: "served",
      total: 3,
      page: 2,
      nextPage: null,
      capReached: true,
    });
    expect(idsOf(outcome.last)).toHaveLength(1);
    expect(outcome.beyond).toEqual({ outcome: "page_cap", maxPages: 2 });
    expect(outcome.reads).toEqual([
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "recent",
        feed_page: 2,
        outcome: "served",
        at_now: true,
      },
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "deadline",
        feed_page: 3,
        outcome: "page_cap",
        at_now: true,
      },
    ]);
  });

  it("refuses a sort or a page outside the contract (22023, DETAIL its name), journaling nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const results: Outcome<unknown>[] = [];
      for (const [sort, page] of [
        ["popular", 1],
        [null, 1],
        ["recent", 0],
        ["recent", 51],
        ["recent", null],
      ] as [string | null, number | null][]) {
        results.push(
          await asCreator(tx, creator, () =>
            run(tx, FEED, [sort ?? undefined, page ?? undefined]),
          ),
        );
      }
      results.push(
        await asCreator(tx, creator, () => run(tx, RECORD, [undefined])),
      );
      return { results, reads: await readsOf(tx, creator) };
    });
    expect(
      outcome.results.map((result) =>
        result.outcome === "error" ? [result.code, result.detail] : "rows",
      ),
    ).toEqual([
      [INVALID_PARAMETER, "sort"],
      [INVALID_PARAMETER, "sort"],
      [INVALID_PARAMETER, "page"],
      [INVALID_PARAMETER, "page"],
      [INVALID_PARAMETER, "page"],
      [INVALID_PARAMETER, "campaign"],
    ]);
    expect(outcome.reads).toEqual([]);
  });
});

// the record and the logo --------------------------------------------------------------------------

describe("L3D-T2 the record and the logo (11 RG15, RG16, RG24; 09 RG100; T14; D46)", () => {
  it("serves an open record: its id, the UTC day of its first publication, the snapshot whole, the brand row with the exact keys of PublishedBrandPublicRow", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const brand = await newBrand(tx, "L3D T2 Record Brand");
      await giveLogo(tx, brand);
      const badge = await giveBadge(tx, brand);
      // 23:30 in New York is the next day in UTC (modele §3: the UTC day)
      const campaign = await newCampaign(tx, brand, {
        publishedAt: "2026-11-17T23:30:00-05:00",
      });
      const [snapshot] = await tx<{ payload: Row }[]>`
        select s.payload from campaigns.campaign_published_snapshots s
          join campaigns.campaigns c on c.current_snapshot_id = s.id
         where c.id = ${campaign}`;
      return {
        campaign,
        badge,
        snapshot: snapshot?.payload,
        record: await record(tx, creator, campaign),
        card: ((await feed(tx, creator)).items as Row[])[0],
      };
    });
    expect(Object.keys(outcome.record).sort()).toEqual([
      "brand",
      "campaign",
      "id",
      "outcome",
      "publishedOn",
    ]);
    expect(outcome.record).toMatchObject({
      outcome: "served",
      id: outcome.campaign,
      publishedOn: "2026-11-18",
    });
    expect(outcome.record.campaign).toEqual(outcome.snapshot);
    const brand = outcome.record.brand as Row;
    expect(Object.keys(brand).sort()).toEqual(BRAND_ROW_KEYS);
    expect(brand).toEqual({
      legal_name: "L3D T2 Record Brand",
      country: "FR",
      primary_sector_code: "beauty_personal_care",
      company_size_band: "11_50",
      website_domain: "l3d-t2-brand.example",
      presentation: "A brand of the L3D tests, which writes its own words.",
      exclusivity_band: "le_3m",
      collaboration_rhythm: "recurring",
      offers_non_monetary: true,
      contact_role: "partnerships_influence",
      has_logo: true,
      badge_granted_at: outcome.badge,
      secondarySectors: ["retail_ecommerce", "home_garden"],
      targetMarkets: ["FR", "BE"],
      workingLanguages: ["en", "fr"],
      topics: ["wellness", "beauty"],
      networks: ["instagram", "tiktok"],
      formats: ["instagram_reel", "tiktok_video"],
      audienceCountries: ["FR", "CH"],
      usageRights: ["organic_repost"],
    });
    // the card carries the same snapshot and brand row, whole, apps/api picks from them (§3)
    expect(Object.keys(outcome.card ?? {}).sort()).toEqual([
      "applicationsClosed",
      "brand",
      "campaign",
      "id",
      "publishedOn",
    ]);
    expect(outcome.card).toEqual({
      id: outcome.campaign,
      publishedOn: "2026-11-18",
      applicationsClosed: false,
      campaign: outcome.snapshot,
      brand,
    });
  });

  it("T14, RG24: unknown, paused, greyed and of a suspended brand, one body { outcome: refused }, each journaled with the id asked", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      const paused = await newCampaign(tx, brand);
      await tx`update campaigns.campaigns set status = 'paused' where id = ${paused}`;
      const greyed = await newCampaign(tx, brand, { closeIn: -1 });
      const suspended = await newBrand(tx);
      const ofSuspended = await newCampaign(tx, suspended);
      await tx`update profiles.advertiser_profiles set status = 'suspended'
                where account_id = ${suspended}`;
      const asked = [NOWHERE, paused, greyed, ofSuspended];
      const bodies: string[] = [];
      for (const campaign of asked) {
        bodies.push(JSON.stringify(await record(tx, creator, campaign)));
      }
      return { asked, bodies, reads: await readsOf(tx, creator) };
    });
    expect(new Set(outcome.bodies)).toEqual(
      new Set([JSON.stringify({ outcome: "refused" })]),
    );
    expect(outcome.reads).toEqual(
      outcome.asked.map((campaign) => ({
        kind: "record",
        campaign_id: campaign,
        feed_sort: null,
        feed_page: null,
        outcome: "refused",
        at_now: true,
      })),
    );
  });

  it("the logo: the key and sides of the brand of an open or greyed campaign, nulls without a logo, never journaled", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const withLogo = await newBrand(tx);
      const key = await giveLogo(tx, withLogo);
      const open = await newCampaign(tx, withLogo);
      const greyed = await newCampaign(tx, withLogo, { closeIn: -2 });
      const withoutLogo = await newCampaign(tx, await newBrand(tx));
      return {
        key,
        logos: [
          await logo(tx, creator, open),
          await logo(tx, creator, greyed),
          await logo(tx, creator, withoutLogo),
          await logo(tx, creator, NOWHERE),
        ],
        reads: await readsOf(tx, creator),
      };
    });
    const [open, greyed, withoutLogo, unknown] = outcome.logos;
    expect(open).toMatchObject({
      visible: true,
      object_key: outcome.key,
      width: 256,
      height: 128,
    });
    expect(open?.activated_at).toBeInstanceOf(Date);
    expect(greyed).toEqual(open);
    expect(withoutLogo).toEqual({
      visible: true,
      object_key: null,
      width: null,
      height: null,
      activated_at: null,
    });
    expect(unknown).toEqual({
      visible: false,
      object_key: null,
      width: null,
      height: null,
      activated_at: null,
    });
    expect(outcome.reads).toEqual([]);
  });

  it("TM5.6, D46, D78: no answer holds an internal key, a coordinate, the commercial owner nor a marker of the brand's blocks", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const brand = await newBrand(tx);
      await giveBadge(tx, brand);
      const open = await newCampaign(tx, brand);
      const greyed = await newCampaign(tx, brand, { closeIn: -1 });
      return [
        await feed(tx, creator),
        await feed(tx, creator, "deadline"),
        await record(tx, creator, open),
        await record(tx, creator, greyed),
      ];
    });
    expect(idsOf(outcome[0] ?? {})).toHaveLength(2);
    const text = JSON.stringify(outcome);
    for (const marker of [...Object.values(MARKERS), agentB]) {
      expect(text.includes(marker), marker).toBe(false);
    }
    expect(keysOf(outcome).filter((key) => FORBIDDEN_KEYS.has(key))).toEqual(
      [],
    );
  });
});

// the journal and the bucket -----------------------------------------------------------------------

describe("L3D-T2 the journal and the bucket of the account (11 RG22, CA18; 18 T15.3 to T15.5)", () => {
  it("RG22: each read writes its line (account, kind, campaign or sort and page, outcome, instant), none for another creator", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const other = await newCreator(tx);
      const campaign = await newCampaign(tx, await newBrand(tx));
      await feed(tx, creator, "deadline", 1);
      await record(tx, creator, campaign);
      await logo(tx, creator, campaign);
      return {
        campaign,
        reads: await readsOf(tx, creator),
        others: await readsOf(tx, other),
      };
    });
    expect(outcome.reads).toEqual([
      {
        kind: "feed",
        campaign_id: null,
        feed_sort: "deadline",
        feed_page: 1,
        outcome: "served",
        at_now: true,
      },
      {
        kind: "record",
        campaign_id: outcome.campaign,
        feed_sort: null,
        feed_page: null,
        outcome: "served",
        at_now: true,
      },
    ]);
    expect(outcome.others).toEqual([]);
  });

  it("CA18, T15.5: beyond the minute, rate_limited with Retry-After 60 s, journaled once in the window (0315), never counted; the logo still served", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "creator_campaign_reads_per_minute", 2);
      const creator = await newCreator(tx);
      const campaign = await newCampaign(tx, await newBrand(tx));
      return {
        answers: [
          await feed(tx, creator),
          await record(tx, creator, campaign),
          await feed(tx, creator, "recent", 2),
          await record(tx, creator, campaign),
        ],
        logo: await logo(tx, creator, campaign),
        reads: await readsOf(tx, creator),
      };
    });
    const [first, second, third, fourth] = outcome.answers;
    expect(first).toMatchObject({ outcome: "served" });
    expect(second).toMatchObject({ outcome: "served" });
    expect(third).toEqual({ outcome: "rate_limited", retryAfterSeconds: 60 });
    expect(fourth).toEqual({ outcome: "rate_limited", retryAfterSeconds: 60 });
    expect(outcome.logo.visible).toBe(true);
    expect(outcome.reads.map((read) => [read.kind, read.outcome])).toEqual([
      ["feed", "served"],
      ["record", "served"],
      // L3DS-1 (0315, EC-L3E-01-1): the refusal of the record, in the same window, writes nothing
      ["feed", "rate_limited"],
    ]);
  });

  it("T15.4: the bucket is the account's, slides on 60 s and 24 h, and counts the refused reads and the cap of pages", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "creator_campaign_reads_per_minute", 2);
      await setting(tx, "campaign_feed_max_pages", 1);
      const creator = await newCreator(tx);
      const other = await newCreator(tx);
      // a refused record and a page beyond the cap fill the minute
      await record(tx, creator, NOWHERE);
      await feed(tx, creator, "recent", 2);
      const full = await feed(tx, creator);
      const otherServed = await feed(tx, other);
      // a line 50 s old and one 10 s old: the minute frees in 10 s, when the oldest leaves
      const sliding = await newCreator(tx);
      await tx`
        insert into search.creator_campaign_reads
          (creator_account_id, kind, feed_sort, feed_page, outcome, read_at)
        values (${sliding}, 'feed', 'recent', 1, 'served', now() - interval '50 seconds'),
               (${sliding}, 'feed', 'recent', 1, 'served', now() - interval '10 seconds'),
               (${sliding}, 'feed', 'recent', 1, 'served', now() - interval '61 seconds'),
               (${sliding}, 'feed', 'recent', 1, 'rate_limited', now() - interval '5 seconds')`;
      const slidingAnswer = await feed(tx, sliding);
      return { full, otherServed, slidingAnswer };
    });
    expect(outcome.full).toEqual({
      outcome: "rate_limited",
      retryAfterSeconds: 60,
    });
    expect(outcome.otherServed).toMatchObject({ outcome: "served" });
    expect(outcome.slidingAnswer).toEqual({
      outcome: "rate_limited",
      retryAfterSeconds: 10,
    });
  });

  it("T15.4: beyond the day, Retry-After at the exit of the oldest counted line of the 24 h", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "creator_campaign_reads_per_day", 3);
      const creator = await newCreator(tx);
      await tx`
        insert into search.creator_campaign_reads
          (creator_account_id, kind, feed_sort, feed_page, outcome, read_at)
        values (${creator}, 'feed', 'recent', 1, 'served', now() - interval '2 hours'),
               (${creator}, 'feed', 'recent', 1, 'page_cap', now() - interval '1 hour'),
               (${creator}, 'feed', 'recent', 1, 'served', now() - interval '30 minutes'),
               (${creator}, 'feed', 'recent', 1, 'served', now() - interval '25 hours')`;
      return {
        full: await feed(tx, creator),
        reads: await readsOf(tx, creator),
      };
    });
    expect(outcome.full).toEqual({
      outcome: "rate_limited",
      retryAfterSeconds: 22 * 3600,
    });
    expect(outcome.reads.at(-1)).toMatchObject({
      kind: "feed",
      outcome: "rate_limited",
      at_now: true,
    });
  });
});

// the bucket bounded under refusals (0315, L3DS-1) -------------------------------------------------

/** Writes lines of the journal of `creator` at `ago` before now (outcome, interval). */
async function pastReads(
  tx: Tx,
  creator: string,
  lines: readonly (readonly [string, string])[],
): Promise<void> {
  for (const [outcome, ago] of lines) {
    await tx`
      insert into search.creator_campaign_reads
        (creator_account_id, kind, feed_sort, feed_page, outcome, read_at)
      values (${creator}, 'feed', 'recent', 1, ${outcome}, now() - ${ago}::interval)`;
  }
}

function refusalsOf(reads: readonly Read[]): Read[] {
  return reads.filter((read) => read.outcome === "rate_limited");
}

describe("L3E-T1 the bucket stays bounded under refusals (0315, L3DS-1; 18 T15.5; fiche invariant 10)", () => {
  it("50 successive refusals, feed and record, write one rate_limited line per window, each answered with its Retry-After", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "creator_campaign_reads_per_minute", 2);
      await setting(tx, "creator_campaign_reads_per_day", 3);
      const minute = await newCreator(tx);
      const day = await newCreator(tx);
      const campaign = await newCampaign(tx, await newBrand(tx));
      await feed(tx, minute);
      await record(tx, minute, campaign);
      // the day full: its oldest counted line leaves in 22 h
      await pastReads(tx, day, [
        ["served", "2 hours"],
        ["page_cap", "1 hour"],
        ["served", "30 minutes"],
      ]);
      const minuteAnswers: Row[] = [];
      const dayAnswers: Row[] = [];
      for (let index = 0; index < 50; index += 1) {
        minuteAnswers.push(
          index % 2 === 0
            ? await feed(tx, minute)
            : await record(tx, minute, campaign),
        );
        dayAnswers.push(
          index % 2 === 0
            ? await feed(tx, day)
            : await record(tx, day, campaign),
        );
      }
      return {
        minuteAnswers,
        dayAnswers,
        minuteReads: await readsOf(tx, minute),
        dayReads: await readsOf(tx, day),
      };
    });
    expect(outcome.minuteAnswers).toEqual(
      Array.from({ length: 50 }, () => ({
        outcome: "rate_limited",
        retryAfterSeconds: 60,
      })),
    );
    expect(outcome.dayAnswers).toEqual(
      Array.from({ length: 50 }, () => ({
        outcome: "rate_limited",
        retryAfterSeconds: 22 * 3600,
      })),
    );
    expect(
      outcome.minuteReads.map((read) => [read.kind, read.outcome]),
    ).toEqual([
      ["feed", "served"],
      ["record", "served"],
      ["feed", "rate_limited"],
    ]);
    expect(refusalsOf(outcome.dayReads)).toEqual([
      expect.objectContaining({ kind: "feed", at_now: true }),
    ]);
    expect(outcome.dayReads).toHaveLength(4);
  });

  it("the window that refuses bounds the line: a minute's line 61 s old lets a new one in, a line within the full day does not; a read is served once the window has passed", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "creator_campaign_reads_per_minute", 2);
      await setting(tx, "creator_campaign_reads_per_day", 5);
      const campaign = await newCampaign(tx, await newBrand(tx));
      // the minute full, its last refusal 61 s ago: a new window, a new line
      const minute = await newCreator(tx);
      await pastReads(tx, minute, [
        ["rate_limited", "61 seconds"],
        ["served", "20 seconds"],
        ["served", "10 seconds"],
      ]);
      const minuteAnswer = await feed(tx, minute);
      // the day full, a refusal 90 minutes ago: the same window, no line (EC-L3E-01-2)
      const day = await newCreator(tx);
      await pastReads(tx, day, [
        ["served", "2 hours"],
        ["served", "110 minutes"],
        ["rate_limited", "90 minutes"],
        ["served", "1 hour"],
        ["served", "40 minutes"],
        ["served", "30 minutes"],
      ]);
      const dayAnswer = await record(tx, day, campaign);
      // the window passed: served, then the minute full again, refused with a line of its own
      const after = await newCreator(tx);
      await pastReads(tx, after, [
        ["served", "70 seconds"],
        ["served", "65 seconds"],
        ["rate_limited", "62 seconds"],
      ]);
      const afterAnswers = [
        await feed(tx, after),
        await record(tx, after, campaign),
        await feed(tx, after),
      ];
      return {
        minuteAnswer,
        minuteReads: await readsOf(tx, minute),
        dayAnswer,
        dayReads: await readsOf(tx, day),
        afterAnswers,
        afterReads: await readsOf(tx, after),
      };
    });
    expect(outcome.minuteAnswer).toEqual({
      outcome: "rate_limited",
      retryAfterSeconds: 40,
    });
    expect(refusalsOf(outcome.minuteReads).map((read) => read.at_now)).toEqual([
      false,
      true,
    ]);
    expect(outcome.dayAnswer).toEqual({
      outcome: "rate_limited",
      retryAfterSeconds: 22 * 3600,
    });
    expect(outcome.dayReads).toHaveLength(6);
    expect(outcome.dayReads.some((read) => read.at_now)).toBe(false);
    const [served, opened, refused] = outcome.afterAnswers;
    expect(served).toMatchObject({ outcome: "served" });
    expect(opened).toMatchObject({ outcome: "served" });
    expect(refused).toEqual({ outcome: "rate_limited", retryAfterSeconds: 60 });
    expect(
      outcome.afterReads
        .filter((read) => read.at_now)
        .map((read) => [read.kind, read.outcome]),
    ).toEqual([
      ["feed", "served"],
      ["record", "served"],
      ["feed", "rate_limited"],
    ]);
  });

  it("counts the bucket on the partial index creator_campaign_reads_bucket_idx, rate_limited lines out of it (explain, seqscan off)", async () => {
    const plan = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      await tx`
        insert into search.creator_campaign_reads
          (creator_account_id, kind, feed_sort, feed_page, outcome, read_at)
        select ${creator}, 'feed', 'recent', 1, 'rate_limited', now() - g * interval '1 second'
          from generate_series(1, 2000) g`;
      await pastReads(tx, creator, [["served", "10 seconds"]]);
      await tx`set local enable_seqscan = off`;
      // the count of search.campaign_read_retry_after() (0315 §2.1), word for word
      const rows = await tx.unsafe<{ "QUERY PLAN": string }[]>(
        `explain
         select (count(*) filter (where r.read_at > pg_catalog.now() - interval '60 seconds'))::integer,
                (count(*))::integer
           from search.creator_campaign_reads r
          where r.creator_account_id = $1
            and r.outcome <> 'rate_limited'
            and r.read_at > pg_catalog.now() - interval '24 hours'`,
        [creator],
      );
      return rows.map((row) => row["QUERY PLAN"]).join("\n");
    });
    expect(plan).toContain("creator_campaign_reads_bucket_idx");
    expect(plan).not.toContain("creator_campaign_reads_account_idx");
    expect(plan).not.toContain("Seq Scan");
  });
});
