// Queue 4, "vérifications", in words (docs/mvp/08 RG61 to RG66, RG98, CA42 to CA44; 17b §3.7;
// l2e-fiche invariant 10; L2E-21). Pure functions, outside the components: the filters of one view, the
// words of a line (level, network, age, alerts, lock) and the split between the entries past their
// deadline and the others. No rule is decided here (apps/api says what is overdue, who holds what and
// which requests the caller may see); the list shows no handle, no figure and no code (RG47, modele -19).
import type {
  VerificationQueueEntryRow,
  VerificationQueueSort,
  VerificationQueueView,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import {
  durationWords,
  minutesBetween,
  type OwnFilter,
  type QueueFigures,
  type QueueFilters,
} from "./queue-view-model";
import { formatDateTime } from "./view-model";

const t = messages.verificationQueue;

/** The address of each view in the rail (EC-L2E-21-1: `/files/verifications-createurs`, `…-marques`). */
export const VERIFICATION_VIEW_ADDRESS = {
  creators: "/files/verifications-createurs",
  brands: "/files/verifications-marques",
} as const satisfies Record<VerificationQueueView, string>;

/** The networks of launch (0201), in the order the filter offers them. */
const NETWORK_CODES = Object.keys(t.networks);

/** A network in words; a code the screen does not know is written as it is, a brand has none. */
export function networkWords(code: string | null): string {
  return code === null ? t.noNetwork : (t.networks[code] ?? code);
}

export function levelWords(level: VerificationQueueEntryRow["level"]): string {
  return t.levels[level];
}

const SORTS_OF: Record<
  VerificationQueueView,
  readonly VerificationQueueSort[]
> = {
  // level and network make sense for a creator only: a brand has one level and no network
  creators: ["sla", "level", "network"],
  brands: ["sla"],
};

/**
 * The filters of a view after the common ones (08 RG62): the sort (its empty choice is the default,
 * the oldest first), the level and the network (creators), and the entries marked "à réexaminer".
 * Population is the view itself; the state is always `pending` (a queue lists what waits).
 */
export function verificationOwnFilters(
  view: VerificationQueueView,
): readonly OwnFilter[] {
  const sort: OwnFilter = {
    key: "sort",
    label: t.filters.sort,
    emptyLabel: t.sorts.age,
    options: SORTS_OF[view].map((value) => ({
      value,
      label: t.sorts[value],
    })),
  };
  const reexamine: OwnFilter = {
    key: "reexamine",
    label: t.filters.reexamine,
    options: [{ value: "true", label: t.filters.reexamineOnly }],
  };
  return view === "brands"
    ? [sort, reexamine]
    : [
        sort,
        {
          key: "level",
          label: t.filters.level,
          options: (["account_verified", "audience_verified"] as const).map(
            (value) => ({ value, label: t.levels[value] }),
          ),
        },
        {
          key: "network",
          label: t.filters.network,
          options: NETWORK_CODES.map((value) => ({
            value,
            label: networkWords(value),
          })),
        },
        reexamine,
      ];
}

/** The sort in force: the address's, or the default (the oldest first). */
export function sortOf(
  filters: QueueFilters,
  view: VerificationQueueView,
): VerificationQueueSort {
  const wanted = filters.sort;
  return SORTS_OF[view].find((value) => value === wanted) ?? "age";
}

/** The column the list is sorted by (the head says so): the deadline, the level or the network. */
export function sortedColumnOf(sort: VerificationQueueSort): string {
  switch (sort) {
    case "age":
      return "submitted";
    case "sla":
      return "due";
    case "level":
      return "level";
    case "network":
      return "network";
  }
}

/** The sentence over the table: how many, and how they are sorted. */
export function resultsWords(
  count: number,
  filters: QueueFilters,
  view: VerificationQueueView,
): string {
  return t.resultsSorted(count, t.sortedBy[sortOf(filters, view)]);
}

/** The age of a request: from its submission to the instant of the database (never the browser's). */
export function ageWords(row: { submittedAt: string }, asOf: string): string {
  return durationWords(minutesBetween(row.submittedAt, asOf));
}

/** RG64: « En cours — {prénom} », the caller's own as « En cours — vous », or « libre ». */
export function verificationLockWords(
  row: Pick<VerificationQueueEntryRow, "claim">,
): string {
  const { claim } = row;
  if (claim.heldByCaller) {
    return t.lock.heldByMe;
  }
  if (claim.holder === null) {
    return t.lock.free;
  }
  return claim.holder.displayName === null
    ? t.lock.unknown
    : t.lock.held(claim.holder.displayName);
}

/**
 * What goes under the line, in clear and never in a tooltip (RG63, RG50): the alerts, then « à
 * réexaminer » with its reason and its date. Null when the line has neither.
 */
export function verificationNote(
  row: Pick<VerificationQueueEntryRow, "alerts" | "reexamine">,
): string | null {
  const parts: string[] = row.alerts.map((code) =>
    messages.queueList.alertLine(t.alerts[code]),
  );
  if (row.reexamine !== null) {
    parts.push(
      t.reexamine(
        t.reexamineReasons[row.reexamine.reasonCode],
        formatDateTime(row.reexamine.reexaminedAt),
      ),
    );
  }
  return parts.length === 0 ? null : parts.join(" · ");
}

/** The name of a line: the alias of a creator or the trading name of a brand, never a handle. */
export function verificationName(
  row: Pick<VerificationQueueEntryRow, "displayName">,
  view: VerificationQueueView,
): string {
  return row.displayName ?? t[view].unnamed;
}

/** CA44: the empty queue says when the last request was handled, in « demande » words. */
export function verificationEmptyWords(
  counters: QueueFigures | null,
  asOf: string,
): string {
  const last = counters?.lastDecidedAt ?? null;
  return last === null
    ? t.empty
    : t.emptySince(durationWords(minutesBetween(last, asOf)));
}
