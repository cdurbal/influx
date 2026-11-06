import type { ReactNode } from "react";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { cn } from "@/components/ui/class-names";
import {
  MEMBER_FIELD_CLASSES,
  MEMBER_FIELD_HEADER_CLASSES,
  MEMBER_FIELD_HELP_CLASSES,
  MEMBER_FIELD_LABEL_CLASSES,
  MEMBER_FIELD_REQUIRED_CLASSES,
} from "./field-classes";
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
};

/** The ids the frame writes and the control points to by `aria-describedby`. */
export type FieldIds = {
  /** The id of the control (of the first one for a group): the screen focuses it by this id. */
  control: string;
  layer: string;
  help: string;
  error: string;
};

type FieldFrameProps = FieldTexts & {
  ids: FieldIds;
  /** One control and its `<label>`, or several (radios, boxes) in a `<fieldset>` with its `<legend>`. */
  kind: "single" | "group";
  /** Only for a group: the ids that describe the whole group. */
  describedBy?: string;
  /** Only for a group of radios: it is a `radiogroup`, which can be marked invalid as a whole. */
  radioGroup?: { invalid: boolean };
  children: ReactNode;
  className?: string;
};

/**
 * The shell of a field of the connected spaces (20 §11.8): label, requirement written, layer badge,
 * help, the control(s), the message of an error. The layer badge and the help describe the control
 * (`aria-describedby`) rather than being part of its name.
 */
export function FieldFrame({
  ids,
  kind,
  describedBy,
  radioGroup,
  label,
  requiredLabel,
  layer,
  help,
  error,
  children,
  className,
}: FieldFrameProps) {
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
    layer === undefined ? null : (
      <LayerBadge id={ids.layer} layer={layer.layer} label={layer.label} />
    );
  const body = (
    <>
      {help === undefined ? null : (
        <p id={ids.help} className={MEMBER_FIELD_HELP_CLASSES}>
          {help}
        </p>
      )}
      {children}
      {error === undefined || error === null ? null : (
        <ErrorNotice id={ids.error} announce={false}>
          {error}
        </ErrorNotice>
      )}
    </>
  );
  if (kind === "group") {
    // The legend is the first child of the fieldset; the badge follows it (a legend holds text only).
    return (
      <fieldset
        role={radioGroup === undefined ? undefined : "radiogroup"}
        aria-invalid={radioGroup?.invalid ? true : undefined}
        aria-describedby={describedBy}
        className={cn(MEMBER_FIELD_CLASSES, className)}
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
    <div className={cn(MEMBER_FIELD_CLASSES, className)}>
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
