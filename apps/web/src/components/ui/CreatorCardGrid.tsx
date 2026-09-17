import { getTranslations } from "next-intl/server";
import type { CreatorCard as CreatorCardData } from "@/content/landing-content";
import { cn } from "./class-names";
import { CreatorCard } from "./CreatorCard";
import { InfoIcon } from "./icons";

type CreatorCardGridProps = {
  cards: readonly CreatorCardData[];
  /** Mention "fictitious profiles", shown under the "verified" legend (02 §2.7). */
  sourceNote: string;
  /** Column classes at lg, e.g. "lg:grid-cols-3". */
  columnsClassName: string;
  /** Legend color on dark sections (section 15). */
  tone?: "default" | "inverse";
  className?: string;
};

/** Card list + "verified" legend + fictitious mention, shared by sections 3, 9 and 15. */
export async function CreatorCardGrid({
  cards,
  sourceNote,
  columnsClassName,
  tone = "default",
  className,
}: CreatorCardGridProps) {
  const t = await getTranslations("landing.common.creatorCard");
  const legendClassName =
    tone === "inverse" ? "text-text-inverse-secondary" : "text-text-tertiary";

  return (
    <div className={cn("flex flex-col gap-stack-md", className)}>
      <ul
        className={cn(
          "grid grid-cols-1 gap-grid-gap sm:grid-cols-2",
          columnsClassName,
        )}
      >
        {cards.map((card) => (
          <CreatorCard
            key={card.id}
            card={card}
            audienceRange={t("audienceRange", {
              min: card.audienceMin,
              max: card.audienceMax,
            })}
            countryLabel={t("countryLabel")}
            verifiedBadge={t("verifiedBadge")}
          />
        ))}
      </ul>
      <div className={cn("flex flex-col gap-1 text-sm", legendClassName)}>
        <p className="flex items-start gap-2">
          <InfoIcon
            aria-hidden="true"
            className="mt-1 size-(--size-icon-sm) shrink-0"
          />
          {t("verifiedLegend")}
        </p>
        <p>{sourceNote}</p>
      </div>
    </div>
  );
}
