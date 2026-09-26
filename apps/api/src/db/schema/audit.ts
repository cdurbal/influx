// Schema `audit`, migration 0006_audit_chain. The SQL is the source of truth: this file is
// aligned by hand and checked against the catalogue by db-tests/drizzle-schema.test.ts.
// NOBODY writes these tables through Drizzle: the register is written by audit.append() only
// (03 C(37)), and read by an administrator in aal2.
import {
  bigint,
  boolean,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { bytea } from "./column-types.ts";

export const audit = pgSchema("audit");

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const actorType = audit.enum("actor_type", [
  "member",
  "agent",
  "admin",
  "system",
  "service",
]);

export const eventTypes = audit.table("event_types", {
  code: text("code").primaryKey(),
  domain: text("domain").notNull(),
  subjectType: text("subject_type").notNull(),
  severity: text("severity").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
});

export const auditEvents = audit.table(
  "audit_events",
  {
    chainKey: text("chain_key").notNull().default("global"),
    seq: bigint("seq", { mode: "bigint" }).notNull(),
    id: uuid("id").notNull().defaultRandom(),
    occurredAt: timestamptz("occurred_at").notNull(),
    recordedAt: timestamptz("recorded_at").notNull(),
    eventType: text("event_type").notNull(),
    actorType: actorType("actor_type").notNull(),
    actorAccountId: uuid("actor_account_id"),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    payload: jsonb("payload").notNull().default({}),
    requestId: text("request_id"),
    hashAlgo: text("hash_algo").notNull().default("sha256"),
    hashVersion: smallint("hash_version").notNull().default(1),
    payloadHash: bytea("payload_hash").notNull(),
    prevHash: bytea("prev_hash").notNull(),
    rowHash: bytea("row_hash").notNull(),
  },
  (table) => [primaryKey({ columns: [table.chainKey, table.seq] })],
);

export const chainChecks = audit.table("chain_checks", {
  id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
  chainKey: text("chain_key").notNull(),
  checkedAt: timestamptz("checked_at").notNull().defaultNow(),
  isFull: boolean("is_full").notNull(),
  fromSeq: bigint("from_seq", { mode: "bigint" }).notNull(),
  toSeq: bigint("to_seq", { mode: "bigint" }).notNull(),
  status: text("status").notNull(),
  anomaly: text("anomaly"),
  brokenAtSeq: bigint("broken_at_seq", { mode: "bigint" }),
  durationMs: integer("duration_ms").notNull(),
  headRowHash: bytea("head_row_hash").notNull(),
});
