"use client";

// The editor of one registry source, administrators only (docs/mvp/06 RG52, RG101; D79 (12); 17b §3.11;
// jalons/l2e/registres.md; L2E-23): name, https page, the day the page was opened by hand and its gratuity
// read, and the activation. The change is shown first, the former value beside the new one, exactly what the
// register of the database will keep, and nothing is saved before the administrator confirms it. The country
// and the type are the source's own: they are not edited. No rule here: the database refuses a second active
// source for a country and a day in the future.
import type { VerificationRegistrySourceAdminRow } from "@influx/contracts/verification";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, inputClasses } from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import { saveRegistrySource } from "./backoffice-api";
import {
  BLOCK_TITLE,
  FIELD_CLASSES,
  SECTION_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_PRIMARY_CLASSES,
  SMALL_SECONDARY_CLASSES,
  TABLE_CLASSES,
  TD_CLASSES,
  TH_CLASSES,
} from "./bo-classes";
import { DenseTableRegion } from "./DenseTableRegion";
import { ErrorNotice } from "./ErrorNotice";
import {
  changeLines,
  describedByOf,
  draftOf,
  saveFailureText,
  sourceChangeCheck,
  sourceCountryWords,
  type ChangeLine,
  type SourceDraft,
  type SourceProblem,
  type SourceRow,
} from "./registry-sources-view";
import { useAction } from "./use-action";

const t = messages.registrySources;

