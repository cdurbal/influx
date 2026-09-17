import { cn } from "./class-names";
import { CircleAlertIcon } from "./icons";

/** Shared with the account and login forms so field styling never drifts between them. */
export function inputClassName(hasError: boolean): string {
  return cn(
    "h-(--size-input) w-full rounded-md bg-surface-page px-4 text-md text-text-primary",
    hasError
      ? "border-(length:--border-width-thick) border-border-error"
      : "border-(length:--border-width-thin) border-border-strong",
  );
}

export function RequiredMark({ mark }: { mark: string }) {
  return (
    <span aria-hidden="true" className="ml-1 text-feedback-error-text">
      {mark}
    </span>
  );
}

export function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (!message) {
    return null;
  }
  return (
    <p
      id={id}
      className="flex items-start gap-1 text-sm text-feedback-error-text"
    >
      <CircleAlertIcon
        aria-hidden="true"
        className="mt-1 size-(--size-icon-sm) shrink-0 text-feedback-error-icon"
      />
      {message}
    </p>
  );
}
