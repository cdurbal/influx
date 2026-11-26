// Classes of the recap (C42; docs/mvp/22-refonte-ux-ui/02b C42): the answers of a wizard read once more before they
// are sent, one section per step under a filet of `border-default`, its `h3` (16 px, 700) and its « Edit » link on one
// line, then the properties on a label of 11 rem, then what is missing, as a line of warning.
import { CARD_TITLE } from "./heading-classes";

/** The sections, one under the other. */
export const RECAP_CLASSES = "flex flex-col";

/** A section: a filet over it, 16 px of air above and under, 8 px between its parts. */
export const RECAP_SECTION_CLASSES =
  "flex flex-col gap-2 border-t-(length:--border-width-thin) border-border-default py-4";

/** The line of a section: its title, and its link to edit on the right. */
export const RECAP_HEAD_CLASSES = "flex items-center justify-between gap-x-3";

/** The `h3` of a section: 16 px, 700. */
export const RECAP_TITLE_CLASSES = CARD_TITLE;

/** What is missing in a section: one line of warning each, 4 px apart. */
export const RECAP_MISSING_CLASSES = "flex flex-col gap-1";
