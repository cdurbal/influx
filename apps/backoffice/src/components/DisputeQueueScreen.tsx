"use client";

// Queue 5, « Contestations de badge », as a list (docs/mvp/08 RG77, CA52, CA53; 15 RG27 C1 to C8, RG29; 17b
// §2.7; jalons/l2f, commit 19): the alias of the creator, what is contested (a refusal or a withdrawal),
// the reason of the member, the deadline, the lock. The list carries no handle, no text of the creator and
// no figure; the decision screen holds them, and the opening that serves them takes the contest in charge
// and is journaled by apps/api. The link here is a plain link.
import type {
  DisputeEntriesSearchBody,
  DisputeEntryRow,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import { readQueueCounters, searchDisputeEntries } from "./backoffice-api";
import {
  ageWords,
  disputeEmptyWords,
  disputeName,
  disputeOwnFilters,
  disputeReasonWords,
  disputeResultsWords,
  disputeSortOf,
  sortedColumnOf,
} from "./claimed-queue-view";
import { DueCell, StateCell } from "./QueueCells";
import { QueueTemplate, type QueueColumn } from "./QueueTemplate";
import { type QueueFilters } from "./queue-view-model";
import {
  levelWords,
  networkWords,
  verificationLockWords,
} from "./verification-queue-view";
import { countryName, formatDateTime } from "./view-model";

const t = messages.disputeQueue;

type Row = DisputeEntryRow;

/** The address of the screen of one contest. */
const ENTRY_ADDRESS = "/files/contestations";

function columnsOf(filters: QueueFilters): readonly QueueColumn<Row>[] {
  const sorted = sortedColumnOf(disputeSortOf(filters), "submitted");
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
    column("kind", t.columns.kind, (row) => t.kinds[row.kind]),
    column("level", t.columns.level, (row) => levelWords(row.level)),
    column("network", t.columns.network, (row) =>
      networkWords(row.networkCode),
    ),
    column("creator", t.columns.creator, (row) => (
      <span className="font-semibold">{disputeName(row)}</span>
    )),
    column("country", t.columns.country, (row) => countryName(row.countryCode)),
    column("reason", t.columns.reason, (row) =>
      disputeReasonWords(row.reasonCode),
    ),
    column("submitted", t.columns.submitted, (row) => (
      <span className="tabular-nums">{formatDateTime(row.submittedAt)}</span>
    )),
    column("age", t.columns.age, (row, asOf) => (
      <span className="tabular-nums">{ageWords(row.submittedAt, asOf)}</span>
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

const FILTERS = disputeOwnFilters();

export function DisputeQueueScreen() {
  return (
    <QueueTemplate<Row, DisputeEntriesSearchBody>
      title={messages.queue.verification_disputes}
      lead={t.lead}
      queueCode="verification_disputes"
      tableLabel={t.tableLabel}
      ownFilters={FILTERS}
      columns={columnsOf}
      entryOf={(row) => ({
        href: `${ENTRY_ADDRESS}/${row.id}`,
        label: t.openEntryOf(disputeName(row)),
      })}
      loadEntries={searchDisputeEntries}
      loadCounters={readQueueCounters}
      resultsLine={disputeResultsWords}
      emptyLine={disputeEmptyWords}
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
