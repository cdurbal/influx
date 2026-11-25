// Schema `campaigns`, migrations 0303 (L3B commit 02, jalons/l3b/modele.md §2 to §4), 0305 (the
// texts of the declaration of RG85, modele §5), 0307 (queue 7, l3c/modele.md §1), 0308 (the
// publication and its snapshot, l3c/modele.md §2) and 0309 (the cycle and the interventions of an
// agent, l3c/modele.md §5, §6). The SQL is the
// source of truth: this file is aligned by hand, never generated, and held to the catalogue by
// db-tests/campaigns-core.test.ts (TM11). Declaring a column here grants nothing: every read and
// write stays subject to the GRANTs and policies of the role taken (03 P2); influx_creator holds
// nothing on this schema (D78). The exact range per creator is declared because it exists, empty
// and without any right (D78): no code reads nor writes it.
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  date,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea } from "./column-types.ts";

export const campaignsSchema = pgSchema("campaigns");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const campaignStatus = campaignsSchema.enum("campaign_status", [
  "draft",
  "pending_review",
  "published",
  "paused",
  "closed",
  "rejected",
]);

export const remunerationKind = campaignsSchema.enum("remuneration_kind", [
  "cash",
  "cash_and_gift",
  "gift_only",
  "affiliate",
]);

export const requestedItems = campaignsSchema.table("requested_items", {
  code: text("code").primaryKey(),
  labelKey: text("label_key").notNull(),
  position: smallint("position").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});

export const rejectionReasons = campaignsSchema.table("rejection_reasons", {
  code: text("code").primaryKey(),
  labelKey: text("label_key").notNull(),
  messageKey: text("message_key").notNull(),
  requiresMemberMessage: boolean("requires_member_message")
    .notNull()
    .default(false),
  nextStep: text("next_step").notNull(),
  position: smallint("position").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

/** 0305: the exact text of the declaration of RG85 per locale, and the SHA-256 of its UTF-8 bytes. */
export const authorizationDeclarationTexts = campaignsSchema.table(
  "authorization_declaration_texts",
  {
    locale: text("locale").primaryKey(),
    body: text("body").notNull(),
    bodySha256: bytea("body_sha256").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
);

export const campaigns = campaignsSchema.table("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  advertiserAccountId: uuid("advertiser_account_id").notNull(),
  status: campaignStatus("status").notNull().default("draft"),
  title: text("title"),
  campaignTypeCode: text("campaign_type_code"),
  publicSummary: text("public_summary"),
  brief: text("brief"),
  internalReference: text("internal_reference"),
  productDescription: text("product_description"),
  sectorCode: text("sector_code"),
  restrictions: text("restrictions"),
  productIsSent: boolean("product_is_sent"),
  productValueBandCode: text("product_value_band_code"),
  creatorKeepsProduct: boolean("creator_keeps_product"),
  shippingCostsBorneBy: text("shipping_costs_borne_by"),
  usageRightsCode: text("usage_rights_code"),
  usageRightsDurationBand: text("usage_rights_duration_band"),
  usageRightsTerritoryScope: text("usage_rights_territory_scope"),
  exclusivityBand: text("exclusivity_band"),
  contentReviewDelay: text("content_review_delay"),
  audienceGenderCode: text("audience_gender_code"),
  currency: char("currency", { length: 3 }),
  remunerationKind: remunerationKind("remuneration_kind"),
  perCreatorBudgetBandCode: text("per_creator_budget_band_code"),
  perCreatorAmountMinMinor: bigint("per_creator_amount_min_minor", {
    mode: "number",
  }),
  perCreatorAmountMaxMinor: bigint("per_creator_amount_max_minor", {
    mode: "number",
  }),
  creatorsWanted: smallint("creators_wanted"),
  totalBudgetMinor: bigint("total_budget_minor", { mode: "number" }),
  applicationsCloseOn: date("applications_close_on"),
  contentDueOn: date("content_due_on"),
  startsOn: date("starts_on"),
  endsOn: date("ends_on"),
  maxApplications: smallint("max_applications"),
  authorizationsDeclaredAt: timestamptz("authorizations_declared_at"),
  authorizationsDeclaredByAccountId: uuid(
    "authorizations_declared_by_account_id",
  ),
  authorizationsDeclarationLocale: char("authorizations_declaration_locale", {
    length: 2,
  }),
  authorizationsDeclarationHash: bytea("authorizations_declaration_hash"),
  submittedAt: timestamptz("submitted_at"),
  erasedAt: timestamptz("erased_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  // 0308: the responsible salesperson (internal FK), the snapshot served, the first publication
  ownerAgentId: uuid("owner_agent_id"),
  ownerAgentIsInternal: boolean("owner_agent_is_internal")
    .notNull()
    .generatedAlwaysAs(sql`true`),
  currentSnapshotId: uuid("current_snapshot_id"),
  firstPublishedAt: timestamptz("first_published_at"),
  // 0309: the cycle, stamped by campaigns.stamp_campaign_cycle() (nobody writes these columns)
  pausedAt: timestamptz("paused_at"),
  pauseOrigin: text("pause_origin"),
  closedAt: timestamptz("closed_at"),
});

export const campaignKeyMessages = campaignsSchema.table(
  "campaign_key_messages",
  {
    campaignId: uuid("campaign_id").notNull(),
    position: smallint("position").notNull(),
    body: text("body").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.position] })],
);

export const campaignDeliverables = campaignsSchema.table(
  "campaign_deliverables",
  {
    campaignId: uuid("campaign_id").notNull(),
    slot: smallint("slot").notNull(),
    networkCode: text("network_code").notNull(),
    formatCode: text("format_code").notNull(),
    quantity: smallint("quantity").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.slot] })],
);

