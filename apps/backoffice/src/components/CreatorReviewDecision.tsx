"use client";

// The decision block of the screen of queue 2 (docs/mvp/07 RG5, RG10, RG96 to RG98; 15 RG114 to RG116; 17b §2.5,
// §4.3; jalons/l2g/modele.md §3 « 0244 »; L2G-15): two buttons and two only, the recap that comes before a
// publication (a key never publishes alone, RG115), the picker that comes before a refusal (‹r› never refuses
// alone). The closed list of reasons is an <fieldset> of radio buttons, never a drop-down: the agent must SEE
// the reasons, and the message the creator will receive is written under the reason picked, from the very files
// of the e-mail. The draft belongs to the screen: closing a panel with ‹Échap› loses nothing (RG116). No rule
// here: the screen says what it sends, the server decides.
import {
  CREATOR_MEMBER_MESSAGE_MAX_LENGTH,
  CREATOR_MEMBER_MESSAGE_MIN_LENGTH,
  type CreatorRejectionReasonCode,
} from "@influx/contracts/creator-profile";
import type { OpenCreatorEntryResponse } from "@influx/contracts/creator-queues";
import { useId } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { CommentField, DecisionPanel } from "./ClaimedDecisionParts";
import { reasonPreview } from "./creator-review-view";
import { ErrorNotice } from "./ErrorNotice";
import type { Draft, Problem } from "./verification-decision-view";

const t = messages.creatorReview.decision;

export type CreatorPanel = "publish" | "reject";

function KeyHint({ keys }: { keys: string }) {
  return (
    <span aria-hidden="true" className="ml-2">
      {keys}
    </span>
  );
}

export function CreatorReviewDecision({
  view,
  panel,
  draft,
  reasonCode,
  problem,
  busy,
  onPanel,
  onDraft,
  onReason,
  onPublish,
  onReject,
}: {
  view: OpenCreatorEntryResponse;
  /** The panel of the screen: the two of this block, or another (the release, the help). */
  panel: string | null;
  draft: Draft;
  reasonCode: CreatorRejectionReasonCode | null;
  problem: Problem | null;
  /** Which call is on its way, if any: a second gesture is not taken. */
  busy: string | null;
  onPanel: (next: CreatorPanel | null) => void;
  onDraft: (next: Draft) => void;
  onReason: (next: CreatorRejectionReasonCode) => void;
  onPublish: () => void;
  onReject: () => void;
}) {
  const ids = { message: useId(), messageHelp: useId(), reason: useId() };
  const busyNow = busy !== null;
  const language = (messages.languages as Readonly<Record<string, string>>)[
    view.account.preferredLanguage
  ];
  const picked =
    view.reasons.find((reason) => reason.code === reasonCode) ?? null;
  const preview = picked === null ? null : reasonPreview(picked, draft);
  const reasonProblem = problem?.field === "reason" ? problem : null;
  const messageProblem = problem?.field === "memberMessage" ? problem : null;
  const comment = draft.internalComment.trim();
  const firstPublication = view.profile.firstPublishedAt === null;

  return (
    <section aria-labelledby="creator-decision" className={SECTION_CLASSES}>
      <h2 id="creator-decision" className={SECTION_TITLE}>
        {messages.creatorReview.sections.decision}
      </h2>
      <p className={HELP_CLASSES}>{t.lead}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          aria-keyshortcuts="v"
          aria-expanded={panel === "publish"}
          aria-disabled={busyNow || undefined}
          onClick={() => {
            if (!busyNow) {
              onPanel(panel === "publish" ? null : "publish");
            }
          }}
          className={SMALL_PRIMARY_CLASSES}
        >
          {t.publish}
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

      {panel !== "publish" && panel !== "reject" && problem !== null ? (
        <ErrorNotice>{problem.text}</ErrorNotice>
      ) : null}

      {panel === "publish" ? (
        <DecisionPanel
          id="creator-publish"
          title={t.publishTitle}
          lead={t.publishLead}
          problem={problem}
          busy={busy === "publish"}
          busyNow={busyNow}
          confirmLabel={t.publishConfirm}
          onConfirm={onPublish}
          onCancel={() => onPanel(null)}
        >
          <p className="text-sm text-text-primary">
            {t.publishRecap(view.profile.alias, language ?? "")}
          </p>
          {firstPublication ? (
            <p className="text-sm text-text-primary">{t.publishFirst}</p>
          ) : null}
          {view.revisions.length === 0 ? null : (
            <p className="text-sm text-text-primary">
              {t.publishRevisions(view.revisions.length)}
            </p>
          )}
          {comment === "" ? null : (
            <p className="text-sm text-text-secondary">
              {t.publishCommentRecap}{" "}
              <span className="whitespace-pre-wrap">{comment}</span>
            </p>
          )}
          <CommentField draft={draft} problem={problem} onDraft={onDraft} />
        </DecisionPanel>
      ) : null}

      {panel === "reject" ? (
        <DecisionPanel
          id="creator-reject"
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
            {view.reasons.map((reason) => {
              const selected = reason.code === reasonCode;
              return (
                <div key={reason.code} className="flex flex-col gap-1">
                  <label className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary">
                    <input
                      type="radio"
                      name={ids.reason}
                      value={reason.code}
                      checked={selected}
                      aria-describedby={
                        reasonProblem === null
                          ? undefined
                          : `${ids.reason}-problem`
                      }
                      onChange={() => onReason(reason.code)}
                      className="size-(--size-checkbox)"
                    />
                    {t.reasonLabels[reason.code] ?? reason.code}
                  </label>
                  {selected && preview !== null ? (
                    <div className="ml-7 flex flex-col gap-1 border-l-(length:--border-width-thick) border-border-strong pl-3 text-sm text-text-secondary">
                      <p className="font-semibold text-text-primary">
                        {t.messageToCreator}
                      </p>
                      {preview.paragraphs.map((paragraph, at) => (
                        <p key={at} className="whitespace-pre-wrap">
                          {paragraph}
                        </p>
                      ))}
                      <p>
                        <span className="font-semibold text-text-primary">
                          {t.nextStep}
                        </span>{" "}
                        {preview.nextStep}
                      </p>
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

          {picked?.requiresMemberMessage === true ? (
            <div className={FIELD_CLASSES}>
              <label htmlFor={ids.message} className={SMALL_LABEL_CLASSES}>
                {t.otherMessage}
              </label>
              <textarea
                id={ids.message}
                rows={4}
                value={draft.memberMessage}
                maxLength={CREATOR_MEMBER_MESSAGE_MAX_LENGTH + 200}
                aria-invalid={messageProblem !== null || undefined}
                aria-describedby={`${ids.messageHelp}${messageProblem === null ? "" : ` ${ids.message}-problem`}`}
                onChange={(event) =>
                  onDraft({ ...draft, memberMessage: event.target.value })
                }
                className={TEXTAREA_CLASSES}
              />
              <p
                id={ids.messageHelp}
                className={`${HELP_CLASSES} tabular-nums`}
              >
                {t.otherMessageHelp}{" "}
                {t.otherCount(
                  draft.memberMessage.trim().length,
                  CREATOR_MEMBER_MESSAGE_MAX_LENGTH,
                  CREATOR_MEMBER_MESSAGE_MIN_LENGTH,
                )}
              </p>
              {messageProblem === null ? null : (
                <ErrorNotice id={`${ids.message}-problem`}>
                  {messageProblem.text}
                </ErrorNotice>
              )}
            </div>
          ) : null}
          <CommentField draft={draft} problem={problem} onDraft={onDraft} />
        </DecisionPanel>
      ) : null}
    </section>
  );
}
