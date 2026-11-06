import { cn } from "@/components/ui/class-names";

type ScoreGaugeProps = {
  /** "Profile completeness". */
  label: string;
  /** 0 to 100 (06 RG57). */
  value: number;
  /** The value written, e.g. "82 %": the bar never carries it alone (RG85). */
  valueText: string;
  className?: string;
};

/**
 * A score of 0 to 100 (the completeness of the profile, 06 RG57) as a bar AND a number written. It is not a threshold and opens
 * no right (06 RG60): a measure, not a goal that would change colour when reached.
 */
export function ScoreGauge({
  label,
  value,
  valueText,
  className,
}: ScoreGaugeProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* The value stays in one piece; in a narrow card it goes under the label. */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-semibold text-text-primary">{label}</span>
        <span className="font-display text-title-section font-bold whitespace-nowrap tabular-nums text-text-primary">
          {valueText}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className="h-(--spacing-2) w-full overflow-hidden rounded-pill bg-surface-raised"
      >
        {/* The width is an attribute of the drawing, not a style: no inline style (CA22). */}
        <svg aria-hidden="true" focusable="false" className="block size-full">
          <rect
            width={`${Math.min(100, Math.max(0, value))}%`}
            height="100%"
            className="fill-brand-primary"
          />
        </svg>
      </div>
    </div>
  );
}
