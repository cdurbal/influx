"use client";

// Queue 6, « Identifiants modifiés à contrôler », as a list (docs/mvp/08 RG78, CA54; 15 RG27 C1 to C8, RG29;
// 17b §2.7; jalons/l2f, commit 19): the alias of the creator, the network, how often the identifier changed,
// the deadline, the lock. NEITHER the former NOR the new identifier is in a list: they are served to the
// holder of the live claim on the decision screen, and never public (modele §5). A plain link opens the entry.
import type {
  IdentifierChangeEntriesSearchBody,
  IdentifierChangeEntryRow,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import {
  readQueueCounters,
  searchIdentifierChangeEntries,
} from "./backoffice-api";
import {
  ageWords,
  identifierEmptyWords,
  identifierName,
  identifierOwnFilters,
  identifierResultsWords,
  identifierSortOf,
  sortedColumnOf,
} from "./claimed-queue-view";
import { DueCell, StateCell } from "./QueueCells";
import { QueueTemplate, type QueueColumn } from "./QueueTemplate";
import { type QueueFilters } from "./queue-view-model";
import { networkWords, verificationLockWords } from "./verification-queue-view";
import { countryName, formatDateTime } from "./view-model";

const t = messages.identifierQueue;

type Row = IdentifierChangeEntryRow;

const ENTRY_ADDRESS = "/files/identifiants-modifies";

function columnsOf(filters: QueueFilters): readonly QueueColumn<Row>[] {
  const sorted = sortedColumnOf(identifierSortOf(filters), "opened");
  const column = (
    key: string,
    header: string,
    cell: QueueColumn<Row>["cell"],
  ): QueueColumn<Row> => ({
    key,
    header,
    cell,
    ...(sorted === key ? { sorted: true } : {}),
  });
  return [
    column("state", t.columns.state, (row) => <StateCell row={row} />),
    column("due", t.columns.due, (row, asOf) => (
      <DueCell row={row} asOf={asOf} />
    )),
    column("network", t.columns.network, (row) =>
      networkWords(row.networkCode),
    ),
    column("creator", t.columns.creator, (row) => (
      <span className="font-semibold">{identifierName(row)}</span>
    )),
    column("country", t.columns.country, (row) => countryName(row.countryCode)),
    column("changes", t.columns.changes, (row) => t.changes(row.changeCount)),
    column("opened", t.columns.opened, (row) => (
      <span className="tabular-nums">{formatDateTime(row.createdAt)}</span>
    )),
    column("lastChanged", t.columns.lastChanged, (row) => (
      <span className="tabular-nums">{formatDateTime(row.lastChangedAt)}</span>
    )),
    column("age", t.columns.age, (row, asOf) => (
      <span className="tabular-nums">{ageWords(row.createdAt, asOf)}</span>
    )),
    column(
      "owner",
      t.columns.owner,
      (row) => row.owner?.displayName ?? messages.queueList.ownerOptions.none,
    ),
    column("holder", t.columns.holder, (row) => (
      <span className="tabular-nums">{verificationLockWords(row)}</span>
    )),
  ];
}

const FILTERS = identifierOwnFilters();

export function IdentifierChangeQueueScreen() {
  return (
    <QueueTemplate<Row, IdentifierChangeEntriesSearchBody>
      title={messages.queue.identity_change_review}
      lead={t.lead}
      queueCode="identity_change_review"
      tableLabel={t.tableLabel}
      ownFilters={FILTERS}
      columns={columnsOf}
      entryOf={(row) => ({
        href: `${ENTRY_ADDRESS}/${row.id}`,
        label: t.openEntryOf(identifierName(row)),
      })}
      loadEntries={searchIdentifierChangeEntries}
      loadCounters={readQueueCounters}
      resultsLine={identifierResultsWords}
      emptyLine={identifierEmptyWords}
      withAlertFilter={false}
      splitOverdue={{
        overdueTitle: messages.verificationQueue.overdueTitle,
        overdueNote: messages.verificationQueue.overdueNote,
        overdueTableLabel: t.overdueTableLabel,
        otherTitle: messages.verificationQueue.otherTitle,
      }}
    />
  );
}
