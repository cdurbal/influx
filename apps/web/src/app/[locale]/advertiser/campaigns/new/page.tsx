import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { CampaignForm } from "@/components/campaign/CampaignForm";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

export default async function NewCampaignPage({
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
          <SectionHeader
            titleId="new-campaign-title"
            overline={
              isEn
                ? "Advertiser Space · Campaigns"
                : "Espace Annonceur · Campagnes"
            }
            title={
              isEn
                ? "Create a New Campaign Brief"
                : "Créer une nouvelle campagne"
            }
            lead={
              isEn
                ? "Define your deliverables, target audience and compensation in 5 easy steps. Your brief will be reviewed by INFLUX before publication."
                : "Définissez vos livrables, votre audience cible et la rémunération en 5 étapes. Votre brief sera validé par l'équipe INFLUX avant publication."
            }
          />
          <CampaignForm locale={locale} />
        </div>
      </main>
    </>
  );
}
