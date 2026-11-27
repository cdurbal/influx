// Classes of the sticky box and of its bar (C39; docs/mvp/22-refonte-ux-ui/02a C04 `box`, 02b C39, R04 line 33,
// RU-05, RU-15, 20 §11.8): from 1 024 px the box stands in its column, 32 px under the top, with the one shadow a
// card at rest may have; below it the box is away and a bar is fixed over the bottom bar of the shell, with a filet
// and no shadow. One of the two at a width, by CSS, so that the screen shows one green action alone.
import { cn } from "@/components/ui/class-names";

/** What the box adds to the card of its variant (C04), which the component lays under it. */
export const STICKY_ASIDE_CLASSES =
  "self-start shadow-md max-lg:hidden lg:sticky lg:top-6";

export const MOBILE_ACTION_BAR_CLASSES = cn(
  "fixed inset-x-0 bottom-(--size-nav-bottom-height) z-(--z-raised) lg:hidden",
  "flex items-center justify-between gap-3 px-page-gutter py-2",
  "border-t-(length:--border-width-thin) border-border-default bg-surface-page",
);

export const MOBILE_ACTION_BAR_TEXT_CLASSES = "flex min-w-0 flex-col";

/** The action keeps its width: the words beside it wrap first. */
export const MOBILE_ACTION_BAR_ACTION_CLASSES = "shrink-0";
