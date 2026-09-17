import { getLocale, getTranslations } from "next-intl/server";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LinkButton } from "@/components/ui/LinkButton";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import type { StartFormProfile } from "@/components/landing/start-form-validation";
import { AccountForm, type AccountFormLabels } from "./AccountForm";

const TITLE_ID = "account-signup-title";

/**
 * Renders the sign-up page for a fixed profile (docs/landing-page/00-cadrage.md §6): the
 * /signup/advertiser and /signup/creator routes both call this with their profile, so the page
 * chrome and translation wiring exist once.
 */
export async function AccountSignupPage({
  profile,
}: {
  profile: StartFormProfile;
}) {
  const t = await getTranslations("landing");
  const locale = await getLocale();

  const labels: AccountFormLabels = {
    requiredLegend: t("startForm.requiredLegend"),
    requiredMark: t("startForm.requiredMark"),
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
      label:
        profile === "advertiser"
          ? t("startForm.country.labelAdvertiser")
          : t("startForm.country.labelCreator"),
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
      label:
        profile === "advertiser"
          ? t("startForm.marketingConsent.labelAdvertiser")
          : t("startForm.marketingConsent.labelCreator"),
      hint: t("startForm.marketingConsent.hint"),
    },
    privacyNotice: t("startForm.privacyNotice"),
    submit: t("auth.signup.submit"),
    success: {
      title: t("auth.signup.success.title"),
      body:
        profile === "advertiser"
          ? t("auth.signup.success.bodyAdvertiser")
          : t("auth.signup.success.bodyCreator"),
      cta: t("auth.signup.success.cta"),
    },
  };

  return (
    <>
      <AuthHeader />
      <main id="main" className="bg-surface-page">
        <div className="mx-auto flex max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-block">
          <SectionHeader
            titleId={TITLE_ID}
            overline={t(`auth.signup.${profile}.overline`)}
            title={t(`auth.signup.${profile}.title`)}
            lead={t(`auth.signup.${profile}.lead`)}
          />
          <AccountForm
            titleId={TITLE_ID}
            profile={profile}
            labels={labels}
            countries={getLocalizedCountryOptions(locale)}
            pageLocale={locale}
          />
          <p className="flex flex-wrap items-center gap-2 text-md text-text-secondary">
            {t("auth.signup.changeProfile")}
            <LinkButton href="/signup" variant="text">
              {t("auth.signup.changeProfileCta")}
            </LinkButton>
          </p>
        </div>
      </main>
    </>
  );
}
