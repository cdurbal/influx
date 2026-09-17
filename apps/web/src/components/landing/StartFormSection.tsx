import { getLocale, getTranslations } from "next-intl/server";
import { CheckIcon } from "@/components/ui/icons";
import { ResponsiveImage } from "@/components/ui/ResponsiveImage";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import type { LandingImage, MockupNotice } from "@/content/landing-content";
import { StartFormSteps, type StartFormLabels } from "./StartFormSteps";

type StartFormSectionProps = {
  image: LandingImage;
  mockupNotice: MockupNotice;
};

const REASSURANCE_IDS = ["free", "progressive", "noPayment"] as const;

/** Section 16 (02 §3.18): mockup sign-up in three steps. Nothing is sent or stored (CA8). */
export async function StartFormSection({
  image,
  mockupNotice,
}: StartFormSectionProps) {
  const t = await getTranslations("landing");
  const locale = await getLocale();
  const total = 3;

  const labels: StartFormLabels = {
    progress: {
      1: t("startForm.progress", { current: 1, total }),
      2: t("startForm.progress", { current: 2, total }),
      3: t("startForm.progress", { current: 3, total }),
    },
    stepTitles: {
      1: t("startForm.steps.profile.title"),
      2: t("startForm.steps.account.title"),
      3: t("startForm.steps.consents.title"),
    },
    requiredLegend: t("startForm.requiredLegend"),
    requiredMark: t("startForm.requiredMark"),
    actions: {
      back: t("startForm.actions.back"),
      continue: t("startForm.actions.continue"),
      submit: t("startForm.actions.submit"),
    },
    profile: {
      legend: t("startForm.profile.legend"),
      options: {
        advertiser: {
          title: t("startForm.profile.advertiser.title"),
          description: t("startForm.profile.advertiser.description"),
        },
        creator: {
          title: t("startForm.profile.creator.title"),
          description: t("startForm.profile.creator.description"),
        },
      },
      errorRequired: t("startForm.profile.errors.required"),
    },
    email: {
      label: t("startForm.email.label"),
      errorRequired: t("startForm.email.errors.required"),
      errorFormat: t("startForm.email.errors.format"),
    },
    company: {
      label: t("startForm.company.label"),
      errorRequired: t("startForm.company.errors.required"),
    },
    country: {
      labelAdvertiser: t("startForm.country.labelAdvertiser"),
      labelCreator: t("startForm.country.labelCreator"),
      emptyOption: t("startForm.country.emptyOption"),
      openCountriesInfo: t("startForm.country.openCountriesInfo"),
      errorRequired: t("startForm.country.errors.required"),
    },
    language: {
      legend: t("startForm.language.legend"),
      options: [
        { locale: "fr", name: t("header.languageSwitcher.frName") },
        { locale: "en", name: t("header.languageSwitcher.enName") },
      ],
    },
    adult: {
      label: t("startForm.adult.label"),
      hint: t("startForm.adult.hint"),
      errorRequired: t("startForm.adult.errors.required"),
    },
    terms: {
      label: t("startForm.terms.label"),
      errorRequired: t("startForm.terms.errors.required"),
    },
    marketingConsent: {
      labelAdvertiser: t("startForm.marketingConsent.labelAdvertiser"),
      labelCreator: t("startForm.marketingConsent.labelCreator"),
      hint: t("startForm.marketingConsent.hint"),
    },
    privacyNotice: t("startForm.privacyNotice"),
    mockupNotice,
  };

  return (
    <section aria-labelledby="start-form-title" className="bg-surface-page">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter py-section-block lg:grid-cols-12 lg:gap-grid-gap">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <SectionHeader
            titleId="start-form-title"
            overline={t("startForm.overline")}
            title={t("startForm.title")}
            lead={t("startForm.lead")}
          />
          <ResponsiveImage
            image={image}
            sizes="sideDecoration"
            className="hidden aspect-3/2 w-full rounded-lg lg:block"
          />
          <ul className="flex flex-col gap-3">
            {REASSURANCE_IDS.map((id) => (
              <li
                key={id}
                className="flex items-start gap-2 text-md text-text-primary"
              >
                <CheckIcon
                  aria-hidden="true"
                  className="mt-1 size-(--size-icon-md) shrink-0 text-text-brand"
                />
                {t(`startForm.reassurance.${id}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="lg:col-span-6 lg:col-start-7">
          <StartFormSteps
            titleId="start-form-title"
            labels={labels}
            countries={getLocalizedCountryOptions(locale)}
            pageLocale={locale}
          />
        </div>
      </div>
    </section>
  );
}
