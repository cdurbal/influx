import { isChoiceBlocked, toggleChoice } from "./choice-limits";
import {
  CHOICE_OPTION_COLUMN_CLASSES,
  CHOICE_OPTION_NOTE_CLASSES,
} from "./choice-group-classes";
import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
  MEMBER_FIELD_COUNTER_CLASSES,
} from "./field-classes";
import { describedByOf, useFieldIds } from "./field-ids";
import { Field } from "./Field";

/** One choice of the group: the code stored, its label, and what a screen may say of it. */
export type ChoiceGroupOption = {
  code: string;
  label: string;
  /** A sentence under the label (what the choice means), read with the choice. */
  help?: string;
  /** The choice cannot be taken now; `reason` then says why, in words, under its label. */
  disabled?: boolean;
  reason?: string;
};

type ChoiceGroupCommon = {
  /** Id of the first control: the screen focuses the first invalid field by it. */
  id?: string;
  /** The legend of the fieldset: what the group asks (the `label` of every field, written as its legend). */
  label: string;
  /** "required" / "obligatoire", written beside the legend; absent for an optional group. */
  requiredLabel?: string;
  /** Who sees this group, and the layer's text. */
  layer?: { layer: "public" | "revealed" | "internal"; label: string };
  help?: string;
  /** The message of the group in error; its controls carry `aria-invalid`. */
  error?: string | null;
  /** What the choices make the member check, never a refusal. */
  warnings?: readonly string[];
  options: readonly ChoiceGroupOption[];
  /** The contract of the backoffice twin (a box of 18 px); the member rendering is the regular one. */
  dense?: boolean;
  /** The group is invalid without a message of its own (the summary of the form tells it). */
  invalid?: boolean;
  disabled?: boolean;
  /** False when the layer is told elsewhere: the badge is not drawn. */
  layerShown?: boolean;
  /** A group that shows when another answer asks for it: it enters by `rise-in`. */
  conditional?: boolean;
  className?: string;
};

type CheckboxChoiceGroup = ChoiceGroupCommon & {
  type: "checkbox";
  value: readonly string[];
  /** The codes ticked after the gesture; the gesture does nothing else (U32). */
  onChange: (codes: string[]) => void;
  /** The cap of the list (06 RG15, RG27), also held by the database; a choice over it is refused, never replaced. */
  max?: number;
  /** The cap, said before any choice: "3 at most" (RG85: a limit is told, not discovered); it is the help. */
  limitText?: string;
  /** What the choice count reads, e.g. "2 of 3". */
  countText?: string;
  /** Said when the cap is reached, in a live region; the other boxes are then unavailable. */
  limitReachedText?: string;
};

type RadioChoiceGroup = ChoiceGroupCommon & {
  type: "radio";
  name: string;
  /** `null`: nothing ticked yet. */
  value: string | null;
  onChange: (code: string) => void;
};

export type ChoiceGroupProps = CheckboxChoiceGroup | RadioChoiceGroup;

/**
 * A group of native boxes or radios (C21): a `fieldset` with its `legend`, a row of 44 px per choice whose whole
 * label is the click zone, the legend and the help read with the group. A gesture only calls `onChange`: nothing
 * else happens on a change and nothing is unticked in silence (U32). At the cap of a list of boxes, the others are
 * marked `aria-disabled` (they stay in the tab order, so that the reason can be read) and the cap is said in a
 * live region.
 */
export function ChoiceGroup(props: ChoiceGroupProps) {
  const {
    id,
    options,
    invalid,
    disabled,
    layerShown,
    conditional,
    className,
    ...rest
  } = props;
  const ids = useFieldIds(id);
  const hasError = rest.error !== undefined && rest.error !== null;
  const isInvalid = hasError || invalid === true;
  const isBoxes = props.type === "checkbox";
  const cap =
    isBoxes && props.max !== undefined ? props.max : Number.POSITIVE_INFINITY;
  const chosen = isBoxes ? props.value : [];
  const atCap = isBoxes && props.max !== undefined && chosen.length >= cap;
  const helpText = isBoxes ? (props.limitText ?? rest.help) : rest.help;
  const countText = isBoxes ? props.countText : undefined;
  const countId = `${ids.control}-count`;
  const statusId = `${ids.control}-status`;
  const describedBy = describedByOf(
    rest.layer !== undefined && layerShown !== false && ids.layer,
    helpText !== undefined && ids.help,
    countText !== undefined && countId,
    atCap && statusId,
    (rest.warnings?.length ?? 0) > 0 && ids.warning,
    hasError && ids.error,
  );
  const row = (option: ChoiceGroupOption, index: number) => {
    const blocked =
      option.disabled === true ||
      (isBoxes && isChoiceBlocked(chosen, option.code, cap));
    const noteIds = {
      help: `${ids.control}-option-${index}-help`,
      reason: `${ids.control}-option-${index}-reason`,
    };
    const optionDescribedBy = describedByOf(
      option.help !== undefined && noteIds.help,
      option.reason !== undefined && noteIds.reason,
    );
    const label = (
      <label key={option.code} className={memberChoiceRowClasses(blocked)}>
        {props.type === "checkbox" ? (
          <input
            id={index === 0 ? ids.control : undefined}
            type="checkbox"
            value={option.code}
            checked={props.value.includes(option.code)}
            disabled={disabled === true || option.disabled === true}
            aria-disabled={
              !option.disabled && isChoiceBlocked(props.value, option.code, cap)
                ? true
                : undefined
            }
            aria-invalid={isInvalid ? true : undefined}
            aria-describedby={optionDescribedBy}
            onChange={() =>
              props.onChange(toggleChoice(props.value, option.code, cap))
            }
            className={memberChoiceInputClasses(blocked)}
          />
        ) : (
          <input
            id={index === 0 ? ids.control : undefined}
            type="radio"
            name={props.name}
            value={option.code}
            checked={props.value === option.code}
            disabled={disabled === true || option.disabled === true}
            aria-describedby={optionDescribedBy}
            onChange={() => props.onChange(option.code)}
            className={memberChoiceInputClasses(blocked)}
          />
        )}
        <span>{option.label}</span>
      </label>
    );
    if (option.help === undefined && option.reason === undefined) {
      return label;
    }
    return (
      <div key={option.code} className={CHOICE_OPTION_COLUMN_CLASSES}>
        {label}
        {option.help === undefined ? null : (
          <p id={noteIds.help} className={CHOICE_OPTION_NOTE_CLASSES}>
            {option.help}
          </p>
        )}
        {option.reason === undefined ? null : (
          <p id={noteIds.reason} className={CHOICE_OPTION_NOTE_CLASSES}>
            {option.reason}
          </p>
        )}
      </div>
    );
  };
  return (
    <Field
      label={rest.label}
      requiredLabel={rest.requiredLabel}
      layer={rest.layer}
      layerShown={layerShown}
      help={helpText}
      error={rest.error}
      warnings={rest.warnings}
      conditional={conditional}
      ids={ids}
      kind="group"
      describedBy={describedBy}
      radioGroup={props.type === "radio" ? { invalid: isInvalid } : undefined}
      className={className}
    >
      {options.map(row)}
      {countText === undefined ? null : (
        <p id={countId} className={MEMBER_FIELD_COUNTER_CLASSES}>
          {countText}
        </p>
      )}
      {isBoxes && props.max !== undefined ? (
        <p id={statusId} role="status" className={MEMBER_FIELD_COUNTER_CLASSES}>
          {atCap ? props.limitReachedText : null}
        </p>
      ) : null}
    </Field>
  );
}
