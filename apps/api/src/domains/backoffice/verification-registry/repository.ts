// SQL of the registry sources of the brand's registration (docs/mvp/06 RG52, RG101; D79 (12);
// jalons/l2e/modele.md §3, §4 "Agent"; 0221, 0224; jalons/l2e commit 15). Reads run as influx_agent or
// influx_admin in aal2 (policy `registry_sources_internal_select`); the one write is the door
// `verification.set_registry_source()` of 0224, which refuses an agent, writes the former and the new
// value in the register (`verification.registry_source_changed`) and answers `updated_at`.
// A source is a public page the agent opens by hand: nothing here fetches it.
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

export type RegistrySourceAdminRow = {
  id: string;
  sourceType: string;
  countryCode: string | null;
  subdivisionCode: string | null;
  name: string;
  url: string;
  checkedOn: string;
  isActive: boolean;
  updatedAt: string;
};

type Row = {
  id: string;
  source_type: string;
  country_code: string | null;
  subdivision_code: string | null;
  name: string;
  url: string;
  checked_on: string;
  is_active: boolean;
  updated_at: string;
};

const COLUMNS = sql`id::text as id, source_type::text as source_type,
       country_code::text as country_code, subdivision_code, name, url,
       to_char(checked_on, 'YYYY-MM-DD') as checked_on, is_active,
       to_char(updated_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as updated_at`;

function rowOf(row: Row): RegistrySourceAdminRow {
  return {
    id: row.id,
    sourceType: row.source_type,
    countryCode: row.country_code,
    subdivisionCode: row.subdivision_code,
    name: row.name,
    url: row.url,
    checkedOn: row.checked_on,
    isActive: row.is_active,
    updatedAt: row.updated_at,
  };
}

/** Every source, the inactive ones too: the countries in order, GLEIF last, then the name. */
export async function listRegistrySources(
  tx: Transaction,
): Promise<RegistrySourceAdminRow[]> {
  const rows = await tx.execute<Row>(
    sql`select ${COLUMNS}
          from verification.registry_sources
         order by (source_type = 'gleif'), country_code, subdivision_code nulls first, name, id`,
  );
  return rows.map(rowOf);
}

export async function readRegistrySourceById(
  tx: Transaction,
  id: string,
): Promise<RegistrySourceAdminRow | null> {
  const rows = await tx.execute<Row>(
    sql`select ${COLUMNS} from verification.registry_sources where id = ${id}::uuid`,
  );
  const row = rows[0];
  return row === undefined ? null : rowOf(row);
}

/** `verification.set_registry_source()`: an administrator's update, journaled by the database (RG101). */
export async function setRegistrySource(
  tx: Transaction,
  id: string,
  change: { name: string; url: string; checkedOn: string; isActive: boolean },
): Promise<void> {
  await tx.execute(
    sql`select verification.set_registry_source(
          ${id}::uuid, ${change.name}, ${change.url}, ${change.checkedOn}::date,
          ${change.isActive}::boolean)`,
  );
}

/**
 * `verification.add_registry_source()` (0229, L2F-21): an administrator adds a register of type national
 * for a country, or for one of its States; journaled by the database (RG101). Answers the new id.
 */
export async function addRegistrySource(
  tx: Transaction,
  source: {
    countryCode: string;
    subdivisionCode: string | null;
    name: string;
    url: string;
    checkedOn: string;
    isActive: boolean;
  },
): Promise<string> {
  const rows = await tx.execute<{ id: string }>(
    sql`select verification.add_registry_source(
          ${source.countryCode}, ${source.subdivisionCode}, ${source.name}, ${source.url},
          ${source.checkedOn}::date, ${source.isActive}::boolean)::text as id`,
  );
  const id = rows[0]?.id;
  if (id === undefined) {
    throw new Error("add_registry_source answered no id");
  }
  return id;
}
