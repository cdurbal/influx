import type { ReactNode } from "react";
import { cn, ERROR_CLASSES } from "./auth-classes";
import { TriangleAlertIcon } from "./icons";

type ErrorNoticeProps = {
  id?: string;
  /** False for a field error already tied to its input by aria-describedby. */
  announce?: boolean;
  className?: string;
  children?: ReactNode;
};

/** An error: icon and text, never the color alone, no red fill (zone-de-danger-fiche §3). */
export function ErrorNotice({
  id,
  announce = true,
  className,
  children,
}: ErrorNoticeProps) {
  return (
    <div
      id={id}
      role={announce ? "alert" : undefined}
      className={cn(ERROR_CLASSES, "flex items-start gap-2", className)}
    >
      <TriangleAlertIcon
        aria-hidden="true"
        className="size-(--size-icon-md) shrink-0 text-feedback-error-icon"
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
