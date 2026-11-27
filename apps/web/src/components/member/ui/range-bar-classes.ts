// Classes of the bars of ranges (C37; docs/mvp/22-refonte-ux-ui/02b C37): a label, a bar of 8 px and the written
// value, on the columns of `grid-range` (9 rem, the bar, 6,5 rem; narrower below 480 px, by the token itself). The
// bar is `data-2` on `surface-active`: a drawing, the written value carries the information.

export const RANGE_LIST_CLASSES = "flex flex-col gap-3";

export const RANGE_ROW_CLASSES =
  "grid grid-cols-(--grid-range) items-center gap-3 text-sm";

export const RANGE_LABEL_CLASSES = "min-w-0 break-words";

export const RANGE_TRACK_CLASSES =
  "block h-2 w-full overflow-hidden rounded-pill bg-surface-active";

/** The band, its two ends rounded by half of the 8 px of the track (a plain string: it holds `[`). */
export const RANGE_FILL_CLASSES =
  "fill-data-2 [rx:var(--spacing-1)] [ry:var(--spacing-1)]";

export const RANGE_VALUE_CLASSES =
  "text-right tabular-nums text-text-secondary";
