import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { CreatorProfileEditor } from "@/components/creator/CreatorProfileEditor";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export default async function CreatorProfilePage({
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
              href="/creator/campaigns"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
            >
              <span>
                {isEn
                  ? "Browse Opportunities →"
                  : "Explorer les opportunités →"}
              </span>
            </Link>
          </div>
          <SectionHeader
            titleId="creator-profile-title"
            overline={isEn ? "Creator Space" : "Espace Créateur"}
            title={
              isEn
                ? "Creator Profile & Rate Card"
                : "Profil Créateur & Grille Tarifaire"
            }
            lead={
              isEn
                ? "Manage your anonymous presentation, your portfolio, your rates and your private contact details."
                : "Gérez votre présentation anonyme, votre portfolio, vos tarifs indicatifs et vos coordonnées privées."
            }
          />
          <CreatorProfileEditor locale={locale} />
        </div>
      </main>
    </>
  );
}
