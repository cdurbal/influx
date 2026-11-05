"use client";

// The typed reason picker (docs/mvp/17b §4.3 `BoReasonPicker`; 15 RG7, RG8, RG114, RG116; 06 RG66;
// jalons/l2c/file.md A6; L2C-17): the closed list as radio buttons (never a drop-down, the agent must
// SEE the eight reasons), the message the brand will receive written under the reason picked, the
// agent's own text for the reason that has one, (the internal comment stays
// in the decision block: one field for both issues). A panel, not a
// modal: ‹Échap› closes it and the draft stays with the screen (RG116). The sentences come from
// apps/api, from the very files of the e-mail: what is read here is what is sent (RG66, C6).
import type { ReviewReason } from "@influx/contracts/backoffice-queues";
import {
  MEMBER_MESSAGE_MAX_LENGTH,
  MEMBER_MESSAGE_MIN_LENGTH,
} from "@influx/contracts/backoffice-queues";
import { useEffect, useId, useRef } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  BLOCK_TITLE,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import {
  messagePreview,
  type Draft,
  type FieldProblem,
} from "./queue-review-view";

const t = messages.queueReview.decision;

export type PickerProblem = { field: FieldProblem | null; text: string };

export function BoReasonPicker({
  reasons,
  draft,
  problem,
  busy,
  onChange,
  onConfirm,
  onCancel,
}: {
  reasons: readonly ReviewReason[];
  draft: Draft;
  problem: PickerProblem | null;
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
  const messageProblem = problem?.field === "memberMessage" ? problem : null;
  const reasonProblem = problem?.field === "reason" ? problem : null;
  const otherProblem = problem?.field === null ? problem : null;

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
                  name="rejection-reason"
                  value={reason.code}
                  checked={selected}
                  aria-describedby={
                    reasonProblem === null ? undefined : ids.problem
                  }
                  onChange={() =>
                    onChange({ ...draft, reasonCode: reason.code })
                  }
                  className="size-(--size-checkbox)"
                />
                {t.reasonLabels[reason.code]}
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
        <ErrorNotice id={ids.problem}>{reasonProblem.text}</ErrorNotice>
      )}

      {picked?.requiresMemberMessage === true ? (
        <div className={FIELD_CLASSES}>
          <label
            htmlFor={ids.message}
            className="text-sm font-semibold text-text-primary"
          >
            {t.otherMessage}
          </label>
          <textarea
            id={ids.message}
            rows={4}
            value={draft.memberMessage}
            maxLength={MEMBER_MESSAGE_MAX_LENGTH + 200}
            aria-invalid={messageProblem !== null || undefined}
            aria-describedby={`${ids.messageHelp}${messageProblem === null ? "" : ` ${ids.problem}-message`}`}
            onChange={(event) =>
              onChange({ ...draft, memberMessage: event.target.value })
            }
            className={TEXTAREA_CLASSES}
          />
          <p id={ids.messageHelp} className={`${HELP_CLASSES} tabular-nums`}>
            {t.otherMessageHelp}{" "}
            {t.otherCount(
              draft.memberMessage.trim().length,
              MEMBER_MESSAGE_MAX_LENGTH,
              MEMBER_MESSAGE_MIN_LENGTH,
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
