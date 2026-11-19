// Schema `matching`, migration 0317 (the block between a brand and a creator, 04 §5.6,
// jalons/l3e/modele.md §9): its other tables come with Lot 4. The SQL is the source of truth: this
// file is aligned by hand, never generated, and held to the catalogue by
// db-tests/matching-party-blocks.test.ts (TM11). Declaring a column here grants nothing: no execution
// role holds a right on a table of this schema at Lot 3 (l3e fiche invariant 1); the owner of the
// creator's doors reads the pair and lifted_at of the caller's active blocks only (RG30).
import { boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const matchingSchema = pgSchema("matching");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

/** 0317: the typed reasons of a block, one list per side; empty until the gesture (Lot 4). */
export const blockReasons = matchingSchema.table("block_reasons", {
  code: text("code").primaryKey(),
  labelKey: text("label_key").notNull(),
  availableToSide: text("available_to_side").notNull(),
  requiresComment: boolean("requires_comment").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
});

/** 0317: one block between a brand and a creator, symmetric in its effect, kept when lifted. */
export const partyBlocks = matchingSchema.table("party_blocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  advertiserAccountId: uuid("advertiser_account_id").notNull(),
  creatorAccountId: uuid("creator_account_id").notNull(),
  blockedByAccountId: uuid("blocked_by_account_id").notNull(),
  blockedBySide: text("blocked_by_side").notNull(),
  reasonCode: text("reason_code").notNull(),
  comment: text("comment"),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  liftedAt: timestamptz("lifted_at"),
  liftedByAccountId: uuid("lifted_by_account_id"),
  liftReasonCode: text("lift_reason_code"),
});
