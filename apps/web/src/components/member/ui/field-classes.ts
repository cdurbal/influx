// Classes of the fields of the connected spaces (docs/mvp/20 §11.8): the outline reaches 3:1 on the
// page (`border-strong`), an error is a 2 px red outline with a message tied by aria-describedby, the
// focus is the ring of globals.css (never a green border, K18).
import { cn } from "@/components/ui/class-names";

/** One field and its texts: label, control, help, error. */
export const MEMBER_FIELD_CLASSES = "flex flex-col gap-2";

export const MEMBER_FIELD_LABEL_CLASSES = "font-semibold text-text-primary";

export const MEMBER_FIELD_HELP_CLASSES = "text-sm text-text-secondary";

/** The label line of a field: the label, what it asks, and the layer badge beside it (06 RG62). */
export const MEMBER_FIELD_HEADER_CLASSES =
  "flex flex-wrap items-center gap-x-3 gap-y-1";

/** What the label adds when the field is required, written (never a mark alone). */
export const MEMBER_FIELD_REQUIRED_CLASSES =
  "text-sm font-regular text-text-secondary";

/** The counter of a text area and the count of a capped list: read, not announced at each key. */
export const MEMBER_FIELD_COUNTER_CLASSES =
  "text-sm tabular-nums text-text-secondary";

/**
 * A checkbox or a radio whose whole label is the click zone (17 §3.6). `blocked`: a choice that
 * cannot be taken now (the cap of its list is reached) is dimmed and says so elsewhere, never only
 * dimmed.
 */
export function memberChoiceRowClasses(blocked = false): string {
  return cn(
    "flex min-h-(--size-touch-target) items-start gap-3 py-2 text-md",
    blocked
      ? "cursor-not-allowed text-text-disabled"
      : "cursor-pointer text-text-primary",
  );
}

export function memberChoiceInputClasses(blocked = false): string {
  return cn(
    "mt-1 size-(--size-checkbox) shrink-0 accent-action-primary-bg",
    blocked ? "cursor-not-allowed" : "cursor-pointer",
  );
}

function outlineClasses(hasError: boolean): string {
  return cn(
    "bg-surface-page text-md text-text-primary",
    "disabled:border-border-default disabled:bg-surface-raised disabled:text-text-disabled",
    hasError
      ? "border-(length:--border-width-thick) border-border-error"
      : "border-(length:--border-width-thin) border-border-strong",
  );
}

/** A text field, a select: `surface-page`, `radius-md`, `size-input` tall. */
export function memberControlClasses(hasError: boolean): string {
  return cn(
    "h-(--size-input) w-full rounded-md px-4",
    outlineClasses(hasError),
  );
}

/** A text area: the same outline, its height set by `rows`. */
export function memberTextAreaClasses(hasError: boolean): string {
  return cn("w-full rounded-md px-4 py-3", outlineClasses(hasError));
}
