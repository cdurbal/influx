import { isChoiceBlocked, toggleChoice } from "./choice-limits";
import type { ChoiceOption } from "./choice-option";
import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
  MEMBER_FIELD_COUNTER_CLASSES,
} from "./field-classes";
import { describedByOf, useFieldIds } from "./field-ids";
import { FieldFrame, type FieldTexts } from "./FieldFrame";

type MultiChoiceFieldProps = Omit<FieldTexts, "help"> & {
  /** Id of the first box: the screen focuses the first invalid field by it. */
  id?: string;
  options: readonly ChoiceOption[];
  value: readonly string[];
  onChange: (codes: string[]) => void;
  /** The cap of the list (06 RG15, RG27), also held by the database. */
  max: number;
  /** The cap, said before any choice: "3 at most" (RG85: a limit is told, not discovered). */
  limitText: string;
  /** What the choice count reads, e.g. "2 of 3". */
  countText: string;
  /** Said when the cap is reached, in a live region; the other boxes are then unavailable. */
  limitReachedText: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Several choices among a closed list, capped. The cap is written under the label and the count
 * after the boxes; once reached, the other boxes are marked `aria-disabled` (they stay in the tab
 * order, so that the reason can be read) and a choice over the cap is refused, never replaced.
 */
export function MultiChoiceField({
  id,
  options,
  value,
  onChange,
  max,
  limitText,
  countText,
  limitReachedText,
  disabled,
  className,
  ...texts
}: MultiChoiceFieldProps) {
  const ids = useFieldIds(id);
  const countId = `${ids.control}-count`;
  const statusId = `${ids.control}-status`;
  const hasError = texts.error !== undefined && texts.error !== null;
  const atCap = value.length >= max;
  const describedBy = describedByOf(
    texts.layer && ids.layer,
    ids.help,
    countId,
    atCap && statusId,
    hasError && ids.error,
  );
  return (
    <FieldFrame
      {...texts}
      help={limitText}
      ids={ids}
      kind="group"
      describedBy={describedBy}
      className={className}
    >
      {options.map((option, index) => {
        const blocked = isChoiceBlocked(value, option.code, max);
        return (
          <label key={option.code} className={memberChoiceRowClasses(blocked)}>
            <input
              id={index === 0 ? ids.control : undefined}
              type="checkbox"
              value={option.code}
              checked={value.includes(option.code)}
              disabled={disabled}
              aria-disabled={blocked ? true : undefined}
              aria-invalid={hasError ? true : undefined}
              onChange={() => onChange(toggleChoice(value, option.code, max))}
              className={memberChoiceInputClasses(blocked)}
            />
            <span>{option.label}</span>
          </label>
        );
      })}
      <p id={countId} className={MEMBER_FIELD_COUNTER_CLASSES}>
        {countText}
      </p>
      <p id={statusId} role="status" className={MEMBER_FIELD_COUNTER_CLASSES}>
        {atCap ? limitReachedText : null}
      </p>
    </FieldFrame>
  );
}
