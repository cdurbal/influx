import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import {
  CARD_ACTIONS_CLASSES,
  CARD_ACTIONS_STRETCH_CLASSES,
} from "./card-actions-classes";
import { passThroughOf, type PassThroughProps } from "./pass-through";

export type CardActionsProps = {
  /** The actions fill the width of the card below 480 px, one per line. */
  stretch?: boolean;
  className?: string;
  children?: ReactNode;
};

/** The row of actions at the foot of a card (C12): one principal action, first. */
export function CardActions({
  stretch = false,
  className,
  children,
  ...rest
}: CardActionsProps & PassThroughProps) {
  return (
    <div
      {...passThroughOf(rest)}
      className={cn(
        CARD_ACTIONS_CLASSES,
        stretch && CARD_ACTIONS_STRETCH_CLASSES,
        className,
      )}
    >
      {children}
    </div>
  );
}
