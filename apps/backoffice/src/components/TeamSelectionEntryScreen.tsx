"use client";

// The screen of a request of queue 9, « sélection par l'équipe INFLUX » (docs/mvp/10 RG61, RG84; 15 RG27 C1 to
// C3, RG36, RG114 to RG116; 17b §2.4 to §2.6, I13; jalons/l3g/modele.md §5, §8; l3g-fiche invariants 8, 11, 12, 13;
// L3G-13). Opening is claiming (C1): the page calls POST …/open when it appears; the journal of apps/api keeps the
// opening, which serves the criteria and the message to the holder of the live claim. Three modes, as the other
// claimed queues: it decides (the claim is the caller's), it reads (a colleague holds the request: « En cours —
// … », never an error screen), or the request is closed. The frame, the claim and the calls are those they share
// (`ClaimedEntryFrame`, `useClaimedEntry`); there is no forced release here (modele §5). The one decision is the
// closure by a reason of the closed list; ‹r› opens it and never decides. Nothing is written to the outbox, to
// `matching.*` nor to a creator, and the brand is not told (D45, RG8). It only draws: the rules are the database's.
import type { TeamSelectionCloseReason } from "@influx/contracts/backoffice-queues";
import { useState } from "react";
import { messages } from "@/messages/fr";
import {
  closeTeamSelectionEntry,
  extendTeamSelectionEntryClaim,
  openTeamSelectionEntry,
  releaseTeamSelectionEntry,
} from "./backoffice-api";
import { ClaimedEntryFrame } from "./ClaimedEntryFrame";
import {
  closedLines,
  closeCheck,
  entrySubtitle,
  entryTitle,
  TEAM_SELECTION_LIST,
  teamSelectionViewOf,
  type TeamSelectionView,
} from "./team-selection-view";
import {
  ClosureBlock,
  CriteriaBlock,
  MessageBlock,
  RequestBlock,
} from "./TeamSelectionBlocks";
import {
  TeamSelectionDecision,
  type TeamSelectionPanel,
} from "./TeamSelectionDecision";
import {
  useClaimedEntry,
  type ClaimedApi,
  type ClaimedKeys,
} from "./use-claimed-entry";

const t = messages.teamSelectionReview;

/** The calls of the queue: the opening is read into the shape the claimed queues share; no forced release. */
const API: ClaimedApi<TeamSelectionView> = {
  open: async (id) => {
    const result = await openTeamSelectionEntry(id);
    return result.kind === "ok"
      ? { kind: "ok", data: teamSelectionViewOf(result.data) }
      : result;
  },
  release: releaseTeamSelectionEntry,
  extend: extendTeamSelectionEntryClaim,
};

/** ‹r› opens the closure: it never decides. The queue has no second decision, so ‹v› opens nothing. */
const KEYS: ClaimedKeys<TeamSelectionPanel> = {
  positive: null,
  negative: "close",
};

const SHORTCUTS = {
  keys: t.shortcuts.keys,
  rows: [
    ["r", t.shortcuts.close],
    ["l", messages.claimedReview.shortcuts.release],
    ["Échap", messages.claimedReview.shortcuts.escape],
    ["?", messages.claimedReview.shortcuts.help],
  ],
} as const;

export function TeamSelectionEntryScreen({ id }: { id: string }) {
  const entry = useClaimedEntry<TeamSelectionView, TeamSelectionPanel>(
    id,
    TEAM_SELECTION_LIST,
    API,
    KEYS,
    "teamSelection",
  );
  const { perform, finish, draft, setDraft, setProblem, panel, problem, busy } =
    entry;
  // what is typed or picked here stays across every error and closed panel (RG116); the comment lives in the
  // draft of the frame, so that giving the request back asks a confirmation while one is typed (L2EU-7)
  const [reasonCode, setReasonCode] = useState<TeamSelectionCloseReason | null>(
    null,
  );

  function close(view: TeamSelectionView) {
    const checked = closeCheck(reasonCode, draft.internalComment);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    const code = checked.body.reasonCode;
    void perform(
      "close",
      view,
      () => closeTeamSelectionEntry(view.entry.id, checked.body),
      (data) => finish(view, data.next, closedLines(view, code)),
    );
  }

  return (
    <ClaimedEntryFrame
      entry={entry}
      list={TEAM_SELECTION_LIST}
      heading={messages.queue.team_selection}
      titleOf={entryTitle}
      subtitleOf={entrySubtitle}
      shortcuts={SHORTCUTS}
    >
      {(view, mode) => (
        <>
          {mode === "closed" ? <ClosureBlock view={view} /> : null}
          <RequestBlock view={view} />
          <CriteriaBlock view={view} />
          <MessageBlock view={view} />
          {mode === "deciding" ? (
            <TeamSelectionDecision
              panel={panel}
              reasonCode={reasonCode}
              note={draft.internalComment}
              problem={problem}
              busy={busy}
              onPanel={(next) => {
                setProblem(null);
                entry.setPanel(next);
              }}
              onReason={(code) => setReasonCode(code)}
              onNote={(text) => setDraft({ ...draft, internalComment: text })}
              onConfirm={() => close(view)}
            />
          ) : null}
        </>
      )}
    </ClaimedEntryFrame>
  );
}
