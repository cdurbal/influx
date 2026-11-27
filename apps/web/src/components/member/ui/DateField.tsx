"use client";

import { useEffect, useRef, useState } from "react";
import {
  dateOrderOf,
  dateRefusalOf,
  dateValueOf,
  formatDateIso,
  isDraftTakenBack,
  readDateText,
} from "./date-field-format";
import { dateFieldControlClasses } from "./date-field-classes";
import { Field } from "./Field";
import { describedByOf, fieldRefsOf, useFieldIds } from "./field-ids";
import {
  ariaAttributesOf,
  dataAttributesOf,
  type PassThroughProps,
} from "./pass-through";

export type DateFieldProps = {
  /** The id of the control: the screen focuses the first invalid field by it. */
  id?: string;
  name: string;
  /** The visible label, above the control. */
  label: string;
  /** "required" / "obligatoire", written beside the label; absent for an optional field. */
  requiredLabel?: string;
  /** Who sees this field, and the layer's text. */
  layer?: { layer: "public" | "revealed" | "internal"; label: string };
  /** The model and an example, in the words of the language ("dd/mm/yyyy, for example 15/01/2027"), never in the module. */
  help?: string;
  /** A message of the screen about the date (a required date, a refused save); the refusal of the format comes first. */
  error?: string | null;
  warnings?: readonly string[];
  /** The ISO civil date (`2027-01-15`), or nothing. */
  value: string | null;
  /** Called at each key with the ISO civil date the text makes, or `null` while it makes none. */
  onChange: (value: string | null) => void;
  /** The language of the page: it sets the order of the parts. */
  locale: string;
  /** The bounds, ISO civil dates, inclusive: the business of the screen, held again by the API. */
  min?: string;
  max?: string;
  /** Said when the text is no date: "Write the date as dd/mm/yyyy." */
  formatError: string;
  /** Said when the date is outside its bounds; the message of the format when absent. */
  rangeError?: string;
  /** What the order of this date and the other one makes the member check, under the later one, naming both (CA03). */
  orderNote?: string;
  /** An order that is not saved is an `error`; `warning` only for an order that is saved and to check. */
  orderKind?: "error" | "warning";
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * A civil date as a text field of 12 rem (C47): the order of the parts follows the language, the separators `/`,
 * `.` and `-` are accepted and so are eight digits, the text is written back in the order of the language when the
 * field is left and never while it is typed. What goes out is an ISO date or `null`; a text that is no date, or a
 * date out of its bounds, is refused in words under the field (C19, tied by `aria-describedby`). No native picker.
 */
export function DateField({
  id,
  name,
  value,
  onChange,
  locale,
  min,
  max,
  formatError,
  rangeError,
  orderNote,
  orderKind = "error",
  placeholder,
  disabled,
  className,
  ...texts
}: DateFieldProps & PassThroughProps) {
  const ids = useFieldIds(id);
  const received = ariaAttributesOf(texts);
  const order = dateOrderOf(locale);
  // What was typed, while the field holds a text of its own, and whether the field was left since; `null` when it
  // shows the value.
  const [draft, setDraft] = useState<{ text: string; left: boolean } | null>(
    null,
  );
  // Read against the bounds of this rendering, so that the refusal follows a bound that moves.
  const reading =
    draft === null ? null : readDateText(draft.text, order, min, max);
  // A value that the screen changes under the typed text takes the field back; read while rendering, as the counter
  // of C16 reads its change, so that no frame shows the stale text.
  const [previousValue, setPreviousValue] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    if (reading !== null && isDraftTakenBack(previousValue, value, reading)) {
      setDraft(null);
    }
  }
  // A bound that moves changes what the typed text makes: the screen is told, so that it holds what the field shows.
  const bounds = useRef({ min, max });
  useEffect(() => {
    if (bounds.current.min === min && bounds.current.max === max) {
      return;
    }
    bounds.current = { min, max };
    if (draft !== null) {
      onChange(dateValueOf(readDateText(draft.text, order, min, max)));
    }
  }, [min, max, draft, order, onChange]);
  const shown =
    draft?.text ?? (value === null ? "" : formatDateIso(value, order));
  const refusal =
    reading === null ? null : dateRefusalOf(reading, draft?.left === true);
  const refused =
    refusal === "format"
      ? formatError
      : refusal === "range"
        ? (rangeError ?? formatError)
        : null;
  const orderMessage = orderNote === undefined ? null : orderNote;
  const error =
    refused ??
    (texts.error === undefined || texts.error === null ? null : texts.error) ??
    (orderKind === "error" ? orderMessage : null);
  const warnings = [
    ...(texts.warnings ?? []),
    ...(orderKind === "warning" && orderMessage !== null ? [orderMessage] : []),
  ];
  const fieldTexts = {
    label: texts.label,
    requiredLabel: texts.requiredLabel,
    layer: texts.layer,
    help: texts.help,
    error,
    warnings,
  };
  const refs = fieldRefsOf(fieldTexts, ids);
  const describedBy = describedByOf(
    refs.layer,
    refs.help,
    refs.warning,
    refs.error,
    received["aria-describedby"],
  );
  return (
    <Field
      {...dataAttributesOf(texts)}
      {...fieldTexts}
      ids={ids}
      kind="single"
      className={className}
    >
      <input
        {...received}
        id={ids.control}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={10}
        placeholder={placeholder}
        value={shown}
        disabled={disabled}
        aria-invalid={error === null ? undefined : true}
        aria-describedby={describedBy}
        onChange={(event) => {
          const text = event.target.value;
          setDraft({ text, left: false });
          onChange(dateValueOf(readDateText(text, order, min, max)));
        }}
        onBlur={() => {
          if (draft === null || reading === null) {
            return;
          }
          const refusedOnLeave = dateRefusalOf(reading, true) !== null;
          setDraft(refusedOnLeave ? { ...draft, left: true } : null);
        }}
        className={dateFieldControlClasses(error !== null)}
      />
    </Field>
  );
}
