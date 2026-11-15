"use client";

// The acts of an agent on a campaign, from its record (docs/mvp/09 RG8, RG9, RG93, RG94, CA60; l3c/modele.md §5,
// §6; l3c-fiche invariants 6, 7; L3C-09): correct ONE field (a draft, a refused campaign, or a pending one under
// the agent's own claim), pause, resume, close (irreversible, confirmed). The state decides what is offered (the
// database refuses the rest: a conflict reads the record again). Every act asks for a typed reason, is journaled
// in the agent's name by apps/api and told to the brand by e-mail; nothing here decides a rule. The panels are
// `CampaignRecordPanels`; the state of the screen (the record, its reload) stays with `CampaignRecordScreen`.
import type { CampaignRecordResponse } from "@influx/contracts/campaign-review";
import { useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import { correctCampaignField, passCampaign } from "./backoffice-api";
import {
  SECTION_CLASSES,
  SECTION_TITLE,
  SMALL_SECONDARY_CLASSES,
  SUCCESS_CLASSES,
} from "./bo-classes";
import {
  actFailureOf,
  actionsNote,
  actionsOf,
  correctedNotice,
  correctionCheck,
  EMPTY_CORRECTION,
  EMPTY_PASSAGE,
  passageCheck,
  type CorrectionDraft,
  type PassageDraft,
  type Problem,
  type RecordAction,
} from "./campaign-record-view";
import { CorrectionPanel, PassagePanel } from "./CampaignRecordPanels";
import { useAction } from "./use-action";

const t = messages.campaignRecord;

const ACTION_LABELS: Readonly<Record<RecordAction, string>> = {
  correct: t.actions.correct,
  pause: t.actions.pause,
  resume: t.actions.resume,
  close: t.actions.close,
};

export function CampaignRecordActions({
  record,
  onChanged,
}: {
  record: CampaignRecordResponse;
  /** The record changed (or the base says it is not what was drawn): the screen reads it again. */
  onChanged: () => void;
}) {
  const action = useAction();
  const [panel, setPanel] = useState<RecordAction | null>(null);
  const [correction, setCorrection] =
    useState<CorrectionDraft>(EMPTY_CORRECTION);
  const [passage, setPassage] = useState<PassageDraft>(EMPTY_PASSAGE);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const offered = actionsOf(record.cycle.status);
  const note = actionsNote(record.cycle.status);
  // a panel of a state the record no longer offers (after a reading again) is not drawn
  const open = panel !== null && offered.includes(panel) ? panel : null;

  function openPanel(next: RecordAction) {
    setProblem(null);
    setNotice(null);
    action.clear();
    setPanel(panel === next ? null : next);
  }

  function failure(code: string | undefined, issues: readonly string[]) {
    const own = actFailureOf(code, issues);
    if (own === null) {
      return null;
    }
    if (own.readsAgain) {
      onChanged();
    }
    return own.text;
  }

  function submitCorrection() {
    const checked = correctionCheck(correction, record.fields);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    setProblem(null);
    void action.run(
      () => correctCampaignField(record.id, checked.body),
      (data) => {
        setNotice(correctedNotice(data.reviewToken));
        setCorrection(EMPTY_CORRECTION);
        setPanel(null);
        onChanged();
      },
      failure,
    );
  }

  function submitPassage(which: "pause" | "resume" | "close") {
    const checked = passageCheck(passage);
    if (!checked.ok) {
      setProblem(checked.problem);
      return;
    }
    setProblem(null);
    void action.run(
      () => passCampaign(record.id, which, checked.body),
      () => {
        setNotice(t.passage[which].done);
        setPassage(EMPTY_PASSAGE);
        setPanel(null);
        onChanged();
      },
      failure,
    );
  }

  return (
    <section aria-labelledby="record-actions" className={SECTION_CLASSES}>
      <h2 id="record-actions" className={SECTION_TITLE}>
        {t.sections.actions}
      </h2>
      <p className={HELP_CLASSES}>{t.actions.lead}</p>
      {note === null ? null : (
        <p className="text-sm text-text-primary">{note}</p>
      )}
      {notice === null ? null : (
        <p role="status" className={SUCCESS_CLASSES}>
          {notice}
        </p>
      )}
      {offered.length === 0 ? null : (
        <div className="flex flex-wrap gap-3">
          {offered.map((item) => (
            <button
              key={item}
              type="button"
              aria-expanded={open === item}
              onClick={() => openPanel(item)}
              className={SMALL_SECONDARY_CLASSES}
            >
              {ACTION_LABELS[item]}
            </button>
          ))}
        </div>
      )}
      {open === "correct" ? (
        <CorrectionPanel
          record={record}
          draft={correction}
          problem={problem}
          busy={action.busy}
          onDraft={setCorrection}
          onSubmit={submitCorrection}
          onCancel={() => setPanel(null)}
        />
      ) : null}
      {open === "pause" || open === "resume" || open === "close" ? (
        <PassagePanel
          key={open}
          passage={open}
          record={record}
          draft={passage}
          problem={problem}
          busy={action.busy}
          onDraft={setPassage}
          onSubmit={() => submitPassage(open)}
          onCancel={() => setPanel(null)}
        />
      ) : null}
      <ActionFeedback action={action} />
    </section>
  );
}
