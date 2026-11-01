// Classes of the buttons of the connected spaces (docs/mvp/20 §11.8), the KEO pills. Every value is
// a token of src/styles/tokens.css. A link styled as a button takes the same classes, so that a
// link and a button of the same variant render alike. The hover zoom (F6) and the press (RK-2) are
// under `motion-safe:` and off on an `aria-disabled` button, and the text button has neither; the
// transition names its properties, never `all`.
import { cn } from "@/components/ui/class-names";

export type MemberButtonVariant = "primary" | "secondary" | "danger" | "text";

export type MemberButtonSize = "md" | "lg";

export const MEMBER_BUTTON_BASE_CLASSES = cn(
  "inline-flex items-center gap-2 text-md font-display leading-snug",
  "transition-lift",
  "aria-disabled:cursor-not-allowed aria-disabled:bg-action-disabled-bg aria-disabled:text-text-disabled",
);

/** A button centres its label; a link with the look of a text button does not (L2AU-3). */
const MEMBER_BUTTON_CENTRED_CLASSES = "justify-center text-center";

const MEMBER_BUTTON_ZOOM_CLASSES = cn(
  "motion-safe:not-aria-disabled:hover:scale-(--scale-hover)",
  "motion-safe:not-aria-disabled:active:scale-(--scale-press)",
);

export const MEMBER_BUTTON_VARIANT_CLASSES: Record<
  MemberButtonVariant,
  string
> = {
  primary: cn(
    "rounded-pill bg-action-primary-bg px-inset-button-x py-inset-button-y font-action text-text-on-action shadow-(--effect-action-glow)",
    "hover:bg-action-primary-bg-hover active:bg-action-primary-bg-active",
    "not-aria-disabled:hover:shadow-(--effect-action-glow-hover) aria-disabled:shadow-none",
  ),
  secondary: cn(
    "rounded-pill border-(length:--border-width-action-secondary) border-action-secondary-border bg-action-secondary-bg",
    "px-inset-button-x py-inset-button-y font-action-secondary text-text-primary",
    "hover:border-action-secondary-border-hover hover:bg-action-secondary-bg-hover active:bg-action-secondary-bg-active",
    "aria-disabled:border-transparent",
  ),
  danger: cn(
    "rounded-pill bg-action-danger-bg px-inset-button-x py-inset-button-y font-action text-text-on-danger",
    "hover:bg-action-danger-bg-hover active:bg-action-danger-bg-active",
  ),
  text: cn(
    "min-h-(--size-touch-target) rounded-md bg-transparent px-3 font-action-secondary text-text-primary",
    "hover:bg-action-secondary-bg-hover aria-disabled:bg-transparent",
  ),
};

export const MEMBER_BUTTON_SIZE_CLASSES: Record<MemberButtonSize, string> = {
  md: "min-h-(--size-button-md)",
  lg: "min-h-(--size-button-lg)",
};

/** The classes of a button or of a link that looks like one; the text button has a size of its own. */
export function memberButtonClasses(
  variant: MemberButtonVariant,
  size: MemberButtonSize = "md",
): string {
  return cn(
    MEMBER_BUTTON_BASE_CLASSES,
    MEMBER_BUTTON_CENTRED_CLASSES,
    MEMBER_BUTTON_VARIANT_CLASSES[variant],
    variant !== "text" && MEMBER_BUTTON_ZOOM_CLASSES,
    variant !== "text" && MEMBER_BUTTON_SIZE_CLASSES[size],
  );
}

/**
 * A link with the look of a text button (20 §11.8, L2AU-3): underlined, so that it is never told
 * by its weight alone (WCAG 1.4.1), its text aligned to the left; the weight of 600 is kept (TK1.3).
 */
export function memberTextLinkClasses(): string {
  return cn(
    MEMBER_BUTTON_BASE_CLASSES,
    MEMBER_BUTTON_VARIANT_CLASSES.text,
    "justify-start text-left underline",
  );
}
