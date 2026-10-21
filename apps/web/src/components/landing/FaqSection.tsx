import { getTranslations } from "next-intl/server";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";

// Order fixed by 02 §3.16.
const QUESTION_IDS = [
  "signupCost",
  "commission",
  "payment",
  "currency",
  "openCountries",
  "hiddenHandles",
  "messaging",
  "eligibility",
] as const;

/**
 * Section 14 (02 §3.16): eight questions, all closed on load. The contact address was fictitious:
 * it left with the module (J9 commit 5), and no real address is published yet.
 */
export async function FaqSection() {
  const t = await getTranslations("landing.faq");
  const items: AccordionItem[] = QUESTION_IDS.map((id) => ({
    id,
    title: t(`items.${id}.question`),
    content: <p>{t(`items.${id}.answer`)}</p>,
  }));

  return (
    <section aria-labelledby="faq-title" className="bg-surface-muted">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-section-header px-page-gutter py-section-block lg:grid-cols-12 lg:gap-grid-gap">
        <div className="lg:col-span-4">
          <div className="flex flex-col gap-6 lg:sticky lg:top-(--sticky-top-offset)">
            <SectionHeader
              titleId="faq-title"
              overline={t("overline")}
              title={t.rich("title", mutedTitleTags)}
              lead={t("lead")}
            />
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-(--container-narrow) flex-col gap-6 lg:col-span-7 lg:col-start-6 lg:max-w-none">
          <Accordion idPrefix="faq" items={items} />
        </div>
      </div>
    </section>
  );
}
