"use client";

// Queue 2, « Profils créateur à valider » (docs/mvp/07 RG4 to RG10, RG93; 15 RG26 to RG28, RG33; 17b §2.7 line
// 2; jalons/l2g/modele.md §6; L2G-15): the columns of the queue on the template of the lists. The list shows an
// alias, the country, the networks declared, the score, the badges in force and the fields a revision changes:
// no handle, no link, no figure, no text (the decision screen holds them). An entry opens the decision screen,
// which takes it in charge; the link here is a plain link, the claim is the opening's, journaled by apps/api.
// The counters ride on the answer of the list (EC-L2G-11-1): the template reads them there.
import type {
  CreatorEntriesSearchBody,
  CreatorEntryRow,
} from "@influx/contracts/creator-queues";
import { messages } from "@/messages/fr";
import { searchCreatorEntries } from "./backoffice-api";
import {
  alertNote,
  badgesWords,
  CREATOR_REVIEW_LIST,
  creatorCountry,
  creatorOwnFilters,
  modifiedWords,
  networksWords,
} from "./creator-queue-view";
import { DueCell, LockCell, StateCell } from "./QueueCells";
import { QueueTemplate, type QueueColumn } from "./QueueTemplate";

const t = messages.creatorQueue;

const FILTERS = creatorOwnFilters();

const COLUMNS: readonly QueueColumn<CreatorEntryRow>[] = [
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
    cell: (row) => messages.queueList.kinds[row.kind],
  },
  {
    key: "alias",
    header: t.columns.alias,
    cell: (row) => <span className="font-semibold">{row.alias}</span>,
  },
  { key: "country", header: t.columns.country, cell: creatorCountry },
  { key: "networks", header: t.columns.networks, cell: networksWords },
  {
    key: "completeness",
    header: t.columns.completeness,
    cell: (row) => (
      <span className="tabular-nums">
        {messages.queueList.completeness(row.completenessPercent)}
      </span>
    ),
  },
  { key: "badges", header: t.columns.badges, cell: badgesWords },
  { key: "modified", header: t.columns.modified, cell: modifiedWords },
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

export function CreatorQueueScreen() {
  return (
    <QueueTemplate<CreatorEntryRow, CreatorEntriesSearchBody>
      title={messages.queue.profiles_creator}
      lead={t.lead}
      tableLabel={t.tableLabel}
      ownFilters={FILTERS}
      columns={COLUMNS}
      rowNote={alertNote}
      entryOf={(row) => ({
        href: `${CREATOR_REVIEW_LIST}/${row.id}`,
        label: t.openEntryOf(row.alias),
      })}
      loadEntries={searchCreatorEntries}
    />
  );
}
