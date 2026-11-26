// Classes of the dialogs (C27 Dialog, C28 FiltersDialog; docs/mvp/22-refonte-ux-ui/02a C27 and C28, R04 lines 7 and 8):
// the native `dialog` on `surface-raised`, a hairline, the radius of the cards, `shadow-lg`, the scrim of the theme
// behind it. It comes in over 200 ms on the curve `standard` (opacity, and a scale of 0.98 to 1 that reduced motion
// does not have) and goes out over 120 ms on the curve `exit`: the transition names `display` and `overlay`, which
// `transition-discrete` lets run, so that the element stays on screen while it fades. The width is a token and the
// browser keeps its own gutter around it (the margin of a modal), so that a phone never sees the dialog touch its
// edges. The sizes are the keys of their object, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

/** The two widths of C27: 30 rem for a confirmation, 34 rem when the dialog holds more. */
const DIALOG_SIZE_CLASSES = {
  confirm: "w-(--container-dialog)",
  wide: "w-(--container-confirm)",
};

export type DialogSize = keyof typeof DIALOG_SIZE_CLASSES;

// The fade of the element and of its scrim is a plain string: the lint reads a numeric opacity inside `cn()` as a
// level to replace by a token (CA22), but a fade to nothing is the one level there is (`opacity-0`, as the radio of C22).
const DIALOG_FADE_CLASSES = "starting:opacity-0 not-open:opacity-0";
const DIALOG_BACKDROP_FADE_CLASSES =
  "backdrop:starting:opacity-0 not-open:backdrop:opacity-0";

const DIALOG_MOTION_CLASSES = cn(
  "transition transition-discrete duration-(--duration-base) ease-(--ease-standard)",
  DIALOG_FADE_CLASSES,
  "motion-safe:starting:scale-(--scale-press) motion-safe:not-open:scale-(--scale-press)",
  "not-open:duration-(--duration-fast) not-open:ease-(--ease-exit)",
);

/** The scrim: the dialog never holds it, its backdrop does, and it fades with the dialog. */
const DIALOG_BACKDROP_CLASSES = cn(
  "backdrop:bg-overlay-scrim backdrop:transition backdrop:transition-discrete",
  "backdrop:duration-(--duration-base) backdrop:ease-(--ease-standard)",
  DIALOG_BACKDROP_FADE_CLASSES,
  "not-open:backdrop:duration-(--duration-fast) not-open:backdrop:ease-(--ease-exit)",
);

const DIALOG_SURFACE_CLASSES = cn(
  "m-auto overflow-y-auto rounded-card p-0 text-text-primary shadow-lg",
  "border-(length:--border-width-thin) border-border-default bg-surface-raised",
);

/** The classes of the element of C27. */
export function dialogClasses(size: DialogSize): string {
  return cn(
    DIALOG_SURFACE_CLASSES,
    DIALOG_SIZE_CLASSES[size],
    DIALOG_MOTION_CLASSES,
    DIALOG_BACKDROP_CLASSES,
  );
}

/** What the dialog holds: 32 px of padding (24 on a phone), 16 between the title, the content and the actions. */
export const DIALOG_BODY_CLASSES = "flex flex-col gap-4 p-5 md:p-6";

/** The title: the focus lands on it when nothing asked for it, it is no control and draws no ring of its own. */
export const DIALOG_TITLE_CLASSES =
  "font-display text-title-section font-bold tracking-heading focus:outline-hidden";

/** The content under the title. */
export const DIALOG_CONTENT_CLASSES = "flex flex-col gap-3 text-md";

/** The actions: on one line, to the right, they wrap under a narrow width. */
export const DIALOG_ACTIONS_CLASSES =
  "flex flex-wrap items-center justify-end gap-3";

/**
 * The dialog of the filters (C28): 42 rem wide and 85 % of the height at most, laid out as a column whose head and
 * foot stay and whose body scrolls; below 768 px it is the whole screen, without corners or frame.
 */
export function filtersDialogClasses(): string {
  return cn(
    DIALOG_SURFACE_CLASSES,
    "w-(--container-filters) max-h-(--size-overlay-max) open:flex open:flex-col",
    "max-md:h-dvh max-md:max-h-dvh max-md:w-screen max-md:max-w-screen max-md:rounded-none",
    DIALOG_MOTION_CLASSES,
    DIALOG_BACKDROP_CLASSES,
  );
}

const FILTERS_BAND_CLASSES =
  "flex shrink-0 items-center justify-between gap-3 px-5 py-3";

/** The head: the cross, the title in the middle, a spacer as wide as the cross so that the title stays centred. */
export const FILTERS_HEAD_CLASSES = cn(
  FILTERS_BAND_CLASSES,
  "border-b-(length:--border-width-thin) border-border-default",
);

/** The foot: « Tout effacer » to the left, the action that applies to the right. */
export const FILTERS_FOOT_CLASSES = cn(
  FILTERS_BAND_CLASSES,
  "border-t-(length:--border-width-thin) border-border-default",
);

export const FILTERS_TITLE_CLASSES =
  "text-center font-display text-md font-bold leading-snug focus:outline-hidden";

export const FILTERS_SPACER_CLASSES = "w-(--size-touch-target) shrink-0";

/** The body scrolls, 24 px of padding, a hairline between the groups (the first has none). */
export const FILTERS_BODY_CLASSES =
  "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5";

/** One group of criteria: a filet above it and 16 px under the filet, but the first group touches the top. */
export const FILTERS_GROUP_CLASSES =
  "flex flex-col gap-2 border-t-(length:--border-width-thin) border-border-default pt-4 first-of-type:border-t-0 first-of-type:pt-0";
