import { cn } from "@/components/ui/class-names";
import {
  RANGE_FILL_CLASSES,
  RANGE_LABEL_CLASSES,
  RANGE_LIST_CLASSES,
  RANGE_ROW_CLASSES,
  RANGE_TRACK_CLASSES,
  RANGE_VALUE_CLASSES,
} from "./range-bar-classes";

export type RangeBarProps = {
  /**
   * One line per range: where the band starts and ends on a scale of 0 to 100, as the screen was given it, and the
   * range in words (« 30 à 50 % »). The component draws the band it receives: it computes no range and no share.
   */
  items: { label: string; from: number; to: number; valueLabel: string }[];
  className?: string;
};

/**
 * Ranges of an audience (C37): the written value says it all, the bar only shows where the band stands and is hidden
 * from a screen reader. Ranges alone before the reveal (D61).
 */
export function RangeBar({ items, className }: RangeBarProps) {
  return (
    <ul data-range-bar="" className={cn(RANGE_LIST_CLASSES, className)}>
      {items.map((item, index) => (
        <li key={`${index}:${item.label}`} className={RANGE_ROW_CLASSES}>
          <span className={RANGE_LABEL_CLASSES}>{item.label}</span>
          {/* The place of the band is data. A drawing holds it: the CSP of the fronts refuses a `style` attribute. */}
          <svg aria-hidden="true" className={RANGE_TRACK_CLASSES}>
            <rect
              data-range-fill=""
              x={`${item.from}%`}
              width={`${item.to - item.from}%`}
              height="100%"
              className={RANGE_FILL_CLASSES}
            />
          </svg>
          <span className={RANGE_VALUE_CLASSES}>{item.valueLabel}</span>
        </li>
      ))}
    </ul>
  );
}
