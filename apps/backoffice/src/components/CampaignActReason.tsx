"use client";

// The reason and the internal comment of an act of an agent on a campaign (docs/mvp/09 RG93, RG94; l3c/modele.md
// §6; L3C-09): the closed list as radio buttons (the agent SEES the four reasons, never a drop-down), then the
// comment, compulsory for « Autre », which stays internal (never the brand, never the e-mail). One piece for the
// correction, the pause, the resumption and the closing: the same four reasons, the same comment, the same checks.
import {
  INTERVENTION_REASON_CODES,
  type InterventionReasonCode,
} from "@influx/contracts/campaign-review";
import { useId } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { FIELD_CLASSES, TEXTAREA_CLASSES } from "./bo-classes";
import type { Problem } from "./campaign-record-view";
import { ErrorNotice } from "./ErrorNotice";

const t = messages.campaignRecord.actions;

export function CampaignActReason({
  reasonCode,
  comment,
  problem,
  onReason,
  onComment,
}: {
  reasonCode: InterventionReasonCode | null;
  comment: string;
  problem: Problem | null;
  onReason: (code: InterventionReasonCode) => void;
  onComment: (text: string) => void;
}) {
  const ids = {
    reason: useId(),
    comment: useId(),
    help: useId(),
    problem: useId(),
  };
  const reasonProblem = problem?.field === "reason" ? problem : null;
  const commentProblem = problem?.field === "comment" ? problem : null;
  return (
    <>
      <fieldset
        className="flex flex-col gap-2"
        aria-describedby={reasonProblem === null ? undefined : ids.reason}
      >
        <legend className="mb-1 text-sm font-semibold text-text-primary">
          {t.reasonLegend}
        </legend>
        {INTERVENTION_REASON_CODES.map((code) => (
          <label
            key={code}
            className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary"
          >
            <input
              type="radio"
              name={ids.reason}
              value={code}
              checked={reasonCode === code}
              onChange={() => onReason(code)}
              className="size-(--size-checkbox)"
            />
            {t.reasons[code]}
          </label>
        ))}
        {reasonProblem === null ? null : (
          <ErrorNotice id={ids.reason}>{reasonProblem.text}</ErrorNotice>
        )}
      </fieldset>
      <div className={FIELD_CLASSES}>
        <label
          htmlFor={ids.comment}
          className="text-sm font-semibold text-text-primary"
        >
          {t.comment}
        </label>
        <textarea
          id={ids.comment}
          rows={3}
          value={comment}
          aria-invalid={commentProblem !== null || undefined}
          aria-describedby={`${ids.help}${commentProblem === null ? "" : ` ${ids.problem}`}`}
          onChange={(event) => onComment(event.target.value)}
          className={TEXTAREA_CLASSES}
        />
        <p id={ids.help} className={HELP_CLASSES}>
          {t.commentHelp}
        </p>
        {commentProblem === null ? null : (
          <ErrorNotice id={ids.problem}>{commentProblem.text}</ErrorNotice>
        )}
      </div>
    </>
  );
}
