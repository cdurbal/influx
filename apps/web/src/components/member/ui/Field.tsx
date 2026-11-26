import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  fieldClasses,
  fieldGridClasses,
  fieldWidthClasses,
  MEMBER_FIELD_CONTROL_ROW_CLASSES,
  MEMBER_FIELD_COUNTER_CLASSES,
  MEMBER_FIELD_ENTERING_CLASSES,
  MEMBER_FIELD_HEADER_CLASSES,
  MEMBER_FIELD_HELP_CLASSES,
  MEMBER_FIELD_LABEL_CLASSES,
  MEMBER_FIELD_REQUIRED_CLASSES,
  MEMBER_FIELD_SUFFIX_CLASSES,
  type FieldGridColumns,
  type FieldSize,
  type FieldWidth,
} from "./field-classes";
import { FieldMessage } from "./FieldMessage";
import { LayerBadge } from "./LayerBadge";
import type { ProfileLayer } from "./layer-badge-classes";

/** What every field of the profile form says about itself (06 RG85). */
export type FieldTexts = {
  /** The visible label, above the control. */
  label: string;
  /** "required" / "obligatoire", written beside the label; absent for an optional field. */
  requiredLabel?: string;
  /** Who sees this field, and the layer's text (`brandProfile.layer.*`). */
  layer?: { layer: ProfileLayer; label: string };
  help?: string;
  /** The message of the field in error; the control carries `aria-invalid`. */
  error?: string | null;
  /**
   * What the text of the field makes the member check, never a refusal (09 RG21 to RG23): one
   * message per signal, under the control, in a warning message; the control stays valid. A warning
   * carries its own « To check: » when it has one.
   */
  warnings?: readonly string[];
};

/** How a field is laid out: its size, the width of its control, its unit, its counter, its layer, its entering. */
export type FieldLayout = {
  /** `md` by default; `bo` and `dense` are the contract of the backoffice twin (rendered by RUC). */
  size?: FieldSize;
  /** The width of the control, not of the label: the full line when absent, `number` for 128 px, `xs` to `xl` by line. */
  width?: FieldWidth;
  /** The unit written after the control ("days", "%"), read with the field. */
  suffix?: string;
  /** The count under the control; `text` is the count as it is written ("423 / 1,000 characters"). */
  counter?: { value: number; max: number; text?: string };
  /** False when the layer is told elsewhere (a badge per step): the badge is not drawn. */
  layerShown?: boolean;
  /** A field that shows when another answer asks for it: it enters by `rise-in` (R04 line 21). */
  conditional?: boolean;
};

/** The ids the frame writes and the control points to by `aria-describedby`. */
export type FieldIds = {
  /** The id of the control (of the first one for a group): the screen focuses it by this id. */
  control: string;
  layer: string;
  help: string;
  error: string;
  warning: string;
  counter: string;
  suffix: string;
};

export type FieldProps = FieldTexts &
  FieldLayout & {
    ids: FieldIds;
    /** One control and its `<label>`, or several (radios, boxes) in a `<fieldset>` with its `<legend>`. */
    kind: "single" | "group";
    /** Only for a group: the ids that describe the whole group. */
    describedBy?: string;
    /** Only for a group of radios: it is a `radiogroup`, which can be marked invalid as a whole. */
    radioGroup?: { invalid: boolean };
    children?: ReactNode;
    className?: string;
  };

/**
 * The shell of a field of the connected spaces (C18, 20 §11.8): label, requirement written, layer badge,
 * help, the control(s), the count, then the messages of C19 (a warning, an error). The layer badge and the
 * help describe the control (`aria-describedby`) rather than being part of its name.
 */
export function Field({
  ids,
  kind,
  describedBy,
  radioGroup,
  label,
  requiredLabel,
  layer,
  help,
  error,
  warnings,
  size,
  width,
  suffix,
  counter,
  layerShown = true,
  conditional = false,
  children,
  className,
}: FieldProps) {
  const requiredText = ` (${requiredLabel ?? ""})`;
  const labelText = (
    <>
      {label}
      {requiredLabel === undefined ? null : (
        <span className={MEMBER_FIELD_REQUIRED_CLASSES}>{requiredText}</span>
      )}
    </>
  );
  const badge =
    layer === undefined || !layerShown ? null : (
      <LayerBadge id={ids.layer} layer={layer.layer} label={layer.label} />
    );
  const widthClasses = fieldWidthClasses(width);
  const control =
    widthClasses === "" ? (
      children
    ) : (
      <div className={cn("min-w-0", widthClasses)}>{children}</div>
    );
  const body = (
    <>
      {help === undefined ? null : (
        <p id={ids.help} className={MEMBER_FIELD_HELP_CLASSES}>
          {help}
        </p>
      )}
      {suffix === undefined ? (
        control
      ) : (
        <div className={MEMBER_FIELD_CONTROL_ROW_CLASSES}>
          {control}
          <span id={ids.suffix} className={MEMBER_FIELD_SUFFIX_CLASSES}>
            {suffix}
          </span>
        </div>
      )}
      {counter === undefined ? null : (
        <p id={ids.counter} className={MEMBER_FIELD_COUNTER_CLASSES}>
          {counter.text ?? `${counter.value} / ${counter.max}`}
        </p>
      )}
      {warnings === undefined || warnings.length === 0 ? null : (
        <div id={ids.warning} className="flex flex-col gap-1">
          {warnings.map((warning) => (
            <FieldMessage key={warning} kind="warning">
              {warning}
            </FieldMessage>
          ))}
        </div>
      )}
      {error === undefined || error === null ? null : (
        <FieldMessage kind="error" id={ids.error}>
          {error}
        </FieldMessage>
      )}
    </>
  );
  const rootClasses = cn(
    fieldClasses(size),
    conditional && MEMBER_FIELD_ENTERING_CLASSES,
    className,
  );
  if (kind === "group") {
    // The legend is the first child of the fieldset; the badge follows it (a legend holds text only).
    return (
      <fieldset
        role={radioGroup === undefined ? undefined : "radiogroup"}
        aria-invalid={radioGroup?.invalid ? true : undefined}
        aria-describedby={describedBy}
        className={rootClasses}
      >
        <legend className={cn(MEMBER_FIELD_LABEL_CLASSES, "mb-2 p-0")}>
          {labelText}
        </legend>
        {badge}
        {body}
      </fieldset>
    );
  }
  return (
    <div className={rootClasses}>
      <div className={MEMBER_FIELD_HEADER_CLASSES}>
        <label htmlFor={ids.control} className={MEMBER_FIELD_LABEL_CLASSES}>
          {labelText}
        </label>
        {badge}
      </div>
      {body}
    </div>
  );
}

export type FieldGridProps = {
  /** 1 by default; from 640 px, 2, 3 or 4 columns (RU-03), a gap of 24 px. */
  columns?: FieldGridColumns;
  className?: string;
  children?: ReactNode;
};

/** The grid of fields (`fgrid`): the fields of a block side by side from 640 px. */
export function FieldGrid({ columns, className, children }: FieldGridProps) {
  return (
    <div className={cn(fieldGridClasses(columns), className)}>{children}</div>
  );
}
