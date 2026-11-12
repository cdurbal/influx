"use client";

// The decision block of the screen of queue 3 (docs/mvp/07 RG78, RG95 to RG97; 15 RG114 to RG116; 17b §2.5,
// §4.3; jalons/l2g/modele.md §3 « 0244 »; L2G-16): two buttons and two only, the recap that comes before an
// approval (a key never approves alone, RG115), the picker that comes before a refusal (‹r› never refuses
// alone). The closed grid of reasons is a <fieldset> of radio buttons, never a drop-down: the agent must SEE
// the reasons, each under its number of the grid, and the sentence the creator will receive is written under
// the reason picked, from the very files of the e-mail. No message of the agent to the creator (RG97). The
// draft belongs to the screen: closing a panel with ‹Échap› loses nothing (RG116). No rule here.
import type { PortfolioReviewReason } from "@influx/contracts/creator-queues";
import { useId } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import { CommentField, DecisionPanel } from "./ClaimedDecisionParts";
import { ErrorNotice } from "./ErrorNotice";
import {
  reasonChoices,
  type PortfolioReviewView,
} from "./portfolio-review-view";
import type { Draft, Problem } from "./verification-decision-view";

const t = messages.portfolioReview.decision;

export type PortfolioPanel = "approve" | "reject";

function KeyHint({ keys }: { keys: string }) {
  return (
    <span aria-hidden="true" className="ml-2">
      {keys}
    </span>
  );
}

export function PortfolioReviewDecision({
  view,
  panel,
  draft,
  reasonCode,
  problem,
  busy,
  onPanel,
  onDraft,
  onReason,
  onApprove,
  onReject,
}: {
  view: PortfolioReviewView;
  /** The panel of the screen: the two of this block, or another (the release, the help). */
  panel: string | null;
  draft: Draft;
  reasonCode: PortfolioReviewReason["code"] | null;
  problem: Problem | null;
  /** Which call is on its way, if any: a second gesture is not taken. */
  busy: string | null;
  onPanel: (next: PortfolioPanel | null) => void;
  onDraft: (next: Draft) => void;
  onReason: (next: PortfolioReviewReason["code"]) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const ids = { reason: useId() };
  const busyNow = busy !== null;
  const language = (messages.languages as Readonly<Record<string, string>>)[
    view.account.preferredLanguage
  ];
  const choices = reasonChoices(view.reasons);
  const picked = choices.find((choice) => choice.code === reasonCode) ?? null;
  const reasonProblem = problem?.field === "reason" ? problem : null;
  const comment = draft.internalComment.trim();

  return (
    <section aria-labelledby="portfolio-decision" className={SECTION_CLASSES}>
      <h2 id="portfolio-decision" className={SECTION_TITLE}>
        {messages.portfolioReview.sections.decision}
      </h2>
      <p className={HELP_CLASSES}>{t.lead}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          aria-keyshortcuts="v"
          aria-expanded={panel === "approve"}
          aria-disabled={busyNow || undefined}
          onClick={() => {
            if (!busyNow) {
              onPanel(panel === "approve" ? null : "approve");
            }
          }}
          className={SMALL_PRIMARY_CLASSES}
        >
          {t.approve}
          <KeyHint keys="‹v›" />
        </button>
        <button
          type="button"
          aria-keyshortcuts="r"
          aria-expanded={panel === "reject"}
          aria-disabled={busyNow || undefined}
          onClick={() => {
            if (!busyNow) {
              onPanel(panel === "reject" ? null : "reject");
            }
          }}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.reject}
          <KeyHint keys="‹r›" />
        </button>
      </div>

      {panel !== "approve" && panel !== "reject" && problem !== null ? (
        <ErrorNotice>{problem.text}</ErrorNotice>
      ) : null}

      {panel === "approve" ? (
        <DecisionPanel
          id="portfolio-approve"
          title={t.approveTitle}
          lead={t.approveLead}
          problem={problem}
          busy={busy === "approve"}
          busyNow={busyNow}
          confirmLabel={t.approveConfirm}
          onConfirm={onApprove}
          onCancel={() => onPanel(null)}
        >
          <p className="text-sm text-text-primary">
            {t.approveRecap(view.account.alias, language ?? "")}
          </p>
          {view.item.replaces === null ? null : (
            <p className="text-sm text-text-primary">{t.approveReplacement}</p>
          )}
          {comment === "" ? null : (
            <p className="text-sm text-text-secondary">
              {t.approveCommentRecap}{" "}
              <span className="whitespace-pre-wrap">{comment}</span>
            </p>
          )}
          <CommentField draft={draft} problem={problem} onDraft={onDraft} />
        </DecisionPanel>
      ) : null}

      {panel === "reject" ? (
        <DecisionPanel
          id="portfolio-reject"
          title={t.rejectTitle}
          lead={t.rejectLead}
          problem={problem}
          busy={busy === "reject"}
          busyNow={busyNow}
          confirmLabel={t.reasonConfirm}
          onConfirm={onReject}
          onCancel={() => onPanel(null)}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-text-primary">
              {t.reasonLegend}
            </legend>
            {choices.map((choice) => {
              const selected = choice.code === reasonCode;
              return (
                <div key={choice.code} className="flex flex-col gap-1">
                  <label className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary">
                    <input
                      type="radio"
                      name={ids.reason}
                      value={choice.code}
                      checked={selected}
                      aria-describedby={
                        reasonProblem === null
                          ? undefined
                          : `${ids.reason}-problem`
                      }
                      onChange={() => onReason(choice.code)}
                      className="size-(--size-checkbox)"
                    />
                    {choice.label}
                  </label>
                  {selected && picked !== null ? (
                    <div className="ml-7 flex flex-col gap-1 border-l-(length:--border-width-thick) border-border-strong pl-3 text-sm text-text-secondary">
                      <p className="font-semibold text-text-primary">
                        {t.messageToCreator}
                      </p>
                      <p className="whitespace-pre-wrap">{picked.message}</p>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
          {reasonProblem === null ? null : (
            <ErrorNotice id={`${ids.reason}-problem`}>
              {reasonProblem.text}
            </ErrorNotice>
          )}
          <CommentField draft={draft} problem={problem} onDraft={onDraft} />
        </DecisionPanel>
      ) : null}
    </section>
  );
}
