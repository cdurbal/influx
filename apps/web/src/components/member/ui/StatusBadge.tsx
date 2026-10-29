import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { statusBadgeClasses, type StatusTone } from "./status-badge-classes";

type StatusBadgeProps = {
  tone: StatusTone;
  className?: string;
  /** The state, written: the tone only reinforces it (P7). */
  children?: ReactNode;
};

/** The state of a thing as a word in an outlined pill. */
export function StatusBadge({ tone, className, children }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeClasses(tone), className)}>{children}</span>
  );
}
