import { cn } from "@/components/ui/class-names";
import { memberControlClasses } from "./field-classes";
import { describedByOf, fieldRefsOf, useFieldIds } from "./field-ids";
import { Field, type FieldLayout, type FieldTexts } from "./Field";

type TextFieldProps = FieldTexts &
  FieldLayout & {
    id?: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    /** In characters, as the API counts them; what exceeds is refused, a paste included. */
    maxLength: number;
    /**
     * The keyboard of the value: a name, an address, a number (phone), a web address; "date" the
     * browser's own picker of a civil date, written YYYY-MM-DD whatever the language (the calendar of
     * a campaign, 09 RG69).
     */
    type?: "text" | "email" | "tel" | "url" | "date";
    /** The virtual keyboard of a typed number ("numeric": a count, "decimal": with decimals). */
    inputMode?: "numeric" | "decimal";
    placeholder?: string;
    autoComplete?: string;
    disabled?: boolean;
    className?: string;
    /** The id of a text that tells which one this is (a card title), read before the layer and the help. */
    describedBy?: string;
  };

/** One line of text with its label, layer, help and error (06 RG85); the value is cut at `maxLength`. */
export function TextField({
  id,
  name,
  value,
  onChange,
  maxLength,
  type = "text",
  inputMode,
  placeholder,
  autoComplete = "off",
  disabled,
  className,
  describedBy: extraDescribedBy,
  ...texts
}: TextFieldProps) {
  const ids = useFieldIds(id);
  const hasError = texts.error !== undefined && texts.error !== null;
  const refs = fieldRefsOf(texts, ids);
  const describedBy = describedByOf(
    extraDescribedBy,
    refs.layer,
    refs.help,
    refs.suffix,
    refs.counter,
    refs.warning,
    refs.error,
  );
  return (
    <Field {...texts} ids={ids} kind="single" className={className}>
      <input
        id={ids.control}
        name={name}
        type={type}
        inputMode={inputMode}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          memberControlClasses(hasError),
          // the native picker of a date follows the dark theme (its icon would be dark on dark)
          type === "date" && "scheme-dark",
        )}
      />
    </Field>
  );
}
