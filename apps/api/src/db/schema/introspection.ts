// Column names of the Drizzle declarations, for the tests that derive a list from them instead of
// writing it by hand (18 TM11: the identifying fields of a creator). drizzle-orm stays confined to
// src/db (02 §5 rule 6): the tests ask this module and never import the library themselves.
import { getTableConfig, type PgTable } from "drizzle-orm/pg-core";
import * as profilesCreatorIdentity from "./profiles-creator-identity.ts";

/** Database column names of every table declared in profiles-creator-identity.ts, by table. */
export function creatorIdentityColumns(): Record<string, string[]> {
  const columns: Record<string, string[]> = {};
  for (const exported of Object.values(profilesCreatorIdentity)) {
    if (typeof exported === "object" && exported !== null) {
      const config = getTableConfig(exported as PgTable);
      columns[config.name] = config.columns.map((column) => column.name);
    }
  }
  return columns;
}
