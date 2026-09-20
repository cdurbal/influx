import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { CampaignFeed } from "@/components/creator-campaigns/CampaignFeed";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

export default async function CreatorCampaignsPage({
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
        <div className="mx-auto flex max-w-(--container-max) flex-col gap-8 px-page-gutter py-section-block">
          <SectionHeader
            titleId="creator-campaigns-title"
            overline={
              isEn
                ? "Creator Space · Opportunities"
                : "Espace Créateur · Opportunités"
            }
            title={isEn ? "Open Campaigns Feed" : "Fil des Campagnes Ouvertes"}
            lead={
              isEn
                ? "Discover brand briefs, verify matching deliverables and compensation, and apply with your concept."
                : "Découvrez les briefs des marques, vérifiez l'adéquation des livrables et de la rémunération, et proposez votre concept."
            }
          />
          <Suspense
            fallback={
              <div className="p-12 text-center text-text-muted">
                {isEn
                  ? "Loading campaigns feed..."
                  : "Chargement du fil des campagnes..."}
              </div>
            }
          >
            <CampaignFeed locale={locale} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
