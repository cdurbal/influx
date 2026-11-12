"use client";

// The decision screen of queue 3, « Visuels de portfolio à modérer » (docs/mvp/07 RG77 to RG85, RG93, RG95 to
// RG97; 15 RG27 C1 to C8, RG36, RG114 to RG117; 17b §2.4 to §2.6; jalons/l2g/modele.md §1 points 2, 10, §3
// « 0244 »; L2G-16). The entry IS one visual. Opening is claiming (C1): the page calls POST …/open when it
// appears. Three modes: it decides (the claim is the caller's), it reads (a colleague holds the entry: a
// sentence, never an error screen), or the entry is closed. The frame, the claim and the calls are those
// queues 2, 5 and 6 share (`ClaimedEntryFrame`, `useClaimedEntry`); the visual beside its grid and the two
// decisions are this screen's own. ‹v› and ‹r› open a panel and never decide. It only draws: the rules are the
// database's and apps/api's. No mass action (Lot 6bis): one visual, one decision (07 RG78).
import type { PortfolioReviewReason } from "@influx/contracts/creator-queues";
import { useState } from "react";
import { messages } from "@/messages/fr";
import {
  approvePortfolioItem,
  extendPortfolioItemClaim,
  forceReleasePortfolioItemClaim,
  openPortfolioItem,
  rejectPortfolioItem,
  releasePortfolioItem,
} from "./backoffice-api";
import { ClaimedEntryFrame } from "./ClaimedEntryFrame";
import { PORTFOLIO_REVIEW_LIST } from "./portfolio-queue-view";
import {
  approveCheck,
  approvedLines,
  entrySubtitle,
  entryTitle,
  rejectCheck,
  rejectedLines,
  type PortfolioReviewView,
} from "./portfolio-review-view";
import {
  AlertsBlock,
  CaptionBlock,
  ClosedBlock,
  FactsBlock,
  VisualAndGridBlock,
} from "./PortfolioReviewBlocks";
import {
  PortfolioReviewDecision,
  type PortfolioPanel,
} from "./PortfolioReviewDecision";
import {
  useClaimedEntry,
  type ClaimedApi,
  type ClaimedKeys,
} from "./use-claimed-entry";

const t = messages.portfolioReview;

const API: ClaimedApi<PortfolioReviewView> = {
  open: openPortfolioItem,
  release: releasePortfolioItem,
  extend: extendPortfolioItemClaim,
  forceRelease: forceReleasePortfolioItemClaim,
};

/** ‹v› opens the recap of the approval, ‹r› the picker of the reason: neither decides (RG114, RG115). */
const KEYS: ClaimedKeys<PortfolioPanel> = {
  positive: "approve",
  negative: "reject",
};

const SHORTCUTS = {
  keys: t.shortcuts.keys,
  rows: [
    ["v", t.shortcuts.approve],
    ["r", t.shortcuts.reject],
    ["l", messages.claimedReview.shortcuts.release],
    ["Échap", messages.claimedReview.shortcuts.escape],
    ["?", messages.claimedReview.shortcuts.help],
  ],
} as const;

export function PortfolioReviewEntryScreen({ id }: { id: string }) {
  const entry = useClaimedEntry<PortfolioReviewView, PortfolioPanel>(
    id,
    PORTFOLIO_REVIEW_LIST,
    API,
    KEYS,
    "portfolio",
  );
  const { perform, finish, draft, setProblem, setDraft, panel, problem, busy } =
    entry;
  // the reason picked belongs to this screen: it stays across every error and closed panel (RG116)
  const [reasonCode, setReasonCode] = useState<
    PortfolioReviewReason["code"] | null
  >(null);

  function approve(view: PortfolioReviewView) {
    if (view.reviewToken === null) {
      return;
    }
    const checked = approveCheck(draft, view.reviewToken);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    void perform(
      "approve",
      view,
      () => approvePortfolioItem(view.item.id, checked.body),
      (data) => finish(view, data.next, approvedLines(view, data.late)),
    );
  }

  function reject(view: PortfolioReviewView) {
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
      () => rejectPortfolioItem(view.item.id, checked.body),
      (data) => finish(view, data.next, rejectedLines(view, code, data.late)),
    );
  }

  return (
    <ClaimedEntryFrame
      entry={entry}
      list={PORTFOLIO_REVIEW_LIST}
      heading={messages.queue.portfolio_moderation}
      titleOf={entryTitle}
      subtitleOf={entrySubtitle}
      shortcuts={SHORTCUTS}
    >
      {(view, mode) => (
        <>
          {mode === "closed" ? <ClosedBlock view={view} /> : null}
          <VisualAndGridBlock view={view} canRead={mode === "deciding"} />
          <CaptionBlock view={view} />
          <FactsBlock view={view} />
          <AlertsBlock view={view} />
          {mode === "deciding" ? (
            <PortfolioReviewDecision
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
              onApprove={() => approve(view)}
              onReject={() => reject(view)}
            />
          ) : null}
        </>
      )}
    </ClaimedEntryFrame>
  );
}
