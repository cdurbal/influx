"use client";

// Queue 7, « Campagnes à valider » (docs/mvp/09 RG5, RG85, RG87, RG95; 15 RG26 to RG28, RG33; 17b §2.7 line 6,
// §3.8; jalons/l3c/modele.md §1; L3C-08): the columns of the queue on the template of the lists. The list shows
// the brand, the title, the category, the examination (one, or the two of an enhanced review) and the alerts in
// a line of their own: no brief, no band, no budget (the decision screen holds them). An entry opens the
// decision screen, which takes it in charge; the link here is a plain link, the claim is the opening's,
// journaled by apps/api. The counters ride on the answer of the list, as for queues 2 and 3. The queue has no
// filter of its own: the contract is closed on the common ones (15 RG33).
import type {
  CampaignEntriesSearchBody,
  CampaignEntryRow,
} from "@influx/contracts/campaign-review";
import { messages } from "@/messages/fr";
import { searchCampaignEntries } from "./backoffice-api";
import {
  CAMPAIGN_REVIEW_LIST,
  campaignAlertNote,
  campaignBrandWords,
  campaignCategoryWords,
  campaignReviewWords,
  campaignTitleWords,
} from "./campaign-queue-view";
import { DueCell, LockCell, StateCell } from "./QueueCells";
import { QueueTemplate, type QueueColumn } from "./QueueTemplate";

const t = messages.campaignQueue;

const COLUMNS: readonly QueueColumn<CampaignEntryRow>[] = [
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
    key: "brand",
    header: t.columns.brand,
    cell: (row) => (
      <span className="font-semibold">{campaignBrandWords(row)}</span>
    ),
  },
  { key: "title", header: t.columns.title, cell: campaignTitleWords },
  { key: "category", header: t.columns.category, cell: campaignCategoryWords },
  { key: "review", header: t.columns.review, cell: campaignReviewWords },
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

export function CampaignQueueScreen() {
  return (
    <QueueTemplate<CampaignEntryRow, CampaignEntriesSearchBody>
      title={messages.queue.campaigns}
      lead={t.lead}
      tableLabel={t.tableLabel}
      ownFilters={[]}
      columns={COLUMNS}
      rowNote={campaignAlertNote}
      entryOf={(row) => ({
        href: `${CAMPAIGN_REVIEW_LIST}/${row.id}`,
        label: t.openEntryOf(campaignTitleWords(row), campaignBrandWords(row)),
      })}
      loadEntries={searchCampaignEntries}
    />
  );
}
