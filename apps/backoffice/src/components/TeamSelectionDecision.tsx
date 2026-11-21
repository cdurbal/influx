"use client";

// The closure of a request of queue 9 (docs/mvp/10 RG61; 15 RG27 C6, RG116; 17b I13; jalons/l3g/modele.md §5;
// l3g-fiche invariant 11; L3G-13): the closed list of six reasons as radio buttons (the agent SEES them, never a
// drop-down), and a comment that exists for « Autre » alone, 10 to 500 characters. One decision, no « Proposer »
// before the introductions of Lot 4: the screen says so. A panel, not a modal: ‹Échap› closes it and what was typed
// stays with the screen (RG116). It only draws: the checks are `team-selection-view.ts`, the rules the database's.
import {
  TEAM_SELECTION_CLOSE_REASONS,
  TEAM_SELECTION_NOTE_MAX_LENGTH,
  TEAM_SELECTION_NOTE_MIN_LENGTH,
  type TeamSelectionCloseReason,
} from "@influx/contracts/backoffice-queues";
import { useId } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  TEXTAREA_CLASSES,
} from "./bo-classes";
import { DecisionPanel } from "./ClaimedDecisionParts";
import { ErrorNotice } from "./ErrorNotice";
import type { Problem } from "./verification-decision-view";

const t = messages.teamSelectionReview.decision;

export type TeamSelectionPanel = "close";

export function TeamSelectionDecision({
  panel,
  reasonCode,
  note,
  problem,
  busy,
  onPanel,
  onReason,
  onNote,
  onConfirm,
}: {
  panel: string | null;
  reasonCode: TeamSelectionCloseReason | null;
  note: string;
  problem: Problem | null;
  /** The name of the call on its way, or none. */
  busy: string | null;
  onPanel: (next: TeamSelectionPanel | null) => void;
  onReason: (code: TeamSelectionCloseReason) => void;
  onNote: (text: string) => void;
  onConfirm: () => void;
}) {
  const ids = {
    reason: useId(),
    note: useId(),
    noteHelp: useId(),
    noteProblem: useId(),
    reasonProblem: useId(),
  };
  const reasonProblem = problem?.field === "reason" ? problem : null;
  const noteProblem = problem?.field === "note" ? problem : null;
  return (
    <section aria-labelledby="selection-decision" className={SECTION_CLASSES}>
      <h2 id="selection-decision" className={SECTION_TITLE}>
        {messages.queueReview.sections.decision}
      </h2>
      <p className={HELP_CLASSES}>{t.noProposal}</p>
      {panel === "close" ? (
        <DecisionPanel
          id="selection-close"
          title={t.panelTitle}
          lead={t.panelLead}
          problem={problem}
          busy={busy === "close"}
          busyNow={busy !== null}
          confirmLabel={t.confirm}
          onConfirm={onConfirm}
          onCancel={() => onPanel(null)}
        >
          <fieldset
            className="flex flex-col gap-2"
            aria-describedby={
              reasonProblem === null ? undefined : ids.reasonProblem
            }
          >
            <legend className="mb-1 text-sm font-semibold text-text-primary">
              {t.reasonLegend}
            </legend>
            {TEAM_SELECTION_CLOSE_REASONS.map((code) => (
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
              <ErrorNotice id={ids.reasonProblem}>
                {reasonProblem.text}
              </ErrorNotice>
            )}
          </fieldset>
          <div className={FIELD_CLASSES}>
            <label htmlFor={ids.note} className={SMALL_LABEL_CLASSES}>
              {t.noteLabel(
                TEAM_SELECTION_NOTE_MIN_LENGTH,
                TEAM_SELECTION_NOTE_MAX_LENGTH,
              )}
            </label>
            <textarea
              id={ids.note}
              rows={3}
              value={note}
              maxLength={TEAM_SELECTION_NOTE_MAX_LENGTH}
              aria-invalid={noteProblem !== null || undefined}
              aria-describedby={`${ids.noteHelp}${noteProblem === null ? "" : ` ${ids.noteProblem}`}`}
              onChange={(event) => onNote(event.target.value)}
              className={TEXTAREA_CLASSES}
            />
            <p id={ids.noteHelp} className={HELP_CLASSES}>
              {t.noteHelp}
            </p>
            {noteProblem === null ? null : (
              <ErrorNotice id={ids.noteProblem}>{noteProblem.text}</ErrorNotice>
            )}
          </div>
        </DecisionPanel>
      ) : (
        <button
          type="button"
          aria-keyshortcuts="r"
          aria-disabled={busy !== null || undefined}
          onClick={() => {
            if (busy === null) {
              onPanel("close");
            }
          }}
          className={`${SMALL_PRIMARY_CLASSES} self-start`}
        >
          {t.open}
        </button>
      )}
    </section>
  );
}
