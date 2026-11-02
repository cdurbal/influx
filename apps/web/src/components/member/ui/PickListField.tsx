import { CloseIcon } from "@/components/ui/icons";
import { toggleChoice } from "./choice-limits";
import type { ChoiceOption } from "./choice-option";
import {
  MEMBER_FIELD_COUNTER_CLASSES,
  memberControlClasses,
} from "./field-classes";
import { describedByOf, useFieldIds } from "./field-ids";
import { FieldFrame, type FieldTexts } from "./FieldFrame";
import { memberButtonClasses } from "./button-classes";

type PickListFieldProps = Omit<FieldTexts, "help"> & {
  /** Id of the select: the screen focuses the first invalid field by it. */
  id?: string;
  name: string;
  /** The long list (countries, 249): every option, in the language of the page. */
  options: readonly ChoiceOption[];
  value: readonly string[];
  onChange: (codes: string[]) => void;
  /** The cap of the list (06 RG15, RG27: 5 markets, 5 countries), also held by the database. */
  max: number;
  /** The cap, said before any choice. */
  limitText: string;
  countText: string;
  limitReachedText: string;
  /** The first option of the select: "Add a country…". */
  addLabel: string;
  /** The name of the chosen list for a screen reader: "Chosen countries". */
  listLabel: string;
  /** The accessible name of the button that removes one choice: "Remove France". */
  removeLabel: (label: string) => string;
  disabled?: boolean;
  className?: string;
};

/**
 * A capped choice among a list too long for boxes: a select adds, a chip with a button removes. The
 * select keeps the focus after a choice (the keyboard adds again), a choice over the cap is refused,
 * never replaced, and the cap is told before and after (RG85).
 */
export function PickListField({
  id,
  name,
  options,
  value,
  onChange,
  max,
  limitText,
  countText,
  limitReachedText,
  addLabel,
  listLabel,
  removeLabel,
  disabled,
  className,
  ...texts
}: PickListFieldProps) {
  const ids = useFieldIds(id);
  const countId = `${ids.control}-count`;
  const statusId = `${ids.control}-status`;
  const hasError = texts.error !== undefined && texts.error !== null;
  const atCap = value.length >= max;
  const labelOf = new Map(options.map((option) => [option.code, option.label]));
  const describedBy = describedByOf(
    texts.layer && ids.layer,
    ids.help,
    countId,
    atCap && statusId,
    hasError && ids.error,
  );
  // At the cap nothing more is offered: the status below says why.
  const available = atCap
    ? []
    : options.filter((option) => !value.includes(option.code));
  return (
    <FieldFrame
      {...texts}
      help={limitText}
      ids={ids}
      kind="single"
      className={className}
    >
      <select
        id={ids.control}
        name={name}
        value=""
        disabled={disabled}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          if (event.target.value !== "") {
            onChange(toggleChoice(value, event.target.value, max));
          }
        }}
        className={memberControlClasses(hasError)}
      >
        <option value="">{addLabel}</option>
        {available.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      {value.length === 0 ? null : (
        <ul aria-label={listLabel} className="flex flex-wrap gap-2">
          {value.map((code) => {
            const label = labelOf.get(code) ?? code;
            return (
              <li
                key={code}
                className="inline-flex items-center gap-1 rounded-pill border-(length:--border-width-thin) border-border-strong bg-surface-raised pl-3 text-sm text-text-primary"
              >
                {label}
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={removeLabel(label)}
                  onClick={() =>
                    onChange(value.filter((chosen) => chosen !== code))
                  }
                  className={memberButtonClasses("text", "md")}
                >
                  <CloseIcon
                    aria-hidden="true"
                    className="size-(--size-icon-sm)"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p id={countId} className={MEMBER_FIELD_COUNTER_CLASSES}>
        {countText}
      </p>
      <p id={statusId} role="status" className={MEMBER_FIELD_COUNTER_CLASSES}>
        {atCap ? limitReachedText : null}
      </p>
    </FieldFrame>
  );
}
