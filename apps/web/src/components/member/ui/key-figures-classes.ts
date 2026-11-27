// Classes of the key figures (C35; docs/mvp/22-refonte-ux-ui/02b C35, X9, 20 §11.5 RU-01): `figures`, four columns
// in a frame with filets, two below 640 px, the figure at the fixed steps of `text-key-figure`; `essentials`, two by
// two with an icon of 24 px, one column below 640 px; `network`, three columns without a frame. A pair is a `div` of
// the `dl` holding its `dt` and its `dd` alone: the icon is in the term. The variants are the bare keys of their
// object (TK7.2). Plain strings where a class holds `[` or a zero border: the lint forbids them inside `cn()` (CA22).

const FRAME_CLASSES =
  "rounded-card border-(length:--border-width-thin) border-border-default";

// A filet before each cell but the first; below 640 px the cell that starts a row (1st, 3rd) has none.
const FIGURES_CELL_CLASSES = [
  "flex min-w-0 flex-col items-center justify-center px-3 text-center",
  "border-border-default not-first:border-l-(length:--border-width-thin) max-form:odd:border-l-0",
].join(" ");

// A filet before the second of a row and above every row but the first; one column below 640 px.
const ESSENTIALS_CELL_CLASSES = [
  "relative flex min-w-0 flex-col p-4 border-border-default",
  "even:border-l-(length:--border-width-thin) max-form:even:border-l-0",
  "nth-[n+3]:border-t-(length:--border-width-thin) max-form:nth-[n+2]:border-t-(length:--border-width-thin)",
].join(" ");

const KEY_FIGURES_VARIANTS = {
  figures: {
    list: `grid grid-cols-4 px-2 py-4 max-form:grid-cols-2 max-form:gap-y-4 ${FRAME_CLASSES}`,
    cell: FIGURES_CELL_CLASSES,
    // the figure on top, the words under it: the term still comes first in the page
    pair: "flex-col-reverse gap-1",
    term: "text-xs text-text-secondary",
    value:
      "min-w-0 break-words font-display text-key-figure font-extrabold tabular-nums",
    sub: "block font-base text-xs font-regular text-text-secondary",
  },
  essentials: {
    list: `grid grid-cols-2 max-form:grid-cols-1 ${FRAME_CLASSES}`,
    cell: ESSENTIALS_CELL_CLASSES,
    pair: "",
    term: "text-xs font-semibold text-text-secondary",
    value: "min-w-0 break-words font-semibold",
    sub: "block text-xs font-regular text-text-secondary",
  },
  network: {
    list: "grid grid-cols-3 gap-4",
    cell: "flex min-w-0 flex-col",
    pair: "",
    term: "text-xs text-text-secondary",
    value: "min-w-0 break-words font-display font-bold tabular-nums",
    sub: "block font-base text-xs font-regular text-text-tertiary",
  },
};

export type KeyFiguresVariant = keyof typeof KEY_FIGURES_VARIANTS;

/** The classes of the parts of one variant. */
export function keyFiguresClasses(variant: KeyFiguresVariant) {
  return KEY_FIGURES_VARIANTS[variant];
}

/** The icon of an essential: 24 px at the left of its pair, which leaves it the room. */
export const KEY_FIGURE_ICON_CLASSES =
  "absolute left-4 top-4 size-(--size-icon-lg) text-text-secondary";

export const KEY_FIGURE_ICON_ROOM_CLASSES =
  "pl-[calc(var(--spacing-4)+var(--size-icon-lg)+var(--spacing-3))]";

/** The verified cell of the figures: a blue icon of 28 px over its words, in the small secondary text. */
export const KEY_FIGURE_VERIFIED_TERM_CLASSES =
  "flex flex-col items-center gap-1 text-xs text-text-secondary";
export const KEY_FIGURE_VERIFIED_ICON_CLASSES =
  "size-(--size-step-marker) text-verified-text";
export const KEY_FIGURE_VERIFIED_VALUE_CLASSES = "text-xs text-text-secondary";
