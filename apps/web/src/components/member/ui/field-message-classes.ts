// Classes of the message under a field (C19; docs/mvp/22-refonte-ux-ui/02a C19): a 16 px icon and a 14 px text,
// 8 px apart, no box and no fill (the message of a field is a line, not a notice). An error is read in 600, a
// warning and what a brand sees in 400; each kind has its own icon, so that the colour is never alone (P7). The
// kinds are the keys of their object, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

const FIELD_MESSAGE_ROW_CLASSES = "flex items-start gap-2 text-sm";

const FIELD_MESSAGE_KIND_CLASSES = {
  error: {
    text: "font-semibold text-feedback-error-text",
    icon: "text-feedback-error-icon",
  },
  warning: {
    text: "text-feedback-warning-text",
    icon: "text-feedback-warning-icon",
  },
  seen: {
    text: "text-text-secondary",
    icon: "text-text-secondary",
  },
};

export type FieldMessageKind = keyof typeof FIELD_MESSAGE_KIND_CLASSES;

/** The line: the icon, then the text. */
export function fieldMessageClasses(kind: FieldMessageKind): string {
  return cn(FIELD_MESSAGE_ROW_CLASSES, FIELD_MESSAGE_KIND_CLASSES[kind].text);
}

/** The icon: 16 px, nudged to the first line of the text, in the colour of its kind. */
export function fieldMessageIconClasses(kind: FieldMessageKind): string {
  return cn(
    "mt-(--size-nudge) size-(--size-icon-sm) shrink-0",
    FIELD_MESSAGE_KIND_CLASSES[kind].icon,
  );
}

/** The text: it may wrap, never under the icon. */
export const FIELD_MESSAGE_TEXT_CLASSES = "min-w-0";
