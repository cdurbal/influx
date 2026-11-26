// Classes of the list of chips (docs/mvp/22-refonte-ux-ui/02b C38): not interactive, so nothing of a
// button or a field: a pill of 32 px with a thin contour, 0 × 12, 14 px, 8 px between the chips.
import { cn } from "@/components/ui/class-names";

export const CHIP_LIST_CLASSES = "flex flex-wrap gap-2";

export const CHIP_CLASSES = cn(
  "inline-flex min-h-(--size-chip) items-center rounded-pill px-3",
  "border-(length:--border-width-thin) border-border-default text-sm text-text-primary",
);
