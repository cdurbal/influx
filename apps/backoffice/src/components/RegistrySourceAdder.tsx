"use client";

// The addition of a registry source, administrators only (docs/mvp/06 RG52, RG101; D79 (12); 17b §3.11;
// jalons/l2f/21.md; 0229): the register of a country that has none yet, or of one of its States (L2E-US),
// beside the register of the country. Country, State (optional), name, https page, the day the page was
// opened by hand and its gratuity read, and the activation. The value to be journaled is shown first and
// nothing is saved before the administrator confirms it. The type is always « national »: it is not chosen.
// No rule here: the database refuses an unknown country or State, a State of another country, a day in the
// future and a second active source for the country and State.
import type { VerificationRegistrySourceAdminRow } from "@influx/contracts/verification";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, inputClasses } from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import { addRegistrySource } from "./backoffice-api";
import {
  BLOCK_TITLE,
  FIELD_CLASSES,
  SECTION_CLASSES,
  SELECT_CLASSES,
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
  addedWhere,
  addFailureText,
  addLines,
  describedByOf,
  EMPTY_NEW_SOURCE,
  newSourceCheck,
  type AddLine,
  type NewSourceDraft,
  type NewSourceFieldName,
  type NewSourceProblem,
} from "./registry-sources-view";
import { useAction } from "./use-action";
import { countryOptions } from "./view-model";

const t = messages.registrySources;

export function RegistrySourceAdder({
  onAdded,
  onCancel,
}: {
  onAdded: (source: VerificationRegistrySourceAdminRow, where: string) => void;
  onCancel: () => void;
}) {
  const ids = {
    title: useId(),
    country: useId(),
    countryError: useId(),
    subdivision: useId(),
    subdivisionHelp: useId(),
    subdivisionError: useId(),
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
  const countries = useMemo(() => countryOptions(), []);
  const [draft, setDraft] = useState<NewSourceDraft>(EMPTY_NEW_SOURCE);
  const [problem, setProblem] = useState<NewSourceProblem | null>(null);
  const [lines, setLines] = useState<AddLine[] | null>(null);

  // the form takes the focus when it opens: it is read from its title
  useEffect(() => {
    title.current?.focus();
  }, []);

  const fieldId: Record<NewSourceFieldName, string> = {
    countryCode: ids.country,
    subdivisionCode: ids.subdivision,
    name: ids.name,
    url: ids.url,
    checkedOn: ids.checkedOn,
  };

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

  const set = (patch: Partial<NewSourceDraft>) => {
    setDraft({ ...draft, ...patch });
    // what is reviewed is no longer what is typed
    setLines(null);
  };

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = newSourceCheck(draft);
    if (!checked.ok) {
      setProblem(checked.problem);
      setLines(null);
      document.getElementById(fieldId[checked.problem.field])?.focus();
      return;
    }
    setProblem(null);
    setLines(addLines(checked.body));
  }

  function confirm() {
    const checked = newSourceCheck(draft);
    if (!checked.ok) {
      setProblem(checked.problem);
      returning.current = { id: fieldId[checked.problem.field] };
      setLines(null);
      return;
    }
    void action.run(
      () => addRegistrySource(checked.body),
      (data) => onAdded(data.source, addedWhere(checked.body)),
      addFailureText,
    );
  }

  const fieldProblem = (field: NewSourceFieldName) =>
    problem?.field === field ? problem : null;
  const countryProblem = fieldProblem("countryCode");
  const subdivisionProblem = fieldProblem("subdivisionCode");
  const nameProblem = fieldProblem("name");
  const urlProblem = fieldProblem("url");
  const dayProblem = fieldProblem("checkedOn");

  return (
    <form
      noValidate
      aria-labelledby={ids.title}
      onSubmit={review}
      data-add-source
      className={SECTION_CLASSES}
    >
      <h2
        id={ids.title}
        ref={title}
        tabIndex={-1}
        className="font-display text-title-section font-bold tracking-heading text-text-primary"
      >
        {t.add.title}
      </h2>
      <p className={HELP_CLASSES}>{t.add.lead}</p>

      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.country} className={SMALL_LABEL_CLASSES}>
          {t.add.country}
        </label>
        <select
          id={ids.country}
          value={draft.countryCode}
          aria-invalid={countryProblem !== null || undefined}
          aria-describedby={describedByOf(
            countryProblem === null ? null : ids.countryError,
          )}
          onChange={(event) => set({ countryCode: event.target.value })}
          className={`${SELECT_CLASSES} self-start`}
        >
          <option value="">{t.add.countryPlaceholder}</option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
        {countryProblem === null ? null : (
          <ErrorNotice id={ids.countryError} announce={false}>
            {countryProblem.text}
          </ErrorNotice>
        )}
      </div>

      <div className={FIELD_CLASSES}>
        <label htmlFor={ids.subdivision} className={SMALL_LABEL_CLASSES}>
          {t.add.subdivision}
        </label>
        <input
          id={ids.subdivision}
          type="text"
          value={draft.subdivisionCode}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={describedByOf(
            ids.subdivisionHelp,
            subdivisionProblem === null ? null : ids.subdivisionError,
          )}
          aria-invalid={subdivisionProblem !== null || undefined}
          onChange={(event) => set({ subdivisionCode: event.target.value })}
          className={`${inputClasses(subdivisionProblem !== null)} font-mono`}
        />
        <p id={ids.subdivisionHelp} className={HELP_CLASSES}>
          {t.add.subdivisionHelp}
        </p>
        {subdivisionProblem === null ? null : (
          <ErrorNotice id={ids.subdivisionError} announce={false}>
            {subdivisionProblem.text}
          </ErrorNotice>
        )}
      </div>

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

      {lines === null ? (
        <div className="flex flex-wrap gap-3">
          <button
            ref={reviewButton}
            type="submit"
            className={SMALL_PRIMARY_CLASSES}
          >
            {t.add.review}
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
            {t.add.reviewTitle}
          </h3>
          <p className={HELP_CLASSES}>{t.add.reviewLead}</p>
          <DenseTableRegion label={t.add.reviewTable}>
            <table className={TABLE_CLASSES}>
              <thead>
                <tr>
                  {(
                    [
                      t.add.reviewColumns.field,
                      t.add.reviewColumns.value,
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
                  <tr key={line.key} data-add-line={line.key}>
                    <th scope="row" className={`${TD_CLASSES} text-left`}>
                      {line.field}
                    </th>
                    <td className={`${TD_CLASSES} break-all`}>{line.value}</td>
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
              {action.busy ? t.busy : t.add.confirm}
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
