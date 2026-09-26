// Schema `backoffice`, migration 0008_backoffice_ownership. The SQL is the source of truth: this
// file is aligned by hand and checked against the catalogue by db-tests/drizzle-schema.test.ts.
import { sql } from "drizzle-orm";
import { boolean, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const backoffice = pgSchema("backoffice");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const ownershipAssignments = backoffice.table("ownership_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id"),
  introductionId: uuid("introduction_id"),
  dealId: uuid("deal_id"),
  agentAccountId: uuid("agent_account_id").notNull(),
  agentIsInternal: boolean("agent_is_internal")
    .notNull()
    .generatedAlwaysAs(sql`true`),
  assignedAt: timestamptz("assigned_at").notNull().defaultNow(),
  unassignedAt: timestamptz("unassigned_at"),
  assignedByAccountId: uuid("assigned_by_account_id"),
  reasonCode: text("reason_code").notNull(),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});
