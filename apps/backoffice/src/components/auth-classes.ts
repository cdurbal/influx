// Token-only classes of the backoffice sign-in and empty home (docs/mvp/17b §3.14). Dark theme,
// workstation register, but the sign-in keeps touch-sized fields (D58: the same screen on a phone).
// Every value is a token of src/styles/tokens.css (CA22, G3).

/** Joins class names and skips falsy values (same helper as apps/web, for the Tailwind lint). */
export function cn(
  ...classes: ReadonlyArray<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

export const SCREEN_CLASSES = cn(
  "mx-auto flex min-h-screen w-full max-w-(--container-narrow) flex-col gap-6",
  "px-page-gutter py-section-header",
);

export const BRAND_CLASSES = "text-md font-bold text-text-primary";

export const TITLE_CLASSES = "text-heading-3 font-bold text-text-primary";

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

export const PRIMARY_BUTTON_CLASSES = cn(
  "inline-flex min-h-(--size-button-lg) w-full items-center justify-center rounded-pill",
  "bg-action-primary-bg px-inset-button-x py-inset-button-y font-medium text-text-on-action",
  "hover:bg-action-primary-bg-hover active:bg-action-primary-bg-active",
);

export const SECONDARY_BUTTON_CLASSES = cn(
  "inline-flex min-h-(--size-button-md) items-center justify-center rounded-pill",
  "border-(length:--border-width-thick) border-action-secondary-border bg-action-secondary-bg",
  "px-inset-button-x py-inset-button-y font-medium text-text-primary",
  "hover:bg-action-secondary-bg-hover",
);

export const TEXT_BUTTON_CLASSES = cn(
  "inline-flex min-h-(--size-touch-target) items-center self-start rounded-md px-3",
  "text-text-primary underline hover:bg-action-secondary-bg-hover",
);

/** Errors carry border, text and role="alert", never the color alone. */
export const ERROR_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-feedback-error-border",
  "bg-feedback-error-bg px-4 py-3 text-sm text-feedback-error-text",
);

export const INFO_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-feedback-info-border",
  "bg-feedback-info-bg px-4 py-3 text-sm text-text-primary",
);

export const HELP_CLASSES = "text-sm text-text-secondary";

/** The secret and the recovery codes: monospaced, selectable, tabular. */
export const CODE_TEXT_CLASSES = "font-mono tabular-nums text-text-primary";

/** The recovery-session banner: border and text carry the state, not the color alone. */
export const WARNING_CLASSES = cn(
  "rounded-md border-(length:--border-width-thick) border-feedback-warning-border",
  "bg-feedback-warning-bg px-4 py-3 text-sm text-feedback-warning-text",
);
