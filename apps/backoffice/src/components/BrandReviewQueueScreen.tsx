"use client";

// Queue 1, "Profils marque à valider" (docs/mvp/06 RG63, RG64; 17b §2.2, §2.4 l. 516; jalons/l2c/
// file.md A10; L2C-16): the columns of the queue on the template of the lists. The column "Marque"
// shows the trading name until the legal name of L2E (EC-L2C-3); the list carries no coordinate and
// no contact person (D45, D46). An entry opens the decision screen (L2C-17), which takes it in
// charge; the link here is a plain link, the claim is the opening's, journaled by apps/api.
import {
  REVIEW_ENTRY_KINDS,
  type QueueEntryRow,
} from "@influx/contracts/backoffice-queues";
import { messages } from "@/messages/fr";
import { readQueueCounters, searchBrandReviewEntries } from "./backoffice-api";
import { DueCell, LockCell, StateCell } from "./QueueCells";
import { QueueTemplate, type QueueColumn } from "./QueueTemplate";
import { type OwnFilter } from "./queue-view-model";
import { countryName, countryOptions } from "./view-model";

const t = messages.queueList;

/** Filters of the queue, after the common ones (17b §1.7 l. 516: country, first submission or change). */
const OWN_FILTERS: readonly OwnFilter[] = [
  {
    key: "kind",
    label: t.kind,
    options: REVIEW_ENTRY_KINDS.map((value) => ({
      value,
      label: t.kinds[value],
    })),
  },
  {
    key: "country",
    label: t.country,
    options: countryOptions().map((country) => ({
      value: country.code,
      label: country.name,
    })),
  },
];

const COLUMNS: readonly QueueColumn<QueueEntryRow>[] = [
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
  { key: "kind", header: t.columns.kind, cell: (row) => t.kinds[row.kind] },
  {
    key: "brand",
    header: t.columns.brand,
    cell: (row) => <span className="font-semibold">{row.brandName}</span>,
  },
  {
    key: "country",
    header: t.columns.country,
    cell: (row) => countryName(row.countryCode),
  },
  {
    key: "completeness",
    header: t.columns.completeness,
    cell: (row) => (
      <span className="tabular-nums">
        {t.completeness(row.completenessPercent)}
      </span>
    ),
  },
  {
    key: "modified",
    header: t.columns.modified,
    cell: (row) =>
      row.modifiedFields.length === 0
        ? t.wholeProfile
        : row.modifiedFields.map((field) => t.fields[field]).join(", "),
  },
  {
    key: "owner",
    header: t.columns.owner,
    cell: (row) => row.owner?.displayName ?? t.ownerOptions.none,
  },
  {
    key: "holder",
    header: t.columns.holder,
    cell: (row) => <LockCell row={row} />,
  },
];

export function BrandReviewQueueScreen() {
  return (
    <QueueTemplate
      title={messages.queue.profiles_advertiser}
      lead={t.lead}
      queueCode="profiles_advertiser"
      tableLabel={t.tableLabel}
      ownFilters={OWN_FILTERS}
      columns={COLUMNS}
      rowNote={(row) =>
        row.alerts.length === 0
          ? null
          : t.alertLine(row.alerts.map((code) => t.alerts[code]).join(" · "))
      }
      entryOf={(row) => ({
        href: `/files/profils-marque/${row.id}`,
        label: t.openEntryOf(row.brandName),
      })}
      loadEntries={searchBrandReviewEntries}
      loadCounters={readQueueCounters}
    />
  );
}
