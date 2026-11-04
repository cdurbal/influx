"use client";

// The list template of the queues (docs/mvp/15 RG26 to RG28, RG32 to RG34, RG119, RG121, RG114;
// 17b §2.2, §2.3, §2.8, §4.1; skill backoffice-ops; L2C-16), the same for queues 2 to 15: the
// counters and the delay in clear, the common filters then the queue's own, a dense table sorted by
// deadline, its states (loading, empty, no match, error, refused), the keyboard. The address bar
// carries the filters (codes only, 15 RG121). Nothing here decides: apps/api says what is overdue,
// who holds what and which entries the caller may see; the queue gives its columns and its calls.
// Page 1 only, capped by the server (RG34, never an infinite scroll): the cursor of the next page
// does not cross the relay yet, so a capped list says so and asks for a filter (EC-L2C-16-1).
import {
  QUEUE_PAGE_SIZE_MAX,
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
import { CircleCheckIcon } from "./icons";
import { QueueFilterBar } from "./QueueFilterBar";
import {
  addressOf,
  counterWords,
  emptyWords,
  filtersOf,
  policyLine,
  queryOf,
  shortcutOf,
  steppedIndex,
  type OwnFilter,
  type QueueFilters,
} from "./queue-view-model";

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

export type QueueTemplateProps<Row extends QueueRowFacts> = {
  title: string;
  lead: string;
  /** The code of the queue in the counters answer. */
  queueCode: QueueCountersResponse["queues"][number]["queue"];
  tableLabel: string;
  ownFilters: readonly OwnFilter[];
  columns: readonly QueueColumn<Row>[];
  /** The line under a row, in clear (the alerts of the row): null when it has none. */
  rowNote?: (row: Row) => ReactNode;
  /** The entry of a row: its address and the name that labels its link. */
  entryOf: (row: Row) => { href: string; label: string };
  loadEntries: (
    query: Readonly<Record<string, string>>,
  ) => Promise<
    RelayResult<{ asOf: string; items: Row[]; nextCursor: string | null }>
  >;
  loadCounters: () => Promise<RelayResult<QueueCountersResponse>>;
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

export function QueueTemplate<Row extends QueueRowFacts>(
  props: QueueTemplateProps<Row>,
) {
  const {
    title,
    lead,
    queueCode,
    tableLabel,
    ownFilters,
    columns,
    rowNote,
    entryOf,
    loadEntries,
    loadCounters,
  } = props;
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const filters = useMemo(
    () => filtersOf((name) => search.get(name), ownFilters),
    [search, ownFilters],
  );
  const [reload, setReload] = useState(0);
  const loadKey = `${JSON.stringify(filters)}#${reload}`;
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
    let active = true;
    void loadEntries(queryOf(filters, QUEUE_PAGE_SIZE_MAX)).then((result) => {
      if (!active) {
        return;
      }
      const load = loadOf(result);
      if (load === null) {
        router.replace("/");
        return;
      }
      setEntries({ key: loadKey, load });
    });
    return () => {
      active = false;
    };
  }, [filters, loadKey, loadEntries, router]);

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

  const entriesLoad: Load<{
    asOf: string;
    items: Row[];
    nextCursor: string | null;
  }> = entries?.key === loadKey ? entries.load : { kind: "loading" };
  const countersLoad: Load<QueueCountersResponse> =
    counters?.key === loadKey ? counters.load : { kind: "loading" };

  /** A new address: a filter changed. The page is the first one; the screen reads the new address. */
  const go = useCallback(
    (next: QueueFilters) => {
      router.replace(addressOf(pathname, next));
    },
    [pathname, router],
  );
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

  const asOf = entriesLoad.kind === "ok" ? entriesLoad.data.asOf : "";
  const queueCounters =
    countersLoad.kind === "ok"
      ? (countersLoad.data.queues.find((queue) => queue.queue === queueCode) ??
        null)
      : null;
  const filtered = Object.keys(filters).length > 0;

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
      ) : entriesLoad.kind === "failed" ? (
        <div className="flex flex-col gap-3">
          <ErrorNotice>
            {entriesLoad.forbidden ? t.forbidden : t.error}
          </ErrorNotice>
          {entriesLoad.forbidden ? null : (
            <button
              type="button"
              onClick={() => setReload(reload + 1)}
              className={`${SMALL_SECONDARY_CLASSES} self-start`}
            >
              {messages.common.retry}
            </button>
          )}
        </div>
      ) : entriesLoad.data.items.length === 0 ? (
        filtered ? (
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
            {emptyWords(queueCounters, entriesLoad.data.asOf)}
          </p>
        )
      ) : (
        <>
          <p role="status" className={`${HELP_CLASSES} tabular-nums`}>
            {t.resultsSorted(entriesLoad.data.items.length)}
          </p>
          <div ref={tableRef}>
            <DenseTableRegion label={tableLabel}>
              <table className={TABLE_CLASSES}>
                <caption className="sr-only">{tableLabel}</caption>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={
                          column.sorted === true ? "ascending" : undefined
                        }
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
                  {entriesLoad.data.items.map((row) => {
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
          </div>
          {entriesLoad.data.nextCursor === null ? null : (
            <p role="status" className={HELP_CLASSES}>
              {t.capped(QUEUE_PAGE_SIZE_MAX)}
            </p>
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
