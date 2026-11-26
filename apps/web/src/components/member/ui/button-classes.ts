// Classes of the buttons of the connected spaces (docs/mvp/20 §11.8), the KEO pills. Every value is
// a token of src/styles/tokens.css. A link styled as a button takes the same classes, so that a
// link and a button of the same variant render alike. The hover zoom (F6) and the press (RK-2) are
// under `motion-safe:` and off on an `aria-disabled` button, and the text button has neither; the
// transition names its properties, never `all`. The variants and the sizes are the keys of their
// objects, not quoted strings, so that no variant word is read as a class (TK7.2, RUB-02).
import { cn } from "@/components/ui/class-names";
import { TOUCH_ZONE_HEIGHT_CLASSES } from "./touch-zone-classes";

export const BUTTON_BASE_CLASSES = cn(
  "inline-flex items-center gap-2 text-md font-display leading-snug",
  "transition-lift",
  "aria-disabled:cursor-not-allowed aria-disabled:bg-action-disabled-bg aria-disabled:text-text-disabled",
);

/** A button centres its label; a link with the look of a text button does not (L2AU-3). */
const BUTTON_CENTRED_CLASSES = "justify-center text-center";

const BUTTON_ZOOM_CLASSES = cn(
  "motion-safe:not-aria-disabled:hover:scale-(--scale-hover)",
  "motion-safe:not-aria-disabled:active:scale-(--scale-press)",
);

export const BUTTON_VARIANT_CLASSES = {
  primary: cn(
    "rounded-pill bg-action-primary-bg font-action text-text-on-action shadow-(--effect-action-glow)",
    "hover:bg-action-primary-bg-hover active:bg-action-primary-bg-active",
    "not-aria-disabled:hover:shadow-(--effect-action-glow-hover) aria-disabled:shadow-none",
  ),
  secondary: cn(
    "rounded-pill border-(length:--border-width-action-secondary) bg-action-secondary-bg",
    "font-action-secondary text-text-primary",
    "hover:bg-action-secondary-bg-hover active:bg-action-secondary-bg-active",
    "aria-disabled:border-transparent",
  ),
  danger: cn(
    "rounded-pill bg-action-danger-bg font-action text-text-on-danger",
    "hover:bg-action-danger-bg-hover active:bg-action-danger-bg-active",
  ),
  text: cn(
    "min-h-(--size-touch-target) rounded-md bg-transparent px-3 font-action-secondary text-text-primary",
    "hover:bg-action-secondary-bg-hover aria-disabled:bg-transparent",
  ),
};

export type ButtonVariant = keyof typeof BUTTON_VARIANT_CLASSES;

/**
 * The contour of the secondary button: `border-strong` at rest, a lighter one on hover; once added
 * (R04 line 16) it is calmed to `border-default` at rest, the hover unchanged.
 */
const SECONDARY_BORDER_CLASSES =
  "border-action-secondary-border hover:border-action-secondary-border-hover";
const SECONDARY_ADDED_BORDER_CLASSES =
  "border-border-default hover:border-action-secondary-border-hover";

/**
 * The height and the padding of each size (02a C10): 44 and 52 px by their padding, 36 and 40 px
 * (`sm`, `bar`) by their height alone and 0 px of vertical padding, their touch zone reaching 44 px
 * (RUB-B §3). `size-tag` and `size-pill` are the 36 and the 40 px of the tokens (03 §8).
 */
export const BUTTON_SIZE_CLASSES = {
  sm: cn(
    "min-h-(--size-tag) px-inset-button-x py-0",
    TOUCH_ZONE_HEIGHT_CLASSES,
  ),
  bar: cn(
    "min-h-(--size-pill) px-inset-button-x py-0",
    TOUCH_ZONE_HEIGHT_CLASSES,
  ),
  md: "min-h-(--size-button-md) px-inset-button-x py-inset-button-y",
  lg: "min-h-(--size-button-lg) px-inset-button-x py-inset-button-y",
};

export type ButtonSize = keyof typeof BUTTON_SIZE_CLASSES;

/** The classes of a button or of a link that looks like one; the text button has a size of its own. */
export function buttonClasses(
  variant: ButtonVariant,
  size: ButtonSize = "md",
  added = false,
): string {
  return cn(
    BUTTON_BASE_CLASSES,
    BUTTON_CENTRED_CLASSES,
    BUTTON_VARIANT_CLASSES[variant],
    variant === "secondary" &&
      (added ? SECONDARY_ADDED_BORDER_CLASSES : SECONDARY_BORDER_CLASSES),
    variant !== "text" && BUTTON_ZOOM_CLASSES,
    variant !== "text" && BUTTON_SIZE_CLASSES[size],
  );
}

/**
 * A link with the look of a text button (20 §11.8, L2AU-3): underlined, so that it is never told
 * by its weight alone (WCAG 1.4.1), its text aligned to the left; the weight of 600 is kept (TK1.3).
 */
export function memberTextLinkClasses(): string {
  return cn(
    BUTTON_BASE_CLASSES,
    BUTTON_VARIANT_CLASSES.text,
    "justify-start text-left underline",
  );
}

/** The two layers of a label that changes while the button is busy: one cell, the wider sets the width. */
export const BUTTON_LABEL_STACK_CLASSES = "grid";
export const BUTTON_LABEL_LAYER_CLASSES = "col-start-1 row-start-1";

/** The icon of the added state: a fade, instant under reduced motion (R04 line 16). */
export const BUTTON_ADDED_ICON_CLASSES =
  "size-(--size-icon-sm) shrink-0 animate-fade-in";

export const BUTTON_ICON_CLASSES = "inline-flex shrink-0";
