import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Carousel, type CarouselSlide } from "@/components/ui/Carousel";
import { PlayIcon } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { CaseStudies } from "@/content/landing-content";

type CaseStudiesSectionProps = {
  caseStudies: CaseStudies;
};

/**
 * Section 6 (02 §3.8): five case studies in a manual carousel. Only performance indicators, never
 * an amount of money. The video button has no effect and no player exists (CA11).
 */
export async function CaseStudiesSection({
  caseStudies,
}: CaseStudiesSectionProps) {
  const t = await getTranslations("landing");
  const total = caseStudies.items.length;

  const slides: CarouselSlide[] = caseStudies.items.map((item) => {
    const titleId = `case-study-${item.id}-title`;
    return {
      id: item.id,
      content: (
        <div className="grid h-full grid-cols-1 overflow-hidden rounded-lg bg-surface-card shadow-sm lg:grid-cols-12">
          <ResponsiveImage
            image={item.image}
            sizes="caseStudy"
            className="aspect-4/3 w-full lg:col-span-5 lg:aspect-square"
          />
          <div className="flex flex-col items-start gap-3 p-inset-card lg:col-span-7 lg:justify-center">
            <p className="text-sm font-semibold uppercase leading-snug tracking-overline text-text-brand">
              {item.sector}
            </p>
            <h3
              id={titleId}
              className="text-heading-3 font-semibold text-text-primary"
            >
              {item.brandName}
            </h3>
            <p className="flex flex-col gap-1">
              <span className="text-figure-lg font-extrabold tracking-display text-text-primary tabular-nums">
                {t("caseStudies.metricDisplay", { value: item.metricValue })}
              </span>
              <span className="font-semibold text-text-primary">
                {item.metricLabel}
              </span>
            </p>
            <p className="text-text-secondary">{item.summary}</p>
            <Button variant="secondary" size="md" aria-describedby={titleId}>
              <PlayIcon
                aria-hidden="true"
                className="size-(--size-icon-md) shrink-0"
              />
              {t("caseStudies.videoButton")}
            </Button>
            <p className="text-sm text-text-tertiary">
              {caseStudies.sourceNote}
            </p>
          </div>
        </div>
      ),
    };
  });

  const slideLabels = caseStudies.items.map((_, index) =>
    t("common.carousel.slideLabel", { current: index + 1, total }),
  );

  return (
    <section aria-labelledby="case-studies-title" className="bg-surface-muted">
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-section-header px-page-gutter py-section-block">
        <SectionHeader
          titleId="case-studies-title"
          overline={t("caseStudies.overline")}
          title={t("caseStudies.title")}
          lead={t("caseStudies.lead")}
        />
        <Carousel
          roleDescription={t("common.carousel.roleDescription")}
          slideRoleDescription={t("common.carousel.slideRoleDescription")}
          slideLabels={slideLabels}
          previousLabel={t("common.carousel.previous")}
          nextLabel={t("common.carousel.next")}
          slides={slides}
        />
      </div>
    </section>
  );
}
