// Classes of the disclosure (C26; docs/mvp/22-refonte-ux-ui/02a C26, R04 lines 19 and 20): the native `details`, its
// summary a line of 44 px, its chevron of 20 px. The chevron turns a quarter (right to down) or a half (down to up,
// the panel of the rare gestures, 120 ms instead of 200) over the curve `standard`, instantly under reduced motion;
// the content rises in over 200 ms. Only the rotation and the opacity move, never a height (AN-4). The variants
// are the keys of their objects, not quoted strings (TK7.2).
import { cn } from "@/components/ui/class-names";

/** The `details`: the group that its parts read their open state from. */
export const DISCLOSURE_CLASSES = "group flex flex-col";

/**
 * The summary of a variant. `danger` is read in the text of an error (the gesture it opens is destructive, said in
 * words as well); `optional` and `rare` are quieter than a fold.
 */
const DISCLOSURE_SUMMARY_CLASSES = {
  optional: "font-regular text-text-secondary",
  fold: "font-semibold text-text-primary",
  danger: "font-semibold text-feedback-error-text",
  rare: "font-semibold text-text-secondary",
  group: "font-semibold text-text-primary",
  change: "font-semibold text-text-primary",
};

export type DisclosureVariant = keyof typeof DISCLOSURE_SUMMARY_CLASSES;

/** The summary: a line of 44 px to touch, the whole line is the control, the ring of the system around it. */
export function disclosureSummaryClasses(variant: DisclosureVariant): string {
  return cn(
    "flex min-h-(--size-touch-target) cursor-pointer items-center gap-2 rounded-md text-md",
    DISCLOSURE_SUMMARY_CLASSES[variant],
  );
}

const DISCLOSURE_CHEVRON_BASE_CLASSES =
  "size-(--size-icon-md) shrink-0 text-text-secondary transition-transform ease-(--ease-standard)";

/** A right chevron turns to the down position when it opens: 90 degrees over 200 ms. */
export const DISCLOSURE_CHEVRON_CLASSES = cn(
  DISCLOSURE_CHEVRON_BASE_CLASSES,
  "duration-(--duration-base) group-open:rotate-90",
);

/** The chevron of the panel of the rare gestures points down at rest and turns over: 180 degrees over 120 ms. */
export const DISCLOSURE_CHEVRON_DOWN_CLASSES = cn(
  DISCLOSURE_CHEVRON_BASE_CLASSES,
  "duration-(--duration-fast) group-open:rotate-180",
);

/** The text of the summary takes the room the chevron and the count leave. */
export const DISCLOSURE_LABEL_CLASSES = "min-w-0 flex-1";

/** The count of a group: a number read after the summary, in secondary text. */
export const DISCLOSURE_COUNT_CLASSES =
  "shrink-0 text-sm font-regular tabular-nums text-text-secondary";

const DISCLOSURE_PANEL_CLASSES = {
  optional: "flex flex-col",
  fold: "flex flex-col",
  danger: "flex flex-col",
  rare: "flex flex-col gap-2",
  group: "flex flex-col",
  change: "flex flex-col",
};

/** The content enters by `rise-in` over 200 ms; the panel of the rare gestures is a pile of gestures, 8 px apart. */
export function disclosurePanelClasses(variant: DisclosureVariant): string {
  return cn("animate-rise-in pb-2 pt-1", DISCLOSURE_PANEL_CLASSES[variant]);
}
