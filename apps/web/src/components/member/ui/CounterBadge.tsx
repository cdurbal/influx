"use client";

import { useState } from "react";
import { cn } from "@/components/ui/class-names";
import { FlagIcon } from "@/components/ui/icons";
import { counterText } from "./counter";
import {
  COUNTER_CONTAINER_CLASSES,
  COUNTER_FLASH_CLASSES,
  counterBadgeClasses,
  counterFlagClasses,
  type CounterVariant,
} from "./counter-badge-classes";

export type CounterBadgeProps = {
  count: number;
  /** What a screen reader says, already translated: "3 new items" (17 §2.2), "4 overdue" when `late`. */
  label: string;
  /** `pill` by default; `dot`: a 20 px disc for the inside of another pill (the rail is RUC's). */
  variant?: CounterVariant;
  /** Overdue: the warning ground and a flag (the pill keeps the number beside it, the dot shows the flag alone). */
  late?: boolean;
  className?: string;
};

/**
 * The counter pill of a navigation entry or of a list head (C16): "9+" above nine, read in full as `label`
 * (the digits are hidden from the screen reader, which would otherwise hear "9 plus"). Nothing is drawn at
 * zero. When the value changes its container flashes once (`flash-strong`, 320 ms), never on the first draw.
 */
export function CounterBadge({
  count,
  label,
  variant,
  late = false,
  className,
}: CounterBadgeProps) {
  // The change is read while rendering: the container is keyed by the number of changes, so that each one
  // replays the flash, and a counter that has not changed has none.
  const [shown, setShown] = useState(count);
  const [changes, setChanges] = useState(0);
  if (count !== shown) {
    setShown(count);
    setChanges(changes + 1);
  }
  const text = counterText(count);
  if (text === null) return null;
  const dot = variant === "dot";
  return (
    <span
      key={changes}
      className={cn(
        COUNTER_CONTAINER_CLASSES,
        changes > 0 && COUNTER_FLASH_CLASSES,
        className,
      )}
    >
      <span className={counterBadgeClasses(variant, late)}>
        {late ? (
          <FlagIcon
            aria-hidden="true"
            className={counterFlagClasses(variant)}
          />
        ) : null}
        {dot && late ? null : <span aria-hidden="true">{text}</span>}
        <span className="sr-only">{label}</span>
      </span>
    </span>
  );
}
