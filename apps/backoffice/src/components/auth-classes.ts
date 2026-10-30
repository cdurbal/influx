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

/** The standalone head of a page: INFLUX, a step line when there is one, then the glow of F6. */
export const AUTH_HEAD_CLASSES = "relative isolate flex flex-col gap-3 py-4";

/** Decorative, valued under KEO only (20 §11.5); behind the title, never over a control. */
export const AUTH_GLOW_CLASSES =
  "pointer-events-none absolute inset-0 z-(--z-behind) bg-header-glow";

export const BRAND_CLASSES =
  "font-display text-md font-bold tracking-heading text-text-primary";

export const TITLE_CLASSES = cn(
  "font-display text-title-page font-extrabold tracking-heading text-text-primary",
);

/** The `h2` of a card of the standalone pages: as the members' card title (D75 RK-5). */
export const CARD_TITLE =
  "font-display text-md font-bold leading-snug text-text-primary";

export const LEAD_CLASSES = "text-md text-text-secondary";

export const CARD_CLASSES = cn(
  "flex flex-col gap-4 rounded-card border-(length:--border-width-thin) border-border-default",
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

/** The KEO pill: the hover zoom (F6) and the press (RK-2) under `motion-safe:` and off when disabled; never `transition-all`. */
const BUTTON_BASE_CLASSES = cn(
  "inline-flex items-center justify-center gap-2 text-center font-display text-md leading-snug",
  "transition-lift motion-safe:not-aria-disabled:not-disabled:hover:scale-(--scale-hover)",
  "motion-safe:not-aria-disabled:not-disabled:active:scale-(--scale-press)",
  "aria-disabled:cursor-not-allowed disabled:cursor-not-allowed",
);

export const PRIMARY_BUTTON_CLASSES = cn(
  BUTTON_BASE_CLASSES,
  "min-h-(--size-button-lg) w-full rounded-pill",
  "bg-action-primary-bg px-inset-button-x py-inset-button-y font-action text-text-on-action shadow-(--effect-action-glow)",
  "not-aria-disabled:not-disabled:hover:bg-action-primary-bg-hover",
  "not-aria-disabled:not-disabled:active:bg-action-primary-bg-active",
  "not-aria-disabled:not-disabled:hover:shadow-(--effect-action-glow-hover)",
  "aria-disabled:bg-action-disabled-bg aria-disabled:text-text-disabled aria-disabled:shadow-none",
  "disabled:bg-action-disabled-bg disabled:text-text-disabled disabled:shadow-none",
);

export const SECONDARY_BUTTON_CLASSES = cn(
  BUTTON_BASE_CLASSES,
  "min-h-(--size-button-md) rounded-pill",
  "border-(length:--border-width-action-secondary) border-action-secondary-border bg-action-secondary-bg",
  "px-inset-button-x py-inset-button-y font-action-secondary text-text-primary",
  "not-aria-disabled:not-disabled:hover:border-action-secondary-border-hover",
  "not-aria-disabled:not-disabled:hover:bg-action-secondary-bg-hover",
  "not-aria-disabled:not-disabled:active:bg-action-secondary-bg-active",
  "aria-disabled:border-transparent aria-disabled:bg-action-disabled-bg aria-disabled:text-text-disabled",
  "disabled:border-transparent disabled:bg-action-disabled-bg disabled:text-text-disabled",
);

export const TEXT_BUTTON_CLASSES = cn(
  "inline-flex min-h-(--size-touch-target) items-center self-start rounded-md px-3",
  "font-action-secondary text-text-primary underline",
  "not-aria-disabled:not-disabled:hover:bg-action-secondary-bg-hover",
  "aria-disabled:cursor-not-allowed aria-disabled:text-text-disabled",
  "disabled:cursor-not-allowed disabled:text-text-disabled",
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
