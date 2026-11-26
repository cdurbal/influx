import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { CARD_TITLE, OVERLINE } from "./heading-classes";
import {
  INNER_PANEL_HEAD_CLASSES,
  INNER_PANEL_ICON_CLASSES,
  INNER_PANEL_LABEL_CLASSES,
  INNER_PANEL_PREVIEW_HEAD_CLASSES,
  INNER_PANEL_VALUE_CLASSES,
  innerPanelClasses,
  type InnerPanelVariant,
} from "./inner-panel-classes";

export type InnerPanelProps = {
  variant?: InnerPanelVariant;
  /** The title, or the label of a `readonly` line, or the cap of a `preview`. */
  title?: string;
  /** A decorative icon before the cap of a `preview`. */
  icon?: ReactNode;
  /** An action at the end of the head, or of the `readonly` line. */
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
};

/**
 * A panel inside a card (C05): `surface-raised`, no contour, never inside another panel (a card
 * holds at most two levels of surface). `readonly` is a line (label, value, action), `preview` has
 * a 12 px cap and an icon, `form` is the panel of the backoffice.
 */
export function InnerPanel({
  variant = "default",
  title,
  icon,
  action,
  className,
  children,
}: InnerPanelProps) {
  const classes = cn(innerPanelClasses(variant), className);
  if (variant === "readonly") {
    return (
      <div className={classes}>
        {title === undefined ? null : (
          <p className={INNER_PANEL_LABEL_CLASSES}>{title}</p>
        )}
        <div className={INNER_PANEL_VALUE_CLASSES}>{children}</div>
        {action}
      </div>
    );
  }
  if (variant === "preview") {
    return (
      <div className={classes}>
        {title === undefined && icon === undefined ? null : (
          <p className={cn(OVERLINE, INNER_PANEL_PREVIEW_HEAD_CLASSES)}>
            {icon === undefined ? null : (
              <span aria-hidden="true" className={INNER_PANEL_ICON_CLASSES}>
                {icon}
              </span>
            )}
            {title}
          </p>
        )}
        {children}
        {action}
      </div>
    );
  }
  return (
    <div className={classes}>
      {title === undefined && action === undefined ? null : (
        <div className={INNER_PANEL_HEAD_CLASSES}>
          {title === undefined ? null : <p className={CARD_TITLE}>{title}</p>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
