"use client";

// Queue 3, « Visuels de portfolio à modérer » (docs/mvp/07 RG77 to RG85, RG93; 15 RG26 to RG28, RG33; 17b §2.7
// line 3; jalons/l2g/modele.md §2, §6; L2G-16): the columns of the queue on the template of the lists. The
// entry IS one visual. The list shows an alias, the kind, the date of the deposit and the number of visuals of
// the profile: NO thumbnail (D82 (7); the decision screen reads the visual, on demand, journaled), no caption, no
// handle. The alias leads to the visuals of that one profile (filter « Profil »). No mass action (Lot 6bis).
// The counters ride on the answer of the list (EC-L2G-11-1): the template reads them there.
import type {
  PortfolioEntriesSearchBody,
  PortfolioEntryRow,
} from "@influx/contracts/creator-queues";
import Link from "next/link";
import { messages } from "@/messages/fr";
import { LINK_CLASSES } from "./bo-classes";
import { searchPortfolioEntries } from "./backoffice-api";
import {
  depositedWords,
  kindWords,
  PORTFOLIO_REVIEW_LIST,
  portfolioOwnFilters,
  profileFilterHref,
  visualCountWords,
} from "./portfolio-queue-view";
import { alertNote } from "./creator-queue-view";
import { DueCell, LockCell, StateCell } from "./QueueCells";
import { QueueTemplate, type QueueColumn } from "./QueueTemplate";

const t = messages.portfolioQueue;

const FILTERS = portfolioOwnFilters();

const COLUMNS: readonly QueueColumn<PortfolioEntryRow>[] = [
  {
    key: "state",
    header: t.columns.state,
    cell: (row) => <StateCell row={row} />,
  },
  {
    key: "due",
    header: t.columns.due,
    sorted: true,
    cell: (row, asOf) => <DueCell row={row} asOf={asOf} />,
  },
  {
    key: "kind",
    header: t.columns.kind,
    cell: (row) => kindWords(row.kind),
  },
  {
    key: "alias",
    header: t.columns.alias,
    cell: (row) => (
      <Link
        href={profileFilterHref(row.accountId)}
        aria-label={t.onlyProfile(row.alias)}
        className={`${LINK_CLASSES} font-semibold`}
      >
        {row.alias}
      </Link>
    ),
  },
  {
    key: "deposited",
    header: t.columns.deposited,
    cell: (row) => <span className="tabular-nums">{depositedWords(row)}</span>,
  },
  {
    key: "visualCount",
    header: t.columns.visualCount,
    cell: (row) => (
      <span className="tabular-nums">{visualCountWords(row)}</span>
    ),
  },
  {
    key: "owner",
    header: t.columns.owner,
    cell: (row) =>
      row.owner?.displayName ?? messages.queueList.ownerOptions.none,
  },
  {
    key: "holder",
    header: t.columns.holder,
    cell: (row) => <LockCell row={row} />,
  },
];

export function PortfolioQueueScreen() {
  return (
    <QueueTemplate<PortfolioEntryRow, PortfolioEntriesSearchBody>
      title={messages.queue.portfolio_moderation}
      lead={t.lead}
      tableLabel={t.tableLabel}
      ownFilters={FILTERS}
      columns={COLUMNS}
      rowNote={alertNote}
      entryOf={(row) => ({
        href: `${PORTFOLIO_REVIEW_LIST}/${row.id}`,
        label: t.openEntryOf(row.alias),
      })}
      loadEntries={searchPortfolioEntries}
    />
  );
}
