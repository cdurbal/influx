// Classes of the fields of the connected spaces (docs/mvp/20 §11.8): the outline reaches 3:1 on the
// page (`border-strong`), an error is a 2 px red outline with a message tied by aria-describedby, the
// focus is the ring of globals.css (never a green border, K18).
import { cn } from "@/components/ui/class-names";

/** One field and its texts: label, control, help, error. */
export const MEMBER_FIELD_CLASSES = "flex flex-col gap-2";

export const MEMBER_FIELD_LABEL_CLASSES = "font-semibold text-text-primary";

export const MEMBER_FIELD_HELP_CLASSES = "text-sm text-text-secondary";

/** A text field, a select: `surface-page`, `radius-md`, `size-input` tall. */
export function memberControlClasses(hasError: boolean): string {
  return cn(
    "h-(--size-input) w-full rounded-md bg-surface-page px-4 text-md text-text-primary",
    "disabled:border-border-default disabled:bg-surface-raised disabled:text-text-disabled",
    hasError
      ? "border-(length:--border-width-thick) border-border-error"
      : "border-(length:--border-width-thin) border-border-strong",
  );
}
