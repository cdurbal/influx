"use client";

// The decision screen of queue 7, « Campagnes à valider » (docs/mvp/09 RG5, RG6, RG21 to RG23, RG85, RG87 to
// RG95; 15 RG27 C1 to C8, RG36, RG114 to RG116; 17b §3.8; jalons/l3c/modele.md §1, §3, §4; L3C-08). Opening is
// claiming (C1): the page calls POST …/open when it appears; the journal of apps/api keeps the opening, which
// serves the brief and the first opinion to the holder only: the screen marks it. Three modes: it decides (the
// claim is the caller's), it reads (a colleague holds the entry: « En cours — … », never an error screen), or
// the entry is closed. The frame, the claim and the calls are those the other claimed queues share
// (`ClaimedEntryFrame`, `useClaimedEntry`); the blocks and the three decisions are this screen's own. ‹v› and
// ‹r› open a panel and never decide. An enhanced review (RG85) has two times: the first examiner passes the
// campaign on with a reasoned opinion, a second person publishes. It only draws: the rules are the database's
// and apps/api's.
import type {
  CampaignRejectionReasonCode,
  OpenCampaignEntryResponse,
} from "@influx/contracts/campaign-review";
import { useState } from "react";
import { messages } from "@/messages/fr";
import {
  extendCampaignEntryClaim,
  firstReviewCampaignEntry,
  forceReleaseCampaignEntryClaim,
  openCampaignEntry,
  publishCampaignEntry,
  rejectCampaignEntry,
  releaseCampaignEntry,
} from "./backoffice-api";
import { CAMPAIGN_REVIEW_LIST } from "./campaign-queue-view";
import {
  decisionKindOf,
  defaultOwnerOf,
  entrySubtitle,
  entryTitle,
  firstReviewCheck,
  forwardedLines,
  publishCheck,
  publishedLines,
  rejectCheck,
  rejectedLines,
  reviewBanner,
} from "./campaign-review-view";
import {
  AlertsBlock,
  BrandBlock,
  BriefBlock,
  CampaignBlock,
  ClosedBlock,
  FirstOpinionBlock,
} from "./CampaignReviewBlocks";
import {
  CampaignReviewDecision,
  type CampaignPanel,
} from "./CampaignReviewDecision";
import { ClaimedEntryFrame } from "./ClaimedEntryFrame";
import { ErrorNotice } from "./ErrorNotice";
import { StatusBanner } from "./ReviewBanners";
import {
  useClaimedEntry,
  type ClaimedApi,
  type ClaimedKeys,
} from "./use-claimed-entry";

const t = messages.campaignReview;

const API: ClaimedApi<OpenCampaignEntryResponse> = {
  open: openCampaignEntry,
  release: releaseCampaignEntry,
  extend: extendCampaignEntryClaim,
  forceRelease: forceReleaseCampaignEntryClaim,
};

/** ‹v› opens the recap of the publication (or of the opinion), ‹r› the picker of the reason: neither decides. */
const KEYS: ClaimedKeys<CampaignPanel> = {
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

export function CampaignReviewEntryScreen({ id }: { id: string }) {
  const entry = useClaimedEntry<OpenCampaignEntryResponse, CampaignPanel>(
    id,
    CAMPAIGN_REVIEW_LIST,
    API,
    KEYS,
    "campaign",
  );
  const { perform, finish, draft, setProblem, setDraft, panel, problem, busy } =
    entry;
  // what is typed or picked here belongs to this screen: it stays across every error and closed panel (RG116)
  const [reasonCode, setReasonCode] =
    useState<CampaignRejectionReasonCode | null>(null);
  const [opinion, setOpinion] = useState("");
  // the responsible is picked once, then kept across the readings of the entry (the default is « moi »)
  const [pickedOwner, setPickedOwner] = useState<{
    value: string | null;
  } | null>(null);
  // the API said the brand is suspended (« brand_not_publishable »): publishing is over, refusing is not
  const [brandBlocked, setBrandBlocked] = useState(false);

  function mainDecision(view: OpenCampaignEntryResponse) {
    if (view.reviewToken === null) {
      return;
    }
    const token = view.reviewToken;
    if (decisionKindOf(view) === "forward") {
      const checked = firstReviewCheck(opinion, token);
      if (!checked.ok) {
        setProblem(checked.problem);
        return;
      }
      void perform(
        "forward",
        view,
        () => firstReviewCampaignEntry(view.entry.id, checked.body),
        (data) => finish(view, data.next, forwardedLines(view)),
      );
      return;
    }
    const owner =
      pickedOwner === null ? defaultOwnerOf(view) : pickedOwner.value;
    const checked = publishCheck(draft, owner, view.responsibles, token);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    void perform(
      "publish",
      view,
      async () => {
        const result = await publishCampaignEntry(view.entry.id, checked.body);
        if (
          result.kind === "failed" &&
          (result.issues ?? []).includes("brand_not_publishable")
        ) {
          setBrandBlocked(true);
          setPanelClosed();
        }
        return result;
      },
      (data) => finish(view, data.next, publishedLines(view, data.late)),
    );
  }

  function setPanelClosed() {
    entry.setPanel(null);
  }

  function reject(view: OpenCampaignEntryResponse) {
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
      () => rejectCampaignEntry(view.entry.id, checked.body),
      (data) => finish(view, data.next, rejectedLines(view, code, data.late)),
    );
  }

  return (
    <ClaimedEntryFrame
      entry={entry}
      list={CAMPAIGN_REVIEW_LIST}
      heading={messages.queue.campaigns}
      titleOf={entryTitle}
      subtitleOf={entrySubtitle}
      shortcuts={SHORTCUTS}
    >
      {(view, mode) => {
        const banner = reviewBanner(view, mode);
        return (
          <>
            {mode === "closed" ? <ClosedBlock view={view} /> : null}
            {banner === null ? null : <StatusBanner banner={banner} />}
            {brandBlocked && mode === "deciding" ? (
              <ErrorNotice>{t.suspended.text}</ErrorNotice>
            ) : null}
            <FirstOpinionBlock view={view} mode={mode} />
            <BrandBlock view={view} />
            <CampaignBlock view={view} />
            <BriefBlock view={view} />
            <AlertsBlock view={view} />
            {mode === "deciding" ? (
              <CampaignReviewDecision
                view={view}
                panel={panel}
                draft={draft}
                reasonCode={reasonCode}
                ownerAgentId={
                  pickedOwner === null
                    ? defaultOwnerOf(view)
                    : pickedOwner.value
                }
                opinion={opinion}
                problem={problem}
                busy={busy}
                brandBlocked={brandBlocked}
                onPanel={(next) => {
                  setProblem(null);
                  entry.setPanel(next);
                }}
                onDraft={setDraft}
                onReason={setReasonCode}
                onOwner={(value) => setPickedOwner({ value })}
                onOpinion={setOpinion}
                onMain={() => mainDecision(view)}
                onReject={() => reject(view)}
              />
            ) : null}
          </>
        );
      }}
    </ClaimedEntryFrame>
  );
}
