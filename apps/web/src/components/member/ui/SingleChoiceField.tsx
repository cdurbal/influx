import type { ChoiceOption } from "./choice-option";
import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
  memberControlClasses,
} from "./field-classes";
import { describedByOf, useFieldIds } from "./field-ids";
import { FieldFrame, type FieldTexts } from "./FieldFrame";

type SingleChoiceFieldProps = FieldTexts & {
  /** Id of the control (of the first radio): the screen focuses the first invalid field by it. */
  id?: string;
  name: string;
  options: readonly ChoiceOption[];
  value: string | null;
  onChange: (code: string) => void;
  /** "select" for a long list (sectors), "radios" for a short one (sizes), all in view. */
  display?: "select" | "radios";
  /** The first, empty option of a select: "Choose…". */
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/** One choice among a closed list (06 RG15): a native select or native radios, keyboard as the browser gives it. */
export function SingleChoiceField({
  id,
  name,
  options,
  value,
  onChange,
  display = "select",
  placeholder,
  disabled,
  className,
  ...texts
}: SingleChoiceFieldProps) {
  const ids = useFieldIds(id);
  const hasError = texts.error !== undefined && texts.error !== null;
  const describedBy = describedByOf(
    texts.layer && ids.layer,
    texts.help && ids.help,
    hasError && ids.error,
  );
  if (display === "radios") {
    return (
      <FieldFrame
        {...texts}
        ids={ids}
        kind="group"
        describedBy={describedBy}
        radioGroup={{ invalid: hasError }}
        className={className}
      >
        {options.map((option, index) => (
          <label key={option.code} className={memberChoiceRowClasses()}>
            <input
              id={index === 0 ? ids.control : undefined}
              type="radio"
              name={name}
              value={option.code}
              checked={value === option.code}
              disabled={disabled}
              onChange={() => onChange(option.code)}
              className={memberChoiceInputClasses()}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </FieldFrame>
    );
  }
  return (
    <FieldFrame {...texts} ids={ids} kind="single" className={className}>
      <select
        id={ids.control}
        name={name}
        value={value ?? ""}
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={memberControlClasses(hasError)}
      >
        {value === null && placeholder !== undefined ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}
