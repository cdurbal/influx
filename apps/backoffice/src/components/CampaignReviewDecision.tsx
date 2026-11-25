"use client";

// The decision block of the screen of queue 7 (docs/mvp/09 RG5, RG6, RG85, RG89 to RG92; 15 RG114 to RG116; 17b
// §3.8, §4.3; jalons/l3c/modele.md §3, §4; L3C-08, L3C-X5): the responsible (compulsory to publish), the main
// button always « Publier » (D84: one person decides, a sensitive sector included), the facultative secondary
// button « Demander un second avis » (a sensitive sector, no opinion asked yet; it blocks nothing), the refusal,
// the recap that comes before each (a key never decides alone, RG115), the picker of the closed list of reasons
// before a refusal (‹r› never refuses alone, as `BoReasonPicker` draws it for queue 1, with the reasons and the
// message of this queue). The draft belongs to the screen: closing a
// panel with ‹Échap› loses nothing (RG116). No rule here: the screen says what it sends, the server decides.
import {
  CAMPAIGN_MEMBER_MESSAGE_MAX_LENGTH,
  CAMPAIGN_MEMBER_MESSAGE_MIN_LENGTH,
  CAMPAIGN_OPINION_MAX_LENGTH,
  CAMPAIGN_OPINION_MIN_LENGTH,
  type CampaignRejectionReasonCode,
  type OpenCampaignEntryResponse,
} from "@influx/contracts/campaign-review";
import { useId } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { ownerOptions, reasonPreview } from "./campaign-review-view";
import { CommentField, DecisionPanel } from "./ClaimedDecisionParts";
import { ErrorNotice } from "./ErrorNotice";
import type { Draft, Problem } from "./verification-decision-view";

const t = messages.campaignReview.decision;

/** The three panels of this block: the publication, the request of a second opinion (facultative) and the refusal. */
export type CampaignPanel = "publish" | "opinion" | "reject";

function KeyHint({ keys }: { keys: string }) {
  return (
    <span aria-hidden="true" className="ml-2">
      {keys}
    </span>
  );
}

