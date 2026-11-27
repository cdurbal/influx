// Classes of the pager (C32; docs/mvp/22-refonte-ux-ui/02a C32): « Précédent » to the left, the position in the middle,
// « Suivant » to the right, on one line from the `form` breakpoint; under it, the position takes a line of its own above
// the two sides, by its order on screen alone (the order of the page stays). The position is written (14 px, secondary
// text, tabular figures) and the total of the backoffice goes with it on the same line, 4 px between the lines it wraps
// to and 16 between its parts. An absent side keeps its place, so that the position does not move from one page to the
// next. No text ever lies under a button (RUB U-1): a side is never narrower than its button. Under `form` the button
// may wrap its label (`min-content`), and « Suivant » takes a third line when the two do not fit side by side; from
// `form`, a button keeps its one line and the position wraps instead.

/** The row: the two sides push the position to the middle; under `form` it wraps, 8 px between its two lines. */
export const PAGER_CLASSES =
  "flex items-center justify-between gap-x-3 gap-y-2 max-form:flex-wrap";

/** The position and the total: one line, wrapping on a narrow screen. */
export const PAGER_SUMMARY_CLASSES =
  "flex min-w-0 flex-wrap justify-center gap-x-4 gap-y-1 text-center text-sm tabular-nums text-text-secondary max-form:order-first max-form:basis-full";

/** The place kept by a side that is not there: the buttons are about the same width, the position stays centred. */
export const PAGER_SIDE_CLASSES =
  "flex min-w-0 flex-1 items-center max-form:min-w-min form:min-w-fit";

export const PAGER_NEXT_SIDE_CLASSES =
  "flex min-w-0 flex-1 items-center justify-end max-form:min-w-min form:min-w-fit";

export const PAGER_ICON_CLASSES = "size-(--size-icon-sm)";
