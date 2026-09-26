// Schema `billing`, migration 0007: commission_rates is EMPTY and read-only at the MVP
// (CLAUDE.md §3, 18 T16). Declared so that the catalogue check covers it; no code reads it.
import { integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const billing = pgSchema("billing");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const rateScope = billing.enum("rate_scope", [
  "platform_default",
  "account",
]);

export const commissionRates = billing.table("commission_rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  scope: rateScope("scope").notNull(),
  accountId: uuid("account_id"),
  advertiserRateBp: integer("advertiser_rate_bp").notNull(),
  creatorRateBp: integer("creator_rate_bp").notNull(),
  effectiveFrom: timestamptz("effective_from").notNull(),
  effectiveTo: timestamptz("effective_to"),
  note: text("note"),
  createdByAccountId: uuid("created_by_account_id").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
