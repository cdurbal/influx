// Schema `reference`, migration 0003_reference_core. The SQL is the source of truth: this file
// is aligned by hand and checked against the catalogue by db-tests/drizzle-schema.test.ts.
import {
  boolean,
  char,
  pgSchema,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const reference = pgSchema("reference");

export const countries = reference.table("countries", {
  code: char("code", { length: 2 }).primaryKey(),
  labelKey: text("label_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const currencies = reference.table("currencies", {
  code: char("code", { length: 3 }).primaryKey(),
  minorUnit: smallint("minor_unit").notNull(),
  labelKey: text("label_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const languages = reference.table("languages", {
  code: char("code", { length: 2 }).primaryKey(),
  labelKey: text("label_key").notNull(),
  isUiLanguage: boolean("is_ui_language").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
