"use client";

// The list template of the queues (docs/mvp/15 RG26 to RG28, RG32 to RG34, RG119, RG121, RG114;
// 17b §2.2, §2.3, §2.8, §4.1; skill backoffice-ops; L2C-16), the same for queues 2 to 15: the
// counters and the delay in clear, the common filters then the queue's own, a dense table sorted by
// deadline, its states (loading, empty, no match, error, refused), the keyboard. The address bar
// carries the filters, the period (two days), the number of the page and its cursor (codes only,
// 15 RG121). Nothing here decides: apps/api says what is overdue, who holds what and which entries
// the caller may see; the queue gives its columns and its calls.
// Pages of at most 50 entries (RG34, never an infinite scroll), next and previous: the filters,
// the period and the cursor travel in the body of a POST that writes nothing (L2C 18c,
// EC-L2C-16-1), not in a query the relay refuses. The server keeps no cursor: the address does.
import {
  QUEUE_PAGE_SIZE_MAX,
  type EntriesSearchBody,
  type QueueCounters,
  type QueueCountersResponse,
  type QueueEntryRow,
} from "@influx/contracts/backoffice-queues";
import type { RelayResult } from "@influx/web-platform/relay-client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, LEAD_CLASSES, TITLE_CLASSES } from "./auth-classes";
import {
  DD_CLASSES,
  DL_CLASSES,
  DT_CLASSES,
  LINK_CLASSES,
  OVERDUE_LIST_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
  rowClasses,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { ErrorNotice } from "./ErrorNotice";
import { CircleCheckIcon, FlagIcon } from "./icons";
import { QueueFilterBar } from "./QueueFilterBar";
import {
  addressOf,
  counterWords,
  emptyWords,
  filtersOf,
  FIRST_PAGE,
  pagingOf,
  policyLine,
  searchBodyOf,
  shortcutOf,
  splitByDeadline,
  steppedIndex,
  type OwnFilter,
  type QueueFilters,
  type QueuePaging,
} from "./queue-view-model";
import { periodOf } from "./view-model";

const t = messages.queueList;

/** What the template reads of a row, whatever the queue: the rest is the queue's own columns. */
export type QueueRowFacts = Pick<
  QueueEntryRow,
  "id" | "overdue" | "claim" | "slaDueAt" | "escalateAt"
>;

export type QueueColumn<Row> = {
  key: string;
  header: string;
  /** The column the list is sorted by (the server's order, 15 C5): its head says so. */
  sorted?: boolean;
  cell: (row: Row, asOf: string) => ReactNode;
};

/**
 * Queue 4 (08 RG66, CA42): the entries past their deadline in a list of their own, above the others,
 * visibly distinct (a heading with its flag, a thick border, a sentence), never drowned in the general
 * list. The split is the page's: the server's order puts the oldest, hence the overdue, first.
 */
export type OverdueSplit = {
  overdueTitle: string;
  overdueNote: string;
  overdueTableLabel: string;
  otherTitle: string;
};

export type QueueTemplateProps<
  Row extends QueueRowFacts,
  Body extends object = EntriesSearchBody,
> = {
  title: string;
  lead: string;
  /** The code of the queue in the counters answer. */
  queueCode: QueueCountersResponse["queues"][number]["queue"];
  tableLabel: string;
  ownFilters: readonly OwnFilter[];
  /** The columns, or a function of the filters in force (queue 4 marks the column its sort follows). */
  columns:
    | readonly QueueColumn<Row>[]
    | ((filters: QueueFilters) => readonly QueueColumn<Row>[]);
  /** The line under a row, in clear (the alerts of the row): null when it has none. */
  rowNote?: (row: Row) => ReactNode;
  /** The entry of a row: its address and the name that labels its link. */
  entryOf: (row: Row) => { href: string; label: string };
  loadEntries: (
    body: Body,
  ) => Promise<
    RelayResult<{ asOf: string; items: Row[]; nextCursor: string | null }>
  >;
  loadCounters: () => Promise<RelayResult<QueueCountersResponse>>;
  /** The sentence over the table: the count and the sort in force (default: by deadline). */
  resultsLine?: (count: number, filters: QueueFilters) => string;
  /** The empty state (15 RG32): "Aucune entrée en attente" by default, queue 4 says "demande". */
  emptyLine?: (counters: QueueCounters | null, asOf: string) => string;
  splitOverdue?: OverdueSplit;
  /** Queues 5 and 6 carry no alert: the filter is neither offered nor sent (default: offered). */
  withAlertFilter?: boolean;
};

type Load<Value> =
  | { kind: "loading" }
  | { kind: "ok"; data: Value }
  | { kind: "failed"; forbidden: boolean };

/** What an answer of the relay becomes on screen; null: the session ended, the caller leaves. */
function loadOf<Value>(result: RelayResult<Value>): Load<Value> | null {
  if (result.kind === "ok") {
    return { kind: "ok", data: result.data };
  }
  if (result.kind === "unauthenticated") {
    return null;
  }
  return { kind: "failed", forbidden: result.code === "forbidden" };
}

/** Five lines of a fixed height, no animation (17b §2.8, 15 RG118). */
function SkeletonRows({ columns }: { columns: number }) {
  return (
    <DenseTableRegion label={t.loading}>
      <table className={TABLE_CLASSES} aria-hidden="true">
        <tbody>
          {Array.from({ length: 5 }, (_, row) => (
            <tr key={row}>
              {Array.from({ length: columns }, (_, cell) => (
                <td key={cell} className={TD_CLASSES}>
                  <span className="block h-3 rounded-md bg-surface-raised" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DenseTableRegion>
  );
}

export function QueueTemplate<
  Row extends QueueRowFacts,
  Body extends object = EntriesSearchBody,
>(props: QueueTemplateProps<Row, Body>) {
  const {
    title,
    lead,
    queueCode,
    tableLabel,
    ownFilters,
    rowNote,
    entryOf,
    loadEntries,
    loadCounters,
    resultsLine,
    emptyLine,
    splitOverdue,
    withAlertFilter = true,
  } = props;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const filters = useMemo(() => {
    const found = filtersOf((name) => search.get(name), ownFilters);
    return withAlertFilter
      ? found
      : Object.fromEntries(
          Object.entries(found).filter(([key]) => key !== "alert"),
        );
  }, [search, ownFilters, withAlertFilter]);
  const paging = useMemo(() => pagingOf((name) => search.get(name)), [search]);
  // 05 RG97: a period that ends before it starts is said, never sent.
  const period = useMemo(
    () => periodOf(filters.from, filters.to),
    [filters.from, filters.to],
  );
  const [reload, setReload] = useState(0);
  const loadKey = `${JSON.stringify(filters)}#${paging.cursor ?? ""}#${reload}`;
  // The cursor of each page seen, in memory only: it is what "Page précédente" goes back to.
  // A reload keeps the page (the address holds its cursor) but not the pages before it.
  const [seen, setSeen] = useState<{
    scope: string;
    cursors: Readonly<Record<number, string | null>>;
  }>({ scope: "", cursors: {} });
  const [entries, setEntries] = useState<{
    key: string;
    load: Load<{ asOf: string; items: Row[]; nextCursor: string | null }>;
  } | null>(null);
  const [counters, setCounters] = useState<{
    key: string;
    load: Load<QueueCountersResponse>;
  } | null>(null);

  // The caller leaves when the session has ended; the lists stay as they are until the answer.
  useEffect(() => {
    if (period === "invalid") {
      return undefined;
    }
    let active = true;
    const body = searchBodyOf<Body>(
      filters,
      period,
      paging,
      QUEUE_PAGE_SIZE_MAX,
    );
    void loadEntries(body).then((result) => {
      if (!active) {
        return;
      }
      const load = loadOf(result);
      if (load === null) {
        router.replace("/");
        return;
      }
      if (load.kind === "ok") {
        const scope = JSON.stringify(filters);
        const { nextCursor } = load.data;
        setSeen((current) => ({
          scope,
          cursors: {
            ...(current.scope === scope ? current.cursors : {}),
            [paging.page]: paging.cursor,
            ...(nextCursor === null ? {} : { [paging.page + 1]: nextCursor }),
          },
        }));
      }
      setEntries({ key: loadKey, load });
    });
    return () => {
      active = false;
    };
  }, [filters, period, paging, loadKey, loadEntries, router]);

  useEffect(() => {
    let active = true;
    void loadCounters().then((result) => {
      if (!active) {
        return;
      }
      const load = loadOf(result);
      if (load === null) {
        router.replace("/");
        return;
      }
      setCounters({ key: loadKey, load });
    });
    return () => {
      active = false;
    };
  }, [loadKey, loadCounters, router]);

  // A period that ends before it starts is said, and nothing is asked.
  const entriesLoad:
    | Load<{ asOf: string; items: Row[]; nextCursor: string | null }>
    | { kind: "invalid" } =
    period === "invalid"
      ? { kind: "invalid" }
      : entries?.key === loadKey
        ? entries.load
        : { kind: "loading" };
  const countersLoad: Load<QueueCountersResponse> =
    counters?.key === loadKey ? counters.load : { kind: "loading" };

  /** A new address: a filter changed. The page is the first one; the screen reads the new address. */
  const go = useCallback(
    (next: QueueFilters) => {
      router.replace(addressOf(pathname, next));
    },
    [pathname, router],
  );
  /** Another page of the same list: a step in the history, so that the browser's back returns too. */
  function goToPage(next: QueuePaging) {
    router.push(addressOf(pathname, filters, next));
  }
  // The page before is offered when this session has seen it; the first page always is.
  const before = paging.page - 1;
  const previous: QueuePaging | null =
    paging.page === 1
      ? null
      : before === 1
        ? FIRST_PAGE
        : seen.scope === JSON.stringify(filters) && before in seen.cursors
          ? { page: before, cursor: seen.cursors[before] ?? null }
          : null;
  function change(key: string, value: string | null) {
    const next: Record<string, string> = { ...filters };
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
    go(next);
  }

  // The keyboard of the list (17b §2.2): ‹j›, ‹k› and ‹?›, never taken from a field.
  const tableRef = useRef<HTMLDivElement>(null);
  const [showKeys, setShowKeys] = useState(false);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const shortcut = shortcutOf({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        target:
          target === null
            ? null
            : {
                tagName: target.tagName,
                isContentEditable: target.isContentEditable,
              },
      });
      if (shortcut === null) {
        return;
      }
      event.preventDefault();
      if (shortcut === "help") {
        setShowKeys((open) => !open);
        return;
      }
      const anchors = [
        ...(tableRef.current?.querySelectorAll<HTMLAnchorElement>(
          "a[data-entry-link]",
        ) ?? []),
      ];
      const at = anchors.findIndex(
        (anchor) => anchor === document.activeElement,
      );
      anchors[steppedIndex(shortcut, at, anchors.length)]?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const split =
    entriesLoad.kind === "ok" ? splitByDeadline(entriesLoad.data.items) : null;
  const columns =
    typeof props.columns === "function"
      ? props.columns(filters)
      : props.columns;
  const asOf = entriesLoad.kind === "ok" ? entriesLoad.data.asOf : "";
  const queueCounters =
    countersLoad.kind === "ok"
      ? (countersLoad.data.queues.find((queue) => queue.queue === queueCode) ??
        null)
      : null;
  const filtered = Object.keys(filters).length > 0;

  /** One dense table of `rows`: the columns of the queue, then the link that opens the entry. */
  function entriesTable(rows: readonly Row[], label: string) {
    return (
      <DenseTableRegion label={label}>
        <table className={TABLE_CLASSES}>
          <caption className="sr-only">{label}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={column.sorted === true ? "ascending" : undefined}
                  className={TH_CLASSES}
                >
                  {column.header}
                  {column.sorted === true ? (
                    <span aria-hidden="true">{t.sortMark}</span>
                  ) : null}
                </th>
              ))}
              <th scope="col" className={TH_CLASSES}>
                {t.columns.open}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const note = rowNote?.(row) ?? null;
              const entry = entryOf(row);
              return (
                <Fragment key={row.id}>
                  <tr className={rowClasses(false)}>
                    {columns.map((column) => (
                      <td key={column.key} className={TD_CLASSES}>
                        {column.cell(row, asOf)}
                      </td>
                    ))}
                    <td className={TD_CLASSES}>
                      <Link
                        data-entry-link=""
                        href={entry.href}
                        aria-label={entry.label}
                        className={LINK_CLASSES}
                      >
                        {t.openEntry}
                      </Link>
                    </td>
                  </tr>
                  {note === null ? null : (
                    <tr>
                      <td />
                      <td
                        colSpan={columns.length}
                        className={`${TD_CLASSES} text-text-secondary`}
                      >
                        {note}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </DenseTableRegion>
    );
  }

  return (
    <>
      <h1 className={TITLE_CLASSES}>{title}</h1>
      <p className={LEAD_CLASSES}>{lead}</p>

      {/* The counters come last: never a "0" that the answer has not given (17b §2.8). */}
      {entriesLoad.kind === "loading" ||
      countersLoad.kind === "loading" ? null : countersLoad.kind ===
        "failed" ? (
        <ErrorNotice>{messages.queueSummary.error}</ErrorNotice>
      ) : queueCounters === null ? null : (
        <section aria-label={t.countersTitle} className={SECTION_CLASSES}>
          <p className="text-md font-semibold text-text-primary tabular-nums">
            {counterWords(queueCounters, countersLoad.data.asOf).join(" · ")}
          </p>
          <p className={HELP_CLASSES}>{policyLine(queueCounters)}</p>
        </section>
      )}

      <QueueFilterBar
        filters={filters}
        own={ownFilters}
        withAlert={withAlertFilter}
        onChange={change}
        onReset={() => go({})}
      />

      {entriesLoad.kind === "loading" ? (
        <>
          <p role="status" className={HELP_CLASSES}>
            {t.loading}
          </p>
          <SkeletonRows columns={columns.length + 1} />
        </>
      ) : entriesLoad.kind === "invalid" ? (
        <ErrorNotice>{t.periodInvalid}</ErrorNotice>
      ) : entriesLoad.kind === "failed" ? (
        <div className="flex flex-col gap-3">
          <ErrorNotice>
            {entriesLoad.forbidden ? t.forbidden : t.error}
          </ErrorNotice>
          <div className="flex flex-wrap items-center gap-3">
            {entriesLoad.forbidden ? null : (
              <button
                type="button"
                onClick={() => setReload(reload + 1)}
                className={SMALL_SECONDARY_CLASSES}
              >
                {messages.common.retry}
              </button>
            )}
            {paging.page === 1 ? null : (
              <button
                type="button"
                onClick={() => goToPage(FIRST_PAGE)}
                className={SMALL_SECONDARY_CLASSES}
              >
                {t.pageFirst}
              </button>
            )}
          </div>
        </div>
      ) : entriesLoad.data.items.length === 0 ? (
        paging.page > 1 ? (
          <div className="flex flex-col gap-3">
            <p role="status" className={HELP_CLASSES}>
              {t.pageEmpty}
            </p>
            <button
              type="button"
              onClick={() => goToPage(FIRST_PAGE)}
              className={`${SMALL_SECONDARY_CLASSES} self-start`}
            >
              {t.pageFirst}
            </button>
          </div>
        ) : filtered ? (
          <p role="status" className={HELP_CLASSES}>
            {t.noMatch}
          </p>
        ) : (
          <p
            role="status"
            className={`${SUCCESS_CLASSES} flex items-center gap-2`}
          >
            <CircleCheckIcon
              aria-hidden="true"
              className="size-(--size-icon-md) shrink-0"
            />
            {(emptyLine ?? emptyWords)(queueCounters, entriesLoad.data.asOf)}
          </p>
        )
      ) : (
        <>
          <p role="status" className={`${HELP_CLASSES} tabular-nums`}>
            {resultsLine === undefined
              ? t.resultsSorted(entriesLoad.data.items.length)
              : resultsLine(entriesLoad.data.items.length, filters)}
          </p>
          <div ref={tableRef} className="flex flex-col gap-4">
            {splitOverdue === undefined ? (
              entriesTable(entriesLoad.data.items, tableLabel)
            ) : (
              <>
                {split !== null && split.overdue.length > 0 ? (
                  <section
                    aria-labelledby="queue-overdue-title"
                    className={OVERDUE_LIST_CLASSES}
                  >
                    <h2
                      id="queue-overdue-title"
                      className={`${SECTION_TITLE} flex items-center gap-2`}
                    >
                      <FlagIcon
                        aria-hidden="true"
                        className="size-(--size-icon-md) shrink-0 text-feedback-error-icon"
                      />
                      {splitOverdue.overdueTitle}
                    </h2>
                    <p className={HELP_CLASSES}>{splitOverdue.overdueNote}</p>
                    {entriesTable(
                      split.overdue,
                      splitOverdue.overdueTableLabel,
                    )}
                  </section>
                ) : null}
                {split !== null && split.inTime.length > 0 ? (
                  <section
                    aria-labelledby="queue-in-time-title"
                    className="flex flex-col gap-3"
                  >
                    <h2 id="queue-in-time-title" className={SECTION_TITLE}>
                      {splitOverdue.otherTitle}
                    </h2>
                    {entriesTable(split.inTime, tableLabel)}
                  </section>
                ) : null}
              </>
            )}
          </div>
          {paging.page === 1 && entriesLoad.data.nextCursor === null ? null : (
            <nav
              aria-label={t.pagination}
              className="flex flex-wrap items-center gap-3"
            >
              <p className={`${HELP_CLASSES} tabular-nums`}>
                {t.page(paging.page)}
              </p>
              {paging.page < 3 ? null : (
                <button
                  type="button"
                  onClick={() => goToPage(FIRST_PAGE)}
                  className={SMALL_SECONDARY_CLASSES}
                >
                  {t.pageFirst}
                </button>
              )}
              {previous === null ? null : (
                <button
                  type="button"
                  onClick={() => goToPage(previous)}
                  className={SMALL_SECONDARY_CLASSES}
                >
                  {t.pagePrevious}
                </button>
              )}
              {entriesLoad.data.nextCursor === null ? null : (
                <button
                  type="button"
                  onClick={() =>
                    goToPage({
                      page: paging.page + 1,
                      cursor: entriesLoad.data.nextCursor,
                    })
                  }
                  className={SMALL_SECONDARY_CLASSES}
                >
                  {t.pageNext}
                </button>
              )}
            </nav>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <p className={HELP_CLASSES}>{t.keys}</p>
        <button
          type="button"
          aria-expanded={showKeys}
          aria-controls="queue-shortcuts"
          onClick={() => setShowKeys(!showKeys)}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.shortcutsButton}
        </button>
      </div>
      {showKeys ? (
        <section
          id="queue-shortcuts"
          aria-labelledby="queue-shortcuts-title"
          className={SECTION_CLASSES}
        >
          <h2 id="queue-shortcuts-title" className={SECTION_TITLE}>
            {t.shortcutsTitle}
          </h2>
          <dl className={DL_CLASSES}>
            {(
              [
                ["j", t.shortcuts.next],
                ["k", t.shortcuts.previous],
                ["Entrée", t.shortcuts.open],
                ["?", t.shortcuts.help],
              ] as const
            ).map(([key, words]) => (
              <Fragment key={key}>
                <dt className={DT_CLASSES}>
                  <kbd>{key}</kbd>
                </dt>
                <dd className={DD_CLASSES}>{words}</dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}
