// What the list of a queue shows, computed from the answers of apps/api (docs/mvp/15 RG27 C2 C5 C8,
// RG28, RG32, RG33, RG119, RG121; 17b §2.2, §2.3; L2C-16). Pure functions, outside the components:
// the filters the address bar may carry, the durations in words, the state of a row, its lock, the
// keys of the keyboard. No rule is decided here (the server says what is overdue, who holds what,
// what a caller may see); this module only words and gathers. Durations are computed from the
// instant of the database (`asOf`), never from the clock of the browser.
import type {
  EntriesSearchBody,
  QueueCode,
  QueueCounters,
  QueueEntryRow,
} from "@influx/contracts/backoffice-queues";
import { messages } from "@/messages/fr";
import { formatDateTime, formatTime } from "./view-model";

const t = messages.queueList;

/** The screen of each queue (the rail, the dashboard): queue 4 is two views, never a mixed screen. */
export const QUEUE_ADDRESS: Readonly<Record<QueueCode, string>> = {
  profiles_advertiser: "/files/profils-marque",
  verification_creators: "/files/verifications-createurs",
  verification_brands: "/files/verifications-marques",
  verification_disputes: "/files/contestations",
  identity_change_review: "/files/identifiants-modifies",
};

/** The common filters of every queue, in the order of 15 RG33 (the state is always `open`). */
export const COMMON_FILTER_KEYS = [
  "overdue",
  "holder",
  "owner",
  "alert",
] as const;
export type CommonFilterKey = (typeof COMMON_FILTER_KEYS)[number];

/** The period (15 RG33), two days "YYYY-MM-DD" in the address bar; the call sends their instants. */
export const PERIOD_KEYS = ["from", "to"] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A filter of the address bar: a name and a code, plain characters only (15 RG121). */
export type QueueFilters = Readonly<Record<string, string>>;