export function CampaignReviewDecision({
  view,
  panel,
  draft,
  reasonCode,
  ownerAgentId,
  opinion,
  problem,
  busy,
  brandBlocked,
  onPanel,
  onDraft,
  onReason,
  onOwner,
  onOpinion,
  onMain,
  onAskOpinion,
  onReject,
}: {
  view: OpenCampaignEntryResponse;
  /** The panel of the screen: the two of this block, or another (the release, the help). */
  panel: string | null;
  draft: Draft;
  reasonCode: CampaignRejectionReasonCode | null;
  ownerAgentId: string | null;
  opinion: string;
  problem: Problem | null;
  /** Which call is on its way, if any: a second gesture is not taken. */
  busy: string | null;
  /** The API said the brand is suspended: the campaign can no longer be published, only refused. */
  brandBlocked: boolean;
  onPanel: (next: CampaignPanel | null) => void;
  onDraft: (next: Draft) => void;
  onReason: (next: CampaignRejectionReasonCode) => void;
  onOwner: (next: string | null) => void;
  onOpinion: (next: string) => void;
  onMain: () => void;
  onAskOpinion: () => void;
  onReject: () => void;
}) {
  const ids = {
    owner: useId(),
    opinion: useId(),
    message: useId(),
    reason: useId(),
  };
  const busyNow = busy !== null;
  const { review } = view.entry;
  // facultative and asked once (first_review_given): a sensitive sector whose opinion is not asked yet
  const canAskOpinion = review.enhancedReview && review.phase === "single";
  const language = (messages.languages as Readonly<Record<string, string>>)[
    view.brand.preferredLanguage
  ];
  const owners = ownerOptions(view);
  const ownerName =
    owners.find((owner) => owner.value === ownerAgentId)?.label ?? "";
  const picked =
    view.reasons.find((reason) => reason.code === reasonCode) ?? null;
  const preview = picked === null ? null : reasonPreview(picked, draft);
  const ownerProblem = problem?.field === "owner" ? problem : null;
  const opinionProblem = problem?.field === "opinion" ? problem : null;
  const reasonProblem = problem?.field === "reason" ? problem : null;
  const messageProblem = problem?.field === "memberMessage" ? problem : null;
  const comment = draft.internalComment.trim();

  return (
    <section aria-labelledby="campaign-decision" className={SECTION_CLASSES}>
      <h2 id="campaign-decision" className={SECTION_TITLE}>
        {messages.campaignReview.sections.decision}
      </h2>
      <p className={HELP_CLASSES}>
        {review.phase === "second_opinion"
          ? t.leadSecondOpinion
          : review.enhancedReview
            ? t.leadEnhanced
            : t.leadSingle}
      </p>

      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.owner} className={SMALL_LABEL_CLASSES}>
          {t.ownerLabel}
        </label>
        <select
          id={ids.owner}
          value={ownerAgentId ?? ""}
          required
          aria-required="true"
          aria-invalid={ownerProblem !== null || undefined}
          aria-describedby={`${ids.owner}-help${ownerProblem === null ? "" : ` ${ids.owner}-problem`}`}
          onChange={(event) =>
            onOwner(event.target.value === "" ? null : event.target.value)
          }
          className={SELECT_CLASSES}
        >
          <option value="">{t.ownerPlaceholder}</option>
          {owners.map((owner) => (
            <option key={owner.value} value={owner.value}>
              {owner.label}
            </option>
          ))}
        </select>
        <p id={`${ids.owner}-help`} className={HELP_CLASSES}>
          {t.ownerHelp}
        </p>
        {ownerProblem === null ? null : (
          <ErrorNotice id={`${ids.owner}-problem`}>
            {ownerProblem.text}
          </ErrorNotice>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          aria-keyshortcuts="v"
          aria-expanded={panel === "publish"}
          aria-disabled={busyNow || brandBlocked || undefined}
          onClick={() => {
            if (!busyNow && !brandBlocked) {
              onPanel(panel === "publish" ? null : "publish");
            }
          }}
          className={SMALL_PRIMARY_CLASSES}
        >
          {t.publish}
          <KeyHint keys="‹v›" />
        </button>
        {canAskOpinion && !brandBlocked ? (
          <button
            type="button"
            aria-expanded={panel === "opinion"}
            aria-disabled={busyNow || undefined}
            onClick={() => {
              if (!busyNow) {
                onPanel(panel === "opinion" ? null : "opinion");
              }
            }}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.askOpinion}
          </button>
        ) : null}
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

      {panel !== "publish" &&
      panel !== "opinion" &&
      panel !== "reject" &&
      problem !== null &&
      problem.field !== "owner" &&
      // the sentence of a suspended brand is the banner of the screen, which stays: never said twice
      problem.text !== messages.claimedReview.refusals.brandNotPublishable ? (
        <ErrorNotice>{problem.text}</ErrorNotice>
      ) : null}

      {panel === "publish" && !brandBlocked ? (
        <DecisionPanel
          id="campaign-publish"
          title={t.publishTitle}
          lead={t.publishLead}
          problem={problem}
          busy={busy === "publish"}
          busyNow={busyNow}
          confirmLabel={t.publishConfirm}
          onConfirm={onMain}
          onCancel={() => onPanel(null)}
        >
          <p className="text-sm text-text-primary">
            {t.publishRecap(
              view.campaign.title,
              view.brand.name,
              language ?? "",
              ownerName === "" ? messages.campaignReview.unset : ownerName,
            )}
          </p>
          {comment === "" ? null : (
            <p className="text-sm text-text-secondary">
              {t.publishCommentRecap}{" "}
              <span className="whitespace-pre-wrap">{comment}</span>
            </p>
          )}
          <CommentField draft={draft} problem={problem} onDraft={onDraft} />
        </DecisionPanel>
      ) : null}

      {panel === "opinion" && canAskOpinion && !brandBlocked ? (
        <DecisionPanel
          id="campaign-opinion-request"
          title={t.askOpinionTitle}
          lead={t.askOpinionLead}
          problem={problem}
          busy={busy === "opinion"}
          busyNow={busyNow}
          confirmLabel={t.askOpinionConfirm}
          onConfirm={onAskOpinion}
          onCancel={() => onPanel(null)}
        >
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.opinion} className={SMALL_LABEL_CLASSES}>
              {t.opinionLabel}
            </label>
            <textarea
              id={ids.opinion}
              rows={5}
              value={opinion}
              maxLength={CAMPAIGN_OPINION_MAX_LENGTH + 200}
              aria-invalid={opinionProblem !== null || undefined}
              aria-describedby={`${ids.opinion}-help${opinionProblem === null ? "" : ` ${ids.opinion}-problem`}`}
              onChange={(event) => onOpinion(event.target.value)}
              className={TEXTAREA_CLASSES}
            />
            <p
              id={`${ids.opinion}-help`}
              className={`${HELP_CLASSES} tabular-nums`}
            >
              {t.opinionHelp}{" "}
              {t.opinionCount(
                opinion.trim().length,
                CAMPAIGN_OPINION_MAX_LENGTH,
                CAMPAIGN_OPINION_MIN_LENGTH,
              )}
            </p>
            {opinionProblem === null ? null : (
              <ErrorNotice id={`${ids.opinion}-problem`}>
                {opinionProblem.text}
              </ErrorNotice>
            )}
          </div>
        </DecisionPanel>
      ) : null}

      {panel === "reject" ? (
        <DecisionPanel
          id="campaign-reject"
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
                        {t.messageToBrand}
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
                maxLength={CAMPAIGN_MEMBER_MESSAGE_MAX_LENGTH + 200}
                aria-invalid={messageProblem !== null || undefined}
                aria-describedby={`${ids.message}-help${messageProblem === null ? "" : ` ${ids.message}-problem`}`}
                onChange={(event) =>
                  onDraft({ ...draft, memberMessage: event.target.value })
                }
                className={TEXTAREA_CLASSES}
              />
              <p
                id={`${ids.message}-help`}
                className={`${HELP_CLASSES} tabular-nums`}
              >
                {t.otherMessageHelp}{" "}
                {t.otherCount(
                  draft.memberMessage.trim().length,
                  CAMPAIGN_MEMBER_MESSAGE_MAX_LENGTH,
                  CAMPAIGN_MEMBER_MESSAGE_MIN_LENGTH,
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
