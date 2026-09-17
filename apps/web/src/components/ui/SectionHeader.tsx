import { cn } from "./class-names";

type SectionHeaderProps = {
  /** id of the h2, referenced by the section's aria-labelledby. */
  titleId: string;
  overline?: string;
  title: string;
  lead?: string;
  /**
   * "stacked": overline, title and lead one under the other (default).
   * "split": from lg, overline and title on the left, lead on the right (02 §3.5).
   */
  layout?: "stacked" | "split";
  /** Left-aligned at every width (headers inside a desktop column). */
  alignStart?: boolean;
  /** Title color on a dark section. */
  tone?: "default" | "inverse";
  className?: string;
};

/** Standard section header: overline, h2, lead (02 §2.1). Centered on mobile, left from md. */
export function SectionHeader({
  titleId,
  overline,
  title,
  lead,
  layout = "stacked",
  alignStart = false,
  tone = "default",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        alignStart
          ? "items-start text-left"
          : "items-center text-center md:items-start md:text-left",
        layout === "split" &&
          "lg:grid lg:grid-cols-12 lg:items-end lg:gap-grid-gap",
        className,
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-3",
          layout === "split" && "lg:col-span-7",
        )}
      >
        {overline ? (
          <p className="text-sm font-semibold uppercase leading-snug tracking-overline text-text-brand">
            {overline}
          </p>
        ) : null}
        <h2
          id={titleId}
          className={cn(
            "text-heading-2 font-bold tracking-heading",
            tone === "inverse" ? "text-text-inverse" : "text-text-primary",
          )}
        >
          {title}
        </h2>
      </div>
      {lead ? (
        <p
          className={cn(
            "max-w-(--measure-text) text-lead",
            tone === "inverse"
              ? "text-text-inverse-secondary"
              : "text-text-secondary",
            layout === "split" && "lg:col-span-5",
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  );
}