/** A filter of one queue, offered after the common ones; its options are closed. */
export type OwnFilter = {
  key: string;
  label: string;
  options: readonly { value: string; label: string }[];
  /** What the empty choice says when it is not "Tous" (a sort's default: "Ancienneté"). */
  emptyLabel?: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The value of a common filter when the address bar holds a valid one; null otherwise. */
function commonValueOf(key: CommonFilterKey, raw: string): string | null {
  switch (key) {
    case "overdue":
    case "alert":
      return raw === "true" ? raw : null;
    case "holder":
      return raw === "free" || raw === "me" || UUID.test(raw) ? raw : null;
    case "owner":
      return raw === "none" || UUID.test(raw) ? raw : null;
  }
}

/**
 * The filters of an address: the common ones and those of the queue, each kept only when its value
 * is one the screen offers (or, for an agent, a shared link naming a colleague by identifier).
 * Anything else is dropped, never sent: apps/api refuses it anyway.
 */
export function filtersOf(
  read: (name: string) => string | null,
  own: readonly OwnFilter[],
): QueueFilters {
  const found: Record<string, string> = {};
  for (const key of COMMON_FILTER_KEYS) {
    const raw = read(key);
    const value = raw === null ? null : commonValueOf(key, raw);
    if (value !== null) {
      found[key] = value;
    }
  }
  for (const key of PERIOD_KEYS) {
    const raw = read(key);
    if (raw !== null && DAY.test(raw)) {
      found[key] = raw;
    }
  }
  for (const filter of own) {
    const raw = read(filter.key);
    if (raw !== null && filter.options.some((option) => option.value === raw)) {
      found[filter.key] = raw;
    }
  }
  return found;
}

/**
 * The page of the list (15 RG34, RG121): the first one, or a later one named by its number and by
 * the opaque cursor that apps/api gave with the page before (nothing is kept on the server). A
 * number without a cursor, a cursor without a number or a malformed one is the first page.
 */
export type QueuePaging = { page: number; cursor: string | null };
export const FIRST_PAGE: QueuePaging = { page: 1, cursor: null };
const CURSOR = /^[A-Za-z0-9_-]{1,300}$/;
const PAGE_NUMBER = /^(?:[2-9]|[1-9]\d{1,3})$/;

export function pagingOf(read: (name: string) => string | null): QueuePaging {
  const page = read("page");
  const cursor = read("cursor");
  return page !== null &&
    PAGE_NUMBER.test(page) &&
    cursor !== null &&
    CURSOR.test(cursor)
    ? { page: Number(page), cursor }
    : FIRST_PAGE;
}

/**
 * The body of the call (POST .../entries/search): the filters, the period as instants, the cursor
 * of the page and its cap (15 RG34). Neither the instants nor the cursor can cross the relay in a
 * query; apps/api checks every key again against its closed schema.
 */
export function searchBodyOf<Body extends object = EntriesSearchBody>(
  filters: QueueFilters,
  period: { from?: string; to?: string },
  paging: QueuePaging,
  limit: number,
): Body {
  const codes = Object.entries(filters).filter(
    ([key]) => !(PERIOD_KEYS as readonly string[]).includes(key),
  );
  return {
    ...Object.fromEntries(codes),
    ...period,
    ...(paging.cursor === null ? {} : { cursor: paging.cursor }),
    limit,
  } as Body;
}

/** The address of the list with `filters` and its page; the bare path when none is active. */
export function addressOf(
  path: string,
  filters: QueueFilters,
  paging: QueuePaging = FIRST_PAGE,
): string {
  const entries = Object.entries(filters).filter(([, value]) => value !== "");
  if (paging.cursor !== null) {
    entries.push(["page", String(paging.page)], ["cursor", paging.cursor]);
  }
  const search = new URLSearchParams(entries).toString();
  return search === "" ? path : `${path}?${search}`;
}

/** A day "YYYY-MM-DD" as the reader writes it: "05/11/2026". */
export function dayWords(day: string): string {
  const [year, month, date] = day.split("-");
  return `${date ?? ""}/${month ?? ""}/${year ?? ""}`;
}

/** A filter in words, for its removable chip (17b §4.2). */
export function chipWords(
  key: string,
  value: string,
  own: readonly OwnFilter[],
): { name: string; value: string } {
  switch (key) {
    case "from":
    case "to":
      return {
        name: key === "from" ? t.periodFrom : t.periodTo,
        value: dayWords(value),
      };
    case "overdue":
      return { name: t.overdueOnly, value: "" };
    case "alert":
      return { name: t.alert, value: t.alertOptions.true };
    case "holder":
      return {
        name: t.holder,
        value:
          value === "free"
            ? t.holderOptions.free
            : value === "me"
              ? t.holderOptions.me
              : t.holderOther,
      };
    case "owner":
      return {
        name: t.owner,
        value: value === "none" ? t.ownerOptions.none : t.ownerOther,
      };
    default: {
      const filter = own.find((candidate) => candidate.key === key);
      return {
        name: filter?.label ?? key,
        value:
          filter?.options.find((option) => option.value === value)?.label ??
          value,
      };
    }
  }
}

/** The text of a chip: "Verrou : Libre", or the name alone for a checkbox filter. */
export function chipText(name: string, value: string): string {
  return value === "" ? name : t.chip(name, value);
}

/**
 * A duration in words, from whole minutes: "12 min", "3 h 12", "26 h", then in days from 48 h:
 * "3 j 4 h". Never negative (a clock that runs behind reads as nothing).
 */
export function durationWords(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes));
  if (total < 60) {
    return `${total} min`;
  }
  if (total < 48 * 60) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0
      ? `${hours} h`
      : `${hours} h ${String(rest).padStart(2, "0")}`;
  }
  const days = Math.floor(total / (24 * 60));
  const hours = Math.floor((total % (24 * 60)) / 60);
  return hours === 0 ? `${days} j` : `${days} j ${hours} h`;
}

/** Whole minutes from `from` to `to`, both instants of the database. */
export function minutesBetween(from: string, to: string): number {
  return Math.floor((Date.parse(to) - Date.parse(from)) / 60_000);
}

/** A delay of the policy, in words: "8 h ouvrées" or "30 min en continu" (data, 15 RG38). */
export function policyWords(minutes: number, businessHours: boolean): string {
  return businessHours
    ? t.businessMinutes(durationWords(minutes))
    : t.calendarMinutes(durationWords(minutes));
}

/** The head banner (15 RG28): the volume, the age of the oldest, the overdue, the unclaimed. */
export function counterWords(
  counters: QueueCounters,
  asOf: string,
): readonly string[] {
  return [
    t.pending(counters.pending),
    t.oldest(
      counters.oldestCreatedAt === null
        ? null
        : durationWords(minutesBetween(counters.oldestCreatedAt, asOf)),
    ),
    t.overdue(counters.overdue),
    t.unclaimed(counters.unclaimed),
  ];
}

/** The delay of the queue, in clear under the counters (17b §2.2). */
export function policyLine(counters: QueueCounters): string {
  const { policy } = counters;
  return t.policy(
    policyWords(policy.decisionMinutes, policy.businessHours),
    policy.claimTargetMinutes === null
      ? null
      : policyWords(policy.claimTargetMinutes, policy.businessHours),
  );
}

