// Classes of the wizard (C41; docs/mvp/22-refonte-ux-ui/02b C41, 02c, R04 lines 23 and 24, RUB-B §2, §5): a box of
// 768 px (a card from `md`, none on a phone), a head (the `h1` and the count, the segments, the meta), the step, and a
// foot that is fixed over the bottom bar under 768 px. The `h1` and the `h2` are Manrope 700 at 20 px (RU-17); the
// weight of 700 is carried here, not by the header of the page (EC-RUB-01-3).
//
// The segments are 6 px bars whose touch zone reaches 26 px by a transparent pseudo-element (WCAG 2.5.8 holds at 24 px;
// every step has an equivalent of 44 px elsewhere, RUB-B §2). Done and current are the brand green as a progression,
// a step to complete is the warning colour, the others `surface-active`. Under forced colours the fills fall away: every
// segment carries a transparent contour, thin on all and thick on the done and the current one (AP1), replaced by the
// ring at focus. The states are the bare keys of their object, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";
import { SECTION_TITLE } from "./heading-classes";

/** The box: 768 px at most, a card from 768 px up; the gap of its parts is 24 px. */
export const WIZARD_CLASSES = cn(
  "flex w-full max-w-(--container-narrow) flex-col gap-5",
  "md:rounded-card md:border-(length:--border-width-thin) md:border-border-default",
  "md:bg-surface-card md:p-inset-card",
);

/** The head: the title and the count, the segments, the meta, the notice of the screen. */
export const WIZARD_HEAD_CLASSES = "flex flex-col gap-3";

/** The title and the count: side by side, wrapping together on a narrow window. */
export const WIZARD_TOP_CLASSES =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2";

/** The `h1` of the wizard: 20 px, 700 (RU-17). */
export const WIZARD_TITLE_CLASSES = SECTION_TITLE;

/** « Step 2 of 5 »: 14 px in secondary text, the digits aligned, never broken. */
export const WIZARD_COUNT_CLASSES =
  "whitespace-nowrap text-sm tabular-nums text-text-secondary";

/** The list of the segments: one column each, 4 px apart, whatever their number. */
export const WIZARD_SEGMENTS_CLASSES =
  "m-0 grid list-none grid-flow-col auto-cols-fr gap-1 p-0";

/** The grounds of a segment by state: progress in the brand green, a gap in the warning colour. */
const WIZARD_SEGMENT_STATE_CLASSES = {
  todo: "bg-surface-active",
  current: "bg-brand-primary",
  done: "bg-brand-primary",
  gap: "bg-feedback-warning-icon",
};

export type WizardStepState = keyof typeof WIZARD_SEGMENT_STATE_CLASSES;

/** The contour of a segment: transparent, thin on all, thick on the done and the current one (AP1). */
const WIZARD_SEGMENT_THIN_CONTOUR_CLASSES = cn(
  "outline-solid outline-(length:--border-width-thin) outline-transparent",
  "outline-offset-(--focus-ring-offset-inset)",
);
const WIZARD_SEGMENT_THICK_CONTOUR_CLASSES = cn(
  "outline-solid outline-(length:--border-width-thick) outline-transparent",
  "outline-offset-(--focus-ring-offset-inset)",
);

const WIZARD_SEGMENT_CONTOUR_CLASSES = {
  todo: WIZARD_SEGMENT_THIN_CONTOUR_CLASSES,
  current: WIZARD_SEGMENT_THICK_CONTOUR_CLASSES,
  done: WIZARD_SEGMENT_THICK_CONTOUR_CLASSES,
  gap: WIZARD_SEGMENT_THIN_CONTOUR_CLASSES,
};

/**
 * One segment, a link of 6 px: the colour changes over 320 ms on the curve `standard` when a step is done (R04
 * line 24), instantly under reduced motion. Its zone is 26 px tall by `before`; the ring replaces the contour.
 */
export function wizardSegmentClasses(state: WizardStepState): string {
  return cn(
    "relative block h-(--size-segment-bar) rounded-pill",
    "transition-colors duration-(--duration-slow) ease-(--ease-standard)",
    "before:absolute before:inset-x-0 before:inset-y-(--inset-segment-hit)",
    WIZARD_SEGMENT_STATE_CLASSES[state],
    WIZARD_SEGMENT_CONTOUR_CLASSES[state],
    "focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus-ring",
    "focus-visible:outline-offset-(--focus-ring-offset)",
  );
}

/** The line of meta: the time left on the left, the save status of a phone and the link to leave on the right. */
export const WIZARD_META_CLASSES =
  "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-text-secondary";
export const WIZARD_META_ACTIONS_CLASSES =
  "flex flex-wrap items-center gap-x-3";

/** The save status in the head, on a phone only: from 768 px it sits at the centre of the foot. */
export const WIZARD_SAVE_META_CLASSES = "md:hidden";

/** The save status of the foot, from 768 px: it takes the room between the two buttons. */
export const WIZARD_SAVE_FOOT_CLASSES = "min-w-0 flex-1 max-md:hidden";

/** The step: its own column of 24 px, in by `fade-in` over 120 ms (R04 line 23), instantly under reduced motion. */
export const WIZARD_STEP_CLASSES = "flex flex-col gap-5 animate-fade-in";

/** The head of a step: the `h2` and its introduction, 4 px apart. */
export const WIZARD_STEP_HEAD_CLASSES = "flex flex-col gap-1";

/** The `h2` of a step: 20 px, 700; it takes the focus from the app and shows no ring (the globals). */
export const WIZARD_STEP_TITLE_CLASSES = SECTION_TITLE;

export const WIZARD_INTRO_CLASSES = "text-md text-text-secondary";

/**
 * The foot: a filet, then the buttons. Under 768 px it is fixed over the bottom bar (RU-15), the page frame keeping
 * the reserve; `ml-auto` of the next button holds it on the right whether or not there is a previous one.
 */
export const WIZARD_FOOT_CLASSES = cn(
  "flex items-center gap-3 border-t-(length:--border-width-thin) border-border-default pt-4",
  "max-md:fixed max-md:inset-x-0 max-md:bottom-(--size-nav-bottom-height) max-md:z-(--z-raised)",
  "max-md:bg-surface-page max-md:px-page-gutter max-md:py-2",
);

/** « Previous »: under 480 px the chevron alone, 44 px wide at least (RU-36); the label stays for the screen reader. */
export const WIZARD_BACK_CLASSES =
  "shrink-0 max-sm:min-w-(--size-touch-target) max-sm:px-0";

/** The label of « Previous »: read at every width, seen from 480 px. */
export const WIZARD_BACK_LABEL_CLASSES = "max-sm:sr-only";

/** « Continue »: on the right, two lines allowed. */
export const WIZARD_NEXT_CLASSES = "ml-auto min-w-0";
