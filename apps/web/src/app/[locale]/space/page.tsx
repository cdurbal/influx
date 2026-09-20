import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { InfoIcon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

function isKnownProfile(
  value: string | undefined,
): value is "advertiser" | "creator" {
  return value === "advertiser" || value === "creator";
}

/**
 * Placeholder member space (docs/landing-page/00-cadrage.md §6): reached after the mocked
 * sign-up or login. Stands in for the real annonceur/créateur dashboards of Lots 2 to 5
 * (campaigns, matching, messaging, contracts) so the founder can show the concept end to end.
 */
export default async function MemberSpacePage({
  params,
  searchParams,
}: PageProps<"/[locale]/space">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const search = await searchParams;
  const profileParam = Array.isArray(search.profile)
    ? search.profile[0]
    : search.profile;
  const profile = isKnownProfile(profileParam) ? profileParam : null;
  const t = await getTranslations("landing.auth");

  const lead =
    profile === "advertiser"
      ? t("space.leadAdvertiser")
      : profile === "creator"
        ? t("space.leadCreator")
        : t("space.leadGeneric");

  return (
    <>
      <AuthHeader />
      <main id="main" className="bg-surface-page">
        <div className="mx-auto flex max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-block">
          <SectionHeader
            titleId="space-title"
            overline={t("space.overline")}
            title={t("space.title")}
            lead={lead}
          />
          <p className="flex items-start gap-2 rounded-md border-(length:--border-width-thin) border-feedback-info-border bg-feedback-info-bg p-inset-card text-sm text-feedback-info-text">
            <InfoIcon
              aria-hidden="true"
              className="mt-1 size-(--size-icon-sm) shrink-0 text-feedback-info-icon"
            />
            {t("space.mockupNotice")}
          </p>
          {profile === "creator" && (
            <div className="flex flex-wrap gap-4 pt-2">
              <LinkButton href="/creator/campaigns" variant="primary">
                {locale === "en"
                  ? "Browse Open Campaigns"
                  : "Trouver une campagne"}
              </LinkButton>
              <LinkButton href="/creator/profile" variant="secondary">
                {locale === "en" ? "My Creator Profile" : "Mon profil créateur"}
              </LinkButton>
            </div>
          )}
          {profile === "advertiser" && (
            <div className="flex flex-wrap gap-4 pt-2">
              <LinkButton href="/advertiser/creators" variant="primary">
                {locale === "en" ? "Search Creators" : "Recherche de créateurs"}
              </LinkButton>
              <LinkButton href="/advertiser/campaigns" variant="secondary">
                {locale === "en" ? "My Campaigns" : "Mes campagnes"}
              </LinkButton>
              <LinkButton href="/advertiser/profile" variant="secondary">
                {locale === "en" ? "My Brand Profile" : "Mon profil marque"}
              </LinkButton>
            </div>
          )}
          <LinkButton href="/" variant="secondary" className="self-start">
            {t("space.backHome")}
          </LinkButton>
        </div>
      </main>
    </>
  );
}
