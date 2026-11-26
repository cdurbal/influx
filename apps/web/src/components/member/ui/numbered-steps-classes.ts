// Classes of the numbered steps (C51; docs/mvp/22-refonte-ux-ui/02b C51, RUB-B §5 AP1): a list of steps seen at a
// glance, each one a marker of 28 px (14 px text, the number in Manrope 700 at 12 px) and its label. The state is
// told by more than the colour: a done step shows a check on the success ground, the current one is the label in 600
// on `surface-active`, a step to do is the number on `surface-raised` in secondary text. The current marker carries a
// transparent contour that forced colours draw (AP1). The states are the bare keys of their objects, not quoted
// strings (TK7.2).
import { cn } from "@/components/ui/class-names";

/** The list: one step per line, 8 px apart, 14 px. */
export const NUMBERED_STEPS_CLASSES =
  "m-0 flex list-none flex-col gap-2 p-0 text-sm";

const NUMBERED_STEP_TEXT_CLASSES = {
  todo: "text-text-secondary",
  current: "font-semibold text-text-primary",
  done: "text-text-secondary",
};

export type NumberedStepState = keyof typeof NUMBERED_STEP_TEXT_CLASSES;

/** One step: the marker and its text side by side, the marker on the first line. */
export function numberedStepClasses(state: NumberedStepState): string {
  return cn("flex items-start gap-2", NUMBERED_STEP_TEXT_CLASSES[state]);
}

const NUMBERED_MARKER_STATE_CLASSES = {
  todo: "bg-surface-raised",
  current: cn(
    "bg-surface-active text-text-primary",
    "outline-solid outline-(length:--border-width-thick) outline-transparent",
    "outline-offset-(--focus-ring-offset-inset)",
  ),
  done: "bg-feedback-success-bg text-feedback-success-text",
};

/** The marker: a round of 28 px, the number or the check centred in it. */
export function numberedMarkerClasses(state: NumberedStepState): string {
  return cn(
    "inline-flex size-(--size-step-marker) shrink-0 items-center justify-center rounded-round",
    "font-display text-xs font-bold",
    NUMBERED_MARKER_STATE_CLASSES[state],
  );
}

/** The check of a done step. */
export const NUMBERED_CHECK_CLASSES = "size-(--size-icon-sm)";

/** The text of a step: it sits at the height of the marker, and its body under it. */
export const NUMBERED_TEXT_CLASSES =
  "flex min-h-(--size-step-marker) min-w-0 flex-col justify-center";

/** What a step adds under its label. */
export const NUMBERED_BODY_CLASSES = "font-regular text-text-secondary";
