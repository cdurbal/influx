"use client";

import { useState } from "react";
import { dateOrderOf, formatDateIso, readDateText } from "./date-field-format";
import { dateFieldControlClasses } from "./date-field-classes";
import { Field } from "./Field";
import { describedByOf, fieldRefsOf, useFieldIds } from "./field-ids";

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
}: DateFieldProps) {
  const ids = useFieldIds(id);
  const order = dateOrderOf(locale);
  // What was typed, while the field holds a text of its own; `null` when it shows the value.
  const [draft, setDraft] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<"format" | "range" | null>(null);
  // A value that the screen changes under the typed text (a reset, a load) takes the field back; read while
  // rendering, as the counter of C16 reads its change, so that no frame shows the stale text.
  if (draft !== null) {
    const reading = readDateText(draft, order, min, max);
    if ((reading.kind === "valid" ? reading.iso : null) !== value) {
      setDraft(null);
      setRefusal(null);
    }
  }
  const shown = draft ?? (value === null ? "" : formatDateIso(value, order));
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
  );
  return (
    <Field {...fieldTexts} ids={ids} kind="single" className={className}>
      <input
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
          const reading = readDateText(text, order, min, max);
          setDraft(text);
          setRefusal(null);
          onChange(reading.kind === "valid" ? reading.iso : null);
        }}
        onBlur={() => {
          if (draft === null) {
            return;
          }
          const reading = readDateText(draft, order, min, max);
          if (reading.kind === "valid") {
            setDraft(null);
          } else if (reading.kind === "empty") {
            setDraft(null);
          } else {
            setRefusal(reading.kind);
          }
        }}
        className={dateFieldControlClasses(error !== null)}
      />
    </Field>
  );
}
