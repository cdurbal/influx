// Classes of the code field (C49; docs/mvp/22-refonte-ux-ui/02b C49, 02c, R04 line 31, RU-08): six boxes of 5:6 in a
// width of 22 rem, 8 px apart, on `surface-raised` (the field of KEO is `surface-page`, the code keeps the ground of the
// mockup, RU-08); the box that waits for the next digit shows the ring colour in 2 px, an error draws 2 px of red on
// the six, and every box keeps its size whatever its outline (PT1: the ratio holds the height, the content is centred).
// The `line` variant is the field of a code that has no boxes (the account, the backoffice): the control of C18 at
// 12 rem, the digits spaced. The contour changes over 120 ms on the curve `standard`, instantly under reduced motion.
// The states are the bare keys of their object, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";
import { memberControlClasses } from "./field-classes";

/** The boxes: one column each, whatever the width of the page, 22 rem at most. */
export const OTP_BOXES_CLASSES =
  "relative grid w-full max-w-(--size-otp) grid-cols-6 gap-2";

/** The outline of a box by state: at rest 1 px, waiting for a digit 2 px of ring, in error 2 px of red. */
const OTP_BOX_STATE_CLASSES = {
  rest: "border-(length:--border-width-thin) border-border-strong text-text-primary",
  current:
    "border-(length:--border-width-thick) border-focus-ring text-text-primary",
  invalid:
    "border-(length:--border-width-thick) border-border-error text-text-primary",
  disabled:
    "border-(length:--border-width-thin) border-border-default text-text-disabled",
};

export type OtpBoxState = keyof typeof OTP_BOX_STATE_CLASSES;

/** One box: a 5:6 rectangle, the digit in Manrope 700 at 20 px, centred. */
export function otpBoxClasses(state: OtpBoxState): string {
  return cn(
    "flex aspect-otp items-center justify-center rounded-md bg-surface-raised",
    "font-display text-title-section font-bold tabular-nums transition-colors",
    OTP_BOX_STATE_CLASSES[state],
  );
}

/**
 * The real field of the boxes: one `input` over the six of them, invisible, which takes the click, the keyboard,
 * the paste and what the system offers (`one-time-code`). 16 px, so that a phone does not zoom on it.
 */
export const OTP_OVERLAY_INPUT_CLASSES =
  "absolute inset-0 m-0 size-full cursor-text appearance-none border-0 bg-transparent p-0 text-md opacity-0";

/** The field of the `line` variant: the control of C18, 12 rem at most, the digits spaced and aligned. */
export function otpLineClasses(hasError: boolean): string {
  return cn(
    memberControlClasses(hasError),
    "max-w-(--size-date) font-display tracking-code-entry tabular-nums",
  );
}
