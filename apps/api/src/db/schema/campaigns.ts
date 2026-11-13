// Schema `campaigns`, migrations 0303 (L3B commit 02, jalons/l3b/modele.md §2 to §4) and 0305 (the
// texts of the declaration of RG85, modele §5). The SQL is the
// source of truth: this file is aligned by hand, never generated, and held to the catalogue by
// db-tests/campaigns-core.test.ts (TM11). Declaring a column here grants nothing: every read and
// write stays subject to the GRANTs and policies of the role taken (03 P2); influx_creator holds
// nothing on this schema (D78). The exact range per creator is declared because it exists, empty
// and without any right (D78): no code reads nor writes it.
import {
  bigint,
  boolean,
  char,
  date,
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
