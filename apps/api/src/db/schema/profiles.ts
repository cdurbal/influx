// Schema `profiles`, the creator storefront of migration 0216 (L2D, jalons/l2d/modele.md §0216).
// The SQL is the source of truth: this file is aligned by hand, never generated. Declaring a column
// here grants nothing: every read and write stays subject to the GRANTs and policies of the role
// taken (03 P2). Layer A only (07 RG16): bands, codes, dates, booleans and moderated texts; the
// identifying objects of 0217 are declared apart, with their own module.
import {
  boolean,
  char,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const profiles = pgSchema("profiles");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const creatorProfileStatus = profiles.enum("creator_profile_status", [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "suspended",
]);

export const creatorPublicProfiles = profiles.table("creator_public_profiles", {
  accountId: uuid("account_id").primaryKey(),
  publicRef: uuid("public_ref").notNull().defaultRandom(),
  alias: text("alias").notNull(),
  status: creatorProfileStatus("status").notNull().default("draft"),
  isSearchable: boolean("is_searchable").notNull().default(true),
  publishedAt: timestamptz("published_at"),
  headline: text("headline"),
  bio: text("bio"),
  primaryTopicCode: text("primary_topic_code"),
  residenceCountryCode: char("residence_country_code", { length: 2 }).notNull(),
  residenceRegionCode: text("residence_region_code"),
  travelScope: text("travel_scope"),
  collaborationExperienceBand: text("collaboration_experience_band"),
  mainAudienceCountry: char("main_audience_country", { length: 2 }),
  mainAudienceShareBand: text("main_audience_share_band"),
  audienceGenderBand: text("audience_gender_band"),
  deliveryLeadBand: text("delivery_lead_band"),
  maxExclusivityBand: text("max_exclusivity_band"),
  acceptsNonMonetary: boolean("accepts_non_monetary").notNull().default(false),
  availabilityBand: text("availability_band"),
  availabilityDeclaredAt: timestamptz("availability_declared_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const creatorTopics = profiles.table(
  "creator_topics",
  {
    accountId: uuid("account_id").notNull(),
    slot: smallint("slot").notNull(),
    topicCode: text("topic_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.slot] })],
);

export const creatorPublicationLanguages = profiles.table(
  "creator_publication_languages",
  {
    accountId: uuid("account_id").notNull(),
    slot: smallint("slot").notNull(),
    languageCode: char("language_code", { length: 2 }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.slot] })],
);

export const creatorTones = profiles.table(
  "creator_tones",
  {
    accountId: uuid("account_id").notNull(),
    slot: smallint("slot").notNull(),
    toneCode: text("tone_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.slot] })],
);

export const creatorFormats = profiles.table(
  "creator_formats",
  {
    accountId: uuid("account_id").notNull(),
    formatCode: text("format_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.formatCode] })],
);

export const creatorUsageRights = profiles.table(
  "creator_usage_rights",
  {
    accountId: uuid("account_id").notNull(),
    usageRightCode: text("usage_right_code").notNull(),
    inclusion: text("inclusion").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.usageRightCode] })],
);
