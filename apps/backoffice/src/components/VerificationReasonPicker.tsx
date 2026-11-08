"use client";

// The typed reason picker of a creator's refusal (docs/mvp/08 RG56 to RG59; 17b §4.3 `BoReasonPicker`;
// jalons/l2e/modele.md §5; L2E-22): the closed list as radio buttons (never a drop-down, the agent must SEE
// the reasons), the message the creator will receive written under the reason picked, what the creator can
// do next, the agent's own text for the two reasons that ask for it, and the stop that `minor` is: the
// agent confirms it. A panel, not a modal: ‹Échap› closes it and the draft stays with the screen (RG116).
// The sentences come from apps/api, from the very files of the e-mail: what is read here is what is sent.
import {
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  type VerificationReasonRow,
} from "@influx/contracts/verification";
import { useEffect, useId, useRef } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  FIELD_CLASSES,
  SECTION_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import {
  messagePreview,
  reasonLabel,
  stopsEverything,
  type Draft,
  type Problem,
} from "./verification-decision-view";

const t = messages.verificationReview.decision;

export function VerificationReasonPicker({
  reasons,
  draft,
  problem,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  reasons: readonly VerificationReasonRow[];
  draft: Draft;
  problem: Problem | null;
  busy: boolean;
  onChange: (next: Draft) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ids = {
    title: useId(),
    message: useId(),
    messageHelp: useId(),
    problem: useId(),
  };
  const panel = useRef<HTMLFormElement>(null);

  // The panel opens on its first reason (or the one already picked): the keyboard goes on from there.
  useEffect(() => {
    const picked = panel.current?.querySelector<HTMLInputElement>(
      "input[type=radio]:checked",
    );
    (
      picked ??
      panel.current?.querySelector<HTMLInputElement>("input[type=radio]")
    )?.focus();
  }, []);

  const picked =
    reasons.find((reason) => reason.code === draft.reasonCode) ?? null;
  const preview = picked === null ? null : messagePreview(picked, draft);
  const reasonProblem = problem?.field === "reason" ? problem : null;
  const messageProblem = problem?.field === "memberMessage" ? problem : null;
  const stopProblem = problem?.field === "stop" ? problem : null;
  const otherProblem =
    problem !== null &&
    problem.field !== "reason" &&
    problem.field !== "memberMessage" &&
    problem.field !== "stop" &&
    problem.field !== "internalComment"
      ? problem
      : null;

  return (
    <form
      ref={panel}
      noValidate
      aria-labelledby={ids.title}
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy) {
          onConfirm();
        }
      }}
      className={SECTION_CLASSES}
    >
      <h3 id={ids.title} className={BLOCK_TITLE}>
        {t.reasonTitle}
      </h3>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-text-primary">
          {t.reasonLegend}
        </legend>
        {reasons.map((reason) => {
          const selected = reason.code === draft.reasonCode;
          return (
            <div key={reason.code} className="flex flex-col gap-1">
              <label className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary">
                <input
                  type="radio"
                  name="verification-rejection-reason"
                  value={reason.code}
                  checked={selected}
                  aria-describedby={
                    reasonProblem === null ? undefined : ids.problem
                  }
                  onChange={() =>
                    onChange({
                      ...draft,
                      reasonCode: reason.code,
                      stopConfirmed: false,
                    })
                  }
                  className="size-(--size-checkbox)"
                />
                {reasonLabel(reason.code)}
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
                  {reason.escalatesToAdmin ? <p>{t.escalates}</p> : null}
                  {reason.purgesEvidence ? <p>{t.purges}</p> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </fieldset>
      {reasonProblem === null ? null : (
        <ErrorNotice id={ids.problem}>{reasonProblem.text}</ErrorNotice>
      )}

      {picked !== null && stopsEverything(picked) ? (
        <div className="flex flex-col gap-2 rounded-md border-(length:--border-width-thick) border-feedback-warning-border p-3">
          <p className="text-sm font-semibold text-text-primary">{t.stop}</p>
          <label className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={draft.stopConfirmed}
              onChange={(event) =>
                onChange({ ...draft, stopConfirmed: event.target.checked })
              }
              className="size-(--size-checkbox)"
            />
            {t.stopConfirm}
          </label>
          {stopProblem === null ? null : (
            <ErrorNotice>{stopProblem.text}</ErrorNotice>
          )}
        </div>
      ) : null}

      {picked?.requiresMemberMessage === true ? (
        <div className={FIELD_CLASSES}>
          <label
            htmlFor={ids.message}
            className="text-sm font-semibold text-text-primary"
          >
            {t.ownMessage}
          </label>
          <textarea
            id={ids.message}
            rows={4}
            value={draft.memberMessage}
            maxLength={VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH + 200}
            aria-invalid={messageProblem !== null || undefined}
            aria-describedby={`${ids.messageHelp}${messageProblem === null ? "" : ` ${ids.problem}-message`}`}
            onChange={(event) =>
              onChange({ ...draft, memberMessage: event.target.value })
            }
            className={TEXTAREA_CLASSES}
          />
          <p id={ids.messageHelp} className={`${HELP_CLASSES} tabular-nums`}>
            {t.ownMessageHelp}{" "}
            {t.ownCount(
              draft.memberMessage.trim().length,
              VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
              VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
            )}
          </p>
          {messageProblem === null ? null : (
            <ErrorNotice id={`${ids.problem}-message`}>
              {messageProblem.text}
            </ErrorNotice>
          )}
        </div>
      ) : null}

      {otherProblem === null ? null : (
        <ErrorNotice>{otherProblem.text}</ErrorNotice>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          aria-disabled={busy || undefined}
          className={SMALL_PRIMARY_CLASSES}
        >
          {busy ? t.busy : t.reasonConfirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.cancel}
        </button>
      </div>
    </form>
  );
}