/** The empty state of a queue (15 RG32): normal, with how long ago the last entry was handled. */
export function emptyWords(
  counters: QueueCounters | null,
  asOf: string,
): string {
  const last = counters?.lastDecidedAt ?? null;
  return last === null
    ? t.empty
    : t.emptySince(durationWords(minutesBetween(last, asOf)));
}

/** The one state of a row, always doubled by a written label (15 RG119). */
export type RowState = "overdue" | "held" | "free";

type RowFacts = Pick<
  QueueEntryRow,
  "overdue" | "claim" | "slaDueAt" | "escalateAt"
>;

export function rowStateOf(row: RowFacts): RowState {
  if (row.overdue) {
    return "overdue";
  }
  return row.claim.holder === null && !row.claim.heldByCaller ? "free" : "held";
}

/** The deadline of a row: "HORS DÉLAI depuis 3 h 12" or "dans 2 h 05", and its date (15 C5, C8). */
export function dueWords(
  row: RowFacts,
  asOf: string,
): { overdue: boolean; text: string; at: string } {
  const gap = minutesBetween(asOf, row.slaDueAt);
  return {
    overdue: row.overdue,
    text: row.overdue
      ? t.dueOverdue(durationWords(-gap))
      : t.dueIn(durationWords(gap)),
    at: t.dueAt(formatDateTime(row.slaDueAt)),
  };
}

/** Past the alert threshold of age (06 RG7): written under the row, never a colour alone. */
export function isEscalated(row: RowFacts, asOf: string): boolean {
  return (
    row.escalateAt !== null && Date.parse(row.escalateAt) <= Date.parse(asOf)
  );
}

/** The lock of a row (15 C2): "libre", or a name and the hour; never an identifier. */
export function lockWords(row: Pick<QueueEntryRow, "claim">): string {
  const { claim } = row;
  if (claim.holder === null && !claim.heldByCaller) {
    return t.lockFree;
  }
  const name = claim.heldByCaller
    ? t.lockMe
    : (claim.holder?.displayName ?? t.lockUnknown);
  return claim.claimedAt === null
    ? name
    : t.lockSince(name, formatTime(claim.claimedAt));
}

/**
 * CA42 (08 RG66): the entries past their deadline, then the others, each in the server's order. An
 * entry past its deadline is still decidable; it only lives in a list of its own.
 */
export function splitByDeadline<Row extends { overdue: boolean }>(
  rows: readonly Row[],
): { overdue: Row[]; inTime: Row[] } {
  return {
    overdue: rows.filter((row) => row.overdue),
    inTime: rows.filter((row) => !row.overdue),
  };
}

/** The keys of the list (17b §2.2): moving, and the reminder; ‹Entrée› is the link's own. */
export type Shortcut = "next" | "previous" | "help";

export type KeyFacts = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** The tag of the element that holds the focus, and whether it is editable. */
  target: { tagName: string; isContentEditable: boolean } | null;
};

const FIELD_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/** A shortcut is never taken from someone typing in a field, nor from a modified key. */
export function shortcutOf(event: KeyFacts): Shortcut | null {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return null;
  }
  if (
    event.target !== null &&
    (FIELD_TAGS.has(event.target.tagName) || event.target.isContentEditable)
  ) {
    return null;
  }
  switch (event.key) {
    case "j":
      return "next";
    case "k":
      return "previous";
    case "?":
      return "help";
    default:
      return null;
  }
}

/** The row to focus after ‹j› or ‹k›: the first one when none holds the focus, never out of range. */
export function steppedIndex(
  step: "next" | "previous",
  at: number,
  count: number,
): number {
  if (count === 0) {
    return -1;
  }
  if (at < 0) {
    return 0;
  }
  return step === "next" ? Math.min(count - 1, at + 1) : Math.max(0, at - 1);
}

/** One line of the dashboard for a queue (15 RG28, 06 RG72): the counters of the head banner. */
export function summaryLine(counters: QueueCounters, asOf: string): string {
  return messages.queueSummary.line(
    messages.queue[counters.queue],
    counters.pending,
    counters.oldestCreatedAt === null
      ? null
      : durationWords(minutesBetween(counters.oldestCreatedAt, asOf)),
    counters.overdue,
    counters.unclaimed,
  );
}

/**
 * The entries past the alert threshold of age (06 RG7) among a page of the overdue ones, and
 * whether the page was capped (then the count is a floor).
 */
export function escalatedCount(page: {
  asOf: string;
  items: readonly RowFacts[];
  nextCursor: string | null;
}): { count: number; atLeast: boolean } {
  return {
    count: page.items.filter((row) => isEscalated(row, page.asOf)).length,
    atLeast: page.nextCursor !== null,
  };
}
