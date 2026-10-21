import { getTranslations } from "next-intl/server";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { landingPhoto } from "@/content/landing-images";

// Brokered MVP path (D45, D46, A1): contract and payment happen outside the platform.
const STEP_IDS = [
  "brief",
  "introduction",
  "acceptance",
  "conversation",
  "contract",
  "delivery",
] as const;

/** Section 8 (02 §3.10): the real MVP path in six steps, first step open on load. */
export async function MethodSection() {
  const t = await getTranslations("landing.method");
  const items: AccordionItem[] = STEP_IDS.map((id) => ({
    id,
    title: t(`steps.${id}.title`),
    content: <p>{t(`steps.${id}.body`)}</p>,
  }));

  return (
    <section aria-labelledby="method-title" className="bg-surface-muted">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter py-section-block lg:grid-cols-12 lg:gap-grid-gap">
        <SectionHeader
          titleId="method-title"
          overline={t("overline")}
          title={t.rich("title", mutedTitleTags)}
          lead={t("lead")}
          className="lg:col-span-7"
        />
        <div className="lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-(--sticky-top-offset)">
            <ResponsiveImage
              image={landingPhoto("method01")}
              sizes="sideDecoration"
              className="aspect-16/9 w-full rounded-lg lg:aspect-4/5"
            />
          </div>
        </div>
        <div className="lg:col-span-7 lg:row-start-2">
          <Accordion
            idPrefix="method"
            items={items}
            defaultOpenIds={["brief"]}
            numbered
          />
        </div>
      </div>
    </section>
  );
}
