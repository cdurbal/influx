"use client";

// Block ⑤ of the decision screen of queue 1 (docs/mvp/17b §2.5 invariants 2 to 4, §4.3, §4.8; 15 RG114
// to RG116; 06 RG6, RG65, RG66; L2C-17): two buttons and two only, the facultative internal comment,
// the recap that comes before a publication (a key never publishes alone, RG115), the picker that
// comes before a refusal (‹r› never refuses alone). The draft belongs to the screen: closing a panel
// with ‹Échap› loses nothing (RG116). No rule here: the screen says what it sends, the server decides.
import type {
  OpenEntryResponse,
  ReviewReason,
} from "@influx/contracts/backoffice-queues";
import { INTERNAL_COMMENT_MAX_LENGTH } from "@influx/contracts/backoffice-queues";
import { useEffect, useId, useRef } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  FIELD_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { BoReasonPicker, type PickerProblem } from "./BoReasonPicker";
import { ErrorNotice } from "./ErrorNotice";
import type { Draft } from "./queue-review-view";

const t = messages.queueReview.decision;

export type DecisionPanel = "publish" | "reject" | null;

function KeyHint({ keys }: { keys: string }) {
  return (
    <span aria-hidden="true" className="ml-2">
      {keys}
    </span>
  );
}

export function ReviewDecision({
  view,
  draft,
  problem,
  busy,
  panel,
  onPanel,
  onDraft,
  onPublish,
  onReject,
}: {
  view: OpenEntryResponse;
  draft: Draft;
  problem: PickerProblem | null;
  busy: boolean;
  panel: DecisionPanel;
  onPanel: (next: DecisionPanel) => void;
  onDraft: (next: Draft) => void;
  onPublish: () => void;
  onReject: () => void;
}) {
  const ids = { comment: useId(), recap: useId() };
  const publishButton = useRef<HTMLButtonElement>(null);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const recapTitle = useRef<HTMLHeadingElement>(null);
  const before = useRef<DecisionPanel>(null);

  // A panel that opens takes the focus (the recap on its title, the picker on its first reason);
  // a panel that closes gives it back to the button that opened it.
  useEffect(() => {
    if (panel === "publish") {
      recapTitle.current?.focus();
    }
    if (panel === null && before.current === "publish") {
      publishButton.current?.focus();
    }
    if (panel === null && before.current === "reject") {
      rejectButton.current?.focus();
    }
    before.current = panel;
  }, [panel]);

  const language = (messages.languages as Readonly<Record<string, string>>)[
    view.account.preferredLanguage
  ];
  const commentProblem = problem?.field === "internalComment" ? problem : null;
  const picker: PickerProblem | null =
    problem !== null && problem.field !== "internalComment" ? problem : null;
  const reasons: readonly ReviewReason[] = view.reasons;
  const comment = draft.internalComment.trim();

  return (
    <section aria-labelledby="review-decision" className={SECTION_CLASSES}>
      <h2 id="review-decision" className={SECTION_TITLE}>
        {messages.queueReview.sections.decision}
      </h2>
      <p className={HELP_CLASSES}>{t.lead}</p>
      <div className={FIELD_CLASSES}>
        <label
          htmlFor={ids.comment}
          className="text-sm font-semibold text-text-primary"
        >
          {t.comment}
        </label>
        <textarea
          id={ids.comment}
          rows={2}
          value={draft.internalComment}
          maxLength={INTERNAL_COMMENT_MAX_LENGTH + 200}
          aria-invalid={commentProblem !== null || undefined}
          onChange={(event) =>
            onDraft({ ...draft, internalComment: event.target.value })
          }
          className={TEXTAREA_CLASSES}
        />
        <p className={HELP_CLASSES}>{t.commentHelp}</p>
        {commentProblem === null ? null : (
          <ErrorNotice>{commentProblem.text}</ErrorNotice>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          ref={publishButton}
          type="button"
          aria-keyshortcuts="v"
          aria-expanded={panel === "publish"}
          aria-disabled={busy || undefined}
          onClick={() => onPanel(panel === "publish" ? null : "publish")}
          className={SMALL_PRIMARY_CLASSES}
        >
          {t.publish}
          <KeyHint keys="‹v›" />
        </button>
        <button
          ref={rejectButton}
          type="button"
          aria-keyshortcuts="r"
          aria-expanded={panel === "reject"}
          aria-disabled={busy || undefined}
          onClick={() => onPanel(panel === "reject" ? null : "reject")}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.reject}
          <KeyHint keys="‹r›" />
        </button>
      </div>

      {panel === "publish" ? (
        <section
          aria-labelledby={ids.recap}
          className="flex flex-col gap-3 rounded-md border-(length:--border-width-thin) border-border-strong p-3"
        >
          <h3
            id={ids.recap}
            ref={recapTitle}
            tabIndex={-1}
            className={BLOCK_TITLE}
          >
            {t.publishTitle}
          </h3>
          <p className="text-sm text-text-primary">
            {t.publishRecap(view.profile.brandName, language ?? "")}
          </p>
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
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!busy) {
                  onPublish();
                }
              }}
              className={SMALL_PRIMARY_CLASSES}
            >
              {busy ? t.busy : t.publishConfirm}
            </button>
            <button
              type="button"
              onClick={() => onPanel(null)}
              className={SMALL_SECONDARY_CLASSES}
            >
              {t.cancel}
            </button>
          </div>
        </section>
      ) : null}

      {panel !== "reject" && picker !== null ? (
        <ErrorNotice>{picker.text}</ErrorNotice>
      ) : null}

      {panel === "reject" ? (
        <BoReasonPicker
          reasons={reasons}
          draft={draft}
          problem={picker}
          busy={busy}
          onChange={onDraft}
          onConfirm={onReject}
          onCancel={() => onPanel(null)}
        />
      ) : null}
    </section>
  );
}
