// Classes of the skeleton of the connected spaces (docs/mvp/22-refonte-ux-ui/02a C09, 04 line 32): shapes at
// the height of what they stand for, on `skeleton-base`, radius 6 px. A sheen of `skeleton-sheen` crosses
// each shape in 1,2 s, linear and infinite, under `motion-safe:` only: under reduced motion the shapes stay
// still and plain (AN-1). The sheen moves by `translate` alone (AN-4). The five shapes are the keys of their
// object, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

/** A shape: the base ground, the clip, and the sheen as a gradient that the animation slides across. */
const SKELETON_BLOCK_CLASSES = cn(
  "relative overflow-hidden rounded-sm bg-skeleton-base",
  "motion-safe:after:absolute motion-safe:after:inset-0 motion-safe:after:animate-skeleton",
  "motion-safe:after:bg-linear-to-r motion-safe:after:from-transparent",
  "motion-safe:after:via-skeleton-sheen motion-safe:after:to-transparent",
);

/** The line of text: 14 px, the height of a `text-sm`. */
export const SKELETON_LINE_CLASSES = cn(
  SKELETON_BLOCK_CLASSES,
  "h-(--size-skeleton-line)",
);

/** The last line of a group of lines is two thirds of the others. */
export const SKELETON_SHORT_LINE_CLASSES = cn(SKELETON_LINE_CLASSES, "w-2/3");

/** The photo: 4 / 3 at the width of its container. */
export const SKELETON_PHOTO_CLASSES = cn(
  SKELETON_BLOCK_CLASSES,
  "aspect-4/3 w-full",
);

/** The label of a field: a short line; its box: the height of an input. */
export const SKELETON_FIELD_LABEL_CLASSES = cn(SKELETON_LINE_CLASSES, "w-1/4");
export const SKELETON_FIELD_BOX_CLASSES = cn(
  SKELETON_BLOCK_CLASSES,
  "h-(--size-input) w-full",
);

/**
 * The row of a list: 60 px, the height of a row of C06 (the touch target and 16 px). A sum of two tokens, no
 * token of its own (none is added by RUB), written as a constant like the other sums of the front (EC-RUB-04-3).
 */
const SKELETON_ROW_HEIGHT_CLASSES =
  "h-[calc(var(--size-touch-target)+var(--spacing-4))]";
const SKELETON_ROW_CLASSES = cn(
  SKELETON_BLOCK_CLASSES,
  SKELETON_ROW_HEIGHT_CLASSES,
  "w-full",
);

const SKELETON_SHAPE_CLASSES = {
  /** One line of text. */
  line: { stack: "flex flex-col gap-2", item: SKELETON_LINE_CLASSES },
  /** One row of a list. */
  row: { stack: "flex flex-col gap-2", item: SKELETON_ROW_CLASSES },
  /** One card: a photo, then three lines. */
  card: { stack: "flex flex-col gap-4", item: "flex flex-col gap-3" },
  /** One photo. */
  photo: { stack: "flex flex-col gap-4", item: SKELETON_PHOTO_CLASSES },
  /** One field: its label, then its box of 48 px. */
  field: { stack: "flex flex-col gap-4", item: "flex flex-col gap-2" },
};

export type SkeletonShape = keyof typeof SKELETON_SHAPE_CLASSES;

/** The stack of the shapes of one skeleton, hidden until the delay has passed (`invisible` keeps their room). */
export function skeletonStackClasses(
  shape: SkeletonShape,
  visible: boolean,
): string {
  return cn(SKELETON_SHAPE_CLASSES[shape].stack, !visible && "invisible");
}

/** The element of one shape. */
export function skeletonItemClasses(shape: SkeletonShape): string {
  return SKELETON_SHAPE_CLASSES[shape].item;
}

/** Read aloud in place of the shapes: off screen, in the accessibility tree. */
export const SKELETON_LABEL_CLASSES = "sr-only";
