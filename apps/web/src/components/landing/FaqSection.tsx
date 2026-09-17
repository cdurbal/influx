import { getTranslations } from "next-intl/server";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { MailIcon } from "@/components/ui/icons";
import { SectionHeader } from "@/components/ui/SectionHeader";

type FaqSectionProps = {
  contactEmail: string;
};

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

/** Section 14 (02 §3.16): eight questions, all closed on load; contact email as plain text. */
export async function FaqSection({ contactEmail }: FaqSectionProps) {
  const t = await getTranslations("landing.faq");
  const items: AccordionItem[] = QUESTION_IDS.map((id) => ({
    id,
    title: t(`items.${id}.question`),
    content: <p>{t(`items.${id}.answer`)}</p>,
  }));

  const contact = (
    <p className="flex flex-col gap-1 text-md text-text-secondary">
      <span>{t("contactPrompt")}</span>
      <span className="flex items-center gap-2 font-semibold text-text-primary">
        <MailIcon
          aria-hidden="true"
          className="size-(--size-icon-md) shrink-0"
        />
        <span className="break-all">{contactEmail}</span>
      </span>
    </p>
  );

  return (
    <section aria-labelledby="faq-title" className="bg-surface-muted">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-section-header px-page-gutter py-section-block lg:grid-cols-12 lg:gap-grid-gap">
        <div className="lg:col-span-4">
          <div className="flex flex-col gap-6 lg:sticky lg:top-(--sticky-top-offset)">
            <SectionHeader
              titleId="faq-title"
              overline={t("overline")}
              title={t("title")}
              lead={t("lead")}
            />
            {/* Desktop position of the contact prompt; the mobile one follows the questions. */}
            <div className="hidden lg:block">{contact}</div>
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-(--container-narrow) flex-col gap-6 lg:col-span-7 lg:col-start-6 lg:max-w-none">
          <Accordion idPrefix="faq" items={items} />
          <div className="lg:hidden">{contact}</div>
        </div>
      </div>
    </section>
  );
}
