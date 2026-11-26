import type { ReactNode } from "react";
import {
  CircleAlertIcon,
  EyeIcon,
  TriangleAlertIcon,
} from "@/components/ui/icons";
import {
  FIELD_MESSAGE_TEXT_CLASSES,
  fieldMessageClasses,
  fieldMessageIconClasses,
  type FieldMessageKind,
} from "./field-message-classes";

const KIND_ICONS = {
  error: CircleAlertIcon,
  warning: TriangleAlertIcon,
  seen: EyeIcon,
} as const;

export type FieldMessageProps = {
  /** An error (a refusal), a warning (what the member should check, never a refusal) or what a brand sees. */
  kind: FieldMessageKind;
  /** The id the control points to by `aria-describedby`. */
  id?: string;
  /** The text, already translated; a warning carries its own « To check: » when it has one. */
  children?: ReactNode;
};

/**
 * The message under a field (C19): the icon of its kind and the text, never a box and never announced
 * by itself (the control is tied to it, and the summary of the form tells the refusals).
 */
export function FieldMessage({ kind, id, children }: FieldMessageProps) {
  const Icon = KIND_ICONS[kind];
  return (
    <p id={id} className={fieldMessageClasses(kind)}>
      <Icon aria-hidden="true" className={fieldMessageIconClasses(kind)} />
      <span className={FIELD_MESSAGE_TEXT_CLASSES}>{children}</span>
    </p>
  );
}
