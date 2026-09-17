import type { CreatorCard as CreatorCardData } from "@/content/landing-content";
import { cn } from "./class-names";
import { BadgeCheckIcon, MapPinIcon } from "./icons";
import { ResponsiveImage } from "./ResponsiveImage";

type CreatorCardProps = {
  card: CreatorCardData;
  /** Audience range already formatted by next-intl in the page locale. */
  audienceRange: string;
  countryLabel: string;
  verifiedBadge: string;
};

/**
 * The only creator card (sections 3, 9, 15; 02 §2.3). D16 and CA17: topic, audience range,
 * country and badge only; never a pseudonym, name, handle, link or network. Not focusable.
 */
export function CreatorCard({
  card,
  audienceRange,
  countryLabel,
  verifiedBadge,
}: CreatorCardProps) {
  return (
    <li
      className={cn(
        "flex overflow-hidden rounded-lg border-(length:--border-width-thin) border-border-default bg-surface-card shadow-sm",
        "flex-row sm:flex-col",
      )}
    >
      <ResponsiveImage
        image={card.image}
        sizes="creatorCard"
        className="aspect-4/5 w-1/3 shrink-0 self-start sm:w-full"
      />
      <div className="flex min-w-0 flex-1 flex-col items-start gap-stack-sm p-inset-card">
        <h3 className="text-heading-3 font-semibold text-text-primary">
          {card.theme}
        </h3>
        {card.verified ? (
          <p className="inline-flex items-center gap-1 rounded-sm bg-brand-subtle-bg px-2 py-1 text-sm font-semibold text-text-brand-strong">
            <BadgeCheckIcon
              aria-hidden="true"
              className="size-(--size-icon-sm)"
            />
            {verifiedBadge}
          </p>
        ) : null}
        <p className="text-md text-text-secondary tabular-nums">
          {audienceRange}
        </p>
        <p className="flex items-center gap-1 text-sm text-text-tertiary">
          <MapPinIcon
            aria-hidden="true"
            className="size-(--size-icon-sm) shrink-0"
          />
          <span className="sr-only">{countryLabel}</span>
          {card.country}
        </p>
      </div>
    </li>
  );
}