export function RegistrySourceEditor({
  row,
  onSaved,
  onCancel,
}: {
  row: SourceRow;
  onSaved: (saved: VerificationRegistrySourceAdminRow) => void;
  onCancel: () => void;
}) {
  const ids = {
    title: useId(),
    name: useId(),
    nameError: useId(),
    url: useId(),
    urlHelp: useId(),
    urlError: useId(),
    checkedOn: useId(),
    checkedOnHelp: useId(),
    checkedOnError: useId(),
    active: useId(),
    activeHelp: useId(),
    review: useId(),
  };
  const action = useAction();
  const title = useRef<HTMLHeadingElement>(null);
  const reviewTitle = useRef<HTMLHeadingElement>(null);
  const reviewButton = useRef<HTMLButtonElement>(null);
  // set when the review panel gives way to the form again: the focus must land on something that exists,
  // the field in error (its id) or, with none, the button that reviews (null)
  const returning = useRef<{ id: string | null } | null>(null);
  const [draft, setDraft] = useState<SourceDraft>(() => draftOf(row));
  const [problem, setProblem] = useState<SourceProblem | null>(null);
  const [lines, setLines] = useState<ChangeLine[] | null>(null);
  const [unchanged, setUnchanged] = useState(false);

  // the editor takes the focus when it opens: the form is read from its title
  useEffect(() => {
    title.current?.focus();
  }, []);

  const fieldId = (field: SourceProblem["field"]) =>
    field === "name" ? ids.name : field === "url" ? ids.url : ids.checkedOn;

  // the review panel replaces the button that opened it: it is read from its title (WCAG 2.4.3)
  useEffect(() => {
    if (lines !== null) {
      reviewTitle.current?.focus();
    }
  }, [lines]);

  // back to the form: the first field in error, else the button that reviews (WCAG 2.4.3)
  useEffect(() => {
    const back = returning.current;
    if (lines !== null || back === null) {
      return;
    }
    returning.current = null;
    (back.id === null
      ? reviewButton.current
      : document.getElementById(back.id)
    )?.focus();
  }, [lines]);

  const set = (patch: Partial<SourceDraft>) => {
    setDraft({ ...draft, ...patch });
    // what is reviewed is no longer what is typed
    setLines(null);
    setUnchanged(false);
  };

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = sourceChangeCheck(draft);
    if (!checked.ok) {
      setProblem(checked.problem);
      setLines(null);
      document.getElementById(fieldId(checked.problem.field))?.focus();
      return;
    }
    setProblem(null);
    const changed = changeLines(row, checked.body);
    setUnchanged(changed.length === 0);
    setLines(changed.length === 0 ? null : changed);
  }

  function confirm() {
    const checked = sourceChangeCheck(draft);
    if (!checked.ok) {
      setProblem(checked.problem);
      returning.current = { id: fieldId(checked.problem.field) };
      setLines(null);
      return;
    }
    void action.run(
      () => saveRegistrySource(row.id, checked.body),
      (data) => onSaved(data.source),
      saveFailureText,
    );
  }

  const fieldProblem = (field: SourceProblem["field"]) =>
    problem?.field === field ? problem : null;
  const nameProblem = fieldProblem("name");
  const urlProblem = fieldProblem("url");
  const dayProblem = fieldProblem("checkedOn");

  return (
    <form
      noValidate
      aria-labelledby={ids.title}
      onSubmit={review}
      className={SECTION_CLASSES}
    >
      <h2
        id={ids.title}
        ref={title}
        tabIndex={-1}
        className="font-display text-title-section font-bold tracking-heading text-text-primary"
      >
        {t.editorTitle(row.name)}
      </h2>
      <p className={HELP_CLASSES}>
        {t.countryLine(sourceCountryWords(row), row.subdivisionCode)}
      </p>

      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.name} className={SMALL_LABEL_CLASSES}>
          {t.fields.name}
        </label>
        <input
          id={ids.name}
          type="text"
          value={draft.name}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={nameProblem !== null || undefined}
          aria-describedby={describedByOf(
            nameProblem === null ? null : ids.nameError,
          )}
          onChange={(event) => set({ name: event.target.value })}
          className={inputClasses(nameProblem !== null)}
        />
        {nameProblem === null ? null : (
          <ErrorNotice id={ids.nameError} announce={false}>
            {nameProblem.text}
          </ErrorNotice>
        )}
      </div>

      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.url} className={SMALL_LABEL_CLASSES}>
          {t.fields.url}
        </label>
        <input
          id={ids.url}
          type="text"
          inputMode="url"
          value={draft.url}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-describedby={describedByOf(
            ids.urlHelp,
            urlProblem === null ? null : ids.urlError,
          )}
          aria-invalid={urlProblem !== null || undefined}
          onChange={(event) => set({ url: event.target.value })}
          className={`${inputClasses(urlProblem !== null)} font-mono`}
        />
        <p id={ids.urlHelp} className={HELP_CLASSES}>
          {t.fields.urlHelp}
        </p>
        {urlProblem === null ? null : (
          <ErrorNotice id={ids.urlError} announce={false}>
            {urlProblem.text}
          </ErrorNotice>
        )}
      </div>

      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.checkedOn} className={SMALL_LABEL_CLASSES}>
          {t.fields.checkedOn}
        </label>
        <input
          id={ids.checkedOn}
          type="date"
          value={draft.checkedOn}
          aria-describedby={describedByOf(
            ids.checkedOnHelp,
            dayProblem === null ? null : ids.checkedOnError,
          )}
          aria-invalid={dayProblem !== null || undefined}
          onChange={(event) => set({ checkedOn: event.target.value })}
          className={inputClasses(dayProblem !== null)}
        />
        <p id={ids.checkedOnHelp} className={HELP_CLASSES}>
          {t.fields.checkedOnHelp}
        </p>
        {dayProblem === null ? null : (
          <ErrorNotice id={ids.checkedOnError} announce={false}>
            {dayProblem.text}
          </ErrorNotice>
        )}
      </div>

      <div className={FIELD_CLASSES}>
        <label
          htmlFor={ids.active}
          className="flex min-h-(--size-bo-control) items-center gap-2 text-sm font-semibold text-text-primary"
        >
          <input
            id={ids.active}
            type="checkbox"
            checked={draft.isActive}
            aria-describedby={ids.activeHelp}
            onChange={(event) => set({ isActive: event.target.checked })}
            className="size-(--size-checkbox)"
          />
          {t.fields.active}
        </label>
        <p id={ids.activeHelp} className={HELP_CLASSES}>
          {t.fields.activeHelp}
        </p>
      </div>

      {unchanged ? (
        <p role="status" className="text-sm font-semibold text-text-primary">
          {t.reviewNoChange}
        </p>
      ) : null}

      {lines === null ? (
        <div className="flex flex-wrap gap-3">
          <button
            ref={reviewButton}
            type="submit"
            className={SMALL_PRIMARY_CLASSES}
          >
            {t.review}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className={SMALL_SECONDARY_CLASSES}
          >
            {t.cancel}
          </button>
        </div>
      ) : (
        <section
          aria-labelledby={ids.review}
          className="flex flex-col gap-3 rounded-md border-(length:--border-width-thin) border-border-strong p-3"
        >
          <h3
            id={ids.review}
            ref={reviewTitle}
            tabIndex={-1}
            className={BLOCK_TITLE}
          >
            {t.reviewTitle}
          </h3>
          <p className={HELP_CLASSES}>{t.reviewLead}</p>
          <DenseTableRegion label={t.reviewTable}>
            <table className={TABLE_CLASSES}>
              <thead>
                <tr>
                  {(
                    [
                      t.reviewColumns.field,
                      t.reviewColumns.before,
                      t.reviewColumns.after,
                    ] as const
                  ).map((header) => (
                    <th key={header} scope="col" className={TH_CLASSES}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.key} data-change={line.key}>
                    <th scope="row" className={`${TD_CLASSES} text-left`}>
                      {line.field}
                    </th>
                    <td className={`${TD_CLASSES} break-all`}>{line.before}</td>
                    <td className={`${TD_CLASSES} break-all`}>{line.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DenseTableRegion>
          <ActionFeedback action={action} />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              aria-disabled={action.busy || undefined}
              onClick={() => {
                if (!action.busy) {
                  confirm();
                }
              }}
              className={SMALL_PRIMARY_CLASSES}
            >
              {action.busy ? t.busy : t.confirm}
            </button>
            <button
              type="button"
              onClick={() => {
                action.clear();
                returning.current = { id: null };
                setLines(null);
              }}
              className={SMALL_SECONDARY_CLASSES}
            >
              {t.back}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className={SMALL_SECONDARY_CLASSES}
            >
              {t.cancel}
            </button>
          </div>
        </section>
      )}
    </form>
  );
}
