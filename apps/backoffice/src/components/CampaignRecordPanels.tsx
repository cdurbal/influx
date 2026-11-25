"use client";

// The two panels of the acts of an agent on a campaign (docs/mvp/09 RG8, RG9, RG93, RG94, CA60; l3c/modele.md §5,
// §6; L3C-09): the correction of ONE field (the field, its value now, the new value typed by the kind of the
// field, the reason), and the passage (pause, resumption, closing: a recap, the reason, the confirmation). A
// panel, not a modal: ‹Échap› closes it and the draft stays with the screen (15 RG116). They only draw and
// collect: the state, the checks and the calls are the screen's (`CampaignRecordActions`).
import type { CampaignRecordResponse } from "@influx/contracts/campaign-review";
import Link from "next/link";
import { useEffect, useId, useRef, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, inputClasses } from "./auth-classes";
import {
  FIELD_CLASSES,
  SECTION_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TEXTAREA_CLASSES,
  BLOCK_TITLE,
} from "./bo-classes";
import { CampaignActReason } from "./CampaignActReason";
import {
  CORRECTABLE_FIELDS,
  currentWords,
  entryHref,
  fieldLabel,
  informedLine,
  initialText,
  openEntryIdOf,
  specOf,
  type CorrectionDraft,
  type FieldSpec,
  type PassageDraft,
  type Problem,
} from "./campaign-record-view";
import { ErrorNotice } from "./ErrorNotice";

const t = messages.campaignRecord;

/** The panels open on their first control, so that the keyboard goes on from there; ‹Échap› hands it back. */
function usePanelFocus(onCancel: () => void) {
  const panel = useRef<HTMLFormElement>(null);
  const cancel = useRef(onCancel);
  useEffect(() => {
    cancel.current = onCancel;
  });
  useEffect(() => {
    const form = panel.current;
    form
      ?.querySelector<HTMLElement>("select, input, textarea, button")
      ?.focus();
    function close(event: KeyboardEvent) {
      if (event.key === "Escape") {
        cancel.current();
      }
    }
    form?.addEventListener("keydown", close);
    return () => form?.removeEventListener("keydown", close);
  }, []);
  return panel;
}

/** The control of the new value, by the kind of the field: a text, a list, a yes or no, a number, a date. */
function ValueEditor({
  id,
  labelId,
  spec,
  text,
  problem,
  describedBy,
  onText,
}: {
  id: string;
  labelId: string;
  spec: FieldSpec;
  text: string;
  problem: Problem | null;
  describedBy: string | undefined;
  onText: (next: string) => void;
}) {
  const invalid = problem !== null || undefined;
  const common = {
    id,
    "aria-invalid": invalid,
    "aria-describedby": describedBy,
  };
  switch (spec.kind) {
    case "multiline":
    case "lines":
      return (
        <textarea
          {...common}
          rows={spec.kind === "lines" ? 5 : 6}
          value={text}
          onChange={(event) => onText(event.target.value)}
          className={TEXTAREA_CLASSES}
        />
      );
    case "choice":
      return (
        <select
          {...common}
          value={text}
          onChange={(event) => onText(event.target.value)}
          className={SELECT_CLASSES}
        >
          <option value="">{t.correct.valuePlaceholder}</option>
          {(spec.options ?? []).map((code) => (
            <option key={code} value={code}>
              {spec.words?.[code] ?? code}
            </option>
          ))}
        </select>
      );
    case "yesno":
      return (
        <fieldset
          id={id}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          className="flex flex-wrap gap-4"
        >
          {(["yes", "no"] as const).map((value) => (
            <label
              key={value}
              className="flex min-h-(--size-bo-control) items-center gap-2 text-sm text-text-primary"
            >
              <input
                type="radio"
                name={id}
                value={value}
                checked={text === value}
                onChange={() => onText(value)}
                className="size-(--size-checkbox)"
              />
              {value === "yes" ? t.correct.yes : t.correct.no}
            </label>
          ))}
        </fieldset>
      );
    case "integer":
      return (
        <input
          {...common}
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(event) => onText(event.target.value)}
          className={inputClasses(problem !== null)}
        />
      );
    case "date":
      return (
        <input
          {...common}
          type="date"
          value={text}
          onChange={(event) => onText(event.target.value)}
          className={inputClasses(problem !== null)}
        />
      );
    case "text":
      return (
        <input
          {...common}
          type="text"
          value={text}
          onChange={(event) => onText(event.target.value)}
          className={inputClasses(problem !== null)}
        />
      );
  }
}

