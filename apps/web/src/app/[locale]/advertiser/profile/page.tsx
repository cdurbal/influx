import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { BrandProfileForm } from "@/components/brand/BrandProfileForm";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default async function AdvertiserProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  const isEn = locale === "en";

  return (
    <>
      <AuthHeader />
      <main id="main" className="bg-surface-page min-h-screen">
        <div className="mx-auto flex max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-block">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
            <Link
              href="/space"
              className="inline-flex items-center gap-2 text-xs font-semibold text-text-secondary hover:text-brand-primary transition-colors"
            >
              <span aria-hidden="true">←</span>
              <span>
                {isEn
                  ? "Back to Member Space (Hub)"
                  : "Retour à Mon Espace (Hub)"}
              </span>
            </Link>
            <Link
              href="/advertiser/campaigns"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <span>{isEn ? "My Campaigns →" : "Mes Campagnes →"}</span>
            </Link>
          </div>
          <SectionHeader
            titleId="brand-profile-title"
            overline={isEn ? "Advertiser Space" : "Espace Annonceur"}
            title={
              isEn
                ? "Brand Profile & Collaboration Settings"
                : "Profil Marque & Préférences de collaboration"
            }
            lead={
              isEn
                ? "Describe your brand, set your collaboration criteria, and submit your profile for validation by INFLUX."
                : "Décrivez votre marque, définissez vos critères de collaboration et soumettez votre profil pour publication sur INFLUX."
            }
          />
          <BrandProfileForm locale={locale} />
        </div>
      </main>
    </>
  );
}
