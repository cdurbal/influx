// Database access of the search settings screen and of the critical mass alerts (docs/mvp/04 §5.5; 10 RG2,
// CA60; 15 AL22, AL65; jalons/l3g/modele.md §6, §7; migrations 0331, 0333), as influx_admin in aal2 (03 §1.3).
// Parameterised queries only (S-1). Three readers, owned by influx_search_admin_definer, EXECUTE for influx_admin
// alone (42501 `forbidden` for anybody else, an agent included); they read, store nothing and write nothing:
//   search.read_search_settings()  (key, value) of the ten keys, ordered by key (who changed one and when stay in
//                                  the register, EC-L3G-08b-1)
//   search.read_supply_counters()  the rows of the last snapshot, and the global row of the 29 days before it
//   search.critical_mass_alerts()  one row per code and cause of AL22 and AL65, never an account nor a filter
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";
import { ISO_UTC } from "../sql-formats.ts";

export type SearchSettingRow = { key: string; value: unknown };

/** 0333: the ten keys of search.search_settings, as they are in base. */
export async function readSearchSettings(
  tx: Transaction,
): Promise<SearchSettingRow[]> {
  return tx.execute<SearchSettingRow>(
    sql`select s.key, s.value from search.read_search_settings() s`,
  );
}

export type SupplyCounterRow = {
  snapshotOn: string;
  dimension: "global" | "topic" | "country";
  dimensionValue: string;
  published: number;
  searchable: number;
  computedAt: string;
};

/** 0331: the counters of the last snapshot and the global curve of the 29 days before it, newest first. */
export async function readSupplyCounters(
  tx: Transaction,
): Promise<SupplyCounterRow[]> {
  const rows = await tx.execute<{
    snapshot_on: string;
    dimension: SupplyCounterRow["dimension"];
    dimension_value: string;
    published: number;
    searchable: number;
    computed_at: string;
  }>(sql`
    select to_char(c.snapshot_on, 'YYYY-MM-DD') as snapshot_on, c.dimension, c.dimension_value,
           c.published_profiles_count as published, c.searchable_profiles_count as searchable,
           to_char(c.computed_at at time zone 'UTC', ${ISO_UTC}) as computed_at
      from search.read_supply_counters() c`);
  return rows.map((row) => ({
    snapshotOn: row.snapshot_on,
    dimension: row.dimension,
    dimensionValue: row.dimension_value,
    published: row.published,
    searchable: row.searchable,
    computedAt: row.computed_at,
  }));
}

export type CriticalMassAlertRow = {
  code: "AL22" | "AL65";
  cause:
    | "thresholds_reached"
    | "below_while_open"
    | "counters_stale"
    | "k_blocked_share";
  /** The count behind the alert (AL65: profiles or hours; AL22: the share in basis points); null when none. */
  observed: number | null;
  threshold: number | null;
  since: string | null;
};

/** 0331: AL65 (the critical mass proposed, or the counters stale) and AL22 (too many searches blocked by k). */
export async function readCriticalMassAlerts(
  tx: Transaction,
): Promise<CriticalMassAlertRow[]> {
  const rows = await tx.execute<{
    code: CriticalMassAlertRow["code"];
    cause: CriticalMassAlertRow["cause"];
    observed: number | null;
    threshold: number | null;
    since_at: string | null;
  }>(sql`
    select a.code, a.cause, a.observed, a.threshold,
           to_char(a.since_at at time zone 'UTC', ${ISO_UTC}) as since_at
      from search.critical_mass_alerts() a`);
  return rows.map((row) => ({
    code: row.code,
    cause: row.cause,
    observed: row.observed,
    threshold: row.threshold,
    since: row.since_at,
  }));
}
