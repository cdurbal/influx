import { getTranslations } from "next-intl/server";
import { TrendingUpIcon } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { FeaturedResult } from "@/content/landing-content";

type FeaturedResultSectionProps = {
  result: FeaturedResult;
};

/**
 * Section 4 (02 §3.6): one campaign result and its trend. The rise is carried by the arrow, the
 * sign and a visually hidden word, never by the green color alone.
 */
export async function FeaturedResultSection({
  result,
}: FeaturedResultSectionProps) {
  const t = await getTranslations("landing.featuredResult");

  return (
    <section
      aria-labelledby="featured-result-title"
      className="bg-surface-muted"
    >
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter py-section-block lg:grid-cols-12 lg:items-center lg:gap-grid-gap">
        <SectionHeader
          titleId="featured-result-title"
          overline={t("overline")}
          title={t("title")}
          className="lg:col-span-6 lg:col-start-7 lg:row-start-1 lg:self-end"
        />
        <ResponsiveImage
          image={result.image}
          sizes="halfDesktop"
          className="aspect-3/2 w-full rounded-lg lg:col-span-6 lg:col-start-1 lg:row-span-2 lg:row-start-1"
        />
        <div className="flex flex-col gap-4 text-center md:text-left lg:col-span-6 lg:col-start-7 lg:row-start-2 lg:self-start">
          <p className="flex flex-col gap-2">
            <span className="text-figure-lg font-extrabold tracking-display text-text-primary tabular-nums">
              {t("valueDisplay", { value: result.value })}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {result.metricLabel}
            </span>
            <span className="inline-flex items-center justify-center gap-2 font-semibold text-text-brand md:justify-start">
              <TrendingUpIcon
                aria-hidden="true"
                className="size-(--size-icon-md) shrink-0"
              />
              <span className="sr-only">{t("trendUp")}</span>
              {t("trendDisplay", {
                value: result.trend.value,
                months: result.trend.months,
              })}
            </span>
          </p>
          <p className="text-md text-text-secondary">{result.context}</p>
          <p className="text-sm text-text-tertiary">{result.sourceNote}</p>
        </div>
      </div>
    </section>
  );
}
