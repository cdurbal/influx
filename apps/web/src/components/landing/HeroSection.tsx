import { getTranslations } from "next-intl/server";
import { AudienceDoors } from "@/components/ui/AudienceDoors";
import { CheckIcon, InboxIcon } from "@/components/ui/icons";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import type { HeroContent } from "@/content/landing-content";

type HeroSectionProps = {
  content: HeroContent;
};

/**
 * Section 1 (02 §3.3): the 10-second test (CA3). The h1, the lead and both doors come before the
 * image in the DOM and fit in the first screen at 375 × 667 and 1440 × 900.
 */
export async function HeroSection({ content }: HeroSectionProps) {
  const t = await getTranslations("landing.hero");

  return (
    <section aria-labelledby="hero-title" className="bg-surface-page">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter pt-6 pb-section-block lg:grid-cols-12 lg:items-center lg:gap-grid-gap lg:pt-section-block">
        <div className="flex flex-col gap-4 lg:col-span-6">
          <p className="text-sm font-semibold uppercase leading-snug tracking-overline text-text-brand">
            {t("overline")}
          </p>
          <h1
            id="hero-title"
            className="max-w-(--measure-heading) text-display font-extrabold tracking-display text-text-primary"
          >
            {t.rich("title", mutedTitleTags)}
          </h1>
          <p className="max-w-(--measure-text) text-lead text-text-secondary">
            {t("lead")}
          </p>
          <AudienceDoors idPrefix="hero" className="mt-2" />
          <p className="flex items-center gap-2 text-sm text-text-secondary">
            <CheckIcon
              aria-hidden="true"
              className="size-(--size-icon-md) shrink-0 text-text-brand"
            />
            {t("reassurance")}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-grid-gap lg:col-span-6 lg:grid-cols-12 lg:items-start">
          <div className="perspective-hero-card z-(--z-raised) hidden lg:col-span-5 lg:mt-9 lg:block">
            <div className="aspect-card-id1 flex w-full items-start justify-center rotate-x-hero-secondary-x rotate-y-hero-secondary-y rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card p-3 shadow-metal-card">
              <ResponsiveImage
                image={content.secondaryImage}
                sizes="heroSecondary"
                className="aspect-square h-4/5 max-w-full rounded-lg"
              />
            </div>
          </div>
          <div className="perspective-hero-card relative lg:col-span-7">
            <div className="aspect-card-id1 flex w-full items-start justify-center rotate-x-hero-main-x rotate-y-hero-main-y rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card p-3 shadow-metal-card">
              <ResponsiveImage
                image={content.mainImage}
                sizes="heroMain"
                eager
                className="aspect-4/3 h-4/5 max-w-full rounded-lg lg:aspect-4/5"
              />
            </div>
            <p
              aria-hidden="true"
              className="absolute bottom-4 left-4 z-(--z-raised) inline-flex items-center gap-2 rounded-pill bg-surface-raised px-inset-button-x py-inset-button-y text-sm font-medium text-text-primary shadow-md"
            >
              <InboxIcon className="size-(--size-icon-md) shrink-0 text-text-brand" />
              {t("visualChip")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
