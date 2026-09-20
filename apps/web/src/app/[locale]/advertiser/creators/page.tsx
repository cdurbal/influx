import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { CreatorSearch } from "@/components/search/CreatorSearch";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

export default async function AdvertiserCreatorsPage({
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
            titleId="advertiser-creators-title"
            overline={
              isEn
                ? "Advertiser Space · Creators"
                : "Espace Annonceur · Créateurs"
            }
            title={
              isEn ? "Anonymized Creator Search" : "Recherche de Créateurs"
            }
            lead={
              isEn
                ? "Explore certified and anonymized creators tailored to your brand, audience criteria and target budgets."
                : "Trouvez des créateurs certifiés et anonymisés adaptés à vos critères d'audience, thématiques et budgets."
            }
          />
          <Suspense
            fallback={
              <div className="p-12 text-center text-text-muted">
                {isEn ? "Loading search..." : "Chargement de la recherche..."}
              </div>
            }
          >
            <CreatorSearch locale={locale} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
