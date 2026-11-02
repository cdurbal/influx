import {
  MEMBER_FIELD_COUNTER_CLASSES,
  memberTextAreaClasses,
} from "./field-classes";
import { describedByOf, useFieldIds } from "./field-ids";
import { FieldFrame, type FieldTexts } from "./FieldFrame";
import { countCharacters, limitCharacters } from "./text-limits";

type TextAreaFieldProps = FieldTexts & {
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
}: TextAreaFieldProps) {
  const ids = useFieldIds(id);
  const counterId = `${ids.control}-counter`;
  const hasError = texts.error !== undefined && texts.error !== null;
  const describedBy = describedByOf(
    texts.layer && ids.layer,
    texts.help && ids.help,
    counterId,
    hasError && ids.error,
  );
  return (
    <FieldFrame {...texts} ids={ids} kind="single" className={className}>
      <textarea
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
      <p id={counterId} className={MEMBER_FIELD_COUNTER_CLASSES}>
        {counterText(countCharacters(value), maxLength)}
      </p>
    </FieldFrame>
  );
}
