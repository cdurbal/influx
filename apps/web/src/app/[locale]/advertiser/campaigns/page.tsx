import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { CampaignList } from "@/components/campaign/CampaignList";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

export default async function AdvertiserCampaignsPage({
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
            titleId="advertiser-campaigns-title"
            overline={
              isEn
                ? "Advertiser Space · Campaigns"
                : "Espace Annonceur · Campagnes"
            }
            title={
              isEn ? "Campaign Tracking & Briefs" : "Mes Campagnes & Briefs"
            }
            lead={
              isEn
                ? "Track your submitted campaigns, review application volumes, manage lifecycle states, or launch a new brief."
                : "Suivez vos campagnes soumises, consultez les candidatures reçues, pilotez les états de diffusion et créez de nouveaux briefs."
            }
          />
          <CampaignList locale={locale} />
        </div>
      </main>
    </>
  );
}
