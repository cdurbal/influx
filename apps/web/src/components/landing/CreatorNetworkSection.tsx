import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { CreatorCardGrid } from "@/components/ui/CreatorCardGrid";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { CreatorNetwork } from "@/content/landing-content";

type CreatorNetworkSectionProps = {
  network: CreatorNetwork;
  /** Common "fictitious profiles" mention of the creator cards. */
  cardsSourceNote: string;
};

/**
 * Section 9 (02 §3.11): size of the network and invitation to creators. No network filter
 * (interaction not allowed, no free search in the MVP).
 */
export async function CreatorNetworkSection({
  network,
  cardsSourceNote,
}: CreatorNetworkSectionProps) {
  const t = await getTranslations("landing");

  return (
    <section
      aria-labelledby="creator-network-title"
      className="bg-surface-page"
    >
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-section-header px-page-gutter py-section-block">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-grid-gap">
          <SectionHeader
            titleId="creator-network-title"
            overline={t("creatorNetwork.overline")}
            title={t("creatorNetwork.title")}
            lead={t("creatorNetwork.lead")}
            className="lg:col-span-7"
          />
          {network.count !== null ? (
            <div className="flex flex-col gap-1 text-center md:text-left lg:col-span-4 lg:col-start-9">
              <p className="flex flex-col text-md font-semibold text-text-primary">
                {t.rich("creatorNetwork.countLabel", {
                  count: network.count,
                  highlight: (chunks) => (
                    <span className="text-figure-lg font-extrabold tracking-display tabular-nums">
                      {chunks}
                    </span>
                  ),
                })}
              </p>
              <p className="text-sm text-text-tertiary">{network.sourceNote}</p>
            </div>
          ) : null}
        </div>
        {network.cards.length > 0 ? (
          <CreatorCardGrid
            cards={network.cards}
            sourceNote={cardsSourceNote}
            columnsClassName="lg:grid-cols-4"
          />
        ) : null}
        <div className="flex justify-center md:justify-start lg:justify-end">
          <Button variant="secondary" className="w-full sm:w-auto">
            {t("common.cta.creator")}
          </Button>
        </div>
      </div>
    </section>
  );
}
