// Classes of the gallery (C34; docs/mvp/22-refonte-ux-ui/02b C34, RUB-B §4, R04 lines 9 and 10, 20 §11.8): from 768 px
// a mosaic of 2 / 1 without an empty cell, below it a carousel of 4 / 3 with its counter, and one of the two alone at a
// width, by CSS. The second module of the member front that reads an `effect-photo-*` token (G8,
// PHOTO_EFFECT_READERS): the ground of the counter, `effect-photo-scrim`. The ring of a visual is drawn inside its
// cell by its `after`, a double one (the usual `focus-ring` over a halo of `surface-page`, AP2), because the picture
// would hide an inner shadow of the button and its neighbours an outer one. Plain strings where a class holds `[`: the
// lint forbids them inside `cn()` (CA22). The layouts of the mosaic are read by index, never by a quoted key (TK7.2).
import { cn } from "@/components/ui/class-names";
import { PHOTO_CONTROL_RING_CLASSES } from "./photo-card-classes";
import { TOUCH_ZONE_HEIGHT_AREA_CLASSES } from "./touch-zone-classes";

/** Without a visual: a sentence, no frame. */
export const GALLERY_EMPTY_CLASSES = "text-md text-text-secondary";

/** The mosaic and its button, from 768 px alone. */
export const GALLERY_MOSAIC_CLASSES = "relative max-md:hidden";

/** The frame of the mosaic: 2 / 1, two rows, 8 px between the visuals. */
export const GALLERY_GRID_CLASSES =
  "grid aspect-mosaic grid-cols-(--grid-mosaic) grid-rows-2 gap-2";

/** The mosaic shows five visuals at most: the others are in the dialog. */
export const GALLERY_MOSAIC_MAX = 5;

/** One cell: its place in the grid, then the corners it holds on the frame. */
type MosaicCell = readonly [place: string, corner: string];

// From two visuals on, the first stands on the left over the two rows.
const FIRST_CELL: MosaicCell = ["row-span-2", "rounded-l-card"];
const TOP_RIGHT_CELL: MosaicCell = ["", "rounded-tr-card"];
const BOTTOM_RIGHT_CELL: MosaicCell = ["", "rounded-br-card"];
const INNER_CELL: MosaicCell = ["", ""];

/** The cells of the mosaic by the number of visuals shown, from 1 to 5: no cell is ever left empty (RU-34). */
const MOSAIC_LAYOUTS: readonly (readonly MosaicCell[])[] = [
  [["col-span-3 row-span-2", "rounded-card"]],
  [FIRST_CELL, ["col-span-2 row-span-2", "rounded-r-card"]],
  [
    FIRST_CELL,
    ["col-span-2", "rounded-tr-card"],
    ["col-span-2", "rounded-br-card"],
  ],
  [
    FIRST_CELL,
    ["col-span-2", "rounded-tr-card"],
    INNER_CELL,
    BOTTOM_RIGHT_CELL,
  ],
  [FIRST_CELL, INNER_CELL, TOP_RIGHT_CELL, INNER_CELL, BOTTOM_RIGHT_CELL],
];

/** The place and the corners of one cell, among the `count` visuals of the gallery. */
export function galleryCellClasses(count: number, index: number): string {
  const layout = MOSAIC_LAYOUTS[Math.min(count, GALLERY_MOSAIC_MAX) - 1];
  const [place, corner] = layout?.[index] ?? INNER_CELL;
  return cn(place, corner);
}

/** A visual as a button: its picture covers it, and its double ring is drawn inside it, above the picture. */
export const GALLERY_VISUAL_CLASSES = [
  "group/visual relative block cursor-zoom-in overflow-hidden bg-surface-raised focus-visible:outline-hidden",
  "after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit]",
  "focus-visible:after:outline-solid focus-visible:after:outline-(length:--focus-ring-width)",
  "focus-visible:after:outline-focus-ring focus-visible:after:outline-offset-(--focus-ring-offset-inset)",
  "focus-visible:after:shadow-[inset_0_0_0_calc(var(--focus-ring-width)+var(--border-width-thick))_var(--color-surface-page)]",
].join(" ");

export const GALLERY_IMAGE_CLASSES = "absolute inset-0 size-full object-cover";

/** A visual of the mosaic dims on hover over 120 ms (R04 line 10), by the token of the effect. */
export const GALLERY_MOSAIC_IMAGE_CLASSES = [
  GALLERY_IMAGE_CLASSES,
  "transition-[filter] duration-(--duration-fast) ease-(--ease-standard)",
  "group-hover/visual:filter-(--effect-media-hover)",
].join(" ");

/** « Voir les n visuels »: 36 px, inverse, bottom right of the mosaic, with the double ring of a control on a photo. */
export const GALLERY_ALL_CLASSES = [
  "absolute bottom-4 right-4 inline-flex min-h-(--size-tag) items-center gap-2 rounded-md px-3",
  "bg-surface-inverse text-sm font-semibold text-text-inverse shadow-sm",
  TOUCH_ZONE_HEIGHT_AREA_CLASSES,
  PHOTO_CONTROL_RING_CLASSES,
].join(" ");

export const GALLERY_ALL_ICON_CLASSES = "size-(--size-icon-sm) shrink-0";

/** The carousel, below 768 px alone. */
export const GALLERY_CAROUSEL_CLASSES = "relative md:hidden";

/** The track: one visual at a time, snapped, swiped or moved by the arrows of the keyboard (X8). */
export const GALLERY_TRACK_CLASSES = [
  "flex aspect-photo snap-x snap-mandatory overflow-x-auto",
  "motion-safe:scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
  "focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus-ring",
  "focus-visible:outline-offset-(--focus-ring-offset)",
].join(" ");

export const GALLERY_SLIDE_CLASSES = "size-full shrink-0 basis-full snap-start";

/** One visual alone below 768 px: no track. */
export const GALLERY_SINGLE_CLASSES = "aspect-photo w-full";

/** The counter « 1 / 5 »: 12 px on the scrim of 75 %, bottom right of the photo. */
export const GALLERY_COUNT_CLASSES = [
  "pointer-events-none absolute bottom-3 right-3 rounded-sm bg-(--effect-photo-scrim) px-2 py-1",
  "text-xs font-semibold tabular-nums text-text-primary",
].join(" ");

/** The head of the dialog: the chevron that closes, then the title, over a filet. */
export const GALLERY_HEAD_CLASSES = cn(
  "flex shrink-0 items-center gap-3 px-page-gutter py-3",
  "border-b-(length:--border-width-thin) border-border-default",
);

export const GALLERY_TITLE_CLASSES =
  "min-w-0 font-display text-md font-bold leading-snug focus:outline-hidden";

/** The body scrolls and is reached by the keyboard (X8); positioned, so that a visual is found inside it. */
export const GALLERY_BODY_CLASSES = [
  "relative min-h-0 flex-1 overflow-y-auto px-page-gutter py-6",
  "focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus-ring",
  "focus-visible:outline-offset-(--focus-ring-offset-inset)",
].join(" ");

/** The visuals of the dialog: two columns from 768 px, 56 rem at most. */
export const GALLERY_LIST_CLASSES =
  "mx-auto grid max-w-(--container-gallery) gap-5 md:grid-cols-2";

export const GALLERY_FIGURE_CLASSES = "flex flex-col gap-2";

export const GALLERY_FIGURE_IMAGE_CLASSES =
  "aspect-photo w-full rounded-md bg-surface-raised object-cover";

export const GALLERY_CAPTION_CLASSES = "text-sm text-text-secondary";
