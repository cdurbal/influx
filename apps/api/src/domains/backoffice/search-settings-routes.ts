// The search settings route of the backoffice (docs/mvp/04 §5.5; 10 RG2, CA60; 15 §F, RG110; 03 §3.1; jalons/
// l3g/modele.md §6 to §8; l3g-fiche invariants 9, 10, 14; 0331, 0333). Backoffice surface; the aal2 guard of
// server.ts runs first.
// - GET /v1/bo/settings/search: an administrator's. The ten keys of search.search_settings, each checked
//   against its schema (search-settings.ts of the contracts), and the counters of critical mass of the last
//   snapshot. Who changed a key and when are not here: they stay in the register (EC-L3G-08b-1). The alerts
//   AL22 and AL65 are those of GET /v1/bo/alerts. `Cache-Control: no-store`.
// - An agent is refused 403 before any door (the three readers answer 42501 to him too). EC-L3G-10-1: the
//   attempt is not journaled, `backoffice.record_refused_action()` holds a closed list of codes (0134, 0148)
//   and none is for this read, which serves nothing to the agent; a code is a migration (Lot 5, CA63).
// - A change of a key is NOT a route of this file: it goes through POST /v1/bo/dual-control with the action
//   `search.change_setting` (D84, D38 Q2: confirmed by another administrator) and is executed by its
//   confirmation, which calls search.write_search_setting() (0332). Nothing here writes.
import {
  searchSettingSchema,
  searchSettingsResponseSchema,
  type SearchSetting,
  type SearchSettingsResponse,
  type SupplyCounters,
} from "@influx/contracts/search-settings";
import { ApiError } from "../../platform/errors.ts";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import type { BackofficeActionsDependencies } from "./action-guards.ts";
import { databaseNow } from "./alerts/repository.ts";
import {
  readSearchSettings,
  readSupplyCounters,
  type SupplyCounterRow,
} from "./search-settings/repository.ts";

/**
 * The counters of the last snapshot and the curve before it, from the rows of search.read_supply_counters()
 * (newest first): null when no snapshot was ever computed. The snapshot is the newest day of the rows.
 */
export function supplyCountersOf(
  rows: readonly SupplyCounterRow[],
): SupplyCounters | null {
  const last = rows.reduce<string | null>(
    (day, row) => (day === null || row.snapshotOn > day ? row.snapshotOn : day),
    null,
  );
  const globalRow = rows.find(
    (row) => row.snapshotOn === last && row.dimension === "global",
  );
  if (last === null || globalRow === undefined) {
    return null;
  }
  const ofDimension = (dimension: "topic" | "country") =>
    rows
      .filter((row) => row.snapshotOn === last && row.dimension === dimension)
      .map((row) => ({
        code: row.dimensionValue,
        published: row.published,
        searchable: row.searchable,
      }));
  return {
    snapshotOn: last,
    computedAt: globalRow.computedAt,
    global: {
      published: globalRow.published,
      searchable: globalRow.searchable,
    },
    topics: ofDimension("topic"),
    countries: ofDimension("country"),
    curve: rows
      .filter((row) => row.snapshotOn !== last && row.dimension === "global")
      .map((row) => ({
        snapshotOn: row.snapshotOn,
        published: row.published,
        searchable: row.searchable,
      })),
  };
}

export function registerSearchSettingsRoutes(
  app: IdentityApp,
  dependencies: BackofficeActionsDependencies,
): void {
  const { database } = dependencies;

  app.get(
    "/v1/bo/settings/search",
    { schema: { response: { 200: searchSettingsResponseSchema } } },
    async (request, reply): Promise<SearchSettingsResponse> => {
      void reply.header("cache-control", "no-store");
      return withBackofficeSession(
        database,
        request,
        reply,
        async (tx, context) => {
          if (context.role !== "admin") {
            throw new ApiError("forbidden");
          }
          const settings: SearchSetting[] = [];
          for (const row of await readSearchSettings(tx)) {
            // a value the base holds is checked as the base checks it: a shape that fails is a fault, not a screen
            settings.push(
              searchSettingSchema.parse({ key: row.key, value: row.value }),
            );
          }
          return {
            asOf: await databaseNow(tx),
            settings,
            counters: supplyCountersOf(await readSupplyCounters(tx)),
          };
        },
      );
    },
  );
}
