// Classes of the save status (C25; docs/mvp/22-refonte-ux-ui/02a C25, R04 line 29): a 16 px icon and a 14 px text,
// 8 px apart. Each state has its own icon, so that the colour is never alone: a clock (waiting), a turning
// circle (sending: still under reduced motion), a check (saved), an alert (failed). The states and the places are
// the keys of their objects, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

const SAVE_STATUS_PLACEMENT_CLASSES = {
  foot: "justify-center text-center",
  meta: "justify-start",
};

export type SaveStatusPlacement = keyof typeof SAVE_STATUS_PLACEMENT_CLASSES;

const SAVE_STATUS_ROW_CLASSES = "flex flex-wrap items-center gap-x-2 text-sm";

const SAVE_STATUS_TEXT_CLASSES = {
  idle: "text-text-secondary",
  saving: "text-text-secondary",
  saved: "text-text-secondary",
  failed: "text-text-primary",
};

export type SaveState = keyof typeof SAVE_STATUS_TEXT_CLASSES;

/** The line: where it sits (the foot of the wizard, or its line of meta) and the tone of its text. */
export function saveStatusClasses(
  state: SaveState,
  placement?: SaveStatusPlacement,
): string {
  return cn(
    SAVE_STATUS_ROW_CLASSES,
    placement === undefined
      ? SAVE_STATUS_PLACEMENT_CLASSES.meta
      : SAVE_STATUS_PLACEMENT_CLASSES[placement],
    SAVE_STATUS_TEXT_CLASSES[state],
  );
}

const SAVE_STATUS_ICON_CLASSES = {
  idle: "text-text-secondary",
  saving: "text-text-secondary motion-safe:animate-spin",
  saved: "text-feedback-success-icon",
  failed: "text-feedback-warning-icon",
};

/** The icon: 16 px, in the colour of its state; it turns while sending, and only where motion is allowed. */
export function saveStatusIconClasses(state: SaveState): string {
  return cn("size-(--size-icon-sm) shrink-0", SAVE_STATUS_ICON_CLASSES[state]);
}

/** What follows the text of a failure: the delay of the next try, in secondary text. */
export const SAVE_STATUS_RETRY_IN_CLASSES = "text-text-secondary tabular-nums";
