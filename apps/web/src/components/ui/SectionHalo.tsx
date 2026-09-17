import { cn } from "./class-names";

type SectionHaloProps = {
  className?: string;
};

/**
 * Diagonal ambient light beam across a section (expert-ux, 2026-09-17, benchmark wekollab.fr).
 * Purely decorative: the parent section needs `relative isolate overflow-hidden` so this stays
 * clipped to it and its negative z-index (`z-behind`) keeps it below the section's own content.
 */
export function SectionHalo({ className }: SectionHaloProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-(--z-behind) bg-halo-ambient",
        className,
      )}
    />
  );
}
