// Schema `profiles`, the identifying objects of the creator profile, migration 0217 (L2D,
// jalons/l2d/modele.md §0217). The SQL is the source of truth: this file is aligned by hand, never
// generated. Layers I and N only (07 RG16): kept apart from the storefront (profiles.ts) so that the
// identifying fields have ONE module, the list TM11 derives (no other contract declares them).
// Declaring a column grants nothing: influx_advertiser holds no right on any of these tables (03 P5,
// 04 §11.3, non reversible).
import {
  bigint,
  boolean,
  char,
  integer,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles.ts";

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/** Layer N: never revealed (07 RG36, RG40; D79 for the city). */
export const creatorIdentities = profiles.table("creator_identities", {
  accountId: uuid("account_id").primaryKey(),
  legalFirstName: text("legal_first_name"),
  legalLastName: text("legal_last_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  addressLine: text("address_line"),
  postalCode: text("postal_code"),
  city: text("city"),
  countryCode: char("country_code", { length: 2 }),
  completenessPercent: smallint("completeness_percent").notNull().default(0),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/** Layer I: one line per network account, exact figures (07 RG41 to RG47). */
export const creatorSocialAccounts = profiles.table("creator_social_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull(),
  networkCode: text("network_code").notNull(),
  isPrimary: boolean("is_primary").notNull().default(false),
  handle: text("handle"),
  pseudonym: text("pseudonym"),
  profileUrl: text("profile_url"),
  followersCount: bigint("followers_count", { mode: "number" }),
  postsLast30Days: integer("posts_last_30_days"),
  avgCommentsPerPost: bigint("avg_comments_per_post", { mode: "number" }),
  avgReachPerPost: bigint("avg_reach_per_post", { mode: "number" }),
  engagementRateBp: integer("engagement_rate_bp"),
  figuresSource: text("figures_source").notNull().default("declared"),
  figuresMeasuredAt: timestamptz("figures_measured_at"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

/** Layer I: exact audience by country of a line (07 RG56, RG57); slot 0 is the main country. */
export const creatorAudienceCountries = profiles.table(
  "creator_audience_countries",
  {
    socialAccountId: uuid("social_account_id").notNull(),
    accountId: uuid("account_id").notNull(),
    slot: smallint("slot").notNull(),
    countryCode: char("country_code", { length: 2 }).notNull(),
    sharePercent: smallint("share_percent"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.socialAccountId, table.slot] })],
);

/** Layer I: exact audience by age band of a line (07 RG57, RG60). */
export const creatorAudienceAges = profiles.table(
  "creator_audience_ages",
  {
    socialAccountId: uuid("social_account_id").notNull(),
    accountId: uuid("account_id").notNull(),
    ageBandCode: text("age_band_code").notNull(),
    sharePercent: smallint("share_percent").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.socialAccountId, table.ageBandCode] }),
  ],
);

/** Layer I: exact audience by gender of a line (07 RG57, RG61): the audience, never the creator. */
export const creatorAudienceGenders = profiles.table(
  "creator_audience_genders",
  {
    socialAccountId: uuid("social_account_id").notNull(),
    accountId: uuid("account_id").notNull(),
    genderCode: text("gender_code").notNull(),
    sharePercent: smallint("share_percent").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.socialAccountId, table.genderCode] }),
  ],
);

/** Layer N: never exposed, explained nor counted (07 RG75). */
export const creatorRefusedSectors = profiles.table(
  "creator_refused_sectors",
  {
    accountId: uuid("account_id").notNull(),
    sectorCode: text("sector_code").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.sectorCode] })],
);

/** Layer N, append-only (07 RG119): read by agent and admin only, written by 0218. */
export const creatorNetworkMetricsHistory = profiles.table(
  "creator_network_metrics_history",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    accountId: uuid("account_id").notNull(),
    socialAccountId: uuid("social_account_id").notNull(),
    networkCode: text("network_code").notNull(),
    followersCount: bigint("followers_count", { mode: "number" }),
    postsLast30Days: integer("posts_last_30_days"),
    avgCommentsPerPost: bigint("avg_comments_per_post", { mode: "number" }),
    figuresSource: text("figures_source").notNull(),
    confirmed: boolean("confirmed").notNull().default(false),
    recordedAt: timestamptz("recorded_at").notNull().defaultNow(),
    recordedByAccountId: uuid("recorded_by_account_id").notNull(),
  },
);
