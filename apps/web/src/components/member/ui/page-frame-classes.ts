// Classes of the page frame of the member spaces (C01; docs/mvp/22-refonte-ux-ui/02a §1, 02c §1;
// RUB-A §5). The one frame of a page: the gutter, the one header glow of F6 (RK-9, TK2.1: a ground,
// never a layer over the content), the vertical gap, and the reserve under a sticky bar on a phone.
// No variant centres itself: the left edge of the `h1` is the same on every page of a space (CA08),
// which `mx-auto` would move with the width of the window. The keys are identifiers, not strings, so
// that the words of the variants are not read as classes (TK7.2).
import { cn } from "@/components/ui/class-names";

const PAGE_FRAME_BASE_CLASSES = cn(
  "flex w-full flex-col min-h-(--size-header-glow) bg-header-glow bg-no-repeat",
);

/**
 * The width and the padding of a frame. Both member frames stop at `container-max`, so that the glow
 * is the same on every page (E01.0-S17; U-7). `narrow` holds a stack of `container-narrow` at most,
 * on the left: its right padding takes what is left, never less than the gutter, so that no screen
 * wraps its content (the percentage is of the parent, which a `w-full` frame fills up to its
 * maximum). `bo` is the common contract of the backoffice frame, whose rendering RUC settles (02a:
 * 32 by 48 px).
 */
const PAGE_FRAME_VARIANT_CLASSES = {
  wide: "max-w-(--container-max) px-page-gutter py-section-header",
  narrow:
    "max-w-(--container-max) pl-page-gutter pr-[max(var(--spacing-page-gutter),calc(min(100%,var(--container-max))-var(--container-narrow)-var(--spacing-page-gutter)))] py-section-header",
  bo: "px-8 py-6",
};

/** The vertical gap asked of a frame: the page (32), a reading (24), a stacked page (48, 32 below lg). */
const PAGE_FRAME_GAP_CLASSES = {
  page: "gap-6",
  reading: "gap-5",
  stack: "gap-8 max-lg:gap-6",
};

/** The gap of a frame that asks for none: 32 for a member page, 24 for the backoffice (02a). */
const PAGE_FRAME_USUAL_GAP_CLASSES = {
  wide: PAGE_FRAME_GAP_CLASSES.page,
  narrow: PAGE_FRAME_GAP_CLASSES.page,
  bo: PAGE_FRAME_GAP_CLASSES.reading,
};

/** The reserve under a sticky bar, on a phone only (RU-15): one token per bar. */
const PAGE_FRAME_STICKY_CLASSES = {
  search: "max-md:pb-(--size-mobile-space-search)",
  reading: "max-md:pb-(--size-mobile-space-reading)",
  wizard: "max-md:pb-(--size-mobile-space-wizard)",
};

export type PageFrameVariant = keyof typeof PAGE_FRAME_VARIANT_CLASSES;
export type PageFrameGap = keyof typeof PAGE_FRAME_GAP_CLASSES;
export type PageFrameStickyBar = keyof typeof PAGE_FRAME_STICKY_CLASSES;

type PageFrameOptions = {
  gap?: PageFrameGap;
  stickyBar?: PageFrameStickyBar;
};

/**
 * The two frames of the member screens that keep their own element until they migrate (RUB-A §5),
 * built from the bare keys: a variant written as a string in a module of classes would be read as a
 * class (TK7.2). A unit case holds them equal to `pageFrameClasses()`.
 */
export const NARROW_PAGE_FRAME_CLASSES = cn(
  PAGE_FRAME_BASE_CLASSES,
  PAGE_FRAME_VARIANT_CLASSES.narrow,
  PAGE_FRAME_USUAL_GAP_CLASSES.narrow,
);
export const WIDE_PAGE_FRAME_CLASSES = cn(
  PAGE_FRAME_BASE_CLASSES,
  PAGE_FRAME_VARIANT_CLASSES.wide,
  PAGE_FRAME_USUAL_GAP_CLASSES.wide,
);

/** The classes of a frame, as a string for the screens that keep their own element until they migrate. */
export function pageFrameClasses(
  variant: PageFrameVariant,
  { gap, stickyBar }: PageFrameOptions = {},
): string {
  return cn(
    PAGE_FRAME_BASE_CLASSES,
    PAGE_FRAME_VARIANT_CLASSES[variant],
    gap === undefined
      ? PAGE_FRAME_USUAL_GAP_CLASSES[variant]
      : PAGE_FRAME_GAP_CLASSES[gap],
    stickyBar === undefined ? undefined : PAGE_FRAME_STICKY_CLASSES[stickyBar],
  );
}
