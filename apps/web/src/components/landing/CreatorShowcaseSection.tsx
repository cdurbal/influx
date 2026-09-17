import { getTranslations } from "next-intl/server";
import { CreatorCardGrid } from "@/components/ui/CreatorCardGrid";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { CreatorCard } from "@/content/landing-content";

type CreatorShowcaseSectionProps = {
  cards: readonly CreatorCard[];
  sourceNote: string;
};

/** Section 3 (02 §3.5): creators selected by the team, without identity (D16). */
export async function CreatorShowcaseSection({
  cards,
  sourceNote,
}: CreatorShowcaseSectionProps) {
  const t = await getTranslations("landing.creatorShowcase");

  return (
    <section
      aria-labelledby="creator-showcase-title"
      className="bg-surface-page"
    >
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-section-header px-page-gutter py-section-block">
        <SectionHeader
          titleId="creator-showcase-title"
          overline={t("overline")}
          title={t.rich("title", mutedTitleTags)}
          lead={t("lead")}
          layout="split"
        />
        <CreatorCardGrid
          cards={cards}
          sourceNote={sourceNote}
          columnsClassName="lg:grid-cols-3"
        />
      </div>
    </section>
  );
}
