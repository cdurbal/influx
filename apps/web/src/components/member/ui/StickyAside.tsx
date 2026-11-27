import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { cardClasses } from "./card-classes";
import {
  MOBILE_ACTION_BAR_ACTION_CLASSES,
  MOBILE_ACTION_BAR_CLASSES,
  MOBILE_ACTION_BAR_TEXT_CLASSES,
  STICKY_ASIDE_CLASSES,
} from "./sticky-aside-classes";

export type StickyAsideProps = {
  children: ReactNode;
  /** The name of the landmark, already translated: « Ma sélection », « Candidature » (X11). */
  label: string;
  className?: string;
};

/**
 * The box beside a reading (C39): a named complementary landmark that stays in view from 1 024 px. Below that width
 * it is away, and the screen shows `MobileActionBar` in its place.
 */
export function StickyAside({ children, label, className }: StickyAsideProps) {
  return (
    <aside
      aria-label={label}
      data-sticky-aside=""
      className={cn(cardClasses("box"), STICKY_ASIDE_CLASSES, className)}
    >
      {children}
    </aside>
  );
}

export type MobileActionBarProps = {
  /** The name of the landmark, already translated (X11). */
  label: string;
  /** The short words beside the action, already translated: one or two lines. */
  text: ReactNode;
  /** The one action of the bar, already built: at most one is green on the screen. */
  action: ReactNode;
  /** There is nothing to do now (a closed or a submitted campaign): the bar is not drawn. */
  hidden?: boolean;
  className?: string;
};

/**
 * The bar of the box below 1 024 px (C39): fixed over the bottom bar, a named region with a few words and one action.
 * The page keeps the room under it (`PageFrame`, `stickyBar`).
 */
export function MobileActionBar({
  label,
  text,
  action,
  hidden = false,
  className,
}: MobileActionBarProps) {
  if (hidden) return null;
  return (
    <section
      aria-label={label}
      data-mobile-action-bar=""
      className={cn(MOBILE_ACTION_BAR_CLASSES, className)}
    >
      <div className={MOBILE_ACTION_BAR_TEXT_CLASSES}>{text}</div>
      <div className={MOBILE_ACTION_BAR_ACTION_CLASSES}>{action}</div>
    </section>
  );
}
