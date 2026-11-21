"use client";

// Queue 9, « sélection par l'équipe INFLUX » (docs/mvp/10 RG61, RG84; 15 RG26 to RG28, RG33, RG34, C5, AL23; 17b
// §2.7, I13; jalons/l3g/modele.md §5, §8; L3G-13): the columns of the queue on the template of the lists. The list
// shows the brand, the campaign of origin, the language, the deadline frozen at the deposit and the lock: never
// the message nor the criteria of the brand (the screen of the request serves them to the holder, logged), no
// amount, no creator. An entry opens the screen of the request, which takes it in charge; the link here is a
// plain link, the claim is the opening's. The counters ride on the answer of the list. The queue has no commercial
// responsible and no alert to filter by: the contract is closed on the filters it applies (15 RG33).
import type { TeamSelectionEntriesSearchBody } from "@influx/contracts/backoffice-queues";
import { messages } from "@/messages/fr";
import { searchTeamSelectionEntries } from "./backoffice-api";
import { DueCell, LockCell, StateCell } from "./QueueCells";
import { QueueTemplate, type QueueColumn } from "./QueueTemplate";
import {
  listRowOf,
  selectionBrandWords,
  selectionCampaignWords,
  TEAM_SELECTION_LIST,
  type TeamSelectionListRow,
} from "./team-selection-view";
import { languageWords } from "./identified-search-view";

const t = messages.teamSelectionQueue;

const COLUMNS: readonly QueueColumn<TeamSelectionListRow>[] = [
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
      <span className="font-semibold">{selectionBrandWords(row)}</span>
    ),
  },
  {
    key: "campaign",
    header: t.columns.campaign,
    cell: selectionCampaignWords,
  },
  {
    key: "language",
    header: t.columns.language,
    cell: (row) => languageWords(row.language),
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

/** One page, its rows given the field the template reads (no stage of escalation of its own). */
async function loadPage(body: TeamSelectionEntriesSearchBody) {
  const result = await searchTeamSelectionEntries(body);
  return result.kind === "ok"
    ? {
        kind: "ok" as const,
        data: { ...result.data, items: result.data.items.map(listRowOf) },
      }
    : result;
}

export function TeamSelectionQueueScreen() {
  return (
    <QueueTemplate<TeamSelectionListRow, TeamSelectionEntriesSearchBody>
      title={messages.queue.team_selection}
      lead={t.lead}
      tableLabel={t.tableLabel}
      ownFilters={[]}
      columns={COLUMNS}
      withAlertFilter={false}
      withOwnerFilter={false}
      emptyLine={() => t.emptyLine}
      entryOf={(row) => ({
        href: `${TEAM_SELECTION_LIST}/${row.id}`,
        label: t.openEntryOf(selectionBrandWords(row)),
      })}
      loadEntries={loadPage}
    />
  );
}
