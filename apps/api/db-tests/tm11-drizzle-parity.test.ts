// TM11, its source (docs/mvp/18 TM11; jalons/l2f/16.md "TM11 dérivé de Drizzle"). TM11.1 to TM11.3
// (tests/tm11-identifying-fields.test.ts) derive the forbidden names from the Drizzle declarations of
// the identifying objects, which are aligned by hand on the SQL (src/db/schema/verification.ts: "never
// generated"). A table a migration adds without its declaration, or a column the declaration misses,
// would escape the derivation silently. This file holds the declarations to the catalogue of the
// migrated base: every base table of `verification` is declared, and every declared table of
// verification.ts and profiles-creator-identity.ts has exactly the columns of its relation.
//   TM11-P1  the schema `verification`: the same tables, the L2F ones among them (0231 to 0234)
//   TM11-P2  every declared table: the same column names as the catalogue, generated ones included
//   TM11-W   witness: a column the declaration does not know is reported
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  creatorIdentityColumns,
  verificationColumns,
} from "../src/db/schema/introspection.ts";
import { localSuperuser } from "./support.ts";

type Sql = postgres.Sql;

/** The tables of the L2F migrations (0231 to 0234), which TM11.3 must see by their declaration. */
const L2F_TABLES = [
  "badge_revocation_requests",
  "consumer_email_domains",
  "dispute_outcome_reasons",
  "dispute_reasons",
  "disputes",
  "identifier_change_reviews",
  "opening_reasons",
];

/** The base tables of `schema` and their visible columns, from the catalogue. */
async function catalogueColumns(
  sql: Sql,
  schema: string,
): Promise<Record<string, string[]>> {
  const rows = await sql<{ name: string; columns: string[] }[]>`
    select c.relname as name,
           array_agg(a.attname::text order by a.attname) as columns
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
     where n.nspname = ${schema} and c.relkind in ('r', 'p')
     group by c.relname
     order by c.relname`;
  return Object.fromEntries(rows.map((row) => [row.name, row.columns]));
}

/** `table: column` for every gap between a declaration and the catalogue, in both directions. */
function gapsOf(
  declared: Record<string, string[]>,
  catalogue: Record<string, string[]>,
): string[] {
  const gaps: string[] = [];
  for (const [table, columns] of Object.entries(declared)) {
    const actual = catalogue[table];
    if (actual === undefined) {
      gaps.push(`${table}: no such relation`);
      continue;
    }
    for (const column of columns) {
      if (!actual.includes(column))
        gaps.push(`${table}.${column}: not in the base`);
    }
    for (const column of actual) {
      if (!columns.includes(column))
        gaps.push(`${table}.${column}: not declared`);
    }
  }
  return gaps.sort();
}

let verificationCatalogue: Record<string, string[]>;
let profilesCatalogue: Record<string, string[]>;

beforeAll(async () => {
  const sql = localSuperuser();
  verificationCatalogue = await catalogueColumns(sql, "verification");
  profilesCatalogue = await catalogueColumns(sql, "profiles");
});

describe("TM11-P1 every table of `verification` is declared in Drizzle", () => {
  it("declares exactly the base tables of the schema, the L2F ones among them", () => {
    const declared = Object.keys(verificationColumns())
      // verification.ts also declares the brand's internal block, which lives in `profiles`
      .filter(
        (table) =>
          table in verificationCatalogue || !(table in profilesCatalogue),
      )
      .sort();
    expect(declared).toEqual(Object.keys(verificationCatalogue).sort());
    expect(declared).toEqual(expect.arrayContaining(L2F_TABLES));
    // seven tables of L2E (0221, 0222), seven of L2F
    expect(declared.length).toBeGreaterThanOrEqual(14);
  });
});

describe("TM11-P2 every declared table has the columns of its relation", () => {
  it("verification.ts: the same column names as the catalogue, generated columns included", () => {
    const declared = verificationColumns();
    const catalogue = { ...profilesCatalogue, ...verificationCatalogue };
    expect(gapsOf(declared, catalogue)).toEqual([]);
    // the handles, the texts and the deciders of L2F are declared, so TM11.3 forbids them
    expect(declared.identifier_change_reviews).toEqual(
      expect.arrayContaining([
        "previous_handle",
        "new_handle",
        "observed_handle",
      ]),
    );
    expect(declared.disputes).toEqual(
      expect.arrayContaining([
        "text",
        "internal_comment",
        "original_decider_ids",
      ]),
    );
    expect(declared.badge_revocation_requests).toEqual(
      expect.arrayContaining(["member_message"]),
    );
  });

  it("profiles-creator-identity.ts: the same column names as the catalogue", () => {
    const declared = creatorIdentityColumns();
    expect(Object.keys(declared).length).toBeGreaterThanOrEqual(7);
    expect(gapsOf(declared, profilesCatalogue)).toEqual([]);
  });
});

describe("TM11-W witness: a gap makes the check fail", () => {
  it("reports a column of the base the declaration misses, and a declared column the base lacks", () => {
    const catalogue = { disputes: ["id", "text", "added_by_a_migration"] };
    expect(gapsOf({ disputes: ["id", "text", "dropped"] }, catalogue)).toEqual([
      "disputes.added_by_a_migration: not declared",
      "disputes.dropped: not in the base",
    ]);
    expect(gapsOf({ missing: ["id"] }, catalogue)).toEqual([
      "missing: no such relation",
    ]);
  });
});