/** The correction of ONE field (09 RG94, CA60): the old value shown, the new value, a typed reason, the brand told. */
export function CorrectionPanel({
  record,
  draft,
  problem,
  busy,
  onDraft,
  onSubmit,
  onCancel,
}: {
  record: CampaignRecordResponse;
  draft: CorrectionDraft;
  problem: Problem | null;
  busy: boolean;
  onDraft: (next: CorrectionDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const ids = {
    title: useId(),
    field: useId(),
    value: useId(),
    problem: useId(),
  };
  const panel = usePanelFocus(onCancel);
  const spec = specOf(draft.fieldCode);
  const fieldProblem = problem?.field === "field" ? problem : null;
  const valueProblem = problem?.field === "value" ? problem : null;
  const otherProblem =
    problem !== null &&
    problem.field !== "field" &&
    problem.field !== "value" &&
    problem.field !== "reason" &&
    problem.field !== "comment"
      ? problem
      : null;
  const entryId = openEntryIdOf(record);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) {
      onSubmit();
    }
  }

  return (
    <form
      ref={panel}
      noValidate
      aria-labelledby={ids.title}
      onSubmit={submit}
      className={SECTION_CLASSES}
    >
      <h3 id={ids.title} className={BLOCK_TITLE}>
        {t.correct.title}
      </h3>
      <p className={HELP_CLASSES}>{t.correct.lead}</p>
      <p className={HELP_CLASSES}>{t.correct.scope}</p>
      {record.cycle.status === "pending_review" ? (
        <p className={HELP_CLASSES}>
          {t.correct.pending}{" "}
          {entryId === null ? null : (
            <Link
              href={entryHref(entryId)}
              className="text-text-primary underline"
            >
              {t.correct.openEntry}
            </Link>
          )}
        </p>
      ) : null}
      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.field} className={SMALL_LABEL_CLASSES}>
          {t.correct.field}
        </label>
        <select
          id={ids.field}
          value={draft.fieldCode ?? ""}
          aria-invalid={fieldProblem !== null || undefined}
          aria-describedby={fieldProblem === null ? undefined : ids.problem}
          onChange={(event) => {
            const next =
              CORRECTABLE_FIELDS.find(
                (item) => item.code === event.target.value,
              ) ?? null;
            onDraft({
              ...draft,
              fieldCode: next?.code ?? null,
              text: next === null ? "" : initialText(next, record.fields),
            });
          }}
          className={SELECT_CLASSES}
        >
          <option value="">{t.correct.fieldPlaceholder}</option>
          {CORRECTABLE_FIELDS.map((item) => (
            <option key={item.code} value={item.code}>
              {fieldLabel(item)}
            </option>
          ))}
        </select>
        {fieldProblem === null ? null : (
          <ErrorNotice id={ids.problem}>{fieldProblem.text}</ErrorNotice>
        )}
      </div>
      {spec === null ? null : (
        <>
          <div className="flex flex-col gap-1">
            <p className={SMALL_LABEL_CLASSES}>{t.correct.current}</p>
            <p
              data-current-value
              className="text-sm break-words whitespace-pre-wrap text-text-primary"
            >
              {currentWords(spec, record.fields)}
            </p>
          </div>
          <div className={FIELD_CLASSES}>
            <label
              id={`${ids.value}-label`}
              htmlFor={ids.value}
              className={SMALL_LABEL_CLASSES}
            >
              {t.correct.newValue}
            </label>
            <ValueEditor
              key={spec.code}
              id={ids.value}
              labelId={`${ids.value}-label`}
              spec={spec}
              text={draft.text}
              problem={valueProblem}
              describedBy={
                [
                  spec.kind === "lines" ? `${ids.value}-help` : null,
                  valueProblem === null ? null : `${ids.value}-problem`,
                ]
                  .filter((part) => part !== null)
                  .join(" ") || undefined
              }
              onText={(text) => onDraft({ ...draft, text })}
            />
            {spec.kind === "lines" ? (
              <p id={`${ids.value}-help`} className={HELP_CLASSES}>
                {t.correct.linesHelp}
              </p>
            ) : null}
            {valueProblem === null ? null : (
              <ErrorNotice id={`${ids.value}-problem`}>
                {valueProblem.text}
              </ErrorNotice>
            )}
          </div>
        </>
      )}
      <CampaignActReason
        reasonCode={draft.reasonCode}
        comment={draft.comment}
        problem={problem}
        onReason={(reasonCode) => onDraft({ ...draft, reasonCode })}
        onComment={(comment) => onDraft({ ...draft, comment })}
      />
      <p className={HELP_CLASSES}>{informedLine(record)}</p>
      {otherProblem === null ? null : (
        <ErrorNotice>{otherProblem.text}</ErrorNotice>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          aria-disabled={busy || undefined}
          className={SMALL_PRIMARY_CLASSES}
        >
          {busy ? t.actions.busy : t.correct.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.actions.cancel}
        </button>
      </div>
    </form>
  );
}

/** The passage of an agent (09 RG8, RG9): what it does, the reason, the brand told; a closing is told irreversible. */
export function PassagePanel({
  passage,
  record,
  draft,
  problem,
  busy,
  onDraft,
  onSubmit,
  onCancel,
}: {
  passage: "pause" | "resume" | "close";
  record: CampaignRecordResponse;
  draft: PassageDraft;
  problem: Problem | null;
  busy: boolean;
  onDraft: (next: PassageDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const panel = usePanelFocus(onCancel);
  const words = t.passage[passage];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!busy) {
      onSubmit();
    }
  }

  return (
    <form
      ref={panel}
      noValidate
      aria-labelledby={titleId}
      onSubmit={submit}
      className={SECTION_CLASSES}
    >
      <h3 id={titleId} className={BLOCK_TITLE}>
        {words.title}
      </h3>
      <p className="text-sm text-text-primary">{words.lead}</p>
      <CampaignActReason
        reasonCode={draft.reasonCode}
        comment={draft.comment}
        problem={problem}
        onReason={(reasonCode) => onDraft({ ...draft, reasonCode })}
        onComment={(comment) => onDraft({ ...draft, comment })}
      />
      <p className={HELP_CLASSES}>{informedLine(record)}</p>
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          aria-disabled={busy || undefined}
          className={SMALL_PRIMARY_CLASSES}
        >
          {busy ? t.actions.busy : words.confirm}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={SMALL_SECONDARY_CLASSES}
        >
          {t.actions.cancel}
        </button>
      </div>
    </form>
  );
}
