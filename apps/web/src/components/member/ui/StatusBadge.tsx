import type { ComponentType, ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  STATUS_ICON_CLASSES,
  statusBadgeClasses,
  type StatusTone,
  type StatusVariant,
} from "./status-badge-classes";

/** What a lucide icon of `icons.ts` is, as far as the badge is concerned: it takes a class, it is decorative. */
type StatusIcon = ComponentType<{ className?: string; "aria-hidden"?: "true" }>;

export type StatusBadgeProps = {
  tone: StatusTone;
  /** `pill` by default; `text`: no pill, the icon and the word in the colour of the tone. */
  variant?: StatusVariant;
  /** A decorative icon of `icons.ts`, 16 px, before the word. */
  icon?: StatusIcon;
  className?: string;
  /** The state, written: the tone only reinforces it (P7). */
  children?: ReactNode;
};

/**
 * The state of a thing as a word, in an outlined pill (C13): never an icon or a colour alone. Six tones,
 * the verified one included; the `text` form is for a state inside a line or a table cell.
 */
export function StatusBadge({
  tone,
  variant,
  icon: Icon,
  className,
  children,
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeClasses(tone, variant), className)}>
      {Icon === undefined ? null : (
        <Icon aria-hidden="true" className={STATUS_ICON_CLASSES} />
      )}
      {children}
    </span>
  );
}
