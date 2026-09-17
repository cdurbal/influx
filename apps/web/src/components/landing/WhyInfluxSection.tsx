import { getTranslations } from "next-intl/server";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { LandingImage, WhyInfluxItemId } from "@/content/landing-content";

type WhyInfluxSectionProps = {
  images: Record<WhyInfluxItemId, LandingImage>;
};

const ITEM_IDS: readonly WhyInfluxItemId[] = [
  "qualifiedMatching",
  "secureContract",
  "allInInflux",
];

/** Section 13 (02 §3.15): three reasons to choose INFLUX. */
export async function WhyInfluxSection({ images }: WhyInfluxSectionProps) {
  const t = await getTranslations("landing.whyInflux");

  return (
    <section aria-labelledby="why-influx-title" className="bg-surface-page">
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-section-header px-page-gutter py-section-block">
        <SectionHeader
          titleId="why-influx-title"
          overline={t("overline")}
          title={t("title")}
          lead={t("lead")}
        />
        <ul className="grid grid-cols-1 gap-grid-gap lg:grid-cols-3">
          {ITEM_IDS.map((id) => (
            <li
              key={id}
              className="flex flex-col overflow-hidden rounded-lg bg-surface-card shadow-sm"
            >
              <ResponsiveImage
                image={images[id]}
                sizes="thirdDesktop"
                className="aspect-3/2 w-full"
              />
              <div className="flex flex-col gap-stack-sm p-inset-card">
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {t(`items.${id}.title`)}
                </h3>
                <p className="text-md text-text-secondary">
                  {t(`items.${id}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
