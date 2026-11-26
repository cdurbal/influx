// Classes of the tag picker (C23; docs/mvp/22-refonte-ux-ui/02a C23, RUB-B §3): the select that adds and the tags
// that were chosen, a tag of 36 px in 14 px with its cross. The cross is drawn 24 px wide and reaches 44 × 44 px by
// a transparent pseudo-element (the ring stays on the drawn cross, no zone overlaps another: the tags are spaced
// by their gap). The choice select is 13 rem wide at least and 20 at most.
import { cn } from "@/components/ui/class-names";
import { memberControlClasses } from "./field-classes";
import { TOUCH_ZONE_CLASSES } from "./touch-zone-classes";

/** The list of the tags: they wrap, 8 px apart. */
export const TAG_LIST_CLASSES = "flex flex-wrap gap-2";

/** One tag: a pill of 36 px, the label then the cross, the cross close to the edge. */
export const TAG_CLASSES =
  "inline-flex min-h-(--size-tag) items-center gap-1 rounded-pill border-(length:--border-width-thin) border-border-strong bg-surface-raised pl-3 pr-1 text-sm text-text-primary";

/** The cross of a tag: 24 px drawn, 44 × 44 px of zone; the ring is the one of the system on the drawn cross. */
export const TAG_REMOVE_CLASSES = cn(
  "inline-flex size-5 shrink-0 items-center justify-center rounded-pill text-text-secondary",
  "transition-colors hover:bg-action-secondary-bg-hover hover:text-text-primary",
  "aria-disabled:cursor-not-allowed aria-disabled:text-text-disabled",
  TOUCH_ZONE_CLASSES,
);

export const TAG_REMOVE_ICON_CLASSES = "size-(--size-icon-sm)";

/** The select that adds: the control of a field, 13 rem wide at least and 20 at most (a tag list is not a full line). */
export function tagPickerSelectClasses(hasError: boolean): string {
  return cn(
    memberControlClasses(hasError),
    "min-w-(--size-select-add) max-w-(--size-select-add-max)",
  );
}
