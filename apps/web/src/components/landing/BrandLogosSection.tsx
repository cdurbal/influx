import { getTranslations } from "next-intl/server";
import { MarqueeCarousel } from "@/components/ui/MarqueeCarousel";
import type { BrandLogos } from "@/content/landing-content";

type BrandLogosSectionProps = {
  logos: BrandLogos;
};

/** Section 5 (02 §3.7): text-only brand names in a pausable marquee (CA16). */
export async function BrandLogosSection({ logos }: BrandLogosSectionProps) {
  const t = await getTranslations("landing");

  return (
    <section aria-labelledby="brand-logos-title" className="bg-surface-page">
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-section-header px-page-gutter py-section-block">
        <h2
          id="brand-logos-title"
          className="text-center text-sm font-semibold uppercase leading-snug tracking-overline text-text-brand"
        >
          {t("brandLogos.title")}
        </h2>
        <MarqueeCarousel
          items={logos.brands}
          pauseLabel={t("common.carousel.pause")}
          note={logos.sourceNote}
        />
      </div>
    </section>
  );
}
