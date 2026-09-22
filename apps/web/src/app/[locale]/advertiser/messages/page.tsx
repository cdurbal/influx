import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { MemberMessagingHub } from "@/components/chat/MemberMessagingHub";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

export default async function AdvertiserMessagesPage({
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
      <AuthHeader role="advertiser" />
      <main id="main" className="bg-surface-page min-h-screen">
        <div className="mx-auto flex max-w-(--container-max) flex-col gap-8 px-page-gutter py-section-block">
          <SectionHeader
            titleId="advertiser-messages-title"
            overline={
              isEn
                ? "Advertiser Space · Supervised Messaging"
                : "Espace Annonceur · Messagerie supervisée"
            }
            title={
              isEn
                ? "Negotiations & Three-Party Messaging"
                : "Mes Négociations & Messagerie à trois"
            }
            lead={
              isEn
                ? "Negotiate terms directly with creators under the guidance and supervision of your dedicated INFLUX commercial advisor."
                : "Échangez directement avec vos créateurs partenaires dans un cadre supervisé et assisté par votre commercial INFLUX dédié."
            }
          />
          <MemberMessagingHub role="advertiser" locale={locale} />
        </div>
      </main>
    </>
  );
}
