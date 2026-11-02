import {
  memberChoiceInputClasses,
  memberChoiceRowClasses,
} from "./field-classes";
import { describedByOf, useFieldIds } from "./field-ids";
import { FieldFrame, type FieldTexts } from "./FieldFrame";

type YesNoFieldProps = FieldTexts & {
  /** Id of the "yes" radio: the screen focuses the first invalid field by it. */
  id?: string;
  name: string;
  /** `null`: not answered yet. */
  value: boolean | null;
  onChange: (answer: boolean) => void;
  yesLabel: string;
  noLabel: string;
  disabled?: boolean;
  className?: string;
};

/** A yes/no question: two native radios, the answer written in both. */
export function YesNoField({
  id,
  name,
  value,
  onChange,
  yesLabel,
  noLabel,
  disabled,
  className,
  ...texts
}: YesNoFieldProps) {
  const ids = useFieldIds(id);
  const hasError = texts.error !== undefined && texts.error !== null;
  const describedBy = describedByOf(
    texts.layer && ids.layer,
    texts.help && ids.help,
    hasError && ids.error,
  );
  const answers = [
    { answer: true, label: yesLabel, controlId: ids.control },
    { answer: false, label: noLabel, controlId: undefined },
  ] as const;
  return (
    <FieldFrame
      {...texts}
      ids={ids}
      kind="group"
      describedBy={describedBy}
      radioGroup={{ invalid: hasError }}
      className={className}
    >
      {answers.map(({ answer, label, controlId }) => (
        <label key={String(answer)} className={memberChoiceRowClasses()}>
          <input
            id={controlId}
            type="radio"
            name={name}
            checked={value === answer}
            disabled={disabled}
            onChange={() => onChange(answer)}
            className={memberChoiceInputClasses()}
          />
          <span>{label}</span>
        </label>
      ))}
    </FieldFrame>
  );
}
