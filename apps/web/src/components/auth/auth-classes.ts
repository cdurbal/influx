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

/** The header of the journey: the brand, then the language of the page (17 §3.1). */
export const HEADER_CLASSES = "flex items-center justify-between gap-4";

export const LANGUAGE_LINK_CLASSES = cn(
  "inline-flex min-h-(--size-touch-target) items-center rounded-pill px-3",
  "border-(length:--border-width-thin) border-border-strong text-sm font-medium text-text-primary",
  "hover:bg-action-secondary-bg-hover",
);

/** "Step 2 of 3", announced with the title (17 §3.6). */
export const PROGRESS_CLASSES = "text-sm font-medium text-text-secondary";

/** The offline banner: text, never a color alone (17 §3.5). */
export const WARNING_CLASSES = cn(
  "rounded-md border-(length:--border-width-thin) border-feedback-warning-border",
  "bg-feedback-warning-bg px-4 py-3 text-sm text-feedback-warning-text",
);

/** One field and its texts: label, control, help, error. */
export const FIELD_CLASSES = "flex flex-col gap-2";

export const FIELDSET_CLASSES = "flex flex-col gap-2";

/** A checkbox or a radio whose whole label is the click zone (17 §3.6). */
export const CHOICE_ROW_CLASSES =
  "flex min-h-(--size-touch-target) cursor-pointer items-start gap-3 py-2 text-md text-text-primary";

export const CHOICE_INPUT_CLASSES =
  "mt-1 size-(--size-checkbox) shrink-0 cursor-pointer accent-action-primary-bg";

/** The rule between the terms and the consent: two boxes, never stacked unseparated (17 §3.4). */
export const DIVIDER_CLASSES =
  "border-t-(length:--border-width-thin) border-border-default";

/** A door of the choice step (05 RG1): a card-sized button, its audience under the action. */
export const DOOR_BUTTON_CLASSES = cn(
  "flex w-full flex-col items-start gap-1 rounded-lg p-inset-card text-left",
  "border-(length:--border-width-thin) border-border-strong bg-surface-card",
  "hover:bg-surface-hover",
);

/** The six boxes of the code: drawn only, the one real field lies over them (17 §3.2). */
export const CODE_BOXES_CLASSES = "grid grid-cols-6 gap-2";

export function codeBoxClasses(isCurrent: boolean, hasError: boolean): string {
  return cn(
    "flex h-(--size-input) items-center justify-center rounded-md bg-surface-page",
    "text-heading-3 font-bold tabular-nums text-text-primary",
    hasError
      ? "border-(length:--border-width-thick) border-border-error"
      : isCurrent
        ? "border-(length:--border-width-thick) border-border-selected"
        : "border-(length:--border-width-thin) border-border-strong",
  );
}

/** The real code field: transparent, over the boxes, so that autofill and paste work as one. */
export const CODE_OVERLAY_INPUT_CLASSES =
  "absolute inset-0 size-full cursor-text bg-transparent text-transparent caret-transparent";

/** The terms panel: a modal dialog, full height on mobile, centred column on desktop. */
export const DIALOG_CLASSES = cn(
  "m-auto max-h-full w-full max-w-(--container-narrow) overflow-y-auto rounded-lg",
  "border-(length:--border-width-thin) border-border-default bg-surface-raised p-inset-card text-text-primary",
  "backdrop:bg-overlay-scrim",
);
