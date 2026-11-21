// Schema `search`, migrations 0314 (the journal of the creator's reads of the open campaigns,
// jalons/l3d/modele.md §6), 0316 (the journal of the creator search, its settings, the brand's
// shortlists and the counters of critical mass, jalons/l3e/modele.md §7, §9), 0323 (the openings
// of an anonymous profile, jalons/l3f/modele.md §2) and 0325 (the requests for a selection by the
// team, §6). The SQL is the source
// of truth: this file is aligned by hand, never generated, and held to the catalogue by
// db-tests/search-journal-settings.test.ts (TM11). Declaring a column here grants nothing: no
// execution role holds a right on a table of this schema (03 P2; l3e fiche invariant 1); the doors
// (SECURITY DEFINER functions) read and write it. search_queries.result_count is the EXACT count,
// never served nor exported (the brand reads a band, 10 RG59).
import {
  bigint,
  boolean,
  char,
  date,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const searchSchema = pgSchema("search");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/** 0314: one line per read of the feed or of a record by a creator. */
export const creatorCampaignReads = searchSchema.table(
  "creator_campaign_reads",
  {
    id: bigint("id", { mode: "number" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    creatorAccountId: uuid("creator_account_id").notNull(),
    kind: text("kind").notNull(),
    campaignId: uuid("campaign_id"),
    feedSort: text("feed_sort"),
    feedPage: smallint("feed_page"),
    outcome: text("outcome").notNull(),
    readAt: timestamptz("read_at").notNull().defaultNow(),
  },
);

/** 0316: the reasons (« Proposé car ») and the vigilance notes, codes and parameter keys only. */
export const explanationReasons = searchSchema.table("explanation_reasons", {
  code: text("code").primaryKey(),
  kind: text("kind").notNull(),
  labelKey: text("label_key").notNull(),
  tier: smallint("tier"),
  paramKeys: text("param_keys").array().notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

/** 0316: the opening of each facet (10 RG11 to RG14). */
export const facetSettings = searchSchema.table("facet_settings", {
  facetCode: text("facet_code").primaryKey(),
  wave: smallint("wave").notNull(),
  isOpen: boolean("is_open").notNull(),
  displayOrder: smallint("display_order").notNull(),
  updatedByAccountId: uuid("updated_by_account_id"),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/** 0316: eight keys closed by CHECK, a zod schema per key (@influx/contracts/search-settings). */
export const searchSettings = searchSchema.table("search_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedByAccountId: uuid("updated_by_account_id"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/** 0316: one version per change of the facets, k or the cold quota (10 RG88), append-only. */
export const facetConfigVersions = searchSchema.table("facet_config_versions", {
  version: bigint("version", { mode: "number" })
    .primaryKey()
    .generatedAlwaysAsIdentity(),
  changedAt: timestamptz("changed_at").notNull().defaultNow(),
  changedByAccountId: uuid("changed_by_account_id"),
  snapshot: jsonb("snapshot").notNull(),
  note: text("note"),
});

/** 0316: one line per search (10 RG66, CA47), append-only outside the erasure. */
export const searchQueries = searchSchema.table("search_queries", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  actorRole: text("actor_role").notNull(),
  viewMode: text("view_mode").notNull(),
  campaignId: uuid("campaign_id"),
  outcome: text("outcome").notNull(),
  filters: jsonb("filters").notNull().default({}),
  sortCode: text("sort_code").notNull(),
  facetConfigVersion: bigint("facet_config_version", {
    mode: "number",
  }).notNull(),
  resultCount: integer("result_count").notNull(),
  pageReached: smallint("page_reached").notNull(),
  blockedByKAnonymity: boolean("blocked_by_k_anonymity")
    .notNull()
    .default(false),
  requestId: text("request_id"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  // 0329: the prefill of « Compatible creators » an identified search starts from
  prefillId: uuid("prefill_id"),
});

/**
 * 0329: one line per prefill of « Compatible creators » proposed to an agent (l3g/modele.md §4; 10
 * RG73, CA56): the codes drawn from the brief of an admitted campaign, append-only.
 */
export const campaignPrefills = searchSchema.table("campaign_prefills", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  campaignId: uuid("campaign_id").notNull(),
  proposed: jsonb("proposed").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

/** 0316: one line per creator served, with its rank (10 RG66, CA48). */
export const searchImpressions = searchSchema.table(
  "search_impressions",
  {
    searchQueryId: uuid("search_query_id").notNull(),
    creatorAccountId: uuid("creator_account_id").notNull(),
    rank: smallint("rank").notNull(),
    coldQuota: boolean("cold_quota").notNull().default(false),
    vigilanceCode: text("vigilance_code"),
    wasOpened: boolean("was_opened").notNull().default(false),
    openedAt: timestamptz("opened_at"),
  },
  (table) => [
    primaryKey({ columns: [table.searchQueryId, table.creatorAccountId] }),
  ],
);

/** 0316: the reasons shown on a card, as shown (10 RG41): codes and bands, never a number. */
export const impressionReasons = searchSchema.table(
  "impression_reasons",
  {
    searchQueryId: uuid("search_query_id").notNull(),
    creatorAccountId: uuid("creator_account_id").notNull(),
    reasonCode: text("reason_code").notNull(),
    position: smallint("position").notNull(),
    reasonParams: jsonb("reason_params").notNull().default({}),
  },
  (table) => [
    primaryKey({
      columns: [table.searchQueryId, table.creatorAccountId, table.reasonCode],
    }),
  ],
);

/** 0316: the first page 1 of a search that served a creator (the cold quota of 0320). */
export const creatorExposures = searchSchema.table("creator_exposures", {
  creatorAccountId: uuid("creator_account_id").primaryKey(),
  firstPageAt: timestamptz("first_page_at").notNull(),
});

/**
 * 0323: one line per opening of an anonymous profile by a brand, served or refused (l3f/modele.md
 * §2); the bucket of profileOpensPerDay, append-only, never served nor exported.
 */
export const profileOpenings = searchSchema.table("profile_openings", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  outcome: text("outcome").notNull(),
  creatorAccountId: uuid("creator_account_id"),
  searchQueryId: uuid("search_query_id"),
  requestId: text("request_id"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

/** 0316: the brand's private shortlists (no member right until the doors of L3F). */
export const shortlists = searchSchema.table("shortlists", {
  id: uuid("id").primaryKey().defaultRandom(),
  advertiserAccountId: uuid("advertiser_account_id").notNull(),
  name: text("name").notNull(),
  campaignId: uuid("campaign_id"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const shortlistItems = searchSchema.table(
  "shortlist_items",
  {
    shortlistId: uuid("shortlist_id").notNull(),
    creatorAccountId: uuid("creator_account_id").notNull(),
    addedAt: timestamptz("added_at").notNull().defaultNow(),
    note: text("note"),
  },
  (table) => [
    primaryKey({ columns: [table.shortlistId, table.creatorAccountId] }),
  ],
);

/**
 * 0325: the brand's requests for a selection by the INFLUX team (l3f/modele.md §6; 10 RG61): every
 * criterion, the campaign, the language, the deadline of queue 9; the message read by agents alone.
 * 0330 (l3g/modele.md §5): the claim and the closure of queue 9 (reason, agent, date; note iff other).
 */
export const selectionRequests = searchSchema.table("selection_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  advertiserAccountId: uuid("advertiser_account_id").notNull(),
  campaignId: uuid("campaign_id"),
  filters: jsonb("filters").notNull().default({}),
  language: char("language", { length: 2 }).notNull(),
  message: text("message"),
  state: text("state").notNull().default("open"),
  slaDueAt: timestamptz("sla_due_at").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  claimedByAccountId: uuid("claimed_by_account_id"),
  claimedAt: timestamptz("claimed_at"),
  claimExpiresAt: timestamptz("claim_expires_at"),
  closedAt: timestamptz("closed_at"),
  closedByAccountId: uuid("closed_by_account_id"),
  closeReasonCode: text("close_reason_code"),
  closeNote: text("close_note"),
});

/** 0316: the daily counters of critical mass (D38), written by the task of L3G. */
export const supplyCounters = searchSchema.table(
  "supply_counters",
  {
    snapshotOn: date("snapshot_on").notNull(),
    dimension: text("dimension").notNull(),
    dimensionValue: text("dimension_value").notNull().default("*"),
    publishedProfilesCount: integer("published_profiles_count").notNull(),
    searchableProfilesCount: integer("searchable_profiles_count").notNull(),
    computedAt: timestamptz("computed_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.snapshotOn, table.dimension, table.dimensionValue],
    }),
  ],
);
