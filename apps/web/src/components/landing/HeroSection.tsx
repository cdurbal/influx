import { getTranslations } from "next-intl/server";
import { AudienceDoors } from "@/components/ui/AudienceDoors";
import { CheckIcon, InboxIcon } from "@/components/ui/icons";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { ShortVideoOverlay } from "@/components/ui/ShortVideoOverlay";
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
    <section
      aria-labelledby="hero-title"
      className="relative isolate bg-surface-page"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block"
      >
        <div className="absolute top-(--inset-hero-halo-top) left-(--inset-hero-halo-left) z-(--z-behind) h-(--size-hero-halo-height) w-(--size-hero-halo-width) rotate-hero-halo bg-overlay-hero-halo blur-hero-halo" />
      </div>
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
          <div className="relative z-(--z-raised) hidden lg:col-span-5 lg:mt-9 lg:block">
            <div className="perspective-hero-card">
              <div className="aspect-card-id1 flex w-full items-start justify-center rotate-x-hero-secondary-x rotate-y-hero-secondary-y rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card p-3 shadow-metal-card">
                <ResponsiveImage
                  image={content.secondaryImage}
                  sizes="heroSecondary"
                  className="aspect-square h-4/5 max-w-full rounded-lg"
                />
              </div>
            </div>
            <p
              aria-hidden="true"
              className="absolute top-full left-1/2 z-(--z-raised) mt-3 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-pill bg-surface-raised px-inset-button-x py-inset-button-y text-sm font-medium text-text-primary shadow-md"
            >
              <InboxIcon className="size-(--size-icon-md) shrink-0 text-text-brand" />
              {t("visualChip")}
            </p>
          </div>
          <div className="perspective-hero-card relative mx-auto w-full max-w-(--size-phone-mockup) lg:col-span-7 lg:mx-0">
            <PhoneFrame className="aspect-phone-frame w-full rotate-x-hero-main-x rotate-y-hero-main-y">
              <ResponsiveImage
                image={content.mainImage}
                sizes="heroMain"
                eager
                className="h-full w-full"
              />
              <ShortVideoOverlay />
            </PhoneFrame>
          </div>
        </div>
      </div>
    </section>
  );
}