export const campaignUsageTerritories = campaignsSchema.table(
  "campaign_usage_territories",
  {
    campaignId: uuid("campaign_id").notNull(),
    slot: smallint("slot").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.slot] })],
);

export const campaignAudienceCountries = campaignsSchema.table(
  "campaign_audience_countries",
  {
    campaignId: uuid("campaign_id").notNull(),
    slot: smallint("slot").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.slot] })],
);

export const campaignAudienceLanguages = campaignsSchema.table(
  "campaign_audience_languages",
  {
    campaignId: uuid("campaign_id").notNull(),
    languageCode: char("language_code", { length: 2 }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.languageCode] })],
);

export const campaignAudienceBands = campaignsSchema.table(
  "campaign_audience_bands",
  {
    campaignId: uuid("campaign_id").notNull(),
    audienceBandCode: text("audience_band_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.campaignId, table.audienceBandCode] }),
  ],
);

export const campaignAudienceAgeBands = campaignsSchema.table(
  "campaign_audience_age_bands",
  {
    campaignId: uuid("campaign_id").notNull(),
    ageBandCode: text("age_band_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.ageBandCode] })],
);

export const campaignTopics = campaignsSchema.table(
  "campaign_topics",
  {
    campaignId: uuid("campaign_id").notNull(),
    slot: smallint("slot").notNull(),
    topicCode: text("topic_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.slot] })],
);

export const campaignRequestedItems = campaignsSchema.table(
  "campaign_requested_items",
  {
    campaignId: uuid("campaign_id").notNull(),
    slot: smallint("slot").notNull(),
    itemCode: text("item_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.campaignId, table.slot] })],
);

/** 0307 (L3C commit 02, l3c/modele.md §1): the state of an entry of queue 7. */
export const reviewEntryState = campaignsSchema.enum("review_entry_state", [
  "open",
  "published",
  "rejected",
  "withdrawn",
]);

/**
 * 0307: queue 7, one entry per examination of a submitted campaign (the lock, the deadlines frozen
 * at the entry, the first review of an enhanced review, the decision, the duplicate alert of RG95).
 * sla_breached is generated by the base. The brand reads its own entries without the agent columns;
 * agent and admin never read the opinion nor the internal comment (column grants).
 */
export const campaignReviewEntries = campaignsSchema.table(
  "campaign_review_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    advertiserAccountId: uuid("advertiser_account_id").notNull(),
    state: reviewEntryState("state").notNull().default("open"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    slaDueAt: timestamptz("sla_due_at").notNull(),
    escalateAt: timestamptz("escalate_at"),
    claimedByAccountId: uuid("claimed_by_account_id"),
    claimedAt: timestamptz("claimed_at"),
    claimExpiresAt: timestamptz("claim_expires_at"),
    forcedReleaseAt: timestamptz("forced_release_at"),
    forcedReleaseByAccountId: uuid("forced_release_by_account_id"),
    forcedReleaseHolderAccountId: uuid("forced_release_holder_account_id"),
    forcedReleaseReasonCode: text("forced_release_reason_code"),
    firstReviewedByAccountId: uuid("first_reviewed_by_account_id"),
    firstReviewedAt: timestamptz("first_reviewed_at"),
    firstReviewOpinion: text("first_review_opinion"),
    decidedByAccountId: uuid("decided_by_account_id"),
    decidedAt: timestamptz("decided_at"),
    rejectionReasonCode: text("rejection_reason_code"),
    memberMessage: text("member_message"),
    internalComment: text("internal_comment"),
    duplicateOfCampaignId: uuid("duplicate_of_campaign_id"),
    closedAt: timestamptz("closed_at"),
    slaBreached: boolean("sla_breached").notNull(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    // 0310: the erasure of the account emptied the three texts (privacy.execute_request() only)
    textsErasedAt: timestamptz("texts_erased_at"),
  },
);

/**
 * 0308 (L3C commit 03, l3c/modele.md §2): what a creator reads of a published campaign, the output of
 * campaign_creator_view() at the decision (TM5.6), versioned per campaign, immutable outside the
 * erasure. Written by publish_campaign_review_entry() only; never read by influx_creator directly.
 */
export const campaignPublishedSnapshots = campaignsSchema.table(
  "campaign_published_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id").notNull(),
    version: smallint("version").notNull(),
    payload: jsonb("payload").notNull(),
    contentHash: bytea("content_hash").notNull(),
    publishedAt: timestamptz("published_at").notNull(),
    publishedByAccountId: uuid("published_by_account_id").notNull(),
    firstReviewedByAccountId: uuid("first_reviewed_by_account_id"),
    reviewEntryId: uuid("review_entry_id").notNull(),
  },
);

/**
 * 0309 (L3C commit 04, l3c/modele.md §6): one line per act of an agent on a campaign (created,
 * corrected, paused, resumed, closed), old and new value of a corrected field, typed reason, internal
 * comment (never read by agent or admin), author. Immutable outside the erasure; written by the
 * functions of influx_campaign_review_definer only.
 */
export const agentInterventions = campaignsSchema.table("agent_interventions", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id").notNull(),
  advertiserAccountId: uuid("advertiser_account_id").notNull(),
  kind: text("kind").notNull(),
  fieldCode: text("field_code"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  reasonCode: text("reason_code").notNull(),
  internalComment: text("internal_comment"),
  agentAccountId: uuid("agent_account_id").notNull(),
  agentIsInternal: boolean("agent_is_internal")
    .notNull()
    .generatedAlwaysAs(sql`true`),
  reviewEntryId: uuid("review_entry_id"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
});
