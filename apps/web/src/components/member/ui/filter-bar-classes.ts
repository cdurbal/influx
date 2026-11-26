// Classes of the filter bar (C30; docs/mvp/22-refonte-ux-ui/02a C30, R04 line 6, RUB-B §5 PT4): pills of 40 px (36 in
// the backoffice) in 14 px, 16 px of padding on each side (12 in the backoffice), a contour of `border-default`; the
// active one takes the contour of `text-primary`, the ground `surface-active` and the weight 600, so the state never
// rests on a colour alone. The contour and the ground change over 120 ms, instantly under reduced motion. The members'
// bar is one line that scrolls sideways, the backoffice's wraps. The shell of a pill holds the control; a control
// that retires the criterion (the cross) is its own button, 24 px drawn and 44 × 44 px of zone. The densities are the
// keys of their objects, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";
import {
  TOUCH_ZONE_CLASSES,
  TOUCH_ZONE_HEIGHT_CLASSES,
} from "./touch-zone-classes";

/** The bar: members on one scrolling line, the backoffice wrapping. */
const FILTER_BAR_CLASSES = {
  md: "-mx-2 -my-2 flex items-center gap-2 overflow-x-auto px-2 py-2 scrollbar-none",
  bo: "flex flex-wrap items-center gap-2",
};

export type FilterBarDensity = keyof typeof FILTER_BAR_CLASSES;

export function filterBarClasses(density: FilterBarDensity): string {
  return FILTER_BAR_CLASSES[density];
}

/** The height and the padding of a density. */
const PILL_DENSITY_CLASSES = {
  md: "min-h-(--size-pill)",
  bo: "min-h-(--size-tag)",
};

const PILL_PADDING_CLASSES = {
  md: "px-4",
  bo: "px-3",
};

/** The shell of a pill: the line, the ground and the state. A pill is always a shell around its controls. */
export function filterPillClasses(
  density: FilterBarDensity,
  active: boolean,
): string {
  return cn(
    "inline-flex shrink-0 items-center whitespace-nowrap rounded-pill text-sm text-text-primary",
    "border-(length:--border-width-thin) transition-colors",
    PILL_DENSITY_CLASSES[density],
    active
      ? "border-text-primary bg-surface-active font-semibold"
      : "border-border-default bg-surface-page font-regular hover:border-border-hover",
  );
}

/** The control that takes the pill: a button whose whole width is the pill, its zone reaching 44 px in height. */
export function filterPillControlClasses(density: FilterBarDensity): string {
  return cn(
    "inline-flex flex-1 items-center gap-2 self-stretch rounded-pill bg-transparent",
    PILL_PADDING_CLASSES[density],
    TOUCH_ZONE_HEIGHT_CLASSES,
  );
}

/** The label of a pill that is no control (a criterion that only offers its cross). */
export function filterPillStaticClasses(density: FilterBarDensity): string {
  return cn("inline-flex items-center gap-2", PILL_PADDING_CLASSES[density]);
}

/** The icons of a pill: 16 px; the chevron of a pill with a menu turns over when it is open. */
export const FILTER_PILL_ICON_CLASSES = "size-(--size-icon-sm) shrink-0";

export const FILTER_PILL_CHEVRON_CLASSES = cn(
  FILTER_PILL_ICON_CLASSES,
  "text-text-secondary transition-transform ease-(--ease-standard) duration-(--duration-fast)",
);

export const FILTER_PILL_CHEVRON_OPEN_CLASSES = "rotate-180";

/** The cross that retires the criterion: 24 px drawn, 44 × 44 px of zone, 8 px from the edge of the pill. */
export const FILTER_PILL_CLEAR_CLASSES = cn(
  "mr-2 inline-flex size-6 shrink-0 items-center justify-center rounded-pill text-text-secondary",
  "transition-colors hover:bg-surface-hover hover:text-text-primary",
  TOUCH_ZONE_CLASSES,
);

/** The label of a pill with a cross is followed by it: less room on its right. */
export const FILTER_PILL_BEFORE_CLEAR_CLASSES = "pr-2";

/** The hairline between the button of the filters and the criteria: 1 px by 24 px. */
export const FILTER_BAR_SEPARATOR_CLASSES =
  "mx-1 h-6 w-(--border-width-thin) shrink-0 bg-border-default";

/** The search of the backoffice: a pill field of 15 rem. */
export function filterSearchClasses(density: FilterBarDensity): string {
  return cn(
    "w-(--size-search) shrink-0 rounded-pill bg-surface-page text-sm text-text-primary",
    "border-(length:--border-width-thin) border-border-default placeholder:text-text-secondary",
    PILL_DENSITY_CLASSES[density],
    PILL_PADDING_CLASSES[density],
  );
}

/** The inline select: no contour, the value in 600, the chevron on its right (it stays a select). */
export const FILTER_SELECT_WRAPPER_CLASSES =
  "relative inline-flex shrink-0 items-center";

export const FILTER_SELECT_CLASSES =
  "cursor-pointer appearance-none rounded-sm border-0 bg-transparent py-1 pl-1 pr-6 text-sm font-semibold text-text-primary";

export const FILTER_SELECT_ICON_CLASSES =
  "pointer-events-none absolute right-1 size-(--size-icon-sm) text-text-secondary";
