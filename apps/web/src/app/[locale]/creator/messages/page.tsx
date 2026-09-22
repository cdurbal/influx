import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { MemberMessagingHub } from "@/components/chat/MemberMessagingHub";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

export default async function CreatorMessagesPage({
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
      <AuthHeader role="creator" />
      <main id="main" className="bg-surface-page min-h-screen">
        <div className="mx-auto flex max-w-(--container-max) flex-col gap-8 px-page-gutter py-section-block">
          <SectionHeader
            titleId="creator-messages-title"
            overline={
              isEn
                ? "Creator Space · Supervised Messaging"
                : "Espace Créateur · Messagerie supervisée"
            }
            title={
              isEn
                ? "My Negotiations & Three-Party Messaging"
                : "Mes Négociations & Messagerie à trois"
            }
            lead={
              isEn
                ? "Discuss campaign deliverables, creative scope and terms with verified brands alongside your dedicated INFLUX advisor."
                : "Co-construisez vos partenariats avec les marques vérifiées, en direct et sous l'accompagnement de votre commercial INFLUX dédié."
            }
          />
          <MemberMessagingHub role="creator" locale={locale} />
        </div>
      </main>
    </>
  );
}
