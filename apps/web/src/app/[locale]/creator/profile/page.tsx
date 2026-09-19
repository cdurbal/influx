import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { CreatorProfileEditor } from "@/components/creator/CreatorProfileEditor";
import { SectionHeader } from "@/components/ui/SectionHeader";
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
