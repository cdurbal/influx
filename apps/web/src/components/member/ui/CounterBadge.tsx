import { cn } from "@/components/ui/class-names";
import { counterText } from "./counter";

type CounterBadgeProps = {
  count: number;
  /** What a screen reader says, already translated: "3 new items" (17 §2.2). */
  label: string;
  className?: string;
};

/**
 * The counter pill of a navigation entry: "9+" above nine, read in full as `label` (the digits are
 * hidden from the screen reader, which would otherwise hear "9 plus"). Nothing is drawn at zero.
 */
export function CounterBadge({ count, label, className }: CounterBadgeProps) {
  const text = counterText(count);
  if (text === null) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-pill bg-counter-bg px-2",
        "text-xs font-display font-bold tabular-nums text-counter-text",
        className,
      )}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
