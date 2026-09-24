import { getTranslations } from "next-intl/server";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";

/*
 * Section 12 (02 §3.14): pricing.
 * No rate, no amount and no net figure during the pilot (D48, 2026-09-24): the commission is
 * presented as included, and the account manager states it before any commitment. No arithmetic
 * and no simulator here: the commission is only ever computed by the future `billing` domain
 * (CLAUDE.md §3 and §6).
 */
export async function PricingSection() {
  const t = await getTranslations("landing.pricing");

  return (
    <section aria-labelledby="pricing-title" className="bg-surface-muted">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter py-section-block lg:grid-cols-12 lg:gap-grid-gap">
        <div className="flex flex-col gap-section-header lg:col-span-8">
          <SectionHeader
            titleId="pricing-title"
            overline={t("overline")}
            title={t.rich("title", mutedTitleTags)}
          />

          <div className="flex flex-col gap-6 rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card p-inset-card shadow-metal-card">
            <p className="text-heading-3 font-semibold text-text-primary">
              {t("lead")}
            </p>

            <div className="flex flex-col gap-2 text-md text-text-primary">
              <p>{t("audience.advertiser")}</p>
              <p>{t("audience.creator")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
