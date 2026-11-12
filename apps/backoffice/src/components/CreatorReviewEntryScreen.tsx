"use client";

// The decision screen of queue 2, « Profils créateur à valider » (docs/mvp/07 RG4 to RG10, RG16, RG93 to RG98;
// 15 RG27 C1 to C8, RG36, RG114 to RG117; 17b §2.4 to §2.6; jalons/l2g/modele.md §1, §3 « 0244 »; L2G-15).
// Opening is claiming (C1): the page calls POST …/open when it appears, and the journal of apps/api keeps the
// opening, which serves layer I (handle, link, exact figures) to the holder only: the screen marks it. Three
// modes: it decides (the claim is the caller's), it reads (a colleague holds the entry: a sentence, never an
// error screen), or the entry is closed. The frame, the claim and the calls are those queues 5 and 6 share
// (`ClaimedEntryFrame`, `useClaimedEntry`); the dossier and the two decisions are this screen's own. ‹v› and ‹r›
// open a panel and never decide. It only draws: the rules are the database's and apps/api's.
import type { CreatorRejectionReasonCode } from "@influx/contracts/creator-profile";
import type { OpenCreatorEntryResponse } from "@influx/contracts/creator-queues";
import { useState } from "react";
import { messages } from "@/messages/fr";
import {
  extendCreatorEntryClaim,
  forceReleaseCreatorEntryClaim,
  openCreatorEntry,
  publishCreatorEntry,
  rejectCreatorEntry,
  releaseCreatorEntry,
} from "./backoffice-api";
import { ClaimedEntryFrame } from "./ClaimedEntryFrame";
import { CREATOR_REVIEW_LIST } from "./creator-queue-view";
import {
  entrySubtitle,
  entryTitle,
  publishCheck,
  publishedLines,
  rejectCheck,
  rejectedLines,
} from "./creator-review-view";
import {
  AlertsBlock,
  ClosedBlock,
  LinesBlock,
  ProfileBlock,
  VisualsBlock,
  WrittenBlock,
} from "./CreatorReviewBlocks";
import {
  CreatorReviewDecision,
  type CreatorPanel,
} from "./CreatorReviewDecision";
import {
  useClaimedEntry,
  type ClaimedApi,
  type ClaimedKeys,
} from "./use-claimed-entry";

const t = messages.creatorReview;

const API: ClaimedApi<OpenCreatorEntryResponse> = {
  open: openCreatorEntry,
  release: releaseCreatorEntry,
  extend: extendCreatorEntryClaim,
  forceRelease: forceReleaseCreatorEntryClaim,
};

/** ‹v› opens the recap of the publication, ‹r› the picker of the reason: neither decides (RG114, RG115). */
const KEYS: ClaimedKeys<CreatorPanel> = {
  positive: "publish",
  negative: "reject",
};

const SHORTCUTS = {
  keys: t.shortcuts.keys,
  rows: [
    ["v", t.shortcuts.publish],
    ["r", t.shortcuts.reject],
    ["l", messages.claimedReview.shortcuts.release],
    ["Échap", messages.claimedReview.shortcuts.escape],
    ["?", messages.claimedReview.shortcuts.help],
  ],
} as const;

export function CreatorReviewEntryScreen({ id }: { id: string }) {
  const entry = useClaimedEntry<OpenCreatorEntryResponse, CreatorPanel>(
    id,
    CREATOR_REVIEW_LIST,
    API,
    KEYS,
    "creator",
  );
  const { perform, finish, draft, setProblem, setDraft, panel, problem, busy } =
    entry;
  // the reason typed belongs to this screen: it stays across every error and closed panel (RG116)
  const [reasonCode, setReasonCode] =
    useState<CreatorRejectionReasonCode | null>(null);

  function publish(view: OpenCreatorEntryResponse) {
    if (view.reviewToken === null) {
      return;
    }
    const checked = publishCheck(draft, view.reviewToken);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    void perform(
      "publish",
      view,
      () => publishCreatorEntry(view.entry.id, checked.body),
      (data) => finish(view, data.next, publishedLines(view, data.late)),
    );
  }

  function reject(view: OpenCreatorEntryResponse) {
    if (view.reviewToken === null) {
      return;
    }
    const checked = rejectCheck(
      draft,
      reasonCode,
      view.reasons,
      view.reviewToken,
    );
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    const code = checked.body.reasonCode;
    void perform(
      "reject",
      view,
      () => rejectCreatorEntry(view.entry.id, checked.body),
      (data) => finish(view, data.next, rejectedLines(view, code, data.late)),
    );
  }

  return (
    <ClaimedEntryFrame
      entry={entry}
      list={CREATOR_REVIEW_LIST}
      heading={messages.queue.profiles_creator}
      titleOf={entryTitle}
      subtitleOf={entrySubtitle}
      shortcuts={SHORTCUTS}
    >
      {(view, mode) => (
        <>
          {mode === "closed" ? <ClosedBlock view={view} /> : null}
          <ProfileBlock view={view} />
          <LinesBlock profile={view.profile} />
          <WrittenBlock view={view} />
          <VisualsBlock view={view} canRead={mode === "deciding"} />
          <AlertsBlock view={view} />
          {mode === "deciding" ? (
            <CreatorReviewDecision
              view={view}
              panel={panel}
              draft={draft}
              reasonCode={reasonCode}
              problem={problem}
              busy={busy}
              onPanel={(next) => {
                setProblem(null);
                entry.setPanel(next);
              }}
              onDraft={setDraft}
              onReason={setReasonCode}
              onPublish={() => publish(view)}
              onReject={() => reject(view)}
            />
          ) : null}
        </>
      )}
    </ClaimedEntryFrame>
  );
}
