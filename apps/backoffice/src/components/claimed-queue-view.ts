// Queues 5 and 6 in words (docs/mvp/08 RG77, RG78; 15 RG27 C5, C8, RG33; 17b §2.7; jalons/l2f/modele.md §5;
// L2F-19). Pure functions, outside the components: the own filters of each list, its sorts, the words of a
// line and the empty state. No rule is decided here (apps/api says what is overdue, who holds what and
// which entries the caller may see); the lists show no handle, no text of the creator and no figure.
import type { QueueCounters } from "@influx/contracts/backoffice-queues";
import type {
  DisputeEntryRow,
  IdentifierChangeEntryRow,
  VerificationQueueSort,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import {
  durationWords,
  minutesBetween,
  type OwnFilter,
  type QueueFilters,
} from "./queue-view-model";
import { networkWords } from "./verification-queue-view";

const dispute = messages.disputeQueue;
const identifier = messages.identifierQueue;
const common = messages.verificationQueue;

/** The sorts each list offers: the level means something for a contest only (a handle has no level). */
const DISPUTE_SORTS: readonly VerificationQueueSort[] = [
  "sla",
  "level",
  "network",
];
const IDENTIFIER_SORTS: readonly VerificationQueueSort[] = ["sla", "network"];

const NETWORK_CODES = Object.keys(common.networks);

function sortFilter(sorts: readonly VerificationQueueSort[]): OwnFilter {
  return {
    key: "sort",
    label: common.filters.sort,
    emptyLabel: common.sorts.age,
    options: sorts.map((value) => ({ value, label: common.sorts[value] })),
  };
}

function networkFilter(): OwnFilter {
  return {
    key: "network",
    label: common.filters.network,
    options: NETWORK_CODES.map((value) => ({
      value,
      label: networkWords(value),
    })),
  };
}

/** 08 RG62 as queue 5 reads it: the sort, the level (creator levels), the network and what is contested. */
export function disputeOwnFilters(): readonly OwnFilter[] {
  return [
    sortFilter(DISPUTE_SORTS),
    {
      key: "level",
      label: dispute.filters.level,
      options: (["account_verified", "audience_verified"] as const).map(
        (value) => ({ value, label: common.levels[value] }),
      ),
    },
    networkFilter(),
    {
      key: "kind",
      label: dispute.filters.kind,
      options: (["refusal", "revocation"] as const).map((value) => ({
        value,
        label: dispute.kinds[value],
      })),
    },
  ];
}

export function identifierOwnFilters(): readonly OwnFilter[] {
  return [sortFilter(IDENTIFIER_SORTS), networkFilter()];
}

/** The sort in force: the address's when the list offers it, else the default (the oldest first). */
function sortIn(
  sorts: readonly VerificationQueueSort[],
  filters: QueueFilters,
): VerificationQueueSort {
  return sorts.find((value) => value === filters.sort) ?? "age";
}

export function disputeSortOf(filters: QueueFilters): VerificationQueueSort {
  return sortIn(DISPUTE_SORTS, filters);
}

export function identifierSortOf(filters: QueueFilters): VerificationQueueSort {
  return sortIn(IDENTIFIER_SORTS, filters);
}

/** The column the list is sorted by (the head says so); `age` is the date the entry was filed or opened. */
export function sortedColumnOf(
  sort: VerificationQueueSort,
  ageColumn: string,
): string {
  switch (sort) {
    case "age":
      return ageColumn;
    case "sla":
      return "due";
    case "level":
      return "level";
    case "network":
      return "network";
  }
}

export function disputeResultsWords(
  count: number,
  filters: QueueFilters,
): string {
  return dispute.resultsSorted(count, common.sortedBy[disputeSortOf(filters)]);
}

export function identifierResultsWords(
  count: number,
  filters: QueueFilters,
): string {
  return identifier.resultsSorted(
    count,
    common.sortedBy[identifierSortOf(filters)],
  );
}

/** The age of an entry: from its filing to the instant of the database (never the browser's). */
export function ageWords(since: string, asOf: string): string {
  return durationWords(minutesBetween(since, asOf));
}

/** The name of a line: the alias of the creator, never his handle. */
export function disputeName(row: Pick<DisputeEntryRow, "displayName">): string {
  return row.displayName ?? dispute.unnamed;
}

export function identifierName(
  row: Pick<IdentifierChangeEntryRow, "displayName">,
): string {
  return row.displayName ?? identifier.unnamed;
}

/** The reason of the member, in words (a code the screen does not know is written as it is). */
export function disputeReasonWords(code: string): string {
  return dispute.reasons[code] ?? code;
}

/** CA44 for these queues: the empty one says when the last entry was handled. */
export function disputeEmptyWords(
  counters: QueueCounters | null,
  asOf: string,
): string {
  const last = counters?.lastDecidedAt ?? null;
  return last === null
    ? dispute.empty
    : dispute.emptySince(ageWords(last, asOf));
}

export function identifierEmptyWords(
  counters: QueueCounters | null,
  asOf: string,
): string {
  const last = counters?.lastDecidedAt ?? null;
  return last === null
    ? identifier.empty
    : identifier.emptySince(ageWords(last, asOf));
}
