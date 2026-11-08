"use client";

// Block ④ of the decision screen of a creator's verification request, "Décision" (docs/mvp/08 RG9, RG47,
// RG49, RG50, RG56 to RG59, RG70, RG98, CA25, CA29; 17b §3.7; jalons/l2e/modele.md §1, §4; L2E-22): two
// issues and a mark. Grant (the recap that comes first: a key never grants alone), refuse with a typed
// reason (the picker that comes first: ‹r› never refuses alone), « à réexaminer » with an internal reason
// (the request stays in the queue, its age keeps running). The expiry of the badge is announced here, at
// the moment of the grant, and what the badge does not state is written beside it. The draft belongs to the
// screen: closing a panel with ‹Échap› loses nothing (RG116). No rule here: the server decides.
import {
  VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH,
  VERIFICATION_REEXAMINE_REASON_CODES,
  type VerificationOpenResponse,
} from "@influx/contracts/verification";
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
import { ErrorNotice } from "./ErrorNotice";
import type { VerificationPanel } from "./use-verification-entry";
import {
  figuresRecap,
  isAudience,
  type Draft,
  type Problem,
} from "./verification-decision-view";
import { VerificationReasonPicker } from "./VerificationReasonPicker";
import { networkWords } from "./verification-queue-view";

const t = messages.verificationReview.decision;

/** The panels the decision block owns; the others (the lifting of a claim, the help) are the screen's. */
export type DecisionPanel = Extract<
  VerificationPanel,
  "grant" | "reject" | "reexamine"
>;

function KeyHint({ keys }: { keys: string }) {
  return (
    <span aria-hidden="true" className="ml-2">
      {keys}
    </span>
  );
}

