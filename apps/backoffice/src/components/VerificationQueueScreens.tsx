"use client";

// Queue 4, "vérifications", as two screens, never a mixed one (docs/mvp/08 RG61 to RG66, RG98, CA42 to
// CA44; 17b §3.7; l2e-fiche invariant 10; L2E-21): the creators' view and the brands' view, each its own
// sub-entry of the rail, its own columns (RG63), its own filters and sorts (RG62), on the template of the
// lists. The list carries no handle, no figure, no code, no coordinate: the dossier is the opening's,
// which takes the request in charge and is journaled by apps/api. The link here is a plain link.
import type {
  VerificationQueueEntryRow,
  VerificationEntriesSearchBody,
  VerificationQueueView,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import {
  readQueueCounters,
  searchVerificationBrands,
  searchVerificationCreators,
} from "./backoffice-api";
import { DueCell, StateCell } from "./QueueCells";
import { QueueTemplate, type QueueColumn } from "./QueueTemplate";
import { type QueueFilters } from "./queue-view-model";
import { openedByWords } from "./verification-opening-view";
import {
  ageWords,
  levelWords,
  networkWords,
  resultsWords,
  sortedColumnOf,
  sortOf,
  VERIFICATION_VIEW_ADDRESS,
  verificationEmptyWords,
  verificationLockWords,
  verificationName,
  verificationNote,
  verificationOwnFilters,
} from "./verification-queue-view";
import { countryName, formatDateTime } from "./view-model";

const t = messages.verificationQueue;

type Row = VerificationQueueEntryRow;

/** The columns of 08 RG63, in the order of a reading: the state, the deadline, then what is asked and by whom. */
function columnsOf(
  view: VerificationQueueView,
  filters: QueueFilters,
): readonly QueueColumn<Row>[] {
  const sorted = sortedColumnOf(sortOf(filters, view));
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
    ...(view === "creators"
      ? [
          column("level", t.columns.level, (row) => levelWords(row.level)),
          column("network", t.columns.network, (row) =>
            networkWords(row.networkCode),
          ),
          column("creator", t.columns.creator, (row) => (
            <span className="font-semibold">{verificationName(row, view)}</span>
          )),
        ]
      : [
          column("brand", t.columns.brand, (row) => (
            <span className="font-semibold">{verificationName(row, view)}</span>
          )),
        ]),
    column("country", t.columns.country, (row) => countryName(row.countryCode)),
    column("submitted", t.columns.submitted, (row) => (
      <span className="tabular-nums">{formatDateTime(row.submittedAt)}</span>
    )),
    column("opened", t.columns.opened, (row) => openedByWords(row)),
    column("age", t.columns.age, (row, asOf) => (
      <span className="tabular-nums">{ageWords(row, asOf)}</span>
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

const CREATORS_FILTERS = verificationOwnFilters("creators");
const BRANDS_FILTERS = verificationOwnFilters("brands");

function VerificationQueueScreen({ view }: { view: VerificationQueueView }) {
  const words = t[view];
  return (
    <QueueTemplate<Row, VerificationEntriesSearchBody>
      title={
        view === "creators"
          ? messages.queue.verification_creators
          : messages.queue.verification_brands
      }
      lead={words.lead}
      queueCode={
        view === "creators" ? "verification_creators" : "verification_brands"
      }
      tableLabel={words.tableLabel}
      ownFilters={view === "creators" ? CREATORS_FILTERS : BRANDS_FILTERS}
      columns={(filters) => columnsOf(view, filters)}
      rowNote={(row) => verificationNote(row)}
      entryOf={(row) => ({
        href: `${VERIFICATION_VIEW_ADDRESS[view]}/${row.id}`,
        label: words.openEntryOf(verificationName(row, view)),
      })}
      loadEntries={
        view === "creators"
          ? searchVerificationCreators
          : searchVerificationBrands
      }
      loadCounters={readQueueCounters}
      resultsLine={(count, filters) => resultsWords(count, filters, view)}
      emptyLine={verificationEmptyWords}
      splitOverdue={{
        overdueTitle: t.overdueTitle,
        overdueNote: t.overdueNote,
        overdueTableLabel: words.overdueTableLabel,
        otherTitle: t.otherTitle,
      }}
    />
  );
}

export function VerificationCreatorsQueueScreen() {
  return <VerificationQueueScreen view="creators" />;
}

export function VerificationBrandsQueueScreen() {
  return <VerificationQueueScreen view="brands" />;
}
