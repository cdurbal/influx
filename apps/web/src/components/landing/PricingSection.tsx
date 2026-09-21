import { getTranslations } from "next-intl/server";
import { cn } from "@/components/ui/class-names";
import { CheckIcon, InfoIcon } from "@/components/ui/icons";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";

/*
 * Section 12 (02 §3.14): transparent pricing, CA19 to CA21.
 * STATIC TEXT ONLY: every rate and amount below is a translated string written in landing.json,
 * already formatted for the language. No arithmetic, no rate, no simulator in this component:
 * the commission is only ever computed by the future `billing` domain (CLAUDE.md §3 and §6).
 */

const LEGEND_ITEMS = [
  { id: "advertiserShare", swatchClassName: cn("bg-data-advertiser-share") },
  { id: "creatorShare", swatchClassName: cn("bg-data-creator-share") },
  { id: "netCreator", swatchClassName: cn("bg-data-net-creator") },
] as const;

export async function PricingSection() {
  const t = await getTranslations("landing.pricing");
  const cellClassName = cn("py-3 align-top");
  const amountClassName = cn(
    "py-3 pl-4 text-right align-top whitespace-nowrap tabular-nums",
  );

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
            <table className="w-full border-collapse text-left text-md text-text-primary">
              <caption className="pb-3 text-left text-heading-3 font-semibold text-text-primary">
                {t("lead")}
              </caption>
            </table>

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
