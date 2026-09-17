import { getTranslations } from "next-intl/server";
import { AudienceDoors } from "@/components/ui/AudienceDoors";
import { cn } from "@/components/ui/class-names";
import { CreatorCardGrid } from "@/components/ui/CreatorCardGrid";
import { mutedTitleTags } from "@/components/ui/rich-text";
import type { CreatorCard } from "@/content/landing-content";

type FinalCtaSectionProps = {
  cards: readonly CreatorCard[];
  cardsSourceNote: string;
};

/** Section 15 (02 §3.17): last reminder of the two doors, on a slightly raised dark surface. */
export async function FinalCtaSection({
  cards,
  cardsSourceNote,
}: FinalCtaSectionProps) {
  const t = await getTranslations("landing.finalCta");
  const hasCards = cards.length > 0;

  return (
    <section aria-labelledby="final-cta-title" className="bg-surface-muted">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter py-section-block lg:grid-cols-12 lg:items-center lg:gap-grid-gap">
        <div
          className={cn(
            "flex flex-col gap-5",
            hasCards ? "lg:col-span-5" : "lg:col-span-12",
          )}
        >
          <h2
            id="final-cta-title"
            className="text-heading-2 font-bold tracking-heading text-text-primary"
          >
            {t.rich("title", mutedTitleTags)}
          </h2>
          <p className="max-w-(--measure-text) text-lead text-text-secondary">
            {t("lead")}
          </p>
          <AudienceDoors idPrefix="final-cta" />
        </div>
        {hasCards ? (
          <CreatorCardGrid
            cards={cards}
            sourceNote={cardsSourceNote}
            columnsClassName="lg:grid-cols-3"
            className="lg:col-span-7 lg:col-start-6"
          />
        ) : null}
      </div>
    </section>
  );
}
