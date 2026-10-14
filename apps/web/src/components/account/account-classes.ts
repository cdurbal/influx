// Token-only classes of the "mon compte" screens (docs/mvp/17 §6), beside those of the journey
// (src/components/auth/auth-classes.ts) they share. Members' register, dark theme, mobile first
// (skill design-system-influx); every value is a token of src/styles/tokens.css (CA22, G3).
import { cn } from "@/components/ui/class-names";
import { BUTTON_BASE_CLASSES, SIZE_CLASSES } from "@/components/ui/Button";

/** The navigation of "mon compte": wraps on a narrow screen, never scrolls sideways (17 §6.7). */
export const NAV_LIST_CLASSES = "flex flex-wrap gap-2";

export function navLinkClasses(isCurrent: boolean): string {
  return cn(
    "inline-flex min-h-(--size-touch-target) items-center rounded-pill px-3 text-sm font-medium",
    "border-(length:--border-width-thin)",
    isCurrent
      ? "border-border-selected bg-surface-brand-subtle text-text-primary"
      : "border-border-strong text-text-secondary hover:bg-action-secondary-bg-hover",
  );
}

/**
 * A destructive action: its label says what it does (17 §6.3, never an icon alone); the error
 * family marks it, the text carries the meaning.
 */
export const DESTRUCTIVE_BUTTON_CLASSES = cn(
  BUTTON_BASE_CLASSES,
  SIZE_CLASSES.md,
  "rounded-pill border-(length:--border-width-thick) border-feedback-error-border bg-feedback-error-bg",
  "px-inset-button-x py-inset-button-y text-feedback-error-text hover:bg-surface-hover",
);

/** A success: teal, a family distinct from the brand green (skill design-system-influx). */
export const SUCCESS_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-feedback-success-border",
  "bg-feedback-success-bg px-4 py-3 text-sm text-feedback-success-text",
);

/** "Cet appareil": a tag in words, never a color alone (WCAG AA). */
export const TAG_CLASSES = cn(
  "inline-flex items-center self-start rounded-pill px-3 py-1 text-xs font-semibold",
  "border-(length:--border-width-thin) border-border-selected text-text-primary",
);

/** The two lists of the deletion, side by side from md, of the same weight (17 §6.3). */
export const TWO_LISTS_CLASSES = "grid gap-4 md:grid-cols-2";

export const LIST_CLASSES =
  "flex list-disc flex-col gap-2 pl-5 text-md text-text-primary";

/** A line of facts under a title (dates, status). */
export const META_CLASSES = "text-sm text-text-secondary";

export const SECTION_TITLE_CLASSES =
  "text-heading-3 font-bold text-text-primary";

/** Actions side by side when they fit, stacked otherwise; labels wrap, never truncated. */
export const ACTIONS_CLASSES = "flex flex-wrap items-center gap-3";

/** A link inside a text: underlined, so that it is not told by its color alone. */
export const INLINE_LINK_CLASSES =
  "font-medium text-text-primary underline underline-offset-2 hover:text-text-brand";
