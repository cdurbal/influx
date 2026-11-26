// Classes of the pager (C32; docs/mvp/22-refonte-ux-ui/02a C32): « Précédent » to the left, the position in the middle,
// « Suivant » to the right, on one line; the position is written (14 px, secondary text, tabular figures) and the
// total of the backoffice goes with it on the same line, 4 px between the lines it wraps to and 16 between its parts.
// An absent side keeps its place, so that the position never moves from one page to the next.

/** The row: the two sides push the position to the middle. */
export const PAGER_CLASSES = "flex items-center justify-between gap-3";

/** The position and the total: one line, wrapping on a narrow screen. */
export const PAGER_SUMMARY_CLASSES =
  "flex min-w-0 flex-wrap justify-center gap-x-4 gap-y-1 text-center text-sm tabular-nums text-text-secondary";

/** The place kept by a side that is not there: the buttons are about the same width, the position stays centred. */
export const PAGER_SIDE_CLASSES = "flex min-w-0 flex-1 items-center";

export const PAGER_NEXT_SIDE_CLASSES =
  "flex min-w-0 flex-1 items-center justify-end";

export const PAGER_ICON_CLASSES = "size-(--size-icon-sm)";
