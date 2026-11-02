import { memberControlClasses } from "./field-classes";
import { describedByOf, useFieldIds } from "./field-ids";
import { FieldFrame, type FieldTexts } from "./FieldFrame";

type TextFieldProps = FieldTexts & {
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** In characters, as the API counts them; what exceeds is refused, a paste included. */
  maxLength: number;
  /** The keyboard of the value: a name, an address, a number (phone), a web address. */
  type?: "text" | "email" | "tel" | "url";
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  className?: string;
};

/** One line of text with its label, layer, help and error (06 RG85); the value is cut at `maxLength`. */
export function TextField({
  id,
  name,
  value,
  onChange,
  maxLength,
  type = "text",
  placeholder,
  autoComplete = "off",
  disabled,
  className,
  ...texts
}: TextFieldProps) {
  const ids = useFieldIds(id);
  const hasError = texts.error !== undefined && texts.error !== null;
  const describedBy = describedByOf(
    texts.layer && ids.layer,
    texts.help && ids.help,
    hasError && ids.error,
  );
  return (
    <FieldFrame {...texts} ids={ids} kind="single" className={className}>
      <input
        id={ids.control}
        name={name}
        type={type}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={memberControlClasses(hasError)}
      />
    </FieldFrame>
  );
}
