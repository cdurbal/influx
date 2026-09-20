import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { CampaignDetailView } from "@/components/creator-campaigns/CampaignDetailView";
import { routing } from "@/i18n/routing";

export default async function CreatorCampaignDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
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
          <Suspense
            fallback={
              <div className="p-12 text-center text-text-muted">
                {isEn ? "Loading campaign brief..." : "Chargement du brief..."}
              </div>
            }
          >
            <CampaignDetailView campaignId={id} locale={locale} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
