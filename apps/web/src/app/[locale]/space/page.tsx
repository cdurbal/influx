import { Suspense } from "react";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { MemberSpaceDashboard } from "@/components/space/MemberSpaceDashboard";
import { routing } from "@/i18n/routing";

export default async function MemberSpacePage({
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
            titleId="space-title"
            overline={
              isEn ? "Member Space · Hub" : "Espace Membre · Hub INFLUX"
            }
            title={
              isEn
                ? "Welcome to your INFLUX Space"
                : "Bienvenue dans votre Espace INFLUX"
            }
            lead={
              isEn
                ? "Manage your briefs, browse certified opportunities, discover anonymized creators, and monitor your collaborations."
                : "Pilotez vos briefs, explorez les opportunités certifiées, recherchez des créateurs anonymisés et suivez vos collaborations."
            }
          />
          <Suspense
            fallback={
              <div className="text-center py-12 text-text-tertiary text-xs">
                {isEn
                  ? "Loading dashboard..."
                  : "Chargement de l'espace membre..."}
              </div>
            }
          >
            <MemberSpaceDashboard locale={locale} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
