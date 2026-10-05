// Token-only classes of the member sign-in screens and empty homes (docs/mvp/17 §3.6, §3.7). Dark
// theme, one decision per screen on mobile (skill design-system-influx). Every value is a token
// of src/styles/tokens.css; nothing here is a literal color, size or spacing (CA22, G3).
import { cn } from "@/components/ui/class-names";
import {
  BUTTON_BASE_CLASSES,
  SIZE_CLASSES,
  VARIANT_CLASSES,
} from "@/components/ui/Button";

/** One centred column of `container-narrow`, mobile first. */
export const SCREEN_CLASSES = cn(
  "mx-auto flex min-h-screen w-full max-w-(--container-narrow) flex-col gap-6",
  "px-page-gutter py-section-header",
);

export const BRAND_CLASSES = "text-md font-bold text-text-primary";

export const TITLE_CLASSES = "text-heading-2 font-bold text-text-primary";

export const LEAD_CLASSES = "text-md text-text-secondary";

export const CARD_CLASSES = cn(
  "flex flex-col gap-4 rounded-lg border-(length:--border-width-thin) border-border-default",
  "bg-surface-card p-inset-card",
);

export const LABEL_CLASSES = "font-semibold text-text-primary";

export function inputClasses(hasError: boolean): string {
  return cn(
    "h-(--size-input) w-full rounded-md bg-surface-page px-4 text-md text-text-primary",
    hasError
      ? "border-(length:--border-width-thick) border-border-error"
      : "border-(length:--border-width-thin) border-border-strong",
  );
}

/** The code field: one logical input, tabular digits (17 §3.2). */
export function codeInputClasses(hasError: boolean): string {
  return cn(inputClasses(hasError), "tabular-nums tracking-overline");
}

/** A submit button that looks like the primary button of the landing. */
export const PRIMARY_SUBMIT_CLASSES = cn(
  BUTTON_BASE_CLASSES,
  VARIANT_CLASSES.primary,
  SIZE_CLASSES.lg,
  "w-full",
);

export const SECONDARY_BUTTON_CLASSES = cn(
  BUTTON_BASE_CLASSES,
  VARIANT_CLASSES.secondary,
  SIZE_CLASSES.md,
);

export const TEXT_BUTTON_CLASSES = cn(
  BUTTON_BASE_CLASSES,
  VARIANT_CLASSES.text,
  "self-start",
);

/** An error: border, text and role="alert", never the color alone (17 §3.6). */
export const ERROR_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-feedback-error-border",
  "bg-feedback-error-bg px-4 py-3 text-sm text-feedback-error-text",
);

export const INFO_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-feedback-info-border",
  "bg-feedback-info-bg px-4 py-3 text-sm text-text-primary",
);

export const HELP_CLASSES = "text-sm text-text-secondary";
