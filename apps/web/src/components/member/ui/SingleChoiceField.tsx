import { ChoiceGroup } from "./ChoiceGroup";
import type { ChoiceOption } from "./choice-option";
import { memberControlClasses } from "./field-classes";
import { describedByOf, fieldRefsOf, useFieldIds } from "./field-ids";
import { Field, type FieldLayout, type FieldTexts } from "./Field";
import {
  ariaAttributesOf,
  passThroughOf,
  withoutAria,
  type PassThroughProps,
} from "./pass-through";

export type SingleChoiceFieldProps = FieldTexts &
  FieldLayout & {
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
}: SingleChoiceFieldProps & PassThroughProps) {
  const ids = useFieldIds(id);
  const received = ariaAttributesOf(texts);
  const hasError = texts.error !== undefined && texts.error !== null;
  const refs = fieldRefsOf(texts, ids);
  const describedBy = describedByOf(
    refs.layer,
    refs.help,
    refs.suffix,
    refs.counter,
    refs.warning,
    refs.error,
    received["aria-describedby"],
  );
  if (display === "radios") {
    return (
      <ChoiceGroup
        {...passThroughOf(texts)}
        type="radio"
        id={id}
        name={name}
        options={options}
        value={value}
        onChange={onChange}
        label={texts.label}
        requiredLabel={texts.requiredLabel}
        layer={texts.layer}
        layerShown={texts.layerShown}
        help={texts.help}
        error={texts.error}
        warnings={texts.warnings}
        conditional={texts.conditional}
        disabled={disabled}
        className={className}
      />
    );
  }
  return (
    <Field
      {...withoutAria(texts)}
      ids={ids}
      kind="single"
      className={className}
    >
      <select
        {...received}
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
    </Field>
  );
}
