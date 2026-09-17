import { getTranslations } from "next-intl/server";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { LandingImage, UseCaseId } from "@/content/landing-content";

type UseCasesSectionProps = {
  images: Record<UseCaseId, LandingImage>;
};

// Display order fixed by the compliance review (02 §3.12).
const USE_CASE_IDS: readonly UseCaseId[] = [
  "ugc",
  "acquisition",
  "productLaunch",
  "awareness",
];

/** Section 10 (02 §3.12): four advertiser goals, as non-focusable cards without links. */
export async function UseCasesSection({ images }: UseCasesSectionProps) {
  const t = await getTranslations("landing.useCases");

  return (
    <section aria-labelledby="use-cases-title" className="bg-surface-muted">
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-section-header px-page-gutter py-section-block">
        <SectionHeader
          titleId="use-cases-title"
          overline={t("overline")}
          title={t.rich("title", mutedTitleTags)}
          lead={t("lead")}
        />
        <ul className="grid grid-cols-1 gap-grid-gap md:grid-cols-2">
          {USE_CASE_IDS.map((id) => (
            <li
              key={id}
              className="flex flex-col overflow-hidden rounded-lg bg-surface-card shadow-sm"
            >
              <ResponsiveImage
                image={images[id]}
                sizes="halfDesktop"
                className="aspect-3/2 w-full"
              />
              <div className="flex flex-col gap-stack-sm p-inset-card">
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {t(`items.${id}.title`)}
                </h3>
                <p className="text-md text-text-secondary">
                  {t(`items.${id}.body`)}
                </p>
                <p className="text-sm text-text-tertiary">
                  <span className="font-semibold">{t("formatsLabel")}</span>{" "}
                  {t(`items.${id}.formats`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