export function VerificationDecision({
  view,
  draft,
  problem,
  busy,
  busyKind,
  panel,
  onPanel,
  onDraft,
  onOpenGrant,
  onGrant,
  onReject,
  onReexamine,
}: {
  view: VerificationOpenResponse;
  draft: Draft;
  problem: Problem | null;
  busy: boolean;
  busyKind: "grant" | "reject" | "reexamine" | null;
  panel: DecisionPanel | null;
  onPanel: (next: DecisionPanel | null) => void;
  onDraft: (next: Draft) => void;
  onOpenGrant: () => void;
  onGrant: () => void;
  onReject: () => void;
  onReexamine: () => void;
}) {
  const ids = { comment: useId(), recap: useId(), reexamine: useId() };
  const grantButton = useRef<HTMLButtonElement>(null);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const reexamineButton = useRef<HTMLButtonElement>(null);
  const recapTitle = useRef<HTMLHeadingElement>(null);
  const reexamineForm = useRef<HTMLFormElement>(null);
  const before = useRef<DecisionPanel | null>(null);

  // A panel that opens takes the focus (the recap on its title, the picker on its first reason); a panel
  // that closes gives it back to the button that opened it.
  useEffect(() => {
    if (panel === "grant") {
      recapTitle.current?.focus();
    }
    if (panel === "reexamine") {
      reexamineForm.current?.querySelector<HTMLInputElement>("input")?.focus();
    }
    if (panel === null && before.current === "grant") {
      grantButton.current?.focus();
    }
    if (panel === null && before.current === "reject") {
      rejectButton.current?.focus();
    }
    if (panel === null && before.current === "reexamine") {
      reexamineButton.current?.focus();
    }
    before.current = panel;
  }, [panel]);

  const audience = isAudience(view);
  const language =
    (messages.languages as Readonly<Record<string, string>>)[
      view.account.preferredLanguage
    ] ?? "";
  const network = networkWords(view.entry.networkCode);
  const commentProblem = problem?.field === "internalComment" ? problem : null;
  const reexamineProblem = problem?.field === "reexamine" ? problem : null;
  // a sentence that belongs to no field and to no open panel is written under the buttons
  const general =
    problem !== null &&
    problem.field === null &&
    panel !== "grant" &&
    panel !== "reject"
      ? problem
      : null;
  const comment = draft.internalComment.trim();
  const handle = draft.handle.trim();

  return (
    <section
      aria-labelledby="verification-decision"
      className={SECTION_CLASSES}
    >
      <h2 id="verification-decision" className={SECTION_TITLE}>
        {messages.verificationReview.sections.decision}
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
          maxLength={VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH + 200}
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

      <div className="flex flex-col gap-1 text-sm text-text-primary">
        <p>{audience ? t.expiryAudience : t.expiryAccount}</p>
        <p>{t.notAffirm}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          ref={grantButton}
          type="button"
          aria-keyshortcuts="v"
          aria-expanded={panel === "grant"}
          aria-disabled={busy || undefined}
          onClick={() => {
            if (panel === "grant") {
              onPanel(null);
            } else if (!busy) {
              onOpenGrant();
            }
          }}
          className={SMALL_PRIMARY_CLASSES}
        >
          {audience ? t.grantAudience : t.grantAccount}
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
        <button
          ref={reexamineButton}
          type="button"
          aria-expanded={panel === "reexamine"}
          aria-disabled={busy || undefined}
          onClick={() => onPanel(panel === "reexamine" ? null : "reexamine")}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.reexamine}
        </button>
      </div>
      {general === null ? null : <ErrorNotice>{general.text}</ErrorNotice>}

      {panel === "grant" ? (
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
            {t.grantTitle}
          </h3>
          <p className="text-sm text-text-primary">
            {audience
              ? t.grantRecapAudience(
                  network,
                  handle,
                  figuresRecap(draft),
                  language,
                )
              : t.grantRecapAccount(network, handle, language)}
          </p>
          {comment === "" ? null : (
            <p className="text-sm text-text-secondary">
              {t.commentRecap}{" "}
              <span className="whitespace-pre-wrap">{comment}</span>
            </p>
          )}
          {problem === null || problem.field === "internalComment" ? null : (
            <ErrorNotice>{problem.text}</ErrorNotice>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              aria-disabled={busy || undefined}
              onClick={() => {
                if (!busy) {
                  onGrant();
                }
              }}
              className={SMALL_PRIMARY_CLASSES}
            >
              {busyKind === "grant" ? t.busy : t.grantConfirm}
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

      {panel === "reject" ? (
        <VerificationReasonPicker
          reasons={view.reasons}
          draft={draft}
          problem={problem}
          busy={busyKind === "reject"}
          onChange={onDraft}
          onConfirm={onReject}
          onCancel={() => onPanel(null)}
        />
      ) : null}

      {panel === "reexamine" ? (
        <form
          ref={reexamineForm}
          noValidate
          aria-labelledby={ids.reexamine}
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) {
              onReexamine();
            }
          }}
          className={SECTION_CLASSES}
        >
          <h3 id={ids.reexamine} className={BLOCK_TITLE}>
            {t.reexamineTitle}
          </h3>
          <p className={HELP_CLASSES}>{t.reexamineLead}</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold text-text-primary">
              {t.reexamineLegend}
            </legend>
            {VERIFICATION_REEXAMINE_REASON_CODES.map((code) => (
              <label
                key={code}
                className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary"
              >
                <input
                  type="radio"
                  name="verification-reexamine-reason"
                  value={code}
                  checked={draft.reexamineCode === code}
                  onChange={() => onDraft({ ...draft, reexamineCode: code })}
                  className="size-(--size-checkbox)"
                />
                {t.reexamineReasons[code]}
              </label>
            ))}
          </fieldset>
          {reexamineProblem === null ? null : (
            <ErrorNotice>{reexamineProblem.text}</ErrorNotice>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              aria-disabled={busy || undefined}
              className={SMALL_PRIMARY_CLASSES}
            >
              {busyKind === "reexamine" ? t.busy : t.reexamineConfirm}
            </button>
            <button
              type="button"
              onClick={() => onPanel(null)}
              className={SMALL_SECONDARY_CLASSES}
            >
              {t.cancel}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
