// Classes of the list of reasons (C36; docs/mvp/22-refonte-ux-ui/02b C36): an icon of 24 px, a title and its
// sentence, 16 px between the icon and the words; 24 px between two reasons, or 16 px. The gaps are the bare keys of
// their object (TK7.2).
import { cn } from "@/components/ui/class-names";

const REASON_GAP_CLASSES = {
  md: "gap-4",
  lg: "gap-5",
};

export type ReasonListGap = keyof typeof REASON_GAP_CLASSES;

export function reasonListClasses(gap: ReasonListGap): string {
  return cn("flex flex-col", REASON_GAP_CLASSES[gap]);
}

export const REASON_CLASSES =
  "grid grid-cols-[var(--size-icon-lg)_minmax(0,1fr)] gap-4";

export const REASON_ICON_CLASSES = "size-(--size-icon-lg) text-text-secondary";

export const REASON_TITLE_CLASSES = "font-semibold";

export const REASON_BODY_CLASSES = "text-sm text-text-secondary";
