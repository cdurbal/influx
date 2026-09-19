import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthHeader } from "@/components/auth/AuthHeader";
import { MemberAuthFlow } from "@/components/auth/OtpCodeInput";
import { LinkButton } from "@/components/ui/LinkButton";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { routing } from "@/i18n/routing";

/** Auth OTP login page (Mission 1.4 & D37) */
export default async function LoginPage({
  params,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <>
      <AuthHeader />
      <main id="main" className="bg-surface-page">
        <div className="mx-auto flex max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-block">
          <SectionHeader
            titleId="login-title"
            overline={t("auth.login.overline")}
            title={t("auth.login.title")}
            lead={t("auth.login.lead")}
          />
          <MemberAuthFlow mode="login" locale={locale} />
          <p className="flex flex-wrap items-center gap-2 text-md text-text-secondary">
            {t("auth.login.signupPrompt")}
            <LinkButton href="/signup" variant="text">
              {t("auth.login.signupCta")}
            </LinkButton>
          </p>
        </div>
      </main>
    </>
  );
}
