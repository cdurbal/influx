import { memberTextAreaClasses } from "./field-classes";
import { describedByOf, fieldRefsOf, useFieldIds } from "./field-ids";
import { Field, type FieldLayout, type FieldTexts } from "./Field";
import { countCharacters, limitCharacters } from "./text-limits";
import {
  ariaAttributesOf,
  withoutAria,
  type PassThroughProps,
} from "./pass-through";

export type TextAreaFieldProps = FieldTexts &
  Omit<FieldLayout, "counter"> & {
    id?: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    /** In characters, as the API counts them; what exceeds is refused, a paste included. */
    maxLength: number;
    /** The counter written, e.g. "423 / 1,000 characters"; read with the field, not at each key. */
    counterText: (count: number, max: number) => string;
    rows?: number;
    disabled?: boolean;
    className?: string;
  };

/** A text area with its counter: the limit is told (counter and `aria-describedby`), never hit blind. */
export function TextAreaField({
  id,
  name,
  value,
  onChange,
  maxLength,
  counterText,
  rows = 6,
  disabled,
  className,
  ...texts
}: TextAreaFieldProps & PassThroughProps) {
  const ids = useFieldIds(id);
  const received = ariaAttributesOf(texts);
  const hasError = texts.error !== undefined && texts.error !== null;
  const count = countCharacters(value);
  const counter = {
    value: count,
    max: maxLength,
    text: counterText(count, maxLength),
  };
  const refs = fieldRefsOf({ ...texts, counter }, ids);
  const describedBy = describedByOf(
    refs.layer,
    refs.help,
    refs.suffix,
    refs.counter,
    refs.warning,
    refs.error,
    received["aria-describedby"],
  );
  return (
    <Field
      {...withoutAria(texts)}
      counter={counter}
      ids={ids}
      kind="single"
      className={className}
    >
      <textarea
        {...received}
        id={ids.control}
        name={name}
        value={value}
        rows={rows}
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) =>
          onChange(limitCharacters(event.target.value, maxLength))
        }
        className={memberTextAreaClasses(hasError)}
      />
    </Field>
  );
}
