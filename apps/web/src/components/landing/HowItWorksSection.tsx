import { getTranslations } from "next-intl/server";
import { AudienceDoors } from "@/components/ui/AudienceDoors";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { HowItWorksStepId, LandingImage } from "@/content/landing-content";

type HowItWorksSectionProps = {
  images: Record<HowItWorksStepId, LandingImage>;
};

const STEP_IDS: readonly HowItWorksStepId[] = [
  "createAccount",
  "completeProfile",
  "receiveProposals",
];

/**
 * Section 11 (02 §3.13): how to start in three steps, one sentence per audience. The "80 %"
 * overlay is an illustration (aria-hidden): the written percentage carries the meaning.
 */
export async function HowItWorksSection({ images }: HowItWorksSectionProps) {
  const t = await getTranslations("landing.howItWorks");

  return (
    <section aria-labelledby="how-it-works-title" className="bg-surface-page">
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-section-header px-page-gutter py-section-block">
        <SectionHeader
          titleId="how-it-works-title"
          overline={t("overline")}
          title={t("title")}
          lead={t("lead")}
        />
        <ol className="grid grid-cols-1 gap-8 lg:grid-cols-3 lg:gap-grid-gap">
          {STEP_IDS.map((id, index) => (
            <li key={id} className="flex flex-col gap-4">
              <div className="relative">
                <ResponsiveImage
                  image={images[id]}
                  sizes="thirdDesktop"
                  className="aspect-4/3 w-full rounded-lg"
                />
                {id === "completeProfile" ? (
                  <div
                    aria-hidden="true"
                    className="absolute inset-x-4 bottom-4 flex flex-col gap-2 rounded-md bg-surface-raised p-3 text-sm text-text-primary shadow-md"
                  >
                    <span className="font-semibold">
                      {t("completenessIllustration")}
                    </span>
                    <span className="block h-2 w-full overflow-hidden rounded-pill bg-border-subtle">
                      <span className="block h-2 w-4/5 rounded-pill bg-action-primary-bg" />
                    </span>
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-(--size-touch-target) shrink-0 items-center justify-center rounded-round bg-surface-inverse font-bold text-text-inverse tabular-nums"
                >
                  {index + 1}
                </span>
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {t(`steps.${id}.title`)}
                </h3>
              </div>
              <p className="text-md text-text-secondary">
                <span className="font-semibold text-text-primary">
                  {t("audience.advertiser")}
                </span>{" "}
                {t(`steps.${id}.advertiser`)}
              </p>
              <p className="text-md text-text-secondary">
                <span className="font-semibold text-text-primary">
                  {t("audience.creator")}
                </span>{" "}
                {t(`steps.${id}.creator`)}
              </p>
            </li>
          ))}
        </ol>
        <AudienceDoors idPrefix="how-it-works" className="justify-center" />
      </div>
    </section>
  );
}
