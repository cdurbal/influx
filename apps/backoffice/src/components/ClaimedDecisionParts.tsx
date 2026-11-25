"use client";

// The small parts the decision panels of queues 5 and 6 share (docs/mvp/08 RG77, RG78, RG116; 15 RG27 C6;
// jalons/l2f, commit 19): the internal comment, the buttons of a panel, and the panel's heading. A panel,
// not a modal: ‹Échap› closes it and what was typed stays with the screen (RG116). It only draws.
import { VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH } from "@influx/contracts/verification";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  BLOCK_TITLE,
  FIELD_CLASSES,
  SECTION_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { ErrorNotice } from "./ErrorNotice";
import type { Draft, Problem } from "./verification-decision-view";

const t = messages.claimedReview;

/** « Commentaire interne »: for agents only, never to the creator, never in the e-mail (RG77, RG78). */
export function CommentField({
  draft,
  problem,
  onDraft,
}: {
  draft: Draft;
  problem: Problem | null;
  onDraft: (next: Draft) => void;
}) {
  const ids = { field: useId(), help: useId(), problem: useId() };
  const mine = problem?.field === "internalComment" ? problem : null;
  return (
    <div className={FIELD_CLASSES}>
      <label htmlFor={ids.field} className={SMALL_LABEL_CLASSES}>
        {t.comment}
      </label>
      <textarea
        id={ids.field}
        value={draft.internalComment}
        maxLength={VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH}
        aria-invalid={mine !== null || undefined}
        aria-describedby={`${ids.help}${mine === null ? "" : ` ${ids.problem}`}`}
        onChange={(event) =>
          onDraft({ ...draft, internalComment: event.target.value })
        }
        className={TEXTAREA_CLASSES}
      />
      <p id={ids.help} className={HELP_CLASSES}>
        {t.commentHelp}
      </p>
      {mine === null ? null : (
        <ErrorNotice id={ids.problem} announce={false}>
          {mine.text}
        </ErrorNotice>
      )}
    </div>
  );
}

/** A decision panel: its title, what it does, its fields, the error that is not a field's, its two buttons. */
export function DecisionPanel({
  id,
  title,
  lead,
  problem,
  busy,
  busyNow,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  /** The problem that names no field of the panel: a refusal of the database, written under the fields. */
  problem: Problem | null;
  /** This panel's own decision is on its way. */
  busy: boolean;
  /** Any call is on its way: a second gesture is not taken. */
  busyNow: boolean;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLFormElement>(null);
  // The panel opens on its first field: the keyboard goes on from there.
  useEffect(() => {
    panel.current
      ?.querySelector<HTMLElement>("input:not([type=hidden]), textarea")
      ?.focus();
  }, []);
  return (
    <form
      ref={panel}
      noValidate
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault();
        if (!busyNow) {
          onConfirm();
        }
      }}
      className={SECTION_CLASSES}
    >
      <h3 id={`${id}-title`} className={BLOCK_TITLE}>
        {title}
      </h3>
      <p className={HELP_CLASSES}>{lead}</p>
      {children}
      {problem !== null && problem.field === null ? (
        <ErrorNotice>{problem.text}</ErrorNotice>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onCancel}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          aria-disabled={busyNow || undefined}
          className={SMALL_PRIMARY_CLASSES}
        >
          {busy ? t.busy : confirmLabel}
        </button>
      </div>
    </form>
  );
}
