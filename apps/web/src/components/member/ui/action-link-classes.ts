// Classes of the link of action (C11; docs/mvp/22-refonte-ux-ui/02a §3): a link alone on its line,
// never a link inside a sentence. The variants are the keys of their object, not quoted strings
// (TK7.2). `inline` is underlined at rest (L2AT-2, WCAG 1.4.1); `go` carries a chevron that nudges
// 2 px on hover under `motion-safe:` and is underlined on hover; `save` is a heart and an underlined
// label, filled when pressed (a shape, never the colour alone).
import { cn } from "@/components/ui/class-names";
import { TOUCH_ZONE_CLASSES } from "./touch-zone-classes";

const ACTION_LINK_BASE_CLASSES = cn(
  "group inline-flex items-center rounded-md font-action-secondary text-text-primary",
  "transition-lift",
  TOUCH_ZONE_CLASSES,
);

const ACTION_LINK_UNDERLINE_CLASSES =
  "underline underline-offset-(--offset-link)";

const ACTION_LINK_VARIANT_CLASSES = {
  inline: cn("gap-1 hover:text-text-brand", ACTION_LINK_UNDERLINE_CLASSES),
  go: "gap-1 min-h-(--size-touch-target) hover:underline hover:underline-offset-(--offset-link)",
  save: cn("gap-2", ACTION_LINK_UNDERLINE_CLASSES),
};

export type ActionLinkVariant = keyof typeof ACTION_LINK_VARIANT_CLASSES;

/** The classes of the link or button of action; `dense` sets its text at 14 px instead of 16. */
export function actionLinkClasses(
  variant: ActionLinkVariant,
  dense: boolean,
): string {
  return cn(
    ACTION_LINK_BASE_CLASSES,
    ACTION_LINK_VARIANT_CLASSES[variant],
    dense ? "text-sm" : "text-md",
  );
}

/** The chevron of a `go`: 16 px when dense, 20 px otherwise, 2 px to the right on hover, motion allowed. */
export function actionLinkChevronClasses(dense: boolean): string {
  return cn(
    "shrink-0 transition-lift motion-safe:group-hover:translate-x-(--size-nudge)",
    dense ? "size-(--size-icon-sm)" : "size-(--size-icon-md)",
  );
}

/** The heart of a `save`: 16 px, filled while the toggle is pressed. */
export const ACTION_LINK_HEART_CLASSES =
  "size-(--size-icon-sm) shrink-0 group-aria-pressed:fill-current";
